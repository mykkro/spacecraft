// Mission model tests: no browser, graphics context, server, or external dependencies.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {boot} = require('./verify_ships.js');
function missionWorld(saved) {
  const world = boot(saved, {withStarbases: true, withMissions: true});
  world.ctx.GameAudio.setEngine = () => {};
  world.ctx.drops = [];
  world.ctx.damageShip = amount => {world.ctx.ship.hull = Math.max(0, world.ctx.ship.hull - amount);};
  const pen = new Proxy({}, {get(target, key) {
    if (key in target) return target[key];
    if (key === 'createRadialGradient') return () => ({addColorStop() {}});
    return () => {};
  }});
  const canvas = world.ctx.document.querySelector('#chart');
  canvas.getContext = () => pen;
  canvas.getBoundingClientRect = () => ({width: 800, height: 500});
  const objects = world.ctx.document.querySelector('#mapObjects');
  objects.insertAdjacentHTML = function(position, html) {
    this.innerHTML = position === 'afterbegin' ? html + (this.innerHTML || '') : (this.innerHTML || '') + html;
  };
  world.ctx.devicePixelRatio = 1;
  world.ctx.radar = () => {};
  for (const file of ['navigation.js', 'pirates.js', 'quests.js'])
    world.run(fs.readFileSync(path.join(__dirname, '../../js', file), 'utf8'));
  return {...world, ...world.run('({MissionContracts, StarChart, Starbases, QuestLog, Raiders})')};
}
const w = missionWorld();
const {Colony} = w.model;
assert.equal(w.StarChart.signals().length, 0);
Colony.recordMined('crystal', 12);
assert(Colony.claimQuest('mine-crystal').ok);
assert(w.StarChart.located.includes('1:0'));
assert(!w.StarChart.visited.includes('1:0'));
assert(w.StarChart.signals().some(p => p.to === '1:0'));
assert.equal(Colony.claimQuest('mine-crystal').ok, false);
assert.equal(w.StarChart.revealRoute('0:0', '4:0'), false);
// Delivery acceptance supplies navigation knowledge, but never supplies free cargo.
assert(w.MissionContracts.accept('haul-ingots'));
assert.equal(w.MissionContracts.accept('haul-ingots'), false);
assert.equal(w.QuestLog.canClaim('haul-ingots'), false);
const ingots = Colony.availableCount('ingot');
assert(ingots >= 8);
const source = w.Starbases.currentStation();
Object.assign(w.ctx.ship, {x: source.x, y: source.y});
assert(w.Starbases.openDock());
assert.equal(Colony.claimQuest('haul-ingots').ok, false);
assert.equal(Colony.availableCount('ingot'), ingots);
w.Starbases.closeDock();
const destination = w.Starbases.station(1, 0);
Object.assign(w.ctx.ship, {x: destination.x, y: destination.y, vx: 0, vy: 0});
assert.equal(w.QuestLog.canClaim('haul-ingots'), false); // Near a dock is not docked.
assert(w.Starbases.openDock());
w.QuestLog.openLog();
assert(w.ctx.document.querySelector('#questCards').innerHTML.includes('haul-ingots'));
const balance = w.Starbases.snapshot().credits;
assert(Colony.claimQuest('haul-ingots').ok);
assert.equal(Colony.availableCount('ingot'), ingots - 8);
assert.equal(w.Starbases.snapshot().credits, balance + 180);
assert(w.StarChart.located.includes('1:1'));
assert(!w.StarChart.visited.includes('1:1'));
assert.equal(Colony.claimQuest('haul-ingots').ok, false);
assert.equal(w.Starbases.snapshot().credits, balance + 180);
w.QuestLog.closeLog();
w.Starbases.closeDock();
const reload = missionWorld(w.store);
assert.equal(reload.MissionContracts.state('haul-ingots'), 'active');
assert.equal(reload.model.Colony.claimQuest('haul-ingots').ok, false);
assert.equal(reload.Starbases.snapshot().credits, balance + 180);
assert(reload.StarChart.located.includes('1:1'));
// Escort missions can fail and retry, but only start in their own system.
const e = missionWorld();
assert(e.MissionContracts.accept('escort-courier'));
e.ctx.ship.x = 13000;
e.MissionContracts.update(.1);
assert.equal(e.MissionContracts.state('escort-courier'), 'failed');
assert.equal(e.MissionContracts.accept('escort-courier'), false);
Object.assign(e.ctx.ship, {x: -1800, y: -900});
assert(e.MissionContracts.accept('escort-courier'));
// Real hostile projectiles damage the courier when the player does not protect it.
for (let i = 0; i < 1400 && e.MissionContracts.state('escort-courier') === 'active'; i++) {
  const courier = e.MissionContracts.courier;
  e.ctx.ship.x = courier.x; e.ctx.ship.y = courier.y + 850;
  e.MissionContracts.update(.1);
}
assert.equal(e.MissionContracts.state('escort-courier'), 'failed');
assert.equal(e.model.Colony.claimQuest('escort-courier').ok, false);
assert(e.MissionContracts.accept('escort-courier'));
// Keep the player near the convoy; shoot ambushers through the actual Raiders API.
let waves = 0, swept = false, restored = false, current = e;
for (let i = 0; i < 900 && current.MissionContracts.state('escort-courier') === 'active'; i++) {
  const courier = current.MissionContracts.courier;
  current.ctx.ship.x = courier.x; current.ctx.ship.y = courier.y + 80;
  current.MissionContracts.update(.1);
  if (current.MissionContracts.hostiles.length) {
    waves++;
    const enemy = current.MissionContracts.hostiles[0];
    assert.equal(current.Raiders.sweep(enemy.x, enemy.y, enemy.x, enemy.y).enemy, enemy);
    swept = true;
    if (!restored) {
      current.model.Colony.save();
      current = missionWorld(current.store);
      assert(current.MissionContracts.hostiles.length > 0);
      assert.equal(current.MissionContracts.courier.status, 'active');
      restored = true;
    }
    for (const pirate of [...current.MissionContracts.hostiles])
      assert(current.Raiders.hit({damage: 100}, pirate));
  }
}
assert(swept && restored && waves === 2);
assert.equal(current.MissionContracts.state('escort-courier'), 'complete');
assert.equal(current.ctx.drops.length, 0); // No restart-farming loot.
assert(current.QuestLog.canClaim('escort-courier'));
// A full hold blocks the whole payout without losing completion or paying credits.
const bag = current.model.Colony;
assert(bag.addItem('stone', (bag.bag.length - bag.bag.filter(Boolean).length) * 64));
const escortBalance = current.Starbases.snapshot().credits;
assert.equal(bag.claimQuest('escort-courier').ok, false);
assert.equal(current.Starbases.snapshot().credits, escortBalance);
assert(current.QuestLog.canClaim('escort-courier'));
assert(bag.consumeItem('stone', 64));
assert(bag.claimQuest('escort-courier').ok);
assert.equal(current.Starbases.snapshot().credits, escortBalance + 180);
assert.equal(bag.availableCount('plate'), 4);
assert.equal(current.MissionContracts.accept('escort-courier'), false);
const finished = missionWorld(current.store);
assert.equal(finished.MissionContracts.state('escort-courier'), 'complete');
assert.equal(finished.model.Colony.claimQuest('escort-courier').ok, false);
console.log('PASS: coordinate rewards without scanner/false visits, destination-only cargo handover, credit persistence, escort shots/failure/retry, real pirate hits, mid-wave reload, completion, full-hold payout safety and one-time rewards. No browser started.');

// Claim feedback stays beside the clicked button when full cargo blocks payout.
const feedbackWorld = missionWorld();
const feedbackCargo = feedbackWorld.model.Colony;
feedbackCargo.recordMined('metal', 24);
const claimButton = {dataset: {claim: 'mine-iron'}};
const cards = feedbackWorld.ctx.document.querySelector('#questCards');
cards.querySelectorAll = selector => selector === '[data-claim]' ? [claimButton] : [];
feedbackWorld.QuestLog.openLog();
assert(cards.innerHTML.includes('data-claim-message="mine-iron"'));
for (let i = 0; i < feedbackCargo.bag.length; i++) feedbackCargo.bag[i] = {type: 'metal', qty: 64};
const beforeClaim = JSON.stringify(feedbackCargo.bag);
claimButton.onclick();
const feedback = feedbackWorld.ctx.document.querySelector('[data-claim-message="mine-iron"]');
assert.equal(feedback.hidden, false);
assert(feedback.textContent.includes('Free inventory space'));
assert.equal(JSON.stringify(feedbackCargo.bag), beforeClaim);
assert(!feedbackCargo.questProgress().claimed.includes('mine-iron'));
feedbackCargo.bag[0] = null;
feedbackCargo.bag[1] = null;
claimButton.onclick();
assert(feedbackCargo.questProgress().claimed.includes('mine-iron'));
assert.equal(feedback.hidden, false);
assert.equal(feedback.textContent, 'Rewards added to your inventory.');
assert.equal(feedbackCargo.availableCount('block'), 16);
assert.equal(feedbackCargo.availableCount('glass'), 8);
console.log('PASS: blocked and successful claim buttons show feedback beside the quest.');

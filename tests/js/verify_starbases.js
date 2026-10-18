// Fast model checks; no browser, WebGL, network or background processes.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {boot} = require('./verify_ships.js');
const world = boot(undefined, {withStarbases: true});
const {Colony, Fuel, Weapons, Shipyard} = world.model;
const stations = world.run('Starbases');
world.ctx.GameAudio.setEngine = () => {};
assert.equal(stations.snapshot().credits, 120);
assert.equal(stations.snapshot().crew.length, 0);
assert.equal(stations.openDock(), false);
Object.assign(world.ctx.ship, {x: 1800, y: 1100, vx: 100});
assert.equal(stations.openDock(), false);
world.ctx.ship.vx = 0;
assert(stations.openDock());
assert(world.ctx.paused);
const ore = Colony.availableCount('metal');
assert(stations.trade('metal', false));
assert.equal(Colony.availableCount('metal'), ore - 1);
assert.equal(stations.snapshot().credits, 122);
assert(stations.trade('ammo_piercer', true));
assert.equal(Colony.availableCount('ammo_piercer'), 1);
assert(stations.hire('miner'));
assert.equal(stations.snapshot().credits, 24);
assert.equal(stations.hire('miner'), false);
assert.equal(stations.hire('engineer'), false);
assert.equal(stations.hire('__proto__'), false);
const rock = {hp: 50, hardness: 0, x: 0, y: 0};
assert(Weapons.damageRock({damage: 4, tier: 1}, rock, false));
assert.equal(rock.hp, 45);
const hard = {hp: 50, hardness: 3, x: 0, y: 0};
assert.equal(Weapons.damageRock({damage: 100, tier: 0}, hard, false), false);
assert.equal(hard.hp, 50);
stations.restore({credits: 200, crew: ['miner']});
assert(stations.repair());
assert.equal(world.ctx.ship.hull, 100);
assert.equal(stations.snapshot().credits, 173);
assert.equal(stations.repair(), false);
assert(stations.hire('engineer'));
const fuel = Fuel.amount + Fuel.reserve;
Fuel.drive(1, false, 1);
assert(Math.abs(fuel - Fuel.amount - Fuel.reserve - Shipyard.current.fuelBurn * .8) < 1e-8);
assert(Colony.addItem('stone', (Colony.bag.length - Colony.bag.filter(Boolean).length) * 64));
const balance = stations.snapshot().credits;
assert.equal(stations.trade('ammo_seismic', true), false);
assert.equal(stations.snapshot().credits, balance);
assert.equal(stations.trade('missing', true), false);
stations.restore({credits: 200, crew: ['miner', 'engineer']});
assert(stations.hire('mechanic'));
stations.closeDock();
assert.equal(world.ctx.paused, false);
assert.equal(stations.trade('metal', false), false);
world.ctx.ship.hull = 80;
stations.update(.1);
stations.update(7);
assert.equal(world.ctx.ship.hull, 80);
stations.update(1);
stations.update(5);
assert(world.ctx.ship.hull > 80);
world.ctx.ship.hull = 70;
stations.update(.1);
assert.equal(world.ctx.ship.hull, 70);
Colony.save();
const reloaded = boot(world.store, {withStarbases: true});
assert.equal(reloaded.run('Starbases.snapshot().credits'), stations.snapshot().credits);
assert.equal(reloaded.run('Starbases.snapshot().crew.length'), 3);
assert.equal(reloaded.model.Colony.availableCount('ammo_piercer'), 1);
for (const match of world.ctx.document.querySelector('#stationMarket').innerHTML.matchAll(/src="([^"]+)"/g))
  assert(fs.existsSync(path.join(__dirname, '../..', match[1])), match[1]);
console.log('PASS: station docking, trade, cargo capacity, credit persistence, recruitment, mining hardness, fuel efficiency, passive repairs and market icons. No browser started.');

// Exercise the actual map with stations present, using a lightweight canvas spy.
const calls = [];
const pen = new Proxy({}, {get(target, key) {
  if (key in target) return target[key];
  if (key === 'createRadialGradient') return () => ({addColorStop() {}});
  return (...args) => calls.push({key, args});
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
world.run(fs.readFileSync(path.join(__dirname, '../../js', 'navigation.js'), 'utf8'));
const nav = world.run('StarChart');
nav.openMap();
assert(objects.innerHTML.includes('data-starbase="0:0"'));
nav.selectMarker({type: 'starbase', id: '0:0'});
assert(world.ctx.document.querySelector('#mapDetails').innerHTML.includes('Wayfarer Exchange'));
nav.setView('global');
assert(calls.some(call => call.key === 'fillText' && call.args[0] === 'Wayfarer Exchange'));
nav.closeMap();
console.log('PASS: starbase lists, selectable station details and global markers. No browser started.');

// Preset crew is derived from the ship, so switching never grants duplicate robots.
const kraxnaWorld = boot(undefined, {withStarbases: true});
kraxnaWorld.ctx.GameAudio.setEngine = () => {};
const fleetCrew = kraxnaWorld.run('Starbases');
const hulls = kraxnaWorld.model.Shipyard;
assert.equal(fleetCrew.crewCount(), 1);
assert(fleetCrew.startingCrewSummary('starfox').includes('Mara Voss'));
hulls.choose('kraxna');
kraxnaWorld.model.Colony.resizeCargo();
assert.equal(hulls.current.captain, 'Jegor Kokotovič');
assert.equal(fleetCrew.crewCount(), 2);
assert.equal(fleetCrew.crewCapacity(), 5);
assert(fleetCrew.startingCrewSummary().includes('Bobo'));
Object.assign(kraxnaWorld.ctx.ship, {x: 1800, y: 1100, hull: 73});
assert.equal(fleetCrew.repairCost(), 14); // 27 missing hull / 2, rounded up.
assert(fleetCrew.openDock());
assert(kraxnaWorld.ctx.document.querySelector('#stationCrew').innerHTML.includes('Jegor Kokotovič'));
assert(kraxnaWorld.ctx.document.querySelector('#stationCrew').innerHTML.includes('Bobo'));
assert(fleetCrew.repair());
assert.equal(fleetCrew.snapshot().credits, 106);
assert.equal(kraxnaWorld.ctx.ship.hull, 100);
fleetCrew.closeDock();
for (let i = 0; i < 3; i++) {
  hulls.choose('nomad');
  assert.equal(fleetCrew.crewCount(), 1);
  kraxnaWorld.ctx.ship.hull = 73;
  assert.equal(fleetCrew.repairCost(), 27);
  hulls.choose('kraxna');
  assert.equal(fleetCrew.crewCount(), 2);
  assert.equal(fleetCrew.repairCost(), 14);
}
fleetCrew.restore({crew: ['miner', 'engineer', 'mechanic']});
assert.equal(fleetCrew.crewCount(), 5);
kraxnaWorld.model.Colony.save();
const crewReload = boot(kraxnaWorld.store, {withStarbases: true});
assert.equal(crewReload.run('Starbases.crewCount()'), 5);
assert.equal(crewReload.run('Starbases.repairCost()'), 14);
assert.equal(crewReload.model.Shipyard.current.captain, 'Jegor Kokotovič');
crewReload.model.Shipyard.choose('starfox');
assert.equal(crewReload.run('Starbases.crewCount()'), 4);
assert.equal(crewReload.run('Starbases.repairCost()'), 27);
console.log('PASS: named preset captains, Kraxna + Bobo starting crew, 50% repair rounding, roster UI, safe preset switching, hired crew preservation and save reload. No browser started.');

// Generated avatars must exist for every roster identity and ship preset.
for (const id of ['jegor', 'bobo', 'rhea', 'tarek', 'ada', 'captain']) {
  const png = fs.readFileSync(path.join(__dirname, '../..', 'assets', 'crew', id + '.png'));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), png.readUInt32BE(20), id + ' must be square');
}
assert(fleetCrew.startingCrewPortraits('kraxna').includes('jegor.png'));
assert(fleetCrew.startingCrewPortraits('kraxna').includes('bobo.png'));
assert(!fleetCrew.startingCrewPortraits('starfox').includes('bobo.png'));
assert(fleetCrew.startingCrewPortraits('nomad').includes('captain.png'));
for (const markup of [
  world.ctx.document.querySelector('#stationCrew').innerHTML,
  kraxnaWorld.ctx.document.querySelector('#stationCrew').innerHTML
]) {
  for (const match of markup.matchAll(/src="([^"]+)"/g))
    assert(fs.existsSync(path.join(__dirname, '../..', match[1])), match[1]);
}
console.log('PASS: six valid square avatar PNGs, station image references and preset portrait selection. No browser started.');

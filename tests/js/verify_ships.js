const { functionSource } = require('./test_source_utils.js');

// Fast model checks only: no browser, graphics context, server, or dependencies.
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path'),
  vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../../js', name), 'utf8');
function boot(saved, { onEvent, withStarbases = false, withMissions = false, withShields = false, withTracker = false, withSalvage = false } = {}) {
  const store = new Map(saved || []),
    elements = new Map();
  function element() {
    return {
      hidden: false,
      style: {
        setProperty() {
        }
      },
      dataset: {},
      classList: {
        toggle() {
        }
      },
      setAttribute() {
      },
      getAttribute() {
        return '';
      },
      append() {
      },
      addEventListener() {
      },
      querySelector: selector => get(selector),
      querySelectorAll: () => [],
      insertAdjacentHTML() {
      },
      focus() {
      }
    };
  }
  function get(selector) {
    if (!elements.has(selector))
      elements.set(selector, element());
    return elements.get(selector);
  }
  const ctx = vm.createContext({
    I18n: {
      t: x => x,
      html: x => x
    },
    document: {
      querySelector: get,
      createElement: element,
      body: element()
    },
    localStorage: {
      getItem: key => store.get(key) || null,
      setItem: (key, value) => store.set(key, value)
    },
    Image: class {
      getAttribute() {
        return this.src;
      }
    },
    addEventListener(...args) {
      if (onEvent) onEvent(...args);
    },
    queueMicrotask() {
    },
    canvas: element(),
    cargo: {
      metal: 0,
      ice: 0,
      crystal: 0,
      bulterite: 0
    },
    ship: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      hull: 73,
      invulnerable: 0
    },
    kills: 0,
    paused: false,
    keys: new Set(),
    time: 10,
    notify() {
    },
    GameAudio: {
      play() {
      }
    },
    rocks: [],
    shots: [],
    particles: [],
    burst() {
    },
    destroy() {
    },
    tri() {
    },
    line() {
    },
    disc() {
    },
    width: 1000,
    height: 800
  });
  const game = read('game.js');
  vm.runInContext(functionSource(game, 'random'), ctx);
  vm.runInContext(read('ships.js'), ctx);
  vm.runInContext(read('fuel.js'), ctx);
  if (withShields) vm.runInContext(read('shields.js'), ctx);
  if (withStarbases) vm.runInContext(read('starbases.js'), ctx);
  if (withMissions) vm.runInContext(read('missions.js'), ctx);
  if (withTracker) vm.runInContext(read('quest-tracker.js'), ctx);
  if (withSalvage) vm.runInContext(read('salvage.js'), ctx);
  vm.runInContext(read('crafting-plan.js'), ctx);
  vm.runInContext(read('systems.js'), ctx);
  vm.runInContext(read('weapons.js'), ctx);
  const run = code => vm.runInContext(code, ctx);
  return {
    ctx,
    store,
    run,
    model: run('({Shipyard,Colony,Weapons,Fuel})')
  };
}
module.exports = { boot };
if (require.main === module) {
  const fresh = boot(),
    {Shipyard, Colony, Weapons} = fresh.model;
  assert.equal(Shipyard.confirmed, false);
  assert.equal(Colony.bag.length, 30);
  assert.equal(JSON.parse(fresh.store.get('spacecraft-save-v1')).shipPreset, null);
  assert.equal(Shipyard.choose('bogus'), false);
  for (const id of ['starfox', 'kraxna', 'nomad']) {
    assert(Shipyard.choose(id));
    Colony.resizeCargo();
    Weapons.applyShipLoadout(true);
    assert.equal(Colony.bag.length, Shipyard.presets[id].slots);
    assert.equal(Weapons.selected.primary, Shipyard.presets[id].primary);
    assert(Weapons.unlocked(Weapons.selected.primary));
    assert.equal(fresh.ctx.ship.hull, 73);
  }
  assert(Shipyard.presets.starfox.speed > Shipyard.presets.nomad.speed);
  assert(Shipyard.presets.nomad.speed > Shipyard.presets.kraxna.speed);
  assert(Shipyard.presets.starfox.turn > Shipyard.presets.nomad.turn);
  Shipyard.choose('kraxna');
  Colony.resizeCargo();
  assert(Colony.addItem('stone', 64 * 35));
  const stones = Colony.count('stone'),
    ammo = Colony.count('ammo_rockbreaker');
  Shipyard.choose('starfox');
  Colony.resizeCargo();
  Colony.save();
  assert.equal(Colony.bag.length, 18);
  assert.equal(Colony.count('stone'), stones);
  assert(JSON.parse(fresh.store.get('spacecraft-save-v1')).overflow.length > 0);
  const resumed = boot(fresh.store),
    resumedModel = resumed.model;
  assert.equal(resumedModel.Shipyard.current.id, 'starfox');
  assert.equal(resumedModel.Shipyard.confirmed, true);
  assert.equal(resumedModel.Colony.count('stone'), stones);
  assert.equal(resumedModel.Colony.count('ammo_rockbreaker'), ammo);
  resumedModel.Shipyard.choose('kraxna');
  resumedModel.Colony.resizeCargo();
  assert.equal(JSON.parse(resumed.store.get('spacecraft-save-v1')).overflow.length, 0);
  assert.equal(resumedModel.Colony.count('stone'), stones);
  // Legacy inventory is preserved and offered a first-time ship choice.
  const legacyData = JSON.parse(resumed.store.get('spacecraft-save-v1'));
  legacyData.shipPreset = null;
  legacyData.bag = Array(30).fill(null);
  legacyData.bag[29] = {
    type: 'bulterite',
    qty: 8
  };
  legacyData.overflow = [];
  const legacy = boot([['spacecraft-save-v1', JSON.stringify(legacyData)]]);
  assert.equal(legacy.model.Shipyard.confirmed, false);
  assert.equal(legacy.model.Colony.count('bulterite'), 8);
  const combat = boot(),
    c = combat.model;
  assert(c.Colony.addItem('bulterite', 8));
  assert(c.Colony.cargoMass >= 96);
  const light = c.Shipyard.handling(0),
    loaded = c.Shipyard.handling(c.Colony.cargoMass);
  assert(loaded.thrust < light.thrust && loaded.speed < light.speed);
  c.Shipyard.choose('kraxna');
  c.Colony.resizeCargo();
  c.Weapons.applyShipLoadout(true);
  assert.equal(c.Weapons.selected.primary, 'mininglaser');
  assert(c.Weapons.fire('primary'));
  assert.equal(combat.ctx.shots[0].damage, 2);
  const mineRock = {
    hp: 20,
    hardness: 2
  };
  c.Weapons.damageRock(combat.ctx.shots[0], mineRock, false);
  assert.equal(mineRock.hp, 12);
  assert(c.Colony.addItem('ammo_bulshitter', 2));
  assert(c.Colony.addItem('bulshitter', 1));
  assert(c.Weapons.select('bulshitter'));
  combat.ctx.shots.length = 0;
  c.Weapons.cooldowns.primary.remaining = 0;
  assert(c.Weapons.fire('primary'));
  assert.equal(combat.ctx.shots.length, 5);
  assert(new Set(combat.ctx.shots.map(s => s.vx)).size === 5);
  assert(combat.ctx.shots.every(s => s.damage === .4 && s.life === .8 && s.tier === 0));
  assert(!c.Weapons.fire('primary'));
  assert.equal(combat.ctx.shots.length, 5);
  const hardRock = {
    hp: 20,
    hardness: 1
  };
  assert.equal(c.Weapons.damageRock(combat.ctx.shots[0], hardRock, false), false);
  assert.equal(hardRock.hp, 20);
  assert(c.Colony.addItem('ammo_fotron', 2));
  assert(c.Colony.addItem('fotron', 1));
  assert(c.Weapons.select('fotron'));
  c.Weapons.cooldowns.primary.remaining = 0;
  assert(c.Weapons.fire('primary'));
  const fotron = combat.ctx.shots.at(-1);
  assert(fotron.damage > c.Weapons.definitions.photon.damage);
  assert.equal(fotron.tier, 3);
  const dense = {
    hp: 24,
    hardness: 3
  };
  assert(c.Weapons.damageRock(fotron, dense, false));
  assert.equal(dense.hp, 17);
  // Every recipe must be reachable without another recipe matching its grid first.
  const patterns = new Set();
  for (const recipe of c.Colony.recipes) {
    const key = recipe.station + JSON.stringify(recipe.pattern);
    assert(!patterns.has(key), 'Duplicate recipe: ' + recipe.name);
    patterns.add(key);
  }
  const rockSource = read('game.js');
  combat.run(functionSource(rockSource, 'rock'));
  for (const size of [18, 45, 100]) {
    const r = combat.run('rock(0,0,' + size + ',123,"bulterite")');
    assert.equal(r.hardness, 3);
    assert(r.hp >= 20);
  }
  console.log('PASS: preset balance/loadouts, real inventory resizing, reserve recovery, save reload, legacy cargo, heavy material handling, mining laser damage, spread fire/cooldowns, Fotron gates, recipe uniqueness, durable Bulterite. No browser started.');
}

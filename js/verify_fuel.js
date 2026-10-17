const { functionSource } = require('./test_source_utils.js');

// Fuel and reactor checks run in memory; no browser, WebGL or server.
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const {boot} = require('./verify_ships.js');
const total = fuel => fuel.amount + fuel.reserve;
const close = (a, b) => assert(Math.abs(a - b) < 1e-7, a + ' != ' + b);
const game = boot(),
  {Fuel, Colony, Shipyard} = game.model;
assert.equal(Fuel.capacity, 180);
assert.equal(Fuel.amount, 180);
assert.equal(Colony.count('ion_cube'), 2);
assert(!Colony.refuel('ion_cube'));
assert.equal(Colony.count('ion_cube'), 2);
Fuel.drive(0, true, 50);
close(Fuel.amount, 180);
Fuel.drive(1, false, 10);
close(Fuel.amount, 170);
Fuel.drive(-1, true, 10);
close(Fuel.amount, 140);
Fuel.drive(1, false, 200);
close(total(Fuel), 0);
const solar = Fuel.drive(1, true, 1);
assert.equal(solar.thrustScale, .12);
assert.equal(solar.boost, false);
assert.equal(solar.solar, true);
assert(Colony.refuel('ion_cube'));
close(total(Fuel), 80);
assert.equal(Colony.count('ion_cube'), 1);
assert(Colony.addItem('blue_ion_cube', 2));
assert(Colony.refuel('blue_ion_cube'));
close(Fuel.amount, 180);
close(Fuel.reserve, 220);
assert.equal(Colony.count('blue_ion_cube'), 1);
assert(!Colony.refuel('blue_ion_cube'));
assert.equal(Colony.count('blue_ion_cube'), 1);
Fuel.drive(1, false, 30);
close(Fuel.amount, 180);
close(Fuel.reserve, 190);
Colony.save();
const reload = boot(game.store),
  restored = reload.model.Fuel;
close(total(restored), total(Fuel));
assert.equal(reload.model.Colony.count('ion_cube'), 1);
assert.equal(reload.model.Colony.count('blue_ion_cube'), 1);
const before = total(Fuel);
Shipyard.choose('starfox');
Fuel.reconfigure();
Colony.resizeCargo();
assert.equal(Fuel.capacity, 100);
close(total(Fuel), before);
Shipyard.choose('kraxna');
Fuel.reconfigure();
Colony.resizeCargo();
assert.equal(Fuel.capacity, 300);
close(total(Fuel), before);
Fuel.drive(1, false, 1000);
close(total(Fuel), 0);
assert(Colony.addItem('fuel_cell', 1));
const green = Colony.count('ion_cube');
assert(Colony.refuelBest());
close(total(Fuel), 20);
assert.equal(Colony.count('fuel_cell'), 0);
assert.equal(Colony.count('ion_cube'), green);
assert(!Fuel.insert(-1));
assert(!Fuel.insert(Infinity));
close(total(Fuel), 20);
// The frame loop must not burn fuel while paused.
const gameSource = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
const frameSource = functionSource(gameSource, 'frame');
game.ctx.last = 0;
game.ctx.render = () => {
};
game.ctx.requestAnimationFrame = () => {
};
game.ctx.GameAudio.setEngine = () => {
};
game.ctx.update = dt => Fuel.drive(1, false, dt);
game.ctx.paused = true;
game.run(frameSource);
const pausedFuel = total(Fuel);
game.run('frame(16)');
close(total(Fuel), pausedFuel);
game.ctx.paused = false;
game.run('frame(32)');
assert(total(Fuel) < pausedFuel);
// Real moon update and real crafting path, with no renderer.
const expedition = boot(),
  c = expedition.model;
expedition.ctx.ship.x = 720;
expedition.ctx.ship.y = -870;
c.Colony.land();
assert(c.Colony.onSurface);
expedition.ctx.toastTimer = 0;
const updateSource = functionSource(gameSource, 'update');
expedition.run(updateSource);
const parkedFuel = total(c.Fuel);
expedition.run('update(.1)');
close(total(c.Fuel), parkedFuel);
c.Colony.selectBuild('bench');
assert(c.Colony.editTile(15, 13, true));
assert(c.Colony.addItem('bulterite', 1));
assert(c.Colony.addItem('ion_cube', 1));
const blueRecipe = c.Colony.recipes.findIndex(r => r.out === 'blue_ion_cube');
assert(c.Colony.selectRecipe(blueRecipe));
assert(c.Colony.craft());
assert.equal(c.Colony.count('blue_ion_cube'), 1);
assert.equal(c.Colony.count('ion_cube'), 0);
// An old save gains the initial tank and two cubes once, without resetting other cargo.
const legacy = JSON.parse(expedition.store.get('spacecraft-save-v1'));
delete legacy.fuel;
delete legacy.fuelInitialized;
legacy.activeMoon = null;
legacy.bag = Array(30).fill(null);
legacy.bag[0] = {
  type: 'metal',
  qty: 23
};
legacy.overflow = [];
const migrated = boot([['spacecraft-save-v1', JSON.stringify(legacy)]]);
assert.equal(migrated.model.Colony.count('metal'), 23);
assert.equal(migrated.model.Colony.count('ion_cube'), 2);
assert.equal(migrated.model.Fuel.amount, 180);
const again = boot(migrated.store);
assert.equal(again.model.Colony.count('ion_cube'), 2);
console.log('PASS: thrust/reverse/boost consumption, coasting/paused/surface safety, 12% solar fallback, manual/automatic refuelling, cube charge conservation, fuel persistence, tank switching, blue cube crafting and one-time save migration. No browser started.');

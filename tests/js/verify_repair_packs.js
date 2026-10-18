// Timed repair-pack crafting and consumption; no browser or graphics context.
const assert = require('node:assert/strict');
const {boot} = require('./verify_ships.js');
const listeners = [];
const initial = boot();
Object.assign(initial.ctx.ship, {x: 720, y: -870});
initial.model.Colony.land();
initial.model.Colony.surface[13][40] = 'bench';
initial.model.Colony.save();
const w = boot(initial.store, {onEvent(name, callback, options) {
  if (name === 'keydown' && !options?.capture) listeners.push(callback);
}});
const c = w.model.Colony;
assert.equal(c.items.repair_pack.repair, 20);
assert.equal(c.items.repair_pack.maxStack, 8);
assert(c.addItem('plate', 1)); assert(c.addItem('ingot', 1));
const recipe = c.recipes.findIndex(recipe => recipe.out === 'repair_pack');
assert(recipe >= 0);
assert(c.selectRecipe(recipe));
assert(c.craft());
assert.equal(c.availableCount('repair_pack'), 0);
assert.equal(c.useRepairPack(), false);
for (let tick = 0; tick < 7; tick++) c.updateCrafting(.5);
assert.equal(c.availableCount('repair_pack'), 0);
c.updateCrafting(.5);
assert.equal(c.availableCount('repair_pack'), 1);
assert.equal(w.ctx.ship.hull, 73);
assert(c.useRepairPack());
assert.equal(w.ctx.ship.hull, 93);
assert.equal(c.availableCount('repair_pack'), 0);
assert(c.addItem('repair_pack', 2));
assert(c.useRepairPack());
assert.equal(w.ctx.ship.hull, 100);
assert.equal(c.availableCount('repair_pack'), 1);
assert.equal(c.useRepairPack(), false);
assert.equal(c.availableCount('repair_pack'), 1);
c.assignQuickSlot(0, 'repair_pack');
c.selectQuickSlot(0);
assert.equal(c.availableCount('repair_pack'), 1); // Editor does not consume.
w.ctx.ship.hull = 50;
c.selectQuickSlot(0, true);
assert.equal(w.ctx.ship.hull, 70);
assert.equal(c.availableCount('repair_pack'), 0);
assert.equal(c.useRepairPack(), false);
const reloaded = boot(w.store);
assert.equal(reloaded.ctx.ship.hull, 70);
assert.equal(reloaded.model.Colony.availableCount('repair_pack'), 0);
// Shortcut must ignore pause, repeated keydowns and text input.
assert(c.addItem('repair_pack', 1));
function key(overrides = {}) {
  const event = {code: 'KeyU', repeat: false, target: {tagName: 'BODY'}, preventDefault() {}, ...overrides};
  listeners.forEach(listener => listener(event));
}
w.ctx.paused = true;
key();
assert.equal(c.availableCount('repair_pack'), 1);
w.ctx.paused = false;
key({repeat: true});
key({target: {tagName: 'INPUT'}});
assert.equal(c.availableCount('repair_pack'), 1);
key();
assert.equal(w.ctx.ship.hull, 90);
assert.equal(c.availableCount('repair_pack'), 0);
console.log('PASS: queued recipe, 4-second fabrication, +20 hull/cap, no waste at full hull, quick-slot use, shortcut guards and atomic hull/item persistence. No browser started.');

// Craft actual special ammo and fire the real weapons; no browser.
const assert = require('node:assert/strict');
const {boot} = require('./verify_ships.js');
const initial = boot();
initial.ctx.ship.x = 720; initial.ctx.ship.y = -870;
initial.model.Colony.land();
initial.model.Colony.surface[13][40] = 'bench';
initial.model.Colony.save();
const w = boot(initial.store), {Colony: c, Weapons} = w.model;
for (const [type, quantity] of [['ingot', 5], ['bulterite', 1], ['crystal', 4], ['fotron', 1], ['bulshitter', 1]]) assert(c.addItem(type, quantity));
for (const type of ['ammo_fotron', 'ammo_bulshitter']) {
  const index = c.recipes.findIndex(recipe => recipe.out === type);
  assert(index >= 0);
  assert(c.selectRecipe(index));
  assert(c.craft());
  for (let tick = 0; tick < 40; tick++) c.updateCrafting(1);
}
assert.equal(c.availableCount('ammo_fotron'), 24);
assert.equal(c.availableCount('ammo_bulshitter'), 80);
assert.equal(c.items.ammo_fotron.maxStack, 32);
assert.equal(c.items.ammo_bulshitter.maxStack, 128);
c.launch();
assert(!c.onSurface);
w.ctx.paused = false;
assert(Weapons.select('bulshitter'));
w.ctx.shots.length = 0;
assert(Weapons.fire('primary'));
assert.equal(w.ctx.shots.length, 5);
assert.equal(c.availableCount('ammo_bulshitter'), 79);
assert(!Weapons.fire('primary')); // Cooldown must not consume another cartridge.
assert.equal(c.availableCount('ammo_bulshitter'), 79);
assert(Weapons.select('fotron'));
Weapons.cooldowns.primary.remaining = 0;
assert(Weapons.fire('primary'));
assert.equal(c.availableCount('ammo_fotron'), 23);
assert(c.consumeItem('ammo_fotron', 23));
Weapons.cooldowns.primary.remaining = 0;
const shots = w.ctx.shots.length;
assert(!Weapons.fire('primary'));
assert.equal(w.ctx.shots.length, shots);
assert.equal(Weapons.cooldowns.primary.remaining, 0);
const reload = boot(w.store);
assert.equal(reload.model.Colony.availableCount('ammo_fotron'), 0);
assert.equal(reload.model.Colony.availableCount('ammo_bulshitter'), 79);
console.log('PASS: workbench ammunition crafting, distinct stack limits, one cartridge per volley, cooldown safety, empty-gun rejection and persisted consumption. No browser started.');

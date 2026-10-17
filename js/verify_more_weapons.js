// Focused combat and recipe checks in memory; no browser or GPU.
const assert = require('node:assert/strict');
const {boot} = require('./verify_ships.js');

for (const output of ['plasma','railgun','cluster','ammo_railgun','ammo_cluster']) {
  const w = boot(), c = w.model.Colony;
  w.ctx.ship.x = 720; w.ctx.ship.y = -870;
  c.land();
  c.surface[13][40] = 'bench';
  c.save();
  const loaded = boot(w.store), colony = loaded.model.Colony;
  const index = colony.recipes.findIndex(r => r.out === output);
  assert(index >= 0, output);
  const recipe = colony.recipes[index];
  for (const material of recipe.pattern.filter(Boolean)) assert(colony.addItem(material, 1), material);
  const before = colony.availableCount(output);
  assert(colony.selectRecipe(index));
  assert(colony.craft(), output);
  for (let i = 0; i < 40; i++) colony.updateCrafting(1);
  assert.equal(colony.availableCount(output), before + recipe.qty, output);
}

const w = boot(), {Colony:c, Weapons:weapons} = w.model;
w.ctx.paused = false;
for (const id of ['plasma','railgun','cluster']) assert(c.addItem(id,1));
assert(c.addItem('ammo_railgun',1));
assert(c.addItem('ammo_cluster',1));
for (const [id, channel, count] of [['plasma','primary',7],['railgun','primary',1],['cluster','missile',3]]) {
  weapons.cooldowns[channel].remaining = 0;
  assert(weapons.select(id));
  w.ctx.shots.length = 0;
  assert(weapons.fire(channel));
  assert.equal(w.ctx.shots.length,count);
  assert(!weapons.fire(channel));
  assert(w.ctx.shots.every(s => s.weaponId === id));
  if (id === 'plasma') {
    assert.equal(w.ctx.shots[0].life,.55);
    assert(new Set(w.ctx.shots.map(s => s.vx)).size === 7);
    assert(!weapons.damageRock(w.ctx.shots[0],{hp:100,hardness:2},false));
  }
  if (id === 'railgun') {
    const rock = {hp:100,hardness:3};
    assert(weapons.damageRock(w.ctx.shots[0],rock,false));
    assert.equal(rock.hp,82);
  }
  if (id === 'cluster') assert(w.ctx.shots.every(s => s.blast === 65 && s.missile));
  const ammo = weapons.definitions[id].ammo;
  if (ammo) {
    assert.equal(c.availableCount(ammo),0); // One round powers the whole volley.
    weapons.cooldowns[channel].remaining = 0;
    assert(!weapons.fire(channel));
    assert.equal(w.ctx.shots.length,count);
  }
}
// Selecting another gun must retain the shared primary cooldown.
weapons.cooldowns.primary.remaining = 1;
assert(weapons.select('plasma'));
assert(!weapons.fire('primary'));
console.log('PASS: five actual recipes, spread/range, rock hardness, rail damage, cluster blasts, ammunition exhaustion and shared cooldowns. No browser started.');

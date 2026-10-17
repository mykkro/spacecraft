// Regression checks for surface and orbital station access. No browser or graphics.
const assert = require('node:assert/strict');
const { boot } = require('./verify_ships.js');

const initial = boot();
initial.ctx.ship.x = 720;
initial.ctx.ship.y = -870;
initial.model.Colony.land();
assert(initial.model.Colony.onSurface);

// Reproduce a saved base whose machines are far beyond the old 3.5-tile radius.
const map = initial.model.Colony.surface;
map[13][40] = 'bench';
map[13][41] = 'furnace';
initial.model.Colony.save();
const world = boot(initial.store);
const { Colony } = world.model;
function stations(colony = Colony) {
  return Array.from(colony.getStationAccess().stations).sort();
}
assert.deepEqual(stations(), ['bench', 'furnace', 'hand']);
assert.equal(Colony.player.x, 14);
assert.equal(Colony.getStationAccess().mode, 'surface');
assert.equal(Colony.getStationAccess().moon.name, 'Selene');

let connection = '';
world.ctx.document.querySelector('#slots .station-tabs').insertAdjacentHTML = (_, html) => {
  connection = html;
};
Colony.openInventory();
assert.equal(Colony.station, 'bench');
assert(connection.includes('Selene') && connection.includes('SURFACE STATIONS'));
let markup = world.ctx.document.querySelector('#slots').innerHTML;
for (const station of ['bench', 'furnace']) {
  const tag = markup.match(new RegExp('<button data-station="' + station + '"[^>]*>'))[0];
  assert(!tag.includes('disabled'));
}

// Both recipes work from anywhere on the surface using the same real inventory.
assert(Colony.addItem('ingot', 2));
assert(Colony.selectRecipe(3));
assert(Colony.craft());
assert.equal(Colony.count('plate'), 2);
const metalBefore = Colony.count('metal');
assert(Colony.selectRecipe(5));
assert(Colony.craft());
assert.equal(Colony.count('metal'), metalBefore - 1);

// Leaving the surface puts the ship in the same low-orbit range as landing access.
Colony.launch();
assert.equal(Colony.onSurface, false);
assert.equal(Colony.getStationAccess().mode, 'orbit');
assert.deepEqual(stations(), ['bench', 'furnace', 'hand']);
Colony.openInventory();
assert(connection.includes('ORBITAL STATION LINK'));
assert(Colony.selectRecipe(5));
assert(Colony.craft());
Colony.save();
const restored = boot(world.store).model.Colony;
assert.deepEqual(stations(restored), ['bench', 'furnace', 'hand']);
assert.equal(restored.getStationAccess().mode, 'orbit');

// Access ends outside the moon's landing radius, even for an already selected recipe.
const moon = Colony.getStationAccess().moon;
world.ctx.ship.x = moon.x + moon.r + 221;
world.ctx.ship.y = moon.y;
const inventoryBefore = JSON.stringify(Colony.bag);
assert.deepEqual(stations(), ['hand']);
assert.equal(Colony.craft(), false);
assert.equal(JSON.stringify(Colony.bag), inventoryBefore);
assert.equal(Colony.selectRecipe(3), false);
Colony.openInventory();
assert.equal(Colony.station, 'hand');
markup = world.ctx.document.querySelector('#slots').innerHTML;
assert(markup.match(/<button data-station="bench"[^>]*>/)[0].includes('disabled'));

// Re-entering low orbit reconnects; another unbuilt moon cannot borrow these machines.
world.ctx.ship.x = moon.x;
world.ctx.ship.y = moon.y - moon.r - 90;
assert.deepEqual(stations(), ['bench', 'furnace', 'hand']);
const other = Colony.getMoons().find(candidate =>
  candidate.id !== moon.id && Math.hypot(candidate.x - moon.x, candidate.y - moon.y) > 2000);
world.ctx.ship.x = other.x;
world.ctx.ship.y = other.y - other.r - 90;
Colony.land();
assert(Colony.onSurface);
assert.deepEqual(stations(), ['hand']);
assert(Colony.addItem('bench', 1));
assert(Colony.addItem('furnace', 1));
assert.deepEqual(stations(), ['hand']);

// Removing machines refreshes the cache immediately, including furnace-only outposts.
const removed = boot(initial.store);
const c = removed.model.Colony;
assert(c.addItem('ingot', 2));
assert(c.selectRecipe(3));
c.player.x = 40.5;
c.player.y = 14;
assert(c.editTile(40, 13, false));
assert.deepEqual(stations(c), ['furnace', 'hand']);
const beforeBlockedCraft = JSON.stringify(c.bag);
assert.equal(c.craft(), false);
assert.equal(JSON.stringify(c.bag), beforeBlockedCraft);
assert(c.selectRecipe(5));
assert(c.craft());
c.player.x = 41.5;
c.player.y = 14;
assert(c.editTile(41, 13, false));
assert.deepEqual(stations(c), ['hand']);
assert(c.count('bench') > 0 && c.count('furnace') > 0);
assert.equal(c.selectRecipe(5), false);
console.log('PASS: distant surface stations, enabled inventory tabs, real workbench/furnace crafting, orbital access, save reload, range limits, other moons, unplaced machines, and removal invalidation. No browser started.');


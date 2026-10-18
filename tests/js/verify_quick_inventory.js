// Quick inventory checks run entirely in memory; no browser, graphics, or server.
const assert = require('node:assert/strict');
const { boot } = require('./verify_ships.js');
const listeners = [];
const surfaceListeners = [];
const world = boot(undefined, {
  onEvent(name, callback, options) {
    if (name === 'keydown' && options?.capture) listeners.push(callback);
    else if (name === 'keydown') surfaceListeners.push(callback);
  }
});
const { Colony, Fuel, Weapons, Shipyard } = world.model;
const document = world.ctx.document;
document.querySelector('#shipyardOverlay').hidden = true;
document.querySelector('#overlay').hidden = true;
const defaults = ['block', 'glass', 'bench', 'furnace', 'lamp', 'stone'];
assert.deepEqual(Array.from(Colony.quickSlots), defaults);
const snapshot = JSON.stringify(Colony.bag);
const mass = Colony.cargoMass;

// Assignment changes shortcuts, not stacks, fuel, or cargo mass.
assert(Colony.assignQuickSlot(0, 'metal'));
assert(Colony.assignQuickSlot(1, null));
assert(Colony.swapQuickSlots(0, 1));
assert.equal(Colony.quickSlots[0], null);
assert.equal(Colony.quickSlots[1], 'metal');
assert.equal(JSON.stringify(Colony.bag), snapshot);
assert.equal(Colony.cargoMass, mass);
assert(!Colony.assignQuickSlot(6, 'block'));
assert(!Colony.assignQuickSlot(-1, 'block'));
assert(!Colony.assignQuickSlot(1.5, 'block'));
assert(!Colony.assignQuickSlot(0, '__proto__'));
assert(!Colony.assignQuickSlot(0, 'unknown'));
assert(!Colony.applyQuickDrop(0, { kind: 'quick', slot: 99 }));
const copy = Colony.quickSlots;
copy[0] = 'crystal';
assert.equal(Colony.quickSlots[0], null);

// Wire only the inventory nodes needed for real click/right-click/drag handlers.
const bagButtons = Colony.bag.map((_, index) => ({
  dataset: { slot: String(index) }
}));
const quickButtons = Array.from({ length: 6 }, (_, index) => ({
  dataset: { quickSlot: String(index) }
}));
let editorMarkup = '';
document.querySelector('#slots').querySelectorAll = selector =>
  selector === '[data-slot]' ? bagButtons : [];
document.querySelector('#quickInventory').querySelectorAll = () => quickButtons;
document.querySelector('#slots .bag-grid').insertAdjacentHTML = (_, html) => {
  editorMarkup = html;
};
document.querySelector('#overlay').hidden = false;
world.ctx.paused = true;
Colony.openInventory();
assert(editorMarkup.includes('SURFACE SHORTCUTS 1–6'));
const metalIndex = Colony.bag.findIndex(stack => stack?.type === 'metal');
bagButtons[metalIndex].onclick();
quickButtons[2].onclick();
assert.equal(Colony.quickSlots[2], 'metal');
assert.equal(JSON.stringify(Colony.bag), snapshot);
quickButtons[2].oncontextmenu({ preventDefault() {} });
assert.equal(Colony.quickSlots[2], null);

// Pinning a held half-stack leaves both halves and the cursor contents unchanged.
bagButtons[metalIndex].oncontextmenu({ preventDefault() {} });
const heldBefore = JSON.parse(world.store.get('spacecraft-save-v1')).carried;
assert.equal(heldBefore.type, 'metal');
quickButtons[3].onclick();
assert.equal(Colony.quickSlots[3], 'metal');
const heldAfter = JSON.parse(world.store.get('spacecraft-save-v1')).carried;
assert.deepEqual(heldAfter, heldBefore);
assert.equal(Colony.count('metal'), 6);
assert(Colony.closeInventory());
assert.equal(JSON.stringify(Colony.bag), snapshot);

// Real drag handlers copy references from bag and swap references between quick slots.
Colony.openInventory();
let payload = '';
const transfer = {
  types: ['application/x-spacecraft-quick'],
  setData(_, value) { payload = value; },
  getData() { return payload; }
};
bagButtons[metalIndex].ondragstart({ dataTransfer: transfer, preventDefault() {} });
quickButtons[0].ondrop({ dataTransfer: transfer, preventDefault() {} });
assert.equal(Colony.quickSlots[0], 'metal');
Colony.assignQuickSlot(5, 'block');
quickButtons[0].ondragstart({ dataTransfer: transfer, preventDefault() {} });
quickButtons[5].ondrop({ dataTransfer: transfer, preventDefault() {} });
assert.equal(Colony.quickSlots[5], 'metal');
assert.equal(Colony.quickSlots[0], 'block');
const beforeBadDrop = Array.from(Colony.quickSlots);
payload = '{invalid';
quickButtons[0].ondrop({ dataTransfer: transfer, preventDefault() {} });
assert.deepEqual(Array.from(Colony.quickSlots), beforeBadDrop);
assert.equal(JSON.stringify(Colony.bag), snapshot);

// Inventory digits assign selected stacks, while stacked menus and text inputs take priority.
bagButtons[metalIndex].onclick();
function digit(code, tagName = 'BUTTON') {
  const event = {
    code, repeat: false, target: { tagName },
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; }
  };
  listeners.forEach(listener => listener(event));
  return event;
}
assert(digit('Digit6').prevented);
assert.equal(Colony.quickSlots[5], 'metal');
assert(!digit('Digit1', 'INPUT').prevented);
world.ctx.Encyclopedia = { isOpen: true };
assert(!digit('Digit1').prevented);
delete world.ctx.Encyclopedia;
world.ctx.QuestLog = { isOpen: true };
assert(!digit('Digit1').prevented);
delete world.ctx.QuestLog;
world.ctx.StarChart = { mapOpen: true };
assert(!digit('Digit1').prevented);
delete world.ctx.StarChart;
document.querySelector('#shipyardOverlay').hidden = false;
assert(!digit('Digit1').prevented);
document.querySelector('#shipyardOverlay').hidden = true;
assert(Colony.closeInventory());
document.querySelector('#overlay').hidden = true;
world.ctx.paused = false;

// Save/reload and ship changes preserve mappings, empty slots, and active selection.
Colony.assignQuickSlot(4, null);
Colony.selectQuickSlot(5);
Shipyard.choose('nomad');
Colony.save();
const reload = boot(world.store).model.Colony;
assert.deepEqual(Array.from(reload.quickSlots), Array.from(Colony.quickSlots));
assert.equal(reload.activeQuickSlot, 5);
Shipyard.choose('starfox');
Colony.resizeCargo();
assert.deepEqual(Array.from(Colony.quickSlots), Array.from(reload.quickSlots));

// Fuels and weapons can be pinned; choosing them in the editor never activates them.
Fuel.drive(1, false, 1000);
Colony.assignQuickSlot(1, 'ion_cube');
Colony.selectQuickSlot(1);
assert.equal(Fuel.amount, 0);
const cubes = Colony.count('ion_cube');
Colony.selectQuickSlot(1, true);
assert.equal(Fuel.amount, 80);
assert.equal(Colony.count('ion_cube'), cubes - 1);
assert(Colony.addItem('bulshitter', 1));
Colony.assignQuickSlot(2, 'bulshitter');
Colony.selectQuickSlot(2, true);
assert.equal(Weapons.selected.primary, 'bulshitter');

// Non-building materials and empty slots cannot become terrain or consume resources.
world.ctx.ship.x = 720;
world.ctx.ship.y = -870;
Colony.land();
assert(Colony.onSurface);
Colony.assignQuickSlot(0, 'bench');
Colony.selectQuickSlot(0);
assert(Colony.editTile(15, 13, true));
Colony.assignQuickSlot(0, 'crystal');
Colony.selectQuickSlot(0);
const crystals = Colony.count('crystal');
assert.equal(Colony.selectedBuild, null);
assert.equal(Colony.editTile(16, 13, true), false);
assert.equal(Colony.count('crystal'), crystals);
Colony.assignQuickSlot(0, null);
assert.equal(Colony.editTile(16, 13, true), false);
const fuelBeforeTyping = JSON.stringify(Fuel.snapshot());
const activeBeforeTyping = Colony.activeQuickSlot;
surfaceListeners.forEach(listener => listener({ code: 'Digit2', repeat: false, target: { tagName: 'INPUT' } }));
assert.equal(Colony.activeQuickSlot, activeBeforeTyping);
assert.equal(JSON.stringify(Fuel.snapshot()), fuelBeforeTyping);

// Legacy saves retain defaults; invalid new references become empty without losing cargo.
const saved = JSON.parse(world.store.get('spacecraft-save-v1'));
delete saved.quickSlots;
delete saved.activeQuickSlot;
saved.activeMoon = null;
const legacy = boot([['spacecraft-save-v1', JSON.stringify(saved)]]);
assert.deepEqual(Array.from(legacy.model.Colony.quickSlots), defaults);
saved.quickSlots = ['__proto__', 'block', null, 'bad-id', 'ion_cube', 'stone'];
saved.activeQuickSlot = 99;
const repaired = boot([['spacecraft-save-v1', JSON.stringify(saved)]]);
assert.deepEqual(Array.from(repaired.model.Colony.quickSlots), [null, 'block', null, null, 'ion_cube', 'stone']);
assert.equal(repaired.model.Colony.activeQuickSlot, 0);
assert.equal(repaired.model.Colony.count('metal'), Colony.count('metal'));
console.log('PASS: quick-slot assignment/clearing/swapping, UI clicks, held halves, drag/drop, keyboard menu guards, save migration, ship changes, fuel/weapon use and safe terrain placement. No browser started.');


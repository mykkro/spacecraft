// In-memory encyclopedia checks: no browser, WebGL context or server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { boot } = require('./verify_ships.js');
const read = name => fs.readFileSync(path.join(__dirname, name), 'utf8');

function catalogue(czech = false) {
  const world = boot();
  const document = world.ctx.document;
  document.querySelector('#shipyardOverlay').hidden = true;
  document.querySelector('#overlay').hidden = true;
  world.ctx.GameAudio.setEngine = () => {};

  if (czech) {
    // Load the real translation engine, then rebuild presentation fields as a reload would.
    world.ctx.navigator = { language: 'cs-CZ' };
    world.ctx.NodeFilter = { SHOW_TEXT: 4 };
    document.documentElement = {};
    document.createTreeWalker = () => ({ nextNode: () => false });
    document.querySelector('.header-actions').prepend = () => {};
    world.run(read('i18n.js'));
    const language = world.run('I18n');
    for (const item of Object.values(world.model.Colony.items)) {
      item.name = language.t(item.name);
      item.description = language.t(item.description);
    }
  }

  const listeners = [];
  world.ctx.addEventListener = (name, callback, options) => {
    if (name === 'keydown' && options?.capture) listeners.push(callback);
  };
  world.run(read('encyclopedia.js'));
  return { ...world, guide: world.run('Encyclopedia'), listeners };
}

const world = catalogue();
const { guide, model } = world;
const entries = guide.entries();
assert.equal(entries.length, Object.keys(model.Colony.items).length);
for (const entry of entries) {
  assert(entry.name && entry.description.length > 20, entry.id);
  assert(fs.existsSync(path.join(__dirname, '..', entry.icon)), entry.icon);
  assert(entry.stackLimit > 0);
}
assert.equal(guide.entries('', 'machines').length, 10);
assert.equal(guide.entries('', 'fuel').length, 3);
assert.equal(guide.entries('', 'ammunition').length, 7);
assert(guide.entries('FOTRON').some(entry => entry.id === 'fotron'));
assert(guide.entries('blue ion').some(entry => entry.id === 'blue_ion_cube'));
assert(guide.entries('small pirate').some(entry => entry.id === 'bulshitter'));
assert.equal(guide.getEntry('fotron').owned, 0);
assert(guide.entries().some(entry => entry.id === 'fotron'));
assert.equal(guide.getEntry('blue_ion_cube').fuel, 320);
assert.equal(guide.getEntry('bulterite').stackLimit, 8);
assert.equal(guide.getEntry('mininglaser').weapon.rockDamage, 8);
assert.equal(guide.getEntry('not-an-item'), null);

const inventory = JSON.stringify(model.Colony.bag);
const fuel = JSON.stringify(model.Fuel.snapshot());
const save = world.store.get('spacecraft-save-v1');
let focused = 0;
world.ctx.document.activeElement = { isConnected: true, focus() { focused++; } };
world.ctx.keys.add('KeyW');
assert(guide.openView());
assert.equal(world.ctx.paused, true);
assert.equal(world.ctx.keys.size, 0);
assert(guide.showItem('fotron'));
assert.equal(guide.selectedId, 'fotron');
assert(world.ctx.document.querySelector('#encyclopediaDetails').innerHTML.includes('Crafting recipes'));
assert(world.ctx.document.querySelector('#encyclopediaDetails').innerHTML.includes('bulterite'));
assert(guide.showItem('blue_ion_cube'));
assert(world.ctx.document.querySelector('#encyclopediaDetails').innerHTML.includes('320'));

// Filtering does not recreate the search input or place query text into HTML.
const search = world.ctx.document.querySelector('#encyclopediaSearch');
search.value = '<script>alert(1)</script>';
search.oninput();
assert.equal(guide.selectedId, null);
assert(!world.ctx.document.querySelector('#encyclopediaItems').innerHTML.includes('<script>'));
assert(world.ctx.document.querySelector('#encyclopediaDetails').innerHTML.includes('No matching entries'));
guide.closeView();
assert.equal(world.ctx.paused, false);
assert.equal(focused, 1);
assert.equal(JSON.stringify(model.Colony.bag), inventory);
assert.equal(JSON.stringify(model.Fuel.snapshot()), fuel);
assert.equal(world.store.get('spacecraft-save-v1'), save);

// A menu opened over an inventory pause restores that pause.
search.value = '';
world.ctx.document.querySelector('#overlay').hidden = false;
world.ctx.paused = true;
guide.openView();
guide.closeView();
assert.equal(world.ctx.paused, true);
assert.equal(world.ctx.document.querySelector('#overlay').hidden, false);
world.ctx.document.querySelector('#overlay').hidden = true;
world.ctx.paused = false;

// First ship selection cannot be bypassed through the encyclopedia hotkey.
world.ctx.document.querySelector('#shipyardOverlay').hidden = false;
assert.equal(guide.openView(), false);
assert.equal(guide.isOpen, false);
world.ctx.document.querySelector('#shipyardOverlay').hidden = true;
function key(code, tagName = 'BODY') {
  const event = {
    code, target: { tagName }, repeat: false,
    preventDefault() { this.prevented = true; },
    stopImmediatePropagation() { this.stopped = true; }
  };
  world.listeners.forEach(listener => listener(event));
  return event;
}
assert(key('KeyB').prevented);
assert(guide.isOpen);
assert(key('Space').stopped);
key('KeyB', 'INPUT');
assert(guide.isOpen);
key('Escape', 'INPUT');
assert.equal(guide.isOpen, false);
assert.equal(world.ctx.paused, false);

// Czech names, descriptions and accent-insensitive search use actual translations.
const cs = catalogue(true);
assert.equal(cs.guide.getEntry('ion_cube').name, 'Iontová kostka');
assert(cs.guide.entries('iontova kostka').some(entry => entry.id === 'ion_cube'));
assert(cs.guide.entries('modra iontova').some(entry => entry.id === 'blue_ion_cube'));
assert(cs.guide.entries('bulsitr').some(entry => entry.id === 'bulshitter'));
assert(cs.guide.getEntry('scanner').description.includes('vormhoul'));
assert(cs.guide.openView());
assert(cs.ctx.document.querySelector('#encyclopediaDetails').innerHTML);
console.log('PASS: full item coverage, local icons, descriptions, categories, live stats, recipes, unowned items, safe search, Czech/diacritic search, modal keyboard isolation, pause/focus restoration, ship-picker guard and unchanged inventory/fuel. No browser started.');


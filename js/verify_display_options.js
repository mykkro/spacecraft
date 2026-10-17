// Display preferences and modal state, using the in-memory DOM stub.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {boot} = require('./verify_ships.js');
const source = fs.readFileSync(path.join(__dirname, 'display-options.js'), 'utf8');
function options(saved) {
  const w = boot(saved), values = new Map(), classes = new Map(), listeners = [];
  w.ctx.document.documentElement = {style: {setProperty(name, value) {values.set(name, value);}}};
  w.ctx.document.body.classList.toggle = (name, on) => classes.set(name, on);
  w.ctx.GameAudio.setEngine = () => {};
  w.ctx.addEventListener = (name, callback) => {if (name === 'keydown') listeners.push(callback);};
  w.run(source);
  return {...w, options: w.run('DisplayOptions'), values, classes, listeners};
}
const w = options();
assert.equal(w.options.preferences.textScale, 125);
assert.equal(w.values.get('--hud-scale'), '1.25');
w.options.set({textScale: 160, hints: false, contrast: true});
assert(w.classes.get('hide-flight-hints'));
assert(w.classes.get('high-contrast-hud'));
assert.equal(JSON.parse(w.store.get('spacecraft-display-v1')).textScale, 160);
const reload = options(w.store);
assert.equal(reload.options.preferences.textScale, 160);
reload.options.set({textScale: 999});
assert.equal(reload.options.preferences.textScale, 160);
reload.options.set({textScale: -1});
assert.equal(reload.options.preferences.textScale, 100);
reload.ctx.paused = true;
reload.options.show();
assert(reload.options.isOpen);
reload.options.close();
assert(reload.ctx.paused);
reload.ctx.paused = false;
reload.options.show();
assert(reload.ctx.paused);
reload.listeners.forEach(listener => listener({code: 'Escape', preventDefault() {}, stopImmediatePropagation() {}}));
assert(!reload.options.isOpen);
assert.equal(reload.ctx.paused, false);
const before = JSON.stringify(reload.options.preferences);
reload.options.set({textScale: NaN});
assert.equal(JSON.stringify(reload.options.preferences), before);
console.log('PASS: larger default HUD, clamped text scale, hint/contrast toggles, saved preference reload and modal pause restoration. No browser started.');

w.options.set({asteroidQuality: 'high'});
assert.equal(w.options.asteroidQuality, 'high');
assert.equal(options(w.store).options.asteroidQuality, 'high');
w.options.set({asteroidQuality: 'invalid'});
assert.equal(w.options.asteroidQuality, 'high');
console.log('PASS: saved and validated 3D detail selection.');

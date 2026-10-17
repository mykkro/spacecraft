// Render-model checks use the real geometry functions, with no WebGL or browser.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {boot} = require('./verify_ships.js');
const {functionSource} = require('./test_source_utils.js');
const w = boot();
w.run('let vertices = [];');
const game = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
for (const name of ['tri', 'triGradient', 'line', 'disc', 'rock']) w.run(functionSource(game, name));
w.run(fs.readFileSync(path.join(__dirname, 'world-art.js'), 'utf8'));
function validate() {
  const data = Array.from(w.run('vertices'));
  assert(data.length > 0 && data.length < 40000);
  assert.equal(data.length % 18, 0);
  assert(data.every(Number.isFinite));
  for (let i = 0; i < data.length; i += 6)
    assert(data.slice(i + 2, i + 6).every(value => value >= 0 && value <= 1));
  return data;
}
for (const type of ['metal', 'ice', 'crystal', 'bulterite', 'ion_cube', 'blue_ion_cube']) {
  for (const radius of [20, 50, 100]) {
    w.run('vertices = [];');
    w.run('globalThis.visualRock = rock(0, 0, ' + radius + ', 771, "' + type + '");');
    w.run('WorldArt.drawRock(visualRock, 200, 200);');
    const first = validate();
    w.run('vertices = []; WorldArt.drawRock(visualRock, 200, 200);');
    assert.deepEqual(validate(), first);
  }
}
for (const kind of ['starfox', 'kraxna', 'nomad', 'pirate', 'heavy', 'courier']) {
  w.run('vertices = []; WorldArt.drawShip("' + kind + '", 300, 200, .7, .6, 1.2, true);');
  validate();
}
w.model.Shipyard.choose('kraxna');
w.run('vertices = []; Shipyard.drawFlightShip(200, 200, 0);');
validate();
console.log('PASS: deterministic asteroid surfaces, finite shaded vertices, bounded geometry, all ship/hostile/courier models and shared ship-render integration. No browser started.');

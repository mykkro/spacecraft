// Base navigation checks use canvas spies, never a browser or graphics context.
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const {boot} = require('./verify_ships.js');
const source = fs.readFileSync(path.join(__dirname, 'navigation.js'), 'utf8');
const base = (id, x, y, name) => ({
  id,
  x,
  y,
  name,
  moonName: name + ' Moon',
  isBase: true,
  modules: 2,
  counts: {
    bench: 1,
    furnace: 1
  },
  beacons: 1,
  radius: 1200,
  footprint: 225
});
let bases = [
  base('0:0', 720, -600, 'Selene Base'),
  base('-2:0', -5200, 1000, 'West Base'),
  base('24:0', 96000, 0, 'Distant Base'),
  base('24:1', 97000, 800, 'Distant Outpost')
];
bases[3].isBase = false;
function chart(saved) {
  const world = boot(saved),
    calls = [];
  const pen = new Proxy({}, {
    get(target, key) {
      if (key === 'createRadialGradient')
        return () => ({addColorStop() {}});
      if (key in target)
        return target[key];
      return (...args) => calls.push({
        key,
        args,
        color: target.strokeStyle || target.fillStyle
      });
    }
  });
  world.model.Colony.getBases = () => bases;
  world.model.Colony.getMoons = () => [];
  const canvas = world.ctx.document.querySelector('#chart');
  canvas.getContext = () => pen;
  canvas.getBoundingClientRect = () => ({
    width: 800,
    height: 500
  });
  const objects = world.ctx.document.querySelector('#mapObjects');
  objects.insertAdjacentHTML = function (position, html) {
    this.innerHTML = position === 'afterbegin' ? html + (this.innerHTML || '') : (this.innerHTML || '') + html;
  };
  world.ctx.devicePixelRatio = 1;
  world.ctx.GameAudio.setEngine = () => {
  };
  world.ctx.radar = () => world.run('StarChart.drawRadar')(pen);
  world.run(source);
  return {
    ...world,
    chart: world.run('StarChart'),
    pen,
    calls,
    objects
  };
}
const world = chart(),
  nav = world.chart;
assert.equal(nav.online(), false);
const bearings = nav.baseBearings();
assert.equal(bearings.length, 4);
assert(bearings.some(b => b.distance > 6500));
assert.equal(bearings[0].id, '0:0');
for (const b of bearings) {
  assert(Number.isFinite(b.radarX) && Number.isFinite(b.radarY) && Number.isFinite(b.bearing));
  assert(Math.hypot(b.radarX - 78, b.radarY - 78) <= 64.00001);
}
const far = bearings.find(b => b.id === '24:0');
assert.equal(far.offscreen, true);
assert.equal(far.bearing, 90);
nav.drawRadar(world.pen);
assert.equal(world.ctx.document.querySelector('#baseRadarKey').hidden, false);
assert.equal(world.ctx.document.querySelector('#baseBearing').hidden, false);
assert.equal(world.calls.filter(c => c.key === 'strokeRect').length, 4);
assert(world.ctx.document.querySelector('#baseBearing').textContent.includes('Selene Base'));
nav.openMap();
for (const b of bases)
  assert(world.objects.innerHTML.includes('data-base="' + b.id + '"'));
nav.selectMarker({
  type: 'base',
  id: '24:0'
});
assert.equal(nav.view, 'global');
assert.equal(nav.trackedBase, '24:0');
nav.drawRadar(world.pen);
assert(world.ctx.document.querySelector('#baseBearing').textContent.includes('Distant Base'));
assert(world.calls.some(c => c.key === 'fillText' && String(c.args[0]).includes('BASES: 2')));
assert(nav.located.includes('8:0'));
for (const b of bases)
  assert(world.objects.innerHTML.includes(b.name));
const reload = chart(world.store);
assert.equal(reload.chart.trackedBase, '24:0');
assert(reload.chart.baseBearings().find(b => b.id === '24:0').tracked);
reload.chart.openMap();
reload.chart.setView('local');
reload.chart.selectMarker({
  type: 'base',
  id: '0:0'
});
assert.equal(reload.chart.view, 'local');
assert.equal(reload.chart.trackedBase, '0:0');
// Cardinal bearings, coincident positions, and current-system boundaries are stable.
const original = bases;
bases = [
  base('0:0', 0, 0, 'Here'),
  base('0:1', 0, -2000, 'North'),
  base('0:-1', 0, 2000, 'South'),
  base('-1:0', -2000, 0, 'West')
];
const cardinal = reload.chart.baseBearings();
assert.equal(cardinal.find(b => b.name === 'Here').radarX, 78);
assert.equal(cardinal.find(b => b.name === 'North').bearing, 0);
assert.equal(cardinal.find(b => b.name === 'South').bearing, 180);
assert.equal(cardinal.find(b => b.name === 'West').bearing, 270);
assert.equal(reload.chart.baseSystem({
  x: 6000,
  y: 0
}).id, '1:0');
assert.equal(reload.chart.baseSystem({
  x: -6001,
  y: 0
}).id, '-1:0');
bases = [];
reload.chart.discover();
reload.chart.drawRadar(reload.pen);
assert.equal(reload.chart.trackedBase, null);
assert.equal(reload.ctx.document.querySelector('#baseRadarKey').hidden, true);
assert.equal(reload.ctx.document.querySelector('#baseBearing').hidden, true);
bases = original;
console.log('PASS: unlimited base bearings without scanner, minimap edge bounds, all-base lists, grouped global markers, base selection, local/global focus, persistent target, cardinal bearings and deleted-base cleanup. No browser started.');

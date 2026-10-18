// Browser-free checks: deterministic scenery, finite shading and bounded travel cache.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let drawn = 0;
const ctx = vm.createContext({ship:{x:0,y:0},width:1280,height:800,
  triGradient(...args) {
    assert.equal(args.length,6);
    assert(args.flat().every(Number.isFinite));
    drawn++;
  }});
vm.runInContext(fs.readFileSync('js/deep-space.js','utf8')+';globalThis.scene=DeepSpace;',ctx);
const scene=ctx.scene;
for(let layer=0;layer<3;layer++) {
  const a=scene.buildTile(0,0,layer), b=scene.buildTile(0,0,layer);
  assert(a.length>0);
  assert.equal(JSON.stringify(a),JSON.stringify(b));
  for(const face of a) {
    assert(face.flat().every(Number.isFinite));
    for(const color of face.slice(3)) assert(color.every(v=>v>=0&&v<=1));
  }
}
scene.render();
assert(drawn>100,'Starting viewport includes visible scenery');
const initial=drawn;
ctx.ship.x=500; scene.render();
assert(drawn>initial,'Scenery remains visible while moving');
for(let i=0;i<30;i++) {
  ctx.ship.x=i*100000;ctx.ship.y=-i*80000;scene.render();
  assert(scene.cacheSize<=72);
}
const game=fs.readFileSync('js/game.js','utf8');
assert(game.indexOf('DeepSpace.render()')<game.indexOf('for (const s of stars)'));
assert(fs.readFileSync('index.html','utf8').includes('src="js/deep-space.js"'));
console.log('Deep-space geometry, visibility, deterministic tiles and bounded cache passed.');

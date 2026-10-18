// Baked moon surface geometry and actual Colony rendering, no browser or GPU.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {boot}=require('./verify_ships.js');
const w=boot();w.ctx.vertices=[];
w.run(fs.readFileSync('js/moon-art.js','utf8'));
const art=w.run('MoonArt'),moon=w.model.Colony.getMoons().find(m=>m.id==='0:0');
assert(moon);
assert.equal(art.typeFor(moon),'cratered');
const signatures=new Set();
for(const type of Object.keys(art.presets)){
  const model=art.buildModel(moon,type),data=model.data;
  assert(data.length>10000);assert.equal(data.length%18,0);
  assert(model.craters>=17);
  assert(Array.from(data).every(Number.isFinite));
  for(let i=0;i<data.length;i+=6){
    assert(Math.hypot(data[i],data[i+1])<1.05);
    assert(Array.from(data.slice(i+2,i+6)).every(v=>v>=0&&v<=1));
  }
  signatures.add(data.slice(2,5).join(','));
  assert.deepEqual(data,art.buildModel(moon,type).data);
}
assert.equal(signatures.size,5);
const types=new Set(Array.from({length:25},(_,i)=>art.typeFor({id:i+':1'})));
assert.equal(types.size,5);
art.render(moon,500,400);assert(w.ctx.vertices.length>10000);
const before=w.ctx.vertices.length;art.render(moon,-5000,-5000);assert.equal(w.ctx.vertices.length,before);
w.ctx.vertices.length=0;
w.model.Colony.renderMoons((x,y)=>[x-moon.x+500,y-moon.y+400]);
assert(w.ctx.vertices.length>10000,'Colony uses the new surface renderer');
for(let i=0;i<23;i++){
  art.render({id:i+':1',r:180},500,400);w.ctx.vertices.length=0;
  assert(art.cacheSize<=20);
}
console.log('PASS: five deterministic moon types, crater fields, finite spherical shading, radius bounds, real render integration, culling and bounded cache. No browser started.');

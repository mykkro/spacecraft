// Station geometry/render integration using the shared batch; no browser or GPU.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {boot}=require('./verify_ships.js');
const w=boot(undefined,{withStarbases:true});
let triangles=0,lights=0;
w.ctx.triGradient=(...args)=>{assert(args.flat().every(Number.isFinite));triangles++;};
w.ctx.disc=(...args)=>{assert(args.flat().every(Number.isFinite));lights++;};
w.run(fs.readFileSync('js/starbase-art.js','utf8'));
const art=w.run('StarbaseArt'),station=w.run('Starbases');
const styles=new Set();
for(let gx=0;gx<6;gx++){
  const model=art.buildModel(gx,0);styles.add(model.style);
  assert(model.triangles.length>500);
  for(const face of model.triangles){
    assert(face.points.flat().every(Number.isFinite));
    assert(face.colors.flat().every(v=>Number.isFinite(v)&&v>=0&&v<=1));
    assert(face.points.every(p=>Math.abs(p[0])<=model.bounds&&Math.abs(p[1])<=model.bounds));
  }
}
assert.equal(styles.size,3);
assert.deepEqual(art.buildModel(0,0),art.buildModel(0,0));
station.render(()=>[500,400]);
assert(triangles>500&&lights>0,'Actual station render dispatches shaded geometry');
const before=triangles;
station.render(()=>[-5000,-5000]);
assert.equal(triangles,before,'Offscreen station submits nothing');
for(let i=0;i<22;i++){
  art.render({gx:i,gy:0,x:0,y:0},()=>[500,400]);
  assert(art.cacheSize<=18);
}
console.log('PASS: three deterministic station structures, finite shaded geometry, bounds, shared-batch dispatch, lights, culling and bounded cache. No browser started.');

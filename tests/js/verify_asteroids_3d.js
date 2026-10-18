// Actual 3D mesh generation + GL call spy. No browser or graphics context.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const {boot} = require('./verify_ships.js');
const w=boot();
w.run(fs.readFileSync(path.join(__dirname, '../../js', 'asteroids-3d.js'),'utf8'));
const art=w.run('Asteroid3D');
for(const preset of Object.keys(art.presets)){
  const model=art.buildMesh(1234,preset,'balanced',90);
  assert(model.vertices.length>0&&model.indices.length>0);
  assert.equal(model.vertices.length%7,0);
  assert(Array.from(model.vertices).every(Number.isFinite));
  const count=model.vertices.length/7;
  assert(Array.from(model.indices).every(i=>i<count));
  let minZ=Infinity,maxZ=-Infinity;
  for(let i=0;i<model.vertices.length;i+=7){
    const n=Math.hypot(...model.vertices.slice(i+3,i+6));
    assert(Math.abs(n-1)<.001);
    minZ=Math.min(minZ,model.vertices[i+2]);maxZ=Math.max(maxZ,model.vertices[i+2]);
  }
  assert(minZ<-.4&&maxZ>.4,'Meshes must have real front and back volume');
  assert.deepEqual(Array.from(model.vertices),Array.from(art.buildMesh(1234,preset,'balanced',90).vertices));
}

// New natural variants appear in ordinary ore fields, without replacing ice/crystal identities.
assert.deepEqual(new Set(Array.from({length:7},(_,seed)=>art.presetFor({type:'metal',seed}))),
  new Set(['rubble','cratered','elongated','metallic','jagged','fractured','basalt']));
const basalt=art.surfaceColor({type:'metal',seed:6}), ordinary=art.surfaceColor({type:'metal',seed:0});
assert(basalt.every((v,i)=>v>0&&v<ordinary[i]*.6),'Basalt is darker but not black');
assert.deepEqual(basalt,art.surfaceColor({type:'metal',seed:6}));
assert.notDeepEqual(ordinary,art.surfaceColor({type:'metal',seed:7}));
for(const preset of ['jagged','fractured','basalt']){
  const sharp=art.buildMesh(1234,preset,'balanced',90);
  const smooth=art.buildMesh(1234,'rubble','balanced',90);
  assert.notDeepEqual(Array.from(sharp.vertices),Array.from(smooth.vertices));
  assert.equal(sharp.indices.length,smooth.indices.length,'Rough shapes reuse the existing mesh budget');
}

const low=art.buildMesh(3,'rubble','low',90),high=art.buildMesh(3,'rubble','high',90);
assert(high.indices.length>low.indices.length);
assert(high.vertices.length/7<65536);
assert.equal(art.presetFor({type:'ice',seed:1}),'ice');
assert.equal(art.presetFor({type:'bulterite',seed:1}),'metallic');
const rotation=art.rotation({angle:.8,seed:123});
for(let c=0;c<3;c++)assert(Math.abs(Math.hypot(...rotation.slice(c*3,c*3+3))-1)<1e-5);
// The renderer must use depth testing, indexed triangles, and delete old GPU buffers.
const calls=[];let id=0,attribute=0;
const gl=new Proxy({}, {get(target,key){
  if(key in target)return target[key];
  if(/^[A-Z_]+$/.test(key))return key;
  if(key==='getShaderParameter'||key==='getProgramParameter')return ()=>true;
  if(key==='getAttribLocation')return ()=>attribute++;
  if(key==='getUniformLocation')return (p,name)=>name;
  if(key.startsWith('create'))return ()=>({id:++id});
  return (...args)=>calls.push({key,args});
}});
const rocks=Array.from({length:99},(_,seed)=>({seed,type:'metal',r:20,x:200,y:200,angle:.2}));
art.render(gl,rocks,(x,y)=>[x,y],800,600,'low');
assert(calls.some(c=>c.key==='enable'&&c.args[0]==='DEPTH_TEST'));
assert.equal(calls.filter(c=>c.key==='drawElements').length,99);
assert(calls.some(c=>c.key==='deleteBuffer'));
assert(calls.some(c=>c.key==='disable'&&c.args[0]==='DEPTH_TEST'));
art.dispose();
console.log('PASS: nine seeded volumetric presets, normals/indices, quality levels, 3-axis rotation, depth-tested indexed drawing and bounded GPU-cache eviction. No browser or graphics context started.');

// Exercise real render()/flush2D() orchestration with a GL spy.
const {functionSource}=require('./test_source_utils.js');
const game=fs.readFileSync(path.join(__dirname, '../../js', 'game.js'),'utf8');
w.ctx.gl=gl;w.ctx.stars=[];w.ctx.drops=[];w.ctx.shake=0;w.ctx.mod=(a,b)=>(a%b+b)%b;
w.run('let vertices=[]; const program={name:"2d"}, buffer={name:"batch"}, pos=0, color=1, resolution={};');
for(const name of ['tri','triGradient','line','disc','rock','flush2D','render'])w.run(functionSource(game,name));
w.run(fs.readFileSync(path.join(__dirname, '../../js', 'world-art.js'),'utf8'));
calls.length=0;
w.run('rocks.push(rock(100,100,80,123,"metal")); render();');
const first2D=calls.findIndex(c=>c.key==='drawArrays'),first3D=calls.findIndex(c=>c.key==='drawElements');
assert(first2D>=0&&first3D>first2D);
assert.equal(calls.filter(c=>c.key==='useProgram').at(-1).args[0],w.run('program'));
assert(calls.some((c,i)=>i>first3D&&c.key==='drawArrays'));
art.dispose();
// A failed compiler falls back once, never compiling repeatedly in the frame loop.
let attempts=0;
const badGL=new Proxy(gl,{get(target,key){
  if(key==='getShaderParameter')return ()=>{attempts++;return false;};
  if(key==='getShaderInfoLog')return ()=>'simulated unsupported shader';
  return target[key];
}});
w.ctx.console={warn(){}};
art.render(badGL,w.ctx.rocks,(x,y)=>[x+300,y+200],800,600);
art.render(badGL,w.ctx.rocks,(x,y)=>[x+300,y+200],800,600);
assert.equal(attempts,1);
art.dispose();
console.log('PASS: background/3D/foreground draw ordering, 2D state restoration and one-time shader fallback.');

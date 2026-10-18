// Dedicated derelict geometry and real salvage dispatch; no browser or GPU.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {boot}=require('./verify_ships.js');
const w=boot(undefined,{withSalvage:true});let shapes=[];
for(const name of ['tri','triGradient','line','disc'])w.ctx[name]=(...args)=>{
  assert(args.flat(Infinity).every(Number.isFinite));shapes.push([name,...args]);
};
w.run(fs.readFileSync('js/world-art.js','utf8'));
const art=w.run('WorldArt');
function draw(seed,integrity=1){
  shapes=[];art.drawWreck(500,400,.7,58,seed,integrity);
  assert(shapes.length>100&&shapes.length<1000);
  return JSON.stringify(shapes);
}
const intact=draw(123);
assert.equal(intact,draw(123),'Seeded damage detail is stable');
assert.notEqual(intact,draw(124),'Different wrecks have distinct breakup/scorch details');
assert.notEqual(intact,draw(123,.3),'Additional damage darkens surviving hull');
let calls=0;
const original=art.drawWreck;
art.drawWreck=(...args)=>{calls++;return original(...args);};
art.drawShip=()=>{throw Error('Derelicts must not render an intact powered ship');};
const salvage=w.run('Salvage'),wreck=salvage.forSystem(0,0).find(o=>o.kind==='ship');
const before=JSON.stringify(salvage.snapshot());
salvage.render((x,y)=>[x-wreck.x+500,y-wreck.y+400]);
assert(calls>0);
assert.equal(JSON.stringify(salvage.snapshot()),before);
console.log('PASS: dedicated broken-hull geometry, finite/bounded drawing, seeded variations, damage appearance and real salvage dispatch without intact-ship masking. No browser started.');

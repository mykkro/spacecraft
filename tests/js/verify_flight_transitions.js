// Animation lifetime/geometry and real event hooks; no browser or GPU.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {boot}=require('./verify_ships.js');
const {functionSource}=require('./test_source_utils.js');
const w=boot();let primitives=0,flushes=0;
w.ctx.GameAudio.setEngine=()=>{};
w.ctx.matchMedia=()=>({matches:false});
w.ctx.tri=(...args)=>{assert(args.flat().every(Number.isFinite));primitives++;};
w.ctx.line=(...args)=>{assert(args.flat().every(Number.isFinite));primitives++;};
w.ctx.flush2D=()=>flushes++;
w.run(fs.readFileSync('js/flight-transitions.js','utf8'));
const effect=w.run('FlightTransitions');
w.model.Shipyard.drawFlightShip=()=>{};
for(const kind of ['wormhole','respawn']){
  assert(effect.start(kind));assert(effect.active);
  for(let i=0;i<15;i++){effect.update(.033);effect.render();}
  assert(effect.active);
  assert(primitives>0);assert(flushes>0);
  for(let i=0;i<50;i++)effect.update(.033);
  assert(!effect.active);
}
assert.equal(effect.start('invalid'),false);
w.ctx.matchMedia=()=>({matches:true});
const before=primitives;effect.start('wormhole');effect.update(.1);effect.render();
assert.equal(primitives-before,2,'Reduced motion uses only the fade quad');
for(let i=0;i<10;i++)effect.update(.05);
assert(!effect.active);
// Actual destruction invokes respawn transition and retains hull recovery.
w.ctx.burst=()=>{};w.ctx.shake=0;
w.run(functionSource(fs.readFileSync('js/game.js','utf8'),'damageShip'));
w.ctx.ship.invulnerable=0;w.ctx.ship.hull=10;
w.run('damageShip(200)');
assert(effect.active);assert.equal(w.ctx.ship.hull,100);assert.equal(w.ctx.ship.x,0);
// Actual wormhole entry invokes transit effect after paired-exit relocation.
for(let i=0;i<10;i++)effect.update(.05);
w.ctx.drops=[];w.ctx.chunks=new Map();w.ctx.generate=()=>{};w.ctx.radar=()=>{};
w.ctx.devicePixelRatio=1;
const pen=new Proxy({}, {get:(obj,key)=>key==='createRadialGradient'?()=>({addColorStop(){}}):()=>{}});
w.ctx.document.querySelector('#chart').getContext=()=>pen;
w.ctx.document.querySelector('#chart').getBoundingClientRect=()=>({width:800,height:500});
w.run(fs.readFileSync('js/navigation.js','utf8'));
const nav=w.run('StarChart'),portal=nav.portals().find(p=>p.to==='1:0');
Object.assign(w.ctx.ship,{x:portal.x,y:portal.y,vx:0,vy:0});
w.ctx.paused=false;
assert(nav.enter());assert(effect.active);assert.equal(nav.current().id,'1:0');
assert.equal(nav.enter(),false,'No re-entry during animation');
console.log('PASS: bounded transition lifetime, finite geometry, reduced motion, real destruction recovery and paired wormhole entry. No browser started.');

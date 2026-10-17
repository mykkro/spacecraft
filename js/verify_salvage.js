// Destructible salvage with actual projectile handling and profile save lifecycle.
const assert=require('node:assert/strict');
const {boot}=require('./verify_ships.js');
function world(saved){
  const w=boot(saved,{withSalvage:true});w.ctx.drops=[];
  w.ctx.damageShip=()=>{};w.ctx.WorldArt={drawShip(){}};
  return {...w,salvage:w.run('Salvage')};
}
const w=world(),s=w.salvage;
const objects=s.forSystem(0,0);
assert.equal(objects.length,8);
assert.equal(objects.filter(o=>o.kind==='debris').length,6);
assert.deepEqual(Array.from(objects,o=>o.id),Array.from(s.forSystem(0,0),o=>o.id));
assert(objects.every(o=>Math.hypot(o.x,o.y)>210));
const wreck=objects.find(o=>o.kind==='ship'),station=objects.find(o=>o.kind==='station');
assert.equal(s.hit({damage:100,tier:0},wreck),false);
assert.equal(s.hit({damage:100,tier:1},station),false);
assert(s.hit({damage:4,tier:1},wreck));
assert.equal(s.snapshot().find(r=>r.id===wreck.id).hp,18);
const partial=world(w.store);
assert.equal(partial.salvage.snapshot().find(r=>r.id===wreck.id).hp,18);
assert(partial.salvage.hit({damage:30,tier:1},partial.salvage.forSystem(0,0).find(o=>o.id===wreck.id)));
assert(partial.ctx.drops.some(d=>d.type==='fuel_cell'&&d.source==='salvage'));
const lootCount=partial.ctx.drops.length;
assert.equal(partial.salvage.hit({damage:30,tier:1},wreck),false);
assert.equal(partial.ctx.drops.length,lootCount);
const gone=world(partial.store);
assert(!gone.salvage.forSystem(0,0).some(o=>o.id===wreck.id),'No wreck respawn after reload');
assert(gone.salvage.hit({damage:100,tier:2},station));
assert(gone.ctx.drops.some(d=>d.type==='repair_pack'));
// The real weapons sweep destroys a small debris target.
const debris=objects.find(o=>o.kind==='debris');
w.ctx.shots.push({x:debris.x-100,y:debris.y,vx:1000,vy:0,life:1,damage:10,tier:0,tint:[1,.7,.4],blast:0});
w.model.Weapons.updateProjectiles(.2);
assert(!s.forSystem(0,0).some(o=>o.id===debris.id));
assert.equal(w.ctx.shots.length,0);
assert(w.ctx.drops.every(d=>d.source==='salvage'));
assert.equal(w.model.Colony.questProgress().mined.metal||0,0);
// Area damage, seen markers, rendering and collision stay independent of asteroid mining.
const spare=objects.filter(o=>o.kind==='debris'&&o.id!==debris.id);
s.blast({x:spare[0].x,y:spare[0].y,damage:20,tier:0,blast:10});
assert(!s.forSystem(0,0).some(o=>o.id===spare[0].id));
Object.assign(w.ctx.ship,{x:wreck.x-80,y:wreck.y});
s.update();assert(s.known().some(o=>o.id===wreck.id));
let collision=0;w.ctx.damageShip=()=>collision++;
Object.assign(w.ctx.ship,{x:wreck.x-wreck.r*.82+2,y:wreck.y,vx:200,vy:0});
s.collide();assert(collision>0);assert(w.ctx.ship.x<wreck.x-wreck.r*.82);
s.render((x,y)=>[x-w.ctx.ship.x+500,y-w.ctx.ship.y+400]);
const pen=new Proxy({}, {get:()=>()=>{}});
s.drawRadar(pen);s.drawLocal(pen,(x,y)=>({x,y}));s.drawGlobal(pen,p=>({x:p.gx,y:p.gy}));
for(let i=0;i<40;i++){Object.assign(w.ctx.ship,{x:i*12000,y:0});s.nearby();assert(s.cacheSize<=9);}
assert.equal(world().salvage.snapshot().length,0,'New expeditions have separate salvage history');
console.log('PASS: seeded debris/derelicts, weapon gates, real projectile destruction, blast, one-time loot, damage/destruction persistence, collisions, discovery/maps and bounded live cache. No browser started.');

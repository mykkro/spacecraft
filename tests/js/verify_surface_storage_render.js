// Exercise the actual surface render path with newly placed storage; no browser/GPU.
const assert=require('node:assert/strict');
const {boot}=require('./verify_ships.js');
const w=boot(),c=w.model.Colony;
Object.assign(w.ctx.ship,{x:720,y:-870});c.land();
c.player.x=15;c.player.y=14;c.surface[13][16]=null;c.surface[14][16]='stone';
assert(c.addItem('storage_small',1));c.assignQuickSlot(0,'storage_small');c.selectBuild('storage_small');
assert(c.editTile(16,13,true));
const id=c.storageContainers().find(s=>s.x===16&&s.y===13).id;
const metal=c.bag.findIndex(s=>s?.type==='metal');assert(c.transferStorage(id,'bag',metal,2));
w.ctx.vertices=[];w.ctx.stars=[];w.ctx.buffer={};w.ctx.mod=(a,b)=>(a%b+b)%b;
let triangles=0,draws=0;
const finite=args=>assert(args.flat(Infinity).every(Number.isFinite),'Surface primitives must have finite positions/colors');
w.ctx.tri=(...args)=>{finite(args);triangles++;};
w.ctx.line=(...args)=>finite(args);w.ctx.disc=(...args)=>finite(args);
w.ctx.gl={clearColor(...args){finite(args);},clear(){},bufferData(target,data){assert(Array.from(data).every(Number.isFinite));},drawArrays(){draws++;}};
w.model.Shipyard.drawFlightShip=()=>{};
assert.doesNotThrow(()=>c.renderSurface());assert(triangles>0&&draws>0);
// Include every placeable item, not just the container that triggered the report.
let x=16;
for(const [type,item]of Object.entries(c.items))if(item.place)c.surface[13][x++]=type;
assert.doesNotThrow(()=>c.renderSurface());
c.surface[13][16]='storage_small';c.save();
const restored=boot(w.store).model.Colony;
assert.equal(restored.storageSlots(id)[0].type,'metal');
assert.equal(restored.storageSlots(id)[0].qty,2);
console.log('PASS: actual small-container placement and surface rendering, all buildable item colors, finite drawing and preserved chest contents. No browser started.');

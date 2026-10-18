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

// Tile labels use the same lookup as mining; bedrock is a solid virtual boundary.
c.surface[13][17]='titanium_ore';
assert.equal(c.surfaceTileInfo(17,13).name,c.items.titanium_ore.name);
assert.equal(c.surfaceTileInfo(17,13).type,'titanium_ore');
c.surface[10][17]=null;assert.equal(c.surfaceTileInfo(17,10),null);
assert.equal(c.surfaceTileInfo(17,-1),null);
for(const [x,y,px,py] of [[-1,13,.5,14],[160,13,159.5,14],[50,63,50.5,63]]) {
  c.player.x=px;c.player.y=py;
  const before=JSON.stringify(c.bag);
  assert.equal(c.surfaceTileInfo(x,y).type,'bedrock');
  assert(c.surfaceTileInfo(x,y).protected);
  assert.equal(c.editTile(x,y,false),false);
  assert.equal(c.editTile(x,y,true),false);
  assert.equal(JSON.stringify(c.bag),before);
  assert.doesNotThrow(()=>c.renderSurface());
}
w.ctx.toastTimer=0;
c.player.x=.5;c.player.y=10;
for(let y=7;y<13;y++)c.surface[y][0]=null;
w.ctx.keys.add('KeyA');c.updateSurface(.1);w.ctx.keys.clear();
assert(c.player.x>=.29,'Left bedrock wall blocks walking');
c.player.x=50;c.player.y=62.9;
for(let x=49;x<=51;x++)for(let y=60;y<63;y++)c.surface[y][x]=null;
c.updateSurface(.5);assert(c.player.y<=63,'Bedrock floor blocks falling');
c.player.x=30;c.player.y=14;
for(let x=27;x<34;x++) {c.surface[12][x]=null;c.surface[13][x]=null;c.surface[14][x]='stone';}
w.ctx.keys.add('KeyD');c.updateSurface(.1);assert.doesNotThrow(()=>c.renderSurface());
w.ctx.keys.clear();c.updateSurface(.1);assert.doesNotThrow(()=>c.renderSurface());
c.save();const boundaryReload=boot(w.store).model.Colony;
assert.equal(boundaryReload.surfaceTileInfo(50,63).type,'bedrock');
assert.equal(boundaryReload.surfaceTileInfo(17,13).type,'titanium_ore');
console.log('PASS: resource labels, empty sky, protected side/floor bedrock, collision, walking render and save reload.');

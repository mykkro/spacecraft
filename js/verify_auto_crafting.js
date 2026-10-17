// Automatic intermediate crafting, station scheduling, refunds and save migration.
const assert=require('node:assert/strict');
const {boot}=require('./verify_ships.js');
function base(furnace=true){
  const initial=boot();Object.assign(initial.ctx.ship,{x:720,y:-870});
  initial.model.Colony.land();initial.model.Colony.surface[13][40]='bench';
  if(furnace)initial.model.Colony.surface[13][41]='furnace';
  initial.model.Colony.save();
  const w=boot(initial.store),c=w.model.Colony;
  for(const type of Object.keys(c.items)){const n=c.availableCount(type);if(n)c.consumeItem(type,n);}
  return {...w,c};
}
function select(c,out){assert(c.selectRecipe(c.recipes.findIndex(r=>r.out===out)));}
function ingredients(c){assert(c.addItem('metal',5));assert(c.addItem('crystal',2));assert(c.addItem('ice',1));}
const w=base(),c=w.c;ingredients(c);select(c,'scanner');
const recipe=c.recipes.find(r=>r.out==='scanner');
assert.equal(c.craftSeconds(recipe),17.5);
assert.equal(c.maxCraftQuantity(),1);
const plan=c.autoCraftPlan(recipe,1);
assert(plan&&plan.steps.some(s=>c.recipes[s.recipe].station==='furnace'));
const mass=c.cargoMass;
assert(c.craft());assert.equal(c.availableCount('metal'),0);
assert.equal(c.availableCount('scanner'),0);assert.equal(c.cargoMass,mass);
assert(c.craftingQueue[0].steps.some(s=>s.out==='glass'));
c.updateCrafting(.5);c.save();
const resumed=boot(w.store).model.Colony;
assert.equal(resumed.craftingQueue[0].remaining,c.craftingQueue[0].remaining);
for(let i=0;i<200;i++)resumed.updateCrafting(.5);
assert.equal(resumed.availableCount('scanner'),1);
assert.equal(resumed.availableCount('glass'),1,'Surplus intermediate output is retained');
assert.equal(resumed.craftingQueue.length,0);
// Cancelling at any intermediate step refunds original reservations once.
for(let i=0;i<15;i++)c.updateCrafting(.5);
const job=c.craftingQueue[0];assert(c.cancelCraft(job.id));
assert.equal(c.availableCount('metal'),5);assert.equal(c.availableCount('crystal'),2);assert.equal(c.availableCount('ice'),1);
assert.equal(c.availableCount('ingot'),0);assert.equal(c.cancelCraft(job.id),false);
// No required furnace / insufficient raw resources: no inventory or queue mutation.
const missing=base(false);ingredients(missing.c);select(missing.c,'scanner');
const before=JSON.stringify(missing.c.bag);
assert.equal(missing.c.craft(),false);assert.equal(JSON.stringify(missing.c.bag),before);
const short=base();short.c.addItem('metal',4);short.c.addItem('crystal',2);short.c.addItem('ice',1);select(short.c,'scanner');
assert.equal(short.c.craft(),false);assert.equal(short.c.craftingQueue.length,0);
// Chain uses furnace while an ordinary workbench job progresses in parallel.
const p=base();ingredients(p.c);select(p.c,'scanner');assert(p.c.craft());
p.c.addItem('ingot',2);select(p.c,'plate');assert(p.c.craft());
p.c.updateCrafting(.5);
assert.equal(p.c.craftingQueue[0].remaining,p.c.craftingQueue[0].duration-.5);
assert.equal(p.c.craftingQueue[1].remaining,1.5);
for(let i=0;i<200;i++)p.c.updateCrafting(.5);
assert.equal(p.c.availableCount('scanner'),1);assert.equal(p.c.availableCount('plate'),2);
// A saved old-duration job is scaled, rather than discarded with its reserved ingredients.
const legacy=base();legacy.c.addItem('metal',1);select(legacy.c,'ingot');assert(legacy.c.craft());legacy.c.save();
const save=JSON.parse(legacy.store.get('spacecraft-save-v1'));
delete save.craftingQueue[0].duration;save.craftingQueue[0].remaining=3;
const old=boot(new Map([['spacecraft-save-v1',JSON.stringify(save)]])).model.Colony;
assert.equal(old.craftingQueue[0].remaining,1.5);old.updateCrafting(1);old.updateCrafting(.5);
assert.equal(old.availableCount('ingot'),1);

// Completed chains wait atomically for room; surplus must never be emitted twice.
const full=base();ingredients(full.c);select(full.c,'scanner');assert(full.c.craft());
const free=full.c.bag.filter(s=>!s).length;assert(full.c.addItem('stone',free*64));
for(let i=0;i<200;i++)full.c.updateCrafting(.5);
assert.equal(full.c.craftingQueue[0].remaining,0);
assert.equal(full.c.availableCount('glass'),0);assert.equal(full.c.availableCount('scanner'),0);
full.c.save();
const held=boot(full.store).model.Colony;
assert(held.consumeItem('stone',128));
held.updateCrafting(.1);
assert.equal(held.availableCount('scanner'),1);assert.equal(held.availableCount('glass'),1);
held.updateCrafting(.1);assert.equal(held.availableCount('glass'),1);
assert.equal(held.craftingQueue.length,0);
// Tiny frame intervals finish cleanly; work stays at the original moon.
const frames=base();ingredients(frames.c);select(frames.c,'scanner');assert(frames.c.craft());
frames.c.launch();Object.assign(frames.ctx.ship,{x:5000,y:0});
const remaining=frames.c.craftingQueue[0].remaining;
frames.c.updateCrafting(.5);assert.equal(frames.c.craftingQueue[0].remaining,remaining);
Object.assign(frames.ctx.ship,{x:720,y:-870});
for(let i=0;i<2000;i++)frames.c.updateCrafting(.033);
assert.equal(frames.c.craftingQueue.length,0);
assert.equal(frames.c.availableCount('scanner'),1);

console.log('PASS: half times, raw-material planning across furnace/workbench, Max, surplus, save reload, cancellation, station/resource failures, parallel scheduling and legacy timer migration. No browser started.');

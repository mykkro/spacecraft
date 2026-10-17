// Portable furnace queues and passive machines, without a browser or GPU.
const assert=require('node:assert/strict');
const {boot}=require('./verify_ships.js');
const w=boot(),c=w.model.Colony;
Object.assign(w.ctx.ship,{x:5000,y:0});
assert(c.addItem('portable_furnace',1));
assert(c.getStationAccess().stations.has('furnace'));
assert(!c.getStationAccess().stations.has('bench'));
const choose=(model,out)=>assert(model.selectRecipe(model.recipes.findIndex(r=>r.out===out)));
const ingots=c.availableCount('ingot');
choose(c,'ingot');c.setCraftQuantity(3);assert(c.craft());
assert.equal(c.craftingQueue[0].owner,'ship');assert.equal(c.craftingQueue[0].moonId,'portable');
assert(c.addItem('portable_workbench',1));assert(c.addItem('ingot',2));
choose(c,'plate');assert(c.craft());c.updateCrafting(.5);
assert.deepEqual(Array.from(c.craftingQueue,j=>j.remaining),[5.5,1.5]);
assert(c.consumeItem('portable_furnace',1));c.updateCrafting(.5);
assert.deepEqual(Array.from(c.craftingQueue,j=>j.remaining),[5.5,1]);
c.save();
const loaded=boot(w.store),r=loaded.model.Colony;
assert.equal(r.craftingQueue.length,2);
r.updateCrafting(.5);assert.equal(r.craftingQueue[0].remaining,5.5);
assert(r.addItem('portable_furnace',1));
for(let i=0;i<12;i++)r.updateCrafting(.5);
assert.equal(r.craftingQueue.length,0);assert.equal(r.availableCount('ingot'),ingots+3);
// Both carried stations support raw-material automatic crafting while away from moons.
for(const type of Object.keys(r.items))if(!['portable_furnace','portable_workbench'].includes(type)){
  const qty=r.availableCount(type);if(qty)r.consumeItem(type,qty);
}
r.addItem('metal',5);r.addItem('crystal',2);r.addItem('ice',1);
choose(r,'scanner');assert(r.craft());
for(let i=0;i<100;i++)r.updateCrafting(.5);
assert.equal(r.availableCount('scanner'),1);
// Fuel optimizer stacks multiplicatively with engineer, but extra machines do not stack.
const fuelWorld=boot(undefined,{withStarbases:true}),fc=fuelWorld.model.Colony;
fuelWorld.run("Starbases.restore({crew:['engineer']})");
fc.addItem('fuel_optimizer',2);
assert.equal(fc.machineBonuses.fuelMultiplier,.85);
let fuel=fuelWorld.model.Fuel.amount+fuelWorld.model.Fuel.reserve;
fuelWorld.model.Fuel.drive(1,false,1);
assert(Math.abs(fuel-fuelWorld.model.Fuel.amount-fuelWorld.model.Fuel.reserve-.8*.85)<1e-8);
fc.consumeItem('fuel_optimizer',2);
fuel=fuelWorld.model.Fuel.amount+fuelWorld.model.Fuel.reserve;
fuelWorld.model.Fuel.drive(1,false,1);
assert(Math.abs(fuel-fuelWorld.model.Fuel.amount-fuelWorld.model.Fuel.reserve-.8)<1e-8);
fc.addItem('repair_controller',2);fc.addItem('repair_pack',3);
fuelWorld.ctx.ship.hull=40;assert(fc.useRepairPack());assert.equal(fuelWorld.ctx.ship.hull,70);
assert(fc.useRepairPack());assert.equal(fuelWorld.ctx.ship.hull,100);
assert.equal(fc.useRepairPack(),false);
assert(fuelWorld.ctx.document.querySelector('#repair').title.includes('30'));
fc.consumeItem('repair_controller',2);fuelWorld.ctx.ship.hull=50;
assert(fc.useRepairPack());assert.equal(fuelWorld.ctx.ship.hull,70);
// A real base can craft every new machine using its advertised recipe.
const setup=boot();Object.assign(setup.ctx.ship,{x:720,y:-870});setup.model.Colony.land();
setup.model.Colony.surface[13][40]='bench';setup.model.Colony.save();
const factory=boot(setup.store).model.Colony;
for(const out of ['portable_furnace','fuel_optimizer','repair_controller']){
  const recipe=factory.recipes.find(r=>r.out===out),cost={};
  for(const type of recipe.pattern)if(type)cost[type]=(cost[type]||0)+1;
  for(const[type,qty]of Object.entries(cost))assert(factory.addItem(type,qty));
  choose(factory,out);assert(factory.craft());
  for(let i=0;i<factory.craftSeconds(recipe)*2;i++)factory.updateCrafting(.5);
  assert.equal(factory.availableCount(out),1);
}
console.log('PASS: portable furnace access, independent ship queues, removal pause/reload, mobile Auto Craft, non-stacking fuel/repair bonuses and actual machine recipes. No browser started.');

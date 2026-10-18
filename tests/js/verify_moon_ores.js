// Rare lunar deposits, actual mining, refining, auto-crafting and saved terrain safety.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {boot}=require('./verify_ships.js');
const {functionSource}=require('./test_source_utils.js');
const w=boot(),c=w.model.Colony;
Object.assign(w.ctx.ship,{x:720,y:-870});c.land();
const locate=type=>{
  for(let y=0;y<c.surface.length;y++)for(let x=0;x<c.surface[y].length;x++)if(c.surface[y][x]===type)return {x,y};
  return null;
};
assert(locate('titanium_ore'));assert(locate('cobalt_ore'));assert.equal(locate('iridium_ore'),null);
const titanium=locate('titanium_ore');
assert(titanium.y>=23);
c.player.x=titanium.x+.5;c.player.y=titanium.y+1;
assert(c.editTile(titanium.x,titanium.y,false));
assert.equal(c.availableCount('titanium_ore'),1);
// Iridium needs a cutter; the same tile remains untouched on rejection.
c.surface[52][30]='iridium_ore';c.player.x=30.5;c.player.y=53;
assert.equal(c.editTile(30,52,false),false);
assert.equal(c.surface[52][30],'iridium_ore');
assert(c.addItem('laser',1));assert(c.editTile(30,52,false));
assert.equal(c.availableCount('iridium_ore'),1);
const terrain=JSON.stringify(c.surface);c.save();
const loaded=boot(w.store).model.Colony;
assert.equal(JSON.stringify(loaded.surface),terrain,'Existing deposits/tunnels do not reroll');
assert.equal(loaded.availableCount('iridium_ore'),1);
// Test the pure overlay across moons; iridium occurs on some moons, not all.
w.run(functionSource(fs.readFileSync('js/systems.js','utf8'),'addMoonOreVeins'));
w.ctx.cols=160;w.ctx.rows=64;
let iridiumMoons=0;
for(let i=1;i<=30;i++){
  w.ctx.testMoon={id:i+':1'};w.ctx.testMap=Array.from({length:64},()=>Array(160).fill('stone'));
  w.run('addMoonOreVeins(testMap,testMoon)');
  const flat=w.ctx.testMap.flat();
  if(flat.includes('iridium_ore'))iridiumMoons++;
  assert(!w.ctx.testMap.slice(0,22).flat().some(t=>c.items[t]?.moonOre));
}
assert(iridiumMoons>0&&iridiumMoons<30);
for(const file of ['game.js','salvage.js','pirates.js','starbases.js']){
  const source=fs.readFileSync('js/'+file,'utf8');
  for(const ore of ['titanium_ore','cobalt_ore','iridium_ore'])assert(!source.includes("'"+ore+"'"),file+' should not spawn or sell lunar ores');
}
// Existing bases unlock refining and automatic multi-station alloy production.
c.surface[13][40]='bench';c.surface[13][41]='furnace';c.save();
const base=boot(w.store).model.Colony;
for(const type of Object.keys(base.items)){const n=base.availableCount(type);if(n)base.consumeItem(type,n);}
base.addItem('titanium_ore',4);base.addItem('cobalt_ore',2);base.addItem('iridium_ore',2);
const alloy=base.recipes.findIndex(r=>r.out==='advanced_alloy');
assert(base.selectRecipe(alloy));assert(base.craft());
assert(base.craftingQueue[0].steps.filter(s=>s.station==='furnace').length===3);
for(let i=0;i<50;i++)base.updateCrafting(.5);
assert.equal(base.availableCount('advanced_alloy'),2);
assert.equal(base.availableCount('titanium_ore'),0);
assert(base.recipes.some(r=>r.out==='shield_generator_advanced'&&r.pattern.includes('advanced_alloy')));
assert(base.recipes.some(r=>r.out==='portable_workbench'&&r.pattern.includes('advanced_alloy')));
console.log('PASS: moon-only rare veins, depth/rarity, cutter gate, actual mining, unchanged saved terrain, ingot/alloy auto-crafting and useful alternate equipment recipes. No browser started.');

// Storage-only profile lifecycle checks. No browser, server or GPU.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('js/profiles.js','utf8');
const store=new Map([
  ['spacecraft-save-v1','{"shipPreset":"kraxna","bag":["legacy"]}'],
  ['spacecraft-chart-v1','{"visited":["0:0"]}'],
  ['spacecraft-weapons-v1','{"primary":"fotron"}'],
  ['spacecraft-pirates-v1','{"defeated":["pirate-1"]}'],
  ['spacecraft-display-v1','{"textScale":140}']
]);
let serial=0, fail=false;
function boot() {
  const ctx=vm.createContext({crypto:{randomUUID:()=> 'test-'+(++serial)},localStorage:{
    getItem:key=>store.get(key)??null,
    setItem(key,value){if(fail)throw Error('quota');store.set(key,value);}
  }});
  vm.runInContext(source+';globalThis.profiles=Profiles;',ctx);
  return ctx.profiles;
}
const old=boot();
assert.equal(old.current,'Original expedition');
for(const key of ['save','chart','weapons','pirates'])
  assert.equal(old.getItem('spacecraft-'+key+'-v1'),store.get('spacecraft-'+key+'-v1'));
const id=old.create('  Commander Ada  ');
assert.equal(old.current,'Original expedition');
old.setItem('spacecraft-save-v1','outgoing-final-save');
const fresh=boot();
assert.equal(fresh.current,'Commander Ada');
for(const key of ['save','chart','weapons','pirates']) assert.equal(fresh.getItem('spacecraft-'+key+'-v1'),null);
fresh.setItem('spacecraft-save-v1','new-progress');
assert.equal(old.getItem('spacecraft-save-v1'),'outgoing-final-save');
assert.equal(store.get('spacecraft-display-v1'),'{"textScale":140}');
assert.throws(()=>fresh.create('commander ada'),/duplicate/);
assert.throws(()=>fresh.create('  '),/name/);
assert.throws(()=>fresh.create('a'.repeat(41)),/name/);
fresh.select('original');
fresh.setItem('spacecraft-save-v1','new-final-save');
const resumed=boot();
assert.equal(resumed.getItem('spacecraft-save-v1'),'outgoing-final-save');
resumed.select(id);
assert.equal(boot().getItem('spacecraft-save-v1'),'new-final-save');
const before=store.get('spacecraft-profiles-v1');
fail=true;
assert.throws(()=>resumed.create('No space'),/quota/);
assert.equal(store.get('spacecraft-profiles-v1'),before);
fail=false;
// Display names must never become HTML or file paths.
resumed.create('<pilot>');
assert.equal(boot().current,'<pilot>');
for(const name of ['ships','fuel','shields','starbases','missions','systems','navigation','pirates','weapons']) {
  const text=fs.readFileSync('js/'+name+'.js','utf8');
  assert(!/\blocalStorage\.(getItem|setItem)\(/.test(text),name+' must use profile storage');
}
const html=fs.readFileSync('index.html','utf8');
assert(html.indexOf('src="js/profiles.js"')<html.indexOf('src="js/ships.js"'));
console.log('PASS: legacy migration, named creation, independent save/map/weapons/pirates, outgoing autosave isolation, resume, duplicate validation and storage failure. No browser started.');

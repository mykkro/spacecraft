const { declarationPrefix } = require('./test_source_utils.js');

// Dependency-free localization checks. No browser, WebGL context, or server is started.
const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  path = require('node:path');
// Scripts sit beside this check; HTML and artwork remain at the project root.
const read = file => fs.readFileSync(
  path.join(__dirname, file.endsWith('.js') ? '' : '..', file),
  'utf8'
);
const source = read('i18n.js');
function context(saved, browserLanguage = 'en', blocked = false) {
  const storage = new Map(saved ? [['spacecraft-language-v1', saved]] : []);
  const select = {
    value: '',
    addEventListener() {
    }
  };
  const label = {
    setAttribute() {
    },
    querySelector() {
      return select;
    },
    addEventListener() {
    }
  };
  const text = {
    nodeValue: 'HULL INTEGRITY',
    parentElement: { closest: () => false }
  };
  const control = {
    attrs: { title: 'Open map (M)' },
    hasAttribute(k) {
      return k in this.attrs;
    },
    getAttribute(k) {
      return this.attrs[k];
    },
    setAttribute(k, v) {
      this.attrs[k] = v;
    }
  };
  const body = { querySelectorAll: () => [control] };
  let saves = 0,
    reloads = 0;
  const ctx = vm.createContext({
    navigator: { language: browserLanguage },
    NodeFilter: { SHOW_TEXT: 4 },
    localStorage: {
      getItem: k => {
        if (blocked)
          throw Error('blocked');
        return storage.get(k) || null;
      },
      setItem: (k, v) => {
        if (blocked)
          throw Error('blocked');
        storage.set(k, v);
      }
    },
    document: {
      documentElement: {},
      body,
      createTreeWalker() {
        let done = false;
        return {
          currentNode: text,
          nextNode() {
            if (done)
              return false;
            done = true;
            return true;
          }
        };
      },
      createElement: () => label,
      querySelector: selector => selector === '#languageSelect' ? select : {
        prepend() {
        }
      }
    },
    location: {
      reload() {
        reloads++;
      }
    },
    Colony: {
      save() {
        saves++;
      }
    },
    Image: class {
    }
  });
  vm.runInContext(source, ctx);
  const i18n = vm.runInContext('I18n', ctx);
  return {
    ctx,
    i18n,
    storage,
    select,
    text,
    control,
    get saves() {
      return saves;
    },
    get reloads() {
      return reloads;
    }
  };
}
const cs = context(null, 'cs-CZ'),
  en = context('en', 'cs-CZ');
assert.equal(cs.i18n.language, 'cs');
assert.equal(cs.ctx.document.documentElement.lang, 'cs');
assert.equal(en.i18n.language, 'en');
assert.equal(context('cs', 'en').i18n.language, 'cs');
assert.equal(context('bogus', 'cs-CZ').i18n.language, 'cs');
assert.equal(context(null, 'cs', true).i18n.language, 'cs');
assert.equal(cs.text.nodeValue, 'STAV TRUPU');
assert.equal(cs.control.attrs.title, 'Otevřít mapu (M)');
assert.equal(cs.i18n.t('Crystal'), 'Krystal');
assert.equal(cs.i18n.t('12 CRYSTAL MINED'), '12 VYTĚŽENÉ KRYSTALY');
assert.equal(cs.i18n.t('APPROACH WITHIN 120 m TO ENTER'), 'PRO VSTUP SE PŘIBLIŽTE NA 120 m');
assert.equal(cs.i18n.t('PLACE HELD STACK'), 'ODLOŽIT DRŽENÝ STOH');
assert.equal(cs.i18n.t('3 PIRATES ENGAGING'), '3 PIRÁTI ÚTOČÍ');
assert.equal(cs.i18n.t('crystal'), 'crystal');
assert.equal(cs.i18n.t('ammo_seismic'), 'ammo_seismic');
assert.equal(cs.i18n.t(42), 42);
const markup = '<button id="ice" class="base" data-item="crystal" title="Crystal" aria-label="Equip Crystal">CRAFT</button>';
assert.equal(cs.i18n.html(markup), '<button id="ice" class="base" data-item="crystal" title="Krystal" aria-label="Vybavit Krystal">VYROBIT</button>');
assert.equal(en.i18n.html(markup), markup);
assert.equal(en.i18n.t('Crystal'), 'Crystal');
assert.equal(cs.i18n.t(cs.i18n.t('OUT OF AMMO')), cs.i18n.t('OUT OF AMMO'));
const start = en.saves;
en.i18n.setLanguage('invalid');
en.i18n.setLanguage('en');
assert.equal(en.saves, start);
assert.equal(en.reloads, 0);
en.i18n.setLanguage('cs');
assert.equal(en.saves, start + 1);
assert.equal(en.reloads, 1);
assert.equal(en.storage.get('spacecraft-language-v1'), 'cs');
const blocked = context('en', 'en', true);
blocked.i18n.setLanguage('cs');
assert.equal(blocked.reloads, 0);
function economy(ctx) {
  vm.runInContext(read('ships.js'), ctx);
  const source = read('systems.js'),
    prefix = declarationPrefix(source, 'bag');
  return vm.runInContext(prefix + 'return {items,recipes};})(); Colony;', ctx);
}
const csEconomy = economy(cs.ctx),
  enEconomy = economy(en.ctx);
const invariant = ({items, recipes}) => JSON.stringify({
  items: Object.entries(items).map(([id, {name, icon, description, ...mechanics}]) => [id, mechanics]),
  recipes: recipes.map(({name, ...mechanics}) => mechanics)
});
assert.equal(invariant(csEconomy), invariant(enEconomy));
assert.equal(csEconomy.items.crystal.name, 'Krystal');
assert.equal(csEconomy.items.ammo_seismic.maxStack, 4);
for (const [type, item] of Object.entries(csEconomy.items))
  assert(fs.existsSync(path.join(__dirname, '..', 'assets/items', item.asset || (item.image || type) + '.png')));
assert.equal(csEconomy.items.bulterite.name, 'Bulterium');
assert.equal(csEconomy.items.bulshitter.name, 'Bulšitr');
assert.equal(csEconomy.items.ion_cube.name, 'Iontová kostka');
assert.equal(csEconomy.items.blue_ion_cube.name, 'Modrá iontová kostka');
for (const item of Object.values(csEconomy.items)) assert(item.description?.length > 20);
for (const item of Object.values(enEconomy.items)) assert(item.description?.length > 20);
function weapons(ctx) {
  const source = read('weapons.js'),
    prefix = declarationPrefix(source, 'hardness');
  return vm.runInContext(prefix + 'return definitions;})(); Weapons;', ctx);
}
const weaponInvariant = defs => JSON.stringify(Object.entries(defs).map(([id, {name, short, ...mechanics}]) => [id, mechanics]));
assert.equal(weaponInvariant(weapons(cs.ctx)), weaponInvariant(weapons(en.ctx)));
function quests(ctx) {
  const source = read('quests.js'),
    prefix = declarationPrefix(source, 'open');
  return vm.runInContext(prefix + 'return definitions;})(); QuestLog;', ctx);
}
const questInvariant = defs => JSON.stringify(defs.map(({title, description, ...mechanics}) => mechanics));
assert.equal(questInvariant(quests(cs.ctx)), questInvariant(quests(en.ctx)));
assert.equal(vm.runInContext('QuestLog[0].title', cs.ctx), 'Krystalový průzkum');
for (const file of [
    'i18n.js',
    'ships.js',
    'ships-ui.js',
    'fuel.js',
    'audio.js',
    'game.js',
    'weapons.js',
    'systems.js',
    'navigation.js',
    'pirates.js',
    'quests.js',
    'encyclopedia.js'
  ])
  new vm.Script(read(file), { filename: file });
assert(read('index.html').indexOf('src="js/i18n.js"') < read('index.html').indexOf('src="js/audio.js"'));
console.log('PASS: Czech/English startup, language persistence, save before reload, blocked storage, accessible labels, markup/ID safety, item/recipe/weapon/quest invariants, local assets, and script syntax. No browser started.');

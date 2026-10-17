/**
 * Read-only item encyclopedia, built from the live economy and weapon metadata.
 * Render only when opened or filtered; there is no background update loop.
 */
const Encyclopedia = (() => {
  const $ = selector => document.querySelector(selector);
  const categoryLabels = {
    all: 'All categories',
    characters: I18n.language === 'cs' ? 'Postavy' : 'Characters',
    materials: 'Materials',
    fuel: 'Fuel',
    weapons: 'Weapons',
    ammunition: 'Ammunition',
    machines: 'Machines',
    consumables: 'Consumables',
    construction: 'Construction'
  };
  let open = false;
  let previousPaused = false;
  let returnFocus = null;
  let selectedId = null;

  // Keep search independent of accents, capitalization, and internal ID separators.
  function normalize(value = '') {
    return String(value).normalize('NFKD').replace(/\p{M}/gu, '')
      .toLowerCase().replace(/_/g, ' ').trim();
  }

  function escape(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function categoryFor(id, item) {
    if (item.repair) return 'consumables';
    if (item.fuel) return 'fuel';
    if (item.ammoFor) return 'ammunition';
    if (item.weapon) return 'weapons';
    if (item.machine || id === 'bench' || id === 'furnace') return 'machines';
    return item.place ? 'construction' : 'materials';
  }

  function iconPath(id) {
    const item = Colony.items[id];
    return 'assets/items/' + (item.asset || ((item.image || id) + '.png'));
  }

  function getEntry(id) {
    if (typeof id === 'string' && id.startsWith('character:')) return characterEntries().find(entry=>entry.id===id) || null;
    if (!Object.hasOwn(Colony.items, id)) return null;
    const item = Colony.items[id];
    return {
      id,
      name: item.name,
      description: item.description,
      category: categoryFor(id, item),
      icon: iconPath(id),
      stackLimit: item.maxStack,
      weight: item.weight || 1,
      owned: Colony.count(id),
      available: item.weapon ? Weapons.unlocked(id) : Colony.count(id) > 0,
      fuel: item.fuel || 0,
      weapon: Weapons.definitions[id] || null,
      recipes: Colony.recipes.filter(recipe => recipe.out === id)
    };
  }

  function characterEntries() {
    return typeof Starbases === 'undefined' ? [] : Starbases.characters();
  }

  // IDs remain searchable alongside translated names; nothing is hidden by ownership.
  function entries(query = '', category = 'all') {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return [...Object.keys(Colony.items).map(getEntry), ...characterEntries()].filter(entry => {
      if (category !== 'all' && entry.category !== category) return false;
      const text = normalize(entry.id + ' ' + entry.name + ' ' + (entry.role || '') + ' ' + (entry.status || '') + ' ' + entry.description +
        ' ' + I18n.t(categoryLabels[entry.category]));
      return terms.every(term => text.includes(term));
    }).sort((a, b) => a.name.localeCompare(b.name, I18n.language || 'en'));
  }

  const overlay = document.createElement('div');
  overlay.id = 'encyclopediaOverlay';
  overlay.hidden = true;
  overlay.innerHTML = I18n.html(`
    <section role="dialog" aria-modal="true" aria-labelledby="encyclopediaTitle">
      <div class="encyclopedia-heading">
        <div>
          <div class="eyebrow">EXPEDITION / FIELD GUIDE</div>
          <h2 id="encyclopediaTitle">Encyclopedia</h2>
        </div>
        <button id="closeEncyclopedia" aria-label="Close encyclopedia">×</button>
      </div>
      <p class="encyclopedia-intro">Browse every item, material and machine, including equipment you have not crafted yet.</p>
      <div class="encyclopedia-toolbar">
        <label for="encyclopediaSearch">Search
          <input id="encyclopediaSearch" type="search" autocomplete="off">
        </label>
        <label for="encyclopediaCategory">Category
          <select id="encyclopediaCategory"></select>
        </label>
      </div>
      <p id="encyclopediaCount" role="status" aria-live="polite"></p>
      <div class="encyclopedia-layout">
        <div id="encyclopediaItems" class="encyclopedia-items" aria-label="Item catalogue"></div>
        <aside id="encyclopediaDetails" class="encyclopedia-details" aria-label="Item details"></aside>
      </div>
      <small class="encyclopedia-footnote">B / ESC closes this guide. Browsing does not consume items or fuel.</small>
    </section>
  `);
  document.body.append(overlay);

  const search = $('#encyclopediaSearch');
  const category = $('#encyclopediaCategory');
  search.value = '';
  search.placeholder = I18n.t('Search by name or description');
  category.innerHTML = Object.entries(categoryLabels).map(([id, label]) =>
    '<option value="' + id + '">' + escape(I18n.t(label)) + '</option>'
  ).join('');
  category.value = 'all';

  const button = document.createElement('button');
  button.id = 'encyclopediaButton';
  button.innerHTML = I18n.html('ENCYCLOPEDIA <kbd>B</kbd>');
  $('.manifest').append(button);
  const surfaceButton = document.createElement('button');
  surfaceButton.id = 'surfaceEncyclopediaButton';
  surfaceButton.textContent = I18n.t('ENCYCLOPEDIA') + ' [B]';
  $('#surfaceHud').append(surfaceButton);

  function stat(label, value) {
    return '<div><dt>' + escape(I18n.t(label)) + '</dt><dd>' + escape(value) + '</dd></div>';
  }

  // Recipe diagrams use the same row-major patterns as actual crafting.
  function recipeMarkup(recipe) {
    const costs = {};
    for (const type of recipe.pattern) {
      if (type) costs[type] = (costs[type] || 0) + 1;
    }
    const stationName = recipe.station === 'hand' ? I18n.t('Handcraft')
      : Colony.items[recipe.station].name;
    const ingredients = Object.entries(costs).map(([id, amount]) =>
      '<button class="encyclopedia-chip" data-ency-item="' + id + '">' +
      amount + ' ' + escape(Colony.items[id].name) + '</button>'
    ).join('');
    const cells = recipe.pattern.map(id => id
      ? '<span><img src="' + iconPath(id) + '" width="26" height="26" alt="' +
        escape(Colony.items[id].name) + '" title="' + escape(Colony.items[id].name) + '"></span>'
      : '<span class="empty"></span>'
    ).join('');
    return `<article class="encyclopedia-recipe">
      <b>${escape(stationName)} · ×${recipe.qty}</b>
      <div class="encyclopedia-recipe-grid" style="grid-template-columns:repeat(${recipe.station === 'bench' ? 3 : 2},32px)">${cells}</div>
      <div class="encyclopedia-chips">${ingredients}</div>
    </article>`;
  }

  function renderDetails() {
    const entry = getEntry(selectedId);
    if (!entry) {
      $('#encyclopediaDetails').innerHTML = '<p>' + escape(I18n.t('No matching entries. Try another search or category.')) + '</p>';
      return;
    }
    if (entry.category === 'characters') {
      $('#encyclopediaDetails').innerHTML = `<div class="encyclopedia-detail-heading character-detail">
        <img src="${escape(entry.icon)}" width="112" height="112" alt="">
        <div><span class="eyebrow">${escape(entry.role)}</span><h3>${escape(entry.name)}</h3></div></div>
        <p class="encyclopedia-description">${escape(entry.description)}</p>
        <p class="character-status">${escape(entry.status)}</p>`;
      return;
    }
    let stats = stat('Owned', entry.owned) + stat('Stack limit', entry.stackLimit) +
      stat('Mass per item', entry.weight);
    if (entry.fuel) stats += stat('Fuel units', entry.fuel);
    if (entry.weapon) {
      const weapon = entry.weapon;
      stats += stat('Weapon tier', weapon.tier) + stat('Damage per projectile', weapon.damage) +
        stat('Cooldown', weapon.cooldown + ' s');
      if (weapon.pellets) stats += stat('Projectiles per shot', weapon.pellets);
      if (weapon.rockDamage) stats += stat('Mining damage', weapon.rockDamage);
      if (weapon.blast) stats += stat('Blast radius', weapon.blast + ' m');
      if (weapon.ammo) stats += stat('Ammunition', Colony.items[weapon.ammo].name);
      if (entry.available && !entry.owned) stats += stat('Availability', I18n.t('Supplied by ship'));
    }
    const usedIn = [...new Set(Colony.recipes.filter(recipe =>
      recipe.pattern.includes(entry.id)).map(recipe => recipe.out))];
    $('#encyclopediaDetails').innerHTML = `
      <div class="encyclopedia-detail-heading">
        <img src="${entry.icon}" width="88" height="88" alt="">
        <div><span class="eyebrow">${escape(I18n.t(categoryLabels[entry.category]))}</span><h3>${escape(entry.name)}</h3></div>
      </div>
      <p class="encyclopedia-description">${escape(entry.description)}</p>
      <dl class="encyclopedia-stats">${stats}</dl>
      ${entry.recipes.length ? '<h4>' + escape(I18n.t('Crafting recipes')) + '</h4>' + entry.recipes.map(recipeMarkup).join('') : ''}
      ${usedIn.length ? '<h4>' + escape(I18n.t('Used to craft')) + '</h4><div class="encyclopedia-chips">' +
        usedIn.map(id => '<button class="encyclopedia-chip" data-ency-item="' + id + '">' + escape(Colony.items[id].name) + '</button>').join('') + '</div>' : ''}
    `;
    $('#encyclopediaDetails').querySelectorAll('[data-ency-item]').forEach(link => {
      link.onclick = () => showItem(link.dataset.encyItem);
    });
  }

  function refresh() {
    if (!open) return;
    const visible = entries(search.value, category.value);
    if (!visible.some(entry => entry.id === selectedId)) {
      selectedId = visible[0]?.id || null;
    }
    $('#encyclopediaCount').textContent = visible.length + ' / ' +
      (Object.keys(Colony.items).length + characterEntries().length) + ' · ' + I18n.t('ENTRIES');
    $('#encyclopediaItems').innerHTML = visible.length ? visible.map(entry => `
      <button class="encyclopedia-card ${entry.id === selectedId ? 'selected' : ''}"
        data-ency-entry="${entry.id}" aria-pressed="${entry.id === selectedId}">
        <img src="${entry.icon}" width="48" height="48" loading="lazy" alt="">
        <span class="encyclopedia-card-text"><b>${escape(entry.name)}</b>
          <small>${escape(entry.category === 'characters' ? entry.role + ' · ' + entry.status : I18n.t(categoryLabels[entry.category]))}</small>
          <span>${escape(entry.description)}</span>
        </span>
      </button>
    `).join('') : '<p>' + escape(I18n.t('No matching entries. Try another search or category.')) + '</p>';
    $('#encyclopediaItems').querySelectorAll('[data-ency-entry]').forEach(card => {
      card.onclick = () => {
        selectedId = card.dataset.encyEntry;
        refresh();
        $('#encyclopediaItems [data-ency-entry="' + selectedId + '"]').focus();
      };
    });
    renderDetails();
  }

  // Stack this dialog above an existing menu and restore its pause state on close.
  function openView() {
    if (open) return true;
    const shipPicker = $('#shipyardOverlay');
    if (shipPicker && !shipPicker.hidden) return false;
    previousPaused = paused;
    returnFocus = document.activeElement;
    paused = true;
    keys.clear();
    GameAudio.setEngine(0);
    $('#audioSettings').open = false;
    open = true;
    overlay.hidden = false;
    refresh();
    search.focus();
    return true;
  }

  function closeView() {
    if (!open) return;
    open = false;
    overlay.hidden = true;
    paused = previousPaused;
    keys.clear();
    if (!$('#overlay').hidden) Colony.openInventory();
    if (typeof StarChart !== 'undefined' && StarChart.mapOpen) StarChart.refresh();
    if (typeof QuestLog !== 'undefined' && QuestLog.isOpen) QuestLog.refresh();
    if (returnFocus?.isConnected) returnFocus.focus();
  }

  function showItem(id) {
    if (!getEntry(id)) return false;
    selectedId = id;
    search.value = '';
    category.value = 'all';
    if (!openView()) return false;
    refresh();
    $('#encyclopediaDetails').scrollTop = 0;
    return true;
  }

  button.onclick = openView;
  surfaceButton.onclick = openView;
  $('#inventoryEncyclopedia').onclick = openView;
  $('#closeEncyclopedia').onclick = closeView;
  search.oninput = refresh;
  category.onchange = refresh;

  // Capture input while open so movement, firing, and other menu hotkeys stay inactive.
  addEventListener('keydown', event => {
    const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
    if (!open) {
      if (event.code === 'KeyB' && !event.repeat && !typing) {
        event.preventDefault();
        event.stopImmediatePropagation();
        openView();
      }
      return;
    }
    event.stopImmediatePropagation();
    if (event.code === 'Escape' || (event.code === 'KeyB' && !typing && !event.repeat)) {
      event.preventDefault();
      closeView();
      return;
    }
    if (event.code === 'Tab') {
      const controls = [...overlay.querySelectorAll('button:not(:disabled),input,select')];
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }, { capture: true });

  return {
    entries, getEntry, openView, closeView, showItem, refresh,
    get isOpen() { return open; },
    get selectedId() { return selectedId; }
  };
})();


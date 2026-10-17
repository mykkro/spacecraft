/**
 * Colony owns item metadata, inventory, crafting, save migration, and moon surfaces.
 * Item IDs are stable save keys; translated names and icons are presentation only.
 * The public API at the end is shared by flight, combat, navigation, quests, and checks.
 */

// Shared item economy, station recipes, and persistent moon surfaces.
const Colony = (() => {
  const $ = s => document.querySelector(s);
  // Stable IDs map to translated labels and gameplay metadata. Never save display names.
  const items = {
    stone: {
      name: I18n.t('Regolith'),
      icon: '◆',
      color: '#858b8e'
    },
    metal: {
      name: I18n.t('Iron ore'),
      icon: '⬟',
      color: '#bc997c'
    },
    ice: {
      name: I18n.t('Ice'),
      icon: '❖',
      color: '#8dc7db'
    },
    fuel_cell: {
      name: I18n.t('Fuel Cell'),
      asset: 'fuel_cell.svg',
      color: '#d7bc82',
      fuel: 20,
      description: I18n.t('Basic reactor fuel. Restores 20 fuel units.')
    },
    ion_cube: {
      name: I18n.t('Ion Cube'),
      asset: 'ion_cube.svg',
      color: '#65df8c',
      fuel: 80,
      weight: 1,
      description: I18n.t('Green premium fuel. Restores 80 fuel units.')
    },
    blue_ion_cube: {
      name: I18n.t('Blue Ion Cube'),
      asset: 'blue_ion_cube.svg',
      color: '#65b5ff',
      fuel: 320,
      weight: 1,
      description: I18n.t('Blue premium fuel. Restores 320 fuel units: four times a green Ion Cube.')
    },
    bulterite: {
      name: I18n.t('Bulterite'),
      color: '#82b494',
      asset: 'bulterite.svg',
      weight: 12,
      description: I18n.t('Very heavy, hard and durable. Advanced cutters required.')
    },
    photon: {
      name: I18n.t('Photon Cannon'),
      color: '#8fdaf7',
      asset: 'photon.svg',
      weapon: true
    },
    mininglaser: {
      name: I18n.t('Enhanced Mining Laser'),
      color: '#b9c888',
      asset: 'mininglaser.svg',
      weapon: true
    },
    fotron: {
      name: I18n.t('Fotron Cannon'),
      color: '#89f6c8',
      asset: 'fotron.svg',
      weapon: true
    },
    bulshitter: {
      name: I18n.t('Bulshitter'),
      color: '#f4ce7e',
      asset: 'bulshitter.svg',
      weapon: true
    },
    crystal: {
      name: I18n.t('Crystal'),
      icon: '♦',
      color: '#be9cdb'
    },
    ingot: {
      name: I18n.t('Iron ingot'),
      icon: '▰',
      color: '#c5ced3'
    },
    plate: {
      name: I18n.t('Hull plate'),
      icon: '▱',
      color: '#b6c7ba'
    },
    block: {
      name: I18n.t('Base block'),
      icon: '▦',
      color: '#94a8ab',
      place: true
    },
    bench: {
      name: I18n.t('Workbench'),
      icon: '⚒',
      color: '#d8b57e',
      place: true
    },
    furnace: {
      name: I18n.t('Furnace'),
      icon: '▣',
      color: '#e2a474',
      place: true
    },
    glass: {
      name: I18n.t('Glass block'),
      icon: '□',
      color: '#8cb7c9',
      place: true
    },
    lamp: {
      name: I18n.t('Beacon'),
      icon: '✦',
      color: '#f2d897',
      place: true
    },
    pulse: {
      name: I18n.t('Pulse Cannon'),
      color: '#a9dfef',
      weapon: true
    },
    laser: {
      name: I18n.t('Prism Laser'),
      color: '#c99bec',
      weapon: true
    },
    rockbreaker: {
      name: I18n.t('Rockbreaker'),
      color: '#dfb878',
      weapon: true
    },
    piercer: {
      name: I18n.t('Penetrator'),
      color: '#83ccd3',
      weapon: true
    },
    seismic: {
      name: I18n.t('Seismic Torpedo'),
      color: '#eea466',
      weapon: true
    },
    ammo_rockbreaker: {
      name: I18n.t('Rockbreaker ammo'),
      color: '#dfb878',
      image: 'rockbreaker',
      ammoFor: 'rockbreaker'
    },
    ammo_piercer: {
      name: I18n.t('Penetrator ammo'),
      color: '#83ccd3',
      image: 'piercer',
      ammoFor: 'piercer'
    },
    ammo_seismic: {
      name: I18n.t('Seismic ammo'),
      color: '#eea466',
      image: 'seismic',
      ammoFor: 'seismic'
    },
    scanner: {
      name: I18n.t('Scanner Receiver'),
      color: '#7bd4de',
      machine: true
    }
  };
  // Every catalogue entry has a description; keep it next to the shared item model.
  const itemDescriptions = {
    "stone": "Common moon regolith. Mine it near the surface and use it to make base blocks, workbenches and furnaces.",
    "metal": "Iron-bearing ore found in asteroids and moon deposits. Smelt it in a furnace to produce iron ingots.",
    "ice": "Frozen water found in asteroids and moon deposits. Used for fuel cells, glass and premium fuel recipes.",
    "crystal": "Crystalline mineral used in advanced weapons, scanners and Ion Cubes. Mine deposits or recover it from pirate salvage.",
    "ingot": "Refined iron produced by smelting ore in a furnace. A basic component for equipment, ammunition and hull plates.",
    "plate": "Structural hull plating. Craft it from iron at a workbench, or forge durable plates with Bulterite in a furnace.",
    "block": "A simple construction block made from regolith. Build an outpost on a moon; add a placed workbench to establish a base.",
    "bench": "Place this machine on a moon and stand nearby to use its 3×3 crafting grid. A placed workbench makes that moon count as a base.",
    "furnace": "Place on a moon to unlock nearby smelting recipes. Refines iron ore and makes glass, fuel cells and durable hull plates.",
    "glass": "A translucent construction block fused from ice and crystal. Also used as a component in the Scanner Receiver.",
    "lamp": "A placeable beacon that extends base signal coverage to a 1.2 km radius on the minimap and local chart.",
    "pulse": "The basic ship cannon. An energy weapon with rapid single shots for ordinary rocks and unarmoured targets.",
    "photon": "A stronger single-shot energy cannon supplied with the Nomad. Can also be crafted at a workbench.",
    "mininglaser": "The Kraxna 1 mining tool. Deals extra damage to asteroids, while damage against pirate ships stays lower.",
    "laser": "A focused energy weapon that breaks resonant rocks. Crafted at a workbench and reusable without missile ammunition.",
    "fotron": "An advanced cannon stronger than Photon. Its tier 3 shots can break ultradense rock and mine Bulterite.",
    "bulshitter": "Rapidly fires five weak shots in a spread. Useful against small pirate ships and small rocks; cannot break reinforced targets.",
    "rockbreaker": "The standard missile launcher. Breaks reinforced rock and consumes one Rockbreaker round per shot.",
    "piercer": "A fast advanced missile launcher for resonant rock and tough targets. Requires matching Penetrator ammunition.",
    "seismic": "A heavy torpedo launcher with area damage. Breaks ultradense rocks and Bulterite; each shot consumes a Seismic round.",
    "ammo_rockbreaker": "Consumable ammunition for the Rockbreaker launcher. Craft batches at a workbench or collect it from defeated pirates.",
    "ammo_piercer": "Consumable ammunition for the Penetrator launcher. Crafted in batches at a workbench; heavy pirates can also carry it.",
    "ammo_seismic": "Consumable Seismic Torpedoes. Craft at a workbench or recover from heavy pirate salvage.",
    "scanner": "Carry this receiver to detect wormholes within 6.5 km and locate neighbouring systems. Open the maps with M; no installation is required."
  };
  for (const [type, item] of Object.entries(items)) {
    item.description = item.description || I18n.t(itemDescriptions[type] || 'A useful item for your expedition.');
  }
  const stackLimits = {
    fuel_cell: 16,
    ion_cube: 8,
    blue_ion_cube: 4,
    bulterite: 8,
    photon: 1,
    mininglaser: 1,
    fotron: 1,
    bulshitter: 1,
    ammo_rockbreaker: 16,
    ammo_piercer: 8,
    ammo_seismic: 4,
    stone: 64,
    metal: 64,
    ice: 32,
    crystal: 16,
    ingot: 32,
    plate: 16,
    block: 64,
    glass: 32,
    bench: 4,
    furnace: 4,
    lamp: 8,
    pulse: 1,
    laser: 1,
    rockbreaker: 1,
    piercer: 1,
    seismic: 1,
    scanner: 1
  };
  for (const [type, item] of Object.entries(items))
    item.maxStack = stackLimits[type] || 64;
  // Keep one loader alive per asset when crafting rebuilds the slot DOM.
  // This avoids cancelling in-flight image requests during rapid inventory updates.
  const itemImages = Object.fromEntries(Object.keys(items).map(type => {
    const image = new Image();
    image.src = `assets/items/${ items[type].asset || (items[type].image || type) + '.png' }`;
    return [type, image];
  }));
  // Pattern order is row-major. null means an intentionally empty crafting-grid cell.
  const recipes = [
    {
      station: 'hand',
      name: I18n.t('Workbench'),
      pattern: ['stone', 'stone', 'stone', 'stone'],
      out: 'bench',
      qty: 1
    },
    {
      station: 'hand',
      name: I18n.t('Base blocks'),
      pattern: ['stone', 'stone', null, null],
      out: 'block',
      qty: 4
    },
    {
      station: 'bench',
      name: I18n.t('Furnace'),
      pattern: ['stone', 'stone', 'stone', 'stone', null, 'stone', 'stone', 'stone', 'stone'],
      out: 'furnace',
      qty: 1
    },
    {
      station: 'bench',
      name: I18n.t('Hull plates'),
      pattern: ['ingot', 'ingot', null, null, null, null, null, null, null],
      out: 'plate',
      qty: 2
    },
    {
      station: 'bench',
      name: I18n.t('Beacon'),
      pattern: [null, 'crystal', null, null, 'ingot', null, null, 'ingot', null],
      out: 'lamp',
      qty: 1
    },
    {
      station: 'furnace',
      name: I18n.t('Refine iron'),
      pattern: ['metal', null, null, null],
      out: 'ingot',
      qty: 1
    },
    {
      station: 'furnace',
      name: I18n.t('Fuse glass'),
      pattern: ['ice', 'crystal', null, null],
      out: 'glass',
      qty: 2
    },
    {
      station: 'bench',
      name: I18n.t('Prism Laser · T2'),
      pattern: ['ingot', 'crystal', 'ingot', 'plate', 'crystal', 'plate', null, 'ingot', null],
      out: 'laser',
      qty: 1
    },
    {
      station: 'bench',
      name: I18n.t('Penetrator · T2'),
      pattern: [null, 'crystal', null, 'plate', 'ingot', 'plate', null, 'ingot', null],
      out: 'piercer',
      qty: 1
    },
    {
      station: 'bench',
      name: I18n.t('Seismic Torpedo · T3'),
      pattern: ['plate', 'crystal', 'plate', 'ingot', 'crystal', 'ingot', 'plate', 'ingot', null],
      out: 'seismic',
      qty: 1
    },
    {
      station: 'bench',
      name: I18n.t('Scanner Receiver'),
      pattern: ['ingot', 'crystal', 'ingot', 'plate', 'glass', 'plate', null, 'ingot', null],
      out: 'scanner',
      qty: 1
    }
  ];
  recipes.push({
    station: 'bench',
    name: I18n.t('Rockbreaker ammo ×4'),
    pattern: ['ingot', 'ice', 'ingot', null, null, null, null, null, null],
    out: 'ammo_rockbreaker',
    qty: 4
  }, {
    station: 'bench',
    name: I18n.t('Penetrator ammo ×3'),
    pattern: ['ingot', 'crystal', 'ingot', null, 'plate', null, null, null, null],
    out: 'ammo_piercer',
    qty: 3
  }, {
    station: 'bench',
    name: I18n.t('Seismic ammo'),
    pattern: ['crystal', 'plate', 'crystal', 'ingot', null, 'ingot', null, null, null],
    out: 'ammo_seismic',
    qty: 1
  });
  recipes.push({
    station: 'bench',
    name: I18n.t('Photon Cannon'),
    pattern: ['ingot', 'crystal', 'ingot', null, 'plate', null, null, 'crystal', null],
    out: 'photon',
    qty: 1
  }, {
    station: 'bench',
    name: I18n.t('Enhanced Mining Laser'),
    pattern: ['plate', 'crystal', 'plate', 'ingot', 'crystal', 'ingot', null, 'ingot', null],
    out: 'mininglaser',
    qty: 1
  }, {
    station: 'bench',
    name: I18n.t('Fotron Cannon'),
    pattern: [
      'bulterite',
      'crystal',
      'bulterite',
      'ingot',
      'bulterite',
      'ingot',
      'plate',
      'crystal',
      'plate'
    ],
    out: 'fotron',
    qty: 1
  }, {
    station: 'bench',
    name: I18n.t('Bulshitter'),
    pattern: ['ingot', 'plate', 'ingot', null, 'crystal', null, null, 'plate', null],
    out: 'bulshitter',
    qty: 1
  }, {
    station: 'furnace',
    name: I18n.t('Forge durable plates'),
    pattern: ['bulterite', 'ingot', 'ingot', null],
    out: 'plate',
    qty: 4
  });
  recipes.push({
    station: 'furnace',
    name: I18n.t('Fuel Cells ×2'),
    pattern: ['ice', 'ingot', 'ice', null],
    out: 'fuel_cell',
    qty: 2
  }, {
    station: 'bench',
    name: I18n.t('Ion Cube'),
    pattern: ['crystal', 'ice', 'crystal', null, 'ingot', null, null, 'ice', null],
    out: 'ion_cube',
    qty: 1
  }, {
    station: 'bench',
    name: I18n.t('Blue Ion Cube'),
    pattern: [
      'ion_cube',
      'crystal',
      'ion_cube',
      null,
      'bulterite',
      null,
      'crystal',
      'ion_cube',
      null
    ],
    out: 'blue_ion_cube',
    qty: 1
  });
  // Bag slots are null or { type, qty }. Cursor and reserve stacks remain separate.
  let bag = Array(Shipyard.current.slots).fill(null),
    selected = -1,
    carried = null,
    overflow = [],
    station = 'hand',
    grid = Array(4).fill(null);
  const questState = {
    mined: {
      metal: 0,
      ice: 0,
      crystal: 0
    },
    claimed: []
  };
  const cursor = document.createElement('div');
  cursor.id = 'inventoryCursor';
  cursor.hidden = true;
  cursor.setAttribute('aria-hidden', 'true');
  $('#overlay').append(cursor);
  let surface = null,
    activeMoon = null,
    buildType = 'block',
    saveClock = 0,
    miningClock = 0;
  const moons = new Map(),
    terrains = new Map(),
    baseRecords = new Map(),
    tileSize = 32,
    cols = 160,
    rows = 64;
  const baseParts = ['block', 'glass', 'bench', 'furnace', 'lamp'];
  const player = {
    x: 14,
    y: 14,
    vy: 0,
    grounded: false
  };
  const pointer = {
    x: 0,
    y: 0,
    down: false
  };
  const defaultHotbar = ['block', 'glass', 'bench', 'furnace', 'lamp', 'stone'];
  const quickDragType = 'application/x-spacecraft-quick';
  let hotbar = [...defaultHotbar];
  let activeQuickSlot = 0;
  let storageOK = true;

  // Usable bag contents only. Crafting and ammunition must not consume held or reserve stacks.
  function count(type, slots = bag) {
    return slots.reduce((n, s) => n + ((s?.type) === type ? s.qty : 0), 0);
  }

  // Ownership includes held items and reserve cargo, so upgrades stay unlocked during moves.
  function ownedCount(type) {
    return count(type) + ((carried?.type) === type ? carried.qty : 0) + count(type, overflow);
  }

  // Fill matching stacks first, then empty slots. Return the quantity that did not fit.
  // This mutates the supplied slots; callers needing atomic changes must pass a copy.
  function deposit(slots, type, qty) {
    const limit = items[type].maxStack;
    for (const s of slots)
      if ((s?.type) === type && s.qty < limit) {
        const n = Math.min(qty, limit - s.qty);
        s.qty += n;
        qty -= n;
        if (!qty)
          return 0;
      }
    for (let i = 0; i < slots.length; i++)
      if (!slots[i]) {
        const n = Math.min(qty, limit);
        slots[i] = {
          type,
          qty: n
        };
        qty -= n;
        if (!qty)
          return 0;
      }
    return qty;
  }
  function insert(slots, type, qty) {
    return deposit(slots, type, qty) === 0;
  }

  // Keep cargo that no longer fits after a ship change or a stack-limit migration.
  function preserveOverflow(type, qty) {
    while (qty > 0) {
      const n = Math.min(qty, items[type].maxStack);
      overflow.push({
        type,
        qty: n
      });
      qty -= n;
    }
  }
  function reclaimOverflow() {
    const remaining = [];
    for (const s of overflow) {
      const qty = deposit(bag, s.type, s.qty);
      if (qty)
        remaining.push({
          type: s.type,
          qty
        });
    }
    overflow = remaining;
    sync();
    save();
    renderInventory();
  }

  // Try to place the cursor stack back into the bag; leave the remainder held if full.
  function returnCarried() {
    if (!carried)
      return true;
    const qty = deposit(bag, carried.type, carried.qty);
    carried = qty ? {
      type: carried.type,
      qty
    } : null;
    sync();
    save();
    return !carried;
  }
  function closeInventory() {
    const returned = returnCarried();
    if (!returned) {
      notify(I18n.t('PLACE THE HELD STACK IN A SLOT BEFORE CLOSING'));
      renderInventory();
      $('#returnHeld')?.focus();
      return false;
    }
    selected = -1;
    cursor.hidden = true;
    return true;
  }
  function focusedStack() {
    return carried || bag[selected];
  }

  // Left click selects, moves, merges, or swaps. Right click picks up half or places one.
  // The held cursor stack is separate from selected, which is a bag-slot index.
  function clickSlot(i, right = false) {
    if (!Number.isInteger(i) || i < 0 || i >= bag.length)
      return;
    const target = bag[i];
    if (carried) {
      if (!target || target.type === carried.type) {
        const n = Math.min(right ? 1 : carried.qty, items[carried.type].maxStack - ((target?.qty) || 0));
        if (n > 0) {
          if (target)
            target.qty += n;
          else
            bag[i] = {
              type: carried.type,
              qty: n
            };
          carried.qty -= n;
          if (!carried.qty)
            carried = null;
        }
      } else if (!right) {
        bag[i] = carried;
        carried = target;
      }
      selected = -1;
    } else if (right) {
      if (target) {
        const qty = Math.ceil(target.qty / 2);
        carried = {
          type: target.type,
          qty
        };
        target.qty -= qty;
        if (!target.qty)
          bag[i] = null;
      }
      selected = -1;
    } else if (selected < 0) {
      if (target)
        selected = i;
    } else if (selected === i)
      selected = -1;
    else {
      const source = bag[selected];
      if (source) {
        if ((target?.type) === source.type) {
          const n = Math.min(items[source.type].maxStack - target.qty, source.qty);
          target.qty += n;
          source.qty -= n;
          if (!source.qty)
            bag[selected] = null;
        } else {
          bag[i] = source;
          bag[selected] = target;
        }
      }
      selected = -1;
    }
    sync();
    save();
    renderInventory();
  }

  // Refresh resource counters, construction hotbar, and available refuelling stock.
  function sync() {
    for (const type of ['metal', 'ice', 'crystal', 'bulterite']) {
      cargo[type] = ownedCount(type);
      $(`#${ type }`).textContent = cargo[type];
    }
    renderHotbar();
    Fuel.refresh(count('fuel_cell') + count('ion_cube') + count('blue_ion_cube'));
  }

  // Changing ships preserves every item. Removed slots are repacked or saved in reserve.
  function resizeCargo() {
    const slots = Shipyard.current.slots,
      pending = [...bag.slice(slots), ...overflow].filter(Boolean);
    bag = bag.slice(0, slots);
    while (bag.length < slots)
      bag.push(null);
    overflow = [];
    for (const stack of pending) {
      const remaining = deposit(bag, stack.type, stack.qty);
      if (remaining)
        preserveOverflow(stack.type, remaining);
    }
    selected = -1;
    sync();
    save();
  }

  // Include held and reserve cargo so moving items cannot bypass the handling penalty.
  function cargoMass() {
    return [...bag, ...overflow, carried].reduce((sum, s) => sum + (s ? s.qty * (items[s.type].weight || 1) : 0), 0);
  }

  // Trial insertion into a copy makes pickups all-or-nothing when space is tight.
  function addItem(type, qty) {
    if (!items[type] || qty <= 0 || !Number.isInteger(qty))
      return false;
    const next = bag.map(s => s ? { ...s } : null);
    if (!insert(next, type, qty))
      return false;
    bag = next;
    sync();
    return true;
  }

  // Check availability before mutating. Successful ammunition use is saved immediately.
  function consumeItem(type, qty = 1) {
    if (!items[type] || !Number.isSafeInteger(qty) || qty < 1 || count(type) < qty)
      return false;
    remove(bag, type, qty);
    sync();
    save();
    return true;
  }

  // Transfer one real inventory item into the reactor, retaining any excess cell charge.
  function refuel(type) {
    if (!(items[type]?.fuel) || carried || count(type) < 1)
      return false;
    if (!Fuel.canRefuel()) {
      notify(I18n.t('TANK FULL OR CELL STILL CHARGED'));
      return false;
    }
    if (!Fuel.insert(items[type].fuel))
      return false;
    remove(bag, type, 1);
    sync();
    save();
    GameAudio.play('refuel');
    if (!$('#overlay').hidden)
      renderInventory();
    notify(I18n.t('REFUELLED') + ' · ' + items[type].name);
    return true;
  }
  function refuelBest() {
    if (carried) {
      notify(I18n.t('PLACE HELD STACK BEFORE REFUELLING'));
      return false;
    }
    const type = ['fuel_cell', 'ion_cube', 'blue_ion_cube'].find(type => count(type) > 0);
    if (!type) {
      notify(I18n.t('NO FUEL ITEMS · CRAFT OR MINE ION CUBES'));
      return false;
    }
    return refuel(type);
  }

  // Only actual mining pickups count. Spending materials never reduces quest progress.
  function recordMined(type, qty = 1, persist = true) {
    if (!Object.hasOwn(questState.mined, type) || !Number.isSafeInteger(qty) || qty < 1)
      return;
    questState.mined[type] = Math.min(Number.MAX_SAFE_INTEGER, questState.mined[type] + qty);
    if (persist)
      save();
    if (typeof QuestLog !== 'undefined')
      QuestLog.refresh();
  }
  function questProgress() {
    return {
      mined: { ...questState.mined },
      claimed: [...questState.claimed]
    };
  }

  // Insert the whole reward into a copy before marking it claimed, preventing lost rewards.
  function claimQuest(id) {
    if (typeof QuestLog === 'undefined' || !QuestLog.canClaim(id))
      return {
        ok: false,
        message: I18n.t('This quest is not ready to claim.')
      };
    if (carried)
      return {
        ok: false,
        message: I18n.t('Place your held stack in the bag before claiming.')
      };
    const next = bag.map(s => s ? { ...s } : null),
      quest = QuestLog.getDefinition(id);
    for (const [type, qty] of Object.entries(quest.rewards))
      if (!insert(next, type, qty))
        return {
          ok: false,
          message: I18n.t('Free inventory space for the full reward, then claim again.')
        };
    bag = next;
    questState.claimed.push(id);
    sync();
    save();
    GameAudio.play('craft');
    QuestLog.refresh();
    return {
      ok: true,
      message: I18n.t('Rewards added to your inventory.')
    };
  }
  function remove(slots, type, qty) {
    for (let i = 0; i < slots.length && qty > 0; i++)
      if ((slots[i]?.type) === type) {
        const n = Math.min(qty, slots[i].qty);
        slots[i].qty -= n;
        qty -= n;
        if (!slots[i].qty)
          slots[i] = null;
      }
    return qty === 0;
  }

  // Keep inventory, fuel, ship selection, quest state, and terrain in one expedition record.
  function save() {
    try {
      localStorage.setItem('spacecraft-save-v1', JSON.stringify({
        fuel: Fuel.snapshot(),
        fuelInitialized: true,
        shipPreset: Shipyard.confirmed ? Shipyard.current.id : null,
        ammoInitialized: true,
        quickSlots: hotbar,
        activeQuickSlot,
        bag,
        carried,
        overflow,
        quests: questState,
        terrains: [...terrains],
        ship: {
          x: ship.x,
          y: ship.y,
          hull: ship.hull
        },
        activeMoon: activeMoon ? { ...activeMoon } : null,
        player: {
          x: player.x,
          y: player.y
        },
        kills
      }));
    } catch {
      if (storageOK)
        notify(I18n.t('LOCAL SAVE UNAVAILABLE · SESSION ONLY'));
      storageOK = false;
    }
  }

  // Validate old saves, split oversized stacks, and preserve items that no longer fit.
  // One-time starter grants are flagged so reloads never refill supplies.
  function load() {
    try {
      const data = JSON.parse(localStorage.getItem('spacecraft-save-v1') || 'null');
      if (!data)
        return false;
      const valid = s => s && Object.hasOwn(items, s.type) && Number.isSafeInteger(s.qty) && s.qty >= 1 && s.qty <= 65536;
      if (!Array.isArray(data.bag) || ![18, 30, 60].includes(data.bag.length) || data.bag.some(s => s && !valid(s)))
        return false;
      if (Array.isArray(data.quickSlots) && data.quickSlots.length === 6) {
        hotbar = data.quickSlots.map(type =>
          typeof type === 'string' && Object.hasOwn(items, type) ? type : null
        );
      }
      if (Number.isInteger(data.activeQuickSlot) && data.activeQuickSlot >= 0 && data.activeQuickSlot < 6) {
        activeQuickSlot = data.activeQuickSlot;
      }
      updateQuickBuild();
      const pending = [];
      bag = Array(Shipyard.current.slots).fill(null);
      data.bag.forEach((s, i) => {
        if (!s)
          return;
        const qty = Math.min(s.qty, items[s.type].maxStack);
        if (i < bag.length)
          bag[i] = {
            type: s.type,
            qty
          };
        else
          pending.push({
            type: s.type,
            qty
          });
        if (s.qty > qty)
          pending.push({
            type: s.type,
            qty: s.qty - qty
          });
      });
      for (const type of Object.keys(questState.mined)) {
        const n = (data.quests?.mined?.[type]);
        if (Number.isSafeInteger(n) && n >= 0)
          questState.mined[type] = n;
      }
      if (Array.isArray((data.quests?.claimed)))
        questState.claimed = [...new Set(data.quests.claimed.filter(id => typeof id === 'string' && /^[a-z0-9-]{1,60}$/.test(id)))];
      if (Array.isArray(data.overflow))
        for (const s of data.overflow)
          if (valid(s))
            pending.push(s);
      if (valid(data.carried)) {
        const qty = Math.min(data.carried.qty, items[data.carried.type].maxStack);
        carried = {
          type: data.carried.type,
          qty
        };
        if (data.carried.qty > qty)
          pending.push({
            type: data.carried.type,
            qty: data.carried.qty - qty
          });
      }
      if (!data.fuelInitialized)
        pending.push({
          type: 'ion_cube',
          qty: 2
        });
      if (!data.ammoInitialized)
        pending.push({
          type: 'ammo_rockbreaker',
          qty: 8
        });
      for (const s of pending) {
        const remaining = deposit(bag, s.type, s.qty);
        if (remaining)
          preserveOverflow(s.type, remaining);
      }
      if (carried) {
        const remaining = deposit(bag, carried.type, carried.qty);
        carried = remaining ? {
          type: carried.type,
          qty: remaining
        } : null;
      }
      for (const [id, t] of data.terrains || [])
        if (typeof id === 'string' && Array.isArray(t) && t.length === rows && t.every(r => Array.isArray(r) && r.length === cols && r.every(v => v === null || !!items[v])))
          terrains.set(id, t);
      if (data.ship && Number.isFinite(data.ship.x) && Number.isFinite(data.ship.y)) {
        ship.x = data.ship.x;
        ship.y = data.ship.y;
        ship.hull = Math.max(1, Math.min(100, data.ship.hull || 100));
      }
      kills = Number.isInteger(data.kills) ? Math.max(0, data.kills) : 0;
      if (data.activeMoon && terrains.has(data.activeMoon.id) && Number.isFinite(data.activeMoon.x) && Number.isFinite(data.activeMoon.y) && Number.isFinite(data.activeMoon.r)) {
        activeMoon = data.activeMoon;
        surface = terrains.get(activeMoon.id);
        if (data.player && Number.isFinite(data.player.x) && Number.isFinite(data.player.y)) {
          player.x = Math.max(1, Math.min(cols - 1, data.player.x));
          player.y = Math.max(2, Math.min(rows - 1, data.player.y));
        }
        setSurfaceUI(true);
      }
      return true;
    } catch {
      return false;
    }
  }
  function icon(type) {
    return `<img class="item-icon" src="${ itemImages[type].getAttribute('src') }" width="54" height="54" alt="" aria-hidden="true" draggable="false">`;
  }
  function slotMarkup(s, i) {
    return `<button class="item-slot ${ i === selected ? 'selected' : '' }" data-slot="${ i }" data-item="${ (s?.type) || '' }" title="${ s ? items[s.type].name + ' × ' + s.qty + ' / ' + items[s.type].maxStack : I18n.t('Empty slot') }" aria-label="${ s ? items[s.type].name + ', ' + s.qty + I18n.t(', stack limit ') + items[s.type].maxStack : I18n.t('Empty slot') }">${ s ? I18n.html(`${ icon(s.type) }<small>${ s.qty }</small><span class="item-name">${ items[s.type].name } · MAX ${ items[s.type].maxStack }</span>`) : '' }</button>`;
  }

  // Stations must be physically close on the active moon; carrying one is not enough.
  function nearbyStations() {
    const found = new Set(['hand']);
    if (surface)
      for (let y = Math.floor(player.y) - 3; y <= Math.ceil(player.y) + 2; y++)
        for (let x = Math.floor(player.x) - 3; x <= Math.ceil(player.x) + 3; x++) {
          const v = tile(x, y);
          if ((v === 'bench' || v === 'furnace') && Math.hypot(x + .5 - player.x, y + .5 - player.y) < 3.5)
            found.add(v);
        }
    return found;
  }
  function openInventory() {
    if (!nearbyStations().has(station)) {
      station = 'hand';
      grid = Array(4).fill(null);
    }
    renderInventory();
    $('#resume').textContent = surface ? I18n.t('RETURN TO SURFACE →') : I18n.t('RETURN TO FLIGHT →');
  }

  // Recipes match their exact station grid, including empty cells.
  function matchedRecipe() {
    return recipes.find(r => r.station === station && r.pattern.every((t, i) => (t || null) === (grid[i] || null)));
  }
  function costs(pattern) {
    const out = {};
    for (const type of pattern)
      if (type)
        out[type] = (out[type] || 0) + 1;
    return out;
  }
  function canCraft(r) {
    return !carried && r && Object.entries(costs(r.pattern)).every(([t, n]) => count(t) >= n);
  }

  // Remove ingredients and insert output into a copy, then commit both together.
  function craft() {
    const r = matchedRecipe();
    if (!nearbyStations().has(station) || !canCraft(r))
      return false;
    const next = bag.map(s => s ? { ...s } : null);
    for (const [type, n] of Object.entries(costs(r.pattern)))
      remove(next, type, n);
    if (!insert(next, r.out, r.qty)) {
      notify(I18n.t('INVENTORY FULL · FREE A SLOT'));
      return false;
    }
    bag = next;
    sync();
    save();
    renderInventory();
    GameAudio.play('craft');
    return true;
  }

  // Rebuild the inventory panel from model state and reconnect handlers afterwards.
  // Ingredient grids reference bag items; they do not hold a second copy of the cargo.
  function renderInventory() {
    const available = nearbyStations(),
      size = station === 'bench' ? 3 : 2,
      r = matchedRecipe();
    $('#slots').innerHTML = I18n.html(`<div class="inventory-label">PERSONAL INVENTORY <span>${ bag.length } SLOTS · LIMITS VARY BY ITEM</span></div><div class="bag-grid">${ bag.map(slotMarkup).join('') }</div><p class="inventory-hint">${ selected >= 0 && bag[selected] ? I18n.t(`Selected: ${ items[bag[selected].type].name }. Click another slot to move / merge, or a grid cell to assign.`) : I18n.t('Click a stack to select it. Ingredients stay in inventory until you craft.') }</p><div class="station-tabs">${ [
      ['hand', I18n.t('Handcraft · 2×2')],
      ['bench', I18n.t('Workbench · 3×3')],
      ['furnace', I18n.t('Furnace · 2×2')]
    ].map(([id, name]) => `<button data-station="${ id }" class="${ station === id ? 'active' : '' }" ${ available.has(id) ? '' : 'disabled' } title="${ available.has(id) ? name : I18n.t('Place this station on a moon and stand nearby') }">${ name }</button>`).join('') }</div><div class="craft-layout"><div><div class="craft-grid" style="grid-template-columns:repeat(${ size },1fr)">${ grid.map((t, i) => `<button class="item-slot" data-cell="${ i }" title="${ t ? items[t].name + I18n.t(' · click to replace, right click to clear') : I18n.t('Assign selected ingredient') }">${ t ? icon(t) : '<span class="cell-plus">+</span>' }</button>`).join('') }</div><button id="clearGrid" class="subtle">CLEAR GRID</button></div><div class="craft-result"><span>→</span><div class="item-slot output">${ r ? `${ icon(r.out) }<small>${ r.qty }</small>` : '?' }</div><b>${ r ? items[r.out].name : I18n.t('No recipe') }</b><button id="craftItem" ${ canCraft(r) ? '' : 'disabled' }>${ r && !canCraft(r) ? I18n.t('NEED MATERIALS') : I18n.t('CRAFT') }</button></div><div class="recipe-book"><div class="eyebrow">RECIPES</div>${ recipes.filter(r => r.station === station).map(r => `<button data-recipe="${ recipes.indexOf(r) }">${ icon(r.out) }<span>${ r.name }<small>${ Object.entries(costs(r.pattern)).map(([t, n]) => `${ n } ${ items[t].name }`).join(' + ') }</small></span></button>`).join('') }</div></div><p class="inventory-hint">Recipe buttons fill the grid. Right click a cell to clear it. Place workbenches and furnaces on a moon to unlock their grids. Saves automatically on this browser.</p>`);
    renderQuickInventory();
    const focus = focusedStack();
    $('#slots .inventory-label span').textContent = I18n.t(`${ bag.length } SLOTS · LIMITS VARY BY ITEM`);
    if (carried) {
      $('#slots .inventory-hint').textContent = I18n.t(`Holding ${ carried.qty } ${ items[carried.type].name }. Left click to place / merge; right click to place one. Place held items before crafting.`);
      $('#slots').insertAdjacentHTML('afterbegin', I18n.html(`<div class="held-stack" role="status">${ icon(carried.type) }<span>HOLDING <b>${ carried.qty } ${ items[carried.type].name }</b><small>STACK LIMIT ${ items[carried.type].maxStack }</small></span><button id="returnHeld">RETURN TO BAG</button></div>`));
      $('#returnHeld').onclick = () => {
        returnCarried();
        renderInventory();
      };
      $('#craftItem').textContent = I18n.t('PLACE HELD STACK');
    } else if (!focus)
      $('#slots .inventory-hint').textContent = I18n.t('Left click to select and move. Right click to pick up half (rounded up). Hover for stack limits.');
    if (overflow.length) {
      const totals = {};
      for (const s of overflow)
        totals[s.type] = (totals[s.type] || 0) + s.qty;
      $('#slots').insertAdjacentHTML('afterbegin', I18n.html(`<div class="inventory-overflow"><div><b>SAVED CARGO OVERFLOW</b><p>${ Object.entries(totals).map(([type, qty]) => `${ qty } ${ items[type].name }`).join(' · ') }</p><small>Preserved from older stack limits. Free slots, then recover your cargo.</small></div><button id="recoverOverflow">RECOVER CARGO</button></div>`));
      $('#recoverOverflow').onclick = reclaimOverflow;
    }
    cursor.innerHTML = carried ? `${ icon(carried.type) }<small>${ carried.qty }</small>` : '';
    if (!carried)
      cursor.hidden = true;
    $('#slots').insertAdjacentHTML('beforeend', I18n.html('<p class="inventory-hint fuel-hint">FUEL: use T in flight, or select a fuel item below to refuel. Unused cube charge is retained. Empty tanks leave only weak solar thrust.</p>'));
    if (focus && items[focus.type].fuel) {
      const item = items[focus.type];
      $('#slots').insertAdjacentHTML('beforeend', I18n.html(`<div class="fuel-item-actions"><span>${ item.name } · ${ item.fuel } FUEL UNITS<br>FUEL TANK: ${ Math.ceil(Fuel.amount) } / ${ Fuel.capacity }</span><button id="useFuel" ${ carried || !Fuel.canRefuel() ? 'disabled' : '' }>REFUEL</button></div>`));
      $('#useFuel').onclick = () => refuel(focus.type);
    }
    if (focus && items[focus.type].description)
      $('#slots').insertAdjacentHTML('beforeend', `<p class="inventory-hint">${ items[focus.type].description } · ${ I18n.t('MASS') }: ${ items[focus.type].weight || 1 }</p>`);
    if ((focus?.type) === 'scanner')
      $('#slots').insertAdjacentHTML('beforeend', I18n.html('<p class="inventory-hint">RECEIVER ONLINE · Automatically detects wormholes within 6.5 km. Press M for the local and global charts.</p>'));
    if (focus && items[focus.type].weapon) {
      const type = focus.type,
        def = Weapons.definitions[type];
      $('#slots').insertAdjacentHTML('beforeend', I18n.html(`<div class="equip-row"><span>${ def.name } · T${ def.tier } · ${ def.damage } damage · ${ def.cooldown }s recharge</span><button id="equipWeapon">EQUIP ${ def.channel === 'primary' ? I18n.t('PRIMARY') : I18n.t('MISSILE') }</button></div>`));
      $('#equipWeapon').onclick = () => {
        Weapons.select(type);
        notify(I18n.t(`${ def.name.toUpperCase() } EQUIPPED`));
      };
    }
    $('#slots').querySelectorAll('[data-slot]').forEach(btn => {
      btn.onclick = () => clickSlot(Number(btn.dataset.slot));
      btn.draggable = !!bag[Number(btn.dataset.slot)];
      btn.ondragstart = event => {
        const stack = bag[Number(btn.dataset.slot)];
        if (!stack || carried) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData(quickDragType, JSON.stringify({ kind: 'item', type: stack.type }));
        event.dataTransfer.effectAllowed = 'copy';
      };
      btn.oncontextmenu = e => {
        e.preventDefault();
        clickSlot(Number(btn.dataset.slot), true);
      };
    });
    $('#slots').querySelectorAll('[data-station]').forEach(btn => btn.onclick = () => {
      station = btn.dataset.station;
      grid = Array(station === 'bench' ? 9 : 4).fill(null);
      renderInventory();
    });
    $('#slots').querySelectorAll('[data-cell]').forEach(btn => {
      btn.onclick = () => {
        const type = (focusedStack()?.type);
        if (!type)
          return;
        grid[Number(btn.dataset.cell)] = type;
        renderInventory();
      };
      btn.oncontextmenu = e => {
        e.preventDefault();
        grid[Number(btn.dataset.cell)] = null;
        renderInventory();
      };
    });
    $('#slots').querySelectorAll('[data-recipe]').forEach(btn => btn.onclick = () => {
      grid = [...recipes[Number(btn.dataset.recipe)].pattern];
      renderInventory();
    });
    $('#clearGrid').onclick = () => {
      grid.fill(null);
      renderInventory();
    };
    $('#craftItem').onclick = craft;
  }

  // Derive moon identity from chunk coordinates so revisiting gives the same location.
  function moonAt(cx, cy) {
    if (cx === 0 && cy === 0)
      return {
        id: '0:0',
        x: 720,
        y: -600,
        r: 180,
        name: 'Selene'
      };
    const rng = random(Math.imul(cx, 9137) ^ Math.imul(cy, 65537) ^ 9981);
    return {
      id: `${ cx }:${ cy }`,
      x: cx * 4000 + 600 + rng() * 2700,
      y: cy * 4000 + 600 + rng() * 2700,
      r: 140 + rng() * 100,
      name: `Drift ${ cx }:${ cy }`
    };
  }
  // Index built terrain once on load, then only after construction changes.

  // Cache base metadata after construction changes instead of scanning terrain every frame.
  function indexBase(id, map) {
    const match = /^(-?\d+):(-?\d+)$/.exec(id);
    if (!match)
      return;
    const cx = Number(match[1]),
      cy = Number(match[2]);
    if (!Number.isSafeInteger(cx) || !Number.isSafeInteger(cy) || Math.abs(cx) > 1e7 || Math.abs(cy) > 1e7)
      return;
    const counts = Object.fromEntries(baseParts.map(t => [t, 0]));
    let modules = 0;
    for (const row of map)
      for (const type of row)
        if (Object.hasOwn(counts, type)) {
          counts[type]++;
          modules++;
        }
    if (!modules) {
      baseRecords.delete(id);
      return;
    }
    const moon = moonAt(cx, cy),
      footprint = Math.round(moon.r + 45),
      beacons = counts.lamp,
      isBase = counts.bench > 0;
    baseRecords.set(id, {
      id,
      x: moon.x,
      y: moon.y,
      name: `${ moon.name } ${ isBase ? I18n.t('Base') : I18n.t('Outpost') }`,
      moonName: moon.name,
      isBase,
      modules,
      counts,
      beacons,
      footprint,
      radius: beacons ? 1200 : footprint,
      effect: beacons ? I18n.t('Beacon signal coverage') : I18n.t('Outpost footprint')
    });
  }
  function rebuildBaseIndex() {
    baseRecords.clear();
    for (const [id, map] of terrains)
      indexBase(id, map);
  }
  function getBases() {
    return [...baseRecords.values()];
  }

  // Generate only neighboring moons and keep the location cache bounded.
  function localMoons() {
    const cx = Math.floor(ship.x / 4000),
      cy = Math.floor(ship.y / 4000),
      out = [];
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let y = cy - 1; y <= cy + 1; y++) {
        const id = `${ x }:${ y }`;
        if (!moons.has(id))
          moons.set(id, moonAt(x, y));
        out.push(moons.get(id));
      }
    if (moons.size > 64)
      for (const [id, m] of moons)
        if (Math.hypot(m.x - ship.x, m.y - ship.y) > 16000)
          moons.delete(id);
    return out;
  }
  function nearestMoon() {
    return localMoons().find(m => Math.hypot(m.x - ship.x, m.y - ship.y) < m.r + 220);
  }
  function updateSpace() {
    const m = nearestMoon();
    $('#landingPrompt').hidden = !m;
    if (m) {
      $('#landingText').textContent = I18n.t(`${ m.name.toUpperCase() } · LANDABLE MOON${ Math.hypot(ship.vx, ship.vy) > 160 ? I18n.t(' · SLOW DOWN') : '' }`);
      $('#land').disabled = Math.hypot(ship.vx, ship.vy) > 160;
      $('#land').textContent = I18n.t('LAND [E]');
      const dx = ship.x - m.x,
        dy = ship.y - m.y,
        d = Math.hypot(dx, dy);
      if (d < m.r + 28) {
        ship.x = m.x + dx / (d || 1) * (m.r + 29);
        ship.y = m.y + dy / (d || 1) * (m.r + 29);
        if (!d)
          ship.y = m.y - m.r - 29;
        ship.vx *= .9;
        ship.vy *= .9;
      }
    }
    saveClock += 1 / 60;
    if (saveClock > 5) {
      save();
      saveClock = 0;
    }
  }

  // Create a persistent tile grid once per moon. The landing area is kept level.
  function terrainFor(m) {
    if (terrains.has(m.id))
      return terrains.get(m.id);
    const rng = random(Math.imul(Math.round(m.x), 31) ^ Math.round(m.y)),
      map = Array.from({ length: rows }, () => Array(cols).fill(null));
    for (let x = 0; x < cols; x++) {
      const top = x >= 7 && x <= 20 ? 14 : Math.round(15 + Math.sin(x * .17) * 2 + Math.sin(x * .06) * 3);
      for (let y = top; y < rows; y++) {
        const v = rng();
        // Rare resources are available only below the shallow regolith layer.
        map[y][x] = y < top + 2 ? 'stone'
          : y > top + 14 && v < .008 ? 'blue_ion_cube'
          : y > top + 8 && v < .035 ? 'bulterite'
          : y > top + 4 && v < .06 ? 'ion_cube'
          : v < .14 ? 'metal'
          : v < .2 ? 'ice'
          : v < .235 ? 'crystal'
          : 'stone';
      }
    }
    terrains.set(m.id, map);
    return map;
  }
  function tile(x, y) {
    if (x < 0 || x >= cols || y >= rows)
      return 'stone';
    if (y < 0)
      return null;
    return (surface?.[y]?.[x]) || null;
  }
  function setSurfaceUI(on) {
    document.body.classList.toggle('on-surface', on);
    $('#surfaceHud').hidden = !on;
    $('#landingPrompt').hidden = true;
    if (on)
      $('#moonName').textContent = I18n.t(`${ activeMoon.name.toUpperCase() } / SURFACE`);
    renderHotbar();
  }
  function land() {
    if (surface) {
      if (Math.hypot(player.x - 12, player.y - 14) < 4)
        launch();
      else
        notify(I18n.t('RETURN TO THE SHIP TO LAUNCH'));
      return;
    }
    const m = nearestMoon();
    if (!m)
      return;
    if (Math.hypot(ship.vx, ship.vy) > 160) {
      notify(I18n.t('REDUCE SPEED BELOW 160 m/s TO LAND'));
      return;
    }
    activeMoon = m;
    surface = terrainFor(m);
    player.x = 14;
    player.y = 14;
    player.vy = 0;
    ship.vx = ship.vy = 0;
    keys.clear();
    setSurfaceUI(true);
    save();
    GameAudio.play('land');
    notify(I18n.t('LANDED · MINE REGOLITH AND BUILD YOUR FIRST OUTPOST'));
  }
  function launch() {
    const m = activeMoon;
    ship.x = m.x;
    ship.y = m.y - m.r - 90;
    ship.vx = ship.vy = 0;
    ship.invulnerable = 3;
    surface = null;
    activeMoon = null;
    keys.clear();
    setSurfaceUI(false);
    save();
    GameAudio.play('launch');
    notify(I18n.t('LIFTOFF · YOUR BASE IS SAVED'));
  }
  function rect(x, y, w, h, col) {
    tri([x, y], [x + w, y], [x, y + h], col);
    tri([x + w, y], [x + w, y + h], [x, y + h], col);
  }
  function renderMoons(screen) {
    for (const m of localMoons()) {
      const [x, y] = screen(m.x, m.y);
      if (x < -m.r - 50 || x > width + m.r + 50 || y < -m.r - 50 || y > height + m.r + 50)
        continue;
      disc(x, y, m.r + 12, [.3, .55, .65, .035], 50);
      disc(x, y, m.r, [.18, .23, .27, 1], 48);
      const rng = random(Math.round(m.x));
      for (let i = 0; i < 22; i++) {
        const a = rng() * 6.28,
          rr = Math.sqrt(rng()) * m.r * .8,
          c = 8 + rng() * m.r * .13;
        disc(x + Math.cos(a) * rr, y + Math.sin(a) * rr, c, [.08, .12, .16, .4], 10);
      }
      for (let i = 0; i < 48; i++) {
        const a = i / 48 * 6.28,
          b = (i + 1) / 48 * 6.28;
        line([x + Math.cos(a) * m.r, y + Math.sin(a) * m.r], [x + Math.cos(b) * m.r, y + Math.sin(b) * m.r], [.48, .66, .7, .2]);
      }
      const px = x,
        py = y - m.r - 18;
      line([px - 9, py], [px + 9, py], [.86, .71, .47, .9], 2);
      line([px, py - 8], [px, py + 8], [.86, .71, .47, .9], 2);
    }
  }
  function validQuickSlot(index) {
    return Number.isInteger(index) && index >= 0 && index < 6;
  }

  function canPlace(type) {
    return type === 'stone' || items[type]?.place === true;
  }

  // Quick slots are item-type references, never a second set of inventory stacks.
  function updateQuickBuild() {
    const type = hotbar[activeQuickSlot];
    buildType = canPlace(type) ? type : null;
  }

  function refreshQuickInventory(focusIndex = activeQuickSlot) {
    updateQuickBuild();
    renderHotbar();
    save();
    if (!$('#overlay').hidden) {
      renderInventory();
      $('#quickInventory [data-quick-slot="' + focusIndex + '"]').focus();
    }
  }

  function assignQuickSlot(index, type) {
    if (!validQuickSlot(index) || (type !== null && !Object.hasOwn(items, type))) return false;
    hotbar[index] = type;
    refreshQuickInventory(index);
    return true;
  }

  function swapQuickSlots(from, to) {
    if (!validQuickSlot(from) || !validQuickSlot(to)) return false;
    [hotbar[from], hotbar[to]] = [hotbar[to], hotbar[from]];
    refreshQuickInventory(to);
    return true;
  }

  function applyQuickDrop(index, payload) {
    if (!payload || typeof payload !== 'object') return false;
    if (payload.kind === 'quick') return swapQuickSlots(payload.slot, index);
    if (payload.kind === 'item') return assignQuickSlot(index, payload.type);
    return false;
  }

  // Selecting in the editor changes only the active shortcut. Surface use may
  // also refuel or equip a weapon; raw materials can never become terrain tiles.
  function selectQuickSlot(index, use = false) {
    if (!validQuickSlot(index)) return false;
    activeQuickSlot = index;
    updateQuickBuild();
    const type = hotbar[index];
    if (use && type) {
      if (items[type].fuel) refuel(type);
      else if (items[type].weapon) Weapons.select(type);
    }
    renderHotbar();
    save();
    return true;
  }

  function quickSlotMarkup(type, index, editor = false) {
    const name = type ? items[type].name : I18n.t('Empty quick slot');
    return `<button class="item-slot quick-slot ${activeQuickSlot === index ? 'selected' : ''} ${type && !count(type) ? 'out-of-stock' : ''}"
      ${editor ? 'data-quick-slot' : 'data-quick-use'}="${index}"
      draggable="${editor && !!type}" aria-pressed="${activeQuickSlot === index}"
      aria-label="${I18n.t('Quick slot')} ${index + 1}: ${name}" title="${name}">
      <em class="quick-slot-key">${index + 1}</em>
      ${type ? icon(type) + '<small>' + count(type) + '</small>' : '<span class="cell-plus">+</span>'}
      <span class="item-name">${name}</span>
    </button>`;
  }

  function renderQuickInventory() {
    $('#slots .bag-grid').insertAdjacentHTML('afterend', `
      <section class="quick-inventory-editor" aria-label="${I18n.t('Quick inventory')}">
        <div class="inventory-label">${I18n.t('QUICK INVENTORY')} <span>${I18n.t('SURFACE SHORTCUTS 1–6')}</span></div>
        <div id="quickInventory" class="quick-inventory-grid">
          ${hotbar.map((type, index) => quickSlotMarkup(type, index, true)).join('')}
        </div>
        <p class="quick-inventory-hint">${I18n.t('Select a stack, then click a quick slot or press 1–6 to assign it. Right click a slot to clear. Drag items here, or drag slots to swap. Shortcuts do not move items out of your bag.')}</p>
      </section>
    `);
    $('#quickInventory').querySelectorAll('[data-quick-slot]').forEach(button => {
      const index = Number(button.dataset.quickSlot);
      button.onclick = () => {
        const type = focusedStack()?.type;
        if (type) assignQuickSlot(index, type);
        else {
          selectQuickSlot(index);
          renderInventory();
        }
      };
      button.oncontextmenu = event => {
        event.preventDefault();
        assignQuickSlot(index, null);
      };
      button.ondragstart = event => {
        if (!hotbar[index] || carried) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData(quickDragType, JSON.stringify({ kind: 'quick', slot: index }));
        event.dataTransfer.effectAllowed = 'move';
      };
      button.ondragover = event => {
        if (Array.from(event.dataTransfer.types).includes(quickDragType)) event.preventDefault();
      };
      button.ondrop = event => {
        event.preventDefault();
        try {
          applyQuickDrop(index, JSON.parse(event.dataTransfer.getData(quickDragType)));
        } catch {
          // Foreign or incomplete drag data cannot alter the shortcut configuration.
        }
      };
    });
  }

  function renderHotbar() {
    if (!$('#hotbar')) return;
    $('#hotbar').innerHTML = hotbar.map((type, index) => quickSlotMarkup(type, index)).join('');
    $('#hotbar').querySelectorAll('[data-quick-use]').forEach(button => {
      button.onclick = () => {
        if (!paused) selectQuickSlot(Number(button.dataset.quickUse), true);
      };
    });
  }

  // Bind number keys to assignment only in the inventory, not in stacked dialogs.
  function handleQuickInventoryKeys(event) {
    if (event.repeat || !/^Digit[1-6]$/.test(event.code) || !paused || $('#overlay').hidden) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    if (typeof Encyclopedia !== 'undefined' && Encyclopedia.isOpen) return;
    if (typeof QuestLog !== 'undefined' && QuestLog.isOpen) return;
    if (typeof StarChart !== 'undefined' && StarChart.mapOpen) return;
    const shipPicker = $('#shipyardOverlay');
    if (shipPicker && !shipPicker.hidden) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    const index = Number(event.code.slice(-1)) - 1;
    const type = focusedStack()?.type;
    if (type) assignQuickSlot(index, type);
    else {
      selectQuickSlot(index);
      renderInventory();
    }
  }
  addEventListener('keydown', handleQuickInventoryKeys, { capture: true });

  function camera() {
    return {
      x: player.x * tileSize - width / 2,
      y: player.y * tileSize - height * .52
    };
  }
  function target() {
    const cam = camera();
    return {
      x: Math.floor((pointer.x + cam.x) / tileSize),
      y: Math.floor((pointer.y + cam.y) / tileSize)
    };
  }

  // Check both distance and line of sight so mining cannot pass through solid tiles.
  function inReach(x, y) {
    const sx = player.x,
      sy = player.y - .75,
      dx = x + .5 - sx,
      dy = y + .5 - sy,
      d = Math.hypot(dx, dy);
    if (d > 4.5 || x < 0 || x >= cols || y < 0 || y >= rows)
      return false;
    for (let t = .15; t < d - .6; t += .15) {
      const xx = Math.floor(sx + dx / d * t),
        yy = Math.floor(sy + dy / d * t);
      if (xx === x && yy === y)
        break;
      if (tile(xx, yy))
        return false;
    }
    return true;
  }
  function intersectsPlayer(x, y) {
    return x < player.x + .3 && x + 1 > player.x - .3 && y < player.y && y + 1 > player.y - 1.5;
  }

  // Shared mining/building path: protect the landing pad, check tools and capacity,
  // then update terrain, base metadata, quest progress, and the save.
  function editTile(x, y, placing) {
    if (!surface || paused || !inReach(x, y))
      return false;
    const existing = tile(x, y);
    if (!placing) {
      if (!existing)
        return false;
      if (existing === 'blue_ion_cube' && !['laser', 'mininglaser', 'fotron', 'piercer', 'seismic'].some(Weapons.unlocked)) {
        notify(I18n.t('ADVANCED CUTTER REQUIRED'));
        return false;
      }
      if (existing === 'bulterite' && !Weapons.unlocked('fotron') && !Weapons.unlocked('seismic')) {
        notify(I18n.t('ADVANCED CUTTER REQUIRED · FOTRON / SEISMIC'));
        return false;
      }
      if (x >= 10 && x <= 13 && y === 14 || y === rows - 1) {
        notify(I18n.t('LANDING PAD / BEDROCK · CANNOT MINE'));
        return false;
      }
      if (!addItem(existing, 1)) {
        notify(I18n.t('INVENTORY FULL'));
        return false;
      }
      surface[y][x] = null;
    } else {
      if (!canPlace(buildType) || existing || intersectsPlayer(x, y) || !count(buildType))
        return false;
      if (x >= 10 && x <= 13 && y >= 11 && y <= 14 || x === 14 && y >= 12 && y <= 13) {
        notify(I18n.t('KEEP THE LANDING PAD CLEAR'));
        return false;
      }
      if (![
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1]
        ].some(([a, b]) => tile(a, b)))
        return false;
      remove(bag, buildType, 1);
      surface[y][x] = buildType;
      sync();
    }
    if (baseParts.includes(placing ? buildType : existing))
      indexBase(activeMoon.id, surface);
    if (!placing)
      recordMined(existing, 1, false);
    save();
    if (typeof QuestLog !== 'undefined')
      QuestLog.refresh();
    GameAudio.play(placing ? 'build' : 'mine');
    return true;
  }
  function collides(x, y) {
    for (let xx = Math.floor(x - .29); xx <= Math.floor(x + .29); xx++)
      for (let yy = Math.floor(y - 1.49); yy <= Math.floor(y - .01); yy++)
        if (tile(xx, yy))
          return true;
    return false;
  }

  // Resolve movement in short steps so the explorer cannot tunnel through tile walls.
  function move(axis, delta) {
    const steps = Math.ceil(Math.abs(delta) / .15) || 1;
    for (let i = 0; i < steps; i++) {
      const value = delta / steps,
        nx = player.x + (axis === 'x' ? value : 0),
        ny = player.y + (axis === 'y' ? value : 0);
      if (collides(nx, ny)) {
        if (axis === 'y') {
          if (delta > 0)
            player.grounded = true;
          player.vy = 0;
        }
        break;
      }
      player.x = nx;
      player.y = ny;
    }
  }

  // Surface movement uses tile coordinates; flight fuel is deliberately not consumed here.
  function updateSurface(dt) {
    time += dt;
    toastTimer -= dt;
    $('#toast').style.opacity = toastTimer > 0 ? 1 : 0;
    miningClock -= dt;
    const direction = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
    move('x', direction * 5 * dt);
    if ((keys.has('Space') || keys.has('KeyW') || keys.has('ArrowUp')) && player.grounded) {
      player.vy = -8;
      player.grounded = false;
    }
    player.vy = Math.min(15, player.vy + 14 * dt);
    player.grounded = false;
    move('y', player.vy * dt);
    if (pointer.down && miningClock <= 0) {
      const t = target();
      editTile(t.x, t.y, false);
      miningClock = .25;
    }
    const atShip = Math.hypot(player.x - 12, player.y - 14) < 4;
    $('#landingPrompt').hidden = !atShip;
    $('#landingText').textContent = I18n.t(`${ Shipyard.current.name.toUpperCase() } · LANDING PAD`);
    $('#land').textContent = I18n.t('LAUNCH [E]');
    $('#land').disabled = false;
    saveClock += dt;
    if (saveClock > 5) {
      save();
      saveClock = 0;
    }
  }
  const tileColors = {
    ion_cube: [.18, .57, .3],
    blue_ion_cube: [.19, .4, .72],
    bulterite: [.25, .43, .32],
    stone: [.26, .29, .32],
    metal: [.42, .32, .26],
    ice: [.32, .52, .61],
    crystal: [.46, .34, .58],
    block: [.37, .46, .49],
    bench: [.52, .38, .24],
    furnace: [.34, .34, .36],
    glass: [.3, .53, .62],
    lamp: [.8, .67, .36]
  };

  // Draw only visible tiles. Convert tile coordinates to pixels at the camera boundary.
  function renderSurface() {
    vertices = [];
    gl.clearColor(.025, .043, .075, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const cam = camera();
    for (const s of stars.slice(0, 220)) {
      const x = mod(s.x - cam.x * .1, width),
        y = mod(s.y - cam.y * .1, height);
      disc(x, y, s.size, [.7, .8, .9, s.alpha], 4);
    }
    disc(width * .8 - cam.x * .015, 130, 58, [.21, .33, .39, 1], 40);
    disc(width * .8 + 20 - cam.x * .015, 112, 50, [.025, .043, .075, 1], 40);
    for (let y = Math.max(0, Math.floor(cam.y / tileSize)); y < Math.min(rows, Math.ceil((cam.y + height) / tileSize)); y++)
      for (let x = Math.max(0, Math.floor(cam.x / tileSize)); x < Math.min(cols, Math.ceil((cam.x + width) / tileSize)); x++) {
        const t = tile(x, y);
        if (!t)
          continue;
        const sx = x * tileSize - cam.x,
          sy = y * tileSize - cam.y,
          c = tileColors[t],
          v = .85 + random(x * 781 + y * 318)() * .2;
        rect(sx, sy, 32, 32, [c[0] * v, c[1] * v, c[2] * v, t === 'glass' ? .45 : 1]);
        line([sx, sy], [sx + 32, sy], [.75, .8, .83, .15], 2);
        line([sx, sy], [sx, sy + 32], [.8, .8, .9, .07]);
        line([sx, sy + 31], [sx + 32, sy + 31], [0, 0, 0, .24], 2);
        if (['metal', 'ice', 'crystal', 'bulterite', 'ion_cube', 'blue_ion_cube'].includes(t)) {
          disc(sx + 10, sy + 12, 4, [c[0] * 1.6, c[1] * 1.6, c[2] * 1.6, 1], 5);
          disc(sx + 22, sy + 22, 3, [c[0] * 1.4, c[1] * 1.4, c[2] * 1.4, 1], 4);
        }
        if (t === 'bench') {
          rect(sx + 3, sy + 6, 26, 6, [.7, .5, .3, 1]);
          rect(sx + 6, sy + 12, 4, 17, [.25, .2, .16, 1]);
          rect(sx + 22, sy + 12, 4, 17, [.25, .2, .16, 1]);
        }
        if (t === 'furnace') {
          rect(sx + 7, sy + 12, 18, 14, [.07, .09, .1, 1]);
          rect(sx + 11, sy + 19, 10, 5, [1, .45, .15, .8]);
        }
        if (t === 'lamp') {
          disc(sx + 16, sy + 14, 23, [1, .8, .35, .07]);
          disc(sx + 16, sy + 14, 7, [1, .85, .5, 1]);
        }
        if (t === 'glass')
          rect(sx + 4, sy + 4, 2, 24, [.6, .85, .95, .4]);
      }
    // Parked ship and suited explorer share the same WebGL renderer as space flight.
    const bx = 12 * 32 - cam.x,
      by = 14 * 32 - cam.y;
    Shipyard.drawFlightShip(bx, by - 34, 0, 1, 1.4);
    rect(bx - 35, by - 3, 70, 3, [.74, .62, .42, 1]);
    const px = player.x * 32 - cam.x,
      py = player.y * 32 - cam.y;
    rect(px - 9, py - 31, 18, 23, [.69, .74, .72, 1]);
    rect(px - 8, py - 9, 6, 9, [.35, .44, .5, 1]);
    rect(px + 2, py - 9, 6, 9, [.35, .44, .5, 1]);
    disc(px, py - 38, 10, [.77, .8, .77, 1], 10);
    rect(px - 7, py - 42, 14, 8, [.23, .43, .55, 1]);
    rect(px - 14, py - 30, 5, 17, [.44, .53, .56, 1]);
    const t = target(),
      sx = t.x * 32 - cam.x,
      sy = t.y * 32 - cam.y,
      col = inReach(t.x, t.y) ? [.9, .75, .45, .8] : [.7, .4, .4, .35];
    for (const [a, b] of [
        [
          [sx, sy],
          [sx + 32, sy]
        ],
        [
          [sx + 32, sy],
          [sx + 32, sy + 32]
        ],
        [
          [sx + 32, sy + 32],
          [sx, sy + 32]
        ],
        [
          [sx, sy + 32],
          [sx, sy]
        ]
      ])
      line(a, b, col, 1.5);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);
  }
  canvas.addEventListener('pointermove', e => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  });
  canvas.addEventListener('pointerdown', e => {
    if (!surface || paused)
      return;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    const t = target();
    if (e.button === 0) {
      pointer.down = true;
      editTile(t.x, t.y, false);
      miningClock = .25;
    }
    if (e.button === 2)
      editTile(t.x, t.y, true);
  });
  addEventListener('pointerup', () => pointer.down = false);
  addEventListener('blur', () => pointer.down = false);
  addEventListener('pointermove', e => {
    cursor.hidden = !carried || $('#overlay').hidden || !(e.target.closest?.('#slots'));
    if (!cursor.hidden) {
      cursor.style.left = `${ Math.min(e.clientX + 14, innerWidth - 55) }px`;
      cursor.style.top = `${ Math.min(e.clientY + 14, innerHeight - 55) }px`;
    }
  });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  addEventListener('keydown', e => {
    if (e.repeat || paused || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))
      return;
    if (e.code === 'KeyE') {
      if (!surface && typeof StarChart !== 'undefined' && StarChart.nearbyPortal())
        return;
      if (surface) {
        const found = nearbyStations();
        if (Math.hypot(player.x - 12, player.y - 14) < 4) {
          land();
          return;
        }
        station = found.has('bench') ? 'bench' : found.has('furnace') ? 'furnace' : 'hand';
        grid = Array(station === 'bench' ? 9 : 4).fill(null);
        showPanel();
      } else
        land();
    }
    if (surface && /^Digit[1-6]$/.test(e.code)) {
      selectQuickSlot(Number(e.code.slice(-1)) - 1, true);
    }
  });
  $('#land').onclick = () => {
    if (!paused)
      land();
  };
  addEventListener('beforeunload', save);
  if (!load()) {
    addItem('ion_cube', 2);
    addItem('ammo_rockbreaker', 8);
    addItem('stone', 12);
    addItem('metal', 6);
    addItem('ice', 4);
    addItem('crystal', 2);
    addItem('bench', 1);
    addItem('block', 12);
    notify(I18n.t('STARTER SUPPLIES LOADED · SELENE IS NORTHEAST · E TO LAND'));
  }
  rebuildBaseIndex();
  sync();
  save();
  if (carried)
    queueMicrotask(() => showPanel());
  return {
    get onSurface() {
      return !!surface;
    },
    addItem,
    openInventory,
    updateSpace,
    renderMoons,
    updateSurface,
    renderSurface,
    // Small public model API for deterministic gameplay checks and future extensions.
    get cargoMass() {
      return cargoMass();
    },
    resizeCargo,
    assignQuickSlot,
    swapQuickSlots,
    applyQuickDrop,
    selectQuickSlot,
    get quickSlots() { return [...hotbar]; },
    get activeQuickSlot() { return activeQuickSlot; },
    get selectedBuild() { return buildType; },
    refuel,
    refuelBest,
    count: ownedCount,
    availableCount: count,
    consumeItem,
    craft,
    recipes,
    items,
    recordMined,
    questProgress,
    claimQuest,
    land,
    launch,
    editTile,
    closeInventory,
    getMoons: localMoons,
    getBases,
    get bag() {
      return bag;
    },
    get player() {
      return player;
    },
    get surface() {
      return surface;
    },
    get station() {
      return station;
    },
    selectRecipe(index) {
      const r = recipes[index];
      if (!r || !nearbyStations().has(r.station))
        return false;
      station = r.station;
      grid = [...r.pattern];
      return true;
    },
    selectBuild(type) {
      const index = hotbar.indexOf(type);
      if (index >= 0 && canPlace(type)) selectQuickSlot(index);
    },
    save
  };
})();

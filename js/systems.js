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

  Object.assign(items, {
    resource_scanner:{name:I18n.language === 'cs' ? 'Skener surovin' : 'Resource Scanner',asset:'scanner.png',color:'#9af0c8',machine:true,weight:3,description:I18n.language === 'cs' ? 'V nakladu odhali vzacne suroviny na mesicich celeho mistniho systemu. Otevrete mistni mapu [M].' : 'Carry in cargo to reveal remaining rare resources on every moon in the current system. Open the local map [M] and select a moon for depth readings.'},
    shield_generator: {name: I18n.t('Shield Generator Mk I'), asset: 'shield_generator.svg', shield: true, shieldTier: 1, machine: true, weight: 5, description: I18n.language === 'cs' ? 'Generátor modrého štítu: 35 bodů, obnova 1,5 bodu/s po 5 sekundách bez zásahu. Nasaďte do slotu štítu.' : 'Blue shield generator: 35 points, regenerates 1.5 points/s after 5 seconds without a hit. Equip in the shield socket.'},
    shield_generator_advanced: {name: I18n.t('Shield Generator Mk II'), asset: 'shield_generator_advanced.svg', shield: true, shieldTier: 2, machine: true, weight: 7, description: I18n.language === 'cs' ? 'Pokročilý generátor: 65 bodů štítu, obnova 3 body/s po 4 sekundách bez zásahu. Výroba spotřebuje Mk I.' : 'Advanced generator: 65 shield points, regenerates 3 points/s after 4 seconds without a hit. Crafting consumes a Mk I.'},
    shield_generator_ion: {name: I18n.t('Ion Shield Generator'), asset: 'shield_generator_ion.svg', shield: true, shieldTier: 3, machine: true, weight: 9, description: I18n.language === 'cs' ? 'Iontový generátor: 100 bodů štítu, obnova 5 bodů/s po 3 sekundách bez zásahu. Výroba spotřebuje Mk II.' : 'Ion generator: 100 shield points, regenerates 5 points/s after 3 seconds without a hit. Crafting consumes a Mk II.'}
  });

  items.portable_workbench = {
    name: I18n.language === 'cs' ? 'Přenosný pracovní stůl' : 'Portable Workbench',
    asset: 'portable_workbench.svg', machine: true, weight: 8,
    description: I18n.language === 'cs'
      ? 'Pokročilá skládací dílna. V hlavním inventáři zpřístupní výrobu 3×3 i ve vesmíru. Nevyžaduje umístění a nespotřebovává se. Nenahrazuje pec ani nezakládá základnu. Výroba trvá 22,5 sekundy.'
      : 'Advanced folding workshop. Carry in your main inventory to unlock 3×3 workbench crafting even in space. Reusable without placement. Does not provide smelting or establish a base. Takes 22.5 seconds to craft.'
  };
  Object.assign(items, {
    storage_small: {name:I18n.language==='cs'?'Malá bedna':'Small Storage Crate',asset:'storage_small.svg',place:true,color:'#ae9974',storageSlots:8,weight:4,description:I18n.language==='cs'?'Postavte na měsíci. 8 slotů pro předměty; otevřete přes E nebo sklad v inventáři.':'Build on a moon. Holds 8 item stacks; open with E or Storage in inventory.'},
    storage_medium: {name:I18n.language==='cs'?'Nákladní kontejner':'Cargo Container',asset:'storage_medium.svg',place:true,color:'#7dabb4',storageSlots:20,weight:8,description:I18n.language==='cs'?'Postavitelný kontejner s 20 sloty. Obsah zůstává na měsíci a zachovává limity zásobníků.':'Buildable container with 20 slots. Contents stay on the moon and respect normal stack limits.'},
    storage_large: {name:I18n.language==='cs'?'Zesílený sklad':'Reinforced Storage Vault',asset:'storage_large.svg',place:true,color:'#8ba287',storageSlots:40,weight:14,description:I18n.language==='cs'?'Pokročilý sklad se 40 sloty. Před rozebráním jej vyprázdněte.':'Advanced base storage with 40 slots. Empty it before dismantling.'}
  });
  Object.assign(items, {
    titanium_ore:{name:I18n.language==='cs'?'Titanová ruda':'Titanium Ore',asset:'titanium_ore.svg',color:'#91b8c9',weight:3,moonOre:true,description:I18n.language==='cs'?'Vzácná ruda v podzemních žilách pouze na měsících. Dva kusy se v peci přetaví na titanový ingot.':'Rare ore found only in underground moon veins. Smelt two pieces in a furnace to produce a titanium ingot.'},
    cobalt_ore:{name:I18n.language==='cs'?'Kobaltová ruda':'Cobalt Ore',asset:'cobalt_ore.svg',color:'#5279d4',weight:4,moonOre:true,description:I18n.language==='cs'?'Modrá ruda z hlubších měsíčních žil. Dva kusy vytvoří kobaltový ingot pro pokročilou slitinu a účinnější munici.':'Blue ore in deeper moon veins. Smelt two pieces into a cobalt ingot for advanced alloy and efficient ammunition batches.'},
    iridium_ore:{name:I18n.language==='cs'?'Iridiová ruda':'Iridium Ore',asset:'iridium_ore.svg',color:'#ce9bd5',weight:7,moonOre:true,advancedCutter:true,description:I18n.language==='cs'?'Velmi vzácná ruda hluboko na některých měsících. Těžba vyžaduje pokročilý řezák. Dva kusy vytvoří iridiový ingot.':'Very rare ore deep beneath some moons. Requires an advanced cutter to mine. Smelt two pieces into an iridium ingot.'},
    titanium_ingot:{name:I18n.language==='cs'?'Titanový ingot':'Titanium Ingot',asset:'titanium_ingot.svg',color:'#b2d0da',weight:4,description:I18n.language==='cs'?'Rafinovaný titan z měsíční rudy. V peci vytvoří tři pláty trupu, nebo jej použijte do pokročilé slitiny.':'Refined titanium from moon ore. Forge three hull plates in a furnace, or use it to craft advanced alloy.'},
    cobalt_ingot:{name:I18n.language==='cs'?'Kobaltový ingot':'Cobalt Ingot',asset:'cobalt_ingot.svg',color:'#7098e2',weight:5,description:I18n.language==='cs'?'Rafinovaný kobalt pro pokročilou slitinu a větší dávky munice Bulšitru a Fotronu. Vyrábí se v peci.':'Refined cobalt for advanced alloy and larger Bulshitter/Fotron ammunition batches. Produced in a furnace.'},
    iridium_ingot:{name:I18n.language==='cs'?'Iridiový ingot':'Iridium Ingot',asset:'iridium_ingot.svg',color:'#d4b6df',weight:9,description:I18n.language==='cs'?'Hustý ingot z hlubinné měsíční rudy. Používá se do pokročilé slitiny a účinných fotronových článků.':'Dense ingot refined from deep lunar ore. Used in advanced alloy and efficient Fotron charge-cell batches.'},
    advanced_alloy:{name:I18n.language==='cs'?'Pokročilá slitina':'Advanced Alloy',asset:'advanced_alloy.svg',color:'#9fcbb5',weight:6,description:I18n.language==='cs'?'Slitina titanu, kobaltu a iridia. Alternativní surovina pro generátor štítu Mk II a přenosnou dílnu.':'Alloy of titanium, cobalt and iridium. An alternative crafting material for Mk II shields and portable workbenches.'}
  });
  Object.assign(items,{
    portable_furnace:{name:I18n.language==='cs'?'Přenosná pec':'Portable Furnace',asset:'portable_furnace.svg',machine:true,weight:10,color:'#d49d72',
      description:I18n.language==='cs'?'Pec v hlavním nákladu zpřístupní tavení i ve vesmíru. Má vlastní frontu lodi, souběžnou s přenosnou dílnou. Nespotřebovává se.':'Carry in main cargo to smelt even in space. Uses a separate ship furnace queue alongside the portable workbench. Reusable.'},
    fuel_optimizer:{name:I18n.language==='cs'?'Optimalizátor paliva':'Fuel Optimizer',asset:'fuel_optimizer.svg',machine:true,weight:5,color:'#82c8ae',
      description:I18n.language==='cs'?'V hlavním nákladu sníží spotřebu paliva při tahu i zrychlení o 15 %. Kombinuje se s bonusem inženýra. Další kusy bonus nezvyšují.':'Carry in main cargo for 15% less thrust and boost fuel consumption. Combines with the engineer bonus. Additional units do not stack.'},
    repair_controller:{name:I18n.language==='cs'?'Servisní manipulátor':'Repair Controller',asset:'repair_controller.svg',machine:true,weight:6,color:'#a3c5d7',
      description:I18n.language==='cs'?'V hlavním nákladu zvýší účinek opravné sady z 20 na 30 % trupu. Opravné sady se stále spotřebovávají. Další kusy bonus nezvyšují.':'Carry in main cargo to improve repair packs from 20 to 30 hull points. Still consumes one pack. Additional controllers do not stack.'}
  });
  // All new weapons and ammunition use the shared cargo and recipe model.
  Object.assign(items, {
    plasma:{name:I18n.language==='cs'?'Plazmová brokovnice':'Plasma Scattergun',asset:'plasma.svg',color:'#ed8fb6',weight:8,weapon:true,description:I18n.language==='cs'?'Sedm plazmových střel na krátkou vzdálenost. Rozbíjí zpevněné skály bez munice.':'Seven short-range energy bolts per volley. Breaks reinforced rocks without ammunition.'},
    railgun:{name:I18n.language==='cs'?'Elektromagnetický kanón':'Rail Cannon',asset:'railgun.svg',color:'#b2e5ff',weight:8,weapon:true,description:I18n.language==='cs'?'Pomalý kanón s rychlou střelou proti obrněným cílům a ultrahustým skalám. Jeden projektil na výstřel.':'A slow-firing high-velocity cannon for armoured targets and ultradense rocks. Consumes one rail slug per shot.'},
    cluster:{name:I18n.language==='cs'?'Salvový raketomet':'Cluster Launcher',asset:'cluster.svg',color:'#f6b575',weight:8,weapon:true,description:I18n.language==='cs'?'Tři výbušné rakety do vějíře. Jeden svazek na salvu; výbuchy poškozují okolní cíle i rezonanční skály.':'Fires three explosive missiles in a fan. One pod per volley; each blast damages nearby targets. Breaks resonant rocks.'},
    ammo_railgun:{name:I18n.language==='cs'?'EM projektily':'Rail Slugs',asset:'ammo_railgun.svg',color:'#b2e5ff',weight:1,ammoFor:'railgun',description:I18n.language==='cs'?'Iridiová munice pro elektromagnetický kanón. Jeden projektil na výstřel; v dílně vyrobíte dvanáct kusů.':'Dense iridium ammunition for the Rail Cannon. One slug per shot; craft twelve at a workbench.'},
    ammo_cluster:{name:I18n.language==='cs'?'Raketové svazky':'Cluster Missile Pods',asset:'ammo_cluster.svg',color:'#f6b575',weight:1,ammoFor:'cluster',description:I18n.language==='cs'?'Jednorázový svazek tří raket. Jeden na celou salvu; v dílně vyrobíte čtyři kusy.':'A disposable three-missile pod. One pod fires the entire volley; craft four at a workbench.'}
  });
  // Placed support buildings use the persistent moon construction index.
  Object.assign(items, {
    repair_station:{name:I18n.language==='cs'?'Opravárenská stanice':'Repair Station',asset:'repair_station.svg',place:true,color:'#86cfae',weight:12,description:I18n.language==='cs'?'Opraví 20 bodů trupu každých 5 sekund na měsíci nebo na pomalé nízké orbitě. Spotřebuje jeden železný ingot z nákladu. Vyžaduje postavenou dílnu; bonus se nesčítá.':'Repairs 20 hull every 5 seconds at this moon or in slow low orbit. Consumes one iron ingot from ship cargo per repair. Requires a placed workbench. Multiple stations do not stack.'},
    solar_array:{name:I18n.language==='cs'?'Solární elektrárna':'Solar Array',asset:'solar_array.svg',place:true,color:'#729fdf',weight:12,description:I18n.language==='cs'?'Doplňuje jednu jednotku paliva za sekundu na základně nebo na pomalé nízké orbitě. Bez spotřeby palivových předmětů. Vyžaduje postavenou dílnu; bonus se nesčítá.':'Recharges one ship fuel unit per second at this base or in slow low orbit, without consuming fuel items. Requires a placed workbench. Multiple arrays do not stack.'},
    fabrication_hub:{name:I18n.language==='cs'?'Výrobní centrum':'Fabrication Hub',asset:'fabrication_hub.svg',place:true,color:'#d8b47c',weight:12,description:I18n.language==='cs'?'Zrychlí fronty dílny a pece tohoto měsíce o 50 %, pokud jste připojeni. Neovlivňuje přenosné ani vzdálené fronty. Vyžaduje postavenou dílnu; bonus se nesčítá.':'Speeds up this moon workbench and furnace queues by 50% while connected. Does not accelerate portable or remote queues. Requires a placed workbench. Multiple hubs do not stack.'}
  });
  items.repair_pack = {name: I18n.t('Repair Pack'), asset: 'repair_pack.svg', color: '#9ae0bb', repair: 20, weight: 2, description: I18n.t('Restores up to 20% ship hull. Use from inventory, a quick slot or U during play. Not consumed at full hull. Craft at a workbench; takes 4 seconds.')};
  items.ammo_fotron = {name: I18n.t('Fotron charge cells'), asset: 'ammo_fotron.svg', color: '#78e8c0', ammoFor: 'fotron', description: I18n.t('Special Fotron ammunition. One cell per shot; craft at a workbench from crystals, an Ion Cube and Bulterite.')};
  items.ammo_bulshitter = {name: I18n.t('Bulshitter cartridges'), asset: 'ammo_bulshitter.svg', color: '#e7b767', ammoFor: 'bulshitter', description: I18n.t('Special scatter ammunition. One cartridge fires the whole five-shot volley. Craft at a workbench from iron ingots and ore.')};
  // Every catalogue entry has a description; keep it next to the shared item model.
  const itemDescriptions = {
    "stone": "Common moon regolith. Mine it near the surface and use it to make base blocks, workbenches and furnaces.",
    "metal": "Iron-bearing ore found in asteroids and moon deposits. Smelt it in a furnace to produce iron ingots.",
    "ice": "Frozen water found in asteroids and moon deposits. Used for fuel cells, glass and premium fuel recipes.",
    "crystal": "Crystalline mineral used in advanced weapons, scanners and Ion Cubes. Mine deposits or recover it from pirate salvage.",
    "ingot": "Refined iron produced by smelting ore in a furnace. A basic component for equipment, ammunition and hull plates.",
    "plate": "Structural hull plating. Craft it from iron at a workbench, or forge durable plates with Bulterite in a furnace.",
    "block": "A simple construction block made from regolith. Build an outpost on a moon; add a placed workbench to establish a base.",
    "bench": "Place on a moon to unlock its 3×3 crafting grid anywhere on that surface or from low orbit. A placed workbench makes that moon count as a base.",
    "furnace": "Place on a moon to unlock smelting anywhere on that surface or from low orbit. Refines iron ore and makes glass, fuel cells and durable hull plates.",
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
  items.fotron.description += I18n.t(' Requires Fotron charge cells.');
  items.bulshitter.description += I18n.t(' Requires Bulshitter cartridges; one per volley.');
  const stackLimits = {
    repair_station:4, solar_array:4, fabrication_hub:4,
    plasma:1, railgun:1, cluster:1, ammo_railgun:24, ammo_cluster:8,
    portable_furnace:1, fuel_optimizer:1, repair_controller:1,
    titanium_ore:32, cobalt_ore:24, iridium_ore:12,
    titanium_ingot:16, cobalt_ingot:16, iridium_ingot:8, advanced_alloy:16,
    storage_small: 4, storage_medium: 2, storage_large: 1,
    portable_workbench: 1,
    shield_generator: 1,
    shield_generator_advanced: 1,
    shield_generator_ion: 1,
    repair_pack: 8,
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
    ammo_fotron: 32,
    ammo_bulshitter: 128,
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
      crystal: 0,
      bulterite: 0, titanium_ore: 0, cobalt_ore: 0, iridium_ore: 0
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
  recipes.push({station: 'bench', name: I18n.t('Fotron charge cells'), pattern: ['crystal', 'ion_cube', 'crystal', null, 'bulterite', null, null, null, null], out: 'ammo_fotron', qty: 24},
    {station: 'bench', name: I18n.t('Bulshitter cartridges'), pattern: ['ingot', 'metal', 'ingot', null, null, null, null, null, null], out: 'ammo_bulshitter', qty: 80});

  recipes.push({station: 'bench', name: I18n.t('Repair Pack'), pattern: ['plate', 'ingot', null, null, 'ice', null, null, null, null], out: 'repair_pack', qty: 1});

  recipes.push(
    {station: 'bench', name: items.shield_generator.name, pattern: ['ingot', 'crystal', 'ingot', 'plate', 'ion_cube', 'plate', null, 'glass', null], out: 'shield_generator', qty: 1},
    {station: 'bench', name: items.shield_generator_advanced.name, pattern: ['bulterite', 'crystal', 'bulterite', 'plate', 'ion_cube', 'plate', null, 'shield_generator', null], out: 'shield_generator_advanced', qty: 1},
    {station: 'bench', name: items.shield_generator_ion.name, pattern: ['bulterite', 'crystal', 'bulterite', 'glass', 'blue_ion_cube', 'glass', null, 'shield_generator_advanced', null], out: 'shield_generator_ion', qty: 1}
  );

  recipes.push({station:'bench',name:items.resource_scanner.name,pattern:['crystal','glass','crystal','plate','scanner','plate',null,'ion_cube',null],out:'resource_scanner',qty:1});
  recipes.push({station: 'bench', name: items.portable_workbench.name, pattern: ['bulterite','crystal','bulterite','plate','blue_ion_cube','plate','glass','bench','glass'], out: 'portable_workbench', qty: 1});

  recipes.push(
    {station:'bench',name:items.storage_small.name,pattern:['ingot','plate','ingot',null,'ingot',null,null,null,null],out:'storage_small',qty:1},
    {station:'bench',name:items.storage_medium.name,pattern:['plate','crystal','plate','ingot','storage_small','ingot',null,null,null],out:'storage_medium',qty:1},
    {station:'bench',name:items.storage_large.name,pattern:['bulterite','plate','bulterite','crystal','storage_medium','crystal','plate','blue_ion_cube','plate'],out:'storage_large',qty:1}
  );

  recipes.push(
    ...['titanium','cobalt','iridium'].map(metal=>({station:'furnace',name:items[metal+'_ingot'].name,pattern:[metal+'_ore',metal+'_ore',null,null],out:metal+'_ingot',qty:1})),
    {station:'furnace',name:items.plate.name,pattern:['titanium_ingot',null,null,null],out:'plate',qty:3},
    {station:'bench',name:items.advanced_alloy.name,pattern:['titanium_ingot','cobalt_ingot','titanium_ingot',null,'iridium_ingot',null,null,null,null],out:'advanced_alloy',qty:2},
    {station:'bench',name:items.ammo_fotron.name,pattern:['crystal','cobalt_ingot','crystal',null,'iridium_ingot',null,null,null,null],out:'ammo_fotron',qty:48},
    {station:'bench',name:items.ammo_bulshitter.name,pattern:['ingot','cobalt_ingot','ingot',null,null,null,null,null,null],out:'ammo_bulshitter',qty:160},
    {station:'bench',name:items.shield_generator_advanced.name,pattern:['advanced_alloy','crystal','advanced_alloy',null,'shield_generator',null,null,'ion_cube',null],out:'shield_generator_advanced',qty:1},
    {station:'bench',name:items.portable_workbench.name,pattern:['advanced_alloy','glass','advanced_alloy','plate','blue_ion_cube','plate',null,'bench',null],out:'portable_workbench',qty:1}
  );

  recipes.push(
    {station:'bench',name:items.portable_furnace.name,pattern:['bulterite','glass','bulterite','plate','blue_ion_cube','plate',null,'furnace',null],out:'portable_furnace',qty:1},
    {station:'bench',name:items.portable_furnace.name,pattern:['titanium_ingot','cobalt_ingot','titanium_ingot','glass','ion_cube','glass',null,'furnace',null],out:'portable_furnace',qty:1},
    {station:'bench',name:items.fuel_optimizer.name,pattern:['cobalt_ingot','glass','cobalt_ingot','plate','ion_cube','plate',null,'titanium_ingot',null],out:'fuel_optimizer',qty:1},
    {station:'bench',name:items.repair_controller.name,pattern:['titanium_ingot','crystal','titanium_ingot','glass','advanced_alloy','glass',null,'ion_cube',null],out:'repair_controller',qty:1}
  );

  recipes.push(
    {station:'bench',name:items.plasma.name,pattern:['glass','crystal','glass','plate','ion_cube','plate',null,'ingot',null],out:'plasma',qty:1},
    {station:'bench',name:items.railgun.name,pattern:['titanium_ingot','iridium_ingot','titanium_ingot','cobalt_ingot','blue_ion_cube','cobalt_ingot',null,'advanced_alloy',null],out:'railgun',qty:1},
    {station:'bench',name:items.cluster.name,pattern:['plate','cobalt_ingot','plate','ammo_rockbreaker','titanium_ingot','ammo_rockbreaker',null,'crystal',null],out:'cluster',qty:1},
    {station:'bench',name:items.ammo_railgun.name,pattern:['titanium_ingot','iridium_ingot','titanium_ingot',null,null,null,null,null,null],out:'ammo_railgun',qty:12},
    {station:'bench',name:items.ammo_cluster.name,pattern:['ingot','crystal','ingot','metal','cobalt_ingot','metal',null,null,null],out:'ammo_cluster',qty:4});

  recipes.push(
    {station:'bench',name:items.repair_station.name,pattern:['plate','repair_pack','plate','ingot','ion_cube','ingot',null,'bench',null],out:'repair_station',qty:1},
    {station:'bench',name:items.solar_array.name,pattern:['glass','crystal','glass','plate','cobalt_ingot','plate',null,'ingot',null],out:'solar_array',qty:1},
    {station:'bench',name:items.fabrication_hub.name,pattern:['titanium_ingot','crystal','titanium_ingot','plate','advanced_alloy','plate',null,'blue_ion_cube',null],out:'fabrication_hub',qty:1});

  // Two independent FIFO lanes share inventory; ingredients are reserved on enqueue.
  const craftQueueLimit = 12;
  const craftLane = station => station === 'furnace' ? 'furnace' : 'workbench';
  // A physical workshop belongs to its moon. Handcraft/portable jobs belong to ship.
  const queueKey = (station,owner) => (owner && owner!=='portable'?owner:'ship')+'|'+craftLane(station);
  function craftOwner(station) {
    if(station==='hand')return null;
    const access=stationAccess();
    if(!(access.moon && baseRecords.get(access.moon.id)?.counts[station]>0))return 'portable';
    return access.moon?.id || null;
  }
  const laneJobs = (station,owner=craftOwner(station)) => craftQueue.filter(job=>queueKey(job.recipe.station,job.moonId)===queueKey(station,owner));
  function visibleQueues() {
    const cs=I18n.language==='cs',access=stationAccess();
    const groups=[{station:'hand',owner:null,title:count('portable_workbench')>0?(cs?'LOĎ / PŘENOSNÁ DÍLNA':'SHIP / PORTABLE WORKBENCH'):(cs?'RUČNÍ VÝROBA':'HANDCRAFT')}];
    for(const station of ['bench','furnace']){
      if(!access.stations.has(station))continue;
      const owner=craftOwner(station);
      if(groups.some(g=>queueKey(g.station,g.owner)===queueKey(station,owner)))continue;
      groups.push({station,owner,title:(owner==='portable'?(cs?'LOĎ / PŘENOSNÁ':'SHIP / PORTABLE'):(access.moon?.name || ''))+' · '+(station==='furnace'?(cs?'PEC':'FURNACE'):(cs?'DÍLNA':'WORKBENCH'))});
    }
    // Removed machines retain local jobs so their reserved materials can be refunded.
    for(const job of craftQueue){
      if(!queueAccessible(job)||groups.some(g=>queueKey(g.station,g.owner)===queueKey(job.recipe.station,job.moonId)))continue;
      groups.push({station:job.recipe.station,owner:job.moonId,title:((!job.moonId||job.moonId==='portable')?(cs?'LOĎ':'SHIP'):(access.moon?.name||''))+' · '+(job.recipe.station==='furnace'?(cs?'PEC':'FURNACE'):(cs?'DÍLNA':'WORKBENCH'))});
    }
    return groups;
  }
  function queueAccessible(job) {
    return !job.moonId || job.moonId==='portable' || stationAccess().moon?.id===job.moonId;
  }

  let craftQueue = [], nextCraftJob = 1, craftSaveClock = 0, craftUiClock = 0, craftQuantity = 1;
  const jobDuration = job => job.chain?chainSeconds(job.chain):craftSeconds(job.recipe)*job.batches;
  function craftSeconds(recipe) { return legacyCraftSeconds(recipe) * .5; }
  function legacyCraftSeconds(recipe) {
    if (items[recipe.out].storageSlots) return items[recipe.out].storageSlots===40?35:items[recipe.out].storageSlots===20?25:15;
    if (['portable_workbench','portable_furnace'].includes(recipe.out)) return 45;
    if (items[recipe.out].shield) return 20 + items[recipe.out].shieldTier * 5;
    if (['repair_station','solar_array','fabrication_hub'].includes(recipe.out)) return 30;
    if (recipe.out === 'scanner') return 35;
    if (items[recipe.out].machine || ['bench', 'furnace'].includes(recipe.out)) return 25;
    if (items[recipe.out].weapon) return 18;
    if (items[recipe.out].ammoFor) return 6;
    if (items[recipe.out].fuel || items[recipe.out].repair) return 8;
    return recipe.station === 'hand' ? 2 : 4;
  }
  function autoCraftPlan(recipe,batches) {
    const access=stationAccess();
    if(!recipe||carried||!access.stations.has('bench'))return null;
    const stock=Object.fromEntries(Object.keys(items).map(type=>[type,count(type)]));
    return CraftPlanner.plan(recipes,stock,access.stations,recipe,batches);
  }
  function reservedCosts(job) {
    return job.chain?job.chain.raw:Object.fromEntries(Object.entries(costs(job.recipe.pattern)).map(([type,qty])=>[type,qty*job.batches]));
  }
  function craftedOutputs(job) {
    const out={...(job.chain?.extra||{})};out[job.recipe.out]=(out[job.recipe.out]||0)+job.recipe.qty*job.batches;return out;
  }
  function chainSeconds(chain) {return chain.steps.reduce((sum,step)=>sum+craftSeconds(recipes[step.recipe])*step.batches,0);}
  function currentCraftStep(job) {
    if(!job.chain)return {recipe:job.recipe,left:job.remaining};
    let elapsed=jobDuration(job)-job.remaining;
    for(const step of job.chain.steps){
      const recipe=recipes[step.recipe],duration=craftSeconds(recipe)*step.batches;
      if(elapsed<duration-1e-7)return {recipe,left:duration-elapsed};
      elapsed-=duration;
    }
    return {recipe:job.recipe,left:job.remaining};
  }
  const executionKey=job=>queueKey(currentCraftStep(job).recipe.station,job.moonId);
  function encodeChain(chain) {
    return chain?{raw:chain.raw,extra:chain.extra,steps:chain.steps.map(s=>({recipe:recipeKey(recipes[s.recipe]),batches:s.batches}))}:undefined;
  }
  function restoreChain(saved,root,batches) {
    if(!saved||!Array.isArray(saved.steps)||!saved.steps.length||saved.steps.length>64)return null;
    const validMap=map=>map&&typeof map==='object'&&!Array.isArray(map)&&Object.entries(map).every(([type,n])=>Object.hasOwn(items,type)&&Number.isSafeInteger(n)&&n>0&&n<=1e7);
    if(!validMap(saved.raw)||!validMap(saved.extra))return null;
    const pool={...saved.raw},steps=[];
    for(const step of saved.steps){
      const index=recipes.findIndex(r=>recipeKey(r)===step.recipe);
      if(index<0||!Number.isSafeInteger(step.batches)||step.batches<1||step.batches>9999)return null;
      const recipe=recipes[index];
      for(const [type,qty]of Object.entries(costs(recipe.pattern))){
        const amount=qty*step.batches;if((pool[type]||0)<amount)return null;pool[type]-=amount;
      }
      pool[recipe.out]=(pool[recipe.out]||0)+recipe.qty*step.batches;
      steps.push({recipe:index,batches:step.batches});
    }
    const last=steps[steps.length-1];
    if(recipes[last.recipe]!==root||last.batches!==batches)return null;
    pool[root.out]-=root.qty*batches;
    const extra=Object.fromEntries(Object.entries(pool).filter(([,n])=>n>0));
    if(Object.keys(extra).length!==Object.keys(saved.extra).length||Object.entries(extra).some(([t,n])=>saved.extra[t]!==n))return null;
    return {raw:{...saved.raw},extra,steps};
  }
  const recipeKey = recipe => JSON.stringify([recipe.station, recipe.out, recipe.qty, recipe.pattern]);
  function craftQueueSnapshot() {
    return craftQueue.map(job => ({id: job.id, recipe: recipeKey(job.recipe), batches: job.batches, remaining: job.remaining, duration: jobDuration(job), chain: encodeChain(job.chain), moonId: job.moonId}));
  }
  function restoreCraftQueue(saved) {
    if (!Array.isArray(saved)) return;
    const ids = new Set();
    for (const job of saved) {
      if (!job || !Number.isFinite(job.remaining)) continue;
      const recipe = recipes.find(recipe => recipeKey(recipe) === job.recipe);
      const batches = job.batches === undefined ? 1 : job.batches;
      if (!recipe || !Number.isSafeInteger(batches) || batches < 1 || batches > 9999 || job.remaining < 0 || job.remaining > (Number.isFinite(job.duration) ? job.duration : legacyCraftSeconds(recipe)*batches)) continue;
      if (recipe.station !== 'hand' && (typeof job.moonId !== 'string' || (!/^-?\d{1,7}:-?\d{1,7}$/.test(job.moonId) && !(['bench','furnace'].includes(recipe.station) && job.moonId === 'portable')))) continue;
      if (laneJobs(recipe.station,recipe.station==='hand'?null:job.moonId).length >= craftQueueLimit) continue;
      const chain=job.chain?restoreChain(job.chain,recipe,batches):null;
      if(job.chain&&!chain)continue;
      const duration=chain?chainSeconds(chain):craftSeconds(recipe)*batches;
      const previousDuration=Number.isFinite(job.duration)&&job.duration>0?job.duration:legacyCraftSeconds(recipe)*batches;
      const remaining=Math.min(duration,job.remaining/previousDuration*duration);
      const id = Number.isSafeInteger(job.id) && job.id > 0 && job.id < 1e9 && !ids.has(job.id) ? job.id : nextCraftJob;
      ids.add(id); nextCraftJob = Math.max(nextCraftJob, id + 1);
      craftQueue.push({id, recipe, batches, chain, remaining, moonId: recipe.station === 'hand' ? null : job.moonId});
    }
  }
  function jobConnected(job) {
    const station=currentCraftStep(job).recipe.station;
    if (station === 'hand') return queueAccessible(job);
    const access = stationAccess();
    if (job.moonId === 'portable') return count(station==='furnace'?'portable_furnace':'portable_workbench')>0;
    return access.moon?.id===job.moonId && ((baseRecords.get(job.moonId)?.counts[station]||0)>0 || (job.chain&&access.stations.has(station)));
  }
  function craftJobStatus(job, index) {
    const cs = I18n.language === 'cs';
    if (job.remaining <= 0) return cs ? 'HOTOVO · ČEKÁ NA MÍSTO' : 'READY · WAITING FOR CARGO SPACE';
    if (craftQueue.some(other=>other!==job&&queueAccessible(other)&&executionKey(other)===executionKey(job)&&craftQueue.indexOf(other)<craftQueue.indexOf(job))) return cs ? 'VE FRONTĚ' : 'QUEUED';
    return jobConnected(job) ? (job.chain?'AUTO · '+items[currentCraftStep(job).recipe.out].name:(cs ? 'VÝROBA' : 'CRAFTING')) : (cs ? 'POZASTAVENO · PŘIPOJTE DÍLNU' : 'PAUSED · RECONNECT WORKSHOP');
  }
  function renderCraftQueue() {
    const host = $('#craftQueue');
    if (!host) return;
    const cs = I18n.language === 'cs';
    host.innerHTML = visibleQueues().map(group => {
      const jobs = laneJobs(group.station,group.owner);
      const title = group.title;
      return '<div class="inventory-label">' + title + ' <span>' + jobs.length + ' / ' + craftQueueLimit + '</span></div>' +
        (jobs.length ? jobs.map((job,index) => {
          const recipe=job.recipe;
          return `<div class="craft-job">${icon(recipe.out)}<div><b>${recipe.qty*job.batches} ${items[recipe.out].name}</b>
            <small id="craftJobStatus${job.id}">${craftJobStatus(job,index)}</small>
            <progress id="craftJobProgress${job.id}" value="${jobDuration(job)-job.remaining}" max="${jobDuration(job)}" aria-label="${items[recipe.out].name}"></progress>
            <small id="craftJobTime${job.id}">${Math.ceil(job.remaining)} s · ${job.moonId || (cs?'RUČNÍ VÝROBA':'HANDCRAFT')}</small></div>
            ${job.remaining>0 ? `<button data-cancel-craft="${job.id}">${cs?'ZRUŠIT':'CANCEL'}</button>` : ''}</div>`;
        }).join('') : '<p>'+(cs?'Fronta je prázdná.':'Queue is empty.')+'</p>');
    }).join('');
    host.querySelectorAll('[data-cancel-craft]').forEach(button=>button.onclick=()=>cancelCraft(Number(button.dataset.cancelCraft)));
  }
  function cancelCraft(id) {
    const index = craftQueue.findIndex(job => job.id === id);
    if (index < 0 || craftQueue[index].remaining <= 0 || !queueAccessible(craftQueue[index])) return false;
    const job = craftQueue[index];
    // Refund into cargo first, with preserved overflow if every slot is occupied.
    for (const [type, qty] of Object.entries(reservedCosts(job))) {
      const remaining = deposit(bag, type, qty);
      if (remaining) preserveOverflow(type, remaining);
    }
    craftQueue.splice(index, 1);
    sync(); save();
    if (!$('#overlay').hidden) renderInventory();
    return true;
  }
  function updateCrafting(dt) {
    const hud = $('#craftingStatus');
    // Each lane has its own FIFO head; a disconnected/full lane cannot block the other.
    const executing=new Map();
    for(const job of craftQueue.filter(queueAccessible))if(!executing.has(executionKey(job)))executing.set(executionKey(job),job);
    const heads=[...executing.values()];
    if (hud) {
      hud.hidden = !heads.length;
      const text = heads.map(job=>(currentCraftStep(job).recipe.station==='furnace'
        ? (I18n.language==='cs'?'PEC':'FURNACE') : (I18n.language==='cs'?'DÍLNA':'WORKBENCH'))+
        ' · '+Math.ceil(job.remaining)+' s').join(' | ');
      if (hud.textContent!==text) hud.textContent=text;
    }
    if (!Number.isFinite(dt) || dt<=0 || !heads.length) return;
    let changed=false, completed=false, becameReady=false;
    for (const job of heads) {
      const previous=job.remaining;
      if (job.remaining>0 && jobConnected(job)) job.remaining=Math.max(0,job.remaining-Math.min(Math.min(dt,1)*(job.moonId && job.moonId!=='portable' && baseRecords.get(job.moonId)?.isBase && baseRecords.get(job.moonId)?.counts.fabrication_hub>0 ? 1.5 : 1),currentCraftStep(job).left));
      changed ||= job.remaining!==previous;
      if (job.remaining<=0 && jobConnected(job)) {
        // Failed insertion never partially deposits output or blocks the other lane.
        const next=bag.map(stack=>stack?{...stack}:null);
        if (Object.entries(craftedOutputs(job)).every(([type,qty])=>insert(next,type,qty))) {
          bag=next;craftQueue.splice(craftQueue.indexOf(job),1);
          completed=true;
          notify((I18n.language==='cs'?'VÝROBA HOTOVA · ':'CRAFT COMPLETE · ')+items[job.recipe.out].name);
        } else if (previous>0) becameReady=true;
      }
    }
    if (completed) {
      sync();save();GameAudio.play('craft');
      if (!$('#overlay').hidden) renderInventory();
    } else if (becameReady) {save();renderCraftQueue();}
    craftUiClock+=Math.min(dt,1);
    if (!$('#overlay').hidden && craftUiClock>=.15) {
      craftUiClock=0;
      for (const queued of craftQueue) {
        const index=laneJobs(queued.recipe.station,queued.moonId).indexOf(queued);
        const meter=$('#craftJobProgress'+queued.id),status=$('#craftJobStatus'+queued.id),time=$('#craftJobTime'+queued.id);
        if(meter)meter.value=jobDuration(queued)-queued.remaining;
        if(status)status.textContent=craftJobStatus(queued,index);
        if(time)time.textContent=Math.ceil(queued.remaining)+' s · '+(queued.moonId || (I18n.language==='cs'?'RUČNÍ VÝROBA':'HANDCRAFT'));
      }
    }
    if (changed) {
      craftSaveClock+=Math.min(dt,1);
      if(craftSaveClock>=2){craftSaveClock=0;save();}
    }
  }

  const moons = new Map(),
    terrains = new Map(),
    storageContents = new Map(),
    baseRecords = new Map(),
    tileSize = 32,
    cols = 160,
    rows = 64;
  const baseParts = ['block', 'glass', 'bench', 'furnace', 'lamp', 'storage_small', 'storage_medium', 'storage_large', 'repair_station', 'solar_array', 'fabrication_hub'];
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
    refreshRepairButton();
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
    const inProgress = craftQueue.filter(queueAccessible).flatMap(job => Object.entries(job.remaining<=0?craftedOutputs(job):reservedCosts(job)).map(([type,qty])=>({type,qty})));
    return [...bag, ...overflow, carried, ...inProgress].reduce((sum, s) => sum + (s ? s.qty * (items[s.type].weight || 1) : 0), 0);
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
  // Explicit destruction affects only the selected stack (or the held half-stack).
  // No drops or rewards are created; saved base contents and queued ingredients are separate.
  function destroyInventoryItems(quantity) {
    const stack=focusedStack();
    if(!stack||!Number.isSafeInteger(quantity)||quantity<1||quantity>stack.qty)return false;
    const type=stack.type;
    stack.qty-=quantity;
    if(!stack.qty){if(carried)carried=null;else bag[selected]=null;selected=-1;}
    if(typeof Shields!=='undefined'){Shields.reconcile();Shields.refresh();}
    Weapons.updateHUD();sync();save();renderInventory();
    notify((I18n.language==='cs'?'ZNIČENO':'DESTROYED')+' · '+quantity+' '+items[type].name);
    return true;
  }

  function consumeItem(type, qty = 1, persist = true) {
    if (!items[type] || !Number.isSafeInteger(qty) || qty < 1 || count(type) < qty)
      return false;
    remove(bag, type, qty);
    if (items[type].shield && typeof Shields !== 'undefined') { Shields.reconcile(); Shields.refresh(); }
    sync();
    if (persist) save();
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

  // Commit the consumed pack and repaired hull together in the expedition save.
  // Refresh for hull damage and cargo changes without rebuilding the inventory.
  function refreshRepairButton() {
    const button = $('#repair');
    if (!button) return;
    const stock = count('repair_pack');
    button.disabled = !!carried || stock < 1 || !Number.isFinite(ship.hull) || ship.hull <= 0 || ship.hull >= 100;
    const label = I18n.language === 'cs' ? 'OPRAVIT' : 'REPAIR';
    const markup = label + ' (' + stock + ') <kbd>U</kbd>';
    if (button.innerHTML !== markup) button.innerHTML = markup;
    button.title = I18n.language === 'cs' ? 'Použít opravnou sadu: až +' + repairPackAmount() + ' % trupu (U)' : 'Apply a repair pack: up to +' + repairPackAmount() + '% hull (U)';
  }

  function repairPackAmount() { return count('repair_controller')>0?30:20; }
  function useRepairPack() {
    if (carried || count('repair_pack') < 1 || !Number.isFinite(ship.hull) || ship.hull <= 0 || ship.hull >= 100) return false;
    remove(bag, 'repair_pack', 1);
    ship.hull = Math.min(100, ship.hull + repairPackAmount());
    sync(); save(); GameAudio.play('craft');
    $('#hullText').textContent = Math.ceil(ship.hull) + '%';
    $('#hullBar').style.width = ship.hull + '%';
    if (!$('#overlay').hidden) renderInventory();
    notify(I18n.t('REPAIR PACK USED') + ' · ' + Math.ceil(ship.hull) + '%');
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
    // Delivery cargo is removed from the same trial inventory as the rewards.
    if (quest.kind === 'delivery') remove(next, quest.material, quest.target);
    for (const [type, qty] of Object.entries(quest.rewards))
      if (!insert(next, type, qty))
        return {
          ok: false,
          message: I18n.t('Free inventory space for the full reward, then claim again.')
        };
    bag = next;
    questState.claimed.push(id);
    if (QuestLog.applyReward) QuestLog.applyReward(quest);
    sync();
    save();
    GameAudio.play('craft');
    QuestLog.refresh();
    return {
      ok: true,
      message: quest.credits || quest.coordinates ? (I18n.language === 'cs' ? 'Odměny připsány; souřadnice vormhoulu jsou na mapě, pokud je zakázka obsahuje.' : 'Rewards credited; any wormhole coordinates are now on your map.') : I18n.t('Rewards added to your inventory.')
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
      (typeof Profiles === 'undefined' ? localStorage : Profiles).setItem('spacecraft-save-v1', JSON.stringify({
        fuel: Fuel.snapshot(),
        shield: typeof Shields !== 'undefined' ? Shields.snapshot() : undefined,
        starbases: typeof Starbases !== 'undefined' ? Starbases.snapshot() : undefined,
        missions: typeof MissionContracts !== 'undefined' ? MissionContracts.snapshot() : undefined,
        craftingQueue: craftQueueSnapshot(),
        salvage: typeof Salvage !== 'undefined' ? Salvage.snapshot() : undefined,
        trackedQuest: typeof QuestTracker !== 'undefined' ? QuestTracker.snapshot() : undefined,
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
        storageContents: [...storageContents],
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
      const data = JSON.parse((typeof Profiles === 'undefined' ? localStorage : Profiles).getItem('spacecraft-save-v1') || 'null');
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
      restoreCraftQueue(data.craftingQueue);
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
      restoreStorage(data.storageContents);
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
  // Container state belongs to a placed tile, never to a carried empty crate.
  function storageAt(id) {
    if(typeof id!=='string')return null;
    const match=/^(-?\d{1,7}:-?\d{1,7})\|(\d{1,3}),(\d{1,2})$/.exec(id);
    if(!match)return null;
    const x=Number(match[2]),y=Number(match[3]),type=terrains.get(match[1])?.[y]?.[x];
    if(!Object.hasOwn(items,type||'')||!items[type].storageSlots)return null;
    return {id,moonId:match[1],x,y,type,capacity:items[type].storageSlots};
  }
  function storageContainers() {
    const moon=stationAccess().moon,map=moon&&terrains.get(moon.id),out=[];
    if(!map)return out;
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const type=map[y][x];if(!items[type]?.storageSlots)continue;
      const id=moon.id+'|'+x+','+y,slots=storageContents.get(id)||[];
      out.push({id,type,capacity:items[type].storageSlots,x,y,used:slots.filter(Boolean).length});
    }
    return out;
  }
  function storageSlots(id) {
    const info=storageAt(id);
    if(!info||stationAccess().moon?.id!==info.moonId)return null;
    return (storageContents.get(id)||Array(info.capacity).fill(null)).map(s=>s?{...s}:null);
  }
  function restoreStorage(saved) {
    if(!Array.isArray(saved))return;
    for(const row of saved){
      if(!Array.isArray(row)||row.length!==2||storageContents.has(row[0]))continue;
      const info=storageAt(row[0]),slots=row[1];
      if(!info||!Array.isArray(slots)||slots.length!==info.capacity||
        slots.some(s=>s!==null&&(!s||!Object.hasOwn(items,s.type)||!Number.isSafeInteger(s.qty)||s.qty<1||s.qty>items[s.type].maxStack)))continue;
      storageContents.set(info.id,slots.map(s=>s?{type:s.type,qty:s.qty}:null));
    }
  }
  // Move only what fits; cargo and chest commit together to the expedition save.
  function transferStorage(id,from,index,quantity,toIndex=null) {
    if(carried||!['bag','storage'].includes(from))return false;
    const slots=storageSlots(id);if(!slots)return false;
    const nextBag=bag.map(s=>s?{...s}:null),source=from==='bag'?nextBag:slots,dest=from==='bag'?slots:nextBag;
    if(!Number.isInteger(index)||index<0||index>=source.length||!source[index])return false;
    const stack=source[index],amount=quantity===undefined?stack.qty:quantity;
    if(!Number.isSafeInteger(amount)||amount<1||amount>stack.qty)return false;
    let moved=0;
    if(toIndex!==null){
      if(!Number.isInteger(toIndex)||toIndex<0||toIndex>=dest.length)return false;
      const target=dest[toIndex];
      if(target&&target.type!==stack.type){
        if(amount!==stack.qty)return false;
        dest[toIndex]={...stack};source[index]={...target};moved=amount;
      }else{
        moved=Math.min(amount,items[stack.type].maxStack-(target?.qty||0));
        if(!moved)return false;
        dest[toIndex]={type:stack.type,qty:(target?.qty||0)+moved};
        stack.qty-=moved;if(!stack.qty)source[index]=null;
      }
    }else{
      moved=amount-deposit(dest,stack.type,amount);
      if(!moved)return false;
      stack.qty-=moved;if(!stack.qty)source[index]=null;
    }
    bag=nextBag;storageContents.set(id,slots);
    if(typeof Shields!=='undefined'){Shields.reconcile();Shields.refresh();}
    sync();save();return true;
  }

  function slotMarkup(s, i) {
    return `<button class="item-slot ${ i === selected ? 'selected' : '' }" data-slot="${ i }" data-item="${ (s?.type) || '' }" title="${ s ? items[s.type].name + ' × ' + s.qty + ' / ' + items[s.type].maxStack : I18n.t('Empty slot') }" aria-label="${ s ? items[s.type].name + ', ' + s.qty + I18n.t(', stack limit ') + items[s.type].maxStack : I18n.t('Empty slot') }">${ s ? I18n.html(`${ icon(s.type) }<small>${ s.qty }</small><span class="item-name">${ items[s.type].name } · MAX ${ items[s.type].maxStack }</span>`) : '' }</button>`;
  }

  // A moon's built stations form one workshop network. Inventory access follows
  // the current surface, or the same low-orbit range used by the landing prompt.
  // Read cached construction counts rather than scanning terrain on every UI render.
  function stationAccess() {
    const moon = surface ? activeMoon : nearestMoon();
    const counts = moon ? baseRecords.get(moon.id)?.counts : null;
    const stations = new Set(['hand']);
    const portable = count('portable_workbench') > 0, portableFurnace = count('portable_furnace') > 0;
    if (counts?.bench > 0 || portable) stations.add('bench');
    if (counts?.furnace > 0 || portableFurnace) stations.add('furnace');
    return { moon, mode: surface ? 'surface' : moon ? 'orbit' : 'space', stations, portable, portableFurnace };
  }

  let repairStationClock = 0, supportMoon = null, supportSaveClock = 0;
  // Only active play runs support services. Pause and distant bases grant no progress.
  function updateBaseServices(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    const access = stationAccess(), base = access.moon && baseRecords.get(access.moon.id);
    if (!base?.isBase || (!surface && Math.hypot(ship.vx,ship.vy)>40)) {
      repairStationClock=0; supportMoon=null; return;
    }
    if (supportMoon!==base.id) {supportMoon=base.id;repairStationClock=0;}
    const elapsed=Math.min(dt,1);
    let changed=false;
    if (base.counts.repair_station && ship.hull>0 && ship.hull<100 && count('ingot')>0) {
      repairStationClock+=elapsed;
      if (repairStationClock>=5 && consumeItem('ingot',1,false)) {
        repairStationClock=0;ship.hull=Math.min(100,ship.hull+20);
        changed=true;GameAudio.play('craft');refreshRepairButton();save();
      }
    } else repairStationClock=0;
    if (base.counts.solar_array && typeof Fuel!=='undefined' && Fuel.canRefuel()) {
      changed=Fuel.insert(elapsed)||changed;
    }
    if (changed) {supportSaveClock+=elapsed;if(supportSaveClock>=2){supportSaveClock=0;save();}}
  }

  function nearbyStations() {
    return stationAccess().stations;
  }

  function openInventory() {
    const available = nearbyStations();
    if (!available.has(station) || station === 'hand') {
      const next = available.has('bench') ? 'bench' : available.has('furnace') ? 'furnace' : 'hand';
      if (next !== station) {
        station = next;
        grid = Array(station === 'bench' ? 9 : 4).fill(null);
      }
    }
    renderInventory();
    $('#resume').textContent = surface ? I18n.t('RETURN TO SURFACE →') : I18n.t('RETURN TO FLIGHT →');
  }

  function stationAccessMarkup(access) {
    if(access.portable||access.portableFurnace) {
      const devices=[access.portable?'portable_workbench':null,access.portableFurnace?'portable_furnace':null].filter(Boolean);
      return '<p class="station-access" role="status"><b>'+(I18n.language==='cs'?'PŘENOSNÁ DÍLNA ONLINE':'PORTABLE WORKSHOP ONLINE')+'</b><span>'+
        devices.map(type=>items[type].name).join(' · ')+(access.moon?' · '+access.moon.name:'')+'</span></p>';
    }
    const connected = [...access.stations].filter(type => type !== 'hand');
    if (connected.length) {
      const label = access.mode === 'orbit' ? 'ORBITAL STATION LINK' : 'SURFACE STATIONS';
      return '<p class="station-access" role="status"><b>' + I18n.t(label) + ' · ' +
        access.moon.name + '</b><span>' + connected.map(type => items[type].name).join(' · ') +
        '</span></p>';
    }
    return '<p class="station-access unavailable" role="status">' +
      I18n.t('HANDCRAFT ONLY · Build stations on this moon, or approach a moon with built stations to low orbit.') +
      '</p>';
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
  // Quantities count recipe runs, since ammunition and blocks have multi-item yields.
  function maxCraftQuantity(r = matchedRecipe()) {
    if(!r||carried||!nearbyStations().has(r.station))return 0;
    let low=0,high=Math.min(9999,Math.floor(bag.length*items[r.out].maxStack/r.qty));
    while(low<high){
      const mid=Math.ceil((low+high)/2);
      if(hasCraftMaterials(r,mid))low=mid;else high=mid-1;
    }
    return low;
  }
  function directCraftMaterials(r,batches) {
    return !!r&&Object.entries(costs(r.pattern)).every(([type,n])=>count(type)>=n*batches);
  }
  function hasCraftMaterials(r,batches) {return directCraftMaterials(r,batches)||!!autoCraftPlan(r,batches);}
  function setCraftQuantity(value) {
    if (!Number.isFinite(value)) return false;
    craftQuantity = Math.max(1, Math.min(9999, Math.floor(value)));
    renderInventory();
    return true;
  }
  function craftQuantityMarkup(r) {
    const cs = I18n.language === 'cs', max = maxCraftQuantity(r);
    return `<div class="craft-quantity"><label for="craftQuantity">${cs ? 'Počet výrob' : 'Recipe runs'}</label><div>
      <button id="craftLess" aria-label="${cs ? 'Snížit množství' : 'Decrease quantity'}" ${craftQuantity<=1?'disabled':''}>−</button>
      <input id="craftQuantity" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="4" aria-label="${cs ? 'Po\u010det v\u00fdrob' : 'Recipe runs'}" value="${craftQuantity}">
      <button id="craftMore" aria-label="${cs ? 'Zvýšit množství' : 'Increase quantity'}" ${craftQuantity>=9999?'disabled':''}>+</button>
      <button id="craftMax" ${max<1?'disabled':''}>MAX · ${max}</button></div>
      <small>${r ? craftQuantity*r.qty : 0} ${cs ? 'kusů celkem' : 'items total'}</small></div>`;
  }

  function canCraft(r) {
    return !carried && r && craftQuantity <= Math.floor(bag.length*items[r.out].maxStack/r.qty) && laneJobs(r.station).length < craftQueueLimit && nearbyStations().has(r.station) && hasCraftMaterials(r,craftQuantity);
  }

  // Reserve ingredients now; outputs arrive only after the queued timer finishes.
  function craft() {
    const r=matchedRecipe();
    if(!canCraft(r))return false;
    const chain=directCraftMaterials(r,craftQuantity)?null:autoCraftPlan(r,craftQuantity);
    const reserved=chain?chain.raw:Object.fromEntries(Object.entries(costs(r.pattern)).map(([type,n])=>[type,n*craftQuantity]));
    const next=bag.map(s=>s?{...s}:null);
    for(const [type,qty]of Object.entries(reserved))if(!remove(next,type,qty))return false;
    const moonId=craftOwner(r.station);
    bag=next;
    if(typeof Shields!=='undefined'){Shields.reconcile();Shields.refresh();}
    const job={id:nextCraftJob++,recipe:r,batches:craftQuantity,chain,moonId};
    job.remaining=jobDuration(job);craftQueue.push(job);
    sync();save();renderInventory();return true;
  }

  // Dragging moves real stacks only between bag slots. Craft/quick/equipment
  // drops are references or explicit item uses, so they cannot duplicate cargo.
  function moveInventoryStack(from, to, quantity) {
    if (carried || !Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= bag.length || to >= bag.length || from === to) return false;
    const source = bag[from], target = bag[to];
    if (!source) return false;
    const amount = quantity === undefined ? source.qty : quantity;
    if (!Number.isInteger(amount) || amount <= 0 || amount > source.qty) return false;
    if (!target || target.type === source.type) {
      const moved = Math.min(amount, items[source.type].maxStack - (target?.qty || 0));
      if (!moved) return false;
      if (target) target.qty += moved;
      else bag[to] = {type: source.type, qty: moved};
      source.qty -= moved;
      if (!source.qty) bag[from] = null;
    } else {
      if (amount !== source.qty) return false; // A split stack cannot displace another item.
      [bag[from], bag[to]] = [target, source];
    }
    selected = -1; sync(); save(); renderInventory(); return true;
  }
  function equipShipSlot(slot, type) {
    if (!Object.hasOwn(items, type) || carried) return false;
    if (slot === 'fuel') return refuel(type);
    if (slot === 'shield') {
      if (!items[type].shield || typeof Shields === 'undefined' || !Shields.equip(type)) return false;
      renderInventory(); return true;
    }
    if (slot === 'primary' || slot === 'missile') {
      if (!items[type].weapon || Weapons.definitions[type].channel !== slot || !Weapons.select(type)) return false;
    } else if (slot === 'primaryAmmo' || slot === 'missileAmmo') {
      const channel = slot === 'primaryAmmo' ? 'primary' : 'missile';
      if (Weapons.definitions[Weapons.selected[channel]].ammo !== type || count(type) < 1) return false;
      // Magazines draw from cargo. This socket reports the compatible shared stock.
    } else if (slot === 'scanner') {
      if (type !== 'scanner' || count(type) < 1) return false;
    } else return false;
    save(); renderInventory(); return true;
  }
  function applyInventoryDrop(target, payload) {
    if (carried || !target || !payload || typeof payload !== 'object') return false;
    let type;
    if (payload.kind === 'item' && Object.hasOwn(items, payload.type)) {
      type = payload.type;
      if (payload.slot !== undefined && (!Number.isInteger(payload.slot) || bag[payload.slot]?.type !== type)) return false;
    } else if (payload.kind === 'quick' && validQuickSlot(payload.slot)) type = hotbar[payload.slot];
    if (!type || count(type) < 1) return false;
    if (target.kind === 'bag') return payload.kind === 'item' && payload.slot !== undefined ? moveInventoryStack(payload.slot, target.index, payload.quantity) : false;
    if (target.kind === 'cell') {
      if (!Number.isInteger(target.index) || target.index < 0 || target.index >= grid.length || !nearbyStations().has(station)) return false;
      grid[target.index] = type; renderInventory(); return true;
    }
    if (target.kind === 'ship') return equipShipSlot(target.slot, type);
    return false;
  }
  function bindDrop(button, target) {
    button.ondragover = event => {
      if (Array.from(event.dataTransfer.types).includes(quickDragType)) event.preventDefault();
    };
    button.ondragenter = () => button.classList?.add('drop-target');
    button.ondragleave = () => button.classList?.remove('drop-target');
    button.ondrop = event => {
      event.preventDefault(); button.classList?.remove('drop-target');
      try { applyInventoryDrop(target, JSON.parse(event.dataTransfer.getData(quickDragType))); } catch {}
    };
  }
  function shipEquipmentMarkup() {
    const tr = (en, cs) => I18n.language === 'cs' ? cs : en;
    const primary = Weapons.selected.primary, missile = Weapons.selected.missile;
    const slots = [
      ['primary', tr('Primary cannon', 'Hlavní kanón'), primary],
      ['primaryAmmo', tr('Cannon ammunition', 'Munice kanónu'), Weapons.definitions[primary].ammo],
      ['missile', tr('Missile launcher', 'Raketomet'), missile],
      ['missileAmmo', tr('Missile magazine', 'Zásobník raket'), Weapons.definitions[missile].ammo],
      ['fuel', tr('Integral fuel tank', 'Vestavěná nádrž'), 'fuel_cell'],
      ['shield', tr('Shield generator', 'Generátor štítu'), typeof Shields !== 'undefined' ? Shields.equipped : null],
      ['scanner', tr('Scanner receiver', 'Přijímač skeneru'), 'scanner']
    ];
    return `<div class="inventory-label">${Shipyard.current.name} · ${tr('EQUIPMENT', 'VÝBAVA')}</div><div class="ship-blueprint">${Shipyard.preview(Shipyard.current.id)}<div class="ship-outline-caption">${tr('SHIP OUTLINE', 'OBRYS LODI')}</div></div><div class="ship-equipment-grid">${slots.map(([slot, label, type]) => `<button class="ship-equipment-slot" data-ship-slot="${slot}" title="${label}: ${type ? items[type].name : slot === 'shield' ? tr('Empty shield socket', 'Prázdný slot štítu') : tr('Energy weapon; no ammunition', 'Energetická zbraň; bez munice')}"><span>${label}</span>${type ? icon(type) : slot === 'shield' ? '<b>◇</b>' : '<b>∞</b>'}<small>${slot === 'shield' ? (typeof Shields !== 'undefined' ? Math.ceil(Shields.charge) + ' / ' + Shields.capacity : '—') : slot === 'fuel' ? Math.ceil(Fuel.amount) + ' / ' + Fuel.capacity : slot === 'primary' || slot === 'missile' ? items[type].name : type ? count(type) : tr('ENERGY', 'ENERGIE')}</small></button>`).join('')}</div><meter min="0" max="${Fuel.capacity}" value="${Fuel.amount}" aria-label="${tr('Fuel tank', 'Palivová nádrž')}"></meter><p class="inventory-hint">${tr('Drop weapons to equip. Drop matching ammo to check the magazine; ammo stays in cargo. Drop fuel to refuel the built-in tank.', 'Přetažením nasaďte zbraň. Odpovídající munice zůstává v nákladu a zásobník ji používá. Přetažením paliva doplníte vestavěnou nádrž.')}</p>`;
  }

  // Rebuild the inventory panel from model state and reconnect handlers afterwards.
  // Ingredient grids reference bag items; they do not hold a second copy of the cargo.
  // Allocate each available unit to one cell, in reading order. Repeated ingredients
  // must not all appear available when only one unit remains in the bag.
  function craftingCellsMarkup() {
    const used = {}, recipe=matchedRecipe();
    const automatic=!!recipe&&!directCraftMaterials(recipe,craftQuantity)&&!!autoCraftPlan(recipe,craftQuantity);
    return grid.map((type, index) => {
      const missing = type ? (used[type] = (used[type] || 0) + craftQuantity) > count(type) : false;
      const warning = automatic ? (I18n.language==='cs'?'Vyrobí se automaticky':'Will be crafted automatically') : (I18n.language === 'cs' ? 'Chybí materiál v inventáři' : 'Missing material in inventory');
      const title = type ? items[type].name + (missing ? ' · ' + warning : I18n.t(' · click to replace, right click to clear')) : I18n.t('Assign selected ingredient');
      return `<button class="item-slot${missing ? (automatic ? ' auto-material' : ' missing-material') : ''}" data-cell="${index}" title="${title}">${type ? icon(type) : '<span class="cell-plus">+</span>'}${missing ? '<span class="missing-material-badge" aria-label="' + warning + '">!</span>' : ''}</button>`;
    }).join('');
  }

  function renderInventory() {
    if(typeof BaseStorageUI!=='undefined')BaseStorageUI.refresh();
    const scrollPositions = ['.bag-grid', '.recipe-book', '.inventory-ship-pane', '.craft-queue'].map(selector => [selector, $(selector)?.scrollTop || 0]);
    const access = stationAccess(),
      available = access.stations,
      size = station === 'bench' ? 3 : 2,
      r = matchedRecipe();
    $('#slots').innerHTML = I18n.html(`<div class="inventory-workspace"><div class="inventory-cargo-pane"><div class="inventory-label">PERSONAL INVENTORY <span>${ bag.length } SLOTS · LIMITS VARY BY ITEM</span></div><div class="bag-grid">${ bag.map(slotMarkup).join('') }</div><p class="inventory-hint">${ selected >= 0 && bag[selected] ? I18n.t(`Selected: ${ items[bag[selected].type].name }. Click another slot to move / merge, or a grid cell to assign.`) : I18n.t('Click a stack to select it. Ingredients stay in inventory until you craft.') }</p></div><div class="inventory-craft-pane"><div class="station-tabs">${ [
      ['hand', I18n.t('Handcraft · 2×2')],
      ['bench', I18n.t('Workbench · 3×3')],
      ['furnace', I18n.t('Furnace · 2×2')]
    ].map(([id, name]) => `<button data-station="${ id }" class="${ station === id ? 'active' : '' }" ${ available.has(id) ? '' : 'disabled' } title="${ available.has(id) ? name : I18n.t('Build this station on a moon, then use it on that surface or from low orbit.') }">${ name }</button>`).join('') }</div><div class="craft-layout" style="--craft-size:${ size }"><div><div class="craft-grid" style="grid-template-columns:repeat(${ size },1fr)">${ craftingCellsMarkup() }</div><button id="clearGrid" class="subtle">CLEAR GRID</button></div><div class="craft-result"><span>→</span><div class="item-slot output">${ r ? `${ icon(r.out) }<small>${ r.qty * craftQuantity }</small>` : '?' }</div><b>${ r ? items[r.out].name : I18n.t('No recipe') }</b>${craftQuantityMarkup(r)}<button id="craftItem" ${ canCraft(r) ? '' : 'disabled' }>${ r && !canCraft(r) ? I18n.t('NEED MATERIALS') : I18n.t('CRAFT') }</button></div><div class="recipe-book"><div class="eyebrow">RECIPES</div>${ recipes.filter(r => r.station === station).map(r => `<button data-recipe="${ recipes.indexOf(r) }" class="${ !hasCraftMaterials(r,1) ? 'recipe-unavailable' : '' }">${ icon(r.out) }<span>${ r.name } · ${craftSeconds(r)} s<small>${ Object.entries(costs(r.pattern)).map(([t, n]) => `${ n } ${ items[t].name }`).join(' + ') }</small></span></button>`).join('') }</div></div><p class="inventory-hint">Recipe buttons fill the grid. Right click a cell to clear it. Place workbenches and furnaces on a moon to unlock their grids. Saves automatically on this browser.</p><div id="craftQueue" class="craft-queue"></div></div><div class="inventory-ship-pane">${shipEquipmentMarkup()}</div></div>`);
    $('#slots .station-tabs').insertAdjacentHTML('beforebegin', stationAccessMarkup(access));
    renderQuickInventory();
    const focus = focusedStack();
    if(focus){
      const cs=I18n.language==='cs';
      $('#slots .inventory-cargo-pane').insertAdjacentHTML('beforeend',`<div class="destroy-items">
        <label for="destroyQuantity">${cs?'Zničit':'Destroy'} · ${items[focus.type].name}</label>
        <div><input id="destroyQuantity" type="number" min="1" max="${focus.qty}" step="1" value="1" aria-label="${cs?'Počet ke zničení':'Quantity to destroy'}">
        <button id="destroyAll">${cs?'VŠE':'ALL'}</button>
        <button id="destroyItems" title="${cs?'Trvale odstraní předměty. Bez náhrady.':'Permanently deletes these items. No salvage.'}">${cs?'ZNIČIT':'DESTROY'}</button></div>
        </div>`);
      $('#destroyAll').onclick=()=>{$('#destroyQuantity').value=focusedStack()?.qty||1;};
      $('#destroyItems').onclick=()=>destroyInventoryItems(Number($('#destroyQuantity').value));
    }

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

    if (focus && items[focus.type].repair) {
      $('#slots').insertAdjacentHTML('beforeend', I18n.html(`<div class="equip-row"><span>${items[focus.type].name} · +${repairPackAmount()}% HULL</span><button id="useRepairPack" ${carried || ship.hull >= 100 ? 'disabled' : ''}>USE REPAIR PACK</button></div>`));
      $('#useRepairPack').onclick = useRepairPack;
    }

    if (focus && items[focus.type].shield) {
      $('#slots').insertAdjacentHTML('beforeend', I18n.html('<div class="equip-row"><span>' + items[focus.type].name + '</span><button id="equipShield">EQUIP SHIELD</button></div>'));
      $('#equipShield').onclick = () => equipShipSlot('shield', focus.type);
    }
    if (focus && items[focus.type].weapon) {
      const type = focus.type,
        def = Weapons.definitions[type];
      $('#slots').insertAdjacentHTML('beforeend', I18n.html(`<div class="equip-row"><span>${ def.name } · T${ def.tier } · ${ def.damage } damage · ${ def.cooldown }s recharge</span><button id="equipWeapon">EQUIP ${ def.channel === 'primary' ? I18n.t('PRIMARY') : I18n.t('MISSILE') }</button></div>`));
      $('#equipWeapon').onclick = () => {
        if (!Weapons.select(type)) return;
        save();
        renderInventory();
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
        event.dataTransfer.setData(quickDragType, JSON.stringify({ kind: 'item', type: stack.type, slot: Number(btn.dataset.slot), quantity: event.shiftKey ? Math.ceil(stack.qty / 2) : stack.qty }));
        event.dataTransfer.effectAllowed = 'copyMove';
      };
      btn.oncontextmenu = e => {
        e.preventDefault();
        clickSlot(Number(btn.dataset.slot), true);
      };
    });
    $('#slots').querySelectorAll('[data-station]').forEach(btn => btn.onclick = () => {
      if (!nearbyStations().has(btn.dataset.station)) return;
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
      craftQuantity = 1;
      renderInventory();
    });
    $('#clearGrid').onclick = () => {
      grid.fill(null);
      renderInventory();
    };
    if (r && !carried) $('#craftItem').textContent = laneJobs(r.station).length >= craftQueueLimit ? (I18n.language === 'cs' ? 'FRONTA PLNÁ' : 'QUEUE FULL') : canCraft(r) ? (I18n.language === 'cs' ? 'DO FRONTY' : 'QUEUE CRAFT') + ' · ' + craftSeconds(r) * craftQuantity + ' s' : I18n.t('NEED MATERIALS');
    const autoPreview=r&&!directCraftMaterials(r,craftQuantity)?autoCraftPlan(r,craftQuantity):null;
    if(autoPreview&&canCraft(r)){
      $('#craftItem').textContent=(I18n.language==='cs'?'AUTO VÝROBA':'AUTO CRAFT')+' · '+chainSeconds(autoPreview)+' s';
      $('#craftItem').title=autoPreview.steps.map(step=>items[recipes[step.recipe].out].name+' × '+step.batches).join(' → ');
    }
    renderCraftQueue();
    $('#craftItem').onclick = craft;
    $('#craftLess').onclick = () => setCraftQuantity(craftQuantity - 1);
    $('#craftMore').onclick = () => setCraftQuantity(craftQuantity + 1);
    $('#craftMax').onclick = () => setCraftQuantity(maxCraftQuantity(r));
    $('#craftQuantity').onchange = event => setCraftQuantity(Number(event.target.value));
    $('#slots').querySelectorAll('[data-slot]').forEach(button => bindDrop(button, {kind: 'bag', index: Number(button.dataset.slot)}));
    $('#slots').querySelectorAll('[data-cell]').forEach(button => bindDrop(button, {kind: 'cell', index: Number(button.dataset.cell)}));
    $('#slots').querySelectorAll('[data-ship-slot]').forEach(button => {
      bindDrop(button, {kind: 'ship', slot: button.dataset.shipSlot});
      if (button.dataset.shipSlot === 'shield') button.oncontextmenu = event => { event.preventDefault(); if (typeof Shields !== 'undefined') { Shields.unequip(); renderInventory(); } };
      button.onclick = () => { const type = focusedStack()?.type; if (type) equipShipSlot(button.dataset.shipSlot, type); };
    });
    for (const [selector, top] of scrollPositions) { const pane = $(selector); if (pane) pane.scrollTop = top; }
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
  function systemMoons() {
    const gx = Math.floor((ship.x + 6000) / 12000), gy = Math.floor((ship.y + 6000) / 12000), out = [];
    for (let x = gx * 3 - 2; x <= gx * 3 + 1; x++) for (let y = gy * 3 - 2; y <= gy * 3 + 1; y++) {
      const m = moonAt(x,y);
      if (Math.floor((m.x + 6000) / 12000) === gx && Math.floor((m.y + 6000) / 12000) === gy) out.push(m);
    }
    return out;
  }
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
  // Overlay small veins only when generating a brand-new moon. Existing saved
  // terrain is returned untouched, so mined tunnels and player structures stay intact.
  function addMoonOreVeins(map,moon) {
    const [gx,gy]=moon.id.split(':').map(Number),rng=random(Math.imul(gx,9563)^Math.imul(gy,3911)^827141);
    const deposits=[
      {type:'titanium_ore',count:2+Math.floor(rng()*3),min:25,max:46,size:2.3},
      {type:'cobalt_ore',count:1+Math.floor(rng()*2),min:35,max:53,size:1.9},
      {type:'iridium_ore',count:moon.id==='0:0'?0:rng()<.38?1:0,min:49,max:59,size:1.6}
    ];
    for(const deposit of deposits)for(let vein=0;vein<deposit.count;vein++){
      const cx=3+Math.floor(rng()*(cols-6)),cy=deposit.min+Math.floor(rng()*(deposit.max-deposit.min));
      for(let y=Math.max(0,cy-3);y<=Math.min(rows-2,cy+3);y++)for(let x=Math.max(0,cx-3);x<=Math.min(cols-1,cx+3);x++){
        const distance=Math.pow((x-cx)/deposit.size,2)+Math.pow((y-cy)/(deposit.size*.7),2);
        if(distance<1&&map[y][x]==='stone')map[y][x]=deposit.type;
      }
    }
  }

  function terrainFor(m, persist = true) {
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
    addMoonOreVeins(map,m);
    if (persist) terrains.set(m.id, map);
    return map;
  }
  // Preview new terrain without saving; existing moons use remaining deposits.
  function scanMoonMetals(m) {
    if (!m) return null;
    const systemScan = count('resource_scanner') && systemMoons().some(moon => moon.id === m.id);
    if (!systemScan && (!count('scanner') || Math.hypot(ship.x - m.x, ship.y - m.y) > 6500)) return null;
    const found = new Map(), map = terrainFor(m, false);
    for (let y = 0; y < map.length; y++) for (const type of map[y]) {
      if (!items[type]?.moonOre && type !== 'bulterite') continue;
      const deposit = found.get(type);
      if (deposit) deposit.max = y;
      else found.set(type, {type, min: y, max: y});
    }
    return [...found.values()];
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
    refreshRepairButton();
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
      if(typeof MoonArt !== 'undefined') MoonArt.render(m,x,y);
      else {
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
    refreshRepairButton();
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
      if (items[type].shield) { if (typeof Shields !== 'undefined') Shields.equip(type); }
      else if (items[type].repair) useRepairPack();
      else if (items[type].fuel) refuel(type);
      else if (items[type].weapon) Weapons.select(type);
    }
    renderHotbar();
    refreshRepairButton();
    save();
    return true;
  }

  function quickSlotMarkup(type, index, editor = false) {
    const name = type ? items[type].name : I18n.t('Empty quick slot');
    return `<button class="item-slot quick-slot ${activeQuickSlot === index ? 'selected' : ''} ${type && !count(type) ? 'out-of-stock' : ''}"
      ${editor ? 'data-quick-slot' : 'data-quick-use'}="${index}"
      draggable="${!!type}" aria-pressed="${activeQuickSlot === index}"
      aria-label="${I18n.t('Quick slot')} ${index + 1}: ${name}" title="${name}">
      <em class="quick-slot-key">${index + 1}</em>
      ${type ? icon(type) + '<small>' + count(type) + '</small>' : '<span class="cell-plus">+</span>'}
      <span class="item-name">${name}</span>
    </button>`;
  }

  function renderQuickInventory() {
    $('#slots .bag-grid').insertAdjacentHTML('afterend', `
      <section class="quick-inventory-editor" title="${I18n.language === 'cs' ? 'Přetáhněte předměty do slotů 1–6; pravým tlačítkem vymažte.' : 'Drag items to slots 1–6; right click to clear.'}" aria-label="${I18n.t('Quick inventory')}">
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
      const index = Number(button.dataset.quickUse);
      button.onclick = () => { if (!paused) selectQuickSlot(index, true); };
      button.ondragstart = event => {
        if (!hotbar[index] || carried) { event.preventDefault(); return; }
        event.dataTransfer.setData(quickDragType, JSON.stringify({kind: 'quick', slot: index}));
        event.dataTransfer.effectAllowed = 'move';
      };
      button.ondragover = event => { if (Array.from(event.dataTransfer.types).includes(quickDragType)) event.preventDefault(); };
      button.ondrop = event => {
        event.preventDefault();
        try { applyQuickDrop(index, JSON.parse(event.dataTransfer.getData(quickDragType))); } catch {}
      };
    });
  }

  // Bind number keys to assignment only in the inventory, not in stacked dialogs.
  function handleQuickInventoryKeys(event) {
    if (event.repeat || !/^Digit[1-6]$/.test(event.code) || !paused || $('#overlay').hidden) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
    if (typeof BaseStorageUI !== 'undefined' && BaseStorageUI.isOpen) return;
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
      if (items[existing]?.advancedCutter && !['laser','mininglaser','fotron','piercer','seismic', 'railgun', 'cluster'].some(Weapons.unlocked)) {
        notify(I18n.t('ADVANCED CUTTER REQUIRED'));return false;
      }
      if (existing === 'blue_ion_cube' && !['laser', 'mininglaser', 'fotron', 'piercer', 'seismic', 'railgun', 'cluster'].some(Weapons.unlocked)) {
        notify(I18n.t('ADVANCED CUTTER REQUIRED'));
        return false;
      }
      if (existing === 'bulterite' && !Weapons.unlocked('fotron') && !Weapons.unlocked('seismic') && !Weapons.unlocked('railgun')) {
        notify(I18n.t('ADVANCED CUTTER REQUIRED · FOTRON / SEISMIC'));
        return false;
      }
      if (x >= 10 && x <= 13 && y === 14 || y === rows - 1) {
        notify(I18n.t('LANDING PAD / BEDROCK · CANNOT MINE'));
        return false;
      }
      const storageId=activeMoon.id+'|'+x+','+y;
      if(items[existing]?.storageSlots&&storageContents.get(storageId)?.some(Boolean)){
        notify(I18n.language==='cs'?'NEJPRVE VYPRÁZDNĚTE KONTEJNER':'EMPTY THE CONTAINER FIRST');return false;
      }
      if (!addItem(existing, 1)) {
        notify(I18n.t('INVENTORY FULL'));
        return false;
      }
      surface[y][x] = null;
      storageContents.delete(storageId);
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

  // New buildable items inherit their item color unless they have a custom terrain palette.
  // Keep this registration next to the renderer so added structures cannot leave colors undefined.
  for (const [type,item] of Object.entries(items)) {
    if (Object.hasOwn(tileColors,type)) continue;
    const hex=/^#([0-9a-f]{6})$/i.exec(item.color || '');
    tileColors[type]=hex?[0,2,4].map(offset=>parseInt(hex[1].slice(offset,offset+2),16)/255):tileColors.stone;
  }

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
          c = tileColors[t] || tileColors.stone,
          v = .85 + random(x * 781 + y * 318)() * .2;
        rect(sx, sy, 32, 32, [c[0] * v, c[1] * v, c[2] * v, t === 'glass' ? .45 : 1]);
        line([sx, sy], [sx + 32, sy], [.75, .8, .83, .15], 2);
        line([sx, sy], [sx, sy + 32], [.8, .8, .9, .07]);
        line([sx, sy + 31], [sx + 32, sy + 31], [0, 0, 0, .24], 2);
        if (items[t]?.moonOre || ['metal', 'ice', 'crystal', 'bulterite', 'ion_cube', 'blue_ion_cube'].includes(t)) {
          disc(sx + 10, sy + 12, 4, [c[0] * 1.6, c[1] * 1.6, c[2] * 1.6, 1], 5);
          disc(sx + 22, sy + 22, 3, [c[0] * 1.4, c[1] * 1.4, c[2] * 1.4, 1], 4);
        }
        if (t === 'bench') {
          rect(sx + 3, sy + 6, 26, 6, [.7, .5, .3, 1]);
          rect(sx + 6, sy + 12, 4, 17, [.25, .2, .16, 1]);
          rect(sx + 22, sy + 12, 4, 17, [.25, .2, .16, 1]);
        }
        if(items[t]?.storageSlots){
          rect(sx+3,sy+6,26,24,[.12,.18,.22,1]);rect(sx+5,sy+8,22,6,[.45,.56,.56,1]);
          rect(sx+14,sy+11,4,10,[.85,.67,.32,1]);
          const bands=items[t].storageSlots===40?3:items[t].storageSlots===20?2:1;
          for(let n=0;n<bands;n++)rect(sx+6+n*8,sy+18,3,9,[.39,.5,.52,1]);
        }
        if (t === 'repair_station') {
          rect(sx+4,sy+5,24,24,[.12,.23,.23,1]);
          rect(sx+13,sy+9,6,16,[.5,.95,.7,1]);rect(sx+8,sy+14,16,6,[.5,.95,.7,1]);
        }
        if (t === 'solar_array') {
          rect(sx+14,sy+20,4,10,[.4,.5,.6,1]);rect(sx+2,sy+4,28,18,[.12,.25,.48,1]);
          for(let n=0;n<4;n++)line([sx+4+n*7,sy+5],[sx+4+n*7,sy+21],[.5,.7,.95,.8]);
          line([sx+3,sy+13],[sx+29,sy+13],[.5,.7,.95,.8]);
        }
        if (t === 'fabrication_hub') {
          rect(sx+3,sy+6,26,23,[.16,.2,.24,1]);rect(sx+7,sy+10,18,11,[.8,.6,.3,1]);
          disc(sx+16,sy+16,5,[.3,.9,.9,1],8);rect(sx+7,sy+25,18,2,[.7,.8,.8,1]);
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
    if (e.code === 'KeyU') { e.preventDefault(); useRepairPack(); return; }
    if (e.code === 'KeyE') {
      if (!surface && typeof StarChart !== 'undefined' && StarChart.nearbyPortal())
        return;
      if (surface) {
        const cell=target();
        if(inReach(cell.x,cell.y)&&items[tile(cell.x,cell.y)]?.storageSlots&&typeof BaseStorageUI!=='undefined'){
          BaseStorageUI.show(activeMoon.id+'|'+cell.x+','+cell.y);return;
        }
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
  $('#repair').onclick = useRepairPack;
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
    moveInventoryStack,
    storageContainers, storageSlots, transferStorage,
    applyInventoryDrop,
    equipShipSlot,
    get craftingGrid() { return [...grid]; },
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
    useRepairPack,
    updateBaseServices,
    get machineBonuses() { return {fuelMultiplier:count('fuel_optimizer') > 0 ? .85 : 1,repairAmount:repairPackAmount()}; },
    refreshRepairButton,
    count: ownedCount,
    availableCount: count,
    consumeItem,
    destroyInventoryItems,
    craft,
    craftSeconds,
    autoCraftPlan,
    setCraftQuantity,
    maxCraftQuantity,
    get craftQuantity() { return craftQuantity; },
    updateCrafting,
    cancelCraft,
    get craftingQueue() { return craftQueue.map(job => ({id: job.id, out: job.recipe.out, qty: job.recipe.qty * job.batches, batches: job.batches, remaining: job.remaining, duration: jobDuration(job), moonId: job.moonId, station: job.recipe.station, steps: job.chain?.steps.map(s=>({out:recipes[s.recipe].out,station:recipes[s.recipe].station,batches:s.batches})), lane: craftLane(job.recipe.station), owner: job.moonId && job.moonId!=='portable'?job.moonId:'ship'})); },
    recipes,
    items,
    recordMined,
    questProgress,
    claimQuest,
    land,
    launch,
    editTile,
    closeInventory,
    getMoons: () => count('resource_scanner') ? systemMoons() : localMoons(),
    scanMoonMetals,
    getBases,
    getStationAccess: stationAccess,
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
      craftQuantity = 1;
      return true;
    },
    selectBuild(type) {
      const index = hotbar.indexOf(type);
      if (index >= 0 && canPlace(type)) selectQuickSlot(index);
    },
    save
  };
})();

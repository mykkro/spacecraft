# SPACECRAFT

For code structure, shared-state rules, and lightweight development checks, see
[SOURCE_GUIDE.md](SOURCE_GUIDE.md).

A dependency-free WebGL space game. Open `index.html` in a modern desktop browser, or serve this directory with `python -m http.server 3333` and visit http://localhost:3333.

![SPACECRAFT flight among asteroids](flight-preview.png)

- **W / S**: thrust / reverse
- **A / D**: rotate (arrow keys also work)
- **Space**: pulse cannon
- **F**: fire the selected missile (starts with Rockbreaker)
- **Q**: cycle primary weapon; **R**: cycle missile type
- **1–5** in space: select a weapon directly, or click its HUD card
- **Shift**: boost
- **I / Tab**: ship and cargo
- **P / Escape**: pause
- **M**: local space / global systems map (also available from the Map button)
- **V**: mute / unmute; open **Sound** in the header to adjust volume
- **J**: quest log (also available from the Expedition Log and surface HUD)

## Quests and rewards

Five simple contracts track automatically. Open **J**, check progress, and claim each reward once:

| Quest | Objective | Reward |
| --- | --- | --- |
| Crystal prospecting | Mine and collect 12 crystal | 8 iron ingots, 4 hull plates |
| Heavy metal | Mine and collect 24 iron ore | 16 base blocks, 8 glass blocks |
| Cold storage | Mine and collect 16 ice | 4 crystal, 4 iron ingots |
| A place to call home | Establish 1 base | 1 beacon, 4 hull plates |
| An interstellar foothold | Maintain 3 bases on different moons | 1 scanner receiver, 1 Seismic Torpedo |

A **base requires at least one placed workbench**. Multiple workbenches on one moon still count as one base. Buildings without a workbench are outposts. Existing saved bases qualify, and removing the last workbench removes that moon from an unclaimed base objective. Claimed rewards stay claimed.

Mining progress counts successfully collected asteroid minerals and mined moon deposits. Starter supplies, pirate salvage, crafted items, and quest rewards do not count as mining. Spending mined materials does not reduce progress, and claiming a reward does not consume the mined cargo. Mining counters start with this update; old inventory is not assumed to have been mined.

Quest progress and claimed rewards are stored together with inventory in the game save. The entire reward must fit within the item's stack limits; otherwise the claim stays available until you free space. Place held items before claiming. Opening the log pauses flight and can sit above an existing inventory or map screen. The implementation is in `js/quests.js` and `quests.css`; no browser test is launched automatically.

## Sound

Sound effects are synthesized locally with the Web Audio API; no audio downloads or dependencies are needed. Each weapon has a distinct firing sound. Thrust uses a continuous engine rumble with different pitch and intensity for reverse and boost. Impacts, blocked shots, collisions, asteroid and pirate explosions, crafting, mining, building, pickups, landing, launch, wormhole transit, and pirate alerts have their own cues.

Audio starts only after a click or keypress. Header controls save volume and mute settings in this browser, and **V** toggles mute. The engine stops while paused or on a surface. Losing focus or hiding the tab silences audio. Distant combat sounds fade with distance and pan left/right. A shared noise buffer, a 24-voice limit, per-effect rate limits, and a compressor keep the sound system small and control the mix. Unsupported audio falls back to silent gameplay.

The implementation is in `js/audio.js` with styles in `audio.css`. Audio changes were checked with lightweight syntax/source checks; browser playback was not tested, in accordance with the repository's testing policy.

## Scanner, maps, and wormholes

Craft a **Scanner Receiver** at a workbench using 3 iron ingots, 2 hull plates, 1 glass block, and 1 crystal. Carrying it automatically powers the receiver; no extra installation step is needed. It detects wormholes within **6.5 km**, adds cyan directional arrows to the minimap for offscreen signals, and locates their destination systems. Selecting a signal on the local chart tracks its bearing in amber. The receiver has its own generated inventory icon.

Press **M** for the navigation screen:

- **Local Space:** your ship, nearby moons, asteroid field, receiver range, and detected wormholes. Select a marker or use the sidebar to inspect it. Select a wormhole to track it.
- **Global Systems:** only systems you have located or visited, with known wormhole connections. Hollow circles mean located; filled circles mean visited; amber marks your current system. Selecting a system shows its details.
- Scroll or use **+/−** to zoom, drag to pan, and use **Fit** to reset. **M / Escape** closes the chart. The map pauses flight and restores an existing inventory screen when closed.

Each deterministic system occupies a 12 km-wide region of the infinite flight world. Four reciprocal wormhole connections lead to neighboring systems, so exploration can continue indefinitely. Wormholes are visible when you fly close even without a receiver, but long-range bearings and remote destination discovery require the receiver.

Approach a wormhole within **120 m**, slow below **160 m/s**, and press **E** or use its entry button. Transit places you safely beside the paired exit, stops your ship, and briefly locks re-entry. Systems are marked **visited only when you physically enter them**, by wormhole or ordinary flight. The chart, discovered links, tracked bearing, and visits persist in browser local storage. Moon bases remain at their original world coordinates through travel.

Explore a procedurally generated universe. Large rocks take multiple cannon hits or a missile and split into three smaller rocks. Small rocks release iron ore, ice, or crystal; fly near the fragments to collect them. Collisions damage your hull; hull loss triggers recovery at the origin.

## Space pirates

Some systems have quiet space; others contain one or two deterministic pirate patrol zones. The first is **Gallows Run**, southeast of the starting point near **(3300, 1700)**. The local map outlines danger zones in red and lets you inspect them. Global charts mark pirate activity for located systems. Nearby hostile ships appear as red triangles on the minimap without requiring the wormhole receiver.

Scouts and heavier raiders patrol their territory, pursue nearby ships, and fire orange plasma bolts that damage your hull. Their pursuit has a limited range, so you can boost away. Asteroids block both enemy and player shots. All player weapons damage pirates, and Seismic Torpedoes can hit several ships in one blast. Enemies show hull bars during combat and leave iron ore and crystal salvage when destroyed.

The starting area and immediate wormhole approaches are protected. Pirates do not attack during surface exploration, and opening a map or inventory pauses combat. Defeated patrol members remain defeated across reloads and system changes; cleared zones are marked on the map. Surviving pirates reset to their patrols when a system is re-entered or the game reloads. Losing your hull uses the existing emergency recovery at the origin and clears incoming fire.

Combat and patrol persistence live in `js/pirates.js`; ship models are drawn procedurally in WebGL. Run `python verify_pirates.py` for the isolated browser checks.

## Weapons and asteroid hardness

Every weapon has a generated item icon and a circular recharge arc. Empty arcs fill clockwise to ready, with remaining seconds beneath them. Primary weapons share one cooldown and missiles share another, so switching types does not bypass a recharge. Cooldowns freeze while paused or exploring a moon.

| Weapon | Tier | Damage | Recharge | Access |
| --- | --- | --- | --- | --- |
| Pulse Cannon | 0 | 1 | 0.15 s | Built in |
| Prism Laser | 2 | 4 | 0.38 s | Craft at workbench |
| Rockbreaker | 1 | 8 | 1.8 s | Built in |
| Penetrator | 2 | 12 | 2.6 s | Craft at workbench |
| Seismic Torpedo | 3 | 20 | 4.2 s | Craft at workbench; area blast |

Advanced launchers are reusable equipment and consume matching ammunition with every shot. Craft a weapon, then select it in inventory and press **Equip**, click its HUD card, or cycle to it. Locked cards show **Craft**. Craft ammunition separately at a workbench; recipes list the material costs.

Standard rocks accept any weapon. Reinforced rocks (copper seams, one tick) require tier 1 or higher. Resonant rocks (violet seams, two ticks) require tier 2 or higher. Ultradense cores (orange seams, three ticks) require the Seismic Torpedo. Weak weapons do **zero damage** regardless of hit count. Aim at a rock to see its hardness and compatible weapons in the forward scan. Fragments lose one hardness tier when a rock breaks. Fast projectiles use swept collision tests, and blast damage respects hardness.

## Bases on the maps

Building a construction block, glass block, workbench, furnace, or beacon establishes a moon outpost. Each settled moon has one green house marker on the minimap and the **M → Local Space** chart. Saved bases are indexed from their actual terrain, including older saves; mining away the last constructed module removes the marker.

The smaller green circle marks the moon outpost footprint. A placed beacon adds a **1.2 km signal coverage radius**, shown as a larger green circle with the footprint still visible inside it on the local chart. These rings describe outpost and navigation coverage; combat protection and repair effects are not part of this overlay. Nearby offscreen bases have a green direction marker on the minimap. Your own base locations are available without a scanner receiver.

The local chart's **Bases & Outposts** list shows distance, module count, and radius. A workbench establishes a base; other construction is labelled as an outpost. Click a marker or list entry for its beacon and crafting station details. Coverage updates when construction changes, and base metadata is cached so radar frames do not scan surface terrain grids.

## Inventory and crafting

Press **I** for a 30-slot inventory. Each item defines its own `maxStack`; hover a slot to see its limit.

| Items | Stack limit |
| --- | --- |
| Regolith, iron ore, base blocks | 64 |
| Ice, iron ingots, glass blocks | 32 |
| Crystal, hull plates | 16 |
| Beacons | 8 |
| Workbenches, furnaces | 4 |
| Weapons, scanner receivers | 1 |

Left click a stack, then another slot to move or merge it. **Right click a stack to pick up half**, rounded up for odd quantities. A held stack follows the pointer: left click deposits or merges as much as fits, and right click places one item. Partial merges keep the remainder in hand; full or incompatible stacks reject single-item placement. Left clicking a different item while holding a stack swaps them.

**Return to Bag** returns held items to available space. Closing the inventory attempts the same; if the held items cannot fit, place them before closing. Held items are saved, so reloading does not discard them. Older oversized stacks are split automatically. Any excess that cannot fit stays in **Saved Cargo Overflow**; free slots and choose **Recover Cargo** to bring it into the bag.

Select an item or hold a split stack and click crafting cells to assign ingredients; right click a cell to clear it. Place held items before crafting. Recipe buttons fill the required pattern automatically. Ingredients are consumed only when you press **Craft**, and output capacity is checked before consuming anything.

- Handcraft (2×2): regolith → base blocks or workbench.
- Workbench (3×3): regolith → furnace; iron ingots → hull plates; ingots + crystal → beacon; ingots + plates + crystals → advanced weapons.
- Workbench (3×3): ingots + plates + glass + crystal → scanner receiver.
- Furnace (2×2): iron ore → iron ingot; ice + crystal → glass blocks.

Place stations on a moon and stand within three tiles to access their grids through **I** or **E**. This first prototype uses instant processing without fuel. Hull plates are stored items for future ship upgrades.

## Landing and bases

The first moon, **Selene**, is northeast of the starting point (720, −600). Approach slowly and press **E** or click **Land** when prompted (below 160 m/s). More moons appear throughout the universe.

On the surface: **A/D** move, **Space/W** jump, hold **left click** to mine, **right click** to place the selected hotbar item. **1–6** select base blocks, glass, workbench, furnace, beacon, or regolith. Mining/building is limited by reach and line of sight. Blocks require an adjacent block. Walk near your ship and press **E** or click **Launch** to leave. Away from the ship, **E** opens available station grids.

You start with a small supply of regolith, ore, ice, crystal, base blocks, and one workbench. Your inventory, built moon surfaces, ship position/hull, and surface location save automatically in browser local storage. No account or server is needed. Saves are specific to the browser and origin; file URLs and localhost may have separate saves. Crafting/building saves immediately; movement saves periodically.

Rendering uses native WebGL with procedural faceted asteroid meshes and no runtime JavaScript dependencies. Generated pixel-art item icons are bundled locally in `assets/items/`; their prompts are documented in `ICON_ART.md`. Google Fonts are optional; system fonts are fallbacks. Flight lives in `js/game.js`; combat and the weapon HUD live in `js/weapons.js`; item definitions, recipes, persistent moon terrain, and surface play live in `js/systems.js`; navigation and exploration knowledge live in `js/navigation.js`. Larger ships and ship equipment editing remain future work. Desktop keyboard and mouse are required.

Browser regression checks: `python verify_browser.py --file`, `python verify_weapons.py`, and `python verify_navigation.py` (Python Playwright required). They use isolated contexts and leave the player's save alone.


Missiles use finite ammunition: you start with 8 Rockbreaker rounds. Workbenches craft separate Rockbreaker (4), Penetrator (3), and Seismic (1) ammo batches; stack limits are 16, 8, and 4. Weapon cards show remaining rounds beside the circular cooldown. Empty launchers cannot fire. Primary weapons remain energy powered. Pirate salvage always includes basic ammo, heavy ships also carry advanced rounds, and some ships drop equipment. Fly close to collect salvage; free inventory space for each pack. Existing saves receive the starter ammo once.


Czech localization: choose **CZ** or **EN** in the header. Czech is selected automatically for browsers with a Czech language preference on first visit. Changing language saves your expedition and reloads the interface; the choice is stored separately from gameplay. Item IDs, recipes, controls, and existing saves are unchanged. Translations live in `js/i18n.js`; dynamic UI uses `I18n.t` for plain text and `I18n.html` for markup, keeping identifiers and asset paths intact.


Ship selection appears before your first flight (including older saves without a preset). Use **SHIPS** in the header to change later. Starfox: 18 slots, 700 m/s, agile; Kraxna 1: 60 slots, 340 m/s, tough hull, enhanced mining laser; Nomad: 30 slots, 520 m/s, balanced, Photon Cannon. Switching preserves hull condition, position, equipment, ammo, and all cargo; excess stacks remain recoverable in reserve. Cargo mass reduces acceleration and top speed, with haulers tolerating heavier loads.

Bulterite (**Bulterium** in Czech) is a dense, durable resource with 8 per stack and 12 mass per unit. Find its green mineral veins in space and deep moon deposits; Fotron or Seismic equipment is required to extract it. Heavy pirates can also carry it. Use it to forge hull plates and build the **Fotron Cannon** (tier 3, stronger than Photon). **Bulshitter** (**Bulšitr** in Czech) fires five weak, rapid spread shots for small rocks and scouts; it cannot break reinforced targets. Craft the new energy weapons at a workbench. Use **Q** to cycle primaries or **1–9** to equip HUD cards.

New material and weapon icons are local SVG artwork in `assets/items/`. Run `node js/verify_ships.js` and `node js/verify_localization.js` for dependency-free model checks; these start no browser or graphics context.


Fuel: watch the tank meter beneath hull integrity. Forward/reverse thrust burns fuel; boost burns three times as much. Coasting, rotating, pausing and surface exploration do not use flight fuel. Empty tanks leave 12% solar thrust with boost disabled. **T** or **REFUEL** uses a basic Fuel Cell first, then a green Ion Cube, then blue. You can select a specific fuel stack in inventory and press **REFUEL**. Fuel Cells provide 20 units, green **Ion Cubes / Iontové kostky** provide 80, and **Blue Ion Cubes / Modré iontové kostky** provide 320. Any charge beyond tank capacity remains in the inserted cell and feeds the tank automatically; no fuel is wasted, and another cell cannot be inserted until this charge is used. Starfox/Nomad/Kraxna tank capacities are 100/180/300. Switching ships preserves total fuel. New expeditions and older saves receive a first tank and two green cubes once. Find cubes in asteroids, deep moon deposits and pirate salvage, or craft fuel at furnaces/workbenches. Fuel and remaining cell charge persist with your expedition.


Base navigation: the minimap shows all saved bases and outposts, with green edge arrows for distant locations, without requiring a scanner. The nearest base (or the base you select) is listed below the radar with distance and compass bearing. Both map views list every saved base; the local view retains coverage circles and the global view marks systems containing bases. Select a base from either list to highlight its bearing in amber. Selecting a base in another system opens the global chart. Bearings are direct directions, not wormhole routes. The selected base persists across reloads.


Open the **Encyclopedia** with **B** or its button in the expedition log, inventory or surface HUD. Browse all items, including uncrafted equipment, with icons, descriptions, stack limits, mass, fuel/weapon stats and crafting grids. Filter by category or search names and descriptions; Czech search also accepts text without accents. Ingredient and crafting-use links open related entries. The guide pauses play and restores the previous menu when closed; browsing does not change inventory or consume fuel.


Customize **Quick inventory** in the inventory screen: select a stack and click a numbered slot, or press **1–6** while the inventory is open. Drag a bag item onto a quick slot to assign it, drag one quick slot onto another to swap, and right-click a slot to clear it. Assignments are saved and reference bag contents without moving or duplicating items. Surface **1–6** uses the assigned slot: building items select a block, fuel refuels, and weapons equip. Other materials can be pinned for counts but cannot be placed as terrain. Flight weapon shortcuts remain shown on the weapon cards.

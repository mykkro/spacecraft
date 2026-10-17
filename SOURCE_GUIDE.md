# Working on SPACECRAFT

All JavaScript lives in `js/`, including the lightweight check scripts. HTML,
stylesheets, and assets remain at the project root. Runtime image URLs are relative
to `index.html`, so moving scripts does not change their `assets/items/` URLs.

The game is dependency-free browser JavaScript. `index.html` loads scripts with
`defer` in a fixed order. The files share top-level bindings; they are not ES
modules. Keep that order when adding a system that depends on another one.

## Where to find things

| File | Responsibility |
| --- | --- |
| `js/i18n.js` | English/Czech text, language selection, presentation helpers |
| `js/ships.js` | Ship presets, cargo-dependent handling, reusable hull models |
| `js/audio.js` | Synthesized effects, engine loop, sound settings |
| `js/game.js` | WebGL setup, shared world state, flight physics, scene/radar drawing, frame loop |
| `js/weapons.js` | Weapon definitions, ammunition, cooldowns, projectile hits, hardness gates |
| `js/fuel.js` | Tank contents, retained cell charge, solar fallback, fuel gauge |
| `js/systems.js` | Items, inventory, recipes, expedition saving, moon terrain, building |
| `js/navigation.js` | Systems, wormholes, exploration knowledge, base bearings, maps |
| `js/pirates.js` | Patrol encounters, hostile projectiles, defeated ships, salvage |
| `js/quests.js` | Quest definitions, progress display, reward claims |
| `js/encyclopedia.js` | Searchable item guide, descriptions, stats and recipe diagrams |
| `js/ships-ui.js` | Startup ship selection and coordinated ship changes |

Feature stylesheets follow the same names. `style.css` holds shared layout and
older feature rules. Preserve CSS rule order: later declarations intentionally
override earlier ones. Local item artwork is in `assets/items/`.

## Simulation and rendering

`frame()` in `js/game.js` receives browser timestamps, limits the time step, then
calls `update(dt)` only when play is active. `render()` still runs while paused.
Keep simulation changes out of rendering functions so opening a dialog does not
advance combat, movement, or fuel use.

Flight uses world pixels, with positive X to the right and positive Y downward.
Angles are radians; time steps and cooldowns are seconds. The camera subtracts
the ship position from world coordinates so the ship stays centered.

Moon movement uses tile coordinates. Each tile is 32 pixels; `camera()` and the
surface renderer perform the conversion. Asteroid chunks, moon coordinates, and
star systems have different grid sizes, so do not interchange their IDs.

WebGL shapes append triangles to a shared vertex list. Each vertex contains
`[x, y, red, green, blue, alpha]`. The renderer uploads and draws the batch once
per scene. Seeded randomness controls repeatable world generation; ordinary
`Math.random()` is used for transient effects and fragment motion.

## Inventory and persistence rules

- Item IDs such as `ion_cube` are stable keys. Display names can be translated;
  IDs, asset paths, and save keys must not be translated.
- Six quick slots store item IDs only, not stacks. Keep assignment separate from
  consumption and validate placeable types before editing terrain.
- A bag slot is `null` or `{ type, qty }`. `carried` is the cursor stack;
  `overflow` preserves cargo that no longer fits. They are separate from the bag.
- `Colony.count()` includes all owned stacks. `Colony.availableCount()` counts
  usable bag contents only; ammunition and crafting must not spend reserve cargo.
- `deposit()` mutates its input and returns the remainder. Crafting, pickups,
  and reward claims use trial copies before committing changes.
- Removing inventory items requires an explicit save. Use the existing model
  methods rather than changing the public bag directly.
- Fuel beyond tank capacity remains in the inserted cell. Changing ships must
  conserve total fuel and preserve excess cargo, without granting fresh supplies.
- Station access comes from cached built stations on the current moon, or the moon
  in landing range while in orbit. Carrying machines does not unlock their grids.
- Base metadata is cached after construction changes. Radar rendering must not
  scan whole moon terrain grids.

The main record is `spacecraft-save-v1`. Navigation, pirate defeats, weapon
selection, audio settings, and language use separate browser storage keys.
Validate old records when extending the save format, and preserve cargo instead
of discarding stacks that exceed a new capacity.

## Safe checks

The user reported that browser/WebGL tests clogged their PC. Default to these
small checks, run sequentially:

```powershell
node js/verify_ships.js
node js/verify_fuel.js
node js/verify_base_navigation.js
node js/verify_localization.js
node js/verify_encyclopedia.js
node js/verify_quick_inventory.js
node js/verify_stations.js
```

They use in-memory models and canvas spies; they start no browser, graphics
context, or server. For a simple edit, `node --check js/game.js` checks syntax.
`js/test_source_utils.js` lets VM checks extract named functions without depending
on exact whitespace or minified source snippets.

Browser checks in `verify_*.py` are opt-in under `AGENTS.md`. Ask for the user's
go-ahead before running them, use one browser at a time, and close its processes.

## Editing style

Use UTF-8, two-space indentation, and a final newline (`.editorconfig` supplies
these settings). Keep JavaScript statements and CSS declarations on separate
lines. Explain units, ordering constraints, invariants, and reasons in comments;
avoid comments that merely repeat an obvious assignment. Keep gameplay changes
separate from formatting changes whenever possible.

## Civilian stations

`js/starbases.js` loads between fuel and Colony. It generates station locations on demand, owns credits and crew, renders installations through the existing WebGL primitives, and supplies the docking UI and map markers. Its initialization reads only its saved state; Colony is accessed later during gameplay. `Colony.save()` stores `Starbases.snapshot()` alongside cargo. Sales call `consumeItem(type, quantity, false)` to defer saving until credits and cargo have both changed. Mining bonuses apply only after the hardness gate, engineering modifies fuel consumption, and repair runs only in the active simulation. `starbases.css` styles the dock dialog.

## Mission contracts

`js/missions.js` loads after starbases and before Colony, restoring mission data without calling Colony during initialization. Its API supplies delivery/escort definitions to `js/quests.js`, live mission state, convoy updates and rendering. `Colony.claimQuest()` removes delivery cargo and inserts item rewards into a trial bag, then commits claimed state, credits and the mission snapshot together. Coordinate reveals are idempotent and persist in the chart's existing save.

Escort pirates are separate from territorial patrols, but `Raiders.sweep/hit/blast` include them so existing player weapons work. Mission bullets use `Raiders.segmentCircle` to compare the earliest asteroid, player or courier hit. Mission state records wave count, surviving pirates and in-flight bullets, preventing ambushes from respawning on reload. Update/render hooks are in `js/game.js`; chart/radar hooks keep the courier visible. The station Contracts button opens the quest dialog above docking and preserves the dock pause state.

## Surface rendering and inventory interaction

`js/world-art.js` loads immediately after game.js. It caches normalized asteroid meshes in a WeakMap, shades per-vertex normals against a fixed world light, and emits models through `triGradient` into the existing interleaved vertex buffer. Player hulls, territorial pirates and courier encounters share `WorldArt.drawShip`. The current asteroid renderer uses the separate depth-tested pass described below; ships and the fallback asteroid renderer use this batch.

`js/display-options.js` loads last, owns the paused options dialog and the `spacecraft-display-v1` preference record, and updates the `--hud-scale` CSS variable. `display-options.css` contains readable HUD baselines and options layout.

Inventory drag payloads carry a real source index and an optional split quantity. `moveInventoryStack` validates and mutates stacks, while `applyInventoryDrop` routes bag, crafting-cell and ship-socket drops. Recipe and quick slots stay references; only bag moves, crafting, firing or explicit refuelling consume/change cargo. Outfitting reads existing weapon selection and fuel state rather than introducing a second equipment inventory. Inventory scroll positions survive DOM rebuilds. Layout rules at the end of inventory.css keep the shell fixed and give its content regions independent scrolling.

## Fabrication queue

Colony owns the bounded crafting queue. `craft()` validates station/material access, removes ingredients, and stores a recipe reference, duration remaining and source moon. `updateCrafting(dt)` advances the head job only when its workshop is connected, then tries output insertion into a copy of the bag. Failed insertion retains completed output. Cancellation refunds into bag/overflow; queued ingredients and completed output contribute to cargo mass.

The frame calls `Colony.updateCrafting` outside the physics pause guard so the inventory can show live crafting. Queue snapshots use stable station/output/quantity/pattern recipe keys, validate loaded records, and store with cargo in `spacecraft-save-v1`. Timers save periodically and on job events. Queue UI meters are throttled to avoid continuously rebuilding the inventory. `verify_crafting_queue.js` checks reservation, delayed output, station disconnects, capacity, refund overflow and save/reload.

## Shields

`js/shields.js` loads before Colony, restores only its own save fields at initialization, and uses runtime Colony calls to validate ownership. Damage flows through `damageShip`: invulnerability, shield absorption, then hull armor. Charge and hull are saved together after a hit. Territorial and escort bullets use the active shield collision radius; the courier has no player shield. `Shields.update` runs only during active flight and delays recharge after each hit; `Shields.render` emits the outline through the existing triangle batch.

The equipment socket and quick slots reference owned generator items. Consuming an equipped generator for an upgrade or removing it from cargo reconciles protection immediately. Shield recipes use the existing queue with tier-specific 25/30/35-second durations. State lives in the expedition's `shield` field. `verify_shields.js` checks the real hull-damage path, ownership, no-refill swapping, tier balance, timed upgrades and persistence.

## Volumetric asteroids and gravity hazards

`js/asteroids-3d.js` owns deterministic closed meshes, crater displacement and finite-difference normals. Its indexed GPU buffers carry XYZ positions, normals and a mineral signal. The fragment shader uses procedural noise, GGX-style roughness/metallic lighting and material seams. A 96-entry LRU deletes old buffers; quality and radius select mesh density. The rendering function restores depth/blend/attribute state even on failure.

`game.js` flushes the 2D background, submits the depth-tested asteroid pass, restores the 2D program/buffer, and flushes foreground effects and ships. All passes share the original context. `WorldArt.drawRock` is now the compatibility fallback. `js/space-effects.js` stores at most 48 short-lived explosion effects.

`js/black-holes.js` generates one possible hazard per system without a world cache. Apply gravity after moon collision constraints and check swept horizon capture after moving the player. Rock/salvage attraction runs only in active flight. Recovery bypasses shields, commits hull/charge and resets the local transient world at the origin. Navigation uses the same generated hazard coordinates for map coverage, global markers and radar bearings. Geometry/GL-spy and physics checks do not create a browser or GPU context.

## Distant scenery

js/deep-space.js bakes seeded triangle meshes into a 72-tile LRU. Nebulae and stellar halos use transparent gradient fans; planetary discs use spherical normals, day/night lighting and procedural terrain or gas bands. The three camera scales are 0.025, 0.055 and 0.11. It submits to the shared 2D batch before the starfield, moons and asteroid pass, with no extra GPU context, textures or physics objects. Tile selection and triangle culling depend on the viewport; generation depends only on tile coordinates. verify_deep_space.js checks deterministic geometry, visible rendering and cache bounds without a browser.

Named saves: js/profiles.js loads before Shipyard and scopes expedition, chart, weapon and pirate storage by stable profile ID. The profile manifest stores display names and the next active ID. Its session ID remains fixed until reload so outgoing beforeunload handlers cannot write old progress into the new profile. Legacy records are copied before the manifest is published, with originals retained. js/profiles-ui.js provides the paused New Game / Load Profile dialog. Browser preferences stay global.

Character discovery lives in Starbases: the saved met set uses validated stable character IDs, with legacy hired crew inferred on load. Confirmed starting crew are remembered in expedition snapshots, docking marks the three available specialists met, and hiring records the encounter atomically with credits. Starbases.characters returns localized presentation records without changing discovery. Encyclopedia merges these records into its catalogue under namespaced character IDs and renders character details separately from item stats.

Portable crafting: stationAccess adds bench access when count(portable_workbench) is positive in usable bag slots. Newly queued portable workbench jobs use the validated portable moonId sentinel. jobConnected allows bench jobs to use a carried portable station or a physical moon workbench, preserving physical furnace range rules. Recipe keys and existing queue records remain compatible; portable equipment is not placeable and does not alter the base index.

Parallel queues retain the existing flat craftingQueue save array for compatibility. craftLane maps furnace recipes to the furnace lane and hand/bench recipes to workbench; laneJobs enforces independent FIFO order and 12-job capacity. updateCrafting snapshots one head per lane and advances each once per tick, with atomic trial output insertion and one shared cargo/save refresh. Restore accepts up to 24 validated records, capped at 12 per lane. Public queue snapshots expose station and lane. verify_parallel_crafting.js checks simultaneous timers, independent pauses, FIFO ordering, refunds, capacity and reload.

js/quest-tracker.js loads before Colony so trackedQuest survives initialization saves; quest definitions and target resolution are deferred until runtime. Colony snapshots the selected quest ID. QuestLog offers track/untrack controls. Targets are resolved from live courier, station, asteroid and moon state; waypoint chooses a cardinal wormhole reducing Manhattan system distance. This quest route is independent of scanner/base tracking. Navigation renders quest overlays last; global bounds include the goal system. The radar clamps distant targets at the edge with an arrow. verify_quest_tracking.js checks real navigation/quest targets and storage using a canvas spy.

js/flight-transitions.js is a single bounded screen-space effect driven by frame dt; it has no own RAF, timers or GPU context. Original transit/recovery functions still relocate and save immediately, then start a visual transition. The frame updates its timer outside the menu pause guard, skips flight physics while active and renders its overlay after the world. It never changes paused, so menus retain ownership. Reduced motion skips moving geometry. verify_flight_transitions.js exercises lifetime, geometry, actual wormhole entry and destruction hooks without a browser.

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

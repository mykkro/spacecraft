/**
 * Preset data and reusable ship models. Selection does not create or destroy inventory.
 * Fuel, cargo resizing, and HUD updates are coordinated by ships-ui.js.
 */

// Ship identity and handling are independent of inventory item IDs.
const Shipyard = (() => {
  const presets = {
    starfox: {
      id: 'starfox',
      name: 'Starfox',
      captain: 'You',
      startingCrew: [],
      role: 'INTERCEPTOR',
      description: 'Fast and agile. Small cargo hold; ideal for scouting and dogfights.',
      fuelCapacity: 100,
      fuelBurn: .7,
      slots: 18,
      thrust: 310,
      boostThrust: 630,
      speed: 700,
      boostSpeed: 1100,
      turn: 4.5,
      massTolerance: 350,
      damageTaken: 1.12,
      primary: 'pulse',
      color: '#83d9f0'
    },
    kraxna: {
      id: 'kraxna',
      name: 'Kraxna 1',
      captain: 'Jegor Kokotovič',
      startingCrew: [{id: 'bobo', name: 'Bobo', repairDiscount: .5}],
      role: 'SALVAGE HAULER',
      description: 'A space garbage truck. Slow, durable, huge cargo hold and an enhanced mining laser.',
      fuelCapacity: 300,
      fuelBurn: 1.4,
      slots: 60,
      thrust: 130,
      boostThrust: 290,
      speed: 340,
      boostSpeed: 560,
      turn: 1.75,
      massTolerance: 2500,
      damageTaken: .72,
      primary: 'mininglaser',
      color: '#b9c888'
    },
    nomad: {
      id: 'nomad',
      name: 'Nomad',
      captain: 'You',
      startingCrew: [],
      role: 'MULTIROLE FREIGHTER',
      description: 'A balanced freighter with dependable handling, cargo space and a Photon Cannon.',
      fuelCapacity: 180,
      fuelBurn: 1,
      slots: 30,
      thrust: 215,
      boostThrust: 480,
      speed: 520,
      boostSpeed: 850,
      turn: 3,
      massTolerance: 900,
      damageTaken: 1,
      primary: 'photon',
      color: '#dfb878'
    }
  };
  let current = presets.nomad,
    confirmed = false;
  try {
    const data = JSON.parse((typeof Profiles === 'undefined' ? localStorage : Profiles).getItem('spacecraft-save-v1') || 'null');
    if (Object.hasOwn(presets, (data?.shipPreset))) {
      current = presets[data.shipPreset];
      confirmed = true;
    }
  } catch {
  }

  // Only change preset identity here; callers handle cargo and fuel migration afterwards.
  function choose(id) {
    if (!Object.hasOwn(presets, id))
      return false;
    current = presets[id];
    confirmed = true;
    return true;
  }

  // Heavy cargo reduces thrust and top speed according to the preset\'s load tolerance.
  function handling(mass = 0) {
    const load = 1 + Math.max(0, Number.isFinite(mass) ? mass : 0) / current.massTolerance;
    return {
      thrust: current.thrust / load,
      boostThrust: current.boostThrust / load,
      speed: current.speed / Math.sqrt(load),
      boostSpeed: current.boostSpeed / Math.sqrt(load),
      turn: current.turn
    };
  }

  // Menu previews use local vector shapes rather than loading a separate image per ship.
  function preview(id) {
    const p = presets[id],
      shapes = id === 'kraxna' ? '<path d="M37 16h26v66H37zM19 32h16v43H19zM65 32h16v43H65z"/><path d="M40 23h20v13H40z" fill="#80d9e8"/>' : id === 'starfox' ? '<path d="M50 8 62 48 88 79 57 68 50 80 43 68 12 79 38 48z"/><path d="m50 24 5 28H45z" fill="#80d9e8"/>' : '<path d="M28 26 42 17h24l14 21v31L65 84H35L20 69V38zM35 21v22h10V12h10v31h10V21"/><path d="M70 27h16v24H70z" fill="#80d9e8"/>';
    return '<svg viewBox="0 0 100 100" aria-hidden="true"><g fill="' + p.color + '" stroke="#182b38" stroke-width="2">' + shapes + '</g><path d="M39 86h22" stroke="#f1a867" stroke-width="4"/></svg>';
  }

  // Flight and moon landing scenes share this hull renderer with different scale/position.
  function drawFlightShip(ox, oy, angle, alpha = 1, scale = 1) {
    const thrust = !paused && typeof keys !== 'undefined' && (keys.has('KeyW') || keys.has('ArrowUp'));
    WorldArt.drawShip(current.id, ox, oy, angle, alpha, scale, thrust);
  }
  return {
    presets,
    choose,
    handling,
    preview,
    drawFlightShip,
    get current() {
      return current;
    },
    get confirmed() {
      return confirmed;
    }
  };
})();

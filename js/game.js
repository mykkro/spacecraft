/**
 * Flight simulation and raw WebGL rendering.
 * Coordinates use world pixels: +X points right, +Y points down, and angles are radians.
 * The ship stays at the screen center; rendering subtracts its world position.
 * See SOURCE_GUIDE.md for script order, shared state, and the other game systems.
 */

// WebGL setup: shaders and the shared vertex buffer are created once.
const canvas = document.querySelector('#space');
const gl = canvas.getContext('webgl', {
  antialias: true,
  alpha: false
});
if (!gl) {
  document.querySelector('#toast').textContent = I18n.t('WebGL is unavailable. Please enable hardware acceleration.');
  throw new Error('WebGL unavailable');
}
const vs = `attribute vec2 a_position; attribute vec4 a_color; uniform vec2 u_resolution; varying vec4 v_color; void main(){ vec2 p=a_position/u_resolution*2.0-1.0;gl_Position=vec4(p.x,-p.y,0,1);v_color=a_color;}`;
const fs = `precision mediump float; varying vec4 v_color;void main(){gl_FragColor=v_color;}`;

// Compile once at startup. Compilation errors include the driver log for debugging.
function shader(type, source) {
  const s = gl.createShader(type);
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw Error(gl.getShaderInfoLog(s));
  return s;
}
const program = gl.createProgram();
gl.attachShader(program, shader(gl.VERTEX_SHADER, vs));
gl.attachShader(program, shader(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS))
  throw Error(gl.getProgramInfoLog(program));
gl.useProgram(program);
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
const pos = gl.getAttribLocation(program, 'a_position'),
  color = gl.getAttribLocation(program, 'a_color');
gl.enableVertexAttribArray(pos);
gl.enableVertexAttribArray(color);
// Each vertex occupies 6 floats / 24 bytes: 2 position floats followed by 4 color floats.
gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 24, 0);
gl.vertexAttribPointer(color, 4, gl.FLOAT, false, 24, 8);
const resolution = gl.getUniformLocation(program, 'u_resolution');
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
let width = innerWidth,
  height = innerHeight,
  vertices = [];

// Keep physics in CSS pixels while the backing canvas uses a capped pixel ratio.
function resize() {
  width = innerWidth;
  height = innerHeight;
  const dpr = Math.min(devicePixelRatio, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform2f(resolution, width, height);
}
addEventListener('resize', resize);
resize();

// Append an interleaved vertex: position (x, y), then color (r, g, b, alpha).
// All shapes share one buffer upload at the end of the frame.
function tri(a, b, c, col) {
  for (const p of [a, b, c])
    vertices.push(p[0], p[1], ...col);
}

// Per-vertex colors interpolate across shaded surfaces using the same buffer/shader.
function triGradient(a, b, c, ca, cb, cc) {
  for (const [p, col] of [[a, ca], [b, cb], [c, cc]]) vertices.push(p[0], p[1], ...col);
}


function flush2D() {
  // The asteroid pass has its own attributes/program; restore the shared 2D batch.
  gl.useProgram(program); gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(pos); gl.enableVertexAttribArray(color);
  gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 24, 0);
  gl.vertexAttribPointer(color, 4, gl.FLOAT, false, 24, 8);
  gl.uniform2f(resolution, width, height);
  if (vertices.length) {
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.TRIANGLES, 0, vertices.length / 6);
    vertices = [];
  }
}

// A thick line is a pair of triangles, avoiding platform-dependent WebGL line widths.
function line(a, b, col, w = 1) {
  const dx = b[0] - a[0],
    dy = b[1] - a[1],
    l = Math.hypot(dx, dy) || 1,
    x = -dy / l * w / 2,
    y = dx / l * w / 2;
  tri([a[0] + x, a[1] + y], [a[0] - x, a[1] - y], [b[0] + x, b[1] + y], col);
  tri([b[0] + x, b[1] + y], [a[0] - x, a[1] - y], [b[0] - x, b[1] - y], col);
}
function disc(x, y, r, col, n = 10) {
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2,
      b = (i + 1) / n * Math.PI * 2;
    tri([x, y], [x + Math.cos(a) * r, y + Math.sin(a) * r], [x + Math.cos(b) * r, y + Math.sin(b) * r], col);
  }
}

// Seeded generator for repeatable chunks, moons, and star fields.
// Keep seeded randomness separate from cosmetic Math.random() effects.
function random(seed) {
  let a = seed | 0;
  return () => {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// Shared world state. The later scripts use these bindings through their public APIs.
const ship = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    hull: 100,
    invulnerable: 2
  },
  keys = new Set(),
  rocks = [],
  shots = [],
  particles = [],
  drops = [],
  chunks = new Map();
const cargo = {
  metal: 0,
  ice: 0,
  crystal: 0,
  bulterite: 0
};
let kills = 0,
  paused = false,
  last = 0,
  time = 0,
  toastTimer = 4,
  shake = 0,
  radarTimer = 0;
const palettes = {
  ion_cube: [.22, .84, .43],
  blue_ion_cube: [.22, .55, 1],
  bulterite: [.29, .48, .37],
  metal: [.32, .35, .36],
  ice: [.34, .52, .59],
  crystal: [.45, .39, .52]
};

// Build a reusable asteroid model. Radius controls size; hardness gates weapon tiers.
// Special minerals keep their own minimum hardness when they fragment.
function rock(x, y, r, seed, type) {
  const rng = random(seed),
    count = 9 + Math.floor(rng() * 5),
    points = [];
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2;
    const radius = r * (.74 + rng() * .3);
    points.push([Math.cos(a) * radius, Math.sin(a) * radius]);
  }
  const roll = Math.abs(seed) % 100,
    hardness = type === 'bulterite' ? 3
      : type === 'blue_ion_cube' ? 2
      : type === 'ion_cube' ? 1
      : r > 65
        ? roll < 14 ? 3
          : roll < 32 ? 2
          : roll < 55 ? 1
          : 0
        : r > 35 && roll < 15 ? 1 : 0;
  return {
    x,
    y,
    r,
    seed,
    type,
    points,
    hardness,
    angle: rng() * 7,
    spin: (rng() - .5) * .25,
    vx: (rng() - .5) * 7,
    vy: (rng() - .5) * 7,
    hp: (r > 65 ? 5 : r > 35 ? 2 : 1) + hardness * 3 + (type === 'bulterite' ? 10 : 0)
  };
}

// Populate nearby 1,400-unit chunks on demand instead of simulating the whole universe.
function generate() {
  const cx = Math.floor(ship.x / 1400),
    cy = Math.floor(ship.y / 1400);
  for (let xx = cx - 2; xx <= cx + 2; xx++)
    for (let yy = cy - 2; yy <= cy + 2; yy++) {
      const key = `${ xx },${ yy }`;
      if (chunks.has(key))
        continue;
      chunks.set(key, true);
      const rng = random(Math.imul(xx, 73856093) ^ Math.imul(yy, 19349663) ^ 12345);
      for (let i = 0; i < 15; i++) {
        const x = (xx + rng()) * 1400,
          y = (yy + rng()) * 1400;
        if (Math.hypot(x, y) < 210)
          continue;
        const r = 18 + Math.pow(rng(), 1.7) * 95,
          seed = Math.floor(rng() * 1e8),
          v = rng();
        rocks.push(rock(
          x, y, r, seed,
          v < .006 ? 'blue_ion_cube'
            : v < .035 ? 'bulterite'
            : v < .06 ? 'ion_cube'
            : v < .22 ? 'ice'
            : v < .3 ? 'crystal'
            : 'metal'
        ));
      }
    }
}
generate();
// A few readable targets close to the initial flight path.
rocks.push(rock(-570, 340, 85, 78531, 'bulterite'), rock(600, -420, 36, 78532, 'ion_cube'));
rocks.push(rock(190, -200, 47, 865, 'metal'), rock(-245, -140, 80, 123, 'ice'), rock(340, 150, 105, 234, 'metal'), rock(-170, 230, 29, 425, 'crystal'));
// Nearby examples: copper bands = reinforced; violet = resonant; amber = ultradense.
for (const [x, y, r, seed, tier] of [
    [-430, -320, 74, 450, 1],
    [460, -320, 86, 1025, 2],
    [540, 380, 100, 1005, 3]
  ]) {
  const target = rock(x, y, r, seed, 'metal');
  target.hardness = tier;
  target.hp = 5 + tier * 3;
  rocks.push(target);
}
function notify(message) {
  document.querySelector('#toast').textContent = I18n.t(message);
  toastTimer = 3.5;
}
function burst(x, y, col, count = 16, force = 100) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2,
      s = Math.random() * force;
    particles.push({
      x,
      y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: .3 + Math.random() * .6,
      max: 1,
      col,
      size: 1 + Math.random() * 2
    });
  }
}

// Large rocks split; small rocks release collectible resources.
// Mining drops are tagged so pirate salvage cannot increase mining quest progress.
function destroy(r) {
  GameAudio.play('explosion', {
    x: r.x,
    y: r.y,
    intensity: Math.min(1.25, .35 + r.r / 120)
  });
  kills++;
  if (typeof SpaceEffects !== 'undefined') SpaceEffects.spawn(r.x, r.y, r.r, r.type);
  burst(r.x, r.y, palettes[r.type], r.r, 120);
  if (r.r > 32) {
    for (let i = 0; i < 3; i++) {
      const a = i / 3 * Math.PI * 2 + Math.random() * .4,
        child = rock(r.x + Math.cos(a) * r.r * .35, r.y + Math.sin(a) * r.r * .35, r.r * .46, r.seed + i + 1, r.type);
      child.hardness = r.type === 'bulterite' ? 3 : r.type === 'blue_ion_cube' ? 2 : Math.max(0, (r.hardness || 0) - 1);
      child.hp = (child.r > 35 ? 2 : 1) + child.hardness * 3 + (r.type === 'bulterite' ? 10 : 0);
      child.vx = r.vx + Math.cos(a) * 28;
      child.vy = r.vy + Math.sin(a) * 28;
      rocks.push(child);
    }
  } else {
    for (let i = 0; i < 3; i++)
      drops.push({
        x: r.x + (Math.random() - .5) * 20,
        y: r.y + (Math.random() - .5) * 20,
        type: r.type,
        life: 90,
        source: 'mining'
      });
  }
}
function fire(missile = false) {
  return Weapons.fire(missile ? 'missile' : 'primary');
}

// Collisions and pirate shots share hull damage, invulnerability, and emergency recovery.
// Recovery keeps inventory and fuel; it does not start a new expedition.
function damageShip(amount, message = I18n.t('HULL DAMAGE'), grace = 1) {
  if (!Number.isFinite(amount) || amount <= 0 || ship.invulnerable > 0)
    return false;
  const remaining = typeof Shields !== 'undefined' ? Shields.absorb(amount) : amount;
  const protectedHit = remaining < amount;
  GameAudio.play('collision', { intensity: Math.min(1.2, .55 + amount / 35) });
  ship.hull = Math.max(0, ship.hull - remaining * Shipyard.current.damageTaken);
  ship.invulnerable = grace;
  shake = protectedHit && remaining === 0 ? 1.5 : 5;
  burst(ship.x, ship.y, protectedHit ? [.35, .68, 1] : [.8, .45, .25], 18, 90);
  if (ship.hull <= 0) {
    GameAudio.play('explosion', { intensity: 1.3 });
    if (typeof SpaceEffects !== 'undefined') SpaceEffects.spawn(ship.x, ship.y, 75, 'metal');
    if (typeof FlightTransitions !== 'undefined') FlightTransitions.start('respawn');
    ship.hull = 100;
    ship.vx = ship.vy = 0;
    ship.x = ship.y = 0;
    ship.invulnerable = 4;
    if (typeof Raiders !== 'undefined')
      Raiders.resetEncounter();
    notify(I18n.t('EMERGENCY RECOVERY · VESSEL RESTORED'));
  } else
    notify(remaining === 0 ? I18n.t('SHIELD ABSORBED HIT') : message);
  if (typeof Colony !== 'undefined') Colony.save();
  return true;
}

// Inventory doubles as the pause screen. Other dialogs retain their own pause state.
function showPanel(mode = 'inventory') {
  if (typeof Colony === 'undefined')
    return;
  if (typeof QuestLog !== 'undefined' && QuestLog.isOpen)
    return;
  if (typeof StarChart !== 'undefined' && StarChart.mapOpen)
    return;
  paused = true;
  keys.clear();
  document.querySelector('#overlay').hidden = false;
  document.querySelector('#overlayTitle').textContent = mode === 'pause' ? I18n.t('Expedition paused') : I18n.t('Inventory & crafting');
  document.querySelector('#overlayDescription').textContent = mode === 'pause' ? I18n.t('Your expedition is paused. Inventory and crafting are available below.') : I18n.t('Left click to select; right click to pick up half. Place held items into slots or merge with matching stacks.');
  Colony.openInventory();
  document.querySelector('#resume').focus();
}

// Return any held stack before closing so inventory movement cannot lose items.
function resume() {
  if (!Colony.closeInventory())
    return;
  paused = false;
  document.querySelector('#overlay').hidden = true;
}
addEventListener('keydown', e => {
  if (typeof QuestLog !== 'undefined' && QuestLog.isOpen)
    return;
  if (typeof StarChart !== 'undefined' && StarChart.mapOpen)
    return;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))
    return;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code))
    e.preventDefault();
  if (e.repeat)
    return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    paused ? resume() : showPanel('pause');
    return;
  }
  if (e.code === 'KeyI' || e.code === 'Tab') {
    paused ? resume() : showPanel();
    return;
  }
  if (!paused)
    keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => {
  keys.clear();
  if (!paused)
    showPanel('pause');
});
document.querySelector('#pause').onclick = () => paused ? resume() : showPanel('pause');
document.querySelector('#inventory').onclick = () => showPanel();
document.querySelector('#close').onclick = resume;
document.querySelector('#resume').onclick = resume;

// Advance flight simulation in seconds. Moon exploration takes an early exit.
// Order matters: movement, firing, swept projectile hits, rock collisions, then pickups.
function update(dt) {
  if (typeof Shields !== 'undefined' && !Colony.onSurface) Shields.update(dt);
  if (typeof Starbases !== 'undefined') Starbases.update(dt);
  if (typeof StarChart !== 'undefined')
    StarChart.update(dt);
  if (typeof Raiders !== 'undefined')
    Raiders.update(dt);
  if (typeof MissionContracts !== 'undefined') MissionContracts.update(dt);
  if (Colony.onSurface) {
    Colony.updateSurface(dt);
    return;
  }
  Colony.updateSpace();
  if (typeof Salvage !== 'undefined') Salvage.update();
  if (typeof BlackHoles !== 'undefined') BlackHoles.applyGravity(dt);
  if (typeof SpaceEffects !== 'undefined') SpaceEffects.update(dt);
  time += dt;
  ship.invulnerable -= dt;
  toastTimer -= dt;
  shake = Math.max(0, shake - dt * 15);
  const turn = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const handling = Shipyard.handling(Colony.cargoMass);
  ship.angle += turn * handling.turn * dt;
  const thrust = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0),
    boostRequested = keys.has('ShiftLeft') || keys.has('ShiftRight'),
    drive = Fuel.drive(thrust, boostRequested, dt),
    boost = drive.boost;
  const power = thrust * (boost ? handling.boostThrust : handling.thrust) * drive.thrustScale;
  ship.vx += Math.sin(ship.angle) * power * dt;
  ship.vy -= Math.cos(ship.angle) * power * dt;
  // Exponential drag remains consistent when the frame rate changes.
  ship.vx *= Math.exp(-dt * .14);
  ship.vy *= Math.exp(-dt * .14);
  const speed = Math.hypot(ship.vx, ship.vy),
    limit = boost ? handling.boostSpeed : handling.speed;
  if (speed > limit) {
    ship.vx *= Math.exp(-dt * 1.5);
    ship.vy *= Math.exp(-dt * 1.5);
  }
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
  if (typeof BlackHoles !== 'undefined' && BlackHoles.checkCapture()) return;
  GameAudio.setEngine(thrust * (drive.solar ? .2 : 1), boost);
  if (thrust && Math.random() < .7) {
    const d = thrust > 0 ? -1 : 1;
    particles.push({
      x: ship.x + Math.sin(ship.angle) * 17 * d,
      y: ship.y - Math.cos(ship.angle) * 17 * d,
      vx: ship.vx + Math.sin(ship.angle) * d * (boost ? 200 : 100) + (Math.random() - .5) * 25,
      vy: ship.vy - Math.cos(ship.angle) * d * (boost ? 200 : 100) + (Math.random() - .5) * 25,
      life: .3,
      max: .3,
      col: drive.solar ? [.4, .65, .8] : boost ? [.5, .8, 1] : [.9, .61, .28],
      size: 2
    });
  }
  Weapons.update(dt);
  generate();
  Weapons.updateProjectiles(dt);
  if (typeof Salvage !== 'undefined') Salvage.collide();
  // Resolve hull overlap and reflect incoming velocity along the collision normal.
  for (const r of rocks) {
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    r.angle += r.spin * dt;
    const dx = ship.x - r.x,
      dy = ship.y - r.y,
      dist = Math.hypot(dx, dy),
      min = r.r * .83 + 12;
    if (dist < min) {
      const nx = dist ? dx / dist : 1,
        ny = dist ? dy / dist : 0;
      ship.x = r.x + nx * min;
      ship.y = r.y + ny * min;
      const dot = ship.vx * nx + ship.vy * ny;
      if (dot < 0) {
        ship.vx -= 1.5 * dot * nx;
        ship.vy -= 1.5 * dot * ny;
      }
      damageShip(Math.min(24, 8 + Math.abs(dot) * .045), I18n.t('COLLISION · HULL DAMAGE'));
    }
  }
  // Walk removable collections backwards so splicing never skips the next entry.
  // Pickups commit only when the entire salvage pack fits in the bag.
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i],
      dx = ship.x - d.x,
      dy = ship.y - d.y,
      dist = Math.hypot(dx, dy);
    d.life -= dt;
    if (dist < 170) {
      d.x += dx * dt * 3;
      d.y += dy * dt * 3;
    }
    if (dist < 24 && Colony.addItem(d.type, d.qty || 1)) {
      GameAudio.play('pickup');
      if (d.source === 'mining')
        Colony.recordMined(d.type, d.qty || 1);
      else
        Colony.save();
      drops.splice(i, 1);
      notify(I18n.t(`+${ d.qty || 1 } ${ Colony.items[d.type].name.toUpperCase() } RECOVERED`));
    } else if (d.life <= 0)
      drops.splice(i, 1);
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0)
      particles.splice(i, 1);
  }
  // Keep nearby rocks and chunk records only. History prevents duplicate spawning nearby;
  // distant records are eventually discarded to keep memory bounded.
  for (let i = rocks.length - 1; i >= 0; i--)
    if (Math.abs(rocks[i].x - ship.x) > 4900 || Math.abs(rocks[i].y - ship.y) > 4900)
      rocks.splice(i, 1);
  if (chunks.size > 400) {
    for (const key of chunks.keys()) {
      const [x, y] = key.split(',').map(Number);
      if (Math.abs(x - Math.floor(ship.x / 1400)) > 8 || Math.abs(y - Math.floor(ship.y / 1400)) > 8)
        chunks.delete(key);
    }
  }
  document.querySelector('#speed').textContent = Math.round(Math.hypot(ship.vx, ship.vy));
  document.querySelector('#hullText').textContent = `${ Math.ceil(ship.hull) }%`;
  document.querySelector('#hullBar').style.width = `${ ship.hull }%`;
  document.querySelector('#position').textContent = `${ Math.round(ship.x) } / ${ Math.round(-ship.y) }`;
  document.querySelector('#sector').textContent = I18n.t(`SECTOR ${ Math.floor(ship.x / 1400) } : ${ Math.floor(-ship.y / 1400) }`);
  document.querySelector('#kills').textContent = kills;
  for (const type of Object.keys(cargo))
    document.querySelector(`#${ type }`).textContent = cargo[type];
  document.querySelector('#toast').style.opacity = toastTimer > 0 ? 1 : 0;
  radarTimer -= dt;
  if (radarTimer <= 0) {
    radar();
    Weapons.scan();
    radarTimer = .12;
  }
}
const stars = Array.from({ length: 650 }, (_, i) => {
  const rng = random(i * 781 + 54);
  return {
    x: rng() * 3000,
    y: rng() * 2000,
    z: .15 + rng() * .65,
    size: .4 + rng() * .9,
    alpha: .15 + rng() * .5
  };
});
const mod = (v, n) => (v % n + n) % n;

// Render the current scene without advancing simulation, including while paused.
// Only nearby world objects are converted into screen coordinates.
function render() {
  if (Colony.onSurface) {
    Colony.renderSurface();
    return;
  }
  vertices = [];
  gl.clearColor(.024, .039, .061, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  if (typeof DeepSpace !== 'undefined') DeepSpace.render();
  for (const s of stars) {
    const x = mod(s.x - ship.x * s.z, width + 100) - 50,
      y = mod(s.y - ship.y * s.z, height + 100) - 50;
    disc(x, y, s.size, [.66, .77, .85, s.alpha], 4);
  }
  // Camera shake is visual only; collision coordinates remain unchanged.
  const ox = width / 2 + (Math.random() - .5) * shake,
    oy = height / 2 + (Math.random() - .5) * shake;
  const screen = (x, y) => [x - ship.x + ox, y - ship.y + oy];
  Colony.renderMoons(screen);
  if (typeof BlackHoles !== 'undefined') BlackHoles.render(screen);
  if (typeof Starbases !== 'undefined') Starbases.render(screen);
  if (typeof MissionContracts !== 'undefined') MissionContracts.render(screen);
  if (typeof StarChart !== 'undefined')
    StarChart.renderWormholes(screen);
  // A quiet navigation grid that drifts with the world.
  for (let x = mod(-ship.x, 400); x < width; x += 400)
    for (let y = mod(-ship.y, 400); y < height; y += 400) {
      line([x - 4, y], [x + 4, y], [.4, .55, .65, .09]);
      line([x, y - 4], [x, y + 4], [.4, .55, .65, .09]);
    }
  flush2D();
  Asteroid3D.render(gl, rocks, screen, width, height, typeof DisplayOptions !== 'undefined' ? DisplayOptions.asteroidQuality : 'balanced');
  flush2D();
  if (typeof Salvage !== 'undefined') Salvage.render(screen);
  Weapons.renderRockMarks(screen);
  if (typeof Raiders !== 'undefined')
    Raiders.render(screen);
  for (const d of drops) {
    const [x, y] = screen(d.x, d.y),
      col = palettes[d.type] || ((Colony.items[d.type]?.ammoFor) ? [1, .7, .3] : [.6, .9, 1]);
    disc(x, y, 9, [...col, .07]);
    const v = 3 + Math.sin(time * 3) * .5;
    tri([x, y - v], [x + v, y], [x, y + v], [...col, 1]);
    tri([x, y - v], [x - v, y], [x, y + v], [...col, .7]);
  }
  for (const p of particles) {
    const [x, y] = screen(p.x, p.y);
    disc(x, y, p.size, [...p.col, Math.min(1, p.life / (p.max || 1))], 5);
  }
  for (const b of shots) {
    const [x, y] = screen(b.x, b.y),
      l = Math.hypot(b.vx, b.vy) || 1;
    line([x, y], [
      x - b.vx / l * (b.weaponId === 'laser' ? 48 : b.missile ? 18 : 13),
      y - b.vy / l * (b.weaponId === 'laser' ? 48 : b.missile ? 18 : 13)
    ], [...b.tint, .95], b.missile ? 3 : b.weaponId === 'laser' ? 3.5 : 1.7);
  }
  if (typeof SpaceEffects !== 'undefined') SpaceEffects.render(screen);
  const blink = ship.invulnerable > 0 && Math.sin(time * 20) > 0 ? .45 : 1;
  Shipyard.drawFlightShip(ox, oy, ship.angle, blink);
  if (typeof Shields !== 'undefined') Shields.render(ox, oy, ship.angle);
  // Heading ticks remain centered on the vessel.
  for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2;
    line([ox + Math.sin(a) * 62, oy - Math.cos(a) * 62], [ox + Math.sin(a) * (i % 8 ? 65 : 69), oy - Math.cos(a) * (i % 8 ? 65 : 69)], [.5, .65, .71, i % 8 ? .12 : .35]);
  }
  const a = ship.angle;
  line([ox + Math.sin(a) * 75, oy - Math.cos(a) * 75], [ox + Math.sin(a) * 83, oy - Math.cos(a) * 83], [.88, .71, .45, .8], 2);
  // Submit the accumulated triangles in one draw call rather than one call per shape.
  flush2D();
}
const ctx = document.querySelector('#radar').getContext('2d');

// The radar has its own fixed scale; base and wormhole bearings can sit at its edge.
function radar() {
  ctx.clearRect(0, 0, 156, 156);
  ctx.strokeStyle = '#718b9b33';
  ctx.lineWidth = 1;
  for (const r of [25, 50, 74]) {
    ctx.beginPath();
    ctx.arc(78, 78, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, 78);
  ctx.lineTo(156, 78);
  ctx.moveTo(78, 0);
  ctx.lineTo(78, 156);
  ctx.stroke();
  for (const r of rocks) {
    const x = (r.x - ship.x) / 16,
      y = (r.y - ship.y) / 16;
    if (Math.hypot(x, y) > 74)
      continue;
    ctx.fillStyle = r.type === 'ice' ? '#85bbc4' : '#8f9491';
    ctx.fillRect(78 + x, 78 + y, r.r > 65 ? 3 : 2, r.r > 65 ? 3 : 2);
  }
  ctx.save();
  ctx.translate(78, 78);
  ctx.rotate(ship.angle);
  ctx.fillStyle = '#dfb878';
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(-3, 4);
  ctx.lineTo(3, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  if (typeof StarChart !== 'undefined')
    StarChart.drawRadar(ctx);
  if (typeof Starbases !== 'undefined') Starbases.drawRadar(ctx);
  if (typeof BlackHoles !== 'undefined') BlackHoles.drawRadar(ctx);
  if (typeof Salvage !== 'undefined') Salvage.drawRadar(ctx);
  if (typeof MissionContracts !== 'undefined') MissionContracts.drawRadar(ctx);
  if (typeof QuestTracker !== 'undefined') QuestTracker.drawRadar(ctx);
  if (typeof Raiders !== 'undefined')
    Raiders.drawRadar(ctx);
}

// Clamp long frames after tab switching to avoid large collision and fuel-consumption steps.
// Keep drawing while paused, but advance physics only during active play.
function frame(now) {
  const dt = Math.min((now - last) / 1000, .033);
  last = now;
  if (typeof Colony !== 'undefined') {
    // Fabrication progresses in menus, while flight and combat stay paused.
    Colony.updateCrafting(dt);
    Colony.refreshRepairButton();
    if (typeof QuestTracker !== 'undefined') QuestTracker.update(dt);
    if (paused || Colony.onSurface)
      GameAudio.setEngine(0);
    if (typeof FlightTransitions !== 'undefined') FlightTransitions.update(dt);
    if (!paused && !(typeof FlightTransitions !== 'undefined' && FlightTransitions.active))
      update(dt);
    render();
    if (typeof FlightTransitions !== 'undefined') FlightTransitions.render();
  }
  requestAnimationFrame(frame);
}
radar();
requestAnimationFrame(frame);

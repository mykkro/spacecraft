/**
 * Seeded patrols with a bounded active encounter. Defeated IDs persist separately.
 * Pirates, player shots, and asteroid cover all share swept collision tests.
 */

// Territorial enemies live in deterministic patrol zones, not random ambushes.
const Raiders = (() => {
  const enemies = [],
    projectiles = [],
    defeated = new Set();
  const $ = s => document.querySelector(s);
  let systemId = '',
    clock = 0,
    warningClock = 0;
  function riskFor(s = StarChart.current()) {
    if (s.id === '0:0')
      return {
        level: 1,
        name: I18n.t('FRINGE PATROLS')
      };
    const roll = random(Math.imul(s.gx, 3749) ^ Math.imul(s.gy, 8219) ^ 631)();
    const level = roll < .3 ? 0 : roll < .7 ? 1 : 2;
    return {
      level,
      name: level === 0 ? I18n.t('QUIET') : level === 1 ? I18n.t('PIRATE PATROLS') : I18n.t('HEAVY PIRATE ACTIVITY')
    };
  }
  function zones(s = StarChart.current()) {
    const risk = riskFor(s),
      rng = random(Math.imul(s.gx, 1289) ^ Math.imul(s.gy, 3499) ^ 987);
    return Array.from({ length: risk.level }, (_, i) => {
      const angle = rng() * Math.PI * 2 + i * Math.PI,
        radius = 3300 + rng() * 800;
      const x = s.id === '0:0' ? 3300 : s.x + Math.cos(angle) * radius,
        y = s.id === '0:0' ? 1700 : s.y + Math.sin(angle) * radius;
      const id = `${ s.id }:z${ i }`,
        count = risk.level === 2 ? 3 : 2;
      const cleared = Array.from({ length: count }, (_, n) => `${ id }:p${ n }`).every(id => defeated.has(id));
      return {
        id,
        x,
        y,
        r: 1100,
        count,
        cleared,
        name: I18n.t(s.id === '0:0' ? 'Gallows Run' : `${ i ? 'Blackwake' : 'Redwake' } patrol zone`),
        level: risk.level
      };
    });
  }
  function save() {
    try {
      localStorage.setItem('spacecraft-pirates-v1', JSON.stringify({ defeated: [...defeated] }));
    } catch {
    }
  }
  try {
    const data = JSON.parse(localStorage.getItem('spacecraft-pirates-v1') || 'null');
    if (Array.isArray((data?.defeated)))
      for (const id of data.defeated)
        if (typeof id === 'string' && /^-?\d+:-?\d+:z\d+:p\d+$/.test(id))
          defeated.add(id);
  } catch {
  }

  // Create this system\'s patrols from stable IDs, excluding already defeated ships.
  function ensureSystem() {
    const s = StarChart.current();
    if (s.id === systemId)
      return;
    systemId = s.id;
    enemies.length = projectiles.length = 0;
    for (const zone of zones(s))
      for (let i = 0; i < zone.count; i++) {
        const id = `${ zone.id }:p${ i }`;
        if (defeated.has(id))
          continue;
        const heavy = zone.level === 2 && i === zone.count - 1,
          angle = i / zone.count * Math.PI * 2;
        enemies.push({
          id,
          zone,
          x: zone.x + Math.cos(angle) * 210,
          y: zone.y + Math.sin(angle) * 210,
          vx: 0,
          vy: 0,
          angle: 0,
          phase: angle,
          hp: heavy ? 14 : 6,
          maxHp: heavy ? 14 : 6,
          r: heavy ? 23 : 18,
          heavy,
          aggro: false,
          fireTimer: 1 + i * .4
        });
      }
  }
  function resetEncounter() {
    systemId = '';
    projectiles.length = 0;
    ensureSystem();
    $('#pirateAlert').hidden = true;
  }
  function contacts() {
    return enemies.filter(e => e.hp > 0 && Math.hypot(e.x - ship.x, e.y - ship.y) < 1400);
  }
  function safeArea() {
    if (ship.invulnerable > 2)
      return true;
    if (Math.hypot(ship.x, ship.y) < 1500)
      return true;
    // Landing and transit approaches provide a small protected escape window.
    return StarChart.portals().some(p => Math.hypot(p.x - ship.x, p.y - ship.y) < 400);
  }

  // Return the first intersection fraction on a movement segment, or null for a miss.
  function segmentCircle(x0, y0, x1, y1, cx, cy, r) {
    const dx = x1 - x0,
      dy = y1 - y0,
      len = dx * dx + dy * dy;
    if ((x0 - cx) ** 2 + (y0 - cy) ** 2 <= r * r)
      return 0;
    if (!len)
      return null;
    const b = 2 * ((x0 - cx) * dx + (y0 - cy) * dy),
      c = (x0 - cx) ** 2 + (y0 - cy) ** 2 - r * r,
      disc = b * b - 4 * len * c;
    if (disc < 0)
      return null;
    const t = (-b - Math.sqrt(disc)) / (2 * len);
    return t >= 0 && t <= 1 ? t : null;
  }
  function sweep(x0, y0, x1, y1) {
    let found = null;
    for (const enemy of enemies) {
      if (enemy.hp <= 0)
        continue;
      const t = segmentCircle(x0, y0, x1, y1, enemy.x, enemy.y, enemy.r);
      if (t !== null && (!found || t < found.t))
        found = {
          enemy,
          t
        };
    }
    return found;
  }

  // Derive salvage from the pirate ID so reloading cannot reroll equipment drops.
  function lootFor(enemy) {
    let seed = 2166136261;
    for (const c of enemy.id)
      seed = Math.imul(seed ^ c.charCodeAt(0), 16777619);
    const roll = (seed >>> 0) / 4294967296;
    const loot = [
      {
        type: 'metal',
        qty: enemy.heavy ? 6 : 3
      },
      {
        type: 'crystal',
        qty: 1
      },
      {
        type: 'ammo_rockbreaker',
        qty: enemy.heavy ? 4 : 2
      }
    ];
    if (enemy.heavy)
      loot.push({
        type: 'ammo_piercer',
        qty: 2
      }, {
        type: 'ammo_seismic',
        qty: 1
      });
    if (roll < (enemy.heavy ? .65 : .25))
      loot.push({
        type: (enemy.heavy ? ['laser', 'piercer', 'seismic', 'scanner', 'bulshitter', 'fotron'] : ['laser', 'piercer', 'furnace', 'bulshitter', 'photon'])[Math.abs(seed) % (enemy.heavy ? 6 : 5)],
        qty: 1
      });
    if (enemy.heavy)
      loot.push({
        type: 'bulterite',
        qty: 1
      }, {
        type: 'blue_ion_cube',
        qty: 1
      });
    else if (roll < .65)
      loot.push({
        type: 'ion_cube',
        qty: 1
      });
    return loot;
  }

  // Remove a defeated ship once, then create collectible loot packs instead of many tiny items.
  function hit(shot, enemy) {
    if (enemy.hp <= 0 || !enemies.includes(enemy))
      return false;
    enemy.hp -= shot.damage;
    enemy.aggro = true;
    GameAudio.play('impact', {
      x: enemy.x,
      y: enemy.y
    });
    burst(enemy.x, enemy.y, shot.tint || [.9, .5, .25], shot.missile ? 20 : 7, 90);
    if (enemy.hp <= 0) {
      defeated.add(enemy.id);
      burst(enemy.x, enemy.y, [1, .43, .22], 38, 170);
      GameAudio.play('explosion', {
        x: enemy.x,
        y: enemy.y,
        intensity: enemy.heavy ? 1.2 : .8
      });
      enemies.splice(enemies.indexOf(enemy), 1);
      lootFor(enemy).forEach((loot, i) => drops.push({
        ...loot,
        x: enemy.x + (i - 2) * 14,
        y: enemy.y + i % 2 * 18,
        life: 240,
        source: 'pirate'
      }));
      save();
      notify((zones().find(z=>z.id===enemy.zone.id)?.cleared) ? I18n.t('PIRATE PATROL CLEARED · SALVAGE AVAILABLE') : I18n.t('PIRATE DESTROYED · SALVAGE AVAILABLE'));
    }
    return true;
  }
  function blast(shot, exclude) {
    for (const e of [...enemies])
      if (e !== exclude && Math.hypot(e.x - shot.x, e.y - shot.y) < shot.blast + e.r)
        hit(shot, e);
  }
  function fire(enemy) {
    GameAudio.play('pirateFire', {
      x: enemy.x,
      y: enemy.y,
      intensity: enemy.heavy ? .9 : .65
    });
    const dx = ship.x - enemy.x,
      dy = ship.y - enemy.y,
      dist = Math.hypot(dx, dy) || 1,
      speed = enemy.heavy ? 400 : 350;
    // Modest leading rewards changing direction instead of tracking perfectly.
    const lead = Math.min(.6, dist / speed * .35),
      tx = ship.x + ship.vx * lead - enemy.x,
      ty = ship.y + ship.vy * lead - enemy.y,
      n = Math.hypot(tx, ty) || 1;
    projectiles.push({
      x: enemy.x + tx / n * 26,
      y: enemy.y + ty / n * 26,
      vx: tx / n * speed,
      vy: ty / n * speed,
      life: 2.6,
      damage: enemy.heavy ? 9 : 6
    });
  }

  // Compare asteroid and hull intersections so cover blocks shots in either direction.
  function updateShots(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i],
        x0 = p.x,
        y0 = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      let rockT = Infinity;
      for (const r of rocks) {
        const t = segmentCircle(x0, y0, p.x, p.y, r.x, r.y, r.r * .88);
        if (t !== null)
          rockT = Math.min(rockT, t);
      }
      const shipT = segmentCircle(x0, y0, p.x, p.y, ship.x, ship.y, 14);
      if (rockT !== Infinity && (shipT === null || rockT <= shipT)) {
        const x = x0 + (p.x - x0) * rockT,
          y = y0 + (p.y - y0) * rockT;
        burst(x, y, [.9, .45, .25], 4, 45);
        GameAudio.play('impact', {
          x,
          y,
          intensity: .5
        });
        projectiles.splice(i, 1);
      } else if (shipT !== null) {
        projectiles.splice(i, 1);
        if (!safeArea())
          damageShip(p.damage, I18n.t('PIRATE HIT · HULL DAMAGE'), .55);
        if (ship.invulnerable >= 4)
          return;
      } else if (p.life <= 0)
        projectiles.splice(i, 1);
    }
  }

  // Patrols steer around nearby asteroids, pursue within their territory, and disengage safely.
  function update(dt) {
    ensureSystem();
    if (Colony.onSurface) {
      projectiles.length = 0;
      $('#pirateAlert').hidden = true;
      return;
    }
    clock += dt;
    warningClock -= dt;
    const safe = safeArea();
    for (const e of enemies) {
      const dx = ship.x - e.x,
        dy = ship.y - e.y,
        dist = Math.hypot(dx, dy) || 1,
        fromHome = Math.hypot(ship.x - e.zone.x, ship.y - e.zone.y);
      if (!safe && dist < 900 && fromHome < e.zone.r + 350)
        e.aggro = true;
      if (safe || fromHome > 2200)
        e.aggro = false;
      let tx,
        ty;
      if (e.aggro) {
        const desired = e.heavy ? 470 : 370,
          approach = Math.max(-.65, Math.min(1, (dist - desired) / 300));
        tx = dx / dist * approach * 170 - dy / dist * 75;
        ty = dy / dist * approach * 170 + dx / dist * 75;
      } else {
        const a = clock * .16 + e.phase,
          px = e.zone.x + Math.cos(a) * 230,
          py = e.zone.y + Math.sin(a) * 230,
          n = Math.hypot(px - e.x, py - e.y) || 1;
        tx = (px - e.x) / n * 65;
        ty = (py - e.y) / n * 65;
      }
      const steer = 1 - Math.exp(-dt * 1.8);
      e.vx += (tx - e.vx) * steer;
      e.vy += (ty - e.vy) * steer;
      // Steer away from asteroid hulls so patrols do not sit inside cover.
      for (const r of rocks) {
        const ax = e.x - r.x,
          ay = e.y - r.y,
          d = Math.hypot(ax, ay) || 1,
          margin = r.r + e.r + 35;
        if (d < margin) {
          e.vx += ax / d * (margin - d) * dt * 5;
          e.vy += ay / d * (margin - d) * dt * 5;
        }
      }
      const speed = Math.hypot(e.vx, e.vy),
        limit = e.heavy ? 190 : 230;
      if (speed > limit) {
        e.vx *= limit / speed;
        e.vy *= limit / speed;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.angle = Math.atan2(dx, -dy);
      e.fireTimer -= dt;
      if (e.aggro && dist < 850 && e.fireTimer <= 0 && !safe) {
        fire(e);
        e.fireTimer = e.heavy ? 2.2 : 1.7;
      }
    }
    updateShots(dt);
    const nearby = contacts(),
      hostiles = nearby.filter(e => e.aggro),
      zone = zones().find(z => !z.cleared && Math.hypot(z.x - ship.x, z.y - ship.y) < z.r + 350);
    $('#pirateAlert').hidden = safe || !(nearby.length || zone);
    if (!safe && (nearby.length || zone)) {
      $('#pirateAlertText').textContent = hostiles.length ? I18n.t(`${ hostiles.length } PIRATE${ hostiles.length === 1 ? '' : 'S' } ENGAGING`) : zone ? I18n.t(`${ zone.name.toUpperCase() } · PIRATE TERRITORY`) : I18n.t(`${ nearby.length } ARMED PATROL CONTACT${ nearby.length === 1 ? '' : 'S' }`);
      if (warningClock <= 0) {
        GameAudio.play('alert');
        notify(hostiles.length ? I18n.t('PIRATES ENGAGING · EVADE OR RETURN FIRE') : I18n.t('WARNING · ARMED PIRATE PATROL NEARBY'));
        warningClock = 12;
      }
    }
  }
  function render(screen) {
    for (const e of enemies) {
      const [x, y] = screen(e.x, e.y);
      if (x < -60 || x > width + 60 || y < -60 || y > height + 60)
        continue;
      const c = Math.cos(e.angle),
        s = Math.sin(e.angle),
        p = (a, b) => [x + a * c - b * s, y + a * s + b * c],
        r = e.heavy ? 1.25 : 1;
      tri(p(0, -23 * r), p(-18 * r, 16 * r), p(-4 * r, 9 * r), [.48, .24, .22, 1]);
      tri(p(0, -23 * r), p(-4 * r, 9 * r), p(17 * r, 16 * r), [.28, .2, .24, 1]);
      tri(p(-18 * r, 16 * r), p(-21 * r, -1 * r), p(-10 * r, 4 * r), [.28, .32, .35, 1]);
      tri(p(17 * r, 16 * r), p(21 * r, -1 * r), p(10 * r, 4 * r), [.28, .32, .35, 1]);
      tri(p(0, -12 * r), p(-4 * r, 1 * r), p(4 * r, 1 * r), [1, .34, .19, 1]);
      line(p(-18 * r, 16 * r), p(0, -23 * r), [.9, .39, .29, .9], 1.5);
      line(p(-5 * r, 12 * r), p(5 * r, 12 * r), [1, .5, .22, 1], 3);
      if (e.aggro || e.hp < e.maxHp) {
        line([x - 21, y - 36 * r], [x + 21, y - 36 * r], [.2, .25, .3, 1], 3);
        line([x - 21, y - 36 * r], [x - 21 + 42 * e.hp / e.maxHp, y - 36 * r], [.95, .4, .3, 1], 3);
      }
    }
    for (const p of projectiles) {
      const [x, y] = screen(p.x, p.y),
        n = Math.hypot(p.vx, p.vy) || 1;
      line([x, y], [x - p.vx / n * 15, y - p.vy / n * 15], [1, .35, .2, 1], 2.5);
    }
  }
  function drawRadar(c) {
    for (const e of contacts()) {
      const dx = e.x - ship.x,
        dy = e.y - ship.y,
        d = Math.hypot(dx, dy) || 1,
        r = Math.min(69, d / 16),
        x = 78 + dx / d * r,
        y = 78 + dy / d * r;
      c.save();
      c.translate(x, y);
      c.rotate(e.angle);
      c.fillStyle = '#f47765';
      c.beginPath();
      c.moveTo(0, -4);
      c.lineTo(-3, 3);
      c.lineTo(3, 3);
      c.closePath();
      c.fill();
      c.restore();
    }
  }
  function drawLocal(c, project) {
    for (const z of zones()) {
      const p = project(z.x, z.y),
        edge = project(z.x + z.r, z.y),
        r = Math.abs(edge.x - p.x);
      c.beginPath();
      c.arc(p.x, p.y, r, 0, Math.PI * 2);
      c.fillStyle = z.cleared ? '#7ca88a09' : '#eb6a5a12';
      c.fill();
      c.strokeStyle = z.cleared ? '#7ca88a55' : '#eb6a5a66';
      c.setLineDash([4, 6]);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = z.cleared ? '#83ac93' : '#e69585';
      c.font = '9px monospace';
      c.fillText(`${ z.cleared ? I18n.t('CLEARED') : '⚠' } ${ z.name }`, p.x - r, p.y - r - 9);
    }
    for (const e of contacts()) {
      const p = project(e.x, e.y);
      c.fillStyle = '#f47765';
      c.beginPath();
      c.moveTo(p.x, p.y - 4);
      c.lineTo(p.x - 3, p.y + 3);
      c.lineTo(p.x + 3, p.y + 3);
      c.closePath();
      c.fill();
    }
  }
  addEventListener('beforeunload', save);
  ensureSystem();
  return {
    lootFor,
    riskFor,
    zones,
    contacts,
    sweep,
    hit,
    blast,
    update,
    render,
    drawRadar,
    drawLocal,
    resetEncounter,
    save,
    segmentCircle,
    get enemies() {
      return enemies;
    },
    get projectiles() {
      return projectiles;
    },
    get defeated() {
      return [...defeated];
    }
  };
})();

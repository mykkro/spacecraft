/**
 * Weapon metadata, shared cooldowns, projectiles, and asteroid hardness gates.
 * Primary weapons use energy; missile launchers consume matching inventory ammunition.
 */

// Weapon definitions are shared by combat, HUD, inventory, and crafting.
const Weapons = (() => {
  const definitions = {
    pulse: {
      name: I18n.t('Pulse Cannon'),
      short: I18n.t('Pulse'),
      channel: 'primary',
      tier: 0,
      damage: 1,
      cooldown: .15,
      speed: 760,
      color: '#a9dfef',
      tint: [.66, .87, .94],
      builtIn: true
    },
    laser: {
      name: I18n.t('Prism Laser'),
      short: I18n.t('Prism'),
      channel: 'primary',
      tier: 2,
      damage: 4,
      cooldown: .38,
      speed: 1200,
      color: '#c99bec',
      tint: [.79, .61, .93]
    },
    rockbreaker: {
      ammo: 'ammo_rockbreaker',
      name: I18n.t('Rockbreaker'),
      short: I18n.t('Breaker'),
      channel: 'missile',
      tier: 1,
      damage: 8,
      cooldown: 1.8,
      speed: 480,
      color: '#dfb878',
      tint: [.88, .72, .47],
      builtIn: true
    },
    piercer: {
      ammo: 'ammo_piercer',
      name: I18n.t('Penetrator'),
      short: I18n.t('Piercer'),
      channel: 'missile',
      tier: 2,
      damage: 12,
      cooldown: 2.6,
      speed: 820,
      color: '#83ccd3',
      tint: [.51, .8, .83]
    },
    photon: {
      name: I18n.t('Photon Cannon'),
      short: I18n.t('Photon'),
      channel: 'primary',
      tier: 1,
      damage: 2,
      cooldown: .23,
      speed: 950,
      color: '#8fdaf7',
      tint: [.56, .85, .97],
      icon: 'photon.svg'
    },
    mininglaser: {
      name: I18n.t('Enhanced Mining Laser'),
      short: I18n.t('Mining'),
      channel: 'primary',
      tier: 2,
      damage: 2,
      rockDamage: 8,
      cooldown: .42,
      speed: 1150,
      color: '#b9c888',
      tint: [.73, .79, .53],
      icon: 'mininglaser.svg'
    },
    fotron: {
      ammo: 'ammo_fotron',
      name: I18n.t('Fotron Cannon'),
      short: I18n.t('Fotron'),
      channel: 'primary',
      tier: 3,
      damage: 7,
      cooldown: .34,
      speed: 1350,
      color: '#89f6c8',
      tint: [.54, .96, .78],
      icon: 'fotron.svg'
    },
    bulshitter: {
      ammo: 'ammo_bulshitter',
      name: I18n.t('Bulshitter'),
      short: I18n.t('Bulshitter'),
      channel: 'primary',
      tier: 0,
      damage: .4,
      cooldown: .09,
      speed: 900,
      pellets: 5,
      spread: .085,
      lifetime: .8,
      color: '#f4ce7e',
      tint: [.96, .81, .49],
      icon: 'bulshitter.svg'
    },
    seismic: {
      ammo: 'ammo_seismic',
      name: I18n.t('Seismic Torpedo'),
      short: I18n.t('Seismic'),
      channel: 'missile',
      tier: 3,
      damage: 20,
      cooldown: 4.2,
      speed: 350,
      blast: 130,
      color: '#eea466',
      tint: [.93, .64, .4]
    }
  };
  const hardness = [
    {
      name: I18n.t('Standard rock'),
      color: [.6, .7, .73],
      requires: I18n.t('Any weapon')
    },
    {
      name: I18n.t('Reinforced rock'),
      color: [.78, .58, .37],
      requires: I18n.t('Rockbreaker / Prism / Penetrator / Seismic')
    },
    {
      name: I18n.t('Resonant rock'),
      color: [.68, .43, .88],
      requires: I18n.t('Prism Laser / Penetrator / Seismic')
    },
    {
      name: I18n.t('Ultradense core'),
      color: [.98, .55, .24],
      requires: I18n.t('Fotron / Seismic Torpedo')
    }
  ];
  const selected = {
    primary: 'pulse',
    missile: 'rockbreaker'
  };
  const cooldowns = {
    primary: {
      remaining: 0,
      duration: .15
    },
    missile: {
      remaining: 0,
      duration: 1.8
    }
  };
  const $ = s => document.querySelector(s);
  const circumference = 2 * Math.PI * 25;
  let blockedMessageTime = -100;

  // A ship supplies its default primary without creating an inventory copy of that weapon.
  function unlocked(id) {
    return !!definitions[id] && (definitions[id].builtIn || id === Shipyard.current.primary || typeof Colony !== 'undefined' && Colony.count(id) > 0);
  }
  function saveSelection() {
    try {
      (typeof Profiles === 'undefined' ? localStorage : Profiles).setItem('spacecraft-weapons-v1', JSON.stringify(selected));
    } catch {
    }
  }
  try {
    const stored = JSON.parse((typeof Profiles === 'undefined' ? localStorage : Profiles).getItem('spacecraft-weapons-v1') || 'null');
    for (const channel of ['primary', 'missile'])
      if ((definitions[stored?.[channel]]?.channel) === channel)
        selected[channel] = stored[channel];
  } catch {
  }
  function select(id) {
    const def = definitions[id];
    if (!def)
      return false;
    if (!unlocked(id)) {
      notify(I18n.t(`${ def.name.toUpperCase() } · CRAFT AT A WORKBENCH`));
      return false;
    }
    selected[def.channel] = id;
    saveSelection();
    updateHUD();
    return true;
  }

  // Changing presets equips the new default while keeping crafted equipment in inventory.
  function applyShipLoadout(force = false) {
    if (force || !unlocked(selected.primary))
      selected.primary = Shipyard.current.primary;
    if (!unlocked(selected.missile))
      selected.missile = 'rockbreaker';
    saveSelection();
    updateHUD();
  }
  function cycle(channel) {
    const options = Object.keys(definitions).filter(id => definitions[id].channel === channel && unlocked(id));
    select(options[(options.indexOf(selected[channel]) + 1) % options.length]);
  }
  function buildHUD() {
    $('#weaponHud').innerHTML = `<div class="weapon-cards">${ Object.entries(definitions).map(([id, d], i) => I18n.html(`<button class="weapon-card" data-weapon="${ id }" style="--weapon-color:${ d.color }" title="${ d.name } · tier ${ d.tier } · ${ d.damage } damage · ${ d.cooldown }s cooldown" aria-label="Equip ${ d.name }"><span class="weapon-number">${ i < 9 ? i + 1 : 'Q' }</span><span class="cooldown-icon"><img src="assets/items/${ d.icon || id + '.png' }" alt="" width="48" height="48" draggable="false"><svg viewBox="0 0 60 60" role="progressbar" aria-label="${ d.name } recharge" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><circle class="cooldown-track" cx="30" cy="30" r="25"/><circle class="cooldown-arc" cx="30" cy="30" r="25" stroke-dasharray="${ circumference }" stroke-dashoffset="0"/></svg></span><b>${ d.short }</b><small class="weapon-status">READY</small></button>`)).join('') }</div><div id="weaponDetails"></div>`;
    $('#weaponHud').querySelectorAll('[data-weapon]').forEach(button => button.onclick = () => {
      if (!paused)
        select(button.dataset.weapon);
    });
  }

  // Primary and missile cooldowns are channel-wide, so weapon swapping cannot skip recharge.
  function updateHUD() {
    for (const channel of ['primary', 'missile'])
      if (!unlocked(selected[channel]))
        selected[channel] = channel === 'primary' ? Shipyard.current.primary : 'rockbreaker';
    for (const [id, d] of Object.entries(definitions)) {
      const button = $(`[data-weapon="${ id }"]`),
        cd = cooldowns[d.channel],
        ready = unlocked(id),
        progress = ready ? Math.max(0, Math.min(1, 1 - cd.remaining / cd.duration)) : 0;
      button.classList.toggle('equipped', selected[d.channel] === id);
      button.classList.toggle('locked', !ready);
      button.classList.toggle('recharging', ready && cd.remaining > 0);
      button.setAttribute('aria-pressed', String(selected[d.channel] === id));
      button.querySelector('.cooldown-arc').style.strokeDashoffset = String(circumference * (1 - progress));
      button.querySelector('svg').setAttribute('aria-valuenow', String(Math.round(progress * 100)));
      button.querySelector('svg').setAttribute('aria-valuetext', !ready ? I18n.t('Craft at a workbench') : cd.remaining > 0 ? I18n.t(`Recharging: ${ cd.remaining.toFixed(1) } seconds`) : I18n.t('Ready'));
      const ammo = d.ammo ? Colony.availableCount(d.ammo) : null;
      button.querySelector('.weapon-status').textContent = !ready ? I18n.t('CRAFT') : ammo === 0 ? I18n.t('EMPTY') : `${ cd.remaining > 0 ? cd.remaining.toFixed(1) + 's' : I18n.t('READY') }${ ammo === null ? '' : ' · ' + ammo }`;
      button.querySelector('svg').setAttribute('aria-valuetext', !ready ? I18n.t('Craft at a workbench') : ammo === 0 ? I18n.t('Out of ammunition') : `${ cd.remaining > 0 ? I18n.t('Recharging') : I18n.t('Ready') }${ ammo === null ? '' : ', ' + ammo + I18n.t(' rounds remaining') }`);
      button.title = I18n.t(`${ d.name } · T${ d.tier } · ${ d.damage } damage · ${ d.cooldown }s${ ready ? '' : I18n.t(' · Craft at a workbench') }`);
    }
    $('#weaponDetails').textContent = `[SPACE] ${ definitions[selected.primary].name } · T${ definitions[selected.primary].tier }     [F] ${ definitions[selected.missile].name } · T${ definitions[selected.missile].tier }`;
  }

  // Validate every firing gate before consuming ammunition or starting a cooldown.
  // Spread weapons create multiple projectiles from one trigger event.
  function fire(channel) {
    const id = selected[channel],
      d = definitions[id],
      cd = cooldowns[channel];
    if (!d || paused || Colony.onSurface || !unlocked(id) || cd.remaining > 0)
      return false;
    if (d.ammo && !Colony.consumeItem(d.ammo)) {
      if (time - blockedMessageTime > 1.3) {
        notify(I18n.t('OUT OF AMMO · CRAFT AT A WORKBENCH OR SALVAGE PIRATES'));
        blockedMessageTime = time;
      }
      return false;
    }
    cd.remaining = d.cooldown;
    cd.duration = d.cooldown;
    GameAudio.play(id);
    for (let i = 0; i < (d.pellets || 1); i++) {
      const angle = ship.angle + (i - ((d.pellets || 1) - 1) / 2) * (d.spread || 0),
        dx = Math.sin(angle),
        dy = -Math.cos(angle);
      shots.push({
        x: ship.x + dx * 28,
        y: ship.y + dy * 28,
        vx: ship.vx + dx * d.speed,
        vy: ship.vy + dy * d.speed,
        life: d.lifetime || (d.channel === 'missile' ? 3.2 : 1.1),
        missile: d.channel === 'missile',
        weaponId: id,
        tier: d.tier,
        damage: d.damage,
        rockDamage: d.rockDamage,
        tint: d.tint,
        blast: d.blast || 0
      });
    }
    updateHUD();
    return true;
  }
  function update(dt) {
    for (const cd of Object.values(cooldowns))
      cd.remaining = Math.max(0, cd.remaining - dt);
    if (keys.has('Space'))
      fire('primary');
    if (keys.has('KeyF'))
      fire('missile');
    updateHUD();
  }

  // Hardness is a strict gate. Mining laser damage applies to rocks without buffing combat damage.
  function damageRock(projectile, r, feedback = true) {
    if (projectile.tier < (r.hardness || 0)) {
      if (feedback)
        GameAudio.play('blocked', {
          x: r.x,
          y: r.y
        });
      if (feedback) {
        burst(r.x, r.y, hardness[r.hardness].color, 9, 80);
        if (time - blockedMessageTime > 1.3) {
          notify(`${ hardness[r.hardness].name.toUpperCase() } · ${ hardness[r.hardness].requires.toUpperCase() }`);
          blockedMessageTime = time;
        }
      }
      return false;
    }
    r.hp -= (projectile.rockDamage??projectile.damage) * (typeof Starbases !== 'undefined' ? Starbases.miningMultiplier : 1);
    if (feedback)
      GameAudio.play('impact', {
        x: r.x,
        y: r.y
      });
    if (feedback)
      burst(projectile.x, projectile.y, projectile.tint, projectile.missile ? 22 : 5, 70);
    if (r.hp <= 0) {
      const index = rocks.indexOf(r);
      if (index >= 0) {
        rocks.splice(index, 1);
        destroy(r);
      }
    }
    return true;
  }
  // Swept collision keeps fast laser pulses from skipping small asteroids.

  // Sweep the entire movement segment to prevent fast shots skipping small targets.
  // Choose the earliest rock or pirate hit, then apply any area damage.
  function updateProjectiles(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i],
        x0 = s.x,
        y0 = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.missile)
        particles.push({
          x: s.x,
          y: s.y,
          vx: (Math.random() - .5) * 20,
          vy: (Math.random() - .5) * 20,
          life: .25,
          max: .25,
          col: s.tint,
          size: 2
        });
      const dx = s.x - x0,
        dy = s.y - y0,
        len = dx * dx + dy * dy;
      let hit = null,
        first = Infinity,
        kind = 'rock';
      for (const r of rocks) {
        if (typeof Raiders !== 'undefined') {
          const t = Raiders.segmentCircle(x0, y0, s.x, s.y, r.x, r.y, r.r * .88);
          if (t !== null && t < first) {
            hit = r;
            first = t;
          }
        } else {
          const t = len ? Math.max(0, Math.min(1, ((r.x - x0) * dx + (r.y - y0) * dy) / len)) : 0;
          if (Math.hypot(x0 + dx * t - r.x, y0 + dy * t - r.y) <= r.r * .88 && t < first) {
            hit = r;
            first = t;
          }
        }
      }
      if (typeof Salvage !== 'undefined') {
        const wreck = Salvage.sweep(x0,y0,s.x,s.y);
        if(wreck && wreck.t < first) { hit=wreck.object;first=wreck.t;kind='wreck'; }
      }
      if (typeof Raiders !== 'undefined') {
        const pirate = Raiders.sweep(x0, y0, s.x, s.y);
        if (pirate && pirate.t < first) {
          hit = pirate.enemy;
          first = pirate.t;
          kind = 'pirate';
        }
      }
      if (hit) {
        s.x = x0 + dx * first;
        s.y = y0 + dy * first;
        // Snapshot excludes fragments created by this blast from being hit twice.
        const nearby = s.blast ? rocks.filter(r => r !== hit && Math.hypot(r.x - s.x, r.y - s.y) < s.blast + r.r * .5) : [];
        if (kind === 'rock')
          damageRock(s, hit);
        else if (kind === 'wreck')
          Salvage.hit(s, hit);
        else
          Raiders.hit(s, hit);
        for (const r of nearby)
          damageRock(s, r, false);
        if (s.blast && typeof Salvage !== 'undefined') Salvage.blast(s, kind === 'wreck' ? hit : null);
        if (s.blast && typeof Raiders !== 'undefined')
          Raiders.blast(s, kind === 'pirate' ? hit : null);
        if (s.blast) {
          if (typeof SpaceEffects !== 'undefined') SpaceEffects.spawn(s.x, s.y, Math.min(120, s.blast * .6), 'metal');
          burst(s.x, s.y, s.tint, 60, 220);
          GameAudio.play('explosion', {
            x: s.x,
            y: s.y,
            intensity: 1.2
          });
          shake = 5;
        }
      }
      if (hit || s.life <= 0)
        shots.splice(i, 1);
    }
  }

  // Inspect the nearest asteroid roughly along the ship heading for tool requirements.
  function scan() {
    const dx = Math.sin(ship.angle),
      dy = -Math.cos(ship.angle);
    let target = null,
      best = Infinity;
    for (const r of rocks) {
      const x = r.x - ship.x,
        y = r.y - ship.y,
        along = x * dx + y * dy;
      if (along < 0 || along > 1100)
        continue;
      const across = Math.abs(x * dy - y * dx);
      if (across < r.r + 35 && along < best) {
        target = r;
        best = along;
      }
    }
    const panel = $('#rockScan');
    panel.hidden = !target;
    if (target) {
      const h = hardness[target.hardness || 0];
      panel.innerHTML = I18n.html(`<span class="eyebrow">FORWARD SCAN / T${ target.hardness || 0 }</span><b>${ h.name }</b><span>${ h.requires }</span>`);
      panel.style.setProperty('--scan-color', `rgb(${ h.color.map(v => Math.round(v * 255)).join(',') })`);
    }
  }
  function renderRockMarks(screen) {
    for (const r of rocks) {
      if (!r.hardness)
        continue;
      const [x, y] = screen(r.x, r.y);
      if (x < -r.r || x > width + r.r || y < -r.r || y > height + r.r)
        continue;
      const col = hardness[r.hardness].color;
      // Colored mineral seams and tier ticks distinguish hardness from ore type.
      const a = r.angle + .6,
        rx = Math.cos(a),
        ry = Math.sin(a);
      line([x - rx * r.r * .62, y - ry * r.r * .62], [x + rx * r.r * .55, y + ry * r.r * .55], [...col, .7], 2 + r.hardness);
      line([x - rx * r.r * .13, y - ry * r.r * .13], [x - ry * r.r * .38, y + rx * r.r * .38], [...col, .55], 2);
      for (let i = 0; i < r.hardness; i++) {
        const xx = x + (i - (r.hardness - 1) / 2) * 8,
          yy = y - r.r - 11;
        line([xx, yy], [xx, yy + 5], [...col, .9], 3);
      }
    }
  }
  addEventListener('keydown', e => {
    if (e.repeat || paused || typeof Colony === 'undefined' || Colony.onSurface)
      return;
    if (e.code === 'KeyQ')
      cycle('primary');
    if (e.code === 'KeyR')
      cycle('missile');
    if (/^Digit[1-9]$/.test(e.code))
      select(Object.keys(definitions)[Number(e.code.slice(-1)) - 1]);
  });
  buildHUD();
  return {
    definitions,
    hardness,
    selected,
    cooldowns,
    applyShipLoadout,
    unlocked,
    select,
    fire,
    update,
    updateHUD,
    updateProjectiles,
    damageRock,
    scan,
    renderRockMarks
  };
})();

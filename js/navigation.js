/**
 * Navigation uses the same world coordinates as flight, with 12,000-unit systems.
 * Located systems are known signals; visited systems were physically entered.
 * Own bases remain available without a scanner, including distant saved outposts.
 */

// Deterministic system coordinates share the flight world's coordinate space.
// Wormholes connect neighboring systems; the chart records knowledge separately
// from visits, so a scanner signal never counts as having explored a system.
const StarChart = (() => {
  const $ = s => document.querySelector(s),
    spacing = 12000,
    range = 6500;
  const located = new Set(['0:0']),
    visited = new Set(['0:0']),
    links = new Set();
  const directions = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0]
  ];
  const chart = $('#chart'),
    pen = chart.getContext('2d');
  let open = false,
    view = 'local',
    previousPaused = false,
    previousInventory = false,
    returnFocus = null;
  let currentId = '',
    chosen = null,
    tracked = null,
    baseTarget = null,
    cooldown = 0,
    scanClock = 0,
    lastOnline = false;
  let zoom = 1,
    pan = {
      x: 0,
      y: 0
    },
    hits = [],
    drag = null,
    dragged = false;
  let chartWidth = 800,
    chartHeight = 500,
    saveDirty = false;
  function parseId(id) {
    if (typeof id !== 'string' || !/^[-]?\d+:[-]?\d+$/.test(id))
      return null;
    const [x, y] = id.split(':').map(Number);
    return Number.isSafeInteger(x) && Number.isSafeInteger(y) && Math.abs(x) < 1e7 && Math.abs(y) < 1e7 ? {
      x,
      y
    } : null;
  }
  function system(x, y) {
    const rng = random(Math.imul(x, 9239) ^ Math.imul(y, 57737) ^ 872);
    const first = ['Vela', 'Orison', 'Nacre', 'Kestrel', 'Aster', 'Lumen', 'Cinder', 'Vesper'];
    const last = ['Reach', 'Veil', 'Expanse', 'Drift', 'Hollow', 'Crossing', 'Basin', 'Frontier'];
    return {
      id: `${ x }:${ y }`,
      gx: x,
      gy: y,
      x: x * spacing,
      y: y * spacing,
      name: x === 0 && y === 0 ? I18n.t('The Drift') : `${ first[Math.floor(rng() * first.length)] } ${ last[Math.floor(rng() * last.length)] } ${ x }:${ y }`
    };
  }
  function fromId(id) {
    const p = parseId(id);
    return p ? system(p.x, p.y) : null;
  }
  function current() {
    return system(Math.floor((ship.x + spacing / 2) / spacing), Math.floor((ship.y + spacing / 2) / spacing));
  }
  function online() {
    return Colony.count('scanner') > 0;
  }
  const edge = (a, b) => [a, b].sort().join('|');

  // Both ends derive their sideways offset from the same shared edge seed.
  function portals(s = current()) {
    return directions.map(([dx, dy]) => {
      const to = system(s.gx + dx, s.gy + dy);
      // Both ends of an edge use the same sideways offset.
      const ax = Math.min(s.gx, to.gx),
        ay = Math.min(s.gy, to.gy);
      const rng = random(Math.imul(ax, 7393) ^ Math.imul(ay, 65537) ^ (dx ? 718 : 931));
      const offset = (rng() - .5) * 1400;
      return {
        id: `${ s.id }>${ to.id }`,
        from: s.id,
        to: to.id,
        x: s.x + dx * 2500 + (dx ? 0 : offset),
        y: s.y + dy * 2500 + (dy ? 0 : offset),
        dx,
        dy
      };
    });
  }
  function signals() {
    return portals().filter(p => (online() || links.has(edge(p.from, p.to))) && Math.hypot(p.x - ship.x, p.y - ship.y) <= range);
  }
  function save() {
    try {
      (typeof Profiles === 'undefined' ? localStorage : Profiles).setItem('spacecraft-chart-v1', JSON.stringify({
        located: [...located],
        visited: [...visited],
        links: [...links],
        tracked,
        baseTarget
      }));
      saveDirty = false;
    } catch {
    }
  }
  function load() {
    try {
      const data = JSON.parse((typeof Profiles === 'undefined' ? localStorage : Profiles).getItem('spacecraft-chart-v1') || 'null');
      if (!data)
        return;
      if (Array.isArray(data.located))
        for (const id of data.located)
          if (parseId(id))
            located.add(id);
      if (Array.isArray(data.visited))
        for (const id of data.visited)
          if (parseId(id)) {
            visited.add(id);
            located.add(id);
          }
      if (Array.isArray(data.links))
        for (const e of data.links) {
          if (typeof e !== 'string')
            continue;
          const ids = e.split('|');
          if (ids.length === 2 && ids.every(id => located.has(id)))
            links.add(edge(...ids));
        }
      if (typeof data.tracked === 'string')
        tracked = data.tracked;
      if (parseId(data.baseTarget))
        baseTarget = data.baseTarget;
    } catch {
    }
  }

  // Update exploration knowledge and preserve knowledge of systems containing saved bases.
  function discover() {
    const s = current();
    if (s.id !== currentId) {
      if (currentId)
        tracked = null;
      currentId = s.id;
      located.add(s.id);
      visited.add(s.id);
      saveDirty = true;
    }
    for (const p of signals()) {
      if (!located.has(p.to)) {
        located.add(p.to);
        saveDirty = true;
      }
      const e = edge(p.from, p.to);
      if (!links.has(e)) {
        links.add(e);
        saveDirty = true;
      }
    }
    for (const b of Colony.getBases()) {
      const id = baseSystem(b).id;
      if (!located.has(id)) {
        located.add(id);
        visited.add(id);
        saveDirty = true;
      }
    }
    if (baseTarget && !Colony.getBases().some(b => b.id === baseTarget)) {
      baseTarget = null;
      saveDirty = true;
    }
    if (saveDirty)
      save();
    $('#systemLabel').textContent = s.name.toUpperCase();
    const found = signals();
    $('#scannerStatus').textContent = online() ? I18n.t(`${ found.length } BEARINGS · 6.5 KM`) : I18n.t('RECEIVER OFFLINE');
    if (!online() && found.length) $('#scannerStatus').textContent = `${found.length} ` + (I18n.language === 'cs' ? 'ZNÁMÉ SOUŘADNICE' : 'CHARTED BEARINGS');
    $('#scannerStatus').classList.toggle('online', online() || found.length > 0);
  }
  // Coordinate rewards reveal a real neighboring gate, without counting a visit.
  function revealRoute(from, to) {
    const a = fromId(from), b = fromId(to);
    if (!a || !b || Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy) !== 1) return false;
    located.add(from); located.add(to); links.add(edge(from, to));
    save();
    if (open) refreshMap();
    return true;
  }
  function nearbyPortal() {
    return portals().find(p => Math.hypot(p.x - ship.x, p.y - ship.y) < 300) || null;
  }

  // Move to the paired exit and clear transient objects from the previous local area.
  function enter() {
    if (paused || Colony.onSurface || cooldown > 0 || (typeof FlightTransitions !== 'undefined' && FlightTransitions.active))
      return false;
    const p = nearbyPortal();
    if (!p)
      return false;
    if (Math.hypot(p.x - ship.x, p.y - ship.y) > 120) {
      notify('APPROACH WITHIN 120 m TO ENTER');
      return false;
    }
    if (Math.hypot(ship.vx, ship.vy) > 160) {
      notify('SLOW BELOW 160 m/s TO ENTER');
      return false;
    }
    const destination = fromId(p.to),
      exit = portals(destination).find(q => q.to === p.from);
    located.add(p.from);
    visited.add(p.from);
    located.add(p.to);
    visited.add(p.to);
    links.add(edge(p.from, p.to));
    ship.x = exit.x - exit.dx * 220;
    ship.y = exit.y - exit.dy * 220;
    ship.vx = ship.vy = 0;
    ship.invulnerable = 3;
    rocks.length = shots.length = particles.length = drops.length = 0;
    chunks.clear();
    generate();
    for (let i = rocks.length - 1; i >= 0; i--)
      if (Math.hypot(rocks[i].x - ship.x, rocks[i].y - ship.y) < 220)
        rocks.splice(i, 1);
    cooldown = 2.5;
    keys.clear();
    tracked = null;
    discover();
    save();
    Colony.save();
    if (typeof Raiders !== 'undefined')
      Raiders.resetEncounter();
    radar();
    $('#wormholePrompt').hidden = true;
    GameAudio.play('wormhole');
    if (typeof FlightTransitions !== 'undefined') FlightTransitions.start('wormhole');
    notify(I18n.t(`TRANSIT COMPLETE · ${ destination.name.toUpperCase() }`));
    return true;
  }
  function update(dt) {
    cooldown = Math.max(0, cooldown - dt);
    scanClock -= dt;
    if (scanClock <= 0 || online() !== lastOnline || current().id !== currentId) {
      discover();
      scanClock = .3;
      lastOnline = online();
    }
    const p = !Colony.onSurface ? nearbyPortal() : null;
    $('#wormholePrompt').hidden = !p;
    if (p) {
      const d = Math.hypot(p.x - ship.x, p.y - ship.y),
        slow = Math.hypot(ship.vx, ship.vy) <= 160;
      $('#wormholeText').textContent = `${ fromId(p.to).name.toUpperCase() } · ${ Math.round(d) } m${ slow ? '' : I18n.t(' · SLOW DOWN') }`;
      $('#enterWormhole').disabled = d > 120 || !slow || cooldown > 0;
      $('#enterWormhole').textContent = cooldown > 0 ? I18n.t(`STABILIZING ${ cooldown.toFixed(1) }s`) : I18n.t('ENTER WORMHOLE [E]');
    }
  }
  function drawRadar(c) {
    drawBaseRadar(c);
    for (const p of signals()) {
      const dx = p.x - ship.x,
        dy = p.y - ship.y,
        d = Math.hypot(dx, dy) || 1,
        dist = Math.min(69, d / 16),
        x = 78 + dx / d * dist,
        y = 78 + dy / d * dist;
      c.save();
      c.translate(x, y);
      c.rotate(Math.atan2(dy, dx));
      c.strokeStyle = c.fillStyle = p.id === tracked ? '#dfb878' : '#7cd5e2';
      c.lineWidth = 1.5;
      if (d / 16 > 69) {
        c.beginPath();
        c.moveTo(5, 0);
        c.lineTo(-3, -3);
        c.lineTo(-3, 3);
        c.closePath();
        c.fill();
      } else {
        c.beginPath();
        c.arc(0, 0, 4, 0, Math.PI * 2);
        c.stroke();
      }
      c.restore();
    }
  }

  // Use the same half-system offset as current() so bases near borders map correctly.
  function baseSystem(base) {
    return system(Math.floor((base.x + spacing / 2) / spacing), Math.floor((base.y + spacing / 2) / spacing));
  }

  // Keep true world distance separate from clamped radar coordinates.
  // Distant bases stay visible as edge arrows; the selected base survives system changes.
  function baseBearings() {
    return Colony.getBases().map(base => {
      const dx = base.x - ship.x,
        dy = base.y - ship.y,
        distance = Math.hypot(dx, dy),
        scale = distance > 0 ? Math.min(64, distance / 16) / distance : 0;
      return {
        ...base,
        distance,
        bearing: (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360,
        radarX: 78 + dx * scale,
        radarY: 78 + dy * scale,
        offscreen: distance > 64 * 16,
        tracked: base.id === baseTarget
      };
    }).sort((a, b) => a.distance - b.distance);
  }
  function localBases() {
    const s = current();
    return Colony.getBases().filter(b => Math.abs(b.x - s.x) <= 6000 + b.radius && Math.abs(b.y - s.y) <= 6000 + b.radius);
  }

  // Coverage rings stay at their physical size; only offscreen house markers are clamped.
  function drawBaseRadar(c) {
    const bases = baseBearings(),
      target = bases.find(b => b.tracked) || bases[0];
    $('#baseRadarKey').hidden = !bases.length;
    $('#baseBearing').hidden = !target;
    if (!target)
      return;
    $('#baseBearing').textContent = target.name + ' · ' + (target.distance / 1000).toFixed(2) + ' km · ' + Math.round(target.bearing) % 360 + '°';
    $('#baseBearing').title = I18n.t(target.tracked ? 'TRACKED BASE' : 'NEAREST BASE');
    c.save();
    c.beginPath();
    c.arc(78, 78, 73, 0, Math.PI * 2);
    c.clip();
    // Draw the selected destination last so overlapping bearings remain readable.
    for (const b of [...bases.filter(b => !b.tracked), ...bases.filter(b => b.tracked)]) {
      const dx = (b.x - ship.x) / 16,
        dy = (b.y - ship.y) / 16,
        d = b.distance / 16,
        r = b.radius / 16;
      if (d < r + 74) {
        c.beginPath();
        c.arc(78 + dx, 78 + dy, r, 0, Math.PI * 2);
        c.fillStyle = '#79c69c12';
        c.fill();
        c.strokeStyle = b.beacons ? '#8de5b785' : '#8de5b74d';
        c.lineWidth = 1;
        c.setLineDash(b.beacons ? [3, 3] : [1, 3]);
        c.stroke();
        c.setLineDash([]);
      }
      const x = b.radarX,
        y = b.radarY,
        color = b.tracked ? '#dfb878' : '#a2efbf';
      c.strokeStyle = c.fillStyle = color;
      c.lineWidth = b.tracked ? 2 : 1.5;
      c.strokeRect(x - 3, y - 1, 6, 5);
      c.beginPath();
      c.moveTo(x - 5, y - 1);
      c.lineTo(x, y - 5);
      c.lineTo(x + 5, y - 1);
      c.stroke();
      if (b.offscreen) {
        const nx = dx / d,
          ny = dy / d;
        c.beginPath();
        c.moveTo(x + nx * 7, y + ny * 7);
        c.lineTo(x + nx - ny * 3, y + ny + nx * 3);
        c.lineTo(x + nx + ny * 3, y + ny - nx * 3);
        c.closePath();
        c.fill();
      }
      if (b.tracked) {
        c.beginPath();
        c.arc(x, y, 7, 0, Math.PI * 2);
        c.stroke();
      }
    }
    c.restore();
  }
  function renderWormholes(screen) {
    for (const p of portals()) {
      const [x, y] = screen(p.x, p.y);
      if (x < -100 || x > width + 100 || y < -100 || y > height + 100)
        continue;
      disc(x, y, 78, [.15, .4, .55, .04], 40);
      disc(x, y, 55, [.17, .5, .65, .06], 40);
      disc(x, y, 39, [.01, .02, .05, 1], 36);
      for (let ring = 0; ring < 3; ring++)
        for (let i = 0; i < 44; i++) {
          const a = i / 44 * Math.PI * 2 + time * (ring % 2 ? -.3 : .22),
            b = a + .09,
            r = 43 + ring * 8;
          line([x + Math.cos(a) * r, y + Math.sin(a) * r * .8], [x + Math.cos(b) * r, y + Math.sin(b) * r * .8], [.35, .72, .85, .25 + i % 7 / 13], ring === 0 ? 3 : 1);
        }
    }
  }
  function setView(next) {
    view = next;
    zoom = 1;
    pan = {
      x: 0,
      y: 0
    };
    chosen = null;
    refreshMap();
  }

  // Remember whether an inventory dialog was already open before temporarily replacing it.
  function openMap() {
    if (open) {
      closeMap();
      return;
    }
    discover();
    returnFocus = document.activeElement;
    previousPaused = paused;
    previousInventory = !$('#overlay').hidden;
    $('#overlay').hidden = true;
    paused = true;
    keys.clear();
    open = true;
    $('#mapOverlay').hidden = false;
    chosen = null;
    zoom = 1;
    pan = {
      x: 0,
      y: 0
    };
    refreshMap();
    $('#closeMap').focus();
  }
  function closeMap() {
    if (!open)
      return;
    open = false;
    $('#mapOverlay').hidden = true;
    $('#overlay').hidden = !previousInventory;
    paused = previousPaused;
    keys.clear();
    if (returnFocus?.isConnected)
      returnFocus.focus();
  }
  function resizeChart() {
    const bounds = chart.getBoundingClientRect();
    chartWidth = Math.max(1, bounds.width);
    chartHeight = Math.max(1, bounds.height);
    const dpr = Math.min(devicePixelRatio, 2);
    chart.width = Math.round(chartWidth * dpr);
    chart.height = Math.round(chartHeight * dpr);
    pen.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function distance(p) {
    return `${ (Math.hypot(p.x - ship.x, p.y - ship.y) / 1000).toFixed(2) } km`;
  }
  function track(id) {
    const p = signals().find(p => p.id === id);
    if (!p)
      return false;
    tracked = p.id;
    save();
    radar();
    if (open)
      refreshMap();
    return true;
  }

  // Base selection persists a destination and focuses the appropriate map scale.
  function selectMarker(marker) {
    chosen = marker;
    if (marker.type === 'wormhole')
      track(marker.id);
    if (marker.type === 'base') {
      const base = Colony.getBases().find(b => b.id === marker.id);
      if (base) {
        baseTarget = base.id;
        save();
        radar();
        if (view === 'global' || baseSystem(base).id !== current().id) {
          view = 'global';
          zoom = 1;
          pan = {
            x: 0,
            y: 0
          };
        } else if (view === 'local') {
          const p = projectLocal(base.x, base.y);
          pan.x += chartWidth / 2 - p.x;
          pan.y += chartHeight / 2 - p.y;
        }
      }
    }
    refreshMap();
  }

  // Build accessible object lists and visual markers from the same saved base records.
  function refreshMap() {
    if (!open)
      return;
    $('#localMapTab').setAttribute('aria-selected', String(view === 'local'));
    $('#globalMapTab').setAttribute('aria-selected', String(view === 'global'));
    $('#mapReceiver').textContent = online() ? I18n.t('RECEIVER ONLINE · 6.5 KM') : I18n.t('RECEIVER OFFLINE · CRAFT AT WORKBENCH');
    $('#mapReceiver').classList.toggle('online', online());
    $('#mapLegend').textContent = view === 'local' ? I18n.t('▲ SHIP   ○ MOON   ⌂ BASE   ◌ COVERAGE   ◇ WORMHOLE') : I18n.t('● VISITED   ○ LOCATED   — KNOWN WORMHOLE LINK');
    $('#mapLegend').textContent += view === 'global' ? I18n.t('   ⌂ BASES') : '';
    const s = current();
    if (view === 'local') {
      const available = signals();
      $('#mapObjects').innerHTML = I18n.html(`<div class="eyebrow">DETECTED SIGNALS</div>${ available.length ? available.map(p => `<button data-portal="${ p.id }" class="map-object ${ tracked === p.id ? 'tracked' : '' }"><span>◇ ${ fromId(p.to).name }</span><small>${ distance(p) } · ${ visited.has(p.to) ? I18n.t('VISITED') : I18n.t('LOCATED') }</small></button>`).join('') : `<p>${ online() ? I18n.t('No wormholes within receiver range. Keep exploring.') : I18n.t('Craft a Scanner Receiver to reveal wormhole bearings and locate neighboring systems.') }</p>` }<div class="eyebrow map-list-label">NEARBY MOONS</div>${ Colony.getMoons().filter(m => Math.abs(m.x - s.x) < 6000 && Math.abs(m.y - s.y) < 6000).map(m => I18n.html(`<button class="map-object" data-moon="${ m.id }"><span>○ ${ m.name }</span><small>${ distance(m) } · LANDABLE</small></button>`)).join('') }`);
      $('#mapObjects').querySelectorAll('[data-portal]').forEach(b => b.onclick = () => selectMarker({
        type: 'wormhole',
        id: b.dataset.portal
      }));
      $('#mapObjects').querySelectorAll('[data-moon]').forEach(b => b.onclick = () => selectMarker({
        type: 'moon',
        id: b.dataset.moon
      }));
    } else {
      $('#mapObjects').innerHTML = I18n.html(`<div class="eyebrow">${ visited.size } VISITED / ${ located.size } LOCATED</div>${ [...located].sort((a, b) => a === s.id ? -1 : b === s.id ? 1 : a.localeCompare(b)).map(id => `<button class="map-object ${ id === s.id ? 'tracked' : '' }" data-system="${ id }"><span>${ visited.has(id) ? '●' : '○' } ${ fromId(id).name }</span><small>${ id === s.id ? I18n.t('CURRENT SYSTEM') : visited.has(id) ? I18n.t('VISITED') : I18n.t('LOCATED · NOT VISITED') }</small></button>`).join('') }`);
      $('#mapObjects').querySelectorAll('[data-system]').forEach(b => b.onclick = () => selectMarker({
        type: 'system',
        id: b.dataset.system
      }));
    }
    {
      const bases = Colony.getBases().sort((a, b) => Math.hypot(a.x - ship.x, a.y - ship.y) - Math.hypot(b.x - ship.x, b.y - ship.y));
      $('#mapObjects').insertAdjacentHTML('afterbegin', I18n.html(`<div class="eyebrow">BASES & OUTPOSTS</div>${ bases.length ? bases.map(b => I18n.html(`<button class="map-object base-object ${ baseTarget === b.id ? 'tracked' : '' }" data-base="${ b.id }"><span>⌂ ${ b.name }</span><small>${ distance(b) } · ${ baseSystem(b).name }<br>${ b.isBase ? I18n.t('BASE') : I18n.t('OUTPOST') } · ${ b.modules } MODULE${ b.modules === 1 ? '' : 'S' }<br>${ b.beacons ? I18n.t('BEACON COVERAGE') : I18n.t('FOOTPRINT') } · ${ b.radius } m RADIUS</small></button>`)).join('') : I18n.html('<p>Build on a moon to establish an outpost. Place a workbench to make it a base.</p>') }<div class="base-list-divider"></div>`));
      $('#mapObjects').querySelectorAll('[data-base]').forEach(b => b.onclick = () => selectMarker({
        type: 'base',
        id: b.dataset.base
      }));
    }
    if (view === 'local' && typeof Raiders !== 'undefined') {
      $('#mapObjects').insertAdjacentHTML('beforeend', I18n.html(`<div class="eyebrow map-list-label">PIRATE TERRITORY</div>${ Raiders.zones().map(z => `<button class="map-object danger-object" data-pirate-zone="${ z.id }"><span>${ z.cleared ? '✓' : '⚠' } ${ z.name }</span><small>${ distance(z) } · ${ z.cleared ? I18n.t('PATROL CLEARED') : I18n.t('ARMED PATROL ZONE') }</small></button>`).join('') || I18n.html('<p>No reported pirate territory in this system.</p>') }`));
      $('#mapObjects').querySelectorAll('[data-pirate-zone]').forEach(b => b.onclick = () => selectMarker({
        type: 'pirateZone',
        id: b.dataset.pirateZone
      }));
    }
    if (typeof Starbases !== 'undefined') {
      const stations = Starbases.known().filter(b => view === 'global' || b.id === s.id);
      $('#mapObjects').insertAdjacentHTML('beforeend', `<div class="eyebrow map-list-label">${I18n.language === 'cs' ? 'VESMÍRNÉ STANICE' : 'STARBASES'}</div>` + stations.map(b => `<button class="map-object" data-starbase="${b.id}"><span>▣ ${b.name}</span><small>${distance(b)} · ${I18n.language === 'cs' ? 'Obchod / opravy / posádka' : 'Trade / repairs / crew'}</small></button>`).join(''));
      $('#mapObjects').querySelectorAll('[data-starbase]').forEach(b => b.onclick = () => selectMarker({type: 'starbase', id: b.dataset.starbase}));
    }
    if (view === 'local' && typeof BlackHoles !== 'undefined') {
      $('#mapObjects').insertAdjacentHTML('beforeend', `<div class="eyebrow map-list-label">${I18n.language === 'cs' ? 'GRAVITAČNÍ HROZBY' : 'GRAVITY HAZARDS'}</div>` + BlackHoles.nearby().map(hole => `<button class="map-object" data-black-hole="${hole.id}"><span>◉ ${hole.name}</span><small>${distance(hole)} · ${hole.influence} m ${I18n.language === 'cs' ? 'GRAVITAČNÍ POLE' : 'GRAVITY FIELD'}</small></button>`).join(''));
      $('#mapObjects').querySelectorAll('[data-black-hole]').forEach(button => button.onclick = () => selectMarker({type: 'blackHole', id: button.dataset.blackHole}));
    }
    renderDetails();
    resizeChart();
    drawChart();
  }
  function renderDetails() {
    const s = current();
    let title = s.name,
      description = I18n.t(`CURRENT SYSTEM · ${ s.id }`),
      hint = Colony.onSurface ? I18n.t('Surface expedition. Your ship is parked on this moon.') : I18n.t('Your local chart covers this system. Select a signal to track its bearing.');
    if (chosen?.type === 'blackHole' && typeof BlackHoles !== 'undefined') {
      const hole = BlackHoles.getById(chosen.id);
      if (hole) {
        title = hole.name;
        description = I18n.language === 'cs' ? 'NEBEZPEČNÁ GRAVITACE' : 'DANGEROUS GRAVITY';
        hint = I18n.language === 'cs' ? 'Pole přitahuje lodě i asteroidy. Držte se mimo 1900 m. Štíty gravitaci nezastaví; použijte zrychlení včas.' : 'Pulls ships and asteroids inward. Stay outside 1900 m. Shields cannot stop gravity; boost away early.';
      }
    }
    if (chosen?.type === 'starbase' && typeof Starbases !== 'undefined') {
      const base = Starbases.known().find(b => b.id === chosen.id);
      if (base) {
        title = base.name;
        description = I18n.language === 'cs' ? 'CIVILNÍ STANICE' : 'CIVILIAN STARBASE';
        hint = I18n.language === 'cs' ? 'Obchod, opravy a nábor posádky. Přibližte se na 260 m, zpomalte pod 100 m/s a stiskněte H.' : 'Trade, repairs and crew recruitment. Approach within 260 m, slow below 100 m/s and press H.';
      }
    }
    if ((chosen?.type) === 'system') {
      const target = fromId(chosen.id);
      title = target.name;
      description = visited.has(target.id) ? I18n.t('VISITED SYSTEM') : I18n.t('LOCATED · NOT YET VISITED');
      hint = target.id === s.id ? I18n.t('You are here.') : I18n.t(`Galactic coordinates ${ target.id }. Follow a detected wormhole bearing and enter its gate to explore this system.`);
    }
    if ((chosen?.type) === 'wormhole') {
      const p = signals().find(p => p.id === chosen.id);
      if (p) {
        title = fromId(p.to).name;
        description = I18n.t(`WORMHOLE · ${ distance(p) }`);
        hint = I18n.t('Bearing tracked in amber on the minimap. Approach within 120 m, slow below 160 m/s, then press E to enter.');
      }
    }
    if ((chosen?.type) === 'moon') {
      const m = Colony.getMoons().find(m => m.id === chosen.id);
      if (m) {
        title = m.name;
        description = I18n.t(`LANDABLE MOON · ${ distance(m) }`);
        hint = I18n.t('Approach slowly and press E to land, mine, and build a base.');
      }
    }
    if ((chosen?.type) === 'base') {
      const b = Colony.getBases().find(b => b.id === chosen.id);
      if (b) {
        title = b.name;
        description = I18n.t(`YOUR ${ b.isBase ? I18n.t('BASE') : I18n.t('OUTPOST') } · ${ distance(b) }`);
        hint = I18n.t(`${ b.modules } built module${ b.modules === 1 ? '' : 's' } on ${ b.moonName }. Footprint radius: ${ b.footprint } m. ${ b.beacons ? I18n.t(`${ b.beacons } beacon${ b.beacons === 1 ? '' : 's' } broadcasting within a ${ b.radius } m radius.`) : I18n.t('Place a beacon to extend signal coverage to a 1.2 km radius.') } Workbenches: ${ b.counts.bench }. Furnaces: ${ b.counts.furnace }.`) + ' ' + I18n.t('Base bearing highlighted on the minimap. Direct bearing; use wormholes to travel between systems.');
      }
    }
    if ((chosen?.type) === 'pirateZone' && typeof Raiders !== 'undefined') {
      const z = Raiders.zones().find(z => z.id === chosen.id);
      if (z) {
        title = z.name;
        description = z.cleared ? I18n.t('PATROL CLEARED') : I18n.t('DANGER · ARMED PIRATE TERRITORY');
        hint = z.cleared ? I18n.t('This patrol has been defeated. The cleared state is saved.') : I18n.t('Pirates defend this region and pursue nearby ships. Use asteroids as cover, fight for salvage, or boost out of their territory.');
      }
    }
    let risk = '';
    if (typeof Raiders !== 'undefined') {
      const target = (chosen?.type) === 'system' ? fromId(chosen.id) : (chosen?.type) === 'wormhole' ? fromId(chosen.id.split('>')[1]) : s;
      const danger = Raiders.riskFor(target);
      risk = `<div class="map-risk ${ danger.level ? 'danger' : 'quiet' }">${ danger.level ? '⚠' : '○' } ${ danger.name }</div>`;
    }
    $('#mapDetails').innerHTML = `<div class="eyebrow">${ description }</div><h3>${ title }</h3><p>${ hint }</p>${ risk }`;
  }

  // Local charts center on the current system, with zoom and drag offsets applied afterwards.
  function projectLocal(x, y) {
    const s = current(),
      scale = Math.min(chartWidth, chartHeight) / 14000 * zoom;
    return {
      x: chartWidth / 2 + (x - s.x) * scale + pan.x,
      y: chartHeight / 2 + (y - s.y) * scale + pan.y
    };
  }
  function label(text, x, y, color = '#839daa') {
    pen.fillStyle = color;
    pen.font = '10px monospace';
    if (view === 'global') {
      pen.save();
      pen.strokeStyle = '#08121ce8';
      pen.lineWidth = 4;
      pen.lineJoin = 'round';
      pen.strokeText(text, x, y);
      pen.restore();
    }
    pen.fillText(text, x, y);
  }
  function marker(x, y, r, color, filled = false) {
    pen.beginPath();
    pen.arc(x, y, r, 0, Math.PI * 2);
    pen.strokeStyle = color;
    pen.lineWidth = 1.5;
    pen.stroke();
    if (filled) {
      pen.fillStyle = color;
      pen.fill();
    }
  }

  // A seeded, decorative atlas: soft spiral arms, nebula knots and distant stars.
  // Generate geometry once; redraw only on map interaction, never in the flight loop.
  // These clouds are scenery, not undiscovered systems or extra wormhole routes.
  const galacticScenery = (() => {
    const rng = random(61429), clouds = [], stars = [];
    for (const [cx, cy, radius, tint] of [
      [.44, .51, .48, '63,113,172'],
      [.83, .24, .22, '141,78,170'],
      [.12, .87, .25, '40,143,151']
    ]) {
      for (let i = 0; i < 100; i++) {
        const distance = Math.sqrt(rng()) * radius;
        const angle = distance / radius * 7 + (i % 3) * Math.PI * 2 / 3 + (rng() - .5) * .65;
        clouds.push({
          x: cx + Math.cos(angle) * distance,
          y: cy + Math.sin(angle) * distance * .52,
          r: .025 + rng() * .055,
          tint,
          alpha: .055 + rng() * .09
        });
      }
      clouds.push({x: cx, y: cy, r: radius * .2, tint: '180,178,218', alpha: .2});
    }
    for (let i = 0; i < 700; i++)
      stars.push({x: rng(), y: rng(), r: rng() < .96 ? .7 : 1.4, alpha: .12 + rng() * .55});
    return {clouds, stars};
  })();

  function drawGalacticScenery() {
    // Gentle parallax keeps the scenery continuous while dragging/zooming the atlas.
    const width = chartWidth * 1.7, height = chartHeight * 1.7;
    const scale = Math.pow(zoom, .25);
    pen.save();
    pen.translate(chartWidth / 2 + pan.x * .18, chartHeight / 2 + pan.y * .18);
    pen.scale(scale, scale);
    pen.globalCompositeOperation = 'screen';
    for (const cloud of galacticScenery.clouds) {
      const x = (cloud.x - .5) * width, y = (cloud.y - .5) * height;
      const r = cloud.r * Math.max(width, height);
      const glow = pen.createRadialGradient(x, y, 0, x, y, r);
      glow.addColorStop(0, `rgba(${cloud.tint},${cloud.alpha})`);
      glow.addColorStop(1, `rgba(${cloud.tint},0)`);
      pen.fillStyle = glow;
      pen.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (const star of galacticScenery.stars) {
      pen.fillStyle = `rgba(190,211,239,${star.alpha})`;
      pen.fillRect((star.x - .5) * width, (star.y - .5) * height, star.r, star.r);
    }
    pen.restore();
  }
  function drawChart() {
    if (!open)
      return;
    hits = [];
    pen.clearRect(0, 0, chartWidth, chartHeight);
    pen.fillStyle = '#08121c';
    pen.fillRect(0, 0, chartWidth, chartHeight);
    const rng = random(1873);
    for (let i = 0; i < 160; i++) {
      pen.fillStyle = `rgba(150,180,200,${ .1 + rng() * .3 })`;
      pen.fillRect(rng() * chartWidth, rng() * chartHeight, 1, 1);
    }
    if (view === 'local')
      drawLocal();
    else
      drawGlobal();
    if (view === 'local' && typeof Salvage !== 'undefined') Salvage.drawLocal(pen, projectLocal);
    if (view === 'local' && typeof QuestTracker !== 'undefined') QuestTracker.drawLocal(pen, projectLocal);
  }
  function drawLocal() {
    const s = current();
    if (typeof MissionContracts !== 'undefined') MissionContracts.drawMap(pen, projectLocal);
    if (typeof BlackHoles !== 'undefined') BlackHoles.drawLocal(pen, projectLocal);
    if (typeof Starbases !== 'undefined') {
      const base = Starbases.currentStation(), p = projectLocal(base.x, base.y);
      Starbases.drawMarker(pen, p.x, p.y, base.name);
      hits.push({...p, type: 'starbase', id: base.id});
    }
    pen.strokeStyle = '#5c7f9220';
    pen.lineWidth = 1;
    for (let n = -6000; n <= 6000; n += 2000) {
      const a = projectLocal(s.x + n, s.y - 6000),
        b = projectLocal(s.x + n, s.y + 6000),
        c = projectLocal(s.x - 6000, s.y + n),
        d = projectLocal(s.x + 6000, s.y + n);
      pen.beginPath();
      pen.moveTo(a.x, a.y);
      pen.lineTo(b.x, b.y);
      pen.moveTo(c.x, c.y);
      pen.lineTo(d.x, d.y);
      pen.stroke();
    }
    if (typeof Raiders !== 'undefined') {
      Raiders.drawLocal(pen, projectLocal);
      for (const z of Raiders.zones()) {
        const p = projectLocal(z.x, z.y);
        hits.push({
          ...p,
          type: 'pirateZone',
          id: z.id
        });
      }
    }
    const bases = localBases();
    for (const b of bases) {
      const p = projectLocal(b.x, b.y),
        edge = projectLocal(b.x + b.radius, b.y),
        r = Math.abs(edge.x - p.x);
      pen.beginPath();
      pen.arc(p.x, p.y, r, 0, Math.PI * 2);
      pen.fillStyle = '#79c69c0e';
      pen.fill();
      pen.lineWidth = 1.3;
      pen.strokeStyle = b.beacons ? '#8de5b780' : '#8de5b745';
      pen.setLineDash(b.beacons ? [4, 5] : [2, 5]);
      pen.stroke();
      pen.setLineDash([]);
      if (b.beacons) {
        const footprint = projectLocal(b.x + b.footprint, b.y);
        marker(p.x, p.y, Math.abs(footprint.x - p.x), '#8de5b72e');
      }
    }
    for (const r of rocks) {
      const p = projectLocal(r.x, r.y);
      pen.fillStyle = r.type === 'ice' ? '#8ab4c45a' : '#7e899956';
      pen.fillRect(p.x, p.y, 2, 2);
    }
    for (const m of Colony.getMoons()) {
      if (Math.abs(m.x - s.x) > 6000 || Math.abs(m.y - s.y) > 6000)
        continue;
      const p = projectLocal(m.x, m.y);
      marker(p.x, p.y, 6, '#8ea7b7');
      if (!bases.some(b => b.id === m.id))
        label(m.name, p.x + 10, p.y - 9);
      hits.push({
        ...p,
        type: 'moon',
        id: m.id
      });
    }
    for (const b of bases) {
      const p = projectLocal(b.x, b.y);
      pen.save();
      pen.translate(p.x, p.y);
      pen.strokeStyle = '#a2efbf';
      pen.fillStyle = '#102d25';
      pen.lineWidth = 1.7;
      pen.fillRect(-5, -2, 10, 9);
      pen.strokeRect(-5, -2, 10, 9);
      pen.beginPath();
      pen.moveTo(-7, -2);
      pen.lineTo(0, -8);
      pen.lineTo(7, -2);
      pen.stroke();
      pen.restore();
      if ((chosen?.type) === 'base' && chosen.id === b.id)
        marker(p.x, p.y, 13, '#a2efbf');
      label(b.name, p.x + 13, p.y - 12, '#a2dfb9');
      label(`${ b.beacons ? I18n.t('BEACON') : I18n.t('FOOTPRINT') } R ${ b.radius } m`, p.x + 13, p.y + 3, '#659d82');
      hits.unshift({
        ...p,
        type: 'base',
        id: b.id
      });
    }
    const shipPoint = projectLocal(ship.x, ship.y);
    if (online()) {
      const scale = Math.min(chartWidth, chartHeight) / 14000 * zoom;
      pen.setLineDash([3, 7]);
      marker(shipPoint.x, shipPoint.y, range * scale, '#57bec32a');
      pen.setLineDash([]);
    }
    for (const p of signals()) {
      const pos = projectLocal(p.x, p.y),
        color = tracked === p.id ? '#dfb878' : '#7cd5e2';
      pen.strokeStyle = color + '55';
      pen.setLineDash([3, 5]);
      pen.beginPath();
      pen.moveTo(shipPoint.x, shipPoint.y);
      pen.lineTo(pos.x, pos.y);
      pen.stroke();
      pen.setLineDash([]);
      pen.save();
      pen.translate(pos.x, pos.y);
      pen.rotate(Math.PI / 4);
      pen.strokeStyle = color;
      pen.lineWidth = 2;
      pen.strokeRect(-5, -5, 10, 10);
      pen.restore();
      label(fromId(p.to).name, pos.x + 12, pos.y - 10, color);
      hits.push({
        ...pos,
        type: 'wormhole',
        id: p.id
      });
    }
    pen.save();
    pen.translate(shipPoint.x, shipPoint.y);
    pen.rotate(ship.angle);
    pen.fillStyle = '#dfb878';
    pen.beginPath();
    pen.moveTo(0, -8);
    pen.lineTo(-5, 6);
    pen.lineTo(0, 3);
    pen.lineTo(5, 6);
    pen.closePath();
    pen.fill();
    pen.restore();
    label(Shipyard.current.name.toUpperCase(), shipPoint.x + 12, shipPoint.y + 18, '#dfb878');
    label(I18n.t(`${ s.name.toUpperCase() } / LOCAL SPACE`), 18, 26);
    label(I18n.t('SYSTEM WIDTH 12 KM · NORTH ↑'), 18, chartHeight - 18);
  }

  // Fit known systems and base locations together. Multiple bases share a system marker
  // but keep individual sidebar entries and selectable destinations.
  function drawGlobal() {
    drawGalacticScenery();
    const baseSystems = Colony.getBases().map(baseSystem),
      systemIds = new Set([...located, ...baseSystems.map(s => s.id), ...(typeof QuestTracker !== 'undefined' && QuestTracker.target() ? [QuestTracker.target().system] : [])]);
    const systems = [...systemIds].map(fromId),
      xs = systems.map(s => s.gx),
      ys = systems.map(s => s.gy);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const scale = Math.min((chartWidth - 100) / Math.max(2, maxX - minX), (chartHeight - 100) / Math.max(2, maxY - minY)) * zoom;
    const project = s => ({
      x: chartWidth / 2 + (s.gx - (minX + maxX) / 2) * scale + pan.x,
      y: chartHeight / 2 + (s.gy - (minY + maxY) / 2) * scale + pan.y
    });
    // Only recorded wormhole edges become routes; never connect systems by list order.
    for (const e of links) {
      const [a, b] = e.split('|').map(fromId);
      if (!a || !b)
        continue;
      const p = project(a),
        q = project(b);
      const selected = (chosen?.type === 'system' && [a.id, b.id].includes(chosen.id)) ||
        (tracked && edge(...tracked.split('>')) === e);
      pen.save();
      pen.strokeStyle = selected ? '#efc685' : '#83d6e3';
      pen.lineWidth = selected ? 2 : 1.2;
      pen.shadowColor = pen.strokeStyle;
      pen.shadowBlur = selected ? 9 : 4;
      pen.setLineDash(visited.has(a.id) && visited.has(b.id) ? [] : [5, 6]);
      pen.beginPath();
      pen.moveTo(p.x, p.y);
      pen.lineTo(q.x, q.y);
      pen.stroke();
      pen.restore();
    }
    for (const s of systems) {
      const p = project(s),
        here = s.id === current().id,
        color = here ? '#dfb878' : visited.has(s.id) ? '#a8d1d2' : '#6f929e';
      // An opaque halo separates interactive markers from the nebula and routes.
      pen.beginPath();
      pen.arc(p.x, p.y, here ? 10 : 8, 0, Math.PI * 2);
      pen.fillStyle = '#08121ce8';
      pen.fill();
      marker(p.x, p.y, here ? 7 : 5, color, visited.has(s.id));
      if (here)
        marker(p.x, p.y, 12, '#dfb87866');
      if ((chosen?.type) === 'system' && chosen.id === s.id)
        marker(p.x, p.y, 16, '#b4dbe1');
      label(s.name, p.x + 13, p.y - 9, color);
      label(here ? I18n.t('YOU ARE HERE') : visited.has(s.id) ? I18n.t('VISITED') : I18n.t('LOCATED'), p.x + 13, p.y + 7, '#587380');
      hits.push({
        ...p,
        type: 'system',
        id: s.id
      });
    }
    if (typeof Starbases !== 'undefined') {
      for (const base of Starbases.known()) {
        const p = project({gx: base.x / spacing, gy: base.y / spacing});
        Starbases.drawMarker(pen, p.x, p.y, base.name);
        hits.unshift({...p, type: 'starbase', id: base.id});
      }
    }
    if (typeof BlackHoles !== 'undefined') {
      for (const system of systems) for (const hole of BlackHoles.forSystem(system.gx, system.gy)) {
        const p = project({gx: hole.x / spacing, gy: hole.y / spacing});
        BlackHoles.drawMarker(pen, p.x, p.y);
        hits.unshift({...p, type: 'blackHole', id: hole.id});
      }
    }
    const groups = new Map();
    for (const b of Colony.getBases()) {
      const id = baseSystem(b).id;
      if (!groups.has(id))
        groups.set(id, []);
      groups.get(id).push(b);
    }
    for (const [id, bases] of groups) {
      const p = project(fromId(id)),
        selected = bases.find(b => b.id === baseTarget),
        base = selected || bases[0],
        x = p.x - 15,
        y = p.y - 16,
        color = selected ? '#dfb878' : '#a2efbf';
      pen.strokeStyle = color;
      pen.fillStyle = '#102d25';
      pen.lineWidth = 1.7;
      pen.fillRect(x - 4, y, 8, 7);
      pen.strokeRect(x - 4, y, 8, 7);
      pen.beginPath();
      pen.moveTo(x - 6, y);
      pen.lineTo(x, y - 6);
      pen.lineTo(x + 6, y);
      pen.stroke();
      if (selected)
        marker(x, y, 11, color);
      label(bases.length === 1 ? base.name : I18n.t('BASES') + ': ' + bases.length, x + 10, y - 8, color);
      hits.unshift({
        x,
        y,
        type: 'base',
        id: base.id
      });
    }
    label(I18n.t('KNOWN SYSTEMS / GALACTIC CHART'), 18, 26);
    label(I18n.t('UNDETECTED SYSTEMS REMAIN HIDDEN'), 18, chartHeight - 18);
    if (typeof Raiders !== 'undefined')
      for (const s of systems) {
        const risk = Raiders.riskFor(s);
        if (risk.level) {
          const p = project(s),
            cleared = Raiders.zones(s).every(z => z.cleared);
          label(cleared ? I18n.t('PATROLS CLEARED') : I18n.t('⚠ PIRATE PATROLS'), p.x + 13, p.y + 22, cleared ? '#82aa93' : '#ca8273');
        }
      }
    if (typeof Salvage !== 'undefined') Salvage.drawGlobal(pen, project);
    if (typeof QuestTracker !== 'undefined') QuestTracker.drawGlobal(pen, project);
  }
  $('#mapButton').onclick = openMap;
  $('#closeMap').onclick = closeMap;
  $('#localMapTab').onclick = () => setView('local');
  $('#globalMapTab').onclick = () => setView('global');
  $('#zoomIn').onclick = () => {
    zoom = Math.min(5, zoom * 1.3);
    drawChart();
  };
  $('#zoomOut').onclick = () => {
    zoom = Math.max(.4, zoom / 1.3);
    drawChart();
  };
  $('#fitMap').onclick = () => {
    zoom = 1;
    pan = {
      x: 0,
      y: 0
    };
    drawChart();
  };
  $('#enterWormhole').onclick = enter;
  chart.addEventListener('wheel', e => {
    e.preventDefault();
    zoom = Math.max(.4, Math.min(5, zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    drawChart();
  }, { passive: false });
  chart.addEventListener('pointerdown', e => {
    drag = {
      x: e.clientX,
      y: e.clientY,
      pan: { ...pan }
    };
    dragged = false;
    chart.setPointerCapture(e.pointerId);
  });
  chart.addEventListener('pointermove', e => {
    if (!drag)
      return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4)
      dragged = true;
    if (dragged) {
      pan = {
        x: drag.pan.x + dx,
        y: drag.pan.y + dy
      };
      drawChart();
    }
  });
  chart.addEventListener('pointerup', e => {
    if (!drag)
      return;
    drag = null;
    if (dragged)
      return;
    const rect = chart.getBoundingClientRect(),
      x = e.clientX - rect.left,
      y = e.clientY - rect.top;
    const hit = hits.find(p => Math.hypot(x - p.x, y - p.y) < 14);
    if (hit)
      selectMarker(hit);
  });
  chart.addEventListener('pointercancel', () => drag = null);
  addEventListener('resize', () => {
    if (open) {
      resizeChart();
      drawChart();
    }
  });
  addEventListener('keydown', e => {
    if (typeof QuestLog !== 'undefined' && QuestLog.isOpen)
      return;
    if (e.repeat)
      return;
    if (e.code === 'KeyM') {
      e.preventDefault();
      openMap();
      return;
    }
    if (open) {
      if (e.code === 'Escape') {
        e.preventDefault();
        closeMap();
      }
      if (e.code === 'Tab') {
        const focusable = [...$('#mapOverlay').querySelectorAll('button:not(:disabled)')];
        const first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
      return;
    }
    if (e.code === 'KeyE' && !paused && !Colony.onSurface && nearbyPortal())
      enter();
  });
  addEventListener('beforeunload', save);
  load();
  discover();
  return {
    revealRoute,
    get mapOpen() {
      return open;
    },
    get view() {
      return view;
    },
    get tracked() {
      return tracked;
    },
    get located() {
      return [...located];
    },
    get visited() {
      return [...visited];
    },
    refresh: refreshMap,
    current,
    system,
    portals,
    signals,
    nearbyPortal,
    online,
    baseBearings,
    baseSystem,
    selectMarker,
    get trackedBase() {
      return baseTarget;
    },
    update,
    drawRadar,
    renderWormholes,
    openMap,
    closeMap,
    setView,
    track,
    enter,
    save,
    discover
  };
})();

/** Civilian stations, trade and crew. Economy shares the cargo save record. */
const Starbases = (() => {
  const $ = s => document.querySelector(s);
  const tr = (en, cs) => I18n.language === 'cs' ? cs : en;
  const roles = {
    miner: {name: 'Rhea', cost: 80, title: () => tr('Mining specialist', 'Specialistka těžby'), description: () => tr('+25% asteroid damage; weapon hardness requirements still apply.', '+25 % poškození asteroidů; požadavky na zbraně stále platí.')},
    engineer: {name: 'Tarek', cost: 110, title: () => tr('Engineer', 'Inženýr'), description: () => tr('20% less flight fuel consumption, including boost.', 'O 20 % nižší spotřeba paliva, včetně zrychlení.')},
    mechanic: {name: 'Ada', cost: 100, title: () => tr('Repair specialist', 'Specialistka oprav'), description: () => tr('Repairs 1% hull per 5 seconds after 8 seconds without damage.', 'Opraví 1 % trupu za 5 sekund po 8 sekundách bez poškození.')}
  };
  const market = {metal: [5, 2], ice: [5, 2], crystal: [15, 7], bulterite: [36, 18], ingot: [12, 5], fuel_cell: [9, 3], ion_cube: [28, 12], ammo_rockbreaker: [8, 3], ammo_piercer: [18, 7], ammo_seismic: [40, 16]};
  let credits = 120, crew = [], discovered = new Set(['0:0']), met = new Set();
  let docked = null, quiet = 0, lastHull = 100, repairClock = 0, returnFocus = null;
  // One installation per system, generated on demand instead of cached indefinitely.
  function station(gx, gy) {
    const rng = random(Math.imul(gx, 3769) ^ Math.imul(gy, 977) ^ 4147);
    return {id: `${gx}:${gy}`, gx, gy, name: gx === 0 && gy === 0 ? 'Wayfarer Exchange' : `${['Vela', 'Aurora', 'Meridian', 'Kepler'][Math.floor(rng() * 4)]} ${gx}:${gy}`,
      x: gx * 12000 + 1800 + (gx || gy ? (rng() - .5) * 1000 : 0),
      y: gy * 12000 + 1100 + (gx || gy ? (rng() - .5) * 1000 : 0)};
  }
  function currentStation() { return station(Math.floor((ship.x + 6000) / 12000), Math.floor((ship.y + 6000) / 12000)); }
  function known() { return [...new Set([...discovered, currentStation().id, ...(typeof MissionContracts !== 'undefined' ? MissionContracts.knownDestinations() : [])])].map(id => station(...id.split(':').map(Number))); }
  function snapshot() { rememberCrew(); return {credits, crew: [...crew], discovered: [...discovered], met: [...met]}; }
  function restore(data) {
    if (!data || typeof data !== 'object') return;
    if (Number.isSafeInteger(data.credits) && data.credits >= 0) credits = Math.min(data.credits, 1e9);
    if (Array.isArray(data.crew)) crew = [...new Set(data.crew.filter(id => Object.hasOwn(roles, id)))];
    if (Array.isArray(data.met)) met = new Set(data.met.filter(id=>Object.hasOwn(roles,id)||['captain','jegor','bobo'].includes(id)));
    crew.forEach(id=>met.add(id));
    if (Array.isArray(data.discovered)) discovered = new Set(['0:0', ...data.discovered.filter(id => typeof id === 'string' && /^-?\d{1,6}:-?\d{1,6}$/.test(id))]);
  }
  try { restore(JSON.parse((typeof Profiles === 'undefined' ? localStorage : Profiles).getItem('spacecraft-save-v1') || 'null')?.starbases); } catch {}
  function addCredits(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) return false;
    credits = Math.min(1e9, credits + amount);
    return true; // Caller commits economy and quest claim in Colony.save().
  }
  function canDock() {
    const s = currentStation();
    return !Colony.onSurface && Math.hypot(s.x - ship.x, s.y - ship.y) <= 260 && Math.hypot(ship.vx, ship.vy) < 100;
  }
  const validDock = () => docked && canDock() && currentStation().id === docked.id;
  function commit() { Colony.save(); GameAudio.play('craft'); renderPanel(); }
  // Cargo and credits mutate together before one save; failed insertions cost nothing.
  function trade(type, buying) {
    if (!validDock() || !Object.hasOwn(market, type)) return false;
    const [buy, sell] = market[type];
    if (buying) {
      if (credits < buy || !Colony.addItem(type, 1)) return false;
      credits -= buy;
    } else {
      if (credits + sell > 1e9 || !Colony.consumeItem(type, 1, false)) return false;
      credits += sell;
    }
    commit(); return true;
  }
  function hire(role) {
    if (!validDock() || !Object.hasOwn(roles, role) || crew.includes(role) || crew.length >= 3 || credits < roles[role].cost) return false;
    credits -= roles[role].cost; crew.push(role); met.add(role); commit(); return true;
  }
  // Built-in crew belongs to the hull. Switching presets cannot duplicate Bobo,
  // and his robot berth leaves all three hired-specialist bunks available.
  function startingCrew() { return Shipyard.current.startingCrew || []; }
  function crewCount() { return 1 + startingCrew().length + crew.length; }
  function crewCapacity() { return 4 + startingCrew().length; }
  function repairMultiplier() {
    return 1 - Math.max(0, ...startingCrew().map(person => person.repairDiscount || 0));
  }
  function captainName() {
    return Shipyard.current.captain === 'You' ? tr('You', 'Vy') : Shipyard.current.captain;
  }
  function startingCrewSummary(id = Shipyard.current.id) {
    const preset = Shipyard.presets[id];
    const captain = preset.captain === 'You' ? tr('You', 'Vy') : preset.captain;
    return `${tr('Captain', 'Kapitán')}: ${captain}` + (preset.startingCrew.length ? ` · Bobo: ${tr('50% cheaper repairs', 'opravy o 50 % levnější')}` : '');
  }
  const repairCost = () => Math.ceil(Math.max(0, 100 - ship.hull) * repairMultiplier());
  function repair() {
    const cost = repairCost();
    if (!validDock() || !cost || credits < cost) return false;
    credits -= cost; ship.hull = lastHull = 100; commit(); return true;
  }
  function openDock() {
    if (paused || !canDock()) return false;
    docked = currentStation(); discovered.add(docked.id);
    Object.keys(roles).forEach(id=>met.add(id));
    ship.vx = ship.vy = 0; keys.clear(); paused = true; GameAudio.setEngine(0);
    returnFocus = document.activeElement;
    $('#starbaseOverlay').hidden = false; renderPanel(); $('#undock').focus(); Colony.save(); return true;
  }
  function closeDock() {
    if (!docked) return;
    docked = null; $('#starbaseOverlay').hidden = true; paused = false; keys.clear(); returnFocus?.focus(); Colony.save();
  }
  // Portrait IDs are stable artwork keys; names/roles remain localized HTML.
  const portraitIds = {miner: 'rhea', engineer: 'tarek', mechanic: 'ada', bobo: 'bobo', jegor: 'jegor', captain: 'captain'};
  function portrait(id) {
    return `<img class="crew-avatar" src="assets/crew/${portraitIds[id]}.png" alt="" width="64" height="64" decoding="async">`;
  }
  function startingCrewPortraits(id = Shipyard.current.id) {
    return `<span class="starting-crew-portraits" aria-hidden="true">${portrait(id === 'kraxna' ? 'jegor' : 'captain')}${Shipyard.presets[id].startingCrew.map(person => portrait(person.id)).join('')}</span>`;
  }
  // Encounters outlive employment and ship changes; only confirmed ships count.
  function rememberCrew() {
    if (!Shipyard.confirmed) return;
    met.add(Shipyard.current.id === 'kraxna' ? 'jegor' : 'captain');
    startingCrew().forEach(p=>met.add(p.id));
  }
  function characters() {
    const known = new Set([...met,...crew]);
    const aboard = new Set(crew);
    if (Shipyard.confirmed) {
      const captain=Shipyard.current.id === 'kraxna' ? 'jegor' : 'captain';
      known.add(captain); aboard.add(captain);
      startingCrew().forEach(p=>{known.add(p.id);aboard.add(p.id);});
    }
    return [...known].map(id=>{
      const person=roles[id], captain=['jegor','captain'].includes(id);
      return {id:'character:'+id,category:'characters',
        name:person ? person.name : id==='jegor' ? Shipyard.presets.kraxna.captain : id==='bobo' ? 'Bobo' : tr('You','Vy'),
        role:person ? person.title() : captain ? tr('Captain','Kapitán') : tr('Repair robot','Opravárenský robot'),
        description:person ? person.description() : id==='bobo'
          ? tr('Repair robot aboard Kraxna 1. Station hull repairs cost 50% less while Bobo is aboard. Has a separate robot berth.',
               'Opravárenský robot na Kraxně 1. S Bobem na palubě stojí opravy trupu ve stanicích o 50 % méně. Má vlastní robotické lůžko.')
          : id==='jegor' ? tr('Captain of Kraxna 1, seasoned space garbage man and partner of repair robot Bobo.',
               'Kapitán Kraxny 1, zkušený vesmírný popelář a parťák opravárenského robota Boba.')
          : tr('Your expedition captain: explorer, miner and pilot leading the crew into uncharted space.',
               'Kapitán vaší expedice: průzkumník, horník a pilot vedoucí posádku do neprobádaného vesmíru.'),
        icon:'assets/crew/'+portraitIds[id]+'.png',
        status:aboard.has(id) ? (captain ? tr('Current captain','Současný kapitán') : tr('On board','Na palubě')) : tr('Met','Známá postava')};
    });
  }

  function renderPanel() {
    if (!docked) return;
    $('#starbaseTitle').textContent = docked.name;
    $('#stationBalance').textContent = `${credits} ${tr('credits', 'kreditů')} · ${tr('Crew', 'Posádka')} ${crewCount()}/${crewCapacity()}`;
    $('#stationRepair').textContent = `${tr('Repair hull', 'Opravit trup')} (${Math.ceil(ship.hull)}%) · ${repairCost()} cr`;
    $('#stationRepair').disabled = !repairCost() || credits < repairCost();
    $('#stationRepair').title = startingCrew().length ? tr('Bobo: 50% repair discount, rounded up to whole credits.', 'Bobo: sleva 50 % na opravy, cena zaokrouhlená nahoru na celé kredity.') : '';
    $('#stationMarket').innerHTML = Object.entries(market).map(([id, [buy, sell]]) => {
      const item = Colony.items[id];
      return `<div class="station-row"><img src="assets/items/${item.asset || (item.image || id) + '.png'}" alt="" width="36" height="36"><span>${item.name}<small>${tr('In cargo', 'V nákladu')}: ${Colony.availableCount(id)}</small></span><button data-buy="${id}" ${credits < buy ? 'disabled' : ''}>${tr('Buy', 'Koupit')} ${buy}</button><button data-sell="${id}" ${Colony.availableCount(id) < 1 ? 'disabled' : ''}>${tr('Sell', 'Prodat')} ${sell}</button></div>`;
    }).join('');
    const captainRole = Shipyard.current.id === 'kraxna' ? tr('Captain & space garbage man', 'Kapitán a vesmírný popelář') : tr('Captain', 'Kapitán');
    const manifest = `<article>${portrait(Shipyard.current.id === 'kraxna' ? 'jegor' : 'captain')}<b>${captainName()} · ${captainRole}</b><p>${tr('Your player character.', 'Vaše hráčská postava.')}</p></article>` + startingCrew().map(person => `<article>${portrait(person.id)}<b>${person.name} · ${tr('Repair robot', 'Opravárenský robot')}</b><p>${tr('Station hull repairs cost 50% less. Built into Kraxna; has a separate robot berth.', 'Opravy trupu ve stanicích jsou o 50 % levnější. Patří ke Kraxně; má vlastní robotické lůžko.')}</p></article>`).join('');
    $('#stationCrew').innerHTML = manifest + `<p>${tr('Three specialist bunks are available; hire each specialist once.', 'Máte tři lůžka pro specialisty; každého lze najmout jednou.')}</p>` + Object.entries(roles).map(([id, person]) => `<article>${portrait(id)}<b>${person.name} · ${person.title()}</b><p>${person.description()}</p><button data-hire="${id}" ${crew.includes(id) || credits < person.cost ? 'disabled' : ''}>${crew.includes(id) ? tr('On board', 'Na palubě') : tr('Hire', 'Najmout') + ' · ' + person.cost + ' cr'}</button></article>`).join('');
    $('#stationMarket').querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { if (!trade(b.dataset.buy, true)) notify(tr('Not enough credits or cargo space.', 'Nedostatek kreditů nebo místa v nákladu.')); });
    $('#stationMarket').querySelectorAll('[data-sell]').forEach(b => b.onclick = () => trade(b.dataset.sell, false));
    $('#stationCrew').querySelectorAll('[data-hire]').forEach(b => b.onclick = () => hire(b.dataset.hire));
  }
  function update(dt) {
    if (Colony.onSurface) { $('#dockPrompt').hidden = true; return; }
    const s = currentStation(); discovered.add(s.id);
    $('#dockPrompt').hidden = false;
    $('#dockPrompt').textContent = `${s.name} · ${Math.round(Math.hypot(s.x - ship.x, s.y - ship.y))} m · ${tr('Crew', 'Posádka')} ${crewCount()}/${crewCapacity()} · ${credits} cr · ${canDock() ? tr('H TO DOCK', 'H DOKOVAT') : tr('Approach within 260 m, speed <100 m/s', 'Přibližte se na 260 m, rychlost <100 m/s')}`;
    // Full station information is still available on hover.
    $('#dockPrompt').title = $('#dockPrompt').textContent;
    $('#dockPrompt').textContent = s.name + ' · ' + Math.round(Math.hypot(s.x-ship.x,s.y-ship.y)) + ' m' +
      (canDock() ? ' · H ' + tr('DOCK','DOKOVAT') : Math.hypot(s.x-ship.x,s.y-ship.y)<=260 ? ' · <100 m/s' : '');
    if (ship.hull < lastHull) quiet = 0; else quiet += dt;
    lastHull = ship.hull;
    if (crew.includes('mechanic') && quiet >= 8 && ship.hull < 100) {
      ship.hull = Math.min(100, ship.hull + dt * .2); lastHull = ship.hull;
      repairClock += dt;
      if (repairClock >= 5) { repairClock = 0; Colony.save(); }
    }
  }
  function render(screen) {
    const s = currentStation(), [x, y] = screen(s.x, s.y);
    if (x < -160 || y < -160 || x > width + 160 || y > height + 160) return;
    disc(x, y, 90, [.22, .65, .77, .05], 40);
    disc(x, y, 64, [.26, .43, .52, 1], 12); disc(x, y, 47, [.04, .09, .14, 1], 12);
    for (const side of [-1, 1]) {
      const left = x + side * 100 - 25, top = y - 35, col = [.13, .3, .43, 1];
      tri([left, top], [left + 50, top], [left + 50, top + 70], col);
      tri([left, top], [left + 50, top + 70], [left, top + 70], col);
      line([x + side * 45, y], [x + side * 100, y], [.55, .73, .76, 1], 10);
      for (let row = -20; row <= 20; row += 10) line([x + side * 100 - 20, y + row], [x + side * 100 + 20, y + row], [.25, .68, .86, .6], 2);
    }
    disc(x, y, 19, [.58, .9, .88, 1], 6);
  }
  function drawMarker(pen, x, y, title) {
    pen.save(); pen.fillStyle = '#0c1c2c'; pen.strokeStyle = '#95c6ff'; pen.lineWidth = 2;
    pen.fillRect(x - 5, y - 5, 10, 10); pen.strokeRect(x - 5, y - 5, 10, 10);
    if (title) {
      pen.font = '10px monospace'; pen.strokeStyle = '#08121c'; pen.lineWidth = 4;
      pen.strokeText(title, x + 10, y - 10); pen.fillStyle = '#b2d5ff'; pen.fillText(title, x + 10, y - 10);
    }
    pen.restore();
  }
  function drawRadar(pen) {
    const s = currentStation(), dx = (s.x - ship.x) / 16, dy = (s.y - ship.y) / 16;
    const scale = Math.min(1, 66 / (Math.hypot(dx, dy) || 1));
    drawMarker(pen, 78 + dx * scale, 78 + dy * scale);
  }
  $('#stationLabel').textContent = tr('CIVILIAN STARBASE', 'CIVILNÍ VESMÍRNÁ STANICE');
  $('#marketLabel').textContent = tr('MARKET', 'OBCHOD');
  $('#crewLabel').textContent = tr('CREW RECRUITMENT', 'NÁBOR POSÁDKY');
  $('#undock').textContent = tr('UNDOCK · ESC', 'ODLETĚT · ESC');
  $('#stationHint').textContent = tr('Sell minerals to earn credits. Purchases contain one item.', 'Prodejem surovin získáte kredity. Nákupy obsahují jeden kus.');
  $('#dockPrompt').setAttribute('aria-label', tr('Dock at starbase', 'Dokovat u stanice'));
  $('#stationContracts').textContent = tr('CONTRACTS', 'ZAKÁZKY');
  $('#stationContracts').onclick = () => QuestLog.openLog();
  $('#dockPrompt').onclick = openDock; $('#stationRepair').onclick = repair; $('#undock').onclick = closeDock;
  // Capture blocks other game/menu shortcuts while the dock owns keyboard focus.
  addEventListener('keydown', event => {
    if (docked) {
      if (typeof QuestLog !== 'undefined' && QuestLog.isOpen) return;
      if (event.code === 'Tab') {
        const buttons = [...$('#starbaseOverlay').querySelectorAll('button:not(:disabled)')];
        const index = buttons.indexOf(document.activeElement);
        event.preventDefault();
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
      if (event.code === 'Escape' || event.code === 'KeyH') { event.preventDefault(); closeDock(); }
      event.stopImmediatePropagation();
    } else if (event.code === 'KeyH' && !event.repeat && !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) { event.preventDefault(); openDock(); }
  }, true);
  return {characters, refreshDock: renderPanel, addCredits, isDockedAt: id => !!validDock() && docked.id === id, station, currentStation, known, snapshot, restore, repairCost, crewCount, crewCapacity, startingCrewSummary, startingCrewPortraits, canDock, openDock, closeDock, trade, hire, repair, update, render, drawMarker, drawRadar,
    get isOpen() { return !!docked; }, get miningMultiplier() { return crew.includes('miner') ? 1.25 : 1; }, get fuelMultiplier() { return crew.includes('engineer') ? .8 : 1; }};
})();
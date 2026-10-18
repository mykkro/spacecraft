/**
 * Delivery and escort contracts. Mission state shares the expedition save.
 * Escort enemies use the normal weapon hit pipeline; their bullets use swept
 * collisions against asteroids, the player and the protected courier.
 */
const MissionContracts = (() => {
  const tr = (en, cs) => I18n.language === 'cs' ? cs : en;
  const deliveryId = 'haul-ingots', escortId = 'escort-courier';
  const source = {x: -1800, y: -900}, destination = {x: 1800, y: 1100};
  const definitions = [
    {id: deliveryId, title: tr('Metal across the void', 'Kov přes prázdnotu'),
      description: tr('Accept, then haul 100 iron ingots to the civilian starbase in system 1:0. Dock there and claim to hand over the cargo. The origin wormhole bearing is provided on acceptance.', 'Přijměte zakázku a dopravte 100 železných ingotů na civilní stanici v systému 1:0. Dokujte a vyzvedněte odměnu pro předání nákladu. Souřadnice výchozího vormhoulu dostanete při přijetí.'),
      kind: 'delivery', target: 100, material: 'ingot', destination: '1:0', rewards: {}, credits: 180,
      coordinates: ['1:0', '1:1']},
    {id: escortId, title: tr('A courier needs cover', 'Kurýr potřebuje krytí'),
      description: tr('Accept, meet the courier at (-1800, -900) in system 0:0 and escort it to Wayfarer Exchange (1800, 1100). Stay within 900 m and destroy both pirate ambushes. Leaving the system fails the escort.', 'Přijměte zakázku, setkejte se s kurýrem na (-1800, -900) v systému 0:0 a doprovoďte jej na Wayfarer Exchange (1800, 1100). Zůstaňte do 900 m a zničte obě pirátské zálohy. Opuštění systému znamená neúspěch.'),
      kind: 'escort', target: 1, rewards: {plate: 4}, credits: 180}
  ];
  let deliveryAccepted = false, escort = null, clock = 0;
  const finite = (n, min, max, fallback) => Number.isFinite(n) && n >= min && n <= max ? n : fallback;
  function restore(data) {
    if (!data || typeof data !== 'object') return;
    deliveryAccepted = data.deliveryAccepted === true;
    const e = data.escort;
    if (!e || !['active', 'failed', 'complete'].includes(e.status)) return;
    escort = {status: e.status, x: finite(e.x, -6000, 6000, source.x), y: finite(e.y, -6000, 6000, source.y),
      hp: finite(e.hp, 0, 100, 100), waves: Number.isInteger(e.waves) ? Math.max(0, Math.min(2, e.waves)) : 0,
      hostiles: [], shots: []};
    if (Array.isArray(e.hostiles)) escort.hostiles = e.hostiles.slice(0, 4).filter(p => p && p.hp > 0).map((p, i) => ({
      id: 'escort-pirate-' + i, x: finite(p.x, -8000, 8000, source.x), y: finite(p.y, -8000, 8000, source.y),
      hp: finite(p.hp, 0, 8, 8), r: 18, timer: finite(p.timer, 0, 3, 1.5)
    }));
    if (Array.isArray(e.shots)) escort.shots = e.shots.slice(0, 40).filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.vx) && Number.isFinite(p.vy)).map(p => ({
      x: finite(p.x, -8000, 8000, 0), y: finite(p.y, -8000, 8000, 0),
      vx: finite(p.vx, -500, 500, 0), vy: finite(p.vy, -500, 500, 0), life: finite(p.life, 0, 3, 0)
    }));
  }
  function snapshot() { return {deliveryAccepted, escort: escort ? {...escort, hostiles: escort.hostiles.map(p => ({...p})), shots: escort.shots.map(p => ({...p}))} : null}; }
  try { restore(JSON.parse((typeof Profiles === 'undefined' ? localStorage : Profiles).getItem('spacecraft-save-v1') || 'null')?.missions); } catch {}
  function state(id) { return id === deliveryId ? deliveryAccepted ? 'active' : 'available' : escort?.status || 'available'; }
  function accept(id) {
    if (Colony.questProgress().claimed.includes(id)) return false;
    if (id === deliveryId) {
      if (deliveryAccepted) return false;
      deliveryAccepted = true;
      StarChart.revealRoute('0:0', '1:0');
    } else if (id === escortId) {
      if (Colony.onSurface || Math.abs(ship.x) >= 6000 || Math.abs(ship.y) >= 6000) return false;
      if (escort && escort.status !== 'failed') return false;
      escort = {status: 'active', ...source, hp: 100, waves: 0, hostiles: [], shots: []};
    } else return false;
    Colony.save(); QuestLog.refresh(); return true;
  }
  function progress(id) {
    if (id === deliveryId) return deliveryAccepted && Starbases.isDockedAt('1:0') ? Math.min(definitions[0].target, Colony.availableCount('ingot')) : 0;
    return escort?.status === 'complete' ? 1 : 0;
  }
  function hit(shot, enemy) {
    if (escort?.status !== 'active' || !escort.hostiles.includes(enemy) || enemy.hp <= 0) return false;
    enemy.hp -= shot.damage;
    GameAudio.play(enemy.hp <= 0 ? 'explosion' : 'impact', {x: enemy.x, y: enemy.y});
    if (enemy.hp <= 0) {
      if (typeof SpaceEffects !== 'undefined') SpaceEffects.spawn(enemy.x, enemy.y, 45, 'metal');
      escort.hostiles.splice(escort.hostiles.indexOf(enemy), 1);
    }
    // Contract pirates drop no loot, preventing failed-escort restart farming.
    Colony.save();
    return true;
  }
  function fail() {
    escort.status = 'failed'; escort.hostiles = []; escort.shots = [];
    document.querySelector('#missionStatus').hidden = true;
    notify(tr('ESCORT FAILED · RETRY IN QUEST LOG', 'DOPROVOD SELHAL · OPAKOVAT V DENÍKU'));
    Colony.save(); QuestLog.refresh();
  }
  function spawnWave() {
    for (let i = 0; i < 2; i++) escort.hostiles.push({
      id: 'escort-' + escort.waves + '-' + i, x: escort.x + (i ? -460 : 460), y: escort.y - 350,
      hp: 8, r: 18, timer: 2 + i * .7
    });
    escort.waves++;
    notify(tr('COURIER AMBUSH · PROTECT THE TRANSPORT', 'PŘEPADENÍ KURÝRA · CHRAŇTE TRANSPORT'));
    GameAudio.play('alert'); Colony.save();
  }
  function updateBullets(dt) {
    for (let i = escort.shots.length - 1; i >= 0; i--) {
      const p = escort.shots[i], x0 = p.x, y0 = p.y;
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      const intersect = (x, y, r) => Raiders.segmentCircle(x0, y0, p.x, p.y, x, y, r);
      let obstacle = Infinity;
      for (const rock of rocks) {
        const t = intersect(rock.x, rock.y, rock.r * .88);
        if (t !== null) obstacle = Math.min(obstacle, t);
      }
      const playerT = intersect(ship.x, ship.y, typeof Shields !== 'undefined' ? Shields.collisionRadius : 14), courierT = intersect(escort.x, escort.y, 24);
      const targetT = Math.min(playerT ?? Infinity, courierT ?? Infinity);
      if (obstacle <= targetT && obstacle !== Infinity) escort.shots.splice(i, 1);
      else if (targetT !== Infinity) {
        escort.shots.splice(i, 1);
        if (playerT !== null && playerT <= (courierT ?? Infinity)) damageShip(5, tr('ESCORT AMBUSH HIT', 'ZÁSAH PŘI DOPROVODU'), .5);
        else escort.hp = Math.max(0, escort.hp - 5);
      } else if (p.life <= 0) escort.shots.splice(i, 1);
    }
  }
  function update(dt) {
    const hud = document.querySelector('#missionStatus');
    hud.hidden = !escort || escort.status !== 'active' || Colony.onSurface;
    if (!escort || escort.status !== 'active' || Colony.onSurface) return;
    if (Math.abs(ship.x) >= 6000 || Math.abs(ship.y) >= 6000 || escort.hp <= 0) { fail(); return; }
    const separation = Math.hypot(ship.x - escort.x, ship.y - escort.y);
    const dx = destination.x - escort.x, dy = destination.y - escort.y, distance = Math.hypot(dx, dy);
    const travelled = 1 - distance / Math.hypot(destination.x - source.x, destination.y - source.y);
    if (escort.waves < 2 && travelled >= (escort.waves === 0 ? .25 : .6)) spawnWave();
    if (separation <= 900 && distance > 65) {
      const move = Math.min(distance - 65, 85 * dt);
      escort.x += dx / distance * move; escort.y += dy / distance * move;
    }
    for (const enemy of escort.hostiles) {
      const ex = escort.x - enemy.x, ey = escort.y - enemy.y, d = Math.hypot(ex, ey) || 1;
      if (d > 300) { enemy.x += ex / d * 125 * dt; enemy.y += ey / d * 125 * dt; }
      enemy.timer -= dt;
      if (d < 650 && enemy.timer <= 0) {
        escort.shots.push({x: enemy.x, y: enemy.y, vx: ex / d * 310, vy: ey / d * 310, life: 2.8});
        enemy.timer = 1.9; GameAudio.play('pirateFire', {x: enemy.x, y: enemy.y});
      }
    }
    updateBullets(dt);
    if (escort.hp <= 0) { fail(); return; }
    if (distance <= 70 && escort.waves === 2 && !escort.hostiles.length && !escort.shots.length && separation <= 650) {
      escort.status = 'complete'; hud.hidden = true;
      notify(tr('COURIER SAFE · CLAIM YOUR REWARD', 'KURÝR V BEZPEČÍ · VYZVEDNĚTE ODMĚNU'));
      Colony.save(); QuestLog.refresh(); return;
    }
    hud.textContent = tr('ESCORT', 'DOPROVOD') + ' · ' + Math.ceil(escort.hp) + '% · ' + Math.round(separation) + ' m · ' + Math.round(distance) + ' m → Wayfarer · ' +
      (separation > 900 ? tr('WAITING FOR YOU', 'ČEKÁ NA VÁS') : tr('STAY CLOSE / PROTECT', 'DRŽTE SE BLÍZKO / CHRAŇTE'));
    clock += dt;
    if (clock >= 2) { clock = 0; Colony.save(); QuestLog.refresh(); }
  }
  function detail(id) {
    if (id === deliveryId) return tr('Delivery consumes 100 ingots at the destination dock.', 'Předání spotřebuje 100 ingotů v cílovém doku.');
    if (!escort) return tr('Rendezvous: (-1800, -900). Two pirate waves; keep the courier alive.', 'Setkání: (-1800, -900). Dvě vlny pirátů; udržte kurýra naživu.');
    return tr('Courier hull', 'Trup kurýra') + ': ' + Math.ceil(escort.hp) + '% · ' + tr('Waves', 'Vlny') + ': ' + escort.waves + '/2 · ' + tr('Hostiles', 'Nepřátelé') + ': ' + escort.hostiles.length;
  }
  function render(screen) {
    if (escort?.status !== 'active') return;
    const [x, y] = screen(escort.x, escort.y);
    WorldArt.drawShip('courier', x, y, Math.atan2(destination.x - escort.x, -(destination.y - escort.y)), 1, 1, true);
    line([x - 22, y + 32], [x + 22, y + 32], [.15, .25, .25, 1], 4);
    line([x - 22, y + 32], [x - 22 + 44 * escort.hp / 100, y + 32], [.5, 1, .6, 1], 4);
    for (const enemy of escort.hostiles) {
      const [a, b] = screen(enemy.x, enemy.y);
      WorldArt.drawShip('pirate', a, b, Math.atan2(escort.x - enemy.x, -(escort.y - enemy.y)), 1, .85, true);
    }
    for (const bullet of escort.shots) {
      const [a, b] = screen(bullet.x, bullet.y);
      disc(a, b, 3, [1, .4, .2, 1], 5);
    }
  }
  function drawRadar(pen) {
    if (escort?.status !== 'active') return;
    const project = (x, y) => {
      const dx = (x - ship.x) / 16, dy = (y - ship.y) / 16, scale = Math.min(1, 66 / (Math.hypot(dx, dy) || 1));
      return {x: 78 + dx * scale, y: 78 + dy * scale};
    };
    const p = project(escort.x, escort.y);
    pen.fillStyle = '#83e6ad'; pen.fillRect(p.x - 3, p.y - 3, 6, 6);
    for (const enemy of escort.hostiles) {
      const e = project(enemy.x, enemy.y);
      pen.fillStyle = '#f47765'; pen.fillRect(e.x - 2, e.y - 2, 4, 4);
    }
  }
  function drawMap(pen, project) {
    if (escort?.status !== 'active') return;
    const p = project(escort.x, escort.y), d = project(destination.x, destination.y);
    pen.save(); pen.strokeStyle = '#83e6ad'; pen.setLineDash([3, 5]);
    pen.beginPath(); pen.moveTo(p.x, p.y); pen.lineTo(d.x, d.y); pen.stroke(); pen.setLineDash([]);
    pen.fillStyle = '#83e6ad'; pen.fillRect(p.x - 4, p.y - 4, 8, 8);
    pen.font = '10px monospace'; pen.fillText(tr('COURIER', 'KURÝR'), p.x + 9, p.y - 7); pen.restore();
  }
  return {knownDestinations: () => deliveryAccepted ? ['1:0'] : [], definitions, snapshot, state, accept, progress, hit, update, render, drawMap, drawRadar, detail,
    get hostiles() { return escort?.status === 'active' ? escort.hostiles : []; },
    get courier() { return escort ? {x: escort.x, y: escort.y, hp: escort.hp, status: escort.status} : null; }};
})();

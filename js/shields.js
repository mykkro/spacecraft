/**
 * One installed generator, with charge shared across equipment changes.
 * Equipping never refills charge. Saved generators stay references to real cargo.
 */
const Shields = (() => {
  const definitions = {
    shield_generator: {capacity: 35, regen: 1.5, delay: 5},
    shield_generator_advanced: {capacity: 65, regen: 3, delay: 4},
    shield_generator_ion: {capacity: 100, regen: 5, delay: 3}
  };
  let equipped = null, charge = 0, quiet = 0, flash = 0, saveClock = 0;
  try {
    const saved = JSON.parse((typeof Profiles === 'undefined' ? localStorage : Profiles).getItem('spacecraft-save-v1') || 'null')?.shield;
    if (saved && Object.hasOwn(definitions, saved.equipped)) {
      equipped = saved.equipped;
      charge = Number.isFinite(saved.charge) ? Math.max(0, Math.min(definitions[equipped].capacity, saved.charge)) : 0;
      quiet = Number.isFinite(saved.quiet) ? Math.max(0, Math.min(10, saved.quiet)) : 0;
    }
  } catch {}
  function snapshot() { return {equipped, charge, quiet}; }
  function reconcile() {
    if (equipped && Colony.count(equipped) < 1) { equipped = null; charge = quiet = 0; }
  }
  function equip(id) {
    if (!Object.hasOwn(definitions, id) || Colony.count(id) < 1) return false;
    if (equipped !== id) {
      equipped = id;
      charge = Math.min(charge, definitions[id].capacity);
      quiet = 0;
    }
    refresh(); Colony.save(); return true;
  }
  function unequip() {
    equipped = null; charge = quiet = 0;
    refresh(); Colony.save();
  }
  // damageShip commits charge and hull together after applying the remainder.
  function absorb(amount) {
    reconcile();
    if (!equipped || !Number.isFinite(amount) || amount <= 0) return amount;
    quiet = 0; flash = .6;
    const absorbed = Math.min(charge, amount);
    charge -= absorbed;
    refresh();
    return amount - absorbed;
  }
  function update(dt) {
    reconcile();
    if (!Number.isFinite(dt) || dt <= 0) return;
    flash = Math.max(0, flash - dt);
    if (equipped) {
      const def = definitions[equipped], previous = charge;
      // Only the fraction of this step after the delay contributes to recharge.
      const rechargeTime = Math.max(0, quiet + dt - Math.max(quiet, def.delay));
      quiet = Math.min(10, quiet + dt);
      charge = Math.min(def.capacity, charge + rechargeTime * def.regen);
      if (charge !== previous) {
        saveClock += dt;
        if (saveClock >= 2) { saveClock = 0; Colony.save(); }
      }
    }
    refresh();
  }
  function refresh() {
    const gauge = document.querySelector('#shieldGauge');
    if (!gauge) return;
    gauge.hidden = !equipped;
    if (!equipped) return;
    const def = definitions[equipped];
    document.querySelector('#shieldText').textContent = Math.ceil(charge) + ' / ' + def.capacity;
    document.querySelector('#shieldBar').style.width = charge / def.capacity * 100 + '%';
    gauge.setAttribute('aria-valuenow', String(Math.round(charge)));
    gauge.setAttribute('aria-valuemax', String(def.capacity));
    document.querySelector('#shieldStatus').textContent = I18n.language === 'cs' ?
      (quiet < def.delay ? 'DOBÍJENÍ PO ZÁSAHU POZASTAVENO' : charge >= def.capacity ? 'ŠTÍT PLNÝ' : 'OBNOVA ŠTÍTU') :
      (quiet < def.delay ? 'RECHARGE DELAY' : charge >= def.capacity ? 'SHIELD FULL' : 'REGENERATING');
  }
  function render(x, y, angle) {
    if (!equipped || (charge <= 0 && flash <= 0)) return;
    const fraction = charge / definitions[equipped].capacity;
    const color = [.35, .68, 1, Math.min(.8, .10 + fraction * .12 + flash * .7)];
    const c = Math.cos(angle), s = Math.sin(angle);
    const point = a => {
      const px = Math.cos(a) * 39, py = Math.sin(a) * 45;
      return [x + px * c - py * s, y + px * s + py * c];
    };
    for (let i = 0; i < 48; i++)
      line(point(i / 48 * Math.PI * 2), point((i + 1) / 48 * Math.PI * 2), color, flash > 0 ? 2.3 : 1.1);
  }
  return {definitions, snapshot, reconcile, equip, unequip, absorb, update, refresh, render,
    get equipped() { return equipped; }, get charge() { return charge; },
    get collisionRadius() { return equipped && charge > 0 ? 40 : 14; },
    get capacity() { return equipped ? definitions[equipped].capacity : 0; }};
})();

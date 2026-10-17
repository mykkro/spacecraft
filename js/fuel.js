/**
 * Fuel tank and retained reactor-cell charge, persisted with the expedition.
 * Overflow energy belongs to the inserted cell and feeds the tank automatically.
 */

// Fuel is saved with the expedition. An inserted cube retains unused reactor charge.
const Fuel = (() => {
  let amount = Shipyard.current.fuelCapacity,
    reserve = 0,
    lowWarning = false,
    emptyWarning = false,
    availableStock = 0;
  try {
    const saved = (JSON.parse((typeof Profiles === 'undefined' ? localStorage : Profiles).getItem('spacecraft-save-v1')||'null')?.fuel);
    if (saved && Number.isFinite(saved.amount)) {
      const total = Math.max(0, saved.amount) + (Number.isFinite(saved.reserve) ? Math.max(0, saved.reserve) : 0);
      amount = Math.min(Shipyard.current.fuelCapacity, total);
      reserve = Math.min(100000, Math.max(0, total - amount));
    }
  } catch {
  }
  function snapshot() {
    return {
      amount,
      reserve
    };
  }

  // Changing tank capacity conserves total energy. Only first-time selection gets a full tank.
  function reconfigure(first = false) {
    const total = first ? Shipyard.current.fuelCapacity : amount + reserve;
    amount = Math.min(Shipyard.current.fuelCapacity, total);
    reserve = Math.max(0, total - amount);
    lowWarning = false;
    emptyWarning = false;
    refresh();
  }

  // Do not replace a cell while it still contains usable energy.
  function canRefuel() {
    return reserve < .000001 && amount < Shipyard.current.fuelCapacity - .000001;
  }

  // Consume a whole cell while retaining energy that exceeds the current tank capacity.
  function insert(energy) {
    if (!Number.isFinite(energy) || energy <= 0 || !canRefuel())
      return false;
    const total = amount + energy;
    amount = Math.min(Shipyard.current.fuelCapacity, total);
    reserve = Math.max(0, total - amount);
    lowWarning = false;
    emptyWarning = false;
    refresh();
    return true;
  }

  // Called by active flight only. Forward/reverse thrust consume fuel; boost costs triple.
  // An empty reactor retains 12% solar thrust, with boost disabled.
  function drive(thrust, boost, dt) {
    const available = amount + reserve,
      requested = Number.isFinite(dt) && dt > 0 ? Math.min(1, Math.abs(thrust)) * dt * Shipyard.current.fuelBurn * (boost ? 3 : 1) * (typeof Starbases !== 'undefined' ? Starbases.fuelMultiplier : 1) * (typeof Colony !== 'undefined' ? Colony.machineBonuses.fuelMultiplier : 1) : 0;
    const used = Math.min(available, requested),
      fraction = requested > 0 ? used / requested : available > 0 ? 1 : 0;
    if (requested > 0) {
      const total = Math.max(0, available - used);
      amount = Math.min(Shipyard.current.fuelCapacity, total);
      reserve = Math.max(0, total - amount);
      if (!emptyWarning && total <= .000001) {
        emptyWarning = true;
        if (typeof notify === 'function')
          notify(I18n.t('FUEL EMPTY · SOLAR THRUST ONLY'));
      } else if (!lowWarning && total > 0 && amount <= Shipyard.current.fuelCapacity * .15) {
        lowWarning = true;
        if (typeof notify === 'function')
          notify(I18n.t('LOW FUEL · REFUEL WITH ION CUBES'));
      }
    }
    refresh();
    return {
      fraction,
      solar: fraction === 0,
      boost: !!boost && fraction > 0,
      thrustScale: .12 + .88 * fraction
    };
  }

  // Stock is supplied by Colony to avoid accessing its API during module initialization.
  function refresh(stock) {
    if (Number.isFinite(stock))
      availableStock = stock;
    const $ = s => document.querySelector(s),
      capacity = Shipyard.current.fuelCapacity,
      total = amount + reserve;
    const label = $('#fuelText');
    if (!label)
      return;
    const text = Math.ceil(amount) + ' / ' + capacity;
    if (label.textContent !== text)
      label.textContent = text;
    $('#fuelBar').style.width = amount / capacity * 100 + '%';
    $('#fuelGauge').classList.toggle('low-fuel', amount <= capacity * .15);
    $('#fuelGauge').classList.toggle('solar-only', total <= .000001);
    const status = total <= .000001 ? I18n.t('SOLAR ONLY · 12% THRUST') : reserve > 0 ? I18n.t('CELL CHARGE') + ': ' + Math.ceil(reserve) : I18n.t('REACTOR ONLINE');
    if ($('#fuelStatus').textContent !== status)
      $('#fuelStatus').textContent = status;
    $('#fuelGauge').setAttribute('aria-valuenow', String(Math.round(amount)));
    $('#fuelGauge').setAttribute('aria-valuemax', String(capacity));
    $('#fuelGauge').setAttribute('aria-valuetext', text + ' · ' + status);
    const refuel = $('#refuel');
    refuel.disabled = !canRefuel() || availableStock <= 0;
  }
  document.querySelector('#refuel').onclick = () => Colony.refuelBest();
  addEventListener('keydown', event => {
    if (event.repeat || event.code !== 'KeyT' || paused || ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName))
      return;
    event.preventDefault();
    Colony.refuelBest();
  });
  return {
    snapshot,
    reconfigure,
    canRefuel,
    insert,
    drive,
    refresh,
    get amount() {
      return amount;
    },
    get reserve() {
      return reserve;
    },
    get capacity() {
      return Shipyard.current.fuelCapacity;
    }
  };
})();

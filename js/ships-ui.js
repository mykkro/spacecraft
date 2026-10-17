/**
 * Ship picker UI. The first expedition waits for confirmation; saved presets resume.
 * Changing ships preserves total fuel, cargo, hull condition, and expedition position.
 */

// The first expedition is paused until its ship is confirmed. Existing presets resume.
(() => {
  const $ = s => document.querySelector(s);
  let open = false,
    previousPaused = false,
    returnFocus = null,
    chosen = Shipyard.current.id;
  const overlay = document.createElement('div');
  overlay.id = 'shipyardOverlay';
  overlay.hidden = true;
  overlay.innerHTML = I18n.html('<section role="dialog" aria-modal="true" aria-labelledby="shipyardTitle"><div class="shipyard-heading"><div><div class="eyebrow">EXPEDITION / SHIP SELECTION</div><h2 id="shipyardTitle">Choose your ship</h2></div><label>Jazyk / Language <select id="shipyardLanguage" aria-label="Jazyk / Language"><option value="en">EN</option><option value="cs">CZ</option></select></label></div><p>Choose a flight style. Your cargo and expedition are preserved when changing ships; excess cargo stays in reserve.</p><div id="shipChoices"></div><div class="shipyard-actions"><button id="cancelShip">CANCEL</button><button id="confirmShip">BEGIN EXPEDITION</button></div></section>');
  document.body.append(overlay);
  const headerButton = document.createElement('button');
  headerButton.id = 'shipyardButton';
  headerButton.textContent = I18n.t('SHIPS');
  $('.header-actions').prepend(headerButton);
  function render() {
    $('#shipyardLanguage').value = I18n.language;
    $('#cancelShip').hidden = !Shipyard.confirmed;
    $('#confirmShip').textContent = I18n.t(Shipyard.confirmed ? 'CONFIRM SHIP' : 'BEGIN EXPEDITION');
    $('#shipChoices').innerHTML = Object.values(Shipyard.presets).map(p => I18n.html(`<button class="ship-choice ${ chosen === p.id ? 'selected' : '' }" data-preset="${ p.id }" aria-pressed="${ chosen === p.id }">${ Shipyard.preview(p.id) }<span class="eyebrow">${ I18n.t(p.role) }</span><h3>${ p.name }</h3><p>${ I18n.t(p.description) }</p>${Starbases.startingCrewPortraits(p.id)}<p>${Starbases.startingCrewSummary(p.id)}</p><dl><div><dt>CARGO SLOTS</dt><dd>${ p.slots }</dd></div><div><dt>TOP SPEED</dt><dd>${ p.speed } m/s</dd></div><div><dt>FUEL TANK</dt><dd>${ p.fuelCapacity }</dd></div><div><dt>AGILITY</dt><dd>${ p.turn.toFixed(2) } rad/s</dd></div><div><dt>STARTING WEAPON</dt><dd>${ Weapons.definitions[p.primary].name }</dd></div></dl></button>`)).join('');
    $('#shipChoices').querySelectorAll('[data-preset]').forEach(button => button.onclick = () => {
      chosen = button.dataset.preset;
      render();
      $('#shipChoices [data-preset="' + chosen + '"]').focus();
    });
  }
  function updateIdentity() {
    const p = Shipyard.current;
    $('.telemetry h1').firstChild.nodeValue = p.name;
    $('.telemetry h1 span').textContent = I18n.t(p.role);
    $('#overlay .eyebrow').textContent = p.name.toUpperCase() + ' / ' + I18n.t('SYSTEMS');
    $('#mapOverlay .map-heading .eyebrow').textContent = p.name.toUpperCase() + ' / ' + I18n.t('NAVIGATION');
    $('#questOverlay .eyebrow').textContent = p.name.toUpperCase() + ' / ' + I18n.t('EXPEDITION CONTRACTS');
  }

  // Pause and remember the previous dialog before opening the ship picker.
  function show() {
    if (open)
      return;
    if (typeof QuestLog !== 'undefined' && QuestLog.isOpen)
      QuestLog.closeLog();
    if (StarChart.mapOpen)
      StarChart.closeMap();
    previousPaused = paused;
    returnFocus = document.activeElement;
    paused = true;
    keys.clear();
    GameAudio.setEngine(0);
    chosen = Shipyard.current.id;
    open = true;
    overlay.hidden = false;
    render();
    $('#shipChoices [data-preset="' + chosen + '"]').focus();
  }

  // A first-time picker cannot be dismissed until a valid preset is confirmed.
  function close() {
    if (!Shipyard.confirmed)
      return;
    open = false;
    overlay.hidden = true;
    paused = previousPaused;
    keys.clear();
    if (returnFocus?.isConnected)
      returnFocus.focus();
  }
  $('#confirmShip').onclick = () => {
    const changed = chosen !== Shipyard.current.id,
      first = !Shipyard.confirmed;
    Shipyard.choose(chosen);
    Fuel.reconfigure(first);
    Colony.resizeCargo();
    Weapons.applyShipLoadout(changed || first);
    updateIdentity();
    Colony.save();
    close();
    if (!$('#overlay').hidden)
      Colony.openInventory();
    notify(Shipyard.current.name.toUpperCase() + ' · ' + I18n.t('FLIGHT SYSTEMS ONLINE'));
  };
  $('#cancelShip').onclick = close;
  headerButton.onclick = show;
  $('#shipyardLanguage').onchange = e => I18n.setLanguage(e.target.value);
  addEventListener('keydown', e => {
    if (!open)
      return;
    e.stopImmediatePropagation();
    if (e.code === 'Escape') {
      e.preventDefault();
      close();
    }
    if (e.code === 'Tab') {
      const controls = [...overlay.querySelectorAll('button:not([hidden]),select')],
        first = controls[0],
        last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, { capture: true });
  updateIdentity();
  Weapons.applyShipLoadout(false);
  if (!Shipyard.confirmed)
    show();
})();

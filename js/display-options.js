/** Local display preferences; changing UI size never changes world coordinates. */
const DisplayOptions = (() => {
  const $ = selector => document.querySelector(selector);
  const tr = (en, cs) => I18n.language === 'cs' ? cs : en;
  const defaults = {textScale: 125, hints: true, contrast: false, asteroidQuality: 'balanced'};
  let preferences = {...defaults}, open = false, previousPaused = false, returnFocus = null;
  try {
    const saved = JSON.parse(localStorage.getItem('spacecraft-display-v1') || 'null');
    if (saved) {
      if (Number.isFinite(saved.textScale)) preferences.textScale = Math.max(100, Math.min(160, saved.textScale));
      if (typeof saved.hints === 'boolean') preferences.hints = saved.hints;
      if (typeof saved.contrast === 'boolean') preferences.contrast = saved.contrast;
      if (['low','balanced','high'].includes(saved.asteroidQuality)) preferences.asteroidQuality = saved.asteroidQuality;
    }
  } catch {}
  const overlay = document.createElement('div');
  overlay.id = 'displayOptions'; overlay.hidden = true;
  overlay.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="optionsTitle"><h2 id="optionsTitle">${tr('Display options', 'Nastavení zobrazení')}</h2><p>${tr('Larger, readable HUD text. Preferences are saved in this browser.', 'Větší a čitelnější text HUDu. Nastavení se ukládá v tomto prohlížeči.')}</p><label for="hudTextScale">${tr('HUD text size', 'Velikost textu HUDu')} <output id="hudScaleValue"></output></label><input id="hudTextScale" type="range" min="100" max="160" step="5"><label><input id="hudHints" type="checkbox"> ${tr('Show flight control hints', 'Zobrazit nápovědu ovládání letu')}</label><label><input id="hudContrast" type="checkbox"> ${tr('High contrast HUD panels', 'Vysoce kontrastní panely HUDu')}</label><label for="asteroidQuality">${tr('3D asteroid detail', 'Detail 3D asteroidů')}</label><select id="asteroidQuality"><option value="low">${tr('Low', 'Nízký')}</option><option value="balanced">${tr('Balanced', 'Vyvážený')}</option><option value="high">${tr('High', 'Vysoký')}</option></select><div class="options-actions"><button id="resetDisplay">${tr('RESET', 'OBNOVIT')}</button><button id="closeDisplay">${tr('DONE', 'HOTOVO')} · ESC</button></div></section>`;
  document.body.append(overlay);
  const button = document.createElement('button');
  button.id = 'optionsButton'; button.textContent = tr('OPTIONS', 'NASTAVENÍ');
  $('.header-actions').append(button);
  function apply(save = true) {
    document.documentElement.style.setProperty('--hud-scale', String(preferences.textScale / 100));
    document.body.classList.toggle('hide-flight-hints', !preferences.hints);
    document.body.classList.toggle('high-contrast-hud', preferences.contrast);
    $('#hudTextScale').value = preferences.textScale;
    $('#hudScaleValue').textContent = preferences.textScale + '%';
    $('#hudHints').checked = preferences.hints;
    $('#hudContrast').checked = preferences.contrast;
    $('#asteroidQuality').value = preferences.asteroidQuality;
    if (save) try { localStorage.setItem('spacecraft-display-v1', JSON.stringify(preferences)); } catch {}
  }
  function set(next) {
    if (Number.isFinite(next.textScale)) preferences.textScale = Math.max(100, Math.min(160, next.textScale));
    if (typeof next.hints === 'boolean') preferences.hints = next.hints;
    if (typeof next.contrast === 'boolean') preferences.contrast = next.contrast;
    if (['low','balanced','high'].includes(next.asteroidQuality)) preferences.asteroidQuality = next.asteroidQuality;
    apply();
  }
  function show() {
    if (open) return;
    previousPaused = paused; returnFocus = document.activeElement;
    paused = true; keys.clear(); GameAudio.setEngine(0);
    open = true; overlay.hidden = false; $('#hudTextScale').focus();
  }
  function close() {
    if (!open) return;
    open = false; overlay.hidden = true; paused = previousPaused;
    keys.clear(); returnFocus?.focus();
  }
  $('#hudTextScale').oninput = event => set({textScale: Number(event.target.value)});
  $('#hudHints').onchange = event => set({hints: event.target.checked});
  $('#hudContrast').onchange = event => set({contrast: event.target.checked});
  $('#asteroidQuality').onchange = event => set({asteroidQuality: event.target.value});
  $('#resetDisplay').onclick = () => set(defaults);
  $('#closeDisplay').onclick = close;
  $('#inventoryOptions').textContent = tr('DISPLAY OPTIONS', 'NASTAVENÍ ZOBRAZENÍ');
  $('#inventoryOptions').onclick = show;
  button.onclick = show;
  addEventListener('keydown', event => {
    if (!open) return;
    event.stopImmediatePropagation();
    if (event.code === 'Escape') { event.preventDefault(); close(); }
    if (event.code === 'Tab') {
      const controls = [...overlay.querySelectorAll('button,input,select')], index = controls.indexOf(document.activeElement);
      event.preventDefault(); controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
    }
  }, true);
  apply(false);
  return {set, show, close, get isOpen() { return open; }, get asteroidQuality() { return preferences.asteroidQuality; }, get preferences() { return {...preferences}; }};
})();

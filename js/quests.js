/**
 * Fixed expedition contracts. Mining counters are cumulative; base objectives use current terrain.
 * Colony commits rewards and claimed state together so inventory capacity failures are safe.
 */

// Small fixed contracts: resource collection is cumulative; bases must exist.
const QuestLog = (() => {
  const $ = s => document.querySelector(s);
  const definitions = [
    {
      id: 'mine-crystal',
      title: I18n.t('Crystal prospecting'),
      description: I18n.t('Mine and collect 12 crystal. Asteroids and moon deposits both count.'),
      kind: 'mined',
      material: 'crystal',
      target: 12,
      rewards: {
        ingot: 8,
        plate: 4
      }
    },
    {
      id: 'mine-iron',
      title: I18n.t('Heavy metal'),
      description: I18n.t('Mine and collect 24 iron ore.'),
      kind: 'mined',
      material: 'metal',
      target: 24,
      rewards: {
        block: 16,
        glass: 8
      }
    },
    {
      id: 'mine-ice',
      title: I18n.t('Cold storage'),
      description: I18n.t('Mine and collect 16 ice.'),
      kind: 'mined',
      material: 'ice',
      target: 16,
      rewards: {
        crystal: 4,
        ingot: 4
      }
    },
    {
      id: 'first-base',
      title: I18n.t('A place to call home'),
      description: I18n.t('Build your first base. A moon counts as a base when it has at least one placed workbench.'),
      kind: 'bases',
      target: 1,
      rewards: {
        lamp: 1,
        plate: 4
      }
    },
    {
      id: 'three-bases',
      title: I18n.t('An interstellar foothold'),
      description: I18n.t('Maintain 3 bases on different moons. Each needs at least one placed workbench.'),
      kind: 'bases',
      target: 3,
      rewards: {
        scanner: 1,
        seismic: 1
      }
    }
  ];
  let open = false,
    previousPaused = false,
    returnFocus = null;
  const button = document.createElement('button');
  button.id = 'questButton';
  button.innerHTML = I18n.html('QUEST LOG <kbd>J</kbd><span id="questReady" hidden></span>');
  $('.manifest').append(button);
  const surfaceButton = document.createElement('button');
  surfaceButton.id = 'surfaceQuestButton';
  surfaceButton.textContent = I18n.t('QUEST LOG [J]');
  $('#surfaceHud').append(surfaceButton);
  const overlay = document.createElement('div');
  overlay.id = 'questOverlay';
  overlay.hidden = true;
  overlay.innerHTML = I18n.html('<section role="dialog" aria-modal="true" aria-labelledby="questTitle"><div class="quest-heading"><div><div class="eyebrow">NOMAD / EXPEDITION CONTRACTS</div><h2 id="questTitle">Quest log</h2></div><button id="closeQuests" aria-label="Close quest log">×</button></div><p class="quest-intro">Objectives track automatically. Claim completed contracts for supplies and equipment.</p><div id="questSummary"></div><div id="questCards"></div><p id="questMessage" role="status" aria-live="polite"></p><small class="quest-footnote">Mining progress stays when materials are spent. Rewards are one-time and do not consume your mined cargo. J / ESC closes this log.</small></section>');
  document.body.append(overlay);
  function getDefinition(id) {
    return definitions.find(q => q.id === id);
  }

  // Built bases must still exist; mining progress stays even after materials are spent.
  function progress(id) {
    const quest = getDefinition(id);
    if (!quest)
      return 0;
    return quest.kind === 'bases' ? Colony.getBases().filter(b => b.isBase).length : Colony.questProgress().mined[quest.material] || 0;
  }
  function canClaim(id) {
    const q = getDefinition(id);
    return !!q && !Colony.questProgress().claimed.includes(id) && progress(id) >= q.target;
  }
  function rewardMarkup(q) {
    return Object.entries(q.rewards).map(([type, qty]) => `<span class="quest-reward"><img src="assets/items/${ Colony.items[type].asset || (Colony.items[type].image || type) + '.png' }" width="30" height="30" alt=""><span>${ qty } ${ Colony.items[type].name }</span></span>`).join('');
  }

  // Update the ready badge even when the log is closed; build cards only while visible.
  function refresh() {
    const claimed = Colony.questProgress().claimed,
      ready = definitions.filter(q => canClaim(q.id)).length;
    $('#questReady').hidden = !ready;
    $('#questReady').textContent = String(ready);
    button.setAttribute('aria-label', I18n.t(`Quest log${ ready ? I18n.t(`, ${ ready } rewards ready`) : '' }`));
    if (!open)
      return;
    $('#questSummary').textContent = I18n.t(`${ ready } READY TO CLAIM · ${ definitions.filter(q => claimed.includes(q.id)).length } / ${ definitions.length } CLAIMED`);
    $('#questCards').innerHTML = definitions.map(q => {
      const done = claimed.includes(q.id),
        value = Math.min(progress(q.id), q.target),
        ready = !done && value >= q.target;
      return I18n.html(`<article class="quest-card ${ done ? 'claimed' : ready ? 'ready' : '' }"><div class="quest-state">${ done ? I18n.t('REWARD CLAIMED') : ready ? I18n.t('COMPLETE · REWARD READY') : I18n.t('IN PROGRESS') }</div><h3>${ q.title }</h3><p>${ q.description }</p><div class="quest-progress-label"><span>${ q.kind === 'bases' ? I18n.t('BASES ESTABLISHED') : q.material === 'metal' ? I18n.t('IRON ORE MINED') : q.material.toUpperCase() + ' MINED' }</span><b>${ done ? q.target : value } / ${ q.target }</b></div><progress value="${ done ? q.target : value }" max="${ q.target }" aria-label="${ q.title } progress">${ value } / ${ q.target }</progress><div class="quest-rewards">${ rewardMarkup(q) }</div><button data-claim="${ q.id }" ${ ready ? '' : 'disabled' }>${ done ? I18n.t('CLAIMED') : ready ? I18n.t('CLAIM REWARD') : I18n.t('KEEP EXPLORING') }</button></article>`);
    }).join('');
    $('#questCards').querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
      const result = Colony.claimQuest(b.dataset.claim);
      $('#questMessage').textContent = result.message;
      $('#questMessage').classList.toggle('quest-error', !result.ok);
    });
  }

  // Pause without discarding an existing inventory or map dialog.
  function openLog() {
    if (open) {
      closeLog();
      return;
    }
    previousPaused = paused;
    returnFocus = document.activeElement;
    paused = true;
    keys.clear();
    open = true;
    overlay.hidden = false;
    $('#audioSettings').open = false;
    GameAudio.setEngine(0);
    $('#questMessage').textContent = '';
    refresh();
    $('#closeQuests').focus();
  }

  // Restore the previous pause state and keyboard focus instead of always resuming flight.
  function closeLog() {
    if (!open)
      return;
    open = false;
    overlay.hidden = true;
    paused = previousPaused;
    keys.clear();
    const inventoryOpen = !$('#overlay').hidden,
      mapOpen = typeof StarChart !== 'undefined' && StarChart.mapOpen;
    if (inventoryOpen)
      Colony.openInventory();
    if (mapOpen) {
      StarChart.discover();
      StarChart.refresh();
    }
    if (returnFocus?.isConnected)
      returnFocus.focus();
    else if (mapOpen)
      $('#closeMap').focus();
    else if (inventoryOpen)
      $('#resume').focus();
  }
  button.onclick = openLog;
  surfaceButton.onclick = openLog;
  $('#closeQuests').onclick = closeLog;
  addEventListener('keydown', e => {
    if (e.repeat || ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))
      return;
    if (e.code === 'KeyJ') {
      e.preventDefault();
      openLog();
      return;
    }
    if (!open)
      return;
    if (e.code === 'Escape') {
      e.preventDefault();
      closeLog();
    }
    if (e.code === 'Tab') {
      const controls = [...overlay.querySelectorAll('button:not(:disabled)')],
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
  });
  refresh();
  return {
    get isOpen() {
      return open;
    },
    getDefinition,
    progress,
    canClaim,
    refresh,
    openLog,
    closeLog
  };
})();

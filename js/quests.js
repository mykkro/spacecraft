/**
 * Fixed expedition contracts. Mining counters are cumulative; base objectives use current terrain.
 * Colony commits rewards and claimed state together so inventory capacity failures are safe.
 */

// Mining is cumulative, bases must exist, and missions have explicit acceptance.
// Colony performs delivery handover and payouts together after canClaim succeeds.
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
      coordinates: ['0:0', '1:0'],
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
  if (typeof MissionContracts !== 'undefined') definitions.push(...MissionContracts.definitions);
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
  overlay.querySelector('.quest-footnote').textContent = I18n.language === 'cs' ? 'Těžební zakázky náklad nespotřebují. Doručení předá požadované suroviny v cílovém doku. Odměny jsou jednorázové. J / ESC zavře deník.' : 'Mining contracts keep your cargo. Deliveries hand over the required materials at the destination dock. Rewards are one-time. J / ESC closes the log.';
  function getDefinition(id) {
    return definitions.find(q => q.id === id);
  }

  // Built bases must still exist; mining progress stays even after materials are spent.
  function progress(id) {
    const quest = getDefinition(id);
    if (!quest)
      return 0;
    if (quest.kind === 'delivery' || quest.kind === 'escort') return MissionContracts.progress(id);
    return quest.kind === 'bases' ? Colony.getBases().filter(b => b.isBase).length : Colony.questProgress().mined[quest.material] || 0;
  }
  function canClaim(id) {
    const q = getDefinition(id);
    return !!q && !Colony.questProgress().claimed.includes(id) && progress(id) >= q.target;
  }
  function rewardMarkup(q) {
    const tr = (en, cs) => I18n.language === 'cs' ? cs : en;
    const extra = (q.credits ? `<span class="quest-reward">${q.credits} ${tr('credits', 'kreditů')}</span>` : '') +
      (q.coordinates ? `<span class="quest-reward">◇ ${tr('Wormhole coordinates', 'Souřadnice vormhoulu')}: ${q.coordinates.join(' → ')}</span>` : '');
    return extra + Object.entries(q.rewards).map(([type, qty]) => `<span class="quest-reward"><img src="assets/items/${ Colony.items[type].asset || (Colony.items[type].image || type) + '.png' }" width="30" height="30" alt=""><span>${ qty } ${ Colony.items[type].name }</span></span>`).join('');
  }

  function applyReward(q) {
    if (q.credits) Starbases.addCredits(q.credits);
    if (q.coordinates) StarChart.revealRoute(...q.coordinates);
    if (typeof Starbases !== 'undefined') Starbases.refreshDock();
  }
  function missionMarkup(q, done) {
    if (done || !['delivery', 'escort'].includes(q.kind)) return '';
    const status = MissionContracts.state(q.id), tr = (en, cs) => I18n.language === 'cs' ? cs : en;
    const action = status === 'available' || status === 'failed';
    return `<p>${status === 'failed' ? tr('ESCORT FAILED. ', 'DOPROVOD SELHAL. ') : ''}${MissionContracts.detail(q.id)}</p>` +
      (action ? `<button data-accept="${q.id}">${status === 'failed' ? tr('RETRY ESCORT', 'OPAKOVAT DOPROVOD') : tr('ACCEPT CONTRACT', 'PŘIJMOUT ZAKÁZKU')}</button>` : '');
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
      return I18n.html(`<article class="quest-card ${ done ? 'claimed' : ready ? 'ready' : '' }"><div class="quest-state">${ done ? I18n.t('REWARD CLAIMED') : ready ? I18n.t('COMPLETE · REWARD READY') : I18n.t('IN PROGRESS') }</div><h3>${ q.title }</h3><p>${ q.description }</p><div class="quest-progress-label"><span>${ q.kind === 'escort' ? (I18n.language === 'cs' ? 'KURÝR V BEZPEČÍ' : 'COURIER SAFE') : q.kind === 'delivery' ? (I18n.language === 'cs' ? 'INGOTY V CÍLOVÉM DOKU' : 'INGOTS AT DESTINATION DOCK') : q.kind === 'bases' ? I18n.t('BASES ESTABLISHED') : q.material === 'metal' ? I18n.t('IRON ORE MINED') : q.material.toUpperCase() + ' MINED' }</span><b>${ done ? q.target : value } / ${ q.target }</b></div><progress value="${ done ? q.target : value }" max="${ q.target }" aria-label="${ q.title } progress">${ value } / ${ q.target }</progress><div class="quest-rewards">${ rewardMarkup(q) }</div>${missionMarkup(q, done)}${!done && typeof QuestTracker !== 'undefined' ? `<button data-track-quest="${q.id}" aria-pressed="${QuestTracker.selected===q.id}">${QuestTracker.selected===q.id ? (I18n.language==='cs'?'ZRUŠIT SLEDOVÁNÍ':'STOP TRACKING') : (I18n.language==='cs'?'SLEDOVAT':'TRACK QUEST')}</button>` : ''}<button data-claim="${ q.id }" ${ ready ? '' : 'disabled' }>${ done ? I18n.t('CLAIMED') : ready ? I18n.t('CLAIM REWARD') : I18n.t('KEEP EXPLORING') }</button><p class="quest-claim-message" data-claim-message="${q.id}" role="status" aria-live="polite" hidden></p></article>`);
    }).join('');
    $('#questCards').querySelectorAll('[data-track-quest]').forEach(b=>b.onclick=()=>QuestTracker.track(QuestTracker.selected===b.dataset.trackQuest?null:b.dataset.trackQuest));
    $('#questCards').querySelectorAll('[data-accept]').forEach(b => b.onclick = () => {
      if (!MissionContracts.accept(b.dataset.accept)) $('#questMessage').textContent = I18n.language === 'cs' ? 'Doprovod přijměte v kosmu systému 0:0.' : 'Accept the escort in space in system 0:0.';
    });
    $('#questCards').querySelectorAll('[data-claim]').forEach(b => b.onclick = () => {
      const result = Colony.claimQuest(b.dataset.claim);
      $('#questMessage').textContent = result.message;
      $('#questMessage').classList.toggle('quest-error', !result.ok);
      // Successful claims rebuild the cards, so find the current status element.
      const message = $(`[data-claim-message="${b.dataset.claim}"]`);
      message.textContent = result.message;
      message.hidden = false;
      message.classList.toggle('quest-error', !result.ok);
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
  // Old claimed mining contracts gain their new coordinate reward once on upgrade.
  // Revealing a route is idempotent; never replay credit/item payouts here.
  if (typeof StarChart !== 'undefined') {
    for (const q of definitions)
      if (q.coordinates && Colony.questProgress().claimed.includes(q.id)) StarChart.revealRoute(...q.coordinates);
  }
  refresh();
  return {
    get isOpen() {
      return open;
    },
    getDefinition,
    applyReward,
    progress,
    canClaim,
    refresh,
    openLog,
    closeLog
  };
})();

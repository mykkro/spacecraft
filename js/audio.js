/**
 * Local Web Audio synthesis: no external sound files or background audio before user input.
 * Voice limits and effect cooldowns keep dense combat from accumulating audio nodes.
 */

// Small, asset-free sound bank. No context or sound is started before a user gesture.
const GameAudio = (() => {
  const $ = s => document.querySelector(s),
    voices = new Set(),
    lastPlayed = new Map();
  let context = null,
    master = null,
    noiseBuffer = null,
    engine = null,
    unavailable = false;
  let settings = {
    muted: false,
    volume: .35
  };
  const maxVoices = 24;
  try {
    const stored = JSON.parse(localStorage.getItem('spacecraft-audio-v1') || 'null');
    if (stored) {
      settings.muted = stored.muted === true;
      if (Number.isFinite(stored.volume))
        settings.volume = Math.max(0, Math.min(1, stored.volume));
    }
  } catch {
  }
  const limits = {
    refuel: .25,
    bulshitter: .07,
    fotron: .2,
    photon: .15,
    mininglaser: .2,
    pulse: .055,
    laser: .1,
    rockbreaker: .12,
    piercer: .12,
    seismic: .15,
    pirateFire: .09,
    impact: .055,
    blocked: .09,
    collision: .15,
    explosion: .08,
    craft: .08,
    mine: .1,
    build: .09,
    pickup: .1,
    land: .4,
    launch: .4,
    wormhole: 1,
    alert: 2
  };
  function refreshUI() {
    $('#soundSummary').textContent = unavailable ? I18n.t('NO AUDIO') : settings.muted || !settings.volume ? I18n.t('MUTED') : I18n.t('SOUND');
    $('#muteSound').setAttribute('aria-pressed', String(settings.muted));
    $('#muteSound').innerHTML = I18n.html(`${ settings.muted ? I18n.t('UNMUTE') : I18n.t('MUTE') } SOUND <kbd>V</kbd>`);
    $('#soundVolume').value = String(Math.round(settings.volume * 100));
    $('#volumeValue').textContent = `${ Math.round(settings.volume * 100) }%`;
    if (unavailable) {
      $('#audioHint').textContent = I18n.t('Audio is unavailable in this browser. Gameplay is unaffected.');
      $('#muteSound').disabled = true;
      $('#soundVolume').disabled = true;
    } else if (context)
      $('#audioHint').textContent = I18n.t('V toggles sound. Volume and mute are saved on this browser.');
  }
  function persist() {
    try {
      localStorage.setItem('spacecraft-audio-v1', JSON.stringify(settings));
    } catch {
    }
  }
  function updateMaster() {
    if (master)
      master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume * .7, context.currentTime, .025);
  }

  // Browsers require a trusted gesture before creating or resuming the audio context.
  function unlock(event) {
    if (unavailable || !event.isTrusted)
      return;
    try {
      if (!context || context.state === 'closed') {
        lastPlayed.clear();
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) {
          unavailable = true;
          refreshUI();
          return;
        }
        context = new Audio({ latencyHint: 'interactive' });
        master = context.createGain();
        master.gain.value = settings.muted ? 0 : settings.volume * .7;
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -18;
        limiter.knee.value = 20;
        limiter.ratio.value = 6;
        limiter.attack.value = .003;
        limiter.release.value = .18;
        master.connect(limiter);
        limiter.connect(context.destination);
        noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * .75), context.sampleRate);
        const samples = noiseBuffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++)
          samples[i] = Math.random() * 2 - 1;
        refreshUI();
      }
      if (context.state === 'suspended')
        context.resume().catch(() => {
        });
    } catch {
      unavailable = true;
      refreshUI();
    }
  }

  // Track short-lived sources so muting or leaving the page can stop them promptly.
  function voice(source, gain, filter, pan, duration, delay = 0) {
    if (voices.size >= maxVoices) {
      source.disconnect();
      gain.disconnect();
      filter?.disconnect();
      return false;
    }
    let panner = null;
    if (context.createStereoPanner) {
      panner = context.createStereoPanner();
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(master);
    } else
      gain.connect(master);
    if (filter) {
      source.connect(filter);
      filter.connect(gain);
    } else
      source.connect(gain);
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
      gain.disconnect();
      filter?.disconnect();
      panner?.disconnect();
    };
    source.start(context.currentTime + delay);
    source.stop(context.currentTime + delay + duration + .025);
    return true;
  }
  function envelope(duration, peak, delay) {
    const gain = context.createGain(),
      start = context.currentTime + delay;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, peak), start + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, start + Math.max(.02, duration));
    return gain;
  }
  function tone(frequency, end, duration, volume, pan = 0, type = 'sine', delay = 0) {
    if (voices.size >= maxVoices)
      return;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + delay);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(15, end), context.currentTime + delay + duration);
    voice(oscillator, envelope(duration, volume, delay), null, pan, duration, delay);
  }
  function noise(duration, volume, cutoff, pan = 0, delay = 0) {
    if (voices.size >= maxVoices)
      return;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    voice(source, envelope(duration, volume, delay), filter, pan, duration, delay);
  }

  // Rate-limit effects, then synthesize the requested sound from tones and filtered noise.
  function play(name, options = {}) {
    if (!context || context.state === 'closed' || unavailable || settings.muted || !settings.volume || document.hidden || !Object.hasOwn(limits, name))
      return false;
    const now = context.currentTime;
    if (now - (lastPlayed.get(name)??-100) < limits[name] || voices.size >= maxVoices - 2)
      return false;
    let pan = 0,
      volume = 1;
    if (Number.isFinite(options.x) && Number.isFinite(options.y) && typeof ship !== 'undefined') {
      const distance = Math.hypot(options.x - ship.x, options.y - ship.y);
      if (distance > 1800)
        return false;
      volume = 1 / (1 + distance / 550);
      pan = Math.max(-.8, Math.min(.8, (options.x - ship.x) / Math.max(400, innerWidth * .5)));
    }
    const strength = Math.max(.25, Math.min(1.4, (options.intensity??1)));
    volume *= strength;
    lastPlayed.set(name, now);
    const t = (f, end, d, v, type = 'sine', delay = 0) => tone(f, end, d, v * volume, pan, type, delay);
    const n = (d, v, cutoff, delay = 0) => noise(d, v * volume, cutoff, pan, delay);
    switch (name) {
    case 'bulshitter':
      t(370, 160, .055, .055, 'square');
      break;
    case 'fotron':
      t(1450, 270, .2, .16, 'sawtooth');
      n(.08, .08, 3500);
      break;
    case 'photon':
      t(980, 310, .14, .11, 'triangle');
      break;
    case 'mininglaser':
      t(740, 420, .24, .13, 'sawtooth');
      break;
    case 'pulse':
      t(830, 170, .095, .17, 'triangle');
      t(1500, 500, .045, .035, 'square');
      break;
    case 'laser':
      t(1850, 280, .18, .16, 'sawtooth');
      t(2600, 680, .13, .045);
      break;
    case 'rockbreaker':
      n(.3, .3, 1300);
      t(180, 45, .3, .2, 'triangle');
      break;
    case 'piercer':
      n(.22, .24, 2400);
      t(410, 85, .24, .17, 'triangle');
      break;
    case 'seismic':
      n(.48, .36, 850);
      t(125, 28, .5, .25, 'triangle');
      break;
    case 'pirateFire':
      t(480, 100, .13, .11, 'sawtooth');
      break;
    case 'impact':
      n(.08, .2, 2700);
      t(230, 70, .07, .055, 'triangle');
      break;
    case 'blocked':
      t(920, 430, .095, .075, 'triangle');
      n(.06, .09, 3600);
      break;
    case 'collision':
      n(.23, .4, 1300);
      t(110, 30, .24, .24, 'triangle');
      break;
    case 'explosion':
      n(.65, .5, 1050);
      t(95, 22, .65, .27, 'triangle');
      n(.15, .15, 2600);
      break;
    case 'craft':
      t(523, 523, .14, .14);
      t(659, 659, .16, .12, 'sine', .09);
      t(784, 1047, .25, .12, 'sine', .18);
      break;
    case 'mine':
      n(.09, .21, 2000);
      t(170, 80, .08, .07, 'triangle');
      break;
    case 'build':
      t(180, 110, .1, .17, 'triangle');
      n(.06, .13, 1200);
      break;
    case 'refuel':
      t(180, 460, .3, .12, 'sine');
      t(660, 880, .15, .08, 'sine', .2);
      break;
    case 'pickup':
      t(960, 1400, .095, .07);
      break;
    case 'land':
      n(.35, .2, 480);
      t(170, 65, .35, .15, 'triangle');
      t(400, 400, .12, .06, 'sine', .25);
      break;
    case 'launch':
      n(.55, .3, 700);
      t(60, 210, .55, .16, 'triangle');
      break;
    case 'wormhole':
      n(.85, .18, 1300);
      t(90, 920, .7, .15, 'triangle');
      t(720, 120, .9, .1, 'sine', .12);
      break;
    case 'alert':
      t(530, 530, .15, .12, 'triangle');
      t(420, 420, .2, .1, 'triangle', .22);
      break;
    }
    return true;
  }
  function stopEngine() {
    if (!engine || !context)
      return;
    const old = engine;
    engine = null;
    const now = context.currentTime;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setTargetAtTime(0, now, .025);
    old.noise.stop(now + .12);
    old.osc.stop(now + .12);
  }

  // Reuse one looping engine voice and adjust it only when thrust mode changes.
  function setEngine(thrust, boost = false) {
    if (!thrust || !context || context.state !== 'running' || settings.muted || !settings.volume || document.hidden || unavailable) {
      stopEngine();
      return;
    }
    if (!engine) {
      const source = context.createBufferSource(),
        osc = context.createOscillator(),
        filter = context.createBiquadFilter(),
        gain = context.createGain();
      source.buffer = noiseBuffer;
      source.loop = true;
      osc.type = 'triangle';
      osc.frequency.value = 50;
      filter.type = 'lowpass';
      filter.frequency.value = 240;
      gain.gain.value = 0;
      source.connect(filter);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
      osc.start();
      source.onended = () => {
        source.disconnect();
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      engine = {
        noise: source,
        osc,
        filter,
        gain,
        mode: ''
      };
    }
    const reverse = thrust < 0,
      now = context.currentTime;
    const mode = `${ reverse }:${ boost }`;
    if (engine.mode === mode)
      return;
    engine.mode = mode;
    engine.gain.gain.setTargetAtTime((boost ? .21 : .13) * (reverse ? .65 : 1), now, .06);
    engine.osc.frequency.setTargetAtTime(boost ? 85 : reverse ? 42 : 55, now, .08);
    engine.filter.frequency.setTargetAtTime(boost ? 600 : reverse ? 180 : 300, now, .08);
  }

  // Stop engine and one-shot voices when the page loses focus or sound is muted.
  function silence() {
    stopEngine();
    for (const source of voices) {
      try {
        source.stop();
      } catch {
      }
    }
    voices.clear();
  }
  function mute() {
    settings.muted = !settings.muted;
    if (settings.muted)
      silence();
    updateMaster();
    persist();
    refreshUI();
  }
  $('#muteSound').onclick = mute;
  $('#soundVolume').oninput = e => {
    settings.volume = Number(e.target.value) / 100;
    if (!settings.volume)
      silence();
    updateMaster();
    persist();
    refreshUI();
  };
  addEventListener('pointerdown', unlock, { capture: true });
  addEventListener('keydown', unlock, { capture: true });
  addEventListener('keydown', e => {
    if (e.code === 'Escape' && $('#audioSettings').open) {
      $('#audioSettings').open = false;
      $('#soundSummary').focus();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (e.code === 'KeyM')
      $('#audioSettings').open = false;
    if (e.code === 'KeyV' && !e.repeat && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
      e.preventDefault();
      mute();
    }
  });
  addEventListener('pointerdown', e => {
    if (!$('#audioSettings').contains(e.target))
      $('#audioSettings').open = false;
  });
  addEventListener('blur', () => {
    silence();
    if ((context?.state) === 'running')
      context.suspend().catch(() => {
      });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      silence();
      if ((context?.state) === 'running')
        context.suspend().catch(() => {
        });
    }
  });
  addEventListener('pagehide', () => {
    silence();
    if (context && context.state !== 'closed')
      context.close().catch(() => {
      });
  });
  refreshUI();
  return {
    play,
    setEngine,
    silence,
    get muted() {
      return settings.muted;
    },
    get volume() {
      return settings.volume;
    }
  };
})();

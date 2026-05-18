'use strict';
/* ============================================================
   audio.js — Шаг 18: Полная аудио-система.
   Web Audio API: звуковые эффекты (осцилляторы), ambient-музыка,
   управление громкостью, кеширование.
   ============================================================ */

const AUDIO_SETTINGS_KEY = 'd20_audioSettings';

/* ---------- Biome music configs ---------- */
const BIOME_MUSIC = {
  crypt: {
    drone: 45,
    notes: [131, 156, 196, 233],
    wave: 'sine',
    noteInterval: [2.5, 4.0],
    filterFreq: 800,
    reverb: true,
  },
  ice_caves: {
    drone: 55,
    notes: [156, 185, 208, 262],
    wave: 'triangle',
    noteInterval: [2.0, 3.5],
    filterFreq: 2000,
    reverb: false,
  },
  fire_mines: {
    drone: 40,
    notes: [131, 147, 175, 196],
    wave: 'sawtooth',
    noteInterval: [1.8, 3.0],
    filterFreq: 600,
    reverb: false,
  },
  forest_ruins: {
    drone: 50,
    notes: [147, 175, 220, 262],
    wave: 'sine',
    noteInterval: [2.5, 4.5],
    filterFreq: 1200,
    reverb: true,
  },
  castle: {
    drone: 35,
    notes: [139, 165, 208, 247],
    wave: 'sine',
    noteInterval: [2.0, 3.5],
    filterFreq: 1500,
    reverb: true,
    harmonics: true,
  },
  camp: {
    drone: 60,
    notes: [262, 294, 330, 392, 440],
    wave: 'sine',
    noteInterval: [3.0, 5.0],
    filterFreq: 1800,
    reverb: true,
  },
  boss: {
    drone: 30,
    notes: [131, 147, 156, 175, 196, 208],
    wave: 'sawtooth',
    noteInterval: [0.5, 1.2],
    filterFreq: 900,
    reverb: false,
  },
};

const GameAudio = {
  ctx: null,
  masterGain: null,
  sfxGain: null,
  musicGain: null,

  // Settings
  sfxVolume: 0.7,
  musicVolume: 0.25,
  muted: false,
  initialized: false,

  // Music state
  _musicDrone: null,
  _musicDroneGain: null,
  _musicNoteTimer: null,
  _musicBiome: null,
  _musicPlaying: false,

  // Limiter: max concurrent oscillators
  _activeOscCount: 0,
  _maxOsc: 10,

  /* ============================================================
     Initialization
     ============================================================ */

  init() {
    this._loadSettings();
    // Defer AudioContext creation to first user interaction
    const activate = () => {
      if (!this.ctx) {
        this._createContext();
      } else if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      document.removeEventListener('click', activate);
      document.removeEventListener('touchstart', activate);
      document.removeEventListener('pointerdown', activate);
    };
    document.addEventListener('click', activate, { once: false });
    document.addEventListener('touchstart', activate, { once: false });
    document.addEventListener('pointerdown', activate, { once: false });

    // Visibility change — pause/resume music
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        if (this.ctx.state === 'running') this.ctx.suspend();
      } else {
        if (this.ctx.state === 'suspended') this.ctx.resume();
      }
    });
  },

  _createContext() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Master gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 1;
      this.masterGain.connect(this.ctx.destination);

      // SFX bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      // Music bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      this.initialized = true;
    } catch (e) {
      // Browser doesn't support Web Audio
      this.initialized = false;
    }
  },

  /* ============================================================
     Settings persistence
     ============================================================ */

  _loadSettings() {
    try {
      const raw = localStorage.getItem(AUDIO_SETTINGS_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (typeof s.sfxVolume === 'number') this.sfxVolume = s.sfxVolume;
        if (typeof s.musicVolume === 'number') this.musicVolume = s.musicVolume;
        if (typeof s.muted === 'boolean') this.muted = s.muted;
      }
    } catch (e) { /* ignore */ }
  },

  _saveSettings() {
    try {
      localStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({
        sfxVolume: this.sfxVolume,
        musicVolume: this.musicVolume,
        muted: this.muted,
      }));
    } catch (e) { /* ignore */ }
  },

  setSfxVolume(v) {
    this.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) this.sfxGain.gain.value = this.sfxVolume;
    this._saveSettings();
  },

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) this.musicGain.gain.value = this.musicVolume;
    this._saveSettings();
  },

  setMuted(v) {
    this.muted = !!v;
    if (this.masterGain) this.masterGain.gain.value = this.muted ? 0 : 1;
    this._saveSettings();
  },

  toggleMute() {
    this.setMuted(!this.muted);
  },

  /* ============================================================
     Helper: safe oscillator tracking
     ============================================================ */

  _canPlay() {
    return this.initialized && this.ctx && this.ctx.state === 'running' && this._activeOscCount < this._maxOsc;
  },

  _trackOsc(osc) {
    this._activeOscCount++;
    osc.onended = () => { this._activeOscCount = Math.max(0, this._activeOscCount - 1); };
  },

  /* ============================================================
     Sound Effects (SFX)
     ============================================================ */

  playSfx(type) {
    if (!this._canPlay()) return;
    switch (type) {
      case 'sword':    this._sfxSword(); break;
      case 'bow':      this._sfxBow(); break;
      case 'magic':    this._sfxMagic(); break;
      case 'explosion':this._sfxExplosion(); break;
      case 'xp':       this._sfxXp(); break;
      case 'gold':     this._sfxGold(); break;
      case 'levelup':  this._sfxLevelUp(); break;
      case 'death':    this._sfxDeath(); break;
      case 'chest':    this._sfxChest(); break;
      case 'd20':      this._sfxD20(); break;
      case 'boss_appear': this._sfxBossAppear(); break;
      case 'boss_death':  this._sfxBossDeath(); break;
    }
  },

  /** Удар мечом: белый шум 80мс + bandpass 2кГц */
  _sfxSword() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.08;

    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2000;
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t);
    src.stop(t + duration + 0.01);
    this._trackOsc(src);
  },

  /** Выстрел лука: синусоида 800→400 Гц, 100мс */
  _sfxBow() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.1;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
    this._trackOsc(osc);
  },

  /** Магический снаряд: синусоида 600 Гц с вибрато, 150мс */
  _sfxMagic() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.15;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);

    // Vibrato LFO
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 20;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 50;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + duration + 0.01);
    lfo.stop(t + duration + 0.01);
    this._trackOsc(osc);
    this._trackOsc(lfo);
  },

  /** Взрыв: коричневый шум 200мс + низкая синусоида 100 Гц */
  _sfxExplosion() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.2;

    // Brown noise (integrated white noise)
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + (0.02 * white)) / 1.02;
      data[i] = last * 3.5;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.8, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    noiseSrc.connect(noiseGain);
    noiseGain.connect(this.sfxGain);

    // Low sine
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 100;
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);

    noiseSrc.start(t);
    noiseSrc.stop(t + duration + 0.01);
    osc.start(t);
    osc.stop(t + duration + 0.01);
    this._trackOsc(noiseSrc);
    this._trackOsc(osc);
  },

  /** Подбор опыта: две синусоиды 1200→1800 Гц, 60мс */
  _sfxXp() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.06;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
    this._trackOsc(osc);
  },

  /** Подбор золота: 2000→2800 Гц, 80мс */
  _sfxGold() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.08;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(2800, t + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
    this._trackOsc(osc);
  },

  /** Повышение уровня: C5-E5-G5 (523, 659, 784), каждая 100мс */
  _sfxLevelUp() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const notes = [523, 659, 784];
    const noteDur = 0.1;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const start = t + i * noteDur;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.35, start + 0.01);
      gain.gain.setValueAtTime(0.35, start + noteDur * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.001, start + noteDur);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + noteDur + 0.01);
      this._trackOsc(osc);
    });
  },

  /** Смерть героя: 400→100 Гц за 500мс с эхо */
  _sfxDeath() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.5;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    // Simple echo via delayed copy
    const delay = ctx.createDelay(0.5);
    delay.delayTime.value = 0.15;
    const fbGain = ctx.createGain();
    fbGain.gain.value = 0.3;

    osc.connect(gain);
    gain.connect(this.sfxGain);
    gain.connect(delay);
    delay.connect(fbGain);
    fbGain.connect(delay);
    fbGain.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + duration + 0.01);
    this._trackOsc(osc);
  },

  /** Открытие сундука: белый шум 100мс + дзинь */
  _sfxChest() {
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Noise part
    const noiseDur = 0.1;
    const bufSize = Math.floor(ctx.sampleRate * noiseDur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buf;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + noiseDur);

    const hiPass = ctx.createBiquadFilter();
    hiPass.type = 'highpass';
    hiPass.frequency.value = 3000;

    noiseSrc.connect(hiPass);
    hiPass.connect(noiseGain);
    noiseGain.connect(this.sfxGain);
    noiseSrc.start(t);
    noiseSrc.stop(t + noiseDur + 0.01);
    this._trackOsc(noiseSrc);

    // Ding part (after noise)
    const dingStart = t + 0.08;
    const dingDur = 0.15;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, dingStart);
    osc.frequency.exponentialRampToValueAtTime(3000, dingStart + dingDur);

    const dingGain = ctx.createGain();
    dingGain.gain.setValueAtTime(0.3, dingStart);
    dingGain.gain.exponentialRampToValueAtTime(0.001, dingStart + dingDur);

    osc.connect(dingGain);
    dingGain.connect(this.sfxGain);
    osc.start(dingStart);
    osc.stop(dingStart + dingDur + 0.01);
    this._trackOsc(osc);
  },

  /** Бросок d20: 3 щелчка белого шума по 20мс с паузами 30мс */
  _sfxD20() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const clickDur = 0.02;
    const gap = 0.03;

    for (let i = 0; i < 3; i++) {
      const start = t + i * (clickDur + gap);
      const bufSize = Math.floor(ctx.sampleRate * clickDur);
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let j = 0; j < bufSize; j++) data[j] = Math.random() * 2 - 1;

      const src = ctx.createBufferSource();
      src.buffer = buf;

      const gain = ctx.createGain();
      const vol = (i === 2) ? 0.5 : 0.3; // Last click louder
      gain.gain.setValueAtTime(vol, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + clickDur);

      src.connect(gain);
      gain.connect(this.sfxGain);
      src.start(start);
      src.stop(start + clickDur + 0.01);
      this._trackOsc(src);
    }
  },

  /** Появление босса: низкий гул нарастающий */
  _sfxBossAppear() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.6;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(50, t);
    osc.frequency.linearRampToValueAtTime(80, t + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.4, t + duration * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
    this._trackOsc(osc);
  },

  /** Смерть босса: громкий взрыв */
  _sfxBossDeath() {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const duration = 0.4;

    // Heavy noise
    const bufSize = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + (0.02 * white)) / 1.02;
      data[i] = last * 5;
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    src.connect(gain);
    gain.connect(this.sfxGain);
    src.start(t);
    src.stop(t + duration + 0.01);
    this._trackOsc(src);

    // Low boom
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + duration);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.6, t);
    oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.01);
    this._trackOsc(osc);
  },

  /* ============================================================
     Background Music (Ambient)
     ============================================================ */

  playMusic(biomeId) {
    if (!this.initialized || !this.ctx) return;
    // If same biome already playing, don't restart
    if (this._musicBiome === biomeId && this._musicPlaying) return;

    this.stopMusic();

    const cfg = BIOME_MUSIC[biomeId];
    if (!cfg) return;

    this._musicBiome = biomeId;
    this._musicPlaying = true;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // Drone oscillator
    const drone = ctx.createOscillator();
    drone.type = cfg.wave || 'sine';
    drone.frequency.value = cfg.drone;

    // For castle biome — add harmonics for organ sound
    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0, t);
    droneGain.gain.linearRampToValueAtTime(0.15, t + 2.0);

    if (cfg.filterFreq) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = cfg.filterFreq;
      drone.connect(filter);
      filter.connect(droneGain);
    } else {
      drone.connect(droneGain);
    }

    droneGain.connect(this.musicGain);
    drone.start(t);

    this._musicDrone = drone;
    this._musicDroneGain = droneGain;

    // Schedule random notes
    this._scheduleNote(cfg);
  },

  _scheduleNote(cfg) {
    if (!this._musicPlaying) return;

    const [minInterval, maxInterval] = cfg.noteInterval;
    const delay = minInterval + Math.random() * (maxInterval - minInterval);

    this._musicNoteTimer = setTimeout(() => {
      if (!this._musicPlaying || !this.ctx || this.ctx.state !== 'running') {
        // Retry later if context suspended
        if (this._musicPlaying) this._scheduleNote(cfg);
        return;
      }

      const ctx = this.ctx;
      const t = ctx.currentTime;
      const freq = cfg.notes[Math.floor(Math.random() * cfg.notes.length)];
      const duration = 0.8 + Math.random() * 0.6;

      const osc = ctx.createOscillator();
      osc.type = cfg.wave || 'sine';
      osc.frequency.value = freq;

      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0, t);
      noteGain.gain.linearRampToValueAtTime(0.12, t + 0.05);
      noteGain.gain.setValueAtTime(0.12, t + duration * 0.6);
      noteGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      if (cfg.reverb) {
        // Simple reverb via delay feedback
        const delay = ctx.createDelay(0.5);
        delay.delayTime.value = 0.2 + Math.random() * 0.1;
        const fbGain = ctx.createGain();
        fbGain.gain.value = 0.2;

        osc.connect(noteGain);
        noteGain.connect(this.musicGain);
        noteGain.connect(delay);
        delay.connect(fbGain);
        fbGain.connect(this.musicGain);
      } else {
        osc.connect(noteGain);
        noteGain.connect(this.musicGain);
      }

      osc.start(t);
      osc.stop(t + duration + 0.3);
      osc.onended = () => { /* cleanup */ };

      // Schedule next
      this._scheduleNote(cfg);
    }, delay * 1000);
  },

  stopMusic() {
    this._musicPlaying = false;
    this._musicBiome = null;

    if (this._musicNoteTimer) {
      clearTimeout(this._musicNoteTimer);
      this._musicNoteTimer = null;
    }

    if (this._musicDrone) {
      try {
        const ctx = this.ctx;
        if (ctx && this._musicDroneGain) {
          const t = ctx.currentTime;
          this._musicDroneGain.gain.setValueAtTime(this._musicDroneGain.gain.value, t);
          this._musicDroneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          this._musicDrone.stop(t + 0.6);
        } else {
          this._musicDrone.stop();
        }
      } catch (e) { /* already stopped */ }
      this._musicDrone = null;
      this._musicDroneGain = null;
    }
  },

  pauseMusic() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  },

  resumeMusic() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },
};

window.GameAudio = GameAudio;

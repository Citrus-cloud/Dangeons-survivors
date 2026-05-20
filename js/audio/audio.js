'use strict';
/* ============================================================
   audio.js — Шаг 6 (переработка): Полная аудио-система.
   Web Audio API: ADSR-огибающие, фильтры, реверберация, хорус,
   компрессия. Все звуки богатые, «ламповые», RPG-стиль.
   ============================================================ */

const AUDIO_SETTINGS_KEY = 'd20_audioSettings';

/* ---------- Biome music configs (расширенные) ---------- */
const BIOME_MUSIC = {
  crypt: {
    drone: 45, notes: [131, 156, 196, 233],
    wave: 'triangle', noteInterval: [2.5, 4.0],
    filterFreq: 800, reverb: true, chorus: false,
    noteWave: 'triangle', noteAttack: 0.1, noteDecay: 0.3,
  },
  ice_caves: {
    drone: 55, notes: [156, 185, 208, 262],
    wave: 'triangle', noteInterval: [2.0, 3.5],
    filterFreq: 2000, reverb: true, chorus: true,
    noteWave: 'triangle', noteAttack: 0.08, noteDecay: 0.4,
  },
  fire_mines: {
    drone: 40, notes: [131, 147, 175, 196],
    wave: 'sawtooth', noteInterval: [1.8, 3.0],
    filterFreq: 600, reverb: false, chorus: false,
    noteWave: 'sawtooth', noteAttack: 0.05, noteDecay: 0.25,
    distortion: true,
  },

  forest_ruins: {
    drone: 50, notes: [147, 175, 220, 262],
    wave: 'sine', noteInterval: [2.5, 4.5],
    filterFreq: 1200, reverb: true, chorus: false,
    noteWave: 'sine', noteAttack: 0.1, noteDecay: 0.35,
    lfo: true, lfoRate: 3, lfoDepth: 8,
  },
  castle: {
    drone: 35, notes: [139, 165, 208, 247],
    wave: 'sine', noteInterval: [2.0, 3.5],
    filterFreq: 1500, reverb: true, chorus: false,
    noteWave: 'sine', noteAttack: 0.08, noteDecay: 0.3,
    harmonics: true,
  },
  sky_citadel: {
    drone: 60, notes: [262, 294, 330, 392, 440],
    wave: 'triangle', noteInterval: [2.5, 4.0],
    filterFreq: 3000, reverb: true, chorus: true,
    noteWave: 'triangle', noteAttack: 0.12, noteDecay: 0.4,
  },
  elven_forest: {
    drone: 50, notes: [147, 185, 220, 277],
    wave: 'sine', noteInterval: [2.5, 4.5],
    filterFreq: 1800, reverb: true, chorus: false,
    noteWave: 'sine', noteAttack: 0.15, noteDecay: 0.4,
    lfo: true, lfoRate: 2, lfoDepth: 5,
  },
  mountain_keep: {
    drone: 42, notes: [131, 156, 175, 208],
    wave: 'triangle', noteInterval: [2.0, 3.5],
    filterFreq: 900, reverb: false, chorus: false,
    noteWave: 'triangle', noteAttack: 0.06, noteDecay: 0.3,
    distortion: true,
  },
  camp: {
    drone: 60, notes: [262, 330, 392, 523, 659],
    wave: 'sine', noteInterval: [3.0, 5.0],
    filterFreq: 1800, reverb: true, chorus: false,
    noteWave: 'sine', noteAttack: 0.15, noteDecay: 0.5,
  },
  boss: {
    drone: 30, notes: [131, 147, 156, 175, 196, 208],
    wave: 'sawtooth', noteInterval: [0.5, 1.2],
    filterFreq: 900, reverb: true, chorus: false,
    noteWave: 'sawtooth', noteAttack: 0.03, noteDecay: 0.15,
  },
};


const GameAudio = {
  ctx: null,
  masterGain: null,
  sfxGain: null,
  musicGain: null,
  compressor: null,    // DynamicsCompressorNode на мастере
  reverbNode: null,    // ConvolverNode (общий реверб)
  reverbGain: null,    // Gain для реверба

  // Settings
  sfxVolume: 0.7,
  musicVolume: 0.25,
  muted: false,
  initialized: false,

  // Music state
  _musicDrone: null,
  _musicDroneGain: null,
  _musicDroneFilter: null,
  _musicNoteTimer: null,
  _musicBiome: null,
  _musicPlaying: false,
  _musicHarmonics: [],  // дополнительные осцилляторы для органного звука

  // Limiter: max concurrent oscillators
  _activeOscCount: 0,
  _maxOsc: 20,

  // Шаги героя (throttle)
  _lastStepTime: 0,
  _stepInterval: 0.3,

  /* ============================================================
     Initialization
     ============================================================ */

  init() {
    this._loadSettings();
    // Bug fix: используем единую функцию и удаляем слушатели после создания контекста
    this._activateHandler = () => {
      if (!this.ctx) {
        this._createContext();
      } else if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      // После успешного создания контекста убираем слушатели
      if (this.ctx && this.ctx.state === 'running') {
        this._removeActivateListeners();
      }
    };
    document.addEventListener('click', this._activateHandler);
    document.addEventListener('touchstart', this._activateHandler);
    document.addEventListener('pointerdown', this._activateHandler);

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      try {
        if (document.hidden) {
          if (this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
        } else {
          if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        }
      } catch (e) { /* безопасно игнорируем */ }
    });
  },

  /** Bug fix: удалить слушатели активации после создания AudioContext */
  _removeActivateListeners() {
    if (this._activateHandler) {
      document.removeEventListener('click', this._activateHandler);
      document.removeEventListener('touchstart', this._activateHandler);
      document.removeEventListener('pointerdown', this._activateHandler);
      this._activateHandler = null;
    }
  },


  _createContext() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Bug fix: на мобильных контекст может создаться в suspended,
      // явно вызываем resume()
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      // Компрессор на мастере (предотвращает клиппинг)
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -12;
      this.compressor.knee.value = 10;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.005;
      this.compressor.release.value = 0.1;
      this.compressor.connect(this.ctx.destination);

      // Master gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 1;
      this.masterGain.connect(this.compressor);

      // SFX bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      // Music bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicVolume;
      this.musicGain.connect(this.masterGain);

      // Общий реверб (ConvolverNode с синтетическим импульсом)
      this._createReverb();

      this.initialized = true;
    } catch (e) {
      console.warn('[GameAudio] Failed to create AudioContext:', e.message);
      this.initialized = false;
    }
  },

  /** Создать ConvolverNode с синтетическим импульсным откликом */
  _createReverb() {
    const ctx = this.ctx;
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * 1.5); // 1.5 сек реверб
    const impulse = ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        // Экспоненциально затухающий шум
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
      }
    }
    this.reverbNode = ctx.createConvolver();
    this.reverbNode.buffer = impulse;
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.3;
    this.reverbNode.connect(this.reverbGain);
    this.reverbGain.connect(this.masterGain);
  },


  /* ============================================================
     Settings persistence
     ============================================================ */

  _loadSettings() {
    try {
      const raw = SafeStorage.getItem(AUDIO_SETTINGS_KEY);
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
      SafeStorage.setItem(AUDIO_SETTINGS_KEY, JSON.stringify({
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
  toggleMute() { this.setMuted(!this.muted); },


  /* ============================================================
     Helpers: oscillator tracking, noise buffers, ADSR
     ============================================================ */

  _canPlay() {
    if (!this.initialized || !this.ctx) return false;
    // Bug fix: если контекст suspended (мобильные), пытаемся возобновить
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
      return false; // в этом кадре пропускаем, в следующем сыграет
    }
    return this.ctx.state === 'running' && this._activeOscCount < this._maxOsc;
  },

  _trackOsc(osc) {
    this._activeOscCount++;
    osc.onended = () => { this._activeOscCount = Math.max(0, this._activeOscCount - 1); };
  },

  /** Белый шум заданной длительности */
  _noiseBuffer(duration) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  },

  /** Коричневый шум (интеграция белого) */
  _brownNoiseBuffer(duration) {
    const ctx = this.ctx;
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
    return buf;
  },

  /** ADSR-огибающая на GainNode. Возвращает общую длительность. */
  _applyADSR(gainNode, t, a, d, s, r, peak) {
    peak = peak || 1.0;
    const g = gainNode.gain;
    g.setValueAtTime(0.001, t);
    g.linearRampToValueAtTime(peak, t + a);
    g.linearRampToValueAtTime(peak * s, t + a + d);
    // sustain удерживается; release запланируем позже
    return { sustainEnd: t + a + d };
  },

  /** Запланировать release на GainNode */
  _scheduleRelease(gainNode, startTime, releaseTime, sustainLevel) {
    const g = gainNode.gain;
    g.setValueAtTime(sustainLevel, startTime);
    g.exponentialRampToValueAtTime(0.001, startTime + releaseTime);
  },

  /** Создать waveshaper для лёгкого distortion */
  _createDistortion(amount) {
    const ctx = this.ctx;
    const ws = ctx.createWaveShaper();
    const k = amount || 50;
    const n = 44100;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    ws.curve = curve;
    ws.oversample = '2x';
    return ws;
  },


  /* ============================================================
     Sound Effects (SFX) — Dispatcher
     ============================================================ */

  playSfx(type, opts) {
    if (!this._canPlay()) return;
    switch (type) {
      case 'sword':       this._sfxSword(); break;
      case 'bow':         this._sfxBow(); break;
      case 'magic':       this._sfxMagic(); break;
      case 'heavy':       this._sfxHeavy(); break;
      case 'explosion':   this._sfxExplosion(); break;
      case 'ice':         this._sfxIce(); break;
      case 'lightning':   this._sfxLightning(); break;
      case 'poison':      this._sfxPoison(); break;
      case 'xp':          this._sfxXp(); break;
      case 'xp_red':      this._sfxXpRed(); break;
      case 'xp_blue':     this._sfxXpBlue(); break;
      case 'xp_yellow':   this._sfxXpYellow(); break;
      case 'gold':        this._sfxGold(); break;
      case 'levelup':     this._sfxLevelUp(); break;
      case 'death':       this._sfxDeath(); break;
      case 'chest':       this._sfxChest(); break;
      case 'd20':         this._sfxD20(); break;
      case 'boss_appear': this._sfxBossAppear(); break;
      case 'boss_roar':   this._sfxBossRoar(); break;
      case 'boss_death':  this._sfxBossDeath(); break;
      case 'enemy_hit':   this._sfxEnemyHit(opts); break;
      case 'enemy_death': this._sfxEnemyDeath(); break;
      case 'step':        this._sfxStep(); break;
      case 'apple_crunch': this._sfxAppleCrunch(); break;
      case 'urn_break':    this._sfxUrnBreak(); break;
    }
  },


  /* ============================================================
     WEAPON SOUNDS
     ============================================================ */

  /** Меч: металлический лязг (шум + bandpass 3кГц + низкий гул) */
  _sfxSword() {
    const ctx = this.ctx, t = ctx.currentTime;
    // Шум-компонент (металлический)
    const nBuf = this._noiseBuffer(0.08);
    const nSrc = ctx.createBufferSource();
    nSrc.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 3;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.5, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    nSrc.connect(bp); bp.connect(nGain);
    nGain.connect(this.sfxGain);
    nSrc.start(t); nSrc.stop(t + 0.09);
    this._trackOsc(nSrc);
    // Низкий гул (triangle 150 Гц)
    const osc = ctx.createOscillator();
    osc.type = 'triangle'; osc.frequency.value = 150;
    const oGain = ctx.createGain();
    oGain.gain.setValueAtTime(0.3, t);
    oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(oGain); oGain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.07);
    this._trackOsc(osc);
  },

  /** Лук: тетива (triangle sweep 800→400 + щипок) */
  _sfxBow() {
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.08);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain); gain.connect(this.sfxGain);
    // Тихий шум щипка
    const nBuf = this._noiseBuffer(0.03);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.15, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 4000;
    nSrc.connect(hp); hp.connect(nGain); nGain.connect(this.sfxGain);
    nSrc.start(t); nSrc.stop(t + 0.04);
    osc.start(t); osc.stop(t + 0.09);
    this._trackOsc(osc); this._trackOsc(nSrc);
  },


  /** Магия: синус 600 Гц с вибрато + шипение + реверберация */
  _sfxMagic() {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 0.15;
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 600;
    // Вибрато (LFO 30 Гц)
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 30;
    const lfoG = ctx.createGain(); lfoG.gain.value = 50;
    lfo.connect(lfoG); lfoG.connect(osc.frequency);
    // Огибающая
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.35, t + 0.02);
    gain.gain.setValueAtTime(0.3, t + dur * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    // Отправить в реверб
    if (this.reverbNode) gain.connect(this.reverbNode);
    // Шипение
    const nBuf = this._noiseBuffer(dur);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const nBp = ctx.createBiquadFilter();
    nBp.type = 'highpass'; nBp.frequency.value = 6000;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.08, t);
    nG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    nSrc.connect(nBp); nBp.connect(nG); nG.connect(this.sfxGain);
    osc.start(t); lfo.start(t); nSrc.start(t);
    osc.stop(t + dur + 0.01); lfo.stop(t + dur + 0.01); nSrc.stop(t + dur + 0.01);
    this._trackOsc(osc); this._trackOsc(lfo); this._trackOsc(nSrc);
  },

  /** Молот: тяжёлый удар (triangle 80 Гц + шум, компрессия) */
  _sfxHeavy() {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 0.2;
    // Низкий удар
    const osc = ctx.createOscillator();
    osc.type = 'triangle'; osc.frequency.value = 80;
    const oG = ctx.createGain();
    oG.gain.setValueAtTime(0.001, t);
    oG.gain.linearRampToValueAtTime(0.6, t + 0.005);
    oG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(oG); oG.connect(this.sfxGain);
    // Шум удара
    const nBuf = this._noiseBuffer(0.1);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1500;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.4, t);
    nG.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    nSrc.connect(lp); lp.connect(nG); nG.connect(this.sfxGain);
    osc.start(t); nSrc.start(t);
    osc.stop(t + dur + 0.01); nSrc.stop(t + 0.11);
    this._trackOsc(osc); this._trackOsc(nSrc);
  },


  /** Взрыв/огонь: коричневый шум 300мс + triangle 60 Гц + реверб */
  _sfxExplosion() {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 0.3;
    // Коричневый шум
    const nBuf = this._brownNoiseBuffer(dur);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.001, t);
    nG.gain.linearRampToValueAtTime(0.7, t + 0.005);
    nG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    nSrc.connect(nG); nG.connect(this.sfxGain);
    if (this.reverbNode) nG.connect(this.reverbNode);
    // Низкий тон
    const osc = ctx.createOscillator();
    osc.type = 'triangle'; osc.frequency.value = 60;
    const oG = ctx.createGain();
    oG.gain.setValueAtTime(0.001, t);
    oG.gain.linearRampToValueAtTime(0.5, t + 0.005);
    oG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(oG); oG.connect(this.sfxGain);
    nSrc.start(t); osc.start(t);
    nSrc.stop(t + dur + 0.01); osc.stop(t + dur + 0.01);
    this._trackOsc(nSrc); this._trackOsc(osc);
  },

  /** Лёд: triangle 2000→1000 Гц + хрустальный шум (bandpass 5кГц) */
  _sfxIce() {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 0.1;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(1000, t + dur);
    const oG = ctx.createGain();
    oG.gain.setValueAtTime(0.001, t);
    oG.gain.linearRampToValueAtTime(0.35, t + 0.005);
    oG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(oG); oG.connect(this.sfxGain);
    // Хрустальный шум
    const nBuf = this._noiseBuffer(0.08);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 5000; bp.Q.value = 4;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.2, t);
    nG.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    nSrc.connect(bp); bp.connect(nG); nG.connect(this.sfxGain);
    osc.start(t); nSrc.start(t);
    osc.stop(t + dur + 0.01); nSrc.stop(t + 0.09);
    this._trackOsc(osc); this._trackOsc(nSrc);
  },


  /** Молния: пила 200 Гц + шум bandpass 1кГц + хорус */
  _sfxLightning() {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 0.15;
    // Основной тон
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth'; osc1.frequency.value = 200;
    // Хорус: слегка расстроенная копия
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth'; osc2.frequency.value = 203;
    const oG = ctx.createGain();
    oG.gain.setValueAtTime(0.001, t);
    oG.gain.linearRampToValueAtTime(0.3, t + 0.001);
    oG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc1.connect(oG); osc2.connect(oG); oG.connect(this.sfxGain);
    // Шум-компонент
    const nBuf = this._noiseBuffer(dur);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1000; bp.Q.value = 2;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.25, t);
    nG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    nSrc.connect(bp); bp.connect(nG); nG.connect(this.sfxGain);
    osc1.start(t); osc2.start(t); nSrc.start(t);
    osc1.stop(t + dur + 0.01); osc2.stop(t + dur + 0.01); nSrc.stop(t + dur + 0.01);
    this._trackOsc(osc1); this._trackOsc(osc2); this._trackOsc(nSrc);
  },

  /** Яд: пузырящийся шум с LFO + triangle 300 Гц */
  _sfxPoison() {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 0.5;
    // Triangle основа
    const osc = ctx.createOscillator();
    osc.type = 'triangle'; osc.frequency.value = 300;
    const oG = ctx.createGain();
    oG.gain.setValueAtTime(0.001, t);
    oG.gain.linearRampToValueAtTime(0.2, t + 0.03);
    oG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(oG); oG.connect(this.sfxGain);
    // Пузыри: шум модулированный LFO
    const nBuf = this._noiseBuffer(dur);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 3;
    // LFO на громкость шума (эффект пузырей)
    const nG = ctx.createGain(); nG.gain.value = 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 8;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.15;
    lfo.connect(lfoG); lfoG.connect(nG.gain);
    nSrc.connect(bp); bp.connect(nG); nG.connect(this.sfxGain);
    osc.start(t); nSrc.start(t); lfo.start(t);
    osc.stop(t + dur + 0.01); nSrc.stop(t + dur + 0.01); lfo.stop(t + dur + 0.01);
    this._trackOsc(osc); this._trackOsc(nSrc); this._trackOsc(lfo);
  },


  /* ============================================================
     PICKUP SOUNDS
     ============================================================ */

  /** Опыт (зелёный): две triangle ноты 1200→1800 Гц */
  _sfxXp() {
    const ctx = this.ctx, t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.06);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.07);
    this._trackOsc(osc);
  },

  /** Опыт красный (×10): 1500→2200 Гц + лёгкий хорус */
  _sfxXpRed() {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 0.08;
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(1500, t);
    osc1.frequency.exponentialRampToValueAtTime(2200, t + dur);
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1503, t);
    osc2.frequency.exponentialRampToValueAtTime(2205, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.22, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc1.connect(gain); osc2.connect(gain); gain.connect(this.sfxGain);
    osc1.start(t); osc2.start(t);
    osc1.stop(t + dur + 0.01); osc2.stop(t + dur + 0.01);
    this._trackOsc(osc1); this._trackOsc(osc2);
  },

  /** Опыт синий (×100): арпеджио C5-E5-G5 за 150мс */
  _sfxXpBlue() {
    const ctx = this.ctx, t = ctx.currentTime;
    const notes = [523, 659, 784];
    const noteDur = 0.05;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle'; osc.frequency.value = freq;
      const g = ctx.createGain();
      const s = t + i * noteDur;
      g.gain.setValueAtTime(0.001, s);
      g.gain.linearRampToValueAtTime(0.25, s + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, s + noteDur);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(s); osc.stop(s + noteDur + 0.01);
      this._trackOsc(osc);
    });
  },


  /** Опыт жёлтый (×1000): торжественное арпеджио 5 нот + реверб */
  _sfxXpYellow() {
    const ctx = this.ctx, t = ctx.currentTime;
    const notes = [523, 659, 784, 1047, 1319]; // C5-E5-G5-C6-E6
    const noteDur = 0.05;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle'; osc.frequency.value = freq;
      const g = ctx.createGain();
      const s = t + i * noteDur;
      g.gain.setValueAtTime(0.001, s);
      g.gain.linearRampToValueAtTime(0.28, s + 0.005);
      g.gain.setValueAtTime(0.25, s + noteDur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, s + noteDur * 1.5);
      osc.connect(g); g.connect(this.sfxGain);
      if (this.reverbNode) g.connect(this.reverbNode);
      osc.start(s); osc.stop(s + noteDur * 1.5 + 0.01);
      this._trackOsc(osc);
    });
  },

  /** Золото: монетка triangle 2500→3000 + шум звона */
  _sfxGold() {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 0.04;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2500, t);
    osc.frequency.exponentialRampToValueAtTime(3000, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.3, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(this.sfxGain);
    // Звон (шум bandpass)
    const nBuf = this._noiseBuffer(0.03);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 6000; bp.Q.value = 5;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.12, t);
    nG.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    nSrc.connect(bp); bp.connect(nG); nG.connect(this.sfxGain);
    osc.start(t); nSrc.start(t);
    osc.stop(t + dur + 0.01); nSrc.stop(t + 0.04);
    this._trackOsc(osc); this._trackOsc(nSrc);
  },


  /* ============================================================
     EVENT SOUNDS
     ============================================================ */

  /** Повышение уровня: «Та-даа!» C5-E5-G5 triangle + хорус + реверб */
  _sfxLevelUp() {
    const ctx = this.ctx, t = ctx.currentTime;
    const notes = [523, 659, 784];
    const noteDur = 0.1;
    notes.forEach((freq, i) => {
      // Основной
      const osc1 = ctx.createOscillator();
      osc1.type = 'triangle'; osc1.frequency.value = freq;
      // Хорус
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle'; osc2.frequency.value = freq * 1.005;
      const g = ctx.createGain();
      const s = t + i * noteDur;
      g.gain.setValueAtTime(0.001, s);
      g.gain.linearRampToValueAtTime(0.3, s + 0.01);
      g.gain.setValueAtTime(0.28, s + noteDur * 0.7);
      g.gain.exponentialRampToValueAtTime(0.001, s + noteDur * 1.2);
      osc1.connect(g); osc2.connect(g);
      g.connect(this.sfxGain);
      if (this.reverbNode) g.connect(this.reverbNode);
      osc1.start(s); osc2.start(s);
      osc1.stop(s + noteDur * 1.2 + 0.01);
      osc2.stop(s + noteDur * 1.2 + 0.01);
      this._trackOsc(osc1); this._trackOsc(osc2);
    });
  },

  /** Смерть героя: triangle 400→80 Гц за 600мс + хорус + реверб */
  _sfxDeath() {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 0.6;
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(400, t);
    osc1.frequency.exponentialRampToValueAtTime(80, t + dur);
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(403, t);
    osc2.frequency.exponentialRampToValueAtTime(81, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc1.connect(gain); osc2.connect(gain);
    gain.connect(this.sfxGain);
    if (this.reverbNode) gain.connect(this.reverbNode);
    osc1.start(t); osc2.start(t);
    osc1.stop(t + dur + 0.01); osc2.stop(t + dur + 0.01);
    this._trackOsc(osc1); this._trackOsc(osc2);
  },


  /** Открытие сундука: скрип (bandpass 4кГц) + звон монет */
  _sfxChest() {
    const ctx = this.ctx, t = ctx.currentTime;
    // Скрип
    const nBuf = this._noiseBuffer(0.1);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 4000; bp.Q.value = 6;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.001, t);
    nG.gain.linearRampToValueAtTime(0.3, t + 0.01);
    nG.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    nSrc.connect(bp); bp.connect(nG); nG.connect(this.sfxGain);
    nSrc.start(t); nSrc.stop(t + 0.11);
    this._trackOsc(nSrc);
    // Звон монет (после скрипа)
    const jingleStart = t + 0.08;
    const jingleNotes = [2200, 2800, 3200];
    jingleNotes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle'; osc.frequency.value = freq;
      const g = ctx.createGain();
      const s = jingleStart + i * 0.03;
      g.gain.setValueAtTime(0.001, s);
      g.gain.linearRampToValueAtTime(0.2, s + 0.003);
      g.gain.exponentialRampToValueAtTime(0.001, s + 0.06);
      osc.connect(g); g.connect(this.sfxGain);
      osc.start(s); osc.stop(s + 0.07);
      this._trackOsc(osc);
    });
  },

  /** Бросок d20: три щелчка + финальный громче + реверб */
  _sfxD20() {
    const ctx = this.ctx, t = ctx.currentTime;
    const clickDur = 0.02;
    const gap = 0.03;
    for (let i = 0; i < 3; i++) {
      const start = t + i * (clickDur + gap);
      const buf = this._noiseBuffer(clickDur);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 2;
      const g = ctx.createGain();
      const vol = (i === 2) ? 0.5 : 0.3;
      g.gain.setValueAtTime(vol, start);
      g.gain.exponentialRampToValueAtTime(0.001, start + clickDur);
      src.connect(bp); bp.connect(g); g.connect(this.sfxGain);
      if (i === 2 && this.reverbNode) g.connect(this.reverbNode);
      src.start(start); src.stop(start + clickDur + 0.01);
      this._trackOsc(src);
    }
  },


  /* ============================================================
     BOSS SOUNDS
     ============================================================ */

  /** Появление босса: низкий гул triangle 40 Гц с вибрато, 2 сек + реверб */
  _sfxBossAppear() {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 2.0;
    const osc = ctx.createOscillator();
    osc.type = 'triangle'; osc.frequency.value = 40;
    // Вибрато
    const lfo = ctx.createOscillator(); lfo.frequency.value = 4;
    const lfoG = ctx.createGain(); lfoG.gain.value = 5;
    lfo.connect(lfoG); lfoG.connect(osc.frequency);
    // Огибающая: медленный attack
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.5);
    gain.gain.setValueAtTime(0.35, t + dur - 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(this.sfxGain);
    if (this.reverbNode) gain.connect(this.reverbNode);
    // Шум (атмосфера)
    const nBuf = this._brownNoiseBuffer(dur);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.001, t);
    nG.gain.linearRampToValueAtTime(0.15, t + 0.5);
    nG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 300;
    nSrc.connect(lp); lp.connect(nG); nG.connect(this.sfxGain);
    osc.start(t); lfo.start(t); nSrc.start(t);
    osc.stop(t + dur + 0.01); lfo.stop(t + dur + 0.01); nSrc.stop(t + dur + 0.01);
    this._trackOsc(osc); this._trackOsc(lfo); this._trackOsc(nSrc);
  },

  /** Рёв босса: пила 100 Гц + шум + distortion, 800мс */
  _sfxBossRoar() {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 0.8;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth'; osc.frequency.value = 100;
    // LFO модуляция частоты
    const lfo = ctx.createOscillator(); lfo.frequency.value = 6;
    const lfoG = ctx.createGain(); lfoG.gain.value = 20;
    lfo.connect(lfoG); lfoG.connect(osc.frequency);
    const dist = this._createDistortion(30);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.45, t + 0.1);
    gain.gain.setValueAtTime(0.4, t + dur * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(dist); dist.connect(gain); gain.connect(this.sfxGain);
    // Шум
    const nBuf = this._noiseBuffer(dur);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 500;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.001, t);
    nG.gain.linearRampToValueAtTime(0.2, t + 0.1);
    nG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    nSrc.connect(lp); lp.connect(nG); nG.connect(this.sfxGain);
    osc.start(t); lfo.start(t); nSrc.start(t);
    osc.stop(t + dur + 0.01); lfo.stop(t + dur + 0.01); nSrc.stop(t + dur + 0.01);
    this._trackOsc(osc); this._trackOsc(lfo); this._trackOsc(nSrc);
  },


  /** Смерть босса: громкий взрыв + глубокий реверб, 1 сек */
  _sfxBossDeath() {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 1.0;
    // Мощный коричневый шум
    const nBuf = this._brownNoiseBuffer(0.5);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.001, t);
    nG.gain.linearRampToValueAtTime(0.7, t + 0.01);
    nG.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    nSrc.connect(nG); nG.connect(this.sfxGain);
    if (this.reverbNode) nG.connect(this.reverbNode);
    // Низкий triangle гул
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(50, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + dur);
    const oG = ctx.createGain();
    oG.gain.setValueAtTime(0.001, t);
    oG.gain.linearRampToValueAtTime(0.6, t + 0.02);
    oG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(oG); oG.connect(this.sfxGain);
    if (this.reverbNode) oG.connect(this.reverbNode);
    nSrc.start(t); osc.start(t);
    nSrc.stop(t + 0.51); osc.stop(t + dur + 0.01);
    this._trackOsc(nSrc); this._trackOsc(osc);
  },

  /* ============================================================
     ENEMY SOUNDS
     ============================================================ */

  /** Боль врага: короткий писк/шум (частота зависит от типа) */
  _sfxEnemyHit(opts) {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 0.05;
    const freq = (opts && opts.freq) || 800;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain); gain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + dur + 0.01);
    this._trackOsc(osc);
  },

  /** Смерть врага: тихий «dusting» (шум bandpass + triangle 400→200) */
  _sfxEnemyDeath() {
    const ctx = this.ctx, t = ctx.currentTime;
    const dur = 0.1;
    // Шум dusting
    const nBuf = this._noiseBuffer(dur);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2000; bp.Q.value = 2;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.1, t);
    nG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    nSrc.connect(bp); bp.connect(nG); nG.connect(this.sfxGain);
    // Тон
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + dur);
    const oG = ctx.createGain();
    oG.gain.setValueAtTime(0.08, t);
    oG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(oG); oG.connect(this.sfxGain);
    nSrc.start(t); osc.start(t);
    nSrc.stop(t + dur + 0.01); osc.stop(t + dur + 0.01);
    this._trackOsc(nSrc); this._trackOsc(osc);
  },


  /** Шаги героя: тихий шум bandpass 200 Гц, throttled */
  _sfxStep() {
    const ctx = this.ctx, t = ctx.currentTime;
    // Throttle
    if (t - this._lastStepTime < this._stepInterval) return;
    this._lastStepTime = t;
    const dur = 0.05;
    const nBuf = this._noiseBuffer(dur);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 200; bp.Q.value = 1;
    const nG = ctx.createGain();
    nG.gain.setValueAtTime(0.06, t);
    nG.gain.exponentialRampToValueAtTime(0.001, t + dur);
    nSrc.connect(bp); bp.connect(nG); nG.connect(this.sfxGain);
    nSrc.start(t); nSrc.stop(t + dur + 0.01);
    this._trackOsc(nSrc);
  },

  /* ============================================================
     Background Music (Ambient) — Полная переработка
     ============================================================ */

  playMusic(biomeId) {
    if (!this.initialized || !this.ctx) return;
    // Bug fix: пытаемся возобновить контекст если suspended
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (this._musicBiome === biomeId && this._musicPlaying) return;
    this.stopMusic();

    const cfg = BIOME_MUSIC[biomeId];
    if (!cfg) return;

    this._musicBiome = biomeId;
    this._musicPlaying = true;

    const ctx = this.ctx;
    const t = ctx.currentTime;

    // --- Дрон: triangle/sine с low-pass фильтром + лёгкий хорус ---
    const drone = ctx.createOscillator();
    drone.type = cfg.wave || 'triangle';
    drone.frequency.value = cfg.drone;

    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0, t);
    droneGain.gain.linearRampToValueAtTime(0.12, t + 2.0);

    // Low-pass на дроне для тёплого звука
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    droneFilter.frequency.value = cfg.filterFreq || 800;
    droneFilter.Q.value = 0.7;

    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(this.musicGain);

    // Хорус для дрона (слегка расстроенная копия)
    if (cfg.chorus) {
      const drone2 = ctx.createOscillator();
      drone2.type = cfg.wave || 'triangle';
      drone2.frequency.value = cfg.drone * 1.003;
      const d2Gain = ctx.createGain();
      d2Gain.gain.setValueAtTime(0, t);
      d2Gain.gain.linearRampToValueAtTime(0.08, t + 2.0);
      drone2.connect(droneFilter);
      drone2.start(t);
      this._musicHarmonics.push(drone2);
    }

    // Гармоники для органного звука (замок)
    if (cfg.harmonics) {
      [2, 3, 4].forEach((h) => {
        const ho = ctx.createOscillator();
        ho.type = 'sine';
        ho.frequency.value = cfg.drone * h;
        const hg = ctx.createGain();
        hg.gain.setValueAtTime(0, t);
        hg.gain.linearRampToValueAtTime(0.04 / h, t + 2.5);
        ho.connect(hg); hg.connect(droneGain);
        ho.start(t);
        this._musicHarmonics.push(ho);
      });
    }

    drone.start(t);
    this._musicDrone = drone;
    this._musicDroneGain = droneGain;
    this._musicDroneFilter = droneFilter;

    // Мелодические ноты (пентатоника)
    this._scheduleNote(cfg);
  },


  _scheduleNote(cfg) {
    if (!this._musicPlaying || !this.ctx) return;

    const [minI, maxI] = cfg.noteInterval;
    const delay = minI + Math.random() * (maxI - minI);

    this._musicNoteTimer = setTimeout(() => {
      if (!this._musicPlaying || !this.ctx) return;
      // Bug fix: если контекст suspended, перепланируем без воспроизведения
      if (this.ctx.state !== 'running') {
        this._scheduleNote(cfg);
        return;
      }

      try {
        const ctx = this.ctx;
        const t = ctx.currentTime;
        const freq = cfg.notes[Math.floor(Math.random() * cfg.notes.length)];
        const attack = cfg.noteAttack || 0.1;
        const decay = cfg.noteDecay || 0.3;
        const duration = attack + decay + 0.4 + Math.random() * 0.3;

        const osc = ctx.createOscillator();
        osc.type = cfg.noteWave || 'sine';
        osc.frequency.value = freq;

        // LFO на ноту (для лесных/эльфийских биомов)
        if (cfg.lfo) {
          const lfo = ctx.createOscillator();
          lfo.frequency.value = cfg.lfoRate || 3;
          const lG = ctx.createGain();
          lG.gain.value = cfg.lfoDepth || 5;
          lfo.connect(lG); lG.connect(osc.frequency);
          lfo.start(t); lfo.stop(t + duration + 0.1);
        }

        const noteGain = ctx.createGain();
        // ADSR
        noteGain.gain.setValueAtTime(0.001, t);
        noteGain.gain.linearRampToValueAtTime(0.1, t + attack);
        noteGain.gain.setValueAtTime(0.08, t + attack + decay * 0.5);
        noteGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

        // Distortion для огненных/горных биомов
        if (cfg.distortion) {
          const dist = this._createDistortion(15);
          osc.connect(dist); dist.connect(noteGain);
        } else {
          osc.connect(noteGain);
        }

        noteGain.connect(this.musicGain);

        // Реверберация
        if (cfg.reverb && this.reverbNode) {
          const revSend = ctx.createGain();
          revSend.gain.value = 0.15;
          noteGain.connect(revSend);
          revSend.connect(this.reverbNode);
        }

        osc.start(t);
        osc.stop(t + duration + 0.1);
        osc.onended = () => { /* cleanup */ };
      } catch (e) {
        // Bug fix: не даём ошибкам в воспроизведении ноты сломать цикл
      }

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

    // Останавливаем дрон с безопасным fade-out
    if (this._musicDrone) {
      try {
        const ctx = this.ctx;
        if (ctx && this._musicDroneGain && ctx.state === 'running') {
          const t = ctx.currentTime;
          this._musicDroneGain.gain.setValueAtTime(
            this._musicDroneGain.gain.value, t
          );
          this._musicDroneGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          this._musicDrone.stop(t + 0.6);
        } else {
          this._musicDrone.stop();
        }
      } catch (e) { /* already stopped or InvalidStateError */ }
      this._musicDrone = null;
      this._musicDroneGain = null;
      this._musicDroneFilter = null;
    }

    // Останавливаем дополнительные осцилляторы (хорус, гармоники)
    for (const h of this._musicHarmonics) {
      try { h.stop(); } catch (e) { /* ignore */ }
    }
    this._musicHarmonics = [];
  },

  pauseMusic() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  },

  resumeMusic() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  },

  /* ============================================================
     Шаг 1: Звуки урн и яблок
     ============================================================ */

  /** Яблоко: сочный хруст (шум + low sine + bandpass) */
  _sfxAppleCrunch() {
    const ctx = this.ctx, t = ctx.currentTime;
    // Хруст (шум через bandpass)
    const nBuf = this._noiseBuffer(0.12);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2000; bp.Q.value = 2;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.4, t);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    nSrc.connect(bp); bp.connect(nGain); nGain.connect(this.sfxGain);
    nSrc.start(t); nSrc.stop(t + 0.13);
    this._trackOsc(nSrc);
    // Сочный тон (sine 300 Hz, короткий)
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 300;
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.08);
    const oGain = ctx.createGain();
    oGain.gain.setValueAtTime(0.25, t);
    oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(oGain); oGain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.09);
    this._trackOsc(osc);
  },

  /** Урна: глухой удар + осколки (шум + low thud) */
  _sfxUrnBreak() {
    const ctx = this.ctx, t = ctx.currentTime;
    // Глухой удар (sine 100 Hz)
    const osc = ctx.createOscillator();
    osc.type = 'sine'; osc.frequency.value = 100;
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
    const oGain = ctx.createGain();
    oGain.gain.setValueAtTime(0.4, t);
    oGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(oGain); oGain.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.11);
    this._trackOsc(osc);
    // Осколки (шум через highpass)
    const nBuf = this._noiseBuffer(0.1);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = nBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 3000;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.3, t + 0.02);
    nGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    nSrc.connect(hp); hp.connect(nGain); nGain.connect(this.sfxGain);
    nSrc.start(t); nSrc.stop(t + 0.11);
    this._trackOsc(nSrc);
  },
};

window.GameAudio = GameAudio;

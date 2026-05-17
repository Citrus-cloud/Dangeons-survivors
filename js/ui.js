'use strict';
/* ============================================================
   ui.js — HUD, слоты, оверлеи (меню/пауза/левелап/смерть).
   ============================================================ */

const UI = {
  // Бары / счётчики
  hpFill: null, hpLabel: null,
  xpFill: null, xpLabel: null,
  cdMissileFill: null,
  killCount: null, runTimer: null, waveInfo: null,

  // Оверлеи
  menuOverlay: null, pauseOverlay: null, levelOverlay: null, gameOverOverlay: null,
  cardsEl: null, lvlNum: null,
  goTime: null, goKills: null, goLevel: null,

  // Слоты
  weaponSlotEls: [],
  abilitySlotEls: [],

  init() {
    this.hpFill = document.querySelector('#hpBar .fill');
    this.hpLabel = document.querySelector('#hpBar .label');
    this.xpFill = document.querySelector('#xpBar .fill');
    this.xpLabel = document.querySelector('#xpBar .label');
    this.cdMissileFill = document.querySelector('#cdMissile .cd-fill');
    this.killCount = document.getElementById('killCount');
    this.runTimer  = document.getElementById('runTimer');
    this.waveInfo  = document.getElementById('waveInfo');

    this.menuOverlay     = document.getElementById('menuOverlay');
    this.pauseOverlay    = document.getElementById('pauseOverlay');
    this.levelOverlay    = document.getElementById('levelOverlay');
    this.gameOverOverlay = document.getElementById('gameOverOverlay');
    this.cardsEl = document.getElementById('cards');
    this.lvlNum  = document.getElementById('lvlNum');
    this.goTime  = document.getElementById('goTime');
    this.goKills = document.getElementById('goKills');
    this.goLevel = document.getElementById('goLevel');

    // Создать ячейки слотов
    this._buildSlotColumns();
  },

  _buildSlotColumns() {
    const left  = document.getElementById('weaponSlots');
    const right = document.getElementById('abilitySlots');
    left.innerHTML = '';
    right.innerHTML = '';
    this.weaponSlotEls.length = 0;
    this.abilitySlotEls.length = 0;
    for (let i = 0; i < CONFIG.PLAYER.SLOTS_WEAPONS; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.innerHTML =
        '<div class="slot-cd"></div>' +
        '<div class="slot-icon"></div>' +
        '<div class="slot-level"></div>';
      left.appendChild(el);
      this.weaponSlotEls.push(el);
    }
    for (let i = 0; i < CONFIG.PLAYER.SLOTS_ABILITIES; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.innerHTML =
        '<div class="slot-cd"></div>' +
        '<div class="slot-icon"></div>' +
        '<div class="slot-level"></div>';
      right.appendChild(el);
      this.abilitySlotEls.push(el);
    }
  },

  hideAll() {
    this.menuOverlay.classList.remove('active');
    this.pauseOverlay.classList.remove('active');
    this.levelOverlay.classList.remove('active');
    this.gameOverOverlay.classList.remove('active');
  },

  showPause() { this.hideAll(); this.pauseOverlay.classList.add('active'); },
  showMenu()  { this.hideAll(); this.menuOverlay.classList.add('active'); },
  showGameOver(stats) {
    this.hideAll();
    this.goTime.textContent  = stats.time;
    this.goKills.textContent = stats.kills;
    this.goLevel.textContent = stats.level;
    this.gameOverOverlay.classList.add('active');
  },

  /**
   * Показать карты левелапа.
   * @param {number} level — текущий уровень (для заголовка).
   * @param {Array} choices — массив "карт" из main.js (см. buildLevelUpChoices).
   * @param {function} onPick — колбэк выбора (передаётся выбранная карта).
   */
  showLevelUp(level, choices, onPick) {
    this.hideAll();
    this.lvlNum.textContent = level;
    this.cardsEl.innerHTML = '';
    if (choices.length === 0) {
      // На случай форс-мажора — кнопка "Продолжить"
      const el = document.createElement('div');
      el.className = 'card basic';
      el.innerHTML = '<div class="card-icon">★</div><div class="card-title">Продолжить</div><div class="card-desc">Все улучшения максимальны.</div>';
      el.addEventListener('click', () => onPick(null));
      this.cardsEl.appendChild(el);
    } else {
      choices.forEach((c) => {
        const el = document.createElement('div');
        el.className = 'card ' + (c.kind || 'basic');
        el.innerHTML =
          `<div class="card-icon">${c.icon || '★'}</div>` +
          `<div class="card-title">${c.title}</div>` +
          `<div class="card-desc">${c.desc}</div>`;
        el.addEventListener('click', () => onPick(c));
        this.cardsEl.appendChild(el);
      });
    }
    this.levelOverlay.classList.add('active');
  },

  /** Покадровое обновление HUD. */
  tick(game) {
    if (!game.player) return;
    const p = game.player;

    // HP
    const hpPct = Utils.clamp(p.hp / p.maxHp, 0, 1);
    this.hpFill.style.width = (hpPct * 100) + '%';
    this.hpLabel.textContent = `HP: ${Math.ceil(p.hp)}/${Math.ceil(p.maxHp)}`;

    // XP
    const xpPct = Utils.clamp(p.xp / p.xpNext, 0, 1);
    this.xpFill.style.width = (xpPct * 100) + '%';
    this.xpLabel.textContent = `Lv ${p.level}  XP: ${Math.floor(p.xp)}/${Math.floor(p.xpNext)}`;

    // Magic Missile cd (встроенная способность)
    const missTotal = CONFIG.MISSILE.COOLDOWN * p.missileCdMul;
    const missReady = 1 - (p.missileCd / Math.max(0.0001, missTotal));
    this.cdMissileFill.style.height = (Utils.clamp(missReady, 0, 1) * 100) + '%';

    // Слоты
    for (let i = 0; i < this.weaponSlotEls.length; i++) {
      this._renderWeaponSlot(this.weaponSlotEls[i], p.weaponSlots[i], p);
    }
    for (let i = 0; i < this.abilitySlotEls.length; i++) {
      this._renderAbilitySlot(this.abilitySlotEls[i], p.abilitySlots[i]);
    }

    // Счётчики
    this.killCount.textContent = `Убийств: ${game.kills}`;
    this.runTimer.textContent  = Utils.formatTime(game.runTime);
    if (game.state === 'playing' || game.state === 'paused' || game.state === 'levelup') {
      const next = Math.max(0, Math.ceil(game.waveTimer));
      this.waveInfo.textContent = `Волна ${game.waveIndex + 1} через ${next}с`;
    }
  },

  _renderWeaponSlot(el, weapon, player) {
    const iconEl = el.children[1];
    const levelEl = el.children[2];
    const cdEl   = el.children[0];
    if (!weapon) {
      el.classList.remove('filled');
      iconEl.textContent = '';
      levelEl.textContent = '';
      cdEl.style.height = '0%';
      return;
    }
    el.classList.add('filled');
    iconEl.textContent = weapon.icon || '?';
    levelEl.textContent = Utils.roman(weapon.level);
    // CD-заполнение: растёт от 0% до 100% по мере готовности
    const ready = weapon.readyProgress ? weapon.readyProgress(player) : 1;
    cdEl.style.height = (Utils.clamp(ready, 0, 1) * 100) + '%';
  },

  _renderAbilitySlot(el, ability) {
    const iconEl = el.children[1];
    const levelEl = el.children[2];
    const cdEl   = el.children[0];
    if (!ability) {
      el.classList.remove('filled');
      iconEl.textContent = '';
      levelEl.textContent = '';
      cdEl.style.height = '0%';
      return;
    }
    el.classList.add('filled');
    iconEl.textContent = ability.icon || '?';
    levelEl.textContent = Utils.roman(ability.level);
    cdEl.style.height = '100%'; // пассивки всегда "активны"
  },
};

window.UI = UI;

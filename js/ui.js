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

  // Шаг 3: оверлей сундука (создаётся динамически)
  chestOverlay: null,
  d20DieEl: null,
  chestPanelEl: null,         // контейнер для текущего "экрана" внутри overlay

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

    // Создать оверлей сундука (динамически, чтобы не трогать index.html)
    this._buildChestOverlay();
  },

  /** Сбор оверлея сундука: контейнер + общая 'панель', обновляемая под этап. */
  _buildChestOverlay() {
    const ov = document.createElement('div');
    ov.id = 'chestOverlay';
    ov.className = 'overlay';
    ov.innerHTML =
      '<div id="chestPanel" class="chest-panel"></div>';
    document.body.appendChild(ov);
    this.chestOverlay = ov;
    this.chestPanelEl = ov.querySelector('#chestPanel');
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
    if (this.chestOverlay) this.chestOverlay.classList.remove('active');
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
      // Шаг 6: информация о боссе
      if (window.Bosses && Bosses.isAlive()) {
        this.waveInfo.textContent = `⚔ БОСС ⚔`;
      } else if (window.Bosses && !Bosses.current && Bosses.bossIndex < BOSS_CONFIG.SPAWN_TIMES.length) {
        const bossIn = Math.max(0, Math.ceil(Bosses.nextSpawnTime - game.runTime));
        if (bossIn <= 30) {
          this.waveInfo.textContent += ` | Босс: ${bossIn}с`;
        }
      }
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


  /* ============================================================
     Шаг 3: окна сундука — d20-бросок, награда, эволюция.
     ============================================================ */

  /**
   * Анимированный бросок d20.
   * Показывает быстро меняющиеся цифры 1..20, затем фиксирует финальную
   * (анимация ~1.0–1.3 с). По завершении — onDone(finalRoll).
   */
  showD20Roll(finalRoll, onDone) {
    this.hideAll();
    this.chestPanelEl.innerHTML =
      '<div class="d20-title">СУНДУК</div>' +
      '<div class="d20-sub">Бросок d20…</div>' +
      '<div id="d20Die" class="d20-die">?</div>';
    this.chestOverlay.classList.add('active');
    const dieEl = this.chestPanelEl.querySelector('#d20Die');

    // Стадия 1: быстрая прокрутка (≈0.7 с, ~14 смен)
    let elapsed = 0;
    const rollDuration = 0.7;
    const tickStart = performance.now();
    const tick = () => {
      const now = performance.now();
      elapsed = (now - tickStart) / 1000;
      if (elapsed < rollDuration) {
        dieEl.textContent = String(1 + Math.floor(Math.random() * 20));
        // ускоряющееся затухание интервала
        const interval = 30 + (elapsed / rollDuration) * 90;
        setTimeout(tick, interval);
      } else {
        // Стадия 2: финал
        dieEl.textContent = String(finalRoll);
        dieEl.classList.add('final');
        // Цвет в зависимости от диапазона
        if (finalRoll >= 19)      dieEl.classList.add('crit');
        else if (finalRoll >= 11) dieEl.classList.add('good');
        else                       dieEl.classList.add('low');
        // Пауза, затем callback
        setTimeout(() => onDone && onDone(finalRoll), 700);
      }
    };
    tick();
  },

  /**
   * Окно с описанием результата (для бросков 1..10, либо когда вместо
   * эволюции выпала "разовая" награда). reward = { title, desc, kind }.
   * Кнопка "Забрать" закрывает окно.
   */
  showChestReward(roll, reward, onAccept) {
    this.hideAll();
    this.chestPanelEl.innerHTML =
      `<div class="d20-title">${reward.title || 'Награда'}</div>` +
      `<div class="d20-sub">Бросок: <span class="d20-mini ${this._rollClass(roll)}">${roll}</span></div>` +
      `<div class="reward-desc">${reward.desc || ''}</div>` +
      '<button id="chestOk" class="btn">Забрать</button>';
    this.chestOverlay.classList.add('active');
    this.chestPanelEl.querySelector('#chestOk').addEventListener('click', () => {
      this.hideAll();
      onAccept && onAccept();
    });
  },

  /**
   * Окно "карточка-выбор" (как левелап, но без увеличения уровня).
   * Используется для бросков 11..18.
   */
  showChestPick(roll, choices, onPick) {
    this.hideAll();
    let html =
      '<div class="d20-title">УЛУЧШЕНИЕ</div>' +
      `<div class="d20-sub">Бросок: <span class="d20-mini ${this._rollClass(roll)}">${roll}</span> — выберите карту</div>` +
      '<div id="chestCards" class="cards-row"></div>';
    this.chestPanelEl.innerHTML = html;
    const row = this.chestPanelEl.querySelector('#chestCards');
    if (!choices || choices.length === 0) {
      const el = document.createElement('div');
      el.className = 'card basic';
      el.innerHTML = '<div class="card-icon">★</div><div class="card-title">Продолжить</div><div class="card-desc">Нет доступных улучшений.</div>';
      el.addEventListener('click', () => { this.hideAll(); onPick && onPick(null); });
      row.appendChild(el);
    } else {
      choices.forEach((c) => {
        const el = document.createElement('div');
        el.className = 'card ' + (c.kind || 'basic');
        el.innerHTML =
          `<div class="card-icon">${c.icon || '★'}</div>` +
          `<div class="card-title">${c.title}</div>` +
          `<div class="card-desc">${c.desc}</div>`;
        el.addEventListener('click', () => { this.hideAll(); onPick && onPick(c); });
        row.appendChild(el);
      });
    }
    this.chestOverlay.classList.add('active');
  },

  /**
   * Окно эволюции: оружие + пассивка → результат.
   * onChoice(true) — принять, onChoice(false) — отказаться.
   * Если игрок отказывается, вызывающий код может предложить fallback (например,
   * обычное улучшение).
   */
  showEvolutionDialog(roll, pair, onChoice) {
    this.hideAll();
    const w = pair.weapon, a = pair.ability, r = pair.recipe;
    this.chestPanelEl.innerHTML =
      '<div class="d20-title">ЭВОЛЮЦИЯ!</div>' +
      `<div class="d20-sub">Бросок: <span class="d20-mini crit">${roll}</span></div>` +
      '<div class="evo-row">' +
        `<div class="evo-card"><div class="evo-icon">${w.icon}</div><div class="evo-name">${w.name}</div><div class="evo-lvl">ур. ${Utils.roman(w.level)}</div></div>` +
        '<div class="evo-plus">+</div>' +
        `<div class="evo-card"><div class="evo-icon">${a.icon}</div><div class="evo-name">${a.name}</div><div class="evo-lvl">ур. ${Utils.roman(a.level)}</div></div>` +
        '<div class="evo-arrow">→</div>' +
        `<div class="evo-card evo-result"><div class="evo-icon">${r.resultIcon}</div><div class="evo-name">${r.resultName}</div><div class="evo-desc">${r.desc}</div></div>` +
      '</div>' +
      '<div class="evo-buttons">' +
        '<button id="evoAccept" class="btn">Принять</button>' +
        '<button id="evoDecline" class="btn btn-secondary">Отказаться</button>' +
      '</div>';
    this.chestOverlay.classList.add('active');
    this.chestPanelEl.querySelector('#evoAccept').addEventListener('click', () => {
      this.hideAll();
      onChoice && onChoice(true);
    });
    this.chestPanelEl.querySelector('#evoDecline').addEventListener('click', () => {
      this.hideAll();
      onChoice && onChoice(false);
    });
  },

  _rollClass(roll) {
    if (roll >= 19) return 'crit';
    if (roll >= 11) return 'good';
    return 'low';
  },
};

window.UI = UI;

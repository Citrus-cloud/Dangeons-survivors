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
    if (this._campOverlay) this._campOverlay.classList.remove('active');
    if (this._talentOverlay) this._talentOverlay.classList.remove('active');
    if (this._guildOverlay) this._guildOverlay.classList.remove('active');
    if (this._resultsOverlay) this._resultsOverlay.classList.remove('active');
    if (this._dialogueOverlay) this._dialogueOverlay.classList.remove('active');
    if (this._victoryOverlay) this._victoryOverlay.classList.remove('active');
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

    // Шаг 15: золото в HUD
    this._updateGoldHUD(game);
    // Шаг 16: цель кампании в HUD
    this._updateCampaignObjectiveHUD(game);
    if (game.state === 'playing' || game.state === 'paused' || game.state === 'levelup') {
      const next = Math.max(0, Math.ceil(game.waveTimer));
      this.waveInfo.textContent = `Волна ${game.waveIndex + 1} через ${next}с`;
      // Шаг 6: информация о боссе (Шаг 14: поддержка обоих боссов)
      if (window.Bosses && Bosses.isAlive()) {
        this.waveInfo.textContent = `⚔ БОСС ⚔`;
      } else if (window.Bosses && !Bosses.current && Bosses.bossIndex < BOSS_CONFIG.SPAWN_TIMES.length) {
        const bossIn = Math.max(0, Math.ceil(Bosses.nextSpawnTime - game.runTime));
        if (bossIn <= 30) {
          this.waveInfo.textContent += ` | Босс: ${bossIn}с`;
        }
      }
      // Шаг 13: информация о портале
      if (game.portalSpawned && window.GameMap && GameMap.portal && GameMap.portal.active) {
        this.waveInfo.textContent = `⟐ ПОРТАЛ ОТКРЫТ ⟐`;
      } else if (window.PORTAL_CONFIG && game.mapTime != null) {
        const portalIn = Math.max(0, Math.ceil(PORTAL_CONFIG.APPEAR_TIME - game.mapTime));
        if (portalIn <= 60 && portalIn > 0) {
          this.waveInfo.textContent += ` | Портал: ${portalIn}с`;
        }
      }
    }
  },

  _renderWeaponSlot(el, weapon, player) {
    const iconEl = el.children[1];
    const levelEl = el.children[2];
    const cdEl   = el.children[0];
    if (!weapon) {
      el.classList.remove('filled', 'exclusive-slot', 'super-evolved-slot');
      iconEl.textContent = '';
      levelEl.textContent = '';
      cdEl.style.height = '0%';
      return;
    }
    el.classList.add('filled');
    // Exclusive/Super-evolved visual
    if (weapon.isSuperEvolved) { el.classList.add('super-evolved-slot'); el.classList.remove('exclusive-slot'); }
    else if (weapon.isExclusive) { el.classList.add('exclusive-slot'); el.classList.remove('super-evolved-slot'); }
    else { el.classList.remove('exclusive-slot', 'super-evolved-slot'); }
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
      el.classList.remove('slot-flash');
      iconEl.textContent = '';
      levelEl.textContent = '';
      cdEl.style.height = '0%';
      return;
    }
    el.classList.add('filled');
    iconEl.textContent = ability.icon || '?';
    levelEl.textContent = Utils.roman(ability.level);
    cdEl.style.height = '100%'; // пассивки всегда "активны"

    // Шаг 8: вспышка при повышении уровня (200 мс белая обводка)
    if (ability._flashUntil && ability._flashUntil > performance.now()) {
      el.classList.add('slot-flash');
    } else {
      el.classList.remove('slot-flash');
    }
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

  /**
   * Окно выбора из нескольких доступных эволюций.
   * Прокручиваемый список. Игрок выбирает одну.
   */
  showEvolutionChoice(roll, readyList, onChoice) {
    this.hideAll();
    let html =
      '<div class="d20-title">ЭВОЛЮЦИЯ!</div>' +
      `<div class="d20-sub">Бросок: <span class="d20-mini crit">${roll}</span> — выберите эволюцию</div>` +
      '<div id="evoChoiceList" class="evo-choice-list">';
    for (let i = 0; i < readyList.length; i++) {
      const p = readyList[i];
      const w = p.weapon, a = p.ability, r = p.recipe;
      html += `<div class="evo-choice-item" data-idx="${i}">` +
        `<span class="evo-choice-icon">${w.icon}</span>` +
        `<span class="evo-choice-plus">+</span>` +
        `<span class="evo-choice-icon">${a.icon}</span>` +
        `<span class="evo-choice-arrow">→</span>` +
        `<span class="evo-choice-result-icon">${r.resultIcon}</span>` +
        `<span class="evo-choice-name">${r.resultName}</span>` +
        `<span class="evo-choice-desc">${r.desc}</span>` +
      '</div>';
    }
    html += '</div>' +
      '<div class="evo-buttons">' +
        '<button id="evoDeclineAll" class="btn btn-secondary">Отказаться</button>' +
      '</div>';
    this.chestPanelEl.innerHTML = html;
    this.chestOverlay.classList.add('active');

    // Event listeners
    const list = this.chestPanelEl.querySelector('#evoChoiceList');
    list.addEventListener('click', (e) => {
      const item = e.target.closest('.evo-choice-item');
      if (!item) return;
      const idx = parseInt(item.dataset.idx);
      if (idx >= 0 && idx < readyList.length) {
        this.hideAll();
        onChoice && onChoice(readyList[idx]);
      }
    });
    this.chestPanelEl.querySelector('#evoDeclineAll').addEventListener('click', () => {
      this.hideAll();
      onChoice && onChoice(null);
    });
  },

  /**
   * Окно супер-эволюции: золотая рамка, особое оформление.
   */
  showSuperEvolutionDialog(roll, superReadyList, onChoice) {
    this.hideAll();
    let html =
      '<div class="d20-title super-evo-title">⭐ СУПЕР-ЭВОЛЮЦИЯ! ⭐</div>' +
      `<div class="d20-sub">Бросок: <span class="d20-mini crit">${roll}</span></div>` +
      '<div id="superEvoList" class="evo-choice-list super-evo-list">';
    for (let i = 0; i < superReadyList.length; i++) {
      const s = superReadyList[i];
      const excl = s.exclusive, evolved = s.evolved, r = s.recipe;
      html += `<div class="evo-choice-item super-evo-item" data-idx="${i}">` +
        `<span class="evo-choice-icon">${excl.icon}</span>` +
        `<span class="evo-choice-plus">+</span>` +
        `<span class="evo-choice-icon">${evolved.icon}</span>` +
        `<span class="evo-choice-arrow">→</span>` +
        `<span class="evo-choice-result-icon">${r.resultIcon}</span>` +
        `<span class="evo-choice-name">${r.resultName}</span>` +
        `<span class="evo-choice-desc">${r.desc}</span>` +
      '</div>';
    }
    html += '</div>' +
      '<div class="evo-buttons">' +
        '<button id="superEvoDecline" class="btn btn-secondary">Отказаться</button>' +
      '</div>';
    this.chestPanelEl.innerHTML = html;
    this.chestOverlay.classList.add('active');

    const list = this.chestPanelEl.querySelector('#superEvoList');
    list.addEventListener('click', (e) => {
      const item = e.target.closest('.super-evo-item');
      if (!item) return;
      const idx = parseInt(item.dataset.idx);
      if (idx >= 0 && idx < superReadyList.length) {
        this.hideAll();
        onChoice && onChoice(superReadyList[idx]);
      }
    });
    this.chestPanelEl.querySelector('#superEvoDecline').addEventListener('click', () => {
      this.hideAll();
      onChoice && onChoice(null);
    });
  },

  _rollClass(roll) {
    if (roll >= 19) return 'crit';
    if (roll >= 11) return 'good';
    return 'low';
  },

  /* ============================================================
     Шаг 15: Золото в HUD (отображение во время забега)
     ============================================================ */

  /** Обновить золото в HUD (вызывается из tick). */
  _updateGoldHUD(game) {
    if (!this._goldHudEl) {
      // Создать элемент при первом вызове
      const el = document.createElement('div');
      el.id = 'goldHud';
      el.className = 'gold-hud';
      el.innerHTML = '<span class="gold-icon">🪙</span><span class="gold-value">0</span>';
      const topLeft = document.querySelector('.hud-top-left');
      if (topLeft) topLeft.appendChild(el);
      this._goldHudEl = el;
      this._goldValueEl = el.querySelector('.gold-value');
    }
    const gold = game.runGold || 0;
    this._goldValueEl.textContent = gold;
  },

  /* ============================================================
     Шаг 15: Лагерь / Таверна (Camp screen)
     ============================================================ */

  showCamp() {
    this.hideAll();
    if (!this._campOverlay) this._buildCampOverlay();
    this._updateCampData();
    this._campOverlay.classList.add('active');
  },

  _buildCampOverlay() {
    const ov = document.createElement('div');
    ov.id = 'campOverlay';
    ov.className = 'overlay camp-overlay';
    ov.innerHTML = `
      <div class="camp-bg">
        <div class="camp-header">
          <h1 class="camp-title">DUNGEON SURVIVORS: D20</h1>
          <div class="camp-resources">
            <div class="camp-gold"><span class="gold-icon">🪙</span> <span id="campGoldVal">0</span></div>
            <div class="camp-rep"><span class="rep-icon">⚜</span> <span id="campRepVal">0</span> <span id="campGuildLvl">(Ур. 0)</span></div>
          </div>
        </div>
        <div class="camp-buttons">
          <button id="campStartBtn" class="btn camp-btn camp-btn-main">⚔ В ПОДЗЕМЕЛЬЕ</button>
          <button id="campCampaignBtn" class="btn camp-btn camp-btn-campaign">📜 СЮЖЕТ</button>
          <button id="campTalentsBtn" class="btn camp-btn">📖 Дерево талантов</button>
          <button id="campGuildBtn" class="btn camp-btn">⚜ Гильдия</button>
          <button id="campArsenalBtn" class="btn camp-btn camp-btn-disabled">🗡 Арсенал</button>
        </div>
        <div class="camp-stats">
          <div>Забегов: <span id="campTotalRuns">0</span></div>
          <div>Убийств: <span id="campTotalKills">0</span></div>
          <div>Лучшее время: <span id="campBestTime">00:00</span></div>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    this._campOverlay = ov;

    // Bindings
    ov.querySelector('#campStartBtn').addEventListener('click', () => {
      this.hideCamp();
      if (window.Game) Game.startNewGame();
    });
    ov.querySelector('#campCampaignBtn').addEventListener('click', () => {
      this.hideCamp();
      if (window.Campaign) Campaign.start();
    });
    ov.querySelector('#campTalentsBtn').addEventListener('click', () => {
      this.hideCamp();
      this.showTalents();
    });
    ov.querySelector('#campGuildBtn').addEventListener('click', () => {
      this.hideCamp();
      this.showGuild();
    });
    ov.querySelector('#campArsenalBtn').addEventListener('click', () => {
      // Заглушка
    });
  },

  _updateCampData() {
    if (!window.MetaProgress || !MetaProgress.data) return;
    const d = MetaProgress.data;
    const ov = this._campOverlay;
    ov.querySelector('#campGoldVal').textContent = d.gold;
    ov.querySelector('#campRepVal').textContent = d.reputation;
    ov.querySelector('#campGuildLvl').textContent = `(Ур. ${MetaProgress.getGuildLevel()})`;
    ov.querySelector('#campTotalRuns').textContent = d.totalRuns;
    ov.querySelector('#campTotalKills').textContent = d.totalKills;
    ov.querySelector('#campBestTime').textContent = Utils.formatTime(d.bestTime);

    // Шаг 16: обновить кнопку кампании
    const campBtn = ov.querySelector('#campCampaignBtn');
    if (campBtn && window.Campaign) {
      const progress = Campaign.loadProgress();
      if (progress.completed) {
        campBtn.textContent = '📜 НОВАЯ ИГРА+';
      } else if (progress.currentMap > 1) {
        campBtn.textContent = `📜 СЮЖЕТ (карта ${progress.currentMap}/5)`;
      } else {
        campBtn.textContent = '📜 СЮЖЕТ';
      }
    }
  },

  hideCamp() {
    if (this._campOverlay) this._campOverlay.classList.remove('active');
  },

  /* ============================================================
     Шаг 15: Дерево талантов (Talent Tree screen)
     ============================================================ */

  showTalents() {
    if (!this._talentOverlay) this._buildTalentOverlay();
    this._updateTalentData();
    this._talentOverlay.classList.add('active');
  },

  _buildTalentOverlay() {
    const ov = document.createElement('div');
    ov.id = 'talentOverlay';
    ov.className = 'overlay talent-overlay';
    ov.innerHTML = `
      <div class="talent-panel">
        <h1 class="talent-title">ДЕРЕВО ТАЛАНТОВ</h1>
        <div class="talent-gold"><span class="gold-icon">🪙</span> <span id="talentGoldVal">0</span></div>
        <div id="talentBranches" class="talent-branches"></div>
        <div class="talent-footer">
          <button id="talentResetBtn" class="btn btn-secondary">Сбросить (возврат 80%)</button>
          <button id="talentBackBtn" class="btn">Назад</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    this._talentOverlay = ov;

    ov.querySelector('#talentBackBtn').addEventListener('click', () => {
      this._talentOverlay.classList.remove('active');
      this.showCamp();
    });
    ov.querySelector('#talentResetBtn').addEventListener('click', () => {
      if (!window.MetaProgress) return;
      const refund = MetaProgress.resetTalents();
      this._updateTalentData();
    });
  },

  _updateTalentData() {
    if (!window.MetaProgress || !MetaProgress.data) return;
    const ov = this._talentOverlay;
    ov.querySelector('#talentGoldVal').textContent = MetaProgress.data.gold;

    const container = ov.querySelector('#talentBranches');
    container.innerHTML = '';

    for (const id of Object.keys(TALENT_CONFIG)) {
      const cfg = TALENT_CONFIG[id];
      const lvl = MetaProgress.data.talents[id] || 0;
      const cost = MetaProgress.getTalentCost(id);
      const canBuy = MetaProgress.data.gold >= cost && lvl < cfg.maxLevel;
      const maxed = lvl >= cfg.maxLevel;

      let starsHtml = '';
      for (let i = 0; i < cfg.maxLevel; i++) {
        starsHtml += `<span class="talent-star ${i < lvl ? 'filled' : ''}">${i < lvl ? '★' : '☆'}</span>`;
      }

      const row = document.createElement('div');
      row.className = 'talent-row';
      row.innerHTML = `
        <div class="talent-icon" style="color:${cfg.color}">${cfg.icon}</div>
        <div class="talent-info">
          <div class="talent-name">${cfg.name} <small>${cfg.subtitle}</small></div>
          <div class="talent-desc">${cfg.desc}</div>
          <div class="talent-stars">${starsHtml}</div>
        </div>
        <button class="btn talent-buy-btn ${canBuy ? '' : 'btn-disabled'}" data-talent="${id}">
          ${maxed ? 'МАКС' : '🪙 ' + cost}
        </button>
      `;
      container.appendChild(row);

      if (!maxed) {
        row.querySelector('.talent-buy-btn').addEventListener('click', () => {
          if (MetaProgress.upgradeTalent(id)) {
            this._updateTalentData();
          }
        });
      }
    }
  },

  /* ============================================================
     Шаг 15: Гильдия (Guild screen)
     ============================================================ */

  showGuild() {
    if (!this._guildOverlay) this._buildGuildOverlay();
    this._updateGuildData();
    this._guildOverlay.classList.add('active');
  },

  _buildGuildOverlay() {
    const ov = document.createElement('div');
    ov.id = 'guildOverlay';
    ov.className = 'overlay guild-overlay';
    ov.innerHTML = `
      <div class="guild-panel">
        <h1 class="guild-title">⚜ ГИЛЬДИЯ ИСКАТЕЛЕЙ ⚜</h1>
        <div class="guild-rep-bar-container">
          <div class="guild-rep-info"><span id="guildRepCur">0</span> / <span id="guildRepNext">100</span></div>
          <div class="guild-rep-bar"><div class="guild-rep-fill" id="guildRepFill"></div></div>
          <div id="guildLevelLabel" class="guild-level-label">Уровень 0</div>
        </div>
        <div id="guildRewards" class="guild-rewards"></div>
        <div class="guild-footer">
          <button id="guildBackBtn" class="btn">Назад</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    this._guildOverlay = ov;

    ov.querySelector('#guildBackBtn').addEventListener('click', () => {
      this._guildOverlay.classList.remove('active');
      this.showCamp();
    });
  },

  _updateGuildData() {
    if (!window.MetaProgress || !MetaProgress.data) return;
    const ov = this._guildOverlay;
    const rep = MetaProgress.data.reputation;
    const lvl = MetaProgress.getGuildLevel();
    const nextRep = MetaProgress.getNextLevelRep();

    ov.querySelector('#guildRepCur').textContent = rep;
    ov.querySelector('#guildRepNext').textContent = nextRep || 'МАКС';
    ov.querySelector('#guildLevelLabel').textContent = `Уровень ${lvl}`;

    // Прогресс-бар
    let pct = 0;
    if (nextRep) {
      const prevRep = lvl > 0 ? GUILD_CONFIG.levels[lvl - 1].rep : 0;
      pct = Math.min(100, ((rep - prevRep) / (nextRep - prevRep)) * 100);
    } else {
      pct = 100;
    }
    ov.querySelector('#guildRepFill').style.width = pct + '%';

    // Список наград
    const container = ov.querySelector('#guildRewards');
    container.innerHTML = '';
    for (let i = 0; i < GUILD_CONFIG.levels.length; i++) {
      const r = GUILD_CONFIG.levels[i];
      const unlocked = i < lvl;
      const row = document.createElement('div');
      row.className = 'guild-reward-row ' + (unlocked ? 'unlocked' : 'locked');
      row.innerHTML = `
        <span class="guild-reward-lvl">Ур. ${i + 1}</span>
        <span class="guild-reward-rep">${r.rep} реп.</span>
        <span class="guild-reward-desc">${r.reward}</span>
        <span class="guild-reward-check">${unlocked ? '✓' : '🔒'}</span>
      `;
      container.appendChild(row);
    }
  },

  /* ============================================================
     Шаг 15: Экран результатов забега (Run Results)
     ============================================================ */

  showRunResults(stats, onContinue) {
    this.hideAll();
    if (!this._resultsOverlay) this._buildResultsOverlay();
    const ov = this._resultsOverlay;

    ov.querySelector('#resTime').textContent = stats.time;
    ov.querySelector('#resKills').textContent = stats.kills;
    ov.querySelector('#resLevel').textContent = stats.level;
    ov.querySelector('#resGoldCollected').textContent = stats.goldCollected;
    ov.querySelector('#resGoldBonus').textContent = stats.goldBonus;
    ov.querySelector('#resGoldTotal').textContent = stats.goldTotal;
    ov.querySelector('#resRepGained').textContent = '+' + stats.repGained;

    // Замена обработчика
    const btn = ov.querySelector('#resToCampBtn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      this._resultsOverlay.classList.remove('active');
      onContinue && onContinue();
    });

    ov.classList.add('active');
  },

  _buildResultsOverlay() {
    const ov = document.createElement('div');
    ov.id = 'resultsOverlay';
    ov.className = 'overlay results-overlay';
    ov.innerHTML = `
      <div class="results-panel">
        <h1 class="results-title">ЗАБЕГ ОКОНЧЕН</h1>
        <div class="results-stats">
          <div class="res-row"><span>Время:</span><span id="resTime">00:00</span></div>
          <div class="res-row"><span>Убийств:</span><span id="resKills">0</span></div>
          <div class="res-row"><span>Уровень:</span><span id="resLevel">1</span></div>
          <div class="res-divider"></div>
          <div class="res-row gold-row"><span>🪙 Собрано:</span><span id="resGoldCollected">0</span></div>
          <div class="res-row gold-row"><span>🪙 Бонус за ур.:</span><span id="resGoldBonus">0</span></div>
          <div class="res-row gold-row total"><span>🪙 ИТОГО:</span><span id="resGoldTotal">0</span></div>
          <div class="res-row rep-row"><span>⚜ Репутация:</span><span id="resRepGained">+0</span></div>
        </div>
        <button id="resToCampBtn" class="btn camp-btn-main">Вернуться в лагерь</button>
      </div>
    `;
    document.body.appendChild(ov);
    this._resultsOverlay = ov;
  },

  /* ============================================================
     Шаг 15: перестроить слоты (вызывается при старте забега
     с учётом динамического количества слотов)
     ============================================================ */

  rebuildSlots(weaponCount, abilityCount) {
    const left  = document.getElementById('weaponSlots');
    const right = document.getElementById('abilitySlots');
    left.innerHTML = '';
    right.innerHTML = '';
    this.weaponSlotEls.length = 0;
    this.abilitySlotEls.length = 0;
    for (let i = 0; i < weaponCount; i++) {
      const el = document.createElement('div');
      el.className = 'slot';
      el.innerHTML =
        '<div class="slot-cd"></div>' +
        '<div class="slot-icon"></div>' +
        '<div class="slot-level"></div>';
      left.appendChild(el);
      this.weaponSlotEls.push(el);
    }
    for (let i = 0; i < abilityCount; i++) {
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

  /* ============================================================
     Шаг 16: Кампания — диалоги, цель в HUD, экран победы
     ============================================================ */

  /** Показать диалоговое окно кампании. */
  showCampaignDialogue(text, onClose) {
    this.hideAll();
    if (!this._dialogueOverlay) this._buildDialogueOverlay();
    const ov = this._dialogueOverlay;
    ov.querySelector('#dialogueText').textContent = text;
    ov.classList.add('active');

    const btn = ov.querySelector('#dialogueNextBtn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      ov.classList.remove('active');
      onClose && onClose();
    });

    // Авто-закрытие через 8 секунд
    clearTimeout(this._dialogueAutoClose);
    this._dialogueAutoClose = setTimeout(() => {
      if (ov.classList.contains('active')) {
        ov.classList.remove('active');
        onClose && onClose();
      }
    }, 8000);
  },

  _buildDialogueOverlay() {
    const ov = document.createElement('div');
    ov.id = 'dialogueOverlay';
    ov.className = 'overlay dialogue-overlay';
    ov.innerHTML = `
      <div class="dialogue-panel">
        <div class="dialogue-border"></div>
        <p id="dialogueText" class="dialogue-text"></p>
        <button id="dialogueNextBtn" class="btn dialogue-btn">Далее ➤</button>
      </div>
    `;
    document.body.appendChild(ov);
    this._dialogueOverlay = ov;
  },

  /** Показать экран победы кампании. */
  showCampaignVictory(text, onClose) {
    this.hideAll();
    if (!this._victoryOverlay) this._buildVictoryOverlay();
    const ov = this._victoryOverlay;
    ov.querySelector('#victoryText').textContent = text;
    ov.classList.add('active');

    const btn = ov.querySelector('#victoryBtn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => {
      ov.classList.remove('active');
      onClose && onClose();
    });
  },

  _buildVictoryOverlay() {
    const ov = document.createElement('div');
    ov.id = 'victoryOverlay';
    ov.className = 'overlay victory-overlay';
    ov.innerHTML = `
      <div class="victory-panel">
        <h1 class="victory-title">🐉 ПОБЕДА! 🐉</h1>
        <h2 class="victory-sub">Древний дракон повержен!</h2>
        <p id="victoryText" class="victory-text"></p>
        <div class="victory-rewards">
          <div>🪙 +1000 золота</div>
          <div>⚜ +200 репутации</div>
          <div>🏆 Достижение: Победитель дракона</div>
        </div>
        <button id="victoryBtn" class="btn camp-btn-main">В лагерь</button>
      </div>
    `;
    document.body.appendChild(ov);
    this._victoryOverlay = ov;
  },

  /** Отрисовка цели кампании в HUD (вызывается из tick). */
  _updateCampaignObjectiveHUD(game) {
    if (!window.Campaign || !Campaign.active || !Campaign.objective) {
      if (this._objectiveEl) this._objectiveEl.style.display = 'none';
      return;
    }

    if (!this._objectiveEl) {
      const el = document.createElement('div');
      el.id = 'campaignObjective';
      el.className = 'campaign-objective';
      const topRight = document.querySelector('.hud-top-right');
      if (topRight) topRight.appendChild(el);
      this._objectiveEl = el;
    }

    this._objectiveEl.style.display = 'block';
    const obj = Campaign.objective;
    let text = '';

    if (obj.completed) {
      text = '✓ Цель выполнена!';
      this._objectiveEl.className = 'campaign-objective completed';
    } else {
      this._objectiveEl.className = 'campaign-objective';
      text = Campaign.getObjectiveText();
    }

    this._objectiveEl.textContent = text;
  },

  /** Показать название карты кампании (при загрузке). */
  showCampaignMapName(name) {
    if (!this._mapNameEl) {
      const el = document.createElement('div');
      el.id = 'campaignMapName';
      el.className = 'campaign-map-name';
      document.body.appendChild(el);
      this._mapNameEl = el;
    }
    this._mapNameEl.textContent = name;
    this._mapNameEl.classList.add('visible');
    setTimeout(() => {
      this._mapNameEl.classList.remove('visible');
    }, 3000);
  },

  /* ============================================================
     Шаг 17: HUD-индикаторы для загадок и ловушек
     ============================================================ */

  /** Показать подсказку загадки в нижней части экрана (при приближении). */
  renderPuzzleHints(ctx, player, viewW, viewH) {
    if (!window.GameMap || !GameMap.dungeon || !player) return;

    // Руновые загадки — показываем прогресс если рядом
    if (GameMap.dungeon.runePuzzles) {
      for (const puzzle of GameMap.dungeon.runePuzzles) {
        if (puzzle.solved) continue;
        // Проверяем, в комнате ли игрок
        const room = puzzle.room;
        if (player.x >= room.x && player.x <= room.x + room.w &&
            player.y >= room.y && player.y <= room.y + room.h) {
          this._renderPuzzleProgress(ctx, viewW, viewH, puzzle, 'Руны активации');
          break;
        }
      }
    }

    // Плиты-шифры
    if (GameMap.dungeon.floorPuzzles) {
      for (const puzzle of GameMap.dungeon.floorPuzzles) {
        if (puzzle.solved) continue;
        const room = puzzle.room;
        if (player.x >= room.x && player.x <= room.x + room.w &&
            player.y >= room.y && player.y <= room.y + room.h) {
          this._renderPuzzleProgress(ctx, viewW, viewH, puzzle, 'Шифр');
          break;
        }
      }
    }
  },

  /** Отрисовать полоску прогресса загадки внизу экрана. */
  _renderPuzzleProgress(ctx, viewW, viewH, puzzle, label) {
    const seq = puzzle.sequence;
    const current = puzzle.currentStep;
    const total = seq.length;

    const barW = Math.min(300, total * 50);
    const barH = 36;
    const bx = (viewW - barW) / 2;
    const by = viewH - 60;

    // Фон
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(bx - 10, by - 8, barW + 20, barH + 16);
    ctx.strokeStyle = 'rgba(200, 180, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx - 10, by - 8, barW + 20, barH + 16);

    // Заголовок
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label + ' (' + current + '/' + total + ')', viewW / 2, by - 4);

    // Символы последовательности
    const slotW = barW / total;
    for (let i = 0; i < total; i++) {
      const sx = bx + i * slotW + slotW / 2;
      const sy = by + barH / 2 + 4;

      if (i < current) {
        // Выполнено — зелёный
        ctx.fillStyle = '#00ff88';
      } else if (i === current) {
        // Текущий — белый пульсирующий
        ctx.fillStyle = '#ffffff';
      } else {
        // Будущий — серый
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      }

      ctx.font = 'bold 16px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(seq[i].label, sx, sy);

      // Стрелка (если не последний)
      if (i < total - 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '12px ui-monospace, monospace';
        ctx.fillText('\u203A', sx + slotW / 2, sy);
      }
    }

    // Подсказка о failed
    if (puzzle.failed) {
      ctx.fillStyle = 'rgba(255, 50, 50, 0.9)';
      ctx.font = 'bold 12px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('Неверно! Сброс...', viewW / 2, by + barH + 12);
    }
  },

  /** Показать предупреждение о ловушке (валун и т.д.) — кратковременное сообщение. */
  showTrapWarning(message, color) {
    if (!this._trapWarnEl) {
      const el = document.createElement('div');
      el.id = 'trapWarning';
      el.className = 'trap-warning';
      document.body.appendChild(el);
      this._trapWarnEl = el;
    }
    this._trapWarnEl.textContent = message;
    this._trapWarnEl.style.color = color || '#ff6633';
    this._trapWarnEl.classList.add('visible');
    clearTimeout(this._trapWarnTimer);
    this._trapWarnTimer = setTimeout(() => {
      this._trapWarnEl.classList.remove('visible');
    }, 2000);
  },
};

window.UI = UI;


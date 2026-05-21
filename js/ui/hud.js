'use strict';
/* ============================================================
   hud.js — Пользовательский интерфейс (HUD, слоты, оверлеи).
   
   Содержит:
   • UI.init() — Привязка всех DOM-элементов
   • UI.tick(game) — Обновление HUD каждый кадр
   • UI.showLevelUp() / showPause() / showGameOver() — Оверлеи
   • UI.rebuildSlots() — Построение слотов оружия/пассивок
   • UI.showCamp() — Экран лагеря (мета-прогресс)
   • UI.hideAll() — Скрытие всех оверлеев
   
   Элементы HUD:
   - HP-бар (заполнение + числовое значение)
   - XP-бар (прогресс до следующего уровня)
   - Кулдаун Magic Missile
   - Счётчик убийств, таймер забега, номер волны
   - Слоты оружия (6 шт.) и пассивок (6 шт.)
   - Кнопка паузы
   
   Экспорт: window.UI
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

  /* ---- Утилита: применить спрайт к DOM-элементу (убирает дублирование) ---- */
  _applySprite(el, spriteCanvas, id) {
    if (!el) return;
    el.textContent = '';
    el.style.backgroundImage = 'url(' + spriteCanvas.toDataURL() + ')';
    el.style.backgroundSize = 'contain';
    el.style.backgroundRepeat = 'no-repeat';
    el.style.backgroundPosition = 'center';
    el.style.imageRendering = 'pixelated';
    el._spriteSet = id;
  },

  _clearSprite(el, fallbackIcon) {
    if (!el) return;
    el.style.backgroundImage = '';
    el.textContent = fallbackIcon || '';
    el._spriteSet = null;
  },

  /** Найти спрайт по id среди всех атласов. */
  _findSprite(id) {
    const ES = window.EVOLUTION_SPRITES;
    const WS = window.WEAPON_SPRITES;
    const AS = window.ABILITY_SPRITES;
    return (ES && ES[id]) || (WS && WS[id]) || (AS && AS[id]) || null;
  },

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
    if (this._settingsOverlay) this._settingsOverlay.classList.remove('active');
    if (this._mapSelectOverlay) this._mapSelectOverlay.classList.remove('active');
    // Расширенные оверлеи
    const extIds = ['classOverlay', 'bestiaryOverlay', 'codexOverlay', 'runStatsOverlay'];
    for (const id of extIds) {
      const el = document.getElementById(id);
      if (el) el.classList.remove('active');
    }
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
      el.innerHTML = '<div class="card-icon">★</div><div class="card-title">' + t('levelup_continue') + '</div><div class="card-desc">' + t('levelup_all_max') + '</div>';
      el.addEventListener('click', () => onPick(null));
      this.cardsEl.appendChild(el);
    } else {
      choices.forEach((c) => {
        const el = document.createElement('div');
        el.className = 'card ' + (c.kind || 'basic');
        // Build card content
        let levelHtml = '';
        if (c.kind === 'weapon' || c.kind === 'ability') {
          // Show level dots if it's an upgrade card
          const isUpgrade = c.title && c.title.includes('→');
          if (isUpgrade) {
            levelHtml = '<div class="card-level-indicator">▲</div>';
          } else {
            levelHtml = '<div class="card-level-indicator card-new">' + t('levelup_new') + '</div>';
          }
        }
        el.innerHTML =
          `<div class="card-icon">${c.icon || '★'}</div>` +
          levelHtml +
          `<div class="card-title">${c.title}</div>` +
          `<div class="card-desc">${c.desc}</div>`;
        // Шаг 2: пиксельный спрайт в карте левелапа
        const cardIconEl = el.querySelector('.card-icon');
        const spriteId = c.weaponId || c.abilityId || c.resultId || c.id;
        const spr = this._findSprite(spriteId);
        if (spr && cardIconEl) {
          this._applySprite(cardIconEl, spr, spriteId);
        }
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
    this.hpLabel.textContent = t('hud_hp', Math.ceil(p.hp), Math.ceil(p.maxHp));

    // XP
    const xpPct = Utils.clamp(p.xp / p.xpNext, 0, 1);
    this.xpFill.style.width = (xpPct * 100) + '%';
    this.xpLabel.textContent = t('hud_level', p.level || 1);

    // Magic Missile cd (встроенная способность) — только если не отключена
    if (p._noBuiltInMissile) {
      this.cdMissileFill.style.height = '0%';
      this.cdMissileFill.parentElement.style.display = 'none';
    } else {
      this.cdMissileFill.parentElement.style.display = '';
      const missTotal = CONFIG.MISSILE.COOLDOWN * p.missileCdMul;
      const missReady = 1 - (p.missileCd / Math.max(0.0001, missTotal));
      this.cdMissileFill.style.height = (Utils.clamp(missReady, 0, 1) * 100) + '%';
    }

    // Слоты
    for (let i = 0; i < this.weaponSlotEls.length; i++) {
      this._renderWeaponSlot(this.weaponSlotEls[i], p.weaponSlots[i], p);
    }
    for (let i = 0; i < this.abilitySlotEls.length; i++) {
      this._renderAbilitySlot(this.abilitySlotEls[i], p.abilitySlots[i]);
    }

    // Счётчики
    this.killCount.textContent = t('hud_kills', game.kills);
    this.runTimer.textContent  = Utils.formatTime(game.runTime);

    // Шаг 15: золото в HUD
    this._updateGoldHUD(game);
    // Шаг 16: цель кампании в HUD
    this._updateCampaignObjectiveHUD(game);
    if (game.state === 'playing' || game.state === 'paused' || game.state === 'levelup') {
      const next = Math.max(0, Math.ceil(game.waveTimer));
      this.waveInfo.textContent = t('hud_wave', game.waveIndex + 1, next);
      // Шаг 6: информация о боссе (Шаг 14: поддержка обоих боссов)
      if (window.Bosses && Bosses.isAlive()) {
        this.waveInfo.textContent = t('hud_boss');
      } else if (window.Bosses && !Bosses.current && Bosses.bossIndex < BOSS_CONFIG.SPAWN_TIMES.length) {
        const bossIn = Math.max(0, Math.ceil(Bosses.nextSpawnTime - game.runTime));
        if (bossIn <= 30) {
          this.waveInfo.textContent += ` | ${t('hud_boss_in', bossIn)}`;
        }
      }
      // Шаг 13: информация о портале
      if (game.portalSpawned && window.GameMap && GameMap.portal && GameMap.portal.active) {
        this.waveInfo.textContent = t('hud_portal_open');
      } else if (window.PORTAL_CONFIG && game.mapTime != null) {
        const portalIn = Math.max(0, Math.ceil(PORTAL_CONFIG.APPEAR_TIME - game.mapTime));
        if (portalIn <= 60 && portalIn > 0) {
          this.waveInfo.textContent += ` | ${t('hud_portal_in', portalIn)}`;
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
      this._clearSprite(iconEl);
      levelEl.textContent = '';
      cdEl.style.height = '0%';
      return;
    }
    el.classList.add('filled');
    if (weapon.isSuperEvolved) { el.classList.add('super-evolved-slot'); el.classList.remove('exclusive-slot'); }
    else if (weapon.isExclusive) { el.classList.add('exclusive-slot'); el.classList.remove('super-evolved-slot'); }
    else { el.classList.remove('exclusive-slot', 'super-evolved-slot'); }

    // Спрайт оружия
    const ES = window.EVOLUTION_SPRITES;
    const WS = window.WEAPON_SPRITES;
    const sprite = (ES && ES[weapon.id]) || (WS && WS[weapon.id]);
    if (sprite && iconEl._spriteSet !== weapon.id) {
      this._applySprite(iconEl, sprite, weapon.id);
    } else if (!sprite && iconEl._spriteSet) {
      this._clearSprite(iconEl, weapon.icon || '?');
    }

    levelEl.textContent = Utils.roman(weapon.level);
    const ready = weapon.readyProgress ? weapon.readyProgress(player) : 1;
    cdEl.style.height = (Utils.clamp(ready, 0, 1) * 100) + '%';
  },

  _renderAbilitySlot(el, ability) {
    const iconEl = el.children[1];
    const levelEl = el.children[2];
    const cdEl   = el.children[0];
    if (!ability) {
      el.classList.remove('filled', 'slot-flash');
      this._clearSprite(iconEl);
      levelEl.textContent = '';
      cdEl.style.height = '0%';
      return;
    }
    el.classList.add('filled');

    // Спрайт пассивки
    const AS = window.ABILITY_SPRITES;
    const sprite = AS ? AS[ability.id] : null;
    if (sprite && iconEl._spriteSet !== ability.id) {
      this._applySprite(iconEl, sprite, ability.id);
    } else if (!sprite && iconEl._spriteSet) {
      this._clearSprite(iconEl, ability.icon || '?');
    }

    levelEl.textContent = Utils.roman(ability.level);
    cdEl.style.height = '100%';

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
      '<div class="d20-title">' + t('chest_title') + '</div>' +
      '<div class="d20-sub">' + t('chest_rolling') + '</div>' +
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
      `<div class="d20-title">${reward.title || t('chest_reward_title')}</div>` +
      `<div class="d20-sub">${t('chest_roll_label')} <span class="d20-mini ${this._rollClass(roll)}">${roll}</span></div>` +
      `<div class="reward-desc">${reward.desc || ''}</div>` +
      '<button id="chestOk" class="btn">' + t('chest_accept') + '</button>';
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
      '<div class="d20-title">' + t('chest_upgrade_title') + '</div>' +
      `<div class="d20-sub">${t('chest_roll_label')} <span class="d20-mini ${this._rollClass(roll)}">${roll}</span> ${t('chest_pick_sub')}</div>` +
      '<div id="chestCards" class="cards-row"></div>';
    this.chestPanelEl.innerHTML = html;
    const row = this.chestPanelEl.querySelector('#chestCards');
    if (!choices || choices.length === 0) {
      const el = document.createElement('div');
      el.className = 'card basic';
      el.innerHTML = '<div class="card-icon">★</div><div class="card-title">' + t('levelup_continue') + '</div><div class="card-desc">' + t('chest_no_upgrades') + '</div>';
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
        // Применяем пиксельный спрайт (как в showLevelUp)
        const cardIconEl = el.querySelector('.card-icon');
        const spriteId = c.weaponId || c.abilityId || c.resultId || c.id;
        const spr = this._findSprite(spriteId);
        if (spr && cardIconEl) {
          this._applySprite(cardIconEl, spr, spriteId);
        }
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
      '<div class="d20-title">' + t('chest_evo_title') + '</div>' +
      `<div class="d20-sub">${t('chest_roll_label')} <span class="d20-mini crit">${roll}</span></div>` +
      '<div class="evo-row">' +
        `<div class="evo-card"><div class="evo-icon" data-sprite-id="${w.id}">${w.icon}</div><div class="evo-name">${w.name}</div><div class="evo-lvl">ур. ${Utils.roman(w.level)}</div></div>` +
        '<div class="evo-plus">+</div>' +
        `<div class="evo-card"><div class="evo-icon" data-sprite-id="${a.id}">${a.icon}</div><div class="evo-name">${a.name}</div><div class="evo-lvl">ур. ${Utils.roman(a.level)}</div></div>` +
        '<div class="evo-arrow">→</div>' +
        `<div class="evo-card evo-result"><div class="evo-icon" data-sprite-id="${r.resultId || ''}">${r.resultIcon}</div><div class="evo-name">${r.resultName}</div><div class="evo-desc">${r.desc}</div></div>` +
      '</div>' +
      '<div class="evo-buttons">' +
        '<button id="evoAccept" class="btn">' + t('chest_evo_accept') + '</button>' +
        '<button id="evoDecline" class="btn btn-secondary">' + t('chest_evo_decline') + '</button>' +
      '</div>';
    // Применяем спрайты к иконкам эволюции
    const evoIcons = this.chestPanelEl.querySelectorAll('.evo-icon[data-sprite-id]');
    for (const iconEl of evoIcons) {
      const spriteId = iconEl.getAttribute('data-sprite-id');
      if (!spriteId) continue;
      const WS = window.WEAPON_SPRITES;
      const AS = window.ABILITY_SPRITES;
      const ES = window.EVOLUTION_SPRITES;
      const spr = (ES && ES[spriteId]) || (WS && WS[spriteId]) || (AS && AS[spriteId]);
      if (spr) {
        iconEl.textContent = '';
        iconEl.style.backgroundImage = 'url(' + spr.toDataURL() + ')';
        iconEl.style.backgroundSize = 'contain';
        iconEl.style.backgroundRepeat = 'no-repeat';
        iconEl.style.backgroundPosition = 'center';
        iconEl.style.imageRendering = 'pixelated';
        iconEl.style.width = '32px';
        iconEl.style.height = '32px';
      }
    }
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
      '<div class="d20-title">' + t('chest_evo_title') + '</div>' +
      `<div class="d20-sub">${t('chest_roll_label')} <span class="d20-mini crit">${roll}</span> ${t('chest_evo_choose')}</div>` +
      '<div id="evoChoiceList" class="evo-choice-list">';
    for (let i = 0; i < readyList.length; i++) {
      const p = readyList[i];
      const w = p.weapon, a = p.ability, r = p.recipe;
      html += `<div class="evo-choice-item" data-idx="${i}">` +
        `<span class="evo-choice-icon" data-sprite-id="${w.id}">${w.icon}</span>` +
        `<span class="evo-choice-plus">+</span>` +
        `<span class="evo-choice-icon" data-sprite-id="${a.id}">${a.icon}</span>` +
        `<span class="evo-choice-arrow">→</span>` +
        `<span class="evo-choice-result-icon" data-sprite-id="${r.resultId}">${r.resultIcon}</span>` +
        `<span class="evo-choice-name">${r.resultName}</span>` +
        `<span class="evo-choice-desc">${r.desc}</span>` +
      '</div>';
    }
    html += '</div>' +
      '<div class="evo-buttons">' +
        '<button id="evoDeclineAll" class="btn btn-secondary">' + t('chest_evo_decline') + '</button>' +
      '</div>';
    this.chestPanelEl.innerHTML = html;
    this.chestOverlay.classList.add('active');

    // Apply sprites to evolution choice icons
    this._applySpriteIcons(this.chestPanelEl);

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
      '<div class="d20-title super-evo-title">' + t('chest_super_evo_title') + '</div>' +
      `<div class="d20-sub">${t('chest_roll_label')} <span class="d20-mini crit">${roll}</span></div>` +
      '<div id="superEvoList" class="evo-choice-list super-evo-list">';
    for (let i = 0; i < superReadyList.length; i++) {
      const s = superReadyList[i];
      const excl = s.exclusive, evolved = s.evolved, r = s.recipe;
      html += `<div class="evo-choice-item super-evo-item" data-idx="${i}">` +
        `<span class="evo-choice-icon" data-sprite-id="${excl.id}">${excl.icon}</span>` +
        `<span class="evo-choice-plus">+</span>` +
        `<span class="evo-choice-icon" data-sprite-id="${evolved.id}">${evolved.icon}</span>` +
        `<span class="evo-choice-arrow">→</span>` +
        `<span class="evo-choice-result-icon" data-sprite-id="${r.resultId}">${r.resultIcon}</span>` +
        `<span class="evo-choice-name">${r.resultName}</span>` +
        `<span class="evo-choice-desc">${r.desc}</span>` +
      '</div>';
    }
    html += '</div>' +
      '<div class="evo-buttons">' +
        '<button id="superEvoDecline" class="btn btn-secondary">' + t('chest_evo_decline') + '</button>' +
      '</div>';
    this.chestPanelEl.innerHTML = html;
    this.chestOverlay.classList.add('active');

    // Apply sprites to super-evolution choice icons
    this._applySpriteIcons(this.chestPanelEl);

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

  /** Apply pixel sprites to all elements with data-sprite-id within a container. */
  _applySpriteIcons(container) {
    const icons = container.querySelectorAll('[data-sprite-id]');
    for (const iconEl of icons) {
      const spriteId = iconEl.getAttribute('data-sprite-id');
      if (!spriteId) continue;
      const WS = window.WEAPON_SPRITES;
      const AS = window.ABILITY_SPRITES;
      const ES = window.EVOLUTION_SPRITES;
      const spr = (ES && ES[spriteId]) || (WS && WS[spriteId]) || (AS && AS[spriteId]);
      if (spr) {
        iconEl.textContent = '';
        iconEl.style.backgroundImage = 'url(' + spr.toDataURL() + ')';
        iconEl.style.backgroundSize = 'contain';
        iconEl.style.backgroundRepeat = 'no-repeat';
        iconEl.style.backgroundPosition = 'center';
        iconEl.style.imageRendering = 'pixelated';
        iconEl.style.display = 'inline-block';
        iconEl.style.minWidth = '24px';
        iconEl.style.minHeight = '24px';
      }
    }
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
        <h1 class="camp-title">${t('camp_title')}</h1>
        <div class="camp-tavern-name">${t('camp_tavern')}</div>
        <div class="camp-resources">
          <div class="camp-gold"><span class="gold-icon">🪙</span> <span id="campGoldVal">0</span></div>
          <div class="camp-rep"><span class="rep-icon">⚜</span> <span id="campRepVal">0</span> <span id="campGuildLvl">(${t('level_short')} 0)</span></div>
        </div>
        <div class="camp-buttons">
          <button id="campStartBtn" class="btn camp-btn camp-btn-main">${t('camp_start')}</button>
          <button id="campCampaignBtn" class="btn camp-btn camp-btn-campaign">${t('camp_campaign')}</button>
          <button id="campHeroBtn" class="btn camp-btn">${t('camp_hero')}</button>
          <button id="campTalentsBtn" class="btn camp-btn">${t('camp_talents')}</button>
          <button id="campGuildBtn" class="btn camp-btn">${t('camp_guild')}</button>
          <button id="campBestiaryBtn" class="btn camp-btn">${t('camp_bestiary')}</button>
          <button id="campCodexBtn" class="btn camp-btn">${t('camp_codex')}</button>
          <button id="campSettingsBtn" class="btn camp-btn">${t('camp_settings')}</button>
        </div>
        <div class="camp-stats">
          <div>${t('camp_runs', '<span id="campTotalRuns">0</span>')}</div>
          <div>${t('camp_total_kills', '<span id="campTotalKills">0</span>')}</div>
          <div>${t('camp_best_time', '<span id="campBestTime">00:00</span>')}</div>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    this._campOverlay = ov;

    // Bindings
    ov.querySelector('#campStartBtn').addEventListener('click', () => {
      this.hideCamp();
      this.showMapSelect();
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
    ov.querySelector('#campSettingsBtn').addEventListener('click', () => {
      this.hideCamp();
      this.showSettings();
    });
    // Новые кнопки: Выбор героя, Бестиарий, Книга
    ov.querySelector('#campHeroBtn').addEventListener('click', () => {
      this.hideCamp();
      if (window.UIExtended) UIExtended.showClassSelect(() => this.showCamp());
    });
    ov.querySelector('#campBestiaryBtn').addEventListener('click', () => {
      this.hideCamp();
      if (window.UIExtended) UIExtended.showBestiary(() => this.showCamp());
    });
    ov.querySelector('#campCodexBtn').addEventListener('click', () => {
      this.hideCamp();
      if (window.UIExtended) UIExtended.showCodex(() => this.showCamp());
    });
  },

  _updateCampData() {
    if (!window.MetaProgress || !MetaProgress.data) return;
    const d = MetaProgress.data;
    const ov = this._campOverlay;
    ov.querySelector('#campGoldVal').textContent = d.gold;
    ov.querySelector('#campRepVal').textContent = d.reputation;
    ov.querySelector('#campGuildLvl').textContent = `(${t('level_short')} ${MetaProgress.getGuildLevel()})`;
    ov.querySelector('#campTotalRuns').textContent = d.totalRuns;
    ov.querySelector('#campTotalKills').textContent = d.totalKills;
    ov.querySelector('#campBestTime').textContent = Utils.formatTime(d.bestTime);

    // Шаг 16: обновить кнопку кампании
    const campBtn = ov.querySelector('#campCampaignBtn');
    if (campBtn && window.Campaign) {
      const progress = Campaign.loadProgress();
      if (progress.completed) {
        campBtn.textContent = t('camp_campaign_plus');
      } else if (progress.currentMap > 1) {
        campBtn.textContent = t('camp_campaign_map', progress.currentMap);
      } else {
        campBtn.textContent = t('camp_campaign');
      }
    }
  },

  hideCamp() {
    if (this._campOverlay) this._campOverlay.classList.remove('active');
  },

  /* ============================================================
     Шаг 5 (новый): Экран выбора карты (биома)
     ============================================================ */

  _mapSelectOverlay: null,

  showMapSelect() {
    this.hideAll();
    if (!this._mapSelectOverlay) this._buildMapSelectOverlay();
    this._updateMapSelectHighlight();
    this._mapSelectOverlay.classList.add('active');
  },

  hideMapSelect() {
    if (this._mapSelectOverlay) this._mapSelectOverlay.classList.remove('active');
  },

  _buildMapSelectOverlay() {
    // Инициализируем превью если ещё не созданы
    if (window.initBiomePreviews && (!window.BIOME_PREVIEWS || Object.keys(BIOME_PREVIEWS).length === 0)) {
      initBiomePreviews();
    }

    const ov = document.createElement('div');
    ov.id = 'mapSelectOverlay';
    ov.className = 'overlay camp-overlay';

    // Описания биомов
    const BIOME_DESCRIPTIONS = {
      crypt: t('biome_desc_crypt'),
      ice_caves: t('biome_desc_ice_caves'),
      fire_mines: t('biome_desc_fire_mines'),
      forest_ruins: t('biome_desc_forest_ruins'),
      castle: t('biome_desc_castle'),
      sky_citadel: t('biome_desc_sky_citadel'),
      elven_forest: t('biome_desc_elven_forest'),
      mountain_keep: t('biome_desc_mountain_keep'),
    };

    // Сложность биомов (1–3 черепа)
    const BIOME_DIFFICULTY = {
      crypt: 1,
      ice_caves: 1,
      forest_ruins: 1,
      fire_mines: 2,
      castle: 2,
      elven_forest: 2,
      mountain_keep: 3,
      sky_citadel: 3,
    };

    let cardsHTML = '';
    const biomeList = window.BIOMES || [];
    for (const biome of biomeList) {
      const desc = BIOME_DESCRIPTIONS[biome.id] || '';
      const diff = BIOME_DIFFICULTY[biome.id] || 1;
      const skulls = '💀'.repeat(diff);
      cardsHTML += `
        <div class="map-card" data-biome="${biome.id}">
          <div class="map-card-preview" data-biome-preview="${biome.id}"></div>
          <div class="map-card-name">${biome.name}</div>
          <div class="map-card-desc">${desc}</div>
          <div class="map-card-diff">${skulls}</div>
        </div>
      `;
    }

    ov.innerHTML = `
      <div class="camp-bg map-select-bg">
        <h1 class="camp-title map-select-title">${t('map_select_title')}</h1>
        <div class="map-grid">${cardsHTML}</div>
        <div class="map-select-buttons">
          <button id="mapRandomBtn" class="btn camp-btn">${t('map_random')}</button>
          <button id="mapBackBtn" class="btn camp-btn">${t('map_back')}</button>
        </div>
      </div>
    `;

    document.body.appendChild(ov);
    this._mapSelectOverlay = ov;

    // Вставляем превью-канвасы
    const previewEls = ov.querySelectorAll('.map-card-preview');
    for (const el of previewEls) {
      const biomeId = el.getAttribute('data-biome-preview');
      if (window.BIOME_PREVIEWS && BIOME_PREVIEWS[biomeId]) {
        const img = BIOME_PREVIEWS[biomeId];
        el.style.backgroundImage = 'url(' + img.toDataURL() + ')';
        el.style.backgroundSize = 'cover';
        el.style.imageRendering = 'pixelated';
      }
    }

    // Клик по карточке
    const cards = ov.querySelectorAll('.map-card');
    for (const card of cards) {
      card.addEventListener('click', () => {
        const biomeId = card.getAttribute('data-biome');
        this.hideMapSelect();
        if (window.Game) Game.startNewGame(biomeId);
      });
    }

    // Случайная карта
    ov.querySelector('#mapRandomBtn').addEventListener('click', () => {
      const biomes = window.BIOMES || [];
      const randomBiome = biomes[Math.floor(Math.random() * biomes.length)];
      this.hideMapSelect();
      if (window.Game) Game.startNewGame(randomBiome ? randomBiome.id : 'crypt');
    });

    // Назад
    ov.querySelector('#mapBackBtn').addEventListener('click', () => {
      this.hideMapSelect();
      this.showCamp();
    });
  },

  /** Подсветить последний биом золотой рамкой */
  _updateMapSelectHighlight() {
    if (!this._mapSelectOverlay) return;
    const cards = this._mapSelectOverlay.querySelectorAll('.map-card');
    // Получаем последний биом из метапрогресса или из Game
    const lastBiome = (window.GameMap && GameMap.currentBiome)
      ? GameMap.currentBiome.id
      : (window.Game && Game.lastBiomeId) || 'crypt';
    for (const card of cards) {
      if (card.getAttribute('data-biome') === lastBiome) {
        card.classList.add('map-card-highlight');
      } else {
        card.classList.remove('map-card-highlight');
      }
    }
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
        <h1 class="talent-title">${t('talents_title')}</h1>
        <div class="talent-gold"><span class="gold-icon">🪙</span> <span id="talentGoldVal">0</span></div>
        <div id="talentGrid" class="talent-grid"></div>
        <div class="talent-footer">
          <button id="talentResetBtn" class="btn btn-secondary">${t('talents_reset')}</button>
          <button id="talentBackBtn" class="btn">${t('talents_back')}</button>
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
      if (confirm(t('talents_reset_confirm'))) {
        MetaProgress.resetTalents();
        this._updateTalentData();
      }
    });
  },

  _updateTalentData() {
    if (!window.MetaProgress || !MetaProgress.data) return;
    if (!window.TALENT_DEFS) return;
    const ov = this._talentOverlay;
    ov.querySelector('#talentGoldVal').textContent = MetaProgress.data.gold;

    const container = ov.querySelector('#talentGrid');
    container.innerHTML = '';

    for (const def of TALENT_DEFS) {
      const lvl = MetaProgress.data.talents[def.id] || 0;
      const cost = MetaProgress.getTalentCost(def.id);
      const canBuy = MetaProgress.data.gold >= cost && lvl < def.maxLevel;
      const maxed = lvl >= def.maxLevel;

      // Звёзды уровней
      let starsHtml = '';
      for (let i = 0; i < def.maxLevel; i++) {
        starsHtml += `<span class="talent-star ${i < lvl ? 'filled' : ''}">${i < lvl ? '★' : '☆'}</span>`;
      }

      // Текущий эффект
      const effectText = lvl > 0 ? def.effects[lvl - 1] : def.effects[0];

      const card = document.createElement('div');
      card.className = 'talent-card' + (maxed ? ' maxed' : '');
      card.innerHTML = `
        <div class="talent-card-icon">${def.icon}</div>
        <div class="talent-card-name">${def.name}</div>
        <div class="talent-card-stars">${starsHtml}</div>
        <div class="talent-card-effect">${lvl > 0 ? def.effects[lvl - 1] : def.description}</div>
        <button class="btn talent-buy-btn ${canBuy ? '' : 'btn-disabled'}">
          ${maxed ? t('talents_max') : '🪙 ' + cost}
        </button>
      `;
      container.appendChild(card);

      if (!maxed) {
        card.querySelector('.talent-buy-btn').addEventListener('click', () => {
          if (MetaProgress.upgradeTalent(def.id)) {
            this._updateTalentData();
          }
        });
      }
    }
  },

  /* ============================================================
     Шаг 4: Гильдия (полная переработка) — ранги, статистика, задания
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
      <div class="guild-panel-v2">
        <div class="guild-header-v2">
          <div class="guild-emblem">⚜</div>
          <h1 class="guild-title-v2">${t('guild_title')}</h1>
        </div>

        <div class="guild-rank-section">
          <div class="guild-rank-current">
            <span class="guild-rank-icon">🛡</span>
            <span id="guildRankName" class="guild-rank-name">${t('guild_rank_novice')}</span>
          </div>
          <div class="guild-rep-bar-v2">
            <div class="guild-rep-fill-v2" id="guildRepFillV2"></div>
            <div class="guild-rep-text-v2" id="guildRepTextV2">0 / 100</div>
          </div>
        </div>

        <div class="guild-tabs">
          <button class="guild-tab active" data-tab="ranks">${t('guild_tab_ranks')}</button>
          <button class="guild-tab" data-tab="stats">${t('guild_tab_stats')}</button>
          <button class="guild-tab" data-tab="quests">${t('guild_tab_quests')}</button>
        </div>

        <div class="guild-content" id="guildContent"></div>

        <div class="guild-footer-v2">
          <button id="guildBackBtnV2" class="btn">${t('guild_back')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    this._guildOverlay = ov;

    ov.querySelector('#guildBackBtnV2').addEventListener('click', () => {
      this._guildOverlay.classList.remove('active');
      this.showCamp();
    });

    // Табы
    ov.querySelectorAll('.guild-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        ov.querySelectorAll('.guild-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._renderGuildTab(tab.dataset.tab);
      });
    });
  },

  _updateGuildData() {
    if (!window.MetaProgress || !MetaProgress.data) return;
    const ov = this._guildOverlay;
    const rep = MetaProgress.data.reputation;
    const lvl = MetaProgress.getGuildLevel();
    const nextRep = MetaProgress.getNextLevelRep();
    const rankName = MetaProgress.getGuildRankName();

    ov.querySelector('#guildRankName').textContent = rankName + ' (' + t('level_short') + ' ' + lvl + ')';

    // Прогресс-бар
    let pct = 0;
    let repText = '';
    if (nextRep) {
      const prevRep = lvl > 0 ? GUILD_CONFIG.levels[lvl - 1].rep : 0;
      pct = Math.min(100, ((rep - prevRep) / (nextRep - prevRep)) * 100);
      repText = `${rep} / ${nextRep}`;
    } else {
      pct = 100;
      repText = `${rep} ${t('guild_max')}`;
    }
    ov.querySelector('#guildRepFillV2').style.width = pct + '%';
    ov.querySelector('#guildRepTextV2').textContent = repText;

    // Рендер активной вкладки
    const activeTab = ov.querySelector('.guild-tab.active');
    this._renderGuildTab(activeTab ? activeTab.dataset.tab : 'ranks');
  },

  _renderGuildTab(tab) {
    const content = this._guildOverlay.querySelector('#guildContent');
    if (tab === 'ranks') this._renderGuildRanks(content);
    else if (tab === 'stats') this._renderGuildStats(content);
    else if (tab === 'quests') this._renderGuildQuests(content);
  },

  /** Вкладка «Ранги» — прокручиваемый список рангов с наградами. */
  _renderGuildRanks(container) {
    if (!window.MetaProgress) return;
    const lvl = MetaProgress.getGuildLevel();
    let html = '<div class="guild-ranks-list">';
    for (let i = 0; i < GUILD_CONFIG.levels.length; i++) {
      const r = GUILD_CONFIG.levels[i];
      const reached = i < lvl;
      const current = i === lvl - 1;
      let cls = 'guild-rank-row';
      if (reached) cls += ' reached';
      if (current) cls += ' current';
      html += `<div class="${cls}">
        <div class="guild-rank-row-left">
          <span class="guild-rank-num">${i + 1}</span>
          <span class="guild-rank-row-name">${r.name}</span>
          <span class="guild-rank-row-rep">(${r.rep} ${t('guild_rep')})</span>
        </div>
        <div class="guild-rank-row-right">
          <span class="guild-rank-row-reward">${r.reward}</span>
          <span class="guild-rank-row-check">${reached ? '✓' : '🔒'}</span>
        </div>
      </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
  },

  /** Вкладка «Статистика» — общая статистика гильдии. */
  _renderGuildStats(container) {
    if (!window.MetaProgress || !MetaProgress.data) return;
    const d = MetaProgress.data;
    const gs = d.guildStats || {};
    const bestiaryStats = window.Bestiary ? Bestiary.getStats() : { unlocked: 0, total: 0 };
    const totalEnemyTypes = Object.keys(window.ENEMY_TYPES || {}).length;

    const stats = [
      { label: t('guild_stat_total_kills'), value: d.totalKills || 0 },
      { label: t('guild_stat_total_bosses'), value: d.totalBossKills || 0 },
      { label: t('guild_stat_bestiary'), value: `${bestiaryStats.unlocked} / ${totalEnemyTypes}` },
      { label: t('guild_stat_runs'), value: d.totalRuns || 0 },
      { label: t('guild_stat_best_time'), value: Utils.formatTime(d.bestTime || 0) },
      { label: t('guild_stat_best_kills'), value: d.bestKills || 0 },
      { label: t('guild_stat_reputation'), value: d.reputation || 0 },
    ];

    let html = '<div class="guild-stats-list">';
    for (const s of stats) {
      html += `<div class="guild-stats-row">
        <span class="guild-stats-label">${s.label}</span>
        <span class="guild-stats-value">${s.value}</span>
      </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
  },

  /** Вкладка «Задания» — ежедневные и еженедельные задания. */
  _renderGuildQuests(container) {
    if (!window.MetaProgress || !MetaProgress.data) {
      container.innerHTML = '<div class="guild-quests-empty">' + t('loading') + '</div>';
      return;
    }

    // Инициализировать задания если нужно
    MetaProgress.initGuildQuests();
    const quests = MetaProgress.getActiveQuests();

    let html = '<div class="guild-quests-section">';

    // Дневные
    html += '<div class="guild-quests-group-title">' + t('guild_daily_title') + '</div>';
    if (quests.daily.length === 0) {
      html += '<div class="guild-quest-empty">' + t('guild_no_quests') + '</div>';
    } else {
      for (const q of quests.daily) {
        html += this._renderQuestRow(q);
      }
    }

    // Недельные
    html += '<div class="guild-quests-group-title" style="margin-top:12px;">' + t('guild_weekly_title') + '</div>';
    if (quests.weekly.length === 0) {
      html += '<div class="guild-quest-empty">' + t('guild_no_quests') + '</div>';
    } else {
      for (const q of quests.weekly) {
        html += this._renderQuestRow(q);
      }
    }

    html += '</div>';
    container.innerHTML = html;

    // Привязка кнопок «Забрать»
    container.querySelectorAll('.guild-quest-claim-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = btn.dataset.questId;
        if (MetaProgress.claimQuestReward(qId)) {
          this._updateGuildData();
        }
      });
    });
  },

  /** Рендер строки задания. */
  _renderQuestRow(q) {
    const pct = Math.min(100, Math.round((q.progress / q.target) * 100));
    let statusHtml = '';
    if (q.claimed) {
      statusHtml = '<span class="guild-quest-done">' + t('guild_quest_done') + '</span>';
    } else if (q.completed) {
      statusHtml = `<button class="btn guild-quest-claim-btn" data-quest-id="${q.id}">${t('guild_quest_claim', q.repReward)}</button>`;
    } else {
      statusHtml = `<span class="guild-quest-progress-text">${q.progress}/${q.target}</span>`;
    }

    return `<div class="guild-quest-row ${q.completed ? 'completed' : ''} ${q.claimed ? 'claimed' : ''}">
      <div class="guild-quest-desc">${q.desc}</div>
      <div class="guild-quest-bar"><div class="guild-quest-bar-fill" style="width:${pct}%"></div></div>
      <div class="guild-quest-status">${statusHtml}</div>
    </div>`;
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

    // Защита от двойного вызова onClose
    let closed = false;
    const doClose = () => {
      if (closed) return;
      closed = true;
      clearTimeout(this._dialogueAutoClose);
      ov.classList.remove('active');
      onClose && onClose();
    };

    const btn = ov.querySelector('#dialogueNextBtn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', doClose);
    // Также закрывать при тапе/клике по панели (для мобильных)
    const panel = ov.querySelector('.dialogue-panel');
    if (panel) {
      const newPanel = panel.cloneNode(true);
      panel.parentNode.replaceChild(newPanel, panel);
      // Перепривязать кнопку после замены панели
      const innerBtn = newPanel.querySelector('#dialogueNextBtn');
      if (innerBtn) innerBtn.addEventListener('click', doClose);
      newPanel.addEventListener('click', (e) => {
        // Закрыть при клике на панель (не только на кнопку)
        doClose();
      });
    }

    // Авто-закрытие через 10 секунд (увеличено для чтения длинного текста)
    clearTimeout(this._dialogueAutoClose);
    this._dialogueAutoClose = setTimeout(() => {
      doClose();
    }, 10000);
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

    let closed = false;
    const doClose = () => {
      if (closed) return;
      closed = true;
      ov.classList.remove('active');
      onClose && onClose();
    };

    const btn = ov.querySelector('#victoryBtn');
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', doClose);
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
      text = t('campaign_objective_done');
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
          this._renderPuzzleProgress(ctx, viewW, viewH, puzzle, 'Rune Activation');
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
          this._renderPuzzleProgress(ctx, viewW, viewH, puzzle, 'Cipher');
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
      ctx.fillText('Wrong! Resetting...', viewW / 2, by + barH + 12);
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

  /* ============================================================
     Шаг 18: Настройки звука (Settings screen)
     ============================================================ */

  showSettings() {
    if (!this._settingsOverlay) this._buildSettingsOverlay();
    this._updateSettingsData();
    this._settingsOverlay.classList.add('active');
  },

  _buildSettingsOverlay() {
    const ov = document.createElement('div');
    ov.id = 'settingsOverlay';
    ov.className = 'overlay settings-overlay';
    ov.innerHTML = `
      <div class="settings-panel">
        <h1 class="settings-title">${t('settings_title')}</h1>
        <div class="settings-section">
          <div class="settings-row">
            <span class="settings-label">${t('settings_sfx')}</span>
            <input type="range" id="sfxVolumeSlider" class="settings-slider" min="0" max="100" value="70">
            <span id="sfxVolumeVal" class="settings-value">70%</span>
          </div>
          <div class="settings-row">
            <span class="settings-label">${t('settings_music')}</span>
            <input type="range" id="musicVolumeSlider" class="settings-slider" min="0" max="100" value="25">
            <span id="musicVolumeVal" class="settings-value">25%</span>
          </div>
          <div class="settings-row settings-row-btn">
            <button id="muteToggleBtn" class="btn settings-mute-btn">🔊</button>
          </div>
          <div class="settings-row settings-row-lang">
            <span class="settings-label">${t('settings_lang')}</span>
            <div class="lang-switcher">
              <button id="langRuBtn" class="btn lang-btn ${getLang() === 'ru' ? 'lang-btn-active' : ''}">RU</button>
              <button id="langEnBtn" class="btn lang-btn ${getLang() === 'en' ? 'lang-btn-active' : ''}">EN</button>
            </div>
          </div>
          <div class="settings-row settings-row-btn">
            <button id="resetProgressBtn" class="btn settings-reset-btn">🗑 ${t('settings_reset')}</button>
          </div>
        </div>
        <div class="settings-footer">
          <button id="settingsBackBtn" class="btn">${t('settings_back')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    this._settingsOverlay = ov;

    // SFX slider
    const sfxSlider = ov.querySelector('#sfxVolumeSlider');
    const sfxVal = ov.querySelector('#sfxVolumeVal');
    sfxSlider.addEventListener('input', () => {
      const v = parseInt(sfxSlider.value);
      sfxVal.textContent = v + '%';
      if (window.GameAudio) GameAudio.setSfxVolume(v / 100);
    });

    // Music slider
    const musicSlider = ov.querySelector('#musicVolumeSlider');
    const musicVal = ov.querySelector('#musicVolumeVal');
    musicSlider.addEventListener('input', () => {
      const v = parseInt(musicSlider.value);
      musicVal.textContent = v + '%';
      if (window.GameAudio) GameAudio.setMusicVolume(v / 100);
    });

    // Mute toggle
    ov.querySelector('#muteToggleBtn').addEventListener('click', () => {
      if (window.GameAudio) {
        GameAudio.toggleMute();
        this._updateMuteBtn();
      }
    });

    // Переключатель языка
    ov.querySelector('#langRuBtn').addEventListener('click', () => {
      setLang('ru');
      // Перестроить настройки для обновления текстов
      this._settingsOverlay.remove();
      this._settingsOverlay = null;
      this.showSettings();
    });
    ov.querySelector('#langEnBtn').addEventListener('click', () => {
      setLang('en');
      // Перестроить настройки для обновления текстов
      this._settingsOverlay.remove();
      this._settingsOverlay = null;
      this.showSettings();
    });

    // Reset progress
    ov.querySelector('#resetProgressBtn').addEventListener('click', () => {
      if (confirm(t('settings_reset_confirm'))) {
        try { localStorage.clear(); } catch(e) { /* Private Browsing */ }
        if (window.MetaProgress) MetaProgress.load();
        location.reload();
      }
    });

    // Back button
    ov.querySelector('#settingsBackBtn').addEventListener('click', () => {
      this._settingsOverlay.classList.remove('active');
      this.showCamp();
    });
  },

  _updateSettingsData() {
    if (!this._settingsOverlay || !window.GameAudio) return;
    const ov = this._settingsOverlay;
    const sfxSlider = ov.querySelector('#sfxVolumeSlider');
    const sfxVal = ov.querySelector('#sfxVolumeVal');
    const musicSlider = ov.querySelector('#musicVolumeSlider');
    const musicVal = ov.querySelector('#musicVolumeVal');

    const sfxPct = Math.round(GameAudio.sfxVolume * 100);
    const musicPct = Math.round(GameAudio.musicVolume * 100);

    sfxSlider.value = sfxPct;
    sfxVal.textContent = sfxPct + '%';
    musicSlider.value = musicPct;
    musicVal.textContent = musicPct + '%';

    this._updateMuteBtn();
  },

  _updateMuteBtn() {
    if (!this._settingsOverlay || !window.GameAudio) return;
    const btn = this._settingsOverlay.querySelector('#muteToggleBtn');
    if (GameAudio.muted) {
      btn.textContent = '🔇';
      btn.classList.add('muted');
    } else {
      btn.textContent = '🔊';
      btn.classList.remove('muted');
    }
  },
};

window.UI = UI;

'use strict';

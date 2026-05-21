'use strict';
/* ============================================================
   story-campaign.js — Сюжетный режим: 4-главная кампания.
   
   Архитектура:
   ─────────────
   STORY_CAMPAIGN — Определение структуры кампании (4 главы)
   StoryCampaignState — Текущее состояние прохождения
   StoryCampaign — Методы управления сюжетным режимом
   
   Главы:
   1. Катакомбы (Forgotten Catacombs) — первый осколок кристалла
   2. Проклятый лес (Cursed Forest) — второй осколок у друидов
   3. Горнило огня (Fire Crucible) — третий осколок
   4. Тронный зал тьмы (Throne of Darkness) — финальный босс
   
   Сохранение: SafeStorage ключ "campaign_save"
   
   Зависимости:
   SafeStorage, t(), LOCALE, GameMap, Bosses, MetaProgress,
   UI, Game, Particles
   
   Экспорт: window.STORY_CAMPAIGN, window.StoryCampaignState,
            window.StoryCampaign
   ============================================================ */

/* ============================================================
   STORY_CAMPAIGN — Структура кампании (4 главы)
   ============================================================ */
const STORY_CAMPAIGN = {
  chapters: [
    {
      id: 'catacombs',
      chapterNum: 1,
      name: 'chapter_1_name',           // ключ локализации
      description: 'chapter_1_desc',     // ключ локализации
      unlockCondition: null,             // первая глава открыта всегда
      mapData: 'chapter1',                // ключ в STORY_MAPS
      biomeId: 'catacombs',              // биом для визуальной темы
      bossId: 'boss_skeleton_knight',    // мини-босс главы
      requiredItems: ['crystal_shard_1'],// сюжетные предметы для сбора
      rewards: {
        gold: 300,
        reputation: 50,
        items: ['crystal_shard_1'],
        uniqueWeapon: 'bone_blade',
      },
      storyKeyBefore: 'story_chapter_1_intro',
      storyKeyAfter: 'story_chapter_1',
      waveConfig: {
        maxWaves: 8,
        enemyTypes: ['skeleton', 'archer', 'spider', 'ghost'],
        spawnRate: 1.0,
      },
    },
    {
      id: 'cursed_forest',
      chapterNum: 2,
      name: 'chapter_2_name',
      description: 'chapter_2_desc',
      unlockCondition: { completedChapter: 'catacombs' },
      mapData: 'chapter2',                // ключ в STORY_MAPS
      biomeId: 'cursed_forest',
      bossId: 'boss_ancient_ent',
      requiredItems: ['crystal_shard_2'],
      rewards: {
        gold: 500,
        reputation: 75,
        items: ['crystal_shard_2'],
        uniqueWeapon: 'vine_whip',
      },
      storyKeyBefore: 'story_chapter_2_intro',
      storyKeyAfter: 'story_chapter_2',
      waveConfig: {
        maxWaves: 10,
        enemyTypes: ['goblin', 'rotgolem', 'bat', 'spider'],
        spawnRate: 1.2,
      },
    },
    {
      id: 'fire_crucible',
      chapterNum: 3,
      name: 'chapter_3_name',
      description: 'chapter_3_desc',
      unlockCondition: { completedChapter: 'cursed_forest' },
      mapData: 'chapter3',                // ключ в STORY_MAPS
      biomeId: 'fire_crucible',
      bossId: 'boss_fire_lord',
      guardianBossId: 'boss_magma_giant',
      requiredItems: ['crystal_shard_3'],
      rewards: {
        gold: 700,
        reputation: 100,
        items: ['crystal_shard_3'],
        uniqueWeapon: 'flame_sword',
      },
      storyKeyBefore: 'story_chapter_3_intro',
      storyKeyAfter: 'story_chapter_3',
      waveConfig: {
        maxWaves: 12,
        enemyTypes: ['fire_elem', 'ooze', 'goblin', 'hell_hound'],
        spawnRate: 1.4,
      },
    },
    {
      id: 'throne_of_darkness',
      chapterNum: 4,
      name: 'chapter_4_name',
      description: 'chapter_4_desc',
      unlockCondition: { completedChapter: 'fire_crucible', requiredItems: ['crystal_shard_1', 'crystal_shard_2', 'crystal_shard_3'] },
      mapData: 'chapter4',                // ключ в STORY_MAPS
      biomeId: 'dark_throne',
      bossId: 'boss_dark_knight',        // мини-босс (страж)
      finalBossId: 'boss_ancient_dragon', // финальный босс
      miniBosses: ['boss_lich', 'boss_dark_knight'],
      requiredItems: [],
      unlockRequiresAll: ['crystal_shard_1', 'crystal_shard_2', 'crystal_shard_3'],
      rewards: {
        gold: 1500,
        reputation: 200,
        items: ['dragon_slayer_trophy'],
        uniqueWeapon: 'dragon_bane',
      },
      storyKeyBefore: 'story_chapter_4_intro',
      storyKeyAfter: 'story_chapter_4_victory',
      waveConfig: {
        maxWaves: 15,
        enemyTypes: ['shadow', 'captain', 'cultist', 'mage'],
        spawnRate: 1.6,
      },
    },
  ],

  /** Получить главу по ID */
  getChapter(chapterId) {
    return this.chapters.find(ch => ch.id === chapterId) || null;
  },

  /** Получить главу по номеру (1-based) */
  getChapterByNum(num) {
    return this.chapters.find(ch => ch.chapterNum === num) || null;
  },

  /** Получить все ID глав */
  getChapterIds() {
    return this.chapters.map(ch => ch.id);
  },
};


/* ============================================================
   StoryCampaignState — Текущее состояние прохождения
   ============================================================ */
const StoryCampaignState = {
  currentChapter: 1,                    // номер открытой главы (1-4)
  completedChapters: [],                // массив ID пройденных глав
  collectedItems: [],                   // массив ID собранных сюжетных предметов
  chapterProgress: {                    // прогресс внутри текущей главы
    bossesKilled: [],                   // ID убитых мини-боссов
    activatedRunes: 0,                  // количество активированных рун
    objectivesCompleted: [],            // завершённые подцели
    timeSpent: 0,                       // время на текущей главе (сек)
  },

  /** Сохранить состояние в SafeStorage */
  save() {
    const data = {
      currentChapter: this.currentChapter,
      completedChapters: this.completedChapters.slice(),
      collectedItems: this.collectedItems.slice(),
      chapterProgress: JSON.parse(JSON.stringify(this.chapterProgress)),
      savedAt: Date.now(),
    };
    try {
      SafeStorage.setItem('campaign_save', JSON.stringify(data));
    } catch (e) {
      console.warn('[StoryCampaign] Failed to save:', e);
    }
  },

  /** Загрузить состояние из SafeStorage */
  load() {
    try {
      const raw = SafeStorage.getItem('campaign_save');
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || typeof data.currentChapter !== 'number') return false;

      this.currentChapter = data.currentChapter;
      this.completedChapters = Array.isArray(data.completedChapters) ? data.completedChapters : [];
      this.collectedItems = Array.isArray(data.collectedItems) ? data.collectedItems : [];
      this.chapterProgress = data.chapterProgress || {
        bossesKilled: [],
        activatedRunes: 0,
        objectivesCompleted: [],
        timeSpent: 0,
      };
      return true;
    } catch (e) {
      console.warn('[StoryCampaign] Failed to load:', e);
      return false;
    }
  },

  /** Проверить наличие сохранения */
  hasSave() {
    try {
      const raw = SafeStorage.getItem('campaign_save');
      return raw !== null && raw !== '';
    } catch (e) {
      return false;
    }
  },

  /** Сбросить состояние */
  reset() {
    this.currentChapter = 1;
    this.completedChapters = [];
    this.collectedItems = [];
    this.chapterProgress = {
      bossesKilled: [],
      activatedRunes: 0,
      objectivesCompleted: [],
      timeSpent: 0,
    };
  },

  /** Удалить сохранение из хранилища */
  deleteSave() {
    try {
      SafeStorage.removeItem('campaign_save');
    } catch (e) { /* ignore */ }
  },
};


/* ============================================================
   StoryCampaign — Методы управления сюжетным режимом
   ============================================================ */
const StoryCampaign = {
  /** @type {boolean} Сюжетный режим активен */
  active: false,

  /** @type {boolean} Показывается ли сюжетная вставка */
  showingStory: false,

  /** @type {string|null} ID текущей главы */
  currentChapterId: null,

  /* ─────────── Управление кампанией ─────────── */

  /**
   * Начать новую игру — сбрасывает состояние, устанавливает главу 1.
   */
  startNewGame() {
    StoryCampaignState.reset();
    StoryCampaignState.deleteSave();
    StoryCampaignState.currentChapter = 1;
    StoryCampaignState.save();

    this.active = true;
    this.currentChapterId = 'catacombs';

    // Показать вступительный текст
    this._showStoryModal('story_intro', () => {
      this.startChapter('catacombs');
    });
  },

  /**
   * Продолжить игру — загружает сохранение и возвращает текущую главу.
   * @returns {Object|null} Текущая глава или null если нет сохранения
   */
  continueGame() {
    const loaded = StoryCampaignState.load();
    if (!loaded) return null;

    this.active = true;
    const chapter = STORY_CAMPAIGN.getChapterByNum(StoryCampaignState.currentChapter);
    if (!chapter) return null;

    this.currentChapterId = chapter.id;
    this.startChapter(chapter.id);
    return chapter;
  },

  /**
   * Начать главу — инициализирует карту главы через StaticMap.
   * @param {string} chapterId — ID главы
   */
  startChapter(chapterId) {
    const chapter = STORY_CAMPAIGN.getChapter(chapterId);
    if (!chapter) {
      console.warn('[StoryCampaign] Chapter not found:', chapterId);
      return;
    }

    this.active = true;
    this.currentChapterId = chapterId;
    StoryCampaignState.currentChapter = chapter.chapterNum;

    // Сброс прогресса главы
    StoryCampaignState.chapterProgress = {
      bossesKilled: [],
      activatedRunes: 0,
      objectivesCompleted: [],
      timeSpent: 0,
    };
    StoryCampaignState.save();

    // Показать вступительный текст главы
    const introKey = chapter.storyKeyBefore;
    const doStart = () => {
      this._initChapterMap(chapter);
    };

    if (introKey) {
      this._showStoryModal(introKey, doStart);
    } else {
      doStart();
    }
  },

  /**
   * Инициализация карты главы через StaticMap.
   * @param {Object} chapter — объект главы
   */
  _initChapterMap(chapter) {
    if (!window.Game) return;

    // Загружаем статическую карту из STORY_MAPS
    const mapKey = chapter.mapData;
    const mapData = (window.STORY_MAPS && STORY_MAPS[mapKey]) || null;

    if (mapData && window.StaticMap) {
      // Используем предопределённую карту
      const biome = { id: chapter.biomeId, name: t(chapter.name) };

      // Очистка перед загрузкой
      Game._clearAllPools && Game._clearAllPools();
      if (window.GameMap && GameMap.clearGroundEffects) GameMap.clearGroundEffects();
      if (window.Bosses) { Bosses.current = null; Bosses.guardian = null; }
      Game.chest = null; Game.secretChest = null; Game.bossChest = null;

      // Загружаем статическую карту
      StaticMap.load(mapData, biome);

      // Создаём/перемещаем игрока
      const startPos = StaticMap.getStartPosition();
      if (!Game.player || Game.player.hp <= 0) {
        Game.player = Player.create(startPos.x, startPos.y);
        if (window.UI) UI.rebuildSlots(Game.player.weaponSlots.length, Game.player.abilitySlots.length);
        Game.kills = 0;
        Game.runTime = 0;
        Game.waveIndex = 0;
        Game.runGold = 0;
        Game.bossKills = 0;
      } else {
        Game.player.x = startPos.x;
        Game.player.y = startPos.y;
      }

      // Настройка волн
      Game.waveTimer = CONFIG.WAVE.INITIAL_DELAY;
      Game.chestTimer = CONFIG.CHEST.FIRST_DELAY;
      Game.mapNumber = chapter.chapterNum;

      // Инициализация боссов
      if (window.Bosses && !Bosses.globalRotation.length) Bosses.init();

      // Переключить состояние
      if (window.UI) UI.hideAll();
      Game.state = 'playing';
      Game._storyCampaignActive = true;
      Game._storyCampaignChapter = chapter;

      // Спавн мини-босса по таймеру (30 сек)
      this._scheduleBossSpawn(chapter);

      // Показать название карты
      if (window.UI && UI.showCampaignMapName) {
        UI.showCampaignMapName(t(chapter.name));
      }
    } else {
      // Фоллбек: процедурная генерация (как раньше)
      Game.startNewGame && Game.startNewGame(chapter.biomeId);
      Game._storyCampaignActive = true;
      Game._storyCampaignChapter = chapter;
    }
  },

  /**
   * Запланировать спавн мини-босса.
   */
  _scheduleBossSpawn(chapter) {
    if (!chapter.bossId) return;
    setTimeout(() => {
      if (!this.active || this.currentChapterId !== chapter.id) return;
      if (window.StaticMap && StaticMap.active) {
        StaticMap.spawnMiniBoss(chapter.bossId);
      }
    }, 30000); // 30 секунд на исследование перед боссом
  },

  /**
   * Завершить главу — помечает как пройденную, выдаёт награды.
   * @param {string} chapterId — ID главы
   */
  completeChapter(chapterId) {
    const chapter = STORY_CAMPAIGN.getChapter(chapterId);
    if (!chapter) return;

    // Пометить главу как завершённую
    if (!StoryCampaignState.completedChapters.includes(chapterId)) {
      StoryCampaignState.completedChapters.push(chapterId);
    }

    // Собрать сюжетные предметы
    for (const item of chapter.requiredItems) {
      if (!StoryCampaignState.collectedItems.includes(item)) {
        StoryCampaignState.collectedItems.push(item);
      }
    }

    // Выдать награды
    this._grantRewards(chapter.rewards);

    // Обновить текущую главу
    const nextChapter = this.getNextChapter();
    if (nextChapter) {
      StoryCampaignState.currentChapter = nextChapter.chapterNum;
    }

    StoryCampaignState.save();

    // Показать сюжетную вставку
    const storyKey = chapter.storyKeyAfter;
    if (storyKey) {
      this._showStoryModal(storyKey, () => {
        this._showChapterCompleteScreen(chapter, () => {
          if (nextChapter) {
            // Переход к следующей главе
            this.startChapter(nextChapter.id);
          } else {
            // Кампания пройдена — возврат в таверну
            this._onCampaignComplete();
          }
        });
      });
    } else {
      this._showChapterCompleteScreen(chapter, () => {
        if (nextChapter) {
          this.startChapter(nextChapter.id);
        } else {
          this._onCampaignComplete();
        }
      });
    }
  },

  /**
   * Проверить, завершена ли глава.
   * @param {string} chapterId
   * @returns {boolean}
   */
  isChapterCompleted(chapterId) {
    return StoryCampaignState.completedChapters.includes(chapterId);
  },

  /**
   * Получить следующую главу или null если кампания пройдена.
   * @returns {Object|null}
   */
  getNextChapter() {
    const currentNum = StoryCampaignState.currentChapter;
    const nextNum = currentNum + 1;
    if (nextNum > STORY_CAMPAIGN.chapters.length) return null;
    return STORY_CAMPAIGN.getChapterByNum(nextNum);
  },

  /**
   * Получить текущую главу.
   * @returns {Object|null}
   */
  getCurrentChapter() {
    return STORY_CAMPAIGN.getChapterByNum(StoryCampaignState.currentChapter);
  },

  /**
   * Проверить, можно ли открыть главу (проверка unlockCondition).
   * @param {string} chapterId
   * @returns {boolean}
   */
  isChapterUnlocked(chapterId) {
    const chapter = STORY_CAMPAIGN.getChapter(chapterId);
    if (!chapter) return false;
    if (!chapter.unlockCondition) return true; // Нет условия — открыта

    const cond = chapter.unlockCondition;

    // Проверка: предыдущая глава завершена
    if (cond.completedChapter) {
      if (!StoryCampaignState.completedChapters.includes(cond.completedChapter)) {
        return false;
      }
    }

    // Проверка: собраны нужные предметы
    if (cond.requiredItems && Array.isArray(cond.requiredItems)) {
      for (const item of cond.requiredItems) {
        if (!StoryCampaignState.collectedItems.includes(item)) {
          return false;
        }
      }
    }

    return true;
  },

  /* ─────────── Обработка событий ─────────── */

  /**
   * Обновление каждый кадр (вызывается из game-loop).
   */
  update(dt) {
    if (!this.active) return;
    if (!window.Game || !Game.player) return;

    StoryCampaignState.chapterProgress.timeSpent += dt;

    // Обновляем статическую карту (триггеры, ловушки, руны)
    if (window.StaticMap && StaticMap.active) {
      StaticMap.update(dt, Game.player);
    }

    // Обновляем руна-баффы игрока
    this._updateRuneBuffs(Game.player, dt);
  },

  /**
   * Обновление руна-баффов.
   */
  _updateRuneBuffs(player, dt) {
    if (player._runeAttackTimer > 0) {
      player._runeAttackTimer -= dt;
      if (player._runeAttackTimer <= 0) player._runeAttackBuff = 0;
    }
    if (player._runeSpeedTimer > 0) {
      player._runeSpeedTimer -= dt;
      if (player._runeSpeedTimer <= 0) player._runeSpeedBuff = 0;
    }
    if (player._runeRegenTimer > 0) {
      player._runeRegenTimer -= dt;
      if (player._runeRegen) {
        player.hp = Math.min(player.maxHp, player.hp + player._runeRegen * dt);
      }
      if (player._runeRegenTimer <= 0) player._runeRegen = 0;
    }
    if (player._runeFireTimer > 0) {
      player._runeFireTimer -= dt;
      if (player._runeFireTimer <= 0) player._runeFireDmg = 0;
    }
    if (player._runeFireResistTimer > 0) {
      player._runeFireResistTimer -= dt;
      if (player._runeFireResistTimer <= 0) player._runeFireResist = 0;
    }
    if (player._runeShieldTimer > 0) {
      player._runeShieldTimer -= dt;
      if (player._runeShieldTimer <= 0) player._runeShield = 0;
    }
    if (player._tileSlowTimer > 0) {
      player._tileSlowTimer -= dt;
      if (player._tileSlowTimer <= 0) player._tileSlow = 0;
    }
  },

  /**
   * Вызывается когда мини-босс главы убит.
   * Проверяет условия завершения главы.
   */
  onBossDefeated(bossId) {
    if (!this.active) return;

    const chapter = STORY_CAMPAIGN.getChapter(this.currentChapterId);
    if (!chapter) return;

    // Записать убийство
    if (!StoryCampaignState.chapterProgress.bossesKilled.includes(bossId)) {
      StoryCampaignState.chapterProgress.bossesKilled.push(bossId);
    }

    // Проверить условие завершения главы
    if (chapter.bossId === bossId) {
      // Мини-босс главы убит — глава завершена
      // Для главы 4: нужно ещё убить финального босса
      if (chapter.finalBossId) {
        // Мини-босс убит, но нужен ещё финальный
        StoryCampaignState.save();
        return;
      }
      this.completeChapter(chapter.id);
    }

    // Финальный босс для главы 4
    if (chapter.finalBossId && chapter.finalBossId === bossId) {
      this.completeChapter(chapter.id);
    }
  },

  /**
   * Вызывается при смерти игрока в сюжетном режиме.
   * Сохраняет прогресс, деактивирует режим.
   */
  onPlayerDeath() {
    if (!this.active) return;
    StoryCampaignState.save();
    this.active = false;
    if (window.Game) Game._storyCampaignActive = false;
  },

  /**
   * Вызывается для возврата в таверну из сюжетного режима.
   */
  exitToTavern() {
    StoryCampaignState.save();
    this.active = false;
    if (window.Game) {
      Game._storyCampaignActive = false;
      Game.state = 'camp';
      if (window.UI) {
        UI.hideAll();
        UI.showCamp();
      }
    }
  },

  /* ─────────── Внутренние методы ─────────── */

  /**
   * Выдать награды за прохождение главы.
   * @param {Object} rewards — { gold, reputation, items }
   */
  _grantRewards(rewards) {
    if (!rewards) return;

    if (window.MetaProgress && MetaProgress.data) {
      if (rewards.gold) {
        MetaProgress.addGold(rewards.gold);
      }
      if (rewards.reputation) {
        MetaProgress.addReputation(rewards.reputation);
      }
      MetaProgress.save();
    }
  },

  /**
   * Показать модальное окно с сюжетной вставкой.
   * @param {string} storyKey — ключ локализации
   * @param {Function} onClose — колбэк после закрытия
   */
  _showStoryModal(storyKey, onClose) {
    this.showingStory = true;
    const text = t(storyKey);

    // Используем существующую систему диалогов если доступна
    if (window.UI && UI.showCampaignDialogue) {
      UI.showCampaignDialogue(text, () => {
        this.showingStory = false;
        onClose && onClose();
      });
      return;
    }

    // Фоллбек: создать модальное окно
    this._createStoryOverlay(text, () => {
      this.showingStory = false;
      onClose && onClose();
    });
  },

  /**
   * Создать оверлей сюжетной вставки (фоллбек).
   */
  _createStoryOverlay(text, onClose) {
    // Удалить предыдущий если есть
    const existing = document.getElementById('storyCampaignModal');
    if (existing) existing.remove();

    const ov = document.createElement('div');
    ov.id = 'storyCampaignModal';
    ov.className = 'overlay active';
    ov.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999;';
    ov.innerHTML = `
      <div class="story-modal-content" style="
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid #e2b347;
        border-radius: 12px;
        padding: 32px 24px;
        max-width: 480px;
        width: 90%;
        text-align: center;
        box-shadow: 0 0 40px rgba(226, 179, 71, 0.3);
      ">
        <div class="story-modal-icon" style="font-size: 2.5em; margin-bottom: 16px;">📜</div>
        <div class="story-modal-text" style="
          font-size: 1.1em;
          line-height: 1.6;
          color: #e8d5b7;
          margin-bottom: 24px;
          font-style: italic;
        ">${text}</div>
        <button class="btn story-modal-btn" style="
          background: linear-gradient(135deg, #e2b347, #c9952e);
          color: #1a1a2e;
          font-weight: bold;
          padding: 12px 32px;
          border: none;
          border-radius: 8px;
          font-size: 1em;
          cursor: pointer;
        ">${t('btn_continue')}</button>
      </div>
    `;
    document.body.appendChild(ov);

    ov.querySelector('.story-modal-btn').addEventListener('click', () => {
      ov.classList.remove('active');
      setTimeout(() => ov.remove(), 300);
      onClose && onClose();
    });
  },

  /**
   * Показать экран результатов главы с выбором улучшения.
   * @param {Object} chapter — объект главы
   * @param {Function} onContinue — колбэк для продолжения
   */
  _showChapterCompleteScreen(chapter, onContinue) {
    // Удалить предыдущий если есть
    const existing = document.getElementById('chapterCompleteModal');
    if (existing) existing.remove();

    const ov = document.createElement('div');
    ov.id = 'chapterCompleteModal';
    ov.className = 'overlay active';
    ov.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9998;';

    const rewardText = [];
    if (chapter.rewards.gold) rewardText.push(`🪙 ${chapter.rewards.gold}`);
    if (chapter.rewards.reputation) rewardText.push(`⚜ ${chapter.rewards.reputation}`);

    ov.innerHTML = `
      <div class="chapter-complete-content" style="
        background: linear-gradient(135deg, #1a2a1a 0%, #0d1f0d 100%);
        border: 2px solid #2ecc71;
        border-radius: 12px;
        padding: 32px 24px;
        max-width: 480px;
        width: 90%;
        text-align: center;
        box-shadow: 0 0 40px rgba(46, 204, 113, 0.3);
      ">
        <div style="font-size: 2em; margin-bottom: 12px;">🏆</div>
        <h2 style="color: #2ecc71; margin: 0 0 8px;">${t('chapter_complete_title')}</h2>
        <div style="color: #a8d8a8; font-size: 1.1em; margin-bottom: 16px;">${t(chapter.name)}</div>
        <div style="color: #ffd700; font-size: 1.2em; margin-bottom: 24px;">${rewardText.join('  ')}</div>
        <button class="btn chapter-complete-btn" style="
          background: linear-gradient(135deg, #2ecc71, #27ae60);
          color: #fff;
          font-weight: bold;
          padding: 12px 32px;
          border: none;
          border-radius: 8px;
          font-size: 1em;
          cursor: pointer;
        ">${t('btn_continue')}</button>
      </div>
    `;
    document.body.appendChild(ov);

    ov.querySelector('.chapter-complete-btn').addEventListener('click', () => {
      ov.classList.remove('active');
      setTimeout(() => ov.remove(), 300);
      // Показать экран выбора улучшения (как при левелапе) перед переходом
      this._showChapterUpgradeChoice(onContinue);
    });
  },

  /**
   * Показать экран выбора улучшения между главами (как при левелапе).
   * @param {Function} onDone — колбэк после выбора
   */
  _showChapterUpgradeChoice(onDone) {
    // Проверяем что есть Game и Player для применения улучшений
    if (!window.Game || !Game.player || !window.UI || !window.BASIC_UPGRADES) {
      onDone && onDone();
      return;
    }

    // Собираем 3 случайных улучшения
    const available = BASIC_UPGRADES.filter(u => u.available(Game.player));
    if (available.length === 0) {
      onDone && onDone();
      return;
    }

    // Шафл и выбрать 3
    const shuffled = available.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const choices = shuffled.slice(0, 3).map(u => ({
      id: u.id,
      icon: u.icon,
      title: u.title,
      desc: u.desc,
      kind: 'basic',
      _upgrade: u,
    }));

    // Используем стандартный UI левелапа
    UI.showLevelUp(Game.player.level || 1, choices, (picked) => {
      if (picked && picked._upgrade) {
        picked._upgrade.apply(Game.player);
      }
      UI.hideAll();
      onDone && onDone();
    });
  },

  /**
   * Обработка завершения всей кампании.
   */
  _onCampaignComplete() {
    this.active = false;
    if (window.Game) Game._storyCampaignActive = false;

    // Достижение
    if (window.MetaProgress && MetaProgress.data) {
      if (!MetaProgress.data.achievements) MetaProgress.data.achievements = [];
      if (!MetaProgress.data.achievements.includes('story_complete')) {
        MetaProgress.data.achievements.push('story_complete');
      }
      MetaProgress.save();
    }

    // Показать финальную сюжетную вставку и вернуться в таверну
    this._showStoryModal('story_chapter_4_victory', () => {
      if (window.Game) {
        Game.state = 'camp';
        if (window.UI) {
          UI.hideAll();
          UI.showCamp();
        }
      }
    });
  },

  /* ─────────── Утилиты для UI ─────────── */

  /**
   * Получить информацию о состоянии кампании для UI.
   * @returns {Object}
   */
  getUIState() {
    const hasSave = StoryCampaignState.hasSave();
    const currentChapter = this.getCurrentChapter();
    return {
      hasSave: hasSave,
      currentChapter: currentChapter,
      currentChapterNum: StoryCampaignState.currentChapter,
      completedChapters: StoryCampaignState.completedChapters.slice(),
      collectedItems: StoryCampaignState.collectedItems.slice(),
      totalChapters: STORY_CAMPAIGN.chapters.length,
      isComplete: StoryCampaignState.completedChapters.length >= STORY_CAMPAIGN.chapters.length,
    };
  },
};


/* ============================================================
   Экспорт
   ============================================================ */
window.STORY_CAMPAIGN = STORY_CAMPAIGN;
window.StoryCampaignState = StoryCampaignState;
window.StoryCampaign = StoryCampaign;

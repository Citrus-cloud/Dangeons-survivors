'use strict';
/* ============================================================
   story-campaign.js — Сюжетный режим: 4-главная кампания.
   Шаг 3: Полный игровой поток — переходы, сюжетные вставки,
   экраны наград, условия финального босса, сохранения.

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
   UI, Game, Particles, StaticMap, Monetization

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
      name: 'chapter_1_name',
      description: 'chapter_1_desc',
      unlockCondition: null,
      mapData: 'chapter1',
      biomeId: 'catacombs',
      bossId: 'boss_skeleton_knight',
      requiredItems: ['crystal_shard_1'],
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
      mapData: 'chapter2',
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
      mapData: 'chapter3',
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
      unlockCondition: {
        completedChapter: 'fire_crucible',
        requiredItems: ['crystal_shard_1', 'crystal_shard_2', 'crystal_shard_3'],
      },
      mapData: 'chapter4',
      biomeId: 'dark_throne',
      bossId: 'boss_dark_knight',
      finalBossId: 'boss_ancient_dragon',
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
  currentChapter: 1,
  completedChapters: [],
  collectedItems: [],
  chapterProgress: {
    bossesKilled: [],
    activatedRunes: 0,
    doorsOpened: [],
    keysCollected: [],
    objectivesCompleted: [],
    timeSpent: 0,
    crystalCollected: false,
    miniBossDefeated: false,
    finalGateOpen: false,
  },
  newGamePlusActive: false,
  newGamePlusBonus: 0,

  /** Сохранить состояние в SafeStorage */
  save() {
    const data = {
      currentChapter: this.currentChapter,
      completedChapters: this.completedChapters.slice(),
      collectedItems: this.collectedItems.slice(),
      chapterProgress: JSON.parse(JSON.stringify(this.chapterProgress)),
      newGamePlusActive: this.newGamePlusActive,
      newGamePlusBonus: this.newGamePlusBonus,
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
      this.newGamePlusActive = data.newGamePlusActive || false;
      this.newGamePlusBonus = data.newGamePlusBonus || 0;
      this.chapterProgress = data.chapterProgress || {
        bossesKilled: [],
        activatedRunes: 0,
        doorsOpened: [],
        keysCollected: [],
        objectivesCompleted: [],
        timeSpent: 0,
        crystalCollected: false,
        miniBossDefeated: false,
        finalGateOpen: false,
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
    this.newGamePlusActive = false;
    this.newGamePlusBonus = 0;
    this.chapterProgress = {
      bossesKilled: [],
      activatedRunes: 0,
      doorsOpened: [],
      keysCollected: [],
      objectivesCompleted: [],
      timeSpent: 0,
      crystalCollected: false,
      miniBossDefeated: false,
      finalGateOpen: false,
    };
  },

  /** Удалить сохранение из хранилища */
  deleteSave() {
    try { SafeStorage.removeItem('campaign_save'); } catch (e) { /* ignore */ }
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
  /** @type {boolean} Флаг isCampaignMode для движка */
  isCampaignMode: false,
  /** @type {boolean} Арена босса заблокирована */
  _bossArenaLocked: false,
  /** @type {number} Таймер перехода между главами */
  _transitionTimer: 0,
  /** @type {boolean} В процессе перехода */
  _transitioning: false,

  /* ─────────── Запуск кампании ─────────── */

  /**
   * Начать новую игру — сбрасывает состояние, устанавливает главу 1.
   */
  startNewGame() {
    StoryCampaignState.reset();
    StoryCampaignState.deleteSave();
    StoryCampaignState.currentChapter = 1;
    StoryCampaignState.save();

    this.active = true;
    this.isCampaignMode = true;
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
    this.isCampaignMode = true;
    const chapter = STORY_CAMPAIGN.getChapterByNum(StoryCampaignState.currentChapter);
    if (!chapter) return null;

    this.currentChapterId = chapter.id;
    this.startChapter(chapter.id);
    return chapter;
  },


  /**
   * Начать Новую Игру+. Сохраняет бонус к золоту.
   */
  startNewGamePlus() {
    StoryCampaignState.reset();
    StoryCampaignState.deleteSave();
    StoryCampaignState.currentChapter = 1;
    StoryCampaignState.newGamePlusActive = true;
    StoryCampaignState.newGamePlusBonus = 20; // +20% gold
    StoryCampaignState.save();

    this.active = true;
    this.isCampaignMode = true;
    this.currentChapterId = 'catacombs';
    this.startChapter('catacombs');
  },

  /**
   * Начать главу — основная точка входа.
   * @param {string} chapterId — ID главы
   */
  startChapter(chapterId) {
    const chapter = STORY_CAMPAIGN.getChapter(chapterId);
    if (!chapter) {
      console.warn('[StoryCampaign] Chapter not found:', chapterId);
      return;
    }

    this.active = true;
    this.isCampaignMode = true;
    this.currentChapterId = chapterId;
    this._bossArenaLocked = false;
    this._transitioning = false;
    StoryCampaignState.currentChapter = chapter.chapterNum;

    // Сброс прогресса главы (начинаем с нуля)
    StoryCampaignState.chapterProgress = {
      bossesKilled: [],
      activatedRunes: 0,
      doorsOpened: [],
      keysCollected: [],
      objectivesCompleted: [],
      timeSpent: 0,
      crystalCollected: false,
      miniBossDefeated: false,
      finalGateOpen: false,
    };
    StoryCampaignState.save();

    // Показать вступительный текст главы
    const introKey = chapter.storyKeyBefore;
    const doStart = () => { this._initChapterMap(chapter); };

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
      const biome = { id: chapter.biomeId, name: t(chapter.name) };

      // Очистка перед загрузкой
      if (Game._clearAllPools) Game._clearAllPools();
      if (window.GameMap && GameMap.clearGroundEffects) GameMap.clearGroundEffects();
      if (window.Bosses) { Bosses.current = null; Bosses.guardian = null; }
      Game.chest = null; Game.secretChest = null; Game.bossChest = null;

      // Загружаем статическую карту
      StaticMap.load(mapData, biome);

      // Передаём собранные ключи из предыдущих глав в StaticMap
      if (StoryCampaignState.collectedItems.length > 0) {
        for (const item of StoryCampaignState.collectedItems) {
          if (!StaticMap.collectedItems.includes(item)) {
            StaticMap.collectedItems.push(item);
          }
        }
      }

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

      // Монетизация: скрыть баннер при начале главы
      if (window.Monetization) Monetization.onRunStart();

      // Музыка биома
      if (window.GameAudio) GameAudio.playMusic(chapter.biomeId || 'crypt');

      // Спавн мини-босса по таймеру
      this._scheduleBossSpawn(chapter);

      // Показать название главы (анимация затемнения)
      this._showChapterTitle(chapter);
    } else {
      // Фоллбек: процедурная генерация
      if (Game.startNewGame) Game.startNewGame(chapter.biomeId);
      Game._storyCampaignActive = true;
      Game._storyCampaignChapter = chapter;
      this._showChapterTitle(chapter);
    }
  },


  /**
   * Показать заголовок главы с анимацией затемнения.
   */
  _showChapterTitle(chapter) {
    const existing = document.getElementById('chapterTitleOverlay');
    if (existing) existing.remove();

    const ov = document.createElement('div');
    ov.id = 'chapterTitleOverlay';
    ov.style.cssText = `
      position:fixed;inset:0;z-index:9990;
      display:flex;align-items:center;justify-content:center;flex-direction:column;
      background:rgba(0,0,0,0.85);pointer-events:none;
      opacity:1;transition:opacity 0.5s ease;
    `;
    ov.innerHTML = `
      <div style="color:#e2b347;font-size:1em;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;">
        ${t('chapter_label')} ${chapter.chapterNum}
      </div>
      <div style="color:#fff;font-size:1.8em;font-weight:bold;text-align:center;padding:0 16px;">
        ${t(chapter.name)}
      </div>
    `;
    document.body.appendChild(ov);

    // Затемнение 2 секунды, потом fadeout 0.5s
    setTimeout(() => { ov.style.opacity = '0'; }, 2000);
    setTimeout(() => { ov.remove(); }, 2500);
  },

  /**
   * Запланировать спавн мини-босса.
   */
  _scheduleBossSpawn(chapter) {
    if (!chapter.bossId) return;
    const delay = 30000; // 30 секунд
    setTimeout(() => {
      if (!this.active || this.currentChapterId !== chapter.id) return;
      if (StoryCampaignState.chapterProgress.miniBossDefeated) return;
      if (window.StaticMap && StaticMap.active) {
        StaticMap.spawnMiniBoss(chapter.bossId);
      }
    }, delay);
  },


  /* ─────────── Обновление каждый кадр ─────────── */

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

    // Проверка: босс-арена (блокировка выхода)
    this._updateBossArena(dt);

    // Проверка: врата к финальному боссу (глава 4)
    this._updateFinalGate(dt);

    // Синхронизируем собранные предметы из StaticMap
    if (window.StaticMap && StaticMap.collectedItems) {
      for (const item of StaticMap.collectedItems) {
        if (!StoryCampaignState.collectedItems.includes(item)) {
          StoryCampaignState.collectedItems.push(item);
          this._onItemCollected(item);
        }
      }
    }
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
   * Обновление босс-арены: блокировка выхода при бое.
   */
  _updateBossArena(dt) {
    if (!window.Bosses || !Bosses.current) {
      if (this._bossArenaLocked) {
        this._bossArenaLocked = false;
        // Открыть арену обратно
        this._unlockBossArena();
      }
      return;
    }
    // Босс жив — заблокировать арену
    if (!this._bossArenaLocked && Bosses.current.isCampaignBoss) {
      this._bossArenaLocked = true;
      this._lockBossArena();
    }
  },

  /** Заблокировать выход с босс-арены (стены). */
  _lockBossArena() {
    if (!window.StaticMap || !StaticMap.currentData || !StaticMap.currentData.bossArena) return;
    const ba = StaticMap.currentData.bossArena;
    const cs = StaticMap.currentData.tileSize || 20;
    const grid = GameMap.dungeon ? GameMap.dungeon.grid : null;
    if (!grid) return;
    const gw = GameMap.dungeon.gridW;
    // Блокируем входы в арену (верх и низ по краям)
    this._arenaBlockedTiles = [];
    for (let x = ba.x; x < ba.x + ba.w; x++) {
      for (const y of [ba.y, ba.y + ba.h - 1]) {
        const idx = y * gw + x;
        if (grid[idx] === 1) {
          grid[idx] = 0;
          this._arenaBlockedTiles.push(idx);
        }
      }
    }
    if (window.Particles && Game.player) {
      Particles.text(Game.player.x, Game.player.y - 40, t('boss_arena_locked'), 1.5, '#ff4444', 14);
    }
  },

  /** Разблокировать босс-арену. */
  _unlockBossArena() {
    if (!GameMap.dungeon || !this._arenaBlockedTiles) return;
    const grid = GameMap.dungeon.grid;
    for (const idx of this._arenaBlockedTiles) {
      grid[idx] = 1;
    }
    this._arenaBlockedTiles = [];
    if (window.Particles && Game.player) {
      Particles.text(Game.player.x, Game.player.y - 40, t('boss_arena_unlocked'), 1.5, '#2ecc71', 14);
    }
  },


  /**
   * Проверка условий для врат к финальному боссу (Глава 4).
   */
  _updateFinalGate(dt) {
    if (this.currentChapterId !== 'throne_of_darkness') return;
    if (StoryCampaignState.chapterProgress.finalGateOpen) return;
    if (!window.Game || !Game.player) return;

    // Проверяем наличие кристаллов
    const items = StoryCampaignState.collectedItems;
    const hasAllCrystals = items.includes('crystal_shard_1') &&
                           items.includes('crystal_shard_2') &&
                           items.includes('crystal_shard_3');

    // Проверяем что оба мини-босса убиты
    const progress = StoryCampaignState.chapterProgress;
    const bossesKilled = progress.bossesKilled;
    const lichKilled = bossesKilled.includes('boss_lich');
    const knightKilled = bossesKilled.includes('boss_dark_knight');

    // Проверяем, подошёл ли игрок к вратам
    if (!StaticMap || !StaticMap.currentData) return;
    const gatePos = this._getFinalGatePosition();
    if (!gatePos) return;

    const dx = Game.player.x - gatePos.x;
    const dy = Game.player.y - gatePos.y;
    const dist = dx * dx + dy * dy;
    const threshold = 60 * 60;

    if (dist < threshold) {
      if (hasAllCrystals && lichKilled && knightKilled) {
        // Открываем врата!
        StoryCampaignState.chapterProgress.finalGateOpen = true;
        this._openFinalGate();
        StoryCampaignState.save();
      } else {
        // Сообщение
        if (!this._gateMessageCooldown || this._gateMessageCooldown <= 0) {
          this._gateMessageCooldown = 5; // 5 сек кулдаун
          if (window.Particles) {
            Particles.text(Game.player.x, Game.player.y - 40, t('need_crystals'), 2.0, '#ff6600', 14);
          }
        }
      }
    }
    if (this._gateMessageCooldown > 0) this._gateMessageCooldown -= dt;
  },

  /** Получить позицию финальных врат */
  _getFinalGatePosition() {
    if (!StaticMap.currentData || !StaticMap.activeTriggers) return null;
    const gateTrigger = StaticMap.activeTriggers.find(tr => tr.kind === 'final_gate');
    if (gateTrigger) {
      const cs = StaticMap.currentData.tileSize || 20;
      return { x: gateTrigger.x * cs + cs, y: gateTrigger.y * cs + cs };
    }
    // Фоллбек — центр босс-арены
    if (StaticMap.currentData.bossArena) {
      const ba = StaticMap.currentData.bossArena;
      const cs = StaticMap.currentData.tileSize || 20;
      return { x: (ba.x + ba.w / 2) * cs, y: ba.y * cs };
    }
    return null;
  },

  /** Открыть финальные врата */
  _openFinalGate() {
    if (!window.StaticMap || !StaticMap.currentData) return;
    const cs = StaticMap.currentData.tileSize || 20;
    // Ищем триггер final_gate и открываем как дверь
    const gate = StaticMap.activeTriggers.find(tr => tr.kind === 'final_gate');
    if (gate) {
      gate._opened = true;
      StaticMap._openDoor(gate);
    }
    if (window.Particles && Game.player) {
      Particles.burst(Game.player.x, Game.player.y, 20, {
        color: '#ffd700', speedMin: 80, speedMax: 250,
        lifeMin: 0.5, lifeMax: 1.2, sizeMin: 4, sizeMax: 8,
      });
      Particles.text(Game.player.x, Game.player.y - 50, t('gate_opened'), 2.5, '#ffd700', 18);
    }
    if (window.GameAudio) GameAudio.playSfx('levelup');

    // Спавн финального босса после задержки
    const chapter = STORY_CAMPAIGN.getChapter(this.currentChapterId);
    if (chapter && chapter.finalBossId) {
      setTimeout(() => {
        if (!this.active) return;
        this._spawnFinalBoss(chapter.finalBossId);
      }, 3000);
    }
  },


  /** Спавн финального босса */
  _spawnFinalBoss(bossId) {
    if (!window.Bosses || !window.Game || !Game.player) return;
    const arena = (window.StaticMap && StaticMap.getBossArenaCenter) ? StaticMap.getBossArenaCenter() : null;
    const bx = arena ? arena.x : Game.player.x + 200;
    const by = arena ? arena.y : Game.player.y;
    const boss = Bosses._createBoss(bossId, Game.player, 'campaign', 0);
    if (boss) {
      boss.x = bx;
      boss.y = by;
      boss.isCampaignBoss = true;
      boss.isFinalBoss = true;
      Bosses.current = boss;
      Bosses._announcesBoss(boss.cfg.name);
      if (window.GameAudio) GameAudio.playMusic('boss');
    }
  },

  /* ─────────── Обработка событий ─────────── */

  /**
   * Вызывается при сборе сюжетного предмета.
   */
  _onItemCollected(itemId) {
    // Кристаллы — показать уведомление
    if (itemId.startsWith('crystal_shard_')) {
      StoryCampaignState.chapterProgress.crystalCollected = true;
      if (window.Particles && Game.player) {
        Particles.text(Game.player.x, Game.player.y - 40, t('crystal_collected'), 2.0, '#9b59b6', 16);
        Particles.burst(Game.player.x, Game.player.y, 12, {
          color: '#9b59b6', speedMin: 60, speedMax: 150,
          lifeMin: 0.5, lifeMax: 1.0, sizeMin: 3, sizeMax: 6,
        });
      }
      if (window.GameAudio) GameAudio.playSfx('levelup');
      StoryCampaignState.save();
    }
    // Ключи — отмечаем в прогрессе
    if (itemId.includes('_key')) {
      if (!StoryCampaignState.chapterProgress.keysCollected.includes(itemId)) {
        StoryCampaignState.chapterProgress.keysCollected.push(itemId);
      }
      StoryCampaignState.save();
    }
  },

  /**
   * Вызывается когда мини-босс главы убит.
   */
  onBossDefeated(bossId) {
    if (!this.active) return;

    const chapter = STORY_CAMPAIGN.getChapter(this.currentChapterId);
    if (!chapter) return;

    // Записать убийство
    if (!StoryCampaignState.chapterProgress.bossesKilled.includes(bossId)) {
      StoryCampaignState.chapterProgress.bossesKilled.push(bossId);
    }
    StoryCampaignState.chapterProgress.miniBossDefeated = true;
    StoryCampaignState.save();

    // Выдать кристалл при убийстве мини-босса (главы 1-3)
    if (chapter.requiredItems && chapter.requiredItems.length > 0 && chapter.chapterNum <= 3) {
      for (const item of chapter.requiredItems) {
        if (!StoryCampaignState.collectedItems.includes(item)) {
          StoryCampaignState.collectedItems.push(item);
          if (window.StaticMap) StaticMap.collectedItems.push(item);
          this._onItemCollected(item);
        }
      }
    }

    // Проверить условие завершения главы
    if (chapter.chapterNum <= 3) {
      // Главы 1-3: мини-босс убит + кристалл собран = глава пройдена
      const hasCrystal = chapter.requiredItems.every(
        item => StoryCampaignState.collectedItems.includes(item)
      );
      if (hasCrystal) {
        setTimeout(() => { this._onChapterVictory(); }, 2000);
      }
    }

    // Глава 4: финальный босс
    if (chapter.finalBossId && chapter.finalBossId === bossId) {
      setTimeout(() => { this._onChapterVictory(); }, 2000);
    }
  },


  /* ─────────── Смерть игрока ─────────── */

  /**
   * Вызывается при смерти игрока в сюжетном режиме.
   * Показывает экран смерти с возможностью воскрешения за рекламу.
   */
  onPlayerDeath() {
    if (!this.active) return;
    StoryCampaignState.save();
    // НЕ деактивируем кампанию — позволяем воскреснуть или вернуться
    // Rewarded video обрабатывается через стандартный Game.triggerGameOver()
    // Если игрок воскрешается — продолжаем с места смерти (через Monetization.handleRevive)
    // Если возвращается в лагерь — сбрасываем до начала главы
  },

  /**
   * Вызывается для возврата в таверну из сюжетного режима.
   * Прогресс главы сбрасывается до входа.
   */
  exitToTavern() {
    StoryCampaignState.save();
    this.active = false;
    this.isCampaignMode = false;
    if (window.StaticMap) StaticMap.deactivate();
    if (window.Game) {
      Game._storyCampaignActive = false;
      Game.state = 'camp';
      if (window.UI) { UI.hideAll(); UI.showCamp(); }
      if (window.GameAudio) GameAudio.playMusic('camp');
      // Монетизация: показать баннер и interstitial при возврате
      if (window.Monetization) Monetization.onMenuEnter();
    }
  },

  /* ─────────── Завершение главы ─────────── */

  /**
   * Последовательность завершения главы.
   * 1) Экран победы над боссом
   * 2) Сюжетная вставка
   * 3) Экран выбора улучшения (награда)
   * 4) completeChapter()
   * 5) Переход к следующей главе или финал
   */
  _onChapterVictory() {
    if (!this.active) return;
    const chapter = STORY_CAMPAIGN.getChapter(this.currentChapterId);
    if (!chapter) return;

    Game.state = 'dialogue'; // Пауза игры
    Input.releaseJoystick();

    // 1) Экран победы (имя босса + награды)
    this._showBossVictoryScreen(chapter, () => {
      // 2) Сюжетная вставка
      const storyKey = chapter.storyKeyAfter;
      const afterStory = () => {
        // 3) Экран выбора улучшения
        this._showChapterRewardScreen(chapter, () => {
          // 4) Пометить главу как пройденную
          this.completeChapter(chapter.id);
          // 5) Переход
          this._handlePostChapterTransition(chapter);
        });
      };

      if (storyKey) {
        this._showStoryModal(storyKey, afterStory);
      } else {
        afterStory();
      }
    });
  },


  /**
   * Экран победы над боссом.
   */
  _showBossVictoryScreen(chapter, onContinue) {
    const existing = document.getElementById('bossVictoryModal');
    if (existing) existing.remove();

    const bossName = chapter.bossId ? t('boss_' + chapter.bossId.replace('boss_', '')) : t('boss_defeated');
    const rewards = [];
    if (chapter.rewards.gold) rewards.push(`🪙 ${chapter.rewards.gold}`);
    if (chapter.rewards.reputation) rewards.push(`⚜ ${chapter.rewards.reputation}`);

    const ov = document.createElement('div');
    ov.id = 'bossVictoryModal';
    ov.className = 'overlay active';
    ov.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999;';
    ov.innerHTML = `
      <div style="
        background:linear-gradient(135deg,#1a2a1a,#0d1f0d);
        border:2px solid #2ecc71;border-radius:12px;padding:32px 24px;
        max-width:420px;width:90%;text-align:center;
        box-shadow:0 0 40px rgba(46,204,113,0.3);
      ">
        <div style="font-size:2.5em;margin-bottom:12px;">⚔</div>
        <h2 style="color:#2ecc71;margin:0 0 8px;">${t('boss_defeated_title')}</h2>
        <div style="color:#a8d8a8;font-size:1.1em;margin-bottom:8px;">${bossName}</div>
        <div style="color:#ffd700;font-size:1.2em;margin-bottom:24px;">${rewards.join('  ')}</div>
        <button class="btn" id="bossVictoryContinueBtn" style="
          background:linear-gradient(135deg,#2ecc71,#27ae60);color:#fff;
          font-weight:bold;padding:12px 32px;border:none;border-radius:8px;font-size:1em;cursor:pointer;
        ">${t('next')}</button>
      </div>
    `;
    document.body.appendChild(ov);
    ov.querySelector('#bossVictoryContinueBtn').addEventListener('click', () => {
      ov.classList.remove('active');
      setTimeout(() => ov.remove(), 300);
      onContinue && onContinue();
    });
  },

  /**
   * Экран выбора улучшения (награда за главу).
   * Использует существующий UI.showLevelUp с заголовком "Награда за главу".
   */
  _showChapterRewardScreen(chapter, onDone) {
    if (!window.Game || !Game.player || !window.UI || !window.BASIC_UPGRADES) {
      onDone && onDone();
      return;
    }

    // Собираем 4 случайных улучшения (больше чем обычно — это награда!)
    const choices = Game.buildLevelUpChoices ? Game.buildLevelUpChoices(4) : [];
    if (choices.length === 0) {
      onDone && onDone();
      return;
    }

    // Показываем экран с другим заголовком
    if (window.UI && UI.showLevelUp) {
      // Временно подменяем заголовок
      const lvlEl = document.getElementById('lvlNum');
      UI.showLevelUp(Game.player.level || 1, choices, (picked) => {
        if (picked) picked.apply(Game.player);
        UI.hideAll();
        onDone && onDone();
      });
      // Подменяем заголовок после рендера
      setTimeout(() => {
        if (lvlEl) lvlEl.textContent = t('chapter_reward');
      }, 50);
    } else {
      onDone && onDone();
    }
  },


  /**
   * Обработка перехода после завершения главы.
   */
  _handlePostChapterTransition(chapter) {
    if (chapter.chapterNum >= 4) {
      // Кампания пройдена!
      this._onCampaignComplete();
      return;
    }

    // Показать переход к следующей главе
    const nextChapter = this.getNextChapter();
    if (!nextChapter) {
      this._onCampaignComplete();
      return;
    }

    // Анимация затемнения + автопереход
    this._showChapterTransition(nextChapter, () => {
      // НЕ показываем interstitial между главами!
      this.startChapter(nextChapter.id);
    });
  },

  /**
   * Анимация перехода между главами.
   */
  _showChapterTransition(nextChapter, onDone) {
    const existing = document.getElementById('chapterTransitionOv');
    if (existing) existing.remove();

    const ov = document.createElement('div');
    ov.id = 'chapterTransitionOv';
    ov.style.cssText = `
      position:fixed;inset:0;z-index:9995;
      display:flex;align-items:center;justify-content:center;flex-direction:column;
      background:rgba(0,0,0,0);transition:background 0.5s ease;
    `;
    ov.innerHTML = `
      <div style="opacity:0;transition:opacity 0.5s ease 0.3s;text-align:center;" id="transitionText">
        <div style="color:#e2b347;font-size:0.9em;text-transform:uppercase;letter-spacing:3px;margin-bottom:8px;">
          ${t('chapter_label')} ${nextChapter.chapterNum}
        </div>
        <div style="color:#fff;font-size:1.6em;font-weight:bold;">
          ${t(nextChapter.name)}
        </div>
        <button class="btn" id="chapterTransContinueBtn" style="
          margin-top:24px;background:linear-gradient(135deg,#e2b347,#c9952e);
          color:#1a1a2e;font-weight:bold;padding:10px 28px;border:none;border-radius:8px;
          font-size:1em;cursor:pointer;opacity:0;transition:opacity 0.3s ease 0.8s;
        ">${t('next')}</button>
        <div style="margin-top:12px;">
          <button id="chapterTransTavernBtn" style="
            background:none;border:none;color:#999;font-size:0.85em;cursor:pointer;
            text-decoration:underline;opacity:0;transition:opacity 0.3s ease 1s;
          ">${t('return_to_tavern')}</button>
        </div>
      </div>
    `;
    document.body.appendChild(ov);

    // Fade in
    requestAnimationFrame(() => {
      ov.style.background = 'rgba(0,0,0,0.92)';
      const txt = ov.querySelector('#transitionText');
      if (txt) txt.style.opacity = '1';
      const btn = ov.querySelector('#chapterTransContinueBtn');
      if (btn) btn.style.opacity = '1';
      const tavernBtn = ov.querySelector('#chapterTransTavernBtn');
      if (tavernBtn) tavernBtn.style.opacity = '1';
    });

    ov.querySelector('#chapterTransContinueBtn').addEventListener('click', () => {
      ov.style.background = 'rgba(0,0,0,0)';
      ov.querySelector('#transitionText').style.opacity = '0';
      setTimeout(() => { ov.remove(); onDone && onDone(); }, 500);
    });

    ov.querySelector('#chapterTransTavernBtn').addEventListener('click', () => {
      ov.remove();
      this.exitToTavern();
    });
  },


  /**
   * Завершить главу — обновляет прогресс, выдаёт награды, сохраняет.
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
  },

  /**
   * Выдать награды за прохождение главы.
   */
  _grantRewards(rewards) {
    if (!rewards) return;
    const goldMul = StoryCampaignState.newGamePlusActive ? 1.20 : 1.0;
    if (window.MetaProgress && MetaProgress.data) {
      if (rewards.gold) MetaProgress.addGold(Math.floor(rewards.gold * goldMul));
      if (rewards.reputation) MetaProgress.addReputation(rewards.reputation);
      MetaProgress.save();
    }
  },

  /* ─────────── Завершение кампании ─────────── */

  _onCampaignComplete() {
    this.active = false;
    this.isCampaignMode = false;
    if (window.Game) Game._storyCampaignActive = false;
    if (window.StaticMap) StaticMap.deactivate();

    // Достижение
    if (window.MetaProgress && MetaProgress.data) {
      if (!MetaProgress.data.achievements) MetaProgress.data.achievements = [];
      if (!MetaProgress.data.achievements.includes('story_complete')) {
        MetaProgress.data.achievements.push('story_complete');
      }
      MetaProgress.save();
    }

    // Сохранить что кампания пройдена (для New Game+)
    StoryCampaignState.completedChapters = STORY_CAMPAIGN.getChapterIds();
    StoryCampaignState.save();

    // Показать поздравительный экран
    this._showCampaignCompleteScreen();
  },


  /**
   * Поздравительный экран после прохождения всей кампании.
   */
  _showCampaignCompleteScreen() {
    const existing = document.getElementById('campaignCompleteModal');
    if (existing) existing.remove();

    const ov = document.createElement('div');
    ov.id = 'campaignCompleteModal';
    ov.className = 'overlay active';
    ov.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999;';
    ov.innerHTML = `
      <div style="
        background:linear-gradient(135deg,#2a1a3e,#1a0a2e);
        border:2px solid #ffd700;border-radius:12px;padding:32px 24px;
        max-width:480px;width:90%;text-align:center;
        box-shadow:0 0 60px rgba(255,215,0,0.4);
      ">
        <div style="font-size:3em;margin-bottom:16px;">🏆</div>
        <h2 style="color:#ffd700;margin:0 0 12px;font-size:1.6em;">${t('congratulations')}</h2>
        <div style="color:#e8d5b7;font-size:1.1em;line-height:1.6;margin-bottom:24px;font-style:italic;">
          ${t('campaign_complete')}
        </div>
        <div style="color:#2ecc71;font-size:1em;margin-bottom:24px;">
          ${t('new_game_plus_unlocked')}
        </div>
        <button class="btn" id="campaignCompleteTavernBtn" style="
          background:linear-gradient(135deg,#ffd700,#e2b347);color:#1a1a2e;
          font-weight:bold;padding:12px 32px;border:none;border-radius:8px;
          font-size:1em;cursor:pointer;
        ">${t('return_to_tavern')}</button>
      </div>
    `;
    document.body.appendChild(ov);
    ov.querySelector('#campaignCompleteTavernBtn').addEventListener('click', () => {
      ov.classList.remove('active');
      setTimeout(() => ov.remove(), 300);
      if (window.Game) {
        Game.state = 'camp';
        if (window.UI) { UI.hideAll(); UI.showCamp(); }
        if (window.GameAudio) GameAudio.playMusic('camp');
        if (window.Monetization) Monetization.onMenuEnter();
      }
    });
  },

  /* ─────────── Утилиты ─────────── */

  /**
   * Проверить, завершена ли глава.
   */
  isChapterCompleted(chapterId) {
    return StoryCampaignState.completedChapters.includes(chapterId);
  },

  /**
   * Получить следующую главу или null если кампания пройдена.
   */
  getNextChapter() {
    const currentNum = StoryCampaignState.currentChapter;
    const nextNum = currentNum + 1;
    if (nextNum > STORY_CAMPAIGN.chapters.length) return null;
    return STORY_CAMPAIGN.getChapterByNum(nextNum);
  },

  /**
   * Получить текущую главу.
   */
  getCurrentChapter() {
    return STORY_CAMPAIGN.getChapterByNum(StoryCampaignState.currentChapter);
  },

  /**
   * Проверить, можно ли открыть главу.
   */
  isChapterUnlocked(chapterId) {
    const chapter = STORY_CAMPAIGN.getChapter(chapterId);
    if (!chapter) return false;
    if (!chapter.unlockCondition) return true;
    const cond = chapter.unlockCondition;
    if (cond.completedChapter) {
      if (!StoryCampaignState.completedChapters.includes(cond.completedChapter)) return false;
    }
    if (cond.requiredItems && Array.isArray(cond.requiredItems)) {
      for (const item of cond.requiredItems) {
        if (!StoryCampaignState.collectedItems.includes(item)) return false;
      }
    }
    return true;
  },

  /**
   * Проверить, пройдена ли вся кампания.
   */
  isCampaignComplete() {
    return StoryCampaignState.completedChapters.length >= STORY_CAMPAIGN.chapters.length;
  },


  /* ─────────── UI: Модальные окна ─────────── */

  /**
   * Показать модальное окно с сюжетной вставкой.
   */
  _showStoryModal(storyKey, onClose) {
    this.showingStory = true;
    const text = t(storyKey);

    if (window.UI && UI.showCampaignDialogue) {
      UI.showCampaignDialogue(text, () => {
        this.showingStory = false;
        onClose && onClose();
      });
      return;
    }

    // Фоллбек: создать собственное модальное окно
    const existing = document.getElementById('storyCampaignModal');
    if (existing) existing.remove();

    const ov = document.createElement('div');
    ov.id = 'storyCampaignModal';
    ov.className = 'overlay active';
    ov.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9999;';
    ov.innerHTML = `
      <div style="
        background:linear-gradient(135deg,#1a1a2e,#16213e);
        border:2px solid #e2b347;border-radius:12px;padding:32px 24px;
        max-width:480px;width:90%;text-align:center;
        box-shadow:0 0 40px rgba(226,179,71,0.3);
      ">
        <div style="font-size:2.5em;margin-bottom:16px;">📜</div>
        <div style="
          font-size:1.1em;line-height:1.6;color:#e8d5b7;
          margin-bottom:24px;font-style:italic;
        ">${text}</div>
        <button class="btn" id="storyModalBtn" style="
          background:linear-gradient(135deg,#e2b347,#c9952e);color:#1a1a2e;
          font-weight:bold;padding:12px 32px;border:none;border-radius:8px;
          font-size:1em;cursor:pointer;
        ">${t('next')}</button>
      </div>
    `;
    document.body.appendChild(ov);
    ov.querySelector('#storyModalBtn').addEventListener('click', () => {
      ov.classList.remove('active');
      setTimeout(() => ov.remove(), 300);
      this.showingStory = false;
      onClose && onClose();
    });
  },

  /* ─────────── UI: Экран выбора глав (Таверна) ─────────── */

  /**
   * Показать экран выбора главы кампании.
   */
  showChapterSelect(onBack) {
    const existing = document.getElementById('storyChapterSelect');
    if (existing) existing.remove();

    const ov = document.createElement('div');
    ov.id = 'storyChapterSelect';
    ov.className = 'overlay camp-overlay active';
    ov.style.cssText = 'display:flex;align-items:center;justify-content:center;z-index:9000;';

    let chaptersHtml = '';
    for (const ch of STORY_CAMPAIGN.chapters) {
      const unlocked = this.isChapterUnlocked(ch.id);
      const completed = this.isChapterCompleted(ch.id);
      const isCurrent = (StoryCampaignState.currentChapter === ch.chapterNum && !completed);

      let statusIcon = '🔒';
      let statusText = t('chapter_locked');
      let cardClass = 'chapter-card-locked';
      let clickable = false;

      if (completed) {
        statusIcon = '✅';
        statusText = t('replay_chapter');
        cardClass = 'chapter-card-complete';
        clickable = true;
      } else if (unlocked && isCurrent) {
        statusIcon = '⚔';
        statusText = t('play_chapter');
        cardClass = 'chapter-card-active';
        clickable = true;
      } else if (unlocked) {
        statusIcon = '⚔';
        statusText = t('play_chapter');
        cardClass = 'chapter-card-active';
        clickable = true;
      }

      chaptersHtml += `
        <div class="chapter-select-card ${cardClass}" data-chapter="${ch.id}" data-clickable="${clickable}">
          <div class="chapter-select-icon">${statusIcon}</div>
          <div class="chapter-select-num">${t('chapter_label')} ${ch.chapterNum}</div>
          <div class="chapter-select-name">${unlocked ? t(ch.name) : '???'}</div>
          <div class="chapter-select-status">${statusText}</div>
        </div>
      `;
    }


    // Кнопка Новая Игра+
    let ngPlusHtml = '';
    if (this.isCampaignComplete()) {
      ngPlusHtml = `
        <button id="newGamePlusBtn" class="btn" style="
          margin-top:16px;background:linear-gradient(135deg,#9b59b6,#8e44ad);
          color:#fff;font-weight:bold;padding:10px 24px;border:none;border-radius:8px;
          font-size:0.95em;cursor:pointer;
        ">🔄 ${t('new_game_plus')}</button>
      `;
    }

    ov.innerHTML = `
      <div style="
        background:linear-gradient(135deg,#1a1a2e,#0f0f1a);
        border:2px solid #e2b347;border-radius:12px;padding:24px 20px;
        max-width:520px;width:95%;max-height:90vh;overflow-y:auto;
        box-shadow:0 0 40px rgba(226,179,71,0.2);
      ">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
          <button id="chapterSelectBackBtn" class="btn bestiary-back-btn-compact" title="${t('btn_back')}">←</button>
          <h2 style="color:#e2b347;flex:1;text-align:center;margin:0;font-size:1.3em;">📜 ${t('story_title')}</h2>
        </div>
        <div id="chapterSelectGrid" style="display:flex;flex-direction:column;gap:12px;">
          ${chaptersHtml}
        </div>
        ${ngPlusHtml}
      </div>
    `;
    document.body.appendChild(ov);

    // Обработчики
    ov.querySelector('#chapterSelectBackBtn').addEventListener('click', () => {
      ov.remove();
      onBack && onBack();
    });

    ov.querySelectorAll('.chapter-select-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.dataset.clickable !== 'true') return;
        const chId = card.dataset.chapter;
        ov.remove();
        this.startChapter(chId);
      });
    });

    if (ov.querySelector('#newGamePlusBtn')) {
      ov.querySelector('#newGamePlusBtn').addEventListener('click', () => {
        ov.remove();
        this.startNewGamePlus();
      });
    }
  },


  /* ─────────── Информация для UI ─────────── */

  /**
   * Получить информацию о состоянии кампании для UI.
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
      isComplete: this.isCampaignComplete(),
      newGamePlusActive: StoryCampaignState.newGamePlusActive,
    };
  },
};


/* ============================================================
   Экспорт
   ============================================================ */
window.STORY_CAMPAIGN = STORY_CAMPAIGN;
window.StoryCampaignState = StoryCampaignState;
window.StoryCampaign = StoryCampaign;

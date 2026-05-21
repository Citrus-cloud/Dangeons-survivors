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
      mapData: null,                     // будет заполнено на шаге 2
      biomeId: 'crypt',                  // биом для генерации карты
      bossId: 'boss_skeleton_knight',    // мини-босс главы
      requiredItems: ['crystal_shard_1'],// сюжетные предметы для сбора
      rewards: {
        gold: 300,
        reputation: 50,
        items: ['crystal_shard_1'],
      },
      storyKeyAfter: 'story_chapter_1', // ключ сюжетной вставки после главы
      waveConfig: {                      // конфигурация волн (для шага 2)
        maxWaves: 8,
        enemyTypes: ['skeleton', 'zombie', 'ghost', 'bone_crawler'],
        spawnRate: 1.0,
      },
    },
    {
      id: 'cursed_forest',
      chapterNum: 2,
      name: 'chapter_2_name',
      description: 'chapter_2_desc',
      unlockCondition: { completedChapter: 'catacombs' },
      mapData: null,
      biomeId: 'forest_ruins',
      bossId: 'boss_ancient_ent',
      requiredItems: ['crystal_shard_2'],
      rewards: {
        gold: 500,
        reputation: 75,
        items: ['crystal_shard_2'],
      },
      storyKeyAfter: 'story_chapter_2',
      waveConfig: {
        maxWaves: 10,
        enemyTypes: ['vine_creeper', 'root_shambler', 'fungal_man', 'spore_carrier'],
        spawnRate: 1.2,
      },
    },
    {
      id: 'fire_crucible',
      chapterNum: 3,
      name: 'chapter_3_name',
      description: 'chapter_3_desc',
      unlockCondition: { completedChapter: 'cursed_forest' },
      mapData: null,
      biomeId: 'fire_mines',
      bossId: 'boss_magma_giant',
      requiredItems: ['crystal_shard_3'],
      rewards: {
        gold: 700,
        reputation: 100,
        items: ['crystal_shard_3'],
      },
      storyKeyAfter: 'story_chapter_3',
      waveConfig: {
        maxWaves: 12,
        enemyTypes: ['fire_elem', 'magma_crab', 'salamander', 'ember_moth'],
        spawnRate: 1.4,
      },
    },
    {
      id: 'throne_of_darkness',
      chapterNum: 4,
      name: 'chapter_4_name',
      description: 'chapter_4_desc',
      unlockCondition: { completedChapter: 'fire_crucible', requiredItems: ['crystal_shard_1', 'crystal_shard_2', 'crystal_shard_3'] },
      mapData: null,
      biomeId: 'castle',
      bossId: 'boss_dark_knight',        // мини-босс (страж)
      finalBossId: 'boss_ancient_dragon', // финальный босс
      requiredItems: [],
      rewards: {
        gold: 1500,
        reputation: 200,
        items: ['dragon_slayer_trophy'],
      },
      storyKeyAfter: 'story_chapter_4_victory',
      waveConfig: {
        maxWaves: 15,
        enemyTypes: ['death_knight', 'shadow', 'demon_berserker', 'nether_hound'],
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
   * Начать главу — инициализирует карту главы.
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

    // Инициализация карты главы (заглушка для шага 2)
    // На шаге 2 здесь будет вызов генерации конкретной карты
    if (window.Game) {
      // Используем существующий механизм запуска с биомом главы
      Game.startNewGame(chapter.biomeId);

      // Пометить что мы в сюжетном режиме
      Game._storyCampaignActive = true;
      Game._storyCampaignChapter = chapter;
    }
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

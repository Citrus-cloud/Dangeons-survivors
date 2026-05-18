'use strict';
/* ============================================================
   campaign.js — Шаг 16: Сюжетный режим (кампания).
   5 карт со сквозным сюжетом, целями, диалогами, финальным боссом.
   ============================================================ */

const CAMPAIGN_KEY = 'd20_campaignProgress';

/* ---------- Диалоги ---------- */
const CAMPAIGN_DIALOGUES = {
  beforeMap1: 'Древнее зло пробудилось в глубинах под королевством. Дракон, спавший тысячелетия, сеет хаос. Ты — рыцарь ордена, последняя надежда. Спустись в склеп, найди рунные алтари и открой путь в недра.',
  afterMap1: 'Алтари активированы. Тьма расступается, открывая проход в ледяные пещеры. Будь осторожен — эти земли не видели солнца веками.',
  afterMap2: 'Ледяной перевал пройден. Впереди — огненные недра, где кузнецы хаоса выковали сердце тьмы. Уничтожь стража и забери Огненное сердце — оно пригодится.',
  afterMap3: 'Огненное сердце пульсирует в твоей руке. Ты чувствуешь, как сила стихий наполняет тебя. Но впереди — заросший храм, где томятся пленники дракона.',
  mageSaved: 'Спасибо, рыцарь! Я — маг ордена, дракон держал меня здесь, чтобы вытягивать мою силу. Возьми моё благословение — оно поможет в битве с чудовищем.',
  afterMap4: 'Маг спасён. Его благословение усиливает твои заклинания. Теперь — в Цитадель тьмы. Дракон ждёт.',
  beforeBoss: 'Древний дракон восседает на троне из костей героев. Он чувствует твоё приближение. Время последней битвы!',
  victory: 'Дракон повержен! Королевство свободно. Твоё имя войдёт в легенды. Но тьма всегда находит путь... (награда: +1000 золота, +200 репутации)',
};

/* ---------- Карты кампании ---------- */
const CAMPAIGN_MAPS = [
  {
    id: 1,
    name: 'Проклятый склеп',
    biome: 'crypt',
    objective: {
      type: 'activate',
      description: 'Активировать рунные алтари',
      target: 2,
    },
    timeLimit: 0, // без лимита
    specialObjects: ['altars'],
    dialogueBefore: 'beforeMap1',
    dialogueAfter: 'afterMap1',
    bossId: null, // опциональный страж
    rewards: { gold: 200, rep: 30 },
  },
  {
    id: 2,
    name: 'Ледяной перевал',
    biome: 'ice_caves',
    objective: {
      type: 'survive',
      description: 'Продержаться',
      target: 480, // 8 минут в секундах
    },
    timeLimit: 480,
    specialObjects: [],
    dialogueBefore: null,
    dialogueAfter: 'afterMap2',
    bossId: 'boss_ice_serpent', // мини-босс на 4-й минуте
    bossSpawnTime: 240,
    rewards: { gold: 300, rep: 40 },
  },
  {
    id: 3,
    name: 'Огненные недра',
    biome: 'fire_mines',
    objective: {
      type: 'kill_boss',
      description: 'Убить Магма-гиганта',
      target: 1,
    },
    timeLimit: 0,
    specialObjects: ['fire_heart'],
    dialogueBefore: null,
    dialogueAfter: 'afterMap3',
    bossId: 'boss_magma_giant',
    bossSpawnTime: 30,
    rewards: { gold: 400, rep: 50 },
  },
  {
    id: 4,
    name: 'Заросший храм',
    biome: 'forest_ruins',
    objective: {
      type: 'rescue',
      description: 'Спасти пленённого мага',
      target: 1,
    },
    timeLimit: 0,
    specialObjects: ['cage', 'key_enemy'],
    dialogueBefore: null,
    dialogueAfter: 'afterMap4',
    bossId: null,
    rewards: { gold: 300, rep: 50 },
  },
  {
    id: 5,
    name: 'Цитадель тьмы',
    biome: 'castle',
    objective: {
      type: 'kill_boss',
      description: 'Победить Древнего дракона',
      target: 1,
    },
    timeLimit: 0,
    specialObjects: [],
    dialogueBefore: 'beforeBoss',
    dialogueAfter: null, // victory screen instead
    bossId: 'boss_ancient_dragon',
    bossSpawnTime: 30,
    rewards: { gold: 1000, rep: 200 },
  },
];



/* ---------- Campaign State Manager ---------- */
const Campaign = {
  active: false,          // кампания запущена?
  currentMapIndex: 0,     // индекс текущей карты (0-based)
  objective: null,        // { type, description, current, target, completed }
  mapTime: 0,             // время на текущей карте
  bossSpawned: false,     // босс карты уже появился?
  bossDefeated: false,    // босс убит?
  specialObjects: [],     // массив специальных объектов на карте
  hasKey: false,          // ключ подобран (для карты 4)?
  mageBlessing: false,    // благословение мага получено?
  newGamePlus: false,     // режим Новая Игра+
  dialogueQueue: [],      // очередь диалогов для показа

  /* ---------- Сохранение/загрузка ---------- */

  loadProgress() {
    try {
      const raw = localStorage.getItem(CAMPAIGN_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return { currentMap: 1, completed: false, newGamePlus: false, mageBlessing: false };
  },

  saveProgress() {
    const data = {
      currentMap: this.currentMapIndex + 1,
      completed: false,
      newGamePlus: this.newGamePlus,
      mageBlessing: this.mageBlessing,
    };
    try {
      localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  },

  saveCompleted() {
    const data = {
      currentMap: 5,
      completed: true,
      newGamePlus: true,
      mageBlessing: this.mageBlessing,
    };
    try {
      localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  },

  /* ---------- Запуск кампании ---------- */

  start() {
    const progress = this.loadProgress();
    this.active = true;
    this.currentMapIndex = progress.completed ? 0 : Math.max(0, (progress.currentMap || 1) - 1);
    this.newGamePlus = progress.newGamePlus || false;
    this.mageBlessing = progress.mageBlessing || false;
    this.hasKey = false;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.mapTime = 0;
    this.specialObjects = [];
    this.objective = null;

    // Показать начальный диалог
    const mapCfg = CAMPAIGN_MAPS[this.currentMapIndex];
    if (this.currentMapIndex === 0) {
      this.dialogueQueue = ['beforeMap1'];
    } else if (mapCfg.dialogueBefore) {
      this.dialogueQueue = [mapCfg.dialogueBefore];
    } else {
      this.dialogueQueue = [];
    }

    // Показать диалог перед загрузкой карты
    this._showNextDialogue(() => {
      this._loadCurrentMap();
    });
  },

  /** Начать заново (после завершения). */
  startNewGamePlus() {
    this.newGamePlus = true;
    this.currentMapIndex = 0;
    this.mageBlessing = false;
    this.start();
  },

  /* ---------- Загрузка карты ---------- */

  _loadCurrentMap() {
    const mapCfg = CAMPAIGN_MAPS[this.currentMapIndex];
    if (!mapCfg) return;

    // Инициализация состояния карты
    this.mapTime = 0;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.hasKey = false;
    this.specialObjects = [];

    // Инициализация цели
    this.objective = {
      type: mapCfg.objective.type,
      description: mapCfg.objective.description,
      current: 0,
      target: mapCfg.objective.target,
      completed: false,
    };

    // Запуск игры с параметрами кампании
    if (window.Game) {
      Game._startCampaignMap(mapCfg);
    }

    this.saveProgress();
  },

  /* ---------- Обновление каждый кадр ---------- */

  update(dt) {
    if (!this.active) return;
    this.mapTime += dt;

    const mapCfg = CAMPAIGN_MAPS[this.currentMapIndex];
    if (!mapCfg) return;

    // Спавн босса по таймеру
    if (mapCfg.bossId && mapCfg.bossSpawnTime && !this.bossSpawned && this.mapTime >= mapCfg.bossSpawnTime) {
      this.bossSpawned = true;
      this._spawnCampaignBoss(mapCfg.bossId);
    }

    // Проверка целей
    this._checkObjective(mapCfg, dt);
  },

  /* ---------- Проверка целей ---------- */

  _checkObjective(mapCfg, dt) {
    if (!this.objective || this.objective.completed) return;

    switch (this.objective.type) {
      case 'survive':
        this.objective.current = Math.floor(this.mapTime);
        if (this.mapTime >= this.objective.target) {
          this._completeObjective();
        }
        break;

      case 'kill_boss':
        if (this.bossDefeated) {
          this.objective.current = 1;
          this._completeObjective();
        }
        break;

      case 'activate':
        // Проверяется извне (при взаимодействии с алтарями)
        break;

      case 'rescue':
        // Проверяется извне (при открытии клетки)
        break;

      case 'fetch':
        // Проверяется извне (при подборе предмета)
        break;
    }
  },

  /* ---------- Внешние события ---------- */

  /** Вызывается когда алтарь активирован. */
  onAltarActivated() {
    if (!this.objective || this.objective.type !== 'activate') return;
    this.objective.current++;
    if (this.objective.current >= this.objective.target) {
      this._completeObjective();
    }
  },

  /** Вызывается когда босс кампании убит. */
  onCampaignBossKilled() {
    this.bossDefeated = true;
    // Для карты 3: спавнить Огненное сердце
    if (this.currentMapIndex === 2) {
      this._spawnFireHeart();
    }
  },

  /** Вызывается когда ключ подобран (карта 4). */
  onKeyPickedUp() {
    this.hasKey = true;
    if (window.Particles && window.Game && Game.player) {
      Particles.text(Game.player.x, Game.player.y - 30, 'КЛЮЧ ПОЛУЧЕН!', 1.5, '#ffd700', 14);
    }
  },

  /** Вызывается когда клетка открыта (карта 4). */
  onCageOpened() {
    if (!this.objective || this.objective.type !== 'rescue') return;
    this.mageBlessing = true;
    this.objective.current = 1;

    // Диалог мага
    if (window.UI && UI.showCampaignDialogue) {
      UI.showCampaignDialogue(CAMPAIGN_DIALOGUES.mageSaved, () => {
        this._completeObjective();
      });
    } else {
      this._completeObjective();
    }

    // Применить благословение
    if (window.Game && Game.player) {
      Game.player.magicDamageMul *= 1.20;
    }

    // Сохранить благословение
    this.saveProgress();
  },

  /** Вызывается когда Огненное сердце подобрано. */
  onFireHeartPickedUp() {
    if (this.currentMapIndex === 2 && this.objective && this.objective.type === 'kill_boss') {
      this._completeObjective();
    }
    if (window.Particles && window.Game && Game.player) {
      Particles.text(Game.player.x, Game.player.y - 30, 'ОГНЕННОЕ СЕРДЦЕ!', 2.0, '#ff6600', 16);
    }
  },

  /* ---------- Завершение цели ---------- */

  _completeObjective() {
    if (!this.objective || this.objective.completed) return;
    this.objective.completed = true;

    if (window.Particles && window.Game && Game.player) {
      Particles.text(Game.player.x, Game.player.y - 40, 'ЦЕЛЬ ВЫПОЛНЕНА!', 2.0, '#2ecc71', 18);
      Particles.burst(Game.player.x, Game.player.y, 15, {
        color: '#2ecc71', speedMin: 80, speedMax: 200,
        lifeMin: 0.5, lifeMax: 1.0, sizeMin: 3, sizeMax: 6,
      });
    }

    // Небольшая задержка перед переходом
    setTimeout(() => {
      this._onMapComplete();
    }, 2000);
  },

  /* ---------- Завершение карты ---------- */

  _onMapComplete() {
    const mapCfg = CAMPAIGN_MAPS[this.currentMapIndex];
    if (!mapCfg) return;

    // Награды
    if (window.MetaProgress && MetaProgress.data) {
      const goldMul = this.newGamePlus ? 1.20 : 1.0;
      MetaProgress.addGold(Math.floor(mapCfg.rewards.gold * goldMul));
      MetaProgress.addReputation(mapCfg.rewards.rep);
    }

    // Финал?
    if (this.currentMapIndex >= CAMPAIGN_MAPS.length - 1) {
      this._onCampaignComplete();
      return;
    }

    // Показать диалог после карты, затем перейти к следующей
    const dialogueKey = mapCfg.dialogueAfter;
    if (dialogueKey && CAMPAIGN_DIALOGUES[dialogueKey]) {
      if (window.UI && UI.showCampaignDialogue) {
        UI.showCampaignDialogue(CAMPAIGN_DIALOGUES[dialogueKey], () => {
          this._advanceToNextMap();
        });
      } else {
        this._advanceToNextMap();
      }
    } else {
      this._advanceToNextMap();
    }
  },

  _advanceToNextMap() {
    this.currentMapIndex++;
    const mapCfg = CAMPAIGN_MAPS[this.currentMapIndex];

    // Показать диалог перед картой если есть
    if (mapCfg && mapCfg.dialogueBefore && CAMPAIGN_DIALOGUES[mapCfg.dialogueBefore]) {
      if (window.UI && UI.showCampaignDialogue) {
        UI.showCampaignDialogue(CAMPAIGN_DIALOGUES[mapCfg.dialogueBefore], () => {
          this._loadCurrentMap();
        });
      } else {
        this._loadCurrentMap();
      }
    } else {
      this._loadCurrentMap();
    }
  },

  /* ---------- Победа ---------- */

  _onCampaignComplete() {
    this.active = false;
    this.saveCompleted();

    // Достижение
    if (window.MetaProgress && MetaProgress.data) {
      if (!MetaProgress.data.achievements) MetaProgress.data.achievements = [];
      if (!MetaProgress.data.achievements.includes('dragon_slayer')) {
        MetaProgress.data.achievements.push('dragon_slayer');
      }
      MetaProgress.save();
    }

    // Показать экран победы
    if (window.UI && UI.showCampaignVictory) {
      UI.showCampaignVictory(CAMPAIGN_DIALOGUES.victory, () => {
        // Вернуться в лагерь
        if (window.Game) {
          Game.state = 'camp';
          UI.hideAll();
          UI.showCamp();
        }
      });
    }
  },

  /* ---------- Смерть в кампании ---------- */

  onPlayerDeath() {
    // Сохраняем текущую карту (не сбрасываем)
    this.saveProgress();
    this.active = false;
  },

  /* ---------- Спавн босса ---------- */

  _spawnCampaignBoss(bossId) {
    if (!window.Bosses || !window.Game || !Game.player) return;

    // Для Древнего дракона — особая обработка
    if (bossId === 'boss_ancient_dragon') {
      const boss = Bosses._createBoss(bossId, Game.player, 'campaign', 0);
      if (boss) {
        boss.isCampaignBoss = true;
        Bosses.current = boss;
        Bosses._announcesBoss(boss.cfg.name);
      }
      return;
    }

    // Обычный босс кампании (усиленный на 30%)
    const boss = Bosses._createBoss(bossId, Game.player, 'campaign', 0);
    if (boss) {
      boss.hp = Math.floor(boss.hp * 1.30);
      boss.maxHp = boss.hp;
      boss.isCampaignBoss = true;
      Bosses.current = boss;
      Bosses._announcesBoss(boss.cfg.name);
    }
  },

  /* ---------- Спавн огненного сердца ---------- */

  _spawnFireHeart() {
    if (!window.Game || !window.Bosses) return;
    const boss = Bosses.current;
    const x = boss ? boss.x : (Game.player ? Game.player.x + 50 : 500);
    const y = boss ? boss.y : (Game.player ? Game.player.y : 500);

    this.specialObjects.push({
      type: 'fire_heart',
      x: x,
      y: y,
      size: 24,
      pulse: 0,
      pickedUp: false,
    });

    if (window.Particles) {
      Particles.burst(x, y, 12, {
        color: '#ff6600', speedMin: 60, speedMax: 150,
        lifeMin: 0.5, lifeMax: 1.0, sizeMin: 3, sizeMax: 5,
      });
    }
  },

  /* ---------- Диалоги ---------- */

  _showNextDialogue(onDone) {
    if (this.dialogueQueue.length === 0) {
      onDone && onDone();
      return;
    }
    const key = this.dialogueQueue.shift();
    const text = CAMPAIGN_DIALOGUES[key];
    if (!text) { onDone && onDone(); return; }

    if (window.UI && UI.showCampaignDialogue) {
      UI.showCampaignDialogue(text, () => {
        this._showNextDialogue(onDone);
      });
    } else {
      onDone && onDone();
    }
  },

  /* ---------- Получить текущую информацию ---------- */

  getCurrentMapConfig() {
    if (!this.active) return null;
    return CAMPAIGN_MAPS[this.currentMapIndex] || null;
  },

  getObjectiveText() {
    if (!this.objective) return '';
    const o = this.objective;
    if (o.type === 'survive') {
      const remaining = Math.max(0, o.target - o.current);
      return `${o.description}: ${Utils.formatTime(remaining)}`;
    }
    if (o.type === 'activate' || o.type === 'rescue' || o.type === 'kill_boss') {
      return `${o.description}: ${o.current}/${o.target}`;
    }
    return o.description;
  },

  isActive() {
    return this.active;
  },
};

// Экспорт
window.Campaign = Campaign;
window.CAMPAIGN_MAPS = CAMPAIGN_MAPS;
window.CAMPAIGN_DIALOGUES = CAMPAIGN_DIALOGUES;

'use strict';
/* ============================================================
   main.js — точка входа: инициализация, состояния, игровой цикл.
   ============================================================ */

// createParticle и фабрики частиц — в js/particles.js (Шаг 3).


/* ============================================================
   Базовые улучшения (как в Шаге 1, по ТЗ — пусть стакаются).
   Каждое имеет id, title, desc, apply(player) и available(player)
   (можно ли предложить — например, +1 missile всегда доступен,
   а HP — тоже всегда).
   ============================================================ */
const BASIC_UPGRADES = [
  { id: 'b_maxhp',     icon: '❤', title: 'Здоровье +20',     desc: 'Макс. HP +20 (восполняется на ту же величину).',
    apply(p) { p.bonusMaxHp = (p.bonusMaxHp || 0) + 20; p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); }, available() { return true; } },
  { id: 'b_damage',    icon: '⚔', title: 'Урон +15%',         desc: 'Весь урон увеличен на 15%.',
    apply(p) { p.damageMul *= 1.15; }, available() { return true; } },
  { id: 'b_speed',     icon: '➤', title: 'Скорость +10%',     desc: 'Скорость передвижения +10%.',
    apply(p) { p.speedMul *= 1.10; }, available() { return true; } },
  { id: 'b_weapon_cd', icon: '⏱', title: 'Скорострельность',  desc: 'Кулдаун всех оружий -10%.',
    apply(p) { p.weaponCdMul *= 0.90; }, available() { return true; } },
  { id: 'b_missile_cd',icon: '✦', title: 'Магия чаще',        desc: 'Кулдаун магического снаряда -25%.',
    apply(p) { p.missileCdMul *= 0.75; }, available() { return true; } },
  { id: 'b_pickup',    icon: '◎', title: 'Радиус подбора +30%', desc: 'Радиус притяжения опыта +30%.',
    apply(p) { p.pickupMul *= 1.30; }, available() { return true; } },
  { id: 'b_multishot', icon: '✶', title: '+1 снаряд',          desc: 'Magic Missile выпускает +1 снаряд.',
    apply(p) { p.missileCount += 1; }, available() { return true; } },
  { id: 'b_heal',      icon: '✚', title: 'Восстановление 30%', desc: 'Мгновенно восстанавливает 30% макс. HP.',
    apply(p) { p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.30); }, available() { return true; } },
];


/* ============================================================
   Game — основной объект. Делает всё, что не вошло в подмодули:
   состояние, цикл, спавн волн, левелап-пул.
   ============================================================ */
const Game = {
  // canvas
  canvas: null, ctx: null,
  viewW: 0, viewH: 0, dpr: 1,

  // state: 'menu' | 'playing' | 'paused' | 'levelup' | 'gameover' | 'chest'
  state: 'menu',

  // мир
  player: null,
  enemies: null,
  projectiles: null,
  xpDrops: null,
  particles: null,

  // тайминги
  lastTs: 0,
  runTime: 0,
  waveIndex: 0,
  waveTimer: 0,
  kills: 0,
  killsByType: Object.create(null),

  // Шаг 3: сундук
  chest: null,           // текущий активный сундук на карте (или null)
  chestTimer: 0,         // секунд до следующего спавна (0 — спавним немедленно)

  // Шаг 4: спец-режим спавна мимика
  mimicState: null,

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Пулы
    this.enemies     = new ObjectPool(createEnemy,      CONFIG.POOLS.ENEMIES);
    this.projectiles = new ObjectPool(createProjectile, CONFIG.POOLS.PROJECTILES);
    this.xpDrops     = new ObjectPool(createXP,         CONFIG.POOLS.XP);
    this.particles   = new ObjectPool(createParticle,   CONFIG.POOLS.PARTICLES);
    // Шаг 15: пул золота
    this.goldDrops   = new ObjectPool(createGold,       GOLD_CONFIG.POOL_SIZE);

    GameMap.precompute();
    Input.init();
    GameAudio.init();

    // Генерация пиксельных спрайтов врагов
    if (window.initSprites) initSprites();

    // Шаг 15: загрузить мета-прогресс
    if (window.MetaProgress) MetaProgress.load();

    // Загрузить бестиарий и кодекс
    if (window.Bestiary) Bestiary.load();
    if (window.Codex) Codex.load();

    // Добавить кнопку «Выход» в паузу и обработчик кнопки «Назад»
    if (window.UIExtended) {
      UIExtended.addPauseExitButton();
      UIExtended.initBackButton();
    }

    // UI bindings
    document.getElementById('startBtn').addEventListener('click',   () => this.startNewGame());
    document.getElementById('restartBtn').addEventListener('click', () => this._handleRestartBtn());
    document.getElementById('resumeBtn').addEventListener('click',  () => this.togglePause());
    document.getElementById('pauseBtn').addEventListener('click',   () => this.togglePause());

    // Шаг 20: показать лагерь
    this.state = 'camp';
    UI.hideAll();
    UI.showCamp();
    // Шаг 18: музыка лагеря
    if (window.GameAudio) GameAudio.playMusic('camp');

    this.lastTs = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  /** Шаг 20: вызывается после закрытия тайтлового экрана (первый запуск). */
  _afterTitleDismissed() {
    Game.init();
  },

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.viewW = w;
    this.viewH = h;

    // Шаг 3 (анимации): BASE_SCALE — кратный масштаб спрайтов для чёткости
    if (w < 600) this.baseScale = 2;
    else if (w <= 1200) this.baseScale = 3;
    else this.baseScale = 4;
    // Экспорт глобально для использования в sprites.js и других модулях
    window.BASE_SCALE = this.baseScale;

    // Камера показывает в 2 раза больше карты (zoom-out x2)
    this.cameraScale = 0.5; // 1 / 2.0 — показываем 200% области
    this.cameraViewW = w / this.cameraScale;
    this.cameraViewH = h / this.cameraScale;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Шаг 3: отключаем сглаживание глобально
    this.ctx.imageSmoothingEnabled = false;
  },

  /* ----- состояния ----- */
  startNewGame() {
    this.enemies.clearAll();
    this.projectiles.clearAll();
    this.xpDrops.clearAll();
    this.particles.clearAll();
    this.goldDrops.clearAll();
    if (window.GameMap && GameMap.clearGroundEffects) GameMap.clearGroundEffects();

    // Шаг 15: счётчики золота и боссов за забег
    this.runGold = 0;
    this.bossKills = 0;

    // Шаг 13: бесконечный режим — инициализация
    this.mapNumber = 1;
    this.mapTime = 0;            // время на текущей карте
    this.portalSpawned = false;  // портал уже появился?
    this.guardianSpawned = false; // страж уже появился?
    this.lastBiomeId = null;     // для предотвращения повтора биома
    this.transitioning = false;  // идёт переход?
    this.transitionTimer = 0;

    // Шаг 5: генерируем подземелье ДО создания игрока (Шаг 13: первая карта — склеп)
    if (window.GameMap && GameMap.generateDungeon) {
      GameMap.generateDungeon('crypt', 1);
    }

    this.kills = 0;
    this.killsByType = Object.create(null);
    this.runTime = 0;
    this.waveIndex = 0;
    this.waveTimer = CONFIG.WAVE.INITIAL_DELAY;

    // Шаг 3: сундук
    this.chest = null;
    this.chestTimer = CONFIG.CHEST.FIRST_DELAY;
    // Шаг 5: секретный сундук (даётся при открытии секретной комнаты)
    this.secretChest = null;

    // Шаг 6: мини-боссы
    this.bossChest = null;  // золотой сундук после убийства босса
    if (window.Bosses) Bosses.init();

    // Шаг 4: мимик
    this.mimicState = (window.Enemies && Enemies.initMimicState)
      ? Enemies.initMimicState()
      : { count: 0, nextCheckTime: 180 };

    // Стартовая позиция героя — центр стартовой комнаты подземелья
    let startX = (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) / 2;
    let startY = (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) / 2;
    if (window.GameMap && GameMap.dungeon && GameMap.dungeon.startRoom) {
      const sp = GameMap.randomPointInRoom(GameMap.dungeon.startRoom, 18);
      if (sp) { startX = sp.x; startY = sp.y; }
    }
    this.player = Player.create(startX, startY);

    // Шаг 15: перестроить UI-слоты под динамическое количество
    UI.rebuildSlots(this.player.weaponSlots.length, this.player.abilitySlots.length);

    UI.hideAll();
    this.state = 'playing';
    // Шаг 18: запуск музыки биома (первая карта всегда склеп)
    if (window.GameAudio) GameAudio.playMusic('crypt');
  },

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      Input.releaseJoystick();
      // Шаг 18: пауза музыки
      if (window.GameAudio) GameAudio.pauseMusic();
      UI.showPause();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      UI.hideAll();
      // Шаг 18: возобновление музыки
      if (window.GameAudio) GameAudio.resumeMusic();
    }
  },

  triggerLevelUp() {
    const choices = this.buildLevelUpChoices(3);
    if (choices.length === 0) {
      // Всё прокачано — просто +10% HP без паузы
      const p = this.player;
      const add = p.maxHp * 0.10;
      p.maxHp += add;
      p.hp = Math.min(p.maxHp, p.hp + add);
      return;
    }
    this.state = 'levelup';
    Input.releaseJoystick();
    UI.showLevelUp(this.player.level, choices, (chosen) => {
      if (chosen) chosen.apply(this.player);
      UI.hideAll();
      this.state = 'playing';
    });
  },

  /**
   * Собираем все доступные варианты для левелапа и отдаём n случайных.
   * Виды карт:
   *  - 'basic'   — базовые улучшения (всегда доступны)
   *  - 'weapon'  — новое оружие (если есть свободный слот) или
   *                апгрейд существующего (level < max)
   *  - 'ability' — новая пассивка или апгрейд
   */
  buildLevelUpChoices(n) {
    const p = this.player;
    const all = [];

    // 1) Новое оружие (если слот свободен)
    if (Player.hasFreeWeaponSlot(p)) {
      for (const info of WEAPON_INFO) {
        if (Player.findWeapon(p, info.id)) continue; // уже есть — не предлагать "новое"
        all.push({
          kind: 'weapon',
          icon: info.icon,
          id: info.id,
          title: `Новое: ${info.name}`,
          desc: info.desc,
          apply(player) {
            const w = WEAPON_FACTORIES[info.id]();
            Player.addWeapon(player, w);
            // Разблокировка в кодексе
            if (window.Codex) Codex.unlockWeapon(info.id);
          },
        });
      }
    }

    // 2) Апгрейд существующего оружия
    for (const w of p.weaponSlots) {
      if (!w) continue;
      if (w.level >= w.maxLevel) continue;
      const next = w.level + 1;
      all.push({
        kind: 'weapon',
        icon: w.icon,
        id: w.id,
        title: `${w.name} ${Utils.roman(w.level)} → ${Utils.roman(next)}`,
        desc: '+15% урона, -5% кулдауна.',
        apply(player) {
          const tgt = Player.findWeapon(player, w.id);
          if (tgt) tgt.upgrade();
        },
      });
    }

    // 3) Новая пассивка
    if (Player.hasFreeAbilitySlot(p)) {
      for (const info of ABILITY_INFO) {
        if (Player.findAbility(p, info.id)) continue;
        all.push({
          kind: 'ability',
          icon: info.icon,
          id: info.id,
          title: `Новая: ${info.name}`,
          desc: info.desc,
          apply(player) {
            const a = ABILITY_FACTORIES[info.id]();
            Player.addAbility(player, a);
            // Разблокировка в кодексе
            if (window.Codex) Codex.unlockAbility(info.id);
          },
        });
      }
    }

    // 4) Апгрейд пассивки
    for (const a of p.abilitySlots) {
      if (!a) continue;
      if (a.level >= a.maxLevel) continue;
      const next = a.level + 1;
      all.push({
        kind: 'ability',
        icon: a.icon,
        id: a.id,
        title: `${a.name} ${Utils.roman(a.level)} → ${Utils.roman(next)}`,
        desc: a.desc,
        apply(player) {
          const tgt = Player.findAbility(player, a.id);
          if (tgt) tgt.upgrade(player);
        },
      });
    }

    // 5) Базовые улучшения (всегда доступны и стакаются)
    for (const u of BASIC_UPGRADES) {
      if (!u.available(p)) continue;
      all.push({
        kind: 'basic',
        icon: u.icon,
        title: u.title,
        desc: u.desc,
        apply(player) { u.apply(player); },
      });
    }

    // Шаг 7: Взвешенная выборка — оружие/пассивки чаще, базовые улучшения реже.
    // Вес: weapon/ability = 3, basic = 1
    const weighted = [];
    for (const item of all) {
      const weight = (item.kind === 'basic') ? 1 : 3;
      for (let w = 0; w < weight; w++) weighted.push(item);
    }
    const out = [];
    const picked = new Set();
    for (let i = 0; i < n && picked.size < all.length; i++) {
      let attempts = 0;
      while (attempts < 50) {
        const idx = Math.floor(Math.random() * weighted.length);
        const item = weighted[idx];
        if (!picked.has(item)) { picked.add(item); out.push(item); break; }
        attempts++;
      }
    }
    return out;
  },

  triggerGameOver() {
    this.state = 'gameover';
    Input.releaseJoystick();

    // Шаг 19: остановить музыку и очистить все таймеры
    if (window.GameAudio) {
      GameAudio.playSfx('death');
      GameAudio.stopMusic();
    }

    // Шаг 19: очистить все объекты для предотвращения утечек
    this.enemies.clearAll();
    this.projectiles.clearAll();
    if (this.goldDrops) this.goldDrops.clearAll();

    // Шаг 15: сохранить мета-прогресс
    if (window.MetaProgress && MetaProgress.data) {
      const goldCollected = this.runGold || 0;
      const goldBonus = (this.player ? this.player.level : 1) * 10;
      const goldTotal = MetaProgress.calcEndOfRunGold(goldCollected, this.player ? this.player.level : 1);

      MetaProgress.addGold(goldTotal);
      MetaProgress.updateStats(this.kills, this.runTime);
      const repGained = 10 + (this.bossKills || 0) * 5 + Math.floor(this.kills / 100);
      MetaProgress.addRunReputation(this.bossKills || 0, this.kills);

      // Собираем полную статистику забега
      const runStats = {
        time: Utils.formatTime(this.runTime),
        kills: this.kills,
        level: this.player ? this.player.level : 1,
        wave: this.waveIndex,
        mapsCleared: (this.mapNumber || 1) - 1,
        goldCollected: goldCollected,
        goldBonus: goldBonus,
        goldTotal: goldTotal,
        repGained: repGained,
        bossKills: this.bossKills || 0,
        chestsOpened: this._chestsOpened || 0,
        bestRoll: this._bestD20Roll || 0,
        damageDealt: this._totalDamageDealt || '—',
        damageTaken: this._totalDamageTaken || '—',
      };

      // Показать окно статистики через UIExtended
      if (window.UIExtended) {
        UIExtended.showRunStats(runStats, () => {
          this.state = 'camp';
          UI.showCamp();
          if (window.GameAudio) GameAudio.playMusic('camp');
        });
      } else {
        // Фоллбэк: старое поведение
        UI.showRunResults({
          time: Utils.formatTime(this.runTime),
          kills: this.kills,
          level: this.player ? this.player.level : 1,
          goldCollected: goldCollected,
          goldBonus: goldBonus,
          goldTotal: goldTotal,
          repGained: repGained,
        }, () => {
          this.state = 'camp';
          UI.showCamp();
          if (window.GameAudio) GameAudio.playMusic('camp');
        });
      }
    } else {
      // Фоллбэк: старое поведение
      UI.showGameOver({
        time: Utils.formatTime(this.runTime),
        kills: this.kills,
        level: this.player.level,
      });
    }
  },

  /** Шаг 15: обработчик кнопки рестарта (из старого Game Over). */
  _handleRestartBtn() {
    // Переход в лагерь вместо прямого рестарта
    if (window.MetaProgress) {
      this.state = 'camp';
      UI.hideAll();
      UI.showCamp();
      // Шаг 18: музыка лагеря
      if (window.GameAudio) GameAudio.playMusic('camp');
    } else {
      this.startNewGame();
    }
  },

  /** Выход из забега в лагерь (из меню паузы или кнопки «назад»). */
  exitToMenu() {
    if (this.state !== 'paused' && this.state !== 'playing') return;
    Input.releaseJoystick();

    // Останавливаем музыку
    if (window.GameAudio) GameAudio.stopMusic();

    // Очищаем объекты
    this.enemies.clearAll();
    this.projectiles.clearAll();
    if (this.goldDrops) this.goldDrops.clearAll();

    // Сохраняем мета-прогресс
    const goldCollected = this.runGold || 0;
    const goldTotal = (window.MetaProgress && MetaProgress.calcEndOfRunGold)
      ? MetaProgress.calcEndOfRunGold(goldCollected, this.player ? this.player.level : 1)
      : goldCollected;

    if (window.MetaProgress && MetaProgress.data) {
      MetaProgress.addGold(goldTotal);
      MetaProgress.updateStats(this.kills, this.runTime);
      MetaProgress.addRunReputation(this.bossKills || 0, this.kills);
    }

    // Собираем статистику забега
    const runStats = {
      time: Utils.formatTime(this.runTime),
      kills: this.kills,
      level: this.player ? this.player.level : 1,
      wave: this.waveIndex,
      mapsCleared: (this.mapNumber || 1) - 1,
      goldCollected: goldCollected,
      goldBonus: (this.player ? this.player.level : 1) * 10,
      goldTotal: goldTotal,
      bossKills: this.bossKills || 0,
      chestsOpened: this._chestsOpened || 0,
      bestRoll: this._bestD20Roll || 0,
      damageDealt: this._totalDamageDealt || '—',
      damageTaken: this._totalDamageTaken || '—',
    };

    this.state = 'gameover';
    UI.hideAll();

    // Показать окно статистики
    if (window.UIExtended) {
      UIExtended.showRunStats(runStats, () => {
        this.state = 'camp';
        UI.showCamp();
        if (window.GameAudio) GameAudio.playMusic('camp');
      });
    } else {
      this.state = 'camp';
      UI.showCamp();
      if (window.GameAudio) GameAudio.playMusic('camp');
    }
  },

  /* ----- игровой цикл ----- */
  loop(ts) {
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    if (this.state === 'playing') this.update(dt);
    this.render();
    UI.tick(this);
    requestAnimationFrame((t) => this.loop(t));
  },

  update(dt) {
    this.runTime += dt;

    Player.update(this.player, dt);
    // Шаг 4: применяем эффекты от наземных луж (slime/rot замедляют, fire — DoT)
    if (window.GameMap && GameMap.queryGroundAt) {
      const eff = GameMap.queryGroundAt(this.player.x, this.player.y);
      if (eff.dps > 0) this.player.hp -= eff.dps * dt;
      // Замедление применим в Player.update в этот же кадр в следующий раз —
      // здесь подкорректируем позицию: поскольку Player уже сдвинулся,
      // компенсируем "лишнее" движение, если есть slow > 0.
      let totalSlow = eff.slow || 0;
      // Шаг 6: замедление от паутины босса
      if (this.player.webSlow && this.player.webSlow > 0) {
        totalSlow = Math.max(totalSlow, 0.50);
      }
      // Шаг 17: замедление от ледяной руны
      if (this.player._iceSlow && this.player._iceSlowTimer > 0) {
        totalSlow = Math.max(totalSlow, this.player._iceSlow);
        this.player._iceSlowTimer -= dt;
        if (this.player._iceSlowTimer <= 0) this.player._iceSlow = 0;
      }
      // Шаг 17: оглушение (полная остановка)
      if (this.player._stunTimer && this.player._stunTimer > 0) {
        totalSlow = 1.0;
        this.player._stunTimer -= dt;
      }
      if (totalSlow > 0) {
        const move = Input.getMove();
        const ml = Math.hypot(move.x, move.y);
        if (ml > 0.001) {
          const speed = CONFIG.PLAYER.SPEED * this.player.speedMul;
          this.player.x -= move.x * speed * dt * totalSlow;
          this.player.y -= move.y * speed * dt * totalSlow;
        }
      }
    }
    if (window.GameMap && GameMap.updateGroundEffects) GameMap.updateGroundEffects(dt);
    // Шаг 5: обновление подземелья (ловушки, дверь, кулдауны рычагов)
    if (window.GameMap && GameMap.update) GameMap.update(dt);

    this.updateWaves(dt);
    this.updateBoss(dt);
    // Шаг 13: бесконечный режим — таймер карты, портал, страж
    if (!window.Campaign || !Campaign.active) {
      this.updateInfiniteMode(dt);
    }
    // Шаг 16: обновление кампании
    if (window.Campaign && Campaign.active) {
      Campaign.update(dt);
      if (window.GameMap && GameMap.updateCampaignObjects) {
        GameMap.updateCampaignObjects(dt, this.player);
      }
    }
    Enemies.update(this.enemies, this.player, dt);

    // Оружия в слотах
    const weaponHelpers = {
      damageEnemy: (e, dmg) => this.damageEnemy(e, dmg),
    };
    for (const w of this.player.weaponSlots) {
      if (!w) continue;
      // Меч имеет визуальный таймер — отдельный tick
      if (typeof w.tick === 'function') w.tick(dt);
      w.update(this.player, this.enemies, this.projectiles, dt, weaponHelpers);
    }
    // Шаг 6: проверка мили-оружий на попадание в босса
    this.checkMeleeVsBoss();

    // Встроенный Magic Missile (не в слотах)
    this.updateBuiltInMissile(dt);

    // Снаряды
    const camViewWUpdate = this.cameraViewW || this.viewW;
    const camViewHUpdate = this.cameraViewH || this.viewH;
    const cam = GameMap.getCamera(this.player, camViewWUpdate, camViewHUpdate);
    Projectiles.update(
      this.projectiles, this.enemies, cam, camViewWUpdate, camViewHUpdate,
      (e, dmg) => this.damageEnemy(e, dmg),
      dt
    );

    // Шаг 6: проверка попадания снарядов игрока в босса
    this.checkProjectilesVsBoss();
    // Шаг 9-10: отражение снарядов
    this.updateProjectileReflection();
    // Шаг 6: хоминг для снарядов босса (лич)
    this.updateHomingProjectiles(dt);

    // Шаг 6: яд от паука-королевы
    if (this.player.poison && this.player.poison.remaining > 0) {
      // Шаг 8: сопротивление снижает длительность яда (тик урона остаётся)
      this.player.hp -= this.player.poison.dps * dt;
      this.player.poison.remaining -= dt;
    }
    // Шаг 6: замедление от паутины
    if (this.player.webSlow && this.player.webSlow > 0) {
      this.player.webSlow -= dt;
    }

    // Лут и частицы
    Loot.update(this.xpDrops, this.player, dt);
    // Шаг 15: обновление золота
    if (this.goldDrops) Loot.updateGold(this.goldDrops, this.player, dt);

    // Притяжение застрявших объектов к проходимой зоне (раз в 0.5 сек)
    if (!this._attractTimer) this._attractTimer = 0;
    this._attractTimer += dt;
    if (this._attractTimer >= 0.5) {
      if (window.GameMap && GameMap.attractAllStuck) {
        GameMap.attractAllStuck(this, this._attractTimer);
      }
      this._attractTimer = 0;
    }

    this.updateChest(dt);
    this.updateBossChest(dt);
    this.updateParticles(dt);

    // Левелап (only trigger if still in playing state)
    if (this.state === 'playing' && this.player.xp >= this.player.xpNext) {
      this.player.xp -= this.player.xpNext;
      this.player.level += 1;
      this.player.xpNext = Math.floor(CONFIG.XP.BASE * Math.pow(CONFIG.XP.GROWTH, this.player.level - 1));
      // Шаг 18: звук повышения уровня
      if (window.GameAudio) GameAudio.playSfx('levelup');
      this.triggerLevelUp();
    }

    // Смерть
    if (this.player.hp <= 0) {
      // Feature #6: Возрождение (талант Телосложения ур.8-9)
      if (this.player._resurrectCount && this.player._resurrectCount > 0) {
        this.player._resurrectCount--;
        const healPct = this.player._resurrectHpPct || 0.30;
        this.player.hp = Math.floor(this.player.maxHp * healPct);
        // Визуальный эффект возрождения
        if (window.Particles) {
          Particles.burst(this.player.x, this.player.y, 15, {
            color: '#ffd700', speedMin: 80, speedMax: 200,
            lifeMin: 0.5, lifeMax: 1.0, sizeMin: 4, sizeMax: 8,
          });
          Particles.text(this.player.x, this.player.y - 40, 'ВОЗРОЖДЕНИЕ!', 2.0, '#ffd700', 18);
        }
        // Шаг 19: I-frames после воскрешения (2 сек)
        this.player._iFrameTimer = 2.0;
        return; // не умираем
      }
      this.player.hp = 0;
      // Шаг 16: обработка смерти в кампании
      if (window.Campaign && Campaign.active) {
        Campaign.onPlayerDeath();
      }
      this.triggerGameOver();
    }
  },

  updateBuiltInMissile(/* dt */) {
    const p = this.player;
    // Классовая система: только Волшебник имеет встроенный Magic Missile
    if (p._noBuiltInMissile) return;
    if (p.missileCd > 0) return;

    // Направление: по движению / по ближайшему врагу / по facing
    let dir;
    const move = Input.getMove();
    if (Math.hypot(move.x, move.y) > 0.05) {
      dir = Utils.norm(move.x, move.y);
    } else {
      const t = Projectiles.findNearestEnemy(this.enemies, p.x, p.y, Infinity);
      dir = t ? Utils.norm(t.x - p.x, t.y - p.y) : { x: p.facing.x, y: p.facing.y };
    }

    const count = p.missileCount + (p._talentBonusProjectiles || 0);
    const spread = CONFIG.MISSILE.SPREAD;
    const baseAngle = Math.atan2(dir.y, dir.x);
    for (let i = 0; i < count; i++) {
      const off = (i - (count - 1) / 2) * spread;
      const a = baseAngle + off;
      const pr = this.projectiles.spawn();
      if (!pr) break;
      pr.kind = 'missile';
      pr.owner = 'player';
      pr.x = p.x; pr.y = p.y;
      pr.vx = Math.cos(a) * CONFIG.MISSILE.SPEED;
      pr.vy = Math.sin(a) * CONFIG.MISSILE.SPEED;
      pr.life = CONFIG.MISSILE.LIFETIME;
      pr.damage = CONFIG.MISSILE.DAMAGE * p.damageMul * (p.magicDamageMul || 1);
      pr.radius = CONFIG.MISSILE.RADIUS;
      pr.angle = a;
      pr.source = 'missile';
    }
    p.missileCd = CONFIG.MISSILE.COOLDOWN * p.missileCdMul;
  },

  updateWaves(dt) {
    this.waveTimer -= dt;
    if (this.waveTimer <= 0) {
      this.waveIndex += 1;
      const count = CONFIG.WAVE.BASE + this.waveIndex * CONFIG.WAVE.PER_WAVE;
      Enemies.spawnWave(this.enemies, this.player, count, this.waveIndex);
      this.waveTimer = CONFIG.WAVE.INTERVAL;
    }
    // Шаг 4: попытка заспавнить мимика (после 3-й минуты, не более 1-2 за забег)
    if (window.Enemies && Enemies.tryMimicSpawn && this.mimicState) {
      Enemies.tryMimicSpawn(this.player, this.runTime, this.mimicState);
    }
  },

  /* ============================================================
     Шаг 13: Бесконечный режим — портал, страж, переход.
     ============================================================ */

  updateInfiniteMode(dt) {
    if (!window.PORTAL_CONFIG || !window.INFINITE_MODE) return;

    this.mapTime += dt;

    // Анимация перехода
    if (this.transitioning) {
      this.transitionTimer -= dt;
      if (this.transitionTimer <= 0) {
        this.transitioning = false;
        this._executeMapTransition();
      }
      return;
    }

    // Страж карты (появляется через GUARDIAN_SPAWN_DELAY на картах >= 2)
    if (!this.guardianSpawned &&
        this.mapNumber >= INFINITE_MODE.GUARDIAN_MIN_MAP &&
        this.mapTime >= INFINITE_MODE.GUARDIAN_SPAWN_DELAY) {
      this.guardianSpawned = true;
      if (window.Bosses && Bosses.spawnGuardian) {
        Bosses.spawnGuardian(this.player);
      }
    }

    // Портал (появляется через PORTAL_CONFIG.APPEAR_TIME секунд на карте)
    if (!this.portalSpawned && this.mapTime >= PORTAL_CONFIG.APPEAR_TIME) {
      this.portalSpawned = true;
      if (window.GameMap && GameMap.spawnPortal) {
        GameMap.spawnPortal();
      }
      // Уведомление
      if (window.Particles && this.player) {
        Particles.text(this.player.x, this.player.y - 40, 'ПОРТАЛ ОТКРЫТ!', 2.0, '#9b59b6', 16);
      }
    }

    // Проверка входа в портал
    if (this.portalSpawned && window.GameMap && GameMap.isPlayerInPortal &&
        GameMap.isPlayerInPortal(this.player)) {
      this._startMapTransition();
    }
  },

  /** Начать анимацию перехода на следующую карту. */
  _startMapTransition() {
    this.transitioning = true;
    this.transitionTimer = 0.8; // длительность анимации перехода (секунды)
    Input.releaseJoystick();
    // Шаг 20: показать экран загрузки
    if (window.LoadingScreen) LoadingScreen.show();
  },

  /** Выполнить переход на следующую карту (после анимации). */
  _executeMapTransition() {
    const player = this.player;
    if (!player) return;

    // Сохраняем состояние игрока (HP, оружие, пассивки, уровень, опыт)
    // — всё в объекте player, ничего не сбрасываем.

    // Увеличиваем номер карты
    this.mapNumber += 1;

    // Выбираем биом (не повторять предыдущий)
    let newBiome = INFINITE_MODE.getBiome(this.mapNumber);
    let attempts = 0;
    while (newBiome.id === this.lastBiomeId && attempts < 10) {
      newBiome = BIOMES[Math.floor(Math.random() * BIOMES.length)];
      attempts++;
    }
    this.lastBiomeId = newBiome.id;

    // Шаг 18: смена музыки на новый биом
    if (window.GameAudio) GameAudio.playMusic(newBiome.id);

    // Очистка объектов
    this.enemies.clearAll();
    this.projectiles.clearAll();
    this.xpDrops.clearAll();
    this.particles.clearAll();
    if (this.goldDrops) this.goldDrops.clearAll();
    if (window.GameMap && GameMap.clearGroundEffects) GameMap.clearGroundEffects();

    // Убираем активного босса
    if (window.Bosses) {
      Bosses.current = null;
      Bosses.guardian = null;
    }

    // Убираем сундуки
    this.chest = null;
    this.secretChest = null;
    this.bossChest = null;

    // Генерируем новую карту
    if (window.GameMap && GameMap.generateDungeon) {
      GameMap.generateDungeon(newBiome.id, this.mapNumber);
    }

    // Размещаем героя в стартовой комнате новой карты
    let startX = (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) / 2;
    let startY = (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) / 2;
    if (window.GameMap && GameMap.dungeon && GameMap.dungeon.startRoom) {
      const sp = GameMap.randomPointInRoom(GameMap.dungeon.startRoom, 18);
      if (sp) { startX = sp.x; startY = sp.y; }
    }
    player.x = startX;
    player.y = startY;

    // Сброс таймеров карты
    this.mapTime = 0;
    this.portalSpawned = false;
    this.guardianSpawned = false;

    // Волны продолжаются с текущего waveIndex (не сбрасываем)
    this.waveTimer = CONFIG.WAVE.INITIAL_DELAY;

    // Сундук: сброс таймера
    this.chestTimer = CONFIG.CHEST.FIRST_DELAY;

    // Визуальный эффект при выходе из перехода
    if (window.Particles) {
      Particles.burst(player.x, player.y, 12, {
        color: '#f1c40f', speedMin: 60, speedMax: 180,
        lifeMin: 0.4, lifeMax: 0.8, sizeMin: 3, sizeMax: 5,
      });
      Particles.ring(player.x, player.y, 60, 0.5, 'rgba(155, 89, 182, 0.8)', 3);
    }
    // Шаг 20: скрыть экран загрузки
    if (window.LoadingScreen) LoadingScreen.hide();
  },

  /* ============================================================
     Шаг 16: Кампания — загрузка карты кампании.
     ============================================================ */

  /** Запуск карты кампании (вызывается из Campaign._loadCurrentMap). */
  _startCampaignMap(mapCfg) {
    // Очистка
    this.enemies.clearAll();
    this.projectiles.clearAll();
    this.xpDrops.clearAll();
    this.particles.clearAll();
    if (this.goldDrops) this.goldDrops.clearAll();
    if (window.GameMap && GameMap.clearGroundEffects) GameMap.clearGroundEffects();

    // Шаг 15: счётчики
    this.runGold = this.runGold || 0;
    this.bossKills = this.bossKills || 0;

    // Сброс боссов
    if (window.Bosses) {
      Bosses.current = null;
      Bosses.guardian = null;
    }

    // Сундуки
    this.chest = null;
    this.secretChest = null;
    this.bossChest = null;

    // Бесконечный режим отключён для кампании
    this.portalSpawned = false;
    this.guardianSpawned = false;
    this.transitioning = false;
    this.mapNumber = mapCfg.id;

    // Генерация карты
    if (window.GameMap && GameMap.generateDungeon) {
      GameMap.generateDungeon(mapCfg.biome, mapCfg.id);
    }

    // Размещение специальных объектов кампании
    if (window.GameMap && GameMap.placeCampaignObjects) {
      GameMap.placeCampaignObjects(mapCfg);
    }

    // Создаём игрока (если первая карта) или перемещаем
    if (!this.player) {
      let startX = (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) / 2;
      let startY = (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) / 2;
      if (window.GameMap && GameMap.dungeon && GameMap.dungeon.startRoom) {
        const sp = GameMap.randomPointInRoom(GameMap.dungeon.startRoom, 18);
        if (sp) { startX = sp.x; startY = sp.y; }
      }
      this.player = Player.create(startX, startY);
      UI.rebuildSlots(this.player.weaponSlots.length, this.player.abilitySlots.length);
    } else {
      // Bug fix #7: если HP <= 0 (после смерти), пересоздаём героя полностью
      if (this.player.hp <= 0) {
        let startX = (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) / 2;
        let startY = (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) / 2;
        if (window.GameMap && GameMap.dungeon && GameMap.dungeon.startRoom) {
          const sp = GameMap.randomPointInRoom(GameMap.dungeon.startRoom, 18);
          if (sp) { startX = sp.x; startY = sp.y; }
        }
        this.player = Player.create(startX, startY);
        UI.rebuildSlots(this.player.weaponSlots.length, this.player.abilitySlots.length);
        // Сбрасываем счётчики забега
        this.kills = 0;
        this.runTime = 0;
        this.waveIndex = 0;
        this.runGold = 0;
        this.bossKills = 0;
      } else {
        // Перемещаем игрока в стартовую комнату новой карты
        let startX = (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) / 2;
        let startY = (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) / 2;
        if (window.GameMap && GameMap.dungeon && GameMap.dungeon.startRoom) {
          const sp = GameMap.randomPointInRoom(GameMap.dungeon.startRoom, 18);
          if (sp) { startX = sp.x; startY = sp.y; }
        }
        this.player.x = startX;
        this.player.y = startY;
      }
    }

    // Применить благословение мага (если есть, карта 5)
    if (window.Campaign && Campaign.mageBlessing && this.player) {
      // Уже применено через Campaign, но убедимся
    }

    // Волны
    if (!this.waveIndex) this.waveIndex = 0;
    this.waveTimer = CONFIG.WAVE.INITIAL_DELAY;
    this.chestTimer = CONFIG.CHEST.FIRST_DELAY;

    // Инициализация боссов для кампании (без глобальной ротации)
    if (window.Bosses) {
      if (!Bosses.globalRotation || Bosses.globalRotation.length === 0) {
        Bosses.init();
      }
    }

    // Мимик
    this.mimicState = (window.Enemies && Enemies.initMimicState)
      ? Enemies.initMimicState()
      : { count: 0, nextCheckTime: 180 };

    // Переключить состояние
    UI.hideAll();
    this.state = 'playing';
    this.kills = this.kills || 0;
    this.runTime = this.runTime || 0;

    // Показать название карты
    if (window.UI && UI.showCampaignMapName) {
      UI.showCampaignMapName(mapCfg.name);
    }
    // Шаг 18: музыка биома кампании
    if (window.GameAudio) {
      const biomeMusic = mapCfg.biome || 'crypt';
      GameAudio.playMusic(biomeMusic);
    }
  },

  /* ============================================================
     Шаг 3: Сундук — спавн, подбор, бросок d20.
     ============================================================ */

  /** Тик: уменьшаем таймер пока сундука нет (ровно "не копится при наличии"
   *  по ТЗ — но мы трактуем ровно как сказано: пока есть сундук, новый
   *  не появляется и таймер не идёт). При подборе таймер сбрасывается. */
  updateChest(dt) {
    if (this.chest) {
      Chest.update(this.chest, dt);
      // Подобрать
      if (Chest.pickedUpBy(this.chest, this.player)) {
        this.openChest();
      }
    } else {
      // Сундука нет — копится таймер (только после 5-й волны)
      const waveIndex = this.waveIndex || 0;
      if (waveIndex >= CONFIG.CHEST.MIN_WAVE) {
        this.chestTimer -= dt;
        if (this.chestTimer <= 0) {
          this.chest = Chest.spawnNear(this.player);
          this.chestTimer = CONFIG.CHEST.INTERVAL;
        }
      }
    }
    // Шаг 5: секретный сундук (за решёткой) — отдельная логика подбора
    if (this.secretChest) {
      Chest.update(this.secretChest, dt);
      if (Chest.pickedUpBy(this.secretChest, this.player)) {
        this.openSecretChest();
      }
    }
  },

  /** Шаг 5: создать сундук в секретной комнате (вызывается из GameMap при
   *  правильной комбинации рычагов). */
  spawnSecretChest() {
    if (this.secretChest) return;
    if (!window.GameMap || !GameMap.dungeon) return;
    const pos = GameMap.dungeon.secretChestPos;
    if (!pos) return;
    const c = Chest.create();
    c.x = pos.x; c.y = pos.y;
    c.guaranteedRare = true;
    if (window.Particles) Particles.chestGlow(c.x, c.y);
    this.secretChest = c;
  },

  /** Открытие секретного сундука: гарантированно бросок 19..20. */
  openSecretChest() {
    if (!this.secretChest) return;
    if (window.Particles) Particles.chestOpen(this.secretChest.x, this.secretChest.y);
    // Шаг 18: звук открытия сундука
    if (window.GameAudio) GameAudio.playSfx('chest');
    // Шаг 17: помечаем как секретный (практически не мимик)
    this._lastChestX = this.secretChest.x;
    this._lastChestY = this.secretChest.y;
    this._lastChestIsSecret = true;
    this.secretChest = null;

    this.state = 'chest';
    Input.releaseJoystick();

    // Гарантированный редкий бросок: 19 или 20
    const finalRoll = 19 + Math.floor(Math.random() * 2);
    // Шаг 18: звук броска d20
    if (window.GameAudio) GameAudio.playSfx('d20');
    UI.showD20Roll(finalRoll, () => this.resolveChest(finalRoll));
  },

  /** Подбор сундука: переход в state=chest, эффект открытия, бросок d20. */
  openChest() {
    if (!this.chest) return;
    // Шаг 17: сохраняем позицию сундука для возможного мимика
    this._lastChestX = this.chest.x;
    this._lastChestY = this.chest.y;
    this._lastChestIsSecret = false;

    // Визуальный эффект открытия в точке сундука
    if (window.Particles) Particles.chestOpen(this.chest.x, this.chest.y);
    // Шаг 18: звук открытия сундука
    if (window.GameAudio) GameAudio.playSfx('chest');
    // Сундук исчезает (логически — открыт)
    this.chest = null;

    // Переходим в "сундучный" state (игра паузится по факту:
    // update() выполняется только в state==='playing')
    this.state = 'chest';
    Input.releaseJoystick();

    // Бросок d20 с финальным значением, заданным заранее
    // Шаг 8: пассивка «Счастливчик» повышает минимальный результат
    let finalRoll = 1 + Math.floor(Math.random() * 20);
    const minRoll = 1 + (this.player.d20MinBonus || 0);
    if (finalRoll < minRoll) finalRoll = Math.min(minRoll, 20);
    // Трекинг статистики
    this._chestsOpened = (this._chestsOpened || 0) + 1;
    if (!this._bestD20Roll || finalRoll > this._bestD20Roll) this._bestD20Roll = finalRoll;
    // Шаг 18: звук броска d20
    if (window.GameAudio) GameAudio.playSfx('d20');
    UI.showD20Roll(finalRoll, () => this.resolveChest(finalRoll));
  },

  /** Применить результат броска (НОВАЯ ТАБЛИЦА d20). */
  resolveChest(roll) {
    const player = this.player;
    if (!player) { this.state = 'playing'; UI.hideAll(); return; }

    // === 1–5: МИМИК ===
    if (roll <= 5) {
      const reward = {
        title: 'МИМИК!',
        desc: 'Сундук превращается в мимика! Убейте его за опыт!',
      };
      UI.showChestReward(roll, reward, () => {
        // Спавним усиленного мимика (+30% HP и урона)
        if (window.Enemies && window.Game && Game.enemies) {
          const mx = this._lastChestX || player.x;
          const my = this._lastChestY || player.y;
          const mimic = Enemies.spawnByType ? Enemies.spawnByType(Game.enemies, 'mimic', mx, my) : null;
          if (mimic) {
            mimic.hp = Math.round(mimic.hp * 1.30);
            mimic.maxHp = mimic.hp;
            mimic._mimicDmgMul = 1.30;
            // При убийстве мимика дропнет 500-1000 XP
            mimic._mimicXpReward = Utils.randInt(500, 1000);
          }
        }
        this._afterChestClose();
      });
      return;
    }

    // === 6–10: ОПЫТ (сразу 1000–4000 XP) ===
    if (roll <= 10) {
      const xpAmount = Utils.randInt(1000, 4000);
      const reward = {
        title: 'Прилив опыта!',
        desc: `+${xpAmount} XP`,
      };
      player.xp += xpAmount;
      UI.showChestReward(roll, reward, () => this._afterChestClose());
      return;
    }

    // === 11–15: КАРТОЧКА (выбор 1 из 3) ===
    if (roll <= 15) {
      const choices = this.buildLevelUpChoices(3);
      UI.showChestPick(roll, choices, (chosen) => {
        if (chosen) chosen.apply(player);
        this._afterChestClose();
      });
      return;
    }

    // === 16–19: РЕДКАЯ КАРТОЧКА + ШАНС ЭВОЛЮЦИИ ===
    if (roll <= 19) {
      // Проверяем готовые эволюции
      const ready = (window.Evolutions && Evolutions.findReady) ? Evolutions.findReady(player) : [];
      if (ready.length > 0) {
        // Предлагаем выбор: эволюция ИЛИ карточка
        const choices = this.buildLevelUpChoices(3);
        // Показываем эволюцию
        if (ready.length === 1) {
          UI.showEvolutionDialog(roll, ready[0], (accepted) => {
            if (accepted) {
              Evolutions.apply(player, ready[0].recipe);
              if (window.Codex) Codex.unlockEvolution(ready[0].recipe.resultId);
              this._afterChestClose();
            } else {
              // Отказался от эволюции — даём карточку
              UI.showChestPick(roll, choices, (chosen) => {
                if (chosen) chosen.apply(player);
                this._afterChestClose();
              });
            }
          });
        } else {
          UI.showEvolutionChoice(roll, ready, (chosenPair) => {
            if (chosenPair) {
              Evolutions.apply(player, chosenPair.recipe);
              if (window.Codex) Codex.unlockEvolution(chosenPair.recipe.resultId);
              this._afterChestClose();
            } else {
              UI.showChestPick(roll, choices, (chosen) => {
                if (chosen) chosen.apply(player);
                this._afterChestClose();
              });
            }
          });
        }
      } else {
        // Нет готовых эволюций — редкая карточка
        const choices = this.buildLevelUpChoices(3);
        UI.showChestPick(roll, choices, (chosen) => {
          if (chosen) chosen.apply(player);
          this._afterChestClose();
        });
      }
      return;
    }

    // === 20: ЭКСКЛЮЗИВ / СУПЕР-ЭВОЛЮЦИЯ / ФОЛЛБЭК ===
    // Приоритет 1: эксклюзивное оружие (если есть свободный слот)
    if (Player.hasFreeWeaponSlot(player)) {
      const excl = this._tryGetExclusiveWeapon(player);
      if (excl) {
        excl.apply(player);
        UI.showChestReward(roll, excl, () => this._afterChestClose());
        return;
      }
    }
    // Приоритет 2: супер-эволюция
    const superReady = (window.Evolutions && Evolutions.findSuperReady) ? Evolutions.findSuperReady(player) : [];
    if (superReady.length > 0) {
      UI.showSuperEvolutionDialog(roll, superReady, (chosen) => {
        if (chosen) {
          Evolutions.applySuper(player, chosen.recipe);
          if (window.Codex) Codex.unlockEvolution(chosen.recipe.resultId);
        }
        this._afterChestClose();
      });
      return;
    }
    // Фоллбэк: редкая карточка + 3000 опыта
    player.xp += 3000;
    const choices = this.buildLevelUpChoices(3);
    UI.showChestPick(roll, choices, (chosen) => {
      if (chosen) chosen.apply(player);
      this._afterChestClose();
    });
  },

  /** Проверить обычные эволюции или дать фоллбэк (эксклюзив/большая награда). */
  _resolveChestEvolutionsOrFallback(roll, player) {
    const ready = (window.Evolutions && Evolutions.findReady) ? Evolutions.findReady(player) : [];
    if (ready.length > 0) {
      // Если несколько — показываем окно выбора эволюции
      if (ready.length === 1) {
        const pair = ready[0];
        UI.showEvolutionDialog(roll, pair, (accepted) => {
          if (accepted) {
            Evolutions.apply(player, pair.recipe);
            this._afterChestClose();
          } else {
            this._resolveChestExclusiveOrFallback(roll, player);
          }
        });
      } else {
        // Множественный выбор
        UI.showEvolutionChoice(roll, ready, (chosenPair) => {
          if (chosenPair) {
            Evolutions.apply(player, chosenPair.recipe);
            this._afterChestClose();
          } else {
            this._resolveChestExclusiveOrFallback(roll, player);
          }
        });
      }
      return;
    }

    this._resolveChestExclusiveOrFallback(roll, player);
  },

  /** Эксклюзивное оружие или большая награда как фоллбэк при d20=20. */
  _resolveChestExclusiveOrFallback(roll, player) {
    // d20=20 и нет эволюций — шанс эксклюзивного оружия
    if (roll >= 20 && Player.hasFreeWeaponSlot(player)) {
      const excl = this._tryGetExclusiveWeapon(player);
      if (excl) {
        UI.showChestReward(roll, excl, () => this._afterChestClose());
        excl.apply(player);
        return;
      }
    }
    // Большая награда
    const reward = this._buildBigReward(player);
    reward.apply(player);
    UI.showChestReward(roll, reward, () => this._afterChestClose());
  },

  /** Попробовать выдать случайное эксклюзивное оружие. */
  _tryGetExclusiveWeapon(player) {
    if (!window.EXCLUSIVE_WEAPON_INFO || !window.EXCLUSIVE_WEAPON_FACTORIES) return null;
    // Не давать то, что уже есть
    const available = EXCLUSIVE_WEAPON_INFO.filter(info => !Player.findWeapon(player, info.id));
    if (available.length === 0) return null;
    const info = available[Math.floor(Math.random() * available.length)];
    return {
      title: `⭐ Легендарное: ${info.name}`,
      desc: info.desc,
      id: info.id,
      apply(p) {
        const w = EXCLUSIVE_WEAPON_FACTORIES[info.id]();
        Player.addWeapon(p, w);
      },
    };
  },

  /** Подбор разовой "редкой" награды на 19..20 без эволюции. */
  _buildBigReward(player) {
    // Сначала пытаемся выдать новую вещь, если есть свободные слоты
    if (Player.hasFreeWeaponSlot(player)) {
      const missingWeapons = WEAPON_INFO.filter(info => !Player.findWeapon(player, info.id));
      if (missingWeapons.length > 0) {
        const info = missingWeapons[Math.floor(Math.random() * missingWeapons.length)];
        return {
          title: `Редкая находка: ${info.name}`,
          desc: info.desc,
          apply(p) {
            const w = WEAPON_FACTORIES[info.id]();
            Player.addWeapon(p, w);
          },
        };
      }
    }
    if (Player.hasFreeAbilitySlot(player)) {
      const missingAbilities = ABILITY_INFO.filter(info => !Player.findAbility(player, info.id));
      if (missingAbilities.length > 0) {
        const info = missingAbilities[Math.floor(Math.random() * missingAbilities.length)];
        return {
          title: `Редкая находка: ${info.name}`,
          desc: info.desc,
          apply(p) {
            const a = ABILITY_FACTORIES[info.id]();
            Player.addAbility(p, a);
          },
        };
      }
    }
    // Иначе — мощное разовое улучшение (rand один из вариантов)
    const variants = [
      {
        title: 'Мощное улучшение: HP',
        desc: 'Макс. HP +30%, лечение полностью.',
        apply(p) {
          p.maxHp = Math.round(p.maxHp * 1.30);
          p.hp = p.maxHp;
        },
      },
      {
        title: 'Мощное улучшение: Урон',
        desc: '+20% ко всему урону (стакается).',
        apply(p) { p.damageMul *= 1.20; },
      },
      {
        title: 'Мощное улучшение: Скорость',
        desc: '+15% к скорости передвижения.',
        apply(p) { p.speedMul *= 1.15; },
      },
    ];
    return variants[Math.floor(Math.random() * variants.length)];
  },

  /** Закрытие сундучного флоу: возврат к игре, отложенный левелап если набрали XP. */
  _afterChestClose() {
    UI.hideAll();
    this.state = 'playing';
    // Если очки опыта переполнили шкалу (например, после +20 XP или после
    // эволюции это не происходит — но на всякий случай) — обработаем.
    if (this.player && this.player.xp >= this.player.xpNext) {
      // отдадим в обычный update()-цикл — он сам переведёт в levelup
    }
  },

  /** Притянуть весь опыт мгновенно к игроку (эффект Soul Flame). */
  magnetizeAllXP() {
    if (!this.xpDrops || !this.player) return;
    Loot.magnetizeAll(this.xpDrops, this.player);
  },

  damageEnemy(e, dmg) {
    if (e.invulnerable) return;

    // Талант «Мгновенная казнь»: шанс мгновенно убить обычного врага (не босса)
    if (this.player && this.player._instantKillChance > 0 &&
        !e.isBoss && !e.isElite && Math.random() < this.player._instantKillChance) {
      e.hp = 0;
      if (window.Particles && Particles.text) {
        Particles.text(e.x, e.y - 20, 'КАЗНЬ!', 0.8, '#ff0000', 13);
      }
      this.killEnemy(e);
      return;
    }

    // Шаг 8: критический удар
    let finalDmg = dmg;
    if (this.player && this.player.critChance > 0 && Math.random() < this.player.critChance) {
      finalDmg *= 2;
      // Визуал крита
      if (window.Particles && Particles.text) {
        Particles.text(e.x, e.y - 20, 'КРИТ!', 0.6, '#ffff00', 12);
      }
    }

    e.hp -= finalDmg;

    // Шаг 8: вампиризм (лечение от нанесённого урона)
    if (this.player && this.player.lifesteal > 0) {
      const heal = finalDmg * this.player.lifesteal;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    }

    // Шаг 8: кровотечение
    if (this.player && this.player.bleedChance > 0 && Math.random() < this.player.bleedChance) {
      if (!e.bleed) e.bleed = { dps: 0, remaining: 0 };
      e.bleed.dps = 4 * (this.player.dotDamageMul || 1);
      e.bleed.remaining = 3;
    }

    if (e.hp <= 0) {
      this.killEnemy(e);
    } else if (window.Enemies && Enemies.handleHit) {
      Enemies.handleHit(e, this);
    }
  },

  killEnemy(e) {
    if (!e.active) return;
    // Хук: лужи / расщепление / взрыв
    if (window.Enemies && Enemies.handleDeath) {
      Enemies.handleDeath(e, this);
    }
    e.active = false;
    this.kills += 1;
    // Учёт по типам (заготовка для UI)
    const tid = (e.cfg && e.cfg.id) || e.type || 'unknown';
    this.killsByType[tid] = (this.killsByType[tid] || 0) + 1;

    // Бестиарий: разблокировать убитого врага
    if (window.Bestiary && tid !== 'unknown') {
      Bestiary.unlock(tid);
    }

    // Мимик из сундука: награда XP при убийстве
    if (e._mimicXpReward && e._mimicXpReward > 0) {
      const xpReward = e._mimicXpReward;
      if (this.xpDrops) {
        Loot.dropXPRaw(this.xpDrops, e.x, e.y, xpReward);
      }
      if (window.Particles) {
        Particles.text(e.x, e.y - 30, `+${xpReward} XP`, 1.5, '#ffd700', 14);
      }
    }

    // Шаг 8: взрывная смерть
    if (this.player && this.player.explosiveDeathChance > 0 &&
        Math.random() < this.player.explosiveDeathChance) {
      // Взрыв: урон 18, радиус 50px по всем врагам рядом
      const explosionDmg = 18 * this.player.damageMul;
      const explosionR2 = 50 * 50;
      const items = this.enemies.items;
      for (let i = 0; i < items.length; i++) {
        const other = items[i];
        if (!other.active || other === e) continue;
        const dx = other.x - e.x, dy = other.y - e.y;
        if (dx * dx + dy * dy <= explosionR2) {
          this.damageEnemy(other, explosionDmg);
        }
      }
      // Визуальный эффект взрыва
      if (window.Particles && Particles.burst) {
        Particles.burst(e.x, e.y, 8, {
          color: '#ff6600', speedMin: 60, speedMax: 140,
          lifeMin: 0.2, lifeMax: 0.4, sizeMin: 4, sizeMax: 7,
        });
      }
    }

    // Выпадение опыта по конфигу типа
    const cfg = e.cfg;
    const dropChance = (cfg && cfg.dropChance != null) ? cfg.dropChance : 0.6;
    // Шаг 6: увеличение выпадения кристаллов на 100% (удвоение шанса, макс 1.0)
    const finalDropChance = Math.min(1.0, dropChance * 2);
    if (Math.random() < finalDropChance) {
      let xpMin = (cfg && cfg.xp) ? cfg.xp[0] : CONFIG.ENEMY.XP_MIN;
      let xpMax = (cfg && cfg.xp) ? cfg.xp[1] : CONFIG.ENEMY.XP_MAX;
      let value = Utils.randInt(xpMin, xpMax);
      // Шаг 8: удвоение опыта
      if (this.player && this.player.doubleXpChance > 0 &&
          Math.random() < this.player.doubleXpChance) {
        value *= 2;
      }
      Loot.dropXP(this.xpDrops, e.x, e.y, value);
    }

    // Шаг 15: выпадение золота
    if (this.goldDrops) {
      Loot.tryDropGold(this.goldDrops, e);
    }

    // Шанс выпадения сундука с обычных мобов (3%, только после 5-й волны, не элитные/боссы)
    const waveIdx = this.waveIndex || 0;
    const isElite = e.cfg && (e.cfg.tier >= 4);
    if (waveIdx >= CONFIG.CHEST.MIN_WAVE && !isElite && Math.random() < CONFIG.CHEST.DROP_CHANCE && !this.chest) {
      const mobChest = Chest.spawnAt(e.x, e.y);
      if (mobChest) {
        this.chest = mobChest;
      }
    }

    // Шаг 16: кампания — проверка выпадения ключа
    if (window.Campaign && Campaign.active && e._hasKey) {
      Campaign.onKeyPickedUp();
    }
  },

  spawnTrailParticle(player, move) {
    const tp = this.particles.spawn();
    if (!tp) return;
    tp.kind = 'spark';
    tp.x = player.x; tp.y = player.y;
    tp.vx = -move.x * 20 + Utils.rand(-10, 10);
    tp.vy = -move.y * 20 + Utils.rand(-10, 10);
    tp.life = tp.maxLife = 0.35;
    tp.color = 'rgba(120,170,255,0.5)';
    tp.size = 4;
  },

  updateParticles(dt) {
    const items = this.particles.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active) continue;
      const done = (window.Particles && Particles.step) ? Particles.step(p, dt) : (p.life -= dt) <= 0;
      if (done) p.active = false;
    }
  },

  /* ----- рендер ----- */
  render() {
    const ctx = this.ctx;
    // Шаг 3: гарантируем crisp-pixels каждый кадр (setTransform может сбросить)
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    if (!this.player) return;

    // Feature #4: используем расширенную область камеры для рендера
    const camViewW = this.cameraViewW || this.viewW;
    const camViewH = this.cameraViewH || this.viewH;
    const camScale = this.cameraScale || 1;
    const cam = GameMap.getCamera(this.player, camViewW, camViewH);
    ctx.save();
    // Feature #4: масштабирование для увеличения радиуса видимости
    ctx.scale(camScale, camScale);
    ctx.translate(-cam.x, -cam.y);

    // Анимация парения для Небесного города (Sky Citadel)
    let _skyFloatOffset = 0;
    if (window.GameMap && GameMap.currentBiome && GameMap.currentBiome.floatingAnimation) {
      const amp = GameMap.currentBiome.floatAmplitude || 2;
      const spd = GameMap.currentBiome.floatSpeed || 1.5;
      _skyFloatOffset = Math.sin(this.runTime * spd) * amp;
      ctx.translate(0, _skyFloatOffset);
    }

    GameMap.render(ctx, cam, camViewW, camViewH);
    Loot.render(ctx, this.xpDrops, cam, camViewW, camViewH);
    // Шаг 15: рендер золота
    if (this.goldDrops) Loot.renderGold(ctx, this.goldDrops, cam, camViewW, camViewH);
    // Шаг 4: лужи и следы под врагами/героем
    if (GameMap.renderGroundEffects) GameMap.renderGroundEffects(ctx, cam, camViewW, camViewH);
    // Шаг 3: сундук рисуется в мире
    if (this.chest) Chest.render(ctx, this.chest, cam, camViewW, camViewH);
    if (this.secretChest) Chest.render(ctx, this.secretChest, cam, camViewW, camViewH);
    this.renderParticles(ctx, cam);
    Enemies.render(ctx, this.enemies, cam, camViewW, camViewH);
    // Шаг 6: рендер босса
    if (window.Bosses) Bosses.render(ctx, cam, camViewW, camViewH);
    // Шаг 6: рендер золотого сундука босса
    if (this.bossChest && window.Bosses) Bosses.renderBossChest(ctx, this.bossChest, cam, camViewW, camViewH);
    // Шаг 16: рендер объектов кампании
    if (window.Campaign && Campaign.active && window.GameMap && GameMap.renderCampaignObjects) {
      GameMap.renderCampaignObjects(ctx, cam, camViewW, camViewH);
    }
    Player.render(ctx, this.player);

    // Оверлей оружий поверх героя (например, взмах меча)
    for (const w of this.player.weaponSlots) {
      if (w && typeof w.renderOverlay === 'function') w.renderOverlay(ctx, this.player);
    }

    Projectiles.render(ctx, this.projectiles, cam, camViewW, camViewH);

    ctx.restore();

    // Шаг 6: полоса HP босса (экранные координаты)
    if (window.Bosses) {
      // Тряска экрана
      if (Bosses.screenShake > 0) {
        ctx.save();
        ctx.translate(Bosses.screenShakeX, Bosses.screenShakeY);
      }
      Bosses.renderHPBar(ctx, this.viewW, this.viewH);
      Bosses.renderDefeatedMsg(ctx, this.viewW, this.viewH);
      // Шаг 14: анонс имени босса
      Bosses.renderBossAnnounce(ctx, this.viewW, this.viewH);
      if (Bosses.screenShake > 0) {
        ctx.restore();
      }
    }

    // Индикатор сундука — экранные координаты, без сдвига камеры
    if (this.chest) Chest.renderIndicator(ctx, this.chest, cam, camViewW, camViewH);
    if (this.secretChest) Chest.renderIndicator(ctx, this.secretChest, cam, camViewW, camViewH);

    // Миникарта удалена

    // Шаг 17: подсказки загадок (экранные координаты)
    if (window.UI && UI.renderPuzzleHints) {
      UI.renderPuzzleHints(ctx, this.player, this.viewW, this.viewH);
    }

    // Шаг 13: анимация перехода (затемнение экрана)
    if (this.transitioning) {
      const progress = 1 - (this.transitionTimer / 0.8);
      ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, progress)})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
      // Текст
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, progress)})`;
      ctx.font = 'bold 20px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Переход в следующее подземелье...', this.viewW / 2, this.viewH / 2);
    }

    // Шаг 13: индикатор биома и номера карты
    if (window.GameMap && GameMap.currentBiome && this.state === 'playing') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '12px ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${GameMap.currentBiome.name} #${this.mapNumber || 1}`, 10, this.viewH - 24);
    }

    // Шаг 13: индикатор портала (стрелка к порталу)
    if (this.portalSpawned && window.GameMap && GameMap.portal && GameMap.portal.active) {
      this._renderPortalIndicator(ctx, cam);
    }
  },

  /** Шаг 13: Стрелка-индикатор направления к порталу. */
  _renderPortalIndicator(ctx, cam) {
    const portal = GameMap.portal;
    if (!portal || !this.player) return;
    const px = portal.x - cam.x, py = portal.y - cam.y;
    // Если портал на экране — не показываем стрелку
    if (px >= 0 && px <= this.viewW && py >= 0 && py <= this.viewH) return;
    // Стрелка у края экрана
    const cx = this.viewW / 2, cy = this.viewH / 2;
    const angle = Math.atan2(py - cy, px - cx);
    const margin = 30;
    const edgeX = Utils.clamp(cx + Math.cos(angle) * (this.viewW / 2 - margin), margin, this.viewW - margin);
    const edgeY = Utils.clamp(cy + Math.sin(angle) * (this.viewH / 2 - margin), margin, this.viewH - margin);
    // Рисуем стрелку
    ctx.save();
    ctx.translate(edgeX, edgeY);
    ctx.rotate(angle);
    ctx.fillStyle = PORTAL_CONFIG.COLOR_OUTER;
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(-6, -6);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Текст
    ctx.fillStyle = 'rgba(155, 89, 182, 0.8)';
    ctx.font = 'bold 11px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⟐', edgeX, edgeY - 12);
  },

  /* ============================================================
     Шаг 6: Босс — таймер, апдейт, проверка снарядов, хоминг, сундук.
     ============================================================ */

  /** Таймер и спавн босса (Шаг 14: ротация). */
  updateBoss(dt) {
    if (!window.Bosses) return;
    Bosses.update(this.player, dt);

    // Шаг 16: в кампании не спавним глобальных боссов по таймеру
    if (window.Campaign && Campaign.active) return;

    // Проверка таймера спавна глобального босса (из ротации)
    if (!Bosses.isGlobalAlive() && !Bosses.current && Bosses.bossIndex < BOSS_CONFIG.SPAWN_TIMES.length) {
      if (this.runTime >= Bosses.nextSpawnTime) {
        Bosses.spawnGlobalBoss(Bosses.bossIndex, this.player);
      }
    }

    // Шаг 14: дебафф от теневого дракона (снижение урона на время)
    if (this.player && this.player._darkDebuffTimer > 0) {
      this.player._darkDebuffTimer -= dt;
      if (this.player._darkDebuffTimer <= 0) {
        this.player._darkDebuff = 0;
      }
    }
  },

  /** Проверка попадания снарядов игрока в босса (Шаг 14: оба босса). */
  checkProjectilesVsBoss() {
    if (!window.Bosses || !Bosses.isAlive()) return;
    const items = this.projectiles.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active || p.owner !== 'player') continue;
      // Проверяем обоих боссов
      const target = Bosses.getClosestBoss(p.x, p.y);
      if (!target) continue;
      const bossR = Math.max(target.cfg.w, target.cfg.h) * 0.45;
      const dx = target.x - p.x, dy = target.y - p.y;
      const hitR = bossR + p.radius;
      if (dx * dx + dy * dy <= hitR * hitR) {
        Bosses.damage(p.damage, target);
        p.active = false;
        if (window.Particles) {
          Particles.burst(p.x, p.y, 3, {
            color: '#ffffff', speedMin: 30, speedMax: 80,
            lifeMin: 0.1, lifeMax: 0.25, sizeMin: 2, sizeMax: 3,
          });
        }
      }
    }
  },

  /** Проверка мили-оружий на попадание в босса (Шаг 14: оба босса). */
  checkMeleeVsBoss() {
    if (!window.Bosses || !Bosses.isAlive()) return;
    const p = this.player;
    // Проверяем попадание в каждого живого босса
    const targets = [];
    if (Bosses.current && Bosses.current.hp > 0) targets.push(Bosses.current);
    if (Bosses.guardian && Bosses.guardian.hp > 0) targets.push(Bosses.guardian);

    for (const boss of targets) {
      for (const w of p.weaponSlots) {
        if (!w) continue;
        const r = w.radius || 60;
        const dx = boss.x - p.x, dy = boss.y - p.y;
        const d2 = dx * dx + dy * dy;

        // Swing-based (Sword, Axe, VampireBlade)
        if (w.swing && w.swing.active && w.swing.t <= 0.05) {
          if (d2 > r * r) continue;
          const a = Math.atan2(dy, dx);
          let diff = a - w.swing.angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const halfArc = (w.arc || Math.PI) * 0.5;
          if (Math.abs(diff) <= halfArc) {
            Bosses.damage((w.damageAt ? w.damageAt() : 20) * p.damageMul, boss);
          }
          continue;
        }
        // Thrust-based (Spear)
        if (w.thrust && w.thrust.active && w.thrust.t <= 0.05) {
          const cos = Math.cos(w.thrust.angle), sin = Math.sin(w.thrust.angle);
          const along = dx * cos + dy * sin;
          const across = -dx * sin + dy * cos;
          if (along >= 0 && along <= (w.range || 100) && Math.abs(across) <= 30) {
            Bosses.damage((w.damageAt ? w.damageAt() : 18) * p.damageMul, boss);
          }
          continue;
        }
        // Slam-based (Hammer)
        if (w.slam && w.slam.active && w.slam.t <= 0.05) {
          if (d2 <= r * r) {
            Bosses.damage((w.damageAt ? w.damageAt() : 20) * p.damageMul, boss);
          }
          continue;
        }
        // Whip
        if (w.whipAnim && w.whipAnim.active && w.whipAnim.t <= 0.05) {
          const bossR = Math.max(boss.cfg.w, boss.cfg.h) * 0.45;
          if (d2 <= (w.range + bossR) * (w.range + bossR)) {
            Bosses.damage((w.damageAt ? w.damageAt() : 14) * p.damageMul, boss);
          }
          continue;
        }
      }
    }
  },

  /** Хоминг для снарядов босса (лич: boss_bolt). */
  updateHomingProjectiles(dt) {
    if (!this.player) return;
    const items = this.projectiles.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active || !p.homing) continue;
      const dx = this.player.x - p.x, dy = this.player.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      const strength = p.homingStrength || 2.0;
      const speed = Math.hypot(p.vx, p.vy) || 250;
      // Плавно поворачиваем вектор скорости к игроку
      const targetVx = (dx / dist) * speed;
      const targetVy = (dy / dist) * speed;
      p.vx += (targetVx - p.vx) * strength * dt;
      p.vy += (targetVy - p.vy) * strength * dt;
      // Нормализуем, чтобы скорость не менялась
      const curSpeed = Math.hypot(p.vx, p.vy) || 1;
      p.vx = (p.vx / curSpeed) * speed;
      p.vy = (p.vy / curSpeed) * speed;
      p.angle = Math.atan2(p.vy, p.vx);
    }
  },

  /** Обновление золотого сундука босса (подбор без d20). */
  updateBossChest(dt) {
    if (!this.bossChest) return;
    // Проверка подбора
    const r = 30 + this.player.size * 0.5;
    const dx = this.bossChest.x - this.player.x;
    const dy = this.bossChest.y - this.player.y;
    if (dx * dx + dy * dy <= r * r) {
      this.openBossChest();
    }
  },

  /** Открытие золотого сундука босса: сразу карты без d20, с гарантированной редкой. */
  openBossChest() {
    if (!this.bossChest) return;
    if (window.Particles) Particles.chestOpen(this.bossChest.x, this.bossChest.y);
    this.bossChest = null;

    this.state = 'chest';
    Input.releaseJoystick();

    // 20% шанс эксклюзивного оружия
    if (Math.random() < 0.20 && Player.hasFreeWeaponSlot(this.player)) {
      const excl = this._tryGetExclusiveWeapon(this.player);
      if (excl) {
        excl.apply(this.player);
        UI.showChestReward(20, { title: excl.title, desc: excl.desc }, () => this._afterChestClose());
        return;
      }
    }

    // Карты: 3 штуки, одна гарантированно "сильная"
    const choices = this._buildBossChestChoices();
    UI.showChestPick(20, choices, (chosen) => {
      if (chosen) chosen.apply(this.player);
      this._afterChestClose();
    });
  },

  /** Формирует набор карт для сундука босса (одна гарантированно редкая). */
  _buildBossChestChoices() {
    const p = this.player;
    const choices = [];

    // 1) Попытка предложить эволюцию
    const ready = (window.Evolutions && Evolutions.findReady) ? Evolutions.findReady(p) : [];
    if (ready.length > 0) {
      const pair = ready[0];
      const r = pair.recipe;
      choices.push({
        kind: 'weapon',
        icon: r.resultIcon,
        id: r.resultId,
        title: `Эволюция: ${r.resultName}`,
        desc: r.desc,
        apply(player) { Evolutions.apply(player, r); },
      });
    }

    // 2) Заполняем оставшиеся слоты из buildLevelUpChoices
    const fillers = this.buildLevelUpChoices(3 - choices.length + 2); // больше, чтобы было из чего выбрать
    // Убираем дубликаты
    for (const f of fillers) {
      if (choices.length >= 3) break;
      if (!choices.find(c => c.title === f.title)) choices.push(f);
    }

    // Если мало вариантов — добавляем мощные разовые
    while (choices.length < 3) {
      const big = this._buildBigReward(p);
      choices.push({
        kind: 'basic',
        icon: '★',
        title: big.title,
        desc: big.desc,
        apply(player) { big.apply(player); },
      });
    }

    return choices.slice(0, 3);
  },

  renderParticles(ctx, cam) {
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + this.viewW, maxY = cam.y + this.viewH;
    const items = this.particles.items;
    for (let i = 0; i < items.length; i++) {
      const pa = items[i];
      if (!pa.active) continue;
      // 'ring' может быть большой — пропускаем bbox-cull для них
      const pad = pa.kind === 'ring' ? (pa.maxRadius || 0) : 12;
      if (pa.x + pad < minX || pa.x - pad > maxX || pa.y + pad < minY || pa.y - pad > maxY) continue;
      if (window.Particles && Particles.draw) {
        Particles.draw(ctx, pa);
      } else {
        // Фолбэк: квадрат старого формата
        const a = Math.max(0, pa.life / pa.maxLife);
        ctx.globalAlpha = a;
        ctx.fillStyle = pa.color;
        ctx.fillRect(pa.x - pa.size * 0.5, pa.y - pa.size * 0.5, pa.size, pa.size);
        ctx.globalAlpha = 1;
      }
    }
  },

  /* ============================================================
     Шаг 9-10: Отражение снарядов врагов своими снарядами.
     Снаряды игрока могут столкнуться с вражескими и уничтожить их.
     Более сильные вражеские снаряды требуют 2+ попаданий.
     ============================================================ */
  updateProjectileReflection() {
    const items = this.projectiles.items;
    for (let i = 0; i < items.length; i++) {
      const ep = items[i];
      if (!ep.active || ep.owner !== 'enemy') continue;
      // Определяем "уровень сложности" вражеского снаряда
      let hitsNeeded = 1;
      if (ep.kind === 'boss_bolt' || ep.kind === 'boss_fireball') hitsNeeded = 3;
      else if (ep.kind === 'boss_web') hitsNeeded = 2;
      else if (ep.kind === 'magebolt' || ep.kind === 'breath') hitsNeeded = 2;

      // Проверяем столкновение со снарядами игрока
      for (let j = 0; j < items.length; j++) {
        const pp = items[j];
        if (!pp.active || pp.owner !== 'player') continue;
        const dx = ep.x - pp.x, dy = ep.y - pp.y;
        const hitR = ep.radius + pp.radius + 4;
        if (dx * dx + dy * dy <= hitR * hitR) {
          // Попадание: уменьшаем hitsNeeded
          if (!ep._reflectHits) ep._reflectHits = 0;
          ep._reflectHits++;
          pp.active = false; // Наш снаряд расходуется

          if (ep._reflectHits >= hitsNeeded) {
            ep.active = false; // Вражеский снаряд уничтожен
            // Визуальный эффект
            if (window.Particles && Particles.burst) {
              Particles.burst(ep.x, ep.y, 5, {
                color: '#ffffff', speedMin: 40, speedMax: 120,
                lifeMin: 0.15, lifeMax: 0.3, sizeMin: 2, sizeMax: 4,
              });
            }
          } else {
            // Частичное попадание - искры
            if (window.Particles && Particles.burst) {
              Particles.burst(ep.x, ep.y, 3, {
                color: '#ffff00', speedMin: 30, speedMax: 80,
                lifeMin: 0.1, lifeMax: 0.2, sizeMin: 1, sizeMax: 3,
              });
            }
          }
          break; // Один снаряд игрока за кадр на один вражеский
        }
      }
    }
  },
};

window.Game = Game;


/* ============================================================
   FAVICON & ICON GENERATOR — programmatic d20 icon
   ============================================================ */
const IconGenerator = {
  generate(size) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const ctx = c.getContext('2d');

    // Background
    ctx.fillStyle = '#1a1210';
    ctx.fillRect(0, 0, size, size);

    // Draw d20 shape (hexagon approximation)
    const cx = size / 2, cy = size / 2;
    const r = size * 0.38;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = '#2a1f14';
    ctx.fill();
    ctx.strokeStyle = '#c9a84c';
    ctx.lineWidth = size * 0.04;
    ctx.stroke();

    // Inner triangle lines
    ctx.strokeStyle = 'rgba(201,168,76,0.3)';
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.7);
    ctx.lineTo(cx - r * 0.6, cy + r * 0.5);
    ctx.lineTo(cx + r * 0.6, cy + r * 0.5);
    ctx.closePath();
    ctx.stroke();

    // Number "20"
    ctx.fillStyle = '#c9a84c';
    ctx.font = `bold ${size * 0.3}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('20', cx, cy + size * 0.02);

    return c.toDataURL('image/png');
  },

  install() {
    const favicon32 = this.generate(32);
    const favicon64 = this.generate(64);
    const icon192 = this.generate(192);

    const faviconEl = document.getElementById('favicon');
    if (faviconEl) faviconEl.href = favicon64;

    const touchEl = document.getElementById('touchIcon');
    if (touchEl) touchEl.href = icon192;
  }
};

window.IconGenerator = IconGenerator;


/* ============================================================
   TITLE SCREEN
   ============================================================ */
const TitleScreen = {
  el: null,
  shown: false,
  autoTimer: null,

  init() {
    this.el = document.getElementById('titleScreen');
    if (!this.el) return;

    // Check if first launch
    const launched = localStorage.getItem('d20_firstLaunch');
    if (launched) {
      // Not first launch — skip title screen
      this.el.classList.add('hidden');
      this.shown = true;
      return;
    }

    // First launch — show title, draw runes
    this._drawRunes();
    this.shown = false;

    // Event listeners for dismissal
    const dismiss = () => {
      if (this.shown) return;
      this.shown = true;
      localStorage.setItem('d20_firstLaunch', '1');
      this.el.style.transition = 'opacity 0.5s ease';
      this.el.style.opacity = '0';
      setTimeout(() => {
        this.el.classList.add('hidden');
        this.el.style.opacity = '';
        // Start the game (show camp)
        Game._afterTitleDismissed();
      }, 500);
      if (this.autoTimer) clearTimeout(this.autoTimer);
    };

    this.el.addEventListener('click', dismiss);
    this.el.addEventListener('touchstart', dismiss, { passive: true });

    // Auto-dismiss after 4 seconds
    this.autoTimer = setTimeout(dismiss, 4000);
  },

  _drawRunes() {
    const runesEl = document.getElementById('titleRunes');
    if (!runesEl) return;
    // Draw decorative rune SVG lines on canvas
    const c = document.createElement('canvas');
    c.width = window.innerWidth;
    c.height = window.innerHeight;
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
    const ctx = c.getContext('2d');
    ctx.strokeStyle = 'rgba(201,168,76,0.5)';
    ctx.lineWidth = 1;

    // Draw cracks / rune lines
    const numLines = 12;
    for (let i = 0; i < numLines; i++) {
      ctx.beginPath();
      let x = Math.random() * c.width;
      let y = Math.random() * c.height;
      ctx.moveTo(x, y);
      const segs = 3 + Math.floor(Math.random() * 4);
      for (let j = 0; j < segs; j++) {
        x += (Math.random() - 0.5) * 120;
        y += (Math.random() - 0.5) * 120;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Draw rune symbols at intersections
    const runes = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᛁ', 'ᛃ', 'ᛈ'];
    ctx.font = '16px serif';
    ctx.fillStyle = 'rgba(201,168,76,0.4)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 8; i++) {
      const rx = Math.random() * c.width;
      const ry = Math.random() * c.height;
      ctx.fillText(runes[Math.floor(Math.random() * runes.length)], rx, ry);
    }

    runesEl.appendChild(c);
  },

  isActive() {
    return !this.shown;
  }
};

window.TitleScreen = TitleScreen;


/* ============================================================
   LOADING SCREEN
   ============================================================ */
const LoadingScreen = {
  el: null,
  dieEl: null,
  _interval: null,

  init() {
    this.el = document.getElementById('loadingScreen');
    this.dieEl = document.getElementById('loadingDie');
  },

  show() {
    if (!this.el) return;
    this.el.classList.add('active');
    // Animate number
    this._interval = setInterval(() => {
      if (this.dieEl) this.dieEl.textContent = String(1 + Math.floor(Math.random() * 20));
    }, 100);
  },

  hide() {
    if (!this.el) return;
    this.el.classList.remove('active');
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
  }
};

window.LoadingScreen = LoadingScreen;


/* ============================================================
   BOOT
   ============================================================ */
window.addEventListener('load', () => {
  // Generate and install favicon/icons
  IconGenerator.install();

  // Initialize loading screen
  LoadingScreen.init();

  // Initialize UI
  UI.init();

  // Initialize title screen
  TitleScreen.init();

  // If title was skipped (not first launch), boot game immediately
  if (TitleScreen.shown) {
    Game.init();
  }
  // Otherwise, Game.init() will be called after title dismissal via _afterTitleDismissed

  // Prevent context menu on long press (for mobile WebView)
  document.addEventListener('contextmenu', (e) => e.preventDefault());
});

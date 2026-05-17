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
    apply(p) { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 20); }, available() { return true; } },
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

    GameMap.precompute();
    Input.init();
    GameAudio.init();

    // UI bindings
    document.getElementById('startBtn').addEventListener('click',   () => this.startNewGame());
    document.getElementById('restartBtn').addEventListener('click', () => this.startNewGame());
    document.getElementById('resumeBtn').addEventListener('click',  () => this.togglePause());
    document.getElementById('pauseBtn').addEventListener('click',   () => this.togglePause());

    this.lastTs = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  },

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.viewW = w;
    this.viewH = h;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  },

  /* ----- состояния ----- */
  startNewGame() {
    this.enemies.clearAll();
    this.projectiles.clearAll();
    this.xpDrops.clearAll();
    this.particles.clearAll();
    if (window.GameMap && GameMap.clearGroundEffects) GameMap.clearGroundEffects();

    // Шаг 5: генерируем подземелье ДО создания игрока, чтобы поместить его в стартовую комнату.
    if (window.GameMap && GameMap.generateDungeon) {
      GameMap.generateDungeon();
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
    let startX = CONFIG.MAP.W / 2, startY = CONFIG.MAP.H / 2;
    if (window.GameMap && GameMap.dungeon && GameMap.dungeon.startRoom) {
      const sp = GameMap.randomPointInRoom(GameMap.dungeon.startRoom, 18);
      if (sp) { startX = sp.x; startY = sp.y; }
    }
    this.player = Player.create(startX, startY);

    UI.hideAll();
    this.state = 'playing';
  },

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      Input.releaseJoystick();
      UI.showPause();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      UI.hideAll();
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
          title: `Новое: ${info.name}`,
          desc: info.desc,
          apply(player) {
            const w = WEAPON_FACTORIES[info.id]();
            Player.addWeapon(player, w);
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
          title: `Новая: ${info.name}`,
          desc: info.desc,
          apply(player) {
            const a = ABILITY_FACTORIES[info.id]();
            Player.addAbility(player, a);
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
    UI.showGameOver({
      time: Utils.formatTime(this.runTime),
      kills: this.kills,
      level: this.player.level,
    });
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
    const cam = GameMap.getCamera(this.player, this.viewW, this.viewH);
    Projectiles.update(
      this.projectiles, this.enemies, cam, this.viewW, this.viewH,
      (e, dmg) => this.damageEnemy(e, dmg),
      dt
    );

    // Шаг 6: проверка попадания снарядов игрока в босса
    this.checkProjectilesVsBoss();
    // Шаг 6: хоминг для снарядов босса (лич)
    this.updateHomingProjectiles(dt);

    // Шаг 6: яд от паука-королевы
    if (this.player.poison && this.player.poison.remaining > 0) {
      this.player.hp -= this.player.poison.dps * dt;
      this.player.poison.remaining -= dt;
    }
    // Шаг 6: замедление от паутины
    if (this.player.webSlow && this.player.webSlow > 0) {
      this.player.webSlow -= dt;
    }

    // Лут и частицы
    Loot.update(this.xpDrops, this.player, dt);
    this.updateChest(dt);
    this.updateBossChest(dt);
    this.updateParticles(dt);

    // Левелап
    if (this.player.xp >= this.player.xpNext) {
      this.player.xp -= this.player.xpNext;
      this.player.level += 1;
      this.player.xpNext = Math.floor(CONFIG.XP.BASE * Math.pow(CONFIG.XP.GROWTH, this.player.level - 1));
      this.triggerLevelUp();
    }

    // Смерть
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.triggerGameOver();
    }
  },

  updateBuiltInMissile(/* dt */) {
    const p = this.player;
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

    const count = p.missileCount;
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
      pr.damage = CONFIG.MISSILE.DAMAGE * p.damageMul;
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
      // Сундука нет — копится таймер
      this.chestTimer -= dt;
      if (this.chestTimer <= 0) {
        this.chest = Chest.spawnNear(this.player);
        this.chestTimer = CONFIG.CHEST.INTERVAL;
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
    this.secretChest = null;

    this.state = 'chest';
    Input.releaseJoystick();

    // Гарантированный редкий бросок: 19 или 20
    const finalRoll = 19 + Math.floor(Math.random() * 2);
    UI.showD20Roll(finalRoll, () => this.resolveChest(finalRoll));
  },

  /** Подбор сундука: переход в state=chest, эффект открытия, бросок d20. */
  openChest() {
    if (!this.chest) return;
    // Визуальный эффект открытия в точке сундука
    if (window.Particles) Particles.chestOpen(this.chest.x, this.chest.y);
    // Сундук исчезает (логически — открыт)
    this.chest = null;

    // Переходим в "сундучный" state (игра паузится по факту:
    // update() выполняется только в state==='playing')
    this.state = 'chest';
    Input.releaseJoystick();

    // Бросок d20 с финальным значением, заданным заранее
    const finalRoll = 1 + Math.floor(Math.random() * 20);
    UI.showD20Roll(finalRoll, () => this.resolveChest(finalRoll));
  },

  /** Применить результат броска. */
  resolveChest(roll) {
    const player = this.player;
    if (!player) { this.state = 'playing'; UI.hideAll(); return; }

    // 1..10 — символическая награда: +20 XP
    if (roll <= 10) {
      const reward = {
        title: roll <= 3 ? 'Сундук пуст…' : 'Скромная находка',
        desc: '+20 очков опыта.',
      };
      player.xp += 20;
      // Если набралось — обработаем левелап после закрытия окна
      UI.showChestReward(roll, reward, () => this._afterChestClose());
      return;
    }

    // 11..18 — выбор одного улучшения (как левелап без +1 ур.)
    if (roll <= 18) {
      const choices = this.buildLevelUpChoices(3);
      UI.showChestPick(roll, choices, (chosen) => {
        if (chosen) chosen.apply(player);
        this._afterChestClose();
      });
      return;
    }

    // 19..20 — редкая награда
    const ready = (window.Evolutions && Evolutions.findReady) ? Evolutions.findReady(player) : [];
    if (ready.length > 0) {
      // Берём первую готовую пару (по порядку слотов)
      const pair = ready[0];
      UI.showEvolutionDialog(roll, pair, (accepted) => {
        if (accepted) {
          Evolutions.apply(player, pair.recipe);
          this._afterChestClose();
        } else {
          // Отказ — даём обычную награду через окно выбора
          const choices = this.buildLevelUpChoices(3);
          UI.showChestPick(roll, choices, (chosen) => {
            if (chosen) chosen.apply(player);
            this._afterChestClose();
          });
        }
      });
      return;
    }

    // Готовых пар нет — даём мощную разовую награду или новую вещь
    const reward = this._buildBigReward(player);
    reward.apply(player);
    UI.showChestReward(roll, reward, () => this._afterChestClose());
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
    e.hp -= dmg;
    e.flash = 0.08;
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

    // Выпадение опыта по конфигу типа
    const cfg = e.cfg;
    const dropChance = (cfg && cfg.dropChance != null) ? cfg.dropChance : 0.6;
    // Шаг 6: увеличение выпадения кристаллов на 100% (удвоение шанса, макс 1.0)
    const finalDropChance = Math.min(1.0, dropChance * 2);
    if (Math.random() < finalDropChance) {
      let xpMin = (cfg && cfg.xp) ? cfg.xp[0] : CONFIG.ENEMY.XP_MIN;
      let xpMax = (cfg && cfg.xp) ? cfg.xp[1] : CONFIG.ENEMY.XP_MAX;
      const value = Utils.randInt(xpMin, xpMax);
      Loot.dropXP(this.xpDrops, e.x, e.y, value);
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
    ctx.fillStyle = '#1f1f1f';
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    if (!this.player) return;

    const cam = GameMap.getCamera(this.player, this.viewW, this.viewH);
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    GameMap.render(ctx, cam, this.viewW, this.viewH);
    Loot.render(ctx, this.xpDrops, cam, this.viewW, this.viewH);
    // Шаг 4: лужи и следы под врагами/героем
    if (GameMap.renderGroundEffects) GameMap.renderGroundEffects(ctx, cam, this.viewW, this.viewH);
    // Шаг 3: сундук рисуется в мире
    if (this.chest) Chest.render(ctx, this.chest, cam, this.viewW, this.viewH);
    if (this.secretChest) Chest.render(ctx, this.secretChest, cam, this.viewW, this.viewH);
    this.renderParticles(ctx, cam);
    Enemies.render(ctx, this.enemies, cam, this.viewW, this.viewH);
    // Шаг 6: рендер босса
    if (window.Bosses) Bosses.render(ctx, cam, this.viewW, this.viewH);
    // Шаг 6: рендер золотого сундука босса
    if (this.bossChest && window.Bosses) Bosses.renderBossChest(ctx, this.bossChest, cam, this.viewW, this.viewH);
    Player.render(ctx, this.player);

    // Оверлей оружий поверх героя (например, взмах меча)
    for (const w of this.player.weaponSlots) {
      if (w && typeof w.renderOverlay === 'function') w.renderOverlay(ctx, this.player);
    }

    Projectiles.render(ctx, this.projectiles, cam, this.viewW, this.viewH);

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
      if (Bosses.screenShake > 0) {
        ctx.restore();
      }
    }

    // Индикатор сундука — экранные координаты, без сдвига камеры
    if (this.chest) Chest.renderIndicator(ctx, this.chest, cam, this.viewW, this.viewH);
    if (this.secretChest) Chest.renderIndicator(ctx, this.secretChest, cam, this.viewW, this.viewH);

    // Шаг 5: миникарта
    if (GameMap.renderMinimap) GameMap.renderMinimap(ctx, this.player, this.viewW, this.viewH);
  },

  /* ============================================================
     Шаг 6: Босс — таймер, апдейт, проверка снарядов, хоминг, сундук.
     ============================================================ */

  /** Таймер и спавн босса. */
  updateBoss(dt) {
    if (!window.Bosses) return;
    Bosses.update(this.player, dt);

    // Проверка таймера спавна
    if (!Bosses.isAlive() && !Bosses.current && Bosses.bossIndex < BOSS_CONFIG.SPAWN_TIMES.length) {
      if (this.runTime >= Bosses.nextSpawnTime) {
        const bossId = BOSS_CONFIG.SPAWN_ORDER[Bosses.bossIndex];
        Bosses.spawn(bossId, this.player);
      }
    }
  },

  /** Проверка попадания снарядов игрока в босса. */
  checkProjectilesVsBoss() {
    if (!window.Bosses || !Bosses.isAlive()) return;
    const boss = Bosses.current;
    const bossR = Math.max(boss.cfg.w, boss.cfg.h) * 0.45;
    const items = this.projectiles.items;
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p.active || p.owner !== 'player') continue;
      const dx = boss.x - p.x, dy = boss.y - p.y;
      const hitR = bossR + p.radius;
      if (dx * dx + dy * dy <= hitR * hitR) {
        Bosses.damage(p.damage);
        p.active = false;
        // Частицы попадания
        if (window.Particles) {
          Particles.burst(p.x, p.y, 3, {
            color: '#ffffff', speedMin: 30, speedMax: 80,
            lifeMin: 0.1, lifeMax: 0.25, sizeMin: 2, sizeMax: 3,
          });
        }
      }
    }
  },

  /** Проверка мили-оружий на попадание в босса (отдельная проверка). */
  checkMeleeVsBoss() {
    if (!window.Bosses || !Bosses.isAlive()) return;
    const boss = Bosses.current;
    const p = this.player;
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
          Bosses.damage((w.damageAt ? w.damageAt() : 20) * p.damageMul);
        }
        continue;
      }
      // Thrust-based (Spear)
      if (w.thrust && w.thrust.active && w.thrust.t <= 0.05) {
        const cos = Math.cos(w.thrust.angle), sin = Math.sin(w.thrust.angle);
        const along = dx * cos + dy * sin;
        const across = -dx * sin + dy * cos;
        if (along >= 0 && along <= (w.range || 100) && Math.abs(across) <= 30) {
          Bosses.damage((w.damageAt ? w.damageAt() : 18) * p.damageMul);
        }
        continue;
      }
      // Slam-based (Hammer)
      if (w.slam && w.slam.active && w.slam.t <= 0.05) {
        if (d2 <= r * r) {
          Bosses.damage((w.damageAt ? w.damageAt() : 20) * p.damageMul);
        }
        continue;
      }
      // Whip
      if (w.whipAnim && w.whipAnim.active && w.whipAnim.t <= 0.05) {
        const bossR = Math.max(boss.cfg.w, boss.cfg.h) * 0.45;
        if (d2 <= (w.range + bossR) * (w.range + bossR)) {
          Bosses.damage((w.damageAt ? w.damageAt() : 14) * p.damageMul);
        }
        continue;
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
};

window.Game = Game;


/* ============================================================
   BOOT
   ============================================================ */
window.addEventListener('load', () => {
  UI.init();
  Game.init();
});

'use strict';
/* ============================================================
   bosses.js — Система мини-боссов (Шаг 6).

   Архитектура:
   - Один активный босс на карте (Bosses.current).
   - Босс — отдельный объект (не в пуле enemies).
   - Bosses.update(player, dt) — ИИ, атаки, фазы.
   - Bosses.render(ctx, cam, viewW, viewH) — отрисовка босса.
   - Bosses.spawn(bossId, player) — появление босса.
   - Bosses.damage(dmg) — нанесение урона боссу.
   - Bosses.isAlive() — жив ли текущий босс.
   ============================================================ */

const Bosses = {
  current: null,          // текущий активный босс или null
  bossIndex: 0,           // индекс следующего босса (0..3)
  nextSpawnTime: 0,       // время следующего появления (runTime)
  defeatedMsg: 0,         // таймер сообщения «Босс повержен!»
  screenShake: 0,         // таймер тряски экрана
  screenShakeX: 0,
  screenShakeY: 0,

  /** Инициализация состояния боссов для нового забега. */
  init() {
    this.current = null;
    this.bossIndex = 0;
    this.nextSpawnTime = BOSS_CONFIG.SPAWN_TIMES[0];
    this.defeatedMsg = 0;
    this.screenShake = 0;
    this.screenShakeX = 0;
    this.screenShakeY = 0;
  },

  /** Проверка: жив ли текущий босс. */
  isAlive() {
    return this.current !== null && this.current.hp > 0;
  },

  /** Спавн босса по ID. Появляется в случайной комнате вдали от героя. */
  spawn(bossId, player) {
    const cfg = BOSS_TYPES[bossId];
    if (!cfg) return;

    const boss = {
      cfg: cfg,
      id: bossId,
      x: 0, y: 0,
      vx: 0, vy: 0,
      hp: cfg.hp,
      maxHp: cfg.hp,
      flash: 0,
      spawnAnim: 0.5,       // анимация появления (0.5 сек)
      phase: 1,             // 1 или 2
      facing: { x: 0, y: 1 },

      // Кулдауны атак
      slashCd: 0,
      whirlwindCd: 0,
      boltCd: 0,
      summonCd: 0,
      darkExplosionCd: 0,
      teleportCd: 0,
      webCd: 0,
      fireballCd: 0,
      fireRingCd: 0,
      trailCd: 0,
      hitCooldown: 0,

      // Специальные флаги
      minionsSpawned: false,  // паук-королева: призвала миньонов при 50% HP
      deathExploded: false,   // элементаль: взорвался при смерти

      // Визуальные таймеры атак
      slashAnim: 0,
      whirlwindAnim: 0,
      darkExplosionAnim: 0,
      fireRingAnim: 0,
      fireRingRadius: 0,
    };

    // Выбрать точку спавна
    let sx, sy;
    const m = Math.max(cfg.w, cfg.h) * 0.5;
    if (window.GameMap && GameMap.dungeon) {
      const pt = GameMap.randomEnemySpawnPoint(player, 350, 600);
      if (pt) { sx = pt.x; sy = pt.y; }
      else { sx = player.x + 400; sy = player.y; }
    } else {
      const ang = Math.random() * Math.PI * 2;
      sx = player.x + Math.cos(ang) * 450;
      sy = player.y + Math.sin(ang) * 450;
    }
    boss.x = Utils.clamp(sx, m, CONFIG.MAP.W - m);
    boss.y = Utils.clamp(sy, m, CONFIG.MAP.H - m);

    this.current = boss;

    // Эффект появления: вспышка + частицы
    if (window.Particles) {
      Particles.ring(boss.x, boss.y, 80, 0.5, 'rgba(255, 200, 50, 0.9)', 4);
      Particles.ring(boss.x, boss.y, 50, 0.4, 'rgba(255, 80, 30, 0.8)', 3);
      Particles.burst(boss.x, boss.y, 15, {
        color: '#ffd700',
        speedMin: 80, speedMax: 200,
        lifeMin: 0.5, lifeMax: 0.9,
        sizeMin: 3, sizeMax: 5,
      });
    }
  },

  /** Нанести урон боссу. */
  damage(dmg) {
    if (!this.current || this.current.hp <= 0) return;
    if (this.current.spawnAnim > 0) return; // неуязвим во время появления

    this.current.hp -= dmg;
    this.current.flash = 0.1;

    // Лич: телепортация при получении урона
    if (this.current.id === 'boss_lich' && this.current.teleportCd <= 0) {
      this._lichTeleport();
      this.current.teleportCd = this.current.cfg.teleportCooldown;
    }

    // Проверка фазы 2
    this._checkPhaseTransition();

    // Смерть
    if (this.current.hp <= 0) {
      this.current.hp = 0;
      this._onBossDeath();
    }
  },

  /** Проверка перехода во 2-ю фазу. */
  _checkPhaseTransition() {
    const boss = this.current;
    if (!boss || boss.phase >= 2) return;
    const cfg = boss.cfg;
    const threshold = cfg.phase2HpPct || 0.5;
    if (boss.hp / boss.maxHp <= threshold) {
      boss.phase = 2;
      // Паук-королева: призыв миньонов при 50%
      if (boss.id === 'boss_spider_queen' && !boss.minionsSpawned) {
        boss.minionsSpawned = true;
        this._spiderQueenSummon();
      }
      // Визуальный эффект перехода фазы
      if (window.Particles) {
        Particles.ring(boss.x, boss.y, 60, 0.35, 'rgba(255, 50, 50, 0.8)', 3);
        Particles.burst(boss.x, boss.y, 10, {
          color: '#ff4444', speedMin: 60, speedMax: 150,
          lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 4,
        });
      }
    }
  },

  /** Обработка смерти босса. */
  _onBossDeath() {
    const boss = this.current;
    if (!boss) return;

    // Огненный элементаль: взрыв при смерти
    if (boss.id === 'boss_fire_lord' && !boss.deathExploded) {
      boss.deathExploded = true;
      const atk = boss.cfg.attacks.deathExplosion;
      if (window.Game && Game.player) {
        const dx = Game.player.x - boss.x, dy = Game.player.y - boss.y;
        if (dx * dx + dy * dy <= atk.radius * atk.radius) {
          if (Player.takeDamage) Player.takeDamage(Game.player, atk.damage, boss);
          else Game.player.hp -= atk.damage;
        }
      }
      if (window.Particles) {
        Particles.ring(boss.x, boss.y, atk.radius, 0.5, 'rgba(255, 100, 0, 0.95)', 5);
        Particles.burst(boss.x, boss.y, 25, {
          color: '#ff6600', speedMin: 100, speedMax: 280,
          lifeMin: 0.5, lifeMax: 1.0, sizeMin: 3, sizeMax: 6,
        });
      }
    }

    // Визуальные эффекты смерти
    const deathColor = boss.cfg.color || '#fff';
    if (window.Particles) {
      Particles.ring(boss.x, boss.y, 100, 0.4, deathColor, 5);
      Particles.burst(boss.x, boss.y, 25, {
        color: deathColor, speedMin: 80, speedMax: 250,
        lifeMin: 0.5, lifeMax: 1.0, sizeMin: 3, sizeMax: 6,
      });
      Particles.text(boss.x, boss.y - 30, 'БОСС ПОВЕРЖЕН!', 2.0, '#ffd700', 20);
    }

    // Тряска экрана
    this.screenShake = 0.3;

    // Дроп: золотой сундук + фонтан опыта
    this._dropBossRewards(boss);

    // Таймер сообщения
    this.defeatedMsg = BOSS_CONFIG.DEFEATED_MSG_DURATION;

    // Увеличиваем индекс босса
    this.bossIndex++;
    if (this.bossIndex < BOSS_CONFIG.SPAWN_TIMES.length) {
      this.nextSpawnTime = BOSS_CONFIG.SPAWN_TIMES[this.bossIndex];
    }

    // Обнуляем босса (с задержкой для визуальных эффектов)
    setTimeout(() => {
      if (this.current === boss) this.current = null;
    }, 100);
  },

  /** Дроп наград за убийство босса. */
  _dropBossRewards(boss) {
    if (!window.Game) return;
    const cfg = boss.cfg;

    // 1) Фонтан кристаллов опыта (10-15 штук)
    const xpCount = Utils.randInt(10, 15);
    for (let i = 0; i < xpCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Utils.rand(20, 60);
      const x = boss.x + Math.cos(ang) * dist;
      const y = boss.y + Math.sin(ang) * dist;
      const val = Math.floor(cfg.xpReward / xpCount);
      if (Loot.dropXPRaw) {
        Loot.dropXPRaw(Game.xpDrops, x, y, val);
      } else {
        Loot.dropXP(Game.xpDrops, x, y, val);
      }
    }

    // 2) Золотой сундук (особый — без d20, сразу карты)
    Game.bossChest = {
      x: boss.x,
      y: boss.y,
      size: 34,
      pulse: 0,
      golden: true,
    };
    if (window.Particles) {
      Particles.chestGlow(boss.x, boss.y);
      Particles.ring(boss.x, boss.y, 60, 0.5, 'rgba(255, 215, 80, 0.9)', 4);
    }
  },


  /* ============================================================
     Главный апдейт босса — диспетчер по типу.
     ============================================================ */
  update(player, dt) {
    // Обновление сообщения
    if (this.defeatedMsg > 0) this.defeatedMsg -= dt;
    // Тряска экрана
    if (this.screenShake > 0) {
      this.screenShake -= dt;
      this.screenShakeX = Utils.rand(-3, 3);
      this.screenShakeY = Utils.rand(-3, 3);
    } else {
      this.screenShakeX = 0;
      this.screenShakeY = 0;
    }

    const boss = this.current;
    if (!boss || boss.hp <= 0) return;

    // Анимация появления
    if (boss.spawnAnim > 0) {
      boss.spawnAnim -= dt;
      return;
    }

    // Обновление таймеров
    boss.flash = Math.max(0, boss.flash - dt);
    boss.slashAnim = Math.max(0, boss.slashAnim - dt);
    boss.whirlwindAnim = Math.max(0, boss.whirlwindAnim - dt);
    boss.darkExplosionAnim = Math.max(0, boss.darkExplosionAnim - dt);
    boss.fireRingAnim = Math.max(0, boss.fireRingAnim - dt);
    boss.hitCooldown = Math.max(0, boss.hitCooldown - dt);

    // Facing
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;
    boss.facing = { x: dx / dist, y: dy / dist };

    // Диспетчер поведения
    switch (boss.id) {
      case 'boss_skeleton_knight': this._updateSkeletonKnight(boss, player, dt); break;
      case 'boss_lich':            this._updateLich(boss, player, dt); break;
      case 'boss_spider_queen':    this._updateSpiderQueen(boss, player, dt); break;
      case 'boss_fire_lord':       this._updateFireLord(boss, player, dt); break;
    }

    // Контактный урон
    this._tryContactDamage(boss, player, dt);
  },

  /** Контактный урон от босса к игроку. */
  _tryContactDamage(boss, player, dt) {
    if (boss.hitCooldown > 0) return;
    const cfg = boss.cfg;
    const collideR = (Math.max(cfg.w, cfg.h) + player.size) * 0.45;
    const dx = player.x - boss.x, dy = player.y - boss.y;
    if (dx * dx + dy * dy < collideR * collideR) {
      if (Player.takeDamage) Player.takeDamage(player, cfg.damage, boss);
      else player.hp -= cfg.damage;
      boss.hitCooldown = cfg.hitInterval || 1.0;
    }
  },

  /* ============================================================
     Движение с коллизиями (общее для всех боссов).
     ============================================================ */
  _moveTowards(boss, tx, ty, dt, sign) {
    const cfg = boss.cfg;
    let speed = cfg.speed;
    // Фаза 2: ускорение (скелет-рыцарь)
    if (boss.phase >= 2 && cfg.phase2SpeedMul) speed *= cfg.phase2SpeedMul;

    const dx = tx - boss.x, dy = ty - boss.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist, ny = dy / dist;
    const s = speed * (sign || 1);
    boss.vx = nx * s;
    boss.vy = ny * s;
    let mx = boss.vx * dt;
    let my = boss.vy * dt;
    const rad = Math.max(cfg.w, cfg.h) * 0.4;

    if (window.GameMap && GameMap.dungeon) {
      const res = GameMap.moveWithCollision(boss.x, boss.y, mx, my, rad);
      let blockedAny = res.blockedX || res.blockedY;
      if (blockedAny && (Math.abs(res.x - boss.x) < Math.abs(mx) * 0.2) &&
          (Math.abs(res.y - boss.y) < Math.abs(my) * 0.2)) {
        const perpX = -ny, perpY = nx;
        const slide = (boss._slideSign = boss._slideSign || 1);
        const sx = perpX * Math.abs(s) * dt * slide;
        const sy = perpY * Math.abs(s) * dt * slide;
        const res2 = GameMap.moveWithCollision(boss.x, boss.y, sx, sy, rad);
        boss.x = res2.x; boss.y = res2.y;
        if (res2.blockedX && res2.blockedY) boss._slideSign = -slide;
      } else {
        boss.x = res.x;
        boss.y = res.y;
      }
    } else {
      boss.x += mx;
      boss.y += my;
    }
    const m = Math.max(cfg.w, cfg.h) * 0.5;
    boss.x = Utils.clamp(boss.x, m, CONFIG.MAP.W - m);
    boss.y = Utils.clamp(boss.y, m, CONFIG.MAP.H - m);
  },


  /* ============================================================
     СКЕЛЕТ-РЫЦАРЬ: медленная погоня, удар мечом (конус), круговой взмах.
     ============================================================ */
  _updateSkeletonKnight(boss, player, dt) {
    // Погоня к игроку
    this._moveTowards(boss, player.x, player.y, dt, 1);

    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy);
    const atk = boss.cfg.attacks;

    // Уменьшение кулдаунов
    boss.slashCd = Math.max(0, boss.slashCd - dt);
    boss.whirlwindCd = Math.max(0, boss.whirlwindCd - dt);

    // Круговой взмах (приоритет, если в радиусе)
    if (boss.whirlwindCd <= 0 && dist <= atk.whirlwind.radius + 10) {
      boss.whirlwindCd = atk.whirlwind.cooldown;
      boss.whirlwindAnim = 0.3;
      // Урон всем в радиусе (только игроку)
      if (dist <= atk.whirlwind.radius) {
        if (Player.takeDamage) Player.takeDamage(player, atk.whirlwind.damage, boss);
        else player.hp -= atk.whirlwind.damage;
      }
      // Визуальный эффект: белая дуга 360°
      if (window.Particles) {
        Particles.ring(boss.x, boss.y, atk.whirlwind.radius, 0.3, 'rgba(255, 255, 255, 0.8)', 3);
      }
      return;
    }

    // Удар мечом (конус 120° перед собой)
    if (boss.slashCd <= 0 && dist <= atk.slash.range) {
      boss.slashCd = atk.slash.cooldown;
      boss.slashAnim = 0.2;
      // Проверка попадания в конус 120° (±60° от facing)
      const angleToPlayer = Math.atan2(dy, dx);
      const facingAngle = Math.atan2(boss.facing.y, boss.facing.x);
      let angleDiff = angleToPlayer - facingAngle;
      // Нормализуем в [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      const halfArc = (atk.slash.arc / 2) * Math.PI / 180;
      if (Math.abs(angleDiff) <= halfArc) {
        if (Player.takeDamage) Player.takeDamage(player, atk.slash.damage, boss);
        else player.hp -= atk.slash.damage;
      }
      // Визуал: белая дуга
      if (window.Particles) {
        Particles.burst(boss.x + boss.facing.x * 30, boss.y + boss.facing.y * 30, 5, {
          color: '#ffffff', speedMin: 60, speedMax: 120,
          lifeMin: 0.15, lifeMax: 0.3, sizeMin: 2, sizeMax: 4,
        });
      }
    }
  },

  /* ============================================================
     ЛИЧ: держит дистанцию, магическая стрела, призыв, тёмный взрыв.
     ============================================================ */
  _updateLich(boss, player, dt) {
    const cfg = boss.cfg;
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Держит дистанцию
    if (dist < cfg.keepDist - 20) {
      this._moveTowards(boss, player.x, player.y, dt, -1); // отходит
    } else if (dist > cfg.keepDist + 30) {
      this._moveTowards(boss, player.x, player.y, dt, 1);  // подходит
    } else {
      boss.vx = 0; boss.vy = 0;
    }

    const atk = cfg.attacks;
    const cdMul = (boss.phase >= 2 && cfg.phase2CdMul) ? cfg.phase2CdMul : 1.0;

    // Уменьшение кулдаунов
    boss.boltCd = Math.max(0, boss.boltCd - dt);
    boss.summonCd = Math.max(0, boss.summonCd - dt);
    boss.darkExplosionCd = Math.max(0, boss.darkExplosionCd - dt);
    boss.teleportCd = Math.max(0, boss.teleportCd - dt);

    // Магическая стрела (самонаводящаяся)
    if (boss.boltCd <= 0) {
      boss.boltCd = atk.bolt.cooldown * cdMul;
      this._lichBolt(boss, player);
    }

    // Призыв 3 скелетов
    if (boss.summonCd <= 0) {
      boss.summonCd = atk.summon.cooldown * cdMul;
      this._lichSummon(boss);
    }

    // Тёмный взрыв AoE
    if (boss.darkExplosionCd <= 0 && dist <= atk.darkExplosion.radius + 40) {
      boss.darkExplosionCd = atk.darkExplosion.cooldown * cdMul;
      boss.darkExplosionAnim = 0.35;
      // Урон, если игрок в радиусе
      if (dist <= atk.darkExplosion.radius) {
        if (Player.takeDamage) Player.takeDamage(player, atk.darkExplosion.damage, boss);
        else player.hp -= atk.darkExplosion.damage;
      }
      // Визуал: фиолетовый расширяющийся круг
      if (window.Particles) {
        Particles.ring(boss.x, boss.y, atk.darkExplosion.radius, 0.4, 'rgba(128, 0, 255, 0.85)', 4);
        Particles.burst(boss.x, boss.y, 8, {
          color: '#9b30ff', speedMin: 40, speedMax: 100,
          lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4,
        });
      }
    }
  },

  /** Лич: самонаводящаяся стрела. */
  _lichBolt(boss, player) {
    if (!window.Game || !Game.projectiles) return;
    const p = Game.projectiles.spawn();
    if (!p) return;
    const atk = boss.cfg.attacks.bolt;
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;
    p.kind = 'boss_bolt';
    p.owner = 'enemy';
    p.x = boss.x; p.y = boss.y;
    p.vx = (dx / dist) * atk.speed;
    p.vy = (dy / dist) * atk.speed;
    p.life = 3.0;
    p.damage = atk.damage;
    p.radius = 7;
    p.angle = Math.atan2(dy, dx);
    p.explodeRadius = 0;
    p.source = 'boss_lich';
    p.homing = true;
    p.homingStrength = 3.0;
  },

  /** Лич: призыв скелетов. */
  _lichSummon(boss) {
    if (!window.Game || !window.Enemies) return;
    const atk = boss.cfg.attacks.summon;
    for (let i = 0; i < atk.count; i++) {
      if (Game.enemies.countActive() >= CONFIG.POOLS.ENEMIES - 3) break;
      const ang = (Math.PI * 2 / atk.count) * i;
      const sx = boss.x + Math.cos(ang) * 40;
      const sy = boss.y + Math.sin(ang) * 40;
      Enemies.spawnByType(Game.enemies, atk.childId, sx, sy);
    }
    if (window.Particles) {
      Particles.ring(boss.x, boss.y, 40, 0.3, 'rgba(160, 80, 255, 0.7)', 2);
    }
  },

  /** Лич: телепортация при получении урона. */
  _lichTeleport() {
    const boss = this.current;
    if (!boss || !window.Game) return;
    const player = Game.player;
    if (!player) return;
    const m = Math.max(boss.cfg.w, boss.cfg.h) * 0.5;
    // Попытка найти точку на расстоянии keepDist от игрока
    for (let attempt = 0; attempt < 8; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Utils.rand(boss.cfg.keepDist * 0.8, boss.cfg.keepDist * 1.2);
      let tx = player.x + Math.cos(ang) * dist;
      let ty = player.y + Math.sin(ang) * dist;
      tx = Utils.clamp(tx, m, CONFIG.MAP.W - m);
      ty = Utils.clamp(ty, m, CONFIG.MAP.H - m);
      if (window.GameMap && GameMap.dungeon && !GameMap.rectIsWalkable(tx, ty, m)) continue;
      // Эффект исчезновения
      if (window.Particles) {
        Particles.burst(boss.x, boss.y, 6, {
          color: '#a259ff', speedMin: 60, speedMax: 140,
          lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
        });
      }
      boss.x = tx; boss.y = ty;
      // Эффект появления
      if (window.Particles) {
        Particles.burst(boss.x, boss.y, 6, {
          color: '#a259ff', speedMin: 60, speedMax: 140,
          lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
        });
      }
      return;
    }
  },


  /* ============================================================
     ПАУК-КОРОЛЕВА: быстрая, укус+яд, паутина, призыв при 50% HP.
     ============================================================ */
  _updateSpiderQueen(boss, player, dt) {
    const cfg = boss.cfg;
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Погоня к игроку
    this._moveTowards(boss, player.x, player.y, dt, 1);

    // Кулдауны
    boss.webCd = Math.max(0, boss.webCd - dt);
    boss.trailCd = Math.max(0, boss.trailCd - dt);

    // Паутинный выстрел
    if (boss.webCd <= 0) {
      boss.webCd = cfg.attacks.web.cooldown;
      this._spiderWebShot(boss, player);
    }

    // Оставляет паутину (лужи замедления)
    if (boss.trailCd <= 0 && cfg.trailEvery) {
      boss.trailCd = cfg.trailEvery;
      if (window.GameMap && typeof GameMap.spawnGroundEffect === 'function') {
        const trail = cfg.trail;
        GameMap.spawnGroundEffect(trail.kind, boss.x, boss.y, {
          radius: trail.radius, life: trail.life,
          slow: trail.slow, dps: 0,
          color: 'rgba(200, 200, 220, 0.4)',
        });
      }
    }

    // Укус (ближний бой) с ядом — через контактный урон + наложение DoT
    if (boss.hitCooldown <= 0 && dist <= (cfg.attacks.bite.range + player.size * 0.5)) {
      const bite = cfg.attacks.bite;
      if (Player.takeDamage) Player.takeDamage(player, bite.damage, boss);
      else player.hp -= bite.damage;
      // Яд: урон по времени. Шаг 8: сопротивление уменьшает длительность
      let poisonDur = bite.poisonDuration;
      if (player.debuffReduction > 0) poisonDur *= (1 - Math.min(player.debuffReduction, 0.75));
      if (!player.poison || player.poison.remaining <= 0) {
        player.poison = { dps: bite.poisonDps, remaining: poisonDur };
      } else {
        // Обновляем яд
        player.poison.remaining = poisonDur;
        player.poison.dps = Math.max(player.poison.dps, bite.poisonDps);
      }
      boss.hitCooldown = cfg.hitInterval || 0.8;
    }
  },

  /** Паук-королева: выстрел паутиной. */
  _spiderWebShot(boss, player) {
    if (!window.Game || !Game.projectiles) return;
    const p = Game.projectiles.spawn();
    if (!p) return;
    const atk = boss.cfg.attacks.web;
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;
    p.kind = 'boss_web';
    p.owner = 'enemy';
    p.x = boss.x; p.y = boss.y;
    p.vx = (dx / dist) * atk.speed;
    p.vy = (dy / dist) * atk.speed;
    p.life = 2.5;
    p.damage = 0;   // Паутина не наносит урон, только замедляет
    p.radius = 8;
    p.angle = Math.atan2(dy, dx);
    p.explodeRadius = 0;
    p.source = 'boss_spider_queen';
    p.slowPct = atk.slowPct;
    p.slowDuration = atk.slowDuration;
  },

  /** Паук-королева: призыв 4 гигантских пауков при 50% HP. */
  _spiderQueenSummon() {
    const boss = this.current;
    if (!boss || !window.Game || !window.Enemies) return;
    const atk = boss.cfg.attacks.spawnMinions;
    for (let i = 0; i < atk.count; i++) {
      if (Game.enemies.countActive() >= CONFIG.POOLS.ENEMIES - 3) break;
      const ang = (Math.PI * 2 / atk.count) * i;
      const sx = boss.x + Math.cos(ang) * 50;
      const sy = boss.y + Math.sin(ang) * 50;
      Enemies.spawnByType(Game.enemies, atk.childId, sx, sy);
    }
    if (window.Particles) {
      Particles.burst(boss.x, boss.y, 10, {
        color: '#a050a0', speedMin: 50, speedMax: 120,
        lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 4,
      });
    }
  },

  /* ============================================================
     ОГНЕННЫЙ ЭЛЕМЕНТАЛЬ-ЛОРД: медленный, AoE, огненный шар, кольцо пламени.
     ============================================================ */
  _updateFireLord(boss, player, dt) {
    const cfg = boss.cfg;
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Медленная погоня
    this._moveTowards(boss, player.x, player.y, dt, 1);

    // Кулдауны
    boss.fireballCd = Math.max(0, boss.fireballCd - dt);
    boss.fireRingCd = Math.max(0, boss.fireRingCd - dt);
    boss.trailCd = Math.max(0, boss.trailCd - dt);

    const atk = cfg.attacks;
    const fireballCooldown = (boss.phase >= 2 && cfg.phase2FireballCd)
      ? cfg.phase2FireballCd : atk.fireball.cooldown;

    // Огненный шар
    if (boss.fireballCd <= 0) {
      boss.fireballCd = fireballCooldown;
      this._fireLordFireball(boss, player);
    }

    // Кольцо пламени
    if (boss.fireRingCd <= 0) {
      boss.fireRingCd = atk.fireRing.cooldown;
      boss.fireRingAnim = atk.fireRing.expandTime;
      boss.fireRingRadius = 0;
      // Урон проверяется при максимальном расширении (в render/отдельном таймере)
      // Проверим урон сразу при расширении кольца — в рамках update будем считать
      this._fireRingDamageScheduled = true;
      // Визуал: оранжевое расширяющееся кольцо
      if (window.Particles) {
        Particles.ring(boss.x, boss.y, atk.fireRing.maxRadius, atk.fireRing.expandTime, 'rgba(255, 140, 0, 0.85)', 4);
      }
      // Отложенный урон: проверим в конце расширения
      setTimeout(() => {
        if (!this.current || this.current !== boss || boss.hp <= 0) return;
        const px = Game.player.x - boss.x, py = Game.player.y - boss.y;
        const pd = Math.hypot(px, py);
        // Кольцо бьёт на границе (±20px от maxRadius)
        if (pd <= atk.fireRing.maxRadius && pd >= atk.fireRing.maxRadius * 0.3) {
          Game.player.hp -= atk.fireRing.damage;
        }
      }, atk.fireRing.expandTime * 1000);
    }

    // Горящая земля
    if (boss.trailCd <= 0 && cfg.trailEvery) {
      boss.trailCd = cfg.trailEvery;
      if (window.GameMap && typeof GameMap.spawnGroundEffect === 'function') {
        const trail = cfg.trail;
        GameMap.spawnGroundEffect(trail.kind, boss.x, boss.y, {
          radius: trail.radius, life: trail.life,
          dps: trail.dps, slow: 0,
          color: 'rgba(255, 120, 30, 0.55)',
        });
      }
    }
  },

  /** Огненный элементаль: огненный шар (медленный снаряд, взрыв). */
  _fireLordFireball(boss, player) {
    if (!window.Game || !Game.projectiles) return;
    const p = Game.projectiles.spawn();
    if (!p) return;
    const atk = boss.cfg.attacks.fireball;
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;
    p.kind = 'boss_fireball';
    p.owner = 'enemy';
    p.x = boss.x; p.y = boss.y;
    p.vx = (dx / dist) * atk.speed;
    p.vy = (dy / dist) * atk.speed;
    p.life = 4.0;
    p.damage = atk.damage;
    p.radius = 10;
    p.angle = Math.atan2(dy, dx);
    p.explodeRadius = atk.explodeRadius;
    p.source = 'boss_fire_lord';
  },


  /* ============================================================
     Рендер босса.
     ============================================================ */
  render(ctx, cam, viewW, viewH) {
    const boss = this.current;
    if (!boss || boss.hp <= 0) return;

    const cfg = boss.cfg;
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    // Видимость (с запасом)
    const pad = Math.max(cfg.w, cfg.h) * 1.5;
    if (boss.x + pad < minX || boss.x - pad > maxX ||
        boss.y + pad < minY || boss.y - pad > maxY) return;

    // Анимация появления: масштаб от 0 до 1
    let scale = 1;
    if (boss.spawnAnim > 0) {
      scale = 1 - (boss.spawnAnim / 0.5);
      scale = Math.max(0.01, scale);
    }

    const drawW = cfg.w * scale;
    const drawH = cfg.h * scale;

    // Мерцание при попадании
    const fillColor = boss.flash > 0 ? '#ffffff' : cfg.color;
    const strokeColor = cfg.stroke || '#ffffff';

    ctx.save();

    // Пульсация (элементаль)
    if (boss.id === 'boss_fire_lord') {
      const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.05;
      ctx.translate(boss.x, boss.y);
      ctx.scale(pulse, pulse);
      ctx.translate(-boss.x, -boss.y);
    }

    // Аура/свечение
    if (boss.id === 'boss_lich') {
      ctx.shadowColor = 'rgba(128, 0, 255, 0.6)';
      ctx.shadowBlur = 15;
    } else if (boss.id === 'boss_fire_lord') {
      ctx.shadowColor = 'rgba(255, 100, 0, 0.7)';
      ctx.shadowBlur = 18;
    }

    // Основная фигура
    ctx.fillStyle = fillColor;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;

    switch (cfg.shape) {
      case 'rect':
        ctx.fillRect(boss.x - drawW / 2, boss.y - drawH / 2, drawW, drawH);
        ctx.strokeRect(boss.x - drawW / 2, boss.y - drawH / 2, drawW, drawH);
        break;
      case 'circle':
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, drawW / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'oval':
        ctx.beginPath();
        ctx.ellipse(boss.x, boss.y, drawW / 2, drawH / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(boss.x, boss.y - drawH / 2);
        ctx.lineTo(boss.x + drawW / 2, boss.y);
        ctx.lineTo(boss.x, boss.y + drawH / 2);
        ctx.lineTo(boss.x - drawW / 2, boss.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
    }

    ctx.shadowBlur = 0;

    // Декор: корона (скелет-рыцарь), плащ (лич)
    if (boss.id === 'boss_skeleton_knight') {
      // Корона
      ctx.fillStyle = '#ffd700';
      const cy = boss.y - drawH / 2 - 8;
      ctx.beginPath();
      ctx.moveTo(boss.x - 12, cy + 5);
      ctx.lineTo(boss.x - 6, cy - 5);
      ctx.lineTo(boss.x, cy + 2);
      ctx.lineTo(boss.x + 6, cy - 5);
      ctx.lineTo(boss.x + 12, cy + 5);
      ctx.closePath();
      ctx.fill();
      // Меч (если атакует)
      if (boss.slashAnim > 0) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        const ang = Math.atan2(boss.facing.y, boss.facing.x);
        ctx.beginPath();
        ctx.moveTo(boss.x, boss.y);
        ctx.lineTo(boss.x + Math.cos(ang) * 40, boss.y + Math.sin(ang) * 40);
        ctx.stroke();
      }
    }

    if (boss.id === 'boss_lich') {
      // Аурический круг
      ctx.strokeStyle = 'rgba(128, 0, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, drawW / 2 + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (boss.id === 'boss_spider_queen') {
      // Лапы (8 маленьких линий)
      ctx.strokeStyle = cfg.stroke;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const ang = (Math.PI * 2 / 8) * i + Date.now() * 0.002;
        const lx = boss.x + Math.cos(ang) * (drawW / 2 + 6);
        const ly = boss.y + Math.sin(ang) * (drawH / 2 + 4);
        ctx.beginPath();
        ctx.moveTo(boss.x + Math.cos(ang) * drawW * 0.35, boss.y + Math.sin(ang) * drawH * 0.35);
        ctx.lineTo(lx, ly);
        ctx.stroke();
      }
    }

    // Буква в центре
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + Math.floor(Math.min(drawW, drawH) * 0.5) + 'px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cfg.letter, boss.x, boss.y + 1);

    // Визуал: круговой взмах (белое кольцо)
    if (boss.whirlwindAnim > 0) {
      const progress = 1 - (boss.whirlwindAnim / 0.3);
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, boss.cfg.attacks.whirlwind.radius * progress, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Визуал: тёмный взрыв лича
    if (boss.darkExplosionAnim > 0) {
      const progress = 1 - (boss.darkExplosionAnim / 0.35);
      ctx.strokeStyle = `rgba(128, 0, 255, ${1 - progress})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, boss.cfg.attacks.darkExplosion.radius * progress, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  },


  /* ============================================================
     Рендер полосы HP босса (UI, экранные координаты).
     ============================================================ */
  renderHPBar(ctx, viewW, viewH) {
    const boss = this.current;
    if (!boss || boss.hp <= 0) return;

    const cfg = boss.cfg;
    const barW = Math.min(400, viewW * 0.5);
    const barH = 18;
    const barX = (viewW - barW) / 2;
    const barY = 8;

    // Фон полосы
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

    // Полоса HP
    const hpPct = Utils.clamp(boss.hp / boss.maxHp, 0, 1);
    const grad = ctx.createLinearGradient(barX, barY, barX + barW * hpPct, barY);
    grad.addColorStop(0, '#ff3333');
    grad.addColorStop(1, '#ff8800');
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW * hpPct, barH);

    // Рамка
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    // Имя и HP
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `${cfg.name}  ${Math.ceil(boss.hp)}/${boss.maxHp}`,
      viewW / 2, barY + barH / 2
    );
  },

  /** Рендер сообщения «Босс повержен!» */
  renderDefeatedMsg(ctx, viewW, viewH) {
    if (this.defeatedMsg <= 0) return;
    const alpha = Math.min(1, this.defeatedMsg / 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('БОСС ПОВЕРЖЕН!', viewW / 2, viewH / 3);
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Рендер золотого сундука босса (в мировых координатах). */
  renderBossChest(ctx, chest, cam, viewW, viewH) {
    if (!chest) return;
    const screenX = chest.x - cam.x;
    const screenY = chest.y - cam.y;
    if (screenX < -50 || screenX > viewW + 50 || screenY < -50 || screenY > viewH + 50) return;

    chest.pulse += 0.016; // ~60fps
    const s = chest.size;
    const pulse = 1 + Math.sin(chest.pulse * 5) * 0.08;
    const w = s * pulse, h = s * pulse;

    // Золотое свечение
    ctx.shadowColor = 'rgba(255, 215, 80, 1.0)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(chest.x - w / 2, chest.y - h / 2, w, h);
    ctx.shadowBlur = 0;
    // Обводка
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.strokeRect(chest.x - w / 2 + 1, chest.y - h / 2 + 1, w - 2, h - 2);
    // Поперечная полоса
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(chest.x - w / 2, chest.y - 2, w, 3);
    // Звезда в центре
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', chest.x, chest.y + 1);
  },
};

window.Bosses = Bosses;

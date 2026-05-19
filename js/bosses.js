'use strict';
/* ============================================================
   bosses.js — Система мини-боссов (Шаг 14: ротация, 13 боссов).

   Архитектура:
   - Bosses.current — текущий активный босс (или null).
   - Bosses.guardian — текущий страж карты (или null).
   - Bosses.globalRotation[] — 4 босса, выбранных для забега.
   - Bosses.selectGlobalBosses() — ротация при старте забега.
   - Bosses.selectGuardian(biomeId) — выбор стража для карты.
   - Bosses.spawnGlobalBoss(slotIndex, player) — спавн глобального.
   - Bosses.spawnGuardian(player) — спавн стража карты.
   ============================================================ */

const Bosses = {
  current: null,          // текущий глобальный босс
  guardian: null,         // текущий страж карты
  bossIndex: 0,           // индекс следующего слота (0..3)
  nextSpawnTime: 0,       // время следующего глобального босса
  defeatedMsg: 0,         // таймер «Босс повержен!»
  screenShake: 0,
  screenShakeX: 0,
  screenShakeY: 0,
  globalRotation: [],     // массив 4 bossId для этого забега
  bossAnnounce: 0,        // таймер анонса имени босса
  bossAnnounceName: '',   // имя для анонса

  /* ============================================================
     Инициализация и ротация
     ============================================================ */

  /** Полная инициализация для нового забега. */
  init() {
    this.current = null;
    this.guardian = null;
    this.bossIndex = 0;
    this.nextSpawnTime = BOSS_CONFIG.SPAWN_TIMES[0];
    this.defeatedMsg = 0;
    this.screenShake = 0;
    this.screenShakeX = 0;
    this.screenShakeY = 0;
    this.globalRotation = [];
    this.bossAnnounce = 0;
    this.bossAnnounceName = '';
    // Выбираем ротацию боссов для забега
    this.selectGlobalBosses();
  },

  /**
   * Выбрать 4 глобальных босса для забега (без повторов).
   * Учитывает предпочтения по биому для первого слота.
   */
  selectGlobalBosses() {
    const pool = [...BOSS_CONFIG.ALL_BOSS_IDS];
    const selected = [];
    // Шафл пула
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Выбираем 4 уникальных
    for (let i = 0; i < Math.min(4, pool.length); i++) {
      selected.push(pool[i]);
    }
    this.globalRotation = selected;
  },

  /**
   * Выбрать стража для биома (из BOSS_GUARDIANS_BY_BIOME).
   * @param {string} biomeId
   * @returns {string} bossId
   */
  selectGuardian(biomeId) {
    const pool = (window.BOSS_GUARDIANS_BY_BIOME && BOSS_GUARDIANS_BY_BIOME[biomeId])
      ? BOSS_GUARDIANS_BY_BIOME[biomeId]
      : null;
    if (!pool || pool.length === 0) return 'boss_skeleton_knight';
    return pool[Math.floor(Math.random() * pool.length)];
  },

  /** Проверка: жив ли глобальный или страж. */
  isAlive() {
    return (this.current !== null && this.current.hp > 0) ||
           (this.guardian !== null && this.guardian.hp > 0);
  },

  /** Проверка: жив ли глобальный босс. */
  isGlobalAlive() {
    return this.current !== null && this.current.hp > 0;
  },

  /** Проверка: жив ли страж. */
  isGuardianAlive() {
    return this.guardian !== null && this.guardian.hp > 0;
  },

  /* ============================================================
     Спавн боссов
     ============================================================ */

  /** Спавн глобального босса по индексу слота. */
  spawnGlobalBoss(slotIndex, player) {
    if (slotIndex >= this.globalRotation.length) return;
    const bossId = this.globalRotation[slotIndex];
    if (!bossId) return;
    const boss = this._createBoss(bossId, player, 'global', slotIndex);
    if (boss) {
      this.current = boss;
      this._announcesBoss(boss.cfg.name);
    }
  },

  /** Спавн стража карты. */
  spawnGuardian(player) {
    if (!window.GameMap || !GameMap.currentBiome) return;
    // Не спавним если уже есть живой страж
    if (this.isGuardianAlive()) return;
    const biomeId = GameMap.currentBiome.id;
    const bossId = this.selectGuardian(biomeId);
    const boss = this._createBoss(bossId, player, 'guardian', 0);
    if (boss) {
      this.guardian = boss;
      this._announcesBoss(boss.cfg.name + ' (Страж)');
    }
  },

  /** Создать объект босса. */
  _createBoss(bossId, player, role, slotIndex) {
    const cfg = BOSS_TYPES[bossId];
    if (!cfg) return null;

    // Множитель сложности по слоту (для глобальных)
    const diffMul = (role === 'global' && BOSS_CONFIG.SLOT_DIFFICULTY[slotIndex])
      ? BOSS_CONFIG.SLOT_DIFFICULTY[slotIndex] : 1.0;
    // Множитель по номеру карты
    const mapMul = (window.Game && Game.mapNumber)
      ? 1 + (Game.mapNumber - 1) * 0.15 : 1.0;
    // Шаг 19: масштабирование HP по времени забега (baseHP * (1 + minutes * 0.2))
    const minutes = (window.Game && Game.runTime) ? Game.runTime / 60 : 0;
    const timeMul = 1 + minutes * 0.2;
    const totalMul = diffMul * mapMul * timeMul;

    const boss = {
      cfg: cfg,
      id: bossId,
      role: role, // 'global' или 'guardian'
      x: 0, y: 0,
      vx: 0, vy: 0,
      hp: Math.floor(cfg.hp * totalMul),
      maxHp: Math.floor(cfg.hp * totalMul),
      flash: 0,
      spawnAnim: 0.5,
      phase: 1,
      facing: { x: 0, y: 1 },
      difficultyMul: totalMul,

      // Кулдауны атак (универсальные)
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
      specialCd: 0,
      breathCd: 0,
      stompCd: 0,
      commandCd: 0,

      // Специальные флаги
      minionsSpawned: false,
      deathExploded: false,
      phase2Triggered: false,
      iceStormActive: false,
      shadowsSummoned: false,

      // Визуальные таймеры
      slashAnim: 0,
      whirlwindAnim: 0,
      darkExplosionAnim: 0,
      fireRingAnim: 0,
      fireRingRadius: 0,
      breathAnim: 0,
      stompAnim: 0,

      _slideSign: 1,
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
    boss.x = Utils.clamp(sx, m, (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) - m);
    boss.y = Utils.clamp(sy, m, (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) - m);

    // Эффект появления
    if (window.Particles) {
      Particles.ring(boss.x, boss.y, 80, 0.5, 'rgba(255, 200, 50, 0.9)', 4);
      Particles.ring(boss.x, boss.y, 50, 0.4, 'rgba(255, 80, 30, 0.8)', 3);
      Particles.burst(boss.x, boss.y, 15, {
        color: '#ffd700', speedMin: 80, speedMax: 200,
        lifeMin: 0.5, lifeMax: 0.9, sizeMin: 3, sizeMax: 5,
      });
    }

    return boss;
  },

  /** Показать анонс имени босса. */
  _announcesBoss(name) {
    this.bossAnnounce = 2.5; // 2.5 секунды
    this.bossAnnounceName = name;
    // Шаг 18: звук появления босса
    if (window.GameAudio) GameAudio.playSfx('boss_appear');
  },

  /* ============================================================
     Нанесение урона
     ============================================================ */

  /** Нанести урон боссу (автоматически определяет цель). */
  damage(dmg, target) {
    const boss = target || this.current || this.guardian;
    if (!boss || boss.hp <= 0) return;
    if (boss.spawnAnim > 0) return;

    boss.hp -= dmg;
    boss.flash = 0.1;

    // Лич: телепортация при уроне
    if (boss.id === 'boss_lich' && boss.teleportCd <= 0) {
      this._lichTeleport(boss);
      boss.teleportCd = boss.cfg.teleportCooldown;
    }

    this._checkPhaseTransition(boss);

    if (boss.hp <= 0) {
      boss.hp = 0;
      this._onBossDeath(boss);
    }
  },

  /** Нанести урон глобальному боссу. */
  damageGlobal(dmg) {
    if (this.current && this.current.hp > 0) this.damage(dmg, this.current);
  },

  /** Нанести урон стражу. */
  damageGuardian(dmg) {
    if (this.guardian && this.guardian.hp > 0) this.damage(dmg, this.guardian);
  },

  /** Определить, какой босс ближе к точке (x,y) — для попадания снарядов. */
  getClosestBoss(x, y) {
    let closest = null;
    let closestDist = Infinity;
    if (this.current && this.current.hp > 0) {
      const d = Utils.dist2(x, y, this.current.x, this.current.y);
      if (d < closestDist) { closestDist = d; closest = this.current; }
    }
    if (this.guardian && this.guardian.hp > 0) {
      const d = Utils.dist2(x, y, this.guardian.x, this.guardian.y);
      if (d < closestDist) { closestDist = d; closest = this.guardian; }
    }
    return closest;
  },


  /* ============================================================
     Проверка фазы и смерть
     ============================================================ */

  _checkPhaseTransition(boss) {
    if (!boss || boss.phase >= 2) {
      // Check phase 3 for Ancient Dragon
      if (boss && boss.id === 'boss_ancient_dragon' && boss.phase === 2) {
        const p3 = boss.cfg.phase3HpPct || 0.33;
        if (boss.hp / boss.maxHp <= p3) {
          boss.phase = 3;
          if (window.Particles) {
            Particles.ring(boss.x, boss.y, 80, 0.4, 'rgba(255, 0, 0, 0.9)', 5);
            Particles.burst(boss.x, boss.y, 15, {
              color: '#ff0000', speedMin: 80, speedMax: 200,
              lifeMin: 0.4, lifeMax: 0.8, sizeMin: 3, sizeMax: 6,
            });
            Particles.text(boss.x, boss.y - 40, 'ФАЗА III — ЯРОСТЬ!', 2.0, '#ff0000', 18);
          }
        }
      }
      return;
    }
    const cfg = boss.cfg;
    const threshold = cfg.phase2HpPct || 0.5;
    if (boss.hp / boss.maxHp <= threshold) {
      boss.phase = 2;
      boss.phase2Triggered = true;

      // Паук-королева (старая): призыв миньонов
      if (boss.id === 'boss_spider_queen' && !boss.minionsSpawned) {
        boss.minionsSpawned = true;
        this._spiderQueenSummon(boss);
      }
      // Ледяной змей: активировать ледяной шторм
      if (boss.id === 'boss_ice_serpent') {
        boss.iceStormActive = true;
      }
      // Теневой дракон: призыв теней один раз
      if (boss.id === 'boss_shadow_dragon' && !boss.shadowsSummoned) {
        boss.shadowsSummoned = true;
        this._summonMinions(boss, 'shadow', 3);
      }

      // Визуал перехода фазы
      if (window.Particles) {
        Particles.ring(boss.x, boss.y, 60, 0.35, 'rgba(255, 50, 50, 0.8)', 3);
        Particles.burst(boss.x, boss.y, 10, {
          color: '#ff4444', speedMin: 60, speedMax: 150,
          lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 4,
        });
      }
    }
  },

  _onBossDeath(boss) {
    if (!boss) return;
    const cfg = boss.cfg;

    // Специальные эффекты смерти
    if (boss.id === 'boss_fire_lord' && !boss.deathExploded) {
      boss.deathExploded = true;
      this._deathExplosionDamage(boss, cfg.attacks.deathExplosion.damage, cfg.attacks.deathExplosion.radius);
    }
    if (boss.id === 'boss_magma_giant' && !boss.deathExploded) {
      boss.deathExploded = true;
      this._magmaGiantEruption(boss);
    }
    if (boss.id === 'boss_ghoul_king' && !boss.deathExploded) {
      boss.deathExploded = true;
      this._summonMinions(boss, cfg.attacks.deathWail.childId, cfg.attacks.deathWail.count);
    }
    if (boss.id === 'boss_spider_matriarch' && !boss.deathExploded) {
      boss.deathExploded = true;
      this._summonMinions(boss, cfg.attacks.deathSpawn.childId, cfg.attacks.deathSpawn.count);
    }
    if (boss.id === 'boss_shadow_dragon' && !boss.deathExploded) {
      boss.deathExploded = true;
      this._deathExplosionDamage(boss, cfg.attacks.deathExplosion.damage, cfg.attacks.deathExplosion.radius);
    }

    // Древний дракон: взрыв при смерти + тряска + уведомление кампании
    if (boss.id === 'boss_ancient_dragon' && !boss.deathExploded) {
      boss.deathExploded = true;
      this._deathExplosionDamage(boss, cfg.attacks.deathExplosion.damage, cfg.attacks.deathExplosion.radius);
      this.screenShake = 1.0; // длительная тряска
      // Уведомить кампанию
      if (window.Campaign && Campaign.active) {
        Campaign.onCampaignBossKilled();
      }
    }

    // Визуальные эффекты смерти
    const deathColor = cfg.color || '#fff';
    if (window.Particles) {
      Particles.ring(boss.x, boss.y, 100, 0.4, deathColor, 5);
      Particles.burst(boss.x, boss.y, 25, {
        color: deathColor, speedMin: 80, speedMax: 250,
        lifeMin: 0.5, lifeMax: 1.0, sizeMin: 3, sizeMax: 6,
      });
      Particles.text(boss.x, boss.y - 30, 'БОСС ПОВЕРЖЕН!', 2.0, '#ffd700', 20);
    }

    this.screenShake = 0.3;
    this._dropBossRewards(boss);
    this.defeatedMsg = BOSS_CONFIG.DEFEATED_MSG_DURATION;
    // Шаг 18: звук смерти босса
    if (window.GameAudio) GameAudio.playSfx('boss_death');

    // Определяем, глобальный это или страж
    if (boss.role === 'campaign') {
      // Кампания — не трогаем глобальную ротацию
      setTimeout(() => { if (this.current === boss) this.current = null; }, 100);
      // Уведомить кампанию (для боссов кроме дракона, у которого свой хендлер)
      if (boss.id !== 'boss_ancient_dragon' && window.Campaign && Campaign.active) {
        Campaign.onCampaignBossKilled();
      }
    } else if (boss.role === 'global') {
      this.bossIndex++;
      if (this.bossIndex < BOSS_CONFIG.SPAWN_TIMES.length) {
        this.nextSpawnTime = BOSS_CONFIG.SPAWN_TIMES[this.bossIndex];
      }
      setTimeout(() => { if (this.current === boss) this.current = null; }, 100);
    } else {
      setTimeout(() => { if (this.guardian === boss) this.guardian = null; }, 100);
    }
  },

  /** Взрыв при смерти (урон игроку в радиусе). */
  _deathExplosionDamage(boss, damage, radius) {
    if (!window.Game || !Game.player) return;
    const dx = Game.player.x - boss.x, dy = Game.player.y - boss.y;
    if (dx * dx + dy * dy <= radius * radius) {
      if (Player.takeDamage) Player.takeDamage(Game.player, damage, boss);
      else Game.player.hp -= damage;
    }
    if (window.Particles) {
      Particles.ring(boss.x, boss.y, radius, 0.5, 'rgba(255, 100, 0, 0.95)', 5);
      Particles.burst(boss.x, boss.y, 25, {
        color: '#ff6600', speedMin: 100, speedMax: 280,
        lifeMin: 0.5, lifeMax: 1.0, sizeMin: 3, sizeMax: 6,
      });
    }
  },

  /** Магма-гигант: извержение при смерти — 8 огненных шаров. */
  _magmaGiantEruption(boss) {
    if (!window.Game || !Game.projectiles) return;
    const atk = boss.cfg.attacks.deathEruption;
    for (let i = 0; i < atk.count; i++) {
      const p = Game.projectiles.spawn();
      if (!p) break;
      const a = (Math.PI * 2 / atk.count) * i;
      p.kind = 'boss_fireball';
      p.owner = 'enemy';
      p.x = boss.x; p.y = boss.y;
      p.vx = Math.cos(a) * atk.speed;
      p.vy = Math.sin(a) * atk.speed;
      p.life = 2.0;
      p.damage = atk.damage * boss.difficultyMul;
      p.radius = atk.radius;
      p.angle = a;
      p.explodeRadius = 30;
      p.source = boss.id;
    }
    if (window.Particles) {
      Particles.burst(boss.x, boss.y, 20, {
        color: '#ff4400', speedMin: 100, speedMax: 250,
        lifeMin: 0.5, lifeMax: 1.0, sizeMin: 4, sizeMax: 7,
      });
    }
  },

  /** Призыв миньонов (общий). */
  _summonMinions(boss, childId, count) {
    if (!window.Game || !window.Enemies) return;
    for (let i = 0; i < count; i++) {
      if (Game.enemies.countActive() >= CONFIG.POOLS.ENEMIES - 3) break;
      const ang = (Math.PI * 2 / count) * i;
      const sx = boss.x + Math.cos(ang) * 50;
      const sy = boss.y + Math.sin(ang) * 50;
      Enemies.spawnByType(Game.enemies, childId, sx, sy);
    }
    if (window.Particles) {
      Particles.ring(boss.x, boss.y, 50, 0.3, 'rgba(160, 80, 255, 0.7)', 2);
    }
  },


  /* ============================================================
     Награды за боссов (Шаг 14: улучшенные, масштабируемые)
     ============================================================ */

  _dropBossRewards(boss) {
    if (!window.Game) return;
    const cfg = boss.cfg;
    const rewards = BOSS_CONFIG.REWARDS;
    const mapScale = 1 + ((Game.mapNumber || 1) - 1) * rewards.REWARD_SCALE_PER_MAP;
    // Шаг 19: масштабирование наград по времени забега
    const minutes = (Game.runTime || 0) / 60;
    const timeScale = 1 + minutes * 0.1;
    const rewardMul = (cfg.rewardMul || 1.0) * mapScale * timeScale;

    // XP кристаллы
    const isGlobal = boss.role === 'global';
    const baseXP = isGlobal ? rewards.GLOBAL_XP_BASE : rewards.GUARDIAN_XP_BASE;
    const maxXP = isGlobal ? rewards.GLOBAL_XP_MAX : rewards.GUARDIAN_XP_MAX;
    const totalXP = Math.floor(Utils.rand(baseXP, maxXP) * rewardMul);
    const xpCount = Utils.randInt(10, 15);
    for (let i = 0; i < xpCount; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Utils.rand(20, 60);
      const x = boss.x + Math.cos(ang) * dist;
      const y = boss.y + Math.sin(ang) * dist;
      const val = Math.floor(totalXP / xpCount);
      if (Loot.dropXPRaw) Loot.dropXPRaw(Game.xpDrops, x, y, val);
      else Loot.dropXP(Game.xpDrops, x, y, val);
    }

    // Шаг 15: золото с босса
    if (Game.goldDrops && Loot.dropBossGold) {
      Loot.dropBossGold(Game.goldDrops, boss.x, boss.y);
    }
    // Шаг 15: счётчик убийств боссов
    Game.bossKills = (Game.bossKills || 0) + 1;

    // Золотой сундук (особый — выбор из 3 карт)
    Game.bossChest = {
      x: boss.x,
      y: boss.y,
      size: 34,
      pulse: 0,
      golden: true,
      isGuardian: !isGlobal,
      rewardMul: rewardMul,
    };
    if (window.Particles) {
      Particles.chestGlow(boss.x, boss.y);
      Particles.ring(boss.x, boss.y, 60, 0.5, 'rgba(255, 215, 80, 0.9)', 4);
    }
  },

  /* ============================================================
     Главный update — обновляет оба босса (глобальный + страж)
     ============================================================ */

  update(player, dt) {
    // Таймеры UI
    if (this.defeatedMsg > 0) this.defeatedMsg -= dt;
    if (this.bossAnnounce > 0) this.bossAnnounce -= dt;

    // Тряска экрана
    if (this.screenShake > 0) {
      this.screenShake -= dt;
      this.screenShakeX = Utils.rand(-3, 3);
      this.screenShakeY = Utils.rand(-3, 3);
    } else {
      this.screenShakeX = 0;
      this.screenShakeY = 0;
    }

    // Обновить глобального босса
    if (this.current && this.current.hp > 0) {
      this._updateBoss(this.current, player, dt);
    }

    // Обновить стража
    if (this.guardian && this.guardian.hp > 0) {
      this._updateBoss(this.guardian, player, dt);
    }
  },

  /** Обновление одного босса. */
  _updateBoss(boss, player, dt) {
    if (boss.spawnAnim > 0) {
      boss.spawnAnim -= dt;
      return;
    }

    // Таймеры
    boss.flash = Math.max(0, boss.flash - dt);
    boss.slashAnim = Math.max(0, boss.slashAnim - dt);
    boss.whirlwindAnim = Math.max(0, boss.whirlwindAnim - dt);
    boss.darkExplosionAnim = Math.max(0, boss.darkExplosionAnim - dt);
    boss.fireRingAnim = Math.max(0, boss.fireRingAnim - dt);
    boss.breathAnim = Math.max(0, boss.breathAnim - dt);
    boss.stompAnim = Math.max(0, boss.stompAnim - dt);
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
      case 'boss_ice_lord':        this._updateIceLord(boss, player, dt); break;
      case 'boss_ancient_ent':     this._updateAncientEnt(boss, player, dt); break;
      case 'boss_dark_knight':     this._updateDarkKnight(boss, player, dt); break;
      // Новые боссы (Шаг 14)
      case 'boss_ghoul_king':      this._updateGhoulKing(boss, player, dt); break;
      case 'boss_ice_serpent':     this._updateIceSerpent(boss, player, dt); break;
      case 'boss_magma_giant':     this._updateMagmaGiant(boss, player, dt); break;
      case 'boss_spider_matriarch':this._updateSpiderMatriarch(boss, player, dt); break;
      case 'boss_knight_commander':this._updateKnightCommander(boss, player, dt); break;
      case 'boss_shadow_dragon':   this._updateShadowDragon(boss, player, dt); break;
      case 'boss_ancient_dragon':  this._updateAncientDragon(boss, player, dt); break;
    }

    // Контактный урон
    this._tryContactDamage(boss, player, dt);
  },

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
     Движение с коллизиями (общее)
     ============================================================ */
  _moveTowards(boss, tx, ty, dt, sign) {
    const cfg = boss.cfg;
    let speed = cfg.speed;
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
        const sx2 = perpX * Math.abs(s) * dt * slide;
        const sy2 = perpY * Math.abs(s) * dt * slide;
        const res2 = GameMap.moveWithCollision(boss.x, boss.y, sx2, sy2, rad);
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
    boss.x = Utils.clamp(boss.x, m, (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) - m);
    boss.y = Utils.clamp(boss.y, m, (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) - m);
  },

  /* ============================================================
     СКЕЛЕТ-РЫЦАРЬ
     ============================================================ */
  _updateSkeletonKnight(boss, player, dt) {
    this._moveTowards(boss, player.x, player.y, dt, 1);
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy);
    const atk = boss.cfg.attacks;

    boss.slashCd = Math.max(0, boss.slashCd - dt);
    boss.whirlwindCd = Math.max(0, boss.whirlwindCd - dt);

    if (boss.whirlwindCd <= 0 && dist <= atk.whirlwind.radius + 10) {
      boss.whirlwindCd = atk.whirlwind.cooldown;
      boss.whirlwindAnim = 0.3;
      if (dist <= atk.whirlwind.radius) {
        if (Player.takeDamage) Player.takeDamage(player, atk.whirlwind.damage, boss);
        else player.hp -= atk.whirlwind.damage;
      }
      if (window.Particles) Particles.ring(boss.x, boss.y, atk.whirlwind.radius, 0.3, 'rgba(255, 255, 255, 0.8)', 3);
      return;
    }

    if (boss.slashCd <= 0 && dist <= atk.slash.range) {
      boss.slashCd = atk.slash.cooldown;
      boss.slashAnim = 0.2;
      if (this._inCone(boss, player, atk.slash.arc)) {
        if (Player.takeDamage) Player.takeDamage(player, atk.slash.damage, boss);
        else player.hp -= atk.slash.damage;
      }
      if (window.Particles) {
        Particles.burst(boss.x + boss.facing.x * 30, boss.y + boss.facing.y * 30, 5, {
          color: '#ffffff', speedMin: 60, speedMax: 120,
          lifeMin: 0.15, lifeMax: 0.3, sizeMin: 2, sizeMax: 4,
        });
      }
    }
  },

  /* ============================================================
     ЛИЧ
     ============================================================ */
  _updateLich(boss, player, dt) {
    const cfg = boss.cfg;
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    if (dist < cfg.keepDist - 20) this._moveTowards(boss, player.x, player.y, dt, -1);
    else if (dist > cfg.keepDist + 30) this._moveTowards(boss, player.x, player.y, dt, 1);
    else { boss.vx = 0; boss.vy = 0; }

    const atk = cfg.attacks;
    const cdMul = (boss.phase >= 2 && cfg.phase2CdMul) ? cfg.phase2CdMul : 1.0;

    boss.boltCd = Math.max(0, boss.boltCd - dt);
    boss.summonCd = Math.max(0, boss.summonCd - dt);
    boss.darkExplosionCd = Math.max(0, boss.darkExplosionCd - dt);
    boss.teleportCd = Math.max(0, boss.teleportCd - dt);

    if (boss.boltCd <= 0) {
      boss.boltCd = atk.bolt.cooldown * cdMul;
      this._shootProjectile(boss, player, 'boss_bolt', atk.bolt.damage, atk.bolt.speed, { homing: true, homingStrength: 3.0 });
    }
    if (boss.summonCd <= 0) {
      boss.summonCd = atk.summon.cooldown * cdMul;
      this._summonMinions(boss, atk.summon.childId, atk.summon.count);
    }
    if (boss.darkExplosionCd <= 0 && dist <= atk.darkExplosion.radius + 40) {
      boss.darkExplosionCd = atk.darkExplosion.cooldown * cdMul;
      boss.darkExplosionAnim = 0.35;
      if (dist <= atk.darkExplosion.radius) {
        if (Player.takeDamage) Player.takeDamage(player, atk.darkExplosion.damage, boss);
        else player.hp -= atk.darkExplosion.damage;
      }
      if (window.Particles) {
        Particles.ring(boss.x, boss.y, atk.darkExplosion.radius, 0.4, 'rgba(128, 0, 255, 0.85)', 4);
      }
    }
  },

  _lichTeleport(boss) {
    if (!window.Game || !Game.player) return;
    const player = Game.player;
    const cfg = boss.cfg;
    const m = Math.max(cfg.w, cfg.h) * 0.5;
    for (let attempt = 0; attempt < 8; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Utils.rand(cfg.keepDist * 0.8, cfg.keepDist * 1.2);
      let tx = player.x + Math.cos(ang) * dist;
      let ty = player.y + Math.sin(ang) * dist;
      tx = Utils.clamp(tx, m, (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) - m);
      ty = Utils.clamp(ty, m, (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) - m);
      if (window.GameMap && GameMap.dungeon && !GameMap.rectIsWalkable(tx, ty, m)) continue;
      if (window.Particles) {
        Particles.burst(boss.x, boss.y, 6, { color: '#a259ff', speedMin: 60, speedMax: 140, lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4 });
      }
      boss.x = tx; boss.y = ty;
      if (window.Particles) {
        Particles.burst(boss.x, boss.y, 6, { color: '#a259ff', speedMin: 60, speedMax: 140, lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4 });
      }
      return;
    }
  },


  /* ============================================================
     ПАУК-КОРОЛЕВА (существующая)
     ============================================================ */
  _updateSpiderQueen(boss, player, dt) {
    const cfg = boss.cfg;
    this._moveTowards(boss, player.x, player.y, dt, 1);
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    boss.webCd = Math.max(0, boss.webCd - dt);
    boss.trailCd = Math.max(0, boss.trailCd - dt);

    if (boss.webCd <= 0) {
      boss.webCd = cfg.attacks.web.cooldown;
      this._shootProjectile(boss, player, 'boss_web', 0, cfg.attacks.web.speed, {
        slowPct: cfg.attacks.web.slowPct, slowDuration: cfg.attacks.web.slowDuration
      });
    }
    if (boss.trailCd <= 0 && cfg.trailEvery) {
      boss.trailCd = cfg.trailEvery;
      if (window.GameMap && typeof GameMap.spawnGroundEffect === 'function') {
        GameMap.spawnGroundEffect(cfg.trail.kind, boss.x, boss.y, {
          radius: cfg.trail.radius, life: cfg.trail.life, slow: cfg.trail.slow, dps: 0,
          color: 'rgba(200, 200, 220, 0.4)',
        });
      }
    }
    // Укус с ядом
    if (boss.hitCooldown <= 0 && dist <= (cfg.attacks.bite.range + player.size * 0.5)) {
      const bite = cfg.attacks.bite;
      if (Player.takeDamage) Player.takeDamage(player, bite.damage, boss);
      else player.hp -= bite.damage;
      let poisonDur = bite.poisonDuration;
      if (player.debuffReduction > 0) poisonDur *= (1 - Math.min(player.debuffReduction, 0.75));
      if (!player.poison || player.poison.remaining <= 0) {
        player.poison = { dps: bite.poisonDps, remaining: poisonDur };
      } else {
        player.poison.remaining = poisonDur;
        player.poison.dps = Math.max(player.poison.dps, bite.poisonDps);
      }
      boss.hitCooldown = cfg.hitInterval || 0.8;
    }
  },

  _spiderQueenSummon(boss) {
    const atk = boss.cfg.attacks.spawnMinions;
    this._summonMinions(boss, atk.childId, atk.count);
  },

  /* ============================================================
     ОГНЕННЫЙ ЭЛЕМЕНТАЛЬ-ЛОРД
     ============================================================ */
  _updateFireLord(boss, player, dt) {
    const cfg = boss.cfg;
    this._moveTowards(boss, player.x, player.y, dt, 1);
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    boss.fireballCd = Math.max(0, boss.fireballCd - dt);
    boss.fireRingCd = Math.max(0, boss.fireRingCd - dt);
    boss.trailCd = Math.max(0, boss.trailCd - dt);

    const atk = cfg.attacks;
    const fireballCooldown = (boss.phase >= 2 && cfg.phase2FireballCd) ? cfg.phase2FireballCd : atk.fireball.cooldown;

    if (boss.fireballCd <= 0) {
      boss.fireballCd = fireballCooldown;
      this._shootProjectile(boss, player, 'boss_fireball', atk.fireball.damage, atk.fireball.speed, { explodeRadius: atk.fireball.explodeRadius });
    }
    if (boss.fireRingCd <= 0) {
      boss.fireRingCd = atk.fireRing.cooldown;
      boss.fireRingAnim = atk.fireRing.expandTime;
      if (window.Particles) Particles.ring(boss.x, boss.y, atk.fireRing.maxRadius, atk.fireRing.expandTime, 'rgba(255, 140, 0, 0.85)', 4);
      setTimeout(() => {
        if (!this.current && !this.guardian) return;
        if (boss.hp <= 0) return;
        if (!window.Game || !Game.player) return;
        const px = Game.player.x - boss.x, py = Game.player.y - boss.y;
        const pd = Math.hypot(px, py);
        if (pd <= atk.fireRing.maxRadius && pd >= atk.fireRing.maxRadius * 0.3) {
          Game.player.hp -= atk.fireRing.damage;
        }
      }, atk.fireRing.expandTime * 1000);
    }
    if (boss.trailCd <= 0 && cfg.trailEvery) {
      boss.trailCd = cfg.trailEvery;
      if (window.GameMap && typeof GameMap.spawnGroundEffect === 'function') {
        GameMap.spawnGroundEffect(cfg.trail.kind, boss.x, boss.y, {
          radius: cfg.trail.radius, life: cfg.trail.life, dps: cfg.trail.dps, slow: 0,
          color: 'rgba(255, 120, 30, 0.55)',
        });
      }
    }
  },

  /* ============================================================
     ЛЕДЯНОЙ ЭЛЕМЕНТАЛЬ-ЛОРД
     ============================================================ */
  _updateIceLord(boss, player, dt) {
    const cfg = boss.cfg;
    this._moveTowards(boss, player.x, player.y, dt, 1);
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    boss.boltCd = Math.max(0, boss.boltCd - dt);
    boss.fireRingCd = Math.max(0, boss.fireRingCd - dt);
    boss.fireballCd = Math.max(0, boss.fireballCd - dt);
    boss.trailCd = Math.max(0, boss.trailCd - dt);

    const atk = cfg.attacks;
    const cdMul = (boss.phase >= 2 && cfg.phase2CdMul) ? cfg.phase2CdMul : 1.0;

    if (boss.boltCd <= 0) {
      boss.boltCd = atk.iceBolt.cooldown * cdMul;
      this._shootProjectile(boss, player, 'boss_ice_bolt', atk.iceBolt.damage, atk.iceBolt.speed, {
        slowPct: atk.iceBolt.slowPct, slowDuration: atk.iceBolt.slowDuration
      });
    }
    if (boss.fireRingCd <= 0 && dist <= atk.frostNova.radius + 40) {
      boss.fireRingCd = atk.frostNova.cooldown * cdMul;
      boss.fireRingAnim = 0.35;
      if (dist <= atk.frostNova.radius) {
        if (Player.takeDamage) Player.takeDamage(player, atk.frostNova.damage, boss);
        else player.hp -= atk.frostNova.damage;
        player._iceSlow = atk.frostNova.slowPct;
        player._iceSlowTimer = atk.frostNova.slowDuration;
      }
      if (window.Particles) Particles.ring(boss.x, boss.y, atk.frostNova.radius, 0.4, 'rgba(77, 166, 255, 0.85)', 4);
    }
    if (boss.fireballCd <= 0) {
      boss.fireballCd = atk.iceSpikes.cooldown * cdMul;
      this._shootSpread(boss, player, 'boss_ice_spike', atk.iceSpikes.damage, atk.iceSpikes.speed, atk.iceSpikes.count, Math.PI / 3);
    }
    if (boss.trailCd <= 0 && cfg.trailEvery) {
      boss.trailCd = cfg.trailEvery;
      if (window.GameMap && typeof GameMap.spawnGroundEffect === 'function') {
        GameMap.spawnGroundEffect(cfg.trail.kind || 'water', boss.x, boss.y, {
          radius: cfg.trail.radius, life: cfg.trail.life, slow: cfg.trail.slow, dps: cfg.trail.dps || 0,
          color: 'rgba(77, 166, 255, 0.4)',
        });
      }
    }
  },

  /* ============================================================
     ДРЕВНИЙ ЭНТ
     ============================================================ */
  _updateAncientEnt(boss, player, dt) {
    const cfg = boss.cfg;
    this._moveTowards(boss, player.x, player.y, dt, 1);
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    boss.slashCd = Math.max(0, boss.slashCd - dt);
    boss.whirlwindCd = Math.max(0, boss.whirlwindCd - dt);
    boss.fireballCd = Math.max(0, boss.fireballCd - dt);
    boss.summonCd = Math.max(0, boss.summonCd - dt);
    const atk = cfg.attacks;

    if (boss.slashCd <= 0 && dist <= atk.branchSwipe.range) {
      boss.slashCd = atk.branchSwipe.cooldown;
      boss.slashAnim = 0.2;
      if (this._inCone(boss, player, atk.branchSwipe.arc)) {
        if (Player.takeDamage) Player.takeDamage(player, atk.branchSwipe.damage, boss);
        else player.hp -= atk.branchSwipe.damage;
      }
      if (window.Particles) Particles.burst(boss.x + boss.facing.x * 30, boss.y + boss.facing.y * 30, 5, { color: '#6a8a4a', speedMin: 60, speedMax: 120, lifeMin: 0.15, lifeMax: 0.3, sizeMin: 2, sizeMax: 4 });
    }
    if (boss.whirlwindCd <= 0 && dist <= atk.rootSlam.radius + 20) {
      boss.whirlwindCd = atk.rootSlam.cooldown;
      boss.whirlwindAnim = 0.3;
      if (dist <= atk.rootSlam.radius) {
        if (Player.takeDamage) Player.takeDamage(player, atk.rootSlam.damage, boss);
        else player.hp -= atk.rootSlam.damage;
      }
      if (window.Particles) Particles.ring(boss.x, boss.y, atk.rootSlam.radius, 0.35, 'rgba(90, 140, 50, 0.8)', 4);
    }
    if (boss.fireballCd <= 0 && dist > 60) {
      boss.fireballCd = atk.poisonSpore.cooldown;
      this._shootSpread(boss, player, 'boss_poison_spore', atk.poisonSpore.damage, atk.poisonSpore.speed, atk.poisonSpore.count, 0.5);
    }
    // Фаза 2: рег + призыв
    if (boss.phase >= 2) {
      if (cfg.phase2Regen) boss.hp = Math.min(boss.maxHp, boss.hp + cfg.phase2Regen * dt);
      if (boss.summonCd <= 0 && cfg.phase2SummonCooldown) {
        boss.summonCd = cfg.phase2SummonCooldown;
        this._summonMinions(boss, cfg.phase2SummonChild || 'mold', cfg.phase2SummonCount || 2);
      }
    }
  },


  /* ============================================================
     ТЁМНЫЙ РЫЦАРЬ
     ============================================================ */
  _updateDarkKnight(boss, player, dt) {
    const cfg = boss.cfg;
    this._moveTowards(boss, player.x, player.y, dt, 1);
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    boss.slashCd = Math.max(0, boss.slashCd - dt);
    boss.darkExplosionCd = Math.max(0, boss.darkExplosionCd - dt);
    boss.summonCd = Math.max(0, boss.summonCd - dt);

    const atk = cfg.attacks;
    const cdMul = (boss.phase >= 2 && cfg.phase2CdMul) ? cfg.phase2CdMul : 1.0;

    if (boss.slashCd <= 0 && dist <= atk.slash.range) {
      boss.slashCd = atk.slash.cooldown * cdMul;
      boss.slashAnim = 0.2;
      if (this._inCone(boss, player, atk.slash.arc)) {
        if (Player.takeDamage) Player.takeDamage(player, atk.slash.damage, boss);
        else player.hp -= atk.slash.damage;
      }
      if (window.Particles) Particles.burst(boss.x + boss.facing.x * 30, boss.y + boss.facing.y * 30, 5, { color: '#cc0000', speedMin: 60, speedMax: 120, lifeMin: 0.15, lifeMax: 0.3, sizeMin: 2, sizeMax: 4 });
    }
    if (boss.darkExplosionCd <= 0 && dist <= atk.darkWave.radius + 30) {
      boss.darkExplosionCd = atk.darkWave.cooldown * cdMul;
      boss.darkExplosionAnim = 0.35;
      if (dist <= atk.darkWave.radius) {
        if (Player.takeDamage) Player.takeDamage(player, atk.darkWave.damage, boss);
        else player.hp -= atk.darkWave.damage;
        if (atk.darkWave.knockback) {
          const nx = dx / dist, ny = dy / dist;
          player.x += nx * atk.darkWave.knockback;
          player.y += ny * atk.darkWave.knockback;
        }
      }
      if (window.Particles) Particles.ring(boss.x, boss.y, atk.darkWave.radius, 0.4, 'rgba(180, 0, 0, 0.85)', 4);
    }
    if (boss.summonCd <= 0) {
      boss.summonCd = atk.summon.cooldown * cdMul;
      this._summonMinions(boss, atk.summon.childId, atk.summon.count);
    }
  },

  /* ============================================================
     НОВЫЕ БОССЫ — ШАГ 14
     ============================================================ */

  /* --- КОРОЛЬ УПЫРЕЙ --- */
  _updateGhoulKing(boss, player, dt) {
    const cfg = boss.cfg;
    this._moveTowards(boss, player.x, player.y, dt, 1);
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    boss.slashCd = Math.max(0, boss.slashCd - dt);
    boss.summonCd = Math.max(0, boss.summonCd - dt);

    const atk = cfg.attacks;
    const cdMul = (boss.phase >= 2 && cfg.phase2CdMul) ? cfg.phase2CdMul : 1.0;

    // Атака когтями (вампиризм)
    if (boss.slashCd <= 0 && dist <= atk.claws.range) {
      boss.slashCd = atk.claws.cooldown * cdMul;
      boss.slashAnim = 0.2;
      if (this._inCone(boss, player, atk.claws.arc)) {
        const dmg = atk.claws.damage;
        if (Player.takeDamage) Player.takeDamage(player, dmg, boss);
        else player.hp -= dmg;
        // Вампиризм: босс лечит 50% от нанесённого урона
        boss.hp = Math.min(boss.maxHp, boss.hp + dmg * atk.claws.lifesteal);
      }
      if (window.Particles) {
        Particles.burst(boss.x + boss.facing.x * 25, boss.y + boss.facing.y * 25, 5, {
          color: '#ff2222', speedMin: 60, speedMax: 140,
          lifeMin: 0.15, lifeMax: 0.3, sizeMin: 2, sizeMax: 4,
        });
      }
    }

    // Призыв 4 упырей
    if (boss.summonCd <= 0) {
      boss.summonCd = atk.summonGhouls.cooldown * cdMul;
      this._summonMinions(boss, atk.summonGhouls.childId, atk.summonGhouls.count);
      if (window.Particles) {
        Particles.burst(boss.x, boss.y, 8, {
          color: '#440000', speedMin: 40, speedMax: 100,
          lifeMin: 0.3, lifeMax: 0.5, sizeMin: 3, sizeMax: 5,
        });
      }
    }
  },

  /* --- ЛЕДЯНОЙ ЗМЕЙ --- */
  _updateIceSerpent(boss, player, dt) {
    const cfg = boss.cfg;
    this._moveTowards(boss, player.x, player.y, dt, 1);
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    boss.breathCd = Math.max(0, boss.breathCd - dt);
    boss.whirlwindCd = Math.max(0, boss.whirlwindCd - dt); // tail sweep
    boss.specialCd = Math.max(0, boss.specialCd - dt);

    const atk = cfg.attacks;

    // Ледяное дыхание (конус)
    if (boss.breathCd <= 0 && dist <= atk.iceBreath.range) {
      boss.breathCd = atk.iceBreath.cooldown;
      boss.breathAnim = 0.3;
      if (this._inCone(boss, player, atk.iceBreath.arc)) {
        if (Player.takeDamage) Player.takeDamage(player, atk.iceBreath.damage, boss);
        else player.hp -= atk.iceBreath.damage;
        // Замедление
        player._iceSlow = atk.iceBreath.slowPct;
        player._iceSlowTimer = atk.iceBreath.slowDuration;
      }
      if (window.Particles) {
        // Голубой конус
        for (let i = 0; i < 8; i++) {
          const a = Math.atan2(boss.facing.y, boss.facing.x) + Utils.rand(-0.4, 0.4);
          Particles.burst(boss.x + Math.cos(a) * 20, boss.y + Math.sin(a) * 20, 2, {
            color: '#88ccff', speedMin: 100, speedMax: 200,
            lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
          });
        }
      }
    }

    // Удар хвостом (360°, отбрасывание)
    if (boss.whirlwindCd <= 0 && dist <= atk.tailSweep.radius + 10) {
      boss.whirlwindCd = atk.tailSweep.cooldown;
      boss.whirlwindAnim = 0.3;
      if (dist <= atk.tailSweep.radius) {
        if (Player.takeDamage) Player.takeDamage(player, atk.tailSweep.damage, boss);
        else player.hp -= atk.tailSweep.damage;
        // Отбрасывание
        const nx = dx / dist, ny = dy / dist;
        player.x += nx * atk.tailSweep.knockback;
        player.y += ny * atk.tailSweep.knockback;
      }
      if (window.Particles) Particles.ring(boss.x, boss.y, atk.tailSweep.radius, 0.3, 'rgba(200, 230, 255, 0.8)', 3);
    }

    // Фаза 2: ледяной шторм (постоянный AoE)
    if (boss.iceStormActive) {
      const stormR = atk.iceStorm.radius;
      if (dist <= stormR) {
        player.hp -= atk.iceStorm.damage * dt;
      }
      // Визуал: пульсирующие частицы
      if (boss.specialCd <= 0) {
        boss.specialCd = 0.5;
        if (window.Particles) Particles.ring(boss.x, boss.y, stormR, 0.5, 'rgba(100, 180, 255, 0.4)', 2);
      }
    }
  },

  /* --- МАГМА-ГИГАНТ --- */
  _updateMagmaGiant(boss, player, dt) {
    const cfg = boss.cfg;
    this._moveTowards(boss, player.x, player.y, dt, 1);
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    boss.specialCd = Math.max(0, boss.specialCd - dt); // lava wave
    boss.stompCd = Math.max(0, boss.stompCd - dt);
    boss.trailCd = Math.max(0, boss.trailCd - dt);

    const atk = cfg.attacks;
    const cdMul = (boss.phase >= 2 && cfg.phase2CdMul) ? cfg.phase2CdMul : 1.0;

    // Стомп (AoE вокруг)
    if (boss.stompCd <= 0 && dist <= atk.stomp.radius + 20) {
      boss.stompCd = atk.stomp.cooldown * cdMul;
      boss.stompAnim = 0.3;
      if (dist <= atk.stomp.radius) {
        if (Player.takeDamage) Player.takeDamage(player, atk.stomp.damage, boss);
        else player.hp -= atk.stomp.damage;
      }
      if (window.Particles) Particles.ring(boss.x, boss.y, atk.stomp.radius, 0.3, 'rgba(255, 80, 0, 0.8)', 4);
    }

    // Лавовая волна (линия к игроку, оставляет горящую землю)
    if (boss.specialCd <= 0) {
      boss.specialCd = atk.lavaWave.cooldown * cdMul;
      // Стреляем снаряд-волной в направлении игрока
      this._shootProjectile(boss, player, 'boss_fireball', atk.lavaWave.damage, 200, { explodeRadius: 40 });
      // Оставляем горящую землю на позиции босса
      if (window.GameMap && typeof GameMap.spawnGroundEffect === 'function') {
        const steps = 4;
        const nx = boss.facing.x, ny = boss.facing.y;
        for (let i = 0; i < steps; i++) {
          const gx = boss.x + nx * i * 50;
          const gy = boss.y + ny * i * 50;
          GameMap.spawnGroundEffect('fire', gx, gy, {
            radius: 24, life: atk.lavaWave.burnDuration || 3.0,
            dps: atk.lavaWave.burnDps || 8, slow: 0,
            color: 'rgba(255, 80, 0, 0.5)',
          });
        }
      }
      if (window.Particles) {
        Particles.burst(boss.x + boss.facing.x * 40, boss.y + boss.facing.y * 40, 8, {
          color: '#ff6600', speedMin: 80, speedMax: 180,
          lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 6,
        });
      }
    }

    // Горящий след
    if (boss.trailCd <= 0 && cfg.trailEvery) {
      boss.trailCd = cfg.trailEvery;
      if (window.GameMap && typeof GameMap.spawnGroundEffect === 'function') {
        GameMap.spawnGroundEffect(cfg.trail.kind, boss.x, boss.y, {
          radius: cfg.trail.radius, life: cfg.trail.life, dps: cfg.trail.dps, slow: 0,
          color: 'rgba(255, 100, 20, 0.5)',
        });
      }
    }
  },


  /* --- КОРОЛЕВА ПАУКОВ (новая, boss_spider_matriarch) --- */
  _updateSpiderMatriarch(boss, player, dt) {
    const cfg = boss.cfg;
    this._moveTowards(boss, player.x, player.y, dt, 1);
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    boss.webCd = Math.max(0, boss.webCd - dt);
    boss.teleportCd = Math.max(0, boss.teleportCd - dt);

    const atk = cfg.attacks;
    const cdMul = (boss.phase >= 2 && cfg.phase2CdMul) ? cfg.phase2CdMul : 1.0;

    // Создание зон паутины (3 зоны)
    if (boss.webCd <= 0) {
      boss.webCd = atk.webZones.cooldown * cdMul;
      if (window.GameMap && typeof GameMap.spawnGroundEffect === 'function') {
        for (let i = 0; i < atk.webZones.count; i++) {
          // Паутина рядом с игроком
          const ox = player.x + Utils.rand(-80, 80);
          const oy = player.y + Utils.rand(-80, 80);
          GameMap.spawnGroundEffect('slime', ox, oy, {
            radius: atk.webZones.radius, life: atk.webZones.life,
            slow: atk.webZones.slowPct, dps: 0,
            color: 'rgba(220, 220, 240, 0.5)',
          });
        }
      }
      if (window.Particles) Particles.burst(boss.x, boss.y, 5, { color: '#ccccff', speedMin: 40, speedMax: 100, lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4 });
    }

    // Телепортация к игроку
    if (boss.teleportCd <= 0 && dist > 100) {
      boss.teleportCd = atk.teleport.cooldown * cdMul;
      // Телепорт рядом с игроком
      const ang = Math.random() * Math.PI * 2;
      const tdist = 60 + Math.random() * 40;
      let tx = player.x + Math.cos(ang) * tdist;
      let ty = player.y + Math.sin(ang) * tdist;
      const m = Math.max(cfg.w, cfg.h) * 0.5;
      tx = Utils.clamp(tx, m, (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) - m);
      ty = Utils.clamp(ty, m, (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) - m);
      if (window.Particles) Particles.burst(boss.x, boss.y, 6, { color: '#330066', speedMin: 60, speedMax: 140, lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4 });
      boss.x = tx; boss.y = ty;
      if (window.Particles) Particles.burst(boss.x, boss.y, 6, { color: '#330066', speedMin: 60, speedMax: 140, lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4 });
    }
  },

  /* --- РЫЦАРЬ-КОМАНДОР --- */
  _updateKnightCommander(boss, player, dt) {
    const cfg = boss.cfg;
    this._moveTowards(boss, player.x, player.y, dt, 1);
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    boss.slashCd = Math.max(0, boss.slashCd - dt);
    boss.commandCd = Math.max(0, boss.commandCd - dt);

    const atk = cfg.attacks;
    const cdMul = (boss.phase >= 2 && cfg.phase2CdMul) ? cfg.phase2CdMul : 1.0;

    // Удар двуручным мечом (широкий конус)
    if (boss.slashCd <= 0 && dist <= atk.greatsword.range) {
      boss.slashCd = atk.greatsword.cooldown * cdMul;
      boss.slashAnim = 0.25;
      if (this._inCone(boss, player, atk.greatsword.arc)) {
        if (Player.takeDamage) Player.takeDamage(player, atk.greatsword.damage, boss);
        else player.hp -= atk.greatsword.damage;
      }
      if (window.Particles) {
        Particles.burst(boss.x + boss.facing.x * 35, boss.y + boss.facing.y * 35, 6, {
          color: '#ffffff', speedMin: 80, speedMax: 160,
          lifeMin: 0.15, lifeMax: 0.3, sizeMin: 2, sizeMax: 5,
        });
      }
    }

    // Приказ к атаке: баффает всех врагов в радиусе
    if (boss.commandCd <= 0) {
      boss.commandCd = atk.commandAttack.cooldown * cdMul;
      // Баффаем ближайших врагов
      if (window.Game && Game.enemies) {
        const items = Game.enemies.items;
        for (let i = 0; i < items.length; i++) {
          const e = items[i];
          if (!e.active) continue;
          const edx = e.x - boss.x, edy = e.y - boss.y;
          if (edx * edx + edy * edy <= atk.commandAttack.radius * atk.commandAttack.radius) {
            e._commandBuff = atk.commandAttack.buffDuration;
            e._commandSpeedMul = 1 + atk.commandAttack.speedBuff;
          }
        }
      }
      if (window.Particles) {
        Particles.ring(boss.x, boss.y, atk.commandAttack.radius, 0.4, 'rgba(255, 50, 50, 0.7)', 3);
        Particles.text(boss.x, boss.y - 30, 'АТАКА!', 1.5, '#ff4444', 14);
      }
    }
  },

  /* --- ТЕНЕВОЙ ДРАКОН --- */
  _updateShadowDragon(boss, player, dt) {
    const cfg = boss.cfg;
    this._moveTowards(boss, player.x, player.y, dt, 1);
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    boss.breathCd = Math.max(0, boss.breathCd - dt);
    boss.summonCd = Math.max(0, boss.summonCd - dt);

    const atk = cfg.attacks;
    const cdMul = (boss.phase >= 2 && cfg.phase2CdMul) ? cfg.phase2CdMul : 1.0;

    // Дыхание тьмы (конус, снижает урон героя)
    if (boss.breathCd <= 0 && dist <= atk.darkBreath.range) {
      boss.breathCd = atk.darkBreath.cooldown * cdMul;
      boss.breathAnim = 0.3;
      if (this._inCone(boss, player, atk.darkBreath.arc)) {
        if (Player.takeDamage) Player.takeDamage(player, atk.darkBreath.damage, boss);
        else player.hp -= atk.darkBreath.damage;
        // Дебафф: снижает урон героя на 20% на 3 сек
        player._darkDebuff = atk.darkBreath.debuffDmgReduction;
        player._darkDebuffTimer = atk.darkBreath.debuffDuration;
      }
      if (window.Particles) {
        for (let i = 0; i < 10; i++) {
          const a = Math.atan2(boss.facing.y, boss.facing.x) + Utils.rand(-0.35, 0.35);
          Particles.burst(boss.x + Math.cos(a) * 20, boss.y + Math.sin(a) * 20, 1, {
            color: '#6600cc', speedMin: 120, speedMax: 220,
            lifeMin: 0.25, lifeMax: 0.5, sizeMin: 3, sizeMax: 5,
          });
        }
      }
    }

    // Призыв теней (фаза 2, повторяется с кулдауном)
    if (boss.phase >= 2 && boss.summonCd <= 0) {
      boss.summonCd = atk.summonShadows.cooldown * cdMul;
      this._summonMinions(boss, atk.summonShadows.childId, atk.summonShadows.count);
    }
  },


  /* ============================================================
     Вспомогательные методы стрельбы
     ============================================================ */

  /** Стрельба одним снарядом в направлении игрока. */
  _shootProjectile(boss, player, kind, damage, speed, opts) {
    if (!window.Game || !Game.projectiles) return;
    const p = Game.projectiles.spawn();
    if (!p) return;
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;
    p.kind = kind;
    p.owner = 'enemy';
    p.x = boss.x; p.y = boss.y;
    p.vx = (dx / dist) * speed;
    p.vy = (dy / dist) * speed;
    p.life = 3.5;
    p.damage = damage * boss.difficultyMul;
    p.radius = 7;
    p.angle = Math.atan2(dy, dx);
    p.explodeRadius = (opts && opts.explodeRadius) || 0;
    p.source = boss.id;
    if (opts) {
      if (opts.homing) { p.homing = true; p.homingStrength = opts.homingStrength || 3.0; }
      if (opts.slowPct) { p.slowPct = opts.slowPct; p.slowDuration = opts.slowDuration || 2.0; }
    }
  },

  /** Веер снарядов. */
  _shootSpread(boss, player, kind, damage, speed, count, totalSpread) {
    if (!window.Game || !Game.projectiles) return;
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const baseAngle = Math.atan2(dy, dx);
    for (let i = 0; i < count; i++) {
      const p = Game.projectiles.spawn();
      if (!p) break;
      const a = baseAngle + (i - (count - 1) / 2) * (totalSpread / Math.max(1, count - 1));
      p.kind = kind;
      p.owner = 'enemy';
      p.x = boss.x; p.y = boss.y;
      p.vx = Math.cos(a) * speed;
      p.vy = Math.sin(a) * speed;
      p.life = 2.5;
      p.damage = damage * boss.difficultyMul;
      p.radius = 5;
      p.angle = a;
      p.explodeRadius = 0;
      p.source = boss.id;
    }
    if (window.Particles) {
      Particles.burst(boss.x, boss.y, 4, { color: '#88ccff', speedMin: 40, speedMax: 100, lifeMin: 0.2, lifeMax: 0.35, sizeMin: 2, sizeMax: 4 });
    }
  },

  /** Проверка: игрок в конусе перед боссом? */
  _inCone(boss, player, arcDeg) {
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const angleToPlayer = Math.atan2(dy, dx);
    const facingAngle = Math.atan2(boss.facing.y, boss.facing.x);
    let angleDiff = angleToPlayer - facingAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    const halfArc = (arcDeg / 2) * Math.PI / 180;
    return Math.abs(angleDiff) <= halfArc;
  },


  /* ============================================================
     Рендер боссов
     ============================================================ */

  render(ctx, cam, viewW, viewH) {
    if (this.current && this.current.hp > 0) this._renderBoss(ctx, this.current, cam, viewW, viewH);
    if (this.guardian && this.guardian.hp > 0) this._renderBoss(ctx, this.guardian, cam, viewW, viewH);
  },

  _renderBoss(ctx, boss, cam, viewW, viewH) {
    const cfg = boss.cfg;
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    const pad = Math.max(cfg.w, cfg.h) * 1.5;
    if (boss.x + pad < minX || boss.x - pad > maxX ||
        boss.y + pad < minY || boss.y - pad > maxY) return;

    let scale = 1;
    if (boss.spawnAnim > 0) {
      scale = 1 - (boss.spawnAnim / 0.5);
      scale = Math.max(0.01, scale);
    }

    const drawW = cfg.w * scale;
    const drawH = cfg.h * scale;

    ctx.save();

    // Пульсация для огненных боссов
    if (boss.id === 'boss_fire_lord' || boss.id === 'boss_magma_giant') {
      const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.05;
      ctx.translate(boss.x, boss.y);
      ctx.scale(pulse, pulse);
      ctx.translate(-boss.x, -boss.y);
    }

    // Аура (shadow/glow)
    if (boss.id === 'boss_lich' || boss.id === 'boss_shadow_dragon') {
      ctx.shadowColor = 'rgba(128, 0, 255, 0.6)';
      ctx.shadowBlur = 15;
    } else if (boss.id === 'boss_fire_lord' || boss.id === 'boss_magma_giant') {
      ctx.shadowColor = 'rgba(255, 100, 0, 0.7)';
      ctx.shadowBlur = 18;
    } else if (boss.id === 'boss_ice_lord' || boss.id === 'boss_ice_serpent') {
      ctx.shadowColor = 'rgba(77, 166, 255, 0.6)';
      ctx.shadowBlur = 14;
    } else if (boss.id === 'boss_ghoul_king') {
      ctx.shadowColor = 'rgba(255, 0, 0, 0.5)';
      ctx.shadowBlur = 12;
    }

    // --- Спрайтовая отрисовка ---
    const sprite = window.getEnemySprite ? getEnemySprite(boss.id) : null;
    const spriteSize = (window.getSpriteDisplaySize ? getSpriteDisplaySize(boss.id) : Math.max(drawW, drawH)) * scale;

    if (sprite) {
      ctx.imageSmoothingEnabled = false;

      if (boss.flash > 0) {
        // Рисуем спрайт + белая вспышка
        ctx.drawImage(sprite, boss.x - spriteSize / 2, boss.y - spriteSize / 2, spriteSize, spriteSize);
        const prevA = ctx.globalAlpha;
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(boss.x - spriteSize / 2, boss.y - spriteSize / 2, spriteSize, spriteSize);
        ctx.globalAlpha = prevA;
      } else {
        ctx.drawImage(sprite, boss.x - spriteSize / 2, boss.y - spriteSize / 2, spriteSize, spriteSize);
      }

      ctx.imageSmoothingEnabled = true;
    } else {
      // Fallback: старая геометрическая отрисовка
      const fillColor = boss.flash > 0 ? '#ffffff' : cfg.color;
      const strokeColor = cfg.stroke || '#ffffff';
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
          ctx.fill(); ctx.stroke();
          break;
        case 'oval':
          ctx.beginPath();
          ctx.ellipse(boss.x, boss.y, drawW / 2, drawH / 2, 0, 0, Math.PI * 2);
          ctx.fill(); ctx.stroke();
          break;
        case 'diamond':
          ctx.beginPath();
          ctx.moveTo(boss.x, boss.y - drawH / 2);
          ctx.lineTo(boss.x + drawW / 2, boss.y);
          ctx.lineTo(boss.x, boss.y + drawH / 2);
          ctx.lineTo(boss.x - drawW / 2, boss.y);
          ctx.closePath();
          ctx.fill(); ctx.stroke();
          break;
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.max(12, Math.floor(drawW * 0.4)) + 'px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg.letter, boss.x, boss.y + 1);
    }

    ctx.shadowBlur = 0;

    // Ледяной шторм (фаза 2 ледяного змея)
    if (boss.id === 'boss_ice_serpent' && boss.iceStormActive) {
      const r = boss.cfg.attacks.iceStorm.radius;
      const alpha = 0.15 + Math.sin(Date.now() * 0.004) * 0.08;
      ctx.fillStyle = `rgba(100, 180, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(100, 200, 255, 0.4)`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Визуал атак
    if (boss.slashAnim > 0) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      const ang = Math.atan2(boss.facing.y, boss.facing.x);
      ctx.beginPath();
      ctx.moveTo(boss.x, boss.y);
      ctx.lineTo(boss.x + Math.cos(ang) * 40, boss.y + Math.sin(ang) * 40);
      ctx.stroke();
    }
    if (boss.whirlwindAnim > 0) {
      const progress = 1 - (boss.whirlwindAnim / 0.3);
      ctx.strokeStyle = `rgba(255, 255, 255, ${1 - progress})`;
      ctx.lineWidth = 3;
      const r = (boss.cfg.attacks.whirlwind ? boss.cfg.attacks.whirlwind.radius :
                 boss.cfg.attacks.tailSweep ? boss.cfg.attacks.tailSweep.radius :
                 boss.cfg.attacks.rootSlam ? boss.cfg.attacks.rootSlam.radius : 60);
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, r * progress, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (boss.darkExplosionAnim > 0) {
      const progress = 1 - (boss.darkExplosionAnim / 0.35);
      ctx.strokeStyle = `rgba(128, 0, 255, ${1 - progress})`;
      ctx.lineWidth = 4;
      const r = (boss.cfg.attacks.darkExplosion ? boss.cfg.attacks.darkExplosion.radius :
                 boss.cfg.attacks.darkWave ? boss.cfg.attacks.darkWave.radius : 100);
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, r * progress, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (boss.stompAnim > 0) {
      const progress = 1 - (boss.stompAnim / 0.3);
      ctx.strokeStyle = `rgba(255, 100, 0, ${1 - progress})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(boss.x, boss.y, (boss.cfg.attacks.stomp ? boss.cfg.attacks.stomp.radius : 70) * progress, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (boss.breathAnim > 0) {
      // Дыхание — линии в направлении facing
      const progress = boss.breathAnim / 0.3;
      const a = Math.atan2(boss.facing.y, boss.facing.x);
      ctx.strokeStyle = boss.id === 'boss_ice_serpent' ? `rgba(100, 200, 255, ${progress})` : `rgba(128, 0, 200, ${progress})`;
      ctx.lineWidth = 3;
      for (let i = -2; i <= 2; i++) {
        const aa = a + i * 0.15;
        ctx.beginPath();
        ctx.moveTo(boss.x + Math.cos(aa) * 20, boss.y + Math.sin(aa) * 20);
        ctx.lineTo(boss.x + Math.cos(aa) * 80, boss.y + Math.sin(aa) * 80);
        ctx.stroke();
      }
    }

    ctx.restore();
  },


  /* ============================================================
     Рендер полосы HP (экранные координаты) — до 2 полос
     ============================================================ */

  renderHPBar(ctx, viewW, viewH) {
    // Глобальный босс — верхняя полоса
    if (this.current && this.current.hp > 0) {
      this._drawHPBar(ctx, this.current, viewW, 8, '#ff3333', '#ff8800');
    }
    // Страж — чуть ниже
    if (this.guardian && this.guardian.hp > 0) {
      const yOff = (this.current && this.current.hp > 0) ? 34 : 8;
      this._drawHPBar(ctx, this.guardian, viewW, yOff, '#33aaff', '#88ddff');
    }
  },

  _drawHPBar(ctx, boss, viewW, barY, color1, color2) {
    const cfg = boss.cfg;
    const barW = Math.min(400, viewW * 0.5);
    const barH = 18;
    const barX = (viewW - barW) / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

    const hpPct = Utils.clamp(boss.hp / boss.maxHp, 0, 1);

    // Цвет по фазе
    let c1 = color1, c2 = color2;
    if (boss.phase >= 2) { c1 = '#ff0000'; c2 = '#ff4400'; }

    const grad = ctx.createLinearGradient(barX, barY, barX + barW * hpPct, barY);
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, barW * hpPct, barH);

    ctx.strokeStyle = boss.role === 'guardian' ? '#88ddff' : '#ffd700';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const roleLabel = boss.role === 'guardian' ? ' [Страж]' : '';
    ctx.fillText(
      `${cfg.name}${roleLabel}  ${Math.ceil(boss.hp)}/${boss.maxHp}`,
      viewW / 2, barY + barH / 2
    );
  },

  /** Рендер «Босс повержен!» */
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

  /* ============================================================
     ДРЕВНИЙ ДРАКОН — финальный босс кампании (3 фазы)
     ============================================================ */
  _updateAncientDragon(boss, player, dt) {
    const cfg = boss.cfg;
    const atk = cfg.attacks;
    const dx = player.x - boss.x, dy = player.y - boss.y;
    const dist = Math.hypot(dx, dy) || 1;

    // Инициализация кулдаунов
    if (boss.breathCd === undefined) boss.breathCd = 2.0;
    if (boss.specialCd === undefined) boss.specialCd = 4.0;
    if (boss.summonCd === undefined) boss.summonCd = 6.0;
    if (boss.fireRingCd === undefined) boss.fireRingCd = 8.0;
    if (boss._diveCd === undefined) boss._diveCd = 5.0;
    if (boss._roarCd === undefined) boss._roarCd = 8.0;
    if (boss._tailCd === undefined) boss._tailCd = 5.0;
    if (boss._lightningCd === undefined) boss._lightningCd = 4.0;

    // Множитель кулдаунов по фазе
    const cdMul = boss.phase >= 3 ? 0.5 : 1.0;

    // Таймеры
    boss.breathCd = Math.max(0, boss.breathCd - dt);
    boss._diveCd = Math.max(0, boss._diveCd - dt);
    boss.summonCd = Math.max(0, boss.summonCd - dt);
    boss._roarCd = Math.max(0, boss._roarCd - dt);
    boss._tailCd = Math.max(0, boss._tailCd - dt);
    boss._lightningCd = Math.max(0, boss._lightningCd - dt);

    // Движение: медленно преследует
    this._moveTowards(boss, player.x, player.y, dt, 1);

    // === ФАЗА 1 (100%-66%): Огонь и когти ===
    // Огненное дыхание (конус)
    if (boss.breathCd <= 0 && dist <= atk.fireBreath.range + 20) {
      boss.breathCd = atk.fireBreath.cooldown * cdMul;
      boss.breathAnim = 0.4;
      if (this._inCone(boss, player, atk.fireBreath.arc)) {
        const dmg = atk.fireBreath.damage * boss.difficultyMul;
        if (Player.takeDamage) Player.takeDamage(player, dmg, boss);
        else player.hp -= dmg;
      }
      if (window.Particles) {
        const bAngle = Math.atan2(boss.facing.y, boss.facing.x);
        for (let i = 0; i < 8; i++) {
          const spread = (Math.random() - 0.5) * 1.2;
          const spd = Utils.rand(100, 200);
          Particles.burst(boss.x + boss.facing.x * 30, boss.y + boss.facing.y * 30, 3, {
            color: '#ff4400', speedMin: spd, speedMax: spd + 50,
            lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 6,
          });
        }
      }
    }

    // Пикирование (рывок к герою)
    if (boss._diveCd <= 0 && dist > 80) {
      boss._diveCd = atk.dive.cooldown * cdMul;
      // Рывок
      const nx = dx / dist, ny = dy / dist;
      boss.x += nx * Math.min(dist - 30, 200);
      boss.y += ny * Math.min(dist - 30, 200);
      // Урон если оказались рядом
      const newDist = Math.hypot(player.x - boss.x, player.y - boss.y);
      if (newDist < 60) {
        const dmg = atk.dive.damage * boss.difficultyMul;
        if (Player.takeDamage) Player.takeDamage(player, dmg, boss);
        else player.hp -= dmg;
      }
      if (window.Particles) {
        Particles.burst(boss.x, boss.y, 8, {
          color: '#ffd700', speedMin: 80, speedMax: 180,
          lifeMin: 0.2, lifeMax: 0.5, sizeMin: 2, sizeMax: 4,
        });
      }
    }

    // Призыв огненных элементалей
    if (boss.summonCd <= 0) {
      const summonAtk = boss.phase >= 2 ? atk.summonDragonids : atk.summon;
      boss.summonCd = summonAtk.cooldown * cdMul;
      this._summonMinions(boss, summonAtk.childId, summonAtk.count);
    }

    // === ФАЗА 2 (66%-33%): Хаос стихий ===
    if (boss.phase >= 2) {
      // Молния (линия)
      if (boss._lightningCd <= 0) {
        boss._lightningCd = atk.lightningBreath.cooldown * cdMul;
        // Стреляем молнией-снарядом
        this._shootProjectile(boss, player, 'boss_bolt', atk.lightningBreath.damage, 350, {});
        if (window.Particles) {
          Particles.burst(boss.x + boss.facing.x * 20, boss.y + boss.facing.y * 20, 5, {
            color: '#00ccff', speedMin: 100, speedMax: 200,
            lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
          });
        }
      }

      // Крик дракона (AoE замедление)
      if (boss._roarCd <= 0 && dist <= atk.roar.radius + 20) {
        boss._roarCd = atk.roar.cooldown * cdMul;
        if (dist <= atk.roar.radius) {
          // Замедление
          player.webSlow = Math.max(player.webSlow || 0, atk.roar.duration);
        }
        if (window.Particles) {
          Particles.ring(boss.x, boss.y, atk.roar.radius, 0.5, 'rgba(128, 0, 255, 0.8)', 4);
          Particles.text(boss.x, boss.y - 50, 'КРИК!', 1.0, '#a040ff', 16);
        }
      }
    }

    // === ФАЗА 3 (33%-0%): Ярость ===
    if (boss.phase >= 3) {
      // Удар хвостом (360° AoE)
      if (boss._tailCd <= 0 && dist <= atk.tailSwipe.radius) {
        boss._tailCd = atk.tailSwipe.cooldown * cdMul;
        const dmg = atk.tailSwipe.damage * boss.difficultyMul;
        if (Player.takeDamage) Player.takeDamage(player, dmg, boss);
        else player.hp -= dmg;
        // Отбрасывание
        const kbx = dx / dist * atk.tailSwipe.knockback;
        const kby = dy / dist * atk.tailSwipe.knockback;
        player.x += kbx;
        player.y += kby;
        if (window.Particles) {
          Particles.ring(boss.x, boss.y, atk.tailSwipe.radius, 0.3, 'rgba(255, 100, 0, 0.8)', 4);
        }
      }

      // Комбо-дыхание (дополнительный огненный шар в фазе 3)
      if (boss.breathCd <= atk.fireBreath.cooldown * cdMul * 0.5 && boss._diveCd > 2) {
        // Огненный шар дополнительно
        if (boss._extraFireball === undefined) boss._extraFireball = 0;
        boss._extraFireball -= dt;
        if (boss._extraFireball <= 0) {
          boss._extraFireball = 2.0 * cdMul;
          this._shootProjectile(boss, player, 'boss_fireball', 25, 200, { explodeRadius: 40 });
        }
      }
    }
  },

  /** Рендер анонса имени босса при появлении. */
  renderBossAnnounce(ctx, viewW, viewH) {
    if (this.bossAnnounce <= 0) return;
    const alpha = Math.min(1, this.bossAnnounce / 0.5);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 22px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚔ ' + this.bossAnnounceName + ' ⚔', viewW / 2, viewH / 4);
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  /** Рендер золотого сундука босса. */
  renderBossChest(ctx, chest, cam, viewW, viewH) {
    if (!chest) return;
    const screenX = chest.x - cam.x;
    const screenY = chest.y - cam.y;
    if (screenX < -50 || screenX > viewW + 50 || screenY < -50 || screenY > viewH + 50) return;

    chest.pulse += 0.016;
    const s = chest.size;
    const pulse = 1 + Math.sin(chest.pulse * 5) * 0.08;
    const w = s * pulse, h = s * pulse;

    ctx.shadowColor = 'rgba(255, 215, 80, 1.0)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(chest.x - w / 2, chest.y - h / 2, w, h);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#b8860b';
    ctx.lineWidth = 2;
    ctx.strokeRect(chest.x - w / 2 + 1, chest.y - h / 2 + 1, w - 2, h - 2);
    ctx.fillStyle = '#b8860b';
    ctx.fillRect(chest.x - w / 2, chest.y - 2, w, 3);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★', chest.x, chest.y + 1);
  },
};

window.Bosses = Bosses;

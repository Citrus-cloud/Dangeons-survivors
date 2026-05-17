'use strict';
/* ============================================================
   enemies.js — враги (Шаг 4).

   Архитектура:
   - Один класс данных createEnemy() (используется пулом).
   - Каждый враг хранит ссылку на конфиг ENEMY_TYPES[id] и
     текущее состояние (state, таймеры и т.п.).
   - Enemies.update(pool, player, dt) — главный цикл, диспетчер
     поведения по cfg.behavior.
   - Enemies.spawnWave(pool, player, count, waveIndex) — формирует
     волну из доступных тиров с весами.
   - Enemies.spawnByType(pool, id, x, y) — спавн одиночного врага
     (используется и для child-спавнов: паучки, слизни, призывы).
   - Enemies.handleDeath(e, gameCtx) — последствия смерти:
     лужи, splitOnDeath, взрывы.
   - Enemies.render(ctx, ...) — отрисовка по shape.
   - Поддержка мимика: Enemies.tryMimicSpawn(player, runTime, state).
   ============================================================ */

function createEnemy() {
  return {
    active: false,
    type: 'skeleton',
    cfg: null,                      // ссылка на ENEMY_TYPES[type]
    x: 0, y: 0,
    vx: 0, vy: 0,
    hp: 0, maxHp: 0,
    damage: 0,                      // текущее значение (с учётом ауры)
    hitCooldown: 0,                 // таймер контактного урона
    flash: 0,                       // мерцание при попадании
    attackPunch: 0,                 // 0..1 — анимация "удара" (увеличение размера)
    bobPhase: 0,                    // фаза покачивания
    lifeTime: 0,                    // секунд с момента спавна

    // AI
    state: '',                      // 'idle' | 'chase' | 'flee' | 'retreat' | 'invisible' | ...
    attackCooldown: 0,              // ranged-attack timer
    specialCooldown: 0,             // teleport / dash / spore / summon
    dashing: false,
    dashTimer: 0,                   // время до конца текущего рывка
    dashCd: 0,                      // время до начала следующего рывка
    invisible: false,
    visTimer: 0,
    invulnerable: false,
    captainBuffed: false,
    activated: true,                // мимик стартует с false
    summons: [],                    // активные призванные (для культиста)
    sinPhase: 0,                    // для bat
  };
}


/* Внутренние утилиты ----------------------------------------- */
function _norm(dx, dy) {
  const l = Math.hypot(dx, dy) || 1;
  return { x: dx / l, y: dy / l, l };
}

function _spawnEnemyProjectile(e, dirx, diry, kind, opts) {
  if (!window.Game || !Game.projectiles) return null;
  const p = Game.projectiles.spawn();
  if (!p) return null;
  const speed = opts.speed || 280;
  p.kind = kind;
  p.owner = 'enemy';                // важный флаг: пуля врага → бьёт игрока
  p.x = e.x; p.y = e.y;
  p.vx = dirx * speed;
  p.vy = diry * speed;
  p.life = opts.life || 2.5;
  p.damage = opts.damage || e.damage || 8;
  p.radius = opts.radius || 5;
  p.angle = Math.atan2(diry, dirx);
  p.explodeRadius = 0;
  p.source = e.type;
  return p;
}

function _spawnGroundEffect(kind, x, y, opts) {
  if (window.GameMap && typeof GameMap.spawnGroundEffect === 'function') {
    return GameMap.spawnGroundEffect(kind, x, y, opts);
  }
  return null;
}

function _emitDeathParticles(e) {
  if (!window.Particles) return;
  const cfg = e.cfg || {};
  Particles.burst(e.x, e.y, Utils.randInt(3, 5), {
    color: cfg.color || '#888',
    speedMin: 40, speedMax: 110,
    lifeMin: 0.4, lifeMax: 0.7,
    sizeMin: 2, sizeMax: 4,
  });
}

/* Урон игроку при контакте (для тех behaviour'ов, где есть). */
function _tryContactDamage(e, player, dt) {
  if (!e.cfg || !e.cfg.damage) return;
  if (!e.activated) return;
  e.hitCooldown = Math.max(0, e.hitCooldown - dt);
  const collideR = (Math.max(e.cfg.w, e.cfg.h) + player.size) * 0.5;
  const dx = player.x - e.x, dy = player.y - e.y;
  if (dx * dx + dy * dy < collideR * collideR && e.hitCooldown <= 0) {
    let dmg = e.damage * (e.captainBuffed ? (e.cfg.tier && ENEMY_TYPES.captain.auraDmgMul || 1.20) : 1);
    // shadow backstab: если игрок не двигался и видим (не invisible)
    if (e.cfg.behavior === 'shadow' && !e.invisible) {
      const ml = Math.hypot(player.moveDir.x, player.moveDir.y);
      if (ml < 0.05) dmg *= e.cfg.backstabMul || 1.5;
    }
    player.hp -= dmg;
    e.hitCooldown = e.cfg.hitInterval || 0.6;
    e.attackPunch = 0.10;
  }
}

/* Скорость врага с учётом dash и captain aura. */
function _currentSpeed(e) {
  const base = (e.cfg && e.cfg.speed) || 0;
  let s = base;
  if (e.captainBuffed) s *= (ENEMY_TYPES.captain.auraSpeedMul || 1.20);
  if (e.dashing) s *= (e.cfg.dashMul || 2.0);
  return s;
}

/* Двинуть к/от точке (px-shift в этом кадре). */
function _moveTowards(e, tx, ty, dt, sign) {
  const n = _norm(tx - e.x, ty - e.y);
  const s = _currentSpeed(e) * (sign || 1);
  e.vx = n.x * s;
  e.vy = n.y * s;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  // границы карты
  const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
  e.x = Utils.clamp(e.x, m, CONFIG.MAP.W - m);
  e.y = Utils.clamp(e.y, m, CONFIG.MAP.H - m);
}


/* ============================================================
   Per-behavior updates
   ============================================================ */

const Behaviors = {

  /* ---------- Простая погоня + контактный урон ---------- */
  chase(e, player, dt) {
    _moveTowards(e, player.x, player.y, dt, +1);
    _tryContactDamage(e, player, dt);
  },

  /* ---------- Гоблин: hit-and-run ---------- */
  goblin(e, player, dt) {
    if (e.state !== 'retreat') {
      // Подходим. После касания (hitCooldown сработал) — переключаемся в retreat.
      const wasReady = e.hitCooldown <= 0.0001;
      _moveTowards(e, player.x, player.y, dt, +1);
      _tryContactDamage(e, player, dt);
      if (wasReady && e.hitCooldown > 0) {
        e.state = 'retreat';
        e.specialCooldown = e.cfg.retreatCooldown || 1.5;
      }
    } else {
      // Отбегаем
      e.specialCooldown -= dt;
      _moveTowards(e, player.x, player.y, dt, -1);
      // Если отбежал на retreatDist или таймер вышел — обратно
      const dx = player.x - e.x, dy = player.y - e.y;
      if (dx * dx + dy * dy >= (e.cfg.retreatDist || 80) ** 2 || e.specialCooldown <= 0) {
        e.state = 'chase';
      }
    }
  },

  /* ---------- Лучник: keep distance, стреляет ---------- */
  archer(e, player, dt) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const minD = e.cfg.keepDistMin || 150;
    const maxD = e.cfg.keepDistMax || 200;
    if (d < minD - 5) {
      _moveTowards(e, player.x, player.y, dt, -1); // отбегает
    } else if (d > maxD + 5) {
      _moveTowards(e, player.x, player.y, dt, +1); // подходит
    } else {
      e.vx = e.vy = 0;
    }
    // Стрельба
    e.attackCooldown -= dt;
    if (e.attackCooldown <= 0 && d <= maxD * 1.4) {
      const n = _norm(dx, dy);
      const pj = e.cfg.projectile || {};
      _spawnEnemyProjectile(e, n.x, n.y, pj.kind || 'arrow_e', {
        speed: pj.speed || 320, life: pj.life || 2.5,
        damage: e.damage, radius: 4,
      });
      e.attackCooldown = e.cfg.attackCooldown || 2.0;
      e.attackPunch = 0.1;
    }
  },

  /* ---------- Газовый спор: плывёт, при смерти взрыв ---------- */
  gas(e, player, dt) {
    _moveTowards(e, player.x, player.y, dt, +1);
    // Контактный урон не наносит (по ТЗ "не атакует в ближнем бою").
  },

  /* ---------- Скелет-маг: телепорт + magebolt ---------- */
  mage(e, player, dt) {
    e.specialCooldown -= dt;
    e.attackCooldown -= dt;
    // Телепорт периодически
    if (e.specialCooldown <= 0) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Utils.rand(e.cfg.teleportMin || 100, e.cfg.teleportMax || 150);
      const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
      e.x = Utils.clamp(player.x + Math.cos(ang) * dist, m, CONFIG.MAP.W - m);
      e.y = Utils.clamp(player.y + Math.sin(ang) * dist, m, CONFIG.MAP.H - m);
      e.specialCooldown = e.cfg.teleportEvery || 4.0;
      // Эффекты телепорта
      if (window.Particles) {
        Particles.burst(e.x, e.y, 6, {
          color: '#a259ff', speedMin: 60, speedMax: 140,
          lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4,
        });
      }
    }
    // Иначе стоит на месте и стреляет
    e.vx = e.vy = 0;
    if (e.attackCooldown <= 0) {
      const n = _norm(player.x - e.x, player.y - e.y);
      const pj = e.cfg.projectile || {};
      _spawnEnemyProjectile(e, n.x, n.y, pj.kind || 'magebolt', {
        speed: pj.speed || 280, life: pj.life || 3,
        damage: e.damage, radius: 7,
      });
      e.attackCooldown = e.cfg.attackCooldown || 2.5;
      e.attackPunch = 0.1;
    }
  },

  /* ---------- Паук: рывки ---------- */
  spider(e, player, dt) {
    e.dashCd -= dt;
    if (e.dashing) {
      e.dashTimer -= dt;
      if (e.dashTimer <= 0) {
        e.dashing = false;
        e.dashCd = e.cfg.dashEvery || 2.0;
      }
    } else if (e.dashCd <= 0) {
      e.dashing = true;
      e.dashTimer = e.cfg.dashTime || 0.5;
    }
    _moveTowards(e, player.x, player.y, dt, +1);
    _tryContactDamage(e, player, dt);
  },

  /* ---------- Слизень: оставляет след ---------- */
  ooze(e, player, dt) {
    _moveTowards(e, player.x, player.y, dt, +1);
    _tryContactDamage(e, player, dt);
    e.specialCooldown -= dt;
    if (e.specialCooldown <= 0) {
      const t = e.cfg.trail || {};
      _spawnGroundEffect(t.kind || 'slime', e.x, e.y, {
        radius: t.radius || 22, life: t.life || 2,
        slow: t.slow || 0.20, dps: 0,
        color: 'rgba(255, 160, 60, 0.45)',
      });
      e.specialCooldown = e.cfg.trailEvery || 0.5;
    }
  },

  /* ---------- Капитан: chase, аура — отдельно ---------- */
  captain(e, player, dt) {
    _moveTowards(e, player.x, player.y, dt, +1);
    _tryContactDamage(e, player, dt);
  },

  /* ---------- Огненный элементаль: chase + горящий след ---------- */
  fire_elem(e, player, dt) {
    _moveTowards(e, player.x, player.y, dt, +1);
    _tryContactDamage(e, player, dt);
    e.specialCooldown -= dt;
    if (e.specialCooldown <= 0) {
      const t = e.cfg.trail || {};
      _spawnGroundEffect(t.kind || 'fire', e.x, e.y, {
        radius: t.radius || 22, life: t.life || 2.5,
        dps: t.dps || 5, slow: 0,
        color: 'rgba(255, 120, 30, 0.55)',
      });
      e.specialCooldown = e.cfg.trailEvery || 0.35;
    }
  },

  /* ---------- Летучая мышь: синусоида + ближний бой ---------- */
  bat(e, player, dt) {
    e.sinPhase += (e.cfg.sinFreq || 6) * dt;
    // Базовое направление к игроку
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    const s = _currentSpeed(e);
    // Перпендикуляр к направлению — вектор боковых колебаний
    const perpX = -n.y, perpY = n.x;
    const sin = Math.sin(e.sinPhase);
    // Боковая скорость пропорциональна частоте*амплитуде*cos (производная sin)
    const lateral = Math.cos(e.sinPhase) * (e.cfg.sinAmp || 26) * (e.cfg.sinFreq || 6);
    e.vx = n.x * s + perpX * lateral * 0.05;
    e.vy = n.y * s + perpY * lateral * 0.05;
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    // Ограничение по карте
    const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
    e.x = Utils.clamp(e.x, m, CONFIG.MAP.W - m);
    e.y = Utils.clamp(e.y, m, CONFIG.MAP.H - m);
    // Боковое смещение для рендера и коллизий не нужно — оно уже встроено
    // в скорость.
    void sin; // unused (использовали Math.cos для производной)
    _tryContactDamage(e, player, dt);
  },

  /* ---------- Гнилой голем: chase. Споры — в onDamage (см. handleHit) ---------- */
  rotgolem(e, player, dt) {
    _moveTowards(e, player.x, player.y, dt, +1);
    _tryContactDamage(e, player, dt);
    if (e.specialCooldown > 0) e.specialCooldown -= dt;
  },

  /* ---------- Теневой убийца: невидимость + ближний бой ---------- */
  shadow(e, player, dt) {
    const vis = e.cfg.visibleTime || 2.0;
    const inv = e.cfg.invisibleTime || 1.0;
    e.visTimer = (e.visTimer + dt) % (vis + inv);
    e.invisible = e.visTimer >= vis;
    e.invulnerable = e.invisible;
    _moveTowards(e, player.x, player.y, dt, +1);
    if (!e.invisible) {
      _tryContactDamage(e, player, dt);
    }
  },

  /* ---------- Дракончик: keep distance + дыхание (конус) ---------- */
  dragonet(e, player, dt) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const minD = e.cfg.keepDistMin || 130;
    const maxD = e.cfg.keepDistMax || 180;
    if (d < minD - 5)      _moveTowards(e, player.x, player.y, dt, -1);
    else if (d > maxD + 5) _moveTowards(e, player.x, player.y, dt, +1);
    else { e.vx = e.vy = 0; }
    _tryContactDamage(e, player, dt);
    e.attackCooldown -= dt;
    if (e.attackCooldown <= 0 && d <= (e.cfg.breathRange || 100) * 1.6) {
      const n = _norm(dx, dy);
      const baseAng = Math.atan2(n.y, n.x);
      const range = e.cfg.breathRange || 100;
      // Дыхание = 3 коротких "сегмента" (быстрых снаряда), угловой спред 14°
      for (let i = -1; i <= 1; i++) {
        const a = baseAng + i * (7 * Math.PI / 180);
        _spawnEnemyProjectile(e, Math.cos(a), Math.sin(a), 'breath', {
          speed: 320, life: range / 320 + 0.05,
          damage: e.cfg.breathDamage || 10, radius: 6,
        });
      }
      e.attackCooldown = e.cfg.breathCooldown || 3.0;
      e.attackPunch = 0.12;
    }
  },

  /* ---------- Культист: keep distance, призывает ---------- */
  cultist(e, player, dt) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    const minD = e.cfg.keepDistMin || 100;
    const maxD = e.cfg.keepDistMax || 140;
    if (d < minD - 5)      _moveTowards(e, player.x, player.y, dt, -1);
    else if (d > maxD + 5) _moveTowards(e, player.x, player.y, dt, +1);
    else { e.vx = e.vy = 0; }
    // Чистим ссылки на мёртвых призванных
    e.summons = e.summons.filter(s => s && s.active);
    e.specialCooldown -= dt;
    if (e.specialCooldown <= 0 && e.summons.length < (e.cfg.maxSummons || 3)) {
      const sx = e.x + Utils.rand(-30, 30);
      const sy = e.y + Utils.rand(-30, 30);
      const child = Enemies.spawnByType(Game.enemies, e.cfg.summonChildId || 'skeleton', sx, sy);
      if (child) {
        e.summons.push(child);
        e.attackPunch = 0.15;
        if (window.Particles) {
          Particles.ring(e.x, e.y, 30, 0.4, 'rgba(160,80,255,0.8)', 2);
        }
      }
      e.specialCooldown = e.cfg.summonEvery || 5.0;
    }
  },

  /* ---------- Мимик: idle → chase при приближении ---------- */
  mimic(e, player, dt) {
    if (!e.activated) {
      // Стоит. Неуязвим до активации.
      e.invulnerable = true;
      const dx = player.x - e.x, dy = player.y - e.y;
      const r = e.cfg.activateRadius || 50;
      if (dx * dx + dy * dy <= r * r) {
        e.activated = true;
        e.invulnerable = false;
        e.attackPunch = 0.18;
        // Кусает сразу, если в радиусе
        e.hitCooldown = 0;
        if (window.Particles) {
          Particles.burst(e.x, e.y, 8, {
            color: '#ff3030', speedMin: 80, speedMax: 200,
            lifeMin: 0.35, lifeMax: 0.65, sizeMin: 2, sizeMax: 4,
          });
        }
      }
      return;
    }
    _moveTowards(e, player.x, player.y, dt, +1);
    _tryContactDamage(e, player, dt);
  },

};


/* ============================================================
   Enemies — публичный интерфейс
   ============================================================ */

const Enemies = {

  /** Спавн врага конкретного типа в координатах (x, y). */
  spawnByType(pool, typeId, x, y) {
    const cfg = ENEMY_TYPES[typeId];
    if (!cfg) return null;
    const e = pool.spawn();
    if (!e) return null;
    const m = Math.max(cfg.w, cfg.h) * 0.5;
    e.type = typeId;
    e.cfg = cfg;
    e.x = Utils.clamp(x, m, CONFIG.MAP.W - m);
    e.y = Utils.clamp(y, m, CONFIG.MAP.H - m);
    e.vx = 0; e.vy = 0;
    e.hp = e.maxHp = cfg.hp;
    e.damage = cfg.damage;
    e.hitCooldown = 0;
    e.flash = 0;
    e.attackPunch = 0;
    e.bobPhase = Math.random() * Math.PI * 2;
    e.lifeTime = 0;

    e.state = (cfg.behavior === 'mimic') ? 'idle' : 'chase';
    e.attackCooldown = (cfg.attackCooldown || 0) * Utils.rand(0.5, 1.0);
    e.specialCooldown = (cfg.teleportEvery || cfg.summonEvery ||
                         cfg.trailEvery || cfg.dashEvery || cfg.sporeCooldown || 0)
                        * Utils.rand(0.3, 0.8);
    e.dashing = false;
    e.dashTimer = 0;
    e.dashCd = (cfg.dashEvery || 0) * Utils.rand(0.5, 1.0);
    e.invisible = false;
    e.visTimer = 0;
    e.invulnerable = (cfg.behavior === 'mimic'); // мимик неуязвим до активации
    e.captainBuffed = false;
    e.activated = (cfg.behavior !== 'mimic');
    e.summons.length = 0;
    e.sinPhase = Math.random() * Math.PI * 2;
    return e;
  },

  /** Список доступных тиров для номера волны (1-based). */
  _availableTierIds(waveIndex) {
    const out = [];
    for (let t = 1; t <= 5; t++) {
      const tier = ENEMY_TIERS[t];
      if (tier && waveIndex >= tier.unlockWave) out.push(...tier.ids);
    }
    return out.length ? out : ENEMY_TIERS[1].ids.slice();
  },

  /** Выбор случайного типа с учётом веса cfg.spawnWeight. */
  _pickWeightedType(ids) {
    let total = 0;
    for (const id of ids) total += (ENEMY_TYPES[id].spawnWeight || 1);
    let r = Math.random() * total;
    for (const id of ids) {
      r -= (ENEMY_TYPES[id].spawnWeight || 1);
      if (r <= 0) return id;
    }
    return ids[ids.length - 1];
  },

  /**
   * Заспавнить волну: берём count врагов из доступных тиров,
   * каждого — на расстоянии SPAWN_DIST_MIN..MAX от игрока.
   * waveIndex — 1-based номер волны (для определения тиров).
   */
  spawnWave(pool, player, count, waveIndex) {
    const ids = this._availableTierIds(waveIndex);
    for (let i = 0; i < count; i++) {
      if (pool.countActive() >= CONFIG.POOLS.ENEMIES) break;
      const typeId = this._pickWeightedType(ids);
      const angle = Math.random() * Math.PI * 2;
      const dist = Utils.rand(CONFIG.WAVE.SPAWN_DIST_MIN, CONFIG.WAVE.SPAWN_DIST_MAX);
      const ex = player.x + Math.cos(angle) * dist;
      const ey = player.y + Math.sin(angle) * dist;
      this.spawnByType(pool, typeId, ex, ey);
    }
  },

  /** Главный апдейт всех врагов. */
  update(pool, player, dt) {
    const items = pool.items;

    // 1) Сброс флага ауры
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (e.active) e.captainBuffed = false;
    }
    // 2) Капитаны баффают всех вокруг
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active || !e.cfg) continue;
      if (e.cfg.behavior !== 'captain') continue;
      const r2 = (e.cfg.auraRadius || 100) ** 2;
      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        const t = items[j];
        if (!t.active) continue;
        const dx = t.x - e.x, dy = t.y - e.y;
        if (dx * dx + dy * dy <= r2) t.captainBuffed = true;
      }
    }
    // 3) Update per behavior
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active || !e.cfg) continue;
      e.lifeTime += dt;
      e.bobPhase += dt * 4;
      e.flash = Math.max(0, e.flash - dt);
      e.attackPunch = Math.max(0, e.attackPunch - dt);
      const fn = Behaviors[e.cfg.behavior];
      if (fn) fn(e, player, dt);
      else Behaviors.chase(e, player, dt);
    }
  },

  /**
   * Хук: вызывается из Game.killEnemy перед e.active=false.
   * Спавнит наземные эффекты, дочерних врагов, взрывы.
   */
  handleDeath(e, gameCtx) {
    if (!e || !e.cfg) return;
    const cfg = e.cfg;

    // 1) Лужа гнили / след при смерти (zombie)
    if (cfg.deathPuddle && Math.random() < (cfg.deathPuddle.chance || 1)) {
      const dp = cfg.deathPuddle;
      _spawnGroundEffect(dp.kind || 'rot', e.x, e.y, {
        radius: dp.radius || 40, life: dp.life || 3,
        slow: dp.slow || 0.30, dps: 0,
        color: 'rgba(120, 200, 100, 0.45)',
      });
    }

    // 2) Разделение на дочерних (паук, слизень)
    if (cfg.splitOnDeath) {
      const sp = cfg.splitOnDeath;
      for (let i = 0; i < (sp.count || 2); i++) {
        const ang = Math.random() * Math.PI * 2;
        const r = Utils.rand(10, 22);
        const cx = e.x + Math.cos(ang) * r;
        const cy = e.y + Math.sin(ang) * r;
        Enemies.spawnByType(gameCtx.enemies, sp.childId, cx, cy);
      }
    }

    // 3) Взрыв при смерти (gas, fire_elem)
    let exploded = null;
    if (cfg.behavior === 'gas') {
      exploded = { radius: cfg.explodeRadius || 60, damage: cfg.explodeDamage || 15, color: 'rgba(150,200,120,0.85)' };
    } else if (cfg.explodeOnDeath) {
      exploded = {
        radius: cfg.explodeOnDeath.radius || 80,
        damage: cfg.explodeOnDeath.damage || 20,
        color: 'rgba(255, 140, 30, 0.9)',
      };
    }
    if (exploded) {
      // Урон только игроку (по ТЗ — не врагам)
      const player = gameCtx.player;
      if (player) {
        const dx = player.x - e.x, dy = player.y - e.y;
        if (dx * dx + dy * dy <= exploded.radius * exploded.radius) {
          player.hp -= exploded.damage;
        }
      }
      if (window.Particles) {
        Particles.ring(e.x, e.y, exploded.radius, 0.35, exploded.color, 4);
        Particles.burst(e.x, e.y, 8, {
          color: cfg.color, speedMin: 60, speedMax: 180,
          lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 4,
        });
      }
    }

    _emitDeathParticles(e);
  },

  /**
   * Хук: вызывается из Game.damageEnemy после применения урона
   * (если враг ещё жив). Используется голeмом для выпуска спор.
   */
  handleHit(e, gameCtx) {
    if (!e || !e.cfg) return;
    const cfg = e.cfg;
    if (cfg.behavior === 'rotgolem' && e.specialCooldown <= 0) {
      e.specialCooldown = cfg.sporeCooldown || 5.0;
      const childId = cfg.sporeChildId || 'gasspore';
      for (let i = 0; i < 2; i++) {
        const ang = Math.random() * Math.PI * 2;
        const r = Utils.rand(20, 30);
        Enemies.spawnByType(gameCtx.enemies, childId,
          e.x + Math.cos(ang) * r, e.y + Math.sin(ang) * r);
      }
    }
  },

  /* ============================================================
     Спавн мимика — отдельный режим (не в волнах).
     state — { active, count, nextCheckTime }.
     ============================================================ */
  initMimicState() {
    return { count: 0, nextCheckTime: MIMIC_CONFIG.MIN_TIME };
  },

  /** Попытка заспавнить мимика. Возвращает true, если заспавнили. */
  tryMimicSpawn(player, runTime, mimicState) {
    if (!player || !mimicState) return false;
    if (runTime < MIMIC_CONFIG.MIN_TIME) return false;
    if (mimicState.count >= MIMIC_CONFIG.MAX_PER_RUN) return false;
    if (runTime < mimicState.nextCheckTime) return false;
    mimicState.nextCheckTime = runTime + MIMIC_CONFIG.CHECK_INTERVAL;
    if (Math.random() > MIMIC_CONFIG.CHANCE_PER_CHECK) return false;
    // Координата спавна
    const ang = Math.random() * Math.PI * 2;
    const dist = Utils.rand(MIMIC_CONFIG.SPAWN_MIN_DIST, MIMIC_CONFIG.SPAWN_MAX_DIST);
    const m = Math.max(ENEMY_TYPES.mimic.w, ENEMY_TYPES.mimic.h) * 0.5;
    let mx = Utils.clamp(player.x + Math.cos(ang) * dist, m, CONFIG.MAP.W - m);
    let my = Utils.clamp(player.y + Math.sin(ang) * dist, m, CONFIG.MAP.H - m);
    const e = Enemies.spawnByType(Game.enemies, 'mimic', mx, my);
    if (e) {
      mimicState.count += 1;
      if (window.Particles) Particles.chestGlow(mx, my);
      return true;
    }
    return false;
  },


  /* ============================================================
     Render
     ============================================================ */
  render(ctx, pool, cam, viewW, viewH) {
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    const items = pool.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active || !e.cfg) continue;
      const cfg = e.cfg;
      const w = cfg.w, h = cfg.h;
      const halfMaxR = Math.max(w, h);
      if (e.x + halfMaxR < minX || e.x - halfMaxR > maxX ||
          e.y + halfMaxR < minY || e.y - halfMaxR > maxY) continue;

      // Покачивание (по высоте)
      const renderY = e.y + Math.sin(e.bobPhase) * (cfg.wobble || 0);
      const renderX = e.x;

      // Пульсация атаки: до +20% размера в течение 0.1 сек
      const punch = e.attackPunch > 0 ? 1 + 0.20 * (e.attackPunch / 0.10) : 1;
      const drawW = w * punch, drawH = h * punch;

      // Прозрачность (мерцание — теневой убийца)
      let prevAlpha = ctx.globalAlpha;
      if (cfg.behavior === 'shadow') {
        // Видим: 1.0; в фазе invisible — 0.20
        ctx.globalAlpha = e.invisible ? 0.20 : 1.0;
      }

      // Цвет тела (мерцание при попадании)
      const baseColor = cfg.color || '#888';
      const fillColor = e.flash > 0 ? '#ffffff' : baseColor;
      const strokeColor = cfg.stroke || '#ffffff';

      // Особый случай: мимик в idle — рисуем "сундук"
      if (cfg.behavior === 'mimic' && !e.activated) {
        ctx.shadowColor = 'rgba(255, 215, 80, 0.7)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#d8a826';
        ctx.fillRect(renderX - drawW / 2, renderY - drawH / 2, drawW, drawH);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#8a6a14';
        ctx.lineWidth = 2;
        ctx.strokeRect(renderX - drawW / 2 + 1, renderY - drawH / 2 + 1, drawW - 2, drawH - 2);
        ctx.fillStyle = '#8a6a14';
        ctx.fillRect(renderX - drawW / 2, renderY - 2, drawW, 3);
        ctx.fillStyle = '#fffce0';
        ctx.font = 'bold 16px ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', renderX, renderY + 1);
        ctx.globalAlpha = prevAlpha;
        // HP-бар у мимика в idle не показываем
        continue;
      }

      // Капитан — корона над головой
      if (cfg.behavior === 'captain') {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.18)';
        ctx.beginPath();
        ctx.arc(renderX, renderY, cfg.auraRadius || 100, 0, Math.PI * 2);
        ctx.fill();
      }

      // Основная фигура
      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;

      switch (cfg.shape) {
        case 'rect': {
          ctx.fillRect(renderX - drawW / 2, renderY - drawH / 2, drawW, drawH);
          ctx.strokeRect(renderX - drawW / 2 + 0.5, renderY - drawH / 2 + 0.5, drawW - 1, drawH - 1);
          break;
        }
        case 'oval': {
          ctx.beginPath();
          ctx.ellipse(renderX, renderY, drawW / 2, drawH / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'circle': {
          ctx.beginPath();
          ctx.arc(renderX, renderY, drawW / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'diamond': {
          ctx.beginPath();
          ctx.moveTo(renderX, renderY - drawH / 2);
          ctx.lineTo(renderX + drawW / 2, renderY);
          ctx.lineTo(renderX, renderY + drawH / 2);
          ctx.lineTo(renderX - drawW / 2, renderY);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        case 'triangle': {
          ctx.beginPath();
          ctx.moveTo(renderX, renderY - drawH / 2);
          ctx.lineTo(renderX + drawW / 2, renderY + drawH / 2);
          ctx.lineTo(renderX - drawW / 2, renderY + drawH / 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          break;
        }
        default:
          ctx.fillRect(renderX - drawW / 2, renderY - drawH / 2, drawW, drawH);
      }

      // Корона над капитаном (золотой треугольник)
      if (cfg.behavior === 'captain') {
        const cy = renderY - drawH / 2 - 6;
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.moveTo(renderX - 8, cy + 4);
        ctx.lineTo(renderX - 4, cy - 3);
        ctx.lineTo(renderX,     cy + 1);
        ctx.lineTo(renderX + 4, cy - 3);
        ctx.lineTo(renderX + 8, cy + 4);
        ctx.closePath();
        ctx.fill();
      }

      // Буква
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold ' + Math.min(16, Math.floor(Math.min(w, h) * 0.6)) + 'px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(cfg.letter || '?', renderX, renderY + 1);

      // HP-бар
      if (e.hp < e.maxHp) {
        const barW = w, barH = 3;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(renderX - barW / 2, renderY - h / 2 - 6, barW, barH);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(renderX - barW / 2, renderY - h / 2 - 6, barW * (e.hp / e.maxHp), barH);
      }

      ctx.globalAlpha = prevAlpha;
    }
  },
};

window.createEnemy = createEnemy;
window.Enemies = Enemies;

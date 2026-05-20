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
    // Шаг 7: замедление от оружий (ледяная стрела и т.п.)
    _slowFactor: 0,
    _slowTimer: 0,
    // Шаг 11: новые поля
    _rageActive: false,
    _chargeState: null,
    _chargeTimer: 0,
    _chargeDirX: 0,
    _chargeDirY: 0,
    _ballHp: -1,
    _shellTimer: 0,
    _shellCd: 0,
    _shellDR: 0,
    _heads: -1,
    _headRegenTimers: [],
    _headDmgAccum: 0,
    _waveCd: 0,
    _tailCd: 0,
    _stalkCd: 0,
    _antiCd: 0,
    _darkWaveCd: 0,
    _summonCd: 0,
    _homingCd: 0,
    _abyssCd: 0,
    _trapCd: 0,
    _headCds: null,
    _orbitAngle: 0,
    _firstStrike: true,
    _speedBoost: 0,
    _speedBoostTimer: 0,
    _diveTargetX: 0,
    _diveTargetY: 0,
    _elite: false,
    _slideSign: 1,
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
  const color = cfg.color || '#888';
  const beh = cfg.behavior || 'chase';

  // Разные эффекты смерти для разных типов
  if (beh === 'gas' || e.type === 'gasspore') {
    // Газовая спора — зелёное облако
    Particles.burst(e.x, e.y, 12, {
      color: '#88cc44', speedMin: 30, speedMax: 80,
      lifeMin: 0.5, lifeMax: 1.0, sizeMin: 3, sizeMax: 6,
    });
  } else if (e.type === 'fire_elem' || e.type === 'hell_hound' || e.type === 'salamander') {
    // Огненные — взрыв искр
    Particles.burst(e.x, e.y, 10, {
      color: '#ff6600', speedMin: 80, speedMax: 200,
      lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 4,
    });
    Particles.burst(e.x, e.y, 5, {
      color: '#ffdd00', speedMin: 40, speedMax: 120,
      lifeMin: 0.2, lifeMax: 0.4, sizeMin: 1, sizeMax: 3,
    });
  } else if (e.type === 'ice_elem') {
    // Ледяные — осколки
    Particles.burst(e.x, e.y, 8, {
      color: '#aaeeff', speedMin: 60, speedMax: 150,
      lifeMin: 0.4, lifeMax: 0.7, sizeMin: 2, sizeMax: 4,
    });
  } else if (e.type === 'ghost' || e.type === 'banshee' || e.type === 'shadow') {
    // Призраки — медленное растворение
    Particles.burst(e.x, e.y, 6, {
      color: '#aaccff', speedMin: 20, speedMax: 50,
      lifeMin: 0.6, lifeMax: 1.2, sizeMin: 2, sizeMax: 5,
    });
  } else if (e.type === 'skeleton' || e.type === 'archer' || e.type === 'captain' ||
             e.type === 'death_knight' || e.type === 'mage') {
    // Скелеты — рассыпание костей
    Particles.burst(e.x, e.y, 8, {
      color: '#e8dcc8', speedMin: 40, speedMax: 120,
      lifeMin: 0.4, lifeMax: 0.8, sizeMin: 2, sizeMax: 3,
    });
  } else {
    // Стандартное рассыпание
    Particles.enemyDust(e.x, e.y, color);
  }
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
    // Шаг 8: используем Player.takeDamage для учёта пассивок
    if (window.Player && Player.takeDamage) {
      Player.takeDamage(player, dmg, e);
    } else {
      player.hp -= dmg;
    }
    e.hitCooldown = e.cfg.hitInterval || 0.6;
    e.attackPunch = 0.10;

    // Шаг 8: Сопротивление — уменьшает длительность дебаффов
    // (poison/webSlow применяется в других местах; тут только контактный урон)
  }
}

/* Скорость врага с учётом dash, captain aura, и замедления от оружий. */
/* Шаг 1: глобальное снижение скорости всех врагов на 20% (множитель 0.8). */
function _currentSpeed(e) {
  const base = (e.cfg && e.cfg.speed) || 0;
  let s = base * 0.8; // Шаг 1: -20% скорость всех врагов
  if (e.captainBuffed) s *= (ENEMY_TYPES.captain.auraSpeedMul || 1.20);
  if (e.dashing) s *= (e.cfg.dashMul || 2.0);
  // Шаг 7: замедление от ледяной стрелы и т.п.
  if (e._slowFactor && e._slowTimer > 0) s *= (1 - e._slowFactor);
  // Шаг 8: аура холода
  if (e.frostSlow && e.frostSlowTimer > 0) s *= (1 - e.frostSlow);
  return s;
}

/* Двинуть к/от точке (px-shift в этом кадре). С умным ИИ: A* pathfinding. */
function _moveTowards(e, tx, ty, dt, sign) {
  const s = _currentSpeed(e) * (sign || 1);
  const rad = Math.max(e.cfg.w, e.cfg.h) * 0.35;

  // Инициализация полей pathfinding на враге
  if (!e._pathCache) e._pathCache = null;
  if (!e._pathRecalcTimer) e._pathRecalcTimer = 0;
  if (!e._pathIndex) e._pathIndex = 0;
  if (!e._stuckTimer) e._stuckTimer = 0;
  if (!e._lastPosX) { e._lastPosX = e.x; e._lastPosY = e.y; }

  // Определяем нужен ли pathfinding (нет прямой видимости ИЛИ враг застрял)
  const usePath = sign > 0; // pathfinding только при движении К цели
  let needsPathfinding = false;

  if (usePath && window.Pathfinding) {
    // Проверяем прямую видимость
    const hasLOS = Pathfinding.hasLineOfSight(e.x, e.y, tx, ty);
    if (!hasLOS) {
      needsPathfinding = true;
    }
    // Проверяем застревание: если за 0.5 сек прошли менее 5px
    e._stuckTimer += dt;
    if (e._stuckTimer >= 0.5) {
      const movedDist = Math.hypot(e.x - e._lastPosX, e.y - e._lastPosY);
      if (movedDist < 5 && Math.hypot(tx - e.x, ty - e.y) > 40) {
        needsPathfinding = true;
      }
      e._stuckTimer = 0;
      e._lastPosX = e.x;
      e._lastPosY = e.y;
    }
  }

  if (needsPathfinding) {
    // Пересчитываем путь не чаще чем раз в 0.4 сек
    e._pathRecalcTimer -= dt;
    if (!e._pathCache || e._pathRecalcTimer <= 0 || e._pathIndex >= (e._pathCache.length || 0)) {
      e._pathCache = Pathfinding.findPath(e.x, e.y, tx, ty, 300);
      e._pathIndex = 0;
      e._pathRecalcTimer = 0.4 + Math.random() * 0.2; // разброс чтобы не все враги считали одновременно
    }

    // Следуем по пути
    if (e._pathCache && e._pathCache.length > 0 && e._pathIndex < e._pathCache.length) {
      const waypoint = e._pathCache[e._pathIndex];
      const wpDx = waypoint.x - e.x, wpDy = waypoint.y - e.y;
      const wpDist = Math.hypot(wpDx, wpDy);

      // Если достигли точки — берём следующую
      if (wpDist < 12) {
        e._pathIndex++;
        if (e._pathIndex >= e._pathCache.length) {
          // Путь закончен — переключаемся на прямое движение
          e._pathCache = null;
        }
      }

      if (e._pathCache && e._pathIndex < e._pathCache.length) {
        const wp = e._pathCache[e._pathIndex];
        const wdx = wp.x - e.x, wdy = wp.y - e.y;
        const wl = Math.hypot(wdx, wdy) || 1;
        e.vx = (wdx / wl) * s;
        e.vy = (wdy / wl) * s;
        let dx = e.vx * dt;
        let dy = e.vy * dt;
        if (window.GameMap && GameMap.dungeon) {
          const res = GameMap.moveWithCollision(e.x, e.y, dx, dy, rad, 0.15);
          e.x = res.x;
          e.y = res.y;
        } else {
          e.x += dx;
          e.y += dy;
        }
        // Границы карты
        const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
        const mapW = (window.GameMap ? GameMap.mapW : CONFIG.MAP.W);
        const mapH = (window.GameMap ? GameMap.mapH : CONFIG.MAP.H);
        e.x = Utils.clamp(e.x, m, mapW - m);
        e.y = Utils.clamp(e.y, m, mapH - m);
        return;
      }
    }
  } else {
    // Прямая видимость есть — сбрасываем pathfinding
    e._pathCache = null;
    e._pathIndex = 0;
  }

  // Прямое движение к цели (обычный режим)
  const n = _norm(tx - e.x, ty - e.y);
  e.vx = n.x * s;
  e.vy = n.y * s;
  let dx = e.vx * dt;
  let dy = e.vy * dt;
  if (window.GameMap && GameMap.dungeon) {
    const res = GameMap.moveWithCollision(e.x, e.y, dx, dy, rad, 0.15);
    e.x = res.x;
    e.y = res.y;
  } else {
    e.x += dx;
    e.y += dy;
  }
  // границы карты
  const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
  const mapW = (window.GameMap ? GameMap.mapW : CONFIG.MAP.W);
  const mapH = (window.GameMap ? GameMap.mapH : CONFIG.MAP.H);
  e.x = Utils.clamp(e.x, m, mapW - m);
  e.y = Utils.clamp(e.y, m, mapH - m);
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
      const _mW = (window.GameMap ? GameMap.mapW : CONFIG.MAP.W);
      const _mH = (window.GameMap ? GameMap.mapH : CONFIG.MAP.H);
      let tx = Utils.clamp(player.x + Math.cos(ang) * dist, m, _mW - m);
      let ty = Utils.clamp(player.y + Math.sin(ang) * dist, m, _mH - m);
      // Телепорт только в проходимую точку
      if (window.GameMap && GameMap.dungeon &&
          !GameMap.rectIsWalkable(tx, ty, m)) {
        // Попробуем несколько раз другое место
        let ok = false;
        for (let k = 0; k < 6; k++) {
          const a2 = Math.random() * Math.PI * 2;
          const d2 = Utils.rand(e.cfg.teleportMin || 100, e.cfg.teleportMax || 150);
          tx = Utils.clamp(player.x + Math.cos(a2) * d2, m, _mW - m);
          ty = Utils.clamp(player.y + Math.sin(a2) * d2, m, _mH - m);
          if (GameMap.rectIsWalkable(tx, ty, m)) { ok = true; break; }
        }
        if (!ok) { tx = e.x; ty = e.y; }
      }
      e.x = tx; e.y = ty;
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
    const lateral = Math.cos(e.sinPhase) * (e.cfg.sinAmp || 26) * (e.cfg.sinFreq || 6);
    e.vx = n.x * s + perpX * lateral * 0.05;
    e.vy = n.y * s + perpY * lateral * 0.05;
    let mx = e.vx * dt, my = e.vy * dt;
    const rad = Math.max(e.cfg.w, e.cfg.h) * 0.35;
    if (window.GameMap && GameMap.dungeon) {
      const r = GameMap.moveWithCollision(e.x, e.y, mx, my, rad, 0.15);
      e.x = r.x; e.y = r.y;
    } else {
      e.x += mx; e.y += my;
    }
    // Ограничение по карте
    const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
    e.x = Utils.clamp(e.x, m, (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) - m);
    e.y = Utils.clamp(e.y, m, (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) - m);
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
    e.x = Utils.clamp(x, m, (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) - m);
    e.y = Utils.clamp(y, m, (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) - m);
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

  /**
   * Шаг 13: Фильтрация врагов по биому.
   * Возвращает только тех врагов из ids, которые подходят текущему биому.
   * Если биом не задан — возвращает все.
   */
  _filterByBiome(ids) {
    if (!window.GameMap || !GameMap.currentBiome) return ids;
    const biomeEnemies = GameMap.currentBiome.enemyTypes;
    if (!biomeEnemies || biomeEnemies.length === 0) return ids;
    const filtered = ids.filter(id => biomeEnemies.includes(id));
    // Если фильтр убрал всех — вернём хоть что-то из биома
    return filtered.length > 0 ? filtered : biomeEnemies.filter(id => ENEMY_TYPES[id]);
  },

  /**
   * Шаг 13: Получить множители сложности для текущей карты.
   * Применяется к HP и урону при спавне.
   */
  _getDifficultyMul() {
    if (!window.INFINITE_MODE || !window.GameMap) return { hpMul: 1, dmgMul: 1, xpMul: 1 };
    return INFINITE_MODE.getDifficultyMultiplier(GameMap.currentMapNumber || 1);
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
   *
   * Шаг 5: враги появляются только в комнатах (не в коридорах,
   * не в секретной).
   * Шаг 6: при живом боссе количество врагов снижается на 30%.
   */
  spawnWave(pool, player, count, waveIndex) {
    // Шаг 6: снижение спавна при живом боссе
    if (window.Bosses && Bosses.isAlive()) {
      count = Math.max(1, Math.round(count * (1 - BOSS_CONFIG.WAVE_REDUCTION)));
    }
    // Шаг 19: формула количества врагов из спеки
    const waveCount = 3 + waveIndex * 2 + Math.floor(waveIndex / 5) * 3;
    count = Math.max(count, waveCount);
    // Снижение при живом боссе (повторно, если waveCount больше)
    if (window.Bosses && Bosses.isAlive()) {
      count = Math.max(1, Math.round(count * (1 - BOSS_CONFIG.WAVE_REDUCTION)));
    }

    let ids = this._availableTierIds(waveIndex);
    // Шаг 13: фильтрация по биому
    ids = this._filterByBiome(ids);
    const useDungeon = !!(window.GameMap && GameMap.dungeon);
    // Шаг 13: множители сложности
    const diffMul = this._getDifficultyMul();
    for (let i = 0; i < count; i++) {
      if (pool.countActive() >= CONFIG.POOLS.ENEMIES) break;
      const typeId = this._pickWeightedType(ids);
      let ex, ey;
      if (useDungeon) {
        const pt = GameMap.randomEnemySpawnPoint(player,
          CONFIG.WAVE.SPAWN_DIST_MIN, CONFIG.WAVE.SPAWN_DIST_MAX);
        if (!pt) continue;
        ex = pt.x; ey = pt.y;
      } else {
        const angle = Math.random() * Math.PI * 2;
        const dist = Utils.rand(CONFIG.WAVE.SPAWN_DIST_MIN, CONFIG.WAVE.SPAWN_DIST_MAX);
        ex = player.x + Math.cos(angle) * dist;
        ey = player.y + Math.sin(angle) * dist;
      }
      const e = this.spawnByType(pool, typeId, ex, ey);
      if (e) {
        // Шаг 19: масштабирование HP/урона по волне (спек формула)
        const waveHpMul = 1 + waveIndex * 0.1;
        const waveDmgMul = 1 + waveIndex * 0.08;
        // Шаг 13: множители сложности карты (накладываются поверх)
        const totalHpMul = waveHpMul * diffMul.hpMul;
        const totalDmgMul = waveDmgMul * diffMul.dmgMul;
        e.hp = Math.round(e.hp * totalHpMul);
        e.maxHp = e.hp;
        e.damage = Math.round(e.damage * totalDmgMul);
      }
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
      e.bobPhase += dt * (3.5 + (i % 5) * 0.4); // slight speed variation per enemy
      e.attackPunch = Math.max(0, e.attackPunch - dt);
      // Шаг 7: тик таймера замедления от оружий
      if (e._slowTimer > 0) e._slowTimer -= dt;
      // Шаг 8: тик ауры холода (убывающий таймер)
      if (e.frostSlowTimer > 0) e.frostSlowTimer -= dt;
      // Шаг 8: кровотечение (DoT)
      if (e.bleed && e.bleed.remaining > 0) {
        e.hp -= e.bleed.dps * dt;
        e.bleed.remaining -= dt;
        if (e.hp <= 0 && window.Game) { Game.killEnemy(e); continue; }
      }
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
        slow: dp.slow || 0.30, dps: dp.dps || 0,
        color: dp.color || 'rgba(120, 200, 100, 0.45)',
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
          if (Player.takeDamage) Player.takeDamage(player, exploded.damage, e);
          else player.hp -= exploded.damage;
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
    // Координата спавна — только в комнатах, если есть подземелье
    let mx, my;
    const m = Math.max(ENEMY_TYPES.mimic.w, ENEMY_TYPES.mimic.h) * 0.5;
    if (window.GameMap && GameMap.dungeon) {
      const pt = GameMap.randomEnemySpawnPoint(player,
        MIMIC_CONFIG.SPAWN_MIN_DIST, MIMIC_CONFIG.SPAWN_MAX_DIST);
      if (!pt) return false;
      mx = pt.x; my = pt.y;
    } else {
      const ang = Math.random() * Math.PI * 2;
      const dist = Utils.rand(MIMIC_CONFIG.SPAWN_MIN_DIST, MIMIC_CONFIG.SPAWN_MAX_DIST);
      mx = Utils.clamp(player.x + Math.cos(ang) * dist, m, (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) - m);
      my = Utils.clamp(player.y + Math.sin(ang) * dist, m, (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) - m);
    }
    const e = Enemies.spawnByType(Game.enemies, 'mimic', mx, my);
    if (e) {
      mimicState.count += 1;
      if (window.Particles) Particles.chestGlow(mx, my);
      return true;
    }
    return false;
  },


  /* ============================================================
     Render — редизайн: тени, анимации idle/атаки, flash, свечения
     ============================================================ */
  render(ctx, pool, cam, viewW, viewH) {
    ctx.imageSmoothingEnabled = false;
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    const items = pool.items;
    const hasSprites = !!(window.getEnemySprite);

    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active || !e.cfg) continue;
      const cfg = e.cfg;
      const w = cfg.w, h = cfg.h;
      const halfMaxR = Math.max(w, h) * 1.5;
      if (e.x + halfMaxR < minX || e.x - halfMaxR > maxX ||
          e.y + halfMaxR < minY || e.y - halfMaxR > maxY) continue;

      // --- Анимация idle: разные паттерны по типу ---
      const beh = cfg.behavior || 'chase';
      let bobY = 0, bobX = 0, tilt = 0;
      const phase = e.bobPhase;

      // Слизни — вертикальная пульсация (сжатие/растяжение)
      if (beh === 'ooze' || e.type === 'ooze' || e.type === 'slimeling' ||
          e.type === 'acid_slug') {
        bobY = Math.sin(phase * 1.5) * 1.5;
      }
      // Летающие — плавное парение вверх-вниз с лёгким покачиванием
      else if (beh === 'bat' || e.type === 'ghost' || e.type === 'banshee' ||
               e.type === 'harpy' || e.type === 'gasspore' ||
               e.type === 'beholder_spore' || e.type === 'observer') {
        bobY = Math.sin(phase) * 2.5;
        bobX = Math.cos(phase * 0.7) * 0.8;
      }
      // Пауки — нервная вибрация
      else if (beh === 'spider' || e.type === 'spider' || e.type === 'spiderling' ||
               e.type === 'scorpion') {
        bobY = Math.sin(phase * 3) * 0.5;
        bobX = Math.cos(phase * 4) * 0.3;
      }
      // Скелеты — лёгкий наклон + покачивание
      else if (e.type === 'skeleton' || e.type === 'archer' || e.type === 'mage' ||
               e.type === 'captain' || e.type === 'death_knight') {
        bobY = Math.sin(phase) * 0.8;
        tilt = Math.sin(phase * 0.6) * 0.02; // лёгкий наклон
      }
      // Элементали — дрожание
      else if (e.type === 'fire_elem' || e.type === 'ice_elem' ||
               e.type === 'air_elem' || e.type === 'water_elem') {
        bobY = Math.sin(phase * 2) * 1.2;
        bobX = Math.cos(phase * 2.5) * 0.6;
      }
      // Стандарт — мягкое покачивание
      else {
        bobY = Math.sin(phase) * (cfg.wobble || 1);
      }

      const renderY = e.y + bobY;
      const renderX = e.x + bobX;

      // --- Пульсация атаки: +25% размера + наклон вперёд ---
      const punch = e.attackPunch > 0 ? 1 + 0.25 * (e.attackPunch / 0.12) : 1;
      const attackTilt = e.attackPunch > 0 ? 0.1 * (e.attackPunch / 0.12) : 0;

      // --- Прозрачность (теневой убийца, призраки, мерцание при уроне) ---
      let prevAlpha = ctx.globalAlpha;
      if (beh === 'shadow') {
        ctx.globalAlpha = e.invisible ? 0.15 : 1.0;
      } else if (e.type === 'ghost' || e.type === 'banshee' || e.type === 'night_walker') {
        ctx.globalAlpha = 0.65 + Math.sin(phase * 2) * 0.1;
      }
      // Мерцание при получении урона (flash)
      if (e.flash > 0) {
        ctx.globalAlpha = Math.max(ctx.globalAlpha, 0.5 + Math.sin(e.flash * 30) * 0.3);
      }

      // --- Размер спрайта ---
      const baseSize = window.getSpriteDisplaySize ? getSpriteDisplaySize(e.type) : Math.max(w, h);
      const spriteSize = baseSize * punch;

      // --- Получаем спрайт ---
      const sprite = hasSprites ? getEnemySprite(e.type) : null;

      if (sprite) {
        const half = spriteSize / 2;

        // Тень под врагом (эллипс)
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        if (ctx.ellipse) {
          ctx.ellipse(renderX, e.y + baseSize * 0.38, baseSize * 0.3, baseSize * 0.1, 0, 0, Math.PI * 2);
        } else {
          ctx.arc(renderX, e.y + baseSize * 0.38, baseSize * 0.2, 0, Math.PI * 2);
        }
        ctx.fill();

        // Мимик idle — сундук с золотым свечением
        if (beh === 'mimic' && !e.activated) {
          ctx.shadowColor = 'rgba(255, 215, 80, 0.8)';
          ctx.shadowBlur = 8 + Math.sin(phase * 2) * 3;
          ctx.drawImage(sprite, renderX - half, renderY - half, spriteSize, spriteSize);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = prevAlpha;
          continue;
        }

        // Аура капитана (пульсирующая)
        if (beh === 'captain') {
          const aR = (cfg.auraRadius || 100) * (0.95 + Math.sin(phase) * 0.05);
          ctx.fillStyle = 'rgba(255, 215, 0, 0.12)';
          ctx.beginPath();
          ctx.arc(renderX, renderY, aR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Огненные/ледяные — свечение под спрайтом
        if (e.type === 'fire_elem' || e.type === 'hell_hound') {
          ctx.shadowColor = 'rgba(255, 100, 0, 0.6)';
          ctx.shadowBlur = 8;
        } else if (e.type === 'ice_elem') {
          ctx.shadowColor = 'rgba(100, 180, 255, 0.5)';
          ctx.shadowBlur = 6;
        }

        // --- Отрисовка спрайта с наклоном (tilt + attackTilt) ---
        const totalTilt = tilt + attackTilt;
        if (totalTilt !== 0) {
          ctx.save();
          ctx.translate(renderX, renderY);
          ctx.rotate(totalTilt);
          ctx.drawImage(sprite, -half, -half, spriteSize, spriteSize);
          ctx.restore();
        } else {
          ctx.drawImage(sprite, renderX - half, renderY - half, spriteSize, spriteSize);
        }

        ctx.shadowBlur = 0;

        // Flash при получении урона — белый оверлей поверх спрайта
        if (e.flash > 0) {
          ctx.globalAlpha = Math.min(e.flash * 3, 0.6);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(renderX - half, renderY - half, spriteSize, spriteSize);
          ctx.globalAlpha = prevAlpha;
        }

        // Баффнутые капитаном — золотистая аура
        if (e.captainBuffed) {
          ctx.shadowColor = 'rgba(255, 215, 0, 0.5)';
          ctx.shadowBlur = 5;
          ctx.globalAlpha = 0.4;
          ctx.drawImage(sprite, renderX - half, renderY - half, spriteSize, spriteSize);
          ctx.globalAlpha = prevAlpha;
          ctx.shadowBlur = 0;
        }

        // Замедленные враги — синий оттенок
        if (e._slowTimer > 0 || (e.frostSlowTimer && e.frostSlowTimer > 0)) {
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = 'rgba(100, 180, 255, 0.5)';
          ctx.fillRect(renderX - half, renderY - half, spriteSize, spriteSize);
          ctx.globalAlpha = prevAlpha;
        }

      } else {
        // Fallback: цветной квадрат
        const drawW = w * punch, drawH = h * punch;
        ctx.fillStyle = cfg.color || '#888';
        ctx.fillRect(renderX - drawW / 2, renderY - drawH / 2, drawW, drawH);
      }

      // --- HP-бар (при повреждении) с плавным заполнением ---
      if (e.hp < e.maxHp) {
        const barW = baseSize * 0.8, barH = 3;
        const barX = renderX - barW / 2;
        const barY = renderY - baseSize * 0.5 - 7;
        const hpRatio = Math.max(0, e.hp / e.maxHp);
        // Фон
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        // Полоса HP (градиент от зелёного к красному)
        const hpColor = hpRatio > 0.5 ? '#4caf50' : hpRatio > 0.25 ? '#ff9800' : '#e74c3c';
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
      }

      ctx.globalAlpha = prevAlpha;
    }
  },
};

window.createEnemy = createEnemy;
window.Enemies = Enemies;
window.Behaviors = Behaviors;
window._norm = _norm;
window._spawnEnemyProjectile = _spawnEnemyProjectile;
window._spawnGroundEffect = _spawnGroundEffect;
window._moveTowards = _moveTowards;
window._tryContactDamage = _tryContactDamage;
window._currentSpeed = _currentSpeed;

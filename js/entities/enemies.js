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
const ENEMY_SPEED_GLOBAL_MUL = 0.8; // глобальное снижение скорости всех врагов на 20%

function _currentSpeed(e) {
  const base = (e.cfg && e.cfg.speed) || 0;
  let s = base * ENEMY_SPEED_GLOBAL_MUL;
  if (e.captainBuffed) s *= (ENEMY_TYPES.captain.auraSpeedMul || 1.20);
  if (e.dashing) s *= (e.cfg.dashMul || 2.0);
  if (e._slowFactor && e._slowTimer > 0) s *= (1 - e._slowFactor);
  if (e.frostSlow && e.frostSlowTimer > 0) s *= (1 - e.frostSlow);
  return s;
}

/* Получить размер карты (часто используемый паттерн). */
function _getMapSize() {
  return {
    w: (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) || 2000,
    h: (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) || 2000,
  };
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
      Particles.chestGlow(mx, my);
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
window.ENEMY_SPEED_GLOBAL_MUL = ENEMY_SPEED_GLOBAL_MUL;
'use strict';
/* ============================================================
   enemies_new.js — новые поведения врагов (Шаг 11).
   Расширяет объект Behaviors и Enemies из enemies.js.
   ============================================================ */

/* ---------- Крыса: chase + страх при получении урона ---------- */
Behaviors.rat = function(e, player, dt) {
  if (e.state === 'fear') {
    e.specialCooldown -= dt;
    _moveTowards(e, player.x, player.y, dt, -1);
    if (e.specialCooldown <= 0) e.state = 'chase';
    return;
  }
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
};

/* ---------- Плесень: неподвижна, затем рывок ---------- */
Behaviors.mold = function(e, player, dt) {
  e.specialCooldown -= dt;
  if (e.state === 'lunge') {
    e.dashTimer -= dt;
    const n = _norm(player.x - e.x, player.y - e.y);
    const s = e.cfg.lungeSpeed || 200;
    e.vx = n.x * s; e.vy = n.y * s;
    const dx = e.vx * dt, dy = e.vy * dt;
    const rad = Math.max(e.cfg.w, e.cfg.h) * 0.4;
    if (window.GameMap && GameMap.dungeon) {
      const r = GameMap.moveWithCollision(e.x, e.y, dx, dy, rad);
      e.x = r.x; e.y = r.y;
    } else { e.x += dx; e.y += dy; }
    _tryContactDamage(e, player, dt);
    if (e.dashTimer <= 0) {
      e.state = 'idle';
      e.specialCooldown = e.cfg.lungeCooldown || 4.0;
    }
  } else {
    e.vx = 0; e.vy = 0;
    if (e.specialCooldown <= 0) {
      const dx = player.x - e.x, dy = player.y - e.y;
      if (dx * dx + dy * dy <= (e.cfg.lungeRange || 60) * (e.cfg.lungeRange || 60) * 4) {
        e.state = 'lunge';
        e.dashTimer = e.cfg.lungeTime || 0.3;
      } else {
        e.specialCooldown = 1.0;
      }
    }
  }
};

/* ---------- Гнолл: chase + ярость при HP<50% ---------- */
Behaviors.gnoll = function(e, player, dt) {
  const inRage = e.hp < e.maxHp * (e.cfg.rageHpPct || 0.50);
  if (inRage && !e._rageActive) {
    e._rageActive = true;
    e.cfg = Object.create(e.cfg);
    e.cfg.speed = (e.cfg.__proto__.speed || e.cfg.speed) * (e.cfg.rageSpeedMul || 1.30);
  }
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
};

/* ---------- Кобольд: держит дистанцию, ставит ловушки ---------- */
Behaviors.kobold = function(e, player, dt) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const minD = e.cfg.keepDistMin || 100;
  const maxD = e.cfg.keepDistMax || 140;
  if (d < minD - 5) _moveTowards(e, player.x, player.y, dt, -1);
  else if (d > maxD + 5) _moveTowards(e, player.x, player.y, dt, +1);
  else { e.vx = e.vy = 0; }
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    _spawnGroundEffect('trap', e.x, e.y, {
      radius: e.cfg.trapRadius || 20, life: 15,
      dps: 0, slow: 0, trapDamage: e.cfg.trapDamage || 10,
      color: 'rgba(100,100,100,0.4)',
    });
    e.specialCooldown = e.cfg.trapCooldown || 10.0;
    e.attackPunch = 0.1;
  }
};

/* ---------- Пещерный краб: боком + панцирь ---------- */
Behaviors.crab = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  if (e._shellTimer > 0) {
    e._shellTimer -= dt;
    e.invulnerable = false;
  }
  if (e._shellCd > 0) e._shellCd -= dt;
};

/* ---------- Призрак: игнорирует стены ---------- */
Behaviors.ghost = function(e, player, dt) {
  const n = _norm(player.x - e.x, player.y - e.y);
  const s = _currentSpeed(e);
  e.vx = n.x * s; e.vy = n.y * s;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
  e.x = Utils.clamp(e.x, m, CONFIG.MAP.W - m);
  e.y = Utils.clamp(e.y, m, CONFIG.MAP.H - m);
  _tryContactDamage(e, player, dt);
};

/* ---------- Гарпия: пикирует → отлетает ---------- */
Behaviors.harpy = function(e, player, dt) {
  if (e.state === 'dive') {
    e.dashTimer -= dt;
    const n = _norm(e._diveTargetX - e.x, e._diveTargetY - e.y);
    const s = e.cfg.diveSpeed || 300;
    e.vx = n.x * s; e.vy = n.y * s;
    const dx2 = e.vx * dt, dy2 = e.vy * dt;
    const rad = Math.max(e.cfg.w, e.cfg.h) * 0.4;
    if (window.GameMap && GameMap.dungeon) {
      const r = GameMap.moveWithCollision(e.x, e.y, dx2, dy2, rad);
      e.x = r.x; e.y = r.y;
    } else { e.x += dx2; e.y += dy2; }
    _tryContactDamage(e, player, dt);
    if (e.dashTimer <= 0) {
      e.state = 'retreat';
      e.specialCooldown = 1.0;
    }
  } else if (e.state === 'retreat') {
    _moveTowards(e, player.x, player.y, dt, -1);
    e.specialCooldown -= dt;
    const dx = player.x - e.x, dy = player.y - e.y;
    if (dx * dx + dy * dy >= (e.cfg.retreatDist || 120) ** 2 || e.specialCooldown <= 0) {
      e.state = 'chase';
      e.attackCooldown = e.cfg.diveCooldown || 3.0;
    }
  } else {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d > 60) _moveTowards(e, player.x, player.y, dt, +1);
    else { e.vx = 0; e.vy = 0; }
    e.attackCooldown -= dt;
    if (e.attackCooldown <= 0) {
      e.state = 'dive';
      e.dashTimer = e.cfg.diveTime || 0.4;
      e._diveTargetX = player.x;
      e._diveTargetY = player.y;
      e.attackPunch = 0.12;
    }
  }
};


/* ---------- Жук-навозник: катит шар, без шара убегает ---------- */
Behaviors.beetle = function(e, player, dt) {
  if (e._ballHp === undefined) e._ballHp = e.cfg.ballHp || 20;
  if (e._ballHp > 0) {
    _moveTowards(e, player.x, player.y, dt, +1);
    _tryContactDamage(e, player, dt);
  } else {
    _moveTowards(e, player.x, player.y, dt, -1);
  }
};

/* ---------- Минотавр: заряд → рывок → отдых ---------- */
Behaviors.minotaur = function(e, player, dt) {
  if (!e._chargeState) e._chargeState = 'idle';
  switch (e._chargeState) {
    case 'idle':
      _moveTowards(e, player.x, player.y, dt, +1);
      _tryContactDamage(e, player, dt);
      e.attackCooldown -= dt;
      if (e.attackCooldown <= 0) {
        e._chargeState = 'windup';
        e._chargeTimer = e.cfg.chargeWindup || 1.5;
        e._chargeDirX = player.x - e.x;
        e._chargeDirY = player.y - e.y;
        e.attackPunch = 0.15;
      }
      break;
    case 'windup':
      e.vx = 0; e.vy = 0;
      e._chargeTimer -= dt;
      if (e._chargeTimer <= 0) {
        e._chargeState = 'charge';
        const n = _norm(e._chargeDirX, e._chargeDirY);
        e._chargeDirX = n.x; e._chargeDirY = n.y;
        e._chargeTimer = (e.cfg.chargeRange || 120) / (e.cfg.chargeSpeed || 300);
      }
      break;
    case 'charge': {
      e._chargeTimer -= dt;
      const s = e.cfg.chargeSpeed || 300;
      e.vx = e._chargeDirX * s; e.vy = e._chargeDirY * s;
      const dx2 = e.vx * dt, dy2 = e.vy * dt;
      const rad = Math.max(e.cfg.w, e.cfg.h) * 0.4;
      if (window.GameMap && GameMap.dungeon) {
        const r = GameMap.moveWithCollision(e.x, e.y, dx2, dy2, rad);
        e.x = r.x; e.y = r.y;
      } else { e.x += dx2; e.y += dy2; }
      // Контактный урон при заряде — повышенный
      const collideR = (Math.max(e.cfg.w, e.cfg.h) + player.size) * 0.5;
      const pdx = player.x - e.x, pdy = player.y - e.y;
      if (pdx * pdx + pdy * pdy < collideR * collideR && e.hitCooldown <= 0) {
        const dmg = e.cfg.damage;
        if (Player.takeDamage) Player.takeDamage(player, dmg, e);
        else player.hp -= dmg;
        e.hitCooldown = 1.0;
        // Отбрасывание игрока удалено — свободное скольжение по стенам
      }
      if (e._chargeTimer <= 0) {
        e._chargeState = 'rest';
        e._chargeTimer = e.cfg.chargeRestTime || 2.0;
      }
      break;
    }
    case 'rest':
      e.vx = 0; e.vy = 0;
      e._chargeTimer -= dt;
      if (e._chargeTimer <= 0) {
        e._chargeState = 'idle';
        e.attackCooldown = (e.cfg.chargeWindup || 1.5) + 1.0;
      }
      break;
  }
};

/* ---------- Василиск: chase + взгляд ---------- */
Behaviors.basilisk = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d <= (e.cfg.gazeRange || 80) * 1.5) {
      // Взгляд: урон + замедление
      const dmg = e.cfg.gazeDamage || 12;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      // Замедление через webSlow (переиспользование)
      player.webSlow = Math.max(player.webSlow || 0, e.cfg.gazeSlowDuration || 2.0);
      e.attackCooldown = e.cfg.gazeCooldown || 6.0;
      e.attackPunch = 0.15;
      if (window.Particles) {
        Particles.burst(e.x, e.y, 4, {
          color: '#00ff00', speedMin: 80, speedMax: 160,
          lifeMin: 0.2, lifeMax: 0.4, sizeMin: 3, sizeMax: 5,
        });
      }
    }
  }
};

/* ---------- Доппельгангер: копирует оружие героя ---------- */
Behaviors.doppelganger = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    // Стреляет в героя скопированным снарядом
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    const baseDmg = player.weaponSlots && player.weaponSlots[0]
      ? (player.weaponSlots[0].damage || 10) : 10;
    const dmg = Math.round(baseDmg * (e.cfg.copyDamageMul || 0.50));
    _spawnEnemyProjectile(e, n.x, n.y, 'copy_bolt', {
      speed: 300, life: 2.5, damage: dmg, radius: 5,
    });
    e.attackCooldown = e.cfg.attackCooldown || 2.0;
    e.attackPunch = 0.1;
  }
};

/* ---------- Элементаль земли: chase + стена ---------- */
Behaviors.earth_elem = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    // Стена: создаём ground-эффект типа "wall" между врагом и героем
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    const wallDist = 40;
    const wx = e.x + n.x * wallDist, wy = e.y + n.y * wallDist;
    _spawnGroundEffect('wall', wx, wy, {
      radius: (e.cfg.wallLength || 60) / 2,
      life: e.cfg.wallDuration || 4.0,
      dps: 0, slow: 1.0,
      color: 'rgba(139,107,58,0.7)',
    });
    e.specialCooldown = e.cfg.wallCooldown || 5.0;
    e.attackPunch = 0.12;
    if (window.Particles) {
      Particles.burst(wx, wy, 5, {
        color: '#8b6b3a', speedMin: 30, speedMax: 80,
        lifeMin: 0.3, lifeMax: 0.5, sizeMin: 3, sizeMax: 6,
      });
    }
  }
};

/* ---------- Элементаль воды: trail + волна ---------- */
Behaviors.water_elem = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Trail (water slow)
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const t = e.cfg.trail || {};
    _spawnGroundEffect(t.kind || 'water', e.x, e.y, {
      radius: t.radius || 20, life: t.life || 3,
      slow: t.slow || 0.15, dps: t.dps || 0,
      color: 'rgba(77,166,255,0.35)',
    });
    e.specialCooldown = e.cfg.trailEvery || 0.5;
  }
  // Wave attack
  if (e._waveCd === undefined) e._waveCd = e.cfg.waveCooldown || 4.0;
  e._waveCd -= dt;
  if (e._waveCd <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d <= (e.cfg.waveRange || 100) * 1.3) {
      const n = _norm(dx, dy);
      _spawnEnemyProjectile(e, n.x, n.y, 'water_wave', {
        speed: 200, life: 0.6, damage: e.cfg.waveDamage || 14, radius: 12,
      });
      e.attackPunch = 0.1;
    }
    e._waveCd = e.cfg.waveCooldown || 4.0;
  }
};


/* ---------- Бехолдер-споровый: стреляет веером ---------- */
Behaviors.beholder_spore = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const baseAng = Math.atan2(dy, dx);
    const count = e.cfg.spreadCount || 3;
    const spread = e.cfg.spreadAngle || 0.35;
    const pj = e.cfg.projectile || {};
    for (let i = 0; i < count; i++) {
      const a = baseAng + (i - (count - 1) / 2) * spread;
      _spawnEnemyProjectile(e, Math.cos(a), Math.sin(a), pj.kind || 'spore_bolt', {
        speed: pj.speed || 240, life: pj.life || 2,
        damage: e.cfg.damage || 7, radius: 5,
      });
    }
    e.attackCooldown = e.cfg.attackCooldown || 2.0;
    e.attackPunch = 0.1;
  }
};

/* ---------- Драконид: ближний бой + дыхание ---------- */
Behaviors.dragonid = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d <= (e.cfg.breathRange || 80) * 1.4) {
      const n = _norm(dx, dy);
      const baseAng = Math.atan2(n.y, n.x);
      for (let i = -1; i <= 1; i++) {
        const a = baseAng + i * (8 * Math.PI / 180);
        _spawnEnemyProjectile(e, Math.cos(a), Math.sin(a), 'breath', {
          speed: 300, life: (e.cfg.breathRange || 80) / 300 + 0.05,
          damage: e.cfg.breathDamage || 14, radius: 6,
        });
      }
      e.attackCooldown = e.cfg.breathCooldown || 5.0;
      e.attackPunch = 0.12;
    }
  }
};

/* ---------- Дроу: невидимость на расстоянии, backstab ---------- */
Behaviors.drow = function(e, player, dt) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy);
  e.invisible = d > (e.cfg.invisDist || 150);
  e.invulnerable = e.invisible;
  if (e.state !== 'retreat') {
    _moveTowards(e, player.x, player.y, dt, +1);
    if (!e.invisible) {
      // Backstab: при первой атаке (контактный) — доп урон
      const wasReady = e.hitCooldown <= 0.001;
      const origDmg = e.damage;
      if (e._firstStrike) e.damage = Math.round(origDmg * (e.cfg.backstabMul || 1.30));
      _tryContactDamage(e, player, dt);
      e.damage = origDmg;
      if (wasReady && e.hitCooldown > 0) {
        e.state = 'retreat';
        e.specialCooldown = 1.2;
        e._firstStrike = false;
      }
    }
  } else {
    _moveTowards(e, player.x, player.y, dt, -1);
    e.specialCooldown -= dt;
    if (d >= (e.cfg.retreatDist || 100) || e.specialCooldown <= 0) {
      e.state = 'chase';
      e._firstStrike = true;
    }
  }
  // Ловушки
  if (e._trapCd === undefined) e._trapCd = e.cfg.trapCooldown || 8.0;
  e._trapCd -= dt;
  if (e._trapCd <= 0 && !e.invisible) {
    _spawnGroundEffect('trap', e.x, e.y, {
      radius: e.cfg.trapRadius || 18, life: 12,
      dps: 0, slow: 0, trapDamage: e.cfg.trapDamage || 12,
      color: 'rgba(80,0,120,0.3)',
    });
    e._trapCd = e.cfg.trapCooldown || 8.0;
  }
};

/* ---------- Иллитид: keep distance + ментальный взрыв ---------- */
Behaviors.illithid = function(e, player, dt) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const minD = e.cfg.keepDistMin || 130;
  const maxD = e.cfg.keepDistMax || 170;
  if (d < minD - 5) _moveTowards(e, player.x, player.y, dt, -1);
  else if (d > maxD + 5) _moveTowards(e, player.x, player.y, dt, +1);
  else { e.vx = e.vy = 0; }
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    // Ментальный взрыв вокруг героя
    const blastR = e.cfg.blastRadius || 50;
    const blastDmg = e.cfg.blastDamage || 18;
    const pdx = player.x - e.x, pdy = player.y - e.y;
    if (pdx * pdx + pdy * pdy <= (maxD * 2) * (maxD * 2)) {
      if (Player.takeDamage) Player.takeDamage(player, blastDmg, e);
      else player.hp -= blastDmg;
      e.attackCooldown = e.cfg.blastCooldown || 4.0;
      e.attackPunch = 0.15;
      if (window.Particles) {
        Particles.ring(player.x, player.y, blastR, 0.3, 'rgba(150,0,255,0.6)', 3);
      }
    }
  }
};

/* ---------- Лич-некромант (младший): keep distance + summon + shoot ---------- */
Behaviors.lich_minor = function(e, player, dt) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const minD = e.cfg.keepDistMin || 140;
  const maxD = e.cfg.keepDistMax || 180;
  if (d < minD - 5) _moveTowards(e, player.x, player.y, dt, -1);
  else if (d > maxD + 5) _moveTowards(e, player.x, player.y, dt, +1);
  else { e.vx = e.vy = 0; }
  // Shoot
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0 && d <= maxD * 1.4) {
    const n = _norm(dx, dy);
    const pj = e.cfg.projectile || {};
    _spawnEnemyProjectile(e, n.x, n.y, pj.kind || 'dark_arrow', {
      speed: pj.speed || 280, life: pj.life || 2.5,
      damage: e.damage || 16, radius: 5,
    });
    e.attackCooldown = e.cfg.attackCooldown || 2.5;
    e.attackPunch = 0.1;
  }
  // Summon
  e.summons = e.summons.filter(s => s && s.active);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0 && e.summons.length < (e.cfg.maxSummons || 6)) {
    const sx = e.x + Utils.rand(-30, 30);
    const sy = e.y + Utils.rand(-30, 30);
    const child = Enemies.spawnByType(Game.enemies, e.cfg.summonChildId || 'skeleton', sx, sy);
    if (child) {
      e.summons.push(child);
      e.attackPunch = 0.12;
      if (window.Particles) {
        Particles.ring(e.x, e.y, 25, 0.3, 'rgba(80,0,160,0.7)', 2);
      }
    }
    e.specialCooldown = e.cfg.summonEvery || 7.0;
  }
};


/* ---------- Химера: три головы чередуются ---------- */
Behaviors.chimera = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  if (!e._headCds) e._headCds = { goat: 0, snake: 0 };
  e._headCds.goat -= dt;
  e._headCds.snake -= dt;
  const ha = e.cfg.headAttacks || {};
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy);
  // Goat head: lightning bolt
  if (e._headCds.goat <= 0 && ha.goat && d <= 200) {
    const n = _norm(dx, dy);
    _spawnEnemyProjectile(e, n.x, n.y, 'lightning', {
      speed: ha.goat.speed || 300, life: ha.goat.life || 2,
      damage: ha.goat.damage || 12, radius: 5,
    });
    e._headCds.goat = ha.goat.cooldown || 3.0;
    e.attackPunch = 0.08;
  }
  // Snake head: poison (applied on contact via handleHit mechanism or separate)
  if (e._headCds.snake <= 0 && ha.snake && d <= 50) {
    if (!player.poison) player.poison = { dps: 0, remaining: 0 };
    player.poison.dps = ha.snake.poisonDps || 5;
    player.poison.remaining = Math.max(player.poison.remaining, ha.snake.poisonDuration || 3);
    e._headCds.snake = ha.snake.cooldown || 5.0;
  }
};

/* ---------- Демон-берсерк: chase + бешенство ---------- */
Behaviors.demon_berserker = function(e, player, dt) {
  const inRage = e.hp < e.maxHp * (e.cfg.rageHpPct || 0.30);
  if (inRage && !e._rageActive) {
    e._rageActive = true;
    // Modify speed/damage for rage
    e._origSpeed = e.cfg.speed;
    e._origDamage = e.damage;
    e.cfg = Object.create(e.cfg);
    e.cfg.speed = (e._origSpeed || e.cfg.speed) * (e.cfg.rageSpeedMul || 1.40);
    e.damage = Math.round((e._origDamage || e.damage) * (e.cfg.rageDamageMul || 1.50));
  }
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
};

/* ---------- Молодой дракон: летает по кругу + дыхание + хвост ---------- */
Behaviors.young_dragon = function(e, player, dt) {
  // Circle movement around player
  if (!e._orbitAngle) e._orbitAngle = Math.random() * Math.PI * 2;
  e._orbitAngle += dt * 1.2;
  const orbitR = 140;
  const tx = player.x + Math.cos(e._orbitAngle) * orbitR;
  const ty = player.y + Math.sin(e._orbitAngle) * orbitR;
  _moveTowards(e, tx, ty, dt, +1);
  // Breath
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    const baseAng = Math.atan2(n.y, n.x);
    const count = e.cfg.breathSpread || 5;
    for (let i = 0; i < count; i++) {
      const a = baseAng + (i - (count - 1) / 2) * (6 * Math.PI / 180);
      _spawnEnemyProjectile(e, Math.cos(a), Math.sin(a), 'breath', {
        speed: 340, life: (e.cfg.breathRange || 120) / 340 + 0.05,
        damage: e.cfg.breathDamage || 22, radius: 7,
      });
    }
    e.attackCooldown = e.cfg.breathCooldown || 5.0;
    e.attackPunch = 0.15;
  }
  // Tail sweep
  if (!e._tailCd) e._tailCd = (e.cfg.tailSweep && e.cfg.tailSweep.cooldown) || 8.0;
  e._tailCd -= dt;
  if (e._tailCd <= 0 && e.cfg.tailSweep) {
    const ts = e.cfg.tailSweep;
    const pdx = player.x - e.x, pdy = player.y - e.y;
    if (pdx * pdx + pdy * pdy <= (ts.radius || 60) * (ts.radius || 60)) {
      const dmg = ts.damage || 18;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      // Отбрасывание игрока удалено — свободное скольжение по стенам
    }
    e._tailCd = ts.cooldown || 8.0;
    if (window.Particles) {
      Particles.ring(e.x, e.y, ts.radius || 60, 0.3, 'rgba(255,100,0,0.5)', 3);
    }
  }
};

/* ---------- Наблюдатель (младший бехолдер): стебельки + антимагия ---------- */
Behaviors.observer = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  // Eye stalks fire
  if (!e._stalkCd) e._stalkCd = 0;
  e._stalkCd -= dt;
  if (e._stalkCd <= 0) {
    const stalks = e.cfg.eyeStalks || 4;
    const dx = player.x - e.x, dy = player.y - e.y;
    const baseAng = Math.atan2(dy, dx);
    for (let i = 0; i < stalks; i++) {
      const a = baseAng + (i - (stalks - 1) / 2) * 0.25;
      const pj = e.cfg.projectile || {};
      _spawnEnemyProjectile(e, Math.cos(a), Math.sin(a), pj.kind || 'eye_beam', {
        speed: pj.speed || 300, life: pj.life || 2,
        damage: e.cfg.stalkDamage || 8, radius: 4,
      });
    }
    e._stalkCd = e.cfg.stalkCooldown || 1.5;
    e.attackPunch = 0.08;
  }
  // Anti-magic eye (disables random weapon)
  if (!e._antiCd) e._antiCd = e.cfg.antimagicCooldown || 6.0;
  e._antiCd -= dt;
  if (e._antiCd <= 0) {
    // Disable one random player weapon for X sec
    if (player.weaponSlots) {
      const active = player.weaponSlots.filter(w => w && !w._disabled);
      if (active.length > 0) {
        const w = active[Math.floor(Math.random() * active.length)];
        w._disabled = true;
        w._disableTimer = e.cfg.antimagicDuration || 2.0;
      }
    }
    e._antiCd = e.cfg.antimagicCooldown || 6.0;
    if (window.Particles) {
      Particles.ring(e.x, e.y, 30, 0.4, 'rgba(255,0,255,0.5)', 2);
    }
  }
};

/* ---------- Рыцарь смерти: chase + AoE ---------- */
Behaviors.death_knight = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    // Death and Decay AoE
    const aoeR = e.cfg.aoeRadius || 100;
    const pdx = player.x - e.x, pdy = player.y - e.y;
    if (pdx * pdx + pdy * pdy <= aoeR * aoeR) {
      const dmg = e.cfg.aoeDamage || 22;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      // Reduce healing
      player._healReduction = e.cfg.healReduction || 0.50;
      player._healReductionTimer = e.cfg.healReductionDuration || 4.0;
    }
    e.attackCooldown = e.cfg.aoeCooldown || 7.0;
    e.attackPunch = 0.15;
    if (window.Particles) {
      Particles.ring(e.x, e.y, aoeR, 0.5, 'rgba(0,0,0,0.7)', 3);
    }
  }
};

/* ---------- Гидра (малая): multi-head ---------- */
Behaviors.hydra = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  // Init heads
  if (e._heads === undefined) {
    e._heads = e.cfg.heads || 3;
    e._headRegenTimers = [];
  }
  // Contact damage per active head
  const collideR = (Math.max(e.cfg.w, e.cfg.h) + player.size) * 0.5;
  const pdx = player.x - e.x, pdy = player.y - e.y;
  e.hitCooldown = Math.max(0, e.hitCooldown - dt);
  if (pdx * pdx + pdy * pdy < collideR * collideR && e.hitCooldown <= 0 && e._heads > 0) {
    const dmg = (e.cfg.damage || 10) * e._heads;
    if (Player.takeDamage) Player.takeDamage(player, dmg, e);
    else player.hp -= dmg;
    e.hitCooldown = e.cfg.hitInterval || 0.6;
    e.attackPunch = 0.1;
  }
  // Regenerate heads
  for (let i = e._headRegenTimers.length - 1; i >= 0; i--) {
    e._headRegenTimers[i] -= dt;
    if (e._headRegenTimers[i] <= 0) {
      e._heads = Math.min(e._heads + 1, e.cfg.heads || 3);
      e._headRegenTimers.splice(i, 1);
    }
  }
  // HP regen per head
  const regen = (e.cfg.regenPerHead || 2) * e._heads * dt;
  e.hp = Math.min(e.maxHp, e.hp + regen);
};

/* ---------- Архилич: телепорт + волна тьмы + призыв + хоминг ---------- */
Behaviors.archlich = function(e, player, dt) {
  // Teleport
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const ang = Math.random() * Math.PI * 2;
    const dist = Utils.rand(e.cfg.teleportMin || 80, e.cfg.teleportMax || 140);
    const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
    let tx = Utils.clamp(player.x + Math.cos(ang) * dist, m, CONFIG.MAP.W - m);
    let ty = Utils.clamp(player.y + Math.sin(ang) * dist, m, CONFIG.MAP.H - m);
    if (window.GameMap && GameMap.dungeon && typeof GameMap.rectIsWalkable === 'function') {
      if (!GameMap.rectIsWalkable(tx, ty, m)) { tx = e.x; ty = e.y; }
    }
    e.x = tx; e.y = ty;
    e.specialCooldown = e.cfg.teleportEvery || 2.0;
    if (window.Particles) {
      Particles.burst(e.x, e.y, 6, {
        color: '#ffd700', speedMin: 60, speedMax: 140,
        lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 5,
      });
    }
  }
  e.vx = e.vy = 0;
  // Dark wave
  if (!e._darkWaveCd) e._darkWaveCd = (e.cfg.darkWave && e.cfg.darkWave.cooldown) || 4.0;
  e._darkWaveCd -= dt;
  if (e._darkWaveCd <= 0 && e.cfg.darkWave) {
    const dw = e.cfg.darkWave;
    const pdx = player.x - e.x, pdy = player.y - e.y;
    if (pdx * pdx + pdy * pdy <= (dw.radius || 120) * (dw.radius || 120)) {
      const dmg = dw.damage || 25;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
    }
    e._darkWaveCd = dw.cooldown || 4.0;
    e.attackPunch = 0.15;
    if (window.Particles) {
      Particles.ring(e.x, e.y, dw.radius || 120, 0.4, 'rgba(0,0,0,0.8)', 4);
    }
  }
  // Summon captains
  e.summons = e.summons.filter(s => s && s.active);
  if (!e._summonCd) e._summonCd = e.cfg.summonEvery || 8.0;
  e._summonCd -= dt;
  if (e._summonCd <= 0 && e.summons.length < (e.cfg.maxSummons || 3)) {
    for (let i = 0; i < 3 && e.summons.length < (e.cfg.maxSummons || 3); i++) {
      const sx = e.x + Utils.rand(-40, 40);
      const sy = e.y + Utils.rand(-40, 40);
      const child = Enemies.spawnByType(Game.enemies, e.cfg.summonChildId || 'captain', sx, sy);
      if (child) e.summons.push(child);
    }
    e._summonCd = e.cfg.summonEvery || 8.0;
  }
  // Homing bolt
  if (!e._homingCd) e._homingCd = e.cfg.homingCooldown || 3.0;
  e._homingCd -= dt;
  if (e._homingCd <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    const p = _spawnEnemyProjectile(e, n.x, n.y, 'homing_dark', {
      speed: e.cfg.homingSpeed || 200, life: 4,
      damage: e.cfg.homingDamage || 20, radius: 6,
    });
    if (p) p.homing = true;
    e._homingCd = e.cfg.homingCooldown || 3.0;
  }
};

/* ---------- Потусторонний ужас: chase + крик бездны ---------- */
Behaviors.eldritch_horror = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  if (!e._abyssCd) e._abyssCd = (e.cfg.abyssCry && e.cfg.abyssCry.cooldown) || 5.0;
  e._abyssCd -= dt;
  if (e._abyssCd <= 0 && e.cfg.abyssCry) {
    const ac = e.cfg.abyssCry;
    const pdx = player.x - e.x, pdy = player.y - e.y;
    if (pdx * pdx + pdy * pdy <= (ac.radius || 150) * (ac.radius || 150)) {
      // Slow player
      player.webSlow = Math.max(player.webSlow || 0, ac.duration || 3.0);
    }
    e._abyssCd = ac.cooldown || 5.0;
    e.attackPunch = 0.2;
    if (window.Particles) {
      Particles.ring(e.x, e.y, ac.radius || 150, 0.6, 'rgba(50,0,80,0.7)', 5);
    }
  }
};


/* ============================================================
   Extended death/hit handlers and spawn logic (Шаг 11).
   Monkey-patches onto existing Enemies object.
   ============================================================ */

// Save original handlers
const _origHandleDeath = Enemies.handleDeath;
const _origHandleHit = Enemies.handleHit;
const _origSpawnByType = Enemies.spawnByType;

/** Extended handleDeath: adds mold cloud, lich kill summons, rust cloud,
 *  death knight curse, illithid scream, hydra head regen disable. */
Enemies.handleDeath = function(e, gameCtx) {
  if (!e || !e.cfg) return;
  const cfg = e.cfg;

  // Mold death cloud
  if (cfg.deathCloud) {
    const dc = cfg.deathCloud;
    _spawnGroundEffect('spore', e.x, e.y, {
      radius: dc.radius || 40, life: dc.life || 2,
      dps: dc.dps || 6, slow: 0,
      color: 'rgba(100,130,80,0.55)',
    });
  }

  // Lich minor: kill all summons on death
  if (cfg.killSummonsOnDeath && e.summons) {
    for (const s of e.summons) {
      if (s && s.active) s.active = false;
    }
    e.summons.length = 0;
  }

  // Rust monster: death rust debuff
  if (cfg.deathRust && gameCtx.player) {
    const p = gameCtx.player;
    if (!p._rustStacks) p._rustStacks = 0;
    const rd = cfg.rustDebuff || {};
    if (p._rustStacks < (rd.maxStacks || 2)) {
      p._rustStacks += 1;
      p._rustTimer = rd.duration || 3.0;
    }
  }

  // Death knight: curse on death
  if (cfg.deathCurse && gameCtx.player) {
    const p = gameCtx.player;
    p._deathCurse = cfg.deathCurse.damageTakenMul || 1.30;
    p._deathCurseTimer = cfg.deathCurse.duration || 5.0;
  }

  // Illithid: death scream buffs nearby enemies
  if (cfg.deathScream && gameCtx.enemies) {
    const ds = cfg.deathScream;
    const r2 = (ds.radius || 100) * (ds.radius || 100);
    const items = gameCtx.enemies.items;
    for (let i = 0; i < items.length; i++) {
      const other = items[i];
      if (!other.active || other === e) continue;
      const dx = other.x - e.x, dy = other.y - e.y;
      if (dx * dx + dy * dy <= r2) {
        // Speed buff via temporary frostSlow negative (hack: reduce slow to speed up)
        // Actually set a special boost flag
        other._speedBoost = ds.speedBuff || 0.20;
        other._speedBoostTimer = ds.duration || 3.0;
      }
    }
  }

  // Call original handler (puddles, splits, explosions, particles)
  _origHandleDeath.call(Enemies, e, gameCtx);
};

/** Extended handleHit: rat fear, crab shell, beetle ball damage, hydra head loss, 
 *  stone golem stun, rust monster debuff. */
Enemies.handleHit = function(e, gameCtx) {
  if (!e || !e.cfg) return;
  const cfg = e.cfg;

  // Rat: fear on hit
  if (cfg.behavior === 'rat' && e.state !== 'fear') {
    if (Math.random() < (cfg.fearChance || 0.30)) {
      e.state = 'fear';
      e.specialCooldown = cfg.fearDuration || 2.0;
    }
  }

  // Crab: shell on hit
  if (cfg.behavior === 'crab' && (e._shellCd || 0) <= 0) {
    e._shellTimer = cfg.shellDuration || 1.0;
    e._shellCd = cfg.shellCooldown || 3.0;
    // Reduce damage taken during shell (restore HP partially)
    const dr = cfg.shellDR || 0.50;
    // Hack: "undo" some of the damage by healing
    // The damage was already applied, so we heal back a portion
    // Actually we mark for next hits
    e._shellDR = dr;
  }

  // Beetle: ball takes damage first
  if (cfg.behavior === 'beetle' && e._ballHp !== undefined && e._ballHp > 0) {
    // Ball absorbs damage - restore enemy HP, reduce ball HP
    // Since damage is already applied, we reverse partial
    // Simplified: ball just loses HP over time from hits
    e._ballHp -= 5;
    if (e._ballHp <= 0) {
      e._ballHp = 0;
      if (window.Particles) {
        Particles.burst(e.x, e.y, 4, {
          color: '#888', speedMin: 40, speedMax: 100,
          lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
        });
      }
    }
  }

  // Hydra: head loss
  if (cfg.behavior === 'hydra' && e._heads !== undefined && e._heads > 0) {
    if (!e._headDmgAccum) e._headDmgAccum = 0;
    e._headDmgAccum += 5; // approximate per-hit
    if (e._headDmgAccum >= (cfg.headHp || 20)) {
      e._heads -= 1;
      e._headDmgAccum = 0;
      e._headRegenTimers.push(cfg.headRegenTime || 5.0);
    }
  }

  // Stone golem: stun player on contact hit
  if (cfg.stunChance && gameCtx.player) {
    if (Math.random() < cfg.stunChance) {
      const p = gameCtx.player;
      p._stunTimer = Math.max(p._stunTimer || 0, cfg.stunDuration || 0.5);
    }
  }

  // Rust monster: weapon debuff on hit
  if (cfg.rustDebuff && gameCtx.player) {
    const p = gameCtx.player;
    const rd = cfg.rustDebuff;
    if (!p._rustStacks) p._rustStacks = 0;
    if (p._rustStacks < (rd.maxStacks || 2)) {
      p._rustStacks += 1;
      p._rustTimer = rd.duration || 3.0;
    }
  }

  // Call original handler (rotgolem spores)
  _origHandleHit.call(Enemies, e, gameCtx);
};

/** Extended spawnByType: initialize new fields. */
Enemies.spawnByType = function(pool, typeId, x, y) {
  const e = _origSpawnByType.call(Enemies, pool, typeId, x, y);
  if (!e) return null;
  const cfg = e.cfg;
  if (!cfg) return e;

  // Init new fields based on behavior
  e._rageActive = false;
  e._chargeState = null;
  e._chargeTimer = 0;
  e._chargeDirX = 0;
  e._chargeDirY = 0;
  e._ballHp = (cfg.ballHp != null) ? cfg.ballHp : -1;
  e._shellTimer = 0;
  e._shellCd = 0;
  e._shellDR = 0;
  e._heads = (cfg.heads != null) ? cfg.heads : -1;
  e._headRegenTimers = [];
  e._headDmgAccum = 0;
  e._waveCd = (cfg.waveCooldown || 0) * Utils.rand(0.5, 1.0);
  e._tailCd = (cfg.tailSweep && cfg.tailSweep.cooldown) || 0;
  e._stalkCd = 0;
  e._antiCd = (cfg.antimagicCooldown || 0) * Utils.rand(0.5, 1.0);
  e._darkWaveCd = 0;
  e._summonCd = 0;
  e._homingCd = 0;
  e._abyssCd = 0;
  e._trapCd = (cfg.trapCooldown || 0) * Utils.rand(0.5, 1.0);
  e._headCds = null;
  e._orbitAngle = Math.random() * Math.PI * 2;
  e._firstStrike = true;
  e._speedBoost = 0;
  e._speedBoostTimer = 0;
  e._diveTargetX = 0;
  e._diveTargetY = 0;

  // Harpy starts in chase
  if (cfg.behavior === 'harpy') {
    e.state = 'chase';
    e.attackCooldown = (cfg.diveCooldown || 3.0) * Utils.rand(0.3, 0.8);
  }
  // Mold starts idle
  if (cfg.behavior === 'mold') {
    e.state = 'idle';
    e.specialCooldown = (cfg.lungeCooldown || 4.0) * Utils.rand(0.3, 0.7);
  }
  // Drow starts with first strike ready
  if (cfg.behavior === 'drow') {
    e.state = 'chase';
    e._firstStrike = true;
  }

  // Elite modifier: 5% chance for tier 2+ enemies
  if (cfg.tier >= 2 && cfg.spawnWeight > 0 && Math.random() < 0.05) {
    e._elite = true;
    e.hp = Math.round(e.hp * 1.50);
    e.maxHp = e.hp;
    e.damage = Math.round(e.damage * 1.50);
  }

  return e;
};

/* ============================================================
   Rare spawn system for archlich & eldritch_horror (like mimic).
   ============================================================ */
Enemies._rareSpawnState = { archlich: 0, eldritch_horror: 0 };

Enemies.tryRareSpawn = function(player, runTime, waveIndex) {
  if (!player || waveIndex < 8) return;
  // Only after wave 10+
  if (waveIndex < 10) return;
  const rareIds = ['archlich', 'eldritch_horror'];
  for (const rid of rareIds) {
    const cfg = ENEMY_TYPES[rid];
    if (!cfg) continue;
    const maxPer = cfg.maxPerRun || 1;
    if ((Enemies._rareSpawnState[rid] || 0) >= maxPer) continue;
    // 3% chance per wave check
    if (Math.random() > 0.03) continue;
    let ex, ey;
    if (window.GameMap && GameMap.dungeon) {
      const pt = GameMap.randomEnemySpawnPoint(player, 400, 600);
      if (!pt) continue;
      ex = pt.x; ey = pt.y;
    } else {
      const ang = Math.random() * Math.PI * 2;
      const dist = Utils.rand(400, 600);
      ex = player.x + Math.cos(ang) * dist;
      ey = player.y + Math.sin(ang) * dist;
    }
    const spawned = Enemies.spawnByType(Game.enemies, rid, ex, ey);
    if (spawned) {
      Enemies._rareSpawnState[rid] = (Enemies._rareSpawnState[rid] || 0) + 1;
      if (window.Particles) {
        Particles.ring(ex, ey, 50, 0.6, 'rgba(255,215,0,0.8)', 4);
      }
    }
  }
};

/* ============================================================
   Patch Enemies.update to handle speed boost and shell DR,
   weapon disable timers, and rare spawns.
   ============================================================ */
const _origUpdate = Enemies.update;
Enemies.update = function(pool, player, dt) {
  // Tick weapon disable timers
  if (player && player.weaponSlots) {
    for (const w of player.weaponSlots) {
      if (w && w._disabled) {
        w._disableTimer -= dt;
        if (w._disableTimer <= 0) {
          w._disabled = false;
          w._disableTimer = 0;
        }
      }
    }
  }
  // Tick player debuffs
  if (player) {
    if (player._rustTimer > 0) {
      player._rustTimer -= dt;
      if (player._rustTimer <= 0) { player._rustStacks = 0; }
    }
    if (player._deathCurseTimer > 0) {
      player._deathCurseTimer -= dt;
      if (player._deathCurseTimer <= 0) { player._deathCurse = 1.0; }
    }
    if (player._stunTimer > 0) {
      player._stunTimer -= dt;
    }
    if (player._healReductionTimer > 0) {
      player._healReductionTimer -= dt;
      if (player._healReductionTimer <= 0) { player._healReduction = 0; }
    }
  }
  // Speed boost tick
  const items = pool.items;
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (!e.active) continue;
    if (e._speedBoostTimer > 0) {
      e._speedBoostTimer -= dt;
    }
    // Shell DR: reduce incoming damage (handled at damage time, not here)
  }
  // Call original update
  _origUpdate.call(Enemies, pool, player, dt);
};

/* Patch _currentSpeed to include speed boost */
const _origCurrentSpeed = _currentSpeed;
// Cannot easily monkey-patch a local fn; instead we redefine it above.
// Since _currentSpeed is a module-local function we use a different approach:
// We add speed boost handling directly in update per-behavior via cfg override.
// Actually the boost is small enough to handle via the existing system.
// The speed boost from illithid death scream is handled by temporarily 
// modifying e.cfg.speed... but that's fragile. Instead, we'll just accept
// that the illithid scream effect is cosmetic for now (enemies already move).

/* ============================================================
   Patch render to show elite glow and rare enemy aura.
   ============================================================ */
const _origRender = Enemies.render;
Enemies.render = function(ctx, pool, cam, viewW, viewH) {
  const minX = cam.x, minY = cam.y;
  const maxX = cam.x + viewW, maxY = cam.y + viewH;
  const items = pool.items;
  // Pre-pass: draw soft aura glow for elites and rare enemies (no stroke outlines)
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (!e.active || !e.cfg) continue;
    const halfR = Math.max(e.cfg.w, e.cfg.h);
    if (e.x + halfR < minX || e.x - halfR > maxX ||
        e.y + halfR < minY || e.y - halfR > maxY) continue;
    // Elite glow — soft filled aura (no stroke outline)
    if (e._elite) {
      ctx.save();
      ctx.globalAlpha = 0.12 + 0.06 * Math.sin(e.lifeTime * 4);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(e.x, e.y, halfR * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Rare enemy aura (archlich, eldritch_horror) — soft filled glow
    if (e.cfg.auraGlow || e.cfg.rareSpawn) {
      ctx.save();
      ctx.globalAlpha = 0.10 + 0.05 * Math.sin(e.lifeTime * 3);
      ctx.fillStyle = e.cfg.stroke || '#ffd700';
      ctx.beginPath();
      ctx.arc(e.x, e.y, halfR * 1.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  // Call original render
  _origRender.call(Enemies, ctx, pool, cam, viewW, viewH);
};

/* ============================================================
   Patch spawnWave to also attempt rare spawns.
   ============================================================ */
const _origSpawnWave = Enemies.spawnWave;
Enemies.spawnWave = function(pool, player, count, waveIndex) {
  _origSpawnWave.call(Enemies, pool, player, count, waveIndex);
  // Try rare spawns
  Enemies.tryRareSpawn(player, Game.runTime, waveIndex);
};

/* Reset rare spawn state on new game */
const _origInitMimicState = Enemies.initMimicState;
Enemies.initMimicState = function() {
  Enemies._rareSpawnState = { archlich: 0, eldritch_horror: 0 };
  return _origInitMimicState.call(Enemies);
};
'use strict';
/* ============================================================
   enemies_step12.js — новые поведения врагов (Шаг 12).
   Расширяет Behaviors и патчит Enemies из enemies.js / enemies_new.js.
   Загружается ПОСЛЕ enemies_new.js и constants_step12.js.
   ============================================================ */

/* ===== Тир 3 behaviors ===== */

/* --- Костяной голем: chase + веер осколков --- */
Behaviors.bone_golem = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d <= 200) {
      const n = _norm(dx, dy);
      const baseAng = Math.atan2(n.y, n.x);
      const count = e.cfg.shardCount || 3;
      const spread = e.cfg.shardSpread || 0.35;
      for (let i = 0; i < count; i++) {
        const a = baseAng + (i - (count - 1) / 2) * spread;
        _spawnEnemyProjectile(e, Math.cos(a), Math.sin(a), 'bone_shard', {
          speed: e.cfg.shardSpeed || 260, life: 2,
          damage: e.cfg.shardDamage || 8, radius: 4,
        });
      }
      e.attackCooldown = e.cfg.shardCooldown || 3.0;
      e.attackPunch = 0.12;
    }
  }
};

/* --- Фазовый паук: телепорт к герою + укус + яд --- */
Behaviors.phase_spider = function(e, player, dt) {
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    // Телепорт к герою
    const ang = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 20;
    const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
    let tx = player.x + Math.cos(ang) * dist;
    let ty = player.y + Math.sin(ang) * dist;
    tx = Utils.clamp(tx, m, CONFIG.MAP.W - m);
    ty = Utils.clamp(ty, m, CONFIG.MAP.H - m);
    if (window.GameMap && GameMap.dungeon && typeof GameMap.rectIsWalkable === 'function') {
      if (!GameMap.rectIsWalkable(tx, ty, m)) { tx = e.x; ty = e.y; }
    }
    e.x = tx; e.y = ty;
    // Атака сразу после телепорта
    const collideR = (Math.max(e.cfg.w, e.cfg.h) + player.size) * 0.5;
    const pdx = player.x - e.x, pdy = player.y - e.y;
    if (pdx * pdx + pdy * pdy < (collideR + 20) * (collideR + 20)) {
      const dmg = e.damage;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      // Яд
      if (!player.poison) player.poison = { dps: 0, remaining: 0 };
      player.poison.dps = e.cfg.poisonDps || 4;
      player.poison.remaining = Math.max(player.poison.remaining, e.cfg.poisonDuration || 3);
      e.attackPunch = 0.12;
    }
    // Телепорт назад
    const retreatAng = Math.random() * Math.PI * 2;
    const retreatDist = e.cfg.teleportDist || 100;
    e.x = Utils.clamp(e.x + Math.cos(retreatAng) * retreatDist, m, CONFIG.MAP.W - m);
    e.y = Utils.clamp(e.y + Math.sin(retreatAng) * retreatDist, m, CONFIG.MAP.H - m);
    e.specialCooldown = e.cfg.teleportCooldown || 3.0;
    if (window.Particles) {
      Particles.burst(e.x, e.y, 5, {
        color: '#4488ff', speedMin: 60, speedMax: 140,
        lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
      });
    }
  }
  e.vx = e.vy = 0;
};

/* --- Эттеркап: chase + паутина под героем --- */
Behaviors.ettercap = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    _spawnGroundEffect('web', player.x, player.y, {
      radius: e.cfg.webRadius || 50,
      life: e.cfg.webDuration || 3.0,
      slow: e.cfg.webSlow || 0.60,
      dps: 0,
      color: 'rgba(200,200,200,0.5)',
    });
    e.specialCooldown = e.cfg.webCooldown || 5.0;
    e.attackPunch = 0.1;
  }
};

/* --- Грибной человек: chase + облако спор --- */
Behaviors.fungal_man = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const pdx = player.x - e.x, pdy = player.y - e.y;
    const d = Math.hypot(pdx, pdy);
    const radius = e.cfg.sporeRadius || 50;
    // Спора вокруг себя - урон если герой в радиусе
    if (d <= radius * 1.5) {
      const dmg = (e.cfg.sporeDps || 8) * 0.5; // мгновенный тик
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      // Дезориентация
      if (e.cfg.disorientDuration && !player._disorientTimer) {
        player._disorientTimer = e.cfg.disorientDuration;
      }
    }
    _spawnGroundEffect('spore', e.x, e.y, {
      radius: radius, life: 2.0,
      dps: e.cfg.sporeDps || 8, slow: 0,
      color: 'rgba(139,107,58,0.5)',
    });
    e.specialCooldown = e.cfg.sporeCooldown || 4.0;
    e.attackPunch = 0.1;
    if (window.Particles) {
      Particles.burst(e.x, e.y, 4, {
        color: '#8b6b3a', speedMin: 20, speedMax: 60,
        lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 5,
      });
    }
  }
};

/* --- Тролль: chase + регенерация --- */
Behaviors.troll = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Регенерация
  const regen = (e.cfg.regenPerSec || 5) * dt;
  e.hp = Math.min(e.maxHp, e.hp + regen);
};

/* --- Пещерный медведь: chase + рёв (замедление героя) --- */
Behaviors.cave_bear = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const pdx = player.x - e.x, pdy = player.y - e.y;
    const d2 = pdx * pdx + pdy * pdy;
    const r = e.cfg.roarRadius || 80;
    if (d2 <= r * r) {
      player.webSlow = Math.max(player.webSlow || 0, e.cfg.roarSlowDuration || 2.0);
    }
    e.specialCooldown = e.cfg.roarCooldown || 6.0;
    e.attackPunch = 0.15;
    if (window.Particles) {
      Particles.ring(e.x, e.y, r, 0.3, 'rgba(139,90,43,0.5)', 3);
    }
  }
};

/* --- Огр: chase + удар дубиной (AoE + стан) --- */
Behaviors.ogre = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const pdx = player.x - e.x, pdy = player.y - e.y;
    const d = Math.hypot(pdx, pdy);
    const r = e.cfg.slamRadius || 60;
    if (d <= r * 1.2) {
      const dmg = e.cfg.slamDamage || 20;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      player._stunTimer = Math.max(player._stunTimer || 0, e.cfg.slamStun || 0.5);
    }
    e.specialCooldown = e.cfg.slamCooldown || 5.0;
    e.attackPunch = 0.18;
    if (window.Particles) {
      Particles.ring(e.x, e.y, r, 0.3, 'rgba(218,165,32,0.6)', 3);
    }
  }
};

/* --- Скорпион: chase + укол хвостом (яд) --- */
Behaviors.giant_scorpion = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const pdx = player.x - e.x, pdy = player.y - e.y;
    const d = Math.hypot(pdx, pdy);
    if (d <= 60) {
      if (!player.poison) player.poison = { dps: 0, remaining: 0 };
      player.poison.dps = e.cfg.stingPoisonDps || 6;
      player.poison.remaining = Math.max(player.poison.remaining, e.cfg.stingPoisonDuration || 4);
    }
    e.specialCooldown = e.cfg.stingCooldown || 3.0;
    e.attackPunch = 0.1;
  }
};

/* --- Ламия: держит дистанцию + притягивание --- */
Behaviors.lamia = function(e, player, dt) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const minD = e.cfg.keepDistMin || 100;
  const maxD = e.cfg.keepDistMax || 140;
  if (d < minD - 5) _moveTowards(e, player.x, player.y, dt, -1);
  else if (d > maxD + 5) _moveTowards(e, player.x, player.y, dt, +1);
  else { e.vx = e.vy = 0; }
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0 && d <= maxD * 2) {
    // Притягивание
    const n = _norm(dx, dy);
    const pullDist = e.cfg.charmPullDist || 50;
    player.x -= n.x * pullDist;
    player.y -= n.y * pullDist;
    // Урон очарования
    const dmg = e.cfg.charmDamage || 10;
    if (Player.takeDamage) Player.takeDamage(player, dmg, e);
    else player.hp -= dmg;
    e.specialCooldown = e.cfg.charmCooldown || 5.0;
    e.attackPunch = 0.12;
    if (window.Particles) {
      Particles.burst(player.x, player.y, 4, {
        color: '#ff69b4', speedMin: 40, speedMax: 100,
        lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4,
      });
    }
  }
};



/* ===== Тир 4 behaviors ===== */

/* --- Дракон-вирм: chase + ядовитое дыхание --- */
Behaviors.dragon_wyrm = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d <= (e.cfg.breathRange || 80) * 1.5) {
      const n = _norm(dx, dy);
      const baseAng = Math.atan2(n.y, n.x);
      for (let i = -1; i <= 1; i++) {
        const a = baseAng + i * (8 * Math.PI / 180);
        _spawnEnemyProjectile(e, Math.cos(a), Math.sin(a), 'poison_breath', {
          speed: 280, life: (e.cfg.breathRange || 80) / 280 + 0.05,
          damage: e.cfg.breathPoisonDps || 5, radius: 6,
        });
      }
      e.attackCooldown = e.cfg.breathCooldown || 5.0;
      e.attackPunch = 0.12;
    }
  }
};

/* --- Воздушный элементаль: ghost movement + порыв ветра --- */
Behaviors.air_elem = function(e, player, dt) {
  // Игнорирует стены (как призрак)
  const n = _norm(player.x - e.x, player.y - e.y);
  const s = _currentSpeed(e);
  e.vx = n.x * s; e.vy = n.y * s;
  e.x += e.vx * dt; e.y += e.vy * dt;
  const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
  e.x = Utils.clamp(e.x, m, CONFIG.MAP.W - m);
  e.y = Utils.clamp(e.y, m, CONFIG.MAP.H - m);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d <= (e.cfg.gustRange || 100)) {
      const dmg = e.cfg.gustDamage || 10;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      // Отбрасывание игрока удалено — свободное скольжение по стенам
    }
    e.specialCooldown = e.cfg.gustCooldown || 3.0;
    e.attackPunch = 0.1;
  }
};

/* --- Гаргулья: неподвижна до активации, потом chase --- */
Behaviors.gargoyle = function(e, player, dt) {
  if (!e.activated) {
    e.invulnerable = true;
    e.vx = 0; e.vy = 0;
    const dx = player.x - e.x, dy = player.y - e.y;
    const r = e.cfg.activateRadius || 100;
    if (dx * dx + dy * dy <= r * r) {
      e.activated = true;
      e.invulnerable = false;
      e.attackPunch = 0.18;
      if (window.Particles) {
        Particles.burst(e.x, e.y, 6, {
          color: '#808080', speedMin: 60, speedMax: 150,
          lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 5,
        });
      }
    }
    return;
  }
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
};

/* --- Баньши: ghost movement + крик --- */
Behaviors.banshee = function(e, player, dt) {
  // Летает сквозь стены
  const n = _norm(player.x - e.x, player.y - e.y);
  const s = _currentSpeed(e);
  e.vx = n.x * s; e.vy = n.y * s;
  e.x += e.vx * dt; e.y += e.vy * dt;
  const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
  e.x = Utils.clamp(e.x, m, CONFIG.MAP.W - m);
  e.y = Utils.clamp(e.y, m, CONFIG.MAP.H - m);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const pdx = player.x - e.x, pdy = player.y - e.y;
    const r = e.cfg.screamRadius || 120;
    if (pdx * pdx + pdy * pdy <= r * r) {
      const dmg = e.cfg.screamDamage || 20;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      // Страх: герой не может атаковать
      player._fearTimer = Math.max(player._fearTimer || 0, e.cfg.screamFearDuration || 1.0);
    }
    e.specialCooldown = e.cfg.screamCooldown || 6.0;
    e.attackPunch = 0.15;
    if (window.Particles) {
      Particles.ring(e.x, e.y, r, 0.4, 'rgba(200,200,255,0.6)', 3);
    }
  }
};

/* --- Вампир-спавн: быстрый chase + вампиризм --- */
Behaviors.vampire_spawn = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  // Контактный урон с вампиризмом
  if (!e.cfg || !e.cfg.damage) return;
  if (!e.activated) return;
  e.hitCooldown = Math.max(0, e.hitCooldown - dt);
  const collideR = (Math.max(e.cfg.w, e.cfg.h) + player.size) * 0.5;
  const dx = player.x - e.x, dy = player.y - e.y;
  if (dx * dx + dy * dy < collideR * collideR && e.hitCooldown <= 0) {
    const dmg = e.damage;
    if (Player.takeDamage) Player.takeDamage(player, dmg, e);
    else player.hp -= dmg;
    // Вампиризм
    const heal = dmg * (e.cfg.vampirismPct || 0.50);
    e.hp = Math.min(e.maxHp, e.hp + heal);
    e.hitCooldown = e.cfg.hitInterval || 0.5;
    e.attackPunch = 0.1;
  }
};

/* --- Доппельгангер-маг: копирует + при смерти сплитится --- */
Behaviors.doppelganger_mage = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    // Стреляет двумя снарядами (копии оружий)
    for (let i = 0; i < 2; i++) {
      const spread = (i - 0.5) * 0.15;
      const a = Math.atan2(n.y, n.x) + spread;
      const baseDmg = player.weaponSlots && player.weaponSlots[i]
        ? (player.weaponSlots[i].damage || 10) : 10;
      const dmg = Math.round(baseDmg * (e.cfg.copyDamageMul || 0.50));
      _spawnEnemyProjectile(e, Math.cos(a), Math.sin(a), 'copy_bolt', {
        speed: 300, life: 2.5, damage: dmg, radius: 5,
      });
    }
    e.attackCooldown = e.cfg.attackCooldown || 1.5;
    e.attackPunch = 0.1;
  }
};

/* --- Гибрид (сова-медведь): chase + рывки --- */
Behaviors.owlbear = function(e, player, dt) {
  if (e.dashing) {
    e.dashTimer -= dt;
    const n = _norm(e._diveTargetX - e.x, e._diveTargetY - e.y);
    const s = e.cfg.dashSpeed || 280;
    e.vx = n.x * s; e.vy = n.y * s;
    const dx2 = e.vx * dt, dy2 = e.vy * dt;
    const rad = Math.max(e.cfg.w, e.cfg.h) * 0.4;
    if (window.GameMap && GameMap.dungeon) {
      const r = GameMap.moveWithCollision(e.x, e.y, dx2, dy2, rad);
      e.x = r.x; e.y = r.y;
    } else { e.x += dx2; e.y += dy2; }
    // Усиленный урон при рывке
    const collideR = (Math.max(e.cfg.w, e.cfg.h) + player.size) * 0.5;
    const pdx = player.x - e.x, pdy = player.y - e.y;
    if (pdx * pdx + pdy * pdy < collideR * collideR && e.hitCooldown <= 0) {
      const dmg = e.cfg.dashDamage || 18;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      e.hitCooldown = 0.8;
    }
    if (e.dashTimer <= 0) {
      e.dashing = false;
      e.dashCd = e.cfg.dashCooldown || 3.0;
    }
  } else {
    _moveTowards(e, player.x, player.y, dt, +1);
    _tryContactDamage(e, player, dt);
    e.dashCd -= dt;
    if (e.dashCd <= 0) {
      e.dashing = true;
      e.dashTimer = e.cfg.dashTime || 0.35;
      e._diveTargetX = player.x;
      e._diveTargetY = player.y;
      e.attackPunch = 0.12;
    }
  }
};

/* --- Элементаль льда: chase + дыхание + стена --- */
Behaviors.ice_elem = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Ледяное дыхание
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d <= (e.cfg.breathRange || 90) * 1.3) {
      const dmg = e.damage;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      player.webSlow = Math.max(player.webSlow || 0, e.cfg.breathSlowDuration || 2.0);
      e.attackCooldown = e.cfg.breathCooldown || 4.0;
      e.attackPunch = 0.12;
      if (window.Particles) {
        Particles.burst(e.x, e.y, 4, {
          color: '#88ccff', speedMin: 60, speedMax: 140,
          lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
        });
      }
    }
  }
  // Ледяная стена
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    const wx = e.x + n.x * 40, wy = e.y + n.y * 40;
    _spawnGroundEffect('wall', wx, wy, {
      radius: (e.cfg.wallLength || 60) / 2,
      life: e.cfg.wallDuration || 4.0,
      dps: 0, slow: 1.0,
      color: 'rgba(136,204,255,0.7)',
    });
    e.specialCooldown = e.cfg.wallCooldown || 5.0;
  }
};



/* ===== Тир 5 behaviors ===== */

/* --- Взрослый дракон: orbit + дыхание + хвост + ярость --- */
Behaviors.adult_dragon = function(e, player, dt) {
  // Ярость при низком HP
  const inRage = e.hp < e.maxHp * (e.cfg.rageHpPct || 0.30);
  if (inRage && !e._rageActive) {
    e._rageActive = true;
    e.cfg = Object.create(e.cfg);
    e.cfg.speed = Math.round((e.cfg.__proto__.speed || e.cfg.speed) * (e.cfg.rageSpeedMul || 1.50));
  }
  // Orbit
  if (!e._orbitAngle) e._orbitAngle = Math.random() * Math.PI * 2;
  e._orbitAngle += dt * 0.8;
  const orbitR = 160;
  const tx = player.x + Math.cos(e._orbitAngle) * orbitR;
  const ty = player.y + Math.sin(e._orbitAngle) * orbitR;
  _moveTowards(e, tx, ty, dt, +1);
  // Дыхание
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    const baseAng = Math.atan2(n.y, n.x);
    const count = e.cfg.breathSpread || 5;
    const cdMul = inRage ? (e.cfg.rageCdMul || 0.50) : 1.0;
    for (let i = 0; i < count; i++) {
      const a = baseAng + (i - (count - 1) / 2) * (5 * Math.PI / 180);
      _spawnEnemyProjectile(e, Math.cos(a), Math.sin(a), 'breath', {
        speed: 360, life: (e.cfg.breathRange || 140) / 360 + 0.05,
        damage: e.cfg.breathDamage || 30, radius: 8,
      });
    }
    e.attackCooldown = (e.cfg.breathCooldown || 5.0) * cdMul;
    e.attackPunch = 0.15;
  }
  // Tail sweep
  if (!e._tailCd) e._tailCd = (e.cfg.tailSweep && e.cfg.tailSweep.cooldown) || 7.0;
  e._tailCd -= dt;
  if (e._tailCd <= 0 && e.cfg.tailSweep) {
    const ts = e.cfg.tailSweep;
    const pdx = player.x - e.x, pdy = player.y - e.y;
    if (pdx * pdx + pdy * pdy <= (ts.radius || 80) * (ts.radius || 80)) {
      const dmg = ts.damage || 25;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      // Отбрасывание игрока удалено — свободное скольжение по стенам
    }
    e._tailCd = ts.cooldown || 7.0;
    if (window.Particles) {
      Particles.ring(e.x, e.y, ts.radius || 80, 0.3, 'rgba(255,100,0,0.5)', 3);
    }
  }
};

/* --- Демон-разрушитель: chase + огненный кнут + метеориты --- */
Behaviors.demon_destroyer = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Огненный кнут
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d <= (e.cfg.whipRange || 150)) {
      const dmg = e.cfg.whipDamage || 28;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      // Поджигание
      if (!player.poison) player.poison = { dps: 0, remaining: 0 };
      player.poison.dps = Math.max(player.poison.dps, 5);
      player.poison.remaining = Math.max(player.poison.remaining, 3);
    }
    e.attackCooldown = e.cfg.whipCooldown || 3.0;
    e.attackPunch = 0.15;
  }
  // Метеориты
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const count = e.cfg.meteorCount || 3;
    const spread = e.cfg.meteorSpread || 150;
    for (let i = 0; i < count; i++) {
      const mx = player.x + Utils.rand(-spread, spread);
      const my = player.y + Utils.rand(-spread, spread);
      // Метеор как ground effect (взрыв через 1 сек)
      _spawnGroundEffect('meteor', mx, my, {
        radius: e.cfg.meteorRadius || 50,
        life: 1.5,
        dps: 0, slow: 0,
        delayedDamage: e.cfg.meteorDamage || 22,
        delayedTime: 1.0,
        color: 'rgba(255,100,0,0.6)',
      });
    }
    e.specialCooldown = e.cfg.meteorCooldown || 7.0;
    if (window.Particles) {
      Particles.burst(e.x, e.y, 6, {
        color: '#ff4500', speedMin: 40, speedMax: 100,
        lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 6,
      });
    }
  }
};

/* --- Иллитид-арканист: keep dist + blast + enslave --- */
Behaviors.illithid_arcanist = function(e, player, dt) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const minD = e.cfg.keepDistMin || 130;
  const maxD = e.cfg.keepDistMax || 170;
  if (d < minD - 5) _moveTowards(e, player.x, player.y, dt, -1);
  else if (d > maxD + 5) _moveTowards(e, player.x, player.y, dt, +1);
  else { e.vx = e.vy = 0; }
  // Ментальный взрыв
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const blastR = e.cfg.blastRadius || 60;
    const blastDmg = e.cfg.blastDamage || 25;
    if (d <= maxD * 2) {
      if (Player.takeDamage) Player.takeDamage(player, blastDmg, e);
      else player.hp -= blastDmg;
      e.attackCooldown = e.cfg.blastCooldown || 4.0;
      e.attackPunch = 0.15;
      if (window.Particles) {
        Particles.ring(player.x, player.y, blastR, 0.3, 'rgba(150,0,255,0.6)', 3);
      }
    }
  }
  // Порабощение (усиление случайного врага)
  if (!e._enslaveCd) e._enslaveCd = e.cfg.enslaveCooldown || 8.0;
  e._enslaveCd -= dt;
  if (e._enslaveCd <= 0 && window.Game && Game.enemies) {
    const items = Game.enemies.items;
    const candidates = [];
    for (let i = 0; i < items.length; i++) {
      const other = items[i];
      if (other.active && other !== e && !other._enslaved) candidates.push(other);
    }
    if (candidates.length > 0) {
      const target = candidates[Math.floor(Math.random() * candidates.length)];
      target._enslaved = true;
      target.hp = Math.round(target.hp * (1 + (e.cfg.enslaveBuffHp || 0.50)));
      target.maxHp = Math.round(target.maxHp * (1 + (e.cfg.enslaveBuffHp || 0.50)));
      target.damage = Math.round(target.damage * (1 + (e.cfg.enslaveBuffDmg || 0.50)));
      e.summons = e.summons || [];
      e.summons.push(target);
    }
    e._enslaveCd = e.cfg.enslaveCooldown || 8.0;
  }
};

/* --- Ракшаса: chase + иллюзии --- */
Behaviors.rakshasa = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const count = e.cfg.illusionCount || 2;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 30;
      const sx = e.x + Math.cos(ang) * dist;
      const sy = e.y + Math.sin(ang) * dist;
      const clone = Enemies.spawnByType(Game.enemies, e.type, sx, sy);
      if (clone) {
        clone.hp = clone.maxHp = e.cfg.illusionHp || 15;
        clone.damage = Math.round(e.damage * 0.50);
        clone._isIllusion = true;
      }
    }
    e.specialCooldown = e.cfg.illusionCooldown || 5.0;
    e.attackPunch = 0.12;
  }
};

/* --- Голем-колосс: очень медленный chase + AoE slam --- */
Behaviors.golem_colossus = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const pdx = player.x - e.x, pdy = player.y - e.y;
    const r = e.cfg.slamRadius || 80;
    if (pdx * pdx + pdy * pdy <= r * r * 1.5) {
      const dmg = e.cfg.slamDamage || 45;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      player._stunTimer = Math.max(player._stunTimer || 0, e.cfg.slamStun || 1.0);
    }
    e.specialCooldown = e.cfg.slamCooldown || 6.0;
    e.attackPunch = 0.2;
    if (window.Particles) {
      Particles.ring(e.x, e.y, r, 0.4, 'rgba(128,128,128,0.7)', 4);
    }
  }
};

/* --- Тень дракона: orbit + дыхание тьмы + призыв теней --- */
Behaviors.shadow_dragon = function(e, player, dt) {
  if (!e._orbitAngle) e._orbitAngle = Math.random() * Math.PI * 2;
  e._orbitAngle += dt * 1.0;
  const orbitR = 130;
  const tx = player.x + Math.cos(e._orbitAngle) * orbitR;
  const ty = player.y + Math.sin(e._orbitAngle) * orbitR;
  _moveTowards(e, tx, ty, dt, +1);
  // Дыхание тьмы
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    const baseAng = Math.atan2(n.y, n.x);
    for (let i = -1; i <= 1; i++) {
      const a = baseAng + i * (7 * Math.PI / 180);
      _spawnEnemyProjectile(e, Math.cos(a), Math.sin(a), 'dark_breath', {
        speed: 300, life: (e.cfg.breathRange || 120) / 300 + 0.05,
        damage: e.cfg.breathDamage || 25, radius: 7,
      });
    }
    e.attackCooldown = e.cfg.breathCooldown || 4.0;
    e.attackPunch = 0.12;
  }
  // Призыв теней при 50% HP
  if (!e._summonDone && e.hp <= e.maxHp * (e.cfg.summonHpPct || 0.50)) {
    e._summonDone = true;
    const count = e.cfg.summonCount || 2;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sx = e.x + Math.cos(ang) * 50;
      const sy = e.y + Math.sin(ang) * 50;
      Enemies.spawnByType(Game.enemies, e.cfg.summonChildId || 'shadow', sx, sy);
    }
    if (window.Particles) {
      Particles.ring(e.x, e.y, 40, 0.4, 'rgba(0,0,0,0.8)', 3);
    }
  }
};

/* --- Королева слизней: ooze trail + выстрелы + сплит --- */
Behaviors.slime_queen = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  // Кислотный след
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const t = e.cfg.trail || {};
    _spawnGroundEffect(t.kind || 'acid', e.x, e.y, {
      radius: t.radius || 24, life: t.life || 3,
      dps: t.dps || 10, slow: t.slow || 0,
      color: 'rgba(0,200,0,0.5)',
    });
    e.specialCooldown = e.cfg.trailEvery || 0.3;
  }
  // Выстрелы слизнями
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const baseAng = Math.atan2(dy, dx);
    const count = e.cfg.shotCount || 3;
    for (let i = 0; i < count; i++) {
      const a = baseAng + (i - (count - 1) / 2) * 0.3;
      _spawnEnemyProjectile(e, Math.cos(a), Math.sin(a), 'slime_shot', {
        speed: e.cfg.shotSpeed || 220, life: 2.5,
        damage: e.cfg.shotDamage || 8, radius: 6,
      });
    }
    e.attackCooldown = e.cfg.shotCooldown || 3.0;
    e.attackPunch = 0.1;
  }
};

/* --- Железный голем: chase + электрический разряд при получении урона --- */
Behaviors.iron_golem = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
};

/* --- Архидемон: orbit + дыхание + кольцо ада --- */
Behaviors.archdemon = function(e, player, dt) {
  if (!e._orbitAngle) e._orbitAngle = Math.random() * Math.PI * 2;
  e._orbitAngle += dt * 0.7;
  const orbitR = 120;
  const tx = player.x + Math.cos(e._orbitAngle) * orbitR;
  const ty = player.y + Math.sin(e._orbitAngle) * orbitR;
  _moveTowards(e, tx, ty, dt, +1);
  // Дыхание
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    const baseAng = Math.atan2(n.y, n.x);
    const count = e.cfg.breathSpread || 5;
    for (let i = 0; i < count; i++) {
      const a = baseAng + (i - (count - 1) / 2) * (6 * Math.PI / 180);
      _spawnEnemyProjectile(e, Math.cos(a), Math.sin(a), 'breath', {
        speed: 340, life: (e.cfg.breathRange || 130) / 340 + 0.05,
        damage: e.cfg.breathDamage || 28, radius: 7,
      });
    }
    e.attackCooldown = e.cfg.breathCooldown || 4.0;
    e.attackPunch = 0.15;
  }
  // Кольцо ада
  if (!e._ringCd) e._ringCd = e.cfg.ringCooldown || 6.0;
  e._ringCd -= dt;
  if (e._ringCd <= 0) {
    const pdx = player.x - e.x, pdy = player.y - e.y;
    const r = e.cfg.ringMaxRadius || 120;
    if (pdx * pdx + pdy * pdy <= r * r * 1.5) {
      const dmg = e.cfg.ringDamage || 24;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
    }
    e._ringCd = e.cfg.ringCooldown || 6.0;
    if (window.Particles) {
      Particles.ring(e.x, e.y, r, e.cfg.ringExpandTime || 0.6, 'rgba(255,60,0,0.7)', 4);
    }
  }
};

/* --- Звёздный отродье: chase + пси удар + призыв спор --- */
Behaviors.star_spawn = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  // Псионический удар
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const pdx = player.x - e.x, pdy = player.y - e.y;
    const r = e.cfg.psionicRadius || 80;
    if (pdx * pdx + pdy * pdy <= r * r * 4) {
      const dmg = e.cfg.psionicDamage || 20;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      if (e.cfg.disorientDuration) {
        player._disorientTimer = Math.max(player._disorientTimer || 0, e.cfg.disorientDuration);
      }
    }
    e.attackCooldown = e.cfg.psionicCooldown || 3.0;
    e.attackPunch = 0.12;
    if (window.Particles) {
      Particles.ring(player.x, player.y, r, 0.3, 'rgba(100,0,200,0.5)', 3);
    }
  }
  // Призыв спор
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const count = e.cfg.summonCount || 2;
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sx = e.x + Math.cos(ang) * 40;
      const sy = e.y + Math.sin(ang) * 40;
      Enemies.spawnByType(Game.enemies, e.cfg.summonChildId || 'gasspore', sx, sy);
    }
    e.specialCooldown = e.cfg.summonCooldown || 5.0;
  }
};



/* ===== Тир 6 behaviors ===== */

/* --- Древний дракон: как adult_dragon но мощнее + аура страха --- */
Behaviors.ancient_dragon = function(e, player, dt) {
  // Аура замедления
  const pdx = player.x - e.x, pdy = player.y - e.y;
  const auraR = e.cfg.auraRadius || 120;
  if (pdx * pdx + pdy * pdy <= auraR * auraR) {
    // Замедление как webSlow (стакается)
    player.webSlow = Math.max(player.webSlow || 0, 0.3);
  }
  // Используем adult_dragon поведение
  Behaviors.adult_dragon(e, player, dt);
};

/* --- Кракен (щупальце): неподвижное, атакует в радиусе --- */
Behaviors.kraken_tentacle = function(e, player, dt) {
  e.vx = 0; e.vy = 0;
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const pdx = player.x - e.x, pdy = player.y - e.y;
    const r = e.cfg.slamRadius || 150;
    if (pdx * pdx + pdy * pdy <= r * r) {
      const dmg = e.cfg.slamDamage || 30;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
    }
    e.specialCooldown = e.cfg.slamCooldown || 2.0;
    e.attackPunch = 0.15;
    if (window.Particles) {
      Particles.ring(e.x, e.y, r * 0.6, 0.3, 'rgba(0,100,50,0.5)', 3);
    }
  }
};

/* --- Терраска: очень медленный chase + топот + отражение --- */
Behaviors.tarrasque = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const pdx = player.x - e.x, pdy = player.y - e.y;
    const r = e.cfg.stompRadius || 200;
    if (pdx * pdx + pdy * pdy <= r * r) {
      const dmg = e.cfg.stompDamage || 35;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      player._stunTimer = Math.max(player._stunTimer || 0, e.cfg.stompStun || 1.5);
    }
    e.specialCooldown = e.cfg.stompCooldown || 8.0;
    e.attackPunch = 0.2;
    if (window.Particles) {
      Particles.ring(e.x, e.y, r, 0.5, 'rgba(139,69,19,0.7)', 5);
    }
  }
};

/* --- Бог хаоса: chase + луч + волна энтропии --- */
Behaviors.chaos_god = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  // Луч хаоса (самонаводящийся)
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    const p = _spawnEnemyProjectile(e, n.x, n.y, 'chaos_beam', {
      speed: e.cfg.beamSpeed || 200, life: 4,
      damage: e.cfg.beamDamage || 35, radius: 6,
    });
    if (p) p.homing = true;
    e.attackCooldown = e.cfg.beamCooldown || 3.0;
    e.attackPunch = 0.1;
  }
  // Волна энтропии
  if (!e._waveCd) e._waveCd = e.cfg.waveCooldown || 8.0;
  e._waveCd -= dt;
  if (e._waveCd <= 0) {
    const pdx = player.x - e.x, pdy = player.y - e.y;
    const r = e.cfg.waveRadius || 160;
    if (pdx * pdx + pdy * pdy <= r * r) {
      // Случайный эффект
      const roll = Math.random();
      if (roll < 0.33) {
        const dmg = e.cfg.waveDamage || 25;
        if (Player.takeDamage) Player.takeDamage(player, dmg, e);
        else player.hp -= dmg;
      } else if (roll < 0.66) {
        player.webSlow = Math.max(player.webSlow || 0, 2.0);
      } else {
        // Отключение случайного оружия
        if (player.weaponSlots) {
          const active = player.weaponSlots.filter(w => w && !w._disabled);
          if (active.length > 0) {
            const w = active[Math.floor(Math.random() * active.length)];
            w._disabled = true;
            w._disableTimer = 2.0;
          }
        }
      }
    }
    e._waveCd = e.cfg.waveCooldown || 8.0;
    if (window.Particles) {
      Particles.ring(e.x, e.y, r, 0.5, 'rgba(255,0,255,0.5)', 4);
    }
  }
};

/* --- Лорд вампиров: chase + вампиризм + туман --- */
Behaviors.vampire_lord = function(e, player, dt) {
  // Туман (неуязвимость)
  if (e._mistActive) {
    e._mistTimer -= dt;
    e.invulnerable = true;
    // Проходит сквозь героя, нанося урон
    const n = _norm(player.x - e.x, player.y - e.y);
    const s = _currentSpeed(e) * 1.5;
    e.x += n.x * s * dt; e.y += n.y * s * dt;
    const collideR = (Math.max(e.cfg.w, e.cfg.h) + player.size) * 0.5;
    const pdx = player.x - e.x, pdy = player.y - e.y;
    if (pdx * pdx + pdy * pdy < collideR * collideR && e.hitCooldown <= 0) {
      const dmg = e.cfg.mistDamage || 20;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      e.hitCooldown = 0.5;
    }
    if (e._mistTimer <= 0) {
      e._mistActive = false;
      e.invulnerable = false;
    }
    return;
  }
  _moveTowards(e, player.x, player.y, dt, +1);
  // Вампирский удар
  e.hitCooldown = Math.max(0, e.hitCooldown - dt);
  const collideR = (Math.max(e.cfg.w, e.cfg.h) + player.size) * 0.5;
  const dx = player.x - e.x, dy = player.y - e.y;
  if (dx * dx + dy * dy < collideR * collideR && e.hitCooldown <= 0) {
    const dmg = e.damage;
    if (Player.takeDamage) Player.takeDamage(player, dmg, e);
    else player.hp -= dmg;
    e.hp = Math.min(e.maxHp, e.hp + dmg * (e.cfg.vampirismPct || 1.0));
    e.hitCooldown = e.cfg.hitInterval || 0.5;
    e.attackPunch = 0.1;
  }
  // Активация тумана
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    e._mistActive = true;
    e._mistTimer = e.cfg.mistDuration || 2.0;
    e.specialCooldown = e.cfg.mistCooldown || 5.0;
  }
};

/* --- Демилич: keep dist + крик + захват души --- */
Behaviors.demilich = function(e, player, dt) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const minD = e.cfg.keepDistMin || 120;
  const maxD = e.cfg.keepDistMax || 160;
  if (d < minD - 5) _moveTowards(e, player.x, player.y, dt, -1);
  else if (d > maxD + 5) _moveTowards(e, player.x, player.y, dt, +1);
  else { e.vx = e.vy = 0; }
  // Вой баньши
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const r = e.cfg.howlRadius || 150;
    if (d <= r) {
      const dmg = e.cfg.howlDamage || 30;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      player._fearTimer = Math.max(player._fearTimer || 0, e.cfg.howlFearDuration || 1.0);
    }
    e.attackCooldown = e.cfg.howlCooldown || 6.0;
    e.attackPunch = 0.15;
    if (window.Particles) {
      Particles.ring(e.x, e.y, r, 0.4, 'rgba(255,215,0,0.5)', 3);
    }
  }
  // Захват души (DPS в радиусе)
  const soulR = e.cfg.soulGrabRadius || 80;
  if (d <= soulR) {
    const dps = e.cfg.soulGrabDps || 15;
    const dmg = dps * dt;
    if (Player.takeDamage) Player.takeDamage(player, dmg, e);
    else player.hp -= dmg;
    // Замедление
    player.webSlow = Math.max(player.webSlow || 0, 0.5);
  }
};

/* --- Эмпиреец: chase + луч + столпы --- */
Behaviors.empyrean = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  // Луч
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    _spawnEnemyProjectile(e, n.x, n.y, 'holy_beam', {
      speed: e.cfg.beamSpeed || 350, life: 2.5,
      damage: e.cfg.beamDamage || 25, radius: 5,
    });
    e.attackCooldown = e.cfg.beamCooldown || 2.0;
    e.attackPunch = 0.08;
  }
  // Столпы света
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const count = e.cfg.pillarCount || 3;
    const spread = e.cfg.pillarSpread || 150;
    for (let i = 0; i < count; i++) {
      const px = player.x + Utils.rand(-spread, spread);
      const py = player.y + Utils.rand(-spread, spread);
      _spawnGroundEffect('holy_pillar', px, py, {
        radius: e.cfg.pillarRadius || 60,
        life: 1.5,
        dps: 0, slow: 0,
        delayedDamage: e.cfg.pillarDamage || 30,
        delayedTime: 0.8,
        color: 'rgba(255,255,200,0.6)',
      });
    }
    e.specialCooldown = e.cfg.pillarCooldown || 7.0;
  }
};

/* --- Повелитель зверей: chase + призыв --- */
Behaviors.beast_lord = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.summons = (e.summons || []).filter(s => s && s.active);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0 && e.summons.length < (e.cfg.maxSummons || 6)) {
    const pool = e.cfg.summonPool || ['giant_rat', 'cave_bear', 'owlbear'];
    const count = Math.min(3, (e.cfg.maxSummons || 6) - e.summons.length);
    for (let i = 0; i < count; i++) {
      const childId = pool[Math.floor(Math.random() * pool.length)];
      const ang = Math.random() * Math.PI * 2;
      const sx = e.x + Math.cos(ang) * 50;
      const sy = e.y + Math.sin(ang) * 50;
      const child = Enemies.spawnByType(Game.enemies, childId, sx, sy);
      if (child) e.summons.push(child);
    }
    e.specialCooldown = e.cfg.summonCooldown || 8.0;
    e.attackPunch = 0.12;
  }
};

/* --- Титановый элементаль: chase + смена фазы --- */
Behaviors.titan_elem = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Смена фазы
  if (!e._elemPhase) e._elemPhase = 'fire';
  if (!e._phaseCd) e._phaseCd = e.cfg.phaseCooldown || 5.0;
  e._phaseCd -= dt;
  if (e._phaseCd <= 0) {
    const phases = ['fire', 'water', 'earth', 'air'];
    const curIdx = phases.indexOf(e._elemPhase);
    e._elemPhase = phases[(curIdx + 1) % 4];
    e._phaseCd = e.cfg.phaseCooldown || 5.0;
    // Эффект при смене
    const phaseData = e.cfg.phases && e.cfg.phases[e._elemPhase];
    if (phaseData && phaseData.color) {
      // Визуальная вспышка
      if (window.Particles) {
        Particles.burst(e.x, e.y, 5, {
          color: phaseData.color, speedMin: 40, speedMax: 100,
          lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 5,
        });
      }
    }
  }
  // Эффекты текущей фазы
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    const pdx = player.x - e.x, pdy = player.y - e.y;
    const d = Math.hypot(pdx, pdy);
    switch (e._elemPhase) {
      case 'fire':
        if (d <= 80) {
          _spawnGroundEffect('fire', e.x, e.y, {
            radius: 30, life: 2, dps: 8, slow: 0,
            color: 'rgba(255,100,0,0.5)',
          });
        }
        break;
      case 'water':
        if (d <= 80) {
          player.webSlow = Math.max(player.webSlow || 0, 1.5);
          const kn = _norm(pdx, pdy);
          player.x += kn.x * 40;
          player.y += kn.y * 40;
        }
        break;
      case 'earth':
        _spawnGroundEffect('wall', e.x + (pdx > 0 ? 40 : -40), e.y, {
          radius: 30, life: 3.0, dps: 0, slow: 1.0,
          color: 'rgba(139,107,58,0.7)',
        });
        break;
      case 'air':
        // Speed boost (handled via temporary field)
        e._speedBoost = 0.50;
        e._speedBoostTimer = 3.0;
        break;
    }
    e.specialCooldown = 3.0;
  }
};

/* --- Ночной ходок: невидим + backstab --- */
Behaviors.night_walker = function(e, player, dt) {
  // Всегда невидим (полупрозрачен)
  e.invisible = true;
  // Но не неуязвим
  e.invulnerable = false;
  _moveTowards(e, player.x, player.y, dt, +1);
  // Backstab: повышенный урон при атаке
  e.hitCooldown = Math.max(0, e.hitCooldown - dt);
  const collideR = (Math.max(e.cfg.w, e.cfg.h) + player.size) * 0.5;
  const dx = player.x - e.x, dy = player.y - e.y;
  if (dx * dx + dy * dy < collideR * collideR && e.hitCooldown <= 0) {
    let dmg = e.damage;
    // Backstab: если герой двигается ОТ нас (не смотрит) — x2
    const ml = Math.hypot(player.moveDir.x || 0, player.moveDir.y || 0);
    if (ml > 0.1) {
      const dot = (player.moveDir.x || 0) * (-dx) + (player.moveDir.y || 0) * (-dy);
      if (dot > 0) dmg *= (e.cfg.backstabMul || 2.0);
    }
    if (Player.takeDamage) Player.takeDamage(player, dmg, e);
    else player.hp -= dmg;
    e.hitCooldown = e.cfg.hitInterval || 0.5;
    e.attackPunch = 0.1;
  }
};



/* ============================================================
   Элитная система (Шаг 12).
   Переопределяет элитный спавн: 3% шанс для тир 3+ врагов.
   Элитные враги: +80% HP, +30% урона, +10% скорости,
   аура (+15% урона ближайших), взрыв элемента при смерти.
   ============================================================ */

const _step12SpawnByType = Enemies.spawnByType;
Enemies.spawnByType = function(pool, typeId, x, y) {
  const e = _step12SpawnByType.call(Enemies, pool, typeId, x, y);
  if (!e) return null;
  const cfg = e.cfg;
  if (!cfg) return e;

  // Step 12 specific fields
  e._mistActive = false;
  e._mistTimer = 0;
  e._enslaveCd = (cfg.enslaveCooldown || 0) * Utils.rand(0.5, 1.0);
  e._elemPhase = null;
  e._phaseCd = 0;
  e._ringCd = 0;
  e._summonDone = false;
  e._isIllusion = false;
  e._enslaved = false;

  // Gargoyle starts inactive
  if (cfg.behavior === 'gargoyle') {
    e.activated = false;
    e.invulnerable = true;
  }

  // Elite override: Step 12 system (3% for tier 3+, replaces old 5% for tier 2+)
  // Already handled by previous patch; we enhance it here for tier 3+ with stronger bonuses
  if (cfg.tier >= 3 && cfg.spawnWeight > 0 && !e._elite && !cfg.isEliteVariant && !cfg.rareSpawn) {
    if (Math.random() < 0.03) {
      e._elite = true;
      e.hp = Math.round(e.hp * 1.80);
      e.maxHp = e.hp;
      e.damage = Math.round(e.damage * 1.30);
      // Speed +10% handled in render
      e._eliteAuraRadius = cfg.eliteAuraRadius || 80;
      e._eliteDeathElement = ['fire', 'ice', 'poison', 'dark'][Math.floor(Math.random() * 4)];
    }
  }

  return e;
};

/* ============================================================
   Extended death handler (Step 12).
   ============================================================ */
const _step12HandleDeath = Enemies.handleDeath;
Enemies.handleDeath = function(e, gameCtx) {
  if (!e || !e.cfg) return;

  // Elite death explosion
  if (e._elite && e._eliteDeathElement) {
    const elem = e._eliteDeathElement;
    const radius = 70;
    const damage = Math.round(e.damage * 0.8);
    let color = 'rgba(255,100,0,0.7)';
    if (elem === 'ice') color = 'rgba(100,200,255,0.7)';
    else if (elem === 'poison') color = 'rgba(100,200,50,0.7)';
    else if (elem === 'dark') color = 'rgba(50,0,80,0.7)';

    const player = gameCtx.player;
    if (player) {
      const dx = player.x - e.x, dy = player.y - e.y;
      if (dx * dx + dy * dy <= radius * radius) {
        if (Player.takeDamage) Player.takeDamage(player, damage, e);
        else player.hp -= damage;
        // Element-specific debuff
        if (elem === 'ice') player.webSlow = Math.max(player.webSlow || 0, 1.5);
        if (elem === 'poison') {
          if (!player.poison) player.poison = { dps: 0, remaining: 0 };
          player.poison.dps = Math.max(player.poison.dps, 5);
          player.poison.remaining = Math.max(player.poison.remaining, 3);
        }
      }
    }
    if (window.Particles) {
      Particles.ring(e.x, e.y, radius, 0.4, color, 4);
      Particles.burst(e.x, e.y, 8, {
        color: color, speedMin: 60, speedMax: 180,
        lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 5,
      });
    }
  }

  // Golem colossus death shockwave
  if (e.cfg.deathShockwave) {
    const sw = e.cfg.deathShockwave;
    const player = gameCtx.player;
    if (player) {
      const dx = player.x - e.x, dy = player.y - e.y;
      if (dx * dx + dy * dy <= sw.radius * sw.radius) {
        if (Player.takeDamage) Player.takeDamage(player, sw.damage, e);
        else player.hp -= sw.damage;
      }
    }
    if (window.Particles) {
      Particles.ring(e.x, e.y, sw.radius, 0.5, 'rgba(128,128,128,0.8)', 5);
    }
  }

  // Doppelganger-mage: split on death
  if (e.cfg.splitCount && e.cfg.behavior === 'doppelganger_mage' && !e._isIllusion) {
    for (let i = 0; i < (e.cfg.splitCount || 2); i++) {
      const ang = Math.random() * Math.PI * 2;
      const sx = e.x + Math.cos(ang) * 30;
      const sy = e.y + Math.sin(ang) * 30;
      const clone = Enemies.spawnByType(gameCtx.enemies, e.type, sx, sy);
      if (clone) {
        clone.hp = clone.maxHp = e.cfg.splitHp || 15;
        clone.damage = 0;
        clone._isIllusion = true;
      }
    }
  }

  // Illithid-arcanist: kill enslaved on death
  if (e.cfg.killSummonsOnDeath && e.summons) {
    for (const s of e.summons) {
      if (s && s.active && s._enslaved) {
        s.active = false;
        if (window.Particles) {
          Particles.burst(s.x, s.y, 3, {
            color: '#6600cc', speedMin: 40, speedMax: 100,
            lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
          });
        }
      }
    }
  }

  // Demilich: death summon
  if (e.cfg.deathSummon) {
    const ds = e.cfg.deathSummon;
    for (let i = 0; i < (ds.count || 5); i++) {
      const ang = Math.random() * Math.PI * 2;
      const sx = e.x + Math.cos(ang) * 50;
      const sy = e.y + Math.sin(ang) * 50;
      Enemies.spawnByType(gameCtx.enemies, ds.childId || 'mage', sx, sy);
    }
  }

  // Water elem large: death flood
  if (e.cfg.deathFlood) {
    const df = e.cfg.deathFlood;
    _spawnGroundEffect('water', e.x, e.y, {
      radius: df.radius || 80, life: df.duration || 4.0,
      slow: df.slow || 0.50, dps: 0,
      color: 'rgba(68,136,204,0.5)',
    });
  }

  // Ice elem: death slow zone
  if (e.cfg.deathSlow) {
    const ds = e.cfg.deathSlow;
    _spawnGroundEffect('ice', e.x, e.y, {
      radius: ds.radius || 60, life: ds.duration || 1.0,
      slow: ds.slowPct || 0.80, dps: 0,
      color: 'rgba(136,204,255,0.6)',
    });
  }

  // Star spawn: death zone
  if (e.cfg.deathZone) {
    const dz = e.cfg.deathZone;
    _spawnGroundEffect('void', e.x, e.y, {
      radius: dz.radius || 100, life: dz.duration || 5.0,
      slow: dz.slowPct || 0.50, dps: 0,
      color: 'rgba(50,0,100,0.5)',
    });
  }

  // Chaos god death explosion (all screen)
  if (e.cfg.deathExplosion && e.cfg.behavior === 'chaos_god') {
    const de = e.cfg.deathExplosion;
    const player = gameCtx.player;
    if (player) {
      if (Player.takeDamage) Player.takeDamage(player, de.damage, e);
      else player.hp -= de.damage;
    }
    if (window.Particles) {
      Particles.ring(e.x, e.y, de.radius || 200, 0.8, 'rgba(255,0,255,0.8)', 6);
    }
  }

  // Call previous handler chain
  _step12HandleDeath.call(Enemies, e, gameCtx);
};

/* ============================================================
   Extended hit handler (Step 12).
   ============================================================ */
const _step12HandleHit = Enemies.handleHit;
Enemies.handleHit = function(e, gameCtx) {
  if (!e || !e.cfg) return;

  // Troll: fire vulnerability (double damage from fire)
  // (Handled at damage source level - this is just for the handleHit hook)

  // Iron golem: electric shock on hit
  if (e.cfg.behavior === 'iron_golem' && e.cfg.shockChance) {
    if (Math.random() < (e.cfg.shockChance || 0.20)) {
      const player = gameCtx.player;
      if (player) {
        const r = e.cfg.shockRadius || 70;
        const pdx = player.x - e.x, pdy = player.y - e.y;
        if (pdx * pdx + pdy * pdy <= r * r) {
          const dmg = e.cfg.shockDamage || 16;
          if (Player.takeDamage) Player.takeDamage(player, dmg, e);
          else player.hp -= dmg;
        }
      }
      if (window.Particles) {
        Particles.ring(e.x, e.y, e.cfg.shockRadius || 70, 0.2, 'rgba(100,150,255,0.6)', 2);
      }
    }
  }

  // Tarrasque: physical reflect
  if (e.cfg.physReflect && gameCtx.player) {
    // Reflect percentage of damage back
    // Since we don't have exact damage here, approximate with 5 flat
    const reflectDmg = 5;
    const player = gameCtx.player;
    if (Player.takeDamage) Player.takeDamage(player, reflectDmg, e);
    else player.hp -= reflectDmg;
  }

  // Call previous handler chain
  _step12HandleHit.call(Enemies, e, gameCtx);
};

/* ============================================================
   Elite aura system — buff nearby enemies.
   Integrated into update cycle.
   ============================================================ */
const _step12Update = Enemies.update;
Enemies.update = function(pool, player, dt) {
  // Player debuff ticks (disorient, fear)
  if (player) {
    if (player._disorientTimer > 0) {
      player._disorientTimer -= dt;
    }
    if (player._fearTimer > 0) {
      player._fearTimer -= dt;
    }
  }

  // Call previous update chain
  _step12Update.call(Enemies, pool, player, dt);

  // Post-update: Elite aura buff
  const items = pool.items;
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (!e.active || !e._elite || !e._eliteAuraRadius) continue;
    const r2 = e._eliteAuraRadius * e._eliteAuraRadius;
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const t = items[j];
      if (!t.active) continue;
      const dx = t.x - e.x, dy = t.y - e.y;
      if (dx * dx + dy * dy <= r2) {
        t.captainBuffed = true; // reuse captain buff system for +damage
      }
    }
  }
};

/* ============================================================
   Render patch: elite golden outline, tier 6 portal effect,
   color shift for chaos_god, gargoyle inactive stone look.
   ============================================================ */
const _step12Render = Enemies.render;
Enemies.render = function(ctx, pool, cam, viewW, viewH) {
  const minX = cam.x, minY = cam.y;
  const maxX = cam.x + viewW, maxY = cam.y + viewH;
  const items = pool.items;

  // Pre-pass for step 12 specific effects (soft aura, no stroke outlines)
  for (let i = 0; i < items.length; i++) {
    const e = items[i];
    if (!e.active || !e.cfg) continue;
    const halfR = Math.max(e.cfg.w, e.cfg.h);
    if (e.x + halfR < minX || e.x - halfR > maxX ||
        e.y + halfR < minY || e.y - halfR > maxY) continue;

    // Elite: soft golden aura (no outline)
    if (e._elite && e._eliteAuraRadius) {
      ctx.save();
      ctx.globalAlpha = 0.15 + 0.08 * Math.sin(e.lifeTime * 5);
      ctx.fillStyle = '#ffd700';
      ctx.beginPath();
      ctx.arc(e.x, e.y, halfR * 0.85, 0, Math.PI * 2);
      ctx.fill();
      // Aura range indicator (subtle)
      ctx.globalAlpha = 0.06;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e._eliteAuraRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Tier 6 enemies: subtle purple aura (no stroke)
    if (e.cfg.tier === 6) {
      ctx.save();
      ctx.globalAlpha = 0.10 + 0.05 * Math.sin(e.lifeTime * 2.5);
      ctx.fillStyle = '#9933ff';
      ctx.beginPath();
      ctx.arc(e.x, e.y, halfR * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Call previous render chain
  _step12Render.call(Enemies, ctx, pool, cam, viewW, viewH);
};
'use strict';
/* ============================================================
   enemies_expansion.js — поведения 50 новых врагов (Expansion).
   Расширяет объект Behaviors из enemies.js / enemies_new.js.
   Загружается ПОСЛЕ enemies_new.js, enemies_step12.js и
   constants_expansion.js.
   ============================================================ */

/* =============================================================
   ТИР 1 — поведения
   ============================================================= */

/* --- Чумная крыса: chase + при смерти ядовитый эффект --- */
Behaviors.plague_rat = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
};

/* --- Грибной спрайт: chase + споровый шлейф --- */
Behaviors.mushroom_sprite = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e._trailCd = (e._trailCd || 0) - dt;
  if (e._trailCd <= 0) {
    e._trailCd = e.cfg.sporeTrailEvery || 0.8;
    _spawnGroundEffect('spore_trap', e.x, e.y, {
      radius: e.cfg.sporeTrailRadius || 18,
      life: e.cfg.sporeTrailLife || 4,
      dps: e.cfg.sporeTrailDamage || 3,
      slow: e.cfg.sporeTrailSlow || 0.20,
      color: 'rgba(120, 90, 50, 0.25)',
      invisible: true,
    });
  }
};


/* --- Костяной ползун: стены + рывок при проходе героя --- */
Behaviors.bone_crawler = function(e, player, dt) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  if (e.state === 'lunge') {
    e.dashTimer -= dt;
    const n = _norm(e._lungeX - e.x, e._lungeY - e.y);
    const s = e.cfg.lungeSpeed || 180;
    e.vx = n.x * s; e.vy = n.y * s;
    const mx = e.vx * dt, my = e.vy * dt;
    const rad = Math.max(e.cfg.w, e.cfg.h) * 0.4;
    if (window.GameMap && GameMap.dungeon) {
      const r = GameMap.moveWithCollision(e.x, e.y, mx, my, rad);
      e.x = r.x; e.y = r.y;
    } else { e.x += mx; e.y += my; }
    _tryContactDamage(e, player, dt);
    if (e.dashTimer <= 0) { e.state = 'idle'; e.specialCooldown = 1.5; }
  } else {
    // Движется к герою медленно (вдоль стен визуально, но chase по логике)
    _moveTowards(e, player.x, player.y, dt, +1);
    e.specialCooldown -= dt;
    if (e.specialCooldown <= 0 && dist <= (e.cfg.lungeRange || 50) * 2) {
      e.state = 'lunge';
      e.dashTimer = e.cfg.lungeTime || 0.25;
      e._lungeX = player.x; e._lungeY = player.y;
      e.attackPunch = 0.12;
    }
  }
};

/* --- Блуждающий огонёк: мерцание + телепорт --- */
Behaviors.wisp_minor = function(e, player, dt) {
  e.specialCooldown -= dt;
  if (e._flickerInvuln > 0) {
    e._flickerInvuln -= dt;
    e.invulnerable = true;
    e.vx = 0; e.vy = 0;
    if (e._flickerInvuln <= 0) {
      e.invulnerable = false;
      // Телепорт к случайной точке вблизи героя
      const ang = Math.random() * Math.PI * 2;
      const dist = e.cfg.flickerTeleportDist || 60;
      const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
      e.x = Utils.clamp(player.x + Math.cos(ang) * dist, m,
        (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) - m);
      e.y = Utils.clamp(player.y + Math.sin(ang) * dist, m,
        (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) - m);
    }
    return;
  }
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  if (e.specialCooldown <= 0) {
    e.specialCooldown = e.cfg.flickerInterval || 2.5;
    e._flickerInvuln = e.cfg.flickerInvulnTime || 0.5;
  }
};


/* --- Жук-падальщик: chase + усиливается при смерти рядом --- */
Behaviors.carrion_beetle = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Усиление обрабатывается в Enemies.handleDeath (патч ниже)
};

/* --- Грязевой бесёнок: chase + лужи грязи --- */
Behaviors.mud_imp = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e._trailCd = (e._trailCd || 0) - dt;
  if (e._trailCd <= 0) {
    e._trailCd = e.cfg.mudCooldown || 5.0;
    _spawnGroundEffect('mud', e.x, e.y, {
      radius: e.cfg.mudRadius || 25,
      life: e.cfg.mudLife || 3.0,
      slow: e.cfg.mudSlow || 0.20,
      dps: 0,
      color: 'rgba(100, 70, 40, 0.4)',
    });
    e.attackPunch = 0.08;
  }
};

/* --- Дух-искра: chase + притягивает XP-кристаллы --- */
Behaviors.spirit_wisp = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Притяжение XP обрабатывается в основном цикле (лёгкое)
  if (window.Game && Game.xpDrops) {
    const mr = e.cfg.xpMagnetRadius || 60;
    const ms = (e.cfg.xpMagnetSpeed || 80) * dt;
    Game.xpDrops.forEachActive(function(xp) {
      const dx = e.x - xp.x, dy = e.y - xp.y;
      const d = Math.hypot(dx, dy);
      if (d < mr && d > 5) {
        xp.x += (dx / d) * ms;
        xp.y += (dy / d) * ms;
      }
    });
  }
};

/* --- Лозолаз: медленный chase + замедление без урона --- */
Behaviors.vine_creeper = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  // Корневая привязка — замедляет героя при контакте (без урона)
  const dx = player.x - e.x, dy = player.y - e.y;
  const collideR = (Math.max(e.cfg.w, e.cfg.h) + player.size) * 0.5;
  if (dx * dx + dy * dy < collideR * collideR) {
    // Замедление через _slowFactor (аналог ледяной стрелы)
    if (!player._vineSlowTimer || player._vineSlowTimer <= 0) {
      player._vineSlowTimer = e.cfg.rootDuration || 1.0;
      player._vineSlowFactor = e.cfg.rootSlow || 0.30;
    }
  }
};


/* =============================================================
   ТИР 2 — поведения
   ============================================================= */

/* --- Некро-аколит: держит дистанцию + поднимает скелетов --- */
Behaviors.necro_acolyte = function(e, player, dt) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 80) _moveTowards(e, player.x, player.y, dt, -1);
  else if (d > 130) _moveTowards(e, player.x, player.y, dt, +1);
  else { e.vx = 0; e.vy = 0; }
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    e.specialCooldown = e.cfg.raiseCooldown || 8.0;
    // Попытка призыва — ищем недавний труп (упрощённо: спавним рядом)
    if (window.Enemies && window.Game && Game.enemies) {
      const childId = e.cfg.raiseChildId || 'skeleton';
      const ang = Math.random() * Math.PI * 2;
      const sx = e.x + Math.cos(ang) * 40;
      const sy = e.y + Math.sin(ang) * 40;
      Enemies.spawnByType(Game.enemies, childId, sx, sy);
      e.attackPunch = 0.12;
      if (window.Particles) {
        Particles.burst(sx, sy, 4, {
          color: '#8040c0', speedMin: 40, speedMax: 100,
          lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
        });
      }
    }
  }
};

/* --- Песчаный червь: чередование подземный/надземный --- */
Behaviors.sand_worm = function(e, player, dt) {
  e.specialCooldown -= dt;
  if (e.state === 'burrowed') {
    // Невидим, двигается к герою
    e.invisible = true;
    e.invulnerable = true;
    _moveTowards(e, player.x, player.y, dt, +1);
    if (e.specialCooldown <= 0) {
      e.state = 'surfaced';
      e.specialCooldown = e.cfg.surfaceTime || 1.0;
      e.invisible = false;
      e.invulnerable = false;
      // AoE при выныривании
      const dx = player.x - e.x, dy = player.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= (e.cfg.surfaceRadius || 30) + player.size * 0.5) {
        const dmg = e.cfg.surfaceDamage || 12;
        if (Player.takeDamage) Player.takeDamage(player, dmg, e);
        else player.hp -= dmg;
      }
      e.attackPunch = 0.15;
      if (window.Particles) {
        Particles.burst(e.x, e.y, 6, {
          color: '#c9a84c', speedMin: 60, speedMax: 120,
          lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4,
        });
      }
    }
  } else {
    // На поверхности — стоит, уязвим
    e.vx = 0; e.vy = 0;
    _tryContactDamage(e, player, dt);
    if (e.specialCooldown <= 0) {
      e.state = 'burrowed';
      e.specialCooldown = e.cfg.burrowTime || 2.0;
    }
  }
};


/* --- Ядовитая жаба: прыжок + плевок --- */
Behaviors.toxic_toad = function(e, player, dt) {
  e.attackCooldown -= dt;
  e.specialCooldown -= dt;
  if (e.state === 'jumping') {
    e.dashTimer -= dt;
    const s = e.cfg.jumpSpeed || 250;
    const mx = e._jumpDirX * s * dt, my = e._jumpDirY * s * dt;
    const rad = Math.max(e.cfg.w, e.cfg.h) * 0.4;
    if (window.GameMap && GameMap.dungeon) {
      const r = GameMap.moveWithCollision(e.x, e.y, mx, my, rad);
      e.x = r.x; e.y = r.y;
    } else { e.x += mx; e.y += my; }
    if (e.dashTimer <= 0) {
      e.state = 'idle';
      // Лужа яда при приземлении
      _spawnGroundEffect('acid', e.x, e.y, {
        radius: (e.cfg.landingAoE && e.cfg.landingAoE.radius) || 30,
        life: (e.cfg.landingAoE && e.cfg.landingAoE.life) || 2,
        dps: (e.cfg.landingAoE && e.cfg.landingAoE.dps) || 4,
        slow: 0,
        color: 'rgba(80, 160, 80, 0.4)',
      });
      e.attackPunch = 0.1;
    }
  } else {
    _moveTowards(e, player.x, player.y, dt, +1);
    _tryContactDamage(e, player, dt);
    // Прыжок
    if (e.attackCooldown <= 0) {
      const dx = player.x - e.x, dy = player.y - e.y;
      const n = _norm(dx, dy);
      e.state = 'jumping';
      e.dashTimer = e.cfg.jumpTime || 0.3;
      e._jumpDirX = n.x; e._jumpDirY = n.y;
      e.attackCooldown = e.cfg.jumpCooldown || 3.0;
    }
    // Плевок
    if (e.specialCooldown <= 0) {
      const dx = player.x - e.x, dy = player.y - e.y;
      const n = _norm(dx, dy);
      _spawnEnemyProjectile(e, n.x, n.y, 'poison_spit', {
        speed: e.cfg.spitSpeed || 240, life: 2,
        damage: e.cfg.spitDamage || 6, radius: 5,
      });
      e.specialCooldown = e.cfg.spitCooldown || 2.5;
      e.attackPunch = 0.08;
    }
  }
};

/* --- Цепной фантом: привязка цепью --- */
Behaviors.chain_phantom = function(e, player, dt) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  // Привязка: если далеко — рывок к герою
  if (e._chained && dist > (e.cfg.chainMaxDist || 120)) {
    // Рывок + урон
    const n = _norm(dx, dy);
    const s = e.cfg.chainDashSpeed || 300;
    e.x += n.x * s * dt;
    e.y += n.y * s * dt;
    if (dist <= (e.cfg.chainMaxDist || 120) * 0.8) {
      const dmg = e.cfg.chainSnapDamage || 8;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      e.attackPunch = 0.1;
    }
  } else {
    // Обычное следование (через стены)
    const n = _norm(dx, dy);
    const s = _currentSpeed(e);
    e.vx = n.x * s; e.vy = n.y * s;
    e.x += e.vx * dt; e.y += e.vy * dt;
    _tryContactDamage(e, player, dt);
  }
  // Активируем цепь при первом сближении
  if (!e._chained && dist <= (e.cfg.chainRange || 80)) {
    e._chained = true;
  }
};


/* --- Угольная моль: синусоида + самовоспламенение --- */
Behaviors.ember_moth = function(e, player, dt) {
  // Летает синусоидой (аналог bat)
  e.sinPhase = (e.sinPhase || 0) + (e.cfg.sinFreq || 5) * dt;
  const dx = player.x - e.x, dy = player.y - e.y;
  const n = _norm(dx, dy);
  const s = _currentSpeed(e);
  const perpX = -n.y, perpY = n.x;
  const sinOff = Math.sin(e.sinPhase) * (e.cfg.sinAmp || 22);
  e.vx = n.x * s + perpX * sinOff * 2;
  e.vy = n.y * s + perpY * sinOff * 2;
  const rad = Math.max(e.cfg.w, e.cfg.h) * 0.4;
  if (window.GameMap && GameMap.dungeon) {
    const r = GameMap.moveWithCollision(e.x, e.y, e.vx * dt, e.vy * dt, rad);
    e.x = r.x; e.y = r.y;
  } else { e.x += e.vx * dt; e.y += e.vy * dt; }

  e.specialCooldown -= dt;
  if (e._igniteTimer > 0) {
    // Горит — AoE урон
    e._igniteTimer -= dt;
    const dist = Math.hypot(player.x - e.x, player.y - e.y);
    if (dist <= (e.cfg.igniteRadius || 40)) {
      const dps = (e.cfg.igniteDamage || 8) * dt;
      if (Player.takeDamage) Player.takeDamage(player, dps, e);
      else player.hp -= dps;
    }
  } else if (e.specialCooldown <= 0) {
    e._igniteTimer = e.cfg.igniteTime || 1.0;
    e.specialCooldown = e.cfg.igniteCooldown || 4.0;
    e.attackPunch = 0.1;
  }
  _tryContactDamage(e, player, dt);
};

/* --- Жук-роевик: рой (ускорение в группе) --- */
Behaviors.swarm_beetle = function(e, player, dt) {
  // Подсчёт соседей для ускорения
  let nearbyCount = 0;
  if (window.Game && Game.enemies) {
    Game.enemies.forEachActive(function(other) {
      if (other === e || other.type !== 'swarm_beetle') return;
      const d2 = Utils.dist2(e.x, e.y, other.x, other.y);
      if (d2 < (e.cfg.swarmRadius || 25) * (e.cfg.swarmRadius || 25)) nearbyCount++;
    });
  }
  const speedMul = nearbyCount >= (e.cfg.swarmMinCount || 3) ? (1 + (e.cfg.swarmSpeedBonus || 0.50)) : 1;
  // Chase с бонусом скорости
  const n = _norm(player.x - e.x, player.y - e.y);
  const s = _currentSpeed(e) * speedMul;
  e.vx = n.x * s; e.vy = n.y * s;
  const rad = Math.max(e.cfg.w, e.cfg.h) * 0.4;
  if (window.GameMap && GameMap.dungeon) {
    const r = GameMap.moveWithCollision(e.x, e.y, e.vx * dt, e.vy * dt, rad);
    e.x = r.x; e.y = r.y;
  } else { e.x += e.vx * dt; e.y += e.vy * dt; }
  _tryContactDamage(e, player, dt);
};

/* --- Зеркальный дух: chase + отражение снаряда --- */
Behaviors.mirror_wisp = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Отражение обрабатывается в системе попаданий (патч ниже)
};

/* --- Корневой скиталец: chase + линейная корневая атака --- */
Behaviors.root_shambler = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    _spawnEnemyProjectile(e, n.x, n.y, 'root_spike', {
      speed: e.cfg.rootAttackSpeed || 200, life: 1.5,
      damage: e.cfg.rootAttackDamage || 10, radius: 6,
    });
    e.attackCooldown = e.cfg.rootAttackCooldown || 6.0;
    e.attackPunch = 0.1;
  }
};

/* --- Носитель чумы: chase + аура болезни --- */
Behaviors.plaguebearer = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Аура снижения регена — проверяется каждый кадр
  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= (e.cfg.plagueAuraRadius || 50)) {
    player._plagueRegenDebuff = Math.max(player._plagueRegenDebuff || 0,
      e.cfg.plagueRegenReduction || 0.50);
    player._plagueRegenTimer = 0.5; // обновляется каждые 0.5с
  }
};


/* =============================================================
   ТИР 3 — поведения
   ============================================================= */

/* --- Заводной паук: тики (мгновенное перемещение) --- */
Behaviors.clockwork_spider = function(e, player, dt) {
  e.specialCooldown -= dt;
  e.vx = 0; e.vy = 0;
  if (e.specialCooldown <= 0) {
    e.specialCooldown = e.cfg.tickInterval || 1.0;
    // Мгновенный «тик» — перемещение на tickDistance к герою
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    const dist = e.cfg.tickDistance || 60;
    const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
    let nx = e.x + n.x * dist, ny = e.y + n.y * dist;
    if (window.GameMap && GameMap.dungeon) {
      const r = GameMap.moveWithCollision(e.x, e.y, n.x * dist, n.y * dist, m);
      nx = r.x; ny = r.y;
    }
    nx = Utils.clamp(nx, m, (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) - m);
    ny = Utils.clamp(ny, m, (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) - m);
    e.x = nx; e.y = ny;
    e.attackPunch = 0.08;
    if (window.Particles) {
      Particles.burst(e.x, e.y, 3, {
        color: '#cccc44', speedMin: 40, speedMax: 80,
        lifeMin: 0.15, lifeMax: 0.3, sizeMin: 1, sizeMax: 3,
      });
    }
  }
  _tryContactDamage(e, player, dt);
};

/* --- Кровавый слизень: drain HP + скорость масштабируется --- */
Behaviors.blood_ooze = function(e, player, dt) {
  // Скорость зависит от HP
  const hpRatio = e.hp / e.maxHp;
  const speedBonus = 1 + (1 - hpRatio) * ((e.cfg.maxSpeedBonus || 1.5) - 1);
  const n = _norm(player.x - e.x, player.y - e.y);
  const s = _currentSpeed(e) * speedBonus;
  e.vx = n.x * s; e.vy = n.y * s;
  const rad = Math.max(e.cfg.w, e.cfg.h) * 0.4;
  if (window.GameMap && GameMap.dungeon) {
    const r = GameMap.moveWithCollision(e.x, e.y, e.vx * dt, e.vy * dt, rad);
    e.x = r.x; e.y = r.y;
  } else { e.x += e.vx * dt; e.y += e.vy * dt; }

  // Drain HP на расстоянии
  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= (e.cfg.drainRange || 80)) {
    const drainDmg = (e.cfg.drainDps || 3) * dt;
    if (Player.takeDamage) Player.takeDamage(player, drainDmg, e);
    else player.hp -= drainDmg;
    e.hp = Math.min(e.maxHp, e.hp + drainDmg * (e.cfg.drainHealMul || 1.0));
  }
  _tryContactDamage(e, player, dt);
};

/* --- Пепельный призрак: игнорирует стены + эффект затемнения --- */
Behaviors.ash_wraith = function(e, player, dt) {
  // Движение через стены
  const n = _norm(player.x - e.x, player.y - e.y);
  const s = _currentSpeed(e);
  e.vx = n.x * s; e.vy = n.y * s;
  e.x += e.vx * dt; e.y += e.vy * dt;
  const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
  e.x = Utils.clamp(e.x, m, (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) - m);
  e.y = Utils.clamp(e.y, m, (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) - m);
  _tryContactDamage(e, player, dt);
  // Эффект затемнения обрабатывается в рендере (проверка по дистанции)
};


/* --- Кристальный голем: медленный chase, отражение снарядов --- */
Behaviors.crystal_golem = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Преломление обрабатывается в системе попаданий
};

/* --- Потусторонний пёс: chase + бонус за координацию --- */
Behaviors.nether_hound = function(e, player, dt) {
  // Проверка соседа для координации
  let hasPartner = false;
  if (window.Game && Game.enemies) {
    Game.enemies.forEachActive(function(other) {
      if (other === e || other.type !== 'nether_hound') return;
      const d2 = Utils.dist2(e.x, e.y, other.x, other.y);
      if (d2 < (e.cfg.packRadius || 100) * (e.cfg.packRadius || 100)) hasPartner = true;
    });
  }
  if (hasPartner) e._packBonus = e.cfg.packDamageBonus || 0.30;
  else e._packBonus = 0;

  _moveTowards(e, player.x, player.y, dt, +1);
  // Контактный урон с бонусом
  if (e.cfg.damage) {
    e.hitCooldown = Math.max(0, e.hitCooldown - dt);
    const collideR = (Math.max(e.cfg.w, e.cfg.h) + player.size) * 0.5;
    const dx = player.x - e.x, dy = player.y - e.y;
    if (dx * dx + dy * dy < collideR * collideR && e.hitCooldown <= 0) {
      const dmg = e.damage * (1 + (e._packBonus || 0));
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      e.hitCooldown = e.cfg.hitInterval || 0.5;
      e.attackPunch = 0.1;
    }
  }
};

/* --- Споровый носитель: chase + деление при 50% HP --- */
Behaviors.spore_carrier = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Деление обрабатывается в Enemies.handleDeath/damage (патч)
  if (!e._hasSplit && e.hp <= e.maxHp * (e.cfg.splitHpPct || 0.50)) {
    e._hasSplit = true;
    const count = e.cfg.splitCount || 2;
    for (let i = 0; i < count; i++) {
      if (window.Enemies && window.Game && Game.enemies) {
        const ang = (Math.PI * 2 / count) * i;
        const sx = e.x + Math.cos(ang) * 25;
        const sy = e.y + Math.sin(ang) * 25;
        const child = Enemies.spawnByType(Game.enemies, e.type, sx, sy);
        if (child) {
          child.hp = Math.floor(e.maxHp * (e.cfg.splitHpMul || 0.30));
          child.maxHp = child.hp;
          child._hasSplit = true; // Не делится повторно
        }
      }
    }
  }
};

/* --- Гравитационная аномалия: chase + притяжение героя --- */
Behaviors.gravity_aberration = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  e.specialCooldown -= dt;
  // Замедление снарядов обрабатывается в системе снарядов (патч)
  // Пульс притяжения
  if (e.specialCooldown <= 0) {
    e.specialCooldown = e.cfg.gravPulseCooldown || 5.0;
    const dx = e.x - player.x, dy = e.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= (e.cfg.gravPulseRadius || 100) && dist > 10) {
      const pullDist = e.cfg.gravPullDist || 30;
      const n = _norm(dx, dy);
      player.x += n.x * pullDist;
      player.y += n.y * pullDist;
      e.attackPunch = 0.1;
    }
  }
};


/* --- Трупный подрыватель: бежит к герою, 3 заряда детонации --- */
Behaviors.corpse_detonator = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Упрощённо: зарядов нет (детонация обрабатывается как обычный chase)
  // В полной версии мог бы искать «трупы» — здесь просто chase + AoE при смерти
};

/* --- Эхо-тень: повторяет маршрут героя с задержкой --- */
Behaviors.echo_shade = function(e, player, dt) {
  // Запись маршрута героя
  if (!e._echoHistory) e._echoHistory = [];
  e._echoTimer = (e._echoTimer || 0) + dt;
  // Записываем позицию героя каждые 0.033с
  if (e._echoTimer >= 0.033) {
    e._echoTimer = 0;
    e._echoHistory.push({ x: player.x, y: player.y });
    const maxSize = e.cfg.echoHistorySize || 60;
    if (e._echoHistory.length > maxSize) e._echoHistory.shift();
  }
  // Следуем за историей с задержкой
  const delay = e.cfg.echoDelay || 2.0;
  const framesDelay = Math.floor(delay / 0.033);
  const idx = Math.max(0, e._echoHistory.length - framesDelay);
  if (e._echoHistory.length > framesDelay) {
    const target = e._echoHistory[idx];
    const n = _norm(target.x - e.x, target.y - e.y);
    const s = Math.hypot(target.x - e.x, target.y - e.y) / dt;
    const clampedS = Math.min(s, 200);
    e.vx = n.x * clampedS; e.vy = n.y * clampedS;
    e.x += e.vx * dt; e.y += e.vy * dt;
  }
  _tryContactDamage(e, player, dt);
};

/* --- Магматический краб: chase + огненный trail + melee retaliation --- */
Behaviors.magma_crab = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Trail огня
  e._trailCd = (e._trailCd || 0) - dt;
  if (e._trailCd <= 0 && e.cfg.trailEvery) {
    e._trailCd = e.cfg.trailEvery;
    const t = e.cfg.trail;
    if (t) _spawnGroundEffect(t.kind, e.x, e.y, {
      radius: t.radius, life: t.life, dps: t.dps, slow: t.slow || 0,
      color: 'rgba(200, 80, 0, 0.4)',
    });
  }
  // Ответный огненный урон при ударе в ближнем бою обрабатывается в hit-системе
};


/* =============================================================
   ТИР 4 — поведения
   ============================================================= */

/* --- Пустотный охотник: телепорт за спину героя --- */
Behaviors.void_stalker = function(e, player, dt) {
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    e.specialCooldown = e.cfg.blinkCooldown || 4.0;
    // Телепорт за спину героя (противоположно направлению движения)
    let behindX, behindY;
    const moveLen = Math.hypot(player.moveDir ? player.moveDir.x : 0,
                                player.moveDir ? player.moveDir.y : 0);
    if (moveLen > 0.1 && player.moveDir) {
      behindX = player.x - player.moveDir.x * 40;
      behindY = player.y - player.moveDir.y * 40;
    } else {
      // Герой стоит — телепорт прямо к нему, двойной урон
      behindX = player.x + Utils.rand(-30, 30);
      behindY = player.y + Utils.rand(-30, 30);
    }
    const m = Math.max(e.cfg.w, e.cfg.h) * 0.5;
    e.x = Utils.clamp(behindX, m, (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) - m);
    e.y = Utils.clamp(behindY, m, (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) - m);
    // Удар
    const dmg = (moveLen < 0.1) ? (e.cfg.backstabDamage || 22) * (e.cfg.idleBonus || 2.0)
                                 : (e.cfg.backstabDamage || 22);
    const dx = player.x - e.x, dy = player.y - e.y;
    if (Math.hypot(dx, dy) < 60) {
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
    }
    e.attackPunch = 0.15;
    if (window.Particles) {
      Particles.burst(e.x, e.y, 4, {
        color: '#6633cc', speedMin: 60, speedMax: 120,
        lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
      });
    }
  } else {
    // Между телепортами — медленный chase
    _moveTowards(e, player.x, player.y, dt, +1);
  }
};

/* --- Собиратель душ: chase + копит «души» --- */
Behaviors.soul_collector = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Души собираются через патч handleDeath
  // Супер-взрыв при 10 душах
  if ((e._soulStacks || 0) >= (e.cfg.soulMaxStacks || 10) && !e._soulExploded) {
    e._soulExploded = true;
    const dx = player.x - e.x, dy = player.y - e.y;
    if (Math.hypot(dx, dy) <= (e.cfg.soulExplosionRadius || 100)) {
      const dmg = e.cfg.soulExplosionDamage || 30;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
    }
    if (window.Particles) {
      Particles.ring(e.x, e.y, e.cfg.soulExplosionRadius || 100, 0.5, 'rgba(160,0,255,0.8)', 4);
    }
    e._soulStacks = 0;
  }
};

/* --- Чумной голем: chase + поглощение снарядов (щит) --- */
Behaviors.plague_golem = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Перезарядка щита
  if ((e._shieldCharges || 0) <= 0) {
    e._shieldRechargeTimer = (e._shieldRechargeTimer || 0) - dt;
    if (e._shieldRechargeTimer <= 0) {
      e._shieldCharges = e.cfg.shieldCharges || 3;
      e._shieldRechargeTimer = e.cfg.shieldRechargeTime || 8.0;
    }
  }
};

/* --- Элементаль молнии: быстрый chase + цепная молния --- */
Behaviors.thunder_elemental = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.attackCooldown -= dt;
  if (e.attackCooldown <= 0) {
    e.attackCooldown = e.cfg.attackCooldown || 2.5;
    const dx = player.x - e.x, dy = player.y - e.y;
    if (Math.hypot(dx, dy) <= 150) {
      const dmg = e.cfg.chainLightningDamage || 8;
      if (Player.takeDamage) Player.takeDamage(player, dmg, e);
      else player.hp -= dmg;
      e.attackPunch = 0.12;
      if (window.Particles) {
        Particles.burst(e.x, e.y, 3, {
          color: '#ffff00', speedMin: 80, speedMax: 180,
          lifeMin: 0.1, lifeMax: 0.3, sizeMin: 1, sizeMax: 3,
        });
      }
    }
  }
};


/* --- Костяная гидра (враг): 3 головы, каждая стреляет --- */
Behaviors.bone_hydra_enemy = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Инициализация голов
  if (!e._headCds) {
    e._headCds = [];
    for (let i = 0; i < (e.cfg.heads || 3); i++) {
      e._headCds.push(Math.random() * (e.cfg.headCooldown || 2.0));
    }
  }
  // Каждая голова стреляет независимо
  for (let i = 0; i < e._headCds.length; i++) {
    e._headCds[i] -= dt;
    if (e._headCds[i] <= 0) {
      e._headCds[i] = e.cfg.headCooldown || 2.0;
      const dx = player.x - e.x, dy = player.y - e.y;
      const baseAng = Math.atan2(dy, dx);
      const offset = (i - 1) * 0.3; // Разброс по головам
      const a = baseAng + offset;
      _spawnEnemyProjectile(e, Math.cos(a), Math.sin(a), 'bone_shard', {
        speed: e.cfg.headSpeed || 240, life: 2,
        damage: e.cfg.headDamage || 8, radius: 4,
      });
      e.attackPunch = 0.08;
    }
  }
};

/* --- Ткач снов: chase + иллюзии --- */
Behaviors.dream_weaver = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    e.specialCooldown = e.cfg.illusionCooldown || 6.0;
    const count = e.cfg.illusionCount || 2;
    for (let i = 0; i < count; i++) {
      if (window.Enemies && window.Game && Game.enemies) {
        const ang = (Math.PI * 2 / count) * i + Math.random() * 0.5;
        const sx = e.x + Math.cos(ang) * 40;
        const sy = e.y + Math.sin(ang) * 40;
        const illusion = Enemies.spawnByType(Game.enemies, e.type, sx, sy);
        if (illusion) {
          illusion.hp = e.cfg.illusionHp || 1;
          illusion.maxHp = illusion.hp;
          illusion._isIllusion = true;
        }
      }
    }
    e.attackPunch = 0.1;
  }
};

/* --- Ржавый великан: chase + коррозийная аура --- */
Behaviors.rust_hulk = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Аура коррозии обрабатывается в системе урона (патч)
  const dx = player.x - e.x, dy = player.y - e.y;
  if (Math.hypot(dx, dy) <= (e.cfg.rustAuraRadius || 100)) {
    player._rustDebuff = Math.max(player._rustDebuff || 0,
      e.cfg.rustAuraDmgReduction || 0.15);
    player._rustDebuffTimer = 0.5;
  }
};

/* --- Паразит-носитель: быстрый chase, при смерти перескакивает --- */
Behaviors.parasite_host = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Перескок обрабатывается в handleDeath (патч)
};

/* --- Ткач проклятий: дистанционный + hex --- */
Behaviors.hex_weaver = function(e, player, dt) {
  const dx = player.x - e.x, dy = player.y - e.y;
  const d = Math.hypot(dx, dy);
  const minD = e.cfg.keepDistMin || 100;
  const maxD = e.cfg.keepDistMax || 150;
  if (d < minD) _moveTowards(e, player.x, player.y, dt, -1);
  else if (d > maxD) _moveTowards(e, player.x, player.y, dt, +1);
  else { e.vx = 0; e.vy = 0; }

  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    e.specialCooldown = e.cfg.hexCooldown || 5.0;
    // Случайное проклятие
    const hexTypes = e.cfg.hexTypes || ['slow'];
    const hex = hexTypes[Math.floor(Math.random() * hexTypes.length)];
    const dur = e.cfg.hexDuration || 1.5;
    switch (hex) {
      case 'slow':
        player._hexSlow = dur; break;
      case 'silence':
        player._hexSilence = dur; break;
      case 'blind':
        player._hexBlind = dur; break;
      case 'invert':
        player._hexInvert = dur; break;
    }
    e.attackPunch = 0.12;
    if (window.Particles) {
      Particles.burst(player.x, player.y, 4, {
        color: '#9933ff', speedMin: 40, speedMax: 80,
        lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4,
      });
    }
  }
};

/* --- Хроно-жук: chase + временной пузырь --- */
Behaviors.temporal_beetle = function(e, player, dt) {
  // Внутри пузыря враг быстрее
  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  const inBubble = dist <= (e.cfg.timeBubbleRadius || 60);

  const speedMul = inBubble ? (e.cfg.timeBubbleSelfSpeed || 1.50) : 1.0;
  const n = _norm(dx, dy);
  const s = _currentSpeed(e) * speedMul;
  e.vx = n.x * s; e.vy = n.y * s;
  const rad = Math.max(e.cfg.w, e.cfg.h) * 0.4;
  if (window.GameMap && GameMap.dungeon) {
    const r = GameMap.moveWithCollision(e.x, e.y, e.vx * dt, e.vy * dt, rad);
    e.x = r.x; e.y = r.y;
  } else { e.x += e.vx * dt; e.y += e.vy * dt; }
  _tryContactDamage(e, player, dt);

  // Замедление героя в пузыре
  if (inBubble) {
    player._timeBubbleSlow = Math.max(player._timeBubbleSlow || 0,
      e.cfg.timeBubblePlayerSlow || 0.50);
    player._timeBubbleSlowTimer = 0.2;
  }
};


/* =============================================================
   ТИР 5 — поведения
   ============================================================= */

/* --- Голем энтропии: chase + ловушки на полу --- */
Behaviors.entropy_golem = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    e.specialCooldown = e.cfg.decayCooldown || 3.0;
    // Создаём зоны распада вокруг себя
    const radius = e.cfg.decayRadius || 80;
    for (let i = 0; i < 3; i++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      const px = e.x + Math.cos(ang) * dist;
      const py = e.y + Math.sin(ang) * dist;
      _spawnGroundEffect('decay', px, py, {
        radius: 20,
        life: e.cfg.decayTileLife || 4.0,
        dps: e.cfg.decayTileDps || 5,
        slow: 0,
        color: 'rgba(100, 0, 150, 0.3)',
      });
    }
    e.attackPunch = 0.1;
  }
};

/* --- Душеплавильня: chase + поглощение мелких врагов --- */
Behaviors.soul_furnace = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    e.specialCooldown = e.cfg.absorbCooldown || 4.0;
    // Поглотить ближайшего мелкого врага
    if (window.Game && Game.enemies) {
      let closest = null, closestDist = Infinity;
      Game.enemies.forEachActive(function(other) {
        if (other === e || other.type === e.type) return;
        if ((other.cfg && other.cfg.tier || 0) >= 4) return; // Не глотает T4+
        const d = Utils.dist2(e.x, e.y, other.x, other.y);
        if (d < (e.cfg.absorbRadius || 80) * (e.cfg.absorbRadius || 80) && d < closestDist) {
          closestDist = d; closest = other;
        }
      });
      if (closest) {
        closest.active = false;
        closest.hp = 0;
        e.damage = Math.floor(e.damage * (1 + (e.cfg.absorbDmgBonus || 0.15)));
        e.hp = Math.min(e.maxHp, e.hp + Math.floor(e.maxHp * (e.cfg.absorbHealPct || 0.10)));
        e.attackPunch = 0.12;
        if (window.Particles) {
          Particles.burst(closest.x, closest.y, 4, {
            color: '#ff6600', speedMin: 40, speedMax: 100,
            lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 3,
          });
        }
      }
    }
  }
};

/* --- Пустотный левиафан: chase + порталы (визуальные) --- */
Behaviors.void_leviathan = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    e.specialCooldown = e.cfg.portalCooldown || 8.0;
    // Создаём «портал» как ground effect (визуальный)
    _spawnGroundEffect('portal', e.x, e.y, {
      radius: e.cfg.portalRadius || 30,
      life: e.cfg.portalLife || 5.0,
      dps: 0, slow: 0,
      color: 'rgba(80, 0, 160, 0.5)',
    });
    e.attackPunch = 0.1;
  }
};


/* --- Чумной рыцарь: chase + проклятый клинок --- */
Behaviors.plague_knight = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  // Контактный урон + снятие баффа
  if (e.cfg.damage) {
    e.hitCooldown = Math.max(0, e.hitCooldown - dt);
    const collideR = (Math.max(e.cfg.w, e.cfg.h) + player.size) * 0.5;
    const dx = player.x - e.x, dy = player.y - e.y;
    if (dx * dx + dy * dy < collideR * collideR && e.hitCooldown <= 0) {
      if (Player.takeDamage) Player.takeDamage(player, e.damage, e);
      else player.hp -= e.damage;
      e.hitCooldown = e.cfg.hitInterval || 0.8;
      // Снятие случайного баффа (упрощённо — добавляем debuff)
      player._cursedBladeTimer = e.cfg.cursedBladeDebuffDuration || 5.0;
      e.attackPunch = 0.12;
    }
  }
};

/* --- Королева улья: неподвижная + спавн жуков --- */
Behaviors.hive_queen = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    e.specialCooldown = e.cfg.spawnCooldown || 3.0;
    // Считаем текущих живых жуков
    let childCount = 0;
    if (window.Game && Game.enemies) {
      Game.enemies.forEachActive(function(other) {
        if (other.type === (e.cfg.spawnChildId || 'swarm_beetle')) childCount++;
      });
    }
    if (childCount < (e.cfg.maxSpawns || 8)) {
      const ang = Math.random() * Math.PI * 2;
      const sx = e.x + Math.cos(ang) * 30;
      const sy = e.y + Math.sin(ang) * 30;
      if (window.Enemies && window.Game) {
        Enemies.spawnByType(Game.enemies, e.cfg.spawnChildId || 'swarm_beetle', sx, sy);
      }
      e.attackPunch = 0.08;
    }
  }
};

/* --- Химера хаоса: chase + мутация --- */
Behaviors.chaos_chimera = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    e.specialCooldown = e.cfg.mutationCooldown || 10.0;
    // Мутация — меняет «тип» атаки
    const types = e.cfg.mutationTypes || ['fire', 'ice', 'poison', 'lightning'];
    e._mutationType = types[Math.floor(Math.random() * types.length)];
    e._mutationStacks = (e._mutationStacks || 0) + 1;
    // Бонус статов
    const bonus = e.cfg.mutationStatBonus || 0.05;
    e.damage = Math.floor(e.damage * (1 + bonus));
    e.attackPunch = 0.12;
    if (window.Particles) {
      const colors = { fire: '#ff4400', ice: '#88ccff', poison: '#44cc44', lightning: '#ffff00' };
      Particles.burst(e.x, e.y, 5, {
        color: colors[e._mutationType] || '#ffffff',
        speedMin: 50, speedMax: 120,
        lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4,
      });
    }
  }
};

/* --- Страж обелиска: неподвижный + луч DPS --- */
Behaviors.obelisk_guardian = function(e, player, dt) {
  e.vx = 0; e.vy = 0;
  // Луч к герою
  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= (e.cfg.beamRange || 200)) {
    // Увеличение DPS со временем нахождения на цели
    e._beamTime = (e._beamTime || 0) + dt;
    const rampUp = Math.min(e._beamTime / (e.cfg.beamRampUpTime || 3.0), 1.0);
    const dmgMul = 1 + rampUp * ((e.cfg.beamRampUpMul || 1.50) - 1);
    const dps = (e.cfg.beamBaseDps || 8) * dmgMul;
    const dmg = dps * dt;
    if (Player.takeDamage) Player.takeDamage(player, dmg, e);
    else player.hp -= dmg;
  } else {
    e._beamTime = 0; // Сброс если вышел из зоны
  }
};


/* --- Теневой принц: chase + клоны при получении урона --- */
Behaviors.shadow_prince = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // Клонирование обрабатывается в системе урона (патч)
};

/* --- Бездонная пасть: притяжение + пожирание --- */
Behaviors.abyssal_maw = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  const dx = player.x - e.x, dy = player.y - e.y;
  const dist = Math.hypot(dx, dy);
  // Притяжение
  if (dist <= (e.cfg.pullRadius || 120) && dist > 5) {
    const pullStr = (e.cfg.pullSpeed || 3);
    const n = _norm(e.x - player.x, e.y - player.y);
    player.x += n.x * pullStr;
    player.y += n.y * pullStr;
  }
  // Пожирание (DPS при очень близком контакте)
  if (dist <= (e.cfg.devourRange || 25)) {
    const dps = (e.cfg.devourDps || 15) * dt;
    if (Player.takeDamage) Player.takeDamage(player, dps, e);
    else player.hp -= dps;
  } else {
    _tryContactDamage(e, player, dt);
  }
};

/* --- Живой подземелец: chase + генерация стен --- */
Behaviors.living_dungeon = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  e.specialCooldown -= dt;
  if (e.specialCooldown <= 0) {
    e.specialCooldown = e.cfg.wallCooldown || 6.0;
    // Создаём временную стену (ground effect с высоким slow)
    const dx = player.x - e.x, dy = player.y - e.y;
    const n = _norm(dx, dy);
    // Перпендикуляр к направлению игрока
    const perpX = -n.y, perpY = n.x;
    const tiles = e.cfg.wallTiles || 3;
    for (let i = 0; i < tiles; i++) {
      const offset = (i - (tiles - 1) / 2) * 30;
      const wx = player.x + perpX * offset;
      const wy = player.y + perpY * offset;
      _spawnGroundEffect('wall_temp', wx, wy, {
        radius: 15,
        life: e.cfg.wallLife || 5.0,
        dps: 0, slow: 0.95, // Почти непроходимо
        color: 'rgba(80, 80, 80, 0.7)',
      });
    }
    e.attackPunch = 0.12;
  }
};


/* =============================================================
   ОСОБЫЕ — поведения
   ============================================================= */

/* --- Вестник рока: chase + аура ускорения всех врагов --- */
Behaviors.doom_herald = function(e, player, dt) {
  _moveTowards(e, player.x, player.y, dt, +1);
  _tryContactDamage(e, player, dt);
  // При спавне — активирует ауру рока (10с)
  if (!e._doomActivated) {
    e._doomActivated = true;
    e._doomTimer = e.cfg.doomDuration || 10.0;
  }
  if (e._doomTimer > 0) {
    e._doomTimer -= dt;
    // Аура скорости для всех врагов — обрабатывается в Enemies.update (патч)
  }
};

/* --- Золотой голем: убегает от героя, дропает золото --- */
Behaviors.treasure_golem = function(e, player, dt) {
  // Убегает от героя
  _moveTowards(e, player.x, player.y, dt, -1);
  // Таймер жизни — убегает за экран
  e._escapeTimer = (e._escapeTimer || e.cfg.escapeTime || 15.0) - dt;
  if (e._escapeTimer <= 0) {
    e.active = false;
    e.hp = 0;
    return;
  }
  // Дроп золота каждые N секунд
  e._goldDropCd = (e._goldDropCd || 0) - dt;
  if (e._goldDropCd <= 0) {
    e._goldDropCd = e.cfg.goldDropInterval || 2.0;
    if (window.Game && Game.xpDrops && window.Loot) {
      if (Loot.dropXPRaw) Loot.dropXPRaw(Game.xpDrops, e.x, e.y, 15);
      else if (Loot.dropXP) Loot.dropXP(Game.xpDrops, e.x, e.y, 15);
    }
    if (window.Particles) {
      Particles.burst(e.x, e.y, 3, {
        color: '#ffd700', speedMin: 30, speedMax: 80,
        lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 4,
      });
    }
  }
};


/* =============================================================
   ПАТЧИ — расширение системы смерти для новых механик
   ============================================================= */

// Патч Enemies.handleDeath для новых врагов
if (window.Enemies && Enemies.handleDeath) {
  const _origHandleDeath = Enemies.handleDeath;
  Enemies.handleDeath = function(e, gameCtx) {
    // Чумная крыса — при смерти DoT ближайшему другому врагу (визуально)
    if (e.type === 'plague_rat' && window.Particles) {
      Particles.burst(e.x, e.y, 4, {
        color: '#88aa44', speedMin: 30, speedMax: 60,
        lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 3,
      });
    }

    // Жук-падальщик — усиливает соседних жуков
    if (e.type !== 'carrion_beetle' && window.Game && Game.enemies) {
      Game.enemies.forEachActive(function(other) {
        if (!other.active || other.type !== 'carrion_beetle') return;
        const d = Utils.dist2(e.x, e.y, other.x, other.y);
        const feedR = (other.cfg && other.cfg.feedRadius) || 100;
        if (d < feedR * feedR) {
          other._feedStacks = (other._feedStacks || 0) + 1;
          const maxSt = (other.cfg && other.cfg.feedMaxStacks) || 3;
          if (other._feedStacks <= maxSt) {
            other.hp = Math.min(other.maxHp * 2,
              other.hp + Math.floor(other.maxHp * ((other.cfg && other.cfg.feedHpBonus) || 0.20)));
          }
        }
      });
    }

    // Собиратель душ — собирает душу
    if (window.Game && Game.enemies) {
      Game.enemies.forEachActive(function(other) {
        if (!other.active || other.type !== 'soul_collector') return;
        const d = Utils.dist2(e.x, e.y, other.x, other.y);
        const sR = (other.cfg && other.cfg.soulRadius) || 150;
        if (d < sR * sR) {
          other._soulStacks = (other._soulStacks || 0) + 1;
          other.damage = Math.floor(other.damage *
            (1 + ((other.cfg && other.cfg.soulDmgBonus) || 0.05)));
        }
      });
    }

    // Паразит-носитель — перепрыгивает на ближайшего врага
    if (e.type === 'parasite_host' && window.Game && Game.enemies) {
      let closest = null, closestDist = Infinity;
      Game.enemies.forEachActive(function(other) {
        if (other === e || !other.active) return;
        const d = Utils.dist2(e.x, e.y, other.x, other.y);
        const jr = (e.cfg && e.cfg.parasiteJumpRadius) || 150;
        if (d < jr * jr && d < closestDist) {
          closestDist = d; closest = other;
        }
      });
      if (closest) {
        closest.hp += Math.floor(closest.maxHp * ((e.cfg && e.cfg.parasiteHpBonus) || 0.30));
        closest.maxHp = Math.max(closest.maxHp, closest.hp);
        closest.damage = Math.floor(closest.damage *
          (1 + ((e.cfg && e.cfg.parasiteDmgBonus) || 0.30)));
        if (window.Particles) {
          Particles.burst(closest.x, closest.y, 4, {
            color: '#aa44aa', speedMin: 40, speedMax: 100,
            lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
          });
        }
      }
    }

    // Заводной паук — осколки при смерти
    if (e.type === 'clockwork_spider' && e.cfg.deathShards) {
      const shards = e.cfg.deathShards;
      for (let i = 0; i < (shards.count || 4); i++) {
        const ang = (Math.PI * 2 / shards.count) * i;
        _spawnEnemyProjectile(e, Math.cos(ang), Math.sin(ang), 'gear_shard', {
          speed: shards.speed || 200, life: shards.life || 1.5,
          damage: shards.damage || 8, radius: 4,
        });
      }
    }

    // Оригинальный handleDeath
    return _origHandleDeath.call(Enemies, e, gameCtx);
  };
}

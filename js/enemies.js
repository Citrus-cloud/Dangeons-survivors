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
  // Шаг 3 (анимации): «dusting» — рассыпание в пыль при смерти
  Particles.enemyDust(e.x, e.y, color);
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
function _currentSpeed(e) {
  const base = (e.cfg && e.cfg.speed) || 0;
  let s = base;
  if (e.captainBuffed) s *= (ENEMY_TYPES.captain.auraSpeedMul || 1.20);
  if (e.dashing) s *= (e.cfg.dashMul || 2.0);
  // Шаг 7: замедление от ледяной стрелы и т.п.
  if (e._slowFactor && e._slowTimer > 0) s *= (1 - e._slowFactor);
  // Шаг 8: аура холода
  if (e.frostSlow && e.frostSlowTimer > 0) s *= (1 - e.frostSlow);
  return s;
}

/* Двинуть к/от точке (px-shift в этом кадре). */
function _moveTowards(e, tx, ty, dt, sign) {
  const n = _norm(tx - e.x, ty - e.y);
  const s = _currentSpeed(e) * (sign || 1);
  e.vx = n.x * s;
  e.vy = n.y * s;
  let dx = e.vx * dt;
  let dy = e.vy * dt;
  const rad = Math.max(e.cfg.w, e.cfg.h) * 0.4;
  // Движение с учётом стен/колонн (если подземелье сгенерировано)
  if (window.GameMap && GameMap.dungeon) {
    const res = GameMap.moveWithCollision(e.x, e.y, dx, dy, rad);
    // Обход препятствия: если упёрлись в одну ось, сместимся вдоль другой
    let blockedAny = res.blockedX || res.blockedY;
    if (blockedAny && (Math.abs(res.x - e.x) < Math.abs(dx) * 0.2) &&
        (Math.abs(res.y - e.y) < Math.abs(dy) * 0.2)) {
      // Тупик — выберем перпендикулярное направление
      const perpX = -n.y, perpY = n.x;
      const slide = (e._slideSign = e._slideSign || 1);
      const sx = perpX * Math.abs(s) * dt * slide;
      const sy = perpY * Math.abs(s) * dt * slide;
      const res2 = GameMap.moveWithCollision(e.x, e.y, sx, sy, rad);
      e.x = res2.x; e.y = res2.y;
      // Если и тут не получилось — поменяем знак
      if (res2.blockedX && res2.blockedY) e._slideSign = -slide;
    } else {
      e.x = res.x;
      e.y = res.y;
    }
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
    const rad = Math.max(e.cfg.w, e.cfg.h) * 0.4;
    if (window.GameMap && GameMap.dungeon) {
      const r = GameMap.moveWithCollision(e.x, e.y, mx, my, rad);
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
      e.flash = Math.max(0, e.flash - dt);
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
     Render — пиксельные спрайты (sprites.js)
     ============================================================ */
  render(ctx, pool, cam, viewW, viewH) {
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    const items = pool.items;
    const hasSprites = !!(window.getEnemySprite);

    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active || !e.cfg) continue;
      const cfg = e.cfg;
      const w = cfg.w, h = cfg.h;
      const halfMaxR = Math.max(w, h);
      if (e.x + halfMaxR < minX || e.x - halfMaxR > maxX ||
          e.y + halfMaxR < minY || e.y - halfMaxR > maxY) continue;

      // Покачивание (по высоте) — всегда ±1px синусоида для оживления
      const bobAmount = cfg.wobble || 1;
      const renderY = e.y + Math.sin(e.bobPhase) * bobAmount;
      const renderX = e.x;

      // Пульсация атаки: до +20% размера в течение 0.1 сек
      const punch = e.attackPunch > 0 ? 1 + 0.20 * (e.attackPunch / 0.10) : 1;

      // Прозрачность (мерцание — теневой убийца, призраки)
      let prevAlpha = ctx.globalAlpha;
      if (cfg.behavior === 'shadow') {
        ctx.globalAlpha = e.invisible ? 0.20 : 1.0;
      } else if (cfg.behavior === 'ghost' || cfg.id === 'ghost') {
        ctx.globalAlpha = 0.7;
      }

      // Размер спрайта на экране
      const spriteSize = (window.getSpriteDisplaySize ? getSpriteDisplaySize(e.type) : Math.max(w, h)) * punch;

      // Получаем спрайт
      const sprite = hasSprites ? getEnemySprite(e.type) : null;

      if (sprite) {
        // Мимик в idle — рисуем спрайт сундука с подсветкой
        if (cfg.behavior === 'mimic' && !e.activated) {
          ctx.shadowColor = 'rgba(255, 215, 80, 0.7)';
          ctx.shadowBlur = 10;
          ctx.drawImage(sprite, renderX - spriteSize / 2, renderY - spriteSize / 2, spriteSize, spriteSize);
          ctx.shadowBlur = 0;
          ctx.globalAlpha = prevAlpha;
          continue;
        }

        // Аура капитана (до спрайта)
        if (cfg.behavior === 'captain') {
          ctx.fillStyle = 'rgba(255, 215, 0, 0.18)';
          ctx.beginPath();
          ctx.arc(renderX, renderY, cfg.auraRadius || 100, 0, Math.PI * 2);
          ctx.fill();
        }

        // Мерцание при попадании — белый оверлей
        if (e.flash > 0) {
          ctx.drawImage(sprite, renderX - spriteSize / 2, renderY - spriteSize / 2, spriteSize, spriteSize);
          // Белая вспышка: рисуем белый прямоугольник с пониженной непрозрачностью
          const prevA = ctx.globalAlpha;
          ctx.globalAlpha = 0.7;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(renderX - spriteSize / 2, renderY - spriteSize / 2, spriteSize, spriteSize);
          ctx.globalAlpha = prevA;
        } else {
          // Обычная отрисовка спрайта
          ctx.drawImage(sprite, renderX - spriteSize / 2, renderY - spriteSize / 2, spriteSize, spriteSize);
        }

        // Золотая обводка для элитных (captainBuffed)
        if (e.captainBuffed) {
          ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)';
          ctx.lineWidth = 1;
          ctx.strokeRect(renderX - spriteSize / 2 - 1, renderY - spriteSize / 2 - 1, spriteSize + 2, spriteSize + 2);
        }

      } else {
        // Fallback: минимальный цветной квадрат (если спрайта нет — не должно происходить)
        const drawW = w * punch, drawH = h * punch;
        const fillColor = e.flash > 0 ? '#ffffff' : (cfg.color || '#888');
        ctx.fillStyle = fillColor;
        ctx.fillRect(renderX - drawW / 2, renderY - drawH / 2, drawW, drawH);
      }

      // HP-бар (всегда показываем при повреждении)
      if (e.hp < e.maxHp) {
        const barW = spriteSize || w, barH = 3;
        const barY = renderY - (spriteSize || h) / 2 - 6;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(renderX - barW / 2, barY, barW, barH);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(renderX - barW / 2, barY, barW * (e.hp / e.maxHp), barH);
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

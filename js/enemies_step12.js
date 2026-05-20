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
      // Отбрасывание
      const kn = _norm(dx, dy);
      const kb = e.cfg.gustKnockback || 60;
      if (window.GameMap && GameMap.moveWithCollision) {
        const r = GameMap.moveWithCollision(player.x, player.y, kn.x * kb, kn.y * kb, player.size * 0.35, 0.25);
        player.x = r.x; player.y = r.y;
      } else { player.x += kn.x * kb; player.y += kn.y * kb; }
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
      const kn = _norm(pdx, pdy);
      const _kb2 = ts.knockback || 60;
      if (window.GameMap && GameMap.moveWithCollision) {
        const r = GameMap.moveWithCollision(player.x, player.y, kn.x * _kb2, kn.y * _kb2, player.size * 0.35, 0.25);
        player.x = r.x; player.y = r.y;
      } else { player.x += kn.x * _kb2; player.y += kn.y * _kb2; }
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

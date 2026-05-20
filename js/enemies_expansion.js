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

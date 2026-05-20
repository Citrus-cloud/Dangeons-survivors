'use strict';
/* ============================================================
   bosses_expansion.js — 5 новых мини-боссов (Expansion).
   Патчит Bosses._updateBoss для диспетчеризации новых боссов.
   Загружается ПОСЛЕ bosses.js и constants_expansion.js.
   ============================================================ */

/* =============================================================
   Патч диспетчера — добавляем новых боссов в switch
   ============================================================= */
(function() {
  const _origUpdateBoss = Bosses._updateBoss;
  Bosses._updateBoss = function(boss, player, dt) {
    if (boss.spawnAnim > 0) { boss.spawnAnim -= dt; return; }

    // Общие таймеры (копируем из оригинала)
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

    // Проверяем новых боссов
    switch (boss.id) {
      case 'boss_web_architect':   Bosses._updateWebArchitect(boss, player, dt); break;
      case 'boss_storm_colossus':  Bosses._updateStormColossus(boss, player, dt); break;
      case 'boss_puzzle_sphinx':   Bosses._updatePuzzleSphinx(boss, player, dt); break;
      case 'boss_bone_hydra':      Bosses._updateBoneHydra(boss, player, dt); break;
      case 'boss_mirror_king':     Bosses._updateMirrorKing(boss, player, dt); break;
      default:
        // Делегируем оригинальному обработчику
        return _origUpdateBoss.call(Bosses, boss, player, dt);
    }

    // Контактный урон
    Bosses._tryContactDamage(boss, player, dt);
  };
})();


/* =============================================================
   БОСС 1: Архитектор Паутины (boss_web_architect)
   Фаза 1: паутинные стены + рикошетные снаряды
   Фаза 2: сжимающаяся арена + гарпун + спавн пауков
   ============================================================= */
Bosses._updateWebArchitect = function(boss, player, dt) {
  const cfg = boss.cfg;
  const atk = cfg.attacks;
  const phase2 = boss.phase >= 2;
  const cdMul = phase2 ? (cfg.phase2CdMul || 0.70) : 1.0;

  // Движение к герою
  Bosses._moveTowards(boss, player.x, player.y, dt, 1);

  // Кулдауны
  boss._webWallCd = Math.max(0, (boss._webWallCd || 0) - dt);
  boss._ricochetCd = Math.max(0, (boss._ricochetCd || 0) - dt);
  boss._harpoonCd = Math.max(0, (boss._harpoonCd || 0) - dt);
  boss._shrinkCd = Math.max(0, (boss._shrinkCd || 0) - dt);

  const dx = player.x - boss.x, dy = player.y - boss.y;
  const dist = Math.hypot(dx, dy);

  // Атака: рикошетный снаряд
  if (boss._ricochetCd <= 0) {
    boss._ricochetCd = atk.ricochetBolt.cooldown * cdMul;
    const n = Utils.norm(dx, dy);
    if (window.Game && Game.projectiles) {
      const p = Game.projectiles.spawn();
      if (p) {
        p.kind = 'boss_ricochet';
        p.owner = 'enemy';
        p.x = boss.x; p.y = boss.y;
        p.vx = n.x * atk.ricochetBolt.speed;
        p.vy = n.y * atk.ricochetBolt.speed;
        p.life = 3.0;
        p.damage = atk.ricochetBolt.damage * boss.difficultyMul;
        p.radius = 6;
        p.angle = Math.atan2(n.y, n.x);
        p._bounces = atk.ricochetBolt.bounces || 2;
        p.source = boss.id;
      }
    }
    boss.slashAnim = 0.2;
  }

  // Атака: паутинные стены (ground effects с высоким замедлением)
  if (boss._webWallCd <= 0) {
    boss._webWallCd = atk.webWall.cooldown * cdMul;
    const wallCount = phase2 ? atk.webWall.count + 2 : atk.webWall.count;
    for (let i = 0; i < wallCount; i++) {
      const ang = (Math.PI * 2 / wallCount) * i + Math.random() * 0.5;
      const wallDist = Utils.rand(80, 160);
      const wx = boss.x + Math.cos(ang) * wallDist;
      const wy = boss.y + Math.sin(ang) * wallDist;
      if (window.GameMap && typeof GameMap.spawnGroundEffect === 'function') {
        GameMap.spawnGroundEffect('web_wall', wx, wy, {
          radius: 30, life: atk.webWall.wallLife || 8.0,
          slow: 0.80, dps: 0,
          color: 'rgba(200, 200, 220, 0.6)',
        });
      }
    }
    if (window.Particles) {
      Particles.ring(boss.x, boss.y, 100, 0.3, 'rgba(200,200,255,0.6)', 3);
    }
  }

  // Фаза 2: гарпун (притягивает героя)
  if (phase2 && boss._harpoonCd <= 0 && dist > 80) {
    boss._harpoonCd = atk.harpoon.cooldown * cdMul;
    // Притягивание
    const n = Utils.norm(boss.x - player.x, boss.y - player.y);
    const pullDist = Math.min(dist * 0.5, 100);
    player.x += n.x * pullDist;
    player.y += n.y * pullDist;
    const dmg = atk.harpoon.damage * boss.difficultyMul;
    if (Player.takeDamage) Player.takeDamage(player, dmg, boss);
    else player.hp -= dmg;
    if (window.Particles) {
      Particles.burst(player.x, player.y, 4, {
        color: '#ccccff', speedMin: 40, speedMax: 100,
        lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4,
      });
    }
  }

  // Фаза 2: призыв пауков (однократно)
  if (phase2 && !boss._spidersSpawned) {
    boss._spidersSpawned = true;
    Bosses._summonMinions(boss, atk.summonSpiders.childId, atk.summonSpiders.count);
  }
};


/* =============================================================
   БОСС 2: Грозовой Колосс (boss_storm_colossus)
   Фаза 1: уязвимое ядро + цепные молнии + удары грома
   Фаза 2: открытый хитбокс + грозовая ярость + линии молний
   ============================================================= */
Bosses._updateStormColossus = function(boss, player, dt) {
  const cfg = boss.cfg;
  const atk = cfg.attacks;
  const phase2 = boss.phase >= 2;

  // Движение
  const speedMul = phase2 ? (cfg.phase2SpeedMul || 1.50) : 1.0;
  Bosses._moveTowards(boss, player.x, player.y, dt, 1);

  // Кулдауны
  boss._chainCd = Math.max(0, (boss._chainCd || 0) - dt);
  boss._thunderCd = Math.max(0, (boss._thunderCd || 0) - dt);
  boss._lineCd = Math.max(0, (boss._lineCd || 0) - dt);
  boss._teleportCd = Math.max(0, (boss._teleportCd || 0) - dt);

  const dx = player.x - boss.x, dy = player.y - boss.y;
  const dist = Math.hypot(dx, dy);

  // Фаза 2: постоянный DPS вокруг себя
  if (phase2 && dist <= (atk.aoeStorm.radius || 60)) {
    const dps = (atk.aoeStorm.dps || 8) * boss.difficultyMul * dt;
    if (Player.takeDamage) Player.takeDamage(player, dps, boss);
    else player.hp -= dps;
  }

  // Атака: цепная молния
  if (boss._chainCd <= 0) {
    boss._chainCd = atk.chainLightning.cooldown * (phase2 ? 0.7 : 1.0);
    if (dist <= 200) {
      const dmg = atk.chainLightning.damage * boss.difficultyMul;
      if (Player.takeDamage) Player.takeDamage(player, dmg, boss);
      else player.hp -= dmg;
      boss.slashAnim = 0.2;
      if (window.Particles) {
        Particles.burst(player.x, player.y, 5, {
          color: '#88ccff', speedMin: 80, speedMax: 180,
          lifeMin: 0.1, lifeMax: 0.3, sizeMin: 1, sizeMax: 3,
        });
      }
    }
  }

  // Атака: удар грома (AoE с задержкой — упрощённо: мгновенный)
  if (boss._thunderCd <= 0) {
    boss._thunderCd = atk.thunderStrike.cooldown * (phase2 ? 0.6 : 1.0);
    // Зона предупреждения (через ground effect)
    if (window.GameMap && typeof GameMap.spawnGroundEffect === 'function') {
      GameMap.spawnGroundEffect('lightning_zone', player.x, player.y, {
        radius: atk.thunderStrike.radius || 70,
        life: 1.8,
        dps: 0, slow: 0,
        color: 'rgba(136, 200, 255, 0.3)',
        _thunderDamage: atk.thunderStrike.damage * boss.difficultyMul,
        _thunderDelay: atk.thunderStrike.delay || 1.5,
      });
    }
    // Урон наносится с задержкой (упрощённо — через таймер)
    boss._thunderTarget = { x: player.x, y: player.y, timer: atk.thunderStrike.delay || 1.5,
      damage: atk.thunderStrike.damage * boss.difficultyMul, radius: atk.thunderStrike.radius || 70 };
  }

  // Обработка отложенного удара
  if (boss._thunderTarget) {
    boss._thunderTarget.timer -= dt;
    if (boss._thunderTarget.timer <= 0) {
      const t = boss._thunderTarget;
      const tdx = player.x - t.x, tdy = player.y - t.y;
      if (Math.hypot(tdx, tdy) <= t.radius) {
        if (Player.takeDamage) Player.takeDamage(player, t.damage, boss);
        else player.hp -= t.damage;
      }
      if (window.Particles) {
        Particles.ring(t.x, t.y, t.radius, 0.3, 'rgba(100, 180, 255, 0.9)', 4);
      }
      boss._thunderTarget = null;
    }
  }

  // Фаза 2: линии молний между точками
  if (phase2 && boss._lineCd <= 0) {
    boss._lineCd = atk.lightningLine.cooldown;
    // Создаём линейную зону (ground effect)
    const lineAng = Math.random() * Math.PI * 2;
    if (window.GameMap && typeof GameMap.spawnGroundEffect === 'function') {
      for (let i = 0; i < 5; i++) {
        const lx = boss.x + Math.cos(lineAng) * (i * 40 - 80);
        const ly = boss.y + Math.sin(lineAng) * (i * 40 - 80);
        GameMap.spawnGroundEffect('lightning_line', lx, ly, {
          radius: 12, life: atk.lightningLine.duration || 2.0,
          dps: atk.lightningLine.damage * boss.difficultyMul * 0.5,
          slow: 0,
          color: 'rgba(136, 200, 255, 0.5)',
        });
      }
    }
  }

  // Фаза 2: телепортация к герою
  if (phase2 && boss._teleportCd <= 0 && dist > 150) {
    boss._teleportCd = 5.0;
    const m = Math.max(cfg.w, cfg.h) * 0.5;
    const ang = Math.random() * Math.PI * 2;
    let tx = player.x + Math.cos(ang) * 80;
    let ty = player.y + Math.sin(ang) * 80;
    tx = Utils.clamp(tx, m, (window.GameMap ? GameMap.mapW : CONFIG.MAP.W) - m);
    ty = Utils.clamp(ty, m, (window.GameMap ? GameMap.mapH : CONFIG.MAP.H) - m);
    boss.x = tx; boss.y = ty;
    if (window.Particles) {
      Particles.burst(boss.x, boss.y, 6, {
        color: '#88ccff', speedMin: 80, speedMax: 180,
        lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 5,
      });
    }
  }
};


/* =============================================================
   БОСС 3: Сфинкс-Головоломщик (boss_puzzle_sphinx)
   Фаза 1: загадки символов + луч из глаз (неуязвим пока загадка)
   Фаза 2: 2 руны в порядке + каменные столбы
   Фаза 3: ярость, уязвим постоянно, комбо-атаки
   ============================================================= */
Bosses._updatePuzzleSphinx = function(boss, player, dt) {
  const cfg = boss.cfg;
  const atk = cfg.attacks;
  const phase3 = boss.phase >= 3;
  const phase2 = boss.phase >= 2;

  // Движение
  Bosses._moveTowards(boss, player.x, player.y, dt, 1);

  // Кулдауны
  boss._beamCd = Math.max(0, (boss._beamCd || 0) - dt);
  boss._pillarCd = Math.max(0, (boss._pillarCd || 0) - dt);
  boss._puzzleCd = Math.max(0, (boss._puzzleCd || 0) - dt);

  const dx = player.x - boss.x, dy = player.y - boss.y;
  const dist = Math.hypot(dx, dy);

  // Фаза 3: постоянная уязвимость, ярость
  if (phase3) {
    boss._sphinxInvuln = false;
    // Комбо-атаки: луч + столбы быстрее
    if (boss._beamCd <= 0) {
      boss._beamCd = atk.eyeBeam.cooldown * (cfg.phase3CdMul || 0.50);
      const n = Utils.norm(dx, dy);
      if (window.Game && Game.projectiles) {
        const p = Game.projectiles.spawn();
        if (p) {
          p.kind = 'boss_eye_beam'; p.owner = 'enemy';
          p.x = boss.x; p.y = boss.y;
          p.vx = n.x * atk.eyeBeam.speed; p.vy = n.y * atk.eyeBeam.speed;
          p.life = 2.5; p.damage = atk.eyeBeam.damage * boss.difficultyMul;
          p.radius = 8; p.angle = Math.atan2(n.y, n.x); p.source = boss.id;
        }
      }
      boss.slashAnim = 0.15;
    }
    if (boss._pillarCd <= 0) {
      boss._pillarCd = atk.stonePillar.cooldown * (cfg.phase3CdMul || 0.50);
      Bosses._sphinxSpawnPillars(boss, player, atk);
    }
    return;
  }

  // Фазы 1-2: система загадок (неуязвимость)
  if (boss._puzzleCd <= 0 && !boss._puzzleActive) {
    boss._puzzleActive = true;
    boss._puzzleTimer = atk.puzzleWindow || 3.0;
    boss._sphinxInvuln = true;
    // Генерируем «правильную руну» (упрощённо: случайная из 4)
    boss._correctRune = Math.floor(Math.random() * (atk.runeCount || 4));
    if (phase2) {
      boss._correctRune2 = Math.floor(Math.random() * (atk.runeCount || 4));
      while (boss._correctRune2 === boss._correctRune) {
        boss._correctRune2 = Math.floor(Math.random() * (atk.runeCount || 4));
      }
    }
  }

  if (boss._puzzleActive) {
    boss._puzzleTimer -= dt;
    boss._sphinxInvuln = true;
    // Проверка: герой должен подойти к правильной «руне»
    // Упрощённая механика: если герой в определённой зоне, загадка решена
    // Руны размещены по 4 углам вокруг босса
    const runeAngles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
    const runeR = 100;
    const correctAng = runeAngles[boss._correctRune];
    const runeX = boss.x + Math.cos(correctAng) * runeR;
    const runeY = boss.y + Math.sin(correctAng) * runeR;
    const playerToRune = Math.hypot(player.x - runeX, player.y - runeY);

    if (playerToRune < 35) {
      // Загадка решена!
      boss._puzzleActive = false;
      boss._sphinxInvuln = false;
      boss._vulnTimer = atk.vulnDuration || 5.0;
      boss._puzzleCd = atk.puzzleInterval || 15.0;
      if (window.Particles) {
        Particles.ring(boss.x, boss.y, 60, 0.3, 'rgba(0, 255, 100, 0.8)', 3);
        Particles.text(boss.x, boss.y - 40, 'УЯЗВИМ!', 1.5, '#00ff66', 16);
      }
    } else if (boss._puzzleTimer <= 0) {
      // Время вышло — AoE штраф
      boss._puzzleActive = false;
      boss._sphinxInvuln = false;
      boss._puzzleCd = atk.puzzleInterval || 15.0;
      const dmg = atk.arenaBlast.damage * boss.difficultyMul;
      if (Player.takeDamage) Player.takeDamage(player, dmg, boss);
      else player.hp -= dmg;
      if (window.Particles) {
        Particles.ring(boss.x, boss.y, 150, 0.5, 'rgba(255, 100, 0, 0.8)', 5);
        Particles.text(boss.x, boss.y - 40, 'НЕВЕРНО!', 1.5, '#ff3300', 16);
      }
    }
  }

  // Окно уязвимости
  if (boss._vulnTimer > 0) {
    boss._vulnTimer -= dt;
    boss._sphinxInvuln = false;
  } else if (!boss._puzzleActive) {
    boss._sphinxInvuln = true;
  }

  // Атака: луч из глаз (между загадками)
  if (!boss._puzzleActive && boss._beamCd <= 0) {
    boss._beamCd = atk.eyeBeam.cooldown;
    const n = Utils.norm(dx, dy);
    if (window.Game && Game.projectiles) {
      const p = Game.projectiles.spawn();
      if (p) {
        p.kind = 'boss_eye_beam'; p.owner = 'enemy';
        p.x = boss.x; p.y = boss.y;
        p.vx = n.x * atk.eyeBeam.speed; p.vy = n.y * atk.eyeBeam.speed;
        p.life = 2.5; p.damage = atk.eyeBeam.damage * boss.difficultyMul;
        p.radius = 8; p.angle = Math.atan2(n.y, n.x); p.source = boss.id;
      }
    }
  }

  // Фаза 2+: каменные столбы
  if (phase2 && boss._pillarCd <= 0) {
    boss._pillarCd = atk.stonePillar.cooldown;
    Bosses._sphinxSpawnPillars(boss, player, atk);
  }
};

// Вспомогательная: столбы из пола
Bosses._sphinxSpawnPillars = function(boss, player, atk) {
  const count = atk.stonePillar.count || 3;
  for (let i = 0; i < count; i++) {
    const px = player.x + Utils.rand(-60, 60);
    const py = player.y + Utils.rand(-60, 60);
    if (window.GameMap && typeof GameMap.spawnGroundEffect === 'function') {
      GameMap.spawnGroundEffect('stone_pillar', px, py, {
        radius: atk.stonePillar.radius || 30,
        life: 1.5,
        dps: atk.stonePillar.damage * boss.difficultyMul,
        slow: 0,
        color: 'rgba(180, 160, 100, 0.5)',
      });
    }
  }
  if (window.Particles) {
    Particles.burst(player.x, player.y, 4, {
      color: '#c9a84c', speedMin: 40, speedMax: 100,
      lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4,
    });
  }
};


/* =============================================================
   БОСС 4: Костяная Гидра (boss_bone_hydra)
   Фаза 1: 5 голов стреляют независимо, стоит на месте
   Фаза 2: головы регенерируют, тело двигается, комбо-атаки
   ============================================================= */
Bosses._updateBoneHydra = function(boss, player, dt) {
  const cfg = boss.cfg;
  const atk = cfg.attacks;
  const phase2 = boss.phase >= 2;

  // Инициализация голов
  if (!boss._heads) {
    boss._heads = [];
    for (let i = 0; i < (cfg.headCount || 5); i++) {
      boss._heads.push({
        alive: true, cd: Math.random() * 2, regenTimer: 0, dmgBonus: 0,
      });
    }
    boss._comboCd = atk.comboAttack.cooldown || 10.0;
  }

  // Фаза 2: двигается к герою
  if (phase2) {
    Bosses._moveTowards(boss, player.x, player.y, dt, 1);
  }

  const dx = player.x - boss.x, dy = player.y - boss.y;
  const dist = Math.hypot(dx, dy);
  const n = Utils.norm(dx, dy);

  // Обновляем головы
  const headAttacks = [atk.fireHead, atk.iceHead, atk.poisonHead, atk.lightningHead, atk.darkHead];
  const headKinds = ['boss_fire_bolt', 'boss_ice_bolt', 'boss_poison_bolt', 'boss_lightning_bolt', 'boss_dark_bolt'];

  for (let i = 0; i < boss._heads.length; i++) {
    const head = boss._heads[i];
    if (!head.alive) {
      // Регенерация (только в фазе 2)
      if (phase2) {
        head.regenTimer -= dt;
        if (head.regenTimer <= 0) {
          head.alive = true;
          head.dmgBonus += cfg.headRegenDmgBonus || 0.20;
          if (window.Particles) {
            Particles.burst(boss.x, boss.y, 3, {
              color: '#ffffff', speedMin: 40, speedMax: 80,
              lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 3,
            });
          }
        }
      }
      continue;
    }

    // Стрельба каждой живой головой
    head.cd -= dt;
    if (head.cd <= 0 && i < headAttacks.length) {
      const ha = headAttacks[i];
      head.cd = ha.cooldown * (phase2 ? 0.8 : 1.0);
      const baseAng = Math.atan2(dy, dx);
      const offset = (i - 2) * 0.2; // Разброс голов
      const a = baseAng + offset;
      if (window.Game && Game.projectiles) {
        const p = Game.projectiles.spawn();
        if (p) {
          p.kind = headKinds[i] || 'boss_bolt';
          p.owner = 'enemy';
          p.x = boss.x + Math.cos(a) * 20;
          p.y = boss.y + Math.sin(a) * 20;
          p.vx = Math.cos(a) * (ha.speed || 240);
          p.vy = Math.sin(a) * (ha.speed || 240);
          p.life = 2.5;
          p.damage = (ha.damage + ha.damage * head.dmgBonus) * boss.difficultyMul;
          p.radius = 6;
          p.angle = a;
          p.source = boss.id;
          p._elementType = ha.type || 'normal';
        }
      }
    }
  }

  // Комбо-атака (фаза 2)
  if (phase2) {
    boss._comboCd -= dt;
    if (boss._comboCd <= 0) {
      boss._comboCd = atk.comboAttack.cooldown;
      // 2 головы стреляют одновременно широким веером
      const liveHeads = boss._heads.filter(h => h.alive);
      if (liveHeads.length >= 2) {
        const baseAng = Math.atan2(dy, dx);
        for (let s = 0; s < 5; s++) {
          const a = baseAng + (s - 2) * 0.25;
          if (window.Game && Game.projectiles) {
            const p = Game.projectiles.spawn();
            if (p) {
              p.kind = 'boss_combo_bolt'; p.owner = 'enemy';
              p.x = boss.x; p.y = boss.y;
              p.vx = Math.cos(a) * 260; p.vy = Math.sin(a) * 260;
              p.life = 2.0; p.damage = atk.comboAttack.damage * boss.difficultyMul;
              p.radius = 6; p.angle = a; p.source = boss.id;
            }
          }
        }
        boss.slashAnim = 0.2;
      }
    }
  }

  // «Отрубание» голов — при получении порционного урона
  // (упрощённо: каждые 20% потерянного HP одна голова «отрубается»)
  const hpPct = boss.hp / boss.maxHp;
  const headsTarget = Math.max(0, Math.floor(hpPct * (cfg.headCount || 5)));
  const aliveCount = boss._heads.filter(h => h.alive).length;
  if (aliveCount > headsTarget) {
    // Выключаем случайную голову
    const alive = boss._heads.filter(h => h.alive);
    if (alive.length > 0) {
      const killIdx = Math.floor(Math.random() * alive.length);
      alive[killIdx].alive = false;
      alive[killIdx].regenTimer = cfg.headRegenTime || 8.0;
      if (window.Particles) {
        Particles.burst(boss.x, boss.y, 5, {
          color: '#ffffff', speedMin: 60, speedMax: 140,
          lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4,
        });
      }
    }
  }
};


/* =============================================================
   БОСС 5: Зеркальный Король (boss_mirror_king)
   Фаза 1: отражение 40% урона + копирование оружий героя
   Фаза 2: 3 зеркальных клона + лечение
   Фаза 3: ярость, осколки, ослепление
   ============================================================= */
Bosses._updateMirrorKing = function(boss, player, dt) {
  const cfg = boss.cfg;
  const atk = cfg.attacks;
  const phase3 = boss.phase >= 3;
  const phase2 = boss.phase >= 2;

  // Определяем текущее отражение
  if (phase3) boss._reflectPct = cfg.phase3ReflectPct || 0;
  else if (phase2) boss._reflectPct = cfg.phase2ReflectPct || 0.20;
  else boss._reflectPct = cfg.reflectPct || 0.40;

  // Движение
  const speedMul = phase3 ? (cfg.phase3SpeedMul || 2.0) : 1.0;
  Bosses._moveTowards(boss, player.x, player.y, dt, 1);

  // Кулдауны
  boss._slashCd = Math.max(0, (boss._slashCd || 0) - dt);
  boss._shardCd = Math.max(0, (boss._shardCd || 0) - dt);
  boss._blindCd = Math.max(0, (boss._blindCd || 0) - dt);
  boss._cloneHealTimer = (boss._cloneHealTimer || 0) - dt;

  const dx = player.x - boss.x, dy = player.y - boss.y;
  const dist = Math.hypot(dx, dy);

  // Атака: зеркальный удар (ближний бой)
  if (boss._slashCd <= 0 && dist <= (atk.mirrorSlash.range || 55)) {
    boss._slashCd = atk.mirrorSlash.cooldown * (phase3 ? 0.5 : 1.0);
    if (Bosses._inCone(boss, player, atk.mirrorSlash.arc || 120)) {
      const dmgMul = phase3 ? (cfg.phase3DamageMul || 1.50) : 1.0;
      const dmg = atk.mirrorSlash.damage * boss.difficultyMul * dmgMul;
      if (Player.takeDamage) Player.takeDamage(player, dmg, boss);
      else player.hp -= dmg;
    }
    boss.slashAnim = 0.2;
    if (window.Particles) {
      Particles.burst(boss.x + boss.facing.x * 30, boss.y + boss.facing.y * 30, 4, {
        color: '#ffffff', speedMin: 60, speedMax: 120,
        lifeMin: 0.15, lifeMax: 0.3, sizeMin: 2, sizeMax: 4,
      });
    }
  }

  // Фаза 3: кольцо осколков
  if (phase3 && boss._shardCd <= 0) {
    boss._shardCd = atk.shardRing.cooldown;
    const count = atk.shardRing.count || 8;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 / count) * i;
      if (window.Game && Game.projectiles) {
        const p = Game.projectiles.spawn();
        if (p) {
          p.kind = 'boss_mirror_shard'; p.owner = 'enemy';
          p.x = boss.x; p.y = boss.y;
          p.vx = Math.cos(a) * (atk.shardRing.speed || 220);
          p.vy = Math.sin(a) * (atk.shardRing.speed || 220);
          p.life = 2.0; p.damage = atk.shardRing.damage * boss.difficultyMul;
          p.radius = 5; p.angle = a; p.source = boss.id;
          p._blindOnHit = true;
        }
      }
    }
    boss.whirlwindAnim = 0.3;
  }

  // Фаза 3: ослепление при попадании осколком
  if (phase3 && boss._blindCd <= 0 && dist <= 100) {
    // Периодическое ослепление
    boss._blindCd = atk.blindShard.cooldown || 4.0;
    player._hexBlind = atk.blindShard.blindDuration || 0.5;
  }

  // Фаза 2: клоны
  if (phase2 && !phase3 && !boss._clonesSpawned) {
    boss._clonesSpawned = true;
    boss._cloneCount = cfg.phase2CloneCount || 3;
    // Спавн клонов как обычных врагов (визуально идентичны)
    for (let i = 0; i < boss._cloneCount; i++) {
      if (window.Enemies && window.Game && Game.enemies) {
        const ang = (Math.PI * 2 / boss._cloneCount) * i;
        const sx = boss.x + Math.cos(ang) * 60;
        const sy = boss.y + Math.sin(ang) * 60;
        const clone = Enemies.spawnByType(Game.enemies, 'skeleton', sx, sy);
        if (clone) {
          // Маскируем клон
          clone.hp = Math.floor(boss.maxHp * (cfg.phase2CloneHpPct || 0.15));
          clone.maxHp = clone.hp;
          clone._isMirrorClone = true;
          clone._bossRef = boss;
        }
      }
    }
    if (window.Particles) {
      Particles.ring(boss.x, boss.y, 80, 0.5, 'rgba(255, 255, 255, 0.9)', 4);
      Particles.text(boss.x, boss.y - 40, 'ЗЕРКАЛЬНЫЕ КЛОНЫ!', 1.5, '#ffffff', 14);
    }
  }

  // Фаза 2: лечение пока клоны живы
  if (phase2 && !phase3 && boss._cloneHealTimer <= 0) {
    boss._cloneHealTimer = 1.0; // Проверка каждую секунду
    let liveClones = 0;
    if (window.Game && Game.enemies) {
      Game.enemies.forEachActive(function(other) {
        if (other._isMirrorClone && other._bossRef === boss) liveClones++;
      });
    }
    if (liveClones > 0) {
      const healPerSec = boss.maxHp * (cfg.phase2HealPerClone || 0.02) * liveClones;
      boss.hp = Math.min(boss.maxHp, boss.hp + healPerSec);
    }
  }
};


/* =============================================================
   Патч системы урона по боссам — отражение Зеркального Короля
   и неуязвимость Сфинкса
   ============================================================= */
(function() {
  const _origDamage = Bosses.damage;
  Bosses.damage = function(dmg, target) {
    const boss = target || this.current || this.guardian;
    if (!boss || boss.hp <= 0) return;

    // Сфинкс: неуязвимость
    if (boss.id === 'boss_puzzle_sphinx' && boss._sphinxInvuln) {
      if (window.Particles) {
        Particles.burst(boss.x, boss.y, 2, {
          color: '#ffd700', speedMin: 40, speedMax: 80,
          lifeMin: 0.15, lifeMax: 0.25, sizeMin: 1, sizeMax: 3,
        });
      }
      return; // Урон не проходит
    }

    // Грозовой Колосс: фаза 1 — промахи лечат
    if (boss.id === 'boss_storm_colossus' && boss.phase < 2) {
      // Упрощённо: 30% шанс «промаха» (не попал в ядро)
      if (Math.random() > 0.5) {
        const healAmt = Math.floor(boss.maxHp * (boss.cfg.missHealPct || 0.01));
        boss.hp = Math.min(boss.maxHp, boss.hp + healAmt);
        return;
      }
    }

    // Зеркальный Король: отражение урона
    if (boss.id === 'boss_mirror_king' && boss._reflectPct > 0) {
      const reflected = Math.floor(dmg * boss._reflectPct);
      if (reflected > 0 && window.Game && Game.player) {
        if (Player.takeDamage) Player.takeDamage(Game.player, reflected, boss);
        else Game.player.hp -= reflected;
      }
    }

    // Теневой принц клонирование (для boss_shadow_prince — если он когда-то станет боссом)
    // Делегируем оригинальному
    return _origDamage.call(Bosses, dmg, target);
  };
})();


/* =============================================================
   Патч _checkPhaseTransition для новых 3-фазных боссов
   ============================================================= */
(function() {
  const _origCheckPhase = Bosses._checkPhaseTransition;
  Bosses._checkPhaseTransition = function(boss) {
    if (!boss) return;

    // Сфинкс: фаза 3
    if (boss.id === 'boss_puzzle_sphinx' && boss.phase === 2) {
      const p3 = boss.cfg.phase3HpPct || 0.25;
      if (boss.hp / boss.maxHp <= p3) {
        boss.phase = 3;
        if (window.Particles) {
          Particles.ring(boss.x, boss.y, 80, 0.5, 'rgba(255, 200, 0, 0.9)', 5);
          Particles.text(boss.x, boss.y - 40, 'ФАЗА III — ЯРОСТЬ!', 2.0, '#ff6600', 18);
        }
        return;
      }
    }

    // Зеркальный Король: фаза 3
    if (boss.id === 'boss_mirror_king' && boss.phase === 2) {
      const p3 = boss.cfg.phase3HpPct || 0.30;
      if (boss.hp / boss.maxHp <= p3) {
        boss.phase = 3;
        if (window.Particles) {
          Particles.ring(boss.x, boss.y, 80, 0.5, 'rgba(255, 255, 255, 0.9)', 5);
          Particles.text(boss.x, boss.y - 40, 'РАЗБИТЫЕ ЗЕРКАЛА!', 2.0, '#ffffff', 18);
        }
        return;
      }
    }

    // Делегируем оригинальному для остальных боссов
    return _origCheckPhase.call(Bosses, boss);
  };
})();

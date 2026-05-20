/* ============================================================
   GroundEffect — пул-объект для луж/следов (Шаг 4).
   ============================================================ */
function createGroundEffect() {
  return {
    active: false,
    kind: 'slime',
    x: 0, y: 0,
    radius: 22,
    life: 0, maxLife: 0,
    slow: 0,
    dps: 0,
    color: 'rgba(255,160,60,0.45)',
  };
}

const GROUND_DEFAULT_COLOR = {
  slime: 'rgba(255, 160, 60, 0.45)',
  rot:   'rgba(120, 200, 100, 0.45)',
  fire:  'rgba(255, 120, 30, 0.55)',
};
const GROUND_OUTLINE_COLOR = {
  slime: 'rgba(255, 200, 130, 0.7)',
  rot:   'rgba(180, 240, 160, 0.7)',
  fire:  'rgba(255, 220, 130, 0.9)',
};

window.createGroundEffect = createGroundEffect;

/* ============================================================
   ШАГ 17: Интеграция новых загадок и ловушек в генерацию и цикл.
   ============================================================ */

/**
 * Разместить новые загадки и ловушки (Шаг 17) после генерации подземелья.
 * Вызывается в конце generateDungeon().
 */
GameMap._placeStep17Objects = function(dungeon, mapNumber, isCampaign) {
  if (!window.STEP17_CONFIG) return;

  // Инициализируем массивы
  dungeon.runePuzzles = [];
  dungeon.floorPuzzles = [];
  dungeon.boulders = [];
  dungeon.vanishingPlatforms = [];
  dungeon.magicFloorRunes = [];

  const cfg = STEP17_CONFIG;
  let genCfg;

  if (isCampaign && cfg.GENERATION.CAMPAIGN[mapNumber]) {
    genCfg = cfg.GENERATION.CAMPAIGN[mapNumber];
    if (genCfg.puzzles) {
      for (const pType of genCfg.puzzles) {
        if (pType === 'rune_puzzle') GameMap._placeRunePuzzle(dungeon, mapNumber);
        else if (pType === 'floor_puzzle') GameMap._placeFloorPuzzle(dungeon, mapNumber);
      }
    }
    GameMap._placeBoulders(dungeon, genCfg.boulders || 0);
    GameMap._placeVanishingPlatforms(dungeon, genCfg.platforms || 0);
    GameMap._placeMagicFloorRunes(dungeon, genCfg.magicRunes || 0);
  } else {
    genCfg = cfg.GENERATION.INFINITE;
    const puzzleCount = Utils.randInt(genCfg.PUZZLES_MIN, genCfg.PUZZLES_MAX);
    for (let i = 0; i < puzzleCount; i++) {
      const roll = Math.random();
      if (roll < 0.4) GameMap._placeRunePuzzle(dungeon, mapNumber);
      else if (roll < 0.8) GameMap._placeFloorPuzzle(dungeon, mapNumber);
    }
    GameMap._placeBoulders(dungeon, Utils.randInt(genCfg.BOULDERS_MIN, genCfg.BOULDERS_MAX));
    GameMap._placeVanishingPlatforms(dungeon, Utils.randInt(genCfg.PLATFORMS_MIN, genCfg.PLATFORMS_MAX));
    GameMap._placeMagicFloorRunes(dungeon, Utils.randInt(genCfg.MAGIC_RUNES_MIN, genCfg.MAGIC_RUNES_MAX));
  }
};

GameMap._placeRunePuzzle = function(dungeon, mapNumber) {
  if (!window.RunePuzzle) return;
  const candidates = dungeon.rooms.filter(r => !r.isStart && !r.isSecret && !r.isPuzzle && r.w >= 200 && r.h >= 150);
  if (candidates.length === 0) return;
  const room = candidates[Math.floor(Math.random() * candidates.length)];
  room.isPuzzle = true;
  const runeCount = (STEP17_CONFIG.RUNE_PUZZLE.RUNES_BY_MAP[mapNumber]) || 4;
  const puzzle = RunePuzzle.create(room, runeCount);
  dungeon.runePuzzles.push(puzzle);
};

GameMap._placeFloorPuzzle = function(dungeon, mapNumber) {
  if (!window.FloorPuzzle) return;
  const candidates = dungeon.rooms.filter(r => !r.isStart && !r.isSecret && !r.isPuzzle && r.w >= 200 && r.h >= 150);
  if (candidates.length === 0) return;
  const room = candidates[Math.floor(Math.random() * candidates.length)];
  room.isPuzzle = true;
  const plateCfg = (STEP17_CONFIG.FLOOR_PUZZLE.PLATES_BY_MAP[mapNumber]) || { plates: 5, seq: 3 };
  const puzzle = FloorPuzzle.create(room, plateCfg.plates, plateCfg.seq);
  dungeon.floorPuzzles.push(puzzle);
};

GameMap._placeBoulders = function(dungeon, count) {
  if (!window.Boulder || count <= 0) return;
  const cfg = STEP17_CONFIG.BOULDER;
  const suitableCorridors = dungeon.corridors.filter(c => Math.max(c.w, c.h) >= cfg.MIN_CORRIDOR_LEN);
  if (suitableCorridors.length === 0) return;
  const maxBoulders = Math.min(count, cfg.MAX_PER_MAP, suitableCorridors.length);
  const shuffled = suitableCorridors.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (let i = 0; i < maxBoulders; i++) {
    dungeon.boulders.push(Boulder.create(shuffled[i]));
  }
};

GameMap._placeVanishingPlatforms = function(dungeon, count) {
  if (!window.VanishingPlatform || count <= 0) return;
  const cfg = STEP17_CONFIG.VANISHING_PLATFORM;
  const maxPlat = Math.min(count, cfg.MAX_PER_MAP);
  const candidates = dungeon.rooms.filter(r => !r.isStart && !r.isSecret && r.w >= 200 && r.h >= 150);
  if (candidates.length === 0) return;
  let placed = 0;
  for (let attempt = 0; attempt < 50 && placed < maxPlat; attempt++) {
    const room = candidates[Math.floor(Math.random() * candidates.length)];
    const x = room.x + 60 + Math.random() * (room.w - 120 - cfg.SIZE);
    const y = room.y + 60 + Math.random() * (room.h - 120 - cfg.SIZE);
    let ok = true;
    for (const p of dungeon.pillars) {
      if (GameMap._rectsOverlap(x, y, cfg.SIZE, cfg.SIZE, p.x - 10, p.y - 10, p.w + 20, p.h + 20)) {
        ok = false; break;
      }
    }
    if (!ok) continue;
    dungeon.vanishingPlatforms.push(VanishingPlatform.create(x, y));
    placed++;
  }
};

GameMap._placeMagicFloorRunes = function(dungeon, count) {
  if (!window.MagicFloorRune || count <= 0) return;
  const candidates = dungeon.rooms.filter(r => !r.isStart && !r.isSecret);
  if (candidates.length === 0) return;
  let placed = 0;
  for (let attempt = 0; attempt < 100 && placed < count; attempt++) {
    const room = candidates[Math.floor(Math.random() * candidates.length)];
    const x = room.x + 40 + Math.random() * (room.w - 80);
    const y = room.y + 40 + Math.random() * (room.h - 80);
    let ok = true;
    for (const rune of dungeon.magicFloorRunes) {
      const dx = x - rune.x, dy = y - rune.y;
      if (dx * dx + dy * dy < 60 * 60) { ok = false; break; }
    }
    if (!ok) continue;
    dungeon.magicFloorRunes.push(MagicFloorRune.create(x, y));
    placed++;
  }
};

/** Обновить объекты Шага 17 (вызывается из GameMap.update). */
GameMap.updateStep17 = function(dt, player) {
  if (!this.dungeon || !player) return;

  if (this.dungeon.runePuzzles) {
    for (const puzzle of this.dungeon.runePuzzles) {
      const ev = RunePuzzle.update(puzzle, player, dt);
      if (ev) GameMap._handlePuzzleEvent(ev, player);
    }
  }
  if (this.dungeon.floorPuzzles) {
    for (const puzzle of this.dungeon.floorPuzzles) {
      const ev = FloorPuzzle.update(puzzle, player, dt);
      if (ev) GameMap._handlePuzzleEvent(ev, player);
    }
  }
  if (this.dungeon.boulders) {
    const enemies = (window.Game && Game.enemies) ? Game.enemies : null;
    for (const boulder of this.dungeon.boulders) {
      const ev = Boulder.update(boulder, player, enemies, dt);
      if (ev && ev.type === 'hit_player') {
        player.hp -= ev.damage;
        // Отбрасывание игрока удалено — свободное скольжение по стенам
        player.x = Utils.clamp(player.x, 20, GameMap.mapW - 20);
        player.y = Utils.clamp(player.y, 20, GameMap.mapH - 20);
        if (window.Particles) {
          Particles.burst(player.x, player.y, 6, {
            color: '#aaaaaa', speedMin: 60, speedMax: 140,
            lifeMin: 0.2, lifeMax: 0.4, sizeMin: 3, sizeMax: 5,
          });
        }
      }
    }
  }
  if (this.dungeon.vanishingPlatforms) {
    const enemies = (window.Game && Game.enemies) ? Game.enemies : null;
    for (const plat of this.dungeon.vanishingPlatforms) {
      const ev = VanishingPlatform.update(plat, player, enemies, dt);
      if (ev && ev.type === 'player_fell') {
        player.hp -= ev.damage;
        const safePos = GameMap._findSafePosition(player.x, player.y, plat);
        if (safePos) { player.x = safePos.x; player.y = safePos.y; }
        player._stunTimer = ev.stunDuration;
        if (window.Particles) {
          Particles.burst(player.x, player.y, 4, {
            color: '#333333', speedMin: 40, speedMax: 100,
            lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 4,
          });
        }
      }
    }
  }
  if (this.dungeon.magicFloorRunes) {
    for (const rune of this.dungeon.magicFloorRunes) {
      const ev = MagicFloorRune.update(rune, player, dt);
      if (ev) GameMap._handleMagicRuneEvent(ev, player);
    }
  }
};

GameMap._handlePuzzleEvent = function(event, player) {
  if (event.type === 'solved') {
    if (window.Game && !event.puzzle.rewardSpawned) {
      event.puzzle.rewardSpawned = true;
      const room = event.puzzle.room;
      const c = Chest.create();
      c.x = room.cx; c.y = room.cy + 30;
      c.guaranteedRare = true;
      if (window.Particles) Particles.chestGlow(c.x, c.y);
      Game.secretChest = c;
      if (window.Particles) {
        Particles.burst(c.x, c.y, 10, { color: '#ffd700', speedMin: 60, speedMax: 160, lifeMin: 0.4, lifeMax: 0.8, sizeMin: 3, sizeMax: 6 });
        Particles.text(player.x, player.y - 40, 'PUZZLE SOLVED!', 1.5, '#ffd700', 14);
      }
    }
  } else if (event.type === 'error') {
    player.hp -= event.damage || 5;
    if (window.Particles) {
      Particles.burst(player.x, player.y, 4, { color: '#ff3333', speedMin: 40, speedMax: 100, lifeMin: 0.2, lifeMax: 0.4, sizeMin: 2, sizeMax: 4 });
      Particles.text(player.x, player.y - 30, 'ERROR!', 1.0, '#ff3333', 12);
    }
    if (window.Enemies && window.Game && Game.enemies) {
      const count = event.damage >= 10 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 80 + Math.random() * 40;
        Enemies.spawnByType(Game.enemies, 'skeleton', player.x + Math.cos(ang) * dist, player.y + Math.sin(ang) * dist);
      }
    }
  }
};

GameMap._handleMagicRuneEvent = function(event, player) {
  switch (event.type) {
    case 'fire': {
      const dx = player.x - event.x, dy = player.y - event.y;
      if (dx * dx + dy * dy <= event.radius * event.radius) player.hp -= event.damage;
      if (window.Game && Game.enemies) {
        const items = Game.enemies.items;
        for (let i = 0; i < items.length; i++) {
          const e = items[i];
          if (!e.active) continue;
          const edx = e.x - event.x, edy = e.y - event.y;
          if (edx * edx + edy * edy <= event.radius * event.radius) {
            e.hp -= event.damage;
            if (e.hp <= 0) Game.killEnemy(e);
          }
        }
      }
      if (window.Particles) Particles.burst(event.x, event.y, 12, { color: '#ff4400', speedMin: 80, speedMax: 200, lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 6 });
      break;
    }
    case 'ice': {
      const dx = player.x - event.x, dy = player.y - event.y;
      if (dx * dx + dy * dy <= 60 * 60) {
        player.hp -= event.damage;
        player._iceSlow = event.slowPct;
        player._iceSlowTimer = event.slowDuration;
      }
      if (window.Particles) Particles.burst(event.x, event.y, 8, { color: '#44aaff', speedMin: 60, speedMax: 140, lifeMin: 0.3, lifeMax: 0.5, sizeMin: 2, sizeMax: 5 });
      break;
    }
    case 'dark': {
      if (window.Enemies && window.Game && Game.enemies) {
        const biome = GameMap.currentBiome;
        const pool = biome && biome.enemyTypes ? biome.enemyTypes : ['skeleton'];
        for (let i = 0; i < event.spawnCount; i++) {
          const ang = Math.random() * Math.PI * 2;
          const dist = 40 + Math.random() * 30;
          const typeId = pool[Math.floor(Math.random() * Math.min(5, pool.length))];
          Enemies.spawnByType(Game.enemies, typeId, event.x + Math.cos(ang) * dist, event.y + Math.sin(ang) * dist);
        }
      }
      if (window.Particles) Particles.burst(event.x, event.y, 8, { color: '#9933ff', speedMin: 50, speedMax: 120, lifeMin: 0.3, lifeMax: 0.6, sizeMin: 3, sizeMax: 5 });
      break;
    }
    case 'teleport': {
      const safePos = GameMap._findRandomSafePosition();
      if (safePos) { player.x = safePos.x; player.y = safePos.y; }
      if (window.Particles) {
        Particles.burst(event.x, event.y, 10, { color: '#ffdd00', speedMin: 80, speedMax: 200, lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 5 });
        Particles.burst(player.x, player.y, 10, { color: '#ffdd00', speedMin: 80, speedMax: 200, lifeMin: 0.3, lifeMax: 0.6, sizeMin: 2, sizeMax: 5 });
      }
      break;
    }
    case 'heal': {
      player.hp = Math.min(player.maxHp, player.hp + event.amount);
      if (window.Particles) {
        Particles.burst(event.x, event.y, 8, { color: '#33ff66', speedMin: 40, speedMax: 100, lifeMin: 0.4, lifeMax: 0.7, sizeMin: 2, sizeMax: 4 });
        Particles.text(player.x, player.y - 30, '+' + event.amount + ' HP', 1.0, '#33ff66', 12);
      }
      break;
    }
  }
};

GameMap._findSafePosition = function(x, y, platform) {
  const offsets = [
    { x: -platform.w - 20, y: 0 }, { x: platform.w + 20, y: 0 },
    { x: 0, y: -platform.h - 20 }, { x: 0, y: platform.h + 20 },
  ];
  for (const off of offsets) {
    const nx = x + off.x, ny = y + off.y;
    if (nx > 20 && nx < GameMap.mapW - 20 && ny > 20 && ny < GameMap.mapH - 20) {
      if (GameMap.dungeon && GameMap.dungeon.grid) {
        const cs = GameMap.dungeon.cellSize;
        const gx = Math.floor(nx / cs), gy = Math.floor(ny / cs);
        if (gx >= 0 && gx < GameMap.dungeon.gridW && gy >= 0 && gy < GameMap.dungeon.gridH) {
          if (GameMap.dungeon.grid[gy * GameMap.dungeon.gridW + gx] === 1) return { x: nx, y: ny };
        }
      } else return { x: nx, y: ny };
    }
  }
  return { x, y: y - 40 };
};

GameMap._findRandomSafePosition = function() {
  if (!GameMap.dungeon || !GameMap.dungeon.rooms) return null;
  const rooms = GameMap.dungeon.rooms.filter(r => !r.isSecret);
  if (rooms.length === 0) return null;
  // Bug fix #6.1: Проверяем проходимость точки телепортации (до 10 попыток)
  for (let attempt = 0; attempt < 10; attempt++) {
    const room = rooms[Math.floor(Math.random() * rooms.length)];
    const x = room.x + 40 + Math.random() * (room.w - 80);
    const y = room.y + 40 + Math.random() * (room.h - 80);
    // Проверяем, что точка проходима
    if (GameMap.dungeon.grid) {
      const cell = GameMap.dungeon.cellSize;
      const gx = Math.floor(x / cell);
      const gy = Math.floor(y / cell);
      if (gx >= 0 && gx < GameMap.dungeon.gridW && gy >= 0 && gy < GameMap.dungeon.gridH) {
        if (GameMap.dungeon.grid[gy * GameMap.dungeon.gridW + gx] === 1) {
          // Дополнительно проверяем что нет колонн/объектов рядом
          if (!GameMap.rectIsWalkable || GameMap.rectIsWalkable(x, y, 12)) {
            return { x, y };
          }
        }
      }
    } else {
      return { x, y };
    }
  }
  // Фоллбэк: центр случайной комнаты (гарантированно свободен)
  const fallbackRoom = rooms[Math.floor(Math.random() * rooms.length)];
  return { x: fallbackRoom.cx || fallbackRoom.x + fallbackRoom.w / 2, y: fallbackRoom.cy || fallbackRoom.y + fallbackRoom.h / 2 };
};

/** Отрисовать объекты Шага 17 (вызывается из GameMap.render). */
GameMap.renderStep17 = function(ctx, cam, viewW, viewH) {
  if (!this.dungeon) return;
  if (this.dungeon.magicFloorRunes) {
    for (const rune of this.dungeon.magicFloorRunes) MagicFloorRune.render(ctx, rune, cam, viewW, viewH);
  }
  if (this.dungeon.vanishingPlatforms) {
    for (const plat of this.dungeon.vanishingPlatforms) VanishingPlatform.render(ctx, plat, cam, viewW, viewH);
  }
  if (this.dungeon.runePuzzles) {
    for (const puzzle of this.dungeon.runePuzzles) RunePuzzle.render(ctx, puzzle, cam, viewW, viewH);
  }
  if (this.dungeon.floorPuzzles) {
    for (const puzzle of this.dungeon.floorPuzzles) FloorPuzzle.render(ctx, puzzle, cam, viewW, viewH);
  }
  if (this.dungeon.boulders) {
    for (const boulder of this.dungeon.boulders) Boulder.render(ctx, boulder, cam, viewW, viewH);
  }
};

/* ============================================================
   traps_extended.js — Шаг 17: Катящиеся валуны (Boulder),
   Исчезающие платформы (VanishingPlatform),
   Магические руны на полу (MagicFloorRune).
   ============================================================ */

/* ============================================================
   BOULDER — Катящийся валун
   В длинных коридорах периодически проезжает валун,
   наносящий урон и отбрасывающий всё на пути.
   ============================================================ */
const Boulder = {
  /**
   * Создать валун в коридоре.
   * @param {object} corridor — { x, y, w, h }
   * @returns {object} boulderState
   */
  create(corridor) {
    // Определяем направление: горизонтальное или вертикальное
    const isHorizontal = corridor.w > corridor.h;
    const cfg = STEP17_CONFIG.BOULDER;

    let startX, startY, endX, endY;
    if (isHorizontal) {
      startX = corridor.x + cfg.RADIUS;
      startY = corridor.y + corridor.h / 2;
      endX = corridor.x + corridor.w - cfg.RADIUS;
      endY = startY;
    } else {
      startX = corridor.x + corridor.w / 2;
      startY = corridor.y + cfg.RADIUS;
      endX = startX;
      endY = corridor.y + corridor.h - cfg.RADIUS;
    }

    return {
      type: 'boulder',
      x: startX,
      y: startY,
      startX, startY,
      endX, endY,
      radius: cfg.RADIUS,
      isHorizontal,
      // Фазы: 'idle' → 'warning' → 'rolling' → 'idle'
      phase: 'idle',
      timer: cfg.IDLE_TIME * Math.random(), // рандомный старт
      direction: 1, // 1 = вперёд, -1 = назад
      progress: 0,  // 0..1 — текущая позиция на пути
      // Параметры
      damage: cfg.DAMAGE,
      knockback: cfg.KNOCKBACK,
      idleTime: cfg.IDLE_TIME,
      warnTime: cfg.WARN_TIME,
      rollSpeed: cfg.ROLL_SPEED,
      // Визуал
      rotation: 0,
      dustTimer: 0,
      _hitCooldown: 0, // предотвращение двойного удара
    };
  },

  /**
   * Обновить валун.
   * @returns {object|null} — событие { type: 'hit_player', damage, knockX, knockY }
   */
  update(boulder, player, enemies, dt) {
    if (boulder._hitCooldown > 0) boulder._hitCooldown -= dt;
    let event = null;

    switch (boulder.phase) {
      case 'idle':
        boulder.timer -= dt;
        if (boulder.timer <= 0) {
          boulder.phase = 'warning';
          boulder.timer = boulder.warnTime;
        }
        break;

      case 'warning':
        boulder.timer -= dt;
        if (boulder.timer <= 0) {
          boulder.phase = 'rolling';
          boulder.progress = 0;
        }
        break;

      case 'rolling': {
        // Вычисляем расстояние пути
        const dx = boulder.endX - boulder.startX;
        const dy = boulder.endY - boulder.startY;
        const totalDist = Math.sqrt(dx * dx + dy * dy);
        if (totalDist < 1) {
          boulder.phase = 'idle';
          boulder.timer = boulder.idleTime;
          break;
        }

        // Двигаемся
        const step = (boulder.rollSpeed * dt) / totalDist;
        boulder.progress += step * boulder.direction;

        // Обновляем позицию
        if (boulder.direction > 0) {
          boulder.x = boulder.startX + dx * boulder.progress;
          boulder.y = boulder.startY + dy * boulder.progress;
        } else {
          boulder.x = boulder.endX - dx * (1 - boulder.progress);
          boulder.y = boulder.endY - dy * (1 - boulder.progress);
        }

        // Вращение
        boulder.rotation += dt * 8 * boulder.direction;

        // Проверяем конец пути
        if (boulder.progress >= 1 || boulder.progress <= 0) {
          boulder.phase = 'idle';
          boulder.timer = boulder.idleTime;
          boulder.direction *= -1; // следующий раз — обратно
          // Зажимаем progress
          boulder.progress = Utils.clamp(boulder.progress, 0, 1);
          // Обновляем позицию к конечной точке
          if (boulder.direction < 0) {
            boulder.x = boulder.endX;
            boulder.y = boulder.endY;
          } else {
            boulder.x = boulder.startX;
            boulder.y = boulder.startY;
          }
        }

        // Проверяем столкновение с игроком
        if (boulder._hitCooldown <= 0) {
          const pdx = player.x - boulder.x;
          const pdy = player.y - boulder.y;
          const hitR = boulder.radius + player.size * 0.4;
          if (pdx * pdx + pdy * pdy <= hitR * hitR) {
            // Направление отбрасывания — по движению валуна
            const moveAngle = Math.atan2(
              boulder.direction > 0 ? dy : -dy,
              boulder.direction > 0 ? dx : -dx
            );
            event = {
              type: 'hit_player',
              damage: boulder.damage,
              knockX: Math.cos(moveAngle) * boulder.knockback,
              knockY: Math.sin(moveAngle) * boulder.knockback,
            };
            boulder._hitCooldown = 1.0;
          }
        }

        // Урон врагам
        if (enemies) {
          const items = enemies.items;
          for (let i = 0; i < items.length; i++) {
            const e = items[i];
            if (!e.active) continue;
            const edx = e.x - boulder.x;
            const edy = e.y - boulder.y;
            const eR = boulder.radius + (e.cfg ? Math.max(e.cfg.w, e.cfg.h) * 0.4 : 14);
            if (edx * edx + edy * edy <= eR * eR) {
              if (!e._boulderHitCD || e._boulderHitCD <= 0) {
                e.hp -= boulder.damage;
                e._boulderHitCD = 1.0;
                if (e.hp <= 0 && window.Game) Game.killEnemy(e);
              }
            }
            if (e._boulderHitCD > 0) e._boulderHitCD -= dt;
          }
        }
        break;
      }
    }
    return event;
  },

  /** Отрисовка валуна. */
  render(ctx, boulder, cam, viewW, viewH) {
    if (boulder.x - boulder.radius > cam.x + viewW + 20 ||
        boulder.x + boulder.radius < cam.x - 20 ||
        boulder.y - boulder.radius > cam.y + viewH + 20 ||
        boulder.y + boulder.radius < cam.y - 20) return;

    const r = boulder.radius;

    // Предупреждение (тень и стрелка)
    if (boulder.phase === 'warning') {
      const alpha = 0.3 + Math.sin(boulder.timer * 12) * 0.3;
      // Тень на пути
      ctx.fillStyle = `rgba(255, 50, 50, ${alpha})`;
      if (boulder.isHorizontal) {
        const x1 = boulder.direction > 0 ? boulder.startX : boulder.endX;
        const x2 = boulder.direction > 0 ? boulder.endX : boulder.startX;
        ctx.fillRect(Math.min(x1, x2), boulder.startY - 12, Math.abs(x2 - x1), 24);
      } else {
        const y1 = boulder.direction > 0 ? boulder.startY : boulder.endY;
        const y2 = boulder.direction > 0 ? boulder.endY : boulder.startY;
        ctx.fillRect(boulder.startX - 12, Math.min(y1, y2), 24, Math.abs(y2 - y1));
      }
      // Стрелка направления
      ctx.fillStyle = `rgba(255, 100, 100, ${alpha + 0.2})`;
      ctx.font = 'bold 18px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const arrow = boulder.isHorizontal
        ? (boulder.direction > 0 ? '\u2192' : '\u2190')
        : (boulder.direction > 0 ? '\u2193' : '\u2191');
      ctx.fillText(arrow, boulder.x, boulder.y);
    }

    // Валун (всегда рисуется в текущей позиции)
    if (boulder.phase === 'rolling' || boulder.phase === 'warning') {
      ctx.save();
      ctx.translate(boulder.x, boulder.y);
      ctx.rotate(boulder.rotation);

      // Тень
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.ellipse(2, 4, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Камень
      ctx.fillStyle = '#6b6b6b';
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Текстура камня
      ctx.strokeStyle = '#4a4a4a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Трещины
      ctx.strokeStyle = '#3a3a3a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.3, -r * 0.4);
      ctx.lineTo(r * 0.2, r * 0.1);
      ctx.moveTo(r * 0.1, -r * 0.3);
      ctx.lineTo(-r * 0.1, r * 0.4);
      ctx.stroke();

      // Блик
      ctx.fillStyle = 'rgba(200, 200, 200, 0.3)';
      ctx.beginPath();
      ctx.arc(-r * 0.3, -r * 0.3, r * 0.25, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    } else {
      // В покое — рисуем неподвижно в стартовой/конечной позиции
      const drawX = boulder.direction > 0 ? boulder.startX : boulder.endX;
      const drawY = boulder.direction > 0 ? boulder.startY : boulder.endY;

      ctx.fillStyle = '#5a5a5a';
      ctx.beginPath();
      ctx.arc(drawX, drawY, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#4a4a4a';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  },
};


/* ============================================================
   VANISHING PLATFORM — Исчезающая платформа
   Зоны пола, которые периодически исчезают.
   ============================================================ */
const VanishingPlatform = {
  /**
   * Создать исчезающую платформу.
   * @param {number} x, y — позиция
   * @returns {object} platformState
   */
  create(x, y) {
    const cfg = STEP17_CONFIG.VANISHING_PLATFORM;
    return {
      type: 'vanishing_platform',
      x, y,
      w: cfg.SIZE,
      h: cfg.SIZE,
      // Фазы: 'solid' → 'flickering' → 'gone' → 'solid'
      phase: 'solid',
      timer: cfg.SOLID_TIME + Math.random() * 2, // рандомный старт
      solidTime: cfg.SOLID_TIME,
      flickerTime: cfg.FLICKER_TIME,
      goneTime: cfg.GONE_TIME,
      damage: cfg.DAMAGE,
      enemyDamage: cfg.ENEMY_DAMAGE,
      stunDuration: cfg.STUN_DURATION,
      // Визуал
      alpha: 1.0,
      crackPhase: Math.random() * Math.PI * 2,
      _playerWasOn: false,
    };
  },

  /**
   * Обновить платформу.
   * @returns {object|null} — событие { type: 'player_fell', damage, stunDuration }
   */
  update(platform, player, enemies, dt) {
    platform.crackPhase += dt * 2;
    let event = null;

    // Проверяем, стоит ли игрок на платформе
    const playerOn = Boulder._entityOnPlatform(player, platform);

    switch (platform.phase) {
      case 'solid':
        platform.alpha = 1.0;
        platform.timer -= dt;
        if (platform.timer <= 0) {
          platform.phase = 'flickering';
          platform.timer = platform.flickerTime;
        }
        platform._playerWasOn = playerOn;
        break;

      case 'flickering':
        // Мерцание — пульсация прозрачности
        platform.alpha = 0.4 + Math.sin(platform.timer * 15) * 0.4;
        platform.timer -= dt;
        if (platform.timer <= 0) {
          platform.phase = 'gone';
          platform.timer = platform.goneTime;
          platform.alpha = 0;

          // Если игрок стоит на платформе — урон + телепорт
          if (playerOn) {
            event = {
              type: 'player_fell',
              damage: platform.damage,
              stunDuration: platform.stunDuration,
            };
          }

          // Враги на платформе получают урон
          if (enemies) {
            const items = enemies.items;
            for (let i = 0; i < items.length; i++) {
              const e = items[i];
              if (!e.active) continue;
              if (Boulder._entityOnPlatform(e, platform)) {
                e.hp -= platform.enemyDamage;
                if (e.hp <= 0 && window.Game) Game.killEnemy(e);
              }
            }
          }
        }
        platform._playerWasOn = playerOn;
        break;

      case 'gone':
        platform.alpha = 0;
        platform.timer -= dt;
        if (platform.timer <= 0) {
          platform.phase = 'solid';
          platform.timer = platform.solidTime;
          platform.alpha = 1.0;
        }
        break;
    }
    return event;
  },

  /** Отрисовка платформы. */
  render(ctx, platform, cam, viewW, viewH) {
    if (platform.x + platform.w < cam.x || platform.x > cam.x + viewW ||
        platform.y + platform.h < cam.y || platform.y > cam.y + viewH) return;

    if (platform.phase === 'gone') {
      // Чёрный провал
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
      // Мерцающие края
      ctx.strokeStyle = 'rgba(80, 40, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(platform.x + 2, platform.y + 2, platform.w - 4, platform.h - 4);
      return;
    }

    ctx.globalAlpha = platform.alpha;

    // Основная плитка (светлее обычного пола)
    ctx.fillStyle = 'rgba(100, 90, 70, 0.8)';
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);

    // Трещины
    ctx.strokeStyle = 'rgba(50, 40, 30, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const cx = platform.x + platform.w / 2;
    const cy = platform.y + platform.h / 2;
    // Рисуем несколько трещин
    ctx.moveTo(cx - 20, cy - 15);
    ctx.lineTo(cx + 10, cy + 5);
    ctx.lineTo(cx + 25, cy + 20);
    ctx.moveTo(cx + 15, cy - 20);
    ctx.lineTo(cx - 5, cy + 10);
    ctx.moveTo(cx - 25, cy + 5);
    ctx.lineTo(cx - 10, cy + 25);
    ctx.stroke();

    // Обводка
    ctx.strokeStyle = platform.phase === 'flickering'
      ? `rgba(255, 100, 50, ${platform.alpha})`
      : 'rgba(120, 100, 80, 0.5)';
    ctx.lineWidth = 2;
    ctx.strokeRect(platform.x, platform.y, platform.w, platform.h);

    ctx.globalAlpha = 1.0;
  },
};

// Вспомогательная функция — проверка, находится ли сущность на платформе
Boulder._entityOnPlatform = function(entity, platform) {
  const ex = entity.x, ey = entity.y;
  const size = entity.size || (entity.cfg ? Math.max(entity.cfg.w, entity.cfg.h) * 0.5 : 14);
  return ex + size * 0.3 > platform.x && ex - size * 0.3 < platform.x + platform.w &&
         ey + size * 0.3 > platform.y && ey - size * 0.3 < platform.y + platform.h;
};


/* ============================================================
   MAGIC FLOOR RUNE — Магическая руна на полу
   Одноразовая: при наступании — случайный эффект.
   ============================================================ */
const MagicFloorRune = {
  /** Типы рун */
  TYPES: ['fire', 'ice', 'dark', 'teleport', 'heal'],

  /**
   * Создать магическую руну.
   * @param {number} x, y — позиция центра
   * @param {string} [runeType] — тип (или случайный)
   * @returns {object} runeState
   */
  create(x, y, runeType) {
    const cfg = STEP17_CONFIG.MAGIC_FLOOR_RUNE;

    // Выбор типа: heal — 10% шанс, остальные равновероятны
    if (!runeType) {
      if (Math.random() < cfg.HEAL_CHANCE) {
        runeType = 'heal';
      } else {
        const types = ['fire', 'ice', 'dark', 'teleport'];
        runeType = types[Math.floor(Math.random() * types.length)];
      }
    }

    // Цвет по типу
    const colors = {
      fire: { main: '#ff4400', glow: 'rgba(255, 68, 0, 0.6)' },
      ice: { main: '#44aaff', glow: 'rgba(68, 170, 255, 0.6)' },
      dark: { main: '#9933ff', glow: 'rgba(153, 51, 255, 0.6)' },
      teleport: { main: '#ffdd00', glow: 'rgba(255, 221, 0, 0.6)' },
      heal: { main: '#33ff66', glow: 'rgba(51, 255, 102, 0.6)' },
    };

    return {
      type: 'magic_floor_rune',
      runeType: runeType,
      x, y,
      radius: cfg.RADIUS,
      triggerRadius: cfg.TRIGGER_RADIUS,
      active: true,       // ещё не сработала
      triggered: false,   // визуальный флаг (вспышка)
      triggerTimer: 0,
      pulse: Math.random() * Math.PI * 2,
      color: colors[runeType] || colors.fire,
      // Параметры по типу
      damage: cfg.FIRE_DAMAGE,
      explosionRadius: cfg.FIRE_EXPLOSION_RADIUS,
      slowPct: cfg.ICE_SLOW_PCT,
      slowDuration: cfg.ICE_SLOW_DURATION,
      iceDamage: cfg.ICE_DAMAGE,
      healAmount: cfg.HEAL_AMOUNT,
      darkSpawnCount: cfg.DARK_SPAWN_COUNT,
    };
  },

  /**
   * Обновить руну.
   * @returns {object|null} — событие { type: 'fire'|'ice'|'dark'|'teleport'|'heal', ... }
   */
  update(rune, player, dt) {
    if (!rune.active) return null;

    rune.pulse += dt * 4;

    // Анимация после триггера (вспышка 0.3 сек, затем удаляется)
    if (rune.triggered) {
      rune.triggerTimer -= dt;
      if (rune.triggerTimer <= 0) {
        rune.active = false;
      }
      return null;
    }

    // Проверяем приближение игрока
    const dx = player.x - rune.x;
    const dy = player.y - rune.y;
    const dist2 = dx * dx + dy * dy;

    if (dist2 <= rune.triggerRadius * rune.triggerRadius) {
      // Активируем руну!
      rune.triggered = true;
      rune.triggerTimer = 0.4;
      return MagicFloorRune._triggerEffect(rune, player);
    }

    return null;
  },

  /** Применить эффект руны. */
  _triggerEffect(rune, player) {
    switch (rune.runeType) {
      case 'fire':
        return {
          type: 'fire',
          x: rune.x, y: rune.y,
          damage: rune.damage,
          radius: rune.explosionRadius,
        };

      case 'ice':
        return {
          type: 'ice',
          x: rune.x, y: rune.y,
          damage: rune.iceDamage,
          slowPct: rune.slowPct,
          slowDuration: rune.slowDuration,
        };

      case 'dark':
        return {
          type: 'dark',
          x: rune.x, y: rune.y,
          spawnCount: rune.darkSpawnCount,
        };

      case 'teleport':
        return {
          type: 'teleport',
          x: rune.x, y: rune.y,
        };

      case 'heal':
        return {
          type: 'heal',
          x: rune.x, y: rune.y,
          amount: rune.healAmount,
        };

      default:
        return null;
    }
  },

  /** Отрисовка руны. */
  render(ctx, rune, cam, viewW, viewH) {
    if (!rune.active) return;
    if (rune.x - 30 > cam.x + viewW || rune.x + 30 < cam.x ||
        rune.y - 30 > cam.y + viewH || rune.y + 30 < cam.y) return;

    const r = rune.radius;
    const pulse = 1 + Math.sin(rune.pulse) * 0.2;

    // Вспышка при активации
    if (rune.triggered) {
      const alpha = rune.triggerTimer / 0.4;
      ctx.fillStyle = rune.color.main;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(rune.x, rune.y, r * 3 * (1 - alpha), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    // Свечение
    ctx.shadowColor = rune.color.glow;
    ctx.shadowBlur = 8 * pulse;

    // Круг руны
    ctx.fillStyle = rune.color.main;
    ctx.globalAlpha = 0.5 + Math.sin(rune.pulse) * 0.2;
    ctx.beginPath();
    ctx.arc(rune.x, rune.y, r * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Обводка
    ctx.strokeStyle = rune.color.main;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Символ в центре (зависит от типа)
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(12 * pulse)}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const symbols = { fire: '\u2600', ice: '\u2744', dark: '\u2620', teleport: '\u2B50', heal: '\u2764' };
    ctx.fillText(symbols[rune.runeType] || '?', rune.x, rune.y);

    ctx.globalAlpha = 1;
  },
};


/* ============================================================
   Экспорт
   ============================================================ */
window.Boulder = Boulder;
window.VanishingPlatform = VanishingPlatform;
window.MagicFloorRune = MagicFloorRune;

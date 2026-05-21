'use strict';
/* ============================================================
   story-maps.js — Данные 4 сюжетных карт для кампании.
   Каждая карта 50x50 тайлов (1000x1000 px при tileSize=20).

   Карты генерируются процедурно при загрузке через _buildMap*().
   Это позволяет хранить компактно и создавать сложные лабиринты.

   Экспорт: window.STORY_MAPS
   ============================================================ */

const STORY_MAPS = {};

/* ============================================================
   Утилиты генерации карт
   ============================================================ */
function _createEmptyGrid(w, h, fill) {
  const grid = [];
  for (let y = 0; y < h; y++) {
    grid[y] = new Array(w).fill(fill);
  }
  return grid;
}


function _carveRoom(grid, x, y, w, h, tile) {
  tile = tile !== undefined ? tile : 1;
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const ty = y + dy, tx = x + dx;
      if (ty >= 0 && ty < grid.length && tx >= 0 && tx < grid[0].length) {
        grid[ty][tx] = tile;
      }
    }
  }
}

function _carveCorridor(grid, x1, y1, x2, y2, width) {
  width = width || 2;
  const half = Math.floor(width / 2);
  // Horizontal then vertical
  const mx = x2, my = y1;
  for (let x = Math.min(x1, mx); x <= Math.max(x1, mx); x++) {
    for (let w = -half; w <= half; w++) {
      const ty = y1 + w;
      if (ty >= 0 && ty < grid.length && x >= 0 && x < grid[0].length) {
        grid[ty][x] = 1;
      }
    }
  }
  for (let y = Math.min(my, y2); y <= Math.max(my, y2); y++) {
    for (let w = -half; w <= half; w++) {
      const tx = x2 + w;
      if (y >= 0 && y < grid.length && tx >= 0 && tx < grid[0].length) {
        grid[y][tx] = 1;
      }
    }
  }
}


function _seedRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (s >>> 0) / 4294967296;
  };
}

function _scatterTile(grid, tile, count, rng, avoidTiles) {
  avoidTiles = avoidTiles || [0];
  let placed = 0, attempts = 0;
  while (placed < count && attempts < count * 10) {
    attempts++;
    const x = Math.floor(rng() * grid[0].length);
    const y = Math.floor(rng() * grid.length);
    if (!avoidTiles.includes(grid[y][x]) && grid[y][x] === 1) {
      grid[y][x] = tile;
      placed++;
    }
  }
}


/* ============================================================
   ГЛАВА 1: Забытые катакомбы (50x50)
   Лабиринт из тёмных коридоров, склепы, грибные гроты.
   ============================================================ */
function _buildChapter1() {
  const W = 50, H = 50;
  const grid = _createEmptyGrid(W, H, 0);
  const rng = _seedRandom(42001);
  const rooms = [];
  const entities = [];
  const triggers = [];

  // Определяем комнаты
  const roomDefs = [
    { x: 2, y: 2, w: 8, h: 7, isStart: true, name: 'entrance' },
    { x: 14, y: 2, w: 7, h: 6, name: 'corridor_north' },
    { x: 25, y: 2, w: 8, h: 7, name: 'archer_hall' },
    { x: 37, y: 2, w: 10, h: 8, name: 'grotto1' },
    { x: 2, y: 13, w: 6, h: 6, name: 'side_room1' },
    { x: 12, y: 12, w: 10, h: 8, name: 'crypt_main' },
    { x: 26, y: 12, w: 8, h: 8, name: 'grotto2' },
    { x: 38, y: 13, w: 9, h: 7, name: 'treasure_room' },
    { x: 2, y: 24, w: 7, h: 7, name: 'rune_room1' },
    { x: 13, y: 24, w: 9, h: 8, name: 'central_hub' },
    { x: 26, y: 24, w: 8, h: 7, name: 'rune_room2' },
    { x: 38, y: 24, w: 9, h: 8, name: 'spider_nest' },
    { x: 2, y: 36, w: 8, h: 7, name: 'deep_crypt' },
    { x: 14, y: 36, w: 8, h: 7, name: 'skeleton_hall' },
    { x: 26, y: 35, w: 9, h: 8, name: 'rune_room3' },
    { x: 39, y: 35, w: 9, h: 8, name: 'pre_boss' },
    { x: 18, y: 44, w: 14, h: 5, name: 'boss_corridor' },
    { x: 14, y: 14, w: 1, h: 1, name: 'locked_gate' },
  ];


  // Вырезаем комнаты
  for (const r of roomDefs) {
    _carveRoom(grid, r.x, r.y, r.w, r.h, 1);
    rooms.push(r);
  }

  // Соединяем коридорами (лабиринтообразно)
  _carveCorridor(grid, 9, 5, 14, 5, 2);    // entrance -> corridor_north
  _carveCorridor(grid, 20, 4, 25, 4, 2);   // corridor_north -> archer_hall
  _carveCorridor(grid, 32, 5, 37, 5, 2);   // archer_hall -> grotto1
  _carveCorridor(grid, 5, 8, 5, 13, 2);    // entrance -> side_room1
  _carveCorridor(grid, 7, 16, 12, 16, 2);  // side_room1 -> crypt_main
  _carveCorridor(grid, 21, 16, 26, 16, 2); // crypt_main -> grotto2
  _carveCorridor(grid, 33, 16, 38, 16, 2); // grotto2 -> treasure_room
  _carveCorridor(grid, 17, 8, 17, 12, 2);  // corridor_north -> crypt_main
  _carveCorridor(grid, 5, 18, 5, 24, 2);   // side_room1 -> rune_room1
  _carveCorridor(grid, 8, 27, 13, 27, 2);  // rune_room1 -> central_hub
  _carveCorridor(grid, 21, 28, 26, 28, 2); // central_hub -> rune_room2
  _carveCorridor(grid, 33, 28, 38, 28, 2); // rune_room2 -> spider_nest
  _carveCorridor(grid, 17, 20, 17, 24, 2); // crypt_main -> central_hub
  _carveCorridor(grid, 5, 30, 5, 36, 2);   // rune_room1 -> deep_crypt
  _carveCorridor(grid, 9, 39, 14, 39, 2);  // deep_crypt -> skeleton_hall
  _carveCorridor(grid, 21, 39, 26, 39, 2); // skeleton_hall -> rune_room3
  _carveCorridor(grid, 34, 39, 39, 39, 2); // rune_room3 -> pre_boss
  _carveCorridor(grid, 43, 31, 43, 35, 2); // spider_nest -> pre_boss
  _carveCorridor(grid, 18, 42, 18, 44, 2); // skeleton_hall -> boss_corridor
  _carveCorridor(grid, 29, 5, 29, 12, 2);  // archer_hall -> grotto2
  _carveCorridor(grid, 42, 8, 42, 13, 2);  // grotto1 -> treasure_room


  // Грибные пятна в гротах
  _scatterTile(grid, 8, 6, rng, [0, 8]); // grotto1 area
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 10; dx++) {
      if (grid[2 + dy] && grid[2 + dy][37 + dx] === 1 && rng() < 0.2) {
        grid[2 + dy][37 + dx] = 8;
      }
    }
  }
  for (let dy = 0; dy < 8; dy++) {
    for (let dx = 0; dx < 8; dx++) {
      if (grid[12 + dy] && grid[12 + dy][26 + dx] === 1 && rng() < 0.15) {
        grid[12 + dy][26 + dx] = 8;
      }
    }
  }

  // === ВРАГИ ===
  // Скелеты-воины (18 шт.)
  const skelPositions = [
    [15,3],[16,4],[27,4],[28,5],[13,14],[14,15],[18,13],[19,14],
    [15,25],[16,26],[17,25],[3,37],[4,38],[6,37],[15,37],[16,38],
    [20,45],[25,45]
  ];
  for (const [ex, ey] of skelPositions) {
    entities.push({ type: 'skeleton', x: ex, y: ey });
  }

  // Скелеты-лучники (6 шт.) — в нишах
  const archerPos = [[26,3],[27,3],[14,3],[40,4],[41,5],[29,13]];
  for (const [ex, ey] of archerPos) {
    entities.push({ type: 'archer', x: ex, y: ey });
  }

  // Гигантские пауки (4 шт.) — в грибных гротах
  const spiderPos = [[39,14],[40,15],[38,25],[40,26]];
  for (const [ex, ey] of spiderPos) {
    entities.push({ type: 'spider', x: ex, y: ey, hpMul: 1.5 });
  }


  // Стражи сундука с ключом (treasure_room)
  entities.push({ type: 'skeleton', x: 40, y: 14, hpMul: 2, guardKey: 'catacomb_key' });
  entities.push({ type: 'skeleton', x: 42, y: 15, hpMul: 2 });
  entities.push({ type: 'skeleton', x: 44, y: 14, hpMul: 2 });

  // === ЛОВУШКИ ===
  // Ямы с шипами (10 шт.) в узких коридорах
  const spikePits = [
    [11,5],[19,4],[30,5],[6,10],[10,16],[22,16],[35,16],
    [6,30],[10,27],[22,39]
  ];
  for (const [sx, sy] of spikePits) {
    triggers.push({ kind: 'spike_pit', x: sx, y: sy, w: 1, h: 1, damagePct: 0.20 });
  }

  // Облака спор (4 зоны) в грибных гротах
  triggers.push({ kind: 'spore_cloud', x: 38, y: 3, w: 3, h: 3, dpsPct: 0.05, duration: 3 });
  triggers.push({ kind: 'spore_cloud', x: 27, y: 13, w: 3, h: 3, dpsPct: 0.05, duration: 3 });
  triggers.push({ kind: 'spore_cloud', x: 39, y: 25, w: 3, h: 3, dpsPct: 0.05, duration: 3 });
  triggers.push({ kind: 'spore_cloud', x: 42, y: 26, w: 3, h: 3, dpsPct: 0.05, duration: 3 });

  // === РУНЫ (3 шт.) ===
  triggers.push({ kind: 'rune_power', x: 4, y: 26, effect: { attackMul: 0.30, duration: 60 } });
  triggers.push({ kind: 'rune_speed', x: 28, y: 26, effect: { speedMul: 0.20, duration: 60 } });
  triggers.push({ kind: 'rune_life', x: 28, y: 37, effect: { healPct: 0.50 } });


  // === КЛЮЧИ И ДВЕРИ ===
  // Сундук с ключом в treasure_room (охраняется)
  triggers.push({ kind: 'chest', x: 42, y: 16, containsKey: 'catacomb_key' });

  // Закрытая дверь перед boss_corridor
  triggers.push({
    kind: 'locked_door', x: 18, y: 43, doorW: 2, doorH: 1,
    requiredKey: 'catacomb_key'
  });
  // Делаем дверь непроходимой
  grid[43][18] = 0; grid[43][19] = 0;

  // === АРЕНА БОССА ===
  // Босс-арена (boss_corridor расширена): 14x5 в центре нижней части
  const bossArena = { x: 18, y: 44, w: 14, h: 5 };
  // Колонны на арене
  grid[45][20] = 0; grid[45][29] = 0;
  grid[47][22] = 0; grid[47][27] = 0;

  // === СЮЖЕТНЫЙ ПРЕДМЕТ (выпадает с босса — обрабатывается в campaign) ===

  return {
    id: 'chapter1',
    width: W, height: H,
    tileSize: 20,
    tiles: grid,
    entities: entities,
    triggers: triggers,
    rooms: roomDefs,
    startPos: { x: 5, y: 5 },
    bossArena: bossArena,
    bossId: 'boss_skeleton_knight',
    crystalDrop: 'crystal_shard_1',
  };
}


/* ============================================================
   ГЛАВА 2: Проклятый лес (50x50)
   Открытая карта с тропами, деревьями, болотами, друидские круги.
   ============================================================ */
function _buildChapter2() {
  const W = 50, H = 50;
  const grid = _createEmptyGrid(W, H, 9); // Весь пол — трава
  const rng = _seedRandom(42002);
  const rooms = [];
  const entities = [];
  const triggers = [];

  // Деревья (непроходимые) — заполняем границы и кластеры
  // Границы
  for (let x = 0; x < W; x++) { grid[0][x] = 0; grid[H-1][x] = 0; }
  for (let y = 0; y < H; y++) { grid[y][0] = 0; grid[y][W-1] = 0; }
  // Второй слой границ
  for (let x = 0; x < W; x++) { grid[1][x] = 0; grid[H-2][x] = 0; }
  for (let y = 0; y < H; y++) { grid[y][1] = 0; grid[y][W-2] = 0; }

  // Кластеры деревьев (создаём лесную текстуру)
  for (let i = 0; i < 180; i++) {
    const cx = Math.floor(rng() * (W - 6)) + 3;
    const cy = Math.floor(rng() * (H - 6)) + 3;
    const size = Math.floor(rng() * 3) + 1;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        if (cy + dy < H && cx + dx < W) grid[cy + dy][cx + dx] = 0;
      }
    }
  }


  // Поляны (комнаты)
  const clearings = [
    { x: 3, y: 3, w: 8, h: 7, isStart: true, name: 'forest_entrance' },
    { x: 20, y: 3, w: 9, h: 7, name: 'wolf_den' },
    { x: 38, y: 3, w: 9, h: 7, name: 'troll_clearing' },
    { x: 3, y: 15, w: 7, h: 7, name: 'druid_circle1' },
    { x: 20, y: 15, w: 10, h: 9, name: 'central_clearing' },
    { x: 38, y: 15, w: 9, h: 8, name: 'wisp_grove' },
    { x: 3, y: 28, w: 8, h: 7, name: 'swamp_edge' },
    { x: 20, y: 28, w: 10, h: 8, name: 'deep_swamp' },
    { x: 38, y: 28, w: 9, h: 7, name: 'second_gate' },
    { x: 3, y: 40, w: 8, h: 7, name: 'druid_circle2' },
    { x: 20, y: 40, w: 12, h: 8, name: 'boss_glade' },
    { x: 38, y: 40, w: 9, h: 7, name: 'treasure_grove' },
  ];

  for (const r of clearings) {
    _carveRoom(grid, r.x, r.y, r.w, r.h, 9);
    rooms.push(r);
  }

  // Тропы между полянами (ширина 3)
  _carveCorridor(grid, 10, 6, 20, 6, 3);
  _carveCorridor(grid, 28, 6, 38, 6, 3);
  _carveCorridor(grid, 6, 9, 6, 15, 3);
  _carveCorridor(grid, 24, 9, 24, 15, 3);
  _carveCorridor(grid, 42, 9, 42, 15, 3);
  _carveCorridor(grid, 9, 18, 20, 18, 3);
  _carveCorridor(grid, 29, 19, 38, 19, 3);
  _carveCorridor(grid, 6, 21, 6, 28, 3);
  _carveCorridor(grid, 25, 23, 25, 28, 3);
  _carveCorridor(grid, 42, 22, 42, 28, 3);
  _carveCorridor(grid, 10, 31, 20, 31, 3);
  _carveCorridor(grid, 29, 31, 38, 31, 3);
  _carveCorridor(grid, 6, 34, 6, 40, 3);
  _carveCorridor(grid, 25, 35, 25, 40, 3);
  _carveCorridor(grid, 42, 34, 42, 40, 3);
  _carveCorridor(grid, 10, 43, 20, 43, 3);
  _carveCorridor(grid, 31, 43, 38, 43, 3);
  // Тропы в grid используют tile=9 (grass)
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      if (grid[y][x] === 1) grid[y][x] = 9;
    }
  }


  // Болота (20% площади — в нижней части)
  for (let y = 28; y < 36; y++) {
    for (let x = 3; x < 34; x++) {
      if (grid[y][x] === 9 && rng() < 0.35) {
        grid[y][x] = 5; // swamp
      }
    }
  }
  // Водяные тайлы в deep_swamp
  for (let y = 29; y < 35; y++) {
    for (let x = 21; x < 29; x++) {
      if (grid[y][x] === 9 && rng() < 0.3) {
        grid[y][x] = 4; // water
      }
    }
  }

  // === ВРАГИ ===
  // Волки (12 шт., стаями по 2-3)
  const wolfPacks = [[21,4],[22,5],[23,4], [22,16],[23,17], [7,29],[8,30],
    [24,29],[25,30], [39,29],[40,30], [7,42],[8,43]];
  for (const [ex, ey] of wolfPacks) {
    entities.push({ type: 'goblin', x: ex, y: ey, hpMul: 1.3 }); // используем goblin как волков
  }

  // Лесные тролли (4 шт., элитные) — guardKey на одном
  entities.push({ type: 'rotgolem', x: 40, y: 5, hpMul: 2.0, elite: true, guardKey: 'forest_key_1' });
  entities.push({ type: 'rotgolem', x: 41, y: 16, hpMul: 1.8, elite: true });
  entities.push({ type: 'rotgolem', x: 5, y: 30, hpMul: 1.8, elite: true });
  entities.push({ type: 'rotgolem', x: 40, y: 42, hpMul: 1.8, elite: true });

  // Болотные огоньки (5 шт., летающие)
  const wispPos = [[39,16],[40,17],[41,18],[24,30],[26,31]];
  for (const [ex, ey] of wispPos) {
    entities.push({ type: 'bat', x: ex, y: ey, hpMul: 1.5 });
  }

  // Стая волков-стража для ключа 2
  entities.push({ type: 'goblin', x: 39, y: 43, hpMul: 2.0, guardKey: 'forest_key_2' });
  entities.push({ type: 'goblin', x: 40, y: 44, hpMul: 2.0 });
  entities.push({ type: 'goblin', x: 41, y: 43, hpMul: 2.0 });


  // === ЛОВУШКИ ===
  // Ядовитые лианы (12 шт.) вдоль троп
  const vinePos = [[11,6],[12,6],[15,6],[30,6],[31,6],[8,18],[9,18],
    [30,19],[31,19],[8,31],[9,31],[30,31]];
  for (const [vx, vy] of vinePos) {
    triggers.push({ kind: 'poison_vine', x: vx, y: vy, damagePct: 0.15, slowDuration: 3 });
  }

  // Капканы (6 шт.)
  const trapPos = [[14,6],[35,6],[14,18],[35,19],[14,31],[35,43]];
  for (const [tx, ty] of trapPos) {
    triggers.push({ kind: 'wolf_trap', x: tx, y: ty, damagePct: 0.25, stunDuration: 2 });
  }

  // === РУНЫ (2 шт.) в друидских кругах ===
  triggers.push({ kind: 'rune_regen', x: 5, y: 17, effect: { regenPct: 0.03, duration: 30 } });
  triggers.push({ kind: 'rune_nature', x: 5, y: 42, effect: { duration: 60 } });

  // === КЛЮЧИ/ДВЕРИ ===
  // Двое врат к боссу (нужны 2 ключа)
  triggers.push({ kind: 'locked_door', x: 20, y: 40, doorW: 2, doorH: 1, requiredKey: 'forest_key_1' });
  triggers.push({ kind: 'locked_door', x: 30, y: 40, doorW: 2, doorH: 1, requiredKey: 'forest_key_2' });
  grid[40][20] = 0; grid[40][21] = 0;
  grid[40][30] = 0; grid[40][31] = 0;

  return {
    id: 'chapter2',
    width: W, height: H,
    tileSize: 20,
    tiles: grid,
    entities: entities,
    triggers: triggers,
    rooms: clearings,
    startPos: { x: 6, y: 6 },
    bossArena: { x: 20, y: 40, w: 12, h: 8 },
    bossId: 'boss_ancient_ent',
    crystalDrop: 'crystal_shard_2',
  };
}


/* ============================================================
   ГЛАВА 3: Горнило огня (50x50)
   Вулканические пещеры, реки лавы, кузни, мосты.
   Линейная карта с ответвлениями.
   ============================================================ */
function _buildChapter3() {
  const W = 50, H = 50;
  const grid = _createEmptyGrid(W, H, 0);
  const rng = _seedRandom(42003);
  const rooms = [];
  const entities = [];
  const triggers = [];

  // Комнаты (линейно с ответвлениями)
  const roomDefs = [
    { x: 2, y: 2, w: 10, h: 8, isStart: true, name: 'cavern_entrance' },
    { x: 2, y: 14, w: 9, h: 8, name: 'lava_shore' },
    { x: 16, y: 14, w: 10, h: 8, name: 'ember_hall' },
    { x: 32, y: 14, w: 10, h: 8, name: 'golem_bridge' },
    { x: 2, y: 26, w: 9, h: 8, name: 'side_forge' },
    { x: 16, y: 26, w: 12, h: 9, name: 'main_forge' },
    { x: 34, y: 26, w: 10, h: 8, name: 'rune_vault' },
    { x: 2, y: 38, w: 9, h: 9, name: 'obsidian_cave' },
    { x: 16, y: 38, w: 12, h: 10, name: 'fire_lord_arena' },
    { x: 34, y: 38, w: 10, h: 9, name: 'crystal_chamber' },
    { x: 38, y: 2, w: 9, h: 8, name: 'rune_explosion_room' },
  ];

  for (const r of roomDefs) {
    _carveRoom(grid, r.x, r.y, r.w, r.h, 1);
    rooms.push(r);
  }

  // Соединяем коридорами
  _carveCorridor(grid, 6, 9, 6, 14, 2);      // entrance -> lava_shore
  _carveCorridor(grid, 10, 17, 16, 17, 2);   // lava_shore -> ember_hall
  _carveCorridor(grid, 25, 17, 32, 17, 2);   // ember_hall -> golem_bridge
  _carveCorridor(grid, 6, 21, 6, 26, 2);     // lava_shore -> side_forge
  _carveCorridor(grid, 10, 30, 16, 30, 2);   // side_forge -> main_forge
  _carveCorridor(grid, 22, 20, 22, 26, 2);   // ember_hall -> main_forge
  _carveCorridor(grid, 27, 30, 34, 30, 2);   // main_forge -> rune_vault
  _carveCorridor(grid, 37, 21, 37, 26, 2);   // golem_bridge -> rune_vault
  _carveCorridor(grid, 6, 33, 6, 38, 2);     // side_forge -> obsidian_cave
  _carveCorridor(grid, 10, 42, 16, 42, 2);   // obsidian_cave -> fire_lord_arena
  _carveCorridor(grid, 22, 34, 22, 38, 2);   // main_forge -> fire_lord_arena
  _carveCorridor(grid, 27, 43, 34, 43, 2);   // fire_lord_arena -> crystal_chamber
  _carveCorridor(grid, 39, 33, 39, 38, 2);   // rune_vault -> crystal_chamber
  _carveCorridor(grid, 11, 5, 38, 5, 2);     // entrance -> rune_explosion_room (длинный верхний)
  _carveCorridor(grid, 40, 9, 40, 14, 2);    // rune_explosion_room -> golem_bridge area


  // Лавовые реки (непроходимые зоны + урон)
  // Река между lava_shore и ember_hall (нужен мост)
  for (let y = 12; y < 22; y++) {
    for (let x = 12; x < 15; x++) {
      if (grid[y] && grid[y][x] === 1) grid[y][x] = 3; // lava
    }
  }
  // Мост через лаву (проходимый)
  grid[17][12] = 12; grid[17][13] = 12; grid[17][14] = 12;
  grid[18][12] = 12; grid[18][13] = 12; grid[18][14] = 12;

  // Вторая река лавы между main_forge и fire_lord_arena
  for (let y = 34; y < 38; y++) {
    for (let x = 14; x < 28; x++) {
      if (grid[y] && grid[y][x] === 0) continue;
      if (y >= 34 && y <= 36 && grid[y][x] === 1) grid[y][x] = 3;
    }
  }
  // Мосты
  grid[35][16] = 12; grid[35][17] = 12; grid[36][16] = 12; grid[36][17] = 12;
  grid[35][22] = 12; grid[35][23] = 12; grid[36][22] = 12; grid[36][23] = 12;

  // Обсидиановый пол в нижних комнатах
  for (let y = 38; y < 48; y++) {
    for (let x = 2; x < 45; x++) {
      if (grid[y] && grid[y][x] === 1 && rng() < 0.3) {
        grid[y][x] = 10; // obsidian
      }
    }
  }

  // === ВРАГИ ===
  // Огненные бесы (18 шт.)
  const impPos = [
    [4,15],[5,16],[7,15],[18,15],[19,16],[20,15],[22,16],
    [34,15],[35,16],[36,15],[4,27],[5,28],[18,27],[19,28],
    [20,29],[35,27],[36,28],[37,29]
  ];
  for (const [ex, ey] of impPos) {
    entities.push({ type: 'goblin', x: ex, y: ey, hpMul: 1.2 });
  }

  // Лавовые слизни (6 шт.)
  const slugPos = [[4,19],[8,20],[18,19],[19,20],[34,19],[35,20]];
  for (const [ex, ey] of slugPos) {
    entities.push({ type: 'ooze', x: ex, y: ey, hpMul: 1.5 });
  }

  // Огненные элементали (5 шт., элитные)
  const elemPos = [[20,28],[21,29],[36,29],[37,30],[22,39]];
  for (const [ex, ey] of elemPos) {
    entities.push({ type: 'fire_elem', x: ex, y: ey, hpMul: 1.8, elite: true });
  }


  // Страж моста (мини-босс fire_golem) — дропает forge_key
  entities.push({ type: 'fire_elem', x: 36, y: 17, hpMul: 4.0, elite: true, guardKey: 'forge_key' });

  // === ЛОВУШКИ ===
  // Огненные гейзеры (7 шт.)
  const geyserPos = [[5,17],[8,18],[20,17],[34,17],[20,29],[36,30],[22,41]];
  for (const [gx, gy] of geyserPos) {
    triggers.push({ kind: 'fire_geyser', x: gx, y: gy, interval: 5, radius: 1.5, damagePct: 0.30 });
  }

  // Обжигающий пол (12 тайлов)
  const burnPos = [[13,17],[14,17],[13,18],[26,17],[27,17],[26,18],
    [15,35],[16,35],[23,35],[24,35],[13,42],[14,42]];
  for (const [bx, by] of burnPos) {
    triggers.push({ kind: 'burning_floor', x: bx, y: by, dpsPct: 0.05 });
  }

  // === РУНЫ (3 шт.) ===
  triggers.push({ kind: 'rune_firepower', x: 4, y: 29, effect: { fireDmg: 0.25, duration: 45 } });
  triggers.push({ kind: 'rune_fireresist', x: 36, y: 29, effect: { resistPct: 0.50, duration: 60 } });
  triggers.push({ kind: 'rune_explosion', x: 41, y: 5, effect: { dmgPct: 0.50 } });

  // === КЛЮЧИ/ДВЕРИ ===
  // Дверь к арене Fire Lord
  triggers.push({ kind: 'locked_door', x: 16, y: 38, doorW: 2, doorH: 1, requiredKey: 'forge_key' });
  grid[38][16] = 0; grid[38][17] = 0;

  // Дополнительная дверь к руне взрыва
  triggers.push({ kind: 'locked_door', x: 38, y: 5, doorW: 1, doorH: 2, requiredKey: 'explosion_key' });
  grid[5][38] = 0; grid[6][38] = 0;
  // Сундук с ключом к руне
  triggers.push({ kind: 'chest', x: 8, y: 4, containsKey: 'explosion_key' });

  return {
    id: 'chapter3',
    width: W, height: H,
    tileSize: 20,
    tiles: grid,
    entities: entities,
    triggers: triggers,
    rooms: roomDefs,
    startPos: { x: 6, y: 5 },
    bossArena: { x: 16, y: 38, w: 12, h: 10 },
    bossId: 'boss_fire_lord',
    guardianBossId: 'boss_magma_giant',
    crystalDrop: 'crystal_shard_3',
  };
}


/* ============================================================
   ГЛАВА 4: Тронный зал Тьмы (50x50)
   Готический замок, библиотеки, оружейная, тронный зал.
   Два мини-босса + финальный босс с 2 фазами.
   ============================================================ */
function _buildChapter4() {
  const W = 50, H = 50;
  const grid = _createEmptyGrid(W, H, 0);
  const rng = _seedRandom(42004);
  const rooms = [];
  const entities = [];
  const triggers = [];

  // Комнаты замка
  const roomDefs = [
    { x: 2, y: 2, w: 10, h: 8, isStart: true, name: 'castle_gate' },
    { x: 18, y: 2, w: 12, h: 8, name: 'great_hall' },
    { x: 36, y: 2, w: 11, h: 8, name: 'armory' },
    { x: 2, y: 14, w: 10, h: 9, name: 'guard_quarters' },
    { x: 18, y: 14, w: 14, h: 10, name: 'grand_library' },
    { x: 38, y: 14, w: 9, h: 9, name: 'ritual_room' },
    { x: 2, y: 28, w: 10, h: 8, name: 'dungeon_cells' },
    { x: 18, y: 28, w: 14, h: 9, name: 'gallery' },
    { x: 38, y: 28, w: 9, h: 8, name: 'treasury' },
    { x: 2, y: 40, w: 10, h: 8, name: 'chapel' },
    { x: 15, y: 40, w: 20, h: 9, name: 'throne_room' },
    { x: 38, y: 40, w: 9, h: 8, name: 'portal_room' },
  ];

  for (const r of roomDefs) {
    _carveRoom(grid, r.x, r.y, r.w, r.h, 1);
    rooms.push(r);
  }


  // Коридоры
  _carveCorridor(grid, 11, 5, 18, 5, 2);     // castle_gate -> great_hall
  _carveCorridor(grid, 29, 5, 36, 5, 2);     // great_hall -> armory
  _carveCorridor(grid, 6, 9, 6, 14, 2);      // castle_gate -> guard_quarters
  _carveCorridor(grid, 24, 9, 24, 14, 2);    // great_hall -> grand_library
  _carveCorridor(grid, 42, 9, 42, 14, 2);    // armory -> ritual_room
  _carveCorridor(grid, 11, 17, 18, 17, 2);   // guard_quarters -> grand_library
  _carveCorridor(grid, 31, 18, 38, 18, 2);   // grand_library -> ritual_room
  _carveCorridor(grid, 6, 22, 6, 28, 2);     // guard_quarters -> dungeon_cells
  _carveCorridor(grid, 24, 23, 24, 28, 2);   // grand_library -> gallery
  _carveCorridor(grid, 42, 22, 42, 28, 2);   // ritual_room -> treasury
  _carveCorridor(grid, 11, 31, 18, 31, 2);   // dungeon_cells -> gallery
  _carveCorridor(grid, 31, 31, 38, 31, 2);   // gallery -> treasury
  _carveCorridor(grid, 6, 35, 6, 40, 2);     // dungeon_cells -> chapel
  _carveCorridor(grid, 11, 43, 15, 43, 2);   // chapel -> throne_room
  _carveCorridor(grid, 25, 36, 25, 40, 2);   // gallery -> throne_room
  _carveCorridor(grid, 34, 43, 38, 43, 2);   // throne_room -> portal_room
  _carveCorridor(grid, 42, 35, 42, 40, 2);   // treasury -> portal_room

  // Ковровые дорожки в главных залах
  for (let y = 41; y < 48; y++) {
    for (let x = 24; x < 26; x++) {
      if (grid[y] && grid[y][x] === 1) grid[y][x] = 11; // carpet
    }
  }
  for (let y = 2; y < 9; y++) {
    for (let x = 23; x < 25; x++) {
      if (grid[y] && grid[y][x] === 1) grid[y][x] = 11; // carpet
    }
  }
  // Ковёр в тронном зале
  for (let y = 42; y < 47; y++) {
    for (let x = 20; x < 30; x++) {
      if (grid[y] && grid[y][x] === 1) grid[y][x] = 11;
    }
  }


  // Колонны в тронном зале
  const colPositions = [[17,42],[17,46],[33,42],[33,46],[22,42],[22,46],[28,42],[28,46]];
  for (const [cx, cy] of colPositions) {
    if (grid[cy] && grid[cy][cx] !== undefined) grid[cy][cx] = 0;
  }

  // === ВРАГИ ===
  // Тени (18 шт.)
  const shadowPos = [
    [20,3],[22,4],[25,3],[27,4],[3,15],[4,16],[6,15],
    [20,15],[22,16],[24,17],[26,15],[3,29],[5,30],[7,29],
    [20,29],[22,30],[25,29],[27,30]
  ];
  for (const [ex, ey] of shadowPos) {
    entities.push({ type: 'shadow', x: ex, y: ey });
  }

  // Тёмные рыцари (6 шт., элитные)
  const knightPos = [[38,4],[40,5],[42,4],[39,15],[41,16],[40,29]];
  for (const [ex, ey] of knightPos) {
    entities.push({ type: 'captain', x: ex, y: ey, hpMul: 2.0, elite: true });
  }

  // Маги-культисты (4 шт., дальний бой)
  const cultistPos = [[40,16],[41,17],[3,42],[5,43]];
  for (const [ex, ey] of cultistPos) {
    entities.push({ type: 'cultist', x: ex, y: ey, hpMul: 1.5 });
  }

  // Стражи ключей (мини-боссы)
  // Лич в библиотеке — дропает dark_key_1
  entities.push({ type: 'mage', x: 24, y: 17, hpMul: 5.0, elite: true, guardKey: 'dark_key_1' });
  // Теневой рыцарь в оружейной — дропает dark_key_2
  entities.push({ type: 'captain', x: 41, y: 5, hpMul: 5.0, elite: true, guardKey: 'dark_key_2' });


  // === ЛОВУШКИ ===
  // Магические мины (11 шт., невидимые)
  const minePos = [[13,5],[15,5],[26,5],[28,5],[13,17],[30,17],
    [13,31],[26,31],[28,31],[18,43],[30,43]];
  for (const [mx, my] of minePos) {
    triggers.push({ kind: 'magic_mine', x: mx, y: my, damagePct: 0.25 });
  }

  // Ловушки с дротиками (5 линий)
  triggers.push({ kind: 'dart_trap', x: 11, y: 5, w: 6, h: 1, damagePct: 0.10 });
  triggers.push({ kind: 'dart_trap', x: 29, y: 5, w: 6, h: 1, damagePct: 0.10 });
  triggers.push({ kind: 'dart_trap', x: 11, y: 17, w: 6, h: 1, damagePct: 0.10 });
  triggers.push({ kind: 'dart_trap', x: 31, y: 18, w: 6, h: 1, damagePct: 0.10 });
  triggers.push({ kind: 'dart_trap', x: 11, y: 31, w: 6, h: 1, damagePct: 0.10 });

  // Проклятые книги (4 шт.) в библиотеке
  triggers.push({ kind: 'cursed_book', x: 20, y: 15 });
  triggers.push({ kind: 'cursed_book', x: 25, y: 16 });
  triggers.push({ kind: 'cursed_book', x: 28, y: 15 });
  triggers.push({ kind: 'cursed_book', x: 22, y: 21 });

  // === РУНЫ (2 шт.) ===
  triggers.push({ kind: 'rune_shield', x: 4, y: 42, effect: { shieldPct: 0.50, duration: 30 } });
  triggers.push({ kind: 'rune_summon', x: 40, y: 30, effect: { duration: 60 } });


  // === КЛЮЧИ/ДВЕРИ ===
  // Врата в тронный зал (нужны оба ключа)
  triggers.push({ kind: 'locked_door', x: 15, y: 43, doorW: 2, doorH: 1, requiredKey: 'dark_key_1' });
  triggers.push({ kind: 'locked_door', x: 33, y: 43, doorW: 2, doorH: 1, requiredKey: 'dark_key_2' });
  grid[43][15] = 0; grid[43][16] = 0;
  grid[43][33] = 0; grid[43][34] = 0;

  return {
    id: 'chapter4',
    width: W, height: H,
    tileSize: 20,
    tiles: grid,
    entities: entities,
    triggers: triggers,
    rooms: roomDefs,
    startPos: { x: 6, y: 5 },
    bossArena: { x: 15, y: 40, w: 20, h: 9 },
    bossId: 'boss_ancient_dragon',
    miniBosses: ['boss_lich', 'boss_dark_knight'],
    crystalDrop: null, // Финальная глава
    requiredItems: ['crystal_shard_1', 'crystal_shard_2', 'crystal_shard_3'],
    isFinalChapter: true,
  };
}


/* ============================================================
   Построение и экспорт всех карт
   ============================================================ */
STORY_MAPS.chapter1 = _buildChapter1();
STORY_MAPS.chapter2 = _buildChapter2();
STORY_MAPS.chapter3 = _buildChapter3();
STORY_MAPS.chapter4 = _buildChapter4();

window.STORY_MAPS = STORY_MAPS;

'use strict';
/* ============================================================
   biome-previews.js — Генерация мини-превью карт для экрана
   выбора биома (испытания).

   Создаёт канвас 128x96 для каждого биома с процедурной
   мини-картой (комнаты, коридоры, декор).

   Экспорт: window.BIOME_PREVIEWS, window.initBiomePreviews
   ============================================================ */

const BIOME_PREVIEWS = {};

/**
 * Простой PRNG (Mulberry32) для детерминированной генерации превью.
 */
function _previewRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Генерация мини-карты подземелья на канвасе.
 * @param {CanvasRenderingContext2D} ctx - Контекст канваса
 * @param {number} w - Ширина канваса
 * @param {number} h - Высота канваса
 * @param {Object} biome - Объект биома из BIOMES
 * @param {number} seed - Сид для PRNG
 */
function _generateMiniDungeon(ctx, w, h, biome, seed) {
  const rng = _previewRng(seed);
  const tileSize = 4;
  const cols = Math.floor(w / tileSize);
  const rows = Math.floor(h / tileSize);

  // Создаём сетку (0 = стена, 1 = пол)
  const grid = [];
  for (let y = 0; y < rows; y++) {
    grid[y] = new Array(cols).fill(0);
  }

  // Генерируем 4-7 комнат
  const rooms = [];
  const roomCount = 4 + Math.floor(rng() * 4);

  for (let i = 0; i < roomCount; i++) {
    const rw = 3 + Math.floor(rng() * 5);
    const rh = 3 + Math.floor(rng() * 4);
    const rx = 1 + Math.floor(rng() * (cols - rw - 2));
    const ry = 1 + Math.floor(rng() * (rows - rh - 2));

    // Проверяем, не пересекается ли с существующей комнатой
    let overlap = false;
    for (const room of rooms) {
      if (rx < room.x + room.w + 1 && rx + rw + 1 > room.x &&
          ry < room.y + room.h + 1 && ry + rh + 1 > room.y) {
        overlap = true;
        break;
      }
    }
    if (overlap) continue;

    rooms.push({ x: rx, y: ry, w: rw, h: rh });

    // Вырезаем комнату
    for (let dy = 0; dy < rh; dy++) {
      for (let dx = 0; dx < rw; dx++) {
        const ty = ry + dy;
        const tx = rx + dx;
        if (ty >= 0 && ty < rows && tx >= 0 && tx < cols) {
          grid[ty][tx] = 1;
        }
      }
    }
  }

  // Соединяем комнаты коридорами
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];
    const ax = Math.floor(a.x + a.w / 2);
    const ay = Math.floor(a.y + a.h / 2);
    const bx = Math.floor(b.x + b.w / 2);
    const by = Math.floor(b.y + b.h / 2);

    // Горизонтальный участок
    const minX = Math.min(ax, bx);
    const maxX = Math.max(ax, bx);
    for (let x = minX; x <= maxX; x++) {
      if (ay >= 0 && ay < rows && x >= 0 && x < cols) {
        grid[ay][x] = 1;
      }
    }
    // Вертикальный участок
    const minY = Math.min(ay, by);
    const maxY = Math.max(ay, by);
    for (let y = minY; y <= maxY; y++) {
      if (y >= 0 && y < rows && bx >= 0 && bx < cols) {
        grid[y][bx] = 1;
      }
    }
  }

  // Рисуем сетку
  const wallColor = biome.wallColor || '#1a1a2e';
  const floorColor = biome.floorColor || '#3d3d5c';
  const corridorColor = biome.corridorColor || '#2a2a2a';

  // Фон (стены)
  ctx.fillStyle = wallColor;
  ctx.fillRect(0, 0, w, h);

  // Рисуем пол
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 1) {
        // Определяем, это комната или коридор
        let isRoom = false;
        for (const room of rooms) {
          if (x >= room.x && x < room.x + room.w &&
              y >= room.y && y < room.y + room.h) {
            isRoom = true;
            break;
          }
        }
        ctx.fillStyle = isRoom ? floorColor : corridorColor;
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);

        // Сетка на полу (тонкие линии)
        ctx.fillStyle = biome.floorGridColor || '#444';
        ctx.globalAlpha = 0.3;
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, 1);
        ctx.fillRect(x * tileSize, y * tileSize, 1, tileSize);
        ctx.globalAlpha = 1.0;
      }
    }
  }

  // Добавляем декоративные элементы в комнатах
  for (const room of rooms) {
    // Пара декоративных точек внутри
    const decorCount = 1 + Math.floor(rng() * 3);
    for (let d = 0; d < decorCount; d++) {
      const dx = room.x + 1 + Math.floor(rng() * (room.w - 2));
      const dy = room.y + 1 + Math.floor(rng() * (room.h - 2));
      if (dx < cols && dy < rows) {
        ctx.fillStyle = biome.pillarColor || '#4a4a4a';
        ctx.globalAlpha = 0.7;
        ctx.fillRect(dx * tileSize + 1, dy * tileSize + 1, tileSize - 2, tileSize - 2);
        ctx.globalAlpha = 1.0;
      }
    }
  }

  // Мозаичный оверлей (стилизация биома)
  if (biome.mosaicColor) {
    ctx.fillStyle = biome.mosaicColor;
    ctx.fillRect(0, 0, w, h);
  }

  // Добавляем точки — "факелы" или "свечение"
  const glowCount = 3 + Math.floor(rng() * 4);
  for (let i = 0; i < glowCount; i++) {
    const roomIdx = Math.floor(rng() * rooms.length);
    const room = rooms[roomIdx];
    if (!room) continue;
    const gx = (room.x + 1 + Math.floor(rng() * (room.w - 2))) * tileSize + tileSize / 2;
    const gy = (room.y + 1 + Math.floor(rng() * (room.h - 2))) * tileSize + tileSize / 2;

    const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, tileSize * 2.5);
    grad.addColorStop(0, 'rgba(255, 200, 80, 0.4)');
    grad.addColorStop(1, 'rgba(255, 200, 80, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(gx - tileSize * 3, gy - tileSize * 3, tileSize * 6, tileSize * 6);
  }

  // Виньетка по краям
  const vGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w * 0.7);
  vGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, w, h);
}

/**
 * Инициализация превью для всех биомов.
 * Создаёт канвас 128x96 для каждого биома.
 */
function initBiomePreviews() {
  const biomes = window.BIOMES || [];
  if (biomes.length === 0) return;

  const previewW = 128;
  const previewH = 96;

  // Сиды для каждого биома (детерминированные)
  const biomeSeeds = {
    crypt: 42,
    ice_caves: 73,
    fire_mines: 101,
    forest_ruins: 137,
    castle: 191,
    sky_citadel: 233,
    elven_forest: 277,
    mountain_keep: 311,
  };

  for (const biome of biomes) {
    const canvas = document.createElement('canvas');
    canvas.width = previewW;
    canvas.height = previewH;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const seed = biomeSeeds[biome.id] || (biome.id.length * 17 + 53);
    _generateMiniDungeon(ctx, previewW, previewH, biome, seed);

    BIOME_PREVIEWS[biome.id] = canvas;
  }
}

/* --- Экспорт --- */
window.BIOME_PREVIEWS = BIOME_PREVIEWS;
window.initBiomePreviews = initBiomePreviews;

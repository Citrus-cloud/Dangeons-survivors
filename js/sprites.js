'use strict';
/* ============================================================
   sprites.js — Пиксельные спрайты врагов (16x16, 24x24 для крупных).
   
   Генерируются программно через Canvas при старте игры.
   Кешируются в ENEMY_SPRITES для O(1) доступа.
   
   API:
   - initSprites()          — генерирует все спрайты, вызвать 1 раз
   - getEnemySprite(id)     — возвращает offscreen canvas спрайта
   - ENEMY_SPRITES          — кеш {id: canvas}
   ============================================================ */

const ENEMY_SPRITES = {};

/* ---------- Утилиты для рисования пикселей ---------- */

function _createSpriteCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

/** Нарисовать один пиксель */
function _px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

/** Нарисовать прямоугольник (пиксельный) */
function _rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Нарисовать линию (горизонтальную) */
function _hline(ctx, x, y, len, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, len, 1);
}

/** Нарисовать линию (вертикальную) */
function _vline(ctx, x, y, len, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, len);
}

/** Зеркальное рисование (симметрия по вертикальной оси) */
function _mirror(ctx, size, drawLeft) {
  drawLeft(ctx);
  // Зеркалим левую половину направо
  const imgData = ctx.getImageData(0, 0, Math.ceil(size / 2), size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < Math.ceil(size / 2); x++) {
      const srcIdx = (y * Math.ceil(size / 2) + x) * 4;
      if (imgData.data[srcIdx + 3] > 0) {
        const mirrorX = size - 1 - x;
        ctx.fillStyle = `rgba(${imgData.data[srcIdx]},${imgData.data[srcIdx+1]},${imgData.data[srcIdx+2]},${imgData.data[srcIdx+3]/255})`;
        ctx.fillRect(mirrorX, y, 1, 1);
      }
    }
  }
}

/** Залить контур (чёрная обводка 1px вокруг непрозрачных пикселей) */
function _addOutline(ctx, size, outlineColor) {
  outlineColor = outlineColor || '#000000';
  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;
  const outline = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      if (d[idx + 3] === 0) {
        // Проверяем соседей
        const neighbors = [
          [x-1,y],[x+1,y],[x,y-1],[x,y+1]
        ];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            const nIdx = (ny * size + nx) * 4;
            if (d[nIdx + 3] > 0) {
              outline.push([x, y]);
              break;
            }
          }
        }
      }
    }
  }
  ctx.fillStyle = outlineColor;
  for (const [x, y] of outline) {
    ctx.fillRect(x, y, 1, 1);
  }
}

/* ============================================================
   Шаблоны (templates) для категорий врагов
   ============================================================ */

/** Базовый шаблон скелета 16x16 */
function _drawSkeletonBase(ctx, bodyColor, eyeColor) {
  const bc = bodyColor || '#e8dcc8';
  const ec = eyeColor || '#ff3333';
  // Череп (4x4 в верхней части)
  _rect(ctx, 6, 1, 4, 4, bc);
  // Глаза
  _px(ctx, 7, 2, ec);
  _px(ctx, 9, 2, ec);
  // Зубы
  _px(ctx, 7, 4, '#aaa');
  _px(ctx, 8, 4, '#aaa');
  _px(ctx, 9, 4, '#aaa');
  // Шея
  _px(ctx, 8, 5, bc);
  // Рёбра (грудная клетка)
  _vline(ctx, 8, 6, 4, bc);
  _hline(ctx, 6, 6, 5, bc);
  _hline(ctx, 6, 8, 5, bc);
  // Плечи
  _px(ctx, 5, 6, bc);
  _px(ctx, 11, 6, bc);
  // Руки
  _vline(ctx, 5, 7, 3, bc);
  _vline(ctx, 11, 7, 3, bc);
  // Таз
  _hline(ctx, 7, 10, 3, bc);
  // Ноги
  _vline(ctx, 7, 11, 4, bc);
  _vline(ctx, 9, 11, 4, bc);
}

/** Базовый шаблон гуманоида 16x16 */
function _drawHumanoidBase(ctx, skinColor, clothColor) {
  // Голова
  _rect(ctx, 6, 1, 4, 4, skinColor);
  // Тело
  _rect(ctx, 6, 5, 4, 5, clothColor);
  // Руки
  _vline(ctx, 5, 5, 5, clothColor);
  _vline(ctx, 10, 5, 5, clothColor);
  // Ноги
  _vline(ctx, 7, 10, 4, clothColor);
  _vline(ctx, 9, 10, 4, clothColor);
}

/** Базовый шаблон паука 16x16 */
function _drawSpiderBase(ctx, bodyColor, legColor) {
  // Тело (овал 6x4)
  _rect(ctx, 5, 6, 6, 4, bodyColor);
  _rect(ctx, 6, 5, 4, 6, bodyColor);
  // Голова (3x3)
  _rect(ctx, 7, 3, 3, 3, bodyColor);
  // Ноги (8 штук)
  const lc = legColor || '#333';
  // Левые ноги
  _px(ctx, 4, 5, lc); _px(ctx, 3, 4, lc);
  _px(ctx, 4, 7, lc); _px(ctx, 3, 7, lc); _px(ctx, 2, 8, lc);
  _px(ctx, 4, 9, lc); _px(ctx, 3, 10, lc);
  _px(ctx, 4, 11, lc); _px(ctx, 3, 12, lc);
  // Правые ноги
  _px(ctx, 12, 5, lc); _px(ctx, 13, 4, lc);
  _px(ctx, 12, 7, lc); _px(ctx, 13, 7, lc); _px(ctx, 14, 8, lc);
  _px(ctx, 12, 9, lc); _px(ctx, 13, 10, lc);
  _px(ctx, 12, 11, lc); _px(ctx, 13, 12, lc);
}

/** Базовый шаблон слизня 16x16 */
function _drawSlimeBase(ctx, color, eyeColor) {
  // Тело (каплевидная форма)
  _rect(ctx, 4, 8, 8, 5, color);
  _rect(ctx, 5, 6, 6, 2, color);
  _rect(ctx, 6, 5, 4, 1, color);
  _rect(ctx, 3, 10, 10, 3, color);
  // Блик
  _px(ctx, 6, 7, '#ffffff');
  // Глаза
  const ec = eyeColor || '#000';
  _px(ctx, 6, 9, ec);
  _px(ctx, 9, 9, ec);
}

/** Базовый шаблон элементаля 16x16 */
function _drawElementalBase(ctx, color1, color2, color3) {
  // Пламенеобразная форма
  _rect(ctx, 5, 9, 6, 5, color1);
  _rect(ctx, 6, 6, 4, 3, color1);
  _rect(ctx, 7, 4, 2, 2, color2);
  // Зубцы вверх
  _px(ctx, 6, 5, color2);
  _px(ctx, 9, 5, color2);
  _px(ctx, 7, 3, color3);
  _px(ctx, 8, 2, color3);
  // Глаза
  _px(ctx, 7, 8, '#fff');
  _px(ctx, 9, 8, '#fff');
  // Искры
  _px(ctx, 4, 7, color3);
  _px(ctx, 11, 6, color3);
  _px(ctx, 5, 4, color3);
}



/* ============================================================
   Генераторы спрайтов — Нежить
   ============================================================ */

function _sprite_skeleton(ctx) {
  _drawSkeletonBase(ctx, '#e8dcc8', '#ff3333');
  // Меч в правой руке
  _vline(ctx, 12, 6, 5, '#aaaaaa');
  _px(ctx, 12, 5, '#cccccc');
}

function _sprite_zombie(ctx) {
  const skin = '#6b8b4a';
  const cloth = '#4a3a2a';
  // Голова (неровная)
  _rect(ctx, 6, 2, 4, 4, skin);
  _px(ctx, 5, 3, skin);
  // Глаза
  _px(ctx, 7, 3, '#ff3333');
  _px(ctx, 9, 3, '#000');
  // Тело (рваная одежда)
  _rect(ctx, 6, 6, 4, 5, cloth);
  _px(ctx, 5, 7, cloth);
  _px(ctx, 10, 8, skin);
  // Руки (одна выше)
  _vline(ctx, 5, 5, 4, skin);
  _vline(ctx, 10, 6, 5, skin);
  // Ноги
  _vline(ctx, 7, 11, 4, cloth);
  _vline(ctx, 9, 11, 3, cloth);
  // Рваные края
  _px(ctx, 6, 10, skin);
  _px(ctx, 8, 11, skin);
}

function _sprite_ghost(ctx) {
  const gc = '#ffffff';
  // Овальное тело (полупрозрачный)
  _rect(ctx, 5, 3, 6, 8, gc);
  _rect(ctx, 4, 5, 8, 5, gc);
  _rect(ctx, 6, 2, 4, 1, gc);
  // Волнистый низ
  _px(ctx, 4, 11, gc);
  _px(ctx, 6, 12, gc);
  _px(ctx, 8, 12, gc);
  _px(ctx, 10, 11, gc);
  _px(ctx, 5, 12, gc);
  _px(ctx, 9, 12, gc);
  // Глаза (чёрные)
  _px(ctx, 6, 5, '#000');
  _px(ctx, 9, 5, '#000');
  // Рот
  _px(ctx, 7, 7, '#000');
  _px(ctx, 8, 7, '#000');
}

function _sprite_lich_minor(ctx) {
  const cloak = '#1a0033';
  const skull = '#e8dcc8';
  // Плащ
  _rect(ctx, 5, 4, 6, 10, cloak);
  _rect(ctx, 4, 6, 8, 7, cloak);
  _rect(ctx, 3, 10, 10, 4, cloak);
  // Капюшон
  _rect(ctx, 5, 2, 6, 3, cloak);
  _rect(ctx, 6, 1, 4, 1, cloak);
  // Череп внутри капюшона
  _rect(ctx, 6, 3, 4, 3, skull);
  // Глаза
  _px(ctx, 7, 4, '#ff3333');
  _px(ctx, 9, 4, '#ff3333');
  // Золотая корона
  _hline(ctx, 6, 2, 4, '#ffd700');
  _px(ctx, 6, 1, '#ffd700');
  _px(ctx, 9, 1, '#ffd700');
  // Посох (фиолетовый)
  _vline(ctx, 12, 3, 10, '#8b00ff');
  _px(ctx, 12, 2, '#cc66ff');
  // Фиолетовое свечение
  _px(ctx, 4, 5, '#6600cc');
  _px(ctx, 11, 5, '#6600cc');
}

function _sprite_archlich(ctx) {
  const cloak = '#0d0d0d';
  const gold = '#ffd700';
  // Плащ (крупный)
  _rect(ctx, 4, 4, 8, 10, cloak);
  _rect(ctx, 3, 6, 10, 8, cloak);
  // Капюшон
  _rect(ctx, 5, 1, 6, 4, cloak);
  // Череп
  _rect(ctx, 6, 2, 4, 3, '#e8dcc8');
  _px(ctx, 7, 3, '#ff0000');
  _px(ctx, 9, 3, '#ff0000');
  // Золотая корона + аура
  _hline(ctx, 5, 1, 6, gold);
  _px(ctx, 5, 0, gold);
  _px(ctx, 10, 0, gold);
  _px(ctx, 7, 0, gold);
  // Золотая аура по краям
  _px(ctx, 2, 6, gold);
  _px(ctx, 13, 6, gold);
  _px(ctx, 2, 10, gold);
  _px(ctx, 13, 10, gold);
  _px(ctx, 3, 14, gold);
  _px(ctx, 12, 14, gold);
  // Посох
  _vline(ctx, 13, 2, 11, '#8b00ff');
  _px(ctx, 13, 1, '#ff00ff');
}

function _sprite_death_knight(ctx) {
  const armor = '#2a2a2a';
  const eye = '#ff0000';
  // Латы (шлем)
  _rect(ctx, 6, 1, 4, 4, armor);
  _px(ctx, 5, 2, armor);
  _px(ctx, 10, 2, armor);
  // Красные глаза в прорези шлема
  _px(ctx, 7, 3, eye);
  _px(ctx, 9, 3, eye);
  // Тело (латы)
  _rect(ctx, 5, 5, 6, 6, armor);
  _rect(ctx, 4, 6, 8, 4, armor);
  // Наплечники
  _rect(ctx, 3, 5, 2, 2, '#3a3a3a');
  _rect(ctx, 11, 5, 2, 2, '#3a3a3a');
  // Ноги
  _vline(ctx, 6, 11, 4, armor);
  _vline(ctx, 7, 11, 4, armor);
  _vline(ctx, 9, 11, 4, armor);
  _vline(ctx, 10, 11, 4, armor);
  // Двуручный меч
  _vline(ctx, 13, 2, 8, '#888');
  _rect(ctx, 12, 2, 3, 1, '#aaa');
  _px(ctx, 13, 1, '#ccc');
  // Красный плащ сзади
  _px(ctx, 4, 10, '#8b0000');
  _px(ctx, 3, 11, '#8b0000');
  _px(ctx, 3, 12, '#8b0000');
}

function _sprite_archer(ctx) {
  _drawSkeletonBase(ctx, '#d9c08a', '#ff3333');
  // Лук в левой руке (коричневая дуга)
  _px(ctx, 3, 5, '#8b4513');
  _px(ctx, 3, 6, '#8b4513');
  _px(ctx, 3, 7, '#8b4513');
  _px(ctx, 3, 8, '#8b4513');
  _px(ctx, 4, 4, '#8b4513');
  _px(ctx, 4, 9, '#8b4513');
  // Тетива
  _vline(ctx, 4, 5, 4, '#ddd');
}

function _sprite_mage(ctx) {
  const cloak = '#7e57c2';
  // Скелет в фиолетовом плаще
  _rect(ctx, 5, 4, 6, 9, cloak);
  _rect(ctx, 4, 6, 8, 6, cloak);
  // Голова (череп)
  _rect(ctx, 6, 1, 4, 3, '#e8dcc8');
  _px(ctx, 7, 2, '#ff3333');
  _px(ctx, 9, 2, '#ff3333');
  // Капюшон
  _rect(ctx, 5, 1, 6, 2, cloak);
  _px(ctx, 6, 1, '#e8dcc8');
  _px(ctx, 9, 1, '#e8dcc8');
  // Посох
  _vline(ctx, 12, 2, 10, '#7e57c2');
  _px(ctx, 12, 1, '#dccff5');
  _px(ctx, 12, 0, '#fff');
}

function _sprite_captain(ctx) {
  _drawSkeletonBase(ctx, '#e8dcc8', '#ff3333');
  // Красный плащ
  _rect(ctx, 4, 6, 1, 6, '#c0392b');
  _rect(ctx, 3, 8, 1, 5, '#c0392b');
  // Золотая корона
  _hline(ctx, 6, 0, 4, '#ffd700');
  _px(ctx, 6, -1 < 0 ? 0 : 0, '#ffd700');
  _px(ctx, 7, 0, '#ffd700');
  _px(ctx, 9, 0, '#ffd700');
  // Меч
  _vline(ctx, 12, 5, 6, '#aaa');
}

function _sprite_alchemist_skel(ctx) {
  _drawSkeletonBase(ctx, '#e8dcc8', '#ff3333');
  // Зелёная колба в руке
  _rect(ctx, 3, 7, 2, 2, '#30b030');
  _px(ctx, 3, 6, '#30b030');
  _px(ctx, 4, 9, '#a0ffa0');
}

function _sprite_ratcatcher(ctx) {
  _drawSkeletonBase(ctx, '#e8dca0', '#ff3333');
  // Крыса у ног (коричневая)
  _rect(ctx, 10, 13, 3, 2, '#8b6914');
  _px(ctx, 13, 13, '#8b6914'); // хвост
  _px(ctx, 10, 13, '#000'); // глаз крысы
}

function _sprite_banshee(ctx) {
  const white = '#ffffff';
  // Женский силуэт с развевающимися волосами
  _rect(ctx, 6, 2, 4, 4, white);
  // Развевающиеся волосы
  _px(ctx, 5, 1, white);
  _px(ctx, 4, 0, white);
  _px(ctx, 10, 1, white);
  _px(ctx, 11, 0, white);
  _px(ctx, 5, 2, white);
  _px(ctx, 10, 2, white);
  // Тело (сужается)
  _rect(ctx, 6, 6, 4, 4, white);
  _rect(ctx, 5, 7, 6, 2, white);
  // Волнистый низ
  _px(ctx, 5, 11, white);
  _px(ctx, 7, 12, white);
  _px(ctx, 9, 12, white);
  _px(ctx, 10, 11, white);
  // Чёрные глаза
  _px(ctx, 7, 3, '#000');
  _px(ctx, 9, 3, '#000');
  // Рот (кричит)
  _rect(ctx, 7, 5, 2, 1, '#000');
}



/* ============================================================
   Генераторы спрайтов — Пауки и насекомые
   ============================================================ */

function _sprite_spider(ctx) {
  _drawSpiderBase(ctx, '#1e1e1e', '#333');
  // Глаза (красные)
  _px(ctx, 7, 3, '#ff0000');
  _px(ctx, 9, 3, '#ff0000');
  // Жвалы
  _px(ctx, 7, 6, '#a070a0');
  _px(ctx, 9, 6, '#a070a0');
}

function _sprite_spiderling(ctx) {
  // Маленький паучок
  _rect(ctx, 6, 7, 4, 3, '#3a3a3a');
  _rect(ctx, 7, 6, 2, 1, '#3a3a3a');
  // Ноги
  _px(ctx, 5, 6, '#555'); _px(ctx, 4, 5, '#555');
  _px(ctx, 5, 8, '#555'); _px(ctx, 4, 9, '#555');
  _px(ctx, 5, 10, '#555'); _px(ctx, 4, 11, '#555');
  _px(ctx, 11, 6, '#555'); _px(ctx, 12, 5, '#555');
  _px(ctx, 11, 8, '#555'); _px(ctx, 12, 9, '#555');
  _px(ctx, 11, 10, '#555'); _px(ctx, 12, 11, '#555');
  // Глаза
  _px(ctx, 7, 6, '#ff0000');
  _px(ctx, 9, 6, '#ff0000');
}

function _sprite_cave_crab(ctx) {
  const body = '#e67300';
  // Широкое тело
  _rect(ctx, 3, 7, 10, 5, body);
  _rect(ctx, 4, 6, 8, 1, body);
  // Панцирь (полосы)
  _hline(ctx, 4, 8, 8, '#cc5500');
  _hline(ctx, 4, 10, 8, '#cc5500');
  // Клешни
  _rect(ctx, 1, 5, 2, 3, body);
  _px(ctx, 0, 5, body);
  _px(ctx, 0, 7, body);
  _rect(ctx, 13, 5, 2, 3, body);
  _px(ctx, 15, 5, body);
  _px(ctx, 15, 7, body);
  // Глаза
  _px(ctx, 6, 6, '#000');
  _px(ctx, 9, 6, '#000');
  // Ноги
  _px(ctx, 4, 12, body); _px(ctx, 6, 12, body);
  _px(ctx, 9, 12, body); _px(ctx, 11, 12, body);
}

function _sprite_harpy(ctx) {
  const body = '#808080';
  const wing = '#a0a0a0';
  // Голова (женский силуэт)
  _rect(ctx, 6, 1, 4, 3, '#d4a06a');
  // Волосы
  _px(ctx, 5, 1, '#555');
  _px(ctx, 10, 1, '#555');
  _px(ctx, 5, 2, '#555');
  _px(ctx, 10, 2, '#555');
  // Тело
  _rect(ctx, 6, 4, 4, 5, body);
  // Крылья (раскрытые)
  _rect(ctx, 2, 4, 4, 4, wing);
  _rect(ctx, 10, 4, 4, 4, wing);
  _px(ctx, 1, 5, wing);
  _px(ctx, 14, 5, wing);
  // Перья
  _px(ctx, 2, 8, '#666');
  _px(ctx, 3, 8, '#666');
  _px(ctx, 13, 8, '#666');
  _px(ctx, 12, 8, '#666');
  // Ноги (когти)
  _vline(ctx, 7, 9, 4, body);
  _vline(ctx, 9, 9, 4, body);
  _px(ctx, 6, 13, '#444');
  _px(ctx, 10, 13, '#444');
  // Глаза
  _px(ctx, 7, 2, '#ff0');
  _px(ctx, 9, 2, '#ff0');
}

function _sprite_dung_beetle(ctx) {
  const body = '#6b4400';
  // Круглое тело
  _rect(ctx, 6, 6, 5, 6, body);
  _rect(ctx, 5, 7, 7, 4, body);
  // Голова
  _rect(ctx, 7, 4, 3, 2, body);
  // Рога
  _px(ctx, 7, 3, '#8b5e3c');
  _px(ctx, 9, 3, '#8b5e3c');
  // Навозный шар перед ним
  _rect(ctx, 11, 8, 3, 3, '#666');
  _rect(ctx, 12, 7, 2, 1, '#777');
  // Ноги
  _px(ctx, 5, 10, body);
  _px(ctx, 4, 11, body);
  _px(ctx, 5, 12, body);
  // Глаза
  _px(ctx, 7, 5, '#fff');
  _px(ctx, 9, 5, '#fff');
}

function _sprite_scorpion(ctx) {
  const body = '#c8a23a';
  // Тело
  _rect(ctx, 5, 8, 6, 4, body);
  _rect(ctx, 6, 7, 4, 1, body);
  // Клешни
  _rect(ctx, 2, 6, 3, 2, body);
  _px(ctx, 1, 6, body);
  _rect(ctx, 11, 6, 3, 2, body);
  _px(ctx, 14, 6, body);
  // Хвост (изогнутый)
  _px(ctx, 8, 12, body);
  _px(ctx, 8, 13, body);
  _px(ctx, 9, 14, body);
  _px(ctx, 10, 14, body);
  _px(ctx, 11, 13, body);
  // Жало
  _px(ctx, 11, 12, '#ff0000');
  // Глаза
  _px(ctx, 7, 7, '#000');
  _px(ctx, 9, 7, '#000');
}

/* ============================================================
   Генераторы спрайтов — Слизни и грибы
   ============================================================ */

function _sprite_ooze(ctx) {
  _drawSlimeBase(ctx, '#e89020', '#000');
  // Блик
  _px(ctx, 5, 7, '#ffcc66');
}

function _sprite_slimeling(ctx) {
  // Малый слизень
  _rect(ctx, 5, 9, 6, 4, '#f0a050');
  _rect(ctx, 6, 8, 4, 1, '#f0a050');
  // Глаза
  _px(ctx, 7, 10, '#000');
  _px(ctx, 9, 10, '#000');
  // Блик
  _px(ctx, 6, 9, '#fff');
}

function _sprite_acid_slug(ctx) {
  _drawSlimeBase(ctx, '#2ecc40', '#000');
  // Кислотная лужа под ним
  _hline(ctx, 3, 14, 10, '#44ff44');
  _hline(ctx, 4, 15, 8, '#33cc33');
  // Капля кислоты
  _px(ctx, 5, 13, '#66ff66');
  _px(ctx, 10, 13, '#66ff66');
}

function _sprite_gasspore(ctx) {
  const gc = '#7a9a6a';
  // Круглое тело
  _rect(ctx, 5, 5, 6, 6, gc);
  _rect(ctx, 4, 6, 8, 4, gc);
  _rect(ctx, 6, 4, 4, 1, gc);
  _rect(ctx, 6, 11, 4, 1, gc);
  // Пульсирующая обводка (более яркий край)
  _px(ctx, 4, 5, '#a0c090');
  _px(ctx, 11, 5, '#a0c090');
  _px(ctx, 4, 10, '#a0c090');
  _px(ctx, 11, 10, '#a0c090');
  // Споры внутри
  _px(ctx, 6, 7, '#cfe0b6');
  _px(ctx, 9, 8, '#cfe0b6');
  _px(ctx, 7, 9, '#cfe0b6');
}

function _sprite_mold(ctx) {
  const mc = '#5a7a4a';
  // Плоское пятно (плесень)
  _rect(ctx, 3, 10, 10, 4, mc);
  _rect(ctx, 4, 9, 8, 1, mc);
  _rect(ctx, 5, 8, 6, 1, mc);
  // Пупырышки
  _px(ctx, 5, 10, '#7a9a6a');
  _px(ctx, 8, 11, '#7a9a6a');
  _px(ctx, 10, 10, '#7a9a6a');
  _px(ctx, 6, 12, '#a0c090');
  _px(ctx, 9, 13, '#a0c090');
  // Глаза (маленькие)
  _px(ctx, 7, 9, '#ff0');
  _px(ctx, 9, 9, '#ff0');
}

function _sprite_mushroom_man(ctx) {
  const cap = '#8b4513';
  const stem = '#f5f5dc';
  // Шляпка (полукруг)
  _rect(ctx, 4, 2, 8, 4, cap);
  _rect(ctx, 5, 1, 6, 1, cap);
  _rect(ctx, 3, 4, 10, 2, cap);
  // Пятна на шляпке
  _px(ctx, 6, 2, '#a0522d');
  _px(ctx, 9, 3, '#a0522d');
  // Ножка (белая)
  _rect(ctx, 6, 6, 4, 6, stem);
  _rect(ctx, 5, 8, 6, 3, stem);
  // Глаза
  _px(ctx, 7, 8, '#000');
  _px(ctx, 9, 8, '#000');
  // Ноги
  _px(ctx, 6, 12, stem);
  _px(ctx, 9, 12, stem);
}



/* ============================================================
   Генераторы спрайтов — Гоблины, гноллы, кобольды, культисты
   ============================================================ */

function _sprite_goblin(ctx) {
  const skin = '#4a8a2a';
  // Голова (большие уши)
  _rect(ctx, 6, 2, 4, 4, skin);
  // Уши (треугольники)
  _px(ctx, 5, 2, skin);
  _px(ctx, 4, 1, skin);
  _px(ctx, 10, 2, skin);
  _px(ctx, 11, 1, skin);
  // Глаза (жёлтые)
  _px(ctx, 7, 3, '#ffff00');
  _px(ctx, 9, 3, '#ffff00');
  // Рот
  _px(ctx, 7, 5, '#333');
  _px(ctx, 8, 5, '#333');
  // Тело (маленькое)
  _rect(ctx, 6, 6, 4, 4, '#5a4a2a');
  // Руки
  _vline(ctx, 5, 6, 4, skin);
  _vline(ctx, 10, 6, 4, skin);
  // Нож в правой руке
  _vline(ctx, 11, 5, 3, '#aaa');
  _px(ctx, 11, 4, '#ccc');
  // Ноги
  _vline(ctx, 7, 10, 4, skin);
  _vline(ctx, 9, 10, 4, skin);
}

function _sprite_gnoll(ctx) {
  const fur = '#a07030';
  // Голова (гиена-подобная, вытянутая морда)
  _rect(ctx, 6, 1, 4, 4, fur);
  _rect(ctx, 10, 3, 2, 2, fur); // морда
  _px(ctx, 12, 3, '#333'); // нос
  // Уши
  _px(ctx, 6, 0, fur);
  _px(ctx, 9, 0, fur);
  // Глаза
  _px(ctx, 7, 2, '#ff0');
  // Тело
  _rect(ctx, 5, 5, 6, 5, fur);
  _rect(ctx, 4, 6, 8, 3, '#8b5a30');
  // Палка с гвоздями
  _vline(ctx, 13, 2, 10, '#8b4513');
  _px(ctx, 14, 3, '#aaa');
  _px(ctx, 12, 4, '#aaa');
  _px(ctx, 14, 5, '#aaa');
  // Ноги
  _vline(ctx, 6, 10, 4, fur);
  _vline(ctx, 9, 10, 4, fur);
}

function _sprite_kobold(ctx) {
  const skin = '#8a8a8a';
  // Голова (ящер)
  _rect(ctx, 6, 2, 4, 3, skin);
  _px(ctx, 10, 3, skin); // морда
  // Гребень
  _px(ctx, 7, 1, '#666');
  _px(ctx, 8, 1, '#666');
  // Глаза
  _px(ctx, 7, 3, '#ff0');
  _px(ctx, 9, 3, '#ff0');
  // Тело
  _rect(ctx, 6, 5, 4, 5, '#666');
  // Руки
  _vline(ctx, 5, 5, 4, skin);
  _vline(ctx, 10, 5, 4, skin);
  // Капкан в руках (V-образный)
  _px(ctx, 3, 8, '#aaa');
  _px(ctx, 4, 9, '#aaa');
  _px(ctx, 4, 7, '#aaa');
  // Ноги
  _vline(ctx, 7, 10, 4, skin);
  _vline(ctx, 9, 10, 4, skin);
  // Хвост
  _px(ctx, 5, 11, skin);
  _px(ctx, 4, 12, skin);
}

function _sprite_cultist(ctx) {
  const cloak = '#1a1a1a';
  // Чёрный плащ
  _rect(ctx, 5, 3, 6, 10, cloak);
  _rect(ctx, 4, 5, 8, 7, cloak);
  // Капюшон
  _rect(ctx, 5, 1, 6, 3, cloak);
  // Красные глаза
  _px(ctx, 7, 3, '#ff0000');
  _px(ctx, 9, 3, '#ff0000');
  // Книга в руках (коричневая)
  _rect(ctx, 6, 8, 4, 3, '#8b4513');
  _px(ctx, 7, 9, '#ffd700'); // символ на книге
  // Фиолетовые руны
  _px(ctx, 4, 8, '#a040ff');
  _px(ctx, 11, 8, '#a040ff');
}

function _sprite_drow(ctx) {
  const skin = '#6a3a8a';
  const hair = '#ffffff';
  // Голова
  _rect(ctx, 6, 1, 4, 4, skin);
  // Белые волосы
  _px(ctx, 5, 1, hair);
  _px(ctx, 5, 2, hair);
  _px(ctx, 10, 1, hair);
  _px(ctx, 10, 2, hair);
  _px(ctx, 6, 0, hair);
  _px(ctx, 9, 0, hair);
  // Глаза (красные)
  _px(ctx, 7, 3, '#ff0000');
  _px(ctx, 9, 3, '#ff0000');
  // Тело (тёмно-фиолетовая одежда)
  _rect(ctx, 6, 5, 4, 5, '#3d0066');
  _vline(ctx, 5, 5, 5, '#3d0066');
  _vline(ctx, 10, 5, 5, '#3d0066');
  // Два кинжала
  _vline(ctx, 4, 6, 4, '#b0b0b0');
  _px(ctx, 4, 5, '#ccc');
  _vline(ctx, 11, 6, 4, '#b0b0b0');
  _px(ctx, 11, 5, '#ccc');
  // Ноги
  _vline(ctx, 7, 10, 4, '#3d0066');
  _vline(ctx, 9, 10, 4, '#3d0066');
}

function _sprite_doppelganger(ctx) {
  const skin = '#888';
  // Безликий гуманоид (серый, без глаз)
  _rect(ctx, 6, 1, 4, 4, skin);
  // Тело
  _rect(ctx, 6, 5, 4, 5, '#777');
  _vline(ctx, 5, 5, 5, '#777');
  _vline(ctx, 10, 5, 5, '#777');
  // Ноги
  _vline(ctx, 7, 10, 4, '#666');
  _vline(ctx, 9, 10, 4, '#666');
  // Нет глаз — безликий (только гладкая поверхность)
  // Мерцающий эффект — красный контур
  _px(ctx, 5, 1, '#ff3030');
  _px(ctx, 10, 1, '#ff3030');
  _px(ctx, 5, 9, '#ff3030');
  _px(ctx, 10, 9, '#ff3030');
}

/* ============================================================
   Генераторы спрайтов — Элементали
   ============================================================ */

function _sprite_fire_elem(ctx) {
  _drawElementalBase(ctx, '#ff6622', '#ffaa00', '#ffff44');
}

function _sprite_earth_elem(ctx) {
  const c1 = '#8b6b4a';
  const c2 = '#6b4a2a';
  const c3 = '#a08060';
  // Квадратная каменная форма
  _rect(ctx, 4, 4, 8, 9, c1);
  _rect(ctx, 5, 3, 6, 1, c2);
  _rect(ctx, 5, 13, 6, 1, c2);
  // Камни/трещины
  _px(ctx, 5, 5, c3); _px(ctx, 10, 6, c3);
  _px(ctx, 6, 9, c2); _px(ctx, 9, 10, c2);
  _hline(ctx, 5, 7, 3, c2);
  _hline(ctx, 8, 11, 3, c2);
  // Глаза
  _px(ctx, 6, 6, '#ff8800');
  _px(ctx, 9, 6, '#ff8800');
  // Руки (каменные)
  _rect(ctx, 2, 6, 2, 4, c1);
  _rect(ctx, 12, 6, 2, 4, c1);
}

function _sprite_water_elem(ctx) {
  const c1 = '#4488cc';
  const c2 = '#66aaee';
  const c3 = '#aaddff';
  // Каплевидная форма
  _rect(ctx, 6, 3, 4, 2, c2);
  _rect(ctx, 5, 5, 6, 4, c1);
  _rect(ctx, 4, 7, 8, 4, c1);
  _rect(ctx, 5, 11, 6, 2, c1);
  _px(ctx, 7, 2, c2);
  _px(ctx, 8, 2, c2);
  // Блики
  _px(ctx, 6, 4, c3);
  _px(ctx, 7, 6, c3);
  // Глаза
  _px(ctx, 6, 7, '#fff');
  _px(ctx, 9, 7, '#fff');
  // Капли по бокам
  _px(ctx, 3, 9, c2);
  _px(ctx, 12, 8, c2);
}

function _sprite_ice_elem(ctx) {
  const c1 = '#88ccff';
  const c2 = '#aaeeff';
  const c3 = '#ffffff';
  // Кристаллическая форма (острые углы)
  _px(ctx, 8, 1, c3);
  _rect(ctx, 7, 2, 2, 2, c2);
  _rect(ctx, 6, 4, 4, 3, c1);
  _rect(ctx, 5, 6, 6, 4, c1);
  _rect(ctx, 6, 10, 4, 3, c1);
  // Острые углы
  _px(ctx, 4, 7, c2);
  _px(ctx, 11, 7, c2);
  _px(ctx, 3, 8, c3);
  _px(ctx, 12, 8, c3);
  // Грани
  _px(ctx, 6, 5, c3);
  _px(ctx, 9, 5, c3);
  // Глаза
  _px(ctx, 7, 7, '#0066ff');
  _px(ctx, 9, 7, '#0066ff');
}

function _sprite_air_elem(ctx) {
  const c1 = '#ffffff';
  const c2 = '#ccddff';
  // Вихрь (спираль)
  _px(ctx, 8, 2, c1);
  _px(ctx, 9, 3, c1);
  _px(ctx, 10, 4, c2);
  _px(ctx, 10, 5, c1);
  _px(ctx, 9, 6, c2);
  _px(ctx, 8, 7, c1);
  _px(ctx, 7, 7, c2);
  _px(ctx, 6, 6, c1);
  _px(ctx, 5, 5, c2);
  _px(ctx, 5, 4, c1);
  _px(ctx, 6, 3, c2);
  _px(ctx, 7, 3, c1);
  // Внешний вихрь
  _px(ctx, 4, 8, c2);
  _px(ctx, 3, 9, c1);
  _px(ctx, 4, 10, c2);
  _px(ctx, 5, 11, c1);
  _px(ctx, 6, 12, c2);
  _px(ctx, 8, 12, c1);
  _px(ctx, 10, 11, c2);
  _px(ctx, 11, 10, c1);
  _px(ctx, 12, 9, c2);
  _px(ctx, 12, 8, c1);
  _px(ctx, 11, 7, c2);
  // Глаза
  _px(ctx, 7, 5, '#6699ff');
  _px(ctx, 9, 5, '#6699ff');
}



/* ============================================================
   Генераторы спрайтов — Драконы и ящеры
   ============================================================ */

function _sprite_dragonet(ctx) {
  const bone = '#9aa0a6';
  // Тело (скелет дракончика)
  _rect(ctx, 5, 6, 6, 5, bone);
  // Голова
  _rect(ctx, 8, 3, 4, 3, bone);
  _px(ctx, 12, 4, bone); // морда
  // Глаза
  _px(ctx, 9, 4, '#ff0000');
  // Крылья (маленькие треугольные)
  _px(ctx, 4, 5, bone); _px(ctx, 3, 4, bone); _px(ctx, 2, 3, bone);
  _px(ctx, 4, 6, bone); _px(ctx, 3, 5, bone);
  // Хвост
  _px(ctx, 5, 11, bone); _px(ctx, 4, 12, bone); _px(ctx, 3, 13, bone);
  // Рёбра (костяной)
  _hline(ctx, 6, 7, 4, '#ccc');
  _hline(ctx, 6, 9, 4, '#ccc');
  // Ноги
  _vline(ctx, 6, 11, 3, bone);
  _vline(ctx, 9, 11, 3, bone);
}

function _sprite_young_dragon(ctx) {
  // 16x16 но визуально крупный
  const color = '#cc3300';
  const wing = '#aa2200';
  // Тело
  _rect(ctx, 4, 6, 8, 6, color);
  _rect(ctx, 5, 5, 6, 1, color);
  // Голова
  _rect(ctx, 9, 2, 4, 4, color);
  _px(ctx, 13, 3, color); // морда
  _px(ctx, 14, 3, '#ff6600'); // дыхание
  // Глаза
  _px(ctx, 10, 3, '#ffd700');
  // Крылья
  _rect(ctx, 1, 3, 3, 5, wing);
  _px(ctx, 0, 4, wing);
  _px(ctx, 0, 5, wing);
  _rect(ctx, 2, 2, 2, 1, wing);
  // Хвост
  _px(ctx, 4, 12, color); _px(ctx, 3, 13, color);
  _px(ctx, 2, 14, color); _px(ctx, 1, 15, color);
  // Ноги
  _vline(ctx, 6, 12, 3, color);
  _vline(ctx, 10, 12, 3, color);
  // Рога
  _px(ctx, 9, 1, '#ffd700');
  _px(ctx, 12, 1, '#ffd700');
}

function _sprite_dragonid(ctx) {
  const skin = '#cc2200';
  // Ящероподобный гуманоид
  _rect(ctx, 6, 1, 4, 4, skin);
  _px(ctx, 10, 2, skin); // морда
  // Глаза
  _px(ctx, 7, 2, '#ff0');
  _px(ctx, 9, 2, '#ff0');
  // Чешуя на голове
  _px(ctx, 6, 0, '#ff6600');
  _px(ctx, 8, 0, '#ff6600');
  // Тело (доспехи)
  _rect(ctx, 5, 5, 6, 5, '#8b0000');
  _rect(ctx, 6, 5, 4, 5, '#aa2200');
  // Руки
  _vline(ctx, 4, 5, 5, skin);
  _vline(ctx, 11, 5, 5, skin);
  // Меч
  _vline(ctx, 12, 3, 7, '#ccc');
  _px(ctx, 12, 2, '#ddd');
  // Ноги
  _vline(ctx, 6, 10, 4, skin);
  _vline(ctx, 9, 10, 4, skin);
  // Хвост
  _px(ctx, 4, 9, skin);
  _px(ctx, 3, 10, skin);
}

/* ============================================================
   Генераторы спрайтов — Демоны
   ============================================================ */

function _sprite_hell_hound(ctx) {
  const body = '#cc4422';
  // Тело (собака)
  _rect(ctx, 4, 7, 8, 4, body);
  // Голова
  _rect(ctx, 10, 4, 4, 4, body);
  _px(ctx, 14, 5, body); // морда
  // Глаза
  _px(ctx, 11, 5, '#ff0');
  // Уши
  _px(ctx, 11, 3, body);
  _px(ctx, 13, 3, body);
  // Ноги (огненные)
  _vline(ctx, 5, 11, 3, '#ff6600');
  _vline(ctx, 7, 11, 3, '#ff6600');
  _vline(ctx, 9, 11, 3, '#ff6600');
  _vline(ctx, 11, 11, 3, '#ff6600');
  // Огненные лапы
  _px(ctx, 5, 14, '#ffff00');
  _px(ctx, 11, 14, '#ffff00');
  // Хвост (огненный)
  _px(ctx, 3, 7, '#ff8800');
  _px(ctx, 2, 6, '#ffaa00');
}

function _sprite_demon_berserker(ctx) {
  const skin = '#cc3333';
  // Голова с рогами
  _rect(ctx, 6, 2, 4, 4, skin);
  // Рога
  _px(ctx, 5, 1, '#880000');
  _px(ctx, 4, 0, '#880000');
  _px(ctx, 10, 1, '#880000');
  _px(ctx, 11, 0, '#880000');
  // Глаза
  _px(ctx, 7, 3, '#ff0');
  _px(ctx, 9, 3, '#ff0');
  // Мускулистое тело
  _rect(ctx, 4, 6, 8, 5, skin);
  _rect(ctx, 5, 5, 6, 1, '#aa2222');
  // Руки (толстые)
  _rect(ctx, 2, 6, 2, 5, skin);
  _rect(ctx, 12, 6, 2, 5, skin);
  // Ноги
  _rect(ctx, 5, 11, 2, 4, skin);
  _rect(ctx, 9, 11, 2, 4, skin);
  // Пояс
  _hline(ctx, 4, 10, 8, '#333');
}

function _sprite_rakshasa(ctx) {
  const skin = '#e8a040';
  const stripe = '#cc6600';
  // Тигриная голова
  _rect(ctx, 6, 1, 4, 4, skin);
  // Полосы
  _px(ctx, 6, 2, stripe); _px(ctx, 9, 2, stripe);
  _px(ctx, 7, 1, stripe); _px(ctx, 8, 1, stripe);
  // Уши
  _px(ctx, 6, 0, skin);
  _px(ctx, 9, 0, skin);
  // Глаза
  _px(ctx, 7, 2, '#ff0');
  _px(ctx, 9, 3, '#ff0');
  // Тело (одежда)
  _rect(ctx, 5, 5, 6, 6, '#8b0000');
  _rect(ctx, 4, 6, 8, 4, '#660000');
  // Руки
  _vline(ctx, 3, 5, 5, skin);
  _vline(ctx, 12, 5, 5, skin);
  // Ноги
  _vline(ctx, 6, 11, 4, '#333');
  _vline(ctx, 9, 11, 4, '#333');
  // Золотые украшения
  _px(ctx, 7, 6, '#ffd700');
  _px(ctx, 8, 7, '#ffd700');
}

/* ============================================================
   Генераторы спрайтов — Животные и звери
   ============================================================ */

function _sprite_giant_rat(ctx) {
  const fur = '#8b6914';
  // Тело (вытянутое)
  _rect(ctx, 4, 8, 7, 4, fur);
  _rect(ctx, 5, 7, 5, 1, fur);
  // Голова
  _rect(ctx, 9, 6, 3, 3, fur);
  _px(ctx, 12, 7, fur); // морда
  _px(ctx, 13, 7, '#ff6666'); // нос
  // Уши
  _px(ctx, 9, 5, '#d4a855');
  _px(ctx, 11, 5, '#d4a855');
  // Глаза
  _px(ctx, 10, 7, '#000');
  // Хвост
  _px(ctx, 3, 9, '#d4a855');
  _px(ctx, 2, 10, '#d4a855');
  _px(ctx, 1, 11, '#d4a855');
  // Ноги
  _px(ctx, 5, 12, fur); _px(ctx, 7, 12, fur);
  _px(ctx, 9, 12, fur); _px(ctx, 10, 12, fur);
}

function _sprite_cave_bat(ctx) {
  const body = '#666666';
  const wing = '#555555';
  // Тело (маленькое)
  _rect(ctx, 7, 7, 2, 3, body);
  // Голова
  _rect(ctx, 7, 5, 2, 2, body);
  // Уши
  _px(ctx, 6, 4, body);
  _px(ctx, 9, 4, body);
  // Крылья (треугольники)
  _rect(ctx, 3, 6, 4, 3, wing);
  _rect(ctx, 9, 6, 4, 3, wing);
  _px(ctx, 2, 7, wing);
  _px(ctx, 13, 7, wing);
  _px(ctx, 1, 8, wing);
  _px(ctx, 14, 8, wing);
  // Нижний край крыльев
  _px(ctx, 3, 9, wing); _px(ctx, 4, 10, wing);
  _px(ctx, 12, 9, wing); _px(ctx, 11, 10, wing);
  // Глаза
  _px(ctx, 7, 6, '#fff');
  _px(ctx, 8, 6, '#fff');
}

function _sprite_bat(ctx) {
  const body = '#7a1d2c';
  const wing = '#5a1020';
  // Тело
  _rect(ctx, 7, 6, 2, 4, body);
  // Голова
  _rect(ctx, 6, 4, 4, 3, body);
  // Клыки
  _px(ctx, 7, 7, '#fff');
  _px(ctx, 8, 7, '#fff');
  // Уши
  _px(ctx, 6, 3, body);
  _px(ctx, 9, 3, body);
  // Крылья
  _rect(ctx, 2, 5, 5, 4, wing);
  _rect(ctx, 9, 5, 5, 4, wing);
  _px(ctx, 1, 6, wing);
  _px(ctx, 14, 6, wing);
  _px(ctx, 0, 7, wing);
  _px(ctx, 15, 7, wing);
  // Глаза (красные)
  _px(ctx, 7, 5, '#ff0000');
  _px(ctx, 8, 5, '#ff0000');
}

function _sprite_cave_bear(ctx) {
  const fur = '#6b4a2a';
  // Крупное тело
  _rect(ctx, 3, 5, 10, 7, fur);
  _rect(ctx, 4, 4, 8, 1, fur);
  _rect(ctx, 4, 12, 8, 2, fur);
  // Голова
  _rect(ctx, 6, 1, 5, 4, fur);
  _px(ctx, 11, 2, fur); // морда
  // Уши
  _px(ctx, 6, 0, '#8b6b4a');
  _px(ctx, 10, 0, '#8b6b4a');
  // Глаза
  _px(ctx, 8, 2, '#000');
  _px(ctx, 10, 2, '#000');
  // Нос
  _px(ctx, 11, 3, '#333');
  // Лапы
  _rect(ctx, 3, 13, 2, 2, '#5a3a1a');
  _rect(ctx, 11, 13, 2, 2, '#5a3a1a');
}



/* ============================================================
   Генераторы спрайтов — Мифические существа
   ============================================================ */

function _sprite_basilisk(ctx) {
  const skin = '#1a4d1a';
  // Ящерица с гребнем
  _rect(ctx, 4, 7, 8, 4, skin);
  _rect(ctx, 5, 6, 6, 1, skin);
  // Голова
  _rect(ctx, 10, 5, 4, 3, skin);
  _px(ctx, 14, 6, '#40a040'); // рот
  // Гребень
  _px(ctx, 10, 4, '#40a040');
  _px(ctx, 11, 3, '#40a040');
  _px(ctx, 12, 4, '#40a040');
  // Глаза (жёлтые — опасные)
  _px(ctx, 12, 5, '#ffff00');
  // Хвост
  _px(ctx, 3, 8, skin); _px(ctx, 2, 9, skin); _px(ctx, 1, 10, skin);
  // Ноги
  _px(ctx, 5, 11, skin); _px(ctx, 7, 11, skin);
  _px(ctx, 9, 11, skin); _px(ctx, 11, 11, skin);
  // Чешуя
  _px(ctx, 6, 7, '#2a6a2a');
  _px(ctx, 8, 8, '#2a6a2a');
  _px(ctx, 10, 7, '#2a6a2a');
}

function _sprite_medusa(ctx) {
  const skin = '#228b22';
  // Голова
  _rect(ctx, 6, 2, 4, 4, skin);
  // Змеи вместо волос (волнистые линии)
  _px(ctx, 5, 1, '#44aa44'); _px(ctx, 4, 0, '#44aa44');
  _px(ctx, 7, 0, '#44aa44'); _px(ctx, 6, 1, '#44aa44');
  _px(ctx, 9, 0, '#44aa44'); _px(ctx, 10, 1, '#44aa44');
  _px(ctx, 11, 0, '#44aa44'); _px(ctx, 10, 2, '#44aa44');
  _px(ctx, 5, 3, '#44aa44'); _px(ctx, 4, 2, '#44aa44');
  // Глаза
  _px(ctx, 7, 3, '#ff0000');
  _px(ctx, 9, 3, '#ff0000');
  // Тело
  _rect(ctx, 6, 6, 4, 4, skin);
  _rect(ctx, 5, 7, 6, 2, skin);
  // Змеиный хвост вместо ног
  _rect(ctx, 6, 10, 4, 2, skin);
  _rect(ctx, 5, 12, 6, 2, '#1a6b1a');
  _px(ctx, 4, 14, '#1a6b1a');
  // Руки
  _vline(ctx, 4, 6, 4, skin);
  _vline(ctx, 11, 6, 4, skin);
}

function _sprite_chimera(ctx) {
  const lion = '#b3b300';
  const goat = '#808080';
  const snake = '#228b22';
  // Тело льва (центральное)
  _rect(ctx, 4, 7, 8, 5, lion);
  // Голова льва
  _rect(ctx, 7, 3, 3, 3, lion);
  _px(ctx, 6, 4, '#cc9900'); // грива
  _px(ctx, 10, 4, '#cc9900');
  _px(ctx, 7, 2, '#cc9900');
  _px(ctx, 9, 2, '#cc9900');
  // Глаза льва
  _px(ctx, 8, 4, '#ff0');
  // Голова козла (слева)
  _rect(ctx, 2, 4, 2, 2, goat);
  _px(ctx, 2, 3, goat); // рог
  _px(ctx, 3, 2, goat);
  _px(ctx, 2, 5, '#000'); // глаз
  // Голова змеи (хвост справа)
  _rect(ctx, 12, 5, 2, 2, snake);
  _px(ctx, 14, 6, '#ff0000'); // язык
  _px(ctx, 13, 5, '#ff0');  // глаз
  // Ноги
  _vline(ctx, 5, 12, 3, lion);
  _vline(ctx, 7, 12, 3, lion);
  _vline(ctx, 9, 12, 3, lion);
  _vline(ctx, 11, 12, 3, lion);
}

function _sprite_hydra_small(ctx) {
  const skin = '#228b22';
  const neck = '#1a6b1a';
  // Тело
  _rect(ctx, 5, 8, 6, 5, skin);
  _rect(ctx, 4, 9, 8, 3, skin);
  // Три головы на шеях
  // Центральная
  _vline(ctx, 8, 4, 4, neck);
  _rect(ctx, 7, 2, 3, 2, skin);
  _px(ctx, 8, 2, '#ff0');
  // Левая
  _px(ctx, 6, 6, neck); _px(ctx, 5, 5, neck); _px(ctx, 4, 4, neck);
  _rect(ctx, 3, 3, 2, 2, skin);
  _px(ctx, 3, 3, '#ff0');
  // Правая
  _px(ctx, 10, 6, neck); _px(ctx, 11, 5, neck); _px(ctx, 12, 4, neck);
  _rect(ctx, 11, 3, 2, 2, skin);
  _px(ctx, 12, 3, '#ff0');
  // Ноги
  _vline(ctx, 6, 13, 2, skin);
  _vline(ctx, 10, 13, 2, skin);
}

function _sprite_minotaur(ctx) {
  const skin = '#7a4a2a';
  // Голова быка
  _rect(ctx, 5, 1, 6, 4, skin);
  // Рога
  _px(ctx, 4, 0, '#d4a06a'); _px(ctx, 3, 0, '#d4a06a');
  _px(ctx, 11, 0, '#d4a06a'); _px(ctx, 12, 0, '#d4a06a');
  // Глаза
  _px(ctx, 7, 2, '#ff0000');
  _px(ctx, 9, 2, '#ff0000');
  // Ноздри
  _px(ctx, 7, 4, '#333');
  _px(ctx, 9, 4, '#333');
  // Мускулистое тело
  _rect(ctx, 4, 5, 8, 5, skin);
  _rect(ctx, 5, 5, 6, 5, '#6b3a1a');
  // Руки
  _rect(ctx, 2, 5, 2, 5, skin);
  _rect(ctx, 12, 5, 2, 5, skin);
  // Топор
  _vline(ctx, 14, 2, 7, '#8b4513');
  _rect(ctx, 14, 2, 2, 3, '#aaa');
  // Ноги (копыта)
  _rect(ctx, 5, 10, 2, 4, skin);
  _rect(ctx, 9, 10, 2, 4, skin);
  _hline(ctx, 5, 14, 2, '#333');
  _hline(ctx, 9, 14, 2, '#333');
}

function _sprite_ogre(ctx) {
  const skin = '#c8a850';
  // Крупная голова
  _rect(ctx, 5, 1, 6, 5, skin);
  // Глаза (маленькие)
  _px(ctx, 7, 3, '#000');
  _px(ctx, 9, 3, '#000');
  // Рот
  _hline(ctx, 6, 5, 4, '#8b4513');
  // Тело (крупное)
  _rect(ctx, 3, 6, 10, 5, skin);
  _rect(ctx, 4, 5, 8, 1, '#aa8830');
  // Руки
  _rect(ctx, 1, 6, 2, 5, skin);
  _rect(ctx, 13, 6, 2, 5, skin);
  // Дубина
  _vline(ctx, 0, 3, 6, '#8b4513');
  _rect(ctx, 0, 2, 1, 2, '#6b3a1a');
  // Ноги
  _rect(ctx, 4, 11, 3, 4, skin);
  _rect(ctx, 9, 11, 3, 4, skin);
  // Пояс
  _hline(ctx, 3, 10, 10, '#4a3a2a');
}

/* ============================================================
   Генераторы спрайтов — Големы и конструкты
   ============================================================ */

function _sprite_rotgolem(ctx) {
  const body = '#6b4a2b';
  const moss = '#5a8a3a';
  // Крупная квадратная фигура
  _rect(ctx, 3, 3, 10, 11, body);
  _rect(ctx, 4, 2, 8, 1, body);
  // Мох/гниль
  _px(ctx, 4, 4, moss); _px(ctx, 10, 5, moss);
  _px(ctx, 5, 9, moss); _px(ctx, 11, 8, moss);
  _px(ctx, 3, 12, moss);
  // Руки (короткие толстые)
  _rect(ctx, 1, 5, 2, 5, body);
  _rect(ctx, 13, 5, 2, 5, body);
  // Глаза
  _px(ctx, 6, 5, '#ff8800');
  _px(ctx, 9, 5, '#ff8800');
  // Трещины
  _vline(ctx, 7, 7, 3, '#4a3a1b');
  _hline(ctx, 8, 9, 3, '#4a3a1b');
}

function _sprite_stone_golem(ctx) {
  const stone = '#9a9a9a';
  const dark = '#666';
  // Квадратное тело
  _rect(ctx, 3, 3, 10, 11, stone);
  _rect(ctx, 4, 2, 8, 1, stone);
  // Руки
  _rect(ctx, 1, 4, 2, 6, stone);
  _rect(ctx, 13, 4, 2, 6, stone);
  // Глаза
  _px(ctx, 6, 5, '#00ccff');
  _px(ctx, 9, 5, '#00ccff');
  // Трещины / детали
  _hline(ctx, 5, 8, 4, dark);
  _vline(ctx, 10, 6, 4, dark);
  _px(ctx, 4, 11, dark);
  // Символ на груди
  _rect(ctx, 7, 7, 2, 2, '#aaa');
}

function _sprite_bone_colossus(ctx) {
  const bone = '#d9d0c0';
  const dark = '#a09080';
  // Крупная фигура из костей
  _rect(ctx, 3, 2, 10, 12, bone);
  // Рёбра/кости видны
  _hline(ctx, 4, 5, 8, dark);
  _hline(ctx, 4, 7, 8, dark);
  _hline(ctx, 4, 9, 8, dark);
  _hline(ctx, 4, 11, 8, dark);
  // Череп наверху
  _rect(ctx, 5, 0, 6, 3, bone);
  _px(ctx, 6, 1, '#ff0000');
  _px(ctx, 9, 1, '#ff0000');
  // Руки (костяные)
  _rect(ctx, 1, 4, 2, 6, bone);
  _rect(ctx, 13, 4, 2, 6, bone);
  // Ноги
  _rect(ctx, 4, 14, 2, 2, bone);
  _rect(ctx, 10, 14, 2, 2, bone);
}



/* ============================================================
   Генераторы спрайтов — Уникальные твари
   ============================================================ */

function _sprite_mimic(ctx) {
  // Сундук (коричневый квадрат с золотой полосой)
  const wood = '#8b6914';
  const gold = '#ffd700';
  _rect(ctx, 3, 5, 10, 8, wood);
  _rect(ctx, 4, 4, 8, 1, '#a07020');
  // Золотая полоса
  _hline(ctx, 4, 8, 8, gold);
  // Замок
  _rect(ctx, 7, 8, 2, 2, gold);
  // Зубы (красная пасть — раскрыта)
  _hline(ctx, 4, 5, 8, '#ff0000');
  _px(ctx, 4, 4, '#fff'); _px(ctx, 6, 4, '#fff');
  _px(ctx, 8, 4, '#fff'); _px(ctx, 10, 4, '#fff');
  _px(ctx, 5, 6, '#fff'); _px(ctx, 7, 6, '#fff');
  _px(ctx, 9, 6, '#fff'); _px(ctx, 11, 6, '#fff');
  // Глаза (внутри)
  _px(ctx, 6, 7, '#ff0000');
  _px(ctx, 10, 7, '#ff0000');
}

function _sprite_beholder_spore(ctx) {
  const body = '#8b008b';
  // Круглое тело
  _rect(ctx, 4, 4, 8, 8, body);
  _rect(ctx, 5, 3, 6, 1, body);
  _rect(ctx, 5, 12, 6, 1, body);
  _rect(ctx, 3, 6, 1, 4, body);
  _rect(ctx, 12, 6, 1, 4, body);
  // Центральный глаз
  _rect(ctx, 7, 7, 2, 2, '#fff');
  _px(ctx, 7, 7, '#ff0000');
  // 4 глазка-точки (стебельки)
  _px(ctx, 5, 3, '#dda0dd'); _px(ctx, 5, 2, '#fff');
  _px(ctx, 10, 3, '#dda0dd'); _px(ctx, 10, 2, '#fff');
  _px(ctx, 3, 5, '#dda0dd'); _px(ctx, 2, 5, '#fff');
  _px(ctx, 12, 5, '#dda0dd'); _px(ctx, 13, 5, '#fff');
}

function _sprite_observer(ctx) {
  const body = '#660099';
  // Крупный круг
  _rect(ctx, 3, 3, 10, 10, body);
  _rect(ctx, 4, 2, 8, 1, body);
  _rect(ctx, 4, 13, 8, 1, body);
  _rect(ctx, 2, 5, 1, 6, body);
  _rect(ctx, 13, 5, 1, 6, body);
  // Большой центральный глаз
  _rect(ctx, 6, 6, 4, 4, '#fff');
  _rect(ctx, 7, 7, 2, 2, '#ff0000');
  // Глаза-стебельки (много)
  _px(ctx, 5, 1, '#cc66ff'); _px(ctx, 5, 0, '#fff');
  _px(ctx, 7, 1, '#cc66ff'); _px(ctx, 7, 0, '#fff');
  _px(ctx, 9, 1, '#cc66ff'); _px(ctx, 9, 0, '#fff');
  _px(ctx, 11, 1, '#cc66ff'); _px(ctx, 11, 0, '#fff');
  // Рот
  _hline(ctx, 6, 11, 4, '#330066');
}

function _sprite_illithid(ctx) {
  const skin = '#6600cc';
  const tent = '#9933ff';
  // Голова-осьминог
  _rect(ctx, 5, 1, 6, 5, skin);
  _rect(ctx, 6, 0, 4, 1, skin);
  // Щупальца (4 вниз от лица)
  _vline(ctx, 6, 6, 3, tent);
  _vline(ctx, 7, 6, 4, tent);
  _vline(ctx, 8, 6, 4, tent);
  _vline(ctx, 9, 6, 3, tent);
  // Глаза (белые)
  _px(ctx, 7, 3, '#fff');
  _px(ctx, 9, 3, '#fff');
  // Тело (робоподобное)
  _rect(ctx, 5, 9, 6, 4, '#330066');
  // Руки
  _vline(ctx, 4, 9, 4, skin);
  _vline(ctx, 11, 9, 4, skin);
  // Ноги
  _vline(ctx, 6, 13, 2, '#330066');
  _vline(ctx, 9, 13, 2, '#330066');
}

function _sprite_eldritch_horror(ctx) {
  const body = '#2d0040';
  const tent = '#6600aa';
  // Аморфное тело
  _rect(ctx, 3, 3, 10, 10, body);
  _rect(ctx, 4, 2, 8, 1, body);
  _rect(ctx, 2, 5, 1, 6, body);
  _rect(ctx, 13, 5, 1, 6, body);
  // Щупальца
  _px(ctx, 1, 7, tent); _px(ctx, 0, 8, tent);
  _px(ctx, 14, 7, tent); _px(ctx, 15, 8, tent);
  _px(ctx, 4, 14, tent); _px(ctx, 3, 15, tent);
  _px(ctx, 11, 14, tent); _px(ctx, 12, 15, tent);
  _px(ctx, 2, 4, tent); _px(ctx, 1, 3, tent);
  _px(ctx, 13, 4, tent); _px(ctx, 14, 3, tent);
  // Множество глаз
  _px(ctx, 5, 5, '#ff00ff');
  _px(ctx, 8, 4, '#ff00ff');
  _px(ctx, 10, 6, '#ff00ff');
  _px(ctx, 6, 8, '#ff00ff');
  _px(ctx, 9, 9, '#ff00ff');
  _px(ctx, 7, 11, '#ff00ff');
  _px(ctx, 11, 10, '#ff00ff');
  // Пульсирующая аура
  _px(ctx, 4, 1, '#9933ff');
  _px(ctx, 11, 1, '#9933ff');
}

function _sprite_shadow(ctx) {
  const body = '#0a0a0a';
  const gray = '#3a3a3a';
  // Тенеподобный силуэт
  _rect(ctx, 6, 2, 4, 4, body);
  _rect(ctx, 5, 5, 6, 5, body);
  _rect(ctx, 4, 7, 8, 3, body);
  // Размытые края
  _px(ctx, 4, 5, gray); _px(ctx, 11, 5, gray);
  _px(ctx, 3, 8, gray); _px(ctx, 12, 8, gray);
  _px(ctx, 5, 10, gray); _px(ctx, 10, 10, gray);
  // Белые глаза
  _px(ctx, 7, 4, '#ffffff');
  _px(ctx, 9, 4, '#ffffff');
  // Волнистый низ
  _px(ctx, 5, 11, body);
  _px(ctx, 7, 12, body);
  _px(ctx, 9, 12, body);
  _px(ctx, 10, 11, body);
}

function _sprite_rust_monster(ctx) {
  const body = '#b36b00';
  const rust = '#ff6600';
  // Тело
  _rect(ctx, 4, 7, 8, 5, body);
  _rect(ctx, 5, 6, 6, 1, body);
  // Голова
  _rect(ctx, 9, 4, 4, 3, body);
  // Антенны
  _px(ctx, 10, 3, rust); _px(ctx, 10, 2, rust);
  _px(ctx, 12, 3, rust); _px(ctx, 12, 2, rust);
  // Ржавые пятна
  _px(ctx, 5, 8, rust); _px(ctx, 8, 9, rust);
  _px(ctx, 10, 7, rust); _px(ctx, 6, 10, rust);
  // Глаза
  _px(ctx, 10, 5, '#fff');
  _px(ctx, 12, 5, '#fff');
  // Хвост
  _px(ctx, 3, 8, body); _px(ctx, 2, 9, body);
  // Ноги
  _px(ctx, 5, 12, body); _px(ctx, 7, 12, body);
  _px(ctx, 9, 12, body); _px(ctx, 11, 12, body);
}

function _sprite_salamander(ctx) {
  const body = '#ff6600';
  const fire = '#ffaa00';
  // Ящерица
  _rect(ctx, 4, 7, 7, 3, body);
  _rect(ctx, 5, 6, 5, 1, body);
  // Голова
  _rect(ctx, 9, 5, 3, 2, body);
  _px(ctx, 10, 5, '#ff0'); // глаз
  // Хвост (огненный)
  _px(ctx, 3, 8, body);
  _px(ctx, 2, 9, fire);
  _px(ctx, 1, 10, '#ffff00');
  _px(ctx, 0, 10, '#fff');
  // Ноги
  _px(ctx, 5, 10, body);
  _px(ctx, 7, 10, body);
  _px(ctx, 9, 10, body);
  _px(ctx, 10, 10, body);
  // Пятна (огненные)
  _px(ctx, 6, 7, fire);
  _px(ctx, 8, 8, fire);
}

function _sprite_gargoyle(ctx) {
  const stone = '#808080';
  const wing = '#666';
  // Каменное тело
  _rect(ctx, 5, 4, 6, 7, stone);
  // Голова (угловатая)
  _rect(ctx, 6, 1, 4, 3, stone);
  // Рога
  _px(ctx, 5, 0, '#555');
  _px(ctx, 10, 0, '#555');
  // Глаза (красные)
  _px(ctx, 7, 2, '#ff0000');
  _px(ctx, 9, 2, '#ff0000');
  // Крылья (камень)
  _rect(ctx, 2, 4, 3, 4, wing);
  _rect(ctx, 11, 4, 3, 4, wing);
  _px(ctx, 1, 5, wing);
  _px(ctx, 14, 5, wing);
  // Ноги
  _vline(ctx, 6, 11, 3, stone);
  _vline(ctx, 9, 11, 3, stone);
  // Когти
  _px(ctx, 5, 14, '#444');
  _px(ctx, 10, 14, '#444');
}

function _sprite_vampire_spawn(ctx) {
  const skin = '#e8c8c8';
  const cloak = '#660000';
  // Голова (бледная)
  _rect(ctx, 6, 1, 4, 4, skin);
  // Волосы
  _px(ctx, 5, 1, '#333');
  _px(ctx, 10, 1, '#333');
  _px(ctx, 6, 0, '#333');
  _px(ctx, 9, 0, '#333');
  // Глаза (красные)
  _px(ctx, 7, 2, '#ff0000');
  _px(ctx, 9, 2, '#ff0000');
  // Клыки
  _px(ctx, 7, 4, '#fff');
  _px(ctx, 9, 4, '#fff');
  // Тело (плащ)
  _rect(ctx, 5, 5, 6, 7, cloak);
  _rect(ctx, 4, 6, 8, 5, cloak);
  // Руки
  _vline(ctx, 3, 6, 4, cloak);
  _vline(ctx, 12, 6, 4, cloak);
  // Ноги
  _vline(ctx, 6, 12, 3, '#333');
  _vline(ctx, 9, 12, 3, '#333');
}

function _sprite_night_walker(ctx) {
  const body = '#0a0a0a';
  // Почти невидимый, чёрный силуэт
  _rect(ctx, 6, 2, 4, 12, body);
  _rect(ctx, 5, 4, 6, 8, body);
  // Белые глаза (единственное видимое)
  _px(ctx, 7, 4, '#ffffff');
  _px(ctx, 9, 4, '#ffffff');
  // Руки (длинные)
  _vline(ctx, 4, 5, 6, body);
  _px(ctx, 3, 10, body);
  _vline(ctx, 11, 5, 6, body);
  _px(ctx, 12, 10, body);
}

function _sprite_troll(ctx) {
  const skin = '#4a8a3a';
  // Крупное тело
  _rect(ctx, 4, 4, 8, 8, skin);
  _rect(ctx, 3, 5, 10, 6, skin);
  // Голова
  _rect(ctx, 6, 1, 4, 3, skin);
  // Глаза (маленькие жёлтые)
  _px(ctx, 7, 2, '#ff0');
  _px(ctx, 9, 2, '#ff0');
  // Нос
  _px(ctx, 8, 3, '#3a6a2a');
  // Руки (длинные)
  _rect(ctx, 1, 5, 2, 6, skin);
  _rect(ctx, 13, 5, 2, 6, skin);
  _px(ctx, 1, 11, skin);
  _px(ctx, 14, 11, skin);
  // Ноги
  _rect(ctx, 5, 12, 2, 3, skin);
  _rect(ctx, 9, 12, 2, 3, skin);
  // Когти
  _px(ctx, 1, 12, '#333');
  _px(ctx, 14, 12, '#333');
}

function _sprite_lamia(ctx) {
  const skin = '#8fbc8f';
  const snake = '#228b22';
  // Верхняя часть (женский торс)
  _rect(ctx, 6, 1, 4, 3, skin);
  // Волосы
  _px(ctx, 5, 1, '#333'); _px(ctx, 10, 1, '#333');
  // Глаза
  _px(ctx, 7, 2, '#ff0');
  _px(ctx, 9, 2, '#ff0');
  // Тело
  _rect(ctx, 6, 4, 4, 3, skin);
  // Руки
  _vline(ctx, 5, 4, 3, skin);
  _vline(ctx, 10, 4, 3, skin);
  // Змеиный хвост (нижняя часть)
  _rect(ctx, 5, 7, 6, 3, snake);
  _rect(ctx, 4, 9, 8, 2, snake);
  _rect(ctx, 3, 11, 2, 2, snake);
  _px(ctx, 2, 12, snake);
  _rect(ctx, 10, 11, 3, 2, snake);
  _px(ctx, 13, 12, snake);
}



/* ============================================================
   Генераторы спрайтов — Боссы (24x24)
   ============================================================ */

function _sprite_boss_skeleton_knight(ctx) {
  const armor = '#c0c0c0';
  const bone = '#e8dcc8';
  const eye = '#ff0000';
  const gold = '#ffd700';
  // Шлем/голова
  _rect(ctx, 9, 1, 6, 6, armor);
  _rect(ctx, 10, 0, 4, 1, armor);
  // Прорезь и глаза
  _rect(ctx, 10, 3, 4, 2, '#333');
  _px(ctx, 11, 4, eye);
  _px(ctx, 13, 4, eye);
  // Золотая корона на шлеме
  _hline(ctx, 9, 0, 6, gold);
  _px(ctx, 9, -1 < 0 ? 0 : 0, gold);
  _px(ctx, 10, 0, gold); _px(ctx, 12, 0, gold); _px(ctx, 14, 0, gold);
  // Тело (латы)
  _rect(ctx, 7, 7, 10, 9, armor);
  _rect(ctx, 8, 6, 8, 1, '#aaa');
  // Наплечники
  _rect(ctx, 5, 7, 3, 3, armor);
  _rect(ctx, 16, 7, 3, 3, armor);
  // Ноги
  _rect(ctx, 8, 16, 3, 6, armor);
  _rect(ctx, 13, 16, 3, 6, armor);
  // Большой меч (справа)
  _vline(ctx, 20, 2, 14, '#aaa');
  _rect(ctx, 19, 2, 3, 2, '#ccc');
  _px(ctx, 20, 1, '#ddd');
  _px(ctx, 20, 0, '#fff');
  // Красный плащ
  _rect(ctx, 6, 10, 1, 8, '#8b0000');
  _rect(ctx, 5, 12, 1, 7, '#8b0000');
}

function _sprite_boss_lich(ctx) {
  const cloak = '#1a0033';
  const gold = '#ffd700';
  const skull = '#e8dcc8';
  // Чёрный плащ (большой)
  _rect(ctx, 6, 5, 12, 15, cloak);
  _rect(ctx, 5, 7, 14, 12, cloak);
  _rect(ctx, 4, 10, 16, 10, cloak);
  // Капюшон
  _rect(ctx, 7, 1, 10, 5, cloak);
  _rect(ctx, 8, 0, 8, 1, cloak);
  // Череп
  _rect(ctx, 9, 2, 6, 4, skull);
  _px(ctx, 10, 3, '#ff0000');
  _px(ctx, 13, 3, '#ff0000');
  _px(ctx, 10, 5, '#666');
  _px(ctx, 12, 5, '#666');
  // Золотая корона
  _hline(ctx, 8, 1, 8, gold);
  _px(ctx, 8, 0, gold); _px(ctx, 11, 0, gold); _px(ctx, 14, 0, gold);
  // Посох с черепом
  _vline(ctx, 20, 2, 18, '#6a0dad');
  _rect(ctx, 19, 1, 3, 3, skull);
  _px(ctx, 20, 1, '#ff0000');
  // Фиолетовое свечение
  _px(ctx, 4, 6, '#8b00ff');
  _px(ctx, 19, 6, '#8b00ff');
  _px(ctx, 3, 12, '#8b00ff');
  _px(ctx, 20, 12, '#8b00ff');
}

function _sprite_boss_spider_queen(ctx) {
  const body = '#cc4444';
  const leg = '#8b2222';
  // Крупное тело (овал)
  _rect(ctx, 7, 8, 10, 8, body);
  _rect(ctx, 8, 7, 8, 10, body);
  _rect(ctx, 6, 10, 12, 4, body);
  // Голова
  _rect(ctx, 9, 4, 6, 4, body);
  // Глаза (8 шт, 2 больших + 6 маленьких)
  _px(ctx, 10, 5, '#ff0'); _px(ctx, 13, 5, '#ff0');
  _px(ctx, 10, 6, '#ff0'); _px(ctx, 13, 6, '#ff0');
  _px(ctx, 11, 4, '#fff'); _px(ctx, 12, 4, '#fff');
  // Жвалы
  _px(ctx, 10, 8, '#fff'); _px(ctx, 13, 8, '#fff');
  // Корона
  _hline(ctx, 9, 3, 6, '#ffd700');
  _px(ctx, 10, 2, '#ffd700'); _px(ctx, 13, 2, '#ffd700');
  // Ноги (8 шт)
  _px(ctx, 5, 8, leg); _px(ctx, 4, 7, leg); _px(ctx, 3, 6, leg);
  _px(ctx, 5, 10, leg); _px(ctx, 4, 10, leg); _px(ctx, 3, 11, leg);
  _px(ctx, 5, 13, leg); _px(ctx, 4, 14, leg); _px(ctx, 3, 15, leg);
  _px(ctx, 5, 15, leg); _px(ctx, 4, 16, leg);
  _px(ctx, 18, 8, leg); _px(ctx, 19, 7, leg); _px(ctx, 20, 6, leg);
  _px(ctx, 18, 10, leg); _px(ctx, 19, 10, leg); _px(ctx, 20, 11, leg);
  _px(ctx, 18, 13, leg); _px(ctx, 19, 14, leg); _px(ctx, 20, 15, leg);
  _px(ctx, 18, 15, leg); _px(ctx, 19, 16, leg);
  // Красные пятна
  _px(ctx, 9, 11, '#ff0000');
  _px(ctx, 14, 13, '#ff0000');
}

function _sprite_boss_fire_lord(ctx) {
  const c1 = '#ff4500';
  const c2 = '#ff8800';
  const c3 = '#ffdd00';
  const gold = '#ffd700';
  // Огромный огненный элементаль
  _rect(ctx, 7, 10, 10, 10, c1);
  _rect(ctx, 8, 7, 8, 3, c1);
  _rect(ctx, 9, 5, 6, 2, c2);
  _rect(ctx, 10, 3, 4, 2, c2);
  _rect(ctx, 11, 1, 2, 2, c3);
  // Зубцы пламени
  _px(ctx, 8, 6, c3); _px(ctx, 15, 6, c3);
  _px(ctx, 9, 4, c3); _px(ctx, 14, 4, c3);
  _px(ctx, 10, 2, c3); _px(ctx, 13, 2, c3);
  // Корона (золотая)
  _hline(ctx, 9, 4, 6, gold);
  _px(ctx, 9, 3, gold); _px(ctx, 14, 3, gold); _px(ctx, 11, 2, gold);
  // Глаза
  _px(ctx, 10, 8, '#fff');
  _px(ctx, 13, 8, '#fff');
  // Руки (огненные)
  _rect(ctx, 4, 10, 3, 5, c2);
  _rect(ctx, 17, 10, 3, 5, c2);
  _px(ctx, 3, 12, c3); _px(ctx, 20, 12, c3);
  // Искры
  _px(ctx, 5, 6, c3); _px(ctx, 18, 5, c3);
  _px(ctx, 3, 9, c3); _px(ctx, 20, 8, c3);
}

function _sprite_boss_ice_lord(ctx) {
  const c1 = '#4da6ff';
  const c2 = '#88ccff';
  const c3 = '#ffffff';
  const gold = '#ffd700';
  // Кристаллическая форма (ледяной элементаль-лорд)
  _rect(ctx, 7, 8, 10, 12, c1);
  _rect(ctx, 8, 5, 8, 3, c1);
  _rect(ctx, 9, 3, 6, 2, c2);
  _rect(ctx, 10, 1, 4, 2, c2);
  // Острые углы (кристаллы)
  _px(ctx, 5, 10, c2); _px(ctx, 4, 11, c3);
  _px(ctx, 18, 10, c2); _px(ctx, 19, 11, c3);
  _px(ctx, 6, 7, c3); _px(ctx, 17, 7, c3);
  // Корона
  _hline(ctx, 9, 2, 6, gold);
  _px(ctx, 9, 1, gold); _px(ctx, 14, 1, gold); _px(ctx, 11, 0, gold);
  // Глаза
  _px(ctx, 10, 7, '#0044ff');
  _px(ctx, 13, 7, '#0044ff');
  // Руки
  _rect(ctx, 4, 9, 3, 6, c1);
  _rect(ctx, 17, 9, 3, 6, c1);
}

function _sprite_boss_ancient_ent(ctx) {
  const bark = '#3a5a2a';
  const leaf = '#6a8a4a';
  // Ствол (тело)
  _rect(ctx, 8, 6, 8, 14, bark);
  _rect(ctx, 7, 8, 10, 10, bark);
  // Лицо
  _rect(ctx, 9, 8, 6, 4, '#5a7a4a');
  _px(ctx, 10, 9, '#ff8800'); // глаз
  _px(ctx, 13, 9, '#ff8800');
  _hline(ctx, 10, 11, 4, '#4a3a2a'); // рот
  // Крона (ветки с листьями)
  _rect(ctx, 5, 1, 14, 6, leaf);
  _rect(ctx, 6, 0, 12, 1, leaf);
  _rect(ctx, 4, 2, 16, 4, leaf);
  // Ветки-руки
  _rect(ctx, 3, 8, 4, 2, bark);
  _rect(ctx, 1, 7, 2, 2, leaf);
  _rect(ctx, 17, 8, 4, 2, bark);
  _rect(ctx, 21, 7, 2, 2, leaf);
  // Корни (ноги)
  _rect(ctx, 7, 20, 3, 3, bark);
  _rect(ctx, 14, 20, 3, 3, bark);
  _px(ctx, 6, 22, bark); _px(ctx, 17, 22, bark);
}

function _sprite_boss_dark_knight(ctx) {
  const armor = '#1a1a2a';
  const eye = '#cc0000';
  const gold = '#ffd700';
  // Шлем
  _rect(ctx, 9, 1, 6, 6, armor);
  _rect(ctx, 10, 0, 4, 1, armor);
  // Глаза
  _px(ctx, 11, 3, eye); _px(ctx, 13, 3, eye);
  // Тело (тёмные латы)
  _rect(ctx, 7, 7, 10, 9, armor);
  _rect(ctx, 8, 6, 8, 1, '#222');
  // Наплечники (с шипами)
  _rect(ctx, 4, 7, 3, 3, armor);
  _rect(ctx, 17, 7, 3, 3, armor);
  _px(ctx, 4, 6, '#cc0000');
  _px(ctx, 19, 6, '#cc0000');
  // Ноги
  _rect(ctx, 8, 16, 3, 6, armor);
  _rect(ctx, 13, 16, 3, 6, armor);
  // Тёмная волна (аура)
  _px(ctx, 3, 10, '#660000');
  _px(ctx, 20, 10, '#660000');
  // Меч (тёмный)
  _vline(ctx, 21, 2, 14, '#444');
  _rect(ctx, 20, 2, 3, 2, '#666');
}

function _sprite_boss_ghoul_king(ctx) {
  const skin = '#4a0e0e';
  const gold = '#ffd700';
  // Голова (бледная)
  _rect(ctx, 9, 1, 6, 5, '#8a3030');
  // Корона
  _hline(ctx, 8, 0, 8, gold);
  _px(ctx, 9, 0, gold); _px(ctx, 12, 0, gold); _px(ctx, 15, 0, gold);
  // Глаза
  _px(ctx, 10, 3, '#ff0000');
  _px(ctx, 13, 3, '#ff0000');
  // Рот (с клыками)
  _hline(ctx, 10, 5, 4, '#333');
  _px(ctx, 10, 5, '#fff'); _px(ctx, 13, 5, '#fff');
  // Тело
  _rect(ctx, 7, 6, 10, 10, skin);
  _rect(ctx, 8, 5, 8, 1, skin);
  // Когти (длинные руки)
  _rect(ctx, 4, 7, 3, 6, skin);
  _rect(ctx, 17, 7, 3, 6, skin);
  _px(ctx, 3, 12, '#fff'); _px(ctx, 4, 13, '#fff');
  _px(ctx, 20, 12, '#fff'); _px(ctx, 19, 13, '#fff');
  // Ноги
  _rect(ctx, 8, 16, 3, 5, skin);
  _rect(ctx, 13, 16, 3, 5, skin);
}

function _sprite_boss_ice_serpent(ctx) {
  const body = '#88ccff';
  const light = '#bbddff';
  // Длинное змеиное тело (волной)
  _rect(ctx, 2, 10, 4, 4, body);
  _rect(ctx, 5, 8, 4, 4, body);
  _rect(ctx, 8, 10, 4, 4, body);
  _rect(ctx, 11, 8, 4, 4, body);
  _rect(ctx, 14, 10, 4, 4, body);
  _rect(ctx, 17, 8, 4, 4, body);
  // Голова
  _rect(ctx, 20, 7, 4, 5, body);
  _px(ctx, 21, 8, '#fff'); // глаз
  _px(ctx, 23, 9, light); // морда
  // Блики
  _px(ctx, 3, 10, light);
  _px(ctx, 9, 10, light);
  _px(ctx, 15, 10, light);
  // Ледяные шипы на спине
  _px(ctx, 4, 9, '#fff');
  _px(ctx, 7, 7, '#fff');
  _px(ctx, 10, 9, '#fff');
  _px(ctx, 13, 7, '#fff');
  _px(ctx, 16, 9, '#fff');
}

function _sprite_boss_magma_giant(ctx) {
  const rock = '#4a2a1a';
  const lava = '#ff4400';
  const glow = '#ff8800';
  // Огромная каменная фигура
  _rect(ctx, 6, 4, 12, 14, rock);
  _rect(ctx, 7, 3, 10, 1, rock);
  _rect(ctx, 7, 18, 10, 3, rock);
  // Голова
  _rect(ctx, 8, 0, 8, 4, rock);
  // Глаза (лавовые)
  _px(ctx, 10, 2, lava);
  _px(ctx, 13, 2, lava);
  // Трещины лавы
  _vline(ctx, 9, 6, 4, lava);
  _hline(ctx, 10, 10, 5, lava);
  _vline(ctx, 14, 11, 4, lava);
  _hline(ctx, 7, 15, 4, lava);
  // Свечение
  _px(ctx, 9, 5, glow); _px(ctx, 14, 9, glow);
  _px(ctx, 7, 14, glow);
  // Руки
  _rect(ctx, 3, 6, 3, 7, rock);
  _rect(ctx, 18, 6, 3, 7, rock);
  _px(ctx, 2, 8, lava); _px(ctx, 21, 8, lava);
  // Ноги
  _rect(ctx, 7, 20, 4, 3, rock);
  _rect(ctx, 13, 20, 4, 3, rock);
}

function _sprite_boss_spider_matriarch(ctx) {
  const body = '#1a1a2a';
  const accent = '#cc66ff';
  // Тело
  _rect(ctx, 7, 9, 10, 7, body);
  _rect(ctx, 8, 8, 8, 9, body);
  // Голова
  _rect(ctx, 9, 5, 6, 4, body);
  // Глаза (фиолетовые)
  _px(ctx, 10, 6, accent); _px(ctx, 13, 6, accent);
  _px(ctx, 10, 7, accent); _px(ctx, 13, 7, accent);
  _px(ctx, 11, 5, '#fff'); _px(ctx, 12, 5, '#fff');
  // Ноги (8 шт)
  _px(ctx, 5, 8, body); _px(ctx, 4, 7, body); _px(ctx, 3, 6, body);
  _px(ctx, 5, 11, body); _px(ctx, 4, 12, body); _px(ctx, 3, 13, body);
  _px(ctx, 5, 14, body); _px(ctx, 4, 15, body);
  _px(ctx, 6, 16, body); _px(ctx, 5, 17, body);
  _px(ctx, 18, 8, body); _px(ctx, 19, 7, body); _px(ctx, 20, 6, body);
  _px(ctx, 18, 11, body); _px(ctx, 19, 12, body); _px(ctx, 20, 13, body);
  _px(ctx, 18, 14, body); _px(ctx, 19, 15, body);
  _px(ctx, 17, 16, body); _px(ctx, 18, 17, body);
  // Паутинная аура
  _px(ctx, 2, 5, accent); _px(ctx, 21, 5, accent);
}

function _sprite_boss_knight_commander(ctx) {
  const armor = '#b0b0b0';
  const gold = '#ffd700';
  // Золотые латы
  _rect(ctx, 8, 1, 8, 6, armor);
  _rect(ctx, 9, 0, 6, 1, gold); // корона
  _px(ctx, 10, 0, gold); _px(ctx, 13, 0, gold);
  // Глаза
  _px(ctx, 10, 3, '#4488ff');
  _px(ctx, 13, 3, '#4488ff');
  // Тело (золотистые латы)
  _rect(ctx, 6, 7, 12, 9, armor);
  _hline(ctx, 7, 7, 10, gold);
  _hline(ctx, 7, 10, 10, gold);
  // Наплечники (золотые)
  _rect(ctx, 4, 7, 2, 3, gold);
  _rect(ctx, 18, 7, 2, 3, gold);
  // Ноги
  _rect(ctx, 8, 16, 3, 6, armor);
  _rect(ctx, 13, 16, 3, 6, armor);
  // Двуручный меч
  _vline(ctx, 21, 1, 16, '#ccc');
  _rect(ctx, 20, 1, 3, 2, gold);
  _px(ctx, 21, 0, '#fff');
}

function _sprite_boss_shadow_dragon(ctx) {
  const body = '#1a0033';
  const aura = '#9933ff';
  const wing = '#0d001a';
  // Тело дракона
  _rect(ctx, 7, 9, 10, 8, body);
  _rect(ctx, 8, 8, 8, 1, body);
  // Голова
  _rect(ctx, 14, 4, 6, 5, body);
  _px(ctx, 20, 5, body); _px(ctx, 21, 6, body);
  // Глаза
  _px(ctx, 16, 5, aura);
  _px(ctx, 18, 5, aura);
  // Крылья (огромные)
  _rect(ctx, 1, 5, 6, 8, wing);
  _px(ctx, 0, 6, wing); _px(ctx, 0, 7, wing);
  _rect(ctx, 2, 4, 4, 1, wing);
  _rect(ctx, 3, 3, 3, 1, wing);
  // Хвост
  _px(ctx, 7, 17, body); _px(ctx, 6, 18, body);
  _px(ctx, 5, 19, body); _px(ctx, 4, 20, body);
  // Фиолетовая аура
  _px(ctx, 5, 7, aura); _px(ctx, 19, 8, aura);
  _px(ctx, 3, 12, aura); _px(ctx, 20, 13, aura);
  _px(ctx, 8, 18, aura); _px(ctx, 15, 18, aura);
  // Рога
  _px(ctx, 14, 3, aura); _px(ctx, 19, 3, aura);
}

function _sprite_boss_ancient_dragon(ctx) {
  const body = '#cc3300';
  const gold = '#ffd700';
  const wing = '#aa1100';
  // Массивное тело
  _rect(ctx, 6, 10, 12, 8, body);
  _rect(ctx, 7, 9, 10, 1, body);
  // Голова (крупная)
  _rect(ctx, 14, 3, 7, 6, body);
  _px(ctx, 21, 5, body); _px(ctx, 22, 5, '#ff6600'); // дыхание
  // Глаза (золотые)
  _px(ctx, 16, 4, gold);
  _px(ctx, 19, 4, gold);
  // Корона
  _hline(ctx, 14, 2, 7, gold);
  _px(ctx, 15, 1, gold); _px(ctx, 18, 1, gold); _px(ctx, 20, 1, gold);
  // Массивные крылья
  _rect(ctx, 1, 4, 6, 9, wing);
  _rect(ctx, 0, 5, 1, 7, wing);
  _rect(ctx, 2, 3, 4, 1, wing);
  _rect(ctx, 3, 2, 3, 1, wing);
  // Хвост
  _px(ctx, 6, 18, body); _px(ctx, 5, 19, body);
  _px(ctx, 4, 20, body); _px(ctx, 3, 21, body); _px(ctx, 2, 22, body);
  // Ноги
  _rect(ctx, 8, 18, 3, 4, body);
  _rect(ctx, 14, 18, 3, 4, body);
  // Золотая аура
  _px(ctx, 0, 3, gold); _px(ctx, 23, 3, gold);
  _px(ctx, 0, 12, gold); _px(ctx, 23, 12, gold);
  _px(ctx, 4, 23, gold); _px(ctx, 19, 23, gold);
  // Чешуя
  _px(ctx, 9, 12, '#ff6600');
  _px(ctx, 12, 14, '#ff6600');
  _px(ctx, 15, 12, '#ff6600');
}



/* ============================================================
   Реестр спрайтов — привязка ID врага → генератор + размер
   ============================================================ */

const SPRITE_REGISTRY = {
  // --- Нежить ---
  skeleton:       { fn: _sprite_skeleton, size: 16 },
  zombie:         { fn: _sprite_zombie, size: 16 },
  ghost:          { fn: _sprite_ghost, size: 16 },
  archer:         { fn: _sprite_archer, size: 16 },
  mage:           { fn: _sprite_mage, size: 16 },
  captain:        { fn: _sprite_captain, size: 16 },
  alchemist_skel: { fn: _sprite_alchemist_skel, size: 16 },
  ratcatcher:     { fn: _sprite_ratcatcher, size: 16 },
  lich_minor:     { fn: _sprite_lich_minor, size: 16 },
  archlich:       { fn: _sprite_archlich, size: 16 },
  death_knight:   { fn: _sprite_death_knight, size: 16 },
  shadow:         { fn: _sprite_shadow, size: 16 },

  // --- Пауки и насекомые ---
  spider:         { fn: _sprite_spider, size: 16 },
  spiderling:     { fn: _sprite_spiderling, size: 16 },
  cave_crab:      { fn: _sprite_cave_crab, size: 16 },
  harpy:          { fn: _sprite_harpy, size: 16 },
  dung_beetle:    { fn: _sprite_dung_beetle, size: 16 },

  // --- Слизни и грибы ---
  ooze:           { fn: _sprite_ooze, size: 16 },
  slimeling:      { fn: _sprite_slimeling, size: 16 },
  acid_slug:      { fn: _sprite_acid_slug, size: 16 },
  gasspore:       { fn: _sprite_gasspore, size: 16 },
  mold:           { fn: _sprite_mold, size: 16 },

  // --- Гоблины, гноллы, кобольды, культисты ---
  goblin:         { fn: _sprite_goblin, size: 16 },
  gnoll:          { fn: _sprite_gnoll, size: 16 },
  kobold:         { fn: _sprite_kobold, size: 16 },
  cultist:        { fn: _sprite_cultist, size: 16 },
  drow:           { fn: _sprite_drow, size: 16 },
  doppelganger:   { fn: _sprite_doppelganger, size: 16 },

  // --- Элементали ---
  fire_elem:      { fn: _sprite_fire_elem, size: 16 },
  earth_elem:     { fn: _sprite_earth_elem, size: 16 },
  water_elem:     { fn: _sprite_water_elem, size: 16 },

  // --- Драконы и ящеры ---
  dragonet:       { fn: _sprite_dragonet, size: 16 },
  young_dragon:   { fn: _sprite_young_dragon, size: 16 },
  dragonid:       { fn: _sprite_dragonid, size: 16 },

  // --- Демоны ---
  hell_hound:     { fn: _sprite_hell_hound, size: 16 },
  demon_berserker:{ fn: _sprite_demon_berserker, size: 16 },

  // --- Животные ---
  giant_rat:      { fn: _sprite_giant_rat, size: 16 },
  cave_bat:       { fn: _sprite_cave_bat, size: 16 },
  bat:            { fn: _sprite_bat, size: 16 },

  // --- Мифические ---
  basilisk:       { fn: _sprite_basilisk, size: 16 },
  medusa:         { fn: _sprite_medusa, size: 16 },
  chimera:        { fn: _sprite_chimera, size: 16 },
  hydra_small:    { fn: _sprite_hydra_small, size: 16 },
  minotaur:       { fn: _sprite_minotaur, size: 16 },

  // --- Големы ---
  rotgolem:       { fn: _sprite_rotgolem, size: 16 },
  stone_golem:    { fn: _sprite_stone_golem, size: 16 },
  bone_colossus:  { fn: _sprite_bone_colossus, size: 16 },

  // --- Уникальные ---
  mimic:          { fn: _sprite_mimic, size: 16 },
  beholder_spore: { fn: _sprite_beholder_spore, size: 16 },
  observer:       { fn: _sprite_observer, size: 16 },
  illithid:       { fn: _sprite_illithid, size: 16 },
  eldritch_horror:{ fn: _sprite_eldritch_horror, size: 16 },
  rust_monster:   { fn: _sprite_rust_monster, size: 16 },

  // --- Боссы (24x24) ---
  boss_skeleton_knight: { fn: _sprite_boss_skeleton_knight, size: 24 },
  boss_lich:            { fn: _sprite_boss_lich, size: 24 },
  boss_spider_queen:    { fn: _sprite_boss_spider_queen, size: 24 },
  boss_fire_lord:       { fn: _sprite_boss_fire_lord, size: 24 },
  boss_ice_lord:        { fn: _sprite_boss_ice_lord, size: 24 },
  boss_ancient_ent:     { fn: _sprite_boss_ancient_ent, size: 24 },
  boss_dark_knight:     { fn: _sprite_boss_dark_knight, size: 24 },
  boss_ghoul_king:      { fn: _sprite_boss_ghoul_king, size: 24 },
  boss_ice_serpent:     { fn: _sprite_boss_ice_serpent, size: 24 },
  boss_magma_giant:     { fn: _sprite_boss_magma_giant, size: 24 },
  boss_spider_matriarch:{ fn: _sprite_boss_spider_matriarch, size: 24 },
  boss_knight_commander:{ fn: _sprite_boss_knight_commander, size: 24 },
  boss_shadow_dragon:   { fn: _sprite_boss_shadow_dragon, size: 24 },
  boss_ancient_dragon:  { fn: _sprite_boss_ancient_dragon, size: 24 },
};

/* ============================================================
   Размеры спрайтов для отображения (spriteSize) в пикселях на экране.
   Обычные враги: 32px, элитные/крупные: 40px, боссы: 48-64px.
   ============================================================ */
const SPRITE_DISPLAY_SIZES = {
  // Обычные (маленькие/средние)
  skeleton: 32, zombie: 32, goblin: 28, archer: 30,
  ooze: 32, gasspore: 28, mage: 30, spider: 32,
  fire_elem: 34, bat: 26, cave_bat: 24, giant_rat: 24,
  acid_slug: 26, ratcatcher: 28, mold: 24, ghost: 30,
  gnoll: 32, kobold: 26, cave_crab: 32, alchemist_skel: 30,
  harpy: 30, dung_beetle: 28, spiderling: 20, slimeling: 22,

  // Средние/элитные
  captain: 36, cultist: 28, shadow: 28, drow: 28,
  minotaur: 38, basilisk: 32, medusa: 30, doppelganger: 34,
  earth_elem: 38, water_elem: 32, beholder_spore: 32,
  hell_hound: 30, dragonid: 34, illithid: 30,
  stone_golem: 40, rust_monster: 32, lich_minor: 30,
  chimera: 38, demon_berserker: 36, mimic: 32,

  // Крупные/тир 5
  rotgolem: 42, dragonet: 36, young_dragon: 44,
  observer: 38, death_knight: 40, hydra_small: 44,
  archlich: 36, eldritch_horror: 48, bone_colossus: 44,

  // Боссы
  boss_skeleton_knight: 52, boss_lich: 48,
  boss_spider_queen: 56, boss_fire_lord: 56,
  boss_ice_lord: 52, boss_ancient_ent: 60,
  boss_dark_knight: 52, boss_ghoul_king: 48,
  boss_ice_serpent: 60, boss_magma_giant: 56,
  boss_spider_matriarch: 52, boss_knight_commander: 56,
  boss_shadow_dragon: 60, boss_ancient_dragon: 64,
};


/* ============================================================
   Публичный API
   ============================================================ */

/**
 * Генерирует спрайт для одного врага и возвращает offscreen canvas.
 * @param {string} enemyId
 * @returns {HTMLCanvasElement|null}
 */
function generateEnemySprite(enemyId) {
  const reg = SPRITE_REGISTRY[enemyId];
  if (!reg) return null;
  const canvas = _createSpriteCanvas(reg.size);
  const ctx = canvas.getContext('2d');
  reg.fn(ctx);
  _addOutline(ctx, reg.size, '#000000');
  return canvas;
}

/**
 * Возвращает спрайт из кеша. Если нет — генерирует на лету.
 * @param {string} enemyId
 * @returns {HTMLCanvasElement|null}
 */
function getEnemySprite(enemyId) {
  if (ENEMY_SPRITES[enemyId]) return ENEMY_SPRITES[enemyId];
  // Fallback: генерируем на лету, кешируем
  const sprite = generateEnemySprite(enemyId);
  if (sprite) ENEMY_SPRITES[enemyId] = sprite;
  return sprite;
}

/**
 * Возвращает рекомендуемый размер отображения для врага.
 * Шаг 3 (анимации): использует BASE_SCALE для кратного масштабирования.
 * @param {string} enemyId
 * @returns {number}
 */
function getSpriteDisplaySize(enemyId) {
  const base = SPRITE_DISPLAY_SIZES[enemyId] || 32;
  // Если BASE_SCALE определён, подбираем ближайший кратный 16 * scale размер,
  // но не меньше исходного значения и не больше 2x от исходного.
  // Это обеспечивает чёткие пиксели на любом разрешении.
  if (window.BASE_SCALE) {
    const unit = 16; // базовый размер спрайта
    const scaled = unit * Math.round(base / unit);
    return Math.max(scaled, base);
  }
  return base;
}

/**
 * Инициализация: генерирует все спрайты и сохраняет в кеш.
 * Вызвать один раз при старте игры.
 */
function initSprites() {
  const ids = Object.keys(SPRITE_REGISTRY);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    ENEMY_SPRITES[id] = generateEnemySprite(id);
  }
  console.log(`[Sprites] Сгенерировано ${ids.length} спрайтов врагов`);

  // Шаг 2: генерация спрайтов оружий, пассивок, эволюций, снарядов
  if (window.initItemSprites) initItemSprites();

  // Иконки классов 32×32 и кадры ходьбы 16×16
  initClassSprites();
  initPlayerWalkSprites();
}

/* ============================================================
   CLASS_SPRITES — Качественные пиксельные иконки 32×32 для классов.
   Используются в экране выбора героя и в лагере.
   ============================================================ */

const CLASS_SPRITES = {};

/** Воин: рыцарь в серебряных латах, синий плащ, меч в правой руке. */
function _sprite_class_warrior(ctx) {
  const armor = '#c0c8d0';    // серебристые латы
  const armorDark = '#8a9aaa'; // тень
  const cape = '#2244aa';      // синий плащ
  const capeDark = '#183080';
  const skin = '#e8c8a0';
  const swordBlade = '#d0d8e0';
  const swordHilt = '#8b6914';
  const eye = '#222';
  const hair = '#6b4400';

  // Плащ (за спиной, рисуем первым)
  _rect(ctx, 8, 10, 4, 14, cape);
  _rect(ctx, 7, 14, 6, 10, cape);
  _rect(ctx, 9, 24, 4, 6, capeDark);
  _px(ctx, 7, 24, capeDark);
  _px(ctx, 12, 24, capeDark);

  // Шлем (серебряный)
  _rect(ctx, 12, 2, 8, 8, armor);
  _rect(ctx, 11, 3, 10, 6, armor);
  _rect(ctx, 13, 1, 6, 1, armorDark);
  // Прорезь для глаз
  _rect(ctx, 13, 5, 6, 2, '#222');
  // Глаза
  _px(ctx, 14, 5, '#4488ff');
  _px(ctx, 17, 5, '#4488ff');
  // Навершие шлема
  _rect(ctx, 14, 1, 4, 1, '#ffd700');

  // Тело (латы)
  _rect(ctx, 11, 10, 10, 10, armor);
  _rect(ctx, 10, 11, 12, 8, armor);
  // Тёмные грани
  _rect(ctx, 10, 11, 1, 8, armorDark);
  _rect(ctx, 21, 11, 1, 8, armorDark);
  _rect(ctx, 12, 14, 8, 1, armorDark);
  // Пояс
  _rect(ctx, 11, 19, 10, 2, '#6b4400');
  _px(ctx, 15, 19, '#ffd700'); // пряжка
  _px(ctx, 16, 19, '#ffd700');

  // Наплечники
  _rect(ctx, 8, 9, 3, 3, armor);
  _rect(ctx, 21, 9, 3, 3, armor);
  _px(ctx, 8, 9, armorDark);
  _px(ctx, 23, 9, armorDark);

  // Руки
  _rect(ctx, 8, 12, 2, 8, armor);
  _rect(ctx, 22, 12, 2, 8, armor);
  // Кисти
  _rect(ctx, 8, 20, 2, 2, skin);
  _rect(ctx, 22, 20, 2, 2, skin);

  // Ноги (латные поножи)
  _rect(ctx, 12, 21, 3, 8, armorDark);
  _rect(ctx, 17, 21, 3, 8, armorDark);
  // Обувь
  _rect(ctx, 12, 28, 3, 2, '#444');
  _rect(ctx, 17, 28, 3, 2, '#444');

  // Меч в правой руке
  _rect(ctx, 23, 8, 2, 14, swordBlade);
  _rect(ctx, 24, 6, 1, 2, swordBlade);
  _px(ctx, 24, 5, '#fff'); // острие
  // Гарда
  _rect(ctx, 22, 21, 4, 1, swordHilt);
  // Рукоять
  _rect(ctx, 23, 22, 2, 3, '#5a3a0a');
}

/** Волшебник: фигура в фиолетовом плаще с капюшоном, посох с кристаллом, борода. */
function _sprite_class_mage(ctx) {
  const cloak = '#6a2fa0';
  const cloakDark = '#4a1a70';
  const cloakLight = '#8a4fcc';
  const skin = '#e8c8a0';
  const beard = '#cccccc';
  const staff = '#6b4400';
  const crystal = '#44ffcc';
  const crystalGlow = '#22cc99';

  // Плащ (широкий)
  _rect(ctx, 9, 10, 14, 18, cloak);
  _rect(ctx, 8, 12, 16, 14, cloak);
  _rect(ctx, 7, 16, 18, 10, cloak);
  _rect(ctx, 10, 26, 12, 4, cloakDark);
  // Подол (волнистый)
  _px(ctx, 7, 26, cloak); _px(ctx, 8, 27, cloak);
  _px(ctx, 24, 26, cloak); _px(ctx, 23, 27, cloak);
  // Тёмные складки
  _rect(ctx, 12, 16, 1, 10, cloakDark);
  _rect(ctx, 19, 16, 1, 10, cloakDark);
  _rect(ctx, 15, 12, 2, 14, cloakDark);

  // Капюшон
  _rect(ctx, 11, 2, 10, 9, cloak);
  _rect(ctx, 10, 3, 12, 7, cloak);
  _rect(ctx, 12, 1, 8, 2, cloakDark);
  // Тень внутри капюшона
  _rect(ctx, 12, 4, 8, 4, '#2a0a40');

  // Лицо в капюшоне
  _rect(ctx, 13, 4, 6, 5, skin);
  // Глаза
  _px(ctx, 14, 5, '#8844ff');
  _px(ctx, 17, 5, '#8844ff');
  // Борода (белая)
  _rect(ctx, 13, 8, 6, 3, beard);
  _rect(ctx, 14, 11, 4, 2, beard);
  _px(ctx, 15, 13, beard);
  _px(ctx, 16, 13, beard);

  // Рукава
  _rect(ctx, 6, 12, 3, 8, cloak);
  _rect(ctx, 23, 12, 3, 8, cloak);
  // Кисти
  _rect(ctx, 6, 20, 2, 2, skin);
  _rect(ctx, 24, 20, 2, 2, skin);

  // Посох (в левой руке)
  _rect(ctx, 4, 3, 2, 26, staff);
  _rect(ctx, 5, 2, 1, 1, staff);
  // Кристалл на посохе
  _rect(ctx, 3, 0, 4, 3, crystal);
  _px(ctx, 4, 0, crystalGlow);
  _px(ctx, 5, 1, '#ffffff'); // блик
  // Свечение
  _px(ctx, 2, 1, crystalGlow);
  _px(ctx, 7, 1, crystalGlow);

  // Ботинки
  _rect(ctx, 12, 28, 3, 2, '#333');
  _rect(ctx, 17, 28, 3, 2, '#333');
}

/** Плут: фигура в тёмном плаще с капюшоном, два кинжала, худая. */
function _sprite_class_rogue(ctx) {
  const cloak = '#2a2a2a';
  const cloakDark = '#1a1a1a';
  const cloakAccent = '#3a3a3a';
  const skin = '#d4a870';
  const blade = '#c0c8d0';
  const bladeEdge = '#e8f0f8';

  // Плащ (уже, чем у мага — худая фигура)
  _rect(ctx, 11, 10, 10, 16, cloak);
  _rect(ctx, 10, 12, 12, 12, cloak);
  // Подол
  _rect(ctx, 10, 24, 12, 4, cloakDark);
  _px(ctx, 9, 24, cloak);
  _px(ctx, 22, 24, cloak);
  // Складки
  _rect(ctx, 14, 14, 1, 10, cloakAccent);
  _rect(ctx, 17, 14, 1, 10, cloakAccent);

  // Капюшон (угловатый)
  _rect(ctx, 12, 2, 8, 8, cloak);
  _rect(ctx, 11, 3, 10, 6, cloak);
  _rect(ctx, 13, 1, 6, 2, cloakDark);
  // Тень внутри
  _rect(ctx, 13, 4, 6, 4, '#0a0a0a');

  // Лицо (в тени, только глаза)
  _rect(ctx, 14, 4, 4, 3, '#3a2a1a');
  // Глаза (зеленоватые)
  _px(ctx, 14, 5, '#44ff44');
  _px(ctx, 17, 5, '#44ff44');

  // Рукава (тонкие)
  _rect(ctx, 8, 11, 2, 8, cloak);
  _rect(ctx, 22, 11, 2, 8, cloak);
  // Кисти
  _rect(ctx, 7, 19, 2, 2, skin);
  _rect(ctx, 23, 19, 2, 2, skin);

  // Кинжал левый
  _rect(ctx, 6, 14, 1, 6, blade);
  _px(ctx, 6, 13, bladeEdge);
  _px(ctx, 6, 12, bladeEdge); // острие
  _px(ctx, 6, 20, '#6b4400'); // рукоять

  // Кинжал правый
  _rect(ctx, 25, 14, 1, 6, blade);
  _px(ctx, 25, 13, bladeEdge);
  _px(ctx, 25, 12, bladeEdge); // острие
  _px(ctx, 25, 20, '#6b4400'); // рукоять

  // Ноги (узкие)
  _rect(ctx, 12, 26, 2, 5, '#222');
  _rect(ctx, 18, 26, 2, 5, '#222');
  // Ботинки
  _rect(ctx, 11, 29, 3, 2, '#333');
  _rect(ctx, 18, 29, 3, 2, '#333');

  // Пояс с ножнами
  _rect(ctx, 11, 20, 10, 1, '#4a3a1a');
  _px(ctx, 14, 21, '#888'); // нож на поясе
  _px(ctx, 14, 22, '#888');
}

/** Танк: массивная фигура в тяжёлых серых латах, молот на плече, шлем с рогами. */
function _sprite_class_tank(ctx) {
  const armor = '#6a7080';
  const armorDark = '#4a5060';
  const armorLight = '#8a9aaa';
  const hammerHead = '#555';
  const hammerHandle = '#6b4400';
  const horn = '#c8a83a';
  const skin = '#e8c8a0';

  // Тело (широкое, массивное)
  _rect(ctx, 8, 10, 16, 12, armor);
  _rect(ctx, 7, 11, 18, 10, armor);
  _rect(ctx, 9, 10, 14, 1, armorLight);
  // Тёмные грани
  _rect(ctx, 7, 11, 1, 10, armorDark);
  _rect(ctx, 24, 11, 1, 10, armorDark);
  _rect(ctx, 14, 12, 4, 8, armorDark);
  // Пояс
  _rect(ctx, 8, 21, 16, 2, '#5a4a2a');
  _rect(ctx, 14, 21, 4, 2, '#ffd700'); // большая пряжка

  // Шлем (с рогами)
  _rect(ctx, 11, 2, 10, 8, armor);
  _rect(ctx, 10, 3, 12, 6, armor);
  _rect(ctx, 12, 1, 8, 2, armorDark);
  // Прорезь
  _rect(ctx, 12, 5, 8, 2, '#111');
  // Глаза
  _px(ctx, 13, 5, '#ff8800');
  _px(ctx, 18, 5, '#ff8800');
  // Рога
  _rect(ctx, 8, 2, 2, 4, horn);
  _px(ctx, 7, 1, horn);
  _px(ctx, 7, 0, horn);
  _rect(ctx, 22, 2, 2, 4, horn);
  _px(ctx, 24, 1, horn);
  _px(ctx, 24, 0, horn);

  // Наплечники (массивные)
  _rect(ctx, 5, 9, 4, 4, armorLight);
  _rect(ctx, 23, 9, 4, 4, armorLight);
  _rect(ctx, 5, 9, 4, 1, armorDark);
  _rect(ctx, 23, 9, 4, 1, armorDark);
  // Шипы на наплечниках
  _px(ctx, 5, 8, '#aaa');
  _px(ctx, 7, 8, '#aaa');
  _px(ctx, 25, 8, '#aaa');
  _px(ctx, 23, 8, '#aaa');

  // Руки (толстые)
  _rect(ctx, 5, 13, 3, 8, armor);
  _rect(ctx, 24, 13, 3, 8, armor);
  // Перчатки
  _rect(ctx, 5, 20, 3, 2, armorDark);
  _rect(ctx, 24, 20, 3, 2, armorDark);

  // Ноги (широкие)
  _rect(ctx, 10, 23, 4, 7, armorDark);
  _rect(ctx, 18, 23, 4, 7, armorDark);
  // Сапоги
  _rect(ctx, 10, 28, 4, 3, '#333');
  _rect(ctx, 18, 28, 4, 3, '#333');

  // Молот на правом плече
  _rect(ctx, 26, 4, 2, 18, hammerHandle);
  // Головка молота
  _rect(ctx, 24, 1, 6, 4, hammerHead);
  _rect(ctx, 25, 0, 4, 1, hammerHead);
  _rect(ctx, 25, 5, 4, 1, hammerHead);
  // Блик на молоте
  _px(ctx, 26, 1, '#888');
  _px(ctx, 27, 2, '#888');
}

/** Генерация спрайтов классов. Вызывается внутри initSprites(). */
function initClassSprites() {
  const defs = {
    warrior: _sprite_class_warrior,
    mage: _sprite_class_mage,
    rogue: _sprite_class_rogue,
    tank: _sprite_class_tank,
  };
  for (const [id, fn] of Object.entries(defs)) {
    const canvas = _createSpriteCanvas(32);
    const ctx = canvas.getContext('2d');
    fn(ctx);
    _addOutline(ctx, 32, '#000000');
    CLASS_SPRITES[id] = canvas;
  }
  console.log('[Sprites] Сгенерировано 4 иконки классов (32×32)');
}

/* ============================================================
   PLAYER_WALK_SPRITES — Два кадра ходьбы для каждого класса (16×16).
   frame1 = ноги вместе / левая вперёд, frame2 = правая вперёд.
   ============================================================ */

const PLAYER_WALK_SPRITES = {};

function _drawPlayerBase_warrior(ctx, frame) {
  const armor = '#c0c8d0';
  const armorDark = '#8a9aaa';
  const cape = '#2244aa';
  const skin = '#e8c8a0';
  // Шлем
  _rect(ctx, 5, 0, 6, 5, armor);
  _rect(ctx, 6, 0, 4, 1, armorDark);
  _px(ctx, 6, 2, '#4488ff'); _px(ctx, 9, 2, '#4488ff');
  _rect(ctx, 6, 3, 4, 1, '#222');
  // Тело
  _rect(ctx, 5, 5, 6, 5, armor);
  _rect(ctx, 4, 6, 1, 3, cape);
  // Ноги
  if (frame === 1) {
    _rect(ctx, 6, 10, 2, 4, armorDark);
    _rect(ctx, 9, 11, 2, 3, armorDark);
  } else {
    _rect(ctx, 6, 11, 2, 3, armorDark);
    _rect(ctx, 9, 10, 2, 4, armorDark);
  }
  // Меч
  _vline(ctx, 12, 3, 7, '#d0d8e0');
  _px(ctx, 12, 2, '#fff');
}

function _drawPlayerBase_mage(ctx, frame) {
  const cloak = '#6a2fa0';
  const cloakDark = '#4a1a70';
  const beard = '#ccc';
  // Капюшон
  _rect(ctx, 5, 0, 6, 5, cloak);
  _rect(ctx, 6, 1, 4, 3, '#2a0a40');
  _px(ctx, 7, 2, '#8844ff'); _px(ctx, 9, 2, '#8844ff');
  // Борода
  _px(ctx, 7, 4, beard); _px(ctx, 8, 4, beard);
  // Тело
  _rect(ctx, 5, 5, 6, 6, cloak);
  _rect(ctx, 4, 7, 8, 3, cloak);
  // Ноги (под плащом)
  if (frame === 1) {
    _rect(ctx, 6, 11, 2, 3, cloakDark);
    _rect(ctx, 9, 12, 2, 2, cloakDark);
  } else {
    _rect(ctx, 6, 12, 2, 2, cloakDark);
    _rect(ctx, 9, 11, 2, 3, cloakDark);
  }
  // Посох
  _vline(ctx, 3, 0, 14, '#6b4400');
  _px(ctx, 3, 0, '#44ffcc');
}

function _drawPlayerBase_rogue(ctx, frame) {
  const cloak = '#2a2a2a';
  const cloakDark = '#1a1a1a';
  // Капюшон
  _rect(ctx, 5, 0, 6, 5, cloak);
  _rect(ctx, 6, 1, 4, 3, '#0a0a0a');
  _px(ctx, 7, 2, '#44ff44'); _px(ctx, 9, 2, '#44ff44');
  // Тело (худое)
  _rect(ctx, 6, 5, 4, 5, cloak);
  _rect(ctx, 5, 6, 6, 3, cloak);
  // Кинжалы
  _vline(ctx, 4, 4, 5, '#c0c8d0');
  _px(ctx, 4, 3, '#e8f0f8');
  _vline(ctx, 12, 4, 5, '#c0c8d0');
  _px(ctx, 12, 3, '#e8f0f8');
  // Ноги (тонкие)
  if (frame === 1) {
    _rect(ctx, 6, 10, 2, 4, cloakDark);
    _rect(ctx, 9, 11, 2, 3, cloakDark);
  } else {
    _rect(ctx, 6, 11, 2, 3, cloakDark);
    _rect(ctx, 9, 10, 2, 4, cloakDark);
  }
}

function _drawPlayerBase_tank(ctx, frame) {
  const armor = '#6a7080';
  const armorDark = '#4a5060';
  const horn = '#c8a83a';
  // Шлем с рогами
  _rect(ctx, 5, 0, 6, 5, armor);
  _px(ctx, 4, 0, horn); _px(ctx, 4, 1, horn);
  _px(ctx, 11, 0, horn); _px(ctx, 11, 1, horn);
  _rect(ctx, 6, 2, 4, 1, '#111');
  _px(ctx, 6, 2, '#ff8800'); _px(ctx, 9, 2, '#ff8800');
  // Тело (массивное)
  _rect(ctx, 4, 5, 8, 5, armor);
  _rect(ctx, 3, 6, 10, 3, armor);
  // Наплечники
  _rect(ctx, 3, 4, 2, 2, armorDark);
  _rect(ctx, 12, 4, 2, 2, armorDark);
  // Ноги (широкие)
  if (frame === 1) {
    _rect(ctx, 5, 10, 3, 4, armorDark);
    _rect(ctx, 9, 11, 3, 3, armorDark);
  } else {
    _rect(ctx, 5, 11, 3, 3, armorDark);
    _rect(ctx, 9, 10, 3, 4, armorDark);
  }
  // Молот
  _vline(ctx, 14, 1, 10, '#6b4400');
  _rect(ctx, 13, 0, 3, 2, '#555');
}

/** Генерирует два кадра (frame1, frame2) для каждого класса. */
function initPlayerWalkSprites() {
  const classes = {
    warrior: _drawPlayerBase_warrior,
    mage: _drawPlayerBase_mage,
    rogue: _drawPlayerBase_rogue,
    tank: _drawPlayerBase_tank,
  };
  for (const [id, fn] of Object.entries(classes)) {
    const frames = [];
    for (let f = 1; f <= 2; f++) {
      const canvas = _createSpriteCanvas(16);
      const ctx = canvas.getContext('2d');
      fn(ctx, f);
      _addOutline(ctx, 16, '#000000');
      frames.push(canvas);
    }
    PLAYER_WALK_SPRITES[id] = frames;
  }
  console.log('[Sprites] Сгенерировано 8 кадров ходьбы игрока (16×16)');
}

// Экспорт в глобальную область
window.ENEMY_SPRITES = ENEMY_SPRITES;
window.CLASS_SPRITES = CLASS_SPRITES;
window.PLAYER_WALK_SPRITES = PLAYER_WALK_SPRITES;
window.initSprites = initSprites;
window.getEnemySprite = getEnemySprite;
window.getSpriteDisplaySize = getSpriteDisplaySize;
window.generateEnemySprite = generateEnemySprite;
window.SPRITE_DISPLAY_SIZES = SPRITE_DISPLAY_SIZES;


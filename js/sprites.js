'use strict';
/* ============================================================
   sprites.js — Визуальный редизайн: детализированные спрайты врагов.
   
   Используются градиенты, свечения, тени, внутренние детали.
   Кешируются в ENEMY_SPRITES на оффскрин-канвасах.
   Стилистика: dark fantasy, контрастные цвета, объёмность.
   
   API (не изменён):
   - initSprites()          — генерирует все спрайты, вызвать 1 раз
   - getEnemySprite(id)     — возвращает offscreen canvas спрайта
   - getSpriteDisplaySize(id) — размер отображения
   - ENEMY_SPRITES          — кеш {id: canvas}
   ============================================================ */

const ENEMY_SPRITES = {};


/* ============================================================
   Утилиты рисования — расширенный набор с градиентами и эффектами
   ============================================================ */

function _createSpriteCanvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return c;
}

/** Один пиксель */
function _px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

/** Прямоугольник */
function _rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/** Горизонтальная линия */
function _hline(ctx, x, y, len, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, len, 1);
}

/** Вертикальная линия */
function _vline(ctx, x, y, len, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, len);
}


/** Круг с градиентом — основа для объёмных тел */
function _gradCircle(ctx, cx, cy, r, colorCenter, colorEdge) {
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  grad.addColorStop(0, colorCenter);
  grad.addColorStop(1, colorEdge);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Эллипс с градиентом */
function _gradEllipse(ctx, cx, cy, rx, ry, colorCenter, colorEdge) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  _gradCircle(ctx, 0, 0, rx, colorCenter, colorEdge);
  ctx.restore();
}

/** Свечение вокруг точки (мягкое) */
function _glow(ctx, cx, cy, r, color, alpha) {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha || 0.6;
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}


/** Линейный градиент прямоугольник (сверху вниз) */
function _gradRect(ctx, x, y, w, h, colorTop, colorBot) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, colorTop);
  grad.addColorStop(1, colorBot);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

/** Контурная обводка непрозрачных пикселей */
function _addOutline(ctx, size, outlineColor) {
  outlineColor = outlineColor || '#000000';
  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;
  const outline = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      if (d[idx + 3] === 0) {
        const neighbors = [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
            const nIdx = (ny * size + nx) * 4;
            if (d[nIdx + 3] > 0) { outline.push([x, y]); break; }
          }
        }
      }
    }
  }
  ctx.fillStyle = outlineColor;
  for (const [x, y] of outline) ctx.fillRect(x, y, 1, 1);
}


/** Рисование «глаз» с бликом — для всех существ */
function _eyes(ctx, x1, y1, x2, y2, color, size) {
  size = size || 1;
  ctx.fillStyle = color;
  ctx.fillRect(x1, y1, size, size);
  ctx.fillRect(x2, y2, size, size);
  // Блик (белая точка в верхнем-левом углу глаза)
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(x1, y1, 1, 1);
  ctx.fillRect(x2, y2, 1, 1);
}

/** Рисование зубов/клыков */
function _teeth(ctx, x, y, count, color) {
  ctx.fillStyle = color || '#fff';
  for (let i = 0; i < count; i++) {
    ctx.fillRect(x + i * 2, y, 1, 1 + (i % 2));
  }
}

/** Добавить «текстуру» — случайные точки поверх тела */
function _texture(ctx, x, y, w, h, color, density) {
  ctx.fillStyle = color;
  const count = Math.floor(w * h * (density || 0.15));
  for (let i = 0; i < count; i++) {
    const px = x + Math.floor(Math.random() * w);
    const py = y + Math.floor(Math.random() * h);
    ctx.fillRect(px, py, 1, 1);
  }
}

/** Рисование костей (для скелетов) — сегментированные линии */
function _bone(ctx, x, y, len, vertical, color) {
  const c = color || '#e8dcc8';
  const dark = '#c8b8a0';
  if (vertical) {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, 1, len);
    ctx.fillStyle = dark;
    ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(x, y + len - 1, 1, 1);
  } else {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, len, 1);
    ctx.fillStyle = dark;
    ctx.fillRect(x, y, 1, 1);
    ctx.fillRect(x + len - 1, y, 1, 1);
  }
}


/* ============================================================
   НЕЖИТЬ — детализированные спрайты с объёмом
   ============================================================ */

function _sprite_skeleton(ctx) {
  // Скелет-воин: кости с градиентом, красные глаза, ржавый меч
  const bone = '#e8dcc8', boneDark = '#b8a888', boneLight = '#fff8e8';
  // Череп (объёмный)
  _gradRect(ctx, 6, 1, 4, 4, boneLight, bone);
  _px(ctx, 5, 2, bone); _px(ctx, 10, 2, bone);
  // Глазницы (тёмные впадины + красные зрачки)
  _rect(ctx, 7, 2, 1, 1, '#1a0000');
  _rect(ctx, 9, 2, 1, 1, '#1a0000');
  _px(ctx, 7, 2, '#ff2222'); _px(ctx, 9, 2, '#ff2222');
  // Зубы
  _teeth(ctx, 7, 4, 2, '#ccc');
  // Позвоночник
  _bone(ctx, 8, 5, 5, true, bone);
  // Рёбра (3 пары)
  _hline(ctx, 6, 6, 5, bone); _hline(ctx, 6, 7, 5, boneDark);
  _hline(ctx, 6, 8, 5, bone);
  // Плечи и руки
  _bone(ctx, 5, 6, 3, true, bone);
  _bone(ctx, 11, 6, 3, true, bone);
  // Таз
  _hline(ctx, 7, 10, 3, boneDark);
  // Ноги
  _bone(ctx, 7, 11, 4, true, bone);
  _bone(ctx, 9, 11, 4, true, bone);
  // Ржавый меч в правой руке
  _vline(ctx, 12, 5, 6, '#8a7a6a');
  _px(ctx, 12, 4, '#a09080');
  _px(ctx, 12, 3, '#b0a090');
  // Искра на мече
  _px(ctx, 12, 5, '#ddd');
}


function _sprite_zombie(ctx) {
  // Зомби: гнилая плоть, рваная одежда, кровь
  const skin = '#5a7a3a', skinDark = '#3a5a1a', skinLight = '#7a9a5a';
  const cloth = '#3a2a1a', blood = '#8b0000';
  // Голова (деформированная, асимметричная)
  _gradRect(ctx, 6, 2, 4, 4, skinLight, skin);
  _px(ctx, 5, 3, skin); // выпуклость
  _px(ctx, 10, 4, skinDark); // впадина
  // Глаза (один красный, другой пустой)
  _px(ctx, 7, 3, '#ff3333');
  _px(ctx, 9, 3, '#222');
  // Рот (оскал)
  _hline(ctx, 7, 5, 3, blood);
  _px(ctx, 7, 5, '#ddd'); _px(ctx, 9, 5, '#ddd'); // зубы
  // Тело (рваная рубаха)
  _gradRect(ctx, 6, 6, 4, 5, cloth, '#2a1a0a');
  _px(ctx, 5, 7, cloth); _px(ctx, 10, 8, skinDark);
  // Гнилые пятна
  _px(ctx, 7, 7, skinDark); _px(ctx, 9, 9, '#4a3a0a');
  // Руки (одна выше — тянется)
  _vline(ctx, 5, 5, 4, skin);
  _vline(ctx, 10, 6, 5, skin);
  _px(ctx, 4, 5, skinDark); // когти
  // Ноги (неровные)
  _vline(ctx, 7, 11, 4, cloth);
  _vline(ctx, 9, 11, 3, cloth);
  // Кровавые подтёки
  _px(ctx, 6, 10, blood); _px(ctx, 8, 11, blood);
}

function _sprite_ghost(ctx) {
  // Призрак: полупрозрачный, мерцающий, с тёмными глазницами
  const gc = 'rgba(200,220,255,0.85)', gcDark = 'rgba(150,170,200,0.7)';
  // Тело (каплевидное с размытыми краями)
  ctx.globalAlpha = 0.8;
  _gradRect(ctx, 5, 3, 6, 8, '#e8eeff', '#aabbdd');
  _rect(ctx, 4, 5, 8, 5, '#ddeeff');
  _rect(ctx, 6, 2, 4, 1, '#f0f4ff');
  ctx.globalAlpha = 0.5;
  // Волнистый низ (эктоплазма)
  _px(ctx, 4, 11, '#aaccee'); _px(ctx, 6, 12, '#99bbdd');
  _px(ctx, 8, 12, '#aaccee'); _px(ctx, 10, 11, '#88aacc');
  _px(ctx, 5, 13, '#7799bb'); _px(ctx, 9, 13, '#88aacc');
  ctx.globalAlpha = 1;
  // Глазницы (чёрные дыры)
  _rect(ctx, 6, 5, 2, 2, '#000033');
  _rect(ctx, 9, 5, 2, 2, '#000033');
  // Зрачки (голубые огоньки)
  _px(ctx, 6, 5, '#66aaff'); _px(ctx, 9, 5, '#66aaff');
  // Рот (стон)
  _rect(ctx, 7, 8, 2, 1, '#223');
}


function _sprite_lich_minor(ctx) {
  // Малый лич: тёмный плащ, череп в капюшоне, фиолетовое свечение
  const cloak = '#1a0033', cloakEdge = '#2a0055';
  const skull = '#e8dcc8', gold = '#ffd700';
  // Плащ (объёмный с градиентом)
  _gradRect(ctx, 5, 4, 6, 10, cloakEdge, cloak);
  _gradRect(ctx, 4, 6, 8, 7, cloak, '#0d001a');
  _rect(ctx, 3, 10, 10, 4, cloak);
  // Капюшон
  _gradRect(ctx, 5, 2, 6, 3, cloakEdge, cloak);
  _rect(ctx, 6, 1, 4, 1, cloak);
  // Череп внутри
  _rect(ctx, 6, 3, 4, 3, skull);
  _px(ctx, 7, 4, '#ff2222'); _px(ctx, 9, 4, '#ff2222');
  // Золотая корона
  _hline(ctx, 6, 2, 4, gold);
  _px(ctx, 6, 1, gold); _px(ctx, 9, 1, gold);
  // Посох с кристаллом
  _vline(ctx, 12, 3, 10, '#6a0dad');
  _px(ctx, 12, 2, '#cc66ff');
  _glow(ctx, 12, 2, 2, '#9933ff', 0.5);
  // Фиолетовая аура по краям
  _px(ctx, 4, 5, '#6600cc'); _px(ctx, 11, 5, '#6600cc');
}

function _sprite_archlich(ctx) {
  // Архилич: чёрный плащ, золотая аура, мощный посох
  const cloak = '#0d0d0d', gold = '#ffd700';
  // Плащ
  _gradRect(ctx, 4, 4, 8, 10, '#1a1a1a', cloak);
  _rect(ctx, 3, 6, 10, 8, cloak);
  // Капюшон
  _gradRect(ctx, 5, 1, 6, 4, '#222', cloak);
  // Череп
  _gradRect(ctx, 6, 2, 4, 3, '#fff8e8', '#e8dcc8');
  _px(ctx, 7, 3, '#ff0000'); _px(ctx, 9, 3, '#ff0000');
  // Корона + аура золотая
  _hline(ctx, 5, 1, 6, gold);
  _px(ctx, 5, 0, gold); _px(ctx, 10, 0, gold); _px(ctx, 7, 0, gold);
  // Золотые руны по краям
  _px(ctx, 2, 6, gold); _px(ctx, 13, 6, gold);
  _px(ctx, 2, 10, gold); _px(ctx, 13, 10, gold);
  // Посох
  _vline(ctx, 13, 2, 11, '#8b00ff');
  _px(ctx, 13, 1, '#ff00ff');
  _glow(ctx, 13, 1, 2, '#ff00ff', 0.6);
}


function _sprite_death_knight(ctx) {
  // Рыцарь смерти: чёрные латы с красными рунами, огромный меч
  const armor = '#1a1a2a', armorLight = '#3a3a4a', eye = '#ff0000';
  // Шлем (массивный)
  _gradRect(ctx, 6, 1, 4, 4, armorLight, armor);
  _px(ctx, 5, 2, armor); _px(ctx, 10, 2, armor);
  // Красные глаза в прорези
  _rect(ctx, 7, 3, 1, 1, '#1a0000');
  _px(ctx, 7, 3, eye); _px(ctx, 9, 3, eye);
  // Тело (тяжёлые латы)
  _gradRect(ctx, 5, 5, 6, 6, armorLight, armor);
  _rect(ctx, 4, 6, 8, 4, armor);
  // Красные руны на латах
  _px(ctx, 6, 7, '#cc0000'); _px(ctx, 9, 8, '#cc0000');
  // Наплечники
  _rect(ctx, 3, 5, 2, 2, armorLight);
  _rect(ctx, 11, 5, 2, 2, armorLight);
  _px(ctx, 3, 5, '#550000'); _px(ctx, 12, 5, '#550000'); // шипы
  // Ноги
  _rect(ctx, 6, 11, 2, 4, armor);
  _rect(ctx, 9, 11, 2, 4, armor);
  // Двуручный меч (тёмная сталь + красное свечение)
  _vline(ctx, 13, 2, 8, '#555');
  _rect(ctx, 12, 2, 3, 1, '#777');
  _px(ctx, 13, 1, '#aaa');
  _px(ctx, 13, 4, '#880000'); // руна на мече
  // Красный плащ
  _px(ctx, 4, 10, '#8b0000'); _px(ctx, 3, 11, '#6b0000');
  _px(ctx, 3, 12, '#4b0000');
}

function _sprite_archer(ctx) {
  // Скелет-лучник: кости + большой лук + колчан
  const bone = '#e8dcc8', boneDark = '#b8a888';
  // Череп
  _gradRect(ctx, 6, 1, 4, 4, '#fff8e8', bone);
  _px(ctx, 7, 2, '#ff3333'); _px(ctx, 9, 2, '#ff3333');
  _teeth(ctx, 7, 4, 2, '#aaa');
  // Тело (кости)
  _bone(ctx, 8, 5, 5, true, bone);
  _hline(ctx, 6, 6, 5, bone); _hline(ctx, 6, 8, 5, boneDark);
  // Руки
  _bone(ctx, 5, 6, 3, true, bone);
  _bone(ctx, 11, 6, 3, true, bone);
  // Ноги
  _bone(ctx, 7, 10, 4, true, bone);
  _bone(ctx, 9, 10, 4, true, bone);
  // Лук (большой, тёмное дерево)
  _px(ctx, 3, 4, '#6b3510'); _px(ctx, 3, 5, '#8b4513');
  _px(ctx, 3, 6, '#8b4513'); _px(ctx, 3, 7, '#8b4513');
  _px(ctx, 3, 8, '#8b4513'); _px(ctx, 3, 9, '#6b3510');
  _px(ctx, 4, 3, '#6b3510'); _px(ctx, 4, 10, '#6b3510');
  // Тетива (голубоватая)
  _vline(ctx, 4, 4, 6, '#aaccff');
}


function _sprite_mage(ctx) {
  // Скелет-маг: фиолетовый плащ, магический посох, искры
  const cloak = '#5a3a8a', cloakDark = '#3a1a5a';
  const bone = '#e8dcc8';
  // Плащ
  _gradRect(ctx, 5, 4, 6, 9, cloak, cloakDark);
  _rect(ctx, 4, 6, 8, 6, cloakDark);
  // Капюшон
  _gradRect(ctx, 5, 1, 6, 3, cloak, cloakDark);
  // Череп
  _rect(ctx, 6, 2, 4, 2, bone);
  _px(ctx, 7, 2, '#ff3333'); _px(ctx, 9, 2, '#ff3333');
  // Посох с орбом
  _vline(ctx, 12, 2, 10, '#5a3a8a');
  _px(ctx, 12, 1, '#dccff5');
  _px(ctx, 12, 0, '#ffffff');
  _glow(ctx, 12, 1, 2, '#aa66ff', 0.5);
  // Магические искры
  _px(ctx, 4, 5, '#cc88ff'); _px(ctx, 11, 4, '#cc88ff');
}

function _sprite_captain(ctx) {
  // Капитан скелетов: корона, красный плащ, аура
  const bone = '#e8dcc8', gold = '#ffd700';
  // Череп с короной
  _gradRect(ctx, 6, 1, 4, 4, '#fff8e8', bone);
  _px(ctx, 7, 2, '#ff3333'); _px(ctx, 9, 2, '#ff3333');
  _teeth(ctx, 7, 4, 2, '#aaa');
  // Золотая корона
  _hline(ctx, 6, 0, 4, gold);
  _px(ctx, 7, 0, '#ffee00'); _px(ctx, 9, 0, '#ffee00');
  // Кости
  _bone(ctx, 8, 5, 5, true, bone);
  _hline(ctx, 6, 6, 5, bone); _hline(ctx, 6, 8, 5, bone);
  _bone(ctx, 5, 6, 3, true, bone);
  _bone(ctx, 11, 6, 3, true, bone);
  // Ноги
  _bone(ctx, 7, 10, 4, true, bone);
  _bone(ctx, 9, 10, 4, true, bone);
  // Красный плащ (развевающийся)
  _rect(ctx, 4, 6, 1, 6, '#c0392b');
  _px(ctx, 3, 8, '#c0392b'); _px(ctx, 3, 9, '#a03020');
  _px(ctx, 3, 10, '#802010'); _px(ctx, 3, 11, '#601000');
  // Меч
  _vline(ctx, 12, 5, 6, '#aaa');
  _px(ctx, 12, 4, '#ddd');
}


function _sprite_alchemist_skel(ctx) {
  // Скелет-алхимик: кости + зелёная колба с пузырями
  const bone = '#e8dcc8';
  _gradRect(ctx, 6, 1, 4, 4, '#fff8e8', bone);
  _px(ctx, 7, 2, '#ff3333'); _px(ctx, 9, 2, '#ff3333');
  _bone(ctx, 8, 5, 5, true, bone);
  _hline(ctx, 6, 6, 5, bone); _hline(ctx, 6, 8, 5, bone);
  _bone(ctx, 5, 6, 3, true, bone);
  _bone(ctx, 11, 6, 3, true, bone);
  _bone(ctx, 7, 10, 4, true, bone);
  _bone(ctx, 9, 10, 4, true, bone);
  // Зелёная колба (объёмная)
  _gradRect(ctx, 3, 6, 2, 3, '#50e050', '#208020');
  _px(ctx, 3, 5, '#40c040');
  // Пузыри
  _px(ctx, 3, 7, '#a0ffa0'); _px(ctx, 4, 6, '#80ff80');
}

function _sprite_ratcatcher(ctx) {
  // Скелет-крысолов: кости + крысы у ног
  const bone = '#e8dca0';
  _gradRect(ctx, 6, 1, 4, 4, '#ffe8b0', bone);
  _px(ctx, 7, 2, '#ff3333'); _px(ctx, 9, 2, '#ff3333');
  _bone(ctx, 8, 5, 5, true, bone);
  _hline(ctx, 6, 6, 5, bone); _hline(ctx, 6, 8, 5, bone);
  _bone(ctx, 5, 6, 3, true, bone);
  _bone(ctx, 11, 6, 3, true, bone);
  _bone(ctx, 7, 10, 4, true, bone);
  _bone(ctx, 9, 10, 4, true, bone);
  // Крыса (детализированная)
  _gradRect(ctx, 10, 12, 3, 2, '#a08030', '#6b4a14');
  _px(ctx, 13, 12, '#8b6914'); // хвост
  _px(ctx, 14, 13, '#8b6914');
  _px(ctx, 10, 12, '#ff0000'); // глаз крысы
  _px(ctx, 10, 13, '#ddd'); // зубы крысы
}

function _sprite_banshee(ctx) {
  // Банши: призрачная женщина, развевающиеся волосы, крик
  ctx.globalAlpha = 0.85;
  // Волосы (развевающиеся)
  _px(ctx, 4, 0, '#eee'); _px(ctx, 5, 1, '#ddd');
  _px(ctx, 11, 0, '#eee'); _px(ctx, 10, 1, '#ddd');
  _px(ctx, 3, 1, '#ccc'); _px(ctx, 12, 1, '#ccc');
  // Голова
  _gradRect(ctx, 6, 2, 4, 4, '#ffffff', '#ddeeff');
  _rect(ctx, 5, 3, 6, 2, '#f8f8ff');
  // Глаза (пустые чёрные)
  _rect(ctx, 7, 3, 1, 2, '#000');
  _rect(ctx, 9, 3, 1, 2, '#000');
  // Рот (кричит — тёмный овал)
  _rect(ctx, 7, 5, 2, 2, '#111');
  // Тело (сужающееся)
  _gradRect(ctx, 6, 6, 4, 4, '#eef', '#bbd');
  _rect(ctx, 5, 7, 6, 2, '#ddf');
  // Волнистый низ
  ctx.globalAlpha = 0.5;
  _px(ctx, 5, 11, '#aac'); _px(ctx, 7, 12, '#99b');
  _px(ctx, 9, 12, '#aac'); _px(ctx, 10, 11, '#88a');
  ctx.globalAlpha = 1;
}


/* ============================================================
   ПАУКИ И НАСЕКОМЫЕ
   ============================================================ */

function _sprite_spider(ctx) {
  // Паук: чёрный блестящий панцирь, красные глаза, длинные ноги
  const body = '#1e1e1e', bodyLight = '#3a3a3a';
  // Тело (овал с градиентом — блестящий панцирь)
  _gradRect(ctx, 5, 6, 6, 4, bodyLight, body);
  _gradRect(ctx, 6, 5, 4, 6, bodyLight, body);
  // Блик на панцире
  _px(ctx, 7, 6, '#555');
  // Голова
  _gradRect(ctx, 7, 3, 3, 3, '#2a2a2a', body);
  // Глаза (8 точек — 2 больших, 6 маленьких)
  _px(ctx, 7, 3, '#ff0000'); _px(ctx, 9, 3, '#ff0000');
  _px(ctx, 7, 4, '#aa0000'); _px(ctx, 9, 4, '#aa0000');
  // Жвалы
  _px(ctx, 7, 6, '#8b2252'); _px(ctx, 9, 6, '#8b2252');
  // Ноги (изогнутые, 8 штук)
  const lc = '#2a2a2a', lcT = '#444';
  // Левые
  _px(ctx, 4, 5, lc); _px(ctx, 3, 4, lcT);
  _px(ctx, 4, 7, lc); _px(ctx, 3, 7, lc); _px(ctx, 2, 8, lcT);
  _px(ctx, 4, 9, lc); _px(ctx, 3, 10, lcT);
  _px(ctx, 4, 11, lc); _px(ctx, 3, 12, lcT);
  // Правые
  _px(ctx, 12, 5, lc); _px(ctx, 13, 4, lcT);
  _px(ctx, 12, 7, lc); _px(ctx, 13, 7, lc); _px(ctx, 14, 8, lcT);
  _px(ctx, 12, 9, lc); _px(ctx, 13, 10, lcT);
  _px(ctx, 12, 11, lc); _px(ctx, 13, 12, lcT);
}

function _sprite_spiderling(ctx) {
  // Маленький паучок: компактный, быстрый
  const body = '#3a3a3a', light = '#555';
  _gradRect(ctx, 6, 7, 4, 3, light, body);
  _rect(ctx, 7, 6, 2, 1, body);
  // Ноги (тонкие)
  _px(ctx, 5, 6, '#555'); _px(ctx, 4, 5, '#444');
  _px(ctx, 5, 8, '#555'); _px(ctx, 4, 9, '#444');
  _px(ctx, 5, 10, '#555'); _px(ctx, 4, 11, '#444');
  _px(ctx, 11, 6, '#555'); _px(ctx, 12, 5, '#444');
  _px(ctx, 11, 8, '#555'); _px(ctx, 12, 9, '#444');
  _px(ctx, 11, 10, '#555'); _px(ctx, 12, 11, '#444');
  // Глаза
  _px(ctx, 7, 6, '#ff0000'); _px(ctx, 9, 6, '#ff0000');
}


function _sprite_cave_crab(ctx) {
  // Пещерный краб: оранжевый панцирь с текстурой, клешни
  const body = '#e67300', bodyDark = '#aa5500', accent = '#cc5500';
  // Панцирь (широкий, объёмный)
  _gradRect(ctx, 3, 7, 10, 5, body, bodyDark);
  _rect(ctx, 4, 6, 8, 1, body);
  // Текстура панциря
  _hline(ctx, 4, 8, 8, accent);
  _hline(ctx, 4, 10, 8, accent);
  _px(ctx, 6, 7, '#ff8800'); _px(ctx, 9, 9, '#ff8800');
  // Клешни (детализированные)
  _rect(ctx, 1, 5, 2, 3, body);
  _px(ctx, 0, 5, '#ff8800'); _px(ctx, 0, 7, '#ff8800');
  _rect(ctx, 13, 5, 2, 3, body);
  _px(ctx, 15, 5, '#ff8800'); _px(ctx, 15, 7, '#ff8800');
  // Глаза (чёрные на стебельках)
  _px(ctx, 6, 5, '#222'); _px(ctx, 9, 5, '#222');
  _px(ctx, 6, 6, '#000'); _px(ctx, 9, 6, '#000');
  // Ноги
  _px(ctx, 4, 12, bodyDark); _px(ctx, 6, 12, bodyDark);
  _px(ctx, 9, 12, bodyDark); _px(ctx, 11, 12, bodyDark);
}

function _sprite_harpy(ctx) {
  // Гарпия: женское лицо, перьевые крылья, когти
  const body = '#808080', wing = '#a0a0a0', skin = '#d4a06a';
  // Голова
  _gradRect(ctx, 6, 1, 4, 3, '#e8c8a0', skin);
  // Волосы (тёмные перья)
  _px(ctx, 5, 1, '#444'); _px(ctx, 10, 1, '#444');
  _px(ctx, 5, 2, '#333'); _px(ctx, 10, 2, '#333');
  // Глаза (жёлтые хищные)
  _px(ctx, 7, 2, '#ffdd00'); _px(ctx, 9, 2, '#ffdd00');
  // Тело
  _gradRect(ctx, 6, 4, 4, 5, '#999', body);
  // Крылья (раскрытые, с перьями)
  _gradRect(ctx, 2, 4, 4, 4, wing, '#888');
  _gradRect(ctx, 10, 4, 4, 4, wing, '#888');
  _px(ctx, 1, 5, '#bbb'); _px(ctx, 14, 5, '#bbb');
  // Перья (нижний край)
  _px(ctx, 2, 8, '#666'); _px(ctx, 3, 8, '#555');
  _px(ctx, 13, 8, '#666'); _px(ctx, 12, 8, '#555');
  // Ноги-когти
  _vline(ctx, 7, 9, 4, body);
  _vline(ctx, 9, 9, 4, body);
  _px(ctx, 6, 13, '#333'); _px(ctx, 10, 13, '#333');
}

function _sprite_dung_beetle(ctx) {
  // Жук-навозник: панцирь с блеском, рога, навозный шар
  const body = '#6b4400', bodyLight = '#8b6420';
  // Круглое тело (блестящий панцирь)
  _gradRect(ctx, 6, 6, 5, 6, bodyLight, body);
  _gradRect(ctx, 5, 7, 7, 4, bodyLight, body);
  // Блик
  _px(ctx, 7, 7, '#a08040');
  // Голова
  _gradRect(ctx, 7, 4, 3, 2, bodyLight, body);
  // Рога
  _px(ctx, 7, 3, '#aa7740'); _px(ctx, 9, 3, '#aa7740');
  _px(ctx, 7, 2, '#cc9960');
  // Навозный шар
  _gradRect(ctx, 11, 8, 3, 3, '#888', '#555');
  _px(ctx, 12, 8, '#999');
  // Ноги
  _px(ctx, 5, 10, body); _px(ctx, 4, 11, body); _px(ctx, 5, 12, body);
  // Глаза
  _px(ctx, 7, 5, '#ffcc00'); _px(ctx, 9, 5, '#ffcc00');
}

function _sprite_scorpion(ctx) {
  // Скорпион: золотистый, клешни, изогнутый хвост с жалом
  const body = '#c8a23a', bodyDark = '#a08020';
  // Тело
  _gradRect(ctx, 5, 8, 6, 4, body, bodyDark);
  _rect(ctx, 6, 7, 4, 1, body);
  // Клешни
  _rect(ctx, 2, 6, 3, 2, body); _px(ctx, 1, 6, '#ddb840');
  _rect(ctx, 11, 6, 3, 2, body); _px(ctx, 14, 6, '#ddb840');
  // Хвост (изогнутый вверх)
  _px(ctx, 8, 12, bodyDark); _px(ctx, 8, 13, body);
  _px(ctx, 9, 14, body); _px(ctx, 10, 14, body);
  _px(ctx, 11, 13, body);
  // Жало (красное, ядовитое)
  _px(ctx, 11, 12, '#ff0000');
  _glow(ctx, 11, 12, 1.5, '#ff4400', 0.4);
  // Глаза
  _px(ctx, 7, 7, '#000'); _px(ctx, 9, 7, '#000');
}


/* ============================================================
   СЛИЗНИ И ГРИБЫ
   ============================================================ */

function _sprite_ooze(ctx) {
  // Слизень: полупрозрачный оранжевый, пульсирующий
  const c = '#e89020', cDark = '#a06010', cLight = '#ffbb55';
  // Тело (каплевидное с градиентом)
  _gradRect(ctx, 4, 8, 8, 5, cLight, c);
  _gradRect(ctx, 5, 6, 6, 2, c, cDark);
  _rect(ctx, 6, 5, 4, 1, c);
  _rect(ctx, 3, 10, 10, 3, cDark);
  // Блики (объём)
  _px(ctx, 5, 7, '#ffdd88'); _px(ctx, 6, 6, '#ffe8aa');
  // Глаза (круглые, чёрные)
  _px(ctx, 6, 9, '#000'); _px(ctx, 9, 9, '#000');
  // Пузыри внутри тела
  _px(ctx, 7, 10, 'rgba(255,255,255,0.4)');
  _px(ctx, 10, 11, 'rgba(255,255,255,0.3)');
}

function _sprite_slimeling(ctx) {
  // Малый слизень: маленький и милый
  const c = '#f0a050', cLight = '#ffcc80';
  _gradRect(ctx, 5, 9, 6, 4, cLight, c);
  _rect(ctx, 6, 8, 4, 1, c);
  _px(ctx, 7, 10, '#000'); _px(ctx, 9, 10, '#000');
  _px(ctx, 6, 9, '#ffee99');
}

function _sprite_acid_slug(ctx) {
  // Кислотный слизень: ядовито-зелёный, кислотная лужа
  const c = '#2ecc40', cDark = '#1a8a2a', cLight = '#66ff77';
  _gradRect(ctx, 4, 8, 8, 5, cLight, c);
  _gradRect(ctx, 5, 6, 6, 2, c, cDark);
  _rect(ctx, 6, 5, 4, 1, c);
  _rect(ctx, 3, 10, 10, 3, cDark);
  _px(ctx, 6, 9, '#000'); _px(ctx, 9, 9, '#000');
  // Кислотные капли под ним
  _px(ctx, 3, 14, '#55ff55'); _px(ctx, 5, 14, '#44ee44');
  _hline(ctx, 4, 15, 8, '#33cc33');
  _px(ctx, 10, 14, '#55ff55');
  // Пузыри кислоты
  _px(ctx, 5, 7, '#aaffaa'); _px(ctx, 8, 11, '#88ff88');
}

function _sprite_gasspore(ctx) {
  // Газовая спора: пульсирующий шар, ядовитые споры внутри
  const gc = '#7a9a6a', gcLight = '#a0c090', gcDark = '#5a7a4a';
  // Круглое тело
  _gradRect(ctx, 5, 5, 6, 6, gcLight, gc);
  _gradRect(ctx, 4, 6, 8, 4, gc, gcDark);
  _rect(ctx, 6, 4, 4, 1, gc); _rect(ctx, 6, 11, 4, 1, gcDark);
  // Споры внутри (яркие точки)
  _px(ctx, 6, 7, '#e0ffb0'); _px(ctx, 9, 8, '#e0ffb0');
  _px(ctx, 7, 9, '#d0ff90'); _px(ctx, 8, 6, '#c0ee80');
  // Ядовитое свечение
  _glow(ctx, 8, 8, 4, '#88cc44', 0.3);
}

function _sprite_mold(ctx) {
  // Плесень: плоское пятно с грибницей
  const mc = '#5a7a4a', mcLight = '#7a9a6a';
  _rect(ctx, 3, 10, 10, 4, mc);
  _rect(ctx, 4, 9, 8, 1, mc);
  _rect(ctx, 5, 8, 6, 1, mcLight);
  // Грибница (яркие пупырышки)
  _px(ctx, 5, 10, mcLight); _px(ctx, 8, 11, '#a0c090');
  _px(ctx, 10, 10, mcLight); _px(ctx, 6, 12, '#b0d0a0');
  _px(ctx, 9, 13, '#a0c090');
  // Глаза (жёлтые)
  _px(ctx, 7, 9, '#ffee00'); _px(ctx, 9, 9, '#ffee00');
}

function _sprite_mushroom_man(ctx) {
  // Гриб-человек: большая шляпка с пятнами, белая ножка
  const cap = '#8b4513', capLight = '#a0522d';
  const stem = '#f5f5dc', stemDark = '#e0d8c0';
  // Шляпка (полукруг с градиентом)
  _gradRect(ctx, 4, 2, 8, 4, capLight, cap);
  _rect(ctx, 5, 1, 6, 1, cap);
  _rect(ctx, 3, 4, 10, 2, cap);
  // Пятна на шляпке
  _px(ctx, 6, 2, '#cc8844'); _px(ctx, 9, 3, '#cc8844');
  _px(ctx, 5, 4, '#bb7733'); _px(ctx, 11, 3, '#bb7733');
  // Ножка
  _gradRect(ctx, 6, 6, 4, 6, stem, stemDark);
  _rect(ctx, 5, 8, 6, 3, stemDark);
  // Глаза (чёрные бусины)
  _px(ctx, 7, 8, '#000'); _px(ctx, 9, 8, '#000');
  _px(ctx, 7, 8, '#111'); // зрачок
  // Ноги
  _px(ctx, 6, 12, stemDark); _px(ctx, 9, 12, stemDark);
}


/* ============================================================
   ГОБЛИНЫ, ГНОЛЛЫ, КОБОЛЬДЫ, КУЛЬТИСТЫ
   ============================================================ */

function _sprite_goblin(ctx) {
  // Гоблин: зелёная кожа, большие уши и глаза, маленький нож
  const skin = '#4a8a2a', skinLight = '#6aaa4a', skinDark = '#2a5a1a';
  // Голова (большая для тела)
  _gradRect(ctx, 6, 2, 4, 4, skinLight, skin);
  // Уши (острые, большие)
  _px(ctx, 5, 2, skin); _px(ctx, 4, 1, skinLight);
  _px(ctx, 10, 2, skin); _px(ctx, 11, 1, skinLight);
  // Глаза (жёлтые, большие)
  _px(ctx, 7, 3, '#ffff00'); _px(ctx, 9, 3, '#ffff00');
  _px(ctx, 7, 3, '#ffffaa'); // блик
  // Рот (зубастый)
  _px(ctx, 7, 5, '#333'); _px(ctx, 8, 5, '#ddd'); _px(ctx, 9, 5, '#333');
  // Тело (маленькое, в лохмотьях)
  _gradRect(ctx, 6, 6, 4, 4, '#6a5a3a', '#4a3a2a');
  // Руки
  _vline(ctx, 5, 6, 4, skin);
  _vline(ctx, 10, 6, 4, skin);
  // Нож (блестящий)
  _vline(ctx, 11, 5, 3, '#ccc');
  _px(ctx, 11, 4, '#eee');
  // Ноги (тонкие)
  _vline(ctx, 7, 10, 4, skinDark);
  _vline(ctx, 9, 10, 4, skinDark);
}

function _sprite_gnoll(ctx) {
  // Гнолл: гиена-гуманоид, палка с гвоздями
  const fur = '#a07030', furDark = '#7a5020', furLight = '#c09050';
  // Голова (вытянутая морда)
  _gradRect(ctx, 6, 1, 4, 4, furLight, fur);
  _rect(ctx, 10, 3, 2, 2, fur); // морда
  _px(ctx, 12, 3, '#222'); // нос
  // Уши
  _px(ctx, 6, 0, furLight); _px(ctx, 9, 0, furLight);
  // Глаза (жёлтые хищные)
  _px(ctx, 7, 2, '#ffcc00');
  // Тело (мускулистое)
  _gradRect(ctx, 5, 5, 6, 5, fur, furDark);
  _rect(ctx, 4, 6, 8, 3, furDark);
  // Палка с гвоздями
  _vline(ctx, 13, 2, 10, '#6b3510');
  _px(ctx, 14, 3, '#aaa'); _px(ctx, 12, 4, '#aaa'); _px(ctx, 14, 5, '#aaa');
  // Ноги
  _vline(ctx, 6, 10, 4, furDark);
  _vline(ctx, 9, 10, 4, furDark);
}

function _sprite_kobold(ctx) {
  // Кобольд: ящероподобный, капкан в руках
  const skin = '#8a8a8a', skinLight = '#aaa', skinDark = '#666';
  // Голова (ящер с гребнем)
  _gradRect(ctx, 6, 2, 4, 3, skinLight, skin);
  _px(ctx, 10, 3, skin);
  // Гребень
  _px(ctx, 7, 1, skinDark); _px(ctx, 8, 1, '#888');
  // Глаза (жёлтые щели)
  _px(ctx, 7, 3, '#ffcc00'); _px(ctx, 9, 3, '#ffcc00');
  // Тело
  _gradRect(ctx, 6, 5, 4, 5, '#777', skinDark);
  // Руки
  _vline(ctx, 5, 5, 4, skin); _vline(ctx, 10, 5, 4, skin);
  // Капкан
  _px(ctx, 3, 8, '#bbb'); _px(ctx, 4, 9, '#aaa'); _px(ctx, 4, 7, '#aaa');
  // Хвост
  _px(ctx, 5, 11, skin); _px(ctx, 4, 12, skinDark);
  // Ноги
  _vline(ctx, 7, 10, 4, skinDark); _vline(ctx, 9, 10, 4, skinDark);
}


function _sprite_cultist(ctx) {
  // Культист: чёрный плащ, красные глаза, книга с рунами
  const cloak = '#1a1a1a', cloakDark = '#0a0a0a';
  // Плащ
  _gradRect(ctx, 5, 3, 6, 10, '#2a2a2a', cloak);
  _rect(ctx, 4, 5, 8, 7, cloakDark);
  // Капюшон
  _gradRect(ctx, 5, 1, 6, 3, '#222', cloak);
  // Красные глаза в темноте
  _px(ctx, 7, 3, '#ff0000'); _px(ctx, 9, 3, '#ff0000');
  // Книга (объёмная с символом)
  _gradRect(ctx, 6, 8, 4, 3, '#a0522d', '#6b3510');
  _px(ctx, 7, 9, '#ffd700'); _px(ctx, 8, 9, '#ffd700'); // руна
  // Фиолетовые руны вокруг
  _px(ctx, 4, 8, '#a040ff'); _px(ctx, 11, 8, '#a040ff');
  _glow(ctx, 8, 9, 3, '#8800ff', 0.3);
}

function _sprite_drow(ctx) {
  // Дроу: тёмно-фиолетовая кожа, белые волосы, два кинжала
  const skin = '#6a3a8a', skinLight = '#8a5aaa';
  const hair = '#ffffff', blade = '#c0c8d0';
  // Голова
  _gradRect(ctx, 6, 1, 4, 4, skinLight, skin);
  // Белые волосы
  _px(ctx, 5, 1, hair); _px(ctx, 5, 2, hair);
  _px(ctx, 10, 1, hair); _px(ctx, 10, 2, hair);
  _px(ctx, 6, 0, '#eee'); _px(ctx, 9, 0, '#eee');
  // Глаза (красные)
  _px(ctx, 7, 3, '#ff0000'); _px(ctx, 9, 3, '#ff0000');
  // Тело
  _gradRect(ctx, 6, 5, 4, 5, '#4a0077', '#2a0044');
  _vline(ctx, 5, 5, 5, '#3d0066'); _vline(ctx, 10, 5, 5, '#3d0066');
  // Кинжалы (блестящие)
  _vline(ctx, 4, 6, 4, blade); _px(ctx, 4, 5, '#eef');
  _vline(ctx, 11, 6, 4, blade); _px(ctx, 11, 5, '#eef');
  // Ноги
  _vline(ctx, 7, 10, 4, '#2a0044'); _vline(ctx, 9, 10, 4, '#2a0044');
}

function _sprite_doppelganger(ctx) {
  // Доппельгенгер: серый безликий гуманоид, мерцающий контур
  const skin = '#888', skinDark = '#666', skinLight = '#aaa';
  // Голова (гладкая, без лица)
  _gradRect(ctx, 6, 1, 4, 4, skinLight, skin);
  // Тело
  _gradRect(ctx, 6, 5, 4, 5, skin, skinDark);
  _vline(ctx, 5, 5, 5, skinDark); _vline(ctx, 10, 5, 5, skinDark);
  // Ноги
  _vline(ctx, 7, 10, 4, skinDark); _vline(ctx, 9, 10, 4, skinDark);
  // Мерцающий контур (красные точки — нестабильная форма)
  _px(ctx, 5, 1, '#ff3030'); _px(ctx, 10, 1, '#ff3030');
  _px(ctx, 5, 5, '#ff3030'); _px(ctx, 10, 5, '#ff3030');
  _px(ctx, 5, 9, '#ff3030'); _px(ctx, 10, 9, '#ff3030');
}


/* ============================================================
   ЭЛЕМЕНТАЛИ — с эффектами свечения и градиентами
   ============================================================ */

function _sprite_fire_elem(ctx) {
  // Огненный элементаль: языки пламени, жёлтое ядро
  const c1 = '#ff4400', c2 = '#ff8800', c3 = '#ffdd00';
  // Тело (пламя)
  _gradRect(ctx, 5, 9, 6, 5, c1, '#aa2200');
  _gradRect(ctx, 6, 6, 4, 3, c2, c1);
  _rect(ctx, 7, 4, 2, 2, c2);
  // Зубцы пламени вверх
  _px(ctx, 6, 5, c3); _px(ctx, 9, 5, c3);
  _px(ctx, 7, 3, c3); _px(ctx, 8, 2, '#fff');
  // Глаза (белые, яркие)
  _px(ctx, 7, 8, '#ffffff'); _px(ctx, 9, 8, '#ffffff');
  // Искры
  _px(ctx, 4, 7, c3); _px(ctx, 11, 6, c3);
  _px(ctx, 5, 4, c3); _px(ctx, 10, 5, c3);
  // Свечение
  _glow(ctx, 8, 7, 5, '#ff6600', 0.35);
}

function _sprite_earth_elem(ctx) {
  // Земляной элементаль: каменный голем, трещины, мох
  const c1 = '#8b6b4a', c2 = '#6b4a2a', c3 = '#a08060';
  // Квадратная каменная форма
  _gradRect(ctx, 4, 4, 8, 9, c3, c1);
  _rect(ctx, 5, 3, 6, 1, c2); _rect(ctx, 5, 13, 6, 1, c2);
  // Камни/трещины
  _px(ctx, 5, 5, c3); _px(ctx, 10, 6, c3);
  _hline(ctx, 5, 7, 3, c2); _hline(ctx, 8, 11, 3, c2);
  _px(ctx, 6, 9, '#3a2a1a'); _px(ctx, 9, 10, '#3a2a1a');
  // Мох
  _px(ctx, 4, 8, '#5a8a3a'); _px(ctx, 11, 10, '#5a8a3a');
  // Глаза (оранжевые, светящиеся)
  _px(ctx, 6, 6, '#ff8800'); _px(ctx, 9, 6, '#ff8800');
  _glow(ctx, 6, 6, 1.5, '#ff6600', 0.4);
  _glow(ctx, 9, 6, 1.5, '#ff6600', 0.4);
  // Руки
  _rect(ctx, 2, 6, 2, 4, c1); _rect(ctx, 12, 6, 2, 4, c1);
}

function _sprite_water_elem(ctx) {
  // Водный элементаль: каплевидная форма, блики, прозрачность
  const c1 = '#3377bb', c2 = '#55aadd', c3 = '#aaddff';
  ctx.globalAlpha = 0.9;
  // Каплевидная форма
  _gradRect(ctx, 6, 3, 4, 2, c3, c2);
  _gradRect(ctx, 5, 5, 6, 4, c2, c1);
  _gradRect(ctx, 4, 7, 8, 4, c1, '#224488');
  _rect(ctx, 5, 11, 6, 2, c1);
  // Блики
  _px(ctx, 6, 4, '#ffffff'); _px(ctx, 7, 6, c3);
  ctx.globalAlpha = 1;
  // Глаза (белые)
  _px(ctx, 6, 7, '#ffffff'); _px(ctx, 9, 7, '#ffffff');
  // Капли
  _px(ctx, 3, 9, c2); _px(ctx, 12, 8, c2);
}

function _sprite_ice_elem(ctx) {
  // Ледяной элементаль: кристаллическая форма, грани
  const c1 = '#88ccff', c2 = '#aaeeff', c3 = '#ffffff';
  // Кристалл
  _px(ctx, 8, 1, c3);
  _gradRect(ctx, 7, 2, 2, 2, c3, c2);
  _gradRect(ctx, 6, 4, 4, 3, c2, c1);
  _gradRect(ctx, 5, 6, 6, 4, c1, '#6699cc');
  _rect(ctx, 6, 10, 4, 3, c1);
  // Грани (блеск)
  _px(ctx, 4, 7, c2); _px(ctx, 11, 7, c2);
  _px(ctx, 3, 8, c3); _px(ctx, 12, 8, c3);
  _px(ctx, 6, 5, c3); _px(ctx, 9, 5, c3);
  // Глаза (синие)
  _px(ctx, 7, 7, '#0044ff'); _px(ctx, 9, 7, '#0044ff');
  _glow(ctx, 8, 7, 3, '#4488ff', 0.3);
}

function _sprite_air_elem(ctx) {
  // Воздушный элементаль: вихрь, почти прозрачный
  const c1 = '#ffffff', c2 = '#ccddff';
  ctx.globalAlpha = 0.7;
  // Вихрь (спираль из точек)
  _px(ctx, 8, 2, c1); _px(ctx, 9, 3, c1); _px(ctx, 10, 4, c2);
  _px(ctx, 10, 5, c1); _px(ctx, 9, 6, c2); _px(ctx, 8, 7, c1);
  _px(ctx, 7, 7, c2); _px(ctx, 6, 6, c1); _px(ctx, 5, 5, c2);
  _px(ctx, 5, 4, c1); _px(ctx, 6, 3, c2); _px(ctx, 7, 3, c1);
  // Внешний вихрь
  _px(ctx, 4, 8, c2); _px(ctx, 3, 9, c1); _px(ctx, 4, 10, c2);
  _px(ctx, 5, 11, c1); _px(ctx, 6, 12, c2); _px(ctx, 8, 12, c1);
  _px(ctx, 10, 11, c2); _px(ctx, 11, 10, c1); _px(ctx, 12, 9, c2);
  _px(ctx, 12, 8, c1); _px(ctx, 11, 7, c2);
  ctx.globalAlpha = 1;
  // Глаза (голубые огни)
  _px(ctx, 7, 5, '#6699ff'); _px(ctx, 9, 5, '#6699ff');
  _glow(ctx, 7, 5, 1.5, '#4488ff', 0.5);
  _glow(ctx, 9, 5, 1.5, '#4488ff', 0.5);
}


/* ============================================================
   ДРАКОНЫ И ЯЩЕРЫ
   ============================================================ */

function _sprite_dragonet(ctx) {
  // Дракончик-скелет: костяные крылья, огненные глаза
  const bone = '#9aa0a6', boneLight = '#c0c8d0';
  // Тело
  _gradRect(ctx, 5, 6, 6, 5, boneLight, bone);
  // Голова
  _gradRect(ctx, 8, 3, 4, 3, boneLight, bone);
  _px(ctx, 12, 4, bone);
  // Глаза
  _px(ctx, 9, 4, '#ff0000');
  _glow(ctx, 9, 4, 1.5, '#ff4400', 0.4);
  // Крылья (костяные)
  _px(ctx, 4, 5, bone); _px(ctx, 3, 4, boneLight); _px(ctx, 2, 3, bone);
  _px(ctx, 4, 6, bone); _px(ctx, 3, 5, bone);
  // Хвост
  _px(ctx, 5, 11, bone); _px(ctx, 4, 12, bone); _px(ctx, 3, 13, bone);
  // Рёбра
  _hline(ctx, 6, 7, 4, '#ccc'); _hline(ctx, 6, 9, 4, '#ccc');
  // Ноги
  _vline(ctx, 6, 11, 3, bone); _vline(ctx, 9, 11, 3, bone);
}

function _sprite_young_dragon(ctx) {
  // Молодой дракон: красная чешуя, крылья, дыхание
  const color = '#cc3300', dark = '#881100', wing = '#aa2200';
  // Тело
  _gradRect(ctx, 4, 6, 8, 6, color, dark);
  _rect(ctx, 5, 5, 6, 1, color);
  // Голова
  _gradRect(ctx, 9, 2, 4, 4, color, dark);
  _px(ctx, 13, 3, color); _px(ctx, 14, 3, '#ff6600'); // дыхание
  // Глаза (золотые)
  _px(ctx, 10, 3, '#ffd700');
  _glow(ctx, 14, 3, 2, '#ff4400', 0.4);
  // Крылья
  _gradRect(ctx, 1, 3, 3, 5, wing, '#660000');
  _px(ctx, 0, 4, wing); _px(ctx, 0, 5, wing);
  _rect(ctx, 2, 2, 2, 1, wing);
  // Хвост
  _px(ctx, 4, 12, color); _px(ctx, 3, 13, dark);
  _px(ctx, 2, 14, dark); _px(ctx, 1, 15, '#550000');
  // Ноги
  _vline(ctx, 6, 12, 3, dark); _vline(ctx, 10, 12, 3, dark);
  // Рога (золотые)
  _px(ctx, 9, 1, '#ffd700'); _px(ctx, 12, 1, '#ffd700');
}

function _sprite_dragonid(ctx) {
  // Драконид-воин: чешуя + доспехи + меч
  const skin = '#cc2200', skinDark = '#881100';
  // Голова (ящер)
  _gradRect(ctx, 6, 1, 4, 4, '#ee4400', skin);
  _px(ctx, 10, 2, skin);
  // Глаза
  _px(ctx, 7, 2, '#ffcc00'); _px(ctx, 9, 2, '#ffcc00');
  // Чешуя-гребень
  _px(ctx, 6, 0, '#ff6600'); _px(ctx, 8, 0, '#ff6600');
  // Тело (доспехи)
  _gradRect(ctx, 5, 5, 6, 5, '#aa2200', '#660000');
  _rect(ctx, 6, 5, 4, 5, '#882200');
  // Руки
  _vline(ctx, 4, 5, 5, skin); _vline(ctx, 11, 5, 5, skin);
  // Меч
  _vline(ctx, 12, 3, 7, '#ccc'); _px(ctx, 12, 2, '#eee');
  // Ноги
  _vline(ctx, 6, 10, 4, skinDark); _vline(ctx, 9, 10, 4, skinDark);
  // Хвост
  _px(ctx, 4, 9, skin); _px(ctx, 3, 10, skinDark);
}


/* ============================================================
   ДЕМОНЫ
   ============================================================ */

function _sprite_hell_hound(ctx) {
  // Адская гончая: огненная шерсть, лавовые глаза
  const body = '#cc4422', dark = '#881100', fire = '#ff6600';
  // Тело (собака)
  _gradRect(ctx, 4, 7, 8, 4, body, dark);
  // Голова
  _gradRect(ctx, 10, 4, 4, 4, body, dark);
  _px(ctx, 14, 5, body);
  // Глаза (лавовые)
  _px(ctx, 11, 5, '#ffcc00');
  _glow(ctx, 11, 5, 1.5, '#ff8800', 0.5);
  // Уши
  _px(ctx, 11, 3, dark); _px(ctx, 13, 3, dark);
  // Огненные лапы
  _vline(ctx, 5, 11, 3, fire); _vline(ctx, 7, 11, 3, fire);
  _vline(ctx, 9, 11, 3, fire); _vline(ctx, 11, 11, 3, fire);
  _px(ctx, 5, 14, '#ffff00'); _px(ctx, 11, 14, '#ffff00');
  // Огненный хвост
  _px(ctx, 3, 7, fire); _px(ctx, 2, 6, '#ffaa00');
  _px(ctx, 1, 5, '#ffdd00');
}

function _sprite_demon_berserker(ctx) {
  // Демон-берсерк: красная кожа, рога, мускулы
  const skin = '#cc3333', skinDark = '#881111', skinLight = '#ee5555';
  // Голова с рогами
  _gradRect(ctx, 6, 2, 4, 4, skinLight, skin);
  // Рога (чёрные, изогнутые)
  _px(ctx, 5, 1, '#440000'); _px(ctx, 4, 0, '#220000');
  _px(ctx, 10, 1, '#440000'); _px(ctx, 11, 0, '#220000');
  // Глаза (жёлтые)
  _px(ctx, 7, 3, '#ffcc00'); _px(ctx, 9, 3, '#ffcc00');
  // Мускулистое тело
  _gradRect(ctx, 4, 6, 8, 5, skinLight, skin);
  _rect(ctx, 5, 5, 6, 1, skinDark);
  // Мышцы (детали)
  _px(ctx, 5, 7, skinDark); _px(ctx, 10, 7, skinDark);
  // Руки (толстые)
  _rect(ctx, 2, 6, 2, 5, skin); _rect(ctx, 12, 6, 2, 5, skin);
  // Ноги
  _rect(ctx, 5, 11, 2, 4, skinDark); _rect(ctx, 9, 11, 2, 4, skinDark);
  // Пояс
  _hline(ctx, 4, 10, 8, '#222');
  _px(ctx, 8, 10, '#ffd700'); // пряжка
}

function _sprite_rakshasa(ctx) {
  // Ракшаса: тигриная голова, богатая одежда
  const skin = '#e8a040', stripe = '#cc6600';
  // Тигриная голова
  _gradRect(ctx, 6, 1, 4, 4, '#ffcc66', skin);
  // Полосы
  _px(ctx, 6, 2, stripe); _px(ctx, 9, 2, stripe);
  _px(ctx, 7, 1, stripe); _px(ctx, 8, 1, stripe);
  // Уши
  _px(ctx, 6, 0, skin); _px(ctx, 9, 0, skin);
  // Глаза
  _px(ctx, 7, 2, '#ffee00'); _px(ctx, 9, 3, '#ffee00');
  // Тело (богатая одежда)
  _gradRect(ctx, 5, 5, 6, 6, '#aa0000', '#550000');
  _rect(ctx, 4, 6, 8, 4, '#660000');
  // Руки
  _vline(ctx, 3, 5, 5, skin); _vline(ctx, 12, 5, 5, skin);
  // Ноги
  _vline(ctx, 6, 11, 4, '#222'); _vline(ctx, 9, 11, 4, '#222');
  // Золотые украшения
  _px(ctx, 7, 6, '#ffd700'); _px(ctx, 8, 7, '#ffd700');
  _px(ctx, 5, 5, '#ffd700');
}


/* ============================================================
   ЖИВОТНЫЕ И ЗВЕРИ
   ============================================================ */

function _sprite_giant_rat(ctx) {
  const fur = '#8b6914', furDark = '#5a4010', furLight = '#aa8830';
  _gradRect(ctx, 4, 8, 7, 4, furLight, fur);
  _rect(ctx, 5, 7, 5, 1, fur);
  // Голова
  _gradRect(ctx, 9, 6, 3, 3, furLight, fur);
  _px(ctx, 12, 7, fur); _px(ctx, 13, 7, '#ff6666');
  // Уши
  _px(ctx, 9, 5, '#d4a855'); _px(ctx, 11, 5, '#d4a855');
  // Глаза
  _px(ctx, 10, 7, '#220000');
  // Хвост
  _px(ctx, 3, 9, '#c8a060'); _px(ctx, 2, 10, '#b09050'); _px(ctx, 1, 11, '#a08040');
  // Ноги
  _px(ctx, 5, 12, furDark); _px(ctx, 7, 12, furDark);
  _px(ctx, 9, 12, furDark); _px(ctx, 10, 12, furDark);
}

function _sprite_cave_bat(ctx) {
  const body = '#555', wing = '#444';
  _rect(ctx, 7, 7, 2, 3, body);
  _gradRect(ctx, 7, 5, 2, 2, '#666', body);
  _px(ctx, 6, 4, body); _px(ctx, 9, 4, body);
  // Крылья (треугольники)
  _gradRect(ctx, 3, 6, 4, 3, wing, '#333');
  _gradRect(ctx, 9, 6, 4, 3, wing, '#333');
  _px(ctx, 2, 7, wing); _px(ctx, 13, 7, wing);
  _px(ctx, 1, 8, '#333'); _px(ctx, 14, 8, '#333');
  _px(ctx, 3, 9, wing); _px(ctx, 12, 9, wing);
  // Глаза
  _px(ctx, 7, 6, '#ffcc00'); _px(ctx, 8, 6, '#ffcc00');
}

function _sprite_bat(ctx) {
  const body = '#7a1d2c', wing = '#5a1020';
  _rect(ctx, 7, 6, 2, 4, body);
  _gradRect(ctx, 6, 4, 4, 3, '#8a2a3a', body);
  // Клыки
  _px(ctx, 7, 7, '#fff'); _px(ctx, 8, 7, '#fff');
  // Уши
  _px(ctx, 6, 3, body); _px(ctx, 9, 3, body);
  // Крылья
  _gradRect(ctx, 2, 5, 5, 4, wing, '#3a0810');
  _gradRect(ctx, 9, 5, 5, 4, wing, '#3a0810');
  _px(ctx, 1, 6, wing); _px(ctx, 14, 6, wing);
  _px(ctx, 0, 7, '#3a0810'); _px(ctx, 15, 7, '#3a0810');
  // Глаза (красные)
  _px(ctx, 7, 5, '#ff0000'); _px(ctx, 8, 5, '#ff0000');
}

function _sprite_cave_bear(ctx) {
  const fur = '#6b4a2a', furLight = '#8b6a4a', furDark = '#4a2a0a';
  // Крупное тело
  _gradRect(ctx, 3, 5, 10, 7, furLight, fur);
  _rect(ctx, 4, 4, 8, 1, fur); _rect(ctx, 4, 12, 8, 2, furDark);
  // Голова
  _gradRect(ctx, 6, 1, 5, 4, furLight, fur);
  _px(ctx, 11, 2, fur);
  // Уши
  _px(ctx, 6, 0, '#8b6b4a'); _px(ctx, 10, 0, '#8b6b4a');
  // Глаза
  _px(ctx, 8, 2, '#111'); _px(ctx, 10, 2, '#111');
  // Нос
  _px(ctx, 11, 3, '#333');
  // Лапы
  _rect(ctx, 3, 13, 2, 2, furDark); _rect(ctx, 11, 13, 2, 2, furDark);
}


/* ============================================================
   МИФИЧЕСКИЕ СУЩЕСТВА
   ============================================================ */

function _sprite_basilisk(ctx) {
  const skin = '#1a4d1a', skinLight = '#2a6d2a';
  _gradRect(ctx, 4, 7, 8, 4, skinLight, skin);
  _rect(ctx, 5, 6, 6, 1, skin);
  _gradRect(ctx, 10, 5, 4, 3, skinLight, skin);
  _px(ctx, 14, 6, '#40a040');
  _px(ctx, 10, 4, '#40a040'); _px(ctx, 11, 3, '#50b050'); _px(ctx, 12, 4, '#40a040');
  _px(ctx, 12, 5, '#ffff00'); // глаз (опасный)
  _glow(ctx, 12, 5, 2, '#aaff00', 0.4);
  _px(ctx, 3, 8, skin); _px(ctx, 2, 9, skin); _px(ctx, 1, 10, skin);
  _px(ctx, 5, 11, skin); _px(ctx, 7, 11, skin); _px(ctx, 9, 11, skin);
  _px(ctx, 6, 7, '#2a6a2a'); _px(ctx, 8, 8, '#2a6a2a');
}

function _sprite_medusa(ctx) {
  const skin = '#228b22', light = '#44aa44';
  _gradRect(ctx, 6, 2, 4, 4, light, skin);
  // Змеи-волосы
  _px(ctx, 5, 1, light); _px(ctx, 4, 0, light);
  _px(ctx, 7, 0, light); _px(ctx, 9, 0, light);
  _px(ctx, 10, 1, light); _px(ctx, 11, 0, light);
  _px(ctx, 5, 3, light); _px(ctx, 4, 2, light);
  _px(ctx, 10, 2, light);
  // Глаза (красные)
  _px(ctx, 7, 3, '#ff0000'); _px(ctx, 9, 3, '#ff0000');
  _glow(ctx, 7, 3, 1.5, '#ff0000', 0.3);
  _glow(ctx, 9, 3, 1.5, '#ff0000', 0.3);
  // Тело
  _gradRect(ctx, 6, 6, 4, 4, light, skin);
  _rect(ctx, 5, 7, 6, 2, skin);
  // Змеиный хвост
  _gradRect(ctx, 6, 10, 4, 2, skin, '#1a6b1a');
  _rect(ctx, 5, 12, 6, 2, '#1a6b1a');
  _px(ctx, 4, 14, '#1a6b1a');
  // Руки
  _vline(ctx, 4, 6, 4, skin); _vline(ctx, 11, 6, 4, skin);
}

function _sprite_chimera(ctx) {
  const lion = '#b3b300', goat = '#808080', snake = '#228b22';
  // Тело льва
  _gradRect(ctx, 4, 7, 8, 5, '#cccc33', lion);
  // Голова льва
  _gradRect(ctx, 7, 3, 3, 3, '#dddd44', lion);
  _px(ctx, 6, 4, '#cc9900'); _px(ctx, 10, 4, '#cc9900');
  _px(ctx, 7, 2, '#cc9900'); _px(ctx, 9, 2, '#cc9900');
  _px(ctx, 8, 4, '#ff0');
  // Голова козла (слева)
  _rect(ctx, 2, 4, 2, 2, goat);
  _px(ctx, 2, 3, '#aaa'); _px(ctx, 3, 2, '#aaa');
  _px(ctx, 2, 5, '#000');
  // Голова змеи (хвост)
  _rect(ctx, 12, 5, 2, 2, snake);
  _px(ctx, 14, 6, '#ff0000'); _px(ctx, 13, 5, '#ff0');
  // Ноги
  _vline(ctx, 5, 12, 3, lion); _vline(ctx, 7, 12, 3, lion);
  _vline(ctx, 9, 12, 3, lion); _vline(ctx, 11, 12, 3, lion);
}

function _sprite_hydra_small(ctx) {
  const skin = '#228b22', neck = '#1a6b1a';
  _gradRect(ctx, 5, 8, 6, 5, '#33aa33', skin);
  _rect(ctx, 4, 9, 8, 3, skin);
  // Три головы
  _vline(ctx, 8, 4, 4, neck);
  _gradRect(ctx, 7, 2, 3, 2, '#33aa33', skin);
  _px(ctx, 8, 2, '#ff0');
  _px(ctx, 6, 6, neck); _px(ctx, 5, 5, neck); _px(ctx, 4, 4, neck);
  _rect(ctx, 3, 3, 2, 2, skin); _px(ctx, 3, 3, '#ff0');
  _px(ctx, 10, 6, neck); _px(ctx, 11, 5, neck); _px(ctx, 12, 4, neck);
  _rect(ctx, 11, 3, 2, 2, skin); _px(ctx, 12, 3, '#ff0');
  _vline(ctx, 6, 13, 2, skin); _vline(ctx, 10, 13, 2, skin);
}

function _sprite_minotaur(ctx) {
  const skin = '#7a4a2a', skinLight = '#9a6a4a';
  _gradRect(ctx, 5, 1, 6, 4, skinLight, skin);
  _px(ctx, 4, 0, '#d4a06a'); _px(ctx, 3, 0, '#d4a06a');
  _px(ctx, 11, 0, '#d4a06a'); _px(ctx, 12, 0, '#d4a06a');
  _px(ctx, 7, 2, '#ff0000'); _px(ctx, 9, 2, '#ff0000');
  _px(ctx, 7, 4, '#333'); _px(ctx, 9, 4, '#333');
  _gradRect(ctx, 4, 5, 8, 5, skinLight, skin);
  _rect(ctx, 5, 5, 6, 5, '#6b3a1a');
  _rect(ctx, 2, 5, 2, 5, skin); _rect(ctx, 12, 5, 2, 5, skin);
  _vline(ctx, 14, 2, 7, '#6b3510');
  _rect(ctx, 14, 2, 2, 3, '#aaa');
  _rect(ctx, 5, 10, 2, 4, skin); _rect(ctx, 9, 10, 2, 4, skin);
  _hline(ctx, 5, 14, 2, '#333'); _hline(ctx, 9, 14, 2, '#333');
}

function _sprite_ogre(ctx) {
  const skin = '#c8a850', skinDark = '#a08830';
  _gradRect(ctx, 5, 1, 6, 5, '#ddc070', skin);
  _px(ctx, 7, 3, '#000'); _px(ctx, 9, 3, '#000');
  _hline(ctx, 6, 5, 4, '#8b4513');
  _gradRect(ctx, 3, 6, 10, 5, skin, skinDark);
  _rect(ctx, 4, 5, 8, 1, skinDark);
  _rect(ctx, 1, 6, 2, 5, skin); _rect(ctx, 13, 6, 2, 5, skin);
  _vline(ctx, 0, 3, 6, '#6b3510');
  _rect(ctx, 0, 2, 1, 2, '#4a2a0a');
  _rect(ctx, 4, 11, 3, 4, skinDark); _rect(ctx, 9, 11, 3, 4, skinDark);
  _hline(ctx, 3, 10, 10, '#4a3a2a');
}


/* ============================================================
   ГОЛЕМЫ И КОНСТРУКТЫ
   ============================================================ */

function _sprite_rotgolem(ctx) {
  const body = '#6b4a2b', moss = '#5a8a3a', light = '#8a6a4b';
  _gradRect(ctx, 3, 3, 10, 11, light, body);
  _rect(ctx, 4, 2, 8, 1, body);
  _px(ctx, 4, 4, moss); _px(ctx, 10, 5, moss);
  _px(ctx, 5, 9, moss); _px(ctx, 11, 8, moss); _px(ctx, 3, 12, moss);
  _rect(ctx, 1, 5, 2, 5, body); _rect(ctx, 13, 5, 2, 5, body);
  _px(ctx, 6, 5, '#ff8800'); _px(ctx, 9, 5, '#ff8800');
  _glow(ctx, 6, 5, 1.5, '#ff6600', 0.4);
  _glow(ctx, 9, 5, 1.5, '#ff6600', 0.4);
  _vline(ctx, 7, 7, 3, '#3a2a0b'); _hline(ctx, 8, 9, 3, '#3a2a0b');
}

function _sprite_stone_golem(ctx) {
  const stone = '#9a9a9a', dark = '#666', light = '#bbb';
  _gradRect(ctx, 3, 3, 10, 11, light, stone);
  _rect(ctx, 4, 2, 8, 1, stone);
  _rect(ctx, 1, 4, 2, 6, stone); _rect(ctx, 13, 4, 2, 6, stone);
  _px(ctx, 6, 5, '#00ccff'); _px(ctx, 9, 5, '#00ccff');
  _glow(ctx, 6, 5, 1.5, '#0099ff', 0.5);
  _glow(ctx, 9, 5, 1.5, '#0099ff', 0.5);
  _hline(ctx, 5, 8, 4, dark); _vline(ctx, 10, 6, 4, dark);
  _px(ctx, 4, 11, dark);
  _rect(ctx, 7, 7, 2, 2, '#aaa');
}

function _sprite_bone_colossus(ctx) {
  const bone = '#d9d0c0', dark = '#a09080', light = '#f0e8d8';
  _gradRect(ctx, 3, 2, 10, 12, light, bone);
  _hline(ctx, 4, 5, 8, dark); _hline(ctx, 4, 7, 8, dark);
  _hline(ctx, 4, 9, 8, dark); _hline(ctx, 4, 11, 8, dark);
  _gradRect(ctx, 5, 0, 6, 3, light, bone);
  _px(ctx, 6, 1, '#ff0000'); _px(ctx, 9, 1, '#ff0000');
  _glow(ctx, 6, 1, 1.5, '#ff0000', 0.4);
  _glow(ctx, 9, 1, 1.5, '#ff0000', 0.4);
  _rect(ctx, 1, 4, 2, 6, bone); _rect(ctx, 13, 4, 2, 6, bone);
  _rect(ctx, 4, 14, 2, 2, bone); _rect(ctx, 10, 14, 2, 2, bone);
}


/* ============================================================
   УНИКАЛЬНЫЕ ТВАРИ
   ============================================================ */

function _sprite_mimic(ctx) {
  const wood = '#8b6914', gold = '#ffd700', woodDark = '#5a4010';
  // Сундук
  _gradRect(ctx, 3, 5, 10, 8, wood, woodDark);
  _rect(ctx, 4, 4, 8, 1, '#a07020');
  _hline(ctx, 4, 8, 8, gold); // полоса
  _rect(ctx, 7, 8, 2, 2, gold); // замок
  // Зубы (пасть раскрыта)
  _hline(ctx, 4, 5, 8, '#cc0000');
  _px(ctx, 4, 4, '#fff'); _px(ctx, 6, 4, '#fff');
  _px(ctx, 8, 4, '#fff'); _px(ctx, 10, 4, '#fff');
  _px(ctx, 5, 6, '#fff'); _px(ctx, 7, 6, '#fff');
  _px(ctx, 9, 6, '#fff'); _px(ctx, 11, 6, '#fff');
  // Глаза (внутри)
  _px(ctx, 6, 7, '#ff0000'); _px(ctx, 10, 7, '#ff0000');
  _glow(ctx, 6, 7, 1.5, '#ff0000', 0.3);
}

function _sprite_beholder_spore(ctx) {
  const body = '#8b008b', light = '#aa22aa';
  _gradRect(ctx, 4, 4, 8, 8, light, body);
  _rect(ctx, 5, 3, 6, 1, body); _rect(ctx, 5, 12, 6, 1, body);
  _rect(ctx, 3, 6, 1, 4, body); _rect(ctx, 12, 6, 1, 4, body);
  _rect(ctx, 7, 7, 2, 2, '#fff');
  _px(ctx, 7, 7, '#ff0000');
  // Стебельки
  _px(ctx, 5, 3, '#dda0dd'); _px(ctx, 5, 2, '#fff');
  _px(ctx, 10, 3, '#dda0dd'); _px(ctx, 10, 2, '#fff');
  _px(ctx, 3, 5, '#dda0dd'); _px(ctx, 2, 5, '#fff');
  _px(ctx, 12, 5, '#dda0dd'); _px(ctx, 13, 5, '#fff');
}

function _sprite_observer(ctx) {
  const body = '#660099', light = '#8822bb';
  _gradRect(ctx, 3, 3, 10, 10, light, body);
  _rect(ctx, 4, 2, 8, 1, body); _rect(ctx, 4, 13, 8, 1, body);
  _rect(ctx, 2, 5, 1, 6, body); _rect(ctx, 13, 5, 1, 6, body);
  _rect(ctx, 6, 6, 4, 4, '#fff');
  _rect(ctx, 7, 7, 2, 2, '#ff0000');
  // Стебельки-глаза
  _px(ctx, 5, 1, '#cc66ff'); _px(ctx, 5, 0, '#fff');
  _px(ctx, 7, 1, '#cc66ff'); _px(ctx, 7, 0, '#fff');
  _px(ctx, 9, 1, '#cc66ff'); _px(ctx, 9, 0, '#fff');
  _px(ctx, 11, 1, '#cc66ff'); _px(ctx, 11, 0, '#fff');
  _hline(ctx, 6, 11, 4, '#330066');
  _glow(ctx, 8, 8, 4, '#9933ff', 0.3);
}

function _sprite_illithid(ctx) {
  const skin = '#6600cc', tent = '#9933ff', light = '#8844dd';
  _gradRect(ctx, 5, 1, 6, 5, light, skin);
  _rect(ctx, 6, 0, 4, 1, skin);
  _vline(ctx, 6, 6, 3, tent); _vline(ctx, 7, 6, 4, tent);
  _vline(ctx, 8, 6, 4, tent); _vline(ctx, 9, 6, 3, tent);
  _px(ctx, 7, 3, '#fff'); _px(ctx, 9, 3, '#fff');
  _gradRect(ctx, 5, 9, 6, 4, '#440088', '#220044');
  _vline(ctx, 4, 9, 4, skin); _vline(ctx, 11, 9, 4, skin);
  _vline(ctx, 6, 13, 2, '#220044'); _vline(ctx, 9, 13, 2, '#220044');
}

function _sprite_eldritch_horror(ctx) {
  const body = '#2d0040', tent = '#6600aa', light = '#4a0066';
  _gradRect(ctx, 3, 3, 10, 10, light, body);
  _rect(ctx, 4, 2, 8, 1, body); _rect(ctx, 2, 5, 1, 6, body); _rect(ctx, 13, 5, 1, 6, body);
  // Щупальца
  _px(ctx, 1, 7, tent); _px(ctx, 0, 8, tent);
  _px(ctx, 14, 7, tent); _px(ctx, 15, 8, tent);
  _px(ctx, 4, 14, tent); _px(ctx, 3, 15, tent);
  _px(ctx, 11, 14, tent); _px(ctx, 12, 15, tent);
  _px(ctx, 2, 4, tent); _px(ctx, 13, 4, tent);
  // Множество глаз
  _px(ctx, 5, 5, '#ff00ff'); _px(ctx, 8, 4, '#ff00ff');
  _px(ctx, 10, 6, '#ff00ff'); _px(ctx, 6, 8, '#ff00ff');
  _px(ctx, 9, 9, '#ff00ff'); _px(ctx, 7, 11, '#ff00ff');
  _glow(ctx, 8, 7, 5, '#9933ff', 0.25);
}


function _sprite_shadow(ctx) {
  const body = '#0a0a0a', gray = '#3a3a3a';
  ctx.globalAlpha = 0.85;
  _gradRect(ctx, 6, 2, 4, 4, gray, body);
  _gradRect(ctx, 5, 5, 6, 5, gray, body);
  _rect(ctx, 4, 7, 8, 3, body);
  ctx.globalAlpha = 0.5;
  _px(ctx, 4, 5, gray); _px(ctx, 11, 5, gray);
  _px(ctx, 3, 8, gray); _px(ctx, 12, 8, gray);
  _px(ctx, 5, 10, gray); _px(ctx, 10, 10, gray);
  _px(ctx, 5, 11, body); _px(ctx, 7, 12, body); _px(ctx, 9, 12, body);
  ctx.globalAlpha = 1;
  _px(ctx, 7, 4, '#ffffff'); _px(ctx, 9, 4, '#ffffff');
  _glow(ctx, 7, 4, 1.5, '#ffffff', 0.4);
  _glow(ctx, 9, 4, 1.5, '#ffffff', 0.4);
}

function _sprite_rust_monster(ctx) {
  const body = '#b36b00', rust = '#ff6600', light = '#cc8800';
  _gradRect(ctx, 4, 7, 8, 5, light, body);
  _rect(ctx, 5, 6, 6, 1, body);
  _gradRect(ctx, 9, 4, 4, 3, light, body);
  _px(ctx, 10, 3, rust); _px(ctx, 10, 2, rust);
  _px(ctx, 12, 3, rust); _px(ctx, 12, 2, rust);
  _px(ctx, 5, 8, rust); _px(ctx, 8, 9, rust);
  _px(ctx, 10, 7, rust); _px(ctx, 6, 10, rust);
  _px(ctx, 10, 5, '#fff'); _px(ctx, 12, 5, '#fff');
  _px(ctx, 3, 8, body); _px(ctx, 2, 9, body);
  _px(ctx, 5, 12, body); _px(ctx, 7, 12, body); _px(ctx, 9, 12, body); _px(ctx, 11, 12, body);
}

function _sprite_salamander(ctx) {
  const body = '#ff6600', fire = '#ffaa00', dark = '#cc4400';
  _gradRect(ctx, 4, 7, 7, 3, body, dark);
  _rect(ctx, 5, 6, 5, 1, body);
  _gradRect(ctx, 9, 5, 3, 2, body, dark);
  _px(ctx, 10, 5, '#ffcc00');
  _px(ctx, 3, 8, body); _px(ctx, 2, 9, fire); _px(ctx, 1, 10, '#ffff00'); _px(ctx, 0, 10, '#fff');
  _px(ctx, 5, 10, body); _px(ctx, 7, 10, body); _px(ctx, 9, 10, body);
  _px(ctx, 6, 7, fire); _px(ctx, 8, 8, fire);
}

function _sprite_gargoyle(ctx) {
  const stone = '#808080', wing = '#666', light = '#999';
  _gradRect(ctx, 5, 4, 6, 7, light, stone);
  _gradRect(ctx, 6, 1, 4, 3, light, stone);
  _px(ctx, 5, 0, '#555'); _px(ctx, 10, 0, '#555');
  _px(ctx, 7, 2, '#ff0000'); _px(ctx, 9, 2, '#ff0000');
  _gradRect(ctx, 2, 4, 3, 4, wing, '#444');
  _gradRect(ctx, 11, 4, 3, 4, wing, '#444');
  _px(ctx, 1, 5, wing); _px(ctx, 14, 5, wing);
  _vline(ctx, 6, 11, 3, stone); _vline(ctx, 9, 11, 3, stone);
  _px(ctx, 5, 14, '#444'); _px(ctx, 10, 14, '#444');
}

function _sprite_vampire_spawn(ctx) {
  const skin = '#e8c8c8', cloak = '#660000', cloakDark = '#330000';
  _gradRect(ctx, 6, 1, 4, 4, '#ffd8d8', skin);
  _px(ctx, 5, 1, '#222'); _px(ctx, 10, 1, '#222');
  _px(ctx, 6, 0, '#333'); _px(ctx, 9, 0, '#333');
  _px(ctx, 7, 2, '#ff0000'); _px(ctx, 9, 2, '#ff0000');
  _px(ctx, 7, 4, '#fff'); _px(ctx, 9, 4, '#fff');
  _gradRect(ctx, 5, 5, 6, 7, cloak, cloakDark);
  _rect(ctx, 4, 6, 8, 5, cloakDark);
  _vline(ctx, 3, 6, 4, cloak); _vline(ctx, 12, 6, 4, cloak);
  _vline(ctx, 6, 12, 3, '#222'); _vline(ctx, 9, 12, 3, '#222');
}

function _sprite_night_walker(ctx) {
  const body = '#080808';
  ctx.globalAlpha = 0.9;
  _gradRect(ctx, 6, 2, 4, 12, '#1a1a1a', body);
  _rect(ctx, 5, 4, 6, 8, body);
  _vline(ctx, 4, 5, 6, body); _px(ctx, 3, 10, body);
  _vline(ctx, 11, 5, 6, body); _px(ctx, 12, 10, body);
  ctx.globalAlpha = 1;
  _px(ctx, 7, 4, '#ffffff'); _px(ctx, 9, 4, '#ffffff');
  _glow(ctx, 7, 4, 2, '#ffffff', 0.5);
  _glow(ctx, 9, 4, 2, '#ffffff', 0.5);
}

function _sprite_troll(ctx) {
  const skin = '#4a8a3a', light = '#5aaa4a', dark = '#2a5a1a';
  _gradRect(ctx, 4, 4, 8, 8, light, skin);
  _rect(ctx, 3, 5, 10, 6, skin);
  _gradRect(ctx, 6, 1, 4, 3, light, skin);
  _px(ctx, 7, 2, '#ffcc00'); _px(ctx, 9, 2, '#ffcc00');
  _px(ctx, 8, 3, dark);
  _rect(ctx, 1, 5, 2, 6, skin); _rect(ctx, 13, 5, 2, 6, skin);
  _px(ctx, 1, 11, skin); _px(ctx, 14, 11, skin);
  _rect(ctx, 5, 12, 2, 3, dark); _rect(ctx, 9, 12, 2, 3, dark);
  _px(ctx, 1, 12, '#333'); _px(ctx, 14, 12, '#333');
}

function _sprite_lamia(ctx) {
  const skin = '#8fbc8f', snake = '#228b22', dark = '#1a6b1a';
  _gradRect(ctx, 6, 1, 4, 3, '#aadcaf', skin);
  _px(ctx, 5, 1, '#333'); _px(ctx, 10, 1, '#333');
  _px(ctx, 7, 2, '#ffcc00'); _px(ctx, 9, 2, '#ffcc00');
  _gradRect(ctx, 6, 4, 4, 3, skin, dark);
  _vline(ctx, 5, 4, 3, skin); _vline(ctx, 10, 4, 3, skin);
  _gradRect(ctx, 5, 7, 6, 3, snake, dark);
  _rect(ctx, 4, 9, 8, 2, dark);
  _rect(ctx, 3, 11, 2, 2, dark); _px(ctx, 2, 12, dark);
  _rect(ctx, 10, 11, 3, 2, dark); _px(ctx, 13, 12, dark);
}


/* ============================================================
   БОССЫ (24x24) — крупные, детализированные
   ============================================================ */

function _sprite_boss_skeleton_knight(ctx) {
  const armor = '#c0c0c0', armorDark = '#888', gold = '#ffd700';
  _gradRect(ctx, 9, 1, 6, 6, '#ddd', armor);
  _rect(ctx, 10, 0, 4, 1, armor);
  _rect(ctx, 10, 3, 4, 2, '#222');
  _px(ctx, 11, 4, '#ff0000'); _px(ctx, 13, 4, '#ff0000');
  _hline(ctx, 9, 0, 6, gold);
  _px(ctx, 10, 0, gold); _px(ctx, 12, 0, gold); _px(ctx, 14, 0, gold);
  _gradRect(ctx, 7, 7, 10, 9, '#ddd', armor);
  _rect(ctx, 8, 6, 8, 1, armorDark);
  _rect(ctx, 5, 7, 3, 3, armor); _rect(ctx, 16, 7, 3, 3, armor);
  _rect(ctx, 8, 16, 3, 6, armorDark); _rect(ctx, 13, 16, 3, 6, armorDark);
  _vline(ctx, 20, 2, 14, '#aaa');
  _rect(ctx, 19, 2, 3, 2, '#ccc'); _px(ctx, 20, 1, '#fff');
  _rect(ctx, 6, 10, 1, 8, '#8b0000'); _rect(ctx, 5, 12, 1, 7, '#6b0000');
}

function _sprite_boss_lich(ctx) {
  const cloak = '#1a0033', gold = '#ffd700', skull = '#e8dcc8';
  _gradRect(ctx, 6, 5, 12, 15, '#2a0055', cloak);
  _rect(ctx, 5, 7, 14, 12, cloak); _rect(ctx, 4, 10, 16, 10, cloak);
  _gradRect(ctx, 7, 1, 10, 5, '#2a0055', cloak);
  _rect(ctx, 8, 0, 8, 1, cloak);
  _gradRect(ctx, 9, 2, 6, 4, '#fff8e8', skull);
  _px(ctx, 10, 3, '#ff0000'); _px(ctx, 13, 3, '#ff0000');
  _hline(ctx, 8, 1, 8, gold);
  _px(ctx, 8, 0, gold); _px(ctx, 11, 0, gold); _px(ctx, 14, 0, gold);
  _vline(ctx, 20, 2, 18, '#6a0dad');
  _rect(ctx, 19, 1, 3, 3, skull); _px(ctx, 20, 1, '#ff0000');
  _glow(ctx, 20, 2, 3, '#9933ff', 0.5);
  _px(ctx, 4, 6, '#8b00ff'); _px(ctx, 19, 6, '#8b00ff');
  _px(ctx, 3, 12, '#8b00ff'); _px(ctx, 20, 12, '#8b00ff');
}

function _sprite_boss_spider_queen(ctx) {
  const body = '#cc4444', leg = '#8b2222', light = '#ee6666';
  _gradRect(ctx, 7, 8, 10, 8, light, body);
  _rect(ctx, 8, 7, 8, 10, body); _rect(ctx, 6, 10, 12, 4, body);
  _gradRect(ctx, 9, 4, 6, 4, light, body);
  _px(ctx, 10, 5, '#ffcc00'); _px(ctx, 13, 5, '#ffcc00');
  _px(ctx, 10, 6, '#ffcc00'); _px(ctx, 13, 6, '#ffcc00');
  _px(ctx, 11, 4, '#fff'); _px(ctx, 12, 4, '#fff');
  _px(ctx, 10, 8, '#fff'); _px(ctx, 13, 8, '#fff');
  _hline(ctx, 9, 3, 6, '#ffd700');
  _px(ctx, 10, 2, '#ffd700'); _px(ctx, 13, 2, '#ffd700');
  // Ноги
  _px(ctx, 5, 8, leg); _px(ctx, 4, 7, leg); _px(ctx, 3, 6, leg);
  _px(ctx, 5, 10, leg); _px(ctx, 4, 10, leg); _px(ctx, 3, 11, leg);
  _px(ctx, 5, 13, leg); _px(ctx, 4, 14, leg); _px(ctx, 3, 15, leg);
  _px(ctx, 5, 15, leg); _px(ctx, 4, 16, leg);
  _px(ctx, 18, 8, leg); _px(ctx, 19, 7, leg); _px(ctx, 20, 6, leg);
  _px(ctx, 18, 10, leg); _px(ctx, 19, 10, leg); _px(ctx, 20, 11, leg);
  _px(ctx, 18, 13, leg); _px(ctx, 19, 14, leg); _px(ctx, 20, 15, leg);
  _px(ctx, 18, 15, leg); _px(ctx, 19, 16, leg);
  _px(ctx, 9, 11, '#ff0000'); _px(ctx, 14, 13, '#ff0000');
}


function _sprite_boss_fire_lord(ctx) {
  const c1 = '#ff4500', c2 = '#ff8800', c3 = '#ffdd00', gold = '#ffd700';
  _gradRect(ctx, 7, 10, 10, 10, c1, '#aa2200');
  _gradRect(ctx, 8, 7, 8, 3, c2, c1);
  _rect(ctx, 9, 5, 6, 2, c2); _rect(ctx, 10, 3, 4, 2, c2);
  _rect(ctx, 11, 1, 2, 2, c3);
  _px(ctx, 8, 6, c3); _px(ctx, 15, 6, c3);
  _px(ctx, 9, 4, c3); _px(ctx, 14, 4, c3);
  _px(ctx, 10, 2, c3); _px(ctx, 13, 2, c3);
  _hline(ctx, 9, 4, 6, gold);
  _px(ctx, 9, 3, gold); _px(ctx, 14, 3, gold); _px(ctx, 11, 2, gold);
  _px(ctx, 10, 8, '#fff'); _px(ctx, 13, 8, '#fff');
  _rect(ctx, 4, 10, 3, 5, c2); _rect(ctx, 17, 10, 3, 5, c2);
  _px(ctx, 3, 12, c3); _px(ctx, 20, 12, c3);
  _px(ctx, 5, 6, c3); _px(ctx, 18, 5, c3);
  _glow(ctx, 12, 8, 7, '#ff6600', 0.3);
}

function _sprite_boss_ice_lord(ctx) {
  const c1 = '#4da6ff', c2 = '#88ccff', c3 = '#ffffff', gold = '#ffd700';
  _gradRect(ctx, 7, 8, 10, 12, c2, c1);
  _gradRect(ctx, 8, 5, 8, 3, c2, c1);
  _rect(ctx, 9, 3, 6, 2, c2); _rect(ctx, 10, 1, 4, 2, c2);
  _px(ctx, 5, 10, c2); _px(ctx, 4, 11, c3);
  _px(ctx, 18, 10, c2); _px(ctx, 19, 11, c3);
  _px(ctx, 6, 7, c3); _px(ctx, 17, 7, c3);
  _hline(ctx, 9, 2, 6, gold);
  _px(ctx, 9, 1, gold); _px(ctx, 14, 1, gold); _px(ctx, 11, 0, gold);
  _px(ctx, 10, 7, '#0044ff'); _px(ctx, 13, 7, '#0044ff');
  _glow(ctx, 10, 7, 2, '#0066ff', 0.4);
  _glow(ctx, 13, 7, 2, '#0066ff', 0.4);
  _rect(ctx, 4, 9, 3, 6, c1); _rect(ctx, 17, 9, 3, 6, c1);
}

function _sprite_boss_ancient_ent(ctx) {
  const bark = '#3a5a2a', leaf = '#6a8a4a', barkDark = '#2a3a1a';
  _gradRect(ctx, 8, 6, 8, 14, bark, barkDark);
  _rect(ctx, 7, 8, 10, 10, bark);
  _gradRect(ctx, 9, 8, 6, 4, '#5a7a4a', '#4a6a3a');
  _px(ctx, 10, 9, '#ff8800'); _px(ctx, 13, 9, '#ff8800');
  _glow(ctx, 10, 9, 2, '#ff6600', 0.3);
  _glow(ctx, 13, 9, 2, '#ff6600', 0.3);
  _hline(ctx, 10, 11, 4, '#4a3a2a');
  _gradRect(ctx, 5, 1, 14, 6, '#8aaa5a', leaf);
  _rect(ctx, 6, 0, 12, 1, leaf);
  _rect(ctx, 4, 2, 16, 4, leaf);
  _rect(ctx, 3, 8, 4, 2, bark); _rect(ctx, 1, 7, 2, 2, leaf);
  _rect(ctx, 17, 8, 4, 2, bark); _rect(ctx, 21, 7, 2, 2, leaf);
  _rect(ctx, 7, 20, 3, 3, barkDark); _rect(ctx, 14, 20, 3, 3, barkDark);
}


function _sprite_boss_dark_knight(ctx) {
  const armor = '#1a1a2a', light = '#2a2a3a', eye = '#cc0000', gold = '#ffd700';
  _gradRect(ctx, 9, 1, 6, 6, light, armor);
  _rect(ctx, 10, 0, 4, 1, armor);
  _px(ctx, 11, 3, eye); _px(ctx, 13, 3, eye);
  _gradRect(ctx, 7, 7, 10, 9, light, armor);
  _rect(ctx, 8, 6, 8, 1, '#111');
  _rect(ctx, 4, 7, 3, 3, armor); _rect(ctx, 17, 7, 3, 3, armor);
  _px(ctx, 4, 6, '#cc0000'); _px(ctx, 19, 6, '#cc0000');
  _rect(ctx, 8, 16, 3, 6, armor); _rect(ctx, 13, 16, 3, 6, armor);
  _px(ctx, 3, 10, '#660000'); _px(ctx, 20, 10, '#660000');
  _vline(ctx, 21, 2, 14, '#444'); _rect(ctx, 20, 2, 3, 2, '#555');
  _glow(ctx, 21, 5, 3, '#cc0000', 0.3);
}

function _sprite_boss_ghoul_king(ctx) {
  const skin = '#4a0e0e', skinLight = '#6a2020', gold = '#ffd700';
  _gradRect(ctx, 9, 1, 6, 5, '#8a3030', skin);
  _hline(ctx, 8, 0, 8, gold);
  _px(ctx, 9, 0, gold); _px(ctx, 12, 0, gold); _px(ctx, 15, 0, gold);
  _px(ctx, 10, 3, '#ff0000'); _px(ctx, 13, 3, '#ff0000');
  _hline(ctx, 10, 5, 4, '#333');
  _px(ctx, 10, 5, '#fff'); _px(ctx, 13, 5, '#fff');
  _gradRect(ctx, 7, 6, 10, 10, skinLight, skin);
  _rect(ctx, 8, 5, 8, 1, skin);
  _rect(ctx, 4, 7, 3, 6, skin); _rect(ctx, 17, 7, 3, 6, skin);
  _px(ctx, 3, 12, '#fff'); _px(ctx, 4, 13, '#fff');
  _px(ctx, 20, 12, '#fff'); _px(ctx, 19, 13, '#fff');
  _rect(ctx, 8, 16, 3, 5, skin); _rect(ctx, 13, 16, 3, 5, skin);
}

function _sprite_boss_ice_serpent(ctx) {
  const body = '#88ccff', light = '#bbddff', dark = '#5599cc';
  // Волна тела
  _gradRect(ctx, 2, 10, 4, 4, light, body);
  _gradRect(ctx, 5, 8, 4, 4, body, dark);
  _gradRect(ctx, 8, 10, 4, 4, light, body);
  _gradRect(ctx, 11, 8, 4, 4, body, dark);
  _gradRect(ctx, 14, 10, 4, 4, light, body);
  _gradRect(ctx, 17, 8, 4, 4, body, dark);
  // Голова
  _gradRect(ctx, 20, 7, 4, 5, light, body);
  _px(ctx, 21, 8, '#fff'); _px(ctx, 23, 9, light);
  // Блики
  _px(ctx, 3, 10, '#fff'); _px(ctx, 9, 10, '#fff'); _px(ctx, 15, 10, '#fff');
  // Шипы
  _px(ctx, 4, 9, '#fff'); _px(ctx, 7, 7, '#fff'); _px(ctx, 10, 9, '#fff');
  _px(ctx, 13, 7, '#fff'); _px(ctx, 16, 9, '#fff');
}

function _sprite_boss_magma_giant(ctx) {
  const rock = '#4a2a1a', lava = '#ff4400', glow = '#ff8800', rockLight = '#6a4a3a';
  _gradRect(ctx, 6, 4, 12, 14, rockLight, rock);
  _rect(ctx, 7, 3, 10, 1, rock); _rect(ctx, 7, 18, 10, 3, rock);
  _gradRect(ctx, 8, 0, 8, 4, rockLight, rock);
  _px(ctx, 10, 2, lava); _px(ctx, 13, 2, lava);
  _glow(ctx, 10, 2, 2, lava, 0.4); _glow(ctx, 13, 2, 2, lava, 0.4);
  _vline(ctx, 9, 6, 4, lava); _hline(ctx, 10, 10, 5, lava);
  _vline(ctx, 14, 11, 4, lava); _hline(ctx, 7, 15, 4, lava);
  _px(ctx, 9, 5, glow); _px(ctx, 14, 9, glow); _px(ctx, 7, 14, glow);
  _rect(ctx, 3, 6, 3, 7, rock); _rect(ctx, 18, 6, 3, 7, rock);
  _px(ctx, 2, 8, lava); _px(ctx, 21, 8, lava);
  _rect(ctx, 7, 20, 4, 3, rock); _rect(ctx, 13, 20, 4, 3, rock);
}


function _sprite_boss_spider_matriarch(ctx) {
  const body = '#1a1a2a', accent = '#cc66ff', light = '#2a2a4a';
  _gradRect(ctx, 7, 9, 10, 7, light, body);
  _rect(ctx, 8, 8, 8, 9, body);
  _gradRect(ctx, 9, 5, 6, 4, light, body);
  _px(ctx, 10, 6, accent); _px(ctx, 13, 6, accent);
  _px(ctx, 10, 7, accent); _px(ctx, 13, 7, accent);
  _px(ctx, 11, 5, '#fff'); _px(ctx, 12, 5, '#fff');
  // Ноги
  _px(ctx, 5, 8, body); _px(ctx, 4, 7, body); _px(ctx, 3, 6, body);
  _px(ctx, 5, 11, body); _px(ctx, 4, 12, body); _px(ctx, 3, 13, body);
  _px(ctx, 5, 14, body); _px(ctx, 4, 15, body);
  _px(ctx, 6, 16, body); _px(ctx, 5, 17, body);
  _px(ctx, 18, 8, body); _px(ctx, 19, 7, body); _px(ctx, 20, 6, body);
  _px(ctx, 18, 11, body); _px(ctx, 19, 12, body); _px(ctx, 20, 13, body);
  _px(ctx, 18, 14, body); _px(ctx, 19, 15, body);
  _px(ctx, 17, 16, body); _px(ctx, 18, 17, body);
  _px(ctx, 2, 5, accent); _px(ctx, 21, 5, accent);
  _glow(ctx, 12, 10, 5, '#9933ff', 0.25);
}

function _sprite_boss_knight_commander(ctx) {
  const armor = '#b0b0b0', gold = '#ffd700', light = '#d0d0d0';
  _gradRect(ctx, 8, 1, 8, 6, light, armor);
  _rect(ctx, 9, 0, 6, 1, gold);
  _px(ctx, 10, 0, gold); _px(ctx, 13, 0, gold);
  _px(ctx, 10, 3, '#4488ff'); _px(ctx, 13, 3, '#4488ff');
  _gradRect(ctx, 6, 7, 12, 9, light, armor);
  _hline(ctx, 7, 7, 10, gold); _hline(ctx, 7, 10, 10, gold);
  _rect(ctx, 4, 7, 2, 3, gold); _rect(ctx, 18, 7, 2, 3, gold);
  _rect(ctx, 8, 16, 3, 6, armor); _rect(ctx, 13, 16, 3, 6, armor);
  _vline(ctx, 21, 1, 16, '#ccc'); _rect(ctx, 20, 1, 3, 2, gold); _px(ctx, 21, 0, '#fff');
}

function _sprite_boss_shadow_dragon(ctx) {
  const body = '#1a0033', aura = '#9933ff', wing = '#0d001a';
  _gradRect(ctx, 7, 9, 10, 8, '#2a0055', body);
  _rect(ctx, 8, 8, 8, 1, body);
  _gradRect(ctx, 14, 4, 6, 5, '#2a0055', body);
  _px(ctx, 20, 5, body); _px(ctx, 21, 6, body);
  _px(ctx, 16, 5, aura); _px(ctx, 18, 5, aura);
  _glow(ctx, 16, 5, 2, aura, 0.5); _glow(ctx, 18, 5, 2, aura, 0.5);
  _gradRect(ctx, 1, 5, 6, 8, wing, '#000');
  _px(ctx, 0, 6, wing); _px(ctx, 0, 7, wing);
  _rect(ctx, 2, 4, 4, 1, wing); _rect(ctx, 3, 3, 3, 1, wing);
  _px(ctx, 7, 17, body); _px(ctx, 6, 18, body); _px(ctx, 5, 19, body); _px(ctx, 4, 20, body);
  _px(ctx, 5, 7, aura); _px(ctx, 19, 8, aura);
  _px(ctx, 3, 12, aura); _px(ctx, 20, 13, aura);
  _px(ctx, 14, 3, aura); _px(ctx, 19, 3, aura);
}

function _sprite_boss_ancient_dragon(ctx) {
  const body = '#cc3300', gold = '#ffd700', wing = '#aa1100', dark = '#881100';
  _gradRect(ctx, 6, 10, 12, 8, '#ee4400', body);
  _rect(ctx, 7, 9, 10, 1, body);
  _gradRect(ctx, 14, 3, 7, 6, '#ee4400', body);
  _px(ctx, 21, 5, body); _px(ctx, 22, 5, '#ff6600');
  _px(ctx, 16, 4, gold); _px(ctx, 19, 4, gold);
  _glow(ctx, 22, 5, 3, '#ff4400', 0.4);
  _hline(ctx, 14, 2, 7, gold);
  _px(ctx, 15, 1, gold); _px(ctx, 18, 1, gold); _px(ctx, 20, 1, gold);
  _gradRect(ctx, 1, 4, 6, 9, wing, '#550000');
  _px(ctx, 0, 5, wing); _rect(ctx, 2, 3, 4, 1, wing); _rect(ctx, 3, 2, 3, 1, wing);
  _px(ctx, 6, 18, body); _px(ctx, 5, 19, dark); _px(ctx, 4, 20, dark);
  _px(ctx, 3, 21, '#550000'); _px(ctx, 2, 22, '#440000');
  _rect(ctx, 8, 18, 3, 4, dark); _rect(ctx, 14, 18, 3, 4, dark);
  _px(ctx, 0, 3, gold); _px(ctx, 23, 3, gold);
  _px(ctx, 0, 12, gold); _px(ctx, 23, 12, gold);
  _px(ctx, 9, 12, '#ff6600'); _px(ctx, 12, 14, '#ff6600'); _px(ctx, 15, 12, '#ff6600');
}


/* ============================================================
   РЕЕСТР СПРАЙТОВ — привязка ID врага к генератору + размер
   ============================================================ */

const SPRITE_REGISTRY = {
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
  banshee:        { fn: _sprite_banshee, size: 16 },
  spider:         { fn: _sprite_spider, size: 16 },
  spiderling:     { fn: _sprite_spiderling, size: 16 },
  cave_crab:      { fn: _sprite_cave_crab, size: 16 },
  harpy:          { fn: _sprite_harpy, size: 16 },
  dung_beetle:    { fn: _sprite_dung_beetle, size: 16 },
  scorpion:       { fn: _sprite_scorpion, size: 16 },
  ooze:           { fn: _sprite_ooze, size: 16 },
  slimeling:      { fn: _sprite_slimeling, size: 16 },
  acid_slug:      { fn: _sprite_acid_slug, size: 16 },
  gasspore:       { fn: _sprite_gasspore, size: 16 },
  mold:           { fn: _sprite_mold, size: 16 },
  mushroom_man:   { fn: _sprite_mushroom_man, size: 16 },
  goblin:         { fn: _sprite_goblin, size: 16 },
  gnoll:          { fn: _sprite_gnoll, size: 16 },
  kobold:         { fn: _sprite_kobold, size: 16 },
  cultist:        { fn: _sprite_cultist, size: 16 },
  drow:           { fn: _sprite_drow, size: 16 },
  doppelganger:   { fn: _sprite_doppelganger, size: 16 },
  fire_elem:      { fn: _sprite_fire_elem, size: 16 },
  earth_elem:     { fn: _sprite_earth_elem, size: 16 },
  water_elem:     { fn: _sprite_water_elem, size: 16 },
  ice_elem:       { fn: _sprite_ice_elem, size: 16 },
  air_elem:       { fn: _sprite_air_elem, size: 16 },
  dragonet:       { fn: _sprite_dragonet, size: 16 },
  young_dragon:   { fn: _sprite_young_dragon, size: 16 },
  dragonid:       { fn: _sprite_dragonid, size: 16 },
  hell_hound:     { fn: _sprite_hell_hound, size: 16 },
  demon_berserker:{ fn: _sprite_demon_berserker, size: 16 },
  rakshasa:       { fn: _sprite_rakshasa, size: 16 },
  giant_rat:      { fn: _sprite_giant_rat, size: 16 },
  cave_bat:       { fn: _sprite_cave_bat, size: 16 },
  bat:            { fn: _sprite_bat, size: 16 },
  cave_bear:      { fn: _sprite_cave_bear, size: 16 },
  basilisk:       { fn: _sprite_basilisk, size: 16 },
  medusa:         { fn: _sprite_medusa, size: 16 },
  chimera:        { fn: _sprite_chimera, size: 16 },
  hydra_small:    { fn: _sprite_hydra_small, size: 16 },
  minotaur:       { fn: _sprite_minotaur, size: 16 },
  ogre:           { fn: _sprite_ogre, size: 16 },
  rotgolem:       { fn: _sprite_rotgolem, size: 16 },
  stone_golem:    { fn: _sprite_stone_golem, size: 16 },
  bone_colossus:  { fn: _sprite_bone_colossus, size: 16 },
  mimic:          { fn: _sprite_mimic, size: 16 },
  beholder_spore: { fn: _sprite_beholder_spore, size: 16 },
  observer:       { fn: _sprite_observer, size: 16 },
  illithid:       { fn: _sprite_illithid, size: 16 },
  eldritch_horror:{ fn: _sprite_eldritch_horror, size: 16 },
  rust_monster:   { fn: _sprite_rust_monster, size: 16 },
  salamander:     { fn: _sprite_salamander, size: 16 },
  gargoyle:       { fn: _sprite_gargoyle, size: 16 },
  vampire_spawn:  { fn: _sprite_vampire_spawn, size: 16 },
  night_walker:   { fn: _sprite_night_walker, size: 16 },
  troll:          { fn: _sprite_troll, size: 16 },
  lamia:          { fn: _sprite_lamia, size: 16 },
  // Боссы (24x24)
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
   Размеры спрайтов для отображения на экране (пиксели)
   ============================================================ */
const SPRITE_DISPLAY_SIZES = {
  skeleton: 32, zombie: 32, goblin: 28, archer: 30,
  ooze: 32, gasspore: 28, mage: 30, spider: 32,
  fire_elem: 34, bat: 26, cave_bat: 24, giant_rat: 24,
  acid_slug: 26, ratcatcher: 28, mold: 24, ghost: 30,
  gnoll: 32, kobold: 26, cave_crab: 32, alchemist_skel: 30,
  harpy: 30, dung_beetle: 28, spiderling: 20, slimeling: 22,
  scorpion: 30, mushroom_man: 28, banshee: 30,
  captain: 36, cultist: 28, shadow: 28, drow: 28,
  minotaur: 38, basilisk: 32, medusa: 30, doppelganger: 34,
  earth_elem: 38, water_elem: 32, ice_elem: 32, air_elem: 30,
  beholder_spore: 32, hell_hound: 30, dragonid: 34, illithid: 30,
  stone_golem: 40, rust_monster: 32, lich_minor: 30,
  chimera: 38, demon_berserker: 36, mimic: 32, rakshasa: 34,
  salamander: 28, gargoyle: 34, vampire_spawn: 30, night_walker: 32,
  troll: 38, lamia: 30, ogre: 38,
  rotgolem: 42, dragonet: 36, young_dragon: 44,
  observer: 38, death_knight: 40, hydra_small: 44,
  archlich: 36, eldritch_horror: 48, bone_colossus: 44,
  cave_bear: 40,
  boss_skeleton_knight: 52, boss_lich: 48,
  boss_spider_queen: 56, boss_fire_lord: 56,
  boss_ice_lord: 52, boss_ancient_ent: 60,
  boss_dark_knight: 52, boss_ghoul_king: 48,
  boss_ice_serpent: 60, boss_magma_giant: 56,
  boss_spider_matriarch: 52, boss_knight_commander: 56,
  boss_shadow_dragon: 60, boss_ancient_dragon: 64,
};


/* ============================================================
   ПУБЛИЧНЫЙ API
   ============================================================ */

function generateEnemySprite(enemyId) {
  const reg = SPRITE_REGISTRY[enemyId];
  if (!reg) return null;
  const canvas = _createSpriteCanvas(reg.size);
  const ctx = canvas.getContext('2d');
  reg.fn(ctx);
  _addOutline(ctx, reg.size, '#000000');
  return canvas;
}

function getEnemySprite(enemyId) {
  if (ENEMY_SPRITES[enemyId]) return ENEMY_SPRITES[enemyId];
  const sprite = generateEnemySprite(enemyId);
  if (sprite) ENEMY_SPRITES[enemyId] = sprite;
  return sprite;
}

function getSpriteDisplaySize(enemyId) {
  const base = SPRITE_DISPLAY_SIZES[enemyId] || 32;
  if (window.BASE_SCALE) {
    const unit = 16;
    const scaled = unit * Math.round(base / unit);
    return Math.max(scaled, base);
  }
  return base;
}

function initSprites() {
  // Защита от повторной инициализации
  if (window._spritesInitialized) return;
  window._spritesInitialized = true;

  const ids = Object.keys(SPRITE_REGISTRY);
  for (let i = 0; i < ids.length; i++) {
    ENEMY_SPRITES[ids[i]] = generateEnemySprite(ids[i]);
  }
  console.log(`[Sprites] Сгенерировано ${ids.length} спрайтов врагов (редизайн)`);
  if (window.initItemSprites) initItemSprites();
  initClassSprites();
  initPlayerWalkSprites();
  if (window.initDecorSprites) initDecorSprites();
}


/* ============================================================
   CLASS_SPRITES — Иконки классов 32x32 (редизайн: объёмные)
   ============================================================ */
const CLASS_SPRITES = {};

function _sprite_class_warrior(ctx) {
  const armor = '#c0c8d0', armorDark = '#8a9aaa', cape = '#2244aa';
  const skin = '#e8c8a0', sword = '#d0d8e0', gold = '#ffd700';
  // Плащ
  _gradRect(ctx, 8, 10, 4, 14, cape, '#183080');
  _rect(ctx, 7, 14, 6, 10, '#183080');
  // Шлем
  _gradRect(ctx, 12, 2, 8, 8, '#ddd', armor);
  _rect(ctx, 11, 3, 10, 6, armor);
  _rect(ctx, 13, 1, 6, 1, armorDark);
  _rect(ctx, 13, 5, 6, 2, '#222');
  _px(ctx, 14, 5, '#4488ff'); _px(ctx, 17, 5, '#4488ff');
  _rect(ctx, 14, 1, 4, 1, gold);
  // Тело
  _gradRect(ctx, 11, 10, 10, 10, '#ddd', armor);
  _rect(ctx, 10, 11, 12, 8, armor);
  _rect(ctx, 11, 19, 10, 2, '#6b4400');
  _px(ctx, 15, 19, gold); _px(ctx, 16, 19, gold);
  // Наплечники
  _rect(ctx, 8, 9, 3, 3, armor); _rect(ctx, 21, 9, 3, 3, armor);
  // Руки
  _rect(ctx, 8, 12, 2, 8, armor); _rect(ctx, 22, 12, 2, 8, armor);
  _rect(ctx, 8, 20, 2, 2, skin); _rect(ctx, 22, 20, 2, 2, skin);
  // Ноги
  _rect(ctx, 12, 21, 3, 8, armorDark); _rect(ctx, 17, 21, 3, 8, armorDark);
  _rect(ctx, 12, 28, 3, 2, '#444'); _rect(ctx, 17, 28, 3, 2, '#444');
  // Меч
  _rect(ctx, 23, 8, 2, 14, sword); _px(ctx, 24, 5, '#fff');
  _rect(ctx, 22, 21, 4, 1, gold);
  _rect(ctx, 23, 22, 2, 3, '#5a3a0a');
}

function _sprite_class_mage(ctx) {
  const cloak = '#6a2fa0', cloakDark = '#4a1a70';
  const skin = '#e8c8a0', beard = '#ccc', crystal = '#44ffcc';
  _gradRect(ctx, 9, 10, 14, 18, cloak, cloakDark);
  _rect(ctx, 8, 12, 16, 14, cloakDark);
  _rect(ctx, 7, 16, 18, 10, cloakDark);
  _gradRect(ctx, 11, 2, 10, 9, cloak, cloakDark);
  _rect(ctx, 10, 3, 12, 7, cloak);
  _rect(ctx, 12, 4, 8, 4, '#2a0a40');
  _gradRect(ctx, 13, 4, 6, 5, skin, '#c8a880');
  _px(ctx, 14, 5, '#8844ff'); _px(ctx, 17, 5, '#8844ff');
  _rect(ctx, 13, 8, 6, 3, beard); _rect(ctx, 14, 11, 4, 2, beard);
  _rect(ctx, 6, 12, 3, 8, cloak); _rect(ctx, 23, 12, 3, 8, cloak);
  _rect(ctx, 6, 20, 2, 2, skin); _rect(ctx, 24, 20, 2, 2, skin);
  _rect(ctx, 4, 3, 2, 26, '#6b4400');
  _rect(ctx, 3, 0, 4, 3, crystal); _px(ctx, 5, 1, '#fff');
  _px(ctx, 2, 1, '#22cc99'); _px(ctx, 7, 1, '#22cc99');
  _rect(ctx, 12, 28, 3, 2, '#333'); _rect(ctx, 17, 28, 3, 2, '#333');
}


function _sprite_class_rogue(ctx) {
  const cloak = '#2a2a2a', cloakDark = '#1a1a1a';
  const skin = '#d4a870', blade = '#c0c8d0';
  _gradRect(ctx, 11, 10, 10, 16, cloak, cloakDark);
  _rect(ctx, 10, 12, 12, 12, cloakDark);
  _rect(ctx, 10, 24, 12, 4, cloakDark);
  _gradRect(ctx, 12, 2, 8, 8, cloak, cloakDark);
  _rect(ctx, 11, 3, 10, 6, cloak);
  _rect(ctx, 13, 4, 6, 4, '#0a0a0a');
  _rect(ctx, 14, 4, 4, 3, '#3a2a1a');
  _px(ctx, 14, 5, '#44ff44'); _px(ctx, 17, 5, '#44ff44');
  _rect(ctx, 8, 11, 2, 8, cloak); _rect(ctx, 22, 11, 2, 8, cloak);
  _rect(ctx, 7, 19, 2, 2, skin); _rect(ctx, 23, 19, 2, 2, skin);
  _rect(ctx, 6, 14, 1, 6, blade); _px(ctx, 6, 12, '#e8f0f8');
  _rect(ctx, 25, 14, 1, 6, blade); _px(ctx, 25, 12, '#e8f0f8');
  _rect(ctx, 12, 26, 2, 5, '#222'); _rect(ctx, 18, 26, 2, 5, '#222');
  _rect(ctx, 11, 29, 3, 2, '#333'); _rect(ctx, 18, 29, 3, 2, '#333');
  _rect(ctx, 11, 20, 10, 1, '#4a3a1a');
}

function _sprite_class_tank(ctx) {
  const armor = '#6a7080', armorDark = '#4a5060', armorLight = '#8a9aaa';
  const horn = '#c8a83a', gold = '#ffd700';
  _gradRect(ctx, 8, 10, 16, 12, armorLight, armor);
  _rect(ctx, 7, 11, 18, 10, armor);
  _rect(ctx, 14, 12, 4, 8, armorDark);
  _rect(ctx, 8, 21, 16, 2, '#5a4a2a');
  _rect(ctx, 14, 21, 4, 2, gold);
  _gradRect(ctx, 11, 2, 10, 8, armorLight, armor);
  _rect(ctx, 10, 3, 12, 6, armor);
  _rect(ctx, 12, 5, 8, 2, '#111');
  _px(ctx, 13, 5, '#ff8800'); _px(ctx, 18, 5, '#ff8800');
  _rect(ctx, 8, 2, 2, 4, horn); _px(ctx, 7, 1, horn); _px(ctx, 7, 0, horn);
  _rect(ctx, 22, 2, 2, 4, horn); _px(ctx, 24, 1, horn); _px(ctx, 24, 0, horn);
  _rect(ctx, 5, 9, 4, 4, armorLight); _rect(ctx, 23, 9, 4, 4, armorLight);
  _px(ctx, 5, 8, '#aaa'); _px(ctx, 7, 8, '#aaa');
  _px(ctx, 25, 8, '#aaa'); _px(ctx, 23, 8, '#aaa');
  _rect(ctx, 5, 13, 3, 8, armor); _rect(ctx, 24, 13, 3, 8, armor);
  _rect(ctx, 10, 23, 4, 7, armorDark); _rect(ctx, 18, 23, 4, 7, armorDark);
  _rect(ctx, 10, 28, 4, 3, '#333'); _rect(ctx, 18, 28, 4, 3, '#333');
  _rect(ctx, 26, 4, 2, 18, '#6b4400');
  _rect(ctx, 24, 1, 6, 4, '#555'); _px(ctx, 26, 1, '#888');
}

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
  console.log('[Sprites] Generated 4 class icons (32x32, redesign)');
}


/* ============================================================
   PLAYER_WALK_SPRITES — Кадры ходьбы (16x16)
   ============================================================ */
const PLAYER_WALK_SPRITES = {};

function _drawPlayerBase_warrior(ctx, frame) {
  const armor = '#c0c8d0', armorDark = '#8a9aaa', cape = '#2244aa';
  _gradRect(ctx, 5, 0, 6, 5, '#ddd', armor);
  _rect(ctx, 6, 0, 4, 1, armorDark);
  _px(ctx, 6, 2, '#4488ff'); _px(ctx, 9, 2, '#4488ff');
  _rect(ctx, 6, 3, 4, 1, '#222');
  _gradRect(ctx, 5, 5, 6, 5, '#ddd', armor);
  _rect(ctx, 4, 6, 1, 3, cape);
  if (frame === 1) {
    _rect(ctx, 6, 10, 2, 4, armorDark); _rect(ctx, 9, 11, 2, 3, armorDark);
  } else {
    _rect(ctx, 6, 11, 2, 3, armorDark); _rect(ctx, 9, 10, 2, 4, armorDark);
  }
  _vline(ctx, 12, 3, 7, '#d0d8e0'); _px(ctx, 12, 2, '#fff');
}

function _drawPlayerBase_mage(ctx, frame) {
  const cloak = '#6a2fa0', cloakDark = '#4a1a70';
  _gradRect(ctx, 5, 0, 6, 5, cloak, cloakDark);
  _rect(ctx, 6, 1, 4, 3, '#2a0a40');
  _px(ctx, 7, 2, '#8844ff'); _px(ctx, 9, 2, '#8844ff');
  _px(ctx, 7, 4, '#ccc'); _px(ctx, 8, 4, '#ccc');
  _gradRect(ctx, 5, 5, 6, 6, cloak, cloakDark);
  _rect(ctx, 4, 7, 8, 3, cloakDark);
  if (frame === 1) {
    _rect(ctx, 6, 11, 2, 3, cloakDark); _rect(ctx, 9, 12, 2, 2, cloakDark);
  } else {
    _rect(ctx, 6, 12, 2, 2, cloakDark); _rect(ctx, 9, 11, 2, 3, cloakDark);
  }
  _vline(ctx, 3, 0, 14, '#6b4400'); _px(ctx, 3, 0, '#44ffcc');
}

function _drawPlayerBase_rogue(ctx, frame) {
  const cloak = '#2a2a2a', cloakDark = '#1a1a1a';
  _gradRect(ctx, 5, 0, 6, 5, '#333', cloak);
  _rect(ctx, 6, 1, 4, 3, '#0a0a0a');
  _px(ctx, 7, 2, '#44ff44'); _px(ctx, 9, 2, '#44ff44');
  _gradRect(ctx, 6, 5, 4, 5, cloak, cloakDark);
  _rect(ctx, 5, 6, 6, 3, cloakDark);
  _vline(ctx, 4, 4, 5, '#c0c8d0'); _px(ctx, 4, 3, '#e8f0f8');
  _vline(ctx, 12, 4, 5, '#c0c8d0'); _px(ctx, 12, 3, '#e8f0f8');
  if (frame === 1) {
    _rect(ctx, 6, 10, 2, 4, cloakDark); _rect(ctx, 9, 11, 2, 3, cloakDark);
  } else {
    _rect(ctx, 6, 11, 2, 3, cloakDark); _rect(ctx, 9, 10, 2, 4, cloakDark);
  }
}

function _drawPlayerBase_tank(ctx, frame) {
  const armor = '#6a7080', armorDark = '#4a5060', horn = '#c8a83a';
  _gradRect(ctx, 5, 0, 6, 5, '#8a9aaa', armor);
  _px(ctx, 4, 0, horn); _px(ctx, 4, 1, horn);
  _px(ctx, 11, 0, horn); _px(ctx, 11, 1, horn);
  _rect(ctx, 6, 2, 4, 1, '#111');
  _px(ctx, 6, 2, '#ff8800'); _px(ctx, 9, 2, '#ff8800');
  _gradRect(ctx, 4, 5, 8, 5, '#8a9aaa', armor);
  _rect(ctx, 3, 6, 10, 3, armor);
  _rect(ctx, 3, 4, 2, 2, armorDark); _rect(ctx, 12, 4, 2, 2, armorDark);
  if (frame === 1) {
    _rect(ctx, 5, 10, 3, 4, armorDark); _rect(ctx, 9, 11, 3, 3, armorDark);
  } else {
    _rect(ctx, 5, 11, 3, 3, armorDark); _rect(ctx, 9, 10, 3, 4, armorDark);
  }
  _vline(ctx, 14, 1, 10, '#6b4400'); _rect(ctx, 13, 0, 3, 2, '#555');
}

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
  console.log('[Sprites] Generated 8 walk frames (16x16, redesign)');
}


/* ============================================================
   DECOR_SPRITES — декоративные объекты (для биомов)
   ============================================================ */
const DECOR_SPRITES = {};

function _makeDecor8(fn) {
  const c = _createSpriteCanvas(8); fn(c.getContext('2d')); return c;
}
function _makeDecor12(fn) {
  const c = _createSpriteCanvas(12); fn(c.getContext('2d')); return c;
}
function _makeDecor16(fn) {
  const c = _createSpriteCanvas(16); fn(c.getContext('2d')); return c;
}

function initDecorSprites() {
  // Склеп
  DECOR_SPRITES['bones'] = _makeDecor8(function(ctx) {
    _rect(ctx, 1, 3, 6, 1, '#c0b090'); _rect(ctx, 2, 5, 4, 1, '#a09070');
    _px(ctx, 1, 4, '#a09070'); _px(ctx, 6, 4, '#a09070');
  });
  DECOR_SPRITES['skull'] = _makeDecor8(function(ctx) {
    _rect(ctx, 2, 1, 4, 4, '#e8dcc8');
    _px(ctx, 3, 2, '#1a1a1a'); _px(ctx, 5, 2, '#1a1a1a');
    _rect(ctx, 3, 4, 2, 1, '#a09070'); _rect(ctx, 3, 5, 2, 2, '#c0b090');
  });
  DECOR_SPRITES['broken_column'] = _makeDecor16(function(ctx) {
    _gradRect(ctx, 4, 2, 8, 12, '#7a7a7a', '#5a5a5a');
    _rect(ctx, 3, 1, 10, 2, '#7a7a7a');
    _px(ctx, 5, 2, '#4a4a4a'); _px(ctx, 10, 3, '#4a4a4a');
  });
  DECOR_SPRITES['chain_skull'] = _makeDecor8(function(ctx) {
    _vline(ctx, 4, 0, 3, '#6a6a6a');
    _rect(ctx, 2, 3, 4, 3, '#e8dcc8');
    _px(ctx, 3, 4, '#1a1a1a'); _px(ctx, 5, 4, '#1a1a1a');
  });
  DECOR_SPRITES['cobweb_floor'] = _makeDecor8(function(ctx) {
    ctx.strokeStyle = 'rgba(200,200,200,0.4)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(7,7);
    ctx.moveTo(7,0); ctx.lineTo(0,7); ctx.moveTo(4,0); ctx.lineTo(4,7); ctx.stroke();
  });
  DECOR_SPRITES['cracked_tile'] = _makeDecor8(function(ctx) {
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(2,1); ctx.lineTo(4,4); ctx.lineTo(6,3); ctx.lineTo(7,6); ctx.stroke();
  });
  // Лёд
  DECOR_SPRITES['ice_crystal'] = _makeDecor12(function(ctx) {
    ctx.fillStyle = '#80d0f0'; ctx.beginPath();
    ctx.moveTo(6,0); ctx.lineTo(10,5); ctx.lineTo(8,11); ctx.lineTo(4,11); ctx.lineTo(2,5);
    ctx.closePath(); ctx.fill(); _rect(ctx, 5, 2, 2, 4, '#a0e8ff');
  });
  DECOR_SPRITES['stalactite'] = _makeDecor8(function(ctx) {
    _rect(ctx, 3, 0, 2, 2, '#7a8a9a'); _rect(ctx, 2, 2, 4, 2, '#6a7a8a');
    _px(ctx, 4, 4, '#5a6a7a'); _px(ctx, 3, 5, '#5a6a7a'); _px(ctx, 4, 6, '#4a5a6a');
  });
  DECOR_SPRITES['frozen_corpse'] = _makeDecor8(function(ctx) {
    _rect(ctx, 2, 1, 4, 5, '#6090b0'); _rect(ctx, 3, 2, 2, 1, '#80b0d0');
    _px(ctx, 3, 3, '#405060'); _px(ctx, 5, 3, '#405060');
  });
  DECOR_SPRITES['snow_pile'] = _makeDecor8(function(ctx) {
    _rect(ctx, 1, 4, 6, 3, '#e0e8f0'); _rect(ctx, 2, 3, 4, 1, '#d0d8e8'); _px(ctx, 3, 2, '#c8d0e0');
  });
  DECOR_SPRITES['ice_crack'] = _makeDecor8(function(ctx) {
    ctx.strokeStyle = '#4080a0'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(1,2); ctx.lineTo(3,4); ctx.lineTo(5,3); ctx.lineTo(7,6); ctx.stroke();
  });


  // Огненные шахты
  DECOR_SPRITES['lava_pool'] = _makeDecor8(function(ctx) {
    _rect(ctx, 1, 2, 6, 4, '#cc3300'); _rect(ctx, 2, 3, 4, 2, '#ff6600');
    _px(ctx, 3, 3, '#ffaa00'); _px(ctx, 5, 4, '#ffcc00');
  });
  DECOR_SPRITES['ore_chunk'] = _makeDecor8(function(ctx) {
    _rect(ctx, 1, 3, 6, 4, '#5a4a3a');
    _px(ctx, 2, 4, '#c0a000'); _px(ctx, 5, 5, '#c0a000'); _px(ctx, 4, 3, '#e0c000');
  });
  DECOR_SPRITES['mine_cart'] = _makeDecor16(function(ctx) {
    _rect(ctx, 2, 4, 12, 7, '#5a4a3a'); _rect(ctx, 3, 5, 10, 5, '#6a5a4a');
    ctx.fillStyle = '#3a3a3a';
    ctx.beginPath(); ctx.arc(5, 12, 2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(11, 12, 2, 0, Math.PI*2); ctx.fill();
  });
  DECOR_SPRITES['chain'] = _makeDecor8(function(ctx) {
    for (let y = 0; y < 8; y += 2) _rect(ctx, 3, y, 2, 1, '#6a6a6a');
    _px(ctx, 3, 1, '#5a5a5a'); _px(ctx, 4, 3, '#5a5a5a');
  });
  DECOR_SPRITES['bellows'] = _makeDecor8(function(ctx) {
    _rect(ctx, 1, 3, 6, 3, '#8b6914'); _rect(ctx, 2, 2, 4, 1, '#6a5010'); _px(ctx, 6, 4, '#4a4a4a');
  });
  DECOR_SPRITES['ember'] = _makeDecor8(function(ctx) {
    _px(ctx, 3, 3, '#ff4400'); _px(ctx, 4, 4, '#ff6600');
    _px(ctx, 5, 3, '#ffaa00'); _px(ctx, 3, 5, '#ff2200'); _px(ctx, 4, 2, '#cc2200');
  });
  // Лесные руины
  DECOR_SPRITES['glowing_mushroom'] = _makeDecor8(function(ctx) {
    _rect(ctx, 3, 5, 2, 3, '#6a5a4a');
    ctx.fillStyle = '#40e0d0'; ctx.beginPath(); ctx.arc(4, 4, 3, Math.PI, 0); ctx.fill();
    _px(ctx, 3, 3, '#60ffd0');
  });
  DECOR_SPRITES['vine'] = _makeDecor8(function(ctx) {
    ctx.strokeStyle = '#2a5a1a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(1,0); ctx.quadraticCurveTo(4,4,7,7); ctx.stroke();
    _px(ctx, 2, 2, '#3a7a2a'); _px(ctx, 5, 5, '#3a7a2a');
  });
  DECOR_SPRITES['broken_statue'] = _makeDecor8(function(ctx) {
    _rect(ctx, 2, 3, 4, 5, '#8a8a8a'); _rect(ctx, 3, 1, 2, 3, '#7a7a7a'); _px(ctx, 5, 4, '#6a6a6a');
  });
  DECOR_SPRITES['mossy_rock'] = _makeDecor8(function(ctx) {
    _rect(ctx, 1, 3, 6, 4, '#5a5a4a'); _rect(ctx, 2, 2, 4, 2, '#4a6a3a'); _px(ctx, 3, 2, '#5a8a4a');
  });
  DECOR_SPRITES['fallen_tree'] = _makeDecor16(function(ctx) {
    _rect(ctx, 0, 6, 16, 4, '#5a3a1a'); _rect(ctx, 1, 7, 14, 2, '#6a4a2a');
    _px(ctx, 14, 5, '#3a6a2a'); _px(ctx, 15, 4, '#3a6a2a'); _px(ctx, 0, 7, '#4a2a0a');
  });
  DECOR_SPRITES['flower_bush'] = _makeDecor8(function(ctx) {
    ctx.fillStyle = '#3a8a3a'; ctx.beginPath(); ctx.arc(4, 5, 3, 0, Math.PI*2); ctx.fill();
    _px(ctx, 3, 3, '#ff69b4'); _px(ctx, 5, 4, '#ffff00'); _px(ctx, 2, 4, '#add8e6');
  });


  // Замок
  DECOR_SPRITES['tapestry'] = _makeDecor8(function(ctx) {
    _rect(ctx, 2, 0, 4, 7, '#8b0000'); _rect(ctx, 1, 0, 6, 1, '#6a5a3a');
    _rect(ctx, 3, 2, 2, 1, '#ffd700'); _rect(ctx, 3, 5, 2, 1, '#ffd700');
  });
  DECOR_SPRITES['armor_stand'] = _makeDecor8(function(ctx) {
    _vline(ctx, 4, 2, 5, '#4a4a4a'); _rect(ctx, 2, 0, 4, 3, '#808080');
    _hline(ctx, 1, 2, 6, '#6a6a6a'); _px(ctx, 3, 1, '#a0a0a0'); _px(ctx, 5, 1, '#a0a0a0');
  });
  DECOR_SPRITES['candelabra'] = _makeDecor8(function(ctx) {
    _vline(ctx, 4, 3, 4, '#c9a84c'); _hline(ctx, 2, 3, 4, '#c9a84c');
    _px(ctx, 2, 2, '#ffcc00'); _px(ctx, 4, 2, '#ffcc00'); _px(ctx, 6, 2, '#ffcc00');
  });
  DECOR_SPRITES['bookshelf'] = _makeDecor16(function(ctx) {
    _rect(ctx, 1, 1, 14, 14, '#5a3a1a');
    _rect(ctx, 2, 2, 5, 3, '#8b0000'); _rect(ctx, 8, 2, 5, 3, '#003080');
    _rect(ctx, 2, 6, 4, 3, '#006030'); _rect(ctx, 7, 6, 6, 3, '#4a2a0a');
    _rect(ctx, 2, 10, 6, 3, '#660066'); _rect(ctx, 9, 10, 4, 3, '#8b6914');
  });
  DECOR_SPRITES['throne'] = _makeDecor16(function(ctx) {
    _rect(ctx, 4, 2, 8, 12, '#6a1a1a'); _rect(ctx, 3, 0, 10, 3, '#8b0000');
    _rect(ctx, 5, 8, 6, 4, '#5a1010');
    _px(ctx, 5, 1, '#ffd700'); _px(ctx, 11, 1, '#ffd700'); _px(ctx, 8, 1, '#ffd700');
  });
  DECOR_SPRITES['cage'] = _makeDecor8(function(ctx) {
    _rect(ctx, 1, 1, 6, 6, '#1a1a1a');
    for (let x = 2; x <= 6; x += 2) _vline(ctx, x, 1, 6, '#5a5a5a');
    _hline(ctx, 1, 1, 6, '#5a5a5a'); _hline(ctx, 1, 6, 6, '#5a5a5a');
  });
  DECOR_SPRITES['banner'] = _makeDecor8(function(ctx) {
    _rect(ctx, 3, 0, 2, 7, '#003080'); _hline(ctx, 2, 0, 4, '#c9a84c'); _px(ctx, 4, 3, '#ffd700');
  });
  // Небесный город
  DECOR_SPRITES['golden_urn'] = _makeDecor8(function(ctx) {
    _rect(ctx, 2, 2, 4, 5, '#c9a84c'); _rect(ctx, 3, 1, 2, 1, '#a08030');
    _rect(ctx, 1, 3, 6, 1, '#e0c060'); _px(ctx, 3, 4, '#ffd700');
  });
  DECOR_SPRITES['marble_statue'] = _makeDecor16(function(ctx) {
    _rect(ctx, 5, 2, 6, 12, '#f0f0f0'); _rect(ctx, 6, 0, 4, 3, '#e8e8e8');
    _rect(ctx, 4, 13, 8, 2, '#d0d0d0');
    _px(ctx, 7, 1, '#808080'); _px(ctx, 9, 1, '#808080');
    _rect(ctx, 2, 4, 3, 4, '#e0e0e0'); _rect(ctx, 11, 4, 3, 4, '#e0e0e0');
  });
  DECOR_SPRITES['floating_crystal'] = _makeDecor8(function(ctx) {
    ctx.fillStyle = '#ffe080'; ctx.beginPath();
    ctx.moveTo(4,0); ctx.lineTo(7,4); ctx.lineTo(4,7); ctx.lineTo(1,4);
    ctx.closePath(); ctx.fill(); _px(ctx, 4, 3, '#ffffff');
  });
  DECOR_SPRITES['cloud_fountain'] = _makeDecor16(function(ctx) {
    _rect(ctx, 3, 8, 10, 6, '#d0d8e0'); _rect(ctx, 5, 4, 6, 5, '#e0e8f0');
    ctx.fillStyle = '#80c0ff'; ctx.beginPath(); ctx.arc(8, 6, 2, 0, Math.PI*2); ctx.fill();
    _rect(ctx, 4, 12, 8, 2, '#b0b8c0');
  });
  DECOR_SPRITES['light_pillar'] = _makeDecor8(function(ctx) {
    _rect(ctx, 3, 0, 2, 8, '#ffe080'); _px(ctx, 2, 1, '#fff0a0'); _px(ctx, 5, 2, '#fff0a0'); _px(ctx, 4, 4, '#ffffff');
  });
  DECOR_SPRITES['angel_wing'] = _makeDecor8(function(ctx) {
    _rect(ctx, 1, 2, 2, 4, '#f0f0f0'); _rect(ctx, 5, 2, 2, 4, '#f0f0f0');
    _px(ctx, 0, 3, '#e0e0e0'); _px(ctx, 7, 3, '#e0e0e0'); _px(ctx, 3, 4, '#d0d0d0');
  });


  // Эльфийский лес
  DECOR_SPRITES['rune_stone'] = _makeDecor8(function(ctx) {
    _rect(ctx, 1, 2, 6, 5, '#5a6a4a'); _rect(ctx, 2, 1, 4, 2, '#4a5a3a');
    _px(ctx, 3, 3, '#80c0ff'); _px(ctx, 5, 4, '#80c0ff'); _px(ctx, 4, 5, '#60a0e0');
  });
  DECOR_SPRITES['elven_lantern'] = _makeDecor8(function(ctx) {
    _vline(ctx, 4, 0, 3, '#8a7a5a'); _rect(ctx, 2, 3, 4, 3, '#c9a84c');
    ctx.fillStyle = '#60ffa0'; ctx.beginPath(); ctx.arc(4, 5, 1.5, 0, Math.PI*2); ctx.fill();
  });
  DECOR_SPRITES['bloom_bush'] = _makeDecor8(function(ctx) {
    ctx.fillStyle = '#3a8a3a'; ctx.beginPath(); ctx.arc(4, 5, 3, 0, Math.PI*2); ctx.fill();
    _px(ctx, 2, 3, '#ff69b4'); _px(ctx, 5, 4, '#dda0dd'); _px(ctx, 4, 2, '#ffff00');
  });
  DECOR_SPRITES['magic_mushroom'] = _makeDecor8(function(ctx) {
    _rect(ctx, 3, 5, 2, 3, '#8a7a5a');
    ctx.fillStyle = '#8040c0'; ctx.beginPath(); ctx.arc(4, 4, 3, Math.PI, 0); ctx.fill();
    _px(ctx, 3, 3, '#c080ff'); _px(ctx, 5, 3, '#c080ff');
  });
  DECOR_SPRITES['nature_altar'] = _makeDecor16(function(ctx) {
    _rect(ctx, 2, 8, 12, 6, '#5a7a4a'); _rect(ctx, 4, 5, 8, 4, '#4a6a3a');
    ctx.fillStyle = '#80c0ff'; ctx.beginPath(); ctx.arc(8, 6, 2, 0, Math.PI*2); ctx.fill();
    _px(ctx, 6, 4, '#3a8a3a'); _px(ctx, 10, 4, '#3a8a3a');
  });
  DECOR_SPRITES['fairy_circle'] = _makeDecor8(function(ctx) {
    ctx.strokeStyle = '#60ffa0'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(4, 4, 3, 0, Math.PI*2); ctx.stroke();
    _px(ctx, 2, 2, '#ffff80'); _px(ctx, 6, 5, '#ffff80');
  });
  // Горная крепость
  DECOR_SPRITES['barrel'] = _makeDecor12(function(ctx) {
    _rect(ctx, 2, 1, 8, 10, '#8b6914'); _rect(ctx, 1, 2, 10, 1, '#5a4a10');
    _rect(ctx, 1, 8, 10, 1, '#5a4a10'); _rect(ctx, 3, 3, 6, 6, '#a07a20');
  });
  DECOR_SPRITES['ore_crate'] = _makeDecor12(function(ctx) {
    _rect(ctx, 1, 2, 10, 8, '#6a5a3a'); _rect(ctx, 2, 3, 8, 6, '#5a4a2a');
    _hline(ctx, 1, 5, 10, '#4a3a1a'); _vline(ctx, 6, 2, 8, '#4a3a1a');
    _px(ctx, 4, 4, '#c0a000'); _px(ctx, 8, 7, '#c0a000');
  });
  DECOR_SPRITES['pickaxe'] = _makeDecor8(function(ctx) {
    ctx.strokeStyle = '#8a7a5a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(1, 7); ctx.lineTo(6, 2); ctx.stroke();
    _rect(ctx, 5, 0, 3, 3, '#6a6a6a'); _px(ctx, 7, 0, '#5a5a5a');
  });
  DECOR_SPRITES['chain_lantern'] = _makeDecor8(function(ctx) {
    _vline(ctx, 4, 0, 2, '#5a5a5a'); _rect(ctx, 2, 2, 4, 4, '#6a5a3a');
    ctx.fillStyle = '#ffaa00'; ctx.beginPath(); ctx.arc(4, 4, 1.5, 0, Math.PI*2); ctx.fill();
  });
  DECOR_SPRITES['forge_anvil'] = _makeDecor16(function(ctx) {
    _rect(ctx, 3, 6, 10, 4, '#4a4a4a'); _rect(ctx, 1, 5, 14, 2, '#5a5a5a');
    _rect(ctx, 5, 10, 6, 4, '#3a3a3a'); _px(ctx, 7, 5, '#6a6a6a'); _px(ctx, 9, 5, '#6a6a6a');
  });
  DECOR_SPRITES['stone_bridge'] = _makeDecor16(function(ctx) {
    _rect(ctx, 0, 5, 16, 6, '#6a6a5a'); _rect(ctx, 1, 6, 14, 4, '#5a5a4a');
    _hline(ctx, 0, 5, 16, '#7a7a6a'); _hline(ctx, 0, 10, 16, '#4a4a3a');
  });
  DECOR_SPRITES['rock_pile'] = _makeDecor8(function(ctx) {
    _rect(ctx, 1, 4, 6, 3, '#6a6a5a'); _rect(ctx, 2, 3, 4, 2, '#5a5a4a'); _px(ctx, 3, 2, '#7a7a6a');
  });

  console.log('[Sprites] Generated decor sprites: ' + Object.keys(DECOR_SPRITES).length);
}


/* ============================================================
   ЭКСПОРТ В ГЛОБАЛЬНУЮ ОБЛАСТЬ
   ============================================================ */
window.ENEMY_SPRITES = ENEMY_SPRITES;
window.CLASS_SPRITES = CLASS_SPRITES;
window.PLAYER_WALK_SPRITES = PLAYER_WALK_SPRITES;
window.DECOR_SPRITES = DECOR_SPRITES;
window.initSprites = initSprites;
window.getEnemySprite = getEnemySprite;
window.getSpriteDisplaySize = getSpriteDisplaySize;
window.generateEnemySprite = generateEnemySprite;
window.SPRITE_DISPLAY_SIZES = SPRITE_DISPLAY_SIZES;
window.initDecorSprites = initDecorSprites;

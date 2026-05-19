'use strict';
/* ============================================================
   sprites_items.js — Пиксельные спрайты оружий, пассивок,
   эволюций и снарядов (16x16 иконки, 8x8/12x12 снаряды).

   Генерируются программно через Canvas при старте игры.
   Кешируются для O(1) доступа.

   API:
   - initItemSprites()       — генерирует все спрайты, вызвать 1 раз
   - WEAPON_SPRITES          — кеш {id: canvas 16x16}
   - ABILITY_SPRITES         — кеш {id: canvas 16x16}
   - EVOLUTION_SPRITES       — кеш {id: canvas 16x16}
   - PROJECTILE_SPRITES      — кеш {type: canvas 8x8 или 12x12}
   ============================================================ */

const WEAPON_SPRITES = {};
const ABILITY_SPRITES = {};
const EVOLUTION_SPRITES = {};
const PROJECTILE_SPRITES = {};

/* ---------- Утилиты (ссылки на существующие из sprites.js) ---------- */
// Используем те же _createSpriteCanvas, _px, _rect, _hline, _vline
// Они определены в sprites.js и доступны глобально.


/* ============================================================
   ГЕНЕРАТОРЫ СПРАЙТОВ ОРУЖИЯ (16x16)
   ============================================================ */

function _weaponSprite_sword(ctx) {
  // Прямой клинок: серебряное лезвие, золотая рукоять
  _vline(ctx, 8, 1, 10, '#c0c0c0');  // лезвие
  _vline(ctx, 9, 1, 10, '#a0a0a0');  // тень лезвия
  _px(ctx, 8, 1, '#ffffff');          // кончик
  _hline(ctx, 6, 11, 5, '#ffd700');  // гарда
  _vline(ctx, 8, 12, 3, '#8b4513');  // рукоять
  _vline(ctx, 9, 12, 3, '#6b3510');
  _px(ctx, 8, 15, '#ffd700');        // навершие
  _px(ctx, 9, 15, '#ffd700');
}

function _weaponSprite_bow(ctx) {
  // Коричневая дуга, тетива, стрела
  _px(ctx, 5, 3, '#8b4513'); _px(ctx, 4, 4, '#8b4513');
  _px(ctx, 3, 5, '#8b4513'); _px(ctx, 3, 6, '#8b4513');
  _px(ctx, 3, 7, '#8b4513'); _px(ctx, 3, 8, '#8b4513');
  _px(ctx, 3, 9, '#8b4513'); _px(ctx, 3, 10, '#8b4513');
  _px(ctx, 4, 11, '#8b4513'); _px(ctx, 5, 12, '#8b4513');
  // тетива
  _vline(ctx, 5, 4, 8, '#ffffff');
  // стрела
  _hline(ctx, 6, 7, 8, '#f4d03f');
  _px(ctx, 14, 6, '#c0c0c0'); _px(ctx, 14, 8, '#c0c0c0');
  _px(ctx, 15, 7, '#c0c0c0'); // наконечник
}


function _weaponSprite_daggers(ctx) {
  // Два скрещённых кинжала
  // Кинжал 1 (\ диагональ)
  _px(ctx, 4, 3, '#c0c0c0'); _px(ctx, 5, 4, '#c0c0c0');
  _px(ctx, 6, 5, '#c0c0c0'); _px(ctx, 7, 6, '#c0c0c0');
  _px(ctx, 8, 7, '#ffd700'); _px(ctx, 9, 8, '#8b4513');
  _px(ctx, 10, 9, '#8b4513');
  // Кинжал 2 (/ диагональ)
  _px(ctx, 12, 3, '#c0c0c0'); _px(ctx, 11, 4, '#c0c0c0');
  _px(ctx, 10, 5, '#c0c0c0'); _px(ctx, 9, 6, '#c0c0c0');
  _px(ctx, 8, 7, '#ffd700'); _px(ctx, 7, 8, '#8b4513');
  _px(ctx, 6, 9, '#8b4513');
}

function _weaponSprite_fireball(ctx) {
  // Оранжево-красный круг с жёлтыми искрами
  _rect(ctx, 6, 5, 4, 6, '#ff4500');
  _rect(ctx, 5, 6, 6, 4, '#ff4500');
  _rect(ctx, 7, 6, 2, 4, '#ff8c00');
  _px(ctx, 7, 7, '#ffff00'); _px(ctx, 8, 8, '#ffff00');
  // искры
  _px(ctx, 4, 4, '#ffaa00'); _px(ctx, 11, 4, '#ffaa00');
  _px(ctx, 3, 7, '#ff6600'); _px(ctx, 12, 8, '#ff6600');
  _px(ctx, 5, 11, '#ffaa00'); _px(ctx, 10, 11, '#ffaa00');
  _px(ctx, 8, 3, '#ffdd00');
}

function _weaponSprite_axe(ctx) {
  // Широкое лезвие + рукоять
  _vline(ctx, 8, 5, 10, '#8b4513'); // рукоять
  _vline(ctx, 9, 5, 10, '#6b3510');
  // лезвие (дуга)
  _rect(ctx, 4, 2, 5, 4, '#a0a0a0');
  _rect(ctx, 5, 1, 3, 1, '#c0c0c0');
  _rect(ctx, 5, 6, 3, 1, '#808080');
  _px(ctx, 3, 3, '#c0c0c0'); _px(ctx, 3, 4, '#c0c0c0');
}


function _weaponSprite_spear(ctx) {
  // Длинное копьё: древко + наконечник
  _vline(ctx, 8, 4, 11, '#8b4513'); // древко
  _px(ctx, 7, 2, '#a0a0a0'); _px(ctx, 8, 1, '#c0c0c0');
  _px(ctx, 9, 2, '#a0a0a0'); _px(ctx, 8, 2, '#c0c0c0');
  _px(ctx, 8, 3, '#a0a0a0'); // наконечник
}

function _weaponSprite_hammer(ctx) {
  // Голова молота + рукоять
  _rect(ctx, 4, 2, 8, 5, '#808080'); // голова
  _rect(ctx, 5, 3, 6, 3, '#a0a0a0');
  _vline(ctx, 8, 7, 8, '#8b4513'); // рукоять
  _vline(ctx, 7, 7, 8, '#6b3510');
}

function _weaponSprite_whip(ctx) {
  // Изогнутая плеть
  _px(ctx, 7, 12, '#8b4513'); _px(ctx, 7, 13, '#8b4513');
  _px(ctx, 7, 14, '#6b3510'); _px(ctx, 8, 14, '#6b3510');
  // плеть (изогнутая)
  _px(ctx, 7, 11, '#a0a0a0'); _px(ctx, 6, 10, '#a0a0a0');
  _px(ctx, 5, 9, '#a0a0a0'); _px(ctx, 6, 8, '#a0a0a0');
  _px(ctx, 7, 7, '#a0a0a0'); _px(ctx, 8, 6, '#a0a0a0');
  _px(ctx, 9, 5, '#a0a0a0'); _px(ctx, 10, 4, '#a0a0a0');
  _px(ctx, 11, 3, '#c0c0c0'); _px(ctx, 12, 2, '#c0c0c0');
}

function _weaponSprite_crossbow(ctx) {
  // Арбалет: ложе + механизм + болт
  _hline(ctx, 3, 8, 10, '#8b4513'); // ложе
  _hline(ctx, 3, 9, 10, '#6b3510');
  // дуга
  _px(ctx, 3, 5, '#808080'); _px(ctx, 3, 6, '#808080');
  _px(ctx, 3, 7, '#808080'); _px(ctx, 3, 10, '#808080');
  _px(ctx, 3, 11, '#808080');
  // болт
  _hline(ctx, 5, 7, 8, '#f4d03f');
  _px(ctx, 13, 7, '#c0c0c0'); // наконечник
  // механизм
  _px(ctx, 10, 7, '#666'); _px(ctx, 11, 6, '#666');
}


function _weaponSprite_throwing_axes(ctx) {
  // Два маленьких топорика
  // Топор 1
  _rect(ctx, 3, 3, 3, 3, '#a0a0a0');
  _vline(ctx, 4, 6, 3, '#8b4513');
  // Топор 2
  _rect(ctx, 10, 5, 3, 3, '#a0a0a0');
  _vline(ctx, 11, 8, 3, '#8b4513');
}

function _weaponSprite_darts(ctx) {
  // Три тонкие линии веером
  _px(ctx, 5, 10, '#f4d03f'); _px(ctx, 6, 9, '#f4d03f');
  _px(ctx, 7, 8, '#f4d03f'); _px(ctx, 8, 7, '#f4d03f');
  _px(ctx, 9, 6, '#f4d03f'); _px(ctx, 10, 5, '#c0c0c0');
  // 2-й
  _px(ctx, 7, 11, '#f4d03f'); _px(ctx, 8, 10, '#f4d03f');
  _px(ctx, 9, 9, '#f4d03f'); _px(ctx, 10, 8, '#f4d03f');
  _px(ctx, 11, 7, '#f4d03f'); _px(ctx, 12, 6, '#c0c0c0');
  // 3-й
  _px(ctx, 9, 12, '#f4d03f'); _px(ctx, 10, 11, '#f4d03f');
  _px(ctx, 11, 10, '#f4d03f'); _px(ctx, 12, 9, '#f4d03f');
  _px(ctx, 13, 8, '#f4d03f'); _px(ctx, 14, 7, '#c0c0c0');
}

function _weaponSprite_sling(ctx) {
  // Кожаный ремешок + камень
  _px(ctx, 5, 6, '#8b4513'); _px(ctx, 6, 5, '#8b4513');
  _px(ctx, 7, 5, '#8b4513'); _px(ctx, 8, 6, '#8b4513');
  _px(ctx, 9, 7, '#8b4513'); _px(ctx, 10, 8, '#8b4513');
  _px(ctx, 11, 9, '#8b4513'); _px(ctx, 12, 10, '#8b4513');
  // петля
  _px(ctx, 4, 7, '#a0522d'); _px(ctx, 4, 8, '#a0522d');
  _px(ctx, 5, 8, '#a0522d'); _px(ctx, 5, 7, '#a0522d');
  // камень в центре
  _rect(ctx, 6, 7, 3, 3, '#808080');
  _px(ctx, 7, 8, '#a0a0a0');
}


function _weaponSprite_ice_arrow(ctx) {
  // Голубая стрела с кристаллическим наконечником
  _hline(ctx, 3, 8, 8, '#6ec6ff'); // древко
  // кристаллический наконечник (ромб)
  _px(ctx, 12, 8, '#aaeeff'); _px(ctx, 13, 7, '#ffffff');
  _px(ctx, 13, 9, '#ffffff'); _px(ctx, 14, 8, '#ffffff');
  // оперение
  _px(ctx, 3, 7, '#4488cc'); _px(ctx, 3, 9, '#4488cc');
  _px(ctx, 2, 6, '#4488cc'); _px(ctx, 2, 10, '#4488cc');
}

function _weaponSprite_chain_lightning(ctx) {
  // Жёлтая зигзагообразная молния
  _px(ctx, 4, 2, '#ffff00'); _px(ctx, 5, 3, '#ffff00');
  _px(ctx, 6, 4, '#ffff00'); _px(ctx, 5, 5, '#ffff80');
  _px(ctx, 6, 6, '#ffff00'); _px(ctx, 7, 7, '#ffff00');
  _px(ctx, 8, 8, '#ffff80'); _px(ctx, 7, 9, '#ffff00');
  _px(ctx, 8, 10, '#ffff00'); _px(ctx, 9, 11, '#ffff00');
  _px(ctx, 10, 12, '#ffff80'); _px(ctx, 9, 13, '#ffff00');
  // свечение
  _px(ctx, 3, 2, '#ffffff'); _px(ctx, 11, 12, '#ffffff');
  _px(ctx, 5, 6, '#ffffff'); _px(ctx, 9, 8, '#ffffff');
}

function _weaponSprite_poison_cloud(ctx) {
  // Зелёные облака
  _rect(ctx, 5, 6, 3, 3, '#2ecc40');
  _rect(ctx, 8, 5, 4, 4, '#44ff44');
  _rect(ctx, 6, 9, 5, 3, '#2ecc40');
  _px(ctx, 4, 5, '#66ff66'); _px(ctx, 12, 7, '#66ff66');
  // капли
  _px(ctx, 7, 12, '#2ecc40'); _px(ctx, 9, 13, '#2ecc40');
  _px(ctx, 5, 13, '#44ff44');
}

function _weaponSprite_spellbook(ctx) {
  // Открытая книга с руной
  _rect(ctx, 3, 4, 5, 8, '#8b4513'); // левая обложка
  _rect(ctx, 8, 4, 5, 8, '#6b3510'); // правая обложка
  _rect(ctx, 4, 5, 4, 6, '#ffffff'); // левая страница
  _rect(ctx, 8, 5, 4, 6, '#f0f0f0'); // правая страница
  // руна (фиолетовая)
  _px(ctx, 9, 6, '#8b00ff'); _px(ctx, 10, 7, '#8b00ff');
  _px(ctx, 9, 8, '#8b00ff'); _px(ctx, 10, 9, '#8b00ff');
  _px(ctx, 11, 7, '#cc66ff');
  // корешок
  _vline(ctx, 7, 4, 8, '#4a2a0a');
}


function _weaponSprite_firestorm(ctx) {
  // Огненный столб
  _rect(ctx, 6, 8, 4, 6, '#ff4500');
  _rect(ctx, 7, 6, 2, 2, '#ff8c00');
  _px(ctx, 7, 5, '#ffaa00'); _px(ctx, 8, 4, '#ffdd00');
  _px(ctx, 8, 3, '#ffff00');
  // искры
  _px(ctx, 5, 7, '#ff6600'); _px(ctx, 10, 6, '#ff6600');
  _px(ctx, 4, 10, '#ffaa00'); _px(ctx, 11, 9, '#ffaa00');
  _px(ctx, 6, 14, '#ff8c00'); _px(ctx, 9, 14, '#ff8c00');
}

function _weaponSprite_holy_aura(ctx) {
  // Золотое кольцо + белый крест
  // кольцо
  _px(ctx, 7, 2, '#ffd700'); _px(ctx, 8, 2, '#ffd700');
  _px(ctx, 5, 3, '#ffd700'); _px(ctx, 10, 3, '#ffd700');
  _px(ctx, 4, 5, '#ffd700'); _px(ctx, 11, 5, '#ffd700');
  _px(ctx, 4, 8, '#ffd700'); _px(ctx, 11, 8, '#ffd700');
  _px(ctx, 5, 10, '#ffd700'); _px(ctx, 10, 10, '#ffd700');
  _px(ctx, 7, 11, '#ffd700'); _px(ctx, 8, 11, '#ffd700');
  // крест белый
  _vline(ctx, 7, 5, 4, '#ffffff'); _vline(ctx, 8, 5, 4, '#ffffff');
  _hline(ctx, 6, 7, 4, '#ffffff');
}

function _weaponSprite_spike_ring(ctx) {
  // Кольцо из шипов
  // кольцо (серое)
  _px(ctx, 7, 4, '#808080'); _px(ctx, 8, 4, '#808080');
  _px(ctx, 5, 5, '#808080'); _px(ctx, 10, 5, '#808080');
  _px(ctx, 4, 7, '#808080'); _px(ctx, 11, 7, '#808080');
  _px(ctx, 5, 9, '#808080'); _px(ctx, 10, 9, '#808080');
  _px(ctx, 7, 10, '#808080'); _px(ctx, 8, 10, '#808080');
  // шипы (треугольники наружу)
  _px(ctx, 7, 2, '#c0c0c0'); _px(ctx, 8, 2, '#c0c0c0'); _px(ctx, 7, 1, '#a0a0a0');
  _px(ctx, 12, 7, '#c0c0c0'); _px(ctx, 13, 7, '#a0a0a0');
  _px(ctx, 7, 12, '#c0c0c0'); _px(ctx, 8, 12, '#c0c0c0'); _px(ctx, 7, 13, '#a0a0a0');
  _px(ctx, 3, 7, '#c0c0c0'); _px(ctx, 2, 7, '#a0a0a0');
}

function _weaponSprite_earthquake(ctx) {
  // Коричневые трещины расходящиеся
  _px(ctx, 8, 7, '#8b4513'); _px(ctx, 7, 8, '#8b4513');
  // трещина вверх-лево
  _px(ctx, 7, 6, '#6b3510'); _px(ctx, 6, 5, '#6b3510'); _px(ctx, 5, 4, '#4a2a0a');
  // трещина вверх-право
  _px(ctx, 9, 6, '#6b3510'); _px(ctx, 10, 5, '#6b3510'); _px(ctx, 11, 4, '#4a2a0a');
  // трещина вниз-лево
  _px(ctx, 6, 9, '#6b3510'); _px(ctx, 5, 10, '#6b3510'); _px(ctx, 4, 11, '#4a2a0a');
  // трещина вниз-право
  _px(ctx, 9, 9, '#6b3510'); _px(ctx, 10, 10, '#6b3510'); _px(ctx, 11, 11, '#4a2a0a');
  // центральный камень
  _rect(ctx, 7, 7, 2, 2, '#a0522d');
  // пыль
  _px(ctx, 4, 3, '#d2b48c'); _px(ctx, 12, 3, '#d2b48c');
  _px(ctx, 3, 12, '#d2b48c'); _px(ctx, 12, 12, '#d2b48c');
}


/* --- 5 Эксклюзивных оружий --- */

function _weaponSprite_lich_blade(ctx) {
  // Чёрный меч с фиолетовым свечением, корона на рукояти
  _vline(ctx, 8, 1, 10, '#1a1a2a'); // чёрное лезвие
  _vline(ctx, 9, 1, 10, '#0d0d1a');
  _px(ctx, 8, 1, '#8b00ff'); // фиолет кончик
  _px(ctx, 7, 3, '#6600cc'); _px(ctx, 10, 3, '#6600cc'); // свечение
  _px(ctx, 7, 6, '#8b00ff'); _px(ctx, 10, 6, '#8b00ff');
  _hline(ctx, 6, 11, 5, '#ffd700'); // гарда-корона
  _px(ctx, 6, 10, '#ffd700'); _px(ctx, 10, 10, '#ffd700');
  _vline(ctx, 8, 12, 3, '#333'); // рукоять
}

function _weaponSprite_phoenix_bow(ctx) {
  // Золотой лук с огнём
  _px(ctx, 5, 3, '#ffd700'); _px(ctx, 4, 4, '#ffd700');
  _px(ctx, 3, 5, '#ffd700'); _px(ctx, 3, 6, '#ffd700');
  _px(ctx, 3, 7, '#ffd700'); _px(ctx, 3, 8, '#ffd700');
  _px(ctx, 3, 9, '#ffd700'); _px(ctx, 4, 10, '#ffd700');
  _px(ctx, 5, 11, '#ffd700');
  // огонь по краям
  _px(ctx, 5, 2, '#ff4500'); _px(ctx, 2, 5, '#ff6600');
  _px(ctx, 2, 9, '#ff6600'); _px(ctx, 5, 12, '#ff4500');
  // тетива
  _vline(ctx, 5, 4, 7, '#ffffff');
  // перо феникса
  _px(ctx, 7, 7, '#ff8c00'); _px(ctx, 8, 7, '#ffaa00');
  _px(ctx, 9, 6, '#ff4500'); _px(ctx, 10, 7, '#ff6600');
}

function _weaponSprite_archmage_staff(ctx) {
  // Фиолетовый посох с кристаллом
  _vline(ctx, 8, 4, 11, '#6a0dad'); // посох
  _vline(ctx, 7, 5, 10, '#4b0082');
  // кристалл на вершине
  _px(ctx, 7, 2, '#cc66ff'); _px(ctx, 8, 2, '#cc66ff');
  _px(ctx, 7, 3, '#cc66ff'); _px(ctx, 8, 3, '#cc66ff');
  _px(ctx, 8, 1, '#ffffff'); // сияние
  _px(ctx, 6, 1, '#ffffff'); _px(ctx, 9, 1, '#ffffff');
  _px(ctx, 7, 0, '#ffffff');
}

function _weaponSprite_beast_claw(ctx) {
  // Три красные царапины + капли крови
  _vline(ctx, 5, 2, 10, '#cc0000');
  _vline(ctx, 8, 3, 9, '#cc0000');
  _vline(ctx, 11, 2, 10, '#cc0000');
  // капли крови
  _px(ctx, 5, 13, '#8b0000'); _px(ctx, 8, 13, '#8b0000');
  _px(ctx, 11, 13, '#8b0000');
  _px(ctx, 6, 14, '#660000');
  // блики на царапинах
  _px(ctx, 5, 4, '#ff3333'); _px(ctx, 8, 5, '#ff3333');
  _px(ctx, 11, 4, '#ff3333');
}

function _weaponSprite_rune_shield(ctx) {
  // Синий круглый щит с белой руной
  _rect(ctx, 4, 4, 8, 8, '#1a4a8a');
  _rect(ctx, 5, 3, 6, 10, '#1a4a8a');
  _rect(ctx, 3, 5, 10, 6, '#1a4a8a');
  // обод
  _px(ctx, 5, 3, '#4488cc'); _px(ctx, 10, 3, '#4488cc');
  _px(ctx, 3, 5, '#4488cc'); _px(ctx, 12, 5, '#4488cc');
  _px(ctx, 3, 10, '#4488cc'); _px(ctx, 12, 10, '#4488cc');
  _px(ctx, 5, 12, '#4488cc'); _px(ctx, 10, 12, '#4488cc');
  // белая руна (зигзаг)
  _px(ctx, 6, 5, '#ffffff'); _px(ctx, 7, 6, '#ffffff');
  _px(ctx, 8, 7, '#ffffff'); _px(ctx, 9, 6, '#ffffff');
  _px(ctx, 8, 8, '#ffffff'); _px(ctx, 7, 9, '#ffffff');
  _px(ctx, 8, 10, '#ffffff');
}


/* --- Реестр оружий --- */
const WEAPON_SPRITE_REGISTRY = {
  sword: _weaponSprite_sword,
  bow: _weaponSprite_bow,
  daggers: _weaponSprite_daggers,
  fireball: _weaponSprite_fireball,
  axe: _weaponSprite_axe,
  spear: _weaponSprite_spear,
  hammer: _weaponSprite_hammer,
  whip: _weaponSprite_whip,
  crossbow: _weaponSprite_crossbow,
  throwing_axes: _weaponSprite_throwing_axes,
  darts: _weaponSprite_darts,
  sling: _weaponSprite_sling,
  ice_arrow: _weaponSprite_ice_arrow,
  chain_lightning: _weaponSprite_chain_lightning,
  poison_cloud: _weaponSprite_poison_cloud,
  spellbook: _weaponSprite_spellbook,
  firestorm: _weaponSprite_firestorm,
  holy_aura: _weaponSprite_holy_aura,
  spike_ring: _weaponSprite_spike_ring,
  earthquake: _weaponSprite_earthquake,
  lich_blade: _weaponSprite_lich_blade,
  phoenix_bow: _weaponSprite_phoenix_bow,
  archmage_staff: _weaponSprite_archmage_staff,
  beast_claw: _weaponSprite_beast_claw,
  rune_shield: _weaponSprite_rune_shield,
};

/** Генерирует спрайт оружия 16x16. */
function generateWeaponSprite(weaponId) {
  const fn = WEAPON_SPRITE_REGISTRY[weaponId];
  if (!fn) return null;
  const c = _createSpriteCanvas(16);
  const ctx = c.getContext('2d');
  fn(ctx);
  return c;
}


/* ============================================================
   ГЕНЕРАТОРЫ СПРАЙТОВ ПАССИВОК (16x16)
   ============================================================ */

function _abilitySprite_haste(ctx) {
  // Зелёная стрелка вверх + линии скорости
  _px(ctx, 8, 3, '#00cc00'); _px(ctx, 7, 4, '#00cc00'); _px(ctx, 9, 4, '#00cc00');
  _px(ctx, 6, 5, '#00cc00'); _px(ctx, 10, 5, '#00cc00');
  _rect(ctx, 7, 5, 3, 7, '#00cc00');
  // линии скорости
  _hline(ctx, 3, 7, 3, '#66ff66'); _hline(ctx, 3, 9, 2, '#66ff66');
  _hline(ctx, 11, 8, 2, '#66ff66');
}

function _abilitySprite_regen(ctx) {
  // Красный крест + зелёное свечение
  _rect(ctx, 7, 4, 2, 8, '#ff3333');
  _rect(ctx, 5, 6, 6, 2, '#ff3333');
  // зелёное свечение
  _px(ctx, 4, 4, '#44ff44'); _px(ctx, 11, 4, '#44ff44');
  _px(ctx, 4, 10, '#44ff44'); _px(ctx, 11, 10, '#44ff44');
  _px(ctx, 5, 5, '#66ff66'); _px(ctx, 10, 5, '#66ff66');
}

function _abilitySprite_power(ctx) {
  // Красный меч + жёлтая стрелка вверх
  _vline(ctx, 6, 4, 8, '#cc0000'); _vline(ctx, 7, 4, 8, '#990000');
  _hline(ctx, 5, 10, 4, '#cc0000');
  // стрелка вверх
  _px(ctx, 11, 4, '#ffdd00'); _px(ctx, 10, 5, '#ffdd00');
  _px(ctx, 12, 5, '#ffdd00'); _vline(ctx, 11, 5, 5, '#ffdd00');
}

function _abilitySprite_magnet(ctx) {
  // Синий магнит (подкова) + зелёные точки
  _vline(ctx, 4, 4, 6, '#2244cc');
  _vline(ctx, 5, 4, 6, '#2244cc');
  _vline(ctx, 10, 4, 6, '#2244cc');
  _vline(ctx, 11, 4, 6, '#2244cc');
  _hline(ctx, 5, 3, 6, '#4466ff');
  _hline(ctx, 5, 2, 6, '#4466ff');
  // красные наконечники
  _px(ctx, 4, 10, '#cc0000'); _px(ctx, 5, 10, '#cc0000');
  _px(ctx, 10, 10, '#cc0000'); _px(ctx, 11, 10, '#cc0000');
  // зелёные точки XP
  _px(ctx, 7, 11, '#44ff44'); _px(ctx, 8, 12, '#44ff44');
  _px(ctx, 9, 11, '#44ff44');
}


function _abilitySprite_armor(ctx) {
  // Серый щит с металлической окантовкой
  _rect(ctx, 5, 3, 6, 8, '#808080');
  _rect(ctx, 6, 2, 4, 1, '#a0a0a0');
  _rect(ctx, 6, 11, 4, 1, '#808080');
  _px(ctx, 7, 12, '#666'); _px(ctx, 8, 12, '#666');
  // обод
  _vline(ctx, 4, 4, 6, '#c0c0c0'); _vline(ctx, 11, 4, 6, '#c0c0c0');
  _px(ctx, 5, 3, '#c0c0c0'); _px(ctx, 10, 3, '#c0c0c0');
  // центральная полоса
  _vline(ctx, 7, 4, 7, '#a0a0a0'); _vline(ctx, 8, 4, 7, '#a0a0a0');
}

function _abilitySprite_mana_shield(ctx) {
  // Голубой пузырь с белой искрой
  _rect(ctx, 5, 4, 6, 7, '#4488cc');
  _rect(ctx, 4, 5, 8, 5, '#4488cc');
  _rect(ctx, 6, 3, 4, 1, '#66aaee');
  _rect(ctx, 6, 11, 4, 1, '#4488cc');
  // блик
  _px(ctx, 6, 5, '#aaddff'); _px(ctx, 7, 4, '#aaddff');
  // белая искра внутри
  _px(ctx, 7, 7, '#ffffff'); _px(ctx, 8, 7, '#ffffff');
  _px(ctx, 7, 8, '#ffffff');
}

function _abilitySprite_fortify(ctx) {
  // Красное сердце с + внутри
  _px(ctx, 5, 4, '#ff3333'); _px(ctx, 6, 3, '#ff3333');
  _px(ctx, 7, 4, '#ff3333'); _px(ctx, 8, 4, '#ff3333');
  _px(ctx, 9, 3, '#ff3333'); _px(ctx, 10, 4, '#ff3333');
  _rect(ctx, 4, 5, 8, 4, '#ff3333');
  _rect(ctx, 5, 9, 6, 2, '#ff3333');
  _rect(ctx, 6, 11, 4, 1, '#ff3333');
  _px(ctx, 7, 12, '#cc0000'); _px(ctx, 8, 12, '#cc0000');
  // + внутри
  _px(ctx, 7, 6, '#ffffff'); _px(ctx, 8, 6, '#ffffff');
  _px(ctx, 7, 7, '#ffffff'); _px(ctx, 8, 7, '#ffffff');
  _px(ctx, 6, 7, '#ffffff'); _px(ctx, 9, 7, '#ffffff');
}

function _abilitySprite_resistance(ctx) {
  // Жёлтый крест + стрелки
  _rect(ctx, 7, 4, 2, 8, '#ffdd00');
  _rect(ctx, 5, 6, 6, 2, '#ffdd00');
  // стрелки в стороны
  _px(ctx, 3, 7, '#ffaa00'); _px(ctx, 2, 7, '#ffaa00');
  _px(ctx, 12, 7, '#ffaa00'); _px(ctx, 13, 7, '#ffaa00');
  _px(ctx, 8, 2, '#ffaa00'); _px(ctx, 8, 13, '#ffaa00');
}


function _abilitySprite_bloodlust(ctx) {
  // Красный клык + капля крови
  _px(ctx, 7, 3, '#ffffff'); _px(ctx, 8, 4, '#ffffff');
  _px(ctx, 7, 5, '#ffffff'); _px(ctx, 7, 6, '#ffffff');
  _px(ctx, 7, 7, '#ffffff'); _px(ctx, 8, 3, '#ffffff');
  _px(ctx, 9, 4, '#ffffff'); _px(ctx, 9, 5, '#ffffff');
  _px(ctx, 9, 6, '#ffffff');
  // фон рта
  _rect(ctx, 5, 8, 6, 3, '#cc0000');
  // капля крови
  _px(ctx, 8, 11, '#8b0000'); _px(ctx, 8, 12, '#8b0000');
  _px(ctx, 7, 12, '#660000'); _px(ctx, 9, 12, '#660000');
  _px(ctx, 8, 13, '#660000');
}

function _abilitySprite_crit_strike(ctx) {
  // Жёлтая молния + красная вспышка
  _px(ctx, 8, 2, '#ffff00'); _px(ctx, 7, 3, '#ffff00');
  _px(ctx, 8, 4, '#ffff00'); _px(ctx, 9, 5, '#ffff00');
  _px(ctx, 7, 6, '#ffff00'); _px(ctx, 6, 7, '#ffff00');
  _px(ctx, 7, 8, '#ffff00'); _px(ctx, 8, 9, '#ffff00');
  _px(ctx, 9, 10, '#ffff00'); _px(ctx, 8, 11, '#ffff00');
  // красная вспышка
  _px(ctx, 5, 5, '#ff3333'); _px(ctx, 10, 5, '#ff3333');
  _px(ctx, 5, 9, '#ff3333'); _px(ctx, 10, 9, '#ff3333');
}

function _abilitySprite_bleed(ctx) {
  // Три красные капли стекающие вниз
  // капля 1
  _px(ctx, 4, 4, '#cc0000'); _px(ctx, 4, 5, '#cc0000');
  _px(ctx, 3, 6, '#cc0000'); _px(ctx, 5, 6, '#cc0000');
  _px(ctx, 4, 7, '#8b0000');
  // капля 2
  _px(ctx, 8, 5, '#cc0000'); _px(ctx, 8, 6, '#cc0000');
  _px(ctx, 7, 7, '#cc0000'); _px(ctx, 9, 7, '#cc0000');
  _px(ctx, 8, 8, '#8b0000');
  // капля 3
  _px(ctx, 11, 7, '#cc0000'); _px(ctx, 11, 8, '#cc0000');
  _px(ctx, 10, 9, '#cc0000'); _px(ctx, 12, 9, '#cc0000');
  _px(ctx, 11, 10, '#8b0000');
}

function _abilitySprite_explosive_death(ctx) {
  // Оранжевый взрыв (звезда) + линии
  _rect(ctx, 6, 6, 4, 4, '#ff6600');
  _px(ctx, 7, 7, '#ffff00'); _px(ctx, 8, 7, '#ffff00');
  // лучи
  _px(ctx, 8, 3, '#ff8c00'); _px(ctx, 8, 4, '#ff8c00');
  _px(ctx, 8, 11, '#ff8c00'); _px(ctx, 8, 12, '#ff8c00');
  _px(ctx, 3, 7, '#ff8c00'); _px(ctx, 4, 7, '#ff8c00');
  _px(ctx, 11, 7, '#ff8c00'); _px(ctx, 12, 7, '#ff8c00');
  // диагонали
  _px(ctx, 5, 4, '#ffaa00'); _px(ctx, 11, 4, '#ffaa00');
  _px(ctx, 5, 10, '#ffaa00'); _px(ctx, 11, 10, '#ffaa00');
}


function _abilitySprite_quick_fingers(ctx) {
  // Фиолетовая рука с линиями скорости
  _rect(ctx, 6, 6, 5, 5, '#8b00ff');
  _px(ctx, 6, 5, '#8b00ff'); _px(ctx, 7, 4, '#8b00ff');
  _px(ctx, 8, 3, '#8b00ff'); _px(ctx, 9, 4, '#8b00ff');
  _px(ctx, 10, 5, '#8b00ff');
  // пальцы
  _px(ctx, 6, 4, '#cc66ff'); _px(ctx, 10, 4, '#cc66ff');
  // линии скорости
  _hline(ctx, 2, 6, 3, '#cc99ff'); _hline(ctx, 2, 8, 2, '#cc99ff');
  _hline(ctx, 12, 7, 2, '#cc99ff');
}

function _abilitySprite_frost_aura(ctx) {
  // Голубая снежинка
  _vline(ctx, 8, 3, 10, '#88ccff'); // вертикаль
  _hline(ctx, 3, 8, 10, '#88ccff'); // горизонталь
  // диагонали
  _px(ctx, 5, 5, '#aaeeff'); _px(ctx, 11, 5, '#aaeeff');
  _px(ctx, 5, 11, '#aaeeff'); _px(ctx, 11, 11, '#aaeeff');
  // точки
  _px(ctx, 6, 4, '#ffffff'); _px(ctx, 10, 4, '#ffffff');
  _px(ctx, 6, 12, '#ffffff'); _px(ctx, 10, 12, '#ffffff');
  // обводка
  _px(ctx, 4, 8, '#ffffff'); _px(ctx, 12, 8, '#ffffff');
  _px(ctx, 8, 2, '#ffffff'); _px(ctx, 8, 13, '#ffffff');
}

function _abilitySprite_magic_boost(ctx) {
  // Фиолетовая звезда + магическая искра
  _px(ctx, 8, 2, '#8b00ff'); // верх
  _px(ctx, 6, 5, '#8b00ff'); _px(ctx, 10, 5, '#8b00ff');
  _px(ctx, 4, 9, '#8b00ff'); _px(ctx, 12, 9, '#8b00ff');
  _px(ctx, 7, 7, '#cc66ff'); _px(ctx, 8, 7, '#cc66ff');
  _px(ctx, 9, 7, '#cc66ff'); _px(ctx, 8, 6, '#cc66ff');
  _px(ctx, 8, 8, '#cc66ff');
  _px(ctx, 6, 11, '#8b00ff'); _px(ctx, 10, 11, '#8b00ff');
  // искра
  _px(ctx, 8, 4, '#ffffff'); _px(ctx, 7, 5, '#ffffff');
}

function _abilitySprite_magic_echo(ctx) {
  // Фиолетовые концентрические дуги
  _px(ctx, 6, 7, '#8b00ff'); _px(ctx, 7, 6, '#8b00ff');
  _px(ctx, 7, 8, '#8b00ff');
  // 2-я дуга
  _px(ctx, 4, 7, '#6600cc'); _px(ctx, 5, 5, '#6600cc');
  _px(ctx, 5, 9, '#6600cc');
  // 3-я дуга
  _px(ctx, 2, 7, '#4400aa'); _px(ctx, 3, 4, '#4400aa');
  _px(ctx, 3, 10, '#4400aa');
  // стрелка наружу
  _px(ctx, 10, 7, '#cc66ff'); _px(ctx, 11, 7, '#cc66ff');
  _px(ctx, 12, 7, '#cc66ff'); _px(ctx, 13, 7, '#cc66ff');
  _px(ctx, 12, 6, '#cc66ff'); _px(ctx, 12, 8, '#cc66ff');
}


function _abilitySprite_lucky(ctx) {
  // Золотой кубик d20 (шестиугольник с "20")
  _rect(ctx, 4, 4, 8, 8, '#ffd700');
  _rect(ctx, 5, 3, 6, 1, '#ffaa00');
  _rect(ctx, 5, 12, 6, 1, '#cc8800');
  _px(ctx, 4, 4, '#ffaa00'); _px(ctx, 11, 4, '#ffaa00');
  _px(ctx, 4, 11, '#cc8800'); _px(ctx, 11, 11, '#cc8800');
  // "20" внутри
  _px(ctx, 6, 6, '#4a2a0a'); _px(ctx, 7, 6, '#4a2a0a');
  _px(ctx, 7, 7, '#4a2a0a'); _px(ctx, 6, 8, '#4a2a0a');
  _px(ctx, 6, 9, '#4a2a0a'); _px(ctx, 7, 9, '#4a2a0a');
  _px(ctx, 9, 6, '#4a2a0a'); _px(ctx, 10, 6, '#4a2a0a');
  _px(ctx, 9, 7, '#4a2a0a'); _px(ctx, 10, 7, '#4a2a0a');
  _px(ctx, 9, 8, '#4a2a0a'); _px(ctx, 10, 8, '#4a2a0a');
  _px(ctx, 9, 9, '#4a2a0a'); _px(ctx, 10, 9, '#4a2a0a');
}

function _abilitySprite_double_xp(ctx) {
  // Зелёный "x2" + кристалл
  // x
  _px(ctx, 4, 5, '#44ff44'); _px(ctx, 6, 5, '#44ff44');
  _px(ctx, 5, 6, '#44ff44'); _px(ctx, 5, 7, '#44ff44');
  _px(ctx, 4, 8, '#44ff44'); _px(ctx, 6, 8, '#44ff44');
  // 2
  _px(ctx, 8, 5, '#44ff44'); _px(ctx, 9, 5, '#44ff44');
  _px(ctx, 10, 5, '#44ff44'); _px(ctx, 10, 6, '#44ff44');
  _px(ctx, 9, 7, '#44ff44'); _px(ctx, 8, 8, '#44ff44');
  _px(ctx, 8, 9, '#44ff44'); _px(ctx, 9, 9, '#44ff44');
  _px(ctx, 10, 9, '#44ff44');
  // кристалл
  _px(ctx, 12, 10, '#66ff66'); _px(ctx, 12, 11, '#66ff66');
  _px(ctx, 11, 11, '#44cc44'); _px(ctx, 13, 11, '#44cc44');
}

function _abilitySprite_alchemist(ctx) {
  // Зелёная колба + пузырьки
  _rect(ctx, 6, 8, 4, 4, '#2ecc40');
  _rect(ctx, 5, 9, 6, 3, '#2ecc40');
  _rect(ctx, 7, 6, 2, 2, '#2ecc40');
  // горлышко
  _vline(ctx, 7, 4, 2, '#a0a0a0'); _vline(ctx, 8, 4, 2, '#a0a0a0');
  _hline(ctx, 7, 3, 2, '#c0c0c0'); // пробка
  // пузырьки
  _px(ctx, 6, 10, '#66ff66'); _px(ctx, 8, 9, '#aaffaa');
  _px(ctx, 9, 11, '#66ff66');
  // пар
  _px(ctx, 6, 2, '#88ff88'); _px(ctx, 9, 1, '#88ff88');
}

function _abilitySprite_magnet_plus(ctx) {
  // Синий магнит + жёлтая монета
  _vline(ctx, 3, 4, 6, '#2244cc');
  _vline(ctx, 4, 4, 6, '#2244cc');
  _vline(ctx, 8, 4, 6, '#2244cc');
  _vline(ctx, 9, 4, 6, '#2244cc');
  _hline(ctx, 4, 3, 5, '#4466ff');
  // красные наконечники
  _px(ctx, 3, 10, '#cc0000'); _px(ctx, 4, 10, '#cc0000');
  _px(ctx, 8, 10, '#cc0000'); _px(ctx, 9, 10, '#cc0000');
  // жёлтая монета
  _rect(ctx, 11, 8, 3, 3, '#ffd700');
  _px(ctx, 12, 9, '#ffaa00');
  // линии притяжения
  _px(ctx, 10, 9, '#ffdd00');
}


/* --- Реестр пассивок --- */
const ABILITY_SPRITE_REGISTRY = {
  haste: _abilitySprite_haste,
  regen: _abilitySprite_regen,
  power: _abilitySprite_power,
  magnet: _abilitySprite_magnet,
  armor: _abilitySprite_armor,
  mana_shield: _abilitySprite_mana_shield,
  fortify: _abilitySprite_fortify,
  resistance: _abilitySprite_resistance,
  bloodlust: _abilitySprite_bloodlust,
  crit_strike: _abilitySprite_crit_strike,
  bleed: _abilitySprite_bleed,
  explosive_death: _abilitySprite_explosive_death,
  quick_fingers: _abilitySprite_quick_fingers,
  frost_aura: _abilitySprite_frost_aura,
  magic_boost: _abilitySprite_magic_boost,
  magic_echo: _abilitySprite_magic_echo,
  lucky: _abilitySprite_lucky,
  double_xp: _abilitySprite_double_xp,
  alchemist: _abilitySprite_alchemist,
  magnet_plus: _abilitySprite_magnet_plus,
};

/** Генерирует спрайт пассивки 16x16. */
function generateAbilitySprite(abilityId) {
  const fn = ABILITY_SPRITE_REGISTRY[abilityId];
  if (!fn) return null;
  const c = _createSpriteCanvas(16);
  const ctx = c.getContext('2d');
  fn(ctx);
  return c;
}


/* ============================================================
   ГЕНЕРАТОРЫ СПРАЙТОВ ЭВОЛЮЦИЙ (16x16)
   Каждая эволюция — уникальная иконка, объединяющая элементы
   базового оружия и пассивки.
   ============================================================ */

function _evoSprite_vampire_blade(ctx) {
  // Меч с красным клыком на лезвии
  _vline(ctx, 8, 1, 10, '#c0c0c0');
  _px(ctx, 8, 1, '#ff3333'); _px(ctx, 9, 2, '#ff3333'); // кровь на кончике
  _px(ctx, 7, 4, '#cc0000'); _px(ctx, 9, 4, '#cc0000'); // клыки
  _hline(ctx, 6, 11, 5, '#8b0000');
  _vline(ctx, 8, 12, 3, '#4a2a0a');
}

function _evoSprite_rapid_bow(ctx) {
  // Лук с тремя стрелами
  _px(ctx, 3, 4, '#8b4513'); _px(ctx, 2, 5, '#8b4513');
  _px(ctx, 2, 6, '#8b4513'); _px(ctx, 2, 7, '#8b4513');
  _px(ctx, 2, 8, '#8b4513'); _px(ctx, 3, 9, '#8b4513');
  _vline(ctx, 3, 5, 4, '#fff');
  // три стрелы
  _hline(ctx, 5, 6, 7, '#f4d03f');
  _hline(ctx, 5, 7, 7, '#f4d03f');
  _hline(ctx, 5, 8, 7, '#f4d03f');
  _px(ctx, 12, 5, '#c0c0c0'); _px(ctx, 12, 7, '#c0c0c0');
  _px(ctx, 12, 9, '#c0c0c0');
}

function _evoSprite_blade_storm(ctx) {
  // Пять кинжалов веером
  _px(ctx, 8, 2, '#c0c0c0'); _px(ctx, 8, 3, '#c0c0c0');
  _px(ctx, 5, 3, '#c0c0c0'); _px(ctx, 6, 4, '#c0c0c0');
  _px(ctx, 11, 3, '#c0c0c0'); _px(ctx, 10, 4, '#c0c0c0');
  _px(ctx, 3, 5, '#c0c0c0'); _px(ctx, 4, 5, '#c0c0c0');
  _px(ctx, 13, 5, '#c0c0c0'); _px(ctx, 12, 5, '#c0c0c0');
  // золотая рукоять в центре
  _rect(ctx, 7, 7, 2, 2, '#ffd700');
}

function _evoSprite_soul_flame(ctx) {
  // Огненный шар с зелёной аурой
  _rect(ctx, 6, 5, 4, 4, '#ff4500');
  _px(ctx, 7, 6, '#ffff00'); _px(ctx, 8, 7, '#ffff00');
  // зелёная аура
  _px(ctx, 4, 4, '#44ff44'); _px(ctx, 11, 4, '#44ff44');
  _px(ctx, 4, 10, '#44ff44'); _px(ctx, 11, 10, '#44ff44');
  _px(ctx, 5, 3, '#66ff66'); _px(ctx, 10, 3, '#66ff66');
}


function _evoSprite_bloodletter(ctx) {
  // Секира с красным свечением
  _rect(ctx, 4, 2, 5, 4, '#a0a0a0');
  _vline(ctx, 8, 5, 8, '#8b4513');
  _px(ctx, 3, 3, '#cc0000'); _px(ctx, 3, 4, '#cc0000');
  _px(ctx, 9, 3, '#cc0000');
}

function _evoSprite_piercer(ctx) {
  // Копьё с золотым свечением
  _vline(ctx, 8, 3, 11, '#8b4513');
  _px(ctx, 8, 1, '#ffd700'); _px(ctx, 8, 2, '#ffd700');
  _px(ctx, 7, 2, '#c0c0c0'); _px(ctx, 9, 2, '#c0c0c0');
  _px(ctx, 7, 4, '#ffdd00'); _px(ctx, 9, 4, '#ffdd00');
}

function _evoSprite_titan_hammer(ctx) {
  // Молот увеличенный с красным сердцем
  _rect(ctx, 3, 2, 10, 5, '#808080');
  _rect(ctx, 4, 3, 8, 3, '#a0a0a0');
  _vline(ctx, 8, 7, 7, '#8b4513');
  _px(ctx, 7, 4, '#ff3333'); _px(ctx, 8, 4, '#ff3333');
}

function _evoSprite_pain_lash(ctx) {
  // Кнут с красным наконечником
  _px(ctx, 7, 12, '#8b4513'); _px(ctx, 7, 13, '#8b4513');
  _px(ctx, 6, 10, '#a0a0a0'); _px(ctx, 5, 9, '#a0a0a0');
  _px(ctx, 6, 8, '#a0a0a0'); _px(ctx, 7, 7, '#a0a0a0');
  _px(ctx, 8, 6, '#a0a0a0'); _px(ctx, 9, 5, '#a0a0a0');
  _px(ctx, 10, 4, '#a0a0a0'); _px(ctx, 11, 3, '#cc0000');
  _px(ctx, 12, 2, '#ff0000');
}

function _evoSprite_executioner(ctx) {
  // Арбалет с кровью
  _hline(ctx, 3, 8, 10, '#8b4513');
  _px(ctx, 3, 6, '#808080'); _px(ctx, 3, 10, '#808080');
  _hline(ctx, 5, 7, 8, '#cc0000'); // кровавый болт
  _px(ctx, 13, 7, '#ff0000');
  _px(ctx, 11, 9, '#8b0000'); _px(ctx, 12, 10, '#8b0000');
}

function _evoSprite_butcher_axes(ctx) {
  // 3 топора
  _rect(ctx, 2, 3, 3, 2, '#a0a0a0'); _vline(ctx, 3, 5, 3, '#8b4513');
  _rect(ctx, 7, 2, 3, 2, '#a0a0a0'); _vline(ctx, 8, 4, 3, '#8b4513');
  _rect(ctx, 11, 3, 3, 2, '#a0a0a0'); _vline(ctx, 12, 5, 3, '#8b4513');
  // крит-молния
  _px(ctx, 8, 9, '#ffff00'); _px(ctx, 7, 10, '#ffff00');
  _px(ctx, 8, 11, '#ffff00');
}

function _evoSprite_needle_storm(ctx) {
  // 5 дротиков плотной очередью
  for (let i = 0; i < 5; i++) {
    _hline(ctx, 3, 4 + i * 2, 9, '#f4d03f');
    _px(ctx, 12, 4 + i * 2, '#c0c0c0');
  }
}

function _evoSprite_meteor_strike(ctx) {
  // Камень падающий с огнём
  _rect(ctx, 6, 6, 4, 4, '#808080');
  _px(ctx, 7, 7, '#a0a0a0');
  // огненный шлейф вверх
  _px(ctx, 7, 4, '#ff6600'); _px(ctx, 8, 3, '#ff8c00');
  _px(ctx, 9, 2, '#ffaa00'); _px(ctx, 7, 2, '#ffdd00');
  // AoE круг снизу
  _px(ctx, 5, 11, '#ff4500'); _px(ctx, 10, 11, '#ff4500');
  _px(ctx, 6, 12, '#ff6600'); _px(ctx, 9, 12, '#ff6600');
}


function _evoSprite_ice_storm(ctx) {
  // Ледяная стрела оставляющая полосу
  _hline(ctx, 3, 7, 8, '#88ccff');
  _px(ctx, 11, 6, '#ffffff'); _px(ctx, 11, 8, '#ffffff');
  _px(ctx, 12, 7, '#ffffff');
  // полоса холода за ней
  _rect(ctx, 3, 9, 7, 2, '#aaeeff');
  _px(ctx, 4, 9, '#ffffff'); _px(ctx, 6, 10, '#ffffff');
}

function _evoSprite_thunder_chain(ctx) {
  // Молния с 5 прыжками
  _px(ctx, 2, 4, '#ffff00'); _px(ctx, 4, 5, '#ffff00');
  _px(ctx, 6, 4, '#ffff00'); _px(ctx, 8, 5, '#ffff00');
  _px(ctx, 10, 4, '#ffff00'); _px(ctx, 12, 5, '#ffff00');
  _px(ctx, 3, 5, '#ffffff'); _px(ctx, 5, 4, '#ffffff');
  _px(ctx, 7, 5, '#ffffff'); _px(ctx, 9, 4, '#ffffff');
  _px(ctx, 11, 5, '#ffffff');
  // зигзаги
  _px(ctx, 3, 8, '#ffff00'); _px(ctx, 5, 9, '#ffff00');
  _px(ctx, 7, 8, '#ffff00'); _px(ctx, 9, 9, '#ffff00');
  _px(ctx, 11, 8, '#ffff00'); _px(ctx, 13, 9, '#ffff00');
}

function _evoSprite_plague_cloud(ctx) {
  // Чумное облако (большое зелёное с черепом)
  _rect(ctx, 3, 5, 10, 7, '#2ecc40');
  _rect(ctx, 4, 4, 8, 1, '#44ff44');
  _rect(ctx, 4, 12, 8, 1, '#2ecc40');
  // мини-череп
  _rect(ctx, 6, 7, 4, 3, '#ffffff');
  _px(ctx, 7, 8, '#000'); _px(ctx, 9, 8, '#000');
  _px(ctx, 8, 9, '#333');
}

function _evoSprite_mad_grimoire(ctx) {
  // Безумная книга (книга с хаотичными снарядами)
  _rect(ctx, 4, 5, 4, 7, '#6b3510');
  _rect(ctx, 8, 5, 4, 7, '#8b4513');
  _vline(ctx, 7, 5, 7, '#333');
  // хаотичные снаряды
  _px(ctx, 2, 3, '#ff4500'); _px(ctx, 12, 3, '#6ec6ff');
  _px(ctx, 3, 10, '#a259ff'); _px(ctx, 13, 10, '#ffff00');
}

function _evoSprite_inferno(ctx) {
  // 5 столбов огня
  for (let i = 0; i < 5; i++) {
    const x = 2 + i * 3;
    _vline(ctx, x, 6, 6, '#ff4500');
    _px(ctx, x, 5, '#ff8c00');
    _px(ctx, x, 4, '#ffdd00');
  }
}

function _evoSprite_martyr_aura(ctx) {
  // Золотое кольцо + крест + красное свечение
  _px(ctx, 7, 2, '#ffd700'); _px(ctx, 8, 2, '#ffd700');
  _px(ctx, 4, 5, '#ffd700'); _px(ctx, 11, 5, '#ffd700');
  _px(ctx, 4, 9, '#ffd700'); _px(ctx, 11, 9, '#ffd700');
  _px(ctx, 7, 12, '#ffd700'); _px(ctx, 8, 12, '#ffd700');
  // крест
  _vline(ctx, 7, 5, 5, '#ffffff'); _hline(ctx, 5, 7, 5, '#ffffff');
  // красное лечение
  _px(ctx, 5, 4, '#ff3333'); _px(ctx, 10, 4, '#ff3333');
}


function _evoSprite_spike_bastion(ctx) {
  // Щит с 6 шипами + броня
  _rect(ctx, 5, 5, 6, 6, '#808080');
  _px(ctx, 8, 3, '#c0c0c0'); _px(ctx, 8, 12, '#c0c0c0');
  _px(ctx, 3, 8, '#c0c0c0'); _px(ctx, 12, 8, '#c0c0c0');
  _px(ctx, 5, 4, '#c0c0c0'); _px(ctx, 10, 4, '#c0c0c0');
  _px(ctx, 7, 7, '#a0a0a0'); _px(ctx, 8, 8, '#a0a0a0');
}

function _evoSprite_tectonic_rift(ctx) {
  // Большие трещины + камни
  _px(ctx, 8, 8, '#8b4513');
  // трещины широкие
  _px(ctx, 7, 6, '#6b3510'); _px(ctx, 6, 4, '#6b3510'); _px(ctx, 5, 2, '#4a2a0a');
  _px(ctx, 9, 6, '#6b3510'); _px(ctx, 10, 4, '#6b3510'); _px(ctx, 11, 2, '#4a2a0a');
  _px(ctx, 6, 10, '#6b3510'); _px(ctx, 5, 12, '#4a2a0a');
  _px(ctx, 10, 10, '#6b3510'); _px(ctx, 11, 12, '#4a2a0a');
  // камни летящие
  _px(ctx, 3, 3, '#808080'); _px(ctx, 12, 3, '#808080');
  _px(ctx, 4, 13, '#808080'); _px(ctx, 12, 13, '#808080');
}

function _evoSprite_hero_blade(ctx) {
  // Яркий меч + стрелка урона
  _vline(ctx, 7, 1, 10, '#ffd700');
  _vline(ctx, 8, 1, 10, '#ccaa00');
  _px(ctx, 7, 1, '#ffffff');
  _hline(ctx, 5, 11, 5, '#ffd700');
  _vline(ctx, 7, 12, 2, '#8b4513');
  // стрелка урона
  _px(ctx, 11, 5, '#ff3333'); _px(ctx, 11, 6, '#ff3333');
  _px(ctx, 12, 4, '#ff3333'); _px(ctx, 10, 4, '#ff3333');
}

function _evoSprite_pyroclasm(ctx) {
  // Огромный огненный взрыв
  _rect(ctx, 5, 5, 6, 6, '#ff4500');
  _rect(ctx, 6, 4, 4, 8, '#ff6600');
  _px(ctx, 7, 7, '#ffffff'); _px(ctx, 8, 7, '#ffffff');
  // лучи
  _px(ctx, 3, 3, '#ff8c00'); _px(ctx, 12, 3, '#ff8c00');
  _px(ctx, 3, 12, '#ff8c00'); _px(ctx, 12, 12, '#ff8c00');
  _px(ctx, 2, 7, '#ffaa00'); _px(ctx, 13, 7, '#ffaa00');
  _px(ctx, 7, 2, '#ffaa00'); _px(ctx, 7, 13, '#ffaa00');
}

function _evoSprite_ice_spike(ctx) {
  // Ледяной шип (кристалл)
  _px(ctx, 8, 2, '#ffffff');
  _rect(ctx, 7, 3, 2, 3, '#aaeeff');
  _rect(ctx, 6, 5, 4, 4, '#88ccff');
  _rect(ctx, 7, 9, 2, 2, '#88ccff');
  // осколки
  _px(ctx, 4, 8, '#aaeeff'); _px(ctx, 11, 6, '#aaeeff');
  _px(ctx, 5, 11, '#88ccff');
}

function _evoSprite_electric_cascade(ctx) {
  // Быстрые молнии
  _px(ctx, 3, 3, '#ffff00'); _px(ctx, 5, 5, '#ffff00');
  _px(ctx, 7, 3, '#ffff00'); _px(ctx, 9, 5, '#ffff00');
  _px(ctx, 11, 3, '#ffff00'); _px(ctx, 13, 5, '#ffff00');
  _px(ctx, 4, 4, '#ffffff'); _px(ctx, 6, 4, '#ffffff');
  _px(ctx, 8, 4, '#ffffff'); _px(ctx, 10, 4, '#ffffff');
  _px(ctx, 12, 4, '#ffffff');
  // линии скорости
  _hline(ctx, 2, 8, 3, '#ffff80'); _hline(ctx, 11, 8, 3, '#ffff80');
}

function _evoSprite_miasma(ctx) {
  // Зелёно-голубое облако
  _rect(ctx, 4, 5, 8, 6, '#2ecc40');
  _rect(ctx, 5, 4, 6, 1, '#44ff44');
  // голубые кристаллы внутри (холод)
  _px(ctx, 6, 7, '#88ccff'); _px(ctx, 9, 8, '#88ccff');
  _px(ctx, 7, 9, '#aaeeff');
  // капли
  _px(ctx, 5, 12, '#2ecc40'); _px(ctx, 10, 12, '#2ecc40');
}


/* --- 5 Супер-эволюций (с золотой аурой/короной) --- */

function _evoSprite_eternal_night_blade(ctx) {
  // Чёрный меч + золотая корона + скелеты
  _vline(ctx, 8, 2, 9, '#1a1a2a');
  _px(ctx, 8, 1, '#8b00ff');
  _hline(ctx, 6, 11, 5, '#ffd700');
  _vline(ctx, 8, 12, 2, '#333');
  // золотая корона сверху
  _hline(ctx, 6, 0, 5, '#ffd700');
  _px(ctx, 6, 0, '#ffd700'); _px(ctx, 8, 0, '#ffd700'); _px(ctx, 10, 0, '#ffd700');
  // мини-скелеты по бокам
  _px(ctx, 3, 8, '#e8dcc8'); _px(ctx, 3, 9, '#e8dcc8');
  _px(ctx, 13, 8, '#e8dcc8'); _px(ctx, 13, 9, '#e8dcc8');
}

function _evoSprite_apocalypse_bow(ctx) {
  // Лук с огнём + золотая аура
  _px(ctx, 3, 4, '#ffd700'); _px(ctx, 2, 5, '#ffd700');
  _px(ctx, 2, 6, '#ffd700'); _px(ctx, 2, 7, '#ffd700');
  _px(ctx, 2, 8, '#ffd700'); _px(ctx, 3, 9, '#ffd700');
  _vline(ctx, 3, 5, 4, '#fff');
  // огненные стрелы
  _hline(ctx, 5, 6, 6, '#ff4500');
  _hline(ctx, 5, 7, 6, '#ff6600');
  _hline(ctx, 5, 8, 6, '#ff8c00');
  _px(ctx, 11, 5, '#ffff00'); _px(ctx, 11, 7, '#ffff00'); _px(ctx, 11, 9, '#ffff00');
  // золотая аура
  _px(ctx, 1, 3, '#ffd700'); _px(ctx, 1, 10, '#ffd700');
}

function _evoSprite_eternity_staff(ctx) {
  // Посох с множеством снарядов + аура
  _vline(ctx, 8, 3, 11, '#6a0dad');
  _px(ctx, 8, 1, '#ffffff'); _px(ctx, 7, 2, '#ffffff'); _px(ctx, 9, 2, '#ffffff');
  // снаряды вокруг
  _px(ctx, 3, 5, '#ff4500'); _px(ctx, 13, 5, '#6ec6ff');
  _px(ctx, 3, 10, '#a259ff'); _px(ctx, 13, 10, '#ffff00');
  _px(ctx, 5, 3, '#cc66ff');
  // золотая аура
  _px(ctx, 6, 0, '#ffd700'); _px(ctx, 10, 0, '#ffd700');
}

function _evoSprite_devourer_claws(ctx) {
  // Когти + вампирские клыки + корона
  _vline(ctx, 4, 3, 8, '#cc0000');
  _vline(ctx, 7, 3, 8, '#cc0000');
  _vline(ctx, 10, 3, 8, '#cc0000');
  _px(ctx, 4, 11, '#8b0000'); _px(ctx, 7, 11, '#8b0000'); _px(ctx, 10, 11, '#8b0000');
  // клыки
  _px(ctx, 6, 13, '#ffffff'); _px(ctx, 9, 13, '#ffffff');
  // золотая корона
  _hline(ctx, 5, 1, 6, '#ffd700');
  _px(ctx, 5, 0, '#ffd700'); _px(ctx, 7, 0, '#ffd700'); _px(ctx, 10, 0, '#ffd700');
}

function _evoSprite_bastion_of_light(ctx) {
  // Щит + аура + корона
  _rect(ctx, 5, 4, 6, 7, '#1a4a8a');
  _rect(ctx, 4, 5, 8, 5, '#1a4a8a');
  // белый крест
  _vline(ctx, 7, 5, 5, '#ffffff'); _hline(ctx, 5, 7, 5, '#ffffff');
  // золотая корона
  _hline(ctx, 5, 1, 6, '#ffd700');
  _px(ctx, 5, 0, '#ffd700'); _px(ctx, 8, 0, '#ffd700'); _px(ctx, 10, 0, '#ffd700');
  // аура
  _px(ctx, 3, 4, '#ffd700'); _px(ctx, 12, 4, '#ffd700');
  _px(ctx, 3, 10, '#ffd700'); _px(ctx, 12, 10, '#ffd700');
}


/* --- Реестр эволюций --- */
const EVOLUTION_SPRITE_REGISTRY = {
  vampire_blade: _evoSprite_vampire_blade,
  rapid_bow: _evoSprite_rapid_bow,
  blade_storm: _evoSprite_blade_storm,
  soul_flame: _evoSprite_soul_flame,
  bloodletter: _evoSprite_bloodletter,
  piercer: _evoSprite_piercer,
  titan_hammer: _evoSprite_titan_hammer,
  pain_lash: _evoSprite_pain_lash,
  executioner: _evoSprite_executioner,
  butcher_axes: _evoSprite_butcher_axes,
  needle_storm: _evoSprite_needle_storm,
  meteor_strike: _evoSprite_meteor_strike,
  ice_storm: _evoSprite_ice_storm,
  thunder_chain: _evoSprite_thunder_chain,
  plague_cloud: _evoSprite_plague_cloud,
  mad_grimoire: _evoSprite_mad_grimoire,
  inferno: _evoSprite_inferno,
  martyr_aura: _evoSprite_martyr_aura,
  spike_bastion: _evoSprite_spike_bastion,
  tectonic_rift: _evoSprite_tectonic_rift,
  hero_blade: _evoSprite_hero_blade,
  pyroclasm: _evoSprite_pyroclasm,
  ice_spike: _evoSprite_ice_spike,
  electric_cascade: _evoSprite_electric_cascade,
  miasma: _evoSprite_miasma,
  // Супер-эволюции
  eternal_night_blade: _evoSprite_eternal_night_blade,
  apocalypse_bow: _evoSprite_apocalypse_bow,
  eternity_staff: _evoSprite_eternity_staff,
  devourer_claws: _evoSprite_devourer_claws,
  bastion_of_light: _evoSprite_bastion_of_light,
};

/** Генерирует спрайт эволюции 16x16. */
function generateEvolutionSprite(evoId) {
  const fn = EVOLUTION_SPRITE_REGISTRY[evoId];
  if (!fn) return null;
  const c = _createSpriteCanvas(16);
  const ctx = c.getContext('2d');
  fn(ctx);
  return c;
}


/* ============================================================
   ГЕНЕРАТОРЫ СПРАЙТОВ СНАРЯДОВ (8x8 или 12x12)
   ============================================================ */

function _projSprite_arrow(ctx) {
  // 8x8: жёлтая стрела с наконечником
  _hline(ctx, 0, 3, 6, '#f4d03f'); // древко
  _hline(ctx, 0, 4, 6, '#c8a020');
  _px(ctx, 6, 3, '#c0c0c0'); _px(ctx, 7, 3, '#c0c0c0'); // наконечник
  _px(ctx, 6, 4, '#a0a0a0'); _px(ctx, 7, 4, '#a0a0a0');
  // оперение
  _px(ctx, 0, 2, '#8b4513'); _px(ctx, 0, 5, '#8b4513');
  _px(ctx, 1, 2, '#8b4513'); _px(ctx, 1, 5, '#8b4513');
}

function _projSprite_missile(ctx) {
  // 8x8: фиолетовый круг с белым центром
  _rect(ctx, 2, 2, 4, 4, '#a259ff');
  _rect(ctx, 1, 3, 6, 2, '#a259ff');
  _rect(ctx, 3, 1, 2, 6, '#a259ff');
  _px(ctx, 3, 3, '#ffffff'); _px(ctx, 4, 3, '#ffffff');
  _px(ctx, 3, 4, '#ffffff'); _px(ctx, 4, 4, '#ffffff');
}

function _projSprite_dagger(ctx) {
  // 8x8: серая линия-кинжал
  _hline(ctx, 1, 3, 5, '#c0c0c0');
  _hline(ctx, 1, 4, 5, '#a0a0a0');
  _px(ctx, 6, 3, '#e0e0e0'); _px(ctx, 7, 3, '#ffffff'); // остриё
  _px(ctx, 0, 3, '#8b4513'); _px(ctx, 0, 4, '#8b4513'); // рукоять
}

function _projSprite_fireball(ctx) {
  // 8x8: оранжевый круг с жёлтым ядром
  _rect(ctx, 2, 2, 4, 4, '#ff4500');
  _rect(ctx, 1, 3, 6, 2, '#ff6600');
  _rect(ctx, 3, 1, 2, 6, '#ff6600');
  _px(ctx, 3, 3, '#ffff00'); _px(ctx, 4, 3, '#ffff00');
  _px(ctx, 3, 4, '#ffff00'); _px(ctx, 4, 4, '#ffff00');
}

function _projSprite_lightning(ctx) {
  // 8x8: жёлтый зигзаг
  _px(ctx, 1, 1, '#ffff00'); _px(ctx, 2, 2, '#ffff00');
  _px(ctx, 3, 3, '#ffffff'); _px(ctx, 4, 2, '#ffff00');
  _px(ctx, 5, 3, '#ffff00'); _px(ctx, 6, 4, '#ffffff');
  _px(ctx, 7, 5, '#ffff00');
  _px(ctx, 2, 3, '#ffff80'); _px(ctx, 5, 4, '#ffff80');
}


function _projSprite_ice(ctx) {
  // 8x8: голубой ромб
  _px(ctx, 3, 1, '#aaeeff'); _px(ctx, 4, 1, '#aaeeff');
  _px(ctx, 2, 2, '#88ccff'); _px(ctx, 5, 2, '#88ccff');
  _px(ctx, 1, 3, '#88ccff'); _px(ctx, 6, 3, '#88ccff');
  _px(ctx, 1, 4, '#88ccff'); _px(ctx, 6, 4, '#88ccff');
  _px(ctx, 2, 5, '#88ccff'); _px(ctx, 5, 5, '#88ccff');
  _px(ctx, 3, 6, '#aaeeff'); _px(ctx, 4, 6, '#aaeeff');
  // центр
  _px(ctx, 3, 3, '#ffffff'); _px(ctx, 4, 3, '#ffffff');
  _px(ctx, 3, 4, '#ffffff'); _px(ctx, 4, 4, '#ffffff');
}

function _projSprite_poison(ctx) {
  // 8x8: зелёный кружок
  _rect(ctx, 2, 2, 4, 4, '#2ecc40');
  _rect(ctx, 1, 3, 6, 2, '#44ff44');
  _rect(ctx, 3, 1, 2, 6, '#44ff44');
  _px(ctx, 3, 3, '#66ff66'); _px(ctx, 4, 4, '#66ff66');
}

function _projSprite_axe(ctx) {
  // 8x8: серый треугольник-топор
  _px(ctx, 3, 0, '#a0a0a0'); _px(ctx, 4, 0, '#a0a0a0');
  _px(ctx, 2, 1, '#a0a0a0'); _px(ctx, 5, 1, '#a0a0a0');
  _px(ctx, 1, 2, '#808080'); _px(ctx, 6, 2, '#808080');
  _hline(ctx, 1, 3, 6, '#808080');
  // рукоять
  _vline(ctx, 3, 4, 3, '#8b4513');
  _vline(ctx, 4, 4, 3, '#6b3510');
}

function _projSprite_stone(ctx) {
  // 8x8: серый круглый камень
  _rect(ctx, 2, 2, 4, 4, '#808080');
  _px(ctx, 3, 1, '#a0a0a0'); _px(ctx, 4, 1, '#a0a0a0');
  _px(ctx, 1, 3, '#a0a0a0'); _px(ctx, 6, 3, '#a0a0a0');
  _px(ctx, 3, 6, '#666'); _px(ctx, 4, 6, '#666');
  // блик
  _px(ctx, 2, 2, '#c0c0c0');
}

function _projSprite_dart(ctx) {
  // 8x8: тонкая жёлтая игла
  _hline(ctx, 0, 3, 7, '#f4d03f');
  _px(ctx, 7, 3, '#c0c0c0'); // остриё
  _px(ctx, 0, 2, '#c8a020'); _px(ctx, 0, 4, '#c8a020'); // оперение
}

function _projSprite_bone(ctx) {
  // 8x8: белый треугольник (костяной осколок)
  _px(ctx, 3, 0, '#ffffff');
  _px(ctx, 2, 1, '#e8dcc8'); _px(ctx, 4, 1, '#e8dcc8');
  _px(ctx, 1, 2, '#e8dcc8'); _px(ctx, 5, 2, '#e8dcc8');
  _hline(ctx, 1, 3, 5, '#d0c4a8');
  _px(ctx, 2, 4, '#c8b898'); _px(ctx, 4, 4, '#c8b898');
}

function _projSprite_explosion(ctx) {
  // 8x8: оранжевый круг с лучами (AoE)
  _rect(ctx, 2, 2, 4, 4, '#ff6600');
  _px(ctx, 3, 3, '#ffff00'); _px(ctx, 4, 3, '#ffff00');
  // лучи
  _px(ctx, 0, 0, '#ff8c00'); _px(ctx, 7, 0, '#ff8c00');
  _px(ctx, 0, 7, '#ff8c00'); _px(ctx, 7, 7, '#ff8c00');
  _px(ctx, 3, 0, '#ffaa00'); _px(ctx, 0, 3, '#ffaa00');
  _px(ctx, 7, 4, '#ffaa00'); _px(ctx, 4, 7, '#ffaa00');
}


function _projSprite_crossbow_bolt(ctx) {
  // 8x8: белый болт с наконечником
  _hline(ctx, 0, 3, 6, '#ffffff');
  _hline(ctx, 0, 4, 6, '#cccccc');
  _px(ctx, 6, 3, '#aaaaaa'); _px(ctx, 7, 3, '#888888');
  _px(ctx, 6, 2, '#aaaaaa'); _px(ctx, 6, 5, '#aaaaaa'); // наконечник
}

function _projSprite_spellbook_proj(ctx) {
  // 8x8: разноцветный шар
  _rect(ctx, 2, 2, 4, 4, '#a259ff');
  _px(ctx, 3, 3, '#ff7a1a'); _px(ctx, 4, 3, '#6ec6ff');
  _px(ctx, 3, 4, '#f4d03f'); _px(ctx, 4, 4, '#ffffff');
}

/* --- Реестр снарядов --- */
const PROJECTILE_SPRITE_REGISTRY = {
  arrow:         { fn: _projSprite_arrow, size: 8 },
  missile:       { fn: _projSprite_missile, size: 8 },
  dagger:        { fn: _projSprite_dagger, size: 8 },
  fireball:      { fn: _projSprite_fireball, size: 8 },
  crossbow_bolt: { fn: _projSprite_crossbow_bolt, size: 8 },
  throwing_axe:  { fn: _projSprite_axe, size: 8 },
  dart:          { fn: _projSprite_dart, size: 8 },
  sling_stone:   { fn: _projSprite_stone, size: 8 },
  ice_arrow:     { fn: _projSprite_ice, size: 8 },
  spellbook_proj:{ fn: _projSprite_spellbook_proj, size: 8 },
  lightning:     { fn: _projSprite_lightning, size: 8 },
  poison:        { fn: _projSprite_poison, size: 8 },
  bone:          { fn: _projSprite_bone, size: 8 },
  explosion:     { fn: _projSprite_explosion, size: 8 },
  stone:         { fn: _projSprite_stone, size: 8 },
};

/** Генерирует спрайт снаряда. */
function generateProjectileSprite(type) {
  const reg = PROJECTILE_SPRITE_REGISTRY[type];
  if (!reg) return null;
  const c = _createSpriteCanvas(reg.size);
  const ctx = c.getContext('2d');
  reg.fn(ctx);
  return c;
}


/* ============================================================
   ИНИЦИАЛИЗАЦИЯ — генерирует все спрайты предметов.
   Вызывается из initSprites() или отдельно при старте.
   ============================================================ */

function initItemSprites() {
  // Оружия
  const weaponIds = Object.keys(WEAPON_SPRITE_REGISTRY);
  for (let i = 0; i < weaponIds.length; i++) {
    WEAPON_SPRITES[weaponIds[i]] = generateWeaponSprite(weaponIds[i]);
  }
  console.log(`[Sprites] Сгенерировано ${weaponIds.length} спрайтов оружия`);

  // Пассивки
  const abilityIds = Object.keys(ABILITY_SPRITE_REGISTRY);
  for (let i = 0; i < abilityIds.length; i++) {
    ABILITY_SPRITES[abilityIds[i]] = generateAbilitySprite(abilityIds[i]);
  }
  console.log(`[Sprites] Сгенерировано ${abilityIds.length} спрайтов пассивок`);

  // Эволюции
  const evoIds = Object.keys(EVOLUTION_SPRITE_REGISTRY);
  for (let i = 0; i < evoIds.length; i++) {
    EVOLUTION_SPRITES[evoIds[i]] = generateEvolutionSprite(evoIds[i]);
  }
  console.log(`[Sprites] Сгенерировано ${evoIds.length} спрайтов эволюций`);

  // Снаряды
  const projTypes = Object.keys(PROJECTILE_SPRITE_REGISTRY);
  for (let i = 0; i < projTypes.length; i++) {
    PROJECTILE_SPRITES[projTypes[i]] = generateProjectileSprite(projTypes[i]);
  }
  console.log(`[Sprites] Сгенерировано ${projTypes.length} спрайтов снарядов`);
}

/* ============================================================
   ЭКСПОРТ
   ============================================================ */
window.WEAPON_SPRITES = WEAPON_SPRITES;
window.ABILITY_SPRITES = ABILITY_SPRITES;
window.EVOLUTION_SPRITES = EVOLUTION_SPRITES;
window.PROJECTILE_SPRITES = PROJECTILE_SPRITES;
window.initItemSprites = initItemSprites;
window.generateWeaponSprite = generateWeaponSprite;
window.generateAbilitySprite = generateAbilitySprite;
window.generateEvolutionSprite = generateEvolutionSprite;
window.generateProjectileSprite = generateProjectileSprite;

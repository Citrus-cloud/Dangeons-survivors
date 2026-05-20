'use strict';
/* ============================================================
   constants.js
   Глобальный конфиг, утилиты и пул объектов.
   Экспортируется в window.{CONFIG, Utils, ObjectPool}.
   ============================================================ */

const CONFIG = {
  MAP: { W: 2000, H: 2000, TILE_SIZE: 80 },

  PLAYER: {
    SIZE: 24,               // Уменьшен в 2 раза (было 48)
    SPEED: 180,             // px/sec
    MAX_HP: 100,
    PICKUP_RADIUS: 40,
    TRAIL_INTERVAL: 0.05,
    SLOTS_WEAPONS: 6,
    SLOTS_ABILITIES: 6,
  },

  // Встроенная способность героя (не занимает слот) — Magic Missile
  MISSILE: {
    COOLDOWN: 3.0,
    SPEED: 380,
    DAMAGE: 25,
    RADIUS: 6,
    LIFETIME: 3.0,
    COUNT: 1,
    SPREAD: 0.25,
  },

  ENEMY: {
    SIZE: 28,
    SPEED: 55,              // Шаг 3: уменьшено в 2 раза (было 110)
    HP: 20,
    DAMAGE: 10,
    HIT_INTERVAL: 0.6,
    XP_MIN: 5,
    XP_MAX: 10,
  },

  // Шаг 3: сундук с броском d20
  CHEST: {
    INTERVAL: 180,          // секунды между появлениями (3 минуты)
    FIRST_DELAY: 180,       // первый сундук через столько секунд после старта
    SPAWN_MIN_DIST: 300,    // мин. расстояние от героя при спавне
    SPAWN_MAX_DIST: 600,    // макс. расстояние
    SIZE: 30,               // визуальный размер
    PICKUP_RADIUS: 28,      // радиус подбора (центр героя ↔ центр сундука)
    DROP_CHANCE: 0.03,      // шанс выпадения сундука с обычного моба (3%)
    MIN_WAVE: 5,            // сундуки появляются только с 5-й волны
  },

  WAVE: {
    INTERVAL: 20,
    BASE: 3,
    PER_WAVE: 2,
    SPAWN_DIST_MIN: 400,
    SPAWN_DIST_MAX: 600,
    INITIAL_DELAY: 1.5,
  },

  XP: {
    BASE: 100,
    GROWTH: 1.20,           // +20% к предыдущему уровню (100 → 120 → 144 → ...)
    MAGNET_SPEED: 360,
  },

  POOLS: {
    ENEMIES: 80,
    PROJECTILES: 120,       // Шаг 7: расширено до 120 (20 оружий)
    PARTICLES: 100,         // Шаг 19: ограничено до 100 для мобильных
    XP: 200,
    GROUND_EFFECTS: 30,     // Шаг 4: лужи/следы (гниль, слизь, огонь)
  },

  // Параметры джойстика (экранные пиксели)
  JOYSTICK: {
    BASE_RADIUS: 35,
    STICK_RADIUS: 18,
    MAX_OFFSET: 50,
    DEAD_ZONE: 0.12,        // нормализованный, чтобы не шевелилось от микро-движений
  },

  // Шаг 5: процедурная генерация подземелья
  DUNGEON: {
    SEED: 0,                  // фиксированный сид; 0 — случайный (Math.random)
    GRID_CELL: 20,            // размер ячейки сетки коллизий (px)
    ROOMS_MIN: 5,
    ROOMS_MAX: 8,
    ROOM_W_MIN: 200, ROOM_W_MAX: 400,
    ROOM_H_MIN: 150, ROOM_H_MAX: 300,
    ROOM_PADDING: 80,         // мин. расстояние между комнатами
    CORRIDOR_W_MIN: 80,
    CORRIDOR_W_MAX: 120,
    PILLARS_PER_ROOM_MIN: 3,
    PILLARS_PER_ROOM_MAX: 6,
    PILLAR_SIZE: 24,
    WALL_THICKNESS: 16,       // толщина "стен" вокруг комнат/коридоров (визуальная)
    SPIKE_TRAPS: 4,           // 3..5 штук
    FIRE_TRAPS: 3,            // 2..4 штук
    SARCOPHAGI: 2,
    TORCH_SPACING: 130,       // расстояние между факелами вдоль стен
    RUNES_PER_ROOM: 4,        // 3..5 декоративных рун
  },

  // Параметры ловушек
  TRAP: {
    SPIKE: {
      W: 36, H: 36,
      HIDDEN_TIME: 2.0,
      ACTIVE_TIME: 1.5,
      WARN_TIME: 0.5,
      DAMAGE: 15,
    },
    FIRE: {
      W: 32, H: 32,
      INTERVAL: 4.0,
      WARN_TIME: 0.5,
      RANGE: 100,
      WIDTH: 40,              // ширина струи огня
      DAMAGE: 20,
      DOT_DPS: 5,
      DOT_TIME: 2.0,
    },
  },

  // Загадка с рычагами
  LEVER: {
    W: 22, H: 22,
    INTERACT_RADIUS: 30,
    RESET_DELAY: 2.0,         // через сколько сбрасываются при неверной комбинации
    COUNT: 3,
  },
};


/* ============================================================
   Utils
   ============================================================ */
const Utils = {
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  lerp(a, b, t)  { return a + (b - a) * t; },
  rand(a, b)     { return a + Math.random() * (b - a); },
  randInt(a, b)  { return Math.floor(Utils.rand(a, b + 1)); },
  dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; },
  len(x, y)      { return Math.hypot(x, y); },
  norm(x, y) {
    const l = Math.hypot(x, y) || 1;
    return { x: x / l, y: y / l };
  },
  formatTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const ss = s % 60;
    return String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  },
  // Римские цифры I..V (для отображения уровня предмета)
  roman(n) {
    return ['', 'I', 'II', 'III', 'IV', 'V'][Utils.clamp(n | 0, 0, 5)] || String(n);
  },
};


/* ============================================================
   ObjectPool — переиспользуемый пул сущностей с .active флагом.
   ============================================================ */
class ObjectPool {
  constructor(factory, size) {
    this.items = new Array(size);
    for (let i = 0; i < size; i++) this.items[i] = factory();
  }
  spawn() {
    for (let i = 0, n = this.items.length; i < n; i++) {
      const it = this.items[i];
      if (!it.active) { it.active = true; return it; }
    }
    return null;
  }
  forEachActive(fn) {
    for (let i = 0, n = this.items.length; i < n; i++) {
      const it = this.items[i];
      if (it.active) fn(it, i);
    }
  }
  countActive() {
    let c = 0;
    for (let i = 0; i < this.items.length; i++) if (this.items[i].active) c++;
    return c;
  }
  clearAll() { for (const it of this.items) it.active = false; }
}

// Экспорт в глобальную область (без бандлера)
window.CONFIG = CONFIG;
window.Utils = Utils;
window.ObjectPool = ObjectPool;


/* ============================================================
   ENEMY_TYPES — таблица всех монстров (Шаг 4).
   Поля:
     id            — уникальный идентификатор типа
     name          — имя для UI/отладки
     letter        — буква, отрисованная по центру
     shape         — 'rect' | 'diamond' | 'oval' | 'circle' | 'triangle'
     color         — основной цвет
     stroke        — цвет обводки (опц.)
     w, h          — размеры в пикселях
     hp, speed     — здоровье и скорость (px/sec)
     damage        — контактный урон в касании (если behavior его использует)
     xp            — диапазон опыта (min, max). Может быть переопределён лутом.
     behavior      — 'chase' | 'archer' | 'gas' | 'mage' | 'goblin' |
                     'spider' | 'ooze' | 'mimic' | 'captain' | 'fire_elem' |
                     'bat' | 'rotgolem' | 'shadow' | 'dragonet' | 'cultist' |
                     'spiderling' | 'slimeling'
     tier          — 1..5 (5 — раньше остальных не появляется), у мимика 0 (особый)
     dropChance    — вероятность выпадения кристалла опыта (0..1)
     spawnWeight   — вес при выборе для волны (внутри своего тира)
     summonChild   — id типа, призываемого при смерти (для паука/слизня и т.п.)
     wobble        — амплитуда покачивания (по высоте)
     attackCooldown, specialCooldown, specialRange — параметры поведения
   Если поле не указано — берётся разумный дефолт в коде.
   ============================================================ */
const ENEMY_TYPES = {
  /* ===== ТИР 1 (волны 1+) ===== */
  skeleton: {
    id: 'skeleton', name: t('enemy_skeleton'), letter: 'S',
    shape: 'rect', color: '#bdbdbd', stroke: '#ffffff',
    w: 28, h: 28, hp: 20, speed: 55, damage: 10,
    xp: [5, 10], behavior: 'chase', tier: 1, dropChance: 0.6,
    spawnWeight: 4, hitInterval: 0.6, wobble: 1.5,
  },
  zombie: {
    id: 'zombie', name: t('enemy_zombie'), letter: 'Z',
    shape: 'rect', color: '#3e6b3a', stroke: '#a3d39c',
    w: 28, h: 28, hp: 40, speed: 32, damage: 15,
    xp: [10, 14], behavior: 'chase', tier: 1, dropChance: 0.7,
    spawnWeight: 3, hitInterval: 0.8, wobble: 2,
    deathPuddle: { kind: 'rot', chance: 0.30, radius: 40, life: 3, slow: 0.30 },
  },
  goblin: {
    id: 'goblin', name: t('enemy_goblin'), letter: 'G',
    shape: 'triangle', color: '#27ae60', stroke: '#a0f0bf',
    w: 20, h: 20, hp: 12, speed: 100, damage: 8,
    xp: [5, 8], behavior: 'goblin', tier: 1, dropChance: 0.30,
    spawnWeight: 4, hitInterval: 0.4, wobble: 1.5,
    retreatDist: 80, retreatCooldown: 1.5,
  },

  /* ===== ТИР 2 (волны 3+) ===== */
  archer: {
    id: 'archer', name: t('enemy_archer'), letter: 'A',
    shape: 'rect', color: '#d9c08a', stroke: '#fff5cc',
    w: 24, h: 24, hp: 15, speed: 50, damage: 8,
    xp: [7, 9], behavior: 'archer', tier: 2, dropChance: 0.55,
    spawnWeight: 3, wobble: 1,
    keepDistMin: 150, keepDistMax: 200,
    attackCooldown: 2.0, projectile: { kind: 'arrow_e', speed: 320, life: 2.5 },
  },
  ooze: {
    id: 'ooze', name: t('enemy_ooze'), letter: 'O',
    shape: 'oval', color: '#e67e22', stroke: '#ffd9a8',
    w: 30, h: 20, hp: 30, speed: 40, damage: 12,
    xp: [8, 12], behavior: 'ooze', tier: 2, dropChance: 0.6,
    spawnWeight: 3, hitInterval: 0.7, wobble: 1.5,
    trailEvery: 0.5,
    trail: { kind: 'slime', radius: 22, life: 2, slow: 0.20 },
    splitOnDeath: { childId: 'slimeling', count: 2 },
  },
  gasspore: {
    id: 'gasspore', name: t('enemy_gasspore'), letter: 'S',
    shape: 'circle', color: '#7d8f6e', stroke: '#cfe0b6',
    w: 22, h: 22, hp: 15, speed: 40, damage: 0,
    xp: [8, 12], behavior: 'gas', tier: 2, dropChance: 0.55,
    spawnWeight: 2, wobble: 2,
    explodeRadius: 60, explodeDamage: 15,
  },

  /* ===== ТИР 3 (волны 5+) ===== */
  mage: {
    id: 'mage', name: t('enemy_mage'), letter: 'M',
    shape: 'rect', color: '#7e57c2', stroke: '#dccff5',
    w: 24, h: 24, hp: 18, speed: 55, damage: 12,
    xp: [12, 18], behavior: 'mage', tier: 3, dropChance: 0.7,
    spawnWeight: 2, wobble: 1.5,
    teleportEvery: 4.0, teleportMin: 100, teleportMax: 150,
    attackCooldown: 2.5, projectile: { kind: 'magebolt', speed: 280, life: 3 },
  },
  spider: {
    id: 'spider', name: t('enemy_spider'), letter: 'P',
    shape: 'diamond', color: '#1e1e1e', stroke: '#a070a0',
    w: 26, h: 26, hp: 20, speed: 110, damage: 10,
    xp: [12, 18], behavior: 'spider', tier: 3, dropChance: 0.55,
    spawnWeight: 2, hitInterval: 0.5, wobble: 2,
    dashEvery: 2.0, dashTime: 0.5, dashMul: 2.0,
    splitOnDeath: { childId: 'spiderling', count: 3 },
  },
  fire_elem: {
    id: 'fire_elem', name: t('enemy_fire_elem'), letter: 'F',
    shape: 'diamond', color: '#ff7a00', stroke: '#ffd97a',
    w: 30, h: 30, hp: 35, speed: 60, damage: 12,
    xp: [18, 22], behavior: 'fire_elem', tier: 3, dropChance: 0.75,
    spawnWeight: 2, hitInterval: 0.7, wobble: 2,
    trailEvery: 0.35,
    trail: { kind: 'fire', radius: 22, life: 2.5, dps: 5 },
    explodeOnDeath: { radius: 80, damage: 20 },
  },
  bat: {
    id: 'bat', name: t('enemy_bat'), letter: 'B',
    shape: 'oval', color: '#7a1d2c', stroke: '#ffb3b3',
    w: 18, h: 12, hp: 10, speed: 130, damage: 6,
    xp: [7, 10], behavior: 'bat', tier: 3, dropChance: 0.45,
    spawnWeight: 3, hitInterval: 0.5, wobble: 0,
    sinAmp: 26, sinFreq: 6, dodgeChance: 0.20,
  },

  /* ===== ТИР 4 (волны 7+) ===== */
  captain: {
    id: 'captain', name: t('enemy_captain'), letter: 'C',
    shape: 'rect', color: '#c0392b', stroke: '#ffd700',
    w: 32, h: 32, hp: 60, speed: 50, damage: 18,
    xp: [25, 35], behavior: 'captain', tier: 4, dropChance: 0.85,
    spawnWeight: 1, hitInterval: 0.7, wobble: 1.5,
    auraRadius: 100, auraSpeedMul: 1.20, auraDmgMul: 1.20,
  },
  cultist: {
    id: 'cultist', name: t('enemy_cultist'), letter: 'K',
    shape: 'triangle', color: '#1a1a1a', stroke: '#a040ff',
    w: 22, h: 22, hp: 20, speed: 35, damage: 0,
    xp: [30, 40], behavior: 'cultist', tier: 4, dropChance: 0.80,
    spawnWeight: 2, wobble: 1,
    keepDistMin: 100, keepDistMax: 140,
    summonEvery: 5.0, summonChildId: 'skeleton', maxSummons: 3,
  },
  shadow: {
    id: 'shadow', name: t('enemy_shadow'), letter: 'X',
    shape: 'rect', color: '#0a0a0a', stroke: '#7a7a7a',
    w: 22, h: 22, hp: 18, speed: 110, damage: 14,
    xp: [16, 22], behavior: 'shadow', tier: 4, dropChance: 0.65,
    spawnWeight: 2, hitInterval: 0.6, wobble: 1.5,
    visibleTime: 2.0, invisibleTime: 1.0, backstabMul: 1.5,
  },

  /* ===== ТИР 5 (волны 8+) ===== */
  rotgolem: {
    id: 'rotgolem', name: t('enemy_rotgolem'), letter: 'G',
    shape: 'rect', color: '#6b4a2b', stroke: '#c9a97a',
    w: 40, h: 40, hp: 80, speed: 28, damage: 25,
    xp: [35, 45], behavior: 'rotgolem', tier: 5, dropChance: 0.90,
    spawnWeight: 1, hitInterval: 0.8, wobble: 1,
    sporeCooldown: 5.0, sporeChildId: 'gasspore',
  },
  dragonet: {
    id: 'dragonet', name: t('enemy_dragonet'), letter: 'D',
    shape: 'diamond', color: '#9aa0a6', stroke: '#fff5cc',
    w: 35, h: 20, hp: 25, speed: 70, damage: 10,
    xp: [18, 26], behavior: 'dragonet', tier: 5, dropChance: 0.85,
    spawnWeight: 1, hitInterval: 0.7, wobble: 3,
    keepDistMin: 130, keepDistMax: 180,
    breathCooldown: 3.0, breathRange: 100, breathDamage: 10,
  },

  /* ===== ОСОБЫЙ — мимик (не входит в волны, спавнится отдельно) ===== */
  mimic: {
    id: 'mimic', name: t('enemy_mimic'), letter: '?',
    shape: 'rect', color: '#d8a826', stroke: '#fffce0',
    w: 28, h: 28, hp: 50, speed: 40, damage: 20,
    xp: [40, 60], behavior: 'mimic', tier: 0, dropChance: 1.0,
    spawnWeight: 0, hitInterval: 0.7, wobble: 0,
    activateRadius: 50, biteDamage: 20,
  },

  /* ===== НОВЫЕ — ТИР 1 (волны 1+) ===== */
  giant_rat: {
    id: 'giant_rat', name: t('enemy_giant_rat'), letter: 'R',
    shape: 'oval', color: '#8b6914', stroke: '#d4a855',
    w: 18, h: 10, hp: 8, speed: 120, damage: 5,
    xp: [3, 5], behavior: 'rat', tier: 1, dropChance: 0.35,
    spawnWeight: 3, hitInterval: 0.5, wobble: 1,
    fearChance: 0.30, fearDuration: 2.0,
  },
  acid_slug: {
    id: 'acid_slug', name: t('enemy_acid_slug'), letter: 'S',
    shape: 'oval', color: '#2ecc40', stroke: '#a0ffa0',
    w: 22, h: 14, hp: 12, speed: 35, damage: 8,
    xp: [4, 6], behavior: 'chase', tier: 1, dropChance: 0.45,
    spawnWeight: 3, hitInterval: 0.7, wobble: 1.5,
    deathPuddle: { kind: 'acid', chance: 1.0, radius: 30, life: 2, slow: 0, dps: 5 },
  },
  cave_bat: {
    id: 'cave_bat', name: t('enemy_cave_bat'), letter: 'B',
    shape: 'oval', color: '#666666', stroke: '#bbbbbb',
    w: 16, h: 10, hp: 6, speed: 140, damage: 4,
    xp: [2, 4], behavior: 'bat', tier: 1, dropChance: 0.25,
    spawnWeight: 4, hitInterval: 0.4, wobble: 0,
    sinAmp: 20, sinFreq: 7,
  },
  ratcatcher: {
    id: 'ratcatcher', name: t('enemy_ratcatcher'), letter: 'R',
    shape: 'rect', color: '#e8dca0', stroke: '#ffffff',
    w: 22, h: 22, hp: 18, speed: 55, damage: 10,
    xp: [6, 10], behavior: 'chase', tier: 1, dropChance: 0.55,
    spawnWeight: 2, hitInterval: 0.6, wobble: 1.5,
    splitOnDeath: { childId: 'giant_rat', count: 2 },
  },
  mold: {
    id: 'mold', name: t('enemy_mold'), letter: 'M',
    shape: 'circle', color: '#6b8060', stroke: '#a0c090',
    w: 20, h: 20, hp: 10, speed: 0, damage: 12,
    xp: [3, 5], behavior: 'mold', tier: 1, dropChance: 0.35,
    spawnWeight: 2, hitInterval: 0.8, wobble: 0,
    lungeRange: 60, lungeCooldown: 4.0, lungeSpeed: 200, lungeTime: 0.3,
    deathCloud: { radius: 40, dps: 6, life: 2 },
  },

  /* ===== НОВЫЕ — ТИР 2 (волны 3+) ===== */
  gnoll: {
    id: 'gnoll', name: t('enemy_gnoll'), letter: 'G',
    shape: 'triangle', color: '#8b4513', stroke: '#d2a06a',
    w: 24, h: 24, hp: 22, speed: 100, damage: 12,
    xp: [8, 12], behavior: 'gnoll', tier: 2, dropChance: 0.55,
    spawnWeight: 3, hitInterval: 0.5, wobble: 1.5,
    rageHpPct: 0.50, rageSpeedMul: 1.30,
  },
  kobold: {
    id: 'kobold', name: t('enemy_kobold'), letter: 'K',
    shape: 'rect', color: '#777777', stroke: '#cccccc',
    w: 18, h: 18, hp: 14, speed: 65, damage: 8,
    xp: [7, 11], behavior: 'kobold', tier: 2, dropChance: 0.50,
    spawnWeight: 2, hitInterval: 0.6, wobble: 1,
    keepDistMin: 100, keepDistMax: 140,
    trapCooldown: 10.0, trapRadius: 20, trapDamage: 10,
  },
  cave_crab: {
    id: 'cave_crab', name: t('enemy_cave_crab'), letter: 'C',
    shape: 'oval', color: '#e67300', stroke: '#ffcc80',
    w: 30, h: 18, hp: 30, speed: 38, damage: 15,
    xp: [12, 16], behavior: 'crab', tier: 2, dropChance: 0.65,
    spawnWeight: 2, hitInterval: 0.8, wobble: 1,
    shellDR: 0.50, shellDuration: 1.0, shellCooldown: 3.0,
  },
  ghost: {
    id: 'ghost', name: t('enemy_ghost'), letter: 'W',
    shape: 'oval', color: '#ffffff', stroke: '#ccccff',
    w: 24, h: 24, hp: 15, speed: 60, damage: 10,
    xp: [10, 14], behavior: 'ghost', tier: 2, dropChance: 0.55,
    spawnWeight: 2, hitInterval: 0.7, wobble: 2,
    ignoreWalls: true,
  },
  alchemist_skel: {
    id: 'alchemist_skel', name: t('enemy_alchemist_skel'), letter: 'A',
    shape: 'rect', color: '#30b030', stroke: '#a0ffa0',
    w: 24, h: 24, hp: 16, speed: 55, damage: 12,
    xp: [9, 13], behavior: 'archer', tier: 2, dropChance: 0.55,
    spawnWeight: 2, wobble: 1,
    keepDistMin: 120, keepDistMax: 160,
    attackCooldown: 2.0,
    projectile: { kind: 'flask', speed: 260, life: 2 },
    projectileAoE: 30,
  },
  harpy: {
    id: 'harpy', name: t('enemy_harpy'), letter: 'H',
    shape: 'triangle', color: '#808080', stroke: '#d0d0d0',
    w: 22, h: 22, hp: 18, speed: 90, damage: 15,
    xp: [11, 15], behavior: 'harpy', tier: 2, dropChance: 0.55,
    spawnWeight: 2, hitInterval: 0.5, wobble: 2,
    diveCooldown: 3.0, diveSpeed: 300, diveTime: 0.4, retreatDist: 120,
  },
  dung_beetle: {
    id: 'dung_beetle', name: t('enemy_dung_beetle'), letter: 'D',
    shape: 'circle', color: '#6b4400', stroke: '#b08040',
    w: 24, h: 24, hp: 25, speed: 35, damage: 12,
    xp: [10, 14], behavior: 'beetle', tier: 2, dropChance: 0.55,
    spawnWeight: 2, hitInterval: 0.7, wobble: 1,
    ballHp: 20, ballRadius: 16, fleeSpeed: 100,
  },

  /* ===== НОВЫЕ — ТИР 3 (волны 5+) ===== */
  minotaur: {
    id: 'minotaur', name: t('enemy_minotaur'), letter: 'M',
    shape: 'rect', color: '#7a4a2a', stroke: '#d4a06a',
    w: 36, h: 36, hp: 50, speed: 55, damage: 25,
    xp: [18, 24], behavior: 'minotaur', tier: 3, dropChance: 0.75,
    spawnWeight: 2, hitInterval: 0.8, wobble: 1,
    chargeWindup: 1.5, chargeSpeed: 300, chargeRange: 120,
    chargeRestTime: 2.0, knockback: 60,
  },
  basilisk: {
    id: 'basilisk', name: t('enemy_basilisk'), letter: 'B',
    shape: 'rect', color: '#1a4d1a', stroke: '#40a040',
    w: 28, h: 28, hp: 30, speed: 50, damage: 12,
    xp: [16, 20], behavior: 'basilisk', tier: 3, dropChance: 0.65,
    spawnWeight: 2, hitInterval: 0.7, wobble: 1.5,
    gazeCooldown: 6.0, gazeRange: 80, gazeSlowPct: 0.60, gazeSlowDuration: 2.0, gazeDamage: 12,
  },
  medusa: {
    id: 'medusa', name: t('enemy_medusa'), letter: 'M',
    shape: 'oval', color: '#228b22', stroke: '#ffffff',
    w: 26, h: 26, hp: 25, speed: 40, damage: 10,
    xp: [15, 19], behavior: 'archer', tier: 3, dropChance: 0.60,
    spawnWeight: 2, wobble: 1.5,
    keepDistMin: 130, keepDistMax: 170,
    attackCooldown: 1.8,
    projectile: { kind: 'poison_arrow', speed: 280, life: 2.5 },
    poisonDps: 4, poisonDuration: 3,
  },
  doppelganger: {
    id: 'doppelganger', name: t('enemy_doppelganger'), letter: 'D',
    shape: 'rect', color: '#3070d0', stroke: '#ff3030',
    w: 32, h: 32, hp: 35, speed: 180, damage: 0,
    xp: [22, 28], behavior: 'doppelganger', tier: 3, dropChance: 0.80,
    spawnWeight: 1, hitInterval: 0.8, wobble: 1.5,
    copyDamageMul: 0.50, attackCooldown: 2.0,
  },
  earth_elem: {
    id: 'earth_elem', name: t('enemy_earth_elem'), letter: 'E',
    shape: 'rect', color: '#8b6b3a', stroke: '#c9a97a',
    w: 34, h: 34, hp: 60, speed: 25, damage: 20,
    xp: [20, 26], behavior: 'earth_elem', tier: 3, dropChance: 0.75,
    spawnWeight: 1, hitInterval: 0.9, wobble: 1,
    wallCooldown: 5.0, wallLength: 60, wallDuration: 4.0,
  },
  water_elem: {
    id: 'water_elem', name: t('enemy_water_elem'), letter: 'E',
    shape: 'oval', color: '#4da6ff', stroke: '#b3d9ff',
    w: 30, h: 20, hp: 35, speed: 55, damage: 14,
    xp: [16, 20], behavior: 'water_elem', tier: 3, dropChance: 0.65,
    spawnWeight: 2, hitInterval: 0.7, wobble: 2,
    trailEvery: 0.5,
    trail: { kind: 'water', radius: 20, life: 3, slow: 0.15, dps: 0 },
    waveCooldown: 4.0, waveRange: 100, waveDamage: 14, waveKnockback: 40,
  },
  beholder_spore: {
    id: 'beholder_spore', name: t('enemy_beholder_spore'), letter: 'B',
    shape: 'circle', color: '#8b008b', stroke: '#dda0dd',
    w: 28, h: 28, hp: 28, speed: 30, damage: 7,
    xp: [18, 22], behavior: 'beholder_spore', tier: 3, dropChance: 0.70,
    spawnWeight: 1, wobble: 2,
    attackCooldown: 2.0, spreadAngle: 0.35, spreadCount: 3,
    projectile: { kind: 'spore_bolt', speed: 240, life: 2 },
    explodeOnDeath: { radius: 60, damage: 15 },
  },
  hell_hound: {
    id: 'hell_hound', name: t('enemy_hell_hound'), letter: 'H',
    shape: 'diamond', color: '#cc0000', stroke: '#ff6666',
    w: 26, h: 26, hp: 22, speed: 120, damage: 12,
    xp: [13, 17], behavior: 'fire_elem', tier: 3, dropChance: 0.60,
    spawnWeight: 2, hitInterval: 0.5, wobble: 1.5,
    trailEvery: 0.4,
    trail: { kind: 'fire', radius: 18, life: 2, dps: 5 },
    explodeOnDeath: { radius: 50, damage: 15 },
  },

  /* ===== НОВЫЕ — ТИР 4 (волны 7+) ===== */
  dragonid: {
    id: 'dragonid', name: t('enemy_dragonid'), letter: 'D',
    shape: 'rect', color: '#cc2200', stroke: '#ff9966',
    w: 30, h: 30, hp: 40, speed: 60, damage: 18,
    xp: [22, 28], behavior: 'dragonid', tier: 4, dropChance: 0.75,
    spawnWeight: 2, hitInterval: 0.7, wobble: 1,
    breathCooldown: 5.0, breathRange: 80, breathDamage: 14,
  },
  drow: {
    id: 'drow', name: t('enemy_drow'), letter: 'D',
    shape: 'triangle', color: '#3d0066', stroke: '#b366ff',
    w: 22, h: 22, hp: 20, speed: 110, damage: 15,
    xp: [18, 22], behavior: 'drow', tier: 4, dropChance: 0.65,
    spawnWeight: 2, hitInterval: 0.5, wobble: 1.5,
    invisDist: 150, backstabMul: 1.30, retreatDist: 100,
    trapCooldown: 8.0, trapDamage: 12, trapRadius: 18,
  },
  illithid: {
    id: 'illithid', name: t('enemy_illithid'), letter: 'I',
    shape: 'rect', color: '#6600cc', stroke: '#cc99ff',
    w: 28, h: 28, hp: 30, speed: 55, damage: 18,
    xp: [28, 34], behavior: 'illithid', tier: 4, dropChance: 0.80,
    spawnWeight: 1, wobble: 1.5,
    keepDistMin: 130, keepDistMax: 170,
    blastCooldown: 4.0, blastRadius: 50, blastDamage: 18,
    deathScream: { radius: 100, speedBuff: 0.20, duration: 3.0 },
  },
  stone_golem: {
    id: 'stone_golem', name: t('enemy_stone_golem'), letter: 'G',
    shape: 'rect', color: '#808080', stroke: '#c0c0c0',
    w: 40, h: 40, hp: 80, speed: 25, damage: 25,
    xp: [32, 38], behavior: 'chase', tier: 4, dropChance: 0.85,
    spawnWeight: 1, hitInterval: 0.9, wobble: 0.5,
    stunChance: 0.30, stunDuration: 0.5,
    immunePoison: true, immuneBleed: true,
  },
  rust_monster: {
    id: 'rust_monster', name: t('enemy_rust_monster'), letter: 'R',
    shape: 'oval', color: '#b36b00', stroke: '#ff9933',
    w: 30, h: 20, hp: 35, speed: 55, damage: 15,
    xp: [20, 26], behavior: 'chase', tier: 4, dropChance: 0.70,
    spawnWeight: 2, hitInterval: 0.7, wobble: 1.5,
    rustDebuff: { damageMul: 0.80, duration: 3.0, maxStacks: 2 },
    explodeOnDeath: { radius: 60, damage: 0 },
    deathRust: true,
  },
  lich_minor: {
    id: 'lich_minor', name: t('enemy_lich_minor'), letter: 'N',
    shape: 'rect', color: '#330066', stroke: '#ffd700',
    w: 26, h: 26, hp: 28, speed: 35, damage: 16,
    xp: [32, 38], behavior: 'lich_minor', tier: 4, dropChance: 0.80,
    spawnWeight: 1, wobble: 1,
    keepDistMin: 140, keepDistMax: 180,
    summonEvery: 7.0, summonChildId: 'skeleton', maxSummons: 6,
    attackCooldown: 2.5,
    projectile: { kind: 'dark_arrow', speed: 280, life: 2.5 },
    killSummonsOnDeath: true,
  },
  chimera: {
    id: 'chimera', name: t('enemy_chimera'), letter: 'C',
    shape: 'rect', color: '#b3b300', stroke: '#66ff66',
    w: 36, h: 28, hp: 45, speed: 55, damage: 15,
    xp: [25, 31], behavior: 'chimera', tier: 4, dropChance: 0.80,
    spawnWeight: 1, hitInterval: 0.7, wobble: 1,
    headAttacks: {
      lion: { damage: 15, range: 40 },
      goat: { damage: 12, cooldown: 3.0, speed: 300, life: 2 },
      snake: { damage: 5, poisonDps: 5, poisonDuration: 3, cooldown: 5.0 },
    },
  },
  demon_berserker: {
    id: 'demon_berserker', name: t('enemy_demon_berserker'), letter: 'D',
    shape: 'rect', color: '#cc0000', stroke: '#ff6666',
    w: 34, h: 34, hp: 50, speed: 100, damage: 20,
    xp: [28, 34], behavior: 'demon_berserker', tier: 4, dropChance: 0.80,
    spawnWeight: 1, hitInterval: 0.6, wobble: 1,
    rageHpPct: 0.30, rageSpeedMul: 1.40, rageDamageMul: 1.50, rageTakeDamageMul: 2.0,
  },

  /* ===== НОВЫЕ — ТИР 5 (волны 8+) ===== */
  young_dragon: {
    id: 'young_dragon', name: t('enemy_young_dragon'), letter: 'D',
    shape: 'diamond', color: '#cc3300', stroke: '#ffd700',
    w: 44, h: 30, hp: 70, speed: 100, damage: 22,
    xp: [38, 44], behavior: 'young_dragon', tier: 5, dropChance: 0.90,
    spawnWeight: 1, hitInterval: 0.8, wobble: 3,
    breathCooldown: 5.0, breathRange: 120, breathDamage: 22, breathSpread: 5,
    tailSweep: { damage: 18, radius: 60, cooldown: 8.0, knockback: 50 },
  },
  observer: {
    id: 'observer', name: t('enemy_observer'), letter: 'B',
    shape: 'circle', color: '#660099', stroke: '#cc66ff',
    w: 34, h: 34, hp: 55, speed: 30, damage: 8,
    xp: [38, 44], behavior: 'observer', tier: 5, dropChance: 0.90,
    spawnWeight: 1, wobble: 2,
    eyeStalks: 4, stalkCooldown: 1.5, stalkDamage: 8,
    projectile: { kind: 'eye_beam', speed: 300, life: 2 },
    antimagicCooldown: 6.0, antimagicDuration: 2.0,
  },
  death_knight: {
    id: 'death_knight', name: t('enemy_death_knight'), letter: 'D',
    shape: 'rect', color: '#1a1a1a', stroke: '#cc0000',
    w: 38, h: 38, hp: 90, speed: 40, damage: 28,
    xp: [45, 55], behavior: 'death_knight', tier: 5, dropChance: 0.95,
    spawnWeight: 1, hitInterval: 0.8, wobble: 0.5,
    aoeCooldown: 7.0, aoeRadius: 100, aoeDamage: 22, healReduction: 0.50, healReductionDuration: 4.0,
    deathCurse: { damageTakenMul: 1.30, duration: 5.0 },
  },
  hydra_small: {
    id: 'hydra_small', name: t('enemy_hydra_small'), letter: 'H',
    shape: 'oval', color: '#228b22', stroke: '#66ff66',
    w: 44, h: 28, hp: 60, speed: 30, damage: 10,
    xp: [42, 48], behavior: 'hydra', tier: 5, dropChance: 0.90,
    spawnWeight: 1, hitInterval: 0.6, wobble: 1,
    heads: 3, headHp: 20, headRegenTime: 5.0, regenPerHead: 2,
  },
  archlich: {
    id: 'archlich', name: t('enemy_archlich'), letter: 'A',
    shape: 'rect', color: '#0d0d0d', stroke: '#ffd700',
    w: 30, h: 30, hp: 100, speed: 55, damage: 25,
    xp: [55, 65], behavior: 'archlich', tier: 5, dropChance: 1.0,
    spawnWeight: 0, hitInterval: 0.8, wobble: 1.5,
    teleportEvery: 2.0, teleportMin: 80, teleportMax: 140,
    darkWave: { cooldown: 4.0, radius: 120, damage: 25 },
    summonEvery: 8.0, summonChildId: 'captain', maxSummons: 3,
    homingCooldown: 3.0, homingDamage: 20, homingSpeed: 200,
    rareSpawn: true, maxPerRun: 1,
  },
  eldritch_horror: {
    id: 'eldritch_horror', name: t('enemy_eldritch_horror'), letter: 'H',
    shape: 'rect', color: '#2d0040', stroke: '#9933ff',
    w: 48, h: 48, hp: 120, speed: 22, damage: 30,
    xp: [65, 75], behavior: 'eldritch_horror', tier: 5, dropChance: 1.0,
    spawnWeight: 0, hitInterval: 0.8, wobble: 0,
    abyssCry: { cooldown: 5.0, radius: 150, slowPct: 0.50, duration: 3.0 },
    rareSpawn: true, maxPerRun: 1,
    auraGlow: true,
  },
  /* ===== Ещё один враг тир5 для разнообразия ===== */
  bone_colossus: {
    id: 'bone_colossus', name: t('enemy_bone_colossus'), letter: 'K',
    shape: 'rect', color: '#d9d0c0', stroke: '#ffffff',
    w: 42, h: 42, hp: 85, speed: 28, damage: 26,
    xp: [40, 50], behavior: 'rotgolem', tier: 5, dropChance: 0.90,
    spawnWeight: 1, hitInterval: 0.9, wobble: 0.5,
    sporeCooldown: 4.0, sporeChildId: 'skeleton',
  },

  /* ===== ДОЧЕРНИЕ (не призываются волной) ===== */
  spiderling: {
    id: 'spiderling', name: t('enemy_spiderling'), letter: 'p',
    shape: 'diamond', color: '#3a3a3a', stroke: '#a070a0',
    w: 16, h: 16, hp: 5, speed: 130, damage: 3,
    xp: [3, 5], behavior: 'chase', tier: 0, dropChance: 0.20,
    spawnWeight: 0, hitInterval: 0.4, wobble: 1.5,
  },
  slimeling: {
    id: 'slimeling', name: t('enemy_slimeling'), letter: 'o',
    shape: 'oval', color: '#f0a050', stroke: '#ffd9a8',
    w: 18, h: 12, hp: 8, speed: 50, damage: 4,
    xp: [4, 6], behavior: 'chase', tier: 0, dropChance: 0.30,
    spawnWeight: 0, hitInterval: 0.6, wobble: 1.5,
  },
};

/* Тиры доступности по номеру волны (waveIndex 1-based). */
const ENEMY_TIERS = {
  1: { unlockWave: 1, ids: ['skeleton', 'zombie', 'goblin', 'giant_rat', 'acid_slug', 'cave_bat', 'ratcatcher', 'mold'] },
  2: { unlockWave: 3, ids: ['archer', 'ooze', 'gasspore', 'gnoll', 'kobold', 'cave_crab', 'ghost', 'alchemist_skel', 'harpy', 'dung_beetle'] },
  3: { unlockWave: 5, ids: ['mage', 'spider', 'fire_elem', 'bat', 'minotaur', 'basilisk', 'medusa', 'doppelganger', 'earth_elem', 'water_elem', 'beholder_spore', 'hell_hound'] },
  4: { unlockWave: 7, ids: ['captain', 'cultist', 'shadow', 'dragonid', 'drow', 'illithid', 'stone_golem', 'rust_monster', 'lich_minor', 'chimera', 'demon_berserker'] },
  5: { unlockWave: 9, ids: ['rotgolem', 'dragonet', 'young_dragon', 'observer', 'death_knight', 'hydra_small', 'bone_colossus'] },
};

/* Спец-настройки спавна мимика (особый режим, отдельно от волн). */
const MIMIC_CONFIG = {
  MIN_TIME: 180,            // не раньше 3-й минуты
  CHECK_INTERVAL: 30,       // частота попыток спавна (сек)
  CHANCE_PER_CHECK: 0.40,   // вероятность спавна за попытку (если ещё не достигнут лимит)
  MAX_PER_RUN: 2,           // 1–2 за забег
  SPAWN_MIN_DIST: 300,
  SPAWN_MAX_DIST: 600,
};

window.ENEMY_TYPES = ENEMY_TYPES;
window.ENEMY_TIERS = ENEMY_TIERS;
window.MIMIC_CONFIG = MIMIC_CONFIG;



/* ============================================================
   BOSS_CONFIG — конфигурация мини-боссов (Шаг 6).
   ============================================================ */
const BOSS_CONFIG = {
  // Таймер появления боссов (секунды от начала забега)
  SPAWN_TIMES: [300, 600, 900, 1200], // 5:00, 10:00, 15:00, 20:00
  // Порядок боссов (фиксированный)
  SPAWN_ORDER: ['boss_skeleton_knight', 'boss_lich', 'boss_spider_queen', 'boss_fire_lord'],
  // Снижение спавна обычных врагов при живом боссе (30%)
  WAVE_REDUCTION: 0.30,
  // Задержка между смертью босса и возобновлением нормального спавна
  POST_BOSS_DELAY: 2.0,
  // Сообщение «Босс повержен!» — длительность (сек)
  DEFEATED_MSG_DURATION: 2.0,
};

const BOSS_TYPES = {
  boss_skeleton_knight: {
    id: 'boss_skeleton_knight',
    name: t('boss_skeleton_king'),
    hp: 300,
    speed: 72,           // 0.4 от героя (180 * 0.4)
    damage: 25,
    xpReward: 200,
    w: 48, h: 48,
    color: '#c0c0c0',
    stroke: '#ffffff',
    shape: 'rect',
    letter: 'R',
    // Атаки
    attacks: {
      slash: { cooldown: 1.5, damage: 25, arc: 120, range: 55 },         // конус 120° перед собой
      whirlwind: { cooldown: 4.0, damage: 18, radius: 60 },              // круговой взмах 360°
    },
    // Фаза: при 50% HP — ускорение на 30%
    phase2HpPct: 0.50,
    phase2SpeedMul: 1.30,
  },

  boss_lich: {
    id: 'boss_lich',
    name: t('boss_lich'),
    hp: 200,
    speed: 108,          // 0.6 от героя (180 * 0.6)
    damage: 15,
    xpReward: 250,
    w: 40, h: 40,
    color: '#6a0dad',
    stroke: '#d9b3ff',
    shape: 'circle',
    letter: 'L',
    keepDist: 200,       // держит дистанцию 200px от героя
    // Атаки
    attacks: {
      bolt: { cooldown: 1.5, damage: 15, speed: 250, homing: true },      // самонаводящаяся стрела
      summon: { cooldown: 6.0, count: 3, childId: 'skeleton' },           // призыв 3 скелетов
      darkExplosion: { cooldown: 8.0, damage: 25, radius: 120 },          // AoE взрыв
    },
    teleportCooldown: 3.0,   // телепортируется при получении урона, не чаще раза в 3 сек
    // Фаза: при 50% HP — атаки на 25% быстрее
    phase2HpPct: 0.50,
    phase2CdMul: 0.75,
  },

  boss_spider_queen: {
    id: 'boss_spider_queen',
    name: t('boss_spider_queen'),
    hp: 350,
    speed: 198,          // 1.1 от героя (180 * 1.1)
    damage: 20,
    xpReward: 300,
    w: 56, h: 40,
    color: '#2d0a2d',
    stroke: '#a050a0',
    shape: 'oval',
    letter: 'Q',
    // Атаки
    attacks: {
      bite: { damage: 20, poisonDps: 5, poisonDuration: 3.0, range: 40 },
      web: { cooldown: 5.0, speed: 300, slowPct: 0.50, slowDuration: 2.0 },
      spawnMinions: { hpThreshold: 0.50, count: 4, childId: 'spider', triggered: false },
    },
    trailEvery: 0.6,     // оставляет паутину (лужи замедления)
    trail: { kind: 'slime', radius: 24, life: 3, slow: 0.35 },
    hitInterval: 0.8,
  },

  boss_fire_lord: {
    id: 'boss_fire_lord',
    name: t('boss_fire_elemental_lord'),
    hp: 500,
    speed: 54,           // 0.3 от героя (180 * 0.3)
    damage: 30,
    xpReward: 400,
    w: 50, h: 50,
    color: '#ff4500',
    stroke: '#ffd700',
    shape: 'diamond',
    letter: 'E',
    // Атаки
    attacks: {
      fireball: { cooldown: 3.0, damage: 30, speed: 180, explodeRadius: 100 },
      fireRing: { cooldown: 5.0, damage: 22, maxRadius: 160, expandTime: 0.8 },
      deathExplosion: { damage: 40, radius: 150 },   // при смерти
    },
    trailEvery: 0.4,     // горящая земля за собой
    trail: { kind: 'fire', radius: 26, life: 3.0, dps: 8 },
    // Фаза: при 30% HP — огненные шары каждые 2 сек
    phase2HpPct: 0.30,
    phase2FireballCd: 2.0,
  },
};

/* Шаг 13: Добавляем новых боссов-стражей для ледяных пещер, лесных руин и замка */
BOSS_TYPES.boss_ice_lord = {
  id: 'boss_ice_lord',
  name: t('boss_ice_elemental_lord'),
  hp: 450,
  speed: 60,
  damage: 25,
  xpReward: 350,
  w: 48, h: 48,
  color: '#4da6ff',
  stroke: '#b3d9ff',
  shape: 'diamond',
  letter: 'I',
  // Атаки
  attacks: {
    iceBolt: { cooldown: 2.0, damage: 18, speed: 280, slowPct: 0.40, slowDuration: 2.0 },
    frostNova: { cooldown: 6.0, damage: 20, radius: 120, slowPct: 0.50, slowDuration: 3.0 },
    iceSpikes: { cooldown: 8.0, damage: 15, count: 6, speed: 220 },  // веер ледяных шипов
    deathShatter: { damage: 30, radius: 130 },
  },
  trailEvery: 0.5,
  trail: { kind: 'water', radius: 22, life: 3.0, slow: 0.25, dps: 0 },
  phase2HpPct: 0.40,
  phase2CdMul: 0.70,
};

BOSS_TYPES.boss_ancient_ent = {
  id: 'boss_ancient_ent',
  name: t('boss_ancient_ent'),
  hp: 600,
  speed: 35,
  damage: 30,
  xpReward: 380,
  w: 56, h: 56,
  color: '#3a5a2a',
  stroke: '#6a8a4a',
  shape: 'rect',
  letter: 'T',
  // Атаки
  attacks: {
    rootSlam: { cooldown: 4.0, damage: 22, radius: 80 },       // AoE корни из пола
    poisonSpore: { cooldown: 6.0, count: 3, damage: 8, poisonDps: 5, poisonDuration: 3.0, speed: 180 },
    branchSwipe: { cooldown: 2.5, damage: 28, range: 55, arc: 140 },  // ближний бой ветками
  },
  hitInterval: 0.9,
  // Фаза 2: при 40% HP — быстрее регенерирует и призывает малых энтлингов
  phase2HpPct: 0.40,
  phase2Regen: 3,        // HP/sec регенерация
  phase2SummonCooldown: 8.0,
  phase2SummonChild: 'mold',  // малые грибы/плесень
  phase2SummonCount: 2,
};

BOSS_TYPES.boss_dark_knight = {
  id: 'boss_dark_knight',
  name: t('boss_dark_knight'),
  hp: 550,
  speed: 80,
  damage: 30,
  xpReward: 400,
  w: 50, h: 50,
  color: '#1a1a2a',
  stroke: '#cc0000',
  shape: 'rect',
  letter: 'D',
  attacks: {
    slash: { cooldown: 1.8, damage: 30, arc: 120, range: 55 },
    darkWave: { cooldown: 5.0, damage: 25, radius: 100, knockback: 60 },
    summon: { cooldown: 10.0, count: 2, childId: 'shadow' },
  },
  phase2HpPct: 0.45,
  phase2SpeedMul: 1.35,
  phase2CdMul: 0.80,
};

/* ============================================================
   Шаг 14: Новые мини-боссы (6 штук) — расширение пула до 13.
   ============================================================ */

BOSS_TYPES.boss_ghoul_king = {
  id: 'boss_ghoul_king',
  name: t('boss_ghoul_king'),
  hp: 350,
  speed: 130,
  damage: 20,
  xpReward: 280,
  w: 44, h: 44,
  color: '#4a0e0e',
  stroke: '#ff4444',
  shape: 'rect',
  letter: 'U',
  hitInterval: 0.7,
  // Атаки
  attacks: {
    claws: { cooldown: 1.2, damage: 20, arc: 100, range: 45, lifesteal: 0.50 },
    summonGhouls: { cooldown: 6.0, count: 4, childId: 'zombie' },
    deathWail: { damage: 0, count: 6, childId: 'skeleton' }, // при смерти призывает 6 скелетов
  },
  // Фаза 2: при 50% HP — +30% скорость атаки
  phase2HpPct: 0.50,
  phase2CdMul: 0.70,
  // Биомы
  allowedBiomes: ['crypt', 'castle'],
  rewardMul: 1.0,
};

BOSS_TYPES.boss_ice_serpent = {
  id: 'boss_ice_serpent',
  name: t('boss_ice_serpent'),
  hp: 400,
  speed: 70,
  damage: 18,
  xpReward: 320,
  w: 60, h: 36,
  color: '#88ccff',
  stroke: '#ffffff',
  shape: 'oval',
  letter: 'Z',
  hitInterval: 0.8,
  // Атаки
  attacks: {
    iceBreath: { cooldown: 3.0, damage: 22, range: 120, arc: 90, slowPct: 0.60, slowDuration: 2.0 },
    tailSweep: { cooldown: 5.0, damage: 18, radius: 80, knockback: 50 },
    iceStorm: { damage: 10, radius: 100, dps: true }, // включается при фазе 2 (постоянный AoE)
  },
  // Фаза 2: при 50% HP — ледяной шторм
  phase2HpPct: 0.50,
  phase2IceStorm: true,
  allowedBiomes: ['ice_caves'],
  rewardMul: 1.1,
};

BOSS_TYPES.boss_magma_giant = {
  id: 'boss_magma_giant',
  name: t('boss_magma_giant'),
  hp: 500,
  speed: 40,
  damage: 30,
  xpReward: 400,
  w: 56, h: 56,
  color: '#cc3300',
  stroke: '#ff9900',
  shape: 'rect',
  letter: 'M',
  hitInterval: 1.0,
  // Атаки
  attacks: {
    lavaWave: { cooldown: 7.0, damage: 25, length: 200, width: 40, burnDps: 8, burnDuration: 3.0 },
    stomp: { cooldown: 3.0, damage: 20, radius: 70 },
    deathEruption: { count: 8, damage: 18, speed: 250, radius: 6 }, // при смерти: 8 огненных шаров
  },
  trailEvery: 0.6,
  trail: { kind: 'fire', radius: 28, life: 3.5, dps: 8 },
  // Фаза 2: при 40% HP — +50% скорость, stomp cooldown сокращён
  phase2HpPct: 0.40,
  phase2SpeedMul: 1.50,
  phase2CdMul: 0.70,
  allowedBiomes: ['fire_mines'],
  rewardMul: 1.2,
};

BOSS_TYPES.boss_spider_matriarch = {
  id: 'boss_spider_matriarch',
  name: t('boss_spider_queen_large'),
  hp: 320,
  speed: 100,
  damage: 15,
  xpReward: 260,
  w: 50, h: 38,
  color: '#1a1a2a',
  stroke: '#cc66ff',
  shape: 'oval',
  letter: 'P',
  hitInterval: 0.7,
  // Атаки
  attacks: {
    webZones: { cooldown: 4.0, count: 3, radius: 50, slowPct: 0.50, life: 5.0 },
    teleport: { cooldown: 6.0, range: 150 },
    deathSpawn: { count: 10, childId: 'spiderling' }, // при смерти — 10 паучат
  },
  // Фаза 2: при 50% HP — телепорт чаще, больше паутин
  phase2HpPct: 0.50,
  phase2CdMul: 0.60,
  allowedBiomes: ['forest_ruins', 'crypt'],
  rewardMul: 1.0,
};

BOSS_TYPES.boss_knight_commander = {
  id: 'boss_knight_commander',
  name: t('boss_knight_commander'),
  hp: 450,
  speed: 65,
  damage: 35,
  xpReward: 380,
  w: 52, h: 52,
  color: '#b0b0b0',
  stroke: '#ffd700',
  shape: 'rect',
  letter: 'K',
  hitInterval: 0.9,
  // Атаки
  attacks: {
    greatsword: { cooldown: 1.8, damage: 35, arc: 150, range: 60 },
    commandAttack: { cooldown: 6.0, radius: 150, speedBuff: 0.30, buffDuration: 3.0 },
    // При 30% HP — ярость
  },
  // Фаза 2: при 30% HP — ярость (+40% скорости, -20% кулдаунов)
  phase2HpPct: 0.30,
  phase2SpeedMul: 1.40,
  phase2CdMul: 0.80,
  allowedBiomes: ['castle'],
  rewardMul: 1.2,
};

BOSS_TYPES.boss_shadow_dragon = {
  id: 'boss_shadow_dragon',
  name: t('boss_shadow_dragon'),
  hp: 600,
  speed: 90,
  damage: 28,
  xpReward: 500,
  w: 58, h: 44,
  color: '#1a0033',
  stroke: '#9933ff',
  shape: 'diamond',
  letter: 'D',
  hitInterval: 0.8,
  // Атаки
  attacks: {
    darkBreath: { cooldown: 3.5, damage: 28, range: 130, arc: 80, debuffDmgReduction: 0.20, debuffDuration: 3.0 },
    summonShadows: { cooldown: 10.0, count: 3, childId: 'shadow' }, // при 50% HP
    deathExplosion: { damage: 35, radius: 120 }, // при смерти
  },
  // Фаза 2: при 50% HP — призыв 3 теней + тёмный шторм
  phase2HpPct: 0.50,
  phase2SummonOnce: true,
  phase2CdMul: 0.75,
  // Доступен во всех биомах (редкий), но предпочитает замок
  allowedBiomes: ['castle', 'crypt', 'ice_caves', 'fire_mines', 'forest_ruins'],
  rewardMul: 1.5,
};

/* ============================================================
   Шаг 14: Добавить allowedBiomes к существующим боссам.
   ============================================================ */
BOSS_TYPES.boss_skeleton_knight.allowedBiomes = ['crypt', 'castle'];
BOSS_TYPES.boss_skeleton_knight.rewardMul = 1.0;
BOSS_TYPES.boss_lich.allowedBiomes = ['crypt', 'castle'];
BOSS_TYPES.boss_lich.rewardMul = 1.1;
BOSS_TYPES.boss_spider_queen.allowedBiomes = ['crypt', 'forest_ruins'];
BOSS_TYPES.boss_spider_queen.rewardMul = 1.0;
BOSS_TYPES.boss_fire_lord.allowedBiomes = ['fire_mines'];
BOSS_TYPES.boss_fire_lord.rewardMul = 1.2;
BOSS_TYPES.boss_ice_lord.allowedBiomes = ['ice_caves'];
BOSS_TYPES.boss_ice_lord.rewardMul = 1.1;
BOSS_TYPES.boss_ancient_ent.allowedBiomes = ['forest_ruins'];
BOSS_TYPES.boss_ancient_ent.rewardMul = 1.1;
BOSS_TYPES.boss_dark_knight.allowedBiomes = ['castle'];
BOSS_TYPES.boss_dark_knight.rewardMul = 1.2;

/* ============================================================
   Шаг 14: BOSS_GUARDIANS_BY_BIOME — пул стражей для каждого биома.
   При генерации карты выбирается случайный страж из пула.
   ============================================================ */
const BOSS_GUARDIANS_BY_BIOME = {
  crypt:        ['boss_skeleton_knight', 'boss_ghoul_king', 'boss_spider_matriarch'],
  ice_caves:    ['boss_ice_lord', 'boss_ice_serpent'],
  fire_mines:   ['boss_fire_lord', 'boss_magma_giant'],
  forest_ruins: ['boss_ancient_ent', 'boss_spider_matriarch'],
  castle:       ['boss_knight_commander', 'boss_shadow_dragon', 'boss_lich'],
};

/* ============================================================
   Шаг 14: Обновляем BOSS_CONFIG — ротация вместо фиксированного порядка.
   ============================================================ */
// Полный пул всех боссов для глобальной ротации
BOSS_CONFIG.ALL_BOSS_IDS = [
  'boss_skeleton_knight', 'boss_lich', 'boss_spider_queen', 'boss_fire_lord',
  'boss_ice_lord', 'boss_ancient_ent', 'boss_dark_knight',
  'boss_ghoul_king', 'boss_ice_serpent', 'boss_magma_giant',
  'boss_spider_matriarch', 'boss_knight_commander', 'boss_shadow_dragon',
];

// Множитель сложности боссов по временным слотам (5:00, 10:00, 15:00, 20:00)
BOSS_CONFIG.SLOT_DIFFICULTY = [1.0, 1.3, 1.6, 2.0];

// Награды за боссов
BOSS_CONFIG.REWARDS = {
  GLOBAL_XP_BASE: 300,        // базовый XP за глобального босса
  GLOBAL_XP_MAX: 500,         // макс XP за глобального босса
  GUARDIAN_XP_BASE: 150,      // базовый XP за стража
  GUARDIAN_XP_MAX: 300,       // макс XP за стража
  EXCLUSIVE_DROP_CHANCE: 0.20, // шанс дропа эксклюзива
  REWARD_SCALE_PER_MAP: 0.20, // +20% за каждую карту после первой
};

/* ============================================================
   Шаг 16: Древний дракон — финальный босс кампании.
   3 фазы, уникальные атаки, эпичная финальная битва.
   ============================================================ */
BOSS_TYPES.boss_ancient_dragon = {
  id: 'boss_ancient_dragon',
  name: t('boss_ancient_dragon'),
  hp: 800,
  speed: 45,
  damage: 25,
  xpReward: 600,
  w: 60, h: 40,
  color: '#cc3300',
  stroke: '#ffd700',
  shape: 'diamond',
  letter: 'D',
  hitInterval: 1.0,
  // Фазы
  phase2HpPct: 0.66,
  phase3HpPct: 0.33,
  // Атаки — фаза 1
  attacks: {
    fireBreath: { cooldown: 4.0, damage: 30, range: 140, arc: 90 },
    dive: { cooldown: 6.0, damage: 25, speed: 350 },
    summon: { cooldown: 8.0, count: 2, childId: 'fire_elem' },
    // Фаза 2
    lightningBreath: { cooldown: 5.0, damage: 35, range: 200, width: 30 },
    roar: { cooldown: 10.0, damage: 0, radius: 180, slowPct: 0.40, duration: 1.0 },
    summonDragonids: { cooldown: 7.0, count: 2, childId: 'dragonid' },
    // Фаза 3
    tailSwipe: { cooldown: 6.0, damage: 35, radius: 120, knockback: 80 },
    deathExplosion: { damage: 60, radius: 200 },
  },
  // Специальные параметры
  isCampaignOnly: true,
  rewardMul: 2.0,
};

window.BOSS_CONFIG = BOSS_CONFIG;
window.BOSS_TYPES = BOSS_TYPES;
window.BOSS_GUARDIANS_BY_BIOME = BOSS_GUARDIANS_BY_BIOME;


/* ============================================================
   WEAPON_CONFIGS — базовые параметры всех 20 оружий (Шаг 7).
   Формула прокачки: +15% урона, -5% кулдауна за уровень.
   ============================================================ */
const WEAPON_CONFIGS = {
  // --- Существующие 4 ---
  // Шаг 19: нормализация DPS (melee ~18-22, ranged ~10-14, AoE ~8-12)
  sword:    { baseDamage: 18, baseCooldown: 0.9,  type: 'melee'  },  // DPS 20
  bow:      { baseDamage: 14, baseCooldown: 1.2,  type: 'ranged' },  // DPS 11.7
  daggers:  { baseDamage: 7,  baseCooldown: 1.5,  type: 'multi'  },  // DPS 14 (3 daggers)
  fireball: { baseDamage: 22, baseCooldown: 2.5,  type: 'aoe'    },  // DPS 8.8 (AoE)

  // --- Категория 1: Ближний бой (DPS ~18-22) ---
  axe:      { baseDamage: 20, baseCooldown: 1.0,  type: 'melee'  },  // DPS 20
  spear:    { baseDamage: 18, baseCooldown: 0.9,  type: 'melee'  },  // DPS 20
  hammer:   { baseDamage: 30, baseCooldown: 1.5,  type: 'melee'  },  // DPS 20
  whip:     { baseDamage: 14, baseCooldown: 0.7,  type: 'melee'  },  // DPS 20

  // --- Категория 2: Дальний бой (DPS ~10-14) ---
  crossbow:       { baseDamage: 22, baseCooldown: 1.8, type: 'ranged' },  // DPS 12.2
  throwing_axes:  { baseDamage: 10, baseCooldown: 1.0, type: 'ranged' },  // DPS 10
  darts:          { baseDamage: 7,  baseCooldown: 0.6, type: 'ranged' },  // DPS 11.7
  sling:          { baseDamage: 12, baseCooldown: 0.9, type: 'ranged' },  // DPS 13.3

  // --- Категория 3: Магия (DPS ~10-14) ---
  ice_arrow:      { baseDamage: 14, baseCooldown: 1.2, type: 'magic'  },  // DPS 11.7
  chain_lightning:{ baseDamage: 18, baseCooldown: 1.5, type: 'magic'  },  // DPS 12
  poison_cloud:   { baseDamage: 8,  baseCooldown: 2.0, type: 'magic'  },  // DPS 4 + DoT
  spellbook:      { baseDamage: 10, baseCooldown: 0.8, type: 'magic'  },  // DPS 12.5

  // --- Категория 4: AoE / Контроль (DPS ~8-12) ---
  firestorm:      { baseDamage: 22, baseCooldown: 2.5, type: 'aoe'    },  // DPS 8.8
  holy_aura:      { baseDamage: 5,  baseCooldown: 0,   type: 'aoe'    },  // ~5 DPS constant
  spike_ring:     { baseDamage: 12, baseCooldown: 0,   type: 'aoe'    },  // ~12 DPS constant
  earthquake:     { baseDamage: 28, baseCooldown: 3.0, type: 'aoe'    },  // DPS 9.3
};

window.WEAPON_CONFIGS = WEAPON_CONFIGS;



/* ============================================================
   PASSIVE_CONFIGS — параметры 16 новых пассивных способностей (Шаг 8).
   Каждая имеет 5 уровней. Значения — «за уровень» или «на уровне N».
   ============================================================ */
const PASSIVE_CONFIGS = {
  /* === Категория: Защита === */
  armor: {
    id: 'armor',
    name: t('ability_armor'),
    icon: '🛡',
    desc: t('ability_armor_desc'),
    effectType: 'statModifier',
    perLevel: 0.05,        // -5% урона за уровень (уровень 5: -25%)
  },
  mana_shield: {
    id: 'mana_shield',
    name: t('ability_mana_shield'),
    icon: '🔵',
    desc: t('ability_mana_shield_desc'),
    effectType: 'periodic',
    baseCooldown: 12,      // уровень 1: каждые 12 сек, уровень 5: каждые 8 сек
    cdReductionPerLevel: 1, // -1 сек кулдауна за уровень
  },
  fortify: {
    id: 'fortify',
    name: t('ability_fortify'),
    icon: '❤',
    desc: t('ability_fortify_desc'),
    effectType: 'statModifier',
    perLevel: 0.08,        // +8% maxHp за уровень
  },
  resistance: {
    id: 'resistance',
    name: t('ability_resistance'),
    icon: '✜',
    desc: t('ability_resistance_desc'),
    effectType: 'statModifier',
    perLevel: 0.15,        // -15% длительности дебаффов за уровень (макс -75%)
  },

  /* === Категория: Атака === */
  bloodlust: {
    id: 'bloodlust',
    name: t('ability_bloodlust'),
    icon: '🦷',
    desc: t('ability_bloodlust_desc'),
    effectType: 'onHit',
    perLevel: 0.02,        // 2% lifesteal за уровень
  },
  crit_strike: {
    id: 'crit_strike',
    name: t('ability_crit_strike'),
    icon: '⚡',
    desc: t('ability_crit_strike_desc'),
    effectType: 'statModifier',
    perLevel: 0.04,        // +4% шанс крита за уровень
  },
  bleed: {
    id: 'bleed',
    name: t('ability_bleed'),
    icon: '💧',
    desc: t('ability_bleed_desc'),
    effectType: 'onHit',
    perLevel: 0.10,        // +10% шанс за уровень
    dotDps: 4,
    dotDuration: 3,
  },
  explosive_death: {
    id: 'explosive_death',
    name: t('ability_explosive_death'),
    icon: '💥',
    desc: t('ability_explosive_death_desc'),
    effectType: 'onKill',
    perLevel: 0.10,        // +10% шанс за уровень
    explosionDamage: 18,
    explosionRadius: 50,
  },

  /* === Категория: Магия === */
  quick_fingers: {
    id: 'quick_fingers',
    name: t('ability_quick_fingers'),
    icon: '🔄',
    desc: t('ability_quick_fingers_desc'),
    effectType: 'statModifier',
    perLevel: 0.04,        // -4% CD за уровень (уровень 5: -20%)
  },
  frost_aura: {
    id: 'frost_aura',
    name: t('ability_frost_aura'),
    icon: '❄',
    desc: t('ability_frost_aura_desc'),
    effectType: 'aura',
    radius: 60,
    perLevel: 0.08,        // -8% скорости врагов за уровень
  },
  magic_boost: {
    id: 'magic_boost',
    name: t('ability_magic_boost'),
    icon: '✦',
    desc: t('ability_magic_boost_desc'),
    effectType: 'statModifier',
    perLevel: 0.10,        // +10% magic damage за уровень
  },
  magic_echo: {
    id: 'magic_echo',
    name: t('ability_magic_echo'),
    icon: '🔮',
    desc: t('ability_magic_echo_desc'),
    effectType: 'onDamageTaken',
    perLevel: 0.15,        // +15% шанс за уровень
    echoDamage: 15,
    echoSpeed: 350,
  },

  /* === Категория: Удача и лут === */
  lucky: {
    id: 'lucky',
    name: t('ability_lucky'),
    icon: '🎲',
    desc: t('ability_lucky_desc'),
    effectType: 'statModifier',
    perLevel: 1,           // +1 к минимальному d20 за уровень
  },
  double_xp: {
    id: 'double_xp',
    name: t('ability_double_xp'),
    icon: '✕2',
    desc: t('ability_double_xp_desc'),
    effectType: 'onKill',
    perLevel: 0.06,        // +6% шанс за уровень
  },
  alchemist: {
    id: 'alchemist',
    name: t('ability_alchemist'),
    icon: '⚗',
    desc: t('ability_alchemist_desc'),
    effectType: 'statModifier',
    perLevel: 0.12,        // +12% DoT damage за уровень
  },
  magnet_plus: {
    id: 'magnet_plus',
    name: t('ability_magnet_plus'),
    icon: '⊕',
    desc: t('ability_magnet_plus_desc'),
    effectType: 'statModifier',
    perLevel: 0.20,        // +20% pickup radius за уровень
  },
};

window.PASSIVE_CONFIGS = PASSIVE_CONFIGS;



/* ============================================================
   BIOMES — конфигурация биомов для бесконечного режима (Шаг 13).
   Каждый биом определяет визуальный стиль карты, доступные ловушки,
   приоритетных врагов и декоративные элементы.
   ============================================================ */
const BIOMES = [
  {
    id: 'crypt',
    name: t('biome_crypt'),
    floorColor: '#3a3a3a',
    floorGridColor: '#444444',
    wallColor: '#1a1a1a',
    corridorColor: '#2a2a2a',
    secretFloorColor: '#3a3245',
    secretGridColor: '#4a3f60',
    pillarColor: '#4a4a4a',
    pillarCapColor: '#5a5a5a',
    decorTypes: ['sarcophagi', 'bones', 'torches'],
    trapTypes: ['spike', 'fire'],
    // Враги по тирам, подходящие этому биому (ID из ENEMY_TYPES)
    enemyTypes: [
      'skeleton', 'zombie', 'ratcatcher', 'giant_rat', 'cave_bat', 'mold',
      'archer', 'gasspore', 'ghost', 'alchemist_skel',
      'mage', 'bat', 'fire_elem',
      'captain', 'cultist', 'shadow', 'lich_minor',
      'rotgolem', 'dragonet', 'death_knight', 'bone_colossus', 'archlich',
    ],
    guardianBoss: 'boss_skeleton_knight', // Шаг 14: fallback, реальный выбор через BOSS_GUARDIANS_BY_BIOME
    mosaicColor: 'rgba(120, 90, 60, 0.35)',
  },
  {
    id: 'ice_caves',
    name: t('biome_ice_caves'),
    floorColor: '#3a3a4a',
    floorGridColor: '#4a4a5a',
    wallColor: '#1a1a2a',
    corridorColor: '#2a2a3a',
    secretFloorColor: '#3a3a50',
    secretGridColor: '#4a4a6a',
    pillarColor: '#5a5a6a',
    pillarCapColor: '#7a7a8a',
    decorTypes: ['ice_crystals', 'stalactites', 'frost_runes'],
    trapTypes: ['ice_spike', 'slippery_floor'],
    enemyTypes: [
      'skeleton', 'cave_bat', 'giant_rat', 'acid_slug',
      'ooze', 'cave_crab', 'ghost', 'gnoll',
      'water_elem', 'earth_elem', 'basilisk', 'spider',
      'stone_golem', 'chimera', 'illithid',
      'hydra_small', 'bone_colossus', 'observer',
    ],
    guardianBoss: 'boss_ice_lord', // Шаг 14: fallback
    mosaicColor: 'rgba(100, 140, 200, 0.3)',
  },
  {
    id: 'fire_mines',
    name: t('biome_fire_mines'),
    floorColor: '#3a2a2a',
    floorGridColor: '#4a3a3a',
    wallColor: '#2a1a1a',
    corridorColor: '#2a2020',
    secretFloorColor: '#4a3030',
    secretGridColor: '#5a4040',
    pillarColor: '#5a3a2a',
    pillarCapColor: '#6a4a3a',
    decorTypes: ['lava_cracks', 'ore_veins', 'ember_runes'],
    trapTypes: ['fire_geyser', 'rockfall'],
    enemyTypes: [
      'skeleton', 'goblin', 'mold', 'acid_slug',
      'gasspore', 'gnoll', 'dung_beetle', 'kobold',
      'fire_elem', 'hell_hound', 'minotaur', 'beholder_spore',
      'dragonid', 'demon_berserker', 'rust_monster',
      'young_dragon', 'rotgolem', 'dragonet',
    ],
    guardianBoss: 'boss_fire_lord', // Шаг 14: fallback
    mosaicColor: 'rgba(200, 80, 40, 0.3)',
  },
  {
    id: 'forest_ruins',
    name: t('biome_forest_ruins'),
    floorColor: '#3a3a2a',
    floorGridColor: '#4a4a3a',
    wallColor: '#1a2a1a',
    corridorColor: '#2a2a1a',
    secretFloorColor: '#3a4a30',
    secretGridColor: '#4a5a40',
    pillarColor: '#4a5a3a',
    pillarCapColor: '#5a6a4a',
    decorTypes: ['trees', 'vines', 'moss_patches'],
    trapTypes: ['poison_plant', 'root_grab'],
    enemyTypes: [
      'goblin', 'giant_rat', 'acid_slug', 'cave_bat', 'mold',
      'spider', 'ooze', 'harpy', 'dung_beetle', 'cave_crab',
      'basilisk', 'medusa', 'spider', 'water_elem', 'beholder_spore',
      'chimera', 'drow', 'rust_monster',
      'hydra_small', 'young_dragon', 'observer',
    ],
    guardianBoss: 'boss_ancient_ent', // Шаг 14: fallback
    mosaicColor: 'rgba(60, 140, 60, 0.3)',
  },
  {
    id: 'castle',
    name: t('biome_castle'),
    floorColor: '#2a2a3a',
    floorGridColor: '#3a3a4a',
    wallColor: '#1a1a2a',
    corridorColor: '#222230',
    secretFloorColor: '#3a3040',
    secretGridColor: '#4a4050',
    pillarColor: '#4a4a5a',
    pillarCapColor: '#6a5a4a',
    decorTypes: ['tapestries', 'armor_stands', 'candelabras'],
    trapTypes: ['magic_rune', 'portrait_trap'],
    enemyTypes: [
      'skeleton', 'zombie', 'ratcatcher', 'cave_bat',
      'archer', 'ghost', 'alchemist_skel', 'gnoll',
      'mage', 'doppelganger', 'earth_elem', 'minotaur',
      'captain', 'shadow', 'illithid', 'stone_golem', 'demon_berserker', 'lich_minor',
      'death_knight', 'archlich', 'bone_colossus', 'eldritch_horror',
    ],
    guardianBoss: 'boss_dark_knight', // Шаг 14: fallback
    mosaicColor: 'rgba(140, 100, 180, 0.3)',
  },
  /* ===== Биом 6: Небесный город (Sky Citadel) ===== */
  {
    id: 'sky_citadel',
    name: t('biome_sky_citadel'),
    floorColor: '#d8e8f0',
    floorGridColor: '#c0d8e8',
    wallColor: '#e8e8e8',
    corridorColor: '#c8d8e0',
    secretFloorColor: '#e0e8f0',
    secretGridColor: '#d0d8e8',
    pillarColor: '#f0f0f0',
    pillarCapColor: '#c9a84c',
    decorTypes: ['golden_urns', 'angel_statues', 'light_crystals', 'cloud_fountains', 'floating_lanterns'],
    trapTypes: ['magic_rune', 'spike'],
    enemyTypes: [
      'skeleton', 'cave_bat', 'ghost', 'mold',
      'harpy', 'gasspore', 'archer', 'gnoll',
      'mage', 'bat', 'water_elem', 'beholder_spore',
      'illithid', 'drow', 'shadow', 'chimera',
      'observer', 'death_knight', 'young_dragon', 'archlich',
    ],
    guardianBoss: 'boss_lich',
    mosaicColor: 'rgba(201, 168, 76, 0.3)',
    // Спец-свойство: анимация парения
    floatingAnimation: true,
    floatAmplitude: 2,    // ±2px
    floatSpeed: 1.5,      // скорость синусоиды
  },
  /* ===== Биом 7: Эльфийский лес (Elven Forest) ===== */
  {
    id: 'elven_forest',
    name: t('biome_elven_forest'),
    floorColor: '#4a7a3a',
    floorGridColor: '#5a8a4a',
    wallColor: '#3a2a1a',
    corridorColor: '#5a6a3a',
    secretFloorColor: '#4a6a40',
    secretGridColor: '#5a7a50',
    pillarColor: '#6b4a2a',
    pillarCapColor: '#3a7a3a',
    decorTypes: ['rune_stones', 'elven_lanterns', 'blooming_bushes', 'glowing_mushrooms', 'nature_altars'],
    trapTypes: ['poison_plant', 'root_grab', 'magic_rune'],
    enemyTypes: [
      'goblin', 'giant_rat', 'acid_slug', 'cave_bat', 'mold',
      'spider', 'harpy', 'ooze', 'cave_crab', 'ghost',
      'basilisk', 'medusa', 'water_elem', 'earth_elem', 'spider',
      'drow', 'chimera', 'shadow', 'cultist',
      'hydra_small', 'young_dragon', 'observer', 'eldritch_horror',
    ],
    guardianBoss: 'boss_ancient_ent',
    mosaicColor: 'rgba(80, 180, 80, 0.25)',
  },
  /* ===== Биом 8: Горная местность (Mountain Keep) ===== */
  {
    id: 'mountain_keep',
    name: t('biome_mountain_keep'),
    floorColor: '#6b5a4a',
    floorGridColor: '#7a6a5a',
    wallColor: '#3a3a3a',
    corridorColor: '#5a4a3a',
    secretFloorColor: '#5a5040',
    secretGridColor: '#6a6050',
    pillarColor: '#5a5a5a',
    pillarCapColor: '#7a6a4a',
    decorTypes: ['barrels', 'ore_crates', 'pickaxes', 'chain_lanterns', 'forge_anvils', 'stone_bridges'],
    trapTypes: ['rockfall', 'fire_geyser', 'spike'],
    enemyTypes: [
      'skeleton', 'goblin', 'giant_rat', 'mold', 'ratcatcher',
      'gnoll', 'kobold', 'cave_crab', 'dung_beetle', 'ooze',
      'minotaur', 'earth_elem', 'fire_elem', 'hell_hound', 'beholder_spore',
      'stone_golem', 'dragonid', 'demon_berserker', 'rust_monster', 'captain',
      'rotgolem', 'bone_colossus', 'young_dragon', 'death_knight',
    ],
    guardianBoss: 'boss_fire_lord',
    mosaicColor: 'rgba(120, 100, 70, 0.3)',
  },
];

/* ============================================================
   BIOME_TRAP_CONFIG — параметры новых ловушек по биомам (Шаг 13).
   ============================================================ */
const BIOME_TRAP_CONFIG = {
  ice_spike: {
    W: 36, H: 36,
    HIDDEN_TIME: 2.0,
    ACTIVE_TIME: 1.5,
    WARN_TIME: 0.5,
    DAMAGE: 15,
    SLOW_PCT: 0.40,
    SLOW_DURATION: 2.0,
  },
  slippery_floor: {
    W: 60, H: 60,       // 3×3 тайла-зона
    SLIDE_DURATION: 0.5,
    WALL_DAMAGE: 5,
  },
  fire_geyser: {
    W: 32, H: 32,
    COOLDOWN: 5.0,
    WARN_TIME: 0.6,
    ACTIVE_TIME: 0.8,
    RADIUS: 40,
    DAMAGE: 20,
  },
  rockfall: {
    W: 30, H: 30,
    COOLDOWN: 6.0,
    WARN_TIME: 0.5,
    AOE_RADIUS: 30,
    DAMAGE: 18,
  },
  poison_plant: {
    W: 28, H: 28,
    TRIGGER_RADIUS: 60,
    COOLDOWN: 3.0,
    PROJECTILE_SPEED: 220,
    PROJECTILE_DAMAGE: 8,
    POISON_DPS: 5,
    POISON_DURATION: 3.0,
  },
  root_grab: {
    W: 40, H: 40,       // 2×2 тайла-зона
    SLOW_PCT: 0.60,
    DPS: 5,
  },
  magic_rune: {
    W: 36, H: 36,
    DAMAGE: 15,
    COOLDOWN: 8.0,
    // Случайный эффект: 'knockback' | 'slow' | 'lightning'
    KNOCKBACK_FORCE: 80,
    SLOW_PCT: 0.50,
    SLOW_DURATION: 2.0,
    LIGHTNING_DAMAGE: 10,
    LIGHTNING_RADIUS: 50,
  },
  portrait_trap: {
    W: 24, H: 40,
    TRIGGER_RADIUS: 50,
    COOLDOWN: 4.0,
    PROJECTILE_SPEED: 300,
    PROJECTILE_DAMAGE: 12,
  },
};

/* ============================================================
   PORTAL_CONFIG — параметры портала перехода (Шаг 13).
   ============================================================ */
const PORTAL_CONFIG = {
  APPEAR_TIME: 600,         // секунды после начала карты (10 минут)
  RADIUS: 40,              // радиус взаимодействия
  VISUAL_RADIUS: 32,       // визуальный радиус
  PULSE_SPEED: 3.0,        // скорость пульсации
  COLOR_OUTER: '#9b59b6',  // фиолетовый
  COLOR_INNER: '#f1c40f',  // золотой
};

/* ============================================================
   INFINITE_MODE — конфиг бесконечного режима (Шаг 13).
   ============================================================ */
const INFINITE_MODE = {
  // Множители сложности по номеру карты
  getDifficultyMultiplier(mapNumber) {
    const n = Math.max(1, mapNumber);
    if (n === 1) return { hpMul: 1.0, dmgMul: 1.0, xpMul: 1.0 };
    if (n === 2) return { hpMul: 1.2, dmgMul: 1.15, xpMul: 1.2 };
    if (n === 3) return { hpMul: 1.4, dmgMul: 1.3, xpMul: 1.4 };
    if (n === 4) return { hpMul: 1.7, dmgMul: 1.5, xpMul: 1.7 };
    // 5+: базовые 2.0 + приращение за каждую карту сверх 4
    const extra = n - 4;
    return {
      hpMul: 2.0 + extra * 0.2,
      dmgMul: 1.7 + extra * 0.1,
      xpMul: 2.0 + extra * 0.2,
    };
  },

  // Размер карты по номеру
  getMapSize(mapNumber) {
    const n = Math.max(1, mapNumber);
    const size = Math.min(4000, 2000 + (n - 1) * 400);
    return { w: size, h: size };
  },

  // Количество комнат по номеру карты
  getRoomCount(mapNumber) {
    const n = Math.max(1, mapNumber);
    if (n <= 2) return { min: 5, max: 8 };
    return { min: 8, max: 12 };
  },

  // Количество ловушек по номеру карты (множитель)
  getTrapMultiplier(mapNumber) {
    return 1.0 + (Math.max(1, mapNumber) - 1) * 0.3;
  },

  // Выбрать биом для карты номер mapNumber
  getBiome(mapNumber) {
    const n = Math.max(1, mapNumber);
    if (n === 1) return BIOMES[0]; // Всегда склеп первым
    // Далее — случайный биом, отличный от предыдущего (управляется внешним кодом)
    return BIOMES[Math.floor(Math.random() * BIOMES.length)];
  },

  // Время появления стража карты (секунды от начала карты)
  GUARDIAN_SPAWN_DELAY: 30,

  // Минимальный номер карты для появления стража (на первой карте — нет)
  GUARDIAN_MIN_MAP: 2,
};

window.BIOMES = BIOMES;
window.BIOME_TRAP_CONFIG = BIOME_TRAP_CONFIG;
window.PORTAL_CONFIG = PORTAL_CONFIG;
window.INFINITE_MODE = INFINITE_MODE;


/* ============================================================
   STEP17_CONFIG — Шаг 17: параметры новых загадок и ловушек.
   ============================================================ */
const STEP17_CONFIG = {
  /* ---------- Руны активации (RunePuzzle) ---------- */
  RUNE_PUZZLE: {
    INTERACT_RADIUS: 40,    // расстояние для активации руны
    ERROR_DAMAGE: 10,       // урон при ошибке
    ERROR_SPAWN_COUNT: 1,   // врагов призывается при ошибке
    RUNE_SIZE: 30,          // визуальный размер руны
    // Количество рун по номеру карты кампании
    RUNES_BY_MAP: { 1: 3, 2: 3, 3: 4, 4: 4, 5: 5 },
  },

  /* ---------- Плиты-шифр (FloorPuzzle) ---------- */
  FLOOR_PUZZLE: {
    PLATE_SIZE: 40,         // размер плиты
    ERROR_DAMAGE: 5,        // урон при неправильной плите
    ERROR_SPAWN_COUNT: 1,   // врагов призывается при ошибке
    // Количество плит / длина шифра по номеру карты
    PLATES_BY_MAP: { 1: { plates: 4, seq: 3 }, 2: { plates: 5, seq: 3 }, 3: { plates: 5, seq: 4 }, 4: { plates: 6, seq: 4 }, 5: { plates: 6, seq: 4 } },
  },

  /* ---------- Катящийся валун (Boulder) ---------- */
  BOULDER: {
    RADIUS: 18,             // радиус валуна (px)
    DAMAGE: 25,             // урон при столкновении
    KNOCKBACK: 80,          // отбрасывание (px)
    IDLE_TIME: 3.0,         // покой (секунды)
    WARN_TIME: 0.5,         // предупреждение (секунды)
    ROLL_SPEED: 220,        // скорость движения (px/sec)
    MIN_CORRIDOR_LEN: 150,  // мин. длина коридора для размещения
    MAX_PER_MAP: 3,         // максимум на карту
  },

  /* ---------- Исчезающая платформа (VanishingPlatform) ---------- */
  VANISHING_PLATFORM: {
    SIZE: 80,               // 80×80 px
    SOLID_TIME: 3.0,        // платформа цела (секунды)
    FLICKER_TIME: 1.0,      // мерцание (секунды)
    GONE_TIME: 1.5,         // исчезла (секунды)
    DAMAGE: 15,             // урон при падении героя
    ENEMY_DAMAGE: 20,       // урон врагам
    STUN_DURATION: 0.5,     // оглушение героя (секунды)
    MAX_PER_MAP: 2,         // максимум на карту
  },

  /* ---------- Магическая руна на полу (MagicFloorRune) ---------- */
  MAGIC_FLOOR_RUNE: {
    RADIUS: 15,             // визуальный радиус
    TRIGGER_RADIUS: 20,     // радиус срабатывания
    FIRE_DAMAGE: 20,        // урон руны огня
    FIRE_EXPLOSION_RADIUS: 60, // радиус взрыва
    ICE_DAMAGE: 10,         // урон руны льда
    ICE_SLOW_PCT: 0.50,     // замедление (50%)
    ICE_SLOW_DURATION: 3.0, // длительность замедления
    DARK_SPAWN_COUNT: 2,    // количество призванных врагов
    HEAL_AMOUNT: 15,        // количество лечения
    HEAL_CHANCE: 0.10,      // шанс руны лечения (10%)
    MIN_PER_MAP: 4,         // минимум на карту
    MAX_PER_MAP: 8,         // максимум на карту
  },

  /* ---------- Сундуки-мимики (Mimic Chest) ---------- */
  MIMIC_CHEST: {
    MIMIC_ROLL_MAX: 5,      // бросок 1-5 = мимик
    EXTRA_MIMICS: 1,        // дополнительных мимиков в засаде (1-2)
    HP_BONUS: 0.30,         // +30% HP мимика из сундука
    DAMAGE_BONUS: 0.30,     // +30% урона мимика из сундука
    REWARD_MULTIPLIER: 2.0, // удвоенная награда за убийство
    SECRET_CHEST_MIMIC_CHANCE: 0.01, // 1% для секретных сундуков
    TRANSFORM_TIME: 0.5,    // время трансформации (секунды)
  },

  /* ---------- Генерация — сколько загадок/ловушек на карту ---------- */
  GENERATION: {
    // Бесконечный режим
    INFINITE: {
      PUZZLES_MIN: 1,       // минимум загадок (рандомно rune/floor/lever)
      PUZZLES_MAX: 2,
      BOULDERS_MIN: 0,
      BOULDERS_MAX: 2,
      PLATFORMS_MIN: 1,
      PLATFORMS_MAX: 2,
      MAGIC_RUNES_MIN: 4,
      MAGIC_RUNES_MAX: 8,
    },
    // Кампания (по картам)
    CAMPAIGN: {
      1: { puzzles: ['lever'], boulders: 1, platforms: 0, magicRunes: 3 },
      2: { puzzles: ['floor_puzzle'], boulders: 0, platforms: 1, magicRunes: 3 },
      3: { puzzles: [], boulders: 2, platforms: 0, magicRunes: 4 },
      4: { puzzles: ['rune_puzzle'], boulders: 0, platforms: 0, magicRunes: 4 },
      5: { puzzles: [], boulders: 1, platforms: 2, magicRunes: 3 },
    },
  },
};

window.STEP17_CONFIG = STEP17_CONFIG;
'use strict';
/* ============================================================
   constants_step12.js — 50 новых типов врагов (Шаг 12).
   Добавляет записи в ENEMY_TYPES и расширяет ENEMY_TIERS.
   Загружается ПОСЛЕ constants.js.
   ============================================================ */

/* ===== ТИР 3 — опасные (51–60) ===== */
ENEMY_TYPES.bone_golem = {
  id: 'bone_golem', name: t('enemy_bone_golem'), letter: 'G',
  shape: 'rect', color: '#f0f0f0', stroke: '#ffffff',
  w: 32, h: 32, hp: 45, speed: 28, damage: 15,
  xp: [20, 24], behavior: 'bone_golem', tier: 3, dropChance: 0.75,
  spawnWeight: 2, hitInterval: 0.8, wobble: 0.5,
  shardCooldown: 3.0, shardCount: 3, shardDamage: 8, shardSpeed: 260, shardSpread: 0.35,
  immuneBleed: true,
};

ENEMY_TYPES.phase_spider = {
  id: 'phase_spider', name: t('enemy_phase_spider'), letter: 'P',
  shape: 'diamond', color: '#4488ff', stroke: '#aaddff',
  w: 26, h: 26, hp: 20, speed: 0, damage: 14,
  xp: [16, 20], behavior: 'phase_spider', tier: 3, dropChance: 0.65,
  spawnWeight: 2, hitInterval: 0.6, wobble: 1.5,
  teleportCooldown: 3.0, teleportDist: 100,
  poisonDps: 4, poisonDuration: 3,
};

ENEMY_TYPES.ettercap = {
  id: 'ettercap', name: t('enemy_ettercap'), letter: 'E',
  shape: 'triangle', color: '#2d8b2d', stroke: '#80ff80',
  w: 24, h: 24, hp: 22, speed: 55, damage: 10,
  xp: [14, 16], behavior: 'ettercap', tier: 3, dropChance: 0.60,
  spawnWeight: 2, hitInterval: 0.7, wobble: 1.5,
  webCooldown: 5.0, webRadius: 50, webSlow: 0.60, webDuration: 3.0,
};

ENEMY_TYPES.fungal_man = {
  id: 'fungal_man', name: t('enemy_fungal_man'), letter: 'F',
  shape: 'oval', color: '#8b6b3a', stroke: '#c9a060',
  w: 26, h: 18, hp: 25, speed: 30, damage: 0,
  xp: [12, 16], behavior: 'fungal_man', tier: 3, dropChance: 0.60,
  spawnWeight: 2, hitInterval: 0.8, wobble: 1,
  sporeCooldown: 4.0, sporeRadius: 50, sporeDps: 8, disorientDuration: 1.0,
};

ENEMY_TYPES.troll = {
  id: 'troll', name: t('enemy_troll'), letter: 'T',
  shape: 'rect', color: '#2e8b57', stroke: '#66ff99',
  w: 36, h: 36, hp: 70, speed: 50, damage: 20,
  xp: [28, 32], behavior: 'troll', tier: 3, dropChance: 0.80,
  spawnWeight: 1, hitInterval: 0.8, wobble: 1,
  regenPerSec: 5, fireVulnMul: 2.0,
};

ENEMY_TYPES.cave_bear = {
  id: 'cave_bear', name: t('enemy_cave_bear'), letter: 'B',
  shape: 'oval', color: '#8b5a2b', stroke: '#d4a06a',
  w: 36, h: 24, hp: 50, speed: 55, damage: 18,
  xp: [23, 27], behavior: 'cave_bear', tier: 3, dropChance: 0.75,
  spawnWeight: 2, hitInterval: 0.8, wobble: 1,
  roarCooldown: 6.0, roarRadius: 80, roarSlowPct: 0.30, roarSlowDuration: 2.0,
};

ENEMY_TYPES.ogre = {
  id: 'ogre', name: t('enemy_ogre'), letter: 'O',
  shape: 'rect', color: '#daa520', stroke: '#ffcc00',
  w: 40, h: 40, hp: 80, speed: 28, damage: 25,
  xp: [32, 38], behavior: 'ogre', tier: 3, dropChance: 0.85,
  spawnWeight: 1, hitInterval: 0.9, wobble: 0.5,
  slamCooldown: 5.0, slamRadius: 60, slamDamage: 20, slamStun: 0.5,
};

ENEMY_TYPES.pterodactyl = {
  id: 'pterodactyl', name: t('enemy_pterodactyl'), letter: 'P',
  shape: 'triangle', color: '#808080', stroke: '#c0c0c0',
  w: 28, h: 16, hp: 18, speed: 140, damage: 15,
  xp: [12, 16], behavior: 'harpy', tier: 3, dropChance: 0.55,
  spawnWeight: 2, hitInterval: 0.5, wobble: 2,
  diveCooldown: 2.5, diveSpeed: 320, diveTime: 0.35, retreatDist: 100,
};

ENEMY_TYPES.giant_scorpion = {
  id: 'giant_scorpion', name: t('enemy_giant_scorpion'), letter: 'S',
  shape: 'oval', color: '#b8860b', stroke: '#ffd700',
  w: 30, h: 18, hp: 28, speed: 55, damage: 12,
  xp: [14, 18], behavior: 'giant_scorpion', tier: 3, dropChance: 0.65,
  spawnWeight: 2, hitInterval: 0.6, wobble: 1,
  stingCooldown: 3.0, stingPoisonDps: 6, stingPoisonDuration: 4,
  deathCloud: { radius: 40, dps: 3, life: 3 },
};

ENEMY_TYPES.lamia = {
  id: 'lamia', name: t('enemy_lamia'), letter: 'L',
  shape: 'oval', color: '#228b22', stroke: '#90ee90',
  w: 28, h: 20, hp: 30, speed: 50, damage: 14,
  xp: [18, 22], behavior: 'lamia', tier: 3, dropChance: 0.70,
  spawnWeight: 2, hitInterval: 0.7, wobble: 1.5,
  charmCooldown: 5.0, charmPullDist: 50, charmDamage: 10, keepDistMin: 100, keepDistMax: 140,
};



/* ===== ТИР 4 — серьёзные угрозы (61–70) ===== */
ENEMY_TYPES.dragon_wyrm = {
  id: 'dragon_wyrm', name: t('enemy_dragon_wyrm'), letter: 'W',
  shape: 'oval', color: '#cc0000', stroke: '#ff6666',
  w: 32, h: 14, hp: 35, speed: 120, damage: 14,
  xp: [20, 24], behavior: 'dragon_wyrm', tier: 4, dropChance: 0.70,
  spawnWeight: 2, hitInterval: 0.6, wobble: 2,
  breathCooldown: 5.0, breathRange: 80, breathPoisonDps: 5, breathPoisonDuration: 4,
};

ENEMY_TYPES.salamander = {
  id: 'salamander', name: t('enemy_salamander'), letter: 'S',
  shape: 'oval', color: '#ff6600', stroke: '#ffcc00',
  w: 28, h: 16, hp: 30, speed: 55, damage: 16,
  xp: [18, 22], behavior: 'fire_elem', tier: 4, dropChance: 0.70,
  spawnWeight: 2, hitInterval: 0.7, wobble: 1.5,
  trailEvery: 0.4,
  trail: { kind: 'fire', radius: 18, life: 2, dps: 5 },
  explodeOnDeath: { radius: 60, damage: 18 },
  immuneFire: true,
};

ENEMY_TYPES.water_elem_large = {
  id: 'water_elem_large', name: t('enemy_water_elem_large'), letter: 'E',
  shape: 'oval', color: '#4488cc', stroke: '#aaddff',
  w: 36, h: 24, hp: 50, speed: 28, damage: 16,
  xp: [23, 27], behavior: 'water_elem', tier: 4, dropChance: 0.80,
  spawnWeight: 1, hitInterval: 0.8, wobble: 2,
  trailEvery: 0.5,
  trail: { kind: 'water', radius: 24, life: 3, slow: 0.20, dps: 0 },
  waveCooldown: 4.0, waveRange: 120, waveDamage: 16, waveKnockback: 50,
  deathFlood: { radius: 80, slow: 0.50, duration: 4.0 },
};

ENEMY_TYPES.air_elem = {
  id: 'air_elem', name: t('enemy_air_elem'), letter: 'A',
  shape: 'diamond', color: '#ddeeff', stroke: '#ffffff',
  w: 30, h: 30, hp: 25, speed: 130, damage: 10,
  xp: [16, 20], behavior: 'air_elem', tier: 4, dropChance: 0.65,
  spawnWeight: 2, hitInterval: 0.5, wobble: 2,
  gustCooldown: 3.0, gustRange: 100, gustDamage: 10, gustKnockback: 60,
  ignoreWalls: true,
};

ENEMY_TYPES.gargoyle = {
  id: 'gargoyle', name: t('enemy_gargoyle'), letter: 'G',
  shape: 'rect', color: '#606060', stroke: '#b0b0b0',
  w: 26, h: 26, hp: 28, speed: 130, damage: 16,
  xp: [18, 22], behavior: 'gargoyle', tier: 4, dropChance: 0.70,
  spawnWeight: 2, hitInterval: 0.5, wobble: 0,
  activateRadius: 100,
};

ENEMY_TYPES.banshee = {
  id: 'banshee', name: t('enemy_banshee'), letter: 'B',
  shape: 'oval', color: '#ffffff', stroke: '#ccccff',
  w: 24, h: 24, hp: 22, speed: 60, damage: 8,
  xp: [23, 27], behavior: 'banshee', tier: 4, dropChance: 0.75,
  spawnWeight: 1, hitInterval: 0.7, wobble: 2,
  screamCooldown: 6.0, screamRadius: 120, screamDamage: 20, screamFearDuration: 1.0,
  ignoreWalls: true,
};

ENEMY_TYPES.vampire_spawn = {
  id: 'vampire_spawn', name: t('enemy_vampire_spawn'), letter: 'V',
  shape: 'rect', color: '#ffcccc', stroke: '#cc0000',
  w: 26, h: 26, hp: 30, speed: 120, damage: 15,
  xp: [20, 24], behavior: 'vampire_spawn', tier: 4, dropChance: 0.70,
  spawnWeight: 2, hitInterval: 0.5, wobble: 1.5,
  vampirismPct: 0.50, lightVulnMul: 2.0,
};

ENEMY_TYPES.doppelganger_mage = {
  id: 'doppelganger_mage', name: t('enemy_doppelganger_mage'), letter: 'D',
  shape: 'rect', color: '#4444ff', stroke: '#aa00ff',
  w: 28, h: 28, hp: 35, speed: 180, damage: 0,
  xp: [28, 32], behavior: 'doppelganger_mage', tier: 4, dropChance: 0.80,
  spawnWeight: 1, hitInterval: 0.8, wobble: 1.5,
  copyDamageMul: 0.50, attackCooldown: 1.5, splitCount: 2, splitHp: 15,
};

ENEMY_TYPES.owlbear = {
  id: 'owlbear', name: t('enemy_owlbear'), letter: 'O',
  shape: 'oval', color: '#8b5a2b', stroke: '#d4a06a',
  w: 32, h: 22, hp: 40, speed: 110, damage: 14,
  xp: [23, 27], behavior: 'owlbear', tier: 4, dropChance: 0.75,
  spawnWeight: 2, hitInterval: 0.6, wobble: 1,
  dashCooldown: 3.0, dashSpeed: 280, dashTime: 0.35, dashDamage: 18,
};

ENEMY_TYPES.ice_elem = {
  id: 'ice_elem', name: t('enemy_ice_elem'), letter: 'E',
  shape: 'rect', color: '#88ccff', stroke: '#ffffff',
  w: 32, h: 32, hp: 40, speed: 28, damage: 12,
  xp: [20, 24], behavior: 'ice_elem', tier: 4, dropChance: 0.75,
  spawnWeight: 1, hitInterval: 0.8, wobble: 1,
  breathCooldown: 4.0, breathRange: 90, breathSlowPct: 0.50, breathSlowDuration: 2.0,
  wallCooldown: 5.0, wallLength: 60, wallDuration: 4.0,
  explodeOnDeath: { radius: 60, damage: 10 },
  deathSlow: { radius: 60, slowPct: 0.80, duration: 1.0 },
};



/* ===== ТИР 5 — редкие, сильные (71–80) ===== */
ENEMY_TYPES.adult_dragon = {
  id: 'adult_dragon', name: t('enemy_adult_dragon'), letter: 'D',
  shape: 'diamond', color: '#cc0000', stroke: '#ffd700',
  w: 56, h: 36, hp: 150, speed: 110, damage: 25,
  xp: [75, 85], behavior: 'adult_dragon', tier: 5, dropChance: 1.0,
  spawnWeight: 0, hitInterval: 0.8, wobble: 3,
  breathCooldown: 5.0, breathRange: 140, breathDamage: 30, breathSpread: 5,
  tailSweep: { damage: 25, radius: 80, cooldown: 7.0, knockback: 60 },
  rageHpPct: 0.30, rageSpeedMul: 1.50, rageCdMul: 0.50,
  rareSpawn: true, maxPerRun: 1,
};

ENEMY_TYPES.demon_destroyer = {
  id: 'demon_destroyer', name: t('enemy_demon_destroyer'), letter: 'D',
  shape: 'rect', color: '#990000', stroke: '#ff3300',
  w: 48, h: 48, hp: 180, speed: 22, damage: 28,
  xp: [95, 105], behavior: 'demon_destroyer', tier: 5, dropChance: 1.0,
  spawnWeight: 0, hitInterval: 0.9, wobble: 0.5,
  whipCooldown: 3.0, whipRange: 150, whipDamage: 28,
  meteorCooldown: 7.0, meteorCount: 3, meteorRadius: 50, meteorDamage: 22, meteorSpread: 150,
  rareSpawn: true, maxPerRun: 1,
};

ENEMY_TYPES.illithid_arcanist = {
  id: 'illithid_arcanist', name: t('enemy_illithid_arcanist'), letter: 'I',
  shape: 'rect', color: '#6600cc', stroke: '#cc99ff',
  w: 30, h: 30, hp: 45, speed: 50, damage: 25,
  xp: [42, 48], behavior: 'illithid_arcanist', tier: 5, dropChance: 0.90,
  spawnWeight: 1, hitInterval: 0.7, wobble: 1.5,
  keepDistMin: 130, keepDistMax: 170,
  blastCooldown: 4.0, blastRadius: 60, blastDamage: 25,
  enslaveCooldown: 8.0, enslaveBuffHp: 0.50, enslaveBuffDmg: 0.50,
  killSummonsOnDeath: true,
};

ENEMY_TYPES.rakshasa = {
  id: 'rakshasa', name: t('enemy_rakshasa'), letter: 'R',
  shape: 'rect', color: '#ff8c00', stroke: '#ffcc00',
  w: 34, h: 34, hp: 60, speed: 110, damage: 22,
  xp: [38, 42], behavior: 'rakshasa', tier: 5, dropChance: 0.90,
  spawnWeight: 1, hitInterval: 0.6, wobble: 1.5,
  magicResist: 0.50, illusionCooldown: 5.0, illusionCount: 2, illusionHp: 15,
  bleedDps: 4, bleedDuration: 3,
};

ENEMY_TYPES.golem_colossus = {
  id: 'golem_colossus', name: t('enemy_golem_colossus'), letter: 'C',
  shape: 'rect', color: '#808080', stroke: '#d0d0d0',
  w: 52, h: 52, hp: 250, speed: 18, damage: 35,
  xp: [115, 125], behavior: 'golem_colossus', tier: 5, dropChance: 1.0,
  spawnWeight: 0, hitInterval: 1.0, wobble: 0,
  slamCooldown: 6.0, slamRadius: 80, slamDamage: 45, slamStun: 1.0,
  deathShockwave: { radius: 120, damage: 30 },
  immunePoison: true, immuneBleed: true,
  rareSpawn: true, maxPerRun: 1,
};

ENEMY_TYPES.shadow_dragon = {
  id: 'shadow_dragon', name: t('enemy_shadow_dragon'), letter: 'S',
  shape: 'diamond', color: '#1a1a1a', stroke: '#666666',
  w: 44, h: 28, hp: 100, speed: 110, damage: 20,
  xp: [65, 75], behavior: 'shadow_dragon', tier: 5, dropChance: 1.0,
  spawnWeight: 0, hitInterval: 0.7, wobble: 2,
  breathCooldown: 4.0, breathRange: 120, breathDamage: 25, breathDebuffMul: 0.30, breathDebuffDuration: 3.0,
  summonHpPct: 0.50, summonChildId: 'shadow', summonCount: 2,
  rareSpawn: true, maxPerRun: 1,
};

ENEMY_TYPES.slime_queen = {
  id: 'slime_queen', name: t('enemy_slime_queen'), letter: 'Q',
  shape: 'oval', color: '#00cc00', stroke: '#66ff66',
  w: 48, h: 32, hp: 120, speed: 18, damage: 0,
  xp: [55, 65], behavior: 'slime_queen', tier: 5, dropChance: 1.0,
  spawnWeight: 0, hitInterval: 0.8, wobble: 1,
  trailEvery: 0.3,
  trail: { kind: 'acid', radius: 24, life: 3, dps: 10, slow: 0 },
  shotCooldown: 3.0, shotCount: 3, shotDamage: 8, shotSpeed: 220, shotSlow: 0.30,
  splitOnDeath: { childId: 'ooze', count: 5 },
  rareSpawn: true, maxPerRun: 1,
};

ENEMY_TYPES.iron_golem = {
  id: 'iron_golem', name: t('enemy_iron_golem'), letter: 'I',
  shape: 'rect', color: '#708090', stroke: '#b0c4de',
  w: 38, h: 38, hp: 90, speed: 28, damage: 22,
  xp: [42, 48], behavior: 'iron_golem', tier: 5, dropChance: 0.90,
  spawnWeight: 1, hitInterval: 0.8, wobble: 0.5,
  shockChance: 0.20, shockRadius: 70, shockDamage: 16,
  fireVulnMul: 2.0, fireSpeedBoost: 0.30, fireSpeedDuration: 3.0,
  immuneElectric: true,
};

ENEMY_TYPES.archdemon = {
  id: 'archdemon', name: t('enemy_archdemon'), letter: 'A',
  shape: 'rect', color: '#660000', stroke: '#ff0000',
  w: 50, h: 50, hp: 200, speed: 55, damage: 25,
  xp: [140, 160], behavior: 'archdemon', tier: 5, dropChance: 1.0,
  spawnWeight: 0, hitInterval: 0.8, wobble: 0.5,
  breathCooldown: 4.0, breathRange: 130, breathDamage: 28, breathSpread: 5,
  ringCooldown: 6.0, ringDamage: 24, ringMaxRadius: 120, ringExpandTime: 0.6,
  explodeOnDeath: { radius: 150, damage: 50 },
  rareSpawn: true, maxPerRun: 1,
};

ENEMY_TYPES.star_spawn = {
  id: 'star_spawn', name: t('enemy_star_spawn'), letter: 'S',
  shape: 'oval', color: '#330066', stroke: '#9933ff',
  w: 36, h: 24, hp: 65, speed: 50, damage: 20,
  xp: [48, 52], behavior: 'star_spawn', tier: 5, dropChance: 0.95,
  spawnWeight: 1, hitInterval: 0.7, wobble: 2,
  psionicCooldown: 3.0, psionicRadius: 80, psionicDamage: 20, disorientDuration: 1.0,
  summonCooldown: 5.0, summonChildId: 'gasspore', summonCount: 2,
  deathZone: { radius: 100, slowPct: 0.50, duration: 5.0 },
};



/* ===== НОВЫЙ ТИР 6 (волны 10+) — легендарные (81–90) ===== */
ENEMY_TYPES.ancient_dragon = {
  id: 'ancient_dragon', name: t('enemy_ancient_dragon'), letter: 'A',
  shape: 'diamond', color: '#ffd700', stroke: '#ff4500',
  w: 64, h: 40, hp: 300, speed: 60, damage: 35,
  xp: [190, 210], behavior: 'ancient_dragon', tier: 6, dropChance: 1.0,
  spawnWeight: 1, hitInterval: 0.8, wobble: 3,
  breathCooldown: 6.0, breathRange: 180, breathDamage: 40, breathSpread: 7,
  auraRadius: 120, auraSlowPct: 0.20,
  rageHpPct: 0.20, rageSpeedMul: 1.50, rageCdMul: 0.50,
};

ENEMY_TYPES.kraken_tentacle = {
  id: 'kraken_tentacle', name: t('enemy_kraken_tentacle'), letter: 'K',
  shape: 'rect', color: '#006633', stroke: '#00cc66',
  w: 20, h: 80, hp: 100, speed: 0, damage: 30,
  xp: [75, 85], behavior: 'kraken_tentacle', tier: 6, dropChance: 1.0,
  spawnWeight: 1, hitInterval: 0.5, wobble: 0,
  slamCooldown: 2.0, slamRadius: 150, slamDamage: 30,
};

ENEMY_TYPES.tarrasque_juv = {
  id: 'tarrasque_juv', name: t('enemy_tarrasque_juv'), letter: 'T',
  shape: 'rect', color: '#8b4513', stroke: '#daa520',
  w: 60, h: 60, hp: 500, speed: 15, damage: 50,
  xp: [280, 320], behavior: 'tarrasque', tier: 6, dropChance: 1.0,
  spawnWeight: 0, hitInterval: 1.0, wobble: 0,
  magicResist: 0.80, physReflect: 0.30,
  stompCooldown: 8.0, stompRadius: 200, stompDamage: 35, stompStun: 1.5,
  rareSpawn: true, maxPerRun: 1,
};

ENEMY_TYPES.chaos_god = {
  id: 'chaos_god', name: t('enemy_chaos_god'), letter: 'C',
  shape: 'rect', color: '#ff00ff', stroke: '#00ffff',
  w: 44, h: 44, hp: 250, speed: 55, damage: 35,
  xp: [235, 265], behavior: 'chaos_god', tier: 6, dropChance: 1.0,
  spawnWeight: 0, hitInterval: 0.8, wobble: 1,
  beamCooldown: 3.0, beamDamage: 35, beamSpeed: 200,
  waveCooldown: 8.0, waveRadius: 160, waveDamage: 25,
  deathExplosion: { radius: 200, damage: 60 },
  rareSpawn: true, maxPerRun: 1,
  colorShift: true,
};

ENEMY_TYPES.vampire_lord = {
  id: 'vampire_lord', name: t('enemy_vampire_lord'), letter: 'V',
  shape: 'rect', color: '#1a0000', stroke: '#cc0000',
  w: 34, h: 34, hp: 120, speed: 120, damage: 28,
  xp: [85, 95], behavior: 'vampire_lord', tier: 6, dropChance: 1.0,
  spawnWeight: 1, hitInterval: 0.5, wobble: 1.5,
  vampirismPct: 1.0,
  mistCooldown: 5.0, mistDuration: 2.0, mistDamage: 20,
  deathMist: { regenDelay: 10.0, regenPct: 0.50 },
};

ENEMY_TYPES.demilich = {
  id: 'demilich', name: t('enemy_demilich'), letter: 'D',
  shape: 'circle', color: '#ffd700', stroke: '#ffffff',
  w: 20, h: 20, hp: 80, speed: 55, damage: 15,
  xp: [95, 105], behavior: 'demilich', tier: 6, dropChance: 1.0,
  spawnWeight: 1, hitInterval: 0.7, wobble: 2,
  keepDistMin: 120, keepDistMax: 160,
  howlCooldown: 6.0, howlRadius: 150, howlDamage: 30, howlFearDuration: 1.0,
  soulGrabRadius: 80, soulGrabDps: 15, soulGrabSlow: 0.40,
  deathSummon: { childId: 'mage', count: 5 },
};

ENEMY_TYPES.empyrean = {
  id: 'empyrean', name: t('enemy_empyrean'), letter: 'E',
  shape: 'diamond', color: '#ffffcc', stroke: '#ffd700',
  w: 36, h: 36, hp: 150, speed: 55, damage: 25,
  xp: [115, 125], behavior: 'empyrean', tier: 6, dropChance: 1.0,
  spawnWeight: 1, hitInterval: 0.7, wobble: 2,
  beamCooldown: 2.0, beamDamage: 25, beamSpeed: 350,
  pillarCooldown: 7.0, pillarCount: 3, pillarRadius: 60, pillarDamage: 30, pillarSpread: 150,
  immuneLight: true,
};

ENEMY_TYPES.beast_lord = {
  id: 'beast_lord', name: t('enemy_beast_lord'), letter: 'B',
  shape: 'rect', color: '#2e8b2e', stroke: '#66ff66',
  w: 36, h: 36, hp: 70, speed: 55, damage: 22,
  xp: [50, 60], behavior: 'beast_lord', tier: 6, dropChance: 0.95,
  spawnWeight: 1, hitInterval: 0.7, wobble: 1,
  summonCooldown: 8.0, maxSummons: 6,
  summonPool: ['giant_rat', 'cave_bear', 'owlbear'],
};

ENEMY_TYPES.titan_elem = {
  id: 'titan_elem', name: t('enemy_titan_elem'), letter: 'E',
  shape: 'rect', color: '#cc0000', stroke: '#ffcc00',
  w: 42, h: 42, hp: 180, speed: 28, damage: 25,
  xp: [125, 135], behavior: 'titan_elem', tier: 6, dropChance: 1.0,
  spawnWeight: 1, hitInterval: 0.8, wobble: 0.5,
  phaseCooldown: 5.0,
  phases: {
    fire:  { color: '#cc0000', dps: 8, trail: 'fire' },
    water: { color: '#4488cc', slow: 0.40, knockback: 50 },
    earth: { color: '#8b6b3a', wallDuration: 3.0, stun: 0.5 },
    air:   { color: '#ddeeff', speedMul: 2.0, dodgeChance: 0.40 },
  },
  explodeOnDeath: { radius: 140, damage: 30 },
};

ENEMY_TYPES.night_walker = {
  id: 'night_walker', name: t('enemy_night_walker'), letter: 'N',
  shape: 'rect', color: '#0a0a0a', stroke: '#333333',
  w: 28, h: 28, hp: 35, speed: 120, damage: 20,
  xp: [38, 42], behavior: 'night_walker', tier: 6, dropChance: 0.85,
  spawnWeight: 2, hitInterval: 0.5, wobble: 1.5,
  invisible: true, backstabMul: 2.0,
  visibleNearHolyAura: true,
};



/* ===== Элитные вариации (91–100) ===== */
const ELITE_VARIANTS = [
  { baseId: 'captain',         eliteId: 'elite_captain' },
  { baseId: 'gnoll',           eliteId: 'elite_gnoll' },
  { baseId: 'minotaur',        eliteId: 'elite_minotaur' },
  { baseId: 'dragonid',        eliteId: 'elite_dragonid' },
  { baseId: 'demon_berserker', eliteId: 'elite_demon_berserker' },
  { baseId: 'earth_elem',      eliteId: 'elite_earth_elem' },
  { baseId: 'vampire_spawn',   eliteId: 'elite_vampire_spawn' },
  { baseId: 'death_knight',    eliteId: 'elite_death_knight' },
  { baseId: 'young_dragon',    eliteId: 'elite_young_dragon' },
  { baseId: 'illithid',        eliteId: 'elite_illithid' },
];

// Generate elite enemy type entries from base types
for (const ev of ELITE_VARIANTS) {
  const base = ENEMY_TYPES[ev.baseId];
  if (!base) continue;
  ENEMY_TYPES[ev.eliteId] = Object.assign({}, base, {
    id: ev.eliteId,
    name: base.name + ' (Elite)',
    letter: '★',
    w: Math.round(base.w * 1.20),
    h: Math.round(base.h * 1.20),
    hp: Math.round(base.hp * 1.80),
    speed: Math.round(base.speed * 1.10),
    damage: Math.round(base.damage * 1.30),
    xp: [Math.round(base.xp[0] * 2), Math.round(base.xp[1] * 2)],
    tier: 0,             // не в обычных волнах, спавнятся через элитную систему
    dropChance: 1.0,
    spawnWeight: 0,
    isEliteVariant: true,
    eliteAuraRadius: 80,
    eliteAuraDmgBuff: 0.15,
    eliteDeathElement: ['fire', 'ice', 'poison', 'dark'][Math.floor(Math.random() * 4)],
  });
}

window.ELITE_VARIANTS = ELITE_VARIANTS;


/* ===== Обновление ENEMY_TIERS ===== */

// Расширяем существующие тиры новыми врагами
ENEMY_TIERS[3].ids.push('bone_golem', 'phase_spider', 'ettercap', 'fungal_man', 'troll',
  'cave_bear', 'ogre', 'pterodactyl', 'giant_scorpion', 'lamia');

ENEMY_TIERS[4].ids.push('dragon_wyrm', 'salamander', 'water_elem_large', 'air_elem',
  'gargoyle', 'banshee', 'vampire_spawn', 'doppelganger_mage', 'owlbear', 'ice_elem');

ENEMY_TIERS[5].ids.push('illithid_arcanist', 'rakshasa', 'iron_golem', 'star_spawn');

// Новый тир 6 (волны 12+)
ENEMY_TIERS[6] = {
  unlockWave: 12,
  ids: ['ancient_dragon', 'kraken_tentacle', 'vampire_lord', 'demilich',
        'empyrean', 'beast_lord', 'titan_elem', 'night_walker'],
};

// Обновляем _availableTierIds чтобы учитывать тир 6
const _origAvailableTierIds = Enemies._availableTierIds;
Enemies._availableTierIds = function(waveIndex) {
  const out = [];
  for (let t = 1; t <= 6; t++) {
    const tier = ENEMY_TIERS[t];
    if (tier && waveIndex >= tier.unlockWave) out.push(...tier.ids);
  }
  return out.length ? out : ENEMY_TIERS[1].ids.slice();
};

// Обновляем систему редких спавнов
const _step12RareIds = ['adult_dragon', 'demon_destroyer', 'golem_colossus',
  'shadow_dragon', 'slime_queen', 'archdemon', 'tarrasque_juv', 'chaos_god'];

// Merge into rare spawn state
for (const rid of _step12RareIds) {
  Enemies._rareSpawnState[rid] = 0;
}

const _origTryRareSpawn = Enemies.tryRareSpawn;
Enemies.tryRareSpawn = function(player, runTime, waveIndex) {
  _origTryRareSpawn.call(Enemies, player, runTime, waveIndex);
  // Tier 5 rare spawns (wave 8+)
  if (waveIndex < 8) return;
  const tier5Rares = ['adult_dragon', 'demon_destroyer', 'golem_colossus',
    'shadow_dragon', 'slime_queen', 'archdemon'];
  for (const rid of tier5Rares) {
    const cfg = ENEMY_TYPES[rid];
    if (!cfg) continue;
    const maxPer = cfg.maxPerRun || 1;
    if ((Enemies._rareSpawnState[rid] || 0) >= maxPer) continue;
    if (Math.random() > 0.02) continue;
    let ex, ey;
    if (window.GameMap && GameMap.dungeon) {
      const pt = GameMap.randomEnemySpawnPoint(player, 400, 600);
      if (!pt) continue;
      ex = pt.x; ey = pt.y;
    } else {
      const ang = Math.random() * Math.PI * 2;
      const dist = Utils.rand(400, 600);
      ex = player.x + Math.cos(ang) * dist;
      ey = player.y + Math.sin(ang) * dist;
    }
    const spawned = Enemies.spawnByType(Game.enemies, rid, ex, ey);
    if (spawned) {
      Enemies._rareSpawnState[rid] = (Enemies._rareSpawnState[rid] || 0) + 1;
      if (window.Particles) {
        Particles.ring(ex, ey, 60, 0.8, 'rgba(255,100,0,0.9)', 5);
        Particles.burst(ex, ey, 10, {
          color: '#ffd700', speedMin: 80, speedMax: 200,
          lifeMin: 0.4, lifeMax: 0.8, sizeMin: 3, sizeMax: 6,
        });
      }
    }
  }
  // Tier 6 rare spawns (wave 10+)
  if (waveIndex < 10) return;
  const tier6Rares = ['tarrasque_juv', 'chaos_god'];
  for (const rid of tier6Rares) {
    const cfg = ENEMY_TYPES[rid];
    if (!cfg) continue;
    const maxPer = cfg.maxPerRun || 1;
    if ((Enemies._rareSpawnState[rid] || 0) >= maxPer) continue;
    if (Math.random() > 0.01) continue;
    let ex, ey;
    if (window.GameMap && GameMap.dungeon) {
      const pt = GameMap.randomEnemySpawnPoint(player, 400, 600);
      if (!pt) continue;
      ex = pt.x; ey = pt.y;
    } else {
      const ang = Math.random() * Math.PI * 2;
      const dist = Utils.rand(400, 600);
      ex = player.x + Math.cos(ang) * dist;
      ey = player.y + Math.sin(ang) * dist;
    }
    const spawned = Enemies.spawnByType(Game.enemies, rid, ex, ey);
    if (spawned) {
      Enemies._rareSpawnState[rid] = (Enemies._rareSpawnState[rid] || 0) + 1;
      if (window.Particles) {
        Particles.ring(ex, ey, 80, 1.0, 'rgba(160,0,255,0.9)', 6);
        Particles.burst(ex, ey, 12, {
          color: '#ff00ff', speedMin: 100, speedMax: 250,
          lifeMin: 0.5, lifeMax: 1.0, sizeMin: 3, sizeMax: 7,
        });
      }
    }
  }
};

// Patch initMimicState to reset all rare spawns
const _origInitMimicState2 = Enemies.initMimicState;
Enemies.initMimicState = function() {
  for (const rid of _step12RareIds) {
    Enemies._rareSpawnState[rid] = 0;
  }
  return _origInitMimicState2.call(Enemies);
};
'use strict';
/* ============================================================
   constants_expansion.js — 50 новых типов врагов + 5 мини-боссов.
   Добавляет записи в ENEMY_TYPES, расширяет ENEMY_TIERS,
   добавляет боссов в BOSS_TYPES и BOSS_CONFIG.
   Загружается ПОСЛЕ constants.js и constants_step12.js.
   ============================================================ */

/* =============================================================
   ТИР 1 — Волны 1-2 (8 врагов)
   ============================================================= */

ENEMY_TYPES.plague_rat = {
  id: 'plague_rat', name: t('enemy_plague_rat'), letter: 'P',
  shape: 'oval', color: '#4a3a1a', stroke: '#8b6b3a',
  w: 16, h: 10, hp: 8, speed: 110, damage: 4,
  xp: [3, 6], behavior: 'plague_rat', tier: 1, dropChance: 0.35,
  spawnWeight: 3, hitInterval: 0.5, wobble: 1,
  // При смерти — чумной DoT ближайшему врагу (усиливает моба)
  deathPlague: { radius: 80, dotDps: 2, dotDuration: 3, chainCount: 2 },
};


ENEMY_TYPES.mushroom_sprite = {
  id: 'mushroom_sprite', name: t('enemy_mushroom_sprite'), letter: 'G',
  shape: 'circle', color: '#7a5a3a', stroke: '#c9a060',
  w: 14, h: 14, hp: 6, speed: 45, damage: 3,
  xp: [2, 5], behavior: 'mushroom_sprite', tier: 1, dropChance: 0.30,
  spawnWeight: 3, hitInterval: 0.6, wobble: 1.5,
  // Споровый шлейф — невидимые споры взрываются при касании
  sporeTrailEvery: 0.8, sporeTrailRadius: 18, sporeTrailLife: 4,
  sporeTrailDamage: 3, sporeTrailSlow: 0.20, sporeTrailSlowDur: 0.3,
};

ENEMY_TYPES.bone_crawler = {
  id: 'bone_crawler', name: t('enemy_bone_crawler'), letter: 'C',
  shape: 'oval', color: '#d9d0c0', stroke: '#ffffff',
  w: 20, h: 12, hp: 14, speed: 60, damage: 6,
  xp: [4, 7], behavior: 'bone_crawler', tier: 1, dropChance: 0.40,
  spawnWeight: 3, hitInterval: 0.5, wobble: 0.5,
  // Движется вдоль стен, атакует при проходе героя мимо
  wallHugRange: 40, lungeRange: 50, lungeSpeed: 180, lungeTime: 0.25,
};

ENEMY_TYPES.wisp_minor = {
  id: 'wisp_minor', name: t('enemy_wisp_minor'), letter: 'W',
  shape: 'circle', color: '#ffdd44', stroke: '#ffffff',
  w: 12, h: 12, hp: 5, speed: 70, damage: 4,
  xp: [3, 5], behavior: 'wisp_minor', tier: 1, dropChance: 0.30,
  spawnWeight: 3, hitInterval: 0.6, wobble: 2,
  // Мерцание — неуязвим 0.5с, затем перемещается
  flickerInterval: 2.5, flickerInvulnTime: 0.5, flickerTeleportDist: 60,
};


ENEMY_TYPES.carrion_beetle = {
  id: 'carrion_beetle', name: t('enemy_carrion_beetle'), letter: 'B',
  shape: 'oval', color: '#2a4a2a', stroke: '#66aa66',
  w: 18, h: 12, hp: 10, speed: 55, damage: 5,
  xp: [3, 6], behavior: 'carrion_beetle', tier: 1, dropChance: 0.35,
  spawnWeight: 3, hitInterval: 0.6, wobble: 1,
  // Пожиратель — усиливается при смерти ближних врагов
  feedRadius: 100, feedHpBonus: 0.20, feedSpeedBonus: 0.10, feedMaxStacks: 3,
};

ENEMY_TYPES.mud_imp = {
  id: 'mud_imp', name: t('enemy_mud_imp'), letter: 'I',
  shape: 'triangle', color: '#6b4a2a', stroke: '#a08060',
  w: 16, h: 16, hp: 10, speed: 80, damage: 5,
  xp: [4, 6], behavior: 'mud_imp', tier: 1, dropChance: 0.35,
  spawnWeight: 3, hitInterval: 0.5, wobble: 1.5,
  // Грязевая ловушка
  mudCooldown: 5.0, mudRadius: 25, mudSlow: 0.20, mudLife: 3.0,
  mudSelfSpeedBonus: 1.30,
};

ENEMY_TYPES.spirit_wisp = {
  id: 'spirit_wisp', name: t('enemy_spirit_wisp'), letter: 'S',
  shape: 'circle', color: '#aaccff', stroke: '#ffffff',
  w: 14, h: 14, hp: 7, speed: 50, damage: 3,
  xp: [3, 5], behavior: 'spirit_wisp', tier: 1, dropChance: 0.30,
  spawnWeight: 2, hitInterval: 0.7, wobble: 2,
  // Магнит XP — притягивает кристаллы к себе
  xpMagnetRadius: 60, xpMagnetSpeed: 80,
};

ENEMY_TYPES.vine_creeper = {
  id: 'vine_creeper', name: t('enemy_vine_creeper'), letter: 'V',
  shape: 'oval', color: '#2a6b2a', stroke: '#80cc80',
  w: 22, h: 14, hp: 18, speed: 30, damage: 0,
  xp: [4, 7], behavior: 'vine_creeper', tier: 1, dropChance: 0.40,
  spawnWeight: 2, hitInterval: 0.8, wobble: 1,
  // Корневая привязка — замедление без урона
  rootSlow: 0.30, rootDuration: 1.0, rootRange: 30,
};


/* =============================================================
   ТИР 2 — Волны 3-5 (10 врагов)
   ============================================================= */

ENEMY_TYPES.necro_acolyte = {
  id: 'necro_acolyte', name: t('enemy_necro_acolyte'), letter: 'N',
  shape: 'rect', color: '#1a1a2a', stroke: '#8040c0',
  w: 22, h: 22, hp: 14, speed: 40, damage: 6,
  xp: [8, 12], behavior: 'necro_acolyte', tier: 2, dropChance: 0.55,
  spawnWeight: 2, hitInterval: 0.7, wobble: 1,
  // Подъём павших — поднимает скелет из свежего трупа
  raiseCooldown: 8.0, raiseChildId: 'skeleton', raiseRadius: 120, raiseCorpseAge: 5.0,
};

ENEMY_TYPES.sand_worm = {
  id: 'sand_worm', name: t('enemy_sand_worm'), letter: 'P',
  shape: 'oval', color: '#c9a84c', stroke: '#e8d080',
  w: 26, h: 14, hp: 20, speed: 70, damage: 12,
  xp: [9, 13], behavior: 'sand_worm', tier: 2, dropChance: 0.55,
  spawnWeight: 2, hitInterval: 0.6, wobble: 0,
  // Подземное движение — невидим при движении
  burrowTime: 2.0, surfaceTime: 1.0, surfaceDamage: 12, surfaceRadius: 30,
};

ENEMY_TYPES.toxic_toad = {
  id: 'toxic_toad', name: t('enemy_toxic_toad'), letter: 'T',
  shape: 'oval', color: '#4a8b4a', stroke: '#88ff88',
  w: 22, h: 16, hp: 18, speed: 35, damage: 8,
  xp: [8, 12], behavior: 'toxic_toad', tier: 2, dropChance: 0.55,
  spawnWeight: 2, hitInterval: 0.7, wobble: 1,
  // Прыжок + плевок + лужа яда
  jumpCooldown: 3.0, jumpSpeed: 250, jumpTime: 0.3,
  landingAoE: { radius: 30, life: 2, dps: 4, slow: 0 },
  spitCooldown: 2.5, spitSpeed: 240, spitDamage: 6, spitPoisonDps: 3, spitPoisonDur: 2,
};

ENEMY_TYPES.chain_phantom = {
  id: 'chain_phantom', name: t('enemy_chain_phantom'), letter: 'P',
  shape: 'diamond', color: '#4a4a6a', stroke: '#8888cc',
  w: 22, h: 22, hp: 16, speed: 50, damage: 10,
  xp: [9, 13], behavior: 'chain_phantom', tier: 2, dropChance: 0.55,
  spawnWeight: 2, hitInterval: 0.7, wobble: 1.5,
  // Привязка цепью — если герой отходит слишком далеко, рывок к нему
  chainRange: 80, chainMaxDist: 120, chainSnapDamage: 8, chainDashSpeed: 300,
  ignoreWalls: true,
};


ENEMY_TYPES.ember_moth = {
  id: 'ember_moth', name: t('enemy_ember_moth'), letter: 'M',
  shape: 'diamond', color: '#cc6600', stroke: '#ffaa00',
  w: 18, h: 12, hp: 12, speed: 90, damage: 6,
  xp: [7, 11], behavior: 'ember_moth', tier: 2, dropChance: 0.50,
  spawnWeight: 2, hitInterval: 0.5, wobble: 2,
  sinAmp: 22, sinFreq: 5,
  // Самовоспламенение
  igniteCooldown: 4.0, igniteTime: 1.0, igniteRadius: 40, igniteDamage: 8,
  explodeOnDeath: { radius: 35, damage: 10 },
};

ENEMY_TYPES.frozen_husk = {
  id: 'frozen_husk', name: t('enemy_frozen_husk'), letter: 'F',
  shape: 'rect', color: '#88bbdd', stroke: '#cceeFF',
  w: 26, h: 26, hp: 24, speed: 30, damage: 8,
  xp: [9, 13], behavior: 'chase', tier: 2, dropChance: 0.55,
  spawnWeight: 2, hitInterval: 0.8, wobble: 1,
  // Криовзрыв — при ударе в ближнем бою замедляет оружие героя
  frostRetaliateRange: 35, frostRetaliateCdAdd: 0.3, frostRetaliateDuration: 2.0,
};

ENEMY_TYPES.swarm_beetle = {
  id: 'swarm_beetle', name: t('enemy_swarm_beetle'), letter: 'S',
  shape: 'circle', color: '#333333', stroke: '#666666',
  w: 10, h: 10, hp: 3, speed: 80, damage: 3,
  xp: [1, 2], behavior: 'swarm_beetle', tier: 2, dropChance: 0.15,
  spawnWeight: 4, hitInterval: 0.4, wobble: 1,
  // Рой — если 3+ рядом, ускорение
  swarmRadius: 25, swarmMinCount: 3, swarmSpeedBonus: 0.50,
  spawnGroup: 5,
};

ENEMY_TYPES.mirror_wisp = {
  id: 'mirror_wisp', name: t('enemy_mirror_wisp'), letter: 'M',
  shape: 'circle', color: '#eeeeff', stroke: '#aaaaff',
  w: 16, h: 16, hp: 10, speed: 55, damage: 5,
  xp: [8, 12], behavior: 'mirror_wisp', tier: 2, dropChance: 0.50,
  spawnWeight: 2, hitInterval: 0.6, wobble: 2,
  // Отражение 1 снаряда за жизнь
  reflectChance: 0.25, reflectMaxUses: 1,
};

ENEMY_TYPES.root_shambler = {
  id: 'root_shambler', name: t('enemy_root_shambler'), letter: 'R',
  shape: 'rect', color: '#4a6a3a', stroke: '#80aa60',
  w: 26, h: 26, hp: 22, speed: 35, damage: 10,
  xp: [9, 14], behavior: 'root_shambler', tier: 2, dropChance: 0.55,
  spawnWeight: 2, hitInterval: 0.7, wobble: 1,
  // Подземные корни — линейная атака к герою
  rootAttackCooldown: 6.0, rootAttackWidth: 20, rootAttackDamage: 10, rootAttackSpeed: 200,
};

ENEMY_TYPES.plaguebearer = {
  id: 'plaguebearer', name: t('enemy_plaguebearer'), letter: 'P',
  shape: 'rect', color: '#3a4a2a', stroke: '#88aa66',
  w: 28, h: 28, hp: 28, speed: 35, damage: 8,
  xp: [10, 15], behavior: 'plaguebearer', tier: 2, dropChance: 0.60,
  spawnWeight: 2, hitInterval: 0.8, wobble: 1,
  // Аура болезни — снижает реген героя
  plagueAuraRadius: 50, plagueRegenReduction: 0.50,
  deathCloud: { radius: 80, dps: 3, life: 3, slow: 0 },
};


/* =============================================================
   ТИР 3 — Волны 6-9 (10 врагов)
   ============================================================= */

ENEMY_TYPES.clockwork_spider = {
  id: 'clockwork_spider', name: t('enemy_clockwork_spider'), letter: 'M',
  shape: 'diamond', color: '#8b8b00', stroke: '#cccc44',
  w: 24, h: 24, hp: 22, speed: 0, damage: 12,
  xp: [14, 18], behavior: 'clockwork_spider', tier: 3, dropChance: 0.65,
  spawnWeight: 2, hitInterval: 0.6, wobble: 0,
  // Тики — мгновенное перемещение каждые 1с
  tickInterval: 1.0, tickDistance: 60,
  deathShards: { count: 4, speed: 200, damage: 8, life: 1.5 },
};

ENEMY_TYPES.blood_ooze = {
  id: 'blood_ooze', name: t('enemy_blood_ooze'), letter: 'R',
  shape: 'oval', color: '#8b0000', stroke: '#ff4444',
  w: 28, h: 18, hp: 30, speed: 35, damage: 8,
  xp: [15, 19], behavior: 'blood_ooze', tier: 3, dropChance: 0.65,
  spawnWeight: 2, hitInterval: 0.7, wobble: 1.5,
  // Кровавый магнит — вытягивает HP
  drainRange: 80, drainDps: 3, drainHealMul: 1.0,
  // Чем ниже HP — тем быстрее
  speedHpScaling: true, maxSpeedBonus: 1.5,
};

ENEMY_TYPES.ash_wraith = {
  id: 'ash_wraith', name: t('enemy_ash_wraith'), letter: 'C',
  shape: 'oval', color: '#4a4a4a', stroke: '#888888',
  w: 24, h: 24, hp: 20, speed: 65, damage: 10,
  xp: [14, 18], behavior: 'ash_wraith', tier: 3, dropChance: 0.60,
  spawnWeight: 2, hitInterval: 0.6, wobble: 2,
  ignoreWalls: true,
  // Пепельная буря — затемнение экрана
  ashCloudRadius: 100, ashCloudOpacity: 0.30,
};

ENEMY_TYPES.crystal_golem = {
  id: 'crystal_golem', name: t('enemy_crystal_golem'), letter: 'R',
  shape: 'rect', color: '#66aacc', stroke: '#aaddff',
  w: 34, h: 34, hp: 50, speed: 25, damage: 18,
  xp: [18, 24], behavior: 'crystal_golem', tier: 3, dropChance: 0.75,
  spawnWeight: 1, hitInterval: 0.9, wobble: 0.5,
  // Преломление — расщепляет снаряды
  refractAngle: 0.52, refractDamageMul: 0.30,
  immuneMagic: true,
};


ENEMY_TYPES.nether_hound = {
  id: 'nether_hound', name: t('enemy_nether_hound'), letter: 'C',
  shape: 'diamond', color: '#330033', stroke: '#9933ff',
  w: 24, h: 24, hp: 22, speed: 100, damage: 12,
  xp: [14, 18], behavior: 'nether_hound', tier: 3, dropChance: 0.60,
  spawnWeight: 2, hitInterval: 0.5, wobble: 1.5,
  // Стая загона — координация с другим nether_hound
  packRadius: 100, packDamageBonus: 0.30,
};

ENEMY_TYPES.spore_carrier = {
  id: 'spore_carrier', name: t('enemy_spore_carrier'), letter: 'S',
  shape: 'oval', color: '#6b4a00', stroke: '#aa8844',
  w: 28, h: 18, hp: 28, speed: 40, damage: 8,
  xp: [15, 19], behavior: 'spore_carrier', tier: 3, dropChance: 0.65,
  spawnWeight: 2, hitInterval: 0.7, wobble: 1,
  // Деление при 50% HP
  splitHpPct: 0.50, splitCount: 2, splitHpMul: 0.30,
  deathCloud: { radius: 35, dps: 4, life: 2 },
};

ENEMY_TYPES.gravity_aberration = {
  id: 'gravity_aberration', name: t('enemy_gravity_aberration'), letter: 'G',
  shape: 'circle', color: '#220044', stroke: '#6600cc',
  w: 30, h: 30, hp: 35, speed: 25, damage: 8,
  xp: [16, 22], behavior: 'gravity_aberration', tier: 3, dropChance: 0.70,
  spawnWeight: 1, hitInterval: 0.8, wobble: 1,
  // Гравитационное поле — замедляет снаряды
  gravFieldRadius: 80, gravProjectileSlow: 0.50,
  gravPulseCooldown: 5.0, gravPullDist: 30, gravPulseRadius: 100,
};

ENEMY_TYPES.corpse_detonator = {
  id: 'corpse_detonator', name: t('enemy_corpse_detonator'), letter: 'T',
  shape: 'triangle', color: '#4a2a2a', stroke: '#aa4444',
  w: 22, h: 22, hp: 18, speed: 80, damage: 8,
  xp: [14, 18], behavior: 'corpse_detonator', tier: 3, dropChance: 0.60,
  spawnWeight: 2, hitInterval: 0.6, wobble: 1.5,
  // Детонация трупов — бежит к свежим трупам и взрывает
  detonateRadius: 50, detonateDamage: 15, detonateCharges: 3,
  seekCorpseRadius: 200, corpseMaxAge: 5.0,
};

ENEMY_TYPES.echo_shade = {
  id: 'echo_shade', name: t('enemy_echo_shade'), letter: 'E',
  shape: 'rect', color: '#1a1a2a', stroke: '#4444aa',
  w: 22, h: 22, hp: 20, speed: 0, damage: 14,
  xp: [15, 19], behavior: 'echo_shade', tier: 3, dropChance: 0.60,
  spawnWeight: 2, hitInterval: 0.5, wobble: 1,
  // Повторяет маршрут героя с задержкой
  echoDelay: 2.0, echoHistorySize: 60,
};

ENEMY_TYPES.magma_crab = {
  id: 'magma_crab', name: t('enemy_magma_crab'), letter: 'M',
  shape: 'oval', color: '#cc4400', stroke: '#ff8800',
  w: 30, h: 18, hp: 35, speed: 35, damage: 15,
  xp: [16, 22], behavior: 'magma_crab', tier: 3, dropChance: 0.70,
  spawnWeight: 2, hitInterval: 0.7, wobble: 1,
  // Раскалённый панцирь — урон в ближнем бою отражается
  meleeRetaliationDamage: 5,
  trailEvery: 0.6,
  trail: { kind: 'fire', radius: 16, life: 2, dps: 4 },
};


/* =============================================================
   ТИР 4 — Волны 10-14 (10 врагов)
   ============================================================= */

ENEMY_TYPES.void_stalker = {
  id: 'void_stalker', name: t('enemy_void_stalker'), letter: 'V',
  shape: 'rect', color: '#0d001a', stroke: '#6633cc',
  w: 24, h: 24, hp: 28, speed: 100, damage: 16,
  xp: [20, 26], behavior: 'void_stalker', tier: 4, dropChance: 0.70,
  spawnWeight: 2, hitInterval: 0.6, wobble: 1,
  // Телепорт за спину героя
  blinkCooldown: 4.0, backstabDamage: 22, idleBonus: 2.0,
};

ENEMY_TYPES.soul_collector = {
  id: 'soul_collector', name: t('enemy_soul_collector'), letter: 'S',
  shape: 'diamond', color: '#2a0044', stroke: '#aa44ff',
  w: 28, h: 28, hp: 35, speed: 45, damage: 12,
  xp: [22, 28], behavior: 'soul_collector', tier: 4, dropChance: 0.75,
  spawnWeight: 1, hitInterval: 0.7, wobble: 1.5,
  // Сбор душ — за каждую смерть врага рядом: +5% урон/размер
  soulRadius: 150, soulDmgBonus: 0.05, soulSizeBonus: 0.05,
  soulMaxStacks: 10, soulExplosionRadius: 100, soulExplosionDamage: 30,
};

ENEMY_TYPES.plague_golem = {
  id: 'plague_golem', name: t('enemy_plague_golem'), letter: 'G',
  shape: 'rect', color: '#3a5a3a', stroke: '#88cc88',
  w: 38, h: 38, hp: 70, speed: 22, damage: 20,
  xp: [28, 34], behavior: 'plague_golem', tier: 4, dropChance: 0.80,
  spawnWeight: 1, hitInterval: 0.9, wobble: 0.5,
  // Бактериальный щит — поглощает снаряды
  shieldCharges: 3, shieldRechargeTime: 8.0, shieldRadius: 30,
};

ENEMY_TYPES.thunder_elemental = {
  id: 'thunder_elemental', name: t('enemy_thunder_elemental'), letter: 'M',
  shape: 'diamond', color: '#ffff00', stroke: '#ffffff',
  w: 26, h: 26, hp: 22, speed: 130, damage: 14,
  xp: [20, 26], behavior: 'thunder_elemental', tier: 4, dropChance: 0.65,
  spawnWeight: 2, hitInterval: 0.5, wobble: 2,
  // Цепная молния — прыгает к следующей цели
  chainLightningRange: 100, chainLightningDamage: 8, chainLightningJumps: 2,
  attackCooldown: 2.5,
};


ENEMY_TYPES.bone_hydra_enemy = {
  id: 'bone_hydra_enemy', name: t('enemy_bone_hydra_enemy'), letter: 'G',
  shape: 'oval', color: '#d9d0c0', stroke: '#ffffff',
  w: 36, h: 24, hp: 50, speed: 28, damage: 10,
  xp: [26, 32], behavior: 'bone_hydra_enemy', tier: 4, dropChance: 0.80,
  spawnWeight: 1, hitInterval: 0.7, wobble: 1,
  // 3 головы, каждая стреляет независимо
  heads: 3, headCooldown: 2.0, headDamage: 8, headSpeed: 240,
  headRegenTime: 5.0, headRegenDmgBonus: 0.10,
};

ENEMY_TYPES.dream_weaver = {
  id: 'dream_weaver', name: t('enemy_dream_weaver'), letter: 'T',
  shape: 'circle', color: '#6644aa', stroke: '#cc88ff',
  w: 24, h: 24, hp: 25, speed: 50, damage: 10,
  xp: [22, 28], behavior: 'dream_weaver', tier: 4, dropChance: 0.70,
  spawnWeight: 2, hitInterval: 0.7, wobble: 2,
  // Иллюзии — создаёт зеркала себя
  illusionCooldown: 6.0, illusionCount: 2, illusionHp: 1,
  healPerIllusionKill: 5,
};

ENEMY_TYPES.rust_hulk = {
  id: 'rust_hulk', name: t('enemy_rust_hulk'), letter: 'S',
  shape: 'rect', color: '#8b5a00', stroke: '#cc8800',
  w: 40, h: 40, hp: 60, speed: 22, damage: 22,
  xp: [28, 34], behavior: 'rust_hulk', tier: 4, dropChance: 0.80,
  spawnWeight: 1, hitInterval: 0.9, wobble: 0.5,
  // Коррозийная аура — снижает урон оружий героя
  rustAuraRadius: 100, rustAuraDmgReduction: 0.15,
  explodeOnDeath: { radius: 70, damage: 0 },
  deathRustAura: { radius: 100, dmgReduction: 0.25, duration: 4.0 },
};

ENEMY_TYPES.parasite_host = {
  id: 'parasite_host', name: t('enemy_parasite_host'), letter: 'C',
  shape: 'oval', color: '#4a004a', stroke: '#aa44aa',
  w: 22, h: 16, hp: 18, speed: 90, damage: 10,
  xp: [18, 24], behavior: 'parasite_host', tier: 4, dropChance: 0.65,
  spawnWeight: 2, hitInterval: 0.6, wobble: 1.5,
  // При смерти — перепрыгивает на ближайшего врага
  parasiteJumpRadius: 150, parasiteHpBonus: 0.30,
  parasiteDmgBonus: 0.30, parasiteSpeedBonus: 0.15,
};

ENEMY_TYPES.hex_weaver = {
  id: 'hex_weaver', name: t('enemy_hex_weaver'), letter: 'H',
  shape: 'triangle', color: '#330066', stroke: '#9933ff',
  w: 24, h: 24, hp: 22, speed: 45, damage: 8,
  xp: [24, 30], behavior: 'hex_weaver', tier: 4, dropChance: 0.75,
  spawnWeight: 1, hitInterval: 0.7, wobble: 1.5,
  keepDistMin: 100, keepDistMax: 150,
  // Проклятие — случайный дебафф
  hexCooldown: 5.0, hexDuration: 1.5,
  hexTypes: ['slow', 'silence', 'blind', 'invert'],
};

ENEMY_TYPES.temporal_beetle = {
  id: 'temporal_beetle', name: t('enemy_temporal_beetle'), letter: 'H',
  shape: 'circle', color: '#004466', stroke: '#0088cc',
  w: 26, h: 26, hp: 30, speed: 40, damage: 10,
  xp: [22, 28], behavior: 'temporal_beetle', tier: 4, dropChance: 0.70,
  spawnWeight: 1, hitInterval: 0.7, wobble: 1,
  // Временной пузырь — зона замедления
  timeBubbleRadius: 60, timeBubblePlayerSlow: 0.50,
  timeBubbleSelfSpeed: 1.50,
};


/* =============================================================
   ТИР 5 — Волны 15+ (10 врагов)
   ============================================================= */

ENEMY_TYPES.entropy_golem = {
  id: 'entropy_golem', name: t('enemy_entropy_golem'), letter: 'E',
  shape: 'rect', color: '#2a0033', stroke: '#aa33ff',
  w: 42, h: 42, hp: 90, speed: 22, damage: 25,
  xp: [38, 46], behavior: 'entropy_golem', tier: 5, dropChance: 0.90,
  spawnWeight: 1, hitInterval: 0.9, wobble: 0.5,
  // Распад — создаёт ловушки на полу
  decayCooldown: 3.0, decayRadius: 80, decayTileDps: 5, decayTileLife: 4.0,
};

ENEMY_TYPES.soul_furnace = {
  id: 'soul_furnace', name: t('enemy_soul_furnace'), letter: 'D',
  shape: 'rect', color: '#4a1a00', stroke: '#ff6600',
  w: 38, h: 38, hp: 80, speed: 25, damage: 20,
  xp: [40, 48], behavior: 'soul_furnace', tier: 5, dropChance: 0.90,
  spawnWeight: 1, hitInterval: 0.8, wobble: 0.5,
  // Поглощение союзников
  absorbRadius: 80, absorbDmgBonus: 0.15, absorbHealPct: 0.10,
  absorbCooldown: 4.0,
};

ENEMY_TYPES.void_leviathan = {
  id: 'void_leviathan', name: t('enemy_void_leviathan'), letter: 'V',
  shape: 'oval', color: '#0d0033', stroke: '#4400aa',
  w: 44, h: 28, hp: 70, speed: 28, damage: 18,
  xp: [42, 50], behavior: 'void_leviathan', tier: 5, dropChance: 0.90,
  spawnWeight: 1, hitInterval: 0.8, wobble: 1,
  // Порталы — перенаправляют снаряды героя
  portalCooldown: 8.0, portalLife: 5.0, portalRadius: 30,
};

ENEMY_TYPES.plague_knight = {
  id: 'plague_knight', name: t('enemy_plague_knight'), letter: 'S',
  shape: 'rect', color: '#1a2a1a', stroke: '#44aa44',
  w: 36, h: 36, hp: 85, speed: 40, damage: 22,
  xp: [44, 52], behavior: 'plague_knight', tier: 5, dropChance: 0.90,
  spawnWeight: 1, hitInterval: 0.8, wobble: 0.5,
  // Проклятый клинок — отнимает бафф у героя
  cursedBladeDebuffDuration: 5.0,
  antiMagicShieldPct: 0.30, // первые 30% HP иммун к магии
};

ENEMY_TYPES.hive_queen = {
  id: 'hive_queen', name: t('enemy_hive_queen'), letter: 'M',
  shape: 'oval', color: '#6b6b00', stroke: '#cccc44',
  w: 36, h: 28, hp: 60, speed: 25, damage: 10,
  xp: [40, 48], behavior: 'hive_queen', tier: 5, dropChance: 0.90,
  spawnWeight: 1, hitInterval: 0.8, wobble: 1,
  // Непрерывный спавн жуков
  spawnCooldown: 3.0, spawnChildId: 'swarm_beetle', maxSpawns: 8,
  childImmortalWhileAlive: true, childRespawnTime: 2.0,
};


ENEMY_TYPES.chaos_chimera = {
  id: 'chaos_chimera', name: t('enemy_chaos_chimera'), letter: 'H',
  shape: 'rect', color: '#cc00cc', stroke: '#ff66ff',
  w: 38, h: 30, hp: 65, speed: 50, damage: 18,
  xp: [42, 50], behavior: 'chaos_chimera', tier: 5, dropChance: 0.90,
  spawnWeight: 1, hitInterval: 0.7, wobble: 1,
  // Мутация каждые 10с — меняет тип атаки
  mutationCooldown: 10.0, mutationStatBonus: 0.05,
  mutationTypes: ['fire', 'ice', 'poison', 'lightning'],
};

ENEMY_TYPES.obelisk_guardian = {
  id: 'obelisk_guardian', name: t('enemy_obelisk_guardian'), letter: 'W',
  shape: 'rect', color: '#4a4a6a', stroke: '#8888cc',
  w: 30, h: 44, hp: 70, speed: 0, damage: 0,
  xp: [38, 46], behavior: 'obelisk_guardian', tier: 5, dropChance: 0.85,
  spawnWeight: 1, hitInterval: 0, wobble: 0,
  // Неподвижный — луч к герою (DPS)
  beamRange: 200, beamBaseDps: 8, beamRampUpTime: 3.0, beamRampUpMul: 1.50,
};

ENEMY_TYPES.shadow_prince = {
  id: 'shadow_prince', name: t('enemy_shadow_prince'), letter: 'T',
  shape: 'rect', color: '#0a0a1a', stroke: '#4444aa',
  w: 30, h: 30, hp: 55, speed: 70, damage: 18,
  xp: [40, 48], behavior: 'shadow_prince', tier: 5, dropChance: 0.90,
  spawnWeight: 1, hitInterval: 0.6, wobble: 1,
  // Теневое удвоение при получении урона
  cloneChance: 0.20, cloneHpMul: 0.50, cloneMaxCount: 2, cloneLifetime: 5.0,
};

ENEMY_TYPES.abyssal_maw = {
  id: 'abyssal_maw', name: t('enemy_abyssal_maw'), letter: 'I',
  shape: 'circle', color: '#1a0022', stroke: '#660066',
  w: 40, h: 40, hp: 80, speed: 20, damage: 15,
  xp: [44, 52], behavior: 'abyssal_maw', tier: 5, dropChance: 0.90,
  spawnWeight: 1, hitInterval: 0.5, wobble: 0.5,
  // Притяжение + пожирание
  pullRadius: 120, pullSpeed: 3,
  devourRange: 25, devourDps: 15, devourEscapeDamage: 20,
};

ENEMY_TYPES.living_dungeon = {
  id: 'living_dungeon', name: t('enemy_living_dungeon'), letter: 'B',
  shape: 'rect', color: '#4a4a4a', stroke: '#888888',
  w: 44, h: 44, hp: 100, speed: 18, damage: 20,
  xp: [48, 56], behavior: 'living_dungeon', tier: 5, dropChance: 0.95,
  spawnWeight: 1, hitInterval: 0.9, wobble: 0,
  // Генерация стен — блокирует путь
  wallCooldown: 6.0, wallTiles: 3, wallLife: 5.0,
};


/* =============================================================
   ЭЛИТНЫЕ / ОСОБЫЕ — (2 врага)
   ============================================================= */

ENEMY_TYPES.doom_herald = {
  id: 'doom_herald', name: t('enemy_doom_herald'), letter: '!',
  shape: 'diamond', color: '#660000', stroke: '#ff0000',
  w: 30, h: 30, hp: 40, speed: 60, damage: 15,
  xp: [60, 80], behavior: 'doom_herald', tier: 0, dropChance: 1.0,
  spawnWeight: 0, hitInterval: 0.6, wobble: 1.5,
  // Появляется при 5+ смертях без XP, ускоряет всех врагов
  doomAuraRadius: 999, doomSpeedBuff: 0.30, doomDuration: 10.0,
  quickKillWindow: 5.0, quickKillXpMul: 3.0,
  rareSpawn: true, maxPerRun: 2,
};

ENEMY_TYPES.treasure_golem = {
  id: 'treasure_golem', name: t('enemy_treasure_golem'), letter: '$',
  shape: 'rect', color: '#ffd700', stroke: '#ffffff',
  w: 34, h: 34, hp: 50, speed: 120, damage: 0,
  xp: [80, 100], behavior: 'treasure_golem', tier: 0, dropChance: 1.0,
  spawnWeight: 0, hitInterval: 0, wobble: 1,
  // Убегает, сбрасывает золото, при убийстве — огромный дроп
  fleeDist: 250, goldDropInterval: 2.0, escapeTime: 15.0,
  killRewardXpMul: 5.0, killRewardChest: true,
  rareSpawn: true, maxPerRun: 1,
};


/* =============================================================
   ОБНОВЛЕНИЕ ENEMY_TIERS — добавляем новых врагов в тиры
   ============================================================= */

// Тир 1 — новые враги
ENEMY_TIERS[1].ids.push(
  'plague_rat', 'mushroom_sprite', 'bone_crawler', 'wisp_minor',
  'carrion_beetle', 'mud_imp', 'spirit_wisp', 'vine_creeper'
);

// Тир 2 — новые враги
ENEMY_TIERS[2].ids.push(
  'necro_acolyte', 'sand_worm', 'toxic_toad', 'chain_phantom',
  'ember_moth', 'frozen_husk', 'swarm_beetle', 'mirror_wisp',
  'root_shambler', 'plaguebearer'
);

// Тир 3 — новые враги
ENEMY_TIERS[3].ids.push(
  'clockwork_spider', 'blood_ooze', 'ash_wraith', 'crystal_golem',
  'nether_hound', 'spore_carrier', 'gravity_aberration',
  'corpse_detonator', 'echo_shade', 'magma_crab'
);

// Тир 4 — новые враги
ENEMY_TIERS[4].ids.push(
  'void_stalker', 'soul_collector', 'plague_golem', 'thunder_elemental',
  'bone_hydra_enemy', 'dream_weaver', 'rust_hulk', 'parasite_host',
  'hex_weaver', 'temporal_beetle'
);

// Тир 5 — новые враги
ENEMY_TIERS[5].ids.push(
  'entropy_golem', 'soul_furnace', 'void_leviathan', 'plague_knight',
  'hive_queen', 'chaos_chimera', 'obelisk_guardian', 'shadow_prince',
  'abyssal_maw', 'living_dungeon'
);


/* =============================================================
   5 НОВЫХ МИНИ-БОССОВ (волны 36+)
   ============================================================= */

BOSS_TYPES.boss_web_architect = {
  id: 'boss_web_architect',
  name: t('boss_web_architect'),
  hp: 700,
  speed: 70,
  damage: 25,
  xpReward: 550,
  w: 56, h: 56,
  color: '#2a2a3a',
  stroke: '#ccccff',
  shape: 'diamond',
  letter: 'A',
  hitInterval: 0.8,
  attacks: {
    webWall: { cooldown: 6.0, count: 4, wallLife: 8.0, wallLength: 80 },
    ricochetBolt: { cooldown: 2.5, damage: 18, speed: 280, bounces: 2 },
    harpoon: { cooldown: 5.0, damage: 15, pullSpeed: 300, range: 200 },
    shrinkArena: { cooldown: 10.0, shrinkAmount: 30 },
    summonSpiders: { count: 4, childId: 'clockwork_spider' },
  },
  phase2HpPct: 0.50,
  phase2SpeedMul: 1.40,
  phase2CdMul: 0.70,
  allowedBiomes: ['crypt', 'forest_ruins', 'castle'],
  rewardMul: 1.5,
};

BOSS_TYPES.boss_storm_colossus = {
  id: 'boss_storm_colossus',
  name: t('boss_thunder_colossus'),
  hp: 900,
  speed: 35,
  damage: 30,
  xpReward: 650,
  w: 64, h: 64,
  color: '#334466',
  stroke: '#88ccff',
  shape: 'rect',
  letter: 'G',
  hitInterval: 1.0,
  attacks: {
    chainLightning: { cooldown: 3.0, damage: 22, jumps: 3, jumpRange: 80 },
    thunderStrike: { cooldown: 5.0, damage: 30, radius: 70, delay: 1.5 },
    lightningLine: { cooldown: 7.0, damage: 20, width: 20, duration: 2.0 },
    aoeStorm: { dps: 8, radius: 60 },
  },
  // Фаза 1: уязвимое ядро (маленький хитбокс)
  coreHitboxRadius: 12,
  missHealPct: 0.01,
  phase2HpPct: 0.60,
  phase2SpeedMul: 1.50,
  phase2NormalHitbox: true,
  allowedBiomes: ['sky_citadel', 'mountain_keep', 'castle'],
  rewardMul: 1.6,
};


BOSS_TYPES.boss_puzzle_sphinx = {
  id: 'boss_puzzle_sphinx',
  name: t('boss_sphinx_puzzler'),
  hp: 800,
  speed: 50,
  damage: 22,
  xpReward: 600,
  w: 58, h: 50,
  color: '#c9a84c',
  stroke: '#ffd700',
  shape: 'rect',
  letter: 'S',
  hitInterval: 0.9,
  attacks: {
    eyeBeam: { cooldown: 2.0, damage: 18, speed: 200, trackSpeed: 1.5 },
    stonePillar: { cooldown: 4.0, count: 3, damage: 22, radius: 30, delay: 1.0 },
    arenaBlast: { damage: 30, radius: 250 }, // штраф за неверный ответ
    runeCount: 4,
    puzzleInterval: 15.0,
    puzzleWindow: 3.0,
    vulnDuration: 5.0,
  },
  phase2HpPct: 0.50,
  phase3HpPct: 0.25,
  phase2PuzzleSequence: 2, // 2 руны в порядке
  phase3Enrage: true,
  phase3SpeedMul: 1.80,
  phase3CdMul: 0.50,
  allowedBiomes: ['sky_citadel', 'castle', 'crypt'],
  rewardMul: 1.5,
};

BOSS_TYPES.boss_bone_hydra = {
  id: 'boss_bone_hydra',
  name: t('boss_bone_hydra'),
  hp: 1000,
  speed: 30,
  damage: 20,
  xpReward: 700,
  w: 64, h: 48,
  color: '#d9d0c0', 
  stroke: '#ffffff',
  shape: 'oval',
  letter: 'G',
  hitInterval: 0.8,
  attacks: {
    fireHead:      { cooldown: 2.5, damage: 20, speed: 260, type: 'fire' },
    iceHead:       { cooldown: 3.0, damage: 16, speed: 240, type: 'ice', slowPct: 0.40, slowDur: 2.0 },
    poisonHead:    { cooldown: 2.0, damage: 8, speed: 220, type: 'poison', dotDps: 6, dotDur: 3.0 },
    lightningHead: { cooldown: 2.5, damage: 22, speed: 300, type: 'lightning' },
    darkHead:      { cooldown: 3.5, damage: 25, speed: 200, type: 'dark', radius: 60 },
    comboAttack:   { cooldown: 10.0, damage: 30, types: 2 },
  },
  headCount: 5,
  headHpPct: 0.20, // каждая голова = 20% от общего HP
  headRegenTime: 8.0,
  headRegenDmgBonus: 0.20,
  phase2HpPct: 0.50,
  phase2Mobile: true,
  phase2SpeedMul: 1.50,
  allowedBiomes: ['crypt', 'castle', 'mountain_keep'],
  rewardMul: 1.7,
};

BOSS_TYPES.boss_mirror_king = {
  id: 'boss_mirror_king',
  name: t('boss_mirror_king'),
  hp: 850,
  speed: 65,
  damage: 25,
  xpReward: 650,
  w: 52, h: 52,
  color: '#c0c0c0',
  stroke: '#ffffff',
  shape: 'rect',
  letter: 'R',
  hitInterval: 0.8,
  attacks: {
    mirrorSlash: { cooldown: 1.5, damage: 20, arc: 120, range: 55 },
    shardRing: { cooldown: 3.0, count: 8, damage: 15, speed: 220 },
    copyWeapon: { cooldown: 2.0, damageMul: 0.50 },
    blindShard: { cooldown: 4.0, damage: 12, blindDuration: 0.5 },
  },
  reflectPct: 0.40, // Фаза 1: 40% отражение
  phase2HpPct: 0.60,
  phase2CloneCount: 3,
  phase2CloneHpPct: 0.15,
  phase2HealPerClone: 0.02,
  phase2ReflectPct: 0.20,
  phase3HpPct: 0.30,
  phase3SpeedMul: 2.0,
  phase3DamageMul: 1.50,
  phase3ReflectPct: 0,
  allowedBiomes: ['castle', 'sky_citadel', 'ice_caves'],
  rewardMul: 1.6,
};


/* =============================================================
   Добавляем новых боссов в ротацию и конфиг
   ============================================================= */

// Добавить в общий пул боссов
BOSS_CONFIG.ALL_BOSS_IDS.push(
  'boss_web_architect', 'boss_storm_colossus',
  'boss_puzzle_sphinx', 'boss_bone_hydra', 'boss_mirror_king'
);

// Добавить боссов в BOSS_GUARDIANS_BY_BIOME
BOSS_GUARDIANS_BY_BIOME.crypt.push('boss_web_architect', 'boss_bone_hydra');
BOSS_GUARDIANS_BY_BIOME.castle.push('boss_mirror_king', 'boss_puzzle_sphinx');
if (BOSS_GUARDIANS_BY_BIOME.sky_citadel) {
  BOSS_GUARDIANS_BY_BIOME.sky_citadel.push('boss_storm_colossus', 'boss_puzzle_sphinx');
} else {
  BOSS_GUARDIANS_BY_BIOME.sky_citadel = ['boss_storm_colossus', 'boss_puzzle_sphinx'];
}
if (BOSS_GUARDIANS_BY_BIOME.mountain_keep) {
  BOSS_GUARDIANS_BY_BIOME.mountain_keep.push('boss_storm_colossus', 'boss_bone_hydra');
} else {
  BOSS_GUARDIANS_BY_BIOME.mountain_keep = ['boss_storm_colossus', 'boss_bone_hydra'];
}

// Расширить SPAWN_TIMES для волн 36+
BOSS_CONFIG.SPAWN_TIMES.push(1500, 1680, 1860, 2040, 2220);
// Множители сложности для дополнительных слотов
BOSS_CONFIG.SLOT_DIFFICULTY.push(2.4, 2.8, 3.2, 3.6, 4.0);

// Специальные враги — добавить в rareSpawn систему
if (window.Enemies && Enemies._rareSpawnState) {
  Enemies._rareSpawnState['doom_herald'] = 0;
  Enemies._rareSpawnState['treasure_golem'] = 0;
}

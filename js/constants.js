'use strict';
/* ============================================================
   constants.js
   Глобальный конфиг, утилиты и пул объектов.
   Экспортируется в window.{CONFIG, Utils, ObjectPool}.
   ============================================================ */

const CONFIG = {
  MAP: { W: 2000, H: 2000, TILE_SIZE: 80 },

  PLAYER: {
    SIZE: 32,
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
    GROWTH: 1.5,
    MAGNET_SPEED: 360,
  },

  POOLS: {
    ENEMIES: 80,
    PROJECTILES: 120,       // Шаг 7: расширено до 120 (20 оружий)
    PARTICLES: 120,
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
    id: 'skeleton', name: 'Скелет-воин', letter: 'S',
    shape: 'rect', color: '#bdbdbd', stroke: '#ffffff',
    w: 28, h: 28, hp: 20, speed: 55, damage: 10,
    xp: [5, 10], behavior: 'chase', tier: 1, dropChance: 0.6,
    spawnWeight: 4, hitInterval: 0.6, wobble: 1.5,
  },
  zombie: {
    id: 'zombie', name: 'Зомби', letter: 'Z',
    shape: 'rect', color: '#3e6b3a', stroke: '#a3d39c',
    w: 28, h: 28, hp: 40, speed: 32, damage: 15,
    xp: [10, 14], behavior: 'chase', tier: 1, dropChance: 0.7,
    spawnWeight: 3, hitInterval: 0.8, wobble: 2,
    deathPuddle: { kind: 'rot', chance: 0.30, radius: 40, life: 3, slow: 0.30 },
  },
  goblin: {
    id: 'goblin', name: 'Гоблин-налётчик', letter: 'G',
    shape: 'triangle', color: '#27ae60', stroke: '#a0f0bf',
    w: 20, h: 20, hp: 12, speed: 100, damage: 8,
    xp: [5, 8], behavior: 'goblin', tier: 1, dropChance: 0.30,
    spawnWeight: 4, hitInterval: 0.4, wobble: 1.5,
    retreatDist: 80, retreatCooldown: 1.5,
  },

  /* ===== ТИР 2 (волны 3+) ===== */
  archer: {
    id: 'archer', name: 'Скелет-лучник', letter: 'A',
    shape: 'rect', color: '#d9c08a', stroke: '#fff5cc',
    w: 24, h: 24, hp: 15, speed: 50, damage: 8,
    xp: [7, 9], behavior: 'archer', tier: 2, dropChance: 0.55,
    spawnWeight: 3, wobble: 1,
    keepDistMin: 150, keepDistMax: 200,
    attackCooldown: 2.0, projectile: { kind: 'arrow_e', speed: 320, life: 2.5 },
  },
  ooze: {
    id: 'ooze', name: 'Слизень (охра)', letter: 'O',
    shape: 'oval', color: '#e67e22', stroke: '#ffd9a8',
    w: 30, h: 20, hp: 30, speed: 40, damage: 12,
    xp: [8, 12], behavior: 'ooze', tier: 2, dropChance: 0.6,
    spawnWeight: 3, hitInterval: 0.7, wobble: 1.5,
    trailEvery: 0.5,
    trail: { kind: 'slime', radius: 22, life: 2, slow: 0.20 },
    splitOnDeath: { childId: 'slimeling', count: 2 },
  },
  gasspore: {
    id: 'gasspore', name: 'Газовый спор', letter: 'S',
    shape: 'circle', color: '#7d8f6e', stroke: '#cfe0b6',
    w: 22, h: 22, hp: 15, speed: 40, damage: 0,
    xp: [8, 12], behavior: 'gas', tier: 2, dropChance: 0.55,
    spawnWeight: 2, wobble: 2,
    explodeRadius: 60, explodeDamage: 15,
  },

  /* ===== ТИР 3 (волны 5+) ===== */
  mage: {
    id: 'mage', name: 'Скелет-маг', letter: 'M',
    shape: 'rect', color: '#7e57c2', stroke: '#dccff5',
    w: 24, h: 24, hp: 18, speed: 55, damage: 12,
    xp: [12, 18], behavior: 'mage', tier: 3, dropChance: 0.7,
    spawnWeight: 2, wobble: 1.5,
    teleportEvery: 4.0, teleportMin: 100, teleportMax: 150,
    attackCooldown: 2.5, projectile: { kind: 'magebolt', speed: 280, life: 3 },
  },
  spider: {
    id: 'spider', name: 'Гигантский паук', letter: 'P',
    shape: 'diamond', color: '#1e1e1e', stroke: '#a070a0',
    w: 26, h: 26, hp: 20, speed: 110, damage: 10,
    xp: [12, 18], behavior: 'spider', tier: 3, dropChance: 0.55,
    spawnWeight: 2, hitInterval: 0.5, wobble: 2,
    dashEvery: 2.0, dashTime: 0.5, dashMul: 2.0,
    splitOnDeath: { childId: 'spiderling', count: 3 },
  },
  fire_elem: {
    id: 'fire_elem', name: 'Огненный элементаль', letter: 'F',
    shape: 'diamond', color: '#ff7a00', stroke: '#ffd97a',
    w: 30, h: 30, hp: 35, speed: 60, damage: 12,
    xp: [18, 22], behavior: 'fire_elem', tier: 3, dropChance: 0.75,
    spawnWeight: 2, hitInterval: 0.7, wobble: 2,
    trailEvery: 0.35,
    trail: { kind: 'fire', radius: 22, life: 2.5, dps: 5 },
    explodeOnDeath: { radius: 80, damage: 20 },
  },
  bat: {
    id: 'bat', name: 'Летучая мышь-вампир', letter: 'B',
    shape: 'oval', color: '#7a1d2c', stroke: '#ffb3b3',
    w: 18, h: 12, hp: 10, speed: 130, damage: 6,
    xp: [7, 10], behavior: 'bat', tier: 3, dropChance: 0.45,
    spawnWeight: 3, hitInterval: 0.5, wobble: 0,
    sinAmp: 26, sinFreq: 6, dodgeChance: 0.20,
  },

  /* ===== ТИР 4 (волны 7+) ===== */
  captain: {
    id: 'captain', name: 'Скелет-капитан', letter: 'C',
    shape: 'rect', color: '#c0392b', stroke: '#ffd700',
    w: 32, h: 32, hp: 60, speed: 50, damage: 18,
    xp: [25, 35], behavior: 'captain', tier: 4, dropChance: 0.85,
    spawnWeight: 1, hitInterval: 0.7, wobble: 1.5,
    auraRadius: 100, auraSpeedMul: 1.20, auraDmgMul: 1.20,
  },
  cultist: {
    id: 'cultist', name: 'Культист', letter: 'K',
    shape: 'triangle', color: '#1a1a1a', stroke: '#a040ff',
    w: 22, h: 22, hp: 20, speed: 35, damage: 0,
    xp: [30, 40], behavior: 'cultist', tier: 4, dropChance: 0.80,
    spawnWeight: 2, wobble: 1,
    keepDistMin: 100, keepDistMax: 140,
    summonEvery: 5.0, summonChildId: 'skeleton', maxSummons: 3,
  },
  shadow: {
    id: 'shadow', name: 'Теневой убийца', letter: 'X',
    shape: 'rect', color: '#0a0a0a', stroke: '#7a7a7a',
    w: 22, h: 22, hp: 18, speed: 110, damage: 14,
    xp: [16, 22], behavior: 'shadow', tier: 4, dropChance: 0.65,
    spawnWeight: 2, hitInterval: 0.6, wobble: 1.5,
    visibleTime: 2.0, invisibleTime: 1.0, backstabMul: 1.5,
  },

  /* ===== ТИР 5 (волны 8+) ===== */
  rotgolem: {
    id: 'rotgolem', name: 'Гнилой голем', letter: 'G',
    shape: 'rect', color: '#6b4a2b', stroke: '#c9a97a',
    w: 40, h: 40, hp: 80, speed: 28, damage: 25,
    xp: [35, 45], behavior: 'rotgolem', tier: 5, dropChance: 0.90,
    spawnWeight: 1, hitInterval: 0.8, wobble: 1,
    sporeCooldown: 5.0, sporeChildId: 'gasspore',
  },
  dragonet: {
    id: 'dragonet', name: 'Костяной дракончик', letter: 'D',
    shape: 'diamond', color: '#9aa0a6', stroke: '#fff5cc',
    w: 35, h: 20, hp: 25, speed: 70, damage: 10,
    xp: [18, 26], behavior: 'dragonet', tier: 5, dropChance: 0.85,
    spawnWeight: 1, hitInterval: 0.7, wobble: 3,
    keepDistMin: 130, keepDistMax: 180,
    breathCooldown: 3.0, breathRange: 100, breathDamage: 10,
  },

  /* ===== ОСОБЫЙ — мимик (не входит в волны, спавнится отдельно) ===== */
  mimic: {
    id: 'mimic', name: 'Мимик', letter: '?',
    shape: 'rect', color: '#d8a826', stroke: '#fffce0',
    w: 28, h: 28, hp: 50, speed: 40, damage: 20,
    xp: [40, 60], behavior: 'mimic', tier: 0, dropChance: 1.0,
    spawnWeight: 0, hitInterval: 0.7, wobble: 0,
    activateRadius: 50, biteDamage: 20,
  },

  /* ===== НОВЫЕ — ТИР 1 (волны 1+) ===== */
  giant_rat: {
    id: 'giant_rat', name: 'Крыса-гигант', letter: 'R',
    shape: 'oval', color: '#8b6914', stroke: '#d4a855',
    w: 18, h: 10, hp: 8, speed: 120, damage: 5,
    xp: [3, 5], behavior: 'rat', tier: 1, dropChance: 0.35,
    spawnWeight: 3, hitInterval: 0.5, wobble: 1,
    fearChance: 0.30, fearDuration: 2.0,
  },
  acid_slug: {
    id: 'acid_slug', name: 'Слизень-лизун', letter: 'S',
    shape: 'oval', color: '#2ecc40', stroke: '#a0ffa0',
    w: 22, h: 14, hp: 12, speed: 35, damage: 8,
    xp: [4, 6], behavior: 'chase', tier: 1, dropChance: 0.45,
    spawnWeight: 3, hitInterval: 0.7, wobble: 1.5,
    deathPuddle: { kind: 'acid', chance: 1.0, radius: 30, life: 2, slow: 0, dps: 5 },
  },
  cave_bat: {
    id: 'cave_bat', name: 'Летучая мышь', letter: 'B',
    shape: 'oval', color: '#666666', stroke: '#bbbbbb',
    w: 16, h: 10, hp: 6, speed: 140, damage: 4,
    xp: [2, 4], behavior: 'bat', tier: 1, dropChance: 0.25,
    spawnWeight: 4, hitInterval: 0.4, wobble: 0,
    sinAmp: 20, sinFreq: 7,
  },
  ratcatcher: {
    id: 'ratcatcher', name: 'Скелет-крысолов', letter: 'R',
    shape: 'rect', color: '#e8dca0', stroke: '#ffffff',
    w: 22, h: 22, hp: 18, speed: 55, damage: 10,
    xp: [6, 10], behavior: 'chase', tier: 1, dropChance: 0.55,
    spawnWeight: 2, hitInterval: 0.6, wobble: 1.5,
    splitOnDeath: { childId: 'giant_rat', count: 2 },
  },
  mold: {
    id: 'mold', name: 'Плесень', letter: 'M',
    shape: 'circle', color: '#6b8060', stroke: '#a0c090',
    w: 20, h: 20, hp: 10, speed: 0, damage: 12,
    xp: [3, 5], behavior: 'mold', tier: 1, dropChance: 0.35,
    spawnWeight: 2, hitInterval: 0.8, wobble: 0,
    lungeRange: 60, lungeCooldown: 4.0, lungeSpeed: 200, lungeTime: 0.3,
    deathCloud: { radius: 40, dps: 6, life: 2 },
  },

  /* ===== НОВЫЕ — ТИР 2 (волны 3+) ===== */
  gnoll: {
    id: 'gnoll', name: 'Гнолл-налётчик', letter: 'G',
    shape: 'triangle', color: '#8b4513', stroke: '#d2a06a',
    w: 24, h: 24, hp: 22, speed: 100, damage: 12,
    xp: [8, 12], behavior: 'gnoll', tier: 2, dropChance: 0.55,
    spawnWeight: 3, hitInterval: 0.5, wobble: 1.5,
    rageHpPct: 0.50, rageSpeedMul: 1.30,
  },
  kobold: {
    id: 'kobold', name: 'Кобольд-ловчий', letter: 'K',
    shape: 'rect', color: '#777777', stroke: '#cccccc',
    w: 18, h: 18, hp: 14, speed: 65, damage: 8,
    xp: [7, 11], behavior: 'kobold', tier: 2, dropChance: 0.50,
    spawnWeight: 2, hitInterval: 0.6, wobble: 1,
    keepDistMin: 100, keepDistMax: 140,
    trapCooldown: 10.0, trapRadius: 20, trapDamage: 10,
  },
  cave_crab: {
    id: 'cave_crab', name: 'Пещерный краб', letter: 'C',
    shape: 'oval', color: '#e67300', stroke: '#ffcc80',
    w: 30, h: 18, hp: 30, speed: 38, damage: 15,
    xp: [12, 16], behavior: 'crab', tier: 2, dropChance: 0.65,
    spawnWeight: 2, hitInterval: 0.8, wobble: 1,
    shellDR: 0.50, shellDuration: 1.0, shellCooldown: 3.0,
  },
  ghost: {
    id: 'ghost', name: 'Призрак', letter: 'W',
    shape: 'oval', color: '#ffffff', stroke: '#ccccff',
    w: 24, h: 24, hp: 15, speed: 60, damage: 10,
    xp: [10, 14], behavior: 'ghost', tier: 2, dropChance: 0.55,
    spawnWeight: 2, hitInterval: 0.7, wobble: 2,
    ignoreWalls: true,
  },
  alchemist_skel: {
    id: 'alchemist_skel', name: 'Скелет-алхимик', letter: 'A',
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
    id: 'harpy', name: 'Гарпия', letter: 'H',
    shape: 'triangle', color: '#808080', stroke: '#d0d0d0',
    w: 22, h: 22, hp: 18, speed: 90, damage: 15,
    xp: [11, 15], behavior: 'harpy', tier: 2, dropChance: 0.55,
    spawnWeight: 2, hitInterval: 0.5, wobble: 2,
    diveCooldown: 3.0, diveSpeed: 300, diveTime: 0.4, retreatDist: 120,
  },
  dung_beetle: {
    id: 'dung_beetle', name: 'Жук-навозник', letter: 'D',
    shape: 'circle', color: '#6b4400', stroke: '#b08040',
    w: 24, h: 24, hp: 25, speed: 35, damage: 12,
    xp: [10, 14], behavior: 'beetle', tier: 2, dropChance: 0.55,
    spawnWeight: 2, hitInterval: 0.7, wobble: 1,
    ballHp: 20, ballRadius: 16, fleeSpeed: 100,
  },

  /* ===== НОВЫЕ — ТИР 3 (волны 5+) ===== */
  minotaur: {
    id: 'minotaur', name: 'Минотавр', letter: 'M',
    shape: 'rect', color: '#7a4a2a', stroke: '#d4a06a',
    w: 36, h: 36, hp: 50, speed: 55, damage: 25,
    xp: [18, 24], behavior: 'minotaur', tier: 3, dropChance: 0.75,
    spawnWeight: 2, hitInterval: 0.8, wobble: 1,
    chargeWindup: 1.5, chargeSpeed: 300, chargeRange: 120,
    chargeRestTime: 2.0, knockback: 60,
  },
  basilisk: {
    id: 'basilisk', name: 'Василиск', letter: 'B',
    shape: 'rect', color: '#1a4d1a', stroke: '#40a040',
    w: 28, h: 28, hp: 30, speed: 50, damage: 12,
    xp: [16, 20], behavior: 'basilisk', tier: 3, dropChance: 0.65,
    spawnWeight: 2, hitInterval: 0.7, wobble: 1.5,
    gazeCooldown: 6.0, gazeRange: 80, gazeSlowPct: 0.60, gazeSlowDuration: 2.0, gazeDamage: 12,
  },
  medusa: {
    id: 'medusa', name: 'Медуза', letter: 'M',
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
    id: 'doppelganger', name: 'Доппельгангер', letter: 'D',
    shape: 'rect', color: '#3070d0', stroke: '#ff3030',
    w: 32, h: 32, hp: 35, speed: 180, damage: 0,
    xp: [22, 28], behavior: 'doppelganger', tier: 3, dropChance: 0.80,
    spawnWeight: 1, hitInterval: 0.8, wobble: 1.5,
    copyDamageMul: 0.50, attackCooldown: 2.0,
  },
  earth_elem: {
    id: 'earth_elem', name: 'Элементаль земли', letter: 'E',
    shape: 'rect', color: '#8b6b3a', stroke: '#c9a97a',
    w: 34, h: 34, hp: 60, speed: 25, damage: 20,
    xp: [20, 26], behavior: 'earth_elem', tier: 3, dropChance: 0.75,
    spawnWeight: 1, hitInterval: 0.9, wobble: 1,
    wallCooldown: 5.0, wallLength: 60, wallDuration: 4.0,
  },
  water_elem: {
    id: 'water_elem', name: 'Элементаль воды', letter: 'E',
    shape: 'oval', color: '#4da6ff', stroke: '#b3d9ff',
    w: 30, h: 20, hp: 35, speed: 55, damage: 14,
    xp: [16, 20], behavior: 'water_elem', tier: 3, dropChance: 0.65,
    spawnWeight: 2, hitInterval: 0.7, wobble: 2,
    trailEvery: 0.5,
    trail: { kind: 'water', radius: 20, life: 3, slow: 0.15, dps: 0 },
    waveCooldown: 4.0, waveRange: 100, waveDamage: 14, waveKnockback: 40,
  },
  beholder_spore: {
    id: 'beholder_spore', name: 'Бехолдер-споровый', letter: 'B',
    shape: 'circle', color: '#8b008b', stroke: '#dda0dd',
    w: 28, h: 28, hp: 28, speed: 30, damage: 7,
    xp: [18, 22], behavior: 'beholder_spore', tier: 3, dropChance: 0.70,
    spawnWeight: 1, wobble: 2,
    attackCooldown: 2.0, spreadAngle: 0.35, spreadCount: 3,
    projectile: { kind: 'spore_bolt', speed: 240, life: 2 },
    explodeOnDeath: { radius: 60, damage: 15 },
  },
  hell_hound: {
    id: 'hell_hound', name: 'Адская гончая', letter: 'H',
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
    id: 'dragonid', name: 'Драконид-воин', letter: 'D',
    shape: 'rect', color: '#cc2200', stroke: '#ff9966',
    w: 30, h: 30, hp: 40, speed: 60, damage: 18,
    xp: [22, 28], behavior: 'dragonid', tier: 4, dropChance: 0.75,
    spawnWeight: 2, hitInterval: 0.7, wobble: 1,
    breathCooldown: 5.0, breathRange: 80, breathDamage: 14,
  },
  drow: {
    id: 'drow', name: 'Дроу-разведчик', letter: 'D',
    shape: 'triangle', color: '#3d0066', stroke: '#b366ff',
    w: 22, h: 22, hp: 20, speed: 110, damage: 15,
    xp: [18, 22], behavior: 'drow', tier: 4, dropChance: 0.65,
    spawnWeight: 2, hitInterval: 0.5, wobble: 1.5,
    invisDist: 150, backstabMul: 1.30, retreatDist: 100,
    trapCooldown: 8.0, trapDamage: 12, trapRadius: 18,
  },
  illithid: {
    id: 'illithid', name: 'Иллитид', letter: 'I',
    shape: 'rect', color: '#6600cc', stroke: '#cc99ff',
    w: 28, h: 28, hp: 30, speed: 55, damage: 18,
    xp: [28, 34], behavior: 'illithid', tier: 4, dropChance: 0.80,
    spawnWeight: 1, wobble: 1.5,
    keepDistMin: 130, keepDistMax: 170,
    blastCooldown: 4.0, blastRadius: 50, blastDamage: 18,
    deathScream: { radius: 100, speedBuff: 0.20, duration: 3.0 },
  },
  stone_golem: {
    id: 'stone_golem', name: 'Голем-страж', letter: 'G',
    shape: 'rect', color: '#808080', stroke: '#c0c0c0',
    w: 40, h: 40, hp: 80, speed: 25, damage: 25,
    xp: [32, 38], behavior: 'chase', tier: 4, dropChance: 0.85,
    spawnWeight: 1, hitInterval: 0.9, wobble: 0.5,
    stunChance: 0.30, stunDuration: 0.5,
    immunePoison: true, immuneBleed: true,
  },
  rust_monster: {
    id: 'rust_monster', name: 'Ржавый монстр', letter: 'R',
    shape: 'oval', color: '#b36b00', stroke: '#ff9933',
    w: 30, h: 20, hp: 35, speed: 55, damage: 15,
    xp: [20, 26], behavior: 'chase', tier: 4, dropChance: 0.70,
    spawnWeight: 2, hitInterval: 0.7, wobble: 1.5,
    rustDebuff: { damageMul: 0.80, duration: 3.0, maxStacks: 2 },
    explodeOnDeath: { radius: 60, damage: 0 },
    deathRust: true,
  },
  lich_minor: {
    id: 'lich_minor', name: 'Лич-некромант', letter: 'N',
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
    id: 'chimera', name: 'Химера', letter: 'C',
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
    id: 'demon_berserker', name: 'Демон-берсерк', letter: 'D',
    shape: 'rect', color: '#cc0000', stroke: '#ff6666',
    w: 34, h: 34, hp: 50, speed: 100, damage: 20,
    xp: [28, 34], behavior: 'demon_berserker', tier: 4, dropChance: 0.80,
    spawnWeight: 1, hitInterval: 0.6, wobble: 1,
    rageHpPct: 0.30, rageSpeedMul: 1.40, rageDamageMul: 1.50, rageTakeDamageMul: 2.0,
  },

  /* ===== НОВЫЕ — ТИР 5 (волны 8+) ===== */
  young_dragon: {
    id: 'young_dragon', name: 'Молодой дракон', letter: 'D',
    shape: 'diamond', color: '#cc3300', stroke: '#ffd700',
    w: 44, h: 30, hp: 70, speed: 100, damage: 22,
    xp: [38, 44], behavior: 'young_dragon', tier: 5, dropChance: 0.90,
    spawnWeight: 1, hitInterval: 0.8, wobble: 3,
    breathCooldown: 5.0, breathRange: 120, breathDamage: 22, breathSpread: 5,
    tailSweep: { damage: 18, radius: 60, cooldown: 8.0, knockback: 50 },
  },
  observer: {
    id: 'observer', name: 'Наблюдатель', letter: 'B',
    shape: 'circle', color: '#660099', stroke: '#cc66ff',
    w: 34, h: 34, hp: 55, speed: 30, damage: 8,
    xp: [38, 44], behavior: 'observer', tier: 5, dropChance: 0.90,
    spawnWeight: 1, wobble: 2,
    eyeStalks: 4, stalkCooldown: 1.5, stalkDamage: 8,
    projectile: { kind: 'eye_beam', speed: 300, life: 2 },
    antimagicCooldown: 6.0, antimagicDuration: 2.0,
  },
  death_knight: {
    id: 'death_knight', name: 'Рыцарь смерти', letter: 'D',
    shape: 'rect', color: '#1a1a1a', stroke: '#cc0000',
    w: 38, h: 38, hp: 90, speed: 40, damage: 28,
    xp: [45, 55], behavior: 'death_knight', tier: 5, dropChance: 0.95,
    spawnWeight: 1, hitInterval: 0.8, wobble: 0.5,
    aoeCooldown: 7.0, aoeRadius: 100, aoeDamage: 22, healReduction: 0.50, healReductionDuration: 4.0,
    deathCurse: { damageTakenMul: 1.30, duration: 5.0 },
  },
  hydra_small: {
    id: 'hydra_small', name: 'Гидра (малая)', letter: 'H',
    shape: 'oval', color: '#228b22', stroke: '#66ff66',
    w: 44, h: 28, hp: 60, speed: 30, damage: 10,
    xp: [42, 48], behavior: 'hydra', tier: 5, dropChance: 0.90,
    spawnWeight: 1, hitInterval: 0.6, wobble: 1,
    heads: 3, headHp: 20, headRegenTime: 5.0, regenPerHead: 2,
  },
  archlich: {
    id: 'archlich', name: 'Архилич', letter: 'A',
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
    id: 'eldritch_horror', name: 'Потусторонний ужас', letter: 'H',
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
    id: 'bone_colossus', name: 'Костяной колосс', letter: 'K',
    shape: 'rect', color: '#d9d0c0', stroke: '#ffffff',
    w: 42, h: 42, hp: 85, speed: 28, damage: 26,
    xp: [40, 50], behavior: 'rotgolem', tier: 5, dropChance: 0.90,
    spawnWeight: 1, hitInterval: 0.9, wobble: 0.5,
    sporeCooldown: 4.0, sporeChildId: 'skeleton',
  },

  /* ===== ДОЧЕРНИЕ (не призываются волной) ===== */
  spiderling: {
    id: 'spiderling', name: 'Паучок', letter: 'p',
    shape: 'diamond', color: '#3a3a3a', stroke: '#a070a0',
    w: 16, h: 16, hp: 5, speed: 130, damage: 3,
    xp: [3, 5], behavior: 'chase', tier: 0, dropChance: 0.20,
    spawnWeight: 0, hitInterval: 0.4, wobble: 1.5,
  },
  slimeling: {
    id: 'slimeling', name: 'Малый слизень', letter: 'o',
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
  5: { unlockWave: 8, ids: ['rotgolem', 'dragonet', 'young_dragon', 'observer', 'death_knight', 'hydra_small', 'bone_colossus'] },
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
    name: 'Скелет-рыцарь',
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
    name: 'Лич',
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
    name: 'Паук-королева',
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
    name: 'Огненный элементаль-лорд',
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
  name: 'Ледяной элементаль-лорд',
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
  name: 'Древний энт',
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
  name: 'Тёмный рыцарь',
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

window.BOSS_CONFIG = BOSS_CONFIG;
window.BOSS_TYPES = BOSS_TYPES;


/* ============================================================
   WEAPON_CONFIGS — базовые параметры всех 20 оружий (Шаг 7).
   Формула прокачки: +15% урона, -5% кулдауна за уровень.
   ============================================================ */
const WEAPON_CONFIGS = {
  // --- Существующие 4 ---
  sword:    { baseDamage: 15, baseCooldown: 0.8,  type: 'melee'  },
  bow:      { baseDamage: 12, baseCooldown: 1.2,  type: 'ranged' },
  daggers:  { baseDamage: 6,  baseCooldown: 1.5,  type: 'multi'  },
  fireball: { baseDamage: 20, baseCooldown: 2.5,  type: 'aoe'    },

  // --- Категория 1: Ближний бой ---
  axe:      { baseDamage: 22, baseCooldown: 1.0,  type: 'melee'  },
  spear:    { baseDamage: 18, baseCooldown: 0.9,  type: 'melee'  },
  hammer:   { baseDamage: 20, baseCooldown: 1.5,  type: 'melee'  },
  whip:     { baseDamage: 14, baseCooldown: 0.7,  type: 'melee'  },

  // --- Категория 2: Дальний бой ---
  crossbow:       { baseDamage: 28, baseCooldown: 1.8, type: 'ranged' },
  throwing_axes:  { baseDamage: 10, baseCooldown: 1.0, type: 'ranged' },
  darts:          { baseDamage: 6,  baseCooldown: 0.6, type: 'ranged' },
  sling:          { baseDamage: 14, baseCooldown: 0.9, type: 'ranged' },

  // --- Категория 3: Магия ---
  ice_arrow:      { baseDamage: 13, baseCooldown: 1.3, type: 'magic'  },
  chain_lightning:{ baseDamage: 16, baseCooldown: 1.6, type: 'magic'  },
  poison_cloud:   { baseDamage: 8,  baseCooldown: 2.0, type: 'magic'  },
  spellbook:      { baseDamage: 10, baseCooldown: 0.8, type: 'magic'  },

  // --- Категория 4: AoE / Контроль ---
  firestorm:      { baseDamage: 18, baseCooldown: 2.5, type: 'aoe'    },
  holy_aura:      { baseDamage: 4,  baseCooldown: 0,   type: 'aoe'    }, // постоянное (без CD)
  spike_ring:     { baseDamage: 14, baseCooldown: 0,   type: 'aoe'    }, // постоянное вращение
  earthquake:     { baseDamage: 15, baseCooldown: 3.0, type: 'aoe'    },
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
    name: 'Броня',
    icon: '🛡',
    desc: 'Снижение получаемого урона на 5% за уровень.',
    effectType: 'statModifier',
    perLevel: 0.05,        // -5% урона за уровень (уровень 5: -25%)
  },
  mana_shield: {
    id: 'mana_shield',
    name: 'Щит маны',
    icon: '🔵',
    desc: 'Блокирует следующий удар полностью (кулдаун уменьшается с уровнем).',
    effectType: 'periodic',
    baseCooldown: 12,      // уровень 1: каждые 12 сек, уровень 5: каждые 8 сек
    cdReductionPerLevel: 1, // -1 сек кулдауна за уровень
  },
  fortify: {
    id: 'fortify',
    name: 'Укрепление',
    icon: '❤',
    desc: '+8% к максимальному HP за уровень.',
    effectType: 'statModifier',
    perLevel: 0.08,        // +8% maxHp за уровень
  },
  resistance: {
    id: 'resistance',
    name: 'Сопротивление',
    icon: '✜',
    desc: '-15% длительности отрицательных эффектов за уровень.',
    effectType: 'statModifier',
    perLevel: 0.15,        // -15% длительности дебаффов за уровень (макс -75%)
  },

  /* === Категория: Атака === */
  bloodlust: {
    id: 'bloodlust',
    name: 'Жажда крови',
    icon: '🦷',
    desc: '+2% вампиризма (лечение от урона) за уровень.',
    effectType: 'onHit',
    perLevel: 0.02,        // 2% lifesteal за уровень
  },
  crit_strike: {
    id: 'crit_strike',
    name: 'Критический удар',
    icon: '⚡',
    desc: '+4% шанс крита (×2 урон) за уровень.',
    effectType: 'statModifier',
    perLevel: 0.04,        // +4% шанс крита за уровень
  },
  bleed: {
    id: 'bleed',
    name: 'Кровотечение',
    icon: '💧',
    desc: '10% шанс за уровень наложить кровотечение (4 урон/сек, 3 сек).',
    effectType: 'onHit',
    perLevel: 0.10,        // +10% шанс за уровень
    dotDps: 4,
    dotDuration: 3,
  },
  explosive_death: {
    id: 'explosive_death',
    name: 'Взрывная смерть',
    icon: '💥',
    desc: '10% шанс за уровень: при убийстве — взрыв (урон 18, радиус 50px).',
    effectType: 'onKill',
    perLevel: 0.10,        // +10% шанс за уровень
    explosionDamage: 18,
    explosionRadius: 50,
  },

  /* === Категория: Магия === */
  quick_fingers: {
    id: 'quick_fingers',
    name: 'Быстрые пальцы',
    icon: '🔄',
    desc: '-4% кулдауна всех оружий за уровень.',
    effectType: 'statModifier',
    perLevel: 0.04,        // -4% CD за уровень (уровень 5: -20%)
  },
  frost_aura: {
    id: 'frost_aura',
    name: 'Аура холода',
    icon: '❄',
    desc: 'Замедляет врагов в радиусе 60px на 8% за уровень.',
    effectType: 'aura',
    radius: 60,
    perLevel: 0.08,        // -8% скорости врагов за уровень
  },
  magic_boost: {
    id: 'magic_boost',
    name: 'Усиление магии',
    icon: '✦',
    desc: '+10% к магическому урону за уровень.',
    effectType: 'statModifier',
    perLevel: 0.10,        // +10% magic damage за уровень
  },
  magic_echo: {
    id: 'magic_echo',
    name: 'Магический отклик',
    icon: '🔮',
    desc: '15% шанс за уровень: при получении урона — ответный снаряд (урон 15).',
    effectType: 'onDamageTaken',
    perLevel: 0.15,        // +15% шанс за уровень
    echoDamage: 15,
    echoSpeed: 350,
  },

  /* === Категория: Удача и лут === */
  lucky: {
    id: 'lucky',
    name: 'Счастливчик',
    icon: '🎲',
    desc: '+1 к мин. результату d20 за уровень.',
    effectType: 'statModifier',
    perLevel: 1,           // +1 к минимальному d20 за уровень
  },
  double_xp: {
    id: 'double_xp',
    name: 'Удвоение опыта',
    icon: '✕2',
    desc: '6% шанс за уровень получить удвоенный опыт.',
    effectType: 'onKill',
    perLevel: 0.06,        // +6% шанс за уровень
  },
  alchemist: {
    id: 'alchemist',
    name: 'Алхимик',
    icon: '⚗',
    desc: '+12% к урону ядов и огня (DoT) за уровень.',
    effectType: 'statModifier',
    perLevel: 0.12,        // +12% DoT damage за уровень
  },
  magnet_plus: {
    id: 'magnet_plus',
    name: 'Магнит предметов',
    icon: '⊕',
    desc: '+20% к радиусу подбора за уровень (стакается с Магнитом опыта).',
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
    name: 'Склеп',
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
    guardianBoss: 'boss_skeleton_knight',
    mosaicColor: 'rgba(120, 90, 60, 0.35)',
  },
  {
    id: 'ice_caves',
    name: 'Ледяные пещеры',
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
    guardianBoss: 'boss_ice_lord',
    mosaicColor: 'rgba(100, 140, 200, 0.3)',
  },
  {
    id: 'fire_mines',
    name: 'Огненные шахты',
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
    guardianBoss: 'boss_fire_lord',
    mosaicColor: 'rgba(200, 80, 40, 0.3)',
  },
  {
    id: 'forest_ruins',
    name: 'Лесные руины',
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
    guardianBoss: 'boss_ancient_ent',
    mosaicColor: 'rgba(60, 140, 60, 0.3)',
  },
  {
    id: 'castle',
    name: 'Замок',
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
    guardianBoss: 'boss_dark_knight',
    mosaicColor: 'rgba(140, 100, 180, 0.3)',
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

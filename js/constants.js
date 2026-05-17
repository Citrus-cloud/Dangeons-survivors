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
    PROJECTILES: 100,       // Шаг 4: расширено до 100 (плюс вражеские снаряды)
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
  1: { unlockWave: 1, ids: ['skeleton', 'zombie', 'goblin'] },
  2: { unlockWave: 3, ids: ['archer', 'ooze', 'gasspore'] },
  3: { unlockWave: 5, ids: ['mage', 'spider', 'fire_elem', 'bat'] },
  4: { unlockWave: 7, ids: ['captain', 'cultist', 'shadow'] },
  5: { unlockWave: 8, ids: ['rotgolem', 'dragonet'] },
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

window.BOSS_CONFIG = BOSS_CONFIG;
window.BOSS_TYPES = BOSS_TYPES;

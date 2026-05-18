'use strict';
/* ============================================================
   constants_step12.js — 50 новых типов врагов (Шаг 12).
   Добавляет записи в ENEMY_TYPES и расширяет ENEMY_TIERS.
   Загружается ПОСЛЕ constants.js.
   ============================================================ */

/* ===== ТИР 3 — опасные (51–60) ===== */
ENEMY_TYPES.bone_golem = {
  id: 'bone_golem', name: 'Костяной голем', letter: 'G',
  shape: 'rect', color: '#f0f0f0', stroke: '#ffffff',
  w: 32, h: 32, hp: 45, speed: 28, damage: 15,
  xp: [20, 24], behavior: 'bone_golem', tier: 3, dropChance: 0.75,
  spawnWeight: 2, hitInterval: 0.8, wobble: 0.5,
  shardCooldown: 3.0, shardCount: 3, shardDamage: 8, shardSpeed: 260, shardSpread: 0.35,
  immuneBleed: true,
};

ENEMY_TYPES.phase_spider = {
  id: 'phase_spider', name: 'Фазовый паук', letter: 'P',
  shape: 'diamond', color: '#4488ff', stroke: '#aaddff',
  w: 26, h: 26, hp: 20, speed: 0, damage: 14,
  xp: [16, 20], behavior: 'phase_spider', tier: 3, dropChance: 0.65,
  spawnWeight: 2, hitInterval: 0.6, wobble: 1.5,
  teleportCooldown: 3.0, teleportDist: 100,
  poisonDps: 4, poisonDuration: 3,
};

ENEMY_TYPES.ettercap = {
  id: 'ettercap', name: 'Эттеркап', letter: 'E',
  shape: 'triangle', color: '#2d8b2d', stroke: '#80ff80',
  w: 24, h: 24, hp: 22, speed: 55, damage: 10,
  xp: [14, 16], behavior: 'ettercap', tier: 3, dropChance: 0.60,
  spawnWeight: 2, hitInterval: 0.7, wobble: 1.5,
  webCooldown: 5.0, webRadius: 50, webSlow: 0.60, webDuration: 3.0,
};

ENEMY_TYPES.fungal_man = {
  id: 'fungal_man', name: 'Грибной человек', letter: 'F',
  shape: 'oval', color: '#8b6b3a', stroke: '#c9a060',
  w: 26, h: 18, hp: 25, speed: 30, damage: 0,
  xp: [12, 16], behavior: 'fungal_man', tier: 3, dropChance: 0.60,
  spawnWeight: 2, hitInterval: 0.8, wobble: 1,
  sporeCooldown: 4.0, sporeRadius: 50, sporeDps: 8, disorientDuration: 1.0,
};

ENEMY_TYPES.troll = {
  id: 'troll', name: 'Тролль', letter: 'T',
  shape: 'rect', color: '#2e8b57', stroke: '#66ff99',
  w: 36, h: 36, hp: 70, speed: 50, damage: 20,
  xp: [28, 32], behavior: 'troll', tier: 3, dropChance: 0.80,
  spawnWeight: 1, hitInterval: 0.8, wobble: 1,
  regenPerSec: 5, fireVulnMul: 2.0,
};

ENEMY_TYPES.cave_bear = {
  id: 'cave_bear', name: 'Пещерный медведь', letter: 'B',
  shape: 'oval', color: '#8b5a2b', stroke: '#d4a06a',
  w: 36, h: 24, hp: 50, speed: 55, damage: 18,
  xp: [23, 27], behavior: 'cave_bear', tier: 3, dropChance: 0.75,
  spawnWeight: 2, hitInterval: 0.8, wobble: 1,
  roarCooldown: 6.0, roarRadius: 80, roarSlowPct: 0.30, roarSlowDuration: 2.0,
};

ENEMY_TYPES.ogre = {
  id: 'ogre', name: 'Огр', letter: 'O',
  shape: 'rect', color: '#daa520', stroke: '#ffcc00',
  w: 40, h: 40, hp: 80, speed: 28, damage: 25,
  xp: [32, 38], behavior: 'ogre', tier: 3, dropChance: 0.85,
  spawnWeight: 1, hitInterval: 0.9, wobble: 0.5,
  slamCooldown: 5.0, slamRadius: 60, slamDamage: 20, slamStun: 0.5,
};

ENEMY_TYPES.pterodactyl = {
  id: 'pterodactyl', name: 'Птеродактиль', letter: 'P',
  shape: 'triangle', color: '#808080', stroke: '#c0c0c0',
  w: 28, h: 16, hp: 18, speed: 140, damage: 15,
  xp: [12, 16], behavior: 'harpy', tier: 3, dropChance: 0.55,
  spawnWeight: 2, hitInterval: 0.5, wobble: 2,
  diveCooldown: 2.5, diveSpeed: 320, diveTime: 0.35, retreatDist: 100,
};

ENEMY_TYPES.giant_scorpion = {
  id: 'giant_scorpion', name: 'Скорпион-гигант', letter: 'S',
  shape: 'oval', color: '#b8860b', stroke: '#ffd700',
  w: 30, h: 18, hp: 28, speed: 55, damage: 12,
  xp: [14, 18], behavior: 'giant_scorpion', tier: 3, dropChance: 0.65,
  spawnWeight: 2, hitInterval: 0.6, wobble: 1,
  stingCooldown: 3.0, stingPoisonDps: 6, stingPoisonDuration: 4,
  deathCloud: { radius: 40, dps: 3, life: 3 },
};

ENEMY_TYPES.lamia = {
  id: 'lamia', name: 'Ламия', letter: 'L',
  shape: 'oval', color: '#228b22', stroke: '#90ee90',
  w: 28, h: 20, hp: 30, speed: 50, damage: 14,
  xp: [18, 22], behavior: 'lamia', tier: 3, dropChance: 0.70,
  spawnWeight: 2, hitInterval: 0.7, wobble: 1.5,
  charmCooldown: 5.0, charmPullDist: 50, charmDamage: 10, keepDistMin: 100, keepDistMax: 140,
};



/* ===== ТИР 4 — серьёзные угрозы (61–70) ===== */
ENEMY_TYPES.dragon_wyrm = {
  id: 'dragon_wyrm', name: 'Дракон-вирм', letter: 'W',
  shape: 'oval', color: '#cc0000', stroke: '#ff6666',
  w: 32, h: 14, hp: 35, speed: 120, damage: 14,
  xp: [20, 24], behavior: 'dragon_wyrm', tier: 4, dropChance: 0.70,
  spawnWeight: 2, hitInterval: 0.6, wobble: 2,
  breathCooldown: 5.0, breathRange: 80, breathPoisonDps: 5, breathPoisonDuration: 4,
};

ENEMY_TYPES.salamander = {
  id: 'salamander', name: 'Саламандра', letter: 'S',
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
  id: 'water_elem_large', name: 'Элементаль воды (большой)', letter: 'E',
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
  id: 'air_elem', name: 'Воздушный элементаль', letter: 'A',
  shape: 'diamond', color: '#ddeeff', stroke: '#ffffff',
  w: 30, h: 30, hp: 25, speed: 130, damage: 10,
  xp: [16, 20], behavior: 'air_elem', tier: 4, dropChance: 0.65,
  spawnWeight: 2, hitInterval: 0.5, wobble: 2,
  gustCooldown: 3.0, gustRange: 100, gustDamage: 10, gustKnockback: 60,
  ignoreWalls: true,
};

ENEMY_TYPES.gargoyle = {
  id: 'gargoyle', name: 'Гаргулья', letter: 'G',
  shape: 'rect', color: '#606060', stroke: '#b0b0b0',
  w: 26, h: 26, hp: 28, speed: 130, damage: 16,
  xp: [18, 22], behavior: 'gargoyle', tier: 4, dropChance: 0.70,
  spawnWeight: 2, hitInterval: 0.5, wobble: 0,
  activateRadius: 100,
};

ENEMY_TYPES.banshee = {
  id: 'banshee', name: 'Баньши', letter: 'B',
  shape: 'oval', color: '#ffffff', stroke: '#ccccff',
  w: 24, h: 24, hp: 22, speed: 60, damage: 8,
  xp: [23, 27], behavior: 'banshee', tier: 4, dropChance: 0.75,
  spawnWeight: 1, hitInterval: 0.7, wobble: 2,
  screamCooldown: 6.0, screamRadius: 120, screamDamage: 20, screamFearDuration: 1.0,
  ignoreWalls: true,
};

ENEMY_TYPES.vampire_spawn = {
  id: 'vampire_spawn', name: 'Вампир-спавн', letter: 'V',
  shape: 'rect', color: '#ffcccc', stroke: '#cc0000',
  w: 26, h: 26, hp: 30, speed: 120, damage: 15,
  xp: [20, 24], behavior: 'vampire_spawn', tier: 4, dropChance: 0.70,
  spawnWeight: 2, hitInterval: 0.5, wobble: 1.5,
  vampirismPct: 0.50, lightVulnMul: 2.0,
};

ENEMY_TYPES.doppelganger_mage = {
  id: 'doppelganger_mage', name: 'Доппельгангер-маг', letter: 'D',
  shape: 'rect', color: '#4444ff', stroke: '#aa00ff',
  w: 28, h: 28, hp: 35, speed: 180, damage: 0,
  xp: [28, 32], behavior: 'doppelganger_mage', tier: 4, dropChance: 0.80,
  spawnWeight: 1, hitInterval: 0.8, wobble: 1.5,
  copyDamageMul: 0.50, attackCooldown: 1.5, splitCount: 2, splitHp: 15,
};

ENEMY_TYPES.owlbear = {
  id: 'owlbear', name: 'Гибрид (сова-медведь)', letter: 'O',
  shape: 'oval', color: '#8b5a2b', stroke: '#d4a06a',
  w: 32, h: 22, hp: 40, speed: 110, damage: 14,
  xp: [23, 27], behavior: 'owlbear', tier: 4, dropChance: 0.75,
  spawnWeight: 2, hitInterval: 0.6, wobble: 1,
  dashCooldown: 3.0, dashSpeed: 280, dashTime: 0.35, dashDamage: 18,
};

ENEMY_TYPES.ice_elem = {
  id: 'ice_elem', name: 'Элементаль льда', letter: 'E',
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
  id: 'adult_dragon', name: 'Взрослый дракон', letter: 'D',
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
  id: 'demon_destroyer', name: 'Демон-разрушитель', letter: 'D',
  shape: 'rect', color: '#990000', stroke: '#ff3300',
  w: 48, h: 48, hp: 180, speed: 22, damage: 28,
  xp: [95, 105], behavior: 'demon_destroyer', tier: 5, dropChance: 1.0,
  spawnWeight: 0, hitInterval: 0.9, wobble: 0.5,
  whipCooldown: 3.0, whipRange: 150, whipDamage: 28,
  meteorCooldown: 7.0, meteorCount: 3, meteorRadius: 50, meteorDamage: 22, meteorSpread: 150,
  rareSpawn: true, maxPerRun: 1,
};

ENEMY_TYPES.illithid_arcanist = {
  id: 'illithid_arcanist', name: 'Иллитид-арканист', letter: 'I',
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
  id: 'rakshasa', name: 'Ракшаса', letter: 'R',
  shape: 'rect', color: '#ff8c00', stroke: '#ffcc00',
  w: 34, h: 34, hp: 60, speed: 110, damage: 22,
  xp: [38, 42], behavior: 'rakshasa', tier: 5, dropChance: 0.90,
  spawnWeight: 1, hitInterval: 0.6, wobble: 1.5,
  magicResist: 0.50, illusionCooldown: 5.0, illusionCount: 2, illusionHp: 15,
  bleedDps: 4, bleedDuration: 3,
};

ENEMY_TYPES.golem_colossus = {
  id: 'golem_colossus', name: 'Голем-колосс', letter: 'C',
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
  id: 'shadow_dragon', name: 'Тень дракона', letter: 'S',
  shape: 'diamond', color: '#1a1a1a', stroke: '#666666',
  w: 44, h: 28, hp: 100, speed: 110, damage: 20,
  xp: [65, 75], behavior: 'shadow_dragon', tier: 5, dropChance: 1.0,
  spawnWeight: 0, hitInterval: 0.7, wobble: 2,
  breathCooldown: 4.0, breathRange: 120, breathDamage: 25, breathDebuffMul: 0.30, breathDebuffDuration: 3.0,
  summonHpPct: 0.50, summonChildId: 'shadow', summonCount: 2,
  rareSpawn: true, maxPerRun: 1,
};

ENEMY_TYPES.slime_queen = {
  id: 'slime_queen', name: 'Королева слизней', letter: 'Q',
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
  id: 'iron_golem', name: 'Железный голем', letter: 'I',
  shape: 'rect', color: '#708090', stroke: '#b0c4de',
  w: 38, h: 38, hp: 90, speed: 28, damage: 22,
  xp: [42, 48], behavior: 'iron_golem', tier: 5, dropChance: 0.90,
  spawnWeight: 1, hitInterval: 0.8, wobble: 0.5,
  shockChance: 0.20, shockRadius: 70, shockDamage: 16,
  fireVulnMul: 2.0, fireSpeedBoost: 0.30, fireSpeedDuration: 3.0,
  immuneElectric: true,
};

ENEMY_TYPES.archdemon = {
  id: 'archdemon', name: 'Архидемон', letter: 'A',
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
  id: 'star_spawn', name: 'Звёздный отродье', letter: 'S',
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
  id: 'ancient_dragon', name: 'Древний дракон', letter: 'A',
  shape: 'diamond', color: '#ffd700', stroke: '#ff4500',
  w: 64, h: 40, hp: 300, speed: 60, damage: 35,
  xp: [190, 210], behavior: 'ancient_dragon', tier: 6, dropChance: 1.0,
  spawnWeight: 1, hitInterval: 0.8, wobble: 3,
  breathCooldown: 6.0, breathRange: 180, breathDamage: 40, breathSpread: 7,
  auraRadius: 120, auraSlowPct: 0.20,
  rageHpPct: 0.20, rageSpeedMul: 1.50, rageCdMul: 0.50,
};

ENEMY_TYPES.kraken_tentacle = {
  id: 'kraken_tentacle', name: 'Кракен (щупальце)', letter: 'K',
  shape: 'rect', color: '#006633', stroke: '#00cc66',
  w: 20, h: 80, hp: 100, speed: 0, damage: 30,
  xp: [75, 85], behavior: 'kraken_tentacle', tier: 6, dropChance: 1.0,
  spawnWeight: 1, hitInterval: 0.5, wobble: 0,
  slamCooldown: 2.0, slamRadius: 150, slamDamage: 30,
};

ENEMY_TYPES.tarrasque_juv = {
  id: 'tarrasque_juv', name: 'Терраска (ювенильный)', letter: 'T',
  shape: 'rect', color: '#8b4513', stroke: '#daa520',
  w: 60, h: 60, hp: 500, speed: 15, damage: 50,
  xp: [280, 320], behavior: 'tarrasque', tier: 6, dropChance: 1.0,
  spawnWeight: 0, hitInterval: 1.0, wobble: 0,
  magicResist: 0.80, physReflect: 0.30,
  stompCooldown: 8.0, stompRadius: 200, stompDamage: 35, stompStun: 1.5,
  rareSpawn: true, maxPerRun: 1,
};

ENEMY_TYPES.chaos_god = {
  id: 'chaos_god', name: 'Бог хаоса (аватар)', letter: 'C',
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
  id: 'vampire_lord', name: 'Лорд вампиров', letter: 'V',
  shape: 'rect', color: '#1a0000', stroke: '#cc0000',
  w: 34, h: 34, hp: 120, speed: 120, damage: 28,
  xp: [85, 95], behavior: 'vampire_lord', tier: 6, dropChance: 1.0,
  spawnWeight: 1, hitInterval: 0.5, wobble: 1.5,
  vampirismPct: 1.0,
  mistCooldown: 5.0, mistDuration: 2.0, mistDamage: 20,
  deathMist: { regenDelay: 10.0, regenPct: 0.50 },
};

ENEMY_TYPES.demilich = {
  id: 'demilich', name: 'Демилич', letter: 'D',
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
  id: 'empyrean', name: 'Эмпиреец', letter: 'E',
  shape: 'diamond', color: '#ffffcc', stroke: '#ffd700',
  w: 36, h: 36, hp: 150, speed: 55, damage: 25,
  xp: [115, 125], behavior: 'empyrean', tier: 6, dropChance: 1.0,
  spawnWeight: 1, hitInterval: 0.7, wobble: 2,
  beamCooldown: 2.0, beamDamage: 25, beamSpeed: 350,
  pillarCooldown: 7.0, pillarCount: 3, pillarRadius: 60, pillarDamage: 30, pillarSpread: 150,
  immuneLight: true,
};

ENEMY_TYPES.beast_lord = {
  id: 'beast_lord', name: 'Повелитель зверей', letter: 'B',
  shape: 'rect', color: '#2e8b2e', stroke: '#66ff66',
  w: 36, h: 36, hp: 70, speed: 55, damage: 22,
  xp: [50, 60], behavior: 'beast_lord', tier: 6, dropChance: 0.95,
  spawnWeight: 1, hitInterval: 0.7, wobble: 1,
  summonCooldown: 8.0, maxSummons: 6,
  summonPool: ['giant_rat', 'cave_bear', 'owlbear'],
};

ENEMY_TYPES.titan_elem = {
  id: 'titan_elem', name: 'Титановый элементаль', letter: 'E',
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
  id: 'night_walker', name: 'Ночной ходок', letter: 'N',
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
    name: base.name + ' (Элит)',
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

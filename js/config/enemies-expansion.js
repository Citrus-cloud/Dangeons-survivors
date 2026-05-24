'use strict';
/* ============================================================
   enemies-expansion.js — 50 new D&D-themed enemies.
   Loaded AFTER constants.js. Adds to ENEMY_TYPES and ENEMY_TIERS.
   
   Distribution:
   - Weak (10):        waves 1+  (tier 1, unlockWave 1)
   - Medium (15):      waves 15+ (new tier 6, unlockWave 15)
   - Strong (15):      waves 25+ (new tier 7, unlockWave 25)
   - Very Strong (10): waves 45+ (new tier 8, unlockWave 45)
   ============================================================ */

/* ===== WEAK — 10 enemies, waves 1+ ===== */


Object.assign(ENEMY_TYPES, {
  plague_rat: {
    id: 'plague_rat', name: t('enemy_plague_rat'), letter: 'r',
    shape: 'oval', color: '#5c4033', stroke: '#8b6914',
    w: 16, h: 10, hp: 10, speed: 115, damage: 6,
    xp: [3, 6], behavior: 'chase', tier: 1, dropChance: 0.35,
    spawnWeight: 3, hitInterval: 0.5, wobble: 1,
    deathPuddle: { kind: 'rot', chance: 0.25, radius: 20, life: 2, slow: 0.05 },
  },
  mushroom_sprite: {
    id: 'mushroom_sprite', name: t('enemy_mushroom_sprite'), letter: 'M',
    shape: 'circle', color: '#ff6b9d', stroke: '#ffffff',
    w: 18, h: 18, hp: 8, speed: 50, damage: 5,
    xp: [3, 5], behavior: 'gas', tier: 1, dropChance: 0.30,
    spawnWeight: 3, wobble: 2,
    explodeRadius: 40, explodeDamage: 8,
  },
  bone_crawler: {
    id: 'bone_crawler', name: t('enemy_bone_crawler'), letter: 'B',
    shape: 'oval', color: '#e8dcc8', stroke: '#ffffff',
    w: 20, h: 12, hp: 14, speed: 70, damage: 7,
    xp: [4, 7], behavior: 'spider', tier: 1, dropChance: 0.40,
    spawnWeight: 3, hitInterval: 0.5, wobble: 1,
    dashEvery: 3.0, dashTime: 0.4, dashMul: 1.8,
  },
  wisp_minor: {
    id: 'wisp_minor', name: t('enemy_wisp_minor'), letter: 'w',
    shape: 'circle', color: '#aaeeff', stroke: '#ffffff',
    w: 14, h: 14, hp: 6, speed: 90, damage: 4,
    xp: [2, 4], behavior: 'bat', tier: 1, dropChance: 0.25,
    spawnWeight: 3, hitInterval: 0.4, wobble: 0,
    sinAmp: 18, sinFreq: 8, dodgeChance: 0.15,
  },

  carrion_beetle: {
    id: 'carrion_beetle', name: t('enemy_carrion_beetle'), letter: 'c',
    shape: 'oval', color: '#2d4a1a', stroke: '#6b8b4a',
    w: 20, h: 14, hp: 16, speed: 45, damage: 8,
    xp: [4, 7], behavior: 'chase', tier: 1, dropChance: 0.40,
    spawnWeight: 3, hitInterval: 0.7, wobble: 1,
  },
  mud_imp: {
    id: 'mud_imp', name: t('enemy_mud_imp'), letter: 'i',
    shape: 'triangle', color: '#8b4513', stroke: '#d2691e',
    w: 16, h: 16, hp: 9, speed: 105, damage: 6,
    xp: [3, 6], behavior: 'goblin', tier: 1, dropChance: 0.30,
    spawnWeight: 3, hitInterval: 0.4, wobble: 1.5,
    retreatDist: 70, retreatCooldown: 1.2,
  },
  spirit_wisp: {
    id: 'spirit_wisp', name: t('enemy_spirit_wisp'), letter: 'S',
    shape: 'circle', color: '#ffffff', stroke: '#ccccff',
    w: 16, h: 16, hp: 7, speed: 65, damage: 5,
    xp: [3, 5], behavior: 'ghost', tier: 1, dropChance: 0.30,
    spawnWeight: 2, hitInterval: 0.6, wobble: 2,
    ignoreWalls: true,
  },
  vine_creeper: {
    id: 'vine_creeper', name: t('enemy_vine_creeper'), letter: 'V',
    shape: 'oval', color: '#228b22', stroke: '#90ee90',
    w: 22, h: 14, hp: 18, speed: 30, damage: 9,
    xp: [5, 8], behavior: 'ooze', tier: 1, dropChance: 0.45,
    spawnWeight: 2, hitInterval: 0.8, wobble: 1,
    trailEvery: 0.6,
    trail: { kind: 'slime', radius: 18, life: 2, slow: 0.12 },
  },

  dust_devil: {
    id: 'dust_devil', name: t('enemy_dust_devil'), letter: 'd',
    shape: 'diamond', color: '#c2b280', stroke: '#f5deb3',
    w: 18, h: 18, hp: 11, speed: 130, damage: 5,
    xp: [3, 6], behavior: 'bat', tier: 1, dropChance: 0.30,
    spawnWeight: 3, hitInterval: 0.4, wobble: 0,
    sinAmp: 22, sinFreq: 7,
  },
  tomb_scarab: {
    id: 'tomb_scarab', name: t('enemy_tomb_scarab'), letter: 't',
    shape: 'oval', color: '#ffd700', stroke: '#b8860b',
    w: 14, h: 10, hp: 5, speed: 140, damage: 4,
    xp: [2, 4], behavior: 'chase', tier: 1, dropChance: 0.20,
    spawnWeight: 4, hitInterval: 0.3, wobble: 1,
  },

/* ===== MEDIUM — 15 enemies, waves 15+ ===== */
  necro_acolyte: {
    id: 'necro_acolyte', name: t('enemy_necro_acolyte'), letter: 'N',
    shape: 'rect', color: '#2d0a4e', stroke: '#9b59b6',
    w: 26, h: 26, hp: 45, speed: 40, damage: 16,
    xp: [20, 28], behavior: 'cultist', tier: 6, dropChance: 0.70,
    spawnWeight: 2, wobble: 1,
    keepDistMin: 110, keepDistMax: 150,
    summonEvery: 6.0, summonChildId: 'skeleton', maxSummons: 4,
  },
  sand_worm: {
    id: 'sand_worm', name: t('enemy_sand_worm'), letter: 'W',
    shape: 'oval', color: '#daa520', stroke: '#f4a460',
    w: 40, h: 20, hp: 70, speed: 35, damage: 22,
    xp: [25, 33], behavior: 'chase', tier: 6, dropChance: 0.80,
    spawnWeight: 2, hitInterval: 0.9, wobble: 1,
    deathPuddle: { kind: 'acid', chance: 1.0, radius: 50, life: 3, slow: 0, dps: 7 },
  },

  toxic_toad: {
    id: 'toxic_toad', name: t('enemy_toxic_toad'), letter: 'T',
    shape: 'oval', color: '#00cc66', stroke: '#66ffcc',
    w: 28, h: 20, hp: 50, speed: 55, damage: 14,
    xp: [22, 30], behavior: 'spider', tier: 6, dropChance: 0.65,
    spawnWeight: 2, hitInterval: 0.6, wobble: 1.5,
    dashEvery: 2.5, dashTime: 0.3, dashMul: 2.5,
    explodeOnDeath: { radius: 55, damage: 18 },
  },
  chain_phantom: {
    id: 'chain_phantom', name: t('enemy_chain_phantom'), letter: 'C',
    shape: 'rect', color: '#4a4a6a', stroke: '#8888cc',
    w: 26, h: 26, hp: 35, speed: 80, damage: 18,
    xp: [24, 30], behavior: 'shadow', tier: 6, dropChance: 0.65,
    spawnWeight: 2, hitInterval: 0.6, wobble: 1.5,
    visibleTime: 2.5, invisibleTime: 1.5, backstabMul: 1.4,
  },
  ember_moth: {
    id: 'ember_moth', name: t('enemy_ember_moth'), letter: 'E',
    shape: 'diamond', color: '#ff4500', stroke: '#ffa500',
    w: 20, h: 20, hp: 28, speed: 110, damage: 10,
    xp: [18, 24], behavior: 'bat', tier: 6, dropChance: 0.55,
    spawnWeight: 3, hitInterval: 0.5, wobble: 0,
    sinAmp: 24, sinFreq: 6,
    trailEvery: 0.5,
    trail: { kind: 'fire', radius: 16, life: 1.5, dps: 4 },
  },
  frozen_husk: {
    id: 'frozen_husk', name: t('enemy_frozen_husk'), letter: 'F',
    shape: 'rect', color: '#b0e0e6', stroke: '#ffffff',
    w: 30, h: 30, hp: 65, speed: 30, damage: 20,
    xp: [24, 32], behavior: 'chase', tier: 6, dropChance: 0.75,
    spawnWeight: 2, hitInterval: 0.8, wobble: 1,
    explodeOnDeath: { radius: 70, damage: 16 },
  },

  swarm_beetle: {
    id: 'swarm_beetle', name: t('enemy_swarm_beetle'), letter: 'S',
    shape: 'oval', color: '#333333', stroke: '#666666',
    w: 22, h: 14, hp: 20, speed: 100, damage: 8,
    xp: [16, 22], behavior: 'chase', tier: 6, dropChance: 0.50,
    spawnWeight: 3, hitInterval: 0.4, wobble: 1,
    splitOnDeath: { childId: 'tomb_scarab', count: 3 },
  },
  mirror_wisp: {
    id: 'mirror_wisp', name: t('enemy_mirror_wisp'), letter: 'M',
    shape: 'circle', color: '#c0c0c0', stroke: '#ffffff',
    w: 20, h: 20, hp: 25, speed: 75, damage: 12,
    xp: [20, 26], behavior: 'mage', tier: 6, dropChance: 0.60,
    spawnWeight: 2, wobble: 2,
    teleportEvery: 3.0, teleportMin: 80, teleportMax: 130,
    attackCooldown: 2.0, projectile: { kind: 'magebolt', speed: 300, life: 2.5 },
  },
  root_shambler: {
    id: 'root_shambler', name: t('enemy_root_shambler'), letter: 'R',
    shape: 'rect', color: '#4a3020', stroke: '#8b6914',
    w: 34, h: 34, hp: 75, speed: 25, damage: 22,
    xp: [26, 34], behavior: 'rotgolem', tier: 6, dropChance: 0.80,
    spawnWeight: 1, hitInterval: 0.9, wobble: 0.5,
    sporeCooldown: 5.0, sporeChildId: 'vine_creeper',
  },
  plaguebearer: {
    id: 'plaguebearer', name: t('enemy_plaguebearer'), letter: 'P',
    shape: 'rect', color: '#556b2f', stroke: '#9acd32',
    w: 28, h: 28, hp: 55, speed: 45, damage: 14,
    xp: [22, 28], behavior: 'ooze', tier: 6, dropChance: 0.70,
    spawnWeight: 2, hitInterval: 0.7, wobble: 1.5,
    trailEvery: 0.4,
    trail: { kind: 'rot', radius: 24, life: 2.5, slow: 0.15, dps: 3 },
  },

  war_boar: {
    id: 'war_boar', name: t('enemy_war_boar'), letter: 'B',
    shape: 'oval', color: '#8b4513', stroke: '#d2691e',
    w: 32, h: 22, hp: 60, speed: 80, damage: 20,
    xp: [24, 30], behavior: 'minotaur', tier: 6, dropChance: 0.70,
    spawnWeight: 2, hitInterval: 0.7, wobble: 1,
    chargeWindup: 1.0, chargeSpeed: 280, chargeRange: 100,
    chargeRestTime: 2.5, knockback: 50,
  },
  corpse_flower: {
    id: 'corpse_flower', name: t('enemy_corpse_flower'), letter: 'F',
    shape: 'circle', color: '#8b0000', stroke: '#ff69b4',
    w: 26, h: 26, hp: 40, speed: 0, damage: 16,
    xp: [20, 26], behavior: 'mold', tier: 6, dropChance: 0.60,
    spawnWeight: 2, hitInterval: 0.7, wobble: 0,
    lungeRange: 70, lungeCooldown: 3.5, lungeSpeed: 220, lungeTime: 0.3,
    deathCloud: { radius: 50, dps: 8, life: 2.5 },
  },
  crystal_spider: {
    id: 'crystal_spider', name: t('enemy_crystal_spider'), letter: 'X',
    shape: 'diamond', color: '#87ceeb', stroke: '#ffffff',
    w: 24, h: 24, hp: 35, speed: 105, damage: 14,
    xp: [20, 26], behavior: 'spider', tier: 6, dropChance: 0.60,
    spawnWeight: 2, hitInterval: 0.5, wobble: 2,
    dashEvery: 1.8, dashTime: 0.4, dashMul: 2.2,
    splitOnDeath: { childId: 'spiderling', count: 2 },
  },
  shadow_hound: {
    id: 'shadow_hound', name: t('enemy_shadow_hound'), letter: 'H',
    shape: 'diamond', color: '#1a1a2e', stroke: '#4a4a8a',
    w: 24, h: 24, hp: 30, speed: 125, damage: 16,
    xp: [20, 26], behavior: 'shadow', tier: 6, dropChance: 0.60,
    spawnWeight: 2, hitInterval: 0.5, wobble: 1,
    visibleTime: 1.8, invisibleTime: 0.8, backstabMul: 1.3,
  },


/* ===== STRONG — 15 enemies, waves 25+ ===== */
  clockwork_spider: {
    id: 'clockwork_spider', name: t('enemy_clockwork_spider'), letter: 'C',
    shape: 'diamond', color: '#b87333', stroke: '#ffd700',
    w: 28, h: 28, hp: 80, speed: 90, damage: 22,
    xp: [35, 45], behavior: 'spider', tier: 7, dropChance: 0.75,
    spawnWeight: 2, hitInterval: 0.5, wobble: 1.5,
    dashEvery: 1.5, dashTime: 0.5, dashMul: 2.5,
  },
  blood_ooze: {
    id: 'blood_ooze', name: t('enemy_blood_ooze'), letter: 'B',
    shape: 'oval', color: '#8b0000', stroke: '#ff4444',
    w: 34, h: 24, hp: 100, speed: 35, damage: 20,
    xp: [38, 48], behavior: 'ooze', tier: 7, dropChance: 0.80,
    spawnWeight: 2, hitInterval: 0.7, wobble: 1.5,
    trailEvery: 0.4,
    trail: { kind: 'slime', radius: 26, life: 3, slow: 0.20 },
    splitOnDeath: { childId: 'slimeling', count: 3 },
  },
  ash_wraith: {
    id: 'ash_wraith', name: t('enemy_ash_wraith'), letter: 'A',
    shape: 'rect', color: '#3d3d3d', stroke: '#ff6600',
    w: 28, h: 28, hp: 60, speed: 95, damage: 24,
    xp: [36, 44], behavior: 'shadow', tier: 7, dropChance: 0.75,
    spawnWeight: 2, hitInterval: 0.6, wobble: 1.5,
    visibleTime: 2.0, invisibleTime: 1.2, backstabMul: 1.6,
    explodeOnDeath: { radius: 70, damage: 22 },
  },
  crystal_golem: {
    id: 'crystal_golem', name: t('enemy_crystal_golem'), letter: 'G',
    shape: 'rect', color: '#e0e0ff', stroke: '#9999ff',
    w: 40, h: 40, hp: 140, speed: 22, damage: 30,
    xp: [42, 52], behavior: 'chase', tier: 7, dropChance: 0.85,
    spawnWeight: 1, hitInterval: 0.9, wobble: 0.5,
    immunePoison: true, immuneBleed: true,
    stunChance: 0.25, stunDuration: 0.6,
  },

  nether_hound: {
    id: 'nether_hound', name: t('enemy_nether_hound'), letter: 'N',
    shape: 'diamond', color: '#4b0082', stroke: '#9400d3',
    w: 28, h: 28, hp: 65, speed: 130, damage: 22,
    xp: [34, 42], behavior: 'fire_elem', tier: 7, dropChance: 0.70,
    spawnWeight: 2, hitInterval: 0.5, wobble: 1.5,
    trailEvery: 0.35,
    trail: { kind: 'fire', radius: 20, life: 2, dps: 7 },
  },
  spore_carrier: {
    id: 'spore_carrier', name: t('enemy_spore_carrier'), letter: 'S',
    shape: 'circle', color: '#6b8e23', stroke: '#9acd32',
    w: 32, h: 32, hp: 90, speed: 30, damage: 18,
    xp: [36, 44], behavior: 'rotgolem', tier: 7, dropChance: 0.80,
    spawnWeight: 2, hitInterval: 0.8, wobble: 1,
    sporeCooldown: 4.0, sporeChildId: 'mushroom_sprite',
  },
  gravity_aberration: {
    id: 'gravity_aberration', name: t('enemy_gravity_aberration'), letter: 'G',
    shape: 'circle', color: '#2f0044', stroke: '#7700bb',
    w: 36, h: 36, hp: 85, speed: 40, damage: 16,
    xp: [40, 50], behavior: 'mage', tier: 7, dropChance: 0.80,
    spawnWeight: 1, wobble: 2,
    teleportEvery: 3.5, teleportMin: 90, teleportMax: 140,
    attackCooldown: 2.0, projectile: { kind: 'magebolt', speed: 260, life: 3 },
  },
  corpse_detonator: {
    id: 'corpse_detonator', name: t('enemy_corpse_detonator'), letter: 'D',
    shape: 'rect', color: '#556b2f', stroke: '#ff0000',
    w: 30, h: 30, hp: 50, speed: 70, damage: 12,
    xp: [32, 40], behavior: 'gas', tier: 7, dropChance: 0.70,
    spawnWeight: 2, wobble: 1.5,
    explodeRadius: 90, explodeDamage: 35,
  },
  echo_shade: {
    id: 'echo_shade', name: t('enemy_echo_shade'), letter: 'E',
    shape: 'rect', color: '#191970', stroke: '#4169e1',
    w: 26, h: 26, hp: 55, speed: 100, damage: 20,
    xp: [34, 42], behavior: 'doppelganger', tier: 7, dropChance: 0.75,
    spawnWeight: 1, hitInterval: 0.7, wobble: 1.5,
    copyDamageMul: 0.60, attackCooldown: 1.8,
  },

  magma_crab: {
    id: 'magma_crab', name: t('enemy_magma_crab'), letter: 'M',
    shape: 'oval', color: '#ff4500', stroke: '#ffd700',
    w: 34, h: 22, hp: 95, speed: 35, damage: 25,
    xp: [38, 46], behavior: 'crab', tier: 7, dropChance: 0.80,
    spawnWeight: 2, hitInterval: 0.8, wobble: 1,
    shellDR: 0.55, shellDuration: 1.2, shellCooldown: 3.0,
    trailEvery: 0.5,
    trail: { kind: 'fire', radius: 20, life: 2, dps: 6 },
  },
  void_stalker: {
    id: 'void_stalker', name: t('enemy_void_stalker'), letter: 'V',
    shape: 'triangle', color: '#0d0d2b', stroke: '#6600cc',
    w: 26, h: 26, hp: 70, speed: 115, damage: 26,
    xp: [38, 46], behavior: 'shadow', tier: 7, dropChance: 0.75,
    spawnWeight: 2, hitInterval: 0.5, wobble: 1.5,
    visibleTime: 1.5, invisibleTime: 1.5, backstabMul: 1.8,
  },
  soul_collector: {
    id: 'soul_collector', name: t('enemy_soul_collector'), letter: 'S',
    shape: 'rect', color: '#1a1a3a', stroke: '#00ffff',
    w: 30, h: 30, hp: 75, speed: 50, damage: 20,
    xp: [40, 50], behavior: 'cultist', tier: 7, dropChance: 0.80,
    spawnWeight: 1, wobble: 1.5,
    keepDistMin: 120, keepDistMax: 160,
    summonEvery: 5.0, summonChildId: 'spirit_wisp', maxSummons: 5,
  },
  plague_golem: {
    id: 'plague_golem', name: t('enemy_plague_golem'), letter: 'P',
    shape: 'rect', color: '#4a6b3a', stroke: '#88cc44',
    w: 42, h: 42, hp: 130, speed: 22, damage: 28,
    xp: [44, 54], behavior: 'rotgolem', tier: 7, dropChance: 0.85,
    spawnWeight: 1, hitInterval: 0.9, wobble: 0.5,
    sporeCooldown: 3.5, sporeChildId: 'plague_rat',
    explodeOnDeath: { radius: 80, damage: 25 },
  },
  thunder_elemental: {
    id: 'thunder_elemental', name: t('enemy_thunder_elemental'), letter: 'T',
    shape: 'diamond', color: '#ffd700', stroke: '#ffffff',
    w: 32, h: 32, hp: 80, speed: 85, damage: 24,
    xp: [40, 50], behavior: 'fire_elem', tier: 7, dropChance: 0.80,
    spawnWeight: 2, hitInterval: 0.6, wobble: 2,
    trailEvery: 0.3,
    trail: { kind: 'fire', radius: 18, life: 1.5, dps: 8 },
  },
  bone_hydra_enemy: {
    id: 'bone_hydra_enemy', name: t('enemy_bone_hydra_enemy'), letter: 'H',
    shape: 'oval', color: '#d9d0c0', stroke: '#ffffff',
    w: 40, h: 28, hp: 110, speed: 28, damage: 18,
    xp: [44, 54], behavior: 'hydra', tier: 7, dropChance: 0.85,
    spawnWeight: 1, hitInterval: 0.6, wobble: 1,
    heads: 4, headHp: 28, headRegenTime: 6.0, regenPerHead: 3,
  },


/* ===== VERY STRONG — 10 enemies, waves 45+ ===== */
  dream_weaver: {
    id: 'dream_weaver', name: t('enemy_dream_weaver'), letter: 'D',
    shape: 'circle', color: '#9b59b6', stroke: '#e8daef',
    w: 30, h: 30, hp: 120, speed: 50, damage: 28,
    xp: [55, 70], behavior: 'mage', tier: 8, dropChance: 0.90,
    spawnWeight: 2, wobble: 2,
    teleportEvery: 2.5, teleportMin: 100, teleportMax: 160,
    attackCooldown: 1.8, projectile: { kind: 'magebolt', speed: 320, life: 3 },
  },
  rust_hulk: {
    id: 'rust_hulk', name: t('enemy_rust_hulk'), letter: 'R',
    shape: 'rect', color: '#b87333', stroke: '#ff6600',
    w: 46, h: 46, hp: 200, speed: 20, damage: 40,
    xp: [60, 75], behavior: 'chase', tier: 8, dropChance: 0.95,
    spawnWeight: 1, hitInterval: 1.0, wobble: 0.5,
    immunePoison: true, immuneBleed: true,
    stunChance: 0.35, stunDuration: 0.8,
    rustDebuff: { damageMul: 0.70, duration: 4.0, maxStacks: 3 },
  },
  parasite_host: {
    id: 'parasite_host', name: t('enemy_parasite_host'), letter: 'P',
    shape: 'rect', color: '#4a0e4a', stroke: '#ff00ff',
    w: 36, h: 36, hp: 150, speed: 45, damage: 30,
    xp: [58, 72], behavior: 'rotgolem', tier: 8, dropChance: 0.90,
    spawnWeight: 2, hitInterval: 0.8, wobble: 1,
    sporeCooldown: 3.0, sporeChildId: 'carrion_beetle',
    splitOnDeath: { childId: 'plague_rat', count: 5 },
  },
  hex_weaver: {
    id: 'hex_weaver', name: t('enemy_hex_weaver'), letter: 'H',
    shape: 'triangle', color: '#660066', stroke: '#ff00ff',
    w: 28, h: 28, hp: 100, speed: 60, damage: 24,
    xp: [55, 68], behavior: 'archer', tier: 8, dropChance: 0.85,
    spawnWeight: 2, wobble: 1.5,
    keepDistMin: 140, keepDistMax: 190,
    attackCooldown: 1.5, projectile: { kind: 'dark_arrow', speed: 300, life: 3 },
  },

  temporal_beetle: {
    id: 'temporal_beetle', name: t('enemy_temporal_beetle'), letter: 'T',
    shape: 'oval', color: '#00ced1', stroke: '#7fffd4',
    w: 30, h: 20, hp: 90, speed: 110, damage: 22,
    xp: [50, 62], behavior: 'spider', tier: 8, dropChance: 0.80,
    spawnWeight: 2, hitInterval: 0.5, wobble: 1,
    dashEvery: 1.2, dashTime: 0.5, dashMul: 3.0,
    dodgeChance: 0.30,
  },
  entropy_golem: {
    id: 'entropy_golem', name: t('enemy_entropy_golem'), letter: 'E',
    shape: 'rect', color: '#2f4f4f', stroke: '#00ffff',
    w: 48, h: 48, hp: 250, speed: 18, damage: 45,
    xp: [70, 85], behavior: 'chase', tier: 8, dropChance: 1.0,
    spawnWeight: 1, hitInterval: 1.0, wobble: 0.5,
    immunePoison: true, immuneBleed: true,
    explodeOnDeath: { radius: 100, damage: 40 },
  },
  soul_furnace: {
    id: 'soul_furnace', name: t('enemy_soul_furnace'), letter: 'F',
    shape: 'diamond', color: '#ff1493', stroke: '#ffffff',
    w: 36, h: 36, hp: 160, speed: 40, damage: 32,
    xp: [62, 78], behavior: 'fire_elem', tier: 8, dropChance: 0.95,
    spawnWeight: 1, hitInterval: 0.7, wobble: 2,
    trailEvery: 0.25,
    trail: { kind: 'fire', radius: 24, life: 3, dps: 12 },
    explodeOnDeath: { radius: 90, damage: 35 },
  },
  void_leviathan: {
    id: 'void_leviathan', name: t('enemy_void_leviathan'), letter: 'L',
    shape: 'oval', color: '#0a0a2a', stroke: '#4400aa',
    w: 50, h: 32, hp: 220, speed: 25, damage: 35,
    xp: [68, 82], behavior: 'hydra', tier: 8, dropChance: 1.0,
    spawnWeight: 1, hitInterval: 0.7, wobble: 1,
    heads: 5, headHp: 44, headRegenTime: 5.0, regenPerHead: 4,
  },

  plague_knight: {
    id: 'plague_knight', name: t('enemy_plague_knight'), letter: 'K',
    shape: 'rect', color: '#2e8b57', stroke: '#ffd700',
    w: 38, h: 38, hp: 180, speed: 55, damage: 36,
    xp: [65, 80], behavior: 'death_knight', tier: 8, dropChance: 0.95,
    spawnWeight: 1, hitInterval: 0.8, wobble: 0.5,
    aoeCooldown: 6.0, aoeRadius: 110, aoeDamage: 28,
    healReduction: 0.60, healReductionDuration: 5.0,
    deathCurse: { damageTakenMul: 1.40, duration: 6.0 },
    deathPuddle: { kind: 'rot', chance: 1.0, radius: 60, life: 4, slow: 0.20, dps: 8 },
  },
  hive_queen: {
    id: 'hive_queen', name: t('enemy_hive_queen'), letter: 'Q',
    shape: 'oval', color: '#daa520', stroke: '#ffd700',
    w: 44, h: 30, hp: 170, speed: 35, damage: 20,
    xp: [65, 80], behavior: 'cultist', tier: 8, dropChance: 0.95,
    spawnWeight: 1, wobble: 1,
    keepDistMin: 130, keepDistMax: 170,
    summonEvery: 3.5, summonChildId: 'swarm_beetle', maxSummons: 6,
    rareSpawn: true, maxPerRun: 3,
  },
});


/* ============================================================
   Register new tiers in ENEMY_TIERS (extends existing 1-5).
   Tier 6: unlockWave 15 (Medium)
   Tier 7: unlockWave 25 (Strong)
   Tier 8: unlockWave 45 (Very Strong)
   ============================================================ */
ENEMY_TIERS[6] = {
  unlockWave: 15,
  ids: [
    'necro_acolyte', 'sand_worm', 'toxic_toad', 'chain_phantom',
    'ember_moth', 'frozen_husk', 'swarm_beetle', 'mirror_wisp',
    'root_shambler', 'plaguebearer', 'war_boar', 'corpse_flower',
    'crystal_spider', 'shadow_hound', 'dust_devil'
  ]
};

ENEMY_TIERS[7] = {
  unlockWave: 25,
  ids: [
    'clockwork_spider', 'blood_ooze', 'ash_wraith', 'crystal_golem',
    'nether_hound', 'spore_carrier', 'gravity_aberration',
    'corpse_detonator', 'echo_shade', 'magma_crab', 'void_stalker',
    'soul_collector', 'plague_golem', 'thunder_elemental',
    'bone_hydra_enemy'
  ]
};

ENEMY_TIERS[8] = {
  unlockWave: 45,
  ids: [
    'dream_weaver', 'rust_hulk', 'parasite_host', 'hex_weaver',
    'temporal_beetle', 'entropy_golem', 'soul_furnace',
    'void_leviathan', 'plague_knight', 'hive_queen'
  ]
};

/* Also add first 10 weak enemies to tier 1 for variety */
ENEMY_TIERS[1].ids.push(
  'plague_rat', 'mushroom_sprite', 'bone_crawler', 'wisp_minor',
  'carrion_beetle', 'mud_imp', 'spirit_wisp', 'vine_creeper',
  'dust_devil', 'tomb_scarab'
);

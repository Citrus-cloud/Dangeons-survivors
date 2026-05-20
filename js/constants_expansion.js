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

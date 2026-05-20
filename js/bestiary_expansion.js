'use strict';
/* ============================================================
   bestiary_expansion.js — Описания 50 новых врагов и 5 боссов
   для бестиария. Загружается ПОСЛЕ bestiary.js.
   ============================================================ */

/* === Описания новых врагов === */
Object.assign(BESTIARY_DESCRIPTIONS, {
  // ТИР 1
  plague_rat: t('bestiary_desc_plague_rat'),
  mushroom_sprite: t('bestiary_desc_mushroom_sprite'),
  bone_crawler: t('bestiary_desc_bone_crawler'),
  wisp_minor: t('bestiary_desc_wisp_minor'),
  carrion_beetle: t('bestiary_desc_carrion_beetle'),
  mud_imp: t('bestiary_desc_mud_imp'),
  spirit_wisp: t('bestiary_desc_spirit_wisp'),
  vine_creeper: t('bestiary_desc_vine_creeper'),

  // ТИР 2
  necro_acolyte: t('bestiary_desc_necro_acolyte'),
  sand_worm: t('bestiary_desc_sand_worm'),
  toxic_toad: t('bestiary_desc_toxic_toad'),
  chain_phantom: t('bestiary_desc_chain_phantom'),
  ember_moth: t('bestiary_desc_ember_moth'),
  frozen_husk: t('bestiary_desc_frozen_husk'),
  swarm_beetle: t('bestiary_desc_swarm_beetle'),
  mirror_wisp: t('bestiary_desc_mirror_wisp'),
  root_shambler: t('bestiary_desc_root_shambler'),
  plaguebearer: t('bestiary_desc_plaguebearer'),

  // ТИР 3
  clockwork_spider: t('bestiary_desc_clockwork_spider'),
  blood_ooze: t('bestiary_desc_blood_ooze'),
  ash_wraith: t('bestiary_desc_ash_wraith'),
  crystal_golem: t('bestiary_desc_crystal_golem'),
  nether_hound: t('bestiary_desc_nether_hound'),
  spore_carrier: t('bestiary_desc_spore_carrier'),
  gravity_aberration: t('bestiary_desc_gravity_aberration'),
  corpse_detonator: t('bestiary_desc_corpse_detonator'),
  echo_shade: t('bestiary_desc_echo_shade'),
  magma_crab: t('bestiary_desc_magma_crab'),


  // ТИР 4
  void_stalker: t('bestiary_desc_void_stalker'),
  soul_collector: t('bestiary_desc_soul_collector'),
  plague_golem: t('bestiary_desc_plague_golem'),
  thunder_elemental: t('bestiary_desc_thunder_elemental'),
  bone_hydra_enemy: t('bestiary_desc_bone_hydra_enemy'),
  dream_weaver: t('bestiary_desc_dream_weaver'),
  rust_hulk: t('bestiary_desc_rust_hulk'),
  parasite_host: t('bestiary_desc_parasite_host'),
  hex_weaver: t('bestiary_desc_hex_weaver'),
  temporal_beetle: t('bestiary_desc_temporal_beetle'),

  // ТИР 5
  entropy_golem: t('bestiary_desc_entropy_golem'),
  soul_furnace: t('bestiary_desc_soul_furnace'),
  void_leviathan: t('bestiary_desc_void_leviathan'),
  plague_knight: t('bestiary_desc_plague_knight'),
  hive_queen: t('bestiary_desc_hive_queen'),
  chaos_chimera: t('bestiary_desc_chaos_chimera'),
  obelisk_guardian: t('bestiary_desc_obelisk_guardian'),
  shadow_prince: t('bestiary_desc_shadow_prince'),
  abyssal_maw: t('bestiary_desc_abyssal_maw'),
  living_dungeon: t('bestiary_desc_living_dungeon'),

  // ОСОБЫЕ
  doom_herald: t('bestiary_desc_doom_herald'),
  treasure_golem: t('bestiary_desc_treasure_golem'),
});

/* === Способности новых врагов === */
Object.assign(BESTIARY_ABILITIES, {
  // ТИР 1
  plague_rat: t('bestiary_desc_plague_rat'),
  mushroom_sprite: t('bestiary_desc_mushroom_sprite'),
  bone_crawler: t('bestiary_desc_bone_crawler'),
  wisp_minor: t('bestiary_desc_wisp_minor'),
  carrion_beetle: t('bestiary_desc_carrion_beetle'),
  mud_imp: t('bestiary_desc_mud_imp'),
  spirit_wisp: t('bestiary_desc_spirit_wisp'),
  vine_creeper: t('bestiary_desc_vine_creeper'),

  // ТИР 2
  necro_acolyte: t('bestiary_desc_necro_acolyte'),
  sand_worm: t('bestiary_desc_sand_worm'),
  toxic_toad: t('bestiary_desc_toxic_toad'),
  chain_phantom: t('bestiary_desc_chain_phantom'),
  ember_moth: t('bestiary_desc_ember_moth'),
  frozen_husk: t('bestiary_desc_frozen_husk'),
  swarm_beetle: t('bestiary_desc_swarm_beetle'),
  mirror_wisp: t('bestiary_desc_mirror_wisp'),
  root_shambler: t('bestiary_desc_root_shambler'),
  plaguebearer: t('bestiary_desc_plaguebearer'),


  // ТИР 3
  clockwork_spider: t('bestiary_desc_clockwork_spider'),
  blood_ooze: t('bestiary_desc_blood_ooze'),
  ash_wraith: t('bestiary_desc_ash_wraith'),
  crystal_golem: t('bestiary_desc_crystal_golem'),
  nether_hound: t('bestiary_desc_nether_hound'),
  spore_carrier: t('bestiary_desc_spore_carrier'),
  gravity_aberration: t('bestiary_desc_gravity_aberration'),
  corpse_detonator: t('bestiary_desc_corpse_detonator'),
  echo_shade: t('bestiary_desc_echo_shade'),
  magma_crab: t('bestiary_desc_magma_crab'),

  // ТИР 4
  void_stalker: t('bestiary_desc_void_stalker'),
  soul_collector: t('bestiary_desc_soul_collector'),
  plague_golem: t('bestiary_desc_plague_golem'),
  thunder_elemental: t('bestiary_desc_thunder_elemental'),
  bone_hydra_enemy: t('bestiary_desc_bone_hydra_enemy'),
  dream_weaver: t('bestiary_desc_dream_weaver'),
  rust_hulk: t('bestiary_desc_rust_hulk'),
  parasite_host: t('bestiary_desc_parasite_host'),
  hex_weaver: t('bestiary_desc_hex_weaver'),
  temporal_beetle: t('bestiary_desc_temporal_beetle'),

  // ТИР 5
  entropy_golem: t('bestiary_desc_entropy_golem'),
  soul_furnace: t('bestiary_desc_soul_furnace'),
  void_leviathan: t('bestiary_desc_void_leviathan'),
  plague_knight: t('bestiary_desc_plague_knight'),
  hive_queen: t('bestiary_desc_hive_queen'),
  chaos_chimera: t('bestiary_desc_chaos_chimera'),
  obelisk_guardian: t('bestiary_desc_obelisk_guardian'),
  shadow_prince: t('bestiary_desc_shadow_prince'),
  abyssal_maw: t('bestiary_desc_abyssal_maw'),
  living_dungeon: t('bestiary_desc_living_dungeon'),

  // ОСОБЫЕ
  doom_herald: t('bestiary_desc_doom_herald'),
  treasure_golem: t('bestiary_desc_treasure_golem'),
});


/* === Описания новых боссов === */
Object.assign(BESTIARY_DESCRIPTIONS, {
  boss_web_architect: t('bestiary_desc_boss_web_architect'),
  boss_storm_colossus: t('bestiary_desc_boss_storm_colossus'),
  boss_puzzle_sphinx: t('bestiary_desc_boss_puzzle_sphinx'),
  boss_bone_hydra: t('bestiary_desc_boss_bone_hydra'),
  boss_mirror_king: t('bestiary_desc_boss_mirror_king'),
});

Object.assign(BESTIARY_ABILITIES, {
  boss_web_architect: t('bestiary_desc_boss_web_architect'),
  boss_storm_colossus: t('bestiary_desc_boss_storm_colossus'),
  boss_puzzle_sphinx: t('bestiary_desc_boss_puzzle_sphinx'),
  boss_bone_hydra: t('bestiary_desc_boss_bone_hydra'),
  boss_mirror_king: t('bestiary_desc_boss_mirror_king'),
});

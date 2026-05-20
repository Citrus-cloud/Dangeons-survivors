'use strict';
/* ============================================================
   biome-fixes.js — Дополняет биомы врагами из всех тиров.
   Загружается ПОСЛЕ constants.js (когда BIOMES, ENEMY_TYPES,
   ENEMY_TIERS уже определены).
   ============================================================ */

(function applyBiomeFixes() {
  if (!window.BIOMES || !window.ENEMY_TYPES || !window.ENEMY_TIERS) return;

  const allEnemyIds = Object.keys(ENEMY_TYPES).filter(function(id) {
    const cfg = ENEMY_TYPES[id];
    return cfg && cfg.spawnWeight > 0 && cfg.tier >= 1;
  });

  for (let i = 0; i < BIOMES.length; i++) {
    const biome = BIOMES[i];
    if (!biome.enemyTypes) biome.enemyTypes = [];
    const existing = new Set(biome.enemyTypes);
    for (let j = 0; j < allEnemyIds.length; j++) {
      const id = allEnemyIds[j];
      if (existing.has(id)) continue;
      var cfg = ENEMY_TYPES[id];
      if (cfg.tier >= 3) {
        biome.enemyTypes.push(id);
      }
    }
  }
})();

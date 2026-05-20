'use strict';
/* ============================================================
   biome-fixes.js — Дополняет биомы врагами из расширений,
   но ТОЛЬКО теми, что подходят данному биому по тиру.
   Загружается ПОСЛЕ constants.js (когда BIOMES, ENEMY_TYPES,
   ENEMY_TIERS уже определены).

   Исправление: ранее добавлялись ВСЕ враги tier>=3 во все биомы,
   что приводило к переполнению волн дублями (dream_weaver,
   gravity_aberration и др.).
   Теперь: добавляются только враги, явно присутствующие
   в ENEMY_TIERS[N].ids, до лимита 5 случайных дополнений на биом.
   ============================================================ */

(function applyBiomeFixes() {
  if (!window.BIOMES || !window.ENEMY_TYPES || !window.ENEMY_TIERS) return;

  // Собираем множество всех ID, зарегистрированных в тирах (безопасные для спавна)
  const registeredIds = new Set();
  for (let t = 1; t <= 6; t++) {
    const tier = ENEMY_TIERS[t];
    if (tier && tier.ids) {
      for (const id of tier.ids) registeredIds.add(id);
    }
  }

  for (let i = 0; i < BIOMES.length; i++) {
    const biome = BIOMES[i];
    if (!biome.enemyTypes) biome.enemyTypes = [];
    const existing = new Set(biome.enemyTypes);

    // Добавляем только зарегистрированных в ENEMY_TIERS врагов,
    // которых ещё нет в биоме, и только с spawnWeight > 0
    const candidates = [];
    for (const id of registeredIds) {
      if (existing.has(id)) continue;
      const cfg = ENEMY_TYPES[id];
      if (!cfg || cfg.spawnWeight <= 0) continue;
      if (cfg.tier < 1) continue;
      // Не добавляем дочерних/особых врагов
      if (cfg.tier === 0) continue;
      candidates.push(id);
    }

    // Добавляем не более 5 случайных из кандидатов для разнообразия
    const maxAdd = 5;
    for (let j = 0; j < maxAdd && candidates.length > 0; j++) {
      const idx = Math.floor(Math.random() * candidates.length);
      biome.enemyTypes.push(candidates[idx]);
      candidates.splice(idx, 1);
    }
  }
})();

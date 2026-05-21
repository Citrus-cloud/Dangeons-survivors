'use strict';
/* ============================================================
   biome-fixes.js — Дополнение биомов врагами из высших тиров.
   
   Назначение:
   Этот модуль автоматически расширяет список врагов для каждого 
   биома, добавляя монстров тира 3+ (элитных и сильных). Это
   гарантирует, что в любом биоме есть разнообразие вызовов,
   даже если при ручной настройке некоторые были пропущены.
   
   Загрузка:
   Выполняется ПОСЛЕ constants.js, когда глобальные объекты 
   BIOMES, ENEMY_TYPES и ENEMY_TIERS уже определены в window.
   ============================================================ */

(function applyBiomeFixes() {
  /* --- Проверка зависимостей --- */
  if (!window.BIOMES || !window.ENEMY_TYPES || !window.ENEMY_TIERS) {
    return; // Зависимости не загружены — выходим без ошибки
  }

  /* --- Собираем ID всех врагов, подходящих для добавления --- */
  // Фильтруем: только те, кто имеет положительный вес спавна и тир >= 1
  const eligibleEnemyIds = Object.keys(ENEMY_TYPES).filter(function(id) {
    const config = ENEMY_TYPES[id];
    return config && config.spawnWeight > 0 && config.tier >= 1;
  });

  /* --- Расширяем список врагов каждого биома --- */
  for (let i = 0; i < BIOMES.length; i++) {
    const biome = BIOMES[i];

    // Инициализируем массив врагов, если отсутствует
    if (!biome.enemyTypes) {
      biome.enemyTypes = [];
    }

    // Создаём Set для быстрой проверки существующих врагов (O(1) вместо O(n))
    const existingEnemies = new Set(biome.enemyTypes);

    // Добавляем врагов тира 3+ в биом, если их там ещё нет
    for (let j = 0; j < eligibleEnemyIds.length; j++) {
      const enemyId = eligibleEnemyIds[j];

      // Пропускаем уже добавленных
      if (existingEnemies.has(enemyId)) {
        continue;
      }

      const enemyConfig = ENEMY_TYPES[enemyId];

      // Добавляем только врагов тира 3 и выше (сильных/элитных)
      if (enemyConfig.tier >= 3) {
        biome.enemyTypes.push(enemyId);
      }
    }
  }
})();

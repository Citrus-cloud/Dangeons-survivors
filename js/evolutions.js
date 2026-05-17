'use strict';
/* ============================================================
   evolutions.js — система эволюций (Шаг 3).

   Идея: при подборе сундука и выпадении d20 = 19..20 проверяем
   готовые пары "оружие 5 ур. + пассивка 5 ур." по списку рецептов.
   Если такая пара есть — игроку предлагается слить их в новое
   мощное оружие. Эволюция занимает тот же слот, что и исходное
   оружие; пассивка удаляется из слота (освобождая его).

   Рецепты:
     ⚔ Меч            + ✚ Регенерация    -> 🩸 Вампирский клинок
     🏹 Лук            + ➤ Ускорение      -> 🌪 Скорострельный лук
     🗡 Кинжалы        + ⚡ Усиление урона -> 💥 Шквал клинков
     🔥 Огненный шар   + ◎ Магнит опыта   -> 👻 Пламя души
   ============================================================ */

/** Список рецептов эволюции. Поля:
 *   weaponId   — id базового оружия (см. weapons.js)
 *   abilityId  — id пассивки (см. abilities.js)
 *   resultId   — id итогового оружия (фабрика в EVOLVED_WEAPON_FACTORIES)
 *   resultName — отображаемое имя
 *   resultIcon — иконка
 *   desc       — описание эффекта (для UI)
 */
const EVOLUTIONS = [
  {
    weaponId: 'sword',
    abilityId: 'regen',
    resultId: 'vampire_blade',
    resultName: 'Вампирский клинок',
    resultIcon: '🩸',
    desc: 'Ближний бой, урон 25, +3 HP за каждое попадание.',
  },
  {
    weaponId: 'bow',
    abilityId: 'haste',
    resultId: 'rapid_bow',
    resultName: 'Скорострельный лук',
    resultIcon: '🌪',
    desc: 'Очередь из 3 стрел, урон 15 каждая.',
  },
  {
    weaponId: 'daggers',
    abilityId: 'power',
    resultId: 'blade_storm',
    resultName: 'Шквал клинков',
    resultIcon: '💥',
    desc: '5 кинжалов веером, урон 12, шанс крита 20% (×2).',
  },
  {
    weaponId: 'fireball',
    abilityId: 'magnet',
    resultId: 'soul_flame',
    resultName: 'Пламя души',
    resultIcon: '👻',
    desc: 'Взрыв (урон 30) притягивает весь опыт на карте.',
  },
];


const Evolutions = {
  /** Полный список рецептов (для UI/отладки). */
  list() { return EVOLUTIONS; },

  /** Найти рецепт по id итогового оружия (или null). */
  byResultId(resultId) {
    for (const e of EVOLUTIONS) if (e.resultId === resultId) return e;
    return null;
  },

  /**
   * Проверка готовых эволюций у игрока.
   * Готовая пара: оружие на максимуме (level === maxLevel) И
   * пассивка на максимуме. Базовое оружие НЕ должно уже быть
   * эволюцией (у эволюционных стоит флаг isEvolved).
   *
   * @returns {Array<{recipe, weapon, ability}>} готовые пары
   *   в порядке слотов оружия (приоритет — левее).
   */
  findReady(player) {
    const out = [];
    if (!player) return out;
    for (let i = 0; i < player.weaponSlots.length; i++) {
      const w = player.weaponSlots[i];
      if (!w) continue;
      if (w.isEvolved) continue;
      if (w.level < w.maxLevel) continue;
      // Ищем рецепт для этого оружия
      const rec = EVOLUTIONS.find(r => r.weaponId === w.id);
      if (!rec) continue;
      const ab = Player.findAbility(player, rec.abilityId);
      if (!ab) continue;
      if (ab.level < ab.maxLevel) continue;
      out.push({ recipe: rec, weapon: w, ability: ab });
    }
    return out;
  },

  /**
   * Применить эволюцию к игроку.
   * - Создаёт новое оружие через EVOLVED_WEAPON_FACTORIES[recipe.resultId]().
   * - Заменяет в том же слоте, где было исходное оружие.
   * - Удаляет пассивку из её слота (player.removeAbility снимает эффекты).
   * - Спавнит визуальный эффект "слияния" вокруг героя (если Particles доступен).
   *
   * @returns {boolean} true, если эволюция произошла.
   */
  apply(player, recipe) {
    if (!player || !recipe) return false;
    const w = Player.findWeapon(player, recipe.weaponId);
    const a = Player.findAbility(player, recipe.abilityId);
    if (!w || !a) return false;

    const factory = (window.EVOLVED_WEAPON_FACTORIES || {})[recipe.resultId];
    if (typeof factory !== 'function') return false;

    const newWeapon = factory();
    // Заменяем в слоте оружия
    Player.replaceWeapon(player, w.slotIndex, newWeapon);
    // Удаляем пассивку из её слота (с откатом эффектов)
    Player.removeAbility(player, a.slotIndex);

    // Визуальный эффект слияния
    if (window.Particles && window.Particles.fusionBurst) {
      Particles.fusionBurst(player.x, player.y);
    }
    if (window.Particles && window.Particles.text) {
      Particles.text(player.x, player.y - 40, recipe.resultName, 1.4, '#ffd84a', 16);
    }
    return true;
  },
};

window.EVOLUTIONS = EVOLUTIONS;
window.Evolutions = Evolutions;

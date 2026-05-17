'use strict';
/* ============================================================
   evolutions.js — система эволюций (Шаг 9-10).

   25 рецептов эволюций, 5 супер-эволюций.
   При d20=19-20 показываем все доступные эволюции для выбора.
   ============================================================ */

/** Список рецептов эволюции (25 штук). */
const EVOLUTIONS = [
  // === 4 существующих ===
  {
    weaponId: 'sword', abilityId: 'regen',
    resultId: 'vampire_blade', resultName: 'Вампирский клинок', resultIcon: '🩸',
    desc: 'Ближний бой, урон 25, +3 HP за каждое попадание.',
  },
  {
    weaponId: 'bow', abilityId: 'haste',
    resultId: 'rapid_bow', resultName: 'Скорострельный лук', resultIcon: '🌪',
    desc: 'Очередь из 3 стрел, урон 15 каждая.',
  },
  {
    weaponId: 'daggers', abilityId: 'power',
    resultId: 'blade_storm', resultName: 'Шквал клинков', resultIcon: '💥',
    desc: '5 кинжалов веером, урон 12, шанс крита 20% (×2).',
  },
  {
    weaponId: 'fireball', abilityId: 'magnet',
    resultId: 'soul_flame', resultName: 'Пламя души', resultIcon: '👻',
    desc: 'Взрыв (урон 30) притягивает весь опыт на карте.',
  },

  // === 16 новых основных ===
  {
    weaponId: 'axe', abilityId: 'bloodlust',
    resultId: 'bloodletter', resultName: 'Кровопускатель', resultIcon: '🪓',
    desc: 'Конус 180°, вампиризм 5 HP/удар.',
  },
  {
    weaponId: 'spear', abilityId: 'crit_strike',
    resultId: 'piercer', resultName: 'Пронзатель', resultIcon: '⚜',
    desc: 'Линия 150px, 30% крит, пробивает врагов.',
  },
  {
    weaponId: 'hammer', abilityId: 'fortify',
    resultId: 'titan_hammer', resultName: 'Молот титана', resultIcon: '⚒',
    desc: 'AoE 90px, +10% макс HP за каждые 5 убийств (10 сек).',
  },
  {
    weaponId: 'whip', abilityId: 'power',
    resultId: 'pain_lash', resultName: 'Бич боли', resultIcon: '〰',
    desc: 'Дальность 150px, +25% урона по врагам с полным HP.',
  },
  {
    weaponId: 'crossbow', abilityId: 'bleed',
    resultId: 'executioner', resultName: 'Казнь', resultIcon: '☠',
    desc: 'Пробивающий, гарантированное кровотечение 8 dmg/s.',
  },
  {
    weaponId: 'throwing_axes', abilityId: 'crit_strike',
    resultId: 'butcher_axes', resultName: 'Топоры мясника', resultIcon: '⚒',
    desc: '3 топора, 25% крит, крит урон ×3.',
  },
  {
    weaponId: 'darts', abilityId: 'quick_fingers',
    resultId: 'needle_storm', resultName: 'Игольчатый шторм', resultIcon: '↗',
    desc: '5 дротиков в очереди, кулдаун 0.4 сек.',
  },
  {
    weaponId: 'sling', abilityId: 'explosive_death',
    resultId: 'meteor_strike', resultName: 'Метеоритный удар', resultIcon: '☄',
    desc: 'Камень падает с неба, AoE 60px, урон 22.',
  },
  {
    weaponId: 'ice_arrow', abilityId: 'frost_aura',
    resultId: 'ice_storm', resultName: 'Ледяной шторм', resultIcon: '❄',
    desc: 'Снаряд оставляет полосу холода 100px, замедление 60%.',
  },
  {
    weaponId: 'chain_lightning', abilityId: 'magic_boost',
    resultId: 'thunder_chain', resultName: 'Грозовая цепь', resultIcon: '⚡',
    desc: '5 прыжков, урон не спадает.',
  },
  {
    weaponId: 'poison_cloud', abilityId: 'alchemist',
    resultId: 'plague_cloud', resultName: 'Чумное облако', resultIcon: '☣',
    desc: 'Радиус 80px, 5 сек, 12 урон/сек, заражает соседних.',
  },
  {
    weaponId: 'spellbook', abilityId: 'magic_echo',
    resultId: 'mad_grimoire', resultName: 'Безумный гримуар', resultIcon: '📖',
    desc: '4 снаряда, +20% шанс при получении урона создать ещё 2.',
  },
  {
    weaponId: 'firestorm', abilityId: 'power',
    resultId: 'inferno', resultName: 'Инферно', resultIcon: '🌋',
    desc: '5 столбов, урон 25, поджигают землю.',
  },
  {
    weaponId: 'holy_aura', abilityId: 'regen',
    resultId: 'martyr_aura', resultName: 'Аура мученика', resultIcon: '✡',
    desc: 'Радиус 70px, урон нежити 18/сек, лечит 50% от урона.',
  },
  {
    weaponId: 'spike_ring', abilityId: 'armor',
    resultId: 'spike_bastion', resultName: 'Шипастый бастион', resultIcon: '✸',
    desc: '6 шипов, +5% DR, отражают 20% урона атакующему.',
  },
  {
    weaponId: 'earthquake', abilityId: 'fortify',
    resultId: 'tectonic_rift', resultName: 'Тектонический разлом', resultIcon: '◉',
    desc: 'Радиус 180px, трещины на земле (20 урон/сек, 3 сек).',
  },

  // === 5 альтернативных рецептов ===
  {
    weaponId: 'sword', abilityId: 'power',
    resultId: 'hero_blade', resultName: 'Клинок героя', resultIcon: '⚔',
    desc: 'Ближний бой, урон 30, +15% ко всему урону.',
  },
  {
    weaponId: 'fireball', abilityId: 'magic_boost',
    resultId: 'pyroclasm', resultName: 'Пироклазм', resultIcon: '🔥',
    desc: 'Взрыв 100px, урон 35, оставляет горящую землю 4 сек.',
  },
  {
    weaponId: 'ice_arrow', abilityId: 'magic_echo',
    resultId: 'ice_spike', resultName: 'Ледяной шип', resultIcon: '🧊',
    desc: 'При убийстве врага выпускает 3 ледяных осколка.',
  },
  {
    weaponId: 'chain_lightning', abilityId: 'quick_fingers',
    resultId: 'electric_cascade', resultName: 'Электр. каскад', resultIcon: '⚡',
    desc: 'Прыгает мгновенно, кулдаун 0.8 сек.',
  },
  {
    weaponId: 'poison_cloud', abilityId: 'frost_aura',
    resultId: 'miasma', resultName: 'Миазмы', resultIcon: '☁',
    desc: 'Облако замедляет 30% и снижает броню врагов на 20%.',
  },
];


/** Супер-эволюции: эксклюзив 5 ур. + эволюционировавшее оружие → ультимативное. */
const SUPER_EVOLUTIONS = [
  {
    exclusiveId: 'lich_blade',
    evolvedId: 'vampire_blade',
    resultId: 'eternal_night_blade',
    resultName: 'Клинок Вечной Ночи',
    resultIcon: '🌑',
    desc: 'Урон 45, вампиризм 8 HP/удар, призывает 2 скелетов-рыцарей.',
  },
  {
    exclusiveId: 'phoenix_bow',
    evolvedId: 'rapid_bow',
    resultId: 'apocalypse_bow',
    resultName: 'Лук Апокалипсиса',
    resultIcon: '🏹',
    desc: 'Очередь 5 огненных стрел, взрыв 60px, горящая земля.',
  },
  {
    exclusiveId: 'archmage_staff',
    evolvedId: 'mad_grimoire',
    resultId: 'eternity_staff',
    resultName: 'Посох Вечности',
    resultIcon: '🔮',
    desc: '5 снарядов, +25% маг. урона, 3 снаряда при получении урона.',
  },
  {
    exclusiveId: 'beast_claw',
    evolvedId: 'bloodletter',
    resultId: 'devourer_claws',
    resultName: 'Когти Пожирателя',
    resultIcon: '🐾',
    desc: 'Удары 0.3с, урон 18, 25% крит, вампиризм 10 HP, кровотечение 15 dps.',
  },
  {
    exclusiveId: 'rune_shield',
    evolvedId: 'martyr_aura',
    resultId: 'bastion_of_light',
    resultName: 'Бастион Света',
    resultIcon: '🛡',
    desc: 'Радиус 90px, урон нежити 30/сек, DR 20%, лечение 5 HP/сек.',
  },
];


const Evolutions = {
  /** Полный список рецептов. */
  list() { return EVOLUTIONS; },

  /** Найти рецепт по id итогового оружия. */
  byResultId(resultId) {
    for (const e of EVOLUTIONS) if (e.resultId === resultId) return e;
    return null;
  },

  /**
   * Проверка готовых эволюций у игрока.
   * Возвращает ВСЕ готовые пары (оружие maxlvl + пассивка maxlvl).
   * Оружие не должно быть уже эволюционировано.
   */
  findReady(player) {
    const out = [];
    if (!player) return out;
    for (let i = 0; i < player.weaponSlots.length; i++) {
      const w = player.weaponSlots[i];
      if (!w) continue;
      if (w.isEvolved) continue;
      if (w.isExclusive) continue;
      if (w.level < w.maxLevel) continue;
      // Ищем ВСЕ рецепты для этого оружия
      for (const rec of EVOLUTIONS) {
        if (rec.weaponId !== w.id) continue;
        const ab = Player.findAbility(player, rec.abilityId);
        if (!ab) continue;
        if (ab.level < ab.maxLevel) continue;
        out.push({ recipe: rec, weapon: w, ability: ab });
      }
    }
    return out;
  },

  /**
   * Проверка готовых супер-эволюций.
   * Эксклюзив 5 ур. + подходящее эволюционировавшее оружие.
   */
  findSuperReady(player) {
    const out = [];
    if (!player) return out;
    for (let i = 0; i < player.weaponSlots.length; i++) {
      const w = player.weaponSlots[i];
      if (!w) continue;
      if (!w.isExclusive) continue;
      if (w.level < w.maxLevel) continue;
      // Ищем супер-рецепт для этого эксклюзива
      for (const sr of SUPER_EVOLUTIONS) {
        if (sr.exclusiveId !== w.id) continue;
        // Ищем эволюционировавшее оружие
        const evolved = Player.findWeapon(player, sr.evolvedId);
        if (!evolved) continue;
        if (!evolved.isEvolved) continue;
        out.push({ recipe: sr, exclusive: w, evolved: evolved });
      }
    }
    return out;
  },

  /**
   * Применить обычную эволюцию.
   */
  apply(player, recipe) {
    if (!player || !recipe) return false;
    const w = Player.findWeapon(player, recipe.weaponId);
    const a = Player.findAbility(player, recipe.abilityId);
    if (!w || !a) return false;

    const factory = (window.EVOLVED_WEAPON_FACTORIES || {})[recipe.resultId];
    if (typeof factory !== 'function') return false;

    const newWeapon = factory();
    Player.replaceWeapon(player, w.slotIndex, newWeapon);
    Player.removeAbility(player, a.slotIndex);

    if (window.Particles && window.Particles.fusionBurst) {
      Particles.fusionBurst(player.x, player.y);
    }
    if (window.Particles && window.Particles.text) {
      Particles.text(player.x, player.y - 40, recipe.resultName, 1.4, '#ffd84a', 16);
    }
    return true;
  },

  /**
   * Применить супер-эволюцию.
   * Эксклюзивный слот освобождается, эволюционировавшее заменяется на супер-версию.
   */
  applySuper(player, recipe) {
    if (!player || !recipe) return false;
    const excl = Player.findWeapon(player, recipe.exclusiveId);
    const evolved = Player.findWeapon(player, recipe.evolvedId);
    if (!excl || !evolved) return false;

    const factory = (window.SUPER_EVOLVED_WEAPON_FACTORIES || {})[recipe.resultId];
    if (typeof factory !== 'function') return false;

    const newWeapon = factory();
    // Заменяем эволюционировавшее оружие на супер-версию
    Player.replaceWeapon(player, evolved.slotIndex, newWeapon);
    // Освобождаем слот эксклюзива
    player.weaponSlots[excl.slotIndex] = null;
    excl.slotIndex = -1;

    // Двойная золотая вспышка
    if (window.Particles && window.Particles.fusionBurst) {
      Particles.fusionBurst(player.x, player.y);
      setTimeout(() => {
        if (window.Particles && Particles.fusionBurst) Particles.fusionBurst(player.x, player.y);
      }, 200);
    }
    if (window.Particles && window.Particles.text) {
      Particles.text(player.x, player.y - 40, recipe.resultName, 2.0, '#ffd700', 18);
    }
    return true;
  },
};

window.EVOLUTIONS = EVOLUTIONS;
window.SUPER_EVOLUTIONS = SUPER_EVOLUTIONS;
window.Evolutions = Evolutions;

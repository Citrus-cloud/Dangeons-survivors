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
    resultId: 'vampire_blade', resultName: t('evo_vampire_blade'), resultIcon: '🩸',
    desc: t('evo_vampire_blade_desc'),
  },
  {
    weaponId: 'bow', abilityId: 'haste',
    resultId: 'rapid_bow', resultName: t('evo_rapid_bow'), resultIcon: '🌪',
    desc: t('evo_rapid_bow_desc'),
  },
  {
    weaponId: 'daggers', abilityId: 'power',
    resultId: 'blade_storm', resultName: t('evo_blade_storm'), resultIcon: '💥',
    desc: t('evo_blade_storm_desc'),
  },
  {
    weaponId: 'fireball', abilityId: 'magnet',
    resultId: 'soul_flame', resultName: t('evo_soul_flame'), resultIcon: '👻',
    desc: t('evo_soul_flame_desc'),
  },

  // === 16 новых основных ===
  {
    weaponId: 'axe', abilityId: 'bloodlust',
    resultId: 'bloodletter', resultName: t('evo_bloodletter'), resultIcon: '🪓',
    desc: t('evo_bloodletter_desc'),
  },
  {
    weaponId: 'spear', abilityId: 'crit_strike',
    resultId: 'piercer', resultName: t('evo_piercer'), resultIcon: '⚜',
    desc: t('evo_piercer_desc'),
  },
  {
    weaponId: 'hammer', abilityId: 'fortify',
    resultId: 'titan_hammer', resultName: t('evo_titan_hammer'), resultIcon: '⚒',
    desc: t('evo_titan_hammer_desc'),
  },
  {
    weaponId: 'whip', abilityId: 'power',
    resultId: 'pain_lash', resultName: t('evo_pain_lash'), resultIcon: '〰',
    desc: t('evo_pain_lash_desc'),
  },
  {
    weaponId: 'crossbow', abilityId: 'bleed',
    resultId: 'executioner', resultName: t('evo_executioner'), resultIcon: '☠',
    desc: t('evo_executioner_desc'),
  },
  {
    weaponId: 'throwing_axes', abilityId: 'crit_strike',
    resultId: 'butcher_axes', resultName: t('evo_butcher_axes'), resultIcon: '⚒',
    desc: t('evo_butcher_axes_desc'),
  },
  {
    weaponId: 'darts', abilityId: 'quick_fingers',
    resultId: 'needle_storm', resultName: t('evo_needle_storm'), resultIcon: '↗',
    desc: t('evo_needle_storm_desc'),
  },
  {
    weaponId: 'sling', abilityId: 'explosive_death',
    resultId: 'meteor_strike', resultName: t('evo_meteor_strike'), resultIcon: '☄',
    desc: t('evo_meteor_strike_desc'),
  },
  {
    weaponId: 'ice_arrow', abilityId: 'frost_aura',
    resultId: 'ice_storm', resultName: t('evo_ice_storm'), resultIcon: '❄',
    desc: t('evo_ice_storm_desc'),
  },
  {
    weaponId: 'chain_lightning', abilityId: 'magic_boost',
    resultId: 'thunder_chain', resultName: t('evo_thunder_chain'), resultIcon: '⚡',
    desc: t('evo_thunder_chain_desc'),
  },
  {
    weaponId: 'poison_cloud', abilityId: 'alchemist',
    resultId: 'plague_cloud', resultName: t('evo_plague_cloud'), resultIcon: '☣',
    desc: t('evo_plague_cloud_desc'),
  },
  {
    weaponId: 'spellbook', abilityId: 'magic_echo',
    resultId: 'mad_grimoire', resultName: t('evo_mad_grimoire'), resultIcon: '📖',
    desc: t('evo_mad_grimoire_desc'),
  },
  {
    weaponId: 'firestorm', abilityId: 'power',
    resultId: 'inferno', resultName: t('evo_inferno'), resultIcon: '🌋',
    desc: t('evo_inferno_desc'),
  },
  {
    weaponId: 'holy_aura', abilityId: 'regen',
    resultId: 'martyr_aura', resultName: t('evo_martyr_aura'), resultIcon: '✡',
    desc: t('evo_martyr_aura_desc'),
  },
  {
    weaponId: 'spike_ring', abilityId: 'armor',
    resultId: 'spike_bastion', resultName: t('evo_spike_bastion'), resultIcon: '✸',
    desc: t('evo_spike_bastion_desc'),
  },
  {
    weaponId: 'earthquake', abilityId: 'fortify',
    resultId: 'tectonic_rift', resultName: t('evo_tectonic_rift'), resultIcon: '◉',
    desc: t('evo_tectonic_rift_desc'),
  },

  // === 5 альтернативных рецептов ===
  {
    weaponId: 'sword', abilityId: 'power',
    resultId: 'hero_blade', resultName: t('evo_hero_blade'), resultIcon: '⚔',
    desc: t('evo_hero_blade_desc'),
  },
  {
    weaponId: 'fireball', abilityId: 'magic_boost',
    resultId: 'pyroclasm', resultName: t('evo_pyroclasm'), resultIcon: '🔥',
    desc: t('evo_pyroclasm_desc'),
  },
  {
    weaponId: 'ice_arrow', abilityId: 'magic_echo',
    resultId: 'ice_spike', resultName: t('evo_ice_spike'), resultIcon: '🧊',
    desc: t('evo_ice_spike_desc'),
  },
  {
    weaponId: 'chain_lightning', abilityId: 'quick_fingers',
    resultId: 'electric_cascade', resultName: t('evo_electric_cascade'), resultIcon: '⚡',
    desc: t('evo_electric_cascade_desc'),
  },
  {
    weaponId: 'poison_cloud', abilityId: 'frost_aura',
    resultId: 'miasma', resultName: t('evo_miasma'), resultIcon: '☁',
    desc: t('evo_miasma_desc'),
  },
];


/** Супер-эволюции: эксклюзив 5 ур. + эволюционировавшее оружие → ультимативное. */
const SUPER_EVOLUTIONS = [
  {
    exclusiveId: 'lich_blade',
    evolvedId: 'vampire_blade',
    resultId: 'eternal_night_blade',
    resultName: t('evo_eternal_night_blade'),
    resultIcon: '🌑',
    desc: t('evo_eternal_night_blade_desc'),
  },
  {
    exclusiveId: 'phoenix_bow',
    evolvedId: 'rapid_bow',
    resultId: 'apocalypse_bow',
    resultName: t('evo_apocalypse_bow'),
    resultIcon: '🏹',
    desc: t('evo_apocalypse_bow_desc'),
  },
  {
    exclusiveId: 'archmage_staff',
    evolvedId: 'mad_grimoire',
    resultId: 'eternity_staff',
    resultName: t('evo_eternity_staff'),
    resultIcon: '🔮',
    desc: t('evo_eternity_staff_desc'),
  },
  {
    exclusiveId: 'beast_claw',
    evolvedId: 'bloodletter',
    resultId: 'devourer_claws',
    resultName: t('evo_devourer_claws'),
    resultIcon: '🐾',
    desc: t('evo_devourer_claws_desc'),
  },
  {
    exclusiveId: 'rune_shield',
    evolvedId: 'martyr_aura',
    resultId: 'bastion_of_light',
    resultName: t('evo_bastion_of_light'),
    resultIcon: '🛡',
    desc: t('evo_bastion_of_light_desc'),
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

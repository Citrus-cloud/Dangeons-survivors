'use strict';
/* ============================================================
   upgrade-descriptions.js — Universal upgrade description generator.

   Automatically generates human-readable descriptions for all
   upgrade cards (weapons, abilities, basic upgrades) based on
   actual game data and mechanics.

   The system:
   1. For WEAPON upgrades: calculates exact damage/cooldown at
      current vs. next level.
   2. For ABILITY upgrades: uses the ability's effectText() at
      the next level to show concrete values.
   3. For NEW items: shows both the general description and
      what the item does at level 1.
   4. For BASIC upgrades: descriptions are already defined
      statically in BASIC_UPGRADES (they are accurate).

   Export: window.UpgradeDescriptions
   ============================================================ */

const UpgradeDescriptions = {

  /**
   * Generate description for a weapon upgrade card.
   * @param {Weapon} weapon - The weapon instance being upgraded
   * @param {number} nextLevel - The level it will become after upgrade
   * @returns {string} Localized description string
   */
  weaponUpgrade(weapon, nextLevel) {
    if (!weapon) return '';

    const curLevel = nextLevel - 1;
    const curDmg = weapon.baseDamage * WEAPON_LEVEL_DAMAGE[curLevel - 1];
    const nextDmg = weapon.baseDamage * WEAPON_LEVEL_DAMAGE[nextLevel - 1];
    const dmgIncrease = Math.round((nextDmg - curDmg) * 10) / 10;
    const dmgPct = Math.round(((nextDmg / curDmg) - 1) * 100);

    // Weapons with no traditional cooldown (holy_aura, spike_ring)
    const noCooldown = (weapon.baseCooldown === 0);

    if (noCooldown) {
      // These weapons just get damage scaling
      return t('upgrade_weapon_dmg_only', dmgPct, Math.round(nextDmg));
    }

    const curCd = weapon.baseCooldown * WEAPON_LEVEL_CD_MUL[curLevel - 1];
    const nextCd = weapon.baseCooldown * WEAPON_LEVEL_CD_MUL[nextLevel - 1];
    const cdReduction = Math.round((1 - nextCd / curCd) * 100);
    const nextCdRounded = Math.round(nextCd * 100) / 100;

    return t('upgrade_weapon_full', dmgPct, Math.round(nextDmg), cdReduction, nextCdRounded);
  },

  /**
   * Generate description for a new weapon acquisition.
   * @param {string} weaponId - The weapon type id
   * @returns {string} Localized description showing base stats
   */
  weaponNew(weaponId) {
    const factory = window.WEAPON_FACTORIES && WEAPON_FACTORIES[weaponId];
    if (!factory) return '';

    // Create a temporary instance to read stats
    const tmp = factory();
    const desc = tmp.desc || '';
    const stats = t('upgrade_weapon_new_stats', Math.round(tmp.baseDamage),
      tmp.baseCooldown > 0 ? tmp.baseCooldown.toFixed(1) : '—');

    return desc + '\n' + stats;
  },

  /**
   * Generate description for an ability upgrade card.
   * @param {Ability} ability - The ability instance being upgraded
   * @param {number} nextLevel - The level it will become after upgrade
   * @returns {string} Localized description string
   */
  abilityUpgrade(ability, nextLevel) {
    if (!ability || !ability.effectText) return '';

    // Temporarily set level to compute effect text at next level
    const origLevel = ability.level;
    ability.level = nextLevel;
    const nextEffect = ability.effectText();
    ability.level = origLevel;
    const curEffect = ability.effectText();

    if (nextEffect) {
      return t('upgrade_ability_effect', curEffect, nextEffect);
    }
    return '';
  },

  /**
   * Generate description for a new ability acquisition.
   * @param {string} abilityId - The ability type id
   * @returns {string} Localized description showing level 1 effect
   */
  abilityNew(abilityId) {
    const factory = window.ABILITY_FACTORIES && ABILITY_FACTORIES[abilityId];
    if (!factory) return '';

    const tmp = factory();
    const desc = tmp.desc || '';
    const effect = tmp.effectText ? tmp.effectText() : '';

    if (effect) {
      return desc + '\n' + t('upgrade_ability_lv1', effect);
    }
    return desc;
  },
};

window.UpgradeDescriptions = UpgradeDescriptions;

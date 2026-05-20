'use strict';
/* ============================================================
   abilities.js — пассивные способности (Шаг 8: 20 пассивок).

   Способности применяются к мультипликаторам/счётчикам игрока.
   При повышении уровня вызывается apply(), который снимает
   старый вклад и применяет новый — без накопления багов.

   Типы эффектов (effectType):
     statModifier  — изменяет статы при apply/remove
     periodic      — имеет кулдаун, срабатывает по таймеру
     onHit         — срабатывает при нанесении урона
     onKill        — срабатывает при убийстве
     onDamageTaken — срабатывает при получении урона
     aura          — постоянный эффект в радиусе (каждый кадр)
   ============================================================ */

const MAX_ABILITY_LEVEL = 5;

class Ability {
  constructor(cfg) {
    this.id    = cfg.id;
    this.name  = cfg.name;
    this.icon  = cfg.icon;
    this.desc  = cfg.desc;
    this.level = 1;
    this.slotIndex = -1;
    this._applied = null;
  }

  get maxLevel() { return MAX_ABILITY_LEVEL; }

  effectText() { return ''; }

  apply(player) {
    this._removeApplied(player);
    this._applyForLevel(player, this.level);
  }
  remove(player) { this._removeApplied(player); }

  upgrade(player) {
    if (this.level < MAX_ABILITY_LEVEL) {
      this.level += 1;
      this.apply(player);
      // Шаг 8: триггер вспышки иконки (200 мс)
      this._flashUntil = performance.now() + 200;
    }
  }

  _applyForLevel(/* player, level */) {}
  _removeApplied(/* player */) {}
}


/* ============================================================
   ОРИГИНАЛЬНЫЕ 4 ПАССИВКИ (1-4) — не трогать, участвуют в эволюциях
   ============================================================ */

/* ---------- 1) Ускорение ---------- */
class HasteAbility extends Ability {
  constructor() {
    super({ id: 'haste', name: t('ability_haste'), icon: '➤',
      desc: t('ability_haste_desc') });
  }
  effectText() { return `Speed +${this.level * 8}%`; }
  _applyForLevel(player, level) {
    const factor = 1 + 0.08 * level;
    this._applied = { factor };
    player.speedMul *= factor;
  }
  _removeApplied(player) {
    if (this._applied) { player.speedMul /= this._applied.factor; this._applied = null; }
  }
}

/* ---------- 2) Регенерация ---------- */
class RegenAbility extends Ability {
  constructor() {
    super({ id: 'regen', name: t('ability_regen'), icon: '✚',
      desc: t('ability_regen_desc') });
  }
  effectText() { return `+${this.level} HP / 3s`; }
  _applyForLevel(player, level) {
    const add = level / 3;
    this._applied = { add };
    player.hpRegen += add;
  }
  _removeApplied(player) {
    if (this._applied) { player.hpRegen -= this._applied.add; this._applied = null; }
  }
}

/* ---------- 3) Усиление урона ---------- */
class PowerAbility extends Ability {
  constructor() {
    super({ id: 'power', name: t('ability_power'), icon: '⚡',
      desc: t('ability_power_desc') });
  }
  effectText() { return `Damage +${this.level * 10}%`; }
  _applyForLevel(player, level) {
    const factor = 1 + 0.10 * level;
    this._applied = { factor };
    player.damageMul *= factor;
  }
  _removeApplied(player) {
    if (this._applied) { player.damageMul /= this._applied.factor; this._applied = null; }
  }
}

/* ---------- 4) Магнит опыта ---------- */
class MagnetAbility extends Ability {
  constructor() {
    super({ id: 'magnet', name: t('ability_magnet'), icon: '◎',
      desc: t('ability_magnet_desc') });
  }
  effectText() { return `Pickup +${this.level * 30}%`; }
  _applyForLevel(player, level) {
    const factor = 1 + 0.30 * level;
    this._applied = { factor };
    player.pickupMul *= factor;
  }
  _removeApplied(player) {
    if (this._applied) { player.pickupMul /= this._applied.factor; this._applied = null; }
  }
}



/* ============================================================
   НОВЫЕ ПАССИВКИ (5-20) — Шаг 8
   ============================================================ */

/* === КАТЕГОРИЯ: ЗАЩИТА (5-8) === */

/* ---------- 5) Броня ---------- */
class ArmorAbility extends Ability {
  constructor() {
    super({ id: 'armor', name: t('ability_armor'), icon: '🛡',
      desc: t('ability_armor_desc') });
  }
  effectText() { return `Defense ${this.level * 5}%`; }
  _applyForLevel(player, level) {
    const reduction = 0.05 * level;
    this._applied = { reduction };
    player.damageReduction = (player.damageReduction || 0) + reduction;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.damageReduction = (player.damageReduction || 0) - this._applied.reduction;
      this._applied = null;
    }
  }
}

/* ---------- 6) Щит маны ---------- */
class ManaShieldAbility extends Ability {
  constructor() {
    super({ id: 'mana_shield', name: t('ability_mana_shield'), icon: '🔵',
      desc: t('ability_mana_shield_desc') });
    this.cooldownTimer = 0;
    this.shieldReady = false;
  }
  effectText() {
    const cd = 12 - this.level;
    return `Block 1 hit / ${cd}s`;
  }
  _applyForLevel(player, level) {
    const cd = 12 - level;
    this._applied = { cd };
    player.manaShield = this;
    this.shieldReady = true;
    this.cooldownTimer = 0;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.manaShield = null;
      this._applied = null;
    }
  }
  /** Вызывается из player update каждый кадр. */
  tick(dt) {
    if (!this.shieldReady) {
      this.cooldownTimer -= dt;
      if (this.cooldownTimer <= 0) {
        this.shieldReady = true;
      }
    }
  }
  /** Попытка блокировать удар. Возвращает true если заблокировал. */
  tryBlock() {
    if (this.shieldReady) {
      this.shieldReady = false;
      const cd = 12 - this.level;
      this.cooldownTimer = cd;
      return true;
    }
    return false;
  }
}

/* ---------- 7) Укрепление ---------- */
class FortifyAbility extends Ability {
  constructor() {
    super({ id: 'fortify', name: t('ability_fortify'), icon: '❤',
      desc: t('ability_fortify_desc') });
  }
  effectText() { return `Max HP +${this.level * 8}%`; }
  _applyForLevel(player, level) {
    const factor = 1 + 0.08 * level;
    this._applied = { factor };
    player.maxHpMul = (player.maxHpMul || 1) * factor;
    this._recalcMaxHp(player);
  }
  _removeApplied(player) {
    if (this._applied) {
      player.maxHpMul = (player.maxHpMul || 1) / this._applied.factor;
      this._recalcMaxHp(player);
      this._applied = null;
    }
  }
  _recalcMaxHp(player) {
    // Bug fix #1: учитывать бонус HP от талантов при пересчёте процентных бонусов
    const base = CONFIG.PLAYER.MAX_HP + (player.bonusMaxHp || 0) + (player.talentBonusHp || 0);
    const newMax = Math.round(base * (player.maxHpMul || 1));
    const ratio = player.hp / player.maxHp;
    player.maxHp = newMax;
    player.hp = Math.min(player.maxHp, Math.round(ratio * newMax));
  }
}

/* ---------- 8) Сопротивление ---------- */
class ResistanceAbility extends Ability {
  constructor() {
    super({ id: 'resistance', name: t('ability_resistance'), icon: '✜',
      desc: t('ability_resistance_desc') });
  }
  effectText() { return `Debuff -${this.level * 15}%`; }
  _applyForLevel(player, level) {
    const reduction = 0.15 * level;
    this._applied = { reduction };
    player.debuffReduction = (player.debuffReduction || 0) + reduction;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.debuffReduction = (player.debuffReduction || 0) - this._applied.reduction;
      this._applied = null;
    }
  }
}



/* === КАТЕГОРИЯ: АТАКА (9-12) === */

/* ---------- 9) Жажда крови ---------- */
class BloodlustAbility extends Ability {
  constructor() {
    super({ id: 'bloodlust', name: t('ability_bloodlust'), icon: '🦷',
      desc: t('ability_bloodlust_desc') });
  }
  effectText() { return `Lifesteal ${this.level * 2}%`; }
  _applyForLevel(player, level) {
    const pct = 0.02 * level;
    this._applied = { pct };
    player.lifesteal = (player.lifesteal || 0) + pct;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.lifesteal = (player.lifesteal || 0) - this._applied.pct;
      this._applied = null;
    }
  }
}

/* ---------- 10) Критический удар ---------- */
class CritStrikeAbility extends Ability {
  constructor() {
    super({ id: 'crit_strike', name: t('ability_crit_strike'), icon: '⚡',
      desc: t('ability_crit_strike_desc') });
  }
  effectText() { return `Crit ${this.level * 4}%`; }
  _applyForLevel(player, level) {
    const chance = 0.04 * level;
    this._applied = { chance };
    player.critChance = (player.critChance || 0) + chance;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.critChance = (player.critChance || 0) - this._applied.chance;
      this._applied = null;
    }
  }
}

/* ---------- 11) Кровотечение ---------- */
class BleedAbility extends Ability {
  constructor() {
    super({ id: 'bleed', name: t('ability_bleed'), icon: '💧',
      desc: t('ability_bleed_desc') });
  }
  effectText() { return `Chance ${this.level * 10}%`; }
  _applyForLevel(player, level) {
    const chance = 0.10 * level;
    this._applied = { chance };
    player.bleedChance = (player.bleedChance || 0) + chance;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.bleedChance = (player.bleedChance || 0) - this._applied.chance;
      this._applied = null;
    }
  }
}

/* ---------- 12) Взрывная смерть ---------- */
class ExplosiveDeathAbility extends Ability {
  constructor() {
    super({ id: 'explosive_death', name: t('ability_explosive_death'), icon: '💥',
      desc: t('ability_explosive_death_desc') });
  }
  effectText() { return `Chance ${this.level * 10}%`; }
  _applyForLevel(player, level) {
    const chance = 0.10 * level;
    this._applied = { chance };
    player.explosiveDeathChance = (player.explosiveDeathChance || 0) + chance;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.explosiveDeathChance = (player.explosiveDeathChance || 0) - this._applied.chance;
      this._applied = null;
    }
  }
}



/* === КАТЕГОРИЯ: МАГИЯ (13-16) === */

/* ---------- 13) Быстрые пальцы ---------- */
class QuickFingersAbility extends Ability {
  constructor() {
    super({ id: 'quick_fingers', name: t('ability_quick_fingers'), icon: '🔄',
      desc: t('ability_quick_fingers_desc') });
  }
  effectText() { return `CD -${this.level * 4}%`; }
  _applyForLevel(player, level) {
    const factor = 1 - 0.04 * level; // 0.96, 0.92, 0.88, 0.84, 0.80
    this._applied = { factor };
    player.weaponCdMul *= factor;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.weaponCdMul /= this._applied.factor;
      this._applied = null;
    }
  }
}

/* ---------- 14) Аура холода ---------- */
class FrostAuraAbility extends Ability {
  constructor() {
    super({ id: 'frost_aura', name: t('ability_frost_aura'), icon: '❄',
      desc: t('ability_frost_aura_desc') });
  }
  effectText() { return `Slow ${this.level * 8}%`; }
  _applyForLevel(player, level) {
    const slow = 0.08 * level;
    const radius = 60;
    this._applied = { slow, radius };
    player.frostAura = { slow, radius };
  }
  _removeApplied(player) {
    if (this._applied) {
      player.frostAura = null;
      this._applied = null;
    }
  }
}

/* ---------- 15) Усиление магии ---------- */
class MagicBoostAbility extends Ability {
  constructor() {
    super({ id: 'magic_boost', name: t('ability_magic_boost'), icon: '✦',
      desc: t('ability_magic_boost_desc') });
  }
  effectText() { return `Magic dmg +${this.level * 10}%`; }
  _applyForLevel(player, level) {
    const factor = 1 + 0.10 * level;
    this._applied = { factor };
    player.magicDamageMul = (player.magicDamageMul || 1) * factor;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.magicDamageMul = (player.magicDamageMul || 1) / this._applied.factor;
      this._applied = null;
    }
  }
}

/* ---------- 16) Магический отклик ---------- */
class MagicEchoAbility extends Ability {
  constructor() {
    super({ id: 'magic_echo', name: t('ability_magic_echo'), icon: '🔮',
      desc: t('ability_magic_echo_desc') });
  }
  effectText() { return `Chance ${this.level * 15}%`; }
  _applyForLevel(player, level) {
    const chance = 0.15 * level;
    this._applied = { chance };
    player.magicEchoChance = (player.magicEchoChance || 0) + chance;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.magicEchoChance = (player.magicEchoChance || 0) - this._applied.chance;
      this._applied = null;
    }
  }
}



/* === КАТЕГОРИЯ: УДАЧА И ЛУТ (17-20) === */

/* ---------- 17) Счастливчик ---------- */
class LuckyAbility extends Ability {
  constructor() {
    super({ id: 'lucky', name: t('ability_lucky'), icon: '🎲',
      desc: t('ability_lucky_desc') });
  }
  effectText() { return `Min d20 = ${this.level + 1}`; }
  _applyForLevel(player, level) {
    this._applied = { bonus: level };
    player.d20MinBonus = (player.d20MinBonus || 0) + level;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.d20MinBonus = (player.d20MinBonus || 0) - this._applied.bonus;
      this._applied = null;
    }
  }
}

/* ---------- 18) Удвоение опыта ---------- */
class DoubleXPAbility extends Ability {
  constructor() {
    super({ id: 'double_xp', name: t('ability_double_xp'), icon: '✕2',
      desc: t('ability_double_xp_desc') });
  }
  effectText() { return `×2 XP chance: ${this.level * 6}%`; }
  _applyForLevel(player, level) {
    const chance = 0.06 * level;
    this._applied = { chance };
    player.doubleXpChance = (player.doubleXpChance || 0) + chance;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.doubleXpChance = (player.doubleXpChance || 0) - this._applied.chance;
      this._applied = null;
    }
  }
}

/* ---------- 19) Алхимик ---------- */
class AlchemistAbility extends Ability {
  constructor() {
    super({ id: 'alchemist', name: t('ability_alchemist'), icon: '⚗',
      desc: t('ability_alchemist_desc') });
  }
  effectText() { return `DoT +${this.level * 12}%`; }
  _applyForLevel(player, level) {
    const factor = 1 + 0.12 * level;
    this._applied = { factor };
    player.dotDamageMul = (player.dotDamageMul || 1) * factor;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.dotDamageMul = (player.dotDamageMul || 1) / this._applied.factor;
      this._applied = null;
    }
  }
}

/* ---------- 20) Магнит предметов ---------- */
class MagnetPlusAbility extends Ability {
  constructor() {
    super({ id: 'magnet_plus', name: t('ability_magnet_plus'), icon: '⊕',
      desc: t('ability_magnet_plus_desc') });
  }
  effectText() { return `Pickup +${this.level * 20}%`; }
  _applyForLevel(player, level) {
    const factor = 1 + 0.20 * level;
    this._applied = { factor };
    player.pickupMul *= factor;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.pickupMul /= this._applied.factor;
      this._applied = null;
    }
  }
}


/* ============================================================
   ФАБРИКИ И ИНФОРМАЦИЯ — все 20 пассивок
   ============================================================ */
const ABILITY_FACTORIES = {
  haste:           () => new HasteAbility(),
  regen:           () => new RegenAbility(),
  power:           () => new PowerAbility(),
  magnet:          () => new MagnetAbility(),
  armor:           () => new ArmorAbility(),
  mana_shield:     () => new ManaShieldAbility(),
  fortify:         () => new FortifyAbility(),
  resistance:      () => new ResistanceAbility(),
  bloodlust:       () => new BloodlustAbility(),
  crit_strike:     () => new CritStrikeAbility(),
  bleed:           () => new BleedAbility(),
  explosive_death: () => new ExplosiveDeathAbility(),
  quick_fingers:   () => new QuickFingersAbility(),
  frost_aura:      () => new FrostAuraAbility(),
  magic_boost:     () => new MagicBoostAbility(),
  magic_echo:      () => new MagicEchoAbility(),
  lucky:           () => new LuckyAbility(),
  double_xp:       () => new DoubleXPAbility(),
  alchemist:       () => new AlchemistAbility(),
  magnet_plus:     () => new MagnetPlusAbility(),
};

const ABILITY_INFO = [
  { id: 'haste',           name: t('ability_haste'),         icon: '➤',  desc: t('ability_haste_desc') },
  { id: 'regen',           name: t('ability_regen'),       icon: '✚',  desc: t('ability_regen_desc') },
  { id: 'power',           name: t('ability_power'),    icon: '⚡', desc: t('ability_power_desc') },
  { id: 'magnet',          name: t('ability_magnet'),      icon: '◎',  desc: t('ability_magnet_desc') },
  { id: 'armor',           name: t('ability_armor'),             icon: '🛡', desc: t('ability_armor_desc') },
  { id: 'mana_shield',     name: t('ability_mana_shield'),          icon: '🔵', desc: t('ability_mana_shield_desc') },
  { id: 'fortify',         name: t('ability_fortify'),        icon: '❤',  desc: t('ability_fortify_desc') },
  { id: 'resistance',      name: t('ability_resistance'),     icon: '✜',  desc: t('ability_resistance_desc') },
  { id: 'bloodlust',       name: t('ability_bloodlust'),       icon: '🦷', desc: t('ability_bloodlust_desc') },
  { id: 'crit_strike',     name: t('ability_crit_strike'),  icon: '⚡', desc: t('ability_crit_strike_desc') },
  { id: 'bleed',           name: t('ability_bleed'),      icon: '💧', desc: t('ability_bleed_desc') },
  { id: 'explosive_death', name: t('ability_explosive_death'),   icon: '💥', desc: t('ability_explosive_death_desc') },
  { id: 'quick_fingers',   name: t('ability_quick_fingers'),   icon: '🔄', desc: t('ability_quick_fingers_desc') },
  { id: 'frost_aura',      name: t('ability_frost_aura'),       icon: '❄',  desc: t('ability_frost_aura_desc') },
  { id: 'magic_boost',     name: t('ability_magic_boost'),    icon: '✦',  desc: t('ability_magic_boost_desc') },
  { id: 'magic_echo',      name: t('ability_magic_echo'), icon: '🔮', desc: t('ability_magic_echo_desc') },
  { id: 'lucky',           name: t('ability_lucky'),       icon: '🎲', desc: t('ability_lucky_desc') },
  { id: 'double_xp',       name: t('ability_double_xp'),    icon: '✕2', desc: t('ability_double_xp_desc') },
  { id: 'alchemist',       name: t('ability_alchemist'),           icon: '⚗',  desc: t('ability_alchemist_desc') },
  { id: 'magnet_plus',     name: t('ability_magnet_plus'),  icon: '⊕',  desc: t('ability_magnet_plus_desc') },
];


/* ============================================================
   ЭКСПОРТ
   ============================================================ */
window.Ability = Ability;
window.HasteAbility = HasteAbility;
window.RegenAbility = RegenAbility;
window.PowerAbility = PowerAbility;
window.MagnetAbility = MagnetAbility;
window.ArmorAbility = ArmorAbility;
window.ManaShieldAbility = ManaShieldAbility;
window.FortifyAbility = FortifyAbility;
window.ResistanceAbility = ResistanceAbility;
window.BloodlustAbility = BloodlustAbility;
window.CritStrikeAbility = CritStrikeAbility;
window.BleedAbility = BleedAbility;
window.ExplosiveDeathAbility = ExplosiveDeathAbility;
window.QuickFingersAbility = QuickFingersAbility;
window.FrostAuraAbility = FrostAuraAbility;
window.MagicBoostAbility = MagicBoostAbility;
window.MagicEchoAbility = MagicEchoAbility;
window.LuckyAbility = LuckyAbility;
window.DoubleXPAbility = DoubleXPAbility;
window.AlchemistAbility = AlchemistAbility;
window.MagnetPlusAbility = MagnetPlusAbility;
window.ABILITY_FACTORIES = ABILITY_FACTORIES;
window.ABILITY_INFO = ABILITY_INFO;
window.MAX_ABILITY_LEVEL = MAX_ABILITY_LEVEL;

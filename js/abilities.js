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
    super({ id: 'haste', name: 'Ускорение', icon: '➤',
      desc: '+8% к скорости передвижения за уровень.' });
  }
  effectText() { return `Скорость +${this.level * 8}%`; }
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
    super({ id: 'regen', name: 'Регенерация', icon: '✚',
      desc: '+1 HP каждые 3 сек за уровень.' });
  }
  effectText() { return `+${this.level} HP / 3 сек`; }
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
    super({ id: 'power', name: 'Усиление урона', icon: '⚡',
      desc: '+10% ко всему урону за уровень.' });
  }
  effectText() { return `Урон +${this.level * 10}%`; }
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
    super({ id: 'magnet', name: 'Магнит опыта', icon: '◎',
      desc: '+30% к радиусу подбора кристаллов за уровень.' });
  }
  effectText() { return `Подбор +${this.level * 30}%`; }
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
    super({ id: 'armor', name: 'Броня', icon: '🛡',
      desc: 'Снижение получаемого урона на 5% за уровень.' });
  }
  effectText() { return `Защита ${this.level * 5}%`; }
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
    super({ id: 'mana_shield', name: 'Щит маны', icon: '🔵',
      desc: 'Блокирует следующий удар (кулдаун уменьшается с уровнем).' });
    this.cooldownTimer = 0;
    this.shieldReady = false;
  }
  effectText() {
    const cd = 12 - this.level;
    return `Блок 1 удара / ${cd}с`;
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
    super({ id: 'fortify', name: 'Укрепление', icon: '❤',
      desc: '+8% к максимальному HP за уровень.' });
  }
  effectText() { return `Макс HP +${this.level * 8}%`; }
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
    super({ id: 'resistance', name: 'Сопротивление', icon: '✜',
      desc: '-15% длительности дебаффов за уровень.' });
  }
  effectText() { return `Дебафф -${this.level * 15}%`; }
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
    super({ id: 'bloodlust', name: 'Жажда крови', icon: '🦷',
      desc: '+2% вампиризма (лечение от урона) за уровень.' });
  }
  effectText() { return `Вампиризм ${this.level * 2}%`; }
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
    super({ id: 'crit_strike', name: 'Критический удар', icon: '⚡',
      desc: '+4% шанс крита (×2 урон) за уровень.' });
  }
  effectText() { return `Крит ${this.level * 4}%`; }
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
    super({ id: 'bleed', name: 'Кровотечение', icon: '💧',
      desc: '10% шанс за уровень наложить кровотечение (4 ед/сек, 3 сек).' });
  }
  effectText() { return `Шанс ${this.level * 10}%`; }
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
    super({ id: 'explosive_death', name: 'Взрывная смерть', icon: '💥',
      desc: '10% шанс за уровень: при убийстве — взрыв (урон 18, радиус 50px).' });
  }
  effectText() { return `Шанс ${this.level * 10}%`; }
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
    super({ id: 'quick_fingers', name: 'Быстрые пальцы', icon: '🔄',
      desc: '-4% кулдауна всех оружий за уровень.' });
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
    super({ id: 'frost_aura', name: 'Аура холода', icon: '❄',
      desc: 'Замедляет врагов в радиусе 60px на 8% за уровень.' });
  }
  effectText() { return `Замедление ${this.level * 8}%`; }
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
    super({ id: 'magic_boost', name: 'Усиление магии', icon: '✦',
      desc: '+10% к магическому урону за уровень.' });
  }
  effectText() { return `Маг. урон +${this.level * 10}%`; }
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
    super({ id: 'magic_echo', name: 'Магический отклик', icon: '🔮',
      desc: '15% шанс за уровень: при получении урона — ответный снаряд (урон 15).' });
  }
  effectText() { return `Шанс ${this.level * 15}%`; }
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
    super({ id: 'lucky', name: 'Счастливчик', icon: '🎲',
      desc: '+1 к мин. результату d20 за уровень.' });
  }
  effectText() { return `Мин. d20 = ${this.level + 1}`; }
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
    super({ id: 'double_xp', name: 'Удвоение опыта', icon: '✕2',
      desc: '6% шанс за уровень получить удвоенный опыт.' });
  }
  effectText() { return `Шанс ×2 XP: ${this.level * 6}%`; }
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
    super({ id: 'alchemist', name: 'Алхимик', icon: '⚗',
      desc: '+12% к урону ядов и огня (DoT) за уровень.' });
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
    super({ id: 'magnet_plus', name: 'Магнит предметов', icon: '⊕',
      desc: '+20% к радиусу подбора за уровень (стакается с Магнитом опыта).' });
  }
  effectText() { return `Подбор +${this.level * 20}%`; }
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
  { id: 'haste',           name: 'Ускорение',         icon: '➤',  desc: '+8% к скорости передвижения за уровень.' },
  { id: 'regen',           name: 'Регенерация',       icon: '✚',  desc: '+1 HP каждые 3 сек за уровень.' },
  { id: 'power',           name: 'Усиление урона',    icon: '⚡', desc: '+10% ко всему урону за уровень.' },
  { id: 'magnet',          name: 'Магнит опыта',      icon: '◎',  desc: '+30% к радиусу подбора кристаллов за уровень.' },
  { id: 'armor',           name: 'Броня',             icon: '🛡', desc: 'Снижение получаемого урона на 5% за уровень.' },
  { id: 'mana_shield',     name: 'Щит маны',          icon: '🔵', desc: 'Блокирует следующий удар (кулдаун уменьшается с уровнем).' },
  { id: 'fortify',         name: 'Укрепление',        icon: '❤',  desc: '+8% к максимальному HP за уровень.' },
  { id: 'resistance',      name: 'Сопротивление',     icon: '✜',  desc: '-15% длительности дебаффов за уровень.' },
  { id: 'bloodlust',       name: 'Жажда крови',       icon: '🦷', desc: '+2% вампиризма (лечение от урона) за уровень.' },
  { id: 'crit_strike',     name: 'Критический удар',  icon: '⚡', desc: '+4% шанс крита (×2 урон) за уровень.' },
  { id: 'bleed',           name: 'Кровотечение',      icon: '💧', desc: '10% шанс за уровень наложить кровотечение.' },
  { id: 'explosive_death', name: 'Взрывная смерть',   icon: '💥', desc: '10% шанс за уровень: взрыв при убийстве.' },
  { id: 'quick_fingers',   name: 'Быстрые пальцы',   icon: '🔄', desc: '-4% кулдауна всех оружий за уровень.' },
  { id: 'frost_aura',      name: 'Аура холода',       icon: '❄',  desc: 'Замедляет ближайших врагов на 8% за уровень.' },
  { id: 'magic_boost',     name: 'Усиление магии',    icon: '✦',  desc: '+10% к магическому урону за уровень.' },
  { id: 'magic_echo',      name: 'Магический отклик', icon: '🔮', desc: '15% шанс: ответный снаряд при получении урона.' },
  { id: 'lucky',           name: 'Счастливчик',       icon: '🎲', desc: '+1 к мин. результату d20 за уровень.' },
  { id: 'double_xp',       name: 'Удвоение опыта',    icon: '✕2', desc: '6% шанс за уровень получить ×2 опыт.' },
  { id: 'alchemist',       name: 'Алхимик',           icon: '⚗',  desc: '+12% к урону ядов и огня (DoT) за уровень.' },
  { id: 'magnet_plus',     name: 'Магнит предметов',  icon: '⊕',  desc: '+20% к радиусу подбора за уровень.' },
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

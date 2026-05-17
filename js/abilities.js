'use strict';
/* ============================================================
   abilities.js — пассивные способности.

   Способности применяются к мультипликаторам/счётчикам игрока.
   При повышении уровня вызывается recompute(), который
   переменяет эффект "за уровень" — без накопления багов.

   Реализация: каждая способность хранит "вклад", который
   удаляет при пересчёте. Это позволяет корректно прокачивать
   и в теории удалять способности.
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
    this._applied = null; // запись последнего применённого вклада
  }

  get maxLevel() { return MAX_ABILITY_LEVEL; }

  /** Текстовое описание текущего эффекта (для UI). */
  effectText() { return ''; }

  /** Применить текущий уровень к игроку. */
  apply(player) {
    this._removeApplied(player);
    this._applyForLevel(player, this.level);
  }
  /** Снять все эффекты этой способности с игрока. */
  remove(player) { this._removeApplied(player); }

  upgrade(player) {
    if (this.level < MAX_ABILITY_LEVEL) {
      this.level += 1;
      this.apply(player);
    }
  }

  _applyForLevel(/* player, level */) {}
  _removeApplied(/* player */) {}
}


/* ---------- 1) Ускорение: +8% к скорости за уровень ---------- */
class HasteAbility extends Ability {
  constructor() {
    super({ id: 'haste', name: 'Ускорение', icon: '➤',
      desc: '+8% к скорости передвижения за уровень.' });
  }
  effectText() { return `Скорость +${(this.level * 8)}%`; }
  _applyForLevel(player, level) {
    const factor = 1 + 0.08 * level;
    this._applied = { factor };
    player.speedMul *= factor;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.speedMul /= this._applied.factor;
      this._applied = null;
    }
  }
}

/* ---------- 2) Регенерация: +1 HP / 3 сек за уровень ---------- */
class RegenAbility extends Ability {
  constructor() {
    super({ id: 'regen', name: 'Регенерация', icon: '✚',
      desc: '+1 HP каждые 3 сек за уровень.' });
  }
  effectText() { return `+${this.level} HP / 3 сек`; }
  _applyForLevel(player, level) {
    // hpRegen хранится как HP/сек; +1/3 сек = +0.333.../сек на уровень
    const add = level / 3;
    this._applied = { add };
    player.hpRegen += add;
  }
  _removeApplied(player) {
    if (this._applied) {
      player.hpRegen -= this._applied.add;
      this._applied = null;
    }
  }
}

/* ---------- 3) Усиление урона: +10% за уровень ---------- */
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
    if (this._applied) {
      player.damageMul /= this._applied.factor;
      this._applied = null;
    }
  }
}

/* ---------- 4) Магнит опыта: +30% к радиусу подбора за уровень ---------- */
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
    if (this._applied) {
      player.pickupMul /= this._applied.factor;
      this._applied = null;
    }
  }
}


const ABILITY_FACTORIES = {
  haste:  () => new HasteAbility(),
  regen:  () => new RegenAbility(),
  power:  () => new PowerAbility(),
  magnet: () => new MagnetAbility(),
};

const ABILITY_INFO = [
  { id: 'haste',  name: 'Ускорение',       icon: '➤', desc: '+8% к скорости передвижения за уровень.' },
  { id: 'regen',  name: 'Регенерация',     icon: '✚', desc: '+1 HP каждые 3 сек за уровень.' },
  { id: 'power',  name: 'Усиление урона',  icon: '⚡', desc: '+10% ко всему урону за уровень.' },
  { id: 'magnet', name: 'Магнит опыта',    icon: '◎', desc: '+30% к радиусу подбора кристаллов за уровень.' },
];


window.Ability = Ability;
window.HasteAbility = HasteAbility;
window.RegenAbility = RegenAbility;
window.PowerAbility = PowerAbility;
window.MagnetAbility = MagnetAbility;
window.ABILITY_FACTORIES = ABILITY_FACTORIES;
window.ABILITY_INFO = ABILITY_INFO;
window.MAX_ABILITY_LEVEL = MAX_ABILITY_LEVEL;

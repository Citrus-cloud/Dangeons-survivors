'use strict';
/* ============================================================
   classes.js — Система классов персонажей (4 класса).
   Воин, Волшебник, Плут, Танк.
   Каждый со стартовым оружием и врождённой пассивной способностью.
   ============================================================ */

const CLASS_DEFS = {
  warrior: {
    id: 'warrior',
    name: 'Воин',
    icon: '⚔',
    color: '#c0392b',
    desc: 'Сбалансированный боец ближнего боя.',
    startWeapon: 'sword',
    passive: { physDamageMul: 1.10 },
    passiveDesc: '+10% к физическому урону',
    letter: 'K',
  },
  mage: {
    id: 'mage',
    name: 'Волшебник',
    icon: '📖',
    color: '#8e44ad',
    desc: 'Маг дальнего боя.',
    startWeapon: 'magic_missile_weapon',
    passive: { magicDamageMul: 1.10, missileCdMul: 0.95 },
    passiveDesc: '+10% к магическому урону, -5% кулдауна заклинаний',
    letter: 'M',
  },
  rogue: {
    id: 'rogue',
    name: 'Плут',
    icon: '🗡',
    color: '#27ae60',
    desc: 'Быстрый и скользкий.',
    startWeapon: 'daggers',
    passive: { speedMul: 1.08, critChance: 0.05 },
    passiveDesc: '+8% к скорости, +5% шанс крита',
    letter: 'R',
  },
  tank: {
    id: 'tank',
    name: 'Танк',
    icon: '🔨',
    color: '#2980b9',
    desc: 'Живучий и мощный.',
    startWeapon: 'hammer',
    passive: { maxHpMul: 1.20, damageReduction: 0.05 },
    passiveDesc: '+20% к макс. HP, -5% получаемого урона',
    letter: 'T',
  },
};

const Classes = {
  /** Загрузить выбранный класс из localStorage. */
  getSelected() {
    const saved = localStorage.getItem('d20_selectedClass');
    if (saved && CLASS_DEFS[saved]) return saved;
    return 'warrior'; // по умолчанию
  },

  /** Сохранить выбранный класс. */
  setSelected(classId) {
    if (CLASS_DEFS[classId]) {
      localStorage.setItem('d20_selectedClass', classId);
    }
  },

  /** Получить определение класса. */
  getDef(classId) {
    return CLASS_DEFS[classId || this.getSelected()] || CLASS_DEFS.warrior;
  },

  /** Применить классовый бонус к объекту игрока (вызывается при создании). */
  applyClassPassive(player, classId) {
    const def = this.getDef(classId);
    if (!def || !def.passive) return;
    const p = def.passive;

    if (p.physDamageMul) player.damageMul *= p.physDamageMul;
    if (p.magicDamageMul) player.magicDamageMul = (player.magicDamageMul || 1) * p.magicDamageMul;
    if (p.missileCdMul) player.missileCdMul *= p.missileCdMul;
    if (p.speedMul) player.speedMul *= p.speedMul;
    if (p.critChance) player.critChance = (player.critChance || 0) + p.critChance;
    if (p.maxHpMul) {
      player.maxHp = Math.floor(player.maxHp * p.maxHpMul);
      player.hp = player.maxHp;
    }
    if (p.damageReduction) player.damageReduction = (player.damageReduction || 0) + p.damageReduction;

    // Сохраняем ID класса на игроке для рендера
    player._classId = classId;
    player._classLetter = def.letter;
    player._classColor = def.color;
  },

  /** Получить стартовое оружие для класса. */
  getStartWeapon(classId) {
    const def = this.getDef(classId);
    if (!def) return 'sword';
    return def.startWeapon;
  },
};

window.CLASS_DEFS = CLASS_DEFS;
window.Classes = Classes;

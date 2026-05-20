'use strict';
/* ============================================================
   classes.js — Система классов персонажей (4 класса).
   Воин, Волшебник, Плут, Танк.
   Каждый со стартовым оружием и врождённой пассивной способностью.
   ============================================================ */

const CLASS_DEFS = {
  warrior: {
    id: 'warrior',
    get name() { return t('class_warrior'); },
    icon: '⚔',
    color: '#c0392b',
    get desc() { return t('class_warrior_desc'); },
    startWeapon: 'sword',
    passive: { physDamageMul: 1.10 },
    get passiveDesc() { return t('class_warrior_passive'); },
    letter: 'K',
  },
  mage: {
    id: 'mage',
    get name() { return t('class_mage'); },
    icon: '📖',
    color: '#8e44ad',
    get desc() { return t('class_mage_desc'); },
    startWeapon: 'magic_missile_weapon',
    passive: { magicDamageMul: 1.10, missileCdMul: 0.95 },
    get passiveDesc() { return t('class_mage_passive'); },
    letter: 'M',
  },
  rogue: {
    id: 'rogue',
    get name() { return t('class_rogue'); },
    icon: '🗡',
    color: '#27ae60',
    get desc() { return t('class_rogue_desc'); },
    startWeapon: 'daggers',
    passive: { speedMul: 1.08, critChance: 0.05 },
    get passiveDesc() { return t('class_rogue_passive'); },
    letter: 'R',
  },
  tank: {
    id: 'tank',
    get name() { return t('class_tank'); },
    icon: '🔨',
    color: '#2980b9',
    get desc() { return t('class_tank_desc'); },
    startWeapon: 'hammer',
    passive: { maxHpMul: 1.20, damageReduction: 0.05 },
    get passiveDesc() { return t('class_tank_passive'); },
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

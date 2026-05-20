'use strict';
/* ============================================================
   codex.js — Книга оружия, способностей и эволюций.
   Механика открытия + отображение в UI лагеря.
   Сохранение в localStorage (d20_codex).
   ============================================================ */

const Codex = {
  _data: null, // { weapons: Set, abilities: Set, evolutions: Set }

  /** Загрузить из localStorage. */
  load() {
    try {
      const raw = SafeStorage.getItem('d20_codex');
      if (raw) {
        const parsed = JSON.parse(raw);
        this._data = {
          weapons: new Set(parsed.weapons || []),
          abilities: new Set(parsed.abilities || []),
          evolutions: new Set(parsed.evolutions || []),
        };
      } else {
        this._data = { weapons: new Set(), abilities: new Set(), evolutions: new Set() };
      }
    } catch (e) {
      this._data = { weapons: new Set(), abilities: new Set(), evolutions: new Set() };
    }
  },

  /** Сохранить в localStorage. */
  save() {
    if (!this._data) return;
    const obj = {
      weapons: [...this._data.weapons],
      abilities: [...this._data.abilities],
      evolutions: [...this._data.evolutions],
    };
    SafeStorage.setItem('d20_codex', JSON.stringify(obj));
  },

  /** Разблокировать оружие. */
  unlockWeapon(weaponId) {
    if (!this._data) this.load();
    if (!this._data.weapons.has(weaponId)) {
      this._data.weapons.add(weaponId);
      this.save();
    }
  },

  /** Разблокировать способность. */
  unlockAbility(abilityId) {
    if (!this._data) this.load();
    if (!this._data.abilities.has(abilityId)) {
      this._data.abilities.add(abilityId);
      this.save();
    }
  },

  /** Разблокировать эволюцию. */
  unlockEvolution(evolutionResultId) {
    if (!this._data) this.load();
    if (!this._data.evolutions.has(evolutionResultId)) {
      this._data.evolutions.add(evolutionResultId);
      this.save();
    }
  },

  /** Проверки. */
  isWeaponUnlocked(id) { if (!this._data) this.load(); return this._data.weapons.has(id); },
  isAbilityUnlocked(id) { if (!this._data) this.load(); return this._data.abilities.has(id); },
  isEvolutionUnlocked(id) { if (!this._data) this.load(); return this._data.evolutions.has(id); },

  /** Статистика. */
  getStats() {
    if (!this._data) this.load();
    const totalWeapons = (window.WEAPON_INFO ? WEAPON_INFO.length : 0) +
                         (window.EXCLUSIVE_WEAPON_INFO ? EXCLUSIVE_WEAPON_INFO.length : 0);
    const totalAbilities = window.ABILITY_INFO ? ABILITY_INFO.length : 0;
    const totalEvolutions = (window.EVOLUTIONS ? EVOLUTIONS.length : 0) +
                            (window.SUPER_EVOLUTIONS ? SUPER_EVOLUTIONS.length : 0);
    return {
      weapons: { unlocked: this._data.weapons.size, total: totalWeapons },
      abilities: { unlocked: this._data.abilities.size, total: totalAbilities },
      evolutions: { unlocked: this._data.evolutions.size, total: totalEvolutions },
    };
  },
};

window.Codex = Codex;

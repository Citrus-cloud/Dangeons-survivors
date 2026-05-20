'use strict';
/* ============================================================
   registry.js — Единый реестр модулей.
   Гарантирует порядок инициализации и предоставляет
   безопасный доступ к модулям через Registry.get().
   Загружается ПОСЛЕДНИМ (перед state-machine.js).
   ============================================================ */

const Registry = {
  _modules: {},

  /**
   * Зарегистрировать модуль. Вызывается автоматически
   * (модули определяются через <script> в правильном порядке).
   */
  register(name, ref) {
    this._modules[name] = ref;
  },

  /** Получить модуль (или null если не загружен) */
  get(name) {
    return this._modules[name] || window[name] || null;
  },

  /** Проверить наличие модуля */
  has(name) {
    return !!(this._modules[name] || window[name]);
  },

  /**
   * Инициализировать все зарегистрированные модули.
   * Вызывается из Game.init() один раз.
   */
  initAll() {
    // 1. Утилиты (уже инициализированы определением)
    // 2. Карта
    if (window.GameMap) GameMap.precompute();

    // 3. Ввод
    if (window.Input) Input.init();

    // 4. Аудио
    if (window.GameAudio) GameAudio.init();

    // 5. Спрайты
    if (window.initSprites) initSprites();
    if (window.initBiomePreviews) initBiomePreviews();

    // 6. Мета-прогресс
    if (window.MetaProgress) MetaProgress.load();

    // 7. Бестиарий и кодекс
    if (window.Bestiary) Bestiary.load();
    if (window.Codex) Codex.load();

    // 8. Extended UI
    if (window.UIExtended) {
      UIExtended.addPauseExitButton();
      UIExtended.initBackButton();
    }
  }
};

window.Registry = Registry;

'use strict';
/* ============================================================
   audio.js — заготовка аудио-системы.
   Пока ничего не играет: задел под Шаг 3+.
   Имя GameAudio (а не Audio), чтобы не конфликтовать со
   встроенным window.Audio (HTMLAudioElement-конструктор).
   ============================================================ */

const GameAudio = {
  enabled: false,
  ctx: null,

  init() {
    // Web Audio API будет инициализирован по первому пользовательскому жесту
    // (политики автоплея). Пока — no-op.
  },

  // Унифицированный API для будущих звуковых эффектов
  play(/* name, opts */) {
    if (!this.enabled) return;
  },

  setEnabled(v) { this.enabled = !!v; },
};

window.GameAudio = GameAudio;

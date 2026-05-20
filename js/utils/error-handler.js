'use strict';
/* ============================================================
   error-handler.js — Глобальная обработка ошибок.
   Логирует в консоль, предотвращает крэш UI.
   Загружается ПЕРВЫМ (до всех остальных скриптов).
   ============================================================ */

window.onerror = function(message, source, lineno, colno, error) {
  console.error('[D20 Error]', message, '\n  at', source + ':' + lineno + ':' + colno);
  if (error && error.stack) console.error(error.stack);
  // Не блокируем дальнейшее выполнение
  return false;
};

window.onunhandledrejection = function(event) {
  console.error('[D20 Unhandled Promise]', event.reason);
  // Предотвращаем крэш — промис отклонён но не убивает игру
};

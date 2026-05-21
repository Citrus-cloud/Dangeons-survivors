'use strict';
/* ============================================================
   error-handler.js — Глобальная обработка ошибок JavaScript.
   
   Назначение:
   Перехватывает все необработанные ошибки и отклонённые промисы,
   логирует их в консоль с префиксом [D20 Error], но НЕ блокирует
   дальнейшее выполнение игры.
   
   Важно: Загружается ПЕРВЫМ (до всех остальных скриптов),
   чтобы перехватывать ошибки инициализации.
   
   Обрабатывает:
   • window.onerror — Синхронные ошибки (TypeError, ReferenceError и т.д.)
   • window.onunhandledrejection — Отклонённые Promise без .catch()
   ============================================================ */

/**
 * Глобальный обработчик синхронных ошибок.
 * Логирует ошибку и стектрейс, но не прерывает выполнение.
 */
window.onerror = function(message, source, lineno, colno, error) {
  console.error('[D20 Error]', message, '\n  at', source + ':' + lineno + ':' + colno);
  if (error && error.stack) console.error(error.stack);
  return false; // false = не блокировать дальнейшее выполнение
};

/**
 * Глобальный обработчик отклонённых промисов.
 * Предотвращает крэш при асинхронных ошибках.
 */
window.onunhandledrejection = function(event) {
  console.error('[D20 Unhandled Promise]', event.reason);
};

'use strict';
/* ============================================================
   tutorial.js — Экран обучения при первом запуске.
   
   Показывает 4 шага:
   1. Управление (джойстик / клавиатура)
   2. Объяснение оружия и пассивок
   3. Сундуки и бросок d20
   4. Цель игры
   
   Показывается один раз, затем сохраняет флаг в localStorage.
   
   Экспорт: window.Tutorial
   ============================================================ */

const Tutorial = {
  STORAGE_KEY: 'd20_tutorial_done',

  /** Проверить, нужно ли показывать обучение */
  shouldShow() {
    return !SafeStorage.getItem(this.STORAGE_KEY);
  },

  /** Пометить обучение как пройденное */
  markDone() {
    SafeStorage.setItem(this.STORAGE_KEY, '1');
  },

  /**
   * Показать экран обучения.
   * @param {Function} onComplete — вызывается после завершения обучения
   */
  show(onComplete) {
    if (!this.shouldShow()) {
      onComplete && onComplete();
      return;
    }

    const steps = this._getSteps();
    let currentStep = 0;

    // Создаём оверлей
    const overlay = document.createElement('div');
    overlay.id = 'tutorialOverlay';
    overlay.className = 'overlay active';
    overlay.style.zIndex = '200';
    document.body.appendChild(overlay);

    const render = () => {
      const step = steps[currentStep];
      const isLast = currentStep === steps.length - 1;
      overlay.innerHTML = `
        <div class="tutorial-panel">
          <div class="tutorial-step-indicator">${currentStep + 1} / ${steps.length}</div>
          <div class="tutorial-icon">${step.icon}</div>
          <div class="tutorial-title">${step.title}</div>
          <div class="tutorial-desc">${step.desc}</div>
          <div class="tutorial-buttons">
            ${currentStep > 0 ? `<button class="btn btn-secondary" id="tutPrev">${t('btn_back')}</button>` : ''}
            <button class="btn" id="tutNext">${isLast ? t('btn_continue') : '→'}</button>
          </div>
        </div>
      `;

      overlay.querySelector('#tutNext').addEventListener('click', () => {
        if (isLast) {
          this.markDone();
          overlay.remove();
          onComplete && onComplete();
        } else {
          currentStep++;
          render();
        }
      });

      const prevBtn = overlay.querySelector('#tutPrev');
      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          currentStep--;
          render();
        });
      }
    };

    render();
  },

  /** Получить шаги обучения на текущем языке */
  _getSteps() {
    return [
      {
        icon: '🕹️',
        title: t('tutorial_step1_title'),
        desc: t('tutorial_step1_desc'),
      },
      {
        icon: '⚔️',
        title: t('tutorial_step2_title'),
        desc: t('tutorial_step2_desc'),
      },
      {
        icon: '🎲',
        title: t('tutorial_step3_title'),
        desc: t('tutorial_step3_desc'),
      },
      {
        icon: '🏆',
        title: t('tutorial_step4_title'),
        desc: t('tutorial_step4_desc'),
      },
    ];
  },
};

window.Tutorial = Tutorial;

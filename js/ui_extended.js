'use strict';
/* ============================================================
   ui_extended.js — Расширенный UI: выбор класса, бестиарий,
   книга (кодекс), окно статистики, выход из забега, кнопка «Назад».
   ============================================================ */

const UIExtended = {
  _classOverlay: null,
  _bestiaryOverlay: null,
  _codexOverlay: null,
  _runStatsOverlay: null,

  /* ============================================================
     ВЫБОР КЛАССА
     ============================================================ */
  showClassSelect(onBack) {
    if (!this._classOverlay) this._buildClassOverlay();
    this._updateClassOverlay();
    this._classOverlay._onBack = onBack;
    this._classOverlay.classList.add('active');
  },

  _buildClassOverlay() {
    const ov = document.createElement('div');
    ov.id = 'classOverlay';
    ov.className = 'overlay camp-overlay';
    ov.innerHTML = `
      <div class="camp-bg">
        <h1 class="camp-title" style="font-size:1.4em;">ВЫБОР ГЕРОЯ</h1>
        <div id="classGrid" class="class-grid"></div>
        <button id="classBackBtn" class="btn" style="margin-top:16px;">↩ Назад</button>
      </div>
    `;
    document.body.appendChild(ov);
    this._classOverlay = ov;
    ov.querySelector('#classBackBtn').addEventListener('click', () => {
      ov.classList.remove('active');
      if (ov._onBack) ov._onBack();
    });
  },

  _updateClassOverlay() {
    const grid = this._classOverlay.querySelector('#classGrid');
    grid.innerHTML = '';
    const selected = Classes.getSelected();
    for (const id of Object.keys(CLASS_DEFS)) {
      const def = CLASS_DEFS[id];
      const isActive = (id === selected);
      const card = document.createElement('div');
      card.className = 'class-card' + (isActive ? ' class-card-active' : '');

      // Используем CLASS_SPRITES если доступны (32×32 пиксельная иконка)
      const sprite = window.CLASS_SPRITES ? CLASS_SPRITES[id] : null;
      let iconHtml;
      if (sprite) {
        iconHtml = `<div class="class-card-icon" style="background:${def.color};background-image:url(${sprite.toDataURL()});background-size:contain;background-repeat:no-repeat;background-position:center;image-rendering:pixelated;"></div>`;
      } else {
        iconHtml = `<div class="class-card-icon" style="background:${def.color};">${def.icon}</div>`;
      }

      card.innerHTML = `
        ${iconHtml}
        <div class="class-card-name">${def.name}</div>
        <div class="class-card-desc">${def.desc}</div>
        <div class="class-card-passive">${def.passiveDesc}</div>
      `;
      card.addEventListener('click', () => {
        Classes.setSelected(id);
        this._updateClassOverlay();
      });
      grid.appendChild(card);
    }
  },

  /* ============================================================
     БЕСТИАРИЙ
     ============================================================ */
  showBestiary(onBack) {
    if (!this._bestiaryOverlay) this._buildBestiaryOverlay();
    this._updateBestiaryOverlay();
    this._bestiaryOverlay._onBack = onBack;
    this._bestiaryOverlay.classList.add('active');
  },

  _buildBestiaryOverlay() {
    const ov = document.createElement('div');
    ov.id = 'bestiaryOverlay';
    ov.className = 'overlay camp-overlay';
    ov.innerHTML = `
      <div class="camp-bg" style="max-height:95vh;overflow-y:auto;">
        <h1 class="camp-title" style="font-size:1.3em;">📕 БЕСТИАРИЙ</h1>
        <div id="bestiaryStats" class="bestiary-stats"></div>
        <div id="bestiaryGrid" class="bestiary-grid"></div>
        <button id="bestiaryBackBtn" class="btn" style="margin-top:12px;">↩ Назад</button>
      </div>
    `;
    document.body.appendChild(ov);
    this._bestiaryOverlay = ov;
    ov.querySelector('#bestiaryBackBtn').addEventListener('click', () => {
      ov.classList.remove('active');
      if (ov._onBack) ov._onBack();
    });
  },

  _updateBestiaryOverlay() {
    const stats = Bestiary.getStats();
    this._bestiaryOverlay.querySelector('#bestiaryStats').textContent =
      `Открыто: ${stats.unlocked} / ${stats.total}`;
    const grid = this._bestiaryOverlay.querySelector('#bestiaryGrid');
    grid.innerHTML = '';
    const enemies = Bestiary.getAllEnemies();
    for (const cfg of enemies) {
      const unlocked = Bestiary.isUnlocked(cfg.id);
      const cell = document.createElement('div');
      cell.className = 'bestiary-cell' + (unlocked ? ' unlocked' : ' locked');
      if (unlocked) {
        // Используем пиксельный спрайт, если доступен
        const sprite = window.getEnemySprite ? getEnemySprite(cfg.id) : null;
        const iconDiv = document.createElement('div');
        iconDiv.className = 'bestiary-cell-icon';
        if (sprite) {
          // Рисуем спрайт в маленький canvas (32x32 для отображения)
          const display = document.createElement('canvas');
          display.width = 32; display.height = 32;
          display.style.imageRendering = 'pixelated';
          display.style.width = '32px'; display.style.height = '32px';
          const dCtx = display.getContext('2d');
          dCtx.imageSmoothingEnabled = false;
          dCtx.drawImage(sprite, 0, 0, 32, 32);
          iconDiv.style.background = 'transparent';
          iconDiv.style.border = 'none';
          iconDiv.innerHTML = '';
          iconDiv.appendChild(display);
        } else {
          iconDiv.style.background = cfg.color;
          iconDiv.style.borderColor = cfg.stroke || '#666';
          iconDiv.textContent = cfg.letter;
        }
        cell.appendChild(iconDiv);
        const nameDiv = document.createElement('div');
        nameDiv.className = 'bestiary-cell-name';
        nameDiv.textContent = cfg.name;
        cell.appendChild(nameDiv);
        const descDiv = document.createElement('div');
        descDiv.className = 'bestiary-cell-desc';
        descDiv.textContent = Bestiary.getDescription(cfg.id);
        cell.appendChild(descDiv);
      } else {
        // Неоткрытый враг — чёрный силуэт
        const sprite = window.getEnemySprite ? getEnemySprite(cfg.id) : null;
        const iconDiv = document.createElement('div');
        iconDiv.className = 'bestiary-cell-icon locked-icon';
        if (sprite) {
          const display = document.createElement('canvas');
          display.width = 32; display.height = 32;
          display.style.imageRendering = 'pixelated';
          display.style.width = '32px'; display.style.height = '32px';
          const dCtx = display.getContext('2d');
          dCtx.imageSmoothingEnabled = false;
          dCtx.drawImage(sprite, 0, 0, 32, 32);
          // Затемняем (чёрный силуэт)
          dCtx.globalCompositeOperation = 'source-in';
          dCtx.fillStyle = '#222222';
          dCtx.fillRect(0, 0, 32, 32);
          dCtx.globalCompositeOperation = 'source-over';
          iconDiv.style.background = 'transparent';
          iconDiv.style.border = 'none';
          iconDiv.innerHTML = '';
          iconDiv.appendChild(display);
        } else {
          iconDiv.textContent = '?';
        }
        cell.appendChild(iconDiv);
        const nameDiv = document.createElement('div');
        nameDiv.className = 'bestiary-cell-name';
        nameDiv.textContent = '???';
        cell.appendChild(nameDiv);
      }
      grid.appendChild(cell);
    }
  },

  /* ============================================================
     КОДЕКС (КНИГА)
     ============================================================ */
  showCodex(onBack) {
    if (!this._codexOverlay) this._buildCodexOverlay();
    this._updateCodexOverlay('weapons');
    this._codexOverlay._onBack = onBack;
    this._codexOverlay.classList.add('active');
  },

  _buildCodexOverlay() {
    const ov = document.createElement('div');
    ov.id = 'codexOverlay';
    ov.className = 'overlay camp-overlay';
    ov.innerHTML = `
      <div class="camp-bg" style="max-height:95vh;overflow-y:auto;">
        <h1 class="camp-title" style="font-size:1.3em;">📖 КНИГА</h1>
        <div class="codex-tabs">
          <button class="codex-tab active" data-tab="weapons">Оружие</button>
          <button class="codex-tab" data-tab="abilities">Способности</button>
          <button class="codex-tab" data-tab="evolutions">Эволюции</button>
        </div>
        <div id="codexContent" class="codex-content"></div>
        <button id="codexBackBtn" class="btn" style="margin-top:12px;">↩ Назад</button>
      </div>
    `;
    document.body.appendChild(ov);
    this._codexOverlay = ov;
    ov.querySelector('#codexBackBtn').addEventListener('click', () => {
      ov.classList.remove('active');
      if (ov._onBack) ov._onBack();
    });
    ov.querySelectorAll('.codex-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        ov.querySelectorAll('.codex-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this._updateCodexOverlay(tab.dataset.tab);
      });
    });
  },

  _updateCodexOverlay(tab) {
    const content = this._codexOverlay.querySelector('#codexContent');
    content.innerHTML = '';
    if (tab === 'weapons') {
      this._renderCodexWeapons(content);
    } else if (tab === 'abilities') {
      this._renderCodexAbilities(content);
    } else if (tab === 'evolutions') {
      this._renderCodexEvolutions(content);
    }
  },

  _renderCodexWeapons(container) {
    const allWeapons = [...(window.WEAPON_INFO || []), ...(window.EXCLUSIVE_WEAPON_INFO || [])];
    for (const info of allWeapons) {
      const unlocked = Codex.isWeaponUnlocked(info.id);
      const card = document.createElement('div');
      card.className = 'codex-card' + (unlocked ? ' unlocked' : ' locked');
      if (unlocked) {
        card.innerHTML = `
          <div class="codex-card-icon">${info.icon || '?'}</div>
          <div class="codex-card-name">${info.name}</div>
          <div class="codex-card-desc">${info.desc || ''}</div>
        `;
        // Шаг 2: пиксельный спрайт
        const iconEl = card.querySelector('.codex-card-icon');
        const WS = window.WEAPON_SPRITES;
        const spr = WS ? WS[info.id] : null;
        if (spr && iconEl) {
          iconEl.textContent = '';
          iconEl.style.backgroundImage = 'url(' + spr.toDataURL() + ')';
          iconEl.style.backgroundSize = 'contain';
          iconEl.style.backgroundRepeat = 'no-repeat';
          iconEl.style.backgroundPosition = 'center';
          iconEl.style.imageRendering = 'pixelated';
        }
      } else {
        card.innerHTML = `
          <div class="codex-card-icon locked-icon">?</div>
          <div class="codex-card-name">???</div>
        `;
      }
      container.appendChild(card);
    }
  },

  _renderCodexAbilities(container) {
    const allAbilities = window.ABILITY_INFO || [];
    for (const info of allAbilities) {
      const unlocked = Codex.isAbilityUnlocked(info.id);
      const card = document.createElement('div');
      card.className = 'codex-card' + (unlocked ? ' unlocked' : ' locked');
      if (unlocked) {
        card.innerHTML = `
          <div class="codex-card-icon">${info.icon || '?'}</div>
          <div class="codex-card-name">${info.name}</div>
          <div class="codex-card-desc">${info.desc || ''}</div>
        `;
        // Шаг 2: пиксельный спрайт
        const iconEl = card.querySelector('.codex-card-icon');
        const AS = window.ABILITY_SPRITES;
        const spr = AS ? AS[info.id] : null;
        if (spr && iconEl) {
          iconEl.textContent = '';
          iconEl.style.backgroundImage = 'url(' + spr.toDataURL() + ')';
          iconEl.style.backgroundSize = 'contain';
          iconEl.style.backgroundRepeat = 'no-repeat';
          iconEl.style.backgroundPosition = 'center';
          iconEl.style.imageRendering = 'pixelated';
        }
      } else {
        card.innerHTML = `
          <div class="codex-card-icon locked-icon">?</div>
          <div class="codex-card-name">???</div>
        `;
      }
      container.appendChild(card);
    }
  },

  _renderCodexEvolutions(container) {
    const allEvo = [...(window.EVOLUTIONS || []), ...(window.SUPER_EVOLUTIONS || [])];
    for (const evo of allEvo) {
      const resultId = evo.resultId;
      const unlocked = Codex.isEvolutionUnlocked(resultId);
      const card = document.createElement('div');
      card.className = 'codex-card' + (unlocked ? ' unlocked' : ' locked');
      if (unlocked) {
        card.innerHTML = `
          <div class="codex-card-icon">${evo.resultIcon || '?'}</div>
          <div class="codex-card-name">${evo.resultName}</div>
          <div class="codex-card-desc">${evo.desc || ''}</div>
        `;
        // Шаг 2: пиксельный спрайт эволюции
        const iconEl = card.querySelector('.codex-card-icon');
        const ES = window.EVOLUTION_SPRITES;
        const spr = ES ? ES[resultId] : null;
        if (spr && iconEl) {
          iconEl.textContent = '';
          iconEl.style.backgroundImage = 'url(' + spr.toDataURL() + ')';
          iconEl.style.backgroundSize = 'contain';
          iconEl.style.backgroundRepeat = 'no-repeat';
          iconEl.style.backgroundPosition = 'center';
          iconEl.style.imageRendering = 'pixelated';
        }
      } else {
        card.innerHTML = `
          <div class="codex-card-icon locked-icon">?</div>
          <div class="codex-card-name">???</div>
        `;
      }
      container.appendChild(card);
    }
  },

  /* ============================================================
     ОКНО СТАТИСТИКИ ПОСЛЕ ЗАБЕГА
     ============================================================ */
  showRunStats(stats, onContinue) {
    if (!this._runStatsOverlay) this._buildRunStatsOverlay();
    this._updateRunStats(stats);
    this._runStatsOverlay._onContinue = onContinue;
    this._runStatsOverlay.classList.add('active');
  },

  _buildRunStatsOverlay() {
    const ov = document.createElement('div');
    ov.id = 'runStatsOverlay';
    ov.className = 'overlay camp-overlay';
    ov.innerHTML = `
      <div class="camp-bg">
        <h1 class="camp-title" style="font-size:1.4em;">📊 СТАТИСТИКА ЗАБЕГА</h1>
        <div id="runStatsContent" class="run-stats-content"></div>
        <button id="runStatsContinueBtn" class="btn" style="margin-top:16px;">Продолжить</button>
      </div>
    `;
    document.body.appendChild(ov);
    this._runStatsOverlay = ov;
    ov.querySelector('#runStatsContinueBtn').addEventListener('click', () => {
      ov.classList.remove('active');
      if (ov._onContinue) ov._onContinue();
    });
  },

  _updateRunStats(stats) {
    const content = this._runStatsOverlay.querySelector('#runStatsContent');
    // Строим список статистик
    const items = [
      { label: 'Время', value: stats.time || '00:00' },
      { label: 'Убийств', value: stats.kills || 0 },
      { label: 'Уровень', value: stats.level || 1 },
      { label: 'Волна', value: stats.wave || 0 },
      { label: 'Карт пройдено', value: stats.mapsCleared || 0 },
      { label: 'Золото собрано', value: stats.goldCollected || 0 },
      { label: 'Золото (бонус)', value: stats.goldBonus || 0 },
      { label: 'Золото (итого)', value: stats.goldTotal || 0 },
      { label: 'Урон нанесён', value: stats.damageDealt || '—' },
      { label: 'Урон получен', value: stats.damageTaken || '—' },
      { label: 'Боссов убито', value: stats.bossKills || 0 },
      { label: 'Сундуков открыто', value: stats.chestsOpened || 0 },
      { label: 'Лучший бросок d20', value: stats.bestRoll || '—' },
    ];
    let html = '<div class="run-stats-grid">';
    for (const item of items) {
      html += `<div class="run-stats-row"><span class="run-stats-label">${item.label}</span><span class="run-stats-value">${item.value}</span></div>`;
    }
    html += '</div>';
    content.innerHTML = html;
  },

  /* ============================================================
     ПАУЗА: кнопка «Выйти в лагерь»
     ============================================================ */
  addPauseExitButton() {
    const pauseOv = document.getElementById('pauseOverlay');
    if (!pauseOv) return;
    if (pauseOv.querySelector('#pauseExitBtn')) return; // уже добавлена
    const btn = document.createElement('button');
    btn.id = 'pauseExitBtn';
    btn.className = 'btn btn-secondary';
    btn.textContent = '🚪 Выйти в лагерь';
    btn.style.marginTop = '12px';
    btn.addEventListener('click', () => {
      if (window.Game) {
        Game.exitToMenu();
      }
    });
    pauseOv.appendChild(btn);
  },

  /* ============================================================
     КНОПКА «НАЗАД» НА СМАРТФОНЕ
     ============================================================ */
  initBackButton() {
    // Обработка hardware back button (Android) через history API
    // Пушим состояние, чтобы при нажатии «назад» вызвать popstate
    window.history.pushState({ game: true }, '');
    window.addEventListener('popstate', (e) => {
      // Предотвращаем реальный уход назад
      window.history.pushState({ game: true }, '');
      this._handleBackButton();
    });
  },

  _handleBackButton() {
    if (!window.Game) return;
    if (Game.state === 'playing') {
      // Открыть паузу
      Game.togglePause();
    } else if (Game.state === 'paused') {
      // Выйти в лагерь (показать статистику)
      Game.exitToMenu();
    }
    // В остальных состояниях (camp, levelup, chest) — игнорируем
  },
};

window.UIExtended = UIExtended;

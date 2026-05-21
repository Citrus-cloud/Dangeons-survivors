/* ============================================================
   overlays.js — Расширенный UI: классы, бестиарий, кодекс, статистика.
   
   Содержит:
   • UIExtended.showClassSelect() — Экран выбора класса героя
   • UIExtended.showBestiary() — Бестиарий (все встреченные враги)
   • UIExtended.showCodex() — Кодекс (оружия и пассивки)
   • UIExtended.showRunStats() — Статистика забега (после смерти)
   • UIExtended.addPauseExitButton() — Кнопка выхода в меню паузы
   • UIExtended.initBackButton() — Кнопка «Назад» в системных экранах
   
   Все оверлеи создаются динамически (DOM) при первом вызове
   и переиспользуются при последующих.
   
   Экспорт: window.UIExtended
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
        <h1 class="camp-title" style="font-size:1.4em;">${t('class_select_title')}</h1>
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
     БЕСТИАРИЙ — двухпанельный UI (Шаг 3 переработка)
     Левая панель: сетка карточек 48×48.
     Правая панель: подробная информация о выбранном враге.
     ============================================================ */
  showBestiary(onBack) {
    if (!this._bestiaryOverlay) this._buildBestiaryOverlay();
    Bestiary.selectedEnemyId = null;
    this._updateBestiaryGrid();
    this._updateBestiaryDetail();
    this._bestiaryOverlay._onBack = onBack;
    this._bestiaryOverlay.classList.add('active');
  },

  _buildBestiaryOverlay() {
    const ov = document.createElement('div');
    ov.id = 'bestiaryOverlay';
    ov.className = 'overlay camp-overlay';
    ov.innerHTML = `
      <div class="bestiary-layout">
        <div class="bestiary-header">
          <h1 class="bestiary-title">${t('bestiary_title')}</h1>
          <div id="bestiaryStats" class="bestiary-stats-header"></div>
          <button id="bestiaryBackBtn" class="btn bestiary-back-btn">${t('bestiary_back')}</button>
        </div>
        <div class="bestiary-body">
          <div class="bestiary-left" id="bestiaryLeft">
            <div id="bestiaryGrid" class="bestiary-grid-v2"></div>
          </div>
          <div class="bestiary-right" id="bestiaryRight">
            <div id="bestiaryDetail" class="bestiary-detail">
              <div class="bestiary-detail-empty">
                <div class="bestiary-detail-empty-icon">🔍</div>
                <div class="bestiary-detail-empty-text">${t('bestiary_select_enemy')}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    this._bestiaryOverlay = ov;
    ov.querySelector('#bestiaryBackBtn').addEventListener('click', () => {
      ov.classList.remove('active');
      if (ov._onBack) ov._onBack();
    });
  },

  /** Отрисовка левой сетки бестиария. */
  _updateBestiaryGrid() {
    const stats = Bestiary.getStats();
    this._bestiaryOverlay.querySelector('#bestiaryStats').textContent =
      t('bestiary_unlocked', stats.unlocked, stats.total);
    const grid = this._bestiaryOverlay.querySelector('#bestiaryGrid');
    grid.innerHTML = '';
    const enemies = Bestiary.getAllEnemies();
    for (const cfg of enemies) {
      const unlocked = Bestiary.isUnlocked(cfg.id);
      const cell = document.createElement('div');
      cell.className = 'bestiary-cell-v2' + (unlocked ? ' unlocked' : ' locked');
      if (Bestiary.selectedEnemyId === cfg.id) cell.classList.add('selected');

      // Иконка спрайта (маленькая 32×32 отображаемая как 48×48)
      const iconDiv = document.createElement('div');
      iconDiv.className = 'bestiary-cell-v2-icon';
      const sprite = window.getEnemySprite ? getEnemySprite(cfg.id) : null;

      if (sprite) {
        const display = document.createElement('canvas');
        display.width = 16; display.height = 16;
        display.style.imageRendering = 'pixelated';
        display.style.width = '32px'; display.style.height = '32px';
        const dCtx = display.getContext('2d');
        dCtx.imageSmoothingEnabled = false;
        dCtx.drawImage(sprite, 0, 0, 16, 16);
        if (!unlocked) {
          // Чёрный силуэт
          dCtx.globalCompositeOperation = 'source-in';
          dCtx.fillStyle = '#1a1a1a';
          dCtx.fillRect(0, 0, 16, 16);
          dCtx.globalCompositeOperation = 'source-over';
        }
        iconDiv.appendChild(display);
      } else {
        if (unlocked) {
          iconDiv.style.background = cfg.color;
          iconDiv.textContent = cfg.letter;
        } else {
          iconDiv.textContent = '?';
          iconDiv.classList.add('silhouette');
        }
      }
      cell.appendChild(iconDiv);

      // Мини-название
      const nameDiv = document.createElement('div');
      nameDiv.className = 'bestiary-cell-v2-name';
      nameDiv.textContent = unlocked ? cfg.name : '???';
      cell.appendChild(nameDiv);

      // Клик — выбрать
      cell.addEventListener('click', () => {
        if (!unlocked) return; // Неоткрытых не выбираем
        Bestiary.selectedEnemyId = cfg.id;
        // Обновить подсветку
        grid.querySelectorAll('.bestiary-cell-v2').forEach(c => c.classList.remove('selected'));
        cell.classList.add('selected');
        this._updateBestiaryDetail();
      });

      grid.appendChild(cell);
    }
  },

  /** Отрисовка правой панели деталей. */
  _updateBestiaryDetail() {
    const detail = this._bestiaryOverlay.querySelector('#bestiaryDetail');
    const id = Bestiary.selectedEnemyId;
    if (!id || !window.ENEMY_TYPES || !ENEMY_TYPES[id]) {
      detail.innerHTML = `
        <div class="bestiary-detail-empty">
          <div class="bestiary-detail-empty-icon">🔍</div>
          <div class="bestiary-detail-empty-text">${t('bestiary_select_enemy')}</div>
        </div>`;
      return;
    }

    const cfg = ENEMY_TYPES[id];
    const desc = Bestiary.getDescription(id);
    const abilities = Bestiary.getAbilities(id);
    const speedLabel = Bestiary.getSpeedLabel(id);
    const xpMin = cfg.xp ? cfg.xp[0] : 0;
    const xpMax = cfg.xp ? cfg.xp[1] : 0;

    // Крупный спрайт
    let spriteHtml = '';
    const sprite = window.getEnemySprite ? getEnemySprite(id) : null;
    if (sprite) {
      // Рисуем в canvas 48×48 и масштабируем отображение
      const cvs = document.createElement('canvas');
      cvs.width = 32; cvs.height = 32;
      cvs.style.imageRendering = 'pixelated';
      cvs.style.width = '96px'; cvs.style.height = '96px';
      cvs.className = 'bestiary-detail-sprite';
      const ctx2 = cvs.getContext('2d');
      ctx2.imageSmoothingEnabled = false;
      ctx2.drawImage(sprite, 0, 0, 32, 32);
      spriteHtml = cvs.outerHTML;
    } else {
      spriteHtml = `<div class="bestiary-detail-sprite-fallback" style="background:${cfg.color};border-color:${cfg.stroke || '#666'};">${cfg.letter}</div>`;
    }

    // Тир
    const tierNames = { 0: 'Special', 1: 'Tier I', 2: 'Tier II', 3: 'Tier III', 4: 'Tier IV', 5: 'Tier V' };
    const tierLabel = tierNames[cfg.tier] || 'Tier ' + cfg.tier;

    let html = `
      <div class="bestiary-detail-card">
        <div class="bestiary-detail-sprite-wrap">${spriteHtml}</div>
        <div class="bestiary-detail-name">${cfg.name}</div>
        <div class="bestiary-detail-tier">${tierLabel}</div>
        <div class="bestiary-detail-divider"></div>
        <div class="bestiary-detail-desc">"${desc}"</div>
        <div class="bestiary-detail-divider"></div>
        <div class="bestiary-detail-stats">
          <div class="bestiary-stat-row"><span class="bestiary-stat-label">❤ HP:</span><span class="bestiary-stat-value">${cfg.hp}</span></div>
          <div class="bestiary-stat-row"><span class="bestiary-stat-label">⚔ Урон:</span><span class="bestiary-stat-value">${cfg.damage}</span></div>
          <div class="bestiary-stat-row"><span class="bestiary-stat-label">🏃 Скорость:</span><span class="bestiary-stat-value">${speedLabel}</span></div>
          <div class="bestiary-stat-row"><span class="bestiary-stat-label">✨ Опыт:</span><span class="bestiary-stat-value">${xpMin}–${xpMax}</span></div>
        </div>`;

    if (abilities) {
      html += `
        <div class="bestiary-detail-divider"></div>
        <div class="bestiary-detail-abilities">
          <div class="bestiary-abilities-title">⚡ Особые способности</div>
          <div class="bestiary-abilities-text">${abilities}</div>
        </div>`;
    }

    html += `</div>`;
    detail.innerHTML = html;

    // Заменяем canvas placeholder на реальный спрайт (innerHTML теряет canvas)
    if (sprite) {
      const wrap = detail.querySelector('.bestiary-detail-sprite-wrap');
      wrap.innerHTML = '';
      const cvs = document.createElement('canvas');
      cvs.width = 32; cvs.height = 32;
      cvs.style.imageRendering = 'pixelated';
      cvs.style.width = '96px';
      cvs.style.height = '96px';
      cvs.className = 'bestiary-detail-sprite';
      const ctx2 = cvs.getContext('2d');
      ctx2.imageSmoothingEnabled = false;
      ctx2.drawImage(sprite, 0, 0, 32, 32);
      wrap.appendChild(cvs);
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
        <h1 class="camp-title" style="font-size:1.3em;">${t('codex_title')}</h1>
        <div class="codex-tabs">
          <button class="codex-tab active" data-tab="weapons">${t('codex_tab_weapons')}</button>
          <button class="codex-tab" data-tab="abilities">${t('codex_tab_abilities')}</button>
          <button class="codex-tab" data-tab="evolutions">${t('codex_tab_evolutions')}</button>
        </div>
        <div id="codexContent" class="codex-content"></div>
        <button id="codexBackBtn" class="btn" style="margin-top:12px;">${t('codex_back')}</button>
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
        <h1 class="camp-title" style="font-size:1.4em;">${t('stats_title')}</h1>
        <div id="runStatsContent" class="run-stats-content"></div>
        <button id="runStatsContinueBtn" class="btn" style="margin-top:16px;">${t('stats_continue')}</button>
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
      { label: t('stats_time'), value: stats.time || '00:00' },
      { label: t('stats_kills'), value: stats.kills || 0 },
      { label: t('stats_level'), value: stats.level || 1 },
      { label: t('stats_wave'), value: stats.wave || 0 },
      { label: t('stats_maps'), value: stats.mapsCleared || 0 },
      { label: t('stats_gold_collected'), value: stats.goldCollected || 0 },
      { label: t('stats_gold_bonus'), value: stats.goldBonus || 0 },
      { label: t('stats_gold_total'), value: stats.goldTotal || 0 },
      { label: t('stats_damage_dealt'), value: stats.damageDealt || '—' },
      { label: t('stats_damage_taken'), value: stats.damageTaken || '—' },
      { label: t('stats_bosses'), value: stats.bossKills || 0 },
      { label: t('stats_chests'), value: stats.chestsOpened || 0 },
      { label: t('stats_best_roll'), value: stats.bestRoll || '—' },
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
    btn.textContent = t('pause_exit');
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

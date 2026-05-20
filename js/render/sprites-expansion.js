/* ============================================================
   sprites_expansion.js — Процедурные спрайты для 50 новых врагов
   и 5 новых мини-боссов. Кэширование на offscreen canvas.
   Загружается ПОСЛЕ sprites.js и constants_expansion.js.

   Использует существующие утилиты из sprites.js:
   _createSpriteCanvas, _gradCircle, _gradEllipse, _glow,
   _gradRect, _rect, _addOutline, ENEMY_SPRITES.

   Стилистика: тёмное фэнтези, минимум тяжёлых операций.
   ============================================================ */

(function() {
  /* Утилита: генерация спрайта с кэшированием */
  function _makeSprite(id, size, drawFn) {
    const c = _createSpriteCanvas(size);
    const ctx = c.getContext('2d');
    drawFn(ctx, size);
    ENEMY_SPRITES[id] = c;
  }

  /* Утилита: ромб */
  function _diamond(ctx, cx, cy, w, h, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - h / 2);
    ctx.lineTo(cx + w / 2, cy);
    ctx.lineTo(cx, cy + h / 2);
    ctx.lineTo(cx - w / 2, cy);
    ctx.closePath();
    ctx.fill();
  }

  /* Утилита: треугольник */
  function _triangle(ctx, cx, cy, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - size * 0.5);
    ctx.lineTo(cx + size * 0.45, cy + size * 0.4);
    ctx.lineTo(cx - size * 0.45, cy + size * 0.4);
    ctx.closePath();
    ctx.fill();
  }

  /* Утилита: глаза (2 точки) */
  function _eyes(ctx, cx, cy, spacing, size, color) {
    ctx.fillStyle = color || '#ff0000';
    ctx.fillRect(cx - spacing, cy, size, size);
    ctx.fillRect(cx + spacing - size, cy, size, size);
  }


  /* ==========================================================
     ТИР 1 — спрайты
     ========================================================== */

  _makeSprite('plague_rat', 24, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradEllipse(ctx, cx, cy, 8, 5, '#6b5020', '#3a2a10');
    _eyes(ctx, cx, cy-2, 3, 2, '#ff4444');
    // Хвост
    ctx.strokeStyle = '#4a3a1a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx+7, cy); ctx.quadraticCurveTo(cx+10, cy-3, cx+11, cy+2);
    ctx.stroke();
  });

  _makeSprite('mushroom_sprite', 24, function(ctx, s) {
    const cx = s/2, cy = s/2;
    // Шляпка гриба
    _gradCircle(ctx, cx, cy-2, 6, '#aa7744', '#5a3a20');
    // Ножка
    _rect(ctx, cx-2, cy+2, 4, 5, '#c9a060');
    // Споры (точки)
    ctx.fillStyle = '#ffdd88';
    ctx.fillRect(cx-3, cy-4, 1, 1);
    ctx.fillRect(cx+2, cy-3, 1, 1);
    ctx.fillRect(cx, cy-5, 1, 1);
  });

  _makeSprite('bone_crawler', 24, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradEllipse(ctx, cx, cy, 9, 5, '#f0e8d8', '#a09080');
    // Сегменты
    ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(cx+i*3, cy-4); ctx.lineTo(cx+i*3, cy+4); ctx.stroke();
    }
    _eyes(ctx, cx, cy-1, 2, 1, '#cc0000');
  });

  _makeSprite('wisp_minor', 24, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _glow(ctx, cx, cy, 10, '#ffdd44', 0.4);
    _gradCircle(ctx, cx, cy, 5, '#ffffff', '#ffdd44');
  });

  _makeSprite('carrion_beetle', 24, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradEllipse(ctx, cx, cy, 8, 5, '#4a7a4a', '#1a3a1a');
    // Панцирь — линия по центру
    ctx.strokeStyle = '#66aa66'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy-5); ctx.lineTo(cx, cy+5); ctx.stroke();
    // Лапки
    ctx.strokeStyle = '#2a4a2a'; ctx.lineWidth = 0.5;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath(); ctx.moveTo(cx-7, cy+i*3); ctx.lineTo(cx-9, cy+i*3-1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx+7, cy+i*3); ctx.lineTo(cx+9, cy+i*3-1); ctx.stroke();
    }
  });

  _makeSprite('mud_imp', 24, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _triangle(ctx, cx, cy, 14, '#6b4a2a');
    _eyes(ctx, cx, cy-1, 3, 2, '#ffaa00');
    // Рожки
    ctx.fillStyle = '#4a3020';
    ctx.fillRect(cx-4, cy-7, 2, 3);
    ctx.fillRect(cx+2, cy-7, 2, 3);
  });

  _makeSprite('spirit_wisp', 24, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _glow(ctx, cx, cy, 9, '#aaccff', 0.3);
    _gradCircle(ctx, cx, cy, 5, '#ffffff', '#88aaff');
    // Хвост-шлейф
    ctx.globalAlpha = 0.4;
    _gradCircle(ctx, cx, cy+4, 3, '#88aaff', 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1;
  });

  _makeSprite('vine_creeper', 24, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradEllipse(ctx, cx, cy, 9, 6, '#4a8a4a', '#1a4a1a');
    // Лозы
    ctx.strokeStyle = '#2a6b2a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx-8, cy-2); ctx.quadraticCurveTo(cx-10, cy-6, cx-7, cy-7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+8, cy-2); ctx.quadraticCurveTo(cx+10, cy-6, cx+7, cy-7); ctx.stroke();
    // Листики
    ctx.fillStyle = '#80cc80';
    ctx.fillRect(cx-8, cy-7, 2, 2);
    ctx.fillRect(cx+6, cy-7, 2, 2);
  });


  /* ==========================================================
     ТИР 2 — спрайты
     ========================================================== */

  _makeSprite('necro_acolyte', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-5, cy-7, 10, 14, '#2a2a4a', '#1a1a2a');
    // Капюшон
    _gradCircle(ctx, cx, cy-5, 5, '#333355', '#1a1a2a');
    _eyes(ctx, cx, cy-5, 2, 1, '#8040c0');
    // Посох
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(cx+5, cy-6, 2, 12);
    ctx.fillStyle = '#8040c0'; ctx.fillRect(cx+4, cy-7, 4, 2);
  });

  _makeSprite('sand_worm', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradEllipse(ctx, cx, cy, 11, 6, '#e8d080', '#8b6b30');
    // Сегменты
    ctx.strokeStyle = '#c9a84c'; ctx.lineWidth = 0.5;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath(); ctx.moveTo(cx+i*3, cy-5); ctx.lineTo(cx+i*3, cy+5); ctx.stroke();
    }
    // Пасть
    ctx.fillStyle = '#4a2020';
    ctx.beginPath(); ctx.arc(cx+10, cy, 3, 0, Math.PI*2); ctx.fill();
  });

  _makeSprite('toxic_toad', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradEllipse(ctx, cx, cy+1, 9, 7, '#6baa6b', '#2a6b2a');
    // Глаза (выпуклые)
    _gradCircle(ctx, cx-4, cy-4, 3, '#ffffff', '#88ff88');
    _gradCircle(ctx, cx+4, cy-4, 3, '#ffffff', '#88ff88');
    ctx.fillStyle = '#000'; ctx.fillRect(cx-4, cy-4, 1, 1); ctx.fillRect(cx+4, cy-4, 1, 1);
  });

  _makeSprite('chain_phantom', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _diamond(ctx, cx, cy, 18, 18, '#4a4a6a');
    _glow(ctx, cx, cy, 8, '#8888cc', 0.3);
    _eyes(ctx, cx, cy-2, 3, 2, '#aaaaff');
    // Цепи
    ctx.strokeStyle = '#666688'; ctx.lineWidth = 1;
    ctx.setLineDash([2,2]);
    ctx.beginPath(); ctx.moveTo(cx-8, cy+4); ctx.lineTo(cx-12, cy+8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+8, cy+4); ctx.lineTo(cx+12, cy+8); ctx.stroke();
    ctx.setLineDash([]);
  });

  _makeSprite('ember_moth', 24, function(ctx, s) {
    const cx = s/2, cy = s/2;
    // Крылья
    _diamond(ctx, cx-4, cy, 10, 8, '#cc6600');
    _diamond(ctx, cx+4, cy, 10, 8, '#cc6600');
    // Тело
    _gradEllipse(ctx, cx, cy, 3, 5, '#ffaa00', '#663300');
    _glow(ctx, cx, cy, 6, '#ff6600', 0.2);
  });

  _makeSprite('frozen_husk', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-7, cy-7, 14, 14, '#aaddee', '#6699bb');
    // Ледяные кристаллы
    ctx.fillStyle = '#cceeFF';
    ctx.fillRect(cx-2, cy-8, 4, 3);
    ctx.fillRect(cx-8, cy-2, 3, 4);
    ctx.fillRect(cx+5, cy-2, 3, 4);
    _eyes(ctx, cx, cy-2, 3, 2, '#4488cc');
  });

  _makeSprite('swarm_beetle', 16, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradCircle(ctx, cx, cy, 4, '#555555', '#222222');
    // Точки на панцире
    ctx.fillStyle = '#888'; ctx.fillRect(cx-1, cy-1, 1, 1); ctx.fillRect(cx+1, cy, 1, 1);
  });

  _makeSprite('mirror_wisp', 24, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _glow(ctx, cx, cy, 9, '#ccccff', 0.3);
    _gradCircle(ctx, cx, cy, 6, '#ffffff', '#aaaaff');
    // Зеркальный блик
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(cx-2, cy-4, 3, 2);
  });

  _makeSprite('root_shambler', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-7, cy-7, 14, 14, '#6a8a4a', '#3a5a2a');
    // Корни
    ctx.strokeStyle = '#4a6a3a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(cx-6, cy+6); ctx.lineTo(cx-8, cy+10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+6, cy+6); ctx.lineTo(cx+8, cy+10); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy+7); ctx.lineTo(cx, cy+11); ctx.stroke();
    _eyes(ctx, cx, cy-2, 3, 2, '#aaffaa');
  });

  _makeSprite('plaguebearer', 32, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-8, cy-8, 16, 16, '#5a7a4a', '#2a4a2a');
    // Миазмы
    _glow(ctx, cx, cy, 12, '#88aa66', 0.2);
    _eyes(ctx, cx, cy-3, 3, 2, '#ccff88');
    // Гниль (точки)
    ctx.fillStyle = '#4a6a2a';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(cx + (i*4-8), cy + 3, 2, 2);
    }
  });


  /* ==========================================================
     ТИР 3 — спрайты
     ========================================================== */

  _makeSprite('clockwork_spider', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _diamond(ctx, cx, cy, 18, 18, '#8b8b00');
    // Шестерёнки (декор)
    ctx.strokeStyle = '#cccc44'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 2, 0, Math.PI*2); ctx.stroke();
    // Лапки-механизм
    for (let i = 0; i < 4; i++) {
      const a = (Math.PI/2) * i + Math.PI/4;
      ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*7, cy+Math.sin(a)*7);
      ctx.lineTo(cx+Math.cos(a)*11, cy+Math.sin(a)*11); ctx.stroke();
    }
  });

  _makeSprite('blood_ooze', 32, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradEllipse(ctx, cx, cy+2, 12, 7, '#cc2222', '#6b0000');
    _glow(ctx, cx, cy, 10, '#ff0000', 0.15);
    _eyes(ctx, cx, cy-1, 3, 2, '#ffaaaa');
  });

  _makeSprite('ash_wraith', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradEllipse(ctx, cx, cy, 9, 10, '#6a6a6a', '#2a2a2a');
    _glow(ctx, cx, cy, 11, '#555555', 0.2);
    _eyes(ctx, cx, cy-2, 3, 2, '#ffaa44');
    // Пепельный шлейф
    ctx.globalAlpha = 0.3;
    _gradCircle(ctx, cx, cy+6, 5, '#666', 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1;
  });

  _makeSprite('crystal_golem', 36, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-10, cy-10, 20, 20, '#88ccee', '#446688');
    // Кристаллы
    ctx.fillStyle = '#aaddff';
    ctx.beginPath(); ctx.moveTo(cx-4, cy-10); ctx.lineTo(cx, cy-14); ctx.lineTo(cx+4, cy-10); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx+8, cy-4); ctx.lineTo(cx+12, cy); ctx.lineTo(cx+8, cy+4); ctx.fill();
    // Свечение
    _glow(ctx, cx, cy, 12, '#88ccff', 0.15);
    _eyes(ctx, cx, cy-2, 4, 2, '#ffffff');
  });

  _makeSprite('nether_hound', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _diamond(ctx, cx, cy, 18, 18, '#440044');
    _glow(ctx, cx, cy, 10, '#9933ff', 0.2);
    _eyes(ctx, cx, cy-2, 3, 2, '#ff44ff');
    // Лапы
    ctx.fillStyle = '#330033';
    ctx.fillRect(cx-6, cy+6, 3, 3);
    ctx.fillRect(cx+3, cy+6, 3, 3);
  });

  _makeSprite('spore_carrier', 32, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradEllipse(ctx, cx, cy, 11, 7, '#8b6b30', '#4a3a10');
    // Споры сверху
    _gradCircle(ctx, cx-3, cy-5, 3, '#cc9944', '#6b4a00');
    _gradCircle(ctx, cx+3, cy-4, 2, '#cc9944', '#6b4a00');
    _gradCircle(ctx, cx, cy-6, 2, '#cc9944', '#6b4a00');
  });

  _makeSprite('gravity_aberration', 32, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _glow(ctx, cx, cy, 14, '#6600cc', 0.3);
    _gradCircle(ctx, cx, cy, 10, '#440088', '#1a0044');
    // Вихрь
    ctx.strokeStyle = '#9933ff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI*1.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, 4, Math.PI/2, Math.PI*2); ctx.stroke();
  });

  _makeSprite('corpse_detonator', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _triangle(ctx, cx, cy, 18, '#5a2a2a');
    _eyes(ctx, cx, cy-2, 3, 2, '#ff6644');
    // Фитиль
    ctx.strokeStyle = '#aa4444'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy-8); ctx.lineTo(cx+2, cy-11); ctx.stroke();
    ctx.fillStyle = '#ff8800'; ctx.fillRect(cx+1, cy-12, 2, 2);
  });

  _makeSprite('echo_shade', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    ctx.globalAlpha = 0.7;
    _gradRect(ctx, cx-7, cy-7, 14, 14, '#3333aa', '#1a1a44');
    ctx.globalAlpha = 1;
    _eyes(ctx, cx, cy-2, 3, 2, '#8888ff');
    // Тень позади
    ctx.globalAlpha = 0.3;
    _gradRect(ctx, cx-6, cy-5, 12, 12, '#2222aa', 'rgba(0,0,0,0)');
    ctx.globalAlpha = 1;
  });

  _makeSprite('magma_crab', 32, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradEllipse(ctx, cx, cy, 12, 7, '#ee6600', '#883300');
    // Клешни
    ctx.fillStyle = '#cc4400';
    ctx.fillRect(cx-12, cy-3, 4, 6);
    ctx.fillRect(cx+8, cy-3, 4, 6);
    // Раскалённые трещины
    ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx-4, cy-2); ctx.lineTo(cx+4, cy+2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-2, cy+2); ctx.lineTo(cx+3, cy-1); ctx.stroke();
    _glow(ctx, cx, cy, 8, '#ff6600', 0.15);
  });


  /* ==========================================================
     ТИР 4 — спрайты
     ========================================================== */

  _makeSprite('void_stalker', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-7, cy-7, 14, 14, '#220044', '#0d001a');
    _glow(ctx, cx, cy, 10, '#6633cc', 0.2);
    _eyes(ctx, cx, cy-2, 3, 2, '#aa66ff');
    // Когти
    ctx.fillStyle = '#4400aa';
    ctx.fillRect(cx-8, cy+3, 2, 4);
    ctx.fillRect(cx+6, cy+3, 2, 4);
  });

  _makeSprite('soul_collector', 32, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _diamond(ctx, cx, cy, 22, 22, '#3a0066');
    _glow(ctx, cx, cy, 12, '#aa44ff', 0.25);
    // Кристалл-ядро
    _gradCircle(ctx, cx, cy, 5, '#cc88ff', '#6600cc');
    // Души (мелкие точки)
    ctx.fillStyle = 'rgba(200,100,255,0.5)';
    ctx.fillRect(cx-7, cy-3, 2, 2);
    ctx.fillRect(cx+5, cy+2, 2, 2);
    ctx.fillRect(cx-2, cy+6, 2, 2);
  });

  _makeSprite('plague_golem', 40, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-12, cy-12, 24, 24, '#5a8a5a', '#2a4a2a');
    // Мухи-щит
    ctx.fillStyle = '#333';
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI*2/6)*i;
      ctx.fillRect(cx+Math.cos(a)*10, cy+Math.sin(a)*10, 2, 2);
    }
    _eyes(ctx, cx, cy-4, 4, 3, '#88cc88');
    // Трещины
    ctx.strokeStyle = '#3a6a3a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx-6, cy+2); ctx.lineTo(cx+2, cy+8); ctx.stroke();
  });

  _makeSprite('thunder_elemental', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _diamond(ctx, cx, cy, 20, 20, '#dddd00');
    _glow(ctx, cx, cy, 12, '#ffff44', 0.3);
    // Молнии
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy-8); ctx.lineTo(cx+2, cy-3);
    ctx.lineTo(cx-1, cy-3); ctx.lineTo(cx+1, cy+2); ctx.stroke();
    _eyes(ctx, cx, cy, 3, 2, '#ffffff');
  });

  _makeSprite('bone_hydra_enemy', 40, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradEllipse(ctx, cx, cy+3, 14, 8, '#e8dcc8', '#a09070');
    // 3 головы (черепа)
    for (let i = -1; i <= 1; i++) {
      _gradCircle(ctx, cx+i*8, cy-6, 4, '#ffffff', '#c0b0a0');
      ctx.fillStyle = '#330000';
      ctx.fillRect(cx+i*8-1, cy-7, 1, 1);
      ctx.fillRect(cx+i*8+1, cy-7, 1, 1);
    }
  });

  _makeSprite('dream_weaver', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradCircle(ctx, cx, cy, 9, '#8866cc', '#442266');
    _glow(ctx, cx, cy, 11, '#cc88ff', 0.2);
    // Третий глаз
    _gradCircle(ctx, cx, cy-3, 3, '#ffffff', '#cc88ff');
    ctx.fillStyle = '#330066'; ctx.fillRect(cx, cy-3, 1, 1);
    // Мерцающие нити
    ctx.strokeStyle = 'rgba(200,130,255,0.4)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx-8, cy+3); ctx.lineTo(cx+8, cy-3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-6, cy-5); ctx.lineTo(cx+6, cy+5); ctx.stroke();
  });

  _makeSprite('rust_hulk', 44, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-14, cy-14, 28, 28, '#aa7700', '#5a3a00');
    // Ржавые пятна
    ctx.fillStyle = '#cc8800';
    ctx.fillRect(cx-8, cy-6, 4, 4);
    ctx.fillRect(cx+4, cy+2, 5, 3);
    ctx.fillRect(cx-3, cy+6, 3, 4);
    _eyes(ctx, cx, cy-5, 4, 3, '#ff9933');
  });

  _makeSprite('parasite_host', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradEllipse(ctx, cx, cy, 9, 6, '#7a3a7a', '#3a1a3a');
    // Паразит сверху (маленький пузырь)
    _gradCircle(ctx, cx+2, cy-4, 3, '#cc66cc', '#6b2a6b');
    _eyes(ctx, cx, cy-1, 3, 1, '#ff88ff');
  });

  _makeSprite('hex_weaver', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _triangle(ctx, cx, cy, 20, '#440088');
    _glow(ctx, cx, cy, 10, '#9933ff', 0.2);
    // Руны
    ctx.strokeStyle = '#cc66ff'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI*2); ctx.stroke();
    _eyes(ctx, cx, cy-2, 3, 2, '#ff99ff');
  });

  _makeSprite('temporal_beetle', 28, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradCircle(ctx, cx, cy, 10, '#1a6688', '#003344');
    // Часовые стрелки
    ctx.strokeStyle = '#00ccff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx+4, cy-4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx-2, cy+5); ctx.stroke();
    // Обод
    ctx.strokeStyle = '#0088cc'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(cx, cy, 8, 0, Math.PI*2); ctx.stroke();
  });


  /* ==========================================================
     ТИР 5 — спрайты
     ========================================================== */

  _makeSprite('entropy_golem', 44, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-14, cy-14, 28, 28, '#550088', '#1a0033');
    _glow(ctx, cx, cy, 16, '#aa33ff', 0.2);
    // Трещины хаоса
    ctx.strokeStyle = '#cc66ff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx-8, cy-8); ctx.lineTo(cx+4, cy+4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+6, cy-6); ctx.lineTo(cx-4, cy+8); ctx.stroke();
    _eyes(ctx, cx, cy-4, 5, 3, '#ff66ff');
  });

  _makeSprite('soul_furnace', 40, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-12, cy-12, 24, 24, '#6b3300', '#331a00');
    // Печь (огонь внутри)
    _gradCircle(ctx, cx, cy, 6, '#ff8800', '#cc4400');
    _glow(ctx, cx, cy, 10, '#ff6600', 0.25);
    // Решётка
    ctx.strokeStyle = '#222'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx-4, cy-3); ctx.lineTo(cx-4, cy+3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy-3); ctx.lineTo(cx, cy+3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+4, cy-3); ctx.lineTo(cx+4, cy+3); ctx.stroke();
  });

  _makeSprite('void_leviathan', 48, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradEllipse(ctx, cx, cy, 18, 10, '#220066', '#0d0033');
    _glow(ctx, cx, cy, 16, '#4400aa', 0.2);
    // Глаза — множество
    ctx.fillStyle = '#aa66ff';
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(cx+i*5, cy-3, 2, 2);
    }
    // Щупальца
    ctx.strokeStyle = '#6600cc'; ctx.lineWidth = 1;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath(); ctx.moveTo(cx+i*5, cy+8);
      ctx.quadraticCurveTo(cx+i*5+2, cy+13, cx+i*5-1, cy+15); ctx.stroke();
    }
  });

  _makeSprite('plague_knight', 38, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-11, cy-11, 22, 22, '#2a4a2a', '#1a2a1a');
    // Шлем
    _gradRect(ctx, cx-6, cy-12, 12, 6, '#3a5a3a', '#1a3a1a');
    _eyes(ctx, cx, cy-9, 3, 2, '#66ff66');
    // Меч
    ctx.fillStyle = '#44aa44'; ctx.fillRect(cx+9, cy-8, 2, 16);
    ctx.fillStyle = '#88ff88'; ctx.fillRect(cx+8, cy-9, 4, 2);
    // Чумная аура
    _glow(ctx, cx, cy, 14, '#44aa44', 0.12);
  });

  _makeSprite('hive_queen', 38, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradEllipse(ctx, cx, cy+2, 14, 10, '#8b8b00', '#4a4a00');
    // Корона
    ctx.fillStyle = '#cccc44';
    ctx.fillRect(cx-5, cy-9, 2, 3);
    ctx.fillRect(cx-1, cy-10, 2, 4);
    ctx.fillRect(cx+3, cy-9, 2, 3);
    _eyes(ctx, cx, cy-2, 4, 2, '#ffff00');
    // Крылья
    ctx.globalAlpha = 0.4;
    _gradEllipse(ctx, cx-8, cy-2, 5, 8, '#aaaa44', '#666600');
    _gradEllipse(ctx, cx+8, cy-2, 5, 8, '#aaaa44', '#666600');
    ctx.globalAlpha = 1;
  });

  _makeSprite('chaos_chimera', 40, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-12, cy-9, 24, 18, '#aa00aa', '#440044');
    // 3 головы разных цветов
    _gradCircle(ctx, cx-7, cy-8, 4, '#ff4400', '#882200');
    _gradCircle(ctx, cx, cy-9, 4, '#4488ff', '#224488');
    _gradCircle(ctx, cx+7, cy-8, 4, '#44ff44', '#228822');
    _glow(ctx, cx, cy, 12, '#ff00ff', 0.15);
  });

  _makeSprite('obelisk_guardian', 36, function(ctx, s) {
    const cx = s/2, cy = s/2;
    // Обелиск (вертикальный прямоугольник)
    _gradRect(ctx, cx-8, cy-16, 16, 32, '#6a6a8a', '#3a3a5a');
    // Глаз-кристалл
    _gradCircle(ctx, cx, cy-4, 4, '#ffffff', '#8888cc');
    ctx.fillStyle = '#4444aa'; ctx.fillRect(cx, cy-4, 1, 1);
    // Руны
    ctx.strokeStyle = '#aaaaff'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx-4, cy+4); ctx.lineTo(cx+4, cy+4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-3, cy+7); ctx.lineTo(cx+3, cy+7); ctx.stroke();
    _glow(ctx, cx, cy-4, 8, '#8888ff', 0.2);
  });

  _makeSprite('shadow_prince', 32, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-9, cy-9, 18, 18, '#1a1a3a', '#0a0a1a');
    _glow(ctx, cx, cy, 12, '#4444aa', 0.2);
    // Корона
    ctx.fillStyle = '#6666cc';
    ctx.fillRect(cx-4, cy-11, 2, 3);
    ctx.fillRect(cx-1, cy-12, 2, 4);
    ctx.fillRect(cx+2, cy-11, 2, 3);
    _eyes(ctx, cx, cy-3, 3, 2, '#8888ff');
  });

  _makeSprite('abyssal_maw', 44, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradCircle(ctx, cx, cy, 16, '#330044', '#0d0016');
    _glow(ctx, cx, cy, 18, '#660066', 0.2);
    // Пасть (круг тёмный)
    _gradCircle(ctx, cx, cy, 8, '#000000', '#1a0022');
    // Зубы
    ctx.fillStyle = '#cc88ff';
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI*2/8)*i;
      ctx.fillRect(cx+Math.cos(a)*7, cy+Math.sin(a)*7, 2, 2);
    }
  });

  _makeSprite('living_dungeon', 48, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-16, cy-16, 32, 32, '#5a5a5a', '#2a2a2a');
    // Камни / кирпичная кладка
    ctx.strokeStyle = '#444'; ctx.lineWidth = 0.5;
    for (let y2 = -12; y2 <= 12; y2 += 8) {
      ctx.beginPath(); ctx.moveTo(cx-14, cy+y2); ctx.lineTo(cx+14, cy+y2); ctx.stroke();
    }
    for (let x2 = -12; x2 <= 12; x2 += 8) {
      ctx.beginPath(); ctx.moveTo(cx+x2, cy-14); ctx.lineTo(cx+x2, cy+14); ctx.stroke();
    }
    // Глаз в стене
    _gradCircle(ctx, cx, cy, 4, '#ff8844', '#884422');
    ctx.fillStyle = '#000'; ctx.fillRect(cx, cy, 1, 1);
  });


  /* ==========================================================
     ОСОБЫЕ — спрайты
     ========================================================== */

  _makeSprite('doom_herald', 32, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _diamond(ctx, cx, cy, 24, 24, '#880000');
    _glow(ctx, cx, cy, 14, '#ff0000', 0.3);
    // Символ рока (!)
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px monospace'; ctx.textAlign = 'center';
    ctx.fillText('!', cx, cy+4);
    // Крылья демонические
    ctx.fillStyle = '#440000';
    ctx.beginPath(); ctx.moveTo(cx-10, cy-2); ctx.lineTo(cx-14, cy-8); ctx.lineTo(cx-6, cy-4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx+10, cy-2); ctx.lineTo(cx+14, cy-8); ctx.lineTo(cx+6, cy-4); ctx.fill();
  });

  _makeSprite('treasure_golem', 36, function(ctx, s) {
    const cx = s/2, cy = s/2;
    _gradRect(ctx, cx-11, cy-11, 22, 22, '#ffd700', '#cc9900');
    _glow(ctx, cx, cy, 14, '#ffdd44', 0.25);
    // Монеты/блеск
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx-4, cy-6, 2, 2);
    ctx.fillRect(cx+3, cy-3, 2, 2);
    ctx.fillRect(cx-2, cy+3, 2, 2);
    // Символ $
    ctx.fillStyle = '#884400';
    ctx.font = '10px monospace'; ctx.textAlign = 'center';
    ctx.fillText('$', cx, cy+3);
  });

  /* ==========================================================
     БОССЫ — спрайты (крупные, детализированные)
     ========================================================== */

  _makeSprite('boss_web_architect', 64, function(ctx, s) {
    const cx = s/2, cy = s/2;
    // Тело (обсидиановый ромб)
    _diamond(ctx, cx, cy, 40, 40, '#2a2a4a');
    _glow(ctx, cx, cy, 24, '#8888ff', 0.15);
    // 8 лап с рунами
    ctx.strokeStyle = '#ccccff'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI*2/8)*i;
      const x1 = cx + Math.cos(a)*16, y1 = cy + Math.sin(a)*16;
      const x2 = cx + Math.cos(a)*28, y2 = cy + Math.sin(a)*28;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      // Руна на конце
      ctx.fillStyle = '#aaccff';
      ctx.fillRect(x2-1, y2-1, 3, 3);
    }
    // Глаза (множество)
    ctx.fillStyle = '#ff4444';
    for (let i = -2; i <= 2; i++) {
      ctx.fillRect(cx+i*4, cy-4, 2, 2);
    }
    // Серебряные детали
    ctx.strokeStyle = '#c0c0c0'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI*2); ctx.stroke();
  });

  _makeSprite('boss_storm_colossus', 72, function(ctx, s) {
    const cx = s/2, cy = s/2;
    // Тело (грозовые тучи)
    _gradRect(ctx, cx-20, cy-24, 40, 48, '#4a6688', '#1a2a44');
    _glow(ctx, cx, cy, 30, '#88ccff', 0.15);
    // Ядро (светящееся)
    _gradCircle(ctx, cx, cy-4, 8, '#ffffff', '#88ccff');
    _glow(ctx, cx, cy-4, 12, '#aaddff', 0.3);
    // Молнии на теле
    ctx.strokeStyle = '#ffff88'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx-10, cy-15); ctx.lineTo(cx-7, cy-8);
    ctx.lineTo(cx-12, cy-8); ctx.lineTo(cx-8, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+10, cy-12); ctx.lineTo(cx+8, cy-5);
    ctx.lineTo(cx+12, cy-5); ctx.lineTo(cx+9, cy+3); ctx.stroke();
    // Руки
    ctx.fillStyle = '#334466';
    ctx.fillRect(cx-24, cy-8, 8, 16);
    ctx.fillRect(cx+16, cy-8, 8, 16);
    _eyes(ctx, cx, cy-14, 5, 3, '#ffffff');
  });


  _makeSprite('boss_puzzle_sphinx', 64, function(ctx, s) {
    const cx = s/2, cy = s/2;
    // Тело (прямоугольный камень)
    _gradRect(ctx, cx-18, cy-14, 36, 30, '#c9a84c', '#8b7030');
    // Голова сфинкса
    _gradRect(ctx, cx-10, cy-22, 20, 12, '#dab860', '#a08030');
    // Глаза-самоцветы
    _gradCircle(ctx, cx-5, cy-17, 3, '#ff4444', '#880000');
    _gradCircle(ctx, cx+5, cy-17, 3, '#44ff44', '#008800');
    // Иероглифы на теле
    ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx-10, cy-4); ctx.lineTo(cx-4, cy-4);
    ctx.lineTo(cx-4, cy+4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx+4, cy-4); ctx.lineTo(cx+10, cy-4);
    ctx.lineTo(cx+7, cy+4); ctx.stroke();
    // Корона
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(cx-8, cy-24, 3, 3);
    ctx.fillRect(cx-2, cy-25, 4, 4);
    ctx.fillRect(cx+5, cy-24, 3, 3);
    // Лапы
    ctx.fillStyle = '#a08030';
    ctx.fillRect(cx-16, cy+10, 8, 6);
    ctx.fillRect(cx+8, cy+10, 8, 6);
  });

  _makeSprite('boss_bone_hydra', 72, function(ctx, s) {
    const cx = s/2, cy = s/2;
    // Тело (массивное овальное)
    _gradEllipse(ctx, cx, cy+6, 26, 16, '#e8dcc8', '#8b7b60');
    // 5 голов-шей
    const headColors = ['#ff4400', '#4488ff', '#44cc44', '#ffff00', '#9933ff'];
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI/2 + (i-2) * 0.5;
      const hx = cx + Math.cos(ang) * 20;
      const hy = cy - 8 + Math.sin(ang) * 12;
      // Шея
      ctx.strokeStyle = '#c0b0a0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx + (i-2)*5, cy-4); ctx.lineTo(hx, hy); ctx.stroke();
      // Голова (череп с цветной подсветкой)
      _gradCircle(ctx, hx, hy, 5, '#ffffff', '#c0b0a0');
      _glow(ctx, hx, hy, 6, headColors[i], 0.3);
      // Глаза
      ctx.fillStyle = headColors[i];
      ctx.fillRect(hx-2, hy-1, 1, 1);
      ctx.fillRect(hx+1, hy-1, 1, 1);
    }
    // Позвоночник
    ctx.strokeStyle = '#a09080'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy-4); ctx.lineTo(cx, cy+16); ctx.stroke();
  });

  _makeSprite('boss_mirror_king', 56, function(ctx, s) {
    const cx = s/2, cy = s/2;
    // Тело (рыцарь в зеркальных доспехах)
    _gradRect(ctx, cx-14, cy-16, 28, 32, '#d0d0d0', '#808080');
    // Зеркальные блики
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(cx-8, cy-10, 4, 6);
    ctx.fillRect(cx+4, cy-4, 5, 4);
    ctx.fillRect(cx-6, cy+6, 3, 5);
    // Шлем
    _gradRect(ctx, cx-8, cy-20, 16, 8, '#e0e0e0', '#a0a0a0');
    // Глаза
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(cx-4, cy-17, 2, 2);
    ctx.fillRect(cx+2, cy-17, 2, 2);
    // Корона (расколотая)
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(cx-6, cy-23, 2, 4);
    ctx.fillRect(cx-1, cy-24, 2, 5);
    ctx.fillRect(cx+4, cy-23, 2, 4);
    // Трещина в короне
    ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx, cy-24); ctx.lineTo(cx+1, cy-20); ctx.stroke();
    // Меч
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(cx+14, cy-14, 3, 24);
    ctx.fillStyle = '#ffd700';
    ctx.fillRect(cx+12, cy-2, 7, 3);
    // Свечение зеркальное
    _glow(ctx, cx, cy, 20, '#ffffff', 0.1);
  });


  /* ==========================================================
     Инициализация — вызывается после initSprites()
     ========================================================== */
  window._initExpansionSprites = function() {
    // Все спрайты уже сгенерированы при загрузке IIFE выше
    // Эта функция — placeholder для совместимости
  };

  // Если initSprites уже вызван — спрайты уже в ENEMY_SPRITES
  // Если нет — они будут доступны сразу (IIFE выполняется при загрузке)

})(); // конец IIFE
'use strict';
/* ============================================================
   sprites_step12.js — Спрайты для врагов из constants_step12.js,
   у которых отсутствуют визуальные дизайны.
   Загружается ПОСЛЕ sprites.js.
   Стилистика: dark fantasy, контрастные цвета, объёмность.
   ============================================================ */

(function() {

function _makeSprite(id, size, drawFn) {
  const c = _createSpriteCanvas(size);
  const ctx = c.getContext('2d');
  drawFn(ctx, size);
  _addOutline(ctx, size, '#000000');
  ENEMY_SPRITES[id] = c;
  if (!SPRITE_DISPLAY_SIZES[id]) {
    SPRITE_DISPLAY_SIZES[id] = size * 2;
  }
}


/* ==========================================================
   ТИР 3 — Опасные
   ========================================================== */

_makeSprite('bone_golem', 16, function(ctx) {
  // Костяной голем: массивная фигура из сплетённых костей
  _gradRect(ctx, 5, 3, 6, 9, '#f0e8d8', '#c8b8a0');
  _rect(ctx, 4, 5, 8, 6, '#d8d0c0');
  // Рёбра/трещины
  _hline(ctx, 5, 5, 6, '#a89878');
  _hline(ctx, 5, 7, 6, '#a89878');
  _hline(ctx, 5, 9, 6, '#a89878');
  // Голова (череп-маска)
  _gradRect(ctx, 6, 1, 4, 3, '#fff8e8', '#e8dcc8');
  _px(ctx, 7, 2, '#44ff88'); _px(ctx, 9, 2, '#44ff88');
  // Костяные шипы на плечах
  _px(ctx, 3, 4, '#f0e8d8'); _px(ctx, 12, 4, '#f0e8d8');
  _px(ctx, 3, 3, '#e0d8c8'); _px(ctx, 12, 3, '#e0d8c8');
  // Ноги (массивные кости)
  _rect(ctx, 6, 12, 2, 3, '#d8c8b0');
  _rect(ctx, 9, 12, 2, 3, '#d8c8b0');
});

_makeSprite('phase_spider', 16, function(ctx) {
  // Фазовый паук: полупрозрачный синий, мерцающий
  ctx.globalAlpha = 0.85;
  _gradRect(ctx, 5, 6, 6, 4, '#6699ff', '#3355cc');
  _gradRect(ctx, 6, 5, 4, 6, '#5588ee', '#2244aa');
  ctx.globalAlpha = 1;
  // Глаза (яркие белые)
  _px(ctx, 7, 6, '#ffffff'); _px(ctx, 9, 6, '#ffffff');
  // Ноги (полупрозрачные)
  ctx.globalAlpha = 0.7;
  _px(ctx, 4, 5, '#88aaff'); _px(ctx, 3, 4, '#77aaff');
  _px(ctx, 4, 8, '#88aaff'); _px(ctx, 3, 9, '#77aaff');
  _px(ctx, 12, 5, '#88aaff'); _px(ctx, 13, 4, '#77aaff');
  _px(ctx, 12, 8, '#88aaff'); _px(ctx, 13, 9, '#77aaff');
  ctx.globalAlpha = 1;
  // Свечение при телепорте
  _glow(ctx, 8, 8, 4, '#4488ff', 0.3);
});


_makeSprite('ettercap', 16, function(ctx) {
  // Эттеркап: зелёный паукообразный гуманоид с паутиной
  _gradRect(ctx, 5, 4, 6, 6, '#4a9a4a', '#2a6a2a');
  _gradRect(ctx, 6, 2, 4, 3, '#3a8a3a', '#1a5a1a');
  // Глаза (красные, множественные)
  _px(ctx, 7, 3, '#ff4444'); _px(ctx, 9, 3, '#ff4444');
  _px(ctx, 7, 2, '#cc2222'); _px(ctx, 9, 2, '#cc2222');
  // Паутина в руках
  _px(ctx, 3, 5, '#ccc'); _px(ctx, 2, 4, '#aaa');
  _px(ctx, 12, 5, '#ccc'); _px(ctx, 13, 4, '#aaa');
  _px(ctx, 2, 6, '#ddd'); _px(ctx, 13, 6, '#ddd');
  // Ноги
  _px(ctx, 5, 10, '#2a5a1a'); _px(ctx, 4, 11, '#1a4a0a');
  _px(ctx, 10, 10, '#2a5a1a'); _px(ctx, 11, 11, '#1a4a0a');
});

_makeSprite('fungal_man', 16, function(ctx) {
  // Грибной человек: огромная пятнистая шляпка, споры
  _gradRect(ctx, 4, 1, 8, 5, '#a0703a', '#6a4a2a');
  _rect(ctx, 3, 3, 10, 2, '#8a5a3a');
  // Пятна на шляпке
  _px(ctx, 5, 2, '#cc9960'); _px(ctx, 8, 3, '#cc9960');
  _px(ctx, 10, 2, '#bb8844');
  // Ножка (тело)
  _gradRect(ctx, 6, 6, 4, 6, '#e8dcc0', '#c8b8a0');
  _rect(ctx, 5, 7, 6, 4, '#d8c8a8');
  // Глаза
  _px(ctx, 7, 8, '#222'); _px(ctx, 9, 8, '#222');
  // Споры (мерцающие частицы)
  _px(ctx, 3, 5, '#e0ff80'); _px(ctx, 12, 4, '#d0ee70');
  _px(ctx, 2, 7, '#c0dd60'); _px(ctx, 13, 8, '#e0ff80');
});

_makeSprite('pterodactyl', 16, function(ctx) {
  // Птеродактиль: серый летающий ящер с острым клювом
  _gradRect(ctx, 6, 6, 4, 4, '#a0a0a0', '#707070');
  // Крылья (широкие перепончатые)
  _gradRect(ctx, 1, 5, 5, 3, '#999', '#666');
  _gradRect(ctx, 10, 5, 5, 3, '#999', '#666');
  _px(ctx, 0, 5, '#888'); _px(ctx, 15, 5, '#888');
  // Голова и клюв
  _gradRect(ctx, 7, 3, 3, 3, '#b0b0b0', '#808080');
  _px(ctx, 10, 4, '#666'); _px(ctx, 11, 4, '#555'); // клюв
  // Глаза
  _px(ctx, 8, 4, '#ff8800');
  // Гребень
  _px(ctx, 7, 2, '#cc4444'); _px(ctx, 8, 1, '#aa3333');
});


_makeSprite('giant_scorpion', 16, function(ctx) {
  // Скорпион-гигант: золотистый с ядовитым хвостом
  _gradRect(ctx, 4, 8, 8, 4, '#d4a030', '#a07820');
  _rect(ctx, 5, 7, 6, 1, '#c89428');
  // Клешни
  _rect(ctx, 1, 6, 3, 3, '#c89428');
  _px(ctx, 0, 6, '#ddb840'); _px(ctx, 0, 8, '#ddb840');
  _rect(ctx, 12, 6, 3, 3, '#c89428');
  _px(ctx, 15, 6, '#ddb840'); _px(ctx, 15, 8, '#ddb840');
  // Хвост (изогнутый вверх)
  _px(ctx, 8, 12, '#a07820'); _px(ctx, 9, 13, '#b08830');
  _px(ctx, 10, 13, '#c09838'); _px(ctx, 11, 12, '#d0a840');
  _px(ctx, 12, 11, '#c09838');
  // Жало (красное)
  _px(ctx, 12, 10, '#ff2200');
  _glow(ctx, 12, 10, 2, '#ff4400', 0.4);
  // Глаза
  _px(ctx, 6, 7, '#111'); _px(ctx, 9, 7, '#111');
});

/* ==========================================================
   ТИР 4 — Серьёзные угрозы
   ========================================================== */

_makeSprite('dragon_wyrm', 16, function(ctx) {
  // Дракон-вирм: длинный змееподобный, красный
  _gradRect(ctx, 3, 7, 10, 3, '#dd3333', '#991111');
  _gradRect(ctx, 2, 8, 12, 2, '#cc2222', '#880000');
  // Голова
  _gradRect(ctx, 11, 6, 4, 4, '#ee4444', '#aa2222');
  _px(ctx, 14, 7, '#ffcc00'); // глаз
  _px(ctx, 15, 8, '#ff8800'); // пасть
  // Крылья (маленькие)
  _px(ctx, 6, 5, '#bb2222'); _px(ctx, 7, 4, '#aa1111');
  _px(ctx, 9, 5, '#bb2222'); _px(ctx, 10, 4, '#aa1111');
  // Шипы на спине
  _px(ctx, 4, 6, '#ff6666'); _px(ctx, 7, 6, '#ff6666');
  _px(ctx, 10, 5, '#ff6666');
  // Хвост
  _px(ctx, 1, 8, '#880000'); _px(ctx, 0, 9, '#660000');
});

_makeSprite('water_elem_large', 16, function(ctx) {
  // Элементаль воды (большой): мощный водяной вихрь
  ctx.globalAlpha = 0.85;
  _gradRect(ctx, 4, 3, 8, 10, '#66aaee', '#2266aa');
  _gradRect(ctx, 3, 5, 10, 6, '#5599dd', '#1155aa');
  ctx.globalAlpha = 1;
  // Пузыри
  _px(ctx, 5, 5, '#aaddff'); _px(ctx, 9, 7, '#bbddff');
  _px(ctx, 6, 9, '#99ccee'); _px(ctx, 10, 4, '#aaddff');
  // Глаза (белые)
  _px(ctx, 6, 6, '#ffffff'); _px(ctx, 9, 6, '#ffffff');
  // Водные завитки
  _px(ctx, 3, 8, '#88ccff'); _px(ctx, 12, 7, '#88ccff');
  // Брызги сверху
  _px(ctx, 5, 2, '#77bbee'); _px(ctx, 8, 1, '#88ccff');
  _px(ctx, 10, 2, '#77bbee');
});


_makeSprite('doppelganger_mage', 16, function(ctx) {
  // Доппельгангер-маг: серо-синий, нестабильная форма + магия
  _gradRect(ctx, 6, 2, 4, 4, '#6688cc', '#4466aa');
  _gradRect(ctx, 5, 6, 6, 6, '#5577bb', '#3355aa');
  _vline(ctx, 5, 5, 5, '#4466aa'); _vline(ctx, 10, 5, 5, '#4466aa');
  // Нестабильный контур (фиолетовые искры)
  _px(ctx, 4, 3, '#aa44ff'); _px(ctx, 11, 3, '#aa44ff');
  _px(ctx, 4, 8, '#9933ee'); _px(ctx, 11, 8, '#9933ee');
  // Магический орб
  _px(ctx, 12, 5, '#ff88ff');
  _glow(ctx, 12, 5, 2, '#cc44ff', 0.4);
  // Безликая голова
  _px(ctx, 7, 3, '#eeeeff'); _px(ctx, 9, 3, '#eeeeff');
  // Ноги
  _vline(ctx, 7, 12, 3, '#3355aa'); _vline(ctx, 9, 12, 3, '#3355aa');
});

_makeSprite('owlbear', 16, function(ctx) {
  // Сова-медведь: массивный, пернатые ушки, клюв
  _gradRect(ctx, 4, 5, 8, 7, '#8b5a2b', '#5a3a1a');
  _rect(ctx, 5, 4, 6, 1, '#7a4a2a');
  // Голова (совиная)
  _gradRect(ctx, 6, 1, 4, 4, '#a07040', '#6a4a2a');
  // Уши-перья
  _px(ctx, 5, 0, '#8a5a2a'); _px(ctx, 10, 0, '#8a5a2a');
  _px(ctx, 5, 1, '#7a4a1a'); _px(ctx, 10, 1, '#7a4a1a');
  // Глаза (огромные жёлтые совиные)
  _px(ctx, 7, 2, '#ffdd00'); _px(ctx, 9, 2, '#ffdd00');
  _px(ctx, 7, 3, '#000'); _px(ctx, 9, 3, '#000'); // зрачки
  // Клюв
  _px(ctx, 8, 4, '#ffcc00');
  // Когти
  _px(ctx, 4, 12, '#444'); _px(ctx, 11, 12, '#444');
  // Перья на груди
  _px(ctx, 6, 6, '#c89060'); _px(ctx, 9, 7, '#c89060');
  // Лапы
  _rect(ctx, 5, 12, 2, 2, '#5a3a1a');
  _rect(ctx, 9, 12, 2, 2, '#5a3a1a');
});

/* ==========================================================
   ТИР 5 — Редкие
   ========================================================== */

_makeSprite('adult_dragon', 16, function(ctx) {
  // Взрослый дракон: огненно-красный с размахом крыльев
  _gradRect(ctx, 5, 6, 6, 6, '#dd2200', '#881100');
  _gradRect(ctx, 6, 4, 4, 3, '#cc2200', '#771100');
  // Крылья (большие)
  _gradRect(ctx, 1, 3, 4, 5, '#aa1100', '#660000');
  _gradRect(ctx, 11, 3, 4, 5, '#aa1100', '#660000');
  _px(ctx, 0, 3, '#cc3300'); _px(ctx, 15, 3, '#cc3300');
  // Голова
  _gradRect(ctx, 7, 2, 3, 3, '#ee3300', '#aa1100');
  _px(ctx, 7, 2, '#ffdd00'); _px(ctx, 9, 2, '#ffdd00'); // глаза
  _px(ctx, 7, 4, '#ff8800'); // пасть с огнём
  // Рога
  _px(ctx, 6, 1, '#ffd700'); _px(ctx, 10, 1, '#ffd700');
  // Хвост
  _px(ctx, 5, 12, '#881100'); _px(ctx, 4, 13, '#660000');
  _px(ctx, 3, 14, '#550000');
  // Огненное свечение
  _glow(ctx, 8, 7, 4, '#ff4400', 0.25);
});


_makeSprite('demon_destroyer', 16, function(ctx) {
  // Демон-разрушитель: массивный красный, хлыст, рога
  _gradRect(ctx, 4, 4, 8, 9, '#880000', '#440000');
  _rect(ctx, 3, 6, 10, 6, '#660000');
  // Голова
  _gradRect(ctx, 6, 1, 4, 4, '#aa1111', '#660000');
  // Рога (огромные)
  _px(ctx, 5, 0, '#333'); _px(ctx, 4, 0, '#222');
  _px(ctx, 10, 0, '#333'); _px(ctx, 11, 0, '#222');
  // Глаза (пылающие)
  _px(ctx, 7, 3, '#ffff00'); _px(ctx, 9, 3, '#ffff00');
  // Хлыст
  _px(ctx, 13, 5, '#ff4400'); _px(ctx, 14, 6, '#ff6600');
  _px(ctx, 15, 7, '#ff8800'); _px(ctx, 14, 8, '#ff4400');
  // Ноги (копыта)
  _rect(ctx, 5, 13, 2, 2, '#333');
  _rect(ctx, 9, 13, 2, 2, '#333');
  // Свечение
  _glow(ctx, 8, 7, 5, '#ff2200', 0.2);
});

_makeSprite('illithid_arcanist', 16, function(ctx) {
  // Иллитид-арканист: фиолетовый, щупальца, мощная аура
  _gradRect(ctx, 5, 4, 6, 8, '#7722cc', '#440088');
  // Голова (большая, фиолетовая)
  _gradRect(ctx, 5, 1, 6, 4, '#9944ee', '#6622bb');
  _rect(ctx, 6, 0, 4, 1, '#8833dd');
  // Глаза (белые светящиеся)
  _px(ctx, 7, 2, '#ffffff'); _px(ctx, 9, 2, '#ffffff');
  // Щупальца (нижняя часть лица)
  _px(ctx, 6, 4, '#8833dd'); _px(ctx, 7, 5, '#7722cc');
  _px(ctx, 8, 5, '#6622bb'); _px(ctx, 9, 4, '#8833dd');
  // Руки с магией
  _vline(ctx, 4, 5, 4, '#6622bb');
  _vline(ctx, 11, 5, 4, '#6622bb');
  _px(ctx, 3, 5, '#ff88ff'); _px(ctx, 12, 5, '#ff88ff');
  // Аура
  _glow(ctx, 8, 5, 5, '#9933ff', 0.25);
});

_makeSprite('golem_colossus', 16, function(ctx) {
  // Голем-колосс: массивный каменный монолит
  _gradRect(ctx, 3, 3, 10, 11, '#909090', '#505050');
  _rect(ctx, 4, 2, 8, 1, '#808080');
  _rect(ctx, 2, 5, 12, 8, '#606060');
  // Трещины (светящиеся жёлтым)
  _px(ctx, 5, 5, '#ffaa00'); _vline(ctx, 5, 5, 3, '#ff8800');
  _px(ctx, 10, 7, '#ffaa00'); _vline(ctx, 10, 7, 2, '#ff8800');
  _hline(ctx, 6, 9, 4, '#ff6600');
  // Глаза (оранжевые)
  _px(ctx, 6, 4, '#ff8800'); _px(ctx, 9, 4, '#ff8800');
  // Руки (огромные)
  _rect(ctx, 1, 5, 2, 6, '#707070');
  _rect(ctx, 13, 5, 2, 6, '#707070');
  // Мох на камне
  _px(ctx, 3, 10, '#4a8a2a'); _px(ctx, 12, 12, '#4a8a2a');
});


_makeSprite('shadow_dragon', 16, function(ctx) {
  // Тень дракона: чёрный с фиолетовым свечением
  ctx.globalAlpha = 0.9;
  _gradRect(ctx, 5, 5, 6, 6, '#333', '#0a0a0a');
  _gradRect(ctx, 6, 3, 4, 3, '#2a2a2a', '#050505');
  ctx.globalAlpha = 1;
  // Крылья (тёмные с фиолетовым)
  _gradRect(ctx, 1, 4, 4, 4, '#222', '#000');
  _gradRect(ctx, 11, 4, 4, 4, '#222', '#000');
  _px(ctx, 1, 4, '#6600aa'); _px(ctx, 14, 4, '#6600aa');
  // Глаза (фиолетовые)
  _px(ctx, 7, 4, '#cc44ff'); _px(ctx, 9, 4, '#cc44ff');
  // Тёмная аура
  _glow(ctx, 8, 7, 5, '#6600aa', 0.3);
  // Хвост
  _px(ctx, 5, 11, '#111'); _px(ctx, 4, 12, '#080808');
});

_makeSprite('slime_queen', 16, function(ctx) {
  // Королева слизней: огромная зелёная масса с короной
  _gradRect(ctx, 3, 5, 10, 8, '#44ee44', '#118811');
  _gradRect(ctx, 2, 7, 12, 5, '#33cc33', '#0a6a0a');
  _rect(ctx, 4, 4, 8, 1, '#33cc33');
  // Корона (золотая, утонувшая в слизи)
  _hline(ctx, 5, 4, 6, '#ffd700');
  _px(ctx, 5, 3, '#ffd700'); _px(ctx, 10, 3, '#ffd700');
  _px(ctx, 7, 3, '#ffee00');
  // Глаза (большие чёрные)
  _rect(ctx, 5, 7, 2, 2, '#002200');
  _rect(ctx, 9, 7, 2, 2, '#002200');
  // Пузыри
  _px(ctx, 4, 9, '#88ff88'); _px(ctx, 10, 8, '#77ee77');
  _px(ctx, 7, 11, '#99ff99');
  // Кислота под ней
  _hline(ctx, 2, 13, 12, '#44cc44');
});

_makeSprite('iron_golem', 16, function(ctx) {
  // Железный голем: тёмно-серый с молниевыми разрядами
  _gradRect(ctx, 4, 3, 8, 10, '#8090a0', '#506070');
  _rect(ctx, 3, 5, 10, 7, '#607080');
  // Голова
  _gradRect(ctx, 6, 1, 4, 3, '#90a0b0', '#607080');
  // Глаза (электрические)
  _px(ctx, 7, 2, '#44ddff'); _px(ctx, 9, 2, '#44ddff');
  // Заклёпки
  _px(ctx, 5, 5, '#b0c0d0'); _px(ctx, 10, 5, '#b0c0d0');
  _px(ctx, 5, 9, '#b0c0d0'); _px(ctx, 10, 9, '#b0c0d0');
  // Электрические разряды
  _px(ctx, 3, 4, '#88eeff'); _px(ctx, 12, 6, '#88eeff');
  _px(ctx, 2, 7, '#66ccdd');
  // Руки (тяжёлые)
  _rect(ctx, 2, 5, 2, 5, '#607080');
  _rect(ctx, 12, 5, 2, 5, '#607080');
});

_makeSprite('archdemon', 16, function(ctx) {
  // Архидемон: огромный красно-чёрный, пылающая корона
  _gradRect(ctx, 3, 4, 10, 10, '#770000', '#330000');
  _rect(ctx, 2, 6, 12, 7, '#550000');
  // Голова
  _gradRect(ctx, 5, 1, 6, 4, '#990000', '#550000');
  // Рога (пылающие)
  _px(ctx, 4, 0, '#ff4400'); _px(ctx, 3, 0, '#ff8800');
  _px(ctx, 11, 0, '#ff4400'); _px(ctx, 12, 0, '#ff8800');
  // Глаза (жёлтое пламя)
  _px(ctx, 6, 3, '#ffff00'); _px(ctx, 9, 3, '#ffff00');
  // Крылья (демонические)
  _px(ctx, 1, 4, '#440000'); _px(ctx, 0, 3, '#330000');
  _px(ctx, 14, 4, '#440000'); _px(ctx, 15, 3, '#330000');
  // Огненное кольцо (аура)
  _glow(ctx, 8, 7, 6, '#ff4400', 0.2);
  // Ноги
  _rect(ctx, 5, 14, 2, 2, '#222');
  _rect(ctx, 9, 14, 2, 2, '#222');
});

_makeSprite('star_spawn', 16, function(ctx) {
  // Звёздное отродье: фиолетово-чёрный, щупальца
  _gradRect(ctx, 5, 4, 6, 7, '#4a0066', '#1a0033');
  _gradRect(ctx, 4, 5, 8, 5, '#330055', '#0d001a');
  // Глаза (множество жёлтых)
  _px(ctx, 6, 5, '#ffdd00'); _px(ctx, 8, 6, '#ffdd00');
  _px(ctx, 10, 5, '#ffdd00'); _px(ctx, 7, 7, '#eecc00');
  // Щупальца
  _px(ctx, 4, 10, '#550088'); _px(ctx, 3, 11, '#440077');
  _px(ctx, 6, 11, '#550088'); _px(ctx, 5, 12, '#440077');
  _px(ctx, 9, 11, '#550088'); _px(ctx, 10, 12, '#440077');
  _px(ctx, 11, 10, '#550088'); _px(ctx, 12, 11, '#440077');
  // Псионическое свечение
  _glow(ctx, 8, 7, 4, '#9933ff', 0.3);
});


/* ==========================================================
   ТИР 6 — Легендарные
   ========================================================== */

_makeSprite('ancient_dragon', 16, function(ctx) {
  // Древний дракон: золотой с огненной аурой
  _gradRect(ctx, 4, 5, 8, 7, '#ffd700', '#b8860b');
  _gradRect(ctx, 5, 3, 6, 3, '#e8c400', '#a07800');
  // Крылья (величественные)
  _gradRect(ctx, 0, 3, 4, 5, '#daa520', '#8b6508');
  _gradRect(ctx, 12, 3, 4, 5, '#daa520', '#8b6508');
  // Голова
  _gradRect(ctx, 6, 1, 4, 3, '#ffe044', '#c8a000');
  // Глаза (красно-оранжевые)
  _px(ctx, 7, 2, '#ff4500'); _px(ctx, 9, 2, '#ff4500');
  // Рога (золотые)
  _px(ctx, 5, 0, '#ffd700'); _px(ctx, 10, 0, '#ffd700');
  // Огненное дыхание
  _px(ctx, 7, 4, '#ff6600'); _px(ctx, 6, 4, '#ff8800');
  // Аура
  _glow(ctx, 8, 6, 6, '#ffa500', 0.25);
  // Хвост
  _px(ctx, 4, 12, '#b8860b'); _px(ctx, 3, 13, '#8b6508');
});

_makeSprite('kraken_tentacle', 16, function(ctx) {
  // Щупальце кракена: тёмно-зелёное, извивающееся
  _gradRect(ctx, 6, 1, 4, 14, '#1a6633', '#0a3318');
  _rect(ctx, 5, 3, 6, 10, '#155528');
  // Присоски
  _px(ctx, 6, 4, '#33aa55'); _px(ctx, 6, 7, '#33aa55');
  _px(ctx, 6, 10, '#33aa55'); _px(ctx, 9, 5, '#33aa55');
  _px(ctx, 9, 8, '#33aa55'); _px(ctx, 9, 11, '#33aa55');
  // Кончик (утолщённый)
  _rect(ctx, 5, 1, 6, 2, '#0d4020');
  // Слизь
  _px(ctx, 4, 6, '#44cc66'); _px(ctx, 11, 9, '#44cc66');
});

_makeSprite('tarrasque_juv', 16, function(ctx) {
  // Ювенильный Терраска: коричнево-золотой бронированный
  _gradRect(ctx, 2, 3, 12, 11, '#8b5a13', '#5a3a08');
  _rect(ctx, 3, 2, 10, 1, '#7a4a10');
  // Панцирь (шипы)
  _px(ctx, 4, 1, '#daa520'); _px(ctx, 7, 0, '#daa520');
  _px(ctx, 10, 1, '#daa520'); _px(ctx, 12, 2, '#daa520');
  _px(ctx, 3, 4, '#c8940f'); _px(ctx, 12, 6, '#c8940f');
  // Глаза (маленькие, злые)
  _px(ctx, 6, 4, '#ff0000'); _px(ctx, 9, 4, '#ff0000');
  // Пасть (огромная)
  _rect(ctx, 5, 5, 6, 2, '#330000');
  _px(ctx, 5, 5, '#fff'); _px(ctx, 7, 5, '#fff');
  _px(ctx, 9, 5, '#fff'); _px(ctx, 10, 5, '#fff');
  // Лапы
  _rect(ctx, 2, 13, 3, 2, '#5a3a08');
  _rect(ctx, 11, 13, 3, 2, '#5a3a08');
});

_makeSprite('chaos_god', 16, function(ctx) {
  // Бог хаоса: мерцающий многоцветный, нестабильная форма
  _gradRect(ctx, 4, 3, 8, 10, '#cc00ff', '#6600aa');
  _rect(ctx, 5, 4, 6, 8, '#9900cc');
  // Мерцающие цвета (хаос)
  _px(ctx, 5, 4, '#00ffff'); _px(ctx, 9, 6, '#ff0000');
  _px(ctx, 6, 8, '#ffff00'); _px(ctx, 10, 10, '#00ff00');
  _px(ctx, 4, 7, '#ff8800'); _px(ctx, 11, 5, '#0088ff');
  // Глаза (все разные)
  _px(ctx, 6, 5, '#ffffff'); _px(ctx, 9, 5, '#ff00ff');
  _px(ctx, 8, 4, '#00ffff');
  // Лучи хаоса
  _px(ctx, 2, 3, '#ff00ff'); _px(ctx, 13, 4, '#00ffff');
  _px(ctx, 3, 10, '#ffff00'); _px(ctx, 12, 9, '#ff0000');
  // Нестабильная аура
  _glow(ctx, 8, 7, 5, '#cc00ff', 0.3);
});


_makeSprite('vampire_lord', 16, function(ctx) {
  // Лорд вампиров: элегантный тёмный плащ, красные глаза
  _gradRect(ctx, 5, 4, 6, 9, '#1a0000', '#0a0000');
  _rect(ctx, 4, 6, 8, 6, '#110000');
  // Плащ (воротник)
  _px(ctx, 4, 4, '#cc0000'); _px(ctx, 11, 4, '#cc0000');
  _px(ctx, 3, 5, '#aa0000'); _px(ctx, 12, 5, '#aa0000');
  // Голова (бледная кожа)
  _gradRect(ctx, 6, 1, 4, 4, '#ffe8e0', '#ddc8c0');
  // Волосы (чёрные)
  _px(ctx, 5, 1, '#111'); _px(ctx, 10, 1, '#111');
  _px(ctx, 6, 0, '#111'); _px(ctx, 9, 0, '#111');
  // Глаза (кроваво-красные)
  _px(ctx, 7, 2, '#ff0000'); _px(ctx, 9, 2, '#ff0000');
  // Клыки
  _px(ctx, 7, 4, '#fff'); _px(ctx, 9, 4, '#fff');
  // Кровавая аура
  _glow(ctx, 8, 6, 4, '#880000', 0.2);
});

_makeSprite('demilich', 16, function(ctx) {
  // Демилич: парящий золотой череп с драгоценностями
  // Парение
  _glow(ctx, 8, 8, 6, '#ffd700', 0.2);
  // Череп (золотой)
  _gradRect(ctx, 5, 4, 6, 5, '#ffd700', '#b8860b');
  _rect(ctx, 6, 3, 4, 1, '#e8c400');
  _rect(ctx, 6, 9, 4, 1, '#a08000');
  // Глазницы с драгоценностями
  _rect(ctx, 6, 5, 2, 2, '#000');
  _rect(ctx, 9, 5, 2, 2, '#000');
  _px(ctx, 6, 5, '#ff0000'); // рубин
  _px(ctx, 9, 5, '#0044ff'); // сапфир
  // Зубы
  _hline(ctx, 7, 8, 3, '#fff');
  // Орбитальные огоньки
  _px(ctx, 3, 6, '#ff88ff'); _px(ctx, 12, 6, '#88ffff');
  _px(ctx, 4, 10, '#ffff88'); _px(ctx, 11, 10, '#ff8888');
});

_makeSprite('empyrean', 16, function(ctx) {
  // Эмпиреец: сияющий золотой воин из света
  _gradRect(ctx, 5, 4, 6, 8, '#ffffa0', '#c8a850');
  _rect(ctx, 4, 5, 8, 6, '#e8d070');
  // Голова (сияющая)
  _gradRect(ctx, 6, 1, 4, 4, '#fffff0', '#ffe888');
  // Глаза (чистый белый свет)
  _px(ctx, 7, 3, '#ffffff'); _px(ctx, 9, 3, '#ffffff');
  // Крылья света
  _gradRect(ctx, 1, 3, 4, 4, '#ffe888', '#c8a040');
  _gradRect(ctx, 11, 3, 4, 4, '#ffe888', '#c8a040');
  // Нимб
  _hline(ctx, 6, 0, 4, '#ffffff');
  _px(ctx, 5, 0, '#ffffa0'); _px(ctx, 10, 0, '#ffffa0');
  // Сияние
  _glow(ctx, 8, 5, 5, '#ffd700', 0.3);
  // Оружие (копьё света)
  _vline(ctx, 13, 2, 10, '#ffd700');
  _px(ctx, 13, 1, '#ffffff');
});

_makeSprite('beast_lord', 16, function(ctx) {
  // Повелитель зверей: мускулистый в шкурах, рога
  _gradRect(ctx, 5, 4, 6, 8, '#4a8a2a', '#2a5a1a');
  _rect(ctx, 4, 5, 8, 6, '#3a6a2a');
  // Голова (звероподобная)
  _gradRect(ctx, 6, 1, 4, 4, '#5a9a3a', '#3a6a2a');
  // Рога (ветвистые)
  _px(ctx, 5, 0, '#8b5a2b'); _px(ctx, 4, 0, '#6b3a1b');
  _px(ctx, 10, 0, '#8b5a2b'); _px(ctx, 11, 0, '#6b3a1b');
  // Глаза (жёлтые звериные)
  _px(ctx, 7, 2, '#ffcc00'); _px(ctx, 9, 2, '#ffcc00');
  // Шкуры на теле
  _px(ctx, 4, 6, '#8b5a2b'); _px(ctx, 11, 7, '#8b5a2b');
  // Посох (кость)
  _vline(ctx, 13, 2, 10, '#e8dcc8');
  _px(ctx, 13, 1, '#ff4400'); // навершие
  // Ноги
  _vline(ctx, 7, 12, 3, '#2a5a1a');
  _vline(ctx, 9, 12, 3, '#2a5a1a');
});

_makeSprite('titan_elem', 16, function(ctx) {
  // Титановый элементаль: меняет цвета, огненный по умолчанию
  _gradRect(ctx, 3, 3, 10, 10, '#cc2200', '#771100');
  _rect(ctx, 4, 4, 8, 8, '#993300');
  // Руны стихий (4 цвета)
  _px(ctx, 5, 5, '#ff4400'); // огонь
  _px(ctx, 10, 5, '#4488cc'); // вода
  _px(ctx, 5, 10, '#8b6b3a'); // земля
  _px(ctx, 10, 10, '#ddeeff'); // воздух
  // Глаза (белое пламя)
  _px(ctx, 6, 6, '#ffffff'); _px(ctx, 9, 6, '#ffffff');
  // Трещины с лавой
  _hline(ctx, 5, 8, 6, '#ff8800');
  _vline(ctx, 8, 5, 4, '#ff6600');
  // Аура пламени
  _glow(ctx, 8, 7, 5, '#ff4400', 0.25);
  // Руки
  _rect(ctx, 2, 5, 2, 5, '#883300');
  _rect(ctx, 12, 5, 2, 5, '#883300');
});


/* ==========================================================
   Дополнительные размеры отображения
   ========================================================== */
Object.assign(SPRITE_DISPLAY_SIZES, {
  bone_golem: 34,
  phase_spider: 30,
  ettercap: 30,
  fungal_man: 30,
  pterodactyl: 30,
  giant_scorpion: 32,
  dragon_wyrm: 34,
  water_elem_large: 38,
  doppelganger_mage: 32,
  owlbear: 36,
  adult_dragon: 52,
  demon_destroyer: 48,
  illithid_arcanist: 34,
  golem_colossus: 52,
  shadow_dragon: 46,
  slime_queen: 48,
  iron_golem: 40,
  archdemon: 50,
  star_spawn: 38,
  ancient_dragon: 60,
  kraken_tentacle: 44,
  tarrasque_juv: 56,
  chaos_god: 48,
  vampire_lord: 38,
  demilich: 32,
  empyrean: 40,
  beast_lord: 38,
  titan_elem: 44,
});

})(); // Конец IIFE

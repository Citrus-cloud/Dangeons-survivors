'use strict';
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

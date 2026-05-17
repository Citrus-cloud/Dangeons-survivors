'use strict';
/* ============================================================
   loot.js — кристаллы опыта (XP), магнит, подбор. Заготовка
   под золото/прочую добычу.
   ============================================================ */

function createXP() {
  return { active: false, x: 0, y: 0, value: 0, pulse: 0 };
}

const Loot = {
  /** Бросить кристалл опыта в точке (x, y). */
  dropXP(pool, x, y, value) {
    const xp = pool.spawn();
    if (!xp) return null;
    xp.x = x; xp.y = y;
    xp.value = value;
    xp.pulse = 0;
    return xp;
  },

  /** Обновление кристаллов: магнит, подбор. */
  update(pool, player, dt) {
    const pickupR = CONFIG.PLAYER.PICKUP_RADIUS * player.pickupMul;
    const pickupR2 = pickupR * pickupR;
    const collectR = (player.size * 0.5 + 6);
    const collectR2 = collectR * collectR;
    const items = pool.items;
    for (let i = 0; i < items.length; i++) {
      const x = items[i];
      if (!x.active) continue;
      x.pulse += dt;
      const dx = player.x - x.x, dy = player.y - x.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= pickupR2) {
        const d = Math.sqrt(d2) || 1;
        const speed = CONFIG.XP.MAGNET_SPEED;
        x.x += (dx / d) * speed * dt;
        x.y += (dy / d) * speed * dt;
      }
      if (d2 <= collectR2) {
        player.xp += x.value;
        x.active = false;
      }
    }
  },

  /** Отрисовка кристаллов. ctx уже сдвинут на -cam. */
  render(ctx, pool, cam, viewW, viewH) {
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    const items = pool.items;
    for (let i = 0; i < items.length; i++) {
      const x = items[i];
      if (!x.active) continue;
      if (x.x < minX - 20 || x.x > maxX + 20 || x.y < minY - 20 || x.y > maxY + 20) continue;
      const pulse = 1 + Math.sin(x.pulse * 6) * 0.18;
      ctx.fillStyle = '#3ddc84';
      ctx.shadowColor = 'rgba(60, 220, 132, 0.7)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(x.x, x.y, 6 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  },

  /** Притянуть все активные кристаллы опыта мгновенно к игроку
   *  (используется эволюцией Soul Flame). */
  magnetizeAll(pool, player) {
    const items = pool.items;
    for (let i = 0; i < items.length; i++) {
      const x = items[i];
      if (!x.active) continue;
      // Эквивалент мгновенного подбора: засчитываем опыт и снимаем с поля.
      player.xp += x.value;
      x.active = false;
    }
  },
};


/* ============================================================
   Сундук с броском d20 (Шаг 3).

   Архитектура: один объект Chest в Game.chest (или null).
   Тут — только данные/спавн/рендер/индикатор. Логика подбора и
   d20-флоу — в main.js.
   ============================================================ */

const Chest = {
  /** Создать новый объект сундука (не размещён). */
  create() {
    return {
      x: 0, y: 0,
      size: CONFIG.CHEST.SIZE,
      pulse: 0,             // для лёгкой анимации/мерцания
      bornAt: 0,            // game.runTime в момент появления (для эффекта появления)
      opened: false,
    };
  },

  /** Заспавнить сундук в случайной точке на расстоянии 300..600 от героя
   *  (в пределах карты). Возвращает объект Chest или null. */
  spawnNear(player) {
    const c = Chest.create();
    const m = c.size;
    let placed = false;
    for (let attempt = 0; attempt < 24; attempt++) {
      const ang = Math.random() * Math.PI * 2;
      const dist = Utils.rand(CONFIG.CHEST.SPAWN_MIN_DIST, CONFIG.CHEST.SPAWN_MAX_DIST);
      const x = player.x + Math.cos(ang) * dist;
      const y = player.y + Math.sin(ang) * dist;
      // Внутри карты с отступом
      if (x < m || x > CONFIG.MAP.W - m) continue;
      if (y < m || y > CONFIG.MAP.H - m) continue;
      c.x = Utils.clamp(x, m, CONFIG.MAP.W - m);
      c.y = Utils.clamp(y, m, CONFIG.MAP.H - m);
      placed = true;
      break;
    }
    if (!placed) {
      // fallback: просто рядом с героем под углом 0
      c.x = Utils.clamp(player.x + 350, m, CONFIG.MAP.W - m);
      c.y = Utils.clamp(player.y,       m, CONFIG.MAP.H - m);
    }
    if (window.Particles) Particles.chestGlow(c.x, c.y);
    return c;
  },

  /** Обновление: только лёгкая анимация. */
  update(chest, dt) {
    if (!chest) return;
    chest.pulse += dt;
  },

  /** Дистанция до героя (квадрат). */
  pickedUpBy(chest, player) {
    if (!chest) return false;
    const r = CONFIG.CHEST.PICKUP_RADIUS + player.size * 0.5;
    const dx = chest.x - player.x, dy = chest.y - player.y;
    return (dx * dx + dy * dy) <= r * r;
  },

  /** Отрисовка сундука. ctx уже сдвинут на -cam. */
  render(ctx, chest, cam, viewW, viewH) {
    if (!chest) return;
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    if (chest.x + chest.size < minX || chest.x - chest.size > maxX) return;
    if (chest.y + chest.size < minY || chest.y - chest.size > maxY) return;

    const s = chest.size;
    const pulse = 1 + Math.sin(chest.pulse * 4) * 0.06;
    const w = s * pulse, h = s * pulse;
    // Свечение
    ctx.shadowColor = 'rgba(255, 215, 80, 0.8)';
    ctx.shadowBlur = 14;
    // Корпус
    ctx.fillStyle = '#d8a826';
    ctx.fillRect(chest.x - w / 2, chest.y - h / 2, w, h);
    ctx.shadowBlur = 0;
    // Обводка
    ctx.strokeStyle = '#8a6a14';
    ctx.lineWidth = 2;
    ctx.strokeRect(chest.x - w / 2 + 1, chest.y - h / 2 + 1, w - 2, h - 2);
    // Поперечная полоса (крышка)
    ctx.fillStyle = '#8a6a14';
    ctx.fillRect(chest.x - w / 2, chest.y - 2, w, 3);
    // Знак вопроса в центре
    ctx.fillStyle = '#fffce0';
    ctx.font = 'bold 18px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', chest.x, chest.y + 1);
  },

  /** Если сундук за границами видимой области — нарисовать стрелку-индикатор
   *  на краю экрана, указывающую направление к нему. ctx — БЕЗ сдвига камеры
   *  (рисуем в экранных координатах). */
  renderIndicator(ctx, chest, cam, viewW, viewH) {
    if (!chest) return;
    const screenX = chest.x - cam.x;
    const screenY = chest.y - cam.y;
    const margin = 24;
    const onScreen =
      screenX >= margin && screenX <= viewW - margin &&
      screenY >= margin && screenY <= viewH - margin;
    if (onScreen) return;

    const cx = viewW / 2, cy = viewH / 2;
    const dx = screenX - cx, dy = screenY - cy;
    // Точка на прямоугольнике viewport (с отступом margin) в направлении (dx, dy)
    const halfW = viewW / 2 - margin;
    const halfH = viewH / 2 - margin;
    const adx = Math.abs(dx) || 1e-6;
    const ady = Math.abs(dy) || 1e-6;
    const sx = halfW / adx;
    const sy = halfH / ady;
    const k = Math.min(sx, sy);
    const ix = cx + dx * k;
    const iy = cy + dy * k;
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(angle);
    // Полупрозрачный фон под значком
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    // Золотая стрелка-треугольник
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#8a6a14';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  },
};

window.createXP = createXP;
window.Loot = Loot;
window.Chest = Chest;

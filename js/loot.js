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
};

window.createXP = createXP;
window.Loot = Loot;

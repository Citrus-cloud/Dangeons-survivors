'use strict';
/* ============================================================
   enemies.js — враги. Пока один тип: скелет-воин ("S").
   ============================================================ */

function createEnemy() {
  return {
    active: false,
    type: 'skeleton',
    x: 0, y: 0,
    vx: 0, vy: 0,
    hp: 0, maxHp: 0,
    hitCooldown: 0,
    flash: 0,
  };
}

const Enemies = {
  /** Заспавнить волну вокруг игрока на расстоянии SPAWN_DIST_MIN..MAX. */
  spawnWave(pool, player, count) {
    for (let i = 0; i < count; i++) {
      const e = pool.spawn();
      if (!e) break;
      const angle = Math.random() * Math.PI * 2;
      const dist = Utils.rand(CONFIG.WAVE.SPAWN_DIST_MIN, CONFIG.WAVE.SPAWN_DIST_MAX);
      let ex = player.x + Math.cos(angle) * dist;
      let ey = player.y + Math.sin(angle) * dist;
      const m = CONFIG.ENEMY.SIZE;
      ex = Utils.clamp(ex, m, CONFIG.MAP.W - m);
      ey = Utils.clamp(ey, m, CONFIG.MAP.H - m);
      e.type = 'skeleton';
      e.x = ex; e.y = ey;
      e.vx = 0; e.vy = 0;
      e.hp = e.maxHp = CONFIG.ENEMY.HP;
      e.hitCooldown = 0;
      e.flash = 0;
    }
  },

  /** Обновление: погоня за игроком, контактный урон. */
  update(pool, player, dt) {
    const speed = CONFIG.ENEMY.SPEED;
    const items = pool.items;
    for (let i = 0, n = items.length; i < n; i++) {
      const e = items[i];
      if (!e.active) continue;
      const dx = player.x - e.x, dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.vx = dx / d * speed;
      e.vy = dy / d * speed;
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.hitCooldown = Math.max(0, e.hitCooldown - dt);
      e.flash = Math.max(0, e.flash - dt);

      // Контактный урон
      const collideR = (CONFIG.ENEMY.SIZE + CONFIG.PLAYER.SIZE) * 0.5;
      if (d < collideR && e.hitCooldown <= 0) {
        player.hp -= CONFIG.ENEMY.DAMAGE;
        e.hitCooldown = CONFIG.ENEMY.HIT_INTERVAL;
      }
    }
  },

  /** Отрисовка только видимых. ctx сдвинут на -cam. */
  render(ctx, pool, cam, viewW, viewH) {
    const minX = cam.x, minY = cam.y;
    const maxX = cam.x + viewW, maxY = cam.y + viewH;
    const eSize = CONFIG.ENEMY.SIZE;
    const items = pool.items;
    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      if (!e.active) continue;
      if (e.x + eSize < minX || e.x - eSize > maxX || e.y + eSize < minY || e.y - eSize > maxY) continue;

      ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#c0392b';
      ctx.fillRect(e.x - eSize / 2, e.y - eSize / 2, eSize, eSize);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(e.x - eSize / 2 + 0.5, e.y - eSize / 2 + 0.5, eSize - 1, eSize - 1);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', e.x, e.y + 1);

      if (e.hp < e.maxHp) {
        const barW = eSize, barH = 3;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(e.x - barW / 2, e.y - eSize / 2 - 6, barW, barH);
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(e.x - barW / 2, e.y - eSize / 2 - 6, barW * (e.hp / e.maxHp), barH);
      }
    }
  },
};

window.createEnemy = createEnemy;
window.Enemies = Enemies;

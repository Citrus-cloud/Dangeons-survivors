#!/usr/bin/env node
'use strict';
/**
 * build.js — Собирает все JS-файлы в один bundle.js (конкатенация в правильном порядке).
 * Не требует внешних зависимостей (работает на чистом Node.js).
 *
 * Использование:
 *   node build.js          — production build (минификация пробелов/комментариев)
 *   node build.js --watch  — dev mode (watch + sourcemap-инфо)
 */
const fs = require('fs');
const path = require('path');

// Порядок файлов (совпадает с порядком script-тегов в оригинальном index.html)
const FILES = [
  'js/utils/error-handler.js',
  'js/utils/safe-storage.js',
  'js/i18n/engine.js',
  'js/i18n/locale-ru.js',
  'js/i18n/locale-en.js',
  'js/config/constants.js',
  'js/config/biome-fixes.js',
  'js/utils/render-cache.js',
  'js/utils/spatial-grid.js',
  'js/utils/performance.js',
  'js/audio/audio.js',
  'js/map/dungeon-generator.js',
  'js/map/traps.js',
  'js/map/pathfinding.js',
  'js/systems/particles.js',
  'js/meta/metaprogress.js',
  'js/systems/loot.js',
  'js/render/sprites-enemies.js',
  'js/render/sprites-items.js',
  'js/render/sprites-expansion.js',
  'js/entities/enemies.js',
  'js/entities/bosses.js',
  'js/systems/weapons.js',
  'js/systems/abilities.js',
  'js/systems/evolutions.js',
  'js/systems/puzzles.js',
  'js/meta/classes.js',
  'js/meta/bestiary.js',
  'js/meta/codex.js',
  'js/input/input.js',
  'js/entities/player.js',
  'js/ui/hud.js',
  'js/ui/overlays.js',
  'js/meta/campaign.js',
  'js/systems/urns.js',
  'js/core/registry.js',
  'js/core/game-loop.js',
  'js/core/state-machine.js',
];

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, 'dist');
const OUT_FILE = path.join(OUT_DIR, 'bundle.js');

function build() {
  // Ensure dist/ exists
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  const parts = [];
  for (const file of FILES) {
    const fullPath = path.join(ROOT, file);
    if (!fs.existsSync(fullPath)) {
      console.error(`[ERROR] File not found: ${file}`);
      process.exit(1);
    }
    const content = fs.readFileSync(fullPath, 'utf-8');
    parts.push(`// === ${file} ===`);
    parts.push(content);
    parts.push('');
  }

  let bundle = parts.join('\n');

  // Лёгкая оптимизация: убираем пустые строки (безопасно, не трогает строковые литералы)
  bundle = bundle
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+$/gm, '');

  fs.writeFileSync(OUT_FILE, bundle, 'utf-8');

  const sizeKB = (Buffer.byteLength(bundle, 'utf-8') / 1024).toFixed(1);
  console.log(`✓ Bundle: dist/bundle.js (${sizeKB} KB, ${FILES.length} files)`);
}

// Watch mode
if (process.argv.includes('--watch')) {
  build();
  console.log('[dev] Watching js/ for changes...');

  const jsDir = path.join(ROOT, 'js');
  let debounce = null;
  fs.watch(jsDir, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith('.js')) return;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      console.log(`[dev] Changed: ${filename}`);
      build();
    }, 100);
  });
} else {
  build();
}

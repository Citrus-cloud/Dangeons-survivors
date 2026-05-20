#!/bin/bash
# Сборка проекта в один bundle.js
# При наличии esbuild — используем его, иначе — Node.js fallback (конкатенация)
set -e
cd "$(dirname "$0")"

if command -v npx &>/dev/null && npx esbuild --version &>/dev/null 2>&1; then
  echo "[build] Using esbuild..."
  npx esbuild js/main.js --bundle --format=iife --target=es2018 --minify --outfile=dist/bundle.js
else
  echo "[build] esbuild not available, using Node.js concat..."
  node build.js
fi

echo "✓ Build complete: dist/bundle.js"
ls -lh dist/bundle.js

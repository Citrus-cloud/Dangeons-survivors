'use strict';
/* ============================================================
   puzzles.js — Шаг 17: Руны активации (RunePuzzle) и
   Шифры с плитами (FloorPuzzle).
   ============================================================ */

/* ============================================================
   СИМВОЛЫ для загадок (общие для обоих типов)
   ============================================================ */
const PUZZLE_SYMBOLS = [
  { id: 'circle',    label: '\u25CF', name: 'Circle' },
  { id: 'triangle',  label: '\u25B2', name: 'Triangle' },
  { id: 'square',    label: '\u25A0', name: 'Square' },
  { id: 'diamond',   label: '\u25C6', name: 'Diamond' },
  { id: 'star',      label: '\u2605', name: 'Star' },
  { id: 'cross',     label: '\u271A', name: 'Cross' },
];

/* ============================================================
   RunePuzzle — Руны активации (загадка с последовательностью)
   На стенах комнаты расположены 4-5 светящихся рун.
   Игрок должен подойти и активировать их в правильном порядке.
   ============================================================ */
const RunePuzzle = {
  /**
   * Создать загадку рун активации в указанной комнате.
   * @param {object} room — комната dungeon
   * @param {number} runeCount — количество рун (3-5)
   * @returns {object} puzzleState
   */
  create(room, runeCount) {
    runeCount = Utils.clamp(runeCount || 4, 3, 5);

    // Выбираем случайные символы без повторений
    const shuffled = PUZZLE_SYMBOLS.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const symbols = shuffled.slice(0, runeCount);

    // Правильная последовательность — перемешанный порядок символов
    const sequence = symbols.slice();
    for (let i = sequence.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sequence[i], sequence[j]] = [sequence[j], sequence[i]];
    }

    // Размещаем руны вдоль стен комнаты
    const runes = [];
    const margin = 50;
    const wallPositions = RunePuzzle._getWallPositions(room, runeCount, margin);

    for (let i = 0; i < runeCount; i++) {
      runes.push({
        x: wallPositions[i].x,
        y: wallPositions[i].y,
        symbol: symbols[i],
        activated: false,
        flash: 0,         // таймер вспышки (красной при ошибке, зелёной при успехе)
        flashColor: null,
        pulse: Math.random() * Math.PI * 2, // начальная фаза пульсации
      });
    }

    return {
      type: 'rune_puzzle',
      room: room,
      runes: runes,
      sequence: sequence,       // правильный порядок символов
      currentStep: 0,           // сколько рун уже правильно активировано
      solved: false,
      failed: false,            // мигание при ошибке
      failTimer: 0,
      rewardSpawned: false,
      interactRadius: 40,       // расстояние для активации
      // Подсказка на полу (центр комнаты)
      hintX: room.cx,
      hintY: room.cy,
    };
  },

  /** Получить позиции вдоль стен комнаты. */
  _getWallPositions(room, count, margin) {
    const positions = [];
    const perimeter = [];

    // Верхняя стена
    for (let i = 0; i < Math.ceil(count / 2); i++) {
      const x = room.x + margin + (room.w - margin * 2) * (i + 0.5) / Math.ceil(count / 2);
      perimeter.push({ x, y: room.y + 20 });
    }
    // Нижняя стена
    for (let i = 0; i < Math.floor(count / 2); i++) {
      const x = room.x + margin + (room.w - margin * 2) * (i + 0.5) / Math.floor(count / 2);
      perimeter.push({ x, y: room.y + room.h - 20 });
    }
    // Левая стена
    perimeter.push({ x: room.x + 20, y: room.cy });
    // Правая стена
    perimeter.push({ x: room.x + room.w - 20, y: room.cy });

    // Берём первые count позиций
    for (let i = 0; i < count && i < perimeter.length; i++) {
      positions.push(perimeter[i]);
    }
    // Если не хватило — добавим случайные
    while (positions.length < count) {
      positions.push({
        x: room.x + margin + Math.random() * (room.w - margin * 2),
        y: room.y + margin + Math.random() * (room.h - margin * 2),
      });
    }
    return positions;
  },

  /**
   * Обновить состояние загадки.
   * @param {object} puzzle
   * @param {object} player
   * @param {number} dt
   * @returns {object|null} — событие { type: 'solved' | 'error', ... }
   */
  update(puzzle, player, dt) {
    if (puzzle.solved) return null;

    // Обновить анимации
    for (const rune of puzzle.runes) {
      rune.pulse += dt * 3;
      if (rune.flash > 0) rune.flash -= dt;
    }

    // Обновить таймер ошибки
    if (puzzle.failed) {
      puzzle.failTimer -= dt;
      if (puzzle.failTimer <= 0) {
        puzzle.failed = false;
        // Сбросить все руны
        for (const rune of puzzle.runes) {
          rune.activated = false;
          rune.flash = 0;
        }
        puzzle.currentStep = 0;
      }
      return null;
    }

    // Проверяем, подошёл ли игрок к руне
    for (const rune of puzzle.runes) {
      if (rune.activated) continue;
      const dx = player.x - rune.x;
      const dy = player.y - rune.y;
      const dist2 = dx * dx + dy * dy;
      if (dist2 <= puzzle.interactRadius * puzzle.interactRadius) {
        // Автоматическая активация при приближении
        return RunePuzzle._activateRune(puzzle, rune, player);
      }
    }
    return null;
  },

  /** Активировать конкретную руну. */
  _activateRune(puzzle, rune, player) {
    const expectedSymbol = puzzle.sequence[puzzle.currentStep];

    if (rune.symbol.id === expectedSymbol.id) {
      // Правильная руна!
      rune.activated = true;
      rune.flash = 0.5;
      rune.flashColor = '#00ff00';
      puzzle.currentStep++;

      if (puzzle.currentStep >= puzzle.sequence.length) {
        // Загадка решена!
        puzzle.solved = true;
        return { type: 'solved', puzzle };
      }
      return { type: 'correct_step', puzzle, step: puzzle.currentStep };
    } else {
      // Ошибка!
      puzzle.failed = true;
      puzzle.failTimer = 1.5;
      for (const r of puzzle.runes) {
        r.flash = 1.5;
        r.flashColor = '#ff0000';
      }
      return { type: 'error', puzzle, damage: 10 };
    }
  },

  /**
   * Отрисовка загадки.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} puzzle
   * @param {object} cam
   * @param {number} viewW
   * @param {number} viewH
   */
  render(ctx, puzzle, cam, viewW, viewH) {
    const minX = cam.x - 40, maxX = cam.x + viewW + 40;
    const minY = cam.y - 40, maxY = cam.y + viewH + 40;

    // Рисуем подсказку на полу (последовательность символов)
    if (!puzzle.solved) {
      RunePuzzle._renderHint(ctx, puzzle, cam, viewW, viewH);
    }

    // Рисуем руны
    for (const rune of puzzle.runes) {
      if (rune.x < minX || rune.x > maxX || rune.y < minY || rune.y > maxY) continue;

      const size = 30;
      const pulse = 1 + Math.sin(rune.pulse) * 0.15;

      // Фон руны
      if (rune.activated) {
        // Активирована — зелёное свечение
        ctx.shadowColor = 'rgba(0, 255, 100, 0.9)';
        ctx.shadowBlur = 16;
        ctx.fillStyle = 'rgba(0, 200, 80, 0.8)';
      } else if (rune.flash > 0 && rune.flashColor === '#ff0000') {
        // Ошибка — красная вспышка
        ctx.shadowColor = 'rgba(255, 0, 0, 0.9)';
        ctx.shadowBlur = 16;
        ctx.fillStyle = 'rgba(255, 50, 50, 0.8)';
      } else if (puzzle.solved) {
        ctx.shadowColor = 'rgba(255, 215, 0, 0.9)';
        ctx.shadowBlur = 16;
        ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
      } else {
        // Неактивная — тусклый фиолетовый с пульсацией
        const alpha = 0.4 + Math.sin(rune.pulse) * 0.15;
        ctx.shadowColor = `rgba(160, 80, 255, ${alpha})`;
        ctx.shadowBlur = 10 * pulse;
        ctx.fillStyle = `rgba(120, 60, 200, ${alpha})`;
      }

      // Круг руны
      ctx.beginPath();
      ctx.arc(rune.x, rune.y, size * 0.5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Обводка
      ctx.strokeStyle = rune.activated ? '#00ff88' : 'rgba(200, 150, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Символ
      ctx.fillStyle = rune.activated ? '#ffffff' : 'rgba(255, 255, 255, 0.8)';
      ctx.font = `bold ${Math.floor(16 * pulse)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(rune.symbol.label, rune.x, rune.y);
    }
  },

  /** Рисуем подсказку — последовательность символов на полу. */
  _renderHint(ctx, puzzle, cam, viewW, viewH) {
    const hx = puzzle.hintX;
    const hy = puzzle.hintY;

    if (hx < cam.x - 100 || hx > cam.x + viewW + 100 ||
        hy < cam.y - 100 || hy > cam.y + viewH + 100) return;

    const seq = puzzle.sequence;
    const totalW = seq.length * 28;
    const startX = hx - totalW / 2;

    // Фон подсказки
    ctx.fillStyle = 'rgba(40, 30, 60, 0.5)';
    ctx.fillRect(startX - 8, hy - 16, totalW + 16, 32);
    ctx.strokeStyle = 'rgba(160, 120, 220, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(startX - 8, hy - 16, totalW + 16, 32);

    // Символы
    for (let i = 0; i < seq.length; i++) {
      const sx = startX + i * 28 + 14;
      const completed = i < puzzle.currentStep;
      ctx.fillStyle = completed ? 'rgba(0, 255, 100, 0.8)' : 'rgba(255, 255, 255, 0.6)';
      ctx.font = '14px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(seq[i].label, sx, hy);

      // Стрелка между символами
      if (i < seq.length - 1) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillText('\u2192', sx + 14, hy);
      }
    }
  },
};


/* ============================================================
   FloorPuzzle — Шифры с плитами
   На полу 4-6 плит с символами. На стене выбит шифр —
   последовательность из 3-4 символов. Игрок наступает по порядку.
   ============================================================ */
const FloorPuzzle = {
  /**
   * Создать загадку плит-шифра.
   * @param {object} room — комната dungeon
   * @param {number} plateCount — общее количество плит (4-6)
   * @param {number} sequenceLen — длина шифра (3-4)
   * @returns {object} puzzleState
   */
  create(room, plateCount, sequenceLen) {
    plateCount = Utils.clamp(plateCount || 5, 4, 6);
    sequenceLen = Utils.clamp(sequenceLen || 3, 3, 4);

    // Выбираем символы для плит
    const shuffled = PUZZLE_SYMBOLS.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const symbols = shuffled.slice(0, plateCount);

    // Последовательность шифра — из подмножества символов плит
    const seqSymbols = symbols.slice();
    for (let i = seqSymbols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [seqSymbols[i], seqSymbols[j]] = [seqSymbols[j], seqSymbols[i]];
    }
    const sequence = seqSymbols.slice(0, sequenceLen);

    // Размещаем плиты в комнате (не у стен)
    const plates = [];
    const plateSize = 40;
    const margin = 60;

    for (let i = 0; i < plateCount; i++) {
      let px, py, attempts = 0, placed = false;
      while (!placed && attempts < 50) {
        attempts++;
        px = room.x + margin + Math.random() * (room.w - margin * 2 - plateSize);
        py = room.y + margin + Math.random() * (room.h - margin * 2 - plateSize);
        // Проверяем расстояние до других плит
        let ok = true;
        for (const other of plates) {
          const dx = px - other.x, dy = py - other.y;
          if (Math.sqrt(dx * dx + dy * dy) < plateSize + 20) { ok = false; break; }
        }
        if (ok) placed = true;
      }
      if (!placed) {
        px = room.x + margin + (i * (room.w - margin * 2)) / plateCount;
        py = room.y + room.h / 2 + (i % 2 === 0 ? -30 : 30);
      }

      plates.push({
        x: px,
        y: py,
        w: plateSize,
        h: plateSize,
        symbol: symbols[i],
        activated: false,
        flash: 0,
        flashColor: null,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    // Позиция шифра на стене (верхняя стена комнаты)
    const cipherX = room.cx;
    const cipherY = room.y + 25;

    return {
      type: 'floor_puzzle',
      room: room,
      plates: plates,
      sequence: sequence,
      currentStep: 0,
      solved: false,
      failed: false,
      failTimer: 0,
      rewardSpawned: false,
      // Шифр на стене
      cipherX: cipherX,
      cipherY: cipherY,
      // Точка выхода наградного ниши
      rewardX: room.cx,
      rewardY: room.cy + room.h * 0.3,
    };
  },

  /**
   * Обновить состояние загадки плит.
   */
  update(puzzle, player, dt) {
    if (puzzle.solved) return null;

    // Обновить анимации
    for (const plate of puzzle.plates) {
      plate.pulse += dt * 2.5;
      if (plate.flash > 0) plate.flash -= dt;
    }

    // Обновить таймер ошибки
    if (puzzle.failed) {
      puzzle.failTimer -= dt;
      if (puzzle.failTimer <= 0) {
        puzzle.failed = false;
        for (const plate of puzzle.plates) {
          plate.activated = false;
          plate.flash = 0;
        }
        puzzle.currentStep = 0;
      }
      return null;
    }

    // Проверяем, стоит ли игрок на плите
    for (const plate of puzzle.plates) {
      if (plate.activated) continue;
      // Коллизия прямоугольная (ноги игрока)
      const px = player.x, py = player.y + player.size * 0.3; // смещение вниз к ногам
      if (px >= plate.x && px <= plate.x + plate.w &&
          py >= plate.y && py <= plate.y + plate.h) {
        return FloorPuzzle._stepOnPlate(puzzle, plate, player);
      }
    }
    return null;
  },

  /** Игрок наступил на плиту. */
  _stepOnPlate(puzzle, plate, player) {
    const expectedSymbol = puzzle.sequence[puzzle.currentStep];

    if (plate.symbol.id === expectedSymbol.id) {
      // Правильная плита!
      plate.activated = true;
      plate.flash = 0.5;
      plate.flashColor = '#00ff00';
      puzzle.currentStep++;

      if (puzzle.currentStep >= puzzle.sequence.length) {
        puzzle.solved = true;
        return { type: 'solved', puzzle };
      }
      return { type: 'correct_step', puzzle, step: puzzle.currentStep };
    } else {
      // Ошибка!
      puzzle.failed = true;
      puzzle.failTimer = 1.5;
      for (const p of puzzle.plates) {
        p.flash = 1.5;
        p.flashColor = '#ff0000';
      }
      return { type: 'error', puzzle, damage: 5 };
    }
  },

  /**
   * Отрисовка плит и шифра.
   */
  render(ctx, puzzle, cam, viewW, viewH) {
    const minX = cam.x - 50, maxX = cam.x + viewW + 50;
    const minY = cam.y - 50, maxY = cam.y + viewH + 50;

    // Рисуем шифр на стене
    if (!puzzle.solved) {
      FloorPuzzle._renderCipher(ctx, puzzle, cam, viewW, viewH);
    }

    // Рисуем плиты
    for (const plate of puzzle.plates) {
      if (plate.x + plate.w < minX || plate.x > maxX ||
          plate.y + plate.h < minY || plate.y > maxY) continue;

      const pulse = 1 + Math.sin(plate.pulse) * 0.08;
      const cx = plate.x + plate.w / 2;
      const cy = plate.y + plate.h / 2;
      const hw = plate.w * 0.5 * pulse;
      const hh = plate.h * 0.5 * pulse;

      // Фон плиты
      if (plate.activated) {
        ctx.fillStyle = 'rgba(0, 200, 80, 0.5)';
        ctx.shadowColor = 'rgba(0, 255, 100, 0.8)';
        ctx.shadowBlur = 10;
      } else if (plate.flash > 0 && plate.flashColor === '#ff0000') {
        ctx.fillStyle = 'rgba(255, 50, 50, 0.5)';
        ctx.shadowColor = 'rgba(255, 0, 0, 0.8)';
        ctx.shadowBlur = 10;
      } else {
        const alpha = 0.3 + Math.sin(plate.pulse) * 0.1;
        ctx.fillStyle = `rgba(180, 160, 100, ${alpha})`;
        ctx.shadowColor = 'rgba(220, 200, 120, 0.3)';
        ctx.shadowBlur = 6;
      }

      ctx.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
      ctx.shadowBlur = 0;

      // Обводка
      ctx.strokeStyle = plate.activated ? '#00ff88' : 'rgba(220, 200, 120, 0.6)';
      ctx.lineWidth = 2;
      ctx.strokeRect(cx - hw, cy - hh, hw * 2, hh * 2);

      // Символ
      ctx.fillStyle = plate.activated ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
      ctx.font = `bold ${Math.floor(18 * pulse)}px ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(plate.symbol.label, cx, cy);
    }
  },

  /** Рисуем шифр на стене. */
  _renderCipher(ctx, puzzle, cam, viewW, viewH) {
    const cx = puzzle.cipherX;
    const cy = puzzle.cipherY;

    if (cx < cam.x - 100 || cx > cam.x + viewW + 100 ||
        cy < cam.y - 100 || cy > cam.y + viewH + 100) return;

    const seq = puzzle.sequence;
    const totalW = seq.length * 32;
    const startX = cx - totalW / 2;

    // Фон шифра (каменная табличка)
    ctx.fillStyle = 'rgba(60, 50, 40, 0.7)';
    ctx.fillRect(startX - 10, cy - 18, totalW + 20, 36);
    ctx.strokeStyle = 'rgba(180, 160, 120, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(startX - 10, cy - 18, totalW + 20, 36);

    // Символы шифра
    for (let i = 0; i < seq.length; i++) {
      const sx = startX + i * 32 + 16;
      const completed = i < puzzle.currentStep;
      ctx.fillStyle = completed ? 'rgba(0, 255, 100, 0.9)' : 'rgba(255, 255, 255, 0.8)';
      ctx.font = 'bold 16px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(seq[i].label, sx, cy);
    }
  },
};


/* ============================================================
   Экспорт
   ============================================================ */
window.PUZZLE_SYMBOLS = PUZZLE_SYMBOLS;
window.RunePuzzle = RunePuzzle;
window.FloorPuzzle = FloorPuzzle;

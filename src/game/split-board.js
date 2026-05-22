import {
  COLS, ROWS, CELL_SIZE, PIECE_RADIUS, BOARD_PADDING,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  CHINESE_BOARD_BG, LINE_COLOR, LIGHT_SQUARE, DARK_SQUARE,
  HIGHLIGHT_COLOR, LAST_MOVE_COLOR, CHECK_COLOR, COORD_COLOR,
  CHINESE_ZONE_MAX, INTL_ZONE_MIN, BLACK_PALACE
} from './split-constants.js';

let boardCtx = null;
let uiCtx    = null;

export function initCanvas(canvasEl) {
  const ctx = canvasEl.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  canvasEl.width  = CANVAS_WIDTH  * dpr;
  canvasEl.height = CANVAS_HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  // Responsive: scale CSS display size to fit viewport on mobile
  const maxW  = Math.min(CANVAS_WIDTH, window.innerWidth - 24);
  const scale = maxW / CANVAS_WIDTH;
  canvasEl.style.width  = Math.round(CANVAS_WIDTH  * scale) + 'px';
  canvasEl.style.height = Math.round(CANVAS_HEIGHT * scale) + 'px';

  if (canvasEl.id === 'board-canvas') boardCtx = ctx;
  else if (canvasEl.id === 'ui-canvas') uiCtx = ctx;
  return ctx;
}

export function gridToPixel(col, row) {
  return {
    x: BOARD_PADDING + col * CELL_SIZE,
    y: BOARD_PADDING + row * CELL_SIZE
  };
}

export function pixelToGrid(px, py) {
  let col = Math.round((px - BOARD_PADDING) / CELL_SIZE);
  let row = Math.round((py - BOARD_PADDING) / CELL_SIZE);
  col = Math.max(0, Math.min(COLS - 1, col));
  row = Math.max(0, Math.min(ROWS - 1, row));
  return { col, row };
}

export function drawBoard() {
  const ctx = boardCtx;

  // ── 1. Chinese zone background (tan wood, top half) ───────────────────────
  const grad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT / 2);
  grad.addColorStop(0,   '#d0a868');
  grad.addColorStop(0.5, CHINESE_BOARD_BG);
  grad.addColorStop(1,   '#be9450');
  ctx.fillStyle = grad;
  const boundaryY = BOARD_PADDING + CHINESE_ZONE_MAX * CELL_SIZE + CELL_SIZE / 2;
  ctx.fillRect(0, 0, CANVAS_WIDTH, boundaryY);

  // ── 2. International zone checkerboard (bottom half) ─────────────────────
  for (let row = INTL_ZONE_MIN; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const px = BOARD_PADDING + col * CELL_SIZE;
      const py = BOARD_PADDING + row * CELL_SIZE;
      const x  = px - CELL_SIZE / 2;
      const y  = Math.max(py - CELL_SIZE / 2, boundaryY);
      const w  = CELL_SIZE;
      const h  = Math.min(py + CELL_SIZE / 2, CANVAS_HEIGHT) - y;
      ctx.fillStyle = (col + row) % 2 === 0 ? LIGHT_SQUARE : DARK_SQUARE;
      ctx.fillRect(x, y, w, h);
    }
  }

  // ── 3. Zone boundary line ─────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = '#2a2a2a';
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.moveTo(0, boundaryY);
  ctx.lineTo(CANVAS_WIDTH, boundaryY);
  ctx.stroke();
  ctx.restore();

  // ── 4. Zone labels ────────────────────────────────────────────────────────
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(80, 40, 10, 0.45)';
  ctx.font = 'bold 10px serif';
  ctx.fillText('▲ 中国象棋区 ▲', BOARD_PADDING + 4 * CELL_SIZE,
    BOARD_PADDING + 3.5 * CELL_SIZE);

  ctx.fillStyle = 'rgba(40, 40, 80, 0.45)';
  ctx.fillText('▼ 国际象棋区 ▼', BOARD_PADDING + 4 * CELL_SIZE,
    BOARD_PADDING + 7.5 * CELL_SIZE);

  // ── 5. Grid lines ─────────────────────────────────────────────────────────
  // Horizontal lines
  ctx.lineWidth = 1;
  for (let row = 0; row < ROWS; row++) {
    const y = BOARD_PADDING + row * CELL_SIZE;
    ctx.strokeStyle = row <= CHINESE_ZONE_MAX ? LINE_COLOR : 'rgba(80,50,20,0.4)';
    ctx.beginPath();
    ctx.moveTo(BOARD_PADDING, y);
    ctx.lineTo(BOARD_PADDING + (COLS - 1) * CELL_SIZE, y);
    ctx.stroke();
  }

  // Vertical lines — Chinese zone: break in middle (no break in intl zone)
  for (let col = 0; col < COLS; col++) {
    const x = BOARD_PADDING + col * CELL_SIZE;

    // Chinese zone segment
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    if (col === 0 || col === COLS - 1) {
      ctx.moveTo(x, BOARD_PADDING);
      ctx.lineTo(x, BOARD_PADDING + CHINESE_ZONE_MAX * CELL_SIZE);
    } else {
      ctx.moveTo(x, BOARD_PADDING);
      ctx.lineTo(x, BOARD_PADDING + CHINESE_ZONE_MAX * CELL_SIZE);
    }
    ctx.stroke();

    // International zone segment
    ctx.strokeStyle = 'rgba(80,50,20,0.4)';
    ctx.beginPath();
    ctx.moveTo(x, BOARD_PADDING + INTL_ZONE_MIN * CELL_SIZE);
    ctx.lineTo(x, BOARD_PADDING + (ROWS - 1) * CELL_SIZE);
    ctx.stroke();
  }

  // ── 6. Black palace diagonals ─────────────────────────────────────────────
  drawPalace(BLACK_PALACE);

  // ── 7. Coordinate labels ──────────────────────────────────────────────────
  ctx.fillStyle  = COORD_COLOR;
  ctx.font       = '10px system-ui, sans-serif';
  ctx.textAlign  = 'center';
  ctx.textBaseline = 'top';
  for (let col = 0; col < COLS; col++) {
    ctx.fillText(String(col + 1),
      BOARD_PADDING + col * CELL_SIZE,
      BOARD_PADDING + (ROWS - 1) * CELL_SIZE + 7);
  }
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'middle';
  for (let row = 0; row < ROWS; row++) {
    ctx.fillText(String(row + 1),
      BOARD_PADDING - 7,
      BOARD_PADDING + row * CELL_SIZE);
  }
}

function drawPalace(palace) {
  const ctx = boardCtx;
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth   = 1;
  const x1 = BOARD_PADDING + palace.colMin * CELL_SIZE;
  const x2 = BOARD_PADDING + palace.colMax * CELL_SIZE;
  const y1 = BOARD_PADDING + palace.rowMin * CELL_SIZE;
  const y2 = BOARD_PADDING + palace.rowMax * CELL_SIZE;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y1); ctx.lineTo(x1, y2); ctx.stroke();
}

export function drawPieces(boardState, pieces) {
  const ctx = boardCtx;
  pieces.forEach(piece => {
    if (!piece) return;
    const { x, y } = gridToPixel(piece.col, piece.row);
    drawSinglePiece(ctx, x, y, piece);
  });
}

function drawSinglePiece(ctx, x, y, piece) {
  const r     = PIECE_RADIUS;
  const isRed = piece.color === 'red';

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur  = 5;
  ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 2;
  ctx.fillStyle = isRed ? '#5a0a0a' : '#000000';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r * 0.95);
  if (isRed) {
    grad.addColorStop(0, '#e84848'); grad.addColorStop(0.55, '#be1e1e'); grad.addColorStop(1, '#8a1010');
  } else {
    grad.addColorStop(0, '#505050'); grad.addColorStop(0.55, '#242424'); grad.addColorStop(1, '#0c0c0c');
  }
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(x, y, r - 1.5, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = isRed ? 'rgba(245,220,60,0.70)' : 'rgba(180,180,180,0.42)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath(); ctx.arc(x, y, r - 5.5, 0, Math.PI * 2); ctx.stroke();

  const symbol = getPieceSymbol(piece.type);
  ctx.fillStyle = isRed ? '#f5e030' : '#d0d0d0';
  ctx.font      = "bold 15px 'STKaiti','FangSong','Noto Serif SC',serif";
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(symbol, x, y);
}

function getPieceSymbol(type) {
  return { general:'將', advisor:'士', elephant:'象', horse:'馬',
           rook_c:'車', cannon:'砲', soldier:'兵',
           king:'♔', queen:'♕', rook_i:'♖', bishop:'♗', knight:'♘', pawn:'♙' }[type] || '?';
}

export function drawHighlights(selected, validMoves, lastMove, checkCell, cells) {
  const ctx = uiCtx;

  if (lastMove) {
    [lastMove.from, lastMove.to].forEach(pos => {
      const { x, y } = gridToPixel(pos.col, pos.row);
      ctx.fillStyle = LAST_MOVE_COLOR;
      ctx.fillRect(x - CELL_SIZE / 2, y - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
    });
  }

  if (checkCell) {
    const { x, y } = gridToPixel(checkCell.col, checkCell.row);
    ctx.fillStyle = CHECK_COLOR;
    ctx.fillRect(x - CELL_SIZE / 2, y - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
  }

  if (selected) {
    const { x, y } = gridToPixel(selected.col, selected.row);
    ctx.fillStyle = HIGHLIGHT_COLOR;
    ctx.fillRect(x - CELL_SIZE / 2, y - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
  }

  if (validMoves?.length > 0) {
    validMoves.forEach(move => {
      const { x, y } = gridToPixel(move.to.col, move.to.row);
      const hasTarget = cells && cells[move.to.row]?.[move.to.col];
      if (hasTarget) {
        ctx.strokeStyle = HIGHLIGHT_COLOR;
        ctx.lineWidth   = 3;
        ctx.beginPath(); ctx.arc(x, y, PIECE_RADIUS + 3, 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = HIGHLIGHT_COLOR;
        ctx.beginPath(); ctx.arc(x, y, Math.round(CELL_SIZE * 0.155), 0, Math.PI * 2); ctx.fill();
      }
    });
  }
}

export function clearCanvas() {
  if (boardCtx) boardCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (uiCtx)    uiCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

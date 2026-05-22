import {
  COLS, ROWS, CELL_SIZE, PIECE_RADIUS, BOARD_PADDING,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  BOARD_COLOR, LINE_COLOR, RED_PIECE_BG, BLACK_PIECE_BG,
  HIGHLIGHT_COLOR, LAST_MOVE_COLOR, CHECK_COLOR, TEXT_COLOR, COORD_COLOR,
  RIVER_TOP_ROW, RIVER_BOT_ROW, RED_PALACE, BLACK_PALACE
} from './constants.js';

let boardCtx = null;
let uiCtx = null;
let _flipped = false;
export function setFlipped(val) { _flipped = val; }
export function isFlipped()     { return _flipped; }

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
  const x = px - BOARD_PADDING;
  const y = py - BOARD_PADDING;

  let col = Math.round(x / CELL_SIZE);
  let row = Math.round(y / CELL_SIZE);

  col = Math.max(0, Math.min(COLS - 1, col));
  row = Math.max(0, Math.min(ROWS - 1, row));

  return { col, row };
}

export function drawBoard() {
  const ctx = boardCtx;

  // Board background with subtle gradient
  const grad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  grad.addColorStop(0, '#d0a868');
  grad.addColorStop(0.5, BOARD_COLOR);
  grad.addColorStop(1, '#b89050');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Subtle inner shadow frame
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 10;
  ctx.shadowInset = true;
  ctx.restore();

  // River zone
  const riverX = BOARD_PADDING;
  const riverY = BOARD_PADDING + RIVER_TOP_ROW * CELL_SIZE;
  const riverW = (COLS - 1) * CELL_SIZE;
  const riverH = CELL_SIZE;
  ctx.fillStyle = 'rgba(60, 120, 200, 0.10)';
  ctx.fillRect(riverX, riverY, riverW, riverH);

  // Dashed river borders
  ctx.save();
  ctx.strokeStyle = 'rgba(50, 110, 180, 0.45)';
  ctx.lineWidth = 1.2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(riverX, riverY);
  ctx.lineTo(riverX + riverW, riverY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(riverX, riverY + riverH);
  ctx.lineTo(riverX + riverW, riverY + riverH);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Grid lines
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 1;

  for (let row = 0; row < ROWS; row++) {
    const y = BOARD_PADDING + row * CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(BOARD_PADDING, y);
    ctx.lineTo(BOARD_PADDING + (COLS - 1) * CELL_SIZE, y);
    ctx.stroke();
  }

  for (let col = 0; col < COLS; col++) {
    const x = BOARD_PADDING + col * CELL_SIZE;
    if (col === 0 || col === COLS - 1) {
      ctx.beginPath();
      ctx.moveTo(x, BOARD_PADDING);
      ctx.lineTo(x, BOARD_PADDING + (ROWS - 1) * CELL_SIZE);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x, BOARD_PADDING);
      ctx.lineTo(x, BOARD_PADDING + RIVER_TOP_ROW * CELL_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, BOARD_PADDING + RIVER_BOT_ROW * CELL_SIZE);
      ctx.lineTo(x, BOARD_PADDING + (ROWS - 1) * CELL_SIZE);
      ctx.stroke();
    }
  }

  // Palace diagonal lines
  drawPalace(RED_PALACE);
  drawPalace(BLACK_PALACE);

  // River label (always upright even when board is CSS-flipped)
  ctx.fillStyle = 'rgba(30, 80, 160, 0.65)';
  ctx.font = 'bold 12px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const riverMidY = riverY + riverH / 2;
  [
    ['楚  河', BOARD_PADDING + 2 * CELL_SIZE],
    ['汉  界', BOARD_PADDING + 6 * CELL_SIZE],
  ].forEach(([text, x]) => {
    ctx.save();
    ctx.translate(x, riverMidY);
    if (_flipped) ctx.rotate(Math.PI);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  });

  // Coordinate labels
  ctx.fillStyle = COORD_COLOR;
  ctx.font = `10px system-ui, sans-serif`;

  // Column labels (1–9) at bottom
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let col = 0; col < COLS; col++) {
    const x = BOARD_PADDING + col * CELL_SIZE;
    ctx.fillText(String(col + 1), x, BOARD_PADDING + (ROWS - 1) * CELL_SIZE + 7);
  }

  // Row labels (1–10) at left
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let row = 0; row < ROWS; row++) {
    const y = BOARD_PADDING + row * CELL_SIZE;
    ctx.fillText(String(row + 1), BOARD_PADDING - 7, y);
  }
}

function drawPalace(palace) {
  const ctx = boardCtx;
  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = 1;

  const x1 = BOARD_PADDING + palace.colMin * CELL_SIZE;
  const x2 = BOARD_PADDING + palace.colMax * CELL_SIZE;
  const y1 = BOARD_PADDING + palace.rowMin * CELL_SIZE;
  const y2 = BOARD_PADDING + palace.rowMax * CELL_SIZE;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y1);
  ctx.lineTo(x1, y2);
  ctx.stroke();
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
  const r = PIECE_RADIUS;
  const isRed = piece.color === 'red';

  // Drop shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 2;

  // Outer border ring
  ctx.fillStyle = isRed ? '#5a0a0a' : '#000000';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Radial gradient fill
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r * 0.95);
  if (isRed) {
    grad.addColorStop(0, '#e84848');
    grad.addColorStop(0.55, '#be1e1e');
    grad.addColorStop(1, '#8a1010');
  } else {
    grad.addColorStop(0, '#505050');
    grad.addColorStop(0.55, '#242424');
    grad.addColorStop(1, '#0c0c0c');
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r - 1.5, 0, Math.PI * 2);
  ctx.fill();

  // Inner decorative ring (traditional Chinese chess style)
  ctx.strokeStyle = isRed ? 'rgba(245, 220, 60, 0.70)' : 'rgba(180, 180, 180, 0.42)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, r - 5.5, 0, Math.PI * 2);
  ctx.stroke();

  // Piece symbol — draw upright even when board is CSS-rotated
  const symbol = getPieceSymbol(piece.type);
  ctx.fillStyle = isRed ? '#f5e030' : '#d0d0d0';
  ctx.font = `bold 15px 'STKaiti', 'FangSong', 'Noto Serif SC', serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (_flipped) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-1, -1);
    ctx.fillText(symbol, 0, 0);
    ctx.restore();
  } else {
    ctx.fillText(symbol, x, y);
  }
}

function getPieceSymbol(type) {
  const symbols = {
    general: '將',
    advisor: '士',
    elephant: '象',
    horse: '馬',
    rook_c: '車',
    cannon: '砲',
    soldier: '兵',
    king:   '♔',
    queen:  '♕',
    rook_i: '♖',
    bishop: '♗',
    knight: '♘',
    pawn:   '♙'
  };
  return symbols[type] || '?';
}

// cells: optional 2D array (cells[row][col] = piece|null) to distinguish captures
export function drawHighlights(selected, validMoves, lastMove, checkCell, cells) {
  const ctx = uiCtx;

  // Last-move highlight (full cell)
  if (lastMove) {
    const lastMovePositions = lastMove.castling
      ? [lastMove.from, lastMove.castling.kingTo, lastMove.castling.rFrom, lastMove.castling.rTo]
      : [lastMove.from, lastMove.to];
    lastMovePositions.forEach(pos => {
      const { x, y } = gridToPixel(pos.col, pos.row);
      ctx.fillStyle = LAST_MOVE_COLOR;
      ctx.fillRect(x - CELL_SIZE / 2, y - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
    });
  }

  // Check highlight
  if (checkCell) {
    const { x, y } = gridToPixel(checkCell.col, checkCell.row);
    ctx.fillStyle = CHECK_COLOR;
    ctx.fillRect(x - CELL_SIZE / 2, y - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
  }

  // Selected piece highlight
  if (selected) {
    const { x, y } = gridToPixel(selected.col, selected.row);
    ctx.fillStyle = HIGHLIGHT_COLOR;
    ctx.fillRect(x - CELL_SIZE / 2, y - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE);
  }

  // Valid moves
  if (validMoves?.length > 0) {
    validMoves.forEach(move => {
      const { x, y } = gridToPixel(move.to.col, move.to.row);
      const hasTarget = !move.castling && cells && cells[move.to.row] && cells[move.to.row][move.to.col];

      if (move.castling) {
        // Castling: highlight the rook square with a ring (not a capture ring color)
        ctx.strokeStyle = HIGHLIGHT_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, PIECE_RADIUS + 3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (hasTarget) {
        // Capture target: translucent ring around the piece
        ctx.strokeStyle = HIGHLIGHT_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, PIECE_RADIUS + 3, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Empty square: small dot
        ctx.fillStyle = HIGHLIGHT_COLOR;
        ctx.beginPath();
        ctx.arc(x, y, Math.round(CELL_SIZE * 0.155), 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
}

export function clearCanvas() {
  if (boardCtx) boardCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  if (uiCtx)    uiCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

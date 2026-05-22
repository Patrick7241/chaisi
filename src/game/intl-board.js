import {
  COLS, ROWS, CELL_SIZE, BOARD_PADDING, PIECE_RADIUS, CANVAS_SIZE,
  LIGHT_SQUARE, DARK_SQUARE, RED_PIECE_BG, BLACK_PIECE_BG,
  HIGHLIGHT_COLOR, CAPTURE_COLOR, LAST_MOVE_COLOR, CHECK_COLOR, SELECT_COLOR,
  RIVER_TOP_ROW, RIVER_BOT_ROW
} from './intl-constants.js';

let boardCtx = null;
let uiCtx    = null;

export function initCanvas(canvasEl) {
  const ctx = canvasEl.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  canvasEl.width  = CANVAS_SIZE * dpr;
  canvasEl.height = CANVAS_SIZE * dpr;
  ctx.scale(dpr, dpr);

  // Responsive: scale CSS display size to fit viewport on mobile
  const maxW  = Math.min(CANVAS_SIZE, window.innerWidth - 24);
  const scale = maxW / CANVAS_SIZE;
  canvasEl.style.width  = Math.round(CANVAS_SIZE * scale) + 'px';
  canvasEl.style.height = Math.round(CANVAS_SIZE * scale) + 'px';

  if (canvasEl.id === 'intl-board-canvas') boardCtx = ctx;
  else if (canvasEl.id === 'intl-ui-canvas') uiCtx = ctx;
  return ctx;
}

export function squareCenter(col, row) {
  return {
    x: BOARD_PADDING + col * CELL_SIZE + CELL_SIZE / 2,
    y: BOARD_PADDING + row * CELL_SIZE + CELL_SIZE / 2
  };
}

export function pixelToSquare(px, py) {
  const col = Math.floor((px - BOARD_PADDING) / CELL_SIZE);
  const row = Math.floor((py - BOARD_PADDING) / CELL_SIZE);
  return {
    col: Math.max(0, Math.min(COLS - 1, col)),
    row: Math.max(0, Math.min(ROWS - 1, row))
  };
}

export function drawBoard() {
  const ctx = boardCtx;

  // Outer frame
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Squares
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      ctx.fillStyle = (col + row) % 2 === 0 ? LIGHT_SQUARE : DARK_SQUARE;
      ctx.fillRect(
        BOARD_PADDING + col * CELL_SIZE,
        BOARD_PADDING + row * CELL_SIZE,
        CELL_SIZE, CELL_SIZE
      );
    }
  }

  // River dividing line (between RIVER_TOP_ROW and RIVER_BOT_ROW)
  const ry = BOARD_PADDING + RIVER_BOT_ROW * CELL_SIZE;
  ctx.save();
  ctx.strokeStyle = 'rgba(60, 130, 220, 0.60)';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(BOARD_PADDING, ry);
  ctx.lineTo(BOARD_PADDING + COLS * CELL_SIZE, ry);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Outer border
  ctx.strokeStyle = '#2a1a08';
  ctx.lineWidth = 3;
  ctx.strokeRect(BOARD_PADDING, BOARD_PADDING, COLS * CELL_SIZE, ROWS * CELL_SIZE);

  // Coordinate labels
  ctx.fillStyle = 'rgba(180, 120, 60, 0.75)';
  ctx.font = 'bold 10px system-ui, sans-serif';
  const files = 'abcdefgh';
  for (let col = 0; col < COLS; col++) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      files[col],
      BOARD_PADDING + col * CELL_SIZE + CELL_SIZE / 2,
      BOARD_PADDING + ROWS * CELL_SIZE + BOARD_PADDING / 2
    );
  }
  for (let row = 0; row < ROWS; row++) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      String(ROWS - row),
      BOARD_PADDING / 2,
      BOARD_PADDING + row * CELL_SIZE + CELL_SIZE / 2
    );
  }
}

// Chinese piece characters
const CHINESE_SYMBOLS = {
  general: '將', advisor: '士', elephant: '象',
  horse: '馬', rook_c: '車', cannon: '砲', soldier: '兵'
};

// International piece symbols
const INTL_SYMBOLS = {
  king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙'
};

const CHINESE_TYPES = new Set(['general','advisor','elephant','horse','rook_c','cannon','soldier']);

export function drawPieces(board, pieces) {
  const ctx = boardCtx;
  pieces.forEach(piece => {
    if (!piece) return;
    const { x, y } = squareCenter(piece.col, piece.row);
    drawSinglePiece(ctx, x, y, piece);
  });
}

function drawSinglePiece(ctx, x, y, piece) {
  const r = PIECE_RADIUS;
  const isRed     = piece.color === 'red';
  const isChinese = CHINESE_TYPES.has(piece.type);

  // Drop shadow
  ctx.save();
  ctx.shadowColor   = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur    = 5;
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

  // Inner decorative ring (Chinese pieces get gold ring, intl pieces get subtler ring)
  if (isChinese) {
    ctx.strokeStyle = isRed ? 'rgba(245, 220, 60, 0.72)' : 'rgba(180, 180, 180, 0.42)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, r - 5.5, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = isRed ? 'rgba(245, 200, 80, 0.50)' : 'rgba(160, 160, 160, 0.32)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r - 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Piece symbol
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  if (isChinese) {
    ctx.fillStyle = isRed ? '#f5e030' : '#d0d0d0';
    ctx.font = `bold 15px 'STKaiti', 'FangSong', 'Noto Serif SC', serif`;
    ctx.fillText(CHINESE_SYMBOLS[piece.type] || '?', x, y);
  } else {
    ctx.fillStyle = isRed ? '#f5e030' : '#d8d8d8';
    ctx.font = `bold 17px serif`;
    ctx.fillText(INTL_SYMBOLS[piece.type] || '?', x, y + 1);
  }
}

function fillSquare(ctx, col, row, color) {
  ctx.fillStyle = color;
  ctx.fillRect(
    BOARD_PADDING + col * CELL_SIZE,
    BOARD_PADDING + row * CELL_SIZE,
    CELL_SIZE, CELL_SIZE
  );
}

export function drawHighlights(selected, validMoves, lastMove, checkCell) {
  const ctx = uiCtx;

  if (lastMove) {
    const lastMovePositions = lastMove.castling
      ? [lastMove.from, lastMove.castling.kingTo, lastMove.castling.rFrom, lastMove.castling.rTo]
      : [lastMove.from, lastMove.to];
    lastMovePositions.forEach(pos => {
      fillSquare(ctx, pos.col, pos.row, LAST_MOVE_COLOR);
    });
  }
  if (checkCell) fillSquare(ctx, checkCell.col, checkCell.row, CHECK_COLOR);
  if (selected)  fillSquare(ctx, selected.col,  selected.row,  SELECT_COLOR);

  if (validMoves) {
    validMoves.forEach(move => {
      const { col, row } = move.to;
      const cx = BOARD_PADDING + col * CELL_SIZE + CELL_SIZE / 2;
      const cy = BOARD_PADDING + row * CELL_SIZE + CELL_SIZE / 2;
      if (move.castling) {
        // Castling: ring around the rook square
        ctx.strokeStyle = CAPTURE_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, PIECE_RADIUS + 3, 0, Math.PI * 2);
        ctx.stroke();
      } else if (move.capture) {
        // Capture target: ring around piece
        ctx.strokeStyle = CAPTURE_COLOR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, PIECE_RADIUS + 3, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        // Empty square: small dot
        ctx.fillStyle = HIGHLIGHT_COLOR;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.round(CELL_SIZE * 0.155), 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
}

export function clearCanvas() {
  if (boardCtx) boardCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  if (uiCtx)    uiCtx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

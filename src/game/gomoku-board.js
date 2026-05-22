import { BOARD_SIZE } from './gomoku-game.js';

export const CELL_SIZE = 40;
export const PADDING   = 30;
export const CANVAS_SIZE = CELL_SIZE * (BOARD_SIZE - 1) + PADDING * 2; // 600

// Star points for standard 15x15 Gomoku board
const STAR_POINTS = [
  [3,3],[3,7],[3,11],
  [7,3],[7,7],[7,11],
  [11,3],[11,7],[11,11],
];

function toXY(row, col) {
  return {
    x: PADDING + col * CELL_SIZE,
    y: PADDING + row * CELL_SIZE,
  };
}

export function initGomokuCanvas(canvasEl) {
  if (!canvasEl) return;
  const dpr = window.devicePixelRatio || 1;
  canvasEl.width  = CANVAS_SIZE * dpr;
  canvasEl.height = CANVAS_SIZE * dpr;
  canvasEl.style.width  = CANVAS_SIZE + 'px';
  canvasEl.style.height = CANVAS_SIZE + 'px';
  const ctx = canvasEl.getContext('2d');
  ctx.scale(dpr, dpr);
}

export function clearGomokuCanvas(ctx) {
  if (!ctx) return;
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

export function drawGomokuBoard(ctx) {
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#dcb483';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Grid lines
  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 1;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const { x } = toXY(0, i);
    const { y } = toXY(0, 0);
    const { y: yEnd } = toXY(BOARD_SIZE - 1, 0);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, yEnd); ctx.stroke();
  }
  for (let i = 0; i < BOARD_SIZE; i++) {
    const { y } = toXY(i, 0);
    const { x } = toXY(0, 0);
    const { x: xEnd } = toXY(0, BOARD_SIZE - 1);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(xEnd, y); ctx.stroke();
  }

  // Border (thicker)
  ctx.strokeStyle = '#5a3e00';
  ctx.lineWidth = 2;
  ctx.strokeRect(
    PADDING, PADDING,
    CELL_SIZE * (BOARD_SIZE - 1),
    CELL_SIZE * (BOARD_SIZE - 1)
  );

  // Star points
  for (const [r, c] of STAR_POINTS) {
    const { x, y } = toXY(r, c);
    ctx.fillStyle = '#5a3e00';
    ctx.beginPath();
    ctx.arc(x, y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawGomokuStones(ctx, board, lastMove, winLine) {
  if (!ctx) return;
  const winSet = new Set();
  if (winLine) {
    for (const { row, col } of winLine) winSet.add(`${row},${col}`);
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const color = board[r][c];
      if (!color) continue;
      const { x, y } = toXY(r, c);
      const inWin = winSet.has(`${r},${c}`);
      drawStone(ctx, x, y, color, inWin);
    }
  }

  // Last move marker
  if (lastMove && board[lastMove.row][lastMove.col]) {
    const { x, y } = toXY(lastMove.row, lastMove.col);
    ctx.fillStyle = '#e00';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStone(ctx, x, y, color, highlight) {
  const r = CELL_SIZE * 0.46;

  if (highlight) {
    // Gold glow for win line
    ctx.shadowColor = '#ffd700';
    ctx.shadowBlur  = 12;
  } else {
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur  = 5;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  }

  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);

  if (color === 'black') {
    grad.addColorStop(0, '#666');
    grad.addColorStop(1, '#000');
  } else {
    grad.addColorStop(0, '#fff');
    grad.addColorStop(1, '#ccc');
  }

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  if (color === 'white') {
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  if (highlight) {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Reset shadow
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur  = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export function pixelToGomokuGrid(canvasEl, px, py) {
  if (!canvasEl) return null;
  const rect = canvasEl.getBoundingClientRect();
  const scaleX = CANVAS_SIZE / rect.width;
  const scaleY = CANVAS_SIZE / rect.height;
  const lx = (px - rect.left) * scaleX;
  const ly = (py - rect.top)  * scaleY;

  const col = Math.round((lx - PADDING) / CELL_SIZE);
  const row = Math.round((ly - PADDING) / CELL_SIZE);

  if (col < 0 || col >= BOARD_SIZE || row < 0 || row >= BOARD_SIZE) return null;

  // Only snap if click is within half a cell
  const { x, y } = toXY(row, col);
  const dist = Math.hypot(lx - x, ly - y);
  if (dist > CELL_SIZE * 0.5) return null;

  return { row, col };
}

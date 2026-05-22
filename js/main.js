import { GameState, BoardState } from './game.js';
import { PIECE_TYPES, COLOR } from './constants.js';
import {
  initCanvas, drawBoard, drawPieces, drawHighlights, clearCanvas, pixelToGrid, gridToPixel
} from './board.js';
import { getBestMove } from './ai.js';

// ── game state ────────────────────────────────────────────────────────────────
let gameState = new GameState();
let uiCanvas = null;

// ── AI state ──────────────────────────────────────────────────────────────────
let aiRed   = false;
let aiBlack = false;
let aiDepth = 2;
let aiThinking = false;

// ── setup-mode state ──────────────────────────────────────────────────────────
let isSetupMode = false;
let setupColor = COLOR.RED;
let setupPieceType = null;
let savedLayout = null;

// Palette definitions
const RED_PALETTE = [
  { type: PIECE_TYPES.GENERAL,  label: '將' },
  { type: PIECE_TYPES.ADVISOR,  label: '士' },
  { type: PIECE_TYPES.ELEPHANT, label: '象' },
  { type: PIECE_TYPES.HORSE,    label: '馬' },
  { type: PIECE_TYPES.ROOK_C,   label: '車' },
  { type: PIECE_TYPES.CANNON,   label: '砲' },
  { type: PIECE_TYPES.SOLDIER,  label: '兵' }
];
const BLACK_PALETTE = [
  { type: PIECE_TYPES.KING,   label: '♔' },
  { type: PIECE_TYPES.QUEEN,  label: '♕' },
  { type: PIECE_TYPES.ROOK_I, label: '♖' },
  { type: PIECE_TYPES.BISHOP, label: '♗' },
  { type: PIECE_TYPES.KNIGHT, label: '♘' },
  { type: PIECE_TYPES.PAWN,   label: '♙' }
];

// ── init ──────────────────────────────────────────────────────────────────────
export function initGame() {
  const boardCanvas = document.getElementById('board-canvas');
  uiCanvas = document.getElementById('ui-canvas');

  initCanvas(boardCanvas);
  initCanvas(uiCanvas);

  buildPalette();
  bindEvents();
  render();
}

function buildPalette() {
  renderPalette(setupColor);
}

function renderPalette(color) {
  const palette = document.getElementById('piece-palette');
  palette.innerHTML = '';
  const list = color === COLOR.RED ? RED_PALETTE : BLACK_PALETTE;
  list.forEach(({ type, label }) => {
    const btn = document.createElement('button');
    btn.className = 'palette-piece' + (color === COLOR.RED ? ' red' : ' black');
    btn.dataset.type = type;
    btn.textContent = label;
    btn.title = type;
    if (setupPieceType === type && setupColor === color) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      setupColor = color;
      setupPieceType = type;
      // unset erase
      document.getElementById('erase-tool-btn').classList.remove('active');
      highlightPaletteSelection();
    });
    palette.appendChild(btn);
  });
}

function highlightPaletteSelection() {
  document.querySelectorAll('.palette-piece').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.type === setupPieceType);
  });
}

function bindEvents() {
  uiCanvas.addEventListener('click', handleCanvasClick);
  uiCanvas.addEventListener('contextmenu', handleCanvasRightClick);
  document.getElementById('reset-btn').addEventListener('click', handleReset);
  document.getElementById('setup-mode-btn').addEventListener('click', toggleSetupMode);

  // AI controls
  document.getElementById('ai-red-check').addEventListener('change', e => {
    aiRed = e.target.checked; scheduleAI();
  });
  document.getElementById('ai-black-check').addEventListener('change', e => {
    aiBlack = e.target.checked; scheduleAI();
  });
  document.getElementById('ai-depth-sel').addEventListener('change', e => {
    aiDepth = parseInt(e.target.value, 10);
  });

  // Color switcher
  document.getElementById('sel-color-red').addEventListener('click', () => {
    setupColor = COLOR.RED;
    setupPieceType = null;
    document.getElementById('sel-color-red').classList.add('active');
    document.getElementById('sel-color-black').classList.remove('active');
    renderPalette(COLOR.RED);
  });
  document.getElementById('sel-color-black').addEventListener('click', () => {
    setupColor = COLOR.BLACK;
    setupPieceType = null;
    document.getElementById('sel-color-red').classList.remove('active');
    document.getElementById('sel-color-black').classList.add('active');
    renderPalette(COLOR.BLACK);
  });

  // Erase tool
  document.getElementById('erase-tool-btn').addEventListener('click', () => {
    setupPieceType = null;
    document.getElementById('erase-tool-btn').classList.toggle('active');
    highlightPaletteSelection();
  });

  // Board actions
  document.getElementById('clear-board-btn').addEventListener('click', () => {
    if (!confirm('清空棋盘？')) return;
    gameState.board = new BoardState();
    render();
  });
  document.getElementById('reset-default-btn').addEventListener('click', () => {
    if (!confirm('恢复默认布局？')) return;
    gameState.reset();
    render();
  });
  document.getElementById('save-layout-btn').addEventListener('click', saveLayout);
  document.getElementById('load-layout-btn').addEventListener('click', loadLayout);
  document.getElementById('play-custom-btn').addEventListener('click', startGameWithLayout);
}

// ── canvas events ─────────────────────────────────────────────────────────────
function handleCanvasClick(e) {
  const rect = uiCanvas.getBoundingClientRect();
  const { col, row } = pixelToGrid(e.clientX - rect.left, e.clientY - rect.top);

  if (isSetupMode) {
    handleSetupClick(col, row);
  } else {
    if (gameState.status === 'checkmate') return;
    if (aiThinking) return;
    // Block click if it's an AI turn
    const isAITurn = (gameState.currentTurn === COLOR.RED && aiRed) ||
                     (gameState.currentTurn === COLOR.BLACK && aiBlack);
    if (isAITurn) return;

    gameState.selectPiece(col, row);
    render();
    scheduleAI();
  }
}

function handleCanvasRightClick(e) {
  e.preventDefault();
  if (!isSetupMode) return;
  const rect = uiCanvas.getBoundingClientRect();
  const { col, row } = pixelToGrid(e.clientX - rect.left, e.clientY - rect.top);
  gameState.board.removePiece(col, row);
  render();
}

function handleSetupClick(col, row) {
  const eraseActive = document.getElementById('erase-tool-btn').classList.contains('active');
  if (eraseActive || setupPieceType === null) {
    gameState.board.removePiece(col, row);
  } else {
    gameState.board.removePiece(col, row);
    gameState.board.addPiece({ type: setupPieceType, color: setupColor, col, row, hasMoved: false });
  }
  render();
}

// ── AI scheduling ─────────────────────────────────────────────────────────────
function scheduleAI() {
  if (isSetupMode) return;
  if (gameState.status !== 'ongoing') return;
  const isAITurn = (gameState.currentTurn === COLOR.RED && aiRed) ||
                   (gameState.currentTurn === COLOR.BLACK && aiBlack);
  if (!isAITurn || aiThinking) return;

  aiThinking = true;
  updateStatusBar(); // show "思考中..."
  setTimeout(() => {
    const move = getBestMove(gameState, gameState.currentTurn, aiDepth);
    aiThinking = false;
    if (move) {
      gameState.selectPiece(move.from.col, move.from.row);
      gameState.executeMove(move);
    }
    render();
    // Chain: if the next player is also AI, schedule again
    setTimeout(() => scheduleAI(), 400);
  }, 80);
}

// ── setup mode toggle ─────────────────────────────────────────────────────────
function toggleSetupMode() {
  if (isSetupMode) {
    // Ask if user wants to play or just close
    startGameWithLayout();
  } else {
    isSetupMode = true;
    setupPieceType = null;
    document.getElementById('setup-panel').style.display = 'block';
    document.getElementById('setup-mode-btn').textContent = '退出摆子';
    updateStatusBar();
  }
}

function startGameWithLayout() {
  const pieces = gameState.board.pieces.map(p => ({ ...p }));
  gameState = new GameState(pieces);
  isSetupMode = false;
  document.getElementById('setup-panel').style.display = 'none';
  document.getElementById('setup-mode-btn').textContent = '摆子模式';
  render();
}

// ── save / load ───────────────────────────────────────────────────────────────
function saveLayout() {
  const layout = gameState.board.pieces.map(({ type, color, col, row }) => ({ type, color, col, row }));
  try {
    localStorage.setItem('chess_custom_layout', JSON.stringify(layout));
    savedLayout = layout;
    showToast('布局已保存！');
  } catch (e) {
    alert('保存失败：' + e.message);
  }
}

function loadLayout() {
  try {
    const raw = localStorage.getItem('chess_custom_layout');
    if (!raw) { alert('没有保存的布局'); return; }
    const pieces = JSON.parse(raw);
    gameState.board = new BoardState();
    pieces.forEach(p => gameState.board.addPiece({ ...p, hasMoved: false }));
    savedLayout = pieces;
    render();
    showToast('布局已加载！');
  } catch (e) {
    alert('加载失败：' + e.message);
  }
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast show';
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ── reset (normal mode) ───────────────────────────────────────────────────────
function handleReset() {
  aiThinking = false;
  gameState.reset();
  render();
  scheduleAI();
}

// ── render ────────────────────────────────────────────────────────────────────
export function render() {
  clearCanvas();
  drawBoard();
  drawPieces(gameState.board, gameState.board.pieces);

  if (isSetupMode) {
    drawSetupGrid();
  } else {
    const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1]?.move;
    drawHighlights(gameState.selectedPiece, gameState.validMoves, lastMove, gameState.checkCell, gameState.board.cells);
  }

  updateStatusBar();
}

// Draw faint cell dots in setup mode so every intersection is visible
function drawSetupGrid() {
  drawHighlights(null, [], null, null, null);
}

function updateStatusBar() {
  const status = document.getElementById('status');
  if (isSetupMode) {
    const sel = setupPieceType
      ? `已选: ${setupColor === COLOR.RED ? '红' : '黑'}${setupPieceType}`
      : '点击棋盘放子，右键删除';
    status.textContent = `摆子模式  |  ${sel}`;
    return;
  }
  if (aiThinking) {
    status.textContent = `🤖 AI 思考中...`;
    return;
  }
  const who = gameState.currentTurn === COLOR.RED ? '红方 (中国象棋)' : '黑方 (国际象棋)';
  const isAI = (gameState.currentTurn === COLOR.RED && aiRed) ||
               (gameState.currentTurn === COLOR.BLACK && aiBlack);
  let text = `当前回合: ${who}${isAI ? ' 🤖' : ''}`;
  if (gameState.status === 'check')     text += '  ⚠️ 将军!';
  if (gameState.status === 'checkmate') {
    const w = gameState.winner === COLOR.RED ? '红方' : '黑方';
    text = `✓ 将死！${w} 获胜！`;
  }
  status.textContent = text;

  // Update player bar active indicator
  const redBar   = document.getElementById('player-bar-red');
  const blackBar = document.getElementById('player-bar-black');
  if (redBar && blackBar) {
    redBar.classList.toggle('active',   gameState.currentTurn === COLOR.RED);
    blackBar.classList.toggle('active', gameState.currentTurn === COLOR.BLACK);
  }
}

export function getGameState() { return gameState; }

// ── boot ──────────────────────────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}

import { GameState, BoardState } from './intl-game.js';
import { PIECE_TYPES, COLOR } from './intl-constants.js';
import {
  initCanvas, drawBoard, drawPieces, drawHighlights, clearCanvas, pixelToSquare
} from './intl-board.js';
import { getBestMove } from './ai.js';

let gameState = new GameState();
let uiCanvas  = null;

// ── AI state ──────────────────────────────────────────────────────────────────
let aiRed      = false;
let aiBlack    = false;
let aiDepth    = 2;
let aiThinking = false;

// ── setup-mode state ──────────────────────────────────────────────────────────
let isSetupMode    = false;
let setupColor     = COLOR.RED;   // which side
let setupStyle     = 'chinese';   // 'chinese' | 'intl'
let setupPieceType = null;

// Palette definitions
const RED_CHINESE = [
  { type: PIECE_TYPES.GENERAL,  label: '將' },
  { type: PIECE_TYPES.ADVISOR,  label: '士' },
  { type: PIECE_TYPES.ELEPHANT, label: '象' },
  { type: PIECE_TYPES.HORSE,    label: '馬' },
  { type: PIECE_TYPES.ROOK_C,   label: '車' },
  { type: PIECE_TYPES.CANNON,   label: '砲' },
  { type: PIECE_TYPES.SOLDIER,  label: '兵' }
];
const INTL_PIECES = [
  { type: PIECE_TYPES.KING,   label: '♔' },
  { type: PIECE_TYPES.QUEEN,  label: '♕' },
  { type: PIECE_TYPES.ROOK,   label: '♖' },
  { type: PIECE_TYPES.BISHOP, label: '♗' },
  { type: PIECE_TYPES.KNIGHT, label: '♘' },
  { type: PIECE_TYPES.PAWN,   label: '♙' }
];

function paletteClass() {
  const isRed     = setupColor === COLOR.RED;
  const isChinese = setupStyle === 'chinese';
  if (isRed)  return isChinese ? 'red' : 'red';     // red bg for both styles on red side
  return isChinese ? 'black' : 'intl-black';
}
function paletteList() {
  return setupStyle === 'chinese' ? RED_CHINESE : INTL_PIECES;
}

// ── init ──────────────────────────────────────────────────────────────────────
function initGame() {
  const boardCanvas = document.getElementById('intl-board-canvas');
  uiCanvas = document.getElementById('intl-ui-canvas');
  initCanvas(boardCanvas);
  initCanvas(uiCanvas);

  renderPalette();
  bindEvents();
  render();
}

function renderPalette() {
  const palette = document.getElementById('intl-piece-palette');
  palette.innerHTML = '';
  const isRed = setupColor === COLOR.RED;
  paletteList().forEach(({ type, label }) => {
    const btn = document.createElement('button');
    btn.className   = 'palette-piece ' + (isRed ? 'red' : 'black');
    btn.dataset.type = type;
    btn.textContent = label;
    if (setupPieceType === type) btn.classList.add('selected');
    btn.addEventListener('click', () => {
      setupPieceType = type;
      document.getElementById('intl-erase-btn').classList.remove('active');
      refreshPaletteHighlight();
    });
    palette.appendChild(btn);
  });
}

function refreshPaletteHighlight() {
  document.querySelectorAll('#intl-piece-palette .palette-piece').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.type === setupPieceType);
  });
}

function setAxisBtn(axis, value) {
  // axis: 'color' | 'style'
  if (axis === 'color') {
    document.getElementById('intl-sel-red').classList.toggle('active', value === COLOR.RED);
    document.getElementById('intl-sel-black').classList.toggle('active', value === COLOR.BLACK);
    setupColor = value;
  } else {
    document.getElementById('intl-sel-chinese').classList.toggle('active', value === 'chinese');
    document.getElementById('intl-sel-intl').classList.toggle('active', value === 'intl');
    setupStyle = value;
  }
  setupPieceType = null;
  renderPalette();
}

function bindEvents() {
  uiCanvas.addEventListener('click', handleClick);
  uiCanvas.addEventListener('contextmenu', handleRightClick);

  document.getElementById('intl-reset-btn').addEventListener('click', () => {
    aiThinking = false; gameState.reset(); render(); scheduleAI();
  });
  document.getElementById('intl-setup-btn').addEventListener('click', toggleSetup);

  // AI controls
  document.getElementById('intl-ai-red-check').addEventListener('change', e => {
    aiRed = e.target.checked; scheduleAI();
  });
  document.getElementById('intl-ai-black-check').addEventListener('change', e => {
    aiBlack = e.target.checked; scheduleAI();
  });
  document.getElementById('intl-ai-depth-sel').addEventListener('change', e => {
    aiDepth = parseInt(e.target.value, 10);
  });

  // 2-axis palette selectors
  document.getElementById('intl-sel-red').addEventListener('click',     () => setAxisBtn('color', COLOR.RED));
  document.getElementById('intl-sel-black').addEventListener('click',   () => setAxisBtn('color', COLOR.BLACK));
  document.getElementById('intl-sel-chinese').addEventListener('click', () => setAxisBtn('style', 'chinese'));
  document.getElementById('intl-sel-intl').addEventListener('click',    () => setAxisBtn('style', 'intl'));

  document.getElementById('intl-erase-btn').addEventListener('click', () => {
    setupPieceType = null;
    document.getElementById('intl-erase-btn').classList.toggle('active');
    refreshPaletteHighlight();
  });
  document.getElementById('intl-clear-btn').addEventListener('click', () => {
    if (!confirm('清空棋盘？')) return;
    gameState.board = new BoardState(); render();
  });
  document.getElementById('intl-default-btn').addEventListener('click', () => {
    if (!confirm('恢复默认融合布局？')) return;
    gameState.reset(); render();
  });
  document.getElementById('intl-save-btn').addEventListener('click', saveLayout);
  document.getElementById('intl-load-btn').addEventListener('click', loadLayout);
  document.getElementById('intl-play-btn').addEventListener('click', startGame);
}

// ── canvas events ─────────────────────────────────────────────────────────────
function handleClick(e) {
  const rect = uiCanvas.getBoundingClientRect();
  const { col, row } = pixelToSquare(e.clientX - rect.left, e.clientY - rect.top);
  if (isSetupMode) {
    placeOrErase(col, row);
  } else {
    if (gameState.status === 'checkmate' || gameState.status === 'stalemate') return;
    if (aiThinking) return;
    const isAITurn = (gameState.currentTurn === COLOR.RED && aiRed) ||
                     (gameState.currentTurn === COLOR.BLACK && aiBlack);
    if (isAITurn) return;
    gameState.selectPiece(col, row);
    render();
    scheduleAI();
  }
}

function handleRightClick(e) {
  e.preventDefault();
  if (!isSetupMode) return;
  const rect = uiCanvas.getBoundingClientRect();
  const { col, row } = pixelToSquare(e.clientX - rect.left, e.clientY - rect.top);
  gameState.board.removePiece(col, row);
  render();
}

function placeOrErase(col, row) {
  const erasing = document.getElementById('intl-erase-btn').classList.contains('active');
  gameState.board.removePiece(col, row);
  if (!erasing && setupPieceType) {
    gameState.board.addPiece({
      type: setupPieceType, color: setupColor,
      col, row, hasMoved: false
    });
  }
  render();
}

// ── setup toggle ──────────────────────────────────────────────────────────────
function toggleSetup() {
  if (isSetupMode) { startGame(); return; }
  isSetupMode    = true;
  setupPieceType = null;
  document.getElementById('intl-setup-panel').style.display = 'block';
  document.getElementById('intl-setup-btn').textContent = '退出摆子';
  updateBar();
}

function startGame() {
  const pieces = gameState.board.pieces.map(p => ({ ...p }));
  gameState = new GameState(pieces);
  aiThinking = false;
  isSetupMode = false;
  document.getElementById('intl-setup-panel').style.display = 'none';
  document.getElementById('intl-setup-btn').textContent = '摆子模式';
  render();
  scheduleAI();
}

// ── save / load ───────────────────────────────────────────────────────────────
function saveLayout() {
  const layout = gameState.board.pieces.map(({ type, color, col, row }) => ({ type, color, col, row }));
  try {
    localStorage.setItem('intl_hybrid_layout', JSON.stringify(layout));
    toast('布局已保存！');
  } catch (e) { alert('保存失败'); }
}

function loadLayout() {
  try {
    const raw = localStorage.getItem('intl_hybrid_layout');
    if (!raw) { alert('没有保存的布局'); return; }
    const pieces = JSON.parse(raw);
    gameState.board = new BoardState();
    pieces.forEach(p => gameState.board.addPiece({ ...p, hasMoved: false }));
    render(); toast('布局已加载！');
  } catch (e) { alert('加载失败'); }
}

function toast(msg) {
  let t = document.getElementById('intl-toast');
  if (!t) { t = document.createElement('div'); t.id = 'intl-toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ── AI scheduling ─────────────────────────────────────────────────────────────
function scheduleAI() {
  if (isSetupMode) return;
  if (gameState.status !== 'ongoing') return;
  const isAITurn = (gameState.currentTurn === COLOR.RED && aiRed) ||
                   (gameState.currentTurn === COLOR.BLACK && aiBlack);
  if (!isAITurn || aiThinking) return;

  aiThinking = true;
  updateBar();
  setTimeout(() => {
    const move = getBestMove(gameState, gameState.currentTurn, aiDepth);
    aiThinking = false;
    if (move) {
      gameState.selectPiece(move.from.col, move.from.row);
      gameState._execute(move);
    }
    render();
    setTimeout(() => scheduleAI(), 400);
  }, 80);
}

// ── render ────────────────────────────────────────────────────────────────────
function render() {
  clearCanvas();
  drawBoard();
  drawPieces(gameState.board, gameState.board.pieces);
  if (!isSetupMode) {
    const last = gameState.history[gameState.history.length - 1];
    drawHighlights(gameState.selected, gameState.validMoves, last, gameState.checkCell);
  } else {
    drawHighlights(null, [], null, null);
  }
  updateBar();
}

function updateBar() {
  const el = document.getElementById('intl-status');
  if (isSetupMode) {
    const side = setupColor === COLOR.RED ? '红方' : '黑方';
    const kind = setupStyle === 'chinese' ? '中国象棋' : '国际象棋';
    const sel  = setupPieceType ? `已选: ${setupPieceType}` : '点击放子，右键删子';
    el.textContent = `摆子模式 · ${side}${kind}  |  ${sel}`; return;
  }
  if (aiThinking) { el.textContent = '🤖 AI 思考中...'; return; }
  const turn  = gameState.currentTurn === COLOR.RED ? '红方' : '黑方';
  const isAI  = (gameState.currentTurn === COLOR.RED && aiRed) ||
                (gameState.currentTurn === COLOR.BLACK && aiBlack);
  let txt = `当前回合: ${turn}${isAI ? ' 🤖' : ''}`;
  if (gameState.status === 'check')     txt += '  ⚠️ 将军!';
  if (gameState.status === 'checkmate') txt = `✓ 将死！${gameState.winner === COLOR.RED ? '红方' : '黑方'} 获胜！`;
  if (gameState.status === 'stalemate') txt = '逼和！游戏结束';
  el.textContent = txt;

  // Update player bar active indicator
  const redBar   = document.getElementById('intl-player-bar-red');
  const blackBar = document.getElementById('intl-player-bar-black');
  if (redBar && blackBar) {
    redBar.classList.toggle('active',   gameState.currentTurn === COLOR.RED);
    blackBar.classList.toggle('active', gameState.currentTurn === COLOR.BLACK);
  }
}

export function getGameState() { return gameState; }

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initGame);
else initGame();

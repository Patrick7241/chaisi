import { useRef, useState, useEffect, useCallback } from 'react';
import { useDialog } from '../components/Dialog.jsx';
import { GameState, BoardState } from '../game/split-game.js';
import { COLOR, CANVAS_WIDTH, CANVAS_HEIGHT } from '../game/split-constants.js';
import {
  initCanvas, drawBoard, drawPieces, drawHighlights,
  clearCanvas, pixelToGrid, setFlipped, isFlipped
} from '../game/split-board.js';
import { getBestMove } from '../game/ai.js';
import { playMove, playCapture, playSoundForLastMove } from '../game/sounds.js';
import { GameNav } from '../components/GameNav.jsx';

// ── Palettes ─────────────────────────────────────────────────────────────────
const CHINESE_PALETTE = [
  { type: 'general',  label: '將' }, { type: 'advisor',  label: '士' },
  { type: 'elephant', label: '象' }, { type: 'horse',    label: '馬' },
  { type: 'rook_c',   label: '車' }, { type: 'cannon',   label: '砲' },
  { type: 'soldier',  label: '兵' },
];
const INTL_PALETTE = [
  { type: 'king',   label: '♔' }, { type: 'queen',  label: '♕' },
  { type: 'rook_i', label: '♖' }, { type: 'bishop', label: '♗' },
  { type: 'knight', label: '♘' }, { type: 'pawn',   label: '♙' },
];

// ── Initial piece builder (9×10) ──────────────────────────────────────────────
function buildInitialPieces(redStyle, blackStyle) {
  const pieces = [];
  const add = (type, color, col, row) =>
    pieces.push({ type, color, col, row, hasMoved: false });

  if (redStyle === 'intl') {
    // Red International — bottom
    ['rook_i','knight','bishop','queen','king','bishop','knight','rook_i']
      .forEach((t, c) => add(t, COLOR.RED, c, 9));
    for (let c = 0; c < 9; c++) add('pawn', COLOR.RED, c, 8);
  } else {
    // Red Chinese — bottom
    ['rook_c','horse','elephant','advisor','general','advisor','elephant','horse','rook_c']
      .forEach((t, c) => add(t, COLOR.RED, c, 9));
    add('cannon', COLOR.RED, 1, 7); add('cannon', COLOR.RED, 7, 7);
    [0,2,4,6,8].forEach(c => add('soldier', COLOR.RED, c, 6));
  }

  if (blackStyle === 'chinese') {
    // Black Chinese — top
    ['rook_c','horse','elephant','advisor','general','advisor','elephant','horse','rook_c']
      .forEach((t, c) => add(t, COLOR.BLACK, c, 0));
    add('cannon', COLOR.BLACK, 1, 2); add('cannon', COLOR.BLACK, 7, 2);
    [0,2,4,6,8].forEach(c => add('soldier', COLOR.BLACK, c, 3));
  } else {
    // Black International — top
    ['rook_i','knight','bishop','queen','king','bishop','knight','rook_i']
      .forEach((t, c) => add(t, COLOR.BLACK, c, 0));
    for (let c = 0; c < 9; c++) add('pawn', COLOR.BLACK, c, 1);
  }

  return pieces;
}

export default function SplitGame() {
  const boardCanvasRef = useRef(null);
  const uiCanvasRef    = useRef(null);
  const canvasReady    = useRef(false);
  const aiTimerRef     = useRef(null);

  const { confirm, alert, prompt, select } = useDialog();

  // Config refs
  const redStyleRef   = useRef('intl');
  const blackStyleRef = useRef('chinese');
  const firstTurnRef  = useRef(COLOR.RED);

  const gsRef = useRef(null);
  if (!gsRef.current) {
    const pieces = buildInitialPieces('intl', 'chinese');
    gsRef.current = new GameState(pieces, COLOR.RED);
  }

  const aiThinkingRef    = useRef(false);
  const isSetupModeRef   = useRef(false);
  const aiRedRef         = useRef(false);
  const aiBlackRef       = useRef(false);
  const aiDepthRef       = useRef(2);
  const eraseActiveRef   = useRef(false);
  const setupColorRef    = useRef(COLOR.RED);
  const setupPieceTypeRef = useRef(null);

  const [tick,          setTick]          = useState(0);
  const [redStyle,      setRedStyle]      = useState('intl');
  const [blackStyle,    setBlackStyle]    = useState('chinese');
  const [firstTurn,     setFirstTurn]     = useState(COLOR.RED);
  const [isSetupMode,   setIsSetupMode]   = useState(false);
  const [setupColor,    setSetupColor]    = useState(COLOR.RED);
  const [setupPieceType,setSetupPieceType]= useState(null);
  const [eraseActive,   setEraseActive]   = useState(false);
  const [aiRed,         setAiRed]         = useState(false);
  const [aiBlack,       setAiBlack]       = useState(false);
  const [aiDepth,       setAiDepth]       = useState(2);
  const [aiThinking,    setAiThinking]    = useState(false);
  const [toastMsg,      setToastMsg]      = useState('');
  const [toastShow,     setToastShow]     = useState(false);
  const [boardFlipped,  setBoardFlipped]  = useState(false);
  const [promotionMove, setPromotionMove] = useState(null);

  const bump = useCallback(() => setTick(t => t + 1), []);

  function showToast(msg) {
    setToastMsg(msg); setToastShow(true);
    setTimeout(() => setToastShow(false), 2000);
  }

  useEffect(() => {
    initCanvas(boardCanvasRef.current);
    initCanvas(uiCanvasRef.current);
    canvasReady.current = true;
    bump();
    return () => {
      canvasReady.current = false;
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!canvasReady.current) return;
    clearCanvas();
    drawBoard();
    const gs = gsRef.current;
    drawPieces(gs.board, gs.board.pieces);
    if (!isSetupMode) {
      const lastMove = gs.moveHistory[gs.moveHistory.length - 1]?.move;
      drawHighlights(gs.selectedPiece, gs.validMoves, lastMove, gs.checkCell, gs.board.cells);
    } else {
      drawHighlights(null, [], null, null, null);
    }
  }, [tick, isSetupMode]);

  const scheduleAI = useCallback(() => {
    const gs = gsRef.current;
    if (isSetupModeRef.current) return;
    if (gs.status === 'checkmate' || gs.status === 'draw') return;
    const isAITurn = (gs.currentTurn === COLOR.RED   && aiRedRef.current) ||
                     (gs.currentTurn === COLOR.BLACK  && aiBlackRef.current);
    if (!isAITurn || aiThinkingRef.current) return;

    aiThinkingRef.current = true;
    setAiThinking(true);
    bump();

    aiTimerRef.current = setTimeout(() => {
      const move = getBestMove(gsRef.current, gsRef.current.currentTurn, aiDepthRef.current);
      aiThinkingRef.current = false;
      setAiThinking(false);
      if (move) { gsRef.current.executeMove(move); (move.capture ? playCapture() : playMove()); }
      bump();
      aiTimerRef.current = setTimeout(scheduleAI, 400);
    }, 80);
  }, [bump]);

  const handleCanvasClick = useCallback((e) => {
    if (promotionMove) return;
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const sx = CANVAS_WIDTH  / rect.width;
    const sy = CANVAS_HEIGHT / rect.height;
    const rawX = (e.clientX - rect.left) * sx;
    const rawY = (e.clientY - rect.top)  * sy;
    const { col, row } = pixelToGrid(
      isFlipped() ? CANVAS_WIDTH  - rawX : rawX,
      isFlipped() ? CANVAS_HEIGHT - rawY : rawY,
    );

    if (isSetupModeRef.current) {
      gsRef.current.board.removePiece(col, row);
      if (!eraseActiveRef.current && setupPieceTypeRef.current !== null) {
        gsRef.current.board.addPiece({
          type: setupPieceTypeRef.current,
          color: setupColorRef.current,
          col, row, hasMoved: false,
        });
      }
      bump();
    } else {
      const gs = gsRef.current;
      if (gs.status === 'checkmate' || gs.status === 'draw' || aiThinkingRef.current) return;
      const isAITurn = (gs.currentTurn === COLOR.RED   && aiRedRef.current) ||
                       (gs.currentTurn === COLOR.BLACK  && aiBlackRef.current);
      if (isAITurn) return;

      if (gs.selectedPiece) {
        const move = gs.validMoves.find(m => m.to.col === col && m.to.row === row);
        if (move?.needsChoice) { setPromotionMove(move); bump(); return; }
      }

      const _histLen = gs.moveHistory.length;
      gs.selectPiece(col, row);
      if (gs.moveHistory.length > _histLen) playSoundForLastMove(gs);
      bump();
      scheduleAI();
    }
  }, [bump, scheduleAI, promotionMove]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    if (!isSetupModeRef.current) return;
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const sx = CANVAS_WIDTH  / rect.width;
    const sy = CANVAS_HEIGHT / rect.height;
    const rawX = (e.clientX - rect.left) * sx;
    const rawY = (e.clientY - rect.top)  * sy;
    const { col, row } = pixelToGrid(
      isFlipped() ? CANVAS_WIDTH  - rawX : rawX,
      isFlipped() ? CANVAS_HEIGHT - rawY : rawY,
    );
    gsRef.current.board.removePiece(col, row);
    bump();
  }, [bump]);

  const handlePromotion = useCallback((type) => {
    if (!promotionMove) return;
    gsRef.current.executeMove({ ...promotionMove, promotion: type });
    playMove();
    setPromotionMove(null);
    bump();
    scheduleAI();
  }, [promotionMove, bump, scheduleAI]);

  function startNewGame(rStyle, bStyle, fTurn) {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiThinkingRef.current = false;
    setAiThinking(false);
    const pieces = buildInitialPieces(rStyle, bStyle);
    gsRef.current = new GameState(pieces, fTurn);
    bump();
    setTimeout(scheduleAI, 50);
  }

  function handleReset() {
    startNewGame(redStyleRef.current, blackStyleRef.current, firstTurnRef.current);
  }

  function handleUndo() {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiThinkingRef.current = false;
    setAiThinking(false);
    const hasAI = aiRedRef.current || aiBlackRef.current;
    gsRef.current.undoMove(hasAI ? 2 : 1);
    bump();
  }

  function toggleSetupMode() {
    if (isSetupModeRef.current) {
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
      aiThinkingRef.current = false;
      setAiThinking(false);
      const pieces = gsRef.current.board.pieces.map(p => ({ ...p }));
      gsRef.current = new GameState(pieces, firstTurnRef.current);
      isSetupModeRef.current = false;
      setIsSetupMode(false);
      bump();
      scheduleAI();
    } else {
      isSetupModeRef.current = true;
      setIsSetupMode(true);
      setupPieceTypeRef.current = null;
      setSetupPieceType(null);
      bump();
    }
  }

  async function saveLayout() {
    const name = await prompt('为这个布局命名', { title: '保存布局', placeholder: '输入布局名称...', confirmText: '保存' });
    if (!name) return;
    const pieces = gsRef.current.board.pieces.map(({ type, color, col, row }) => ({ type, color, col, row }));
    try {
      const key = 'chess_layouts_split';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push({ name, pieces, createdAt: Date.now() });
      localStorage.setItem(key, JSON.stringify(existing));
      showToast(`布局"${name}"已保存！`);
    } catch (e) { await alert('保存失败：' + e.message, { title: '错误' }); }
  }

  async function loadLayout() {
    try {
      const key = 'chess_layouts_split';
      const layouts = JSON.parse(localStorage.getItem(key) || '[]');
      const oldRaw = localStorage.getItem('chess_split_layout');
      if (oldRaw) layouts.unshift({ name: '已保存布局（旧）', pieces: JSON.parse(oldRaw), createdAt: 0 });
      if (layouts.length === 0) { await alert('没有保存的布局', { title: '提示' }); return; }
      const idx = await select('选择要加载的布局', layouts.map(l => l.name), { title: '加载布局' });
      if (idx === false) return;
      gsRef.current.board = new BoardState();
      layouts[idx].pieces.forEach(p => gsRef.current.board.addPiece({ ...p, hasMoved: false }));
      bump();
      showToast(`布局"${layouts[idx].name}"已加载！`);
    } catch (e) { await alert('加载失败：' + e.message, { title: '错误' }); }
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const gs = gsRef.current;
  const redActive   = !isSetupMode && gs.currentTurn === COLOR.RED;
  const blackActive = !isSetupMode && gs.currentTurn === COLOR.BLACK;
  const redLabel    = redStyle   === 'intl'    ? '国际象棋' : '中国象棋';
  const blackLabel  = blackStyle === 'chinese' ? '中国象棋' : '国际象棋';
  const redAvatar   = redStyle   === 'intl'    ? '♔' : '將';
  const blackAvatar = blackStyle === 'chinese' ? '將' : '♚';

  let statusText = '';
  if (isSetupMode) {
    const sel = setupPieceType ? `已选: ${setupPieceType}` : '点击放子，右键删子';
    statusText = `摆子模式  |  ${sel}`;
  } else if (aiThinking) {
    statusText = '🤖 AI 思考中...';
  } else {
    const who  = gs.currentTurn === COLOR.RED ? `红方 (${redLabel})` : `黑方 (${blackLabel})`;
    const isAI = (gs.currentTurn === COLOR.RED && aiRed) || (gs.currentTurn === COLOR.BLACK && aiBlack);
    statusText = `当前回合: ${who}${isAI ? ' 🤖' : ''}`;
    if (gs.status === 'check')     statusText += '  ⚠️ 将军!';
    if (gs.status === 'draw')      statusText = '三重复局！平局';
    if (gs.status === 'checkmate') {
      const w = gs.winner === COLOR.RED ? '红方' : '黑方';
      statusText = `✓ 将死！${w} 获胜！`;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="title-main">分界象棋</span>
          <span className="title-sub">跨界中国象棋棋盘 · 9×10</span>
        </div>
        <GameNav />
      </header>

      <div className="game-layout">
        <div className="board-area">
          <div className={`player-bar${blackActive ? ' active' : ''}`}>
            <div className={`player-avatar ${blackStyle === 'chinese' ? 'black-avatar' : 'white-avatar'}`}
                 style={blackStyle === 'chinese' ? { background: 'radial-gradient(circle at 35% 35%,#484848,#0d0d0d)', color:'#ccc', border:'2px solid #000' } : {}}>
              {blackAvatar}
            </div>
            <div className="player-info">
              <span className="player-name">黑方</span>
              <span className="player-sub">{blackLabel}（上半区）</span>
            </div>
            <div className="player-turn-dot" />
          </div>

          <div className="board-container">
            <div className={`canvas-wrapper${boardFlipped ? ' board-flipped' : ''}`}>
              <canvas ref={boardCanvasRef} id="board-canvas" />
              <canvas ref={uiCanvasRef} id="ui-canvas"
                onClick={handleCanvasClick} onContextMenu={handleContextMenu} />
              {promotionMove && (
                <div className="promotion-overlay">
                  <div className="promotion-dialog">
                    <div className="promo-title">选择升变棋子</div>
                    <div className="promo-pieces">
                      {[{t:'queen',s:'♕'},{t:'rook',s:'♖'},{t:'bishop',s:'♗'},{t:'knight',s:'♘'}].map(({t,s})=>(
                        <button key={t} className={`promo-piece ${gsRef.current.currentTurn}`} onClick={()=>handlePromotion(t)}>{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`player-bar${redActive ? ' active' : ''}`}>
            <div className={`player-avatar ${redStyle === 'intl' ? 'red-avatar' : 'red-avatar'}`}>
              {redAvatar}
            </div>
            <div className="player-info">
              <span className="player-name">红方</span>
              <span className="player-sub">{redLabel}（下半区）</span>
            </div>
            <div className="player-turn-dot" />
          </div>
        </div>

        <aside className="side-panel">
          <div className="status-card">{statusText}</div>

          <div className="action-row">
            <button className="btn btn-secondary" onClick={toggleSetupMode}>
              {isSetupMode ? '退出摆子' : '摆子模式'}
            </button>
            <button className="btn btn-secondary" onClick={() => {
              const next = !boardFlipped; setBoardFlipped(next); setFlipped(next); bump();
            }}>↕ 翻转</button>
            <button className="btn btn-secondary" onClick={handleUndo}
              disabled={isSetupMode || gs.moveHistory.length === 0}>悔棋</button>
            <button className="btn btn-primary" onClick={handleReset}>重新开始</button>
          </div>

          {/* Game config */}
          <div className="card">
            <div className="card-title">对局设置</div>
            <div className="hybrid-config">
              <div className="config-row">
                <span className="config-label">红方棋种</span>
                <div className="config-btns">
                  <button className={`config-btn${redStyle === 'chinese' ? ' active' : ''}`}
                    onClick={() => { redStyleRef.current = 'chinese'; setRedStyle('chinese'); }}>中国象棋</button>
                  <button className={`config-btn${redStyle === 'intl' ? ' active' : ''}`}
                    onClick={() => { redStyleRef.current = 'intl'; setRedStyle('intl'); }}>国际象棋</button>
                </div>
              </div>
              <div className="config-row">
                <span className="config-label">黑方棋种</span>
                <div className="config-btns">
                  <button className={`config-btn${blackStyle === 'chinese' ? ' active' : ''}`}
                    onClick={() => { blackStyleRef.current = 'chinese'; setBlackStyle('chinese'); }}>中国象棋</button>
                  <button className={`config-btn${blackStyle === 'intl' ? ' active' : ''}`}
                    onClick={() => { blackStyleRef.current = 'intl'; setBlackStyle('intl'); }}>国际象棋</button>
                </div>
              </div>
              <div className="config-row">
                <span className="config-label">先手</span>
                <div className="config-btns">
                  <button className={`config-btn${firstTurn === COLOR.RED ? ' active' : ''}`}
                    onClick={() => { firstTurnRef.current = COLOR.RED; setFirstTurn(COLOR.RED); }}>红方</button>
                  <button className={`config-btn${firstTurn === COLOR.BLACK ? ' active' : ''}`}
                    onClick={() => { firstTurnRef.current = COLOR.BLACK; setFirstTurn(COLOR.BLACK); }}>黑方</button>
                </div>
              </div>
              <button className="btn btn-primary" style={{ width: '100%', marginTop: 8 }}
                onClick={() => startNewGame(redStyleRef.current, blackStyleRef.current, firstTurnRef.current)}>
                应用设置并开始
              </button>
            </div>
          </div>

          {/* AI controls */}
          <div className="card">
            <div className="card-title">AI 对弈</div>
            <div className="ai-controls">
              <label className="ai-toggle">
                <input type="checkbox" checked={aiRed} onChange={e => {
                  aiRedRef.current = e.target.checked; setAiRed(e.target.checked); scheduleAI();
                }} /> 红方 AI
              </label>
              <label className="ai-toggle">
                <input type="checkbox" checked={aiBlack} onChange={e => {
                  aiBlackRef.current = e.target.checked; setAiBlack(e.target.checked); scheduleAI();
                }} /> 黑方 AI
              </label>
            </div>
            <div className="ai-depth-row">
              <span className="card-label">难度:</span>
              <select value={aiDepth} onChange={e => { aiDepthRef.current = +e.target.value; setAiDepth(+e.target.value); }}>
                <option value={1}>简单</option>
                <option value={2}>普通</option>
                <option value={3}>困难</option>
              </select>
            </div>
          </div>

          {/* Setup panel */}
          {isSetupMode && (
            <div className="card">
              <div className="setup-header">
                <span className="setup-title">摆子模式</span>
                <div className="color-select">
                  <button id="sel-color-red"
                    className={`color-btn${setupColor === COLOR.RED ? ' active' : ''}`}
                    onClick={() => { setupColorRef.current = COLOR.RED; setupPieceTypeRef.current = null; setSetupColor(COLOR.RED); setSetupPieceType(null); }}>红方</button>
                  <button id="sel-color-black"
                    className={`color-btn${setupColor === COLOR.BLACK ? ' active' : ''}`}
                    onClick={() => { setupColorRef.current = COLOR.BLACK; setupPieceTypeRef.current = null; setSetupColor(COLOR.BLACK); setSetupPieceType(null); }}>黑方</button>
                </div>
                <div className="setup-tools">
                  <button className={`tool-btn${eraseActive ? ' active' : ''}`} onClick={() => {
                    const v = !eraseActiveRef.current; eraseActiveRef.current = v; setEraseActive(v);
                    setupPieceTypeRef.current = null; setSetupPieceType(null);
                  }}>🧹 橡皮擦</button>
                  <button className="tool-btn" onClick={async () => {
                    if (!await confirm('清空棋盘？', { title: '清空棋盘', confirmText: '确定清空', cancelText: '取消' })) return;
                    gsRef.current.board = new BoardState(); bump();
                  }}>清空棋盘</button>
                  <button className="tool-btn" onClick={async () => {
                    if (!await confirm('恢复默认布局？', { title: '恢复默认', confirmText: '确定恢复', cancelText: '取消' })) return;
                    const pieces = buildInitialPieces(redStyleRef.current, blackStyleRef.current);
                    gsRef.current.board = new BoardState();
                    pieces.forEach(p => gsRef.current.board.addPiece({ ...p }));
                    bump();
                  }}>恢复默认</button>
                </div>
              </div>

              <div style={{ marginBottom: 4, fontSize: '0.75rem', color: '#888' }}>中国象棋</div>
              <div className="piece-palette">
                {CHINESE_PALETTE.map(({ type, label }) => (
                  <button key={type}
                    className={`palette-piece ${setupColor === COLOR.RED ? 'red' : 'black'}${setupPieceType === type ? ' selected' : ''}`}
                    onClick={() => { setupPieceTypeRef.current = type; eraseActiveRef.current = false; setSetupPieceType(type); setEraseActive(false); }}
                  >{label}</button>
                ))}
              </div>
              <div style={{ marginBottom: 4, marginTop: 8, fontSize: '0.75rem', color: '#888' }}>国际象棋</div>
              <div className="piece-palette">
                {INTL_PALETTE.map(({ type, label }) => (
                  <button key={type}
                    className={`palette-piece ${setupColor === COLOR.RED ? 'red' : 'black'}${setupPieceType === type ? ' selected' : ''}`}
                    onClick={() => { setupPieceTypeRef.current = type; eraseActiveRef.current = false; setSetupPieceType(type); setEraseActive(false); }}
                  >{label}</button>
                ))}
              </div>

              <div className="setup-footer">
                <div className="setup-hint">左键放子 · 右键删子</div>
                <div className="setup-actions">
                  <button onClick={saveLayout}>💾 保存布局</button>
                  <button onClick={loadLayout}>📂 加载布局</button>
                  <button className="play-btn" onClick={toggleSetupMode}>▶ 完成摆子，开始对局</button>
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-title">分界规则</div>
            <div className="rules">
              <ul>
                <li><strong>红方:</strong> {redLabel}（下半区，行6-10）</li>
                <li><strong>黑方:</strong> {blackLabel}（上半区，行1-5）</li>
                <li><strong>过界变法:</strong> 棋子进入对方区域时走法改变</li>
                <li><strong>将/王照面:</strong> 同列中间无子则禁止</li>
                <li><strong>升变:</strong> 兵/♙到底线升变为后</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      <div className={`toast${toastShow ? ' show' : ''}`}>{toastMsg}</div>
    </div>
  );
}

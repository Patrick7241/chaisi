import { useRef, useState, useEffect, useCallback } from 'react';
import { useDialog } from '../components/Dialog.jsx';
import { GameState, BoardState } from '../game/pure-intl-game.js';
import { COLOR, CANVAS_SIZE } from '../game/intl-constants.js';
import {
  initCanvas, drawBoard, drawPieces, drawHighlights,
  clearCanvas, pixelToSquare, setFlipped, isFlipped, setWhiteMode
} from '../game/intl-board.js';
import { getBestMove } from '../game/ai.js';
import { playMove, playCapture, playSoundForLastMove } from '../game/sounds.js';
import { GameNav } from '../components/GameNav.jsx';

const INTL_PALETTE = [
  { type: 'king',   label: '♔' },
  { type: 'queen',  label: '♕' },
  { type: 'rook',   label: '♖' },
  { type: 'bishop', label: '♗' },
  { type: 'knight', label: '♘' },
  { type: 'pawn',   label: '♙' },
];

export default function PureIntlGame() {
  const boardCanvasRef = useRef(null);
  const uiCanvasRef    = useRef(null);
  const canvasReady    = useRef(false);
  const aiTimerRef     = useRef(null);

  const { confirm, alert, prompt, select } = useDialog();

  const gsRef = useRef(null);
  if (!gsRef.current) gsRef.current = new GameState();

  const aiThinkingRef     = useRef(false);
  const isSetupModeRef    = useRef(false);
  const aiRedRef          = useRef(false);
  const aiBlackRef        = useRef(false);
  const aiDepthRef        = useRef(2);
  const eraseActiveRef    = useRef(false);
  const setupColorRef     = useRef(COLOR.RED);
  const setupPieceTypeRef = useRef(null);

  const [tick,           setTick]           = useState(0);
  const [isSetupMode,    setIsSetupMode]    = useState(false);
  const [setupColor,     setSetupColor]     = useState(COLOR.RED);
  const [setupPieceType, setSetupPieceType] = useState(null);
  const [eraseActive,    setEraseActive]    = useState(false);
  const [aiRed,          setAiRed]          = useState(false);
  const [aiBlack,        setAiBlack]        = useState(false);
  const [aiDepth,        setAiDepth]        = useState(2);
  const [aiThinking,     setAiThinking]     = useState(false);
  const [toastMsg,       setToastMsg]       = useState('');
  const [toastShow,      setToastShow]      = useState(false);
  const [boardFlipped,   setBoardFlipped]   = useState(false);
  const [promotionMove,  setPromotionMove]  = useState(null);

  const bump = useCallback(() => setTick(t => t + 1), []);

  function showToast(msg) {
    setToastMsg(msg);
    setToastShow(true);
    setTimeout(() => setToastShow(false), 2000);
  }

  useEffect(() => {
    setWhiteMode(true);
    initCanvas(boardCanvasRef.current);
    initCanvas(uiCanvasRef.current);
    canvasReady.current = true;
    bump();
    return () => {
      setWhiteMode(false); // reset when unmounting
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
      const lastMove = gs.history[gs.history.length - 1];
      drawHighlights(gs.selected, gs.validMoves, lastMove, gs.checkCell);
    } else {
      drawHighlights(null, [], null, null);
    }
  }, [tick, isSetupMode]);

  const scheduleAI = useCallback(() => {
    const gs = gsRef.current;
    if (isSetupModeRef.current) return;
    if (gs.status === 'checkmate' || gs.status === 'stalemate' || gs.status === 'draw') return;
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
      if (move) {
        gsRef.current.selectPiece(move.from.col, move.from.row);
        gsRef.current._execute(move);
        (move.capture ? playCapture() : playMove());
      }
      bump();
      aiTimerRef.current = setTimeout(scheduleAI, 400);
    }, 80);
  }, [bump]);

  const handleCanvasClick = useCallback((e) => {
    if (promotionMove) return;
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const s = CANVAS_SIZE / rect.width;
    const rawX = (e.clientX - rect.left) * s;
    const rawY = (e.clientY - rect.top)  * s;
    const { col, row } = pixelToSquare(
      isFlipped() ? CANVAS_SIZE - rawX : rawX,
      isFlipped() ? CANVAS_SIZE - rawY : rawY,
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
      if (gs.status === 'checkmate' || gs.status === 'stalemate' || gs.status === 'draw') return;
      if (aiThinkingRef.current) return;
      const isAITurn = (gs.currentTurn === COLOR.RED   && aiRedRef.current) ||
                       (gs.currentTurn === COLOR.BLACK  && aiBlackRef.current);
      if (isAITurn) return;

      if (gs.selected) {
        const move = gs.validMoves.find(m => m.to.col === col && m.to.row === row);
        if (move?.needsChoice) { setPromotionMove(move); bump(); return; }
      }

      const _histLen = gs.history.length;
      gs.selectPiece(col, row);
      if (gs.history.length > _histLen) playSoundForLastMove(gs);
      bump();
      scheduleAI();
    }
  }, [bump, scheduleAI, promotionMove]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    if (!isSetupModeRef.current) return;
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const s = CANVAS_SIZE / rect.width;
    const rawX = (e.clientX - rect.left) * s;
    const rawY = (e.clientY - rect.top)  * s;
    const { col, row } = pixelToSquare(
      isFlipped() ? CANVAS_SIZE - rawX : rawX,
      isFlipped() ? CANVAS_SIZE - rawY : rawY,
    );
    gsRef.current.board.removePiece(col, row);
    bump();
  }, [bump]);

  const handlePromotion = useCallback((type) => {
    if (!promotionMove) return;
    const move = { ...promotionMove, promotion: type };
    gsRef.current._execute(move);
    setPromotionMove(null);
    bump();
    scheduleAI();
  }, [promotionMove, bump, scheduleAI]);

  function handleReset() {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiThinkingRef.current = false;
    setAiThinking(false);
    gsRef.current.reset();
    bump();
    scheduleAI();
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
      gsRef.current = new GameState(pieces);
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
    const name = await prompt('为这个布局命名', {
      title: '保存布局', placeholder: '输入布局名称...', confirmText: '保存',
    });
    if (!name) return;
    const pieces = gsRef.current.board.pieces.map(({ type, color, col, row }) => ({ type, color, col, row }));
    try {
      const key = 'chess_layouts_pure_intl';
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.push({ name, pieces, createdAt: Date.now() });
      localStorage.setItem(key, JSON.stringify(existing));
      showToast(`布局"${name}"已保存！`);
    } catch (e) { await alert('保存失败：' + e.message, { title: '错误' }); }
  }

  async function loadLayout() {
    try {
      const key = 'chess_layouts_pure_intl';
      const layouts = JSON.parse(localStorage.getItem(key) || '[]');
      if (layouts.length === 0) { await alert('没有保存的布局', { title: '提示' }); return; }
      const idx = await select('选择要加载的布局', layouts.map(l => l.name), { title: '加载布局' });
      if (idx === false) return;
      const chosen = layouts[idx];
      gsRef.current.board = new BoardState();
      chosen.pieces.forEach(p => gsRef.current.board.addPiece({ ...p, hasMoved: false }));
      bump();
      showToast(`布局"${chosen.name}"已加载！`);
    } catch (e) { await alert('加载失败：' + e.message, { title: '错误' }); }
  }

  const gs = gsRef.current;
  const redActive   = !isSetupMode && gs.currentTurn === COLOR.RED;
  const blackActive = !isSetupMode && gs.currentTurn === COLOR.BLACK;

  let statusText = '';
  if (isSetupMode) {
    const side = setupColor === COLOR.RED ? '白方' : '黑方';
    const sel  = setupPieceType ? `已选: ${setupPieceType}` : '点击放子，右键删子';
    statusText = `摆子模式 · ${side}  |  ${sel}`;
  } else if (aiThinking) {
    statusText = '🤖 AI 思考中...';
  } else {
    const who = gs.currentTurn === COLOR.RED ? '白方' : '黑方';
    const isAI = (gs.currentTurn === COLOR.RED && aiRed) || (gs.currentTurn === COLOR.BLACK && aiBlack);
    statusText = `当前回合: ${who}${isAI ? ' 🤖' : ''}`;
    if (gs.status === 'check')     statusText += '  ⚠️ 将军!';
    if (gs.status === 'checkmate') statusText = `✓ 将死！${gs.winner === COLOR.RED ? '白方' : '黑方'} 获胜！`;
    if (gs.status === 'stalemate') statusText = '逼和！游戏结束';
    if (gs.status === 'draw')      statusText = '三重复局！平局';
  }

  const palCls = setupColor === COLOR.RED ? 'intl-white' : 'intl-black';

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="title-main">国际象棋</span>
          <span className="title-sub">标准棋局 · 8×8</span>
        </div>
        <GameNav />
      </header>

      <div className="game-layout">
        <div className="board-area">
          <div className={`player-bar${blackActive ? ' active' : ''}`}>
            <div className="player-avatar black-avatar">♚</div>
            <div className="player-info">
              <span className="player-name">黑方</span>
              <span className="player-sub">国际象棋</span>
            </div>
            <div className="player-turn-dot" />
          </div>

          <div className="board-container">
            <div className={`canvas-wrapper${boardFlipped ? ' board-flipped' : ''}`}>
              <canvas ref={boardCanvasRef} id="intl-board-canvas" />
              <canvas
                ref={uiCanvasRef}
                id="intl-ui-canvas"
                onClick={handleCanvasClick}
                onContextMenu={handleContextMenu}
              />
              {promotionMove && (
                <div className="promotion-overlay">
                  <div className="promotion-dialog">
                    <div className="promo-title">选择升变棋子</div>
                    <div className="promo-pieces">
                      {[{t:'queen',s:'♕'},{t:'rook',s:'♖'},{t:'bishop',s:'♗'},{t:'knight',s:'♘'}].map(({t,s})=>(
                        <button key={t} className={`promo-piece ${gsRef.current.currentTurn === 'red' ? 'white' : 'black'}`} onClick={()=>handlePromotion(t)}>{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className={`player-bar${redActive ? ' active' : ''}`}>
            <div className="player-avatar white-avatar">♔</div>
            <div className="player-info">
              <span className="player-name">白方</span>
              <span className="player-sub">国际象棋</span>
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
              disabled={isSetupMode || gs.history.length === 0}>悔棋</button>
            <button className="btn btn-primary" onClick={handleReset}>重新开始</button>
          </div>

          <div className="card">
            <div className="card-title">AI 对弈</div>
            <div className="ai-controls">
              <label className="ai-toggle">
                <input type="checkbox" checked={aiRed} onChange={e => {
                  aiRedRef.current = e.target.checked; setAiRed(e.target.checked); scheduleAI();
                }} /> 白方 AI
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

          {isSetupMode && (
            <div className="card">
              <div className="setup-header">
                <span className="setup-title">摆子模式</span>
                <div className="color-select">
                  <button className={`color-btn${setupColor === COLOR.RED ? ' active' : ''}`} onClick={() => {
                    setupColorRef.current = COLOR.RED; setupPieceTypeRef.current = null;
                    setSetupColor(COLOR.RED); setSetupPieceType(null);
                  }}>白方</button>
                  <button className={`color-btn${setupColor === COLOR.BLACK ? ' active' : ''}`} onClick={() => {
                    setupColorRef.current = COLOR.BLACK; setupPieceTypeRef.current = null;
                    setSetupColor(COLOR.BLACK); setSetupPieceType(null);
                  }}>黑方</button>
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
                    gsRef.current.reset(); bump();
                  }}>恢复默认</button>
                </div>
              </div>

              <div className="piece-palette">
                {INTL_PALETTE.map(({ type, label }) => (
                  <button
                    key={type}
                    className={`palette-piece ${palCls}${setupPieceType === type ? ' selected' : ''}`}
                    onClick={() => {
                      setupPieceTypeRef.current = type; eraseActiveRef.current = false;
                      setSetupPieceType(type); setEraseActive(false);
                    }}
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
            <div className="card-title">规则说明</div>
            <div className="rules">
              <ul>
                <li><strong>王:</strong> 所有方向走一格，不得进入被攻击的格子</li>
                <li><strong>后:</strong> 横竖斜无限格</li>
                <li><strong>车:</strong> 横竖无限格</li>
                <li><strong>象:</strong> 斜走无限格</li>
                <li><strong>马:</strong> L 型跳跃</li>
                <li><strong>兵:</strong> 向前走一格，初始可走两格；斜前吃子</li>
                <li><strong>王车易位:</strong> 王和车均未移动，中间无子，王不经过被攻击格</li>
                <li><strong>升变:</strong> 兵到达对方底线可升变为后/车/象/马</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      <div className={`toast${toastShow ? ' show' : ''}`}>{toastMsg}</div>
    </div>
  );
}

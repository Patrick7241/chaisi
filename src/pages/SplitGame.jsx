import { useRef, useState, useEffect, useCallback } from 'react';
import { useDialog } from '../components/Dialog.jsx';
import { GameState, BoardState } from '../game/split-game.js';
import { COLOR, CANVAS_WIDTH, CANVAS_HEIGHT } from '../game/split-constants.js';
import {
  initCanvas, drawBoard, drawPieces, drawHighlights,
  clearCanvas, pixelToGrid, setFlipped, isFlipped
} from '../game/split-board.js';
import { getBestMove } from '../game/ai.js';
import { GameNav } from '../components/GameNav.jsx';

const BLACK_PALETTE = [
  { type: 'general', label: '將' }, { type: 'advisor',  label: '士' },
  { type: 'elephant',label: '象' }, { type: 'horse',    label: '馬' },
  { type: 'rook_c',  label: '車' }, { type: 'cannon',   label: '砲' },
  { type: 'soldier', label: '兵' },
];
const RED_PALETTE = [
  { type: 'king',   label: '♔' }, { type: 'queen',  label: '♕' },
  { type: 'rook_i', label: '♖' }, { type: 'bishop', label: '♗' },
  { type: 'knight', label: '♘' }, { type: 'pawn',   label: '♙' },
];

export default function SplitGame() {
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
      if (move) gsRef.current.executeMove(move);
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
      if (gs.status === 'checkmate' || aiThinkingRef.current) return;
      const isAITurn = (gs.currentTurn === COLOR.RED   && aiRedRef.current) ||
                       (gs.currentTurn === COLOR.BLACK  && aiBlackRef.current);
      if (isAITurn) return;

      // Intercept promotion moves before executing
      if (gs.selectedPiece) {
        const move = gs.validMoves.find(m => m.to.col === col && m.to.row === row);
        if (move?.needsChoice) {
          setPromotionMove(move);
          bump();
          return;
        }
      }

      gs.selectPiece(col, row);
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
    const move = { ...promotionMove, promotion: type };
    gsRef.current.executeMove(move);
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
      title: '保存布局',
      placeholder: '输入布局名称...',
      confirmText: '保存',
    });
    if (!name) return;
    const pieces = gsRef.current.board.pieces.map(({ type, color, col, row }) => ({ type, color, col, row }));
    try {
      const storageKey = 'chess_layouts_split';
      const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
      existing.push({ name, pieces, createdAt: Date.now() });
      localStorage.setItem(storageKey, JSON.stringify(existing));
      showToast(`布局"${name}"已保存！`);
    } catch (e) { await alert('保存失败：' + e.message, { title: '错误' }); }
  }

  async function loadLayout() {
    try {
      const storageKey = 'chess_layouts_split';
      const layouts = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const oldRaw = localStorage.getItem('chess_split_layout');
      if (oldRaw) layouts.unshift({ name: '已保存布局（旧）', pieces: JSON.parse(oldRaw), createdAt: 0 });

      if (layouts.length === 0) {
        await alert('没有保存的布局', { title: '提示' });
        return;
      }
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

  let statusText = '';
  if (isSetupMode) {
    const sel = setupPieceType
      ? `已选: ${setupColor === COLOR.RED ? '红' : '黑'}${setupPieceType}`
      : '点击棋盘放子，右键删除';
    statusText = `摆子模式  |  ${sel}`;
  } else if (aiThinking) {
    statusText = '🤖 AI 思考中...';
  } else {
    const who  = gs.currentTurn === COLOR.RED ? '红方 (国际象棋)' : '黑方 (中国象棋)';
    const isAI = (gs.currentTurn === COLOR.RED && aiRed) || (gs.currentTurn === COLOR.BLACK && aiBlack);
    statusText = `当前回合: ${who}${isAI ? ' 🤖' : ''}`;
    if (gs.status === 'check')     statusText += '  ⚠️ 将军!';
    if (gs.status === 'draw')      statusText = '三重复局！平局';
    if (gs.status === 'checkmate') {
      const w = gs.winner === COLOR.RED ? '红方' : '黑方';
      statusText = `✓ 将死！${w} 获胜！`;
    }
  }

  const redActive   = !isSetupMode && gs.currentTurn === COLOR.RED;
  const blackActive = !isSetupMode && gs.currentTurn === COLOR.BLACK;
  const palette     = setupColor === COLOR.RED ? RED_PALETTE : BLACK_PALETTE;

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
            <div className="player-avatar black-avatar">將</div>
            <div className="player-info">
              <span className="player-name">黑方</span>
              <span className="player-sub">中国象棋区（上半）</span>
            </div>
            <div className="player-turn-dot" />
          </div>

          <div className="board-container">
            <div className={`canvas-wrapper${boardFlipped ? ' board-flipped' : ''}`}>
              <canvas ref={boardCanvasRef} id="board-canvas" />
              <canvas
                ref={uiCanvasRef}
                id="ui-canvas"
                onClick={handleCanvasClick}
                onContextMenu={handleContextMenu}
              />
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
            <div className="player-avatar red-avatar">♔</div>
            <div className="player-info">
              <span className="player-name">红方</span>
              <span className="player-sub">国际象棋区（下半）</span>
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
            <button className="btn btn-primary" onClick={handleReset}>重新开始</button>
          </div>

          <div className="card">
            <div className="card-title">AI 对弈</div>
            <div className="ai-controls">
              <label className="ai-toggle">
                <input type="checkbox" checked={aiRed}
                  onChange={e => { aiRedRef.current = e.target.checked; setAiRed(e.target.checked); scheduleAI(); }}
                /> 红方 AI
              </label>
              <label className="ai-toggle">
                <input type="checkbox" checked={aiBlack}
                  onChange={e => { aiBlackRef.current = e.target.checked; setAiBlack(e.target.checked); scheduleAI(); }}
                /> 黑方 AI
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
                  <button id="sel-color-red"
                    className={`color-btn${setupColor === COLOR.RED ? ' active' : ''}`}
                    onClick={() => { setupColorRef.current = COLOR.RED; setupPieceTypeRef.current = null; setSetupColor(COLOR.RED); setSetupPieceType(null); }}
                  >红方</button>
                  <button id="sel-color-black"
                    className={`color-btn${setupColor === COLOR.BLACK ? ' active' : ''}`}
                    onClick={() => { setupColorRef.current = COLOR.BLACK; setupPieceTypeRef.current = null; setSetupColor(COLOR.BLACK); setSetupPieceType(null); }}
                  >黑方</button>
                </div>
                <div className="setup-tools">
                  <button className={`tool-btn${eraseActive ? ' active' : ''}`}
                    onClick={() => { const v = !eraseActiveRef.current; eraseActiveRef.current = v; setEraseActive(v); setupPieceTypeRef.current = null; setSetupPieceType(null); }}
                  >🧹 橡皮擦</button>
                  <button className="tool-btn"
                    onClick={async () => { if (!await confirm('清空棋盘？', { title: '清空棋盘', confirmText: '确定清空', cancelText: '取消' })) return; gsRef.current.board = new BoardState(); bump(); }}
                  >清空棋盘</button>
                  <button className="tool-btn"
                    onClick={async () => { if (!await confirm('恢复默认布局？', { title: '恢复默认', confirmText: '确定恢复', cancelText: '取消' })) return; gsRef.current.reset(); bump(); }}
                  >恢复默认</button>
                </div>
              </div>

              <div className="piece-palette">
                {palette.map(({ type, label }) => (
                  <button key={type}
                    className={`palette-piece ${setupColor === COLOR.RED ? 'red' : 'black'}${setupPieceType === type ? ' selected' : ''}`}
                    onClick={() => { setupPieceTypeRef.current = type; eraseActiveRef.current = false; setSetupPieceType(type); setEraseActive(false); }}
                  >{label}</button>
                ))}
              </div>

              <div className="setup-footer">
                <div className="setup-hint">左键放子 · 右键删子 · 橡皮擦模式点击也可删子</div>
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
                <li><strong>棋盘分界：</strong>上半(行1-5)象棋区，下半(行6-10)国际区</li>
                <li><strong>黑方(象棋)：</strong>在己方区按象棋规则走子</li>
                <li><strong>红方(国际)：</strong>在己方区按国际象棋规则走子</li>
                <li><strong>过界变法：</strong>棋子进入对方区域时走法改变</li>
                <li><strong>将/帅过界：</strong>将变国王(8方向)，♔变将(4方向直走)</li>
                <li><strong>士过界：</strong>变主教(斜线远走)</li>
                <li><strong>象：</strong>只能在象棋区，不可过界</li>
                <li><strong>马/♘过界：</strong>马变马(无蹩腿)，♘变马(有蹩腿)</li>
                <li><strong>炮：</strong>全盘保持炮的走法(隔子打)</li>
                <li><strong>兵过界：</strong>变兵(斜吃+初步两格)；♙过界变卒(直走+横走)</li>
                <li><strong>♗过界：</strong>变象走法(斜两格，蹩腿限制)</li>
                <li><strong>升变：</strong>兵/♙到底线升变为后</li>
                <li><strong>照面：</strong>将与♔同列中间无子则禁止</li>
              </ul>
            </div>
            <div className="piece-list">
              <div className="piece-row">
                <strong>黑方 (中国象棋):</strong>
                <span>將&nbsp;士&nbsp;象&nbsp;馬&nbsp;車&nbsp;砲&nbsp;兵</span>
              </div>
              <div className="piece-row">
                <strong>红方 (国际象棋):</strong>
                <span>♔王&nbsp;♕后&nbsp;♖车&nbsp;♗象&nbsp;♘马&nbsp;♙兵</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <div className={`toast${toastShow ? ' show' : ''}`}>{toastMsg}</div>
    </div>
  );
}

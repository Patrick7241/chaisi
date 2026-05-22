import { useRef, useState, useEffect, useCallback } from 'react';
import { GomokuState } from '../game/gomoku-game.js';
import {
  CANVAS_SIZE,
  initGomokuCanvas,
  clearGomokuCanvas,
  drawGomokuBoard,
  drawGomokuStones,
  pixelToGomokuGrid,
} from '../game/gomoku-board.js';
import { getBestGomokuMove } from '../game/gomoku-ai.js';
import { GameNav } from '../components/GameNav.jsx';

export default function GomokuGame() {
  const canvasRef   = useRef(null);
  const canvasReady = useRef(false);
  const aiTimerRef  = useRef(null);

  const gsRef         = useRef(null);
  if (!gsRef.current) gsRef.current = new GomokuState();

  const aiThinkingRef = useRef(false);
  const aiBlackRef    = useRef(false);
  const aiWhiteRef    = useRef(false);
  const aiDepthRef    = useRef(2);

  const [tick,       setTick]       = useState(0);
  const [aiBlack,    setAiBlack]    = useState(false);
  const [aiWhite,    setAiWhite]    = useState(false);
  const [aiDepth,    setAiDepth]    = useState(2);
  const [aiThinking, setAiThinking] = useState(false);
  const [toastMsg,   setToastMsg]   = useState('');
  const [toastShow,  setToastShow]  = useState(false);

  const bump = useCallback(() => setTick(t => t + 1), []);

  function showToast(msg) {
    setToastMsg(msg);
    setToastShow(true);
    setTimeout(() => setToastShow(false), 2000);
  }

  useEffect(() => {
    initGomokuCanvas(canvasRef.current);
    canvasReady.current = true;
    bump();
    return () => {
      canvasReady.current = false;
      if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!canvasReady.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    clearGomokuCanvas(ctx);
    drawGomokuBoard(ctx);
    const gs = gsRef.current;
    drawGomokuStones(ctx, gs.board, gs.lastMove, gs.winLine);
  }, [tick]);

  const scheduleAI = useCallback(() => {
    const gs = gsRef.current;
    if (gs.status !== 'playing') return;
    const isAITurn = (gs.currentTurn === 'black' && aiBlackRef.current) ||
                     (gs.currentTurn === 'white' && aiWhiteRef.current);
    if (!isAITurn || aiThinkingRef.current) return;

    aiThinkingRef.current = true;
    setAiThinking(true);
    bump();

    aiTimerRef.current = setTimeout(() => {
      const move = getBestGomokuMove(gsRef.current, gsRef.current.currentTurn, aiDepthRef.current);
      aiThinkingRef.current = false;
      setAiThinking(false);
      if (move) gsRef.current.executeMove(move.row, move.col);
      bump();
      aiTimerRef.current = setTimeout(scheduleAI, 400);
    }, 80);
  }, [bump]);

  const handleClick = useCallback((e) => {
    const gs = gsRef.current;
    if (gs.status !== 'playing' || aiThinkingRef.current) return;
    const isAITurn = (gs.currentTurn === 'black' && aiBlackRef.current) ||
                     (gs.currentTurn === 'white' && aiWhiteRef.current);
    if (isAITurn) return;

    const pos = pixelToGomokuGrid(canvasRef.current, e.clientX, e.clientY);
    if (!pos) return;
    const ok = gs.executeMove(pos.row, pos.col);
    if (!ok) return;
    bump();
    if (gs.status === 'win') {
      showToast(`${gs.winner === 'black' ? '黑方' : '白方'} 获胜！`);
      return;
    }
    if (gs.status === 'draw') {
      showToast('平局！');
      return;
    }
    scheduleAI();
  }, [bump, scheduleAI]);

  function handleReset() {
    if (aiTimerRef.current) clearTimeout(aiTimerRef.current);
    aiThinkingRef.current = false;
    setAiThinking(false);
    gsRef.current.reset();
    bump();
    setTimeout(scheduleAI, 50);
  }

  const gs = gsRef.current;
  const blackActive = gs.status === 'playing' && gs.currentTurn === 'black';
  const whiteActive = gs.status === 'playing' && gs.currentTurn === 'white';

  let statusText = '';
  if (aiThinking) {
    statusText = '🤖 AI 思考中...';
  } else if (gs.status === 'win') {
    statusText = `${gs.winner === 'black' ? '黑方' : '白方'} 获胜！`;
  } else if (gs.status === 'draw') {
    statusText = '平局！';
  } else {
    const who = gs.currentTurn === 'black' ? '黑方' : '白方';
    const isAI = (gs.currentTurn === 'black' && aiBlack) || (gs.currentTurn === 'white' && aiWhite);
    statusText = `当前回合: ${who}${isAI ? ' 🤖' : ''}`;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="title-main">五子棋</span>
          <span className="title-sub">标准对局 · 15×15</span>
        </div>
        <GameNav />
      </header>

      <div className="game-layout">
        <div className="board-area">
          <div className={`player-bar${blackActive ? ' active' : ''}`}>
            <div className="player-avatar" style={{ background: 'radial-gradient(circle at 35% 35%, #666, #000)', color: '#fff', fontSize: 18 }}>●</div>
            <div className="player-info">
              <span className="player-name">黑方</span>
              <span className="player-sub">先手</span>
            </div>
            <div className="player-turn-dot" />
          </div>

          <div className="board-container">
            <canvas
              ref={canvasRef}
              style={{ display: 'block', cursor: 'pointer' }}
              onClick={handleClick}
            />
          </div>

          <div className={`player-bar${whiteActive ? ' active' : ''}`}>
            <div className="player-avatar" style={{ background: 'radial-gradient(circle at 35% 35%, #fff, #ccc)', color: '#333', border: '1px solid #ccc', fontSize: 18 }}>●</div>
            <div className="player-info">
              <span className="player-name">白方</span>
              <span className="player-sub">后手</span>
            </div>
            <div className="player-turn-dot" />
          </div>
        </div>

        <aside className="side-panel">
          <div className="status-card">{statusText}</div>

          <div className="action-row">
            <button className="btn btn-primary" onClick={handleReset}>重新开始</button>
          </div>

          <div className="card">
            <div className="card-title">AI 对弈</div>
            <div className="ai-controls">
              <label className="ai-toggle">
                <input type="checkbox" checked={aiBlack} onChange={e => {
                  aiBlackRef.current = e.target.checked;
                  setAiBlack(e.target.checked);
                  setTimeout(scheduleAI, 50);
                }} /> 黑方 AI
              </label>
              <label className="ai-toggle">
                <input type="checkbox" checked={aiWhite} onChange={e => {
                  aiWhiteRef.current = e.target.checked;
                  setAiWhite(e.target.checked);
                  setTimeout(scheduleAI, 50);
                }} /> 白方 AI
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

          <div className="card">
            <div className="card-title">规则说明</div>
            <div className="rules">
              <ul>
                <li><strong>目标:</strong> 在横、纵或斜方向上连成五子即获胜</li>
                <li><strong>落子:</strong> 黑方先行，双方交替落子</li>
                <li><strong>棋盘:</strong> 15×15 标准棋盘</li>
                <li><strong>平局:</strong> 棋盘落满时如无人获胜则为平局</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      <div className={`toast${toastShow ? ' show' : ''}`}>{toastMsg}</div>
    </div>
  );
}

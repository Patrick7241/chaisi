import { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { GameConnection, MSG } from '../network/peer.js';

// ── Board drawing modules ─────────────────────────────────────────────────────
import * as HB from '../game/board.js';
import * as IB from '../game/intl-board.js';
import * as SB from '../game/split-board.js';

// ── Game state classes ────────────────────────────────────────────────────────
import { GameState as HGS } from '../game/game.js';
import { GameState as IGS } from '../game/intl-game.js';
import { GameState as SGS } from '../game/split-game.js';

// ── Canvas dimensions ─────────────────────────────────────────────────────────
import { CANVAS_WIDTH as HW, CANVAS_HEIGHT as HH } from '../game/constants.js';
import { CANVAS_SIZE as IS }                        from '../game/intl-constants.js';
import { CANVAS_WIDTH as SW, CANVAS_HEIGHT as SH }  from '../game/split-constants.js';

// ── Per-board-type config ─────────────────────────────────────────────────────
const CFG = {
  hybrid: {
    label: '混合棋局 9×10', B: HB, GS: HGS,
    W: HW, H: HH, boardId: 'board-canvas', uiId: 'ui-canvas',
    toGrid: HB.pixelToGrid,
    getSelected:  gs => gs.selectedPiece,
    getLastMove:  gs => gs.moveHistory?.[gs.moveHistory.length - 1]?.move ?? null,
    exec:         (gs, mv) => gs.executeMove(mv),
  },
  intl: {
    label: '国际棋局 8×8', B: IB, GS: IGS,
    W: IS, H: IS, boardId: 'intl-board-canvas', uiId: 'intl-ui-canvas',
    toGrid: IB.pixelToSquare,
    getSelected:  gs => gs.selected,
    getLastMove:  gs => gs.history?.[gs.history.length - 1] ?? null,
    exec:         (gs, mv) => gs._execute(mv),
  },
  split: {
    label: '分界棋盘 9×10', B: SB, GS: SGS,
    W: SW, H: SH, boardId: 'board-canvas', uiId: 'ui-canvas',
    toGrid: SB.pixelToGrid,
    getSelected:  gs => gs.selectedPiece,
    getLastMove:  gs => gs.moveHistory?.[gs.moveHistory.length - 1]?.move ?? null,
    exec:         (gs, mv) => gs.executeMove(mv),
  },
};

// Replay all moves onto a fresh game state (used for undo)
function replayMoves(boardType, pieces, moves) {
  const cfg = CFG[boardType];
  const gs = new cfg.GS(pieces ?? null);
  moves.forEach(mv => cfg.exec(gs, mv));
  return gs;
}

export default function MultiGame() {
  // ── Connection / phase state ──────────────────────────────────────────────
  const [phase, setPhase]         = useState('lobby'); // lobby|waiting|playing|over|error
  const [roomCode, setRoomCode]   = useState('');
  const [inputCode, setInputCode] = useState('');
  const [errorMsg, setErrorMsg]   = useState('');
  const [connStatus, setConnStatus] = useState(''); // status text

  // ── Game config ───────────────────────────────────────────────────────────
  const [boardType, setBoardType] = useState('hybrid');
  const [myColor,   setMyColor]   = useState('red');

  // ── In-game UI state ──────────────────────────────────────────────────────
  const [tick,          setTick]          = useState(0);
  const [promotionMove, setPromotionMove] = useState(null);
  const [undoState,     setUndoState]     = useState('idle'); // idle|sent|received
  const [gameResult,    setGameResult]    = useState(null);   // {winner, reason}
  const [toastMsg,      setToastMsg]      = useState('');
  const [toastShow,     setToastShow]     = useState(false);

  // ── Refs (stable across renders) ─────────────────────────────────────────
  const gcRef           = useRef(null);
  const gsRef           = useRef(null);
  const boardCanvasRef  = useRef(null);
  const uiCanvasRef     = useRef(null);
  const canvasReadyRef  = useRef(false);
  const boardTypeRef    = useRef('hybrid');
  const myColorRef      = useRef('red');
  const moveLogRef      = useRef([]);      // all executed moves (for undo replay)
  const initialPiecesRef = useRef(null);  // null = default layout
  const undoStateRef    = useRef('idle');
  const promotionRef    = useRef(null);

  const bump = useCallback(() => setTick(t => t + 1), []);

  function showToast(msg, ms = 2500) {
    setToastMsg(msg);
    setToastShow(true);
    setTimeout(() => setToastShow(false), ms);
  }

  // ── Init canvases when game phase starts ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    // useEffect runs after DOM is committed — canvas refs are populated
    initCanvases();
  }, [phase]); // eslint-disable-line

  // ── Canvas redraw ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasReadyRef.current || !gsRef.current) return;
    const cfg = CFG[boardTypeRef.current];
    const gs  = gsRef.current;
    cfg.B.clearCanvas();
    cfg.B.drawBoard();
    cfg.B.drawPieces(gs.board, gs.board.pieces);
    if (phase === 'playing') {
      const lastMove = cfg.getLastMove(gs);
      cfg.B.drawHighlights(cfg.getSelected(gs), gs.validMoves, lastMove, gs.checkCell, gs.board.cells);
    }
  }, [tick, phase]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => gcRef.current?.destroy();
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const initGame = useCallback((bType, pieces, hostColor, isHost) => {
    const cfg = CFG[bType];
    boardTypeRef.current = bType;
    myColorRef.current   = isHost ? hostColor : (hostColor === 'red' ? 'black' : 'red');
    initialPiecesRef.current = pieces ?? null;
    moveLogRef.current = [];
    gsRef.current = new cfg.GS(pieces ?? null);
    setMyColor(myColorRef.current);
    setBoardType(bType);
  }, []);

  const initCanvases = useCallback(() => {
    const cfg = CFG[boardTypeRef.current];
    if (boardCanvasRef.current) cfg.B.initCanvas(boardCanvasRef.current);
    if (uiCanvasRef.current)    cfg.B.initCanvas(uiCanvasRef.current);
    canvasReadyRef.current = true;
    bump();
  }, [bump]);

  // ── Handle incoming network messages ─────────────────────────────────────
  const handleData = useCallback((data) => {
    const cfg = CFG[boardTypeRef.current];
    switch (data.type) {
      case MSG.GAME_START: {
        // Guest side: receive game config from host
        initGame(data.boardType, data.pieces, data.hostColor, false);
        setPhase('playing');
        break;
      }
      case MSG.MOVE: {
        const gs = gsRef.current;
        cfg.exec(gs, data.move);
        moveLogRef.current.push(data.move);
        bump();
        break;
      }
      case MSG.UNDO_REQUEST: {
        undoStateRef.current = 'received';
        setUndoState('received');
        break;
      }
      case MSG.UNDO_ACCEPT: {
        // Opponent accepted our undo request → apply undo
        const log = moveLogRef.current;
        const newLog = log.slice(0, Math.max(0, log.length - 2));
        moveLogRef.current = newLog;
        gsRef.current = replayMoves(boardTypeRef.current, initialPiecesRef.current, newLog);
        undoStateRef.current = 'idle';
        setUndoState('idle');
        showToast('悔棋成功');
        bump();
        break;
      }
      case MSG.UNDO_REJECT: {
        undoStateRef.current = 'idle';
        setUndoState('idle');
        showToast('对方拒绝了悔棋');
        break;
      }
      case MSG.SURRENDER: {
        const winner = myColorRef.current;
        setGameResult({ winner, reason: '对方投降' });
        setPhase('over');
        break;
      }
    }
  }, [bump, initCanvases, initGame]);

  // ── Setup connection handlers ─────────────────────────────────────────────
  const setupHandlers = useCallback((gc, isHost) => {
    gc.on('connect', () => {
      setConnStatus('● 已连接');
      if (isHost) {
        // Host sends game config to guest
        const hostColor = myColorRef.current;
        const bType     = boardTypeRef.current;
        const pieces    = initialPiecesRef.current;
        gc.send({ type: MSG.GAME_START, boardType: bType, hostColor, pieces });
        setPhase('playing');
      }
    });
    gc.on('data', handleData);
    gc.on('close', () => {
      setConnStatus('● 已断线');
      if (phase !== 'over') showToast('连接已断开', 4000);
    });
    gc.on('error', (err) => {
      setErrorMsg(err.message || String(err));
      setPhase('error');
    });
  }, [handleData, initCanvases, phase]);

  // ── Create room (host) ───────────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    const gc = new GameConnection();
    gcRef.current = gc;
    // Init game state immediately so host can see the board while waiting
    initGame(boardType, initialPiecesRef.current, myColor, true);
    gc.on('open', (code) => {
      setRoomCode(code);
      setPhase('waiting');
    });
    setupHandlers(gc, true);
    gc.host();
  }, [boardType, myColor, initGame, setupHandlers]);

  // ── Join room (guest) ────────────────────────────────────────────────────
  const handleJoin = useCallback(() => {
    if (!inputCode.trim()) return;
    const gc = new GameConnection();
    gcRef.current = gc;
    setConnStatus('● 连接中...');
    gc.on('connect', () => setConnStatus('● 已连接'));
    gc.on('data', handleData);
    gc.on('close', () => setConnStatus('● 已断线'));
    gc.on('error', (err) => { setErrorMsg(err.message || String(err)); setPhase('error'); });
    gc.join(inputCode);
    setPhase('waiting'); // show "connecting..." while waiting for GAME_START
  }, [inputCode, handleData]);

  // ── Canvas click ─────────────────────────────────────────────────────────
  const handleCanvasClick = useCallback((e) => {
    if (promotionRef.current) return;
    const gs = gsRef.current;
    if (!gs) return;
    if (gs.status === 'checkmate' || gs.status === 'stalemate') return;

    // Only allow interaction on your own turn
    if (gs.currentTurn !== myColorRef.current) return;

    const cfg  = CFG[boardTypeRef.current];
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const sx   = cfg.W / rect.width;
    const sy   = cfg.H / rect.height;
    const { col, row } = cfg.toGrid(
      (e.clientX - rect.left) * sx,
      (e.clientY - rect.top)  * sy,
    );

    // Intercept promotion moves
    if (cfg.getSelected(gs)) {
      const move = gs.validMoves.find(m => m.to.col === col && m.to.row === row);
      if (move?.needsChoice) {
        promotionRef.current = move;
        setPromotionMove(move);
        bump();
        return;
      }
    }

    gs.selectPiece(col, row);
    bump();

    // If that click resulted in a move, send it
    const lastMove = cfg.getLastMove(gs);
    if (lastMove && !moveLogRef.current.includes(lastMove)) {
      moveLogRef.current.push(lastMove);
      gcRef.current?.send({ type: MSG.MOVE, move: lastMove });
    }
  }, [bump]);

  // ── Promotion ─────────────────────────────────────────────────────────────
  const handlePromotion = useCallback((pieceType) => {
    const move = promotionRef.current;
    if (!move) return;
    const cfg = CFG[boardTypeRef.current];
    const finalMove = { ...move, promotion: pieceType };
    cfg.exec(gsRef.current, finalMove);
    moveLogRef.current.push(finalMove);
    gcRef.current?.send({ type: MSG.MOVE, move: finalMove });
    promotionRef.current = null;
    setPromotionMove(null);
    bump();
  }, [bump]);

  // ── Surrender ─────────────────────────────────────────────────────────────
  const handleSurrender = useCallback(() => {
    if (!confirm('确定投降？')) return;
    gcRef.current?.send({ type: MSG.SURRENDER });
    const winner = myColorRef.current === 'red' ? 'black' : 'red';
    setGameResult({ winner, reason: '我方投降' });
    setPhase('over');
  }, []);

  // ── Undo request ──────────────────────────────────────────────────────────
  const handleUndoRequest = useCallback(() => {
    if (moveLogRef.current.length === 0) { showToast('没有可悔的棋'); return; }
    if (undoStateRef.current !== 'idle') return;
    gcRef.current?.send({ type: MSG.UNDO_REQUEST });
    undoStateRef.current = 'sent';
    setUndoState('sent');
    showToast('悔棋申请已发送...');
  }, []);

  const handleUndoAccept = useCallback(() => {
    gcRef.current?.send({ type: MSG.UNDO_ACCEPT });
    const log    = moveLogRef.current;
    const newLog = log.slice(0, Math.max(0, log.length - 2));
    moveLogRef.current = newLog;
    gsRef.current = replayMoves(boardTypeRef.current, initialPiecesRef.current, newLog);
    undoStateRef.current = 'idle';
    setUndoState('idle');
    bump();
  }, [bump]);

  const handleUndoReject = useCallback(() => {
    gcRef.current?.send({ type: MSG.UNDO_REJECT });
    undoStateRef.current = 'idle';
    setUndoState('idle');
  }, []);

  // ── Return to lobby ───────────────────────────────────────────────────────
  const handleReturnToLobby = useCallback(() => {
    gcRef.current?.destroy();
    gcRef.current = null;
    canvasReadyRef.current = false;
    gsRef.current = null;
    moveLogRef.current = [];
    setPhase('lobby');
    setRoomCode('');
    setInputCode('');
    setGameResult(null);
    setUndoState('idle');
    setPromotionMove(null);
    setConnStatus('');
    setErrorMsg('');
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const gs         = gsRef.current;
  const cfg        = CFG[boardType] ?? CFG.hybrid;
  const activeCfg  = CFG[boardTypeRef.current] ?? cfg;
  const isMyTurn   = gs && gs.currentTurn === myColorRef.current;
  const oppColor   = myColor === 'red' ? 'black' : 'red';

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Lobby ─────────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="app">
        <header className="app-header">
          <div className="app-title">
            <span className="title-main">局域网对战</span>
            <span className="title-sub">WebRTC · 无需服务器</span>
          </div>
          <Link className="nav-link" to="/">← 返回</Link>
        </header>

        <div className="multi-lobby">
          <div className="lobby-card">
            <div className="lobby-section-title">创建房间</div>
            <div className="lobby-form">
              <label className="lobby-label">棋盘类型</label>
              <select className="lobby-select" value={boardType} onChange={e => setBoardType(e.target.value)}>
                <option value="hybrid">混合棋局 9×10</option>
                <option value="intl">国际棋局 8×8</option>
                <option value="split">分界棋盘 9×10</option>
              </select>
              <label className="lobby-label">我的阵营</label>
              <select className="lobby-select" value={myColor} onChange={e => setMyColor(e.target.value)}>
                <option value="red">红方</option>
                <option value="black">黑方</option>
              </select>
              <SavedLayoutPicker boardType={boardType} onSelect={p => { initialPiecesRef.current = p; }} />
            </div>
            <button className="btn btn-primary lobby-btn" onClick={handleCreate}>创建房间</button>
          </div>

          <div className="lobby-divider">— 或 —</div>

          <div className="lobby-card">
            <div className="lobby-section-title">加入房间</div>
            <input
              className="lobby-input"
              placeholder="输入 6 位房间码"
              value={inputCode}
              onChange={e => setInputCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              maxLength={6}
            />
            <button className="btn btn-primary lobby-btn" onClick={handleJoin}
              disabled={inputCode.trim().length < 3}>加入房间</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Waiting (host waiting for guest, or guest connecting) ─────────────────
  if (phase === 'waiting') {
    return (
      <div className="app">
        <header className="app-header">
          <div className="app-title">
            <span className="title-main">局域网对战</span>
          </div>
          <Link className="nav-link" to="#" onClick={handleReturnToLobby}>← 取消</Link>
        </header>
        <div className="multi-waiting">
          {roomCode ? (
            <>
              <div className="waiting-title">等待对方加入...</div>
              <div className="room-code-box">
                <div className="room-code-label">房间码</div>
                <div className="room-code">{roomCode}</div>
                <button className="copy-btn" onClick={() => { navigator.clipboard.writeText(roomCode); showToast('已复制！'); }}>
                  复制
                </button>
              </div>
              <div className="waiting-hint">将此房间码发给对方，对方输入后即可连接</div>
            </>
          ) : (
            <div className="waiting-title">{connStatus || '连接中...'}</div>
          )}
        </div>
        <div className={`toast${toastShow ? ' show' : ''}`}>{toastMsg}</div>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <div className="app">
        <div className="multi-waiting">
          <div className="waiting-title" style={{ color: '#e04545' }}>连接出错</div>
          <div className="waiting-hint">{errorMsg}</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleReturnToLobby}>返回大厅</button>
        </div>
      </div>
    );
  }

  // ── Game Over ─────────────────────────────────────────────────────────────
  if (phase === 'over') {
    const iWon = gameResult?.winner === myColorRef.current;
    return (
      <div className="app">
        <div className="multi-waiting">
          <div className="waiting-title" style={{ color: iWon ? '#81b64c' : '#e04545' }}>
            {iWon ? '🎉 你赢了！' : '😔 你输了'}
          </div>
          <div className="waiting-hint">{gameResult?.reason}</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={handleReturnToLobby}>返回大厅</button>
        </div>
      </div>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  const redActive   = gs?.currentTurn === 'red';
  const blackActive = gs?.currentTurn === 'black';
  const myTurnLabel = isMyTurn ? '你的回合' : '等待对方...';
  let statusText = myTurnLabel;
  if (gs?.status === 'check')     statusText += '  ⚠️ 将军!';
  if (gs?.status === 'checkmate') {
    const w = gs.winner === myColorRef.current ? '你赢了！' : '你输了';
    statusText = `将死！${w}`;
  }

  // Player labels per board type
  const playerLabels = {
    hybrid: { red: { name: '红方', sub: '中国象棋', avatar: '將' }, black: { name: '黑方', sub: '国际象棋', avatar: '♚' } },
    intl:   { red: { name: '红方', sub: '中国象棋', avatar: '將' }, black: { name: '黑方', sub: '国际象棋', avatar: '♚' } },
    split:  { red: { name: '红方', sub: '国际象棋', avatar: '♔' }, black: { name: '黑方', sub: '中国象棋', avatar: '將' } },
  };
  const labels = playerLabels[boardTypeRef.current] || playerLabels.hybrid;
  const myLabel  = labels[myColorRef.current];
  const oppLabel = labels[oppColor];
  const topLabel  = myColorRef.current === 'black' ? myLabel : oppLabel;
  const botLabel  = myColorRef.current === 'red'   ? myLabel : oppLabel;
  const topColor  = myColorRef.current === 'black' ? myColorRef.current : oppColor;
  const botColor  = myColorRef.current === 'red'   ? myColorRef.current : oppColor;
  const topActive = gs?.currentTurn === topColor;
  const botActive = gs?.currentTurn === botColor;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="title-main">局域网对战</span>
          <span className="title-sub">{activeCfg.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="conn-status">{connStatus}</span>
          <Link className="nav-link" to="#" onClick={() => { if (confirm('确定离开对局？')) handleReturnToLobby(); }}>退出</Link>
        </div>
      </header>

      <div className="game-layout">
        <div className="board-area">
          {/* Top player bar */}
          <div className={`player-bar${topActive ? ' active' : ''}${topColor === 'black' ? ' my-bar' : ''}`}>
            <div className={`player-avatar ${topColor}-avatar`}>{topLabel.avatar}</div>
            <div className="player-info">
              <span className="player-name">{topLabel.name}{topColor === myColorRef.current ? ' (我)' : ' (对方)'}</span>
              <span className="player-sub">{topLabel.sub}</span>
            </div>
            <div className="player-turn-dot" />
          </div>

          <div className="board-container">
            <div className="canvas-wrapper" key={boardTypeRef.current}>
              <canvas ref={boardCanvasRef} id={activeCfg.boardId} />
              <canvas ref={uiCanvasRef} id={activeCfg.uiId}
                onClick={handleCanvasClick}
                style={{ cursor: isMyTurn ? 'pointer' : 'default' }}
              />
              {promotionMove && (
                <div className="promotion-overlay">
                  <div className="promotion-dialog">
                    <div className="promo-title">选择升变棋子</div>
                    <div className="promo-pieces">
                      {[{ t: 'queen', s: '♕' }, { t: 'rook', s: '♖' }, { t: 'bishop', s: '♗' }, { t: 'knight', s: '♘' }].map(({ t, s }) => (
                        <button key={t} className={`promo-piece ${gs?.currentTurn}`} onClick={() => handlePromotion(t)}>{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {undoState === 'received' && (
                <div className="promotion-overlay">
                  <div className="promotion-dialog">
                    <div className="promo-title">对方申请悔棋</div>
                    <div className="promo-pieces">
                      <button className="btn btn-primary" onClick={handleUndoAccept}>同意</button>
                      <button className="btn btn-secondary" onClick={handleUndoReject}>拒绝</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom player bar */}
          <div className={`player-bar${botActive ? ' active' : ''}${botColor === myColorRef.current ? ' my-bar' : ''}`}>
            <div className={`player-avatar ${botColor}-avatar`}>{botLabel.avatar}</div>
            <div className="player-info">
              <span className="player-name">{botLabel.name}{botColor === myColorRef.current ? ' (我)' : ' (对方)'}</span>
              <span className="player-sub">{botLabel.sub}</span>
            </div>
            <div className="player-turn-dot" />
          </div>
        </div>

        {/* Side panel */}
        <aside className="side-panel">
          <div className="status-card">{statusText}</div>

          <div className="action-row">
            <button className="btn btn-secondary"
              onClick={handleUndoRequest}
              disabled={undoState !== 'idle' || moveLogRef.current.length === 0}>
              {undoState === 'sent' ? '悔棋中...' : '申请悔棋'}
            </button>
            <button className="btn btn-danger" onClick={handleSurrender}>投降</button>
          </div>

          <div className="card">
            <div className="card-title">对局信息</div>
            <div className="rules">
              <ul>
                <li><strong>棋盘：</strong>{activeCfg.label}</li>
                <li><strong>我方：</strong>{labels[myColorRef.current]?.name}</li>
                <li><strong>对方：</strong>{labels[oppColor]?.name}</li>
                <li><strong>连接：</strong>{connStatus || '—'}</li>
                <li><strong>总步数：</strong>{moveLogRef.current.length}</li>
                <li>悔棋：退回2步，需对方同意</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      <div className={`toast${toastShow ? ' show' : ''}`}>{toastMsg}</div>
    </div>
  );
}

// ── Saved layout picker (sub-component) ──────────────────────────────────────
function SavedLayoutPicker({ boardType, onSelect }) {
  const key = boardType === 'split' ? 'chess_split_layouts' : `chess_layouts_${boardType}`;
  const raw = localStorage.getItem(key);
  const layouts = raw ? JSON.parse(raw) : [];

  const legacy = localStorage.getItem(boardType === 'split' ? 'chess_split_layout' : 'chess_custom_layout');
  const options = legacy ? [{ name: '自定义布局', pieces: JSON.parse(legacy) }, ...layouts] : layouts;

  if (options.length === 0) return null;
  return (
    <div style={{ marginTop: 8 }}>
      <label className="lobby-label">自定义布局（可选）</label>
      <select className="lobby-select" defaultValue=""
        onChange={e => onSelect(e.target.value ? JSON.parse(e.target.value) : null)}>
        <option value="">默认布局</option>
        {options.map((l, i) => (
          <option key={i} value={JSON.stringify(l.pieces)}>{l.name || `布局 ${i + 1}`}</option>
        ))}
      </select>
    </div>
  );
}

import { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useDialog } from '../components/Dialog.jsx';
import { GameConnection, MSG } from '../network/peer.js';

// ── Board drawing modules ─────────────────────────────────────────────────────
import * as HB from '../game/board.js';
import * as IB from '../game/intl-board.js';
import * as SB from '../game/split-board.js';
import {
  initGomokuCanvas, clearGomokuCanvas, drawGomokuBoard,
  drawGomokuStones, pixelToGomokuGrid, CANVAS_SIZE as GS_SIZE,
} from '../game/gomoku-board.js';

// ── Game state classes ────────────────────────────────────────────────────────
import { GameState as HGS } from '../game/game.js';
import { GameState as IGS } from '../game/intl-game.js';
import { GameState as SGS } from '../game/split-game.js';
import { GameState as CGS } from '../game/chinese-game.js';
import { GameState as PGS } from '../game/pure-intl-game.js';
import { GomokuState }       from '../game/gomoku-game.js';

// ── Canvas dimensions ─────────────────────────────────────────────────────────
import { CANVAS_WIDTH as HW, CANVAS_HEIGHT as HH } from '../game/constants.js';
import { CANVAS_SIZE as IS }                        from '../game/intl-constants.js';
import { CANVAS_WIDTH as SW, CANVAS_HEIGHT as SH }  from '../game/split-constants.js';

// ── Per-board-type config ─────────────────────────────────────────────────────
const CFG = {
  hybrid: {
    label: '中国象棋棋盘 9×10', B: HB, GS: HGS,
    W: HW, H: HH, boardId: 'board-canvas', uiId: 'ui-canvas',
    toGrid: HB.pixelToGrid,
    getSelected:  gs => gs.selectedPiece,
    getLastMove:  gs => gs.moveHistory?.[gs.moveHistory.length - 1]?.move ?? null,
    exec:         (gs, mv) => gs.executeMove(mv),
  },
  chinese: {
    label: '中国象棋 9×10', B: HB, GS: CGS,
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
  'pure-intl': {
    label: '国际象棋 8×8', B: IB, GS: PGS,
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
  if (boardType === 'gomoku') {
    const gs = new GomokuState();
    moves.forEach(mv => gs.executeMove(mv.row, mv.col));
    return gs;
  }
  const cfg = CFG[boardType];
  const gs = new cfg.GS(pieces ?? null);
  moves.forEach(mv => cfg.exec(gs, mv));
  return gs;
}

// Convert raw PeerJS error to user-friendly message
function friendlyError(raw) {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('peer-unavailable') || s.includes('peer not found') || s.includes('does not exist'))
    return '找不到该房间，请确认房间码是否正确，或对方是否已离开。';
  if (s.includes('unavailable-id'))
    return '房间码已被占用，请稍后重试。';
  if (s.includes('network') || s.includes('ice') || s.includes('connection failed'))
    return '网络连接失败，请检查您的网络设置后重试。';
  if (s.includes('server-error') || s.includes('socket'))
    return '服务器异常，请稍后重试。';
  if (s.includes('disconnected'))
    return '与对方的连接已断开。';
  return '连接出错，请重新尝试加入房间。';
}

// ── Load all saved configs from localStorage ──────────────────────────────────
function loadSavedConfigs() {
  const configs = [];

  // Default configs
  configs.push({ id: 'hybrid-default',    boardType: 'hybrid',    pieces: null, label: '混合棋局 (中象棋盘 9×10)', isCustom: false, boardLabel: '中国象棋棋盘' });
  configs.push({ id: 'chinese-default',   boardType: 'chinese',   pieces: null, label: '中国象棋 (9×10)',          isCustom: false, boardLabel: '中国象棋' });
  configs.push({ id: 'split-default',     boardType: 'split',     pieces: null, label: '分界棋局 (9×10)',           isCustom: false, boardLabel: '分界棋盘' });
  configs.push({ id: 'intl-default',      boardType: 'intl',      pieces: null, label: '混合棋局 (国象棋盘 8×8)',  isCustom: false, boardLabel: '国际棋局' });
  configs.push({ id: 'pure-intl-default', boardType: 'pure-intl', pieces: null, label: '国际象棋 (8×8)',           isCustom: false, boardLabel: '国际象棋' });
  configs.push({ id: 'gomoku-default',    boardType: 'gomoku',    pieces: null, label: '五子棋 (15×15)',           isCustom: false, boardLabel: '五子棋' });

  // Custom layouts
  const types = [
    { boardType: 'hybrid',    newKey: 'chess_layouts_hybrid',    oldKey: 'chess_custom_layout', boardLabel: '中国象棋棋盘' },
    { boardType: 'chinese',   newKey: 'chess_layouts_chinese',   oldKey: null,                  boardLabel: '中国象棋' },
    { boardType: 'intl',      newKey: 'chess_layouts_intl',      oldKey: 'intl_hybrid_layout',  boardLabel: '国际棋局' },
    { boardType: 'pure-intl', newKey: 'chess_layouts_pure_intl', oldKey: null,                  boardLabel: '国际象棋' },
    { boardType: 'split',     newKey: 'chess_layouts_split',     oldKey: 'chess_split_layout',  boardLabel: '分界棋盘' },
  ];

  for (const { boardType, newKey, oldKey, boardLabel } of types) {
    // Legacy single layout
    const oldRaw = localStorage.getItem(oldKey);
    if (oldRaw) {
      try {
        configs.push({
          id: `${boardType}-legacy`,
          boardType,
          pieces: JSON.parse(oldRaw),
          label: `自定义布局（旧）`,
          isCustom: true,
          boardLabel,
        });
      } catch (_) { /* ignore */ }
    }
    // New multi-layout array
    try {
      const arr = JSON.parse(localStorage.getItem(newKey) || '[]');
      arr.forEach((layout, i) => {
        configs.push({
          id: `${boardType}-${i}-${layout.createdAt}`,
          boardType,
          pieces: layout.pieces,
          label: layout.name || `布局 ${i + 1}`,
          isCustom: true,
          boardLabel,
        });
      });
    } catch (_) { /* ignore */ }
  }

  return configs;
}

const EMOJI_LIST = ['😂', '👏', '😤', '🤔', '💀', '🎉', '🔥', '😮', '😢', '✊', '🤝', '🙏'];

export default function MultiGame() {
  // ── Connection / phase state ──────────────────────────────────────────────
  const [phase, setPhase]         = useState('lobby'); // lobby|waiting|playing|over|error
  const [roomCode, setRoomCode]   = useState('');
  const [inputCode, setInputCode] = useState('');
  const [errorMsg, setErrorMsg]   = useState('');
  const [connStatus, setConnStatus] = useState(''); // status text

  // ── Game config ───────────────────────────────────────────────────────────
  const [savedConfigs, setSavedConfigs] = useState(() => loadSavedConfigs());
  const [selectedConfig, setSelectedConfig] = useState(() => {
    const c = loadSavedConfigs();
    return c[0] ?? { id: 'hybrid-default', boardType: 'hybrid', pieces: null, label: '中国象棋棋盘 9×10', boardLabel: '中国象棋棋盘' };
  });
  const [myColor,   setMyColor]   = useState('red');

  // ── In-game UI state ──────────────────────────────────────────────────────
  const [tick,          setTick]          = useState(0);
  const [promotionMove, setPromotionMove] = useState(null);
  const [undoState,     setUndoState]     = useState('idle'); // idle|sent|received
  const [gameResult,    setGameResult]    = useState(null);   // {winner, reason}
  const [toastMsg,      setToastMsg]      = useState('');
  const [toastShow,     setToastShow]     = useState(false);
  const [emojiFlies,    setEmojiFlies]    = useState([]);

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

  const { confirm } = useDialog();

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
    const gs = gsRef.current;
    if (boardTypeRef.current === 'gomoku') {
      const ctx = boardCanvasRef.current?.getContext('2d');
      clearGomokuCanvas(ctx);
      drawGomokuBoard(ctx);
      drawGomokuStones(ctx, gs.board, gs.lastMove, gs.winLine);
      return;
    }
    const cfg = CFG[boardTypeRef.current];
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

  // ── Reset myColor when switching between Gomoku and chess ─────────────────
  const isGomokuMode = selectedConfig?.boardType === 'gomoku';
  useEffect(() => {
    if (isGomokuMode && myColor === 'red') {
      setMyColor('black');
    } else if (!isGomokuMode && myColor === 'white') {
      setMyColor('red');
    }
  }, [isGomokuMode]); // eslint-disable-line

  // ── Helpers ───────────────────────────────────────────────────────────────
  const initGame = useCallback((bType, pieces, hostColor, isHost) => {
    if (bType === 'gomoku') {
      boardTypeRef.current   = 'gomoku';
      myColorRef.current     = isHost ? hostColor : (hostColor === 'black' ? 'white' : 'black');
      initialPiecesRef.current = null;
      moveLogRef.current     = [];
      gsRef.current          = new GomokuState();
      setMyColor(myColorRef.current);
      return;
    }
    const cfg = CFG[bType];
    boardTypeRef.current = bType;
    myColorRef.current   = isHost ? hostColor : (hostColor === 'red' ? 'black' : 'red');
    initialPiecesRef.current = pieces ?? null;
    moveLogRef.current = [];
    gsRef.current = new cfg.GS(pieces ?? null);
    setMyColor(myColorRef.current);
  }, []);

  const initCanvases = useCallback(() => {
    if (boardTypeRef.current === 'gomoku') {
      if (boardCanvasRef.current) initGomokuCanvas(boardCanvasRef.current);
      canvasReadyRef.current = true;
      bump();
      return;
    }
    const cfg = CFG[boardTypeRef.current];
    if (boardCanvasRef.current) cfg.B.initCanvas(boardCanvasRef.current);
    if (uiCanvasRef.current)    cfg.B.initCanvas(uiCanvasRef.current);
    // Auto-flip: black pieces should appear at the bottom for the black player
    cfg.B.setFlipped(myColorRef.current === 'black');
    canvasReadyRef.current = true;
    bump();
  }, [bump]);

  // ── Emoji reactions ───────────────────────────────────────────────────────
  function spawnEmojiFly(emoji, side) {
    const id = Date.now() + Math.random();
    setEmojiFlies(f => [...f, { id, emoji, side }]);
    setTimeout(() => setEmojiFlies(f => f.filter(e => e.id !== id)), 2800);
  }

  function sendEmoji(emoji) {
    spawnEmojiFly(emoji, 'mine');
    gcRef.current?.send({ type: MSG.EMOJI, emoji });
  }

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
        if (boardTypeRef.current === 'gomoku') {
          gs.executeMove(data.move.row, data.move.col);
          moveLogRef.current.push(data.move);
          bump();
          if (gs.status === 'win') {
            setGameResult({ winner: gs.winner, reason: '五子连珠' });
            setPhase('over');
          } else if (gs.status === 'draw') {
            setGameResult({ winner: null, reason: '棋盘落满，平局' });
            setPhase('over');
          }
        } else {
          cfg.exec(gs, data.move);
          moveLogRef.current.push(data.move);
          bump();
        }
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
      case MSG.EMOJI: {
        spawnEmojiFly(data.emoji, 'opp');
        break;
      }
    }
  }, [bump, initGame]); // eslint-disable-line

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
  }, [handleData, phase]); // eslint-disable-line

  // ── Create room (host) ───────────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    const gc = new GameConnection();
    gcRef.current = gc;
    // Init game state immediately so host can see the board while waiting
    boardTypeRef.current = selectedConfig.boardType;
    myColorRef.current = myColor;
    initialPiecesRef.current = selectedConfig.pieces ?? null;
    initGame(selectedConfig.boardType, selectedConfig.pieces ?? null, myColor, true);
    gc.on('open', (code) => {
      setRoomCode(code);
      setPhase('waiting');
    });
    setupHandlers(gc, true);
    gc.host();
  }, [selectedConfig, myColor, initGame, setupHandlers]);

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

    // ── Gomoku click ───────────────────────────────────────────────────────
    if (boardTypeRef.current === 'gomoku') {
      if (gs.status !== 'playing') return;
      if (gs.currentTurn !== myColorRef.current) return;
      const pos = pixelToGomokuGrid(boardCanvasRef.current, e.clientX, e.clientY);
      if (!pos) return;
      const ok = gs.executeMove(pos.row, pos.col);
      if (!ok) return;
      const mv = { row: pos.row, col: pos.col };
      moveLogRef.current.push(mv);
      gcRef.current?.send({ type: MSG.MOVE, move: mv });
      bump();
      if (gs.status === 'win') {
        setGameResult({ winner: gs.winner, reason: '五子连珠' });
        setPhase('over');
      } else if (gs.status === 'draw') {
        setGameResult({ winner: null, reason: '棋盘落满，平局' });
        setPhase('over');
      }
      return;
    }

    if (gs.status === 'checkmate' || gs.status === 'stalemate') return;

    // Only allow interaction on your own turn
    if (gs.currentTurn !== myColorRef.current) return;

    const cfg  = CFG[boardTypeRef.current];
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const sx   = cfg.W / rect.width;
    const sy   = cfg.H / rect.height;
    const isFlipped = myColorRef.current === 'black';
    const rawX = (e.clientX - rect.left) * sx;
    const rawY = (e.clientY - rect.top)  * sy;
    const { col, row } = cfg.toGrid(
      isFlipped ? cfg.W - rawX : rawX,
      isFlipped ? cfg.H - rawY : rawY,
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
  const handleSurrender = useCallback(async () => {
    if (!await confirm('确定投降？', { title: '投降确认', confirmText: '确定投降', cancelText: '取消' })) return;
    gcRef.current?.send({ type: MSG.SURRENDER });
    const isGomoku = boardTypeRef.current === 'gomoku';
    const winner = isGomoku
      ? (myColorRef.current === 'black' ? 'white' : 'black')
      : (myColorRef.current === 'red' ? 'black' : 'red');
    setGameResult({ winner, reason: '我方投降' });
    setPhase('over');
  }, [confirm]);

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
    setEmojiFlies([]);
    // Refresh saved configs list
    setSavedConfigs(loadSavedConfigs());
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const gs         = gsRef.current;
  const activeCfg  = boardTypeRef.current === 'gomoku'
    ? { label: '五子棋 15×15' }
    : (CFG[boardTypeRef.current] ?? CFG.hybrid);
  const isMyTurn   = gs && gs.currentTurn === myColorRef.current;
  const oppColor   = boardTypeRef.current === 'gomoku'
    ? (myColor === 'black' ? 'white' : 'black')
    : (myColor === 'red' ? 'black' : 'red');

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Lobby ─────────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="app">
        <header className="app-header">
          <div className="app-title">
            <span className="title-main"> 联机对战</span>
            <span className="title-sub"> </span>
          </div>
          <Link className="nav-link" to="/">← 返回</Link>
        </header>

        <div className="multi-lobby">
          <div className="lobby-card">
            <div className="lobby-section-title">选择对局</div>
            <div className="config-card-grid">
              {savedConfigs.map(cfg => (
                <div
                  key={cfg.id}
                  className={`config-card${selectedConfig.id === cfg.id ? ' selected' : ''}`}
                  onClick={() => setSelectedConfig(cfg)}
                >
                  <div className="config-card-name">{cfg.label}</div>
                  <div className="config-card-meta">
                    <span className="config-card-board">{cfg.boardLabel}</span>
                    {cfg.isCustom && <span className="config-card-custom">自定义</span>}
                  </div>
                </div>
              ))}
            </div>

            <div className="lobby-form" style={{ marginTop: 12 }}>
              <label className="lobby-label">我的阵营</label>
              {isGomokuMode ? (
                <select className="lobby-select" value={myColor} onChange={e => setMyColor(e.target.value)}>
                  <option value="black">黑方 (先手)</option>
                  <option value="white">白方 (后手)</option>
                </select>
              ) : (
                <select className="lobby-select" value={myColor} onChange={e => setMyColor(e.target.value)}>
                  <option value="red">红方</option>
                  <option value="black">黑方</option>
                </select>
              )}
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
            <span className="title-main"> 联机对战</span>
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
    const friendly = friendlyError(errorMsg);
    return (
      <div className="app">
        <div className="multi-waiting">
          <div className="waiting-title" style={{ color: '#e04545' }}>连接失败</div>
          <div className="waiting-hint">{friendly}</div>
          <button className="btn btn-primary over-btn" onClick={handleReturnToLobby}>返回大厅</button>
        </div>
      </div>
    );
  }

  // ── Game Over ─────────────────────────────────────────────────────────────
  if (phase === 'over') {
    const isDraw = gameResult?.winner === null;
    const iWon   = !isDraw && gameResult?.winner === myColorRef.current;
    return (
      <div className="app">
        <div className="multi-waiting">
          <div className="waiting-title" style={{ color: isDraw ? '#888' : iWon ? '#81b64c' : '#e04545' }}>
            {isDraw ? '🤝 平局！' : iWon ? '🎉 你赢了！' : '😔 你输了'}
          </div>
          <div className="waiting-hint">{gameResult?.reason}</div>
          <button className="btn btn-primary over-btn" onClick={handleReturnToLobby}>返回大厅</button>
        </div>
      </div>
    );
  }

  // ── Playing ───────────────────────────────────────────────────────────────
  const myTurnLabel = isMyTurn ? '你的回合' : '等待对方...';
  let statusText = myTurnLabel;
  if (boardTypeRef.current === 'gomoku') {
    if (gs?.status === 'win') statusText = gs.winner === myColorRef.current ? '🎉 你赢了！' : '😔 你输了';
    else if (gs?.status === 'draw') statusText = '🤝 平局！';
  } else {
    if (gs?.status === 'check')     statusText += '  ⚠️ 将军!';
    if (gs?.status === 'draw')      statusText = '三重复局！平局';
    if (gs?.status === 'checkmate') {
      const w = gs.winner === myColorRef.current ? '你赢了！' : '你输了';
      statusText = `将死！${w}`;
    }
  }

  // Player labels per board type
  const playerLabels = {
    hybrid:     { red:   { name: '红方', sub: '中国象棋', avatar: '將' }, black: { name: '黑方', sub: '国际象棋', avatar: '♚' } },
    chinese:    { red:   { name: '红方', sub: '中国象棋', avatar: '將' }, black: { name: '黑方', sub: '中国象棋', avatar: '將' } },
    intl:       { red:   { name: '红方', sub: '中国象棋', avatar: '將' }, black: { name: '黑方', sub: '国际象棋', avatar: '♚' } },
    'pure-intl':{ red:   { name: '白方', sub: '国际象棋', avatar: '♔' }, black: { name: '黑方', sub: '国际象棋', avatar: '♚' } },
    split:      { red:   { name: '红方', sub: '国际象棋', avatar: '♔' }, black: { name: '黑方', sub: '中国象棋', avatar: '將' } },
    gomoku:     { black: { name: '黑方', sub: '五子棋',   avatar: '●' }, white: { name: '白方', sub: '五子棋',   avatar: '○' } },
  };
  const labels = playerLabels[boardTypeRef.current] || playerLabels.hybrid;
  const myLabel  = labels[myColorRef.current];
  const oppLabel = labels[oppColor];
  // For Gomoku: black is "top" (opponent of white); for chess: black is top
  const isGomoku = boardTypeRef.current === 'gomoku';
  const firstColor  = isGomoku ? 'black' : 'black';  // top player color when not flipped
  const topIsMe     = myColorRef.current === firstColor;
  const topLabel    = topIsMe ? myLabel : oppLabel;
  const botLabel    = topIsMe ? oppLabel : myLabel;
  const topColor    = topIsMe ? myColorRef.current : oppColor;
  const botColor    = topIsMe ? oppColor : myColorRef.current;
  const topActive   = gs?.currentTurn === topColor;
  const botActive   = gs?.currentTurn === botColor;

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="title-main"> 联机对战</span>
          <span className="title-sub">{activeCfg.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="conn-status">{connStatus}</span>
          <Link className="nav-link" to="#" onClick={async () => {
            if (await confirm('确定离开对局？', { title: '离开对局', confirmText: '确定离开', cancelText: '取消' })) handleReturnToLobby();
          }}>退出</Link>
        </div>
      </header>

      <div className="game-layout">
        <div className="board-area">
          {/* Top player bar */}
          <div className={`player-bar${topActive ? ' active' : ''}${topColor === myColorRef.current ? ' my-bar' : ''}`}>
            {boardTypeRef.current === 'gomoku' ? (
              <div className="player-avatar" style={topColor === 'black'
                ? { background: 'radial-gradient(circle at 35% 35%, #666, #000)', color: '#fff', fontSize: 18 }
                : { background: 'radial-gradient(circle at 35% 35%, #fff, #ccc)', color: '#333', border: '1px solid #ccc', fontSize: 18 }}>●</div>
            ) : (
              <div className={`player-avatar ${topColor}-avatar`}>{topLabel.avatar}</div>
            )}
            <div className="player-info">
              <span className="player-name">{topLabel.name}{topColor === myColorRef.current ? ' (我)' : ' (对方)'}</span>
              <span className="player-sub">{topLabel.sub}</span>
            </div>
            <div className="player-turn-dot" />
          </div>

          <div className="board-container">
            <div className={`canvas-wrapper${myColor === 'black' && boardTypeRef.current !== 'gomoku' ? ' board-flipped' : ''}`} key={boardTypeRef.current}>
              {boardTypeRef.current === 'gomoku' ? (
                <canvas ref={boardCanvasRef} id="gomoku-canvas"
                  onClick={handleCanvasClick}
                  style={{ cursor: isMyTurn ? 'pointer' : 'default', display: 'block' }}
                />
              ) : (
                <>
                  <canvas ref={boardCanvasRef} id={activeCfg.boardId} />
                  <canvas ref={uiCanvasRef} id={activeCfg.uiId}
                    onClick={handleCanvasClick}
                    style={{ cursor: isMyTurn ? 'pointer' : 'default' }}
                  />
                </>
              )}
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
            {boardTypeRef.current === 'gomoku' ? (
              <div className="player-avatar" style={botColor === 'black'
                ? { background: 'radial-gradient(circle at 35% 35%, #666, #000)', color: '#fff', fontSize: 18 }
                : { background: 'radial-gradient(circle at 35% 35%, #fff, #ccc)', color: '#333', border: '1px solid #ccc', fontSize: 18 }}>●</div>
            ) : (
              <div className={`player-avatar ${botColor}-avatar`}>{botLabel.avatar}</div>
            )}
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

          {/* Emoji reactions */}
          <div className="card">
            <div className="card-title">发送表情</div>
            <div className="emoji-grid">
              {EMOJI_LIST.map(e => (
                <button key={e} className="emoji-btn" onClick={() => sendEmoji(e)}>{e}</button>
              ))}
            </div>
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

      {/* Flying emojis */}
      <div className="emoji-fly-container">
        {emojiFlies.map(({ id, emoji, side }) => (
          <div key={id} className={`emoji-fly emoji-fly-${side}`}>{emoji}</div>
        ))}
      </div>

      <div className={`toast${toastShow ? ' show' : ''}`}>{toastMsg}</div>
    </div>
  );
}

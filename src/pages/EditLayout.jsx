import { useRef, useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDialog } from '../components/Dialog.jsx';

// Board modules
import * as HB from '../game/board.js';
import * as IB from '../game/intl-board.js';
import * as SB from '../game/split-board.js';

// Game state classes
import { GameState as HGS, BoardState as HBS } from '../game/game.js';
import { GameState as IGS, BoardState as IBS } from '../game/intl-game.js';
import { GameState as SGS, BoardState as SBS } from '../game/split-game.js';

// Canvas dimensions
import { CANVAS_WIDTH as HW, CANVAS_HEIGHT as HH, COLOR as HCOL } from '../game/constants.js';
import { CANVAS_SIZE as IS, COLOR as ICOL }                        from '../game/intl-constants.js';
import { CANVAS_WIDTH as SW, CANVAS_HEIGHT as SH, COLOR as SCOL }  from '../game/split-constants.js';

// ── Per-board config ──────────────────────────────────────────────────────────
const CFG = {
  hybrid: {
    label: '混合棋局 9×10',
    B: HB, GS: HGS, BS: HBS, COLOR: HCOL,
    W: HW, H: HH, boardId: 'board-canvas', uiId: 'ui-canvas',
    toGrid: HB.pixelToGrid,
    palettes: {
      red:   [{t:'general',l:'將'},{t:'advisor',l:'士'},{t:'elephant',l:'象'},{t:'horse',l:'馬'},{t:'rook_c',l:'車'},{t:'cannon',l:'砲'},{t:'soldier',l:'兵'}],
      black: [{t:'king',l:'♔'},{t:'queen',l:'♕'},{t:'rook_i',l:'♖'},{t:'bishop',l:'♗'},{t:'knight',l:'♘'},{t:'pawn',l:'♙'}],
    },
  },
  intl: {
    label: '国际棋局 8×8',
    B: IB, GS: IGS, BS: IBS, COLOR: ICOL,
    W: IS, H: IS, boardId: 'intl-board-canvas', uiId: 'intl-ui-canvas',
    toGrid: IB.pixelToSquare,
    palettes: {
      'red-chinese':   [{t:'general',l:'將'},{t:'advisor',l:'士'},{t:'elephant',l:'象'},{t:'horse',l:'馬'},{t:'rook_c',l:'車'},{t:'cannon',l:'砲'},{t:'soldier',l:'兵'}],
      'red-intl':      [{t:'king',l:'♔'},{t:'queen',l:'♕'},{t:'rook',l:'♖'},{t:'bishop',l:'♗'},{t:'knight',l:'♘'},{t:'pawn',l:'♙'}],
      'black-chinese': [{t:'general',l:'將'},{t:'advisor',l:'士'},{t:'elephant',l:'象'},{t:'horse',l:'馬'},{t:'rook_c',l:'車'},{t:'cannon',l:'砲'},{t:'soldier',l:'兵'}],
      'black-intl':    [{t:'king',l:'♔'},{t:'queen',l:'♕'},{t:'rook',l:'♖'},{t:'bishop',l:'♗'},{t:'knight',l:'♘'},{t:'pawn',l:'♙'}],
    },
    hasStyle: true, // separate Chinese/International style axis
  },
  split: {
    label: '分界棋盘 9×10',
    B: SB, GS: SGS, BS: SBS, COLOR: SCOL,
    W: SW, H: SH, boardId: 'board-canvas', uiId: 'ui-canvas',
    toGrid: SB.pixelToGrid,
    palettes: {
      black: [{t:'general',l:'將'},{t:'advisor',l:'士'},{t:'elephant',l:'象'},{t:'horse',l:'馬'},{t:'rook_c',l:'車'},{t:'cannon',l:'砲'},{t:'soldier',l:'兵'}],
      red:   [{t:'king',l:'♔'},{t:'queen',l:'♕'},{t:'rook_i',l:'♖'},{t:'bishop',l:'♗'},{t:'knight',l:'♘'},{t:'pawn',l:'♙'}],
    },
  },
};

// Read the pending edit from sessionStorage
function readPending() {
  try {
    const raw = sessionStorage.getItem('chess_pending_edit');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function EditLayout() {
  const navigate = useNavigate();
  const { confirm } = useDialog();

  // Read edit info once on mount
  const editInfoRef = useRef(readPending());
  const editInfo    = editInfoRef.current;

  // Redirect if no pending edit
  useEffect(() => {
    if (!editInfo) navigate('/layouts', { replace: true });
  }, []); // eslint-disable-line

  const cfg = editInfo ? CFG[editInfo.boardType] : CFG.hybrid;

  // ── Canvas refs ────────────────────────────────────────────────────────────
  const boardCanvasRef = useRef(null);
  const uiCanvasRef    = useRef(null);
  const canvasReady    = useRef(false);

  // ── Game / board state ────────────────────────────────────────────────────
  const gsRef = useRef(null);
  if (!gsRef.current && editInfo) {
    gsRef.current = new cfg.GS(null);
    gsRef.current.board = new cfg.BS();
    editInfo.pieces?.forEach(p => gsRef.current.board.addPiece({ ...p, hasMoved: false }));
  }

  // ── Setup UI state ────────────────────────────────────────────────────────
  const [tick,           setTick]           = useState(0);
  const [setupColor,     setSetupColor]     = useState('red');
  const [setupStyle,     setSetupStyle]     = useState('chinese'); // 'chinese' | 'intl' (intl board only)
  const [setupPieceType, setSetupPieceType] = useState(null);
  const [eraseActive,    setEraseActive]    = useState(false);
  const [boardFlipped,   setBoardFlipped]   = useState(false);
  const [toastMsg,       setToastMsg]       = useState('');
  const [toastShow,      setToastShow]      = useState(false);

  // Stable refs for callbacks
  const setupColorRef     = useRef('red');
  const setupStyleRef     = useRef('chinese');
  const setupPieceTypeRef = useRef(null);
  const eraseActiveRef    = useRef(false);

  const bump = useCallback(() => setTick(t => t + 1), []);

  function showToast(msg) {
    setToastMsg(msg); setToastShow(true);
    setTimeout(() => setToastShow(false), 2200);
  }

  // ── Canvas init ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editInfo) return;
    cfg.B.initCanvas(boardCanvasRef.current);
    cfg.B.initCanvas(uiCanvasRef.current);
    cfg.B.setFlipped(false);
    canvasReady.current = true;
    bump();
  }, []); // eslint-disable-line

  // ── Redraw ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasReady.current || !gsRef.current) return;
    cfg.B.clearCanvas();
    cfg.B.drawBoard();
    cfg.B.drawPieces(gsRef.current.board, gsRef.current.board.pieces);
    cfg.B.drawHighlights(null, [], null, null, gsRef.current.board.cells);
  }, [tick]);

  // ── Canvas click ───────────────────────────────────────────────────────────
  const handleCanvasClick = useCallback((e) => {
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const sx = cfg.W / rect.width;
    const sy = cfg.H / rect.height;
    const rawX = (e.clientX - rect.left) * sx;
    const rawY = (e.clientY - rect.top)  * sy;
    const { col, row } = cfg.toGrid(
      boardFlipped ? cfg.W - rawX : rawX,
      boardFlipped ? cfg.H - rawY : rawY,
    );
    gsRef.current.board.removePiece(col, row);
    if (!eraseActiveRef.current && setupPieceTypeRef.current) {
      gsRef.current.board.addPiece({
        type: setupPieceTypeRef.current,
        color: setupColorRef.current,
        col, row, hasMoved: false,
      });
    }
    bump();
  }, [bump, boardFlipped]);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    const rect = uiCanvasRef.current.getBoundingClientRect();
    const sx = cfg.W / rect.width;
    const sy = cfg.H / rect.height;
    const rawX = (e.clientX - rect.left) * sx;
    const rawY = (e.clientY - rect.top)  * sy;
    const { col, row } = cfg.toGrid(
      boardFlipped ? cfg.W - rawX : rawX,
      boardFlipped ? cfg.H - rawY : rawY,
    );
    gsRef.current.board.removePiece(col, row);
    bump();
  }, [bump, boardFlipped]);

  // ── Save (update original layout entry) ───────────────────────────────────
  async function handleSave() {
    const newPieces = gsRef.current.board.pieces.map(({ type, color, col, row }) => ({ type, color, col, row }));
    const arr = JSON.parse(localStorage.getItem(editInfo.storageKey) || '[]');
    if (editInfo.index >= 0 && editInfo.index < arr.length) {
      arr[editInfo.index] = { ...arr[editInfo.index], pieces: newPieces, updatedAt: Date.now() };
    } else {
      arr.push({ name: editInfo.name, pieces: newPieces, createdAt: Date.now() });
    }
    localStorage.setItem(editInfo.storageKey, JSON.stringify(arr));
    sessionStorage.removeItem('chess_pending_edit');
    showToast('布局已更新！');
    setTimeout(() => navigate('/layouts'), 800);
  }

  async function handleCancel() {
    const gs = gsRef.current;
    const changed = gs?.board.pieces.length !== editInfo?.pieces?.length;
    if (changed && !await confirm('放弃修改并返回？', { title: '取消编辑', confirmText: '放弃修改', cancelText: '继续编辑' })) return;
    sessionStorage.removeItem('chess_pending_edit');
    navigate('/layouts');
  }

  function handleRestoreOriginal() {
    gsRef.current.board = new cfg.BS();
    editInfo.pieces?.forEach(p => gsRef.current.board.addPiece({ ...p, hasMoved: false }));
    bump();
    showToast('已还原原始布局');
  }

  if (!editInfo) return null;

  // ── Palette ────────────────────────────────────────────────────────────────
  let palette;
  if (cfg.hasStyle) {
    palette = cfg.palettes[`${setupColor}-${setupStyle}`] ?? [];
  } else {
    palette = cfg.palettes[setupColor] ?? [];
  }
  const paletteClass = setupColor === 'red' ? 'red' : 'black';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="title-main">编辑布局</span>
          <span className="title-sub">{editInfo.name} · {cfg.label}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="nav-link" style={{ background: 'none', border: '1px solid #3e5828', cursor: 'pointer', color: '#81b64c', borderRadius: 6, padding: '6px 14px', fontSize: '0.85rem', fontWeight: 500 }}
            onClick={handleCancel}>✕ 取消</button>
          <button className="nav-link" style={{ background: '#81b64c', border: 'none', cursor: 'pointer', color: '#fff', borderRadius: 6, padding: '6px 14px', fontSize: '0.85rem', fontWeight: 600 }}
            onClick={handleSave}>💾 保存更新</button>
        </div>
      </header>

      <div className="game-layout">
        {/* ── Board ────────────────────────────────── */}
        <div className="board-area">
          <div className="board-container">
            <div className={`canvas-wrapper${boardFlipped ? ' board-flipped' : ''}`}>
              <canvas ref={boardCanvasRef} id={cfg.boardId} />
              <canvas ref={uiCanvasRef} id={cfg.uiId}
                onClick={handleCanvasClick}
                onContextMenu={handleContextMenu}
              />
            </div>
          </div>
        </div>

        {/* ── Editor Panel ─────────────────────────── */}
        <aside className="side-panel">
          {/* Quick actions */}
          <div className="action-row">
            <button className="btn btn-secondary" onClick={() => {
              const next = !boardFlipped; setBoardFlipped(next); cfg.B.setFlipped(next); bump();
            }}>↕ 翻转</button>
            <button className="btn btn-primary" onClick={handleSave}>💾 保存更新</button>
          </div>

          {/* Setup card */}
          <div className="card">
            <div className="setup-header">
              <span className="setup-title">摆子工具</span>

              {/* Color selector */}
              <div className="color-select">
                <button id="sel-color-red"
                  className={`color-btn${setupColor === 'red' ? ' active' : ''}`}
                  onClick={() => { setupColorRef.current = 'red'; setSetupColor('red'); setupPieceTypeRef.current = null; setSetupPieceType(null); }}>
                  红方
                </button>
                <button id="sel-color-black"
                  className={`color-btn${setupColor === 'black' ? ' active' : ''}`}
                  onClick={() => { setupColorRef.current = 'black'; setSetupColor('black'); setupPieceTypeRef.current = null; setSetupPieceType(null); }}>
                  黑方
                </button>
              </div>

              {/* Style selector (intl board only) */}
              {cfg.hasStyle && (
                <div className="color-select">
                  <button className={`color-btn${setupStyle === 'chinese' ? ' active' : ''}`}
                    style={setupStyle === 'chinese' ? { background: '#1a3f6f', borderColor: '#2980b9', color: '#fff' } : {}}
                    onClick={() => { setupStyleRef.current = 'chinese'; setSetupStyle('chinese'); setupPieceTypeRef.current = null; setSetupPieceType(null); }}>
                    象棋
                  </button>
                  <button className={`color-btn${setupStyle === 'intl' ? ' active' : ''}`}
                    style={setupStyle === 'intl' ? { background: '#1a3f6f', borderColor: '#2980b9', color: '#fff' } : {}}
                    onClick={() => { setupStyleRef.current = 'intl'; setSetupStyle('intl'); setupPieceTypeRef.current = null; setSetupPieceType(null); }}>
                    国际
                  </button>
                </div>
              )}

              {/* Tools */}
              <div className="setup-tools">
                <button className={`tool-btn${eraseActive ? ' active' : ''}`}
                  onClick={() => { const v = !eraseActiveRef.current; eraseActiveRef.current = v; setEraseActive(v); setupPieceTypeRef.current = null; setSetupPieceType(null); }}>
                  🧹 橡皮擦
                </button>
                <button className="tool-btn"
                  onClick={() => { gsRef.current.board = new cfg.BS(); bump(); }}>
                  清空棋盘
                </button>
                <button className="tool-btn"
                  onClick={handleRestoreOriginal}>
                  还原原始
                </button>
              </div>
            </div>

            {/* Piece palette */}
            <div className="piece-palette">
              {palette.map(({ t, l }) => (
                <button key={t}
                  className={`palette-piece ${paletteClass}${setupPieceType === t ? ' selected' : ''}`}
                  onClick={() => { setupPieceTypeRef.current = t; eraseActiveRef.current = false; setSetupPieceType(t); setEraseActive(false); }}>
                  {l}
                </button>
              ))}
            </div>

            <div className="setup-hint" style={{ marginTop: 8 }}>
              左键放子 · 右键删子 · 橡皮擦点击也可删子
            </div>
          </div>

          {/* Info */}
          <div className="card">
            <div className="card-title">布局信息</div>
            <div className="rules">
              <ul>
                <li><strong>布局名称：</strong>{editInfo.name}</li>
                <li><strong>棋盘类型：</strong>{cfg.label}</li>
                <li><strong>当前棋子数：</strong>{gsRef.current?.board.pieces.length ?? 0}</li>
                <li>修改后点"💾 保存更新"覆盖原布局</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>

      <div className={`toast${toastShow ? ' show' : ''}`}>{toastMsg}</div>
    </div>
  );
}

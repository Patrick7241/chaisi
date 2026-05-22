import { useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDialog } from '../components/Dialog.jsx';

// ── Board type metadata ───────────────────────────────────────────────────────
const BOARDS = [
  { key: 'hybrid', label: '混合棋局 9×10', storageKey: 'chess_layouts_hybrid', path: '/',      COLS: 9, ROWS: 10, isGrid: true  },
  { key: 'intl',   label: '国际棋局 8×8',  storageKey: 'chess_layouts_intl',   path: '/intl',  COLS: 8, ROWS: 8,  isGrid: false },
  { key: 'split',  label: '分界棋盘 9×10', storageKey: 'chess_layouts_split',  path: '/split', COLS: 9, ROWS: 10, isGrid: true  },
];

function readLayouts(storageKey) {
  try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); }
  catch { return []; }
}
function writeLayouts(storageKey, arr) {
  localStorage.setItem(storageKey, JSON.stringify(arr));
}

// ── Mini board thumbnail (canvas) ────────────────────────────────────────────
function Thumbnail({ board, pieces }) {
  const ref = useRef(null);
  const { COLS, ROWS, isGrid, key } = board;

  // Thumbnail dimensions — compact but readable
  const CELL = key === 'intl' ? 14 : 12;
  const PAD  = 4;
  const W    = COLS * CELL + PAD * 2 - (isGrid ? CELL : 0);
  const H    = ROWS * CELL + PAD * 2 - (isGrid ? CELL : 0);
  // For grid board: intersections, so (COLS-1)×(ROWS-1) cells plus padding
  const TW = isGrid ? CELL * (COLS - 1) + PAD * 2 : CELL * COLS + PAD * 2;
  const TH = isGrid ? CELL * (ROWS - 1) + PAD * 2 : CELL * ROWS + PAD * 2;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || !pieces) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = TW * dpr;
    canvas.height = TH * dpr;
    canvas.style.width  = TW + 'px';
    canvas.style.height = TH + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    if (!isGrid) {
      // Checkerboard (intl)
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#f0d9b5' : '#b58863';
          ctx.fillRect(PAD + c * CELL, PAD + r * CELL, CELL, CELL);
        }
      }
    } else {
      // Wood + grid lines
      ctx.fillStyle = key === 'split'
        ? '#c8a060'
        : '#c8a060';
      ctx.fillRect(0, 0, TW, TH);

      // For split: tint the bottom half (international zone) slightly different
      if (key === 'split') {
        const boundary = PAD + 4 * CELL + CELL / 2;
        ctx.fillStyle = 'rgba(180,140,100,0.3)';
        ctx.fillRect(0, boundary, TW, TH - boundary);
      }

      ctx.strokeStyle = 'rgba(90,50,10,0.55)';
      ctx.lineWidth = 0.5;
      for (let r = 0; r < ROWS; r++) {
        ctx.beginPath();
        ctx.moveTo(PAD, PAD + r * CELL);
        ctx.lineTo(PAD + (COLS - 1) * CELL, PAD + r * CELL);
        ctx.stroke();
      }
      for (let c = 0; c < COLS; c++) {
        ctx.beginPath();
        ctx.moveTo(PAD + c * CELL, PAD);
        ctx.lineTo(PAD + c * CELL, PAD + (ROWS - 1) * CELL);
        ctx.stroke();
      }
    }

    // Pieces
    const R = CELL * (isGrid ? 0.40 : 0.38);
    pieces.forEach(p => {
      const x = isGrid
        ? PAD + p.col * CELL
        : PAD + p.col * CELL + CELL / 2;
      const y = isGrid
        ? PAD + p.row * CELL
        : PAD + p.row * CELL + CELL / 2;

      // Shadow
      ctx.shadowColor = 'rgba(0,0,0,0.4)';
      ctx.shadowBlur  = 2;
      ctx.shadowOffsetY = 1;

      ctx.fillStyle = p.color === 'red' ? '#c0392b' : '#1c1c1c';
      ctx.beginPath();
      ctx.arc(x, y, R, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = 'transparent';
      ctx.shadowBlur  = 0;
      ctx.shadowOffsetY = 0;
    });
  }, [pieces, COLS, ROWS, isGrid, key, CELL, PAD, TW, TH]);

  return <canvas ref={ref} className="thumbnail-canvas" />;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Layouts() {
  const navigate = useNavigate();
  const { confirm, prompt: dlgPrompt } = useDialog();

  // Re-read from localStorage on every render via a force-refresh counter
  const [, forceUpdate] = [0, useCallback(() => {}, [])];

  // Collect all layouts
  const allGroups = BOARDS.map(b => ({
    board: b,
    layouts: readLayouts(b.storageKey),
  })).filter(g => g.layouts.length > 0);

  const totalCount = allGroups.reduce((n, g) => n + g.layouts.length, 0);

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function handleRename(board, index) {
    const layout = readLayouts(board.storageKey)[index];
    const newName = await dlgPrompt('输入新名称', {
      title: '重命名布局',
      defaultValue: layout.name,
      placeholder: '布局名称',
      confirmText: '保存',
    });
    if (!newName) return;
    const arr = readLayouts(board.storageKey);
    arr[index] = { ...arr[index], name: newName };
    writeLayouts(board.storageKey, arr);
    navigate(0); // force re-render
  }

  async function handleDelete(board, index) {
    const layout = readLayouts(board.storageKey)[index];
    if (!await confirm(`确定删除布局"${layout.name}"？`, {
      title: '删除布局',
      confirmText: '确定删除',
      cancelText: '取消',
    })) return;
    const arr = readLayouts(board.storageKey).filter((_, i) => i !== index);
    writeLayouts(board.storageKey, arr);
    navigate(0);
  }

  function handleEdit(board, index) {
    const layout = readLayouts(board.storageKey)[index];
    sessionStorage.setItem('chess_pending_edit', JSON.stringify({
      boardType: board.key,
      pieces:    layout.pieces,
      name:      layout.name,
      index,
      storageKey: board.storageKey,
    }));
    navigate(board.path);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <span className="title-main">布局管理</span>
          <span className="title-sub">共 {totalCount} 个自定义布局</span>
        </div>
        <Link className="nav-link" to="/">← 返回</Link>
      </header>

      {totalCount === 0 ? (
        <div className="layouts-empty">
          <div className="layouts-empty-icon">📋</div>
          <p className="layouts-empty-title">暂无保存的布局</p>
          <p className="layouts-empty-sub">在摆子模式中摆好棋子后点"💾 保存布局"即可管理</p>
          <Link className="btn btn-primary" to="/"
            style={{ display: 'inline-block', textDecoration: 'none', padding: '10px 24px', borderRadius: 6, marginTop: 12 }}>
            去摆棋
          </Link>
        </div>
      ) : (
        <div className="layouts-page">
          {allGroups.map(({ board, layouts }) => (
            <section key={board.key} className="layouts-section">
              <div className="layouts-section-header">
                <span className="layouts-section-title">{board.label}</span>
                <span className="layouts-section-count">{layouts.length} 个</span>
              </div>
              <div className="layouts-grid">
                {layouts.map((layout, i) => (
                  <div key={`${board.key}-${i}`} className="layout-card">
                    <div className="layout-thumbnail-wrap">
                      <Thumbnail board={board} pieces={layout.pieces ?? []} />
                    </div>
                    <div className="layout-info">
                      <div className="layout-name" title={layout.name}>{layout.name}</div>
                      <div className="layout-meta">
                        <span>{layout.pieces?.length ?? 0} 枚棋子</span>
                        {layout.createdAt
                          ? <span>{new Date(layout.createdAt).toLocaleDateString('zh-CN')}</span>
                          : null}
                      </div>
                    </div>
                    <div className="layout-actions">
                      <button className="layout-btn layout-btn-edit"
                        onClick={() => handleEdit(board, i)}>
                        ✏️<span>编辑</span>
                      </button>
                      <button className="layout-btn layout-btn-rename"
                        onClick={() => handleRename(board, i)}>
                        📝<span>重命名</span>
                      </button>
                      <button className="layout-btn layout-btn-delete"
                        onClick={() => handleDelete(board, i)}>
                        🗑️<span>删除</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

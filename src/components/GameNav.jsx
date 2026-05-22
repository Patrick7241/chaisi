import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';

const MODES = [
  { path: '/',          label: '混合棋局',  sub: '中象棋盘 9×10' },
  { path: '/chinese',   label: '中国象棋',  sub: '纯中象 9×10'   },
  { path: '/split',     label: '分界棋局',  sub: '跨界 9×10'     },
  { path: '/intl',      label: '混合棋局',  sub: '国象棋盘 8×8'  },
  { path: '/pure-intl', label: '国际象棋',  sub: '纯国象 8×8'    },
  { path: '/gomoku',    label: '五子棋',    sub: '15×15'         },
];

export function GameNav() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const current = MODES.find(m => m.path === pathname) ?? MODES[0];

  return (
    <nav className="game-nav">
      <div className="mode-picker" ref={ref}>
        <button className="mode-picker-btn" onClick={() => setOpen(o => !o)}>
          <span className="mode-picker-label">{current.label}</span>
          <span className="mode-picker-sub">{current.sub}</span>
          <span className="mode-picker-arrow">{open ? '▴' : '▾'}</span>
        </button>
        {open && (
          <div className="mode-dropdown">
            {MODES.map(m => (
              <Link
                key={m.path}
                to={m.path}
                className={`mode-dropdown-item${pathname === m.path ? ' active' : ''}`}
                onClick={() => setOpen(false)}
              >
                <span className="mode-dropdown-label">{m.label}</span>
                <span className="mode-dropdown-sub">{m.sub}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
      <Link className="nav-link" to="/multi">🔗 联机</Link>
      <Link className="nav-link" to="/layouts">📋 布局</Link>
    </nav>
  );
}

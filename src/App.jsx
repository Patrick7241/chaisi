import { HashRouter, Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import HybridGame  from './pages/HybridGame.jsx';
import IntlGame    from './pages/IntlGame.jsx';
import SplitGame   from './pages/SplitGame.jsx';
import MultiGame   from './pages/MultiGame.jsx';
import Layouts     from './pages/Layouts.jsx';
import EditLayout  from './pages/EditLayout.jsx';

// Floating "联机对战" button — visible on all pages except /multi itself
function MultiFloatingBtn() {
  const { pathname } = useLocation();
  if (pathname === '/multi') return null;
  return (
    <Link to="/multi" className="multi-float-btn" title="联机对战">
      🔗<span>联机对战</span>
    </Link>
  );
}

// Fixed QQ group badge
function QQBadge() {
  return (
    <a
      href="https://qm.qq.com/q/423205561"
      target="_blank"
      rel="noopener noreferrer"
      className="qq-badge"
      title="加入QQ交流群 423205561"
    >
      <span className="qq-icon">QQ</span>
      <span className="qq-text">交流群</span>
    </a>
  );
}

export default function App() {
  return (
    <HashRouter>
      <MultiFloatingBtn />
      <QQBadge />
      <Routes>
        <Route path="/"            element={<HybridGame />} />
        <Route path="/intl"        element={<IntlGame />} />
        <Route path="/split"       element={<SplitGame />} />
        <Route path="/multi"       element={<MultiGame />} />
        <Route path="/layouts"     element={<Layouts />} />
        <Route path="/edit-layout" element={<EditLayout />} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

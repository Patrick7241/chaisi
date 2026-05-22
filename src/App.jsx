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

export default function App() {
  return (
    <HashRouter>
      <MultiFloatingBtn />
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

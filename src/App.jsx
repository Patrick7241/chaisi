import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import HybridGame from './pages/HybridGame.jsx';
import IntlGame   from './pages/IntlGame.jsx';
import SplitGame  from './pages/SplitGame.jsx';
import MultiGame  from './pages/MultiGame.jsx';
import Layouts    from './pages/Layouts.jsx';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/"        element={<HybridGame />} />
        <Route path="/intl"    element={<IntlGame />} />
        <Route path="/split"   element={<SplitGame />} />
        <Route path="/multi"   element={<MultiGame />} />
        <Route path="/layouts" element={<Layouts />} />
        <Route path="*"        element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

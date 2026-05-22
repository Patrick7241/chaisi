import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import HybridGame from './pages/HybridGame.jsx';
import IntlGame from './pages/IntlGame.jsx';
import SplitGame from './pages/SplitGame.jsx';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/"      element={<HybridGame />} />
        <Route path="/intl"  element={<IntlGame />} />
        <Route path="/split" element={<SplitGame />} />
        <Route path="*"      element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

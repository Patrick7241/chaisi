import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import HybridGame   from './pages/HybridGame.jsx';
import IntlGame     from './pages/IntlGame.jsx';
import SplitGame    from './pages/SplitGame.jsx';
import MultiGame    from './pages/MultiGame.jsx';
import Layouts      from './pages/Layouts.jsx';
import EditLayout   from './pages/EditLayout.jsx';
import ChineseGame  from './pages/ChineseGame.jsx';
import PureIntlGame from './pages/PureIntlGame.jsx';
import GomokuGame   from './pages/GomokuGame.jsx';

// Fixed QQ group badge
function QQBadge() {
  return (
    <a
      href="https://qun.qq.com/universal-share/share?ac=1&authKey=N68%2F5p%2BgIOThscTpITueb1IFK4UHIJ5maKATDbnxe4xRUvgyqaUDiLGllvQRUFSp&busi_data=eyJncm91cENvZGUiOiI0MjMyMDU1NjEiLCJ0b2tlbiI6IktFMUorRkJsdjdxNTZHbVRld3poUUdEQkdHMlVLWEJMT3QyeXArNlk5QlBmV3dmalJ2TWtTZnVlMndzaW94VXYiLCJ1aW4iOiIyMTgyMTcxOTI0In0%3D&data=4ym8CHqXscDTDDR48FBWwe5_2cgg_iYc6Kphj2iurqDiB-oVeGOCtfPM_vUf8prTGtZE8VtQLXA2K5JbCTSeKA&svctype=4&tempid=h5_group_info"
      target="_blank"
      rel="noopener noreferrer"
      className="qq-badge"
      title="点击加入QQ交流群 423205561"
    >
      <span className="qq-icon">QQ</span>
      <span className="qq-text">交流群</span>
    </a>
  );
}

export default function App() {
  return (
    <HashRouter>
      <QQBadge />
      <Routes>
        <Route path="/"            element={<HybridGame />} />
        <Route path="/chinese"     element={<ChineseGame />} />
        <Route path="/split"       element={<SplitGame />} />
        <Route path="/intl"        element={<IntlGame />} />
        <Route path="/pure-intl"   element={<PureIntlGame />} />
        <Route path="/gomoku"      element={<GomokuGame />} />
        <Route path="/multi"       element={<MultiGame />} />
        <Route path="/layouts"     element={<Layouts />} />
        <Route path="/edit-layout" element={<EditLayout />} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

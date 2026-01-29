import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Send,
  Users,
  History,
  Settings,
  LogOut
} from 'lucide-react';
import Delivery from './pages/Delivery';
import Dashboard from './pages/Dashboard';
import Audience from './pages/Audience';
import HistoryPage from './pages/History';

const App = () => {
  return (
    <Router>
      <div className="layout">
        <aside className="sidebar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px' }}>
            <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Send color="white" size={24} />
            </div>
            <span style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>LINE v2</span>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <NavItem to="/dashboard" icon={<LayoutDashboard size={20} />} label="ダッシュボード" />
            <NavItem to="/delivery" icon={<Send size={20} />} label="メッセージ配信" />
            <NavItem to="/audience" icon={<Users size={20} />} label="友だち管理" />
            <NavItem to="/history" icon={<History size={20} />} label="配信履歴" />
            <NavItem to="/settings" icon={<Settings size={20} />} label="システム設定" />
          </nav>

          <div style={{ marginTop: 'auto', padding: '16px', borderTop: '1px solid var(--border)' }}>
            <div className="nav-item" style={{ cursor: 'pointer' }}>
              <LogOut size={20} />
              <span>ログアウト</span>
            </div>
          </div>
        </aside>

        <main className="main-content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/delivery" element={<Delivery />} />
            <Route path="/audience" element={<Audience />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

const NavItem = ({ to, icon, label }: any) => (
  <NavLink to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
    {icon}
    <span>{label}</span>
  </NavLink>
);

export default App;

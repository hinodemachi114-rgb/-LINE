import { Users, Bell, Send, History } from 'lucide-react';

const Dashboard = () => (
    <div className="animate-fade-in">
        <header style={{ marginBottom: '32px' }}>
            <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Dashboard</h1>
            <p style={{ color: 'var(--text-muted)' }}>ようこそ、福岡市薬剤師会 管理システムへ</p>
        </header>

        <div className="stats-grid">
            <StatCard title="友だち総数" value="1,284" icon={<Users />} trend="+12%" />
            <StatCard title="カテゴリ登録済" value="982" icon={<Bell />} trend="+5%" />
            <StatCard title="今月の配信数" value="14" icon={<Send />} trend="±0%" />
            <StatCard title="配信履歴" value="156" icon={<History />} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
            <div className="glass-card">
                <h3 style={{ marginBottom: '20px' }}>最近の配信</h3>
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                    配信データが読み込まれます...
                </div>
            </div>
            <div className="glass-card">
                <h3 style={{ marginBottom: '20px' }}>クイックアクション</h3>
                <button className="btn-primary" style={{ width: '100%' }}>
                    <Send size={18} /> 新規配信を作成
                </button>
            </div>
        </div>
    </div>
);

const StatCard = ({ title, value, icon, trend }: any) => (
    <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ color: 'var(--primary)', padding: '10px', background: 'var(--glass-bg)', borderRadius: '12px' }}>
                {icon}
            </div>
            {trend && (
                <span style={{ color: trend.startsWith('+') ? '#10b981' : '#f43f5e', fontSize: '14px', fontWeight: 600 }}>
                    {trend}
                </span>
            )}
        </div>
        <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>{title}</div>
        <div style={{ fontSize: '28px', fontWeight: 800 }}>{value}</div>
    </div>
);

export default Dashboard;

import { useState, useEffect } from 'react';
import { Users, Bell, Send, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Dashboard = () => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const response = await axios.get('/api/stats', {
                    headers: { 'x-session-id': localStorage.getItem('sessionId') }
                });
                setStats(response.data);
            } catch (error) {
                console.error('Fetch stats failed', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return <div className="glass-card" style={{ textAlign: 'center', padding: '100px' }}>読み込み中...</div>;

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 800 }}>Dashboard</h1>
                <p style={{ color: 'var(--text-muted)' }}>ようこそ、福岡市薬剤師会 管理システムへ</p>
            </header>

            <div className="stats-grid">
                <StatCard title="友だち総数" value={stats?.totalFriends?.toLocaleString() || '0'} icon={<Users />} />
                <StatCard title="カテゴリ登録済" value={stats?.registeredUsers?.toLocaleString() || '0'} icon={<Bell />} />
                <StatCard title="今月の配信数" value={stats?.monthlyDeliveries?.toLocaleString() || '0'} icon={<Send />} />
                <StatCard title="累計配信数" value={stats?.totalDeliveries?.toLocaleString() || '0'} icon={<History />} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                <div className="glass-card">
                    <h3 style={{ marginBottom: '20px' }}>最近の配信</h3>
                    {stats?.recentCampaigns?.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {stats.recentCampaigns.map((c: any, i: number) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{c.title}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(c.sentAt).toLocaleString()}</div>
                                    </div>
                                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>{c.sentCount}人</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                            配信データがありません
                        </div>
                    )}
                </div>
                <div className="glass-card">
                    <h3 style={{ marginBottom: '20px' }}>クイックアクション</h3>
                    <button className="btn-primary" style={{ width: '100%' }} onClick={() => navigate('/delivery')}>
                        <Send size={18} /> 新規配信を作成
                    </button>
                </div>
            </div>
        </div>
    );
};

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

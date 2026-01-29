import { useState, useEffect } from 'react';
import { ExternalLink, CheckCircle, Clock } from 'lucide-react';
import axios from 'axios';

const History = () => {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCampaigns = async () => {
            try {
                const response = await axios.get('/api/campaigns', {
                    headers: { 'x-session-id': localStorage.getItem('sessionId') }
                });
                setCampaigns(response.data);
            } catch (error) {
                console.error('Fetch campaigns failed', error);
            } finally {
                setLoading(false);
            }
        };
        fetchCampaigns();
    }, []);

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 800 }}>配信履歴</h1>
                <p style={{ color: 'var(--text-muted)' }}>送付済みのメッセージと予約中の配信を確認します</p>
            </header>

            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={tableStyle}>
                    <thead>
                        <tr style={theadRowStyle}>
                            <th style={thStyle}>配信日時</th>
                            <th style={thStyle}>内容</th>
                            <th style={thStyle}>配信対象</th>
                            <th style={thStyle}>ステータス</th>
                            <th style={thStyle}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</td></tr>
                        ) : campaigns.length === 0 ? (
                            <tr><td colSpan={5} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>配信履歴がありません</td></tr>
                        ) : (
                            campaigns.map((camp, i) => (
                                <tr key={i} style={trStyle}>
                                    <td style={tdStyle}>
                                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{new Date(camp.sentAt).toLocaleDateString()}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{new Date(camp.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                    </td>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            {camp.imageUrl && <img src={camp.imageUrl} style={{ width: '40px', height: '40px', borderRadius: '4px', objectFit: 'cover' }} />}
                                            <span style={{ fontWeight: 600 }}>{camp.title}</span>
                                        </div>
                                    </td>
                                    <td style={tdStyle}>{camp.target} ({camp.count || 0}人)</td>
                                    <td style={tdStyle}>
                                        {camp.status === 'sent' ? (
                                            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                                                <CheckCircle size={14} /> 配信完了
                                            </span>
                                        ) : (
                                            <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
                                                <Clock size={14} /> 予約中
                                            </span>
                                        )}
                                    </td>
                                    <td style={tdStyle}>
                                        <button style={actionBtn}><ExternalLink size={18} /></button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Reuse styles from Audience
const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left'
};

const theadRowStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.02)',
    borderBottom: '1px solid var(--border)'
};

const thStyle: React.CSSProperties = {
    padding: '16px 24px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
};

const trStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--border)',
    transition: 'background 0.2s ease'
};

const tdStyle: React.CSSProperties = {
    padding: '16px 24px',
    fontSize: '14px'
};

const actionBtn: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px'
};

export default History;

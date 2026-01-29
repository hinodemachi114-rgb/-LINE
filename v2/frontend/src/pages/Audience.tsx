import { useState, useEffect } from 'react';
import { Search, Filter, Tag, MoreVertical } from 'lucide-react';
import axios from 'axios';

const Audience = () => {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await axios.get('/api/users', {
                    headers: { 'x-session-id': localStorage.getItem('sessionId') }
                });
                setUsers(response.data);
            } catch (error: any) {
                console.error('Fetch users failed', error);
                alert('ユーザーデータの取得に失敗しました。再ログインが必要かもしれません。');
            } finally {
                setLoading(false);
            }
        };
        fetchUsers();
    }, []);

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800 }}>友だち管理</h1>
                    <p style={{ color: 'var(--text-muted)' }}>登録されている友だちのリストと属性を確認します</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div className="glass" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Search size={18} color="var(--text-muted)" />
                        <input type="text" placeholder="名前を検索..." style={searchStyle} />
                    </div>
                    <button className="glass" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <Filter size={18} /> フィルタ
                    </button>
                </div>
            </header>

            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={tableStyle}>
                    <thead>
                        <tr style={theadRowStyle}>
                            <th style={thStyle}>ユーザー名</th>
                            <th style={thStyle}>配信カテゴリ</th>
                            <th style={thStyle}>登録日</th>
                            <th style={thStyle}>アクション</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>読み込み中...</td></tr>
                        ) : users.length === 0 ? (
                            <tr><td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>友だちが見つかりません</td></tr>
                        ) : (
                            users.map((user, i) => (
                                <tr key={i} style={trStyle}>
                                    <td style={tdStyle}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={avatarStyle}>{user.displayName?.charAt(0) || 'U'}</div>
                                            <span style={{ fontWeight: 600 }}>{user.displayName || 'Unnamed'}</span>
                                        </div>
                                    </td>
                                    <td style={tdStyle}>
                                        <span style={tagStyle}>
                                            <Tag size={12} /> {user.category || '未設定'}
                                        </span>
                                    </td>
                                    <td style={tdStyle}>
                                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '---'}
                                    </td>
                                    <td style={tdStyle}>
                                        <button style={actionBtn}><MoreVertical size={18} /></button>
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

// Styles
const searchStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--text-main)',
    outline: 'none',
    fontSize: '14px'
};

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

const avatarStyle: React.CSSProperties = {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'var(--primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: 700,
    color: 'white'
};

const tagStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(6, 199, 85, 0.1)',
    color: 'var(--primary)',
    padding: '4px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600
};

const actionBtn: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px'
};

export default Audience;

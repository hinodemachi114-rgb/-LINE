import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Edit3, Trash2, Clock, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';

const Drafts = () => {
    const [drafts, setDrafts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchDrafts();
    }, []);

    const fetchDrafts = async () => {
        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await axios.get('/api/drafts', {
                headers: { 'x-session-id': sessionId }
            });
            setDrafts(response.data);
        } catch (error) {
            console.error('Fetch drafts failed', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('下書きを削除しますか？')) return;
        try {
            const sessionId = localStorage.getItem('sessionId');
            await axios.delete(`/api/drafts/${id}`, {
                headers: { 'x-session-id': sessionId }
            });
            setDrafts(drafts.filter(d => d.draftId !== id));
        } catch (error) {
            alert('削除に失敗しました');
        }
    };

    const handleEdit = (draft: any) => {
        navigate('/delivery', { state: { draft } });
    };

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 800 }}>下書き一覧</h1>
                <p style={{ color: 'var(--text-muted)' }}>作成途中の配信メッセージを管理・再編集できます</p>
            </header>

            {loading ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '100px' }}>読み込み中...</div>
            ) : drafts.length === 0 ? (
                <div className="glass-card" style={{ textAlign: 'center', padding: '100px', color: 'var(--text-muted)' }}>
                    下書きはありません
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '24px' }}>
                    {drafts.map((draft) => (
                        <div key={draft.draftId} className="glass-card hover-glow" style={draftCardStyle} onClick={() => handleEdit(draft)}>
                            <div style={thumbnailStyle}>
                                {draft.imageUrl ? (
                                    <img src={draft.imageUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <ImageIcon size={32} color="var(--border)" />
                                )}
                                <div style={draftBadgeStyle}>下書き</div>
                            </div>

                            <div style={{ padding: '20px' }}>
                                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {draft.title || '(無題)'}
                                </h3>
                                <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '40px' }}>
                                    {draft.description || '本文なし'}
                                </p>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                                        <Clock size={14} />
                                        <span>{new Date(draft.updatedAt).toLocaleString()}</span>
                                    </div>

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={(e) => handleDelete(draft.draftId, e)}
                                            style={iconBtnStyle('red')}
                                            title="削除"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleEdit(draft)}
                                            style={iconBtnStyle('primary')}
                                            title="編集"
                                        >
                                            <Edit3 size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const draftCardStyle: React.CSSProperties = {
    padding: '0',
    overflow: 'hidden',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column'
};

const thumbnailStyle: React.CSSProperties = {
    height: '180px',
    background: 'rgba(255,255,255,0.03)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderBottom: '1px solid var(--border)'
};

const draftBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: '12px',
    left: '12px',
    background: 'var(--primary)',
    color: 'white',
    fontSize: '11px',
    fontWeight: 800,
    padding: '4px 10px',
    borderRadius: '20px',
    letterSpacing: '0.05em'
};

const iconBtnStyle = (type: string): React.CSSProperties => ({
    background: 'rgba(255,255,255,0.05)',
    border: 'none',
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: type === 'red' ? '#ff4d4d' : 'var(--primary)',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
});

export default Drafts;

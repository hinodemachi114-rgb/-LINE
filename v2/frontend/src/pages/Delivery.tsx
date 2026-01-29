import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Smartphone, Send, Calendar } from 'lucide-react';
import axios from 'axios';

const Delivery = () => {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        imageUrl: '',
        detailLink: '',
        applyLink: '',
        target: 'all',
        tags: [] as string[]
    });
    const [uploading, setUploading] = useState(false);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setUploading(true);
        const data = new FormData();
        data.append('image', file);

        try {
            const sessionId = localStorage.getItem('sessionId');
            const response = await axios.post('/api/upload', data, {
                headers: { 'x-session-id': sessionId }
            });
            setFormData(prev => ({ ...prev, imageUrl: response.data.url }));
        } catch (error) {
            console.error('Upload failed', error);
            alert('アップロードに失敗しました');
        } finally {
            setUploading(false);
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        multiple: false
    });

    return (
        <div className="animate-fade-in">
            <header style={{ marginBottom: '32px' }}>
                <h1 style={{ fontSize: '32px', fontWeight: 800 }}>メッセージ配信作成</h1>
                <p style={{ color: 'var(--text-muted)' }}>新しいお知らせをLINE友だちに配信します</p>
            </header>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: '32px' }}>
                {/* Editor Form */}
                <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div>
                        <label style={labelStyle}>配信タイトル</label>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="例：第n回 固定点研修会のご案内"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                        />
                    </div>

                    <div>
                        <label style={labelStyle}>メッセージ本文</label>
                        <textarea
                            className="form-input"
                            rows={5}
                            placeholder="配信する内容を入力してください"
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                        ></textarea>
                    </div>

                    <div>
                        <label style={labelStyle}>メイン画像</label>
                        <div {...getRootProps()} style={dropzoneStyle(isDragActive, formData.imageUrl)}>
                            <input {...getInputProps()} />
                            {uploading ? (
                                <div>アップロード中...</div>
                            ) : formData.imageUrl ? (
                                <div style={{ position: 'relative', height: '100%' }}>
                                    <img src={formData.imageUrl} style={{ height: '100%', width: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                                    <button onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, imageUrl: '' }); }} style={removeImgBtn}>
                                        <X size={16} />
                                    </button>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center' }}>
                                    <Upload size={32} color="var(--primary)" style={{ marginBottom: '12px' }} />
                                    <p style={{ fontSize: '14px' }}>画像をドラッグ＆ドロップ、またはクリックして選択</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                            <label style={labelStyle}>詳細リンク (任意)</label>
                            <input
                                type="url"
                                className="form-input"
                                placeholder="https://..."
                                value={formData.detailLink}
                                onChange={e => setFormData({ ...formData, detailLink: e.target.value })}
                            />
                        </div>
                        <div>
                            <label style={labelStyle}>申込リンク (任意)</label>
                            <input
                                type="url"
                                className="form-input"
                                placeholder="https://..."
                                value={formData.applyLink}
                                onChange={e => setFormData({ ...formData, applyLink: e.target.value })}
                            />
                        </div>
                    </div>

                    <div style={{ marginTop: '20px', display: 'flex', gap: '12px' }}>
                        <button className="btn-primary" style={{ flex: 1 }}>
                            <Send size={18} /> 今すぐ配信
                        </button>
                        <button className="btn-secondary" style={{ flex: 1 }}>
                            <Calendar size={18} /> 予約配信
                        </button>
                    </div>
                </div>

                {/* Preview Panel */}
                <div>
                    <div style={{ position: 'sticky', top: '40px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--text-muted)' }}>
                            <Smartphone size={20} />
                            <span style={{ fontWeight: 600, fontSize: '14px' }}>プレビュー</span>
                        </div>
                        <FlexPreview data={formData} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const FlexPreview = ({ data }: { data: any }) => (
    <div style={phoneFrame}>
        <div style={messageBubble}>
            {data.imageUrl && (
                <img src={data.imageUrl} style={{ width: '100%', aspectRatio: '20/13', objectFit: 'cover' }} />
            )}
            <div style={{ padding: '16px' }}>
                <h4 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '8px', color: '#333' }}>{data.title || 'タイトル'}</h4>
                <p style={{ fontSize: '13px', color: '#666', whiteSpace: 'pre-wrap', marginBottom: '16px' }}>{data.description || 'メッセージ内容がここに表示されます。'}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {data.detailLink && (
                        <div style={previewBtnStyle('secondary')}>詳細を見る</div>
                    )}
                    {data.applyLink && (
                        <div style={previewBtnStyle('primary')}>申し込む</div>
                    )}
                </div>
            </div>
        </div>
    </div>
);

// Styles
const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '8px'
};

const dropzoneStyle = (active: boolean, hasImg: string): React.CSSProperties => ({
    border: '2px dashed ' + (active ? 'var(--primary)' : 'var(--border)'),
    borderRadius: '12px',
    height: '180px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    background: active ? 'rgba(6, 199, 85, 0.05)' : 'rgba(255, 255, 255, 0.02)',
    transition: 'all 0.2s ease',
    padding: hasImg ? '0' : '20px'
});

const removeImgBtn: React.CSSProperties = {
    position: 'absolute',
    top: '8px',
    right: '8px',
    background: 'rgba(0,0,0,0.5)',
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

const phoneFrame: React.CSSProperties = {
    background: '#EAEAEA',
    width: '100%',
    maxWidth: '320px',
    margin: '0 auto',
    borderRadius: '40px',
    padding: '16px',
    border: '8px solid #333',
    minHeight: '560px'
};

const messageBubble: React.CSSProperties = {
    background: 'white',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
};

const previewBtnStyle = (type: 'primary' | 'secondary'): React.CSSProperties => ({
    padding: '10px',
    textAlign: 'center',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 700,
    background: type === 'primary' ? '#06C755' : '#f4f4f4',
    color: type === 'primary' ? 'white' : '#333'
});

export default Delivery;

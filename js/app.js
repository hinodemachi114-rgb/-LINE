// API Base URL
const API_BASE = '';

// ==================== API Functions ====================

// ダッシュボード統計を取得
async function fetchStats() {
    try {
        const response = await fetch(`${API_BASE}/api/stats`);
        return await response.json();
    } catch (error) {
        console.error('Stats fetch error:', error);
        return { totalFriends: 0, registeredUsers: 0, categoryStats: {}, monthlyDeliveries: 0 };
    }
}

// ユーザー一覧を取得
async function fetchUsers() {
    try {
        const response = await fetch(`${API_BASE}/api/users`);
        return await response.json();
    } catch (error) {
        console.error('Users fetch error:', error);
        return [];
    }
}

// 配信履歴を取得
async function fetchCampaigns() {
    try {
        const response = await fetch(`${API_BASE}/api/campaigns`);
        return await response.json();
    } catch (error) {
        console.error('Campaigns fetch error:', error);
        return [];
    }
}

// ユーザー情報を取得
async function fetchUsers() {
    try {
        const response = await fetch(`${API_BASE}/api/users`);
        return await response.json();
    } catch (error) {
        console.error('Users fetch error:', error);
        return [];
    }
}

// メッセージを配信
async function sendCampaign(data) {
    try {
        const response = await fetch(`${API_BASE}/api/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error('Send error:', error);
        return { success: false, error: error.message };
    }
}

// ==================== Dashboard Page ====================

async function initDashboard() {
    console.log('📊 Dashboard loading...');

    try {
        const stats = await fetchStats();
        console.log('📊 Stats received:', stats);

        // 統計カードを更新
        const totalFriendsEl = document.getElementById('stat-total-friends');
        const registeredUsersEl = document.getElementById('stat-registered-users');
        const monthlyDeliveriesEl = document.getElementById('stat-monthly-deliveries');

        if (totalFriendsEl) totalFriendsEl.textContent = stats.totalFriends.toLocaleString();
        if (registeredUsersEl) registeredUsersEl.textContent = stats.registeredUsers.toLocaleString();
        if (monthlyDeliveriesEl) monthlyDeliveriesEl.textContent = stats.monthlyDeliveries;

        // カテゴリ別統計を更新
        updateCategoryChart(stats.categoryStats);
        updateCategoryList(stats.categoryStats);

        console.log('✅ Dashboard updated');
    } catch (error) {
        console.error('❌ Dashboard error:', error);
    }
}

// ダッシュボード更新（ボタン用、視覚的フィードバック付き）
async function refreshDashboard() {
    const btn = document.getElementById('btn-refresh-dashboard');
    const timeDisplay = document.getElementById('dashboard-update-time');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 更新中...';
    }

    await initDashboard();

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> 更新';
    }

    if (timeDisplay) {
        const now = new Date();
        timeDisplay.textContent = `更新完了 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
}

function updateCategoryChart(categoryStats) {
    const chartContainer = document.getElementById('category-chart');
    if (!chartContainer) return;

    const categories = [
        { key: '1', name: '学生会員', displayName: '学生', color: '#10B981' },
        { key: '2', name: '研修情報のみ', displayName: '研修', color: '#3B82F6' },
        { key: '3', name: '研修・イベント情報のみ', displayName: 'イベント', color: '#F59E0B' },
        { key: '4', name: '研修イベント情報及び会からのお知らせすべて', displayName: 'すべて', color: '#EC4899' }
    ];

    // 最大値を計算
    const maxCount = Math.max(...Object.values(categoryStats), 1);

    let chartHTML = '';
    categories.forEach(cat => {
        const count = categoryStats[cat.name] || 0;
        const height = Math.max((count / maxCount) * 200, 20);
        chartHTML += `
            <div style="text-align:center; width: 20%;">
                <div style="height: ${height}px; background: ${cat.color}; border-radius: 8px 8px 0 0; margin: 0 auto; width: 60%; transition: height 0.5s;"></div>
                <div style="margin-top: 10px; font-size: 12px; font-weight:600;">${cat.displayName || cat.name}</div>
                <div style="font-size: 14px; font-weight:700; color: ${cat.color};">${count}人</div>
            </div>
        `;
    });

    chartContainer.innerHTML = chartHTML;
}

function updateCategoryList(categoryStats) {
    const listContainer = document.getElementById('category-list');
    if (!listContainer) return;

    const categories = [
        { key: '1', name: '学生会員', color: '#10B981' },
        { key: '2', name: '研修情報のみ', color: '#3B82F6' },
        { key: '3', name: '研修・イベント情報のみ', color: '#F59E0B' },
        { key: '4', name: '研修イベント情報及び会からのお知らせすべて', color: '#EC4899' }
    ];

    let listHTML = '';
    categories.forEach(cat => {
        const count = categoryStats[cat.name] || 0;
        listHTML += `
            <li class="category-item">
                <span class="category-name">
                    <span class="category-dot" style="background: ${cat.color};"></span>
                    ${cat.name}
                </span>
                <span class="category-count">${count}人</span>
            </li>
        `;
    });

    listContainer.innerHTML = listHTML;
}

// ==================== Audience Page ====================

async function initAudiencePage() {
    console.log('📊 Loading audience page...');

    try {
        // APIからユーザーデータを取得
        const response = await fetch('/api/users');
        const users = await response.json();

        // カテゴリ別の統計を計算
        const categories = [
            { key: '1', name: '学生会員', color: '#10B981' },
            { key: '2', name: '研修情報のみ', color: '#3B82F6' },
            { key: '3', name: '研修・イベント情報のみ', color: '#F59E0B' },
            { key: '4', name: '全てのお知らせ', color: '#EC4899' }
        ];

        const categoryStats = {};
        categories.forEach(cat => {
            categoryStats[cat.key] = users.filter(u => u.category === cat.key).length;
        });

        // タグテーブルを更新
        const tagTbody = document.getElementById('tag-tbody');
        if (tagTbody) {
            let htmlRows = '';
            categories.forEach(cat => {
                const count = categoryStats[cat.key] || 0;
                htmlRows += `
                    <tr>
                        <td>
                            <span class="category-dot" style="background:${cat.color}; display:inline-block; width:10px; height:10px; border-radius:50%; margin-right:8px;"></span>
                            ${cat.name}
                        </td>
                        <td><strong>${count}人</strong></td>
                        <td>
                            <button class="btn btn-sm" style="color:var(--primary-color);" onclick="viewCategoryUsers('${cat.key}', '${cat.name}')">
                                <i class="fa-solid fa-eye"></i> 詳細
                            </button>
                        </td>
                    </tr>
                `;
            });
            tagTbody.innerHTML = htmlRows;
        }

        // ユーザーリストを更新（最新10件）
        const userList = document.getElementById('user-list');
        if (userList) {
            // 登録日の新しい順にソート
            const sortedUsers = users
                .filter(u => u.registeredAt)
                .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt))
                .slice(0, 10);

            if (sortedUsers.length === 0) {
                userList.innerHTML = '<li class="category-item" style="color:#999;">登録ユーザーがいません</li>';
            } else {
                let listHtml = '';
                sortedUsers.forEach(user => {
                    const catName = categories.find(c => c.key === user.category)?.name || '未設定';
                    const date = user.registeredAt ? new Date(user.registeredAt).toLocaleDateString('ja-JP') : '-';
                    listHtml += `
                        <li class="category-item">
                            <span class="category-name">${user.displayName || 'ユーザー'}</span>
                            <span class="category-count" style="font-size:0.85rem; color:#666;">${catName} (${date})</span>
                        </li>
                    `;
                });
                userList.innerHTML = listHtml;
            }
        }

        console.log('✅ Audience page loaded');
    } catch (error) {
        console.error('Audience page error:', error);
        alert('データの読み込みに失敗しました');
    }
}

// カテゴリ別ユーザー詳細表示（将来の拡張用）
function viewCategoryUsers(categoryKey, categoryName) {
    alert(`「${categoryName}」のユーザー一覧機能は今後追加予定です`);
}

// 友達タグ管理更新（ボタン用、視覚的フィードバック付き）
async function refreshAudience() {
    const btn = document.getElementById('btn-refresh-audience');
    const timeDisplay = document.getElementById('audience-update-time');

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 更新中...';
    }

    await initAudiencePage();

    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> 更新';
    }

    if (timeDisplay) {
        const now = new Date();
        timeDisplay.textContent = `更新完了 ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    }
}

// ==================== Campaign Creation Page ====================

// 現在アップロードされた画像URL
let uploadedImageUrl = '';

async function initCampaignPage() {
    // ngrok URLを自動検出・設定
    await detectAndSetNgrokUrl();

    // Preview Elements
    const previewTitle = document.getElementById('preview-title');
    const previewDesc = document.getElementById('preview-desc');
    const previewImage = document.getElementById('preview-image-display');
    const previewPlaceholder = document.getElementById('preview-image-placeholder');
    const previewDeadline = document.getElementById('preview-deadline');
    const previewDeadlineDate = document.getElementById('preview-deadline-date');

    // Input Elements
    const titleInput = document.getElementById('msg-title');
    const descInput = document.getElementById('msg-desc');
    const imageInput = document.getElementById('msg-image');
    const deadlineInput = document.getElementById('msg-apply-deadline');
    const uploadStatus = document.getElementById('upload-status');

    // ... (Tag Logic Skipped) ...

    // Real-time Preview Updaters
    if (titleInput) {
        titleInput.addEventListener('input', (e) => {
            if (previewTitle) previewTitle.textContent = e.target.value || 'ここに題名が入ります';
        });
    }

    if (descInput) {
        descInput.addEventListener('input', (e) => {
            if (previewDesc) previewDesc.textContent = e.target.value || 'ここに詳細テキストが表示されます。入力フォームの内容がリアルタイムに反映されます。';
        });
    }

    // 締切日プレビュー
    if (deadlineInput) {
        deadlineInput.addEventListener('change', (e) => {
            if (previewDeadline) {
                if (e.target.value) {
                    const date = new Date(e.target.value);
                    const formatted = `${date.getMonth() + 1}/${date.getDate()}`;
                    previewDeadlineDate.textContent = formatted;
                    previewDeadline.style.display = 'block';
                } else {
                    previewDeadline.style.display = 'none';
                }
            }
        });
    }

    // Image Upload with Preview
    if (imageInput) {
        imageInput.addEventListener('change', async function (e) {
            if (this.files && this.files[0]) {
                const file = this.files[0];

                // ローカルプレビュー
                const reader = new FileReader();
                reader.onload = function (e) {
                    if (previewImage) {
                        previewImage.src = e.target.result;
                        previewImage.style.display = 'block';
                        if (previewPlaceholder) previewPlaceholder.style.display = 'none';
                    }
                }
                reader.readAsDataURL(file);

                // サーバーへアップロード
                if (uploadStatus) uploadStatus.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> アップロード中...';

                try {
                    const formData = new FormData();
                    formData.append('image', file);

                    const response = await fetch('/api/upload', {
                        method: 'POST',
                        body: formData
                    });

                    const result = await response.json();

                    if (result.success && result.imageUrl) {
                        uploadedImageUrl = result.imageUrl;
                        document.getElementById('msg-image-url').value = result.imageUrl;
                        uploadStatus.innerHTML = '<i class="fa-solid fa-check" style="color:green;"></i> アップロード完了';
                    } else {
                        console.error('Upload failed:', result);
                        const errorDetail = result.error || result.details || JSON.stringify(result);
                        uploadStatus.innerHTML = '<i class="fa-solid fa-exclamation-triangle" style="color:red;"></i> エラー: ' + errorDetail;
                        alert('【エラー詳細】\n' + errorDetail + '\n\nDrive状態: ' + JSON.stringify(result.driveStatus || 'N/A'));
                        document.getElementById('msg-image-url').value = '';
                        if (previewImage) previewImage.style.display = 'none';
                        if (previewPlaceholder) previewPlaceholder.style.display = 'flex';
                    }
                } catch (error) {
                    uploadStatus.innerHTML = '<i class="fa-solid fa-exclamation-triangle" style="color:red;"></i> ' + error.message;
                }
            }
        });
    }

    // Form Submit
    const form = document.getElementById('campaign-form');
    if (form) {
        form.addEventListener('submit', handleCampaignSubmit);
    }

    // 下書き保存ボタン
    const saveDraftBtn = document.getElementById('btn-save-draft');
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', handleSaveDraft);
    }

    // 下書き選択
    const draftSelector = document.getElementById('draft-selector');
    if (draftSelector) {
        loadDraftList();
        draftSelector.addEventListener('change', (e) => {
            handleLoadDraft(e);
            // 削除ボタンの表示/非表示
            const deleteBtn = document.getElementById('btn-delete-draft');
            if (deleteBtn) {
                deleteBtn.style.display = e.target.value ? 'block' : 'none';
            }
        });
    }

    // 下書き削除ボタン
    const deleteDraftBtn = document.getElementById('btn-delete-draft');
    if (deleteDraftBtn) {
        deleteDraftBtn.addEventListener('click', handleDeleteDraft);
    }

    // 予約日時変更時のボタンテキスト更新
    const scheduleInput = document.getElementById('schedule-datetime');
    if (scheduleInput) {
        scheduleInput.addEventListener('change', (e) => {
            const btnText = document.getElementById('submit-btn-text');
            if (e.target.value) {
                btnText.textContent = '予約配信';
            } else {
                btnText.textContent = '配信する';
            }
        });
    }
}

// 下書き一覧読み込み
async function loadDraftList() {
    try {
        const response = await fetch('/api/drafts');
        const drafts = await response.json();
        const selector = document.getElementById('draft-selector');
        if (!selector) return;

        selector.innerHTML = '<option value="">-- 下書きを選択 --</option>';
        drafts.forEach(draft => {
            const option = document.createElement('option');
            option.value = draft.draftId;
            const date = new Date(draft.createdAt).toLocaleDateString('ja-JP');
            option.textContent = `${draft.title || '(無題)'} - ${date}`;
            selector.appendChild(option);
        });
    } catch (error) {
        console.error('Draft list load error:', error);
    }
}

// 下書き保存
async function handleSaveDraft() {
    const btn = document.getElementById('btn-save-draft');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...';
    btn.disabled = true;

    try {
        const selectedTags = [];
        document.querySelectorAll('.tag-check:checked').forEach(cb => {
            if (cb.value) selectedTags.push(cb.value);
        });

        const result = await fetch('/api/drafts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: document.getElementById('msg-title').value,
                description: document.getElementById('msg-desc').value,
                imageUrl: document.getElementById('msg-image-url').value || uploadedImageUrl,
                detailLink: document.getElementById('msg-detail-link').value,
                applyLink: document.getElementById('msg-apply-link').value,
                applyStart: document.getElementById('msg-apply-start')?.value || '',
                applyDeadline: document.getElementById('msg-apply-deadline')?.value || '',
                tags: selectedTags
            })
        });

        const data = await result.json();
        if (data.success) {
            alert('✅ ' + data.message);
            loadDraftList();
        } else {
            alert('❌ ' + (data.error || '保存に失敗しました'));
        }
    } catch (error) {
        alert('❌ エラー: ' + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// 下書き読み込み
async function handleLoadDraft(e) {
    const draftId = e.target.value;
    if (!draftId) return;

    try {
        const response = await fetch(`/api/drafts/${draftId}`);
        const draft = await response.json();

        if (draft.draftId) {
            document.getElementById('msg-title').value = draft.title || '';
            document.getElementById('msg-desc').value = draft.description || '';
            document.getElementById('msg-image-url').value = draft.imageUrl || '';
            document.getElementById('msg-detail-link').value = draft.detailLink || '';
            document.getElementById('msg-apply-link').value = draft.applyLink || '';
            if (document.getElementById('msg-apply-start')) {
                document.getElementById('msg-apply-start').value = draft.applyStart || '';
            }
            if (document.getElementById('msg-apply-deadline')) {
                document.getElementById('msg-apply-deadline').value = draft.applyDeadline || '';
            }

            // タグチェックボックス復元
            document.querySelectorAll('.tag-check').forEach(cb => cb.checked = false);
            if (draft.tags) {
                const savedTags = draft.tags.split(',');
                savedTags.forEach(tag => {
                    const checkbox = document.querySelector(`.tag-check[value="${tag}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }

            // プレビュー更新
            const previewTitle = document.getElementById('preview-title');
            const previewDesc = document.getElementById('preview-desc');
            if (previewTitle) previewTitle.textContent = draft.title || 'ここに題名が入ります';
            if (previewDesc) previewDesc.textContent = draft.description || 'ここに詳細テキストが表示されます。';

            // 画像プレビュー
            if (draft.imageUrl) {
                const previewImg = document.getElementById('preview-image-display');
                const placeholder = document.getElementById('preview-image-placeholder');
                if (previewImg && placeholder) {
                    previewImg.src = draft.imageUrl;
                    previewImg.style.display = 'block';
                    placeholder.style.display = 'none';
                }
                uploadedImageUrl = draft.imageUrl;
            }

            alert('✅ 下書きを読み込みました');
        }
    } catch (error) {
        alert('❌ 読み込みエラー: ' + error.message);
    }
}

// 下書き削除
async function handleDeleteDraft() {
    const selector = document.getElementById('draft-selector');
    const draftId = selector?.value;

    if (!draftId) {
        alert('削除する下書きを選択してください');
        return;
    }

    if (!confirm('この下書きを削除してもよろしいですか？')) {
        return;
    }

    const btn = document.getElementById('btn-delete-draft');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        const response = await fetch(`/api/drafts/${draftId}`, {
            method: 'DELETE'
        });
        const data = await response.json();

        if (data.success) {
            alert('✅ 下書きを削除しました');
            selector.value = '';
            btn.style.display = 'none';
            loadDraftList();
        } else {
            alert('❌ ' + (data.error || '削除に失敗しました'));
        }
    } catch (error) {
        alert('❌ エラー: ' + error.message);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
}

// ngrok URLを自動検出してサーバーに設定
async function detectAndSetNgrokUrl() {
    try {
        // ngrokのローカルAPIからトンネル情報を取得
        const response = await fetch('http://127.0.0.1:4040/api/tunnels');
        const data = await response.json();

        if (data.tunnels && data.tunnels.length > 0) {
            const httpsUrl = data.tunnels.find(t => t.proto === 'https')?.public_url || data.tunnels[0].public_url;

            // サーバーに公開URLを設定
            await fetch('/api/set-base-url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: httpsUrl })
            });

            console.log('ngrok URL set:', httpsUrl);
        }
    } catch (error) {
        // ngrokが起動していない場合は無視（ローカルURLを使用）
        console.log('ngrok not detected, using local URL for images');
    }
}

async function handleCampaignSubmit(e) {
    e.preventDefault();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 送信中...';
    submitBtn.disabled = true;

    try {
        // ラジオボタン廃止のため常にsegment
        const target = 'segment';
        const title = document.getElementById('msg-title').value;
        const description = document.getElementById('msg-desc').value;
        const imageUrl = document.getElementById('msg-image-url').value || uploadedImageUrl;
        const detailLink = document.getElementById('msg-detail-link').value;
        const applyLink = document.getElementById('msg-apply-link').value;
        const applyStart = document.getElementById('msg-apply-start')?.value || '';
        const applyDeadline = document.getElementById('msg-apply-deadline')?.value || '';

        // 選択されたタグを取得（value属性から直接取得）
        const selectedTags = [];
        document.querySelectorAll('.tag-check:checked').forEach(checkbox => {
            if (checkbox.value) {
                selectedTags.push(checkbox.value);
            }
        });

        // 予約配信チェック
        const scheduledAt = document.getElementById('schedule-datetime')?.value || '';

        let result;
        if (scheduledAt) {
            // 予約配信
            result = await fetch('/api/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    target,
                    tags: selectedTags,
                    title,
                    description,
                    imageUrl,
                    detailLink,
                    applyLink,
                    applyStart,
                    applyDeadline,
                    scheduledAt
                })
            }).then(r => r.json());
        } else {
            // 即時配信
            result = await sendCampaign({
                target,
                tags: selectedTags,
                title,
                description,
                imageUrl,
                detailLink,
                applyLink,
                applyStart,
                applyDeadline
            });
        }

        if (result.success) {
            alert(`✅ ${result.message}`);
            // フォームをリセット
            e.target.reset();
            uploadedImageUrl = '';
            document.getElementById('msg-image-url').value = '';
            document.getElementById('upload-status').innerHTML = '';
            document.getElementById('preview-title').textContent = 'ここに題名が入ります';
            document.getElementById('preview-desc').textContent = 'ここに詳細テキストが表示されます。';
            document.getElementById('preview-image-display').src = 'https://placehold.co/600x400/e2e8f0/94a3b8?text=Image';
        } else {
            alert(`❌ エラー: ${result.error || '配信に失敗しました'}`);
        }
    } catch (error) {
        alert(`❌ エラー: ${error.message}`);
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// ==================== History Page ====================

async function initHistoryPage() {
    const campaigns = await fetchCampaigns();
    const tbody = document.getElementById('history-tbody');

    if (!tbody) return;

    if (campaigns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#999; padding:2rem;">配信履歴がありません</td></tr>';
        return;
    }

    let html = '';
    campaigns.forEach(campaign => {
        const date = campaign.sentAt ? new Date(campaign.sentAt).toLocaleString('ja-JP') : '-';
        const statusBadge = campaign.status === 'sent'
            ? '<span class="badge badge-sent">送信済</span>'
            : '<span class="badge badge-scheduled">予約</span>';

        html += `
            <tr>
                <td>${date}</td>
                <td>${campaign.title || '-'}</td>
                <td>${campaign.target || '-'}</td>
                <td>${campaign.count || '-'}</td>
                <td>${statusBadge}</td>
                <td><button class="btn btn-sm" style="color:var(--primary-color);" onclick="showCampaignDetail('${campaign.title}')">詳細</button></td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

function showCampaignDetail(title) {
    const modal = document.getElementById('detail-modal');
    const modalTitle = document.getElementById('modal-msg-title');
    if (modalTitle) modalTitle.textContent = title;
    if (modal) modal.classList.add('active');
}

// ==================== Modal Controls ====================

function initModal() {
    const modal = document.getElementById('detail-modal');
    const closeBtn = document.getElementById('modal-close');

    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
        });
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
}

// ==================== Page Initialization ====================

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    // 共通初期化
    initModal();
    initMobileMenu();

    // ページ別初期化
    if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
        initDashboard();
    } else if (path.includes('create-campaign.html')) {
        initCampaignPage();
    } else if (path.includes('history.html')) {
        // history.htmlは独自実装があるためスキップ
        // initHistoryPage(); 
    } else if (path.includes('audience.html')) {
        initAudiencePage();
    }
});

// ==================== Mobile Menu ====================
function initMobileMenu() {
    const menuBtn = document.getElementById('menu-toggle');
    const sidebar = document.querySelector('.sidebar');

    // オーバーレイ生成
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);

    function toggleMenu() {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    }

    if (menuBtn) {
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleMenu();
        });
    }

    // オーバーレイクリックで閉じる
    overlay.addEventListener('click', toggleMenu);

    // リンククリック時にも閉じる
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                overlay.classList.remove('active');
            }
        });
    });
}

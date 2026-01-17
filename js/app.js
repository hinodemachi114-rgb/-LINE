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
    const stats = await fetchStats();

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

                    if (result.success) {
                        uploadedImageUrl = result.imageUrl;
                        document.getElementById('msg-image-url').value = result.imageUrl;
                        uploadStatus.innerHTML = '<i class="fa-solid fa-check" style="color:green;"></i> アップロード完了';
                    } else {
                        uploadStatus.innerHTML = '<i class="fa-solid fa-exclamation-triangle" style="color:red;"></i> ' + (result.error || 'アップロード失敗');
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
        const target = document.querySelector('input[name="target"]:checked').value;
        const title = document.getElementById('msg-title').value;
        const description = document.getElementById('msg-desc').value;
        const imageUrl = document.getElementById('msg-image-url').value || uploadedImageUrl;
        const detailLink = document.getElementById('msg-detail-link').value;
        const applyLink = document.getElementById('msg-apply-link').value;
        const applyStart = document.getElementById('msg-apply-start')?.value || '';
        const applyDeadline = document.getElementById('msg-apply-deadline')?.value || '';

        // 選択されたタグを取得
        const selectedTags = [];
        if (target === 'segment') {
            document.querySelectorAll('.tag-check:checked').forEach(checkbox => {
                const tagName = checkbox.nextElementSibling.textContent.trim();
                if (tagName.includes('学生')) selectedTags.push('1');
                if (tagName.includes('研修情報のみ')) selectedTags.push('2');
                if (tagName.includes('研修・イベント')) selectedTags.push('3');
                if (tagName.includes('すべて')) selectedTags.push('4');
            });
        }

        const result = await sendCampaign({
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

// ==================== Audience Page ====================

async function initAudiencePage() {
    const users = await fetchUsers();

    // タグ別集計
    const tagCounts = { '1': 0, '2': 0, '3': 0, '4': 0 };
    users.forEach(user => {
        if (user.category && tagCounts[user.category] !== undefined) {
            tagCounts[user.category]++;
        }
    });

    // タグテーブル更新
    const tagTbody = document.getElementById('tag-tbody');
    if (tagTbody) {
        const tags = [
            { key: '1', name: '学生会員' },
            { key: '2', name: '研修情報のみ' },
            { key: '3', name: '研修・イベント情報のみ' },
            { key: '4', name: '研修イベント情報及び会からのお知らせすべて' }
        ];

        let html = '';
        tags.forEach(tag => {
            html += `
                <tr>
                    <td>${tag.name}</td>
                    <td>${tagCounts[tag.key]}名</td>
                    <td>-</td>
                </tr>
            `;
        });
        tagTbody.innerHTML = html;
    }

    // ユーザーリスト更新
    const userList = document.getElementById('user-list');
    if (userList) {
        const recentUsers = users.slice(-5).reverse(); // 最新5件
        let html = '';
        recentUsers.forEach(user => {
            const categoryName = getCategoryName(user.category);
            html += `
                <li class="category-item">
                    <span class="category-name">
                        <div class="avatar" style="width:30px;height:30px;margin-right:10px;background:#ddd;"></div>
                        ${user.displayName || 'Unknown'}
                    </span>
                    <span class="category-count">${categoryName}</span>
                </li>
            `;
        });
        userList.innerHTML = html || '<li class="category-item">ユーザーがいません</li>';
    }
}

function getCategoryName(categoryId) {
    const names = {
        '1': '学生会員',
        '2': '研修情報のみ',
        '3': '研修・イベント',
        '4': 'すべて'
    };
    return names[categoryId] || '未選択';
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
        initHistoryPage();
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

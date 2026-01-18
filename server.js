require('dotenv').config();
const express = require('express');
const cors = require('cors');
const line = require('@line/bot-sdk');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();

// セッション管理（簡易版）
const sessions = new Map();
const inviteTokens = new Map(); // 招待トークン管理

// CORS設定（開発用）
app.use(cors());

// 静的ファイル配信（UIファイル）
app.use(express.static(__dirname));

// アップロードディレクトリの確認と作成
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
    console.log('📁 Creating uploads directory...');
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// アップロードファイル配信
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer設定（画像アップロード用）
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        cb(null, uniqueName);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('画像ファイルのみアップロード可能です'));
        }
    }
});

// ngrok URL（画像配信用）
// 画像配信用ベースURL
// RENDER_EXTERNAL_URL: Renderで自動設定される環境変数
let publicBaseUrl = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_BASE_URL || 'http://localhost:3000';
console.log('🌐 Base URL set to:', publicBaseUrl);

// LINE SDK設定
const lineConfig = {
    channelId: process.env.LINE_CHANNEL_ID,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
};

const lineClient = new line.messagingApi.MessagingApiClient({
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

// Google Services設定
let sheets;
let drive;
let auth;

async function initGoogleServices() {
    try {
        let authOptions;
        const scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file'
        ];

        // 環境変数からJSON文字列を読み込む（クラウドデプロイ用）
        if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            try {
                const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
                authOptions = {
                    credentials,
                    scopes
                };
                console.log('📋 Google認証: 環境変数から読み込み');
            } catch (parseError) {
                console.error('⚠️  GOOGLE_SERVICE_ACCOUNT_KEY のパースに失敗:', parseError.message);
                return;
            }
        } else {
            // ファイルパスから読み込む（ローカル開発用）
            const keyPath = path.resolve(__dirname, process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './credentials.json');

            if (!fs.existsSync(keyPath)) {
                console.warn('⚠️  Google Sheets credentials not found at:', keyPath);
                console.warn('   Sheets機能は無効化されます。');
                return;
            }

            authOptions = {
                keyFile: keyPath,
                scopes
            };
            console.log('📋 Google認証: ファイルから読み込み');
        }

        auth = new google.auth.GoogleAuth(authOptions);

        sheets = google.sheets({ version: 'v4', auth });
        drive = google.drive({ version: 'v3', auth });
        console.log('✅ Google API (Sheets & Drive) 接続成功');

        // 診断：スプレッドシートのシート名を取得
        try {
            const spreadsheet = await sheets.spreadsheets.get({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID
            });
            const sheetNames = spreadsheet.data.sheets.map(s => s.properties.title);
            console.log('📋 利用可能なシート名:', sheetNames);

            // draftsシートが存在しない場合は自動作成
            if (!sheetNames.includes('drafts')) {
                console.log('📝 draftsシートを自動作成中...');
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                    resource: {
                        requests: [{
                            addSheet: {
                                properties: { title: 'drafts' }
                            }
                        }]
                    }
                });

                // ヘッダー行を追加
                await sheets.spreadsheets.values.update({
                    spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                    range: 'drafts!A1:K1',
                    valueInputOption: 'RAW',
                    resource: {
                        values: [['draftId', 'title', 'description', 'imageUrl', 'detailLink', 'applyLink', 'applyStart', 'applyDeadline', 'tags', 'createdAt', 'updatedAt']]
                    }
                });
                console.log('✅ draftsシート作成完了');
            }
        } catch (diagError) {
            console.error('⚠️  シート名取得エラー:', diagError.message);
        }
    } catch (error) {
        console.error('Google Sheets初期化エラー:', error.message);
    }
}

// カテゴリ定義
const CATEGORIES = {
    '1': { name: '学生会員', keyword: '学生' },
    '2': { name: '研修情報のみ', keyword: '研修' },
    '3': { name: '研修・イベント情報のみ', keyword: 'イベント' },
    '4': { name: '研修イベント情報及び会からのお知らせすべて', keyword: 'すべて' }
};

// ==================== API エンドポイント ====================

// ダッシュボード統計取得
app.get('/api/stats', async (req, res) => {
    try {
        const users = await getSheetData('users');
        const totalFriends = users.length;

        // カテゴリ別集計
        const categoryStats = {};
        for (const key in CATEGORIES) {
            categoryStats[CATEGORIES[key].name] = users.filter(u => u.category === key).length;
        }

        res.json({
            totalFriends,
            registeredUsers: users.filter(u => u.category).length,
            categoryStats,
            monthlyDeliveries: 4 // モックデータ
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.json({
            totalFriends: 0,
            registeredUsers: 0,
            categoryStats: {},
            monthlyDeliveries: 0
        });
    }
});

// ユーザー一覧取得
app.get('/api/users', async (req, res) => {
    try {
        const users = await getSheetData('users');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 配信履歴取得
app.get('/api/campaigns', async (req, res) => {
    try {
        const campaigns = await getSheetData('campaigns');
        res.json(campaigns);
    } catch (error) {
        res.json([]); // エラー時は空配列
    }
});

// 画像アップロード
app.post('/api/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '画像ファイルが必要です' });
        }

        // ngrok URLが設定されていれば使用、なければローカルURL
        const baseUrl = publicBaseUrl || `http://localhost:${process.env.PORT || 3000}`;
        const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;

        res.json({
            success: true,
            filename: req.file.filename,
            imageUrl: imageUrl
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ngrok URL更新
app.post('/api/set-base-url', express.json(), (req, res) => {
    const { url } = req.body;
    if (url) {
        publicBaseUrl = url.replace(/\/$/, ''); // 末尾スラッシュ削除
        console.log('📡 公開URL設定:', publicBaseUrl);
        res.json({ success: true, url: publicBaseUrl });
    } else {
        res.status(400).json({ error: 'URLが必要です' });
    }
});

// ==================== 管理者API ====================

// メール送信設定
function createMailTransporter() {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });
}

// 管理者一覧取得
app.get('/api/admins', async (req, res) => {
    try {
        const admins = await getSheetData('admins');
        // パスワードを除外して返す
        const safeAdmins = admins.map(a => ({
            email: a.email,
            name: a.name,
            role: a.role,
            status: a.status,
            createdAt: a.createdAt
        }));
        res.json(safeAdmins);
    } catch (error) {
        res.json([]);
    }
});

// 管理者招待（スーパー管理者のみ）
app.post('/api/admins/invite', express.json(), async (req, res) => {
    try {
        const { email, name, inviterEmail } = req.body;

        // スーパー管理者チェック
        if (inviterEmail !== process.env.SUPER_ADMIN_EMAIL) {
            return res.status(403).json({ error: '招待権限がありません' });
        }

        // 既存チェック
        const admins = await getSheetData('admins');
        if (admins.find(a => a.email === email)) {
            return res.status(400).json({ error: 'このメールアドレスは既に登録されています' });
        }

        // 招待トークン生成
        const token = crypto.randomBytes(32).toString('hex');
        inviteTokens.set(token, { email, name, expires: Date.now() + 24 * 60 * 60 * 1000 }); // 24時間有効

        // 管理者レコード追加（ステータス：招待中）
        await appendToSheet('admins', [
            email,
            name,
            'admin', // role
            '', // password (空)
            'invited', // status
            new Date().toISOString()
        ]);

        // 招待メール送信
        const baseUrl = publicBaseUrl || `http://localhost:${process.env.PORT || 3000}`;
        const setupUrl = `${baseUrl}/setup-password.html?token=${token}`;

        try {
            const transporter = createMailTransporter();
            await transporter.sendMail({
                from: process.env.GMAIL_USER,
                to: email,
                subject: '【福岡市薬剤師会】LINE管理システム 管理者招待',
                html: `
                    <h2>管理者招待</h2>
                    <p>${name} 様</p>
                    <p>福岡市薬剤師会 LINE管理システムの管理者として招待されました。</p>
                    <p>以下のリンクからパスワードを設定してください（24時間有効）：</p>
                    <p><a href="${setupUrl}">${setupUrl}</a></p>
                    <p>※このメールに心当たりがない場合は無視してください。</p>
                `
            });
            res.json({ success: true, message: `${email}に招待メールを送信しました` });
        } catch (mailError) {
            console.error('Mail error:', mailError);
            res.json({ success: true, message: '管理者を追加しました（メール送信に問題がありました）', setupUrl });
        }
    } catch (error) {
        console.error('Invite error:', error);
        res.status(500).json({ error: error.message });
    }
});

// パスワード設定
app.post('/api/admins/set-password', express.json(), async (req, res) => {
    try {
        const { token, password } = req.body;

        const tokenData = inviteTokens.get(token);
        if (!tokenData || tokenData.expires < Date.now()) {
            return res.status(400).json({ error: 'トークンが無効または期限切れです' });
        }

        // パスワードハッシュ化
        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

        // 管理者レコード更新
        await updateAdminPassword(tokenData.email, hashedPassword);

        inviteTokens.delete(token);

        res.json({ success: true, message: 'パスワードを設定しました。ログインしてください。' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ログイン
app.post('/api/login', express.json(), async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('🔐 ログイン試行:', email);

        const admins = await getSheetData('admins');
        console.log('📋 管理者一覧:', admins.map(a => ({ email: a.email, status: a.status, hasPassword: !!a.password })));

        const admin = admins.find(a => a.email === email);

        if (!admin) {
            console.log('❌ 管理者が見つかりません');
            return res.status(401).json({ error: 'メールアドレスまたはパスワードが間違っています' });
        }

        console.log('✅ 管理者発見:', { email: admin.email, status: admin.status });

        if (admin.status !== 'active') {
            console.log('❌ ステータスがactiveではありません:', admin.status);
            return res.status(401).json({ error: 'アカウントが有効化されていません' });
        }

        const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
        console.log('🔑 パスワード比較:');
        console.log('   入力ハッシュ:', hashedPassword);
        console.log('   DB保存値:', admin.password);

        if (admin.password !== hashedPassword) {
            console.log('❌ パスワード不一致');
            return res.status(401).json({ error: 'メールアドレスまたはパスワードが間違っています' });
        }

        // セッション作成
        const sessionId = crypto.randomBytes(16).toString('hex');
        sessions.set(sessionId, {
            email: admin.email,
            name: admin.name,
            role: admin.role,
            isSuperAdmin: admin.email === process.env.SUPER_ADMIN_EMAIL
        });

        res.json({
            success: true,
            sessionId,
            name: admin.name,
            isSuperAdmin: admin.email === process.env.SUPER_ADMIN_EMAIL
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ログアウト
app.post('/api/logout', express.json(), (req, res) => {
    const { sessionId } = req.body;
    sessions.delete(sessionId);
    res.json({ success: true });
});

// セッション確認
app.get('/api/session', (req, res) => {
    const sessionId = req.query.sessionId;
    const session = sessions.get(sessionId);
    if (session) {
        res.json({ valid: true, ...session });
    } else {
        res.json({ valid: false });
    }
});

// 管理者削除（スーパー管理者のみ）
app.delete('/api/admins/:email', express.json(), async (req, res) => {
    try {
        const targetEmail = decodeURIComponent(req.params.email);
        const { inviterEmail } = req.body;

        if (inviterEmail !== process.env.SUPER_ADMIN_EMAIL) {
            return res.status(403).json({ error: '削除権限がありません' });
        }

        if (targetEmail === process.env.SUPER_ADMIN_EMAIL) {
            return res.status(400).json({ error: 'スーパー管理者は削除できません' });
        }

        await deleteAdminFromSheet(targetEmail);
        res.json({ success: true, message: '管理者を削除しました' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 管理者パスワード更新ヘルパー
async function updateAdminPassword(email, hashedPassword) {
    if (!sheets) return;

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: 'admins!A:F'
        });

        const rows = response.data.values || [];
        let rowIndex = -1;

        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] === email) {
                rowIndex = i + 1;
                break;
            }
        }

        if (rowIndex > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: `admins!D${rowIndex}:E${rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[hashedPassword, 'active']] }
            });
        }
    } catch (error) {
        console.error('updateAdminPassword error:', error.message);
    }
}

// 管理者削除ヘルパー
async function deleteAdminFromSheet(email) {
    if (!sheets) return;

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: 'admins!A:F'
        });

        const rows = response.data.values || [];
        let rowIndex = -1;

        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] === email) {
                rowIndex = i;
                break;
            }
        }

        if (rowIndex > 0) {
            // 行を削除（空行で上書き後、batchUpdateで削除）
            const sheetId = await getSheetId('admins');
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: rowIndex,
                                endIndex: rowIndex + 1
                            }
                        }
                    }]
                }
            });
        }
    } catch (error) {
        console.error('deleteAdminFromSheet error:', error.message);
    }
}

// シートID取得ヘルパー
async function getSheetId(sheetName) {
    const response = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID
    });
    const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : 0;
}

// Google Drive画像プロキシ (LINE配信用)
app.get('/api/proxy-image/:fileId', async (req, res) => {
    try {
        const fileId = req.params.fileId;
        if (!drive) {
            return res.status(503).send('Drive service unavailable');
        }

        // ファイルのメタデータを取得（MIMEタイプ確認）
        const file = await drive.files.get({
            fileId: fileId,
            fields: 'mimeType, name'
        });

        res.setHeader('Content-Type', file.data.mimeType);

        // 画像データをストリームで取得してパイプ
        const response = await drive.files.get(
            { fileId: fileId, alt: 'media' },
            { responseType: 'stream' }
        );

        response.data
            .on('end', () => { })
            .on('error', err => {
                console.error('Proxy stream error:', err);
                res.status(500).end();
            })
            .pipe(res);

    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(404).send('Image not found');
    }
});

app.post('/api/upload', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'ファイルがアップロードされていません' });
        }

        const filePath = req.file.path;
        let imageUrl = '';

        // Google Driveへアップロード試行
        console.log('📤 Uploading file. Drive enabled:', !!drive);
        if (drive) {
            try {
                // uploadToDriveはfileIdを返すように変更
                const fileId = await uploadToDrive(filePath, req.file.mimetype);

                if (fileId) {
                    // プロキシURLを構築
                    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
                    const host = req.headers['x-forwarded-host'] || req.get('host');
                    const dynamicBaseUrl = `${protocol}://${host}`;

                    imageUrl = `${dynamicBaseUrl}/api/proxy-image/${fileId}`;
                    console.log('✅ Generated Proxy URL:', imageUrl);

                    // ローカルの一時ファイルは削除
                    fs.unlink(filePath, (err) => {
                        if (err) console.error('Temp file delete error:', err);
                    });
                } else {
                    console.log('⚠️ Drive upload returned null');
                }
            } catch (driveError) {
                console.error('❌ Drive upload failed:', driveError.message);
            }
        }

        // Driveが使えない、または失敗した場合はローカルURLを使用 (動的生成)
        if (!imageUrl) {
            const protocol = req.headers['x-forwarded-proto'] || req.protocol;
            const host = req.headers['x-forwarded-host'] || req.get('host');
            const dynamicBaseUrl = `${protocol}://${host}`;

            imageUrl = `${dynamicBaseUrl}/uploads/${req.file.filename}`;
            console.log('⚠️ Fallback to local URL:', imageUrl);
        }

        res.json({ success: true, imageUrl: imageUrl });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/send', express.json(), async (req, res) => {
    try {
        const { target, tags, title, description, imageUrl, detailLink, applyLink, applyStart, applyDeadline } = req.body;

        // 対象ユーザー取得
        let targetUsers = await getSheetData('users');

        if (target === 'segment' && tags && tags.length > 0) {
            // タグでフィルタリング（選択タグ + 全てのお知らせ希望者）
            targetUsers = targetUsers.filter(user => tags.includes(user.category) || user.category === '4');
        }

        if (targetUsers.length === 0) {
            return res.status(400).json({ error: '配信対象ユーザーがいません' });
        }

        // リッチメッセージ作成
        const flexMessage = createRichMessage(title, description, imageUrl, detailLink, applyLink);

        // 配信実行
        const userIds = targetUsers.map(u => u.userId).filter(id => id);

        if (userIds.length > 0) {
            await lineClient.multicast({
                to: userIds,
                messages: [flexMessage]
            });
        }

        // 配信履歴保存（申込期間を追加）
        await appendToSheet('campaigns', [
            new Date().toISOString(),
            title,
            target === 'segment' ? tags.join(',') : '全員',
            userIds.length,
            'sent',
            description,
            imageUrl || '',
            detailLink || '',
            applyLink || '',
            applyStart || '',
            applyDeadline || ''
        ]);

        res.json({
            success: true,
            sentCount: userIds.length,
            message: `${userIds.length}人に配信しました`
        });
    } catch (error) {
        console.error('Send error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ==================== 予約配信機能 ====================

// 予約配信保存
app.post('/api/schedule', express.json(), async (req, res) => {
    try {
        const { target, tags, title, description, imageUrl, detailLink, applyLink, applyStart, applyDeadline, scheduledAt } = req.body;

        if (!scheduledAt) {
            return res.status(400).json({ error: '予約日時を指定してください' });
        }

        const scheduledDate = new Date(scheduledAt);
        if (scheduledDate <= new Date()) {
            return res.status(400).json({ error: '予約日時は現在時刻より後に設定してください' });
        }

        // 対象ユーザー数を事前計算
        let targetUsers = await getSheetData('users');
        if (target === 'segment' && tags && tags.length > 0) {
            targetUsers = targetUsers.filter(user => tags.includes(user.category) || user.category === '4');
        }

        // 予約保存
        const scheduleId = `SCH-${Date.now()}`;
        await appendToSheet('campaigns', [
            scheduledDate.toISOString(),  // sentAt (予約時刻)
            title,
            target === 'segment' ? tags.join(',') : '全員',
            targetUsers.length,
            'scheduled',  // status
            description,
            imageUrl || '',
            detailLink || '',
            applyLink || '',
            applyStart || '',
            applyDeadline || '',
            scheduleId  // scheduleId
        ]);

        res.json({
            success: true,
            scheduleId,
            targetCount: targetUsers.length,
            scheduledAt: scheduledDate.toISOString(),
            message: `${targetUsers.length}人への配信を ${scheduledDate.toLocaleString('ja-JP')} に予約しました`
        });
    } catch (error) {
        console.error('Schedule error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 予約配信スケジューラー（1分ごとにチェック）
setInterval(async () => {
    try {
        const campaigns = await getSheetData('campaigns');
        const now = new Date();

        for (const campaign of campaigns) {
            if (campaign.status === 'scheduled') {
                const scheduledTime = new Date(campaign.sentAt);
                if (scheduledTime <= now) {
                    console.log(`⏰ 予約配信実行: ${campaign.title}`);

                    // 対象ユーザー取得
                    let targetUsers = await getSheetData('users');
                    const tags = campaign.target ? campaign.target.split(',') : [];

                    if (campaign.target !== '全員' && tags.length > 0) {
                        targetUsers = targetUsers.filter(user => tags.includes(user.category) || user.category === '4');
                    }

                    const userIds = targetUsers.map(u => u.userId).filter(id => id);

                    if (userIds.length > 0) {
                        const flexMessage = createRichMessage(
                            campaign.title,
                            campaign.description,
                            campaign.imageUrl,
                            campaign.detailLink,
                            campaign.applyLink
                        );

                        await lineClient.multicast({
                            to: userIds,
                            messages: [flexMessage]
                        });

                        console.log(`✅ 予約配信完了: ${userIds.length}人に送信`);
                    }

                    // ステータス更新
                    await updateCampaignStatus(campaign.sentAt, 'sent');
                }
            }
        }
    } catch (error) {
        console.error('Scheduler error:', error);
    }
}, 60000); // 1分ごと

// キャンペーンステータス更新
async function updateCampaignStatus(sentAt, newStatus) {
    try {
        const campaigns = await getSheetData('campaigns');
        const rowIndex = campaigns.findIndex(c => c.sentAt === sentAt);
        if (rowIndex >= 0) {
            const sheetId = await getSheetIdByName('campaigns');
            await sheets.spreadsheets.values.update({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: `campaigns!E${rowIndex + 2}`,
                valueInputOption: 'RAW',
                resource: { values: [[newStatus]] }
            });
        }
    } catch (error) {
        console.error('Status update error:', error);
    }
}

// ==================== 下書き機能 ====================

// 下書き保存
app.post('/api/drafts', express.json(), async (req, res) => {
    try {
        const { title, description, imageUrl, detailLink, applyLink, applyStart, applyDeadline, tags } = req.body;

        const draftId = `DRF-${Date.now()}`;
        const now = new Date().toISOString();

        await appendToSheet('drafts', [
            draftId,
            title || '',
            description || '',
            imageUrl || '',
            detailLink || '',
            applyLink || '',
            applyStart || '',
            applyDeadline || '',
            tags ? tags.join(',') : '',
            now,  // createdAt
            now   // updatedAt
        ]);

        res.json({
            success: true,
            draftId,
            message: '下書きを保存しました'
        });
    } catch (error) {
        console.error('Draft save error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 下書き一覧取得
app.get('/api/drafts', async (req, res) => {
    try {
        const drafts = await getSheetData('drafts');
        // 新しい順にソート
        drafts.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
        res.json(drafts);
    } catch (error) {
        console.error('Draft list error:', error);
        res.json([]);
    }
});

// 下書き取得
app.get('/api/drafts/:id', async (req, res) => {
    try {
        const drafts = await getSheetData('drafts');
        const draft = drafts.find(d => d.draftId === req.params.id);
        if (draft) {
            res.json(draft);
        } else {
            res.status(404).json({ error: '下書きが見つかりません' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 下書き削除
app.delete('/api/drafts/:id', async (req, res) => {
    try {
        const drafts = await getSheetData('drafts');
        const rowIndex = drafts.findIndex(d => d.draftId === req.params.id);

        if (rowIndex >= 0) {
            const sheetId = await getSheetId('drafts');
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: rowIndex + 1,
                                endIndex: rowIndex + 2
                            }
                        }
                    }]
                }
            });
            res.json({ success: true, message: '下書きを削除しました' });
        } else {
            res.status(404).json({ error: '下書きが見つかりません' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==================== LINE Webhook ====================

app.post('/webhook', line.middleware(lineConfig), async (req, res) => {
    try {
        const events = req.body.events;

        await Promise.all(events.map(handleLineEvent));

        res.status(200).send('OK');
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Error');
    }
});

async function handleLineEvent(event) {
    if (event.type === 'follow') {
        // 友だち追加時
        const userId = event.source.userId;

        try {
            const profile = await lineClient.getProfile(userId);

            // 既存ユーザーチェック（重複防止）
            const existingUsers = await getSheetData('users');
            const existingUser = existingUsers.find(u => u.userId === userId);

            if (existingUser) {
                // 既存ユーザー（ブロック解除など）の場合はカテゴリ選択メッセージのみ送信
                console.log(`📱 既存ユーザー再フォロー: ${profile.displayName} (${userId})`);
            } else {
                // 新規ユーザーの場合のみスプレッドシートに保存
                await appendToSheet('users', [
                    userId,
                    profile.displayName,
                    '', // カテゴリ未選択
                    new Date().toISOString()
                ]);
                console.log(`🆕 新規ユーザー登録: ${profile.displayName} (${userId})`);
            }

            // カテゴリ選択メッセージ送信（新規・既存どちらも）
            await lineClient.replyMessage({
                replyToken: event.replyToken,
                messages: [createCategorySelectionMessage()]
            });
        } catch (error) {
            console.error('Follow event error:', error);
        }
    } else if (event.type === 'message' && event.message.type === 'text') {
        // テキストメッセージ受信時
        const userId = event.source.userId;
        const text = event.message.text.trim();

        // カテゴリ番号の判定
        if (['1', '2', '3', '4'].includes(text)) {
            await updateUserCategory(userId, text);

            const categoryName = CATEGORIES[text].name;
            await lineClient.replyMessage({
                replyToken: event.replyToken,
                messages: [{
                    type: 'text',
                    text: `「${categoryName}」に登録しました✨\nご希望の情報をお届けします！`
                }]
            });
        }
        // 登録確認コマンド
        else if (text === '登録確認' || text === '確認') {
            try {
                const users = await getSheetData('users');
                const user = users.find(u => u.userId === userId);

                if (user && user.category && CATEGORIES[user.category]) {
                    const categoryName = CATEGORIES[user.category].name;
                    await lineClient.replyMessage({
                        replyToken: event.replyToken,
                        messages: [{
                            type: 'flex',
                            altText: '登録情報の確認',
                            contents: {
                                type: 'bubble',
                                body: {
                                    type: 'box',
                                    layout: 'vertical',
                                    contents: [
                                        {
                                            type: 'text',
                                            text: '📋 あなたの登録情報',
                                            weight: 'bold',
                                            size: 'lg'
                                        },
                                        {
                                            type: 'separator',
                                            margin: 'lg'
                                        },
                                        {
                                            type: 'box',
                                            layout: 'vertical',
                                            margin: 'lg',
                                            backgroundColor: '#E8F5E9',
                                            cornerRadius: 'md',
                                            paddingAll: 'lg',
                                            contents: [
                                                {
                                                    type: 'text',
                                                    text: '現在の配信カテゴリ',
                                                    size: 'sm',
                                                    color: '#666666'
                                                },
                                                {
                                                    type: 'text',
                                                    text: categoryName,
                                                    weight: 'bold',
                                                    size: 'xl',
                                                    color: '#06C755',
                                                    margin: 'sm'
                                                }
                                            ]
                                        },
                                        {
                                            type: 'text',
                                            text: '変更したい場合は、下のメニューから「登録情報変更」ボタンを押してください',
                                            size: 'xs',
                                            color: '#999999',
                                            margin: 'lg',
                                            wrap: true
                                        }
                                    ]
                                }
                            }
                        }]
                    });
                } else {
                    // カテゴリ未設定の場合
                    await lineClient.replyMessage({
                        replyToken: event.replyToken,
                        messages: [
                            {
                                type: 'text',
                                text: 'まだカテゴリが設定されていません。\n以下から選択してください！'
                            },
                            createCategorySelectionMessage()
                        ]
                    });
                }
            } catch (error) {
                console.error('Registration check error:', error);
            }
        }
        // 変更コマンド
        else if (text === '変更' || text === 'カテゴリ変更') {
            await lineClient.replyMessage({
                replyToken: event.replyToken,
                messages: [
                    {
                        type: 'text',
                        text: '配信カテゴリを変更します📝\n番号を選んで送信してください！'
                    },
                    createCategorySelectionMessage()
                ]
            });
        }
        // 研修会一覧コマンド
        else if (['研修会一覧', 'イベント一覧', '研修', 'イベント'].includes(text)) {
            try {
                // キャンペーンデータを取得
                const campaigns = await getSheetData('campaigns');
                const today = new Date();
                today.setHours(0, 0, 0, 0); // 時間をリセットして日付のみ比較

                // フィルタリング: 申込期限内または期限未設定のものを表示
                // ※ユーザー要望: 「申込期限以降のものは表示しない」 => 期限切れを除外
                const activeEvents = campaigns.filter(c => {
                    // 申込リンクがないものは除外（ただのお知らせの可能性）
                    if (!c.applyLink && !c.detailLink) return false;

                    let isActive = true;

                    // 開始日チェック
                    if (c.applyStart) {
                        const startDate = new Date(c.applyStart);
                        if (today < startDate) isActive = false;
                    }

                    // 締切日チェック
                    if (c.applyDeadline) {
                        const deadlineDate = new Date(c.applyDeadline);
                        // 締切日の23:59:59まで有効とするため翌日の00:00と比較するか、単純に比較
                        // ここでは締切当日も含むように修正
                        deadlineDate.setHours(23, 59, 59, 999);
                        if (today > deadlineDate) isActive = false;
                    } else {
                        // 期限が設定されていない場合でも、申込リンクがあれば表示する？
                        // 要望は「期限を入れる必要がある」「期限以降は表示しない」
                        // => 期限がなければ「常時開催」または「期限なし」として表示してよいと判断
                        // ただし、あまりに古いものを出さないように直近3ヶ月以内などの制限も検討できるが
                        // 一旦期限未設定は表示とする
                    }

                    return isActive;
                });

                // 新しい順または締切が近い順にソート？
                // ここでは締切が近い順かつ締切があるものを優先、なければ配信日順
                activeEvents.sort((a, b) => {
                    if (a.applyDeadline && b.applyDeadline) {
                        return new Date(a.applyDeadline) - new Date(b.applyDeadline);
                    }
                    return new Date(b.sentAt) - new Date(a.sentAt);
                });

                // 最大10件
                const displayEvents = activeEvents.slice(0, 10);

                if (displayEvents.length === 0) {
                    await lineClient.replyMessage({
                        replyToken: event.replyToken,
                        messages: [{
                            type: 'text',
                            text: '現在受付中の研修会・イベントはありません 🙇‍♂️\n次回のお知らせをお待ちください！'
                        }]
                    });
                } else {
                    // カルーセルメッセージ作成
                    const carouselContents = displayEvents.map(event => {
                        const hasImage = !!event.imageUrl;

                        // 画像URLの相対パス対応（ngrok用）
                        let displayImageUrl = event.imageUrl;
                        // Webhookからの返信で相対パスは使えないため、ベースURLが必要
                        // ただし簡易実装として、絶対パスが入っている前提とする
                        // ngrokが変わると見えなくなる問題はあるが、現状の仕組み上仕方ない部分はあり
                        // ※理想は永続的なストレージURL

                        // プレースホルダー画像
                        if (!displayImageUrl) {
                            displayImageUrl = 'https://placehold.co/600x400/e2e8f0/94a3b8?text=Event';
                        }

                        // ボタンを動的に生成
                        const footerContents = [];

                        if (event.detailLink) {
                            footerContents.push({
                                type: 'button',
                                style: 'secondary',
                                height: 'sm',
                                action: {
                                    type: 'uri',
                                    label: '詳細を見る',
                                    uri: event.detailLink
                                }
                            });
                        }

                        if (event.applyLink) {
                            footerContents.push({
                                type: 'button',
                                style: 'primary',
                                height: 'sm',
                                color: '#06C755',
                                action: {
                                    type: 'uri',
                                    label: '申し込む',
                                    uri: event.applyLink
                                }
                            });
                        }

                        // リンクがどちらもない場合のフォールバック
                        if (footerContents.length === 0) {
                            footerContents.push({
                                type: 'button',
                                style: 'link',
                                height: 'sm',
                                action: {
                                    type: 'uri',
                                    label: '公式サイトへ',
                                    uri: 'https://www.fpa.gr.jp/'
                                }
                            });
                        }

                        return {
                            type: 'bubble',
                            size: 'kilo', // サイズを少し大きくして見やすく
                            header: {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'text',
                                        text: '受付中✨',
                                        color: '#ffffff',
                                        align: 'center',
                                        size: 'xs',
                                        offsetTop: '3px'
                                    }
                                ],
                                backgroundColor: '#ff334b',
                                paddingTop: '19px',
                                paddingAll: '12px',
                                paddingBottom: '16px'
                            },
                            hero: {
                                type: 'image',
                                url: displayImageUrl,
                                size: 'full',
                                aspectRatio: '20:13',
                                aspectMode: 'cover'
                            },
                            body: {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'text',
                                        text: event.title,
                                        weight: 'bold',
                                        size: 'sm',
                                        wrap: true,
                                        maxLines: 3 // タイトルも少し長く表示できるように
                                    },
                                    {
                                        type: 'text',
                                        text: event.applyDeadline ? `📅 締切: ${event.applyDeadline}` : '📅 締切: なし',
                                        size: 'xs',
                                        color: '#aaaaaa',
                                        margin: 'sm'
                                    }
                                ],
                                spacing: 'sm',
                                paddingAll: '13px'
                            },
                            footer: {
                                type: 'box',
                                layout: 'vertical',
                                spacing: 'sm',
                                contents: footerContents,
                                flex: 0
                            }
                        };
                    });

                    await lineClient.replyMessage({
                        replyToken: event.replyToken,
                        messages: [{
                            type: 'flex',
                            altText: '研修会一覧',
                            contents: {
                                type: 'carousel',
                                contents: carouselContents
                            }
                        }]
                    });
                }

            } catch (error) {
                console.error('Event list error:', error);
                await lineClient.replyMessage({
                    replyToken: event.replyToken,
                    messages: [{
                        type: 'text',
                        text: '情報の取得中にエラーが発生しました。しばらく経ってから再度お試しください。'
                    }]
                });
            }
        }
    }
}

// カテゴリ選択メッセージ
function createCategorySelectionMessage() {
    return {
        type: 'flex',
        altText: '配信カテゴリを選択してください',
        contents: {
            type: 'bubble',
            body: {
                type: 'box',
                layout: 'vertical',
                contents: [
                    {
                        type: 'text',
                        text: '🎉 友だち追加ありがとうございます！',
                        weight: 'bold',
                        size: 'md',
                        wrap: true
                    },
                    {
                        type: 'text',
                        text: '福岡市薬剤師会からお届けする情報を選択してください。番号を送信してね！',
                        size: 'sm',
                        color: '#666666',
                        margin: 'md',
                        wrap: true
                    },
                    {
                        type: 'box',
                        layout: 'vertical',
                        margin: 'md',
                        backgroundColor: '#FFF3CD',
                        cornerRadius: 'md',
                        paddingAll: 'md',
                        contents: [
                            {
                                type: 'text',
                                text: '📢 配信回数について',
                                weight: 'bold',
                                size: 'sm',
                                color: '#856404'
                            },
                            {
                                type: 'text',
                                text: '学生会員 ＜ 研修のみ ＜ 研修・イベント ＜ すべて',
                                size: 'sm',
                                color: '#856404',
                                margin: 'sm',
                                wrap: true
                            }
                        ]
                    },
                    {
                        type: 'text',
                        text: '📱 リッチメニューからいつでも確認と変更ができます',
                        size: 'xs',
                        color: '#06C755',
                        margin: 'md',
                        wrap: true
                    },
                    {
                        type: 'text',
                        text: '※選択しない場合は「4️⃣ 全てのお知らせ」が自動で設定されます',
                        size: 'xs',
                        color: '#999999',
                        margin: 'sm',
                        wrap: true
                    },
                    {
                        type: 'separator',
                        margin: 'lg'
                    },
                    {
                        type: 'text',
                        text: '1️⃣ 学生会員',
                        margin: 'lg',
                        size: 'md'
                    },
                    {
                        type: 'text',
                        text: '2️⃣ 研修情報のみ',
                        margin: 'md',
                        size: 'md'
                    },
                    {
                        type: 'text',
                        text: '3️⃣ 研修・イベント情報のみ',
                        margin: 'md',
                        size: 'md'
                    },
                    {
                        type: 'text',
                        text: '4️⃣ 全てのお知らせ',
                        margin: 'md',
                        size: 'md'
                    }
                ]
            }
        }
    };
}

// リッチメッセージ作成
function createRichMessage(title, description, imageUrl, detailLink, applyLink) {
    const contents = {
        type: 'bubble',
        hero: imageUrl ? {
            type: 'image',
            url: imageUrl,
            size: 'full',
            aspectRatio: '20:13',
            aspectMode: 'cover'
        } : undefined,
        body: {
            type: 'box',
            layout: 'vertical',
            contents: [
                {
                    type: 'text',
                    text: title,
                    weight: 'bold',
                    size: 'md', // xl -> md に縮小
                    wrap: true
                },
                {
                    type: 'text',
                    text: description,
                    size: 'xs', // sm -> xs に縮小
                    color: '#666666',
                    margin: 'md',
                    wrap: true,
                    maxLines: 100 // より多く表示できるように増加
                }
            ]
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: []
        }
    };

    // ボタン追加
    if (detailLink) {
        contents.footer.contents.push({
            type: 'button',
            style: 'secondary',
            action: {
                type: 'uri',
                label: '詳細を見る',
                uri: detailLink
            }
        });
    }

    if (applyLink) {
        contents.footer.contents.push({
            type: 'button',
            style: 'primary',
            color: '#06C755',
            action: {
                type: 'uri',
                label: '申し込む',
                uri: applyLink
            }
        });
    }

    // heroがundefinedの場合削除
    if (!contents.hero) delete contents.hero;
    if (contents.footer.contents.length === 0) delete contents.footer;

    return {
        type: 'flex',
        altText: title,
        contents
    };
}

// ==================== Google Sheets ヘルパー ====================

async function getSheetData(sheetName) {
    if (!sheets) return [];

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `${sheetName}!A2:Z1000`
        });

        const rows = response.data.values || [];

        if (sheetName === 'users') {
            return rows.map(row => ({
                userId: row[0],
                displayName: row[1],
                category: row[2],
                registeredAt: row[3]
            }));
        } else if (sheetName === 'campaigns') {
            return rows.map(row => ({
                sentAt: row[0],
                title: row[1],
                target: row[2],
                count: row[3],
                status: row[4],
                description: row[5] || '',
                imageUrl: row[6] || '',
                detailLink: row[7] || '',
                applyLink: row[8] || '',
                applyStart: row[9] || '',
                applyDeadline: row[10] || ''
            }));
        } else if (sheetName === 'admins') {
            return rows.map(row => ({
                email: row[0],
                name: row[1],
                role: row[2],
                password: row[3],
                status: row[4],
                createdAt: row[5]
            }));
        } else if (sheetName === 'drafts') {
            return rows.map(row => ({
                draftId: row[0],
                title: row[1],
                description: row[2],
                imageUrl: row[3],
                detailLink: row[4],
                applyLink: row[5],
                applyStart: row[6],
                applyDeadline: row[7],
                tags: row[8],
                createdAt: row[9],
                updatedAt: row[10]
            }));
        }

        return rows;
    } catch (error) {
        console.error('getSheetData error:', error.message);
        return [];
    }
}

async function appendToSheet(sheetName, values) {
    if (!sheets) {
        console.warn('Sheets not initialized, skipping append');
        return;
    }

    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `${sheetName}!A:Z`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [values] }
        });
    } catch (error) {
        console.error('appendToSheet error:', error.message);
    }
}

async function uploadToDrive(filePath, mimeType) {
    if (!drive) {
        console.warn('Drive not initialized');
        return null;
    }

    try {
        // 1. ファイルアップロード
        const fileMetadata = {
            name: path.basename(filePath)
        };
        // フォルダID指定があれば追加
        if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
            fileMetadata.parents = [process.env.GOOGLE_DRIVE_FOLDER_ID];
        }

        const media = {
            mimeType: mimeType,
            body: fs.createReadStream(filePath)
        };

        const file = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id'
        });

        const fileId = file.data.id;
        console.log('✅ Google Drive upload success, ID:', fileId);

        // 2. 公開設定 (誰でも閲覧可能)
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        });

        // fileIdを返す (プロキシで使用するため)
        return fileId;

    } catch (error) {
        console.error('Drive upload error:', error.message);
        return null;
    }
}

async function updateUserCategory(userId, category) {
    if (!sheets) return;

    try {
        // 既存データ取得
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: 'users!A:D'
        });

        const rows = response.data.values || [];
        let rowIndex = -1;

        for (let i = 0; i < rows.length; i++) {
            if (rows[i][0] === userId) {
                rowIndex = i + 1; // 1-indexed
                break;
            }
        }

        if (rowIndex > 0) {
            // カテゴリ更新
            await sheets.spreadsheets.values.update({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: `users!C${rowIndex}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[category]] }
            });
        }
    } catch (error) {
        console.error('updateUserCategory error:', error.message);
    }
}

// ==================== サーバー起動 ====================

const PORT = process.env.PORT || 3000;

// ngrok URL自動検出
async function detectNgrokUrl() {
    try {
        const http = require('http');

        return new Promise((resolve) => {
            const req = http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const tunnels = JSON.parse(data);
                        if (tunnels.tunnels && tunnels.tunnels.length > 0) {
                            const httpsUrl = tunnels.tunnels.find(t => t.proto === 'https')?.public_url || tunnels.tunnels[0].public_url;
                            resolve(httpsUrl);
                        } else {
                            resolve(null);
                        }
                    } catch (e) {
                        resolve(null);
                    }
                });
            });

            req.on('error', () => resolve(null));
            req.setTimeout(2000, () => {
                req.destroy();
                resolve(null);
            });
        });
    } catch (error) {
        return null;
    }
}

app.listen(PORT, async () => {
    console.log('');
    console.log('🚀 福岡市薬剤師会 公式LINE管理アプリ');
    console.log('================================');
    console.log(`📡 サーバー起動: http://localhost:${PORT}`);
    console.log(`📱 管理画面: http://localhost:${PORT}/index.html`);
    console.log('');

    await initGoogleServices();

    // ngrok URL自動検出
    const ngrokUrl = await detectNgrokUrl();
    if (ngrokUrl) {
        publicBaseUrl = ngrokUrl;
        console.log(`🌐 ngrok検出: ${publicBaseUrl}`);
        console.log('   画像配信用URLが自動設定されました');
    } else {
        console.log('⚠️  ngrokが検出されませんでした');
        console.log('   画像付きLINE配信を行うには、ngrokを起動してサーバーを再起動してください');
    }

    console.log('');
});

// ==================== Render スリープ防止 ====================
// 無料プランは15分でスリープするため、14分ごとに自己pingを実行
const KEEP_ALIVE_INTERVAL = 14 * 60 * 1000; // 14分

function keepAlive() {
    const url = process.env.RENDER_EXTERNAL_URL;
    if (url) {
        const https = require('https');
        https.get(`${url}/api/health`, (res) => {
            console.log(`🏃 Keep-alive ping: ${res.statusCode}`);
        }).on('error', (err) => {
            console.log('Keep-alive ping failed:', err.message);
        });
    }
}

// ヘルスチェックエンドポイント
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 起動後にkeep-aliveを開始
if (process.env.RENDER_EXTERNAL_URL) {
    setInterval(keepAlive, KEEP_ALIVE_INTERVAL);
    console.log('🔄 Keep-alive enabled (14-minute interval)');
}

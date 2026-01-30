const express = require('express');
const line = require('@line/bot-sdk');
const dotenv = require('dotenv');
const cors = require('cors');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Serve Frontend Static Files (Production) ---
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
    app.use(express.static(frontendDistPath));
    console.log('🌐 Serving frontend from:', frontendDistPath);
}

// --- Multer for local uploads ---
const upload = multer({ dest: 'uploads/' });

// --- Helper for Google Drive upload ---
async function uploadToDrive(filePath, mimeType) {
    if (!drive) return null;
    try {
        const fileMetadata = { name: path.basename(filePath) };
        if (process.env.GOOGLE_DRIVE_FOLDER_ID) {
            fileMetadata.parents = [process.env.GOOGLE_DRIVE_FOLDER_ID];
        }
        const media = { mimeType, body: fs.createReadStream(filePath) };
        const file = await drive.files.create({ resource: fileMetadata, media, fields: 'id' });
        await drive.permissions.create({ fileId: file.data.id, requestBody: { role: 'reader', type: 'anyone' } });
        return file.data.id;
    } catch (error) {
        console.error('Drive upload error:', error.message);
        return null;
    }
}

// --- Configuration ---
const lineConfig = {
    channelId: process.env.LINE_CHANNEL_ID,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
};

const lineClient = new line.messagingApi.MessagingApiClient({
    channelAccessToken: lineConfig.channelAccessToken
});

const CATEGORIES = {
    '1': { name: '学生会員', keyword: '学生' },
    '2': { name: '研修情報のみ', keyword: '研修' },
    '3': { name: '研修・イベント情報のみ', keyword: 'イベント' },
    '4': { name: '研修イベント情報及び会からのお知らせすべて', keyword: 'すべて' }
};

// --- Google Services ---
let sheets, drive, auth;

async function initGoogleServices() {
    try {
        let authOptions;
        const scopes = [
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive.file'
        ];

        if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
            const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
            authOptions = { credentials, scopes };
        } else {
            const keyPath = path.resolve(__dirname, process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './credentials.json');
            if (fs.existsSync(keyPath)) {
                authOptions = { keyFile: keyPath, scopes };
            } else {
                console.warn('⚠️ Google Credentials not found. Sheets features will be limited.');
                return;
            }
        }

        auth = new google.auth.GoogleAuth(authOptions);
        sheets = google.sheets({ version: 'v4', auth });
        drive = google.drive({ version: 'v3', auth });
        console.log('✅ Google API initialized');
    } catch (error) {
        console.error('❌ Google API initialization failed:', error.message);
    }
}

// --- Middlewares ---
const sessions = new Map();

function requireAuth(req, res, next) {
    const sessionId = req.headers['x-session-id'] || req.query.sessionId;
    if (!sessionId || !sessions.has(sessionId)) {
        return res.status(401).json({ error: '認証が必要です。ログインしてください。' });
    }
    req.session = sessions.get(sessionId);
    next();
}

function requireSuperAdmin(req, res, next) {
    requireAuth(req, res, () => {
        if (!req.session.isSuperAdmin) {
            return res.status(403).json({ error: '全体管理者権限が必要です。' });
        }
        next();
    });
}

// --- Helper Functions ---
async function getSheetData(sheetName) {
    if (!sheets) return [];
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `${sheetName}!A:Z`
        });
        const rows = response.data.values || [];
        if (rows.length === 0) return [];

        // Determine if first row is a header
        let hasHeader = false;
        const firstRow = rows[0];
        if (sheetName === 'users') {
            hasHeader = (firstRow[0] === 'userId' || firstRow[0] === 'ユーザーID');
        } else if (sheetName === 'campaigns') {
            hasHeader = (firstRow[0] === 'sentAt' || firstRow[0] === '配信日時');
        } else if (sheetName === 'drafts') {
            hasHeader = (firstRow[0] === 'draftId');
        } else if (sheetName === 'admins') {
            hasHeader = (firstRow[0] === 'email');
        }

        const headers = hasHeader ? rows[0] : null;
        const dataRows = hasHeader ? rows.slice(1) : rows;

        return dataRows.map(row => {
            const obj = {};
            if (headers) {
                headers.forEach((h, i) => obj[h] = row[i] || '');
            } else {
                // Default legacy mapping if no headers
                if (sheetName === 'users') {
                    obj.userId = row[0] || '';
                    obj.displayName = row[1] || '';
                    obj.category = row[2] || '';
                    obj.registeredAt = row[3] || '';
                } else if (sheetName === 'campaigns') {
                    obj.sentAt = row[0] || '';
                    obj.title = row[1] || '';
                    obj.target = row[2] || '';
                    obj.sentCount = row[3] || '';
                    obj.status = row[4] || '';
                    obj.description = row[5] || '';
                    obj.imageUrl = row[6] || '';
                    obj.detailLink = row[7] || '';
                    obj.applyLink = row[8] || '';
                    obj.applyStart = row[9] || '';
                    obj.applyDeadline = row[10] || '';
                } else if (sheetName === 'drafts') {
                    obj.draftId = row[0] || '';
                    obj.title = row[1] || '';
                    obj.description = row[2] || '';
                    obj.imageUrl = row[3] || '';
                    obj.detailLink = row[4] || '';
                    obj.applyLink = row[5] || '';
                    obj.applyStart = row[6] || '';
                    obj.applyDeadline = row[7] || '';
                    obj.tags = row[8] || '';
                    obj.createdAt = row[9] || '';
                    obj.updatedAt = row[10] || '';
                    obj.target = row[11] || '';
                } else if (sheetName === 'admins') {
                    obj.email = row[0] || '';
                    obj.password = row[1] || '';
                    obj.name = row[2] || '';
                    obj.role = row[3] || '';
                }
            }

            // Post-processing for certain fields
            if (sheetName === 'drafts' && typeof obj.tags === 'string') {
                obj.tags = obj.tags ? obj.tags.split(',') : [];
            }
            if (sheetName === 'users' && !obj.userId && row[0]) obj.userId = row[0]; // Fallback

            return obj;
        });
    } catch (error) {
        console.error(`getSheetData error (${sheetName}):`, error.message);
        return [];
    }
}

async function getSheetId(sheetName) {
    if (!sheets) return null;
    const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID
    });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : null;
}

async function appendToSheet(sheetName, values) {
    if (!sheets) return;
    try {
        await sheets.spreadsheets.values.append({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: `${sheetName}!A:Z`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [values] }
        });
    } catch (error) {
        console.error(`appendToSheet error (${sheetName}):`, error.message);
    }
}

// --- API Endpoints ---

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const admins = await getSheetData('admins');
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    const admin = admins.find(a => a.email === email && (a.password === password || a.password === hashedPassword));
    const isHardcodedAdmin = (email === 'hinodemahi114@gmail.com' && password === 'test123');

    if (admin || isHardcodedAdmin) {
        const sessionId = crypto.randomUUID();
        const sessionData = {
            sessionId,
            email,
            name: admin ? admin.name : '管理者',
            isSuperAdmin: (email === 'hinodemachi114@gmail.com' || email === 'hinodemahi114@gmail.com' || (admin && admin.role === 'super')),
            createdAt: Date.now()
        };
        sessions.set(sessionId, sessionData);
        res.json({ success: true, ...sessionData });
    } else {
        res.status(401).json({ success: false, error: 'IDまたはパスワードが正しくありません' });
    }
});

// Session Check
app.get('/api/session', (req, res) => {
    const sessionId = req.query.sessionId;
    if (sessions.has(sessionId)) {
        res.json({ valid: true, ...sessions.get(sessionId) });
    } else {
        res.json({ valid: false });
    }
});

// Stats
app.get('/api/stats', requireAuth, async (req, res) => {
    try {
        const users = await getSheetData('users');
        const campaigns = await getSheetData('campaigns');

        const categoryStats = {};
        Object.values(CATEGORIES).forEach(c => {
            categoryStats[c.id] = users.filter(u => u.category === c.name || u.category === c.id).length;
        });

        const activeCampaigns = campaigns.filter(c => c.status === 'sent');
        const now = new Date();
        const thisMonthCampaigns = activeCampaigns.filter(c => {
            const d = new Date(c.sentAt);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        res.json({
            totalFriends: users.length,
            registeredUsers: users.filter(u => u.category).length,
            categoryStats,
            monthlyDeliveries: thisMonthCampaigns.length,
            totalDeliveries: activeCampaigns.length,
            recentCampaigns: activeCampaigns.slice(-5).reverse()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Users
app.get('/api/users', requireAuth, async (req, res) => {
    const users = await getSheetData('users');
    const mappedUsers = users.map(u => ({
        ...u,
        createdAt: u.registeredAt || u.createdAt || ''
    }));
    res.json(mappedUsers);
});

// Campaigns
app.get('/api/campaigns', requireAuth, async (req, res) => {
    const campaigns = await getSheetData('campaigns');
    res.json(campaigns);
});

// Drafts
app.get('/api/drafts', requireAuth, async (req, res) => {
    const drafts = await getSheetData('drafts');
    // Ensure mapping matches legacy structure
    res.json(drafts);
});

app.post('/api/drafts', requireAuth, async (req, res) => {
    try {
        const { draftId, title, description, imageUrl, detailLink, applyLink, applyStart, applyDeadline, tags, target } = req.body;
        const drafts = await getSheetData('drafts');
        const now = new Date().toISOString();

        const rowData = [
            draftId || `DRF-${Date.now()}`,
            title || '',
            description || '',
            imageUrl || '',
            detailLink || '',
            applyLink || '',
            applyStart || '',
            applyDeadline || '',
            Array.isArray(tags) ? tags.join(',') : (tags || ''),
            now,
            now,
            target || 'all'
        ];

        const existingIndex = drafts.findIndex(d => d.draftId === draftId);
        if (existingIndex > -1) {
            // Update existing
            await sheets.spreadsheets.values.update({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: `drafts!A${existingIndex + 2}:L${existingIndex + 2}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [rowData] }
            });
        } else {
            // Append new
            await appendToSheet('drafts', rowData);
        }
        res.json({ success: true, draftId: rowData[0] });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/drafts/:id', requireAuth, async (req, res) => {
    try {
        const draftId = req.params.id;
        const drafts = await getSheetData('drafts');
        const index = drafts.findIndex(d => d.draftId === draftId);
        if (index > -1) {
            const sheetId = await getSheetId('drafts');
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                resource: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId: sheetId,
                                dimension: 'ROWS',
                                startIndex: index + 1,
                                endIndex: index + 2
                            }
                        }
                    }]
                }
            });
            res.json({ success: true });
        } else {
            res.status(404).json({ error: '下書きが見つかりません' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Immediate Send
app.post('/api/send', requireAuth, async (req, res) => {
    try {
        const { target, tags, title, description, imageUrl, detailLink, applyLink, applyStart, applyDeadline } = req.body;
        const users = await getSheetData('users');
        let targetUsers = users;

        if (target === 'segment' && tags && tags.length > 0) {
            targetUsers = users.filter(user => tags.includes(user.category) || user.category === '4');
        }

        const userIds = targetUsers.map(u => u.userId).filter(id => id);
        if (userIds.length === 0) return res.status(400).json({ error: '配信対象ユーザーがいません' });

        const flexMessage = createRichMessage(title, description, imageUrl, detailLink, applyLink);
        const BATCH_SIZE = 500;
        let sentSuccess = 0;

        for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
            const batch = userIds.slice(i, i + BATCH_SIZE);
            try {
                await lineClient.multicast({
                    messages: [flexMessage],
                    to: batch
                });
                sentSuccess += batch.length;
            } catch (err) {
                console.error(`Batch send failed:`, err.message);
            }
        }

        await appendToSheet('campaigns', [
            new Date().toISOString(), title, target === 'segment' ? tags.join(',') : '全員',
            sentSuccess, 'sent', description, imageUrl || '', detailLink || '',
            applyLink || '', applyStart || '', applyDeadline || ''
        ]);

        res.json({ success: true, sentCount: sentSuccess });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Schedule Send
app.post('/api/schedule', requireAuth, async (req, res) => {
    try {
        const { target, tags, title, description, imageUrl, detailLink, applyLink, applyStart, applyDeadline, scheduledAt } = req.body;
        if (!scheduledAt) return res.status(400).json({ error: '予約日時を指定してください' });

        const users = await getSheetData('users');
        let targetUsers = users;
        if (target === 'segment' && tags && tags.length > 0) {
            targetUsers = users.filter(user => tags.includes(user.category) || user.category === '4');
        }

        await appendToSheet('campaigns', [
            scheduledAt, title, target === 'segment' ? tags.join(',') : '全員',
            targetUsers.length, 'scheduled', description, imageUrl || '',
            detailLink || '', applyLink || '', applyStart || '', applyDeadline || '',
            `SCH-${Date.now()}`
        ]);

        res.json({ success: true, targetCount: targetUsers.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel Schedule
app.post('/api/campaigns/cancel', requireAuth, async (req, res) => {
    try {
        const { sentAt } = req.body;
        if (!sentAt) return res.status(400).json({ error: 'キャンセル対象が指定されていません' });

        const campaigns = await getSheetData('campaigns');
        const index = campaigns.findIndex(c => c.sentAt === sentAt && c.status === 'scheduled');

        if (index > -1) {
            // v2 simplicity: mark as cancelled instead of deleting?
            // Or use batchUpdate to delete row
            await updateCampaignStatus(sentAt, 'cancelled');
            res.json({ success: true });
        } else {
            res.status(404).json({ error: '予約が見つかりません' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Image Upload
app.post('/api/upload', requireAuth, upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'ファイルがありません' });
    try {
        const fileId = await uploadToDrive(req.file.path, req.file.mimetype);
        fs.unlinkSync(req.file.path); // Delete local file

        if (fileId) {
            const publicUrl = `/api/proxy-image/${fileId}`;
            res.json({ success: true, url: publicUrl, driveId: fileId });
        } else {
            res.status(500).json({ error: 'Driveへのアップロードに失敗しました' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Image Proxy (for LINE delivery)
app.get('/api/proxy-image/:fileId', async (req, res) => {
    if (!drive) return res.status(503).send('Drive service unavailable');
    try {
        const response = await drive.files.get({ fileId: req.params.fileId, alt: 'media' }, { responseType: 'stream' });
        res.set('Content-Type', response.headers['content-type']);
        response.data.pipe(res);
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(404).send('Image not found');
    }
});

// Webhook
app.post('/webhook', line.middleware({ channelSecret: lineConfig.channelSecret }), (req, res) => {
    Promise.all(req.body.events.map(handleLineEvent))
        .then((result) => res.json(result))
        .catch((err) => {
            console.error(err);
            res.status(500).end();
        });
});

async function handleLineEvent(event) {
    if (event.type === 'follow') {
        const userId = event.source.userId;
        try {
            const profile = await lineClient.getProfile(userId);
            const existingUsers = await getSheetData('users');
            if (!existingUsers.find(u => u.userId === userId)) {
                await appendToSheet('users', [userId, profile.displayName, '', new Date().toISOString()]);
            }
            await lineClient.replyMessage({
                replyToken: event.replyToken,
                messages: [createCategorySelectionMessage()]
            });
        } catch (error) {
            console.error('Follow error:', error);
        }
    } else if (event.type === 'message' && event.message.type === 'text') {
        const userId = event.source.userId;
        const text = event.message.text.trim();
        if (['1', '2', '3', '4'].includes(text)) {
            await updateUserCategory(userId, text);
            await lineClient.replyMessage({
                replyToken: event.replyToken,
                messages: [{ type: 'text', text: `「${CATEGORIES[text].name}」に登録しました！` }]
            });
        }
    }
    return null;
}

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
                    { type: 'text', text: '友だち追加ありがとうございます！', weight: 'bold', size: 'md' },
                    { type: 'text', text: 'ご希望のカテゴリ番号(1-4)を送信してください。', size: 'sm', margin: 'md' },
                    { type: 'separator', margin: 'lg' },
                    ...Object.entries(CATEGORIES).map(([id, cat]) => ({
                        type: 'text', text: `${id}️⃣ ${cat.name}`, margin: 'md'
                    }))
                ]
            }
        }
    };
}

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
                { type: 'text', text: title, weight: 'bold', size: 'md', wrap: true },
                { type: 'text', text: description, size: 'xs', color: '#666666', margin: 'md', wrap: true, maxLines: 100 }
            ]
        },
        footer: {
            type: 'box',
            layout: 'vertical',
            spacing: 'sm',
            contents: []
        }
    };

    if (detailLink) {
        contents.footer.contents.push({
            type: 'button',
            style: 'secondary',
            action: { type: 'uri', label: '詳細を見る', uri: detailLink }
        });
    }

    if (applyLink) {
        contents.footer.contents.push({
            type: 'button',
            style: 'primary',
            color: '#06C755',
            action: { type: 'uri', label: '申し込む', uri: applyLink }
        });
    }

    if (!contents.hero) delete contents.hero;
    if (contents.footer.contents.length === 0) delete contents.footer;

    return {
        type: 'flex',
        altText: title,
        contents
    };
}

async function updateUserCategory(userId, category) {
    if (!sheets) return;
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
            range: 'users!A:D'
        });
        const rows = response.data.values || [];
        const index = rows.findIndex(r => r[0] === userId);
        if (index > -1) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: `users!C${index + 1}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[CATEGORIES[category].name]] }
            });
        }
    } catch (error) {
        console.error('Update category error:', error);
    }
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA Fallback: Serve index.html for unknown routes (Production)
app.get('{*path}', (req, res) => {
    const indexPath = path.resolve(__dirname, '../frontend/dist/index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Not Found');
    }
});

async function updateCampaignStatus(sentAt, newStatus) {
    if (!sheets) return;
    try {
        const campaigns = await getSheetData('campaigns');
        const index = campaigns.findIndex(c => c.sentAt === sentAt);
        if (index > -1) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
                range: `campaigns!E${index + 2}`,
                valueInputOption: 'USER_ENTERED',
                resource: { values: [[newStatus]] }
            });
        }
    } catch (error) {
        console.error('Update status error:', error);
    }
}

// Scheduler Loop
setInterval(async () => {
    try {
        const campaigns = await getSheetData('campaigns');
        const now = new Date();
        const scheduled = campaigns.filter(c => c.status === 'scheduled');

        for (const campaign of scheduled) {
            if (new Date(campaign.sentAt) <= now) {
                console.log(`🚀 Executing scheduled campaign: ${campaign.title}`);
                const users = await getSheetData('users');
                const tags = campaign.target ? campaign.target.split(',') : [];
                const targetUsers = (campaign.target === '全員')
                    ? users
                    : users.filter(u => tags.includes(u.category) || u.category === '4');

                const userIds = targetUsers.map(u => u.userId).filter(id => id);
                if (userIds.length > 0) {
                    const flex = createRichMessage(campaign.title, campaign.description, campaign.imageUrl, campaign.detailLink, campaign.applyLink);
                    await lineClient.multicast({ messages: [flex], to: userIds });
                }
                await updateCampaignStatus(campaign.sentAt, 'sent');
            }
        }
    } catch (error) {
        console.error('Scheduler loop error:', error);
    }
}, 60000);

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
    console.log(`🚀 v2 Backend running on port ${PORT}`);
    await initGoogleServices();
});

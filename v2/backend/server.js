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
        if (rows.length <= 1) return [];

        const headers = rows[0];
        return rows.slice(1).map(row => {
            const obj = {};
            headers.forEach((header, i) => obj[header] = row[i] || '');
            return obj;
        });
    } catch (error) {
        console.error(`getSheetData error (${sheetName}):`, error.message);
        return [];
    }
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
    const users = await getSheetData('users');
    const categoryStats = {};
    Object.values(CATEGORIES).forEach(c => categoryStats[c.name] = users.filter(u => u.category === c.name).length);

    res.json({
        totalFriends: users.length,
        registeredUsers: users.filter(u => u.category).length,
        categoryStats,
        monthlyDeliveries: 0 // Placeholder
    });
});

// Users
app.get('/api/users', requireAuth, async (req, res) => {
    const users = await getSheetData('users');
    res.json(users);
});

// Campaigns
app.get('/api/campaigns', requireAuth, async (req, res) => {
    const campaigns = await getSheetData('campaigns');
    res.json(campaigns);
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
    // Logic for follow/message events...
    return Promise.resolve(null);
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA Fallback: Serve index.html for unknown routes (Production)
app.get('*', (req, res) => {
    const indexPath = path.resolve(__dirname, '../frontend/dist/index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Not Found');
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
    console.log(`🚀 v2 Backend running on port ${PORT}`);
    await initGoogleServices();
});

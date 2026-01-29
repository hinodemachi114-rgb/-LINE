const { google } = require('googleapis');
const path = require('path');
require('dotenv').config();

async function debugDrafts() {
    const auth = new google.auth.GoogleAuth({
        keyFile: path.join(__dirname, 'credentials.json'),
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'drafts!A1:M10',
        });

        console.log('--- Drafts Sheet (A1:M10) ---');
        const rows = response.data.values || [];
        rows.forEach((row, i) => {
            console.log(`Row ${i + 1}:`, JSON.stringify(row));
        });

        if (rows.length > 0) {
            const row = rows[0];
            const keywords = ['email', 'メール', 'id', 'タイトル', 'title', '名前', 'name', '氏名', 'status', '状態', 'ステータス', '権限', 'role', 'タグ', '構成', '作成日', '更新日'];
            const matchCount = row.slice(0, 8).filter(cell => {
                const c = String(cell).toLowerCase();
                return keywords.some(k => c.includes(k));
            }).length;
            console.log(`\nRow 1 Header Match Count: ${matchCount}`);
        }

    } catch (error) {
        console.error('Debug error:', error.message);
    }
}

debugDrafts();

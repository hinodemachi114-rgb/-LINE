require('dotenv').config();
const { google } = require('googleapis');

async function debugAdmins() {
    console.log('🔍 スプレッドシートの認証情報を確認中...');

    let auth;
    try {
        auth = new google.auth.GoogleAuth({
            keyFile: 'credentials.json',
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
    } catch (e) {
        console.error('❌ credentials.json が見つからないか、読み込めません。');
        return;
    }

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;

    if (!spreadsheetId) {
        console.error('❌ .env に GOOGLE_SPREADSHEET_ID が設定されていません。');
        return;
    }

    try {
        console.log(`📊 シート "admins" からデータを取得中... (ID: ${spreadsheetId})`);

        // ヘッダー確認
        const headerRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'admins!A1:Z1',
        });
        const headers = headerRes.data.values ? headerRes.data.values[0] : [];
        console.log('📋 見つかった見出し:', headers);

        // データ確認
        const dataRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: 'admins!A:Z',
        });
        const rows = dataRes.data.values || [];
        console.log(`📑 取得した全行数: ${rows.length}行`);

        if (rows.length < 2) {
            console.warn('⚠️ データが2行目以降に見当たりません。');
        }

        // サーバーと同じマッピングロジックでテスト
        const headerLower = headers.map(h => String(h).trim().toLowerCase());
        const findCol = (patterns) => {
            return headerLower.findIndex(h => patterns.some(p => h.includes(p.toLowerCase())));
        };

        const cols = {
            email: findCol(['email', 'メール', 'アドレス']),
            name: findCol(['name', '氏名', '名前']),
            role: findCol(['role', '権限', 'ロール']),
            password: findCol(['password', 'pass', 'パスワード', 'パス']),
            status: findCol(['status', 'ステータス', '状態', '有効'])
        };

        console.log('🎯 解析された列番号 (0から開始):', cols);

        const admins = rows.slice(1).map((row, i) => {
            const getCol = (row, idx, fallback) => (idx !== -1 && row[idx]) ? row[idx] : (row[fallback] || '❌ なし');
            return {
                row: i + 2,
                email: getCol(row, cols.email, 0),
                name: getCol(row, cols.name, 1),
                passwordShort: getCol(row, cols.password, 3).substring(0, 10) + '...',
                status: getCol(row, cols.status, 4)
            };
        });

        console.log('\n👥 解析された管理者データ:');
        console.table(admins);

    } catch (error) {
        console.error('❌ エラーが発生しました:', error.message);
        if (error.message.includes('not found')) {
            console.error('👉 "admins" という名前のシートが存在するか確認してください。');
        }
    }
}

debugAdmins();

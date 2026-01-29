
const crypto = require('crypto');

// 1. Password Hashing Logic Test
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

function verifyPassword(password, storedValue) {
    if (!storedValue) return false;
    
    // Support legacy SHA-256 for transition if needed (but currently we expect scrypt)
    if (!storedValue.includes(':')) {
        const hash = crypto.createHash('sha256').update(password).digest('hex');
        return hash === storedValue;
    }

    const [salt, hash] = storedValue.split(':');
    const candidateHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(candidateHash, 'hex'));
}

console.log('--- Testing Password Hashing ---');
const pass = 'password123';
const hashed = hashPassword(pass);
console.log('Hashed:', hashed);
console.log('Verify same password:', verifyPassword(pass, hashed));
console.log('Verify wrong password:', verifyPassword('wrong', hashed));
console.log('Verify legacy SHA-256:', verifyPassword('legacy', crypto.createHash('sha256').update('legacy').digest('hex')));

// 2. HTML Escaping Test
function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

console.log('\n--- Testing HTML Escaping ---');
const unsafe = '<script>alert("xss")</script> & "quotes"';
const safe = escapeHTML(unsafe);
console.log('Unsafe:', unsafe);
console.log('Safe:', safe);
if (safe === '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &quot;quotes&quot;') {
    console.log('✅ HTML Escaping Works');
} else {
    console.log('❌ HTML Escaping Failed');
}

// 3. URL Sanitization Test
function isSafeUrl(url) {
    if (!url) return true;
    const lowerUrl = url.toLowerCase().trim();
    if (lowerUrl.startsWith('javascript:')) return false;
    if (lowerUrl.includes('<') || lowerUrl.includes('>') || lowerUrl.includes('"') || lowerUrl.includes("'")) return false;
    return true;
}

console.log('\n--- Testing URL Sanitization ---');
const urls = [
    { url: 'https://example.com/image.jpg', safe: true },
    { url: 'javascript:alert(1)', safe: false },
    { url: 'https://example.com/image.jpg" onmouseover="alert(1)', safe: false },
    { url: '  JAVASCRIPT:alert(1)', safe: false }
];

urls.forEach(test => {
    const result = isSafeUrl(test.url);
    console.log(`URL: ${test.url} -> ${result === test.safe ? '✅' : '❌'}`);
});

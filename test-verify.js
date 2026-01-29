const crypto = require('crypto');

const password = 'test1234';
const storedValue = '4f969d5974c15f0e3567049f8ffe2989:0edb95825b4e24596786979490564b4bb00757038e1c51e7605cee57ac8503a1d751e55a5b015602b459caab03be3a3e5089294bdfa548d547e7c0b12827fb3b';

const HASH_CONFIG = {
    keylen: 64,
    saltLen: 16
};

function verifyPassword(password, storedValue) {
    if (!storedValue || !storedValue.includes(':')) {
        return false;
    }
    const [salt, hash] = storedValue.split(':');
    try {
        const targetHash = crypto.scryptSync(password, salt, HASH_CONFIG.keylen).toString('hex');
        console.log('Target Hash:', targetHash);
        console.log('Stored Hash:', hash);
        return hash === targetHash;
    } catch (e) {
        return false;
    }
}

console.log('Result:', verifyPassword(password, storedValue));

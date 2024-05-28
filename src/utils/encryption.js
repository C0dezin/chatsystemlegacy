const crypto = require('crypto-js');

function encryptMessage(message, key) {
    return crypto.AES.encrypt(message, key).toString();
}

function decryptMessage(encryptedMessage, key) {
    try {
        const bytes = crypto.AES.decrypt(encryptedMessage, key);
        return bytes.toString(crypto.enc.Utf8);
    } catch (e) {
        return null;
    }
}

module.exports = { encryptMessage, decryptMessage };

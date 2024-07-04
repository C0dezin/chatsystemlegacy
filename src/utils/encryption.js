const crypto = require('crypto');

// Function to derive a key from a password using PBKDF2
function deriveKeyFromPassword(password, salt, keyLength) {
    return crypto.pbkdf2Sync(password, salt, 100000, keyLength, 'sha256');
}

function encryptMessage(message, password) {
    const algorithm = 'aes-256-cbc';
    const salt = crypto.randomBytes(16); // Generate a random salt
    const key = deriveKeyFromPassword(password, salt, 32); // Derive key from password
    const iv = crypto.randomBytes(16); // Initialization vector

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(message, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return `${salt.toString('hex')}:${iv.toString('hex')}:${encrypted}`;
}

function decryptMessage(encryptedMessage, password) {
    const algorithm = 'aes-256-cbc';
    const [saltString, ivString, encryptedData] = encryptedMessage.split(':');
    const salt = Buffer.from(saltString, 'hex');
    const iv = Buffer.from(ivString, 'hex');
    const key = deriveKeyFromPassword(password, salt, 32); // Derive key from password

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'), 'binary', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}

module.exports = { encryptMessage, decryptMessage };

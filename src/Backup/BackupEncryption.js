/**
 * BackupEncryption
 *
 * AES-256-GCM encryption/decryption for backup files.
 * Uses only Node.js built-in `crypto` – zero external dependencies.
 *
 * Grain de sable (salt) concept:
 *   A random alphanumeric salt of 4–6 characters is generated for every
 *   encryption operation.  The salt is stored in plain text inside the
 *   encrypted file header so that decryption can always reconstruct the
 *   exact key that was used without storing the salt separately.
 *
 * Encrypted file format (UTF-8 text):
 *   Line 1 : OUTLET_ENC_V1          – magic / version marker
 *   Line 2 : <salt>                 – 4–6 alphanumeric chars (grain de sable)
 *   Line 3 : <iv_hex>               – 24-char hex (12-byte IV for GCM)
 *   Line 4 : <authTag_hex>          – 32-char hex (16-byte GCM auth tag)
 *   Line 5 : <ciphertext_base64>    – base64-encoded encrypted content
 *
 * Key derivation: scryptSync(password, salt, 32)
 *   N=16384, r=8, p=1 (scrypt defaults – safe for interactive use)
 */

'use strict';

const crypto = require('crypto');

// ─── Constants ────────────────────────────────────────────────────────────────
const MAGIC = 'OUTLET_ENC_V1';
const IV_LENGTH = 12;          // bytes – GCM recommended
const SALT_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a random alphanumeric salt (grain de sable).
 * @param {number} length  4 to 6 (inclusive)
 * @returns {string}
 */
function generateSalt(length = 6) {
  if (length < 4 || length > 6) {
    throw new RangeError(`BackupEncryption: saltLength must be between 4 and 6 (got ${length})`);
  }
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes)
    .map((b) => SALT_CHARS[b % SALT_CHARS.length])
    .join('');
}

/**
 * Derive a 256-bit key from a password and a salt using scrypt.
 * @param {string} password
 * @param {string} salt
 * @returns {Buffer}
 */
function deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Encrypt a string payload (backup content).
 *
 * @param {string} plaintext      The content to encrypt (SQL / JSON string)
 * @param {string} password       User-supplied encryption password
 * @param {number} [saltLength=6] Grain de sable length (4–6 characters)
 * @returns {{ encryptedContent: string, salt: string }}
 *   `encryptedContent` is the full file payload ready to write to disk.
 *   `salt` is exposed so callers can log / audit the grain de sable used.
 */
function encrypt(plaintext, password, saltLength = 6) {
  if (!password || typeof password !== 'string') {
    throw new TypeError('BackupEncryption.encrypt: password must be a non-empty string');
  }

  const salt = generateSalt(saltLength);
  const key  = deriveKey(password, salt);
  const iv   = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  const encryptedContent = [
    MAGIC,
    salt,
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('base64')
  ].join('\n');

  return { encryptedContent, salt };
}

/**
 * Decrypt a previously encrypted backup payload.
 *
 * @param {string} encryptedContent  The raw file content (as written by encrypt())
 * @param {string} password          The same password used during encryption
 * @returns {string}  The original plaintext
 * @throws  If the format is invalid, the password is wrong, or the auth tag fails
 */
function decrypt(encryptedContent, password) {
  if (!password || typeof password !== 'string') {
    throw new TypeError('BackupEncryption.decrypt: password must be a non-empty string');
  }

  const lines = encryptedContent.split('\n');

  if (lines.length < 5 || lines[0] !== MAGIC) {
    throw new Error('BackupEncryption.decrypt: invalid or unrecognised encrypted backup format');
  }

  const [, salt, ivHex, tagHex, ciphertextB64] = lines;

  // Validate salt length (defensive)
  if (salt.length < 4 || salt.length > 6) {
    throw new Error(`BackupEncryption.decrypt: unexpected salt length (${salt.length})`);
  }

  const key        = deriveKey(password, salt);
  const iv         = Buffer.from(ivHex, 'hex');
  const authTag    = Buffer.from(tagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch (_) {
    throw new Error('BackupEncryption.decrypt: authentication failed – wrong password or corrupted data');
  }
}

/**
 * Return true if the content looks like an outlet-orm encrypted backup.
 * @param {string} content
 * @returns {boolean}
 */
function isEncrypted(content) {
  return typeof content === 'string' && content.startsWith(MAGIC + '\n');
}

module.exports = { encrypt, decrypt, isEncrypted, generateSalt };

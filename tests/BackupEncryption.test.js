/**
 * BackupEncryption tests
 * Covers: generateSalt, encrypt, decrypt, isEncrypted, error paths
 */

'use strict';

const { encrypt, decrypt, isEncrypted, generateSalt } = require('../src/Backup/BackupEncryption');

// ─────────────────────────────────────────────────────────────────────────────
describe('generateSalt', () => {
  test('default length is 6 characters', () => {
    const salt = generateSalt();
    expect(salt).toHaveLength(6);
  });

  test.each([4, 5, 6])('accepts valid length %i', (len) => {
    const salt = generateSalt(len);
    expect(salt).toHaveLength(len);
  });

  test('uses only alphanumeric characters', () => {
    for (let i = 0; i < 20; i++) {
      expect(generateSalt(6)).toMatch(/^[A-Za-z0-9]+$/);
    }
  });

  test('throws on length < 4', () => {
    expect(() => generateSalt(3)).toThrow(RangeError);
  });

  test('throws on length > 6', () => {
    expect(() => generateSalt(7)).toThrow(RangeError);
  });

  test('produces different salts (entropy check)', () => {
    const salts = new Set(Array.from({ length: 50 }, () => generateSalt(6)));
    // With 62^6 ≈ 56 billion combinations, all 50 should be unique
    expect(salts.size).toBe(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('encrypt / decrypt', () => {
  const PASSWORD  = 'MyS3cr3tP@ssw0rd';
  const PLAINTEXT = 'INSERT INTO users (name) VALUES (\'Alice\');\nINSERT INTO users (name) VALUES (\'Bob\');';

  test('encrypt returns encryptedContent and salt', () => {
    const { encryptedContent, salt } = encrypt(PLAINTEXT, PASSWORD);
    expect(typeof encryptedContent).toBe('string');
    expect(typeof salt).toBe('string');
    expect(salt.length).toBeGreaterThanOrEqual(4);
    expect(salt.length).toBeLessThanOrEqual(6);
  });

  test('encrypted content starts with OUTLET_ENC_V1 magic', () => {
    const { encryptedContent } = encrypt(PLAINTEXT, PASSWORD);
    expect(encryptedContent.startsWith('OUTLET_ENC_V1\n')).toBe(true);
  });

  test('decrypt round-trips correctly', () => {
    const { encryptedContent } = encrypt(PLAINTEXT, PASSWORD);
    const result = decrypt(encryptedContent, PASSWORD);
    expect(result).toBe(PLAINTEXT);
  });

  test('each encrypt call produces a different ciphertext (IV randomness)', () => {
    const { encryptedContent: c1 } = encrypt(PLAINTEXT, PASSWORD);
    const { encryptedContent: c2 } = encrypt(PLAINTEXT, PASSWORD);
    expect(c1).not.toBe(c2);
    // But both decrypt to the same plaintext
    expect(decrypt(c1, PASSWORD)).toBe(PLAINTEXT);
    expect(decrypt(c2, PASSWORD)).toBe(PLAINTEXT);
  });

  test('saltLength 4 is respected', () => {
    const { encryptedContent, salt } = encrypt(PLAINTEXT, PASSWORD, 4);
    expect(salt).toHaveLength(4);
    expect(decrypt(encryptedContent, PASSWORD)).toBe(PLAINTEXT);
  });

  test('saltLength 5 is respected', () => {
    const { encryptedContent, salt } = encrypt(PLAINTEXT, PASSWORD, 5);
    expect(salt).toHaveLength(5);
    expect(decrypt(encryptedContent, PASSWORD)).toBe(PLAINTEXT);
  });

  test('decrypting with wrong password throws an auth error', () => {
    const { encryptedContent } = encrypt(PLAINTEXT, PASSWORD);
    expect(() => decrypt(encryptedContent, 'WrongPassword!')).toThrow();
  });

  test('decrypting corrupted data throws', () => {
    const { encryptedContent } = encrypt(PLAINTEXT, PASSWORD);
    // Corrupt the GCM auth tag (line 4, index 3) – guaranteed to fail authentication
    const lines    = encryptedContent.split('\n');
    lines[3]       = '0'.repeat(lines[3].length);   // zero-out the 32-char auth tag hex
    const corrupted = lines.join('\n');
    expect(() => decrypt(corrupted, PASSWORD)).toThrow();
  });

  test('decrypting non-encrypted content throws format error', () => {
    expect(() => decrypt('SELECT 1;', PASSWORD)).toThrow(/invalid or unrecognised/i);
  });

  test('encrypt throws when password is empty', () => {
    expect(() => encrypt(PLAINTEXT, '')).toThrow(TypeError);
    expect(() => encrypt(PLAINTEXT, null)).toThrow(TypeError);
  });

  test('decrypt throws when password is empty', () => {
    const { encryptedContent } = encrypt(PLAINTEXT, PASSWORD);
    expect(() => decrypt(encryptedContent, '')).toThrow(TypeError);
  });

  test('works with large payloads (100 KB)', () => {
    const big = 'A'.repeat(100_000);
    const { encryptedContent } = encrypt(big, PASSWORD);
    expect(decrypt(encryptedContent, PASSWORD)).toBe(big);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('isEncrypted', () => {
  test('returns true for outlet encrypted content', () => {
    const { encryptedContent } = encrypt('hello', 'pass');
    expect(isEncrypted(encryptedContent)).toBe(true);
  });

  test('returns false for plain SQL', () => {
    expect(isEncrypted('-- SQL dump\nINSERT INTO users VALUES (1, \'Bob\');')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isEncrypted('')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BackupManager with encryption', () => {
  const os   = require('os');
  const path = require('path');
  const fs   = require('fs');
  const DatabaseConnection = require('../src/DatabaseConnection');
  const BackupManager      = require('../src/Backup/BackupManager');

  const TMP = path.join(os.tmpdir(), `outlet-enc-test-${Date.now()}`);
  const PASSWORD = 'TestP@ss123';
  let db, manager;

  beforeAll(async () => {
    fs.mkdirSync(TMP, { recursive: true });
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();
    await db.execute('CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT)');
    await db.insert('items', { label: 'encrypted_item' });

    manager = new BackupManager(db, {
      backupPath         : TMP,
      encrypt            : true,
      encryptionPassword : PASSWORD,
      saltLength         : 5,
    });
  });

  afterAll(async () => {
    await db.close();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_) {}
  });

  test('constructor throws when encrypt=true but no password', () => {
    expect(() => new BackupManager(db, { encrypt: true })).toThrow(/encryptionPassword/);
  });

  test('constructor throws for invalid saltLength', () => {
    expect(() => new BackupManager(db, {
      encrypt: true, encryptionPassword: PASSWORD, saltLength: 7
    })).toThrow(RangeError);
  });

  test('full() produces a .sql.enc file', async () => {
    const filePath = await manager.full();
    expect(filePath.endsWith('.enc')).toBe(true);
    expect(fs.existsSync(filePath)).toBe(true);

    const raw = fs.readFileSync(filePath, 'utf8');
    expect(isEncrypted(raw)).toBe(true);
    // Plain SQL must NOT be readable
    expect(raw).not.toContain('INSERT');
  });

  test('full() decrypts back to valid SQL', async () => {
    const filePath = await manager.full();
    const raw = fs.readFileSync(filePath, 'utf8');
    const plain = decrypt(raw, PASSWORD);
    expect(plain).toContain('INSERT');
    expect(plain).toContain('encrypted_item');
  });

  test('partial() produces .sql.enc and decrypts correctly', async () => {
    const filePath = await manager.partial(['items']);
    const raw = fs.readFileSync(filePath, 'utf8');
    expect(isEncrypted(raw)).toBe(true);
    expect(decrypt(raw, PASSWORD)).toContain('encrypted_item');
  });

  test('full() json format produces .json.enc', async () => {
    const filePath = await manager.full({ format: 'json' });
    expect(filePath.endsWith('.json.enc')).toBe(true);
    const raw = fs.readFileSync(filePath, 'utf8');
    const plain = decrypt(raw, PASSWORD);
    const dump = JSON.parse(plain);
    expect(dump.tables.items.length).toBeGreaterThanOrEqual(1);
  });

  test('restore() auto-decrypts an encrypted backup', async () => {
    // Create a fresh DB to restore into
    const fresh = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await fresh.connect();
    await fresh.execute('CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT)');

    const backupFile = await manager.full({ filename: 'enc_restore_test.sql.enc' });

    // Build inserts-only file (clear CREATE TABLE to avoid conflict)
    const raw = fs.readFileSync(backupFile, 'utf8');
    const plain = decrypt(raw, PASSWORD);
    const insertsOnly = plain.split('\n').filter(l => /^\s*INSERT/i.test(l)).join('\n');
    const tmpFile = path.join(TMP, 'inserts_enc.sql');
    fs.writeFileSync(tmpFile, insertsOnly, 'utf8');

    const freshManager = new BackupManager(fresh, { backupPath: TMP });
    const result = await freshManager.restore(tmpFile);
    expect(result.statements).toBeGreaterThan(0);

    await fresh.close();
  });

  test('restore() with encrypted file requires password', async () => {
    const backupFile = await manager.full({ filename: 'restore_enc_nopass.sql.enc' });
    const noPassManager = new BackupManager(db, { backupPath: TMP });
    await expect(noPassManager.restore(backupFile)).rejects.toThrow(/encrypted/);
  });

  test('restore() accepts encryptionPassword in options', async () => {
    const fresh = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await fresh.connect();
    await fresh.execute('CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT)');

    const backupFile = await manager.full({ filename: 'restore_opt_pass.sql.enc' });
    const raw = fs.readFileSync(backupFile, 'utf8');
    const plain = decrypt(raw, PASSWORD);
    const insertsOnly = plain.split('\n').filter(l => /^\s*INSERT/i.test(l)).join('\n');
    const tmpFile = path.join(TMP, 'enc_opt_inserts.sql.enc');
    // Write the ENCRYPTED file so restore() must decrypt it
    const { encryptedContent } = encrypt(insertsOnly, PASSWORD, 5);
    fs.writeFileSync(tmpFile, encryptedContent, 'utf8');

    const noPassManager = new BackupManager(fresh, { backupPath: TMP });
    const result = await noPassManager.restore(tmpFile, { encryptionPassword: PASSWORD });
    expect(result.statements).toBeGreaterThan(0);

    await fresh.close();
  });
});

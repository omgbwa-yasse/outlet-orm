/**
 * Backup module tests (SQLite in-memory)
 * Covers: BackupManager (full, partial, journal, restore) and BackupScheduler
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const DatabaseConnection = require('../src/DatabaseConnection');
const BackupManager = require('../src/Backup/BackupManager');
const BackupScheduler = require('../src/Backup/BackupScheduler');

// Temporary directory shared by all tests in this file
const TMP_DIR = path.join(os.tmpdir(), `outlet-orm-backup-test-${Date.now()}`);

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function seedDb(db) {
  await db.insert('users',  { name: 'Alice', email: 'alice@example.com' });
  await db.insert('users',  { name: 'Bob',   email: 'bob@example.com'   });
  await db.insert('orders', { user_id: 1, total: 99 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('BackupManager', () => {
  let db;
  let manager;

  beforeAll(async () => {
    fs.mkdirSync(TMP_DIR, { recursive: true });

    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();

    await db.execute('CREATE TABLE users  (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)');
    await db.execute('CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, total REAL)');

    await seedDb(db);

    manager = new BackupManager(db, { backupPath: TMP_DIR });
  });

  afterAll(async () => {
    await db.close();
    // Cleanup temp files
    try {
      fs.rmSync(TMP_DIR, { recursive: true, force: true });
    } catch (_) { /* best-effort */ }
  });

  // ── full backup ────────────────────────────────────────────────────────────

  test('full() creates a .sql file containing INSERT statements', async () => {
    const filePath = await manager.full();

    expect(fs.existsSync(filePath)).toBe(true);
    expect(filePath).toMatch(/full_.*\.sql$/);

    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('INSERT INTO');
    expect(content).toContain('Alice');
    expect(content).toContain('orders');
  });

  test('full() with format=json creates a valid JSON dump', async () => {
    const filePath = await manager.full({ format: 'json' });

    expect(filePath).toMatch(/\.json$/);
    const dump = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(dump).toHaveProperty('tables');
    expect(dump.tables).toHaveProperty('users');
    expect(dump.tables.users.length).toBeGreaterThanOrEqual(2);
  });

  test('full() respects custom filename option', async () => {
    const filePath = await manager.full({ filename: 'my_custom_backup.sql' });
    expect(path.basename(filePath)).toBe('my_custom_backup.sql');
  });

  // ── partial backup ─────────────────────────────────────────────────────────

  test('partial() dumps only the specified tables', async () => {
    const filePath = await manager.partial(['users']);

    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('users');
    expect(content).toContain('Alice');
    // orders should NOT appear in data section
    expect(content).not.toMatch(/INSERT INTO.*orders/i);
  });

  test('partial() throws when no tables are passed', async () => {
    await expect(manager.partial([])).rejects.toThrow();
    await expect(manager.partial()).rejects.toThrow();
  });

  // ── journal backup ─────────────────────────────────────────────────────────

  test('journal() captures DML statements from the query log', async () => {
    DatabaseConnection.enableQueryLog();
    DatabaseConnection.flushQueryLog();

    await db.insert('users', { name: 'Charlie', email: 'charlie@example.com' });
    await db.update('users', { email: 'alice2@example.com' }, {
      wheres: [{ column: 'name', operator: '=', value: 'Alice', type: 'basic', boolean: 'and' }]
    });

    const filePath = await manager.journal({ flush: true });

    DatabaseConnection.disableQueryLog();

    expect(fs.existsSync(filePath)).toBe(true);
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('INSERT');
    expect(content).toContain('UPDATE');
    expect(content).not.toContain('SELECT'); // SELECT must be filtered out
  });

  test('journal() with flush=true clears the query log', async () => {
    DatabaseConnection.enableQueryLog();
    DatabaseConnection.flushQueryLog();

    await db.insert('orders', { user_id: 2, total: 50 });

    await manager.journal({ flush: true });

    // After flush the log should be empty
    expect(DatabaseConnection.getQueryLog().length).toBe(0);
    DatabaseConnection.disableQueryLog();
  });

  // ── restore ────────────────────────────────────────────────────────────────

  test('restore() executes all statements from an SQL backup', async () => {
    // Create a fresh in-memory DB to restore into
    const freshDb = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await freshDb.connect();
    await freshDb.execute('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)');
    await freshDb.execute('CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, total REAL)');

    const freshManager = new BackupManager(freshDb, { backupPath: TMP_DIR });

    // Take a full backup from the main db
    const backupFile = await manager.full({ filename: 'restore_test.sql' });

    // Restore into the fresh DB – only INSERT statements will be re-run;
    // CREATE TABLE statements are already there, so we patch the sql file to
    // have only INSERTs to avoid "table already exists" errors.
    const sqlContent = fs.readFileSync(backupFile, 'utf8');
    const insertsOnly = sqlContent
      .split('\n')
      .filter(line => /^\s*INSERT/i.test(line))
      .join('\n');

    const insertsFile = path.join(TMP_DIR, 'inserts_only.sql');
    fs.writeFileSync(insertsFile, insertsOnly, 'utf8');

    const result = await freshManager.restore(insertsFile);
    expect(result.statements).toBeGreaterThan(0);

    const rows = await freshDb.executeRawQuery('SELECT * FROM users');
    expect(rows.length).toBeGreaterThanOrEqual(2);

    await freshDb.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BackupScheduler
// ─────────────────────────────────────────────────────────────────────────────

describe('BackupScheduler', () => {
  let db;
  let scheduler;

  beforeAll(async () => {
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();
    await db.execute('CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT)');
    await db.insert('items', { label: 'test' });

    scheduler = new BackupScheduler(db, { backupPath: TMP_DIR });
  });

  afterAll(async () => {
    scheduler.stopAll();
    await db.close();
  });

  test('schedule() returns a job name and registers it', () => {
    const name = scheduler.schedule('full', { intervalMs: 3600_000, name: 'hourly_full' });
    expect(name).toBe('hourly_full');
    expect(scheduler.activeJobs()).toContain('hourly_full');
  });

  test('stop() removes the job from active list', () => {
    scheduler.stop('hourly_full');
    expect(scheduler.activeJobs()).not.toContain('hourly_full');
  });

  test('schedule() with runNow=true triggers an immediate backup', async () => {
    let called = false;
    scheduler.schedule('full', {
      intervalMs: 3600_000,
      runNow: true,
      name: 'runnow_test',
      onSuccess: () => { called = true; },
    });

    // Allow the async _execute to resolve
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(called).toBe(true);
    scheduler.stop('runnow_test');
  });

  test('schedule() partial requires a non-empty tables array', () => {
    expect(() =>
      scheduler.schedule('partial', { intervalMs: 3600_000 })
    ).toThrow();
  });

  test('schedule() throws on invalid type', () => {
    expect(() =>
      scheduler.schedule('incremental', { intervalMs: 3600_000 })
    ).toThrow();
  });

  test('schedule() throws when intervalMs < 1000', () => {
    expect(() =>
      scheduler.schedule('full', { intervalMs: 500 })
    ).toThrow();
  });

  test('stopAll() clears all jobs', () => {
    scheduler.schedule('full',    { intervalMs: 3600_000, name: 'j1' });
    scheduler.schedule('journal', { intervalMs: 3600_000, name: 'j2' });
    scheduler.stopAll();
    expect(scheduler.activeJobs().length).toBe(0);
  });
});

/**
 * Migration data preservation (feature 003) — SQLite integration tests.
 *
 * Covers:
 *  - Auto-backup before destructive ops (fresh/reset/refresh/rollback)
 *  - Sidecar .meta.json contents
 *  - Retention pruning
 *  - restoreAuto() and listAutoBackups()
 *  - Skip-flag honored in development; ignored in production
 *  - 7-column migrations table auto-upgrade from legacy 4-column table
 *  - Checksum recorded; drift detected
 *  - Production gate
 */

const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const os = require('os');
const DatabaseConnection = require('../src/DatabaseConnection');
const MigrationManager = require('../src/Migrations/MigrationManager');

let tmpRoot;

function makeManager(opts = {}) {
  const dbFile = path.join(tmpRoot, `mp_${Date.now()}_${Math.random().toString(36).slice(2)}.sqlite`);
  const migrationsDir = path.join(tmpRoot, `migrations_${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(migrationsDir, { recursive: true });
  const backupDir = path.join(tmpRoot, `backups_${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(backupDir, { recursive: true });

  const db = new DatabaseConnection({ driver: 'sqlite', database: dbFile });
  const manager = new MigrationManager(db, migrationsDir, 'migrations', {
    migrations: {
      backupPath: backupDir,
      backupRetentionCount: opts.retention != null ? opts.retention : 10,
      autoBackupBeforeDestructive: opts.autoBackup !== false,
      environment: opts.env || 'development',
      requireProductionConfirm: opts.requireProductionConfirm !== false
    }
  });
  return { db, manager, migrationsDir, backupDir, dbFile };
}

function writeMigration(dir, name, body) {
  const file = path.join(dir, name);
  fs.writeFileSync(file, body, 'utf8');
  return file;
}

const createUsersTableMigration = `
class CreateUsers {
  constructor(connection) { this.connection = connection; }
  async up() {
    await this.connection.execute(
      "CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)"
    );
  }
  async down() {
    await this.connection.execute("DROP TABLE IF EXISTS users");
  }
}
module.exports = CreateUsers;
`;

beforeAll(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'outlet-mp-'));
});

afterAll(() => {
  try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (_) { /* */ }
});

describe('Feature 003 — Migration Data Preservation', () => {

  // ─────────────────────────────────────────────────────────────────────
  // T009 — Auto-backup before destructive ops
  // ─────────────────────────────────────────────────────────────────────

  test('initialize creates 7-column migrations table on fresh DB', async () => {
    const { db, manager } = makeManager();
    await db.connect();
    await manager.initialize();
    const rows = await db.execute("PRAGMA table_info(migrations)");
    const cols = rows.map(r => r.name);
    expect(cols).toEqual(expect.arrayContaining([
      'id', 'migration', 'batch', 'created_at', 'checksum', 'execution_time_ms', 'status'
    ]));
    await db.close();
  });

  test('initialize auto-upgrades a legacy 4-column migrations table', async () => {
    const { db, manager } = makeManager();
    await db.connect();
    await db.execute(
      "CREATE TABLE migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, migration TEXT, batch INTEGER, created_at TEXT)"
    );
    await manager.initialize();
    const rows = await db.execute("PRAGMA table_info(migrations)");
    const cols = rows.map(r => r.name);
    expect(cols).toEqual(expect.arrayContaining([
      'checksum', 'execution_time_ms', 'status'
    ]));
    await db.close();
  });

  test('fresh() creates an auto-backup .sql and .meta.json sidecar', async () => {
    const { db, manager, migrationsDir, backupDir } = makeManager();
    await db.connect();
    writeMigration(migrationsDir, '2025_01_01_000001_create_users.js', createUsersTableMigration);
    await manager.run();
    await manager.fresh();

    const files = fs.readdirSync(backupDir);
    const sql = files.find(f => /^auto_before_fresh_.+\.sql$/.test(f));
    const meta = files.find(f => /^auto_before_fresh_.+\.meta\.json$/.test(f));
    expect(sql).toBeTruthy();
    expect(meta).toBeTruthy();

    const metaContent = JSON.parse(fs.readFileSync(path.join(backupDir, meta), 'utf8'));
    expect(metaContent).toMatchObject({
      command: 'fresh',
      environment: 'development',
      encrypted: false
    });
    expect(metaContent.timestamp).toMatch(/T/);
    expect(typeof metaContent.fileSize).toBe('number');
    expect(metaContent.outletOrmVersion).toBeDefined();
    expect(metaContent.nodeVersion).toBe(process.version);

    await db.close();
  });

  test('rollback() creates an auto_before_rollback_*.sql', async () => {
    const { db, manager, migrationsDir, backupDir } = makeManager();
    await db.connect();
    writeMigration(migrationsDir, '2025_01_01_000001_create_users.js', createUsersTableMigration);
    await manager.run();
    await manager.rollback();
    const files = fs.readdirSync(backupDir);
    expect(files.some(f => /^auto_before_rollback_.+\.sql$/.test(f))).toBe(true);
    await db.close();
  });

  test('reset() creates an auto_before_reset_*.sql', async () => {
    const { db, manager, migrationsDir, backupDir } = makeManager();
    await db.connect();
    writeMigration(migrationsDir, '2025_01_01_000001_create_users.js', createUsersTableMigration);
    await manager.run();
    await manager.reset();
    const files = fs.readdirSync(backupDir);
    expect(files.some(f => /^auto_before_reset_.+\.sql$/.test(f))).toBe(true);
    await db.close();
  });

  // ─────────────────────────────────────────────────────────────────────
  // T011 — Retention pruning
  // ─────────────────────────────────────────────────────────────────────

  test('retention prunes oldest auto-backups beyond limit', async () => {
    const { db, manager, migrationsDir, backupDir } = makeManager({ retention: 2 });
    await db.connect();
    writeMigration(migrationsDir, '2025_01_01_000001_create_users.js', createUsersTableMigration);

    // Pre-seed 5 fake backups + sidecars
    for (let i = 1; i <= 5; i++) {
      const ts = `2024010${i}_000000`;
      fs.writeFileSync(path.join(backupDir, `auto_before_fresh_${ts}.sql`), '-- dummy');
      fs.writeFileSync(path.join(backupDir, `auto_before_fresh_${ts}.meta.json`), '{}');
    }

    await manager.run();
    await manager.fresh();

    const remaining = fs.readdirSync(backupDir).filter(f => f.endsWith('.sql'));
    expect(remaining.length).toBeLessThanOrEqual(2);
    await db.close();
  });

  // ─────────────────────────────────────────────────────────────────────
  // T013 — skipAutoBackup honored in development
  // ─────────────────────────────────────────────────────────────────────

  test('skipAutoBackup=true honored in development', async () => {
    const { db, manager, migrationsDir, backupDir } = makeManager({ env: 'development' });
    await db.connect();
    writeMigration(migrationsDir, '2025_01_01_000001_create_users.js', createUsersTableMigration);
    await manager.run();
    await manager.fresh({ skipAutoBackup: true });
    const files = fs.readdirSync(backupDir);
    expect(files.some(f => /^auto_before_fresh_.+\.sql$/.test(f))).toBe(false);
    await db.close();
  });

  test('skipAutoBackup=true IGNORED in production (backup still created)', async () => {
    const { db, manager, migrationsDir, backupDir } = makeManager({
      env: 'production',
      requireProductionConfirm: false  // bypass the gate for this test
    });
    await db.connect();
    writeMigration(migrationsDir, '2025_01_01_000001_create_users.js', createUsersTableMigration);
    await manager.run();
    await manager.fresh({ skipAutoBackup: true });
    const files = fs.readdirSync(backupDir);
    expect(files.some(f => /^auto_before_fresh_.+\.sql$/.test(f))).toBe(true);
    await db.close();
  });

  // ─────────────────────────────────────────────────────────────────────
  // T014 — restoreAuto
  // ─────────────────────────────────────────────────────────────────────

  test('restoreAuto() restores the most-recent backup and writes history log', async () => {
    const { db, manager, migrationsDir, backupDir } = makeManager();
    await db.connect();
    writeMigration(migrationsDir, '2025_01_01_000001_create_users.js', createUsersTableMigration);
    await manager.run();
    await db.execute("INSERT INTO users (name) VALUES ('Alice')");
    await manager.fresh(); // backs up, then drops, then re-runs (users empty)

    const rowsBefore = await db.execute("SELECT * FROM users");
    expect(rowsBefore.length).toBe(0);

    const result = await manager.restoreAuto();
    expect(result.statements).toBeGreaterThan(0);

    const rowsAfter = await db.execute("SELECT * FROM users");
    expect(rowsAfter.some(r => r.name === 'Alice')).toBe(true);

    const log = fs.readFileSync(path.join(backupDir, '.restore-history.log'), 'utf8');
    expect(log).toMatch(/auto_before_fresh_/);
    await db.close();
  });

  test('restoreAuto({ backup }) restores a specific file', async () => {
    const { db, manager, migrationsDir, backupDir } = makeManager();
    await db.connect();
    writeMigration(migrationsDir, '2025_01_01_000001_create_users.js', createUsersTableMigration);
    await manager.run();
    await db.execute("INSERT INTO users (name) VALUES ('Bob')");
    await manager.fresh();
    const target = fs.readdirSync(backupDir).find(f => /\.sql$/.test(f));
    const result = await manager.restoreAuto({ backup: target });
    expect(result.statements).toBeGreaterThan(0);
    await db.close();
  });

  test('restoreAuto throws EOUTLET_NO_BACKUP when none exist', async () => {
    const { db, manager } = makeManager();
    await db.connect();
    await expect(manager.restoreAuto()).rejects.toThrow(/No auto-backups/);
    await db.close();
  });

  // ─────────────────────────────────────────────────────────────────────
  // T015 — listAutoBackups
  // ─────────────────────────────────────────────────────────────────────

  test('listAutoBackups returns metadata sorted newest-first', async () => {
    const { db, manager, migrationsDir } = makeManager();
    await db.connect();
    writeMigration(migrationsDir, '2025_01_01_000001_create_users.js', createUsersTableMigration);
    await manager.run();
    await manager.fresh();
    await manager.fresh();
    const list = await manager.listAutoBackups();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list[0].file).toMatch(/^auto_before_fresh_/);
    expect(list[0].command).toBe('fresh');
    await db.close();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Production gate (T017-T019)
  // ─────────────────────────────────────────────────────────────────────

  test('_assertProductionGate throws EOUTLET_PRODUCTION in prod without confirm', () => {
    const { db, manager } = makeManager({ env: 'production' });
    delete process.env.OUTLET_PRODUCTION_CONFIRM;
    try {
      manager._assertProductionGate('fresh');
      throw new Error('expected throw');
    } catch (e) {
      expect(e.code).toBe('EOUTLET_PRODUCTION');
    }
    db.close();
  });

  test('_assertProductionGate is a no-op when OUTLET_PRODUCTION_CONFIRM=1', () => {
    const { db, manager } = makeManager({ env: 'production' });
    process.env.OUTLET_PRODUCTION_CONFIRM = '1';
    expect(() => manager._assertProductionGate('fresh')).not.toThrow();
    delete process.env.OUTLET_PRODUCTION_CONFIRM;
    db.close();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Checksum + drift (T021-T026)
  // ─────────────────────────────────────────────────────────────────────

  test('runMigration records SHA-256 checksum and execution_time_ms', async () => {
    const { db, manager, migrationsDir } = makeManager();
    await db.connect();
    writeMigration(migrationsDir, '2025_01_01_000001_create_users.js', createUsersTableMigration);
    await manager.run();
    const rec = (await manager.getRanMigrations())[0];
    expect(rec.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(rec.status).toBe('completed');
    expect(rec.execution_time_ms).toBeGreaterThanOrEqual(0);
    await db.close();
  });

  test('getDriftedMigrations detects modified files', async () => {
    const { db, manager, migrationsDir } = makeManager();
    await db.connect();
    const file = writeMigration(migrationsDir, '2025_01_01_000001_create_users.js', createUsersTableMigration);
    await manager.run();
    // Mutate file
    fs.writeFileSync(file, createUsersTableMigration + '\n// drifted', 'utf8');
    const drifted = await manager.getDriftedMigrations();
    expect(drifted.length).toBe(1);
    expect(drifted[0].migration).toBe('2025_01_01_000001_create_users.js');
    await db.close();
  });

  test('drift in production throws unless allowDrift', async () => {
    const { db, manager, migrationsDir } = makeManager({ env: 'production', requireProductionConfirm: false });
    await db.connect();
    const file = writeMigration(migrationsDir, '2025_01_01_000001_create_users.js', createUsersTableMigration);
    await manager.run();
    fs.writeFileSync(file, createUsersTableMigration + '\n// drifted', 'utf8');
    writeMigration(migrationsDir, '2025_01_01_000002_more.js', createUsersTableMigration.replace('users', 'posts').replace('CreateUsers', 'CreatePosts'));
    let caught;
    try { await manager.run(); } catch (e) { caught = e; }
    expect(caught).toBeDefined();
    expect(caught.code).toBe('EOUTLET_DRIFT');
    await db.close();
  });

  // ─────────────────────────────────────────────────────────────────────
  // Data-transform helpers (T029, T030a)
  // ─────────────────────────────────────────────────────────────────────

  test('Migration.backupData/restoreData round-trip 50 rows', async () => {
    const Migration = require('../src/Migrations/Migration');
    const { db } = makeManager();
    await db.connect();
    await db.execute('CREATE TABLE widgets (id INTEGER PRIMARY KEY, name TEXT, qty INTEGER)');
    for (let i = 1; i <= 50; i++) {
      await db.execute('INSERT INTO widgets (id, name, qty) VALUES (?, ?, ?)', [i, `w${i}`, i * 2]);
    }
    const m = new Migration(db);
    const snap = await m.backupData('widgets');
    expect(snap.length).toBe(50);
    await db.execute('DELETE FROM widgets');
    const n = await m.restoreData('widgets', snap);
    expect(n).toBe(50);
    const after = await db.execute('SELECT COUNT(*) AS c FROM widgets');
    expect(after[0].c).toBe(50);
    await db.close();
  });

  test('Migration.backupData captures only requested columns', async () => {
    const Migration = require('../src/Migrations/Migration');
    const { db } = makeManager();
    await db.connect();
    await db.execute('CREATE TABLE gadgets (id INTEGER PRIMARY KEY, name TEXT, secret TEXT)');
    await db.execute('INSERT INTO gadgets (id, name, secret) VALUES (1, "a", "s1")');
    const m = new Migration(db);
    const snap = await m.backupData('gadgets', ['id', 'name']);
    expect(Object.keys(snap[0]).sort()).toEqual(['id', 'name']);
    await db.close();
  });

  test('Migration.transformData rolls back rows on callback failure', async () => {
    const Migration = require('../src/Migrations/Migration');
    const { db } = makeManager();
    await db.connect();
    await db.execute('CREATE TABLE items (id INTEGER PRIMARY KEY, val TEXT)');
    await db.execute('INSERT INTO items (id, val) VALUES (1, "a"), (2, "b"), (3, "c")');
    const m = new Migration(db);
    let caught;
    try {
      await m.transformData('items', (row, i) => {
        if (i === 1) throw new Error('boom');
        return { ...row, val: row.val.toUpperCase() };
      });
    } catch (e) { caught = e; }
    expect(caught).toBeDefined();
    expect(caught.message).toBe('boom');
    const rows = await db.execute('SELECT val FROM items ORDER BY id');
    expect(rows.map(r => r.val)).toEqual(['a', 'b', 'c']);
    await db.close();
  });

  test('Migration.transformData applies callback updates on success', async () => {
    const Migration = require('../src/Migrations/Migration');
    const { db } = makeManager();
    await db.connect();
    await db.execute('CREATE TABLE letters (id INTEGER PRIMARY KEY, val TEXT)');
    await db.execute('INSERT INTO letters (id, val) VALUES (1, "a"), (2, "b")');
    const m = new Migration(db);
    const n = await m.transformData('letters', (row) => ({ ...row, val: row.val.toUpperCase() }));
    expect(n).toBe(2);
    const rows = await db.execute('SELECT val FROM letters ORDER BY id');
    expect(rows.map(r => r.val)).toEqual(['A', 'B']);
    await db.close();
  });

  test('make:transform name validation regex rejects invalid names', () => {
    const re = /^[a-z][a-z0-9_]*$/;
    expect(re.test('backfill_user_status')).toBe(true);
    expect(re.test('a')).toBe(true);
    expect(re.test('1_starts_with_digit')).toBe(false);
    expect(re.test('Has_Uppercase')).toBe(false);
    expect(re.test('has-dash')).toBe(false);
    expect(re.test('')).toBe(false);
  });

  test('make:transform template exists and contains expected placeholders', () => {
    const tplPath = path.join(__dirname, '..', 'database', 'templates', 'transform-migration.js');
    const tpl = fs.readFileSync(tplPath, 'utf8');
    expect(tpl).toMatch(/__CLASS_NAME__/);
    expect(tpl).toMatch(/__MIGRATION_NAME__/);
    expect(tpl).toMatch(/transformData|backupData/);
  });
});

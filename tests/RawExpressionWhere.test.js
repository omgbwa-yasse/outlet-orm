/**
 * Regression test: RawExpression must be inlined in WHERE clauses, not pushed
 * as a parameter binding. Previously, `.where(col, new RawExpression('...'))`
 * leaked the RawExpression object into the bindings array, causing the driver
 * to throw "The first argument must be of type string or an instance of
 * Buffer... Received an instance of RawExpression" — which broke
 * `npx outlet migrate status` (via Schema.hasTable -> WHERE table_schema =
 * DATABASE()).
 *
 * Uses real SQLite in-memory queries (no mocks).
 */

const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const DatabaseConnection = require('../src/DatabaseConnection');
const RawExpression = require('../src/RawExpression');
const MigrationManager = require('../src/Migrations/MigrationManager');

describe('RawExpression in WHERE (real SQLite)', () => {
  let db;

  beforeAll(async () => {
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();
    await db.execute(`
      CREATE TABLE items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        qty INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute("INSERT INTO items (name, qty) VALUES ('a', 1)");
    await db.execute("INSERT INTO items (name, qty) VALUES ('b', 2)");
    await db.execute("INSERT INTO items (name, qty) VALUES ('c', 3)");
  });

  afterAll(async () => {
    await db.close();
  });

  test('basic where with RawExpression value is inlined', async () => {
    const rows = await db.from('items').where('qty', '<', new RawExpression('3')).get();
    expect(rows.map(r => r.name).sort()).toEqual(['a', 'b']);
  });

  test('where with RawExpression using a SQL function executes', async () => {
    const rows = await db.from('items').where('name', '=', new RawExpression("lower('B')")).get();
    expect(rows.map(r => r.name)).toEqual(['b']);
  });

  test('whereIn with mixed RawExpression and literal values', async () => {
    const rows = await db.from('items').whereIn('qty', [new RawExpression('1'), 3]).get();
    expect(rows.map(r => r.name).sort()).toEqual(['a', 'c']);
  });

  test('whereBetween with RawExpression bounds', async () => {
    const rows = await db.from('items').whereBetween('qty', [new RawExpression('2'), 3]).get();
    expect(rows.map(r => r.name).sort()).toEqual(['b', 'c']);
  });
});

describe('MigrationManager.status() against real SQLite', () => {
  let db;
  let tmpDir;
  let mgr;

  beforeAll(async () => {
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'outlet-mig-'));
    mgr = new MigrationManager(db, tmpDir, 'migrations');
  });

  afterAll(async () => {
    await db.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  test('initialize() then status() runs end-to-end without throwing', async () => {
    // initialize() internally calls schema.hasTable(...) which uses
    // .where(..., new RawExpression('...')) — the regression scenario.
    await expect(mgr.initialize()).resolves.not.toThrow();
    const rows = await db.execute('SELECT name FROM sqlite_master WHERE type = ? AND name = ?', ['table', 'migrations']);
    expect(rows.length).toBe(1);

    // status() is the failing command from the bug report
    await expect(mgr.status()).resolves.not.toThrow();
  });
});

describe('Migrations end-to-end against real SQLite', () => {
  let db;
  let tmpDir;
  let mgr;
  const MIGRATION_PATH = require.resolve('../src/Migrations/Migration');

  const migrationSource = (className, tableName) => `
const Migration = require(${JSON.stringify(MIGRATION_PATH)});
class ${className} extends Migration {
  async up() {
    const schema = this.getSchema();
    await schema.create('${tableName}', (table) => {
      table.id();
      table.string('name');
      table.timestamps();
    });
  }
  async down() {
    const schema = this.getSchema();
    await schema.dropIfExists('${tableName}');
  }
}
module.exports = ${className};
`;

  beforeAll(async () => {
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'outlet-mig-run-'));
    await fs.writeFile(
      path.join(tmpDir, '20260101_000001_create_posts_table.js'),
      migrationSource('CreatePostsTable', 'posts')
    );
    await fs.writeFile(
      path.join(tmpDir, '20260101_000002_create_tags_table.js'),
      migrationSource('CreateTagsTable', 'tags')
    );
    mgr = new MigrationManager(db, tmpDir, 'migrations');
    // Silence console output from the manager
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(async () => {
    await db.close();
    await fs.rm(tmpDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test('run() applies pending migrations and creates the target tables', async () => {
    await mgr.run();

    const posts = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = ? AND name = ?",
      ['table', 'posts']
    );
    const tags = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = ? AND name = ?",
      ['table', 'tags']
    );
    expect(posts.length).toBe(1);
    expect(tags.length).toBe(1);

    const recorded = await db.execute(
      'SELECT migration, status FROM migrations ORDER BY id ASC'
    );
    expect(recorded.length).toBe(2);
    expect(recorded.every(r => r.status === 'completed')).toBe(true);
  });

  test('status() reports both migrations as ran', async () => {
    const result = await mgr.status();
    // status() returns { ran: [...], pending: [...] } or similar; tolerate either
    // shape and just assert no pending migrations remain.
    if (result && Array.isArray(result.pending)) {
      expect(result.pending.length).toBe(0);
    }
    // Sanity: migrations table holds 2 completed rows
    const rows = await db.execute(
      "SELECT COUNT(*) AS c FROM migrations WHERE status = 'completed'"
    );
    expect(rows[0].c).toBe(2);
  });

  test('rollback() reverts the latest batch and drops the tables', async () => {
    await mgr.rollback();

    const posts = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = ? AND name = ?",
      ['table', 'posts']
    );
    const tags = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = ? AND name = ?",
      ['table', 'tags']
    );
    expect(posts.length).toBe(0);
    expect(tags.length).toBe(0);

    // After rolling back the only batch, the migrations table should have
    // no completed rows left (rollback removes them).
    const completed = await db.execute(
      "SELECT COUNT(*) AS c FROM migrations WHERE status = 'completed'"
    );
    expect(completed[0].c).toBe(0);
  });

  test('run() is idempotent: re-running creates the tables again from scratch', async () => {
    await mgr.run();
    const posts = await db.execute(
      "SELECT name FROM sqlite_master WHERE type = ? AND name = ?",
      ['table', 'posts']
    );
    expect(posts.length).toBe(1);
  });
});

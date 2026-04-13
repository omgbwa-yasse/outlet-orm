'use strict';

/**
 * DatabaseObjects.test.js
 * Tests for DB Objects Support (US1–US5): Views, Triggers, Procedures/Functions, Savepoints, Isolation Levels
 * All tests use SQLite in-memory for portability (no external DB required).
 */

const DatabaseConnection = require('../src/DatabaseConnection');
const { Schema } = require('../src/Schema/Schema');
const { IsolationLevel, UnsupportedCapabilityError } = require('../src/index');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Open a fresh SQLite in-memory DatabaseConnection and return it.
 * Caller is responsible for calling db.close() in afterEach/afterAll.
 */
function makeSQLiteDB() {
  return new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
}

/**
 * Run raw SQL on an open DatabaseConnection (shorthand).
 */
async function exec(db, sql) {
  return db.execute(sql);
}

// ---------------------------------------------------------------------------
// US4 — Savepoints & Isolation Levels
// ---------------------------------------------------------------------------

describe('US4 — Savepoints', () => {
  let db;

  beforeEach(async () => {
    db = makeSQLiteDB();
    await exec(db, 'CREATE TABLE sp_test (id INTEGER PRIMARY KEY, val TEXT)');
  });

  afterEach(async () => {
    await db.close();
  });

  test('savepoint / rollbackTo / releaseSavepoint round-trip', async () => {
    await db.beginTransaction();

    await exec(db, "INSERT INTO sp_test (id, val) VALUES (1, 'row_A')");

    await db.savepoint('sp1');

    await exec(db, "INSERT INTO sp_test (id, val) VALUES (2, 'row_B')");

    // Roll back to the savepoint — row B should disappear
    await db.rollbackTo('sp1');

    await db.releaseSavepoint('sp1');

    await db.commit();

    const rows = await exec(db, 'SELECT * FROM sp_test ORDER BY id');
    expect(rows).toHaveLength(1);
    expect(rows[0].val).toBe('row_A');
  });

  test('savepoint without active transaction works on SQLite', async () => {
    // SQLite allows SAVEPOINT outside explicit BEGIN (creates a deferred transaction)
    await expect(db.savepoint('outer_sp')).resolves.not.toThrow();
    await db.rollbackTo('outer_sp');
    await db.releaseSavepoint('outer_sp');
  });
});

describe('US4 — Isolation Levels', () => {
  let db;

  beforeEach(() => {
    db = makeSQLiteDB();
  });

  afterEach(async () => {
    await db.close();
  });

  test('setIsolationLevel(SERIALIZABLE) on SQLite is a silent no-op', () => {
    expect(() => db.setIsolationLevel(IsolationLevel.SERIALIZABLE)).not.toThrow();
  });

  test('setIsolationLevel(READ_COMMITTED) on SQLite throws UnsupportedCapabilityError', () => {
    expect(() => db.setIsolationLevel(IsolationLevel.READ_COMMITTED)).toThrow(
      UnsupportedCapabilityError
    );
  });

  test('setIsolationLevel throws when called with an active transaction', async () => {
    await db.connect();
    await db.beginTransaction();
    expect(() => db.setIsolationLevel(IsolationLevel.SERIALIZABLE)).toThrow(
      'Cannot set isolation level inside an active transaction'
    );
    await db.rollback();
  });
});

// ---------------------------------------------------------------------------
// US1 — Views
// ---------------------------------------------------------------------------

describe('US1 — Views (SQLite)', () => {
  let db;
  let schema;

  beforeEach(async () => {
    db = makeSQLiteDB();
    schema = new Schema(db);
    await exec(db, 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, active INTEGER DEFAULT 1)');
    await exec(db, "INSERT INTO users (name, active) VALUES ('Alice', 1), ('Bob', 0)");
  });

  afterEach(async () => {
    await db.close();
  });

  test('createView → hasView true → query view → dropViewIfExists → hasView false', async () => {
    await schema.createView('active_users', 'SELECT * FROM users WHERE active = 1');

    expect(await schema.hasView('active_users')).toBe(true);

    const rows = await exec(db, 'SELECT name FROM active_users');
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('Alice');

    await schema.dropViewIfExists('active_users');
    expect(await schema.hasView('active_users')).toBe(false);
  });

  test('getViews() returns view name before drop, empty array after', async () => {
    await schema.createView('active_users', 'SELECT * FROM users WHERE active = 1');

    const views = await schema.getViews();
    expect(views).toContain('active_users');

    await schema.dropViewIfExists('active_users');
    const viewsAfter = await schema.getViews();
    expect(viewsAfter).not.toContain('active_users');
  });

  test('createOrReplaceView does not throw when view already exists', async () => {
    await schema.createView('active_users', 'SELECT * FROM users WHERE active = 1');
    await expect(
      schema.createOrReplaceView('active_users', 'SELECT * FROM users WHERE active = 1')
    ).resolves.not.toThrow();
  });

  test('dropView on non-existent view throws', async () => {
    await expect(schema.dropView('nonexistent_view')).rejects.toThrow();
  });

  test('dropViewIfExists on non-existent view does not throw', async () => {
    await expect(schema.dropViewIfExists('nonexistent_view')).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// US2 — Triggers
// ---------------------------------------------------------------------------

describe('US2 — Triggers (SQLite)', () => {
  let db;
  let schema;

  beforeEach(async () => {
    db = makeSQLiteDB();
    schema = new Schema(db);
    await exec(db, `
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY,
        amount REAL,
        last_modified TEXT
      )
    `);
    await exec(db, "INSERT INTO orders (id, amount) VALUES (1, 100.0)");
  });

  afterEach(async () => {
    await db.close();
  });

  test('UPDATE trigger sets last_modified column', async () => {
    await schema.createTrigger({
      name:    'set_last_modified',
      table:   'orders',
      timing:  'AFTER',
      event:   'UPDATE',
      body:    "UPDATE orders SET last_modified = 'updated' WHERE id = NEW.id;"
    });

    await exec(db, "UPDATE orders SET amount = 200.0 WHERE id = 1");

    const rows = await exec(db, 'SELECT last_modified FROM orders WHERE id = 1');
    expect(rows[0].last_modified).toBe('updated');
  });

  test('hasTrigger returns true before drop, false after dropTriggerIfExists', async () => {
    await schema.createTrigger({
      name:   'set_last_modified',
      table:  'orders',
      timing: 'AFTER',
      event:  'UPDATE',
      body:   "UPDATE orders SET last_modified = 'x' WHERE id = NEW.id;"
    });

    expect(await schema.hasTrigger('set_last_modified', 'orders')).toBe(true);

    await schema.dropTriggerIfExists('set_last_modified', 'orders');

    expect(await schema.hasTrigger('set_last_modified', 'orders')).toBe(false);
  });

  test('getTriggers() returns trigger name', async () => {
    await schema.createTrigger({
      name:   'set_last_modified',
      table:  'orders',
      timing: 'AFTER',
      event:  'UPDATE',
      body:   "UPDATE orders SET last_modified = 'x' WHERE id = NEW.id;"
    });

    const triggers = await schema.getTriggers('orders');
    expect(triggers).toContain('set_last_modified');
  });

  test('INSTEAD OF trigger on a plain table throws UnsupportedCapabilityError', async () => {
    await expect(
      schema.createTrigger({
        name:    'bad_trigger',
        table:   'orders',
        timing:  'INSTEAD OF',
        event:   'INSERT',
        body:    '',
        isView:  false
      })
    ).rejects.toThrow(UnsupportedCapabilityError);
  });

  test('SQLite trigger body with qualified table name throws', async () => {
    const { TriggerBuilder } = require('../src/Schema/TriggerBuilder') !== undefined
      ? { TriggerBuilder: require('../src/Schema/TriggerBuilder') }
      : { TriggerBuilder: null };

    const tb = require('../src/Schema/TriggerBuilder');
    expect(() =>
      tb.buildCreate(
        {
          name:   'bad',
          table:  'orders',
          timing: 'AFTER',
          event:  'UPDATE',
          body:   'UPDATE schema1.orders SET x = 1;'
        },
        'sqlite'
      )
    ).toThrow('qualified table references');
  });
});

// ---------------------------------------------------------------------------
// US3 — Procedures & Functions (SQLite unsupported)
// ---------------------------------------------------------------------------

describe('US3 — Procedures & Functions on SQLite throw UnsupportedCapabilityError', () => {
  let db;
  let schema;

  beforeEach(async () => {
    db = makeSQLiteDB();
    schema = new Schema(db);
  });

  afterEach(async () => {
    await db.close();
  });

  test('createProcedure on SQLite throws UnsupportedCapabilityError', async () => {
    await expect(
      schema.createProcedure('my_proc', '', 'SELECT 1;')
    ).rejects.toThrow(UnsupportedCapabilityError);
  });

  test('createFunction on SQLite throws UnsupportedCapabilityError', async () => {
    await expect(
      schema.createFunction('my_fn', '', 'RETURN 1;', { returns: 'INT' })
    ).rejects.toThrow(UnsupportedCapabilityError);
  });

  test('callProcedure on SQLite throws UnsupportedCapabilityError', async () => {
    await expect(db.callProcedure('my_proc', [])).rejects.toThrow(
      UnsupportedCapabilityError
    );
  });

  test('callFunction on SQLite throws UnsupportedCapabilityError', async () => {
    await expect(db.callFunction('my_fn', [])).rejects.toThrow(
      UnsupportedCapabilityError
    );
  });

  test('hasProcedure on SQLite throws UnsupportedCapabilityError', async () => {
    await expect(schema.hasProcedure('my_proc')).rejects.toThrow(
      UnsupportedCapabilityError
    );
  });

  test('hasFunction on SQLite throws UnsupportedCapabilityError', async () => {
    await expect(schema.hasFunction('my_fn')).rejects.toThrow(
      UnsupportedCapabilityError
    );
  });
});

// ---------------------------------------------------------------------------
// US5 — Migration round-trip
// ---------------------------------------------------------------------------

describe('US5 — Migration round-trip (SQLite)', () => {
  let db;
  let schema;

  beforeEach(async () => {
    db = makeSQLiteDB();
    schema = new Schema(db);
    // Pre-create tables that the migration references
    await exec(db, `
      CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        name TEXT,
        active INTEGER DEFAULT 1,
        last_modified TEXT
      )
    `);
  });

  afterEach(async () => {
    await db.close();
  });

  test('migration up → hasView + hasTrigger true; down → both false', async () => {
    // Inline migration (mirrors examples/migrations/create_views_and_triggers.js)
    const up = async () => {
      await schema.createView(
        'active_users',
        'SELECT * FROM users WHERE active = 1'
      );
      await schema.createTrigger({
        name:   'set_last_modified',
        table:  'users',
        timing: 'AFTER',
        event:  'UPDATE',
        body:   "UPDATE users SET last_modified = 'updated' WHERE id = NEW.id;"
      });
    };

    const down = async () => {
      await schema.dropViewIfExists('active_users');
      await schema.dropTriggerIfExists('set_last_modified', 'users');
    };

    await up();

    expect(await schema.hasView('active_users')).toBe(true);
    expect(await schema.hasTrigger('set_last_modified', 'users')).toBe(true);

    await down();

    expect(await schema.hasView('active_users')).toBe(false);
    expect(await schema.hasTrigger('set_last_modified', 'users')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// IsolationLevel constant shape
// ---------------------------------------------------------------------------

describe('IsolationLevel constant', () => {
  test('exposes all four standard levels', () => {
    expect(IsolationLevel.READ_UNCOMMITTED).toBe('READ UNCOMMITTED');
    expect(IsolationLevel.READ_COMMITTED).toBe('READ COMMITTED');
    expect(IsolationLevel.REPEATABLE_READ).toBe('REPEATABLE READ');
    expect(IsolationLevel.SERIALIZABLE).toBe('SERIALIZABLE');
  });

  test('is frozen (immutable)', () => {
    expect(Object.isFrozen(IsolationLevel)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// UnsupportedCapabilityError shape
// ---------------------------------------------------------------------------

describe('UnsupportedCapabilityError', () => {
  test('has correct name, driver, capability, and message', () => {
    const err = new UnsupportedCapabilityError('sqlite', 'stored procedures');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('UnsupportedCapabilityError');
    expect(err.driver).toBe('sqlite');
    expect(err.capability).toBe('stored procedures');
    expect(err.message).toMatch(/stored procedures/);
    expect(err.message).toMatch(/sqlite/);
  });
});

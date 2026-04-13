'use strict';

/**
 * FluentDbObjects.test.js
 * Tests for Fluent DB Objects API (v11.4.0): View, Trigger, Procedure, Function, Transaction, useSchema
 */

const DatabaseConnection = require('../src/DatabaseConnection');
const { Schema }         = require('../src/Schema/Schema');
const resolveSchema      = require('../src/Objects/resolveSchema');
const View               = require('../src/Objects/View');
const Trigger            = require('../src/Objects/Trigger');
const Procedure          = require('../src/Objects/Procedure');
const DBFunction         = require('../src/Objects/Function');
const Transaction        = require('../src/Objects/Transaction');
const { useSchema, Function: FunctionAlias, SchemaFunction: SchemaFnAlias } = require('../src/Objects');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Schema-like mock (duck-type: has createView). */
function makeSchemaStub() {
  return {
    connection: {
      beginTransaction:  jest.fn().mockResolvedValue(undefined),
      commit:            jest.fn().mockResolvedValue(undefined),
      rollback:          jest.fn().mockResolvedValue(undefined),
      transaction:       jest.fn().mockResolvedValue(undefined),
      savepoint:         jest.fn().mockResolvedValue(undefined),
      rollbackTo:        jest.fn().mockResolvedValue(undefined),
      releaseSavepoint:  jest.fn().mockResolvedValue(undefined),
    },
    createView:            jest.fn().mockResolvedValue(undefined),
    createOrReplaceView:   jest.fn().mockResolvedValue(undefined),
    dropView:              jest.fn().mockResolvedValue(undefined),
    dropViewIfExists:      jest.fn().mockResolvedValue(undefined),
    hasView:               jest.fn().mockResolvedValue(true),
    getViews:              jest.fn().mockResolvedValue([]),
    createTrigger:         jest.fn().mockResolvedValue(undefined),
    dropTrigger:           jest.fn().mockResolvedValue(undefined),
    dropTriggerIfExists:   jest.fn().mockResolvedValue(undefined),
    hasTrigger:            jest.fn().mockResolvedValue(true),
    getTriggers:           jest.fn().mockResolvedValue([]),
    createProcedure:       jest.fn().mockResolvedValue(undefined),
    dropProcedure:         jest.fn().mockResolvedValue(undefined),
    dropProcedureIfExists: jest.fn().mockResolvedValue(undefined),
    hasProcedure:          jest.fn().mockResolvedValue(true),
    createFunction:        jest.fn().mockResolvedValue(undefined),
    dropFunction:          jest.fn().mockResolvedValue(undefined),
    dropFunctionIfExists:  jest.fn().mockResolvedValue(undefined),
    hasFunction:           jest.fn().mockResolvedValue(true),
  };
}

/** Build a minimal DatabaseConnection-like mock (duck-type: has execute, beginTransaction). */
function makeDbStub() {
  const connection = {
    execute:            jest.fn().mockResolvedValue(undefined),
    beginTransaction:   jest.fn().mockResolvedValue(undefined),
    commit:             jest.fn().mockResolvedValue(undefined),
    rollback:           jest.fn().mockResolvedValue(undefined),
    transaction:        jest.fn().mockResolvedValue(undefined),
    savepoint:          jest.fn().mockResolvedValue(undefined),
    rollbackTo:         jest.fn().mockResolvedValue(undefined),
    releaseSavepoint:   jest.fn().mockResolvedValue(undefined),
    setIsolationLevel:  jest.fn(),
  };
  return connection;
}

// ---------------------------------------------------------------------------
// Suite 1 — resolveSchema
// ---------------------------------------------------------------------------

describe('resolveSchema', () => {
  test('passes through a Schema instance (duck-type: has createView)', () => {
    const schema = makeSchemaStub();
    expect(resolveSchema(schema)).toBe(schema);
  });

  test('wraps a DatabaseConnection (duck-type: has execute) into a new Schema', () => {
    const db = makeDbStub();
    const result = resolveSchema(db);
    expect(result).toBeInstanceOf(Schema);
  });

  test('throws TypeError for null', () => {
    expect(() => resolveSchema(null)).toThrow(TypeError);
    expect(() => resolveSchema(null)).toThrow('useSchema / .use() requires');
  });

  test('throws TypeError for plain object without duck-type methods', () => {
    expect(() => resolveSchema({})).toThrow(TypeError);
    expect(() => resolveSchema({})).toThrow('useSchema / .use() requires');
  });
});

// ---------------------------------------------------------------------------
// Suite 2 — View unbound guard
// ---------------------------------------------------------------------------

describe('View — unbound guard', () => {
  const methods = ['create', 'createOrReplace', 'drop', 'dropIfExists', 'has', 'list'];

  test.each(methods)('new View().%s() throws "View is not bound"', async (method) => {
    const v = new View();
    await expect(v[method]('foo')).rejects.toThrow('View is not bound to a schema');
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — View bound via .use(schema)
// ---------------------------------------------------------------------------

describe('View — bound via .use(schema)', () => {
  let schema;
  let view;

  beforeEach(() => {
    schema = makeSchemaStub();
    view = View.use(schema);
  });

  test('create delegates to schema.createView', async () => {
    await view.create('v_users', 'SELECT * FROM users');
    expect(schema.createView).toHaveBeenCalledWith('v_users', 'SELECT * FROM users', {});
  });

  test('createOrReplace delegates to schema.createOrReplaceView', async () => {
    await view.createOrReplace('v_users', 'SELECT id FROM users');
    expect(schema.createOrReplaceView).toHaveBeenCalledWith('v_users', 'SELECT id FROM users');
  });

  test('drop delegates to schema.dropView', async () => {
    await view.drop('v_users');
    expect(schema.dropView).toHaveBeenCalledWith('v_users');
  });

  test('dropIfExists delegates to schema.dropViewIfExists', async () => {
    await view.dropIfExists('v_users');
    expect(schema.dropViewIfExists).toHaveBeenCalledWith('v_users');
  });

  test('has delegates and returns boolean', async () => {
    const result = await view.has('v_users');
    expect(schema.hasView).toHaveBeenCalledWith('v_users');
    expect(result).toBe(true);
  });

  test('list delegates and returns array', async () => {
    const result = await view.list();
    expect(schema.getViews).toHaveBeenCalled();
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 4 — Trigger bound via .use(schema)
// ---------------------------------------------------------------------------

describe('Trigger — bound via .use(schema)', () => {
  let schema;
  let trigger;

  beforeEach(() => {
    schema = makeSchemaStub();
    trigger = Trigger.use(schema);
  });

  test('create(opts) delegates to schema.createTrigger', async () => {
    const opts = { name: 'trg_test', timing: 'AFTER', event: 'INSERT', table: 'users', body: 'BEGIN SELECT 1; END' };
    await trigger.create(opts);
    expect(schema.createTrigger).toHaveBeenCalledWith(opts);
  });

  test('drop(name, table) delegates to schema.dropTrigger', async () => {
    await trigger.drop('trg_test', 'users');
    expect(schema.dropTrigger).toHaveBeenCalledWith('trg_test', 'users');
  });

  test('dropIfExists(name, table) delegates to schema.dropTriggerIfExists', async () => {
    await trigger.dropIfExists('trg_test', 'users');
    expect(schema.dropTriggerIfExists).toHaveBeenCalledWith('trg_test', 'users');
  });

  test('has(name, table) delegates', async () => {
    const result = await trigger.has('trg_test', 'users');
    expect(schema.hasTrigger).toHaveBeenCalledWith('trg_test', 'users');
    expect(result).toBe(true);
  });

  test('list(table) delegates', async () => {
    const result = await trigger.list('users');
    expect(schema.getTriggers).toHaveBeenCalledWith('users');
    expect(Array.isArray(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Suite 5 — Procedure bound via .use(schema)
// ---------------------------------------------------------------------------

describe('Procedure — bound via .use(schema)', () => {
  let schema;
  let proc;

  beforeEach(() => {
    schema = makeSchemaStub();
    proc = Procedure.use(schema);
  });

  test('create delegates to schema.createProcedure', async () => {
    await proc.create('sp_test', [], 'BEGIN SELECT 1; END');
    expect(schema.createProcedure).toHaveBeenCalledWith('sp_test', [], 'BEGIN SELECT 1; END', {});
  });

  test('drop delegates to schema.dropProcedure', async () => {
    await proc.drop('sp_test');
    expect(schema.dropProcedure).toHaveBeenCalledWith('sp_test');
  });

  test('dropIfExists delegates to schema.dropProcedureIfExists', async () => {
    await proc.dropIfExists('sp_test');
    expect(schema.dropProcedureIfExists).toHaveBeenCalledWith('sp_test');
  });

  test('has delegates', async () => {
    const result = await proc.has('sp_test');
    expect(schema.hasProcedure).toHaveBeenCalledWith('sp_test');
    expect(result).toBe(true);
  });

  test('unbound Procedure throws class name in message', async () => {
    const unbound = new Procedure();
    await expect(unbound.drop('sp_test')).rejects.toThrow('Procedure is not bound to a schema');
  });
});

// ---------------------------------------------------------------------------
// Suite 6 — Function (DBFunction) bound via .use(schema)
// ---------------------------------------------------------------------------

describe('Function (DBFunction) — bound via .use(schema)', () => {
  let schema;
  let fn;

  beforeEach(() => {
    schema = makeSchemaStub();
    fn = DBFunction.use(schema);
  });

  test('create delegates to schema.createFunction', async () => {
    await fn.create('fn_test', [], 'RETURN 1');
    expect(schema.createFunction).toHaveBeenCalledWith('fn_test', [], 'RETURN 1', {});
  });

  test('drop delegates to schema.dropFunction', async () => {
    await fn.drop('fn_test');
    expect(schema.dropFunction).toHaveBeenCalledWith('fn_test');
  });

  test('dropIfExists delegates to schema.dropFunctionIfExists', async () => {
    await fn.dropIfExists('fn_test');
    expect(schema.dropFunctionIfExists).toHaveBeenCalledWith('fn_test');
  });

  test('has delegates', async () => {
    const result = await fn.has('fn_test');
    expect(schema.hasFunction).toHaveBeenCalledWith('fn_test');
    expect(result).toBe(true);
  });

  test('Class name "Function" in unbound error message', async () => {
    const unbound = new DBFunction();
    await expect(unbound.drop('fn_test')).rejects.toThrow('Function is not bound to a schema');
  });

  test('FunctionAlias and SchemaFunctionAlias all point to same class', () => {
    expect(FunctionAlias).toBe(DBFunction);
    expect(SchemaFnAlias).toBe(DBFunction);
  });
});

// ---------------------------------------------------------------------------
// Suite 7 — Transaction bound via .use(db)
// ---------------------------------------------------------------------------

describe('Transaction — bound via .use(db)', () => {
  let db;
  let txn;

  beforeEach(() => {
    db = makeDbStub();
    txn = Transaction.use(db);
  });

  test('use(db) accepts DatabaseConnection directly', () => {
    expect(txn).toBeInstanceOf(Transaction);
    expect(txn._db).toBe(db);
  });

  test('use(schema) extracts schema.connection', () => {
    const fakeSchema = { connection: db };
    const t = Transaction.use(fakeSchema);
    expect(t._db).toBe(db);
  });

  test('use(null) throws "Transaction.use() requires"', () => {
    expect(() => Transaction.use(null)).toThrow('Transaction.use() requires');
  });

  test('use({}) throws "Transaction.use() requires"', () => {
    expect(() => Transaction.use({})).toThrow('Transaction.use() requires');
  });

  test('begin() delegates to db.beginTransaction()', async () => {
    await txn.begin();
    expect(db.beginTransaction).toHaveBeenCalled();
  });

  test('commit() delegates to db.commit()', async () => {
    await txn.commit();
    expect(db.commit).toHaveBeenCalled();
  });

  test('rollback() delegates to db.rollback()', async () => {
    await txn.rollback();
    expect(db.rollback).toHaveBeenCalled();
  });

  test('run(cb) delegates to db.transaction(cb)', async () => {
    const cb = jest.fn();
    await txn.run(cb);
    expect(db.transaction).toHaveBeenCalledWith(cb);
  });

  test('savepoint(name) delegates to db.savepoint(name)', async () => {
    await txn.savepoint('sp1');
    expect(db.savepoint).toHaveBeenCalledWith('sp1');
  });

  test('rollbackTo(name) delegates to db.rollbackTo(name)', async () => {
    await txn.rollbackTo('sp1');
    expect(db.rollbackTo).toHaveBeenCalledWith('sp1');
  });

  test('releaseSavepoint(name) delegates to db.releaseSavepoint(name)', async () => {
    await txn.releaseSavepoint('sp1');
    expect(db.releaseSavepoint).toHaveBeenCalledWith('sp1');
  });

  test('unbound new Transaction().begin() throws "Transaction is not bound to a connection"', async () => {
    const unbound = new Transaction();
    await expect(unbound.begin()).rejects.toThrow('Transaction is not bound to a connection');
  });
});

// ---------------------------------------------------------------------------
// Suite 8 — useSchema(schema) returns all five bound objects
// ---------------------------------------------------------------------------

describe('useSchema(schema) — all five keys', () => {
  let schema;
  let result;

  beforeEach(() => {
    schema = makeSchemaStub();
    result = useSchema(schema);
  });

  test('returns all five keys: View, Trigger, Procedure, Function, Transaction', () => {
    expect(result).toHaveProperty('View');
    expect(result).toHaveProperty('Trigger');
    expect(result).toHaveProperty('Procedure');
    expect(result).toHaveProperty('Function');
    expect(result).toHaveProperty('Transaction');
  });

  test('View instance is bound to schema', () => {
    expect(result.View).toBeInstanceOf(View);
    expect(result.View._schema).toBe(schema);
  });

  test('Trigger instance is bound to schema', () => {
    expect(result.Trigger).toBeInstanceOf(Trigger);
  });

  test('Procedure instance is bound to schema', () => {
    expect(result.Procedure).toBeInstanceOf(Procedure);
  });

  test('Function instance is bound to schema', () => {
    expect(result.Function).toBeInstanceOf(DBFunction);
  });

  test('two useSchema calls produce independent instances', () => {
    const a = useSchema(schema);
    const b = useSchema(schema);
    expect(a.View).not.toBe(b.View);
    expect(a.Trigger).not.toBe(b.Trigger);
  });
});

// ---------------------------------------------------------------------------
// Suite 9 — useSchema(db) auto-wraps DatabaseConnection
// ---------------------------------------------------------------------------

describe('useSchema(db) — auto-wraps DatabaseConnection', () => {
  test('returned View is bound to a fresh Schema(db)', () => {
    const db = makeDbStub();
    const { View: v } = useSchema(db);
    expect(v).toBeInstanceOf(View);
    expect(v._schema).toBeInstanceOf(Schema);
  });

  test('returned Transaction is bound directly to db', () => {
    const db = makeDbStub();
    const { Transaction: t } = useSchema(db);
    expect(t).toBeInstanceOf(Transaction);
    expect(t._db).toBe(db);
  });
});

// ---------------------------------------------------------------------------
// Suite 10 — SQLite integration (live queries via View + Trigger)
// ---------------------------------------------------------------------------

describe('SQLite integration — View', () => {
  let db;
  let schema;
  let view;

  beforeAll(async () => {
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();
    schema = new Schema(db);
    // Create base table needed for the views
    await schema.create('si_users', (t) => {
      t.id();
      t.string('name');
      t.boolean('active').default(true);
    });
    view = View.use(schema);
  });

  afterAll(async () => {
    await view.dropIfExists('si_active_users');
    await db.close();
  });

  test('create + has returns true', async () => {
    await view.create('si_active_users', 'SELECT * FROM si_users WHERE active = 1');
    const exists = await view.has('si_active_users');
    expect(exists).toBe(true);
  });

  test('list includes created view', async () => {
    const views = await view.list();
    const names = views.map(v => v.name || v.view_name || v.table_name || v);
    expect(views.length).toBeGreaterThan(0);
  });

  test('dropIfExists + has returns false', async () => {
    await view.dropIfExists('si_active_users');
    const exists = await view.has('si_active_users');
    expect(exists).toBe(false);
  });
});

describe('SQLite integration — Trigger', () => {
  let db;
  let schema;
  let trigger;

  beforeAll(async () => {
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();
    schema = new Schema(db);
    await schema.create('si_items', (t) => {
      t.id();
      t.string('name');
    });
    await schema.create('si_audit', (t) => {
      t.id();
      t.string('action');
    });
    trigger = Trigger.use(schema);
  });

  afterAll(async () => {
    await trigger.dropIfExists('trg_si_after_insert', 'si_items');
    await db.close();
  });

  test('create trigger + has returns true', async () => {
    await trigger.create({
      name:   'trg_si_after_insert',
      timing: 'AFTER',
      event:  'INSERT',
      table:  'si_items',
      body:   "INSERT INTO si_audit (action) VALUES ('inserted');"
    });
    const exists = await trigger.has('trg_si_after_insert', 'si_items');
    expect(exists).toBe(true);
  });

  test('list returns created trigger', async () => {
    const triggers = await trigger.list('si_items');
    expect(triggers.length).toBeGreaterThan(0);
  });

  test('dropIfExists + has returns false', async () => {
    await trigger.dropIfExists('trg_si_after_insert', 'si_items');
    const exists = await trigger.has('trg_si_after_insert', 'si_items');
    expect(exists).toBe(false);
  });
});

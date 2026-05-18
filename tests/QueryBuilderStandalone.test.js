const DatabaseConnection = require('../src/DatabaseConnection');
const QueryBuilderError = require('../src/Errors/QueryBuilderError');

describe('QueryBuilder standalone mode', () => {
  let db;

  beforeAll(async () => {
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();
    await db.execute(
      'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER, created_at TEXT, updated_at TEXT)'
    );
    await db.execute(
      'CREATE TABLE orders (id INTEGER PRIMARY KEY AUTOINCREMENT, status TEXT, total INTEGER, created_at TEXT)'
    );
    await db.insert('users', { name: 'Alice', age: 30, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    await db.insert('users', { name: 'Bob', age: 25, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    await db.insert('orders', { status: 'shipped', total: 100, created_at: new Date().toISOString() });
    await db.insert('orders', { status: 'pending', total: 50, created_at: new Date().toISOString() });
  });

  afterAll(async () => {
    await db.close();
  });

  test('db.from() creates a standalone query builder and returns plain row objects', async () => {
    const rows = await db.from('users').select('id', 'name').get();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows[0]).toEqual(expect.objectContaining({ id: expect.any(Number), name: expect.any(String) }));
  });

  test('db.from().first() returns the first row or null', async () => {
    const row = await db.from('users').where('name', 'Alice').first();
    expect(row).toEqual(expect.objectContaining({ name: 'Alice' }));

    const missing = await db.from('users').where('name', 'DoesNotExist').first();
    expect(missing).toBeNull();
  });

  test('db.from().count() returns a numeric total and respects WHERE filters', async () => {
    const total = await db.from('users').count();
    expect(typeof total).toBe('number');
    expect(total).toBeGreaterThanOrEqual(2);

    const filtered = await db.from('users').where('name', 'Alice').count();
    expect(filtered).toBeGreaterThanOrEqual(0);
    expect(filtered).toBeLessThanOrEqual(total);
  });

  test('db.from().groupBy().havingRaw() works for standalone queries', async () => {
    const rows = await db.from('orders')
      .select('status')
      .groupBy('status')
      .havingRaw('COUNT(*) > ?', [0])
      .get();

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toHaveProperty('status');
  });

  test('db.from(null) throws a QueryBuilderError', async () => {
    await expect(async () => {
      db.from(null);
    }).rejects.toThrow(QueryBuilderError);
  });

  test('standalone queries are logged with SQL and bindings', async () => {
    DatabaseConnection.enableQueryLog();
    DatabaseConnection.flushQueryLog();

    await db.from('users').where('name', 'Alice').get();

    const logs = DatabaseConnection.getQueryLog();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[logs.length - 1].sql).toContain('SELECT');
    expect(logs[logs.length - 1].params).toContain('Alice');

    DatabaseConnection.disableQueryLog();
  });
});

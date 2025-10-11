const DatabaseConnection = require('../src/DatabaseConnection');

// Minimal end-to-end smoke test against SQLite in-memory
// Validates basic insert/select/update/delete paths execute without throwing

describe('SQLite Integration (smoke)', () => {
  let db;

  beforeAll(async () => {
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();
    await db.execute(
      'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER, created_at TEXT, updated_at TEXT)'
    );
  });

  afterAll(async () => {
    await db.close();
  });

  test('insert/select/update/delete and inc/dec', async () => {
    // Insert
    const res = await db.insert('users', { name: 'Alice', age: 30, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    expect(res.affectedRows).toBeGreaterThanOrEqual(1);

    // Select
    const rows = await db.select('users', { wheres: [{ column: 'name', operator: '=', value: 'Alice', type: 'basic', boolean: 'and' }] });
    expect(rows.length).toBe(1);

    // Increment
    await db.increment('users', 'age', { wheres: [{ column: 'name', operator: '=', value: 'Alice', type: 'basic', boolean: 'and' }] }, 2);
    const rowsAfterInc = await db.select('users', { wheres: [{ column: 'name', operator: '=', value: 'Alice', type: 'basic', boolean: 'and' }] });
    expect(rowsAfterInc[0].age).toBe(32);

    // Decrement
    await db.decrement('users', 'age', { wheres: [{ column: 'name', operator: '=', value: 'Alice', type: 'basic', boolean: 'and' }] }, 1);
    const rowsAfterDec = await db.select('users', { wheres: [{ column: 'name', operator: '=', value: 'Alice', type: 'basic', boolean: 'and' }] });
    expect(rowsAfterDec[0].age).toBe(31);

    // Update
    await db.update('users', { name: 'Alice Doe' }, { wheres: [{ column: 'id', operator: '>', value: 0, type: 'basic', boolean: 'and' }] });
    const rowsUpdated = await db.select('users', { wheres: [{ column: 'name', operator: '=', value: 'Alice Doe', type: 'basic', boolean: 'and' }] });
    expect(rowsUpdated.length).toBe(1);

    // Delete
    const del = await db.delete('users', { wheres: [{ column: 'name', operator: '=', value: 'Alice Doe', type: 'basic', boolean: 'and' }] });
    expect(del.affectedRows).toBeGreaterThanOrEqual(1);
    const rowsAfterDel = await db.select('users', { wheres: [{ column: 'name', operator: '=', value: 'Alice Doe', type: 'basic', boolean: 'and' }] });
    expect(rowsAfterDel.length).toBe(0);
  });
});

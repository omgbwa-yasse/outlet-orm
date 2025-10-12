const DatabaseConnection = require('../src/DatabaseConnection');
const Model = require('../src/Model');

describe('Timestamps Behavior', () => {
  let db;

  class UserWithTimestamps extends Model {
    static table = 'users_with_ts';
    static timestamps = true;
    static fillable = ['name', 'email'];
  }

  class UserWithoutTimestamps extends Model {
    static table = 'users_without_ts';
    static timestamps = false;
    static fillable = ['name', 'email'];
  }

  beforeAll(async () => {
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();

    UserWithTimestamps.setConnection(db);
    UserWithoutTimestamps.setConnection(db);

    // Tables with different timestamp setups
    await db.execute('CREATE TABLE users_with_ts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT, created_at TEXT, updated_at TEXT)');
    await db.execute('CREATE TABLE users_without_ts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)');
  });

  afterAll(async () => {
    await db.close();
  });

  test('Model with timestamps=true should auto-add timestamps', async () => {
    const user = new UserWithTimestamps({ name: 'Alice', email: 'alice@test.com' });
    await user.save();

    expect(user.getAttribute('created_at')).toBeDefined();
    expect(user.getAttribute('updated_at')).toBeDefined();
  });

  test('Model with timestamps=false should NOT auto-add timestamps', async () => {
    const user = new UserWithoutTimestamps({ name: 'Bob', email: 'bob@test.com' });

    // Verify timestamps property
    expect(UserWithoutTimestamps.timestamps).toBe(false);

    await user.save();

    // Should not have timestamp attributes
    expect(user.getAttribute('created_at')).toBeUndefined();
    expect(user.getAttribute('updated_at')).toBeUndefined();
  });

  test('QueryBuilder update with timestamps=false should not add updated_at', async () => {
    // Insert manually first
    await db.insert('users_without_ts', { name: 'Charlie', email: 'charlie@test.com' });

    // Update via QueryBuilder
    await UserWithoutTimestamps.where('name', 'Charlie').update({ email: 'charlie.new@test.com' });

    const updated = await UserWithoutTimestamps.where('name', 'Charlie').first();
    expect(updated.getAttribute('updated_at')).toBeUndefined();
  });
});

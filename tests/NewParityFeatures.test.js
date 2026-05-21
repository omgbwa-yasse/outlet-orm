const DatabaseConnection = require('../src/DatabaseConnection');
const Model = require('../src/Model');

// Coverage for v14.9.0 query-builder additions

describe('v14.9.0 parity features', () => {
  let db;

  class User extends Model {
    static table = 'users';
    posts() { return this.hasMany(Post, 'user_id'); }
  }
  class Post extends Model {
    static table = 'posts';
    author() { return this.belongsTo(User, 'user_id'); }
  }

  beforeAll(async () => {
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();
    User.setConnection(db);
    Post.setConnection(db);

    await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER, created_at TEXT, updated_at TEXT)');
    await db.execute('CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT, views INTEGER, created_at TEXT, updated_at TEXT)');

    const now = new Date().toISOString();
    await db.insert('users', { name: 'Alice', age: 25, created_at: now, updated_at: now });
    await db.insert('users', { name: 'Bob', age: 35, created_at: now, updated_at: now });
    await db.insert('users', { name: 'Carol', age: 45, created_at: now, updated_at: now });
    await db.insert('posts', { user_id: 1, title: 'A1', views: 10, created_at: now, updated_at: now });
    await db.insert('posts', { user_id: 1, title: 'A2', views: 30, created_at: now, updated_at: now });
    await db.insert('posts', { user_id: 2, title: 'B1', views: 5, created_at: now, updated_at: now });
  });

  afterAll(async () => {
    await db.close();
  });

  test('whereNotBetween', async () => {
    const rows = await User.query().whereNotBetween('age', [30, 40]).get();
    const names = rows.map(u => u.getAttribute('name')).sort();
    expect(names).toEqual(['Alice', 'Carol']);
  });

  test('orWhereIn / orWhereBetween / orWhereNull / orWhereNotNull', async () => {
    const r1 = await User.query().where('name', 'Alice').orWhereIn('name', ['Bob']).get();
    expect(r1.map(u => u.getAttribute('name')).sort()).toEqual(['Alice', 'Bob']);

    const r2 = await User.query().where('age', 25).orWhereBetween('age', [40, 50]).get();
    expect(r2.map(u => u.getAttribute('name')).sort()).toEqual(['Alice', 'Carol']);

    const r3 = await User.query().where('name', 'Alice').orWhereNotNull('name').get();
    expect(r3.length).toBe(3);

    const r4 = await User.query().where('name', 'Alice').orWhereNull('name').get();
    expect(r4.length).toBe(1);
  });

  test('orWhereNotIn / orWhereNotBetween', async () => {
    const r = await User.query().where('name', 'Zzz').orWhereNotIn('name', ['Bob', 'Carol']).get();
    expect(r.map(u => u.getAttribute('name'))).toEqual(['Alice']);

    const r2 = await User.query().where('name', 'Zzz').orWhereNotBetween('age', [30, 40]).get();
    expect(r2.map(u => u.getAttribute('name')).sort()).toEqual(['Alice', 'Carol']);
  });

  test('crossJoin', async () => {
    const rows = await db.select('users', {
      columns: ['users.id'],
      joins: [{ table: 'posts', type: 'cross' }],
      wheres: []
    });
    // 3 users x 3 posts
    expect(rows.length).toBe(9);
  });

  test('withSum / withAvg / withMin / withMax', async () => {
    const users = await User.query()
      .withSum('posts', 'views')
      .withAvg('posts', 'views')
      .withMin('posts', 'views')
      .withMax('posts', 'views')
      .orderBy('id')
      .get();
    const alice = users[0];
    expect(alice.getAttribute('posts_sum_views')).toBe(40);
    expect(Number(alice.getAttribute('posts_avg_views'))).toBe(20);
    expect(alice.getAttribute('posts_min_views')).toBe(10);
    expect(alice.getAttribute('posts_max_views')).toBe(30);
  });

  test('union / unionAll', async () => {
    const q1 = User.query().select('name').where('name', 'Alice');
    const q2 = User.query().select('name').where('name', 'Bob');
    const merged = await User.query().select('name').where('name', 'Carol').union(q1).union(q2).get();
    const names = merged.map(u => u.getAttribute('name')).sort();
    expect(names).toEqual(['Alice', 'Bob', 'Carol']);

    const q3 = User.query().select('name').where('name', 'Alice');
    const all = await User.query().select('name').where('name', 'Alice').unionAll(q3).get();
    expect(all.length).toBe(2);
  });

  test('doesntExist', async () => {
    expect(await User.query().where('name', 'Nobody').doesntExist()).toBe(true);
    expect(await User.query().where('name', 'Alice').doesntExist()).toBe(false);
  });

  test('insertGetId', async () => {
    const now = new Date().toISOString();
    const id = await User.query().insertGetId({ name: 'Dave', age: 50, created_at: now, updated_at: now });
    expect(typeof id === 'number' || typeof id === 'string').toBe(true);
    expect(Number(id)).toBeGreaterThan(0);
  });

  test('Model.findOr returns callback result when missing', async () => {
    const found = await User.findOr(1, () => 'fallback');
    expect(found.getAttribute('name')).toBe('Alice');

    const missing = await User.findOr(99999, () => 'fallback');
    expect(missing).toBe('fallback');
  });

  test('afterCommit fires on commit, not on rollback', async () => {
    let fired = 0;
    await db.transaction(async (conn) => {
      conn.afterCommit(() => { fired++; });
    });
    expect(fired).toBe(1);

    let fired2 = 0;
    try {
      await db.transaction(async (conn) => {
        conn.afterCommit(() => { fired2++; });
        throw new Error('boom');
      });
    } catch (e) { /* expected */ }
    expect(fired2).toBe(0);
  });

  test('Model.as(alias) emits FROM table AS alias and accepts qualified columns', async () => {
    const rows = await User.as('u').whereBetween('u.age', [30, 40]).orderBy('u.age').get();
    expect(rows.map(r => r.getAttribute('name'))).toEqual(['Bob']);

    const rows2 = await User.query().as('u').select('u.name').where('u.name', 'Alice').get();
    expect(rows2.map(r => r.getAttribute('name'))).toEqual(['Alice']);

    expect(() => User.as('bad alias')).toThrow();
  });

  test('Model.select().from() supports an explicit FROM source', async () => {
    const rows = await User.select()
      .from('users')
      .where('name', 'Alice')
      .where('age', '=', 25)
      .limit(1)
      .get();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toBeInstanceOf(User);
    expect(rows[0].getAttribute('name')).toBe('Alice');
  });
});

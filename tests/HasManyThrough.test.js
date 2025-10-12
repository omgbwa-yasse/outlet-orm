const DatabaseConnection = require('../src/DatabaseConnection');
const Model = require('../src/Model');

// Schema: users -> posts -> comments
// User hasMany Posts, Post hasMany Comments, User hasManyThrough Comments via Posts

describe('HasManyThrough Relation', () => {
  let db;

  class User extends Model {
    static table = 'users';
    posts() { return this.hasMany(Post, 'user_id'); }
    comments() { return this.hasManyThrough(Comment, Post, 'user_id', 'post_id'); }
  }

  class Post extends Model {
    static table = 'posts';
    comments() { return this.hasMany(Comment, 'post_id'); }
    author() { return this.belongsTo(User, 'user_id'); }
  }

  class Comment extends Model {
    static table = 'comments';
    post() { return this.belongsTo(Post, 'post_id'); }
  }

  beforeAll(async () => {
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();

    // Bind connection
    User.setConnection(db);
    Post.setConnection(db);
    Comment.setConnection(db);

    // Create tables
    await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, created_at TEXT, updated_at TEXT)');
    await db.execute('CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT, created_at TEXT, updated_at TEXT)');
    await db.execute('CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER, body TEXT, created_at TEXT, updated_at TEXT)');

    const now = new Date().toISOString();

    // Seed users
    await db.insert('users', { name: 'Alice', created_at: now, updated_at: now }); // id 1
    await db.insert('users', { name: 'Bob', created_at: now, updated_at: now });   // id 2

    // Seed posts
    await db.insert('posts', { user_id: 1, title: 'A1', created_at: now, updated_at: now }); // id 1
    await db.insert('posts', { user_id: 1, title: 'A2', created_at: now, updated_at: now }); // id 2
    await db.insert('posts', { user_id: 2, title: 'B1', created_at: now, updated_at: now }); // id 3

    // Seed comments
    await db.insert('comments', { post_id: 1, body: 'hello world', created_at: now, updated_at: now }); // id 1
    await db.insert('comments', { post_id: 1, body: 'second', created_at: now, updated_at: now });      // id 2
    await db.insert('comments', { post_id: 2, body: 'other', created_at: now, updated_at: now });       // id 3
    await db.insert('comments', { post_id: 3, body: 'bob-post', created_at: now, updated_at: now });    // id 4
  });

  afterAll(async () => {
    await db.close();
  });

  test('instance.get() returns comments across through posts', async () => {
    const alice = await User.find(1);
    const comments = await alice.comments().get();
    const bodies = comments.map(c => c.getAttribute('body')).sort();
    expect(bodies).toEqual(['hello world', 'other', 'second']);

    const bob = await User.find(2);
    const bobComments = await bob.comments().get();
    const bobBodies = bobComments.map(c => c.getAttribute('body'));
    expect(bobBodies).toEqual(['bob-post']);
  });

  test('eager loading with constraint filters related finals', async () => {
    const recentUsers = await User.with({ comments: qb => qb.whereLike('body', '%hello%') }).get();
    const alice = recentUsers.find(u => u.getAttribute('id') === 1);
    const bob = recentUsers.find(u => u.getAttribute('id') === 2);

    expect(alice.relations.comments.map(c => c.getAttribute('body'))).toEqual(['hello world']);
    expect(bob.relations.comments).toEqual([]);
  });

  test('eager loading without constraint returns all finals', async () => {
    const users = await User.with('comments').orderBy('id').get();
    const alice = users[0];
    const bob = users[1];

    expect(alice.relations.comments.length).toBe(3);
    expect(bob.relations.comments.length).toBe(1);
  });
});

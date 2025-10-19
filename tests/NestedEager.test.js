const DatabaseConnection = require('../src/DatabaseConnection');
const Model = require('../src/Model');

// Test nested eager loading
// Schema: users -> posts -> comments -> author (back to users)

describe('Nested Eager Loading', () => {
  let db;

  class User extends Model {
    static table = 'users';
    posts() { return this.hasMany(Post, 'user_id'); }
  }

  class Post extends Model {
    static table = 'posts';
    comments() { return this.hasMany(Comment, 'post_id'); }
    author() { return this.belongsTo(User, 'user_id'); }
  }

  class Comment extends Model {
    static table = 'comments';
    author() { return this.belongsTo(User, 'user_id'); }
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
    await db.execute('CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER, user_id INTEGER, body TEXT, created_at TEXT, updated_at TEXT)');

    const now = new Date().toISOString();

    // Seed users
    await db.insert('users', { name: 'Alice', created_at: now, updated_at: now }); // id 1
    await db.insert('users', { name: 'Bob', created_at: now, updated_at: now });   // id 2
    await db.insert('users', { name: 'Charlie', created_at: now, updated_at: now }); // id 3

    // Seed posts
    await db.insert('posts', { user_id: 1, title: 'Alice Post 1', created_at: now, updated_at: now }); // id 1
    await db.insert('posts', { user_id: 1, title: 'Alice Post 2', created_at: now, updated_at: now }); // id 2
    await db.insert('posts', { user_id: 2, title: 'Bob Post 1', created_at: now, updated_at: now });   // id 3

    // Seed comments
    await db.insert('comments', { post_id: 1, user_id: 2, body: 'Nice post Alice!', created_at: now, updated_at: now }); // id 1
    await db.insert('comments', { post_id: 1, user_id: 3, body: 'Agreed!', created_at: now, updated_at: now });         // id 2
    await db.insert('comments', { post_id: 2, user_id: 1, body: 'Self comment', created_at: now, updated_at: now });   // id 3
    await db.insert('comments', { post_id: 3, user_id: 1, body: 'Bob, great!', created_at: now, updated_at: now });    // id 4
  });

  afterAll(async () => {
    await db.close();
  });

  test('nested eager loading with posts.comments', async () => {
    const users = await User.with('posts.comments').orderBy('id').get();

    expect(users.length).toBe(3);

    const alice = users[0];
    const bob = users[1];
    const charlie = users[2];

    // Alice has 2 posts
    expect(alice.relations.posts.length).toBe(2);
    // Post 1 has 2 comments
    expect(alice.relations.posts[0].relations.comments.length).toBe(2);
    // Post 2 has 1 comment
    expect(alice.relations.posts[1].relations.comments.length).toBe(1);

    // Bob has 1 post with 1 comment
    expect(bob.relations.posts.length).toBe(1);
    expect(bob.relations.posts[0].relations.comments.length).toBe(1);

    // Charlie has no posts
    expect(charlie.relations.posts.length).toBe(0);
  });

  test('deep nested eager loading with posts.comments.author', async () => {
    const users = await User.with('posts.comments.author').orderBy('id').get();

    const alice = users[0];

    // Check that comments have authors loaded
    const comment1 = alice.relations.posts[0].relations.comments[0];
    expect(comment1.relations.author.getAttribute('name')).toBe('Bob');

    const comment2 = alice.relations.posts[0].relations.comments[1];
    expect(comment2.relations.author.getAttribute('name')).toBe('Charlie');
  });

  test('mixed relations: posts and posts.comments', async () => {
    const users = await User.with('posts', 'posts.comments').orderBy('id').get();

    const alice = users[0];

    expect(alice.relations.posts.length).toBe(2);
    expect(alice.relations.posts[0].relations.comments.length).toBe(2);
  });
});

const DatabaseConnection = require('../src/DatabaseConnection');
const Model = require('../src/Model');

// Test polymorphic relations
// Schema: posts/videos have morphMany comments, comments morphTo commentable

describe('Polymorphic Relations', () => {
  let db;

  class Post extends Model {
    static table = 'posts';
    comments() { return this.morphMany(Comment, 'commentable'); }
  }

  class Video extends Model {
    static table = 'videos';
    comments() { return this.morphMany(Comment, 'commentable'); }
  }

  class Comment extends Model {
    static table = 'comments';
    commentable() { return this.morphTo('commentable'); }
  }

  beforeAll(async () => {
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();

    // Bind connection
    Post.setConnection(db);
    Video.setConnection(db);
    Comment.setConnection(db);

    // Set morph map
    Model.setMorphMap({
      'posts': Post,
      'videos': Video
    });

    // Create tables
    await db.execute('CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)');
    await db.execute('CREATE TABLE videos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT)');
    await db.execute('CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, commentable_type TEXT, commentable_id INTEGER, body TEXT)');

    // Seed data
    await db.insert('posts', { title: 'First Post' }); // id 1
    await db.insert('videos', { title: 'First Video' }); // id 1

    await db.insert('comments', { commentable_type: 'posts', commentable_id: 1, body: 'Post comment' }); // id 1
    await db.insert('comments', { commentable_type: 'videos', commentable_id: 1, body: 'Video comment' }); // id 2
  });

  afterAll(async () => {
    await db.close();
  });

  test('morphTo get() returns correct related model', async () => {
    const comment = await Comment.find(1);
    const post = await comment.commentable().get();
    expect(post.getAttribute('title')).toBe('First Post');

    const comment2 = await Comment.find(2);
    const video = await comment2.commentable().get();
    expect(video.getAttribute('title')).toBe('First Video');
  });

  test('morphMany get() returns comments for post', async () => {
    const post = await Post.find(1);
    const comments = await post.comments().get();
    expect(comments.length).toBe(1);
    expect(comments[0].getAttribute('body')).toBe('Post comment');
  });

  test('morphMany get() returns comments for video', async () => {
    const video = await Video.find(1);
    const comments = await video.comments().get();
    expect(comments.length).toBe(1);
    expect(comments[0].getAttribute('body')).toBe('Video comment');
  });

  test('eager loading morphTo', async () => {
    const comments = await Comment.with('commentable').get();
    expect(comments.length).toBe(2);

    const postComment = comments.find(c => c.getAttribute('id') === 1);
    expect(postComment.relations.commentable.getAttribute('title')).toBe('First Post');

    const videoComment = comments.find(c => c.getAttribute('id') === 2);
    expect(videoComment.relations.commentable.getAttribute('title')).toBe('First Video');
  });

  test('eager loading morphMany', async () => {
    const posts = await Post.with('comments').get();
    expect(posts.length).toBe(1);
    expect(posts[0].relations.comments.length).toBe(1);
    expect(posts[0].relations.comments[0].getAttribute('body')).toBe('Post comment');
  });
});

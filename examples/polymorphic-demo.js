import DatabaseConnection from '../src/DatabaseConnection.js';
import Model from '../src/Model.js';

// Demo script for polymorphic relations
// Schema: posts/videos have morphMany comments, comments morphTo commentable

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

async function demo() {
  const db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
  await db.connect();

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

  console.log('=== Polymorphic Relations Demo ===');

  // Get comments with their commentable
  const comments = await Comment.with('commentable').get();

  for (const comment of comments) {
    const type = comment.getAttribute('commentable_type');
    const related = comment.relations.commentable;
    console.log(`Comment: "${comment.getAttribute('body')}" on ${type} "${related.getAttribute('title')}"`);
  }

  // Get posts with comments
  const posts = await Post.with('comments').get();
  console.log(`\nPost "${posts[0].getAttribute('title')}" has ${posts[0].relations.comments.length} comment(s)`);

  // Get videos with comments
  const videos = await Video.with('comments').get();
  console.log(`Video "${videos[0].getAttribute('title')}" has ${videos[0].relations.comments.length} comment(s)`);

  await db.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await demo();
}

export { Post, Video, Comment };

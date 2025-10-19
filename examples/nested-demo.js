const DatabaseConnection = require('../src/DatabaseConnection');
const Model = require('../src/Model');

// Demo script for nested eager loading
// Schema: users -> posts -> comments

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
}

async function demo() {
  const db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
  await db.connect();

  User.setConnection(db);
  Post.setConnection(db);
  Comment.setConnection(db);

  // Create tables
  await db.execute('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)');
  await db.execute('CREATE TABLE posts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, title TEXT)');
  await db.execute('CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER, user_id INTEGER, body TEXT)');

  // Seed data
  await db.insert('users', { name: 'Alice' }); // id 1
  await db.insert('users', { name: 'Bob' });   // id 2

  await db.insert('posts', { user_id: 1, title: 'Alice Post' }); // id 1

  await db.insert('comments', { post_id: 1, user_id: 2, body: 'Nice!' }); // id 1

  // Eager load nested relations
  const users = await User.with('posts.comments').get();

  console.log('Users with nested posts.comments:');
  users.forEach(user => {
    console.log(`User: ${user.getAttribute('name')}`);
    user.relations.posts.forEach(post => {
      console.log(`  Post: ${post.getAttribute('title')}`);
      post.relations.comments.forEach(comment => {
        console.log(`    Comment: ${comment.getAttribute('body')} by ${comment.relations.author ? comment.relations.author.getAttribute('name') : 'Unknown'}`);
      });
    });
  });

  // For deeper nesting
  const usersDeep = await User.with('posts.comments.author').get();

  console.log('\nUsers with posts.comments.author:');
  usersDeep.forEach(user => {
    console.log(`User: ${user.getAttribute('name')}`);
    user.relations.posts.forEach(post => {
      console.log(`  Post: ${post.getAttribute('title')}`);
      post.relations.comments.forEach(comment => {
        console.log(`    Comment: ${comment.getAttribute('body')} by ${comment.relations.author.getAttribute('name')}`);
      });
    });
  });

  await db.close();
}

if (require.main === module) {
  demo().catch(console.error);
}

module.exports = { User, Post, Comment };

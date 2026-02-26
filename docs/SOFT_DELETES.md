# 🗑️ Soft Deletes

Soft delete allows records to be marked as "deleted" without actually deleting them from the database.

> 📁 **Configuration**: In`models/`+ migration in`database/migrations/`— See [Project structure](INSTALLATION.md#structure-de-projet-recommended)

## Principle

Instead of deleting a row, update a column`deleted_at`with the deletion date. Normal queries automatically exclude these records.

## Configuration

### 1. Table migration

Add a column`deleted_at`nullable :

```javascript
// Migration
module.exports = {
  up: async (schema) => {
    await schema.createTable('posts', (table) => {
      table.id();
      table.string('title');
      table.text('content');
      table.integer('user_id');
      table.timestamps();
      table.timestamp('deleted_at').nullable(); // For soft deletes
    });
  }
};
```

Or add it to an existing table:

```sql
ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMP NULL;
```

### 2. Activate in template

```javascript
const { Model } = require('outlet-orm');

class Post extends Model {
  static table = 'posts';
  static softDeletes = true;  // Activer soft deletes
}
```

## Usage

### Delete (soft delete)

```javascript
const post = await Post.find(1);
await post.destroy();

// The row is NOT deleted
// deleted_at is set to the current date/time
```

### Automatic queries

By default, deleted records are **excluded**:

```javascript
// Does NOT include deleted posts
const posts = await Post.all();
const posts = await Post.where('user_id', 1).get();
const post = await Post.find(1); // null if deleted
```

### Include deleted

```javascript
// Include the deleted ones with the others
const allPosts = await Post.withTrashed().get();

// Include for a specific search
const post = await Post.withTrashed().find(1);
```

### Only deleted ones

```javascript
// Get only deleted records
const deletedPosts = await Post.onlyTrashed().get();

// With conditions
const myDeletedPosts = await Post
  .onlyTrashed()
  .where('user_id', 1)
  .get();
```

### Restore a recording

```javascript
// Restore a deleted recording
const post = await Post.withTrashed().find(1);
await post.restore();

// deleted_at redevient NULL
```

### Permanent deletion

```javascript
// Delete permanently (even with soft deletes enabled)
const post = await Post.withTrashed().find(1);
await post.forceDelete();

// The line is really deleted from the base
```

## Check status

```javascript
const post = await Post.withTrashed().find(1);

// Check if deleted
if (post.getAttribute('deleted_at')) {
  console.log('This post is deleted');
}
```

## Practical examples

### Trash

```javascript
class TrashController {
  // List of deleted items
  async index() {
    const trashedPosts = await Post.onlyTrashed()
      .orderBy('deleted_at', 'desc')
      .get();
    return trashedPosts;
  }

  // Restore an item
  async restore(id) {
    const post = await Post.withTrashed().find(id);
    if (!post) throw new Error('Post not found');
    await post.restore();
    return post;
  }

  // Empty the trash
  async empty() {
    const trashed = await Post.onlyTrashed().get();
    for (const post of trashed) {
      await post.forceDelete();
    }
  }

  // Permanently delete an item
  async destroy(id) {
    const post = await Post.withTrashed().find(id);
    if (!post) throw new Error('Post not found');
    await post.forceDelete();
  }
}
```

### Cascade deletion

```javascript
const { Model } = require('outlet-orm');

// Definition of models
class Post extends Model {
  static table = 'posts';
  static softDeletes = true;
}

class User extends Model {
  static table = 'users';
  static softDeletes = true;

  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

// Delete a user and their posts
async function softDeleteUserWithPosts(userId) {
  const user = await User.find(userId);
  
  // Soft delete posts
  await Post.where('user_id', userId).update({
    deleted_at: new Date().toISOString()
  });
  
  // Soft delete user
  await user.destroy();
}

// Restore a user and their posts
async function restoreUserWithPosts(userId) {
  const user = await User.withTrashed().find(userId);
  await user.restore();
  
  await Post.onlyTrashed()
    .where('user_id', userId)
    .update({ deleted_at: null });
}
```

### Automatic cleaning

```javascript
// Permanently delete items older than 30 days
async function cleanupOldTrashed() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const oldTrashed = await Post
    .onlyTrashed()
    .where('deleted_at', '<', thirtyDaysAgo.toISOString())
    .get();

  for (const post of oldTrashed) {
    await post.forceDelete();
  }

  console.log(`${oldTrashed.length} posts définitivement deleteds`);
}
```

## With relationships

### Eager loading et soft deletes

```javascript
// Relations also respect soft delete
const user = await User.with('posts').find(1);
// user.posts does NOT include deleted posts

// To include deleted posts
const user = await User.find(1);
const allPosts = await Post.withTrashed().where('user_id', user.getAttribute('id')).get();
```

## Events with Soft Deletes

The events are triggered normally:

```javascript
class Post extends Model {
  static softDeletes = true;

  static boot() {
    // Triggered during soft delete
    this.deleting((post) => {
      console.log('Post being soft deleted:', post.getAttribute('id'));
    });

    this.deleted((post) => {
      console.log('Post soft deleted:', post.getAttribute('id'));
    });

    // Triggered during restore
    this.restoring((post) => {
      console.log('Post being restored:', post.getAttribute('id'));
    });

    this.restored((post) => {
      console.log('Post restored:', post.getAttribute('id'));
    });
  }
}
```

## Best practices

### 1. Index the deleted_at column

```sql
CREATE INDEX idx_posts_deleted_at ON posts(deleted_at);
```

### 2. Use for important data

```javascript
// ✅ Good use - Important data
class Invoice extends Model {
  static softDeletes = true;
}

// ❌ Not necessary - Temporary data
class Session extends Model {
  static softDeletes = false;
}
```

### 3. Clean regularly

```javascript
// Cron job ou scheduled task
await cleanupOldTrashed();
```

### 4. Consider foreign keys

```javascript
// Remove children before parent
await Comment.where('post_id', postId).delete();
await post.destroy();
```

## Full API

| Method | Description |
|---------|-------------|
|`destroy()`| Soft delete (met deleted_at) |
|`restore()`| Restore (reset deleted_at to null) |
|`forceDelete()`| Permanent deletion |
|`withTrashed()`| Include deleted in query |
|`onlyTrashed()`| Return only deleted |

## Next steps

- [Scopes](SCOPES.md) - Reusable queries
- [Events](EVENTS.md) - Hooks on the life cycle
- [Transactions](TRANSACTIONS.md) - Atomic operations

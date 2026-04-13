# Outlet ORM - Advanced Features

[← Back to Index](SKILL.md) | [Previous: Migrations](MIGRATIONS.md) | [Next: Security →](SECURITY.md)

> 📘 **TypeScript** : Use`ModelEventName`for events,`ValidationRule`for validation. See [TYPESCRIPT.md](TYPESCRIPT.md)

---

## Transactions

### Automatic Transaction (Recommended)

```javascript
const { Model } = require('outlet-orm');

const db = Model.getConnection();

const result = await db.transaction(async (connection) => {
  const user = await User.create({ 
    name: 'John', 
    email: 'john@example.com' 
  });
  
  await Account.create({ 
    user_id: user.id, 
    balance: 0 
  });
  
  await UserSettings.create({ 
    user_id: user.id 
  });
  
  return user;
});
// Auto-commit on success, auto-rollback on error
```

### Manual Transaction

```javascript
const db = Model.getConnection();

await db.beginTransaction();

try {
  await User.create({ name: 'Jane' });
  await Profile.create({ user_id: 1 });
  await db.commit();
} catch (error) {
  await db.rollback();
  throw error;
}
```

### Best Practices

- Keep transactions short to avoid locks
- Use automatic transactions when possible
- Always handle errors properly

---

## Fluent Builder API — DB Objects (v11.4.0)

Use `useSchema(schema)` to bind all five DB-object builders to a schema (connection prefix) at once. Full reference: [DATABASE_OBJECTS.md](../../docs/DATABASE_OBJECTS.md).

### Bind all builders to a schema

```javascript
const { useSchema } = require('outlet-orm');
const { View, Trigger, Procedure, Function, Transaction } = useSchema('app');
// or use harmonised Schema* names:
const {
  SchemaView, SchemaTrigger, SchemaProcedure,
  SchemaFunction, SchemaTransaction
} = useSchema('app');
```

### Per-class `.use()` pattern

Every builder exposes a static `.use(schema)` shorthand:

```javascript
const { SchemaView, SchemaTrigger, SchemaProcedure } = require('outlet-orm');

const View       = SchemaView.use('dbo');
const Trigger    = SchemaTrigger.use('dbo');
const Procedure  = SchemaProcedure.use('dbo');
```

### Quick reference

| Builder | Short alias | Purpose |
|---|---|---|
| `SchemaView` | `View` | `CREATE / DROP VIEW` |
| `SchemaTrigger` | `Trigger` | `CREATE / DROP TRIGGER` |
| `SchemaProcedure` | `Procedure` | `CREATE / DROP PROCEDURE` |
| `SchemaFunction` | `Function` | `CREATE / DROP FUNCTION` |
| `SchemaTransaction` | `Transaction` | `BEGIN / COMMIT / ROLLBACK / SAVEPOINT` |

> **Note**: Short names (`View`, `Trigger`, etc.) are backward-compatible aliases exported alongside the full `Schema*` names. `DBFunction` has been removed — use `SchemaFunction` or `Function` instead.

---

## Soft Deletes

### Enable Soft Deletes

```javascript
class Post extends Model {
  static table = 'posts';
  static softDeletes = true;
  // static DELETED_AT = 'deleted_at'; // Custom column name
}
```

### Basic Operations

```javascript
// Regular queries exclude deleted records
const posts = await Post.all(); // Only non-deleted

// Soft delete
const post = await Post.find(1);
await post.destroy(); // Sets deleted_at

// Check if soft deleted
if (post.trashed()) {
  console.log('Post is soft deleted');
}

// Restore
await post.restore();

// Permanent delete
await post.forceDelete();
```

### Query Modifiers

```javascript
// Include deleted records
const allPosts = await Post.withTrashed().get();

// Only deleted records
const trashedPosts = await Post.onlyTrashed().get();

// With conditions
const deletedByUser = await Post
  .onlyTrashed()
  .where('user_id', 1)
  .get();
```

---

## Scopes

### Global Scopes

Applied automatically to all queries.

```javascript
class Post extends Model {
  static table = 'posts';
}

// Add global scope
Post.addGlobalScope('published', (query) => {
  query.where('status', 'published');
});

// All queries filter automatically
const posts = await Post.all(); // Only published

// Disable scope temporarily
const allPosts = await Post.withoutGlobalScope('published').get();

// Disable all scopes
const rawPosts = await Post.withoutGlobalScopes().get();
```

### Remove Global Scope

```javascript
Post.removeGlobalScope('published');
```

### Common Use Cases

```javascript
// Active records only
User.addGlobalScope('active', (q) => q.where('is_active', true));

// Non-deleted (without soft deletes)
Log.addGlobalScope('recent', (q) => q.where('created_at', '>', '2024-01-01'));

// Tenant isolation
Model.addGlobalScope('tenant', (q) => q.where('tenant_id', currentTenantId));
```

### Local Scopes (v11.0.0)

Define reusable query constraints as static `scopeXxx` methods. They become fluent methods on the QueryBuilder:

```javascript
class User extends Model {
  static table = 'users';

  static scopeActive(query) {
    return query.where('status', 'active');
  }

  static scopeRole(query, role) {
    return query.where('role', role);
  }

  static scopeRecent(query, days = 7) {
    const date = new Date(Date.now() - days * 86400000).toISOString();
    return query.where('created_at', '>', date);
  }
}

// Fluent usage — scopes become methods on the query builder
const users = await User.query().active().role('admin').recent(30).get();
const count = await User.query().active().count();
```

> **Note**: The legacy `static scopes = {}` and `.scope('name')` syntax still works. Fluent local scopes are the recommended approach from v11.

---

## Events / Hooks

### Available Events

| Event | Trigger |
|-------|---------|
|`creating`| Before insert |
|`created`| After insert |
|`updating`| Before update |
|`updated`| After update |
|`saving`| Before insert OR update |
|`saved`| After insert OR update |
|`deleting`| Before delete |
|`deleted`| After delete |
|`restoring`| Before restore (soft delete) |
|`restored`| After restore (soft delete) |

### Register Event Handlers

```javascript
class User extends Model {
  static table = 'users';
}

// Before creation
User.creating((user) => {
  user.uuid = generateUUID();
  // Return false to cancel the operation
});

// After creation
User.created((user) => {
  console.log(`User ${user.id} created`);
  // Send welcome email
});

// Before update
User.updating((user) => {
  user.updated_at = new Date();
});

// After update
User.updated((user) => {
  // Invalidate cache
  cache.forget(`user:${user.id}`);
});

// Saving (create AND update)
User.saving((user) => {
  // Sanitize data
  const email = user.email;
  user.email = email.toLowerCase().trim();
});

User.saved((user) => {
  // Log activity
});

// Before delete
User.deleting((user) => {
  // Check permissions
  if (user.is_admin) {
    return false; // Cancel deletion
  }
});

// After delete
User.deleted((user) => {
  // Cleanup related data
});

// Soft delete events
User.restoring((user) => {});
User.restored((user) => {});
```

### Generic Event Registration

```javascript
User.on('created', (user) => {
  console.log('User created');
});

User.on('updated', (user) => {
  console.log('User updated');
});
```

---

## Validation

### Define Rules

```javascript
class User extends Model {
  static table = 'users';
  
  static rules = {
    name: 'required|string|min:2|max:100',
    email: 'required|email',
    age: 'numeric|min:0|max:150',
    role: 'in:admin,user,guest',
    password: 'required|min:8',
    website: 'regex:^https?://'
  };
}
```

### Available Rules

| Rule | Description |
|------|-------------|
|`required`| Field is required |
|`string`| Must be a string |
|`number`/`numeric`| Must be a number |
|`email`| Valid email format |
|`boolean`| Must be boolean |
|`date`| Valid date |
|`min:N`| Minimum N (length or value) |
|`max:N`| Maximum N (length or value) |
|`in:a,b,c`| Value in list |
|`regex:pattern`| Match regex pattern |

### Validate

```javascript
const user = new User({
  name: 'J',
  email: 'invalid-email',
  age: 200
});

// Get validation result
const { valid, errors } = user.validate();

console.log(valid); // false
console.log(errors);
// {
//   name: ['name must be at least 2 characters'],
//   email: ['email must be a valid email'],
//   age: ['age must not exceed 150']
// }
```

### Validate or Throw

```javascript
try {
  user.validateOrFail();
} catch (error) {
  console.log(error.errors);
}
```

### Validate Before Save

```javascript
const user = new User({ name: 'John', email: 'john@example.com' });

const { valid, errors } = user.validate();
if (valid) {
  await user.save();
} else {
  console.log('Validation failed:', errors);
}

// Or with exception
try {
  user.validateOrFail();
  await user.save();
} catch (error) {
  res.status(400).json({ errors: error.errors });
}
```

---

## Query Logging

### Enable Logging

```javascript
const { Model } = require('outlet-orm');

const db = Model.getConnection();
db.enableQueryLog();
```

### Execute Queries

```javascript
await User.where('status', 'active').get();
await Post.with('author').get();
```

### Get Query Log

```javascript
const queries = db.getQueryLog();

console.log(queries);
// [
//   {
//     sql: 'SELECT * FROM users WHERE status = ?',
//     params: ['active'],
//     duration: 15,
//     timestamp: Date
//   },
//   {
//     sql: 'SELECT * FROM posts',
//     params: [],
//     duration: 8,
//     timestamp: Date
//   }
// ]
```

### Clear and Disable

```javascript
// Clear log
db.flushQueryLog();

// Disable logging
db.disableQueryLog();

// Check if logging
if (db.isLogging()) {
  console.log('Query logging is enabled');
}
```

---

## Best Practices

### 1. Use Eager Loading

```javascript
// ❌ Bad: N+1 queries
const users = await User.all();
for (const user of users) {
  const posts = await user.posts().get(); // Query per user!
}

// ✅ Good: 2 queries total
const users = await User.with('posts').get();
```

### 2. Define Fillable

```javascript
class User extends Model {
  static fillable = ['name', 'email'];
}

// 'role' ignored - protected from mass assignment
const user = await User.create({
  name: 'John',
  role: 'admin'  // Ignored!
});
```

### 3. Hide Sensitive Data

```javascript
class User extends Model {
  static hidden = ['password', 'api_token'];
}

user.toJSON(); // password excluded
```

### 4. Use Type Casts

```javascript
class User extends Model {
  static casts = {
    id: 'int',
    is_active: 'boolean',
    settings: 'json'
  };
}
```

### 5. Implement down() in Migrations

```javascript
async down() {
  // Always reversible
  await schema.dropIfExists('users');
}
```

### 6. Use Transactions for Multi-Table Operations

```javascript
await db.transaction(async () => {
  await User.create({ name: 'John' });
  await Profile.create({ user_id: 1 });
  await Account.create({ user_id: 1 });
});
```

### 7. Close Connections

```javascript
const db = new DatabaseConnection(config);
// ... use connection ...
await db.close();
```

### 8. Validate Input

```javascript
const user = new User(req.body);

try {
  user.validateOrFail();
  await user.save();
} catch (error) {
  res.status(400).json({ errors: error.errors });
}
```

---

## Complete Example: Blog Service

```javascript
const { Model } = require('outlet-orm');

// Models
class User extends Model {
  static table = 'users';
  static softDeletes = true;
  static hidden = ['password'];
  static rules = { email: 'required|email', password: 'required|min:8' };
  static casts = { id: 'int', is_admin: 'boolean' };
  
  posts() { return this.hasMany(Post, 'user_id'); }
  profile() { return this.hasOne(Profile, 'user_id'); }
}

class Post extends Model {
  static table = 'posts';
  static softDeletes = true;
  static fillable = ['title', 'content', 'status'];
  static casts = { views: 'int' };
  
  author() { return this.belongsTo(User, 'user_id'); }
  tags() { return this.belongsToMany(Tag, 'post_tag', 'post_id', 'tag_id'); }
}

// Global scope: only published
Post.addGlobalScope('published', (q) => q.where('status', 'published'));

// Events
User.created(async (user) => {
  await Profile.create({ user_id: user.id });
});

Post.creating((post) => {
  post.slug = slugify(post.title);
});

// Service
class BlogService {
  async createPost(userId, data, tagIds) {
    const db = Model.getConnection();
    
    return db.transaction(async () => {
      const post = new Post({
        ...data,
        user_id: userId
      });
      
      post.validateOrFail();
      await post.save();
      
      if (tagIds?.length) {
        await post.tags().attach(tagIds);
      }
      
      await post.load('author', 'tags');
      return post;
    });
  }
  
  async getPublishedPosts(page = 1) {
    return Post
      .with('author.profile', 'tags')
      .orderBy('created_at', 'desc')
      .paginate(page, 15);
  }
  
  async getAuthorPosts(userId) {
    return Post
      .withoutGlobalScope('published')
      .where('user_id', userId)
      .with('tags')
      .orderBy('created_at', 'desc')
      .get();
  }
}
```

---

## Next Steps

- [API Reference →](API.md)
- [Back to Index →](SKILL.md)

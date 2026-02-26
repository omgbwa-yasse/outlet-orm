# Outlet ORM

[![npm version](https://badge.fury.io/js/outlet-orm.svg)](https://www.npmjs.com/package/outlet-orm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A JavaScript ORM inspired by Laravel Eloquent for Node.js with support for MySQL, PostgreSQL and SQLite.

📚 **[Complete documentation available in `/docs`](./docs/INDEX.md)**

## ✅ Prerequisites and compatibility

- Node.js >= 18 (recommended/required)
- Install the database driver corresponding to your DBMS (see below)

## 🚀 Installation

```bash
npm install outlet-orm
```

### Install the database driver

Outlet ORM uses optional peer dependencies for database drivers. Install only the driver you need:

- MySQL/MariaDB: `npm install mysql2`
- PostgreSQL: `npm install pg`
- SQLite: `npm install sqlite3`

If no driver is installed, an explicit error message will tell you which one to install when connecting.

## 📁 Recommended Project Structure

Organise your project using Outlet ORM with a **2-layer architecture** — Controllers call Models directly, keeping the codebase lean and productive:

> 🔐 **Security**: See the [Security Guide](./docs/SECURITY.md) for best practices.

```
my-project/
├── .env                          # ⚠️ NEVER committed (in .gitignore)
├── .env.example                  # Template without secrets
├── .gitignore
├── package.json
│
├── src/                          # 📦 Centralised source code
│   ├── index.js                  # Application entry point
│   │
│   ├── config/                   # ⚙️ Configuration
│   │   ├── app.js                # General config (port, env)
│   │   ├── database.js           # DB config (reads .env)
│   │   └── security.js           # CORS, helmet, rate limit
│   │
│   ├── models/                   # 📊 outlet-orm Models (entities)
│   │   ├── index.js              # Centralised model exports
│   │   ├── User.js
│   │   ├── Post.js
│   │   └── Comment.js
│   │
│   ├── controllers/              # 🎮 HTTP handling + business logic (direct ORM calls)
│   │   ├── AuthController.js
│   │   ├── UserController.js
│   │   └── PostController.js
│   │
│   ├── routes/                   # 🛤️ Route definitions
│   │   ├── index.js              # Route aggregator
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   └── post.routes.js
│   │
│   ├── middlewares/              # 🔒 Middlewares
│   │   ├── auth.js               # JWT verification
│   │   ├── authorize.js          # RBAC / permissions
│   │   ├── rateLimiter.js        # Protection DDoS
│   │   ├── validator.js          # Validation request body
│   │   └── errorHandler.js       # Centralised error handling
│   │
│   ├── validators/               # ✅ Validation schemas
│   │   ├── authValidator.js
│   │   └── userValidator.js
│   │
│   └── utils/                    # 🔧 Utilities
│       ├── hash.js               # bcrypt wrapper
│       ├── token.js              # JWT helpers
│       ├── logger.js             # Winston/Pino config
│       └── response.js           # API response formatting
│
├── database/
│   ├── config.js                 # Config migrations (outlet-init)
│   ├── migrations/               # Migration files
│   └── seeds/                    # Test/demo data
│       └── UserSeeder.js
│
├── public/                       # ✅ Public static files
│   ├── images/
│   ├── css/
│   └── js/
│
├── uploads/                      # ⚠️ Uploaded files
│
├── logs/                         # 📋 Logs (not versioned)
│
└── tests/                        # 🧪 Tests
    ├── unit/                     # Unit tests (models)
    ├── integration/              # Integration tests (API)
    │   └── api/
    └── fixtures/                 # Test data
        └── users.json
```

### 🏗️ Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      HTTP Request                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  MIDDLEWARES: auth → validate → rateLimiter → errorHandler │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  ROUTES → CONTROLLERS  HTTP handling + business logic       │
│                        Direct outlet-orm Model calls        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  MODELS (outlet-orm) → DATABASE                             │
└─────────────────────────────────────────────────────────────┘
```

### 📋 Role of each layer

| Layer | Folder | Responsibility | Security |
|--------|---------|----------------|----------|
| **Controllers** | `controllers/` | Handle HTTP, call ORM models, return responses | Input validation, ownership checks |
| **Models** | `models/` | Entity definition, relationships, validations | `fillable`, `hidden`, rules |
| **Middlewares** | `middlewares/` | Auth, rate limiting, error handling | 🔒 Critical |

### ✅ Benefits of this architecture

- **Simplicity**: Less files, less abstraction, faster to navigate
- **Productivity**: Outlet ORM's expressive API handles data access directly
- **Testability**: Integration tests with SQLite in-memory cover full request flows
- **Flexibility**: Add a `services/` or `repositories/` layer later if complexity grows

### 📝 Example workflow

```javascript
// routes/user.routes.js
router.get('/users/:id', auth, UserController.show);

// controllers/UserController.js
async show(req, res) {
  const user = await User.with('posts').find(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  res.json({ data: user });
}

async store(req, res) {
  const existing = await User.where('email', req.body.email).first();
  if (existing) return res.status(409).json({ message: 'Email already in use' });

  const data = { ...req.body };
  data.password = await bcrypt.hash(data.password, 10);

  const user = await User.create(data);
  res.status(201).json({ success: true, data: user });
}
```

## ✨ Key features

- **Eloquent-inspired API** (Active Record) for a fluent developer experience
- **Expressive Query Builder**: where/joins/order/limit/offset/paginate
- **Laravel-style relationship filters**: `whereHas()`, `has()`, `whereDoesntHave()`, `withCount()`
- **Eager Loading** of relationships via `.with(...)` with constraints and dot-notation
- **Complete relations**:
  - `hasOne`, `hasMany`, `belongsTo`, `belongsToMany` (with attach/detach/sync)
  - `hasManyThrough`, `hasOneThrough` (transitive relationships)
  - `morphOne`, `morphMany`, `morphTo` (polymorphic relationships)
- **Complete Transactions**: `beginTransaction()`, `commit()`, `rollback()`, `transaction()`
- **Soft Deletes**: soft deletion with `deleted_at`, `withTrashed()`, `onlyTrashed()`, `restore()`
- **Scopes**: global and local, to reuse your query filters
- **Events/Hooks**: `creating`, `created`, `updating`, `updated`, `deleting`, `deleted`, etc.
- **Validation**: built-in basic rules (`required`, `email`, `min`, `max`, etc.)
- **Query Logging**: debug mode with `enableQueryLog()` and `getQueryLog()`
- **PostgreSQL Pool**: pooled connections for better performance
- **SQL Protection**: automatic sanitisation of identifiers
- **Automatic Casts** (int, float, boolean, json, date...)
- **Hidden attributes** (`hidden`) and automatic timestamps
- **Visibility control** of hidden attributes: `withHidden()` and `withoutHidden()`
- **Atomic increment/decrement**: `increment()` and `decrement()`
- **Ergonomic aliases**: `columns([...])`, `ordrer()` (typo alias for `orderBy`)
- **Raw queries**: `executeRawQuery()` and `execute()` (native driver results)
- **Complete Migrations** (create/alter/drop, index, foreign keys, batch tracking)
- **Handy CLI tools**: `outlet-init`, `outlet-migrate`, `outlet-convert`
- **`.env` configuration** (loaded automatically)
- **Multi-database**: MySQL, PostgreSQL, and SQLite
- **Complete TypeScript types** with Generic Model and typed Schema Builder (v4.0.0+)

## ⚡ Quick Start

### Project Initialisation

```bash
# Create initial configuration
outlet-init

# Create a migration
outlet-migrate make create_users_table

# Run migrations
outlet-migrate migrate
```

### 🌱 Quick Seeding

```bash
# Create a seeder
outlet-migrate make:seed UserSeeder

# Run seeders (DatabaseSeeder runs first)
outlet-migrate seed

# Run a specific seeder
outlet-migrate seed --class UserSeeder
```

## 📖 Usage

### Connection configuration

Outlet ORM automatically loads the connection from the `.env` file. **No need to import DatabaseConnection!**

#### `.env` file

```env
DB_DRIVER=mysql
DB_HOST=localhost
DB_DATABASE=myapp
DB_USER=root
DB_PASSWORD=secret
DB_PORT=3306
```

#### Simplified usage

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
}

// That's it! The connection is automatic
const users = await User.all();
```

#### Manual configuration (optional)

If you need to control the connection :

```javascript
const { DatabaseConnection, Model } = require('outlet-orm');

// Option 1 – via .env (no parameters required)
const db = new DatabaseConnection();

// Option 2 – via configuration object
const db = new DatabaseConnection({
  driver: 'mysql',
  host: 'localhost',
  database: 'myapp',
  user: 'root',
  password: 'secret',
  port: 3306
});

// Set the connection manually (optional)
Model.setConnection(db);
```

#### Environment variables (.env)

| Variable | Description | Default |
|----------|-------------|------------|
| `DB_DRIVER` | `mysql`, `postgres`, `sqlite` | `mysql` |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Connection port | Driver default |
| `DB_USER` / `DB_USERNAME` | Username | - |
| `DB_PASSWORD` | Password | - |
| `DB_DATABASE` / `DB_NAME` | Database name | - |
| `DB_FILE` / `SQLITE_DB` | SQLite file | `:memory:` |

### Importation

```javascript
// CommonJS - Simple import (automatic connection via .env)
const { Model } = require('outlet-orm');

// ES Modules
import { Model } from 'outlet-orm';

// If you need manual control over the connection
const { DatabaseConnection, Model } = require('outlet-orm');
```

### Define a model

```javascript
const { Model } = require('outlet-orm');

// Define related models (see Relationships)
class Post extends Model { static table = 'posts'; }
class Profile extends Model { static table = 'profiles'; }

class User extends Model {
  static table = 'users';
  static primaryKey = 'id';           // Default: 'id'
  static timestamps = true;           // Default: true
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password'];
  static casts = {
    id: 'int',
    email_verified: 'boolean',
    metadata: 'json',
    birthday: 'date'
  };

  // Relations
  posts() {
    return this.hasMany(Post, 'user_id');
  }

  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}
```

### CRUD operations

#### Create

```javascript
// Method 1: create()
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secret123'
});

// Method 2: new + save()
const user = new User({
  name: 'Jane Doe',
  email: 'jane@example.com'
});
user.setAttribute('password', 'secret456');
await user.save();

// Raw insert (without creating an instance)
await User.insert({ name: 'Bob', email: 'bob@example.com' });
```

#### Read

```javascript
// All records
const users = await User.all();

// By ID
const user = await User.find(1);
const user = await User.findOrFail(1); // Throws an error if not found

// First result
const firstUser = await User.first();

// With conditions
const activeUsers = await User
  .where('status', 'active')
  .where('age', '>', 18)
  .get();

// With relationships (Eager Loading)
const usersWithPosts = await User
  .with('posts', 'profile')
  .get();

// Ordonner et limiter
const recentUsers = await User
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();
```

#### Update

```javascript
// Instance
const user = await User.find(1);
user.setAttribute('name', 'Updated Name');
await user.save();

// Bulk update
await User
  .where('status', 'pending')
  .update({ status: 'active' });

// Update + Fetch (comme Prisma)
const updated = await User
  .where('id', 1)
  .updateAndFetch({ name: 'Neo' }, ['profile', 'posts']);

// Helpers by ID
const user = await User.updateAndFetchById(1, { name: 'Trinity' }, ['profile']);
await User.updateById(2, { status: 'active' });
```

#### Delete

```javascript
// Instance
const user = await User.find(1);
await user.destroy();

// Bulk delete
await User
  .where('status', 'banned')
  .delete();
```

### Query Builder

```javascript
// Where clauses
const users = await User
  .where('age', '>', 18)
  .where('status', 'active')
  .orWhere('role', 'admin')
  .get();

// Where In / Not In
const users = await User.whereIn('id', [1, 2, 3, 4, 5]).get();
const users = await User.whereNotIn('status', ['banned', 'deleted']).get();

// Where Null / Not Null
const users = await User.whereNull('deleted_at').get();
const verified = await User.whereNotNull('email_verified_at').get();

// Where Between / Like
const adults = await User.whereBetween('age', [18, 65]).get();
const johns = await User.whereLike('name', '%john%').get();

// Pagination
const result = await User.paginate(1, 15);
// { data: [...], total: 100, per_page: 15, current_page: 1, last_page: 7, from: 1, to: 15 }

// Count / Exists
const count = await User.where('status', 'active').count();
const hasUsers = await User.where('role', 'admin').exists();

// Joins
const result = await User
  .join('profiles', 'users.id', 'profiles.user_id')
  .leftJoin('countries', 'profiles.country_id', 'countries.id')
  .select('users.*', 'profiles.bio', 'countries.name as country')
  .get();

// Aggregations
const stats = await User
  .distinct()
  .groupBy('status')
  .having('COUNT(*)', '>', 5)
  .get();

// Atomic increment / decrement
await User.where('id', 1).increment('login_count');
await User.where('id', 1).decrement('credits', 10);
```

### Relationship filters

```javascript
// whereHas: Users who have at least one published post
const authors = await User
  .whereHas('posts', (q) => {
    q.where('status', 'published');
  })
  .get();

// has: At least N children
const prolific = await User.has('posts', '>=', 10).get();

// whereDoesntHave: No children
const noPostUsers = await User.whereDoesntHave('posts').get();

// withCount: Add a {relation}_count column
const withCounts = await User.withCount('posts').get();
// Each user will have: user.getAttribute('posts_count')
```

## 🔗 Relations

### One to One (hasOne)

```javascript
const { Model } = require('outlet-orm');

class Profile extends Model { static table = 'profiles'; }

class User extends Model {
  static table = 'users';
  
  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}

const user = await User.find(1);
const profile = await user.profile().get();
```

### One to Many (hasMany)

```javascript
const { Model } = require('outlet-orm');

class Post extends Model { static table = 'posts'; }

class User extends Model {
  static table = 'users';
  
  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

const user = await User.find(1);
const posts = await user.posts().get();
```

### Belongs To (belongsTo)

```javascript
const { Model } = require('outlet-orm');

class User extends Model { static table = 'users'; }

class Post extends Model {
  static table = 'posts';
  
  author() {
    return this.belongsTo(User, 'user_id');
  }
}

const post = await Post.find(1);
const author = await post.author().get();
```

### Many to Many (belongsToMany)

```javascript
const { Model } = require('outlet-orm');

class Role extends Model { static table = 'roles'; }

class User extends Model {
  static table = 'users';
  
  roles() {
    return this.belongsToMany(
      Role,
      'user_roles',   // Table pivot
      'user_id',      // FK vers User
      'role_id'       // FK vers Role
    );
  }
}

const user = await User.find(1);
const roles = await user.roles().get();

// Pivot methods
await user.roles().attach([1, 2]);    // Attach roles
await user.roles().detach(2);          // Detach a role
await user.roles().sync([1, 3]);       // Synchronise (replaces all)
```

### Has Many Through (hasManyThrough)

Access a distant relationship via an intermediate model.

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  // User -> Post -> Comment
  comments() {
    return this.hasManyThrough(Comment, Post, 'user_id', 'post_id');
  }
}

const user = await User.find(1);
const allComments = await user.comments().get();
```

### Has One Through (hasOneThrough)

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  // User -> Profile -> Country
  country() {
    return this.hasOneThrough(Country, Profile, 'user_id', 'country_id');
  }
}

const user = await User.find(1);
const country = await user.country().get();
```

### Polymorphic relationships

Polymorphic relationships allow a model to belong to multiple other models.

```javascript
const { Model } = require('outlet-orm');

// Set up the morph map
Model.setMorphMap({
  'posts': Post,
  'videos': Video
});

// Models
class Post extends Model {
  comments() {
    return this.morphMany(Comment, 'commentable');
  }
}

class Video extends Model {
  comments() {
    return this.morphMany(Comment, 'commentable');
  }
}

class Comment extends Model {
  commentable() {
    return this.morphTo('commentable');
  }
}

// Usage
const post = await Post.find(1);
const comments = await post.comments().get();

const comment = await Comment.find(1);
const parent = await comment.commentable().get(); // Post or Video
```

**Available polymorphic relationships:**
- `morphOne(Related, 'morphName')` - One-to-One polymorphic
- `morphMany(Related, 'morphName')` - One-to-Many polymorphic
- `morphTo('morphName')` - Inverse polymorphic

### Eager Loading

```javascript
// Load multiple relationships
const users = await User.with('posts', 'profile', 'roles').get();

// Load with constraints
const users = await User.with({
  posts: (q) => q.where('status', 'published').orderBy('created_at', 'desc')
}).get();

// Load nested relationships (dot notation)
const users = await User.with('posts.comments.author').get();

// Load on an existing instance
const user = await User.find(1);
await user.load('posts', 'profile');
await user.load(['roles', 'posts.comments']);

// Access loaded relationships
users.forEach(user => {
  console.log(user.relationships.posts);
  console.log(user.relationships.profile);
});
```

## 🎭 Attributs

### Casts

Casts automatically convert attributes:

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static casts = {
    id: 'int',              // ou 'integer'
    age: 'integer',
    balance: 'float',       // ou 'double'
    email_verified: 'boolean', // ou 'bool'
    metadata: 'json',       // Parse JSON
    settings: 'array',      // Parse JSON as array
    birthday: 'date'        // Converts to Date
  };
}
```

### Hidden attributes

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static hidden = ['password', 'secret_token'];
}

const user = await User.find(1);
console.log(user.toJSON()); // password and secret_token excluded
```

#### Show hidden attributes

```javascript
// Include hidden attributes
const user = await User.withHidden().where('email', 'john@example.com').first();
console.log(user.toJSON()); // password included

// Control with a boolean
const user = await User.withoutHidden(true).first(); // true = show
const user = await User.withoutHidden(false).first(); // false = hide (default)

// Use case: authentication
const user = await User.withHidden().where('email', email).first();
if (user && await bcrypt.compare(password, user.getAttribute('password'))) {
  // Authentication successful
}
```

### Timestamps

```javascript
const { Model } = require('outlet-orm');

// Enabled by default (created_at, updated_at)
class User extends Model {
  static timestamps = true;
}

// Disable
class Log extends Model {
  static timestamps = false;
}
```

## 🔄 Transactions

Outlet ORM supports transactions to guarantee data integrity:

```javascript
const { DatabaseConnection, Model } = require('outlet-orm');

// Method 1: Automatic callback (recommended)
const db = Model.connection;
const result = await db.transaction(async (connection) => {
  const user = await User.create({ name: 'John', email: 'john@example.com' });
  await Account.create({ user_id: user.getAttribute('id'), balance: 0 });
  return user;
});
// Automatic commit, rollback on error

// Method 2: Manual control
await db.beginTransaction();
try {
  await User.create({ name: 'Jane' });
  await db.commit();
} catch (error) {
  await db.rollback();
  throw error;
}
```

## 🗑️ Soft Deletes

Soft deletion using a `deleted_at` column:

```javascript
const { Model } = require('outlet-orm');

class Post extends Model {
  static table = 'posts';
  static softDeletes = true;
  // static DELETED_AT = 'deleted_at'; // Customisable
}

// Queries automatically exclude soft-deleted records
const posts = await Post.all(); // Only non-deleted records

// Include deleted records
const allPosts = await Post.withTrashed().get();

// Only deleted records
const trashedPosts = await Post.onlyTrashed().get();

// Delete (soft delete)
const post = await Post.find(1);
await post.destroy(); // Sets deleted_at to the current date

// Check if deleted
if (post.trashed()) {
  console.log('This post is deleted');
}

// Restaurer
await post.restore();

// Delete permanently
await post.forceDelete();
```

## 🔬 Scopes

### Scopes Globaux

Applied automatically to all queries:

```javascript
const { Model } = require('outlet-orm');

class Post extends Model {
  static table = 'posts';
}

// Add a global scope
Post.addGlobalScope('published', (query) => {
  query.where('status', 'published');
});

// All queries filter automatically
const posts = await Post.all(); // Published only

// Temporarily disable a scope
const allPosts = await Post.withoutGlobalScope('published').get();

// Disable all scopes
const rawPosts = await Post.withoutGlobalScopes().get();
```

## 📣 Events / Hooks

Intercept operations on your models:

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
}

// Before creation
User.creating((user) => {
  user.setAttribute('uuid', generateUUID());
  // Return false to roll back
});

// After creation
User.created((user) => {
  console.log(`User ${user.getAttribute('id')} created`);
});

// Before update
User.updating((user) => {
  user.setAttribute('updated_at', new Date());
});

// After update
User.updated((user) => {
  // Notify external systems
});

// saving/saved events (creation AND update)
User.saving((user) => {
  // Data cleanup
});

User.saved((user) => {
  // Cache invalidation
});

// Before/after deletion
User.deleting((user) => {
  // Checks before deletion
});

User.deleted((user) => {
  // Clean up relationships
});

// For soft deletes
User.restoring((user) => {});
User.restored((user) => {});
```

## ✅ Validation

Built-in basic validation:

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
  static rules = {
    name: 'required|string|min:2|max:100',
    email: 'required|email',
    age: 'numeric|min:0|max:150',
    role: 'in:admin,user,guest',
    password: 'required|min:8'
  };
}

const user = new User({
  name: 'J',
  email: 'invalid-email',
  age: 200
});

// Valider
const { valid, errors } = user.validate();
console.log(valid); // false
console.log(errors);
// {
//   name: ['name must be at least 2 characters'],
//   email: ['email must be a valid email'],
//   age: ['age must not exceed 150']
// }

// Validate or throw an error
try {
  user.validateOrFail();
} catch (error) {
  console.log(error.errors);
}
```

### Available rules

| Rule | Description |
|-------|-------------|
| `required` | Required field |
| `string` | Must be a string |
| `number` / `numeric` | Must be a number |
| `email` | Valid email format |
| `boolean` | Must be a boolean |
| `date` | Valid date |
| `min:N` | Minimum N (longueur ou value) |
| `max:N` | Maximum N (longueur ou value) |
| `in:a,b,c` | Valeur parmi la liste |
| `regex:pattern` | Match le pattern regex |

## 📊 Query Logging

Debug mode to analyse your queries:

```javascript
const { Model } = require('outlet-orm');

// Activer le logging
const db = Model.getConnection();
db.enableQueryLog();

// Run queries
await User.where('status', 'active').get();
await Post.with('author').get();

// Retrieve the log
const queries = db.getQueryLog();
console.log(queries);
// [
//   { sql: 'SELECT * FROM users WHERE status = ?', params: ['active'], duration: 15, timestamp: Date },
//   { sql: 'SELECT * FROM posts', params: [], duration: 8, timestamp: Date }
// ]

// Vider le log
db.flushQueryLog();

// Disable le logging
db.disableQueryLog();

// Check if active
if (db.isLogging()) {
  console.log('Logging active');
}
```

## 📝 API Reference

### DatabaseConnection

| Method | Description |
|---------|-------------|
| `new DatabaseConnection(config?)` | Creates a connection (reads `.env` if config is omitted) |
| `connect()` | Establishes the connection (called automatically) |
| `beginTransaction()` | Starts a transaction |
| `commit()` | Commits the transaction |
| `rollback()` | Rolls back the transaction |
| `transaction(callback)` | Runs in a transaction (auto commit/rollback) |
| `select(table, query)` | Runs a SELECT |
| `insert(table, data)` | Inserts a record |
| `insertMany(table, data[])` | Inserts multiple records |
| `update(table, data, query)` | Updates records |
| `delete(table, query)` | Deletes records |
| `count(table, query)` | Counts records |
| `executeRawQuery(sql, params?)` | Raw query (normalised results) |
| `execute(sql, params?)` | Raw query (native driver results) |
| `increment(table, column, query, amount?)` | Atomic increment |
| `decrement(table, column, query, amount?)` | Atomic decrement |
| `close()` / `disconnect()` | Closes the connection |
| **Query Logging (static)** | |
| `enableQueryLog()` | Enables query logging |
| `disableQueryLog()` | Disables logging |
| `getQueryLog()` | Returns the query log |
| `flushQueryLog()` | Clears the log |
| `isLogging()` | Checks whether logging is active |

### Model (static methods)

| Method | Description |
|---------|-------------|
| `setConnection(db)` | Sets the default connection |
| `getConnection()` | Gets the connection (v3.0.0+) |
| `setMorphMap(map)` | Defines polymorphic mapping |
| `query()` | Returns a QueryBuilder |
| `all()` | All records |
| `find(id)` | Finds by ID |
| `findOrFail(id)` | Finds or throws an error |
| `first()` | First record |
| `where(col, op?, val)` | Clause WHERE |
| `whereIn(col, vals)` | Clause WHERE IN |
| `whereNull(col)` | Clause WHERE NULL |
| `whereNotNull(col)` | Clause WHERE NOT NULL |
| `create(attrs)` | Creates and saves |
| `insert(data)` | Raw insert |
| `update(attrs)` | Update bulk |
| `updateById(id, attrs)` | Update by ID |
| `updateAndFetchById(id, attrs, rels?)` | Update + fetch with relationships |
| `delete()` | Delete bulk |
| `with(...rels)` | Eager loading |
| `withHidden()` | Includes hidden attributes |
| `withoutHidden(show?)` | Control attribute visibility |
| `orderBy(col, dir?)` | Sort |
| `limit(n)` / `offset(n)` | Limit/Offset |
| `paginate(page, perPage)` | Pagination |
| `count()` | Count |
| **Soft Deletes** | |
| `withTrashed()` | Includes soft-deleted records |
| `onlyTrashed()` | Only soft-deleted records |
| **Scopes** | |
| `addGlobalScope(name, cb)` | Adds a global scope |
| `removeGlobalScope(name)` | Removes a scope |
| `withoutGlobalScope(name)` | Query without one scope |
| `withoutGlobalScopes()` | Query without all scopes |
| **Events** | |
| `on(event, callback)` | Registers a listener |
| `creating(cb)` / `created(cb)` | Creation events |
| `updating(cb)` / `updated(cb)` | Update events |
| `saving(cb)` / `saved(cb)` | Save events |
| `deleting(cb)` / `deleted(cb)` | Delete events |
| `restoring(cb)` / `restored(cb)` | Restore events |

### Model (instance methods)

| Method | Description |
|---------|-------------|
| `fill(attrs)` | Fills attributes |
| `setAttribute(key, val)` | Sets an attribute |
| `getAttribute(key)` | Gets an attribute |
| `save()` | Save (insert or update) |
| `destroy()` | Delete the instance (soft if enabled) |
| `load(...rels)` | Load relationships |
| `getDirty()` | Modified attributes |
| `isDirty()` | Has been modified? |
| `toJSON()` | Convert to plain object |
| **Soft Deletes** | |
| `trashed()` | Is deleted? |
| `restore()` | Restore the model |
| `forceDelete()` | Permanent deletion |
| **Validation** | |
| `validate()` | Validate against rules |
| `validateOrFail()` | Validate or throw error |

### QueryBuilder

| Method | Description |
|---------|-------------|
| `select(...cols)` / `columns([...])` | Column selection |
| `distinct()` | SELECT DISTINCT |
| `where(col, op?, val)` | Clause WHERE |
| `whereIn(col, vals)` | WHERE IN |
| `whereNotIn(col, vals)` | WHERE NOT IN |
| `whereNull(col)` | WHERE NULL |
| `whereNotNull(col)` | WHERE NOT NULL |
| `orWhere(col, op?, val)` | OR WHERE |
| `whereBetween(col, [min, max])` | WHERE BETWEEN |
| `whereLike(col, pattern)` | WHERE LIKE |
| `whereHas(rel, cb?)` | Filter by existence of relation |
| `has(rel, op?, count)` | Relational existence |
| `whereDoesntHave(rel)` | Absence of relation |
| `orderBy(col, dir?)` / `ordrer(...)` | Sort |
| `limit(n)` / `take(n)` | Limit |
| `offset(n)` / `skip(n)` | Offset |
| `groupBy(...cols)` | GROUP BY |
| `having(col, op, val)` | HAVING |
| `join(table, first, op?, second)` | INNER JOIN |
| `leftJoin(table, first, op?, second)` | LEFT JOIN |
| `with(...rels)` | Eager loading |
| `withCount(rels)` | Adds `{rel}_count` |
| `withTrashed()` | Includes soft-deleted records |
| `onlyTrashed()` | Only soft-deleted records |
| `withoutGlobalScope(name)` | Without one global scope |
| `withoutGlobalScopes()` | Without all global scopes |
| `get()` | Runs and returns all |
| `first()` | First result |
| `firstOrFail()` | Premier ou erreur |
| `paginate(page, perPage)` | Pagination |
| `count()` | Compte |
| `exists()` | Checks existence |
| `insert(data)` | Insert |
| `update(attrs)` | Update |
| `updateAndFetch(attrs, rels?)` | Update + fetch |
| `delete()` | Delete |
| `increment(col, amount?)` | Atomic increment |
| `decrement(col, amount?)` | Atomic decrement |
| `clone()` | Clones the query builder |

## 🛠️ CLI tools

### outlet-init

Initialises a new project with database configuration.

```bash
outlet-init
```

Generates:
- Configuration file `database/config.js`
- `.env` file with settings
- Example model
- Usage file

### outlet-migrate

complete migration system.

```bash
# Create a migration
outlet-migrate make create_users_table

# Run migrations
outlet-migrate migrate

# See migration status
outlet-migrate status

# Roll back the latest migration
outlet-migrate rollback --steps 1

# Reset all migrations
outlet-migrate reset --yes

# Refresh (reset + migrate)
outlet-migrate refresh --yes

# Fresh (drop all + migrate)
outlet-migrate fresh --yes
```

**Migration Features:**

- ✅ Creation and management of migrations (create, alter, drop tables)
- ✅ Column types: id, string, text, integer, boolean, date, datetime, timestamp, decimal, float, json, enum, uuid, foreignId
- ✅ Modifiers: nullable, default, unique, index, unsigned, autoIncrement, comment, after, first
- ✅ Foreign keys: foreign(), constrained(), onDelete(), onUpdate(), CASCADE
- ✅ Index: index(), unique(), fullText()
- ✅ Manipulation: renameColumn(), dropColumn(), dropTimestamps()
- ✅ Reversible migrations: up() and down() methods
- ✅ Batch tracking: Precise rollback by batch
- ✅ Custom SQL: execute() for advanced commands

### outlet-convert

Converts SQL schemas into ORM models.

```bash
outlet-convert
```

**Options:**
1. From a local SQL file
2. From a connected database

**Features:**
- ✅ Automatic type and cast detection
- ✅ Automatic generation of ALL relationships (belongsTo, hasMany, hasOne, belongsToMany)
- ✅ Recursive relationships (auto-relationships)
- ✅ Detection of sensitive fields (password, token, etc.)
- ✅ Automatic timestamps support
- ✅ Class names converted to PascalCase

## 📚 Documentation

- [Migrations Guide](docs/MIGRATIONS.md)
- [SQL Conversion](docs/SQL_CONVERSION.md)
- [Relation Detection](docs/RELATIONS_DETECTION.md)
- [Quick Start Guide](docs/QUICKSTART.md)
- [Architecture](docs/ARCHITECTURE.md)
- [**TypeScript (complet)**](docs/TYPESCRIPT.md)

## 📘 TypeScript Support

Outlet ORM v4.0.0 includes complete TypeScript definitions with support for **generics for typed model attributes**.

### Typed models

```typescript
import { Model, HasManyRelation } from 'outlet-orm';

interface UserAttributes {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  created_at: Date;
}

class User extends Model<UserAttributes> {
  static table = 'users';
  static fillable = ['name', 'email', 'role'];

  posts(): HasManyRelation<Post> {
    return this.hasMany(Post, 'user_id');
  }
}

// Type-safe getAttribute/setAttribute
const user = await User.find(1);
const name: string = user.getAttribute('name');     // ✅ Inferred type
const role: 'admin' | 'user' = user.getAttribute('role');
```

### Migrations typedes

```typescript
import { MigrationInterface, Schema, TableBuilder } from 'outlet-orm';

export const migration: MigrationInterface = {
  name: 'create_users_table',
  
  async up(): Promise<void> {
    await Schema.create('users', (table: TableBuilder) => {
      table.id();
      table.string('name');
      table.string('email').unique();
      table.timestamps();
    });
  },

  async down(): Promise<void> {
    await Schema.dropIfExists('users');
  }
};
```

📖 [Guide TypeScript complet](docs/TYPESCRIPT.md)

## 🤝 Contributions

Contributions are welcome! Feel free to open an issue or pull request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## 📄 Licence

MIT - See [LICENSE](LICENSE) for details.

---

Created by [omgbwa-yasse](https://github.com/omgbwa-yasse)

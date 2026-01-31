# Outlet ORM - Migrations & Schema Builder

[← Back to Index](SKILL.md) | [Previous: Relations](RELATIONS.md) | [Next: Advanced →](ADVANCED.md)

> 📘 **TypeScript** : Use `MigrationInterface`, `SchemaBuilder`, `TableBuilder`, `ColumnBuilder` for type-safe migrations. See [TYPESCRIPT.md](TYPESCRIPT.md#migrations-typées-v400)

---

## Project Structure for Migrations

> 🔐 **Security**: Database credentials should be in `.env` (never committed).

```
my-project/
├── .env                        # ⚠️ NEVER commit
├── config/
│   └── database.js             # Reads from .env
├── database/
│   ├── config.js               # Migration config
│   └── migrations/
├── models/
├── middlewares/                # 🔒 Security
├── utils/                      # 🔒 Hash, tokens
├── public/                     # ✅ Static files
└── logs/                       # 📋 Not versioned
```

---

## CLI Commands

### Initialize Project

```bash
outlet-init
```

Generates:
- `database/config.js` - Configuration
- `.env` - Environment variables
- Example model
- Usage file

### Create Migration

```bash
outlet-migrate make create_users_table
outlet-migrate make add_email_to_users_table
outlet-migrate make alter_posts_table
```

### Run Migrations

```bash
# Run all pending migrations
outlet-migrate migrate

# Interactive menu
outlet-migrate
# Then choose option 1
```

### Migration Status

```bash
outlet-migrate status
```

### Rollback

```bash
# Rollback last batch
outlet-migrate rollback --steps 1

# Reset all
outlet-migrate reset --yes

# Refresh (reset + migrate)
outlet-migrate refresh --yes

# Fresh (drop all + migrate)
outlet-migrate fresh --yes
```

### Convert SQL to Models

```bash
outlet-convert
```

Options:
1. From local SQL file
2. From connected database

---

## Creating a Migration

### Create Table Migration

```javascript
const Migration = require('../../lib/Migrations/Migration');

class CreateUsersTable extends Migration {
  async up() {
    const schema = this.getSchema();

    await schema.create('users', (table) => {
      table.id();
      table.string('name', 100);
      table.string('email').unique();
      table.string('password');
      table.boolean('is_active').default(true);
      table.timestamps();
      table.softDeletes();
    });
  }

  async down() {
    const schema = this.getSchema();
    await schema.dropIfExists('users');
  }
}

module.exports = CreateUsersTable;
```

### Alter Table Migration

```javascript
class AddPhoneToUsersTable extends Migration {
  async up() {
    const schema = this.getSchema();

    await schema.table('users', (table) => {
      table.string('phone', 20).nullable().after('email');
      table.index('phone');
    });
  }

  async down() {
    const schema = this.getSchema();

    await schema.table('users', (table) => {
      table.dropColumn('phone');
    });
  }
}

module.exports = AddPhoneToUsersTable;
```

---

## Column Types

### Basic Types

| Method | SQL Type |
|--------|----------|
| `table.id()` | BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY |
| `table.string('col', 100)` | VARCHAR(100) |
| `table.text('col')` | TEXT |
| `table.integer('col')` | INT |
| `table.bigInteger('col')` | BIGINT |
| `table.boolean('col')` | TINYINT(1) |
| `table.date('col')` | DATE |
| `table.datetime('col')` | DATETIME |
| `table.timestamp('col')` | TIMESTAMP |
| `table.decimal('col', 8, 2)` | DECIMAL(8,2) |
| `table.float('col', 3, 1)` | FLOAT(3,1) |
| `table.json('col')` | JSON |
| `table.enum('col', ['a', 'b'])` | ENUM('a', 'b') |
| `table.uuid('col')` | CHAR(36) |

### Special Types

| Method | Description |
|--------|-------------|
| `table.foreignId('user_id')` | BIGINT UNSIGNED (for FKs) |
| `table.timestamps()` | created_at, updated_at |
| `table.softDeletes()` | deleted_at (TIMESTAMP NULL) |

### Usage Example

```javascript
await schema.create('posts', (table) => {
  table.id();                                    // Primary key
  table.string('title', 200);                    // VARCHAR(200)
  table.text('content');                         // TEXT
  table.integer('views').default(0);             // INT DEFAULT 0
  table.decimal('price', 10, 2).nullable();      // DECIMAL(10,2) NULL
  table.boolean('published').default(false);     // TINYINT(1) DEFAULT 0
  table.json('metadata');                        // JSON
  table.enum('status', ['draft', 'published', 'archived']).default('draft');
  table.datetime('published_at').nullable();     // DATETIME NULL
  table.timestamps();                            // created_at, updated_at
  table.softDeletes();                           // deleted_at
});
```

---

## Column Modifiers

```javascript
// Nullable
table.string('bio').nullable();

// Default value
table.integer('count').default(0);
table.boolean('active').default(true);
table.string('role').default('user');

// Unique constraint
table.string('email').unique();

// Comment
table.string('name').comment('User full name');

// Unsigned
table.integer('age').unsigned();

// Position after column
table.string('middle_name').after('first_name');

// Position first
table.string('id').first();

// Auto timestamp
table.timestamp('created_at').useCurrent();
table.timestamp('updated_at').useCurrent().useCurrentOnUpdate();
```

---

## Foreign Keys

### Explicit Syntax

```javascript
await schema.create('posts', (table) => {
  table.id();
  table.foreignId('user_id');
  table.string('title');
  table.timestamps();

  table.foreign('user_id')
    .references('id')
    .on('users')
    .onDelete('CASCADE')
    .onUpdate('CASCADE');
});
```

### Simplified Syntax

```javascript
// Infers table from column name (user_id → users)
table.foreignId('user_id').constrained();

// Explicit table
table.foreignId('author_id').constrained('users');
```

### Cascade Options

```javascript
// Cascade on delete and update
table.foreign('user_id')
  .references('id')
  .on('users')
  .cascadeOnDelete()
  .cascadeOnUpdate();

// Other options: CASCADE, SET NULL, NO ACTION, RESTRICT
table.foreign('category_id')
  .references('id')
  .on('categories')
  .onDelete('SET NULL')
  .onUpdate('CASCADE');
```

### Drop Foreign Key

```javascript
await schema.table('posts', (table) => {
  table.dropForeign(['user_id']);
});
```

---

## Indexes

### Create Indexes

```javascript
await schema.create('users', (table) => {
  table.id();
  table.string('email');
  table.string('first_name');
  table.string('last_name');

  // Simple index
  table.index('email');

  // Composite index
  table.index(['first_name', 'last_name']);

  // Unique index
  table.unique('email');

  // Fulltext index
  table.fullText('bio');
});
```

### Drop Indexes

```javascript
await schema.table('users', (table) => {
  table.dropIndex(['email']);
  table.dropIndex(['first_name', 'last_name']);
});
```

---

## Table Operations

### Create Table

```javascript
await schema.create('users', (table) => {
  table.id();
  table.string('name');
  table.timestamps();
});
```

### Modify Existing Table

```javascript
await schema.table('users', (table) => {
  table.string('bio').nullable();
  table.index('email');
});
```

### Rename Table

```javascript
await schema.rename('old_users', 'users');
```

### Drop Table

```javascript
await schema.drop('users');
await schema.dropIfExists('users');  // Safe drop
```

### Check Existence

```javascript
const exists = await schema.hasTable('users');
const hasColumn = await schema.hasColumn('users', 'email');

if (!exists) {
  await schema.create('users', (table) => {
    table.id();
    table.string('name');
  });
}
```

---

## Column Manipulation

### Rename Column

```javascript
await schema.table('users', (table) => {
  table.renameColumn('name', 'full_name');
});
```

### Drop Columns

```javascript
await schema.table('users', (table) => {
  // Single column
  table.dropColumn('phone');
  
  // Multiple columns
  table.dropColumn(['bio', 'avatar']);
  
  // Drop timestamps
  table.dropTimestamps();  // Removes created_at and updated_at
});
```

---

## Raw SQL in Migrations

```javascript
class AddFulltextSearch extends Migration {
  async up() {
    await this.execute(`
      ALTER TABLE posts 
      ADD FULLTEXT INDEX posts_search_idx (title, content)
    `);

    await this.execute(`
      CREATE VIEW active_posts AS
      SELECT * FROM posts 
      WHERE status = 'published' 
      AND deleted_at IS NULL
    `);
  }

  async down() {
    await this.execute('DROP VIEW IF EXISTS active_posts');
    await this.execute('ALTER TABLE posts DROP INDEX posts_search_idx');
  }
}
```

---

## Complete Migration Example

```javascript
const Migration = require('../../lib/Migrations/Migration');

class CreateBlogTables extends Migration {
  async up() {
    const schema = this.getSchema();

    // Users table
    await schema.create('users', (table) => {
      table.id();
      table.string('name', 100);
      table.string('email').unique();
      table.string('password');
      table.boolean('is_admin').default(false);
      table.timestamps();
      table.softDeletes();
      
      table.index('email');
    });

    // Categories table (with self-reference)
    await schema.create('categories', (table) => {
      table.id();
      table.string('name', 50).unique();
      table.string('slug', 50).unique();
      table.text('description').nullable();
      table.foreignId('parent_id').nullable();
      table.timestamps();

      table.foreign('parent_id')
        .references('id')
        .on('categories')
        .onDelete('CASCADE');
    });

    // Posts table
    await schema.create('posts', (table) => {
      table.id();
      table.foreignId('user_id').constrained().cascadeOnDelete();
      table.foreignId('category_id').constrained().cascadeOnDelete();
      table.string('title');
      table.string('slug').unique();
      table.text('excerpt').nullable();
      table.text('content');
      table.enum('status', ['draft', 'published', 'archived']).default('draft');
      table.integer('views').default(0).unsigned();
      table.timestamp('published_at').nullable();
      table.timestamps();
      table.softDeletes();

      table.index(['user_id', 'status']);
      table.index('published_at');
      table.fullText('content');
    });

    // Tags table
    await schema.create('tags', (table) => {
      table.id();
      table.string('name', 50).unique();
      table.string('slug', 50).unique();
      table.timestamps();
    });

    // Pivot table
    await schema.create('post_tag', (table) => {
      table.id();
      table.foreignId('post_id').constrained().cascadeOnDelete();
      table.foreignId('tag_id').constrained().cascadeOnDelete();
      table.timestamps();

      table.unique(['post_id', 'tag_id']);
    });
  }

  async down() {
    const schema = this.getSchema();
    
    // Drop in reverse order (FK dependencies)
    await schema.dropIfExists('post_tag');
    await schema.dropIfExists('tags');
    await schema.dropIfExists('posts');
    await schema.dropIfExists('categories');
    await schema.dropIfExists('users');
  }
}

module.exports = CreateBlogTables;
```

---

## Migration Best Practices

### 1. Migration Naming

```
✅ Good:
20231011_120000_create_users_table.js
20231011_120100_add_email_to_users_table.js

❌ Bad:
migration1.js
users.js
```

### 2. Always Implement down()

```javascript
// ✅ Good - Reversible
async down() {
  await schema.dropIfExists('users');
}

// ❌ Bad - Not reversible
async down() {
  // Empty
}
```

### 3. Respect FK Order

```javascript
async down() {
  // Drop child tables first
  await schema.dropIfExists('posts');     // Has FK to users
  await schema.dropIfExists('users');     // Parent table
}
```

### 4. Keep Migrations Atomic

One migration = one task. Related tables can be together.

```javascript
// ✅ Good - Related tables together
create_blog_tables.js  // users, posts, comments

// ✅ Good - Independent feature
create_analytics_tables.js  // analytics, events
```

---

## NPM Scripts Integration

```json
{
  "scripts": {
    "db:init": "outlet-init",
    "db:migrate": "outlet-migrate migrate",
    "db:migrate:make": "outlet-migrate make",
    "db:migrate:status": "outlet-migrate status",
    "db:rollback": "outlet-migrate rollback --steps 1",
    "db:fresh": "outlet-migrate fresh --yes",
    "db:convert": "outlet-convert"
  }
}
```

---

## Next Steps

- [Advanced Features →](ADVANCED.md)
- [API Reference →](API.md)

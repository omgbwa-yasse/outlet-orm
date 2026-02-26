# Migration Guide - Outlet ORM

## 📚 Overview

The Outlet ORM migration system is inspired by Laravel and allows you to manage the evolution of your database schema in a versioned and collaborative manner.

> 📁 **Location** :`database/migrations/`— See [Project structure](INSTALLATION.md#structure-de-projet-recommandée)
>
> 📘 **TypeScript**: Use`MigrationInterface`,`SchemaBuilder`,`TableBuilder`for typical migrations. See [TYPESCRIPT.md](TYPESCRIPT.md#migrations-typées-v400)

## 🚀 CLI Commands

### Create a migration

```bash
outlet-migrate make create_users_table
outlet-migrate make add_email_to_users_table
outlet-migrate make alter_posts_table
```

### Run migrations

```bash
# Run all pending migrations
outlet-migrate
# Then choose option 1

# Or directly:
node bin/migrate.js
```

### Cancel migrations

```bash
# Rollback of the last batch
outlet-migrate
# Option 2: rollback

# Rollback of several batches
# Option 2, then enter the number of batches

# Reset (cancel all migrations)
# Option 3: reset

# Refresh (reset + migrate)
# Option 4: refresh

# Fresh (drop all + migrate)
# Option 5: fresh
```

### View status

```bash
outlet-migrate
# Option 6: status
```

## 📝 Create a Migration

### Table creation migration

```javascript
/**
 * Migration: Create users table
 */

const Migration = require('../../lib/Migrations/Migration');

class CreateUsersTable extends Migration {
  async up() {
    const schema = this.getSchema();

    await schema.create('users', (table) => {
      table.id();
      table.string('name');
      table.string('email').unique();
      table.string('password');
      table.boolean('is_active').default(true);
      table.timestamps();
    });
  }

  async down() {
    const schema = this.getSchema();
    await schema.dropIfExists('users');
  }
}

module.exports = CreateUsersTable;
```

### Table modification migration

```javascript
const Migration = require('../../lib/Migrations/Migration');

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

## 🔧 Column Types

### Basic types

```javascript
table.id();                          // BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
table.string('name', 100);           // VARCHAR(100)
table.text('description');           // TEXT
table.integer('age');                // INT
table.bigInteger('views');           // BIGINT
table.boolean('is_active');          // TINYINT(1)
table.date('birth_date');            // DATE
table.datetime('published_at');      // DATETIME
table.timestamp('verified_at');      // TIMESTAMP
table.decimal('price', 8, 2);        // DECIMAL(8,2)
table.float('rating', 3, 1);         // FLOAT(3,1)
table.json('metadata');              // JSON
table.enum('status', ['active', 'inactive', 'pending']);  // ENUM
table.uuid('identifier');            // CHAR(36)
```

### Special types

```javascript
table.foreignId('user_id');          // BIGINT UNSIGNED (for foreign keys)
table.timestamps();                  // created_at, updated_at
table.softDeletes();                 // deleted_at (TIMESTAMP NULL)
```

## 🎨 Column Modifiers

### Basic modifiers

```javascript
table.string('email').nullable();                    // NULL
table.integer('count').default(0);                   // DEFAULT 0
table.string('email').unique();                      // UNIQUE
table.string('name').comment('User full name');      // COMMENT
table.integer('order').unsigned();                   // UNSIGNED
```

### Positioning

```javascript
table.string('middle_name').after('first_name');     // Position after
table.string('id').first();                          // Position first
```

### Timestamps

```javascript
table.timestamp('created_at').useCurrent();                    // DEFAULT CURRENT_TIMESTAMP
table.timestamp('updated_at').useCurrent().useCurrentOnUpdate(); // ON UPDATE CURRENT_TIMESTAMP
```

## 🔗 Foreign Keys

### Basic syntax

```javascript
await schema.create('posts', (table) => {
  table.id();
  table.foreignId('user_id');
  table.string('title');
  table.text('content');
  table.timestamps();

  // Explicit foreign key
  table.foreign('user_id')
    .references('id')
    .on('users')
    .onDelete('cascade')
    .onUpdate('cascade');
});
```

### Simplified syntax

```javascript
await schema.create('posts', (table) => {
  table.id();
  table.foreignId('user_id').constrained();  // Infer "users" from "user_id"
  table.string('title');
  table.timestamps();
});

// Or with explicit table
table.foreignId('author_id').constrained('users');
```

### Actions on CASCADE

```javascript
// CASCADE on DELETE and UPDATE
table.foreign('user_id')
  .references('id')
  .on('users')
  .cascadeOnDelete()
  .cascadeOnUpdate();

// Options disponibles: CASCADE, SET NULL, NO ACTION, RESTRICT
table.foreign('category_id')
  .references('id')
  .on('categories')
  .onDelete('SET NULL')
  .onUpdate('CASCADE');
```

### Delete a foreign key

```javascript
await schema.table('posts', (table) => {
  table.dropForeign(['user_id']);  // Remove FK on user_id
});
```

## 📇 Index

### Create indexes

```javascript
await schema.create('users', (table) => {
  table.id();
  table.string('email');
  table.string('phone');
  table.string('first_name');
  table.string('last_name');

  // Index simple
  table.index('email');

  // Index composite
  table.index(['first_name', 'last_name']);

  // Index unique
  table.unique('email');

  // Index full text
  table.fullText('bio');
});
```

### Delete indexes

```javascript
await schema.table('users', (table) => {
  table.dropIndex(['email']);
  table.dropIndex(['first_name', 'last_name']);
});
```

## 🛠️ Table Handling

### Create a table

```javascript
await schema.create('users', (table) => {
  table.id();
  table.string('name');
  table.timestamps();
});
```

### Edit an existing table

```javascript
await schema.table('users', (table) => {
  table.string('bio').nullable();
  table.index('email');
});
```

### Rename a table

```javascript
await schema.rename('old_users', 'users');
```

### Delete a table

```javascript
await schema.drop('users');
await schema.dropIfExists('users');  // Don't crash if non-existent
```

### Check for existence

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

## ✏️ Editing Columns

### Rename a column

```javascript
await schema.table('users', (table) => {
  table.renameColumn('name', 'full_name');
});
```

### Delete columns

```javascript
await schema.table('users', (table) => {
  table.dropColumn('phone');
  
  // Delete multiple columns
  table.dropColumn(['bio', 'avatar']);
});
```

### Delete timestamps

```javascript
await schema.table('users', (table) => {
  table.dropTimestamps();  // Supprime created_at et updated_at
});
```

## 📋 Full Examples

### Full migration with relationships

```javascript
const Migration = require('../../lib/Migrations/Migration');

class CreateBlogTables extends Migration {
  async up() {
    const schema = this.getSchema();

    // Table users
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

    // Table categories
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

    // Table posts
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

    // Table comments
    await schema.create('comments', (table) => {
      table.id();
      table.foreignId('post_id').constrained().cascadeOnDelete();
      table.foreignId('user_id').constrained().cascadeOnDelete();
      table.foreignId('parent_id').nullable();
      table.text('content');
      table.boolean('is_approved').default(false);
      table.timestamps();

      table.foreign('parent_id')
        .references('id')
        .on('comments')
        .onDelete('CASCADE');
    });

    // Table tags
    await schema.create('tags', (table) => {
      table.id();
      table.string('name', 50).unique();
      table.string('slug', 50).unique();
      table.timestamps();
    });

    // Table pivot post_tag
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
    
    // Delete in reverse order (because of FK)
    await schema.dropIfExists('post_tag');
    await schema.dropIfExists('tags');
    await schema.dropIfExists('comments');
    await schema.dropIfExists('posts');
    await schema.dropIfExists('categories');
    await schema.dropIfExists('users');
  }
}

module.exports = CreateBlogTables;
```

### Migration with custom SQL

```javascript
const Migration = require('../../lib/Migrations/Migration');

class AddFulltextSearch extends Migration {
  async up() {
    // Use raw SQL for advanced functionality
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

module.exports = AddFulltextSearch;
```

## 🎯 Good Practices

### 1. Naming migrations

```
✅ Bon:
20231011_120000_create_users_table.js
20231011_120100_add_email_to_users_table.js
20231011_120200_create_posts_table.js

❌ Mauvais:
migration1.js
users.js
my_migration.js
```

### 2. Always implement`down()`

```javascript
// ✅ Good - Reversible migration
async down() {
  const schema = this.getSchema();
  await schema.dropIfExists('users');
}

// ❌ Bad - Non-reversible migration
async down() {
  // Vide ou throw Error
}
```

### 3. Order of deletions (FK)

```javascript
async down() {
  const schema = this.getSchema();
  
  // Delete tables first with FK
  await schema.dropIfExists('posts');        // A une FK vers users
  await schema.dropIfExists('users');        // Table parent
}
```

### 4. Use transactions

Migrations already run in transactions automatically (depending on the driver), but for complex SQL:

```javascript
async up() {
  await this.connection.execute('START TRANSACTION');
  
  try {
    await this.execute('ALTER TABLE...');
    await this.execute('UPDATE...');
    await this.connection.execute('COMMIT');
  } catch (error) {
    await this.connection.execute('ROLLBACK');
    throw error;
  }
}
```

### 5. Atomic migrations

One migration = one task. If you need to create multiple tables, consider whether they should be in the same migration or separate.

```javascript
// ✅ Good - Tables linked together
create_blog_tables.js  // users, posts, comments

// ✅ Good – Independent functionality
create_analytics_tables.js  // analytics, events
```

## 📊 Development Workflow

### Local development

```bash
# 1. Create a migration
outlet-migrate make create_products_table

# 2. Edit the generated file
# database/migrations/20231011_120000_create_products_table.js

# 3. Run the migration
outlet-migrate
# Option 1: migrate

# 4. Check Status
outlet-migrate
# Option 6: status

# 5. If error, rollback and correct
outlet-migrate
# Option 2: rollback
```

### Team collaboration

```bash
# Developer A creates a migration
git add database/migrations/20231011_120000_create_users_table.js
git commit -m "Add users migration"
git push

# Developer B retrieves changes
git pull
outlet-migrate  # Exécute les nouvelles migrations
```

### Production

```bash
# Back up the database before migration
mysqldump -u root -p mydb > backup.sql

# Run migrations
outlet-migrate
# Option 1: migrate

# Check status
outlet-migrate
# Option 6: status

# In case of problem, rollback
outlet-migrate
# Option 2: rollback
```

## 🚨 Problem Solving

### Migration fails

```bash
# See detailed error
outlet-migrate
# The error is displayed with the stack trace

# Rollback of problematic migration
outlet-migrate
# Option 2: rollback

# Fix the migration file
# Relaunch
outlet-migrate
# Option 1: migrate
```

### Complete reset in development

```bash
outlet-migrate
# Option 5: fresh
# ⚠️ WARNING: Deletes ALL data!
```

### Table migration out of sync

```javascript
// If the migrations table is corrupt
const { Model } = require('outlet-orm');
const db = Model.getConnection();

// Delete and recreate
await db.execute('DROP TABLE migrations');

// Relaunch
outlet-migrate
```

## 📦 CI/CD integration

### Script NPM

```json
{
  "scripts": {
    "migrate": "node bin/migrate.js",
    "migrate:rollback": "echo '2\n1\n' | node bin/migrate.js",
    "migrate:fresh": "echo '5\nyes\n' | node bin/migrate.js",
    "migrate:status": "echo '6\n' | node bin/migrate.js"
  }
}
```

### GitHub Actions

```yaml
name: Run Migrations

on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run migrate
        env:
          DB_HOST: ${{ secrets.DB_HOST }}
          DB_USER: ${{ secrets.DB_USER }}
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
```

## 🎓 Résumé

The Outlet ORM migration system offers:

- ✅ **Versioning** of the database schema
- ✅ **Reversible migrations** with`up()`et`down()`
- ✅ **Fluid API** inspired by Laravel
- ✅ **Support multi-base** (MySQL, PostgreSQL, SQLite)
- ✅ **Relationship management** (foreign keys, CASCADE)
- ✅ **Batch tracking** for precise rollback
- ✅ **Interactive CLI** for all operations
- ✅ **Custom SQL** when needed

Use migrations for any changes to your production database! 🚀

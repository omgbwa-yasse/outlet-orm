# Migration Guide - Outlet ORM

## Table of Contents

- [📚 Overview](#overview)
- [🚀 CLI Commands](#cli-commands)
  - [Create a migration](#create-a-migration)
  - [Run migrations](#run-migrations)
  - [Cancel migrations](#cancel-migrations)
  - [View status](#view-status)
- [📝 Create a Migration](#create-a-migration)
  - [Table creation migration](#table-creation-migration)
  - [Table modification migration](#table-modification-migration)
- [🔧 Column Types](#column-types)
  - [Basic types](#basic-types)
  - [Special types](#special-types)
- [🎨 Column Modifiers](#column-modifiers)
  - [Basic modifiers](#basic-modifiers)
  - [Positioning](#positioning)
  - [Timestamps](#timestamps)
- [🔗 Foreign Keys](#foreign-keys)
  - [Basic syntax](#basic-syntax)
  - [Simplified syntax](#simplified-syntax)
  - [Actions on CASCADE](#actions-on-cascade)
  - [Delete a foreign key](#delete-a-foreign-key)
- [📇 Index](#index)
  - [Create indexes](#create-indexes)
  - [Delete indexes](#delete-indexes)
- [🛠️ Table Handling](#table-handling)
  - [Create a table](#create-a-table)
  - [Edit an existing table](#edit-an-existing-table)
  - [Rename a table](#rename-a-table)
  - [Delete a table](#delete-a-table)
  - [Check for existence](#check-for-existence)
- [✏️ Editing Columns](#editing-columns)
  - [Rename a column](#rename-a-column)
  - [Delete columns](#delete-columns)
  - [Delete timestamps](#delete-timestamps)
- [📋 Full Examples](#full-examples)
  - [Full migration with relationships](#full-migration-with-relationships)
  - [Migration with custom SQL](#migration-with-custom-sql)
- [🎯 Good Practices](#good-practices)
  - [1. Naming migrations](#1-naming-migrations)
  - [2. Always implement`down()`](#2-always-implementdown)
  - [3. Order of deletions (FK)](#3-order-of-deletions-fk)
  - [4. Use transactions](#4-use-transactions)
  - [5. Atomic migrations](#5-atomic-migrations)
- [📊 Development Workflow](#development-workflow)
  - [Local development](#local-development)
  - [Team collaboration](#team-collaboration)
  - [Production](#production)
- [🚨 Problem Solving](#problem-solving)
  - [Migration fails](#migration-fails)
  - [Complete reset in development](#complete-reset-in-development)
  - [Table migration out of sync](#table-migration-out-of-sync)
- [📦 CI/CD integration](#cicd-integration)
  - [Script NPM](#script-npm)
  - [GitHub Actions](#github-actions)
- [🎓 Résumé](#résumé)

---

## 📚 Overview

The Outlet ORM migration system lets you manage the evolution of your database schema in a versioned and collaborative manner.

> 📁 **Location** :`database/migrations/`— See [Project structure](INSTALLATION.md#structure-de-projet-recommended)
>
> 📘 **TypeScript**: Use`MigrationInterface`,`SchemaBuilder`,`TableBuilder`for typical migrations. See [TYPESCRIPT.md](TYPESCRIPT.md#migrations-typedes-v400)

## 🚀 CLI Commands

### Create a migration

```bash
outlet-migrate make create_users_table
outlet-migrate make add_email_to_users_table
outlet-migrate make alter_posts_table

# Force a template explicitly (overrides name-based detection)
outlet-migrate make add_audit_log --create=audit_log
outlet-migrate make tweak_users --table=users
```

### Install the migrations table

```bash
# Create the migrations table only (migrate:install)
outlet-migrate install
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
# Show only pending migrations
outlet-migrate status --pending
```

## 🧩 Extra CLI options (v14.7.0)

Available on the CLI and on the `MigrationManager` programmatic API.

### Flags

| Flag | Commands | Description |
|------|----------|-------------|
| `--pretend` | `migrate`, `rollback`, `reset`, `refresh`, `fresh` | Dry-run. Lists what would happen without touching the DB. |
| `--step` | `migrate`, `refresh`, `fresh` | Runs each pending migration in its own batch (granular rollback). |
| `--steps=N` / `-s N` | `rollback` | Number of batches to revert (default 1). |
| `--batch=N` | `rollback` | Revert only the specified batch number. |
| `--seed` | `migrate`, `refresh`, `fresh` | Chain seeders after a successful migration. |
| `--seeder=Name` / `--class=Name` | `migrate`, `refresh`, `fresh`, `seed` | Target a specific seeder class. |
| `--pending` | `status` | Show only migrations that have not yet executed. |
| `--create=<table>` | `make` | Force a *create-table* template (overrides name detection). |
| `--table=<table>` | `make` | Force an *alter-table* template (overrides name detection). |

### Per-migration hooks

Subclasses of [src/Migrations/Migration.js](../src/Migrations/Migration.js) may override:

```js
const Migration = require('outlet-orm').Migration;

class AddIndexIfMissing extends Migration {
  constructor(connection) {
    super(connection);
    this.withinTransaction = true; // wrap up()/down() in a DB transaction
  }

  // Return false to skip this migration (recorded as status='skipped').
  async shouldRun() {
    const rows = await this.connection.execute(
      "SELECT 1 FROM sqlite_master WHERE type='index' AND name='idx_users_email'"
    );
    return rows.length === 0;
  }

  async up()   { /* ... */ }
  async down() { /* ... */ }
}
```

### Lifecycle events

`MigrationManager` extends Node's `EventEmitter`. Subscribe to:

| Event | Payload | When |
|-------|---------|------|
| `migrations:none` | `{ direction }` | Nothing to run/rollback. |
| `migrations:pretend` | `{ direction, migrations }` | `--pretend` dry-run. |
| `migrations:started` | `{ direction, migrations }` | Before the first migration in a batch. |
| `migrations:ended` | `{ direction, migrations }` | After the batch finishes. |
| `migration:started` | `{ name, method, batch }` | Before a single migration runs. |
| `migration:ended` | `{ name, method, batch, duration }` | After a single migration succeeds. |
| `migration:skipped` | `{ name }` | `shouldRun()` returned `false`. |

```js
const manager = new MigrationManager(connection, './database/migrations');
manager.on('migration:ended', ({ name, duration }) => {
  console.log(`Applied ${name} in ${duration}ms`);
});
await manager.run({ step: true, seed: true });```

## �️ Safety: Automatic Backups, Drift & Production Gate

> Added in **v14.6.0** (feature `003-migration-data-preservation`). All commands below remain backward-compatible — safety features are *on by default* in development and *enforced* in production.

### Automatic Backups

Every destructive command (`fresh`, `reset`, `refresh`, `rollback`) automatically writes a SQL dump **before** mutating the schema:

- Location: `database/backups/`
- Filename: `auto_before_<command>_<YYYYMMDD_HHMMSS>[_<N>].sql`
- Sidecar: `<filename>.meta.json` (timestamp, command, database, size, batch, tables, rows, checksum, encrypted flag, retention slot, schema-only flag)
- Retention: oldest pair pruned beyond `backupRetentionCount` (default **10**)
- Encryption: if `BackupManager` is configured with encryption, auto-backups are encrypted and `restore:auto` round-trips them transparently

Opt out in **development only**:

```bash
outlet-migrate fresh --skip-auto-backup
```

> In production, `--skip-auto-backup` is **ignored** and a warning is logged. The backup always runs.

### Listing Backups

```bash
outlet-migrate backups:list
outlet-migrate backups:list --json     # machine-readable, sorted by timestamp desc
```

Columns: `Backup | Command | Timestamp | Database | Size | Batch | Tables | Rows`.

### Restoring from an Automatic Backup

```bash
# Restore the most recent backup (TTY prompt for confirmation)
outlet-migrate restore:auto

# Restore a specific backup
outlet-migrate restore:auto --backup=auto_before_fresh_20251119_142301.sql
```

Each successful restore appends one JSON line to `database/backups/.restore-history.log`:
`{timestamp, backup, command, database, restoredBy}`.

### Idempotent Re-runs

`outlet-migrate run` is now idempotent — re-running with no pending files completes in < 200 ms and prints "Nothing to migrate". The `migrations` table records `checksum`, `execution_time_ms`, and `status` per row (`pending | running | completed | failed`). Legacy tables are auto-upgraded on first run (additive ALTERs only).

### Drift Detection

Outlet computes a SHA-256 of each migration file and compares it to the checksum stored when the migration was applied. Drift policy is environment-aware:

| Environment | Behavior |
|-------------|----------|
| `development` | ⚠ warns and continues |
| `test` / CI    | silent (no warning) |
| `production` | **throws `EOUTLET_DRIFT`** unless `--allow-drift` is passed or `OUTLET_ALLOW_DRIFT=1` is set |

`outlet-migrate status` adds a `Drift` column highlighting changed files.

### Recovering from a Failed Migration

If a previous `run` left a row with `status='running'` or `status='failed'`, the next `run` prompts (TTY only):

- **re-run** — execute `up()` again
- **mark-resolved** — flip the row to `completed` (manual recovery)
- **abort** — exit with code 1

In non-TTY contexts the command aborts with a clear instruction string.

### Production Safety Gate

When `Environment.detect() === 'production'`, every destructive command (and `restore:auto`) requires **two** independent confirmations:

1. `OUTLET_PRODUCTION_CONFIRM=1` must be set in the environment.
2. The operator must type the exact database name at the interactive prompt (case-sensitive).

If `stdin` is not a TTY the command aborts immediately (exit code 2). This is intentional — automated pipelines should set `OUTLET_PRODUCTION_CONFIRM=1` **and** wire the operation behind a manual approval step.

### Data Transformation Scaffold

```bash
outlet-migrate make:transform split_full_name
```

Creates `database/migrations/<timestamp>_split_full_name.js` from `database/templates/transform-migration.js`. The template uses the three helpers added to the base `Migration` class:

- `await this.backupData(table, columns)` — snapshot selected columns keyed by primary key
- `await this.transformData(table, row => patch, { batchSize: 1000 })` — stream-and-update in batches
- `await this.restoreData(table, snapshot)` — restore from a snapshot in `down()`

See [`MIGRATION_DATA_SAFETY.md`](MIGRATION_DATA_SAFETY.md) for the full pattern catalog (renames, type changes, splits, merges, nullable→not-null transitions).

### CLI Flags Reference (v14.6.0+)

| Flag | Commands | Effect |
|------|----------|--------|
| `--skip-auto-backup` | `fresh`, `reset`, `refresh`, `rollback` | Skip auto-backup (dev/test only; ignored in production) |
| `--allow-drift` | `run`, `status` | Permit execution when drift is detected (production override) |
| `--backup=<file>` | `restore:auto` | Restore a specific backup file from `database/backups/` |
| `--json` | `backups:list`, `status` | Emit machine-readable JSON |
| `--step <N>`, `--steps <N>`, `-s <N>` | `rollback` | Number of batches to roll back (default 1) |

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `OUTLET_ENV` | Explicit override (`development \| production \| test`) | — |
| `NODE_ENV` | Fallback when `OUTLET_ENV` unset | `development` |
| `CI` | When `true`, forces `test` environment | unset |
| `OUTLET_PRODUCTION_CONFIRM` | Must equal `1` for destructive commands in production | unset |
| `OUTLET_ALLOW_DRIFT` | When `1`, permits drift in production | unset |
| `OUTLET_AUTO_BACKUP` | When `false`, disables auto-backup in dev/test | `true` |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Migration / backup / I-O error |
| 2 | Confirmation rejected (env var missing, wrong db name, prompt declined, invalid flag) |
| 3 | Backup not found, or drift detected without `--allow-drift` |

## �📝 Create a Migration

### Table creation migration

```javascript
/**
 * Migration: Create users table
 */

const { Migration } = require('outlet-orm');

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
const { Migration } = require('outlet-orm');

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

// Options availables: CASCADE, SET NULL, NO ACTION, RESTRICT
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
const { Migration } = require('outlet-orm');

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
const { Migration } = require('outlet-orm');

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

## 🗄️ Database Objects in Migrations (v11.3.0+)

Migrations can manage **views**, **triggers**, and **stored procedures/functions** using the same Schema builder via `this.getSchema()`.

```js
const Migration = require('outlet-orm/src/Migrations/Migration');

class CreateViewsAndTriggers extends Migration {
  async up() {
    const schema = this.getSchema();

    await schema.createView(
      'active_users',
      "SELECT * FROM users WHERE status = 'active'"
    );

    await schema.createTrigger({
      name:   'set_last_modified',
      table:  'users',
      timing: 'AFTER',
      event:  'UPDATE',
      body:   "UPDATE users SET last_modified = NOW() WHERE id = NEW.id;"
    });
  }

  async down() {
    const schema = this.getSchema();
    await schema.dropViewIfExists('active_users');
    await schema.dropTriggerIfExists('set_last_modified', 'users');
  }
}

module.exports = CreateViewsAndTriggers;
```

See [DATABASE_OBJECTS.md](./DATABASE_OBJECTS.md) for the full reference including triggers, stored procedures, savepoints, and isolation levels.

---

## 🎓 Résumé

The Outlet ORM migration system offers:

- ✅ **Versioning** of the database schema
- ✅ **Reversible migrations** with`up()`et`down()`
- ✅ **Fluid API** for schema definition
- ✅ **Support multi-base** (MySQL, PostgreSQL, SQLite)
- ✅ **Relationship management** (foreign keys, CASCADE)
- ✅ **Batch tracking** for precise rollback
- ✅ **Interactive CLI** for all operations
- ✅ **Custom SQL** when needed
- ✅ **Views, triggers, procedures/functions** via Schema builder

Use migrations for any changes to your production database! 🚀

## Deployment options (v14.8.0)

### `outlet-migrate deploy`

Non-interactive command for CI/CD pipelines. Runs only pending migrations and:

- Never produces an automatic backup.
- Never prompts (no production confirmation).
- Refuses to run when at least one previously **failed** migration exists in the `_migrations` table, unless `--allow-failed` is passed.
- Honors `--pretend` and `--allow-drift`.

```bash
outlet-migrate deploy
outlet-migrate deploy --pretend
outlet-migrate deploy --allow-drift
outlet-migrate deploy --allow-failed
```

### `outlet-migrate resolve`

Manual recovery for production. Lets you reconcile the `_migrations` table after a hot-fix without re-executing SQL.

```bash
# Mark a migration as applied without running its up()
outlet-migrate resolve --applied=2026_05_22_create_users.js

# Mark a previously failed/completed migration as rolled back
outlet-migrate resolve --rolled-back=2026_05_22_create_users.js
```

Throws `EOUTLET_NOT_FOUND` if the target migration does not exist in `_migrations`.

### Advisory lock

`deploy` and `resolve` wrap their work in an advisory lock to prevent two CI runners from racing:

- **PostgreSQL** — `pg_advisory_lock` / `pg_advisory_unlock` (lock id derived from the migrations table name).
- **MySQL** — `GET_LOCK(name, 10)` / `RELEASE_LOCK(name)`.
- **SQLite** — no-op (single-writer engine).

When the lock cannot be acquired the command exits with `EOUTLET_LOCK_BUSY`. `run`, `rollback`, `reset`, `refresh` and `fresh` are intentionally not wrapped (they are interactive flows).

### New `_migrations` columns

The migrations table is auto-upgraded on `initialize()` with three ISO-8601 timestamp columns:

- `started_at` — set when a migration begins executing.
- `finished_at` — set when a migration completes successfully.
- `rolled_back_at` — set when a migration is rolled back (manually via `resolve --rolled-back` or via `rollback`).

### Missing migrations

`status()` now flags rows whose file is no longer present on disk with the status `missing`. The same list is available programmatically via `manager.getMissingMigrations()`.

## Deployment options (v14.8.0)

### `outlet-migrate deploy`

Non-interactive command for CI/CD pipelines. Runs only pending migrations and:

- Never produces an automatic backup.
- Never prompts (no production confirmation).
- Refuses to run when at least one previously **failed** migration exists in the `_migrations` table, unless `--allow-failed` is passed.
- Honors `--pretend` and `--allow-drift`.

```bash
outlet-migrate deploy
outlet-migrate deploy --pretend
outlet-migrate deploy --allow-drift
outlet-migrate deploy --allow-failed
```

### `outlet-migrate resolve`

Manual recovery for production. Lets you reconcile the `_migrations` table after a hot-fix without re-executing SQL.

```bash
# Mark a migration as applied without running its up()
outlet-migrate resolve --applied=2026_05_22_create_users.js

# Mark a previously failed/completed migration as rolled back
outlet-migrate resolve --rolled-back=2026_05_22_create_users.js
```

Throws `EOUTLET_NOT_FOUND` if the target migration does not exist in `_migrations`.

### Advisory lock

`deploy` and `resolve` wrap their work in an advisory lock to prevent two CI runners from racing:

- **PostgreSQL** — `pg_advisory_lock` / `pg_advisory_unlock` (lock id derived from the migrations table name).
- **MySQL** — `GET_LOCK(name, 10)` / `RELEASE_LOCK(name)`.
- **SQLite** — no-op (single-writer engine).

When the lock cannot be acquired the command exits with `EOUTLET_LOCK_BUSY`. `run`, `rollback`, `reset`, `refresh` and `fresh` are intentionally not wrapped (they are interactive flows).

### New `_migrations` columns

The migrations table is auto-upgraded on `initialize()` with three ISO-8601 timestamp columns:

- `started_at` — set when a migration begins executing.
- `finished_at` — set when a migration completes successfully.
- `rolled_back_at` — set when a migration is rolled back (manually via `resolve --rolled-back` or via `rollback`).

### Missing migrations

`status()` now flags rows whose file is no longer present on disk with the status `missing`. The same list is available programmatically via `manager.getMissingMigrations()`.

## Deployment options (v14.8.0)

### `outlet-migrate deploy`

Non-interactive command for CI/CD pipelines. Runs only pending migrations and:

- Never produces an automatic backup.
- Never prompts (no production confirmation).
- Refuses to run when at least one previously **failed** migration exists in the `_migrations` table, unless `--allow-failed` is passed.
- Honors `--pretend` and `--allow-drift`.

```bash
outlet-migrate deploy
outlet-migrate deploy --pretend
outlet-migrate deploy --allow-drift
outlet-migrate deploy --allow-failed
```

### `outlet-migrate resolve`

Manual recovery for production. Lets you reconcile the `_migrations` table after a hot-fix without re-executing SQL.

```bash
# Mark a migration as applied without running its up()
outlet-migrate resolve --applied=2026_05_22_create_users.js

# Mark a previously failed/completed migration as rolled back
outlet-migrate resolve --rolled-back=2026_05_22_create_users.js
```

Throws `EOUTLET_NOT_FOUND` if the target migration does not exist in `_migrations`.

### Advisory lock

`deploy` and `resolve` wrap their work in an advisory lock to prevent two CI runners from racing:

- **PostgreSQL** — `pg_advisory_lock` / `pg_advisory_unlock` (lock id derived from the migrations table name).
- **MySQL** — `GET_LOCK(name, 10)` / `RELEASE_LOCK(name)`.
- **SQLite** — no-op (single-writer engine).

When the lock cannot be acquired the command exits with `EOUTLET_LOCK_BUSY`. `run`, `rollback`, `reset`, `refresh` and `fresh` are intentionally not wrapped (they are interactive flows).

### New `_migrations` columns

The migrations table is auto-upgraded on `initialize()` with three ISO-8601 timestamp columns:

- `started_at` — set when a migration begins executing.
- `finished_at` — set when a migration completes successfully.
- `rolled_back_at` — set when a migration is rolled back (manually via `resolve --rolled-back` or via `rollback`).

### Missing migrations

`status()` now flags rows whose file is no longer present on disk with the status `missing`. The same list is available programmatically via `manager.getMissingMigrations()`.

## Deployment options (v14.8.0)

### `outlet-migrate deploy`

Non-interactive command for CI/CD pipelines. Runs only pending migrations and:

- Never produces an automatic backup.
- Never prompts (no production confirmation).
- Refuses to run when at least one previously **failed** migration exists in the `_migrations` table, unless `--allow-failed` is passed.
- Honors `--pretend` and `--allow-drift`.

```bash
outlet-migrate deploy
outlet-migrate deploy --pretend
outlet-migrate deploy --allow-drift
outlet-migrate deploy --allow-failed
```

### `outlet-migrate resolve`

Manual recovery for production. Lets you reconcile the `_migrations` table after a hot-fix without re-executing SQL.

```bash
# Mark a migration as applied without running its up()
outlet-migrate resolve --applied=2026_05_22_create_users.js

# Mark a previously failed/completed migration as rolled back
outlet-migrate resolve --rolled-back=2026_05_22_create_users.js
```

Throws `EOUTLET_NOT_FOUND` if the target migration does not exist in `_migrations`.

### Advisory lock

`deploy` and `resolve` wrap their work in an advisory lock to prevent two CI runners from racing:

- **PostgreSQL** — `pg_advisory_lock` / `pg_advisory_unlock` (lock id derived from the migrations table name).
- **MySQL** — `GET_LOCK(name, 10)` / `RELEASE_LOCK(name)`.
- **SQLite** — no-op (single-writer engine).

When the lock cannot be acquired the command exits with `EOUTLET_LOCK_BUSY`. `run`, `rollback`, `reset`, `refresh` and `fresh` are intentionally not wrapped (they are interactive flows).

### New `_migrations` columns

The migrations table is auto-upgraded on `initialize()` with three ISO-8601 timestamp columns:

- `started_at` — set when a migration begins executing.
- `finished_at` — set when a migration completes successfully.
- `rolled_back_at` — set when a migration is rolled back (manually via `resolve --rolled-back` or via `rollback`).

### Missing migrations

`status()` now flags rows whose file is no longer present on disk with the status `missing`. The same list is available programmatically via `manager.getMissingMigrations()`.

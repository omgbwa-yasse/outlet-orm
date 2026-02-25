# Changelog

All notable changes to this project will be documented in this file.

## [5.4.0] - 2026-02-25

### ✨ New Feature — Database Reverse Engineering (`bin/reverse.js`)

#### Overview
Added `bin/reverse.js` — a complete reverse-engineering tool that introspects an
existing database (or SQL dump file) and automatically generates:

- **Migration files** with fluent `up()` / `down()` code using the Schema Blueprint API
- **Seeder files** containing the actual row data extracted from each table

#### CLI usage
```bash
node bin/reverse.js        # interactive menu
# or after npm install -g outlet-orm:
outlet-reverse
```

Menu options:
1. **Reverse from SQL file** — parses all `CREATE TABLE` statements and emits one migration per table
2. **Reverse from live database** — connects (MySQL / PostgreSQL / SQLite), fetches schema + optionally fetches rows, writes migrations and seeders

#### Exported utilities (testable API)
```js
const {
  parseCreateTable,    // CREATE TABLE SQL → { tableName, columns, foreignKeys }
  columnToBlueprint,   // column object → { method, args, modifiers }
  generateMigration,   // tableInfo → { filename, className, code }
  generateSeeder,      // (tableName, rows) → { filename, className, code }
  reverseFromSql,      // SQL dump string → migration array
} = require('./bin/reverse');
```

#### `parseCreateTable`
- Handles MySQL, PostgreSQL, and SQLite `CREATE TABLE` dialects
- Detects column types, `NOT NULL`, `DEFAULT`, `UNIQUE`, `AUTO_INCREMENT` / `AUTOINCREMENT`, `PRIMARY KEY`
- Extracts explicit `FOREIGN KEY … REFERENCES` constraints (including `CONSTRAINT name FOREIGN KEY` syntax)
- Strips SQL comments; respects nested parentheses (ENUM, CHECK, etc.)

#### `columnToBlueprint` — type mapping matrix
| SQL type | Blueprint method |
|---|---|
| `INT` / `INTEGER` autoincrement | `increments()` |
| `BIGINT` autoincrement | `bigIncrements()` |
| `TINYINT(1)` | `boolean()` |
| `TINYINT` | `tinyInteger()` |
| `SMALLINT` | `smallInteger()` |
| `INT` / `INTEGER` | `integer()` |
| `BIGINT` | `bigInteger()` |
| `FLOAT` / `DOUBLE` / `REAL` | `float()` |
| `DECIMAL(p,s)` / `NUMERIC(p,s)` | `decimal(p, s)` |
| `VARCHAR(n)` | `string(n)` |
| `CHAR(n)` | `char(n)` |
| `TEXT` / `LONGTEXT` / `MEDIUMTEXT` | `text()` |
| `BLOB` / `BINARY` / `BYTEA` | `binary()` |
| `DATE` | `date()` |
| `DATETIME` | `dateTime()` |
| `TIMESTAMP` | `timestamp()` |
| `TIME` | `time()` |
| `JSON` / `JSONB` | `json()` |
| `UUID` | `uuid()` |
| `BOOLEAN` / `BOOL` | `boolean()` |
| `ENUM(…)` | `string()` (fallback) |

Modifiers applied inline: `.nullable()`, `.unique()`, `.default(value)`

#### `generateMigration`
- Timestamp-prefixed filename: `YYYYMMDD_HHmmss_create_<table>_table.js`
- PascalCase class name: `blog_posts` → `CreateBlogPostsTable`
- Detects `created_at` + `updated_at` pair → emits `table.timestamps()` shorthand
- Emits `table.foreign(col).references(refCol).on(refTable)` for each FK
- `down()` calls `schema.dropIfExists(tableName)`

#### `generateSeeder`
- Serialises an array of row objects via `JSON.stringify`
- Generated `run(db)` iterates rows and calls `db.table(name).insert(row)`

### 🧪 Tests
Added `tests/Reverse.test.js` with **61 tests** covering:
- `parseCreateTable`: MySQL dialect, SQLite dialect, explicit CONSTRAINT FK, DEFAULT values, null/invalid input
- `columnToBlueprint`: full type matrix (17 type tests) + nullable/unique/default modifiers + PK guard
- `generateMigration`: filename format, PascalCase, up/down content, timestamps shorthand, inline modifiers, FK constraint line, outlet-orm import, valid JS output
- `generateSeeder`: filename, class name, row data, empty array, valid JS output
- `reverseFromSql`: multi-table batch, empty/null input
- **Integration** (SQLite in-memory): create real tables, reverse-engineer them, verify generated code parses as valid JavaScript

**Total test count: 119 (58 previous + 61 new), all passing.**

## [5.3.0] - 2026-02-25

### 🔐 Security Hardening — Audit v5.2.0 Remediation

#### S-01 — `quoteIdentifier` strict allowlist (Schema.js)
- Removed the two-step blocklist fallback from `quoteIdentifier` in `Schema/Schema.js`. Any table or column name failing the strict regex `^[a-zA-Z_][a-zA-Z0-9_]*$` now throws immediately with no silent pass-through. Aligns with the CRIT-01 fix applied to `sanitizeIdentifier` in v5.2.0.

#### S-02 — DDL injection via `onDelete`/`onUpdate` in `ForeignKeyDefinition`
- Added allowlist validation in `ForeignKeyDefinition.onDelete()` and `onUpdate()`. Only the five standard referential actions are accepted: `CASCADE`, `RESTRICT`, `SET NULL`, `NO ACTION`, `SET DEFAULT`. Any other value throws immediately.

#### S-03 — Mass-assignment bypass in `QueryBuilder.insert()`
- Added the same `fillable` guard to `insert()` that was added to `update()` in v5.2.0. When `model.fillable` is non-empty, only listed fields are sent to `INSERT`. Applies to both single-object and batch-array inserts.

#### S-04 — Information disclosure in error messages
- `sanitizeIdentifier` and `assertIdentifier` no longer echo the raw identifier value in thrown error messages. Error messages are now generic (`'Invalid SQL identifier'`) to avoid confirming attacker-supplied values in API responses.

#### S-05 — Missing security warnings on raw execution methods
- Added prominent `⚠️ SECURITY WARNING` JSDoc comment to `executeRawQuery()` and `execute()` in `DatabaseConnection.js` making it explicit that `sql` must never contain user-controlled data.

### 🔐 Security Hardening (Full Audit Remediation)

#### CRIT-01 — `sanitizeIdentifier` strict allowlist
- Removed the two-step blocklist fallback. Any identifier that does not match the strict regex `^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$` now **throws immediately** — no silent pass-through.

#### HIGH-01 — `MigrationManager` SQL injection via `migrationsTable`
- Added `migrationsTable` validation in the `MigrationManager` constructor. Invalid names throw an error at construction time.
- The constructor now accepts a third parameter: `migrationsTable` (default: `'migrations'`).

#### HIGH-02 — Mass-assignment bypass in `QueryBuilder.update()` / `Model.update()`
- `QueryBuilder.update()` now applies `model.fillable` filtering before executing the UPDATE query.
- Only fields listed in `fillable` (when non-empty) are sent to the database — all other keys are silently dropped.

#### MED-01 — Unsanitized relation properties in `withCount`, `whereHas`, `whereDoesntHave`
- Added `assertIdentifier()` helper in `QueryBuilder.js` to validate all interpolated table/column names (`Model.table`, `relation.pivot`, `foreignKey`, `localKey`, etc.) before building subqueries.

#### MED-02 — ReDoS in `Model._validateRule` via `new RegExp(ruleParam)`
- Wrapped the dynamic `new RegExp(ruleParam)` construction in a `try/catch`. Invalid or catastrophic regexes no longer crash the server — they return a validation error message instead.

#### LOW-01 — Unbounded `queryLog` memory growth
- Added `MAX_QUERY_LOG_SIZE = 1000` cap. When the log exceeds this limit, the oldest entry is evicted automatically.

#### LOW-02 — Fragile FK heuristic in `whereHas` / `whereDoesntHave`
- Replaced the `relatedTable.replace(/s$/, '')` heuristic with proper relation-type detection using `relation.child` (set on `BelongsToRelation`, absent on `HasOne`/`HasMany`). Eliminates incorrect JOINs for tables like `news`, `address`, `status`.

## [5.0.0] - 2026-02-01

### 🏗️ Major Refactoring - Project Structure

#### Centralized `src/` Directory
- **BREAKING**: All source code is now centralized in `src/`
- Moved `lib/Database/`, `lib/Migrations/`, `lib/Schema/` → `src/`
- New exports available from main module:
  - `Schema`, `Blueprint`, `ColumnDefinition`, `ForeignKeyDefinition`
  - `Migration`, `MigrationManager`

#### New Import Style (Recommended)
```javascript
// ✅ New way (v5.0.0+)
const { 
  Model, 
  DatabaseConnection, 
  Migration, 
  MigrationManager, 
  Schema 
} = require('outlet-orm');
```

#### Backward Compatibility
- `lib/` paths still work with **deprecation warnings**
- Will be removed in v6.0.0
- Migration guide: Replace `require('outlet-orm/lib/...')` with `require('outlet-orm')`

### ⚠️ Breaking Changes
- Package version bumped to 5.0.0 (major release)
- `lib/` folder is deprecated (warnings emitted on import)
- Migration files should use `const { Migration } = require('outlet-orm');`

### 📦 Package Updates
- Removed `lib/**` from `files` in package.json
- Updated lint scripts to exclude `lib/`

---

## [4.1.0] - 2026-01-30

### 🚀 New Features
- **Copilot Skills Integration**: Added `.copilot/skills/outlet-orm/` for AI agent documentation access
- Improved project structure for better AI-assisted development

### 📚 Documentation
- Moved skill documentation to standard `.copilot/skills/` location
- AI agents can now automatically discover and use Outlet ORM documentation

---

## [4.0.0-alpha.1] - 2026-01-30

### 🚀 Major Features - TypeScript Enhancement

#### Generic Model Attributes
- **`Model<TAttributes>`**: Models can now be typed with their attribute interfaces
- **Type-safe `getAttribute<K>()`**: Returns the correct type based on your interface
- **Type-safe `setAttribute<K>()`**: Validates attribute names and types at compile time
- **`BaseModelAttributes`**: Base interface with common fields (id, created_at, updated_at, deleted_at)

#### Schema Builder Types
- **`SchemaBuilder`**: Interface for schema operations (create, drop, table, rename)
- **`TableBuilder`**: Complete interface with all column types and modifiers
- **`ColumnBuilder`**: Chainable interface for column definition (nullable, default, unique, etc.)
- **`ForeignKeyBuilder`**: Chainable interface for foreign key constraints
- **`MigrationInterface`**: Standard interface for typed migrations with `up()` and `down()`

#### Type Safety Improvements
- **`ModelEventName`**: Union type for all model events (creating, created, updating, etc.)
- **`WhereOperator`**: Union type for all comparison operators (=, !=, >, <, LIKE, etc.)
- **`InsertResult`**: Typed result with `insertId: number | string` and `affectedRows`
- **`UpdateResult` / `DeleteResult`**: Typed results with `affectedRows` and `changedRows`
- **`ValidationRule`**: Extended with missing rules (url, array, integer, numeric, alpha, etc.)

### 🐛 Bug Fixes
- Fixed duplicate `updating` key in Model.js eventListeners object (was missing `updated` event)

### 📚 Documentation
- Updated [docs/TYPESCRIPT.md](docs/TYPESCRIPT.md) with Generic Model and Schema Builder sections
- Created [docs/SKILL/outlet-orm/TYPESCRIPT.md](docs/SKILL/outlet-orm/TYPESCRIPT.md) skill guide
- Added [examples/typescript-typed-model.ts](examples/typescript-typed-model.ts) example
- Added [examples/typescript-migration.ts](examples/typescript-migration.ts) example

### ⚠️ Breaking Changes
- Minimum TypeScript version: 4.7+
- If extending Model with custom generics, you may need to update your type signatures

### 📦 Dependencies
- Added `typescript: ^5.3.0` as devDependency
- Added `@types/node: ^20.10.0` as devDependency

---

## [3.2.0] - 2026-01-09

### 📚 Documentation
- Fixed missing model definitions in all documentation examples
- All code examples now show complete, runnable code
- Added `Post`, `Profile`, `Role`, `Comment` definitions where referenced
- Improved TypeScript examples with proper model ordering

---

## [3.1.0] - 2026-01-09

### 🚀 New Features

#### Simplified Connection Access
- **`Model.getConnection()`**: New static method to access the database connection directly from Model
- No need to import `DatabaseConnection` for most use cases
- Automatic connection initialization from `.env` file

### 📚 Documentation
- Updated all documentation to use simplified `Model.getConnection()` pattern
- Improved examples showing automatic connection from `.env`
- Added TypeScript types for `getConnection()` method

### 🔧 Improvements
- Cleaner API: Users only need to import `Model` for most operations
- Better developer experience with less boilerplate code
- Consistent documentation across all guides

---

## [3.0.0] - 2025-01-08

### 🚀 Major Features

#### Transactions
- **`beginTransaction()`**: Start a database transaction
- **`commit()`**: Commit the current transaction
- **`rollback()`**: Rollback the current transaction
- **`transaction(callback)`**: Execute callback in transaction with auto commit/rollback

#### Soft Deletes
- **`softDeletes` property**: Enable soft deletes on models
- **`withTrashed()`**: Include soft deleted records in queries
- **`onlyTrashed()`**: Query only soft deleted records
- **`restore()`**: Restore a soft deleted model
- **`forceDelete()`**: Permanently delete a soft deleted model
- **`trashed()`**: Check if model is soft deleted

#### Global Scopes
- **`addGlobalScope(name, callback)`**: Add a global query scope
- **`removeGlobalScope(name)`**: Remove a global scope
- **`withoutGlobalScope(name)`**: Query without a specific scope
- **`withoutGlobalScopes()`**: Query without any global scopes

#### Events/Hooks
- **`creating` / `created`**: Fired around model creation
- **`updating` / `updated`**: Fired around model updates
- **`saving` / `saved`**: Fired around any save operation
- **`deleting` / `deleted`**: Fired around deletion
- **`restoring` / `restored`**: Fired around soft delete restoration
- **`on(event, callback)`**: Generic event listener registration

#### Validation
- **`rules` property**: Define validation rules on models
- **`validate()`**: Validate model attributes, returns `{ valid, errors }`
- **`validateOrFail()`**: Validate or throw error with validation errors
- Built-in rules: `required`, `string`, `number`, `email`, `boolean`, `date`, `min`, `max`, `in`, `regex`

#### Query Logging
- **`DatabaseConnection.enableQueryLog()`**: Enable query logging
- **`DatabaseConnection.disableQueryLog()`**: Disable query logging
- **`DatabaseConnection.getQueryLog()`**: Get array of logged queries with SQL, params, duration, timestamp
- **`DatabaseConnection.flushQueryLog()`**: Clear the query log
- **`DatabaseConnection.isLogging()`**: Check if logging is enabled

### 🔧 Improvements

#### PostgreSQL Pool Support
- Replaced `pg.Client` with `pg.Pool` for better connection management
- Improved performance and connection reuse
- Configurable pool size via `connectionLimit`

#### SQL Injection Protection
- Added `sanitizeIdentifier()` function for table/column names
- Detection of common SQL injection patterns
- Automatic identifier validation

#### Complete Exports
- Added missing relation exports: `MorphOneRelation`, `MorphManyRelation`, `MorphToRelation`, `HasOneThroughRelation`

### 📝 Documentation
- Comprehensive README updates for all new features
- Updated API reference tables
- Added examples for transactions, soft deletes, scopes, events, validation, and query logging
- Updated TypeScript definitions

### Breaking Changes
- None - fully backward compatible with v2.x

## [2.5.3] - 2025-01-XX

### Fixed
- Added missing import statements in README examples

## [2.5.2] - 2025-01-XX

### Enhanced
- Comprehensive README update with complete documentation

## [2.5.1] - 2025-11-12

### Added
- **`withHidden()` method**: Include hidden attributes in query results
- **`withoutHidden(show)` method**: Control visibility of hidden attributes with boolean parameter
- Comprehensive test suite for hidden attributes feature (10 new tests)
- Working demo example: `examples/hidden-attributes-demo.js`
- TypeScript definitions for new methods

### Enhanced
- `toJSON()` method now respects `_showHidden` flag for dynamic attribute visibility
- QueryBuilder hydration transfers visibility state to model instances
- Documentation updated with usage examples for authentication scenarios

### Documentation
- Added hidden attributes visibility control examples to README
- Added API reference for `withHidden()` and `withoutHidden()`
- Created `HIDDEN_ATTRIBUTES_IMPLEMENTATION.md` with complete implementation details

## [1.0.0] - 2025-10-11

### Added
- Initial release
- Model class with Active Record pattern
- Query Builder with fluent interface
- DatabaseConnection supporting MySQL, PostgreSQL, and SQLite
- Relationships: hasOne, hasMany, belongsTo, belongsToMany
- Eager loading with `with()` method
- Attribute casting (int, float, boolean, json, date, etc.)
- Hidden attributes for JSON serialization
- Timestamps support (created_at, updated_at)
- Mass assignment with fillable attributes
- CRUD operations
- Complex query building (where, whereIn, whereNull, orderBy, limit, offset)
- Pagination support
- Dirty attribute tracking
- **CLI Tools**: outlet-init, outlet-convert, outlet-migrate
- **Migrations System**: Complete Laravel-inspired migration system
- **Schema Builder**: Fluent API for table/column management
- **Automatic Relation Detection**: Smart foreign key analysis for automatic relation generation
- Examples and comprehensive documentation (6 guides)

### Features
- Laravel Eloquent-inspired API
- Support for multiple database drivers
- Connection pooling for MySQL
- Automatic timestamp management
- Relationship eager loading to prevent N+1 queries
- Type casting for database values
- **Automatic relation generation** from SQL schema (belongsTo, hasMany, hasOne, belongsToMany)
- **Migration management** with batch tracking and rollback
- **Interactive CLI** for project initialization and SQL conversion
- Secure mass assignment protection

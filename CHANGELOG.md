# Changelog

All notable changes to this project will be documented in this file.

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

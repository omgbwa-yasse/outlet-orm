# Changelog

All notable changes to this project will be documented in this file.

## [3.0.0] - 2025-01-XX

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

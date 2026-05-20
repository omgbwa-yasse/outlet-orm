# Models Reference

## Contents

- When to read this document
- Scope
- Defining a model
- Construction and attribute access
- Static CRUD
- Supported casts
- Hidden, visible, serialization
- Soft deletes
- Validation
- Events and observers
- Scopes
- Connection and related utilities
- Recommended patterns
- Source files to read

## When to read this document

Read this resource if the request is about `Model`, `DatabaseConnection`, model attributes, casts, validation, serialization, scopes, or soft deletes.

Do not use it as the main entry point for:

- a pure builder query without questions about the model lifecycle: see `QUERIES.md`
- relationships and eager loading: see `RELATIONS.md`
- migrations and schema: see `MIGRATIONS.md`

## Scope

This document covers the core ORM module around `Model` and the connection/utility layer directly needed by models.

Covered classes and surfaces:

- `Model`
- `DatabaseConnection`
- `QueryBuilderError`
- static attributes and serialization / validation / event behavior

## Defining a model

Standard pattern:

```js
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
  static primaryKey = 'id';
  static timestamps = true;
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password'];
  static casts = {
    id: 'int',
    email_verified: 'boolean'
  };
  static appends = [];
  static softDeletes = false;
  static connection = db;
  static rules = {};
}
```

Main static attributes:

- `table` - SQL table name
- `primaryKey` - primary key, `id` by default
- `timestamps` - enables `created_at` / `updated_at` handling
- `fillable` - mass assignment whitelist
- `hidden` - hidden in `toJSON()`
- `casts` - type conversion
- `appends` - computed attributes added during serialization
- `softDeletes` - enables `deleted_at`
- `DELETED_AT` - soft delete column name
- `connection` - `DatabaseConnection` instance
- `rules` - validation rules

## Construction and attribute access

Instances are returned through a `Proxy`, which allows:

- direct reads: `user.name`
- direct writes: `user.name = 'Ada'`
- compatibility with `getAttribute()` / `setAttribute()`
- preservation of instance methods and relationship methods

Important instance methods:

- `fill(attributes)`
- `setAttribute(key, value)`
- `getAttribute(key)`
- `castAttribute(key, value)`
- `save()`
- `destroy()`
- `toJSON()`
- `load(...relations)`
- `fresh(...relations)`
- `refresh()`
- `replicate(...except)`
- `only(...keys)`
- `except(...keys)`
- `makeVisible(...attrs)`
- `makeHidden(...attrs)`
- `getDirty()`
- `isDirty()`
- `wasChanged(attr?)`
- `getChanges()`
- `is(model)` / `isNot(model)`

## Static CRUD

Most used static methods:

- `setConnection(connection)`
- `getConnection()`
- `query()`
- `all()`
- `find(id)`
- `findOrFail(id)`
- `where(...)`
- `create(attributes)`
- `insert(rows)`
- `update(attributes)`
- `updateById(id, attributes)`
- `updateAndFetchById(id, attributes, relations?)`
- `delete()`
- `first()`
- `orderBy(column, direction?)`
- `limit(value)`
- `offset(value)`
- `paginate(page?, perPage?)`
- `whereIn(column, values)`
- `whereNull(column)`
- `whereNotNull(column)`
- `count()`

Useful persistence helpers:

- `firstOrCreate(conditions, values?)`
- `firstOrNew(conditions, values?)`
- `updateOrCreate(conditions, values?)`
- `upsert(rows, uniqueBy, update?)`
- `cursor(chunkSize?)`
- `with(...relations)`
- `withHidden()`
- `withoutHidden(show?)`

## Supported casts

Publicly exposed cast types:

- `int`, `integer`
- `float`, `double`
- `string`
- `bool`, `boolean`
- `array`
- `json`
- `date`
- `datetime`
- `timestamp`

Use cases:

- reading integers or booleans from SQLite / MySQL
- JSON objects through `json`
- normalizing dates for serialization

## Hidden, visible, serialization

Rules:

- `hidden` masks fields in `toJSON()` by default
- `withHidden()` forces exposure in query results
- `withoutHidden(false)` reapplies explicit hiding
- `makeVisible()` and `makeHidden()` act at instance scope
- `appends` adds computed attributes to JSON output

Typical cases:

- hide `password`, `api_token`, and technical secrets
- expose a hashed password only in an internal authentication flow

## Soft deletes

Activation:

```js
class Post extends Model {
  static softDeletes = true;
}
```

Capabilities:

- `withTrashed()`
- `onlyTrashed()`
- `trashed()`
- `restore()`
- `forceDelete()`

Precondition: the table must contain `deleted_at` or the column defined by `DELETED_AT`.

## Validation

Model-integrated validation:

- `static rules`
- `validate()`
- `validateOrFail()`

The structure returned by `validate()` contains:

- `valid`
- `errors`

## Events and observers

Supported model events:

- `creating`, `created`
- `updating`, `updated`
- `saving`, `saved`
- `deleting`, `deleted`
- `restoring`, `restored`

APIs:

- `Model.on(event, callback)`
- helpers specialises `creating(cb)`, `saved(cb)`, etc.
- `Model.observe(observer)`

Callbacks can return `false` to cancel an operation.

## Scopes

Global scopes:

- `addGlobalScope(name, callback)`
- `removeGlobalScope(name)`
- `withoutGlobalScope(name)`
- `withoutGlobalScopes()`

Local scopes:

- defined through conventional static methods on the model
- verified by the `NewEvolutions.test.js` suite

## Connection and related utilities

`DatabaseConnection` is the central dependency for models:

- `connect()`
- `close()` / `disconnect()`
- `beginTransaction()`
- `commit()`
- `rollback()`
- `transaction(callback)`
- `afterCommit(callback)`
- `savepoint(name)`
- `rollbackTo(name)`
- `releaseSavepoint(name)`
- `setIsolationLevel(level)`

Logging:

- `DatabaseConnection.enableQueryLog()`
- `DatabaseConnection.disableQueryLog()`
- `DatabaseConnection.getQueryLog()`
- `DatabaseConnection.flushQueryLog()`
- `DatabaseConnection.isLogging()`

## Recommended patterns

- define `connection` on the model or via `Model.setConnection()` at bootstrap
- keep `fillable` strict for user-driven writes
- reserve `withHidden()` for controlled internal use
- prefer `firstOrCreate` / `updateOrCreate` over fragile read-then-write sequences
- use `fresh()` for a new object and `refresh()` to reload the current instance

## Source files to read

- `src/Model.js`
- `src/DatabaseConnection.js`
- `types/index.d.ts`
- `tests/Model.test.js`
- `tests/PropertyAccess.test.js`
- `tests/WithHidden.test.js`
- `tests/TimestampsDisabled.test.js`
- `tests/NewFeatures.test.js`
- `tests/NewEvolutions.test.js`

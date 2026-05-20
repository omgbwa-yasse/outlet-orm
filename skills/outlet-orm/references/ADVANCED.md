# Advanced Reference

## When to read this document

Read this resource if the request is about fluent DB objects (`View`, `Trigger`, `Procedure`, `Function`, `Transaction`), `useSchema(...)`, savepoints, isolation levels, `UnsupportedCapabilityError`, or `RawExpression`.

Do not use it as the main entry point for:

- model CRUD and attributes: see `MODELS.md`
- standard structural migrations: see `MIGRATIONS.md`
- backups / restores: see `BACKUPS.md`

## Scope

This document covers advanced surfaces that go beyond classic ORM CRUD:

- fluent DB objects
- transactions, savepoints, isolation levels
- `UnsupportedCapabilityError`
- `RawExpression`
- recent compatibility helpers around schema and migrations

## DB objects

Public exports:

- `View`
- `Trigger`
- `Procedure`
- `Function`
- `Transaction`
- `useSchema(schemaOrDb)`

Associated capabilities:

- create / replace / drop views
- create / drop / list triggers
- create / drop stored procedures
- create / drop stored functions
- drive a transaction through a dedicated builder

Typical use case:

```js
const { useSchema } = require('outlet-orm');

const { View, Trigger } = useSchema(db);
```

## Transactions

Low-level surfaces:

- `beginTransaction()`
- `commit()`
- `rollback()`
- `transaction(callback)`
- `afterCommit(callback)`
- `savepoint(name)`
- `rollbackTo(name)`
- `releaseSavepoint(name)`
- `setIsolationLevel(level)`

Available constants:

- `IsolationLevel.READ_UNCOMMITTED`
- `IsolationLevel.READ_COMMITTED`
- `IsolationLevel.REPEATABLE_READ`
- `IsolationLevel.SERIALIZABLE`

Notes:

- SQLite does not accept every isolation level
- some stored/procedural capabilities depend on the driver

## UnsupportedCapabilityError

This error is publicly exposed to signal that a requested capability is not available on the current driver.

Typical cases:

- unsupported isolation level on SQLite
- some advanced DDL objects on a limited driver
- altering CHECK constraints depending on the dialect

## RawExpression

Usage:

- intentionally inject an SQL expression into a clause or source when the builder allows it
- handle legitimate needs not covered by a named helper

Rule of thumb:

- use it surgically
- do not replace existing builder APIs with `RawExpression` when an official helper already exists

## Recent compatibility helpers

Useful helpers added in the 14.x / 15.x line:

- `Schema.hasIndex(table, indexName)` / `indexExists`
- `Schema.dropIndex({ name: 'idx_literal' })`
- `Migration.query(table)` / `Migration.table(table)`
- `Migration.log/info/warn(...)`
- `QueryBuilder` standalone mutations
- `timestamps()` overloads

## Recommendations

- keep DB objects in versioned migrations rather than ad hoc scripts
- explicitly throw `UnsupportedCapabilityError` in your extensions if you propagate the same multi-driver contract
- wrap `RawExpression` usage behind named application helpers when it becomes frequent

## Source files to read

- `src/index.js`
- `src/Objects/*`
- `src/Schema/Schema.js`
- `src/DatabaseConnection.js`
- `src/RawExpression.js`
- `tests/DatabaseObjects.test.js`
- `tests/FluentDbObjects.test.js`
- `tests/FluentConstraints.test.js`
- `tests/NewBypassHelpers.test.js`

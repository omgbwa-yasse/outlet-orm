# Data Model: Native SELECT Support (StandaloneQueryBuilder)

**Feature**: `002-native-select-support`  
**Phase**: 1 — Design  
**Date**: 2026-05-18

---

## Entities

### 1. `StandaloneQueryBuilder`

**File**: `src/StandaloneQueryBuilder.js`  
**Role**: Fluent SELECT query builder that operates on a `DatabaseConnection` without requiring a Model class. Returned by `db.from(source)`.

#### Internal State

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `_connection` | `DatabaseConnection` | (required) | The database connection to execute against. |
| `_source` | `string \| RawExpression \| StandaloneQueryBuilder` | (required) | The FROM target: a table name string, a raw SQL fragment, or a nested builder. |
| `_consumed` | `boolean` | `false` | `true` after any terminal method has been called. Prevents reuse. |
| `selectedColumns` | `Array<string \| RawExpression>` | `['*']` | Columns for the SELECT clause. |
| `distinctFlag` | `boolean` | `false` | Whether SELECT DISTINCT is used. |
| `wheres` | `Array<WhereDescriptor>` | `[]` | WHERE clause descriptors (same shape as `QueryBuilder.wheres`). |
| `joins` | `Array<JoinDescriptor>` | `[]` | JOIN clause descriptors (same shape as `QueryBuilder.joins`). |
| `groupBys` | `Array<string>` | `[]` | GROUP BY column references. |
| `havings` | `Array<HavingDescriptor>` | `[]` | HAVING clause descriptors (`type: 'basic' \| 'count' \| 'raw'`). |
| `orders` | `Array<OrderDescriptor>` | `[]` | ORDER BY descriptors (same shape as `QueryBuilder.orders`). |
| `limitValue` | `number \| null` | `null` | LIMIT value. |
| `offsetValue` | `number \| null` | `null` | OFFSET value. |
| `_subParams` | `Array` | `[]` | Params prepended from subquery source (used when `_source` is a nested builder). |

#### Descriptor shapes (internal, no class)

**WhereDescriptor** — matches existing `QueryBuilder.wheres` entries:
```js
// basic:     { type: 'basic',   column, operator, value, boolean }
// in:        { type: 'in',      column, values, boolean }
// notIn:     { type: 'notIn',   column, values, boolean }
// null:      { type: 'null',    column, boolean }
// notNull:   { type: 'notNull', column, boolean }
// between:   { type: 'between', column, values, boolean }
// like:      { type: 'like',    column, value, boolean }
// raw:       { type: 'raw',     sql, bindings, boolean }
```

**JoinDescriptor**:
```js
// { table, first, operator, second, type: 'inner' | 'left' }
```

**HavingDescriptor**:
```js
// basic:  { type: 'basic', column, operator, value }
// count:  { type: 'count', column, operator, value }
// raw:    { type: 'raw', sql, bindings }
```

**OrderDescriptor**:
```js
// { column, direction }   or   { type: 'raw', sql }
```

#### Methods

**Chainable (return `this`)**:

| Method | Signature | Description |
|--------|-----------|-------------|
| `select` | `(...columns: string[]) → this` | Sets selected columns (replaces `['*']`). |
| `selectRaw` | `(expression: string) → this` | Appends a `RawExpression` to selected columns. |
| `distinct` | `() → this` | Enables `SELECT DISTINCT`. |
| `where` | `(column, operatorOrValue, value?) → this` | Adds a basic AND WHERE clause. |
| `orWhere` | `(column, operatorOrValue, value?) → this` | Adds a basic OR WHERE clause. |
| `whereIn` | `(column, values[]) → this` | Adds `column IN (...)`. |
| `whereNotIn` | `(column, values[]) → this` | Adds `column NOT IN (...)`. |
| `whereNull` | `(column) → this` | Adds `column IS NULL`. |
| `whereNotNull` | `(column) → this` | Adds `column IS NOT NULL`. |
| `whereBetween` | `(column, [min, max]) → this` | Adds `column BETWEEN ? AND ?`. |
| `whereLike` | `(column, value) → this` | Adds `column LIKE ?`. |
| `whereRaw` | `(sql, bindings?) → this` | Adds a raw AND WHERE fragment. |
| `orWhereRaw` | `(sql, bindings?) → this` | Adds a raw OR WHERE fragment. |
| `join` | `(table, first, operator, second) → this` | Adds INNER JOIN. |
| `leftJoin` | `(table, first, operator?, second) → this` | Adds LEFT JOIN. |
| `groupBy` | `(...columns: string[]) → this` | Appends GROUP BY columns. |
| `having` | `(column, operatorOrValue, value?) → this` | Adds HAVING basic clause. |
| `havingRaw` | `(sql, bindings?) → this` | Adds raw HAVING fragment. |
| `orderBy` | `(column, direction?) → this` | Appends ORDER BY clause (default `'asc'`). |
| `orderByRaw` | `(sql) → this` | Appends raw ORDER BY fragment. |
| `limit` | `(n: number) → this` | Sets LIMIT. |
| `offset` | `(n: number) → this` | Sets OFFSET. |

**Terminal (async, consume the instance)**:

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `get` | `() → Promise<Object[]>` | Array of plain row objects | Executes and returns all matching rows. |
| `first` | `() → Promise<Object \| null>` | First row or `null` | Executes with `LIMIT 1` and returns first row or `null`. |
| `count` | `(column?) → Promise<number>` | Numeric count | `SELECT COUNT(*) AS aggregate` (or `COUNT(column)`). |
| `sum` | `(column: string) → Promise<number>` | Sum scalar | `SELECT SUM(column) AS aggregate`. |
| `avg` | `(column: string) → Promise<number>` | Average scalar | `SELECT AVG(column) AS aggregate`. |
| `min` | `(column: string) → Promise<number>` | Min scalar | `SELECT MIN(column) AS aggregate`. |
| `max` | `(column: string) → Promise<number>` | Max scalar | `SELECT MAX(column) AS aggregate`. |

**Internal private**:

| Method | Description |
|--------|-------------|
| `_assertNotConsumed()` | Throws `QueryBuilderError('This query builder instance has already been executed. Create a new instance via db.from().')` if `_consumed === true`. |
| `_resolveSource()` | Returns the `FROM` target as a `string` or `RawExpression`. Compiles nested builder sources. |
| `_compileToSQL()` | Returns `{ sql: string, params: Array }` — the raw SQL string + params for this builder (used when referenced as a subquery source). Does NOT mark the instance consumed. |
| `_buildQueryObj()` | Returns the query descriptor object passed to `connection.select()`. |

#### Validation rules

- `_source` (string path): validated by `sanitizeIdentifier` inside `DatabaseConnection.select()`; no extra validation needed in the builder itself.
- `_source` (raw/nested): no validation — user is responsible for raw correctness.
- Column arguments to `sum/avg/min/max`: validated via `sanitizeIdentifier()` before embedding in the raw expression string.
- `limit` and `offset` arguments: must be non-negative integers; throw `QueryBuilderError` if not.

#### State transitions

```
CREATED (via db.from())
    │
    ├── .select() / .where() / .join() / ... → CREATED (chainable, same instance)
    │
    └── .get() / .first() / .count() / .sum() / .avg() / .min() / .max()
            │
            ↓
        CONSUMED
            │
            └── any terminal call → throws QueryBuilderError
```

---

### 2. `QueryBuilderError`

**File**: `src/Errors/QueryBuilderError.js`  
**Role**: Custom error class for builder-level errors (invalid configuration, reuse of consumed instance, invalid argument types). Distinguishable from driver errors via `instanceof`.

#### Fields

| Field | Type | Description |
|-------|------|-------------|
| `message` | `string` | Human-readable error description. |
| `name` | `string` | Always `'QueryBuilderError'`. Set in constructor. |
| `stack` | `string` | Standard V8 stack trace (inherited from `Error`). |

#### Class definition

```js
class QueryBuilderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'QueryBuilderError';
  }
}
```

#### When thrown

| Scenario | Message |
|----------|---------|
| Reuse of consumed instance | `'This query builder instance has already been executed. Create a new instance via db.from().'` |
| Invalid source type in `db.from()` | `'Invalid source for db.from(): expected a table name string, RawExpression, or StandaloneQueryBuilder.'` |
| Non-integer `limit` / `offset` | `'limit() expects a non-negative integer.'` / `'offset() expects a non-negative integer.'` |

---

### 3. `DatabaseConnection.from()` — factory method

**File**: `src/DatabaseConnection.js` (addition to existing class)  
**Role**: Public entry point for standalone queries. Returns a fresh `StandaloneQueryBuilder` bound to this connection.

#### Signature

```js
from(source) → StandaloneQueryBuilder
```

#### Validation

- If `source` is not a string, `RawExpression`, or `StandaloneQueryBuilder` instance, throw `QueryBuilderError`.
- String sources that are empty throw `QueryBuilderError`.

#### Notes

- Returns a new instance on every call — callers cannot share a builder between concurrent queries.
- Does not establish a database connection itself (lazy connection is preserved).

---

### 4. `Schema` — introspection additions

**File**: `src/Schema/Schema.js` (additions to existing class)  
**Role**: Three new public methods as the spec-mandated API surface for schema introspection. Two existing methods (`hasTable`, `hasColumn`) are refactored to use `StandaloneQueryBuilder` internally.

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `tableExists` | `(tableName: string) → Promise<boolean>` | `true` if table exists | Delegates to `hasTable(tableName)`. Public alias. |
| `columnExists` | `(tableName, columnName) → Promise<boolean>` | `true` if column exists | Delegates to `hasColumn(tableName, columnName)`. Public alias. |
| `listTables` | `() → Promise<string[]>` | Array of table name strings | Driver-specific query returning all table names in the current database/schema. |

#### `listTables` driver-specific queries

| Driver | SQL | Result column |
|--------|-----|---------------|
| MySQL | `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE()` | `name` |
| SQLite | `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name` | `name` |
| PostgreSQL | `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public'` | `name` |

#### `hasTable` / `hasColumn` internal refactor

Both methods will be rewritten to use `StandaloneQueryBuilder` via `this.connection.from(...)` instead of calling `this.connection.execute()` directly with raw SQL strings. The external API (return type, arguments) stays identical.

---

## Relationships

```
DatabaseConnection
    │
    └── .from(source)
              │
              ▼
    StandaloneQueryBuilder
              │
              ├── _connection → DatabaseConnection
              │       │
              │       └── .select(table, queryObj) → uses buildSelectQuery + buildWhereClause
              │
              └── throws QueryBuilderError (on misuse)

Schema
    │
    ├── .tableExists()  → .hasTable()  → StandaloneQueryBuilder (internal)
    ├── .columnExists() → .hasColumn() → StandaloneQueryBuilder (internal)
    └── .listTables()               → StandaloneQueryBuilder (internal)
```

# Contract: StandaloneQueryBuilder Public API

**Feature**: `002-native-select-support`  
**Phase**: 1 — Design  
**Date**: 2026-05-18  
**Module**: `outlet-orm` → `StandaloneQueryBuilder`, `QueryBuilderError`

---

## Overview

`StandaloneQueryBuilder` is the fluent SELECT query builder for non-model tables. Instances are created exclusively via `DatabaseConnection.from()` (exposed as `db.from()` on the `DatabaseConnection` class). The class is also exported as a named export from the package root for instanceof checks and TypeScript usage.

Every instance is **single-use**: after a terminal method resolves (or rejects), calling any terminal method again throws `QueryBuilderError`.

---

## Entry Point

### `db.from(source)`

```
DatabaseConnection#from(source: string | RawExpression | StandaloneQueryBuilder)
  → StandaloneQueryBuilder
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source` | `string` | Yes | Table name. Validated by `sanitizeIdentifier` at execution time (alphanumeric + underscore + one dot). |
| `source` | `RawExpression` | Yes (alt) | Raw SQL table expression. Passed verbatim into the FROM clause. |
| `source` | `StandaloneQueryBuilder` | Yes (alt) | Nested builder used as a subquery. Compiled to `(SELECT ...) AS sub`. |

**Throws**: `QueryBuilderError` if `source` is `null`, `undefined`, empty string, or an unsupported type.  
**Returns**: A new, unconsumed `StandaloneQueryBuilder` instance bound to this connection.

---

## Chainable Methods

All chainable methods return `this` and may be called in any order before the terminal call.

---

### `.select(...columns)`

```
select(...columns: string[]) → StandaloneQueryBuilder
```

Replaces the default `['*']` column list. Each `column` is passed through `sanitizeIdentifier` at SQL-build time.

**Example**:
```js
db.from('orders').select('id', 'total', 'status')
```

---

### `.selectRaw(expression)`

```
selectRaw(expression: string) → StandaloneQueryBuilder
```

Appends a raw SQL expression to the SELECT clause. The expression is used verbatim — the caller is responsible for safety.

**Example**:
```js
db.from('orders').selectRaw('DATE(created_at) AS order_date, SUM(total) AS daily_total')
```

---

### `.distinct()`

```
distinct() → StandaloneQueryBuilder
```

Adds `DISTINCT` to the SELECT clause.

---

### `.where(column, operatorOrValue, value?)`

```
where(column: string, value: any) → StandaloneQueryBuilder
where(column: string, operator: string, value: any) → StandaloneQueryBuilder
```

Adds an AND WHERE condition. When called with two arguments the operator defaults to `'='`.

**Supported operators**: `'='`, `'!='`, `'<>'`, `'<'`, `'>'`, `'<='`, `'>='`, `'like'`, `'not like'`, `'in'`, `'not in'`, `'is null'`, `'is not null'`.

**Values are always parameterised** — they are never interpolated into the SQL string.

**Example**:
```js
.where('status', 'active').where('amount', '>', 100)
```

---

### `.orWhere(column, operatorOrValue, value?)`

```
orWhere(column: string, value: any) → StandaloneQueryBuilder
orWhere(column: string, operator: string, value: any) → StandaloneQueryBuilder
```

Same as `.where()` but joins with `OR`.

---

### `.whereIn(column, values)`

```
whereIn(column: string, values: any[]) → StandaloneQueryBuilder
```

Adds `column IN (?, ?, ...)`. Values are parameterised.

---

### `.whereNotIn(column, values)`

```
whereNotIn(column: string, values: any[]) → StandaloneQueryBuilder
```

Adds `column NOT IN (?, ?, ...)`.

---

### `.whereNull(column)`

```
whereNull(column: string) → StandaloneQueryBuilder
```

Adds `column IS NULL`.

---

### `.whereNotNull(column)`

```
whereNotNull(column: string) → StandaloneQueryBuilder
```

Adds `column IS NOT NULL`.

---

### `.whereBetween(column, range)`

```
whereBetween(column: string, range: [min: any, max: any]) → StandaloneQueryBuilder
```

Adds `column BETWEEN ? AND ?`. Both values are parameterised.

---

### `.whereLike(column, value)`

```
whereLike(column: string, value: string) → StandaloneQueryBuilder
```

Adds `column LIKE ?`. Value is parameterised.

---

### `.whereRaw(sql, bindings?)`

```
whereRaw(sql: string, bindings?: any[]) → StandaloneQueryBuilder
```

Appends a raw AND WHERE fragment. Bindings are inserted as positional parameters.

**Example**:
```js
.whereRaw('YEAR(created_at) = ?', [2024])
```

---

### `.orWhereRaw(sql, bindings?)`

```
orWhereRaw(sql: string, bindings?: any[]) → StandaloneQueryBuilder
```

Appends a raw OR WHERE fragment.

---

### `.join(table, first, operator, second)`

```
join(table: string, first: string, operator: string, second: string) → StandaloneQueryBuilder
```

Adds `INNER JOIN table ON first operator second`. All arguments are identifier-validated.

---

### `.leftJoin(table, first, operator?, second)`

```
leftJoin(table: string, first: string, operator: string, second: string) → StandaloneQueryBuilder
```

Adds `LEFT JOIN table ON first operator second`.

---

### `.groupBy(...columns)`

```
groupBy(...columns: string[]) → StandaloneQueryBuilder
```

Adds `GROUP BY column1, column2, ...`. Columns are identifier-validated.

---

### `.having(column, operatorOrValue, value?)`

```
having(column: string, value: any) → StandaloneQueryBuilder
having(column: string, operator: string, value: any) → StandaloneQueryBuilder
```

Adds a HAVING clause for aggregate filtering. Operator defaults to `'='`.

---

### `.havingRaw(sql, bindings?)`

```
havingRaw(sql: string, bindings?: any[]) → StandaloneQueryBuilder
```

Appends a raw HAVING fragment with parameterised bindings.

**Example**:
```js
.groupBy('region').havingRaw('COUNT(*) > ?', [5])
```

---

### `.orderBy(column, direction?)`

```
orderBy(column: string, direction?: 'asc' | 'desc') → StandaloneQueryBuilder
```

Appends an ORDER BY clause. `direction` defaults to `'asc'`.

---

### `.orderByRaw(sql)`

```
orderByRaw(sql: string) → StandaloneQueryBuilder
```

Appends a raw ORDER BY fragment.

---

### `.limit(n)`

```
limit(n: number) → StandaloneQueryBuilder
```

Sets the LIMIT clause. `n` must be a non-negative integer; throws `QueryBuilderError` otherwise.

---

### `.offset(n)`

```
offset(n: number) → StandaloneQueryBuilder
```

Sets the OFFSET clause. `n` must be a non-negative integer; throws `QueryBuilderError` otherwise.

---

## Terminal Methods (async)

All terminal methods:
1. Check `_consumed` — throw `QueryBuilderError` if already consumed.
2. Mark `_consumed = true`.
3. Delegate to `DatabaseConnection.select()` (which handles execution + logging).
4. Let driver errors propagate naturally (no try/catch around the driver call).

---

### `.get()`

```
get() → Promise<Object[]>
```

Executes the query and resolves with an array of plain row objects (one object per row). Empty result → resolves with `[]`.

---

### `.first()`

```
first() → Promise<Object | null>
```

Executes the query with `LIMIT 1` appended. Resolves with the first row or `null` if no rows matched.

---

### `.count(column?)`

```
count(column?: string) → Promise<number>
```

Executes `SELECT COUNT(column) AS aggregate` (or `COUNT(*)` if no column given). Returns the aggregate value as a `number`. The column argument (if provided) is validated via `sanitizeIdentifier`.

---

### `.sum(column)`

```
sum(column: string) → Promise<number>
```

Executes `SELECT SUM(column) AS aggregate`. Returns the aggregate value (may be `null` if no rows match — returned as `0` or the raw driver value depending on driver; callers should treat `null` as `0`).

---

### `.avg(column)`

```
avg(column: string) → Promise<number | null>
```

Executes `SELECT AVG(column) AS aggregate`. Returns the aggregate value.

---

### `.min(column)`

```
min(column: string) → Promise<any>
```

Executes `SELECT MIN(column) AS aggregate`. Returns the minimum value (type matches the column type).

---

### `.max(column)`

```
max(column: string) → Promise<any>
```

Executes `SELECT MAX(column) AS aggregate`. Returns the maximum value.

---

## `QueryBuilderError`

```
class QueryBuilderError extends Error
```

| Property | Type | Description |
|----------|------|-------------|
| `message` | `string` | Human-readable error detail. |
| `name` | `string` | Always `'QueryBuilderError'`. |
| `stack` | `string` | V8 stack trace. |

**Discriminating**: `err instanceof QueryBuilderError` returns `true` for builder-level errors, `false` for driver errors.

**Usage pattern**:
```js
try {
  const rows = await builder.get();
} catch (err) {
  if (err instanceof QueryBuilderError) {
    // misuse — wrong builder config
  } else {
    // SQL syntax error, network failure, etc.
  }
}
```

---

## Schema Introspection Methods

These methods live on `Schema` (accessed via `db.schema()` or `connection.schema()`):

### `schema.tableExists(tableName)`

```
tableExists(tableName: string) → Promise<boolean>
```

Returns `true` if the named table exists in the current database/schema.

### `schema.columnExists(tableName, columnName)`

```
columnExists(tableName: string, columnName: string) → Promise<boolean>
```

Returns `true` if the specified column exists in the named table.

### `schema.listTables()`

```
listTables() → Promise<string[]>
```

Returns an array of all user table names in the current database/schema. System tables are excluded (e.g., SQLite's `sqlite_*`, `information_schema` tables on MySQL).

---

## Exports from package root

```js
const { StandaloneQueryBuilder, QueryBuilderError } = require('outlet-orm');
```

Both classes are available as named exports from `src/index.js`. `StandaloneQueryBuilder` is for `instanceof` checks and TypeScript typing; direct instantiation by callers is possible but discouraged — use `db.from()` instead.

---

## Error conditions summary

| Scenario | Error type | Example message |
|----------|-----------|-----------------|
| `db.from(null)` | `QueryBuilderError` | `'Invalid source for db.from()'` |
| `.limit('ten')` | `QueryBuilderError` | `'limit() expects a non-negative integer.'` |
| Reuse after `.get()` | `QueryBuilderError` | `'This query builder instance has already been executed.'` |
| Invalid table name (SQL chars) | Driver `Error` or `sanitizeIdentifier` `Error` | `'Invalid SQL identifier'` |
| Bad SQL (syntax error) | Driver `Error` | e.g., `ER_PARSE_ERROR` |
| Connection failure | Driver `Error` | e.g., `ECONNREFUSED` |

---

## Versioning note

This API is introduced in **v14.3.0** (next minor version). `StandaloneQueryBuilder` and `QueryBuilderError` are additive exports; all existing exports remain unchanged.

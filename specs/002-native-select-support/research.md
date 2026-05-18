# Research: Native SELECT Support (StandaloneQueryBuilder)

**Feature**: `002-native-select-support`  
**Phase**: 0 — Unknowns resolved before design begins  
**Date**: 2026-05-18

---

## §1 — StandaloneQueryBuilder: Inheritance vs. Composition vs. Delegation

**Question**: The existing `QueryBuilder` is model-bound (requires `this.model`). How should `StandaloneQueryBuilder` share its query-state logic without inheriting model-specific behaviour (global scopes, soft deletes, hydration, relation loading)?

**Research findings**:
- `QueryBuilder` stores query state in plain object properties (`wheres`, `orders`, `joins`, etc.) and delegates SQL construction entirely to `DatabaseConnection.buildSelectQuery()` and `buildWhereClause()`.
- There is no framework or mixin system in place — the class is a self-contained CommonJS class.
- The SQL-building path lives in `DatabaseConnection`, not in `QueryBuilder`, so the builder itself is a *state accumulator*; the connection is the *compiler*.

**Decision**: **Independent class with structural parity** — `StandaloneQueryBuilder` duplicates the minimal state properties and chainable setter methods that are relevant to standalone SELECT queries. It does NOT extend `QueryBuilder` (that would drag in `whereHas`, `has`, `withTrashed`, `onlyTrashed`, global scope methods, `hydrate`, etc. which have no meaning without a model).

**Rationale**:
1. Avoids coupling: adding a breaking change to `QueryBuilder` would not affect `StandaloneQueryBuilder`.
2. The state properties are trivially small (8 arrays/values); duplication cost is negligible.
3. Execution path is shared at the point that matters: `connection.select(table, queryObj)` — `StandaloneQueryBuilder.get()` calls the exact same method on `DatabaseConnection` as model `QueryBuilder.get()` does (after `_applyGlobalScopes`).

**Alternatives considered**:
- *Extend `QueryBuilder`*: rejected — would force `StandaloneQueryBuilder` to accept a `model` constructor argument and inherit ~10 model-specific methods, creating a confusing API surface.
- *Extract a `BaseQueryBuilder` superclass*: rejected — this is premature abstraction for a library that has only one consumer of the base; out of scope per implementation discipline guidelines.

---

## §2 — Subquery in FROM clause (FR-002, User Story 4 SC3)

**Question**: The spec allows a nested builder or raw expression as the `source` to `db.from()`. The current `DatabaseConnection.select(table, query)` passes `table` through `sanitizeIdentifier()`, which only accepts plain identifiers (`table` or `schema.table`). A subquery `(SELECT ... FROM ...)` cannot pass that validation.

**Research findings**:
- `sanitizeIdentifier` returns `identifier.value` immediately if the argument is a `RawExpression` instance, bypassing the allowlist regex entirely.
- `db.from()` can therefore accept either:
  - A `string` table name (validated via `sanitizeIdentifier`).
  - A `RawExpression` instance (passed through verbatim into the `FROM` clause).
  - A `StandaloneQueryBuilder` instance (compiled to SQL inline via `toSQL()` and wrapped in a `RawExpression` as `(compiled_sql) AS sub`).

**Decision**: `db.from(source)` accepts `string | RawExpression | StandaloneQueryBuilder`. The `StandaloneQueryBuilder` constructor stores the raw source; before calling `connection.select()`, it resolves the table expression using `_resolveSource()`:

```js
_resolveSource() {
  if (typeof this._source === 'string') return this._source;           // normal table name
  if (this._source instanceof RawExpression) return this._source;      // passed through verbatim
  if (this._source instanceof StandaloneQueryBuilder) {
    const { sql, params } = this._source._compileToSQL();
    this._prependParams(params);
    return new RawExpression(`(${sql}) AS sub`);
  }
  throw new QueryBuilderError('Invalid source for db.from()');
}
```

When the source is a nested builder, its params are prepended to the outer query's params so positional placeholders stay correct.

**Rationale**: Zero changes to `buildSelectQuery` or `sanitizeIdentifier` — the `RawExpression` escape hatch is already designed for exactly this use case.

**Alternatives considered**:
- *Extend `buildSelectQuery` to detect subqueries*: rejected — requires modifying a method used by every existing model query, increasing regression risk with no benefit.
- *Defer subquery support to a later iteration*: acceptable as a risk mitigation, but implementable now at near-zero cost via the existing `RawExpression` path.

---

## §3 — HAVING raw expressions (FR-006)

**Question**: FR-006 requires raw expressions in HAVING position. The existing `buildSelectQuery` handles `havings` with `type: 'basic'` and `type: 'count'` only.

**Research findings**:
- The `buildWhereClause` method already handles `type: 'raw'` entries (raw SQL + bindings array).
- The HAVING builder in `buildSelectQuery` uses an identical pattern; adding a `type: 'raw'` branch is a two-line addition.
- The spec requires `havingRaw(sql, bindings)` on `StandaloneQueryBuilder`.

**Decision**: Add `havingRaw(sql, bindings = [])` to `StandaloneQueryBuilder` that pushes `{ type: 'raw', sql, bindings }` onto `this.havings`. Modify `buildSelectQuery` to handle `type: 'raw'` in the HAVING loop. Since `buildSelectQuery` is on `DatabaseConnection` and is already tested indirectly by all model queries, the change is low-risk (additive, behind the `type === 'raw'` branch).

**Alternatives considered**:
- *Wrap raw HAVING as a `RawExpression` column*: rejected — convoluted and misleading API.

---

## §4 — Error handling: QueryBuilderError vs. driver errors

**Question**: FR-015 requires a custom `QueryBuilderError` that is distinguishable via `instanceof`. Driver errors must pass through unwrapped. Where exactly is the boundary?

**Research findings**:
- The `DatabaseConnection` methods (`select`, `execute`, etc.) throw raw driver errors (e.g., `mysql2` throws `Error` with `code: 'ER_BAD_FIELD_ERROR'`). These are not caught or wrapped anywhere in the current codebase.
- The only place `UnsupportedCapabilityError` is thrown is inside `DatabaseConnection` when a driver lacks a feature (e.g., `pg` lacking `executeRawQuery`-style bulk ops). It is a subclass of `Error`.
- "Builder-level" errors are: invalid source type, invalid argument types (e.g., non-string table name when string expected), and reuse of a consumed instance (FR-012).

**Decision**:
- `QueryBuilderError extends Error` with `name = 'QueryBuilderError'`.
- Thrown ONLY inside `StandaloneQueryBuilder` for: (a) invalid source type in `_resolveSource()`, (b) call after `.get()` / `.first()` / aggregate on an already-consumed instance, (c) any argument validation the builder itself performs.
- Driver errors from `connection.select()` are NOT caught — they propagate naturally to the caller.
- `Schema` introspection wrappers do not catch errors either — they propagate from the driver.

**Rationale**: Clean error taxonomy. `instanceof QueryBuilderError` → misconfigured builder. Any other error → driver / network / SQL syntax issue. This matches the spec's clarification answer for Q4.

---

## §5 — Schema introspection API naming: tableExists / columnExists / listTables

**Question**: FR-007 defines `tableExists(name)`, `columnExists(table, column)`, `listTables()` as part of the public API. The existing `Schema` class already has `hasTable(tableName)` and `hasColumn(tableName, columnName)`. Should these be renamed, aliased, or are the new names separate methods?

**Research findings**:
- `hasTable` and `hasColumn` are used internally: `MigrationManager` calls `schema.hasTable(this.migrationsTable)` (line 26 in `MigrationManager.js`). Renaming would require updating that call.
- There is no `listTables()` method — `BackupManager._listTables()` is private and driver-specific.
- The spec clarification (Q3) explicitly states that schema methods should be refactored to use the fluent builder internally.

**Decision**:
1. Add `tableExists(name)` as a new public method on `Schema` that delegates to `hasTable(name)` (one-liner alias). Do NOT rename `hasTable` — it is used internally and renaming would be a breaking change for anyone calling it directly.
2. Add `columnExists(table, column)` as a public alias for `hasColumn(table, column)`.
3. Add `listTables()` as a new public method on `Schema` that uses `StandaloneQueryBuilder` internally (driver-specific query, returns `string[]`).
4. Refactor `hasTable` and `hasColumn` internally to use `StandaloneQueryBuilder` instead of raw `connection.execute()` strings — per FR-008 and the spec clarification.

**Rationale**: Preserves `hasTable`/`hasColumn` for backward compatibility while adding the spec-mandated names. The internal refactor to use the fluent builder reduces duplicated SQL-string construction.

**Alternatives considered**:
- *Hard-rename hasTable → tableExists*: rejected — breaks internal `MigrationManager` call and any existing user code.
- *Skip internal refactor of hasTable/hasColumn*: rejected — FR-008 explicitly requires all internal raw SELECT calls to be replaceable with the new builder, and the spec clarification confirmed this scope.

---

## §6 — Aggregate shorthand methods: count / sum / avg / min / max

**Question**: FR-005 requires `.count()`, `.sum(col)`, `.avg(col)`, `.min(col)`, `.max(col)`. Should these be terminal (execute immediately) or chainable (add to SELECT)?

**Research findings**:
- The spec User Story 2 shows: `const total = await db.from('orders').where('status', 'shipped').count()` — clearly terminal (returns a scalar, awaitable).
- User Story 3 shows: `await db.from('sales').groupBy('region').sum('amount')` — also terminal.
- There is no scenario where an aggregate is chained further after calling these methods.

**Decision**: All five aggregate methods are **terminal async methods** that:
1. Mark the instance as consumed (same as `.get()` / `.first()`).
2. Build the appropriate raw SELECT expression (`COUNT(*)`, `SUM(col)`, etc.) via `selectRaw()`.
3. Call the underlying `get()` logic and return the scalar from `result[0].aggregate`.
4. For `count()` with no arguments, use `COUNT(*) AS aggregate`. For `sum(col)`, use `SUM(sanitizeIdentifier(col)) AS aggregate`, etc.

**Note**: `sanitizeIdentifier` is used on the column argument to `sum/avg/min/max` before embedding in the raw expression — this prevents injection through the column name while still allowing `table.column` qualified names.

---

## §7 — Single-use enforcement (FR-012)

**Question**: The spec requires that reusing a builder after execution throws `QueryBuilderError`. What counts as "execution"?

**Decision**: The following methods mark the instance consumed and cannot be called on an already-consumed instance:
- `.get()`, `.first()`, `.count()`, `.sum()`, `.avg()`, `.min()`, `.max()`

A private `_consumed` boolean is set to `true` at the start of each terminal method. A private `_assertNotConsumed()` helper is called at the top of every terminal method and throws `QueryBuilderError` if `_consumed === true`.

Chainable methods (`.select()`, `.where()`, `.join()`, etc.) do NOT check consumed state — the error is only raised when the user tries to re-execute.

---

## §8 — Query logging integration (FR-014)

**Research findings**: `DatabaseConnection.select()` already calls `logQuery(sql, params, duration)` after every execution (line in `select()` method). Since `StandaloneQueryBuilder.get()` delegates to `connection.select()`, logging is automatic with zero additional code in the new class.

**Decision**: No special logging code needed in `StandaloneQueryBuilder`.

---

## Summary of decisions

| # | Topic | Decision |
|---|-------|----------|
| §1 | Class architecture | Independent class, structural parity with relevant QB state |
| §2 | Subquery FROM | Accept `string \| RawExpression \| StandaloneQueryBuilder`; compile nested via `_resolveSource()` |
| §3 | HAVING raw | Add `havingRaw()` to `StandaloneQueryBuilder`; add `type:'raw'` branch to `buildSelectQuery` HAVING |
| §4 | Error taxonomy | `QueryBuilderError` for builder errors only; driver errors propagate unwrapped |
| §5 | Schema naming | Add `tableExists`/`columnExists`/`listTables` as new public methods; keep `hasTable`/`hasColumn` |
| §6 | Aggregates | Terminal async methods returning scalar; use `selectRaw` + `sanitizeIdentifier` on column arg |
| §7 | Single-use | `_consumed` flag; `_assertNotConsumed()` guard on all terminal methods |
| §8 | Logging | Automatic — delegated to `connection.select()` |

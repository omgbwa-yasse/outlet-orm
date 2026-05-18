# Tasks: Native SELECT Support (QueryBuilder Standalone Mode)

**Input**: Design documents from `/specs/002-native-select-support/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or no incomplete dependencies)
- **[Story]**: User story this task belongs to (US1, US2, US3, US4) — omitted in Setup and Foundational phases
- Exact file paths are included in every task description

---

## Phase 1: Setup

> No project initialisation required — this feature adds to an existing Node.js library.
> No setup tasks.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before any user story work can begin.

**⚠️ CRITICAL**: T001–T004 block all user stories. T001 and T002 are independent and can run in parallel. T003 depends on both. T004 depends on T003.

- [X] T001 [P] Create `QueryBuilderError` custom error class in `src/Errors/QueryBuilderError.js` (new file)

  Implement as a CommonJS class (`module.exports = QueryBuilderError`):
  ```js
  class QueryBuilderError extends Error {
    constructor(message) {
      super(message);
      this.name = 'QueryBuilderError';
    }
  }
  ```
  Standard throw messages (use these exact strings throughout the codebase):
  - Consumed instance reuse: `'This query builder instance has already been executed. Create a new instance via db.from().'`
  - Invalid source: `'db.from() requires a non-empty table name string, a RawExpression instance, or a QueryBuilder instance.'`
  - Non-integer `limit`: `'limit() expects a non-negative integer.'`
  - Non-integer `offset`: `'offset() expects a non-negative integer.'`

  **Requirements**: FR-015
  **Test**: `instanceof QueryBuilderError` and `error.name === 'QueryBuilderError'`

- [X] T002 [P] Add `type:'raw'` HAVING branch to `buildSelectQuery()` in `src/DatabaseConnection.js`

  Locate the HAVING loop inside `DatabaseConnection.buildSelectQuery()` (the loop that iterates `query.havings`). Before any call to `h.operator.toUpperCase()` or operator validation, add an early branch for raw HAVING entries. The raw branch should come first, then preserve the existing `type: 'basic'` and `type: 'count'` logic:
  ```js
  if (having.type === 'raw') {
    havingClauses.push(having.sql);
    params.push(...(having.bindings || []));
  } else if (having.type === 'basic') {
    ...
  } else if (having.type === 'count') {
    ...
  }
  ```
  This ensures `havingRaw()` support does not throw before the raw branch is reached.

  **Requirements**: FR-006
  **Scope**: `src/DatabaseConnection.js` only — do NOT touch `src/QueryBuilder.js` in this task.

- [X] T003 Extend `QueryBuilder` for standalone (model-free) mode in `src/QueryBuilder.js`

  **Depends on**: T001, T002

  Make the following changes to `src/QueryBuilder.js`:

  **1. Constructor signature** — Change `constructor(model)` to `constructor(model, options = {})`. Add two new instance fields initialised before any use of `this.model`:
  ```js
  this._standaloneConnection = options.connection || null;
  this._standaloneSource     = options.source     || null;
  this._consumed             = false;
  ```
  The existing `this.connection = model.getConnection()` line must be guarded:
  ```js
  if (!this._isStandalone) {
    this.connection = model.getConnection();
  } else {
    this.connection = this._standaloneConnection;
  }
  ```
  All other constructor body lines that reference `this.model` (e.g. `this.table = model.getTable()`, global scope initialisation) must also be wrapped in `if (!this._isStandalone) { ... }`.

  **2. `_isStandalone` getter** — Add immediately after the constructor:
  ```js
  get _isStandalone() {
    return this.model === null && this._standaloneConnection !== null;
  }
  ```

  **3. `_assertNotConsumed()` private method** — Add:
  ```js
  _assertNotConsumed() {
    if (!this._isStandalone) return; // model-bound instances remain reusable
    if (this._consumed) {
      throw new QueryBuilderError(
        'This query builder instance has already been executed. Create a new instance via db.from().'
      );
    }
  }
  ```
  Require `QueryBuilderError` at the top of `QueryBuilder.js`:
  ```js
  const QueryBuilderError = require('./Errors/QueryBuilderError');
  ```

  **4. Guard existing `_applyGlobalScopes()` and `_applySoftDeleteConstraints()` call sites** — These two methods exist already and MUST NOT be renamed. Find every call site inside `get()`, `first()`, `paginate()`, or any other method where they are invoked, and wrap each with:
  ```js
  if (!this._isStandalone) {
    this._applyGlobalScopes();
  }
  ```
  and separately:
  ```js
  if (!this._isStandalone) {
    this._applySoftDeleteConstraints();
  }
  ```
  Do not merge the two into a single guard block — they may be called at different points in the method body.

  **5. Standalone `get()` branch** — Inside the existing `get()` method, add a standalone execution path immediately after the `_assertNotConsumed()` call and before the model-bound path:
  ```js
  async get() {
    this._assertNotConsumed();
    this._consumed = true;

    if (this._isStandalone) {
      // skip global scopes, soft-delete constraints, and model hydration
      const queryObj = this._buildQueryObj(); // see step 7
      return await this._standaloneConnection.select(this._standaloneSource, queryObj);
    }

    // ... existing model-bound path unchanged below ...
  ```

  **6. Standalone `first()` branch** — Same pattern as `get()`:
  ```js
  async first() {
    this._assertNotConsumed();
    this._consumed = true;

    if (this._isStandalone) {
      this.limit(1);
      const rows = await this._standaloneConnection.select(this._standaloneSource, this._buildQueryObj());
      return rows[0] || null;
    }

    // ... existing model-bound path ...
  ```

  **7. `_buildQueryObj()` helper** — If the existing `QueryBuilder` does not already have a method that returns the query descriptor object passed to `connection.select()`, extract it (or create a new private helper). The object shape must match exactly what `DatabaseConnection.select()` currently receives from the model-bound `QueryBuilder`. Inspect the existing model-bound `get()` implementation to determine the exact shape; do not guess. This helper is used by both standalone `get()`/`first()` above and by the aggregate methods in T008. It must also incorporate `this._subParams` into the returned params array, prepended before WHERE params so nested `QueryBuilder` sources remain positionally correct.

  **Requirements**: FR-001, FR-002, FR-003 (partial), FR-005, FR-009, FR-010, FR-011, FR-012, FR-013, FR-015

- [X] T004 Add `DatabaseConnection.from(source)` instance method to `src/DatabaseConnection.js`

  **Depends on**: T003

  Add the following instance method to `DatabaseConnection`:
  ```js
  from(source) {
    if (
      source === null ||
      source === undefined ||
      (typeof source === 'string' && source.trim() === '')
    ) {
      const QueryBuilderError = require('./Errors/QueryBuilderError');
      throw new QueryBuilderError(
        'db.from() requires a non-empty table name string, a RawExpression instance, or a QueryBuilder instance.'
      );
    }
    const QueryBuilder = require('./QueryBuilder');
    return new QueryBuilder(null, { connection: this, source });
  }
  ```
  Place the `require` calls inside the method body to avoid circular-dependency issues (both files already exist in the same `src/` directory; lazy `require` is the existing pattern in this codebase).

  Verify with a quick mental trace: `db.from('orders')` → `new QueryBuilder(null, { connection: db, source: 'orders' })` → `_isStandalone === true` → `get()` calls `this._standaloneConnection.select('orders', queryObj)`.

  **Requirements**: FR-001, FR-015

**Checkpoint — Phase 2 complete**: `db.from('orders').select('id').where('status', 'active').get()` can be executed and returns plain row arrays. Model-bound `Model.query().where(...).get()` continues to work identically.

---

## Phase 3: User Story 1 — Query Any Table Without Raw SQL (Priority: P1) 🎯 MVP

**Goal**: Developers can replace every raw `executeRawQuery(SELECT ...)` call with a fluent `db.from('table').select(...).where(...).get()` chain. Results are plain JS objects. No model class required.

**Independent Test**: `db.from('information_schema.tables').select('COUNT(1) AS cnt').where('table_schema', new RawExpression('DATABASE()')).where('table_name', 'migrations').get()` returns `[{ cnt: 1 }]` without any raw SQL string in the calling code.

- [X] T005 [P] [US1] Export `QueryBuilderError` as a named export from `src/index.js`

  Add to the existing exports block in `src/index.js`:
  ```js
  QueryBuilderError: require('./Errors/QueryBuilderError'),
  ```
  The exact position should follow the pattern of existing `Errors/` exports (e.g., alongside `UnsupportedCapabilityError` if it is already exported, or in the same section). Do not re-order unrelated exports.

  **Requirements**: FR-014

- [X] T006 [P] [US1] Add TypeScript declarations for new API surface in `types/index.d.ts`

  Add the following to `types/index.d.ts`:

  **`QueryBuilderError` class declaration** (at top-level, alongside other error classes):
  ```ts
  export class QueryBuilderError extends Error {
    constructor(message: string);
    name: 'QueryBuilderError';
  }
  ```

  **`DatabaseConnection.from()` method signature** (inside the existing `DatabaseConnection` class declaration):
  ```ts
  from(source: string | RawExpression | QueryBuilder): QueryBuilder;
  ```

  **`QueryBuilder` augmentations** (inside the existing `QueryBuilder` class declaration — add only what is missing):
  ```ts
  havingRaw(sql: string, bindings?: any[]): this;
  count(column?: string): Promise<number>;
  sum(column: string): Promise<number>;
  avg(column: string): Promise<number>;
  min(column: string): Promise<number>;
  max(column: string): Promise<number>;
  ```

  **`Schema` augmentations** (inside the existing `Schema` class declaration):
  ```ts
  tableExists(tableName: string): Promise<boolean>;
  columnExists(tableName: string, columnName: string): Promise<boolean>;
  listTables(): Promise<string[]>;
  ```

  Do not remove or change any existing declarations. Add only.

  **Requirements**: FR-014

- [X] T007 [P] [US1] Write unit and integration tests for QueryBuilder standalone mode basics in `tests/QueryBuilderStandalone.test.js` (new file)

  Create the file with the following `describe` blocks. All database interactions should use the existing SQLite test infrastructure already present in other test files (inspect `tests/SQLiteIntegration.test.js` or similar for the setup pattern). Use Jest `jest.spyOn` on `DatabaseConnection.prototype.select` (or equivalent) for unit-level assertions about query shape; use an actual in-memory SQLite connection for integration-level assertions about returned data.

  **Test groups to include** (use `describe` blocks):

  1. `db.from() validation` — `db.from(null)` throws `QueryBuilderError`; `db.from('')` throws `QueryBuilderError`; `db.from('orders')` returns a `QueryBuilder` instance; `db.from(42)` throws `QueryBuilderError`.
  2. `_isStandalone flag` — instance from `db.from()` has `_isStandalone === true`; instance from `Model.query()` has `_isStandalone === false`.
  3. `select columns` — `.select('id', 'name')` produces SELECT clause with the specified columns; default is `SELECT *`.
  4. `where clause` — `.where('status', 'active')` produces parameterised WHERE; value is not interpolated into SQL string.
  5. `orderBy / limit / offset` — chaining these methods sets the corresponding SQL clauses correctly.
  6. `join` — `.join('profiles', 'users.id', '=', 'profiles.user_id')` produces correct INNER JOIN SQL.
  7. `leftJoin` — `.leftJoin('profiles', 'users.id', '=', 'profiles.user_id')` produces correct LEFT JOIN SQL.
  8. `distinct` — `.distinct()` adds DISTINCT keyword to SELECT.
  9. `get() — returns plain rows` — with an actual SQLite connection, `db.from('users').get()` returns an array of plain JS objects (not hydrated model instances).
  10. `first() — returns single row or null` — `db.from('users').orderBy('id').first()` returns the first row; `db.from('users').where('id', 99999).first()` returns `null`.
  11. `single-use enforcement (standalone)` — calling `.get()` a second time on the same standalone builder throws `QueryBuilderError` with the consumed-instance message; `error instanceof QueryBuilderError` is `true`.
  12. `model-bound instances remain reusable` — a builder obtained via `Model.query()` can call `.get()` multiple times without throwing.
  13. `driver errors propagate unwrapped` — when `connection.select()` throws a driver error (simulate with a spy), `get()` propagates it without wrapping; `error instanceof QueryBuilderError` is `false`.
  14. `query logging` — with query logging enabled (attach a listener to the log event on the connection), executing a standalone query via `.get()` emits one log event containing the SQL string and bound params; the format is indistinguishable from a model-originated query log event.

  **Requirements**: SC-002, SC-003, SC-006, FR-001, FR-002, FR-005, FR-009, FR-010, FR-011, FR-012, FR-013, FR-015

- [ ] T008 [US1] Verify SC-002 motivating example in `tests/QueryBuilderStandalone.test.js`

  **Depends on**: T007 (add to the same file, a new top-level `describe` block)

  Add a test that re-implements the motivating example from the spec in 5 or fewer chained calls and asserts: (a) no raw SQL string is used, (b) the result matches what `executeRawQuery` would have returned for the same query:
  ```js
  const RawExpression = require('../src/RawExpression');
  const rows = await db
    .from('information_schema.tables')
    .select('COUNT(1) AS cnt')
    .where('table_schema', new RawExpression('DATABASE()'))
    .where('table_name', migrationsTable)
    .get();
  expect(rows[0].cnt).toBeGreaterThanOrEqual(0);
  ```
  (Adjust the database function for the test driver — use `sqlite_master` on SQLite.)

  **Requirements**: SC-002

**Checkpoint — Phase 3 complete**: User Story 1 is independently testable. `npm test -- --testPathPattern=QueryBuilderStandalone` passes all groups above.

---

## Phase 4: User Story 2 — Aggregate Functions in SELECT (Priority: P2)

**Goal**: Developers can call `.count()`, `.sum(col)`, `.avg(col)`, `.min(col)`, `.max(col)` directly on a standalone builder and receive scalar numeric results. Grouped aggregation with `.havingRaw()` works.

**Independent Test**: `db.from('orders').where('status', 'shipped').count()` returns a number; `db.from('sales').groupBy('region').havingRaw('COUNT(*) > ?', [5]).get()` returns only regions with more than 5 rows.

- [X] T009 [P] [US2] Add `havingRaw()` and aggregate terminal methods to `QueryBuilder` in `src/QueryBuilder.js`

  **Depends on**: T003, T004

  **`havingRaw(sql, bindings = [])` chainable method** — Add to `QueryBuilder`. Pushes `{ type: 'raw', sql, bindings }` onto `this.havings` (the same array used by the existing `.having()` method):
  ```js
  havingRaw(sql, bindings = []) {
    this.havings = this.havings || [];
    this.havings.push({ type: 'raw', sql, bindings });
    return this;
  }
  ```
  This method works for both standalone and model-bound builders. The `type:'raw'` entry is handled by the branch added in T002.

  **Note on FR-004**: The spec's `.having(expression)` wording covers two distinct methods:
  - `.having(column, operator, value)` — basic HAVING with a parameterised comparison (already exists or is pre-existing on `QueryBuilder`; do not remove or alter it)
  - `.havingRaw(sql, bindings)` — raw HAVING fragment (added here)

  Do not merge or rename the existing `.having()` method. If it does not already exist, add it as:
  ```js
  having(column, operator, value) {
    this.havings = this.havings || [];
    this.havings.push({ type: 'basic', column, operator, value });
    return this;
  }
  ```

  **Aggregate terminal methods** — Add the following five async methods to `QueryBuilder`. Each: (a) calls `_assertNotConsumed()`, (b) sets `_consumed = true` if standalone, (c) builds a `SELECT <AGGREGATE>(col) AS aggregate` query using `this._buildQueryObj()`, (d) executes via the appropriate connection, (e) returns the numeric scalar from `result[0].aggregate`:

  ```js
  async count(column = '*') {
    this._assertNotConsumed();
    if (this._isStandalone) this._consumed = true;
    const col = column === '*' ? '*' : this._sanitizeCol(column);
    const rows = await this._runAggregate(`COUNT(${col}) AS aggregate`);
    return Number(rows[0]?.aggregate ?? 0);
  }

  async sum(column) {
    this._assertNotConsumed();
    if (this._isStandalone) this._consumed = true;
    const rows = await this._runAggregate(`SUM(${this._sanitizeCol(column)}) AS aggregate`);
    return Number(rows[0]?.aggregate ?? 0);
  }

  async avg(column) {
    this._assertNotConsumed();
    if (this._isStandalone) this._consumed = true;
    const rows = await this._runAggregate(`AVG(${this._sanitizeCol(column)}) AS aggregate`);
    return Number(rows[0]?.aggregate ?? 0);
  }

  async min(column) {
    this._assertNotConsumed();
    if (this._isStandalone) this._consumed = true;
    const rows = await this._runAggregate(`MIN(${this._sanitizeCol(column)}) AS aggregate`);
    return Number(rows[0]?.aggregate ?? 0);
  }

  async max(column) {
    this._assertNotConsumed();
    if (this._isStandalone) this._consumed = true;
    const rows = await this._runAggregate(`MAX(${this._sanitizeCol(column)}) AS aggregate`);
    return Number(rows[0]?.aggregate ?? 0);
  }
  ```

  **`_runAggregate(expression)` private helper** — Add:
  ```js
  _runAggregate(expression) {
    // Temporarily override selectedColumns for the aggregate expression,
    // then delegate to the same execution path as get()
    const saved = this.selectedColumns;
    this.selectedColumns = [new RawExpression(expression)];
    const promise = this._isStandalone
      ? this._standaloneConnection.select(this._standaloneSource, this._buildQueryObj())
      : this.connection.select(this._getTable(), this._buildQueryObj());
    this.selectedColumns = saved;
    return promise;
  }
  ```
  (Adjust `_getTable()` to the actual method or property that returns the model table name in model-bound mode.)

  **`_sanitizeCol(column)` private helper** — Add:
  ```js
  _sanitizeCol(column) {
    const { sanitizeIdentifier } = require('./DatabaseConnection'); // or however it is imported
    return sanitizeIdentifier(column);
  }
  ```
  If `sanitizeIdentifier` is not exported from `DatabaseConnection`, use whatever internal mechanism the existing code uses for identifier validation. The purpose is to validate `column` before embedding it in a raw aggregate expression (injection prevention per FR-010).

  **Requirements**: FR-003, FR-004, FR-006, FR-012

- [ ] T010 [P] [US2] Write tests for aggregate functions and havingRaw in `tests/QueryBuilderStandalone.test.js`

  **Depends on**: T009 (add new `describe` blocks to the existing file)

  Add the following test groups:

  1. `count()` — `db.from('orders').count()` returns a non-negative integer; `db.from('orders').where('status', 'paid').count()` returns a number less than or equal to `count()` without the filter.
  2. `sum(col)` — `db.from('orders').where('status', 'shipped').sum('total')` returns a numeric value matching the sum of the `total` column for shipped orders.
  3. `avg(col)` — result is a number; equals sum / count for the same filter.
  4. `min(col)` / `max(col)` — `min('id')` returns the smallest id; `max('id')` returns the largest.
  5. `count() with no rows` — returns `0`, not `null` or `undefined`.
  6. `havingRaw` — `db.from('orders').select('status').groupBy('status').havingRaw('COUNT(*) > ?', [0]).get()` returns rows; verifies the HAVING clause is present in the executed SQL (use a spy on `connection.select` to inspect the SQL string or query descriptor).
  7. `aggregate consumed-instance enforcement` — calling `.sum()` a second time on the same standalone builder throws `QueryBuilderError`.
  8. `sanitizeIdentifier on column arg` — passing a column name containing a SQL injection fragment (e.g., `'; DROP TABLE orders; --`) to `sum()` throws or sanitizes; the resulting SQL does not contain the injection string.

  **Requirements**: SC-003, FR-003, FR-004, FR-006, FR-010, FR-012

**Checkpoint — Phase 4 complete**: User Story 2 is independently testable. Aggregate tests pass alongside Phase 3 tests.

---

## Phase 5: User Story 3 — Schema Introspection via Fluent API (Priority: P3)

**Goal**: `schema.tableExists()`, `schema.columnExists()`, and `schema.listTables()` work via the fluent builder. `hasTable()` and `hasColumn()` no longer contain raw SQL strings.

**Independent Test**: `await schema.tableExists('migrations')` returns `true`; `await schema.tableExists('nonexistent_xyz')` returns `false`; `await schema.listTables()` returns an array containing `'migrations'`.

- [X] T011 [P] [US3] Refactor `Schema.hasTable()` and `Schema.hasColumn()` to use `db.from()` in `src/Schema/Schema.js`

  **Depends on**: T003, T004

  Find the existing implementations of `hasTable(tableName)` and `hasColumn(tableName, columnName)` in `src/Schema/Schema.js`. Replace their `executeRawQuery` or `connection.execute()` raw SQL calls with fluent `db.from()` equivalents.

  **`hasTable()` refactor (MySQL/SQLite paths)**:

  MySQL:
  ```js
  async hasTable(tableName) {
    const RawExpression = require('../RawExpression');
    const rows = await this.connection
      .from('information_schema.tables')
      .select('COUNT(1) AS cnt')
      .where('table_schema', new RawExpression('DATABASE()'))
      .where('table_name', tableName)
      .get();
    return Number(rows[0]?.cnt ?? 0) > 0;
  }
  ```

  SQLite:
  ```js
  async hasTable(tableName) {
    const rows = await this.connection
      .from('sqlite_master')
      .select('COUNT(1) AS cnt')
      .where('type', 'table')
      .where('name', tableName)
      .get();
    return Number(rows[0]?.cnt ?? 0) > 0;
  }
  ```

  Use the driver-detection mechanism already present in `Schema.js` (inspect the existing `hasTable` implementation to find how the driver is detected — e.g., `this.connection.driver` or `this.connection.config.driver`). Do not change the external signature, return type, or error behaviour.

  **`hasColumn()` refactor** — Apply the same pattern: replace the `information_schema.columns` raw query with a `db.from('information_schema.columns').where(...).get()` chain.

  **Requirements**: FR-008, SC-001, SC-005

- [X] T012 [P] [US3] Add `tableExists()`, `columnExists()`, and `listTables()` to `Schema` in `src/Schema/Schema.js`

  **Depends on**: T011 (the task above — run after hasTable/hasColumn are refactored)

  **`tableExists()` and `columnExists()` — simple delegates**:
  ```js
  async tableExists(tableName) {
    return this.hasTable(tableName);
  }

  async columnExists(tableName, columnName) {
    return this.hasColumn(tableName, columnName);
  }
  ```

  **`listTables()` — driver-specific implementation**:
  ```js
  async listTables() {
    const driver = this.connection.driver || this.connection.config?.driver;

    if (driver === 'mysql' || driver === 'mysql2') {
      const RawExpression = require('../RawExpression');
      const rows = await this.connection
        .from('information_schema.tables')
        .select('table_name AS name')
        .where('table_schema', new RawExpression('DATABASE()'))
        .get();
      return rows.map(r => r.name);
    }

    if (driver === 'sqlite' || driver === 'better-sqlite3') {
      const rows = await this.connection
        .from('sqlite_master')
        .select('name')
        .where('type', 'table')
        .whereRaw("name NOT LIKE 'sqlite_%'")
        .orderBy('name')
        .get();
      return rows.map(r => r.name);
    }

    if (driver === 'pg' || driver === 'postgres' || driver === 'postgresql') {
      const rows = await this.connection
        .from('information_schema.tables')
        .select('table_name AS name')
        .where('table_schema', 'public')
        .get();
      return rows.map(r => r.name);
    }

    throw new Error(`listTables() is not supported for driver: ${driver}`);
  }
  ```
  Adjust driver string literals to match the exact values used by the existing codebase — inspect `DatabaseConnection.js` or `config/` to confirm.

  **Requirements**: FR-007, SC-001

- [ ] T013 [P] [US3] Write tests for schema introspection in `tests/QueryBuilderStandalone.test.js`

  **Depends on**: T012 (add new `describe` blocks to the existing file)

  Add the following test groups using an actual in-memory SQLite connection:

  1. `schema.tableExists()` — returns `true` for an existing table; returns `false` for a non-existent table; does not call `executeRawQuery` (verify with a spy — the spy must never be invoked).
  2. `schema.columnExists()` — returns `true` for an existing column; `false` for a missing column.
  3. `schema.listTables()` — returns an array of strings; includes at least the seeded test table; does not include `sqlite_master` internal tables.
  4. `schema.tableExists() and schema.hasTable() agree` — both return the same boolean for the same input.
  5. `schema.columnExists() and schema.hasColumn() agree` — both return the same boolean for the same input pair.
  6. `no executeRawQuery in Schema` — confirm `Schema.js` no longer calls `executeRawQuery` by asserting the spy is never invoked during any of the above tests.

  **Requirements**: SC-001, SC-003, SC-005, FR-007, FR-008

**Checkpoint — Phase 5 complete**: User Story 3 independently testable. `schema.tableExists('t')` returns correct boolean. `src/Schema/Schema.js` has zero `executeRawQuery` calls.

---

## Phase 6: User Story 4 — Full SELECT Clause Variants (Priority: P4)


**Goal**: Subquery-in-FROM works (nested `QueryBuilder` instance as source). DISTINCT, `selectRaw`, and aliased columns work (these inherit naturally from the existing `QueryBuilder` methods; only subquery support requires new code).

**Independent Test**: `db.from(db.from('orders').select('id').selectRaw('SUM(total) AS revenue').groupBy('id')).where('revenue', '>', 500).get()` executes the outer query against the inner subquery result.

- [ ] T014 [P] [US4] Add subquery-in-FROM support (`_resolveSource()`) to `QueryBuilder` in `src/QueryBuilder.js`

  **Depends on**: T003, T004

  The current standalone `get()` (from T003) passes `this._standaloneSource` directly to `connection.select()`. Extend this to support `RawExpression` and nested `QueryBuilder` sources.

  Add a private `_resolveSource()` method:
  ```js
  _resolveSource() {
    const RawExpression = require('./RawExpression');
    const source = this._standaloneSource;

    if (typeof source === 'string') return source; // validated by sanitizeIdentifier at execution

    if (source instanceof RawExpression) return source; // passed verbatim

    if (source instanceof QueryBuilder && source._isStandalone) {
      // Compile the nested builder to SQL without marking it consumed
      const { sql, params } = source._compileToSQL();
      // Prepend subquery params so positional placeholders stay correct
      this._prependParams(params);
      return new RawExpression(`(${sql}) AS sub`);
    }

    throw new QueryBuilderError(
      'db.from() requires a non-empty table name string, a RawExpression instance, or a QueryBuilder instance.'
    );
  }
  ```

  Add `_compileToSQL()` — builds the SQL and params WITHOUT executing and WITHOUT marking the instance consumed:
  ```js
  _compileToSQL() {
    const queryObj = this._buildQueryObj();
    return this._standaloneConnection.buildSelectQuery(this._standaloneSource, queryObj);
  }
  ```
  (Inspect `DatabaseConnection.buildSelectQuery()` to confirm its return value is `{ sql, params }` or equivalent — adjust accordingly.)

  Add `_prependParams(params)` — ensures subquery params are positionally before outer query params:
  ```js
  _prependParams(params) {
    this._subParams = [...params, ...(this._subParams || [])];
  }
  ```
  Update `_buildQueryObj()` to include `_subParams` in the final params array (prepended before WHERE params).

  Update the standalone `get()` and `first()` execution paths to call `this._resolveSource()` instead of using `this._standaloneSource` directly.

  **Requirements**: FR-006 (raw expressions in FROM), US4 acceptance scenario 3

- [ ] T015 [P] [US4] Write tests for SELECT clause variants in `tests/QueryBuilderStandalone.test.js`

  **Depends on**: T014 (add new `describe` blocks to the existing file)

  Add the following test groups:

  1. `DISTINCT` — `db.from('orders').select('status').distinct().get()` returns unique statuses only; no duplicate status values in the result.
  2. `aliased column` — `.select('price * 1.2 AS price_with_tax')` (as `selectRaw`) returns rows with the `price_with_tax` field containing a numeric value.
  3. `selectRaw` — `.selectRaw('DATE(created_at) AS order_date')` includes the raw expression in the SELECT clause without escaping.
  4. `subquery in FROM` — nest an inner builder inside an outer `db.from()`. The outer query executes correctly; result rows come from the subquery. Use a spy on `connection.select` to assert the generated SQL contains `(SELECT ... FROM ...) AS sub`.
  5. `RawExpression as FROM source` — `db.from(new RawExpression('orders o'))` produces `FROM orders o` without quoting.

  **Requirements**: SC-003, FR-005, FR-006, US4

**Checkpoint — Phase 6 complete**: All four user stories are independently testable and passing.

---

## Phase 7: Polish & Verification

**Purpose**: Final validation gates confirming zero regressions and no residual raw SQL.

- [ ] T016 Run full test suite and confirm zero regressions

  Command: `npm test`
  All pre-existing tests MUST pass. All new tests in `tests/QueryBuilderStandalone.test.js` MUST pass.
  Exit code must be `0`. Zero failures in any file.

  **Requirements**: SC-004
  **Dependencies**: all prior tasks

- [ ] T017 Verify no new `executeRawQuery` SELECT calls in `src/Schema/` and `src/Migrations/`

  Command: `grep -r "executeRawQuery" src/Schema src/Migrations`
  Expected: zero matches in `src/Schema/Schema.js` and `src/Migrations/MigrationManager.js`.

  **Note**: `src/Backup/` is explicitly out of scope — `BackupManager` data-export SELECT calls are deferred to a future iteration. Only schema-introspection raw queries are in scope for this iteration.

  **Requirements**: SC-005
  **Dependencies**: T011 (refactored hasTable/hasColumn), T012 (new Schema methods)

---

## Task Summary

| ID | Phase | Title | Parallelizable | Story | Dependencies |
|----|-------|-------|---------------|-------|--------------|
| T001 | Foundational | Create `QueryBuilderError` class | [P] | — | none |
| T002 | Foundational | Add `type:'raw'` HAVING branch to `buildSelectQuery()` | [P] | — | none |
| T003 | Foundational | Extend `QueryBuilder` for standalone mode | — | — | T001, T002 |
| T004 | Foundational | Add `DatabaseConnection.from()` factory | — | — | T003 |
| T005 | US1 | Export `QueryBuilderError` from `src/index.js` | [P] | US1 | T001 |
| T006 | US1 | TypeScript declarations augmentation | [P] | US1 | T001, T003 |
| T007 | US1 | Unit/integration tests — standalone basics | [P] | US1 | T003, T004 |
| T008 | US1 | SC-002 motivating example test | — | US1 | T007 |
| T009 | US2 | Add `havingRaw()` and aggregate terminal methods | [P] | US2 | T003, T004 |
| T010 | US2 | Tests — aggregate functions and havingRaw | [P] | US2 | T009 |
| T011 | US3 | Refactor `hasTable()` / `hasColumn()` to use `db.from()` | [P] | US3 | T003, T004 |
| T012 | US3 | Add `tableExists()`, `columnExists()`, `listTables()` | [P] | US3 | T011 |
| T013 | US3 | Tests — schema introspection | [P] | US3 | T012 |
| T014 | US4 | Add `_resolveSource()` subquery-in-FROM support | [P] | US4 | T003, T004 |
| T015 | US4 | Tests — SELECT variants (DISTINCT, aliases, subqueries) | [P] | US4 | T014 |
| T016 | Verification | Run full test suite — zero regressions | — | — | all |
| T017 | Verification | Verify no new `executeRawQuery` SELECT calls | — | — | T011, T012 |

**Total tasks**: 17 (16 implementation + 1 overlap note; the task IDs above are the canonical set)

**Critical path**: T001 → T003 → T004 → T011 → T012 → T013 → T016

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: T001 and T002 are independent — start in parallel. T003 needs both. T004 needs T003.
- **US1–US4 (Phases 3–6)**: All depend on Phase 2 completion (T004 done). US stories can proceed in parallel once foundational phase is complete.
- **Verification (Phase 7)**: Depends on all implementation phases being complete.

### User Story Dependencies

- **US1 (P1)**: No dependency on other stories. Start immediately after T004.
- **US2 (P2)**: No dependency on US1, US3, US4. Start after T004.
- **US3 (P3)**: No dependency on US1, US2, US4. Start after T004. T011 must precede T012.
- **US4 (P4)**: No dependency on US1, US2, US3. Start after T004.

### Parallel Execution by User Story

**US1** (after Phase 2 complete):
```
T005 [P] — export QueryBuilderError from index.js
T006 [P] — TypeScript declarations
T007 [P] — standalone basics tests → T008
```

**US2** (after Phase 2 complete):
```
T009 [P] — havingRaw + aggregates → T010 [P]
```

**US3** (after Phase 2 complete):
```
T011 [P] → T012 [P] → T013 [P]
```

**US4** (after Phase 2 complete):
```
T014 [P] → T015 [P]
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 2: Foundational — T001 → T002 (parallel) → T003 → T004
2. Complete Phase 3: User Story 1 — T005, T006, T007 (parallel) → T008
3. **STOP and VALIDATE**: `npm test -- --testPathPattern=QueryBuilderStandalone` passes
4. Demo: `db.from('orders').select('id', 'total').where('status', 'paid').limit(10).get()` works

### Full Delivery Order

```
T001 ─┐
       ├─→ T003 ─→ T004 ─┬─→ T005 (US1)
T002 ─┘                   ├─→ T006 (US1)
                           ├─→ T007 ─→ T008 (US1)
                           ├─→ T009 ─→ T010 (US2)
                           ├─→ T011 ─→ T012 ─→ T013 (US3)
                           └─→ T014 ─→ T015 (US4)
                                             │
                                             ▼
                                     T016 + T017 (Verification)
```

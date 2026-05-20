# Changelog

All notable changes to this project will be documented in this file.

## [15.1.1] — 2026-05-19

### 🐛 Fixes

- **CLI (`outlet migrate`)**: the config loader no longer hard-fails when `database/config.js` is missing. The `.env` fallback now:
  - parses a `DATABASE_URL` / `DB_URL` connection string (mysql, mariadb, postgres, sqlite, file schemes),
  - auto-detects the driver when `DB_DRIVER` is not set — `sqlite` when an `SQLITE_*` / `DB_FILE` var is present, `pg` when `DB_PORT=5432`, otherwise `mysql`,
  - shares a single `loadDbConfigFromCwd()` helper between the interactive and non-interactive code paths (removes a duplicated block).
- Fixes "Could not load database configuration / Cannot find module 'database/config.js'" for projects that only ship a `.env` file with `DB_HOST`, `DB_NAME`, `DB_USER`, etc.

## [15.1.0] — 2026-05-19

### 🐛 Fixes

- **QueryBuilder / DatabaseConnection**: `RawExpression` instances passed as the value of `where()`, `whereIn()`, `whereNotIn()`, `whereBetween()`, `whereNotBetween()`, and `where('col', 'like', …)` are now inlined into the generated SQL instead of being pushed into the parameter bindings. This fixes a regression where `Schema.hasTable()` — and therefore `npx outlet migrate status` — threw `The first argument must be of type string or an instance of Buffer... Received an instance of RawExpression` because `WHERE table_schema = DATABASE()` leaked a `RawExpression` into mysql2's bindings.

### ✅ Tests

- New regression suite `tests/RawExpressionWhere.test.js` covers basic/`IN`/`BETWEEN`/`LIKE` with `RawExpression` against real in-memory SQLite, plus an end-to-end `MigrationManager.status()` run.

## [15.0.0] — 2026-05-19

### 🎉 Stable release milestone

- Major version bump consolidating the 14.x feature line (query-builder parity, migration deploy/resolve commands, advisory locks, schema builder enhancements) into a stable 15.x release.
- **Schema builder**: regression tests added to lock in dual-signature support for `index()`, `unique()`, and `fullText()` — both `index('col', 'name')` and `index(['c1','c2'], 'name')` produce correct SQL on MySQL, SQLite, and PostgreSQL.

## [14.9.0] — 2026-05-19

### ✨ query-builder parity

- **Query builder additions** (`QueryBuilder`):
  - `whereNotBetween(col, [a, b])` and `orWhere*` variants — `orWhereIn`, `orWhereNotIn`, `orWhereBetween`, `orWhereNotBetween`, `orWhereNull`, `orWhereNotNull`.
  - Aggregate eager-aggregates: `withSum(rel, col)`, `withAvg(rel, col)`, `withMin(rel, col)`, `withMax(rel, col)` (sibling to `withCount`). Aliases follow the `${rel}_${fn}_${col}` convention. Supports `hasMany`, `hasOne`, `belongsTo`, and `belongsToMany` (pivot JOIN).
  - Joins: `rightJoin(table, first, op, second)` and `crossJoin(table)`.
  - Set operations: `union(query)` and `unionAll(query)` — accepts another `QueryBuilder` and serializes through `buildQuery()`.
  - Existence: `doesntExist()` (negation of `exists()`).
  - Inserts: `insertGetId(data)` returns the new primary-key value (`insertId` / `lastID` / `id`).
  - Table alias: `QueryBuilder#as(alias)` and `Model.as(alias)` emit `FROM table AS alias`; subsequent clauses can reference `alias.column`.
- **Model**: `Model.findOr(id, callback)` — returns the model when found, otherwise the callback result (Laravel `findOr`).
- **DatabaseConnection / transactions**: `afterCommit(cb)` — registers a hook that runs after the current transaction commits (fires immediately if no transaction is active). Hooks are cleared on `rollback()` and never fire.
- **SQL generation**: `buildSelectQuery` now emits `CROSS JOIN`, `NOT BETWEEN`, and `UNION` / `UNION ALL` clauses while keeping identifier and operator allow-lists intact.

## [14.8.0] — 2026-05-22

### migration options

- **`outlet-migrate deploy`** — non-interactive command tailored for CI/CD. Runs only pending migrations, never auto-backs up, never prompts, refuses to proceed when previously failed migrations exist (unless `--allow-failed` is passed). Honors `--pretend` and `--allow-drift`.
- **`outlet-migrate resolve --applied=<name>`** — marks a migration as `completed` without executing it (recovery after a manual fix in production).
- **`outlet-migrate resolve --rolled-back=<name>`** — marks a previously `failed`/`completed` migration as `rolled_back` (clears the failure and lets `deploy` proceed).
- **Optional advisory lock** around `deploy` and `resolve` to prevent concurrent runners in production:
  - PostgreSQL: `pg_advisory_lock` / `pg_advisory_unlock` (int4 id derived from a sha1 hash of the lock name).
  - MySQL: `GET_LOCK(name, 10)` / `RELEASE_LOCK(name)`.
  - SQLite: no-op (single-writer engine — `_acquireLock()` returns `false`).
  - `run` / `rollback` / `reset` / `refresh` / `fresh` are intentionally **not** wrapped (interactive flows).
- **New `_migrations` columns** auto-added on `initialize()`: `started_at`, `finished_at`, `rolled_back_at` (ISO-8601 strings).
- **Missing-migration detection**: `status()` now flags migrations whose row exists in the DB but whose file is missing on disk (status `missing`); `getMissingMigrations()` exposes the same list programmatically.
- **Re-entrance**: `_withLock()` is safe to call from within an already-locked section (tracked via `_lockHeld`).
- **New error code** `EOUTLET_LOCK_BUSY` thrown when an advisory lock cannot be acquired.

## [14.7.0] — 2026-05-21

### ✨ New — Laravel-parity migration options

- **`outlet-migrate install`** creates only the `migrations` table (Laravel's `migrate:install`).
- **`--pretend`** on `migrate`, `rollback`, `reset`, `refresh`, `fresh` — lists what would run without touching the DB.
- **`--step`** on `migrate` — runs each pending migration in its own batch (granular rollback).
- **`--steps=N` / `-s N`** on `rollback` — number of batches to revert (already existed, now documented).
- **`--batch=N`** on `rollback` — revert one specific batch number.
- **`--seed`** on `migrate` / `refresh` / `fresh` — chain seeders after success.
- **`--seeder=Name` / `--class=Name`** — target a specific seeder class.
- **`--pending`** on `status` — show only migrations not yet executed.
- **`make <name> --create=<table>` / `--table=<table>`** — explicit template hints for the scaffolder (overrides name-based detection).
- **`shouldRun()`** hook on the `Migration` base class: return `false` to skip a migration (recorded with `status='skipped'`, emits `migration:skipped`).
- **`withinTransaction`** property on the `Migration` base class: set to `true` to wrap `up()` / `down()` in a DB transaction with automatic rollback on error.
- **Migration lifecycle events** (Node `EventEmitter` on `MigrationManager`): `migrations:none`, `migrations:pretend`, `migrations:started`, `migrations:ended`, `migration:started`, `migration:ended`, `migration:skipped`.

## [14.6.0] — 2026-05-20

### 🛡️ New — Migration Data Preservation (feature 003)

- **Automatic backups** before every destructive migration command (`fresh`, `reset`, `refresh`, `rollback`). Files written to `database/backups/auto_before_<command>_<YYYYMMDD_HHMMSS>.sql` with a `.meta.json` sidecar. Retention keeps the 10 most-recent per command. `--skip-auto-backup` opts out in development; the flag is **ignored** in production.
- **`outlet-migrate restore:auto [--backup=<file>]`** restores the latest (or a named) auto-backup. Every restore is appended to `database/backups/.restore-history.log`.
- **`outlet-migrate backups:list [--json]`** enumerates auto-backups with metadata.
- **Idempotent re-runs**: `migrations` table extended with `checksum` (SHA-256), `execution_time_ms`, and `status` (`pending|running|completed|failed`) columns. Legacy 4-column tables are auto-upgraded on `initialize()`.
- **Drift detection**: stored checksums are compared against on-disk files on every `run`. Policy is env-aware (dev=warn, test=silent, prod=throws `EOUTLET_DRIFT` unless `--allow-drift`).
- **Recovery prompt**: rows stuck in `running`/`failed` trigger a TTY prompt (`re-run` / `mark-resolved` / `abort`) or throw `EOUTLET_INTERRUPTED` in non-TTY contexts.
- **Production gate**: destructive commands in production require `OUTLET_PRODUCTION_CONFIRM=1` **and** typing the configured database name. Throws `EOUTLET_PRODUCTION` (exit code 2) otherwise.
- **`outlet-migrate make:transform <name>`** scaffolds a data-transform migration from `database/templates/transform-migration.js`. Name validated against `^[a-z][a-z0-9_]*$`.
- **Migration helpers** on the base class: `transformData(table, callback, opts)`, `backupData(table, columns)`, `restoreData(table, rows)` — safe snapshot/transform/rollback for in-flight data changes.
- **CLI exit codes** standardized: 0 success, 1 generic error, 2 confirmation/flag error, 3 backup-missing/drift.
- New documentation: [docs/MIGRATION_DATA_SAFETY.md](docs/MIGRATION_DATA_SAFETY.md); expanded [docs/MIGRATIONS.md](docs/MIGRATIONS.md) "Safety" section.

## [14.5.0] — 2026-05-18

### 🐛 Fixes

- Support `RawExpression` values in `selectRaw` column lists during schema introspection.

## [Unreleased]

## [14.2.0] — 2026-05-03

### ✨ New — AI alias export

- Added `Ai` as a strict alias of `AIManager` in the public entry point.
- Added TypeScript alias declaration for `Ai` so typed consumers can import it directly.
- Added test coverage to assert `Ai === AIManager`.

## [14.0.0] — 2026-05-01

### ✨ New — Unified `outlet` CLI

- Added `bin/outlet.js` as a single entrypoint: `outlet <command>` routes to all existing sub-commands (`init`, `convert`, `migrate`, `reverse`, `mcp`, `api import`, `api diff`).
- Legacy `outlet-<name>` aliases (`outlet-init`, `outlet-migrate`, etc.) are preserved for backward compatibility.

### 🔀 Refactor — API Import CLI reorganised

- Moved `bin/api-import.js` → `bin/api/import.js`; moved `bin/api-diff.js` → `bin/api/diff.js`.
- Moved `src/AI/ApiImport/*` → `src/Api/ApiImport/*` (12 modules): discovery, extraction, conflict resolution, coverage metrics, diagnostics, run comparison.
- Updated `package.json` bin entries: `"outlet-api-import": "bin/api/import.js"`, `"outlet-api-diff": "bin/api/diff.js"`.

### ✨ New — Reference Documentation Import Enhancements

- Added reference-doc crawl pipeline for `outlet api import --doc` with official-page discovery, provenance capture, deterministic merge, and coverage diagnostics.
- Added run state and delta artifacts (`_run-state.json`, `_coverage-report.json`, `_run-delta.json`) to compare successive documentation imports.
- Added crawl controls: `--max-depth`, `--include-official-subdomains`, and `--run-delta`.

### 🧪 Tests

- Split `tests/AI.test.js`: API Import foundations moved to `tests/Api.test.js`; `tests/AI.test.js` now covers AI-only features.

## [13.0.1] — 2026-04-30

### 🐛 Fixes

- Accept MySQL backtick-quoted SQL identifiers during identifier sanitization and normalize them before validation.

## [13.0.0] — 2026-05-01

### ✨ New — API Layer (v13.0.0)

**Zero new runtime dependencies. Requires Node.js ≥ 18.0.0 (native `fetch`, `AbortController`, `crypto.randomUUID`).**

#### Core Classes

- `Api` base class — same Eloquent-inspired syntax as SQL `Model`, over HTTP/REST. Extends `EventEmitter`.
- `ApiAdapter` — HTTP transport via `globalThis.fetch`; `AbortController`-based timeout (default 30 s).
- `createAdapter(config)` — factory helper for `ApiAdapter` instances.
- Full barrel export via `src/Api/index.js`; all symbols re-exported from the main `outlet-orm` entry point.

#### Static CRUD Methods (`Api`)

- `Api.find(id)` — `GET {endpoint}/{id}`; returns `null` on 404 (does not throw).
- `Api.findOrFail(id)` — like `find()`, throws `ApiNotFoundError` if the record is missing.
- `Api.all(params?)` / `Api.get(params?)` — `GET {endpoint}` with optional query params (URLSearchParams); returns `[]` on non-array / non-`{data:[]}` response.
- `Api.create(data)` — `POST {endpoint}`; emits `creating` / `created` on instance and class.

#### Instance Methods (`Api`)

- `instance.save()` — `PATCH {endpoint}/{id}`; emits `updating` / `updated`.
- `instance.destroy()` — `DELETE {endpoint}/{id}`; emits `deleting` / `deleted`; returns `true`.

#### Adapter Resolution (multi-adapter)

- Per-request `usingAdapter(adapter)` → model `static adapter` → `Api._defaultAdapter` chain.
- `Api.setDefaultAdapter(adapter)` / `Api.getDefaultAdapter()`.

#### Authentication (FR-02)

- `bearer` — `Authorization: Bearer <token>`.
- `basic` — `Authorization: Basic <base64(user:pass)>`.
- `apiKey` — custom header or `?api_key=` query parameter.
- `cookie` — `Cookie: <name>=<value>`.
- `oauth2` — bearer with automatic refresh; `onRefreshFail` callback when refresh endpoint itself returns 401.
- `dynamicHeaders` — function evaluated per request (useful for tenant IDs, trace headers, etc.).

#### Error Hierarchy (FR-10)

10 typed error classes — all extend `Error` through `ApiError`:

| Class | HTTP status | Extra field |
|---|---|---|
| `ApiError` | — | base class |
| `ApiNetworkError` | — | timeout / network |
| `ApiResponseError` | any non-2xx | `status`, `response` |
| `ApiNotFoundError` | 404 | — |
| `ApiValidationError` | 422 | `errors` |
| `ApiUnauthorizedError` | 401 | — |
| `ApiForbiddenError` | 403 | — |
| `ApiServerError` | 500–599 | — |
| `ApiRateLimitError` | 429 | `retryAfter` (parsed from `Retry-After` header) |
| `ApiQueryNotSupportedError` | — | thrown when SQL query methods are called on `Api` |

Full `instanceof` chain preserved (e.g. `ApiNotFoundError instanceof ApiResponseError instanceof ApiError instanceof Error`).

Global `onError` callback on `ApiAdapter` called before re-throw.

#### Debug Utilities

- `adapter.toRequest(method, path, options)` — returns `{ method, url, params, headers }` without fetching.
- `adapter.enableRequestLog()` / `adapter.getRequestLog()` / `adapter.flushRequestLog()`.
- Request log entries contain `method`, `url`, `headers`, `params`, `timestamp`.

#### File Upload

- `adapter.upload(url, data, options)` — uses XHR with `onProgress` callback when `XMLHttpRequest` is available; falls back to `fetch`.

#### Lifecycle Events

`creating`, `created`, `updating`, `updated`, `deleting`, `deleted` emitted on both the instance and the class.

#### Query Builder (FR-04)

- `Api.query()` — returns `ApiQueryBuilder` with fluent `where()`, `orWhere()`, `whereIn()`, `whereNull()`, `orderBy()`, `limit()`, `offset()`, `with()`, `select()`.
- `ApiQueryBuilder#get()`, `first()`, `find(id)`, `count()`, `paginate(perPage, page)`.

#### Pagination (FR-05)

- `ApiPaginator<T>` — wraps page data with `currentPage`, `lastPage`, `total`, `hasNextPage()`, `hasPrevPage()`, `nextPage()`, `prevPage()`, `goToPage()`.
- Supports async iteration (`for await (const page of paginator)`).

#### Caching (FR-06)

- `ApiCache` — `remember(key, ttl, fn)`, `forget(key)`, `flush()`.
- Three pluggable stores: `CacheMemoryStore`, `CacheLocalStorageStore`, `CacheSessionStorageStore`.
- Cache config on `ApiAdapter`: `{ cache: { enabled, ttl, store } }`.

#### Validation (FR-07)

- `ApiValidator` — validates with rule objects (`required`, `type`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `enum`, `custom`).
- `validateOrFail()` throws `ApiValidationError` on failure.
- `Api.strictResponse` (static boolean) — when `true`, `_validateResponse` strips undeclared fields using `responseSchema || fillable`.

#### Interceptors (FR-08)

- `InterceptorManager` — `use(fulfilled, rejected)`, `eject(id)`, `clear()`.
- Separate `adapter.interceptors.request` and `adapter.interceptors.response` managers (Axios-compatible API).

#### Mock Adapter (FR-09)

- `MockAdapter extends ApiAdapter` — `onGet/onPost/onPut/onPatch/onDelete(path, response, { status, delay })`.
- `reset()` clears all registered handlers.
- Uses in-memory handler registry; throws `ApiNetworkError` for unmatched routes.

#### GraphQL (FR-11)

- `ApiGraphQL extends Api` — `query(gql, vars)`, `mutate(gql, vars)`, `subscribe(gql, vars)` (AsyncGenerator).
- Sends `POST {graphqlEndpoint}` with `{ query, variables }` body.

#### Offline / Mutation Queue (FR-12)

- `StorageAdapter` — async wrapper over a `CacheStore`.
- `MemoryStore`, `LocalStorageStore`, `SessionStorageStore` — same interface as cache stores.
- `MutationQueue` — `enqueue()`, `dequeue()`, `peek()`, `size()`, `clear()`, `replay(adapter)`.

#### Realtime (FR-13)

- `Watcher` — polling-based change detection; `watch(endpoint, callback)` returns an unsubscribe function.
- `EventStream` — wraps `EventSource`; `on(event, cb)`, `off(event, cb)`, `connect()`, `disconnect()`.
- `WebSocketConnection` — reconnecting WebSocket; `send(data)`, `on(event, cb)`, `connect()`, `disconnect()`.

#### Security

- `ApiAdapter` header redaction — `redactHeaders` config list; sensitive values replaced with `'***'` in logs and `toRequest()` output. Actual HTTP requests receive real values.
- `strictResponse` — server-response field allow-listing.

#### Circuit Breaker

- States: `'closed'` → `'open'` → `'half-open'` → `'closed'`.
- Configurable `threshold` (failure count), `timeout` (ms before half-open probe).

#### Retry

- Automatic retry with configurable `retries`, `retryCodes`, `retryDelay` (default 3 retries on 5xx).

#### New CLI Tools

- `outlet-api-import` (`bin/api/import.js`) — generate `ApiModel` classes from an OpenAPI 3.x spec.
  - `--spec <path|url>` `--output <dir>` `--lang [js|ts]` `--auth [bearer|basic|apiKey|oauth2]` `--strategy [tag|resource]`
- `outlet-api-diff` (`bin/api/diff.js`) — compare existing model files against an OpenAPI spec and report divergences.
  - `--spec <path|url>` `--models <dir>`; exits with code 1 on any divergence.

#### New Source Directory

- `src/Api/` — full API Layer source tree:
  - `Api.js`, `ApiAdapter.js`, `index.js`
  - `Errors/` — 10 typed error classes
  - `Interceptors/InterceptorManager.js`
  - `GraphQL.js`, `MockAdapter.js`, `ApiCache.js`, `ApiPaginator.js`, `ApiQueryBuilder.js`, `ApiValidator.js`
  - `Offline/` — `StorageAdapter.js`, `MemoryStore.js`, `LocalStorageStore.js`, `SessionStorageStore.js`, `MutationQueue.js`
  - `Realtime/` — `Watcher.js`, `EventStream.js`, `WebSocketConnection.js`

#### New Test Files

- `tests/ApiLayer.test.js` — core `Api` + `ApiAdapter` unit tests.
- `tests/ApiCache.test.js` — cache layer tests.
- `tests/ApiValidation.test.js` — validator tests.
- `tests/ApiMock.test.js` — mock adapter tests.
- `tests/ApiInterceptors.test.js` — interceptor tests.
- `tests/ApiGraphQL.test.js` — GraphQL adapter tests.
- `tests/ApiOffline.test.js` — offline/mutation-queue tests.

#### TypeScript

- `types/api/index.d.ts` — full declarations for all API Layer symbols.
- `types/index.d.ts` — re-exports `types/api/index.d.ts` via `export * from './api/index'`.

#### Documentation

- `OUTLET_ORM_API_LAYER.md` — full specification with 25 sections covering all FR requirements.

---

## [12.1.0] — Fluent Migration Constraints

### Added
- `Blueprint.check(expression)` — add a `CHECK` constraint in `CREATE TABLE` or `ALTER TABLE … ADD CONSTRAINT CHECK` (MySQL, PostgreSQL; throws `UnsupportedCapabilityError` for SQLite ALTER)
- `Blueprint.dropConstraint(name)` — drop a named constraint via `ALTER TABLE … DROP CHECK` (MySQL) or `ALTER TABLE … DROP CONSTRAINT` (PostgreSQL); throws for SQLite
- `Blueprint.dropCheck(name)` — alias for `dropConstraint()`
- `CheckConstraintDefinition` class — fluent builder returned by `check()`; supports `.name(value)` for explicit constraint names and `.resolvedName()` for auto-generated names
- `ForeignKeyDefinition.name(value)` — set an explicit constraint name for a foreign key, overriding the auto-generated `{table}_{column}_foreign` name
- TypeScript definitions updated: `TableBuilder.check()`, `TableBuilder.dropConstraint()`, `TableBuilder.dropCheck()`, `ForeignKeyBuilder.name()`, new `CheckConstraintBuilder` interface

## [12.0.0] — 2026-04-13

### Breaking Changes
- `DBFunction` alias removed — use `SchemaFunction` or `Function` instead

### Added
- All `src/Objects/` class names harmonised to `Schema*` prefix (`SchemaView`, `SchemaTrigger`, `SchemaProcedure`, `SchemaFunction`, `SchemaTransaction`)
- Short-name aliases (`View`, `Trigger`, `Procedure`, `Function`, `Transaction`) kept for backward compatibility
- `useSchema()` helper binds all five builders in a single call
- Full fluent DDL builder API for views, triggers, stored procedures, functions and savepoint transactions
- `docs/DATABASE_OBJECTS.md` reference documentation
- `skills/outlet-orm/` updated: SKILL.md v12.0.0 metadata, ADVANCED.md Fluent Builder section

## [11.4.0] — Fluent DB Objects API

### Added
- `View`, `Trigger`, `Procedure`, `Function`, `Transaction` builder classes for a fluent DB objects API
- `useSchema(schemaOrDb)` helper returning all five builder classes bound to a schema/connection in one call
- `DBFunction` and `SchemaFunction` aliases for `Function`
- All schema-bound builders (`View`, `Trigger`, `Procedure`, `Function`) accept either `Schema` or `DatabaseConnection` in `.use()` / `useSchema()` — a `DatabaseConnection` is auto-wrapped in a `Schema`
- `Transaction` builder binds to `DatabaseConnection` directly (or extracts `.connection` from a `Schema`)
- Unbound guard on all builders throws a descriptive `TypeError` with class name and remediation hint

## [11.3.0] - 2026-04-13

### ✨ New — Database Objects Support

#### Views
- `schema.createView(name, selectSql)` — create a view (all drivers)
- `schema.createOrReplaceView(name, selectSql)` — create or replace (SQLite: drop + create)
- `schema.dropView(name)` / `schema.dropViewIfExists(name)` — drop a view
- `schema.hasView(name)` — check existence, returns `true` / `false`
- `schema.getViews()` — list all view names

#### Triggers
- `schema.createTrigger({ name, table, timing, event, forEach, isView, body })` — create a trigger
  - PostgreSQL: auto-generates a companion `{name}_fn()` trigger function
  - SQLite: validates body (no qualified names, no DEFAULT VALUES, no ORDER BY/LIMIT)
- `schema.dropTrigger(name, table)` / `schema.dropTriggerIfExists(name, table)` — drop a trigger
- `schema.hasTrigger(name, table)` — check existence
- `schema.getTriggers(table?)` — list trigger names (optionally filtered by table)

#### Stored Procedures & Functions
- `schema.createProcedure(name, params, body, options?)` — create a stored procedure (MySQL / PG)
- `schema.dropProcedure(name)` / `schema.dropProcedureIfExists(name)`
- `schema.hasProcedure(name)` — check existence
- `schema.createFunction(name, params, body, options?)` — create a function (MySQL / PG)
- `schema.dropFunction(name)` / `schema.dropFunctionIfExists(name)`
- `schema.hasFunction(name)`
- `db.callProcedure(name, params)` — call a stored procedure
- `db.callFunction(name, params)` — call a function

#### Savepoints
- `db.savepoint(name)` — create a savepoint inside a transaction
- `db.rollbackTo(name)` — partial rollback to a savepoint
- `db.releaseSavepoint(name)` — release a savepoint

#### Isolation Levels
- `db.setIsolationLevel(level)` — set isolation level before `beginTransaction()`
- New `IsolationLevel` constant exported from `'outlet-orm'`:
  `READ_UNCOMMITTED`, `READ_COMMITTED`, `REPEATABLE_READ`, `SERIALIZABLE`
- SQLite: `SERIALIZABLE` is a no-op; other levels throw `UnsupportedCapabilityError`

#### New Error Class
- `UnsupportedCapabilityError` — thrown when a driver doesn't support a capability.
  Has `.driver` and `.capability` properties. Exported from `'outlet-orm'`.

#### New Source Files
- `src/Errors/UnsupportedCapabilityError.js`
- `src/Schema/ViewBuilder.js`
- `src/Schema/TriggerBuilder.js`
- `src/Schema/ProcedureBuilder.js`

#### Tests
- `tests/DatabaseObjects.test.js` — 25 tests covering all new features with SQLite in-memory

#### Documentation
- `docs/DATABASE_OBJECTS.md` — comprehensive reference for all new DB-object APIs
- `docs/MIGRATIONS.md` — new "Database Objects in Migrations" section
- `README.md` — savepoints, isolation levels, and DB objects sections added

## [11.1.0] - 2026-04-08

### 📚 Documentation

- Updated all 7 skills files for v11 features (SKILL, MODELS, QUERIES, RELATIONS, API, ADVANCED, TYPESCRIPT)
- Updated 5 docs files (MODELS, QUERY_BUILDER, RELATIONS, SCOPES, API_REFERENCE)
- Updated README with v11 key features, new API reference entries for Model, QueryBuilder, and DatabaseConnection

## [11.0.0] - 2026-04-08

### ✨ New — Proxy-based Property Access

- Model instances now support direct property access (`user.name` instead of `user.getAttribute('name')`)
- Proxy-based implementation with collision-safe `_ownProperties` guard
- Property assignment writes through to `setAttribute()` automatically

### ✨ New — Eloquent-style Model Methods

- **`fresh(...relations)`** — Reload a model from the database, returns a new instance
- **`refresh()`** — Reload the current instance in place from the database
- **`replicate(...except)`** — Clone the model without its primary key
- **`is(model)` / `isNot(model)`** — Identity comparison (same table + same PK)
- **`only(...keys)` / `except(...keys)`** — Return a subset/exclusion of attributes as plain objects

### ✨ New — Instance-level Visibility Control

- **`makeVisible(...attrs)`** — Reveal statically hidden attributes on a specific instance
- **`makeHidden(...attrs)`** — Hide additional attributes on a specific instance
- **`static appends`** — Declare computed accessor attributes to include in `toJSON()` output

### ✨ New — Change Tracking

- **`wasChanged(attr?)`** — Check if attribute(s) changed after the last save
- **`getChanges()`** — Get all attributes that changed during the last save

### ✨ New — QueryBuilder Enhancements

- **`pluck(column, keyColumn?)`** — Return array of values (or keyed object) for a column
- **`value(column)`** — Return a single scalar value from the first row
- **`sum(column)` / `avg(column)` / `min(column)` / `max(column)`** — SQL aggregate functions
- **`chunk(size, callback)`** — Process large result sets in chunks
- **`when(condition, callback, fallback?)`** — Conditional query building
- **`tap(callback)`** — Debugging passthrough for query inspection
- **`toSQL()`** — Return the built query representation without executing
- **`dd()`** — Dump query and die (throws after logging)

### ✨ New — Local Scopes

- Define `static scopeName(query, ...args)` methods on models
- Call them fluently: `User.query().active().olderThan(18)`
- Proxy-based interception on `QueryBuilder` returned by `Model.query()`

### ✨ New — Relation Defaults

- **`withDefault(value?)`** on `HasOne`, `MorphOne`, `HasOneThrough` relations
- Supports `true` (empty model), object (model with attributes), or function (custom builder)

### ✨ New — DatabaseConnection Aggregates

- **`aggregate(table, fn, column, query)`** — Generic SUM/AVG/MIN/MAX support at driver level

### 🧪 Tests

- Added 17 tests for property access (`tests/PropertyAccess.test.js`)
- Added 51 tests for all new features (`tests/NewEvolutions.test.js`)
- Total: 433 tests passing

### 📝 TypeScript

- Updated `types/index.d.ts` with all new method signatures and types

## [10.0.0] - 2026-04-01

### 💥 Breaking — Rename AiBridge → AI

- **`AiBridgeManager`** renamed to **`AIManager`** across source, types, tests, and docs
- **`AiBridge`** facade renamed to **`AI`** (`src/AI/Facades/AI.js`)
- **`config/aibridge.js`** renamed to **`config/ai.js`**
- **`config/.env.aibridge.example`** renamed to **`config/.env.ai.example`**
- **`AiBridgeConfig`** type renamed to **`AIConfig`**
- Updated all `require()` paths, JSDoc `@param` types, error messages, and exports
- Updated all documentation, skills, README, and CHANGELOG references

### 📖 Documentation — Table of Contents

- Added `## Table of Contents` with anchor links to README.md and all 29 `docs/*.md` files
- Added `scripts/add-toc.js` utility to regenerate TOCs

### Migration from v9

```js
// Before (v9)
const { AiBridgeManager } = require('outlet-orm');
const ai = new AiBridgeManager({ ... });

// After (v10)
const { AIManager } = require('outlet-orm');
const ai = new AIManager({ ... });
```

## [9.0.2] - 2026-02-28

### ♻️ Refactor — Move Skills to project root

- Moved `docs/skills/` → `skills/` at the project root for clearer separation of concerns
- `docs/` now contains only human documentation
- `skills/` contains AI agent / Copilot Skills documentation (published to npm)
- Updated `package.json` files field: `"docs/skills/**"` → `"skills/**"`
- Updated cross-references in `docs/INDEX.md`

## [9.0.1] - 2026-02-28

### 📖 Documentation — Enrich Copilot Skills (`docs/skills/`)

The AI Copilot Skills documentation (published to npm) is now fully aligned with v9.0.0.

- **SKILL.md** — Bumped to v9.0.0, expanded AI section with AI references
- **AI.md** — Complete rewrite with AI (9 providers, chat, stream, embeddings, images, TTS, STT, tool calling), AI Query Builder, AI Seeder, AI Query Optimizer, AI Prompt Enhancer, MCP Server (13 tools), AI Safety Guardrails, support classes, and quick reference
- **API.md** — Added AIManager, TextBuilder, AIQueryBuilder, AISeeder, AIQueryOptimizer, AIPromptEnhancer, AISafetyGuardrails API tables
- **QUERIES.md** — Added AI Query Builder and AI Query Optimizer sections
- **SEEDS.md** — Added AI Seeder section with API reference and context options

## [9.0.0] - 2026-02-28

### 📖 Major Feature — Complete AI Documentation

This major release adds comprehensive documentation for the full AI feature set introduced in v7.0.0 and v8.0.0. All AI capabilities are now thoroughly documented with API references, code examples, best practices, and integration guides.

#### 6 New Documentation Pages

- **[AI_BRIDGE.md](docs/AI_BRIDGE.md)** — Complete guide for AI, the multi-provider LLM abstraction layer:
  - AIManager API reference (chat, stream, embeddings, images, TTS, STT, models)
  - TextBuilder fluent API with all chaining methods and terminal methods
  - Tool calling / function calling with ToolContract, registration, and chatWithTools loop
  - All 9 provider implementations with capabilities matrix
  - 6 contract base classes documentation
  - AI Facade convenience API
  - Support classes: Message, Document, StreamChunk, Normalizers, FileSecurity, JsonSchemaValidator
  - Configuration reference with all environment variables
  - Per-call overrides and custom provider setup

- **[AI_QUERY.md](docs/AI_QUERY.md)** — AI Query Builder documentation:
  - Natural language to SQL conversion API
  - Schema introspection for MySQL, PostgreSQL, SQLite
  - Safe mode (SELECT-only enforcement)
  - `query()` (execute) and `toSql()` (generate only) methods
  - Provider switching examples
  - MCP tool integration (`ai_query`)

- **[AI_SEEDER.md](docs/AI_SEEDER.md)** — AI Seeder documentation:
  - LLM-powered realistic data generation
  - `seed()` (generate + insert) and `generate()` (preview) methods
  - Domain-aware context: locale, domain, description
  - Multi-locale examples (fr_FR, ja_JP, pt_BR)
  - E-commerce, blog, healthcare use case examples

- **[AI_OPTIMIZER.md](docs/AI_OPTIMIZER.md)** — AI Query Optimizer documentation:
  - `optimize()` method with suggestions, indexes, and rewritten SQL
  - `explain()` method with EXPLAIN plan analysis
  - Common optimization patterns detected
  - Suggestion format with type/description/impact

- **[AI_PROMPT.md](docs/AI_PROMPT.md)** — AI Prompt Enhancer documentation:
  - Schema generation from natural language descriptions
  - Model code generation with relationships
  - Migration code generation
  - Complete workflow example (schema → migrations → models → seeds)
  - Comparison with regex-based PromptGenerator
  - 7 built-in domain patterns reference

- **[AI_SAFETY.md](docs/AI_SAFETY.md)** — AI Safety Guardrails documentation:
  - Agent detection methods for 10+ AI agents
  - Destructive command list and protection flow
  - Consent mechanisms (env var, MCP argument, CLI flag)
  - Blocking message format
  - MCP tool safety matrix
  - Best practices

#### Documentation Updates

- **INDEX.md** — Updated to v9.0.0 with expanded AI Integration section linking all 6 new pages
- **README.md** — Added comprehensive AI Integration section with:
  - AI quick start (chat, stream, TextBuilder)
  - AI Query Builder examples
  - AI Seeder examples
  - AI Query Optimizer examples
  - MCP Server configuration
  - Links to all AI documentation pages
- Updated feature list in README with all AI capabilities

## [8.0.0] - 2025-06-28

### 🤖 New Features — AI: Multi-Provider LLM Abstraction

Full port of [AI](https://github.com/YourOrg/AiBridge) (PHP/Laravel v2.6.0) into outlet-orm as a native Node.js module. Provides a unified API for 9+ LLM providers with zero new production dependencies (uses Node 18+ native `fetch`).

#### AI Manager & Configuration
- Added **AIManager** — central orchestrator for multi-provider AI operations
- Config-driven auto-registration: pass provider configs and they're ready to use
- Methods: `chat()`, `stream()`, `streamEvents()`, `embeddings()`, `models()`, `model()`, `image()`, `tts()`, `stt()`
- Dynamic provider resolution with runtime overrides (api key, endpoint, headers)
- Tool registry integration: `registerTool()`, `tool()`, `tools()`
- Config file: `config/ai.js` + env template `config/.env.ai.example`

#### 9 LLM Providers (all standalone, no production deps)
- **OpenAIProvider** — GPT-4o, GPT-4o-mini, o1, etc. (chat + streaming)
- **OllamaProvider** — Local Ollama instance (chat + streaming)
- **OllamaTurboProvider** — Ollama cloud API (extends OllamaProvider)
- **ClaudeProvider** — Anthropic Claude (claude-sonnet-4-20250514, opus, haiku)
- **GeminiProvider** — Google Gemini (gemini-2.0-flash, pro)
- **GrokProvider** — xAI Grok
- **MistralProvider** — Mistral AI (extends OpenAIProvider)
- **OnnProvider** — Onn.ai API
- **CustomOpenAIProvider** — Any OpenAI-compatible endpoint (LM Studio, vLLM, etc.)

#### 6 Contract Base Classes
- **ChatProviderContract** — `chat()`, `stream()`, `supportsStreaming()`
- **EmbeddingsProviderContract** — `embeddings()`
- **ImageProviderContract** — `generateImage()`
- **AudioProviderContract** — `textToSpeech()`, `speechToText()`
- **ModelsProviderContract** — `listModels()`, `getModel()`
- **ToolContract** — `name()`, `description()`, `schema()`, `execute()`

#### Support Classes
- **ChatNormalizer** — normalizes chat responses across OpenAI, Ollama, Claude, Gemini formats
- **EmbeddingsNormalizer** — normalizes embedding vectors (OpenAI, Gemini, raw)
- **ImageNormalizer** — normalizes image generation responses
- **AudioNormalizer** — normalizes TTS/STT responses
- **StreamChunk** — structured DTO for streaming (delta, end, tool_call, tool_result)
- **Message** — value object with `user()`, `system()`, `assistant()` factory methods
- **Document** — multi-format document attachment (`fromText`, `fromUrl`, `fromBase64`, `fromLocalPath`, `fromChunks`, `fromFileId`)
- **FileSecurity** — file validation with size limits
- **JsonSchemaValidator** — recursive JSON Schema validation
- **ProviderError** — typed errors (`notFound()`, `unsupported()`)
- **ToolRegistry** — register and retrieve tools by name
- **ToolChatRunner** — orchestrate tool-calling chat loops

#### TextBuilder (Fluent API)
- Added **TextBuilder** — fluent builder for text generation
- Chain: `.using('openai', 'gpt-4o').withPrompt('...').withMaxTokens(200).asText()`
- Override helpers: `withApiKey()`, `withEndpoint()`, `withBaseUrl()`, `withExtraHeaders()`
- Terminal methods: `asText()`, `asRaw()`, `asStream()`

#### ORM AI Features — NL→SQL, AI Seeding, Query Optimization
- Added **AIQueryBuilder** — natural language to SQL conversion
  - Introspects database schema (MySQL, PostgreSQL, SQLite)
  - Safe mode: only SELECT/WITH queries by default
  - Methods: `query()`, `toSql()`, `using()`, `safeMode()`
- Added **AISeeder** — LLM-powered realistic seed data generation
  - Generates contextual data instead of lorem ipsum
  - Methods: `seed()` (generate + insert), `generate()` (generate only)
- Added **AIQueryOptimizer** — AI-powered SQL optimization
  - Analyzes queries and suggests indexes, rewrites, and improvements
  - Methods: `optimize()`, `explain()` (EXPLAIN plan analysis)
- Added **AIPromptEnhancer** — LLM-powered schema/code/migration generation
  - Methods: `generateSchema()`, `generateModelCode()`, `generateMigrationCode()`

#### MCP Server Integration
- Added 2 new MCP tools: `ai_query` and `query_optimize` (total: 13 tools)
- `ai_query` — natural language database queries via AI (requires AI config)
- `query_optimize` — AI-powered SQL query optimization suggestions

#### Built-in Tools
- Added **SystemInfoTool** — returns Node.js version, platform, architecture, uptime

#### TypeScript Support
- Full TypeScript declarations for all new classes, interfaces, and configs (~300 lines)
- Typed provider configs, builder methods, and ORM AI feature return types

#### Testing
- 112 new tests across 8 sections (Contracts, Support, Providers, Manager, Builder, ORM AI, MCP, Exports)
- Total test suite: **364 tests, 16 suites, all passing**

## [7.0.0] - 2025-02-28

### 🤖 New Features — AI Integration

#### MCP Server (Model Context Protocol)
- Added **MCPServer** class — exposes ORM capabilities to AI agents via JSON-RPC 2.0 over stdio
- Protocol version: `2024-11-05` (modelcontextprotocol.io)
- 11 built-in tools: `migrate_status`, `migrate_run`, `migrate_rollback`, `migrate_reset`, `migrate_make`, `seed_run`, `schema_introspect`, `query_execute`, `model_list`, `backup_create`, `backup_restore`
- Multi-driver schema introspection (SQLite PRAGMA, PostgreSQL information_schema, MySQL DESCRIBE)
- Programmatic handler mode for testing and embedding: `server.handler()`
- Auto-loads database config from `database/config.js` or `.env` fallback
- CLI entry point: `npx outlet-mcp` (new bin command)
- Options: `--project <path>`, `--no-safety`

#### AI Safety Guardrails
- Added **AISafetyGuardrails** class — detects AI agent invocations and protects against destructive operations
- Auto-detects 10+ AI agents: Cursor, Claude Code, GitHub Copilot, Windsurf, Gemini CLI, Aider, Replit, Qwen Code, MCP clients
- Blocks destructive commands (`reset`, `fresh`, `drop`, `truncate`, `restore`) when invoked by AI without explicit user consent
- Consent mechanism: `OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env var or `--consent` flag
- Detailed blocking messages instruct AI agents to explain risks and request user approval
- Integrated into `outlet-migrate` CLI for `reset`, `refresh`, and `fresh` commands

#### Prompt-based Project Initialization
- Added **PromptGenerator** class — parses natural language descriptions and generates complete project scaffolding
- `outlet-init --prompt "Create a blog with posts, comments, and tags"` generates models, migrations, and seeders
- 7 built-in domain patterns: E-commerce, Blog/CMS, Task/Project, Social Network, SaaS, Habit Tracker, API/Auth
- Smart column type mapping with modifiers (nullable, unique, default values, foreign keys)
- `--driver` flag to specify database driver (mysql, postgres, sqlite)

#### Agent Skills
- Added AI skill file `docs/skills/outlet-orm/AI.md` — structured documentation for AI agents
- Updated `SKILL.md` to reference v7.0.0 features
- Covers MCP server configuration, tool usage examples, safety guardrails, and prompt-based init

### 📦 Package Changes
- New bin entry: `outlet-mcp` → `bin/mcp.js`
- New exports: `MCPServer`, `AISafetyGuardrails`, `PromptGenerator`
- Skills files included in npm package (`docs/skills/**`)
- New keywords: `mcp`, `ai-agent`
- Full TypeScript declarations for all new classes and interfaces

### 🧪 Tests
- Added 36 tests for AI features (MCPServer, AISafetyGuardrails, PromptGenerator, module exports)
- Total: 252 tests across 15 suites

## [6.5.0] - 2026-02-27

### ✨ New Features — Eloquent Parity

#### Accessors & Mutators
- Added **accessor** support: define `get{PascalKey}Attribute(value)` methods on Model subclasses to transform values on read via `getAttribute(key)`
- Added **mutator** support: define `set{PascalKey}Attribute(value)` methods on Model subclasses to transform values on write via `setAttribute(key, value)`
- Supports `snake_case` keys automatically converted to `PascalCase` method names (e.g., `email_domain` → `getEmailDomainAttribute`)
- Accessors can return computed/virtual attributes not stored in the database

#### firstOrCreate / firstOrNew / updateOrCreate
- Added `Model.firstOrCreate(conditions, values)` — finds the first record matching conditions or creates a new one with the merged attributes
- Added `Model.firstOrNew(conditions, values)` — same as `firstOrCreate` but returns an unsaved instance when not found
- Added `Model.updateOrCreate(conditions, values)` — finds and updates or creates a new record
- All three methods also available on QueryBuilder: `query.firstOrCreate(values)`, `query.firstOrNew(values)`, `query.updateOrCreate(values)` using current `where` clauses as conditions

#### upsert (INSERT … ON CONFLICT)
- Added `Model.upsert(rows, uniqueBy, update)` — bulk insert with conflict resolution
- Generates driver-specific SQL:
  - SQLite / PostgreSQL: `INSERT … ON CONFLICT (cols) DO UPDATE SET …`
  - MySQL: `INSERT … ON DUPLICATE KEY UPDATE …`
- Accepts string or array for `uniqueBy`; `update` defaults to all non-unique columns

#### Observer Pattern
- Added `Model.observe(ObserverClass | observerInstance)` — register an observer that listens to model lifecycle events
- Supported events: `creating`, `created`, `updating`, `updated`, `saving`, `saved`, `deleting`, `deleted`, `restoring`, `restored`
- Observer methods receive the model instance as argument

#### cursor() — Async Generator for Lazy Iteration
- Added `Model.cursor(chunkSize)` and `QueryBuilder.cursor(chunkSize)` — async generator that lazily fetches records in chunks
- Yields individual model instances, ideal for processing large datasets with low memory footprint
- Default chunk size: 100

### 🧪 Tests
- Added 28 new tests covering all v6.5.0 features (tests/NewFeatures.test.js)
- Total test count: 216 passing across 14 test suites

### 📦 TypeScript
- Added `ModelObserver<T>` interface type
- Added type declarations for `firstOrCreate`, `firstOrNew`, `updateOrCreate`, `upsert`, `observe`, `cursor` on both Model and QueryBuilder

## [6.0.0] - 2026-02-26

### ✨ New Feature — Backup Module

#### BackupManager
- Added `BackupManager` class with three backup strategies:
  - `full()` — complete schema (CREATE TABLE) + data (INSERT) dump for every table
  - `partial(tables)` — schema + data for selected tables only
  - `journal()` — transaction-log replay from the DatabaseConnection query log (INSERT / UPDATE / DELETE)
- `restore(filePath, options?)` — replay a SQL backup file inside a transaction; auto-detects and decrypts encrypted files transparently
- Supports `sql` and `json` output formats
- Compatible with MySQL, PostgreSQL, and SQLite drivers

#### BackupScheduler
- Added `BackupScheduler` class for recurring (timer-based) backup jobs:
  - `schedule(type, config)` — register a named repeating backup job
  - `stop(name)` — cancel a job by name
  - `stopAll()` — cancel all active jobs
  - `activeJobs()` — list currently scheduled job names
- Supports `runNow: true` option to trigger an immediate first run on scheduling

#### BackupEncryption — AES-256-GCM at rest
- Added `BackupEncryption` module for zero-dependency file-level encryption:
  - AES-256-GCM with scrypt key derivation (N=16384, r=8, p=1)
  - **Grain de sable** — configurable random alphanumeric salt of 4–6 characters generated per encryption operation and stored in the file header for key reconstruction
  - Encrypted file format: `OUTLET_ENC_V1` magic header, salt, IV hex, GCM auth tag hex, base64 ciphertext
  - `encrypt(plaintext, password, saltLength?)` / `decrypt(encryptedContent, password)` / `isEncrypted(content)` / `generateSalt(length?)`
- `BackupManager` accepts `{ encrypt, encryptionPassword, saltLength }` constructor options; encrypted files get `.enc` extension automatically

#### BackupSocketServer — TCP daemon
- Added `BackupSocketServer` — long-running TCP daemon (default port 9119) for remote backup management:
  - NDJSON (newline-delimited JSON) protocol over Node.js `net`
  - Commands: `ping`, `status`, `jobs`, `schedule`, `stop`, `stopAll`, `run`, `restore`
  - Push events broadcast to all connected clients: `jobStart`, `jobDone`, `jobError`
  - Per-job encryption options override server defaults
  - Zero external dependencies (Node.js built-ins only)

#### BackupSocketClient — Promise-based client
- Added `BackupSocketClient` — EventEmitter TCP client with full Promise API:
  - `connect()` / `disconnect()`
  - `ping()`, `status()`, `jobs()`
  - `schedule(type, config)`, `stop(name)`, `stopAll()`
  - `run(type, tables?, options?)` — immediate one-shot backup
  - `restore(filePath, options?)` — remote restore with optional decryption password
  - Push events: `jobStart`, `jobDone`, `jobError`, `serverEvent`

### 📦 API
- Exported `BackupManager`, `BackupScheduler`, `BackupEncryption`, `BackupSocketServer`, `BackupSocketClient` from the package public API
- Added full TypeScript declarations for all Backup module classes, interfaces, and types

## [5.5.3] - 2026-02-26

### 📐 Architecture

- Adopted **2-layer architecture** (Controllers → Models) as the recommended project structure — `services/` and `repositories/` layers removed from documentation and examples.
- Updated `docs/ARCHITECTURE.md` completely: new project structure, flow diagram, responsibilities table, and implementation example all reflecting the 2-layer pattern; removed the former "Simplified Architecture" appendix (now the primary pattern); fixed all French text remnants.
- Updated `README.md` project structure section: folder tree, flow diagram, role table, and example workflow all updated to 2-layer (no Services/Repositories).
- Restructured `examples/simplified-architecture/` as the canonical example (unchanged files, updated documentation context).

### 📚 Documentation

- Completed UK English translation of all inline code comments, table descriptions, and paragraph text across `README.md` and `docs/ARCHITECTURE.md`.
- Added `examples/simplified-architecture/README.md` and `.env.example`.


## [5.5.1] - 2026-02-26

### 🌱 Migrations & Seeds Enhancement

- Added first-class seeding support in the migration CLI:
  - `outlet-migrate make:seed <SeederName>`
  - `outlet-migrate seed`
  - `outlet-migrate db:seed` (alias)
  - `outlet-migrate seed --class <SeederName>` / `-c`
- Added new runtime classes:
  - `Seeder`
  - `SeederManager`
- Exported `Seeder` and `SeederManager` from package public API.
- Added TypeScript declarations for seeding API.
- `outlet-init` now scaffolds `database/seeds/` and a default `DatabaseSeeder.js`.
- Aligned default seeder directory naming to Laravel-style `database/seeds`.

### 📚 Documentation & Skills

- Expanded migrations documentation with migration+seed workflow, options, idempotence notes, and troubleshooting.
- Added dedicated seeding guides:
  - `docs/SEEDS.md`
  - `docs/skills/outlet-orm/SEEDS.md`
- Updated docs/skills indexes and cross-links for migrations and seeds.

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

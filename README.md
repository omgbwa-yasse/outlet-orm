# outlet-orm

`outlet-orm` is an Active Record ORM for Node.js 18+ that covers much more than the usual SQL layer. The package bundles a relational ORM core, a schema builder and migration engine, seeders, backup and reverse-engineering tools, a REST/GraphQL API layer, a multi-provider AI bridge, and an MCP server for agents.

The public entry point is [src/index.js](src/index.js). TypeScript signatures are published through [types/index.d.ts](types/index.d.ts). The real surface is also confirmed by the test suites in [tests](tests) and the examples in [examples](examples).

## Table of Contents

- [Positioning](#positioning)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Active Record Model](#active-record-model)
- [Queries and QueryBuilder](#queries-and-querybuilder)
- [Relationships and Eager Loading](#relationships-and-eager-loading)
- [Advanced Model Features](#advanced-model-features)
- [DatabaseConnection and Standalone Mode](#databaseconnection-and-standalone-mode)
- [Schema Builder, Migrations, and Seeders](#schema-builder-migrations-and-seeders)
- [Backups, Restore, and Migration Safety](#backups-restore-and-migration-safety)
- [Reverse Engineering, Init, and Conversion](#reverse-engineering-init-and-conversion)
- [Advanced SQL Objects and Transactions](#advanced-sql-objects-and-transactions)
- [HTTP / GraphQL API Layer](#http--graphql-api-layer)
- [API Spec Import and Diff](#api-spec-import-and-diff)
- [AI, MCP, and Automation](#ai-mcp-and-automation)
- [CLI Reference](#cli-reference)
- [TypeScript](#typescript)
- [Examples and Validation](#examples-and-validation)
- [Useful Notes and Limits](#useful-notes-and-limits)

## Positioning

`outlet-orm` is not just a CRUD ORM. The package spans 8 complementary areas:

| Area | Main exports / commands | What it provides |
| --- | --- | --- |
| SQL ORM | `Model`, `QueryBuilder`, `DatabaseConnection` | Active Record, fluent queries, transactions, casts, validation |
| Relationships | `hasOne`, `hasMany`, `belongsTo`, `belongsToMany`, `hasManyThrough`, `hasOneThrough`, `morph*` | Relational navigation and eager loading |
| Schema / migrations | `Schema`, `Blueprint`, `Migration`, `MigrationManager`, `Seeder`, `SeederManager` | Schema evolution, seeders, deployment workflows |
| DB objects | `View`, `Trigger`, `Procedure`, `Function`, `Transaction`, `useSchema` | Views, triggers, procedures, savepoints, isolation levels |
| Backups | `BackupManager`, `BackupScheduler`, `BackupEncryption`, `BackupSocketServer`, `BackupSocketClient` | SQL/JSON backups, encryption, scheduling, restore |
| API Layer | `Api`, `ApiGraphQL`, `ApiAdapter`, `MockAdapter`, cache, offline, realtime | The same modeling style, but over HTTP |
| AI bridge | `AIManager`, `Ai`, providers, `TextBuilder`, `AIQueryBuilder`, `AISeeder`, `AIPromptEnhancer` | Chat, tools, NL->SQL, AI seeds, guided generation |
| CLI / MCP | `outlet`, `outlet-migrate`, `outlet-reverse`, `outlet-mcp`, `outlet api import`, `outlet api diff` | Project init, conversion, reverse engineering, MCP agent integration |

## Installation

Base installation:

```bash
npm install outlet-orm
```

Then install only the driver you need:

```bash
npm install mysql2
```

```bash
npm install pg
```

```bash
npm install sqlite3
```

Useful dependencies and prerequisites:

- Node.js `>= 18.0.0`
- the main package is CommonJS (`require` / `module.exports`)
- `mysql2`, `pg`, and `sqlite3` are optional peer dependencies loaded on demand
- `graphql-ws` is optional if you use GraphQL subscriptions
- the package ships its own types through `types/index.d.ts`

## Quick Start

### 1. Configure a connection

```js
const { DatabaseConnection } = require('outlet-orm');

const db = new DatabaseConnection({
  driver: 'sqlite',
  database: ':memory:'
});

await db.connect();
```

The core layer supports these drivers:

- `mysql`
- `postgres` / `postgresql`
- `sqlite`

Configuration can come from:

- `new DatabaseConnection({...})` directly
- `.env` (`DB_DRIVER`, `DB_HOST`, `DB_DATABASE`, `DB_FILE`, `DATABASE_URL`, and others)
- `database/config.js` for the migration CLI

### 2. Define a model

```js
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'password', 'status'];
  static hidden = ['password'];
  static casts = {
    id: 'int',
    email_verified: 'boolean'
  };
  static connection = db;
}
```

### 3. Use the model

```js
const user = await User.create({
  name: 'Ada',
  email: 'ada@example.com',
  password: 'secret',
  status: 'active'
});

const activeUsers = await User
  .where('status', 'active')
  .orderBy('id', 'desc')
  .limit(10)
  .get();
```

## Active Record Model

The ORM core is built around [src/Model.js](src/Model.js). A model typically declares:

- `static table`
- `static primaryKey`
- `static timestamps`
- `static fillable`
- `static hidden`
- `static casts`
- `static appends`
- `static connection`
- `static softDeletes`
- `static rules`

Main model capabilities:

- static CRUD: `all()`, `find()`, `findOrFail()`, `create()`, `insert()`, `update()`, `delete()`
- lookup helpers: `first()`, `firstOrCreate()`, `firstOrNew()`, `updateOrCreate()`, `upsert()`
- pagination: `paginate(page, perPage)`
- streaming: `cursor(chunkSize)`
- serialization: `toJSON()`, `only()`, `except()`
- lifecycle: `save()`, `destroy()`, `fresh()`, `refresh()`, `replicate()`
- change tracking: `getDirty()`, `isDirty()`, `wasChanged()`, `getChanges()`

Useful detail: instances are wrapped in a `Proxy`, which enables property-style access:

```js
const user = await User.find(1);

console.log(user.name);
user.name = 'Grace';
await user.save();
```

This behavior is covered by [tests/PropertyAccess.test.js](tests/PropertyAccess.test.js).

## Queries and QueryBuilder

`QueryBuilder` covers the standard cases plus a number of Laravel-style parity helpers.

### Basic filters and clauses

Common methods:

- `select(...columns)`
- `columns([...])`
- `distinct()`
- `where(column, value)`
- `where(column, operator, value)`
- `orWhere(...)`
- `whereIn()`, `whereNotIn()`
- `whereNull()`, `whereNotNull()`
- `whereBetween()`, `whereNotBetween()`
- `whereLike()`
- `orderBy()`
- `limit()`, `offset()`, `skip()`, `take()`
- `groupBy()`
- `having()`, `havingRaw()`
- `join()`, `leftJoin()`, `rightJoin()`, `crossJoin()`
- `union()`, `unionAll()`

### Relationship loading and relational filters

- `with(...)`
- `withCount(...)`
- `withSum(relation, column)`
- `withAvg(relation, column)`
- `withMin(relation, column)`
- `withMax(relation, column)`
- `whereHas(relation, callback)`
- `has(relation, count)`
- `whereDoesntHave(relation)`

### Retrieval and mutation

- `get()`
- `first()`
- `firstOrFail()`
- `paginate()`
- `count()`
- `exists()` / `doesntExist()`
- `insert()` / `insertGetId()`
- `update()`
- `updateAndFetch()`
- `delete()`
- `increment()` / `decrement()`

### Useful helpers

- `pluck(column)`
- `pluck(column, keyColumn)`
- `value(column)`
- `sum()`, `avg()`, `min()`, `max()`
- `chunk(size, callback)`
- `when(condition, callback, fallback)`
- `tap(callback)`
- `toSQL()`
- `dd()`
- `clone()`

Example:

```js
const rows = await User
  .where('status', 'active')
  .whereBetween('created_at', ['2026-01-01', '2026-12-31'])
  .withCount('posts')
  .withMax('posts', 'created_at')
  .orderBy('posts_count', 'desc')
  .get();
```

Recent behaviors and parity helpers are covered by [tests/NewParityFeatures.test.js](tests/NewParityFeatures.test.js), [tests/NewFeatures.test.js](tests/NewFeatures.test.js), [tests/NewEvolutions.test.js](tests/NewEvolutions.test.js), and [tests/QueryBuilderStandalone.test.js](tests/QueryBuilderStandalone.test.js).

## Relationships and Eager Loading

Relationships supported by the ORM core:

- `hasOne`
- `hasMany`
- `belongsTo`
- `belongsToMany`
- `hasManyThrough`
- `hasOneThrough`
- `morphOne`
- `morphMany`
- `morphTo`

Example:

```js
class User extends Model {
  static table = 'users';
  static connection = db;

  posts() {
    return this.hasMany(Post, 'user_id', 'id');
  }
}

class Post extends Model {
  static table = 'posts';
  static connection = db;

  author() {
    return this.belongsTo(User, 'user_id', 'id');
  }
}

const users = await User.with('posts').get();
```

Additional capabilities:

- constrained eager loading
- nested eager loading through dot notation
- `withDefault()` on relationships
- `attach()`, `detach()`, `sync()` on `belongsToMany`
- morph map support through `Model.setMorphMap(...)`

Related test suites:

- [tests/HasManyThrough.test.js](tests/HasManyThrough.test.js)
- [tests/Polymorphic.test.js](tests/Polymorphic.test.js)
- [tests/NestedEager.test.js](tests/NestedEager.test.js)

## Advanced Model Features

The package includes several behaviors that are not always present in lightweight ORMs.

### Visibility and serialization

- `static hidden`
- `withHidden()`
- `withoutHidden(show)`
- `makeVisible()`
- `makeHidden()`
- `static appends`

Also demonstrated in [examples/hidden-attributes-demo.js](examples/hidden-attributes-demo.js).

### Casts

Supported cast types:

- `int` / `integer`
- `float` / `double`
- `string`
- `bool` / `boolean`
- `array`
- `json`
- `date`
- `datetime`
- `timestamp`

### Accessors, mutators, and validation

The model layer also covers:

- accessors / mutators
- validation rules through `static rules`
- `validate()` and `validateOrFail()`
- `fillable` guarding on insert / update

### Events, observers, and scopes

Supported events:

- `creating`, `created`
- `updating`, `updated`
- `saving`, `saved`
- `deleting`, `deleted`
- `restoring`, `restored`

You can use:

- `Model.on(event, callback)`
- helper methods such as `creating(...)`, `saved(...)`, and others
- `Model.observe(MyObserver)`
- global scopes via `addGlobalScope()` / `withoutGlobalScope()` / `withoutGlobalScopes()`
- local scopes verified by [tests/NewEvolutions.test.js](tests/NewEvolutions.test.js)

### Soft deletes

Soft-delete features:

- `static softDeletes = true`
- `static DELETED_AT`
- `withTrashed()`
- `onlyTrashed()`
- `trashed()`
- `restore()`
- `forceDelete()`

The schema builder also exposes `softDeletes()` to add `deleted_at`.

## DatabaseConnection and Standalone Mode

[src/DatabaseConnection.js](src/DatabaseConnection.js) handles:

- connection and pooling
- query execution
- transactions
- query logging
- SQL aggregates
- standalone builder usage through `from(...)`

Standalone example without a model:

```js
await db.from('users')
  .where('status', 'pending')
  .update({ status: 'active' });

const exists = await db.from('users')
  .where('email', 'ada@example.com')
  .exists();
```

Useful low-level functions:

- `select()`
- `insert()` / `insertMany()`
- `update()`
- `delete()`
- `count()`
- `aggregate()`
- `executeRawQuery()`
- `execute()`
- `increment()` / `decrement()`

### Query log

Query logging can be enabled globally:

```js
DatabaseConnection.enableQueryLog();
// ...
const log = DatabaseConnection.getQueryLog();
DatabaseConnection.flushQueryLog();
```

The journal backup flow relies on this mechanism.

## Schema Builder, Migrations, and Seeders

The schema builder is provided by `Schema` and `Blueprint`.

### Primary schema operations

- `schema.create(name, callback)`
- `schema.table(name, callback)`
- `schema.rename(from, to)`
- `schema.drop(name)`
- `schema.dropIfExists(name)`
- `schema.hasTable(name)`
- `schema.hasColumn(table, column)`
- `schema.hasIndex(table, indexName)` / `indexExists(...)`

`Blueprint` notably covers:

- numeric, text, date, JSON, UUID, and binary columns
- `timestamps()` with multiple overloads
- `softDeletes()`
- indexes, unique indexes, full text
- foreign keys
- check constraints

Migration example:

```js
const { Migration } = require('outlet-orm');

class CreateUsersTable extends Migration {
  async up() {
    const schema = this.getSchema();

    await schema.create('users', (table) => {
      table.id();
      table.string('name');
      table.string('email').unique();
      table.timestamps();
      table.softDeletes();
    });
  }

  async down() {
    await this.getSchema().dropIfExists('users');
  }
}

module.exports = CreateUsersTable;
```

### Migration base class

The `Migration` base class also provides:

- `getSchema()`
- `query(table)` / `table(table)` for a standalone `QueryBuilder` inside migrations
- `log()`, `info()`, `warn()` for structured logging
- `shouldRun()` to skip a migration
- `withinTransaction` to wrap `up()` / `down()` in a transaction
- data-preservation helpers: `transformData()`, `backupData()`, `restoreData()`

### MigrationManager

`MigrationManager` handles:

- installation of the migrations table
- execution of pending migrations
- rollback by batch
- reset / refresh / fresh
- non-interactive deploy for CI/CD
- `resolve --applied` and `resolve --rolled-back`
- drift detection through checksums
- detection of migrations missing from disk
- `_migrations` tracking columns: `started_at`, `finished_at`, `rolled_back_at`, and others
- advisory locks for deploy / resolve on MySQL and PostgreSQL

### Seeder and SeederManager

The package provides:

- `Seeder`
- `SeederManager`
- `make:seed` scaffolding
- `seed` / `db:seed`
- class targeting through `--seeder` / `--class`

## Backups, Restore, and Migration Safety

The backup subsystem is not a minor add-on: it is directly integrated into the destructive migration lifecycle.

### Backup capabilities

- full `full` backup
- partial `partial` backup
- query-log-based SQL journal `journal`
- `sql` or `json` format
- encryption through `BackupEncryption`
- scheduling through `BackupScheduler`
- command sockets through `BackupSocketServer` and `BackupSocketClient`

### Safety for destructive migrations

Features built into the package:

- auto-backup before `fresh`, `reset`, `refresh`, and `rollback`
- retention of auto-backups per command
- automated restore through `restore:auto`
- restore history
- production protection through `OUTLET_PRODUCTION_CONFIRM=1` and explicit database-name confirmation
- `--skip-auto-backup` is ignored in production
- normalized exit codes

These behaviors are verified by:

- [tests/Backup.test.js](tests/Backup.test.js)
- [tests/BackupEncryption.test.js](tests/BackupEncryption.test.js)
- [tests/BackupSocket.test.js](tests/BackupSocket.test.js)
- [tests/MigrationDataPreservation.test.js](tests/MigrationDataPreservation.test.js)
- [tests/MigrationDeployOptions.test.js](tests/MigrationDeployOptions.test.js)
- [tests/MigrationExtraOptions.test.js](tests/MigrationExtraOptions.test.js)

## Reverse Engineering, Init, and Conversion

The package includes three complementary approaches to speed up adoption.

### `outlet-init`

Purpose:

- quickly initialize an outlet-orm project
- generate folders, a `.env`, a config file, migrations, and seeders
- classic interactive mode
- AI prompt mode through `--prompt`

Examples:

```bash
outlet-init
```

```bash
outlet-init --prompt "Blog with users, posts, comments" --driver sqlite
```

### `outlet-convert`

Purpose:

- parse SQL `CREATE TABLE`
- infer JavaScript casts
- suggest `fillable`, `hidden`, and relationships
- detect pivot tables for `belongsToMany`

### `outlet-reverse`

Purpose:

- introspect an existing database or SQL dump
- generate schema-builder-based migrations
- generate seeders from existing data

Reverse engineering covers MySQL, PostgreSQL, and SQLite in the `CREATE TABLE` parser, including many types, defaults, and foreign keys. See [tests/Reverse.test.js](tests/Reverse.test.js).

## Advanced SQL Objects and Transactions

The package goes beyond tables.

### SQL object builders

Public exports:

- `View`
- `Trigger`
- `Procedure`
- `Function`
- `Transaction`
- `useSchema(schemaOrDb)`

Capabilities exposed through `Schema` and the related builders:

- `createView`, `createOrReplaceView`, `dropView`, `dropViewIfExists`, `hasView`, `getViews`
- `createTrigger`, `dropTrigger`, `dropTriggerIfExists`, `hasTrigger`, `getTriggers`
- `createProcedure`, `dropProcedure`, `dropProcedureIfExists`, `hasProcedure`
- `createFunction`, `dropFunction`, `dropFunctionIfExists`, `hasFunction`

Example: [examples/migrations/create_views_and_triggers.js](examples/migrations/create_views_and_triggers.js).

### Advanced transactions

`DatabaseConnection` and `Transaction` cover:

- `beginTransaction()`
- `commit()`
- `rollback()`
- `transaction(callback)`
- `afterCommit(callback)`
- `savepoint(name)`
- `rollbackTo(name)`
- `releaseSavepoint(name)`
- `setIsolationLevel(level)`

Exported constants:

- `IsolationLevel.READ_UNCOMMITTED`
- `IsolationLevel.READ_COMMITTED`
- `IsolationLevel.REPEATABLE_READ`
- `IsolationLevel.SERIALIZABLE`

When a capability is not supported, the package exposes `UnsupportedCapabilityError`.

## HTTP / GraphQL API Layer

The API layer in [src/Api](src/Api) reproduces a model-like experience, but over HTTP.

### Main classes

- `Api`
- `ApiModel`
- `ApiAdapter`
- `createAdapter()`
- `ApiGraphQL`
- `MockAdapter`
- `InterceptorManager`
- `ApiCache`
- `ApiValidator`
- `ApiPaginator`
- `ApiQueryBuilder`

### REST capabilities

- CRUD through `find`, `findOrFail`, `all`, `get`, `create`, `save`, `destroy`
- HTTP query builder with `where`, `orWhere`, `whereIn`, `whereNull`, `orderBy`, `limit`, `offset`, `with`, `select`
- page/cursor/offset pagination and async iteration
- `bearer`, `basic`, `apiKey`, `cookie`, `oauth2`, and `dynamicHeaders` auth
- request logs and `toRequest()` for debugging without sending
- upload with progress when `XMLHttpRequest` is available
- payload / response validation
- typed error hierarchy (`ApiError`, `ApiValidationError`, `ApiRateLimitError`, and others)

### Cache, offline, realtime, and tests

The package also adds:

- cache strategies: cache-first, network-first, stale-while-revalidate, cache-only, network-only
- stores: memory, localStorage, sessionStorage
- offline queue through `MutationQueue`
- offline storage wrappers
- watchers / event stream / websocket
- a complete mock adapter for tests
- request / response interceptors, retry, and circuit breaker

Related suites are visible in:

- [tests/ApiLayer.test.js](tests/ApiLayer.test.js)
- [tests/ApiLayerIntegration.test.js](tests/ApiLayerIntegration.test.js)
- [tests/ApiCache.test.js](tests/ApiCache.test.js)
- [tests/ApiOffline.test.js](tests/ApiOffline.test.js)
- [tests/ApiInterceptors.test.js](tests/ApiInterceptors.test.js)
- [tests/ApiGraphQL.test.js](tests/ApiGraphQL.test.js)
- [tests/ApiValidation.test.js](tests/ApiValidation.test.js)
- [tests/ApiPagination.test.js](tests/ApiPagination.test.js)
- [tests/ApiMock.test.js](tests/ApiMock.test.js)

## API Spec Import and Diff

The package also provides a pipeline for generating API models from specs or reference documentation.

### `outlet api import`

Targeted command for:

- OpenAPI / Swagger
- Postman Collection
- GraphQL introspection
- RAML
- API Blueprint
- extraction from reference documentation through `--doc`

Notable options visible in [bin/api/import.js](bin/api/import.js):

- `--spec <path|url>`
- `--doc <path|url>`
- `--output <dir>`
- `--lang js|ts`
- `--auth bearer|basic|apiKey|oauth2`
- `--strategy tag|resource`
- `--format auto|openapi|postman|raml|apiblueprint|graphql`
- `--max-depth <n>`
- `--include-official-subdomains true|false`
- `--run-delta`

The pipeline also handles execution artifacts such as snapshots, run deltas, and coverage diagnostics.

### `outlet api diff`

Compares an OpenAPI spec with a directory of generated models:

- detects missing models
- detects extra models
- compares endpoints
- compares `fillable` fields

## AI, MCP, and Automation

The AI layer covers two areas: general LLM integration and ORM-oriented automation.

### Public AI exports

- `AIManager` and its alias `Ai`
- `AIFacade`
- `TextBuilder`
- contracts: `ChatProviderContract`, `EmbeddingsProviderContract`, `ImageProviderContract`, `AudioProviderContract`, `ModelsProviderContract`, `ToolContract`
- providers: `OpenAIProvider`, `OllamaProvider`, `OllamaTurboProvider`, `ClaudeProvider`, `GeminiProvider`, `GrokProvider`, `MistralProvider`, `OnnProvider`, `CustomOpenAIProvider`
- support: `StreamChunk`, `Message`, `Document`, `ProviderError`, `ToolRegistry`, `ToolChatRunner`, `SystemInfoTool`
- domain components: `AIQueryBuilder`, `AISeeder`, `AIQueryOptimizer`, `AIPromptEnhancer`
- historical / utility components: `MCPServer`, `AISafetyGuardrails`, `PromptGenerator`

### What the AI layer can do

- chat and text generation across multiple providers
- normalization for chat / embeddings / images / audio
- tool calling
- JSON schema validation
- protection for AI-related files and payloads
- NL->SQL through `AIQueryBuilder`
- SQL optimization suggestions through `AIQueryOptimizer`
- realistic data generation through `AISeeder`
- schema / model / migration generation through `AIPromptEnhancer`
- initial project / blueprint generation through `PromptGenerator`

Reference suites:

- [tests/AI.test.js](tests/AI.test.js)
- [tests/AiBridge.test.js](tests/AiBridge.test.js)

### MCP Server

`outlet-mcp` starts the MCP server on stdio.

Options:

- `--project`, `-p <path>`
- `--no-safety`

Tools exposed by default in [src/AI/MCPServer.js](src/AI/MCPServer.js):

- `migrate_status`
- `migrate_run`
- `migrate_rollback`
- `migrate_reset`
- `migrate_make`
- `seed_run`
- `schema_introspect`
- `query_execute`
- `model_list`
- `backup_create`
- `backup_restore`
- `ai_query`
- `query_optimize`

Destructive actions are protected by consent guardrails when safety is enabled.

## CLI Reference

### Unified entry point `outlet`

```bash
outlet <command> [args]
```

Subcommands routed by [bin/outlet.js](bin/outlet.js):

| Command | Role |
| --- | --- |
| `outlet init` | initializes a project |
| `outlet convert` | converts SQL into models |
| `outlet migrate` | runs the migration manager |
| `outlet reverse` | reverse engineers a DB / SQL source |
| `outlet mcp` | starts the MCP server |
| `outlet api import` | imports API models from specs / docs |
| `outlet api diff` | compares a spec and generated models |

Historical aliases remain exposed through `package.json`:

- `outlet-init`
- `outlet-convert`
- `outlet-migrate`
- `outlet-reverse`
- `outlet-mcp`
- `outlet-api-import`
- `outlet-api-diff`

### `outlet-migrate`

Subcommands documented by the current implementation:

| Command | Role |
| --- | --- |
| `install` | creates only the migrations table |
| `migrate` / `up` | executes pending migrations |
| `deploy` | applies pending migrations without interaction, for CI/CD |
| `resolve --applied=<name>` | marks a migration as applied |
| `resolve --rolled-back=<name>` | marks a migration as rolled back |
| `rollback --steps=N` | rolls back one or more batches |
| `reset --yes` | full rollback |
| `refresh --yes` | reset + migrate |
| `fresh --yes` | drop all + migrate |
| `status` | migration status |
| `seed` / `db:seed` | executes seeders |
| `make <name>` | scaffolds a migration |
| `make:seed <name>` | scaffolds a seeder |
| `make:transform <name>` | scaffolds a data-transformation migration |
| `restore:auto [--backup=<file>]` | restores an auto-backup |
| `backups:list [--json]` | lists auto-backups |

Important flags:

- `--pretend`
- `--allow-failed`
- `--step`
- `--steps=N` / `-s N`
- `--batch=N`
- `--seed`
- `--seeder=Name` / `--class=Name`
- `--pending`
- `--create=<table>`
- `--table=<table>`
- `--skip-auto-backup`
- `--allow-drift`
- `--backup=<file>`
- `--json`
- `--yes` / `-y`

Useful environment variables:

- `OUTLET_PRODUCTION_CONFIRM=1`
- `OUTLET_ALLOW_DRIFT=1`

## TypeScript

The package publishes declarations in [types/index.d.ts](types/index.d.ts). TypeScript examples live in:

- [examples/typescript-example.ts](examples/typescript-example.ts)
- [examples/typescript-migration.ts](examples/typescript-migration.ts)
- [examples/typescript-typed-model.ts](examples/typescript-typed-model.ts)

Minimal example:

```ts
import { Model, DatabaseConnection } from 'outlet-orm';

const db = new DatabaseConnection({ driver: 'mysql', host: 'localhost', database: 'app' });

class User extends Model {
  static readonly table = 'users';
  static readonly connection = db;
}
```

Practical note: the TypeScript declarations cover most of the public surface, but helpers introduced very recently on the JavaScript side may still need to be cross-checked in [src/QueryBuilder.js](src/QueryBuilder.js) and [CHANGELOG.md](CHANGELOG.md) if you are using the latest parity additions.

## Examples and Validation

Useful reference points in the repository:

- [examples/usage.js](examples/usage.js) : CRUD, relationships, eager loading, pagination
- [examples/hidden-attributes-demo.js](examples/hidden-attributes-demo.js) : `hidden`, `withHidden`, `withoutHidden`
- [examples/nested-demo.js](examples/nested-demo.js) : nested relationships
- [examples/polymorphic-demo.js](examples/polymorphic-demo.js) : polymorphic relationships
- [examples/relations-usage.js](examples/relations-usage.js) : standard relationships
- [examples/migrations](examples/migrations) : reference migrations
- [examples/simplified-architecture](examples/simplified-architecture) : small reference architecture
- [labo/run.js](labo/run.js) : lab scenario runner
- [tests](tests) : the most reliable behavior map of the package

Repository validation commands:

```bash
npm test --silent
```

```bash
npm run test:lab
```

```bash
npm run lint
```

## Useful Notes and Limits

- The package is very broad: for a simple use case, start with `DatabaseConnection`, `Model`, `Schema`, `Migration`, and `Seeder`.
- SQL drivers are loaded lazily: a missing-driver error appears at connection time, not when the main package is installed.
- The migration CLI can read `database/config.js`, but it also falls back to `.env` and `DATABASE_URL`.
- The HTTP API layer is independent from the SQL layer: you can use one without the other.
- The AI layer is optional, but tightly integrated with ORM, CLI, and MCP workflows.
- Destructive operations are intentionally stricter in production.
- The changelog is dense and useful: [CHANGELOG.md](CHANGELOG.md) documents additions in detail by version, especially v13+ for the API layer, v14+ for advanced migrations, and v15+ for compatibility helpers.

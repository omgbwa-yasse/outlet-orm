---
name: outlet-orm
description: 'Supports development with outlet-orm across models, QueryBuilder, schema, migrations, seeders, backups, API Layer, AI workflows, MCP, and CLI operations. Use when working on an outlet-orm project or when requests mention Model, DatabaseConnection, QueryBuilder, Migration, Seeder, Schema, outlet-migrate, outlet-reverse, outlet-mcp, outlet api import, ApiAdapter, ApiGraphQL, AIManager, AIQueryBuilder, or BackupManager.'
license: MIT
metadata:
  author: omgbwa-yasse
  version: '15.1.2'
---

References:

- [MODELS.md](references/MODELS.md): central reference for SQL models, hydration, attributes, casts, validation, scopes, serialization, soft deletes, and how `DatabaseConnection` is used from the ORM layer.
- [QUERIES.md](references/QUERIES.md): detailed `QueryBuilder` guide covering filters, aggregates, joins, pagination, mutations, batch iteration, SQL debugging, and standalone usage without going through a `Model` class.
- [RELATIONS.md](references/RELATIONS.md): reference for all ORM relationships, eager loading, `withCount`, `whereHas`, pivot tables, through relationships, and polymorphic models.
- [MIGRATIONS.md](references/MIGRATIONS.md): complete reference for `Schema`, `Blueprint`, `Migration`, `MigrationManager`, CLI scaffolding, drift handling, production guardrails, and validation workflows before execution.
- [SEEDS.md](references/SEEDS.md): dedicated document for `Seeder`, `SeederManager`, seeding commands, dataset generation, class-targeted execution, and how it connects with `AISeeder` for plausible data.
- [BACKUPS.md](references/BACKUPS.md): reference for full or partial dumps, encryption, scheduling, socket-based control, restoration, and auto-backups triggered by destructive commands.
- [API.md](references/API.md): detailed guide to the HTTP layer with `Api`, `ApiAdapter`, `ApiGraphQL`, cache, offline queue, realtime helpers, validators, typed errors, and API spec import/diff features.
- [AI.md](references/AI.md): reference for the AI layer covering `AIManager`, providers, `TextBuilder`, `AIQueryBuilder`, `AISeeder`, SQL optimization, prompt enhancement, MCP, and guardrails for sensitive operations.
- [ADVANCED.md](references/ADVANCED.md): document for advanced usage such as fluent DB objects, transactions, savepoints, isolation levels, `RawExpression`, and multi-driver behaviors exposed by the package.
- [CLI.md](references/CLI.md): reference for the `outlet*` executables, subcommands, critical flags, shell workflows, and the mapping between CLI operations and the package's internal surfaces.
- [TYPESCRIPT.md](references/TYPESCRIPT.md): guide to public typing, generic models, typed `QueryBuilder` usage, typed relationships, API/AI declarations, and the TypeScript examples shipped in the repository.

# Outlet ORM

## Contents

- When to use this skill
- How to use this skill
- Quick routing
- Package summary
- Recommended workflow
- Code landmarks
- Resources loaded on demand
- Do / Don't
- Expected agent response for this package

## When to use this skill

Use this skill when the request involves at least one of these areas:

- define or modify `Model` classes
- write queries with `QueryBuilder`
- configure `DatabaseConnection`
- create or fix migrations and seeders
- manage backups, restores, or the `outlet-migrate` workflow
- reverse engineer SQL or an existing database
- implement the `Api` / `ApiGraphQL` layer
- use AI tools (`AIManager`, `AISeeder`, `AIQueryBuilder`, `MCPServer`)
- document or automate an outlet-orm project

## How to use this skill

This folder is organized as a single skill with progressive disclosure:

- `SKILL.md` acts as the main index and operating guide
- the other `.md` files are specialized resources stored in `references/`
- for a given task, load one specialized document first, then open the referenced source code or tests only if something remains ambiguous

Recommended work order:

1. identify the relevant surface: SQL ORM, queries, relations, migrations, seeds, backups, API, AI, CLI, or TypeScript
2. read the matching specialized document
3. verify the exports in `src/index.js` and the logic in the primary source file
4. check a nearby test if the behavior may vary by driver or context

## Quick routing

Use this table as the entry point instead of reading the whole folder:

| If the request mentions... | Read first | Then verify if needed |
|---|---|---|
| models, attributes, casts, validation, soft deletes | `references/MODELS.md` | `src/Model.js`, `tests/Model.test.js` |
| SQL queries, filters, aggregates, standalone builder | `references/QUERIES.md` | `src/QueryBuilder.js`, `tests/QueryBuilderStandalone.test.js` |
| eager loading, through relations, polymorphism, pivots | `references/RELATIONS.md` | `src/Relations/*`, `tests/Polymorphic.test.js` |
| schema, migrations, drift, deploy, `restore:auto` | `references/MIGRATIONS.md` | `src/Migrations/MigrationManager.js`, `bin/migrate.js` |
| seeding, `make:seed`, `--class`, `AISeeder` | `references/SEEDS.md` | `src/Seeders/*`, `src/AI/AISeeder.js` |
| backups, restore, encryption, scheduler, socket control | `references/BACKUPS.md` | `src/Backup/*`, `tests/Backup*.test.js` |
| HTTP models, adapters, GraphQL, import/diff | `references/API.md` | `src/Api/*`, `tests/Api*.test.js` |
| LLM providers, AI queries, MCP, guardrails | `references/AI.md` | `src/AI/*`, `tests/AI.test.js` |
| DB objects, transactions, savepoints, `RawExpression` | `references/ADVANCED.md` | `src/Objects/*`, `src/RawExpression.js` |
| commands, flags, shell workflows | `references/CLI.md` | `bin/*`, `package.json` |
| `.d.ts` declarations, generic models, TS usage | `references/TYPESCRIPT.md` | `types/index.d.ts`, `examples/typescript-*.ts` |

## Package summary

`outlet-orm` is a Node.js 18+ CommonJS package that exposes 8 major feature groups:

| Domain | Main entry points | Notes |
|---|---|---|
| SQL ORM | `Model`, `QueryBuilder`, `DatabaseConnection` | core Active Record layer |
| Relations | `hasOne`, `hasMany`, `belongsTo`, `belongsToMany`, `hasManyThrough`, `hasOneThrough`, `morph*` | eager loading included |
| Schema / migrations | `Schema`, `Blueprint`, `Migration`, `MigrationManager`, `SeederManager` | database evolution and deployment |
| DB objects | `View`, `Trigger`, `Procedure`, `Function`, `Transaction`, `useSchema` | views, triggers, procedures, savepoints |
| Backups | `BackupManager`, `BackupScheduler`, `BackupEncryption`, socket server/client | dumps, encryption, automation |
| API Layer | `Api`, `ApiAdapter`, `ApiGraphQL`, `MockAdapter`, cache, offline, realtime | HTTP-oriented model layer |
| AI | `AIManager`, `Ai`, providers, `TextBuilder`, `AIQueryBuilder`, `AISeeder` | LLM workflows for the ORM |
| CLI / MCP | `outlet`, `outlet-migrate`, `outlet-reverse`, `outlet-mcp`, `outlet api import` | user and agent tooling |

## Recommended workflow

### 1. SQL ORM

Standard pattern:

```js
const { DatabaseConnection, Model } = require('outlet-orm');

const db = new DatabaseConnection({
  driver: 'mysql',
  host: 'localhost',
  database: 'app',
  user: 'root',
  password: ''
});

class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email'];
  static hidden = ['password'];
  static casts = { id: 'int' };
  static connection = db;
}
```

Best practices:

- define `static connection` or call `Model.setConnection(...)`
- use `fillable` to protect inserts and updates
- use `casts` for read/write type conversion
- use `hidden` for sensitive fields
- use `softDeletes` only if `deleted_at` exists in the schema

### 2. Queries

Prefer these methods:

- `where`, `whereIn`, `whereNull`, `whereBetween`, `whereLike`
- `with`, `withCount`, `whereHas`
- `pluck`, `value`, `paginate`, `chunk`, `cursor`
- `withTrashed`, `onlyTrashed`, `withHidden`
- `when` and `tap` for readable branching while building queries

If no model is needed, use standalone mode:

```js
await db.from('users').where('status', 'pending').update({ status: 'active' });
```

### 3. Migrations and schema

Standard pattern:

```js
const { Migration } = require('outlet-orm');

class CreateUsersTable extends Migration {
  async up() {
    await this.getSchema().create('users', (table) => {
      table.id();
      table.string('name');
      table.string('email').unique();
      table.timestamps();
    });
  }

  async down() {
    await this.getSchema().dropIfExists('users');
  }
}
```

When modifying existing migrations or writing new ones:

- prefer `schema.create`, `schema.table`, and `dropIfExists`
- use `timestamps()` instead of rebuilding `created_at` / `updated_at`
- use `Schema.hasIndex()` for idempotent index-related migrations
- use `Migration.query(table)` / `Migration.table(table)` for data changes without hand-built query objects
- use `withinTransaction = true` when the migration must be atomic

### 4. Migration commands

Important commands:

- `outlet migrate install`
- `outlet migrate migrate`
- `outlet migrate rollback --steps=1`
- `outlet migrate status --pending`
- `outlet migrate deploy`
- `outlet migrate resolve --applied=<name>`
- `outlet migrate restore:auto`

Important flags:

- `--pretend`
- `--step`
- `--steps=N`
- `--batch=N`
- `--seed`
- `--seeder=Name`
- `--allow-drift`
- `--allow-failed`
- `--skip-auto-backup`
- `--yes`

Guardrails to respect:

- `fresh`, `reset`, `refresh`, `rollback`, and `restore:auto` are sensitive operations
- in production, `OUTLET_PRODUCTION_CONFIRM=1` and database-name confirmation are required
- auto-backup is built in before destructive commands

### 5. API Layer

When the request is about HTTP resources rather than SQL tables:

- use `Api` for REST models
- use `ApiGraphQL` for GraphQL operations
- use `ApiAdapter` / `createAdapter()` for the transport layer
- use `MockAdapter` in tests
- use `ApiCache`, `MutationQueue`, `Watcher`, and `EventStream` as needed

Important capabilities:

- auth bearer/basic/apiKey/cookie/oauth2
- query builder HTTP (`where`, `orderBy`, `limit`, `offset`, `with`, `select`)
- validation and strict responses
- retry, circuit breaker, interceptors
- pagination page/cursor/offset
- offline queue and browser/node stores

### 6. AI et MCP

Use the AI layer when the request mentions:

- text generation or tool calling with multiple providers
- NL-to-SQL conversion
- realistic seed data generation
- SQL query optimization
- generating schema, model, or migration code from a description
- exposing ORM tools to an agent through MCP

Key exports:

- `AIManager` et alias `Ai`
- `TextBuilder`
- `AIQueryBuilder`
- `AISeeder`
- `AIQueryOptimizer`
- `AIPromptEnhancer`
- `PromptGenerator`
- `MCPServer`
- `AISafetyGuardrails`

Supported providers:

- OpenAI
- Ollama
- Ollama Turbo
- Claude
- Gemini
- Grok
- Mistral
- Onn
- Custom OpenAI-compatible provider

MCP tools exposed by default:

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

## Code landmarks

Files to read first depending on the task:

- the public `index.js` barrel in `src`
- `Model.js` for model semantics
- `QueryBuilder.js` for query helpers
- `DatabaseConnection.js` for transactions, savepoints, and pooling
- `Schema.js` in the schema builder folder
- `MigrationManager.js` in the migrations folder
- `index.js` in the API folder
- `MCPServer.js` in the AI folder
- `migrate.js` in `bin` for the current CLI truth

Test landmarks:

- `tests/Model.test.js`
- `tests/NewFeatures.test.js`
- `tests/NewEvolutions.test.js`
- `tests/NewParityFeatures.test.js`
- `tests/Schema.test.js`
- `tests/Reverse.test.js`
- `tests/Api*.test.js`
- `tests/AI.test.js`
- `tests/AiBridge.test.js`

## Resources loaded on demand

Then consult only the specialized document that matches the module you are working on:

The `references/` folder contains all specialized resources for this skill:

- `references/MODELS.md` — `Model`, `DatabaseConnection`, attributes, casts, validation, scopes, soft deletes
- `references/QUERIES.md` — `QueryBuilder`, fluent queries, aggregates, standalone mode, SQL debugging
- `references/RELATIONS.md` — all relationships, eager loading, `withCount`, through relations, polymorphism
- `references/MIGRATIONS.md` — `Schema`, `Blueprint`, `Migration`, `MigrationManager`, drift, deploy, `restore:auto`
- `references/SEEDS.md` — `Seeder`, `SeederManager`, targeted seeders, related AI generation use cases
- `references/BACKUPS.md` — `BackupManager`, encryption, scheduler, socket server/client, restore
- `references/API.md` — `Api`, `ApiAdapter`, GraphQL, cache, validation, offline, realtime, import/diff
- `references/AI.md` — `AIManager`, providers, `TextBuilder`, `AIQueryBuilder`, `AISeeder`, MCP, guardrails
- `references/ADVANCED.md` — DB objects, transactions, savepoints, isolation levels, advanced helpers
- `references/CLI.md` — `outlet`, `outlet-migrate`, `outlet-init`, `outlet-convert`, `outlet-reverse`, `outlet-mcp`
- `references/TYPESCRIPT.md` — public typing, generic models, TS tips, and areas to verify on the JS side

## Do / Don't

Do:

- stay aligned with the real names and signatures exported by `src/index.js`
- prefer examples and tests when behavior is ambiguous
- consider standalone `QueryBuilder` usage for data migrations
- document or use guardrails for any destructive action
- verify the TypeScript layer when the request involves a TS project

Don't:

- do not invent Laravel-like APIs that are not present in this repository
- do not assume every driver supports every advanced SQL object
- do not ignore production protections around destructive migrations
- do not forget that `mysql2`, `pg`, `sqlite3`, and `graphql-ws` are optional depending on the surface in use

## Expected agent response for this package

When helping on an outlet-orm project, the ideal response should:

- first identify the relevant surface: SQL ORM, migrations, API Layer, AI, backup, CLI
- propose or modify code at the package's native abstraction level
- cite the exact classes and commands from the repository
- take test-verified behavior into account
- point out migration and backup guardrails when there is a risk of data loss

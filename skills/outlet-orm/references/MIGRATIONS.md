# Migrations Reference

## Contents

- When to read this document
- Scope
- Schema builder
- timestamps() overloads
- Writing a migration
- Recommended workflow
- Validation loop
- Scaffolding CLI
- MigrationManager
- Safety, drift, and production
- Recommendations
- Source files to read

## When to read this document

Read this resource if the request is about `Schema`, `Blueprint`, `Migration`, `MigrationManager`, `outlet migrate ...` commands, drift handling, migration auto-backups, or related restores.

Do not use it as the main entry point for:

- seeders and data generation: see `SEEDS.md`
- backups outside the migration workflow: see `BACKUPS.md`
- shell flags and commands without JS API detail: see `CLI.md`

## Scope

This document covers:

- `Schema`
- `Blueprint`
- `Migration`
- `MigrationManager`
- related migration commands

## Schema builder

Main entry points:

- `schema.create(table, callback)`
- `schema.table(table, callback)`
- `schema.rename(from, to)`
- `schema.drop(name)`
- `schema.dropIfExists(name)`
- `schema.hasTable(name)`
- `schema.hasColumn(table, column)`
- `schema.hasIndex(table, indexName)`
- `schema.indexExists(table, indexName)`

Useful helpers:

- `table.id()`
- `table.string()`
- `table.integer()`
- `table.boolean()`
- `table.date()` / `dateTime()` / `timestamp()`
- `table.json()`
- `table.uuid()`
- `table.binary()`
- `table.timestamps()`
- `table.softDeletes()`
- `table.index()`
- `table.unique()`
- `table.fullText()`
- `table.check(expression)`
- `table.dropConstraint(name)` / `dropCheck(name)`

## timestamps() overloads

The `timestamps()` method supports several forms:

- `timestamps()`
- `timestamps(true)`
- `timestamps(useCurrent, useCurrentOnUpdate)`
- `timestamps({ useCurrent, useCurrentOnUpdate, nullable })`

Use cases:

- default Laravel-like behavior
- legacy nullable requirements
- explicit control over `CURRENT_TIMESTAMP`

## Writing a migration

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

Base `Migration` API:

- `getSchema()`
- `query(table)`
- `table(table)`
- `log(...)`
- `info(...)`
- `warn(...)`
- `shouldRun()`
- `withinTransaction`
- `transformData(table, callback, opts?)`
- `backupData(table, columns?)`
- `restoreData(table, rows)`

## Recommended workflow

For a new or sensitive migration, follow this order:

1. write `up()` and `down()` at the `Schema` / `Migration` level
2. verify whether the migration is destructive or data-sensitive
3. run a `--pretend` pass to inspect the generated SQL
4. execute the migration in a test environment
5. verify `status` and the final schema
6. if needed, test `rollback --steps=1` or a restore from auto-backup

Concise checklist:

```text
Migration progress:
- [ ] Write or update the migration
- [ ] Verify `down()` / idempotence
- [ ] `outlet migrate migrate --pretend`
- [ ] Real execution in a safe environment
- [ ] `outlet migrate status`
- [ ] Verify the schema or the data
```

## Validation loop

For critical operations, do not jump straight to `fresh`, `reset`, `refresh`, `rollback`, or `restore:auto`.

Recommended loop:

1. prepare the narrowest possible command
2. validate with `--pretend` when available
3. execute
4. re-read `outlet migrate status`
5. verify the schema, data, or generated backups
6. fix the issue and rerun the same verification before widening the change

## Scaffolding CLI

Supported scaffolds:

- `outlet migrate make <name>`
- `outlet migrate make <name> --create=<table>`
- `outlet migrate make <name> --table=<table>`
- `outlet migrate make:transform <name>`

The `make:transform` command uses the `database/templates/transform-migration.js` template.

## MigrationManager

Available operations:

- `install()`
- `run(opts?)`
- `rollback(stepsOrOpts, optsArg?)`
- `reset(opts?)`
- `refresh(opts?)`
- `fresh(opts?)`
- `status(opts?)`
- `deploy(opts?)`
- `markMigrationApplied(name)`
- `markMigrationRolledBack(name)`
- `getMissingMigrations()`
- `restoreAuto(opts?)`
- `listAutoBackups()`

Exposed events:

- `migrations:none`
- `migrations:pretend`
- `migrations:started`
- `migrations:ended`
- `migration:started`
- `migration:ended`
- `migration:skipped`

## Safety, drift, and production

Important behaviors:

- migration checksums stored in the database
- drift detection between files and the database
- support for `pending`, `running`, `completed`, `failed`, `skipped`, `rolled_back`, and `missing` statuses
- prompt or error on interrupted or failed migrations
- auto-backup before destructive actions
- advisory locks for `deploy` / `resolve` on MySQL and PostgreSQL
- production gate through `OUTLET_PRODUCTION_CONFIRM=1`

Major CLI flags:

- `--pretend`
- `--step`
- `--steps=N` / `-s N`
- `--batch=N`
- `--seed`
- `--seeder=Name` / `--class=Name`
- `--allow-drift`
- `--allow-failed`
- `--skip-auto-backup`
- `--pending`
- `--backup=<file>`
- `--yes`

## Recommendations

- prefer `dropIfExists()` in `down()` to keep rollbacks idempotent
- use `Schema.hasIndex()` before creating or dropping indexes dynamically
- wrap complex data migrations with `withinTransaction = true` when the driver allows it
- reserve `--allow-drift` for explicit diagnostic contexts
- use `deploy` for CI/CD and `migrate` for standard local workflows

## Source files to read

- `src/Schema/Schema.js`
- `src/Migrations/Migration.js`
- `src/Migrations/MigrationManager.js`
- `bin/migrate.js`
- `tests/Schema.test.js`
- `tests/MigrationDataPreservation.test.js`
- `tests/MigrationDeployOptions.test.js`
- `tests/MigrationExtraOptions.test.js`
- `tests/NewBypassHelpers.test.js`

# CLI Reference

## Contents

- When to read this document
- Scope
- `outlet`
- `outlet-init`
- `outlet-convert`
- `outlet-migrate`
- `outlet-reverse`
- `outlet-mcp`
- `outlet-api-import`
- `outlet-api-diff`
- Recommendations
- Source files to read

## When to read this document

Read this resource if the request is about the `outlet*` executables, subcommands, flags, shell workflow sequencing, or the CLI equivalent of a JS-side operation.

Do not use it as the main entry point for:

- internal details of `MigrationManager` or `Schema`: see `MIGRATIONS.md`
- SQL ORM semantics in application code: see `MODELS.md` or `QUERIES.md`
- TypeScript declarations: see `TYPESCRIPT.md`

## Scope

This document covers the unified CLI and its satellite commands.

Executables declared by `package.json`:

- `outlet`
- `outlet-init`
- `outlet-convert`
- `outlet-migrate`
- `outlet-reverse`
- `outlet-mcp`
- `outlet-api-import`
- `outlet-api-diff`

## `outlet`

Unified entry point:

```bash
outlet <command> [args]
```

Routed subcommands:

- `init`
- `convert`
- `migrate`
- `reverse`
- `mcp`
- `api import`
- `api diff`

## `outlet-init`

Modes:

- classic interactive mode
- prompt-based mode via `--prompt`

Relevant flags:

- `--prompt`, `-P`
- `--driver`, `-d`

Role:

- scaffold a project structure
- generate `.env`, DB config, folders, models, migrations, and an initial seeder

## `outlet-convert`

Role:

- read SQL `CREATE TABLE`
- produce outlet-orm models
- infer casts, hidden fields, and relationships

Use case:

- onboarding from an existing SQL schema

## `outlet-migrate`

Commands:

- `install`
- `migrate` / `up`
- `rollback`
- `reset`
- `refresh`
- `fresh`
- `status`
- `deploy`
- `resolve`
- `seed` / `db:seed`
- `make`
- `make:seed`
- `make:transform`
- `restore:auto`
- `backups:list`

Major flags:

- `--pretend`
- `--step`
- `--steps=N`
- `--batch=N`
- `--seed`
- `--seeder=Name` / `--class=Name`
- `--pending`
- `--create=<table>`
- `--table=<table>`
- `--skip-auto-backup`
- `--allow-drift`
- `--allow-failed`
- `--backup=<file>`
- `--json`
- `--yes` / `-y`

Environment variables:

- `OUTLET_PRODUCTION_CONFIRM=1`
- `OUTLET_ALLOW_DRIFT=1`

## `outlet-reverse`

Role:

- introspect a database or SQL dump
- generate migrations and seeders from the existing structure

## `outlet-mcp`

Role:

- start the MCP server on stdio

Flags:

- `--project`, `-p <path>`
- `--no-safety`
- `--help`, `-h`

## `outlet-api-import`

Role:

- generate API models from specs and docs

Notable flags:

- `--spec`
- `--doc`
- `--output`
- `--lang`
- `--auth`
- `--strategy`
- `--format`
- `--max-depth`
- `--include-official-subdomains`
- `--run-delta`

## `outlet-api-diff`

Role:

- compare an OpenAPI spec with a models folder

Flags:

- `--spec`
- `--models`

## Recommendations

- use `outlet` as the single entry point in user scripts
- use `outlet-migrate deploy` for CI/CD, not `fresh`
- use `outlet-mcp` only when an agent needs to control the package through MCP

## Source files to read

- `bin/outlet.js`
- `bin/init.js`
- `bin/convert.js`
- `bin/migrate.js`
- `bin/reverse.js`
- `bin/mcp.js`
- `bin/api/import.js`
- `bin/api/diff.js`

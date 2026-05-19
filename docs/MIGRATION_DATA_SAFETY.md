# Migration Data Safety

This document explains the data-preservation guarantees provided by Outlet ORM's
migration system (feature 003, v14.6.0+).

## Overview

Destructive migration commands (`fresh`, `reset`, `refresh`, `rollback`) can
delete or rewrite entire tables. To make these operations safe and recoverable,
Outlet ORM provides four cooperating layers:

1. **Automatic backups** before every destructive command.
2. **Idempotent re-runs** via `status` + `checksum` columns.
3. **Drift detection** to flag migration files modified after running.
4. **Production gate** requiring explicit operator confirmation.

## 1. Automatic Backups

Before any destructive operation, the manager invokes the existing
`BackupManager` to dump the database to:

```text
database/backups/auto_before_<command>_<YYYYMMDD_HHMMSS>[_<N>].sql
```

A `.meta.json` sidecar is written alongside each backup with the command,
timestamp, environment, and source database name.

- **Retention**: the 10 most-recent auto-backups per command are kept; older
  files are pruned.
- **Encryption**: honored when `BackupManager` is configured with an
  encryption key.
- **Opt-out**: pass `--skip-auto-backup` in development. **This flag is ignored
  in production** (FR2 — production hard rule).

### Listing & restoring

```bash
outlet-migrate backups:list                          # human-readable
outlet-migrate backups:list --json                   # JSON
outlet-migrate restore:auto                          # restore latest
outlet-migrate restore:auto --backup=<filename>      # restore specific file
```

Every restore is appended to `database/backups/.restore-history.log` as a
single JSON line containing `{timestamp, backup, command, user}`.

## 2. Idempotent Re-runs (Status + Checksum)

The `migrations` table includes seven columns:

| Column              | Purpose                                          |
|---------------------|--------------------------------------------------|
| `id`                | Surrogate primary key.                           |
| `migration`         | File basename (unique).                          |
| `batch`             | Batch number for `rollback`.                     |
| `created_at`        | First-seen timestamp.                            |
| `checksum`          | SHA-256 of the migration file at last success.   |
| `execution_time_ms` | Wall-clock duration of the last `up()` run.      |
| `status`            | `pending`, `running`, `completed`, `failed`.     |

Legacy 4-column tables are auto-upgraded on `initialize()`. A row is inserted
with `status='running'` immediately before `up()` and updated to `completed` or
`failed` afterwards.

### Recovering interrupted runs

If a previous `outlet-migrate run` was killed mid-flight, the next invocation
detects rows stuck in `running` or `failed` and prompts (TTY) or aborts
(non-TTY) with `code='EOUTLET_INTERRUPTED'`:

```text
⚠ Interrupted migration(s) detected: 2025_01_01_000001_create_users.js (running)
Action? [r]e-run / [m]ark-resolved / [a]bort:
```

- **re-run**: deletes the stuck row so the migration runs again from scratch.
- **mark-resolved**: updates status to `completed` (use only after verifying
  the schema is in the expected state).
- **abort**: throws `EOUTLET_INTERRUPTED` and exits.

## 3. Drift Detection

The recorded `checksum` is compared against the on-disk file before every
`run`. Behavior depends on the detected environment:

| Environment | Policy                                              |
|-------------|-----------------------------------------------------|
| `development` | Warn on stderr and continue.                      |
| `test`        | Silent (CI noise reduction).                      |
| `production`  | Throw `EOUTLET_DRIFT` unless `--allow-drift`.     |

Environment is derived from `OUTLET_ENV` → `NODE_ENV` → `CI=true` (→ `test`),
falling back to `development`. See [`src/Environment.js`](../src/Environment.js).

## 4. Production Gate

Destructive commands in `production` require **both**:

1. The environment variable `OUTLET_PRODUCTION_CONFIRM=1`, **and**
2. (Interactive only) typing the exact configured database name when prompted.

Without these, the command throws `EOUTLET_PRODUCTION` and exits with code `2`.

```bash
OUTLET_PRODUCTION_CONFIRM=1 outlet-migrate fresh --yes
```

The CLI also prints a connection summary banner (driver, host, database)
before the prompt so operators can verify the target.

## 5. Data-Transform Helpers

The `Migration` base class provides three helpers for safe, recoverable data
transformations inside an `up()` body:

```js
class BackfillUserStatus extends Migration {
  async up() {
    await this.transformData('users', (row) => ({
      ...row,
      status: row.last_login_at ? 'active' : 'dormant',
    }));
  }
}
```

| Method                                         | Behavior                                                                                  |
|------------------------------------------------|-------------------------------------------------------------------------------------------|
| `backupData(table, columns?)`                  | Returns an in-memory snapshot of rows.                                                    |
| `restoreData(table, rows)`                     | Truncates `table` and re-inserts `rows` in order.                                         |
| `transformData(table, callback, {primaryKey})` | Snapshot → per-row callback → UPDATE by PK. On any error, the snapshot is restored.       |

Scaffold a transform migration with:

```bash
outlet-migrate make:transform backfill_user_status
```

Names must match `^[a-z][a-z0-9_]*$`.

## 6. Exit Codes

| Code | Meaning                                                                 |
|------|-------------------------------------------------------------------------|
| 0    | Success.                                                                |
| 1    | Generic migration/backup error.                                         |
| 2    | Confirmation rejected or invalid CLI flags (`EOUTLET_PRODUCTION`, `EOUTLET_CONFIRM`). |
| 3    | Backup not found or drift detected (`EOUTLET_NO_BACKUP`, `EOUTLET_DRIFT`).            |

## See also

- [MIGRATIONS.md](MIGRATIONS.md) — full migration command reference.
- [BACKUP.md](BACKUP.md) — `BackupManager` internals.
- [`specs/003-migration-data-preservation/`](../specs/003-migration-data-preservation/) — design history.

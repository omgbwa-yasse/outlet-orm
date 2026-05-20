# Backups Reference

## Contents

- When to read this document
- Scope
- BackupManager
- Partial backups
- Journal backups
- BackupEncryption
- BackupScheduler
- Socket server / client
- Migration-related auto-backups
- Recommendations
- Source files to read

## When to read this document

Read this resource if the request is about `BackupManager`, `BackupScheduler`, `BackupEncryption`, `BackupSocketServer`, `BackupSocketClient`, `restore()`, or dump protection.

Do not use it as the main entry point for:

- migration commands and their status logic: see `MIGRATIONS.md`
- SQL transactions and DB objects: see `ADVANCED.md`
- global shell commands without backup detail: see `CLI.md`

## Scope

This document covers:

- `BackupManager`
- `BackupScheduler`
- `BackupEncryption`
- `BackupSocketServer`
- `BackupSocketClient`
- restoring migration auto-backups

## BackupManager

Main capabilities:

- `full()`
- `partial()`
- `journal()`
- `restore()`

Supported formats:

- `sql`
- `json`

Modes:

- full database dump
- dump of a subset of tables
- DML journal based on the query log

## Partial backups

`partial()` requires a non-empty array of tables.

Use cases:

- backing up only business tables before a local migration
- exporting a targeted functional domain

## Journal backups

`journal()` relies on the `DatabaseConnection` query log.

Precondition:

- enable `DatabaseConnection.enableQueryLog()` before the operations to trace

Use cases:

- capture recent DML statements
- produce a short replay file for debugging or limited rollback

## BackupEncryption

Capabilities:

- `encrypt()`
- `decrypt()`
- `isEncrypted()`
- `generateSalt()`

Verified behaviors:

- dedicated magic-prefix format
- configurable salt within strict bounds
- error on empty password or wrong password
- support for `.sql.enc` and `.json.enc` files

## BackupScheduler

Capabilities:

- `schedule()`
- `stop(name)`
- `stopAll()`
- liste des jobs actifs

Use cases:

- periodic backups for a dev database
- immediate backup through `runNow`
- local orchestration before destructive tasks

## Socket server / client

The package provides a small socket protocol for controlling backups from a local remote process.

Components:

- `BackupSocketServer`
- `BackupSocketClient`

Tested capabilities:

- `ping()`
- `status()`
- `jobs()`
- `run(type, options?)`
- `schedule(...)`
- `stop(name)`
- `stopAll()`
- `restore(...)`

Use cases:

- local supervision tools
- backup control interface outside the main process

## Migration-related auto-backups

Destructive migration commands can automatically generate:

- `database/backups/auto_before_<command>_<timestamp>.sql` files
- `.meta.json` sidecars
- a restore history

Related commands:

- `outlet migrate restore:auto`
- `outlet migrate backups:list`

## Recommendations

- use encryption if dumps leave the local machine
- do not disable auto-backup in production: the flag is ignored for that reason
- prefer `partial()` for surgical restores
- test `restore()` in a safe environment before a critical flow

## Source files to read

- `src/Backup/BackupManager.js`
- `src/Backup/BackupScheduler.js`
- `src/Backup/BackupEncryption.js`
- `src/Backup/BackupSocketServer.js`
- `src/Backup/BackupSocketClient.js`
- `tests/Backup.test.js`
- `tests/BackupEncryption.test.js`
- `tests/BackupSocket.test.js`

# outlet-orm Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-05-19

## Active Technologies
- Node.js 18+, CommonJS (`require` / `module.exports`) + mysql2, better-sqlite3, pg — all lazy-loaded, already present in the codebase. No new runtime dependencies required. (002-native-select-support)
- MySQL and SQLite (primary); PostgreSQL support exists but is out of scope for this iteration. (002-native-select-support)
- Node.js 18+ (CommonJS — `require` / `module.exports`) + `mysql2`, `better-sqlite3`, `pg` (all lazy-loaded, already present); (main)
- MySQL, PostgreSQL, SQLite (via existing `DatabaseConnection` abstraction) (main)

- Node.js 18+ — CommonJS (`require`/`module.exports`) + None — change is a one-line alias (001-ai-alias)

## Project Structure

```text
src/
tests/
```

## Commands

# Add commands for Node.js 18+ — CommonJS (`require`/`module.exports`)

## Code Style

Node.js 18+ — CommonJS (`require`/`module.exports`): Follow standard conventions

## Recent Changes
- main: Added Node.js 18+ (CommonJS — `require` / `module.exports`) + `mysql2`, `better-sqlite3`, `pg` (all lazy-loaded, already present);
- 002-native-select-support: Added Node.js 18+, CommonJS (`require` / `module.exports`) + mysql2, better-sqlite3, pg — all lazy-loaded, already present in the codebase. No new runtime dependencies required.

- 001-ai-alias: Added Node.js 18+ — CommonJS (`require`/`module.exports`) + None — change is a one-line alias

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

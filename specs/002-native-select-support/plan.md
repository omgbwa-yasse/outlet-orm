# Implementation Plan: Native SELECT Support (QueryBuilder Standalone Mode)

**Branch**: `002-native-select-support` | **Date**: 2026-05-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-native-select-support/spec.md`

## Summary

Extend the existing `QueryBuilder` class in outlet-orm to support a standalone (model-free) mode, accessible via `db.from('tableName')` on a `DatabaseConnection` instance. **No new `StandaloneQueryBuilder` class is introduced.** The same `QueryBuilder` that powers model queries also handles standalone queries: when constructed with `model = null` plus `{ connection, source }` options, it skips model-specific operations (global scopes, soft-delete constraints, hydration) and returns plain row arrays. A custom `QueryBuilderError` differentiates builder-level errors (e.g., reuse of a consumed standalone instance) from driver errors. Schema introspection methods (`tableExists`, `columnExists`, `listTables`) are added/aliased on the `Schema` class and refactored to use `db.from()` internally. `QueryBuilderError` is exported from the package root. The existing `QueryBuilder` type in `types/index.d.ts` is augmented with `havingRaw()`, aggregates, and the `DatabaseConnection.from()` method signature.

## Technical Context

**Language/Version**: Node.js 18+, CommonJS (`require` / `module.exports`)  
**Primary Dependencies**: mysql2, better-sqlite3, pg — all lazy-loaded, already present in the codebase. No new runtime dependencies required.  
**Storage**: MySQL and SQLite (primary); PostgreSQL support exists but is out of scope for this iteration.  
**Testing**: Jest (existing test suite; `npm test` runs all tests)  
**Target Platform**: Node.js library (npm package)  
**Project Type**: Library  
**Performance Goals**: Execution overhead equal to or below the existing `QueryBuilder.get()` path — both delegate to `DatabaseConnection.select()` which calls `buildSelectQuery()` then the driver.  
**Constraints**: Zero regressions (SC-004). No breaking changes to any existing public export. No new required `npm` dependencies. SQL injection prevention via parameterised WHERE clauses and `sanitizeIdentifier` allowlist (FR-010). Single-use builder instances — reuse throws `QueryBuilderError` (FR-012).  
**Scale/Scope**: 1 new source file (`QueryBuilderError.js`); 4 modified source files (`QueryBuilder.js`, `DatabaseConnection.js`, `Schema/Schema.js`, `index.js`); 1 modified TypeScript declarations file; 1 new test file.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

> The `.specify/memory/constitution.md` file is an unfilled template — no project-specific principles have been ratified. Formal constitution gates are therefore N/A. The following standard engineering gates are applied instead and must all pass:

| Gate | Status | Notes |
|------|--------|-------|
| **Backward compatibility** — no existing public export is removed or changed in a breaking way | ✅ PASS | Only additions: `db.from()`, `QueryBuilderError`, `schema.tableExists()`, `schema.columnExists()`, `schema.listTables()`, `havingRaw()` on `QueryBuilder`, aggregate shorthands on `QueryBuilder`. Existing APIs untouched. No new `StandaloneQueryBuilder` class exported. |
| **No regression** — existing test suite must continue to pass in full | ✅ PASS (expected) | The new class shares `buildSelectQuery` / `buildWhereClause` already tested via `QueryBuilder` paths. |
| **SQL injection prevention** — all user-controlled values parameterised; identifiers validated | ✅ PASS | `sanitizeIdentifier` already enforced by `buildSelectQuery`; WHERE values are always `?` placeholders via `buildWhereClause`. |
| **Error transparency** — driver errors propagate unwrapped; builder errors use `QueryBuilderError` | ✅ PASS | Design decision in research.md §4. |
| **Logging integration** — new query path emits same `logQuery` events | ✅ PASS | `DatabaseConnection.select()` already calls `logQuery()` after execution; standalone `QueryBuilder.get()` delegates to `select()`. |

## Project Structure

### Documentation (this feature)

```text
specs/002-native-select-support/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (not created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── QueryBuilder.js         # MODIFIED — add standalone mode constructor path, `havingRaw()`, aggregate shorthands, `_consumed` guard
├── DatabaseConnection.js   # MODIFIED — add db.from(source) factory method
├── index.js                # MODIFIED — export QueryBuilderError
├── Errors/
│   ├── UnsupportedCapabilityError.js   # existing
│   └── QueryBuilderError.js            # NEW — builder-level error class
└── Schema/
    └── Schema.js               # MODIFIED — add tableExists(), columnExists(), listTables()
                            #            refactor hasTable/hasColumn to use db.from()

types/
└── index.d.ts              # MODIFIED — augment QueryBuilder with havingRaw/aggregates; add DatabaseConnection.from(); add QueryBuilderError declaration

tests/
└── QueryBuilderStandalone.test.js  # NEW — unit + integration tests
```

**Structure Decision**: Single-project layout. No new `StandaloneQueryBuilder` class is created. Standalone mode is implemented as a constructor code-path within the existing `QueryBuilder`. `QueryBuilderError` goes in `src/Errors/` alongside `UnsupportedCapabilityError`.

## Constitution Check — Post-Design Re-evaluation

*Re-evaluated after Phase 1 design artifacts (data-model.md, contracts, quickstart) are complete.*

| Gate | Status | Design outcome |
|------|--------|----------------|
| **Backward compatibility** | ✅ PASS | Zero existing exports changed. `hasTable`/`hasColumn` retained; new aliases added. `buildSelectQuery` extended with an additive `type:'raw'` branch in HAVING only. `QueryBuilder` constructor signature is backward-compatible (new `options` param defaults to `{}`). |
| **No regression** | ✅ PASS | All existing model query paths unchanged. The standalone mode in `QueryBuilder` reaches `buildSelectQuery` through the same `connection.select()` entry already used by model-bound `QueryBuilder`. |
| **SQL injection prevention** | ✅ PASS | All WHERE values are parameterised via existing `buildWhereClause`. Column arguments to `sum/avg/min/max` are validated via `sanitizeIdentifier` before embedding in the raw aggregate expression. |
| **Error transparency** | ✅ PASS | `QueryBuilderError` covers builder-level errors only. Driver errors from `connection.select()` propagate unwrapped. Clean `instanceof` discrimination documented in contracts. |
| **Logging integration** | ✅ PASS | `connection.select()` calls `logQuery()` unconditionally. No changes needed to the logging path. |
| **Single-use safety** | ✅ PASS | `_consumed` flag + `_assertNotConsumed()` guard on all 7 terminal methods. |

No violations. Proceeding to implementation phase (`/speckit.tasks`).

## Complexity Tracking

> No constitution violations detected. No entries required.

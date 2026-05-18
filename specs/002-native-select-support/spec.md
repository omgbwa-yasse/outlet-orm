# Feature Specification: Native SELECT Query Support

**Feature Branch**: `002-native-select-support`  
**Created**: 2026-05-18  
**Status**: Draft  
**Input**: User description: "je veux que les requêtes SELECT et toutes leurs variantes soient prises en charge par outlet pour ne plus avoir ce type de code : const rows = await this.connection.executeRawQuery(`SELECT COUNT(1) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'activity_logs'`)"

## Clarifications

### Session 2026-05-18

- Q: How does a developer obtain a standalone query builder instance? → A: `db.from('table_name')` — accessed from the DatabaseConnection / db instance; returns the existing `QueryBuilder` class operating in standalone (model-free) mode
- Q: What is the lifecycle of a builder instance after execution? → A: Single-use — a new `db.from(...)` call is required for each query
- Q: Does the standalone query builder participate in outlet-orm's existing query logging system? → A: Yes — standalone queries emit identical query log events to model-bound queries
- Q: Is the standalone mode part of the public package API? → A: Yes — `QueryBuilderError` is exported from `index.js` and declared in `types/index.d.ts`; `QueryBuilder` is already exported
- Q: What error type surfaces for builder-level vs. driver errors? → A: Custom class for builder-level errors (e.g., consumed-instance reuse); DB driver errors pass through unwrapped
- Q: Is a new class created? → A: No — `QueryBuilder` is extended to support standalone (model-free) mode. No `StandaloneQueryBuilder` class is introduced.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Query Any Table Without Raw SQL (Priority: P1)

As a developer using outlet-orm, I want to query any database table — including system tables like `information_schema` — using a fluent query builder, so that I never need to write raw SQL strings to perform SELECT operations.

**Why this priority**: This is the core ask of the feature. Eliminating raw SQL calls makes code safer, more maintainable, and consistent with the ORM's existing style. It unblocks all other stories.

**Independent Test**: Can be fully tested by replacing a raw `executeRawQuery(...)` call with a fluent builder call that targets `information_schema.tables`, verifying the returned data matches the expected result and no raw SQL string is needed.

**Acceptance Scenarios**:

1. **Given** a developer wants to count rows in `information_schema.tables`, **When** they use `db.from('information_schema.tables').select('COUNT(1) AS cnt').where(...)`, **Then** the builder produces a valid query and returns the same result as the equivalent raw SQL.
2. **Given** a developer builds a query against a non-model table (e.g., a view or system table), **When** they execute it through outlet, **Then** the result is returned as plain row objects without requiring a mapped model class.
3. **Given** a developer calls database functions (e.g., `DATABASE()`, `NOW()`) inside conditions or SELECT columns, **When** the query is built, **Then** those expressions are passed through verbatim without escaping.

---

### User Story 2 - Aggregate Functions in SELECT (Priority: P2)

As a developer, I want to use aggregate functions (COUNT, SUM, AVG, MIN, MAX) directly through the outlet query builder, so that reporting and analytics queries do not require raw SQL.

**Why this priority**: Aggregate queries are the most common reason developers currently fall back to `executeRawQuery`. Supporting them unlocks the majority of real-world use cases.

**Independent Test**: Can be fully tested by building a query that selects `COUNT(*)`, `SUM(column)`, etc. against any table and verifying the numeric result is returned correctly.

**Acceptance Scenarios**:

1. **Given** a table with rows, **When** the developer calls `.count()` or `.select('COUNT(*) AS total')` through the builder, **Then** the result contains the correct integer count.
2. **Given** a numeric column, **When** the developer uses `.sum('amount')`, `.avg('score')`, `.min('created_at')`, or `.max('price')`, **Then** the builder issues the correct SQL and returns the scalar value.
3. **Given** a GROUP BY query with aggregate functions, **When** the developer chains `.groupBy('status').havingRaw('COUNT(*) > ?', [5])`, **Then** the result set reflects the grouped and filtered rows.

---

### User Story 3 - Schema Introspection via Fluent API (Priority: P3)

As a developer, I want convenience methods for common schema inspection tasks (e.g., checking whether a table or column exists), so that internal framework code like migration checks or backup routines no longer need to issue raw SQL queries against `information_schema`.

**Why this priority**: Several internal outlet subsystems (Schema, MigrationManager, BackupManager) already query `information_schema` directly with raw SQL. Providing a clean API eliminates duplication and makes those subsystems consistent.

**Independent Test**: Can be fully tested by calling something like `outlet.schema.tableExists('my_table')` and verifying it returns `true`/`false` without any raw SQL strings in the calling code.

**Acceptance Scenarios**:

1. **Given** a table that exists in the database, **When** `schema.tableExists('table_name')` is called, **Then** it returns `true`.
2. **Given** a table that does not exist, **When** `schema.tableExists('missing_table')` is called, **Then** it returns `false`.
3. **Given** a table and a column name, **When** `schema.columnExists('table_name', 'column_name')` is called, **Then** it returns the correct boolean.
4. **Given** the database, **When** `schema.listTables()` is called, **Then** it returns an array of table names for the current database.

---

### User Story 4 - Full SELECT Clause Variants (Priority: P4)

As a developer, I want the fluent query builder to support all major SELECT variants — DISTINCT, subqueries in FROM or WHERE, aliases, multi-column select — so that every common SQL pattern has an ORM equivalent.

**Why this priority**: Covers advanced but necessary patterns that otherwise force raw SQL. Lower priority because the simpler stories already cover most day-to-day needs.

**Independent Test**: Can be fully tested by building queries with DISTINCT, aliased columns, and subquery-in-FROM constructs and verifying the generated SQL and results are correct.

**Acceptance Scenarios**:

1. **Given** a table with duplicate values in a column, **When** `.distinct().select('status')` is called, **Then** only unique values are returned.
2. **Given** a developer needs an aliased expression, **When** they call `.select('price * 1.2 AS price_with_tax')`, **Then** the returned rows include the `price_with_tax` field with the correct value.
3. **Given** a need for a subquery in the FROM clause, **When** the builder accepts a nested builder or raw expression as the source, **Then** the outer query executes correctly against the subquery result.

---

### Edge Cases

- What happens when a developer passes an empty string or `null` to `from()`? The builder should throw a descriptive error immediately, before any query is executed.
- What happens when aggregate functions are mixed with non-aggregated columns without a GROUP BY? The builder should allow the query to execute and let the database engine raise any SQL errors, returning them clearly to the caller.
- What happens when `DATABASE()` or similar database-specific functions are used in a WHERE condition? They must be treated as raw expressions and not parameterized or escaped.
- What happens when a query targets a table that does not exist? The error from the database engine must be propagated to the caller with a meaningful message.
- What happens when no rows match a COUNT query? The result must be `0`, not `null` or `undefined`.
- What happens when the same query builder instance is reused after execution? Standalone instances (from `db.from(...)`) are single-use. Once an execution method (e.g., `.get()`, `.first()`, `.count()`) has been called, the instance is considered consumed and calling it again MUST throw a `QueryBuilderError` (a custom outlet-orm error class), allowing callers to distinguish ORM-layer mistakes from database errors via `instanceof`. Model-bound instances (from `Model.query()`) retain their current reusable behaviour.
- What happens when the database driver throws during query execution? The driver error MUST be passed through to the caller unwrapped, preserving the original stack trace and error message. The standalone `QueryBuilder` MUST NOT re-wrap or swallow driver errors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The library MUST provide a standalone query builder accessible via `db.from('table_name')` on a `DatabaseConnection` instance. It MUST accept any table name (including schema-prefixed names like `information_schema.tables`) without requiring a mapped model class.
- **FR-002**: The query builder MUST support selecting specific columns, expressions, and aliases via a `.select()` method that accepts a string or an array of strings.
- **FR-003**: The query builder MUST support aggregate functions COUNT, SUM, AVG, MIN, and MAX through both explicit `.select('COUNT(*) AS n')` syntax and dedicated shorthand methods (`.count()`, `.sum(col)`, `.avg(col)`, `.min(col)`, `.max(col)`).
- **FR-004**: The query builder MUST support `.groupBy(column)` and `.having(column, operator, value)` clauses for grouped aggregation queries, and it MUST also support a raw HAVING variant via `.havingRaw(sql, bindings)`.
- **FR-005**: The query builder MUST support `.distinct()` to add the DISTINCT keyword to the SELECT statement.
- **FR-006**: The query builder MUST support raw expressions in SELECT, WHERE, and HAVING positions, so that database functions like `DATABASE()` and `NOW()` can be embedded without escaping.
- **FR-007**: The `Schema` module MUST expose `tableExists(tableName)`, `columnExists(tableName, columnName)`, and `listTables()` convenience methods that use the fluent query builder internally rather than raw SQL strings.
- **FR-008**: The `executeRawQuery` SELECT operations inside `src/Schema/Schema.js` (`hasTable`, `hasColumn`) MUST be replaced by the new fluent API. The same replacement is technically possible for `BackupManager` (data-export SELECT calls) and `MigrationManager` but those subsystems are explicitly deferred — they are out of scope for this iteration and MUST NOT be modified here.
- **FR-009**: The query builder MUST return results as plain JavaScript objects (arrays of key-value row maps) when no model class is associated with the query.
- **FR-010**: The query builder MUST support parameterized values in WHERE clauses to prevent SQL injection, even when targeting arbitrary tables.
- **FR-011**: The existing `.where()`, `.orderBy()`, `.limit()`, `.offset()`, and `.join()` methods on the model-bound QueryBuilder MUST continue to work unchanged (backward compatibility).
- **FR-012**: A `QueryBuilder` instance obtained via `db.from(...)` (standalone mode) MUST be single-use. After any execution method is invoked, subsequent execution calls on the same instance MUST throw a `QueryBuilderError`. A new instance is obtained via a fresh `db.from(...)` call. Model-bound `QueryBuilder` instances (from `Model.query()`) are unaffected by this constraint.
- **FR-013**: Standalone queries executed via `db.from(...)` MUST emit query log events through the same logging mechanism used by model-bound queries. Every SQL statement and its bound parameters MUST appear in the outlet query log, indistinguishable in observability terms from model-originated queries.
- **FR-014**: The `QueryBuilderError` class MUST be exported as a named export from the package's main `index.js` entry point and MUST have a corresponding TypeScript declaration in `types/index.d.ts`. The `QueryBuilder` class is already exported; the `DatabaseConnection.from()` method MUST also be declared in the TypeScript types.
- **FR-015**: Builder-level errors (invalid state such as reuse of a consumed standalone instance, or an empty/null table name passed to `db.from()`) MUST throw a `QueryBuilderError` custom class, distinguishable via `instanceof QueryBuilderError`. Errors originating from the database driver MUST be propagated to the caller without re-wrapping, preserving the original error type, message, and stack trace.

### Key Entities

- **QueryBuilder (standalone mode)**: The existing `QueryBuilder` class, extended to operate without a bound model class. Accessed via `db.from('table_name')` on a `DatabaseConnection` instance. Accepts a table name (including schema-qualified names), supports all SELECT clauses, and returns plain row arrays. No new class is introduced — the same `QueryBuilder` handles both model-bound and standalone queries.
- **Raw Expression**: A wrapper that marks a string as a verbatim SQL fragment, preventing parameterization. Used for database functions, computed columns, and complex expressions. Already exists as `RawExpression` — this feature expands its usage coverage.
- **Schema Introspection API**: Methods on the existing `Schema` class that wrap `information_schema` queries through the fluent builder, providing named, tested, and readable alternatives to inline raw SQL.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The `executeRawQuery` SELECT calls inside `src/Schema/Schema.js` (2 methods: `hasTable`, `hasColumn`) are replaced by fluent API calls with no functional regression, as proven by the existing test suite passing without modification. BackupManager (~8 data-export SELECT calls) and MigrationManager (0 direct SELECT calls — already delegates to Schema) are explicitly out of scope for this iteration.
- **SC-002**: Developers can express the motivating example (`SELECT COUNT(1) AS cnt FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`) using fewer than 5 chained fluent calls, with no raw SQL string in the calling code.
- **SC-003**: 100% of the new API surface is covered by automated tests that assert both the generated SQL and the returned data shape.
- **SC-004**: No existing test in the `tests/` directory fails after the feature is implemented (zero regressions).
- **SC-005**: The feature introduces no new direct calls to `executeRawQuery` for SELECT operations within outlet-orm's own source code.
- **SC-006**: Any standalone query executed via `db.from(...)` appears in outlet-orm's query log with its SQL and bound parameters, verifiable by enabling query logging in the test suite and asserting the emitted event.

## Assumptions

- The feature targets MySQL, SQLite, and PostgreSQL. PostgreSQL is included in the `listTables()` implementation (matching the pattern already established in `data-model.md`). All other new API surface targets MySQL and SQLite primarily.
- The existing `RawExpression` class will be reused as-is to represent verbatim SQL fragments; no changes to its public interface are needed.
- No new class `StandaloneQueryBuilder` is introduced. The existing `QueryBuilder` class is extended with a standalone mode: when constructed via `db.from(source)`, it operates without a bound model and returns plain row objects.
- Schema introspection methods `tableExists` and `columnExists` do **not** yet exist on `Schema` — they are new public additions. `hasTable` and `hasColumn` already exist with raw SQL internals; this feature refactors their internals and adds the new public aliases. `listTables` is entirely new.
- Developers using outlet-orm are comfortable with a fluent (method-chaining) API style, consistent with the existing `Model.query()` interface.
- The motivation example (`information_schema` COUNT query) is representative of the primary use case; full SQL-equivalent coverage (e.g., window functions, CTEs) is deferred to a future iteration.

---

## Fonctionnalités manquantes identifiées par audit des migrations

Date: 2026-05-18 — Repository: tutor — Scope: 31 migrations (backend/database/migrations)

### Contexte

Sur 31 migrations analysées, 10 recourent à du SQL brut faute d'API Outlet-ORM équivalente. Les sections suivantes décrivent les **fonctionnalités à ajouter** pour éliminer ce SQL brut, classées par thème.

### F1 — Introspection de schéma

**Pourquoi :** Les migrations idempotentes vérifient l'existence d'une table, d'une colonne ou d'un index avant d'agir. Sans cette API, les développeurs écrivent des SELECT manuels sur `INFORMATION_SCHEMA`, ce qui est verbeux et non portable.

**Fonctionnalités attendues :**

| Méthode | Description |
|---|---|
| `schema.hasTable(tableName)` | Renvoie `true` si la table existe dans la base courante |
| `schema.hasColumn(tableName, columnName)` | Renvoie `true` si la colonne existe dans la table |
| `schema.hasIndex(tableName, indexName)` | Renvoie `true` si l'index existe sur la table |

> **Scope note**: `hasTable` and `hasColumn` (including their `tableExists`/`columnExists` aliases) are **in scope** for this iteration. `schema.hasIndex()` is **deferred** — it shares the same pattern but requires driver-specific `information_schema.statistics` / `sqlite_master` / `pg_indexes` queries and will be addressed in the next feature iteration.

Migrations concernées: 023, 024, 025, 030, 031

---

### F2 — Opérations DDL idempotentes

> **Out of scope for this iteration.**

**Pourquoi :** Une migration doit pouvoir être rejouée sans erreur. Aujourd'hui les développeurs enveloppent chaque `ALTER TABLE` ou `CREATE INDEX` dans une vérification manuelle d'existence (via `hasColumn` en SQL brut). Une API DDL conditionnelle rend le code déclaratif et plus lisible.

**Fonctionnalités attendues :**

| Méthode | Description |
|---|---|
| `table.addColumnIfNotExists(name, type, options)` | Ajoute la colonne uniquement si elle est absente |
| `table.dropColumnIfExists(name)` | Supprime la colonne uniquement si elle est présente |
| `schema.addIndexIfNotExists(table, columns, options)` | Crée l'index uniquement s'il est absent |
| `schema.dropIndexIfExists(table, indexName)` | Supprime l'index uniquement s'il est présent |
| `table.addForeignIfNotExists(name, options)` | Ajoute la contrainte FK uniquement si elle est absente |

Migrations concernées: 014, 025, 027, 028, 030

---

### F3 — Options avancées du schema builder pour CREATE TABLE

> **Out of scope for this iteration.**

**Pourquoi :** Plusieurs tables sont créées en SQL pur parce que le schema builder actuel ne supporte pas certaines options structurelles. Le schéma devrait être entièrement exprimable via l'API fluente.

**Fonctionnalités attendues :**

| Option | Description |
|---|---|
| `table.engine('InnoDB')` | Spécifie le moteur de stockage |
| `table.charset('utf8mb4')` / `table.collation(...)` | Encodage et collation de la table |
| `column.comment('texte')` | Commentaire sur une colonne |
| `table.index([col1, col2], { order: 'DESC' })` | Index composite avec options d'ordre |
| `table.foreign(col).references(...).constraintName(name)` | Nommage explicite de la contrainte FK |

Migrations concernées: 026, 027, 028, 029

---

### F4 — Insert / upsert orienté migration

**Pourquoi :** Les migrations de données utilisent `INSERT IGNORE` (MySQL) pour insérer des lignes sans erreur si elles existent déjà. Outlet-ORM doit proposer un équivalent portable.

**Fonctionnalités attendues :**

| Méthode | Description |
|---|---|
| `db.table(name).insertIgnore(rows)` | Insère les lignes, ignore silencieusement les doublons |
| `db.table(name).upsert(rows, conflictKey)` | Insère ou met à jour selon une clé de conflit (portable cross-dialect) |

Migrations concernées: 026, 029

---

### F5 — Insert depuis SELECT avec expressions conditionnelles

**Pourquoi :** Certaines migrations alimentent une table à partir d'une autre avec une logique de transformation (`CASE WHEN`). Ce pattern de seed relationnel est actuellement impossible sans SQL brut.

**Fonctionnalités attendues :**

| Méthode | Description |
|---|---|
| `db.table(target).insertFromSelect(subquery)` | Insère les résultats d'un `StandaloneQueryBuilder` dans la table cible |
| `qb.selectRaw('CASE WHEN ... END AS col')` | Permet d'intégrer une expression `CASE` dans une colonne SELECT |

Migrations concernées: 026, 029

---

### F6 — Mise à jour de données sans SQL brut

**Pourquoi :** Des migrations effectuent des renommages ou corrections de valeurs dans des colonnes existantes via `UPDATE ... WHERE`. Une API de bulk update évite d'écrire du SQL inline pour ces cas simples.

**Fonctionnalités attendues :**

| Méthode | Description |
|---|---|
| `db.table(name).updateWhere(conditions, values)` | Met à jour les lignes correspondant aux conditions |
| `db.table(name).bulkUpdate(rows, matchKey)` | Met à jour plusieurs lignes en une seule opération, identifiées par une clé |

Migrations concernées: 014, 023

---

### F7 — Support FK robuste (observation complémentaire)

**Pourquoi :** Plusieurs migrations anciennes (008–012) portent le commentaire `"FK constraint removed for Outlet-ORM compatibility"`, indiquant que les FK ont été retirées pour contourner des limitations de l'API actuelle. Ce n'est pas lié au SQL brut, mais révèle un problème de couverture.

**Fonctionnalités attendues :**

- Déclaration FK inline lors du `createTable` (sans `ALTER TABLE` séparé)
- Support des FK nommées et des options `ON DELETE` / `ON UPDATE` complètes
- Méthode `dropForeignIfExists(name)` pour les migrations de rollback

Migrations concernées: 008, 009, 010, 011, 012

---

### Priorisation recommandée

| Priorité | Fonctionnalité | Justification |
|---|---|---|
| 1 | F1 — Introspection schéma | Prérequis de toutes les migrations idempotentes (5 fichiers) |
| 2 | F2 — DDL idempotent | Élimine la quasi-totalité du SQL conditionnel (5 fichiers) |
| 3 | F4 — Insert / upsert | Cas fréquent, simple à implémenter de manière portable |
| 4 | F5 — Insert depuis SELECT | Nécessaire pour les migrations de seed relationnel |
| 5 | F7 — Support FK robuste | Impact indirect mais fort sur la qualité globale des migrations |
| 6 | F3 — CREATE TABLE avancé | Améliore la complétude structurelle du schema builder |
| 7 | F6 — Bulk update | Cas moins fréquent, faible risque de régression |

### Impact attendu

- Réduction du SQL brut à zéro dans les migrations standard.
- Migrations portables entre MySQL, PostgreSQL et SQLite sans modification.
- Code de migration déclaratif, lisible et testable unitairement.
- Suppression des contournements FK et des dépendances à `INFORMATION_SCHEMA`.

# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [8.0.0] - 2025-06-28

### 🤖 New Features — AiBridge: Multi-Provider LLM Abstraction

Full port of [AiBridge](https://github.com/YourOrg/AiBridge) (PHP/Laravel v2.6.0) into outlet-orm as a native Node.js module. Provides a unified API for 9+ LLM providers with zero new production dependencies (uses Node 18+ native `fetch`).

#### AiBridge Manager & Configuration
- Added **AiBridgeManager** — central orchestrator for multi-provider AI operations
- Config-driven auto-registration: pass provider configs and they're ready to use
- Methods: `chat()`, `stream()`, `streamEvents()`, `embeddings()`, `models()`, `model()`, `image()`, `tts()`, `stt()`
- Dynamic provider resolution with runtime overrides (api key, endpoint, headers)
- Tool registry integration: `registerTool()`, `tool()`, `tools()`
- Config file: `config/aibridge.js` + env template `config/.env.aibridge.example`

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
- `ai_query` — natural language database queries via AI (requires AiBridge config)
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

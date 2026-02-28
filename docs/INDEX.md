# 📚 Outlet ORM – Complete Documentation

> **Version 9.0.0** – A JavaScript/TypeScript ORM inspired by Laravel Eloquent for Node.js

## Table of Contents

### 🚀 Getting Started
- [Quick Start Guide](QUICKSTART.md)
- [Installation and Configuration](INSTALLATION.md)
- [Project Structure (Layered Architecture)](INSTALLATION.md#structure-de-projet-recommended-architecture-en-couches)

### 🏗️ Recommended Architecture
- [Layered Architecture](ARCHITECTURE.md) – Controllers → Services → Repositories → Models
- [Backend Security](SECURITY.md) – Middleware, validation, and best practices

### 📖 Essential Guides
- [Models and CRUD](MODELS.md)
- [Query Builder](QUERY_BUILDER.md)
- [Relationships](RELATIONS.md)
- [Automatic Relationship Detection](RELATIONS_DETECTION.md)

### ⚡ Advanced Features
- [Transactions](TRANSACTIONS.md)
- [Soft Deletes](SOFT_DELETES.md)
- [Scopes (Global and Local)](SCOPES.md)
- [Events / Hooks](EVENTS.md)
- [Validation](VALIDATION.md)
- [Query Logging](QUERY_LOGGING.md)

### 🗄️ Backup & Restore (v6.0.0)
- [**Backup Guide**](BACKUP.md) – Full / partial / journal backups, scheduling, AES-256-GCM encryption, TCP daemon, remote restore

### 🤖 AI Integration (v7.0.0 – v9.0.0)

#### AiBridge — Multi-Provider LLM Abstraction (v8.0.0+)
- [**AiBridge Manager**](AI_BRIDGE.md) – Unified API for 9+ LLM providers (OpenAI, Claude, Gemini, Ollama, Grok, Mistral, ONN, OpenRouter)
- [**TextBuilder Fluent API**](AI_BRIDGE.md#textbuilder-fluent-api) – Chain `.using().withPrompt().asText()` for text generation
- [**Tool Calling**](AI_BRIDGE.md#tool-calling-function-calling) – LLM function calling with automatic orchestration loop
- [**Providers & Contracts**](AI_BRIDGE.md#providers) – 9 provider implementations with 6 base contracts

#### ORM AI Features (v8.0.0+)
- [**AI Query Builder**](AI_QUERY.md) – Natural language → SQL conversion with schema introspection
- [**AI Seeder**](AI_SEEDER.md) – LLM-powered realistic, domain-specific seed data generation
- [**AI Query Optimizer**](AI_OPTIMIZER.md) – SQL analysis, optimization suggestions, and index recommendations
- [**AI Prompt Enhancer**](AI_PROMPT.md) – Schema, model code, and migration code generation from natural language

#### AI Agent Integration (v7.0.0+)
- [**MCP Server**](MCP.md) – Model Context Protocol server for AI agents (Cursor, Claude Code, Copilot, Windsurf) — 13 tools
- [**AI Safety Guardrails**](AI_SAFETY.md) – Automatic AI agent detection and destructive operation protection
- [**Prompt-based Init**](AI_PROMPT.md#promptgenerator-regex-based-alternative) – Generate projects from natural language: `outlet-init --prompt "..."`
- [**Agent Skills**](skills/outlet-orm/AI.md) – Structured documentation for AI agents

### 🔐 Security
- [**Backend Security Guide**](SECURITY.md) – Secure structure, middleware, and best practices

### 📘 TypeScript (v5.0.0+)
- [**TypeScript Complete Guide**](TYPESCRIPT.md) – Generic models, typed schema builder, typed migrations

### 🛠️ Tools
- [Migrations](MIGRATIONS.md)
- [Seeds](SEEDS.md)
- [CLI (outlet-init, outlet-migrate, outlet-convert, outlet-mcp)](CLI.md)
- [Backup daemon (BackupSocketServer)](BACKUP.md#4-backupsocketserver--tcp-daemon)

### 📚 Reference
- [Internal ORM Architecture](ARCHITECTURE.md#structure-interne-de-lorm)
- [API Reference](API_REFERENCE.md)

### 📋 Other
- [Changelog](../CHANGELOG.md)
- [Contributing](../CONTRIBUTING.md)

---

## Quick Overview

```javascript
const { Model } = require('outlet-orm');

// Define the Post model (see Relationships)
class Post extends Model {
  static table = 'posts';
}

// Define the User model (automatic connection via .env)
class User extends Model {
  static table = 'users';
  static softDeletes = true;
  static rules = { email: 'required|email' };

  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

// Usage – connection is initialised automatically from .env
const users = await User.with('posts').where('status', 'active').get();
```

> 💡 **Automatic connection**: Simply create a `.env` file with your connection settings. `Model` connects automatically on first use.

## What's New in v9.0.0

| Feature | Description |
|---|---|
| 📖 **Complete AI Documentation** | 6 new dedicated documentation pages covering the full AiBridge + ORM AI feature set |
| 🤖 **AiBridge Guide** | Comprehensive guide for the multi-provider LLM abstraction layer |
| 🔍 **AI Query Builder Guide** | Natural language to SQL conversion documentation |
| 🌱 **AI Seeder Guide** | LLM-powered realistic data generation documentation |
| ⚡ **AI Optimizer Guide** | SQL optimization and EXPLAIN analysis documentation |
| 🏗️ **AI Prompt Enhancer Guide** | Schema/model/migration generation from descriptions |
| 🛡️ **AI Safety Guide** | Dedicated safety guardrails documentation |

### Previous Release — v8.0.0

| Feature | Description |
|---|---|
| 🤖 **AiBridge Manager** | Central orchestrator for 9+ LLM providers (chat, stream, embeddings, images, TTS, STT) |
| 📝 **TextBuilder** | Fluent builder API for text generation |
| 🔍 **AIQueryBuilder** | Natural language to SQL conversion |
| 🌱 **AISeeder** | LLM-powered realistic seed data |
| ⚡ **AIQueryOptimizer** | AI-powered SQL optimization |
| 🏗️ **AIPromptEnhancer** | LLM-powered schema/model/migration generation |
| 🔧 **Tool Calling** | Function calling with ToolContract, ToolRegistry, ToolChatRunner |
| 🔌 **9 Providers** | OpenAI, Ollama, Claude, Gemini, Grok, Mistral, ONN, Custom OpenAI, OpenRouter |
| 🛠️ **MCP ai_query + query_optimize** | 2 new MCP tools (total: 13) |

## What's New in v6.5.0

| Feature | Description |
|---|---|
| 🔮 **Accessors & Mutators** | `get{Key}Attribute` / `set{Key}Attribute` methods to transform on read/write |
| 🔍 **firstOrCreate** | Find by conditions or create a new record |
| 📋 **firstOrNew** | Find by conditions or return an unsaved instance |
| 🔄 **updateOrCreate** | Find and update, or create a new record |
| ⚡ **upsert** | Bulk `INSERT … ON CONFLICT` with driver-specific SQL |
| 👁️ **Observer** | Register observer classes for model lifecycle events |
| 🌊 **cursor()** | Async generator for lazy iteration over large datasets |

### Previous Release – v6.0.0

| Feature | Description |
|---|---|
| 🗄️ **BackupManager** | Full / partial / journal backups, `restore()` with auto-decrypt |
| ⏰ **BackupScheduler** | Recurring jobs (`setInterval`), `runNow`, `onSuccess`/`onError` hooks |
| 🔐 **BackupEncryption** | AES-256-GCM, scrypt key derivation, _grain de sable_ salt (4–6 chars) |
| 🛰️ **BackupSocketServer** | TCP daemon on port 9119, NDJSON protocol, push events |
| 📡 **BackupSocketClient** | Promise API + EventEmitter, remote `schedule`/`run`/`restore` |

### Previous Major Release – v5.0.0

| Feature | Description |
|---|---|
| 🏗️ **Layered Architecture** | Recommended structure: Controllers → Services → Repositories → Models |
| 📁 **Centralised Source** | All source code is in `src/` (migrated from `lib/`) |
| 📘 **Generic Model** | `Model<TAttributes>` for strong attribute typing |
| 🔒 **Type-safe getAttribute** | Returns the correct type based on your interface |
| 🏗️ **Typed Schema Builder** | Complete interfaces for typed migrations |
| 📝 **MigrationInterface** | Standard contract for TypeScript migrations |
| ✅ **Extended ValidationRule** | `url`, `array`, `integer`, `alpha`, etc. |
| 🎯 **ModelEventName** | Standard union type for all events |
| 🔍 **WhereOperator** | Standard union type for all operators |

### Existing Features (v3.0.0+)

| Feature | Description |
|---|---|
| 🔄 **Transactions** | `beginTransaction()`, `commit()`, `rollback()`, `transaction()` |
| 🗑️ **Soft Deletes** | Logical deletion with `deleted_at` |
| 🔬 **Scopes** | Reusable global and local filters |
| 📣 **Events** | Model lifecycle hooks |
| ✅ **Validation** | Built-in validation rules |
| 📊 **Query Logging** | Debug mode to analyse queries |

## Support

- **GitHub**: [github.com/omgbwa-yasse/outlet-orm](https://github.com/omgbwa-yasse/outlet-orm)
- **npm**: [npmjs.com/package/outlet-orm](https://www.npmjs.com/package/outlet-orm)
- **Issues**: [Report a bug](https://github.com/omgbwa-yasse/outlet-orm/issues)

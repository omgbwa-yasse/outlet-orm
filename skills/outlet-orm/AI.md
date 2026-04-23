---
name: outlet-orm-ai-integration
description: Guide for AI agents using Outlet ORM's AI multi-provider LLM, AI Query Builder, AI Seeder, AI Optimizer, AI Prompt Enhancer, MCP Server, and AI Safety Guardrails. Use when an AI agent needs to interact with LLMs, databases, run migrations, generate data, optimize queries, or create projects safely.
---

# Outlet ORM — AI Integration Guide

This skill covers Outlet ORM's complete AI feature set (v7.0.0+, current: v12.0.0):

- **AI** — Multi-provider LLM abstraction (9 providers, chat, stream, embeddings, images, TTS, STT, tool calling)
- **AI Query Builder** — Natural language to SQL
- **AI Seeder** — LLM-powered realistic data generation
- **AI Query Optimizer** — SQL optimization and EXPLAIN analysis
- **AI Prompt Enhancer** — Schema/model/migration code generation from natural language
- **MCP Server** — Model Context Protocol server for AI agents (13 tools)
- **AI Safety Guardrails** — Protection against destructive operations

---

## AI — Multi-Provider LLM Abstraction

> Since v8.0.0

AI provides a unified API to interact with 9+ LLM providers. Zero production dependencies (Node 18+ native `fetch`).

### Configuration

```javascript
// config/ai.js
module.exports = {
  default: process.env.AI_DEFAULT_PROVIDER || 'openai',
  providers: {
    openai:       { api_key: process.env.OPENAI_API_KEY,    model: 'gpt-4o' },
    claude:       { api_key: process.env.ANTHROPIC_API_KEY,  model: 'claude-sonnet-4-20250514' },
    gemini:       { api_key: process.env.GEMINI_API_KEY,     model: 'gemini-2.0-flash' },
    ollama:       { endpoint: 'http://localhost:11434',      model: 'llama3' },
    ollama_turbo: { api_key: process.env.OLLAMA_TURBO_API_KEY, endpoint: 'https://api.ollama.ai', model: 'llama3' },
    grok:         { api_key: process.env.GROK_API_KEY,       model: 'grok-1' },
    mistral:      { api_key: process.env.MISTRAL_API_KEY,    model: 'mistral-large-latest' },
    onn:          { api_key: process.env.ONN_API_KEY,        model: 'onn-default' },
    openai_custom: {
      api_key: process.env.CUSTOM_OPENAI_API_KEY,
      base_url: process.env.CUSTOM_OPENAI_BASE_URL || 'http://localhost:1234/v1',
      model: 'local-model'
    },
    openrouter: {
      api_key: process.env.OPENROUTER_API_KEY,
      base_url: 'https://openrouter.ai/api/v1',
      model: 'openai/gpt-4o'
    }
  },
  settings: {
    max_file_bytes: 10485760,
    default_max_tokens: 2048,
    default_temperature: 0.7,
    max_tool_iterations: 5
  }
};
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_DEFAULT_PROVIDER` | Default provider name | `openai` |
| `OPENAI_API_KEY` | OpenAI API key | — |
| `ANTHROPIC_API_KEY` | Claude API key | — |
| `GEMINI_API_KEY` | Google Gemini API key | — |
| `OLLAMA_ENDPOINT` | Ollama local URL | `http://localhost:11434` |
| `GROK_API_KEY` | xAI Grok API key | — |
| `MISTRAL_API_KEY` | Mistral AI API key | — |
| `ONN_API_KEY` | Onn.ai API key | — |
| `OPENROUTER_API_KEY` | OpenRouter API key | — |
| `CUSTOM_OPENAI_BASE_URL` | Custom OpenAI-compatible URL | — |
| `AI_MAX_TOKENS` | Default max tokens | `2048` |
| `AI_TEMPERATURE` | Default temperature | `0.7` |

### Chat

```javascript
const { AIManager } = require('outlet-orm');

const ai = new AIManager(config);

const response = await ai.chat('openai', [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Explain closures in JavaScript.' }
], { model: 'gpt-4o-mini', max_tokens: 500 });

console.log(response.text);
```

### Streaming

```javascript
for await (const chunk of ai.stream('openai', messages)) {
  process.stdout.write(chunk.text || '');
}
```

### Embeddings

```javascript
const result = await ai.embeddings('openai', ['The quick brown fox'], {
  model: 'text-embedding-3-small'
});
console.log(result.vectors);
```

### Image Generation

```javascript
const image = await ai.image('openai', 'A sunset over mountains', {
  model: 'dall-e-3', size: '1024x1024'
});
```

### TTS / STT

```javascript
const { audio, mime } = await ai.tts('openai', 'Hello!', { voice: 'alloy' });
const { text } = await ai.stt('openai', '/path/to/audio.mp3');
```

### TextBuilder (Fluent API)

```javascript
const { text } = await ai.text()
  .using('openai', 'gpt-4o')
  .withSystemPrompt('You are a poet.')
  .withPrompt('Write a haiku about coding.')
  .withMaxTokens(100)
  .usingTemperature(0.9)
  .asText();
```

| Method | Description |
|--------|-------------|
| `.using(provider, model)` | Set provider and model |
| `.withPrompt(text, attachments?)` | Add user message |
| `.withSystemPrompt(text)` | Set system prompt |
| `.withMaxTokens(n)` | Max tokens limit |
| `.usingTemperature(t)` | Temperature (0–2) |
| `.withApiKey(key)` | Override API key |
| `.withBaseUrl(url)` | Override base URL |
| `.asText()` | Returns `{ text, raw, usage }` |
| `.asStream()` | Returns `AsyncGenerator<StreamChunk>` |
| `.asRaw()` | Returns raw provider response |

### Tool Calling (Function Calling)

```javascript
const { ToolContract } = require('outlet-orm');

class WeatherTool extends ToolContract {
  name() { return 'get_weather'; }
  description() { return 'Get current weather for a city'; }
  schema() {
    return {
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city']
    };
  }
  async execute({ city }) {
    return JSON.stringify({ city, temperature: 22, unit: 'celsius' });
  }
}

ai.registerTool(new WeatherTool());
const response = await ai.chatWithTools('openai', [
  { role: 'user', content: "What's the weather in Paris?" }
]);
```

### AI Facade

```javascript
const { AI, AIManager } = require('outlet-orm');

AI.setManager(new AIManager(config));

const { text } = await AI.text()
  .using('openai', 'gpt-4o')
  .withPrompt('Hello!')
  .asText();
```

### Support Classes

| Class | Purpose |
|-------|---------|
| `Message` | Value object: `Message.system()`, `.user()`, `.assistant()` |
| `Document` | Attachments: `.fromLocalPath()`, `.fromUrl()`, `.fromBase64()`, `.fromChunks()` |
| `StreamChunk` | Streaming DTO: `.text`, `.usage`, `.finishReason`, `.toolCalls` |
| `ProviderError` | Error handling: `.notFound(name)`, `.unsupported(name, feature)` |
| `FileSecurity` | File attachment validation (size, type) |
| `JsonSchemaValidator` | Validates structured LLM outputs |

### Providers

| Provider | Class | Capabilities |
|----------|-------|-------------|
| **OpenAI** | `OpenAIProvider` | Chat, SSE streaming, embeddings, images, TTS, STT, function calling |
| **Claude** | `ClaudeProvider` | Chat, simulated streaming |
| **Gemini** | `GeminiProvider` | Chat, simulated streaming, embeddings |
| **Ollama** | `OllamaProvider` | Chat, NDJSON streaming, embeddings, images, multimodal |
| **Ollama Turbo** | `OllamaTurboProvider` | Ollama + Bearer token auth |
| **Grok** | `GrokProvider` | Chat, simulated streaming |
| **Mistral** | `MistralProvider` | OpenAI-compatible |
| **ONN** | `OnnProvider` | Chat, simulated streaming |
| **Custom OpenAI** | `CustomOpenAIProvider` | Any OpenAI-compatible endpoint (LM Studio, vLLM, Azure, OpenRouter) |

---

## AI Query Builder — Natural Language to SQL

> Since v8.0.0

Convert natural language questions into SQL queries using any LLM.

```javascript
const { AIManager, AIQueryBuilder, DatabaseConnection } = require('outlet-orm');

const ai = new AIManager(config);
const db = new DatabaseConnection();
const qb = new AIQueryBuilder(ai, db);

// Convert and execute
const result = await qb.query('How many users signed up last month?');
console.log(result.sql);     // SELECT COUNT(*) ...
console.log(result.results); // [{ count: 42 }]

// Generate SQL without executing
const { sql } = await qb.toSql('Find duplicate emails');
```

### API

| Method | Returns | Description |
|--------|---------|-------------|
| `using(provider, model)` | `this` | Set LLM provider |
| `safeMode(bool)` | `this` | Restrict to SELECT/WITH (default: true) |
| `query(question)` | `{ sql, params, results, explanation }` | Convert + execute |
| `toSql(question)` | `{ sql, params, explanation }` | Convert only |

### Schema Introspection

| Driver | Method |
|--------|--------|
| SQLite | `PRAGMA table_list` + `PRAGMA table_info` |
| PostgreSQL | `information_schema.tables` + `columns` |
| MySQL | `SHOW TABLES` + `DESCRIBE` |

---

## AI Seeder — LLM-Powered Data Generation

> Since v8.0.0

Generate realistic, domain-specific seed data using AI.

```javascript
const { AIManager, AISeeder, DatabaseConnection } = require('outlet-orm');

const seeder = new AISeeder(new AIManager(config), new DatabaseConnection());

// Generate and insert
const { records, inserted } = await seeder.seed('users', 10, {
  domain: 'e-commerce',
  locale: 'fr_FR',
  description: 'An online fashion store'
});

// Generate without inserting (preview)
const records = await seeder.generate('products', 20, {
  domain: 'electronics'
});
```

### API

| Method | Returns | Description |
|--------|---------|-------------|
| `using(provider, model)` | `this` | Set LLM provider |
| `seed(table, count, context)` | `{ records, inserted }` | Generate + insert |
| `generate(table, count, context)` | `Array<Object>` | Generate only (preview) |

### Context Options

| Option | Type | Description |
|--------|------|-------------|
| `domain` | `string` | Business domain (`'e-commerce'`, `'healthcare'`, `'finance'`, etc.) |
| `locale` | `string` | Name/address locale (`'fr_FR'`, `'ja_JP'`, `'pt_BR'`, etc.) |
| `description` | `string` | Detailed domain description for better data quality |

---

## AI Query Optimizer

> Since v8.0.0

Analyze and optimize SQL queries using AI with index recommendations.

```javascript
const { AIManager, AIQueryOptimizer, DatabaseConnection } = require('outlet-orm');

const optimizer = new AIQueryOptimizer(new AIManager(config), new DatabaseConnection());

// Optimize
const result = await optimizer.optimize(
  'SELECT * FROM orders WHERE user_id IN (SELECT id FROM users WHERE status = "active")'
);
console.log(result.optimized);   // Rewritten SQL
console.log(result.suggestions); // [{ type, description, impact }]
console.log(result.indexes);     // ['CREATE INDEX ...']

// Explain
const { plan, analysis } = await optimizer.explain('SELECT ...');
```

### API

| Method | Returns | Description |
|--------|---------|-------------|
| `using(provider, model)` | `this` | Set LLM provider |
| `optimize(sql)` | `{ original, optimized, suggestions, indexes, explanation }` | Analyze + rewrite |
| `explain(sql)` | `{ plan, analysis }` | EXPLAIN + LLM interpretation |

### Common Optimizations Detected

| Issue | Impact | Suggestion |
|-------|--------|------------|
| `SELECT *` | Medium | Specify explicit columns |
| Missing index on JOIN column | High | `CREATE INDEX` on foreign keys |
| `IN` subquery | High | Rewrite as `JOIN` |
| Leading wildcard `LIKE '%...'` | High | Use full-text search |
| Large `OFFSET` pagination | Medium | Use keyset pagination |

---

## AI Prompt Enhancer — Schema & Code Generation

> Since v8.0.0

Generate complete schemas, models, and migrations from natural language.

```javascript
const { AIManager, AIPromptEnhancer } = require('outlet-orm');

const enhancer = new AIPromptEnhancer(new AIManager(config));

// Generate full schema
const schema = await enhancer.generateSchema(
  'A veterinary clinic with pets, owners, appointments, and medical records'
);
// schema.tables, schema.relations, schema.seedHints

// Generate model code
const code = await enhancer.generateModelCode('pets', schema.tables.pets, relations);

// Generate migration code
const migration = await enhancer.generateMigrationCode('pets', schema.tables.pets);
```

### API

| Method | Returns | Description |
|--------|---------|-------------|
| `using(provider, model)` | `this` | Set LLM provider |
| `generateSchema(description)` | `{ tables, relations, seedHints }` | Full schema from description |
| `generateModelCode(table, schema, rels)` | `string` | outlet-orm Model class code |
| `generateMigrationCode(table, schema)` | `string` | outlet-orm Migration class code |

### PromptGenerator (Regex-Based, Offline)

For offline scaffolding without an LLM:

```javascript
const { PromptGenerator } = require('outlet-orm');

const blueprint = PromptGenerator.parse('Create a blog with comments and tags');
PromptGenerator.generateModels(blueprint, './src/models');
PromptGenerator.generateMigrations(blueprint, './database/migrations');
PromptGenerator.generateSeeder(blueprint, './database/seeds');
```

Built-in templates: E-commerce, Blog/CMS, Task/Project, Social Network, SaaS, Habit Tracker, API/Auth.

### CLI

```bash
outlet-init --prompt "Create a blog with posts, comments, and tags"
outlet-init --prompt "E-commerce store" --driver sqlite
```

---

## MCP Server

> Since v7.0.0

The MCP server exposes Outlet ORM's full capabilities to AI agents via JSON-RPC 2.0 over stdio.

### Configuration

Add to your AI editor's MCP config (`.cursor/mcp.json`, `.vscode/mcp.json`, `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "outlet-orm": {
      "command": "npx",
      "args": ["outlet-mcp"],
      "env": {
        "DB_DRIVER": "sqlite",
        "DB_DATABASE": "./database.sqlite"
      }
    }
  }
}
```

### Available Tools

| Tool | Description | Destructive |
|------|-------------|:-----------:|
| `migrate_status` | Show pending and executed migrations | No |
| `migrate_run` | Run all pending migrations | No |
| `migrate_rollback` | Rollback last batch | No |
| `migrate_reset` | Rollback ALL migrations | **Yes** |
| `migrate_make` | Create a new migration file | No |
| `seed_run` | Run database seeders | No |
| `schema_introspect` | Introspect database schema | No |
| `query_execute` | Execute raw SQL | Conditional |
| `model_list` | List all model files | No |
| `backup_create` | Create database backup | No |
| `backup_restore` | Restore from backup | **Yes** |
| `ai_query` | AI natural language to SQL | No |
| `query_optimize` | AI query optimization | No |

### Tool Usage Examples

```json
// Introspect schema
{ "method": "tools/call", "params": { "name": "schema_introspect", "arguments": {} } }

// Run a SELECT query
{ "method": "tools/call", "params": { "name": "query_execute", "arguments": { "sql": "SELECT * FROM users LIMIT 10" } } }

// AI query
{ "method": "tools/call", "params": { "name": "ai_query", "arguments": { "question": "How many users signed up this month?" } } }

// Destructive operation (requires consent)
{ "method": "tools/call", "params": { "name": "migrate_reset", "arguments": { "consent": "User confirmed: reset dev migrations" } } }
```

### Programmatic Usage

```javascript
const { MCPServer } = require('outlet-orm');

const server = new MCPServer({
  projectDir: process.cwd(),
  safetyGuardrails: true
});

const handler = server.handler();
const response = await handler({
  jsonrpc: '2.0', id: 1,
  method: 'tools/call',
  params: { name: 'schema_introspect', arguments: {} }
});
```

---

## AI Safety Guardrails

> Since v7.0.0

Automatic AI agent detection and protection against destructive operations.

### Detected Agents

| Agent | Detection |
|-------|-----------|
| **Cursor** | `CURSOR_*` env variables |
| **Claude Code** | `CLAUDE_*` env variables |
| **GitHub Copilot** | `GITHUB_COPILOT_*` or `VSCODE_*` with Copilot |
| **Windsurf** | `WINDSURF_*` env variables |
| **Gemini CLI** | `GEMINI_*` env variables |
| **Aider** | `AIDER_*` env variables |
| **Replit** | `REPL_*` env variables |
| **Qwen Code** | `QWEN_*` env variables |
| **Generic MCP** | `MCP_*` env variables |

### Destructive Commands

Blocked without consent: `reset`, `fresh`, `drop`, `truncate`, `restore`

### Consent Mechanism

```bash
# Via environment variable
export OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="User approved: reset dev database"
```

```json
// Via MCP tool argument
{ "consent": "User confirmed: reset the development database" }
```

### Programmatic Usage

```javascript
const { AISafetyGuardrails } = require('outlet-orm');

const { detected, agentName } = AISafetyGuardrails.detectAgent();
const result = AISafetyGuardrails.validateDestructiveAction('reset', { consent: 'User approved' });
console.log(result.allowed); // true
```

---

## Best Practices for AI Agents

1. **Always introspect first** — Use `schema_introspect` before modifying the database.
2. **Never bypass safety guardrails** — Always obtain explicit user consent for destructive operations.
3. **Use migrations, not raw DDL** — Prefer `migrate_make` + `migrate_run` over raw `CREATE TABLE`.
4. **Check migration status** — Use `migrate_status` before running migrations.
5. **Explain write queries** — When using `query_execute` for writes, explain what the query does.
6. **Prefer backups before destructive operations** — Use `backup_create` before `migrate_reset`.
7. **Use AI Query Builder for natural language** — Use `ai_query` tool instead of crafting SQL manually.
8. **Preview before seeding** — Use `generate()` to preview AI-generated data before `seed()`.

---

## Quick Reference

```javascript
const {
  // AI — Multi-Provider LLM
  AIManager,       // Main manager (chat, stream, embeddings, images, TTS, STT, tools)
  AI,              // Static facade
  // AI Support
  Message,               // Chat message value object
  Document,              // File/URL/base64 attachment
  StreamChunk,           // Streaming DTO
  ToolContract,          // Base class for function calling tools
  ProviderError,         // Error handling
  FileSecurity,          // Attachment validation
  JsonSchemaValidator,   // Structured output validation
  // ORM AI Features
  AIQueryBuilder,        // Natural language → SQL
  AISeeder,              // AI-powered data seeding
  AIQueryOptimizer,      // SQL optimization
  AIPromptEnhancer,      // Schema/code generation from descriptions
  PromptGenerator,       // Regex-based offline scaffolding
  // AI Agent Integration
  MCPServer,             // MCP server for AI agents (13 tools)
  AISafetyGuardrails,    // AI agent detection & safety
} = require('outlet-orm');
```

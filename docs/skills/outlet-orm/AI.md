---
name: outlet-orm-ai-integration
description: Guide for AI agents to use Outlet ORM's MCP Server, AI Safety Guardrails, and prompt-based project initialization. Use this skill when an AI agent needs to interact with Outlet ORM databases, run migrations, create projects, or execute queries safely.
license: MIT
metadata:
  author: omgbwa-yasse
  version: "7.0.0"
  source: https://github.com/omgbwa-yasse/outlet-orm
  npm: https://www.npmjs.com/package/outlet-orm
---

# Outlet ORM — AI Integration Guide

This skill covers Outlet ORM's AI-oriented features introduced in v7.0.0:

- **MCP Server** — Model Context Protocol server for AI agents
- **AI Safety Guardrails** — Protection against destructive operations
- **Prompt-based Init** — Generate projects from natural language descriptions

---

## MCP Server

The MCP server exposes Outlet ORM's full capabilities to AI agents via JSON-RPC 2.0 over stdio.

### Configuration

Add to your AI editor's MCP config (e.g. `.cursor/mcp.json`, `.vscode/mcp.json`, `claude_desktop_config.json`):

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
| `migrate_rollback` | Rollback last batch (supports `steps` param) | No |
| `migrate_reset` | Rollback ALL migrations | **Yes** |
| `migrate_make` | Create a new migration file | No |
| `seed_run` | Run database seeders | No |
| `schema_introspect` | Introspect database schema (all tables or specific) | No |
| `query_execute` | Execute raw SQL (write queries need consent) | Conditional |
| `model_list` | List all model files in the project | No |
| `backup_create` | Create a database backup (full/partial/journal) | No |
| `backup_restore` | Restore from a backup file | **Yes** |

### Tool Usage Examples

**Introspect the schema:**
```json
{ "method": "tools/call", "params": { "name": "schema_introspect", "arguments": {} } }
```

**Run a SELECT query:**
```json
{ "method": "tools/call", "params": { "name": "query_execute", "arguments": { "sql": "SELECT * FROM users LIMIT 10" } } }
```

**Create a migration:**
```json
{ "method": "tools/call", "params": { "name": "migrate_make", "arguments": { "name": "create_products_table" } } }
```

**Destructive operation (requires consent):**
```json
{ "method": "tools/call", "params": { "name": "migrate_reset", "arguments": { "consent": "User confirmed: reset all migrations in dev environment" } } }
```

### Programmatic Usage

```javascript
const { MCPServer } = require('outlet-orm');

const server = new MCPServer({
  projectDir: process.cwd(),
  safetyGuardrails: true
});

// Programmatic handler (for testing or embedding)
const handler = server.handler();
const response = await handler({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: { name: 'schema_introspect', arguments: {} }
});
```

---

## AI Safety Guardrails

Outlet ORM automatically detects AI agent invocations and blocks destructive operations without explicit user consent.

### Detected Agents

- **Cursor** (CURSOR_TRACE_ID, CURSOR_SESSION_ID)
- **Claude Code** (CLAUDE_CODE)
- **GitHub Copilot** (COPILOT_AGENT_MODE)
- **Windsurf** (WINDSURF_SESSION_ID, CODEIUM_SESSION)
- **Gemini CLI** (GEMINI_API_KEY + process title)
- **Aider** (AIDER_SESSION)
- **Replit** (REPLIT_DB_URL, REPLIT_AI_ENABLED)
- **Qwen Code** (QWEN_SESSION)
- **MCP Clients** (MCP_SERVER_NAME, MCP_SESSION_ID)

### Destructive Commands

These commands are blocked when an AI agent is detected without consent:
`reset`, `fresh`, `migrate:reset`, `migrate:fresh`, `drop`, `truncate`, `restore`

### Consent Mechanism

To allow a destructive operation, the AI agent must either:

1. **Set the environment variable:**
   ```bash
   OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="User confirmed: reset dev database"
   ```

2. **Pass the `consent` flag** in MCP tool arguments:
   ```json
   { "consent": "User explicitly approved resetting the development database" }
   ```

### Programmatic Usage

```javascript
const { AISafetyGuardrails } = require('outlet-orm');

// Detect if running under an AI agent
const { detected, agentName } = AISafetyGuardrails.detectAgent();
console.log(detected, agentName); // true, 'GitHub Copilot'

// Validate a destructive action
const result = AISafetyGuardrails.validateDestructiveAction('reset', { consent: 'User approved' });
console.log(result.allowed); // true
```

---

## Prompt-based Initialization

Generate an entire project from a natural language description.

### CLI Usage

```bash
outlet-init --prompt "Create a blog application with posts, comments, and tags"
outlet-init --prompt "E-commerce store with products, orders, and payments" --driver sqlite
```

### Supported Domains

| Domain | Keywords | Generated Tables |
|--------|----------|-----------------|
| **E-commerce** | shop, store, product, cart, order, payment | users, products, categories, orders, order_items, payments |
| **Blog/CMS** | blog, article, post, cms, comment, tag | users, posts, categories, tags, post_tag, comments |
| **Task/Project** | task, project, todo, kanban, sprint | users, projects, tasks, labels, task_label |
| **Social Network** | social, friend, follow, like, feed, message | users, posts, comments, likes, follows, messages |
| **SaaS** | saas, tenant, subscription, plan, billing | organizations, users, plans, subscriptions, invoices |
| **Habit Tracker** | habit, tracker, health, fitness, goal | users, habits, logs, goals |
| **API/Auth** | api, auth, rest, user | users, tokens, password_resets |

### Programmatic Usage

```javascript
const { PromptGenerator } = require('outlet-orm');

// Parse a prompt
const blueprint = PromptGenerator.parse('Create a blog with comments and tags');
console.log(blueprint.domain);  // 'blog'
console.log(blueprint.tables);  // { users: {...}, posts: {...}, ... }

// Generate models
const modelFiles = PromptGenerator.generateModels(blueprint, './models');

// Generate migrations
const migrationFiles = PromptGenerator.generateMigrations(blueprint, './database/migrations');

// Generate seeder
const seederFile = PromptGenerator.generateSeeder(blueprint, './database/seeds');
```

---

## Best Practices for AI Agents

1. **Always introspect first** — Use `schema_introspect` before modifying the database.
2. **Never bypass safety guardrails** — Always obtain explicit user consent for destructive operations.
3. **Use migrations, not raw DDL** — Prefer `migrate_make` + `migrate_run` over raw `CREATE TABLE` queries.
4. **Check migration status** — Use `migrate_status` before running migrations.
5. **Explain write queries** — When using `query_execute` for writes, explain what the query does to the user.
6. **Prefer backups before destructive operations** — Use `backup_create` before `migrate_reset`.

---

## Quick Reference

```javascript
const {
  MCPServer,             // MCP server for AI agents
  AISafetyGuardrails,    // AI agent detection & safety
  PromptGenerator        // Natural language project generation
} = require('outlet-orm');
```

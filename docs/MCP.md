# MCP Server — AI Agent Integration

> **Since v7.0.0** — Outlet ORM exposes a Model Context Protocol (MCP) server that AI agents can use to interact with your database.

## Overview

The MCP server provides AI agents (Cursor, Claude Code, GitHub Copilot, Windsurf, etc.) with safe, structured access to:

- **Migrations** — check status, run, rollback, create
- **Schema** — introspect tables and columns
- **Queries** — execute raw SQL (with safety checks for writes)
- **Seeds** — run database seeders
- **Backups** — create and restore backups
- **Models** — list project models

## Quick Start

### 1. Configure your AI editor

Add to your editor's MCP configuration file:

**Cursor** (`.cursor/mcp.json`):
```json
{
  "mcpServers": {
    "outlet-orm": {
      "command": "npx",
      "args": ["outlet-mcp"]
    }
  }
}
```

**VS Code** (`.vscode/mcp.json`):
```json
{
  "servers": {
    "outlet-orm": {
      "command": "npx",
      "args": ["outlet-mcp"]
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):
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

### 2. Database configuration

The MCP server auto-loads configuration from:
1. `database/config.js` (preferred)
2. `.env` file (fallback)

### 3. Start using natural language

Ask your AI agent:
- *"Show me the migration status"*
- *"Create a migration for a products table"*
- *"What tables are in the database?"*
- *"Run all pending migrations"*

---

## Available Tools

| Tool | Description | Params |
|------|-------------|--------|
| `migrate_status` | Show pending/executed migrations | — |
| `migrate_run` | Run all pending migrations | — |
| `migrate_rollback` | Rollback last batch | `steps` (optional) |
| `migrate_reset` | Rollback ALL migrations ⚠️ | `consent` (required) |
| `migrate_make` | Create a new migration file | `name` (required) |
| `seed_run` | Run database seeders | `class` (optional) |
| `schema_introspect` | Introspect database schema | `table` (optional) |
| `query_execute` | Execute raw SQL | `sql`, `params`, `consent` |
| `model_list` | List model files | — |
| `backup_create` | Create a backup | `type`, `tables`, `format` |
| `backup_restore` | Restore a backup ⚠️ | `filePath`, `consent` |

---

## AI Safety Guardrails

Destructive tools (`migrate_reset`, `backup_restore`) and write queries require **explicit user consent**.

When an AI agent tries a destructive operation without consent, Outlet ORM:
1. Detects the AI agent automatically
2. Blocks the operation
3. Returns instructions for the agent to explain the risks to the user
4. Requires the agent to obtain and relay explicit consent

### Consent methods

**Via MCP tool argument:**
```json
{ "consent": "User confirmed: reset development database" }
```

**Via environment variable:**
```bash
OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="User approved"
```

### Detected AI Agents

Cursor, Claude Code, GitHub Copilot, Windsurf, Gemini CLI, Aider, Replit, Qwen Code, and generic MCP clients.

---

## CLI Options

```
outlet-mcp [options]

  --project, -p <path>  Project root directory (default: cwd)
  --no-safety           Disable AI safety guardrails
  --help, -h            Show help
```

---

## Programmatic Usage

```javascript
const { MCPServer } = require('outlet-orm');

const server = new MCPServer({
  projectDir: process.cwd(),
  safetyGuardrails: true
});

// Get a handler for testing
const handle = server.handler();

const response = await handle({
  jsonrpc: '2.0',
  id: 1,
  method: 'tools/call',
  params: {
    name: 'schema_introspect',
    arguments: { table: 'users' }
  }
});

console.log(response.result.content[0].text);
```

---

## Protocol Details

- **Protocol**: MCP (Model Context Protocol) — [modelcontextprotocol.io](https://modelcontextprotocol.io)
- **Transport**: stdio (newline-delimited JSON-RPC 2.0)
- **Protocol Version**: `2024-11-05`
- **Methods**: `initialize`, `tools/list`, `tools/call`, `ping`, `notifications/initialized`

# AI Safety Guardrails — Destructive Operation Protection

> **Since v7.0.0** — Automatic AI agent detection and protection against destructive database operations.

## Overview

When AI agents (Cursor, Claude Code, GitHub Copilot, etc.) interact with your database through outlet-orm's MCP server or CLI, the **AISafetyGuardrails** module automatically:

1. **Detects** AI agent invocations
2. **Blocks** destructive operations
3. **Requires explicit user consent** before proceeding

This protects against accidental data loss when AI agents autonomously execute database commands.

---

## How It Works

### Agent Detection

AISafetyGuardrails detects AI agents by examining environment variables, process arguments, and parent process information:

| Agent | Detection Method |
|-------|-----------------|
| **Cursor** | `CURSOR_*` env variables |
| **Claude Code** | `CLAUDE_*` env variables |
| **GitHub Copilot** | `GITHUB_COPILOT_*` env or `VSCODE_*` with Copilot |
| **Windsurf** | `WINDSURF_*` env variables |
| **Gemini CLI** | `GEMINI_*` env variables |
| **Aider** | `AIDER_*` env variables |
| **Replit** | `REPL_*` env variables |
| **Qwen Code** | `QWEN_*` env variables |
| **Generic MCP** | `MCP_*` env variables or `--mcp` flag |

### Destructive Commands

The following operations are considered destructive:

| Command | Description |
|---------|-------------|
| `reset` | Reset all migrations (drops all tables) |
| `fresh` | Drop all tables and re-migrate |
| `drop` | Drop database objects |
| `truncate` | Truncate table data |
| `restore` | Restore from backup (overwrites current data) |

### Protection Flow

```
AI Agent → Runs destructive command
       ↓
AISafetyGuardrails.detectAgent()
       ↓ (AI detected)
AISafetyGuardrails.validateDestructiveAction(command, flags)
       ↓ (no consent)
⛔ BLOCKED — Returns message instructing agent to ask user for consent
       ↓ (user provides consent)
✅ ALLOWED — Operation proceeds
```

---

## API Reference

All methods are **static** — no instantiation needed.

### `detectAgent()`

Detect if the current process is invoked by an AI agent.

```javascript
const { AISafetyGuardrails } = require('outlet-orm');

const { detected, agentName } = AISafetyGuardrails.detectAgent();

if (detected) {
  console.log(`Running under AI agent: ${agentName}`);
}
```

**Returns:**

```javascript
{
  detected: true,      // boolean — is an AI agent detected?
  agentName: 'Cursor'  // string | null — detected agent name
}
```

---

### `isDestructiveCommand(command)`

Check if a command is considered destructive.

```javascript
AISafetyGuardrails.isDestructiveCommand('reset');    // true
AISafetyGuardrails.isDestructiveCommand('migrate');  // false
AISafetyGuardrails.isDestructiveCommand('fresh');    // true
AISafetyGuardrails.isDestructiveCommand('status');   // false
```

---

### `validateDestructiveAction(command, flags)`

Validate whether a destructive action should be allowed.

```javascript
// Without consent — blocked
const result = AISafetyGuardrails.validateDestructiveAction('reset', {});
// { allowed: false, message: 'SAFETY BLOCK: AI agent detected...' }

// With consent flag — allowed
const result = AISafetyGuardrails.validateDestructiveAction('reset', {
  consent: 'User confirmed: reset development database'
});
// { allowed: true, message: '' }
```

**Returns:**

```javascript
{
  allowed: boolean,  // Whether the action is permitted
  message: string    // Blocking message (empty if allowed)
}
```

---

### `CONSENT_ENV_VAR`

Static getter returning the name of the consent environment variable.

```javascript
AISafetyGuardrails.CONSENT_ENV_VAR
// 'OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION'
```

---

## Providing Consent

There are two ways to provide explicit user consent:

### 1. Via Environment Variable

Set the environment variable before running the command:

```bash
# Unix/macOS
export OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="User approved database reset"
outlet-migrate reset

# Windows
set OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="User approved database reset"
outlet-migrate reset
```

### 2. Via MCP Tool Argument

When using the MCP server, pass a `consent` argument:

```json
{
  "name": "migrate_reset",
  "arguments": {
    "consent": "User confirmed: reset the development database, I understand all data will be lost"
  }
}
```

### 3. Via CLI Flag

```bash
outlet-migrate reset --yes --consent "User approved"
```

---

## Blocking Message

When an AI agent is blocked, it receives a detailed message:

```
🛡️ SAFETY BLOCK: AI agent "Cursor" detected.

The command "reset" is destructive and requires explicit user consent.

⚠️ This operation will:
  - Reset all migrations
  - Drop all tables and data
  - This action is IRREVERSIBLE

To proceed, the user must:
1. Read and understand the above warnings
2. Provide explicit consent via one of:
   a. Environment variable: OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION="User approved"
   b. MCP tool argument: { "consent": "User approved: <description>" }

Do NOT proceed without explicit user approval.
```

This message is designed to be read by the AI agent, which should then:
1. Explain the risks to the user
2. Ask for confirmation
3. Relay the consent back to outlet-orm

---

## MCP Server Integration

The safety guardrails are integrated into the MCP server. Destructive tools automatically require consent:

| Tool | Destructive | Requires Consent |
|------|-------------|------------------|
| `migrate_status` | No | No |
| `migrate_run` | No | No |
| `migrate_rollback` | No | No |
| `migrate_reset` | **Yes** | **Yes** |
| `seed_run` | No | No |
| `schema_introspect` | No | No |
| `query_execute` (write) | **Yes** | **Yes** |
| `model_list` | No | No |
| `backup_create` | No | No |
| `backup_restore` | **Yes** | **Yes** |
| `ai_query` | No | No (safe mode) |
| `query_optimize` | No | No |

### Disabling Safety Guardrails

For development or testing, you can disable guardrails:

```bash
# Via CLI
outlet-mcp --no-safety

# Via code
const server = new MCPServer({
  safetyGuardrails: false
});
```

> **Warning**: Only disable guardrails in development environments. Never disable in production.

---

## CLI Integration

The guardrails are also integrated into `outlet-migrate` CLI commands:

```bash
# Blocked when run by AI agent without consent
outlet-migrate reset --yes
# ⛔ SAFETY BLOCK: AI agent detected...

# Allowed with consent
outlet-migrate reset --yes --consent "User approved"
# ✅ Proceeding with reset...
```

---

## Best Practices

1. **Always keep guardrails enabled** in production and shared environments
2. **Use descriptive consent messages** — include who approved and what they approved
3. **Log consent** — the consent string is included in operation logs
4. **Separate environments** — use different database credentials for dev/staging/production
5. **Review AI agent actions** — periodically review what commands AI agents are executing

---

## See Also

- [MCP Server](MCP.md) — AI agent integration via Model Context Protocol
- [Security Guide](SECURITY.md) — Backend security best practices
- [Migrations Guide](MIGRATIONS.md) — Understanding migration commands
- [Backup Guide](BACKUP.md) — Backup and restore operations

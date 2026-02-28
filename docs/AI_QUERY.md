# AI Query Builder — Natural Language to SQL

> **Since v8.0.0** — Convert natural language questions into SQL queries using any LLM provider via AiBridge.

## Overview

The `AIQueryBuilder` lets you ask questions about your database in plain English (or any language). It:

1. **Introspects** your database schema automatically (tables, columns, types, keys)
2. **Sends** the schema + your question to an LLM
3. **Returns** a parameterized SQL query (and optionally executes it)
4. **Safe mode** restricts to `SELECT` / `WITH` queries by default

## Quick Start

```javascript
const { AiBridgeManager, AIQueryBuilder, DatabaseConnection } = require('outlet-orm');

// Setup
const ai = new AiBridgeManager({
  providers: {
    openai: { api_key: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' }
  }
});
const db = new DatabaseConnection(); // auto-loads .env

const queryBuilder = new AIQueryBuilder(ai, db);

// Ask a question and execute
const result = await queryBuilder.query('How many users signed up last month?');

console.log(result.sql);         // SELECT COUNT(*) AS count FROM users WHERE ...
console.log(result.results);     // [{ count: 42 }]
console.log(result.explanation); // "This query counts users..."
```

---

## API Reference

### Constructor

```javascript
new AIQueryBuilder(manager, connection)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `manager` | `AiBridgeManager` | Configured AiBridge manager instance |
| `connection` | `DatabaseConnection` | Database connection instance |

### Methods

#### `using(provider, model)`

Set the LLM provider and model to use.

```javascript
queryBuilder.using('claude', 'claude-sonnet-4-20250514');
queryBuilder.using('openai', 'gpt-4o');
queryBuilder.using('ollama', 'llama3');
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `provider` | `string` | `'openai'` | Provider name |
| `model` | `string` | `'gpt-4o-mini'` | Model identifier |

Returns `this` (chainable).

---

#### `safeMode(safe)`

Enable or disable safe mode. When enabled, only `SELECT` and `WITH` queries are allowed.

```javascript
// Disable safe mode to allow INSERT, UPDATE, DELETE
queryBuilder.safeMode(false);

// Re-enable (default)
queryBuilder.safeMode(true);
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `safe` | `boolean` | `true` | Restrict to read-only queries |

Returns `this` (chainable).

---

#### `query(question, options)`

Convert a natural language question to SQL **and execute it** against the database.

```javascript
const result = await queryBuilder.query('Show me the top 5 users by post count');
```

**Returns:**

```javascript
{
  sql: 'SELECT u.name, COUNT(p.id) AS post_count FROM users u JOIN posts p ON ...',
  params: [],
  results: [{ name: 'Alice', post_count: 42 }, ...],
  explanation: 'This query joins users with posts and counts...',
  raw_response: { /* raw LLM response */ }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `sql` | `string` | Generated SQL query |
| `params` | `Array` | Query parameters (for parameterized queries) |
| `results` | `Array` | Query execution results |
| `explanation` | `string` | LLM's explanation of the query |
| `raw_response` | `Object` | Full raw LLM response |

---

#### `toSql(question, options)`

Generate SQL **without executing** it. Useful for review before execution.

```javascript
const { sql, params, explanation } = await queryBuilder.toSql(
  'Which products have never been ordered?'
);

console.log(sql);
// SELECT p.* FROM products p LEFT JOIN order_items oi ON p.id = oi.product_id WHERE oi.id IS NULL
```

**Returns:**

```javascript
{
  sql: 'SELECT ...',
  params: [],
  explanation: 'This query uses a LEFT JOIN to find products...'
}
```

---

## Configuration Details

### Schema Introspection

The AIQueryBuilder automatically introspects your database to provide schema context to the LLM. It supports:

| Driver | Method |
|--------|--------|
| **SQLite** | `PRAGMA table_list` + `PRAGMA table_info(table)` |
| **PostgreSQL** | `information_schema.tables` + `information_schema.columns` |
| **MySQL** | `SHOW TABLES` + `DESCRIBE table` |

### LLM Parameters

The query builder uses:
- **Temperature**: `0.1` (low for SQL accuracy)
- **Max tokens**: `1000`
- System prompt includes the full database schema and instructions for accurate SQL

---

## Examples

### Basic Queries

```javascript
// Simple count
const r1 = await qb.query('How many users are there?');

// Filtered query
const r2 = await qb.query('Show me all orders from this week');

// Aggregation
const r3 = await qb.query('What is the average order value by category?');

// Complex join
const r4 = await qb.query('List users who have not placed any orders');
```

### Using Different Providers

```javascript
// Use Claude
const r1 = await qb.using('claude', 'claude-sonnet-4-20250514')
  .query('Show me the most active users');

// Use local Ollama
const r2 = await qb.using('ollama', 'codellama')
  .query('List all tables with their row counts');
```

### Generate SQL Without Executing

```javascript
const { sql, explanation } = await qb.toSql(
  'Find duplicate email addresses in the users table'
);

console.log(sql);
// SELECT email, COUNT(*) as cnt FROM users GROUP BY email HAVING COUNT(*) > 1

// Review, then execute manually
const results = await db.executeRawQuery(sql);
```

### With MCP Server

The AI Query Builder is also available as an MCP tool (`ai_query`) for AI agents:

```json
{
  "name": "ai_query",
  "arguments": {
    "question": "How many users signed up this month?",
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
```

---

## Safety Considerations

- **Safe mode** (enabled by default) restricts queries to `SELECT` and `WITH` — no `INSERT`, `UPDATE`, `DELETE`, or `DROP`
- Always review generated SQL before executing with `safeMode(false)`
- The LLM sees your **schema structure** (table names, column names, types) but **never sees your data**
- Use parameterized queries when the LLM generates them
- For production, consider using read-only database credentials

---

## See Also

- [AiBridge Manager](AI_BRIDGE.md) — Multi-provider LLM configuration
- [AI Query Optimizer](AI_OPTIMIZER.md) — Optimize existing SQL queries
- [AI Seeder](AI_SEEDER.md) — Generate realistic test data
- [MCP Server](MCP.md) — Expose AI query as an MCP tool

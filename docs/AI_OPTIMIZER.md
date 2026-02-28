# AI Query Optimizer — LLM-Powered SQL Optimization

> **Since v8.0.0** — Analyze and optimize SQL queries using AI with index recommendations and rewrite suggestions.

## Overview

The `AIQueryOptimizer` uses LLM providers to:

- **Analyze** SQL queries for performance issues
- **Suggest** query rewrites and optimizations
- **Recommend** indexes to improve performance
- **Explain** execution plans in human-readable language

## Quick Start

```javascript
const { AiBridgeManager, AIQueryOptimizer, DatabaseConnection } = require('outlet-orm');

const ai = new AiBridgeManager({
  providers: {
    openai: { api_key: process.env.OPENAI_API_KEY, model: 'gpt-4o' }
  }
});
const db = new DatabaseConnection();

const optimizer = new AIQueryOptimizer(ai, db);

const result = await optimizer.optimize(
  'SELECT * FROM orders WHERE user_id IN (SELECT id FROM users WHERE status = "active")'
);

console.log(result.optimized);    // Rewritten SQL
console.log(result.suggestions);  // Array of optimization suggestions
console.log(result.indexes);      // Recommended CREATE INDEX statements
```

---

## API Reference

### Constructor

```javascript
new AIQueryOptimizer(manager, connection)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `manager` | `AiBridgeManager` | Configured AiBridge manager |
| `connection` | `DatabaseConnection` | Database connection |

### Methods

#### `using(provider, model)`

Set the LLM provider and model.

```javascript
optimizer.using('openai', 'gpt-4o');
optimizer.using('claude', 'claude-sonnet-4-20250514');
```

Returns `this` (chainable).

---

#### `optimize(sql, options)`

Analyze a SQL query and return optimization suggestions.

```javascript
const result = await optimizer.optimize(
  'SELECT u.*, COUNT(o.id) FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id'
);
```

**Returns:**

```javascript
{
  original: 'SELECT u.*, COUNT(o.id) FROM users u LEFT JOIN orders o ON ...',

  optimized: 'SELECT u.id, u.name, u.email, COUNT(o.id) AS order_count FROM users u LEFT JOIN orders o ON ...',

  suggestions: [
    {
      type: 'select',
      description: 'Replace SELECT * with explicit columns to reduce data transfer',
      impact: 'medium'
    },
    {
      type: 'index',
      description: 'Add index on orders.user_id for faster JOIN performance',
      impact: 'high'
    }
  ],

  explanation: 'The query joins users with orders to count orders per user...',

  indexes: [
    'CREATE INDEX idx_orders_user_id ON orders (user_id);'
  ],

  raw_response: { /* full LLM response */ }
}
```

**Response properties:**

| Property | Type | Description |
|----------|------|-------------|
| `original` | `string` | Original SQL query |
| `optimized` | `string` | Optimized/rewritten SQL query |
| `suggestions` | `Array` | List of optimization suggestions |
| `explanation` | `string` | Human-readable analysis |
| `indexes` | `Array<string>` | Recommended `CREATE INDEX` statements |
| `raw_response` | `Object` | Full LLM response |

**Suggestion format:**

| Property | Type | Values |
|----------|------|--------|
| `type` | `string` | Type of optimization (`'select'`, `'index'`, `'join'`, `'subquery'`, `'where'`, etc.) |
| `description` | `string` | Human-readable suggestion |
| `impact` | `string` | `'high'`, `'medium'`, or `'low'` |

---

#### `explain(sql)`

Run `EXPLAIN` on a SQL query and get an LLM analysis of the execution plan.

```javascript
const result = await optimizer.explain(
  'SELECT * FROM users WHERE email LIKE "%@gmail.com"'
);

console.log(result.plan);     // Raw EXPLAIN output
console.log(result.analysis); // LLM interpretation
```

**Returns:**

```javascript
{
  plan: [
    { id: 1, select_type: 'SIMPLE', table: 'users', type: 'ALL', rows: 10000, ... }
  ],
  analysis: 'This query performs a full table scan (type: ALL) because the LIKE pattern starts with a wildcard (%). Consider using a full-text index or restructuring the query to avoid leading wildcards.'
}
```

| Property | Type | Description |
|----------|------|-------------|
| `plan` | `Array` | Raw EXPLAIN output from the database |
| `analysis` | `string` | LLM interpretation of the execution plan |

---

## Examples

### Optimizing a Slow Query

```javascript
const result = await optimizer.optimize(`
  SELECT *
  FROM products p
  WHERE p.category_id IN (
    SELECT c.id FROM categories c WHERE c.name LIKE '%electronics%'
  )
  AND p.price > 100
  ORDER BY p.created_at DESC
`);

// result.optimized might suggest:
// SELECT p.id, p.name, p.price, p.created_at
// FROM products p
// INNER JOIN categories c ON p.category_id = c.id
// WHERE c.name LIKE '%electronics%'
//   AND p.price > 100
// ORDER BY p.created_at DESC

// result.suggestions:
// [
//   { type: 'select', description: 'Avoid SELECT * — specify needed columns', impact: 'medium' },
//   { type: 'subquery', description: 'Replace IN subquery with JOIN for better performance', impact: 'high' },
//   { type: 'index', description: 'Add composite index on (category_id, price, created_at)', impact: 'high' }
// ]
```

### Analyzing an Execution Plan

```javascript
const { plan, analysis } = await optimizer.explain(
  'SELECT o.*, u.name FROM orders o JOIN users u ON o.user_id = u.id WHERE o.status = "pending" ORDER BY o.created_at'
);

console.log(analysis);
// "The query uses an index lookup on orders.status but performs a filesort for ORDER BY.
//  Consider adding a composite index on orders(status, created_at) to eliminate the sort operation.
//  The JOIN to users uses the primary key, which is efficient."
```

### Using with MCP Server

The optimizer is available as an MCP tool (`query_optimize`) for AI agents:

```json
{
  "name": "query_optimize",
  "arguments": {
    "sql": "SELECT * FROM users WHERE status = 'active'",
    "provider": "openai"
  }
}
```

### Using Different Providers

```javascript
// GPT-4o for detailed analysis
const r1 = await optimizer
  .using('openai', 'gpt-4o')
  .optimize(sql);

// Claude for alternative perspective
const r2 = await optimizer
  .using('claude', 'claude-sonnet-4-20250514')
  .optimize(sql);

// Compare suggestions from both
```

---

## Common Optimizations Detected

| Issue | Impact | Typical Suggestion |
|-------|--------|--------------------|
| `SELECT *` | Medium | Specify explicit columns |
| Missing indexes on JOIN columns | High | `CREATE INDEX` on foreign keys |
| `IN` subquery | High | Rewrite as `JOIN` |
| Leading wildcard `LIKE '%...'` | High | Use full-text search |
| Missing composite index | High | Create composite index for WHERE + ORDER |
| `ORDER BY` without index | Medium | Add index matching sort columns |
| `N+1` query patterns | High | Use JOINs or subqueries |
| Unnecessary `DISTINCT` | Low | Review if `DISTINCT` is needed |
| Large `OFFSET` pagination | Medium | Use keyset pagination |

---

## Best Practices

1. **Optimize slow queries first** — Focus on queries that appear in slow query logs
2. **Review before applying** — Always review suggested indexes and rewrites before applying
3. **Use EXPLAIN** — The `explain()` method provides database-specific execution plan analysis
4. **Test with production-like data** — Optimization suggestions are most relevant with realistic data volumes
5. **Consider your workload** — Adding indexes speeds up reads but slows down writes

---

## See Also

- [AiBridge Manager](AI_BRIDGE.md) — Multi-provider LLM configuration
- [AI Query Builder](AI_QUERY.md) — Natural language to SQL
- [Query Builder](QUERY_BUILDER.md) — Standard query building
- [MCP Server](MCP.md) — Expose optimizer as an MCP tool

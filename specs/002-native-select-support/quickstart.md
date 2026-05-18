# Quickstart: StandaloneQueryBuilder

**Feature**: `002-native-select-support`  
**Date**: 2026-05-18

`StandaloneQueryBuilder` lets you run fluent SELECT queries against any table without defining a Model. Access it via `db.from('table')` on a `DatabaseConnection` instance.

---

## Setup

```js
const { DatabaseConnection } = require('outlet-orm');

const db = new DatabaseConnection({
  driver: 'mysql',
  host: 'localhost',
  database: 'my_app',
  user: 'root',
  password: ''
});
await db.connect();
```

---

## User Story 1 — Basic SELECT with WHERE, ORDER BY, LIMIT

*"I want to query a reporting table without creating a Model."*

```js
const rows = await db.from('orders')
  .select('id', 'customer_id', 'total', 'status')
  .where('status', 'paid')
  .orderBy('created_at', 'desc')
  .limit(20)
  .get();

// rows → [{ id: 42, customer_id: 7, total: '199.99', status: 'paid' }, ...]
```

---

## User Story 2 — COUNT and aggregate shortcuts

*"I want row counts without fetching all rows."*

```js
// Count all paid orders
const paidCount = await db.from('orders').where('status', 'paid').count();
// paidCount → 148

// Total revenue from shipped orders
const revenue = await db.from('orders').where('status', 'shipped').sum('total');
// revenue → 9847.50

// Average order value
const avg = await db.from('orders').avg('total');
// avg → 66.54

// Highest single order
const max = await db.from('orders').max('total');
// max → 1250.00
```

---

## User Story 3 — GROUP BY with HAVING

*"I want sales grouped by region, filtered to regions with meaningful volume."*

```js
const byRegion = await db.from('sales')
  .select('region')
  .selectRaw('SUM(amount) AS total_amount')
  .groupBy('region')
  .having('total_amount', '>', 1000)
  .orderBy('total_amount', 'desc')
  .get();

// byRegion → [{ region: 'North', total_amount: '4500.00' }, ...]
```

Using raw HAVING:
```js
const popularRegions = await db.from('sales')
  .select('region')
  .groupBy('region')
  .havingRaw('COUNT(*) > ?', [50])
  .get();
```

---

## User Story 4 — JOIN across tables

```js
const joined = await db.from('orders')
  .select('orders.id', 'customers.name', 'orders.total')
  .join('customers', 'orders.customer_id', '=', 'customers.id')
  .where('orders.status', 'active')
  .orderBy('orders.created_at', 'desc')
  .get();
```

Left join:
```js
const withOptionalProfile = await db.from('users')
  .select('users.id', 'users.email', 'profiles.bio')
  .leftJoin('profiles', 'users.id', '=', 'profiles.user_id')
  .get();
```

---

## Raw expressions

For SQL functions or expressions that `sanitizeIdentifier` would reject, use `RawExpression`:

```js
const { RawExpression } = require('outlet-orm');

// Raw in FROM (subquery)
const sub = new RawExpression('(SELECT id, SUM(total) AS revenue FROM orders GROUP BY id) AS sub');
const result = await db.from(sub).select('id', 'revenue').where('revenue', '>', 500).get();

// Equivalent using nested builder
const inner = db.from('orders')
  .select('id')
  .selectRaw('SUM(total) AS revenue')
  .groupBy('id');

const outer = await db.from(inner)
  .where('revenue', '>', 500)
  .get();
```

---

## Schema introspection

```js
const schema = db.schema();

// Check if a table exists
const exists = await schema.tableExists('audit_logs');
// exists → true | false

// Check if a specific column exists
const hasCol = await schema.columnExists('users', 'deleted_at');
// hasCol → true | false

// List all tables in the database
const tables = await schema.listTables();
// tables → ['users', 'orders', 'products', 'migrations', ...]
```

---

## DISTINCT

```js
const statuses = await db.from('orders').select('status').distinct().get();
// statuses → [{ status: 'paid' }, { status: 'pending' }, { status: 'shipped' }]
```

---

## Pagination with offset

```js
const page2 = await db.from('products')
  .select('id', 'name', 'price')
  .where('active', 1)
  .orderBy('name')
  .limit(25)
  .offset(25)
  .get();
```

---

## .first() — single row

```js
const latest = await db.from('events')
  .where('user_id', 42)
  .orderBy('created_at', 'desc')
  .first();

if (!latest) {
  console.log('No events found');
}
```

---

## Single-use enforcement

Each `StandaloneQueryBuilder` instance may only be executed once. Create a new instance for each query:

```js
const builder = db.from('orders').where('status', 'paid');

const rows1 = await builder.get();         // ✅ OK

const rows2 = await builder.get();         // ❌ throws QueryBuilderError
// QueryBuilderError: This query builder instance has already been executed.
//   Create a new instance via db.from().
```

---

## Error handling

```js
const { QueryBuilderError } = require('outlet-orm');

try {
  const rows = await db.from('orders').get();
} catch (err) {
  if (err instanceof QueryBuilderError) {
    // Builder misconfiguration — wrong arguments, reuse, etc.
    console.error('Query builder error:', err.message);
  } else {
    // Driver / network / SQL syntax error
    console.error('Database error:', err.message, err.code);
  }
}
```

---

## TypeScript

```ts
import { DatabaseConnection, StandaloneQueryBuilder, QueryBuilderError } from 'outlet-orm';

const db = new DatabaseConnection({ /* ... */ });

const rows: Record<string, unknown>[] = await db.from('orders')
  .select('id', 'total')
  .where('status', 'paid')
  .get();
```

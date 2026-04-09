# Outlet ORM - Query Builder

[← Back to Index](SKILL.md) | [Previous: Models](MODELS.md) | [Next: Relationships →](RELATIONS.md)

> 📘 **TypeScript** : The`WhereOperator`type defines all available operators (`=`,`!=`,`>`,`<`,`LIKE`, etc.). See [TYPESCRIPT.md](TYPESCRIPT.md)

---

## Basic Queries

```javascript
// All records
const users = await User.all();

// Find by ID
const user = await User.find(1);
const user = await User.findOrFail(1);

// First record
const user = await User.first();
const user = await User.firstOrFail();

// Get with conditions
const users = await User.where('status', 'active').get();
```

---

## WHERE Clauses

### Basic WHERE

```javascript
// Equality
const users = await User.where('name', 'John').get();

// With operator
const users = await User.where('age', '>', 18).get();
const users = await User.where('age', '>=', 21).get();
const users = await User.where('age', '<', 65).get();
const users = await User.where('status', '!=', 'banned').get();

// LIKE
const users = await User.where('email', 'LIKE', '%@example.com').get();
```

### Chaining WHERE

```javascript
const users = await User
  .where('age', '>', 18)
  .where('status', 'active')
  .where('role', 'user')
  .get();
```

### OR WHERE

```javascript
const users = await User
  .where('role', 'admin')
  .orWhere('role', 'moderator')
  .get();
```

### WHERE IN / NOT IN

```javascript
// WHERE IN
const users = await User.whereIn('id', [1, 2, 3, 4, 5]).get();
const users = await User.whereIn('status', ['active', 'pending']).get();

// WHERE NOT IN
const users = await User.whereNotIn('status', ['banned', 'deleted']).get();
```

### WHERE NULL / NOT NULL

```javascript
// NULL
const users = await User.whereNull('deleted_at').get();
const unverified = await User.whereNull('email_verified_at').get();

// NOT NULL
const verified = await User.whereNotNull('email_verified_at').get();
```

### WHERE BETWEEN

```javascript
const adults = await User.whereBetween('age', [18, 65]).get();
const recent = await User.whereBetween('created_at', ['2024-01-01', '2024-12-31']).get();
```

### WHERE LIKE

```javascript
const johns = await User.whereLike('name', '%john%').get();
const gmails = await User.whereLike('email', '%@gmail.com').get();
```

---

## Selecting Columns

```javascript
// Select specific columns
const users = await User
  .select('id', 'name', 'email')
  .get();

// Alternative syntax
const users = await User
  .columns(['id', 'name', 'email'])
  .get();

// With alias
const users = await User
  .select('id', 'name', 'email as user_email')
  .get();

// Distinct
const roles = await User
  .distinct()
  .select('role')
  .get();
```

---

## Ordering

```javascript
// Ascending (default)
const users = await User.orderBy('name').get();
const users = await User.orderBy('name', 'asc').get();

// Descending
const users = await User.orderBy('created_at', 'desc').get();

// Multiple columns
const users = await User
  .orderBy('role', 'asc')
  .orderBy('name', 'asc')
  .get();

// Alias (ordrer - typo preserved for compatibility)
const users = await User.ordrer('name', 'asc').get();
```

---

## Limiting & Offset

```javascript
// Limit
const users = await User.limit(10).get();
const users = await User.take(10).get(); // Alias

// Offset
const users = await User.offset(20).get();
const users = await User.skip(20).get(); // Alias

// Combined (for manual pagination)
const users = await User
  .orderBy('id')
  .limit(10)
  .offset(20)
  .get();
```

---

## Pagination

```javascript
const result = await User.paginate(1, 15); // page 1, 15 per page

console.log(result);
// {
//   data: [...],          // Array of users
//   total: 100,           // Total records
//   per_page: 15,         // Records per page
//   current_page: 1,      // Current page
//   last_page: 7,         // Last page number
//   from: 1,              // First record index
//   to: 15                // Last record index
// }

// Next page
const page2 = await User.paginate(2, 15);
```

---

## Aggregations

### Count

```javascript
const count = await User.count();
const activeCount = await User.where('status', 'active').count();
```

### Exists

```javascript
const hasAdmins = await User.where('role', 'admin').exists();
if (hasAdmins) {
  console.log('Admin users exist');
}
```

### Sum / Avg / Min / Max (v11.0.0)

```javascript
const totalBalance = await User.query().sum('balance');
const averageAge = await User.query().avg('age');
const youngest = await User.query().min('age');
const oldest = await User.query().max('age');

// With conditions
const activeTotal = await User.where('status', 'active').sum('balance');
```

### Pluck / Value (v11.0.0)

```javascript
// pluck() — get an array of values from a single column
const emails = await User.query().pluck('email');
// ['john@example.com', 'jane@example.com', ...]

// value() — get a single value from the first row
const name = await User.where('id', 1).value('name');
// 'John Doe'
```

### Group By & Having

```javascript
const stats = await User
  .select('status', 'COUNT(*) as count')
  .groupBy('status')
  .get();

const popular = await User
  .select('role', 'COUNT(*) as count')
  .groupBy('role')
  .having('COUNT(*)', '>', 5)
  .get();
```

---

## Joins

### Inner Join

```javascript
const result = await User
  .join('profiles', 'users.id', 'profiles.user_id')
  .select('users.*', 'profiles.bio')
  .get();
```

### Left Join

```javascript
const result = await User
  .leftJoin('profiles', 'users.id', 'profiles.user_id')
  .select('users.*', 'profiles.bio')
  .get();
```

### Multiple Joins

```javascript
const result = await User
  .join('profiles', 'users.id', 'profiles.user_id')
  .leftJoin('countries', 'profiles.country_id', 'countries.id')
  .select('users.*', 'profiles.bio', 'countries.name as country')
  .get();
```

---

## Increment / Decrement

Atomic operations for counters:

```javascript
// Increment by 1
await User.where('id', 1).increment('login_count');

// Increment by N
await User.where('id', 1).increment('points', 10);

// Decrement by 1
await User.where('id', 1).decrement('credits');

// Decrement by N
await User.where('id', 1).decrement('credits', 50);
```

---

## Batch Processing — chunk() (v11.0.0)

Process large datasets in manageable batches:

```javascript
// Process 100 records at a time
await User.query().chunk(100, async (users) => {
  for (const user of users) {
    await sendNewsletter(user);
  }
});

// With conditions
await User.where('status', 'active').chunk(50, async (batch) => {
  console.log(`Processing ${batch.length} users`);
});
```

---

## Conditional Queries — when() / tap() (v11.0.0)

### when()

Conditionally apply query clauses:

```javascript
const status = req.query.status; // may be undefined

const users = await User.query()
  .when(status, (query, value) => query.where('status', value))
  .when(req.query.role, (query, value) => query.where('role', value))
  .get();
```

### tap()

Execute a callback for debugging without modifying the query:

```javascript
const users = await User.query()
  .where('status', 'active')
  .tap((query) => console.log('Query so far:', query.toSQL()))
  .orderBy('name')
  .get();
```

---

## Query Debugging — toSQL() / dd() (v11.0.0)

```javascript
// toSQL() — get the SQL string and bindings
const { sql, bindings } = User.where('status', 'active').toSQL();
console.log(sql);      // 'SELECT * FROM users WHERE status = ?'
console.log(bindings); // ['active']

// dd() — dump and die (logs to console and throws)
User.where('status', 'active').dd();
// Logs: { sql: '...', bindings: [...] } then throws
```

---

## Fluent Local Scopes (v11.0.0)

Define reusable query constraints as static methods on the model:

```javascript
class User extends Model {
  static table = 'users';

  // Define scope as static scopeXxx(query, ...params)
  static scopeActive(query) {
    return query.where('status', 'active');
  }

  static scopeRole(query, role) {
    return query.where('role', role);
  }

  static scopeRecent(query, days = 7) {
    const date = new Date(Date.now() - days * 86400000).toISOString();
    return query.where('created_at', '>', date);
  }
}

// Use fluently on the query builder
const users = await User.query().active().role('admin').recent(30).get();

// Combine with other query methods
const count = await User.query().active().count();
```

> See [ADVANCED.md](ADVANCED.md) for more details on global and local scopes.

---

## Raw Queries

```javascript
const db = Model.getConnection();

// Normalised results (cross-database)
const results = await db.executeRawQuery(
  'SELECT * FROM users WHERE age > ?',
  [18]
);

// Native driver results
const native = await db.execute(
  'SELECT * FROM users WHERE status = ?',
  ['active']
);
```

---

## AI Query Builder — Natural Language to SQL

> Since v8.0.0

Convert natural language into SQL queries using any LLM provider via AI.

```javascript
const { AIManager, AIQueryBuilder, DatabaseConnection } = require('outlet-orm');

const ai = new AIManager({ providers: { openai: { api_key: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' } } });
const db = new DatabaseConnection();
const qb = new AIQueryBuilder(ai, db);

// Convert and execute
const result = await qb.query('How many users signed up last month?');
console.log(result.sql);     // SELECT COUNT(*) ...
console.log(result.results); // [{ count: 42 }]

// Generate SQL without executing
const { sql } = await qb.toSql('Find duplicate emails');

// Use a specific provider
const r = await qb.using('claude', 'claude-sonnet-4-20250514')
  .query('List users without orders');

// Disable safe mode (allow writes)
qb.safeMode(false);
```

### AI Query Builder Methods

| Method | Returns | Description |
|--------|---------|-------------|
|`using(provider, model)`| `this` | Set LLM provider |
|`safeMode(bool)`| `this` | Restrict to SELECT/WITH (default: `true`) |
|`query(question)`| `{ sql, params, results, explanation }` | NL → SQL + execute |
|`toSql(question)`| `{ sql, params, explanation }` | NL → SQL only |

See [AI.md](AI.md) for full details.

---

## AI Query Optimizer

> Since v8.0.0

Analyze and optimize SQL queries with AI.

```javascript
const { AIQueryOptimizer } = require('outlet-orm');

const optimizer = new AIQueryOptimizer(ai, db);
const result = await optimizer.optimize('SELECT * FROM orders WHERE ...');
console.log(result.optimized);   // Rewritten SQL
console.log(result.suggestions); // [{ type, description, impact }]
console.log(result.indexes);     // ['CREATE INDEX ...']

const { plan, analysis } = await optimizer.explain('SELECT ...');
```

See [AI.md](AI.md) for full details.

---

## Query Builder Methods Summary

| Method | Description |
|--------|-------------|
|`select(...cols)`| Select columns |
|`columns([...])`| Select columns (alias) |
|`distinct()`| SELECT DISTINCT |
|`where(col, op?, val)`| WHERE clause |
|`orWhere(col, op?, val)`| OR WHERE |
|`whereIn(col, vals)`| WHERE IN |
|`whereNotIn(col, vals)`| WHERE NOT IN |
|`whereNull(col)`| WHERE IS NULL |
|`whereNotNull(col)`| WHERE IS NOT NULL |
|`whereBetween(col, [min, max])`| WHERE BETWEEN |
|`whereLike(col, pattern)`| WHERE LIKE |
|`orderBy(col, dir?)`| ORDER BY |
|`limit(n)`/`take(n)`| LIMIT |
|`offset(n)`/`skip(n)`| OFFSET |
|`groupBy(...cols)`| GROUP BY |
|`having(col, op, val)`| HAVING |
|`join(table, col1, op?, col2)`| INNER JOIN |
|`leftJoin(table, col1, op?, col2)`| LEFT JOIN |
|`get()`| Execute and get all |
|`first()`| Get first result |
|`firstOrFail()`| First or throw |
|`find(id)`| Find by ID |
|`findOrFail(id)`| Find or throw |
|`paginate(page, perPage)`| Pagination |
|`count()`| Count results |
|`exists()`| Check existence |
|`sum(col)`| Sum of column (v11) |
|`avg(col)`| Average of column (v11) |
|`min(col)`| Minimum of column (v11) |
|`max(col)`| Maximum of column (v11) |
|`pluck(col)`| Array of column values (v11) |
|`value(col)`| Single value from first row (v11) |
|`chunk(size, callback)`| Batch processing (v11) |
|`when(condition, callback)`| Conditional clause (v11) |
|`tap(callback)`| Debug callback (v11) |
|`toSQL()`| Get SQL + bindings (v11) |
|`dd()`| Dump & die debug (v11) |
|`insert(data)`| Insert record(s) |
|`update(attrs)`| Update records |
|`delete()`| Delete records |
|`increment(col, amount?)`| Atomic increment |
|`decrement(col, amount?)`| Atomic decrement |
|`clone()`| Clone query builder |

---

## Next Steps

- [Relationships & Eager Loading →](RELATIONS.md)
- [Advanced Features →](ADVANCED.md)

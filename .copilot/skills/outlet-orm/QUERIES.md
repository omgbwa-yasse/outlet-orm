# Outlet ORM - Query Builder

[← Back to Index](SKILL.md) | [Previous: Models](MODELS.md) | [Next: Relations →](RELATIONS.md)

> 📘 **TypeScript** : The `WhereOperator` type defines all available operators (`=`, `!=`, `>`, `<`, `LIKE`, etc.). See [TYPESCRIPT.md](TYPESCRIPT.md)

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

## Raw Queries

```javascript
const db = Model.getConnection();

// Normalized results (cross-database)
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

## Query Builder Methods Summary

| Method | Description |
|--------|-------------|
| `select(...cols)` | Select columns |
| `columns([...])` | Select columns (alias) |
| `distinct()` | SELECT DISTINCT |
| `where(col, op?, val)` | WHERE clause |
| `orWhere(col, op?, val)` | OR WHERE |
| `whereIn(col, vals)` | WHERE IN |
| `whereNotIn(col, vals)` | WHERE NOT IN |
| `whereNull(col)` | WHERE IS NULL |
| `whereNotNull(col)` | WHERE IS NOT NULL |
| `whereBetween(col, [min, max])` | WHERE BETWEEN |
| `whereLike(col, pattern)` | WHERE LIKE |
| `orderBy(col, dir?)` | ORDER BY |
| `limit(n)` / `take(n)` | LIMIT |
| `offset(n)` / `skip(n)` | OFFSET |
| `groupBy(...cols)` | GROUP BY |
| `having(col, op, val)` | HAVING |
| `join(table, col1, op?, col2)` | INNER JOIN |
| `leftJoin(table, col1, op?, col2)` | LEFT JOIN |
| `get()` | Execute and get all |
| `first()` | Get first result |
| `firstOrFail()` | First or throw |
| `find(id)` | Find by ID |
| `findOrFail(id)` | Find or throw |
| `paginate(page, perPage)` | Pagination |
| `count()` | Count results |
| `exists()` | Check existence |
| `insert(data)` | Insert record(s) |
| `update(attrs)` | Update records |
| `delete()` | Delete records |
| `increment(col, amount?)` | Atomic increment |
| `decrement(col, amount?)` | Atomic decrement |
| `clone()` | Clone query builder |

---

## Next Steps

- [Relations & Eager Loading →](RELATIONS.md)
- [Advanced Features →](ADVANCED.md)

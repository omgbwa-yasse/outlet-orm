# 🔍 Query Builder

Outlet ORM's Query Builder offers a fluid interface for building SQL queries.

> 📁 **Use**: In your files`models/`,`controllers/`,`services/`or`src/`— See [Project structure](INSTALLATION.md#structure-de-projet-recommended)
>
> 📘 **TypeScript**: The type`WhereOperator`defines all available operators. See [TYPESCRIPT.md](TYPESCRIPT.md)

## Table of Contents

- [Basic Usage](#basic-usage)
- [Column selection](#column-selection)
- [Clauses WHERE](#clauses-where)
  - [Where simple](#where-simple)
  - [Where OR](#where-or)
  - [Where IN](#where-in)
  - [Where NULL](#where-null)
  - [Where BETWEEN](#where-between)
  - [Where LIKE](#where-like)
  - [Where RAW](#where-raw)
  - [Where grouped](#where-grouped)
- [Try an order](#try-an-order)
- [Limit and offset](#limit-and-offset)
- [Aggregations](#aggregations)
- [Group By et Having](#group-by-et-having)
- [Distinct](#distinct)
- [Joins](#joins)
- [Subqueries](#subqueries)
- [Execution](#execution)
  - [Retrieve results](#retrieve-results)
  - [Check for existence](#check-for-existence)
  - [Retrieve a column](#retrieve-a-column)
- [Update](#update)
- [Suppression](#suppression)
- [Transactions (see TRANSACTIONS.md)](#transactions-see-transactionsmd)
- [Debug et logging](#debug-et-logging)
- [Integrated pagination](#integrated-pagination)
- [Soft Deletes in Query Builder](#soft-deletes-in-query-builder)
- [Scopes in Query Builder](#scopes-in-query-builder)
- [Chain methods](#chain-methods)
- [Convenience Methods (v6.5.0+)](#convenience-methods-v650)
  - [firstOrCreate / firstOrNew](#firstorcreate-firstornew)
  - [updateOrCreate](#updateorcreate)
  - [upsert (bulk INSERT … ON CONFLICT)](#upsert-bulk-insert-on-conflict)
  - [cursor — Lazy Iteration (Async Generator)](#cursor-lazy-iteration-async-generator)
- [Next steps](#next-steps)

---

## Basic Usage

```javascript
const { Model } = require('outlet-orm');

// Via a template (recommended)
const users = await User.query()
  .where('status', 'active')
  .get();

// Or with QueryBuilder directly (advanced)
const { QueryBuilder } = require('outlet-orm');
const db = Model.getConnection();
const qb = new QueryBuilder(db, 'users');
```

## Column selection

```javascript
// All columns
const users = await User.select('*').get();

// Specific columns
const users = await User.select('id', 'name', 'email').get();

// With alias
const users = await User.select('id', 'name AS username').get();

// RAW expression
const users = await User.select('*', 'COUNT(*) as total').get();
```

## Clauses WHERE

### Where simple

```javascript
// Equality
User.where('status', 'active');
User.where('status', '=', 'active');

// Comparisons
User.where('age', '>', 18);
User.where('price', '<=', 100);
User.where('email', '!=', 'spam@example.com');

// Chain multiple where (AND)
User.where('status', 'active').where('role', 'admin');
```

### Where OR

```javascript
User.where('role', 'admin')
    .orWhere('role', 'moderator');
// WHERE role = 'admin' OR role = 'moderator'
```

### Where IN

```javascript
User.whereIn('id', [1, 2, 3, 4, 5]);
// WHERE id IN (1, 2, 3, 4, 5)

User.whereNotIn('status', ['banned', 'suspended']);
// WHERE status NOT IN ('banned', 'suspended')
```

### Where NULL

```javascript
User.whereNull('deleted_at');
// WHERE deleted_at IS NULL

User.whereNotNull('email_verified_at');
// WHERE email_verified_at IS NOT NULL
```

### Where BETWEEN

```javascript
User.whereBetween('age', 18, 65);
// WHERE age BETWEEN 18 AND 65

User.whereNotBetween('price', 0, 10);
// WHERE price NOT BETWEEN 0 AND 10
```

### Where LIKE

```javascript
User.whereLike('name', '%john%');
// WHERE name LIKE '%john%'

User.whereLike('email', '%@gmail.com');
// WHERE email LIKE '%@gmail.com'
```

### Where RAW

```javascript
User.whereRaw('YEAR(created_at) = ?', [2024]);
// WHERE YEAR(created_at) = 2024

User.whereRaw('age > ? AND age < ?', [18, 65]);
```

### Where grouped

```javascript
User.where('status', 'active')
    .where(builder => {
      builder.where('role', 'admin')
             .orWhere('role', 'moderator');
    });
// WHERE status = 'active' AND (role = 'admin' OR role = 'moderator')
```

## Try an order

```javascript
// Ascending order
User.orderBy('name', 'asc');

// Descending order
User.orderBy('created_at', 'desc');

// Multiple
User.orderBy('status', 'asc').orderBy('name', 'asc');

// Latest (shortcut for orderBy created_at desc)
User.latest();

// Oldest (shortcut for orderBy created_at asc)
User.oldest();
```

## Limit and offset

```javascript
// Limit the number of results
User.limit(10);

// Offset for paging
User.offset(20);

// Both together
User.limit(10).offset(20); // Page 3 with 10 per page

// Take (aka limit)
User.take(5);

// Skip (aka offset)
User.skip(10);
```

## Aggregations

```javascript
// Count
const total = await User.where('status', 'active').count();

// Maximum
const maxAge = await User.max('age');

// Minimum
const minPrice = await Product.min('price');

// Somme
const totalRevenue = await Order.sum('amount');

// Average
const avgRating = await Review.avg('rating');
```

## Group By et Having

```javascript
const stats = await Order
  .select('status', 'COUNT(*) as count', 'SUM(amount) as total')
  .groupBy('status')
  .having('count', '>', 10)
  .get();
```

## Distinct

```javascript
const countries = await User.select('country').distinct().get();
```

## Joins

```javascript
// Inner Join
User.join('orders', 'users.id', '=', 'orders.user_id');

// Left Join
User.leftJoin('profiles', 'users.id', '=', 'profiles.user_id');

// Right Join
User.rightJoin('departments', 'users.dept_id', '=', 'departments.id');
```

## Subqueries

```javascript
// Where with subquery
User.whereIn('id', subQuery => {
  return subQuery.select('user_id').from('orders').where('amount', '>', 100);
});
```

## Execution

### Retrieve results

```javascript
// All results
const users = await User.where('status', 'active').get();

// First result
const user = await User.where('email', 'john@example.com').first();

// Par ID
const user = await User.find(1);

// All without filters
const all = await User.all();
```

### Check for existence

```javascript
const hasActive = await User.where('status', 'active').exists();
// true or false

const isEmpty = await User.where('status', 'deleted').doesntExist();
// true or false
```

### Retrieve a column

```javascript
// Email list only
const emails = await User.pluck('email');
// ['john@example.com', 'jane@example.com', ...]
```

## Update

```javascript
// Update a lot
await User.where('status', 'pending')
          .where('created_at', '<', '2024-01-01')
          .update({ status: 'expired' });

// Increment
await Product.where('id', 1).increment('views');
await Product.where('id', 1).increment('views', 10);

// Decrement
await Product.where('id', 1).decrement('stock');
await Product.where('id', 1).decrement('stock', 5);
```

## Suppression

```javascript
// Bulk Delete
await User.where('status', 'inactive')
          .where('last_login', '<', '2023-01-01')
          .delete();

// Truncate (remove all)
await User.truncate();
```

## Transactions (see TRANSACTIONS.md)

```javascript
const db = Model.getConnection();

await db.transaction(async (trx) => {
  await User.useTransaction(trx).create({ name: 'John' });
  await Profile.useTransaction(trx).create({ user_id: 1 });
  // Automatic commit if no errors
});
```

## Debug et logging

```javascript
// Get generated SQL (without executing)
const sql = User.where('status', 'active').toSQL();
console.log(sql);
// { sql: 'SELECT * FROM users WHERE status = ?', bindings: ['active'] }
```

## Integrated pagination

```javascript
// Page 1, 15 items per page
const result = await User.paginate(1, 15);

// Result
{
  data: [User, User, ...],   // Page Templates
  total: 150,                // Total name
  per_page: 15,              // Per page
  current_page: 1,           // Current page
  last_page: 10,             // Last page
  from: 1,                   // Index start
  to: 15                     // Index fin
}
```

## Soft Deletes in Query Builder

When a model has`softDeletes = true`:

```javascript
// By default, deleted ones are excluded
const users = await User.get(); // Exclut deleted_at NOT NULL

// Include deleted
const allUsers = await User.withTrashed().get();

// Only the deleted ones
const deletedUsers = await User.onlyTrashed().get();
```

## Scopes in Query Builder

```javascript
class User extends Model {
  static scopes = {
    active: (query) => query.where('status', 'active'),
    verified: (query) => query.whereNotNull('email_verified_at'),
    recent: (query) => query.where('created_at', '>', '2024-01-01')
  };
}

// Use scopes
const users = await User.scope('active', 'verified').get();
const recentActive = await User.scope('active', 'recent').get();
```

## Chain methods

```javascript
const results = await User
  .select('id', 'name', 'email', 'status')
  .where('status', 'active')
  .whereNotNull('email_verified_at')
  .whereBetween('age', 18, 65)
  .whereIn('country', ['US', 'CA', 'UK'])
  .orderBy('created_at', 'desc')
  .limit(20)
  .offset(0)
  .with('posts', 'profile')
  .get();
```

## Convenience Methods (v6.5.0+)

### firstOrCreate / firstOrNew

```javascript
// Creates a new record if no match, returns existing if found
const user = await User.firstOrCreate(
  { email: 'john@example.com' },         // search conditions
  { name: 'John', age: 30 }              // extra values for creation
);

// Same, but returns an unsaved instance when not found
const user = await User.firstOrNew(
  { email: 'john@example.com' },
  { name: 'John', age: 30 }
);
if (!user.exists) await user.save();

// Also available on QueryBuilder
const user = await User.where('email', 'john@example.com')
  .firstOrCreate({ name: 'John', age: 30 });
```

### updateOrCreate

```javascript
// Finds and updates, or creates a new record
const user = await User.updateOrCreate(
  { email: 'john@example.com' },         // search conditions
  { name: 'John Updated', age: 31 }      // values to update or create with
);

// Also via QueryBuilder
const user = await User.where('email', 'john@example.com')
  .updateOrCreate({ age: 31 });
```

### upsert (bulk INSERT … ON CONFLICT)

```javascript
// Bulk upsert with conflict resolution
await Product.upsert(
  [
    { sku: 'WIDGET-001', name: 'Widget v2', price: 12.99 },
    { sku: 'GADGET-001', name: 'Gadget', price: 19.99 }
  ],
  'sku',                    // unique column(s) — string or array
  ['name', 'price']         // columns to update on conflict
);
```

### cursor — Lazy Iteration (Async Generator)

```javascript
// Process large datasets with minimal memory footprint
for await (const user of User.cursor(100)) {
  console.log(user.getAttribute('name'));
}

// With query constraints
for await (const user of User.where('active', true).cursor(50)) {
  await sendEmail(user);
}
```

## Next steps

- [Relationships](RELATIONS.md) - Model associations
- [Transactions](TRANSACTIONS.md) - Transaction management
- [Scopes](SCOPES.md) - Reusable queries

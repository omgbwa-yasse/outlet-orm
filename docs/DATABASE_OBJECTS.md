# Database Objects

outlet-orm v11.4.0+ adds first-class support for **views**, **triggers**, **stored procedures/functions**, **savepoints**, and **transaction isolation levels** across MySQL, PostgreSQL, and SQLite.

> ⚠️ **v12.0.0 breaking change**: `DBFunction` alias removed — use `SchemaFunction`. All builders are now exported under the `Schema*` prefix (`SchemaView`, `SchemaTrigger`, `SchemaProcedure`, `SchemaFunction`, `SchemaTransaction`). Short-name aliases (`View`, `Trigger`, etc.) remain available for backward compatibility. Use `useSchema()` to bind all builders at once.

---

## Table of Contents

- [Driver Compatibility](#driver-compatibility)
- [Views](#views)
- [Triggers](#triggers)
  - [Trigger Body Variables (NEW / OLD)](#trigger-body-variables-new--old)
- [Stored Procedures & Functions](#stored-procedures--functions)
- [Savepoints](#savepoints)
- [Isolation Levels](#isolation-levels)
- [Using DB Objects in Migrations](#using-db-objects-in-migrations)
- [Error Handling](#error-handling)

---

## Driver Compatibility

| Feature              | MySQL | PostgreSQL | SQLite |
|----------------------|:-----:|:----------:|:------:|
| Views (create/drop)  | ✅    | ✅          | ✅     |
| `CREATE OR REPLACE`  | ✅    | ✅          | ⚠️ *   |
| Triggers             | ✅    | ✅          | ✅     |
| INSTEAD OF triggers  | ❌    | ✅ (views)  | ✅ (views) |
| Procedures           | ✅    | ✅ (v11+)   | ❌     |
| Functions            | ✅    | ✅          | ❌     |
| Savepoints           | ✅    | ✅          | ✅     |
| Isolation Levels     | ✅    | ✅          | ⚠️ **  |

\* SQLite does not support `CREATE OR REPLACE VIEW`. The library automatically emits `DROP VIEW IF EXISTS` followed by `CREATE VIEW`.  
\*\* SQLite only supports `SERIALIZABLE` (its native isolation model); other levels throw `UnsupportedCapabilityError`.

---

## Views

Access the Schema builder from a `DatabaseConnection` instance:

```js
const { DatabaseConnection } = require('outlet-orm');
const db = new DatabaseConnection({ driver: 'mysql', /* … */ });
const schema = db.getSchema(); // or: new Schema(db)
```

### Create a view

```js
await schema.createView('active_users', "SELECT * FROM users WHERE status = 'active'");
```

### Create or replace a view

If a view with the same name already exists, this will replace its definition (on SQLite it drops and re-creates):

```js
await schema.createOrReplaceView('active_users', "SELECT * FROM users WHERE status = 'active'");
```

### Drop a view

```js
await schema.dropView('active_users');           // throws if view does not exist
await schema.dropViewIfExists('active_users');   // silent no-op when missing
```

### Check existence

```js
const exists = await schema.hasView('active_users'); // true | false
```

### List all views

```js
const viewNames = await schema.getViews(); // string[]
```

---

## Triggers

### Create a trigger

```js
await schema.createTrigger({
  name:   'set_updated_at',   // trigger name
  table:  'orders',           // target table (or view)
  timing: 'AFTER',            // 'BEFORE' | 'AFTER' | 'INSTEAD OF'
  event:  'UPDATE',           // 'INSERT' | 'UPDATE' | 'DELETE'
  forEach: 'ROW',             // 'ROW' (default) | 'STATEMENT' (MySQL/PG only)
  isView: false,              // set true when the target is a view
  body:   "UPDATE orders SET updated_at = NOW() WHERE id = NEW.id;"
});
```

**PostgreSQL note**: A trigger function is automatically generated using the name `{triggerName}_fn`. The function and the trigger itself are created in two statements. `createTrigger` will throw if a function named `{triggerName}_fn` already exists.

### Drop a trigger

```js
await schema.dropTrigger('set_updated_at', 'orders');
await schema.dropTriggerIfExists('set_updated_at', 'orders');
```

On PostgreSQL, the companion `{name}_fn()` function is also dropped.

### Check existence

```js
const exists = await schema.hasTrigger('set_updated_at', 'orders'); // true | false
```

### List triggers

```js
const all   = await schema.getTriggers();          // string[] — all triggers in the DB
const table = await schema.getTriggers('orders');  // string[] — triggers on 'orders' only
```

---

### Trigger Body Variables (NEW / OLD)

Inside trigger bodies, the pseudo-tables `NEW` and `OLD` let you access column values for the row being modified:

| Variable | INSERT | UPDATE | DELETE |
|----------|--------|--------|--------|
| `NEW`    | ✅ (after-row values) | ✅ (post-update values) | ❌ not available |
| `OLD`    | ❌ not available | ✅ (pre-update values) | ✅ (deleted-row values) |

**Example (MySQL / SQLite)**:

```sql
-- Set updated_at to now whenever any column changes
UPDATE orders SET updated_at = NOW() WHERE id = NEW.id;

-- Prevent a price decrease
BEGIN
  IF NEW.price < OLD.price THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Price cannot decrease';
  END IF;
END
```

> **Comparison with SQL Server**: SQL Server uses `INSERTED` and `DELETED` virtual tables instead of `NEW` / `OLD`. The semantics are equivalent — `INSERTED` ≈ `NEW`, `DELETED` ≈ `OLD` — but SQL Server triggers are statement-level by default whereas MySQL, PostgreSQL, and SQLite default to row-level.

**SQLite restrictions** enforced by outlet-orm:

- No qualified table names inside the body (e.g. `schema1.orders`) — use unqualified names only.
- `FOR EACH STATEMENT` is not supported.
- `INSERT INTO … DEFAULT VALUES` syntax is not allowed.
- `ORDER BY` / `LIMIT` inside `UPDATE` or `DELETE` statements is not allowed.
- `INSTEAD OF` is only valid on views (`isView: true`).

---

## Stored Procedures & Functions

> **SQLite**: Stored procedures and functions are not supported. All related methods throw `UnsupportedCapabilityError`.  
> **PostgreSQL**: Stored procedures (`CREATE PROCEDURE`) require PostgreSQL 11+. `hasProcedure()` always returns `false` on older versions.

### Create a stored procedure

```js
// MySQL
await schema.createProcedure(
  'greet_user',                       // name
  'IN username VARCHAR(100)',          // parameter list
  'SELECT CONCAT(\'Hello, \', username, \'!\');'  // body
);

// PostgreSQL
await schema.createProcedure(
  'greet_user',
  'username VARCHAR(100)',
  "RAISE NOTICE 'Hello, %', username;"
);
```

### Create a function

```js
// MySQL
await schema.createFunction(
  'add_tax',
  'IN price DECIMAL(10,2)',
  'RETURN price * 1.10;',
  { returns: 'DECIMAL(10,2)' }
);

// PostgreSQL
await schema.createFunction(
  'add_tax',
  'price DECIMAL(10,2)',
  'RETURN price * 1.10;',
  { returns: 'DECIMAL(10,2)' }
);
```

### Drop procedures / functions

```js
await schema.dropProcedure('greet_user');
await schema.dropProcedureIfExists('greet_user');

await schema.dropFunction('add_tax');
await schema.dropFunctionIfExists('add_tax');
```

### Check existence

```js
const hasFn   = await schema.hasFunction('add_tax');    // true | false
const hasProc = await schema.hasProcedure('greet_user'); // true | false
```

### Call a procedure / function at runtime

Use the `DatabaseConnection` methods directly (not through `Schema`):

```js
// Call a stored procedure
const results = await db.callProcedure('greet_user', ['Alice']);

// Call a function (PostgreSQL: wrapped in SELECT; MySQL: CALL)
const result = await db.callFunction('add_tax', [99.99]);
```

---

## Savepoints

Savepoints allow you to create partial-rollback points within a transaction:

```js
await db.beginTransaction();

await db.execute("INSERT INTO orders (product) VALUES ('A')");

await db.savepoint('before_b');

await db.execute("INSERT INTO orders (product) VALUES ('B')");

// Undo everything after 'before_b'
await db.rollbackTo('before_b');

await db.releaseSavepoint('before_b');

await db.commit(); // Only 'A' is committed
```

| Method | Description |
|--------|-------------|
| `savepoint(name)` | Creates a savepoint with the given name |
| `rollbackTo(name)` | Rolls back to the named savepoint |
| `releaseSavepoint(name)` | Releases (removes) the savepoint |

---

## Isolation Levels

Set the isolation level for the **next** `beginTransaction()` call:

```js
const { IsolationLevel } = require('outlet-orm');

db.setIsolationLevel(IsolationLevel.SERIALIZABLE);

await db.beginTransaction();
// … your transactional work …
await db.commit();
```

`setIsolationLevel` must be called **before** `beginTransaction`. Calling it while a transaction is already active throws an error.

### Available levels

| Constant | SQL string |
|----------|------------|
| `IsolationLevel.READ_UNCOMMITTED` | `'READ UNCOMMITTED'` |
| `IsolationLevel.READ_COMMITTED`   | `'READ COMMITTED'`   |
| `IsolationLevel.REPEATABLE_READ`  | `'REPEATABLE READ'`  |
| `IsolationLevel.SERIALIZABLE`     | `'SERIALIZABLE'`     |

### Driver notes

- **MySQL**: The level is applied with `SET TRANSACTION ISOLATION LEVEL …` *before* `START TRANSACTION`.
- **PostgreSQL**: The level is applied with `SET TRANSACTION ISOLATION LEVEL …` *after* `BEGIN`.
- **SQLite**: Only `SERIALIZABLE` is accepted (no-op — SQLite is always serializable). Any other level throws `UnsupportedCapabilityError`.

---

## Using DB Objects in Migrations

The `Migration` base class exposes `this.getSchema()` which returns a fully-configured `Schema` instance bound to the migration's connection:

```js
const Migration = require('outlet-orm/src/Migrations/Migration');

class CreateViewsAndTriggers extends Migration {
  async up() {
    const schema = this.getSchema();

    await schema.createView(
      'active_users',
      "SELECT * FROM users WHERE status = 'active'"
    );

    await schema.createTrigger({
      name:   'set_last_modified',
      table:  'users',
      timing: 'AFTER',
      event:  'UPDATE',
      body:   "UPDATE users SET last_modified = NOW() WHERE id = NEW.id;"
    });
  }

  async down() {
    const schema = this.getSchema();
    await schema.dropViewIfExists('active_users');
    await schema.dropTriggerIfExists('set_last_modified', 'users');
  }
}

module.exports = CreateViewsAndTriggers;
```

See [examples/migrations/create_views_and_triggers.js](../examples/migrations/create_views_and_triggers.js) for a runnable example.

---

## Error Handling

### `UnsupportedCapabilityError`

Thrown when a method is called on a driver that does not support the requested capability (e.g. stored procedures on SQLite).

```js
const { UnsupportedCapabilityError } = require('outlet-orm');

try {
  await schema.createProcedure('my_proc', '', 'SELECT 1;');
} catch (err) {
  if (err instanceof UnsupportedCapabilityError) {
    console.log(err.driver);     // 'sqlite'
    console.log(err.capability); // 'stored procedures'
    console.log(err.message);    // "The 'stored procedures' capability is not supported by the 'sqlite' driver."
  }
}
```

### Isolation level inside active transaction

```js
await db.beginTransaction();
db.setIsolationLevel(IsolationLevel.SERIALIZABLE);
// → Error: Cannot set isolation level inside an active transaction
```

---

## Fluent Builder API (v11.4.0)

The Fluent Builder API provides dedicated builder classes (`SchemaView`, `SchemaTrigger`, `SchemaProcedure`, `SchemaFunction`, `SchemaTransaction`) that wrap the `schema.*` methods with a context-bound, object-oriented interface. Instead of calling `schema.createView(...)` directly you bind once with `useSchema` and use named objects throughout your migration.

All five classes are exported under both their short names (`View`, `Trigger`, `Procedure`, `Function`, `Transaction`) for brevity and their full `Schema*` names for clarity — both point to the same class.

### `useSchema(schemaOrDb)`

Bind all five builder classes to a schema or connection in one call:

```js
const { useSchema } = require('outlet-orm');

// In a Migration.up(schema, db):
const { View, Trigger, Procedure, Function, Transaction } = useSchema(schema);

await View.create('active_users', "SELECT * FROM users WHERE active = 1");
await Trigger.create({ name: 'trg_audit', timing: 'AFTER', event: 'INSERT', table: 'orders', body: "INSERT INTO audit (msg) VALUES ('order inserted')" });
await Transaction.run(async () => {
  await View.dropIfExists('old_view');
});
```

### Per-class `.use()`

Each class can also be bound individually:

```js
const { View, Transaction } = require('outlet-orm');

const view  = View.use(schema);
const txn   = Transaction.use(db); // or Transaction.use(schema)

await view.create('summary', 'SELECT status, COUNT(*) n FROM orders GROUP BY status');
await txn.run(async () => { /* transaction body */ });
```

### `View` methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `create` | `(name, selectSql, options?)` | Create a view |
| `createOrReplace` | `(name, selectSql)` | Create or replace a view |
| `drop` | `(name)` | Drop a view (error if not exists) |
| `dropIfExists` | `(name)` | Drop a view if it exists |
| `has` | `(name)` | Returns `true` if view exists |
| `list` | `()` | Returns array of view descriptors |

### `Trigger` methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `create` | `(options)` | Create a trigger (`{name, timing, event, table, body}`) |
| `drop` | `(name, table)` | Drop a trigger |
| `dropIfExists` | `(name, table)` | Drop a trigger if it exists |
| `has` | `(name, table)` | Returns `true` if trigger exists |
| `list` | `(table?)` | Returns triggers for a table |

### `Procedure` methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `create` | `(name, params, body, opts?)` | Create a stored procedure |
| `drop` | `(name)` | Drop a procedure |
| `dropIfExists` | `(name)` | Drop a procedure if it exists |
| `has` | `(name)` | Returns `true` if procedure exists |

### `Function` / `SchemaFunction`

`SchemaFunction` is an alias for `Function`. Both point to the same class.

| Method | Signature | Description |
|--------|-----------|-------------|
| `create` | `(name, params, body, opts?)` | Create a user-defined function |
| `drop` | `(name)` | Drop a function |
| `dropIfExists` | `(name)` | Drop a function if it exists |
| `has` | `(name)` | Returns `true` if function exists |

### `Transaction` methods

`Transaction` binds to a `DatabaseConnection` directly. When passed a `Schema`, it extracts `schema.connection` automatically.

| Method | Signature | Description |
|--------|-----------|-------------|
| `begin` | `()` | Begin a transaction |
| `commit` | `()` | Commit the current transaction |
| `rollback` | `()` | Roll back the current transaction |
| `run` | `(callback)` | Execute callback inside a managed transaction |
| `savepoint` | `(name)` | Create a named savepoint |
| `rollbackTo` | `(name)` | Roll back to a named savepoint |
| `releaseSavepoint` | `(name)` | Release a named savepoint |
| `setIsolationLevel` | `(level)` | Set isolation level (before begin) |

### Error handling

Calling any method on an unbound builder (one created with `new View()` without `.use()`) throws a descriptive `TypeError`:

```
View is not bound to a schema. Call View.use(schema) or useSchema(schema) first.
Transaction is not bound to a connection. Call Transaction.use(db) first.
```

Passing an invalid argument to `useSchema` / `.use()` throws:

```
useSchema / .use() requires a Schema or DatabaseConnection instance
Transaction.use() requires a DatabaseConnection or Schema instance
```

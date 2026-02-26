# 🔍 Query Logging

Query logging allows you to trace and debug the SQL queries executed by your application.

> � **Use**: Enable in `services/` or `middlewares/` for debugging — See [Project structure](INSTALLATION.md#structure-de-projet-recommended)
>
> �📘 **TypeScript**: The type`QueryLogEntry`defines the structure of log entries. See [TYPESCRIPT.md](TYPESCRIPT.md#querylogentry)

## Enable logging

```javascript
const { Model } = require('outlet-orm');

// Get connection via Model (automatic connection from .env)
const db = Model.getConnection();

// Enable logging
db.enableQueryLog();

// Run queries
await User.all();
await Post.where('status', 'published').get();
await User.find(1);

// Retrieve the log
const queries = db.getQueryLog();
console.log(queries);
```

## Log structure

Each log entry contains:

```javascript
{
  sql: 'SELECT * FROM users WHERE id = ?',  // SQL Query
  bindings: [1],                             // Settings
  time: 2.5                                  // Execution time (ms)
}
```

## API

### enableQueryLog()

Enables query recording.

```javascript
db.enableQueryLog();
```

### disableQueryLog()

Disables query recording.

```javascript
db.disableQueryLog();
```

### getQueryLog()

Returns all saved queries.

```javascript
const queries = db.getQueryLog();
// [
//   { sql: 'SELECT * FROM users', bindings: [], time: 1.2 },
//   { sql: 'SELECT * FROM posts WHERE user_id = ?', bindings: [1], time: 0.8 }
// ]
```

### flushQueryLog()

Clear the query log.

```javascript
db.flushQueryLog();
const queries = db.getQueryLog(); // []
```

## Use cases

### Debug in development

```javascript
// config/database.js
const { Model } = require('outlet-orm');
const db = Model.getConnection();

if (process.env.NODE_ENV === 'development') {
  db.enableQueryLog();
}
```

### Profile an operation

```javascript
const { Model, User } = require('outlet-orm');

async function profileOperation() {
  const db = Model.getConnection();
  
  db.flushQueryLog();  // Reset
  db.enableQueryLog();
  
  // Operations to profile
  const users = await User.with('posts', 'profile').limit(10).get();
  
  const queries = db.getQueryLog();
  
  console.log(`Nombre de queries: ${queries.length}`);
  console.log(`Temps total: ${queries.reduce((sum, q) => sum + q.time, 0).toFixed(2)}ms`);
  
  queries.forEach((q, i) => {
    console.log(`[${i + 1}] ${q.sql} (${q.time}ms)`);
  });
  
  db.disableQueryLog();
  
  return users;
}
```

### Detect N+1 Problem

```javascript
const { Model, User } = require('outlet-orm');

async function detectN1Problem() {
  const db = Model.getConnection();
  db.flushQueryLog();
  db.enableQueryLog();
  
  // Potentially problematic code
  const users = await User.all();
  for (const user of users) {
    await user.load('posts');  // N additional requests!
  }
  
  const queries = db.getQueryLog();
  
  if (queries.length > 10) {
    console.warn(`⚠️ Possible N+1 Problem détecté: ${queries.length} queries`);
    console.warn('Use .with() for eager loading');
  }
  
  db.disableQueryLog();
}

// Solution
const users = await User.with('posts').all();  // 2 requests only
```

### Log to file

```javascript
const fs = require('fs');

class QueryLogger {
  constructor(filename = 'queries.log') {
    this.stream = fs.createWriteStream(filename, { flags: 'a' });
  }
  
  log(query) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${query.sql} | Bindings: ${JSON.stringify(query.bindings)} | Time: ${query.time}ms\n`;
    this.stream.write(line);
  }
  
  close() {
    this.stream.end();
  }
}

// Usage
const { Model } = require('outlet-orm');
const logger = new QueryLogger();

// After each request
setInterval(() => {
  const db = Model.getConnection();
  const queries = db.getQueryLog();
  
  queries.forEach(q => logger.log(q));
  db.flushQueryLog();
}, 1000);
```

### Middleware Express

```javascript
const { Model } = require('outlet-orm');

function queryLoggerMiddleware(req, res, next) {
  const db = Model.getConnection();
  db.flushQueryLog();
  db.enableQueryLog();
  
  // Intercept response
  const originalSend = res.send;
  res.send = function(body) {
    const queries = db.getQueryLog();
    
    // Add header with stats
    res.setHeader('X-Query-Count', queries.length);
    res.setHeader('X-Query-Time', queries.reduce((sum, q) => sum + q.time, 0).toFixed(2));
    
    // Console log
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${req.method} ${req.path}] ${queries.length} queries, ${queries.reduce((sum, q) => sum + q.time, 0).toFixed(2)}ms`);
    }
    
    return originalSend.call(this, body);
  };
  
  next();
}

app.use(queryLoggerMiddleware);
```

### Performance test

```javascript
const { Model, User } = require('outlet-orm');

async function benchmarkQueries() {
  const db = Model.getConnection();
  const results = {};
  
  // Test 1: Sans eager loading
  db.flushQueryLog();
  db.enableQueryLog();
  
  const users1 = await User.all();
  for (const user of users1) {
    await user.load('posts');
  }
  
  results.withoutEager = {
    queries: db.getQueryLog().length,
    time: db.getQueryLog().reduce((sum, q) => sum + q.time, 0)
  };
  
  // Test 2: With eager loading
  db.flushQueryLog();
  
  const users2 = await User.with('posts').all();
  
  results.withEager = {
    queries: db.getQueryLog().length,
    time: db.getQueryLog().reduce((sum, q) => sum + q.time, 0)
  };
  
  db.disableQueryLog();
  
  console.log('Benchmark Results:');
  console.log(`Without Eager: ${results.withoutEager.queries} queries, ${results.withoutEager.time.toFixed(2)}ms`);
  console.log(`With Eager: ${results.withEager.queries} queries, ${results.withEager.time.toFixed(2)}ms`);
  console.log(`Improvement: ${((1 - results.withEager.time / results.withoutEager.time) * 100).toFixed(1)}% faster`);
  
  return results;
}
```

## Formatted display

```javascript
function formatQueryLog(queries) {
  console.log('\n┌────────────────────────────────────────────────────────────────┐');
  console.log('│                        QUERY LOG                                │');
  console.log('├────────────────────────────────────────────────────────────────┤');
  
  queries.forEach((q, i) => {
    console.log(`│ [${String(i + 1).padStart(2)}] ${q.sql.substring(0, 55).padEnd(55)} │`);
    if (q.bindings.length > 0) {
      console.log(`│      Bindings: ${JSON.stringify(q.bindings).substring(0, 45).padEnd(45)} │`);
    }
    console.log(`│      Time: ${q.time.toFixed(2)}ms`.padEnd(65) + '│');
    console.log('├────────────────────────────────────────────────────────────────┤');
  });
  
  const totalTime = queries.reduce((sum, q) => sum + q.time, 0);
  console.log(`│ Total: ${queries.length} queries, ${totalTime.toFixed(2)}ms`.padEnd(65) + '│');
  console.log('└────────────────────────────────────────────────────────────────┘\n');
}

// Usage
const { Model } = require('outlet-orm');
const db = Model.getConnection();
db.enableQueryLog();

// ... your requests...

formatQueryLog(db.getQueryLog());
```

## Best practices

### 1. Disable in production

```javascript
if (process.env.NODE_ENV !== 'production') {
  db.enableQueryLog();
}
```

### 2. Clear the log regularly

```javascript
// Avoid memory leaks
setInterval(() => {
  const queries = db.getQueryLog();
  // Process queries...
  db.flushQueryLog();
}, 60000);
```

### 3. Limit in production

```javascript
// Log only slow queries
const SLOW_QUERY_THRESHOLD = 100; // ms

db.enableQueryLog();

setInterval(() => {
  const queries = db.getQueryLog();
  const slowQueries = queries.filter(q => q.time > SLOW_QUERY_THRESHOLD);
  
  if (slowQueries.length > 0) {
    console.warn('Slow queries detected:', slowQueries);
  }
  
  db.flushQueryLog();
}, 10000);
```

## Next steps

- [Transactions](TRANSACTIONS.md) - Transaction management
- [Models](MODELS.md) - Complete Model Guide
- [Query Builder](QUERY_BUILDER.md) - Advanced queries

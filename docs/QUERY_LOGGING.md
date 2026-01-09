# 🔍 Query Logging

Le query logging permet de tracer et débugger les requêtes SQL exécutées par votre application.

## Activer le logging

```javascript
const { Model } = require('outlet-orm');

// Obtenir la connexion via Model (connexion automatique depuis .env)
const db = Model.getConnection();

// Activer le logging
db.enableQueryLog();

// Exécuter des requêtes
await User.all();
await Post.where('status', 'published').get();
await User.find(1);

// Récupérer le log
const queries = db.getQueryLog();
console.log(queries);
```

## Structure du log

Chaque entrée du log contient :

```javascript
{
  sql: 'SELECT * FROM users WHERE id = ?',  // Requête SQL
  bindings: [1],                             // Paramètres
  time: 2.5                                  // Temps d'exécution (ms)
}
```

## API

### enableQueryLog()

Active l'enregistrement des requêtes.

```javascript
db.enableQueryLog();
```

### disableQueryLog()

Désactive l'enregistrement des requêtes.

```javascript
db.disableQueryLog();
```

### getQueryLog()

Retourne toutes les requêtes enregistrées.

```javascript
const queries = db.getQueryLog();
// [
//   { sql: 'SELECT * FROM users', bindings: [], time: 1.2 },
//   { sql: 'SELECT * FROM posts WHERE user_id = ?', bindings: [1], time: 0.8 }
// ]
```

### flushQueryLog()

Vide le log des requêtes.

```javascript
db.flushQueryLog();
const queries = db.getQueryLog(); // []
```

## Cas d'utilisation

### Debug en développement

```javascript
// config/database.js
const { Model } = require('outlet-orm');
const db = Model.getConnection();

if (process.env.NODE_ENV === 'development') {
  db.enableQueryLog();
}
```

### Profiler une opération

```javascript
const { Model, User } = require('outlet-orm');

async function profileOperation() {
  const db = Model.getConnection();
  
  db.flushQueryLog();  // Reset
  db.enableQueryLog();
  
  // Opérations à profiler
  const users = await User.with('posts', 'profile').limit(10).get();
  
  const queries = db.getQueryLog();
  
  console.log(`Nombre de requêtes: ${queries.length}`);
  console.log(`Temps total: ${queries.reduce((sum, q) => sum + q.time, 0).toFixed(2)}ms`);
  
  queries.forEach((q, i) => {
    console.log(`[${i + 1}] ${q.sql} (${q.time}ms)`);
  });
  
  db.disableQueryLog();
  
  return users;
}
```

### Détecter le N+1 Problem

```javascript
const { Model, User } = require('outlet-orm');

async function detectN1Problem() {
  const db = Model.getConnection();
  db.flushQueryLog();
  db.enableQueryLog();
  
  // Code potentiellement problématique
  const users = await User.all();
  for (const user of users) {
    await user.load('posts');  // N requêtes supplémentaires!
  }
  
  const queries = db.getQueryLog();
  
  if (queries.length > 10) {
    console.warn(`⚠️ Possible N+1 Problem détecté: ${queries.length} requêtes`);
    console.warn('Utilisez .with() pour eager loading');
  }
  
  db.disableQueryLog();
}

// Solution
const users = await User.with('posts').all();  // 2 requêtes seulement
```

### Logger vers fichier

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

// Utilisation
const { Model } = require('outlet-orm');
const logger = new QueryLogger();

// Après chaque requête
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
  
  // Intercepter la réponse
  const originalSend = res.send;
  res.send = function(body) {
    const queries = db.getQueryLog();
    
    // Ajouter header avec stats
    res.setHeader('X-Query-Count', queries.length);
    res.setHeader('X-Query-Time', queries.reduce((sum, q) => sum + q.time, 0).toFixed(2));
    
    // Log en console
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${req.method} ${req.path}] ${queries.length} queries, ${queries.reduce((sum, q) => sum + q.time, 0).toFixed(2)}ms`);
    }
    
    return originalSend.call(this, body);
  };
  
  next();
}

app.use(queryLoggerMiddleware);
```

### Test de performance

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
  
  // Test 2: Avec eager loading
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

## Affichage formaté

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

// Utilisation
const { Model } = require('outlet-orm');
const db = Model.getConnection();
db.enableQueryLog();

// ... vos requêtes ...

formatQueryLog(db.getQueryLog());
```

## Bonnes pratiques

### 1. Désactivez en production

```javascript
if (process.env.NODE_ENV !== 'production') {
  db.enableQueryLog();
}
```

### 2. Videz régulièrement le log

```javascript
// Évite les fuites mémoire
setInterval(() => {
  const queries = db.getQueryLog();
  // Process queries...
  db.flushQueryLog();
}, 60000);
```

### 3. Limitez en production

```javascript
// Log seulement les requêtes lentes
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

## Prochaines étapes

- [Transactions](TRANSACTIONS.md) - Gestion des transactions
- [Models](MODELS.md) - Guide complet des modèles
- [Query Builder](QUERY_BUILDER.md) - Requêtes avancées

# Backup Guide – Outlet ORM

## 🗄️ Overview

Outlet ORM v6.0.0 ships a built-in **Backup module** that lets you:

- Take **full**, **partial**, or **transaction-log (journal)** backups programmatically.
- **Schedule** recurring backups without any external cron or dependency.
- **Encrypt** backup files at rest with AES-256-GCM and a configurable _grain de sable_ (salt).
- **Restore** from any backup file, including encrypted `.enc` files (auto-detected).
- Manage all of the above **remotely** via a TCP socket daemon (`BackupSocketServer`) + a lightweight client (`BackupSocketClient`).

All features use only **Node.js built-ins** (`fs`, `crypto`, `net`) — zero extra npm packages required.

---

## 📦 Available classes

| Class | Description |
|---|---|
| `BackupManager` | Core engine — full / partial / journal / restore |
| `BackupScheduler` | Timer-based recurring job scheduler |
| `BackupEncryption` | AES-256-GCM encryption helpers |
| `BackupSocketServer` | Long-running TCP daemon |
| `BackupSocketClient` | Promise-based remote client |

```javascript
const {
  BackupManager,
  BackupScheduler,
  BackupEncryption,
  BackupSocketServer,
  BackupSocketClient,
} = require('outlet-orm');
```

---

## 1. BackupManager

### Constructor

```javascript
const manager = new BackupManager(connection, {
  backupPath: './database/backups',  // default: './database/backups'
  encrypt: true,                     // enable AES-256-GCM file encryption
  encryptionPassword: 'MySecret',    // required when encrypt: true
  saltLength: 6,                     // grain de sable length: 4 | 5 | 6 (default: 6)
});
```

> ⚠️ `encryptionPassword` is **required** when `encrypt: true`.  
> `saltLength` must be between **4 and 6** (inclusive).

---

### `full(options?)` — complete dump

Dumps every table (schema + data) in the database.

```javascript
// SQL dump (default)
const file = await manager.full();
// → './database/backups/full_20260226_143022.sql'

// JSON dump
const jsonFile = await manager.full({ format: 'json' });
// → './database/backups/full_20260226_143022.json'

// Custom filename
await manager.full({ filename: 'weekly_full.sql' });
```

With encryption enabled the file gets an `.enc` suffix automatically:
```
full_20260226_143022.sql.enc
```

---

### `partial(tables, options?)` — selected tables only

```javascript
const file = await manager.partial(['users', 'orders'], { format: 'sql' });
// → './database/backups/partial_20260226_143022.sql'
```

---

### `journal(options?)` — transaction-log backup

Captures all **INSERT / UPDATE / DELETE** statements recorded by the query log since the last flush.

> Requires `DatabaseConnection.enableQueryLog()` to be called *before* the operations you want to record.

```javascript
DatabaseConnection.enableQueryLog();

// … application writes …

const file = await manager.journal();

// Clear the log after writing to avoid duplicate entries next time
await manager.journal({ flush: true });
```

---

### `restore(filePath, options?)` — replay a backup

Executes every SQL statement from the file inside a single transaction.  
Encrypted `.enc` files are **auto-detected and decrypted** transparently.

```javascript
// Plain SQL backup
await manager.restore('./database/backups/full_20260226_143022.sql');

// Encrypted backup — uses the manager's encryptionPassword automatically
await manager.restore('./database/backups/full_20260226_143022.sql.enc');

// Override password at restore time
await manager.restore('./database/backups/full_20260226_143022.sql.enc', {
  encryptionPassword: 'OtherPassword',
});

// Returns { statements: <number of executed statements> }
const { statements } = await manager.restore(filePath);
console.log(`Restored ${statements} statement(s)`);
```

---

## 2. BackupScheduler

Schedules recurring backup jobs using `setInterval`.

```javascript
const scheduler = new BackupScheduler(connection, {
  backupPath: './database/backups',
});

// Register a daily full backup
const jobName = scheduler.schedule('full', {
  intervalMs: 86_400_000,  // 24 h
  name: 'daily_full',      // optional; auto-generated if omitted
  runNow: true,            // run immediately upon scheduling
  onSuccess: (filePath) => console.log('Backup written:', filePath),
  onError:   (err)      => console.error('Backup failed:', err.message),
});

// Register a partial backup every 15 minutes
scheduler.schedule('partial', {
  intervalMs: 900_000,
  tables: ['orders', 'payments'],
  name: 'orders_15m',
});

// Register a journal backup with auto-flush every 5 minutes
scheduler.schedule('journal', {
  intervalMs: 300_000,
  flush: true,
  name: 'txlog_5m',
});

// Introspect
console.log(scheduler.activeJobs());  // ['daily_full', 'orders_15m', 'txlog_5m']

// Cancel individual job
scheduler.stop('orders_15m');

// Shutdown all jobs (call before process exit)
scheduler.stopAll();
```

---

## 3. BackupEncryption

Low-level helpers used internally by `BackupManager` — also available directly.

```javascript
const { BackupEncryption } = require('outlet-orm');

// Encrypt
const { encryptedContent, salt } = BackupEncryption.encrypt(
  'INSERT INTO users …',
  'MyPassword',
  6  // saltLength (grain de sable): 4 | 5 | 6
);
// encryptedContent → multiline string starting with "OUTLET_ENC_V1\n…"
// salt             → e.g. "aB3xZ9" (random 6-char alphanumeric)

// Decrypt
const plain = BackupEncryption.decrypt(encryptedContent, 'MyPassword');

// Detect
BackupEncryption.isEncrypted(encryptedContent); // true
BackupEncryption.isEncrypted('SELECT 1;');      // false

// Generate a salt independently
const salt = BackupEncryption.generateSalt(5);  // e.g. "Kq7pM"
```

### Encrypted file format

```
OUTLET_ENC_V1          ← magic / version marker
<salt>                 ← 4–6 alphanumeric chars (grain de sable)
<iv_hex>               ← 24-char hex (12-byte GCM IV)
<authTag_hex>          ← 32-char hex (16-byte GCM auth tag)
<ciphertext_base64>    ← base64-encoded ciphertext
```

Key derivation: `crypto.scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 })`

---

## 4. BackupSocketServer – TCP Daemon

A long-running process that manages backup jobs and serves remote clients over TCP.

### Start the daemon

```javascript
const server = new BackupSocketServer(connection, {
  port: 9119,                        // default: 9119
  host: '127.0.0.1',                 // default: '127.0.0.1'
  backupPath: './database/backups',
  // Optional default encryption for all jobs on this server:
  encrypt: true,
  encryptionPassword: 'ServerSecret',
  saltLength: 6,
});

await server.listen();
// ✓ BackupSocketServer listening on 127.0.0.1:9119

// Graceful shutdown
await server.close();
```

### Push events (server → all clients)

| Event | Payload |
|---|---|
| `jobStart` | `{ name, type }` |
| `jobDone` | `{ name, type, filePath }` |
| `jobError` | `{ name, type, error }` |

Listen server-side:
```javascript
server.on('event', (payload) => console.log('broadcast:', payload));
```

---

## 5. BackupSocketClient

A Promise-based EventEmitter that talks to a `BackupSocketServer` daemon.

```javascript
const client = new BackupSocketClient({
  port: 9119,
  host: '127.0.0.1',
  timeout: 30_000,  // reply timeout in ms (default: 30 000)
});

await client.connect();
```

### Commands

```javascript
// Health check
await client.ping();    // → 'pong'

// Server status
const status = await client.status();
// → { uptime: 12345, jobs: ['daily_full'], clients: 2 }

// List active jobs
const jobs = await client.jobs();
// → ['daily_full', 'txlog_5m']

// Schedule a recurring job
const name = await client.schedule('full', {
  intervalMs: 86_400_000,
  name: 'daily',
  runNow: true,
});

// One-shot immediate backup
const filePath = await client.run('full');
const filePath = await client.run('full', { format: 'json' });
const filePath = await client.run('partial', ['users', 'orders']);

// Restore
const result = await client.restore('/abs/path/to/backup.sql');
const result = await client.restore('/abs/path/to/backup.sql.enc', {
  encryptionPassword: 'MySecret',
});
// → { statements: 12 }

// Stop a job
await client.stop('daily');

// Stop all jobs
await client.stopAll();

// Disconnect
await client.disconnect();
```

### Push events (client-side)

```javascript
client.on('jobStart', ({ name, type })           => console.log(`Starting: ${name}`));
client.on('jobDone',  ({ name, filePath })        => console.log(`Done: ${filePath}`));
client.on('jobError', ({ name, error })           => console.error(`Failed: ${error}`));
client.on('serverEvent', (payload)               => console.log('raw:', payload));
```

---

## 6. Complete example

```javascript
const { DatabaseConnection, BackupSocketServer, BackupSocketClient } = require('outlet-orm');

// ── Server process ──────────────────────────────────────────────────────────
const db = new DatabaseConnection({ driver: 'sqlite', database: './app.db' });
await db.connect();

const server = new BackupSocketServer(db, {
  port: 9119,
  backupPath: './database/backups',
  encrypt: true,
  encryptionPassword: process.env.BACKUP_PASSWORD,
  saltLength: 6,
});
await server.listen();

// ── Client (another process or same process) ────────────────────────────────
const client = new BackupSocketClient({ port: 9119 });
await client.connect();

// Listen for any completed job
client.on('jobDone', ({ name, filePath }) => {
  console.log(`[backup] ${name} → ${filePath}`);
});

// Schedule daily full backup at midnight (run immediately on start)
await client.schedule('full', {
  intervalMs: 86_400_000,
  name: 'daily_full',
  runNow: true,
});

// Schedule 15-minute journal backups
await client.schedule('journal', {
  intervalMs: 900_000,
  name: 'journal_15m',
  flush: true,
});

// Check status
const { uptime, jobs, clients } = await client.status();
console.log('Active jobs:', jobs);

// Restore latest backup if needed
// await client.restore('./database/backups/daily_full_20260226_000000.sql.enc', {
//   encryptionPassword: process.env.BACKUP_PASSWORD,
// });
```

---

## Supported drivers

| Driver | full | partial | journal | restore |
|---|---|---|---|---|
| SQLite | ✅ | ✅ | ✅ | ✅ |
| MySQL | ✅ | ✅ | ✅ | ✅ |
| PostgreSQL | ✅* | ✅* | ✅ | ✅ |

> \* PostgreSQL does not expose `SHOW CREATE TABLE` so schema DDL is omitted from the dump; INSERT rows are always included.

---

## TypeScript

```typescript
import {
  BackupManager,
  BackupScheduler,
  BackupEncryption,
  BackupSocketServer,
  BackupSocketClient,
  BackupManagerOptions,
  ScheduleConfig,
  RestoreResult,
  ServerStatus,
} from 'outlet-orm';

const manager = new BackupManager(connection, {
  backupPath: './backups',
  encrypt: true,
  encryptionPassword: 'secret',
  saltLength: 6,
} satisfies BackupManagerOptions);

const result: RestoreResult = await manager.restore('./backups/full.sql.enc');
```

---

## See also

- [Transactions](TRANSACTIONS.md)
- [Query Logging](QUERY_LOGGING.md)
- [API Reference](API_REFERENCE.md)

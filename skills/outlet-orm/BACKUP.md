# Outlet ORM – Backup Module

[← Back to Index](SKILL.md) | [See also: Advanced](ADVANCED.md)

## When to use

Use the Backup module when you need to:

- take periodic **full / partial / journal** snapshots of the database;
- **schedule** recurring backups without cron or external dependencies;
- **encrypt** backup files at rest (AES-256-GCM, built-in Node.js `crypto`);
- **restore** data from any backup (auto-detects encrypted `.enc` files);
- manage backup jobs remotely via a **TCP socket daemon**.

---

## Quick imports

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

## BackupManager – core API

```javascript
const manager = new BackupManager(connection, {
  backupPath: './database/backups',
  encrypt: true,              // AES-256-GCM
  encryptionPassword: 'pwd',  // required when encrypt: true
  saltLength: 6,              // grain de sable: 4 | 5 | 6
});

// Full dump (schema + data)
const file = await manager.full();
const file = await manager.full({ format: 'json' });

// Selected tables only
const file = await manager.partial(['users', 'orders']);

// Transaction log (requires DatabaseConnection.enableQueryLog() first)
const file = await manager.journal({ flush: true });

// Restore – decrypts .enc files automatically
const { statements } = await manager.restore(filePath);
const { statements } = await manager.restore(filePath, { encryptionPassword: 'pwd' });
```

---

## BackupScheduler – recurring jobs

```javascript
const scheduler = new BackupScheduler(connection, { backupPath: './database/backups' });

scheduler.schedule('full', {
  intervalMs: 86_400_000,   // every 24 h
  name: 'daily_full',
  runNow: true,             // fire immediately on registration
  onSuccess: (path) => console.log('done:', path),
  onError:   (err)  => console.error(err.message),
});

scheduler.schedule('partial', {
  intervalMs: 900_000,
  tables: ['orders'],
  name: 'orders_15m',
});

scheduler.activeJobs();     // ['daily_full', 'orders_15m']
scheduler.stop('orders_15m');
scheduler.stopAll();
```

---

## BackupEncryption – low-level helpers

```javascript
const { encryptedContent, salt } = BackupEncryption.encrypt(sql, 'password', 6);
const plain = BackupEncryption.decrypt(encryptedContent, 'password');
BackupEncryption.isEncrypted(content);   // boolean
BackupEncryption.generateSalt(5);        // random 5-char alphanumeric
```

File format: `OUTLET_ENC_V1 / <salt(4-6)> / <iv_hex> / <authTag_hex> / <ciphertext_base64>`

Key derivation: `scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 })`

---

## BackupSocketServer – TCP daemon

```javascript
const server = new BackupSocketServer(connection, {
  port: 9119,
  backupPath: './database/backups',
  encrypt: true,
  encryptionPassword: process.env.BACKUP_PASSWORD,
});
await server.listen();
await server.close();   // graceful shutdown + stopAll()
```

Push events broadcast to all clients: `jobStart`, `jobDone`, `jobError`.

---

## BackupSocketClient – remote control

```javascript
const client = new BackupSocketClient({ port: 9119 });
await client.connect();

await client.ping();                  // 'pong'
await client.status();                // { uptime, jobs, clients }
await client.jobs();                  // string[]

await client.schedule('full', { intervalMs: 3_600_000, name: 'hourly', runNow: true });
await client.run('full');             // → absolute file path
await client.run('partial', ['users']);
await client.restore('/path/to/backup.sql');
await client.restore('/path/to/backup.sql.enc', { encryptionPassword: 'pwd' });

await client.stop('hourly');
await client.stopAll();
await client.disconnect();

// Push events
client.on('jobDone',  ({ name, filePath }) => console.log(filePath));
client.on('jobError', ({ name, error })    => console.error(error));
```

---

## Rules & best practices

- Always call `scheduler.stopAll()` (or `server.close()`) before process exit to avoid timer leaks.
- Enable `DatabaseConnection.enableQueryLog()` **before** operations you want captured in a `journal` backup.
- For `journal` backups, pass `flush: true` to avoid replaying old entries on the next run.
- Do not store `encryptionPassword` in source code — use environment variables or a secrets manager.
- PostgreSQL: schema DDL (`CREATE TABLE`) is **not** included in the dump; only INSERT rows are written.
- `saltLength` of 6 (default) provides ~56 billion possible salt values — use it unless you have a specific reason to choose 4 or 5.

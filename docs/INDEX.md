# 📚 Outlet ORM – Complete Documentation

> **Version 6.5.0** – A JavaScript/TypeScript ORM inspired by Laravel Eloquent for Node.js

## Table of Contents

### 🚀 Getting Started
- [Quick Start Guide](QUICKSTART.md)
- [Installation and Configuration](INSTALLATION.md)
- [Project Structure (Layered Architecture)](INSTALLATION.md#structure-de-projet-recommended-architecture-en-couches)

### 🏗️ Recommended Architecture
- [Layered Architecture](ARCHITECTURE.md) – Controllers → Services → Repositories → Models
- [Backend Security](SECURITY.md) – Middleware, validation, and best practices

### 📖 Essential Guides
- [Models and CRUD](MODELS.md)
- [Query Builder](QUERY_BUILDER.md)
- [Relationships](RELATIONS.md)
- [Automatic Relationship Detection](RELATIONS_DETECTION.md)

### ⚡ Advanced Features
- [Transactions](TRANSACTIONS.md)
- [Soft Deletes](SOFT_DELETES.md)
- [Scopes (Global and Local)](SCOPES.md)
- [Events / Hooks](EVENTS.md)
- [Validation](VALIDATION.md)
- [Query Logging](QUERY_LOGGING.md)

### 🗄️ Backup & Restore (v6.0.0)
- [**Backup Guide**](BACKUP.md) – Full / partial / journal backups, scheduling, AES-256-GCM encryption, TCP daemon, remote restore

### 🔐 Security
- [**Backend Security Guide**](SECURITY.md) – Secure structure, middleware, and best practices

### 📘 TypeScript (v5.0.0+)
- [**TypeScript Complete Guide**](TYPESCRIPT.md) – Generic models, typed schema builder, typed migrations

### 🛠️ Tools
- [Migrations](MIGRATIONS.md)
- [Seeds](SEEDS.md)
- [CLI (outlet-init, outlet-migrate, outlet-convert)](CLI.md)
- [Backup daemon (BackupSocketServer)](BACKUP.md#4-backupsocketserver--tcp-daemon)

### 📚 Reference
- [Internal ORM Architecture](ARCHITECTURE.md#structure-interne-de-lorm)
- [API Reference](API_REFERENCE.md)

### 📋 Other
- [Changelog](../CHANGELOG.md)
- [Contributing](../CONTRIBUTING.md)

---

## Quick Overview

```javascript
const { Model } = require('outlet-orm');

// Define the Post model (see Relationships)
class Post extends Model {
  static table = 'posts';
}

// Define the User model (automatic connection via .env)
class User extends Model {
  static table = 'users';
  static softDeletes = true;
  static rules = { email: 'required|email' };

  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

// Usage – connection is initialised automatically from .env
const users = await User.with('posts').where('status', 'active').get();
```

> 💡 **Automatic connection**: Simply create a `.env` file with your connection settings. `Model` connects automatically on first use.

## What's New in v6.5.0

| Feature | Description |
|---|---|
| 🔮 **Accessors & Mutators** | `get{Key}Attribute` / `set{Key}Attribute` methods to transform on read/write |
| 🔍 **firstOrCreate** | Find by conditions or create a new record |
| 📋 **firstOrNew** | Find by conditions or return an unsaved instance |
| 🔄 **updateOrCreate** | Find and update, or create a new record |
| ⚡ **upsert** | Bulk `INSERT … ON CONFLICT` with driver-specific SQL |
| 👁️ **Observer** | Register observer classes for model lifecycle events |
| 🌊 **cursor()** | Async generator for lazy iteration over large datasets |

### Previous Release – v6.0.0

| Feature | Description |
|---|---|
| 🗄️ **BackupManager** | Full / partial / journal backups, `restore()` with auto-decrypt |
| ⏰ **BackupScheduler** | Recurring jobs (`setInterval`), `runNow`, `onSuccess`/`onError` hooks |
| 🔐 **BackupEncryption** | AES-256-GCM, scrypt key derivation, _grain de sable_ salt (4–6 chars) |
| 🛰️ **BackupSocketServer** | TCP daemon on port 9119, NDJSON protocol, push events |
| 📡 **BackupSocketClient** | Promise API + EventEmitter, remote `schedule`/`run`/`restore` |

### Previous Major Release – v5.0.0

| Feature | Description |
|---|---|
| 🏗️ **Layered Architecture** | Recommended structure: Controllers → Services → Repositories → Models |
| 📁 **Centralised Source** | All source code is in `src/` (migrated from `lib/`) |
| 📘 **Generic Model** | `Model<TAttributes>` for strong attribute typing |
| 🔒 **Type-safe getAttribute** | Returns the correct type based on your interface |
| 🏗️ **Typed Schema Builder** | Complete interfaces for typed migrations |
| 📝 **MigrationInterface** | Standard contract for TypeScript migrations |
| ✅ **Extended ValidationRule** | `url`, `array`, `integer`, `alpha`, etc. |
| 🎯 **ModelEventName** | Standard union type for all events |
| 🔍 **WhereOperator** | Standard union type for all operators |

### Existing Features (v3.0.0+)

| Feature | Description |
|---|---|
| 🔄 **Transactions** | `beginTransaction()`, `commit()`, `rollback()`, `transaction()` |
| 🗑️ **Soft Deletes** | Logical deletion with `deleted_at` |
| 🔬 **Scopes** | Reusable global and local filters |
| 📣 **Events** | Model lifecycle hooks |
| ✅ **Validation** | Built-in validation rules |
| 📊 **Query Logging** | Debug mode to analyse queries |

## Support

- **GitHub**: [github.com/omgbwa-yasse/outlet-orm](https://github.com/omgbwa-yasse/outlet-orm)
- **npm**: [npmjs.com/package/outlet-orm](https://www.npmjs.com/package/outlet-orm)
- **Issues**: [Report a bug](https://github.com/omgbwa-yasse/outlet-orm/issues)

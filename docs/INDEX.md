# 📚 Outlet ORM – Complete Documentation

> **Version 5.0.0** – A JavaScript/TypeScript ORM inspired by Laravel Eloquent for Node.js

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

### 🔐 Security
- [**Backend Security Guide**](SECURITY.md) – Secure structure, middleware, and best practices

### 📘 TypeScript (v5.0.0+)
- [**TypeScript Complete Guide**](TYPESCRIPT.md) – Generic models, typed schema builder, typed migrations

### 🛠️ Tools
- [Migrations](MIGRATIONS.md)
- [CLI (outlet-init, outlet-migrate, outlet-convert)](CLI.md)

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

## What’s New in v5.0.0

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

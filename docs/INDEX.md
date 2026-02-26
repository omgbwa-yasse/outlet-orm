# 📚 Outlet ORM - Complete Documentation

> **Version 5.0.0** - A JavaScript/TypeScript ORM inspired by Laravel Eloquent for Node.js

## Table of contents

### 🚀 Getting Started
- [Quick Start Guide](QUICKSTART.md)
- [Installation and Configuration](INSTALLATION.md)
- [Project Structure (Layered Architecture)](INSTALLATION.md#structure-de-projet-recommandée-architecture-en-couches)

### 🏗️ Recommended Architecture
- [Layered Architecture](ARCHITECTURE.md) - Controllers → Services → Repositories → Models
- [Backend Security](SECURITY.md) - Middlewares, validation, best practices

### 📖 Essential guides
- [Models and CRUD](MODELS.md)
- [Query Builder](QUERY_BUILDER.md)
- [Relationships](RELATIONS.md)
- [Automatic relationship detection](RELATIONS_DETECTION.md)

### ⚡ Advanced features
- [Transactions](TRANSACTIONS.md)
- [Soft Deletes](SOFT_DELETES.md)
- [Scopes (Global and Local)](SCOPES.md)
- [Events / Hooks](EVENTS.md)
- [Validation](VALIDATION.md)
- [Query Logging](QUERY_LOGGING.md)

### 🔐 Security
- [**Backend Security Guide**](SECURITY.md) - Secure structure, middleware, best practices

### 📘 TypeScript (v5.0.0+)
- [**TypeScript Complete Guide**](TYPESCRIPT.md) - Generic Model, Typed Schema Builder, Typed Migrations

### 🛠️ Tools
- [Migrations](MIGRATIONS.md)
- [CLI (outlet-init, outlet-migrate, outlet-convert)](CLI.md)

### 📚 Reference
- [Internal Architecture of the ORM](ARCHITECTURE.md#structure-interne-de-lorm)
- [API Reference](API_REFERENCE.md)

### 📋 Others
- [Changelog](../CHANGELOG.md)
- [Contributing](../CONTRIBUTING.md)

---

## Quick view

```javascript
const { Model } = require('outlet-orm');

// Definition of the Post model (see Relations)
class Post extends Model {
  static table = 'posts';
}

// Define a template (automatic connection via .env)
class User extends Model {
  static table = 'users';
  static softDeletes = true;
  static rules = { email: 'required|email' };
  
  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

// Usage - connection is initialized automatically from .env
const users = await User.with('posts').where('status', 'active').get();
```

> 💡 **Automatic connection**: Simply create a file`.env`with your connection settings. The Model connects automatically on first use.

## What’s new v5.0.0

| Feature | Description |
|----------------|-------------|
| 🏗️ **Layered Architecture** | Recommended structure Controllers → Services → Repositories → Models |
| 📁 **Centralised Source** | All code in`src/`(migration from`lib/`) |
| 📘 **Generic Model** |`Model<TAttributes>`for strong attribute typing |
| 🔒 **Type-safe getAttribute** | Returns the correct type based on your interface |
| 🏗️ **Typed Schema Builder** | Complete interfaces for typed migrations |
| 📝 **MigrationInterface** | Standard framework for TypeScript migrations |
| ✅ **Extended ValidationRule** |`url`,`array`,`integer`,`alpha`, etc. |
| 🎯 **ModelEventName** | Standard union for all events |
| 🔍 **WhereOperator** | Standard union for all operators |

### Legacy Features (v3.0.0+)

| Feature | Description |
|----------------|-------------|
| 🔄 **Transactions** |`beginTransaction()`,`commit()`,`rollback()`,`transaction()`|
| 🗑️ **Soft Deletes** | Logical deletion with`deleted_at`|
| 🔬 **Scopes** | Global and local reusable filters |
| 📣 **Events** | Model lifecycle hooks |
| ✅ **Validation** | Built-in validation rules |
| 📊 **Query Logging** | Debug mode to analyse requests |

## Support

- **GitHub**: [github.com/omgbwa-yasse/outlet-orm](https://github.com/omgbwa-yasse/outlet-orm)
- **npm**: [npmjs.com/package/outlet-orm](https://www.npmjs.com/package/outlet-orm)
- **Issues**: [Report a bug](https://github.com/omgbwa-yasse/outlet-orm/issues)

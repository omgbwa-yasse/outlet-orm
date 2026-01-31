---
name: outlet-orm-best-practices
description: Outlet ORM is a Laravel Eloquent-inspired ORM for Node.js with MySQL, PostgreSQL, and SQLite support. Use this skill when working with Outlet ORM models, queries, relationships, migrations, and database operations. v4.1.0 adds full TypeScript support with generic models and Copilot Skills integration.
license: MIT
metadata:
  author: omgbwa-yasse
  version: "4.1.0"
  source: https://github.com/omgbwa-yasse/outlet-orm
  npm: https://www.npmjs.com/package/outlet-orm
---

# Outlet ORM Best Practices

Comprehensive guide for using Outlet ORM - a Laravel Eloquent-inspired ORM for Node.js/TypeScript with support for MySQL, PostgreSQL, and SQLite.

> 🆕 **v4.1.0** : Support TypeScript complet avec Generic Model, Schema Builder typé, MigrationInterface et intégration Copilot Skills.

## Documentation Index

| Document | Description |
|----------|-------------|
| **[MODELS.md](MODELS.md)** | Model definition, CRUD, casts, timestamps, connections |
| **[QUERIES.md](QUERIES.md)** | Query Builder, WHERE clauses, joins, pagination |
| **[RELATIONS.md](RELATIONS.md)** | Relationships, Eager Loading, polymorphic, naming conventions |
| **[MIGRATIONS.md](MIGRATIONS.md)** | Schema Builder, CLI tools, column types, foreign keys |
| **[ADVANCED.md](ADVANCED.md)** | Transactions, Soft Deletes, Events, Validation, Best Practices |
| **[TYPESCRIPT.md](TYPESCRIPT.md)** | TypeScript types, generics, typed models, migrations |
| **[API.md](API.md)** | Complete API Reference |

---

## When to Apply

Reference these guidelines when:
- Defining models and table schemas  [MODELS.md](MODELS.md)
- Building database queries  [QUERIES.md](QUERIES.md)
- Implementing relationships  [RELATIONS.md](RELATIONS.md)
- Using Eager Loading  [RELATIONS.md](RELATIONS.md)
- Setting up migrations  [MIGRATIONS.md](MIGRATIONS.md)
- Implementing transactions, soft deletes, events  [ADVANCED.md](ADVANCED.md)
- Using TypeScript with typed models  [TYPESCRIPT.md](TYPESCRIPT.md)

---

## Prerequisites

- **Node.js**: >= 18 (required)
- **Database Drivers** (install only needed):
  - MySQL/MariaDB: `npm install mysql2`
  - PostgreSQL: `npm install pg`
  - SQLite: `npm install sqlite3`

```bash
npm install outlet-orm
```

---

## Recommended Project Structure

When using Outlet ORM, organize your project as follows:

> 🔐 **Security**: See the [Security Guide](../../../docs/SECURITY.md) for best practices.

```
my-project/
├── .env                        # ⚠️ NEVER commit (in .gitignore)
├── .env.example                # Template without secrets
├── .gitignore
├── package.json
├── config/                     # 🔒 Centralized configuration
│   ├── app.js
│   ├── database.js
│   └── security.js             # Rate limit, helmet, CORS
├── database/
│   ├── config.js               # Migration config
│   └── migrations/
├── models/                     # Model classes
├── controllers/                # Business logic
├── routes/                     # API/Web routes
├── middlewares/                # 🔒 Security critical
│   ├── auth.js                 # JWT authentication
│   ├── authorization.js        # RBAC permissions
│   ├── rateLimiter.js
│   ├── validator.js
│   └── errorHandler.js
├── services/                   # Business services
├── utils/                      # 🔒 Hash, tokens
├── validators/                 # Validation schemas
├── public/                     # ✅ Only public folder
├── logs/                       # 📋 Not versioned
├── src/
│   └── index.js
└── tests/
```

### Key Folders

| Folder | Purpose | Security |
|--------|---------|----------|
| `config/` | Centralized configuration | 🔒 Reads .env |
| `models/` | Model classes | 🔒 `hidden`, `fillable` |
| `middlewares/` | Auth, validation, rate limit | 🔒 **Critical** |
| `utils/` | Hash, tokens | 🔒 Never expose |
| `public/` | Static files | ✅ Only public folder |

### Quick Setup Commands

```bash
# Initialize project structure
outlet-init

# Create a migration
outlet-migrate make create_users_table

# Run migrations
outlet-migrate migrate
```

---

## Rule Categories by Priority

| Priority | Category | Impact | Document |
|----------|----------|--------|----------|
| 1 | Model Definition | CRITICAL | [MODELS.md](MODELS.md) |
| 2 | Query Building | CRITICAL | [QUERIES.md](QUERIES.md) |
| 3 | Relationships | HIGH | [RELATIONS.md](RELATIONS.md) |
| 4 | Eager Loading | HIGH | [RELATIONS.md](RELATIONS.md) |
| 5 | Transactions | MEDIUM-HIGH | [ADVANCED.md](ADVANCED.md) |
| 6 | Soft Deletes | MEDIUM | [ADVANCED.md](ADVANCED.md) |
| 7 | Validation & Events | MEDIUM | [ADVANCED.md](ADVANCED.md) |
| 8 | Migrations & CLI | LOW-MEDIUM | [MIGRATIONS.md](MIGRATIONS.md) |

---

## References

- https://github.com/omgbwa-yasse/outlet-orm
- https://www.npmjs.com/package/outlet-orm
- https://github.com/omgbwa-yasse/outlet-orm/blob/main/docs/INDEX.md

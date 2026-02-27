---
name: outlet-orm-best-practices
description: Outlet ORM is a Laravel Eloquent-inspired ORM for Node.js with MySQL, PostgreSQL, and SQLite support. Use this skill when working with Outlet ORM models, queries, relationships, migrations, backup, and database operations. v6.0.0 adds a full Backup module (BackupManager, BackupScheduler, AES-256-GCM encryption, TCP daemon).
license: MIT
metadata:
author: omgbwa-yasse
version: "6.0.0"
source: https://github.com/omgbwa-yasse/outlet-orm
npm: https://www.npmjs.com/package/outlet-orm
---

# Outlet ORM Best Practices

Comprehensive guide for using Outlet ORM - a Laravel Eloquent-inspired ORM for Node.js/TypeScript with support for MySQL, PostgreSQL, and SQLite.

> 🆕 **v6.0.0**: Full Backup module — `BackupManager`, `BackupScheduler`, AES-256-GCM `BackupEncryption`, `BackupSocketServer` TCP daemon, `BackupSocketClient` with remote restore. See [BACKUP.md](BACKUP.md).
>
> 🔖 **v5.0.0**: Full TypeScript support with Generic Model, typed Schema Builder, MigrationInterface and Copilot Skills integration. Recommended layered architecture (Controllers → Services → Repositories → Models).

## Documentation Index

| Document | Description |
|----------|-------------|
| **[MODELS.md](MODELS.md)** | Model definition, CRUD, casts, timestamps, connections |
| **[QUERIES.md](QUERIES.md)** | Query Builder, WHERE clauses, joins, pagination |
| **[RELATIONS.md](RELATIONS.md)** | Relationships, Eager Loading, polymorphic, naming conventions |
| **[MIGRATIONS.md](MIGRATIONS.md)** | Schema Builder, CLI tools, column types, foreign keys |
| **[ADVANCED.md](ADVANCED.md)** | Transactions, Soft Deletes, Events, Validation, Best Practices |
| **[TYPESCRIPT.md](TYPESCRIPT.md)** | TypeScript types, generics, typed models, migrations |
| **[SECURITY.md](SECURITY.md)** | 🔐 Security best practices, authentication, authorisation |
| **[BACKUP.md](BACKUP.md)** | 🗄️ Backups, scheduling, AES-256-GCM encryption, TCP daemon, restore |
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
- Securing your backend application  [SECURITY.md](SECURITY.md)
- Scheduling or encrypting database backups  [BACKUP.md](BACKUP.md)
- Restoring a database from a backup file  [BACKUP.md](BACKUP.md)
- Running a long-lived backup daemon over TCP  [BACKUP.md](BACKUP.md)

---

## Prerequisites

- **Node.js**: >= 18 (required)
- **Database Drivers** (install only needed):
- MySQL/MariaDB:`npm install mysql2`
- PostgreSQL:`npm install pg`
- SQLite:`npm install sqlite3`

```bash
npm install outlet-orm
```

---

## Recommended Project Structure (Layered Architecture)

When using Outlet ORM, organise your project following the **Layered Architecture** pattern:

> 🔐 **Security**: See the [Security Guide](../../../docs/SECURITY.md) for best practices.

```
my-project/
├── .env                           # ⚠️ NEVER commit (in .gitignore)
├── .env.example                   # Template without secrets
├── .gitignore
├── package.json
├── src/
│   ├── index.js                   # Entry point
│   ├── controllers/               # 🎮 Presentation Layer
│   │   └── UserController.js
│   ├── services/                  # ⚙️ Business Logic Layer
│   │   └── UserService.js
│   ├── repositories/              # 📦 Data Access Layer
│   │   └── UserRepository.js
│   ├── models/                    # 📊 Models Layer (outlet-orm)
│   │   └── User.js
│   ├── middlewares/               # 🔒 Auth, validation, rate limit
│   │   ├── auth.js
│   │   ├── validator.js
│   │   └── errorHandler.js
│   ├── routes/                    # 🛤️ Route definitions
│   │   └── index.js
│   ├── config/                    # 🔒 Configuration
│   │   ├── database.js
│   │   └── security.js
│   └── utils/                     # 🔒 Hash, tokens, helpers
│       └── helpers.js
├── database/
│   ├── config.js                  # Migration CLI config
│   ├── migrations/
│   ├── seeds/
│   └── backups/                   # 🗄️ Backup files (full / partial / journal)
├── public/                        # ✅ Static files only
├── logs/                          # 📋 Not versioned
└── tests/
    ├── unit/
    └── integration/
```

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        HTTP REQUEST                         │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  🛤️ ROUTES          Route to correct controller             │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  🔒 MIDDLEWARES      Validation, Auth, Rate Limiting        │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  🎮 CONTROLLERS      HTTP handling (req/res) only           │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ SERVICES         Business logic, business rules         │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  📦 REPOSITORIES     Data access abstraction (CRUD)         │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  📊 MODELS           outlet-orm (User, Post, etc.)          │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                        DATABASE                             │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

| Layer | Files | Responsibility | Security |
|-------|-------|----------------|----------|
| **Controllers** |`src/controllers/`| HTTP only (req/res) | Input validation |
| **Services** |`src/services/`| Business logic, rules | Authorisation |
| **Repositories** |`src/repositories/`| DB abstraction, queries | Sanitisation |
| **Models** |`src/models/`| Data structure, relationships | Fillable/Hidden |
| **Middlewares** |`src/middlewares/`| Auth, validation, errors | 🔒 **Critical** |
| **Config** |`src/config/`| Environment variables | 🔒 Reads .env |
| **Utils** |`src/utils/`| Hash, tokens, helpers | 🔒 Never expose |
| **Backups** |`database/backups/`| Backup files (.sql, .json, .enc) | 🗄️ Encrypted at rest |

### Quick Setup Commands

```bash
# Initialise project structure
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
| 9 | Backup & Restore | MEDIUM | [BACKUP.md](BACKUP.md) |

---

## References

- <https://github.com/omgbwa-yasse/outlet-orm>
- <https://www.npmjs.com/package/outlet-orm>
- <https://github.com/omgbwa-yasse/outlet-orm/blob/main/docs/INDEX.md>

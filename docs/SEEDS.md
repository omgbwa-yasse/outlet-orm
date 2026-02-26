# Seeds Guide - Outlet ORM

## 🌱 Overview

Seeds let you inject initial data (demo, test, bootstrap data) into your database.

> 📁 **Location**:`database/seeds/`
>
> 🔁 **Command**:`outlet-migrate seed`(alias`outlet-migrate db:seed`)

## 🚀 CLI commands

```bash
# Create a seeder
outlet-migrate make:seed UserSeeder

# Run seeds (DatabaseSeeder is prioritised)
outlet-migrate seed

# Run a specific seeder
outlet-migrate seed --class UserSeeder

# Short alias
outlet-migrate seed -c UserSeeder
```

## Recommended structure

```text
database/
├── migrations/
└── seeds/
    ├── DatabaseSeeder.js
    ├── UserSeeder.js
    └── RoleSeeder.js
```

## Example: simple seeder

```javascript
const { Seeder } = require('outlet-orm');

class UserSeeder extends Seeder {
  async run() {
    await this.insert('users', [
      { name: 'Admin', email: 'admin@example.com' },
      { name: 'Demo', email: 'demo@example.com' }
    ]);
  }
}

module.exports = UserSeeder;
```

## Example: DatabaseSeeder (execution order)

```javascript
const { Seeder } = require('outlet-orm');

class DatabaseSeeder extends Seeder {
  async run() {
    await this.call('RoleSeeder');
    await this.call('UserSeeder');
  }
}

module.exports = DatabaseSeeder;
```

## Truncate / reset tables

```javascript
const { Seeder } = require('outlet-orm');

class UserSeeder extends Seeder {
  async run() {
    await this.truncate('users');

    await this.insert('users', [
      { name: 'Admin', email: 'admin@example.com' }
    ]);
  }
}

module.exports = UserSeeder;
```

## Migration + seed workflow

```bash
# 1) Update schema
outlet-migrate migrate

# 2) Inject initial data
outlet-migrate seed
```

To reset locally from scratch:

```bash
outlet-migrate fresh --yes
outlet-migrate seed
```

## Best practice

- Centralise orchestration in`DatabaseSeeder`.
- Respect FK dependency order (parents before children).
- Keep seeders idempotent (avoid duplicates, rely on unique constraints).
- Keep heavy bulk data in dedicated scripts, not bootstrap seeders.

## Quick troubleshooting

- **Seeder not found**: verify`database/seeds`and the name passed via`--class`.
- **No seeders found**: create`database/seeds/DatabaseSeeder.js`.
- **FK error**: reorder calls in`DatabaseSeeder`.
- **Duplicates**: add idempotent logic and/or unique keys.

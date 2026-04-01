# Outlet ORM - Seeders

[← Back to Index](SKILL.md) | [Previous: Migrations](MIGRATIONS.md)

## When to use seeders

Use seeders to:

- bootstrap reference data;
- prepare local development environments quickly;
- initializes integration test fixtures.

## CLI commands

```bash
# Create a seeder file
outlet-migrate make:seed UserSeeder

# Run all seeders (DatabaseSeeder is prioritised)
outlet-migrate seed

# Laravel-style alias
outlet-migrate db:seed

# Run one specific seeder
outlet-migrate seed --class UserSeeder
outlet-migrate seed -c UserSeeder
```

## Folder convention

```text
database/
├── migrations/
└── seeds/
    ├── DatabaseSeeder.js
    ├── RoleSeeder.js
    └── UserSeeder.js
```

## Seeder API quick reference

-`this.insert(table, rowOrRows)`inserts one row or many rows;
-`this.call('OtherSeeder')`runs another seeder;
-`this.truncate(table)`clears a table before re-seeding.

## Seeder example

```javascript
const { Seeder } = require('outlet-orm');

class RoleSeeder extends Seeder {
  async run() {
    await this.insert('roles', [
      { name: 'admin' },
      { name: 'editor' }
    ]);
  }
}

module.exports = RoleSeeder;
```

## DatabaseSeeder orchestration

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

## Recommended flow

```bash
outlet-migrate migrate
outlet-migrate seed
```

For a clean local reset:

```bash
outlet-migrate fresh --yes
outlet-migrate seed
```

## Best practice

- Keep seeders deterministic and idempotent.
- Control FK order explicitly in`DatabaseSeeder`.
- Keep heavy bulk data in dedicated import scripts.
- Prefer unique constraints to prevent duplicate seed data.

---

## AI Seeder — LLM-Powered Data Generation

> Since v8.0.0

Generate realistic domain-specific seed data using AI instead of generic lorem ipsum.

```javascript
const { AIManager, AISeeder, DatabaseConnection } = require('outlet-orm');

const ai = new AIManager({
  providers: { openai: { api_key: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' } }
});
const seeder = new AISeeder(ai, new DatabaseConnection());

// Generate and insert 10 realistic user records
const { records, inserted } = await seeder.seed('users', 10, {
  domain: 'e-commerce',
  locale: 'fr_FR',
  description: 'An online fashion store'
});

// Preview without inserting
const preview = await seeder.generate('products', 5, {
  domain: 'electronics'
});
```

### AI Seeder API

| Method | Returns | Description |
|--------|---------|-------------|
|`using(provider, model)`| `this` | Set LLM provider |
|`seed(table, count, context)`| `{ records, inserted }` | Generate + insert |
|`generate(table, count, context)`| `Array<Object>` | Generate only (preview) |

### Context Options

| Option | Type | Description |
|--------|------|-------------|
| `domain` | `string` | Business domain (`'e-commerce'`, `'healthcare'`, `'finance'`) |
| `locale` | `string` | Locale for names/addresses (`'fr_FR'`, `'ja_JP'`, `'pt_BR'`) |
| `description` | `string` | Detailed description for better data quality |

See [AI.md](AI.md) for full details.

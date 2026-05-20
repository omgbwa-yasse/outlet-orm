# Seeds Reference

## When to read this document

Read this resource if the request is about `Seeder`, `SeederManager`, `make:seed`, `seed`, `db:seed`, `--class`, `--seeder`, or `AISeeder` for dataset generation.

Do not use it as the main entry point for:

- SQL structure changes: see `MIGRATIONS.md`
- LLM providers and the general AI layer: see `AI.md`
- global CLI commands not related to seeding: see `CLI.md`

## Scope

This document covers:

- `Seeder`
- `SeederManager`
- seeder scaffolding
- targeted seeder execution
- surfaces related to `AISeeder`

## Base Seeder

Standard pattern:

```js
const { Seeder } = require('outlet-orm');

class UserSeeder extends Seeder {
  async run() {
    await this.insert('users', [
      { name: 'Ada', email: 'ada@example.com' }
    ]);
  }
}

module.exports = UserSeeder;
```

Typical base operations:

- `run()` - required entry point
- insertion helpers through the connection / schema depending on the base implementation
- invocation through `SeederManager`

## SeederManager

Capabilities:

- execution of all seeders
- execution of a targeted seeder by class name
- integration with `migrate --seed`, `refresh --seed`, and `fresh --seed`

Related CLI commands:

- `outlet migrate seed`
- `outlet migrate db:seed`
- `outlet migrate seed --class=UserSeeder`
- `outlet migrate make:seed UserSeeder`

Aliases and targeting:

- `--class=Name`
- `--seeder=Name`

## Scaffolding

The command:

```bash
outlet migrate make:seed UserSeeder
```

generates a file in `database/seeds/` with a `class ... extends Seeder` skeleton.

## Integration with migrations

Workflow options:

- `migrate --seed`
- `refresh --seed`
- `fresh --seed`
- `--seeder=SpecificSeeder`

Use cases:

- inserting reference datasets after a migration
- loading a single seeder for one environment or one test

## AISeeder

The package also exposes `AISeeder` for LLM-driven generation of plausible data.

Expected capabilities:

- `seed()` - generation plus insertion
- `generate()` - generation only for preview / review

Use cases:

- quickly populating a demo
- creating semi-realistic test data
- preparing domain-specific datasets

Recommendations:

- use `generate()` to validate a prompt before a large insert
- prefer classic deterministic seeders for critical reference datasets
- reserve `AISeeder` for demo, lab, or enriched seed datasets

## Recommended patterns

- keep seeders idempotent when possible
- separate reference seeders from demo seeders
- use `make:seed` to keep repository structure consistent
- limit external side effects inside `run()`

## Source files to read

- `src/Seeders/Seeder.js`
- `src/Seeders/SeederManager.js`
- `src/AI/AISeeder.js`
- `bin/migrate.js`
- `tests/AiBridge.test.js`

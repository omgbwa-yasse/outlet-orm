# AI Seeder — LLM-Powered Realistic Data Generation

> **Since v8.0.0** — Generate realistic, domain-specific seed data using AI instead of generic lorem ipsum.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [Constructor](#constructor)
  - [Methods](#methods)
- [How It Works](#how-it-works)
  - [LLM Parameters](#llm-parameters)
- [Examples](#examples)
  - [E-Commerce Products](#e-commerce-products)
  - [Multi-Locale Data](#multi-locale-data)
  - [Blog Content](#blog-content)
  - [Using Different Providers](#using-different-providers)
  - [Healthcare Data](#healthcare-data)
- [Best Practices](#best-practices)
- [See Also](#see-also)

---

## Overview

The `AISeeder` uses LLM providers to generate contextual, realistic seed data for your database tables. Instead of generic faker data, you get:

- **Domain-aware** data (e-commerce products, medical records, financial transactions, etc.)
- **Locale-specific** data (French names, Japanese addresses, etc.)
- **Schema-respecting** data (correct types, NOT NULL constraints, FK conventions)
- **Diverse and creative** data (high temperature for variety)

## Quick Start

```javascript
const { AIManager, AISeeder, DatabaseConnection } = require('outlet-orm');

const ai = new AIManager({
  providers: {
    openai: { api_key: process.env.OPENAI_API_KEY, model: 'gpt-4o-mini' }
  }
});
const db = new DatabaseConnection();

const seeder = new AISeeder(ai, db);

// Generate and insert 10 realistic user records
const { records, inserted } = await seeder.seed('users', 10, {
  domain: 'e-commerce',
  locale: 'en_US'
});

console.log(`Inserted ${inserted} records`);
console.log(records[0]);
// { name: 'Sarah Chen', email: 'sarah.chen@outlook.com', role: 'customer', ... }
```

---

## API Reference

### Constructor

```javascript
new AISeeder(manager, connection)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `manager` | `AIManager` | Configured AI manager instance |
| `connection` | `DatabaseConnection` | Database connection instance |

### Methods

#### `using(provider, model)`

Set the LLM provider and model to use for data generation.

```javascript
seeder.using('openai', 'gpt-4o');
seeder.using('claude', 'claude-sonnet-4-20250514');
seeder.using('ollama', 'llama3');
```

Returns `this` (chainable).

---

#### `seed(table, count, context)`

Generate realistic records **and insert them** into the database.

```javascript
const { records, inserted } = await seeder.seed('products', 20, {
  domain: 'electronics',
  locale: 'en_US',
  description: 'An online electronics store selling smartphones, laptops, and accessories'
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `table` | `string` | Target table name |
| `count` | `number` | Number of records to generate |
| `context` | `Object` | Optional generation context |

**Context options:**

| Option | Type | Description |
|--------|------|-------------|
| `description` | `string` | Domain description to guide data generation |
| `locale` | `string` | Locale for name/address generation (e.g., `'fr_FR'`, `'ja_JP'`) |
| `domain` | `string` | Business domain (e.g., `'e-commerce'`, `'healthcare'`, `'finance'`) |

**Returns:**

```javascript
{
  records: [{ name: 'iPhone 15 Pro', price: 999.99, ... }, ...],
  inserted: 20
}
```

---

#### `generate(table, count, context)`

Generate records **without inserting** them. Useful for preview or custom processing.

```javascript
const records = await seeder.generate('users', 5, {
  domain: 'social-network',
  locale: 'fr_FR',
  description: 'A French social media platform for photographers'
});

console.log(records);
// [
//   { name: 'Marie Dubois', email: 'marie.dubois@gmail.com', bio: 'Photographe passionnée...' },
//   { name: 'Pierre Martin', email: 'p.martin@outlook.fr', bio: 'Amateur de paysages...' },
//   ...
// ]

// Process or review before inserting
for (const record of records) {
  await db.insert('users', record);
}
```

**Returns:** `Array<Object>` — Array of generated records.

---

## How It Works

1. **Schema introspection**: The seeder reads your table's column definitions (names, types, nullable, etc.)
2. **Prompt construction**: It sends the schema + your context to the LLM with instructions to generate realistic data
3. **JSON parsing**: The LLM response is parsed as a JSON array of records
4. **Type coercion**: Generated values are coerced to match column types
5. **Batch insert**: Records are inserted into the database

### LLM Parameters

- **Temperature**: `0.8` (high for creative, diverse data)
- **System prompt**: Includes table schema, column constraints, and context hints

---

## Examples

### E-Commerce Products

```javascript
const { records } = await seeder.seed('products', 15, {
  domain: 'e-commerce',
  description: 'An online fashion store for young adults',
  locale: 'en_US'
});

// [
//   { name: 'Vintage Denim Jacket', price: 79.99, category_id: 2, sku: 'VDJ-001', ... },
//   { name: 'Retro Sneakers', price: 129.00, category_id: 3, sku: 'RS-042', ... },
//   ...
// ]
```

### Multi-Locale Data

```javascript
// French users
await seeder.seed('users', 10, { locale: 'fr_FR', domain: 'saas' });

// Japanese users
await seeder.seed('users', 10, { locale: 'ja_JP', domain: 'saas' });

// Brazilian users
await seeder.seed('users', 10, { locale: 'pt_BR', domain: 'saas' });
```

### Blog Content

```javascript
const posts = await seeder.generate('posts', 5, {
  domain: 'tech-blog',
  description: 'A developer blog about Node.js, TypeScript, and cloud computing'
});

// [
//   {
//     title: 'Building Scalable APIs with Fastify and TypeScript',
//     body: 'In this tutorial, we will explore...',
//     slug: 'building-scalable-apis-fastify-typescript',
//     status: 'published',
//     author_id: 1,
//     ...
//   },
//   ...
// ]
```

### Using Different Providers

```javascript
// OpenAI (best quality)
await seeder.using('openai', 'gpt-4o').seed('users', 20);

// Claude (great for creative content)
await seeder.using('claude', 'claude-sonnet-4-20250514').seed('posts', 10, {
  domain: 'blog'
});

// Local Ollama (free, private)
await seeder.using('ollama', 'llama3').seed('products', 50, {
  domain: 'e-commerce'
});
```

### Healthcare Data

```javascript
const { records } = await seeder.seed('patients', 10, {
  domain: 'healthcare',
  description: 'A hospital management system',
  locale: 'en_US'
});

// [
//   { first_name: 'Emily', last_name: 'Rodriguez', dob: '1985-03-12', blood_type: 'A+', ... },
//   ...
// ]
```

---

## Best Practices

1. **Be specific in descriptions** — The more context you provide, the better the data quality
2. **Use appropriate locales** — Match the locale to your target audience
3. **Review generated data** — Use `generate()` first to preview before inserting
4. **Use domain hints** — Domain names like `'e-commerce'`, `'healthcare'`, `'finance'` guide the LLM
5. **Batch appropriately** — Generate in batches of 10–50 for best quality; very large counts may produce repetitive data
6. **Consider foreign keys** — Ensure referenced records exist before seeding dependent tables

---

## See Also

- [AI Manager](AI_BRIDGE.md) — Multi-provider LLM configuration
- [Seeds Guide](SEEDS.md) — Traditional seeding with DatabaseSeeder
- [AI Prompt Enhancer](AI_PROMPT.md) — AI-powered schema and code generation
- [AI Query Builder](AI_QUERY.md) — Natural language to SQL

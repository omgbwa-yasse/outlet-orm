# AI Prompt Enhancer — Schema & Code Generation from Natural Language

> **Since v8.0.0** — Generate complete database schemas, model code, and migration code from natural language descriptions using AI.

## Overview

The `AIPromptEnhancer` extends the regex-based `PromptGenerator` with LLM capabilities. Given a natural language description of your application, it:

- **Generates schemas** with tables, columns, relationships, and seed hints
- **Generates model code** for outlet-orm Model classes
- **Generates migration code** for outlet-orm Migration files

Unlike the regex-based `PromptGenerator` (which matches against 7 pre-built domain templates), the `AIPromptEnhancer` can handle any application description and generate custom schemas.

## Quick Start

```javascript
const { AiBridgeManager, AIPromptEnhancer } = require('outlet-orm');

const ai = new AiBridgeManager({
  providers: {
    openai: { api_key: process.env.OPENAI_API_KEY, model: 'gpt-4o' }
  }
});

const enhancer = new AIPromptEnhancer(ai);

// Generate a complete schema from description
const schema = await enhancer.generateSchema(
  'A veterinary clinic management system with pets, owners, appointments, and medical records'
);

console.log(schema.tables);    // { pets: {...}, owners: {...}, ... }
console.log(schema.relations); // [{ type: 'belongsTo', ... }, ...]
console.log(schema.seedHints); // { pets: 'domestic animals...', ... }
```

---

## API Reference

### Constructor

```javascript
new AIPromptEnhancer(manager)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `manager` | `AiBridgeManager` | Configured AiBridge manager instance |

### Methods

#### `using(provider, model)`

Set the LLM provider and model.

```javascript
enhancer.using('openai', 'gpt-4o');
enhancer.using('claude', 'claude-sonnet-4-20250514');
```

Returns `this` (chainable).

---

#### `generateSchema(description, options)`

Generate a complete relational database schema from a natural language description.

```javascript
const schema = await enhancer.generateSchema(
  'An online bookstore with books, authors, categories, reviews, and user wishlists'
);
```

**Returns:**

```javascript
{
  tables: {
    users: {
      columns: [
        'id:increments',
        'name:string:255',
        'email:string:255:unique',
        'password:string:255',
        'created_at:timestamps',
        'updated_at:timestamps'
      ]
    },
    books: {
      columns: [
        'id:increments',
        'title:string:255',
        'isbn:string:20:unique',
        'author_id:integer:unsigned',
        'category_id:integer:unsigned',
        'price:decimal:8,2',
        'description:text:nullable',
        'published_at:date:nullable',
        'created_at:timestamps',
        'updated_at:timestamps'
      ]
    },
    // ... authors, categories, reviews, wishlists, wishlist_book
  },

  relations: [
    { type: 'hasMany', from: 'users', to: 'reviews', foreignKey: 'user_id' },
    { type: 'belongsTo', from: 'books', to: 'authors', foreignKey: 'author_id' },
    { type: 'belongsTo', from: 'books', to: 'categories', foreignKey: 'category_id' },
    { type: 'belongsToMany', from: 'users', to: 'books', pivot: 'wishlist_book' },
    // ...
  ],

  seedHints: {
    users: 'Book lovers and reviewers with diverse reading preferences',
    books: 'Mix of fiction, non-fiction, technical, and classic literature',
    authors: 'Famous and indie authors across various genres',
    // ...
  }
}
```

**Schema format:**

- `tables`: Object keyed by table name, each with `columns` array in `"name:type:modifiers"` format
- `relations`: Array of relationship definitions (`hasOne`, `hasMany`, `belongsTo`, `belongsToMany`)
- `seedHints`: Descriptions per table (useful for AI Seeder)

---

#### `generateModelCode(tableName, tableSchema, relations)`

Generate outlet-orm Model class source code from a table schema.

```javascript
const code = await enhancer.generateModelCode('books', schema.tables.books, [
  { type: 'belongsTo', from: 'books', to: 'authors', foreignKey: 'author_id' },
  { type: 'belongsTo', from: 'books', to: 'categories', foreignKey: 'category_id' },
  { type: 'hasMany', from: 'books', to: 'reviews', foreignKey: 'book_id' }
]);

console.log(code);
```

**Output:**

```javascript
const { Model } = require('outlet-orm');

class Book extends Model {
  static table = 'books';
  static fillable = ['title', 'isbn', 'author_id', 'category_id', 'price', 'description', 'published_at'];
  static hidden = [];
  static casts = {
    id: 'int',
    author_id: 'int',
    category_id: 'int',
    price: 'float',
    published_at: 'date'
  };

  author() {
    return this.belongsTo(Author, 'author_id');
  }

  category() {
    return this.belongsTo(Category, 'category_id');
  }

  reviews() {
    return this.hasMany(Review, 'book_id');
  }
}

module.exports = Book;
```

---

#### `generateMigrationCode(tableName, tableSchema)`

Generate outlet-orm Migration file source code from a table schema.

```javascript
const code = await enhancer.generateMigrationCode('books', schema.tables.books);
console.log(code);
```

**Output:**

```javascript
const { Migration } = require('outlet-orm');

class CreateBooksTable extends Migration {
  async up(schema) {
    await schema.create('books', (table) => {
      table.id();
      table.string('title', 255);
      table.string('isbn', 20).unique();
      table.integer('author_id').unsigned();
      table.integer('category_id').unsigned();
      table.decimal('price', 8, 2);
      table.text('description').nullable();
      table.date('published_at').nullable();
      table.timestamps();

      table.foreign('author_id').references('id').on('authors');
      table.foreign('category_id').references('id').on('categories');
    });
  }

  async down(schema) {
    await schema.dropIfExists('books');
  }
}

module.exports = CreateBooksTable;
```

---

## Complete Workflow Example

Generate a full project from a description:

```javascript
const { AiBridgeManager, AIPromptEnhancer, AISeeder } = require('outlet-orm');
const fs = require('fs');
const path = require('path');

const ai = new AiBridgeManager({ /* config */ });
const enhancer = new AIPromptEnhancer(ai);
const seeder = new AISeeder(ai, db);

// 1. Generate schema
const schema = await enhancer.generateSchema(
  'A restaurant reservation system with restaurants, tables, customers, reservations, and reviews'
);

// 2. Generate migrations
for (const [table, tableSchema] of Object.entries(schema.tables)) {
  const code = await enhancer.generateMigrationCode(table, tableSchema);
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  fs.writeFileSync(
    path.join('database/migrations', `${timestamp}_create_${table}_table.js`),
    code
  );
}

// 3. Generate models
for (const [table, tableSchema] of Object.entries(schema.tables)) {
  const rels = schema.relations.filter(r => r.from === table);
  const code = await enhancer.generateModelCode(table, tableSchema, rels);
  const className = table.charAt(0).toUpperCase() + table.slice(1).replace(/s$/, '');
  fs.writeFileSync(path.join('src/models', `${className}.js`), code);
}

// 4. Seed with AI
for (const [table, hint] of Object.entries(schema.seedHints)) {
  await seeder.seed(table, 10, { description: hint });
}
```

---

## PromptGenerator (Regex-Based Alternative)

For offline/no-LLM scaffolding, use the built-in `PromptGenerator`:

```javascript
const { PromptGenerator } = require('outlet-orm');

// Parse description and match to a domain blueprint
const blueprint = PromptGenerator.parse(
  'Create a blog with posts, comments, and tags'
);
// blueprint.domain = 'blog', blueprint.tables = [...], blueprint.score = 0.85

// Generate files
PromptGenerator.generateModels(blueprint, './src/models');
PromptGenerator.generateMigrations(blueprint, './database/migrations');
PromptGenerator.generateSeeder(blueprint, './database/seeds');
```

### Built-in Domain Patterns

| Domain | Tables |
|--------|--------|
| **E-commerce** | users, products, categories, orders, order_items, payments |
| **Blog/CMS** | users, posts, categories, tags, post_tag, comments |
| **Task/Project** | users, projects, tasks, labels, task_label |
| **Social Network** | users, posts, comments, likes, follows, messages |
| **SaaS/Multi-tenant** | organizations, users, plans, subscriptions, invoices |
| **Habit Tracker** | users, habits, logs, goals |
| **API/Auth** (default) | users, tokens, password_resets |

### CLI Usage

```bash
# Generate from prompt (uses PromptGenerator)
outlet-init --prompt "Create an e-commerce platform with products and orders"

# Specify database driver
outlet-init --prompt "Blog with posts and comments" --driver sqlite
```

---

## AI vs Regex Comparison

| Feature | `PromptGenerator` (regex) | `AIPromptEnhancer` (LLM) |
|---------|---------------------------|---------------------------|
| LLM required | No | Yes |
| Custom domains | Limited to 7 templates | Unlimited |
| Column detail | Template-based | Context-aware |
| Relationships | Template-based | Inferred from description |
| Seed hints | None | Generated |
| Offline | Yes | No |
| Speed | Instant | 5–30 seconds |
| Cost | Free | Provider API costs |

---

## See Also

- [AiBridge Manager](AI_BRIDGE.md) — Multi-provider LLM configuration
- [AI Seeder](AI_SEEDER.md) — Seed generated schemas with realistic data
- [Migrations Guide](MIGRATIONS.md) — Run generated migrations
- [Models Guide](MODELS.md) — Understanding generated model code
- [CLI Guide](CLI.md) — `outlet-init --prompt` usage

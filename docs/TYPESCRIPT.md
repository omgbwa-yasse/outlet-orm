# 📘 TypeScript

Outlet ORM v4.0.0 includes full TypeScript definitions with support for **generics for typed attributes**.

> 📁 **Recommended location**:`models/`,`controllers/`,`services/`and`src/`— See [Project structure](INSTALLATION.md#structure-de-projet-recommended)

## Table of Contents

- [What’s new v4.0.0](#whats-new-v400)
- [Installation](#installation)
- [TypeScript setup](#typescript-setup)
- [Generic Model (v4.0.0+)](#generic-model-v400)
  - [Define an attribute interface](#define-an-attribute-interface)
  - [Create a typed model](#create-a-typed-model)
  - [Type-safe getAttribute/setAttribute](#type-safe-getattributesetattribute)
- [Basic Usage](#basic-usage)
  - [Import](#import)
  - [Define a template](#define-a-template)
  - [Use template](#use-template)
- [Types available](#types-available)
  - [ValidationResult](#validationresult)
  - [PaginationResult](#paginationresult)
  - [QueryLogEntry](#querylogentry)
  - [EventCallback](#eventcallback)
- [Templates with generics](#templates-with-generics)
- [DatabaseConnection](#databaseconnection)
- [Transactions](#transactions)
- [Typed relationships](#typed-relationships)
- [Typed scopes](#typed-scopes)
- [Typed validation](#typed-validation)
- [Schema Builder typed (v4.0.0+)](#schema-builder-typed-v400)
  - [Available interfaces](#available-interfaces)
  - [Creating tables](#creating-tables)
  - [Foreign keys](#foreign-keys)
  - [Editing tables](#editing-tables)
- [Typed migrations (v4.0.0+)](#typed-migrations-v400)
  - [Structure of a migration](#structure-of-a-migration)
  - [Full migration with relationships](#full-migration-with-relationships)
  - [Table pivot many-to-many](#table-pivot-many-to-many)
- [Full example](#full-example)
- [Next steps](#next-steps)

---

## What’s new v4.0.0

- ✅ **Generic Model**: Type your attributes with`Model<TAttributes>`
- ✅ **Type-safe`getAttribute/setAttribute`**: Autocompletion and type checking
- ✅ **Typed Schema Builder**: Complete interfaces for migrations
- ✅ **Constrained event names**:`ModelEventName`union type
- ✅ **WHERE operators typed**:`WhereOperator`union type
- ✅ **Extended validation rules**:`url`,`array`,`integer`, etc.

## Installation

The types are included in the package:

```bash
npm install outlet-orm
```

No installation of`@types/outlet-orm`is not necessary.

## TypeScript setup

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

---

## Generic Model (v4.0.0+)

### Define an attribute interface

```typescript
interface UserAttributes {
  id: number;
  name: string;
  email: string;
  password: string;
  age?: number;
  role: 'admin' | 'user' | 'moderator';
  created_at: Date;
  updated_at: Date;
}
```

### Create a typed model

```typescript
import { Model, HasManyRelation, HasOneRelation } from 'outlet-orm';

class User extends Model<UserAttributes> {
  static readonly table = 'users';
  static readonly fillable = ['name', 'email', 'password', 'age', 'role'];
  static readonly hidden = ['password'];
  
  static readonly casts = {
    id: 'int' as const,
    age: 'int' as const,
    created_at: 'datetime' as const,
    updated_at: 'datetime' as const
  };

  posts(): HasManyRelation<Post> {
    return this.hasMany(Post, 'user_id');
  }
}
```

### Type-safe getAttribute/setAttribute

```typescript
const user = await User.find(1);

if (user) {
  // ✅ TypeScript knows types
  const name: string = user.name;
  const age: number | undefined = user.age;
  const role: 'admin' | 'user' | 'moderator' = user.role;

  // ✅ Type-safe setAttribute
  user.name = 'New Name';
  user.age = 30;
  
  // ❌ TypeScript error: Argument of type '"invalid"' is not assignable
  // user.role = 'invalid';
  
  await user.save();
}
```

---

## Basic Usage

### Import

```typescript
import {
  Model,
  QueryBuilder,
  DatabaseConnection,
  HasOneRelation,
  HasManyRelation,
  BelongsToRelation,
  BelongsToManyRelation,
  SchemaBuilder,
  TableBuilder,
  MigrationInterface
} from 'outlet-orm';
```

### Define a template

```typescript
import { 
  Model,
  HasOneRelation,
  HasManyRelation,
  BelongsToRelation,
  BelongsToManyRelation 
} from 'outlet-orm';

// Defining linked models
class Post extends Model {
  static table = 'posts';
}

class Profile extends Model {
  static table = 'profiles';
}

class Role extends Model {
  static table = 'roles';
}

interface UserAttributes {
  id: number;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

class User extends Model<UserAttributes> {
  static table = 'users';
  static primaryKey = 'id';
  static timestamps = true;
  
  static fillable = ['name', 'email', 'password', 'role'];
  static hidden = ['password'];
  
  static rules = {
    name: 'required|string|min:2',
    email: 'required|email',
    password: 'required|string|min:8'
  };

  static casts = {
    id: 'int' as const,
    created_at: 'date' as const,
    updated_at: 'date' as const
  };

  // Typed relationships
  posts(): HasManyRelation<Post> {
    return this.hasMany(Post, 'user_id');
  }

  profile(): HasOneRelation<Profile> {
    return this.hasOne(Profile, 'user_id');
  }

  roles(): BelongsToManyRelation<Role> {
    return this.belongsToMany(Role, 'role_user', 'user_id', 'role_id');
  }
}

export default User;
```

### Use template

```typescript
import User from './models/User';

async function main() {
  // Create
  const user = await User.create({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'hashedpassword123'
  });

  // The ID is typed
  const id: number = user.id;

  // To recover
  const foundUser = await User.find(1);
  if (foundUser) {
    const name: string = founduser.name;
  }

  // Query Builder with types
  const activeUsers = await User
    .where('status', 'active')
    .orderBy('created_at', 'desc')
    .limit(10)
    .get();

  // activeUsers is User[]
  for (const u of activeUsers) {
    console.log(u.email);
  }
}
```

## Types available

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  errors: {
    [field: string]: string[];
  };
}

// Usage
const user = new User({ name: '' });
const result: ValidationResult = user.validate();

if (!result.valid) {
  console.log(result.errors);
}
```

### PaginationResult

```typescript
interface PaginationResult {
  data: Model[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
  from: number;
  to: number;
}

// Usage
const result: PaginationResult = await User.paginate(1, 15);
console.log(`Page ${result.current_page} of ${result.last_page}`);
```

### QueryLogEntry

```typescript
import { Model } from 'outlet-orm';

interface QueryLogEntry {
  sql: string;
  bindings: any[];
  time: number;
}

// Usage
const db = Model.getConnection();
db.enableQueryLog();

// ... queries ...

const queries: QueryLogEntry[] = db.getQueryLog();
queries.forEach(q => {
  console.log(`${q.sql} (${q.time}ms)`);
});
```

### EventCallback

```typescript
type EventCallback = (model: Model) => void | false | Promise<void | false>;

// Usage
User.creating((user: Model): void | false => {
  if (!user.email) {
    return false; // Cancel creation
  }
});
```

## Templates with generics

```typescript
import { Model } from 'outlet-orm';

// Attributes interface
interface PostAttributes {
  id: number;
  title: string;
  content: string;
  user_id: number;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

class Post extends Model {
  static table = 'posts';
  
  // Strong typing with getter
  get id(): number {
    return this.attributes.id as number;
  }

  get title(): string {
    return this.attributes.title as string;
  }

  set title(value: string) {
    this.attributes.title = value;
  }

  get status(): PostAttributes['status'] {
    return this.attributes.status as PostAttributes['status'];
  }

  // Typed methods
  isPublished(): boolean {
    return this.status === 'published';
  }

  async publish(): Promise<void> {
    this.status = 'published';
    this.published_at = new Date().toISOString();
    await this.save();
  }
}
```

## DatabaseConnection

```typescript
import { DatabaseConnection } from 'outlet-orm';

interface MySQLConfig {
  driver: 'mysql';
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface PostgresConfig {
  driver: 'pg';
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  poolSize?: number;
}

interface SQLiteConfig {
  driver: 'sqlite';
  filename: string;
}

type DatabaseConfig = MySQLConfig | PostgresConfig | SQLiteConfig;

// Usage
const config: DatabaseConfig = {
  driver: 'mysql',
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'myapp'
};

const db = new DatabaseConnection(config);
await db.connect();
```

## Transactions

```typescript
import { Model } from 'outlet-orm';

async function transferFunds(
  fromId: number,
  toId: number,
  amount: number
): Promise<void> {
  const db = Model.getConnection();

  await db.transaction(async (trx) => {
    await Account.useTransaction(trx)
      .where('id', fromId)
      .decrement('balance', amount);

    await Account.useTransaction(trx)
      .where('id', toId)
      .increment('balance', amount);

    await TransactionLog.useTransaction(trx).create({
      from_account_id: fromId,
      to_account_id: toId,
      amount,
      type: 'transfer'
    });
  });
}
```

## Typed relationships

```typescript
import { 
  Model,
  HasOneRelation,
  HasManyRelation,
  BelongsToRelation,
  BelongsToManyRelation,
  MorphManyRelation
} from 'outlet-orm';

// Defining linked models
class Profile extends Model { static table = 'profiles'; }
class Role extends Model { static table = 'roles'; }
class Comment extends Model { static table = 'comments'; }

class Post extends Model {
  static table = 'posts';

  // Belongs to
  author(): BelongsToRelation {
    return this.belongsTo(User, 'user_id');
  }

  // Polymorphic
  comments(): MorphManyRelation {
    return this.morphMany(Comment, 'commentable');
  }
}

class User extends Model {
  static table = 'users';

  // One-to-one
  profile(): HasOneRelation {
    return this.hasOne(Profile, 'user_id');
  }

  // One-to-many
  posts(): HasManyRelation {
    return this.hasMany(Post, 'user_id');
  }

  // Many-to-many
  roles(): BelongsToManyRelation {
    return this.belongsToMany(Role, 'role_user', 'user_id', 'role_id');
  }
}
```

## Typed scopes

```typescript
import { Model, QueryBuilder } from 'outlet-orm';

type ScopeFunction = (query: QueryBuilder) => QueryBuilder;

interface UserScopes {
  active: ScopeFunction;
  verified: ScopeFunction;
  admins: ScopeFunction;
}

class User extends Model {
  static table = 'users';

  static scopes: UserScopes = {
    active: (query) => query.where('status', 'active'),
    verified: (query) => query.whereNotNull('email_verified_at'),
    admins: (query) => query.where('role', 'admin')
  };
}

// Usage
const activeAdmins = await User.scope('active', 'admins').get();
```

## Typed validation

```typescript
interface ValidationRules {
  [field: string]: string;
}

class User extends Model {
  static table = 'users';

  static rules: ValidationRules = {
    name: 'required|string|min:2|max:100',
    email: 'required|email',
    password: 'required|string|min:8',
    age: 'integer|min:0|max:150'
  };
}

// To validate
const user = new User({ name: '', email: 'invalid' });
const result = user.validate();

if (!result.valid) {
  // result.errors is typed as { [field: string]: string[] }
  Object.entries(result.errors).forEach(([field, messages]) => {
    console.log(`${field}: ${messages.join(', ')}`);
  });
}
```

---

## Schema Builder typed (v4.0.0+)

The Schema Builder offers comprehensive TypeScript interfaces for creating type-safe migrations.

### Available interfaces

```typescript
import { 
  SchemaBuilder, 
  TableBuilder, 
  ColumnBuilder,
  ForeignKeyBuilder,
  MigrationInterface 
} from 'outlet-orm';
```

### Creating tables

```typescript
import { Schema } from 'outlet-orm';

await Schema.create('users', (table: TableBuilder) => {
  // Columns with types
  table.id();                                    // BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
  table.string('name', 100);                     // VARCHAR(100)
  table.string('email').unique();                // VARCHAR(255) UNIQUE
  table.string('password');
  table.text('bio').nullable();                  // TEXT NULL
  table.integer('age').unsigned();               // INT UNSIGNED
  table.decimal('balance', 10, 2).default('0');  // DECIMAL(10,2) DEFAULT '0'
  table.boolean('is_active').default(true);      // TINYINT(1) DEFAULT 1
  table.enum('status', ['active', 'inactive', 'banned']);
  table.json('settings').nullable();
  table.timestamps();                            // created_at, updated_at
  table.softDeletes();                           // deleted_at
  
  // Index
  table.index(['email', 'status']);
});
```

### Foreign keys

```typescript
await Schema.create('posts', (table: TableBuilder) => {
  table.id();
  table.string('title');
  table.text('content');
  table.unsignedBigInteger('user_id');
  table.unsignedBigInteger('category_id').nullable();
  table.timestamps();

  // Foreign keys with options
  table.foreign('user_id')
    .references('id')
    .on('users')
    .onDelete('CASCADE')
    .onUpdate('CASCADE');

  table.foreign('category_id')
    .references('id')
    .on('categories')
    .onDelete('SET NULL');
});
```

### Editing tables

```typescript
await Schema.table('users', (table: TableBuilder) => {
  table.string('phone', 20).nullable().after('email');
  table.dropColumn('bio');
  table.renameColumn('old_name', 'new_name');
  table.dropIndex('users_email_index');
});
```

---

## Typed migrations (v4.0.0+)

L'interface`MigrationInterface`guarantees a consistent structure for all your migrations.

### Structure of a migration

```typescript
import { MigrationInterface, Schema, TableBuilder } from 'outlet-orm';

export const migration: MigrationInterface = {
  name: 'create_users_table',
  
  async up(): Promise<void> {
    await Schema.create('users', (table: TableBuilder) => {
      table.id();
      table.string('name');
      table.string('email').unique();
      table.string('password');
      table.timestamps();
    });
  },

  async down(): Promise<void> {
    await Schema.dropIfExists('users');
  }
};
```

### Full migration with relationships

```typescript
import { MigrationInterface, Schema, TableBuilder } from 'outlet-orm';

// Migration for posts with foreign keys
export const postsTableMigration: MigrationInterface = {
  name: 'create_posts_table',
  
  async up(): Promise<void> {
    await Schema.create('posts', (table: TableBuilder) => {
      table.id();
      table.string('title', 200);
      table.text('content');
      table.string('slug').unique();
      table.unsignedBigInteger('user_id');
      table.unsignedBigInteger('category_id').nullable();
      table.enum('status', ['draft', 'published', 'archived']).default('draft');
      table.integer('views').unsigned().default(0);
      table.timestamps();
      table.softDeletes();

      // Composite index for performance
      table.index(['user_id', 'status']);
      table.index(['created_at']);

      // Foreign keys
      table.foreign('user_id')
        .references('id')
        .on('users')
        .onDelete('CASCADE');

      table.foreign('category_id')
        .references('id')
        .on('categories')
        .onDelete('SET NULL');
    });
  },

  async down(): Promise<void> {
    await Schema.dropIfExists('posts');
  }
};
```

### Table pivot many-to-many

```typescript
export const tagsTableMigration: MigrationInterface = {
  name: 'create_tags_and_pivot_table',
  
  async up(): Promise<void> {
    // Table tags
    await Schema.create('tags', (table: TableBuilder) => {
      table.id();
      table.string('name', 50).unique();
      table.string('slug', 50).unique();
      table.timestamps();
    });

    // Table pivot post_tag
    await Schema.create('post_tag', (table: TableBuilder) => {
      table.unsignedBigInteger('post_id');
      table.unsignedBigInteger('tag_id');
      table.timestamp('created_at').useCurrent();

      // Composite primary key
      table.primary(['post_id', 'tag_id']);

      // Foreign keys
      table.foreign('post_id')
        .references('id')
        .on('posts')
        .onDelete('CASCADE');

      table.foreign('tag_id')
        .references('id')
        .on('tags')
        .onDelete('CASCADE');
    });
  },

  async down(): Promise<void> {
    await Schema.dropIfExists('post_tag');
    await Schema.dropIfExists('tags');
  }
};
```

---

## Full example

```typescript
// models/index.ts
import { Model, DatabaseConnection, QueryBuilder } from 'outlet-orm';

// Configuration (optional if .env is configured)
const db = new DatabaseConnection({
  driver: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'myapp'
});

Model.setConnection(db);

// Post Model (defined first because referenced by User)
export class Post extends Model {
  static table = 'posts';
  static fillable = ['title', 'content', 'user_id', 'status'];
  static softDeletes = true;

  static scopes = {
    published: (q: QueryBuilder<Post>) => q.where('status', 'published'),
    draft: (q: QueryBuilder<Post>) => q.where('status', 'draft')
  };

  author() {
    return this.belongsTo(User, 'user_id');
  }
}

// User Model
export class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password'];
  static softDeletes = true;

  posts() {
    return this.hasMany(Post, 'user_id');
  }

  // Custom methods
  async getPostCount(): Promise<number> {
    return await Post.where('user_id', this.id).count();
  }
}

// Usage
async function main(): Promise<void> {
  await db.connect();

  // Create a user
  const user = await User.create({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'hashedpassword'
  });

  // Create posts
  await Post.create({
    title: 'Hello World',
    content: 'My first post',
    user_id: user.id,
    status: 'published'
  });

  // Typed queries
  const publishedPosts = await Post
    .scope('published')
    .with('author')
    .orderBy('created_at', 'desc')
    .get();

  for (const post of publishedPosts) {
    console.log(`${post.title} by ${post.author?.name}`);
  }

  await db.close();
}

main().catch(console.error);
```

## Next steps

- [API Reference](API_REFERENCE.md) - Full API reference
- [Models](MODELS.md) - Model Guide
- [Query Builder](QUERY_BUILDER.md) - Advanced queries

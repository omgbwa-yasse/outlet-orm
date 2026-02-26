# Outlet ORM - TypeScript Best Practices (v5.0.0)

[← Back to Index](SKILL.md) | [Previous: Advanced](ADVANCED.md)

> 🆕 **v5.0.0**: Full support for generics with`Model<TAttributes>`, Typed Schema Builder,`MigrationInterface`, and recommended layered architecture.

---

## What's New in v4.0.0

| Feature | Description |
|---------|-------------|
| **Generic Model** |`Model<TAttributes>`for typed attributes |
| **Type-safe getAttribute** | Returns correct type based on your interface |
| **Schema Builder** | Complete interfaces for typed migrations |
| **MigrationInterface** | Standard interface for TypeScript migrations |
| **ValidationRule** | Extended with`url`,`array`,`integer`,`alpha`, etc. |
| **ModelEventName** | Union type for all model events |
| **WhereOperator** | Union type for all comparison operators |

---

## Recommended Project Structure (Layered Architecture)

> 🔐 **Security**: See the Security Guide for TypeScript security patterns.

```
my-project/
├── .env                        # ⚠️ NEVER commit
├── .gitignore
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                # Entry point
│   ├── controllers/            # 🎮 HTTP handling only
│   │   └── UserController.ts
│   ├── services/               # ⚙️ Business logic
│   │   └── UserService.ts
│   ├── repositories/           # 📦 Data access layer
│   │   └── UserRepository.ts
│   ├── models/                 # 📊 Typed Model classes
│   │   ├── User.ts             # hidden: ['password']
│   │   └── Post.ts
│   ├── middlewares/            # 🔒 Auth, validation
│   │   ├── auth.ts
│   │   └── validator.ts
│   ├── config/                 # 🔒 Configuration
│   │   └── security.ts
│   ├── utils/                  # 🔒 Hash, tokens
│   │   ├── hash.ts
│   │   └── token.ts
│   └── types/                  # Custom TypeScript types
├── database/
│   └── migrations/
├── public/                     # ✅ Only public folder
├── logs/                       # 📋 Not versioned
└── tests/
```

---

## TypeScript Configuration

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Typed Model Definition

### Generic Model (v4.0.0+)

```typescript
import { Model, HasManyRelation, HasOneRelation } from 'outlet-orm';

// Define attribute interface
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

// Use generic Model<TAttributes>
class User extends Model<UserAttributes> {
  static readonly table = 'users';
  static readonly primaryKey = 'id';
  static readonly timestamps = true;
  
  static readonly fillable = ['name', 'email', 'password', 'age', 'role'];
  static readonly hidden = ['password'];
  
  static readonly casts = {
    id: 'int' as const,
    age: 'int' as const,
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
}

// Type-safe getAttribute/setAttribute
const user = await User.find(1);
if (user) {
  const name: string = user.getAttribute('name');     // ✅ Type inferred
  const role = user.getAttribute('role');             // ✅ Type: 'admin' | 'user' | 'moderator'
  
  user.setAttribute('name', 'New Name');              // ✅ Type-safe
  // user.setAttribute('role', 'invalid');            // ❌ TypeScript error
}

export default User;
export type { UserAttributes };
```

### Using`as const`for Casts

```typescript
// ✅ CORRECT - Preserves literal types
static readonly casts = {
  id: 'int' as const,
  email_verified: 'boolean' as const,
  metadata: 'json' as const
};

// ❌ WRONG - Inferred as string
static casts = {
  id: 'int',  // Type: string (not 'int')
};
```

---

## Query Builder with Types

### Type-Safe Queries

```typescript
import User from './models/User';

async function getActiveUsers(): Promise<User[]> {
  return User
    .where('status', 'active')
    .where('age', '>', 18)
    .orderBy('created_at', 'desc')
    .limit(10)
    .get();
}

// Pagination returns typed result
async function getPaginatedUsers(page: number) {
  const result = await User.paginate(page, 15);
  // result.data is User[]
  // result.total is number
  return result;
}
```

### Eager Loading with Types

```typescript
// Load relationships
const users = await User.with('posts', 'profile').get();

// With constraints
const usersWithRecentPosts = await User.with({
  posts: (qb) => qb.where('created_at', '>', '2024-01-01').orderBy('id', 'desc')
}).get();

// Access relationships
users.forEach(user => {
  const posts = user.relationships.posts as Post[];
  console.log(`${user.getAttribute('name')} has ${posts.length} posts`);
});
```

---

## Typed Migrations

### Migration Interface

```typescript
import { SchemaBuilder } from 'outlet-orm';

interface Migration {
  up(schema: SchemaBuilder): Promise<void>;
  down(schema: SchemaBuilder): Promise<void>;
}

const migration: Migration = {
  async up(schema) {
    await schema.createTable('users', (table) => {
      table.id();
      table.string('name', 100);
      table.string('email', 255).unique();
      table.string('password', 255);
      table.integer('age').nullable();
      table.enum('role', ['admin', 'user', 'moderator']).default('user');
      table.timestamps();
      
      table.index(['email']);
    });
  },

  async down(schema) {
    await schema.dropTableIfExists('users');
  }
};

export = migration;
```

---

## Validation with Types

### Typed Validation Rules

```typescript
import { Model, ValidationRule } from 'outlet-orm';

class User extends Model {
  static readonly table = 'users';
  
  // Type-safe validation rules
  static readonly rules: Record<string, string> = {
    name: 'required|string|min:2|max:100',
    email: 'required|email',
    password: 'required|string|min:8',
    age: 'integer|min:0|max:150',
    website: 'url',
    role: 'in:admin,user,moderator'
  };
}

// Validate before save
const user = new User({ name: 'J', email: 'invalid' });
const result = user.validate();

if (!result.valid) {
  console.error(result.errors);
  // { name: ['min:2'], email: ['email'] }
}
```

---

## Events with Types

### Typed Event Callbacks

```typescript
import { Model, EventCallback } from 'outlet-orm';

class User extends Model {
  static readonly table = 'users';

  static boot() {
    // Type-safe event registration
    this.creating((model: User) => {
      // Hash password before create
      const password = model.getAttribute('password');
      model.setAttribute('password', hashPassword(password));
      return true; // Continue
    });

    this.deleting((model: User) => {
      // Prevent admin deletion
      if (model.getAttribute('role') === 'admin') {
        return false; // Cancel deletion
      }
      return true;
    });
  }
}
```

---

## Relations Type Reference

| Relation | Return Type | Usage |
|----------|-------------|-------|
|`hasOne`|`HasOneRelation<T>`|`this.hasOne(Profile, 'user_id')`|
|`hasMany`|`HasManyRelation<T>`|`this.hasMany(Post, 'user_id')`|
|`belongsTo`|`BelongsToRelation<T>`|`this.belongsTo(User, 'user_id')`|
|`belongsToMany`|`BelongsToManyRelation<T>`|`this.belongsToMany(Role, 'user_roles')`|
|`hasManyThrough`|`HasManyThroughRelation<T>`|`this.hasManyThrough(Post, User)`|
|`hasOneThrough`|`HasOneThroughRelation<T>`|`this.hasOneThrough(Owner, Car)`|
|`morphOne`|`MorphOneRelation<T>`|`this.morphOne(Image, 'imageable')`|
|`morphMany`|`MorphManyRelation<T>`|`this.morphMany(Comment, 'commentable')`|
|`morphTo`|`MorphToRelation<T>`|`this.morphTo()`|

---

## Typed Migrations (v4.0.0+)

### MigrationInterface

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
      table.enum('role', ['admin', 'user', 'moderator']).default('user');
      table.timestamps();
      table.softDeletes();
    });
  },

  async down(): Promise<void> {
    await Schema.dropIfExists('users');
  }
};
```

### TableBuilder Methods

```typescript
// Column types
table.id();                                    // BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
table.string('name', 100);                     // VARCHAR(100)
table.text('content');                         // TEXT
table.integer('age').unsigned();               // INT UNSIGNED
table.decimal('price', 10, 2);                 // DECIMAL(10,2)
table.boolean('is_active').default(true);
table.json('settings').nullable();
table.enum('status', ['draft', 'published']);
table.timestamps();                            // created_at, updated_at
table.softDeletes();                           // deleted_at

// Modifiers
table.string('email').unique();
table.integer('views').default(0);
table.text('bio').nullable();
table.string('phone').after('email');

// Foreign keys
table.unsignedBigInteger('user_id');
table.foreign('user_id')
  .references('id')
  .on('users')
  .onDelete('CASCADE')
  .onUpdate('CASCADE');
```

---

## Common Patterns

### Repository Pattern

```typescript
import User from './models/User';
import { PaginationResult } from 'outlet-orm';

class UserRepository {
  async findById(id: number): Promise<User | null> {
    return User.find(id);
  }

  async findByEmail(email: string): Promise<User | null> {
    return User.where('email', email).first();
  }

  async create(data: Partial<UserAttributes>): Promise<User> {
    return User.create(data);
  }

  async paginate(page: number, perPage = 15): Promise<PaginationResult<User>> {
    return User.orderBy('created_at', 'desc').paginate(page, perPage);
  }

  async delete(id: number): Promise<boolean> {
    const user = await User.find(id);
    if (user) {
      return user.destroy();
    }
    return false;
  }
}

export default new UserRepository();
```

### Service Layer

```typescript
import User from './models/User';
import { DatabaseConnection } from 'outlet-orm';

class UserService {
  async createWithProfile(
    userData: Partial<UserAttributes>,
    profileData: Partial<ProfileAttributes>
  ): Promise<User> {
    const db = User.getConnection();
    
    return db.transaction(async () => {
      const user = await User.create(userData);
      
      await Profile.create({
        ...profileData,
        user_id: user.getAttribute('id')
      });
      
      // Load profile relation
      await user.load('profile');
      return user;
    });
  }
}
```

---

## Troubleshooting

### Type Errors

| Error | Cause | Solution |
|-------|-------|----------|
|`Property 'xxx' does not exist`| Missing attribute in interface | Add to interface or use`as any`|
|`Type 'string' is not assignable`| Missing`as const`on casts | Add`as const`to cast values |
|`Cannot find module 'outlet-orm'`| Types not found | Check`types`in package.json |

### Best Practices

1. **Always use`as const`** for static properties with literal types
2. **Define attribute interfaces** for each model
3. **Export types** alongside models for reuse
4. **Use strict mode** in tsconfig.json
5. **Type relation methods** explicitly for better IDE support

---

## References

- [TypeScript Documentation](TYPESCRIPT.md)
- [Model Guide](MODELS.md)
- [Relationship Guide](RELATIONS.md)
- [Migration Guide](MIGRATIONS.md)

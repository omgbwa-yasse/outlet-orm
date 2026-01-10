# 📘 TypeScript

Outlet ORM v3.0.0 inclut des définitions TypeScript complètes.

## Installation

Les types sont inclus dans le package :

```bash
npm install outlet-orm
```

Aucune installation de `@types/outlet-orm` n'est nécessaire.

## Configuration TypeScript

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```

## Utilisation de base

### Import

```typescript
import {
  Model,
  QueryBuilder,
  DatabaseConnection,
  HasOneRelation,
  HasManyRelation,
  BelongsToRelation,
  BelongsToManyRelation
} from 'outlet-orm';
```

### Définir un modèle

```typescript
import { 
  Model,
  HasOneRelation,
  HasManyRelation,
  BelongsToRelation,
  BelongsToManyRelation 
} from 'outlet-orm';

// Définition des modèles liés
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

class User extends Model {
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

  // Relations typées
  posts(): HasManyRelation {
    return this.hasMany(Post, 'user_id');
  }

  profile(): HasOneRelation {
    return this.hasOne(Profile, 'user_id');
  }

  roles(): BelongsToManyRelation {
    return this.belongsToMany(Role, 'role_user', 'user_id', 'role_id');
  }
}

export default User;
```

### Utiliser le modèle

```typescript
import User from './models/User';

async function main() {
  // Créer
  const user = await User.create({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'hashedpassword123'
  });

  // L'ID est typé
  const id: number = user.getAttribute('id');

  // Récupérer
  const foundUser = await User.find(1);
  if (foundUser) {
    const name: string = foundUser.getAttribute('name');
  }

  // Query Builder avec types
  const activeUsers = await User
    .where('status', 'active')
    .orderBy('created_at', 'desc')
    .limit(10)
    .get();

  // activeUsers est Model[]
  for (const u of activeUsers) {
    console.log(u.getAttribute('email'));
  }
}
```

## Types disponibles

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  errors: {
    [field: string]: string[];
  };
}

// Utilisation
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

// Utilisation
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

// Utilisation
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

// Utilisation
User.creating((user: Model): void | false => {
  if (!user.getAttribute('email')) {
    return false; // Annule la création
  }
});
```

## Modèles avec génériques

```typescript
import { Model } from 'outlet-orm';

// Interface des attributs
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
  
  // Typage fort avec getter
  get id(): number {
    return this.getAttribute('id') as number;
  }

  get title(): string {
    return this.getAttribute('title') as string;
  }

  set title(value: string) {
    this.setAttribute('title', value);
  }

  get status(): PostAttributes['status'] {
    return this.getAttribute('status') as PostAttributes['status'];
  }

  // Méthodes typées
  isPublished(): boolean {
    return this.status === 'published';
  }

  async publish(): Promise<void> {
    this.setAttribute('status', 'published');
    this.setAttribute('published_at', new Date().toISOString());
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

// Utilisation
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

## Relations typées

```typescript
import { 
  Model,
  HasOneRelation,
  HasManyRelation,
  BelongsToRelation,
  BelongsToManyRelation,
  MorphManyRelation
} from 'outlet-orm';

// Définition des modèles liés
class Profile extends Model { static table = 'profiles'; }
class Role extends Model { static table = 'roles'; }
class Comment extends Model { static table = 'comments'; }

class Post extends Model {
  static table = 'posts';

  // Appartient à
  author(): BelongsToRelation {
    return this.belongsTo(User, 'user_id');
  }

  // Polymorphique
  comments(): MorphManyRelation {
    return this.morphMany(Comment, 'commentable');
  }
}

class User extends Model {
  static table = 'users';

  // Un-à-un
  profile(): HasOneRelation {
    return this.hasOne(Profile, 'user_id');
  }

  // Un-à-plusieurs
  posts(): HasManyRelation {
    return this.hasMany(Post, 'user_id');
  }

  // Plusieurs-à-plusieurs
  roles(): BelongsToManyRelation {
    return this.belongsToMany(Role, 'role_user', 'user_id', 'role_id');
  }
}
```

## Scopes typés

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

// Utilisation
const activeAdmins = await User.scope('active', 'admins').get();
```

## Validation typée

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

// Valider
const user = new User({ name: '', email: 'invalid' });
const result = user.validate();

if (!result.valid) {
  // result.errors est typé comme { [field: string]: string[] }
  Object.entries(result.errors).forEach(([field, messages]) => {
    console.log(`${field}: ${messages.join(', ')}`);
  });
}
```

## Exemple complet

```typescript
// models/index.ts
import { Model, DatabaseConnection, QueryBuilder } from 'outlet-orm';

// Configuration (optionnel si .env est configuré)
const db = new DatabaseConnection({
  driver: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'myapp'
});

Model.setConnection(db);

// Post Model (défini en premier car référencé par User)
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

  // Méthodes personnalisées
  async getPostCount(): Promise<number> {
    return await Post.where('user_id', this.getAttribute('id')).count();
  }
}

// Usage
async function main(): Promise<void> {
  await db.connect();

  // Créer un utilisateur
  const user = await User.create({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'hashedpassword'
  });

  // Créer des posts
  await Post.create({
    title: 'Hello World',
    content: 'My first post',
    user_id: user.getAttribute('id'),
    status: 'published'
  });

  // Requêtes typées
  const publishedPosts = await Post
    .scope('published')
    .with('author')
    .orderBy('created_at', 'desc')
    .get();

  for (const post of publishedPosts) {
    console.log(`${post.getAttribute('title')} by ${post.author?.getAttribute('name')}`);
  }

  await db.close();
}

main().catch(console.error);
```

## Prochaines étapes

- [API Reference](API_REFERENCE.md) - Référence complète de l'API
- [Models](MODELS.md) - Guide des modèles
- [Query Builder](QUERY_BUILDER.md) - Requêtes avancées

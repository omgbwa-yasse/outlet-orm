# Outlet ORM

[![npm version](https://badge.fury.io/js/outlet-orm.svg)](https://www.npmjs.com/package/outlet-orm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Un ORM JavaScript inspired de Laravel Eloquent pour Node.js avec support pour MySQL, PostgreSQL et SQLite.

📚 **[Documentation complete available dans `/docs`](./docs/INDEX.md)**

## ✅ Prerequisites and compatibility

- Node.js >= 18 (recommended/required)
- Install the database driver corresponding to your DBMS (see below)

## 🚀 Installation

```bash
npm install outlet-orm
```

### Install the database driver

Outlet ORM utilise des peerDependencies optionnelles pour les drivers de database. Installez uniquement le driver dont vous avez besoin:

- MySQL/MariaDB: `npm install mysql2`
- PostgreSQL: `npm install pg`
- SQLite: `npm install sqlite3`

If no driver is installed, an explicit error message will tell you which one to install when connecting.

## 📁 Structure de Projet recommended

Organisez votre projet utilisant Outlet ORM avec une **architecture en couches** (recommended pour la production) :

> 🔐 **Sécurité** : See the [Security Guide](./docs/SECURITY.md) pour les bonnes pratiques.

```
mon-projet/
├── .env                          # ⚠️ JAMAIS committed (dans .gitignore)
├── .env.example                  # Template without secrets
├── .gitignore
├── package.json
│
├── src/                          # 📦 Code source centralisé
│   ├── index.js                  # Entry point de l'application
│   │
│   ├── config/                   # ⚙️ Configuration
│   │   ├── app.js                # General config (port, env)
│   │   ├── database.js           # Config DB (lit .env)
│   │   └── security.js           # CORS, helmet, rate limit
│   │
│   ├── models/                   # 📊 Data Layer (Entities)
│   │   ├── index.js              # Export centralisé des models
│   │   ├── User.js
│   │   ├── Post.js
│   │   └── Comment.js
│   │
│   ├── repositories/             # 🗄️ Data Access Layer
│   │   ├── BaseRepository.js     # Generic CRUD methods
│   │   ├── UserRepository.js     # Specific queries User
│   │   └── PostRepository.js
│   │
│   ├── services/                 # 💼 Business Layer (Business Logic)
│   │   ├── AuthService.js        # Logique d'authentification
│   │   ├── UserService.js        # User business logic
│   │   ├── PostService.js
│   │   └── EmailService.js       # Service externe (emails)
│   │
│   ├── controllers/              # 🎮 Presentation Layer (HTTP)
│   │   ├── AuthController.js
│   │   ├── UserController.js
│   │   └── PostController.js
│   │
│   ├── routes/                   # 🛤️ Route definitions
│   │   ├── index.js              # Route aggregator
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   └── post.routes.js
│   │
│   ├── middlewares/              # 🔒 Middlewares
│   │   ├── auth.js               # JWT verification
│   │   ├── authorize.js          # RBAC / permissions
│   │   ├── rateLimiter.js        # Protection DDoS
│   │   ├── validator.js          # Validation request body
│   │   └── errorHandler.js       # Gestion centralisede erreurs
│   │
│   ├── validators/               # ✅ Validation schemas
│   │   ├── authValidator.js
│   │   └── userValidator.js
│   │
│   └── utils/                    # 🔧 Utilitaires
│       ├── hash.js               # bcrypt wrapper
│       ├── token.js              # JWT helpers
│       ├── logger.js             # Winston/Pino config
│       └── response.js           # API response formatting
│
├── database/
│   ├── config.js                 # Config migrations (outlet-init)
│   ├── migrations/               # Migration files
│   └── seeds/                    # Test/demo data
│       └── UserSeeder.js
│
├── public/                       # ✅ Public static files
│   ├── images/
│   ├── css/
│   └── js/
│
├── uploads/                      # ⚠️ Uploaded files
│
├── logs/                         # 📋 Journaux (not versioned)
│
└── tests/                        # 🧪 Tests
    ├── unit/                     # Tests unitaires
    │   ├── services/
    │   └── models/
    ├── integration/              # Integration tests
    │   └── api/
    └── fixtures/                 # Test data
        └── users.json
```

### 🏗️ Layered Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      HTTP Request                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  MIDDLEWARES: auth → validate → rateLimiter → errorHandler │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  ROUTES → CONTROLLERS (Presentation Layer)                 │
│  Receives the request, calls the service, returns a response   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  SERVICES (Business Layer / Business Logic)                  │
│  Logique métier, orchestration, rules business            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  REPOSITORIES (Data Access Layer)                        │
│  Abstraction des queries DB, utilise les Models           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  MODELS (Outlet ORM) → DATABASE                             │
└─────────────────────────────────────────────────────────────┘
```

### 📋 Role of each layer

| Layer | Folder | Responsibility | Depends on |
|--------|---------|----------------|-----------|
| **Présentation** | `controllers/` | Handle HTTP, validate entrées, format responses | Services |
| **Métier** | `services/` | Logique business, orchestration, rules | Repositories |
| **Data** | `repositories/` | Complex DB queries, abstraction | Models |
| **Entities** | `models/` | Entity definitions, relationships, validations | Outlet ORM |

### ✅ Benefits of this architecture

- **Testability** : Each layer can be tested independently
- **Maintainability** : Clear separation of responsibilities
- **Scalability** : Easy to add new features
- **Reusability** : Services reusable from CLI, workers, etc.

### 📝 Example workflow

```javascript
// routes/user.routes.js
router.get('/users/:id', auth, UserController.show);

// controllers/UserController.js
async show(req, res) {
  const user = await userService.findById(req.params.id);
  res.json({ data: user });
}

// services/UserService.js
async findById(id) {
  const user = await userRepository.findWithPosts(id);
  if (!user) throw new NotFoundError('User not found');
  return user;
}

// repositories/UserRepository.js
async findWithPosts(id) {
  return User.with('posts').find(id);
}
```

## ✨ Key features

- **API inspirede d'Eloquent** (Active Record) pour un usage fluide
- **Query Builder expressif**: where/joins/order/limit/offset/paginate
- **Relationship filters Laravel-style**: `whereHas()`, `has()`, `whereDoesntHave()`, `withCount()`
- **Eager Loading** des relationships via `.with(...)` avec constraints et dot-notation
- **Relations completes**:
  - `hasOne`, `hasMany`, `belongsTo`, `belongsToMany` (avec attach/detach/sync)
  - `hasManyThrough`, `hasOneThrough` (relationships transitives)
  - `morphOne`, `morphMany`, `morphTo` (relationships polymorphiques)
- **Transactions** completes: `beginTransaction()`, `commit()`, `rollback()`, `transaction()`
- **Soft Deletes**: soft deletion avec `deleted_at`, `withTrashed()`, `onlyTrashed()`, `restore()`
- **Scopes**: global and local to reuse your filters
- **Events/Hooks**: `creating`, `created`, `updating`, `updated`, `deleting`, `deleted`, etc.
- **Validation**: rules built-in basic (`required`, `email`, `min`, `max`, etc.)
- **Query Logging**: mode debug avec `enableQueryLog()` et `getQueryLog()`
- **Pool PostgreSQL**: pooled connections pour better performance
- **Protection SQL**: sanitization automatique des identifiants
- **Casts automatiques** (int, float, boolean, json, date...)
- **Hidden attributes** (`hidden`) et timestamps automatiques
- **Visibility control** des attributs cachés: `withHidden()` et `withoutHidden()`
- **Atomic increment/decrement**: `increment()` et `decrement()`
- **Aliases ergonomiques**: `columns([...])`, `ordrer()` (alias typo de `orderBy`)
- **Raw queries**: `executeRawQuery()` et `execute()` (native driver results)
- **Migrations completes** (create/alter/drop, index, foreign keys, batch tracking)
- **CLI pratiques**: `outlet-init`, `outlet-migrate`, `outlet-convert`
- **Configuration via `.env`** (loaded automatically)
- **Multi-database**: MySQL, PostgreSQL et SQLite
- **Complete TypeScript types** avec Generic Model et Schema Builder typed (v4.0.0+)

## ⚡ Quick Start

### Initialisation du projet

```bash
# Create la configuration initiale
outlet-init

# Create une migration
outlet-migrate make create_users_table

# Run les migrations
outlet-migrate migrate
```

### 🌱 Seeding rapide

```bash
# Create un seeder
outlet-migrate make:seed UserSeeder

# Run les seeds (DatabaseSeeder prioritaire)
outlet-migrate seed

# Run un specific seeder
outlet-migrate seed --class UserSeeder
```

## 📖 Usage

### Connection configuration

Outlet ORM charge automatiquement la connection depuis le file `.env`. **Plus besoin d'importer DatabaseConnection !**

#### `.env` file

```env
DB_DRIVER=mysql
DB_HOST=localhost
DB_DATABASE=myapp
DB_USER=root
DB_PASSWORD=secret
DB_PORT=3306
```

#### Simplified usage

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
}

// C'est tout ! La connection est automatique
const users = await User.all();
```

#### Manual configuration (optional)

If you need to control the connection :

```javascript
const { DatabaseConnection, Model } = require('outlet-orm');

// Option 1 – via .env (no parameters required)
const db = new DatabaseConnection();

// Option 2 – via objet de configuration
const db = new DatabaseConnection({
  driver: 'mysql',
  host: 'localhost',
  database: 'myapp',
  user: 'root',
  password: 'secret',
  port: 3306
});

// Définir la connection manuellement (optionnel)
Model.setConnection(db);
```

#### Environment variables (.env)

| Variable | Description | Default |
|----------|-------------|------------|
| `DB_DRIVER` | `mysql`, `postgres`, `sqlite` | `mysql` |
| `DB_HOST` | Hôte de la base | `localhost` |
| `DB_PORT` | Port de connection | Selon driver |
| `DB_USER` / `DB_USERNAME` | Identifiant | - |
| `DB_PASSWORD` | Mot de passe | - |
| `DB_DATABASE` / `DB_NAME` | Nom de la base | - |
| `DB_FILE` / `SQLITE_DB` | SQLite file | `:memory:` |

### Importation

```javascript
// CommonJS - Import simple (connection automatique via .env)
const { Model } = require('outlet-orm');

// ES Modules
import { Model } from 'outlet-orm';

// Si besoin de Manual control sur la connection
const { DatabaseConnection, Model } = require('outlet-orm');
```

### Define a model

```javascript
const { Model } = require('outlet-orm');

// Define related models (see Relationships)
class Post extends Model { static table = 'posts'; }
class Profile extends Model { static table = 'profiles'; }

class User extends Model {
  static table = 'users';
  static primaryKey = 'id';           // Default: 'id'
  static timestamps = true;           // Default: true
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password'];
  static casts = {
    id: 'int',
    email_verified: 'boolean',
    metadata: 'json',
    birthday: 'date'
  };

  // Relations
  posts() {
    return this.hasMany(Post, 'user_id');
  }

  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}
```

### CRUD operations

#### Create

```javascript
// Method 1: create()
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secret123'
});

// Method 2: new + save()
const user = new User({
  name: 'Jane Doe',
  email: 'jane@example.com'
});
user.setAttribute('password', 'secret456');
await user.save();

// Insert brut (sans create d'instance)
await User.insert({ name: 'Bob', email: 'bob@example.com' });
```

#### Lire

```javascript
// Tous les enregistrements
const users = await User.all();

// Par ID
const user = await User.find(1);
const user = await User.findOrFail(1); // Throws an error if not found

// First result
const firstUser = await User.first();

// Avec conditions
const activeUsers = await User
  .where('status', 'active')
  .where('age', '>', 18)
  .get();

// Avec relationships (Eager Loading)
const usersWithPosts = await User
  .with('posts', 'profile')
  .get();

// Ordonner et limiter
const recentUsers = await User
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();
```

#### Update

```javascript
// Instance
const user = await User.find(1);
user.setAttribute('name', 'Updated Name');
await user.save();

// Bulk update
await User
  .where('status', 'pending')
  .update({ status: 'active' });

// Update + Fetch (comme Prisma)
const updated = await User
  .where('id', 1)
  .updateAndFetch({ name: 'Neo' }, ['profile', 'posts']);

// Helpers par ID
const user = await User.updateAndFetchById(1, { name: 'Trinity' }, ['profile']);
await User.updateById(2, { status: 'active' });
```

#### Delete

```javascript
// Instance
const user = await User.find(1);
await user.destroy();

// Bulk delete
await User
  .where('status', 'banned')
  .delete();
```

### Query Builder

```javascript
// Where clauses
const users = await User
  .where('age', '>', 18)
  .where('status', 'active')
  .orWhere('role', 'admin')
  .get();

// Where In / Not In
const users = await User.whereIn('id', [1, 2, 3, 4, 5]).get();
const users = await User.whereNotIn('status', ['banned', 'deleted']).get();

// Where Null / Not Null
const users = await User.whereNull('deleted_at').get();
const verified = await User.whereNotNull('email_verified_at').get();

// Where Between / Like
const adults = await User.whereBetween('age', [18, 65]).get();
const johns = await User.whereLike('name', '%john%').get();

// Pagination
const result = await User.paginate(1, 15);
// { data: [...], total: 100, per_page: 15, current_page: 1, last_page: 7, from: 1, to: 15 }

// Count / Exists
const count = await User.where('status', 'active').count();
const hasUsers = await User.where('role', 'admin').exists();

// Joins
const result = await User
  .join('profiles', 'users.id', 'profiles.user_id')
  .leftJoin('countries', 'profiles.country_id', 'countries.id')
  .select('users.*', 'profiles.bio', 'countries.name as country')
  .get();

// Aggregations
const stats = await User
  .distinct()
  .groupBy('status')
  .having('COUNT(*)', '>', 5)
  .get();

// Incrément / Décrément atomique
await User.where('id', 1).increment('login_count');
await User.where('id', 1).decrement('credits', 10);
```

### Relationship filters

```javascript
// whereHas: Utilisateurs ayant au moins un post publié
const authors = await User
  .whereHas('posts', (q) => {
    q.where('status', 'published');
  })
  .get();

// has: Au moins N enfants
const prolific = await User.has('posts', '>=', 10).get();

// whereDoesntHave: No children
const noPostUsers = await User.whereDoesntHave('posts').get();

// withCount: Ajouter une colonne {relation}_count
const withCounts = await User.withCount('posts').get();
// Chaque user aura: user.getAttribute('posts_count')
```

## 🔗 Relations

### One to One (hasOne)

```javascript
const { Model } = require('outlet-orm');

class Profile extends Model { static table = 'profiles'; }

class User extends Model {
  static table = 'users';
  
  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}

const user = await User.find(1);
const profile = await user.profile().get();
```

### One to Many (hasMany)

```javascript
const { Model } = require('outlet-orm');

class Post extends Model { static table = 'posts'; }

class User extends Model {
  static table = 'users';
  
  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

const user = await User.find(1);
const posts = await user.posts().get();
```

### Belongs To (belongsTo)

```javascript
const { Model } = require('outlet-orm');

class User extends Model { static table = 'users'; }

class Post extends Model {
  static table = 'posts';
  
  author() {
    return this.belongsTo(User, 'user_id');
  }
}

const post = await Post.find(1);
const author = await post.author().get();
```

### Many to Many (belongsToMany)

```javascript
const { Model } = require('outlet-orm');

class Role extends Model { static table = 'roles'; }

class User extends Model {
  static table = 'users';
  
  roles() {
    return this.belongsToMany(
      Role,
      'user_roles',   // Table pivot
      'user_id',      // FK vers User
      'role_id'       // FK vers Role
    );
  }
}

const user = await User.find(1);
const roles = await user.roles().get();

// Méthodes pivot
await user.roles().attach([1, 2]);    // Attach roles
await user.roles().detach(2);          // Detach a role
await user.roles().sync([1, 3]);       // Synchroniser (remplace tout)
```

### Has Many Through (hasManyThrough)

Access a distant relationship via an intermediate model.

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  // User -> Post -> Comment
  comments() {
    return this.hasManyThrough(Comment, Post, 'user_id', 'post_id');
  }
}

const user = await User.find(1);
const allComments = await user.comments().get();
```

### Has One Through (hasOneThrough)

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  // User -> Profile -> Country
  country() {
    return this.hasOneThrough(Country, Profile, 'user_id', 'country_id');
  }
}

const user = await User.find(1);
const country = await user.country().get();
```

### Polymorphic relationships

Polymorphic relationships allow a model to belong to multiple other models.

```javascript
const { Model } = require('outlet-orm');

// Configuration du morph map
Model.setMorphMap({
  'posts': Post,
  'videos': Video
});

// Models
class Post extends Model {
  comments() {
    return this.morphMany(Comment, 'commentable');
  }
}

class Video extends Model {
  comments() {
    return this.morphMany(Comment, 'commentable');
  }
}

class Comment extends Model {
  commentable() {
    return this.morphTo('commentable');
  }
}

// Usage
const post = await Post.find(1);
const comments = await post.comments().get();

const comment = await Comment.find(1);
const parent = await comment.commentable().get(); // Post ou Video
```

**Relations polymorphiques availables:**
- `morphOne(Related, 'morphName')` - One-to-One polymorphique
- `morphMany(Related, 'morphName')` - One-to-Many polymorphique
- `morphTo('morphName')` - Inverse polymorphique

### Eager Loading

```javascript
// Charger plusieurs relationships
const users = await User.with('posts', 'profile', 'roles').get();

// Charger avec constraints
const users = await User.with({
  posts: (q) => q.where('status', 'published').orderBy('created_at', 'desc')
}).get();

// Load nested relationships (dot notation)
const users = await User.with('posts.comments.author').get();

// Charger sur une instance existante
const user = await User.find(1);
await user.load('posts', 'profile');
await user.load(['roles', 'posts.comments']);

// Access loaded relationships
users.forEach(user => {
  console.log(user.relationships.posts);
  console.log(user.relationships.profile);
});
```

## 🎭 Attributs

### Casts

Les casts convertissent automatiquement les attributs:

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static casts = {
    id: 'int',              // ou 'integer'
    age: 'integer',
    balance: 'float',       // ou 'double'
    email_verified: 'boolean', // ou 'bool'
    metadata: 'json',       // Parse JSON
    settings: 'array',      // Parse JSON en array
    birthday: 'date'        // Convertit en Date
  };
}
```

### Hidden attributes

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static hidden = ['password', 'secret_token'];
}

const user = await User.find(1);
console.log(user.toJSON()); // password et secret_token exclus
```

#### Show hidden attributes

```javascript
// Include hidden attributes
const user = await User.withHidden().where('email', 'john@example.com').first();
console.log(user.toJSON()); // password inclus

// Control with a boolean
const user = await User.withoutHidden(true).first(); // true = afficher
const user = await User.withoutHidden(false).first(); // false = hide (default)

// Cas d'usage: authentification
const user = await User.withHidden().where('email', email).first();
if (user && await bcrypt.compare(password, user.getAttribute('password'))) {
  // Authentication successful
}
```

### Timestamps

```javascript
const { Model } = require('outlet-orm');

// Activés Default (created_at, updated_at)
class User extends Model {
  static timestamps = true;
}

// Disable
class Log extends Model {
  static timestamps = false;
}
```

## 🔄 Transactions

Outlet ORM supports transactions to guarantee data integrity:

```javascript
const { DatabaseConnection, Model } = require('outlet-orm');

// Method 1: Automatic callback (recommended)
const db = Model.connection;
const result = await db.transaction(async (connection) => {
  const user = await User.create({ name: 'John', email: 'john@example.com' });
  await Account.create({ user_id: user.getAttribute('id'), balance: 0 });
  return user;
});
// Automatic commit, rollback on error

// Method 2: Manual control
await db.beginTransaction();
try {
  await User.create({ name: 'Jane' });
  await db.commit();
} catch (error) {
  await db.rollback();
  throw error;
}
```

## 🗑️ Soft Deletes

Suppression logique avec colonne `deleted_at`:

```javascript
const { Model } = require('outlet-orm');

class Post extends Model {
  static table = 'posts';
  static softDeletes = true;
  // static DELETED_AT = 'deleted_at'; // Personnalisable
}

// Les queries excluent automatiquement les deleteds
const posts = await Post.all(); // Seulement les non-deleteds

// Inclure les deleteds
const allPosts = await Post.withTrashed().get();

// Seulement les deleteds
const trashedPosts = await Post.onlyTrashed().get();

// Delete (soft delete)
const post = await Post.find(1);
await post.destroy(); // Sets deleted_at to the current date

// Check if deleted
if (post.trashed()) {
  console.log('This post is deleted');
}

// Restaurer
await post.restore();

// Delete permanently
await post.forceDelete();
```

## 🔬 Scopes

### Scopes Globaux

Applied automatically to all queries:

```javascript
const { Model } = require('outlet-orm');

class Post extends Model {
  static table = 'posts';
}

// Ajouter un scope global
Post.addGlobalScope('published', (query) => {
  query.where('status', 'published');
});

// Toutes les queries filtrent automatiquement
const posts = await Post.all(); // Published only

// Disable temporairement un scope
const allPosts = await Post.withoutGlobalScope('published').get();

// Disable tous les scopes
const rawPosts = await Post.withoutGlobalScopes().get();
```

## 📣 Events / Hooks

Intercept operations on your models:

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
}

// Before creation
User.creating((user) => {
  user.setAttribute('uuid', generateUUID());
  // Retourner false pour rollback
});

// After creation
User.created((user) => {
  console.log(`Utilisateur ${user.getAttribute('id')} créé`);
});

// Before update
User.updating((user) => {
  user.setAttribute('updated_at', new Date());
});

// After update
User.updated((user) => {
  // Notifier les systèmes externes
});

// saving/saved events (creation AND update)
User.saving((user) => {
  // Nettoyage des data
});

User.saved((user) => {
  // Cache invalidation
});

// Avant/après suppression
User.deleting((user) => {
  // Checks before deletion
});

User.deleted((user) => {
  // Nettoyage des relationships
});

// Pour les soft deletes
User.restoring((user) => {});
User.restored((user) => {});
```

## ✅ Validation

Built-in basic validation:

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
  static rules = {
    name: 'required|string|min:2|max:100',
    email: 'required|email',
    age: 'numeric|min:0|max:150',
    role: 'in:admin,user,guest',
    password: 'required|min:8'
  };
}

const user = new User({
  name: 'J',
  email: 'invalid-email',
  age: 200
});

// Valider
const { valid, errors } = user.validate();
console.log(valid); // false
console.log(errors);
// {
//   name: ['name must be at least 2 characters'],
//   email: ['email must be a valid email'],
//   age: ['age must not exceed 150']
// }

// Valider ou lancer une erreur
try {
  user.validateOrFail();
} catch (error) {
  console.log(error.errors);
}
```

### Available rules

| Règle | Description |
|-------|-------------|
| `required` | Champ obligatoire |
| `string` | Must be a string |
| `number` / `numeric` | Must be a number |
| `email` | Format email valide |
| `boolean` | Must be a boolean |
| `date` | Date valide |
| `min:N` | Minimum N (longueur ou value) |
| `max:N` | Maximum N (longueur ou value) |
| `in:a,b,c` | Valeur parmi la liste |
| `regex:pattern` | Match le pattern regex |

## 📊 Query Logging

Debug mode to analyse your queries:

```javascript
const { Model } = require('outlet-orm');

// Activer le logging
const db = Model.getConnection();
db.enableQueryLog();

// Run des queries
await User.where('status', 'active').get();
await Post.with('author').get();

// Retrieve the log
const queries = db.getQueryLog();
console.log(queries);
// [
//   { sql: 'SELECT * FROM users WHERE status = ?', params: ['active'], duration: 15, timestamp: Date },
//   { sql: 'SELECT * FROM posts', params: [], duration: 8, timestamp: Date }
// ]

// Vider le log
db.flushQueryLog();

// Disable le logging
db.disableQueryLog();

// Check if active
if (db.isLogging()) {
  console.log('Logging actif');
}
```

## 📝 API Reference

### DatabaseConnection

| Method | Description |
|---------|-------------|
| `new DatabaseConnection(config?)` | Creates a connection (lit `.env` si config omis) |
| `connect()` | Establishes the connection (appelé automatiquement) |
| `beginTransaction()` | Starts a transaction |
| `commit()` | Valide la transaction |
| `rollback()` | Annule la transaction |
| `transaction(callback)` | Runs in a transaction (auto commit/rollback) |
| `select(table, query)` | Runs a SELECT |
| `insert(table, data)` | Inserts a record |
| `insertMany(table, data[])` | Inserts multiple records |
| `update(table, data, query)` | Updates records |
| `delete(table, query)` | Supprime des enregistrements |
| `count(table, query)` | Compte les enregistrements |
| `executeRawQuery(sql, params?)` | Requête brute (résultats normalisés) |
| `execute(sql, params?)` | Requête brute (résultats natifs driver) |
| `increment(table, column, query, amount?)` | Incrément atomique |
| `decrement(table, column, query, amount?)` | Décrément atomique |
| `close()` / `disconnect()` | Ferme la connection |
| **Query Logging (static)** | |
| `enableQueryLog()` | Active le logging des queries |
| `disableQueryLog()` | Désactive le logging |
| `getQueryLog()` | Returns the query log |
| `flushQueryLog()` | Vide le log |
| `isLogging()` | Checks whether logging is active |

### Model (methods statiques)

| Method | Description |
|---------|-------------|
| `setConnection(db)` | Définit la connection Default |
| `getConnection()` | Gets the connection (v3.0.0+) |
| `setMorphMap(map)` | Defines polymorphic mapping |
| `query()` | Retourne un QueryBuilder |
| `all()` | Tous les enregistrements |
| `find(id)` | Trouve par ID |
| `findOrFail(id)` | Trouve ou lance une erreur |
| `first()` | Premier enregistrement |
| `where(col, op?, val)` | Clause WHERE |
| `whereIn(col, vals)` | Clause WHERE IN |
| `whereNull(col)` | Clause WHERE NULL |
| `whereNotNull(col)` | Clause WHERE NOT NULL |
| `create(attrs)` | Creates and saves |
| `insert(data)` | Insert brut |
| `update(attrs)` | Update bulk |
| `updateById(id, attrs)` | Update par ID |
| `updateAndFetchById(id, attrs, rels?)` | Update + fetch avec relationships |
| `delete()` | Delete bulk |
| `with(...rels)` | Eager loading |
| `withHidden()` | Includes hidden attributes |
| `withoutHidden(show?)` | Contrôle visibilité |
| `orderBy(col, dir?)` | Tri |
| `limit(n)` / `offset(n)` | Limite/Offset |
| `paginate(page, perPage)` | Pagination |
| `count()` | Compte |
| **Soft Deletes** | |
| `withTrashed()` | Inclut les deleteds |
| `onlyTrashed()` | Seulement les deleteds |
| **Scopes** | |
| `addGlobalScope(name, cb)` | Adds a global scope |
| `removeGlobalScope(name)` | Removes a scope |
| `withoutGlobalScope(name)` | Query without one scope |
| `withoutGlobalScopes()` | Query without all scopes |
| **Events** | |
| `on(event, callback)` | Enregistre un listener |
| `creating(cb)` / `created(cb)` | Creation events |
| `updating(cb)` / `updated(cb)` | Update events |
| `saving(cb)` / `saved(cb)` | Events sauvegarde |
| `deleting(cb)` / `deleted(cb)` | Events suppression |
| `restoring(cb)` / `restored(cb)` | Events restauration |

### Model (methods d'instance)

| Method | Description |
|---------|-------------|
| `fill(attrs)` | Fills attributes |
| `setAttribute(key, val)` | Sets an attribute |
| `getAttribute(key)` | Gets an attribute |
| `save()` | Sauvegarde (insert ou update) |
| `destroy()` | Supprime l'instance (soft si activé) |
| `load(...rels)` | Charge des relationships |
| `getDirty()` | Attributs modifiés |
| `isDirty()` | Has been modified? |
| `toJSON()` | Convertit en objet |
| **Soft Deletes** | |
| `trashed()` | Is deleted? |
| `restore()` | Restore le model |
| `forceDelete()` | Permanent deletion |
| **Validation** | |
| `validate()` | Valide selon les rules |
| `validateOrFail()` | Valide ou lance erreur |

### QueryBuilder

| Method | Description |
|---------|-------------|
| `select(...cols)` / `columns([...])` | Column selection |
| `distinct()` | SELECT DISTINCT |
| `where(col, op?, val)` | Clause WHERE |
| `whereIn(col, vals)` | WHERE IN |
| `whereNotIn(col, vals)` | WHERE NOT IN |
| `whereNull(col)` | WHERE NULL |
| `whereNotNull(col)` | WHERE NOT NULL |
| `orWhere(col, op?, val)` | OR WHERE |
| `whereBetween(col, [min, max])` | WHERE BETWEEN |
| `whereLike(col, pattern)` | WHERE LIKE |
| `whereHas(rel, cb?)` | Filtre par relation |
| `has(rel, op?, count)` | Existence relationnelle |
| `whereDoesntHave(rel)` | Absence de relation |
| `orderBy(col, dir?)` / `ordrer(...)` | Tri |
| `limit(n)` / `take(n)` | Limite |
| `offset(n)` / `skip(n)` | Offset |
| `groupBy(...cols)` | GROUP BY |
| `having(col, op, val)` | HAVING |
| `join(table, first, op?, second)` | INNER JOIN |
| `leftJoin(table, first, op?, second)` | LEFT JOIN |
| `with(...rels)` | Eager loading |
| `withCount(rels)` | Ajoute {rel}_count |
| `withTrashed()` | Inclut les deleteds |
| `onlyTrashed()` | Seulement les deleteds |
| `withoutGlobalScope(name)` | Sans un scope global |
| `withoutGlobalScopes()` | Sans tous les scopes |
| `get()` | Runs and returns all |
| `first()` | First result |
| `firstOrFail()` | Premier ou erreur |
| `paginate(page, perPage)` | Pagination |
| `count()` | Compte |
| `exists()` | Checks existence |
| `insert(data)` | Insert |
| `update(attrs)` | Update |
| `updateAndFetch(attrs, rels?)` | Update + fetch |
| `delete()` | Delete |
| `increment(col, amount?)` | Incrément atomique |
| `decrement(col, amount?)` | Décrément atomique |
| `clone()` | Clone le query builder |

## 🛠️ CLI tools

### outlet-init

Initialise un nouveau projet avec configuration de database.

```bash
outlet-init
```

Generates:
- Configuration file `database/config.js`
- `.env` file with settings
- Example model
- Usage file

### outlet-migrate

complete migration system.

```bash
# Create une migration
outlet-migrate make create_users_table

# Run les migrations
outlet-migrate migrate

# See le statut
outlet-migrate status

# Roll back the latest migration
outlet-migrate rollback --steps 1

# Reset toutes les migrations
outlet-migrate reset --yes

# Refresh (reset + migrate)
outlet-migrate refresh --yes

# Fresh (drop all + migrate)
outlet-migrate fresh --yes
```

**Features des Migrations:**

- ✅ Creation and management of migrations (create, alter, drop tables)
- ✅ Types de colonnes: id, string, text, integer, boolean, date, datetime, timestamp, decimal, float, json, enum, uuid, foreignId
- ✅ Modificateurs: nullable, default, unique, index, unsigned, autoIncrement, comment, after, first
- ✅ Foreign keys: foreign(), constrained(), onDelete(), onUpdate(), CASCADE
- ✅ Index: index(), unique(), fullText()
- ✅ Manipulation: renameColumn(), dropColumn(), dropTimestamps()
- ✅ Reversible migrations: Méthodes up() et down()
- ✅ Batch tracking: Precise rollback by batch
- ✅ Custom SQL: execute() pour advanced commands

### outlet-convert

Converts SQL schemas into ORM models.

```bash
outlet-convert
```

**Options:**
1. Depuis un file SQL local
2. From a connected database

**Features:**
- ✅ Detection automatique des types et casts
- ✅ Automatic generation of ALL relationships (belongsTo, hasMany, hasOne, belongsToMany)
- ✅ Recursive relationships (auto-relationships)
- ✅ Detection des champs sensibles (password, token, etc.)
- ✅ Support des timestamps automatiques
- ✅ Conversion des noms en PascalCase

## 📚 Documentation

- [Guide des Migrations](docs/MIGRATIONS.md)
- [Conversion SQL](docs/SQL_CONVERSION.md)
- [Detection des Relations](docs/RELATIONS_DETECTION.md)
- [Quick Start Guide](docs/QUICKSTART.md)
- [Architecture](docs/ARCHITECTURE.md)
- [**TypeScript (complet)**](docs/TYPESCRIPT.md)

## 📘 TypeScript Support

Outlet ORM v4.0.0 inclut des définitions TypeScript completes avec support des **generics pour les attributs typeds**.

### Typed models

```typescript
import { Model, HasManyRelation } from 'outlet-orm';

interface UserAttributes {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  created_at: Date;
}

class User extends Model<UserAttributes> {
  static table = 'users';
  static fillable = ['name', 'email', 'role'];

  posts(): HasManyRelation<Post> {
    return this.hasMany(Post, 'user_id');
  }
}

// Type-safe getAttribute/setAttribute
const user = await User.find(1);
const name: string = user.getAttribute('name');     // ✅ Inferred type
const role: 'admin' | 'user' = user.getAttribute('role');
```

### Migrations typedes

```typescript
import { MigrationInterface, Schema, TableBuilder } from 'outlet-orm';

export const migration: MigrationInterface = {
  name: 'create_users_table',
  
  async up(): Promise<void> {
    await Schema.create('users', (table: TableBuilder) => {
      table.id();
      table.string('name');
      table.string('email').unique();
      table.timestamps();
    });
  },

  async down(): Promise<void> {
    await Schema.dropIfExists('users');
  }
};
```

📖 [Guide TypeScript complet](docs/TYPESCRIPT.md)

## 🤝 Contributions

Contributions are welcome! Feel free to open an issue or pull request.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## 📄 Licence

MIT - See [LICENSE](LICENSE) for details.

---

Created by [omgbwa-yasse](https://github.com/omgbwa-yasse)

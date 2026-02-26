# Quick Start Guide

This guide will help you get started quickly with Eloquent JS ORM.

## Installation

```bash
npm install outlet-orm mysql2
# or for PostgreSQL
npm install outlet-orm pg
# or for SQLite
npm install outlet-orm sqlite3
```

## Recommended Project Structure (Layered Architecture)

> 🔐 **Security**: See [Security Guide](SECURITY.md) for best practices.

The layered architecture clearly separates responsibilities:

```
mon-projet/
├── .env                           # ⚠️ NEVER commit
├── .env.example                   # Template without secrets
├── .gitignore
├── package.json
├── src/
│   ├── index.js                   # Entry point
│   ├── controllers/               # 🎮 Presentation Layer
│   │   └── UserController.js
│   ├── services/                  # ⚙️ Business Layer
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
│   ├── config.js                  # Config migrations CLI
│   └── migrations/
├── public/                        # ✅ Public static files
├── logs/                          # 📋 Logs
└── tests/
    ├── unit/
    └── integration/
```

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        REQUÊTE HTTP                         │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  🛤️ ROUTES          Routing to the correct controller          │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  🔒 MIDDLEWARES      Validation, Auth, Rate Limiting        │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  🎮 CONTROLLERS      HTTP handling only (req/res)      │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ SERVICES         Logique métier, rules business        │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  📦 REPOSITORIES     Abstraction accès data (CRUD)       │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  📊 MODELS           outlet-orm (User, Post, etc.)          │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATABASE                         │
└─────────────────────────────────────────────────────────────┘
```

### Responsibilities by Layer

| Layer | Files | Responsibility | Security |
|--------|----------|----------------|----------|
| **Controllers** |`src/controllers/`| HTTP only (req/res) | Entry validation |
| **Services** |`src/services/`| Business logic, rules | Authorisation |
| **Repositories** |`src/repositories/`| Database abstraction, queries | Sanitisation |
| **Models** |`src/models/`| Data structure, relationships | Fillable/Hidden |
| **Middlewares** |`src/middlewares/`| Auth, validation, errors | 🔒 **Critical** |
| **Config** |`src/config/`| Environment Variables | 🔒 Reads .env |
| **Utils** |`src/utils/`| Hash, tokens, helpers | 🔒 Do not expose |

### Implementation Example

```javascript
// src/models/User.js - Model Layer
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password'];
}
module.exports = User;

// src/repositories/UserRepository.js - Repository layer
const User = require('../models/User');

class UserRepository {
  async findById(id) {
    return User.find(id);
  }
  async findByEmail(email) {
    return User.where('email', email).first();
  }
  async create(data) {
    return User.create(data);
  }
}
module.exports = new UserRepository();

// src/services/UserService.js - Service Layer
const userRepository = require('../repositories/UserRepository');
const bcrypt = require('bcrypt');

class UserService {
  async register(data) {
    // Business logic: validation, hash password
    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new Error('Email déjà utilisé');
    
    data.password = await bcrypt.hash(data.password, 10);
    return userRepository.create(data);
  }
}
module.exports = new UserService();

// src/controllers/UserController.js - Controller layer
const userService = require('../services/UserService');

class UserController {
  async register(req, res) {
    try {
      const user = await userService.register(req.body);
      res.status(201).json({ success: true, user });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
}
module.exports = new UserController();
```

## Initial Configuration

### 1. Create the file`.env`

```env
DB_DRIVER=mysql
DB_HOST=localhost
DB_DATABASE=myapp
DB_USER=root
DB_PASSWORD=secret
DB_PORT=3306
```

### 2. Create your first template

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password'];
  static casts = {
    id: 'int',
    email_verified: 'boolean'
  };
}
```

> 💡 **Automatic connection**: No need to import`DatabaseConnection`! The Model automatically connects via`.env`.
```

### 3. Use the template

```javascript
// Create a user
const user = await User.create({
name: 'John Doe',
email: 'john@example.com',
password: 'secret123'
});

// Search for users
const users = await User.where('email', 'john@example.com').get();

// To update
user.setAttribute('name', 'Jane Doe');
await user.save();

// DELETE
await user.destroy();
```

## Basic CRUD Operations

### Create

```javascript
// Method 1: With create()
const user = await User.create({
name: 'Alice',
email: 'alice@example.com'
});

// Method 2: With new + save()
const user = new User();
user.setAttribute('name', 'Bob');
user.setAttribute('email', 'bob@example.com');
await user.save();

// Method 3: Multiple Insert
await User.insert([
{ name: 'User 1', email: 'user1@example.com' },
{ name: 'User 2', email: 'user2@example.com' }
]);
```

### Read (Lire)

```javascript
// All records
const allUsers = await User.all();

//Part ID
const user = await User.find(1);

// First result
const firstUser = await User.first();

// With condition
const activeUsers = await User.where('status', 'active').get();

// Several conditions
const users = await User
.where('age', '>', 18)
.where('status', 'active')
.orderBy('name')
.limit(10)
.get();
```

### Update

```javascript
// Instance update
const user = await User.find(1);
user.setAttribute('name', 'Updated Name');
await user.save();

// Mass update
await User
.where('status', 'pending')
.update({ status: 'active' });
```

### Delete (Delete)

```javascript
// Suppression d'instance
const user = await User.find(1);
await user.destroy();

// Mass deletion
await User.where('status', 'banned').delete();
```

## Query Builder

### Clauses WHERE

```javascript
// Basic
User.where('name', 'John')
User.where('age', '>', 18)
User.where('email', 'LIKE', '%@example.com')

// WHERE IN
User.whereIn('id', [1, 2, 3, 4, 5])

// WHERE NULL
User.whereNull('deleted_at')

// WHERE NOT NULL
User.whereNotNull('email_verified_at')

// OR WHERE
User.where('role', 'admin').orWhere('role', 'moderator')

// Chaining
User
.where('age', '>', 18)
.where('status', 'active')
.whereNotNull('email_verified_at')
.get()
```

### Sorting and Limitation

```javascript
// ORDER BY
User.orderBy('name', 'asc')
User.orderBy('created_at', 'desc')

// LIMIT et OFFSET
User.limit(10).offset(20)
User.take(10).skip(20) // Alias

// Combination
User
.where('status', 'active')
.orderBy('created_at', 'desc')
.limit(20)
.get()
```

### Pagination

```javascript
const result = await User.paginate(1, 15);
console.log(result);
// {
//   data: [...],
//   total: 100,
//   per_page: 15,
//   current_page: 1,
//   last_page: 7,
//   from: 1,
//   to: 15
// }
```

## Relationships

### Define relationships

```javascript
class User extends Model {
// One to One
profile() {
return this.hasOne(Profile, 'user_id');
}

// One to Many
posts() {
return this.hasMany(Post, 'user_id');
}

// Many to Many
roles() {
return this.belongsToMany(
Role,
'user_roles',
'user_id',
'role_id'
);
}
}

class Post extends Model {
// Belongs To (inverse)
author() {
return this.belongsTo(User, 'user_id');
}
}
```

### Use relationships

```javascript
// Lazy loading
const user = await User.find(1);
const posts = await user.posts().get();
const profile = await user.profile().get();

// Eager Loading (recommended)
const users = await User.with('posts', 'profile').get();

users.forEach(user => {
console.log(user.relationships.posts);
console.log(user.relationships.profile);
});
```

### Many-to-Many Relationships

```javascript
const user = await User.find(1);

// Get the roles
const roles = await user.roles().get();

// Attach roles
await user.roles().attach([1, 2, 3]);

// Detach roles
await user.roles().detach([2]);

// Synchronize (replace all)
await user.roles().sync([1, 3, 4]);
```

## Casting d'Attributs

```javascript
class User extends Model {
static casts = {
id: 'int',
age: 'integer',
balance: 'float',
is_active: 'boolean',
metadata: 'json',
settings: 'array',
birthday: 'date'
};
}

const user = await User.find(1);
console.log(typeof user.getAttribute('age')); // number
console.log(typeof user.getAttribute('is_active')); // boolean
console.log(user.getAttribute('metadata')); // Object
```

## Hidden Attributes

```javascript
class User extends Model {
static hidden = ['password', 'secret_token'];
}

const user = await User.find(1);
const json = user.toJSON(); // password et secret_token exclus
```

## Mass Assignment

```javascript
class User extends Model {
// Only these attributes can be assigned in bulk
static fillable = ['name', 'email', 'age'];
}

// OK
const user = new User({
name: 'John',
email: 'john@example.com',
age: 30
});

// The 'role' attribute will be ignored
const user2 = new User({
name: 'Jane',
role: 'admin' // Ignored because not in fillable
});
```

## Automatic Timestamps

```javascript
class User extends Model {
static timestamps = true; // Default
}

// created_at and updated_at are managed automatically
const user = await User.create({ name: 'John' });
console.log(user.getAttribute('created_at')); // Date actuelle

user.setAttribute('name', 'Jane');
await user.save();
console.log(user.getAttribute('updated_at')); // Automatic update
```

## Multiple Connections

```javascript
const mysqlDb = new DatabaseConnection({
driver: 'mysql',
host: 'localhost',
database: 'app_db'
});

const postgresDb = new DatabaseConnection({
driver: 'postgres',
host: 'localhost',
database: 'analytics_db'
});

class User extends Model {
static connection = mysqlDb;
}

class Analytics extends Model {
static connection = postgresDb;
}
```

## Good Practices

1. **Use Eager Loading** to avoid the N+1 problem
```javascript
// ❌ Bad (N+1 queries)
const users = await User.all();
for (const user of users) {
const posts = await user.posts().get();
}

// ✅ Bon (2 queries)
const users = await User.with('posts').get();
```

2. **Define `fillable`** for security
```javascript
class User extends Model {
static fillable = ['name', 'email']; // Only these fields
}
```

3. **Hide sensitive data**
```javascript
class User extends Model {
static hidden = ['password', 'api_token'];
}
```

4. **Use casts** for type consistency
```javascript
class User extends Model {
static casts = {
id: 'int',
is_active: 'boolean',
settings: 'json'
};
}
```

5. **Close connections** cleanly
```javascript
const db = new DatabaseConnection(config);
// ... usage ...
await db.close();
```

## Next Steps

- Consultez le [README.md](README.md) pour la documentation complete
- Explorez les [exemples](examples/) pour plus de cas d'usage
- Lisez le [CONTRIBUTING.md](CONTRIBUTING.md) si vous souhaitez contribuer

## Support

Si vous rencontrez des problèmes, veuillez ouvrir une issue sur GitHub.

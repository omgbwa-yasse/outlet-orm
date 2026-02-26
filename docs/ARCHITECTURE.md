# Code Architecture

This document describes the architecture and code structure of the Outlet ORM ORM.

## Structure of the User Project (Layered Architecture)

Here is the recommended structure for a project using Outlet ORM, based on the **Layered Architecture** pattern:

> 🔐 **Security**: See [Security Guide](SECURITY.md) for best practices.

```
mon-projet/
├── .env                           # ⚠️ NEVER commit (in .gitignore)
├── .env.example                   # Template sans secrets
├── .gitignore
├── package.json
├── src/
│   ├── index.js                   # Point d'entrée
│   ├── controllers/               # 🎮 Presentation Layer
│   │   ├── UserController.js
│   │   └── PostController.js
│   ├── services/                  # ⚙️ Business Layer
│   │   ├── UserService.js
│   │   └── PostService.js
│   ├── repositories/              # 📦 Data Access Layer
│   │   ├── UserRepository.js
│   │   └── PostRepository.js
│   ├── models/                    # 📊 Models Layer (outlet-orm)
│   │   ├── User.js
│   │   ├── Post.js
│   │   └── index.js
│   ├── middlewares/               # 🔒 Sécurité critique
│   │   ├── auth.js                # JWT authentication
│   │   ├── authorization.js       # RBAC
│   │   ├── rateLimiter.js
│   │   ├── validator.js
│   │   └── errorHandler.js
│   ├── routes/                    # 🛤️ Définition des routes
│   │   └── index.js
│   ├── config/                    # 🔒 Configuration centralisée
│   │   ├── app.js
│   │   ├── database.js
│   │   └── security.js            # Rate limit, helmet, CORS
│   ├── utils/                     # 🔒 Hash, tokens, encryption
│   │   ├── hash.js
│   │   └── token.js
│   └── validators/                # Schémas de validation
├── database/
│   ├── config.js                  # Config migrations
│   └── migrations/
├── public/                        # ✅ Seul dossier accessible
├── uploads/                       # ⚠️ Fichiers uploadés
├── logs/                          # 📋 Non versionnés
└── tests/
    ├── unit/
    └── integration/
```

### Layered Architecture Flow

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
│  ⚙️ SERVICES         Logique métier, règles business        │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  📦 REPOSITORIES     Abstraction accès données (CRUD)       │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  📊 MODELS           outlet-orm (User, Post, etc.)          │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     BASE DE DONNÉES                         │
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
  async update(id, data) {
    const user = await User.find(id);
    if (user) {
      user.fill(data);
      await user.save();
    }
    return user;
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
  
  async authenticate(email, password) {
    const user = await userRepository.findByEmail(email);
    if (!user) return null;
    
    const valid = await bcrypt.compare(password, user.getAttribute('password'));
    return valid ? user : null;
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
  
  async login(req, res) {
    try {
      const user = await userService.authenticate(req.body.email, req.body.password);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Identifiants invalides' });
      }
      // Generate JWT token...
      res.json({ success: true, user, token: '...' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
module.exports = new UserController();
```

## Internal structure of the ORM

```
src/
├── index.js                 # Point d'entrée principal, exporte tous les modules
├── Model.js                 # Classe Model de base (Active Record)
├── QueryBuilder.js          # Constructeur de requêtes
├── DatabaseConnection.js    # Gestionnaire de connexion aux bases de données
└── Relations/               # Classes de relations
    ├── Relation.js          # Classe de base abstraite pour les relations
    ├── HasOneRelation.js    # Relation One-to-One
    ├── HasManyRelation.js   # Relation One-to-Many
    ├── BelongsToRelation.js # Relation inverse (Many-to-One)
    └── BelongsToManyRelation.js # Relation Many-to-Many
```

## Main Components

### Model.js

The class`Model`is the heart of ORM. It implements the Active Record pattern where each instance represents a row in the database.

**Responsibilities:**
- Management of model attributes
- Opérations CRUD (Create, Read, Update, Delete)
- Casting of types
- Timestamp management
- Mass assignment with fillable protection
- Relationships between models
- JSON conversion with hidden attributes

**Static properties:**
-`table`: Table name
-`primaryKey`: Primary key (default: 'id')
-`timestamps`: Enables/disables automatic timestamps
-`fillable`: Attributes allowed for mass assignment
-`hidden`: Hidden attributes during JSON serialization
-`casts`: Casting types for attributes
-`connection`: Database connection instance

### QueryBuilder.js

THE`QueryBuilder`builds and executes SQL queries in a smooth and chainable manner.

**Responsibilities:**
- Construction of SQL queries
- Clauses WHERE, ORDER BY, LIMIT, OFFSET
- Joins
- Eager loading of relationships
- Pagination
- Agrégation (count, exists)

**Main methods:**
-`where()`,`whereIn()`,`whereNull()`, etc. : Filtering
-`orderBy()`: Tri
-`limit()`,`offset()`: Limitation
-`get()`,`first()`,`paginate()`: Execution
-`with()`: Eager loading

### DatabaseConnection.js

Manages connections to different databases (MySQL, PostgreSQL, SQLite).

**Responsibilities:**
- Establish and manage connections
- Execute SQL queries
- Adapt the requests for each driver
- Connection pooling (MySQL)
- Transactions (to come)

**Main methods:**
-`connect()`: Establishes the connection
-`select()`,`insert()`,`update()`,`delete()`: CRUD operations
-`count()`: Counting
-`executeRawQuery()`: Raw SQL execution
-`close()`: Closing the connection

### Relationships

#### Relation.js
Abstract base class for all relationships.

#### HasOneRelation.js
Implements the one-to-one relationship where the parent owns a child.

**Example:** User -> Profile

#### HasManyRelation.js
Implements the one-to-many relationship where the parent has multiple children.

**Example:** User -> Posts

#### BelongsToRelation.js
Implements the inverse relationship where the child belongs to the parent.

**Example:** Post -> User (author)

#### BelongsToManyRelation.js
Implements the many-to-many relationship via a pivot table.

**Example:** User <-> Roles (via user_roles)

## Data Flow

### Creating a Record

```
User.create(data)
  ↓
new User(data)
  ↓
user.fill(data) // Check fillable
  ↓
user.save()
  ↓
user.performInsert()
  ↓
connection.insert(table, data)
  ↓
Base de données
```

### Simple Query

```
User.where('status', 'active').get()
  ↓
User.query()
  ↓
new QueryBuilder(User)
  ↓
queryBuilder.where('status', 'active')
  ↓
queryBuilder.get()
  ↓
connection.select(table, query)
  ↓
queryBuilder.hydrate(rows) // Creates Model instances
  ↓
Retourne Array<User>
```

### Eager Loading

```
User.with('posts').get()
  ↓
queryBuilder.with('posts')
  ↓
queryBuilder.get()
  ↓
connection.select(table, query) // Get the users
  ↓
queryBuilder.eagerLoadRelations(users)
  ↓
Pour chaque relation:
  ↓
  relation.eagerLoad(users)
    ↓
    Récupère tous les posts des users en une requête
    ↓
    Assigne les posts à chaque user.relations.posts
```

## Design Patterns

### Active Record
The model combines data and business logic into a single class.

### Builder Pattern
The QueryBuilder uses the pattern builder to build queries fluidly.

### Strategy Pattern
DatabaseConnection adapts queries according to the database driver.

### Lazy Loading vs Eager Loading
- **Lazy Loading**: Relations are loaded on demand
- **Eager Loading**: Relations are loaded in a single optimised query

## Extensibility

### Create a New Cast Type

```javascript
// In Model.js, castAttribute() method
case 'custom_type':
  return customTransformation(value);
```

### Add a New Driver

```javascript
// In DatabaseConnection.js
case 'mongodb':
  await this.connectMongoDB();
  break;
```

### Create a New Relationship

```javascript
// Create HasManyThroughRelation.js
class HasManyThroughRelation extends Relation {
  // Implement the logic
}
```

## Optimizations

### Connection Pooling
MySQL uses pooling automatically via`mysql2/promise`.

### Eager Loading
Reduces the N+1 problem by loading relationships in bulk.

### Query Building
Queries are constructed in memory before execution, allowing optimisation.

## Future Improvement Points

- Transaction support
- Query caching
- Soft deletes
- Observers/Events
- Migration system
- Schema builder
- Integrated validation
- Polymorphic relationships

## Tests

The tests are organised by component:
-`tests/Model.test.js`: Model testing
-`tests/DatabaseConnection.test.js`: Connection tests
- More tests coming for relationships

## Contribution

To contribute, please read [CONTRIBUTING.md](../CONTRIBUTING.md).

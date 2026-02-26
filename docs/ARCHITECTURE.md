# Code Architecture

This document describes the architecture and code structure of the Outlet ORM ORM.

## Project Structure

Here is the recommended structure for a project using Outlet ORM, based on the **2-layer pattern** — Controllers call Models directly, no Services or Repositories needed:

> 🔐 **Security**: See [Security Guide](SECURITY.md) for best practices.

```
my-project/
├── .env                           # ⚠️ NEVER commit (in .gitignore)
├── .env.example                   # Template without secrets
├── .gitignore
├── package.json
├── src/
│   ├── index.js                   # Application entry point
│   ├── controllers/               # 🎮 HTTP handling + business logic (direct ORM calls)
│   │   ├── UserController.js
│   │   └── PostController.js
│   ├── models/                    # 📊 outlet-orm Models (entities)
│   │   ├── User.js
│   │   ├── Post.js
│   │   └── index.js
│   ├── middlewares/               # 🔒 Auth, validation, rate limiting
│   │   ├── auth.js                # JWT authentication
│   │   ├── authorization.js       # RBAC
│   │   ├── rateLimiter.js
│   │   ├── validator.js
│   │   └── errorHandler.js
│   ├── routes/                    # 🛤️ Route definitions
│   │   └── index.js
│   ├── config/                    # 🔒 Centralised configuration
│   │   ├── app.js
│   │   ├── database.js
│   │   └── security.js            # Rate limit, helmet, CORS
│   ├── utils/                     # 🔒 Hash, tokens, encryption
│   │   ├── hash.js
│   │   └── token.js
├── database/
│   ├── config.js                  # Migration config
│   └── migrations/
├── public/                        # ✅ Only publicly accessible folder
├── uploads/                       # ⚠️ Uploaded files
├── logs/                          # 📋 Not versioned
└── tests/
    ├── unit/
    └── integration/
```

### Architecture Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        HTTP REQUEST                         │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  🛤️ ROUTES          Routing to the correct controller       │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  🔒 MIDDLEWARES      Validation, Auth, Rate Limiting        │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  🎮 CONTROLLERS      HTTP handling + business logic         │
│                      Direct outlet-orm Model calls          │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  📊 MODELS           outlet-orm (User, Post, etc.)          │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                       DATABASE                              │
└─────────────────────────────────────────────────────────────┘
```

### Responsibilities by Layer

| Layer | Files | Responsibility | Security |
|--------|----------|----------------|----------|
| **Controllers** |`src/controllers/`| HTTP handling, business logic, direct ORM calls | Input validation, ownership checks |
| **Models** |`src/models/`| Data structure, relationships | `fillable`, `hidden` |
| **Middlewares** |`src/middlewares/`| Auth, validation, errors | 🔒 **Critical** |
| **Config** |`src/config/`| Environment variables | 🔒 Reads .env |
| **Utils** |`src/utils/`| Hash, tokens, helpers | 🔒 Do not expose |

### Implementation Example

```javascript
// src/models/User.js
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password'];
}
module.exports = User;

// src/controllers/UserController.js
const User = require('../models/User');
const bcrypt = require('bcrypt');

class UserController {
  async index(req, res) {
    const users = await User.all();
    res.json({ success: true, data: users });
  }

  async show(req, res) {
    const user = await User.with('posts').where('id', req.params.id).first();
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, data: user });
  }

  async store(req, res) {
    const existing = await User.where('email', req.body.email).first();
    if (existing) return res.status(409).json({ success: false, message: 'Email already in use' });

    const data = { ...req.body };
    data.password = await bcrypt.hash(data.password, 10);
    const user = await User.create(data);
    res.status(201).json({ success: true, data: user });
  }

  async update(req, res) {
    const user = await User.find(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const data = { ...req.body };
    if (data.password) data.password = await bcrypt.hash(data.password, 10);
    user.fill(data);
    await user.save();
    res.json({ success: true, data: user });
  }

  async destroy(req, res) {
    const user = await User.find(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await user.delete();
    res.json({ success: true, message: 'User deleted' });
  }

  async login(req, res) {
    const user = await User.where('email', req.body.email).first();
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const ok = await bcrypt.compare(req.body.password, user.getAttribute('password'));
    if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    res.json({ success: true, data: user, token: 'your-jwt-token-here' });
  }
}
module.exports = new UserController();
```

## Internal structure of the ORM

```
src/
├── index.js                 # Main entry point, exports all modules
├── Model.js                 # Base Model class (Active Record)
├── QueryBuilder.js          # Query builder
├── DatabaseConnection.js    # Database connection manager
└── Relations/               # Relationship classes
    ├── Relation.js          # Abstract base class for relationships
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
- CRUD operations (Create, Read, Update, Delete)
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
- Aggregation (count, exists)

**Main methods:**
-`where()`,`whereIn()`,`whereNull()`, etc. : Filtering
-`orderBy()`: Sort
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
Database
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
Returns Array<User>
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
For each relation:
  ↓
  relation.eagerLoad(users)
    ↓
    Fetches all posts for the users in a single query
    ↓
    Assigns posts to each user.relationships.posts
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

## Contributions

To contribute, please read [CONTRIBUTING.md](../CONTRIBUTING.md).


---

## Working Example

A complete, runnable example of this architecture is available in [`examples/simplified-architecture/`](../examples/simplified-architecture/).

It includes models, controllers, routes, middleware, and an entry point — ready to run with `npm install && node index.js`.

---

## Migration Guide: 4-Layer → 1-Layer

This guide walks through collapsing an existing `UserService.js` + `UserRepository.js` pair into a single `UserController.js` that calls outlet-orm directly.

### Migration Checklist

1. **Identify service/repository pairs**: List every `(XxxService, XxxRepository)` pair in `src/services/` and `src/repositories/`.
2. **Copy business logic**: Paste each service method as a controller method.
3. **Replace repository calls with direct ORM calls**: See the method mapping table below.
4. **Update controller imports**: Remove the service import; add the model import directly.
5. **Delete the service file** (`src/services/XxxService.js`) and the repository file (`src/repositories/XxxRepository.js`).
6. **Update route wiring**: Routes that called a service method now call the controller action directly.

### Repository Method → ORM Method Mapping

| Repository call | Direct outlet-orm equivalent |
|----------------|------------------------------|
| `userRepository.findById(id)` | `User.find(id)` |
| `userRepository.findByEmail(email)` | `User.where('email', email).first()` |
| `userRepository.create(data)` | `User.create(data)` |
| `userRepository.update(id, data)` | `user.fill(data); await user.save()` |
| `userRepository.delete(id)` | `await user.delete()` |
| `userRepository.all()` | `User.all()` |
| `userRepository.where(col, val)` | `User.where(col, val).get()` |

### Before/After: UserRepository.js → Inline ORM Calls

**Before** — `src/repositories/UserRepository.js`

```javascript
const User = require('../models/User');

class UserRepository {
  async findById(id)        { return User.find(id); }
  async findByEmail(email)  { return User.where('email', email).first(); }
  async create(data)        { return User.create(data); }
  async update(id, data) {
    const user = await User.find(id);
    if (user) { user.fill(data); await user.save(); }
    return user;
  }
}
module.exports = new UserRepository();
```

**After** — equivalent calls inline in `UserController.js` (no repository file needed)

```javascript
// Inside UserController.store():
const existing = await User.where('email', req.body.email).first(); // was: userRepository.findByEmail()
const user     = await User.create(data);                           // was: userRepository.create()

// Inside UserController.update():
const user = await User.find(req.params.id);    // was: userRepository.findById()
user.fill(data);
await user.save();                               // was: userRepository.update()
```

### Before/After: UserService.js → Inline Controller Logic

**Before** — `src/services/UserService.js`

```javascript
const userRepository = require('../repositories/UserRepository');
const bcrypt = require('bcrypt');

class UserService {
  async register(data) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new Error('Email already in use');
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
```

**After** — logic merged directly into `UserController.store()` and `UserController.login()`

```javascript
// UserController.store() — was: userService.register()
async store(req, res) {
  const existing = await User.where('email', req.body.email).first();
  if (existing) return res.status(409).json({ message: 'Email already in use' });

  const data = { ...req.body };
  data.password = await bcrypt.hash(data.password, 10);
  const user = await User.create(data);
  res.status(201).json({ success: true, data: user });
}

// UserController.login() — was: userService.authenticate()
async login(req, res) {
  const user = await User.where('email', req.body.email).first();
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });

  const ok = await bcrypt.compare(req.body.password, user.getAttribute('password'));
  if (!ok)  return res.status(401).json({ message: 'Invalid credentials' });

  res.json({ success: true, data: user, token: 'your-jwt-token-here' });
}
```

### Risks and Limitations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Controllers become too large (> 100 lines) | Medium | Medium | Group actions into domain-specific controller files; extract shared helpers into `src/utils/` |
| Business logic duplicated across controllers | Medium | Low | Move shared utilities (e.g., password hashing) into a small `src/utils/` module — not a full Service class |
| Harder to unit-test without a repository mock | High | Low | Use integration tests against a SQLite in-memory database; outlet-orm makes this straightforward |
| Pattern misapplied to large, complex applications | Low | High | Apply the "When NOT to Use" checklist above; re-introduce service classes selectively when a controller exceeds ~150 lines |

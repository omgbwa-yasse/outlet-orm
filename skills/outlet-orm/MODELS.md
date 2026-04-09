# Outlet ORM - Models & CRUD

[← Back to Index](SKILL.md) | [Next: Queries →](QUERIES.md)

> 📘 **TypeScript** : Use`Model<TAttributes>`for typed attributes. See [TYPESCRIPT.md](TYPESCRIPT.md#generic-model-v400)

---

## Recommended Project Structure (Layered Architecture)

> 🔐 **Security**: Use`hidden`for sensitive fields,`fillable`for mass assignment protection.

```
my-project/
├── .env                        # ⚠️ NEVER commit
├── src/
│   ├── controllers/            # 🎮 HTTP handling only
│   ├── services/               # ⚙️ Business logic
│   ├── repositories/           # 📦 Data access layer
│   ├── models/                 # 📊 Your Model classes
│   │   ├── User.js             # hidden: ['password']
│   │   └── Post.js
│   ├── middlewares/            # 🔒 Auth, validation
│   ├── config/                 # 🔒 Configuration
│   └── utils/                  # 🔒 Hash, tokens
├── database/
│   └── migrations/
├── public/                     # ✅ Only public folder
└── tests/
```

---

## Model Definition

### Complete Model Example

```javascript
const { Model } = require('outlet-orm');

// Define related models first
class Post extends Model {
  static table = 'posts';
}

class Profile extends Model {
  static table = 'profiles';
}

class User extends Model {
  // Required: Table name
  static table = 'users';
  
  // Optional: Primary key (default: 'id')
  static primaryKey = 'id';
  
  // Auto-manage created_at/updated_at
  static timestamps = true;
  
  // Enable soft deletes (deleted_at)
  static softDeletes = true;
  
  // Mass assignable fields
  static fillable = ['name', 'email', 'password', 'role'];
  
  // Hidden from JSON output
  static hidden = ['password', 'remember_token'];
  
  // Auto type casting
  static casts = {
    id: 'int',
    email_verified: 'boolean',
    preferences: 'json',
    birthday: 'date',
    balance: 'float'
  };
  
  // Validation rules
  static rules = {
    name: 'required|string|min:2|max:100',
    email: 'required|email',
    password: 'required|min:8',
    role: 'in:admin,user,guest'
  };
  
  // Relationships
  posts() {
    return this.hasMany(Post, 'user_id');
  }
  
  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}
```

---

## Static Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
|`table`| string | **required** | Table name |
|`primaryKey`| string |`'id'`| Primary key column |
|`timestamps`| boolean |`true`| Auto-manage created_at/updated_at |
|`softDeletes`| boolean |`false`| Enable soft delete |
|`DELETED_AT`| string |`'deleted_at'`| Soft delete column name |
|`fillable`| array |`[]`| Mass assignable fields |
|`hidden`| array |`[]`| Hidden from JSON |
|`casts`| object |`{}`| Type casting definitions |
|`rules`| object |`{}`| Validation rules |
|`appends`| array |`[]`| Computed attributes included in toJSON (v11) |
|`connection`| object |`null`| Custom DB connection |

---

## Type Casting

```javascript
class User extends Model {
  static casts = {
    id: 'int',              // or 'integer'
    age: 'integer',
    balance: 'float',       // or 'double'
    is_active: 'boolean',   // or 'bool'
    metadata: 'json',       // Parse as JSON object
    settings: 'array',      // Parse as JSON array
    birthday: 'date'        // Convert to Date
  };
}

const user = await User.find(1);
console.log(typeof user.age);       // 'number'
console.log(typeof user.is_active); // 'boolean'
console.log(user.metadata);         // Object
```

### Cast Types

| Type | Description |
|------|-------------|
|`int`/`integer`| Integer number |
|`float`/`double`| Floating point number |
|`boolean`/`bool`| Boolean value |
|`json`| Parse JSON to object |
|`array`| Parse JSON to array |
|`date`| Convert to Date object |

---

## CRUD Operations

### Create

```javascript
// Method 1: create() - Create and save
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
user.password = 'secret456';
await user.save();

// Method 3: Raw insert (no model instance returned)
await User.insert({ name: 'Bob', email: 'bob@example.com' });

// Insert multiple
await User.insert([
  { name: 'User 1', email: 'user1@example.com' },
  { name: 'User 2', email: 'user2@example.com' }
]);
```

### Read

```javascript
// All records
const users = await User.all();

// Find by ID
const user = await User.find(1);
const user = await User.findOrFail(1); // Throws if not found

// First result
const firstUser = await User.first();

// With conditions
const activeUsers = await User
  .where('status', 'active')
  .where('age', '>', 18)
  .get();

// With relationships (Eager Loading)
const usersWithPosts = await User
  .with('posts', 'profile')
  .get();

// Order and limit
const recentUsers = await User
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();
```

### Update

```javascript
// Instance update
const user = await User.find(1);
user.name = 'Updated Name';
await user.save();

// Bulk update
await User
  .where('status', 'pending')
  .update({ status: 'active' });

// Update and fetch (like Prisma)
const updated = await User
  .where('id', 1)
  .updateAndFetch({ name: 'Neo' }, ['profile', 'posts']);

// Helpers by ID
const user = await User.updateAndFetchById(1, { name: 'Trinity' }, ['profile']);
await User.updateById(2, { status: 'active' });
```

### Delete

```javascript
// Instance delete
const user = await User.find(1);
await user.destroy(); // Soft delete if enabled

// Bulk delete
await User
  .where('status', 'banned')
  .delete();

// Force delete (permanent, even with soft deletes)
await user.forceDelete();
```

---

## Attribute Methods

### Getting Attributes

```javascript
const user = await User.find(1);

// Property access (v11+)
const name = user.name;

// Get all attributes as object
const attrs = user.toJSON();

// Check if modified
const isDirty = user.isDirty();
const dirty = user.getDirty(); // Get modified attributes
```

### Setting Attributes

```javascript
const user = new User();

// Property access (v11+)
user.name = 'John';

// Fill multiple attributes
user.fill({
  name: 'John',
  email: 'john@example.com'
});
```

---

## Hidden Attributes

```javascript
class User extends Model {
  static hidden = ['password', 'secret_token'];
}

// Normal query - hidden fields excluded
const user = await User.find(1);
console.log(user.toJSON()); // password excluded

// Include hidden fields
const user = await User.withHidden().where('email', email).first();
console.log(user.toJSON()); // password included

// Control with boolean
const user = await User.withoutHidden(true).first();  // true = show
const user = await User.withoutHidden(false).first(); // false = hide

// Use case: Authentication
const user = await User.withHidden().where('email', email).first();
if (user && await bcrypt.compare(password, user.password)) {
  // Authentication successful
}
```

### Instance-Level Visibility (v11.0.0)

```javascript
const user = await User.find(1);

// Temporarily show hidden attributes on this instance
user.makeVisible('password', 'secret_token');
console.log(user.toJSON()); // password & secret_token included

// Temporarily hide additional attributes on this instance
user.makeHidden('email', 'phone');
console.log(user.toJSON()); // email & phone excluded
```

---

## Property Access (v11.0.0)

Access model attributes directly as properties via Proxy:

```javascript
const user = await User.find(1);

const name = user.name;
user.name = 'New Name';
await user.save();

// Works with casts
console.log(user.email_verified); // boolean (thanks to casts)
console.log(user.metadata);       // object (JSON cast)

// Check dirty state
user.name = 'Changed';
console.log(user.isDirty()); // true
```

> **Note**: Native Model methods and properties (`save`, `destroy`, `fill`, etc.) always take precedence over attribute names.

---

## Computed Appends (v11.0.0)

Include computed attributes in `toJSON()` output:

```javascript
class User extends Model {
  static table = 'users';
  static appends = ['full_name', 'is_admin'];

  // Accessor for computed attribute
  getFullNameAttribute() {
    return `${this.attributes.first_name} ${this.attributes.last_name}`;
  }

  getIsAdminAttribute() {
    return this.attributes.role === 'admin';
  }
}

const user = await User.find(1);
console.log(user.toJSON());
// { id: 1, first_name: 'John', last_name: 'Doe', full_name: 'John Doe', is_admin: false, ... }
```

---

## Model Utility Methods (v11.0.0)

### fresh() / refresh()

```javascript
const user = await User.find(1);

// fresh() returns a NEW instance reloaded from DB (original unchanged)
const freshUser = await user.fresh();

// refresh() reloads the CURRENT instance in-place
user.name = 'temp';
await user.refresh();
console.log(user.name); // Back to DB value
```

### replicate()

```javascript
const user = await User.find(1);
const clone = user.replicate();
// clone has same attributes but NO primary key
clone.name = 'Clone of ' + user.name;
await clone.save(); // Inserts as new record
```

### is() / isNot()

```javascript
const user1 = await User.find(1);
const user2 = await User.find(1);
const user3 = await User.find(2);

user1.is(user2);    // true  (same table + same PK)
user1.isNot(user3); // true  (different PK)
```

### only() / except()

```javascript
const user = await User.find(1);

// Get a subset of attributes
const subset = user.only('name', 'email');
// { name: 'John', email: 'john@example.com' }

// Get all attributes except some
const filtered = user.except('password', 'secret_token');
// { id: 1, name: 'John', email: 'john@example.com', ... }
```

### wasChanged() / getChanges()

```javascript
const user = await User.find(1);
user.name = 'Updated';
await user.save();

user.wasChanged();       // true
user.wasChanged('name'); // true
user.wasChanged('email'); // false
user.getChanges();       // { name: 'Updated' }
```

---

## Timestamps

```javascript
// Enabled by default
class User extends Model {
  static timestamps = true; // created_at, updated_at
}

// Disable timestamps
class Log extends Model {
  static timestamps = false;
}

// Auto-managed on create/update
const user = await User.create({ name: 'John' });
console.log(user.created_at); // Current date

user.name = 'Jane';
await user.save();
console.log(user.updated_at); // Updated automatically
```

---

## Mass Assignment Protection

```javascript
class User extends Model {
  static fillable = ['name', 'email', 'age'];
}

// OK - all fields are in fillable
const user = await User.create({
  name: 'John',
  email: 'john@example.com',
  age: 30
});

// 'role' will be IGNORED (not in fillable)
const user2 = await User.create({
  name: 'Jane',
  role: 'admin'  // Ignored!
});
```

---

## Multiple Connections

```javascript
const { DatabaseConnection, Model } = require('outlet-orm');

// Create connections
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

// Assign to models
class User extends Model {
  static table = 'users';
  static connection = mysqlDb;
}

class Analytics extends Model {
  static table = 'events';
  static connection = postgresDb;
}

// Close when done
await mysqlDb.close();
await postgresDb.close();
```

---

## Environment Variables

Configure via`.env`file (auto-loaded):

```env
DB_DRIVER=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=myapp
DB_USER=root
DB_PASSWORD=secret
```

| Variable | Description | Default |
|----------|-------------|---------|
|`DB_DRIVER`|`mysql`,`postgres`,`sqlite`|`mysql`|
|`DB_HOST`| Database host |`localhost`|
|`DB_PORT`| Connection port | Driver default |
|`DB_USER`/`DB_USERNAME`| Username | - |
|`DB_PASSWORD`| Password | - |
|`DB_DATABASE`/`DB_NAME`| Database name | - |
|`DB_FILE`/`SQLITE_DB`| SQLite file path |`:memory:`|

---

## Next Steps

- [Query Builder →](QUERIES.md)
- [Relationships →](RELATIONS.md)
- [Advanced Features →](ADVANCED.md)

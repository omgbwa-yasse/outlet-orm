# 📋 Models and CRUD

The models in Outlet ORM follow the Active Record pattern, inspired by Laravel Eloquent.

> 📁 **Recommended location**:`models/`(definitions) and used in`controllers/`— See [Project structure](INSTALLATION.md#structure-de-projet-recommended)
>
> 📘 **TypeScript**: Use`Model<TAttributes>`for typed attributes. See [TYPESCRIPT.md](TYPESCRIPT.md#generic-model-v400)

## Table of Contents

- [Define a template](#define-a-template)
- [Types of casts available](#types-of-casts-available)
- [Accessors & Mutators](#accessors-mutators)
  - [Accessors (read transform)](#accessors-read-transform)
  - [Mutators (write transform)](#mutators-write-transform)
- [CRUD operations](#crud-operations)
  - [Create](#create)
  - [Read (Lire)](#read-lire)
  - [Update](#update)
  - [Delete (Delete)](#delete-delete)
- [Attributes](#attributes)
  - [Access attributes](#access-attributes)
  - [Edit attributes](#edit-attributes)
  - [Modified attributes (dirty)](#modified-attributes-dirty)
- [Hidden attributes](#hidden-attributes)
- [Timestamps](#timestamps)
- [Convert to JSON](#convert-to-json)
- [Load relationships after the fact](#load-relationships-after-the-fact)
- [Pagination](#pagination)
- [Atomic Increment / Decrement](#atomic-increment-decrement)
- [Next steps](#next-steps)

---

## Define a template

```javascript
const { Model } = require('outlet-orm');

// Defining linked models (see Relationships for details)
class Post extends Model {
  static table = 'posts';
}

class Profile extends Model {
  static table = 'profiles';
}

class User extends Model {
  // Table name (required)
  static table = 'users';
  
  // Primary key (default: 'id')
  static primaryKey = 'id';
  
  // Automatic timestamps (default: true)
  static timestamps = true;
  
  // Mass editable attributes
  static fillable = ['name', 'email', 'password'];
  
  // Hidden attributes in toJSON()
  static hidden = ['password', 'remember_token'];
  
  // Soft deletes (default: false)
  static softDeletes = false;
  
  // Validation rules
  static rules = {
    name: 'required|string|min:2',
    email: 'required|email'
  };
  
  // Automatic casts
  static casts = {
    id: 'int',
    email_verified: 'boolean',
    settings: 'json',
    birthday: 'date'
  };

  // Relationships
  posts() {
    return this.hasMany(Post, 'user_id');
  }

  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}

module.exports = User;
```

## Types of casts available

| Cast | Description |
|------|-------------|
|`int`/`integer`| Convert to integer |
|`float`/`double`| Convert to decimal |
|`string`| Convert to string |
|`bool`/`boolean`| Convert to Boolean |
|`json`/`array`| Parse JSON |
|`date`| Convert to Date object |

## Accessors & Mutators

Accessors and mutators let you transform attribute values when reading or writing them on a model instance.

### Accessors (read transform)

Define a `get{PascalKey}Attribute(value)` method to transform a value when reading it via `getAttribute()`:

```javascript
class User extends Model {
  // 'name' → getNameAttribute
  getNameAttribute(value) {
    return value ? value.toUpperCase() : value;
  }

  // Virtual/computed attribute: 'email_domain' → getEmailDomainAttribute
  getEmailDomainAttribute() {
    const email = this.attributes.email;
    return email ? email.split('@')[1] : null;
  }
}

const user = await User.find(1);
user.getAttribute('name');         // "JOHN DOE" (uppercased)
user.getAttribute('email_domain'); // "example.com" (computed)
```

### Mutators (write transform)

Define a `set{PascalKey}Attribute(value)` method to transform a value when writing it via `setAttribute()` or `create()`:

```javascript
class User extends Model {
  // 'password' → setPasswordAttribute
  setPasswordAttribute(value) {
    this.attributes.password = bcrypt.hashSync(value, 10);
  }
}

const user = await User.create({ name: 'Alice', password: 'secret' });
// password is automatically hashed before insert
```

> **Note**: Snake_case keys are automatically converted to PascalCase method names. For example, `email_domain` maps to `getEmailDomainAttribute`.

## CRUD operations

### Create

```javascript
// Method 1: create() - creates and saves
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'hashed_password'
});
console.log(user.getAttribute('id')); // Self-generated ID

// Method 2: new + save() - more control
const user = new User({
  name: 'Jane Doe',
  email: 'jane@example.com'
});
user.setAttribute('password', 'hashed_password');
await user.save();

// Method 3: insert() - raw insert without instance
await User.insert({ name: 'Bob', email: 'bob@example.com' });

// Insertion multiple
await User.insert([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Charlie', email: 'charlie@example.com' }
]);
```

### Read (Lire)

```javascript
// All records
const users = await User.all();

// Par ID
const user = await User.find(1);

// By ID or error
const user = await User.findOrFail(1); // Throws Error if not found

// First result
const user = await User.first();
const user = await User.where('email', 'john@example.com').first();

// With conditions
const activeUsers = await User
  .where('status', 'active')
  .where('role', 'admin')
  .get();

// With relationships (eager loading)
const usersWithPosts = await User
  .with('posts', 'profile')
  .get();

// Order
const recentUsers = await User
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();

// Count
const count = await User.where('status', 'active').count();

// Check existence
const exists = await User.where('email', 'test@example.com').exists();
```

### Update

```javascript
// Method 1: Edit an instance
const user = await User.find(1);
user.setAttribute('name', 'John Updated');
user.setAttribute('email', 'john.updated@example.com');
await user.save();

// Method 2: fill() + save()
const user = await User.find(1);
user.fill({ name: 'New Name', email: 'new@email.com' });
await user.save();

// Method 3: Bulk Update
await User.where('status', 'pending').update({ status: 'active' });

// Method 4: Update by ID
await User.updateById(1, { name: 'Updated Name' });

// Method 5: Update and Recover with Relations
const user = await User.updateAndFetchById(1, { name: 'New' }, ['posts']);
```

### Delete (Delete)

```javascript
// Delete an instance
const user = await User.find(1);
await user.destroy();

// Mass deletion
await User.where('status', 'inactive').delete();

// With soft deletes enabled
class Post extends Model {
  static softDeletes = true;
}

const post = await Post.find(1);
await post.destroy();        // Soft delete (met deleted_at)
await post.forceDelete();    // Permanent deletion
await post.restore();        // Restore
```

## Attributes

### Access attributes

```javascript
const user = await User.find(1);

// getAttribute method
const name = user.getAttribute('name');
const email = user.getAttribute('email');

// Attributes are also in user.attributes
console.log(user.attributes);
```

### Edit attributes

```javascript
const user = await User.find(1);

// setAttribute
user.setAttribute('name', 'New Name');

// fill (modifies several attributes)
user.fill({ name: 'New', email: 'new@email.com' });

// Save changes
await user.save();
```

### Modified attributes (dirty)

```javascript
const user = await User.find(1);
console.log(user.isDirty()); // false

user.setAttribute('name', 'Changed');
console.log(user.isDirty()); // true

const changes = user.getDirty();
console.log(changes); // { name: 'Changed' }

await user.save();
console.log(user.isDirty()); // false
```

## Hidden attributes

```javascript
class User extends Model {
  static hidden = ['password', 'secret_token'];
}

const user = await User.find(1);

// toJSON() excludes hidden attributes
console.log(user.toJSON()); // { id: 1, name: 'John', email: '...' }

// Include hidden attributes
const userWithPassword = await User.withHidden().find(1);
console.log(userWithPassword.toJSON()); // Include password
```

## Timestamps

```javascript
// Enabled by default
class User extends Model {
  static timestamps = true; // created_at, updated_at automatiques
}

// Disable
class Log extends Model {
  static timestamps = false;
}
```

When`timestamps = true`:
-`created_at`is automatically defined upon creation
-`updated_at`is automatically updated with each change

## Convert to JSON

```javascript
const user = await User.with('posts').find(1);

// Convert to object
const json = user.toJSON();
// {
//   id: 1,
//   name: 'John',
//   email: 'john@example.com',
//   posts: [...] // Loaded relationships included
// }

// For API
res.json(user.toJSON());
```

## Load relationships after the fact

```javascript
const user = await User.find(1);

// Load a relationship
await user.load('posts');

// Load multiple relationships
await user.load('posts', 'profile');

// Load nested relationships
await user.load('posts.comments');
```

## Pagination

```javascript
const result = await User.paginate(1, 15);

// Result
{
  data: [...],           // Page Templates
  total: 100,            // Total number of records
  per_page: 15,          // Elements per page
  current_page: 1,       // Current page
  last_page: 7,          // Last page
  from: 1,               // Index of first element
  to: 15                 // Index of last element
}
```

## Atomic Increment / Decrement

```javascript
// Increment
await User.where('id', 1).increment('login_count');
await User.where('id', 1).increment('points', 10);

// Decrement
await User.where('id', 1).decrement('credits');
await User.where('id', 1).decrement('credits', 5);
```

## Next steps

- [Query Builder](QUERY_BUILDER.md) - Advanced queries
- [Relationships](RELATIONS.md) - Model associations
- [Validation](VALIDATION.md) - Validate data
- [Events](EVENTS.md) - Hooks on the life cycle

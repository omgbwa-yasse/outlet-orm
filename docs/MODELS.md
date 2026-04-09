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
- [Proxy Shorthand Reference (v11.0.0)](#proxy-shorthand-reference-v1100)
  - [CRU with Proxy (v11.0.0+)](#cru-with-proxy-v1100)
  - [Practical Examples](#practical-examples)
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

Define a `get{PascalKey}Attribute(value)` method to transform a value when reading it. The proxy applies the accessor automatically:

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
user.name;          // "JOHN DOE" (accessor applied automatically)
user.email_domain;  // "example.com" (computed accessor)
```

### Mutators (write transform)

Define a `set{PascalKey}Attribute(value)` method to transform a value when writing it. The proxy triggers the mutator automatically:

```javascript
class User extends Model {
  // 'password' → setPasswordAttribute
  setPasswordAttribute(value) {
    this.attributes.password = bcrypt.hashSync(value, 10);
  }
}

const user = await User.create({ name: 'Alice', password: 'secret' });
// password is automatically hashed before insert

const user = new User();
user.password = 'secret';  // mutator hashes the value before storing it
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
console.log(user.id); // Self-generated ID

// Method 2: new + save() - more control
const user = new User({ name: 'Jane Doe', email: 'jane@example.com' });
user.password = 'hashed_password';
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
user.name = 'John Updated';
user.email = 'john.updated@example.com';
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

// Property access via Proxy
const name = user.name;
const email = user.email;

// All attributes as raw object
console.log(user.attributes);
```

### Edit attributes

```javascript
const user = await User.find(1);

// Property write via Proxy
user.name = 'New Name';

// fill (modifies several attributes)
user.fill({ name: 'New', email: 'new@email.com' });

// Save changes
await user.save();
```

### Modified attributes (dirty)

```javascript
const user = await User.find(1);
console.log(user.isDirty()); // false

user.name = 'Changed';
console.log(user.isDirty()); // true

const changes = user.getDirty();
console.log(changes); // { name: 'Changed' }

await user.save();
console.log(user.isDirty()); // false
```

> ✨ **v11.0.0+ — Proxy shorthand** :
> ```javascript
> const user = await User.find(1);
> user.name = 'Changed';         // triggers dirty tracking automatically
> console.log(user.isDirty());    // true
> ```

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

## Proxy Shorthand Reference (v11.0.0)

Since v11.0.0, Model instances use a **JavaScript Proxy** that lets you read and write attributes as direct properties. This applies everywhere: accessors, mutators, casts, dirty tracking, and comparisons.

### Comparison table

| Classic syntax | ✨ Proxy shorthand (v11.0.0+) |
|---|---|
| `user.getAttribute('name')` | `user.name` |
| `user.setAttribute('name', 'Bob')` | `user.name = 'Bob'` |
| `user.getAttribute('age') > 18` | `user.age > 18` |
| `user.getAttribute('wallet') < 10` | `user.wallet < 10` |
| `user.getAttribute('email') === null` | `user.email === null` |
| `user.setAttribute('status', 'active')` | `user.status = 'active'` |

### CRU with Proxy (v11.0.0+)

#### Create

```javascript
// Method 1: create() — attributes are passed as object, no proxy needed
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secret123'
});
// Access the created instance with proxy
console.log(user.id);    // auto-generated ID
console.log(user.name);  // 'John Doe'

// Method 2: new + property assignment + save()
const user = new User();
user.name = 'Jane Doe';
user.email = 'jane@example.com';
user.password = 'secret456';
await user.save();

console.log(user.id);    // auto-generated ID
console.log(user.exists); // true
```

#### Read

```javascript
// Find by ID
const user = await User.find(1);
console.log(user.name);   // 'John Doe'
console.log(user.email);  // 'john@example.com'

// Conditions
if (user.age >= 18) {
  console.log('Adult');
}
if (user.wallet < 10) {
  console.log('Low balance');
}
if (user.email === null) {
  console.log('No email');
}

// Loop over results
const users = await User.where('status', 'active').get();
for (const u of users) {
  console.log(`${u.name} — ${u.email} — wallet: ${u.wallet}`);
}

// With relationships
const user = await User.with('posts', 'profile').find(1);
console.log(user.name);
console.log(user.relationships.profile);

// withCount
const users = await User.withCount('posts').get();
for (const u of users) {
  console.log(`${u.name} has ${u.posts_count} posts`);
}
```

#### Update

```javascript
// Instance update
const user = await User.find(1);
user.name = 'Updated Name';
user.email = 'new@example.com';

console.log(user.isDirty());  // true
console.log(user.getDirty()); // { name: 'Updated Name', email: 'new@example.com' }

await user.save();
console.log(user.isDirty());  // false

// Bulk update (query-level — no proxy)
await User.where('status', 'pending').update({ status: 'active' });
```

#### Practical Examples

**Authentication flow**

```javascript
// Register
const user = new User();
user.name = req.body.name;
user.email = req.body.email.toLowerCase().trim();
user.password = await bcrypt.hash(req.body.password, 10);
user.role = 'user';
await user.save();

// Login — read attributes with proxy
const user = await User.withHidden().where('email', email).first();
if (user && await bcrypt.compare(password, user.password)) {
  const token = generateToken({ id: user.id, role: user.role });
  return { token, name: user.name };
}
```

**E-commerce cart**

```javascript
// Add item and compute totals
const item = new OrderItem();
item.order_id = order.id;
item.product_id = product.id;
item.quantity = qty;
item.unit_price = product.price;
item.total = product.price * qty;
await item.save();

// Read order summary
const items = await OrderItem.where('order_id', order.id).get();
let grandTotal = 0;
for (const item of items) {
  console.log(`${item.product_id} × ${item.quantity} = ${item.total}€`);
  grandTotal += item.total;
}
```

**Profile update with dirty tracking**

```javascript
const user = await User.find(req.userId);

// Only assign fields that were sent
if (req.body.name)  user.name = req.body.name;
if (req.body.email) user.email = req.body.email;
if (req.body.phone) user.phone = req.body.phone;

if (user.isDirty()) {
  console.log('Modified fields:', Object.keys(user.getDirty()));
  await user.save();
  return { message: 'Profile updated', changed: user.getChanges() };
}
return { message: 'Nothing changed' };
```

**Conditional logic with comparisons**

```javascript
const users = await User.where('status', 'active').get();

for (const user of users) {
  // Direct comparison on proxy properties
  if (user.wallet < 10) {
    await sendLowBalanceAlert(user.email);
  }
  if (user.age >= 18 && user.is_verified) {
    await grantFullAccess(user.id);
  }
  if (user.last_login === null) {
    await sendReminderEmail(user.email, user.name);
  }
}
```

**Accessors & Mutators with proxy**

```javascript
class Product extends Model {
  // Accessor: auto-applied when reading product.price_formatted
  getPriceFormattedAttribute() {
    return `${this.attributes.price.toFixed(2)} €`;
  }

  // Mutator: auto-applied when writing product.slug = '...'
  setSlugAttribute(value) {
    this.attributes.slug = value.toLowerCase().replace(/\s+/g, '-');
  }
}

const product = await Product.find(1);
console.log(product.name);             // 'Gaming Laptop'
console.log(product.price);            // 1299.99
console.log(product.price_formatted);  // '1299.99 €'

product.slug = 'New Gaming Laptop';
// Mutator transforms → 'new-gaming-laptop'
await product.save();
```

**Casts with proxy**

```javascript
class Settings extends Model {
  static casts = {
    preferences: 'json',
    is_dark_mode: 'boolean',
    font_size: 'integer'
  };
}

const settings = await Settings.where('user_id', userId).first();

// Casts applied automatically through proxy
console.log(typeof settings.font_size);    // 'number' (not string)
console.log(typeof settings.is_dark_mode); // 'boolean' (not '0'/'1')
console.log(settings.preferences);         // { theme: 'blue', ... } (parsed JSON)

settings.font_size = 16;
settings.is_dark_mode = true;
settings.preferences = { theme: 'red', sidebar: 'collapsed' };
await settings.save();
```

**Relationships + proxy**

```javascript
const user = await User.with('posts', 'profile').find(1);

console.log(user.name);  // 'Alice'

// Access related models
for (const post of user.relationships.posts) {
  console.log(`${post.title} — ${post.status}`);
  if (post.views > 1000) {
    post.is_popular = true;
    await post.save();
  }
}

// withCount
const authors = await User.withCount('posts', 'comments').get();
for (const author of authors) {
  console.log(`${author.name}: ${author.posts_count} posts, ${author.comments_count} comments`);
}
```

### Complete example

```javascript
const user = await User.find(1);

// Read attributes (accessor + casts applied automatically)
console.log(user.name);           // 'ALICE' (accessor uppercases)
console.log(user.age);            // 28     (cast to integer)
console.log(user.email);          // 'alice@example.com'

// Direct comparisons
if (user.age >= 18) {
  console.log('Adult');
}
if (user.wallet < 10) {
  console.log('Low balance');
}

// Write attributes (mutators + casts applied automatically)
user.name = 'Bob';                // triggers setNameAttribute if defined
user.age = 30;                    // cast to integer
user.email = '  BOB@TEST.COM  '; // triggers setEmailAttribute if defined

// Dirty tracking works with property writes
console.log(user.isDirty());      // true
console.log(user.getDirty());     // { name: 'Bob', age: 30, email: 'bob@test.com' }

await user.save();

// Loop over results
const users = await User.where('status', 'active').get();
for (const u of users) {
  console.log(`${u.name} (age ${u.age}) — wallet: ${u.wallet}`);
  if (u.wallet < 10) {
    await sendLowBalanceAlert(u.email);
  }
}
```

> **Note**: Internal properties (`exists`, `attributes`, `original`, `relations`, etc.) and all model methods (`save()`, `destroy()`, `load()`, etc.) are **not** intercepted by the Proxy. They work exactly as before.

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

## Computed Appends (v11.0.0)

Append computed attributes to `toJSON()` output using the `appends` static property and accessor methods:

```javascript
class User extends Model {
  static table = 'users';
  static appends = ['full_name'];

  getFullNameAttribute() {
    return `${this.attributes.first_name} ${this.attributes.last_name}`;
  }
}

const user = await User.find(1);
user.toJSON();
// { id: 1, first_name: 'John', last_name: 'Doe', full_name: 'John Doe', ... }
```

## Instance-Level Visibility (v11.0.0)

Override hidden attributes for a specific instance:

```javascript
const user = await User.find(1);

// Reveal a hidden attribute
user.makeVisible('password');
user.toJSON(); // includes password

// Hide an attribute on this instance
user.makeHidden('email');
user.toJSON(); // excludes email
```

## Model Utility Methods (v11.0.0)

### fresh() / refresh()

```javascript
const user = await User.find(1);

// Get a fresh instance from the DB (does not mutate the original)
const freshUser = await user.fresh('posts');

// Reload attributes in place
await user.refresh();
```

### replicate()

```javascript
const user = await User.find(1);

// Clone without the primary key (ready to save as a new record)
const clone = user.replicate();
await clone.save(); // inserts a new row

// Exclude additional attributes
const clone2 = user.replicate('email', 'created_at');
```

### is() / isNot()

```javascript
const a = await User.find(1);
const b = await User.find(1);
const c = await User.find(2);

a.is(b);    // true  (same table + same PK)
a.isNot(c); // true
```

### only() / except()

```javascript
const user = await User.find(1);

// Get a subset of attributes
user.only('name', 'email');
// { name: 'John', email: 'john@example.com' }

// Get all except specified keys
user.except('password', 'secret_token');
// { id: 1, name: 'John', email: 'john@example.com', ... }
```

### wasChanged() / getChanges()

Track which attributes were changed on the last `save()`:

```javascript
const user = await User.find(1);
user.name = 'Updated';
await user.save();

user.wasChanged();       // true
user.wasChanged('name'); // true
user.wasChanged('email'); // false
user.getChanges();       // { name: 'Updated' }
```

## Next steps

- [Query Builder](QUERY_BUILDER.md) - Advanced queries
- [Relationships](RELATIONS.md) - Model associations
- [Validation](VALIDATION.md) - Validate data
- [Events](EVENTS.md) - Hooks on the life cycle

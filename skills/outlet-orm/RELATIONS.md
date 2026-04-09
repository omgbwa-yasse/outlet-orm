# Outlet ORM - Relations & Eager Loading

[← Back to Index](SKILL.md) | [Previous: Queries](QUERIES.md) | [Next: Migrations →](MIGRATIONS.md)

> 📘 **TypeScript**: Use typed relationships like`HasOneRelation<Profile>`,`HasManyRelation<Post>`. See [TYPESCRIPT.md](TYPESCRIPT.md#relationships-typedes)

---

## Naming Conventions

### Tables
- Singular or plural:`user`or`users`
- Pivot tables: alphabetical order`role_user`(not`user_role`)

### Foreign Keys
- Format:`{model}_id`(e.g.,`user_id`,`post_id`)

### Polymorphic Columns
- Type:`{name}_type`(e.g.,`commentable_type`)
- ID:`{name}_id`(e.g.,`commentable_id`)

### Relation Methods

| Type | Naming | Example |
|------|--------|---------|
|`belongsTo`| singular |`user()`,`category()`|
|`hasOne`| singular |`profile()`|
|`hasMany`| plural |`posts()`,`comments()`|
|`belongsToMany`| plural |`tags()`,`roles()`|


---

## Relation Types Overview

| Relation | Description | Example |
|----------|-------------|---------|
|`hasOne`| One-to-One | User → Profile |
|`hasMany`| One-to-Many | User → Posts |
|`belongsTo`| Inverse of hasOne/hasMany | Post → User |
|`belongsToMany`| Many-to-Many | User ↔ Roles |
|`hasManyThrough`| One-to-Many via intermediate | Country → Posts via Users |
|`hasOneThrough`| One-to-One via intermediate | Supplier → UserHistory via User |
|`morphOne`| Polymorphic One-to-One | Post → Image |
|`morphMany`| Polymorphic One-to-Many | Post → Comments |
|`morphTo`| Polymorphic inverse | Comment → (Post\|Video) |

---

## Has One (One-to-One)

A user has one profile.

```javascript
const { Model } = require('outlet-orm');

class Profile extends Model {
  static table = 'profiles';
  
  user() {
    return this.belongsTo(User, 'user_id');
  }
}

class User extends Model {
  static table = 'users';
  
  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}

// Usage
const user = await User.find(1);
const profile = await user.profile().get();

// With eager loading
const user = await User.with('profile').find(1);
console.log(user.relationships.profile);
```

**Parameters:**
-`hasOne(RelatedModel, foreignKey, localKey)`
-`foreignKey`: default =`{model}_id`
-`localKey`: default =`id`

---

## Has Many (One-to-Many)

A user has many posts.

```javascript
class Post extends Model {
  static table = 'posts';
  
  author() {
    return this.belongsTo(User, 'user_id');
  }
}

class User extends Model {
  static table = 'users';
  
  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

// Usage
const user = await User.find(1);
const posts = await user.posts().get();

// With eager loading
const user = await User.with('posts').find(1);
console.log(user.relationships.posts); // Array of posts
```

---

## Belongs To (Inverse)

A post belongs to a user.

```javascript
class User extends Model {
  static table = 'users';
}

class Post extends Model {
  static table = 'posts';
  
  author() {
    return this.belongsTo(User, 'user_id');
  }
}

// Usage
const post = await Post.find(1);
const author = await post.author().get();

// With eager loading
const post = await Post.with('author').find(1);
console.log(post.relationships.author);
```

**Parameters:**
-`belongsTo(RelatedModel, foreignKey, ownerKey)`
-`foreignKey`: FK on current model
-`ownerKey`: default =`id`

---

## Belongs To Many (Many-to-Many)

Users and roles with pivot table.

```sql
-- Tables
users (id, name, email)
roles (id, name)
role_user (user_id, role_id)  -- Pivot table
```

```javascript
class Role extends Model {
  static table = 'roles';
  
  users() {
    return this.belongsToMany(User, 'role_user', 'role_id', 'user_id');
  }
}

class User extends Model {
  static table = 'users';
  
  roles() {
    return this.belongsToMany(
      Role,
      'role_user',   // Pivot table
      'user_id',     // FK to User
      'role_id'      // FK to Role
    );
  }
}

// Usage
const user = await User.find(1);
const roles = await user.roles().get();

// Pivot methods
await user.roles().attach([1, 2]);     // Attach roles
await user.roles().attach(3);          // Attach single
await user.roles().detach(2);          // Detach role
await user.roles().detach();           // Detach all
await user.roles().sync([1, 3, 4]);    // Sync (replace all)

// Access pivot data
const roles = await user.roles().get();
roles.forEach(role => {
  console.log(role.pivot); // { user_id: 1, role_id: 2 }
});
```

---

## Has Many Through

Access remote relationships via intermediate model.

```sql
-- Country -> User -> Post
countries (id, name)
users (id, country_id, name)
posts (id, user_id, title)
```

```javascript
class Country extends Model {
  static table = 'countries';
  
  posts() {
    return this.hasManyThrough(
      Post,           // Final model
      User,           // Intermediate model
      'country_id',   // FK on User
      'user_id',      // FK on Post
      'id',           // Local key on Country
      'id'            // Local key on User
    );
  }
}

// Get all posts from French users
const france = await Country.with('posts').where('name', 'France').first();
console.log(france.relationships.posts);
```

---

## Has One Through

One-to-one via intermediate.

```javascript
class Mechanic extends Model {
  static table = 'mechanics';
  
  carOwner() {
    return this.hasOneThrough(
      Owner,
      Car,
      'mechanic_id',
      'car_id',
      'id',
      'id'
    );
  }
}
```

---

## Polymorphic Relations

### Morph One (Polymorphic One-to-One)

An image can belong to a User or a Post.

```sql
images (id, url, imageable_type, imageable_id)
-- imageable_type: 'User' or 'Post'
-- imageable_id: corresponding ID
```

```javascript
// Configure morph map
Model.setMorphMap({
  'User': User,
  'Post': Post
});

class User extends Model {
  static table = 'users';
  
  image() {
    return this.morphOne(Image, 'imageable');
  }
}

class Post extends Model {
  static table = 'posts';
  
  image() {
    return this.morphOne(Image, 'imageable');
  }
}

class Image extends Model {
  static table = 'images';
  
  imageable() {
    return this.morphTo('imageable');
  }
}

// Usage
const user = await User.with('image').find(1);
console.log(user.relationships.image);

const image = await Image.with('imageable').find(1);
console.log(image.relationships.imageable); // User or Post
```

### Morph Many (Polymorphic One-to-Many)

Comments on Posts and Videos.

```javascript
Model.setMorphMap({
  'posts': Post,
  'videos': Video
});

class Post extends Model {
  static table = 'posts';
  
  comments() {
    return this.morphMany(Comment, 'commentable');
  }
}

class Video extends Model {
  static table = 'videos';
  
  comments() {
    return this.morphMany(Comment, 'commentable');
  }
}

class Comment extends Model {
  static table = 'comments';
  
  commentable() {
    return this.morphTo('commentable');
  }
}

// Usage
const post = await Post.with('comments').find(1);
console.log(post.relationships.comments);

const comment = await Comment.with('commentable').find(1);
console.log(comment.relationships.commentable); // Post or Video
```

---

## Eager Loading

### Basic Eager Loading

```javascript
// Single relation
const users = await User.with('posts').get();

// Multiple relationships
const users = await User.with('posts', 'profile', 'roles').get();

// Access loaded relationships
users.forEach(user => {
  console.log(user.relationships.posts);
  console.log(user.relationships.profile);
  console.log(user.relationships.roles);
});
```

### Nested Relations (Dot Notation)

```javascript
// Load nested relationships
const users = await User.with('posts.comments.author').get();

// Combined
const users = await User.with('profile', 'posts.comments').get();
```

### Eager Loading with Constraints

```javascript
const users = await User.with({
  posts: (query) => query
    .where('status', 'published')
    .orderBy('created_at', 'desc')
    .limit(5)
}).get();
```

### Load on Existing Instance

```javascript
const user = await User.find(1);

// Load single relation
await user.load('posts');

// Load multiple
await user.load('posts', 'profile');
await user.load(['roles', 'posts.comments']);

// Access
console.log(user.relationships.posts);
```

---

## Relational Filters

### whereHas (Filter by Relation)

Get users that have at least one published post:

```javascript
const authors = await User
  .whereHas('posts', (query) => {
    query.where('status', 'published');
  })
  .get();
```

### has (Relation Count Filter)

```javascript
// Users with at least 1 post
const withPosts = await User.has('posts').get();

// Users with at least 10 posts
const prolific = await User.has('posts', '>=', 10).get();

// Users with exactly 5 posts
const exact = await User.has('posts', '=', 5).get();
```

### whereDoesntHave (No Relation)

```javascript
// Users without any posts
const noPosts = await User.whereDoesntHave('posts').get();

// Users without published posts
const noPublished = await User
  .whereDoesntHave('posts', (q) => q.where('status', 'published'))
  .get();
```

### withCount (Relation Count)

```javascript
const users = await User.withCount('posts').get();

users.forEach(user => {
  console.log(user.getAttribute('posts_count'));
});
```

---

## Automatic Relations Detection

The`outlet-convert`CLI automatically detects relationships from your SQL schema.

### Detection Rules

| Pattern | Detected Relation |
|---------|-------------------|
| Column`*_id`with FK |`belongsTo()`|
| FK referencing this table (non-unique) |`hasMany()`|
| FK referencing this table (UNIQUE) |`hasOne()`|
| Pivot table (2 FKs only) |`belongsToMany()`|
| Self-referencing FK | Recursive relation |

### Example: Auto-Generated

**SQL:**
```sql
CREATE TABLE profiles (
  id INT PRIMARY KEY,
  user_id INT UNIQUE,  -- UNIQUE = hasOne
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Generated User.js:**
```javascript
class User extends Model {
  profile() {
    return this.hasOne(Profile, 'user_id'); // Detected from UNIQUE
  }
}
```

### Recursive Relations

```sql
CREATE TABLE categories (
  id INT PRIMARY KEY,
  parent_id INT,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);
```

**Auto-Generated:**
```javascript
class Category extends Model {
  parent() {
    return this.belongsTo(Category, 'parent_id');
  }
  
  children() {
    return this.hasMany(Category, 'parent_id');
  }
}
```

---

## Relations Methods Summary

| Method | Description |
|--------|-------------|
|`hasOne(Model, fk, lk)`| One-to-One |
|`hasMany(Model, fk, lk)`| One-to-Many |
|`belongsTo(Model, fk, ok)`| Inverse relation |
|`belongsToMany(Model, pivot, fk, rk)`| Many-to-Many |
|`hasManyThrough(Model, Through, fk1, fk2)`| Via intermediate |
|`hasOneThrough(Model, Through, fk1, fk2)`| One via intermediate |
|`morphOne(Model, name)`| Polymorphic One-to-One |
|`morphMany(Model, name)`| Polymorphic One-to-Many |
|`morphTo(name)`| Polymorphic inverse |
|`with(...relationships)`| Eager load |
|`load(...relationships)`| Load on instance |
|`whereHas(rel, cb)`| Filter by relation |
|`has(rel, op, count)`| Relation count filter |
|`whereDoesntHave(rel)`| Filter by no relation |
|`withCount(rel)`| Add relation count |
|`attach(ids)`| Attach (many-to-many) |
|`detach(ids?)`| Detach (many-to-many) |
|`sync(ids)`| Sync (many-to-many) |
|`withDefault(attrs?)`| Default for empty HasOne/MorphOne (v11) |

---

## Relation Defaults — withDefault() (v11.0.0)

Return a default model instead of `null` when a `hasOne`, `morphOne` or `hasOneThrough` relationship is empty:

```javascript
class User extends Model {
  static table = 'users';

  profile() {
    // Returns empty Profile instance instead of null
    return this.hasOne(Profile, 'user_id').withDefault();
  }

  avatar() {
    // Returns a Profile with default values
    return this.morphOne(Image, 'imageable').withDefault({
      url: '/images/default-avatar.png'
    });
  }

  settings() {
    // Dynamic defaults via callback
    return this.hasOne(Settings, 'user_id').withDefault((model) => {
      model.setAttribute('theme', 'light');
      model.setAttribute('locale', 'en');
    });
  }
}

// Usage
const user = await User.with('profile').find(1);
console.log(user.relationships.profile); // Profile instance (never null)
```

**Signatures:**
- `withDefault()` — empty model instance
- `withDefault({ key: value, ... })` — model with attributes
- `withDefault((model) => { ... })` — dynamic defaults via callback

**Supported on:** `hasOne`, `morphOne`, `hasOneThrough`

---

## Next Steps

- [Migrations & Schema Builder →](MIGRATIONS.md)
- [Advanced Features →](ADVANCED.md)

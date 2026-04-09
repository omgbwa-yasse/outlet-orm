# 🔗 Relationships

Outlet ORM supports all Eloquent-style relationships to link your models.

> 📁 **Location**: Define your relationships in`models/`— See [Project structure](INSTALLATION.md#structure-de-projet-recommended)
>
> 📘 **TypeScript**: Use types`HasOneRelation<T>`,`HasManyRelation<T>`, etc. See [TYPESCRIPT.md](TYPESCRIPT.md#relationships-typedes)

## Table of Contents

- [Types of relationships](#types-of-relationships)
- [Has One](#has-one)
- [Has Many (One-to-Many)](#has-many-one-to-many)
- [Belongs To](#belongs-to)
- [Belongs To Many](#belongs-to-many)
- [Has Many Through (Via intermediary)](#has-many-through-via-intermediary)
- [Has One Through](#has-one-through)
- [Polymorphic Relations](#polymorphic-relations)
  - [Morph One (One-to-one polymorphic)](#morph-one-one-to-one-polymorphic)
  - [Morph Many (One-to-many polymorphic)](#morph-many-one-to-many-polymorphic)
- [Eager Loading](#eager-loading)
  - [Load relationships](#load-relationships)
  - [Load after the fact](#load-after-the-fact)
- [Access relationships](#access-relationships)
- [Naming conventions](#naming-conventions)
  - [Tables](#tables)
  - [Foreign keys](#foreign-keys)
  - [Polymorphic columns](#polymorphic-columns)
- [Complete examples](#complete-examples)
  - [Blog complet](#blog-complet)
- [Next steps](#next-steps)

---

## Types of relationships

| Relationship | Description | Example |
|----------|-------------|---------|
|`hasOne`| One-on-one | User → Profile |
|`hasMany`| One-to-many | User → Posts |
|`belongsTo`| Reverse of hasOne/hasMany | Post → User |
|`belongsToMany`| Many-to-many | User ↔ Roles |
|`hasManyThrough`| One-to-many via intermediary | Country → Posts via Users |
|`hasOneThrough`| One-to-one via intermediary | Supplier → UserHistory via User |
|`morphOne`| One-to-one polymorphic | Post → Image (polymorphic) |
|`morphMany`| One-to-many polymorphic | Post → Comments (polymorphic) |
|`morphTo`| Polymorphic inverse | Comment → (Post\|Video) |

## Has One

A user has a profile.

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';

  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}

class Profile extends Model {
  static table = 'profiles';

  user() {
    return this.belongsTo(User, 'user_id');
  }
}

// Usage
const user = await User.with('profile').find(1);
console.log(user.profile); // { id: 1, bio: '...', avatar: '...' }
```

**Parameters:**
-`hasOne(RelatedModel, foreignKey, localKey)`
-`foreignKey`: default =`{model}_id`(ex:`user_id`)
-`localKey`: default =`id`

## Has Many (One-to-Many)

A user has multiple posts.

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';

  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

class Post extends Model {
  static table = 'posts';

  author() {
    return this.belongsTo(User, 'user_id');
  }
}

// Usage
const user = await User.with('posts').find(1);
console.log(user.posts); // [{ id: 1, title: '...' }, { id: 2, title: '...' }]

// Load the author of a post
const post = await Post.with('author').find(1);
console.log(post.author); // { id: 1, name: 'John' }
```

## Belongs To

Reverse of hasOne and hasMany.

```javascript
const { Model } = require('outlet-orm');

// Definitions of linked models
class User extends Model { static table = 'users'; }
class Post extends Model { static table = 'posts'; }

class Comment extends Model {
  static table = 'comments';

  post() {
    return this.belongsTo(Post, 'post_id');
  }

  user() {
    return this.belongsTo(User, 'user_id');
  }
}

// Usage
const comment = await Comment.with('post', 'user').find(1);
console.log(comment.post);  // The parent post
console.log(comment.user);  // The author of the comment
```

**Parameters:**
-`belongsTo(RelatedModel, foreignKey, ownerKey)`
-`foreignKey`: foreign key on the current model
-`ownerKey`: default =`id`

## Belongs To Many

Users and roles via a pivot table.

```sql
-- Tables
users (id, name, email)
roles (id, name)
role_user (user_id, role_id)  -- Table pivot
```

```javascript
class User extends Model {
  static table = 'users';

  roles() {
    return this.belongsToMany(Role, 'role_user', 'user_id', 'role_id');
  }
}

class Role extends Model {
  static table = 'roles';

  users() {
    return this.belongsToMany(User, 'role_user', 'role_id', 'user_id');
  }
}

// Usage
const user = await User.with('roles').find(1);
console.log(user.roles); // [{ id: 1, name: 'admin' }, { id: 2, name: 'editor' }]

// With pivot data
const userWithPivot = await User.with('roles').find(1);
userWithPivot.roles.forEach(role => {
  console.log(role.pivot); // { user_id: 1, role_id: 2 }
});
```

**Parameters:**
-`belongsToMany(RelatedModel, pivotTable, foreignPivotKey, relatedPivotKey, localKey, relatedKey)`

## Has Many Through (Via intermediary)

Pays → Posts via Users.

```sql
-- A country has several users, each user has several posts
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
      'country_id',   // Foreign key on User
      'user_id',      // Foreign key on Post
      'id',           // Local key on Country
      'id'            // Local key on User
    );
  }
}

// Usage
const france = await Country.with('posts').where('name', 'France').first();
console.log(france.posts); // All posts from French users
```

## Has One Through

Mechanic → Car Owner via Car.

```javascript
class Mechanic extends Model {
  static table = 'mechanics';

  carOwner() {
    return this.hasOneThrough(Owner, Car, 'mechanic_id', 'car_id', 'id', 'id');
  }
}
```

## Polymorphic Relations

### Morph One (One-to-one polymorphic)

An image can belong to a User or a Post.

```sql
images (id, url, imageable_type, imageable_id)
-- imageable_type: 'User' ou 'Post'
-- imageable_id: the corresponding ID
```

```javascript
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
    return this.morphTo('imageable', {
      'User': User,
      'Post': Post
    });
  }
}

// Usage
const user = await User.with('image').find(1);
console.log(user.image); // { url: 'avatar.jpg', imageable_type: 'User' }

const image = await Image.with('imageable').find(1);
console.log(image.imageable); // The corresponding User or Post
```

### Morph Many (One-to-many polymorphic)

Comments on Posts and Videos.

```sql
comments (id, body, commentable_type, commentable_id)
```

```javascript
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
    return this.morphTo('commentable', {
      'Post': Post,
      'Video': Video
    });
  }
}

// Usage
const post = await Post.with('comments').find(1);
console.log(post.comments); // All comments on the post

const comment = await Comment.with('commentable').find(1);
console.log(comment.commentable); // The commented Post or Video
```

## Eager Loading

### Load relationships

```javascript
// A relationship
const users = await User.with('posts').get();

// Multiple relationships
const users = await User.with('posts', 'profile', 'roles').get();

// Nested relationships
const users = await User.with('posts.comments.author').get();

// Combined
const users = await User.with('profile', 'posts.comments').get();
```

### Load after the fact

```javascript
const user = await User.find(1);

// Load a relationship
await user.load('posts');

// Load multiple
await user.load('posts', 'profile');

// Access
console.log(user.posts);
console.log(user.profile);
```

## Access relationships

After eager loading, the relationships are accessible as properties:

```javascript
const user = await User.with('posts', 'profile').find(1);

// Direct properties
console.log(user.posts);    // Post Array
console.log(user.profile);  // Objet Profile

// Iterate
for (const post of user.posts) {
  console.log(post.title);

  // ✨ v11.0.0+ — Proxy shorthand (equivalent)
  console.log(post.title);
}
```

## Naming conventions

### Tables
- Singular or plural:`user`or`users`
- Pivot table: alphabetical order`role_user`(not`user_role`)

### Foreign keys
- Format:`{model}_id`
- Examples:`user_id`,`post_id`,`category_id`

### Polymorphic columns
- Type:`{name}_type`(ex:`commentable_type`)
- ID:`{name}_id`(ex:`commentable_id`)

## Complete examples

### Blog complet

```javascript
const { Model } = require('outlet-orm');

// Definition of all models
class Profile extends Model { static table = 'profiles'; }
class Role extends Model { static table = 'roles'; }
class Tag extends Model { static table = 'tags'; }
class Image extends Model { static table = 'images'; }

class Comment extends Model {
  static table = 'comments';

  post() { return this.belongsTo(Post, 'post_id'); }
  author() { return this.belongsTo(User, 'user_id'); }
}

class Post extends Model {
  static table = 'posts';

  author() { return this.belongsTo(User, 'user_id'); }
  comments() { return this.hasMany(Comment, 'post_id'); }
  tags() { return this.belongsToMany(Tag, 'post_tag', 'post_id', 'tag_id'); }
  image() { return this.morphOne(Image, 'imageable'); }
}

class User extends Model {
  static table = 'users';

  posts() { return this.hasMany(Post, 'user_id'); }
  profile() { return this.hasOne(Profile, 'user_id'); }
  roles() { return this.belongsToMany(Role, 'role_user', 'user_id', 'role_id'); }
}

// Full query
const posts = await Post
  .with('author.profile', 'comments.author', 'tags', 'image')
  .where('status', 'published')
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();
```

## Default Values for Relations (v11.0.0)

Use `withDefault()` on `hasOne`, `morphOne`, or `hasOneThrough` to return a default model instead of `null`:

```javascript
class User extends Model {
  static table = 'users';

  profile() {
    // Returns an empty Profile instead of null
    return this.hasOne(Profile, 'user_id').withDefault();
  }

  settings() {
    // Returns a Profile with preset attributes
    return this.hasOne(Profile, 'user_id').withDefault({ bio: 'N/A', avatar: 'default.png' });
  }

  preferences() {
    // Returns a dynamically built default
    return this.hasOne(Preference, 'user_id').withDefault(() => {
      return new Preference({ theme: 'light', lang: 'en' });
    });
  }
}

const user = await User.with('profile').find(1);
console.log(user.profile); // Profile instance (never null)
```

## Next steps

- [Soft Deletes](SOFT_DELETES.md) - Soft deletion
- [Scopes](SCOPES.md) - Reusable queries
- [Events](EVENTS.md) - Hooks on the life cycle

# Automatic Relationship Detection

Outlet ORM's SQL Converter intelligently analyzes your database schema to **automatically** generate all relationships between your models.

> 📁 **Generation**: The generated models go into`models/`— See [Project structure](INSTALLATION.md#structure-de-projet-recommended)

## 🎯 Types of Relationships Detected

### 1. **belongsTo** (Belongs To)

Automatically detected when a table contains a foreign key.

**Detection:**
- Column ending with`_id`(ex:`user_id`,`category_id`)
- Clause`FOREIGN KEY`explicit

**SQL example:**
```sql
CREATE TABLE posts (
  id INT PRIMARY KEY,
  user_id INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Generated relationship:**
```javascript
// In Post.js
user() {
  return this.belongsTo(User, 'user_id');
}
```

---

### 2. **hasMany** (To many)

Automatically detected as **inverse relationship** of a`belongsTo`.

**Detection:**
- When another table refers to this table via a **non-unique** foreign key

**SQL example:**
```sql
-- Table users
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(255)
);

-- Table posts reference users
CREATE TABLE posts (
  id INT PRIMARY KEY,
  user_id INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Relationships generated:**
```javascript
// In Post.js
user() {
  return this.belongsTo(User, 'user_id');
}

// In User.js (automatically generated!)
posts() {
  return this.hasMany(Post, 'user_id');
}
```

---

### 3. **hasOne**

Automatically detected when the foreign key has a **UNIQUE constraint**.

**Detection:**
- Foreign key with`UNIQUE`constraint
- Inverse relationship where only one instance can exist

**SQL example:**
```sql
CREATE TABLE profiles (
  id INT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,  -- ← UNIQUE = hasOne
  bio TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Relationships generated:**
```javascript
// In Profile.js
user() {
  return this.belongsTo(User, 'user_id');
}

// In User.js (automatically generated!)
profile() {
  return this.hasOne(Profile, 'user_id');
}
```

---

### 4. **belongsToMany** (Many to Many)

Automatically detected via analysis of **pivot tables**.

**Detection of a pivot table:**
- Exactly **2 foreign keys**
- No other column (except`id`,`created_at`,`updated_at`)
- Generally named`table1_table2`(ex:`post_tag`)

**SQL example:**
```sql
-- Table posts
CREATE TABLE posts (
  id INT PRIMARY KEY,
  title VARCHAR(255)
);

-- Table tags
CREATE TABLE tags (
  id INT PRIMARY KEY,
  name VARCHAR(50)
);

-- Table pivot
CREATE TABLE post_tag (
  post_id INT NOT NULL,
  tag_id INT NOT NULL,
  created_at TIMESTAMP,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);
```

**Relationships generated:**
```javascript
// In Post.js (automatically generated!)
tags() {
  return this.belongsToMany(Tag, 'post_tag', 'post_id', 'tag_id');
}

// In Tag.js (automatically generated!)
posts() {
  return this.belongsToMany(Post, 'post_tag', 'tag_id', 'post_id');
}
```

---

## 🔍 Advanced Features

### Recursive Relations (Self-Relations)

The system automatically detects relationships where a table references itself.

**Example: Categories with subcategories**

```sql
CREATE TABLE categories (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  parent_id INT,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);
```

**Relationships generated:**
```javascript
// In Category.js
parent() {
  return this.belongsTo(Category, 'parent_id');
}

categories() {  // Subcategories
  return this.hasMany(Category, 'parent_id');
}
```

### Multiple Relations to the Same Table

A table can have multiple foreign keys to the same table.

**Example: Articles with author and editor**

```sql
CREATE TABLE posts (
  id INT PRIMARY KEY,
  title VARCHAR(255),
  author_id INT,
  editor_id INT,
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (editor_id) REFERENCES users(id)
);
```

**Relationships generated:**
```javascript
// In Post.js
author() {
  return this.belongsTo(User, 'author_id');
}

editor() {
  return this.belongsTo(User, 'editor_id');
}

// In User.js
posts() {
  return this.hasMany(Post, 'author_id');  // Articles as author
}

// Note: You will need to manually add the editedPosts() relationship
```

---

## 📊 Full Example

Here is a complete diagram with all the relationships:

```sql
-- 1. Table roles
CREATE TABLE roles (
  id INT PRIMARY KEY,
  name VARCHAR(50) UNIQUE
);

-- 2. Table users
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255) UNIQUE,
  role_id INT,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- 3. Table profiles (one-to-one)
CREATE TABLE profiles (
  id INT PRIMARY KEY,
  user_id INT UNIQUE,
  bio TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 4. Table posts
CREATE TABLE posts (
  id INT PRIMARY KEY,
  title VARCHAR(255),
  user_id INT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 5. Table tags
CREATE TABLE tags (
  id INT PRIMARY KEY,
  name VARCHAR(50)
);

-- 6. Table pivot post_tag
CREATE TABLE post_tag (
  post_id INT,
  tag_id INT,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);
```

### Automatically Generated Models

**User.js :**
```javascript
class User extends Model {
  static table = 'users';

  // Relationships
  role() {
    return this.belongsTo(Role, 'role_id');
  }

  profile() {
    return this.hasOne(Profile, 'user_id');
  }

  posts() {
    return this.hasMany(Post, 'user_id');
  }
}
```

**Role.js :**
```javascript
class Role extends Model {
  static table = 'roles';

  // Relationships
  users() {
    return this.hasMany(User, 'role_id');
  }
}
```

**Profile.js :**
```javascript
class Profile extends Model {
  static table = 'profiles';

  // Relationships
  user() {
    return this.belongsTo(User, 'user_id');
  }
}
```

**Post.js :**
```javascript
class Post extends Model {
  static table = 'posts';

  // Relationships
  user() {
    return this.belongsTo(User, 'user_id');
  }

  tags() {
    return this.belongsToMany(Tag, 'post_tag', 'post_id', 'tag_id');
  }
}
```

**Tag.js :**
```javascript
class Tag extends Model {
  static table = 'tags';

  // Relationships
  posts() {
    return this.belongsToMany(Post, 'post_tag', 'tag_id', 'post_id');
  }
}
```

---

## ✨ Advantages

1. **Saves time**: No need to manually define inverse relationships
2. **Consistency**: Relations are always symmetrical and correct
3. **Intelligent detection**: Automatically distinguishes`hasOne`et`hasMany`
4. **Pivot tables**: Automatically detects and configures many-to-many relationships
5. **Self-Relationships**: Correctly handles recursive relationships

---

## 🎨 Usage

```bash
outlet-convert
```

When converting, you will see:

```
✅ 5 table(s) trouvée(s)

🔍 Relationship analysis...

✅ User.js (3 relationships)
✅ Role.js (1 relation)
✅ Profile.js (1 relation)
✅ Post.js (2 relationships)
✅ Tag.js (1 relation)

✨ Conversion terminée! 5 model(s) créé(s) dans ./models
```

The relationship counter tells you how many relationship methods have been generated for each model.

---

## 🔧 Configuration

### Personalization after generation

The generated models are starting points. You can :

1. **Rename relationship methods** for clarity
2. **Add constraints** to relationship queries
3. **Define custom relationships** not automatically detectable

**Example :**
```javascript
// Rename for clarity
authoredPosts() {
  return this.hasMany(Post, 'author_id');
}

editedPosts() {
  return this.hasMany(Post, 'editor_id');
}

// Add constraints
publishedPosts() {
  return this.hasMany(Post, 'user_id')
    .where('status', 'published')
    .orderBy('published_at', 'desc');
}
```

---

## 📝 Important Notes

1. **Pivot tables**: Do not generate a model if they only contain the 2 foreign keys
2. **Naming**: Relationship methods follow Laravel conventions:
-`belongsTo`→ individually (from:`user()`,`category()`)
-`hasMany`→ several times (from:`posts()`,`comments()`)
-`hasOne`→ individually (from:`profile()`)
-`belongsToMany`→ several times (from:`tags()`,`roles()`)
3. **Polymorphic relationships**: Not supported automatically, to be defined manually

---

## 🧪 Test

A test SQL file is provided:`examples/relationships-test.sql`

Test detection:
```bash
outlet-convert
# Choose option 1
# Path: ./examples/relationships-test.sql
# Folder: ./test-relationships
```

Check the generated models in`./test-relationships`!

-- Test SQL pour démontrer la génération automatique des relations

-- Table Roles (sera référencée par users)
CREATE TABLE roles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table Users
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
);
-- Relations générées:
-- User.role() -> belongsTo(Role)
-- Role.users() -> hasMany(User)

-- Table Profiles (relation one-to-one avec users via user_id UNIQUE)
CREATE TABLE profiles (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,
  bio TEXT,
  avatar VARCHAR(255),
  website VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
-- Relations générées:
-- Profile.user() -> belongsTo(User)
-- User.profile() -> hasOne(Profile) [détecté par UNIQUE sur user_id]

-- Table Posts
CREATE TABLE posts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  user_id INT NOT NULL,
  category_id INT,
  status VARCHAR(20) DEFAULT 'draft',
  views_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (category_id) REFERENCES categories(id)
);
-- Relations générées:
-- Post.user() -> belongsTo(User)
-- Post.category() -> belongsTo(Category)
-- User.posts() -> hasMany(Post)
-- Category.posts() -> hasMany(Post)

-- Table Categories
CREATE TABLE categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  parent_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);
-- Relations générées:
-- Category.parent() -> belongsTo(Category) [auto-relation]
-- Category.categories() -> hasMany(Category) [sous-catégories]

-- Table Comments
CREATE TABLE comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  content TEXT NOT NULL,
  user_id INT NOT NULL,
  post_id INT NOT NULL,
  parent_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (parent_id) REFERENCES comments(id)
);
-- Relations générées:
-- Comment.user() -> belongsTo(User)
-- Comment.post() -> belongsTo(Post)
-- Comment.parent() -> belongsTo(Comment)
-- User.comments() -> hasMany(Comment)
-- Post.comments() -> hasMany(Comment)
-- Comment.comments() -> hasMany(Comment) [réponses]

-- Table Tags
CREATE TABLE tags (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table pivot post_tag (many-to-many entre posts et tags)
CREATE TABLE post_tag (
  post_id INT NOT NULL,
  tag_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, tag_id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);
-- Relations générées (détectées automatiquement):
-- Post.tags() -> belongsToMany(Tag, 'post_tag', 'post_id', 'tag_id')
-- Tag.posts() -> belongsToMany(Post, 'post_tag', 'tag_id', 'post_id')

-- Table Likes (polymorphique simple)
CREATE TABLE likes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  post_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (post_id) REFERENCES posts(id),
  UNIQUE KEY unique_like (user_id, post_id)
);
-- Relations générées:
-- Like.user() -> belongsTo(User)
-- Like.post() -> belongsTo(Post)
-- User.likes() -> hasMany(Like)
-- Post.likes() -> hasMany(Like)

-- RÉSUMÉ DES RELATIONS DÉTECTÉES AUTOMATIQUEMENT:
-- ================================================

-- User:
--   - role() -> belongsTo(Role, 'role_id')
--   - profile() -> hasOne(Profile, 'user_id')
--   - posts() -> hasMany(Post, 'user_id')
--   - comments() -> hasMany(Comment, 'user_id')
--   - likes() -> hasMany(Like, 'user_id')

-- Role:
--   - users() -> hasMany(User, 'role_id')

-- Profile:
--   - user() -> belongsTo(User, 'user_id')

-- Post:
--   - user() -> belongsTo(User, 'user_id')
--   - category() -> belongsTo(Category, 'category_id')
--   - comments() -> hasMany(Comment, 'post_id')
--   - likes() -> hasMany(Like, 'post_id')
--   - tags() -> belongsToMany(Tag, 'post_tag', 'post_id', 'tag_id')

-- Category:
--   - parent() -> belongsTo(Category, 'parent_id')
--   - categories() -> hasMany(Category, 'parent_id')
--   - posts() -> hasMany(Post, 'category_id')

-- Comment:
--   - user() -> belongsTo(User, 'user_id')
--   - post() -> belongsTo(Post, 'post_id')
--   - parent() -> belongsTo(Comment, 'parent_id')
--   - comments() -> hasMany(Comment, 'parent_id')

-- Tag:
--   - posts() -> belongsToMany(Post, 'post_tag', 'tag_id', 'post_id')

-- Like:
--   - user() -> belongsTo(User, 'user_id')
--   - post() -> belongsTo(Post, 'post_id')

# Détection Automatique des Relations

Le convertisseur SQL d'Outlet ORM analyse intelligemment votre schéma de base de données pour générer **automatiquement** toutes les relations entre vos modèles.

> 📁 **Génération** : Les modèles générés vont dans `models/` — Voir [Structure de projet](INSTALLATION.md#structure-de-projet-recommandée)

## 🎯 Types de Relations Détectées

### 1. **belongsTo** (Appartient à)

Détectée automatiquement lorsqu'une table contient une clé étrangère.

**Détection :**
- Colonne se terminant par `_id` (ex: `user_id`, `category_id`)
- Clause `FOREIGN KEY` explicite

**Exemple SQL :**
```sql
CREATE TABLE posts (
  id INT PRIMARY KEY,
  user_id INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Relation générée :**
```javascript
// Dans Post.js
user() {
  return this.belongsTo(User, 'user_id');
}
```

---

### 2. **hasMany** (A plusieurs)

Détectée automatiquement comme **relation inverse** d'un `belongsTo`.

**Détection :**
- Lorsqu'une autre table fait référence à cette table via une clé étrangère **non-unique**

**Exemple SQL :**
```sql
-- Table users
CREATE TABLE users (
  id INT PRIMARY KEY,
  name VARCHAR(255)
);

-- Table posts référence users
CREATE TABLE posts (
  id INT PRIMARY KEY,
  user_id INT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Relations générées :**
```javascript
// Dans Post.js
user() {
  return this.belongsTo(User, 'user_id');
}

// Dans User.js (généré automatiquement!)
posts() {
  return this.hasMany(Post, 'user_id');
}
```

---

### 3. **hasOne** (A un seul)

Détectée automatiquement lorsque la clé étrangère a une **contrainte UNIQUE**.

**Détection :**
- Clé étrangère avec `UNIQUE` constraint
- Relation inverse où une seule instance peut exister

**Exemple SQL :**
```sql
CREATE TABLE profiles (
  id INT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,  -- ← UNIQUE = hasOne
  bio TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Relations générées :**
```javascript
// Dans Profile.js
user() {
  return this.belongsTo(User, 'user_id');
}

// Dans User.js (généré automatiquement!)
profile() {
  return this.hasOne(Profile, 'user_id');
}
```

---

### 4. **belongsToMany** (Plusieurs à plusieurs)

Détectée automatiquement via l'analyse de **tables pivot**.

**Détection d'une table pivot :**
- Exactement **2 clés étrangères**
- Aucune autre colonne (sauf `id`, `created_at`, `updated_at`)
- Généralement nommée `table1_table2` (ex: `post_tag`)

**Exemple SQL :**
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

**Relations générées :**
```javascript
// Dans Post.js (généré automatiquement!)
tags() {
  return this.belongsToMany(Tag, 'post_tag', 'post_id', 'tag_id');
}

// Dans Tag.js (généré automatiquement!)
posts() {
  return this.belongsToMany(Post, 'post_tag', 'tag_id', 'post_id');
}
```

---

## 🔍 Fonctionnalités Avancées

### Relations Récursives (Auto-relations)

Le système détecte automatiquement les relations où une table référence elle-même.

**Exemple : Catégories avec sous-catégories**

```sql
CREATE TABLE categories (
  id INT PRIMARY KEY,
  name VARCHAR(100),
  parent_id INT,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);
```

**Relations générées :**
```javascript
// Dans Category.js
parent() {
  return this.belongsTo(Category, 'parent_id');
}

categories() {  // Sous-catégories
  return this.hasMany(Category, 'parent_id');
}
```

### Relations Multiples vers la Même Table

Une table peut avoir plusieurs clés étrangères vers la même table.

**Exemple : Articles avec auteur et éditeur**

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

**Relations générées :**
```javascript
// Dans Post.js
author() {
  return this.belongsTo(User, 'author_id');
}

editor() {
  return this.belongsTo(User, 'editor_id');
}

// Dans User.js
posts() {
  return this.hasMany(Post, 'author_id');  // Articles en tant qu'auteur
}

// Note: Vous devrez ajouter manuellement la relation editedPosts()
```

---

## 📊 Exemple Complet

Voici un schéma complet avec toutes les relations :

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

### Modèles Générés Automatiquement

**User.js :**
```javascript
class User extends Model {
  static table = 'users';

  // Relations
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

  // Relations
  users() {
    return this.hasMany(User, 'role_id');
  }
}
```

**Profile.js :**
```javascript
class Profile extends Model {
  static table = 'profiles';

  // Relations
  user() {
    return this.belongsTo(User, 'user_id');
  }
}
```

**Post.js :**
```javascript
class Post extends Model {
  static table = 'posts';

  // Relations
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

  // Relations
  posts() {
    return this.belongsToMany(Post, 'post_tag', 'tag_id', 'post_id');
  }
}
```

---

## ✨ Avantages

1. **Gain de temps** : Plus besoin de définir manuellement les relations inverses
2. **Cohérence** : Les relations sont toujours symétriques et correctes
3. **Détection intelligente** : Distingue automatiquement `hasOne` et `hasMany`
4. **Tables pivot** : Détecte et configure automatiquement les relations many-to-many
5. **Auto-relations** : Gère correctement les relations récursives

---

## 🎨 Utilisation

```bash
outlet-convert
```

Lors de la conversion, vous verrez :

```
✅ 5 table(s) trouvée(s)

🔍 Analyse des relations...

✅ User.js (3 relations)
✅ Role.js (1 relation)
✅ Profile.js (1 relation)
✅ Post.js (2 relations)
✅ Tag.js (1 relation)

✨ Conversion terminée! 5 modèle(s) créé(s) dans ./models
```

Le compteur de relations vous indique combien de méthodes de relation ont été générées pour chaque modèle.

---

## 🔧 Configuration

### Personnalisation après génération

Les modèles générés sont des points de départ. Vous pouvez :

1. **Renommer les méthodes** de relation pour plus de clarté
2. **Ajouter des contraintes** aux requêtes de relation
3. **Définir des relations personnalisées** non détectables automatiquement

**Exemple :**
```javascript
// Renommer pour plus de clarté
authoredPosts() {
  return this.hasMany(Post, 'author_id');
}

editedPosts() {
  return this.hasMany(Post, 'editor_id');
}

// Ajouter des contraintes
publishedPosts() {
  return this.hasMany(Post, 'user_id')
    .where('status', 'published')
    .orderBy('published_at', 'desc');
}
```

---

## 📝 Notes Importantes

1. **Tables pivot** : Ne génèrent pas de modèle si elles ne contiennent que les 2 clés étrangères
2. **Nommage** : Les méthodes de relation suivent les conventions Laravel :
   - `belongsTo` → singulier (ex: `user()`, `category()`)
   - `hasMany` → pluriel (ex: `posts()`, `comments()`)
   - `hasOne` → singulier (ex: `profile()`)
   - `belongsToMany` → pluriel (ex: `tags()`, `roles()`)
3. **Relations polymorphiques** : Non supportées automatiquement, à définir manuellement

---

## 🧪 Test

Un fichier SQL de test est fourni : `examples/relations-test.sql`

Testez la détection :
```bash
outlet-convert
# Choisir option 1
# Chemin: ./examples/relations-test.sql
# Dossier: ./test-relations
```

Vérifiez les modèles générés dans `./test-relations` !

# Outlet ORM

[![npm version](https://badge.fury.io/js/outlet-orm.svg)](https://www.npmjs.com/package/outlet-orm)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Un ORM JavaScript inspiré de Laravel Eloquent pour Node.js avec support pour MySQL, PostgreSQL et SQLite.

## ✅ Prérequis et compatibilité

- Node.js >= 18 (recommandé/exigé)
- Installez le driver de base de données correspondant à votre SGBD (voir ci-dessous)

## 🚀 Installation

```bash
npm install outlet-orm
```

### Installer le driver de base de données

Outlet ORM utilise des peerDependencies optionnelles pour les drivers de base de données. Installez uniquement le driver dont vous avez besoin:

- MySQL/MariaDB: `npm install mysql2`
- PostgreSQL: `npm install pg`
- SQLite: `npm install sqlite3`

Si aucun driver n'est installé, un message d'erreur explicite vous indiquera lequel installer lors de la connexion.

## ✨ Fonctionnalités clés

- **API inspirée d'Eloquent** (Active Record) pour un usage fluide
- **Query Builder expressif**: where/joins/order/limit/offset/paginate
- **Filtres relationnels façon Laravel**: `whereHas()`, `has()`, `whereDoesntHave()`, `withCount()`
- **Eager Loading** des relations via `.with(...)` avec contraintes et dot-notation
- **Relations complètes**:
  - `hasOne`, `hasMany`, `belongsTo`, `belongsToMany` (avec attach/detach/sync)
  - `hasManyThrough`, `hasOneThrough` (relations transitives)
  - `morphOne`, `morphMany`, `morphTo` (relations polymorphiques)
- **Casts automatiques** (int, float, boolean, json, date...)
- **Attributs masqués** (`hidden`) et timestamps automatiques
- **Contrôle de visibilité** des attributs cachés: `withHidden()` et `withoutHidden()`
- **Incrément/Décrément atomiques**: `increment()` et `decrement()`
- **Aliases ergonomiques**: `columns([...])`, `ordrer()` (alias typo de `orderBy`)
- **Requêtes brutes**: `executeRawQuery()` et `execute()` (résultats natifs du driver)
- **Migrations complètes** (create/alter/drop, index, foreign keys, batch tracking)
- **CLI pratiques**: `outlet-init`, `outlet-migrate`, `outlet-convert`
- **Configuration via `.env`** (chargée automatiquement)
- **Multi-base de données**: MySQL, PostgreSQL et SQLite
- **Types TypeScript** fournis

## ⚡ Démarrage Rapide

### Initialisation du projet

```bash
# Créer la configuration initiale
outlet-init

# Créer une migration
outlet-migrate make create_users_table

# Exécuter les migrations
outlet-migrate migrate
```

## 📖 Utilisation

### Configuration de la connexion

Outlet ORM peut charger automatiquement le provider (driver) et les paramètres d'accès à la base de données depuis un fichier `.env` dans votre application.

```javascript
const { DatabaseConnection, Model } = require('outlet-orm');

// Option 1 – via .env (aucun paramètre nécessaire)
// DB_DRIVER=mysql, DB_HOST=localhost, DB_DATABASE=myapp, DB_USER=root, DB_PASSWORD=secret
const db = new DatabaseConnection();

// Option 2 – via objet de configuration (prend le dessus sur .env)
const db = new DatabaseConnection({
  driver: 'mysql',      // 'mysql' | 'postgres' | 'sqlite'
  host: 'localhost',
  database: 'myapp',
  user: 'root',
  password: 'secret',
  port: 3306
});

// Définir la connexion par défaut
Model.setConnection(db);
```

#### Variables d'environnement (.env)

| Variable | Description | Par défaut |
|----------|-------------|------------|
| `DB_DRIVER` | `mysql`, `postgres`, `sqlite` | `mysql` |
| `DB_HOST` | Hôte de la base | `localhost` |
| `DB_PORT` | Port de connexion | Selon driver |
| `DB_USER` / `DB_USERNAME` | Identifiant | - |
| `DB_PASSWORD` | Mot de passe | - |
| `DB_DATABASE` / `DB_NAME` | Nom de la base | - |
| `DB_FILE` / `SQLITE_DB` | Fichier SQLite | `:memory:` |

### Importation

```javascript
// CommonJS
const { DatabaseConnection, Model } = require('outlet-orm');

// ES Modules
import { DatabaseConnection, Model } from 'outlet-orm';
```

### Définir un modèle

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
  static primaryKey = 'id';           // Par défaut: 'id'
  static timestamps = true;           // Par défaut: true
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password'];
  static casts = {
    id: 'int',
    email_verified: 'boolean',
    metadata: 'json',
    birthday: 'date'
  };

  // Relations
  posts() {
    return this.hasMany(Post, 'user_id');
  }

  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}
```

### Opérations CRUD

#### Créer

```javascript
// Méthode 1: create()
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secret123'
});

// Méthode 2: new + save()
const user = new User({
  name: 'Jane Doe',
  email: 'jane@example.com'
});
user.setAttribute('password', 'secret456');
await user.save();

// Insert brut (sans créer d'instance)
await User.insert({ name: 'Bob', email: 'bob@example.com' });
```

#### Lire

```javascript
// Tous les enregistrements
const users = await User.all();

// Par ID
const user = await User.find(1);
const user = await User.findOrFail(1); // Lance une erreur si non trouvé

// Premier résultat
const firstUser = await User.first();

// Avec conditions
const activeUsers = await User
  .where('status', 'active')
  .where('age', '>', 18)
  .get();

// Avec relations (Eager Loading)
const usersWithPosts = await User
  .with('posts', 'profile')
  .get();

// Ordonner et limiter
const recentUsers = await User
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();
```

#### Mettre à jour

```javascript
// Instance
const user = await User.find(1);
user.setAttribute('name', 'Updated Name');
await user.save();

// Bulk update
await User
  .where('status', 'pending')
  .update({ status: 'active' });

// Update + Fetch (comme Prisma)
const updated = await User
  .where('id', 1)
  .updateAndFetch({ name: 'Neo' }, ['profile', 'posts']);

// Helpers par ID
const user = await User.updateAndFetchById(1, { name: 'Trinity' }, ['profile']);
await User.updateById(2, { status: 'active' });
```

#### Supprimer

```javascript
// Instance
const user = await User.find(1);
await user.destroy();

// Bulk delete
await User
  .where('status', 'banned')
  .delete();
```

### Query Builder

```javascript
// Where clauses
const users = await User
  .where('age', '>', 18)
  .where('status', 'active')
  .orWhere('role', 'admin')
  .get();

// Where In / Not In
const users = await User.whereIn('id', [1, 2, 3, 4, 5]).get();
const users = await User.whereNotIn('status', ['banned', 'deleted']).get();

// Where Null / Not Null
const users = await User.whereNull('deleted_at').get();
const verified = await User.whereNotNull('email_verified_at').get();

// Where Between / Like
const adults = await User.whereBetween('age', [18, 65]).get();
const johns = await User.whereLike('name', '%john%').get();

// Pagination
const result = await User.paginate(1, 15);
// { data: [...], total: 100, per_page: 15, current_page: 1, last_page: 7, from: 1, to: 15 }

// Count / Exists
const count = await User.where('status', 'active').count();
const hasUsers = await User.where('role', 'admin').exists();

// Joins
const result = await User
  .join('profiles', 'users.id', 'profiles.user_id')
  .leftJoin('countries', 'profiles.country_id', 'countries.id')
  .select('users.*', 'profiles.bio', 'countries.name as country')
  .get();

// Agrégations
const stats = await User
  .distinct()
  .groupBy('status')
  .having('COUNT(*)', '>', 5)
  .get();

// Incrément / Décrément atomique
await User.where('id', 1).increment('login_count');
await User.where('id', 1).decrement('credits', 10);
```

### Filtres relationnels

```javascript
// whereHas: Utilisateurs ayant au moins un post publié
const authors = await User
  .whereHas('posts', (q) => {
    q.where('status', 'published');
  })
  .get();

// has: Au moins N enfants
const prolific = await User.has('posts', '>=', 10).get();

// whereDoesntHave: Aucun enfant
const noPostUsers = await User.whereDoesntHave('posts').get();

// withCount: Ajouter une colonne {relation}_count
const withCounts = await User.withCount('posts').get();
// Chaque user aura: user.getAttribute('posts_count')
```

## 🔗 Relations

### One to One (hasOne)

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}

const user = await User.find(1);
const profile = await user.profile().get();
```

### One to Many (hasMany)

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

const user = await User.find(1);
const posts = await user.posts().get();
```

### Belongs To (belongsTo)

```javascript
const { Model } = require('outlet-orm');

class Post extends Model {
  author() {
    return this.belongsTo(User, 'user_id');
  }
}

const post = await Post.find(1);
const author = await post.author().get();
```

### Many to Many (belongsToMany)

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  roles() {
    return this.belongsToMany(
      Role,
      'user_roles',   // Table pivot
      'user_id',      // FK vers User
      'role_id'       // FK vers Role
    );
  }
}

const user = await User.find(1);
const roles = await user.roles().get();

// Méthodes pivot
await user.roles().attach([1, 2]);    // Attacher des rôles
await user.roles().detach(2);          // Détacher un rôle
await user.roles().sync([1, 3]);       // Synchroniser (remplace tout)
```

### Has Many Through (hasManyThrough)

Accéder à une relation distante via un modèle intermédiaire.

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  // User -> Post -> Comment
  comments() {
    return this.hasManyThrough(Comment, Post, 'user_id', 'post_id');
  }
}

const user = await User.find(1);
const allComments = await user.comments().get();
```

### Has One Through (hasOneThrough)

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  // User -> Profile -> Country
  country() {
    return this.hasOneThrough(Country, Profile, 'user_id', 'country_id');
  }
}

const user = await User.find(1);
const country = await user.country().get();
```

### Relations Polymorphiques

Les relations polymorphiques permettent à un modèle d'appartenir à plusieurs autres modèles.

```javascript
const { Model } = require('outlet-orm');

// Configuration du morph map
Model.setMorphMap({
  'posts': Post,
  'videos': Video
});

// Modèles
class Post extends Model {
  comments() {
    return this.morphMany(Comment, 'commentable');
  }
}

class Video extends Model {
  comments() {
    return this.morphMany(Comment, 'commentable');
  }
}

class Comment extends Model {
  commentable() {
    return this.morphTo('commentable');
  }
}

// Usage
const post = await Post.find(1);
const comments = await post.comments().get();

const comment = await Comment.find(1);
const parent = await comment.commentable().get(); // Post ou Video
```

**Relations polymorphiques disponibles:**
- `morphOne(Related, 'morphName')` - One-to-One polymorphique
- `morphMany(Related, 'morphName')` - One-to-Many polymorphique
- `morphTo('morphName')` - Inverse polymorphique

### Eager Loading

```javascript
// Charger plusieurs relations
const users = await User.with('posts', 'profile', 'roles').get();

// Charger avec contraintes
const users = await User.with({
  posts: (q) => q.where('status', 'published').orderBy('created_at', 'desc')
}).get();

// Charger des relations imbriquées (dot notation)
const users = await User.with('posts.comments.author').get();

// Charger sur une instance existante
const user = await User.find(1);
await user.load('posts', 'profile');
await user.load(['roles', 'posts.comments']);

// Accéder aux relations chargées
users.forEach(user => {
  console.log(user.relations.posts);
  console.log(user.relations.profile);
});
```

## 🎭 Attributs

### Casts

Les casts convertissent automatiquement les attributs:

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static casts = {
    id: 'int',              // ou 'integer'
    age: 'integer',
    balance: 'float',       // ou 'double'
    email_verified: 'boolean', // ou 'bool'
    metadata: 'json',       // Parse JSON
    settings: 'array',      // Parse JSON en array
    birthday: 'date'        // Convertit en Date
  };
}
```

### Attributs cachés

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static hidden = ['password', 'secret_token'];
}

const user = await User.find(1);
console.log(user.toJSON()); // password et secret_token exclus
```

#### Afficher les attributs cachés

```javascript
// Inclure les attributs cachés
const user = await User.withHidden().where('email', 'john@example.com').first();
console.log(user.toJSON()); // password inclus

// Contrôler avec un booléen
const user = await User.withoutHidden(true).first(); // true = afficher
const user = await User.withoutHidden(false).first(); // false = masquer (défaut)

// Cas d'usage: authentification
const user = await User.withHidden().where('email', email).first();
if (user && await bcrypt.compare(password, user.getAttribute('password'))) {
  // Authentification réussie
}
```

### Timestamps

```javascript
const { Model } = require('outlet-orm');

// Activés par défaut (created_at, updated_at)
class User extends Model {
  static timestamps = true;
}

// Désactiver
class Log extends Model {
  static timestamps = false;
}
```

## 📝 API Reference

### DatabaseConnection

| Méthode | Description |
|---------|-------------|
| `new DatabaseConnection(config?)` | Crée une connexion (lit `.env` si config omis) |
| `connect()` | Établit la connexion (appelé automatiquement) |
| `select(table, query)` | Exécute un SELECT |
| `insert(table, data)` | Insère un enregistrement |
| `insertMany(table, data[])` | Insère plusieurs enregistrements |
| `update(table, data, query)` | Met à jour des enregistrements |
| `delete(table, query)` | Supprime des enregistrements |
| `count(table, query)` | Compte les enregistrements |
| `executeRawQuery(sql, params?)` | Requête brute (résultats normalisés) |
| `execute(sql, params?)` | Requête brute (résultats natifs driver) |
| `increment(table, column, query, amount?)` | Incrément atomique |
| `decrement(table, column, query, amount?)` | Décrément atomique |
| `close()` / `disconnect()` | Ferme la connexion |

### Model (méthodes statiques)

| Méthode | Description |
|---------|-------------|
| `setConnection(db)` | Définit la connexion par défaut |
| `setMorphMap(map)` | Définit le mapping polymorphique |
| `query()` | Retourne un QueryBuilder |
| `all()` | Tous les enregistrements |
| `find(id)` | Trouve par ID |
| `findOrFail(id)` | Trouve ou lance une erreur |
| `first()` | Premier enregistrement |
| `where(col, op?, val)` | Clause WHERE |
| `whereIn(col, vals)` | Clause WHERE IN |
| `whereNull(col)` | Clause WHERE NULL |
| `whereNotNull(col)` | Clause WHERE NOT NULL |
| `create(attrs)` | Crée et sauvegarde |
| `insert(data)` | Insert brut |
| `update(attrs)` | Update bulk |
| `updateById(id, attrs)` | Update par ID |
| `updateAndFetchById(id, attrs, rels?)` | Update + fetch avec relations |
| `delete()` | Delete bulk |
| `with(...rels)` | Eager loading |
| `withHidden()` | Inclut les attributs cachés |
| `withoutHidden(show?)` | Contrôle visibilité |
| `orderBy(col, dir?)` | Tri |
| `limit(n)` / `offset(n)` | Limite/Offset |
| `paginate(page, perPage)` | Pagination |
| `count()` | Compte |

### Model (méthodes d'instance)

| Méthode | Description |
|---------|-------------|
| `fill(attrs)` | Remplit les attributs |
| `setAttribute(key, val)` | Définit un attribut |
| `getAttribute(key)` | Récupère un attribut |
| `save()` | Sauvegarde (insert ou update) |
| `destroy()` | Supprime l'instance |
| `load(...rels)` | Charge des relations |
| `getDirty()` | Attributs modifiés |
| `isDirty()` | A été modifié? |
| `toJSON()` | Convertit en objet |

### QueryBuilder

| Méthode | Description |
|---------|-------------|
| `select(...cols)` / `columns([...])` | Sélection de colonnes |
| `distinct()` | SELECT DISTINCT |
| `where(col, op?, val)` | Clause WHERE |
| `whereIn(col, vals)` | WHERE IN |
| `whereNotIn(col, vals)` | WHERE NOT IN |
| `whereNull(col)` | WHERE NULL |
| `whereNotNull(col)` | WHERE NOT NULL |
| `orWhere(col, op?, val)` | OR WHERE |
| `whereBetween(col, [min, max])` | WHERE BETWEEN |
| `whereLike(col, pattern)` | WHERE LIKE |
| `whereHas(rel, cb?)` | Filtre par relation |
| `has(rel, op?, count)` | Existence relationnelle |
| `whereDoesntHave(rel)` | Absence de relation |
| `orderBy(col, dir?)` / `ordrer(...)` | Tri |
| `limit(n)` / `take(n)` | Limite |
| `offset(n)` / `skip(n)` | Offset |
| `groupBy(...cols)` | GROUP BY |
| `having(col, op, val)` | HAVING |
| `join(table, first, op?, second)` | INNER JOIN |
| `leftJoin(table, first, op?, second)` | LEFT JOIN |
| `with(...rels)` | Eager loading |
| `withCount(rels)` | Ajoute {rel}_count |
| `get()` | Exécute et retourne tous |
| `first()` | Premier résultat |
| `firstOrFail()` | Premier ou erreur |
| `paginate(page, perPage)` | Pagination |
| `count()` | Compte |
| `exists()` | Vérifie l'existence |
| `insert(data)` | Insert |
| `update(attrs)` | Update |
| `updateAndFetch(attrs, rels?)` | Update + fetch |
| `delete()` | Delete |
| `increment(col, amount?)` | Incrément atomique |
| `decrement(col, amount?)` | Décrément atomique |
| `clone()` | Clone le query builder |

## 🛠️ Outils CLI

### outlet-init

Initialise un nouveau projet avec configuration de base de données.

```bash
outlet-init
```

Génère:
- Fichier de configuration `database/config.js`
- Fichier `.env` avec les paramètres
- Modèle exemple
- Fichier d'utilisation

### outlet-migrate

Système complet de migrations.

```bash
# Créer une migration
outlet-migrate make create_users_table

# Exécuter les migrations
outlet-migrate migrate

# Voir le statut
outlet-migrate status

# Annuler la dernière migration
outlet-migrate rollback --steps 1

# Reset toutes les migrations
outlet-migrate reset --yes

# Refresh (reset + migrate)
outlet-migrate refresh --yes

# Fresh (drop all + migrate)
outlet-migrate fresh --yes
```

**Fonctionnalités des Migrations:**

- ✅ Création et gestion des migrations (create, alter, drop tables)
- ✅ Types de colonnes: id, string, text, integer, boolean, date, datetime, timestamp, decimal, float, json, enum, uuid, foreignId
- ✅ Modificateurs: nullable, default, unique, index, unsigned, autoIncrement, comment, after, first
- ✅ Clés étrangères: foreign(), constrained(), onDelete(), onUpdate(), CASCADE
- ✅ Index: index(), unique(), fullText()
- ✅ Manipulation: renameColumn(), dropColumn(), dropTimestamps()
- ✅ Migrations réversibles: Méthodes up() et down()
- ✅ Batch tracking: Rollback précis par batch
- ✅ SQL personnalisé: execute() pour commandes avancées

### outlet-convert

Convertit des schémas SQL en modèles ORM.

```bash
outlet-convert
```

**Options:**
1. Depuis un fichier SQL local
2. Depuis une base de données connectée

**Fonctionnalités:**
- ✅ Détection automatique des types et casts
- ✅ Génération automatique de TOUTES les relations (belongsTo, hasMany, hasOne, belongsToMany)
- ✅ Relations récursives (auto-relations)
- ✅ Détection des champs sensibles (password, token, etc.)
- ✅ Support des timestamps automatiques
- ✅ Conversion des noms en PascalCase

## 📚 Documentation

- [Guide des Migrations](docs/MIGRATIONS.md)
- [Conversion SQL](docs/SQL_CONVERSION.md)
- [Détection des Relations](docs/RELATIONS_DETECTION.md)
- [Guide de démarrage rapide](docs/QUICKSTART.md)
- [Architecture](docs/ARCHITECTURE.md)

## 🤝 Contribution

Les contributions sont les bienvenues! N'hésitez pas à ouvrir une issue ou un pull request.

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les guidelines.

## 📄 Licence

MIT - Voir [LICENSE](LICENSE) pour plus de détails.

---

Créé par [omgbwa-yasse](https://github.com/omgbwa-yasse)

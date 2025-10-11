# Outlet ORM

Un ORM JavaScript inspiré de Laravel Eloquent pour Node.js avec support pour MySQL, PostgreSQL et SQLite.

## 🚀 Installation

```bash
npm install outlet-orm
```

## ⚡ Démarrage Rapide

### Initialisation du projet

```bash
# Créer la configuration initiale
outlet-init

# Créer une migration
outlet-migrate make create_users_table

# Exécuter les migrations
outlet-migrate
```

## 📖 Utilisation Rapide

### Configuration de la connexion

```javascript
const { DatabaseConnection, Model } = require('outlet-orm');

// Configuration MySQL
const db = new DatabaseConnection({
  driver: 'mysql',
  host: 'localhost',
  database: 'myapp',
  user: 'root',
  password: 'secret',
  port: 3306
});

// Définir la connexion par défaut
Model.setConnection(db);
```

### Définir un modèle

```javascript
class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password'];
  static casts = {
    id: 'int',
    email_verified: 'boolean',
    metadata: 'json'
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
```

#### Lire

```javascript
// Tous les enregistrements
const users = await User.all();

// Par ID
const user = await User.find(1);

// Premier résultat
const firstUser = await User.first();

// Avec conditions
const activeUsers = await User
  .where('status', 'active')
  .where('age', '>', 18)
  .get();

// Avec relations
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

// Where In
const users = await User
  .whereIn('id', [1, 2, 3, 4, 5])
  .get();

// Where Null
const users = await User
  .whereNull('deleted_at')
  .get();

// Where Not Null
const users = await User
  .whereNotNull('email_verified_at')
  .get();

// Pagination
const result = await User.paginate(1, 15);
// {
//   data: [...],
//   total: 100,
//   per_page: 15,
//   current_page: 1,
//   last_page: 7,
//   from: 1,
//   to: 15
// }

// Count
const count = await User.where('status', 'active').count();
```

### Relations

#### One to One (hasOne)

```javascript
class User extends Model {
  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}

const user = await User.find(1);
const profile = await user.profile().get();
```

#### One to Many (hasMany)

```javascript
class User extends Model {
  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

const user = await User.find(1);
const posts = await user.posts().get();
```

#### Belongs To (belongsTo)

```javascript
class Post extends Model {
  author() {
    return this.belongsTo(User, 'user_id');
  }
}

const post = await Post.find(1);
const author = await post.author().get();
```

#### Many to Many (belongsToMany)

```javascript
class User extends Model {
  roles() {
    return this.belongsToMany(
      Role,
      'user_roles',      // Pivot table
      'user_id',          // Foreign key
      'role_id'           // Related key
    );
  }
}

const user = await User.find(1);
const roles = await user.roles().get();
```

### Eager Loading

```javascript
// Charger les relations avec les résultats
const users = await User.with('posts', 'profile').get();

// Accéder aux relations chargées
users.forEach(user => {
  console.log(user.getAttribute('name'));
  console.log(user.relations.posts);
  console.log(user.relations.profile);
});
```

### Casts

Les casts permettent de convertir automatiquement les attributs:

```javascript
class User extends Model {
  static casts = {
    id: 'int',
    age: 'integer',
    balance: 'float',
    email_verified: 'boolean',
    metadata: 'json',
    settings: 'array',
    birthday: 'date'
  };
}
```

### Attributs cachés

```javascript
class User extends Model {
  static hidden = ['password', 'secret_token'];
}

const user = await User.find(1);
console.log(user.toJSON()); // password et secret_token ne sont pas inclus
```

### Timestamps

```javascript
// Activer les timestamps automatiques (activé par défaut)
class User extends Model {
  static timestamps = true; // created_at et updated_at
}

// Désactiver les timestamps
class Log extends Model {
  static timestamps = false;
}
```

## 🔧 Configuration avancée

### Connexions multiples

```javascript
const mysqlDb = new DatabaseConnection({
  driver: 'mysql',
  host: 'localhost',
  database: 'app_db',
  user: 'root',
  password: 'secret'
});

const postgresDb = new DatabaseConnection({
  driver: 'postgres',
  host: 'localhost',
  database: 'analytics_db',
  user: 'postgres',
  password: 'secret'
});

// Par modèle
class User extends Model {
  static connection = mysqlDb;
}

class Analytics extends Model {
  static connection = postgresDb;
}
```

### Clé primaire personnalisée

```javascript
class User extends Model {
  static primaryKey = 'user_id';
}
```

### Nom de table personnalisé

```javascript
class User extends Model {
  static table = 'app_users';
}
```

## 📝 API Reference

### Model

- `static all()` - Récupérer tous les enregistrements
- `static find(id)` - Trouver par ID
- `static findOrFail(id)` - Trouver ou lancer une erreur
- `static where(column, operator, value)` - Ajouter une clause where
- `static create(attributes)` - Créer et sauvegarder
- `static insert(data)` - Insérer des données brutes
- `static update(attributes)` - Mise à jour bulk
- `static delete()` - Suppression bulk
- `save()` - Sauvegarder l'instance
- `destroy()` - Supprimer l'instance
- `toJSON()` - Convertir en JSON

### QueryBuilder

- `select(...columns)` - Sélectionner des colonnes
- `where(column, operator, value)` - Clause WHERE
- `whereIn(column, values)` - Clause WHERE IN
- `whereNull(column)` - Clause WHERE NULL
- `whereNotNull(column)` - Clause WHERE NOT NULL
- `orWhere(column, operator, value)` - Clause OR WHERE
- `orderBy(column, direction)` - Ordonner les résultats
- `limit(value)` - Limiter les résultats
- `offset(value)` - Décaler les résultats
- `with(...relations)` - Eager loading
- `get()` - Exécuter et récupérer
- `first()` - Premier résultat
- `paginate(page, perPage)` - Paginer les résultats
- `count()` - Compter les résultats

## 🛠️ Outils CLI

### 1. Initialisation d'un projet

```bash
outlet-init
```

Crée un nouveau projet avec configuration de base de données, modèle exemple et fichier d'utilisation.

### 2. Système de Migrations

```bash
# Créer une migration
outlet-migrate make create_users_table

# Exécuter les migrations
outlet-migrate
# Option 1: migrate

# Rollback dernière migration
outlet-migrate
# Option 2: rollback

# Voir le statut
outlet-migrate
# Option 6: status

# Reset toutes les migrations
outlet-migrate
# Option 3: reset

# Refresh (reset + migrate)
outlet-migrate
# Option 4: refresh

# Fresh (drop all + migrate)
outlet-migrate
# Option 5: fresh
```

**Fonctionnalités des Migrations :**
- ✅ **Création et gestion des migrations** (create, alter, drop tables)
- ✅ **Types de colonnes** : id, string, text, integer, boolean, date, datetime, timestamp, decimal, float, json, enum, uuid, foreignId
- ✅ **Modificateurs** : nullable, default, unique, index, unsigned, autoIncrement, comment, after, first
- ✅ **Clés étrangères** : foreign(), constrained(), onDelete(), onUpdate(), CASCADE
- ✅ **Index** : index(), unique(), fullText()
- ✅ **Manipulation de colonnes** : renameColumn(), dropColumn(), dropTimestamps()
- ✅ **Migrations réversibles** : Méthodes up() et down()
- ✅ **Batch tracking** : Rollback précis par batch
- ✅ **SQL personnalisé** : execute() pour commandes avancées
- ✅ **Multi-DB** : Support MySQL, PostgreSQL, SQLite

**Documentation complète :**
- [MIGRATIONS.md](docs/MIGRATIONS.md) - Guide complet des migrations

### 3. Conversion SQL vers ORM

```bash
outlet-convert
```

Convertit automatiquement des schémas SQL en modèles ORM :

**Option 1 : Depuis un fichier SQL local**

- Parsez des fichiers `.sql` contenant des instructions `CREATE TABLE`
- Génère automatiquement les modèles avec relations, casts, fillable, hidden

**Option 2 : Depuis une base de données connectée**

- Connectez-vous à MySQL, PostgreSQL ou SQLite
- Liste toutes les tables et génère les modèles correspondants
- Détecte automatiquement les relations et types de données

**Fonctionnalités de conversion :**
- ✅ Détection automatique des types et casts
- ✅ **Génération automatique de TOUTES les relations** :
  - `belongsTo` : Détecté via clés étrangères
  - `hasMany` : Généré automatiquement comme inverse de `belongsTo`
  - `hasOne` : Détecté via clés étrangères UNIQUE
  - `belongsToMany` : Détecté via tables pivot
- ✅ Relations récursives (auto-relations)
- ✅ Détection des champs sensibles (password, token, etc.)
- ✅ Support des timestamps automatiques
- ✅ Conversion des noms de tables en classes PascalCase

**Documentation complète :**

- [SQL_CONVERSION.md](docs/SQL_CONVERSION.md) - Guide de conversion
- [RELATIONS_DETECTION.md](docs/RELATIONS_DETECTION.md) - Détection des relations

## 🤝 Contribution

Les contributions sont les bienvenues! N'hésitez pas à ouvrir une issue ou un pull request.

## 📄 Licence

MIT

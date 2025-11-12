# Outlet ORM

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

- API inspirée d'Eloquent (Active Record) pour un usage fluide
- Query Builder expressif: where/joins/order/limit/offset/paginate
- Filtres relationnels façon Laravel: `whereHas()`
- Existence/absence et agrégations: `has()`, `whereDoesntHave()`, `withCount()`
- Eager Loading des relations via `.with(...)`
- Relations: hasOne, hasMany, belongsTo, belongsToMany (avec attach/detach/sync)
- Casts automatiques (int, float, boolean, json, date...)
- Attributs masqués (`hidden`) et timestamps automatiques
- Contrôle de visibilité des attributs cachés: `withHidden()` et `withoutHidden()`
- Incrément/Décrément atomiques: `increment()` et `decrement()`
- Aliases ergonomiques: `columns([...])`, `ordrer()` (alias typo de `orderBy`)
- Requêtes brutes: `executeRawQuery()` et `execute()` (résultats natifs du driver)
- Migrations complètes (create/alter/drop, index, foreign keys, batch tracking)
- CLI pratiques: `outlet-init`, `outlet-migrate`, `outlet-convert`
- Configuration via `.env` (chargée automatiquement)
- Multi-base de données: MySQL, PostgreSQL et SQLite
- Types TypeScript fournis

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

Outlet ORM peut charger automatiquement le provider (driver) et les paramètres d’accès à la base de données depuis un fichier `.env` dans votre application. Les variables supportées incluent :

- DB_DRIVER (mysql, postgres, sqlite)
- DB_HOST, DB_PORT
- DB_USER / DB_USERNAME, DB_PASSWORD
- DB_DATABASE / DB_NAME
- Pour SQLite: DB_FILE ou SQLITE_DB ou SQLITE_FILENAME

Un exemple est fourni dans `.env.example`.

```javascript
const { DatabaseConnection, Model } = require('outlet-orm');

// Configuration MySQL
// Option 1 – via .env (aucun paramètre nécessaire)
// DB_DRIVER=mysql, DB_HOST=localhost, DB_DATABASE=myapp, DB_USER=root, DB_PASSWORD=secret, DB_PORT=3306
const db = new DatabaseConnection();

// Option 2 – via objet de configuration (prend le dessus sur .env)
// const db = new DatabaseConnection({
//   driver: 'mysql',
//   host: 'localhost',
//   database: 'myapp',
//   user: 'root',
//   password: 'secret',
//   port: 3306
// });

// Définir la connexion par défaut
Model.setConnection(db);
```

#### Variables d'environnement (.env) — Détails

- DB_DRIVER: `mysql` | `postgres` | `sqlite` (alias acceptés: `postgresql`, `sqlite3`)
- DB_HOST, DB_PORT: hôte/port (par défaut: `localhost`, ports par défaut selon driver)
- DB_USER | DB_USERNAME, DB_PASSWORD: identifiants
- DB_DATABASE | DB_NAME: nom de la base (MySQL/Postgres)
- SQLite spécifiquement: `DB_FILE` ou `SQLITE_DB` ou `SQLITE_FILENAME` (par défaut `:memory:`)

Les paramètres passés au constructeur de `DatabaseConnection` ont priorité sur `.env`.

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

// One-liner façon Prisma (update + include)
const updated = await User
  .where('id', 1)
  .updateAndFetch({ name: 'Neo' }, ['profile', 'posts.comments']);

// Helpers par ID
const user1 = await User.updateAndFetchById(1, { name: 'Trinity' }, ['profile']);
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

// Joins
const result = await User
  .join('profiles', 'users.id', 'profiles.user_id')
  .leftJoin('countries', 'profiles.country_id', 'countries.id')
  .whereLike('users.name', '%john%')
  .whereBetween('users.age', [18, 65])
  .select('users.*', 'profiles.bio', 'countries.name as country')
  .orderBy('users.created_at', 'desc')
  .get();

// Alias ergonomiques
const slim = await User
  .columns(['id', 'name'])    // alias de select(...)
  .ordrer('created_at', 'desc') // alias typo de orderBy
  .get();

// whereHas: filtrer les parents qui ont des enfants correspondants
// Exemple: Utilisateurs ayant au moins un post publié récemment
const authors = await User
  .whereHas('posts', (q) => {
    q.where('status', 'published').where('created_at', '>', new Date(Date.now() - 7*24*3600*1000));
  })
  .get();

// has: au moins N enfants
const prolific = await User.has('posts', '>=', 10).get();

// whereDoesntHave: aucun enfant
const orphans = await User.whereDoesntHave('posts').get();

// withCount: ajouter une colonne posts_count
const withCounts = await User.withCount('posts').get();

// Agrégations: distinct, groupBy, having
const stats = await User
  .distinct()
  .groupBy('status')
  .having('COUNT(*)', '>', 5)
  .get();
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

// belongsToMany helpers
await user.roles().attach([1, 2]);
await user.roles().detach(2);
await user.roles().sync([1, 3]);
```

#### Has Many Through (hasManyThrough)

Permet d'accéder à une relation distante via un modèle intermédiaire (ex: User -> Post -> Comment pour récupérer les comments d'un user sans passer par les posts).

```javascript
class User extends Model {
  posts() {
    return this.hasMany(Post, 'user_id');
  }

  comments() {
    // hasManyThrough(final, through, fkOnThrough?, throughKeyOnFinal?, localKey?, throughLocalKey?)
    return this.hasManyThrough(Comment, Post, 'user_id', 'post_id');
  }
}

const user = await User.find(1);
const comments = await user.comments().get();

// Eager load (avec contrainte):
const users = await User.with({ comments: q => q.where('created_at', '>', new Date(Date.now() - 7*24*3600*1000)) }).get();
```

Par défaut, les clés sont inférées selon les conventions:

- foreignKeyOnThrough: `${parentTableSingular}_id`
- throughKeyOnFinal: `${throughTableSingular}_id`
- localKey: clé primaire du parent (par défaut `id`)
- throughLocalKey: clé primaire du modèle intermédiaire (par défaut `id`)

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

// Chargement à la demande sur une instance existante
const user = await User.find(1);
await user.load('posts.comments', 'profile');
// Ou tableau
await user.load(['roles', 'permissions']);
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

#### Afficher les attributs cachés

Parfois, vous devez inclure les attributs cachés dans les résultats, par exemple lors de l'authentification :

```javascript
// Inclure les attributs cachés dans les résultats de la requête
const user = await User.withHidden().where('email', 'john@example.com').first();
console.log(user.toJSON()); // password est inclus

// Alternative : contrôler la visibilité avec un booléen
const userWithPassword = await User.withoutHidden(true).where('email', 'john@example.com').first();
// true = afficher les attributs cachés
// false (défaut) = masquer les attributs cachés

// Utilisation typique pour l'authentification
const user = await User.withHidden().where('email', email).first();
if (user && await bcrypt.compare(password, user.getAttribute('password'))) {
  // Authentification réussie
}
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

### DatabaseConnection

- `new DatabaseConnection(config?)` — lit automatiquement `.env` si `config` est omis
- `connect()` — établit la connexion (appelé automatiquement au besoin)
- `select(table, query)` — exécute un SELECT (utilisé par le Query Builder)
- `insert(table, data)` / `insertMany(table, data[])`
- `update(table, data, query)` / `delete(table, query)`
- `count(table, query)` — retourne le total
- `executeRawQuery(sql, params?)` — résultats normalisés (tableau d’objets)
- `execute(sql, params?)` — résultats natifs du driver (utile pour migrations)
- `increment(table, column, query, amount?)` — mise à jour atomique
- `decrement(table, column, query, amount?)`
- `close()` / `disconnect()` — fermer la connexion

### Model

- `static all()` - Récupérer tous les enregistrements
- `static find(id)` - Trouver par ID
- `static findOrFail(id)` - Trouver ou lancer une erreur
- `static where(column, operator, value)` - Ajouter une clause where
- `static create(attributes)` - Créer et sauvegarder
- `static insert(data)` - Insérer des données brutes
- `static update(attributes)` - Mise à jour bulk
- `static updateAndFetchById(id, attributes, relations?)` - Mise à jour par ID et retour du modèle (avec include)
- `static updateById(id, attributes)` - Mise à jour par ID
- `static delete()` - Suppression bulk
- `static withHidden()` - Inclure les attributs cachés dans les résultats
- `static withoutHidden(show?)` - Contrôler la visibilité des attributs cachés (false = masquer, true = afficher)
- `save()` - Sauvegarder l'instance
- `destroy()` - Supprimer l'instance
- `toJSON()` - Convertir en JSON
- `load(...relations)` - Charger des relations sur une instance, supporte la dot-notation

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
- `exists()` - Vérifier l’existence
- `whereBetween(column, [min, max])` - Intervalle
- `whereLike(column, pattern)` - LIKE
- `whereHas(relation, cb?)` - Filtrer par relation (INNER JOIN)
- `has(relation, opOrCount, [count])` - Existence relationnelle (GROUP BY/HAVING)
- `whereDoesntHave(relation)` - Absence de relation (LEFT JOIN IS NULL)
- `join(table, first, [operator], second)` - INNER JOIN
- `leftJoin(table, first, [operator], second)` - LEFT JOIN
- `withCount(relations)` - Ajoute {relation}_count via sous-requête
- `distinct()` - SELECT DISTINCT
- `groupBy(...cols)` - GROUP BY
- `having(column, operator, value)` - HAVING
- `insert(data)` - Insérer des données (array => insertMany)
- `update(attributes)` - Mise à jour bulk
- `updateAndFetch(attributes, relations?)` - Mise à jour + premier enregistrement (avec include)
- `delete()` - Suppression bulk
- `increment(column, amount?)` - Incrément atomique
- `decrement(column, amount?)` - Décrément atomique
- `columns([...])` - Alias de `select(...cols)`
- `ordrer(column, direction?)` - Alias typo de `orderBy`

## 🛠️ Outils CLI

### 1. Initialisation d'un projet

```bash
outlet-init
```

Crée un nouveau projet avec configuration de base de données, modèle exemple et fichier d'utilisation.

Depuis la version actuelle, outlet-init peut aussi générer un fichier `.env` avec les paramètres saisis (driver, hôte, port, utilisateur, mot de passe, base de données ou fichier SQLite). Si `.env` existe déjà, il n'est pas modifié.

Astuce: dans les environnements CI/tests, vous pouvez désactiver l'installation automatique du driver en définissant `OUTLET_INIT_NO_INSTALL=1`.

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
# Exécuter les migrations en se basant sur .env si database/config.js est absent
# (DB_DRIVER, DB_HOST, DB_DATABASE, etc.)
outlet-migrate migrate

# Voir le statut
outlet-migrate status

# Annuler la dernière migration
outlet-migrate rollback --steps 1

# Astuce: si le fichier database/config.js existe, il est prioritaire sur .env
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

#### Option 1 : Depuis un fichier SQL local

- Parsez des fichiers `.sql` contenant des instructions `CREATE TABLE`
- Génère automatiquement les modèles avec relations, casts, fillable, hidden

#### Option 2 : Depuis une base de données connectée

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

### 4. Utilisation non-interactive (CI/CD)

Les commandes de migration supportent un mode non-interactif pratique pour l’automatisation:

```bash
# Exécuter les migrations en lisant la config depuis .env
outlet-migrate migrate

# Voir le statut
outlet-migrate status

# Annuler N étapes
outlet-migrate rollback --steps 1
```

Astuce: si `database/config.js` est présent, il a priorité sur `.env`.

**Documentation complète :**

- [SQL_CONVERSION.md](docs/SQL_CONVERSION.md) - Guide de conversion
- [RELATIONS_DETECTION.md](docs/RELATIONS_DETECTION.md) - Détection des relations

## 🤝 Contribution

Les contributions sont les bienvenues! N'hésitez pas à ouvrir une issue ou un pull request.

## 📄 Licence

MIT

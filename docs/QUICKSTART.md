# Guide de Démarrage Rapide

Ce guide vous aidera à démarrer rapidement avec Eloquent JS ORM.

## Installation

```bash
npm install outlet-orm mysql2
# ou pour PostgreSQL
npm install outlet-orm pg
# ou pour SQLite
npm install outlet-orm sqlite3
```

## Configuration Initiale

### 1. Créer une connexion à la base de données

```javascript
const { DatabaseConnection, Model } = require('outlet-orm');

const db = new DatabaseConnection({
  driver: 'mysql',
  host: 'localhost',
  database: 'myapp',
  user: 'root',
  password: 'secret',
  port: 3306
});

// Définir comme connexion par défaut
Model.setConnection(db);
```

### 2. Créer votre premier modèle

```javascript
class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password'];
  static casts = {
    id: 'int',
    email_verified: 'boolean'
  };
}
```

### 3. Utiliser le modèle

```javascript
// Créer un utilisateur
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secret123'
});

// Rechercher des utilisateurs
const users = await User.where('email', 'john@example.com').get();

// Mettre à jour
user.setAttribute('name', 'Jane Doe');
await user.save();

// Supprimer
await user.destroy();
```

## Opérations CRUD de Base

### Create (Créer)

```javascript
// Méthode 1: Avec create()
const user = await User.create({
  name: 'Alice',
  email: 'alice@example.com'
});

// Méthode 2: Avec new + save()
const user = new User();
user.setAttribute('name', 'Bob');
user.setAttribute('email', 'bob@example.com');
await user.save();

// Méthode 3: Insertion multiple
await User.insert([
  { name: 'User 1', email: 'user1@example.com' },
  { name: 'User 2', email: 'user2@example.com' }
]);
```

### Read (Lire)

```javascript
// Tous les enregistrements
const allUsers = await User.all();

// Par ID
const user = await User.find(1);

// Premier résultat
const firstUser = await User.first();

// Avec condition
const activeUsers = await User.where('status', 'active').get();

// Plusieurs conditions
const users = await User
  .where('age', '>', 18)
  .where('status', 'active')
  .orderBy('name')
  .limit(10)
  .get();
```

### Update (Mettre à jour)

```javascript
// Mise à jour d'instance
const user = await User.find(1);
user.setAttribute('name', 'Updated Name');
await user.save();

// Mise à jour en masse
await User
  .where('status', 'pending')
  .update({ status: 'active' });
```

### Delete (Supprimer)

```javascript
// Suppression d'instance
const user = await User.find(1);
await user.destroy();

// Suppression en masse
await User.where('status', 'banned').delete();
```

## Query Builder

### Clauses WHERE

```javascript
// Basique
User.where('name', 'John')
User.where('age', '>', 18)
User.where('email', 'LIKE', '%@example.com')

// WHERE IN
User.whereIn('id', [1, 2, 3, 4, 5])

// WHERE NULL
User.whereNull('deleted_at')

// WHERE NOT NULL
User.whereNotNull('email_verified_at')

// OR WHERE
User.where('role', 'admin').orWhere('role', 'moderator')

// Chaînage
User
  .where('age', '>', 18)
  .where('status', 'active')
  .whereNotNull('email_verified_at')
  .get()
```

### Tri et Limitation

```javascript
// ORDER BY
User.orderBy('name', 'asc')
User.orderBy('created_at', 'desc')

// LIMIT et OFFSET
User.limit(10).offset(20)
User.take(10).skip(20) // Alias

// Combinaison
User
  .where('status', 'active')
  .orderBy('created_at', 'desc')
  .limit(20)
  .get()
```

### Pagination

```javascript
const result = await User.paginate(1, 15);
console.log(result);
// {
//   data: [...],
//   total: 100,
//   per_page: 15,
//   current_page: 1,
//   last_page: 7,
//   from: 1,
//   to: 15
// }
```

## Relations

### Définir les relations

```javascript
class User extends Model {
  // One to One
  profile() {
    return this.hasOne(Profile, 'user_id');
  }

  // One to Many
  posts() {
    return this.hasMany(Post, 'user_id');
  }

  // Many to Many
  roles() {
    return this.belongsToMany(
      Role,
      'user_roles',
      'user_id',
      'role_id'
    );
  }
}

class Post extends Model {
  // Belongs To (inverse)
  author() {
    return this.belongsTo(User, 'user_id');
  }
}
```

### Utiliser les relations

```javascript
// Chargement lazy
const user = await User.find(1);
const posts = await user.posts().get();
const profile = await user.profile().get();

// Eager Loading (recommandé)
const users = await User.with('posts', 'profile').get();

users.forEach(user => {
  console.log(user.relations.posts);
  console.log(user.relations.profile);
});
```

### Relations Many-to-Many

```javascript
const user = await User.find(1);

// Récupérer les rôles
const roles = await user.roles().get();

// Attacher des rôles
await user.roles().attach([1, 2, 3]);

// Détacher des rôles
await user.roles().detach([2]);

// Synchroniser (remplace tous)
await user.roles().sync([1, 3, 4]);
```

## Casting d'Attributs

```javascript
class User extends Model {
  static casts = {
    id: 'int',
    age: 'integer',
    balance: 'float',
    is_active: 'boolean',
    metadata: 'json',
    settings: 'array',
    birthday: 'date'
  };
}

const user = await User.find(1);
console.log(typeof user.getAttribute('age')); // number
console.log(typeof user.getAttribute('is_active')); // boolean
console.log(user.getAttribute('metadata')); // Object
```

## Attributs Cachés

```javascript
class User extends Model {
  static hidden = ['password', 'secret_token'];
}

const user = await User.find(1);
const json = user.toJSON(); // password et secret_token exclus
```

## Mass Assignment

```javascript
class User extends Model {
  // Seuls ces attributs peuvent être assignés en masse
  static fillable = ['name', 'email', 'age'];
}

// OK
const user = new User({
  name: 'John',
  email: 'john@example.com',
  age: 30
});

// L'attribut 'role' sera ignoré
const user2 = new User({
  name: 'Jane',
  role: 'admin' // Ignoré car non dans fillable
});
```

## Timestamps Automatiques

```javascript
class User extends Model {
  static timestamps = true; // Par défaut
}

// created_at et updated_at sont gérés automatiquement
const user = await User.create({ name: 'John' });
console.log(user.getAttribute('created_at')); // Date actuelle

user.setAttribute('name', 'Jane');
await user.save();
console.log(user.getAttribute('updated_at')); // Mise à jour automatique
```

## Connexions Multiples

```javascript
const mysqlDb = new DatabaseConnection({
  driver: 'mysql',
  host: 'localhost',
  database: 'app_db'
});

const postgresDb = new DatabaseConnection({
  driver: 'postgres',
  host: 'localhost',
  database: 'analytics_db'
});

class User extends Model {
  static connection = mysqlDb;
}

class Analytics extends Model {
  static connection = postgresDb;
}
```

## Bonnes Pratiques

1. **Utilisez Eager Loading** pour éviter le problème N+1
```javascript
// ❌ Mauvais (N+1 queries)
const users = await User.all();
for (const user of users) {
  const posts = await user.posts().get();
}

// ✅ Bon (2 queries)
const users = await User.with('posts').get();
```

2. **Définissez fillable** pour la sécurité
```javascript
class User extends Model {
  static fillable = ['name', 'email']; // Uniquement ces champs
}
```

3. **Cachez les données sensibles**
```javascript
class User extends Model {
  static hidden = ['password', 'api_token'];
}
```

4. **Utilisez les casts** pour la cohérence des types
```javascript
class User extends Model {
  static casts = {
    id: 'int',
    is_active: 'boolean',
    settings: 'json'
  };
}
```

5. **Fermez les connexions** proprement
```javascript
const db = new DatabaseConnection(config);
// ... utilisation ...
await db.close();
```

## Prochaines Étapes

- Consultez le [README.md](README.md) pour la documentation complète
- Explorez les [exemples](examples/) pour plus de cas d'usage
- Lisez le [CONTRIBUTING.md](CONTRIBUTING.md) si vous souhaitez contribuer

## Support

Si vous rencontrez des problèmes, veuillez ouvrir une issue sur GitHub.

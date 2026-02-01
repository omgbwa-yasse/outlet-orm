# Architecture du Code

Ce document décrit l'architecture et la structure du code de l'ORM Outlet ORM.

## Structure du Projet Utilisateur (Architecture en Couches)

Voici la structure recommandée pour un projet utilisant Outlet ORM, basée sur le pattern **Architecture en Couches** :

> 🔐 **Sécurité** : Voir le [Guide de Sécurité](SECURITY.md) pour les bonnes pratiques.

```
mon-projet/
├── .env                           # ⚠️ JAMAIS commité (dans .gitignore)
├── .env.example                   # Template sans secrets
├── .gitignore
├── package.json
├── src/
│   ├── index.js                   # Point d'entrée
│   ├── controllers/               # 🎮 Couche Présentation
│   │   ├── UserController.js
│   │   └── PostController.js
│   ├── services/                  # ⚙️ Couche Métier (Business Logic)
│   │   ├── UserService.js
│   │   └── PostService.js
│   ├── repositories/              # 📦 Couche Accès Données
│   │   ├── UserRepository.js
│   │   └── PostRepository.js
│   ├── models/                    # 📊 Couche Modèles (outlet-orm)
│   │   ├── User.js
│   │   ├── Post.js
│   │   └── index.js
│   ├── middlewares/               # 🔒 Sécurité critique
│   │   ├── auth.js                # JWT authentication
│   │   ├── authorization.js       # RBAC
│   │   ├── rateLimiter.js
│   │   ├── validator.js
│   │   └── errorHandler.js
│   ├── routes/                    # 🛤️ Définition des routes
│   │   └── index.js
│   ├── config/                    # 🔒 Configuration centralisée
│   │   ├── app.js
│   │   ├── database.js
│   │   └── security.js            # Rate limit, helmet, CORS
│   ├── utils/                     # 🔒 Hash, tokens, encryption
│   │   ├── hash.js
│   │   └── token.js
│   └── validators/                # Schémas de validation
├── database/
│   ├── config.js                  # Config migrations
│   └── migrations/
├── public/                        # ✅ Seul dossier accessible
├── uploads/                       # ⚠️ Fichiers uploadés
├── logs/                          # 📋 Non versionnés
└── tests/
    ├── unit/
    └── integration/
```

### Flux de l'Architecture en Couches

```
┌─────────────────────────────────────────────────────────────┐
│                        REQUÊTE HTTP                         │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  🛤️ ROUTES          Routage vers le bon controller          │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  🔒 MIDDLEWARES      Validation, Auth, Rate Limiting        │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  🎮 CONTROLLERS      Gestion HTTP (req/res) uniquement      │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ SERVICES         Logique métier, règles business        │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  📦 REPOSITORIES     Abstraction accès données (CRUD)       │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  📊 MODELS           outlet-orm (User, Post, etc.)          │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     BASE DE DONNÉES                         │
└─────────────────────────────────────────────────────────────┘
```

### Responsabilités par Couche

| Couche | Fichiers | Responsabilité | Sécurité |
|--------|----------|----------------|----------|
| **Controllers** | `src/controllers/` | HTTP uniquement (req/res) | Validation entrée |
| **Services** | `src/services/` | Logique métier, règles | Autorisation |
| **Repositories** | `src/repositories/` | Abstraction BDD, requêtes | Sanitization |
| **Models** | `src/models/` | Structure données, relations | Fillable/Hidden |
| **Middlewares** | `src/middlewares/` | Auth, validation, erreurs | 🔒 **Critique** |
| **Config** | `src/config/` | Variables d'environnement | 🔒 Lit .env |
| **Utils** | `src/utils/` | Hash, tokens, helpers | 🔒 Ne pas exposer |

### Exemple d'Implémentation

```javascript
// src/models/User.js - Couche Modèle
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password'];
}
module.exports = User;

// src/repositories/UserRepository.js - Couche Repository
const User = require('../models/User');

class UserRepository {
  async findById(id) {
    return User.find(id);
  }
  async findByEmail(email) {
    return User.where('email', email).first();
  }
  async create(data) {
    return User.create(data);
  }
  async update(id, data) {
    const user = await User.find(id);
    if (user) {
      user.fill(data);
      await user.save();
    }
    return user;
  }
}
module.exports = new UserRepository();

// src/services/UserService.js - Couche Service
const userRepository = require('../repositories/UserRepository');
const bcrypt = require('bcrypt');

class UserService {
  async register(data) {
    // Logique métier : validation, hash password
    const existing = await userRepository.findByEmail(data.email);
    if (existing) throw new Error('Email déjà utilisé');
    
    data.password = await bcrypt.hash(data.password, 10);
    return userRepository.create(data);
  }
  
  async authenticate(email, password) {
    const user = await userRepository.findByEmail(email);
    if (!user) return null;
    
    const valid = await bcrypt.compare(password, user.getAttribute('password'));
    return valid ? user : null;
  }
}
module.exports = new UserService();

// src/controllers/UserController.js - Couche Controller
const userService = require('../services/UserService');

class UserController {
  async register(req, res) {
    try {
      const user = await userService.register(req.body);
      res.status(201).json({ success: true, user });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
  
  async login(req, res) {
    try {
      const user = await userService.authenticate(req.body.email, req.body.password);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Identifiants invalides' });
      }
      // Générer JWT token...
      res.json({ success: true, user, token: '...' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
module.exports = new UserController();
```

## Structure Interne de l'ORM

```
src/
├── index.js                 # Point d'entrée principal, exporte tous les modules
├── Model.js                 # Classe Model de base (Active Record)
├── QueryBuilder.js          # Constructeur de requêtes
├── DatabaseConnection.js    # Gestionnaire de connexion aux bases de données
└── Relations/               # Classes de relations
    ├── Relation.js          # Classe de base abstraite pour les relations
    ├── HasOneRelation.js    # Relation One-to-One
    ├── HasManyRelation.js   # Relation One-to-Many
    ├── BelongsToRelation.js # Relation inverse (Many-to-One)
    └── BelongsToManyRelation.js # Relation Many-to-Many
```

## Composants Principaux

### Model.js

La classe `Model` est le cœur de l'ORM. Elle implémente le pattern Active Record où chaque instance représente une ligne de la base de données.

**Responsabilités :**
- Gestion des attributs du modèle
- Opérations CRUD (Create, Read, Update, Delete)
- Casting des types
- Gestion des timestamps
- Mass assignment avec protection fillable
- Relations entre modèles
- Conversion JSON avec attributs cachés

**Propriétés statiques :**
- `table` : Nom de la table
- `primaryKey` : Clé primaire (défaut: 'id')
- `timestamps` : Active/désactive les timestamps automatiques
- `fillable` : Attributs autorisés pour l'assignation en masse
- `hidden` : Attributs cachés lors de la sérialisation JSON
- `casts` : Types de casting pour les attributs
- `connection` : Instance de connexion à la base de données

### QueryBuilder.js

Le `QueryBuilder` construit et exécute des requêtes SQL de manière fluide et chainable.

**Responsabilités :**
- Construction de requêtes SQL
- Clauses WHERE, ORDER BY, LIMIT, OFFSET
- Joins
- Eager loading des relations
- Pagination
- Agrégation (count, exists)

**Méthodes principales :**
- `where()`, `whereIn()`, `whereNull()`, etc. : Filtrage
- `orderBy()` : Tri
- `limit()`, `offset()` : Limitation
- `get()`, `first()`, `paginate()` : Exécution
- `with()` : Eager loading

### DatabaseConnection.js

Gère les connexions aux différentes bases de données (MySQL, PostgreSQL, SQLite).

**Responsabilités :**
- Établir et gérer les connexions
- Exécuter les requêtes SQL
- Adapter les requêtes pour chaque driver
- Pooling de connexions (MySQL)
- Transactions (à venir)

**Méthodes principales :**
- `connect()` : Établit la connexion
- `select()`, `insert()`, `update()`, `delete()` : Opérations CRUD
- `count()` : Comptage
- `executeRawQuery()` : Exécution SQL brute
- `close()` : Fermeture de la connexion

### Relations

#### Relation.js
Classe de base abstraite pour toutes les relations.

#### HasOneRelation.js
Implémente la relation one-to-one où le parent possède un enfant.

**Exemple :** User -> Profile

#### HasManyRelation.js
Implémente la relation one-to-many où le parent possède plusieurs enfants.

**Exemple :** User -> Posts

#### BelongsToRelation.js
Implémente la relation inverse où l'enfant appartient au parent.

**Exemple :** Post -> User (author)

#### BelongsToManyRelation.js
Implémente la relation many-to-many via une table pivot.

**Exemple :** User <-> Roles (via user_roles)

## Flux de Données

### Création d'un Enregistrement

```
User.create(data)
  ↓
new User(data)
  ↓
user.fill(data) // Vérifie fillable
  ↓
user.save()
  ↓
user.performInsert()
  ↓
connection.insert(table, data)
  ↓
Base de données
```

### Requête Simple

```
User.where('status', 'active').get()
  ↓
User.query()
  ↓
new QueryBuilder(User)
  ↓
queryBuilder.where('status', 'active')
  ↓
queryBuilder.get()
  ↓
connection.select(table, query)
  ↓
queryBuilder.hydrate(rows) // Crée des instances Model
  ↓
Retourne Array<User>
```

### Eager Loading

```
User.with('posts').get()
  ↓
queryBuilder.with('posts')
  ↓
queryBuilder.get()
  ↓
connection.select(table, query) // Récupère les users
  ↓
queryBuilder.eagerLoadRelations(users)
  ↓
Pour chaque relation:
  ↓
  relation.eagerLoad(users)
    ↓
    Récupère tous les posts des users en une requête
    ↓
    Assigne les posts à chaque user.relations.posts
```

## Patterns de Conception

### Active Record
Le modèle combine les données et la logique métier dans une seule classe.

### Builder Pattern
Le QueryBuilder utilise le pattern builder pour construire des requêtes de manière fluide.

### Strategy Pattern
DatabaseConnection adapte les requêtes selon le driver de base de données.

### Lazy Loading vs Eager Loading
- **Lazy Loading** : Les relations sont chargées à la demande
- **Eager Loading** : Les relations sont chargées en une seule requête optimisée

## Extensibilité

### Créer un Nouveau Type de Cast

```javascript
// Dans Model.js, méthode castAttribute()
case 'custom_type':
  return customTransformation(value);
```

### Ajouter un Nouveau Driver

```javascript
// Dans DatabaseConnection.js
case 'mongodb':
  await this.connectMongoDB();
  break;
```

### Créer une Nouvelle Relation

```javascript
// Créer HasManyThroughRelation.js
class HasManyThroughRelation extends Relation {
  // Implémenter la logique
}
```

## Optimisations

### Pooling de Connexions
MySQL utilise le pooling automatiquement via `mysql2/promise`.

### Eager Loading
Réduit le problème N+1 en chargeant les relations en bulk.

### Query Building
Les requêtes sont construites en mémoire avant l'exécution, permettant l'optimisation.

## Points d'Amélioration Futurs

- Support des transactions
- Query caching
- Soft deletes
- Observers/Events
- Migration system
- Schema builder
- Validation intégrée
- Relations polymorphiques

## Tests

Les tests sont organisés par composant :
- `tests/Model.test.js` : Tests du modèle
- `tests/DatabaseConnection.test.js` : Tests de connexion
- Plus de tests à venir pour les relations

## Contribution

Pour contribuer, veuillez lire [CONTRIBUTING.md](../CONTRIBUTING.md).

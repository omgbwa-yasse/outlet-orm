# Architecture du Code

Ce document décrit l'architecture et la structure du code de l'ORM Eloquent JS.

## Structure des Dossiers

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

# 🔍 Query Builder

Le Query Builder d'Outlet ORM offre une interface fluide pour construire des requêtes SQL.

> 📁 **Utilisation** : Dans vos fichiers `models/`, `controllers/`, `services/` ou `src/` — Voir [Structure de projet](INSTALLATION.md#structure-de-projet-recommandée)
>
> 📘 **TypeScript** : Le type `WhereOperator` définit tous les opérateurs disponibles. Voir [TYPESCRIPT.md](TYPESCRIPT.md)

## Utilisation de base

```javascript
const { Model } = require('outlet-orm');

// Via un modèle (recommandé)
const users = await User.query()
  .where('status', 'active')
  .get();

// Ou avec QueryBuilder directement (avancé)
const { QueryBuilder } = require('outlet-orm');
const db = Model.getConnection();
const qb = new QueryBuilder(db, 'users');
```

## Sélection de colonnes

```javascript
// Toutes les colonnes
const users = await User.select('*').get();

// Colonnes spécifiques
const users = await User.select('id', 'name', 'email').get();

// Avec alias
const users = await User.select('id', 'name AS username').get();

// RAW expression
const users = await User.select('*', 'COUNT(*) as total').get();
```

## Clauses WHERE

### Where simple

```javascript
// Égalité
User.where('status', 'active');
User.where('status', '=', 'active');

// Comparaisons
User.where('age', '>', 18);
User.where('price', '<=', 100);
User.where('email', '!=', 'spam@example.com');

// Chaîner plusieurs where (AND)
User.where('status', 'active').where('role', 'admin');
```

### Where OR

```javascript
User.where('role', 'admin')
    .orWhere('role', 'moderator');
// WHERE role = 'admin' OR role = 'moderator'
```

### Where IN

```javascript
User.whereIn('id', [1, 2, 3, 4, 5]);
// WHERE id IN (1, 2, 3, 4, 5)

User.whereNotIn('status', ['banned', 'suspended']);
// WHERE status NOT IN ('banned', 'suspended')
```

### Where NULL

```javascript
User.whereNull('deleted_at');
// WHERE deleted_at IS NULL

User.whereNotNull('email_verified_at');
// WHERE email_verified_at IS NOT NULL
```

### Where BETWEEN

```javascript
User.whereBetween('age', 18, 65);
// WHERE age BETWEEN 18 AND 65

User.whereNotBetween('price', 0, 10);
// WHERE price NOT BETWEEN 0 AND 10
```

### Where LIKE

```javascript
User.whereLike('name', '%john%');
// WHERE name LIKE '%john%'

User.whereLike('email', '%@gmail.com');
// WHERE email LIKE '%@gmail.com'
```

### Where RAW

```javascript
User.whereRaw('YEAR(created_at) = ?', [2024]);
// WHERE YEAR(created_at) = 2024

User.whereRaw('age > ? AND age < ?', [18, 65]);
```

### Where groupé

```javascript
User.where('status', 'active')
    .where(builder => {
      builder.where('role', 'admin')
             .orWhere('role', 'moderator');
    });
// WHERE status = 'active' AND (role = 'admin' OR role = 'moderator')
```

## Tri et ordre

```javascript
// Ordre ascendant
User.orderBy('name', 'asc');

// Ordre descendant
User.orderBy('created_at', 'desc');

// Multiple
User.orderBy('status', 'asc').orderBy('name', 'asc');

// Latest (raccourci pour orderBy created_at desc)
User.latest();

// Oldest (raccourci pour orderBy created_at asc)
User.oldest();
```

## Limite et offset

```javascript
// Limiter le nombre de résultats
User.limit(10);

// Offset pour pagination
User.offset(20);

// Les deux ensemble
User.limit(10).offset(20); // Page 3 avec 10 par page

// Take (alias de limit)
User.take(5);

// Skip (alias de offset)
User.skip(10);
```

## Agrégations

```javascript
// Compter
const total = await User.where('status', 'active').count();

// Maximum
const maxAge = await User.max('age');

// Minimum
const minPrice = await Product.min('price');

// Somme
const totalRevenue = await Order.sum('amount');

// Moyenne
const avgRating = await Review.avg('rating');
```

## Group By et Having

```javascript
const stats = await Order
  .select('status', 'COUNT(*) as count', 'SUM(amount) as total')
  .groupBy('status')
  .having('count', '>', 10)
  .get();
```

## Distinct

```javascript
const countries = await User.select('country').distinct().get();
```

## Jointures

```javascript
// Inner Join
User.join('orders', 'users.id', '=', 'orders.user_id');

// Left Join
User.leftJoin('profiles', 'users.id', '=', 'profiles.user_id');

// Right Join
User.rightJoin('departments', 'users.dept_id', '=', 'departments.id');
```

## Sous-requêtes

```javascript
// Where avec sous-requête
User.whereIn('id', subQuery => {
  return subQuery.select('user_id').from('orders').where('amount', '>', 100);
});
```

## Exécution

### Récupérer les résultats

```javascript
// Tous les résultats
const users = await User.where('status', 'active').get();

// Premier résultat
const user = await User.where('email', 'john@example.com').first();

// Par ID
const user = await User.find(1);

// Tous sans filtres
const all = await User.all();
```

### Vérifier l'existence

```javascript
const hasActive = await User.where('status', 'active').exists();
// true ou false

const isEmpty = await User.where('status', 'deleted').doesntExist();
// true ou false
```

### Récupérer une colonne

```javascript
// Liste d'emails uniquement
const emails = await User.pluck('email');
// ['john@example.com', 'jane@example.com', ...]
```

## Mise à jour

```javascript
// Update en masse
await User.where('status', 'pending')
          .where('created_at', '<', '2024-01-01')
          .update({ status: 'expired' });

// Incrément
await Product.where('id', 1).increment('views');
await Product.where('id', 1).increment('views', 10);

// Décrément
await Product.where('id', 1).decrement('stock');
await Product.where('id', 1).decrement('stock', 5);
```

## Suppression

```javascript
// Supprimer en masse
await User.where('status', 'inactive')
          .where('last_login', '<', '2023-01-01')
          .delete();

// Truncate (supprimer tout)
await User.truncate();
```

## Transactions (voir TRANSACTIONS.md)

```javascript
const db = Model.getConnection();

await db.transaction(async (trx) => {
  await User.useTransaction(trx).create({ name: 'John' });
  await Profile.useTransaction(trx).create({ user_id: 1 });
  // Commit automatique si pas d'erreur
});
```

## Debug et logging

```javascript
// Obtenir le SQL généré (sans exécuter)
const sql = User.where('status', 'active').toSQL();
console.log(sql);
// { sql: 'SELECT * FROM users WHERE status = ?', bindings: ['active'] }
```

## Pagination intégrée

```javascript
// Page 1, 15 éléments par page
const result = await User.paginate(1, 15);

// Résultat
{
  data: [User, User, ...],   // Modèles de la page
  total: 150,                // Nombre total
  per_page: 15,              // Par page
  current_page: 1,           // Page actuelle
  last_page: 10,             // Dernière page
  from: 1,                   // Index début
  to: 15                     // Index fin
}
```

## Soft Deletes dans le Query Builder

Quand un modèle a `softDeletes = true` :

```javascript
// Par défaut, les supprimés sont exclus
const users = await User.get(); // Exclut deleted_at NOT NULL

// Inclure les supprimés
const allUsers = await User.withTrashed().get();

// Seulement les supprimés
const deletedUsers = await User.onlyTrashed().get();
```

## Scopes dans le Query Builder

```javascript
class User extends Model {
  static scopes = {
    active: (query) => query.where('status', 'active'),
    verified: (query) => query.whereNotNull('email_verified_at'),
    recent: (query) => query.where('created_at', '>', '2024-01-01')
  };
}

// Utiliser les scopes
const users = await User.scope('active', 'verified').get();
const recentActive = await User.scope('active', 'recent').get();
```

## Chaîner les méthodes

```javascript
const results = await User
  .select('id', 'name', 'email', 'status')
  .where('status', 'active')
  .whereNotNull('email_verified_at')
  .whereBetween('age', 18, 65)
  .whereIn('country', ['US', 'CA', 'UK'])
  .orderBy('created_at', 'desc')
  .limit(20)
  .offset(0)
  .with('posts', 'profile')
  .get();
```

## Prochaines étapes

- [Relations](RELATIONS.md) - Associations entre modèles
- [Transactions](TRANSACTIONS.md) - Gestion des transactions
- [Scopes](SCOPES.md) - Requêtes réutilisables

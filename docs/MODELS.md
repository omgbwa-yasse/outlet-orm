# 📋 Modèles et CRUD

Les modèles dans Outlet ORM suivent le pattern Active Record, inspiré de Laravel Eloquent.

> 📁 **Emplacement recommandé** : `models/` (définitions) et utilisé dans `controllers/` — Voir [Structure de projet](INSTALLATION.md#structure-de-projet-recommandée)
>
> 📘 **TypeScript** : Utilisez `Model<TAttributes>` pour des attributs typés. Voir [TYPESCRIPT.md](TYPESCRIPT.md#generic-model-v400)

## Définir un modèle

```javascript
const { Model } = require('outlet-orm');

// Définition des modèles liés (voir Relations pour plus de détails)
class Post extends Model {
  static table = 'posts';
}

class Profile extends Model {
  static table = 'profiles';
}

class User extends Model {
  // Nom de la table (obligatoire)
  static table = 'users';
  
  // Clé primaire (défaut: 'id')
  static primaryKey = 'id';
  
  // Timestamps automatiques (défaut: true)
  static timestamps = true;
  
  // Attributs modifiables en masse
  static fillable = ['name', 'email', 'password'];
  
  // Attributs cachés dans toJSON()
  static hidden = ['password', 'remember_token'];
  
  // Soft deletes (défaut: false)
  static softDeletes = false;
  
  // Règles de validation
  static rules = {
    name: 'required|string|min:2',
    email: 'required|email'
  };
  
  // Casts automatiques
  static casts = {
    id: 'int',
    email_verified: 'boolean',
    settings: 'json',
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

module.exports = User;
```

## Types de casts disponibles

| Cast | Description |
|------|-------------|
| `int` / `integer` | Convertit en entier |
| `float` / `double` | Convertit en décimal |
| `string` | Convertit en chaîne |
| `bool` / `boolean` | Convertit en booléen |
| `json` / `array` | Parse JSON |
| `date` | Convertit en objet Date |

## Opérations CRUD

### Create (Créer)

```javascript
// Méthode 1: create() - crée et sauvegarde
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'hashed_password'
});
console.log(user.getAttribute('id')); // ID auto-généré

// Méthode 2: new + save() - plus de contrôle
const user = new User({
  name: 'Jane Doe',
  email: 'jane@example.com'
});
user.setAttribute('password', 'hashed_password');
await user.save();

// Méthode 3: insert() - insertion brute sans instance
await User.insert({ name: 'Bob', email: 'bob@example.com' });

// Insertion multiple
await User.insert([
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Charlie', email: 'charlie@example.com' }
]);
```

### Read (Lire)

```javascript
// Tous les enregistrements
const users = await User.all();

// Par ID
const user = await User.find(1);

// Par ID ou erreur
const user = await User.findOrFail(1); // Lance Error si non trouvé

// Premier résultat
const user = await User.first();
const user = await User.where('email', 'john@example.com').first();

// Avec conditions
const activeUsers = await User
  .where('status', 'active')
  .where('role', 'admin')
  .get();

// Avec relations (eager loading)
const usersWithPosts = await User
  .with('posts', 'profile')
  .get();

// Ordonner
const recentUsers = await User
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();

// Compter
const count = await User.where('status', 'active').count();

// Vérifier existence
const exists = await User.where('email', 'test@example.com').exists();
```

### Update (Mettre à jour)

```javascript
// Méthode 1: Modifier une instance
const user = await User.find(1);
user.setAttribute('name', 'John Updated');
user.setAttribute('email', 'john.updated@example.com');
await user.save();

// Méthode 2: fill() + save()
const user = await User.find(1);
user.fill({ name: 'New Name', email: 'new@email.com' });
await user.save();

// Méthode 3: Update en masse
await User.where('status', 'pending').update({ status: 'active' });

// Méthode 4: Update par ID
await User.updateById(1, { name: 'Updated Name' });

// Méthode 5: Update et récupérer avec relations
const user = await User.updateAndFetchById(1, { name: 'New' }, ['posts']);
```

### Delete (Supprimer)

```javascript
// Supprimer une instance
const user = await User.find(1);
await user.destroy();

// Suppression en masse
await User.where('status', 'inactive').delete();

// Avec soft deletes activé
class Post extends Model {
  static softDeletes = true;
}

const post = await Post.find(1);
await post.destroy();        // Soft delete (met deleted_at)
await post.forceDelete();    // Suppression définitive
await post.restore();        // Restaurer
```

## Attributs

### Accéder aux attributs

```javascript
const user = await User.find(1);

// Méthode getAttribute
const name = user.getAttribute('name');
const email = user.getAttribute('email');

// Les attributs sont aussi dans user.attributes
console.log(user.attributes);
```

### Modifier les attributs

```javascript
const user = await User.find(1);

// setAttribute
user.setAttribute('name', 'New Name');

// fill (modifie plusieurs attributs)
user.fill({ name: 'New', email: 'new@email.com' });

// Sauvegarder les changements
await user.save();
```

### Attributs modifiés (dirty)

```javascript
const user = await User.find(1);
console.log(user.isDirty()); // false

user.setAttribute('name', 'Changed');
console.log(user.isDirty()); // true

const changes = user.getDirty();
console.log(changes); // { name: 'Changed' }

await user.save();
console.log(user.isDirty()); // false
```

## Attributs cachés

```javascript
class User extends Model {
  static hidden = ['password', 'secret_token'];
}

const user = await User.find(1);

// toJSON() exclut les attributs cachés
console.log(user.toJSON()); // { id: 1, name: 'John', email: '...' }

// Inclure les attributs cachés
const userWithPassword = await User.withHidden().find(1);
console.log(userWithPassword.toJSON()); // Inclut password
```

## Timestamps

```javascript
// Activés par défaut
class User extends Model {
  static timestamps = true; // created_at, updated_at automatiques
}

// Désactiver
class Log extends Model {
  static timestamps = false;
}
```

Quand `timestamps = true` :
- `created_at` est défini automatiquement à la création
- `updated_at` est mis à jour automatiquement à chaque modification

## Conversion en JSON

```javascript
const user = await User.with('posts').find(1);

// Convertir en objet
const json = user.toJSON();
// {
//   id: 1,
//   name: 'John',
//   email: 'john@example.com',
//   posts: [...]  // Relations chargées incluses
// }

// Pour API
res.json(user.toJSON());
```

## Charger des relations après coup

```javascript
const user = await User.find(1);

// Charger une relation
await user.load('posts');

// Charger plusieurs relations
await user.load('posts', 'profile');

// Charger des relations imbriquées
await user.load('posts.comments');
```

## Pagination

```javascript
const result = await User.paginate(1, 15);

// Résultat
{
  data: [...],           // Modèles de la page
  total: 100,            // Nombre total d'enregistrements
  per_page: 15,          // Éléments par page
  current_page: 1,       // Page actuelle
  last_page: 7,          // Dernière page
  from: 1,               // Index du premier élément
  to: 15                 // Index du dernier élément
}
```

## Incrément / Décrément atomique

```javascript
// Incrémenter
await User.where('id', 1).increment('login_count');
await User.where('id', 1).increment('points', 10);

// Décrémenter
await User.where('id', 1).decrement('credits');
await User.where('id', 1).decrement('credits', 5);
```

## Prochaines étapes

- [Query Builder](QUERY_BUILDER.md) - Requêtes avancées
- [Relations](RELATIONS.md) - Associations entre modèles
- [Validation](VALIDATION.md) - Valider les données
- [Events](EVENTS.md) - Hooks sur le cycle de vie

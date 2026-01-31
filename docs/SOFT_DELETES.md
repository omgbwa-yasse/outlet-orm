# 🗑️ Soft Deletes

Le soft delete (suppression douce) permet de marquer les enregistrements comme "supprimés" sans les supprimer réellement de la base de données.

> 📁 **Configuration** : Dans `models/` + migration dans `database/migrations/` — Voir [Structure de projet](INSTALLATION.md#structure-de-projet-recommandée)

## Principe

Au lieu de supprimer une ligne, on met à jour une colonne `deleted_at` avec la date de suppression. Les requêtes normales excluent automatiquement ces enregistrements.

## Configuration

### 1. Migration de la table

Ajoutez une colonne `deleted_at` nullable :

```javascript
// Migration
module.exports = {
  up: async (schema) => {
    await schema.createTable('posts', (table) => {
      table.id();
      table.string('title');
      table.text('content');
      table.integer('user_id');
      table.timestamps();
      table.timestamp('deleted_at').nullable(); // Pour soft deletes
    });
  }
};
```

Ou ajoutez-la à une table existante :

```sql
ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMP NULL;
```

### 2. Activer dans le modèle

```javascript
const { Model } = require('outlet-orm');

class Post extends Model {
  static table = 'posts';
  static softDeletes = true;  // Activer soft deletes
}
```

## Utilisation

### Supprimer (soft delete)

```javascript
const post = await Post.find(1);
await post.destroy();

// La ligne n'est PAS supprimée
// deleted_at est mis à la date/heure actuelle
```

### Requêtes automatiques

Par défaut, les enregistrements supprimés sont **exclus** :

```javascript
// N'inclut PAS les posts supprimés
const posts = await Post.all();
const posts = await Post.where('user_id', 1).get();
const post = await Post.find(1); // null si supprimé
```

### Inclure les supprimés

```javascript
// Inclure les supprimés avec les autres
const allPosts = await Post.withTrashed().get();

// Inclure pour une recherche spécifique
const post = await Post.withTrashed().find(1);
```

### Seulement les supprimés

```javascript
// Obtenir uniquement les enregistrements supprimés
const deletedPosts = await Post.onlyTrashed().get();

// Avec conditions
const myDeletedPosts = await Post
  .onlyTrashed()
  .where('user_id', 1)
  .get();
```

### Restaurer un enregistrement

```javascript
// Restaurer un enregistrement supprimé
const post = await Post.withTrashed().find(1);
await post.restore();

// deleted_at redevient NULL
```

### Suppression définitive

```javascript
// Supprimer définitivement (même avec soft deletes activé)
const post = await Post.withTrashed().find(1);
await post.forceDelete();

// La ligne est vraiment supprimée de la base
```

## Vérifier l'état

```javascript
const post = await Post.withTrashed().find(1);

// Vérifier si supprimé
if (post.getAttribute('deleted_at')) {
  console.log('Ce post est supprimé');
}
```

## Exemples pratiques

### Corbeille

```javascript
class TrashController {
  // Liste des éléments supprimés
  async index() {
    const trashedPosts = await Post.onlyTrashed()
      .orderBy('deleted_at', 'desc')
      .get();
    return trashedPosts;
  }

  // Restaurer un élément
  async restore(id) {
    const post = await Post.withTrashed().find(id);
    if (!post) throw new Error('Post not found');
    await post.restore();
    return post;
  }

  // Vider la corbeille
  async empty() {
    const trashed = await Post.onlyTrashed().get();
    for (const post of trashed) {
      await post.forceDelete();
    }
  }

  // Supprimer définitivement un élément
  async destroy(id) {
    const post = await Post.withTrashed().find(id);
    if (!post) throw new Error('Post not found');
    await post.forceDelete();
  }
}
```

### Suppression en cascade

```javascript
const { Model } = require('outlet-orm');

// Définition des modèles
class Post extends Model {
  static table = 'posts';
  static softDeletes = true;
}

class User extends Model {
  static table = 'users';
  static softDeletes = true;

  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

// Supprimer un utilisateur et ses posts
async function softDeleteUserWithPosts(userId) {
  const user = await User.find(userId);
  
  // Soft delete des posts
  await Post.where('user_id', userId).update({
    deleted_at: new Date().toISOString()
  });
  
  // Soft delete de l'utilisateur
  await user.destroy();
}

// Restaurer un utilisateur et ses posts
async function restoreUserWithPosts(userId) {
  const user = await User.withTrashed().find(userId);
  await user.restore();
  
  await Post.onlyTrashed()
    .where('user_id', userId)
    .update({ deleted_at: null });
}
```

### Nettoyage automatique

```javascript
// Supprimer définitivement les éléments de plus de 30 jours
async function cleanupOldTrashed() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const oldTrashed = await Post
    .onlyTrashed()
    .where('deleted_at', '<', thirtyDaysAgo.toISOString())
    .get();

  for (const post of oldTrashed) {
    await post.forceDelete();
  }

  console.log(`${oldTrashed.length} posts définitivement supprimés`);
}
```

## Avec les relations

### Eager loading et soft deletes

```javascript
// Les relations respectent aussi le soft delete
const user = await User.with('posts').find(1);
// user.posts n'inclut PAS les posts supprimés

// Pour inclure les posts supprimés
const user = await User.find(1);
const allPosts = await Post.withTrashed().where('user_id', user.getAttribute('id')).get();
```

## Events avec Soft Deletes

Les events sont déclenchés normalement :

```javascript
class Post extends Model {
  static softDeletes = true;

  static boot() {
    // Déclenché lors du soft delete
    this.deleting((post) => {
      console.log('Post being soft deleted:', post.getAttribute('id'));
    });

    this.deleted((post) => {
      console.log('Post soft deleted:', post.getAttribute('id'));
    });

    // Déclenché lors de la restauration
    this.restoring((post) => {
      console.log('Post being restored:', post.getAttribute('id'));
    });

    this.restored((post) => {
      console.log('Post restored:', post.getAttribute('id'));
    });
  }
}
```

## Bonnes pratiques

### 1. Indexez la colonne deleted_at

```sql
CREATE INDEX idx_posts_deleted_at ON posts(deleted_at);
```

### 2. Utilisez pour les données importantes

```javascript
// ✅ Bon usage - Données importantes
class Invoice extends Model {
  static softDeletes = true;
}

// ❌ Pas nécessaire - Données temporaires
class Session extends Model {
  static softDeletes = false;
}
```

### 3. Nettoyez régulièrement

```javascript
// Cron job ou scheduled task
await cleanupOldTrashed();
```

### 4. Considérez les foreign keys

```javascript
// Supprimez les enfants avant le parent
await Comment.where('post_id', postId).delete();
await post.destroy();
```

## API Complète

| Méthode | Description |
|---------|-------------|
| `destroy()` | Soft delete (met deleted_at) |
| `restore()` | Restaure (remet deleted_at à null) |
| `forceDelete()` | Suppression définitive |
| `withTrashed()` | Inclut les supprimés dans la requête |
| `onlyTrashed()` | Retourne uniquement les supprimés |

## Prochaines étapes

- [Scopes](SCOPES.md) - Requêtes réutilisables
- [Events](EVENTS.md) - Hooks sur le cycle de vie
- [Transactions](TRANSACTIONS.md) - Opérations atomiques

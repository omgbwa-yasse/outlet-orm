# 🎯 Events (Hooks)

Les events permettent d'exécuter du code à différentes étapes du cycle de vie d'un modèle.

> 📁 **Emplacement** : Définissez vos events dans `models/` ou `services/` — Voir [Structure de projet](INSTALLATION.md#structure-de-projet-recommandée)
>
> 📘 **TypeScript** : Utilisez le type `ModelEventName` pour les noms d'événements. Voir [TYPESCRIPT.md](TYPESCRIPT.md)

## Events disponibles

| Event | Moment | Peut annuler | Type TypeScript |
|-------|--------|--------------|------------------|
| `creating` | Avant INSERT | ✅ Oui | `'creating'` |
| `created` | Après INSERT | ❌ Non | `'created'` |
| `updating` | Avant UPDATE | ✅ Oui | `'updating'` |
| `updated` | Après UPDATE | ❌ Non | `'updated'` |
| `saving` | Avant INSERT ou UPDATE | ✅ Oui | `'saving'` |
| `saved` | Après INSERT ou UPDATE | ❌ Non | `'saved'` |
| `deleting` | Avant DELETE | ✅ Oui | `'deleting'` |
| `deleted` | Après DELETE | ❌ Non | `'deleted'` |
| `restoring` | Avant restauration (soft delete) | ✅ Oui | `'restoring'` |
| `restored` | Après restauration | ❌ Non | `'restored'` |

## Enregistrer des events

### Via boot()

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';

  static boot() {
    // Avant création
    this.creating((user) => {
      console.log('Creating user:', user.getAttribute('name'));
      // Modifier les attributs
      user.setAttribute('slug', slugify(user.getAttribute('name')));
    });

    // Après création
    this.created((user) => {
      console.log('User created with ID:', user.getAttribute('id'));
      // Envoyer email de bienvenue, etc.
    });

    // Avant mise à jour
    this.updating((user) => {
      console.log('Updating user:', user.getAttribute('id'));
    });

    // Après mise à jour
    this.updated((user) => {
      console.log('User updated:', user.getAttribute('id'));
    });

    // Avant save (create ou update)
    this.saving((user) => {
      console.log('Saving user...');
    });

    // Après save
    this.saved((user) => {
      console.log('User saved!');
    });

    // Avant suppression
    this.deleting((user) => {
      console.log('Deleting user:', user.getAttribute('id'));
    });

    // Après suppression
    this.deleted((user) => {
      console.log('User deleted');
    });
  }
}
```

### Via addEventListener (dynamique)

```javascript
// Ajouter des listeners dynamiquement
User.addEventListener('creating', (user) => {
  user.setAttribute('api_token', generateToken());
});

User.addEventListener('deleting', (user) => {
  console.log('About to delete user:', user.getAttribute('id'));
});
```

## Annuler une opération

Retournez `false` dans un event "before" pour annuler l'opération :

```javascript
class Post extends Model {
  static table = 'posts';

  static boot() {
    this.creating((post) => {
      // Vérifier si l'utilisateur peut créer
      if (post.getAttribute('user_id') === null) {
        console.log('Cannot create post without user');
        return false; // Annule la création
      }
    });

    this.deleting((post) => {
      // Empêcher la suppression des posts épinglés
      if (post.getAttribute('is_pinned')) {
        console.log('Cannot delete pinned post');
        return false; // Annule la suppression
      }
    });

    this.updating((post) => {
      // Empêcher la modification des posts archivés
      if (post.getAttribute('status') === 'archived') {
        return false;
      }
    });
  }
}
```

## Cas d'utilisation

### Auto-génération de données

```javascript
class Article extends Model {
  static table = 'articles';

  static boot() {
    this.creating((article) => {
      // Générer un slug
      const title = article.getAttribute('title');
      article.setAttribute('slug', title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''));

      // Générer un UUID
      article.setAttribute('uuid', crypto.randomUUID());

      // Définir l'auteur courant
      if (!article.getAttribute('author_id')) {
        article.setAttribute('author_id', getCurrentUserId());
      }
    });
  }
}
```

### Validation personnalisée

```javascript
class User extends Model {
  static table = 'users';

  static boot() {
    this.saving((user) => {
      const email = user.getAttribute('email');
      
      // Valider le format de l'email
      if (!email || !email.includes('@')) {
        throw new Error('Invalid email format');
      }

      // Normaliser l'email
      user.setAttribute('email', email.toLowerCase().trim());
    });
  }
}
```

### Audit et logging

```javascript
class Order extends Model {
  static table = 'orders';

  static boot() {
    this.created((order) => {
      AuditLog.create({
        action: 'order_created',
        model: 'Order',
        model_id: order.getAttribute('id'),
        data: JSON.stringify(order.toJSON()),
        user_id: getCurrentUserId(),
        created_at: new Date().toISOString()
      });
    });

    this.updated((order) => {
      AuditLog.create({
        action: 'order_updated',
        model: 'Order',
        model_id: order.getAttribute('id'),
        data: JSON.stringify(order.getDirty()),
        user_id: getCurrentUserId(),
        created_at: new Date().toISOString()
      });
    });

    this.deleted((order) => {
      AuditLog.create({
        action: 'order_deleted',
        model: 'Order',
        model_id: order.getAttribute('id'),
        user_id: getCurrentUserId(),
        created_at: new Date().toISOString()
      });
    });
  }
}
```

### Suppression en cascade

```javascript
class User extends Model {
  static table = 'users';

  static boot() {
    this.deleting(async (user) => {
      const userId = user.getAttribute('id');
      
      // Supprimer les relations avant l'utilisateur
      await Comment.where('user_id', userId).delete();
      await Post.where('user_id', userId).delete();
      await Profile.where('user_id', userId).delete();
    });
  }
}
```

### Nettoyage de cache

```javascript
class Product extends Model {
  static table = 'products';

  static boot() {
    const clearCache = (product) => {
      cache.delete(`product:${product.getAttribute('id')}`);
      cache.delete('products:all');
      cache.delete(`category:${product.getAttribute('category_id')}:products`);
    };

    this.created(clearCache);
    this.updated(clearCache);
    this.deleted(clearCache);
  }
}
```

### Notifications

```javascript
class Order extends Model {
  static table = 'orders';

  static boot() {
    this.created(async (order) => {
      // Notifier le client
      const user = await User.find(order.getAttribute('user_id'));
      await sendEmail(user.getAttribute('email'), 'order_confirmation', {
        order_id: order.getAttribute('id'),
        total: order.getAttribute('total')
      });
    });

    this.updated(async (order) => {
      if (order.getAttribute('status') === 'shipped') {
        const user = await User.find(order.getAttribute('user_id'));
        await sendEmail(user.getAttribute('email'), 'order_shipped', {
          order_id: order.getAttribute('id'),
          tracking: order.getAttribute('tracking_number')
        });
      }
    });
  }
}
```

### Soft Delete Events

```javascript
class Post extends Model {
  static table = 'posts';
  static softDeletes = true;

  static boot() {
    this.deleting((post) => {
      console.log('Post moving to trash:', post.getAttribute('id'));
    });

    this.deleted((post) => {
      console.log('Post in trash:', post.getAttribute('id'));
    });

    this.restoring((post) => {
      console.log('Restoring post:', post.getAttribute('id'));
    });

    this.restored((post) => {
      console.log('Post restored:', post.getAttribute('id'));
      // Réindexer pour la recherche
      searchIndex.add(post);
    });
  }
}
```

## Ordre d'exécution

### Création (save sur nouveau modèle)

1. `saving` - Avant toute sauvegarde
2. `creating` - Avant INSERT
3. **INSERT en base**
4. `created` - Après INSERT
5. `saved` - Après toute sauvegarde

### Mise à jour (save sur modèle existant)

1. `saving` - Avant toute sauvegarde
2. `updating` - Avant UPDATE
3. **UPDATE en base**
4. `updated` - Après UPDATE
5. `saved` - Après toute sauvegarde

### Suppression

1. `deleting` - Avant DELETE
2. **DELETE en base** (ou UPDATE deleted_at pour soft delete)
3. `deleted` - Après DELETE

### Restauration (soft delete)

1. `restoring` - Avant restauration
2. **UPDATE deleted_at = NULL**
3. `restored` - Après restauration

## Bonnes pratiques

### 1. Gardez les events légers

```javascript
// ✅ Bon - Opération rapide
this.creating((user) => {
  user.setAttribute('slug', slugify(user.getAttribute('name')));
});

// ❌ Mauvais - Opération lourde synchrone
this.creating(async (user) => {
  await heavyComputation();
  await externalApiCall();
});
```

### 2. Utilisez async avec précaution

```javascript
// Pour les opérations async, envisagez des queues
this.created((user) => {
  // Ajouter à une queue plutôt qu'attendre
  queue.add('send-welcome-email', { userId: user.getAttribute('id') });
});
```

### 3. Évitez les boucles infinies

```javascript
// ❌ Danger - Boucle infinie!
this.updated((user) => {
  user.setAttribute('updated_count', user.getAttribute('updated_count') + 1);
  user.save(); // Déclenche encore 'updated'!
});

// ✅ Solution - Utiliser update direct
this.updated((user) => {
  User.where('id', user.getAttribute('id'))
      .increment('updated_count'); // Pas d'event
});
```

### 4. Documentez vos events

```javascript
class User extends Model {
  static boot() {
    // Event: Génère automatiquement un slug à partir du name
    this.creating((user) => {
      user.setAttribute('slug', slugify(user.getAttribute('name')));
    });

    // Event: Envoie un email de bienvenue après inscription
    this.created((user) => {
      emailQueue.add('welcome', { userId: user.getAttribute('id') });
    });
  }
}
```

## Prochaines étapes

- [Validation](VALIDATION.md) - Valider les données
- [Soft Deletes](SOFT_DELETES.md) - Suppression douce
- [Transactions](TRANSACTIONS.md) - Opérations atomiques

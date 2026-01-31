# 🔭 Scopes

Les scopes permettent de définir des contraintes de requête réutilisables sur vos modèles.

> 📁 **Emplacement** : Définissez vos scopes dans `models/` — Voir [Structure de projet](INSTALLATION.md#structure-de-projet-recommandée)
>
> 📘 **TypeScript** : Les scopes sont typés avec `ScopeFunction`. Voir [TYPESCRIPT.md](TYPESCRIPT.md)

## Types de Scopes

| Type | Application | Utilisation |
|------|-------------|-------------|
| **Global Scopes** | Automatique sur toutes les requêtes | Toujours actif |
| **Local Scopes** | Manuel via `.scope()` | À la demande |

## Global Scopes

Les scopes globaux s'appliquent automatiquement à chaque requête sur le modèle.

### Définir un global scope

```javascript
const { Model } = require('outlet-orm');

class Post extends Model {
  static table = 'posts';
  
  // Scopes globaux - s'appliquent automatiquement
  static globalScopes = {
    published: (query) => query.where('status', 'published'),
    ordered: (query) => query.orderBy('created_at', 'desc')
  };
}
```

### Utilisation automatique

```javascript
// Ces requêtes incluent automatiquement les global scopes
const posts = await Post.all();
// SQL: SELECT * FROM posts WHERE status = 'published' ORDER BY created_at DESC

const post = await Post.find(1);
// SQL: SELECT * FROM posts WHERE id = 1 AND status = 'published'

const userPosts = await Post.where('user_id', 1).get();
// SQL: SELECT * FROM posts WHERE user_id = 1 AND status = 'published' ORDER BY created_at DESC
```

### Désactiver les global scopes

```javascript
// Désactiver tous les global scopes
const allPosts = await Post.withoutGlobalScopes().get();
// SQL: SELECT * FROM posts

// Désactiver un scope spécifique (à implémenter selon vos besoins)
const drafts = await Post.where('status', 'draft').withoutGlobalScopes().get();
```

## Local Scopes

Les scopes locaux sont appliqués manuellement via la méthode `.scope()`.

### Définir des local scopes

```javascript
class User extends Model {
  static table = 'users';
  
  static scopes = {
    active: (query) => query.where('status', 'active'),
    verified: (query) => query.whereNotNull('email_verified_at'),
    admins: (query) => query.where('role', 'admin'),
    recent: (query) => query.where('created_at', '>', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    popular: (query) => query.where('followers_count', '>', 1000),
    withPosts: (query) => query.with('posts')
  };
}
```

### Utiliser les local scopes

```javascript
// Un seul scope
const activeUsers = await User.scope('active').get();
// SQL: SELECT * FROM users WHERE status = 'active'

// Plusieurs scopes
const activeAdmins = await User.scope('active', 'admins').get();
// SQL: SELECT * FROM users WHERE status = 'active' AND role = 'admin'

// Combiner avec d'autres méthodes
const recentVerified = await User
  .scope('recent', 'verified')
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();
```

## Scopes avec paramètres

### Via closures

```javascript
class Post extends Model {
  static table = 'posts';
  
  static scopes = {
    // Scope sans paramètre
    published: (query) => query.where('status', 'published'),
    
    // Scope qui utilise une variable externe
    byAuthor: (query, userId) => query.where('user_id', userId),
    
    // Scope avec plage de dates
    between: (query, start, end) => query.whereBetween('created_at', start, end)
  };

  // Méthode helper pour scopes paramétrés
  static byAuthor(userId) {
    return this.where('user_id', userId);
  }

  static recentDays(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return this.where('created_at', '>', date.toISOString());
  }
}
```

### Utilisation

```javascript
// Via méthode helper
const johnsPosts = await Post.byAuthor(1).get();
const weekPosts = await Post.recentDays(7).get();

// Chaînage
const johnsRecentPosts = await Post
  .byAuthor(1)
  .recentDays(30)
  .orderBy('created_at', 'desc')
  .get();
```

## Exemples pratiques

### Blog avec visibilité

```javascript
class Article extends Model {
  static table = 'articles';
  
  static globalScopes = {
    // Exclure les brouillons par défaut
    notDraft: (query) => query.where('status', '!=', 'draft')
  };
  
  static scopes = {
    published: (query) => query.where('status', 'published'),
    scheduled: (query) => query.where('status', 'scheduled'),
    featured: (query) => query.where('is_featured', true),
    category: (query, categoryId) => query.where('category_id', categoryId)
  };
  
  // Méthodes helpers
  static published() {
    return this.scope('published');
  }
  
  static inCategory(categoryId) {
    return this.where('category_id', categoryId);
  }
  
  static featured() {
    return this.scope('featured');
  }
}

// Utilisation
const featuredArticles = await Article.featured().limit(5).get();
const techArticles = await Article.inCategory(3).scope('published').get();
```

### E-commerce avec statuts de commande

```javascript
class Order extends Model {
  static table = 'orders';
  
  static scopes = {
    pending: (query) => query.where('status', 'pending'),
    processing: (query) => query.where('status', 'processing'),
    completed: (query) => query.where('status', 'completed'),
    cancelled: (query) => query.where('status', 'cancelled'),
    refunded: (query) => query.where('status', 'refunded'),
    
    // Groupements
    active: (query) => query.whereIn('status', ['pending', 'processing']),
    finished: (query) => query.whereIn('status', ['completed', 'cancelled', 'refunded']),
    
    // Par montant
    highValue: (query) => query.where('total', '>', 1000),
    
    // Par date
    today: (query) => {
      const today = new Date().toISOString().split('T')[0];
      return query.where('created_at', '>=', today);
    },
    thisMonth: (query) => {
      const firstDay = new Date();
      firstDay.setDate(1);
      return query.where('created_at', '>=', firstDay.toISOString().split('T')[0]);
    }
  };
}

// Dashboard
const pendingOrders = await Order.scope('pending').count();
const todayRevenue = await Order.scope('completed', 'today').sum('total');
const highValueThisMonth = await Order.scope('highValue', 'thisMonth', 'completed').get();
```

### Utilisateurs avec rôles

```javascript
class User extends Model {
  static table = 'users';
  
  static scopes = {
    // Par statut
    active: (query) => query.where('status', 'active'),
    inactive: (query) => query.where('status', 'inactive'),
    banned: (query) => query.where('status', 'banned'),
    
    // Par rôle
    admins: (query) => query.where('role', 'admin'),
    moderators: (query) => query.where('role', 'moderator'),
    users: (query) => query.where('role', 'user'),
    
    // Par vérification
    verified: (query) => query.whereNotNull('email_verified_at'),
    unverified: (query) => query.whereNull('email_verified_at'),
    
    // Par activité
    recentlyActive: (query) => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return query.where('last_login_at', '>', weekAgo.toISOString());
    },
    
    // Combinés
    activeAdmins: (query) => query.where('status', 'active').where('role', 'admin')
  };
}

// Rapports
const activeCount = await User.scope('active').count();
const unverifiedUsers = await User.scope('active', 'unverified').get();
const adminList = await User.scope('activeAdmins').orderBy('name').get();
```

## Soft Deletes et Scopes

Les soft deletes agissent comme un scope global automatique :

```javascript
class Post extends Model {
  static table = 'posts';
  static softDeletes = true;
  
  static scopes = {
    published: (query) => query.where('status', 'published')
  };
}

// Exclut automatiquement les supprimés
const posts = await Post.scope('published').get();

// Inclure les supprimés
const allPosts = await Post.withTrashed().scope('published').get();
```

## Bonnes pratiques

### 1. Nommez clairement vos scopes

```javascript
// ✅ Bon
static scopes = {
  active: (q) => q.where('status', 'active'),
  published: (q) => q.where('published', true),
  recent: (q) => q.orderBy('created_at', 'desc')
};

// ❌ Mauvais
static scopes = {
  s1: (q) => q.where('status', 'active'),
  doThing: (q) => q.where('published', true)
};
```

### 2. Un scope = une responsabilité

```javascript
// ✅ Bon - scopes atomiques
static scopes = {
  active: (q) => q.where('status', 'active'),
  verified: (q) => q.whereNotNull('verified_at')
};
// Usage: User.scope('active', 'verified')

// ❌ Mauvais - scope trop complexe
static scopes = {
  activeAndVerified: (q) => q.where('status', 'active').whereNotNull('verified_at')
};
```

### 3. Utilisez des méthodes pour les scopes paramétrés

```javascript
class Post extends Model {
  static byUser(userId) {
    return this.where('user_id', userId);
  }
  
  static inDateRange(start, end) {
    return this.whereBetween('created_at', start, end);
  }
}
```

## Prochaines étapes

- [Events](EVENTS.md) - Hooks sur le cycle de vie
- [Validation](VALIDATION.md) - Valider les données
- [Query Builder](QUERY_BUILDER.md) - Requêtes avancées

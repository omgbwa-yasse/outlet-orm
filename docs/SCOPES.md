# 🔭 Scopes

Scopes allow you to define reusable query constraints on your models.

> 📁 **Location**: Define your scopes in`models/`or`services/`— See [Project structure](INSTALLATION.md#structure-de-projet-recommended)
>
> 📘 **TypeScript**: Scopes are typed with`ScopeFunction`. See [TYPESCRIPT.md](TYPESCRIPT.md)

## Table of Contents

- [Types of Scopes](#types-of-scopes)
- [Global Scopes](#global-scopes)
  - [Define a global scope](#define-a-global-scope)
  - [Automatic use](#automatic-use)
  - [Disable global scopes](#disable-global-scopes)
- [Local Scopes](#local-scopes)
  - [Define local scopes](#define-local-scopes)
  - [Use local scopes](#use-local-scopes)
- [Scopes with parameters](#scopes-with-parameters)
  - [Via closures](#via-closures)
  - [Usage](#usage)
- [Practical examples](#practical-examples)
  - [Blog with visibility](#blog-with-visibility)
  - [E-commerce with order statuses](#e-commerce-with-order-statuses)
  - [Users with roles](#users-with-roles)
- [Soft Deletes et Scopes](#soft-deletes-et-scopes)
- [Best practices](#best-practices)
  - [1. Clearly name your scopes](#1-clearly-name-your-scopes)
  - [2. A scope = a responsibility](#2-a-scope-a-responsibility)
  - [3. Use methods for parameterised scopes](#3-use-methods-for-parameterised-scopes)
- [Next steps](#next-steps)

---

## Types of Scopes

| Type | Application | Usage |
|------|-------------|-------------|
| **Global Scopes** | Automatic on all queries | Always active |
| **Local Scopes** | Manuel via`.scope()`| On demand |

## Global Scopes

Global scopes automatically apply to every query on the model.

### Define a global scope

```javascript
const { Model } = require('outlet-orm');

class Post extends Model {
  static table = 'posts';
  
  // Global scopes - apply automatically
  static globalScopes = {
    published: (query) => query.where('status', 'published'),
    ordered: (query) => query.orderBy('created_at', 'desc')
  };
}
```

### Automatic use

```javascript
// These queries automatically include global scopes
const posts = await Post.all();
// SQL: SELECT * FROM posts WHERE status = 'published' ORDER BY created_at DESC

const post = await Post.find(1);
// SQL: SELECT * FROM posts WHERE id = 1 AND status = 'published'

const userPosts = await Post.where('user_id', 1).get();
// SQL: SELECT * FROM posts WHERE user_id = 1 AND status = 'published' ORDER BY created_at DESC
```

### Disable global scopes

```javascript
// Disable all global scopes
const allPosts = await Post.withoutGlobalScopes().get();
// SQL: SELECT * FROM posts

// Disable a specific scope (to be implemented according to your needs)
const drafts = await Post.where('status', 'draft').withoutGlobalScopes().get();
```

## Local Scopes

Local scopes are applied manually via the method`.scope()`.

### Define local scopes

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

### Use local scopes

```javascript
// A single scope
const activeUsers = await User.scope('active').get();
// SQL: SELECT * FROM users WHERE status = 'active'

// Multiple scopes
const activeAdmins = await User.scope('active', 'admins').get();
// SQL: SELECT * FROM users WHERE status = 'active' AND role = 'admin'

// Combine with other methods
const recentVerified = await User
  .scope('recent', 'verified')
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();
```

## Scopes with parameters

### Via closures

```javascript
class Post extends Model {
  static table = 'posts';
  
  static scopes = {
    // Scope without parameter
    published: (query) => query.where('status', 'published'),
    
    // Scope that uses an external variable
    byAuthor: (query, userId) => query.where('user_id', userId),
    
    // Scope with date range
    between: (query, start, end) => query.whereBetween('created_at', start, end)
  };

  // Helper method for parameterised scopes
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

### Usage

```javascript
// Via helper method
const johnsPosts = await Post.byAuthor(1).get();
const weekPosts = await Post.recentDays(7).get();

// Chaining
const johnsRecentPosts = await Post
  .byAuthor(1)
  .recentDays(30)
  .orderBy('created_at', 'desc')
  .get();
```

## Practical examples

### Blog with visibility

```javascript
class Article extends Model {
  static table = 'articles';
  
  static globalScopes = {
    // Exclude drafts by default
    notDraft: (query) => query.where('status', '!=', 'draft')
  };
  
  static scopes = {
    published: (query) => query.where('status', 'published'),
    scheduled: (query) => query.where('status', 'scheduled'),
    featured: (query) => query.where('is_featured', true),
    category: (query, categoryId) => query.where('category_id', categoryId)
  };
  
  // Helper methods
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

// Usage
const featuredArticles = await Article.featured().limit(5).get();
const techArticles = await Article.inCategory(3).scope('published').get();
```

### E-commerce with order statuses

```javascript
class Order extends Model {
  static table = 'orders';
  
  static scopes = {
    pending: (query) => query.where('status', 'pending'),
    processing: (query) => query.where('status', 'processing'),
    completed: (query) => query.where('status', 'completed'),
    cancelled: (query) => query.where('status', 'cancelled'),
    refunded: (query) => query.where('status', 'refunded'),
    
    // Groupings
    active: (query) => query.whereIn('status', ['pending', 'processing']),
    finished: (query) => query.whereIn('status', ['completed', 'cancelled', 'refunded']),
    
    // By amount
    highValue: (query) => query.where('total', '>', 1000),
    
    // By date
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

### Users with roles

```javascript
class User extends Model {
  static table = 'users';
  
  static scopes = {
    // By status
    active: (query) => query.where('status', 'active'),
    inactive: (query) => query.where('status', 'inactive'),
    banned: (query) => query.where('status', 'banned'),
    
    // By role
    admins: (query) => query.where('role', 'admin'),
    moderators: (query) => query.where('role', 'moderator'),
    users: (query) => query.where('role', 'user'),
    
    // By verification
    verified: (query) => query.whereNotNull('email_verified_at'),
    unverified: (query) => query.whereNull('email_verified_at'),
    
    // By activity
    recentlyActive: (query) => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return query.where('last_login_at', '>', weekAgo.toISOString());
    },
    
    // Combined
    activeAdmins: (query) => query.where('status', 'active').where('role', 'admin')
  };
}

// Reports
const activeCount = await User.scope('active').count();
const unverifiedUsers = await User.scope('active', 'unverified').get();
const adminList = await User.scope('activeAdmins').orderBy('name').get();
```

## Soft Deletes et Scopes

Soft deletes act as an automatic global scope:

```javascript
class Post extends Model {
  static table = 'posts';
  static softDeletes = true;
  
  static scopes = {
    published: (query) => query.where('status', 'published')
  };
}

// Automatically exclude deleted ones
const posts = await Post.scope('published').get();

// Include deleted
const allPosts = await Post.withTrashed().scope('published').get();
```

## Best practices

### 1. Clearly name your scopes

```javascript
// ✅ Bon
static scopes = {
  active: (q) => q.where('status', 'active'),
  published: (q) => q.where('published', true),
  recent: (q) => q.orderBy('created_at', 'desc')
};

// ❌ Bad
static scopes = {
  s1: (q) => q.where('status', 'active'),
  doThing: (q) => q.where('published', true)
};
```

### 2. A scope = a responsibility

```javascript
// ✅ Good - atomic scopes
static scopes = {
  active: (q) => q.where('status', 'active'),
  verified: (q) => q.whereNotNull('verified_at')
};
// Usage: User.scope('active', 'verified')

// ❌ Bad - scope too complex
static scopes = {
  activeAndVerified: (q) => q.where('status', 'active').whereNotNull('verified_at')
};
```

### 3. Use methods for parameterised scopes

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

## Next steps

- [Events](EVENTS.md) - Hooks on the life cycle
- [Validation](VALIDATION.md) - Validate data
- [Query Builder](QUERY_BUILDER.md) - Advanced queries

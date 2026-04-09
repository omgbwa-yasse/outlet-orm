# 🎯 Events (Hooks)

Events allow you to execute code at different stages of a model's lifecycle.

> 📁 **Location**: Define your events in`models/`or`services/`— See [Project structure](INSTALLATION.md#structure-de-projet-recommended)
>
> 📘 **TypeScript**: Use the type`ModelEventName`for event names. See [TYPESCRIPT.md](TYPESCRIPT.md)

## Table of Contents

- [Events available](#events-available)
- [Record events](#record-events)
  - [Via boot()](#via-boot)
  - [Via addEventListener (dynamic)](#via-addeventlistener-dynamic)
- [Observer Pattern (v6.5.0+)](#observer-pattern-v650)
- [Cancel an operation](#cancel-an-operation)
- [Use cases](#use-cases)
  - [Auto-generation of data](#auto-generation-of-data)
  - [Custom validation](#custom-validation)
  - [Audit et logging](#audit-et-logging)
  - [Cascade deletion](#cascade-deletion)
  - [Cache cleaning](#cache-cleaning)
  - [Notifications](#notifications)
  - [Soft Delete Events](#soft-delete-events)
- [Execution order](#execution-order)
  - [Creation (save on new model)](#creation-save-on-new-model)
  - [Update (save on existing model)](#update-save-on-existing-model)
  - [Suppression](#suppression)
  - [Restauration (soft delete)](#restauration-soft-delete)
- [Best practices](#best-practices)
  - [1. Keep events light](#1-keep-events-light)
  - [2. Use async with caution](#2-use-async-with-caution)
  - [3. Avoid infinite loops](#3-avoid-infinite-loops)
  - [4. Document your events](#4-document-your-events)
- [Next steps](#next-steps)

---

## Events available

| Event | Moment | Can cancel | TypeScript |
|-------|--------|--------------|------------------|
|`creating`| Before INSERT | ✅ Yes |`'creating'`|
|`created`| After INSERT | ❌ No |`'created'`|
|`updating`| Before UPDATE | ✅ Yes |`'updating'`|
|`updated`| After UPDATE | ❌ No |`'updated'`|
|`saving`| Before INSERT or UPDATE | ✅ Yes |`'saving'`|
|`saved`| After INSERT or UPDATE | ❌ No |`'saved'`|
|`deleting`| Before DELETE | ✅ Yes |`'deleting'`|
|`deleted`| After DELETE | ❌ No |`'deleted'`|
|`restoring`| Before restoration (soft delete) | ✅ Yes |`'restoring'`|
|`restored`| After restoration | ❌ No |`'restored'`|

## Record events

### Via boot()

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';

  static boot() {
    // Before creation
    this.creating((user) => {
      console.log('Creating user:', user.name);
      // Edit attributes
      user.slug = slugify(user.name);
    });

    // After creation
    this.created((user) => {
      console.log('User created with ID:', user.id);
      // Send welcome email, etc.
    });

    // Before update
    this.updating((user) => {
      console.log('Updating user:', user.id);
    });

    // After update
    this.updated((user) => {
      console.log('User updated:', user.id);
    });

    // Avant save (create ou update)
    this.saving((user) => {
      console.log('Saving user...');
    });

    // After save
    this.saved((user) => {
      console.log('User saved!');
    });

    // Avant suppression
    this.deleting((user) => {
      console.log('Deleting user:', user.id);
    });

    // After deletion
    this.deleted((user) => {
      console.log('User deleted');
    });
  }
}
```

### Via addEventListener (dynamic)

```javascript
// Add listeners dynamically
User.addEventListener('creating', (user) => {
  user.api_token = generateToken();
});

User.addEventListener('deleting', (user) => {
  console.log('About to delete user:', user.id);
});
```

## Observer Pattern (v6.5.0+)

Instead of registering individual event listeners, you can group all lifecycle hooks into a dedicated **Observer** class:

```javascript
class UserObserver {
  creating(user) {
    console.log('About to create user');
  }
  created(user) {
    console.log('User created:', user.id);
  }
  updating(user) { /* ... */ }
  updated(user)  { /* ... */ }
  saving(user)   { /* ... */ }
  saved(user)    { /* ... */ }
  deleting(user) { /* ... */ }
  deleted(user)  { /* ... */ }
  restoring(user){ /* ... */ }
  restored(user) { /* ... */ }
}

// Register from class (instantiated automatically)
User.observe(UserObserver);

// Or register from an existing instance
User.observe(new UserObserver());
```

Each method on the observer that matches a lifecycle event name will be registered automatically. Methods are optional — only define the ones you need.

## Cancel an operation

Return`false`in a "before" event to cancel the operation:

```javascript
class Post extends Model {
  static table = 'posts';

  static boot() {
    this.creating((post) => {
      // Check if user can create
      if (post.user_id === null) {
        console.log('Cannot create post without user');
        return false; // Cancel creation
      }
    });

    this.deleting((post) => {
      // Prevent pinned posts from being deleted
      if (post.is_pinned) {
        console.log('Cannot delete pinned post');
        return false; // Undo deletion
      }
    });

    this.updating((post) => {
      // Prevent editing of archived posts
      if (post.status === 'archived') {
        return false;
      }
    });
  }
}
```

## Use cases

### Auto-generation of data

```javascript
class Article extends Model {
  static table = 'articles';

  static boot() {
    this.creating((article) => {
      // Generate a slug
      const title = article.title;
      article.slug = title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      // Generate a UUID
      article.uuid = crypto.randomUUID();

      // Set current author
      if (!article.author_id) {
        article.author_id = getCurrentUserId();
      }
    });
  }
}
```

### Custom validation

```javascript
class User extends Model {
  static table = 'users';

  static boot() {
    this.saving((user) => {
      const email = user.email;
      
      // Validate the email format
      if (!email || !email.includes('@')) {
        throw new Error('Invalid email format');
      }

      // Normalize email
      user.email = email.toLowerCase().trim();
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
        model_id: order.id,
        data: JSON.stringify(order.toJSON()),
        user_id: getCurrentUserId(),
        created_at: new Date().toISOString()
      });
    });

    this.updated((order) => {
      AuditLog.create({
        action: 'order_updated',
        model: 'Order',
        model_id: order.id,
        data: JSON.stringify(order.getDirty()),
        user_id: getCurrentUserId(),
        created_at: new Date().toISOString()
      });
    });

    this.deleted((order) => {
      AuditLog.create({
        action: 'order_deleted',
        model: 'Order',
        model_id: order.id,
        user_id: getCurrentUserId(),
        created_at: new Date().toISOString()
      });
    });
  }
}
```

### Cascade deletion

```javascript
class User extends Model {
  static table = 'users';

  static boot() {
    this.deleting(async (user) => {
      const userId = user.id;
      
      // Remove relationships before user
      await Comment.where('user_id', userId).delete();
      await Post.where('user_id', userId).delete();
      await Profile.where('user_id', userId).delete();
    });
  }
}
```

### Cache cleaning

```javascript
class Product extends Model {
  static table = 'products';

  static boot() {
    const clearCache = (product) => {
      cache.delete(`product:${product.id}`);
      cache.delete('products:all');
      cache.delete(`category:${product.category_id}:products`);
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
      // Notify customer
      const user = await User.find(order.user_id);
      await sendEmail(user.email, 'order_confirmation', {
        order_id: order.id,
        total: order.total
      });
    });

    this.updated(async (order) => {
      if (order.status === 'shipped') {
        const user = await User.find(order.user_id);
        await sendEmail(user.email, 'order_shipped', {
          order_id: order.id,
          tracking: order.tracking_number
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
      console.log('Post moving to trash:', post.id);
    });

    this.deleted((post) => {
      console.log('Post in trash:', post.id);
    });

    this.restoring((post) => {
      console.log('Restoring post:', post.id);
    });

    this.restored((post) => {
      console.log('Post restored:', post.id);
      // Reindex for search
      searchIndex.add(post);
    });
  }
}
```

## Execution order

### Creation (save on new model)

1.`saving`- Before any backup
2.`creating`- Before INSERT
3. **INSERT A BASE**
4.`created`- After INSERT
5.`saved`- After any backup

### Update (save on existing model)

1.`saving`- Before any backup
2.`updating`- Avant UPDATE
3. **UPDATE on base**
4.`updated`- After UPDATE
5.`saved`- After any backup

### Suppression

1.`deleting`- Before DELETE
2. **DELETE in base** (or UPDATE deleted_at for soft delete)
3.`deleted`- After DELETE

### Restauration (soft delete)

1.`restoring`- Before restoration
2. **UPDATE deleted_at = NULL**
3.`restored`- After restoration

## Best practices

### 1. Keep events light

```javascript
// ✅ Good – Quick operation
this.creating((user) => {
  user.slug = slugify(user.name);
});

// ❌ Bad - Synchronous heavy operation
this.creating(async (user) => {
  await heavyComputation();
  await externalApiCall();
});
```

### 2. Use async with caution

```javascript
// For async operations, consider queues
this.created((user) => {
  // Add to a queue rather than wait
  queue.add('send-welcome-email', { userId: user.id });
});
```

### 3. Avoid infinite loops

```javascript
// ❌ Danger – Infinite loop!
this.updated((user) => {
  user.updated_count = user.updated_count + 1;
  user.save(); // Triggers 'updated' again!
});

// ✅ Solution – Use update direct
this.updated((user) => {
  User.where('id', user.id)
      .increment('updated_count'); // No events
});
```

### 4. Document your events

```javascript
class User extends Model {
  static boot() {
    // Event: Automatically generate a slug from the name
    this.creating((user) => {
      user.slug = slugify(user.name);
    });

    // Event: Sends a welcome email after registration
    this.created((user) => {
      emailQueue.add('welcome', { userId: user.id });
    });
  }
}
```

## Next steps

- [Validation](VALIDATION.md) - Validate data
- [Soft Deletes](SOFT_DELETES.md) - Soft deletion
- [Transactions](TRANSACTIONS.md) - Atomic operations

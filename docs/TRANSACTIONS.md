# 💾 Transactions

Les transactions garantissent l'intégrité des données en regroupant plusieurs opérations en une unité atomique.

> 📁 **Utilisation** : Dans vos fichiers `src/` ou services — Voir [Structure de projet](INSTALLATION.md#structure-de-projet-recommandée)

## Principe

Une transaction suit le modèle ACID :
- **Atomicité** : Toutes les opérations réussissent ou aucune
- **Cohérence** : La base reste dans un état valide
- **Isolation** : Les transactions sont indépendantes
- **Durabilité** : Les changements sont permanents après commit

## Utilisation basique

### Méthode transaction() (recommandée)

```javascript
const { Model } = require('outlet-orm');

// Obtenir la connexion via Model (connexion automatique depuis .env)
const db = Model.getConnection();

try {
  await db.transaction(async (trx) => {
    // Toutes les opérations utilisent la même transaction
    const user = await User.useTransaction(trx).create({
      name: 'John Doe',
      email: 'john@example.com'
    });

    await Profile.useTransaction(trx).create({
      user_id: user.getAttribute('id'),
      bio: 'Hello!'
    });

    await Account.useTransaction(trx).create({
      user_id: user.getAttribute('id'),
      balance: 0
    });

    // Commit automatique si tout réussit
  });

  console.log('Transaction réussie!');
} catch (error) {
  // Rollback automatique en cas d'erreur
  console.error('Transaction échouée:', error.message);
}
```

### Gestion manuelle

```javascript
const db = Model.getConnection();
const trx = await db.beginTransaction();

try {
  await User.useTransaction(trx).create({ name: 'John' });
  await Post.useTransaction(trx).create({ user_id: 1, title: 'Hello' });
  
  await db.commit(trx);
  console.log('Commit réussi');
} catch (error) {
  await db.rollback(trx);
  console.error('Rollback effectué:', error.message);
}
```

## Cas d'utilisation

### Transfert d'argent

```javascript
async function transfer(fromAccountId, toAccountId, amount) {
  const db = Model.getConnection();

  await db.transaction(async (trx) => {
    // Débiter le compte source
    const source = await Account.useTransaction(trx).find(fromAccountId);
    if (source.getAttribute('balance') < amount) {
      throw new Error('Solde insuffisant');
    }
    
    await Account.useTransaction(trx)
      .where('id', fromAccountId)
      .decrement('balance', amount);

    // Créditer le compte destination
    await Account.useTransaction(trx)
      .where('id', toAccountId)
      .increment('balance', amount);

    // Enregistrer la transaction
    await TransactionLog.useTransaction(trx).create({
      from_account: fromAccountId,
      to_account: toAccountId,
      amount: amount,
      type: 'transfer'
    });
  });

  return { success: true };
}
```

### Création d'utilisateur avec relations

```javascript
async function createUserWithProfile(userData, profileData) {
  const db = Model.getConnection();
  let createdUser;

  await db.transaction(async (trx) => {
    // Créer l'utilisateur
    createdUser = await User.useTransaction(trx).create({
      name: userData.name,
      email: userData.email,
      password: userData.password
    });

    const userId = createdUser.getAttribute('id');

    // Créer le profil
    await Profile.useTransaction(trx).create({
      user_id: userId,
      bio: profileData.bio,
      avatar: profileData.avatar
    });

    // Assigner le rôle par défaut
    await UserRole.useTransaction(trx).create({
      user_id: userId,
      role_id: 1 // Rôle "user" par défaut
    });

    // Créer les paramètres par défaut
    await UserSettings.useTransaction(trx).create({
      user_id: userId,
      notifications: true,
      theme: 'light'
    });
  });

  return createdUser;
}
```

### Suppression en cascade

```javascript
async function deleteUserCompletely(userId) {
  const db = Model.getConnection();

  await db.transaction(async (trx) => {
    // Supprimer dans l'ordre des dépendances
    await Comment.useTransaction(trx).where('user_id', userId).delete();
    await Post.useTransaction(trx).where('user_id', userId).delete();
    await Profile.useTransaction(trx).where('user_id', userId).delete();
    await UserRole.useTransaction(trx).where('user_id', userId).delete();
    await UserSettings.useTransaction(trx).where('user_id', userId).delete();
    
    // Enfin, supprimer l'utilisateur
    await User.useTransaction(trx).where('id', userId).delete();
  });
}
```

## API de transaction

### beginTransaction()

Démarre une nouvelle transaction.

```javascript
const trx = await db.beginTransaction();
```

### commit(trx)

Valide une transaction.

```javascript
await db.commit(trx);
```

### rollback(trx)

Annule une transaction.

```javascript
await db.rollback(trx);
```

### transaction(callback)

Exécute un callback dans une transaction avec commit/rollback automatique.

```javascript
await db.transaction(async (trx) => {
  // Opérations...
});
```

## Utiliser avec les modèles

### useTransaction(trx)

Associe une transaction à une requête de modèle.

```javascript
// Create
await User.useTransaction(trx).create({ name: 'John' });

// Find
const user = await User.useTransaction(trx).find(1);

// Update
await User.useTransaction(trx).where('id', 1).update({ name: 'Jane' });

// Delete
await User.useTransaction(trx).where('id', 1).delete();

// Query Builder
const users = await User.useTransaction(trx)
  .where('status', 'active')
  .orderBy('name')
  .get();
```

## Support par driver

| Driver | Support Transactions |
|--------|---------------------|
| MySQL (mysql2) | ✅ Complet |
| PostgreSQL (pg) | ✅ Complet |
| SQLite (sqlite3) | ✅ Complet |

## Bonnes pratiques

### 1. Gardez les transactions courtes

```javascript
// ✅ Bon - Transaction courte et ciblée
await db.transaction(async (trx) => {
  await Account.useTransaction(trx).where('id', 1).decrement('balance', 100);
  await Account.useTransaction(trx).where('id', 2).increment('balance', 100);
});

// ❌ Mauvais - Opérations non-DB dans la transaction
await db.transaction(async (trx) => {
  await Account.useTransaction(trx).where('id', 1).decrement('balance', 100);
  await sendEmail(user.email); // Ne pas faire ça!
  await Account.useTransaction(trx).where('id', 2).increment('balance', 100);
});
```

### 2. Gérez les erreurs proprement

```javascript
// ✅ Avec transaction() - gestion automatique
try {
  await db.transaction(async (trx) => {
    // ...
  });
} catch (error) {
  // Rollback déjà effectué
  logger.error('Transaction failed:', error);
  throw error;
}
```

### 3. Évitez les transactions imbriquées

```javascript
// ❌ Éviter
await db.transaction(async (trx1) => {
  await db.transaction(async (trx2) => {  // Problématique!
    // ...
  });
});

// ✅ Utiliser une seule transaction
await db.transaction(async (trx) => {
  await operation1(trx);
  await operation2(trx);
});
```

### 4. Passez la transaction aux fonctions

```javascript
// ✅ Bonne pratique
async function createOrder(orderData, trx) {
  return await Order.useTransaction(trx).create(orderData);
}

async function createOrderItems(items, orderId, trx) {
  for (const item of items) {
    await OrderItem.useTransaction(trx).create({
      order_id: orderId,
      ...item
    });
  }
}

// Utilisation
await db.transaction(async (trx) => {
  const order = await createOrder({ user_id: 1 }, trx);
  await createOrderItems(items, order.getAttribute('id'), trx);
});
```

## Debugging

### Activer les logs de requêtes

```javascript
const db = Model.getConnection();
db.enableQueryLog();

await db.transaction(async (trx) => {
  await User.useTransaction(trx).create({ name: 'Test' });
});

console.log(db.getQueryLog());
// Affiche: BEGIN, INSERT, COMMIT (ou ROLLBACK)
```

## Prochaines étapes

- [Soft Deletes](SOFT_DELETES.md) - Suppression douce
- [Events](EVENTS.md) - Hooks sur le cycle de vie
- [Query Logging](QUERY_LOGGING.md) - Debug des requêtes

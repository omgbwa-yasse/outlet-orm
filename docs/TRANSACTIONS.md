# 💾 Transactions

Transactions ensure data integrity by grouping multiple operations into an atomic unit.

> 📁 **Use**: In your files`controllers/`,`services/`or`src/`— See [Project structure](INSTALLATION.md#structure-de-projet-recommended)

## Table of Contents

- [Principle](#principle)
- [Basic use](#basic-use)
  - [transaction() method (recommended)](#transaction-method-recommended)
  - [Manual management](#manual-management)
- [Use cases](#use-cases)
  - [Money transfer](#money-transfer)
  - [User creation with relationships](#user-creation-with-relationships)
  - [Cascade deletion](#cascade-deletion)
- [Transaction API](#transaction-api)
  - [beginTransaction()](#begintransaction)
  - [commit(trx)](#committrx)
  - [rollback(trx)](#rollbacktrx)
  - [transaction(callback)](#transactioncallback)
- [Use with templates](#use-with-templates)
  - [useTransaction(trx)](#usetransactiontrx)
- [Support par driver](#support-par-driver)
- [Best practices](#best-practices)
  - [1. Keep trades short](#1-keep-trades-short)
  - [2. Handle errors properly](#2-handle-errors-properly)
  - [3. Avoid nested transactions](#3-avoid-nested-transactions)
  - [4. Pass transaction to functions](#4-pass-transaction-to-functions)
- [Debugging](#debugging)
  - [Enable query logs](#enable-query-logs)
- [Next steps](#next-steps)

---

## Principle

A transaction follows the ACID model:
- **Atomicity**: All operations succeed or none
- **Consistency**: The database remains in a valid state
- **Isolation**: Transactions are independent
- **Durability**: Changes are permanent after commit

## Basic use

### transaction() method (recommended)

```javascript
const { Model } = require('outlet-orm');

// Get connection via Model (automatic connection from .env)
const db = Model.getConnection();

try {
  await db.transaction(async (trx) => {
    // All operations use the same transaction
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

    // Automatic commit if everything succeeds
  });

  console.log('Transaction réussie!');
} catch (error) {
  // Automatic rollback in case of error
  console.error('Transaction échouée:', error.message);
}
```

### Manual management

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

## Use cases

### Money transfer

```javascript
async function transfer(fromAccountId, toAccountId, amount) {
  const db = Model.getConnection();

  await db.transaction(async (trx) => {
    // Debit the source account
    const source = await Account.useTransaction(trx).find(fromAccountId);
    if (source.getAttribute('balance') < amount) {
      throw new Error('Solde insuffisant');
    }
    
    await Account.useTransaction(trx)
      .where('id', fromAccountId)
      .decrement('balance', amount);

    // Credit the destination account
    await Account.useTransaction(trx)
      .where('id', toAccountId)
      .increment('balance', amount);

    // Save transaction
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

### User creation with relationships

```javascript
async function createUserWithProfile(userData, profileData) {
  const db = Model.getConnection();
  let createdUser;

  await db.transaction(async (trx) => {
    // Create user
    createdUser = await User.useTransaction(trx).create({
      name: userData.name,
      email: userData.email,
      password: userData.password
    });

    const userId = createdUser.getAttribute('id');

    // Create profile
    await Profile.useTransaction(trx).create({
      user_id: userId,
      bio: profileData.bio,
      avatar: profileData.avatar
    });

    // Assign the default role
    await UserRole.useTransaction(trx).create({
      user_id: userId,
      role_id: 1 // Default “user” role
    });

    // Create default settings
    await UserSettings.useTransaction(trx).create({
      user_id: userId,
      notifications: true,
      theme: 'light'
    });
  });

  return createdUser;
}
```

### Cascade deletion

```javascript
async function deleteUserCompletely(userId) {
  const db = Model.getConnection();

  await db.transaction(async (trx) => {
    // Delete in order of dependencies
    await Comment.useTransaction(trx).where('user_id', userId).delete();
    await Post.useTransaction(trx).where('user_id', userId).delete();
    await Profile.useTransaction(trx).where('user_id', userId).delete();
    await UserRole.useTransaction(trx).where('user_id', userId).delete();
    await UserSettings.useTransaction(trx).where('user_id', userId).delete();
    
    // Finally, delete the user
    await User.useTransaction(trx).where('id', userId).delete();
  });
}
```

## Transaction API

### beginTransaction()

Starts a new transaction.

```javascript
const trx = await db.beginTransaction();
```

### commit(trx)

Validates a transaction.

```javascript
await db.commit(trx);
```

### rollback(trx)

Cancels a transaction.

```javascript
await db.rollback(trx);
```

### transaction(callback)

Executes a callback in a transaction with automatic commit/rollback.

```javascript
await db.transaction(async (trx) => {
  // Operations...
});
```

## Use with templates

### useTransaction(trx)

Associates a transaction with a model query.

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

## Best practices

### 1. Keep trades short

```javascript
// ✅ Good - Short and focused transaction
await db.transaction(async (trx) => {
  await Account.useTransaction(trx).where('id', 1).decrement('balance', 100);
  await Account.useTransaction(trx).where('id', 2).increment('balance', 100);
});

// ❌ Bad - Non-DB operations in transaction
await db.transaction(async (trx) => {
  await Account.useTransaction(trx).where('id', 1).decrement('balance', 100);
  await sendEmail(user.email); // Don't do this!
  await Account.useTransaction(trx).where('id', 2).increment('balance', 100);
});
```

### 2. Handle errors properly

```javascript
// ✅ With transaction() - automatic management
try {
  await db.transaction(async (trx) => {
    // ...
  });
} catch (error) {
  // Rollback already done
  logger.error('Transaction failed:', error);
  throw error;
}
```

### 3. Avoid nested transactions

```javascript
// ❌ Avoid
await db.transaction(async (trx1) => {
  await db.transaction(async (trx2) => {  // Problematic!
    // ...
  });
});

// ✅ Use a single transaction
await db.transaction(async (trx) => {
  await operation1(trx);
  await operation2(trx);
});
```

### 4. Pass transaction to functions

```javascript
// ✅ Good practice
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

// Usage
await db.transaction(async (trx) => {
  const order = await createOrder({ user_id: 1 }, trx);
  await createOrderItems(items, order.getAttribute('id'), trx);
});
```

## Debugging

### Enable query logs

```javascript
const db = Model.getConnection();
db.enableQueryLog();

await db.transaction(async (trx) => {
  await User.useTransaction(trx).create({ name: 'Test' });
});

console.log(db.getQueryLog());
// Affiche: BEGIN, INSERT, COMMIT (ou ROLLBACK)
```

## Next steps

- [Soft Deletes](SOFT_DELETES.md) - Soft deletion
- [Events](EVENTS.md) - Hooks on the life cycle
- [Query Logging](QUERY_LOGGING.md) - Debug requests

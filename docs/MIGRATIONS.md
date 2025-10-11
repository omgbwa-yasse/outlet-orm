# Guide des Migrations - Outlet ORM

## 📚 Vue d'ensemble

Le système de migrations d'Outlet ORM est inspiré de Laravel et permet de gérer l'évolution de votre schéma de base de données de manière versionnée et collaborative.

## 🚀 Commandes CLI

### Créer une migration

```bash
outlet-migrate make create_users_table
outlet-migrate make add_email_to_users_table
outlet-migrate make alter_posts_table
```

### Exécuter les migrations

```bash
# Exécuter toutes les migrations en attente
outlet-migrate
# Puis choisir l'option 1

# Ou directement :
node bin/migrate.js
```

### Annuler des migrations

```bash
# Rollback du dernier batch
outlet-migrate
# Option 2: rollback

# Rollback de plusieurs batches
# Option 2, puis entrer le nombre de batches

# Reset (annuler toutes les migrations)
# Option 3: reset

# Refresh (reset + migrate)
# Option 4: refresh

# Fresh (drop all + migrate)
# Option 5: fresh
```

### Voir le statut

```bash
outlet-migrate
# Option 6: status
```

## 📝 Créer une Migration

### Migration de création de table

```javascript
/**
 * Migration: Create users table
 */

const Migration = require('../../lib/Migrations/Migration');

class CreateUsersTable extends Migration {
  async up() {
    const schema = this.getSchema();

    await schema.create('users', (table) => {
      table.id();
      table.string('name');
      table.string('email').unique();
      table.string('password');
      table.boolean('is_active').default(true);
      table.timestamps();
    });
  }

  async down() {
    const schema = this.getSchema();
    await schema.dropIfExists('users');
  }
}

module.exports = CreateUsersTable;
```

### Migration de modification de table

```javascript
const Migration = require('../../lib/Migrations/Migration');

class AddPhoneToUsersTable extends Migration {
  async up() {
    const schema = this.getSchema();

    await schema.table('users', (table) => {
      table.string('phone', 20).nullable().after('email');
      table.index('phone');
    });
  }

  async down() {
    const schema = this.getSchema();

    await schema.table('users', (table) => {
      table.dropColumn('phone');
    });
  }
}

module.exports = AddPhoneToUsersTable;
```

## 🔧 Types de Colonnes

### Types de base

```javascript
table.id();                          // BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY
table.string('name', 100);           // VARCHAR(100)
table.text('description');           // TEXT
table.integer('age');                // INT
table.bigInteger('views');           // BIGINT
table.boolean('is_active');          // TINYINT(1)
table.date('birth_date');            // DATE
table.datetime('published_at');      // DATETIME
table.timestamp('verified_at');      // TIMESTAMP
table.decimal('price', 8, 2);        // DECIMAL(8,2)
table.float('rating', 3, 1);         // FLOAT(3,1)
table.json('metadata');              // JSON
table.enum('status', ['active', 'inactive', 'pending']);  // ENUM
table.uuid('identifier');            // CHAR(36)
```

### Types spéciaux

```javascript
table.foreignId('user_id');          // BIGINT UNSIGNED (pour clés étrangères)
table.timestamps();                  // created_at, updated_at
table.softDeletes();                 // deleted_at (TIMESTAMP NULL)
```

## 🎨 Modificateurs de Colonnes

### Modificateurs de base

```javascript
table.string('email').nullable();                    // NULL
table.integer('count').default(0);                   // DEFAULT 0
table.string('email').unique();                      // UNIQUE
table.string('name').comment('User full name');      // COMMENT
table.integer('order').unsigned();                   // UNSIGNED
```

### Positionnement

```javascript
table.string('middle_name').after('first_name');     // Position après
table.string('id').first();                          // Position en premier
```

### Timestamps

```javascript
table.timestamp('created_at').useCurrent();                    // DEFAULT CURRENT_TIMESTAMP
table.timestamp('updated_at').useCurrent().useCurrentOnUpdate(); // ON UPDATE CURRENT_TIMESTAMP
```

## 🔗 Clés Étrangères

### Syntaxe de base

```javascript
await schema.create('posts', (table) => {
  table.id();
  table.foreignId('user_id');
  table.string('title');
  table.text('content');
  table.timestamps();

  // Clé étrangère explicite
  table.foreign('user_id')
    .references('id')
    .on('users')
    .onDelete('cascade')
    .onUpdate('cascade');
});
```

### Syntaxe simplifiée

```javascript
await schema.create('posts', (table) => {
  table.id();
  table.foreignId('user_id').constrained();  // Infère "users" depuis "user_id"
  table.string('title');
  table.timestamps();
});

// Ou avec table explicite
table.foreignId('author_id').constrained('users');
```

### Actions sur CASCADE

```javascript
// CASCADE sur DELETE et UPDATE
table.foreign('user_id')
  .references('id')
  .on('users')
  .cascadeOnDelete()
  .cascadeOnUpdate();

// Options disponibles: CASCADE, SET NULL, NO ACTION, RESTRICT
table.foreign('category_id')
  .references('id')
  .on('categories')
  .onDelete('SET NULL')
  .onUpdate('CASCADE');
```

### Supprimer une clé étrangère

```javascript
await schema.table('posts', (table) => {
  table.dropForeign(['user_id']);  // Supprime la FK sur user_id
});
```

## 📇 Index

### Créer des index

```javascript
await schema.create('users', (table) => {
  table.id();
  table.string('email');
  table.string('phone');
  table.string('first_name');
  table.string('last_name');

  // Index simple
  table.index('email');

  // Index composite
  table.index(['first_name', 'last_name']);

  // Index unique
  table.unique('email');

  // Index fulltext
  table.fullText('bio');
});
```

### Supprimer des index

```javascript
await schema.table('users', (table) => {
  table.dropIndex(['email']);
  table.dropIndex(['first_name', 'last_name']);
});
```

## 🛠️ Manipulation des Tables

### Créer une table

```javascript
await schema.create('users', (table) => {
  table.id();
  table.string('name');
  table.timestamps();
});
```

### Modifier une table existante

```javascript
await schema.table('users', (table) => {
  table.string('bio').nullable();
  table.index('email');
});
```

### Renommer une table

```javascript
await schema.rename('old_users', 'users');
```

### Supprimer une table

```javascript
await schema.drop('users');
await schema.dropIfExists('users');  // Ne plante pas si inexistante
```

### Vérifier l'existence

```javascript
const exists = await schema.hasTable('users');
const hasColumn = await schema.hasColumn('users', 'email');

if (!exists) {
  await schema.create('users', (table) => {
    table.id();
    table.string('name');
  });
}
```

## ✏️ Modification de Colonnes

### Renommer une colonne

```javascript
await schema.table('users', (table) => {
  table.renameColumn('name', 'full_name');
});
```

### Supprimer des colonnes

```javascript
await schema.table('users', (table) => {
  table.dropColumn('phone');
  
  // Supprimer plusieurs colonnes
  table.dropColumn(['bio', 'avatar']);
});
```

### Supprimer timestamps

```javascript
await schema.table('users', (table) => {
  table.dropTimestamps();  // Supprime created_at et updated_at
});
```

## 📋 Exemples Complets

### Migration complète avec relations

```javascript
const Migration = require('../../lib/Migrations/Migration');

class CreateBlogTables extends Migration {
  async up() {
    const schema = this.getSchema();

    // Table users
    await schema.create('users', (table) => {
      table.id();
      table.string('name', 100);
      table.string('email').unique();
      table.string('password');
      table.boolean('is_admin').default(false);
      table.timestamps();
      table.softDeletes();
      
      table.index('email');
    });

    // Table categories
    await schema.create('categories', (table) => {
      table.id();
      table.string('name', 50).unique();
      table.string('slug', 50).unique();
      table.text('description').nullable();
      table.foreignId('parent_id').nullable();
      table.timestamps();

      table.foreign('parent_id')
        .references('id')
        .on('categories')
        .onDelete('CASCADE');
    });

    // Table posts
    await schema.create('posts', (table) => {
      table.id();
      table.foreignId('user_id').constrained().cascadeOnDelete();
      table.foreignId('category_id').constrained().cascadeOnDelete();
      table.string('title');
      table.string('slug').unique();
      table.text('excerpt').nullable();
      table.text('content');
      table.enum('status', ['draft', 'published', 'archived']).default('draft');
      table.integer('views').default(0).unsigned();
      table.timestamp('published_at').nullable();
      table.timestamps();
      table.softDeletes();

      table.index(['user_id', 'status']);
      table.index('published_at');
      table.fullText('content');
    });

    // Table comments
    await schema.create('comments', (table) => {
      table.id();
      table.foreignId('post_id').constrained().cascadeOnDelete();
      table.foreignId('user_id').constrained().cascadeOnDelete();
      table.foreignId('parent_id').nullable();
      table.text('content');
      table.boolean('is_approved').default(false);
      table.timestamps();

      table.foreign('parent_id')
        .references('id')
        .on('comments')
        .onDelete('CASCADE');
    });

    // Table tags
    await schema.create('tags', (table) => {
      table.id();
      table.string('name', 50).unique();
      table.string('slug', 50).unique();
      table.timestamps();
    });

    // Table pivot post_tag
    await schema.create('post_tag', (table) => {
      table.id();
      table.foreignId('post_id').constrained().cascadeOnDelete();
      table.foreignId('tag_id').constrained().cascadeOnDelete();
      table.timestamps();

      table.unique(['post_id', 'tag_id']);
    });
  }

  async down() {
    const schema = this.getSchema();
    
    // Supprimer dans l'ordre inverse (à cause des FK)
    await schema.dropIfExists('post_tag');
    await schema.dropIfExists('tags');
    await schema.dropIfExists('comments');
    await schema.dropIfExists('posts');
    await schema.dropIfExists('categories');
    await schema.dropIfExists('users');
  }
}

module.exports = CreateBlogTables;
```

### Migration avec SQL personnalisé

```javascript
const Migration = require('../../lib/Migrations/Migration');

class AddFulltextSearch extends Migration {
  async up() {
    // Utiliser du SQL brut pour des fonctionnalités avancées
    await this.execute(`
      ALTER TABLE posts 
      ADD FULLTEXT INDEX posts_search_idx (title, content)
    `);

    await this.execute(`
      CREATE VIEW active_posts AS
      SELECT * FROM posts 
      WHERE status = 'published' 
      AND deleted_at IS NULL
    `);
  }

  async down() {
    await this.execute('DROP VIEW IF EXISTS active_posts');
    await this.execute('ALTER TABLE posts DROP INDEX posts_search_idx');
  }
}

module.exports = AddFulltextSearch;
```

## 🎯 Bonnes Pratiques

### 1. Nommage des migrations

```
✅ Bon:
20231011_120000_create_users_table.js
20231011_120100_add_email_to_users_table.js
20231011_120200_create_posts_table.js

❌ Mauvais:
migration1.js
users.js
my_migration.js
```

### 2. Toujours implémenter `down()`

```javascript
// ✅ Bon - Migration réversible
async down() {
  const schema = this.getSchema();
  await schema.dropIfExists('users');
}

// ❌ Mauvais - Migration non réversible
async down() {
  // Vide ou throw Error
}
```

### 3. Ordre des suppressions (FK)

```javascript
async down() {
  const schema = this.getSchema();
  
  // Supprimer d'abord les tables avec FK
  await schema.dropIfExists('posts');        // A une FK vers users
  await schema.dropIfExists('users');        // Table parente
}
```

### 4. Utiliser des transactions

Les migrations s'exécutent déjà dans des transactions automatiquement (selon le driver), mais pour du SQL complexe :

```javascript
async up() {
  await this.connection.execute('START TRANSACTION');
  
  try {
    await this.execute('ALTER TABLE...');
    await this.execute('UPDATE...');
    await this.connection.execute('COMMIT');
  } catch (error) {
    await this.connection.execute('ROLLBACK');
    throw error;
  }
}
```

### 5. Migrations atomiques

Une migration = une tâche. Si vous devez créer plusieurs tables, réfléchissez si elles doivent être dans la même migration ou séparées.

```javascript
// ✅ Bon - Tables liées ensemble
create_blog_tables.js  // users, posts, comments

// ✅ Bon - Fonctionnalité indépendante
create_analytics_tables.js  // analytics, events
```

## 📊 Workflow de Développement

### Développement local

```bash
# 1. Créer une migration
outlet-migrate make create_products_table

# 2. Éditer le fichier généré
# database/migrations/20231011_120000_create_products_table.js

# 3. Exécuter la migration
outlet-migrate
# Option 1: migrate

# 4. Vérifier le statut
outlet-migrate
# Option 6: status

# 5. Si erreur, rollback et corriger
outlet-migrate
# Option 2: rollback
```

### Collaboration en équipe

```bash
# Développeur A crée une migration
git add database/migrations/20231011_120000_create_users_table.js
git commit -m "Add users migration"
git push

# Développeur B récupère les changements
git pull
outlet-migrate  # Exécute les nouvelles migrations
```

### Production

```bash
# Sauvegarder la base avant migration
mysqldump -u root -p mydb > backup.sql

# Exécuter les migrations
outlet-migrate
# Option 1: migrate

# Vérifier le statut
outlet-migrate
# Option 6: status

# En cas de problème, rollback
outlet-migrate
# Option 2: rollback
```

## 🚨 Résolution de Problèmes

### Migration échoue

```bash
# Voir l'erreur détaillée
outlet-migrate
# L'erreur s'affiche avec la stack trace

# Rollback de la migration problématique
outlet-migrate
# Option 2: rollback

# Corriger le fichier de migration
# Relancer
outlet-migrate
# Option 1: migrate
```

### Reset complet en développement

```bash
outlet-migrate
# Option 5: fresh
# ⚠️ ATTENTION: Supprime TOUTES les données !
```

### Migration table désynchronisée

```javascript
// Si la table migrations est corrompue
const { DatabaseConnection } = require('outlet-orm');
const db = new DatabaseConnection(config);
await db.connect();

// Supprimer et recréer
await db.execute('DROP TABLE migrations');

// Relancer
outlet-migrate
```

## 📦 Intégration CI/CD

### Script NPM

```json
{
  "scripts": {
    "migrate": "node bin/migrate.js",
    "migrate:rollback": "echo '2\n1\n' | node bin/migrate.js",
    "migrate:fresh": "echo '5\nyes\n' | node bin/migrate.js",
    "migrate:status": "echo '6\n' | node bin/migrate.js"
  }
}
```

### GitHub Actions

```yaml
name: Run Migrations

on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run migrate
        env:
          DB_HOST: ${{ secrets.DB_HOST }}
          DB_USER: ${{ secrets.DB_USER }}
          DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
```

## 🎓 Résumé

Le système de migrations Outlet ORM offre :

- ✅ **Versioning** du schéma de base de données
- ✅ **Migrations réversibles** avec `up()` et `down()`
- ✅ **API fluide** inspirée de Laravel
- ✅ **Support multi-base** (MySQL, PostgreSQL, SQLite)
- ✅ **Gestion des relations** (clés étrangères, CASCADE)
- ✅ **Batch tracking** pour rollback précis
- ✅ **CLI interactif** pour toutes les opérations
- ✅ **SQL personnalisé** quand nécessaire

Utilisez les migrations pour toute modification de votre base de données en production ! 🚀

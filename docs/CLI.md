# 🛠️ CLI (Command Line Interface)

Outlet ORM inclut des outils CLI pour la gestion des migrations et l'initialisation de projets.

## Installation

Les commandes CLI sont disponibles via `npx` :

```bash
npx outlet-orm <command>
```

Ou ajoutez des scripts dans votre `package.json` :

```json
{
  "scripts": {
    "migrate": "node node_modules/outlet-orm/bin/migrate.js",
    "migrate:make": "node node_modules/outlet-orm/bin/migrate.js make",
    "db:init": "node node_modules/outlet-orm/bin/init.js"
  }
}
```

## Commandes disponibles

### init

Initialise la structure de base d'un projet Outlet ORM.

```bash
node node_modules/outlet-orm/bin/init.js
```

Crée :
- `database/config.js` - Configuration de la base de données
- `database/migrations/` - Dossier des migrations
- `models/` - Dossier des modèles

### migrate

Gère les migrations de base de données.

```bash
# Lancer toutes les migrations pending
node node_modules/outlet-orm/bin/migrate.js

# Créer une nouvelle migration
node node_modules/outlet-orm/bin/migrate.js make create_users_table

# Rollback de la dernière migration
node node_modules/outlet-orm/bin/migrate.js rollback

# Reset toutes les migrations
node node_modules/outlet-orm/bin/migrate.js reset

# Status des migrations
node node_modules/outlet-orm/bin/migrate.js status
```

### convert

Convertit un fichier SQL en migration JavaScript.

```bash
node node_modules/outlet-orm/bin/convert.js schema.sql
```

## Migrations

### Créer une migration

```bash
node bin/migrate.js make create_posts_table
```

Génère un fichier comme `20240115_143022_create_posts_table.js` :

```javascript
module.exports = {
  up: async (schema) => {
    await schema.createTable('posts', (table) => {
      table.id();
      table.string('title');
      table.text('content');
      table.integer('user_id').unsigned();
      table.timestamps();
    });
  },

  down: async (schema) => {
    await schema.dropTable('posts');
  }
};
```

### Structure d'une migration

```javascript
module.exports = {
  // Exécuté lors de migrate up
  up: async (schema) => {
    // Créer table
    await schema.createTable('table_name', (table) => {
      // Définitions de colonnes
    });
    
    // Modifier table
    await schema.alterTable('existing_table', (table) => {
      table.addColumn('new_column', 'VARCHAR(255)');
    });
    
    // Exécuter SQL brut
    await schema.raw('CREATE INDEX idx_name ON table_name(column)');
  },

  // Exécuté lors de rollback
  down: async (schema) => {
    await schema.dropTable('table_name');
    
    await schema.alterTable('existing_table', (table) => {
      table.dropColumn('new_column');
    });
  }
};
```

### Types de colonnes

```javascript
await schema.createTable('users', (table) => {
  // ID auto-incrémenté
  table.id();                            // BIGINT PRIMARY KEY AUTO_INCREMENT
  table.id('custom_id');                 // Avec nom personnalisé
  
  // Chaînes
  table.string('name');                  // VARCHAR(255)
  table.string('code', 50);              // VARCHAR(50)
  table.text('description');             // TEXT
  table.longText('content');             // LONGTEXT
  
  // Nombres
  table.integer('age');                  // INT
  table.bigInteger('views');             // BIGINT
  table.tinyInteger('status');           // TINYINT
  table.decimal('price', 8, 2);          // DECIMAL(8,2)
  table.float('rating');                 // FLOAT
  
  // Booléen
  table.boolean('is_active');            // TINYINT(1)
  
  // Date/Time
  table.date('birthday');                // DATE
  table.dateTime('published_at');        // DATETIME
  table.timestamp('verified_at');        // TIMESTAMP
  table.time('start_time');              // TIME
  
  // Binaire
  table.binary('data');                  // BLOB
  
  // JSON
  table.json('settings');                // JSON
  
  // Enum
  table.enum('status', ['draft', 'published', 'archived']);
  
  // UUID
  table.uuid('uuid');                    // CHAR(36)
  
  // Timestamps automatiques
  table.timestamps();                    // created_at, updated_at
  
  // Soft deletes
  table.softDeletes();                   // deleted_at TIMESTAMP NULL
});
```

### Modificateurs de colonnes

```javascript
table.string('email')
  .nullable()                  // Peut être NULL
  .default('default@email.com') // Valeur par défaut
  .unique()                    // Contrainte unique
  .index();                    // Index simple

table.integer('user_id')
  .unsigned()                  // Non signé
  .references('id').on('users'); // Clé étrangère
```

### Index et contraintes

```javascript
await schema.createTable('posts', (table) => {
  table.id();
  table.string('title');
  table.integer('user_id').unsigned();
  table.integer('category_id').unsigned();
  
  // Index simple
  table.index('title');
  
  // Index composé
  table.index(['user_id', 'category_id']);
  
  // Index unique
  table.unique('slug');
  
  // Clé étrangère
  table.foreign('user_id').references('id').on('users').onDelete('CASCADE');
  table.foreign('category_id').references('id').on('categories').onDelete('SET NULL');
});
```

### Modifier une table existante

```javascript
module.exports = {
  up: async (schema) => {
    await schema.alterTable('users', (table) => {
      // Ajouter colonnes
      table.addColumn('phone', 'VARCHAR(20)');
      table.addColumn('avatar', 'VARCHAR(255)').nullable();
      
      // Modifier colonne (MySQL)
      table.modifyColumn('name', 'VARCHAR(500)');
      
      // Ajouter index
      table.addIndex('phone');
      
      // Ajouter clé étrangère
      table.addForeign('department_id', 'departments', 'id');
    });
  },

  down: async (schema) => {
    await schema.alterTable('users', (table) => {
      table.dropColumn('phone');
      table.dropColumn('avatar');
      table.dropIndex('phone');
      table.dropForeign('department_id');
    });
  }
};
```

## Configuration de la base

### database/config.js

```javascript
module.exports = {
  development: {
    driver: 'mysql',
    host: 'localhost',
    port: 3306,
    database: 'myapp_dev',
    user: 'root',
    password: ''
  },
  
  test: {
    driver: 'sqlite',
    filename: ':memory:'
  },
  
  production: {
    driver: 'pg',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: true
  }
};
```

### Utiliser une config spécifique

```bash
NODE_ENV=production node bin/migrate.js
```

## Conversion SQL

### Convertir un fichier SQL

```bash
node bin/convert.js schema.sql
```

Convertit :

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

En :

```javascript
module.exports = {
  up: async (schema) => {
    await schema.createTable('users', (table) => {
      table.id();
      table.string('name').notNullable();
      table.string('email').unique();
      table.timestamp('created_at').default('CURRENT_TIMESTAMP');
    });
  },

  down: async (schema) => {
    await schema.dropTable('users');
  }
};
```

## Exemples complets

### Migration de blog

```javascript
// 20240115_100000_create_blog_tables.js
module.exports = {
  up: async (schema) => {
    // Users
    await schema.createTable('users', (table) => {
      table.id();
      table.string('name');
      table.string('email').unique();
      table.string('password');
      table.string('role').default('user');
      table.timestamp('email_verified_at').nullable();
      table.timestamps();
      table.softDeletes();
    });

    // Categories
    await schema.createTable('categories', (table) => {
      table.id();
      table.string('name');
      table.string('slug').unique();
      table.text('description').nullable();
      table.timestamps();
    });

    // Posts
    await schema.createTable('posts', (table) => {
      table.id();
      table.string('title');
      table.string('slug').unique();
      table.text('excerpt').nullable();
      table.longText('content');
      table.integer('user_id').unsigned();
      table.integer('category_id').unsigned().nullable();
      table.enum('status', ['draft', 'published', 'archived']).default('draft');
      table.timestamp('published_at').nullable();
      table.timestamps();
      table.softDeletes();
      
      table.foreign('user_id').references('id').on('users').onDelete('CASCADE');
      table.foreign('category_id').references('id').on('categories').onDelete('SET NULL');
    });

    // Comments
    await schema.createTable('comments', (table) => {
      table.id();
      table.text('body');
      table.integer('post_id').unsigned();
      table.integer('user_id').unsigned();
      table.integer('parent_id').unsigned().nullable();
      table.timestamps();
      table.softDeletes();
      
      table.foreign('post_id').references('id').on('posts').onDelete('CASCADE');
      table.foreign('user_id').references('id').on('users').onDelete('CASCADE');
    });

    // Tags
    await schema.createTable('tags', (table) => {
      table.id();
      table.string('name');
      table.string('slug').unique();
      table.timestamps();
    });

    // Post-Tag pivot
    await schema.createTable('post_tag', (table) => {
      table.integer('post_id').unsigned();
      table.integer('tag_id').unsigned();
      
      table.primary(['post_id', 'tag_id']);
      table.foreign('post_id').references('id').on('posts').onDelete('CASCADE');
      table.foreign('tag_id').references('id').on('tags').onDelete('CASCADE');
    });
  },

  down: async (schema) => {
    await schema.dropTable('post_tag');
    await schema.dropTable('tags');
    await schema.dropTable('comments');
    await schema.dropTable('posts');
    await schema.dropTable('categories');
    await schema.dropTable('users');
  }
};
```

## Prochaines étapes

- [Installation](INSTALLATION.md) - Configuration initiale
- [Migrations](MIGRATIONS.md) - Guide détaillé des migrations
- [Models](MODELS.md) - Créer vos modèles

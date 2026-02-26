# 🛠️ CLI (Command Line Interface)

Outlet ORM includes CLI tools for managing migrations and initializing projects.

> 📁 **Generates**:`database/config.js`et`database/migrations/`— See [Project structure](INSTALLATION.md#structure-de-projet-recommandée)

## Installation

CLI commands are available through`npx`:

```bash
npx outlet-orm <command>
```

Or add scripts in your`package.json`:

```json
{
  "scripts": {
    "migrate": "node node_modules/outlet-orm/bin/migrate.js",
    "migrate:make": "node node_modules/outlet-orm/bin/migrate.js make",
    "db:init": "node node_modules/outlet-orm/bin/init.js"
  }
}
```

## Commands available

### init

Initializes the basic structure of an Outlet ORM project.

```bash
node node_modules/outlet-orm/bin/init.js
```

Creates:
-`config/`- Centralised configuration (app, database, security)
-`database/config.js`- Configuration of migrations
-`database/migrations/`- Migration file
-`models/`- Models folder
-`controllers/`- Controllers file
-`routes/`- Routes folder
-`middlewares/`- Middlewares folder (auth, validation, errorHandler)
-`services/`- Services file
-`utils/`- Utilities (hash, token)
-`validators/`- Validation schemes
-`public/`- Public static files (images, css, js)
-`logs/`- Application logs
-`.env.example`- Template configuration
-`.gitignore`- Files to ignore

### migrate

Manages database migrations.

```bash
# Launch all pending migrations
node node_modules/outlet-orm/bin/migrate.js

# Create a new migration
node node_modules/outlet-orm/bin/migrate.js make create_users_table

# Rollback of the last migration
node node_modules/outlet-orm/bin/migrate.js rollback

# Reset all migrations
node node_modules/outlet-orm/bin/migrate.js reset

# Migration status
node node_modules/outlet-orm/bin/migrate.js status
```

### convert

Converts a SQL file to JavaScript migration.

```bash
node node_modules/outlet-orm/bin/convert.js schema.sql
```

## Migrations

### Create a migration

```bash
node bin/migrate.js make create_posts_table
```

Generates a file like`20240115_143022_create_posts_table.js`:

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

### Structure of a migration

```javascript
module.exports = {
  // Executed during migrate up
  up: async (schema) => {
    // Create table
    await schema.createTable('table_name', (table) => {
      // Column definitions
    });
    
    // Modifier table
    await schema.alterTable('existing_table', (table) => {
      table.addColumn('new_column', 'VARCHAR(255)');
    });
    
    // Execute raw SQL
    await schema.raw('CREATE INDEX idx_name ON table_name(column)');
  },

  // Executed during rollback
  down: async (schema) => {
    await schema.dropTable('table_name');
    
    await schema.alterTable('existing_table', (table) => {
      table.dropColumn('new_column');
    });
  }
};
```

### Column types

```javascript
await schema.createTable('users', (table) => {
  // Auto-incremented ID
  table.id();                            // BIGINT PRIMARY KEY AUTO_INCREMENT
  table.id('custom_id');                 // With personalized name
  
  // Chains
  table.string('name');                  // VARCHAR(255)
  table.string('code', 50);              // VARCHAR(50)
  table.text('description');             // TEXT
  table.longText('content');             // LONGTEXT
  
  // Names
  table.integer('age');                  // INT
  table.bigInteger('views');             // BIGINT
  table.tinyInteger('status');           // TINYINT
  table.decimal('price', 8, 2);          // DECIMAL(8,2)
  table.float('rating');                 // FLOAT
  
  // Boolean
  table.boolean('is_active');            // TINYINT(1)
  
  // Date/Time
  table.date('birthday');                // DATE
  table.dateTime('published_at');        // DATETIME
  table.timestamp('verified_at');        // TIMESTAMP
  table.time('start_time');              // TIME
  
  // Binary
  table.binary('data');                  // BLOB
  
  // JSON
  table.json('settings');                // JSON
  
  // Enum
  table.enum('status', ['draft', 'published', 'archived']);
  
  // UUID
  table.uuid('uuid');                    // CHAR(36)
  
  // Automatic timestamps
  table.timestamps();                    // created_at, updated_at
  
  // Soft deletes
  table.softDeletes();                   // deleted_at TIMESTAMP NULL
});
```

### Column modifiers

```javascript
table.string('email')
  .nullable()                  // May be NULL
  .default('default@email.com') // Default value
  .unique()                    // Single constraint
  .index();                    // Index simple

table.integer('user_id')
  .unsigned()                  // Unsigned
  .references('id').on('users'); // Foreign key
```

### Indexes and constraints

```javascript
await schema.createTable('posts', (table) => {
  table.id();
  table.string('title');
  table.integer('user_id').unsigned();
  table.integer('category_id').unsigned();
  
  // Index simple
  table.index('title');
  
  // Compound index
  table.index(['user_id', 'category_id']);
  
  // Index unique
  table.unique('slug');
  
  // Foreign key
  table.foreign('user_id').references('id').on('users').onDelete('CASCADE');
  table.foreign('category_id').references('id').on('categories').onDelete('SET NULL');
});
```

### Edit an existing table

```javascript
module.exports = {
  up: async (schema) => {
    await schema.alterTable('users', (table) => {
      // Add columns
      table.addColumn('phone', 'VARCHAR(20)');
      table.addColumn('avatar', 'VARCHAR(255)').nullable();
      
      // Modifier colonne (MySQL)
      table.modifyColumn('name', 'VARCHAR(500)');
      
      // Add index
      table.addIndex('phone');
      
      // Add foreign key
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

## Basic configuration

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

### Use a specific config

```bash
NODE_ENV=production node bin/migrate.js
```

## Conversion SQL

### Convert SQL file

```bash
node bin/convert.js schema.sql
```

Converted:

```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

In :

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

## Complete examples

### Blog migration

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

## Next steps

- [Installation](INSTALLATION.md) - Initial configuration
- [Migrations](MIGRATIONS.md) - Detailed migration guide
- [Models](MODELS.md) - Create your models

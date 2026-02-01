/**
 * Outlet ORM - TypeScript Migration Example
 *
 * This example demonstrates how to write fully typed migrations
 * using the SchemaBuilder and TableBuilder interfaces.
 */

import { SchemaBuilder, MigrationInterface, ForeignKeyAction } from 'outlet-orm';

/**
 * Migration: Create users table
 *
 * Fully typed migration with autocomplete support for all table builder methods
 */
const createUsersTable: MigrationInterface = {
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.createTable('users', (table) => {
      // Primary key
      table.id();

      // String columns with length
      table.string('name', 100);
      table.string('email', 255).unique();
      table.string('password', 255);

      // Nullable columns
      table.integer('age').nullable();
      table.string('phone', 20).nullable();

      // Enum column
      table.enum('role', ['admin', 'user', 'moderator']).default('user');

      // Boolean with default
      table.boolean('is_active').default(true);

      // Timestamps (created_at, updated_at)
      table.timestamps();

      // Soft deletes (deleted_at)
      table.softDeletes();

      // Indexes
      table.index(['email']);
      table.index(['role', 'is_active']);
    });
  },

  async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropTableIfExists('users');
  }
};

/**
 * Migration: Create posts table with foreign key
 */
const createPostsTable: MigrationInterface = {
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.createTable('posts', (table) => {
      table.id();

      table.string('title', 255);
      table.text('content');
      table.string('slug', 255).unique();

      // Foreign key with type-safe actions
      table.integer('user_id').unsigned();
      table.foreign('user_id')
        .references('id')
        .on('users')
        .onDelete('CASCADE')
        .onUpdate('CASCADE');

      // JSON column for metadata
      table.json('metadata').nullable();

      // Publish status
      table.boolean('published').default(false);
      table.timestamp('published_at').nullable();

      table.timestamps();
      table.softDeletes();

      // Composite index
      table.index(['user_id', 'published']);
    });
  },

  async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropTableIfExists('posts');
  }
};

/**
 * Migration: Create profiles table (one-to-one with users)
 */
const createProfilesTable: MigrationInterface = {
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.createTable('profiles', (table) => {
      table.id();

      // One-to-one foreign key (unique)
      table.integer('user_id').unsigned().unique();
      table.foreign('user_id')
        .references('id')
        .on('users')
        .onDelete('CASCADE');

      // Profile fields
      table.text('bio').nullable();
      table.string('avatar', 500).nullable();
      table.string('website', 255).nullable();
      table.date('birthday').nullable();

      // Social links as JSON
      table.json('social_links').nullable();

      table.timestamps();
    });
  },

  async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropTableIfExists('profiles');
  }
};

/**
 * Migration: Create tags and post_tags pivot table (many-to-many)
 */
const createTagsTable: MigrationInterface = {
  async up(schema: SchemaBuilder): Promise<void> {
    // Tags table
    await schema.createTable('tags', (table) => {
      table.id();
      table.string('name', 50).unique();
      table.string('slug', 50).unique();
      table.string('color', 7).default('#000000'); // hex color
      table.timestamps();
    });

    // Pivot table
    await schema.createTable('post_tags', (table) => {
      table.integer('post_id').unsigned();
      table.integer('tag_id').unsigned();

      // Composite primary key
      table.primary(['post_id', 'tag_id']);

      // Foreign keys
      table.foreign('post_id')
        .references('id')
        .on('posts')
        .onDelete('CASCADE');

      table.foreign('tag_id')
        .references('id')
        .on('tags')
        .onDelete('CASCADE');

      table.timestamp('created_at').nullable();
    });
  },

  async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropTableIfExists('post_tags');
    await schema.dropTableIfExists('tags');
  }
};

/**
 * Migration: Modify existing table
 */
const addPhoneToUsersTable: MigrationInterface = {
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.table('users', (table) => {
      // Add new column
      table.string('phone', 20).nullable();

      // Add index on phone
      table.index(['phone']);
    });
  },

  async down(schema: SchemaBuilder): Promise<void> {
    await schema.table('users', (table) => {
      table.dropIndex('users_phone_index');
      table.dropColumn('phone');
    });
  }
};

/**
 * Migration: Create comments table (polymorphic)
 */
const createCommentsTable: MigrationInterface = {
  async up(schema: SchemaBuilder): Promise<void> {
    await schema.createTable('comments', (table) => {
      table.id();

      table.text('body');
      table.integer('user_id').unsigned();

      // Polymorphic columns
      table.string('commentable_type', 100); // 'posts', 'videos', etc.
      table.integer('commentable_id').unsigned();

      // Parent comment for nested comments
      table.integer('parent_id').unsigned().nullable();

      table.timestamps();
      table.softDeletes();

      // Indexes
      table.foreign('user_id').references('id').on('users').onDelete('CASCADE');
      table.index(['commentable_type', 'commentable_id']);
      table.index(['parent_id']);
    });
  },

  async down(schema: SchemaBuilder): Promise<void> {
    await schema.dropTableIfExists('comments');
  }
};

// ==================== Export Migrations ====================

export {
  createUsersTable,
  createPostsTable,
  createProfilesTable,
  createTagsTable,
  addPhoneToUsersTable,
  createCommentsTable
};

// ==================== CommonJS Export Format ====================

/**
 * For use with outlet-migrate CLI, export default migration:
 *
 * module.exports = createUsersTable;
 *
 * Or for ES modules:
 *
 * export default createUsersTable;
 */

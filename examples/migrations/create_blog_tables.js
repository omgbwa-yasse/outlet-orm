/**
 * Example Migration: Create Blog Tables (Posts, Categories, Tags)
 */

const Migration = require('../../lib/Migrations/Migration');

class CreateBlogTables extends Migration {
  /**
   * Run the migrations
   */
  async up() {
    const schema = this.getSchema();

    // Table categories
    await schema.create('categories', (table) => {
      table.id();
      table.string('name', 50).unique();
      table.string('slug', 50).unique();
      table.text('description').nullable();
      table.foreignId('parent_id').nullable();
      table.timestamps();

      // Auto-référence pour catégories hiérarchiques
      table.foreign('parent_id')
        .references('id')
        .on('categories')
        .onDelete('CASCADE');

      table.index('slug');
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

      // Auto-référence pour commentaires imbriqués
      table.foreign('parent_id')
        .references('id')
        .on('comments')
        .onDelete('CASCADE');

      table.index(['post_id', 'is_approved']);
    });

    // Table tags
    await schema.create('tags', (table) => {
      table.id();
      table.string('name', 50).unique();
      table.string('slug', 50).unique();
      table.timestamps();

      table.index('slug');
    });

    // Table pivot post_tag (many-to-many)
    await schema.create('post_tag', (table) => {
      table.id();
      table.foreignId('post_id').constrained().cascadeOnDelete();
      table.foreignId('tag_id').constrained().cascadeOnDelete();
      table.timestamps();

      // Index unique pour éviter les doublons
      table.unique(['post_id', 'tag_id']);
    });
  }

  /**
   * Reverse the migrations
   */
  async down() {
    const schema = this.getSchema();

    // Supprimer dans l'ordre inverse à cause des clés étrangères
    await schema.dropIfExists('post_tag');
    await schema.dropIfExists('tags');
    await schema.dropIfExists('comments');
    await schema.dropIfExists('posts');
    await schema.dropIfExists('categories');
  }
}

module.exports = CreateBlogTables;

/**
 * Example Migration: Create Users Table
 */

const Migration = require('../../lib/Migrations/Migration');

class CreateUsersTable extends Migration {
  /**
   * Run the migrations
   */
  async up() {
    const schema = this.getSchema();

    await schema.create('users', (table) => {
      table.id();
      table.string('name', 100);
      table.string('email').unique();
      table.string('password');
      table.boolean('is_active').default(true);
      table.timestamp('email_verified_at').nullable();
      table.timestamps();
      table.softDeletes();

      // Index sur email pour les recherches rapides
      table.index('email');
    });
  }

  /**
   * Reverse the migrations
   */
  async down() {
    const schema = this.getSchema();
    await schema.dropIfExists('users');
  }
}

module.exports = CreateUsersTable;

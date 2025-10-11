/**
 * Migration: Create users table
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
      table.string('name');
      table.timestamps();
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

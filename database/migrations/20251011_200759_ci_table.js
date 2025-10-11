/**
 * Migration: Alter ci table
 */

const Migration = require('../../lib/Migrations/Migration');

class AlterCiTable extends Migration {
  /**
   * Run the migrations
   */
  async up() {
    const schema = this.getSchema();

    await schema.table('ci', (table) => {
      // Add your column modifications here
      // table.string('new_column');
    });
  }

  /**
   * Reverse the migrations
   */
  async down() {
    const schema = this.getSchema();

    await schema.table('ci', (table) => {
      // Reverse your column modifications here
      // table.dropColumn('new_column');
    });
  }
}

module.exports = AlterCiTable;

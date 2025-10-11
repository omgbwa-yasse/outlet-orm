/**
 * Example Migration: Alter Users Table (Add Phone Column)
 */

const Migration = require('../../lib/Migrations/Migration');

class AddPhoneToUsersTable extends Migration {
  /**
   * Run the migrations
   */
  async up() {
    const schema = this.getSchema();

    await schema.table('users', (table) => {
      // Ajouter colonne phone après email
      table.string('phone', 20).nullable().after('email');

      // Ajouter un index sur phone
      table.index('phone');
    });
  }

  /**
   * Reverse the migrations
   */
  async down() {
    const schema = this.getSchema();

    await schema.table('users', (table) => {
      // Supprimer l'index d'abord
      table.dropIndex(['phone']);

      // Puis supprimer la colonne
      table.dropColumn('phone');
    });
  }
}

module.exports = AddPhoneToUsersTable;

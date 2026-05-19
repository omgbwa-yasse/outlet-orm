/**
 * Data-transform migration: __MIGRATION_NAME__
 *
 * Use this template when a migration mutates existing row data
 * (e.g. backfill, column reshape, denormalization). The default
 * helpers wrap each transform in a row-level backup so it can be
 * restored on `down()`.
 *
 * Available helpers (see src/Migrations/Migration.js):
 *   - this.backupData(table, columns)
 *   - this.transformData(table, rowCallback, { batchSize: 1000 })
 *   - this.restoreData(table, snapshot)
 */

const { Migration } = require('outlet-orm');

class __CLASS_NAME__ extends Migration {
  /**
   * Apply the data transform.
   */
  async up() {
    // Example:
    //   this._snapshot = await this.backupData('users', ['id', 'email']);
    //   await this.transformData('users', (row) => ({
    //     email: row.email && row.email.toLowerCase()
    //   }));
    throw new Error('TODO: implement up() for __MIGRATION_NAME__');
  }

  /**
   * Reverse the data transform.
   */
  async down() {
    // Example:
    //   if (this._snapshot) await this.restoreData('users', this._snapshot);
    throw new Error('TODO: implement down() for __MIGRATION_NAME__');
  }
}

module.exports = __CLASS_NAME__;

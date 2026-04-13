'use strict';

/**
 * Example Migration: create_views_and_triggers
 *
 * Demonstrates how to use outlet-orm's DB-objects support inside a migration:
 *   - createView / dropViewIfExists
 *   - createTrigger / dropTriggerIfExists
 *
 * Usage:
 *   const db  = new DatabaseConnection({ ... });
 *   const mgr = new MigrationManager(db, __dirname);
 *   await mgr.run();
 */

const Migration = require('../../src/Migrations/Migration');

class CreateViewsAndTriggers extends Migration {
  async up() {
    const schema = this.getSchema();

    // Create a view that shows only active users
    await schema.createView(
      'active_users',
      "SELECT * FROM users WHERE status = 'active'"
    );

    // Create an AFTER UPDATE trigger that stamps last_modified
    await schema.createTrigger({
      name:   'set_last_modified',
      table:  'users',
      timing: 'AFTER',
      event:  'UPDATE',
      body:   "UPDATE users SET last_modified = datetime('now') WHERE id = NEW.id;"
    });
  }

  async down() {
    const schema = this.getSchema();

    await schema.dropViewIfExists('active_users');
    await schema.dropTriggerIfExists('set_last_modified', 'users');
  }
}

module.exports = CreateViewsAndTriggers;

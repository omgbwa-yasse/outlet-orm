/**
 * Migration Manager
 * Handles running, rolling back, and managing migrations
 */

const fs = require('fs').promises;
const path = require('path');

class MigrationManager {
  constructor(connection, migrationsPath = './database/migrations') {
    this.connection = connection;
    this.migrationsPath = path.resolve(process.cwd(), migrationsPath);
    this.migrationsTable = 'migrations';
  }

  /**
   * Initialize the migrations table
   */
  async initialize() {
    const { Schema } = require('../Schema/Schema');
    const schema = new Schema(this.connection);

    const tableExists = await schema.hasTable(this.migrationsTable);

    if (!tableExists) {
      await schema.create(this.migrationsTable, (table) => {
        table.id();
        table.string('migration');
        table.integer('batch');
        table.timestamp('created_at').useCurrent();
      });
      console.log('✓ Migrations table created');
    }
  }

  /**
   * Run all pending migrations
   */
  async run() {
    await this.initialize();

    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      console.log('✓ No pending migrations');
      return;
    }

    const batch = await this.getNextBatchNumber();

    console.log(`Running ${pending.length} migration(s)...\n`);

    for (const migration of pending) {
      await this.runMigration(migration, batch);
    }

    console.log(`\n✓ All migrations completed successfully`);
  }

  /**
   * Run a single migration
   */
  async runMigration(migrationFile, batch) {
    const startTime = Date.now();
    const migrationPath = path.join(this.migrationsPath, migrationFile);

    try {
      // Load the migration file
      delete require.cache[require.resolve(migrationPath)];
      const MigrationClass = require(migrationPath);
      const migration = new MigrationClass(this.connection);

      // Run the migration
      await migration.up();

      // Record in migrations table
      await this.recordMigration(migrationFile, batch);

      const duration = Date.now() - startTime;
      console.log(`✓ ${migrationFile} (${duration}ms)`);
    } catch (error) {
      console.error(`✗ Failed to run migration: ${migrationFile}`);
      console.error(error.message);
      throw error;
    }
  }

  /**
   * Rollback the last batch of migrations
   */
  async rollback(steps = 1) {
    await this.initialize();

    const migrations = await this.getLastBatchMigrations(steps);

    if (migrations.length === 0) {
      console.log('✓ No migrations to rollback');
      return;
    }

    console.log(`Rolling back ${migrations.length} migration(s)...\n`);

    // Rollback in reverse order
    for (const migration of migrations.reverse()) {
      await this.rollbackMigration(migration);
    }

    console.log(`\n✓ Rollback completed successfully`);
  }

  /**
   * Rollback a single migration
   */
  async rollbackMigration(migrationRecord) {
    const startTime = Date.now();
    const migrationPath = path.join(this.migrationsPath, migrationRecord.migration);

    try {
      // Load the migration file
      delete require.cache[require.resolve(migrationPath)];
      const MigrationClass = require(migrationPath);
      const migration = new MigrationClass(this.connection);

      // Run the down method
      await migration.down();

      // Remove from migrations table
      await this.removeMigrationRecord(migrationRecord.migration);

      const duration = Date.now() - startTime;
      console.log(`✓ ${migrationRecord.migration} (${duration}ms)`);
    } catch (error) {
      console.error(`✗ Failed to rollback migration: ${migrationRecord.migration}`);
      console.error(error.message);
      throw error;
    }
  }

  /**
   * Reset all migrations (rollback all)
   */
  async reset() {
    await this.initialize();

    const allMigrations = await this.getRanMigrations();

    if (allMigrations.length === 0) {
      console.log('✓ No migrations to reset');
      return;
    }

    console.log(`Resetting ${allMigrations.length} migration(s)...\n`);

    for (const migration of allMigrations.reverse()) {
      await this.rollbackMigration(migration);
    }

    console.log(`\n✓ Reset completed successfully`);
  }

  /**
   * Refresh migrations (reset + run)
   */
  async refresh() {
    console.log('Refreshing migrations...\n');
    await this.reset();
    console.log('');
    await this.run();
  }

  /**
   * Fresh migrations (drop all tables + run)
   */
  async fresh() {
    console.log('Fresh migration - dropping all tables...\n');

    const { Schema } = require('../Schema/Schema');
    const schema = new Schema(this.connection);

    // Get all tables
    const tables = await this.getAllTables();

    // Drop all tables
    for (const table of tables) {
      await schema.dropIfExists(table);
    }

    console.log('');
    await this.run();
  }

  /**
   * Get migration status
   */
  async status() {
    await this.initialize();

    const allFiles = await this.getAllMigrationFiles();
    const ranMigrations = await this.getRanMigrations();
    const ranNames = new Set(ranMigrations.map(m => m.migration));

    console.log('\n┌─────────────────────────────────────────────────────┬────────┐');
    console.log('│ Migration                                           │ Status │');
    console.log('├─────────────────────────────────────────────────────┼────────┤');

    for (const file of allFiles) {
      const status = ranNames.has(file) ? '  Ran  ' : 'Pending';
      const paddedFile = file.padEnd(51);
      console.log(`│ ${paddedFile} │ ${status} │`);
    }

    console.log('└─────────────────────────────────────────────────────┴────────┘\n');
  }

  /**
   * Get all migration files
   */
  async getAllMigrationFiles() {
    try {
      const files = await fs.readdir(this.migrationsPath);
      return files
        .filter(f => f.endsWith('.js'))
        .sort();
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get pending migrations
   */
  async getPendingMigrations() {
    const allFiles = await this.getAllMigrationFiles();
    const ranMigrations = await this.getRanMigrations();
    const ranNames = new Set(ranMigrations.map(m => m.migration));

    return allFiles.filter(file => !ranNames.has(file));
  }

  /**
   * Get all ran migrations
   */
  async getRanMigrations() {
    try {
      const sql = `SELECT * FROM ${this.migrationsTable} ORDER BY batch ASC, id ASC`;
      return await this.connection.execute(sql);
    } catch (error) {
      // Table doesn't exist yet (first migration), return empty array
      if (error.code === 'ER_NO_SUCH_TABLE' || error.message?.includes('no such table')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Get last batch migrations
   */
  async getLastBatchMigrations(steps = 1) {
    const sql = `
      SELECT * FROM ${this.migrationsTable}
      WHERE batch >= (
        SELECT MAX(batch) - ${steps - 1} FROM ${this.migrationsTable}
      )
      ORDER BY batch DESC, id DESC
    `;
    return await this.connection.execute(sql);
  }

  /**
   * Get next batch number
   */
  async getNextBatchNumber() {
    const sql = `SELECT MAX(batch) as max_batch FROM ${this.migrationsTable}`;
    const result = await this.connection.execute(sql);
    const maxBatch = result[0].max_batch || 0;
    return maxBatch + 1;
  }

  /**
   * Record a migration
   */
  async recordMigration(migration, batch) {
    const sql = `INSERT INTO ${this.migrationsTable} (migration, batch) VALUES (?, ?)`;
    await this.connection.execute(sql, [migration, batch]);
  }

  /**
   * Remove a migration record
   */
  async removeMigrationRecord(migration) {
    const sql = `DELETE FROM ${this.migrationsTable} WHERE migration = ?`;
    await this.connection.execute(sql, [migration]);
  }

  /**
   * Get all tables in the database
   */
  async getAllTables() {
    const driver = this.connection.config.driver;
    let sql;

    switch (driver) {
      case 'mysql':
        sql = `SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()`;
        break;
      case 'postgres':
      case 'postgresql':
        sql = `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
        break;
      case 'sqlite':
        sql = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`;
        break;
      default:
        throw new Error(`Unsupported driver: ${driver}`);
    }

    const result = await this.connection.execute(sql);
    return result.map(r => r.table_name || r.tablename || r.name);
  }
}

module.exports = MigrationManager;

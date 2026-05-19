/**
 * Migration Manager
 * Handles running, rolling back, and managing migrations
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const Environment = require('../Environment');

const DEFAULT_SAFETY_CONFIG = {
  autoBackupBeforeDestructive: true,
  backupRetentionCount: 10,
  backupPath: 'database/backups',
  requireProductionConfirm: true,
  environment: undefined,
  productionIndicators: {
    hosts: ['prod', 'production', 'live'],
    databasePatterns: ['_prod', '_production', '_live']
  },
  allowDrift: false
};

class MigrationManager extends EventEmitter {
  constructor(connection, migrationsPath = './database/migrations', migrationsTable = 'migrations', options = {}) {
    super();
    if (typeof migrationsTable !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(migrationsTable)) {
      throw new Error(`Invalid migrations table name: "${migrationsTable}"`);
    }
    this.connection = connection;
    this.migrationsPath = path.resolve(process.cwd(), migrationsPath);
    this.migrationsTable = migrationsTable;

    // ── Safety config (feature 003) ────────────────────────────────────────
    const incoming = options.migrations || options.safety || {};
    const env = process.env || {};
    this.safetyConfig = {
      ...DEFAULT_SAFETY_CONFIG,
      ...incoming,
      productionIndicators: {
        ...DEFAULT_SAFETY_CONFIG.productionIndicators,
        ...(incoming.productionIndicators || {})
      }
    };
    // Env-var overrides
    if (env.OUTLET_AUTO_BACKUP === '0') this.safetyConfig.autoBackupBeforeDestructive = false;
    if (env.OUTLET_AUTO_BACKUP === '1') this.safetyConfig.autoBackupBeforeDestructive = true;
    if (env.OUTLET_PRODUCTION_CONFIRM === '0') this.safetyConfig.requireProductionConfirm = false;
    if (env.OUTLET_ALLOW_DRIFT === '1') this.safetyConfig.allowDrift = true;
    // Resolve environment
    this.safetyConfig.environment = this.safetyConfig.environment || Environment.detect();
  }

  /**
   * Initialize the migrations table. Creates the full 7-column schema on a
   * fresh DB, or auto-upgrades a legacy 4-column table by ADDing missing
   * columns one-at-a-time (idempotent, non-destructive).
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
        table.string('checksum', 64).nullable();
        table.integer('execution_time_ms').nullable();
        table.string('status', 16).default('completed');
        table.timestamp('started_at').nullable();
        table.timestamp('finished_at').nullable();
        table.timestamp('rolled_back_at').nullable();
      });
      console.log('Migrations table created');
      return;
    }

    // Auto-upgrade legacy table.
    await this._ensureColumn(schema, 'checksum',          'VARCHAR(64) NULL');
    await this._ensureColumn(schema, 'execution_time_ms', 'INTEGER NULL');
    await this._ensureColumn(schema, 'status',            'VARCHAR(16) NOT NULL DEFAULT \'completed\'');
    // Deployment-tracking columns (v14.8.0)
    await this._ensureColumn(schema, 'started_at',        'TIMESTAMP NULL');
    await this._ensureColumn(schema, 'finished_at',       'TIMESTAMP NULL');
    await this._ensureColumn(schema, 'rolled_back_at',    'TIMESTAMP NULL');
  }

  /**
   * Add a column to the migrations table if it is missing. Uses raw ALTER
   * TABLE so we can stay vendor-agnostic with minimal Schema API surface.
   * @private
   */
  async _ensureColumn(schema, column, ddl) {
    const has = await schema.hasColumn(this.migrationsTable, column);
    if (has) return;
    const sql = `ALTER TABLE ${this.migrationsTable} ADD COLUMN ${column} ${ddl}`;
    await this.connection.execute(sql);
  }

  /**
   * Alias for {@link initialize}; mirrors the `migrate:install` command.
   */
  async install() {
    await this.initialize();
  }

  /**
   * Run all pending migrations.
   *
   * @param {object} [opts]
   * @param {boolean} [opts.pretend=false] dry-run: list pending without executing
   * @param {boolean} [opts.step=false]    each migration in its own batch
   * @param {boolean} [opts.seed=false]    run seeders after success
   * @param {string}  [opts.seeder]        seeder class to run (passed to SeederManager)
   */
  async run(opts = {}) {
    await this.initialize();
    await this._recoverInterruptedMigrations();
    await this._enforceDriftPolicy();

    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      console.log('No pending migrations');
      this.emit('migrations:none', { direction: 'up' });
      return;
    }

    if (opts.pretend) {
      console.log(`[pretend] Would run ${pending.length} migration(s):`);
      for (const m of pending) console.log(`  - ${m}`);
      this.emit('migrations:pretend', { direction: 'up', migrations: pending });
      return;
    }

    const baseBatch = await this.getNextBatchNumber();
    console.log(`Running ${pending.length} migration(s)...\n`);
    this.emit('migrations:started', { direction: 'up', migrations: pending });

    for (let i = 0; i < pending.length; i++) {
      const batch = opts.step ? baseBatch + i : baseBatch;
      await this.runMigration(pending[i], batch);
    }

    this.emit('migrations:ended', { direction: 'up', migrations: pending });
    console.log('\nAll migrations completed successfully');

    if (opts.seed) {
      const SeederManager = require('../Seeders/SeederManager');
      const seederManager = new SeederManager(this.connection);
      await seederManager.run(opts.seeder || null);
    }
  }

  /**
   * Run a single migration. Records start (with checksum + status='running'),
   * then updates to 'completed' (with execution_time_ms), 'failed', or 'skipped'.
   * Respects per-migration `shouldRun()` and `withinTransaction`.
   */
  async runMigration(migrationFile, batch) {
    const startTime = Date.now();
    const migrationPath = path.join(this.migrationsPath, migrationFile);
    const checksum = await this._computeChecksum(migrationPath);

    delete require.cache[require.resolve(migrationPath)];
    const MigrationClass = require(migrationPath);
    const migration = new MigrationClass(this.connection);

    // shouldRun() hook
    let should = true;
    if (typeof migration.shouldRun === 'function') {
      try { should = await migration.shouldRun(); } catch (e) { should = true; }
    }
    if (should === false) {
      await this.recordMigrationStart(migrationFile, batch, checksum);
      await this.connection.execute(
        `UPDATE ${this.migrationsTable} SET status = ? WHERE migration = ?`,
        ['skipped', migrationFile]
      );
      console.log(`${migrationFile} (skipped)`);
      this.emit('migration:skipped', { name: migrationFile });
      return;
    }

    await this.recordMigrationStart(migrationFile, batch, checksum);
    this.emit('migration:started', { name: migrationFile, method: 'up', batch });

    const wrap = !!migration.withinTransaction;
    try {
      if (wrap) await this.connection.beginTransaction();
      try {
        await migration.up();
        if (wrap) await this.connection.commit();
      } catch (innerErr) {
        if (wrap) await this.connection.rollback().catch(() => {});
        throw innerErr;
      }

      const duration = Date.now() - startTime;
      await this.recordMigrationSuccess(migrationFile, duration);
      console.log(`${migrationFile} (${duration}ms)`);
      this.emit('migration:ended', { name: migrationFile, method: 'up', batch, duration });
    } catch (error) {
      await this.recordMigrationFailure(migrationFile).catch(() => {});
      console.error(`Failed to run migration: ${migrationFile}`);
      console.error(error.message);
      throw error;
    }
  }

  /**
   * Rollback the last batch of migrations.
   *
   * @param {number|object} stepsOrOpts  number of steps, or options bag.
   * @param {object} [optsArg]           options when first arg is steps number.
   * @param {number} [opts.steps]   number of batches/migrations to revert
   * @param {number} [opts.batch]   rollback only this specific batch number
   * @param {boolean}[opts.pretend] dry-run
   */
  async rollback(stepsOrOpts = 1, optsArg = {}) {
    let steps = 1;
    let opts = {};
    if (typeof stepsOrOpts === 'object' && stepsOrOpts !== null) {
      opts = stepsOrOpts;
      steps = opts.steps || 1;
    } else {
      steps = stepsOrOpts;
      opts = optsArg || {};
    }
    this._assertProductionGate('rollback');
    await this.initialize();

    const migrations = opts.batch != null
      ? await this.getMigrationsByBatch(opts.batch)
      : await this.getLastBatchMigrations(steps);

    if (migrations.length === 0) {
      console.log('No migrations to rollback');
      this.emit('migrations:none', { direction: 'down' });
      return;
    }

    if (opts.pretend) {
      console.log(`[pretend] Would rollback ${migrations.length} migration(s):`);
      for (const m of migrations) console.log(`  - ${m.migration}`);
      this.emit('migrations:pretend', { direction: 'down', migrations: migrations.map(m => m.migration) });
      return;
    }

    await this._createAutoBackup('rollback', opts);

    console.log(`Rolling back ${migrations.length} migration(s)...\n`);
    this.emit('migrations:started', { direction: 'down', migrations: migrations.map(m => m.migration) });

    for (const migration of migrations.reverse()) {
      await this.rollbackMigration(migration);
    }

    this.emit('migrations:ended', { direction: 'down', migrations: migrations.map(m => m.migration) });
    console.log('\nRollback completed successfully');
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

      this.emit('migration:started', { name: migrationRecord.migration, method: 'down', batch: migrationRecord.batch });

      const wrap = !!migration.withinTransaction;
      if (wrap) await this.connection.beginTransaction();
      try {
        await migration.down();
        if (wrap) await this.connection.commit();
      } catch (innerErr) {
        if (wrap) await this.connection.rollback().catch(() => {});
        throw innerErr;
      }

      // Remove from migrations table
      await this.removeMigrationRecord(migrationRecord.migration);

      const duration = Date.now() - startTime;
      console.log(`${migrationRecord.migration} (${duration}ms)`);
      this.emit('migration:ended', { name: migrationRecord.migration, method: 'down', batch: migrationRecord.batch, duration });
    } catch (error) {
      console.error(`Failed to rollback migration: ${migrationRecord.migration}`);
      console.error(error.message);
      throw error;
    }
  }

  /**
   * Reset all migrations (rollback all).
   * @param {object} [opts]
   * @param {boolean} [opts.skipAutoBackup=false]
   * @param {boolean} [opts.pretend=false]
   * @param {boolean} [opts._nestedFromRefresh=false]  internal
   */
  async reset(opts = {}) {
    if (!opts._nestedFromRefresh) this._assertProductionGate('reset');
    await this.initialize();

    const allMigrations = await this.getRanMigrations();

    if (allMigrations.length === 0) {
      console.log('No migrations to reset');
      this.emit('migrations:none', { direction: 'down' });
      return;
    }

    if (opts.pretend) {
      console.log(`[pretend] Would reset ${allMigrations.length} migration(s):`);
      for (const m of allMigrations) console.log(`  - ${m.migration}`);
      this.emit('migrations:pretend', { direction: 'down', migrations: allMigrations.map(m => m.migration) });
      return;
    }

    if (!opts._nestedFromRefresh) {
      await this._createAutoBackup('reset', opts);
    }

    console.log(`Resetting ${allMigrations.length} migration(s)...\n`);
    this.emit('migrations:started', { direction: 'down', migrations: allMigrations.map(m => m.migration) });

    for (const migration of allMigrations.reverse()) {
      await this.rollbackMigration(migration);
    }

    this.emit('migrations:ended', { direction: 'down', migrations: allMigrations.map(m => m.migration) });
    console.log('\nReset completed successfully');
  }

  /**
   * Refresh migrations (reset + run). One auto-backup covers the whole op.
   * @param {object} [opts] supports pretend, seed, seeder, step
   */
  async refresh(opts = {}) {
    this._assertProductionGate('refresh');
    if (opts.pretend) {
      console.log('[pretend] Would refresh (reset + migrate)');
      await this.reset({ ...opts, _nestedFromRefresh: true, pretend: true });
      await this.run({ ...opts, pretend: true });
      return;
    }
    console.log('Refreshing migrations...\n');
    await this.initialize();
    await this._createAutoBackup('refresh', opts);
    await this.reset({ ...opts, _nestedFromRefresh: true });
    console.log('');
    await this.run({ pretend: false, step: opts.step, seed: opts.seed, seeder: opts.seeder });
  }

  /**
   * Fresh migrations (drop all tables + run). Creates auto-backup first.
   * @param {object} [opts] supports pretend, seed, seeder, step
   */
  async fresh(opts = {}) {
    this._assertProductionGate('fresh');
    if (opts.pretend) {
      console.log('[pretend] Would drop all tables and re-run all migrations');
      const tables = await this.getAllTables().catch(() => []);
      for (const t of tables) console.log(`  - drop ${t}`);
      await this.run({ ...opts, pretend: true });
      return;
    }
    console.log('Fresh migration - dropping all tables...\n');

    await this.initialize();
    await this._createAutoBackup('fresh', opts);

    const { Schema } = require('../Schema/Schema');
    const schema = new Schema(this.connection);

    const tables = await this.getAllTables();
    for (const table of tables) {
      await schema.dropIfExists(table);
    }

    console.log('');
    await this.run({ pretend: false, step: opts.step, seed: opts.seed, seeder: opts.seeder });
  }

  /**
   * Get migration status. Includes Status, Time, and Drift indicators.
   * Returns the rendered rows (mainly for testability); also prints a table.
   * @param {object} [opts]
   * @param {boolean} [opts.pending=false] only list pending migrations
   */
  async status(opts = {}) {
    await this.initialize();

    const allFiles = await this.getAllMigrationFiles();
    const ranMigrations = await this.getRanMigrations();
    const ranByName = new Map(ranMigrations.map(r => [r.migration, r]));
    const drifted = new Set((await this.getDriftedMigrations()).map(r => r.migration));
    const fileSet = new Set(allFiles);

    const rows = [];
    for (const file of allFiles) {
      const rec = ranByName.get(file);
      if (rec) {
        if (opts.pending) continue;
        rows.push({
          migration: file,
          batch: rec.batch,
          status: rec.status || 'completed',
          time: rec.execution_time_ms != null ? `${rec.execution_time_ms}ms` : '—',
          drift: rec.checksum == null ? '—' : (drifted.has(file) ? 'DRIFT' : 'OK')
        });
      } else {
        rows.push({ migration: file, batch: '—', status: 'pending', time: '—', drift: '—' });
      }
    }

    // Missing: rows in DB without a file on disk (history divergence).
    for (const rec of ranMigrations) {
      if (fileSet.has(rec.migration)) continue;
      if (opts.pending) continue;
      rows.push({
        migration: rec.migration,
        batch: rec.batch,
        status: 'missing',
        time: rec.execution_time_ms != null ? `${rec.execution_time_ms}ms` : '—',
        drift: 'MISSING'
      });
    }

    const header = 'Migration'.padEnd(40) + '  Batch  Status     Time      Drift';
    console.log('\n' + header);
    console.log('─'.repeat(header.length));
    for (const r of rows) {
      console.log(
        String(r.migration).padEnd(40) + '  ' +
        String(r.batch).padStart(5) + '  ' +
        String(r.status).padEnd(9) + '  ' +
        String(r.time).padEnd(8) + '  ' +
        String(r.drift)
      );
    }
    console.log('');
    return rows;
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
        SELECT MAX(batch) - ? FROM ${this.migrationsTable}
      )
      ORDER BY batch DESC, id DESC
    `;
    return await this.connection.execute(sql, [steps - 1]);
  }

  /**
   * Get all migrations belonging to a specific batch number.
   * @param {number} batch
   */
  async getMigrationsByBatch(batch) {
    const sql = `
      SELECT * FROM ${this.migrationsTable}
      WHERE batch = ?
      ORDER BY id DESC
    `;
    return await this.connection.execute(sql, [Number(batch)]);
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
   * Legacy: record a migration as already completed (kept for back-compat).
   * New code should use recordMigrationStart + recordMigrationSuccess.
   */
  async recordMigration(migration, batch) {
    const sql = `INSERT INTO ${this.migrationsTable} (migration, batch, status) VALUES (?, ?, ?)`;
    await this.connection.execute(sql, [migration, batch, 'completed']);
  }

  /**
   * Insert a row with status='running' and the migration file's checksum.
   * Idempotent against duplicate filename: if a row already exists for this
   * migration we UPDATE it back to 'running' (used by the recovery flow).
   */
  async recordMigrationStart(migration, batch, checksum) {
    const now = this._nowIso();
    const existing = await this.connection.execute(
      `SELECT id FROM ${this.migrationsTable} WHERE migration = ?`,
      [migration]
    );
    if (existing && existing.length > 0) {
      await this.connection.execute(
        `UPDATE ${this.migrationsTable} SET batch = ?, checksum = ?, status = ?, execution_time_ms = NULL, started_at = ?, finished_at = NULL, rolled_back_at = NULL WHERE migration = ?`,
        [batch, checksum, 'running', now, migration]
      );
      return;
    }
    await this.connection.execute(
      `INSERT INTO ${this.migrationsTable} (migration, batch, checksum, status, started_at) VALUES (?, ?, ?, ?, ?)`,
      [migration, batch, checksum, 'running', now]
    );
  }

  async recordMigrationSuccess(migration, executionTimeMs) {
    await this.connection.execute(
      `UPDATE ${this.migrationsTable} SET status = ?, execution_time_ms = ?, finished_at = ? WHERE migration = ?`,
      ['completed', executionTimeMs, this._nowIso(), migration]
    );
  }

  async recordMigrationFailure(migration) {
    await this.connection.execute(
      `UPDATE ${this.migrationsTable} SET status = ?, finished_at = ? WHERE migration = ?`,
      ['failed', this._nowIso(), migration]
    );
  }

  /**
   * ISO-8601 timestamp string (UTC). Compatible with MySQL/Postgres/SQLite
   * TIMESTAMP columns when stored as strings.
   * @private
   */
  _nowIso() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
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
      sql = 'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()';
      break;
    case 'postgres':
    case 'postgresql':
      sql = 'SELECT tablename FROM pg_tables WHERE schemaname = \'public\'';
      break;
    case 'sqlite':
      sql = 'SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\'';
      break;
    default:
      throw new Error(`Unsupported driver: ${driver}`);
    }

    const result = await this.connection.execute(sql);
    return result.map(r => r.table_name || r.tablename || r.name);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Deployment workflow: deploy / resolve / advisory lock / missing detection (v14.8.0)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Non-interactive deployment workflow. Applies all pending migrations
   * without auto-backup and refuses to proceed when drift or failed
   * migrations are detected (override with `allowDrift` / `allowFailed`).
   * Designed for CI/CD pipelines.
   *
   * @param {object} [opts]
   * @param {boolean} [opts.pretend=false]
   * @param {boolean} [opts.allowDrift=false] proceed despite checksum drift
   * @param {boolean} [opts.allowFailed=false] proceed despite previously-failed migrations
   */
  async deploy(opts = {}) {
    await this.initialize();

    // Failed-migration gate.
    if (!opts.allowFailed) {
      const ran = await this.getRanMigrations();
      const failed = ran.filter(r => r.status === 'failed');
      if (failed.length > 0) {
        const err = new Error(
          `Cannot deploy: ${failed.length} failed migration(s) found. ` +
          `Run "outlet-migrate resolve --rolled-back=<name>" first, or pass --allow-failed.`
        );
        err.code = 'EOUTLET_FAILED_MIGRATIONS';
        throw err;
      }
    }

    // Drift gate (strict by default in deploy mode).
    if (!opts.allowDrift) {
      const drifted = await this.getDriftedMigrations();
      if (drifted.length > 0) {
        const err = new Error(
          `Cannot deploy: ${drifted.length} migration(s) drifted from recorded checksum. ` +
          `Investigate or pass --allow-drift.`
        );
        err.code = 'EOUTLET_DRIFT';
        throw err;
      }
    }

    const pending = await this.getPendingMigrations();
    if (pending.length === 0) {
      console.log('No pending migrations to deploy');
      this.emit('migrations:none', { direction: 'up' });
      return { applied: [] };
    }

    if (opts.pretend) {
      console.log(`[pretend] Would deploy ${pending.length} migration(s):`);
      for (const m of pending) console.log(`  - ${m}`);
      this.emit('migrations:pretend', { direction: 'up', migrations: pending });
      return { applied: [], pretend: true };
    }

    const baseBatch = await this.getNextBatchNumber();
    console.log(`Deploying ${pending.length} migration(s)...\n`);
    this.emit('migrations:started', { direction: 'up', migrations: pending, mode: 'deploy' });

    const applied = [];
    await this._withLock(async () => {
      for (const file of pending) {
        await this.runMigration(file, baseBatch);
        applied.push(file);
      }
    });

    this.emit('migrations:ended', { direction: 'up', migrations: applied, mode: 'deploy' });
    console.log(`\nDeployed ${applied.length} migration(s) successfully`);
    return { applied };
  }

  /**
   * Manually record a migration as successfully applied (recovery / baseline).
   * Equivalent to a `migrate resolve --applied` command.
   *
   * @param {string} migration  migration filename (e.g. "20240101_init.js")
   */
  async markMigrationApplied(migration) {
    if (!migration) throw new Error('migration name required');
    await this.initialize();
    const filePath = path.join(this.migrationsPath, migration);
    const checksum = await this._computeChecksum(filePath);
    const batch = await this.getNextBatchNumber();
    const now = this._nowIso();

    await this._withLock(async () => {
      const existing = await this.connection.execute(
        `SELECT id, status FROM ${this.migrationsTable} WHERE migration = ?`,
        [migration]
      );
      if (existing && existing.length > 0) {
        // Re-mark failed/rolled-back rows as completed.
        await this.connection.execute(
          `UPDATE ${this.migrationsTable} SET status = ?, batch = ?, checksum = ?, finished_at = ?, rolled_back_at = NULL WHERE migration = ?`,
          ['completed', batch, checksum, now, migration]
        );
      } else {
        await this.connection.execute(
          `INSERT INTO ${this.migrationsTable} (migration, batch, checksum, status, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [migration, batch, checksum, 'completed', now, now]
        );
      }
    });

    console.log(`Marked ${migration} as applied`);
    this.emit('migration:resolved', { name: migration, action: 'applied' });
    return { migration, status: 'completed' };
  }

  /**
   * Manually record a migration as rolled back (recovery from failure).
   * Equivalent to a `migrate resolve --rolled-back` command. The row is preserved
   * with `rolled_back_at` set so future runs skip it as if pending.
   *
   * @param {string} migration  migration filename
   */
  async markMigrationRolledBack(migration) {
    if (!migration) throw new Error('migration name required');
    await this.initialize();
    const now = this._nowIso();

    await this._withLock(async () => {
      const existing = await this.connection.execute(
        `SELECT id FROM ${this.migrationsTable} WHERE migration = ?`,
        [migration]
      );
      if (!existing || existing.length === 0) {
        const err = new Error(`Cannot resolve rolled-back: migration "${migration}" not found in tracking table`);
        err.code = 'EOUTLET_NOT_FOUND';
        throw err;
      }
      // Delete the row so it becomes pending again (consistent with
      // existing rollback semantics) but emit the resolved event for tracing.
      await this.connection.execute(
        `DELETE FROM ${this.migrationsTable} WHERE migration = ?`,
        [migration]
      );
    });

    console.log(`Marked ${migration} as rolled back (${now})`);
    this.emit('migration:resolved', { name: migration, action: 'rolled-back' });
    return { migration, status: 'rolled-back' };
  }

  /**
   * Return migrations recorded in the database but whose file is missing
   * from the migrations directory (divergence / history desync).
   */
  async getMissingMigrations() {
    const ranMigrations = await this.getRanMigrations();
    if (ranMigrations.length === 0) return [];
    const files = new Set(await this.getAllMigrationFiles());
    return ranMigrations.filter(r => !files.has(r.migration));
  }

  // ── Advisory lock (Postgres/MySQL) ────────────────────────────────────────

  /**
   * Run `fn` while holding a cross-process advisory lock. SQLite has no
   * advisory locks; the lock is a no-op there.
   * @private
   */
  async _withLock(fn) {
    if (this._lockHeld) {
      // Re-entrant call from a wrapping operation (e.g. refresh→reset+run).
      return await fn();
    }
    const acquired = await this._acquireLock();
    this._lockHeld = true;
    try {
      return await fn();
    } finally {
      this._lockHeld = false;
      if (acquired) await this._releaseLock().catch(() => {});
    }
  }

  _lockId() {
    // Stable 31-bit integer derived from the migrations table name.
    const h = crypto.createHash('sha1').update(`outlet:${this.migrationsTable}`).digest();
    return h.readUInt32BE(0) & 0x7fffffff;
  }

  async _acquireLock() {
    const driver = this.connection?.config?.driver;
    try {
      if (driver === 'postgres' || driver === 'postgresql') {
        await this.connection.execute('SELECT pg_advisory_lock($1)', [this._lockId()]);
        return true;
      }
      if (driver === 'mysql') {
        const lockName = `outlet_${this.migrationsTable}`;
        const rows = await this.connection.execute('SELECT GET_LOCK(?, ?) AS got', [lockName, 10]);
        if (rows && rows[0] && Number(rows[0].got) === 1) return true;
        const err = new Error('Could not acquire migration advisory lock (another migration is running?)');
        err.code = 'EOUTLET_LOCK_BUSY';
        throw err;
      }
    } catch (e) {
      if (e.code === 'EOUTLET_LOCK_BUSY') throw e;
      // Non-fatal: drivers without advisory-lock support degrade silently.
      return false;
    }
    return false;
  }

  async _releaseLock() {
    const driver = this.connection?.config?.driver;
    if (driver === 'postgres' || driver === 'postgresql') {
      await this.connection.execute('SELECT pg_advisory_unlock($1)', [this._lockId()]);
    } else if (driver === 'mysql') {
      const lockName = `outlet_${this.migrationsTable}`;
      await this.connection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Safety / Backup / Drift helpers (feature 003-migration-data-preservation)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Compute SHA-256 hex checksum of a migration file's contents.
   * @private
   */
  async _computeChecksum(filePath) {
    try {
      const buf = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(buf).digest('hex');
    } catch (e) {
      return null;
    }
  }

  /**
   * Return migrations whose checksum no longer matches the file on disk.
   */
  async getDriftedMigrations() {
    const ranMigrations = await this.getRanMigrations();
    const drifted = [];
    for (const rec of ranMigrations) {
      if (!rec.checksum) continue;
      const filePath = path.join(this.migrationsPath, rec.migration);
      const current = await this._computeChecksum(filePath);
      if (current && current !== rec.checksum) {
        drifted.push({ ...rec, currentChecksum: current });
      }
    }
    return drifted;
  }

  /**
   * Detect rows left in status='running' or status='failed' from a previous
   * interrupted run. In TTY contexts prompts the operator to re-run /
   * mark-resolved / abort. In non-TTY contexts throws with clear instructions.
   * @private
   */
  async _recoverInterruptedMigrations() {
    let stuck;
    try {
      stuck = await this.connection.execute(
        `SELECT migration, status FROM ${this.migrationsTable} WHERE status IN ('running','failed')`
      );
    } catch (e) {
      return; // table may be missing/legacy
    }
    if (!stuck || stuck.length === 0) return;
    const names = stuck.map(r => `${r.migration} (${r.status})`).join(', ');

    if (!process.stdin.isTTY) {
      const err = new Error(
        `Found ${stuck.length} interrupted migration(s): ${names}. ` +
        `Run interactively to resolve, or manually update the migrations ` +
        `table to status='completed' or DELETE the row.`
      );
      err.code = 'EOUTLET_INTERRUPTED';
      throw err;
    }

    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.warn(`\n⚠ Interrupted migration(s) detected: ${names}`);
    const answer = await new Promise(resolve =>
      rl.question('Action? [r]e-run / [m]ark-resolved / [a]bort: ', resolve)
    );
    rl.close();
    const choice = String(answer || '').trim().toLowerCase();
    if (choice === 'm' || choice === 'mark-resolved') {
      for (const r of stuck) {
        await this.connection.execute(
          `UPDATE ${this.migrationsTable} SET status = 'completed' WHERE migration = ?`,
          [r.migration]
        );
      }
      console.log('Marked interrupted migrations as completed.');
      return;
    }
    if (choice === 'r' || choice === 're-run') {
      // Delete so they show up as pending again; up() will re-execute.
      for (const r of stuck) {
        await this.connection.execute(
          `DELETE FROM ${this.migrationsTable} WHERE migration = ?`,
          [r.migration]
        );
      }
      return;
    }
    const err = new Error('Aborted due to interrupted migrations.');
    err.code = 'EOUTLET_INTERRUPTED';
    throw err;
  }

  /**
   * Apply environment-specific drift policy. Called from run() before applying
   * any pending migrations.
   * @private
   */
  async _enforceDriftPolicy() {
    const drifted = await this.getDriftedMigrations();
    if (drifted.length === 0) return;

    const env = this.safetyConfig.environment;
    const names = drifted.map(d => d.migration).join(', ');

    if (env === 'production' && !this.safetyConfig.allowDrift) {
      const err = new Error(
        `Migration drift detected in production for: ${names}. ` +
        `Set OUTLET_ALLOW_DRIFT=1 to override.`
      );
      err.code = 'EOUTLET_DRIFT';
      throw err;
    }
    if (env === 'development') {
      console.warn(`⚠ Migration drift detected: ${names}`);
    }
    // test → silent
  }

  /**
   * Detect whether the current connection configuration looks like production.
   * Purely a hint for warning text — env detection is authoritative.
   * @private
   */
  _looksLikeProductionConfig() {
    const cfg = this.connection.config || {};
    const ind = this.safetyConfig.productionIndicators || {};
    const host = String(cfg.host || '').toLowerCase();
    const db = String(cfg.database || '').toLowerCase();
    if ((ind.hosts || []).some(h => host.includes(String(h).toLowerCase()))) return true;
    if ((ind.databasePatterns || []).some(p => db.includes(String(p).toLowerCase()))) return true;
    return false;
  }

  /**
   * Production gate. Returns silently if allowed; throws an Error with .code
   * = 'EOUTLET_PRODUCTION' otherwise. CLI callers should map to exit code 2.
   */
  _assertProductionGate(command) {
    if (this.safetyConfig.environment !== 'production') return;
    if (!this.safetyConfig.requireProductionConfirm) return;
    if (process.env.OUTLET_PRODUCTION_CONFIRM === '1') return;
    const err = new Error(
      `Refusing to run "${command}" in production. ` +
      `Set OUTLET_PRODUCTION_CONFIRM=1 (and run interactively) to proceed.`
    );
    err.code = 'EOUTLET_PRODUCTION';
    throw err;
  }

  /**
   * Create an auto-backup before a destructive command.
   *
   * Honors:
   *   - safetyConfig.autoBackupBeforeDestructive
   *   - opts.skipAutoBackup (IGNORED in production with a warning)
   *
   * Side effects:
   *   - Prunes oldest auto_before_* backups beyond retention.
   *   - Writes a .sql file and a sibling .meta.json sidecar.
   *
   * @param {string} command  one of: fresh|reset|refresh|rollback
   * @param {object} [opts]
   * @returns {Promise<{file?: string, meta?: string, skipped?: boolean, reason?: string}>}
   */
  async _createAutoBackup(command, opts = {}) {
    if (!this.safetyConfig.autoBackupBeforeDestructive) {
      return { skipped: true, reason: 'autoBackupBeforeDestructive=false' };
    }
    let skip = !!opts.skipAutoBackup;
    if (skip && this.safetyConfig.environment === 'production') {
      console.warn('⚠ --skip-auto-backup ignored in production');
      skip = false;
    }
    if (skip) {
      return { skipped: true, reason: 'skipAutoBackup' };
    }

    await this._pruneOldBackups(1); // reserve 1 slot for the new backup

    const ts = new Date()
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+$/, '')
      .replace('T', '_');
    let filename = `auto_before_${command}_${ts}.sql`;
    const backupDir = path.resolve(process.cwd(), this.safetyConfig.backupPath);
    await fs.mkdir(backupDir, { recursive: true });
    // Disambiguate within the same second
    let suffix = 0;
    while (true) {
      try {
        await fs.access(path.join(backupDir, filename));
        suffix += 1;
        filename = `auto_before_${command}_${ts}_${suffix}.sql`;
      } catch (e) { break; }
    }

    const BackupManager = require('../Backup/BackupManager');
    const backup = new BackupManager(this.connection, { backupPath: backupDir });
    const fullPath = await backup.full({ filename });

    let fileSize = 0;
    try { fileSize = (await fs.stat(fullPath)).size; } catch (e) { /* ignore */ }

    let currentBatch = 0;
    let tableCount = 0;
    let estimatedTotalRows = 0;
    try {
      const tables = await this.getAllTables();
      tableCount = tables.length;
      const ran = await this.getRanMigrations();
      currentBatch = ran.length ? Math.max(...ran.map(r => Number(r.batch) || 0)) : 0;
    } catch (e) { /* best-effort */ }

    const meta = {
      timestamp: new Date().toISOString(),
      command,
      databaseName: this.connection.config.database || null,
      fileSize,
      currentBatch,
      tableCount,
      estimatedTotalRows,
      nodeVersion: process.version,
      outletOrmVersion: require('../../package.json').version,
      environment: this.safetyConfig.environment,
      encrypted: false
    };
    const metaPath = fullPath.replace(/\.sql$/, '.meta.json');
    await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf8');

    console.log(`Auto-backup created: ${path.basename(fullPath)} (${fileSize} bytes)`);
    return { file: fullPath, meta: metaPath };
  }

  /**
   * Delete oldest auto-backups beyond safetyConfig.backupRetentionCount.
   * @private
   */
  async _pruneOldBackups(reserve = 0) {
    const dir = path.resolve(process.cwd(), this.safetyConfig.backupPath);
    let entries;
    try {
      entries = await fs.readdir(dir);
    } catch (e) {
      if (e.code === 'ENOENT') return;
      throw e;
    }
    const backups = entries.filter(f => /^auto_before_.+\.sql$/.test(f));
    const limit = Math.max(0, this.safetyConfig.backupRetentionCount - reserve);
    if (backups.length <= limit) return;

    // Sort oldest first by timestamp embedded in filename (lexicographic works).
    backups.sort();
    const toDelete = backups.slice(0, backups.length - limit);
    for (const f of toDelete) {
      const sql = path.join(dir, f);
      const meta = sql.replace(/\.sql$/, '.meta.json');
      await fs.unlink(sql).catch(() => {});
      await fs.unlink(meta).catch(() => {});
    }
  }

  /**
   * Restore the most recent auto-backup (or a specifically-named one).
   * Appends a JSON line to database/backups/.restore-history.log.
   *
   * @param {object} [opts]
   * @param {string} [opts.backup]  filename to restore (without dir).
   * @returns {Promise<{ file: string, statements: number }>}
   */
  async restoreAuto(opts = {}) {
    this._assertProductionGate('restore:auto');
    const dir = path.resolve(process.cwd(), this.safetyConfig.backupPath);
    let target = opts.backup;
    if (!target) {
      let entries = [];
      try { entries = await fs.readdir(dir); } catch (e) { /* dir missing */ }
      const backups = entries.filter(f => /^auto_before_.+\.sql$/.test(f)).sort();
      if (backups.length === 0) {
        const err = new Error('No auto-backups found to restore.');
        err.code = 'EOUTLET_NO_BACKUP';
        throw err;
      }
      target = backups[backups.length - 1];
    }
    const fullPath = path.join(dir, target);
    await fs.access(fullPath); // throws ENOENT if missing

    // Drop all existing user tables so CREATE/INSERT in the backup replay cleanly.
    try {
      const existing = await this.getAllTables();
      for (const t of existing) {
        await this.connection.execute(`DROP TABLE IF EXISTS ${t}`).catch(() => {});
      }
    } catch (e) { /* best-effort */ }

    // Read backup, strip line comments (BackupManager.restore filters whole
    // chunks beginning with `--`, which can swallow CREATE TABLE statements
    // that follow a `-- Table:` header within the same `;`-split chunk).
    const raw = await fs.readFile(fullPath, 'utf8');
    const stripped = raw
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    const tmpPath = fullPath + '.restore.tmp.sql';
    await fs.writeFile(tmpPath, stripped, 'utf8');

    const BackupManager = require('../Backup/BackupManager');
    const backup = new BackupManager(this.connection, { backupPath: dir });
    let result;
    try {
      result = await backup.restore(tmpPath);
    } finally {
      await fs.unlink(tmpPath).catch(() => {});
    }

    const logLine = JSON.stringify({
      timestamp: new Date().toISOString(),
      backup: target,
      statements: result.statements,
      environment: this.safetyConfig.environment
    }) + '\n';
    await fs.appendFile(path.join(dir, '.restore-history.log'), logLine, 'utf8').catch(() => {});

    return { file: fullPath, statements: result.statements };
  }

  /**
   * List auto-backups with their sidecar metadata.
   * @returns {Promise<Array<object>>}
   */
  async listAutoBackups() {
    const dir = path.resolve(process.cwd(), this.safetyConfig.backupPath);
    let entries = [];
    try { entries = await fs.readdir(dir); } catch (e) { return []; }
    const backups = entries.filter(f => /^auto_before_.+\.sql$/.test(f)).sort().reverse();
    const out = [];
    for (const f of backups) {
      const sqlPath = path.join(dir, f);
      const metaPath = sqlPath.replace(/\.sql$/, '.meta.json');
      let meta = {};
      try { meta = JSON.parse(await fs.readFile(metaPath, 'utf8')); } catch (e) { /* missing */ }
      let size = 0;
      try { size = (await fs.stat(sqlPath)).size; } catch (e) { /* ignore */ }
      out.push({ file: f, size, ...meta });
    }
    return out;
  }
}

module.exports = MigrationManager;

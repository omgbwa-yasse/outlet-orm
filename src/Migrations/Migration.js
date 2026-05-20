/**
 * Base Migration Class
 * All migrations should extend this class
 */

class Migration {
  constructor(connection) {
    this.connection = connection;
    // Whether MigrationManager should wrap up()/down() in a BEGIN/COMMIT.
    // Subclasses may override (`this.withinTransaction = true` in
    // their constructor, or as a class field).
    if (this.withinTransaction === undefined) this.withinTransaction = false;
  }

  /**
   * Run the migrations
   */
  async up() {
    throw new Error('Migration up() method must be implemented');
  }

  /**
   * Reverse the migrations
   */
  async down() {
    throw new Error('Migration down() method must be implemented');
  }

  /**
   * Conditional execution hook. Return `false` to skip
   * this migration; MigrationManager will record it as 'skipped' and emit
   * a `migration:skipped` event. Default = always run.
   * @returns {boolean|Promise<boolean>}
   */
  shouldRun() {
    return true;
  }

  /**
   * Get the migration name
   */
  static getName() {
    return this.name;
  }

  /**
   * Execute raw SQL
   */
  async execute(sql) {
    return await this.connection.execute(sql);
  }

  /**
   * Get the Schema builder
   */
  getSchema() {
    const { Schema } = require('../Schema/Schema');
    return new Schema(this.connection);
  }

  /**
   * Add a column only when it does not already exist.
   *
   * @param {object} schema
   * @param {string} tableName
   * @param {string} columnName
   * @param {(table: any) => void} applyColumn
   * @returns {Promise<boolean>}
   */
  async addColumnIfMissing(schema, tableName, columnName, applyColumn) {
    if (await schema.hasColumn(tableName, columnName)) {
      return false;
    }

    await schema.table(tableName, (table) => {
      applyColumn(table);
    });

    return true;
  }

  /**
   * Drop a column only when it exists.
   *
   * @param {object} schema
   * @param {string} tableName
   * @param {string} columnName
   * @returns {Promise<boolean>}
   */
  async dropColumnIfExists(schema, tableName, columnName) {
    if (!(await schema.hasColumn(tableName, columnName))) {
      return false;
    }

    await schema.table(tableName, (table) => {
      table.dropColumn(columnName);
    });

    return true;
  }

  /**
   * Drop a foreign key and ignore the common "already missing" errors emitted
   * by different drivers.
   *
   * @param {object} schema
   * @param {string} tableName
   * @param {string|string[]} columns
   * @returns {Promise<void>}
   */
  async dropForeignIfExists(schema, tableName, columns) {
    try {
      await schema.table(tableName, (table) => {
        table.dropForeign(columns);
      });
    } catch (error) {
      if (!error.message || (
        !error.message.includes('check that column/key exists') &&
        !error.message.includes('Can\'t DROP') &&
        !error.message.includes('Unknown') &&
        !error.message.includes('not found') &&
        !error.message.includes('does not exist')
      )) {
        throw error;
      }
    }
  }

  /**
   * Drop a named foreign key and ignore the common "already missing" errors
   * emitted by different drivers.
   *
   * @param {string} tableName
   * @param {string} foreignKeyName
   * @returns {Promise<void>}
   */
  async dropNamedForeignIfExists(tableName, foreignKeyName) {
    try {
      await this.execute(`ALTER TABLE \`${tableName}\` DROP FOREIGN KEY \`${foreignKeyName}\``);
    } catch (error) {
      if (!error.message || (
        !error.message.includes('check that column/key exists') &&
        !error.message.includes('Can\'t DROP') &&
        !error.message.includes('Unknown') &&
        !error.message.includes('not found') &&
        !error.message.includes('does not exist')
      )) {
        throw error;
      }
    }
  }

  /**
   * Fluent query builder bound to a table — convenience wrapper around
   * `this.connection.from(table)`. Lets migrations run reads/writes without
   * hand-crafting the connection's internal `{ wheres: [{ type: 'basic', ... }] }`
   * structure.
   *
   *   await this.query('users').where('id', userId).update({ active: 1 });
   *   const rows = await this.query('users').where('email', 'x@y').get();
   *
   * @param {string} tableName
   * @returns {import('../QueryBuilder')}
   */
  query(tableName) {
    return this.connection.from(tableName);
  }

  /** Alias of {@link query}. */
  table(tableName) {
    return this.connection.from(tableName);
  }

  /**
   * Lightweight migration logger. Silent when the process is running under
   * Jest or `NODE_ENV=test` to keep test output clean. Otherwise prints to
   * stdout with a `[migration]` tag. Subclasses can override these for custom
   * formatting.
   */
  log(...args) {
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) return;
    console.log('[migration]', ...args);
  }
  info(...args) { this.log(...args); }
  warn(...args) {
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) return;
    console.warn('[migration]', ...args);
  }

  /**
   * Snapshot rows from `table` (optionally a subset of columns) so they can
   * be restored later if a transformation fails. Returns the in-memory array
   * of rows; callers may persist it as JSON if desired.
   *
   * @param {string} table
   * @param {string[]} [columns] - if omitted, snapshots all columns (SELECT *)
   * @returns {Promise<object[]>}
   */
  async backupData(table, columns) {
    const colList = (Array.isArray(columns) && columns.length > 0)
      ? columns.map(c => `"${c}"`).join(', ')
      : '*';
    const rows = await this.connection.execute(`SELECT ${colList} FROM "${table}"`);
    return Array.isArray(rows) ? rows : [];
  }

  /**
   * Restore rows previously captured by {@link backupData}. The table is
   * truncated (DELETE) and rows re-inserted in their original order.
   * If `rows` is empty the table is left empty.
   *
   * @param {string} table
   * @param {object[]} rows
   * @returns {Promise<number>} number of rows restored
   */
  async restoreData(table, rows) {
    if (!Array.isArray(rows)) {
      throw new Error('restoreData: rows must be an array');
    }
    await this.connection.execute(`DELETE FROM "${table}"`);
    if (rows.length === 0) return 0;
    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => '?').join(', ');
    const colList = cols.map(c => `"${c}"`).join(', ');
    const sql = `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`;
    for (const row of rows) {
      const values = cols.map(c => row[c] === undefined ? null : row[c]);
      await this.connection.execute(sql, values);
    }
    return rows.length;
  }

  /**
   * Snapshot → transform → restore-on-failure helper. Reads all rows from
   * `table`, invokes `callback(row, index)` for each, and writes the result
   * back via UPDATE keyed by primary key (default `id`). On any error the
   * snapshot is restored and the original error re-thrown.
   *
   * @param {string} table
   * @param {(row: object, index: number) => (object|Promise<object>)} callback
   * @param {object} [opts]
   * @param {string} [opts.primaryKey='id']
   * @returns {Promise<number>} number of rows transformed
   */
  async transformData(table, callback, opts = {}) {
    if (typeof callback !== 'function') {
      throw new Error('transformData: callback must be a function');
    }
    const pk = opts.primaryKey || 'id';
    const snapshot = await this.backupData(table);
    try {
      let count = 0;
      for (let i = 0; i < snapshot.length; i++) {
        const original = snapshot[i];
        const updated = await callback({ ...original }, i);
        if (!updated || typeof updated !== 'object') continue;
        const cols = Object.keys(updated).filter(c => c !== pk);
        if (cols.length === 0) continue;
        const setClause = cols.map(c => `"${c}" = ?`).join(', ');
        const values = cols.map(c => updated[c] === undefined ? null : updated[c]);
        values.push(original[pk]);
        await this.connection.execute(
          `UPDATE "${table}" SET ${setClause} WHERE "${pk}" = ?`,
          values
        );
        count++;
      }
      return count;
    } catch (err) {
      // Restore on failure
      try { await this.restoreData(table, snapshot); } catch (_) { /* best-effort */ }
      throw err;
    }
  }
}

module.exports = Migration;

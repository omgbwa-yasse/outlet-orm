/**
 * BackupManager
 *
 * Provides programmatic backup capabilities for outlet-orm:
 *   - full     : complete schema + data dump
 *   - partial  : selected tables only
 *   - journal  : transaction log replay (INSERT / UPDATE / DELETE captured via query log)
 *
 * Supports MySQL, PostgreSQL, and SQLite drivers.
 */

'use strict';

const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const DatabaseConnection = require('../DatabaseConnection');
const { encrypt, decrypt, isEncrypted } = require('./BackupEncryption');

// DML keywords captured for transaction-log backups
const DML_REGEX = /^\s*(INSERT|UPDATE|DELETE|REPLACE)\s+/i;

/**
 * Escape a SQL identifier (table / column name).
 * @param {string} name
 * @param {string} driver  'mysql' | 'postgres' | 'sqlite'
 * @returns {string}
 */
function quoteIdentifier(name, driver) {
  if (driver === 'mysql') return `\`${name.replace(/`/g, '``')}\``;
  return `"${name.replace(/"/g, '""')}"`;   // postgres / sqlite
}

/**
 * Quote a scalar value for use in a SQL dump statement.
 * @param {*} val
 * @returns {string}
 */
function quoteValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  // Escape single quotes
  return `'${String(val).replace(/'/g, '\'\'')}'`;
}

/**
 * Generate a human-readable timestamp suitable for filenames.
 * @returns {string}  e.g. "20260226_143022"
 */
function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

class BackupManager {
  /**
   * @param {DatabaseConnection} connection
   * @param {object}  [options]
   * @param {string}  [options.backupPath='./database/backups']  Directory for backup files
   * @param {boolean} [options.encrypt=false]      Encrypt backup files with AES-256-GCM
   * @param {string}  [options.encryptionPassword] Password used for encryption / decryption
   * @param {number}  [options.saltLength=6]       Grain de sable length – 4, 5 or 6 characters
   */
  constructor(connection, options = {}) {
    if (!(connection instanceof DatabaseConnection)) {
      throw new TypeError('BackupManager requires a DatabaseConnection instance');
    }
    this.connection = connection;
    this.backupPath = path.resolve(
      process.cwd(),
      options.backupPath || './database/backups'
    );

    // Encryption settings
    this._encryptEnabled  = Boolean(options.encrypt);
    this._encryptPassword = options.encryptionPassword || null;
    this._saltLength      = options.saltLength != null ? options.saltLength : 6;

    if (this._encryptEnabled && !this._encryptPassword) {
      throw new Error('BackupManager: encryptionPassword is required when encrypt=true');
    }
    if (this._saltLength < 4 || this._saltLength > 6) {
      throw new RangeError(`BackupManager: saltLength must be between 4 and 6 (got ${this._saltLength})`);
    }

    this._ensureBackupDir();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Full backup – dumps schema (CREATE TABLE) + data (INSERT) for every user table.
   *
   * @param {object}  [options]
   * @param {string}  [options.filename]   Override the generated filename
   * @param {string}  [options.format='sql']  'sql' | 'json'
   * @returns {Promise<string>}  Absolute path of the written backup file
   */
  async full(options = {}) {
    const tables = await this._listTables();
    return this._dumpTables(tables, 'full', options);
  }

  /**
   * Partial backup – dumps schema + data for the specified tables only.
   *
   * @param {string[]} tables  Table names to include
   * @param {object}   [options]
   * @param {string}   [options.filename]
   * @param {string}   [options.format='sql']  'sql' | 'json'
   * @returns {Promise<string>}  Absolute path of the written backup file
   */
  async partial(tables, options = {}) {
    if (!Array.isArray(tables) || tables.length === 0) {
      throw new Error('BackupManager.partial() requires a non-empty array of table names');
    }
    return this._dumpTables(tables, 'partial', options);
  }

  /**
   * Transaction-log backup – captures DML statements (INSERT / UPDATE / DELETE)
   * from the DatabaseConnection query log and writes them as a replayable SQL script.
   *
   * ⚠️  Requires query logging to be enabled BEFORE the operations you want to record:
   *     DatabaseConnection.enableQueryLog()
   *
   * @param {object}  [options]
   * @param {string}  [options.filename]
   * @param {boolean} [options.flush=false]  Clear the query log after writing the journal
   * @returns {Promise<string>}  Absolute path of the written journal file
   */
  async journal(options = {}) {
    const log = DatabaseConnection.getQueryLog();
    // Filter to DML statements only
    const dmlEntries = log.filter((entry) => DML_REGEX.test(entry.sql));

    const driver = this.connection.driver;
    const filename = options.filename || `journal_${timestamp()}.sql`;
    const filePath = path.join(this.backupPath, filename);

    const header = this._sqlHeader('transaction-log journal');
    const lines = [header];

    for (const entry of dmlEntries) {
      const ts = entry.timestamp ? entry.timestamp.toISOString() : '';
      lines.push(`-- ${ts}  (${entry.duration}ms)`);
      // Re-inject bound parameters into the SQL for a replayable statement
      const replayable = this._injectParams(entry.sql, entry.params, driver);
      lines.push(replayable + ';');
    }

    lines.push(`-- end of journal (${dmlEntries.length} statement(s))`);

    // Apply encryption-aware filename
    const resolvedPath = (this._encryptEnabled && !filePath.endsWith('.enc'))
      ? filePath + '.enc'
      : filePath;

    await this._writeContent(resolvedPath, lines.join('\n'));

    if (options.flush) {
      DatabaseConnection.flushQueryLog();
    }

    console.log(`Transaction-log backup written: ${resolvedPath} (${dmlEntries.length} statement(s))`);
    return resolvedPath;
  }

  /**
   * Restore a previously created SQL backup file.
   * The file is executed statement-by-statement inside a transaction.
   *
   * @param {string} filePath  Absolute or relative path to the .sql backup file
   * @returns {Promise<{ statements: number }>}
   */
  async restore(filePath, options = {}) {
    const absolute = path.resolve(process.cwd(), filePath);
    let content = await fsPromises.readFile(absolute, 'utf8');

    // Decrypt if necessary
    if (isEncrypted(content)) {
      const password = options.encryptionPassword || this._encryptPassword;
      if (!password) {
        throw new Error('BackupManager.restore: file is encrypted – provide encryptionPassword');
      }
      content = decrypt(content, password);
    }

    // Split on semicolon, ignore comment-only or empty chunks
    const statements = content
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith('--'));

    let count = 0;
    await this.connection.transaction(async () => {
      for (const sql of statements) {
        await this.connection.execute(sql);
        count++;
      }
    });

    console.log(`Restore complete: ${count} statement(s) executed from ${absolute}`);
    return { statements: count };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Dump a list of tables in the chosen format.
   * @private
   */
  async _dumpTables(tables, label, options) {
    const format = (options.format || 'sql').toLowerCase();
    const ext = format === 'json' ? 'json' : 'sql';
    const baseExt = this._encryptEnabled ? `${ext}.enc` : ext;
    const filename = options.filename
      ? (this._encryptEnabled && !options.filename.endsWith('.enc') ? options.filename + '.enc' : options.filename)
      : `${label}_${timestamp()}.${baseExt}`;
    const filePath = path.join(this.backupPath, filename);

    if (format === 'json') {
      await this._dumpJSON(tables, filePath);
    } else {
      await this._dumpSQL(tables, filePath, label);
    }

    console.log(`${label.charAt(0).toUpperCase() + label.slice(1)} backup written: ${filePath}`);
    return filePath;
  }

  /**
   * Write a SQL dump (CREATE TABLE + INSERT INTO).
   * @private
   */
  async _dumpSQL(tables, filePath, label) {
    const driver = this.connection.driver;
    const lines = [this._sqlHeader(label)];

    for (const table of tables) {
      lines.push(`\n-- Table: ${table}`);
      lines.push('-- -----------------------------------------------------------');

      // Schema
      const createSql = await this._getCreateTable(table);
      if (createSql) {
        lines.push(createSql + ';');
      }

      // Data
      const rows = await this.connection.executeRawQuery(`SELECT * FROM ${quoteIdentifier(table, driver)}`);
      if (rows.length > 0) {
        const columns = Object.keys(rows[0]).map((c) => quoteIdentifier(c, driver)).join(', ');
        for (const row of rows) {
          const values = Object.values(row).map(quoteValue).join(', ');
          lines.push(`INSERT INTO ${quoteIdentifier(table, driver)} (${columns}) VALUES (${values});`);
        }
      }
    }

    lines.push('\n-- End of backup');
    await this._writeContent(filePath, lines.join('\n'));
  }

  /**
   * Write a JSON dump { table: rows[] }.
   * @private
   */
  async _dumpJSON(tables, filePath) {
    const driver = this.connection.driver;
    const dump = { generatedAt: new Date().toISOString(), tables: {} };

    for (const table of tables) {
      const rows = await this.connection.executeRawQuery(`SELECT * FROM ${quoteIdentifier(table, driver)}`);
      dump.tables[table] = rows;
    }

    await this._writeContent(filePath, JSON.stringify(dump, null, 2));
  }

  /**
   * List all user tables from the connected database.
   * @private
   * @returns {Promise<string[]>}
   */
  async _listTables() {
    const driver = this.connection.driver;
    let rows;

    switch (driver) {
    case 'mysql':
      rows = await this.connection.executeRawQuery(
        'SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = \'BASE TABLE\' ORDER BY table_name'
      );
      return rows.map((r) => r.name || r.TABLE_NAME);

    case 'postgres':
    case 'postgresql':
      rows = await this.connection.executeRawQuery(
        'SELECT tablename AS name FROM pg_tables WHERE schemaname = \'public\' ORDER BY tablename'
      );
      return rows.map((r) => r.name);

    case 'sqlite':
      rows = await this.connection.executeRawQuery(
        'SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\' ORDER BY name'
      );
      return rows.map((r) => r.name);

    default:
      throw new Error(`BackupManager: unsupported driver "${driver}"`);
    }
  }

  /**
   * Retrieve the CREATE TABLE statement for a given table.
   * Returns null if not available for the current driver.
   * @private
   * @returns {Promise<string|null>}
   */
  async _getCreateTable(table) {
    const driver = this.connection.driver;

    try {
      switch (driver) {
      case 'mysql': {
        const rows = await this.connection.executeRawQuery(`SHOW CREATE TABLE ${quoteIdentifier(table, driver)}`);
        return rows[0]?.['Create Table'] || null;
      }
      case 'sqlite': {
        const rows = await this.connection.executeRawQuery(
          'SELECT sql FROM sqlite_master WHERE type=\'table\' AND name=?',
          [table]
        );
        return rows[0]?.sql || null;
      }
      case 'postgres':
      case 'postgresql':
        // PostgreSQL does not expose a single-row SHOW CREATE TABLE.
        // Returning null; the INSERT statements are still written.
        return null;
      default:
        return null;
      }
    } catch (_) {
      return null;
    }
  }

  /**
   * Rebuild a replayable SQL statement by injecting bound parameters.
   * This is intentionally simple – values are quoted but not re-parameterized,
   * so the result is a human-readable / replayable script rather than a prepared
   * statement.
   * @private
   */
  _injectParams(sql, params, driver) {
    if (!params || params.length === 0) return sql;

    // Replace ? placeholders (MySQL/SQLite) or $1..$N placeholders (PostgreSQL)
    if (driver === 'postgres' || driver === 'postgresql') {
      let out = sql;
      for (let i = 0; i < params.length; i++) {
        out = out.replace(`$${i + 1}`, quoteValue(params[i]));
      }
      return out;
    }

    // MySQL / SQLite – replace each ? in order
    let idx = 0;
    return sql.replace(/\?/g, () => quoteValue(params[idx++]));
  }

  /**
   * Build a standard SQL header comment block.
   * @private
   */
  _sqlHeader(type) {
    return [
      '-- outlet-orm backup',
      `-- type      : ${type}`,
      `-- driver    : ${this.connection.driver}`,
      `-- database  : ${this.connection.config?.database || '(unknown)'}`,
      `-- generated : ${new Date().toISOString()}`,
      '-- ---------------------------------------------------------------',
    ].join('\n');
  }

  /**
   * Write content to disk, encrypting first when encryption is enabled.
   * @private
   * @param {string} filePath
   * @param {string} content
   */
  async _writeContent(filePath, content) {
    if (this._encryptEnabled) {
      const { encryptedContent, salt } = encrypt(content, this._encryptPassword, this._saltLength);
      await fsPromises.writeFile(filePath, encryptedContent, 'utf8');
      // Log the grain de sable (salt) for audit purposes without exposing the password
      console.log(`  🔒 Encrypted (grain de sable: "${salt}", AES-256-GCM, scrypt key derivation)`);
    } else {
      await fsPromises.writeFile(filePath, content, 'utf8');
    }
  }

  /**
   * Ensure the backup directory exists.
   * @private
   */
  _ensureBackupDir() {
    if (!fs.existsSync(this.backupPath)) {
      fs.mkdirSync(this.backupPath, { recursive: true });
    }
  }
}

module.exports = BackupManager;

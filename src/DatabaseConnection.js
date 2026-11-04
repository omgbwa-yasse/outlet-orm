// Load environment variables from .env if present. Set OUTLET_NO_DOTENV=1 in
// applications that load their own configuration to avoid a library side effect.
if (process.env.OUTLET_NO_DOTENV !== '1') {
  require('dotenv').config();
}

// Lazy driver holders
let mysql;
let PgPool;
let sqlite3;

const { AsyncLocalStorage } = require('async_hooks');

/**
 * Per-async-context transaction state.
 *
 * Keeping transaction state on the DatabaseConnection instance is unsafe for
 * servers: two concurrent requests would overwrite each other's connection and
 * could commit/rollback the wrong transaction. AsyncLocalStorage gives each
 * async execution chain its own transaction context.
 */
const transactionStorage = new AsyncLocalStorage();

// Query log storage
let queryLog = [];
let queryLoggingEnabled = false;
// Maximum number of entries retained in the query log to prevent unbounded memory growth
const MAX_QUERY_LOG_SIZE = 1000;

const RawExpression = require('./RawExpression');
const { UnsupportedCapabilityError } = require('./Errors/UnsupportedCapabilityError');

/**
 * Sanitize SQL identifier (table/column name) to prevent SQL injection
 * @param {string|RawExpression} identifier
 * @returns {string}
 */
function sanitizeIdentifier(identifier) {
  if (identifier instanceof RawExpression) {
    return identifier.value;
  }
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('Invalid SQL identifier');
  }
  const normalized = identifier
    .split('.')
    .map((part) => {
      const unwrapped = part.startsWith('`') && part.endsWith('`')
        ? part.slice(1, -1)
        : part;
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(unwrapped)) {
        throw new Error('Invalid SQL identifier');
      }
      return unwrapped;
    })
    .join('.');

  // Strict allowlist: only alphanumeric, underscore, dot (for table.column)
  // Supports optional MySQL-style backticks around each segment, then normalizes.
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(normalized)) {
    throw new Error('Invalid SQL identifier');
  }
  return normalized;
}

/**
 * Return a redacted copy of query parameters when the SQL touches sensitive
 * columns. This keeps the query log useful for debugging without persisting
 * passwords, tokens or other credentials.
 * @param {string} sql
 * @param {Array} params
 * @returns {Array}
 */
function redactLogParams(sql, params) {
  if (!params || params.length === 0) return params || [];
  const sensitive = /\b(password|passwd|pwd|secret|token|api[_-]?key|authorization|credit[_-]?card|ssn|pin)\b/i;
  if (!sensitive.test(String(sql))) return params;
  return params.map(() => '[REDACTED]');
}

/**
 * Log a query if logging is enabled
 * @param {string} sql
 * @param {Array} params
 * @param {number} duration
 */
function logQuery(sql, params, duration) {
  if (queryLoggingEnabled) {
    queryLog.push({
      sql,
      params: redactLogParams(sql, params),
      duration,
      timestamp: new Date()
    });
    // Enforce size cap to prevent unbounded memory growth
    if (queryLog.length > MAX_QUERY_LOG_SIZE) {
      queryLog.shift();
    }
  }
}

function ensureDriver(driverName) {
  let pkg;
  try {
    switch (driverName) {
    case 'mysql':
      pkg = 'mysql2';
      if (!mysql) mysql = require('mysql2/promise');
      return true;
    case 'postgres':
    case 'postgresql':
      pkg = 'pg';
      if (!PgPool) ({ Pool: PgPool } = require('pg'));
      return true;
    case 'sqlite':
      pkg = 'sqlite3';
      if (!sqlite3) sqlite3 = require('sqlite3').verbose();
      return true;
    default:
      return false;
    }
  } catch (e) {
    const msg = `Database driver not installed: ${pkg}.\nInstall it with: npm i ${pkg} --save\nOr select a different driver via config/.env.`;
    throw new Error(msg);
  }
}

function coerceNumber(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Database Connection Manager
 * Supports MySQL, PostgreSQL, and SQLite
 * Features: Connection pooling, transactions, query logging
 */
class DatabaseConnection {
  constructor(config) {
    const cfg = config || {};
    const env = process.env || {};
    let driver = (cfg.driver || env.DB_DRIVER || env.DATABASE_DRIVER || 'mysql').toLowerCase();
    if (driver === 'postgresql') driver = 'postgres';
    if (driver === 'sqlite3') driver = 'sqlite';

    const resolved = {
      driver,
      host: cfg.host || env.DB_HOST || 'localhost',
      port: cfg.port || coerceNumber(env.DB_PORT),
      user: cfg.user || env.DB_USER || env.DB_USERNAME,
      password: cfg.password || env.DB_PASSWORD,
      database: cfg.database || env.DB_DATABASE || env.DB_NAME,
      connectionLimit: cfg.connectionLimit || coerceNumber(env.DB_POOL_MAX) || 10
    };

    // Connection options that must be forwarded to the driver. Previously
    // these were silently dropped, which made TLS impossible to configure and
    // caused production connections to fall back to plaintext.
    const passthrough = [
      'ssl', 'ca', 'cert', 'key', 'pfx', 'passphrase',
      'rejectUnauthorized', 'minVersion', 'maxVersion',
      'socketPath', 'charset', 'timezone', 'connectTimeout',
      'queryTimeout', 'statementTimeout', 'applicationName',
      'busyTimeout', 'enableKeepAlive', 'foreignKeys'
    ];
    for (const key of passthrough) {
      if (cfg[key] !== undefined) resolved[key] = cfg[key];
    }

    // Environment-driven TLS. DB_SSL=true enables TLS with certificate
    // verification; DB_SSL_REJECT_UNAUTHORIZED=false is an explicit opt-out.
    if (resolved.ssl === undefined && env.DB_SSL === 'true') {
      resolved.ssl = { rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
    }
    if (resolved.rejectUnauthorized === undefined && env.DB_SSL_REJECT_UNAUTHORIZED !== undefined) {
      resolved.rejectUnauthorized = env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
    }

    if (driver === 'sqlite' && !resolved.database) {
      resolved.database = env.DB_FILE || env.SQLITE_DB || env.SQLITE_FILENAME || ':memory:';
    }

    this.config = resolved;
    this.driver = driver || 'mysql';
    this.connection = null;
    this.pool = null;
    this._connectPromise = null;
    // Legacy fields kept for backwards compatibility with direct callers.
    this._transactionConnection = null;
    this._pendingIsolationLevel = null;
    this._pgVersionNum = null;
    this._sqliteInTransaction = false;
    this._afterCommitHooks = [];
    // Fallback context for the legacy explicit beginTransaction()/commit() API.
    // transaction() always uses AsyncLocalStorage, which is concurrency-safe.
    this._explicitTxContext = null;
    // Serializes SQLite transactions (single connection).
    this._sqliteTxLock = Promise.resolve();
  }

  // ==================== Query Logging ====================

  /**
   * Enable query logging
   * @static
   */
  static enableQueryLog() {
    queryLoggingEnabled = true;
  }

  /**
   * Disable query logging
   * @static
   */
  static disableQueryLog() {
    queryLoggingEnabled = false;
  }

  /**
   * Get the query log
   * @static
   * @returns {Array}
   */
  static getQueryLog() {
    return [...queryLog];
  }

  /**
   * Clear the query log
   * @static
   */
  static flushQueryLog() {
    queryLog = [];
  }

  /**
   * Check if query logging is enabled
   * @static
   * @returns {boolean}
   */
  static isLogging() {
    return queryLoggingEnabled;
  }

  // ==================== Connection ====================

  /**
   * Connect to the database
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.pool || this.connection) return;
    if (this._connectPromise) return this._connectPromise;

    this._connectPromise = (async () => {
      switch (this.driver) {
      case 'mysql':
        ensureDriver('mysql');
        await this.connectMySQL();
        break;
      case 'postgres':
      case 'postgresql':
        ensureDriver('postgres');
        await this.connectPostgreSQL();
        break;
      case 'sqlite':
        ensureDriver('sqlite');
        await this.connectSQLite();
        break;
      default:
        throw new Error(`Unsupported database driver: ${this.driver}`);
      }
    })();

    try {
      await this._connectPromise;
    } finally {
      this._connectPromise = null;
    }
  }

  /**
   * Connect to MySQL database with connection pool
   * @private
   */
  async connectMySQL() {
    const options = {
      host: this.config.host || 'localhost',
      port: this.config.port || 3306,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      waitForConnections: true,
      connectionLimit: this.config.connectionLimit,
      queueLimit: 0
    };
    for (const key of [
      'ssl', 'socketPath', 'charset', 'timezone',
      'connectTimeout', 'enableKeepAlive'
    ]) {
      if (this.config[key] !== undefined) options[key] = this.config[key];
    }
    if (this.config.rejectUnauthorized !== undefined ||
        this.config.ca !== undefined ||
        this.config.cert !== undefined ||
        this.config.key !== undefined) {
      options.ssl = Object.assign({}, typeof options.ssl === 'object' ? options.ssl : {}, {
        ...(this.config.rejectUnauthorized !== undefined
          ? { rejectUnauthorized: this.config.rejectUnauthorized }
          : {}),
        ...(this.config.ca !== undefined ? { ca: this.config.ca } : {}),
        ...(this.config.cert !== undefined ? { cert: this.config.cert } : {}),
        ...(this.config.key !== undefined ? { key: this.config.key } : {})
      });
    }
    this.pool = mysql.createPool(options);
  }

  /**
   * Connect to PostgreSQL database with connection pool
   * @private
   */
  async connectPostgreSQL() {
    const options = {
      host: this.config.host || 'localhost',
      port: this.config.port || 5432,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      max: this.config.connectionLimit
    };
    for (const key of [
      'ssl', 'applicationName', 'statementTimeout',
      'queryTimeout', 'connectTimeout'
    ]) {
      if (this.config[key] !== undefined) options[key] = this.config[key];
    }
    if (this.config.rejectUnauthorized !== undefined ||
        this.config.ca !== undefined ||
        this.config.cert !== undefined ||
        this.config.key !== undefined) {
      options.ssl = Object.assign({}, typeof options.ssl === 'object' ? options.ssl : {}, {
        ...(this.config.rejectUnauthorized !== undefined
          ? { rejectUnauthorized: this.config.rejectUnauthorized }
          : {}),
        ...(this.config.ca !== undefined ? { ca: this.config.ca } : {}),
        ...(this.config.cert !== undefined ? { cert: this.config.cert } : {}),
        ...(this.config.key !== undefined ? { key: this.config.key } : {})
      });
    }
    this.pool = new PgPool(options);
    if (this.config.statementTimeout) {
      this.pool.on('connect', (client) => {
        client.query(`SET statement_timeout = ${Number(this.config.statementTimeout)}`).catch(() => {});
      });
    }

    // Cache the server version number (e.g. 110012 for 11.0.12) for feature gating.
    // Defaults to 110000 (PG 11.0) if the query fails — safe fallback assuming ≥11.
    try {
      const client = await this.pool.connect();
      try {
        const res = await client.query(
          'SELECT current_setting(\'server_version_num\')::int AS v'
        );
        this._pgVersionNum = res.rows[0].v;
      } finally {
        client.release();
      }
    } catch (_) {
      this._pgVersionNum = 110000;
    }
  }

  /**
   * Connect to SQLite database
   * @private
   */
  async connectSQLite() {
    return new Promise((resolve, reject) => {
      this.connection = new sqlite3.Database(
        this.config.database || ':memory:',
        (err) => {
          if (err) {
            reject(new Error(err.message || String(err)));
            return;
          }
          const busyTimeout = this.config.busyTimeout || this.config.queryTimeout || 5000;
          try { this.connection.configure('busyTimeout', busyTimeout); } catch (_) { /* best effort */ }
          // WAL improves concurrent read/write behaviour for file databases.
          if (this.config.database && this.config.database !== ':memory:') {
            this.connection.run('PRAGMA journal_mode = WAL', () => {});
          }
          if (this.config.foreignKeys === true) {
            this.connection.run('PRAGMA foreign_keys = ON', () => {});
          }
          resolve();
        }
      );
    });
  }

  // ==================== Transactions ====================

  /**
   * Return the transaction context attached to the current async execution.
   * @private
   */
  _txContext() {
    return transactionStorage.getStore() || null;
  }

  /**
   * Resolve the active transaction for legacy explicit begin/commit calls.
   * @private
   */
  _activeTxContext() {
    return this._txContext() || this._explicitTxContext || null;
  }

  /**
   * Acquire a dedicated connection for a top-level transaction.
   * SQLite uses a serialized lock because it exposes a single connection.
   * @private
   */
  async _acquireTxClient() {
    if (this.driver === 'sqlite') {
      const release = await this._acquireSqliteLock();
      return { client: this.connection, release, sqliteLock: true };
    }
    if (this.driver === 'mysql') {
      const client = await this.pool.getConnection();
      return { client, release: () => client.release(), sqliteLock: false };
    }
    const client = await this.pool.connect();
    return { client, release: () => client.release(), sqliteLock: false };
  }

  /**
   * Serialize SQLite transactions so concurrent callers wait instead of
   * throwing "cannot start a transaction within a transaction".
   * @private
   */
  async _acquireSqliteLock() {
    let release;
    const previous = this._sqliteTxLock;
    this._sqliteTxLock = new Promise((resolve) => { release = resolve; });
    await previous;
    return release;
  }

  /**
   * Acquire a dedicated driver client for session-scoped operations such as
   * advisory locks. The caller must release it with the returned function.
   * @returns {Promise<{client: any, release: Function}>}
   */
  async acquireDedicatedClient() {
    await this.connect();
    if (this.driver === 'sqlite') {
      return { client: this.connection, release: () => {} };
    }
    if (this.driver === 'mysql') {
      const client = await this.pool.getConnection();
      return { client, release: () => client.release() };
    }
    const client = await this.pool.connect();
    return { client, release: () => client.release() };
  }

  /**
   * Execute SQL on a specific dedicated client.
   * @param {any} client
   * @param {string} sql
   * @param {Array} [params]
   * @returns {Promise<any>}
   */
  async executeOnClient(client, sql, params = []) {
    if (this.driver === 'mysql') {
      const [rows] = await client.execute(sql, params);
      return rows;
    }
    if (this.driver === 'postgres' || this.driver === 'postgresql') {
      const result = await client.query(this.convertToDriverPlaceholder(sql), params);
      return result.rows;
    }
    return new Promise((resolve, reject) => {
      client.all(sql, params, (err, rows) => {
        if (err) reject(new Error(err.message || String(err)));
        else resolve(rows || []);
      });
    });
  }

  /**
   * Begin a transaction. Nested calls create a SAVEPOINT.
   * @returns {Promise<void>}
   */
  async beginTransaction() {
    await this.connect();

    const parent = this._txContext();
    if (parent) {
      const name = `outlet_sp_${++parent.savepointCounter}`;
      await this.execute(`SAVEPOINT ${name}`);
      const child = {
        connection: parent.connection,
        driver: this.driver,
        parent,
        savepointName: name,
        afterCommitHooks: [],
        sqliteRelease: null,
        savepointCounter: 0,
        depth: parent.depth + 1
      };
      transactionStorage.enterWith(child);
      this._explicitTxContext = child;
      return child;
    }

    const acquired = await this._acquireTxClient();
    const ctx = {
      connection: acquired.client,
      driver: this.driver,
      parent: null,
      savepointName: null,
      afterCommitHooks: [],
      sqliteRelease: acquired.sqliteLock ? acquired.release : null,
      savepointCounter: 0,
      depth: 0
    };

    // Legacy fields kept in sync for direct callers that inspect them.
    this._transactionConnection = acquired.client;
    this._sqliteInTransaction = this.driver === 'sqlite';

    try {
      if (this.driver === 'mysql') {
        if (this._pendingIsolationLevel) {
          await acquired.client.execute(
            `SET TRANSACTION ISOLATION LEVEL ${this._pendingIsolationLevel}`
          );
          this._pendingIsolationLevel = null;
        }
        await acquired.client.beginTransaction();
      } else if (this.driver === 'postgres' || this.driver === 'postgresql') {
        await acquired.client.query('BEGIN');
        if (this._pendingIsolationLevel) {
          await acquired.client.query(
            `SET TRANSACTION ISOLATION LEVEL ${this._pendingIsolationLevel}`
          );
          this._pendingIsolationLevel = null;
        }
      } else {
        await new Promise((resolve, reject) => {
          this.connection.run('BEGIN TRANSACTION', (err) => {
            if (err) reject(new Error(err.message || String(err)));
            else resolve();
          });
        });
      }
      transactionStorage.enterWith(ctx);
      this._explicitTxContext = ctx;
      return ctx;
    } catch (error) {
      this._transactionConnection = null;
      this._sqliteInTransaction = false;
      this._explicitTxContext = null;
      acquired.release();
      throw error;
    }
  }

  /**
   * Commit the current transaction.
   * @returns {Promise<void>}
   */
  async commit() {
    const ctx = this._activeTxContext();

    if (!ctx) {
      // Legacy fallback for callers that set the private field directly.
      if (this._sqliteInTransaction) {
        await new Promise((resolve, reject) => {
          this.connection.run('COMMIT', (err) => {
            if (err) reject(new Error(err.message || String(err)));
            else resolve();
          });
        });
        this._sqliteInTransaction = false;
      } else if (this._transactionConnection && typeof this._transactionConnection.commit === 'function') {
        try { await this._transactionConnection.commit(); }
        finally { this._transactionConnection.release(); this._transactionConnection = null; }
      }
      return;
    }

    if (ctx.parent) {
      await this.execute(`RELEASE SAVEPOINT ${ctx.savepointName}`);
      // Nested afterCommit hooks fire with the outermost transaction.
      ctx.parent.afterCommitHooks.push(...ctx.afterCommitHooks);
      transactionStorage.enterWith(ctx.parent);
      this._explicitTxContext = ctx.parent;
      return;
    }

    try {
      if (this.driver === 'mysql') {
        await ctx.connection.commit();
      } else if (this.driver === 'postgres' || this.driver === 'postgresql') {
        await ctx.connection.query('COMMIT');
      } else {
        await new Promise((resolve, reject) => {
          this.connection.run('COMMIT', (err) => {
            if (err) reject(new Error(err.message || String(err)));
            else resolve();
          });
        });
      }
    } finally {
      this._transactionConnection = null;
      this._sqliteInTransaction = false;
      this._explicitTxContext = null;
      if (ctx.sqliteRelease) ctx.sqliteRelease();
      else if (!ctx.parent) ctx.connection.release();
      transactionStorage.enterWith(null);
    }

    await this._fireAfterCommitHooks(ctx);
  }

  /**
   * Register a callback to be executed after the current transaction successfully commits.
   * If called outside an active transaction, the callback fires immediately.
   * @param {Function} cb
   * @returns {Promise<void>|void}
   */
  afterCommit(cb) {
    if (typeof cb !== 'function') return;
    const ctx = this._activeTxContext();
    if (ctx) {
      ctx.afterCommitHooks.push(cb);
      return;
    }
    return cb();
  }

  async _fireAfterCommitHooks(ctx) {
    const hooks = (ctx && ctx.afterCommitHooks) || [];
    if (ctx) ctx.afterCommitHooks = [];
    for (const cb of hooks) {
      await cb();
    }
  }

  /**
   * Rollback the current transaction (or nested savepoint).
   * @returns {Promise<void>}
   */
  async rollback() {
    const ctx = this._activeTxContext();

    if (!ctx) {
      if (this._sqliteInTransaction) {
        await new Promise((resolve, reject) => {
          this.connection.run('ROLLBACK', (err) => {
            if (err) reject(new Error(err.message || String(err)));
            else resolve();
          });
        });
        this._sqliteInTransaction = false;
      } else if (this._transactionConnection && typeof this._transactionConnection.rollback === 'function') {
        try { await this._transactionConnection.rollback(); }
        finally { this._transactionConnection.release(); this._transactionConnection = null; }
      }
      this._afterCommitHooks = [];
      return;
    }

    if (ctx.parent) {
      // PostgreSQL/MySQL keep the savepoint after ROLLBACK TO; release it.
      await this.execute(`ROLLBACK TO SAVEPOINT ${ctx.savepointName}`);
      await this.execute(`RELEASE SAVEPOINT ${ctx.savepointName}`);
      transactionStorage.enterWith(ctx.parent);
      this._explicitTxContext = ctx.parent;
      return;
    }

    try {
      if (this.driver === 'mysql') {
        await ctx.connection.rollback();
      } else if (this.driver === 'postgres' || this.driver === 'postgresql') {
        await ctx.connection.query('ROLLBACK');
      } else {
        await new Promise((resolve, reject) => {
          this.connection.run('ROLLBACK', (err) => {
            if (err) reject(new Error(err.message || String(err)));
            else resolve();
          });
        });
      }
    } finally {
      this._transactionConnection = null;
      this._sqliteInTransaction = false;
      this._explicitTxContext = null;
      if (ctx.sqliteRelease) ctx.sqliteRelease();
      else if (!ctx.parent) ctx.connection.release();
      transactionStorage.enterWith(null);
    }
  }

  /**
   * Execute a callback within a transaction
   * @param {Function} callback - Async function to execute
   * @returns {Promise<any>} - Result of the callback
   */
  async transaction(callback) {
    const ctx = await this.beginTransaction();
    // Run the callback inside an explicit AsyncLocalStorage scope. This is what
    // makes concurrent transactions on the same DatabaseConnection safe.
    return transactionStorage.run(ctx, async () => {
      try {
        const result = await callback(this);
        await this.commit();
        return result;
      } catch (error) {
        await this.rollback();
        throw error;
      }
    });
  }

  // ==================== Savepoints ====================

  /**
   * Create a named savepoint within the current transaction.
   * For MySQL and PostgreSQL, a transaction must be active first.
   * SQLite allows SAVEPOINT outside an explicit BEGIN (it begins a deferred transaction).
   * @param {string} name - Savepoint name (alphanumeric / underscore only)
   * @returns {Promise<void>}
   */
  async savepoint(name) {
    await this.connect();
    const safeName = sanitizeIdentifier(name);
    if (this.driver === 'mysql' || this.driver === 'postgres') {
      if (!this._activeTxContext()) {
        throw new Error('No active transaction. Call beginTransaction() first.');
      }
    }
    await this.execute(`SAVEPOINT ${safeName}`);
  }

  /**
   * Roll back to a named savepoint.
   * MySQL and PostgreSQL prune all inner savepoints created after this one.
   * SQLite does NOT remove the named savepoint itself after rollback.
   * @param {string} name
   * @returns {Promise<void>}
   */
  async rollbackTo(name) {
    await this.connect();
    const safeName = sanitizeIdentifier(name);
    await this.execute(`ROLLBACK TO SAVEPOINT ${safeName}`);
  }

  /**
   * Release a named savepoint, merging its changes into the enclosing transaction.
   * @note On SQLite, releasing the outermost savepoint commits the entire transaction.
   * @param {string} name
   * @returns {Promise<void>}
   */
  async releaseSavepoint(name) {
    await this.connect();
    const safeName = sanitizeIdentifier(name);
    await this.execute(`RELEASE SAVEPOINT ${safeName}`);
  }

  // ==================== Isolation Levels ====================

  /**
   * Set the isolation level for the **next** transaction.
   * Must be called before beginTransaction().
   * - SQLite + SERIALIZABLE: silent no-op (SQLite is always serializable)
   * - SQLite + any other level: throws UnsupportedCapabilityError
   * - MySQL / PostgreSQL: stores the level; emitted in beginTransaction()
   * @param {string} level - One of the IsolationLevel constants
   * @returns {void}
   */
  setIsolationLevel(level) {
    if (this._activeTxContext() || this._transactionConnection !== null || this._sqliteInTransaction) {
      throw new Error('Cannot set isolation level inside an active transaction');
    }
    if (this.driver === 'sqlite') {
      if (level === 'SERIALIZABLE') {
        // SQLite is inherently serializable — no SQL needed
        return;
      }
      throw new UnsupportedCapabilityError('sqlite', 'isolation levels other than SERIALIZABLE');
    }
    this._pendingIsolationLevel = level;
  }

  // ==================== Stored Procedures & Functions ====================

  /**
   * Call a stored procedure and return its result set.
   * @param {string} name   - Procedure name (alphanumeric / underscore only)
   * @param {Array}  params - Bound parameter values
   * @returns {Promise<Array>}
   */
  async callProcedure(name, params = []) {
    if (this.driver === 'sqlite') {
      throw new UnsupportedCapabilityError('sqlite', 'stored procedures');
    }
    await this.connect();
    const safeName = sanitizeIdentifier(name);
    let sql;
    if (this.driver === 'mysql') {
      sql = `CALL \`${safeName}\`(${params.map(() => '?').join(', ')})`;
    } else {
      // postgres
      const placeholders = params.map((_, i) => `$${i + 1}`).join(', ');
      sql = `CALL "${safeName}"(${placeholders})`;
    }
    return this.execute(sql, params);
  }

  /**
   * Call a stored function and return its scalar result.
   * @param {string} name   - Function name (alphanumeric / underscore only)
   * @param {Array}  params - Bound parameter values
   * @returns {Promise<any>}
   */
  async callFunction(name, params = []) {
    if (this.driver === 'sqlite') {
      throw new UnsupportedCapabilityError('sqlite', 'stored functions');
    }
    await this.connect();
    const safeName = sanitizeIdentifier(name);
    let sql;
    if (this.driver === 'mysql') {
      sql = `SELECT \`${safeName}\`(${params.map(() => '?').join(', ')}) AS result`;
    } else {
      // postgres
      const placeholders = params.map((_, i) => `$${i + 1}`).join(', ');
      sql = `SELECT "${safeName}"(${placeholders}) AS result`;
    }
    const rows = await this.execute(sql, params);
    return rows && rows[0] ? rows[0].result : null;
  }

  // ==================== Query Methods ====================

  /**
   * Get the connection to use (transaction connection or pool)
   * @private
   */
  _getConnection() {
    const ctx = this._activeTxContext();
    if (ctx) return ctx.connection;
    return this.pool || this.connection;
  }

  /**
   * Execute a SELECT query
   * @param {string} table
   * @param {Object} query
   * @returns {Promise<Array>}
   */
  async select(table, query) {
    await this.connect();
    const safeTable = sanitizeIdentifier(table);
    const { sql, params } = this.buildSelectQuery(safeTable, query);
    const start = Date.now();

    let result;
    switch (this.driver) {
    case 'mysql':
      result = await this.executeMySQLQuery(sql, params);
      break;
    case 'postgres':
    case 'postgresql':
      result = await this.executePostgreSQLQuery(sql, params);
      break;
    case 'sqlite':
      result = await this.executeSQLiteQuery(sql, params);
      break;
    }

    logQuery(sql, params, Date.now() - start);
    return result;
  }

  from(source) {
    if (
      source === null ||
      source === undefined ||
      (typeof source === 'string' && source.trim() === '')
    ) {
      const QueryBuilderError = require('./Errors/QueryBuilderError');
      throw new QueryBuilderError(
        'db.from() requires a non-empty table name string, a RawExpression instance, or a QueryBuilder instance.'
      );
    }
    const QueryBuilder = require('./QueryBuilder');
    return new QueryBuilder(null, { connection: this, source });
  }

  /**
   * Insert a record
   * @param {string} table
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async insert(table, data) {
    await this.connect();
    const safeTable = sanitizeIdentifier(table);

    const columns = Object.keys(data).map(col => sanitizeIdentifier(col));
    const values = Object.values(data);
    const placeholders = this.getPlaceholders(values.length);

    const sql = `INSERT INTO ${safeTable} (${columns.join(', ')}) VALUES (${placeholders})`;
    const start = Date.now();

    let result;
    switch (this.driver) {
    case 'mysql': {
      const conn = this._getConnection();
      const [res] = await conn.execute(sql, values);
      result = { insertId: res.insertId, affectedRows: res.affectedRows };
      break;
    }

    case 'postgres':
    case 'postgresql': {
      const conn = this._getConnection();
      const pgResult = await conn.query(
        `${this.convertToDriverPlaceholder(sql)} RETURNING *`,
        values
      );
      const firstRow = pgResult.rows[0] || {};
      result = {
        insertId: firstRow.id !== undefined ? firstRow.id : Object.values(firstRow)[0],
        affectedRows: pgResult.rowCount,
        row: firstRow
      };
      break;
    }

    case 'sqlite':
      result = await new Promise((resolve, reject) => {
        this.connection.run(sql, values, function(err) {
          if (err) reject(new Error(err.message || String(err)));
          else resolve({ insertId: this.lastID, affectedRows: this.changes });
        });
      });
      break;
    }

    logQuery(sql, values, Date.now() - start);
    return result;
  }

  /**
   * Insert multiple records
   * @param {string} table
   * @param {Array<Object>} data
   * @returns {Promise<Object>}
   */
  async insertMany(table, data) {
    if (data.length === 0) return { affectedRows: 0 };

    await this.connect();
    const safeTable = sanitizeIdentifier(table);

    const columns = Object.keys(data[0]).map(col => sanitizeIdentifier(col));
    const valuesSets = data.map(row => Object.values(row));

    const placeholderSet = `(${this.getPlaceholders(columns.length)})`;
    const allPlaceholders = valuesSets.map(() => placeholderSet).join(', ');
    const allValues = valuesSets.flat();

    const sql = `INSERT INTO ${safeTable} (${columns.join(', ')}) VALUES ${allPlaceholders}`;
    const start = Date.now();

    let result;
    switch (this.driver) {
    case 'mysql': {
      const conn = this._getConnection();
      const [res] = await conn.execute(sql, allValues);
      result = { affectedRows: res.affectedRows };
      break;
    }

    case 'postgres':
    case 'postgresql': {
      const conn = this._getConnection();
      const pgResult = await conn.query(this.convertToDriverPlaceholder(sql), allValues);
      result = { affectedRows: pgResult.rowCount };
      break;
    }

    case 'sqlite':
      result = await new Promise((resolve, reject) => {
        this.connection.run(sql, allValues, function(err) {
          if (err) reject(new Error(err.message || String(err)));
          else resolve({ affectedRows: this.changes });
        });
      });
      break;
    }

    logQuery(sql, allValues, Date.now() - start);
    return result;
  }

  /**
   * Update records
   * @param {string} table
   * @param {Object} data
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async update(table, data, query) {
    await this.connect();
    const safeTable = sanitizeIdentifier(table);

    const setClauses = Object.keys(data).map(key => `${sanitizeIdentifier(key)} = ?`);
    const { whereClause, params: whereParams } = this.buildWhereClause(query.wheres || []);

    const sql = `UPDATE ${safeTable} SET ${setClauses.join(', ')}${whereClause}`;
    const params = [...Object.values(data), ...whereParams];
    const start = Date.now();

    let result;
    switch (this.driver) {
    case 'mysql': {
      const conn = this._getConnection();
      const [res] = await conn.execute(sql, params);
      result = { affectedRows: res.affectedRows };
      break;
    }

    case 'postgres':
    case 'postgresql': {
      const conn = this._getConnection();
      const pgResult = await conn.query(
        this.convertToDriverPlaceholder(sql, 'postgres'),
        params
      );
      result = { affectedRows: pgResult.rowCount };
      break;
    }

    case 'sqlite':
      result = await new Promise((resolve, reject) => {
        this.connection.run(sql, params, function(err) {
          if (err) reject(new Error(err.message || String(err)));
          else resolve({ affectedRows: this.changes });
        });
      });
      break;
    }

    logQuery(sql, params, Date.now() - start);
    return result;
  }

  /**
   * Delete records
   * @param {string} table
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async delete(table, query) {
    await this.connect();
    const safeTable = sanitizeIdentifier(table);

    const { whereClause, params } = this.buildWhereClause(query.wheres || []);
    const sql = `DELETE FROM ${safeTable}${whereClause}`;
    const start = Date.now();

    let result;
    switch (this.driver) {
    case 'mysql': {
      const conn = this._getConnection();
      const [res] = await conn.execute(sql, params);
      result = { affectedRows: res.affectedRows };
      break;
    }

    case 'postgres':
    case 'postgresql': {
      const conn = this._getConnection();
      const pgResult = await conn.query(
        this.convertToDriverPlaceholder(sql, 'postgres'),
        params
      );
      result = { affectedRows: pgResult.rowCount };
      break;
    }

    case 'sqlite':
      result = await new Promise((resolve, reject) => {
        this.connection.run(sql, params, function(err) {
          if (err) reject(new Error(err.message || String(err)));
          else resolve({ affectedRows: this.changes });
        });
      });
      break;
    }

    logQuery(sql, params, Date.now() - start);
    return result;
  }

  /**
   * Atomically increment a column
   * @param {string} table
   * @param {string} column
   * @param {Object} query
   * @param {number} amount
   * @returns {Promise<{affectedRows: number}>}
   */
  async increment(table, column, query, amount = 1) {
    await this.connect();
    const safeTable = sanitizeIdentifier(table);
    const safeColumn = sanitizeIdentifier(column);

    const { whereClause, params: whereParams } = this.buildWhereClause(query?.wheres || []);
    const sql = `UPDATE ${safeTable} SET ${safeColumn} = ${safeColumn} + ?${whereClause}`;
    const params = [amount, ...whereParams];
    const start = Date.now();

    let result;
    switch (this.driver) {
    case 'mysql': {
      const conn = this._getConnection();
      const [res] = await conn.execute(this.convertToDriverPlaceholder(sql), params);
      result = { affectedRows: res.affectedRows };
      break;
    }
    case 'postgres':
    case 'postgresql': {
      const conn = this._getConnection();
      const res = await conn.query(this.convertToDriverPlaceholder(sql, 'postgres'), params);
      result = { affectedRows: res.rowCount };
      break;
    }
    case 'sqlite':
      result = await new Promise((resolve, reject) => {
        this.connection.run(sql, params, function(err) {
          if (err) reject(new Error(err.message || String(err)));
          else resolve({ affectedRows: this.changes });
        });
      });
      break;
    }

    logQuery(sql, params, Date.now() - start);
    return result;
  }

  /**
   * Atomically decrement a column
   * @param {string} table
   * @param {string} column
   * @param {Object} query
   * @param {number} amount
   * @returns {Promise<{affectedRows: number}>}
   */
  async decrement(table, column, query, amount = 1) {
    await this.connect();
    const safeTable = sanitizeIdentifier(table);
    const safeColumn = sanitizeIdentifier(column);

    const { whereClause, params: whereParams } = this.buildWhereClause(query?.wheres || []);
    const sql = `UPDATE ${safeTable} SET ${safeColumn} = ${safeColumn} - ?${whereClause}`;
    const params = [amount, ...whereParams];
    const start = Date.now();

    let result;
    switch (this.driver) {
    case 'mysql': {
      const conn = this._getConnection();
      const [res] = await conn.execute(this.convertToDriverPlaceholder(sql), params);
      result = { affectedRows: res.affectedRows };
      break;
    }
    case 'postgres':
    case 'postgresql': {
      const conn = this._getConnection();
      const res = await conn.query(this.convertToDriverPlaceholder(sql, 'postgres'), params);
      result = { affectedRows: res.rowCount };
      break;
    }
    case 'sqlite':
      result = await new Promise((resolve, reject) => {
        this.connection.run(sql, params, function(err) {
          if (err) reject(new Error(err.message || String(err)));
          else resolve({ affectedRows: this.changes });
        });
      });
      break;
    }

    logQuery(sql, params, Date.now() - start);
    return result;
  }

  /**
   * Count records
   * @param {string} table
   * @param {Object} query
   * @returns {Promise<number>}
   */
  async count(table, query) {
    await this.connect();
    const safeTable = sanitizeIdentifier(table);

    const { whereClause, params } = this.buildWhereClause(query?.wheres || []);
    const sql = `SELECT COUNT(*) as count FROM ${safeTable}${whereClause}`;
    const start = Date.now();

    let result;
    switch (this.driver) {
    case 'mysql': {
      const conn = this._getConnection();
      const [rows] = await conn.execute(this.convertToDriverPlaceholder(sql), params);
      result = rows[0].count;
      break;
    }
    case 'postgres':
    case 'postgresql': {
      const conn = this._getConnection();
      const pgResult = await conn.query(this.convertToDriverPlaceholder(sql, 'postgres'), params);
      result = parseInt(pgResult.rows[0].count, 10);
      break;
    }
    case 'sqlite':
      result = await new Promise((resolve, reject) => {
        this.connection.get(sql, params, (err, row) => {
          if (err) reject(new Error(err.message || String(err)));
          else resolve(row.count);
        });
      });
      break;
    }

    logQuery(sql, params, Date.now() - start);
    return result;
  }

  /**
   * Execute an aggregate function (SUM, AVG, MIN, MAX) on a column
   * @param {string} table
   * @param {string} fn - Aggregate function name (SUM, AVG, MIN, MAX)
   * @param {string} column
   * @param {Object} query
   * @returns {Promise<number>}
   */
  async aggregate(table, fn, column, query) {
    await this.connect();
    const allowedFns = ['SUM', 'AVG', 'MIN', 'MAX'];
    const safeFn = fn.toUpperCase();
    if (!allowedFns.includes(safeFn)) {
      throw new Error(`Invalid aggregate function: ${fn}`);
    }
    const safeTable = sanitizeIdentifier(table);
    const safeColumn = sanitizeIdentifier(column);

    const { whereClause, params } = this.buildWhereClause(query?.wheres || []);
    const sql = `SELECT ${safeFn}(${safeColumn}) as result FROM ${safeTable}${whereClause}`;
    const start = Date.now();

    let result;
    switch (this.driver) {
    case 'mysql': {
      const conn = this._getConnection();
      const [rows] = await conn.execute(this.convertToDriverPlaceholder(sql), params);
      result = rows[0].result;
      break;
    }
    case 'postgres':
    case 'postgresql': {
      const conn = this._getConnection();
      const pgResult = await conn.query(this.convertToDriverPlaceholder(sql, 'postgres'), params);
      result = parseFloat(pgResult.rows[0].result);
      break;
    }
    case 'sqlite':
      result = await new Promise((resolve, reject) => {
        this.connection.get(sql, params, (err, row) => {
          if (err) reject(new Error(err.message || String(err)));
          else resolve(row.result);
        });
      });
      break;
    }

    logQuery(sql, params, Date.now() - start);
    return result != null ? Number(result) : 0;
  }

  /**
   * Execute a raw query and return normalized results.
   * ⚠️  SECURITY WARNING: The `sql` parameter is passed to the database driver without
   * any sanitization. NEVER pass user-controlled data in `sql`. User-controlled values
   * must be supplied exclusively via the `params` array (parameterized queries).
   * @param {string} sql
   * @param {Array} params
   * @returns {Promise<Array>}
   */
  async executeRawQuery(sql, params = []) {
    await this.connect();
    const start = Date.now();

    let result;
    switch (this.driver) {
    case 'mysql': {
      const conn = this._getConnection();
      const [rows] = await conn.execute(sql, params);
      result = rows;
      break;
    }
    case 'postgres':
    case 'postgresql': {
      const conn = this._getConnection();
      const pgResult = await conn.query(sql, params);
      result = pgResult.rows;
      break;
    }
    case 'sqlite':
      result = await new Promise((resolve, reject) => {
        this.connection.all(sql, params, (err, rows) => {
          if (err) reject(new Error(err.message || String(err)));
          else resolve(rows);
        });
      });
      break;
    }

    logQuery(sql, params, Date.now() - start);
    return result;
  }

  /**
   * Execute raw SQL — driver-native results (intended for migrations).
   * ⚠️  SECURITY WARNING: The `sql` parameter is passed to the database driver without
   * any sanitization. NEVER pass user-controlled data in `sql`. User-controlled values
   * must be supplied exclusively via the `params` array (parameterized queries).
   * @param {string} sql
   * @param {Array} params
   * @returns {Promise<any>}
   */
  async execute(sql, params = []) {
    await this.connect();
    const start = Date.now();

    let result;
    switch (this.driver) {
    case 'mysql': {
      const conn = this._getConnection();
      const [rows] = await conn.execute(sql, params);
      result = rows;
      break;
    }
    case 'postgres':
    case 'postgresql': {
      const conn = this._getConnection();
      const pgResult = await conn.query(sql, params);
      result = pgResult.rows;
      break;
    }
    case 'sqlite':
      result = await new Promise((resolve, reject) => {
        this.connection.all(sql, params, (err, rows) => {
          if (err) reject(new Error(err.message || String(err)));
          else resolve(rows || []);
        });
      });
      break;
    }

    logQuery(sql, params, Date.now() - start);
    return result;
  }

  // ==================== Driver-Specific Query Execution ====================

  /**
   * Execute MySQL query
   * @private
   */
  async executeMySQLQuery(sql, params) {
    const conn = this._getConnection();
    const [rows] = await conn.execute(sql, params);
    return rows;
  }

  /**
   * Execute PostgreSQL query
   * @private
   */
  async executePostgreSQLQuery(sql, params) {
    const conn = this._getConnection();
    const result = await conn.query(
      this.convertToDriverPlaceholder(sql, 'postgres'),
      params
    );
    return result.rows;
  }

  /**
   * Execute SQLite query
   * @private
   */
  async executeSQLiteQuery(sql, params) {
    return new Promise((resolve, reject) => {
      this.connection.all(sql, params, (err, rows) => {
        if (err) reject(new Error(err.message || String(err)));
        else resolve(rows);
      });
    });
  }

  // ==================== Query Building ====================

  /**
   * Build SELECT query
   * @private
   */
  buildSelectQuery(table, query) {
    const params = [];

    // SELECT clause
    let selectClause = '*';
    if (query.columns && query.columns.length > 0) {
      const onlyStar = query.columns.length === 1 && query.columns[0] === '*';
      if (!onlyStar) {
        selectClause = query.columns.map(col => {
          if (col instanceof RawExpression) return col.value;
          if (col === '*') return '*';
          return sanitizeIdentifier(col);
        }).join(', ');
      }
    }

    // DISTINCT
    const distinctClause = query.distinct ? 'DISTINCT ' : '';

    let fromClause = table;
    if (query.tableAlias) {
      fromClause = `${table} AS ${sanitizeIdentifier(query.tableAlias)}`;
    }
    let sql = `SELECT ${distinctClause}${selectClause} FROM ${fromClause}`;

    // JOINs
    if (query.joins && query.joins.length > 0) {
      for (const join of query.joins) {
        const joinType = (join.type || 'inner').toUpperCase();
        if (joinType === 'CROSS') {
          sql += ` CROSS JOIN ${sanitizeIdentifier(join.table)}`;
          continue;
        }
        const ALLOWED_OPERATORS = ['=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'NOT LIKE', 'IS', 'IS NOT'];
        const op = join.operator.toUpperCase();
        if (!ALLOWED_OPERATORS.includes(op)) {
          throw new Error(`Invalid operator: ${join.operator}`);
        }
        sql += ` ${joinType} JOIN ${sanitizeIdentifier(join.table)} ON ${sanitizeIdentifier(join.first)} ${op} ${sanitizeIdentifier(join.second)}`;
      }
    }

    // WHERE
    const { whereClause, params: whereParams } = this.buildWhereClause(query.wheres);
    sql += whereClause;
    params.push(...whereParams);

    // GROUP BY
    if (query.groupBys && query.groupBys.length > 0) {
      sql += ` GROUP BY ${query.groupBys.map(col => sanitizeIdentifier(col)).join(', ')}`;
    }

    if (query.params && Array.isArray(query.params)) {
      params.push(...query.params);
    }

    // HAVING
    if (query.havings && query.havings.length > 0) {
      const havingClauses = [];
      for (const h of query.havings) {
        if (h.type === 'raw') {
          havingClauses.push(h.sql);
          params.push(...(h.bindings || []));
          continue;
        }

        const ALLOWED_OPERATORS = ['=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'NOT LIKE', 'IS', 'IS NOT'];
        const op = h.operator.toUpperCase();
        if (!ALLOWED_OPERATORS.includes(op)) {
          throw new Error(`Invalid operator: ${h.operator}`);
        }
        if (h.type === 'basic') {
          havingClauses.push(`${sanitizeIdentifier(h.column)} ${op} ?`);
          params.push(h.value);
        } else if (h.type === 'count') {
          const col = h.column && h.column !== '*' ? sanitizeIdentifier(h.column) : '*';
          havingClauses.push(`COUNT(${col}) ${op} ?`);
          params.push(h.value);
        }
      }
      if (havingClauses.length) {
        sql += ` HAVING ${havingClauses.join(' AND ')}`;
      }
    }

    // UNION / UNION ALL (no parens — SQLite rejects parenthesized compound operands)
    if (query.unions && query.unions.length > 0) {
      for (const u of query.unions) {
        const subTable = sanitizeIdentifier(u.table);
        const sub = this.buildSelectQuery(subTable, u.query);
        sql += ` UNION${u.all ? ' ALL' : ''} ${sub.sql}`;
        params.push(...sub.params);
      }
    }

    // ORDER BY
    if (query.orders && query.orders.length > 0) {
      const orderClauses = query.orders.map(
        order => {
          if (order.type === 'raw') {
            return order.sql;
          }
          const dir = order.direction.toUpperCase();
          if (dir !== 'ASC' && dir !== 'DESC') throw new Error(`Invalid direction: ${dir}`);
          return `${sanitizeIdentifier(order.column)} ${dir}`;
        }
      );
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // LIMIT
    if (query.limit !== null && query.limit !== undefined) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    // OFFSET
    if (query.offset !== null && query.offset !== undefined) {
      sql += ' OFFSET ?';
      params.push(query.offset);
    }

    return { sql, params };
  }

  /**
   * Build WHERE clause
   * @private
   */
  buildWhereClause(wheres) {
    if (!wheres || wheres.length === 0) {
      return { whereClause: '', params: [] };
    }

    const clauses = [];
    const params = [];
    const ALLOWED_OPERATORS = ['=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'NOT LIKE', 'IS', 'IS NOT'];

    wheres.forEach((where, index) => {
      const boolean = index === 0 ? 'WHERE' : (where.boolean || 'AND').toUpperCase();
      const col = where.type !== 'raw' ? sanitizeIdentifier(where.column) : null;

      switch (where.type) {
      case 'raw': {
        clauses.push(`${boolean} ${where.sql}`);
        if (where.bindings) {
          params.push(...where.bindings);
        }
        break;
      }

      case 'basic': {
        const op = where.operator.toUpperCase();
        if (!ALLOWED_OPERATORS.includes(op)) throw new Error(`Invalid operator: ${where.operator}`);
        if (where.value instanceof RawExpression) {
          clauses.push(`${boolean} ${col} ${op} ${where.value.value}`);
        } else {
          clauses.push(`${boolean} ${col} ${op} ?`);
          params.push(where.value);
        }
        break;
      }

      case 'in': {
        const inParts = where.values.map(v => {
          if (v instanceof RawExpression) return v.value;
          params.push(v);
          return '?';
        });
        clauses.push(`${boolean} ${col} IN (${inParts.join(', ')})`);
        break;
      }

      case 'notIn': {
        const notInParts = where.values.map(v => {
          if (v instanceof RawExpression) return v.value;
          params.push(v);
          return '?';
        });
        clauses.push(`${boolean} ${col} NOT IN (${notInParts.join(', ')})`);
        break;
      }

      case 'null':
        clauses.push(`${boolean} ${col} IS NULL`);
        break;

      case 'notNull':
        clauses.push(`${boolean} ${col} IS NOT NULL`);
        break;

      case 'between': {
        const [a, b] = where.values;
        const aSql = a instanceof RawExpression ? a.value : (params.push(a), '?');
        const bSql = b instanceof RawExpression ? b.value : (params.push(b), '?');
        clauses.push(`${boolean} ${col} BETWEEN ${aSql} AND ${bSql}`);
        break;
      }

      case 'notBetween': {
        const [a, b] = where.values;
        const aSql = a instanceof RawExpression ? a.value : (params.push(a), '?');
        const bSql = b instanceof RawExpression ? b.value : (params.push(b), '?');
        clauses.push(`${boolean} ${col} NOT BETWEEN ${aSql} AND ${bSql}`);
        break;
      }

      case 'like':
        if (where.value instanceof RawExpression) {
          clauses.push(`${boolean} ${col} LIKE ${where.value.value}`);
        } else {
          clauses.push(`${boolean} ${col} LIKE ?`);
          params.push(where.value);
        }
        break;
      }
    });

    return {
      whereClause: ' ' + clauses.join(' '),
      params
    };
  }

  /**
   * Get placeholders for SQL
   * @private
   */
  getPlaceholders(count) {
    return Array(count).fill('?').join(', ');
  }

  /**
   * Convert placeholders for specific driver
   * @private
   */
  convertToDriverPlaceholder(sql, driver = this.driver) {
    if (driver !== 'postgres' && driver !== 'postgresql') return sql;

    // Convert `?` placeholders to `$1..$N` without touching question marks
    // inside string literals, comments, dollar-quoted blocks, or PostgreSQL
    // JSONB operators (`?`, `?|`, `?&`).
    let out = '';
    let index = 1;
    let single = false;
    let double = false;
    let lineComment = false;
    let blockComment = false;
    let dollarTag = null;

    for (let i = 0; i < sql.length; i++) {
      const ch = sql[i];
      const next = sql[i + 1];

      if (lineComment) {
        out += ch;
        if (ch === '\n') lineComment = false;
        continue;
      }
      if (blockComment) {
        out += ch;
        if (ch === '*' && next === '/') { out += '/'; i++; blockComment = false; }
        continue;
      }
      if (dollarTag) {
        if (ch === '$' && sql.startsWith(dollarTag, i)) {
          out += dollarTag;
          i += dollarTag.length - 1;
          dollarTag = null;
        } else {
          out += ch;
        }
        continue;
      }
      if (single) {
        out += ch;
        if (ch === '\'') {
          if (next === '\'') { out += '\''; i++; }
          else single = false;
        }
        continue;
      }
      if (double) {
        out += ch;
        if (ch === '"') {
          if (next === '"') { out += '"'; i++; }
          else double = false;
        }
        continue;
      }

      if (ch === '-' && next === '-') { out += '--'; i++; lineComment = true; continue; }
      if (ch === '/' && next === '*') { out += '/*'; i++; blockComment = true; continue; }
      if (ch === '\'') { out += ch; single = true; continue; }
      if (ch === '"') { out += ch; double = true; continue; }
      if (ch === '$') {
        const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
        if (match) {
          dollarTag = match[0];
          out += dollarTag;
          i += dollarTag.length - 1;
          continue;
        }
      }
      if (ch === '?' && (next === '|' || next === '&' || next === '?')) {
        out += ch;
        continue;
      }
      if (ch === '?') {
        // A bare `?` is ambiguous in PostgreSQL: it is both a placeholder and
        // the JSONB "key exists" operator. Treat it as an operator when it is
        // surrounded by a value expression and a quoted/identifier operand
        // (e.g. `data ? 'key'`), otherwise as a bind placeholder.
        let p = i - 1;
        while (p >= 0 && /\s/.test(sql[p])) p--;
        let n = i + 1;
        while (n < sql.length && /\s/.test(sql[n])) n++;
        const prev = p >= 0 ? sql[p] : '';
        const nextNonSpace = n < sql.length ? sql[n] : '';
        const looksLikeJsonOperator =
          /[A-Za-z0-9_)"']/.test(prev) &&
          /['"A-Za-z0-9_$]/.test(nextNonSpace) &&
          !/[=<>!+\-*/%,(]/.test(prev);
        if (looksLikeJsonOperator) {
          out += ch;
          continue;
        }
        out += `$${index++}`;
        continue;
      }

      out += ch;
    }

    return out;
  }

  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  async close() {
    if (this._activeTxContext() || this._transactionConnection || this._sqliteInTransaction) {
      try {
        await this.rollback();
      } catch (e) {
        // Ignore rollback errors during close
      }
    }

    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    if (this.connection) {
      if (this.driver === 'sqlite') {
        await new Promise((resolve, reject) => {
          this.connection.close((err) => {
            if (err) reject(new Error(err.message || String(err)));
            else resolve();
          });
        });
      }
      this.connection = null;
    }
  }

  /**
   * Backwards-compatible alias used by CLI
   */
  async disconnect() {
    return this.close();
  }
}

module.exports = DatabaseConnection;

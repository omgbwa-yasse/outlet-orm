// Load environment variables from .env if present
require('dotenv').config();

// Lazy driver holders
let mysql;
let PgPool;
let sqlite3;

// Query log storage
let queryLog = [];
let queryLoggingEnabled = false;

const RawExpression = require('./RawExpression');

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
  // Allow only alphanumeric, underscore, dot (for table.column)
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(identifier)) {
    // Check for common SQL injection patterns
    // Note: Escape hyphen in character class to avoid range interpretation
    if (/['";]|--|\/*|\*\/|xp_|sp_|0x/i.test(identifier)) {
      throw new Error(`Potentially dangerous SQL identifier: ${identifier}`);
    }
  }
  return identifier;
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
      params: params || [],
      duration,
      timestamp: new Date()
    });
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

    if (driver === 'sqlite' && !resolved.database) {
      resolved.database = env.DB_FILE || env.SQLITE_DB || env.SQLITE_FILENAME || ':memory:';
    }

    this.config = resolved;
    this.driver = driver || 'mysql';
    this.connection = null;
    this.pool = null;
    this._transactionConnection = null;
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
  }

  /**
   * Connect to MySQL database with connection pool
   * @private
   */
  async connectMySQL() {
    this.pool = mysql.createPool({
      host: this.config.host || 'localhost',
      port: this.config.port || 3306,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      waitForConnections: true,
      connectionLimit: this.config.connectionLimit,
      queueLimit: 0
    });
  }

  /**
   * Connect to PostgreSQL database with connection pool
   * @private
   */
  async connectPostgreSQL() {
    this.pool = new PgPool({
      host: this.config.host || 'localhost',
      port: this.config.port || 5432,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      max: this.config.connectionLimit
    });
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
          if (err) reject(new Error(err.message || String(err)));
          else resolve();
        }
      );
    });
  }

  // ==================== Transactions ====================

  /**
   * Begin a transaction
   * @returns {Promise<void>}
   */
  async beginTransaction() {
    await this.connect();

    switch (this.driver) {
    case 'mysql':
      this._transactionConnection = await this.pool.getConnection();
      await this._transactionConnection.beginTransaction();
      break;

    case 'postgres':
    case 'postgresql':
      this._transactionConnection = await this.pool.connect();
      await this._transactionConnection.query('BEGIN');
      break;

    case 'sqlite':
      await new Promise((resolve, reject) => {
        this.connection.run('BEGIN TRANSACTION', (err) => {
          if (err) reject(new Error(err.message || String(err)));
          else resolve();
        });
      });
      break;
    }
  }

  /**
   * Commit the current transaction
   * @returns {Promise<void>}
   */
  async commit() {
    switch (this.driver) {
    case 'mysql':
      if (this._transactionConnection) {
        try {
          await this._transactionConnection.commit();
        } finally {
          this._transactionConnection.release();
          this._transactionConnection = null;
        }
      }
      break;

    case 'postgres':
    case 'postgresql':
      if (this._transactionConnection) {
        try {
          await this._transactionConnection.query('COMMIT');
        } finally {
          this._transactionConnection.release();
          this._transactionConnection = null;
        }
      }
      break;

    case 'sqlite':
      await new Promise((resolve, reject) => {
        this.connection.run('COMMIT', (err) => {
          if (err) reject(new Error(err.message || String(err)));
          else resolve();
        });
      });
      break;
    }
  }

  /**
   * Rollback the current transaction
   * @returns {Promise<void>}
   */
  async rollback() {
    switch (this.driver) {
    case 'mysql':
      if (this._transactionConnection) {
        try {
          await this._transactionConnection.rollback();
        } finally {
          this._transactionConnection.release();
          this._transactionConnection = null;
        }
      }
      break;

    case 'postgres':
    case 'postgresql':
      if (this._transactionConnection) {
        try {
          await this._transactionConnection.query('ROLLBACK');
        } finally {
          this._transactionConnection.release();
          this._transactionConnection = null;
        }
      }
      break;

    case 'sqlite':
      await new Promise((resolve, reject) => {
        this.connection.run('ROLLBACK', (err) => {
          if (err) reject(new Error(err.message || String(err)));
          else resolve();
        });
      });
      break;
    }
  }

  /**
   * Execute a callback within a transaction
   * @param {Function} callback - Async function to execute
   * @returns {Promise<any>} - Result of the callback
   */
  async transaction(callback) {
    await this.beginTransaction();
    try {
      const result = await callback(this);
      await this.commit();
      return result;
    } catch (error) {
      await this.rollback();
      throw error;
    }
  }

  // ==================== Query Methods ====================

  /**
   * Get the connection to use (transaction connection or pool)
   * @private
   */
  _getConnection() {
    return this._transactionConnection || this.pool || this.connection;
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
      result = { insertId: pgResult.rows[0]?.id, affectedRows: pgResult.rowCount };
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
   * Execute a raw query and return normalized results
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
   * Execute raw SQL (driver-native results - for migrations)
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
    if (query.columns && query.columns.length > 0 && query.columns[0] !== '*') {
      selectClause = query.columns.map(col => sanitizeIdentifier(col)).join(', ');
    }

    // DISTINCT
    const distinctClause = query.distinct ? 'DISTINCT ' : '';

    let sql = `SELECT ${distinctClause}${selectClause} FROM ${table}`;

    // JOINs
    if (query.joins && query.joins.length > 0) {
      for (const join of query.joins) {
        const joinType = (join.type || 'inner').toUpperCase();
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

    // HAVING
    if (query.havings && query.havings.length > 0) {
      const havingClauses = [];
      for (const h of query.havings) {
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
        clauses.push(`${boolean} ${col} ${op} ?`);
        params.push(where.value);
        break;
      }

      case 'in': {
        const inPlaceholders = where.values.map(() => '?').join(', ');
        clauses.push(`${boolean} ${col} IN (${inPlaceholders})`);
        params.push(...where.values);
        break;
      }

      case 'notIn': {
        const notInPlaceholders = where.values.map(() => '?').join(', ');
        clauses.push(`${boolean} ${col} NOT IN (${notInPlaceholders})`);
        params.push(...where.values);
        break;
      }

      case 'null':
        clauses.push(`${boolean} ${col} IS NULL`);
        break;

      case 'notNull':
        clauses.push(`${boolean} ${col} IS NOT NULL`);
        break;

      case 'between':
        clauses.push(`${boolean} ${col} BETWEEN ? AND ?`);
        params.push(...where.values);
        break;

      case 'like':
        clauses.push(`${boolean} ${col} LIKE ?`);
        params.push(where.value);
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
    if (driver === 'postgres' || driver === 'postgresql') {
      let index = 1;
      return sql.replace(/\?/g, () => `$${index++}`);
    }
    return sql;
  }

  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  async close() {
    if (this._transactionConnection) {
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

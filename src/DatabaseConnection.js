// Load environment variables from .env if present
require('dotenv').config();

// Lazy driver holders
let mysql;
let PgClient;
let sqlite3;

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
      if (!PgClient) ({ Client: PgClient } = require('pg'));
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
      connectionLimit: cfg.connectionLimit || coerceNumber(env.DB_POOL_MAX)
    };

    if (driver === 'sqlite' && !resolved.database) {
      resolved.database = env.DB_FILE || env.SQLITE_DB || env.SQLITE_FILENAME || ':memory:';
    }

    this.config = resolved;
    this.driver = driver || 'mysql';
    this.connection = null;
    this.pool = null;
  }

  /**
   * Connect to the database
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.connection) return;

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
   * Connect to MySQL database
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
      connectionLimit: this.config.connectionLimit || 10,
      queueLimit: 0
    });
  }

  /**
   * Connect to PostgreSQL database
   * @private
   */
  async connectPostgreSQL() {
    this.connection = new PgClient({
      host: this.config.host || 'localhost',
      port: this.config.port || 5432,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database
    });
    await this.connection.connect();
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

  /**
   * Execute a SELECT query
   * @param {string} table
   * @param {Object} query
   * @returns {Promise<Array>}
   */
  async select(table, query) {
    await this.connect();

    const { sql, params } = this.buildSelectQuery(table, query);

    switch (this.driver) {
    case 'mysql':
      return this.executeMySQLQuery(sql, params);
    case 'postgres':
    case 'postgresql':
      return this.executePostgreSQLQuery(sql, params);
    case 'sqlite':
      return this.executeSQLiteQuery(sql, params);
    }
  }

  /**
   * Insert a record
   * @param {string} table
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async insert(table, data) {
    await this.connect();

    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = this.getPlaceholders(values.length);

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`;

    switch (this.driver) {
    case 'mysql': {
      const [result] = await this.pool.execute(sql, values);
      return { insertId: result.insertId, affectedRows: result.affectedRows };
    }

    case 'postgres':
    case 'postgresql': {
      const pgResult = await this.connection.query(
        `${sql} RETURNING *`,
        values
      );
      return { insertId: pgResult.rows[0].id, affectedRows: pgResult.rowCount };
    }

    case 'sqlite':
      return new Promise((resolve, reject) => {
        this.connection.run(sql, values, function(err) {
          if (err) reject(new Error(err.message || String(err)));
          else resolve({ insertId: this.lastID, affectedRows: this.changes });
        });
      });
    }
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

    const columns = Object.keys(data[0]);
    const valuesSets = data.map(row => Object.values(row));

    const placeholderSet = `(${this.getPlaceholders(columns.length)})`;
    const allPlaceholders = valuesSets.map(() => placeholderSet).join(', ');
    const allValues = valuesSets.flat();

    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${allPlaceholders}`;

    switch (this.driver) {
    case 'mysql': {
      const [result] = await this.pool.execute(sql, allValues);
      return { affectedRows: result.affectedRows };
    }

    case 'postgres':
    case 'postgresql': {
      const pgResult = await this.connection.query(sql, allValues);
      return { affectedRows: pgResult.rowCount };
    }

    case 'sqlite':
      return new Promise((resolve, reject) => {
        this.connection.run(sql, allValues, function(err) {
          if (err) reject(new Error(err.message || String(err)));
          else resolve({ affectedRows: this.changes });
        });
      });
    }
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

    const setClauses = Object.keys(data).map(key => `${key} = ?`);
    const { whereClause, params: whereParams } = this.buildWhereClause(query.wheres || []);

    const sql = `UPDATE ${table} SET ${setClauses.join(', ')}${whereClause}`;
    const params = [...Object.values(data), ...whereParams];

    switch (this.driver) {
    case 'mysql': {
      const [result] = await this.pool.execute(
        this.convertToDriverPlaceholder(sql),
        params
      );
      return { affectedRows: result.affectedRows };
    }

    case 'postgres':
    case 'postgresql': {
      const pgResult = await this.connection.query(
        this.convertToDriverPlaceholder(sql, 'postgres'),
        params
      );
      return { affectedRows: pgResult.rowCount };
    }

    case 'sqlite':
      return new Promise((resolve, reject) => {
        this.connection.run(sql, params, function(err) {
          if (err) reject(new Error(err.message || String(err)));
          else resolve({ affectedRows: this.changes });
        });
      });
    }
  }

  /**
   * Delete records
   * @param {string} table
   * @param {Object} query
   * @returns {Promise<Object>}
   */
  async delete(table, query) {
    await this.connect();

    const { whereClause, params } = this.buildWhereClause(query.wheres || []);
    const sql = `DELETE FROM ${table}${whereClause}`;

    switch (this.driver) {
    case 'mysql': {
      const [result] = await this.pool.execute(
        this.convertToDriverPlaceholder(sql),
        params
      );
      return { affectedRows: result.affectedRows };
    }

    case 'postgres':
    case 'postgresql': {
      const pgResult = await this.connection.query(
        this.convertToDriverPlaceholder(sql, 'postgres'),
        params
      );
      return { affectedRows: pgResult.rowCount };
    }

    case 'sqlite':
      return new Promise((resolve, reject) => {
        this.connection.run(sql, params, function(err) {
          if (err) reject(new Error(err.message || String(err)));
          else resolve({ affectedRows: this.changes });
        });
      });
    }
  }

  /**
   * Atomically increment a column
   * @param {string} table
   * @param {string} column
   * @param {number} amount
   * @param {Object} query
   * @returns {Promise<{affectedRows: number}>}
   */
  async increment(table, column, query, amount = 1) {
    await this.connect();

    const { whereClause, params: whereParams } = this.buildWhereClause(query?.wheres || []);
    const sql = `UPDATE ${table} SET ${column} = ${column} + ?${whereClause}`;
    const params = [amount, ...whereParams];

    switch (this.driver) {
    case 'mysql': {
      const [result] = await this.pool.execute(this.convertToDriverPlaceholder(sql), params);
      return { affectedRows: result.affectedRows };
    }
    case 'postgres':
    case 'postgresql': {
      const res = await this.connection.query(this.convertToDriverPlaceholder(sql, 'postgres'), params);
      return { affectedRows: res.rowCount };
    }
    case 'sqlite':
      return new Promise((resolve, reject) => {
        this.connection.run(sql, params, function(err) {
          if (err) reject(new Error(err.message || String(err)));
          else resolve({ affectedRows: this.changes });
        });
      });
    }
  }

  /**
   * Atomically decrement a column
   * @param {string} table
   * @param {string} column
   * @param {number} amount
   * @param {Object} query
   * @returns {Promise<{affectedRows: number}>}
   */
  async decrement(table, column, query, amount = 1) {
    await this.connect();

    const { whereClause, params: whereParams } = this.buildWhereClause(query?.wheres || []);
    const sql = `UPDATE ${table} SET ${column} = ${column} - ?${whereClause}`;
    const params = [amount, ...whereParams];

    switch (this.driver) {
    case 'mysql': {
      const [result] = await this.pool.execute(this.convertToDriverPlaceholder(sql), params);
      return { affectedRows: result.affectedRows };
    }
    case 'postgres':
    case 'postgresql': {
      const res = await this.connection.query(this.convertToDriverPlaceholder(sql, 'postgres'), params);
      return { affectedRows: res.rowCount };
    }
    case 'sqlite':
      return new Promise((resolve, reject) => {
        this.connection.run(sql, params, function(err) {
          if (err) reject(new Error(err.message || String(err)));
          else resolve({ affectedRows: this.changes });
        });
      });
    }
  }

  /**
   * Count records
   * @param {string} table
   * @param {Object} query
   * @returns {Promise<number>}
   */
  async count(table, query) {
    await this.connect();

    const { whereClause, params } = this.buildWhereClause(query.wheres || []);
    const sql = `SELECT COUNT(*) as count FROM ${table}${whereClause}`;

    const rows = await this.executeRawQuery(sql, params);
    return rows[0].count || rows[0].COUNT || 0;
  }

  /**
   * Execute a raw query
   * @param {string} sql
   * @param {Array} params
   * @returns {Promise<Array>}
   */
  async executeRawQuery(sql, params = []) {
    await this.connect();

    switch (this.driver) {
    case 'mysql':
      return this.executeMySQLQuery(sql, params);
    case 'postgres':
    case 'postgresql':
      return this.executePostgreSQLQuery(sql, params);
    case 'sqlite':
      return this.executeSQLiteQuery(sql, params);
    }
  }

  /**
   * Execute raw SQL and return driver-native results (used by migrations)
   * @param {string} sql
   * @param {Array} params
   * @returns {Promise<any>}
   */
  async execute(sql, params = []) {
    await this.connect();
    switch (this.driver) {
    case 'mysql': {
      const [result] = await this.pool.execute(sql, params);
      return result;
    }
    case 'postgres':
    case 'postgresql': {
      const res = await this.connection.query(this.convertToDriverPlaceholder(sql, 'postgres'), params);
      return res.rows ?? res;
    }
    case 'sqlite':
      return new Promise((resolve, reject) => {
        // Choose all/run based on query type
        const isSelect = /^\s*select/i.test(sql);
        if (isSelect) {
          this.connection.all(sql, params, (err, rows) => {
            if (err) reject(new Error(err.message || String(err)));
            else resolve(rows);
          });
        } else {
          this.connection.run(sql, params, function(err) {
            if (err) reject(new Error(err.message || String(err)));
            else resolve({ changes: this.changes, lastID: this.lastID });
          });
        }
      });
    }
  }

  /**
   * Execute MySQL query
   * @private
   */
  async executeMySQLQuery(sql, params) {
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }

  /**
   * Execute PostgreSQL query
   * @private
   */
  async executePostgreSQLQuery(sql, params) {
    const result = await this.connection.query(
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

  /**
   * Build SELECT query
   * @private
   */
  buildSelectQuery(table, query) {
    const distinct = query.distinct ? 'DISTINCT ' : '';
    const columns = query.columns && query.columns.length > 0
      ? query.columns.join(', ')
      : '*';

    let sql = `SELECT ${distinct}${columns} FROM ${table}`;
    // JOINS
    if (query.joins && query.joins.length > 0) {
      const joinClauses = query.joins.map(j => {
        const type = (j.type === 'left' ? 'LEFT JOIN' : 'INNER JOIN');
        const op = j.operator || '=';
        return ` ${type} ${j.table} ON ${j.first} ${op} ${j.second}`;
      }).join('');
      sql += joinClauses;
    }
    let params = [];

    // WHERE clauses
    if (query.wheres && query.wheres.length > 0) {
      const { whereClause, params: whereParams } = this.buildWhereClause(query.wheres);
      sql += whereClause;
      params = [...params, ...whereParams];
    }

    // GROUP BY
    if (query.groupBys && query.groupBys.length > 0) {
      sql += ` GROUP BY ${query.groupBys.join(', ')}`;
    }

    // HAVING
    if (query.havings && query.havings.length > 0) {
      const havingClauses = [];
      for (const h of query.havings) {
        if (h.type === 'basic') {
          havingClauses.push(`${h.column} ${h.operator} ?`);
          params.push(h.value);
        } else if (h.type === 'count') {
          const col = h.column && h.column !== '*' ? h.column : '*';
          havingClauses.push(`COUNT(${col}) ${h.operator} ?`);
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
        order => `${order.column} ${order.direction.toUpperCase()}`
      );
      sql += ` ORDER BY ${orderClauses.join(', ')}`;
    }

    // LIMIT
    if (query.limit !== null && query.limit !== undefined) {
      sql += ` LIMIT ${query.limit}`;
    }

    // OFFSET
    if (query.offset !== null && query.offset !== undefined) {
      sql += ` OFFSET ${query.offset}`;
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

    wheres.forEach((where, index) => {
      const boolean = index === 0 ? 'WHERE' : (where.boolean || 'AND').toUpperCase();

      switch (where.type) {
      case 'basic':
        clauses.push(`${boolean} ${where.column} ${where.operator} ?`);
        params.push(where.value);
        break;

      case 'in': {
        const inPlaceholders = where.values.map(() => '?').join(', ');
        clauses.push(`${boolean} ${where.column} IN (${inPlaceholders})`);
        params.push(...where.values);
        break;
      }

      case 'notIn': {
        const notInPlaceholders = where.values.map(() => '?').join(', ');
        clauses.push(`${boolean} ${where.column} NOT IN (${notInPlaceholders})`);
        params.push(...where.values);
        break;
      }

      case 'null':
        clauses.push(`${boolean} ${where.column} IS NULL`);
        break;

      case 'notNull':
        clauses.push(`${boolean} ${where.column} IS NOT NULL`);
        break;

      case 'between':
        clauses.push(`${boolean} ${where.column} BETWEEN ? AND ?`);
        params.push(...where.values);
        break;

      case 'like':
        clauses.push(`${boolean} ${where.column} LIKE ?`);
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
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    if (this.connection) {
      if (this.driver === 'postgres' || this.driver === 'postgresql') {
        await this.connection.end();
      } else if (this.driver === 'sqlite') {
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

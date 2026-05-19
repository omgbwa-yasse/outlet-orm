/**
 * Schema Builder
 * Provides a fluent interface for creating and modifying database tables
 */

const ViewBuilder = require('./ViewBuilder');
const TriggerBuilder = require('./TriggerBuilder');
const ProcedureBuilder = require('./ProcedureBuilder');
const { UnsupportedCapabilityError } = require('../Errors/UnsupportedCapabilityError');

function quoteIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('Invalid SQL identifier');
  }
  // Strict allowlist: only alphanumeric and underscore — no fallback, no blocklist.
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error('Invalid SQL identifier');
  }
  return `\`${identifier}\``;
}

/**
 * Quote a SQL identifier using driver-appropriate characters.
 * MySQL → backtick, PostgreSQL / SQLite → double-quote.
 * @param {string} identifier
 * @param {string} driver
 * @returns {string}
 */
function quoteId(identifier, driver) {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('Invalid SQL identifier');
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error('Invalid SQL identifier');
  }
  return driver === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
}

class Schema {
  constructor(connection) {
    this.connection = connection;
  }

  /**
   * Create a new table
   * @param {string} tableName
   * @param {Function} callback
   */
  async create(tableName, callback) {
    const blueprint = new Blueprint(tableName, this.connection);
    callback(blueprint);
    const statements = blueprint.toSql('create');

    for (const sql of statements) {
      await this.connection.execute(sql);
    }
    console.log(`Table '${tableName}' created successfully`);
  }

  /**
   * Modify an existing table
   * @param {string} tableName
   * @param {Function} callback
   */
  async table(tableName, callback) {
    const blueprint = new Blueprint(tableName, this.connection);
    blueprint.isModifying = true;
    callback(blueprint);
    const statements = blueprint.toSql('alter');

    for (const sql of statements) {
      await this.connection.execute(sql);
    }
    console.log(`Table '${tableName}' modified successfully`);
  }

  /**
   * Rename a table
   * @param {string} from
   * @param {string} to
   */
  async rename(from, to) {
    const driver = this.connection.config.driver;
    let sql;

    switch (driver) {
    case 'mysql':
      sql = `RENAME TABLE ${quoteIdentifier(from)} TO ${quoteIdentifier(to)}`;
      break;
    case 'postgres':
    case 'postgresql':
    case 'sqlite':
      sql = `ALTER TABLE ${quoteIdentifier(from)} RENAME TO ${quoteIdentifier(to)}`;
      break;
    default:
      throw new Error(`Unsupported driver: ${driver}`);
    }

    await this.connection.execute(sql);
    console.log(`Table '${from}' renamed to '${to}'`);
  }

  /**
   * Drop a table
   * @param {string} tableName
   */
  async drop(tableName) {
    const sql = `DROP TABLE ${quoteIdentifier(tableName)}`;
    await this.connection.execute(sql);
    console.log(`Table '${tableName}' dropped successfully`);
  }

  /**
   * Drop a table if it exists
   * @param {string} tableName
   */
  async dropIfExists(tableName) {
    const sql = `DROP TABLE IF EXISTS ${quoteIdentifier(tableName)}`;
    await this.connection.execute(sql);
    console.log(`Table '${tableName}' dropped if existed`);
  }

  /**
   * Check if a table exists
   * @param {string} tableName
   * @returns {Promise<boolean>}
   */
  async hasTable(tableName) {
    const driver = this.connection.config.driver;
    const RawExpression = require('../RawExpression');
    let rows;

    switch (driver) {
    case 'mysql':
      rows = await this.connection
        .from('information_schema.tables')
        .selectRaw('COUNT(1) AS cnt')
        .where('table_schema', new RawExpression('DATABASE()'))
        .where('table_name', tableName)
        .get();
      break;
    case 'postgres':
    case 'postgresql':
      rows = await this.connection
        .from('information_schema.tables')
        .selectRaw('COUNT(1) AS cnt')
        .where('table_schema', 'public')
        .where('table_name', tableName)
        .get();
      break;
    case 'sqlite':
      rows = await this.connection
        .from('sqlite_master')
        .selectRaw('COUNT(1) AS cnt')
        .where('type', 'table')
        .where('name', tableName)
        .get();
      break;
    default:
      throw new Error(`Unsupported driver: ${driver}`);
    }

    return Number(rows[0]?.cnt ?? 0) > 0;
  }

  /**
   * Check if a column exists in a table
   * @param {string} tableName
   * @param {string} columnName
   * @returns {Promise<boolean>}
   */
  async hasColumn(tableName, columnName) {
    const driver = this.connection.config.driver;
    const RawExpression = require('../RawExpression');
    let rows;

    switch (driver) {
    case 'mysql':
      rows = await this.connection
        .from('information_schema.columns')
        .selectRaw('COUNT(1) AS cnt')
        .where('table_schema', new RawExpression('DATABASE()'))
        .where('table_name', tableName)
        .where('column_name', columnName)
        .get();
      break;
    case 'postgres':
    case 'postgresql':
      rows = await this.connection
        .from('information_schema.columns')
        .selectRaw('COUNT(1) AS cnt')
        .where('table_schema', 'public')
        .where('table_name', tableName)
        .where('column_name', columnName)
        .get();
      break;
    case 'sqlite': {
      const escapedTableName = String(tableName).replace(/'/g, "''");
      rows = await this.connection
        .from(new RawExpression(`pragma_table_info('${escapedTableName}')`))
        .selectRaw('COUNT(1) AS cnt')
        .where('name', columnName)
        .get();
      break;
    }
    default:
      throw new Error(`Unsupported driver: ${driver}`);
    }

    return Number(rows[0]?.cnt ?? 0) > 0;
  }

  async tableExists(tableName) {
    return this.hasTable(tableName);
  }

  async columnExists(tableName, columnName) {
    return this.hasColumn(tableName, columnName);
  }

  async listTables() {
    const driver = this.connection.config.driver;
    const RawExpression = require('../RawExpression');
    let rows;

    switch (driver) {
    case 'mysql':
      rows = await this.connection
        .from('information_schema.tables')
        .selectRaw('table_name AS name')
        .where('table_schema', new RawExpression('DATABASE()'))
        .get();
      break;
    case 'postgres':
    case 'postgresql':
      rows = await this.connection
        .from('information_schema.tables')
        .selectRaw('table_name AS name')
        .where('table_schema', 'public')
        .get();
      break;
    case 'sqlite':
      rows = await this.connection
        .from('sqlite_master')
        .select('name')
        .where('type', 'table')
        .whereRaw("name NOT LIKE 'sqlite_%'")
        .orderBy('name')
        .get();
      break;
    default:
      throw new Error(`listTables() is not supported for driver: ${driver}`);
    }

    return rows.map(r => r.name);
  }

  // ==================== Views ====================

  /**
   * Create a view, optionally replacing an existing one.
   * @param {string}  name      - View name
   * @param {string}  selectSql - The SELECT statement body (no parameters — embed literals only)
   * @param {Object}  [options]
   * @param {boolean} [options.replace=true] - Use CREATE OR REPLACE (MySQL/PG) or DROP+CREATE (SQLite)
   * @returns {Promise<void>}
   */
  async createView(name, selectSql, options = {}) {
    const driver = this.connection.driver;
    const replace = options.replace !== false;
    const statements = ViewBuilder.buildCreate(name, selectSql, replace, driver);
    for (const sql of statements) {
      await this.connection.execute(sql);
    }
  }

  /**
   * Create or replace a view (shorthand for createView with replace:true).
   * @param {string} name
   * @param {string} selectSql
   * @returns {Promise<void>}
   */
  async createOrReplaceView(name, selectSql) {
    return this.createView(name, selectSql, { replace: true });
  }

  /**
   * Drop a view. Throws if the view does not exist.
   * @param {string} name
   * @returns {Promise<void>}
   */
  async dropView(name) {
    const driver = this.connection.driver;
    await this.connection.execute(`DROP VIEW ${quoteId(name, driver)}`);
  }

  /**
   * Drop a view if it exists (no-op otherwise).
   * @param {string} name
   * @returns {Promise<void>}
   */
  async dropViewIfExists(name) {
    const driver = this.connection.driver;
    await this.connection.execute(`DROP VIEW IF EXISTS ${quoteId(name, driver)}`);
  }

  /**
   * Check whether a view with the given name exists.
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  async hasView(name) {
    const driver = this.connection.driver;
    let sql, params;

    switch (driver) {
    case 'mysql':
      sql = 'SELECT COUNT(*) as count FROM information_schema.views WHERE table_schema = DATABASE() AND table_name = ?';
      params = [name];
      break;
    case 'postgres':
      sql = 'SELECT COUNT(*) as count FROM information_schema.views WHERE table_schema = \'public\' AND table_name = $1';
      params = [name];
      break;
    case 'sqlite':
      sql = 'SELECT COUNT(*) as count FROM sqlite_master WHERE type = \'view\' AND name = ?';
      params = [name];
      break;
    default:
      throw new Error(`Unsupported driver: ${driver}`);
    }

    const result = await this.connection.execute(sql, params);
    const count = result[0]?.count ?? result[0]?.COUNT ?? 0;
    return Number(count) > 0;
  }

  /**
   * Return the names of all views in the current schema/database.
   * @returns {Promise<string[]>}
   */
  async getViews() {
    const driver = this.connection.driver;
    let sql;

    switch (driver) {
    case 'mysql':
      sql = 'SELECT table_name FROM information_schema.views WHERE table_schema = DATABASE() ORDER BY table_name';
      break;
    case 'postgres':
      sql = 'SELECT table_name FROM information_schema.views WHERE table_schema = \'public\' ORDER BY table_name';
      break;
    case 'sqlite':
      sql = 'SELECT name FROM sqlite_master WHERE type = \'view\' ORDER BY name';
      break;
    default:
      throw new Error(`Unsupported driver: ${driver}`);
    }

    const rows = await this.connection.execute(sql);
    return rows.map(row => row.table_name ?? row.name);
  }

  // ==================== Triggers ====================

  /**
   * Create a database trigger.
   * @param {Object} options
   * @param {string} options.name     - Trigger name
   * @param {string} options.table    - Target table (or view for INSTEAD OF)
   * @param {string} options.timing   - 'BEFORE' | 'AFTER' | 'INSTEAD OF'
   * @param {string} options.event    - 'INSERT' | 'UPDATE' | 'DELETE'
   * @param {string} [options.forEach='ROW'] - 'ROW' | 'STATEMENT'
   * @param {string} options.body     - Trigger body (BEGIN … END for MySQL; SQLite statement list)
   * @returns {Promise<void>}
   */
  async createTrigger(options) {
    const driver = this.connection.driver;

    // PG collision guard: if a trigger function already exists with this name, abort
    if (driver === 'postgres') {
      const fnName = options.name + '_fn';
      const fnExists = await this.hasFunction(fnName);
      if (fnExists) {
        throw new Error(
          `A PostgreSQL trigger function named "${fnName}" already exists. ` +
          'Drop it first or choose a different trigger name.'
        );
      }
    }

    const statements = TriggerBuilder.buildCreate(options, driver);
    for (const sql of statements) {
      await this.connection.execute(sql);
    }
  }

  /**
   * Drop a trigger. Throws if it does not exist.
   * PostgreSQL also drops the associated trigger function ({name}_fn).
   * @param {string} name  - Trigger name
   * @param {string} table - Table the trigger belongs to
   * @returns {Promise<void>}
   */
  async dropTrigger(name, table) {
    const driver = this.connection.driver;
    const qName  = quoteId(name,  driver);
    const qTable = quoteId(table, driver);

    switch (driver) {
    case 'mysql':
      await this.connection.execute(`DROP TRIGGER ${qTable}.${qName}`);
      break;
    case 'postgres':
      await this.connection.execute(`DROP TRIGGER ${qName} ON ${qTable}`);
      await this.connection.execute(`DROP FUNCTION IF EXISTS ${quoteId(name + '_fn', driver)}()`);
      break;
    case 'sqlite':
      await this.connection.execute(`DROP TRIGGER ${qName}`);
      break;
    default:
      throw new Error(`Unsupported driver: ${driver}`);
    }
  }

  /**
   * Drop a trigger if it exists (no-op otherwise).
   * PostgreSQL also drops the associated trigger function ({name}_fn).
   * @param {string} name
   * @param {string} table
   * @returns {Promise<void>}
   */
  async dropTriggerIfExists(name, table) {
    const driver = this.connection.driver;
    const qName  = quoteId(name,  driver);
    const qTable = quoteId(table, driver);

    switch (driver) {
    case 'mysql':
      await this.connection.execute(`DROP TRIGGER IF EXISTS ${qTable}.${qName}`);
      break;
    case 'postgres':
      await this.connection.execute(`DROP TRIGGER IF EXISTS ${qName} ON ${qTable}`);
      await this.connection.execute(`DROP FUNCTION IF EXISTS ${quoteId(name + '_fn', driver)}()`);
      break;
    case 'sqlite':
      await this.connection.execute(`DROP TRIGGER IF EXISTS ${qName}`);
      break;
    default:
      throw new Error(`Unsupported driver: ${driver}`);
    }
  }

  /**
   * Check whether a trigger with the given name exists on the given table.
   * @param {string} name
   * @param {string} table
   * @returns {Promise<boolean>}
   */
  async hasTrigger(name, table) {
    const driver = this.connection.driver;
    let sql, params;

    switch (driver) {
    case 'mysql':
      sql = 'SELECT COUNT(*) as count FROM information_schema.triggers WHERE event_object_schema = DATABASE() AND trigger_name = ? AND event_object_table = ?';
      params = [name, table];
      break;
    case 'postgres':
      sql = 'SELECT COUNT(*) as count FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE t.tgname = $1 AND c.relname = $2';
      params = [name, table];
      break;
    case 'sqlite':
      sql = 'SELECT COUNT(*) as count FROM sqlite_master WHERE type = \'trigger\' AND name = ? AND tbl_name = ?';
      params = [name, table];
      break;
    default:
      throw new Error(`Unsupported driver: ${driver}`);
    }

    const result = await this.connection.execute(sql, params);
    const count = result[0]?.count ?? result[0]?.COUNT ?? 0;
    return Number(count) > 0;
  }

  /**
   * Return the names of all triggers, optionally filtered by table.
   * @param {string} [table] - If provided, list only triggers for this table
   * @returns {Promise<string[]>}
   */
  async getTriggers(table) {
    const driver = this.connection.driver;
    let sql, params = [];

    switch (driver) {
    case 'mysql':
      if (table) {
        sql = 'SELECT trigger_name FROM information_schema.triggers WHERE event_object_schema = DATABASE() AND event_object_table = ? ORDER BY trigger_name';
        params = [table];
      } else {
        sql = 'SELECT trigger_name FROM information_schema.triggers WHERE event_object_schema = DATABASE() ORDER BY trigger_name';
      }
      break;
    case 'postgres':
      if (table) {
        sql = 'SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE NOT t.tgisinternal AND c.relname = $1 ORDER BY t.tgname';
        params = [table];
      } else {
        sql = 'SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON t.tgrelid = c.oid WHERE NOT t.tgisinternal ORDER BY t.tgname';
      }
      break;
    case 'sqlite':
      if (table) {
        sql = 'SELECT name FROM sqlite_master WHERE type = \'trigger\' AND tbl_name = ? ORDER BY name';
        params = [table];
      } else {
        sql = 'SELECT name FROM sqlite_master WHERE type = \'trigger\' ORDER BY name';
      }
      break;
    default:
      throw new Error(`Unsupported driver: ${driver}`);
    }

    const rows = await this.connection.execute(sql, params);
    return rows.map(row => row.trigger_name ?? row.tgname ?? row.name);
  }

  // ==================== Stored Procedures ====================

  /**
   * Create a stored procedure (MySQL / PostgreSQL only).
   * @param {string} name
   * @param {string} params - Parameter list string (raw SQL, e.g. 'IN x INT, IN y INT')
   * @param {string} body   - Procedure body
   * @param {Object} [options]
   * @param {string} [options.language='plpgsql'] - PG only: procedural language
   * @returns {Promise<void>}
   */
  async createProcedure(name, params, body, options = {}) {
    const driver = this.connection.driver;
    const sql = ProcedureBuilder.buildCreateProcedure({ name, params, body, ...options }, driver);
    await this.connection.execute(sql);
  }

  /**
   * Drop a stored procedure. Throws if it does not exist.
   * @param {string} name
   * @returns {Promise<void>}
   */
  async dropProcedure(name) {
    const driver = this.connection.driver;
    if (driver === 'sqlite') {
      throw new UnsupportedCapabilityError('sqlite', 'stored procedures');
    }
    const qName = quoteId(name, driver);
    if (driver === 'mysql') {
      await this.connection.execute(`DROP PROCEDURE ${qName}`);
    } else {
      await this.connection.execute(`DROP PROCEDURE ${qName}`);
    }
  }

  /**
   * Drop a stored procedure if it exists.
   * @param {string} name
   * @returns {Promise<void>}
   */
  async dropProcedureIfExists(name) {
    const driver = this.connection.driver;
    if (driver === 'sqlite') {
      throw new UnsupportedCapabilityError('sqlite', 'stored procedures');
    }
    const qName = quoteId(name, driver);
    await this.connection.execute(`DROP PROCEDURE IF EXISTS ${qName}`);
  }

  /**
   * Check whether a stored procedure with the given name exists.
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  async hasProcedure(name) {
    const driver = this.connection.driver;
    if (driver === 'sqlite') {
      throw new UnsupportedCapabilityError('sqlite', 'stored procedures');
    }
    let sql, params;

    if (driver === 'mysql') {
      sql = 'SELECT COUNT(*) as count FROM information_schema.routines WHERE routine_type = \'PROCEDURE\' AND routine_schema = DATABASE() AND routine_name = ?';
      params = [name];
    } else {
      // PostgreSQL
      const pgVersion = this.connection._pgVersionNum ?? 110000;
      if (pgVersion < 110000) {
        // Stored procedures (CALL) did not exist before PG 11
        return false;
      }
      sql = 'SELECT COUNT(*) as count FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.prokind = \'p\' AND n.nspname = \'public\' AND p.proname = $1';
      params = [name];
    }

    const result = await this.connection.execute(sql, params);
    const count = result[0]?.count ?? result[0]?.COUNT ?? 0;
    return Number(count) > 0;
  }

  // ==================== Stored Functions ====================

  /**
   * Create a stored function (MySQL / PostgreSQL only).
   * @param {string} name
   * @param {string} params  - Parameter list string
   * @param {string} body    - Function body
   * @param {Object} [options]
   * @param {string} [options.returns]             - Return type (required for MySQL)
   * @param {string} [options.language='plpgsql']  - PG: procedural language
   * @returns {Promise<void>}
   */
  async createFunction(name, params, body, options = {}) {
    const driver = this.connection.driver;
    const sql = ProcedureBuilder.buildCreateFunction({ name, params, body, ...options }, driver);
    await this.connection.execute(sql);
  }

  /**
   * Drop a stored function. Throws if it does not exist.
   * @param {string} name
   * @returns {Promise<void>}
   */
  async dropFunction(name) {
    const driver = this.connection.driver;
    if (driver === 'sqlite') {
      throw new UnsupportedCapabilityError('sqlite', 'stored functions');
    }
    const qName = quoteId(name, driver);
    await this.connection.execute(`DROP FUNCTION ${qName}`);
  }

  /**
   * Drop a stored function if it exists.
   * @param {string} name
   * @returns {Promise<void>}
   */
  async dropFunctionIfExists(name) {
    const driver = this.connection.driver;
    if (driver === 'sqlite') {
      throw new UnsupportedCapabilityError('sqlite', 'stored functions');
    }
    const qName = quoteId(name, driver);
    await this.connection.execute(`DROP FUNCTION IF EXISTS ${qName}`);
  }

  /**
   * Check whether a stored function with the given name exists.
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  async hasFunction(name) {
    const driver = this.connection.driver;
    if (driver === 'sqlite') {
      throw new UnsupportedCapabilityError('sqlite', 'stored functions');
    }
    let sql, params;

    if (driver === 'mysql') {
      sql = 'SELECT COUNT(*) as count FROM information_schema.routines WHERE routine_type = \'FUNCTION\' AND routine_schema = DATABASE() AND routine_name = ?';
      params = [name];
    } else {
      // PostgreSQL
      const pgVersion = this.connection._pgVersionNum ?? 110000;
      if (pgVersion >= 110000) {
        sql = 'SELECT COUNT(*) as count FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.prokind = \'f\' AND n.nspname = \'public\' AND p.proname = $1';
      } else {
        sql = 'SELECT COUNT(*) as count FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE NOT p.proisagg AND NOT p.proiswindow AND n.nspname = \'public\' AND p.proname = $1';
      }
      params = [name];
    }

    const result = await this.connection.execute(sql, params);
    const count = result[0]?.count ?? result[0]?.COUNT ?? 0;
    return Number(count) > 0;
  }
}

/**
 * Blueprint - Represents a table structure
 */
class Blueprint {
  constructor(tableName, connection) {
    this.tableName = tableName;
    this.connection = connection;
    this.columns = [];
    this.commands = [];
    this.isModifying = false;
    this._checkCount = 0;
  }

  /**
   * Create an auto-incrementing ID column
   */
  id(columnName = 'id') {
    return this.bigIncrements(columnName);
  }

  /**
   * Create a big integer auto-increment column
   */
  bigIncrements(columnName) {
    const column = new ColumnDefinition(columnName, 'BIGINT');
    column.autoIncrement().unsigned().primary();
    this.columns.push(column);
    return column;
  }

  /**
   * Create a string column
   */
  string(columnName, length = 255) {
    const column = new ColumnDefinition(columnName, 'VARCHAR', { length });
    this.columns.push(column);
    return column;
  }

  /**
   * Create a text column
   */
  text(columnName) {
    const column = new ColumnDefinition(columnName, 'TEXT');
    this.columns.push(column);
    return column;
  }

  /**
   * Create an integer column
   */
  integer(columnName) {
    const column = new ColumnDefinition(columnName, 'INT');
    this.columns.push(column);
    return column;
  }

  /**
   * Create a big integer column
   */
  bigInteger(columnName) {
    const column = new ColumnDefinition(columnName, 'BIGINT');
    this.columns.push(column);
    return column;
  }

  /**
   * Create a boolean column
   */
  boolean(columnName) {
    const column = new ColumnDefinition(columnName, 'TINYINT', { length: 1 });
    this.columns.push(column);
    return column;
  }

  /**
   * Create a date column
   */
  date(columnName) {
    const column = new ColumnDefinition(columnName, 'DATE');
    this.columns.push(column);
    return column;
  }

  /**
   * Create a datetime column
   */
  datetime(columnName) {
    const column = new ColumnDefinition(columnName, 'DATETIME');
    this.columns.push(column);
    return column;
  }

  /**
   * Create a timestamp column
   */
  timestamp(columnName) {
    const column = new ColumnDefinition(columnName, 'TIMESTAMP');
    this.columns.push(column);
    return column;
  }

  /**
   * Create timestamps (created_at, updated_at)
   */
  timestamps(nullable = false) {
    const createdAt = this.timestamp('created_at');
    const updatedAt = this.timestamp('updated_at');

    if (nullable) {
      createdAt.nullable();
      updatedAt.nullable();
    } else {
      createdAt.useCurrent();
      updatedAt.useCurrent().useCurrentOnUpdate();
    }

    return this;
  }

  /**
   * Create a soft delete column (deleted_at)
   */
  softDeletes(columnName = 'deleted_at') {
    return this.timestamp(columnName).nullable();
  }

  /**
   * Create a decimal column
   */
  decimal(columnName, precision = 8, scale = 2) {
    const column = new ColumnDefinition(columnName, 'DECIMAL', { precision, scale });
    this.columns.push(column);
    return column;
  }

  /**
   * Create a float column
   */
  float(columnName, precision = 8, scale = 2) {
    const column = new ColumnDefinition(columnName, 'FLOAT', { precision, scale });
    this.columns.push(column);
    return column;
  }

  /**
   * Create a JSON column
   */
  json(columnName) {
    const column = new ColumnDefinition(columnName, 'JSON');
    this.columns.push(column);
    return column;
  }

  /**
   * Create an enum column
   */
  enum(columnName, values) {
    const column = new ColumnDefinition(columnName, 'ENUM', { values });
    this.columns.push(column);
    return column;
  }

  /**
   * Create a UUID column
   */
  uuid(columnName) {
    const column = new ColumnDefinition(columnName, 'CHAR', { length: 36 });
    this.columns.push(column);
    return column;
  }

  /**
   * Create a foreign ID column
   */
  foreignId(columnName) {
    const column = new ColumnDefinition(columnName, 'BIGINT');
    column.unsigned();
    this.columns.push(column);

    column.constrained = (table = null) => {
      const foreignKey = this.foreign(columnName);
      return foreignKey.constrained(table);
    };

    return column;
  }

  /**
   * Add a foreign key constraint
   */
  foreign(columnName) {
    const foreignKey = new ForeignKeyDefinition(columnName);
    this.commands.push({ type: 'foreign', foreignKey });
    return foreignKey;
  }

  /**
   * Add an index
   */
  index(columns, indexName = null) {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.commands.push({
      type: 'index',
      columns: cols,
      name: indexName || `${this.tableName}_${cols.join('_')}_index`
    });
    return this;
  }

  /**
   * Add a unique index
   */
  unique(columns, indexName = null) {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.commands.push({
      type: 'unique',
      columns: cols,
      name: indexName || `${this.tableName}_${cols.join('_')}_unique`
    });
    return this;
  }

  /**
   * Add a fulltext index
   */
  fullText(columns, indexName = null) {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.commands.push({
      type: 'fulltext',
      columns: cols,
      name: indexName || `${this.tableName}_${cols.join('_')}_fulltext`
    });
    return this;
  }

  /**
   * Drop a column
   */
  dropColumn(columns) {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.commands.push({ type: 'dropColumn', columns: cols });
    return this;
  }

  /**
   * Drop a foreign key
   */
  dropForeign(columns) {
    const cols = Array.isArray(columns) ? columns : [columns];
    this.commands.push({ type: 'dropForeign', columns: cols });
    return this;
  }

  /**
   * Drop an index
   */
  dropIndex(columns) {
    const cols = Array.isArray(columns) ? columns : [columns];
    const indexName = `${this.tableName}_${cols.join('_')}_index`;
    this.commands.push({ type: 'dropIndex', name: indexName });
    return this;
  }

  /**
   * Drop timestamps
   */
  dropTimestamps() {
    return this.dropColumn(['created_at', 'updated_at']);
  }

  /**
   * Rename a column
   */
  renameColumn(from, to) {
    this.commands.push({ type: 'renameColumn', from, to });
    return this;
  }

  /**
   * Generate SQL statements
   * @param {string} action - 'create' or 'alter'
   * @returns {string[]} Array of SQL statements
   */
  toSql(action) {
    if (action === 'create') {
      return [this.toCreateSql()];
    }

    if (action === 'alter') {
      return this.toAlterSql();
    }

    return [];
  }

  /**
   * Generate CREATE TABLE SQL
   * @returns {string} SQL statement
   */
  toCreateSql() {
    const driver = this.connection.config.driver;
    const columnDefinitions = this.columns.map(col => col.toSql(driver)).join(',\n  ');
    const constraints = this.getConstraints();

    let sql = `CREATE TABLE ${quoteIdentifier(this.tableName)} (\n  ${columnDefinitions}`;

    if (constraints) {
      sql += `,\n  ${constraints}`;
    }

    sql += '\n)';

    return sql;
  }

  /**
   * Generate ALTER TABLE SQL
   * @returns {string[]} Array of SQL statements
   */
  toAlterSql() {
    const statements = [];

    // Add new columns
    const driver = this.connection.config.driver;
    for (const column of this.columns) {
      let sql = `ALTER TABLE ${quoteIdentifier(this.tableName)} ADD COLUMN ${column.toSql(driver)}`;
      statements.push(sql);
    }

    // Process commands
    for (const command of this.commands) {
      switch (command.type) {
      case 'dropColumn':
        for (const col of command.columns) {
          statements.push(`ALTER TABLE ${quoteIdentifier(this.tableName)} DROP COLUMN ${quoteIdentifier(col)}`);
        }
        break;

      case 'renameColumn':
        if (driver === 'mysql') {
          statements.push(`ALTER TABLE ${quoteIdentifier(this.tableName)} RENAME COLUMN ${quoteIdentifier(command.from)} TO ${quoteIdentifier(command.to)}`);
        } else {
          statements.push(`ALTER TABLE ${quoteIdentifier(this.tableName)} RENAME COLUMN ${quoteIdentifier(command.from)} TO ${quoteIdentifier(command.to)}`);
        }
        break;

      case 'foreign': {
        const fk = command.foreignKey;
        statements.push(
          `ALTER TABLE ${quoteIdentifier(this.tableName)} ADD CONSTRAINT ${quoteIdentifier(fk._customName ?? fk._autoName)} ` +
            `FOREIGN KEY (${quoteIdentifier(fk.column)}) REFERENCES ${quoteIdentifier(fk._ref.table)}(${quoteIdentifier(fk._ref.column)})` +
            (fk._onDelete ? ` ON DELETE ${fk._onDelete}` : '') +
            (fk._onUpdate ? ` ON UPDATE ${fk._onUpdate}` : '')
        );
        break;
      }

      case 'dropForeign': {
        const fkName = `${this.tableName}_${command.columns.join('_')}_foreign`;
        statements.push(`ALTER TABLE ${quoteIdentifier(this.tableName)} DROP FOREIGN KEY ${quoteIdentifier(fkName)}`);
        break;
      }

      case 'index':
        statements.push(
          `ALTER TABLE ${quoteIdentifier(this.tableName)} ADD INDEX ${quoteIdentifier(command.name)} (${command.columns.map(c => quoteIdentifier(c)).join(', ')})`
        );
        break;

      case 'unique':
        statements.push(
          `ALTER TABLE ${quoteIdentifier(this.tableName)} ADD UNIQUE ${quoteIdentifier(command.name)} (${command.columns.map(c => quoteIdentifier(c)).join(', ')})`
        );
        break;

      case 'fulltext':
        statements.push(
          `ALTER TABLE ${quoteIdentifier(this.tableName)} ADD FULLTEXT ${quoteIdentifier(command.name)} (${command.columns.map(c => quoteIdentifier(c)).join(', ')})`
        );
        break;

      case 'dropIndex':
        statements.push(`ALTER TABLE ${quoteIdentifier(this.tableName)} DROP INDEX ${quoteIdentifier(command.name)}`);
        break;

      case 'check': {
        if (driver === 'sqlite') {
          throw new UnsupportedCapabilityError('sqlite', 'ALTER TABLE … ADD CONSTRAINT CHECK');
        }
        const tbl = quoteId(this.tableName, driver);
        const cName = command.constraintDef.resolvedName();
        const qName = quoteId(cName, driver);
        statements.push(`ALTER TABLE ${tbl} ADD CONSTRAINT ${qName} CHECK (${command.constraintDef.expression})`);
        break;
      }

      case 'dropCheck': {
        if (driver === 'sqlite') {
          throw new UnsupportedCapabilityError('sqlite', 'ALTER TABLE … DROP CONSTRAINT');
        }
        const tbl = quoteId(this.tableName, driver);
        const qName = quoteId(command.name, driver);
        statements.push(driver === 'mysql'
          ? `ALTER TABLE ${tbl} DROP CHECK ${qName}`
          : `ALTER TABLE ${tbl} DROP CONSTRAINT ${qName}`
        );
        break;
      }
      }
    }

    return statements;
  }

  /**
   * Generate the next auto-name for a CHECK constraint on this blueprint.
   * @private
   * @returns {string}
   */
  _nextCheckName() {
    return `${this.tableName}_check_${++this._checkCount}`;
  }

  /**
   * Add a CHECK constraint.
   * @param {string} expression - Raw SQL check expression (developer-authored, not sanitised)
   * @returns {CheckConstraintDefinition}
   * @throws {TypeError} if expression is not a non-empty string
   * @warning The expression is trusted verbatim. Only use developer-authored values, never user input.
   */
  check(expression) {
    if (typeof expression !== 'string' || expression.trim() === '') {
      throw new TypeError('check() requires a non-empty expression string');
    }
    const constraintDef = new CheckConstraintDefinition(expression, this);
    this.commands.push({ type: 'check', constraintDef });
    return constraintDef;
  }

  /**
   * Drop a named constraint.
   * @param {string} name - Constraint name (must be a valid SQL identifier)
   * @returns {this}
   * @throws {Error} if name is not a valid SQL identifier
   */
  dropConstraint(name) {
    quoteIdentifier(name); // validates; throws on invalid identifier
    this.commands.push({ type: 'dropCheck', name });
    return this;
  }

  /**
   * Drop a named CHECK constraint (alias for dropConstraint).
   * @param {string} name - Constraint name
   * @returns {this}
   */
  dropCheck(name) {
    return this.dropConstraint(name);
  }

  /**
   * Get table constraints (PRIMARY KEY, FOREIGN KEY, etc.)
   */
  getConstraints() {
    const constraints = [];
    const driver = this.connection?.config?.driver || 'mysql';

    // Primary keys
    const primaryKeys = this.columns.filter(col => col.isPrimary);
    // In SQLite, if a column is autoincrementing integer PK, it must be declared at column level,
    // so skip table-level PRIMARY KEY constraints to avoid duplication.
    const hasSqliteAutoInc = driver === 'sqlite' && this.columns.some(col => col.isAutoIncrement);
    if (primaryKeys.length > 0 && !hasSqliteAutoInc) {
      const pkColumns = primaryKeys.map(col => quoteIdentifier(col.name)).join(', ');
      constraints.push(`PRIMARY KEY (${pkColumns})`);
    }

    // Foreign keys
    for (const command of this.commands) {
      if (command.type === 'foreign') {
        const fk = command.foreignKey;
        let constraint = `CONSTRAINT ${quoteIdentifier(fk._customName ?? fk._autoName)} FOREIGN KEY (${quoteIdentifier(fk.column)}) ` +
                        `REFERENCES ${quoteIdentifier(fk._ref.table)}(${quoteIdentifier(fk._ref.column)})`;

        if (fk._onDelete) {
          constraint += ` ON DELETE ${fk._onDelete}`;
        }
        if (fk._onUpdate) {
          constraint += ` ON UPDATE ${fk._onUpdate}`;
        }

        constraints.push(constraint);
      } else if (command.type === 'unique') {
        if (driver === 'sqlite') {
          constraints.push(`UNIQUE (${command.columns.map(c => quoteIdentifier(c)).join(', ')})`);
        } else {
          constraints.push(`UNIQUE KEY ${quoteIdentifier(command.name)} (${command.columns.map(c => quoteIdentifier(c)).join(', ')})`);
        }
      } else if (command.type === 'index') {
        if (driver !== 'sqlite') {
          constraints.push(`KEY ${quoteIdentifier(command.name)} (${command.columns.map(c => quoteIdentifier(c)).join(', ')})`);
        }
      }
    }

    // CHECK constraints
    const seenCheckNames = new Set();
    for (const cmd of this.commands) {
      if (cmd.type !== 'check') continue;
      const resolvedName = cmd.constraintDef.resolvedName();
      if (seenCheckNames.has(resolvedName)) {
        throw new Error(`Duplicate constraint name: "${resolvedName}"`);
      }
      seenCheckNames.add(resolvedName);
      const qName = quoteId(resolvedName, driver);
      constraints.push(`CONSTRAINT ${qName} CHECK (${cmd.constraintDef.expression})`);
    }

    return constraints.join(',\n  ');
  }
}

/**
 * Column Definition
 */
class ColumnDefinition {
  constructor(name, type, options = {}) {
    this.name = name;
    this.type = type;
    this.options = options;
    this.isPrimary = false;
    this.isUnique = false;
    this.isNullable = false;
    this.isUnsigned = false;
    this.isAutoIncrement = false;
    this.defaultValue = null;
    this.commentText = null;
    this.afterColumn = null;
    this.isFirst = false;
    this.useCurrentTimestamp = false;
    this.useCurrentOnUpdateTimestamp = false;
  }

  primary() {
    this.isPrimary = true;
    return this;
  }

  unique() {
    this.isUnique = true;
    return this;
  }

  nullable() {
    this.isNullable = true;
    return this;
  }

  unsigned() {
    this.isUnsigned = true;
    return this;
  }

  autoIncrement() {
    this.isAutoIncrement = true;
    return this;
  }

  default(value) {
    this.defaultValue = value;
    return this;
  }

  comment(text) {
    this.commentText = text;
    return this;
  }

  after(columnName) {
    this.afterColumn = columnName;
    return this;
  }

  first() {
    this.isFirst = true;
    return this;
  }

  useCurrent() {
    this.useCurrentTimestamp = true;
    return this;
  }

  useCurrentOnUpdate() {
    this.useCurrentOnUpdateTimestamp = true;
    return this;
  }

  /**
   * Generate SQL for this column
   */
  toSql(driver = 'mysql') {
    let sql = `${quoteIdentifier(this.name)} ${this.getTypeDefinition(driver)}`;

    if (this.isUnsigned && ['INT', 'BIGINT', 'TINYINT'].includes(this.type) && driver !== 'sqlite') {
      sql += ' UNSIGNED';
    }

    if (!this.isNullable && !this.isPrimary) {
      sql += ' NOT NULL';
    }

    if (this.isAutoIncrement) {
      if (driver === 'sqlite') {
        // In SQLite, autoincrement must be declared as INTEGER PRIMARY KEY AUTOINCREMENT
        sql = `${quoteIdentifier(this.name)} INTEGER PRIMARY KEY AUTOINCREMENT`;
      } else {
        sql += ' AUTO_INCREMENT';
      }
    }

    if (this.useCurrentTimestamp) {
      sql += ' DEFAULT CURRENT_TIMESTAMP';
    } else if (this.defaultValue !== null) {
      sql += ` DEFAULT ${this.formatDefaultValue()}`;
    }

    if (this.useCurrentOnUpdateTimestamp && driver !== 'sqlite') {
      sql += ' ON UPDATE CURRENT_TIMESTAMP';
    }

    if (this.isUnique) {
      sql += ' UNIQUE';
    }

    if (this.commentText) {
      sql += ` COMMENT '${this.commentText.replace(/'/g, '\'\'')}'`;
    }

    return sql;
  }

  getTypeDefinition(driver = 'mysql') {
    const { length, precision, scale, values } = this.options;

    switch (this.type) {
    case 'VARCHAR':
      return driver === 'sqlite' ? 'TEXT' : `VARCHAR(${length})`;
    case 'CHAR':
      return driver === 'sqlite' ? 'TEXT' : `CHAR(${length})`;
    case 'DECIMAL':
      return `DECIMAL(${precision}, ${scale})`;
    case 'FLOAT':
      return precision ? `FLOAT(${precision}, ${scale})` : 'FLOAT';
    case 'ENUM': {
      if (driver === 'sqlite') return 'TEXT';
      const enumValues = values.map(v => `'${v.replace(/'/g, '\'\'')}'`).join(', ');
      return `ENUM(${enumValues})`;
    }
    default:
      return this.type;
    }
  }

  formatDefaultValue() {
    if (typeof this.defaultValue === 'string') {
      return `'${this.defaultValue.replace(/'/g, '\'\'')}'`;
    }
    return this.defaultValue;
  }
}

/**
 * Foreign Key Definition
 */
class ForeignKeyDefinition {
  constructor(column) {
    this.column = column;
    this._ref = { table: null, column: 'id' };
    this._onDelete = null;
    this._onUpdate = null;
    this._autoName = null;
    this._customName = null;
  }

  references(column) {
    this._ref.column = column;
    return this;
  }

  on(table) {
    this._ref.table = table;
    this._autoName = `${table}_${this.column}_foreign`;
    return this;
  }

  constrained(table = null) {
    if (table) {
      this._ref.table = table;
    } else {
      // Infer table name from column name (remove _id suffix)
      const pluralize = require('pluralize');
      this._ref.table = pluralize(this.column.replace(/_id$/, ''));
    }
    this._autoName = `${this._ref.table}_${this.column}_foreign`;
    return this;
  }

  onDelete(action) {
    const ALLOWED_FK_ACTIONS = ['CASCADE', 'RESTRICT', 'SET NULL', 'NO ACTION', 'SET DEFAULT'];
    const normalized = action.toUpperCase();
    if (!ALLOWED_FK_ACTIONS.includes(normalized)) {
      throw new Error(`Invalid foreign key action: "${normalized}". Allowed: ${ALLOWED_FK_ACTIONS.join(', ')}`);
    }
    this._onDelete = normalized;
    return this;
  }

  onUpdate(action) {
    const ALLOWED_FK_ACTIONS = ['CASCADE', 'RESTRICT', 'SET NULL', 'NO ACTION', 'SET DEFAULT'];
    const normalized = action.toUpperCase();
    if (!ALLOWED_FK_ACTIONS.includes(normalized)) {
      throw new Error(`Invalid foreign key action: "${normalized}". Allowed: ${ALLOWED_FK_ACTIONS.join(', ')}`);
    }
    this._onUpdate = normalized;
    return this;
  }

  cascadeOnDelete() {
    return this.onDelete('cascade');
  }

  cascadeOnUpdate() {
    return this.onUpdate('cascade');
  }

  /**
   * Set an explicit constraint name for this foreign key.
   * @param {string} [value] - Constraint name (must be a valid SQL identifier)
   * @returns {ForeignKeyDefinition}
   */
  name(value) {
    if (value && typeof value === 'string' && value.trim() !== '') {
      quoteIdentifier(value); // validates; throws on invalid identifier
      this._customName = value;
    }
    return this;
  }
}

/**
 * CHECK Constraint Definition
 * Returned by Blueprint.check() for fluent naming.
 * @warning The expression is trusted verbatim. Only use developer-authored values, never user input.
 */
class CheckConstraintDefinition {
  /**
   * @param {string} expression - Raw SQL check expression
   * @param {Blueprint} blueprint - The owning blueprint (for auto-name generation)
   */
  constructor(expression, blueprint) {
    this.expression = expression;
    this._name = null;
    this._blueprint = blueprint;
    this._cachedAutoName = undefined;
  }

  /**
   * Resolve the final constraint name (explicit or auto-generated).
   * Auto-names are lazily generated and cached.
   * @returns {string}
   */
  resolvedName() {
    if (this._name !== null) return this._name;
    if (this._cachedAutoName === undefined) {
      this._cachedAutoName = this._blueprint._nextCheckName();
    }
    return this._cachedAutoName;
  }

  /**
   * Set an explicit constraint name.
   * @param {string} [value] - Constraint name (must be a valid SQL identifier)
   * @returns {CheckConstraintDefinition}
   * @throws {Error} if value contains invalid identifier characters
   */
  name(value) {
    if (value && typeof value === 'string' && value.trim() !== '') {
      quoteIdentifier(value); // validates; throws on invalid identifier
      this._name = value;
    }
    return this;
  }
}

module.exports = { Schema, Blueprint, ColumnDefinition, ForeignKeyDefinition, CheckConstraintDefinition };

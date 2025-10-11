/**
 * Schema Builder - Inspired by Laravel Schema
 * Provides a fluent interface for creating and modifying database tables
 */

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
    console.log(`✓ Table '${tableName}' created successfully`);
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
    console.log(`✓ Table '${tableName}' modified successfully`);
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
        sql = `RENAME TABLE ${from} TO ${to}`;
        break;
      case 'postgres':
      case 'postgresql':
      case 'sqlite':
        sql = `ALTER TABLE ${from} RENAME TO ${to}`;
        break;
      default:
        throw new Error(`Unsupported driver: ${driver}`);
    }

    await this.connection.execute(sql);
    console.log(`✓ Table '${from}' renamed to '${to}'`);
  }

  /**
   * Drop a table
   * @param {string} tableName
   */
  async drop(tableName) {
    const sql = `DROP TABLE ${tableName}`;
    await this.connection.execute(sql);
    console.log(`✓ Table '${tableName}' dropped successfully`);
  }

  /**
   * Drop a table if it exists
   * @param {string} tableName
   */
  async dropIfExists(tableName) {
    const sql = `DROP TABLE IF EXISTS ${tableName}`;
    await this.connection.execute(sql);
    console.log(`✓ Table '${tableName}' dropped if existed`);
  }

  /**
   * Check if a table exists
   * @param {string} tableName
   * @returns {Promise<boolean>}
   */
  async hasTable(tableName) {
    const driver = this.connection.config.driver;
    let sql;

    switch (driver) {
      case 'mysql':
        sql = `SELECT COUNT(*) as count FROM information_schema.tables
               WHERE table_schema = DATABASE() AND table_name = '${tableName}'`;
        break;
      case 'postgres':
      case 'postgresql':
        sql = `SELECT COUNT(*) as count FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = '${tableName}'`;
        break;
      case 'sqlite':
        sql = `SELECT COUNT(*) as count FROM sqlite_master
               WHERE type='table' AND name='${tableName}'`;
        break;
      default:
        throw new Error(`Unsupported driver: ${driver}`);
    }

    const result = await this.connection.execute(sql);
    return result[0].count > 0;
  }

  /**
   * Check if a column exists in a table
   * @param {string} tableName
   * @param {string} columnName
   * @returns {Promise<boolean>}
   */
  async hasColumn(tableName, columnName) {
    const driver = this.connection.config.driver;
    let sql;

    switch (driver) {
      case 'mysql':
        sql = `SELECT COUNT(*) as count FROM information_schema.columns
               WHERE table_schema = DATABASE()
               AND table_name = '${tableName}'
               AND column_name = '${columnName}'`;
        break;
      case 'postgres':
      case 'postgresql':
        sql = `SELECT COUNT(*) as count FROM information_schema.columns
               WHERE table_schema = 'public'
               AND table_name = '${tableName}'
               AND column_name = '${columnName}'`;
        break;
      case 'sqlite':
        sql = `SELECT COUNT(*) as count FROM pragma_table_info('${tableName}')
               WHERE name = '${columnName}'`;
        break;
      default:
        throw new Error(`Unsupported driver: ${driver}`);
    }

    const result = await this.connection.execute(sql);
    return result[0].count > 0;
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
    const columnDefinitions = this.columns.map(col => col.toSql()).join(',\n  ');
    const constraints = this.getConstraints();

    let sql = `CREATE TABLE ${this.tableName} (\n  ${columnDefinitions}`;

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
    for (const column of this.columns) {
      let sql = `ALTER TABLE ${this.tableName} ADD COLUMN ${column.toSql()}`;
      statements.push(sql);
    }

    // Process commands
    for (const command of this.commands) {
      switch (command.type) {
        case 'dropColumn':
          for (const col of command.columns) {
            statements.push(`ALTER TABLE ${this.tableName} DROP COLUMN ${col}`);
          }
          break;

        case 'renameColumn':
          statements.push(`ALTER TABLE ${this.tableName} CHANGE ${command.from} ${command.to}`);
          break;

        case 'foreign': {
          const fk = command.foreignKey;
          statements.push(
            `ALTER TABLE ${this.tableName} ADD CONSTRAINT ${fk.name} ` +
            `FOREIGN KEY (${fk.column}) REFERENCES ${fk.references.table}(${fk.references.column})` +
            (fk.onDelete ? ` ON DELETE ${fk.onDelete}` : '') +
            (fk.onUpdate ? ` ON UPDATE ${fk.onUpdate}` : '')
          );
          break;
        }

        case 'dropForeign': {
          const fkName = `${this.tableName}_${command.columns.join('_')}_foreign`;
          statements.push(`ALTER TABLE ${this.tableName} DROP FOREIGN KEY ${fkName}`);
          break;
        }

        case 'index':
          statements.push(
            `ALTER TABLE ${this.tableName} ADD INDEX ${command.name} (${command.columns.join(', ')})`
          );
          break;

        case 'unique':
          statements.push(
            `ALTER TABLE ${this.tableName} ADD UNIQUE ${command.name} (${command.columns.join(', ')})`
          );
          break;

        case 'fulltext':
          statements.push(
            `ALTER TABLE ${this.tableName} ADD FULLTEXT ${command.name} (${command.columns.join(', ')})`
          );
          break;

        case 'dropIndex':
          statements.push(`ALTER TABLE ${this.tableName} DROP INDEX ${command.name}`);
          break;
      }
    }

    return statements;
  }

  /**
   * Get table constraints (PRIMARY KEY, FOREIGN KEY, etc.)
   */
  getConstraints() {
    const constraints = [];

    // Primary keys
    const primaryKeys = this.columns.filter(col => col.isPrimary);
    if (primaryKeys.length > 0) {
      const pkColumns = primaryKeys.map(col => col.name).join(', ');
      constraints.push(`PRIMARY KEY (${pkColumns})`);
    }

    // Foreign keys
    for (const command of this.commands) {
      if (command.type === 'foreign') {
        const fk = command.foreignKey;
        let constraint = `CONSTRAINT ${fk.name} FOREIGN KEY (${fk.column}) ` +
                        `REFERENCES ${fk.references.table}(${fk.references.column})`;

        if (fk.onDelete) {
          constraint += ` ON DELETE ${fk.onDelete}`;
        }
        if (fk.onUpdate) {
          constraint += ` ON UPDATE ${fk.onUpdate}`;
        }

        constraints.push(constraint);
      } else if (command.type === 'unique') {
        constraints.push(`UNIQUE KEY ${command.name} (${command.columns.join(', ')})`);
      } else if (command.type === 'index') {
        constraints.push(`KEY ${command.name} (${command.columns.join(', ')})`);
      }
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
  toSql() {
    let sql = `${this.name} ${this.getTypeDefinition()}`;

    if (this.isUnsigned && ['INT', 'BIGINT', 'TINYINT'].includes(this.type)) {
      sql += ' UNSIGNED';
    }

    if (!this.isNullable && !this.isPrimary) {
      sql += ' NOT NULL';
    }

    if (this.isAutoIncrement) {
      sql += ' AUTO_INCREMENT';
    }

    if (this.useCurrentTimestamp) {
      sql += ' DEFAULT CURRENT_TIMESTAMP';
    } else if (this.defaultValue !== null) {
      sql += ` DEFAULT ${this.formatDefaultValue()}`;
    }

    if (this.useCurrentOnUpdateTimestamp) {
      sql += ' ON UPDATE CURRENT_TIMESTAMP';
    }

    if (this.isUnique) {
      sql += ' UNIQUE';
    }

    if (this.commentText) {
      sql += ` COMMENT '${this.commentText}'`;
    }

    return sql;
  }

  getTypeDefinition() {
    const { length, precision, scale, values } = this.options;

    switch (this.type) {
      case 'VARCHAR':
        return `VARCHAR(${length})`;
      case 'CHAR':
        return `CHAR(${length})`;
      case 'DECIMAL':
        return `DECIMAL(${precision}, ${scale})`;
      case 'FLOAT':
        return precision ? `FLOAT(${precision}, ${scale})` : 'FLOAT';
      case 'ENUM': {
        const enumValues = values.map(v => `'${v}'`).join(', ');
        return `ENUM(${enumValues})`;
      }
      default:
        return this.type;
    }
  }

  formatDefaultValue() {
    if (typeof this.defaultValue === 'string') {
      return `'${this.defaultValue}'`;
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
    this.references = { table: null, column: 'id' };
    this.onDelete = null;
    this.onUpdate = null;
    this.name = null;
  }

  references(column) {
    this.references.column = column;
    return this;
  }

  on(table) {
    this.references.table = table;
    this.name = `${table}_${this.column}_foreign`;
    return this;
  }

  constrained(table = null) {
    if (table) {
      this.references.table = table;
    } else {
      // Infer table name from column name (remove _id suffix)
      this.references.table = this.column.replace(/_id$/, '') + 's';
    }
    this.name = `${this.references.table}_${this.column}_foreign`;
    return this;
  }

  onDelete(action) {
    this.onDelete = action.toUpperCase();
    return this;
  }

  onUpdate(action) {
    this.onUpdate = action.toUpperCase();
    return this;
  }

  cascadeOnDelete() {
    return this.onDelete('cascade');
  }

  cascadeOnUpdate() {
    return this.onUpdate('cascade');
  }
}

module.exports = { Schema, Blueprint, ColumnDefinition, ForeignKeyDefinition };

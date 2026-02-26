/**
 * Base Seeder Class
 * All seeders should extend this class
 */

function assertTableName(table) {
  if (typeof table !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) {
    throw new Error(`Invalid table name: "${table}"`);
  }
  return table;
}

class Seeder {
  constructor(connection, manager = null) {
    this.connection = connection;
    this.manager = manager;
  }

  async run() {
    throw new Error('Seeder run() method must be implemented');
  }

  async call(seeder) {
    if (!this.manager) {
      throw new Error('Seeder manager is required to call nested seeders');
    }
    await this.manager.runSeeder(seeder);
  }

  async insert(table, rows) {
    const safeTable = assertTableName(table);

    if (Array.isArray(rows)) {
      if (rows.length === 0) return { affectedRows: 0 };
      return await this.connection.insertMany(safeTable, rows);
    }

    return await this.connection.insert(safeTable, rows);
  }

  async truncate(table) {
    const safeTable = assertTableName(table);
    const driver = this.connection?.config?.driver;

    switch (driver) {
    case 'mysql':
      await this.connection.execute(`TRUNCATE TABLE ${safeTable}`);
      break;
    case 'postgres':
    case 'postgresql':
    case 'sqlite':
      await this.connection.execute(`DELETE FROM ${safeTable}`);
      break;
    default:
      throw new Error(`Unsupported driver for truncate: ${driver}`);
    }
  }
}

module.exports = Seeder;

/**
 * Base Migration Class
 * All migrations should extend this class
 */

class Migration {
  constructor(connection) {
    this.connection = connection;
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
}

module.exports = Migration;

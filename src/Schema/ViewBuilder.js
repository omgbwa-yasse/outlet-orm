'use strict';

/**
 * Validate and quote a SQL identifier.
 * MySQL  → backtick-quoted
 * PG / SQLite → double-quote-quoted
 * @param {string} identifier
 * @param {string} driver - 'mysql' | 'postgres' | 'sqlite'
 * @returns {string}
 */
function q(identifier, driver) {
  if (!identifier || typeof identifier !== 'string') {
    throw new Error('Invalid SQL identifier');
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error('Invalid SQL identifier');
  }
  return driver === 'mysql' ? `\`${identifier}\`` : `"${identifier}"`;
}

/**
 * Builds CREATE VIEW / DROP VIEW SQL strings for each driver.
 */
const ViewBuilder = {
  /**
   * Build CREATE VIEW statements.
   *
   * @param {string}  name      - View name (validated)
   * @param {string}  selectSql - Raw SELECT body (not parameterised — caller is responsible)
   * @param {boolean} replace   - Use CREATE OR REPLACE where supported
   * @param {string}  driver    - Canonical driver: 'mysql' | 'postgres' | 'sqlite'
   * @returns {string[]}  Array of SQL statements to execute sequentially
   */
  buildCreate(name, selectSql, replace, driver) {
    const quotedName = q(name, driver);

    if (driver === 'sqlite') {
      // SQLite does not support CREATE OR REPLACE VIEW.
      // Emulate it with an explicit DROP + CREATE pair.
      return [
        `DROP VIEW IF EXISTS ${quotedName}`,
        `CREATE VIEW ${quotedName} AS ${selectSql}`
      ];
    }

    // MySQL and PostgreSQL both support CREATE OR REPLACE VIEW natively.
    const orReplace = replace ? 'OR REPLACE ' : '';
    return [`CREATE ${orReplace}VIEW ${quotedName} AS ${selectSql}`];
  }
};

module.exports = ViewBuilder;

'use strict';

const { UnsupportedCapabilityError } = require('../Errors/UnsupportedCapabilityError');

/**
 * Quote a SQL identifier using driver-appropriate characters.
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
 * Builds CREATE PROCEDURE / CREATE FUNCTION DDL for MySQL and PostgreSQL.
 * SQLite does not support stored procedures or functions — both methods throw
 * UnsupportedCapabilityError for that driver.
 */
const ProcedureBuilder = {
  /**
   * Build a CREATE PROCEDURE statement.
   *
   * @param {Object} def
   * @param {string} def.name     - Procedure name
   * @param {string} def.params   - Parameter list (raw SQL, e.g. 'IN x INT, OUT y INT')
   * @param {string} def.body     - Procedure body
   * @param {string} [def.language='plpgsql'] - PG only: procedural language
   * @param {string} driver       - Canonical driver: 'mysql' | 'postgres' | 'sqlite'
   * @returns {string}
   */
  buildCreateProcedure(def, driver) {
    if (driver === 'sqlite') {
      throw new UnsupportedCapabilityError('sqlite', 'stored procedures');
    }

    const { name, params = '', body } = def;
    const qName = q(name, driver);

    if (driver === 'mysql') {
      return `CREATE PROCEDURE ${qName}(${params})\nBEGIN\n${body}\nEND`;
    }

    // PostgreSQL
    const language = def.language || 'plpgsql';
    return [
      `CREATE OR REPLACE PROCEDURE ${qName}(${params})`,
      `LANGUAGE ${language}`,
      'AS $$',
      'BEGIN',
      body,
      'END;',
      '$$'
    ].join('\n');
  },

  /**
   * Build a CREATE FUNCTION statement.
   *
   * @param {Object} def
   * @param {string} def.name     - Function name
   * @param {string} def.params   - Parameter list (raw SQL)
   * @param {string} def.body     - Function body
   * @param {string} [def.returns]         - Return type (required for MySQL, e.g. 'INT')
   * @param {string} [def.language='plpgsql'] - PG only: procedural language
   * @param {string} [def.returnType]      - PG only: return type (e.g. 'INTEGER'), defaults to 'void'
   * @param {string} driver       - Canonical driver: 'mysql' | 'postgres' | 'sqlite'
   * @returns {string}
   */
  buildCreateFunction(def, driver) {
    if (driver === 'sqlite') {
      throw new UnsupportedCapabilityError('sqlite', 'stored functions');
    }

    const { name, params = '', body } = def;
    const qName = q(name, driver);

    if (driver === 'mysql') {
      const returns = def.returns || 'INT';
      return [
        `CREATE FUNCTION ${qName}(${params})`,
        `RETURNS ${returns}`,
        'BEGIN',
        body,
        'END'
      ].join('\n');
    }

    // PostgreSQL
    const language   = def.language   || 'plpgsql';
    const returnType = def.returnType  || def.returns || 'void';
    return [
      `CREATE OR REPLACE FUNCTION ${qName}(${params})`,
      `RETURNS ${returnType}`,
      `LANGUAGE ${language}`,
      'AS $$',
      'BEGIN',
      body,
      'END;',
      '$$'
    ].join('\n');
  }
};

module.exports = ProcedureBuilder;

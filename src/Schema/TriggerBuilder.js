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
 * Builds CREATE TRIGGER (and helper function for PostgreSQL) DDL statements.
 */
const TriggerBuilder = {
  /**
   * Build the DDL statements required to create a trigger.
   *
   * @param {Object} def
   * @param {string} def.name       - Trigger name
   * @param {string} def.table      - Target table (or view for INSTEAD OF)
   * @param {string} def.timing     - 'BEFORE' | 'AFTER' | 'INSTEAD OF'
   * @param {string} def.event      - 'INSERT' | 'UPDATE' | 'DELETE'
   * @param {string} [def.forEach='ROW'] - 'ROW' | 'STATEMENT'
   * @param {boolean} [def.isView=false] - Set true when the target is a VIEW
   * @param {string} def.body       - Trigger body SQL
   * @param {string} driver         - Canonical driver: 'mysql' | 'postgres' | 'sqlite'
   * @returns {string[]}  Array of SQL statements to execute sequentially
   */
  buildCreate(def, driver) {
    const { name, table, event, body } = def;
    const timing   = (def.timing   || 'AFTER').toUpperCase();
    const forEach  = (def.forEach  || 'ROW').toUpperCase();
    const isView   = Boolean(def.isView);

    // ── Shared validation ────────────────────────────────────────────────────

    // INSTEAD OF is only valid on views
    if (timing === 'INSTEAD OF' && !isView) {
      throw new UnsupportedCapabilityError(driver, 'INSTEAD OF trigger on a plain table');
    }

    // ── SQLite ───────────────────────────────────────────────────────────────
    if (driver === 'sqlite') {
      if (forEach === 'STATEMENT') {
        throw new UnsupportedCapabilityError('sqlite', 'FOR EACH STATEMENT triggers');
      }

      // SQLite trigger body restrictions (per research.md §5):
      // - No qualified table references (word.word) inside the body
      //   (NEW.col and OLD.col are row-reference pseudo-tables, not schema qualifiers)
      if (/\b(?!(?:NEW|OLD)\b)\w+\.\w+\b/i.test(body)) {
        throw new Error(
          'SQLite trigger body must not contain qualified table references (e.g. schema.table). ' +
          'Refer to tables by their unqualified name.'
        );
      }
      // - No INSERT INTO ... DEFAULT VALUES
      if (/INSERT\s+INTO\s+\S+\s+DEFAULT\s+VALUES/i.test(body)) {
        throw new Error(
          'SQLite trigger body does not support INSERT INTO ... DEFAULT VALUES syntax.'
        );
      }
      // - No ORDER BY / LIMIT inside UPDATE or DELETE statements
      if (/(UPDATE|DELETE)[\s\S]*?\bORDER\s+BY\b/i.test(body)) {
        throw new Error('SQLite trigger body UPDATE/DELETE statements must not include ORDER BY.');
      }
      if (/(UPDATE|DELETE)[\s\S]*?\bLIMIT\b/i.test(body)) {
        throw new Error('SQLite trigger body UPDATE/DELETE statements must not include LIMIT.');
      }

      const qName  = q(name,  driver);
      const qTable = q(table, driver);
      const insteadOf = timing === 'INSTEAD OF' ? 'INSTEAD OF ' : `${timing} `;
      return [
        `CREATE TRIGGER ${qName} ${insteadOf}${event} ON ${qTable} FOR EACH ROW\nBEGIN\n${body}\nEND`
      ];
    }

    // ── PostgreSQL ───────────────────────────────────────────────────────────
    if (driver === 'postgres') {
      // PG BEFORE/AFTER triggers on views require STATEMENT level
      if (timing !== 'INSTEAD OF' && isView && forEach === 'ROW') {
        throw new Error(
          'PostgreSQL BEFORE/AFTER triggers on views require forEach: STATEMENT'
        );
      }

      const qName   = q(name,           driver);
      const qFnName = q(name + '_fn',   driver);
      const qTable  = q(table,          driver);

      const fnSql = [
        `CREATE OR REPLACE FUNCTION ${qFnName}() RETURNS trigger AS $$`,
        'BEGIN',
        body,
        'RETURN NEW;',
        'END;',
        '$$ LANGUAGE plpgsql'
      ].join('\n');

      const trigSql =
        `CREATE TRIGGER ${qName} ${timing} ${event} ON ${qTable} ` +
        `FOR EACH ${forEach} EXECUTE FUNCTION ${qFnName}()`;

      return [fnSql, trigSql];
    }

    // ── MySQL ────────────────────────────────────────────────────────────────
    const qName  = q(name,  driver);
    const qTable = q(table, driver);
    return [
      `CREATE TRIGGER ${qName} ${timing} ${event} ON ${qTable} FOR EACH ROW\nBEGIN\n${body}\nEND`
    ];
  }
};

module.exports = TriggerBuilder;

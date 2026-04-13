'use strict';
/**
 * Resolves a Schema or DatabaseConnection to a Schema instance.
 * Uses duck-typing to avoid circular requires.
 */
function resolveSchema(input) {
  if (!input) {
    throw new TypeError('useSchema / .use() requires a Schema or DatabaseConnection instance');
  }
  if (typeof input.createView === 'function') {
    return input;
  }
  if (typeof input.execute === 'function') {
    const Schema = require('../Schema/Schema').Schema;
    return new Schema(input);
  }
  throw new TypeError('useSchema / .use() requires a Schema or DatabaseConnection instance');
}

module.exports = resolveSchema;

'use strict';

/**
 * ToolContract
 * Base class for tools usable by AI providers (function calling).
 */
class ToolContract {
  /** @returns {string} */
  name() { throw new Error('Not implemented: name()'); }

  /** @returns {string} */
  description() { throw new Error('Not implemented: description()'); }

  /** @returns {Object} JSON Schema of parameters */
  schema() { throw new Error('Not implemented: schema()'); }

  /**
   * Execute the tool with given arguments. Must return a string result.
   * @param {Object} args
   * @returns {Promise<string>|string}
   */
  execute(args) { throw new Error('Not implemented: execute()'); }
}

module.exports = ToolContract;

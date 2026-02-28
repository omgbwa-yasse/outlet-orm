'use strict';

/**
 * ToolRegistry
 * Registry of named tools for function calling.
 */
class ToolRegistry {
  constructor() {
    /** @type {Map<string, import('../Contracts/ToolContract')>} */
    this._tools = new Map();
  }

  /**
   * Register a tool.
   * @param {import('../Contracts/ToolContract')} tool
   * @returns {this}
   */
  register(tool) {
    this._tools.set(tool.name(), tool);
    return this;
  }

  /**
   * Get a tool by name.
   * @param {string} name
   * @returns {import('../Contracts/ToolContract')|null}
   */
  get(name) {
    return this._tools.get(name) || null;
  }

  /**
   * Get all registered tools as an object keyed by name.
   * @returns {Object<string, import('../Contracts/ToolContract')>}
   */
  all() {
    const out = {};
    for (const [k, v] of this._tools) {
      out[k] = v;
    }
    return out;
  }

  /**
   * Check if a tool is registered.
   * @param {string} name
   * @returns {boolean}
   */
  has(name) {
    return this._tools.has(name);
  }

  /**
   * Number of registered tools.
   * @returns {number}
   */
  get size() {
    return this._tools.size;
  }
}

module.exports = ToolRegistry;

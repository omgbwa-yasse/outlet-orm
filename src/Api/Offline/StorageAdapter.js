'use strict';

/**
 * StorageAdapter — abstract interface for offline stores.
 * Subclasses must implement: get, set, delete, clear, keys.
 */
class StorageAdapter {
  async get(key)           { throw new Error('Not implemented'); }
  async set(key, value)    { throw new Error('Not implemented'); }
  async delete(key)        { throw new Error('Not implemented'); }
  async clear()            { throw new Error('Not implemented'); }
  async keys()             { throw new Error('Not implemented'); }
}

module.exports = { StorageAdapter };

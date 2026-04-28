'use strict';

const { StorageAdapter } = require('./StorageAdapter');

/**
 * MemoryStore — in-memory offline storage (Map-based).
 */
class MemoryStore extends StorageAdapter {
  constructor() {
    super();
    this._map = new Map();
  }

  async get(key)        { return this._map.get(key); }
  async set(key, value) { this._map.set(key, value); }
  async delete(key)     { this._map.delete(key); }
  async clear()         { this._map.clear(); }
  async keys()          { return Array.from(this._map.keys()); }
}

module.exports = { MemoryStore };

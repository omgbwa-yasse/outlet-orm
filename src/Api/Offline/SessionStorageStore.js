'use strict';

const { MemoryStore } = require('./MemoryStore');
const { StorageAdapter } = require('./StorageAdapter');

/**
 * SessionStorageStore — wraps browser `sessionStorage`.
 * Falls back to MemoryStore when sessionStorage is unavailable.
 */
class SessionStorageStore extends StorageAdapter {
  constructor(prefix) {
    super();
    this._prefix = prefix || 'outlet_session:';
    try {
      const isBrowser = typeof window !== 'undefined' &&
        typeof window.sessionStorage !== 'undefined' &&
        typeof window.sessionStorage.setItem === 'function';
      if (isBrowser) {
        this._storage = window.sessionStorage;
      } else {
        this._fallback = new MemoryStore();
      }
    } catch (_) {
      this._fallback = new MemoryStore();
    }
  }

  _key(key) { return this._prefix + key; }

  async get(key) {
    if (this._fallback) return this._fallback.get(key);
    const raw = this._storage.getItem(this._key(key));
    if (raw === null) return null;
    try { return JSON.parse(raw); } catch (_) { return raw; }
  }

  async set(key, value) {
    if (this._fallback) return this._fallback.set(key, value);
    this._storage.setItem(this._key(key), JSON.stringify(value));
  }

  async delete(key) {
    if (this._fallback) return this._fallback.delete(key);
    this._storage.removeItem(this._key(key));
  }

  async clear() {
    if (this._fallback) return this._fallback.clear();
    const prefix = this._prefix;
    const toRemove = [];
    for (let i = 0; i < this._storage.length; i++) {
      const k = this._storage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    toRemove.forEach(k => this._storage.removeItem(k));
  }

  async keys() {
    if (this._fallback) return this._fallback.keys();
    const prefix = this._prefix;
    const result = [];
    for (let i = 0; i < this._storage.length; i++) {
      const k = this._storage.key(i);
      if (k && k.startsWith(prefix)) result.push(k.slice(prefix.length));
    }
    return result;
  }
}

module.exports = { SessionStorageStore };

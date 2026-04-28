'use strict';

/**
 * Inline in-memory cache store with TTL support.
 */
class MemoryStore {
  constructor() {
    this._store = new Map();
  }

  get(key) {
    const entry = this._store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this._store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value, ttl) {
    this._store.set(key, {
      value,
      expiresAt: ttl ? Date.now() + ttl : null
    });
  }

  delete(key) {
    this._store.delete(key);
  }

  clear() {
    this._store.clear();
  }

  keys() {
    // Return non-expired keys
    const result = [];
    for (const [k, entry] of this._store.entries()) {
      if (!entry.expiresAt || Date.now() <= entry.expiresAt) {
        result.push(k);
      } else {
        this._store.delete(k);
      }
    }
    return result;
  }
}

/**
 * LocalStorage store with graceful fallback to MemoryStore.
 */
class LocalStorageStore {
  constructor(prefix) {
    this._prefix = prefix || 'outlet_orm_cache:';
    this._fallback = null;
    try {
      if (typeof localStorage === 'undefined') throw new Error('unavailable');
      // Verify writable
      const testKey = this._prefix + '__test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
    } catch (e) {
      this._fallback = new MemoryStore();
    }
  }

  get(key) {
    if (this._fallback) return this._fallback.get(key);
    try {
      const raw = localStorage.getItem(this._prefix + key);
      if (!raw) return undefined;
      const entry = JSON.parse(raw);
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        localStorage.removeItem(this._prefix + key);
        return undefined;
      }
      return entry.value;
    } catch (e) {
      return undefined;
    }
  }

  set(key, value, ttl) {
    if (this._fallback) return this._fallback.set(key, value, ttl);
    try {
      const entry = { value, expiresAt: ttl ? Date.now() + ttl : null };
      localStorage.setItem(this._prefix + key, JSON.stringify(entry));
    } catch (e) {
      // Storage full or serialization error — silently ignore
    }
  }

  delete(key) {
    if (this._fallback) return this._fallback.delete(key);
    try { localStorage.removeItem(this._prefix + key); } catch (e) { /* noop */ }
  }

  clear() {
    if (this._fallback) return this._fallback.clear();
    try {
      const toDelete = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this._prefix)) toDelete.push(k);
      }
      toDelete.forEach(k => localStorage.removeItem(k));
    } catch (e) { /* noop */ }
  }
}

/**
 * SessionStorage store with graceful fallback to MemoryStore.
 */
class SessionStorageStore {
  constructor(prefix) {
    this._prefix = prefix || 'outlet_orm_scache:';
    this._fallback = null;
    try {
      if (typeof sessionStorage === 'undefined') throw new Error('unavailable');
      const testKey = this._prefix + '__test__';
      sessionStorage.setItem(testKey, '1');
      sessionStorage.removeItem(testKey);
    } catch (e) {
      this._fallback = new MemoryStore();
    }
  }

  get(key) {
    if (this._fallback) return this._fallback.get(key);
    try {
      const raw = sessionStorage.getItem(this._prefix + key);
      if (!raw) return undefined;
      const entry = JSON.parse(raw);
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        sessionStorage.removeItem(this._prefix + key);
        return undefined;
      }
      return entry.value;
    } catch (e) {
      return undefined;
    }
  }

  set(key, value, ttl) {
    if (this._fallback) return this._fallback.set(key, value, ttl);
    try {
      const entry = { value, expiresAt: ttl ? Date.now() + ttl : null };
      sessionStorage.setItem(this._prefix + key, JSON.stringify(entry));
    } catch (e) { /* noop */ }
  }

  delete(key) {
    if (this._fallback) return this._fallback.delete(key);
    try { sessionStorage.removeItem(this._prefix + key); } catch (e) { /* noop */ }
  }

  clear() {
    if (this._fallback) return this._fallback.clear();
    try {
      const toDelete = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(this._prefix)) toDelete.push(k);
      }
      toDelete.forEach(k => sessionStorage.removeItem(k));
    } catch (e) { /* noop */ }
  }
}

/**
 * ApiCache – strategy-based GET cache for API layer models.
 *
 * Strategies:
 *   cache-first          — return cached value; fetch and refresh on miss
 *   network-first        — fetch first; fall back to cache on network error
 *   stale-while-revalidate — return cached value immediately, revalidate in background
 *   cache-only           — return cached value; throw on miss
 *   network-only         — always fetch; never read/write cache
 */
class ApiCache {
  /**
   * @param {object} options
   * @param {string} [options.strategy='cache-first']
   * @param {number} [options.ttl=60000] — TTL in ms
   * @param {object} [options.store] — cache store instance (default: MemoryStore)
   */
  constructor(options) {
    options = options || {};
    this._strategy = options.strategy || 'cache-first';
    this._ttl = options.ttl != null ? options.ttl : 60000;
    this._store = options.store || new MemoryStore();
  }

  /**
   * Execute a cache operation for a given key.
   *
   * @param {string} key — cache key
   * @param {Function} fetcherFn — async function that fetches fresh data
   * @param {object} [emitter] — optional EventEmitter for 'cache:hit' / 'cache:miss' events
   * @returns {Promise<*>}
   */
  async execute(key, fetcherFn, emitter) {
    const strategy = this._strategy;

    const emit = (event, data) => {
      if (emitter && typeof emitter.emit === 'function') emitter.emit(event, data);
    };

    if (strategy === 'network-only') {
      const data = await fetcherFn();
      this._store.set(key, data, this._ttl);
      return data;
    }

    const cached = this._store.get(key);

    if (strategy === 'cache-only') {
      if (cached !== undefined) {
        emit('cache:hit', { key });
        return cached;
      }
      const err = new Error('Cache miss for key: ' + key);
      err.code = 'CACHE_MISS';
      throw err;
    }

    if (strategy === 'cache-first') {
      if (cached !== undefined) {
        emit('cache:hit', { key });
        return cached;
      }
      emit('cache:miss', { key });
      const data = await fetcherFn();
      this._store.set(key, data, this._ttl);
      return data;
    }

    if (strategy === 'network-first') {
      try {
        const data = await fetcherFn();
        this._store.set(key, data, this._ttl);
        return data;
      } catch (e) {
        if (cached !== undefined) {
          emit('cache:hit', { key, stale: true });
          return cached;
        }
        throw e;
      }
    }

    if (strategy === 'stale-while-revalidate') {
      if (cached !== undefined) {
        emit('cache:hit', { key, stale: true });
        // Revalidate in background — intentionally not awaited
        fetcherFn().then(data => this._store.set(key, data, this._ttl)).catch(() => {});
        return cached;
      }
      emit('cache:miss', { key });
      const data = await fetcherFn();
      this._store.set(key, data, this._ttl);
      return data;
    }

    // Fallback: behave like cache-first
    if (cached !== undefined) return cached;
    const data = await fetcherFn();
    this._store.set(key, data, this._ttl);
    return data;
  }

  /**
   * Invalidate all cache entries for a given model endpoint prefix.
   * @param {string} prefix
   */
  invalidatePrefix(prefix) {
    for (const key of this._store.keys()) {
      if (key.startsWith(prefix)) {
        this._store.delete(key);
      }
    }
  }

  clear() {
    this._store.clear();
  }
}

module.exports = { ApiCache, MemoryStore, LocalStorageStore, SessionStorageStore };

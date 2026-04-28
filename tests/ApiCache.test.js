'use strict';

const { ApiCache, MemoryStore, LocalStorageStore, SessionStorageStore } = require('../src/Api/ApiCache');

// ── MemoryStore ────────────────────────────────────────────────────────────────

describe('MemoryStore', () => {
  let store;
  beforeEach(() => { store = new MemoryStore(); });

  test('set and get value', () => {
    store.set('foo', 42);
    expect(store.get('foo')).toBe(42);
  });

  test('get returns undefined for missing key', () => {
    expect(store.get('missing')).toBeUndefined();
  });

  test('delete removes a key', () => {
    store.set('a', 1);
    store.delete('a');
    expect(store.get('a')).toBeUndefined();
  });

  test('clear removes all keys', () => {
    store.set('a', 1);
    store.set('b', 2);
    store.clear();
    expect(store.get('a')).toBeUndefined();
    expect(store.get('b')).toBeUndefined();
  });

  test('keys returns current keys', () => {
    store.set('x', 1);
    store.set('y', 2);
    expect(store.keys()).toEqual(expect.arrayContaining(['x', 'y']));
  });

  test('TTL expiry: expired value returns undefined', async () => {
    store.set('temp', 'value', 10); // 10 ms TTL
    await new Promise(r => setTimeout(r, 30));
    expect(store.get('temp')).toBeUndefined();
  });

  test('TTL: value still accessible before expiry', () => {
    store.set('temp', 'value', 10000);
    expect(store.get('temp')).toBe('value');
  });
});

// ── LocalStorageStore ─────────────────────────────────────────────────────────

describe('LocalStorageStore (Node fallback)', () => {
  test('falls back to MemoryStore in Node.js environment', () => {
    const ls = new LocalStorageStore();
    expect(ls._fallback).toBeDefined(); // MemoryStore fallback
  });

  test('set and get via fallback', async () => {
    const ls = new LocalStorageStore();
    ls.set('key1', { a: 1 });
    // Since fallback is synchronous MemoryStore under LocalStorageStore from ApiCache,
    // calling set synchronously works; just verify get returns same
    ls.set('key1', { a: 1 });
    expect(ls.get('key1')).toEqual({ a: 1 });
  });
});

// ── SessionStorageStore ───────────────────────────────────────────────────────

describe('SessionStorageStore (Node fallback)', () => {
  test('falls back to MemoryStore in Node.js environment', () => {
    const ss = new SessionStorageStore();
    expect(ss._fallback).toBeDefined();
  });
});

// ── ApiCache strategies ───────────────────────────────────────────────────────

describe('ApiCache — cache-first strategy', () => {
  test('returns cached value on hit', async () => {
    const cache = new ApiCache({ strategy: 'cache-first', ttl: 5000 });
    const fetcher = jest.fn().mockResolvedValue({ id: 1 });
    await cache.execute('users:1', fetcher);
    const result = await cache.execute('users:1', fetcher);
    expect(result).toEqual({ id: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('calls fetcher on miss', async () => {
    const cache = new ApiCache({ strategy: 'cache-first' });
    const fetcher = jest.fn().mockResolvedValue({ id: 2 });
    const result = await cache.execute('users:2', fetcher);
    expect(result).toEqual({ id: 2 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('emits cache:hit event', async () => {
    const cache = new ApiCache({ strategy: 'cache-first', ttl: 5000 });
    await cache.execute('users:10', () => Promise.resolve('data'));
    const emitter = { emit: jest.fn() };
    await cache.execute('users:10', () => Promise.resolve('data'), emitter);
    expect(emitter.emit).toHaveBeenCalledWith('cache:hit', { key: 'users:10' });
  });

  test('emits cache:miss event', async () => {
    const cache = new ApiCache({ strategy: 'cache-first' });
    const emitter = { emit: jest.fn() };
    await cache.execute('users:99', () => Promise.resolve('data'), emitter);
    expect(emitter.emit).toHaveBeenCalledWith('cache:miss', { key: 'users:99' });
  });
});

describe('ApiCache — network-first strategy', () => {
  test('fetches from network first', async () => {
    const cache = new ApiCache({ strategy: 'network-first' });
    const fetcher = jest.fn().mockResolvedValue({ id: 3 });
    const result = await cache.execute('users:3', fetcher);
    expect(result).toEqual({ id: 3 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test('falls back to cache on network error', async () => {
    const cache = new ApiCache({ strategy: 'network-first' });
    // Seed cache first via network-only
    const seedCache = new ApiCache({ strategy: 'network-only', store: cache._store });
    await seedCache.execute('users:4', () => Promise.resolve({ id: 4 }));
    // Now test network-first fallback
    const failFetcher = jest.fn().mockRejectedValue(new Error('Network fail'));
    const result = await cache.execute('users:4', failFetcher);
    expect(result).toEqual({ id: 4 });
  });

  test('throws if network fails and no cache', async () => {
    const cache = new ApiCache({ strategy: 'network-first' });
    const failFetcher = () => Promise.reject(new Error('Network fail'));
    await expect(cache.execute('users:999', failFetcher)).rejects.toThrow('Network fail');
  });
});

describe('ApiCache — stale-while-revalidate strategy', () => {
  test('returns cached value immediately and revalidates', async () => {
    const cache = new ApiCache({ strategy: 'stale-while-revalidate', ttl: 5000 });
    await cache.execute('k', () => Promise.resolve('v1'));
    const fetcher = jest.fn().mockResolvedValue('v2');
    const result = await cache.execute('k', fetcher);
    expect(result).toBe('v1'); // Stale value returned immediately
  });

  test('fetches from network on miss', async () => {
    const cache = new ApiCache({ strategy: 'stale-while-revalidate' });
    const result = await cache.execute('new-key', () => Promise.resolve('fresh'));
    expect(result).toBe('fresh');
  });
});

describe('ApiCache — cache-only strategy', () => {
  test('returns cached value if present', async () => {
    const store = new MemoryStore();
    store.set('k', 'val');
    const cache = new ApiCache({ strategy: 'cache-only', store });
    const result = await cache.execute('k', () => { throw new Error('should not call'); });
    expect(result).toBe('val');
  });

  test('throws CACHE_MISS if not in cache', async () => {
    const cache = new ApiCache({ strategy: 'cache-only' });
    await expect(cache.execute('missing', () => {})).rejects.toMatchObject({ code: 'CACHE_MISS' });
  });
});

describe('ApiCache — network-only strategy', () => {
  test('always fetches, ignores cache', async () => {
    const cache = new ApiCache({ strategy: 'network-only', ttl: 5000 });
    const fetcher = jest.fn().mockResolvedValue({ id: 5 });
    await cache.execute('users:5', fetcher);
    await cache.execute('users:5', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('ApiCache — invalidatePrefix', () => {
  test('removes all keys with given prefix', async () => {
    const cache = new ApiCache({ strategy: 'cache-first', ttl: 5000 });
    await cache.execute('users:1', () => Promise.resolve('a'));
    await cache.execute('users:2', () => Promise.resolve('b'));
    await cache.execute('posts:1', () => Promise.resolve('c'));
    cache.invalidatePrefix('users:');
    const store = cache._store;
    expect(store.keys()).not.toContain('users:1');
    expect(store.keys()).not.toContain('users:2');
    expect(store.keys()).toContain('posts:1');
  });
});

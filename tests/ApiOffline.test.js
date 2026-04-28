'use strict';

const { StorageAdapter } = require('../src/Api/Offline/StorageAdapter');
const { MemoryStore } = require('../src/Api/Offline/MemoryStore');
const { LocalStorageStore } = require('../src/Api/Offline/LocalStorageStore');
const { SessionStorageStore } = require('../src/Api/Offline/SessionStorageStore');
const { MutationQueue } = require('../src/Api/Offline/MutationQueue');

// ── StorageAdapter interface ──────────────────────────────────────────────────

describe('StorageAdapter', () => {
  let adapter;
  beforeEach(() => { adapter = new StorageAdapter(); });

  test('get throws Not implemented', async () => {
    await expect(adapter.get('k')).rejects.toThrow('Not implemented');
  });

  test('set throws Not implemented', async () => {
    await expect(adapter.set('k', 'v')).rejects.toThrow('Not implemented');
  });

  test('delete throws Not implemented', async () => {
    await expect(adapter.delete('k')).rejects.toThrow('Not implemented');
  });

  test('clear throws Not implemented', async () => {
    await expect(adapter.clear()).rejects.toThrow('Not implemented');
  });

  test('keys throws Not implemented', async () => {
    await expect(adapter.keys()).rejects.toThrow('Not implemented');
  });
});

// ── MemoryStore ───────────────────────────────────────────────────────────────

describe('MemoryStore (Offline)', () => {
  let store;
  beforeEach(() => { store = new MemoryStore(); });

  test('set and get', async () => {
    await store.set('a', { val: 1 });
    expect(await store.get('a')).toEqual({ val: 1 });
  });

  test('get returns undefined for missing key', async () => {
    expect(await store.get('missing')).toBeUndefined();
  });

  test('delete removes key', async () => {
    await store.set('b', 2);
    await store.delete('b');
    expect(await store.get('b')).toBeUndefined();
  });

  test('clear removes all keys', async () => {
    await store.set('x', 1);
    await store.set('y', 2);
    await store.clear();
    expect(await store.get('x')).toBeUndefined();
    expect(await store.get('y')).toBeUndefined();
  });

  test('keys returns all stored keys', async () => {
    await store.set('k1', 1);
    await store.set('k2', 2);
    const keys = await store.keys();
    expect(keys).toEqual(expect.arrayContaining(['k1', 'k2']));
  });
});

// ── LocalStorageStore ─────────────────────────────────────────────────────────

describe('LocalStorageStore (Offline)', () => {
  test('falls back to MemoryStore in Node.js environment', () => {
    const ls = new LocalStorageStore();
    // In Node.js environment, localStorage is not available
    expect(ls._fallback).toBeDefined();
  });

  test('set and get via fallback', async () => {
    const ls = new LocalStorageStore();
    await ls.set('msg', 'hello');
    expect(await ls.get('msg')).toBe('hello');
  });

  test('delete via fallback', async () => {
    const ls = new LocalStorageStore();
    await ls.set('d', 'x');
    await ls.delete('d');
    expect(await ls.get('d')).toBeUndefined();
  });
});

// ── SessionStorageStore ───────────────────────────────────────────────────────

describe('SessionStorageStore (Offline)', () => {
  test('falls back to MemoryStore in Node.js environment', () => {
    const ss = new SessionStorageStore();
    expect(ss._fallback).toBeDefined();
  });

  test('set and get via fallback', async () => {
    const ss = new SessionStorageStore();
    await ss.set('sess', 'data');
    expect(await ss.get('sess')).toBe('data');
  });
});

// ── MutationQueue ─────────────────────────────────────────────────────────────

describe('MutationQueue', () => {
  function makeQueue(adapterOverride) {
    const store = new MemoryStore();
    const queue = new MutationQueue({
      store,
      adapter: adapterOverride || null
    });
    return queue;
  }

  test('enqueue adds operation to queue', async () => {
    const q = makeQueue();
    await q.enqueue({ method: 'POST', path: '/users', body: { name: 'Alice' } });
    const queue = await q.getQueue();
    expect(queue.length).toBe(1);
    expect(queue[0].method).toBe('POST');
    expect(queue[0].path).toBe('/users');
    expect(queue[0].id).toBeDefined();
    expect(queue[0].timestamp).toBeDefined();
  });

  test('enqueue generates unique ids', async () => {
    const q = makeQueue();
    await q.enqueue({ method: 'POST', path: '/a', body: {} });
    await q.enqueue({ method: 'POST', path: '/b', body: {} });
    const items = await q.getQueue();
    expect(items[0].id).not.toBe(items[1].id);
  });

  test('clear empties the queue', async () => {
    const q = makeQueue();
    await q.enqueue({ method: 'POST', path: '/users', body: {} });
    await q.clear();
    expect(await q.getQueue()).toEqual([]);
  });

  test('sync processes operations and removes successful ones', async () => {
    const successAdapter = {
      request: jest.fn().mockResolvedValue({ id: 1 })
    };
    const q = new MutationQueue({ adapter: successAdapter });
    await q.enqueue({ method: 'POST', path: '/users', body: { name: 'Bob' } });
    await q.sync();
    const remaining = await q.getQueue();
    expect(remaining).toEqual([]);
    expect(successAdapter.request).toHaveBeenCalledWith('POST', '/users', { body: { name: 'Bob' } });
  });

  test('sync keeps failed operations in queue', async () => {
    const failAdapter = {
      request: jest.fn().mockRejectedValue(new Error('Network offline'))
    };
    const q = new MutationQueue({ adapter: failAdapter });
    await q.enqueue({ method: 'POST', path: '/orders', body: {} });
    await q.sync();
    const remaining = await q.getQueue();
    expect(remaining.length).toBe(1);
  });

  test('onConflict handler called for failed operations', async () => {
    const failAdapter = {
      request: jest.fn().mockRejectedValue(new Error('Conflict'))
    };
    const conflictHandler = jest.fn();
    const q = new MutationQueue({ adapter: failAdapter });
    q.onConflict(conflictHandler);
    await q.enqueue({ method: 'PUT', path: '/items/1', body: {} });
    await q.sync();
    expect(conflictHandler).toHaveBeenCalled();
  });

  test('sync emits sync event', async () => {
    const successAdapter = { request: jest.fn().mockResolvedValue({}) };
    const q = new MutationQueue({ adapter: successAdapter });
    const onSync = jest.fn();
    q.on('sync', onSync);
    await q.enqueue({ method: 'POST', path: '/data', body: {} });
    await q.sync();
    expect(onSync).toHaveBeenCalled();
  });

  test('getQueue returns empty array initially', async () => {
    const q = makeQueue();
    expect(await q.getQueue()).toEqual([]);
  });
});

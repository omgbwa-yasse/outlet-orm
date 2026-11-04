'use strict';

const { MemoryStore } = require('./MemoryStore');

const QUEUE_KEY = '__outlet_mutation_queue__';

/**
 * MutationQueue — persists offline mutations and replays them when online.
 *
 * Usage:
 *   const queue = new MutationQueue({ store, adapter })
 *   await queue.enqueue({ method: 'POST', path: '/users', body: { name: 'Alice' } })
 *   await queue.sync()
 */
class MutationQueue {
  constructor(opts) {
    opts = opts || {};
    this._store   = opts.store   || new MemoryStore();
    this._adapter = opts.adapter || null;
    this._conflictHandler = opts.onConflict || null;
    this._listeners = { sync: [], error: [], conflict: [] };
    this._encrypt = opts.encrypt || null;
    this._decrypt = opts.decrypt || null;
    if (Boolean(this._encrypt) !== Boolean(this._decrypt)) {
      throw new Error('MutationQueue: encrypt and decrypt must be provided together');
    }
  }

  // ── Event emitter (minimal) ──────────────────────────────────────
  on(event, fn) {
    if (this._listeners[event]) this._listeners[event].push(fn);
    return this;
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach(fn => {
      try { fn(data); } catch (_) { /* listener errors must not break the queue */ }
    });
  }

  /**
   * Register a conflict handler.
   * fn(operation, serverError) => resolved data | throws
   */
  onConflict(fn) {
    this._conflictHandler = fn;
    return this;
  }

  // ── Queue management ─────────────────────────────────────────────
  async _load() {
    const raw = await this._store.get(QUEUE_KEY);
    if (raw && raw.__outletEncrypted) {
      const decrypted = await this._decrypt(raw.payload);
      return Array.isArray(decrypted) ? decrypted : [];
    }
    return Array.isArray(raw) ? raw : [];
  }

  async _save(queue) {
    if (this._encrypt) {
      await this._store.set(QUEUE_KEY, {
        __outletEncrypted: true,
        payload: await this._encrypt(queue)
      });
      return;
    }
    await this._store.set(QUEUE_KEY, queue);
  }

  /**
   * Enqueue an offline mutation.
   * @param {{ method, path, body, id? }} operation
   */
  async enqueue(operation) {
    const queue = await this._load();
    const op = Object.assign({
      id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : String(Date.now() + Math.random()),
      timestamp: Date.now()
    }, operation);
    queue.push(op);
    await this._save(queue);
    return op;
  }

  /**
   * Get all queued operations.
   */
  async getQueue() {
    return this._load();
  }

  /**
   * Clear the queue.
   */
  async clear() {
    await this._save([]);
  }

  /**
   * Replay all queued operations against the adapter.
   * Removes successful ones; calls onConflict for failures.
   */
  async sync() {
    if (!this._adapter) {
      throw new Error('MutationQueue: no adapter configured for sync');
    }

    const queue = await this._load();
    const remaining = [];
    const synced = [];

    for (const op of queue) {
      try {
        const result = await this._adapter.request(op.method, op.path, { body: op.body });
        synced.push({ op, result });
      } catch (err) {
        if (this._conflictHandler) {
          try {
            await Promise.resolve(this._conflictHandler(op, err));
            // If handler resolves without throwing, consider it handled
            synced.push({ op, skipped: true });
          } catch (e2) {
            remaining.push(op);
            this._emit('conflict', { op, error: e2 });
          }
        } else {
          remaining.push(op);
          this._emit('error', { op, error: err });
        }
      }
    }

    await this._save(remaining);
    this._emit('sync', { synced, remaining });
    return { synced, remaining };
  }

  get length() {
    // Synchronous length is not directly available; return -1 as hint to use async
    return -1;
  }
}

module.exports = { MutationQueue };

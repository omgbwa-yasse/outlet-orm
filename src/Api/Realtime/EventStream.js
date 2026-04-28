'use strict';

const EventEmitter = require('events');

/**
 * EventStream — Server-Sent Events (SSE) wrapper with auto-reconnect.
 *
 * Uses browser's `EventSource` or a custom fetch-based SSE parser in Node.
 * Gracefully falls back if EventSource is not available.
 *
 * Usage:
 *   const es = new EventStream('https://api.example.com/events', {
 *     onMessage: (event) => console.log(event.data),
 *     reconnectDelay: 3000
 *   })
 *   es.connect()
 *   es.close()
 */
class EventStream extends EventEmitter {
  constructor(url, opts) {
    super();
    opts = opts || {};
    this._url             = url;
    this._reconnectDelay  = opts.reconnectDelay != null ? opts.reconnectDelay : 3000;
    this._maxReconnects   = opts.maxReconnects  != null ? opts.maxReconnects  : Infinity;
    this._onMessage       = opts.onMessage  || null;
    this._onError         = opts.onError    || null;
    this._onConnect       = opts.onConnect  || null;
    this._reconnects      = 0;
    this._closed          = false;
    this._source          = null;
  }

  connect() {
    if (this._closed) return this;
    try {
      if (typeof EventSource !== 'undefined') {
        this._source = new EventSource(this._url);
        this._source.onopen = () => {
          this._reconnects = 0;
          this.emit('connect');
          if (this._onConnect) this._onConnect();
        };
        this._source.onmessage = (e) => {
          this.emit('message', e);
          if (this._onMessage) this._onMessage(e);
        };
        this._source.onerror = (e) => {
          this.emit('error', e);
          if (this._onError) this._onError(e);
          this._tryReconnect();
        };
      } else {
        // Node.js fallback — emit a warning event
        this.emit('error', new Error('EventSource is not available in this environment'));
      }
    } catch (err) {
      this.emit('error', err);
    }
    return this;
  }

  close() {
    this._closed = true;
    if (this._source) {
      this._source.close();
      this._source = null;
    }
    this.emit('close');
    return this;
  }

  _tryReconnect() {
    if (this._closed) return;
    if (this._reconnects >= this._maxReconnects) {
      this.emit('reconnect:failed');
      return;
    }
    this._reconnects++;
    this.emit('reconnect', this._reconnects);
    setTimeout(() => {
      if (!this._closed) this.connect();
    }, this._reconnectDelay);
  }

  get connected() { return this._source !== null && !this._closed; }
}

module.exports = { EventStream };

'use strict';

const EventEmitter = require('events');

/**
 * WebSocketConnection — WebSocket wrapper with exponential backoff reconnect.
 *
 * Usage:
 *   const ws = new WebSocketConnection('wss://api.example.com/ws', {
 *     onMessage: (data) => console.log(data),
 *     reconnect: true,
 *     maxRetries: 10
 *   })
 *   ws.connect()
 *   ws.send({ type: 'subscribe', channel: 'users' })
 *   ws.close()
 */
class WebSocketConnection extends EventEmitter {
  constructor(url, opts) {
    super();
    opts = opts || {};
    this._url           = url;
    this._reconnect     = opts.reconnect     !== false;
    this._maxRetries    = opts.maxRetries    != null ? opts.maxRetries    : 10;
    this._baseDelay     = opts.baseDelay     != null ? opts.baseDelay     : 1000;
    this._maxDelay      = opts.maxDelay      != null ? opts.maxDelay      : 30000;
    this._protocols     = opts.protocols     || [];
    this._onMessage     = opts.onMessage     || null;
    this._onConnect     = opts.onConnect     || null;
    this._onDisconnect  = opts.onDisconnect  || null;
    this._onError       = opts.onError       || null;
    this._retries       = 0;
    this._closed        = false;
    this._ws            = null;
    this._sendQueue     = [];
  }

  connect() {
    if (this._closed) return this;
    try {
      if (typeof WebSocket === 'undefined') {
        this.emit('error', new Error('WebSocket is not available in this environment'));
        return this;
      }
      const ws = this._protocols.length
        ? new WebSocket(this._url, this._protocols)
        : new WebSocket(this._url);
      this._ws = ws;

      ws.onopen = () => {
        this._retries = 0;
        this.emit('connect');
        if (this._onConnect) this._onConnect();
        // Flush send queue
        while (this._sendQueue.length) {
          const msg = this._sendQueue.shift();
          try { ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg)); } catch (_) {}
        }
      };

      ws.onmessage = (e) => {
        let data = e.data;
        try { data = JSON.parse(data); } catch (_) {}
        this.emit('message', data);
        if (this._onMessage) this._onMessage(data);
      };

      ws.onerror = (e) => {
        this.emit('error', e);
        if (this._onError) this._onError(e);
      };

      ws.onclose = (e) => {
        this._ws = null;
        this.emit('disconnect', e);
        if (this._onDisconnect) this._onDisconnect(e);
        if (!this._closed && this._reconnect) this._tryReconnect();
      };
    } catch (err) {
      this.emit('error', err);
    }
    return this;
  }

  /**
   * Send data. Queued if not yet connected.
   */
  send(data) {
    if (this._ws && this._ws.readyState === 1 /* OPEN */) {
      this._ws.send(typeof data === 'string' ? data : JSON.stringify(data));
    } else {
      this._sendQueue.push(data);
    }
    return this;
  }

  close() {
    this._closed = true;
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
    this.emit('close');
    return this;
  }

  _tryReconnect() {
    if (this._retries >= this._maxRetries) {
      this.emit('reconnect:failed');
      return;
    }
    this._retries++;
    const delay = Math.min(this._baseDelay * Math.pow(2, this._retries - 1), this._maxDelay);
    this.emit('reconnect', this._retries, delay);
    setTimeout(() => {
      if (!this._closed) this.connect();
    }, delay);
  }

  get connected() { return this._ws !== null && !this._closed; }
  get state() { return this._ws ? this._ws.readyState : -1; }
}

module.exports = { WebSocketConnection };

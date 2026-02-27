/**
 * BackupSocketClient
 *
 * Connects to a BackupSocketServer daemon and exposes a promise-based API
 * to schedule, stop, and trigger backup jobs remotely.
 *
 * Usage:
 *   const client = new BackupSocketClient({ port: 9119 });
 *   await client.connect();
 *
 *   await client.schedule('full', { intervalMs: 3600000, name: 'hourly' });
 *   await client.run('partial', ['users', 'orders'], { format: 'json' });
 *   const status = await client.status();
 *
 *   client.on('jobDone',  ({ name, filePath }) => console.log('Done:', filePath));
 *   client.on('jobError', ({ name, error })    => console.error('Error:', error));
 *
 *   await client.disconnect();
 */

'use strict';

const net    = require('net');
const events = require('events');

const DEFAULT_PORT    = 9119;
const DEFAULT_HOST    = '127.0.0.1';
const DEFAULT_TIMEOUT = 30_000;  // ms to wait for a server reply

class BackupSocketClient extends events.EventEmitter {
  /**
   * @param {object} [options]
   * @param {number} [options.port=9119]
   * @param {string} [options.host='127.0.0.1']
   * @param {number} [options.timeout=30000]  Reply timeout in ms
   */
  constructor(options = {}) {
    super();
    this.port    = options.port    || DEFAULT_PORT;
    this.host    = options.host    || DEFAULT_HOST;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;

    this._socket  = null;
    this._buffer  = '';
    this._pending = [];  // [{ resolve, reject, timer }]
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Connection
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Establish a connection to the BackupSocketServer.
   * @returns {Promise<void>}
   */
  connect() {
    return new Promise((resolve, reject) => {
      this._socket = net.createConnection({ port: this.port, host: this.host }, () => {
        this._socket.setEncoding('utf8');
        this.emit('connect');
        resolve();
      });

      this._socket.on('data',  (chunk)  => this._onData(chunk));
      this._socket.on('error', (err)    => this._onError(err));
      this._socket.on('close', ()       => this._onClose());

      this._socket.once('error', reject);
    });
  }

  /**
   * Close the connection to the server.
   * @returns {Promise<void>}
   */
  disconnect() {
    return new Promise((resolve) => {
      if (!this._socket) { resolve(); return; }
      this._socket.once('close', resolve);
      this._socket.end();
    });
  }

  /** Whether the client has an active socket. */
  get connected() {
    return this._socket !== null && !this._socket.destroyed;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Remote API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Ping the server.
   * @returns {Promise<'pong'>}
   */
  ping() {
    return this._send({ action: 'ping' });
  }

  /**
   * Get server status (uptime, active jobs, connected clients).
   * @returns {Promise<{ uptime: number, jobs: string[], clients: number }>}
   */
  status() {
    return this._send({ action: 'status' });
  }

  /**
   * List active job names.
   * @returns {Promise<string[]>}
   */
  jobs() {
    return this._send({ action: 'jobs' });
  }

  /**
   * Schedule a recurring backup job on the server.
   *
   * @param {'full'|'partial'|'journal'} type
   * @param {object} config
   * @param {number} config.intervalMs
   * @param {string} [config.name]
   * @param {string[]} [config.tables]  Required for 'partial'
   * @param {string} [config.format]
   * @param {boolean} [config.flush]
   * @param {boolean} [config.runNow]
   * @param {boolean} [config.encrypt]
   * @param {string}  [config.encryptionPassword]
   * @param {number}  [config.saltLength]
   * @returns {Promise<string>}  Job name
   */
  schedule(type, config) {
    return this._send({ action: 'schedule', type, config });
  }

  /**
   * Stop a scheduled job by name.
   * @param {string} name
   * @returns {Promise<boolean>}
   */
  stop(name) {
    return this._send({ action: 'stop', name });
  }

  /**
   * Stop all scheduled jobs on the server.
   * @returns {Promise<boolean>}
   */
  stopAll() {
    return this._send({ action: 'stopAll' });
  }

  /**
   * Trigger an immediate (one-shot) backup.
   *
   * @param {'full'|'partial'|'journal'} type
   * @param {string[]} [tables]    Required for 'partial'
   * @param {object}   [options]
   * @param {string}   [options.format]
   * @param {string}   [options.filename]
   * @param {boolean}  [options.encrypt]
   * @param {string}   [options.encryptionPassword]
   * @param {number}   [options.saltLength]
   * @returns {Promise<string>}  Absolute file path of the created backup
   */
  run(type, tables, options = {}) {
    // Allow calling run('full', options) without tables
    if (tables && !Array.isArray(tables)) {
      options = tables;
      tables  = undefined;
    }
    return this._send({ action: 'run', type, tables, options });
  }

  /**
   * Restore a previously created backup file (SQL or encrypted .enc).
   *
   * @param {string} filePath  Absolute path to the backup file on the server
   * @param {object} [options]
   * @param {string} [options.encryptionPassword]  Required if the file is encrypted
   * @returns {Promise<{ statements: number }>}
   */
  restore(filePath, options = {}) {
    return this._send({ action: 'restore', filePath, options });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Internal socket plumbing
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send a command and wait for the corresponding reply.
   * Replies are matched in FIFO order (server always echoes in order).
   * @private
   */
  _send(payload) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        return reject(new Error('BackupSocketClient: not connected'));
      }

      const timer = setTimeout(() => {
        const idx = this._pending.findIndex((p) => p.reject === reject);
        if (idx !== -1) this._pending.splice(idx, 1);
        reject(new Error(`BackupSocketClient: timeout waiting for reply to "${payload.action}"`));
      }, this.timeout);

      this._pending.push({ resolve, reject, timer });
      this._socket.write(JSON.stringify(payload) + '\n');
    });
  }

  /** @private */
  _onData(chunk) {
    this._buffer += chunk;
    const lines = this._buffer.split('\n');
    this._buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let msg;
      try {
        msg = JSON.parse(trimmed);
      } catch (_) {
        continue;
      }

      // Server push events (no matching request)
      if (msg.event) {
        this.emit(msg.event, msg);
        this.emit('serverEvent', msg);
        continue;
      }

      // Reply to a pending request (FIFO)
      const pending = this._pending.shift();
      if (!pending) continue;

      clearTimeout(pending.timer);

      if (msg.ok) {
        pending.resolve(msg.result);
      } else {
        pending.reject(new Error(msg.error || 'Unknown server error'));
      }
    }
  }

  /** @private */
  _onError(err) {
    this.emit('error', err);
    // Reject all pending requests
    for (const { reject, timer } of this._pending) {
      clearTimeout(timer);
      reject(err);
    }
    this._pending = [];
  }

  /** @private */
  _onClose() {
    this._socket = null;
    this.emit('disconnect');
    for (const { reject, timer } of this._pending) {
      clearTimeout(timer);
      reject(new Error('BackupSocketClient: connection closed'));
    }
    this._pending = [];
  }
}

module.exports = BackupSocketClient;

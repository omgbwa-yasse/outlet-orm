/**
 * BackupSocketServer
 *
 * A long-running TCP daemon that manages backup jobs for outlet-orm.
 * Clients connect, send JSON commands, and receive JSON responses.
 *
 * Protocol: newline-delimited JSON (NDJSON) over TCP.
 *
 * ─── Client → Server commands ─────────────────────────────────────────
 *  { "action": "schedule", "type": "full|partial|journal",
 *    "config": { "intervalMs": 3600000, "tables": [...], "name": "...",
 *                "format": "sql|json", "flush": false,
 *                "encrypt": true, "encryptionPassword": "...", "saltLength": 6 } }
 *
 *  { "action": "stop",    "name": "job_name" }
 *  { "action": "stopAll" }
 *  { "action": "jobs" }
 *  { "action": "run",    "type": "full|partial|journal",
 *    "tables": [...], "options": { "format": "sql", "filename": "..." } }
 *  { "action": "restore", "filePath": "/abs/path/to/backup.sql",
 *    "options": { "encryptionPassword": "..." } }
 *  { "action": "status" }
 *  { "action": "ping" }
 *
 * ─── Server → Client responses ────────────────────────────────────────
 *  { "ok": true,  "result": <any> }
 *  { "ok": false, "error":  "message" }
 *
 * ─── Server → All clients (push events) ──────────────────────────────
 *  { "event": "jobStart", "name": "...", "type": "..." }
 *  { "event": "jobDone",  "name": "...", "type": "...", "filePath": "..." }
 *  { "event": "jobError", "name": "...", "type": "...", "error": "..." }
 *
 * Usage:
 *   const server = new BackupSocketServer(db, { port: 9119, backupPath: './database/backups' });
 *   await server.listen();   // starts the daemon
 *   // ...
 *   await server.close();    // graceful shutdown
 */

'use strict';

const net    = require('net');
const events = require('events');
const BackupManager   = require('./BackupManager');
const BackupScheduler = require('./BackupScheduler');

const DEFAULT_PORT = 9119;
const DEFAULT_HOST = '127.0.0.1';

class BackupSocketServer extends events.EventEmitter {
  /**
   * @param {import('../DatabaseConnection')} connection
   * @param {object}  [options]
   * @param {number}  [options.port=9119]
   * @param {string}  [options.host='127.0.0.1']
   * @param {string}  [options.backupPath]         Forwarded to BackupManager
   * @param {boolean} [options.encrypt]            Default encryption for all jobs
   * @param {string}  [options.encryptionPassword] Default encryption password
   * @param {number}  [options.saltLength]         Default grain de sable length
   */
  constructor(connection, options = {}) {
    super();
    this.connection = connection;
    this.port    = options.port || DEFAULT_PORT;
    this.host    = options.host || DEFAULT_HOST;

    this._managerOptions = {
      backupPath         : options.backupPath,
      encrypt            : options.encrypt,
      encryptionPassword : options.encryptionPassword,
      saltLength         : options.saltLength,
    };

    this.manager   = new BackupManager(connection, this._managerOptions);
    this.scheduler = new BackupScheduler(connection, this._managerOptions);

    /** @type {Set<net.Socket>} */
    this._clients = new Set();
    this._server  = null;
    this._startTime = null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Start the TCP server and begin accepting connections.
   * @returns {Promise<void>}
   */
  listen() {
    return new Promise((resolve, reject) => {
      this._server = net.createServer((socket) => this._handleClient(socket));

      this._server.on('error', (err) => {
        this.emit('error', err);
        reject(err);
      });

      this._server.listen(this.port, this.host, () => {
        this._startTime = Date.now();
        const addr = `${this.host}:${this.port}`;
        console.log(`✓ BackupSocketServer listening on ${addr}`);
        this.emit('listening', { host: this.host, port: this.port });
        resolve();
      });
    });
  }

  /**
   * Gracefully stop the server and all scheduled jobs.
   * @returns {Promise<void>}
   */
  close() {
    return new Promise((resolve) => {
      this.scheduler.stopAll();

      // Close all client connections
      for (const sock of this._clients) {
        try { sock.destroy(); } catch (_) { /* ignore */ }
      }
      this._clients.clear();

      if (this._server) {
        this._server.close(() => {
          console.log('✓ BackupSocketServer closed');
          this.emit('close');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Return server address info.
   * @returns {{ host: string, port: number } | null}
   */
  address() {
    if (!this._server) return null;
    const addr = this._server.address();
    return addr ? { host: addr.address, port: addr.port } : null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Client handling
  // ─────────────────────────────────────────────────────────────────────────────

  /** @private */
  _handleClient(socket) {
    this._clients.add(socket);
    let buffer = '';

    socket.setEncoding('utf8');

    socket.on('data', (chunk) => {
      buffer += chunk;
      // Messages are newline-delimited
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this._processMessage(socket, trimmed);
      }
    });

    socket.on('close', () => {
      this._clients.delete(socket);
    });

    socket.on('error', (err) => {
      this._clients.delete(socket);
      this.emit('clientError', err);
    });
  }

  /** @private */
  async _processMessage(socket, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (_) {
      this._send(socket, { ok: false, error: 'Invalid JSON' });
      return;
    }

    try {
      const result = await this._dispatch(msg);
      this._send(socket, { ok: true, result });
    } catch (err) {
      this._send(socket, { ok: false, error: err.message || String(err) });
    }
  }

  /** @private */
  async _dispatch(msg) {
    switch (msg.action) {

    case 'ping':
      return 'pong';

    case 'status':
      return {
        uptime : this._startTime ? Date.now() - this._startTime : 0,
        jobs   : this.scheduler.activeJobs(),
        clients: this._clients.size,
      };

    case 'jobs':
      return this.scheduler.activeJobs();

    case 'schedule': {
      const type   = msg.type;
      const config = Object.assign({}, msg.config || {});

      // Merge per-job encryption options with server defaults
      const jobManagerOpts = this._buildManagerOptions(config);

      // Use a mutable ref so callbacks always carry the final job name
      // (which may be auto-generated if config.name was not provided)
      const nameRef = { value: config.name || type };

      // Wrap success/error to emit events to all connected clients
      const originalOnSuccess = config.onSuccess;
      const originalOnError   = config.onError;

      config.onSuccess = (filePath) => {
        this._broadcast({ event: 'jobDone', name: nameRef.value, type, filePath });
        if (typeof originalOnSuccess === 'function') originalOnSuccess(filePath);
      };
      config.onError = (err) => {
        this._broadcast({ event: 'jobError', name: nameRef.value, type, error: err.message });
        if (typeof originalOnError === 'function') originalOnError(err);
      };

      // Create a dedicated scheduler with the right per-job manager options
      const jobScheduler = this._buildScheduler(jobManagerOpts);
      const name = jobScheduler.schedule(type, config);

      // Update ref with actual name (covers auto-generated names)
      nameRef.value = name;

      // Persist the interval handle in the main scheduler so status/stop work
      this.scheduler._jobs.set(name, jobScheduler._jobs.get(name));

      this._broadcast({ event: 'jobStart', name, type });
      return name;
    }

    case 'stop':
      this.scheduler.stop(msg.name);
      return true;

    case 'stopAll':
      this.scheduler.stopAll();
      return true;

    case 'run': {
      const type    = msg.type;
      const options = msg.options || {};
      const tables  = msg.tables;
      const runManagerOpts = this._buildManagerOptions(options);
      const runManager = new BackupManager(this.connection, runManagerOpts);

      let filePath;
      if (type === 'full') {
        filePath = await runManager.full(options);
      } else if (type === 'partial') {
        if (!Array.isArray(tables) || tables.length === 0) {
          throw new Error('\'tables\' array is required for partial backup');
        }
        filePath = await runManager.partial(tables, options);
      } else if (type === 'journal') {
        filePath = await runManager.journal(options);
      } else {
        throw new Error(`Unknown backup type "${type}"`);
      }
      return filePath;
    }

    case 'restore': {
      if (!msg.filePath) {
        throw new Error('\'filePath\' is required for restore');
      }
      // Build a restore-capable manager (needs encryptionPassword if file is encrypted)
      const restoreOpts = Object.assign({}, this._managerOptions, {
        encrypt           : false,   // manager doesn't need to encrypt on restore
        encryptionPassword: (msg.options && msg.options.encryptionPassword)
          || this._managerOptions.encryptionPassword,
      });
      const restoreManager = new BackupManager(this.connection, restoreOpts);
      return restoreManager.restore(msg.filePath, msg.options || {});
    }

    default:
      throw new Error(`Unknown action "${msg.action}"`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /** @private */
  _send(socket, payload) {
    if (socket.writable) {
      socket.write(JSON.stringify(payload) + '\n');
    }
  }

  /** @private */
  _broadcast(payload) {
    const line = JSON.stringify(payload) + '\n';
    for (const sock of this._clients) {
      if (sock.writable) sock.write(line);
    }
    this.emit('event', payload);
  }

  /**
   * Build BackupManager options, merging server defaults with per-call overrides.
   * @private
   */
  _buildManagerOptions(overrides = {}) {
    return {
      backupPath        : overrides.backupPath         || this._managerOptions.backupPath,
      encrypt           : overrides.encrypt            != null ? overrides.encrypt            : this._managerOptions.encrypt,
      encryptionPassword: overrides.encryptionPassword || this._managerOptions.encryptionPassword,
      saltLength        : overrides.saltLength         != null ? overrides.saltLength         : this._managerOptions.saltLength,
    };
  }

  /**
   * Build a throw-away BackupScheduler with a given manager.
   * @private
   */
  _buildScheduler(managerOptions) {
    const s = new BackupScheduler(this.connection, managerOptions);
    return s;
  }
}

module.exports = BackupSocketServer;

/**
 * BackupScheduler
 *
 * Wraps BackupManager to provide simple programmatic scheduling of backups
 * using Node.js timers (no external cron dependency).
 *
 * Usage example:
 *
 *   const { BackupScheduler } = require('outlet-orm');
 *
 *   const scheduler = new BackupScheduler(db, {
 *     backupPath: './database/backups'
 *   });
 *
 *   // Full backup every 24 h
 *   scheduler.schedule('full', { intervalMs: 24 * 60 * 60 * 1000 });
 *
 *   // Partial backup (users + orders) every hour
 *   scheduler.schedule('partial', {
 *     intervalMs : 60 * 60 * 1000,
 *     tables     : ['users', 'orders'],
 *   });
 *
 *   // Transaction-journal every 15 minutes with auto-flush
 *   scheduler.schedule('journal', {
 *     intervalMs: 15 * 60 * 1000,
 *     flush: true,
 *   });
 *
 *   // Stop all scheduled jobs
 *   scheduler.stopAll();
 */

'use strict';

const BackupManager = require('./BackupManager');

class BackupScheduler {
  /**
   * @param {import('../DatabaseConnection')} connection
   * @param {object}  [options]
   * @param {string}  [options.backupPath]  Forwarded to BackupManager
   */
  constructor(connection, options = {}) {
    this.manager = new BackupManager(connection, options);
    /** @type {Map<string, NodeJS.Timeout>} */
    this._jobs = new Map();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Schedule a recurring backup.
   *
   * @param {'full'|'partial'|'journal'} type
   * @param {object}   config
   * @param {number}   config.intervalMs   Interval in milliseconds between backups
   * @param {boolean}  [config.runNow=false]  Execute once immediately before scheduling
   * @param {string[]} [config.tables]     Required when type is 'partial'
   * @param {string}   [config.format]     'sql' | 'json' (for full/partial)
   * @param {boolean}  [config.flush]      Flush query log after each journal backup
   * @param {Function} [config.onSuccess]  Callback(filePath) after a successful backup
   * @param {Function} [config.onError]    Callback(error) on backup failure
   * @param {string}   [config.name]       Optional job identifier (defaults to type)
   * @returns {string}  Job name
   */
  schedule(type, config) {
    if (!['full', 'partial', 'journal'].includes(type)) {
      throw new Error(`BackupScheduler: invalid backup type "${type}". Use 'full', 'partial', or 'journal'.`);
    }
    if (!config.intervalMs || config.intervalMs < 1000) {
      throw new Error('BackupScheduler: intervalMs must be >= 1000 (1 second)');
    }
    if (type === 'partial' && (!Array.isArray(config.tables) || config.tables.length === 0)) {
      throw new Error("BackupScheduler: 'tables' array is required for partial backups");
    }

    const name = config.name || `${type}_${Date.now()}`;

    if (this._jobs.has(name)) {
      this.stop(name);
    }

    const run = () => this._execute(type, config);

    if (config.runNow) {
      run();
    }

    const handle = setInterval(run, config.intervalMs);
    this._jobs.set(name, handle);

    console.log(`✓ BackupScheduler: "${name}" scheduled every ${this._humanize(config.intervalMs)}`);
    return name;
  }

  /**
   * Stop a specific scheduled job.
   * @param {string} name
   */
  stop(name) {
    if (this._jobs.has(name)) {
      clearInterval(this._jobs.get(name));
      this._jobs.delete(name);
      console.log(`✓ BackupScheduler: job "${name}" stopped`);
    }
  }

  /**
   * Stop all scheduled jobs.
   */
  stopAll() {
    for (const name of this._jobs.keys()) {
      this.stop(name);
    }
  }

  /**
   * Returns a list of currently active job names.
   * @returns {string[]}
   */
  activeJobs() {
    return [...this._jobs.keys()];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Execute the appropriate backup method and invoke callbacks.
   * @private
   */
  async _execute(type, config) {
    try {
      let filePath;
      const opts = { format: config.format, flush: config.flush };

      if (type === 'full') {
        filePath = await this.manager.full(opts);
      } else if (type === 'partial') {
        filePath = await this.manager.partial(config.tables, opts);
      } else if (type === 'journal') {
        filePath = await this.manager.journal(opts);
      }

      if (typeof config.onSuccess === 'function') {
        config.onSuccess(filePath);
      }
    } catch (err) {
      if (typeof config.onError === 'function') {
        config.onError(err);
      } else {
        console.error(`BackupScheduler error (${type}):`, err.message);
      }
    }
  }

  /**
   * Convert milliseconds to a human-readable string.
   * @private
   * @param {number} ms
   * @returns {string}
   */
  _humanize(ms) {
    if (ms < 60_000)  return `${ms / 1000}s`;
    if (ms < 3_600_000) return `${ms / 60_000}min`;
    if (ms < 86_400_000) return `${ms / 3_600_000}h`;
    return `${ms / 86_400_000}d`;
  }
}

module.exports = BackupScheduler;

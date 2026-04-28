'use strict';

const EventEmitter = require('events');

/**
 * Watcher — interval-based polling for resource changes.
 *
 * Usage:
 *   const w = new Watcher({
 *     poll: () => User.all(),
 *     interval: 5000,
 *     onChange: (newData, oldData) => console.log('changed', newData)
 *   })
 *   w.start()
 *   w.pause()
 *   w.resume()
 *   w.stop()
 */
class Watcher extends EventEmitter {
  constructor(opts) {
    super();
    opts = opts || {};
    this._pollFn   = opts.poll     || null;
    this._interval = opts.interval || 5000;
    this._onChange = opts.onChange || null;
    this._compare  = opts.compare  || null; // custom equality fn
    this._state    = 'stopped'; // 'stopped' | 'running' | 'paused'
    this._timer    = null;
    this._lastData = undefined;
  }

  /**
   * Start polling immediately, then every `interval` ms.
   */
  start() {
    if (this._state === 'running') return this;
    this._state = 'running';
    this._tick();
    this._timer = setInterval(() => {
      if (this._state === 'running') this._tick();
    }, this._interval);
    this.emit('start');
    return this;
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._state = 'stopped';
    this.emit('stop');
    return this;
  }

  pause() {
    if (this._state === 'running') {
      this._state = 'paused';
      this.emit('pause');
    }
    return this;
  }

  resume() {
    if (this._state === 'paused') {
      this._state = 'running';
      this.emit('resume');
    }
    return this;
  }

  async _tick() {
    if (!this._pollFn) return;
    try {
      const data = await Promise.resolve(this._pollFn());
      const changed = this._lastData === undefined ||
        (this._compare ? !this._compare(data, this._lastData) : JSON.stringify(data) !== JSON.stringify(this._lastData));
      if (changed) {
        const old = this._lastData;
        this._lastData = data;
        this.emit('change', data, old);
        if (this._onChange) this._onChange(data, old);
      }
    } catch (err) {
      this.emit('error', err);
    }
  }

  get state() { return this._state; }
}

module.exports = { Watcher };

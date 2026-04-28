'use strict';

const EventEmitter = require('events');
const { ApiNotFoundError } = require('./Errors/ApiNotFoundError');
const { ApiValidationError } = require('./Errors/ApiValidationError');
const { ApiQueryNotSupportedError } = require('./Errors/ApiQueryNotSupportedError');

class Api extends EventEmitter {
  // ── Static configuration ───────────────────────────────────────────
  static configure(config) {
    this._config = Object.assign({}, this._config || {}, config);
    if (config.adapter) {
      this.adapter = config.adapter;
    }
  }

  static setDefaultAdapter(adapter) {
    Api.adapter = adapter;
  }

  static getDefaultAdapter() {
    return Api.adapter || null;
  }

  static _getAdapter() {
    const adapter = this.adapter || Api.adapter;
    if (!adapter) {
      throw new Error('No adapter configured. Call ' + this.name + '.configure({ adapter }) or Api.setDefaultAdapter(adapter).');
    }
    return adapter;
  }

  /**
   * Returns a scoped subclass that routes all requests through `overrideAdapter`
   * without mutating the model's own `static adapter`.
   * @param {ApiAdapter} overrideAdapter
   * @returns {typeof Api}
   */
  static usingAdapter(overrideAdapter) {
    // eslint-disable-next-line no-shadow
    class ScopedModel extends this {
      static _getAdapter() { return overrideAdapter; }
    }
    return ScopedModel;
  }

  // ── Schema statics ─────────────────────────────────────────────────
  static get endpoint() { return this._endpoint || null; }
  static set endpoint(v) { this._endpoint = v; }

  // ── Cache helpers (T041-T043) ─────────────────────────────────────
  static _getCache() {
    if (this._cacheInstance) return this._cacheInstance;
    const cfg = this._config && this._config.cache;
    if (!cfg) return null;
    const { ApiCache } = require('./ApiCache');
    this._cacheInstance = cfg instanceof ApiCache ? cfg : new ApiCache(cfg);
    return this._cacheInstance;
  }

  static clearCache() {
    if (this._cacheInstance) this._cacheInstance.clear();
    // Also clear the shared one if configured
    const cfg = this._config && this._config.cache;
    if (cfg && cfg.clear) cfg.clear();
  }

  static _invalidateCache(key) {
    const cache = this._getCache();
    if (!cache) return;
    if (key) {
      cache._store && cache._store.delete && cache._store.delete(key);
    } else {
      const ep = this.endpoint || '';
      cache.invalidatePrefix && cache.invalidatePrefix(ep);
    }
  }

  // ── Static finders ─────────────────────────────────────────────────
  static async find(id, opts) {
    const fresh = opts && opts.fresh;
    const adapter = this._getAdapter();
    const ep = this.endpoint;
    if (!ep) throw new Error(this.name + '.endpoint is not defined.');
    const path = ep + '/' + encodeURIComponent(id);
    const cache = !fresh && this._getCache();
    const cacheKey = path;

    const fetcher = async () => {
      try {
        const data = await adapter.request('GET', path);
        return data;
      } catch (err) {
        if (err instanceof ApiNotFoundError) return null;
        throw err;
      }
    };

    const raw = cache ? await cache.execute(cacheKey, fetcher, this) : await fetcher();
    if (raw == null) return null;
    return this._hydrate(raw);
  }

  static async findOrFail(id) {
    const instance = await this.find(id);
    if (!instance) {
      throw new ApiNotFoundError('Record with id ' + id + ' not found in ' + (this.endpoint || this.name));
    }
    return instance;
  }

  static async all(params) {
    return this.get(params);
  }

  static async get(params, opts) {
    const fresh = opts && opts.fresh;
    const adapter = this._getAdapter();
    const ep = this.endpoint;
    if (!ep) throw new Error(this.name + '.endpoint is not defined.');
    const qs = params ? new URLSearchParams(params).toString() : '';
    const path = qs ? ep + '?' + qs : ep;
    const cache = !fresh && this._getCache();
    const cacheKey = path;

    const fetcher = async () => {
      const data = await adapter.request('GET', path);
      return data;
    };

    const data = cache ? await cache.execute(cacheKey, fetcher, this) : await fetcher();
    const items = Array.isArray(data) ? data : (data && data.data ? data.data : []);
    return items.map(item => this._hydrate(item));
  }

  static async first(params) {
    const results = await this.get(params);
    return results.length ? results[0] : null;
  }

  static async create(data) {
    const adapter = this._getAdapter();
    const ep = this.endpoint;
    if (!ep) throw new Error(this.name + '.endpoint is not defined.');
    const instance = new this();
    instance._fill(data);
    // Auto-validate if rules defined
    if (this.rules) {
      const { ApiValidator } = require('./Validation/ApiValidator');
      const result = ApiValidator.validate(instance._attributes, this.rules, this.messages);
      if (!result.valid) {
        const { ApiValidationError } = require('./Errors/ApiValidationError');
        throw new ApiValidationError('Validation failed', { errors: result.errors, source: 'client' });
      }
    }
    instance.emit('creating', instance);
    this.emit('creating', instance);
    const responseData = await adapter.request('POST', ep, { body: instance._getRequestData() });
    instance._fill(responseData);
    instance._syncOriginal();
    instance.emit('created', instance);
    this.emit('created', instance);
    this._invalidateCache();
    return instance;
  }

  // ── Client-side validation (T047-T050) ───────────────────────────────
  validate(rules, messages) {
    const { ApiValidator } = require('./Validation/ApiValidator');
    const r = rules || this.constructor.rules || {};
    const m = messages || this.constructor.messages || {};
    return ApiValidator.validate(this._attributes, r, m);
  }

  async validateAsync(rules, messages) {
    const { ApiValidator } = require('./Validation/ApiValidator');
    const r = rules || this.constructor.rules || {};
    const m = messages || this.constructor.messages || {};
    return ApiValidator.validateAsync(this._attributes, r, m);
  }

  validateOrFail(rules, messages) {
    const result = this.validate(rules, messages);
    if (!result.valid) {
      const { ApiValidationError } = require('./Errors/ApiValidationError');
      throw new ApiValidationError('Validation failed', { errors: result.errors, source: 'client' });
    }
    return true;
  }

  // ── Constructor ───────────────────────────────────────────────────
  constructor(attributes) {
    super();
    this._attributes = {};
    this._original = {};
    this._dirty = {};
    this._casts = this.constructor.casts || {};
    if (attributes) {
      this._fill(attributes);
      this._syncOriginal();
    }

    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop in target || typeof prop === 'symbol' || prop.startsWith('_')) {
          return Reflect.get(target, prop, receiver);
        }
        if (prop in target._attributes) {
          return target._getCast(prop, target._attributes[prop]);
        }
        return Reflect.get(target, prop, receiver);
      },
      set(target, prop, value, receiver) {
        if (prop in target || typeof prop === 'symbol' || prop.startsWith('_')) {
          return Reflect.set(target, prop, value, receiver);
        }
        const casted = target._setCast(prop, value);
        if (target._attributes[prop] !== casted) {
          target._dirty[prop] = casted;
        }
        target._attributes[prop] = casted;
        return true;
      }
    });
  }

  // ── Attribute helpers ─────────────────────────────────────────────
  _fill(data) {
    if (!data || typeof data !== 'object') return;
    const fillable = this.constructor.fillable;
    const keys = (fillable && fillable.length) ? fillable : Object.keys(data);
    for (const key of keys) {
      if (key in data) {
        this._attributes[key] = this._setCast(key, data[key]);
      }
    }
    const pk = this.constructor.primaryKey || 'id';
    if (pk in data && !(pk in this._attributes)) {
      this._attributes[pk] = data[pk];
    } else if (pk in data) {
      this._attributes[pk] = data[pk];
    }
    // Also set unfillable keys that are in data (like id)
    if (!fillable || !fillable.length) {
      // all keys already handled
    } else {
      // always copy primary key
      if (pk in data) this._attributes[pk] = data[pk];
    }
  }

  _syncOriginal() {
    this._original = Object.assign({}, this._attributes);
    this._dirty = {};
  }

  _getCast(key, value) {
    const cast = this._casts[key];
    if (!cast) return value;
    switch (cast) {
      case 'int':
      case 'integer': return value != null ? parseInt(value, 10) : value;
      case 'float':
      case 'number': return value != null ? parseFloat(value) : value;
      case 'bool':
      case 'boolean': return value != null ? Boolean(value) : value;
      case 'string': return value != null ? String(value) : value;
      case 'array': return Array.isArray(value) ? value : (value ? JSON.parse(value) : []);
      case 'object': return value && typeof value === 'string' ? JSON.parse(value) : (value || {});
      case 'date': return value ? new Date(value) : value;
      default: return value;
    }
  }

  _setCast(key, value) {
    return this._getCast(key, value);
  }

  _getRequestData() {
    return Object.assign({}, this._attributes);
  }

  // ── Dirty tracking ────────────────────────────────────────────────
  isDirty(attr) {
    if (attr) return attr in this._dirty;
    return Object.keys(this._dirty).length > 0;
  }

  getDirty() {
    return Object.assign({}, this._dirty);
  }

  wasChanged(attr) {
    if (attr) return this._original[attr] !== this._attributes[attr];
    return Object.keys(this._attributes).some(k => this._original[k] !== this._attributes[k]);
  }

  // ── Persistence ───────────────────────────────────────────────────
  async save() {
    const adapter = this.constructor._getAdapter();
    const ep = this.constructor.endpoint;
    if (!ep) throw new Error(this.constructor.name + '.endpoint is not defined.');

    // Auto-validate if rules defined
    if (this.constructor.rules) {
      const { ApiValidator } = require('./Validation/ApiValidator');
      const result = ApiValidator.validate(this._attributes, this.constructor.rules, this.constructor.messages);
      if (!result.valid) {
        const { ApiValidationError: VErr } = require('./Errors/ApiValidationError');
        throw new VErr('Validation failed', { errors: result.errors, source: 'client' });
      }
    }

    const pk = this.constructor.primaryKey || 'id';
    const id = this._attributes[pk];

    if (id) {
      this.emit('updating', this);
      this.constructor.emit && this.constructor.emit('updating', this);
      const path = ep + '/' + encodeURIComponent(id);
      const responseData = await adapter.request('PATCH', path, { body: this._getRequestData() });
      this._fill(responseData);
      this._syncOriginal();
      this.emit('updated', this);
      this.constructor.emit && this.constructor.emit('updated', this);
    } else {
      this.emit('creating', this);
      this.constructor.emit && this.constructor.emit('creating', this);
      const responseData = await adapter.request('POST', ep, { body: this._getRequestData() });
      this._fill(responseData);
      this._syncOriginal();
      this.emit('created', this);
      this.constructor.emit && this.constructor.emit('created', this);
    }
    // Auto-invalidate cache after mutation
    this.constructor._invalidateCache && this.constructor._invalidateCache();
    return this;
  }

  async destroy() {
    const adapter = this.constructor._getAdapter();
    const ep = this.constructor.endpoint;
    if (!ep) throw new Error(this.constructor.name + '.endpoint is not defined.');
    const pk = this.constructor.primaryKey || 'id';
    const id = this._attributes[pk];
    if (!id) throw new Error('Cannot delete a record without a primary key.');
    this.emit('deleting', this);
    this.constructor.emit && this.constructor.emit('deleting', this);
    const path = ep + '/' + encodeURIComponent(id);
    await adapter.request('DELETE', path);
    // Auto-invalidate cache
    this.constructor._invalidateCache && this.constructor._invalidateCache();
    this.emit('deleted', this);
    this.constructor.emit && this.constructor.emit('deleted', this);
    return true;
  }

  async delete() {
    return this.destroy();
  }

  // ── Serialization ─────────────────────────────────────────────────
  toJSON() {
    const hidden = this.constructor.hidden || [];
    const out = {};
    for (const key of Object.keys(this._attributes)) {
      if (!hidden.includes(key)) {
        const v = this._attributes[key];
        out[key] = v instanceof Date ? v.toISOString() : v;
      }
    }
    return out;
  }

  only(keys) {
    const out = {};
    for (const key of keys) {
      if (key in this._attributes) out[key] = this._attributes[key];
    }
    return out;
  }

  except(keys) {
    const out = {};
    for (const key of Object.keys(this._attributes)) {
      if (!keys.includes(key)) out[key] = this._attributes[key];
    }
    return out;
  }

  // ── Instance helpers ──────────────────────────────────────────────
  replicate() {
    const copy = new this.constructor(Object.assign({}, this._attributes));
    const pk = this.constructor.primaryKey || 'id';
    delete copy._attributes[pk];
    copy._syncOriginal();
    return copy;
  }

  async fresh() {
    const pk = this.constructor.primaryKey || 'id';
    const id = this._attributes[pk];
    if (!id) throw new Error('Cannot refresh a record without a primary key.');
    return this.constructor.find(id);
  }

  async refresh() {
    const pk = this.constructor.primaryKey || 'id';
    const id = this._attributes[pk];
    if (!id) throw new Error('Cannot refresh a record without a primary key.');
    const adapter = this.constructor._getAdapter();
    const ep = this.constructor.endpoint;
    const path = ep + '/' + encodeURIComponent(id);
    const data = await adapter.request('GET', path);
    this._fill(data);
    this._syncOriginal();
    return this;
  }

  // ── Debug helpers ──────────────────────────────────────────────────
  dd() {
    console.log(this.toJSON());
    return undefined;
  }

  async toRequest() {
    const adapter = this.constructor._getAdapter();
    const ep = this.constructor.endpoint;
    if (!ep) throw new Error(this.constructor.name + '.endpoint is not defined.');
    const pk = this.constructor.primaryKey || 'id';
    const id = this._attributes[pk];
    const method = id ? 'PATCH' : 'POST';
    const path = id ? ep + '/' + encodeURIComponent(id) : ep;
    return adapter.toRequest(method, path, { body: this._getRequestData() });
  }

  // ── QueryBuilder static proxies (T031) ──────────────────────────────
  static query() {
    const { ApiQueryBuilder } = require('./ApiQueryBuilder');
    return new ApiQueryBuilder(this, this._getAdapter());
  }

  static where(col, opOrVal, val) {
    return arguments.length === 2
      ? this.query().where(col, opOrVal)
      : this.query().where(col, opOrVal, val);
  }

  static whereIn(col, vals) { return this.query().whereIn(col, vals); }
  static whereNull(col) { return this.query().whereNull(col); }
  static whereNotNull(col) { return this.query().whereNotNull(col); }
  static whereLike(col, val) { return this.query().whereLike(col, val); }
  static whereBetween(col, range) { return this.query().whereBetween(col, range); }
  static orderBy(col, dir) { return this.query().orderBy(col, dir); }
  static limit(n) { return this.query().limit(n); }
  static offset(n) { return this.query().offset(n); }
  static selectCols() {
    const cols = Array.prototype.slice.call(arguments);
    return this.query().select.apply(this.query(), cols);
  }

  static withRelations() {
    const relations = Array.prototype.slice.call(arguments);
    return this.query().with.apply(this.query(), relations);
  }

  static forParams(params) { return this.query().for(params); }
  static paginate(page, perPage) { return this.query().paginate(page, perPage); }
  static cursorPaginate(opts) { return this.query().cursorPaginate(opts); }
  static offsetPaginate(opts) { return this.query().offsetPaginate(opts); }
  static eachPage(perPage, fn) { return this.query().eachPage(perPage, fn); }
  static chunk(size, fn) { return this.query().chunk(size, fn); }

  // ── Relations (T035-T037) ─────────────────────────────────────────────
  static hasMany(RelatedClass, foreignKey, options) {
    options = options || {};
    return {
      type: 'hasMany',
      RelatedClass,
      foreignKey,
      options,
      query(instance) {
        const { ApiQueryBuilder } = require('./ApiQueryBuilder');
        const pk = instance.constructor.primaryKey || 'id';
        const id = instance._attributes[pk];
        const adapter = RelatedClass.adapter || (RelatedClass._getAdapter ? RelatedClass._getAdapter() : null);
        return new ApiQueryBuilder(RelatedClass, adapter).where(foreignKey, id);
      }
    };
  }

  static hasOne(RelatedClass, foreignKey, options) {
    options = options || {};
    return {
      type: 'hasOne',
      RelatedClass,
      foreignKey,
      options,
      query(instance) {
        const { ApiQueryBuilder } = require('./ApiQueryBuilder');
        const pk = instance.constructor.primaryKey || 'id';
        const id = instance._attributes[pk];
        const adapter = RelatedClass.adapter || (RelatedClass._getAdapter ? RelatedClass._getAdapter() : null);
        return new ApiQueryBuilder(RelatedClass, adapter).where(foreignKey, id).limit(1);
      },
      async get(instance) {
        return this.query(instance).first();
      }
    };
  }

  static belongsTo(RelatedClass, foreignKey, options) {
    options = options || {};
    return {
      type: 'belongsTo',
      RelatedClass,
      foreignKey,
      options,
      async get(instance) {
        const fkVal = instance._attributes[foreignKey];
        if (fkVal == null) return null;
        return RelatedClass.find(fkVal);
      }
    };
  }

  // ── File attachment (T065) ────────────────────────────────────────────
  attach(field, file, name) {
    if (!this._attachments) this._attachments = {};
    this._attachments[field] = { file, name: name || (file && file.name) || field };
    return this;
  }

  // ── Strict response validation (T091) ────────────────────────────────
  static _validateResponse(data) {
    if (!this.strictResponse || !data || typeof data !== 'object') return;
    const schema = this.responseSchema || this.fillable || [];
    const pk = this.primaryKey || 'id';
    const unexpected = [];
    for (const key of Object.keys(data)) {
      if (key !== pk && !schema.includes(key)) {
        unexpected.push(key);
      }
    }
    if (unexpected.length) {
      const errors = {};
      unexpected.forEach(k => { errors[k] = 'Unexpected field in response'; });
      throw new ApiValidationError(
        'Unexpected response fields: ' + unexpected.join(', '),
        { source: 'server', errors }
      );
    }
  }

  // ── Hydration ─────────────────────────────────────────────────────
  static _hydrate(data) {
    this._validateResponse(data);
    const instance = new this(data);
    instance._syncOriginal();
    return instance;
  }
}

// Make Api itself an EventEmitter for class-level events
Object.assign(Api, EventEmitter.prototype);
EventEmitter.call(Api);

// Default static properties
Api._config = null;
Api.adapter = null;
Api.primaryKey = 'id';
Api.fillable = [];
Api.hidden = [];
Api.casts = {};
Api._endpoint = null;
Api._cacheInstance = null;
Api.rules = null;
Api.messages = null;
Api.eagerLoadStrategy = 'batch';


module.exports = { Api, ApiModel: Api };

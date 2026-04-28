'use strict';

const { ApiQueryNotSupportedError } = require('./Errors/ApiQueryNotSupportedError');
const { ApiError } = require('./Errors/ApiError');

class ApiQueryBuilder {
  constructor(ModelClass, adapter) {
    this._model = ModelClass;
    this._adapter = adapter || null;
    this._wheres = [];
    this._orderBys = [];
    this._limitVal = null;
    this._offsetVal = null;
    this._selectCols = null;
    this._withs = [];
    this._params = {};
    this._fresh = false;
    this._strategy = null; // serialization strategy override
  }

  // ── Fluent filters ──────────────────────────────────────────────────
  where(col, opOrVal, val) {
    if (arguments.length === 2) {
      this._wheres.push({ col, op: '=', val: opOrVal });
    } else {
      this._wheres.push({ col, op: opOrVal, val });
    }
    return this;
  }

  whereIn(col, vals) {
    this._wheres.push({ col, op: 'in', val: vals });
    return this;
  }

  whereNull(col) {
    this._wheres.push({ col, op: 'null', val: null });
    return this;
  }

  whereNotNull(col) {
    this._wheres.push({ col, op: 'not_null', val: null });
    return this;
  }

  whereLike(col, val) {
    this._wheres.push({ col, op: 'like', val });
    return this;
  }

  whereBetween(col, range) {
    this._wheres.push({ col, op: 'between', val: range });
    return this;
  }

  orderBy(col, dir) {
    this._orderBys.push({ col, dir: (dir || 'asc').toLowerCase() });
    return this;
  }

  limit(n) {
    this._limitVal = n;
    return this;
  }

  offset(n) {
    this._offsetVal = n;
    return this;
  }

  select() {
    this._selectCols = Array.isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);
    return this;
  }

  with() {
    const relations = Array.isArray(arguments[0]) ? arguments[0] : Array.prototype.slice.call(arguments);
    this._withs = this._withs.concat(relations);
    return this;
  }

  for(params) {
    this._params = Object.assign({}, this._params, params);
    return this;
  }

  fresh() {
    this._fresh = true;
    return this;
  }

  usingAdapter(adapter) {
    this._adapter = adapter;
    return this;
  }

  // ── Unsupported operations ──────────────────────────────────────────
  join() {
    throw new ApiQueryNotSupportedError('join');
  }

  groupBy() {
    throw new ApiQueryNotSupportedError('groupBy');
  }

  having() {
    throw new ApiQueryNotSupportedError('having');
  }

  // ── Serialization ───────────────────────────────────────────────────
  toParams() {
    const params = {};

    if (this._selectCols && this._selectCols.length) {
      params.fields = this._selectCols.join(',');
    }

    if (this._withs && this._withs.length) {
      params.include = this._withs.join(',');
    }

    if (this._limitVal != null) {
      params.per_page = this._limitVal;
    }

    if (this._offsetVal != null) {
      params.offset = this._offsetVal;
    }

    for (const w of this._wheres) {
      if (w.op === '=') {
        params[w.col] = w.val;
      } else if (w.op === 'in') {
        params[w.col] = w.val; // array
      } else if (w.op === 'null') {
        params[w.col + '_null'] = true;
      } else if (w.op === 'not_null') {
        params[w.col + '_not_null'] = true;
      } else if (w.op === 'like') {
        params[w.col + '_like'] = w.val;
      } else if (w.op === 'between') {
        params[w.col + '_min'] = w.val[0];
        params[w.col + '_max'] = w.val[1];
      } else {
        params[w.col] = w.val;
      }
    }

    if (this._orderBys.length) {
      params.sort = this._orderBys.map(o => (o.dir === 'desc' ? '-' : '') + o.col).join(',');
    }

    return params;
  }

  toQueryString(strategy) {
    strategy = strategy || this._strategy || (this._model && this._model._config && this._model._config.queryStrategy) || 'default';
    const params = this._buildStrategyParams(strategy);
    const searchParams = new URLSearchParams();
    for (const key of Object.keys(params)) {
      const val = params[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          searchParams.append(key + '[]', item);
        }
      } else {
        searchParams.set(key, String(val));
      }
    }
    return searchParams.toString();
  }

  _buildStrategyParams(strategy) {
    const config = (this._model && this._model._config) || {};
    const params = {};

    if (strategy === 'laravel') {
      for (const w of this._wheres) {
        if (w.op === '=') {
          params['filter[' + w.col + ']'] = w.val;
        } else if (w.op === 'in') {
          w.val.forEach((v, i) => { params['filter[' + w.col + '][' + i + ']'] = v; });
        } else if (w.op === 'like') {
          params['filter[' + w.col + ']'] = w.val;
        } else if (w.op === 'between') {
          params['filter[' + w.col + '][min]'] = w.val[0];
          params['filter[' + w.col + '][max]'] = w.val[1];
        }
      }
      if (this._orderBys.length) {
        params.sort = this._orderBys.map(o => (o.dir === 'desc' ? '-' : '') + o.col).join(',');
      }
      if (this._limitVal != null) params.per_page = this._limitVal;
      if (this._offsetVal != null) params.page = Math.floor(this._offsetVal / (this._limitVal || 1)) + 1;
      if (this._withs.length) params.include = this._withs.join(',');
      if (this._selectCols) params.fields = this._selectCols.join(',');

    } else if (strategy === 'django') {
      for (const w of this._wheres) {
        if (w.op === '=') params[w.col] = w.val;
        else if (w.op === 'in') params[w.col + '__in'] = w.val.join(',');
        else if (w.op === 'like') params[w.col + '__icontains'] = w.val;
        else if (w.op === 'between') { params[w.col + '__gte'] = w.val[0]; params[w.col + '__lte'] = w.val[1]; }
        else if (w.op === 'null') params[w.col + '__isnull'] = 'true';
        else if (w.op === 'not_null') params[w.col + '__isnull'] = 'false';
      }
      if (this._orderBys.length) {
        params.ordering = this._orderBys.map(o => (o.dir === 'desc' ? '-' : '') + o.col).join(',');
      }
      if (this._limitVal != null) params.limit = this._limitVal;
      if (this._offsetVal != null) params.offset = this._offsetVal;

    } else if (strategy === 'odata') {
      const filters = [];
      for (const w of this._wheres) {
        if (w.op === '=') filters.push(w.col + " eq '" + w.val + "'");
        else if (w.op === 'like') filters.push("contains(" + w.col + ", '" + w.val + "')");
        else if (w.op === 'between') filters.push(w.col + ' ge ' + w.val[0] + ' and ' + w.col + ' le ' + w.val[1]);
        else if (w.op === 'in') filters.push(w.col + ' in (' + w.val.map(v => "'" + v + "'").join(',') + ')');
        else if (w.op === 'null') filters.push(w.col + ' eq null');
        else if (w.op === 'not_null') filters.push(w.col + ' ne null');
      }
      if (filters.length) params['$filter'] = filters.join(' and ');
      if (this._orderBys.length) params['$orderby'] = this._orderBys.map(o => o.col + ' ' + o.dir).join(',');
      if (this._limitVal != null) params['$top'] = this._limitVal;
      if (this._offsetVal != null) params['$skip'] = this._offsetVal;
      if (this._selectCols) params['$select'] = this._selectCols.join(',');

    } else if (strategy === 'jsonapi') {
      for (const w of this._wheres) {
        if (w.op === '=') params['filter[' + w.col + ']'] = w.val;
        else if (w.op === 'like') params['filter[' + w.col + ']'] = w.val;
        else if (w.op === 'in') params['filter[' + w.col + ']'] = w.val.join(',');
        else if (w.op === 'between') {
          params['filter[' + w.col + '][gte]'] = w.val[0];
          params['filter[' + w.col + '][lte]'] = w.val[1];
        }
      }
      if (this._limitVal != null) params['page[size]'] = this._limitVal;
      if (this._offsetVal != null) {
        const size = this._limitVal || 15;
        params['page[number]'] = Math.floor(this._offsetVal / size) + 1;
      }
      if (this._orderBys.length) params.sort = this._orderBys.map(o => (o.dir === 'desc' ? '-' : '') + o.col).join(',');
      if (this._withs.length) params.include = this._withs.join(',');

    } else if (strategy === 'custom') {
      const serializer = config.querySerializer;
      if (typeof serializer !== 'function') {
        throw new Error('querySerializer must be a function when strategy is "custom"');
      }
      return serializer(this.toParams());

    } else {
      // default
      return this.toParams();
    }

    return params;
  }

  // ── Resolve endpoint with :param placeholders ───────────────────────
  _resolveEndpoint() {
    const ep = this._model.endpoint;
    if (!ep) throw new Error(this._model.name + '.endpoint is not defined.');
    return ep.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (match, key) => {
      if (!(key in this._params)) {
        throw new ApiError('Missing parameter "' + key + '" for endpoint ' + ep);
      }
      return encodeURIComponent(this._params[key]);
    });
  }

  _getAdapter() {
    const adapter = this._adapter || this._model._getAdapter();
    return adapter;
  }

  // ── Execution methods ───────────────────────────────────────────────
  async get() {
    const adapter = this._getAdapter();
    const ep = this._resolveEndpoint();
    const strategy = this._strategy || (this._model._config && this._model._config.queryStrategy) || 'default';
    const qs = this.toQueryString(strategy);
    const path = qs ? ep + '?' + qs : ep;
    const data = await adapter.request('GET', path);
    const items = Array.isArray(data) ? data : (data && data.data ? data.data : []);
    return items.map(item => this._model._hydrate(item));
  }

  async all() {
    return this.get();
  }

  async first() {
    const results = await this.limit(1).get();
    return results.length ? results[0] : null;
  }

  async find(id) {
    const adapter = this._getAdapter();
    const ep = this._resolveEndpoint();
    const pk = this._model.primaryKey || 'id';
    const path = ep + '/' + encodeURIComponent(id);
    const { ApiNotFoundError } = require('./Errors/ApiNotFoundError');
    try {
      const data = await adapter.request('GET', path);
      if (data == null) return null;
      return this._model._hydrate(data);
    } catch (err) {
      if (err instanceof ApiNotFoundError) return null;
      throw err;
    }
  }

  async paginate(page, perPage) {
    page = page || 1;
    perPage = perPage || 15;
    const adapter = this._getAdapter();
    const ep = this._resolveEndpoint();
    const strategy = this._strategy || (this._model._config && this._model._config.queryStrategy) || 'default';
    const copy = this._clone().limit(perPage).offset((page - 1) * perPage);
    const qs = copy.toQueryString(strategy);
    const path = qs ? ep + '?' + qs : ep;
    const raw = await adapter.request('GET', path);
    const { ApiPaginator } = require('./ApiPaginator');
    return new ApiPaginator(raw, { page, perPage, queryBuilder: this, model: this._model });
  }

  async cursorPaginate(opts) {
    opts = opts || {};
    const adapter = this._getAdapter();
    const ep = this._resolveEndpoint();
    const params = this.toParams();
    if (opts.cursor) params.cursor = opts.cursor;
    if (opts.perPage) params.per_page = opts.perPage;
    const qs = Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k])).join('&');
    const path = qs ? ep + '?' + qs : ep;
    const raw = await adapter.request('GET', path);
    const { ApiPaginator } = require('./ApiPaginator');
    return new ApiPaginator(raw, { type: 'cursor', queryBuilder: this, model: this._model });
  }

  async offsetPaginate(opts) {
    opts = opts || {};
    const limit = opts.limit || opts.perPage || 15;
    const offset = opts.offset || 0;
    const adapter = this._getAdapter();
    const ep = this._resolveEndpoint();
    const copy = this._clone().limit(limit).offset(offset);
    const strategy = this._strategy || (this._model._config && this._model._config.queryStrategy) || 'default';
    const qs = copy.toQueryString(strategy);
    const path = qs ? ep + '?' + qs : ep;
    const raw = await adapter.request('GET', path);
    const { ApiPaginator } = require('./ApiPaginator');
    return new ApiPaginator(raw, { type: 'offset', limit, offset, queryBuilder: this, model: this._model });
  }

  async eachPage(perPage, fn) {
    perPage = perPage || 15;
    let page = 1;
    while (true) {
      const paginator = await this.paginate(page, perPage);
      const items = paginator.data.map(item => this._model._hydrate(item));
      const shouldContinue = await Promise.resolve(fn(items, page));
      if (shouldContinue === false) break;
      if (!paginator.hasMorePages()) break;
      page++;
    }
  }

  async chunk(size, fn) {
    return this.eachPage(size, fn);
  }

  // ── Clone ───────────────────────────────────────────────────────────
  _clone() {
    const copy = new ApiQueryBuilder(this._model, this._adapter);
    copy._wheres = this._wheres.slice();
    copy._orderBys = this._orderBys.slice();
    copy._limitVal = this._limitVal;
    copy._offsetVal = this._offsetVal;
    copy._selectCols = this._selectCols ? this._selectCols.slice() : null;
    copy._withs = this._withs.slice();
    copy._params = Object.assign({}, this._params);
    copy._fresh = this._fresh;
    copy._strategy = this._strategy;
    return copy;
  }

  // ── Debug ───────────────────────────────────────────────────────────
  dd() {
    const strategy = this._strategy || (this._model._config && this._model._config.queryStrategy) || 'default';
    console.log({
      model: this._model.name,
      endpoint: this._model.endpoint,
      strategy,
      params: this.toParams(),
      queryString: this.toQueryString(strategy)
    });
    return undefined;
  }

  async toRequest() {
    const adapter = this._getAdapter();
    const ep = this._resolveEndpoint();
    const strategy = this._strategy || (this._model._config && this._model._config.queryStrategy) || 'default';
    const qs = this.toQueryString(strategy);
    const path = qs ? ep + '?' + qs : ep;
    return adapter.toRequest('GET', path, {});
  }
}

module.exports = { ApiQueryBuilder };

'use strict';

const { ApiError } = require('./Errors/ApiError');
const { ApiNetworkError } = require('./Errors/ApiNetworkError');
const { ApiResponseError } = require('./Errors/ApiResponseError');
const { ApiNotFoundError } = require('./Errors/ApiNotFoundError');
const { ApiValidationError } = require('./Errors/ApiValidationError');
const { ApiUnauthorizedError } = require('./Errors/ApiUnauthorizedError');
const { ApiForbiddenError } = require('./Errors/ApiForbiddenError');
const { ApiServerError } = require('./Errors/ApiServerError');
const { ApiRateLimitError } = require('./Errors/ApiRateLimitError');
const { InterceptorManager } = require('./Interceptors/InterceptorManager');

const DEFAULT_TIMEOUT = 30000;

// Circuit breaker states
const CB_CLOSED    = 'closed';
const CB_OPEN      = 'open';
const CB_HALF_OPEN = 'half-open';

class ApiAdapter {
  constructor(config) {
    config = config || {};
    this.baseUrl = (config.baseUrl || '').replace(/\/$/, '');
    this.timeout = config.timeout != null ? config.timeout : DEFAULT_TIMEOUT;
    this.auth = config.auth || null;
    this.headers = config.headers || {};
    this.dynamicHeaders = config.dynamicHeaders || null;
    this.security = config.security || {};
    this.onRefreshFail = config.onRefreshFail || null;
    this.onError = config.onError || null;
    this._requestLog = [];
    this._logEnabled = false;
    this._refreshing = false;
    this._pendingRefresh = null;

    // Interceptor pipeline (T057)
    this.interceptors = new InterceptorManager();

    // Retry policy (T059)
    const retryConfig = config.retry || {};
    this._retry = {
      maxRetries:  retryConfig.maxRetries  != null ? retryConfig.maxRetries  : 0,
      delay:       retryConfig.delay       != null ? retryConfig.delay       : 1000,
      backoff:     retryConfig.backoff     || 'fixed',   // 'fixed' | 'exponential'
      jitter:      retryConfig.jitter      || false,
      retryCodes:  retryConfig.retryCodes  || [429, 500, 502, 503, 504],
    };

    // Circuit breaker (T061)
    const cbConfig = config.circuitBreaker || {};
    this._cb = {
      enabled:          !!cbConfig.enabled,
      failureThreshold: cbConfig.failureThreshold != null ? cbConfig.failureThreshold : 5,
      recoveryTimeout:  cbConfig.recoveryTimeout  != null ? cbConfig.recoveryTimeout  : 60000,
      state:            CB_CLOSED,
      failureCount:     0,
      openedAt:         null,
    };
  }

  // ── Request log ──────────────────────────────────────────────────────
  enableRequestLog() {
    this._logEnabled = true;
  }

  getRequestLog() {
    return this._requestLog.slice();
  }

  get requestLog() {
    return this._requestLog;
  }

  flushRequestLog() {
    this._requestLog = [];
  }

  // ── Auth header building ─────────────────────────────────────────────
  async _buildAuthHeaders(auth) {
    if (!auth) return {};
    switch (auth.type) {
      case 'bearer':
        return { Authorization: 'Bearer ' + auth.token };
      case 'basic': {
        const credentials = auth.username + ':' + auth.password;
        const encoded = Buffer.from(credentials, 'utf8').toString('base64');
        return { Authorization: 'Basic ' + encoded };
      }
      case 'apiKey':
        if (auth.in === 'query') return {};
        return { [auth.name || auth.header || 'X-API-Key']: auth.key };
      case 'cookie': {
        const cookieStr = auth.name
          ? auth.name + '=' + (auth.value != null ? auth.value : '')
          : (auth.cookie || '');
        return { Cookie: cookieStr };
      }
      case 'oauth2':
        return { Authorization: 'Bearer ' + auth.accessToken };
      default:
        return {};
    }
  }

  _appendApiKeyQuery(url, auth) {
    if (!auth || auth.type !== 'apiKey' || auth.in !== 'query') return url;
    const sep = url.includes('?') ? '&' : '?';
    const paramName = auth.name || auth.key_param || 'api_key';
    return url + sep + encodeURIComponent(paramName) + '=' + encodeURIComponent(auth.key);
  }

  // ── Header redaction (for logs / debug) ──────────────────────────────
  _redactHeaders(headers) {
    const redact = (this.security && this.security.redactHeaders) || [];
    if (!redact.length) return Object.assign({}, headers);
    const out = {};
    for (const key of Object.keys(headers)) {
      const match = redact.some(r => r.toLowerCase() === key.toLowerCase());
      out[key] = match ? '***' : headers[key];
    }
    return out;
  }

  _redactBody(body) {
    const fields = (this.security && this.security.redactFields) || [];
    if (!fields.length || !body || typeof body !== 'object') return body;
    return this._redactDeep(body, fields);
  }

  _redactDeep(obj, fields) {
    if (Array.isArray(obj)) return obj.map(item => this._redactDeep(item, fields));
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const key of Object.keys(obj)) {
        if (fields.includes(key)) {
          out[key] = '***';
        } else {
          out[key] = this._redactDeep(obj[key], fields);
        }
      }
      return out;
    }
    return obj;
  }

  // ── Status → typed error mapping ─────────────────────────────────────
  /**
   * Can accept either a Response object (has `.json()`) or a plain object (body data).
   */
  async _statusToError(status, response) {
    let body = null;
    // If it's a Response, parse it; otherwise treat as body directly
    if (response && typeof response.json === 'function') {
      try { body = await response.json(); } catch (_) { /* ignore */ }
    } else if (response && typeof response === 'object') {
      body = response;
    }

    let error;
    switch (status) {
      case 401:
        error = new ApiUnauthorizedError(body && body.message);
        break;
      case 403:
        error = new ApiForbiddenError(body && body.message);
        break;
      case 404:
        error = new ApiNotFoundError(body && body.message);
        break;
      case 422: {
        const errors = (body && body.errors) || {};
        error = new ApiValidationError(body && body.message, {
          statusCode: 422,
          source: 'server',
          errors
        });
        break;
      }
      case 429: {
        const retryAfter = response && response.headers && response.headers.get
          ? response.headers.get('Retry-After')
          : null;
        error = new ApiRateLimitError(body && body.message, retryAfter);
        break;
      }
      default:
        if (status >= 500 && status <= 599) {
          error = new ApiServerError(body && body.message, status);
        } else {
          error = new ApiResponseError(body && body.message, status);
        }
        break;
    }

    if (this.onError) this.onError(error);
    return error;
  }

  // ── Circuit breaker helpers ───────────────────────────────────────────
  _cbCheck() {
    if (!this._cb.enabled) return;
    if (this._cb.state === CB_OPEN) {
      const elapsed = Date.now() - this._cb.openedAt;
      if (elapsed >= this._cb.recoveryTimeout) {
        this._cb.state = CB_HALF_OPEN;
      } else {
        const err = new ApiError('Circuit breaker is OPEN — refusing request');
        err.code = 'CIRCUIT_OPEN';
        if (this.onError) this.onError(err);
        throw err;
      }
    }
  }

  _cbOnSuccess() {
    if (!this._cb.enabled) return;
    if (this._cb.state === CB_HALF_OPEN) {
      this._cb.state    = CB_CLOSED;
      this._cb.failureCount = 0;
    }
  }

  _cbOnFailure() {
    if (!this._cb.enabled) return;
    this._cb.failureCount++;
    if (this._cb.state === CB_HALF_OPEN || this._cb.failureCount >= this._cb.failureThreshold) {
      this._cb.state    = CB_OPEN;
      this._cb.openedAt = Date.now();
    }
  }

  // ── Inner fetch (overridable by subclasses such as MockAdapter) ──────
  async _fetch(method, path, options) {
    let url = this.baseUrl + path;
    const auth = options.auth !== undefined ? options.auth : this.auth;
    url = this._appendApiKeyQuery(url, auth);

    const authHeaders = await this._buildAuthHeaders(auth);
    const dynamicHdrs = this.dynamicHeaders ? await Promise.resolve(this.dynamicHeaders()) : {};
    const headers = Object.assign(
      { 'Content-Type': 'application/json', Accept: 'application/json' },
      this.headers,
      dynamicHdrs,
      authHeaders,
      options.headers || {}
    );

    let body;
    if (options.body !== undefined && options.body !== null) {
      body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    const fetchConfig = {
      method: method.toUpperCase(),
      headers,
      signal: controller.signal
    };
    if (body !== undefined) fetchConfig.body = body;

    try {
      const response = await globalThis.fetch(url, fetchConfig);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await this._statusToError(response.status, response);
        // oauth2: refresh on 401 and retry once
        if (response.status === 401 && auth && auth.type === 'oauth2' && auth.refreshUrl && !options._retried) {
          return this._refreshAndRetry(method, path, options, auth);
        }
        throw error;
      }

      let data = null;
      const ct = response.headers && response.headers.get ? response.headers.get('content-type') : '';
      if (ct && ct.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (text) {
          try { data = JSON.parse(text); } catch (_) { data = text; }
        }
      }

      if (this._logEnabled) {
        this._requestLog.push({
          method: method.toUpperCase(),
          url,
          headers: this._redactHeaders(headers),
          params: options.params || null,
          timestamp: new Date().toISOString()
        });
      }

      return data;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof ApiError) throw err;
      if (err.name === 'AbortError') {
        const netErr = new ApiNetworkError('Request timed out');
        if (this.onError) this.onError(netErr);
        throw netErr;
      }
      const netErr = new ApiNetworkError(err.message);
      if (this.onError) this.onError(netErr);
      throw netErr;
    }
  }

  // ── Core request ─────────────────────────────────────────────────────
  async request(method, path, options) {
    options = options || {};

    // Run request interceptors (T058)
    let config = { method, path, options };
    config = await this.interceptors.runRequest(config);
    method  = config.method  || method;
    path    = config.path    || path;
    options = config.options || options;

    // Circuit breaker check (T061)
    this._cbCheck();

    // Retry loop (T059-T060)
    let lastErr;
    const maxRetries = options._retried ? 0 : this._retry.maxRetries;
    for (let attempt_ = 0; attempt_ <= maxRetries; attempt_++) {
      if (attempt_ > 0) {
        let delay = this._retry.delay;
        if (this._retry.backoff === 'exponential') delay = delay * Math.pow(2, attempt_ - 1);
        if (this._retry.jitter) delay = delay * (0.5 + Math.random() * 0.5);
        await new Promise(r => setTimeout(r, Math.round(delay)));
      }
      try {
        const data = await this._fetch(method, path, options);
        this._cbOnSuccess();
        // Run response interceptors (T058)
        return await this.interceptors.runResponseSuccess(data);
      } catch (err) {
        lastErr = err;
        const isRetryable = err.statusCode && this._retry.retryCodes.includes(err.statusCode);
        const isNetErr = err instanceof ApiNetworkError;
        if ((isRetryable || isNetErr) && attempt_ < maxRetries) {
          continue;
        }
        this._cbOnFailure();
        try {
          await this.interceptors.runResponseError(err);
        } catch (interceptedErr) {
          throw interceptedErr;
        }
        throw err;
      }
    }
    this._cbOnFailure();
    throw lastErr;
  }

  async _refreshAndRetry(method, path, options, auth) {
    try {
      const refreshResponse = await globalThis.fetch(auth.refreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: auth.refreshToken })
      });
      if (!refreshResponse.ok) {
        if (this.onRefreshFail) this.onRefreshFail(auth);
        const err = new ApiUnauthorizedError('Token refresh failed');
        if (this.onError) this.onError(err);
        throw err;
      }
      const tokens = await refreshResponse.json();
      auth.accessToken = tokens.access_token || tokens.accessToken || auth.accessToken;
      if (tokens.refresh_token || tokens.refreshToken) {
        auth.refreshToken = tokens.refresh_token || tokens.refreshToken;
      }
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (this.onRefreshFail) this.onRefreshFail(auth);
      const netErr = new ApiUnauthorizedError('Token refresh failed: ' + err.message);
      if (this.onError) this.onError(netErr);
      throw netErr;
    }
    return this.request(method, path, Object.assign({}, options, { _retried: true, auth }));
  }

  // ── File upload ───────────────────────────────────────────────────────
  upload(url, data, options) {
    options = options || {};
    const fullUrl = this.baseUrl + url;
    const controller = new AbortController();

    // Build FormData
    let formData;
    if (data instanceof FormData) {
      formData = data;
    } else {
      formData = new FormData();
      for (const key of Object.keys(data)) {
        formData.append(key, data[key]);
      }
    }

    const hasBlob = Object.keys(data || {}).some(k => data[k] instanceof Blob || (typeof File !== 'undefined' && data[k] instanceof File));
    const useXHR = options.onProgress && (typeof XMLHttpRequest !== 'undefined');

    if (useXHR) {
      const promise = new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', fullUrl);
        if (xhr.upload && options.onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              options.onProgress(percent, e.loaded, e.total);
            }
          };
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            let result;
            try { result = JSON.parse(xhr.responseText); } catch (_) { result = xhr.responseText; }
            resolve(result);
          } else {
            reject(new ApiResponseError('Upload failed', xhr.status));
          }
        };
        xhr.onerror = () => reject(new ApiNetworkError('Upload network error'));
        xhr.onabort = () => reject(new ApiNetworkError('Upload aborted'));
        xhr.send(formData);
        controller._xhr = xhr;
      });
      return {
        promise,
        abort() { controller._xhr && controller._xhr.abort(); }
      };
    }

    // Fallback to fetch
    const promise = globalThis.fetch(fullUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    }).then(async res => {
      if (!res.ok) throw new ApiResponseError('Upload failed', res.status);
      let result;
      try { result = await res.json(); } catch (_) { result = await res.text(); }
      return result;
    }).catch(err => {
      if (err instanceof ApiError) throw err;
      if (err.name === 'AbortError') throw new ApiNetworkError('Upload aborted');
      throw new ApiNetworkError(err.message);
    });

    return {
      promise,
      abort() { controller.abort(); }
    };
  }

  async uploadMany(url, files, options) {
    options = options || {};
    const concurrency = options.concurrency || 1;
    const field = options.field || 'file';
    const handles = [];
    const queue = files.slice();
    const active = [];

    return new Promise((resolve, reject) => {
      const results = new Array(files.length).fill(null);
      let index = 0;
      let completed = 0;

      const dispatch = () => {
        while (active.length < concurrency && queue.length > 0) {
          const fileIndex = index++;
          const file = queue.shift();
          const data = {};
          data[field] = file;
          const handle = this.upload(url, data, {
            onProgress: options.onProgress
              ? (percent, loaded, total) => options.onProgress(fileIndex, percent, loaded, total)
              : undefined
          });
          handles.push(handle);
          active.push(
            handle.promise
              .then(result => {
                results[fileIndex] = result;
                active.splice(active.indexOf(handle.promise), 1);
                completed++;
                if (completed === files.length) resolve(results);
                else dispatch();
              })
              .catch(err => {
                reject(err);
              })
          );
        }
      };

      if (files.length === 0) return resolve([]);
      dispatch();
    });
  }

  // ── toRequest (debug) ─────────────────────────────────────────────────
  async toRequest(method, path, options) {
    options = options || {};
    let url = this.baseUrl + path;
    const auth = options.auth !== undefined ? options.auth : this.auth;
    url = this._appendApiKeyQuery(url, auth);
    const authHeaders = await this._buildAuthHeaders(auth);
    const dynamicHdrs = this.dynamicHeaders ? await Promise.resolve(this.dynamicHeaders()) : {};
    const headers = Object.assign(
      { 'Content-Type': 'application/json', Accept: 'application/json' },
      this.headers,
      dynamicHdrs,
      authHeaders,
      options.headers || {}
    );
    return {
      method: method.toUpperCase(),
      url,
      params: options.params || null,
      headers: this._redactHeaders(headers)
    };
  }
}

function createAdapter(config) {
  return new ApiAdapter(config);
}

module.exports = { ApiAdapter, createAdapter };

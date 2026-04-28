'use strict';

const { ApiAdapter } = require('./ApiAdapter');
const { ApiNetworkError } = require('./Errors/ApiNetworkError');
const { ApiResponseError } = require('./Errors/ApiResponseError');

/**
 * Handler returned by `onGet`, `onPost`, etc.
 * Chains `.reply()`, `.replyOnce()`, `.networkError()`, `.timeout()`, `.delay()`.
 */
class MockHandler {
  constructor(handlers) {
    this._handlers = handlers; // Reference to the parent array
    this._responses = [];
  }

  /**
   * Always respond with the given status and data.
   */
  reply(status, data, headers) {
    this._responses.push({ type: 'reply', status, data, headers: headers || {}, once: false });
    return this;
  }

  /**
   * Respond once; subsequent requests fall through.
   */
  replyOnce(status, data, headers) {
    this._responses.push({ type: 'reply', status, data, headers: headers || {}, once: true });
    return this;
  }

  /**
   * Simulate a network error (no response from server).
   */
  networkError(once) {
    this._responses.push({ type: 'networkError', once: !!once });
    return this;
  }

  /**
   * Simulate a timeout.
   */
  timeout(once) {
    this._responses.push({ type: 'timeout', once: !!once });
    return this;
  }

  /**
   * Add an artificial delay (ms) to the response.
   */
  delay(ms) {
    this._delayMs = ms;
    return this;
  }

  /**
   * Get the next response definition.
   * If none, returns null (passthrough).
   */
  _nextResponse() {
    if (!this._responses.length) return null;
    const resp = this._responses[0];
    if (resp.once) this._responses.shift();
    return resp;
  }
}

/**
 * MockAdapter — extends ApiAdapter for testing purposes.
 *
 * Register handlers via:
 *   adapter.onGet('/users').reply(200, [{ id: 1 }])
 *   adapter.onPost('/users').replyOnce(201, { id: 2 })
 *   adapter.onPut(/\/users\/\d+/).reply(200, {})
 */
class MockAdapter extends ApiAdapter {
  constructor(options) {
    super(options || {});
    this._handlers = [];
    this._passthrough = false;
  }

  /**
   * @param {string|RegExp} urlPattern
   * @param {string} method
   * @returns {MockHandler}
   */
  _registerHandler(urlPattern, method) {
    const handler = new MockHandler(this._handlers);
    this._handlers.push({ urlPattern, method: method.toUpperCase(), handler });
    return handler;
  }

  onGet(urlPattern)    { return this._registerHandler(urlPattern, 'GET'); }
  onPost(urlPattern)   { return this._registerHandler(urlPattern, 'POST'); }
  onPut(urlPattern)    { return this._registerHandler(urlPattern, 'PUT'); }
  onPatch(urlPattern)  { return this._registerHandler(urlPattern, 'PATCH'); }
  onDelete(urlPattern) { return this._registerHandler(urlPattern, 'DELETE'); }
  onHead(urlPattern)   { return this._registerHandler(urlPattern, 'HEAD'); }
  onAny(urlPattern)    { return this._registerHandler(urlPattern, '*'); }

  /**
   * If no handler matches, fall through to real network requests.
   */
  setPassthrough(enabled) {
    this._passthrough = enabled !== false;
    return this;
  }

  reset() {
    this._handlers = [];
    return this;
  }

  _matchHandler(method, path) {
    for (const entry of this._handlers) {
      const methodMatch = entry.method === '*' || entry.method === method.toUpperCase();
      if (!methodMatch) continue;

      const pattern = entry.urlPattern;
      let pathMatch = false;
      if (typeof pattern === 'string') {
        pathMatch = (path === pattern || path.startsWith(pattern));
      } else if (pattern instanceof RegExp) {
        pathMatch = pattern.test(path);
      }
      if (!pathMatch) continue;

      // Skip handlers that have been exhausted (once responses all consumed)
      if (entry.handler._responses.length === 0 && entry.handler._exhausted) continue;

      return entry.handler;
    }
    return null;
  }

  /**
   * Override only the inner fetch — ApiAdapter.request() still runs
   * interceptors, circuit breaker, and retry logic.
   */
  async _fetch(method, path, options) {
    const handler = this._matchHandler(method, path);

    if (!handler) {
      if (this._passthrough) {
        return super._fetch(method, path, options);
      }
      const { ApiError } = require('./Errors/ApiError');
      throw new ApiError('No mock handler registered for ' + method + ' ' + path);
    }

    const resp = handler._nextResponse();

    if (!resp) {
      // No response queued (all replyOnce used) — passthrough or error
      if (this._passthrough) return super._fetch(method, path, options);
      const { ApiError } = require('./Errors/ApiError');
      throw new ApiError('Mock handler exhausted for ' + method + ' ' + path);
    }

    // Mark handler exhausted if its queue is now empty and it had once responses
    if (handler._responses.length === 0) {
      handler._exhausted = true;
    }

    // Apply delay if set
    if (handler._delayMs) {
      await new Promise(r => setTimeout(r, handler._delayMs));
    }

    if (resp.type === 'networkError') {
      throw new ApiNetworkError('Network error (mocked)');
    }

    if (resp.type === 'timeout') {
      const { ApiError } = require('./Errors/ApiError');
      const err = new ApiError('Request timeout (mocked)');
      err.code = 'TIMEOUT';
      throw err;
    }

    // Log the request
    const reqEntry = {
      method,
      path,
      status: resp.status,
      timestamp: Date.now(),
      mocked: true,
    };
    this._requestLog.push(reqEntry);

    // Build status-based error if needed
    const status = resp.status;
    if (status >= 400) {
      const err = await this._statusToError(status, resp.data || {});
      throw err;
    }

    return resp.data;
  }
}

module.exports = { MockAdapter };

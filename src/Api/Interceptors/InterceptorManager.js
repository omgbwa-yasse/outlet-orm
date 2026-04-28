'use strict';

/**
 * InterceptorManager — request/response pipeline middleware.
 *
 * Usage:
 *   manager.addRequest(fn)    // fn(config) => config | Promise<config>
 *   manager.addResponse(onSuccess, onError)
 *   manager.remove(id)
 *   manager.runRequest(config) => Promise<config>
 *   manager.runResponseSuccess(response) => Promise<response>
 *   manager.runResponseError(error) => Promise<never>
 */
class InterceptorManager {
  constructor() {
    this._requestInterceptors = [];
    this._responseInterceptors = [];
    this._nextId = 1;
  }

  /**
   * Add a request interceptor.
   * @param {Function} fn  — receives the request config, must return (optionally modified) config
   * @returns {number} interceptor id
   */
  addRequest(fn) {
    const id = this._nextId++;
    this._requestInterceptors.push({ id, fn });
    return id;
  }

  /**
   * Add a response interceptor.
   * @param {Function} onSuccess — receives response data
   * @param {Function} [onError]  — receives error; should re-throw or transform
   * @returns {number} interceptor id
   */
  addResponse(onSuccess, onError) {
    const id = this._nextId++;
    this._responseInterceptors.push({ id, onSuccess, onError: onError || null });
    return id;
  }

  /**
   * Remove an interceptor by id.
   * @param {number} id
   */
  remove(id) {
    this._requestInterceptors = this._requestInterceptors.filter(i => i.id !== id);
    this._responseInterceptors = this._responseInterceptors.filter(i => i.id !== id);
  }

  /**
   * Run all request interceptors in registration order.
   * @param {object} config
   * @returns {Promise<object>}
   */
  async runRequest(config) {
    let current = config;
    for (const { fn } of this._requestInterceptors) {
      current = await fn(current);
      if (!current) current = config; // Guard against undefined return
    }
    return current;
  }

  /**
   * Run all response success interceptors.
   * @param {*} response
   * @returns {Promise<*>}
   */
  async runResponseSuccess(response) {
    let current = response;
    for (const { onSuccess } of this._responseInterceptors) {
      if (onSuccess) current = await onSuccess(current);
    }
    return current;
  }

  /**
   * Run all response error interceptors.
   * @param {Error} error
   * @returns {Promise<never>}
   */
  async runResponseError(error) {
    let current = error;
    for (const { onError } of this._responseInterceptors) {
      if (onError) {
        try {
          const result = await onError(current);
          if (result !== undefined) return result; // interceptor swallowed error
        } catch (e) {
          current = e;
        }
      }
    }
    throw current;
  }

  get requestCount() { return this._requestInterceptors.length; }
  get responseCount() { return this._responseInterceptors.length; }
}

module.exports = { InterceptorManager };

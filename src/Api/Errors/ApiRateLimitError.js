'use strict';

const { ApiResponseError } = require('./ApiResponseError');

class ApiRateLimitError extends ApiResponseError {
  constructor(message, retryAfterHeader) {
    super(message || 'Rate limit exceeded', 429);
    this.name = 'ApiRateLimitError';
    this.retryAfter = ApiRateLimitError._parseRetryAfter(retryAfterHeader);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiRateLimitError);
    }
  }

  static _parseRetryAfter(headerValue) {
    if (headerValue == null) return null;
    const delta = Number(headerValue);
    if (!isNaN(delta) && isFinite(delta)) {
      return delta;
    }
    // HTTP-date format
    const date = new Date(headerValue);
    if (!isNaN(date.getTime())) {
      return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 1000));
    }
    return null;
  }
}

module.exports = { ApiRateLimitError };

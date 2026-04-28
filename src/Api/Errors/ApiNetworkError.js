'use strict';

const { ApiError } = require('./ApiError');

class ApiNetworkError extends ApiError {
  constructor(message) {
    super(message || 'Network error');
    this.name = 'ApiNetworkError';
    this.statusCode = 0;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiNetworkError);
    }
  }
}

module.exports = { ApiNetworkError };

'use strict';

const { ApiError } = require('./ApiError');

class ApiQueryNotSupportedError extends ApiError {
  constructor(operation) {
    super('The operation "' + (operation || 'unknown') + '" is not supported on API models. Use raw SQL models for complex query operations.');
    this.name = 'ApiQueryNotSupportedError';
    this.operation = operation || null;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiQueryNotSupportedError);
    }
  }
}

module.exports = { ApiQueryNotSupportedError };

'use strict';

const { ApiResponseError } = require('./ApiResponseError');

class ApiValidationError extends ApiResponseError {
  constructor(message, options) {
    options = options || {};
    super(message || 'Validation failed', options.statusCode || 422);
    this.name = 'ApiValidationError';
    this.errors = options.errors || {};
    this.source = options.source || 'client';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiValidationError);
    }
  }
}

module.exports = { ApiValidationError };

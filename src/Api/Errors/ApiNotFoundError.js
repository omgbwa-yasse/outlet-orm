'use strict';

const { ApiResponseError } = require('./ApiResponseError');

class ApiNotFoundError extends ApiResponseError {
  constructor(message) {
    super(message || 'Not found', 404);
    this.name = 'ApiNotFoundError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiNotFoundError);
    }
  }
}

module.exports = { ApiNotFoundError };

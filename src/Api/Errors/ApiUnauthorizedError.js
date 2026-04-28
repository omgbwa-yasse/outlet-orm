'use strict';

const { ApiResponseError } = require('./ApiResponseError');

class ApiUnauthorizedError extends ApiResponseError {
  constructor(message) {
    super(message || 'Unauthorized', 401);
    this.name = 'ApiUnauthorizedError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiUnauthorizedError);
    }
  }
}

module.exports = { ApiUnauthorizedError };

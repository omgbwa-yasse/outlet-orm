'use strict';

const { ApiResponseError } = require('./ApiResponseError');

class ApiServerError extends ApiResponseError {
  constructor(message, statusCode) {
    super(message || 'Server error', statusCode || 500);
    this.name = 'ApiServerError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiServerError);
    }
  }
}

module.exports = { ApiServerError };

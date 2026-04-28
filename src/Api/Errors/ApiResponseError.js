'use strict';

const { ApiError } = require('./ApiError');

class ApiResponseError extends ApiError {
  constructor(message, statusCode) {
    super(message || 'Response error');
    this.name = 'ApiResponseError';
    this.statusCode = statusCode || 0;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiResponseError);
    }
  }
}

module.exports = { ApiResponseError };

'use strict';

class ApiError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = 0;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

module.exports = { ApiError };

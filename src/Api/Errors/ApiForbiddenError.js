'use strict';

const { ApiResponseError } = require('./ApiResponseError');

class ApiForbiddenError extends ApiResponseError {
  constructor(message) {
    super(message || 'Forbidden', 403);
    this.name = 'ApiForbiddenError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiForbiddenError);
    }
  }
}

module.exports = { ApiForbiddenError };

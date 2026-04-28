'use strict';

const { ApiAdapter } = require('./ApiAdapter');

/**
 * Factory helper – returns a new ApiAdapter instance.
 * @param {object} config  Same shape as ApiAdapter constructor config.
 * @returns {ApiAdapter}
 */
function createAdapter(config) {
  return new ApiAdapter(config);
}

module.exports = { createAdapter };

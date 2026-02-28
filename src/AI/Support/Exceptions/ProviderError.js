'use strict';

/**
 * ProviderError
 * Custom error for provider-related issues.
 */
class ProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProviderError';
  }

  static notFound(name) {
    return new ProviderError(`Provider '${name}' not found`);
  }

  static unsupported(name, feature) {
    return new ProviderError(`Provider '${name}' does not support ${feature}`);
  }
}

module.exports = ProviderError;

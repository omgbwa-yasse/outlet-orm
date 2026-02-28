'use strict';

/**
 * EmbeddingsProviderContract
 * Base class for providers that support embeddings generation.
 */
class EmbeddingsProviderContract {
  /**
   * Generate embeddings for one or multiple inputs.
   * @param {string[]} inputs
   * @param {Object} [options={}]
   * @returns {Promise<{embeddings: number[][], usage?: Object, raw?: Object}>}
   */
  async embeddings(inputs, options = {}) {
    throw new Error('Not implemented: embeddings()');
  }
}

module.exports = EmbeddingsProviderContract;

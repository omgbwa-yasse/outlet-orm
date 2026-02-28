'use strict';

/**
 * ModelsProviderContract
 * Base class for providers that support listing models.
 */
class ModelsProviderContract {
  /**
   * List models metadata as returned by the provider.
   * @returns {Promise<Array>}
   */
  async listModels() {
    throw new Error('Not implemented: listModels()');
  }

  /**
   * Retrieve a single model metadata by id/name.
   * @param {string} id
   * @returns {Promise<Object>}
   */
  async getModel(id) {
    throw new Error('Not implemented: getModel()');
  }
}

module.exports = ModelsProviderContract;

'use strict';

/**
 * ImageProviderContract
 * Base class for providers that support image generation.
 */
class ImageProviderContract {
  /**
   * Generate images from a prompt.
   * @param {string} prompt
   * @param {Object} [options={}]
   * @returns {Promise<{images: Array, meta?: Object, raw?: Object}>}
   */
  async generateImage(prompt, _options = {}) {
    throw new Error('Not implemented: generateImage()');
  }
}

module.exports = ImageProviderContract;

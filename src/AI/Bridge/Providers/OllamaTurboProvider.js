'use strict';

const OllamaProvider = require('./OllamaProvider');

/**
 * OllamaTurboProvider
 * Targets Ollama Turbo (SaaS) at https://ollama.com with API key auth.
 */
class OllamaTurboProvider extends OllamaProvider {
  /**
   * @param {string|null} apiKey
   * @param {string} [endpoint='https://ollama.com']
   */
  constructor(apiKey, endpoint = 'https://ollama.com') {
    super(endpoint);
    this.apiKey = apiKey || null;
  }

  /** @override */
  _decorateHeaders(headers) {
    headers = super._decorateHeaders(headers);
    if (this.apiKey) {
      const value = this.apiKey.toLowerCase().startsWith('bearer ')
        ? this.apiKey
        : `Bearer ${this.apiKey}`;
      headers['Authorization'] = value;
    }
    return headers;
  }
}

module.exports = OllamaTurboProvider;

'use strict';

const OpenAIProvider = require('./OpenAIProvider');

/**
 * MistralProvider
 * Targets Mistral AI API (https://api.mistral.ai) — OpenAI-compatible endpoints.
 */
class MistralProvider extends OpenAIProvider {
  /**
   * @param {string} apiKey
   * @param {string} [chatEndpoint='https://api.mistral.ai/v1/chat/completions']
   */
  constructor(apiKey, chatEndpoint = 'https://api.mistral.ai/v1/chat/completions') {
    super(apiKey, chatEndpoint);
    this.modelsEndpoint = 'https://api.mistral.ai/v1/models';
    this.embeddingsEndpoint = 'https://api.mistral.ai/v1/embeddings';
  }
}

module.exports = MistralProvider;

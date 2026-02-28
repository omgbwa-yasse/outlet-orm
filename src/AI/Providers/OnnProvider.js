'use strict';

/**
 * OnnProvider
 * Prompt-based chat at api.onn.ai with simulated streaming (70-char chunks).
 */
class OnnProvider {
  /**
   * @param {string} apiKey
   * @param {string} [endpoint='https://api.onn.ai/v1/chat']
   */
  constructor(apiKey, endpoint = 'https://api.onn.ai/v1/chat') {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  async chat(messages, options = {}) {
    const joined = messages.map(m => m.content).join('\n');
    const payload = {
      prompt: joined,
      model: options.model || 'onn-default',
    };
    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data || {};
  }

  async *stream(messages, options = {}) {
    const full = await this.chat(messages, options);
    const text = full.response || '';
    for (let i = 0; i < text.length; i += 70) {
      yield text.slice(i, i + 70);
    }
  }

  supportsStreaming() { return true; } // simulated
}

module.exports = OnnProvider;

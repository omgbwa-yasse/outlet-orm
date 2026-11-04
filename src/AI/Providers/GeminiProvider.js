'use strict';

const { fetchWithTimeout } = require('../Support/Fetch');

/**
 * GeminiProvider
 * Google Generative Language API. Supports chat, simulated streaming, and embeddings.
 */
class GeminiProvider {
  /**
   * @param {string} apiKey
   * @param {string} [chatEndpoint='https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent']
   */
  constructor(apiKey, chatEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent') {
    this.apiKey = apiKey;
    this.chatEndpoint = chatEndpoint;
    this.embedEndpoint = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';
  }

  /** @private */
  _headers() {
    return {
      'Content-Type': 'application/json',
      'x-goog-api-key': this.apiKey
    };
  }

  async chat(messages, _options = {}) {
    const userTexts = messages
      .filter(m => (m.role || '') !== 'system')
      .map(m => m.content);

    const payload = {
      contents: [{ parts: [{ text: userTexts.join('\n') }] }],
    };

    const res = await fetchWithTimeout(this.chatEndpoint, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data || {};
  }

  async *stream(messages, options = {}) {
    const full = await this.chat(messages, options);
    const text = full?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    for (let i = 0; i < text.length; i += 80) {
      yield text.slice(i, i + 80);
    }
  }

  supportsStreaming() { return true; } // simulated

  async embeddings(inputs, _options = {}) {
    const vectors = [];
    for (const input of inputs) {
      const payload = {
        model: 'text-embedding-004',
        content: { parts: [{ text: input }] },
      };
      const res = await fetchWithTimeout(this.embedEndpoint, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      vectors.push((data?.embedding || {}).values || []);
    }
    return { embeddings: vectors };
  }
}

module.exports = GeminiProvider;

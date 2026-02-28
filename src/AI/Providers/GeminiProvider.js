'use strict';

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
  _keyQuery() { return `?key=${this.apiKey}`; }

  async chat(messages, options = {}) {
    const userTexts = messages
      .filter(m => (m.role || '') !== 'system')
      .map(m => m.content);

    const payload = {
      contents: [{ parts: [{ text: userTexts.join('\n') }] }],
    };

    const res = await fetch(this.chatEndpoint + this._keyQuery(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  async embeddings(inputs, options = {}) {
    const vectors = [];
    for (const input of inputs) {
      const payload = {
        model: 'text-embedding-004',
        content: { parts: [{ text: input }] },
      };
      const res = await fetch(this.embedEndpoint + this._keyQuery(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      vectors.push((data?.embedding || {}).values || []);
    }
    return { embeddings: vectors };
  }
}

module.exports = GeminiProvider;

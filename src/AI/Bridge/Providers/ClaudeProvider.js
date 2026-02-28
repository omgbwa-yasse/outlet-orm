'use strict';

/**
 * ClaudeProvider
 * Anthropic Messages API. System messages are converted to user role.
 * Streaming is simulated via chunk-splitting (60-char chunks).
 */
class ClaudeProvider {
  /**
   * @param {string} apiKey
   * @param {string} [endpoint='https://api.anthropic.com/v1/messages']
   */
  constructor(apiKey, endpoint = 'https://api.anthropic.com/v1/messages') {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  /** @private */
  _headers() {
    return {
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  async chat(messages, options = {}) {
    // Convert system messages to user role (Claude requirement)
    const converted = messages.map(m => {
      if ((m.role || '') === 'system') return { role: 'user', content: m.content };
      return m;
    });

    const payload = {
      model: options.model || 'claude-3-opus-20240229',
      max_tokens: options.max_tokens || 512,
      messages: converted,
    };
    if (options.temperature !== undefined) payload.temperature = options.temperature;

    const res = await fetch(this.endpoint, {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data || {};
  }

  async *stream(messages, options = {}) {
    const full = await this.chat(messages, options);
    let text = '';
    if (full?.content?.[0]?.text) text = full.content[0].text;
    // Simulated: yield 60-char chunks
    for (let i = 0; i < text.length; i += 60) {
      yield text.slice(i, i + 60);
    }
  }

  supportsStreaming() { return true; } // simulated
}

module.exports = ClaudeProvider;

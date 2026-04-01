'use strict';

const ChatNormalizer = require('../Support/ChatNormalizer');
const StreamChunk = require('../Support/StreamChunk');

/**
 * TextBuilder
 * Fluent builder for text generation over AI providers.
 * Keeps method names short and explicit, reducing array option errors.
 *
 * @example
 * const result = await manager.text()
 *   .using('openai', 'gpt-4o-mini')
 *   .withPrompt('Explain quantum computing')
 *   .withMaxTokens(200)
 *   .asText();
 */
class TextBuilder {
  static ERR_MISSING_USING = 'Provider and model must be set via using().';

  /**
   * @param {import('../AIManager')} manager
   */
  constructor(manager) {
    this._manager = manager;
    this._provider = null;
    this._model = null;
    this._providerConfig = {};
    this._messages = [];
    this._systemPrompt = null;
    this._maxTokens = null;
    this._temperature = null;
    this._topP = null;
  }

  /**
   * Set the provider and model (required).
   * @param {string} provider
   * @param {string} model
   * @param {Object} [providerConfig={}]
   * @returns {this}
   */
  using(provider, model, providerConfig = {}) {
    this._provider = provider;
    this._model = model;
    this._providerConfig = providerConfig;
    return this;
  }

  /**
   * Add a user prompt message.
   * @param {string} text
   * @param {Array} [attachments=[]]
   * @returns {this}
   */
  withPrompt(text, attachments = []) {
    const msg = { role: 'user', content: text };
    if (attachments.length > 0) msg.attachments = attachments;
    this._messages.push(msg);
    return this;
  }

  /** Alias for withPrompt */
  prompt(text) { return this.withPrompt(text); }

  /**
   * Set the system prompt.
   * @param {string} text
   * @returns {this}
   */
  withSystemPrompt(text) {
    this._systemPrompt = text;
    return this;
  }

  /** @param {number} tokens @returns {this} */
  withMaxTokens(tokens) { this._maxTokens = tokens; return this; }

  /** @param {number} t @returns {this} */
  usingTemperature(t) { this._temperature = t; return this; }

  /** @param {number} p @returns {this} */
  usingTopP(p) { this._topP = p; return this; }

  // ─── Override helpers ───

  /** @param {string} key @returns {this} */
  withApiKey(key) { this._providerConfig.api_key = key; return this; }
  /** @param {string} ep @returns {this} */
  withEndpoint(ep) { this._providerConfig.endpoint = ep; return this; }
  /** @param {string} url @returns {this} */
  withBaseUrl(url) { this._providerConfig.base_url = url; return this; }
  /** @param {string} url @returns {this} */
  withChatEndpoint(url) { this._providerConfig.chat_endpoint = url; return this; }
  /** @param {string} header @param {string} [prefix='Bearer '] @returns {this} */
  withAuthHeader(header, prefix = 'Bearer ') { this._providerConfig.auth_header = header; this._providerConfig.auth_prefix = prefix; return this; }
  /** @param {Object} headers @returns {this} */
  withExtraHeaders(headers) { this._providerConfig.extra_headers = headers; return this; }
  /** @param {Object} paths @returns {this} */
  withPaths(paths) { this._providerConfig.paths = paths; return this; }

  // ─── Private helpers ───

  /** @private */
  _buildMessages() {
    const msgs = [...this._messages];
    if (this._systemPrompt) {
      msgs.unshift({ role: 'system', content: this._systemPrompt });
    }
    return msgs;
  }

  /** @private */
  _callOptions() {
    const opts = { ...this._providerConfig };
    if (this._model) opts.model = this._model;
    if (this._maxTokens !== null) opts.max_tokens = this._maxTokens;
    if (this._temperature !== null) opts.temperature = this._temperature;
    if (this._topP !== null) opts.top_p = this._topP;
    return opts;
  }

  // ─── Terminal methods ───

  /**
   * Execute and return normalized text response.
   * @returns {Promise<{text: string, raw: Object, usage: Object|null, finish_reason: string|null}>}
   */
  async asText() {
    if (!this._provider || !this._model) throw new Error(TextBuilder.ERR_MISSING_USING);
    const res = await this._manager.chat(this._provider, this._buildMessages(), this._callOptions());
    const norm = ChatNormalizer.normalize(res);
    return {
      text: norm.text || '',
      raw: res,
      usage: norm.usage || null,
      finish_reason: norm.finish_reason || null,
    };
  }

  /**
   * Execute and return raw provider response.
   * @returns {Promise<Object>}
   */
  async asRaw() {
    if (!this._provider || !this._model) throw new Error(TextBuilder.ERR_MISSING_USING);
    return this._manager.chat(this._provider, this._buildMessages(), this._callOptions());
  }

  /**
   * Execute as a streaming generator of StreamChunk objects.
   * @returns {AsyncGenerator<StreamChunk>}
   */
  async *asStream() {
    if (!this._provider || !this._model) throw new Error(TextBuilder.ERR_MISSING_USING);
    for await (const chunk of this._manager.stream(this._provider, this._buildMessages(), this._callOptions())) {
      if (typeof chunk === 'string') {
        yield StreamChunk.delta(chunk);
      } else if (chunk && typeof chunk === 'object') {
        const text = String(chunk.delta || chunk.text || '');
        yield new StreamChunk(text, chunk.usage || null, chunk.finish_reason || null,
          chunk.type || 'delta', chunk.tool_calls || [], chunk.tool_results || []);
      } else {
        yield StreamChunk.delta(String(chunk));
      }
    }
  }
}

module.exports = TextBuilder;

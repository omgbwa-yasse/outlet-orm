'use strict';

const OpenAIProvider = require('./Providers/OpenAIProvider');
const OllamaProvider = require('./Providers/OllamaProvider');
const OllamaTurboProvider = require('./Providers/OllamaTurboProvider');
const OnnProvider = require('./Providers/OnnProvider');
const GeminiProvider = require('./Providers/GeminiProvider');
const GrokProvider = require('./Providers/GrokProvider');
const ClaudeProvider = require('./Providers/ClaudeProvider');
const MistralProvider = require('./Providers/MistralProvider');
const CustomOpenAIProvider = require('./Providers/CustomOpenAIProvider');
const ProviderError = require('./Support/Exceptions/ProviderError');
const ToolRegistry = require('./Support/ToolRegistry');
const ToolChatRunner = require('./Support/ToolChatRunner');

const BEARER_PREFIX = 'Bearer ';

/**
 * AiBridgeManager
 * Central orchestrator for all AI providers. Supports provider registration,
 * per-call overrides, capability delegation (chat, stream, embeddings, images,
 * audio, models), tool registration, and chatWithTools loop.
 */
class AiBridgeManager {
  /**
   * @param {Object} config
   */
  constructor(config = {}) {
    this._providers = {};
    this._toolRegistry = new ToolRegistry();
    this._options = config.options || {};

    // Auto-register providers from config
    if (config.openai?.api_key) {
      this._providers.openai = new OpenAIProvider(config.openai.api_key);
    }
    if (config.ollama?.endpoint) {
      this._providers.ollama = new OllamaProvider(config.ollama.endpoint);
    }
    if (config.ollama_turbo?.api_key) {
      const ep = config.ollama_turbo.endpoint || 'https://ollama.com';
      this._providers.ollama_turbo = new OllamaTurboProvider(config.ollama_turbo.api_key, ep);
    }
    if (config.onn?.api_key) {
      this._providers.onn = new OnnProvider(config.onn.api_key);
    }
    if (config.gemini?.api_key) {
      this._providers.gemini = new GeminiProvider(config.gemini.api_key);
    }
    if (config.grok?.api_key) {
      this._providers.grok = new GrokProvider(config.grok.api_key);
    }
    if (config.claude?.api_key) {
      this._providers.claude = new ClaudeProvider(config.claude.api_key);
    }
    if (config.mistral?.api_key) {
      const ep = config.mistral.endpoint || 'https://api.mistral.ai/v1/chat/completions';
      this._providers.mistral = new MistralProvider(config.mistral.api_key, ep);
    }
    if (config.openai_custom?.api_key && config.openai_custom?.base_url) {
      const c = config.openai_custom;
      this._providers.openai_custom = new CustomOpenAIProvider(
        c.api_key, c.base_url, c.paths || {},
        c.auth_header || 'Authorization', c.auth_prefix || BEARER_PREFIX,
        c.extra_headers || {}
      );
    }
    // OpenRouter (OpenAI-compatible)
    if (config.openrouter?.api_key) {
      const base = config.openrouter.base_url || 'https://openrouter.ai/api/v1';
      const hdrs = {};
      if (config.openrouter.referer) hdrs['HTTP-Referer'] = config.openrouter.referer;
      if (config.openrouter.title) hdrs['X-Title'] = config.openrouter.title;
      this._providers.openrouter = new CustomOpenAIProvider(
        config.openrouter.api_key, base,
        { chat: '/chat/completions', embeddings: '/embeddings', image: '/images/generations', tts: '/audio/speech', stt: '/audio/transcriptions' },
        'Authorization', BEARER_PREFIX, hdrs
      );
    }
  }

  // ─── Provider resolution ───

  /** @private */
  _hasOverrides(options) {
    const keys = ['api_key', 'endpoint', 'base_url', 'chat_endpoint', 'auth_header', 'auth_prefix', 'paths', 'extra_headers'];
    return keys.some(k => options[k] !== undefined);
  }

  /** @private */
  _buildProviderFromOptions(name, options) {
    switch (name) {
      case 'openai': {
        const api = options.api_key;
        if (api) return new OpenAIProvider(api, options.chat_endpoint || 'https://api.openai.com/v1/chat/completions');
        break;
      }
      case 'ollama': return new OllamaProvider(options.endpoint || 'http://localhost:11434');
      case 'ollama_turbo': {
        const api = options.api_key;
        if (api) return new OllamaTurboProvider(api, options.endpoint || 'https://ollama.com');
        break;
      }
      case 'onn': {
        const api = options.api_key;
        if (api) return new OnnProvider(api, options.endpoint || 'https://api.onn.ai/v1/chat');
        break;
      }
      case 'gemini': {
        const api = options.api_key;
        if (api) return new GeminiProvider(api, options.endpoint);
        break;
      }
      case 'grok': {
        const api = options.api_key;
        if (api) return new GrokProvider(api, options.endpoint);
        break;
      }
      case 'claude': {
        const api = options.api_key;
        if (api) return new ClaudeProvider(api, options.endpoint);
        break;
      }
      case 'mistral': {
        const api = options.api_key;
        if (api) return new MistralProvider(api, options.endpoint || 'https://api.mistral.ai/v1/chat/completions');
        break;
      }
      case 'openai_custom': {
        const api = options.api_key;
        const base = options.base_url;
        if (api && base) {
          return new CustomOpenAIProvider(api, base, options.paths || {},
            options.auth_header || 'Authorization', options.auth_prefix || BEARER_PREFIX,
            options.extra_headers || {});
        }
        break;
      }
      case 'openrouter': {
        const api = options.api_key;
        if (api) {
          const base = options.base_url || 'https://openrouter.ai/api/v1';
          const hdrs = {};
          if (options.referer) hdrs['HTTP-Referer'] = options.referer;
          if (options.title) hdrs['X-Title'] = options.title;
          return new CustomOpenAIProvider(api, base,
            { chat: '/chat/completions', embeddings: '/embeddings', image: '/images/generations', tts: '/audio/speech', stt: '/audio/transcriptions' },
            'Authorization', BEARER_PREFIX, hdrs
          );
        }
        break;
      }
    }
    return null;
  }

  /** @private */
  _resolveProvider(name, options = {}) {
    if (this._hasOverrides(options)) {
      const p = this._buildProviderFromOptions(name, options);
      if (p) return p;
    }
    if (this._providers[name]) return this._providers[name];
    const p = this._buildProviderFromOptions(name, options);
    if (p) { this._providers[name] = p; }
    return p || null;
  }

  // ─── Public API ───

  /**
   * Get a registered provider by name.
   * @param {string} name
   * @returns {Object|null}
   */
  provider(name) {
    return this._providers[name] || null;
  }

  /**
   * Register a provider instance.
   * @param {string} name
   * @param {Object} provider
   * @returns {this}
   */
  registerProvider(name, provider) {
    this._providers[name] = provider;
    return this;
  }

  // ─── Chat ───
  async chat(provider, messages, options = {}) {
    const p = this._resolveProvider(provider, options);
    if (!p || typeof p.chat !== 'function') throw ProviderError.unsupported(provider, 'chat');
    return p.chat(messages, options);
  }

  // ─── Stream ───
  async *stream(provider, messages, options = {}) {
    const p = this._resolveProvider(provider, options);
    if (!p || typeof p.stream !== 'function') throw ProviderError.unsupported(provider, 'streaming');
    yield* p.stream(messages, options);
  }

  // ─── Stream Events ───
  async *streamEvents(provider, messages, options = {}) {
    const p = this._resolveProvider(provider, options);
    if (!p || typeof p.supportsStreaming !== 'function' || !p.supportsStreaming()) {
      throw ProviderError.unsupported(provider, 'streaming');
    }
    if (typeof p.streamEvents === 'function') {
      yield* p.streamEvents(messages, options);
      return;
    }
    for await (const chunk of p.stream(messages, options)) {
      yield { type: 'delta', data: chunk };
    }
    yield { type: 'end', data: null };
  }

  // ─── Embeddings ───
  async embeddings(provider, inputs, options = {}) {
    const p = this._resolveProvider(provider, options);
    if (!p || typeof p.embeddings !== 'function') throw ProviderError.unsupported(provider, 'embeddings');
    return p.embeddings(inputs, options);
  }

  // ─── Models ───
  async models(provider) {
    const p = this._providers[provider];
    if (!p || typeof p.listModels !== 'function') throw ProviderError.unsupported(provider, 'models');
    return p.listModels();
  }

  async model(provider, id) {
    const p = this._providers[provider];
    if (!p || typeof p.getModel !== 'function') throw ProviderError.unsupported(provider, 'model');
    return p.getModel(id);
  }

  // ─── Images ───
  async image(provider, prompt, options = {}) {
    const p = this._resolveProvider(provider, options);
    if (!p || typeof p.generateImage !== 'function') throw ProviderError.unsupported(provider, 'image');
    return p.generateImage(prompt, options);
  }

  // ─── Audio ───
  async tts(provider, text, options = {}) {
    const p = this._resolveProvider(provider, options);
    if (!p || typeof p.textToSpeech !== 'function') throw ProviderError.unsupported(provider, 'tts');
    return p.textToSpeech(text, options);
  }

  async stt(provider, filePath, options = {}) {
    const p = this._resolveProvider(provider, options);
    if (!p || typeof p.speechToText !== 'function') throw ProviderError.unsupported(provider, 'stt');
    return p.speechToText(filePath, options);
  }

  // ─── Fluent builder ───
  text() {
    const TextBuilder = require('./Builders/TextBuilder');
    return new TextBuilder(this);
  }

  // ─── Tools API ───
  registerTool(tool) {
    this._toolRegistry.register(tool);
    return this;
  }

  tool(name) {
    return this._toolRegistry.get(name);
  }

  tools() {
    return this._toolRegistry.all();
  }

  async chatWithTools(provider, messages, options = {}) {
    const runner = new ToolChatRunner(this);
    return runner.run(provider, messages, options);
  }
}

module.exports = AiBridgeManager;

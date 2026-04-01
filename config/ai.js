'use strict';

/**
 * AI default configuration.
 *
 * All values can be overridden via environment variables.
 * Copy this file to your project and customise, or rely on .env.
 *
 * @since 8.0.0
 */
module.exports = {

  /**
   * The default provider to use when none is specified.
   * Env: AI_DEFAULT_PROVIDER
   */
  default: process.env.AI_DEFAULT_PROVIDER || 'openai',

  /**
   * Provider configurations.
   * Each key is a provider name. Only providers with api_key or endpoint
   * will be activated on construction.
   */
  providers: {

    openai: {
      api_key: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      endpoint: process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
      responses_endpoint: process.env.OPENAI_RESPONSES_ENDPOINT || 'https://api.openai.com/v1/responses',
      embeddings_endpoint: process.env.OPENAI_EMBEDDINGS_ENDPOINT || 'https://api.openai.com/v1/embeddings',
      images_endpoint: process.env.OPENAI_IMAGES_ENDPOINT || 'https://api.openai.com/v1/images/generations',
      audio_tts_endpoint: process.env.OPENAI_AUDIO_TTS_ENDPOINT || 'https://api.openai.com/v1/audio/speech',
      audio_stt_endpoint: process.env.OPENAI_AUDIO_STT_ENDPOINT || 'https://api.openai.com/v1/audio/transcriptions',
    },

    ollama: {
      endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3.2',
    },

    ollama_turbo: {
      api_key: process.env.OLLAMA_TURBO_API_KEY || '',
      endpoint: process.env.OLLAMA_TURBO_ENDPOINT || 'https://ollama.com',
      model: process.env.OLLAMA_TURBO_MODEL || 'llama3.2',
    },

    claude: {
      api_key: process.env.CLAUDE_API_KEY || '',
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      endpoint: process.env.CLAUDE_ENDPOINT || 'https://api.anthropic.com/v1/messages',
    },

    gemini: {
      api_key: process.env.GEMINI_API_KEY || '',
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      endpoint: process.env.GEMINI_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta',
    },

    grok: {
      api_key: process.env.GROK_API_KEY || '',
      model: process.env.GROK_MODEL || 'grok-1',
      endpoint: process.env.GROK_ENDPOINT || 'https://api.x.ai/v1/chat/completions',
    },

    mistral: {
      api_key: process.env.MISTRAL_API_KEY || '',
      model: process.env.MISTRAL_MODEL || 'mistral-small-latest',
      endpoint: process.env.MISTRAL_ENDPOINT || 'https://api.mistral.ai/v1/chat/completions',
    },

    onn: {
      api_key: process.env.ONN_API_KEY || '',
      model: process.env.ONN_MODEL || 'onn-medium',
      endpoint: process.env.ONN_ENDPOINT || 'https://api.onn.ai/v1/completions',
    },

    /**
     * Custom OpenAI-compatible provider (Azure, OpenRouter, proxies, etc.)
     * All keys are optional — configure only what you need.
     */
    openai_custom: {
      api_key: process.env.OPENAI_CUSTOM_API_KEY || '',
      base_url: process.env.OPENAI_CUSTOM_BASE_URL || '',
      model: process.env.OPENAI_CUSTOM_MODEL || '',
      auth_header: process.env.OPENAI_CUSTOM_AUTH_HEADER || 'Authorization',
      auth_prefix: process.env.OPENAI_CUSTOM_AUTH_PREFIX || 'Bearer',
      paths: {
        chat: process.env.OPENAI_CUSTOM_PATH_CHAT || '/chat/completions',
        embeddings: process.env.OPENAI_CUSTOM_PATH_EMBEDDINGS || '/embeddings',
        models: process.env.OPENAI_CUSTOM_PATH_MODELS || '/models',
        images: process.env.OPENAI_CUSTOM_PATH_IMAGES || '/images/generations',
        audio_tts: process.env.OPENAI_CUSTOM_PATH_TTS || '/audio/speech',
        audio_stt: process.env.OPENAI_CUSTOM_PATH_STT || '/audio/transcriptions',
      },
    },

    /**
     * OpenRouter (shorthand for Custom OpenAI with OpenRouter base URL).
     */
    openrouter: {
      api_key: process.env.OPENROUTER_API_KEY || '',
      base_url: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-70b-instruct',
    },

  },

  /**
   * Global settings
   */
  settings: {
    /** Maximum file size in bytes for file attachments (default 10 MB) */
    max_file_bytes: Number(process.env.AI_MAX_FILE_BYTES) || 10 * 1024 * 1024,

    /** Default max tokens for responses */
    default_max_tokens: Number(process.env.AI_MAX_TOKENS) || 2048,

    /** Default temperature */
    default_temperature: Number(process.env.AI_TEMPERATURE) || 0.7,

    /** Max tool call iterations (for chatWithTools loop) */
    max_tool_iterations: Number(process.env.AI_MAX_TOOL_ITERATIONS) || 5,
  },
};

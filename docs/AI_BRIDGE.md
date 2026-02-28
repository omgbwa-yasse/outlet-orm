# AiBridge — Multi-Provider LLM Abstraction

> **Since v8.0.0** — AiBridge provides a unified API to interact with 9+ LLM providers using zero production dependencies (Node 18+ native `fetch`).

## Overview

AiBridge is a full port of the PHP/Laravel [AiBridge](https://github.com/YourOrg/AiBridge) v2.6.0 into outlet-orm as a native Node.js module. It lets you:

- **Chat** with any LLM provider through a single API
- **Stream** responses in real time (SSE or simulated)
- **Generate embeddings**, images, TTS, and STT
- **Call tools** (function calling) with an automatic orchestration loop
- **Switch providers** without changing application code

## Quick Start

```javascript
const { AiBridgeManager } = require('outlet-orm');

// 1. Create manager with config
const ai = new AiBridgeManager({
  default: 'openai',
  providers: {
    openai: {
      api_key: process.env.OPENAI_API_KEY,
      model: 'gpt-4o'
    }
  }
});

// 2. Chat
const response = await ai.chat('openai', [
  { role: 'user', content: 'What is Node.js?' }
]);

console.log(response.text);
```

---

## Configuration

AiBridge is configured via `config/aibridge.js` (auto-loaded) or a config object passed to the constructor. All values can be overridden via environment variables.

### Configuration File

```javascript
// config/aibridge.js
module.exports = {
  default: process.env.AI_DEFAULT_PROVIDER || 'openai',

  providers: {
    openai: {
      api_key: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      endpoint: process.env.OPENAI_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
      responses_endpoint: process.env.OPENAI_RESPONSES_ENDPOINT || 'https://api.openai.com/v1/responses',
      embeddings_endpoint: process.env.OPENAI_EMBEDDINGS_ENDPOINT || 'https://api.openai.com/v1/embeddings',
      images_endpoint: process.env.OPENAI_IMAGES_ENDPOINT || 'https://api.openai.com/v1/images/generations',
      audio_tts_endpoint: process.env.OPENAI_TTS_ENDPOINT || 'https://api.openai.com/v1/audio/speech',
      audio_stt_endpoint: process.env.OPENAI_STT_ENDPOINT || 'https://api.openai.com/v1/audio/transcriptions',
    },

    ollama: {
      endpoint: process.env.OLLAMA_ENDPOINT || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'llama3',
    },

    ollama_turbo: {
      api_key: process.env.OLLAMA_TURBO_API_KEY,
      endpoint: process.env.OLLAMA_TURBO_ENDPOINT || 'https://api.ollama.ai',
      model: process.env.OLLAMA_TURBO_MODEL || 'llama3',
    },

    claude: {
      api_key: process.env.ANTHROPIC_API_KEY,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      endpoint: process.env.CLAUDE_ENDPOINT || 'https://api.anthropic.com/v1/messages',
    },

    gemini: {
      api_key: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
      endpoint: process.env.GEMINI_ENDPOINT,
    },

    grok: {
      api_key: process.env.GROK_API_KEY,
      model: process.env.GROK_MODEL || 'grok-1',
      endpoint: process.env.GROK_ENDPOINT || 'https://api.x.ai/v1/chat/completions',
    },

    mistral: {
      api_key: process.env.MISTRAL_API_KEY,
      model: process.env.MISTRAL_MODEL || 'mistral-large-latest',
      endpoint: process.env.MISTRAL_ENDPOINT || 'https://api.mistral.ai/v1/chat/completions',
    },

    onn: {
      api_key: process.env.ONN_API_KEY,
      model: process.env.ONN_MODEL || 'onn-default',
      endpoint: process.env.ONN_ENDPOINT || 'https://api.onn.ai/v1/chat',
    },

    openai_custom: {
      api_key: process.env.CUSTOM_OPENAI_API_KEY,
      base_url: process.env.CUSTOM_OPENAI_BASE_URL || 'http://localhost:1234/v1',
      model: process.env.CUSTOM_OPENAI_MODEL || 'local-model',
      auth_header: process.env.CUSTOM_OPENAI_AUTH_HEADER || 'Authorization',
      auth_prefix: process.env.CUSTOM_OPENAI_AUTH_PREFIX || 'Bearer',
      paths: {
        chat: '/chat/completions',
        embeddings: '/embeddings',
        models: '/models',
        images: '/images/generations',
        audio_tts: '/audio/speech',
        audio_stt: '/audio/transcriptions',
      },
    },

    openrouter: {
      api_key: process.env.OPENROUTER_API_KEY,
      base_url: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o',
    },
  },

  settings: {
    max_file_bytes: parseInt(process.env.AI_MAX_FILE_BYTES || '10485760'),   // 10 MB
    default_max_tokens: parseInt(process.env.AI_MAX_TOKENS || '2048'),
    default_temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
    max_tool_iterations: parseInt(process.env.AI_MAX_TOOL_ITERATIONS || '5'),
  },
};
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AI_DEFAULT_PROVIDER` | Default provider name | `openai` |
| `OPENAI_API_KEY` | OpenAI API key | — |
| `OPENAI_MODEL` | OpenAI model | `gpt-4o` |
| `ANTHROPIC_API_KEY` | Claude API key | — |
| `CLAUDE_MODEL` | Claude model | `claude-sonnet-4-20250514` |
| `GEMINI_API_KEY` | Google Gemini API key | — |
| `OLLAMA_ENDPOINT` | Ollama local URL | `http://localhost:11434` |
| `GROK_API_KEY` | xAI Grok API key | — |
| `MISTRAL_API_KEY` | Mistral AI API key | — |
| `ONN_API_KEY` | Onn.ai API key | — |
| `OPENROUTER_API_KEY` | OpenRouter API key | — |
| `AI_MAX_TOKENS` | Default max tokens | `2048` |
| `AI_TEMPERATURE` | Default temperature | `0.7` |
| `AI_MAX_TOOL_ITERATIONS` | Max tool-calling loop iterations | `5` |
| `AI_MAX_FILE_BYTES` | Max file size for attachments | `10485760` (10 MB) |

---

## AiBridgeManager API

### Constructor

```javascript
const ai = new AiBridgeManager(config);
```

Providers listed in the config are auto-registered. Supported provider keys: `openai`, `ollama`, `ollama_turbo`, `onn`, `gemini`, `grok`, `claude`, `mistral`, `openai_custom`, `openrouter`.

### Chat

```javascript
const response = await ai.chat('openai', [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Explain closures in JavaScript.' }
], { model: 'gpt-4o-mini', max_tokens: 500 });

console.log(response.text);
```

### Streaming

```javascript
// Raw stream (AsyncGenerator<StreamChunk>)
for await (const chunk of ai.stream('openai', messages)) {
  process.stdout.write(chunk.text || '');
}

// Structured events
for await (const event of ai.streamEvents('openai', messages)) {
  if (event.type === 'delta') {
    process.stdout.write(event.data.text || '');
  } else if (event.type === 'end') {
    console.log('\n--- Done ---');
  }
}
```

### Embeddings

```javascript
const result = await ai.embeddings('openai', [
  'The quick brown fox',
  'A lazy dog'
], { model: 'text-embedding-3-small' });

console.log(result.vectors); // [[0.012, -0.034, ...], [...]]
```

### Image Generation

```javascript
const image = await ai.image('openai', 'A sunset over mountains', {
  model: 'dall-e-3',
  size: '1024x1024'
});

console.log(image.url); // or image.b64_json
```

### Text-to-Speech

```javascript
const { audio, mime } = await ai.tts('openai', 'Hello, world!', {
  voice: 'alloy',
  model: 'tts-1'
});
```

### Speech-to-Text

```javascript
const { text } = await ai.stt('openai', '/path/to/audio.mp3', {
  model: 'whisper-1'
});
console.log(text);
```

### List Models

```javascript
const models = await ai.models('openai');
console.log(models); // [{ id: 'gpt-4o', ... }, ...]

const single = await ai.model('openai', 'gpt-4o');
```

### Provider Management

```javascript
// Get a registered provider
const openai = ai.provider('openai');

// Register a custom provider
ai.registerProvider('my-provider', new CustomOpenAIProvider(...));
```

### Per-Call Overrides

Override API keys, endpoints, or models for a single call:

```javascript
const response = await ai.chat('openai', messages, {
  api_key: 'sk-different-key',
  endpoint: 'https://my-proxy.com/v1/chat/completions',
  model: 'gpt-4o-mini'
});
```

---

## TextBuilder (Fluent API)

The `TextBuilder` provides a chainable interface for text generation:

```javascript
const ai = new AiBridgeManager(config);

// Simple text generation
const { text } = await ai.text()
  .using('openai', 'gpt-4o')
  .withSystemPrompt('You are a poet.')
  .withPrompt('Write a haiku about coding.')
  .withMaxTokens(100)
  .usingTemperature(0.9)
  .asText();

console.log(text);
```

### TextBuilder Methods

| Method | Description |
|--------|-------------|
| `.using(provider, model)` | Set provider and model (required) |
| `.withPrompt(text, attachments?)` | Add a user message |
| `.withSystemPrompt(text)` | Set the system prompt |
| `.withMaxTokens(n)` | Set max tokens limit |
| `.usingTemperature(t)` | Set temperature (0.0–2.0) |
| `.usingTopP(p)` | Set top_p sampling |
| `.withApiKey(key)` | Override API key |
| `.withEndpoint(url)` | Override endpoint URL |
| `.withBaseUrl(url)` | Override base URL |
| `.withChatEndpoint(url)` | Override chat endpoint |
| `.withAuthHeader(header, prefix?)` | Override auth header |
| `.withExtraHeaders(headers)` | Set extra HTTP headers |
| `.withPaths(paths)` | Set custom API paths |

### Terminal Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `.asText()` | `{ text, raw, usage, finish_reason }` | Normalized text response |
| `.asRaw()` | `Object` | Raw provider response |
| `.asStream()` | `AsyncGenerator<StreamChunk>` | Streaming generator |

### Examples

```javascript
// Stream response
for await (const chunk of ai.text()
  .using('openai', 'gpt-4o')
  .withPrompt('Tell me a story')
  .asStream()
) {
  process.stdout.write(chunk.text || '');
}

// With custom endpoint (LM Studio, vLLM, etc.)
const { text } = await ai.text()
  .using('openai_custom', 'local-model')
  .withBaseUrl('http://localhost:1234/v1')
  .withPrompt('Hello!')
  .asText();

// With file attachments
const { text } = await ai.text()
  .using('ollama', 'llava')
  .withPrompt('Describe this image', [
    Document.fromLocalPath('/path/to/image.png')
  ])
  .asText();
```

---

## Tool Calling (Function Calling)

AiBridge supports LLM function calling with an automatic tool execution loop.

### Define a Tool

```javascript
const { ToolContract } = require('outlet-orm');

class WeatherTool extends ToolContract {
  name() { return 'get_weather'; }
  description() { return 'Get current weather for a city'; }

  schema() {
    return {
      type: 'object',
      properties: {
        city: { type: 'string', description: 'City name' }
      },
      required: ['city']
    };
  }

  async execute({ city }) {
    // Call your weather API
    return JSON.stringify({ city, temperature: 22, unit: 'celsius' });
  }
}
```

### Register and Use Tools

```javascript
const ai = new AiBridgeManager(config);

// Register tool
ai.registerTool(new WeatherTool());

// Chat with tools — auto-executes tool calls
const response = await ai.chatWithTools('openai', [
  { role: 'user', content: 'What\'s the weather in Paris?' }
]);

console.log(response.text);
// "The weather in Paris is 22°C."
```

### Built-in Tools

| Tool | Name | Description |
|------|------|-------------|
| `SystemInfoTool` | `system_info` | Returns Node.js version, platform, architecture, uptime |

### Tool Registry

```javascript
// Register
ai.registerTool(myTool);

// Get a tool by name
const tool = ai.tool('get_weather');

// Get all tools
const all = ai.tools();
```

The `chatWithTools` method runs an iterative loop (max `max_tool_iterations` rounds) where:
1. The LLM is called with tool definitions
2. If the LLM requests a tool call, the tool is executed
3. The tool result is appended to the conversation
4. The LLM is called again until it produces a final text response

---

## Providers

### Supported Providers

| Provider | Class | Capabilities |
|----------|-------|-------------|
| **OpenAI** | `OpenAIProvider` | Chat, SSE streaming, embeddings, images (DALL-E), TTS, STT (Whisper), models, function calling |
| **Ollama** | `OllamaProvider` | Chat, NDJSON streaming, embeddings, images, multimodal vision |
| **Ollama Turbo** | `OllamaTurboProvider` | Same as Ollama with Bearer token auth |
| **Claude** | `ClaudeProvider` | Chat, simulated streaming |
| **Gemini** | `GeminiProvider` | Chat, simulated streaming, embeddings |
| **Grok** | `GrokProvider` | Chat, simulated streaming |
| **Mistral** | `MistralProvider` | Same as OpenAI (extends OpenAIProvider) |
| **ONN** | `OnnProvider` | Chat, simulated streaming |
| **Custom OpenAI** | `CustomOpenAIProvider` | Fully configurable OpenAI-compatible endpoint |
| **OpenRouter** | Registered as `CustomOpenAIProvider` | OpenRouter.ai proxy to 100+ models |

### Provider Contracts

All providers implement one or more of these base contracts:

| Contract | Methods |
|----------|---------|
| `ChatProviderContract` | `chat(messages, options)`, `stream(messages, options)`, `supportsStreaming()` |
| `EmbeddingsProviderContract` | `embeddings(inputs, options)` |
| `ImageProviderContract` | `generateImage(prompt, options)` |
| `AudioProviderContract` | `textToSpeech(text, options)`, `speechToText(filePath, options)` |
| `ModelsProviderContract` | `listModels()`, `getModel(id)` |
| `ToolContract` | `name()`, `description()`, `schema()`, `execute(args)` |

### Custom Provider

Use `CustomOpenAIProvider` for any OpenAI-compatible API (LM Studio, vLLM, Azure OpenAI, etc.):

```javascript
const { CustomOpenAIProvider, AiBridgeManager } = require('outlet-orm');

const provider = new CustomOpenAIProvider(
  'sk-my-key',                        // API key
  'http://localhost:1234/v1',          // Base URL
  {                                     // Custom paths
    chat: '/chat/completions',
    embeddings: '/embeddings',
    models: '/models'
  },
  'Authorization',                     // Auth header
  'Bearer',                            // Auth prefix
  { 'X-Custom': 'value' }             // Extra headers
);

const ai = new AiBridgeManager({ default: 'custom' });
ai.registerProvider('custom', provider);
```

---

## AiBridge Facade

For convenience, `AiBridge` provides a static-like entry point:

```javascript
const { AiBridge, AiBridgeManager } = require('outlet-orm');

// Set up once
const manager = new AiBridgeManager(config);
AiBridge.setManager(manager);

// Use anywhere
const { text } = await AiBridge.text()
  .using('openai', 'gpt-4o')
  .withPrompt('Hello!')
  .asText();

// Shorthand
const response = await AiBridge.chat([
  { role: 'user', content: 'Hello' }
]);
```

---

## Support Classes

### Message

Value object for chat messages:

```javascript
const { Message } = require('outlet-orm');

const messages = [
  Message.system('You are a helpful assistant.'),
  Message.user('Hello!'),
  Message.assistant('Hi! How can I help you?'),
  Message.user('What is 2+2?')
];

const response = await ai.chat('openai', messages);
```

### Document

Multi-format document attachment:

```javascript
const { Document } = require('outlet-orm');

// From text
const doc = Document.fromText('Hello world');

// From URL
const doc = Document.fromUrl('https://example.com/file.pdf');

// From local file
const doc = Document.fromLocalPath('/path/to/file.pdf');

// From base64
const doc = Document.fromBase64(base64String, 'image/png');

// From chunks (for RAG)
const doc = Document.fromChunks(['chunk1', 'chunk2']);

// From file ID (OpenAI file references)
const doc = Document.fromFileId('file-abc123');
```

### StreamChunk

Structured DTO for streaming responses:

```javascript
for await (const chunk of ai.stream('openai', messages)) {
  // chunk.text        — text delta
  // chunk.usage       — token usage (on last chunk)
  // chunk.finishReason — 'stop', 'length', 'tool_calls', etc.
  // chunk.chunkType   — 'delta' or 'end'
  // chunk.toolCalls   — tool call requests
  // chunk.toolResults — tool execution results
}
```

### Normalizers

AiBridge normalizes responses across all providers:

| Normalizer | Purpose |
|------------|---------|
| `ChatNormalizer` | Normalizes chat responses to `{ text, tool_calls, raw }` |
| `EmbeddingsNormalizer` | Normalizes embeddings to `{ vectors, usage, raw }` |
| `ImageNormalizer` | Normalizes image results from various formats |
| `AudioNormalizer` | Normalizes TTS → `{ b64, mime }` and STT → `{ text }` |

### FileSecurity

Validates file attachments:

```javascript
const { FileSecurity } = require('outlet-orm');

// Check file size (default 10 MB limit)
FileSecurity.validateSize(buffer, maxBytes);

// Allowed file types: text, PDF, JSON, CSV, HTML, markdown, XML
// Allowed image types: PNG, JPEG, GIF, WebP, SVG
```

### JsonSchemaValidator

Validates LLM structured outputs:

```javascript
const { JsonSchemaValidator } = require('outlet-orm');

const schema = {
  type: 'object',
  required: ['name', 'age'],
  properties: {
    name: { type: 'string' },
    age: { type: 'number' }
  }
};

const errors = JsonSchemaValidator.validate(data, schema);
// [] if valid, or array of error messages
```

---

## Error Handling

```javascript
const { ProviderError } = require('outlet-orm');

try {
  await ai.chat('unknown-provider', messages);
} catch (error) {
  if (error instanceof ProviderError) {
    console.error(error.message); // 'Provider "unknown-provider" not found'
  }
}
```

Error factories:
- `ProviderError.notFound(name)` — provider not registered
- `ProviderError.unsupported(name, feature)` — feature not supported by provider

---

## See Also

- [AI Query Builder](AI_QUERY.md) — Natural language to SQL
- [AI Seeder](AI_SEEDER.md) — AI-powered realistic data seeding
- [AI Query Optimizer](AI_OPTIMIZER.md) — SQL optimization suggestions
- [AI Prompt Enhancer](AI_PROMPT.md) — Schema/code generation from descriptions
- [MCP Server](MCP.md) — AI agent integration via Model Context Protocol
- [AI Safety Guardrails](AI_SAFETY.md) — Destructive operation protection

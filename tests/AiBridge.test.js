/**
 * Tests for AI module (v8.0.0)
 * - Contracts (base classes)
 * - Support classes (normalizers, value objects, tools)
 * - Providers (unit tests)
 * - AIManager (orchestration)
 * - TextBuilder (fluent API)
 * - ORM AI features (AIQueryBuilder, AISeeder, AIQueryOptimizer, AIPromptEnhancer)
 * - MCP tools (ai_query, query_optimize)
 */

'use strict';

// ─── Imports ─────────────────────────────────────────────────────

const ChatProviderContract   = require('../src/AI/Contracts/ChatProviderContract');
const EmbeddingsProviderContract = require('../src/AI/Contracts/EmbeddingsProviderContract');
const ImageProviderContract  = require('../src/AI/Contracts/ImageProviderContract');
const AudioProviderContract  = require('../src/AI/Contracts/AudioProviderContract');
const ModelsProviderContract = require('../src/AI/Contracts/ModelsProviderContract');
const ToolContract           = require('../src/AI/Contracts/ToolContract');

const ChatNormalizer         = require('../src/AI/Support/ChatNormalizer');
const EmbeddingsNormalizer   = require('../src/AI/Support/EmbeddingsNormalizer');
const ImageNormalizer        = require('../src/AI/Support/ImageNormalizer');
const AudioNormalizer        = require('../src/AI/Support/AudioNormalizer');
const StreamChunk            = require('../src/AI/Support/StreamChunk');
const Message                = require('../src/AI/Support/Message');
const Document               = require('../src/AI/Support/Document');
const FileSecurity           = require('../src/AI/Support/FileSecurity');
const JsonSchemaValidator    = require('../src/AI/Support/JsonSchemaValidator');
const ProviderError          = require('../src/AI/Support/Exceptions/ProviderError');
const ToolRegistry           = require('../src/AI/Support/ToolRegistry');
const ToolChatRunner         = require('../src/AI/Support/ToolChatRunner');
const SystemInfoTool         = require('../src/AI/Tools/SystemInfoTool');

const AIManager              = require('../src/AI/AIManager');
const TextBuilder            = require('../src/AI/Builders/TextBuilder');

const OpenAIProvider         = require('../src/AI/Providers/OpenAIProvider');
const OllamaProvider         = require('../src/AI/Providers/OllamaProvider');
const OllamaTurboProvider    = require('../src/AI/Providers/OllamaTurboProvider');
const ClaudeProvider         = require('../src/AI/Providers/ClaudeProvider');
const GeminiProvider         = require('../src/AI/Providers/GeminiProvider');
const GrokProvider           = require('../src/AI/Providers/GrokProvider');
const MistralProvider        = require('../src/AI/Providers/MistralProvider');
const OnnProvider            = require('../src/AI/Providers/OnnProvider');
const CustomOpenAIProvider   = require('../src/AI/Providers/CustomOpenAIProvider');

const AIQueryBuilder         = require('../src/AI/AIQueryBuilder');
const AISeeder               = require('../src/AI/AISeeder');
const AIQueryOptimizer       = require('../src/AI/AIQueryOptimizer');
const AIPromptEnhancer       = require('../src/AI/AIPromptEnhancer');

const MCPServer              = require('../src/AI/MCPServer');

// ═════════════════════════════════════════════════════════════════
// 1. CONTRACTS
// ═════════════════════════════════════════════════════════════════

describe('Contracts', () => {
  test('ChatProviderContract.chat() throws Not implemented', async () => {
    const c = new ChatProviderContract();
    await expect(c.chat([])).rejects.toThrow('Not implemented');
  });

  test('ChatProviderContract.stream() throws Not implemented', async () => {
    const c = new ChatProviderContract();
    const gen = c.stream([]);
    await expect(gen.next()).rejects.toThrow('Not implemented');
  });

  test('ChatProviderContract.supportsStreaming() returns false', () => {
    expect(new ChatProviderContract().supportsStreaming()).toBe(false);
  });

  test('EmbeddingsProviderContract.embeddings() throws', async () => {
    await expect(new EmbeddingsProviderContract().embeddings('x')).rejects.toThrow('Not implemented');
  });

  test('ImageProviderContract.generateImage() throws', async () => {
    await expect(new ImageProviderContract().generateImage('x')).rejects.toThrow('Not implemented');
  });

  test('AudioProviderContract methods throw', async () => {
    const a = new AudioProviderContract();
    await expect(a.textToSpeech('x')).rejects.toThrow('Not implemented');
    await expect(a.speechToText('x')).rejects.toThrow('Not implemented');
  });

  test('ModelsProviderContract methods throw', async () => {
    const m = new ModelsProviderContract();
    await expect(m.listModels()).rejects.toThrow('Not implemented');
    await expect(m.getModel('x')).rejects.toThrow('Not implemented');
  });

  test('ToolContract methods throw synchronously', () => {
    const t = new ToolContract();
    expect(() => t.name()).toThrow('Not implemented');
    expect(() => t.description()).toThrow('Not implemented');
    expect(() => t.schema()).toThrow('Not implemented');
    expect(() => t.execute({})).toThrow('Not implemented');
  });
});

// ═════════════════════════════════════════════════════════════════
// 2. SUPPORT CLASSES
// ═════════════════════════════════════════════════════════════════

describe('Support', () => {

  // ── ChatNormalizer ────────────────────────────────────────────

  describe('ChatNormalizer', () => {
    test('normalizes OpenAI choices format', () => {
      const raw = { choices: [{ message: { content: 'hello', role: 'assistant' } }] };
      const res = ChatNormalizer.normalize(raw);
      expect(res.text).toBe('hello');
      expect(res.raw).toBe(raw);
    });

    test('normalizes Ollama message format', () => {
      const raw = { message: { content: 'world', role: 'assistant' } };
      const res = ChatNormalizer.normalize(raw);
      expect(res.text).toBe('world');
    });

    test('normalizes plain response field', () => {
      const raw = { response: 'direct' };
      const res = ChatNormalizer.normalize(raw);
      expect(res.text).toBe('direct');
    });

    test('normalizes output_text field', () => {
      const raw = { output_text: 'raw text' };
      const res = ChatNormalizer.normalize(raw);
      expect(res.text).toBe('raw text');
    });

    test('normalizes Claude content format', () => {
      const raw = { content: [{ type: 'text', text: 'bonjour' }] };
      const res = ChatNormalizer.normalize(raw);
      expect(res.text).toBe('bonjour');
    });

    test('normalizes Gemini candidates format', () => {
      const raw = { candidates: [{ content: { parts: [{ text: 'hola' }] } }] };
      const res = ChatNormalizer.normalize(raw);
      expect(res.text).toBe('hola');
    });

    test('extracts tool calls from OpenAI format', () => {
      const raw = {
        choices: [{ message: { content: '', tool_calls: [{ id: '1', function: { name: 'f', arguments: '{}' } }] } }]
      };
      const res = ChatNormalizer.normalize(raw);
      expect(res.tool_calls).toHaveLength(1);
      expect(res.tool_calls[0].function.name).toBe('f');
    });

    test('extracts top-level tool_calls', () => {
      const raw = { tool_calls: [{ id: '2', function: { name: 'g', arguments: '{}' } }] };
      const res = ChatNormalizer.normalize(raw);
      expect(res.tool_calls).toHaveLength(1);
    });

    test('handles null/undefined gracefully', () => {
      expect(ChatNormalizer.normalize(null).text).toBe('');
      expect(ChatNormalizer.normalize(undefined).text).toBe('');
    });
  });

  // ── EmbeddingsNormalizer ──────────────────────────────────────

  describe('EmbeddingsNormalizer', () => {
    test('normalizes OpenAI data format', () => {
      const raw = { data: [{ embedding: [0.1, 0.2] }, { embedding: [0.3, 0.4] }] };
      const res = EmbeddingsNormalizer.normalize(raw);
      expect(res.vectors).toEqual([[0.1, 0.2], [0.3, 0.4]]);
      expect(res.raw).toBe(raw);
    });

    test('normalizes raw array format', () => {
      const raw = { embeddings: [[0.5, 0.6]] };
      const res = EmbeddingsNormalizer.normalize(raw);
      expect(res.vectors).toEqual([[0.5, 0.6]]);
    });

    test('normalizes Gemini single embedding', () => {
      const raw = { embedding: { values: [0.7, 0.8] } };
      const res = EmbeddingsNormalizer.normalize(raw);
      expect(res.vectors).toEqual([[0.7, 0.8]]);
    });
  });

  // ── ImageNormalizer ───────────────────────────────────────────

  describe('ImageNormalizer', () => {
    test('normalizes OpenAI image data', () => {
      const raw = { data: [{ url: 'https://img.png' }] };
      const res = ImageNormalizer.normalize(raw);
      expect(res[0].url).toBe('https://img.png');
      expect(res[0].type).toBe('url');
    });
  });

  // ── AudioNormalizer ───────────────────────────────────────────

  describe('AudioNormalizer', () => {
    test('normalizeTTS from object with audio property', () => {
      const b64 = Buffer.from('audio-data').toString('base64');
      const res = AudioNormalizer.normalizeTTS({ audio: b64 });
      expect(res.b64).toBe(b64);
      expect(res.mime).toBe('audio/mpeg');
    });

    test('normalizeTTS from object with data property', () => {
      const res = AudioNormalizer.normalizeTTS({ data: 'somedata' });
      expect(res.b64).toBe('somedata');
    });

    test('normalizeTTS from empty returns empty', () => {
      const res = AudioNormalizer.normalizeTTS({});
      expect(res.b64).toBe('');
    });

    test('normalizeSTT from object with text', () => {
      const res = AudioNormalizer.normalizeSTT({ text: 'hello world' });
      expect(res.text).toBe('hello world');
    });

    test('normalizeSTT from transcript field', () => {
      const res = AudioNormalizer.normalizeSTT({ transcript: 'transcribed' });
      expect(res.text).toBe('transcribed');
    });
  });

  // ── StreamChunk ───────────────────────────────────────────────

  describe('StreamChunk', () => {
    test('delta() creates delta chunk', () => {
      const c = StreamChunk.delta('hello');
      expect(c.text).toBe('hello');
      expect(c.chunkType).toBe('delta');
      expect(c.usage).toBeNull();
      expect(c.finishReason).toBeNull();
    });

    test('end() creates end chunk with finishReason first, usage second', () => {
      const c = StreamChunk.end('stop', { total: 10 });
      expect(c.chunkType).toBe('end');
      expect(c.finishReason).toBe('stop');
      expect(c.usage).toEqual({ total: 10 });
      expect(c.text).toBe('');
    });

    test('end() defaults', () => {
      const c = StreamChunk.end();
      expect(c.finishReason).toBe('stop');
      expect(c.usage).toBeNull();
    });

    test('constructor with all params', () => {
      const c = new StreamChunk('x', { t: 1 }, 'done', 'delta', [{ id: 1 }], []);
      expect(c.text).toBe('x');
      expect(c.usage).toEqual({ t: 1 });
      expect(c.finishReason).toBe('done');
      expect(c.toolCalls).toHaveLength(1);
    });
  });

  // ── Message ───────────────────────────────────────────────────

  describe('Message', () => {
    test('user() message', () => {
      const m = Message.user('hi');
      expect(m.role).toBe('user');
      expect(m.content).toBe('hi');
    });

    test('system() message', () => {
      const m = Message.system('you are helpful');
      expect(m.role).toBe('system');
    });

    test('assistant() message', () => {
      const m = Message.assistant('ok');
      expect(m.role).toBe('assistant');
    });

    test('toObject() serialization', () => {
      const m = Message.user('test');
      const obj = m.toObject();
      expect(obj.role).toBe('user');
      expect(obj.content).toBe('test');
    });

    test('user with attachments', () => {
      const doc = Document.fromText('doc');
      const m = Message.user('look at this', [doc]);
      expect(m.attachments).toHaveLength(1);
    });
  });

  // ── Document ──────────────────────────────────────────────────

  describe('Document', () => {
    test('fromText() document', () => {
      const d = Document.fromText('hello');
      expect(d.kind).toBe('text');
      expect(d.text).toBe('hello');
    });

    test('fromUrl() document', () => {
      const d = Document.fromUrl('https://example.com/img.png');
      expect(d.kind).toBe('url');
      expect(d.url).toBe('https://example.com/img.png');
    });

    test('fromBase64() document', () => {
      const d = Document.fromBase64('data', 'image/png');
      expect(d.kind).toBe('base64');
      expect(d.base64).toBe('data');
      expect(d.mime).toBe('image/png');
    });

    test('fromLocalPath()', () => {
      const d = Document.fromLocalPath('/tmp/file.txt', 'my file', 'text/plain');
      expect(d.kind).toBe('local');
      expect(d.path).toBe('/tmp/file.txt');
      expect(d.title).toBe('my file');
      expect(d.mime).toBe('text/plain');
    });

    test('fromChunks()', () => {
      const d = Document.fromChunks(['chunk1', 'chunk2'], 'chunks doc');
      expect(d.kind).toBe('chunks');
      expect(d.chunks).toEqual(['chunk1', 'chunk2']);
    });

    test('fromFileId()', () => {
      const d = Document.fromFileId('file-123', 'my file');
      expect(d.kind).toBe('file_id');
      expect(d.fileId).toBe('file-123');
    });
  });

  // ── ProviderError ─────────────────────────────────────────────

  describe('ProviderError', () => {
    test('notFound()', () => {
      const e = ProviderError.notFound('foo');
      expect(e).toBeInstanceOf(Error);
      expect(e.message).toContain('foo');
    });

    test('unsupported()', () => {
      const e = ProviderError.unsupported('ollama', 'tts');
      expect(e).toBeInstanceOf(Error);
      expect(e.message).toContain('ollama');
    });
  });

  // ── JsonSchemaValidator ───────────────────────────────────────

  describe('JsonSchemaValidator', () => {
    test('validates object with required fields', () => {
      const schema = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] };
      const res = JsonSchemaValidator.validate({ name: 'John' }, schema);
      expect(res.valid).toBe(true);
      expect(res.errors).toHaveLength(0);
    });

    test('rejects object missing required fields', () => {
      const schema = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] };
      const res = JsonSchemaValidator.validate({}, schema);
      expect(res.valid).toBe(false);
      expect(res.errors.length).toBeGreaterThan(0);
    });

    test('validates array type', () => {
      const schema = { type: 'array', items: { type: 'number' } };
      const res = JsonSchemaValidator.validate([1, 2, 3], schema);
      expect(res.valid).toBe(true);
    });

    test('validates primitive types', () => {
      expect(JsonSchemaValidator.validate('hello', { type: 'string' }).valid).toBe(true);
      expect(JsonSchemaValidator.validate(42, { type: 'number' }).valid).toBe(true);
      expect(JsonSchemaValidator.validate(42, { type: 'integer' }).valid).toBe(true);
      expect(JsonSchemaValidator.validate(true, { type: 'boolean' }).valid).toBe(true);
    });

    test('rejects wrong primitive types', () => {
      expect(JsonSchemaValidator.validate(42, { type: 'string' }).valid).toBe(false);
      expect(JsonSchemaValidator.validate('hello', { type: 'number' }).valid).toBe(false);
    });
  });

  // ── ToolRegistry ──────────────────────────────────────────────

  describe('ToolRegistry', () => {
    test('register and retrieve tool', () => {
      const registry = new ToolRegistry();
      const tool = new SystemInfoTool();
      registry.register(tool);
      expect(registry.has('system_info')).toBe(true);
      expect(registry.get('system_info')).toBe(tool);
      expect(registry.size).toBe(1);
    });

    test('get returns null for missing tool', () => {
      const registry = new ToolRegistry();
      expect(registry.get('nonexistent')).toBeNull();
    });

    test('all() returns plain object keyed by name', () => {
      const registry = new ToolRegistry();
      registry.register(new SystemInfoTool());
      const all = registry.all();
      expect(typeof all).toBe('object');
      expect(Array.isArray(all)).toBe(false);
      expect(all).toHaveProperty('system_info');
      expect(Object.keys(all)).toHaveLength(1);
    });
  });

  // ── SystemInfoTool ────────────────────────────────────────────

  describe('SystemInfoTool', () => {
    test('name is system_info', () => {
      expect(new SystemInfoTool().name()).toBe('system_info');
    });

    test('description is a non-empty string', () => {
      expect(typeof new SystemInfoTool().description()).toBe('string');
      expect(new SystemInfoTool().description().length).toBeGreaterThan(0);
    });

    test('execute returns system info as JSON string', () => {
      const raw = new SystemInfoTool().execute();
      expect(typeof raw).toBe('string');
      const result = JSON.parse(raw);
      expect(result).toHaveProperty('node_version');
      expect(result).toHaveProperty('platform');
      expect(result).toHaveProperty('arch');
      expect(typeof result.uptime).toBe('number');
    });

    test('schema returns valid JSON schema', () => {
      const s = new SystemInfoTool().schema();
      expect(s.type).toBe('object');
    });
  });

  // ── FileSecurity ──────────────────────────────────────────────

  describe('FileSecurity', () => {
    const path = require('path');
    const fs = require('fs');
    const os = require('os');

    test('fromDefaults() creates instance', () => {
      const sec = FileSecurity.fromDefaults();
      expect(sec).toBeInstanceOf(FileSecurity);
    });

    test('validateFile rejects non-existent file', () => {
      const sec = FileSecurity.fromDefaults();
      expect(sec.validateFile('/nonexistent/file.txt')).toBe(false);
    });

    test('validateFile accepts existing small file', () => {
      const tmp = path.join(os.tmpdir(), '_test_aibridge_filesec.txt');
      fs.writeFileSync(tmp, 'hello');
      try {
        const sec = FileSecurity.fromDefaults();
        expect(sec.validateFile(tmp)).toBe(true);
      } finally {
        fs.unlinkSync(tmp);
      }
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// 3. PROVIDERS — constructor / instantiation (positional args)
// ═════════════════════════════════════════════════════════════════

describe('Providers', () => {
  test('OpenAIProvider constructs with api key (positional)', () => {
    const p = new OpenAIProvider('sk-test');
    expect(p).toBeDefined();
    expect(typeof p.chat).toBe('function');
    expect(p.supportsStreaming()).toBe(true);
  });

  test('OpenAIProvider with custom endpoint', () => {
    const p = new OpenAIProvider('sk-test', 'https://custom.openai.com/v1/chat/completions');
    expect(p).toBeDefined();
  });

  test('OllamaProvider constructs with endpoint', () => {
    const p = new OllamaProvider('http://localhost:11434');
    expect(p).toBeDefined();
    expect(typeof p.chat).toBe('function');
    expect(p.supportsStreaming()).toBe(true);
  });

  test('OllamaProvider default endpoint', () => {
    const p = new OllamaProvider();
    expect(p).toBeDefined();
  });

  test('OllamaTurboProvider extends OllamaProvider', () => {
    const p = new OllamaTurboProvider('key', 'https://ollama.com');
    expect(p).toBeInstanceOf(OllamaProvider);
  });

  test('ClaudeProvider constructs', () => {
    const p = new ClaudeProvider('key');
    expect(p).toBeDefined();
    expect(typeof p.chat).toBe('function');
  });

  test('GeminiProvider constructs', () => {
    const p = new GeminiProvider('key');
    expect(p).toBeDefined();
    expect(typeof p.chat).toBe('function');
  });

  test('GrokProvider constructs', () => {
    const p = new GrokProvider('key');
    expect(p).toBeDefined();
    expect(typeof p.chat).toBe('function');
  });

  test('MistralProvider extends OpenAIProvider', () => {
    const p = new MistralProvider('key');
    expect(p).toBeInstanceOf(OpenAIProvider);
  });

  test('OnnProvider constructs', () => {
    const p = new OnnProvider('key');
    expect(p).toBeDefined();
    expect(typeof p.chat).toBe('function');
  });

  test('CustomOpenAIProvider constructs with positional args', () => {
    const p = new CustomOpenAIProvider('key', 'https://my.api.com/v1');
    expect(p).toBeDefined();
    expect(typeof p.chat).toBe('function');
    expect(p.supportsStreaming()).toBe(true);
  });

  test('CustomOpenAIProvider trims trailing slashes from baseUrl', () => {
    const p = new CustomOpenAIProvider('key', 'https://my.api.com/v1///');
    // The baseUrl should have trailing slashes stripped
    expect(p).toBeDefined();
  });

  test('All providers have stream method', () => {
    const providers = [
      new OpenAIProvider('k'),
      new OllamaProvider(),
      new ClaudeProvider('k'),
      new GeminiProvider('k'),
      new GrokProvider('k'),
      new MistralProvider('k'),
      new OnnProvider('k'),
      new CustomOpenAIProvider('k', 'https://api.com'),
    ];
    for (const p of providers) {
      expect(typeof p.stream).toBe('function');
    }
  });
});

// ═════════════════════════════════════════════════════════════════
// 4. AI MANAGER
// ═════════════════════════════════════════════════════════════════

describe('AIManager', () => {
  let manager;

  beforeEach(() => {
    manager = new AIManager({
      openai: { api_key: 'sk-test' },
      ollama: { endpoint: 'http://localhost:11434' },
    });
  });

  test('provider() returns registered provider', () => {
    const p = manager.provider('openai');
    expect(p).toBeDefined();
    expect(p).not.toBeNull();
    expect(typeof p.chat).toBe('function');
  });

  test('provider() returns ollama', () => {
    const p = manager.provider('ollama');
    expect(p).toBeDefined();
    expect(p).not.toBeNull();
  });

  test('provider() returns null for unknown name', () => {
    expect(manager.provider('nonexistent')).toBeNull();
  });

  test('registerProvider() adds custom provider', () => {
    const custom = new OnnProvider('x');
    manager.registerProvider('myProvider', custom);
    expect(manager.provider('myProvider')).toBe(custom);
  });

  test('text() returns TextBuilder', () => {
    const tb = manager.text();
    expect(tb).toBeInstanceOf(TextBuilder);
  });

  test('registerTool() and tools()', () => {
    manager.registerTool(new SystemInfoTool());
    const t = manager.tool('system_info');
    expect(t).toBeDefined();
    expect(t.name()).toBe('system_info');
    // tools() returns a plain object, not an array
    const allTools = manager.tools();
    expect(typeof allTools).toBe('object');
    expect(allTools).toHaveProperty('system_info');
    expect(Object.keys(allTools)).toHaveLength(1);
  });

  test('constructs with all provider types', () => {
    const m = new AIManager({
      openai: { api_key: 'sk-test' },
      ollama: { endpoint: 'http://localhost:11434' },
      ollama_turbo: { api_key: 'tk' },
      claude: { api_key: 'ck' },
      gemini: { api_key: 'gk' },
      grok: { api_key: 'grk' },
      mistral: { api_key: 'mk' },
      onn: { api_key: 'ok' },
      openai_custom: { api_key: 'ock', base_url: 'https://custom.api.com' },
      openrouter: { api_key: 'ork' },
    });
    expect(m.provider('openai')).not.toBeNull();
    expect(m.provider('claude')).not.toBeNull();
    expect(m.provider('gemini')).not.toBeNull();
    expect(m.provider('grok')).not.toBeNull();
    expect(m.provider('mistral')).not.toBeNull();
    expect(m.provider('onn')).not.toBeNull();
    expect(m.provider('openai_custom')).not.toBeNull();
    expect(m.provider('openrouter')).not.toBeNull();
  });

  test('chat() throws for unknown provider', async () => {
    await expect(manager.chat('nonexistent', [])).rejects.toThrow();
  });

  test('stream() throws for unknown provider', async () => {
    const gen = manager.stream('nonexistent', []);
    await expect(gen.next()).rejects.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════
// 5. TEXT BUILDER
// ═════════════════════════════════════════════════════════════════

describe('TextBuilder', () => {
  let manager;

  beforeEach(() => {
    manager = new AIManager({ openai: { api_key: 'sk-test' } });
  });

  test('fluent chain returns same instance', () => {
    const tb = new TextBuilder(manager);
    const result = tb
      .using('openai', 'gpt-4o')
      .withSystemPrompt('You are helpful')
      .withPrompt('Hello')
      .withMaxTokens(100)
      .usingTemperature(0.5)
      .usingTopP(0.9);
    expect(result).toBe(tb);
  });

  test('override helpers set correct fields in _providerConfig', () => {
    const tb = new TextBuilder(manager);
    tb.withApiKey('new-key')
      .withEndpoint('https://custom.endpoint.com')
      .withBaseUrl('https://base.com')
      .withExtraHeaders({ 'X-Org': 'myorg' });
    expect(tb._providerConfig.api_key).toBe('new-key');
    expect(tb._providerConfig.endpoint).toBe('https://custom.endpoint.com');
    expect(tb._providerConfig.base_url).toBe('https://base.com');
    expect(tb._providerConfig.extra_headers).toEqual({ 'X-Org': 'myorg' });
  });

  test('withPaths() sets custom paths in _providerConfig', () => {
    const tb = new TextBuilder(manager);
    const paths = { chat: '/v1/chat', models: '/v1/models' };
    expect(tb.withPaths(paths)).toBe(tb);
    expect(tb._providerConfig.paths).toEqual(paths);
  });
});

// ═════════════════════════════════════════════════════════════════
// 6. ORM AI FEATURES
// ═════════════════════════════════════════════════════════════════

describe('ORM AI Features', () => {

  // ── Helper: mock manager with chat() ─────────────────────────
  // The ORM AI classes call manager.chat(providerName, messages, options)
  // which returns the raw provider JSON response (e.g., {choices: [...]})

  function createMockManager(rawResponse) {
    return {
      chat: jest.fn().mockResolvedValue(rawResponse),
      stream: jest.fn(),
      provider: jest.fn().mockReturnValue({ chat: jest.fn(), stream: jest.fn() }),
    };
  }

  function createMockConnection(responses = {}) {
    return {
      config: { client: 'mysql' },
      raw: jest.fn().mockImplementation((sql, params) => {
        if (responses[sql]) return Promise.resolve(responses[sql]);
        if (sql.includes('SHOW TABLES')) return Promise.resolve([]);
        if (sql.includes('DESCRIBE')) return Promise.resolve([]);
        if (sql.startsWith('INSERT')) return Promise.resolve({ affectedRows: 1 });
        return Promise.resolve([]);
      }),
    };
  }

  // ── AIQueryBuilder ────────────────────────────────────────────

  describe('AIQueryBuilder', () => {
    test('constructs with manager and connection', () => {
      const qb = new AIQueryBuilder(createMockManager({}), createMockConnection());
      expect(qb).toBeDefined();
    });

    test('using() sets provider and model', () => {
      const qb = new AIQueryBuilder(createMockManager({}), createMockConnection());
      const result = qb.using('ollama', 'llama3');
      expect(result).toBe(qb);
    });

    test('safeMode() is chainable', () => {
      const qb = new AIQueryBuilder(createMockManager({}), createMockConnection());
      expect(qb.safeMode(false)).toBe(qb);
    });

    test('toSql() returns sql from LLM response', async () => {
      const jsonContent = JSON.stringify({ sql: 'SELECT * FROM users', params: [], explanation: 'List all users' });
      const rawResponse = { choices: [{ message: { content: jsonContent } }] };
      const mockManager = createMockManager(rawResponse);
      const qb = new AIQueryBuilder(mockManager, createMockConnection());

      const result = await qb.toSql('Show me all users');
      expect(result.sql).toBe('SELECT * FROM users');
      expect(result.explanation).toBe('List all users');
      expect(mockManager.chat).toHaveBeenCalledTimes(1);
    });

    test('query() rejects non-SELECT in safe mode', async () => {
      const jsonContent = JSON.stringify({ sql: 'DELETE FROM users', params: [] });
      const rawResponse = { choices: [{ message: { content: jsonContent } }] };
      const qb = new AIQueryBuilder(createMockManager(rawResponse), createMockConnection());

      await expect(qb.query('Delete everything')).rejects.toThrow('safe mode');
    });

    test('query() allows non-SELECT when safe mode is off', async () => {
      const jsonContent = JSON.stringify({ sql: 'DELETE FROM users WHERE id = 1', params: [] });
      const rawResponse = { choices: [{ message: { content: jsonContent } }] };
      const mockConn = createMockConnection();
      const qb = new AIQueryBuilder(createMockManager(rawResponse), mockConn);
      qb.safeMode(false);

      const result = await qb.query('Delete user 1');
      expect(result.sql).toBe('DELETE FROM users WHERE id = 1');
    });

    test('query() executes SQL and returns results', async () => {
      const jsonContent = JSON.stringify({ sql: 'SELECT * FROM users', params: [] });
      const rawResponse = { choices: [{ message: { content: jsonContent } }] };
      const mockConn = createMockConnection({});
      mockConn.raw.mockImplementation((sql, params) => {
        if (sql === 'SELECT * FROM users') return Promise.resolve([{ id: 1, name: 'Alice' }]);
        return Promise.resolve([]);
      });
      const qb = new AIQueryBuilder(createMockManager(rawResponse), mockConn);

      const result = await qb.query('Show all users');
      expect(result.sql).toBe('SELECT * FROM users');
      expect(result.results).toEqual([{ id: 1, name: 'Alice' }]);
    });
  });

  // ── AISeeder ──────────────────────────────────────────────────

  describe('AISeeder', () => {
    test('constructs with manager and connection', () => {
      const s = new AISeeder(createMockManager({}), createMockConnection());
      expect(s).toBeDefined();
    });

    test('using() sets provider and model', () => {
      const s = new AISeeder(createMockManager({}), createMockConnection());
      expect(s.using('claude', 'claude-sonnet-4-20250514')).toBe(s);
    });

    test('generate() returns array of records', async () => {
      const records = [{ name: 'Alice', email: 'alice@test.com' }, { name: 'Bob', email: 'bob@test.com' }];
      const jsonContent = JSON.stringify({ records });
      const rawResponse = { choices: [{ message: { content: jsonContent } }] };
      const s = new AISeeder(createMockManager(rawResponse), createMockConnection());

      const result = await s.generate('users', 2);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Alice');
    });

    test('seed() inserts records and returns count', async () => {
      const records = [{ name: 'Alice' }];
      const jsonContent = JSON.stringify({ records });
      const rawResponse = { choices: [{ message: { content: jsonContent } }] };
      const mockConn = createMockConnection();
      const s = new AISeeder(createMockManager(rawResponse), mockConn);

      const result = await s.seed('users', 1);
      expect(result.records).toHaveLength(1);
      expect(result.inserted).toBe(1);
      // raw() called at least for INSERT
      expect(mockConn.raw).toHaveBeenCalled();
    });
  });

  // ── AIQueryOptimizer ──────────────────────────────────────────

  describe('AIQueryOptimizer', () => {
    test('constructs with manager (connection optional)', () => {
      const o = new AIQueryOptimizer(createMockManager({}));
      expect(o).toBeDefined();
    });

    test('using() sets provider and model', () => {
      const o = new AIQueryOptimizer(createMockManager({}));
      expect(o.using('gemini', 'gemini-2.0-flash')).toBe(o);
    });

    test('optimize() returns optimization result', async () => {
      const optimResult = {
        optimized: 'SELECT id, name FROM users WHERE status = ? LIMIT 10',
        suggestions: [{ type: 'index', description: 'Add index on status', impact: 'high' }],
        explanation: 'Added LIMIT and column selection',
        indexes: ['CREATE INDEX idx_users_status ON users(status)'],
      };
      const jsonContent = JSON.stringify(optimResult);
      const rawResponse = { choices: [{ message: { content: jsonContent } }] };
      const o = new AIQueryOptimizer(createMockManager(rawResponse));

      const result = await o.optimize('SELECT * FROM users WHERE status = "active"');
      expect(result.original).toContain('SELECT *');
      expect(result.optimized).toContain('LIMIT 10');
      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].impact).toBe('high');
      expect(result.indexes).toHaveLength(1);
      expect(result.explanation).toContain('LIMIT');
    });
  });

  // ── AIPromptEnhancer ──────────────────────────────────────────

  describe('AIPromptEnhancer', () => {
    test('constructs with manager', () => {
      const e = new AIPromptEnhancer(createMockManager({}));
      expect(e).toBeDefined();
    });

    test('using() sets provider and model', () => {
      const e = new AIPromptEnhancer(createMockManager({}));
      expect(e.using('openai', 'gpt-4o')).toBe(e);
    });

    test('generateSchema() returns tables and relations', async () => {
      const schema = {
        tables: { users: { columns: ['name:string', 'email:string:unique'] }, posts: { columns: ['title:string', 'user_id:foreignId'] } },
        relations: [{ type: 'hasMany', from: 'users', to: 'posts' }],
        seedHints: { users: 'Realistic user profiles' },
      };
      const jsonContent = JSON.stringify(schema);
      const rawResponse = { choices: [{ message: { content: jsonContent } }] };
      const e = new AIPromptEnhancer(createMockManager(rawResponse));

      const result = await e.generateSchema('A blog platform with users and posts');
      expect(result.tables).toHaveProperty('users');
      expect(result.tables).toHaveProperty('posts');
      expect(result.relations).toHaveLength(1);
      expect(result.seedHints).toHaveProperty('users');
    });

    test('generateModelCode() returns code string', async () => {
      const code = "const { Model } = require('outlet-orm');\nclass User extends Model {}\nmodule.exports = User;";
      // generateModelCode reads from res?.output_text or res?.choices?.[0]?.message?.content
      const rawResponse = { choices: [{ message: { content: code } }] };
      const e = new AIPromptEnhancer(createMockManager(rawResponse));

      const result = await e.generateModelCode('users', { columns: ['name:string'] });
      expect(result).toContain('Model');
      expect(result).toContain('User');
    });

    test('generateMigrationCode() returns code string', async () => {
      const code = "const { Migration } = require('outlet-orm');\nclass CreateUsersTable extends Migration {}";
      const rawResponse = { choices: [{ message: { content: code } }] };
      const e = new AIPromptEnhancer(createMockManager(rawResponse));

      const result = await e.generateMigrationCode('users', { columns: ['name:string'] });
      expect(result).toContain('Migration');
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// 7. MCP SERVER — ai_query and query_optimize tools
// ═════════════════════════════════════════════════════════════════

describe('MCP Server — AI tools', () => {
  test('tools/list includes ai_query and query_optimize', async () => {
    const server = new MCPServer({ safetyGuardrails: false });
    const handler = server.handler();

    const response = await handler({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const toolNames = response.result.tools.map(t => t.name);
    expect(toolNames).toContain('ai_query');
    expect(toolNames).toContain('query_optimize');
  });

  test('ai_query tool definition has question parameter', async () => {
    const server = new MCPServer({ safetyGuardrails: false });
    const handler = server.handler();

    const response = await handler({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const aiQueryTool = response.result.tools.find(t => t.name === 'ai_query');
    expect(aiQueryTool).toBeDefined();
    expect(aiQueryTool.inputSchema.properties).toHaveProperty('question');
    expect(aiQueryTool.inputSchema.required).toContain('question');
  });

  test('query_optimize tool definition has sql parameter', async () => {
    const server = new MCPServer({ safetyGuardrails: false });
    const handler = server.handler();

    const response = await handler({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const tool = response.result.tools.find(t => t.name === 'query_optimize');
    expect(tool).toBeDefined();
    expect(tool.inputSchema.properties).toHaveProperty('sql');
    expect(tool.inputSchema.required).toContain('sql');
  });

  test('total tool count is 13 (11 original + 2 AI)', async () => {
    const server = new MCPServer({ safetyGuardrails: false });
    const handler = server.handler();

    const response = await handler({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(response.result.tools).toHaveLength(13);
  });
});

// ═════════════════════════════════════════════════════════════════
// 8. EXPORTS — verify main entry point
// ═════════════════════════════════════════════════════════════════

describe('Exports', () => {
  const outlet = require('../src/index');

  test('exports AIManager', () => {
    expect(outlet.AIManager).toBe(AIManager);
  });

  test('exports TextBuilder', () => {
    expect(outlet.TextBuilder).toBe(TextBuilder);
  });

  test('exports all providers', () => {
    expect(outlet.OpenAIProvider).toBe(OpenAIProvider);
    expect(outlet.OllamaProvider).toBe(OllamaProvider);
    expect(outlet.OllamaTurboProvider).toBe(OllamaTurboProvider);
    expect(outlet.ClaudeProvider).toBe(ClaudeProvider);
    expect(outlet.GeminiProvider).toBe(GeminiProvider);
    expect(outlet.GrokProvider).toBe(GrokProvider);
    expect(outlet.MistralProvider).toBe(MistralProvider);
    expect(outlet.OnnProvider).toBe(OnnProvider);
    expect(outlet.CustomOpenAIProvider).toBe(CustomOpenAIProvider);
  });

  test('exports all contracts', () => {
    expect(outlet.ChatProviderContract).toBe(ChatProviderContract);
    expect(outlet.EmbeddingsProviderContract).toBe(EmbeddingsProviderContract);
    expect(outlet.ImageProviderContract).toBe(ImageProviderContract);
    expect(outlet.AudioProviderContract).toBe(AudioProviderContract);
    expect(outlet.ModelsProviderContract).toBe(ModelsProviderContract);
    expect(outlet.ToolContract).toBe(ToolContract);
  });

  test('exports support classes', () => {
    expect(outlet.StreamChunk).toBe(StreamChunk);
    expect(outlet.Message).toBe(Message);
    expect(outlet.Document).toBe(Document);
    expect(outlet.ProviderError).toBe(ProviderError);
    expect(outlet.ToolRegistry).toBe(ToolRegistry);
    expect(outlet.ToolChatRunner).toBe(ToolChatRunner);
    expect(outlet.SystemInfoTool).toBe(SystemInfoTool);
  });

  test('exports ORM AI features', () => {
    expect(outlet.AIQueryBuilder).toBe(AIQueryBuilder);
    expect(outlet.AISeeder).toBe(AISeeder);
    expect(outlet.AIQueryOptimizer).toBe(AIQueryOptimizer);
    expect(outlet.AIPromptEnhancer).toBe(AIPromptEnhancer);
  });
});

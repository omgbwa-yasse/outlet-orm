'use strict';

const fs = require('fs');
const path = require('path');
const DocumentAttachmentMapper = require('../Support/DocumentAttachmentMapper');
const FileSecurity = require('../Support/FileSecurity');
const ProviderError = require('../Support/Exceptions/ProviderError');

/**
 * OllamaProvider
 * Implements chat, NDJSON streaming, embeddings, basic image generation,
 * structured JSON output (format=json), and multimodal vision input.
 */
class OllamaProvider {
  /**
   * @param {string} [endpoint='http://localhost:11434']
   */
  constructor(endpoint = 'http://localhost:11434') {
    this.base = endpoint.replace(/\/+$/, '');
    this.chatEndpoint = `${this.base}/api/chat`;
    this.embeddingsEndpoint = `${this.base}/api/embeddings`;
    this.generateEndpoint = `${this.base}/api/generate`;
  }

  /** @protected — override in subclass to add auth */
  _decorateHeaders(headers) {
    return headers;
  }

  /** @private */
  async _post(url, body, stream = false) {
    const headers = this._decorateHeaders({ 'Content-Type': 'application/json' });
    const fetchOpts = { method: 'POST', headers, body: JSON.stringify(body) };
    if (stream) return fetch(url, fetchOpts);
    const res = await fetch(url, fetchOpts);
    return res.json();
  }

  // ─── Chat ───
  async chat(messages, options = {}) {
    let accFiles = [];
    let accImages = [];

    // Process attachments
    for (let i = 0; i < messages.length; i++) {
      const atts = messages[i].attachments || [];
      if (atts.length > 0) {
        const mapped = DocumentAttachmentMapper.toOllamaOptions(atts);
        if (mapped.inlineTexts.length > 0) {
          messages[i].content = ((messages[i].content || '') + '\n' + mapped.inlineTexts.join('\n\n')).trim();
        }
        accFiles = accFiles.concat(mapped.files);
        accImages = accImages.concat(mapped.image_files);
        delete messages[i].attachments;
      }
    }

    const payload = {
      model: options.model || 'gemma3:4b',
      messages,
      stream: false,
    };

    // Options
    if (options.temperature) { payload.options = payload.options || {}; payload.options.temperature = options.temperature; }
    if (options.top_p) { payload.options = payload.options || {}; payload.options.top_p = options.top_p; }
    if (options.top_k) { payload.options = payload.options || {}; payload.options.top_k = options.top_k; }
    if (options.repeat_penalty) { payload.options = payload.options || {}; payload.options.repeat_penalty = options.repeat_penalty; }
    if (options.stop) { payload.options = payload.options || {}; payload.options.stop = Array.isArray(options.stop) ? options.stop : [options.stop]; }

    // JSON format
    if (options.response_format === 'json') {
      payload.format = 'json';
      const hasSystem = payload.messages.some(m => m.role === 'system');
      if (!hasSystem) {
        payload.messages.unshift({
          role: 'system',
          content: 'You must respond only with valid JSON without additional text.',
        });
      }
    }

    // Files and images
    const optFiles = (options.files && Array.isArray(options.files)) ? this._prepareFiles(options.files) : [];
    const optImages = (options.image_files && Array.isArray(options.image_files)) ? this._prepareImageFiles(options.image_files) : [];
    const files = optFiles.concat(accFiles);
    const images = optImages.concat(accImages);
    if (files.length > 0) payload.files = files;
    if (images.length > 0) {
      const lastIndex = payload.messages.length - 1;
      if (lastIndex >= 0 && payload.messages[lastIndex].role === 'user') {
        payload.messages[lastIndex].images = images;
      } else {
        payload.messages.push({ role: 'user', content: '', images });
      }
    }

    const data = await this._post(this.chatEndpoint, payload);
    return data || {};
  }

  // ─── Streaming (NDJSON) ───
  async *stream(messages, options = {}) {
    let accFiles = [];
    let accImages = [];

    for (let i = 0; i < messages.length; i++) {
      const atts = messages[i].attachments || [];
      if (atts.length > 0) {
        const mapped = DocumentAttachmentMapper.toOllamaOptions(atts);
        if (mapped.inlineTexts.length > 0) {
          messages[i].content = ((messages[i].content || '') + '\n' + mapped.inlineTexts.join('\n\n')).trim();
        }
        accFiles = accFiles.concat(mapped.files);
        accImages = accImages.concat(mapped.image_files);
        delete messages[i].attachments;
      }
    }

    const payload = {
      model: options.model || 'gemma3:4b',
      messages,
      stream: true,
    };

    if (options.temperature) { payload.options = payload.options || {}; payload.options.temperature = options.temperature; }
    if (options.top_p) { payload.options = payload.options || {}; payload.options.top_p = options.top_p; }
    if (options.top_k) { payload.options = payload.options || {}; payload.options.top_k = options.top_k; }
    if (options.repeat_penalty) { payload.options = payload.options || {}; payload.options.repeat_penalty = options.repeat_penalty; }
    if (options.stop) { payload.options = payload.options || {}; payload.options.stop = Array.isArray(options.stop) ? options.stop : [options.stop]; }
    if (options.response_format === 'json') payload.format = 'json';

    const optFiles = (options.files && Array.isArray(options.files)) ? this._prepareFiles(options.files) : [];
    const optImages = (options.image_files && Array.isArray(options.image_files)) ? this._prepareImageFiles(options.image_files) : [];
    const files = optFiles.concat(accFiles);
    const images = optImages.concat(accImages);
    if (files.length > 0) payload.files = files;
    if (images.length > 0) {
      const lastIndex = payload.messages.length - 1;
      if (lastIndex >= 0 && payload.messages[lastIndex].role === 'user') {
        payload.messages[lastIndex].images = images;
      } else {
        payload.messages.push({ role: 'user', content: '', images });
      }
    }

    const res = await this._post(this.chatEndpoint, payload, true);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const decoded = JSON.parse(trimmed);
            if (decoded?.message?.content) yield decoded.message.content;
          } catch { /* skip invalid JSON lines */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  supportsStreaming() { return true; }

  // ─── Embeddings ───
  async embeddings(inputs, options = {}) {
    const model = options.model || 'nomic-embed-text';
    const vectors = [];
    for (const text of inputs) {
      const res = await this._post(this.embeddingsEndpoint, { model, prompt: text });
      vectors.push(res.embedding || []);
    }
    return { embeddings: vectors, raw: null };
  }

  // ─── File helpers ───
  /** @private */
  _prepareFiles(files) {
    const out = [];
    const security = FileSecurity.fromConfig();
    for (const file of files) {
      if (typeof file !== 'string' || !fs.existsSync(file)) continue;
      if (!security.validateFile(file, false)) continue;
      out.push({
        name: path.basename(file),
        type: 'application/octet-stream',
        content: fs.readFileSync(file).toString('base64'),
      });
    }
    return out;
  }

  /** @private */
  _prepareImageFiles(files) {
    const images = [];
    const security = FileSecurity.fromConfig();
    for (const file of files) {
      if (typeof file !== 'string' || !fs.existsSync(file)) continue;
      const ext = path.extname(file).toLowerCase();
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];
      if (imageExts.includes(ext) && security.validateFile(file, true)) {
        images.push(fs.readFileSync(file).toString('base64'));
      }
    }
    return images;
  }

  // ─── Images ───
  async generateImage(prompt, options = {}) {
    const payload = {
      model: options.model || 'stable-diffusion',
      prompt,
      stream: false,
    };
    if (options.negative_prompt) payload.negative = options.negative_prompt;
    const res = await this._post(this.generateEndpoint, payload);

    const images = [];
    if (Array.isArray(res.images)) {
      for (const img of res.images) images.push({ b64: img });
    } else if (res.image) {
      images.push({ b64: res.image });
    } else if (typeof res.response === 'string' && res.response.startsWith('data:image')) {
      const match = res.response.match(/base64,(.*)$/);
      if (match) images.push({ b64: match[1] });
    }
    return { images, meta: { model: payload.model }, raw: res };
  }

  // ─── Audio (not supported) ───
  async textToSpeech(_text, _options = {}) {
    throw ProviderError.unsupported('ollama', 'tts');
  }

  async speechToText(_filePath, _options = {}) {
    throw ProviderError.unsupported('ollama', 'stt');
  }
}

module.exports = OllamaProvider;

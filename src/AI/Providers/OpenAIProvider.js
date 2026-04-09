'use strict';

const JsonSchemaValidator = require('../Support/JsonSchemaValidator');
const DocumentAttachmentMapper = require('../Support/DocumentAttachmentMapper');
const fs = require('fs');
const path = require('path');

/**
 * OpenAIProvider
 * Full-featured provider for OpenAI Chat Completions & Responses APIs.
 * Supports chat, streaming (SSE), embeddings, images (DALL-E), audio TTS/STT, models,
 * function calling, JSON schema validation.
 */
class OpenAIProvider {
  /**
   * @param {string} apiKey
   * @param {string} [chatEndpoint='https://api.openai.com/v1/chat/completions']
   */
  constructor(apiKey, chatEndpoint = 'https://api.openai.com/v1/chat/completions') {
    this.apiKey = apiKey;
    this.chatEndpoint = chatEndpoint;
    this.responsesEndpoint = 'https://api.openai.com/v1/responses';
    this.modelsEndpoint = 'https://api.openai.com/v1/models';
    this.embeddingsEndpoint = 'https://api.openai.com/v1/embeddings';
    this.imageEndpoint = 'https://api.openai.com/v1/images/generations';
    this.imageEditsEndpoint = 'https://api.openai.com/v1/images/edits';
    this.imageVariationsEndpoint = 'https://api.openai.com/v1/images/variations';
    this.speechToTextEndpoint = 'https://api.openai.com/v1/audio/transcriptions';
    this.speechTranslationsEndpoint = 'https://api.openai.com/v1/audio/translations';
    this.textToSpeechEndpoint = 'https://api.openai.com/v1/audio/speech';
    this.filesEndpoint = 'https://api.openai.com/v1/files';
    this.vectorStoresEndpoint = 'https://api.openai.com/v1/vector_stores';
  }

  /** @private */
  _headers(options = {}) {
    const h = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (options.organization) h['OpenAI-Organization'] = options.organization;
    if (options.project) h['OpenAI-Project'] = options.project;
    return h;
  }

  /** @private */
  async _post(url, body, options = {}, streamFlag = false) {
    const headers = this._headers(options);
    const fetchOpts = { method: 'POST', headers, body: JSON.stringify(body) };
    if (streamFlag) {
      // Return raw response for streaming
      return fetch(url, fetchOpts);
    }
    const res = await fetch(url, fetchOpts);
    return res.json();
  }

  /** @private */
  async _get(url, options = {}) {
    const headers = this._headers(options);
    const res = await fetch(url, { method: 'GET', headers });
    return res.json();
  }

  // ─── Chat ───
  async chat(messages, options = {}) {
    // Default: Responses API (unless api === 'chat')
    if ((options.api || null) !== 'chat') {
      const payload = this._buildResponsesPayload(messages, options);
      this._maybeAttachFileSearch(payload, options);
      const data = await this._post(this.responsesEndpoint, payload, options);
      if (options.response_format === 'json') {
        const schema = (options.json_schema || {}).schema || { type: 'object' };
        const rawContent = data.output_text || null;
        if (typeof rawContent === 'string') {
          try {
            const decoded = JSON.parse(rawContent);
            if (typeof decoded === 'object' && decoded !== null) {
              const errors = [];
              if (!JsonSchemaValidator.validate(decoded, schema, errors)) {
                data.schema_validation = { valid: false, errors };
              } else {
                data.schema_validation = { valid: true };
              }
            }
          } catch { /* not JSON */ }
        }
      }
      return data;
    }

    // Chat Completions API path
    const payload = this._buildBasePayload(messages, options);
    const schema = this._applySchemaIfAny(payload, options);
    this._applyNativeToolsIfAny(payload, options);
    const data = await this._post(this.chatEndpoint, payload, options);

    // Normalize tool_calls
    if (data?.choices?.[0]?.message?.tool_calls) {
      data.tool_calls = data.choices[0].message.tool_calls.map(tc => ({
        id: tc.id || null,
        name: (tc.function || {}).name || null,
        arguments: (() => { try { return JSON.parse((tc.function || {}).arguments || '{}'); } catch { return {}; } })(),
      }));
    }

    // Schema validation
    if (schema && data?.choices?.[0]?.message?.content) {
      try {
        const decoded = JSON.parse(data.choices[0].message.content);
        if (typeof decoded === 'object' && decoded !== null) {
          const errors = [];
          if (!JsonSchemaValidator.validate(decoded, schema, errors)) {
            data.schema_validation = { valid: false, errors };
          } else {
            data.schema_validation = { valid: true };
          }
        }
      } catch { /* not JSON */ }
    }
    return data;
  }

  /** @private */
  _buildBasePayload(messages, options) {
    const payload = { model: options.model || 'gpt-4o-mini', messages };
    const passThrough = ['temperature', 'top_p', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'stop', 'seed', 'user', 'logprobs', 'top_logprobs'];
    for (const k of passThrough) {
      if (options[k] !== undefined) payload[k] = options[k];
    }
    return payload;
  }

  /** @private */
  _buildResponsesPayload(messages, options) {
    // Process attachments
    for (let i = 0; i < messages.length; i++) {
      const atts = messages[i].attachments || [];
      if (atts.length > 0) {
        const inline = DocumentAttachmentMapper.extractInlineTexts(atts);
        if (inline.length > 0) {
          messages[i].content = ((messages[i].content || '') + '\n\n' + inline.join('\n\n')).trim();
        }
        delete messages[i].attachments;
      }
    }

    const model = options.model || 'gpt-4o-mini';
    const instructions = [];
    const parts = [];
    for (const m of messages) {
      const role = m.role || 'user';
      const content = Array.isArray(m.content) ? JSON.stringify(m.content) : (m.content || '');
      if (role === 'system') { instructions.push(content); continue; }
      parts.push(`${role}: ${content}`);
    }

    const payload = { model, input: parts.join('\n') };
    if (instructions.length > 0) payload.instructions = instructions.join('\n\n');

    const passThroughKeys = ['temperature', 'top_p', 'max_tokens', 'seed', 'stop', 'user', 'service_tier', 'prompt_cache_key', 'safety_identifier', 'logprobs', 'top_logprobs'];
    for (const k of passThroughKeys) {
      if (options[k] !== undefined) payload[k] = options[k];
    }

    // tools
    if (options.tools && Array.isArray(options.tools)) {
      payload.tools = options.tools.map(tool => {
        if (tool.type && tool.type !== 'function') return tool;
        return {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description || '',
            parameters: tool.parameters || tool.schema || { type: 'object', properties: {} },
          },
        };
      });
      if (options.tool_choice) payload.tool_choice = options.tool_choice;
    }

    // JSON schema response format
    if (options.response_format === 'json') {
      const schema = (options.json_schema || {}).schema || { type: 'object' };
      payload.response_format = {
        type: 'json_schema',
        json_schema: options.json_schema || { name: 'auto_schema', schema },
      };
    }

    return payload;
  }

  /** @private */
  _applySchemaIfAny(payload, options) {
    if (!options.response_format || options.response_format !== 'json') return null;
    const schema = (options.json_schema || {}).schema || { type: 'object' };
    payload.response_format = {
      type: 'json_schema',
      json_schema: options.json_schema || { name: 'auto_schema', schema },
    };
    return schema;
  }

  /** @private */
  _applyNativeToolsIfAny(payload, options) {
    if (!options.tools || !Array.isArray(options.tools)) return;
    payload.tools = options.tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.parameters || tool.schema || { type: 'object', properties: {} },
      },
    }));
    if (options.tool_choice) payload.tool_choice = options.tool_choice;
  }

  /** @private */
  _maybeAttachFileSearch(payload, options) {
    const tools = options.tools || [];
    const wantsFileSearch = tools.some(t => t.type === 'file_search');
    if (!wantsFileSearch) return payload;
    if (options.vector_store_id) {
      payload.resources = payload.resources || {};
      payload.resources.file_search = { vector_store_ids: [options.vector_store_id] };
      return payload;
    }
    if (options.file_ids && Array.isArray(options.file_ids)) {
      payload.resources = payload.resources || {};
      payload.resources.file_search = { file_ids: options.file_ids };
      return payload;
    }
    // File upload not supported in Node without multipart — skip for now
    return payload;
  }

  // ─── Streaming ───
  async *stream(messages, options = {}) {
    if ((options.api || null) !== 'chat') {
      const payload = this._buildResponsesPayload(messages, options);
      payload.stream = true;
      this._maybeAttachFileSearch(payload, options);
      const res = await this._post(this.responsesEndpoint, payload, options, true);
      yield* this._readResponsesSse(res.body);
      return;
    }
    const payload = this._buildBasePayload(messages, options);
    payload.stream = true;
    const res = await this._post(this.chatEndpoint, payload, options, true);
    yield* this._readSseStream(res.body);
  }

  async *streamEvents(messages, options = {}) {
    if ((options.api || null) !== 'chat') {
      const payload = this._buildResponsesPayload(messages, options);
      payload.stream = true;
      const res = await this._post(this.responsesEndpoint, payload, options, true);
      for await (const chunk of this._readLinesSse(res.body)) {
        if (chunk === '[DONE]') { yield { type: 'end', data: null }; return; }
        try {
          const decoded = JSON.parse(chunk);
          const evtType = decoded.type || null;
          if (evtType === 'response.completed') { yield { type: 'end', data: null }; return; }
          let text = decoded.delta || decoded.output_text || null;
          if (typeof text === 'object') text = null;
          if (text !== null && text !== '') yield { type: 'delta', data: text };
        } catch { /* skip */ }
      }
      return;
    }

    const payload = this._buildBasePayload(messages, options);
    payload.stream = true;
    const res = await this._post(this.chatEndpoint, payload, options, true);
    for await (const chunk of this._readLinesSse(res.body)) {
      if (chunk === '[DONE]') { yield { type: 'end', data: null }; return; }
      try {
        const decoded = JSON.parse(chunk);
        const delta = decoded?.choices?.[0]?.delta?.content || null;
        if (delta !== null) yield { type: 'delta', data: delta };
      } catch { /* skip */ }
    }
  }

  /** @private — yields raw text deltas from Chat Completions SSE */
  async *_readSseStream(body) {
    for await (const jsonStr of this._readLinesSse(body)) {
      if (jsonStr === '[DONE]') return;
      try {
        const decoded = JSON.parse(jsonStr);
        const delta = decoded?.choices?.[0]?.delta?.content || null;
        if (delta !== null) yield delta;
      } catch { /* skip */ }
    }
  }

  /** @private — yields raw text deltas from Responses API SSE */
  async *_readResponsesSse(body) {
    for await (const jsonStr of this._readLinesSse(body)) {
      if (jsonStr === '[DONE]') return;
      try {
        const decoded = JSON.parse(jsonStr);
        const evtType = decoded.type || null;
        if (evtType === 'response.completed') return;
        let text = decoded.delta || decoded.output_text || null;
        if (typeof text === 'object') text = null;
        if (text !== null && text !== '') yield text;
      } catch { /* skip */ }
    }
  }

  /**
   * @private
   * Low-level SSE line reader.
   * Yields the string after "data: " for each SSE line.
   */
  async *_readLinesSse(body) {
    const reader = body.getReader();
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
          if (trimmed === '' || trimmed.startsWith(':')) continue;
          if (!trimmed.startsWith('data:')) continue;
          const json = trimmed.slice(5).trim();
          yield json;
        }
      }
      // Flush remaining buffer
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith('data:')) {
          yield trimmed.slice(5).trim();
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  supportsStreaming() { return true; }

  // ─── Embeddings ───
  async embeddings(inputs, options = {}) {
    const payload = {
      model: options.model || 'text-embedding-3-small',
      input: inputs,
    };
    if (options.dimensions !== undefined) payload.dimensions = options.dimensions;
    if (options.encoding_format !== undefined) payload.encoding_format = options.encoding_format;
    const res = await this._post(this.embeddingsEndpoint, payload, options);
    return {
      embeddings: (res.data || []).map(d => d.embedding || []),
      usage: res.usage || {},
      raw: res,
    };
  }

  // ─── Images ───
  async generateImage(prompt, options = {}) {
    const mode = options.mode || 'generation';
    if (mode === 'edit' || mode === 'variation') {
      // Edit/variation require multipart — basic JSON fallback
      const payload = {
        prompt,
        model: options.model || 'dall-e-2',
        size: options.size || '1024x1024',
        n: options.n || 1,
      };
      const endpoint = mode === 'edit' ? this.imageEditsEndpoint : this.imageVariationsEndpoint;
      const res = await this._post(endpoint, payload, options);
      return { images: res.data || [], raw: res };
    }

    // Generation
    const payload = {
      prompt,
      model: options.model || 'dall-e-3',
      size: options.size || '1024x1024',
      n: options.n || 1,
    };
    if (payload.model === 'gpt-image-1') {
      if (options.image_format !== undefined) payload.image_format = options.image_format;
      if (options.quality !== undefined) payload.quality = options.quality;
      if (options.moderation !== undefined) payload.moderation = options.moderation;
    } else {
      payload.response_format = options.response_format || 'url';
    }
    const res = await this._post(this.imageEndpoint, payload, options);
    return { images: res.data || [], raw: res };
  }

  // ─── Audio TTS ───
  async textToSpeech(text, options = {}) {
    const format = options.format || 'mp3';
    const payload = {
      model: options.model || 'tts-1',
      input: text,
      voice: options.voice || 'alloy',
      format,
    };
    if (options.speed !== undefined) payload.speed = options.speed;
    if (options.voice_instructions) payload.voice_instructions = options.voice_instructions;

    // For SSE streaming TTS — not typical, fallback to normal
    const res = await fetch(this.textToSpeechEndpoint, {
      method: 'POST',
      headers: this._headers(options),
      body: JSON.stringify(payload),
    });

    const arrayBuf = await res.arrayBuffer();
    const b64 = Buffer.from(arrayBuf).toString('base64');
    const mimeMap = { mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac', aac: 'audio/aac', opus: 'audio/opus', pcm: 'audio/pcm' };
    return { audio: b64, mime: mimeMap[format] || 'application/octet-stream' };
  }

  // ─── Audio STT ───
  async speechToText(filePath, options = {}) {
    // Multipart upload via FormData (Node 18+)
    const { FormData, Blob } = await import('buffer').catch(() => ({}));
    const formData = new (globalThis.FormData || FormData)();
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new (globalThis.Blob || Blob)([fileBuffer], { type: 'application/octet-stream' });
    formData.append('file', blob, path.basename(filePath));
    formData.append('model', options.model || 'whisper-1');
    formData.append('response_format', options.response_format || 'json');
    if (options.language) formData.append('language', options.language);
    if (options.prompt) formData.append('prompt', options.prompt);
    if (options.temperature !== undefined) formData.append('temperature', String(options.temperature));

    const endpoint = (options.translate || options.mode === 'translation')
      ? this.speechTranslationsEndpoint
      : this.speechToTextEndpoint;

    const headers = { 'Authorization': `Bearer ${this.apiKey}` };
    if (options.organization) headers['OpenAI-Organization'] = options.organization;
    if (options.project) headers['OpenAI-Project'] = options.project;

    const res = await fetch(endpoint, { method: 'POST', headers, body: formData });
    const data = await res.json();
    return { text: data.text || '', raw: data };
  }

  // ─── Models ───
  async listModels() {
    const res = await this._get(this.modelsEndpoint);
    return res.data || [];
  }

  async getModel(id) {
    const res = await this._get(`${this.modelsEndpoint}/${encodeURIComponent(id)}`);
    return res || {};
  }
}

module.exports = OpenAIProvider;

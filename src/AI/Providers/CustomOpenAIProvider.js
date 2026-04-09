'use strict';

/**
 * CustomOpenAIProvider
 * Fully configurable OpenAI-compatible provider.
 * Works with Azure OpenAI, proxies, OpenRouter, self-hosted endpoints, etc.
 * Supports chat, streaming (SSE), embeddings, images, audio TTS/STT, and models.
 */
class CustomOpenAIProvider {
  /**
   * @param {string} apiKey
   * @param {string} baseUrl
   * @param {Object} [paths={}]
   * @param {string} [authHeader='Authorization']
   * @param {string} [authPrefix='Bearer ']
   * @param {Object} [extraHeaders={}]
   */
  constructor(apiKey, baseUrl, paths = {}, authHeader = 'Authorization', authPrefix = 'Bearer ', extraHeaders = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.paths = paths;
    this.authHeader = authHeader;
    this.authPrefix = authPrefix;
    this.extraHeaders = extraHeaders;
  }

  /** @private */
  _endpoint(key) {
    const p = this.paths[key] || '';
    return this.baseUrl + p;
  }

  /** @private */
  _headers() {
    return Object.assign({
      [this.authHeader]: this.authPrefix + this.apiKey,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    }, this.extraHeaders);
  }

  /** @private */
  async _post(url, body, stream = false) {
    const opts = { method: 'POST', headers: this._headers(), body: JSON.stringify(body) };
    if (stream) return fetch(url, opts);
    const res = await fetch(url, opts);
    return res.json();
  }

  /** @private */
  async _get(url) {
    const res = await fetch(url, { method: 'GET', headers: this._headers() });
    return res.json();
  }

  // ─── Chat ───
  async chat(messages, options = {}) {
    const payload = this._buildChatPayload(messages, options);
    const res = await this._post(this._endpoint('chat'), payload);
    this._normalizeToolCallsOnResponse(res);
    return res || {};
  }

  /** @private */
  _buildChatPayload(messages, options) {
    const payload = {
      model: options.model || options.deployment || 'gpt-like',
      messages,
    };
    this._applySamplingOptions(payload, options);
    this._applyResponseFormatOptions(payload, options);
    this._applyToolsOptions(payload, options);
    return payload;
  }

  /** @private */
  _applySamplingOptions(payload, options) {
    for (const k of ['temperature', 'top_p', 'max_tokens', 'frequency_penalty', 'presence_penalty', 'stop', 'seed', 'user']) {
      if (options[k] !== undefined) payload[k] = options[k];
    }
  }

  /** @private */
  _applyResponseFormatOptions(payload, options) {
    if (options.response_format === 'json') {
      const schema = (options.json_schema || {}).schema || { type: 'object' };
      payload.response_format = {
        type: 'json_schema',
        json_schema: options.json_schema || { name: 'auto_schema', schema },
      };
    }
  }

  /** @private */
  _applyToolsOptions(payload, options) {
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
  _normalizeToolCallsOnResponse(res) {
    if (!res || !res.choices?.[0]?.message?.tool_calls) return;
    res.tool_calls = res.choices[0].message.tool_calls.map(tc => ({
      id: tc.id || null,
      name: (tc.function || {}).name || null,
      arguments: (() => { try { return JSON.parse((tc.function || {}).arguments || '{}'); } catch { return {}; } })(),
    }));
  }

  // ─── Streaming ───
  async *stream(messages, options = {}) {
    const payload = { model: options.model || 'gpt-like', messages, stream: true };
    const res = await this._post(this._endpoint('chat'), payload, true);
    yield* this._readSse(res.body);
  }

  async *streamEvents(messages, options = {}) {
    const payload = { model: options.model || 'gpt-like', messages, stream: true };
    const res = await this._post(this._endpoint('chat'), payload, true);
    for await (const delta of this._readSse(res.body)) {
      yield { type: 'delta', data: delta };
    }
    yield { type: 'end', data: null };
  }

  /** @private */
  async *_readSse(body) {
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
          if (trimmed === '' || trimmed.startsWith(':') || !trimmed.startsWith('data:')) continue;
          const json = trimmed.slice(5).trim();
          if (json === '[DONE]') return;
          try {
            const decoded = JSON.parse(json);
            const delta = decoded?.choices?.[0]?.delta?.content || null;
            if (delta !== null) yield delta;
          } catch { /* skip */ }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  supportsStreaming() { return true; }

  // ─── Models ───
  async listModels() {
    const url = this.baseUrl + this._modelsPath();
    return (await this._get(url)) || {};
  }

  async getModel(id) {
    const url = this.baseUrl + this._modelsPath() + '/' + encodeURIComponent(id);
    return (await this._get(url)) || {};
  }

  /** @private */
  _modelsPath() {
    if (this.paths.models) return this.paths.models;
    if (/\/v\d+(?:$|\/)/.test(this.baseUrl)) return '/models';
    return '/v1/models';
  }

  // ─── Embeddings ───
  async embeddings(inputs, options = {}) {
    const payload = { model: options.model || 'embedding-model', input: inputs };
    const res = await this._post(this._endpoint('embeddings'), payload);
    return {
      embeddings: (res.data || []).map(d => d.embedding || []),
      usage: res.usage || {},
      raw: res,
    };
  }

  // ─── Images ───
  async generateImage(prompt, options = {}) {
    const payload = { prompt, model: options.model || 'image-model', n: 1 };
    const res = await this._post(this._endpoint('image'), payload);
    return { images: res.data || [], raw: res };
  }

  // ─── Audio ───
  async textToSpeech(text, options = {}) {
    const payload = {
      model: options.model || 'tts-model',
      input: text,
      voice: options.voice || 'alloy',
      format: options.format || 'mp3',
    };
    const res = await fetch(this._endpoint('tts'), {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify(payload),
    });
    const arrayBuf = await res.arrayBuffer();
    return { audio: Buffer.from(arrayBuf).toString('base64'), mime: 'audio/mpeg' };
  }

  async speechToText(filePath, options = {}) {
    const fs = require('fs');
    const path = require('path');
    const formData = new FormData();
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
    formData.append('file', blob, path.basename(filePath));
    formData.append('model', options.model || 'stt-model');
    formData.append('response_format', 'json');

    const headers = { [this.authHeader]: this.authPrefix + this.apiKey };
    Object.assign(headers, this.extraHeaders);
    const res = await fetch(this._endpoint('stt'), { method: 'POST', headers, body: formData });
    const data = await res.json();
    return { text: data.text || '', raw: data };
  }
}

module.exports = CustomOpenAIProvider;

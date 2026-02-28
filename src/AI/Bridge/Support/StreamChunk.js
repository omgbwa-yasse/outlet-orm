'use strict';

/**
 * StreamChunk
 * Structured DTO for streaming responses.
 */
class StreamChunk {
  /**
   * @param {string} [text='']
   * @param {Object|null} [usage=null]
   * @param {string|null} [finishReason=null]
   * @param {string} [chunkType='delta'] - 'delta' | 'end' | 'tool_call' | 'tool_result'
   * @param {Array} [toolCalls=[]]
   * @param {Array} [toolResults=[]]
   */
  constructor(text = '', usage = null, finishReason = null, chunkType = 'delta', toolCalls = [], toolResults = []) {
    this.text = text;
    this.usage = usage;
    this.finishReason = finishReason;
    this.chunkType = chunkType;
    this.toolCalls = toolCalls;
    this.toolResults = toolResults;
  }

  /**
   * Create a delta (text) chunk.
   * @param {string} text
   * @returns {StreamChunk}
   */
  static delta(text) {
    return new StreamChunk(text, null, null, 'delta');
  }

  /**
   * Create an end-of-stream chunk.
   * @param {string|null} [finishReason='stop']
   * @param {Object|null} [usage=null]
   * @returns {StreamChunk}
   */
  static end(finishReason = 'stop', usage = null) {
    return new StreamChunk('', usage, finishReason, 'end');
  }
}

module.exports = StreamChunk;

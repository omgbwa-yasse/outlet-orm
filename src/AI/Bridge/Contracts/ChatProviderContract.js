'use strict';

/**
 * ChatProviderContract
 * Base class defining the chat provider interface.
 * All chat providers must extend this and implement its methods.
 */
class ChatProviderContract {
  /**
   * Send a chat message and return raw provider response object.
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} [options={}]
   * @returns {Promise<Object>}
   */
  async chat(messages, options = {}) {
    throw new Error('Not implemented: chat()');
  }

  /**
   * Stream a chat completion (async generator yielding chunks of text or objects).
   * @param {Array<{role: string, content: string}>} messages
   * @param {Object} [options={}]
   * @yields {string|Object}
   */
  async *stream(messages, options = {}) {
    throw new Error('Not implemented: stream()');
  }

  /**
   * Whether this provider supports streaming.
   * @returns {boolean}
   */
  supportsStreaming() {
    return false;
  }
}

module.exports = ChatProviderContract;

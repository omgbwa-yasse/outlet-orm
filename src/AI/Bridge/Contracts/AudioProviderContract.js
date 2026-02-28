'use strict';

/**
 * AudioProviderContract
 * Base class for providers that support text-to-speech and speech-to-text.
 */
class AudioProviderContract {
  /**
   * Text to speech.
   * @param {string} text
   * @param {Object} [options={}]
   * @returns {Promise<{audio: string, mime: string}>} audio is base64-encoded
   */
  async textToSpeech(text, options = {}) {
    throw new Error('Not implemented: textToSpeech()');
  }

  /**
   * Speech to text.
   * @param {string} filePath
   * @param {Object} [options={}]
   * @returns {Promise<{text: string, raw?: Object}>}
   */
  async speechToText(filePath, options = {}) {
    throw new Error('Not implemented: speechToText()');
  }
}

module.exports = AudioProviderContract;

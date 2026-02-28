'use strict';

const DEFAULT_MIME = 'audio/mpeg';

/**
 * AudioNormalizer
 * Normalizes TTS and STT responses into unified shapes.
 */
class AudioNormalizer {
  /**
   * Normalize Text-to-Speech response.
   * @param {Object} raw
   * @returns {{b64: string, mime: string}}
   */
  static normalizeTTS(raw) {
    if (raw?.audio != null) {
      return { b64: raw.audio, mime: raw.mime || DEFAULT_MIME };
    }
    if (raw?.data != null) {
      return { b64: raw.data, mime: raw.mime || DEFAULT_MIME };
    }
    return { b64: '', mime: DEFAULT_MIME };
  }

  /**
   * Normalize Speech-to-Text response.
   * @param {Object} raw
   * @returns {{text: string}}
   */
  static normalizeSTT(raw) {
    if (raw?.text != null) return { text: String(raw.text) };
    if (raw?.transcript != null) return { text: String(raw.transcript) };
    return { text: '' };
  }
}

module.exports = AudioNormalizer;

'use strict';

/**
 * AI Facade
 *
 * Convenience entry-point for AI operations.
 * Provides static-like helpers that delegate to an AIManager instance.
 */

const ImageNormalizer      = require('../Support/ImageNormalizer');
const AudioNormalizer      = require('../Support/AudioNormalizer');
const EmbeddingsNormalizer = require('../Support/EmbeddingsNormalizer');

let _manager = null;

const AI = {
  /**
   * Bind an AIManager instance so all helpers delegate to it.
   * @param {import('../AIManager')} manager
   */
  setManager(manager) {
    _manager = manager;
  },

  /**
   * Return the bound manager (or null).
   * @returns {import('../AIManager')|null}
   */
  getManager() {
    return _manager;
  },

  /* ─── Normalization helpers (static, no manager needed) ────── */

  normalizeImages(raw) {
    return ImageNormalizer.normalize(raw);
  },

  normalizeTTSAudio(raw) {
    return AudioNormalizer.normalizeTTS(raw);
  },

  normalizeSTTAudio(raw) {
    return AudioNormalizer.normalizeSTT(raw);
  },

  normalizeEmbeddings(raw) {
    return EmbeddingsNormalizer.normalize(raw);
  },

  /* ─── Delegated helpers (require bound manager) ────────────── */

  /**
   * Create a new TextBuilder via the bound manager.
   * @returns {import('../Builders/TextBuilder')}
   */
  text() {
    if (!_manager) throw new Error('AI facade: no manager bound. Call AI.setManager(manager) first.');
    return _manager.text();
  },

  /**
   * Shorthand for manager.chat()
   */
  async chat(messages, opts) {
    if (!_manager) throw new Error('AI facade: no manager bound.');
    return _manager.chat(messages, opts);
  },

  /**
   * Shorthand for manager.provider()
   */
  provider(name) {
    if (!_manager) throw new Error('AI facade: no manager bound.');
    return _manager.provider(name);
  },
};

module.exports = AI;

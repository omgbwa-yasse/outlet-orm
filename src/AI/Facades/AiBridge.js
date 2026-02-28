'use strict';

/**
 * AiBridge Facade
 *
 * Convenience entry-point mirroring AiBridge\Facades\AiBridge in PHP.
 * Provides static-like helpers that delegate to an AiBridgeManager instance.
 */

const ImageNormalizer      = require('../Support/ImageNormalizer');
const AudioNormalizer      = require('../Support/AudioNormalizer');
const EmbeddingsNormalizer = require('../Support/EmbeddingsNormalizer');

let _manager = null;

const AiBridge = {
  /**
   * Bind an AiBridgeManager instance so all helpers delegate to it.
   * @param {import('../AiBridgeManager')} manager
   */
  setManager(manager) {
    _manager = manager;
  },

  /**
   * Return the bound manager (or null).
   * @returns {import('../AiBridgeManager')|null}
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
    if (!_manager) throw new Error('AiBridge facade: no manager bound. Call AiBridge.setManager(manager) first.');
    return _manager.text();
  },

  /**
   * Shorthand for manager.chat()
   */
  async chat(messages, opts) {
    if (!_manager) throw new Error('AiBridge facade: no manager bound.');
    return _manager.chat(messages, opts);
  },

  /**
   * Shorthand for manager.provider()
   */
  provider(name) {
    if (!_manager) throw new Error('AiBridge facade: no manager bound.');
    return _manager.provider(name);
  },
};

module.exports = AiBridge;

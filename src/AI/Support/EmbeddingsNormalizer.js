'use strict';

/**
 * EmbeddingsNormalizer
 * Normalizes embeddings responses into a unified shape.
 */
class EmbeddingsNormalizer {
  /**
   * @param {Object} raw
   * @returns {{vectors: number[][], usage: Object, raw: Object}}
   */
  static normalize(raw) {
    let vectors = [];
    let usage = {};

    if (Array.isArray(raw?.data)) {
      vectors = raw.data.map(d => d.embedding || []);
      usage = raw.usage || {};
    } else if (Array.isArray(raw?.embeddings)) {
      vectors = raw.embeddings;
    } else if (raw?.embedding?.values) {
      // Gemini single embedding format
      vectors = [raw.embedding.values];
    }

    return { vectors, usage, raw };
  }
}

module.exports = EmbeddingsNormalizer;

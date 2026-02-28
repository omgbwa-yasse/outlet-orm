'use strict';

const DEFAULT_MIME = 'image/png';

/**
 * ImageNormalizer
 * Normalizes heterogeneous image responses into a common array of items.
 */
class ImageNormalizer {
  /**
   * @param {Object} raw
   * @returns {Array<{type: string, url?: string, data?: string, mime?: string}>}
   */
  static normalize(raw) {
    let items = ImageNormalizer._fromOpenAI(raw);
    if (items.length > 0) return items;
    items = ImageNormalizer._fromOllama(raw);
    if (items.length > 0) return items;
    return ImageNormalizer._fromDataUrl(raw);
  }

  /** @private */
  static _fromOpenAI(raw) {
    const out = [];
    if (!Array.isArray(raw?.data)) return out;
    for (const d of raw.data) {
      if (d.url) {
        out.push({ type: 'url', url: d.url });
      } else if (d.b64_json) {
        out.push({ type: 'b64', mime: DEFAULT_MIME, data: d.b64_json });
      }
    }
    return out;
  }

  /** @private */
  static _fromOllama(raw) {
    const out = [];
    if (!Array.isArray(raw?.images)) return out;
    for (const img of raw.images) {
      const b64 = img.b64 || img;
      if (typeof b64 === 'string' && b64 !== '') {
        out.push({ type: 'b64', mime: DEFAULT_MIME, data: b64 });
      }
    }
    return out;
  }

  /** @private */
  static _fromDataUrl(raw) {
    const out = [];
    const resp = raw?.response;
    if (typeof resp !== 'string' || !resp.startsWith('data:image')) return out;
    const match = resp.match(/^data:([^;]+);base64,(.*)$/);
    if (match) {
      out.push({ type: 'b64', mime: match[1] || DEFAULT_MIME, data: match[2] || '' });
    }
    return out;
  }
}

module.exports = ImageNormalizer;

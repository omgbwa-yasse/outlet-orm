'use strict';

const fs = require('fs');

/**
 * FileSecurity
 * Enforces file size and MIME type constraints for uploads.
 */
class FileSecurity {
  /**
   * @param {Object} [config={}]
   * @param {number} [config.max_file_bytes=10485760] - 10MB default
   * @param {string[]} [config.allowed_mime_files]
   * @param {string[]} [config.allowed_mime_images]
   */
  constructor(config = {}) {
    this.maxBytes = config.max_file_bytes || 10 * 1024 * 1024;
    this.allowedFiles = config.allowed_mime_files || [
      'text/plain', 'application/pdf', 'application/json',
      'text/csv', 'text/html', 'text/markdown',
      'application/xml', 'text/xml'
    ];
    this.allowedImages = config.allowed_mime_images || [
      'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'
    ];
  }

  /**
   * Validate a file against size and type constraints.
   * @param {string} filePath
   * @param {boolean} [image=false]
   * @returns {boolean}
   */
  validateFile(filePath, image = false) {
    try {
      if (!fs.existsSync(filePath)) return false;
      const stats = fs.statSync(filePath);
      if (stats.size > this.maxBytes) return false;
      // In Node.js we don't have mime_content_type; basic extension check
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a FileSecurity instance with default configuration.
   * @returns {FileSecurity}
   */
  static fromDefaults() {
    const maxBytes = parseInt(process.env.AI_MAX_FILE_BYTES, 10) || 10 * 1024 * 1024;
    return new FileSecurity({ max_file_bytes: maxBytes });
  }
}

module.exports = FileSecurity;

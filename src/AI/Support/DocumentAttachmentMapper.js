'use strict';

const fs = require('fs');
const path = require('path');
const Document = require('./Document');
const FileSecurity = require('./FileSecurity');

const IMAGE_PREFIX = 'image/';

/**
 * DocumentAttachmentMapper
 * Converts Document attachments to provider-specific formats.
 */
class DocumentAttachmentMapper {
  /**
   * Split attachments into files, images, and inline texts for Ollama-compatible providers.
   * @param {Array} attachments
   * @returns {{files: Array, image_files: string[], inlineTexts: string[]}}
   */
  static toOllamaOptions(attachments) {
    const files = [];
    const images = [];
    const inlineTexts = [];
    const sec = FileSecurity.fromDefaults();

    for (const att of attachments) {
      if (att instanceof Document) {
        switch (att.kind) {
        case 'text':
          if (att.text != null) inlineTexts.push(att.text);
          break;
        case 'local':
          if (att.path && sec.validateFile(att.path)) {
            const mime = att.mime || 'application/octet-stream';
            const b64 = fs.readFileSync(att.path).toString('base64');
            if (mime.startsWith(IMAGE_PREFIX)) {
              images.push(b64);
            } else {
              files.push({ name: path.basename(att.path), type: mime, content: b64 });
            }
          }
          break;
        case 'base64':
          if (att.base64 && att.mime) {
            if (att.mime.startsWith(IMAGE_PREFIX)) {
              images.push(att.base64);
            } else {
              files.push({ name: att.title || 'document', type: att.mime, content: att.base64 });
            }
          }
          break;
        case 'raw':
          if (att.raw && att.mime) {
            const b64 = Buffer.from(att.raw).toString('base64');
            if (att.mime.startsWith(IMAGE_PREFIX)) {
              images.push(b64);
            } else {
              files.push({ name: att.title || 'document', type: att.mime, content: b64 });
            }
          }
          break;
        case 'chunks':
          for (const c of att.chunks) inlineTexts.push(String(c));
          break;
        case 'url':
        case 'file_id':
        default:
          break;
        }
      } else if (typeof att === 'string' && sec.validateFile(att)) {
        const b64 = fs.readFileSync(att).toString('base64');
        const mime = 'application/octet-stream';
        files.push({ name: path.basename(att), type: mime, content: b64 });
      }
    }

    return { files, image_files: images, inlineTexts };
  }

  /**
   * Extract inline text content from attachments (for OpenAI-style providers).
   * @param {Array} attachments
   * @returns {string[]}
   */
  static extractInlineTexts(attachments) {
    const inline = [];
    for (const att of attachments) {
      if (att instanceof Document) {
        if (att.kind === 'text' && att.text != null) inline.push(att.text);
        if (att.kind === 'chunks') {
          for (const c of att.chunks) inline.push(String(c));
        }
      } else if (typeof att === 'string') {
        inline.push(att);
      }
    }
    return inline;
  }
}

module.exports = DocumentAttachmentMapper;

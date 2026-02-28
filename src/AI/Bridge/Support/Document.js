'use strict';

/**
 * Document
 * Value object representing a document attachment (local file, base64, text, URL, chunks, file_id).
 */
class Document {
  constructor(kind) {
    /** @type {'local'|'base64'|'raw'|'text'|'url'|'chunks'|'file_id'} */
    this.kind = kind;
    this.path = null;
    this.mime = null;
    this.title = null;
    this.base64 = null;
    this.raw = null;
    this.text = null;
    this.url = null;
    /** @type {string[]} */
    this.chunks = [];
    this.fileId = null;
  }

  static fromLocalPath(path, title = null, mime = null) {
    const d = new Document('local');
    d.path = path;
    d.title = title;
    d.mime = mime;
    return d;
  }

  static fromBase64(base64, mime, title = null) {
    const d = new Document('base64');
    d.base64 = base64;
    d.mime = mime;
    d.title = title;
    return d;
  }

  static fromRawContent(raw, mime, title = null) {
    const d = new Document('raw');
    d.raw = raw;
    d.mime = mime;
    d.title = title;
    return d;
  }

  static fromText(text, title = null) {
    const d = new Document('text');
    d.text = text;
    d.mime = 'text/plain';
    d.title = title;
    return d;
  }

  static fromUrl(url, title = null) {
    const d = new Document('url');
    d.url = url;
    d.title = title;
    return d;
  }

  static fromChunks(chunks, title = null) {
    const d = new Document('chunks');
    d.chunks = chunks.map(String);
    d.title = title;
    return d;
  }

  static fromFileId(fileId, title = null) {
    const d = new Document('file_id');
    d.fileId = fileId;
    d.title = title;
    return d;
  }
}

module.exports = Document;

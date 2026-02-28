'use strict';

/**
 * Message
 * Value object for chat messages with optional attachments.
 */
class Message {
  /**
   * @param {string} role
   * @param {string} content
   * @param {Array} [attachments=[]]
   */
  constructor(role, content, attachments = []) {
    this.role = role;
    this.content = content;
    this.attachments = attachments;
  }

  static user(content, attachments = []) {
    return new Message('user', content, attachments);
  }

  static system(content) {
    return new Message('system', content);
  }

  static assistant(content) {
    return new Message('assistant', content);
  }

  toObject() {
    const obj = { role: this.role, content: this.content };
    if (this.attachments.length > 0) {
      obj.attachments = this.attachments;
    }
    return obj;
  }
}

module.exports = Message;

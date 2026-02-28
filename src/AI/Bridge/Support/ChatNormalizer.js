'use strict';

/**
 * ChatNormalizer
 * Normalizes heterogeneous provider responses into a common shape.
 */
class ChatNormalizer {
  /**
   * Normalize raw provider response.
   * @param {Object} raw
   * @returns {{text: string, tool_calls: Array, raw: Object}}
   */
  static normalize(raw) {
    let text = '';
    if (raw?.choices?.[0]?.message?.content != null) {
      text = String(raw.choices[0].message.content);
    } else if (raw?.message?.content != null) {
      text = String(raw.message.content);
    } else if (raw?.response != null) {
      text = String(raw.response);
    } else if (raw?.output_text != null) {
      text = String(raw.output_text);
    } else if (raw?.content?.[0]?.text != null) {
      // Claude format
      text = String(raw.content[0].text);
    } else if (raw?.candidates?.[0]?.content?.parts?.[0]?.text != null) {
      // Gemini format
      text = String(raw.candidates[0].content.parts[0].text);
    }

    let toolCalls = [];
    if (Array.isArray(raw?.choices?.[0]?.message?.tool_calls)) {
      toolCalls = raw.choices[0].message.tool_calls;
    } else if (Array.isArray(raw?.tool_calls)) {
      toolCalls = raw.tool_calls;
    }

    return { text, tool_calls: toolCalls, raw };
  }
}

module.exports = ChatNormalizer;

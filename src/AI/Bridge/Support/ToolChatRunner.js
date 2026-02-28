'use strict';

/**
 * ToolChatRunner
 * Provider-agnostic tool-calling loop.
 * Injects a system prompt listing available tools, parses model JSON responses,
 * executes tools, and iterates until model gives a normal text reply.
 */
class ToolChatRunner {
  /**
   * @param {import('../AiBridgeManager')} manager
   */
  constructor(manager) {
    this.manager = manager;
  }

  /**
   * Run a tool-aware chat loop.
   * @param {string} provider
   * @param {Array} messages
   * @param {Object} [options={}]
   * @returns {Promise<{final?: Object, tool_calls: Array, error?: string}>}
   */
  async run(provider, messages, options = {}) {
    const tools = this.manager.tools();
    if (Object.keys(tools).length === 0) {
      const final = await this.manager.chat(provider, messages, options);
      return { final, tool_calls: [] };
    }

    messages = this._injectToolInstructionIfMissing(messages, tools);

    const state = {
      tool_calls: [],
      messages: [...messages],
      iterations: 0,
      max: options.max_tool_iterations || 5,
      provider,
      options,
      final: null,
      done: false,
    };

    while (!state.done && state.iterations < state.max) {
      await this._iteration(state);
    }

    if (!state.final) {
      return { error: 'tool_iteration_limit_reached', tool_calls: state.tool_calls };
    }
    return { final: state.final, tool_calls: state.tool_calls };
  }

  /** @private */
  _injectToolInstructionIfMissing(messages, tools) {
    const instruction = this._buildToolInstruction(tools);
    for (const m of messages) {
      if (m.role === 'system' && (m.content || '').includes('Tools:')) {
        return messages;
      }
    }
    return [{ role: 'system', content: instruction }, ...messages];
  }

  /** @private */
  async _iteration(state) {
    state.iterations++;
    const response = await this.manager.chat(state.provider, state.messages, state.options);
    const assistant = this._extractAssistantContent(response);

    if (assistant === null) {
      state.final = response;
      state.done = true;
      return;
    }

    const toolCalls = this._parseToolCalls(assistant);
    if (toolCalls.length === 0) {
      state.final = response;
      state.done = true;
      return;
    }

    const executed = await this._executeToolCalls(toolCalls);
    for (const call of executed) {
      state.tool_calls.push(call);
      state.messages.push({ role: 'tool', name: call.name, content: call.result });
    }
    state.messages.push({
      role: 'user',
      content: 'If more tools are needed respond only with JSON tool_calls; otherwise respond normally.'
    });
  }

  /** @private */
  async _executeToolCalls(toolCalls) {
    const out = [];
    for (const call of toolCalls) {
      const name = call.name;
      const args = call.arguments || {};
      if (!name) continue;
      const tool = this.manager.tool(name);
      if (!tool) continue;
      let result;
      try {
        result = await tool.execute(typeof args === 'object' ? args : {});
      } catch (e) {
        result = `Tool execution error: ${e.message}`;
      }
      out.push({ name, arguments: args, result });
    }
    return out;
  }

  /** @private */
  _buildToolInstruction(tools) {
    const specs = Object.values(tools).map(t => ({
      name: t.name(),
      description: t.description(),
      schema: t.schema(),
    }));
    return `You have access to the following tools. To request tool execution, respond STRICTLY with JSON of the form {"tool_calls":[{"name":"toolName","arguments":{...}}]} without additional text. Tools: ${JSON.stringify(specs)}`;
  }

  /** @private */
  _extractAssistantContent(response) {
    if (response?.choices?.[0]?.message?.content != null) return response.choices[0].message.content;
    if (response?.message?.content != null) return response.message.content;
    if (response?.content?.[0]?.text != null) return response.content[0].text;
    if (response?.output_text != null) return response.output_text;
    return null;
  }

  /** @private */
  _parseToolCalls(content) {
    let candidate = content.trim();
    // Extract from markdown code blocks
    const codeMatch = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeMatch) candidate = codeMatch[1].trim();

    let decoded;
    try {
      decoded = JSON.parse(candidate);
    } catch {
      // Try to extract a JSON object from the content
      const objMatch = candidate.match(/\{[^{}]*\}/s);
      if (objMatch) {
        try { decoded = JSON.parse(objMatch[0]); } catch { return []; }
      }
    }

    if (decoded && typeof decoded === 'object') {
      if (Array.isArray(decoded.tool_calls)) return decoded.tool_calls;
      if (Array.isArray(decoded) && decoded[0] && 'name' in decoded[0]) return decoded;
    }
    return [];
  }
}

module.exports = ToolChatRunner;

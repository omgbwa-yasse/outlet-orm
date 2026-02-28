'use strict';

/**
 * AIQueryBuilder
 * Natural Language → SQL conversion using any AiBridge provider.
 * Introspects the database schema, sends it with the NL prompt to an LLM,
 * and returns a safe, parameterized SQL query.
 *
 * @since 8.0.0
 */
class AIQueryBuilder {
  /**
   * @param {import('./AiBridgeManager')} manager - AiBridge manager instance
   * @param {Object} connection - DatabaseConnection instance (outlet-orm)
   */
  constructor(manager, connection) {
    this._manager = manager;
    this._connection = connection;
    this._provider = 'openai';
    this._model = 'gpt-4o-mini';
    this._safeMode = true;       // Only SELECT by default
    this._maxTokens = 1024;
  }

  /**
   * Set the provider and model to use.
   * @param {string} provider
   * @param {string} model
   * @returns {this}
   */
  using(provider, model) {
    this._provider = provider;
    this._model = model;
    return this;
  }

  /**
   * Enable/disable safe mode (SELECT only).
   * @param {boolean} safe
   * @returns {this}
   */
  safeMode(safe) {
    this._safeMode = safe;
    return this;
  }

  /**
   * Convert a natural language question to SQL and execute it.
   * @param {string} question
   * @param {Object} [options={}]
   * @returns {Promise<{sql: string, params: Array, results: Array, raw_response: Object}>}
   */
  async query(question, options = {}) {
    const schema = await this._introspectSchema();
    const systemPrompt = this._buildSystemPrompt(schema);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ];

    const chatOptions = {
      model: options.model || this._model,
      max_tokens: options.max_tokens || this._maxTokens,
      temperature: options.temperature || 0.1, // Low temp for SQL accuracy
      response_format: 'json',
      json_schema: {
        name: 'sql_response',
        schema: {
          type: 'object',
          properties: {
            sql: { type: 'string' },
            params: { type: 'array', items: {} },
            explanation: { type: 'string' },
          },
          required: ['sql'],
        },
      },
    };

    const res = await this._manager.chat(this._provider, messages, chatOptions);
    const parsed = this._extractSqlFromResponse(res);

    // Safety check
    if (this._safeMode && parsed.sql) {
      const upper = parsed.sql.trim().toUpperCase();
      if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
        throw new Error(`AIQueryBuilder safe mode: only SELECT/WITH queries are allowed. Got: ${upper.slice(0, 20)}...`);
      }
    }

    // Execute the query
    let results = [];
    if (parsed.sql && this._connection) {
      try {
        results = await this._connection.raw(parsed.sql, parsed.params || []);
      } catch (err) {
        return { sql: parsed.sql, params: parsed.params || [], results: [], error: err.message, raw_response: res };
      }
    }

    return {
      sql: parsed.sql || '',
      params: parsed.params || [],
      results,
      explanation: parsed.explanation || '',
      raw_response: res,
    };
  }

  /**
   * Generate SQL without executing it.
   * @param {string} question
   * @param {Object} [options={}]
   * @returns {Promise<{sql: string, params: Array, explanation: string}>}
   */
  async toSql(question, options = {}) {
    const schema = await this._introspectSchema();
    const systemPrompt = this._buildSystemPrompt(schema);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: question },
    ];

    const chatOptions = {
      model: options.model || this._model,
      max_tokens: options.max_tokens || this._maxTokens,
      temperature: 0.1,
      response_format: 'json',
      json_schema: {
        name: 'sql_response',
        schema: {
          type: 'object',
          properties: {
            sql: { type: 'string' },
            params: { type: 'array', items: {} },
            explanation: { type: 'string' },
          },
          required: ['sql'],
        },
      },
    };

    const res = await this._manager.chat(this._provider, messages, chatOptions);
    const parsed = this._extractSqlFromResponse(res);
    return { sql: parsed.sql || '', params: parsed.params || [], explanation: parsed.explanation || '' };
  }

  /** @private */
  async _introspectSchema() {
    if (!this._connection) return 'No database connection available.';
    try {
      const dialect = this._connection.config?.client || 'mysql';
      let tables = [];
      if (dialect === 'pg' || dialect === 'postgresql') {
        const res = await this._connection.raw(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'"
        );
        tables = (res.rows || res).map(r => r.table_name);
      } else if (dialect === 'sqlite' || dialect === 'sqlite3') {
        const res = await this._connection.raw(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
        tables = (Array.isArray(res) ? res : (res.rows || [])).map(r => r.name);
      } else {
        // MySQL
        const res = await this._connection.raw('SHOW TABLES');
        tables = (Array.isArray(res) ? res[0] || res : res).map(r => Object.values(r)[0]);
      }

      const schemaInfo = {};
      for (const table of tables) {
        try {
          let cols;
          if (dialect === 'pg' || dialect === 'postgresql') {
            const cRes = await this._connection.raw(
              `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '${table}'`
            );
            cols = (cRes.rows || cRes).map(c => `${c.column_name} ${c.data_type}${c.is_nullable === 'YES' ? ' NULL' : ''}`);
          } else if (dialect === 'sqlite' || dialect === 'sqlite3') {
            const cRes = await this._connection.raw(`PRAGMA table_info("${table}")`);
            cols = (Array.isArray(cRes) ? cRes : []).map(c => `${c.name} ${c.type}${c.notnull ? '' : ' NULL'}`);
          } else {
            const cRes = await this._connection.raw(`DESCRIBE \`${table}\``);
            cols = (Array.isArray(cRes) ? cRes[0] || cRes : cRes).map(c => `${c.Field} ${c.Type}${c.Null === 'YES' ? ' NULL' : ''}`);
          }
          schemaInfo[table] = cols;
        } catch { schemaInfo[table] = ['(unable to read columns)']; }
      }

      return Object.entries(schemaInfo)
        .map(([t, cols]) => `TABLE ${t}:\n  ${cols.join('\n  ')}`)
        .join('\n\n');
    } catch (err) {
      return `Schema introspection error: ${err.message}`;
    }
  }

  /** @private */
  _buildSystemPrompt(schema) {
    let prompt = `You are a SQL assistant. Given a natural language question and a database schema, generate a single SQL query that answers the question.

DATABASE SCHEMA:
${schema}

RULES:
- Return ONLY a JSON object with keys: "sql" (the query), "params" (array of parameterized values, can be empty), "explanation" (brief explanation).
- Use parameterized queries (? placeholders) when appropriate for safety.
- Do NOT use DROP, TRUNCATE, or ALTER statements.`;

    if (this._safeMode) {
      prompt += '\n- ONLY generate SELECT or WITH (CTE) queries. No INSERT, UPDATE, DELETE.';
    }

    return prompt;
  }

  /** @private */
  _extractSqlFromResponse(res) {
    // Try various response formats
    let content = res?.output_text || res?.choices?.[0]?.message?.content || res?.content?.[0]?.text || res?.message?.content || '';
    if (typeof content !== 'string') content = JSON.stringify(content);

    try {
      const parsed = JSON.parse(content);
      return { sql: parsed.sql || '', params: parsed.params || [], explanation: parsed.explanation || '' };
    } catch {
      // Try to extract SQL from plain text
      const sqlMatch = content.match(/```sql\s*([\s\S]*?)```/i) || content.match(/SELECT[\s\S]+?;/i);
      return { sql: sqlMatch ? (sqlMatch[1] || sqlMatch[0]).trim() : content.trim(), params: [], explanation: '' };
    }
  }
}

module.exports = AIQueryBuilder;

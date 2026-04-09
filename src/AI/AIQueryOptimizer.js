'use strict';

/**
 * AIQueryOptimizer
 * Uses LLM to analyze and optimize SQL queries.
 * Sends the query + schema to an AI provider and returns optimization suggestions.
 *
 * @since 8.0.0
 */
class AIQueryOptimizer {
  /**
   * @param {import('./AIManager')} manager
   * @param {Object} [connection] - DatabaseConnection instance (optional, for schema introspection)
   */
  constructor(manager, connection = null) {
    this._manager = manager;
    this._connection = connection;
    this._provider = 'openai';
    this._model = 'gpt-4o-mini';
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
   * Analyze a SQL query and return optimization suggestions.
   * @param {string} sql - The SQL query to optimize
   * @param {Object} [options={}]
   * @returns {Promise<{original: string, optimized: string, suggestions: Array, explanation: string}>}
   */
  async optimize(sql, options = {}) {
    const schema = options.schema || await this._introspectSchema();
    const dialect = options.dialect || this._connection?.config?.client || 'mysql';

    const systemPrompt = `You are a senior database performance engineer. Analyze SQL queries and provide optimizations.

DATABASE DIALECT: ${dialect}
${schema ? `\nDATABASE SCHEMA:\n${schema}` : ''}

RULES:
- Return a JSON object with keys:
  "optimized" (the optimized SQL query),
  "suggestions" (array of optimization suggestions, each with "type", "description", "impact"),
  "explanation" (brief overall explanation),
  "indexes" (array of recommended CREATE INDEX statements, if any).
- Preserve query semantics — the optimized query must return the same results.
- Consider: indexes, query rewriting, subquery elimination, JOIN optimization, proper use of LIMIT/OFFSET.
- Rate impact as "high", "medium", or "low".`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Optimize this SQL query:\n\n${sql}` },
    ];

    const res = await this._manager.chat(this._provider, messages, {
      model: options.model || this._model,
      temperature: 0.2,
      max_tokens: 2048,
      response_format: 'json',
      json_schema: {
        name: 'optimization_result',
        schema: {
          type: 'object',
          properties: {
            optimized: { type: 'string' },
            suggestions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  description: { type: 'string' },
                  impact: { type: 'string' },
                },
              },
            },
            explanation: { type: 'string' },
            indexes: { type: 'array', items: { type: 'string' } },
          },
          required: ['optimized', 'suggestions'],
        },
      },
    });

    const parsed = this._extractResult(res);
    return {
      original: sql,
      optimized: parsed.optimized || sql,
      suggestions: parsed.suggestions || [],
      explanation: parsed.explanation || '',
      indexes: parsed.indexes || [],
      raw_response: res,
    };
  }

  /**
   * Analyze query execution plan using EXPLAIN.
   * @param {string} sql
   * @returns {Promise<{plan: Array, analysis: string}>}
   */
  async explain(sql) {
    if (!this._connection) throw new Error('Database connection required for EXPLAIN.');
    const dialect = this._connection.config?.client || 'mysql';

    let plan;
    if (dialect === 'pg' || dialect === 'postgresql') {
      plan = await this._connection.raw(`EXPLAIN (FORMAT JSON) ${sql}`);
    } else if (dialect === 'sqlite' || dialect === 'sqlite3') {
      plan = await this._connection.raw(`EXPLAIN QUERY PLAN ${sql}`);
    } else {
      plan = await this._connection.raw(`EXPLAIN ${sql}`);
    }

    // Ask LLM to analyze the execution plan
    const messages = [
      { role: 'system', content: 'You are a database performance expert. Analyze this EXPLAIN plan and provide actionable insights.' },
      { role: 'user', content: `EXPLAIN output for query "${sql}":\n\n${JSON.stringify(plan, null, 2)}` },
    ];

    const res = await this._manager.chat(this._provider, messages, {
      model: this._model,
      temperature: 0.2,
      max_tokens: 1024,
    });

    const analysis = res?.output_text || res?.choices?.[0]?.message?.content || res?.content?.[0]?.text || '';
    return { plan: Array.isArray(plan) ? plan : [plan], analysis };
  }

  /** @private */
  async _introspectSchema() {
    if (!this._connection) return '';
    try {
      const dialect = this._connection.config?.client || 'mysql';
      let tables = [];
      if (dialect === 'pg' || dialect === 'postgresql') {
        const res = await this._connection.raw('SELECT table_name FROM information_schema.tables WHERE table_schema = \'public\'');
        tables = (res.rows || res).map(r => r.table_name);
      } else if (dialect === 'sqlite' || dialect === 'sqlite3') {
        const res = await this._connection.raw('SELECT name FROM sqlite_master WHERE type=\'table\' AND name NOT LIKE \'sqlite_%\'');
        tables = (Array.isArray(res) ? res : []).map(r => r.name);
      } else {
        const res = await this._connection.raw('SHOW TABLES');
        tables = (Array.isArray(res) ? res[0] || res : res).map(r => Object.values(r)[0]);
      }

      const parts = [];
      for (const table of tables.slice(0, 30)) { // Limit to 30 tables
        try {
          let cols;
          if (dialect === 'pg' || dialect === 'postgresql') {
            const cRes = await this._connection.raw(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}'`);
            cols = (cRes.rows || cRes).map(c => `${c.column_name} ${c.data_type}`);
          } else if (dialect === 'sqlite' || dialect === 'sqlite3') {
            const cRes = await this._connection.raw(`PRAGMA table_info("${table}")`);
            cols = (Array.isArray(cRes) ? cRes : []).map(c => `${c.name} ${c.type}`);
          } else {
            const cRes = await this._connection.raw(`DESCRIBE \`${table}\``);
            cols = (Array.isArray(cRes) ? cRes[0] || cRes : cRes).map(c => `${c.Field} ${c.Type}`);
          }
          parts.push(`TABLE ${table}: ${cols.join(', ')}`);
        } catch { /* skip */ }
      }
      return parts.join('\n');
    } catch { return ''; }
  }

  /** @private */
  _extractResult(res) {
    let content = res?.output_text || res?.choices?.[0]?.message?.content || res?.content?.[0]?.text || res?.message?.content || '';
    if (typeof content !== 'string') content = JSON.stringify(content);
    try { return JSON.parse(content); } catch { return {}; }
  }
}

module.exports = AIQueryOptimizer;

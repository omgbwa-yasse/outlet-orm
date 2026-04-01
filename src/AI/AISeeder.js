'use strict';

/**
 * AISeeder
 * AI-powered data seeding that uses LLM to generate realistic, contextual seed data.
 * Instead of hard-coded Faker data, asks the LLM to produce domain-specific records.
 *
 * @since 8.0.0
 */
class AISeeder {
  /**
   * @param {import('./AIManager')} manager
   * @param {Object} connection - DatabaseConnection instance
   */
  constructor(manager, connection) {
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
   * Generate and insert seed data for a table.
   * @param {string} table - Table name
   * @param {number} [count=10] - Number of records to generate
   * @param {Object} [context={}] - Additional context (e.g., domain, constraints)
   * @returns {Promise<{records: Array, inserted: number}>}
   */
  async seed(table, count = 10, context = {}) {
    const schema = await this._getTableSchema(table);
    const systemPrompt = this._buildSystemPrompt(table, schema, count, context);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate ${count} realistic seed records for the "${table}" table.${context.description ? ' Context: ' + context.description : ''}` },
    ];

    const res = await this._manager.chat(this._provider, messages, {
      model: this._model,
      temperature: 0.8, // Higher temp for creative data
      max_tokens: 4096,
      response_format: 'json',
      json_schema: {
        name: 'seed_data',
        schema: {
          type: 'object',
          properties: {
            records: {
              type: 'array',
              items: { type: 'object' },
            },
          },
          required: ['records'],
        },
      },
    });

    const records = this._extractRecords(res);

    // Insert records
    let inserted = 0;
    if (records.length > 0 && this._connection) {
      for (const record of records) {
        try {
          const columns = Object.keys(record);
          const values = Object.values(record);
          const placeholders = columns.map(() => '?').join(', ');
          const sql = `INSERT INTO \`${table}\` (${columns.map(c => `\`${c}\``).join(', ')}) VALUES (${placeholders})`;
          await this._connection.raw(sql, values);
          inserted++;
        } catch (err) {
          // Skip records that fail (FK violations, etc.)
          continue;
        }
      }
    }

    return { records, inserted };
  }

  /**
   * Generate seed records without inserting them.
   * @param {string} table
   * @param {number} [count=10]
   * @param {Object} [context={}]
   * @returns {Promise<Array>}
   */
  async generate(table, count = 10, context = {}) {
    const schema = await this._getTableSchema(table);
    const systemPrompt = this._buildSystemPrompt(table, schema, count, context);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate ${count} realistic seed records for the "${table}" table.${context.description ? ' Context: ' + context.description : ''}` },
    ];

    const res = await this._manager.chat(this._provider, messages, {
      model: this._model,
      temperature: 0.8,
      max_tokens: 4096,
      response_format: 'json',
      json_schema: {
        name: 'seed_data',
        schema: {
          type: 'object',
          properties: {
            records: { type: 'array', items: { type: 'object' } },
          },
          required: ['records'],
        },
      },
    });

    return this._extractRecords(res);
  }

  /** @private */
  async _getTableSchema(table) {
    if (!this._connection) return '(no connection)';
    try {
      const dialect = this._connection.config?.client || 'mysql';
      if (dialect === 'pg' || dialect === 'postgresql') {
        const res = await this._connection.raw(
          `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`
        );
        return (res.rows || res).map(c => `${c.column_name} ${c.data_type}${c.is_nullable === 'YES' ? ' NULL' : ' NOT NULL'}${c.column_default ? ' DEFAULT ' + c.column_default : ''}`).join('\n');
      } else if (dialect === 'sqlite' || dialect === 'sqlite3') {
        const res = await this._connection.raw(`PRAGMA table_info("${table}")`);
        return (Array.isArray(res) ? res : []).map(c => `${c.name} ${c.type}${c.notnull ? ' NOT NULL' : ' NULL'}${c.dflt_value ? ' DEFAULT ' + c.dflt_value : ''}`).join('\n');
      } else {
        const res = await this._connection.raw(`DESCRIBE \`${table}\``);
        return (Array.isArray(res) ? res[0] || res : res).map(c => `${c.Field} ${c.Type}${c.Null === 'YES' ? ' NULL' : ' NOT NULL'}${c.Default ? ' DEFAULT ' + c.Default : ''}${c.Extra ? ' ' + c.Extra : ''}`).join('\n');
      }
    } catch (err) {
      return `(error: ${err.message})`;
    }
  }

  /** @private */
  _buildSystemPrompt(table, schema, count, context) {
    return `You are a database seed data generator. Generate realistic, diverse, and contextually appropriate test data.

TABLE: ${table}
SCHEMA:
${schema}

RULES:
- Return a JSON object with a "records" key containing an array of ${count} objects.
- Each object should have keys matching the column names (exclude auto-increment id columns).
- Use realistic names, emails, dates, etc. — not lorem ipsum.
- Respect data types and constraints (NOT NULL, defaults).
- Foreign key values should use integers 1-${Math.max(5, count)}.
- Dates should be in ISO format (YYYY-MM-DD or YYYY-MM-DD HH:MM:SS).
${context.locale ? `- Use locale: ${context.locale}` : ''}
${context.domain ? `- Domain context: ${context.domain}` : ''}`;
  }

  /** @private */
  _extractRecords(res) {
    let content = res?.output_text || res?.choices?.[0]?.message?.content || res?.content?.[0]?.text || res?.message?.content || '';
    if (typeof content !== 'string') content = JSON.stringify(content);
    try {
      const parsed = JSON.parse(content);
      return Array.isArray(parsed.records) ? parsed.records : (Array.isArray(parsed) ? parsed : []);
    } catch {
      return [];
    }
  }
}

module.exports = AISeeder;

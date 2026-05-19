'use strict';

/**
 * AIPromptEnhancer
 * LLM-powered enhancement of the existing regex-based PromptGenerator.
 * Takes a natural language description and uses AI to generate richer schemas,
 * model code, migrations, and seeders — beyond what pattern matching can do.
 *
 * @since 8.0.0
 */
class AIPromptEnhancer {
  /**
   * @param {import('./AIManager')} manager
   */
  constructor(manager) {
    this._manager = manager;
    this._provider = 'openai';
    this._model = 'gpt-4o-mini';
  }

  /**
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
   * Generate a full project schema from a natural language description.
   * Returns tables, columns, relations, and seed hints.
   * @param {string} description - e.g., "A recipe sharing app with users, recipes, ingredients, and reviews"
   * @param {Object} [options={}]
   * @returns {Promise<{tables: Object, relations: Array, seedHints: Object}>}
   */
  async generateSchema(description, options = {}) {
    const systemPrompt = `You are an expert database architect. Given an application description, design a complete relational database schema.

RULES:
- Return a JSON object with:
  "tables" — object where each key is a table name, value is an object with "columns" (array of "name:type:modifiers" strings, using outlet-orm format like "name:string", "email:string:unique", "user_id:foreignId", "content:text:nullable", "price:decimal(10,2)", "status:string:default(active)").
  "relations" — array of objects with "type" (hasOne, hasMany, belongsTo, belongsToMany), "from", "to", and optionally "pivot" table name.
  "seedHints" — object where each key is a table name, value is a short description of the kind of seed data to generate.
- Always include id, created_at, updated_at columns implicitly (don't list them).
- Use snake_case for column/table names.
- Include foreign keys where appropriate.
- Design for at least 3rd normal form.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Design a database schema for: ${description}` },
    ];

    const res = await this._manager.chat(this._provider, messages, {
      model: options.model || this._model,
      temperature: 0.5,
      max_tokens: 4096,
      response_format: 'json',
      json_schema: {
        name: 'schema_design',
        schema: {
          type: 'object',
          properties: {
            tables: { type: 'object' },
            relations: { type: 'array', items: { type: 'object' } },
            seedHints: { type: 'object' },
          },
          required: ['tables'],
        },
      },
    });

    return this._extractJson(res);
  }

  /**
   * Generate model source code for a given table schema.
   * @param {string} tableName
   * @param {Object} tableSchema - { columns: [...] }
   * @param {Array} [relations=[]]
   * @returns {Promise<string>}
   */
  async generateModelCode(tableName, tableSchema, relations = []) {
    const systemPrompt = `You are an expert in outlet-orm (a Node.js Active Record ORM).
Generate a complete model class for the given table. Use CommonJS (module.exports).

Example format:
const { Model } = require('outlet-orm');
class User extends Model {
  static tableName = 'users';
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password'];
  static casts = { created_at: 'datetime' };
  posts() { return this.hasMany('Post', 'user_id'); }
}
module.exports = User;

Include fillable, hidden (for sensitive fields), casts, and relation methods.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Generate an outlet-orm model for table "${tableName}":\nColumns: ${JSON.stringify(tableSchema.columns || [])}\nRelations: ${JSON.stringify(relations)}`,
      },
    ];

    const res = await this._manager.chat(this._provider, messages, {
      model: this._model,
      temperature: 0.3,
      max_tokens: 2048,
    });

    return res?.output_text || res?.choices?.[0]?.message?.content || res?.content?.[0]?.text || '';
  }

  /**
   * Generate migration code for a given table schema.
   * @param {string} tableName
   * @param {Object} tableSchema
   * @returns {Promise<string>}
   */
  async generateMigrationCode(tableName, tableSchema) {
    const systemPrompt = `You are an expert in outlet-orm migrations. Generate a migration file.

Example format:
const { Migration, Schema } = require('outlet-orm');
class CreateUsersTable extends Migration {
  async up(schema) {
    await schema.create('users', (table) => {
      table.increments('id');
      table.string('name');
      table.string('email').unique();
      table.timestamps();
    });
  }
  async down(schema) {
    await schema.dropIfExists('users');
  }
}
module.exports = CreateUsersTable;

Use proper column types: string, text, integer, bigInteger, decimal, boolean, date, datetime, timestamp, json, foreignId.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Generate a migration for table "${tableName}":\nColumns: ${JSON.stringify(tableSchema.columns || [])}` },
    ];

    const res = await this._manager.chat(this._provider, messages, {
      model: this._model,
      temperature: 0.2,
      max_tokens: 2048,
    });

    return res?.output_text || res?.choices?.[0]?.message?.content || res?.content?.[0]?.text || '';
  }

  /** @private */
  _extractJson(res) {
    let content = res?.output_text || res?.choices?.[0]?.message?.content || res?.content?.[0]?.text || res?.message?.content || '';
    if (typeof content !== 'string') content = JSON.stringify(content);
    try { return JSON.parse(content); } catch { return { tables: {}, relations: [], seedHints: {} }; }
  }
}

module.exports = AIPromptEnhancer;

/**
 * Outlet ORM — Prompt-based Model Generator
 * Parses natural language descriptions and generates models + migrations.
 *
 * Used by `outlet-init --prompt "..."` to bootstrap projects from descriptions.
 *
 * @since 7.0.0
 */

const fs = require('fs');
const path = require('path');

// ─── Domain pattern recognition ──────────────────────────────────

const DOMAIN_PATTERNS = {
  // E-commerce
  'e-?commerce|shop|store|product|cart|order|payment|checkout': {
    tables: {
      users:      { columns: ['name:string', 'email:string:unique', 'password:string', 'role:string:default(customer)'] },
      products:   { columns: ['name:string', 'description:text:nullable', 'price:decimal(10,2)', 'stock:integer:default(0)', 'sku:string:unique', 'category_id:foreignId'] },
      categories: { columns: ['name:string', 'slug:string:unique', 'parent_id:integer:nullable'] },
      orders:     { columns: ['user_id:foreignId', 'status:string:default(pending)', 'total:decimal(10,2)', 'shipping_address:text'] },
      order_items:{ columns: ['order_id:foreignId', 'product_id:foreignId', 'quantity:integer', 'price:decimal(10,2)'] },
      payments:   { columns: ['order_id:foreignId', 'method:string', 'amount:decimal(10,2)', 'status:string:default(pending)', 'transaction_id:string:nullable'] }
    }
  },

  // Blog / CMS
  'blog|article|post|cms|content|comment|tag': {
    tables: {
      users:      { columns: ['name:string', 'email:string:unique', 'password:string', 'bio:text:nullable', 'avatar:string:nullable'] },
      posts:      { columns: ['user_id:foreignId', 'title:string', 'slug:string:unique', 'content:text', 'excerpt:text:nullable', 'status:string:default(draft)', 'published_at:timestamp:nullable'] },
      categories: { columns: ['name:string', 'slug:string:unique', 'description:text:nullable'] },
      tags:       { columns: ['name:string', 'slug:string:unique'] },
      post_tag:   { columns: ['post_id:foreignId', 'tag_id:foreignId'], pivot: true },
      comments:   { columns: ['post_id:foreignId', 'user_id:foreignId:nullable', 'author_name:string:nullable', 'body:text', 'approved:boolean:default(false)'] }
    }
  },

  // Task / Project management
  'task|project|todo|kanban|board|sprint|ticket': {
    tables: {
      users:    { columns: ['name:string', 'email:string:unique', 'password:string', 'avatar:string:nullable'] },
      projects: { columns: ['name:string', 'description:text:nullable', 'owner_id:foreignId', 'status:string:default(active)'] },
      tasks:    { columns: ['project_id:foreignId', 'assigned_to:integer:nullable', 'title:string', 'description:text:nullable', 'status:string:default(todo)', 'priority:string:default(medium)', 'due_date:date:nullable'] },
      labels:   { columns: ['name:string', 'color:string:default(#3498db)'] },
      task_label: { columns: ['task_id:foreignId', 'label_id:foreignId'], pivot: true }
    }
  },

  // Social network
  'social|friend|follow|like|feed|profile|message|chat': {
    tables: {
      users:    { columns: ['name:string', 'email:string:unique', 'password:string', 'username:string:unique', 'bio:text:nullable', 'avatar:string:nullable'] },
      posts:    { columns: ['user_id:foreignId', 'content:text', 'media_url:string:nullable', 'visibility:string:default(public)'] },
      comments: { columns: ['post_id:foreignId', 'user_id:foreignId', 'body:text'] },
      likes:    { columns: ['user_id:foreignId', 'likeable_id:integer', 'likeable_type:string'] },
      follows:  { columns: ['follower_id:foreignId', 'following_id:foreignId'] },
      messages: { columns: ['sender_id:foreignId', 'receiver_id:foreignId', 'body:text', 'read_at:timestamp:nullable'] }
    }
  },

  // SaaS / Multi-tenant
  'saas|tenant|subscription|plan|billing|organization': {
    tables: {
      organizations: { columns: ['name:string', 'slug:string:unique', 'plan_id:foreignId:nullable'] },
      users:         { columns: ['organization_id:foreignId', 'name:string', 'email:string:unique', 'password:string', 'role:string:default(member)'] },
      plans:         { columns: ['name:string', 'slug:string:unique', 'price:decimal(8,2)', 'features:json:nullable', 'max_users:integer:default(5)'] },
      subscriptions: { columns: ['organization_id:foreignId', 'plan_id:foreignId', 'status:string:default(active)', 'starts_at:timestamp', 'ends_at:timestamp:nullable', 'trial_ends_at:timestamp:nullable'] },
      invoices:      { columns: ['subscription_id:foreignId', 'amount:decimal(10,2)', 'status:string:default(pending)', 'paid_at:timestamp:nullable'] }
    }
  },

  // Habit tracker / Health
  'habit|tracker|health|fitness|goal|streak|log': {
    tables: {
      users:  { columns: ['name:string', 'email:string:unique', 'password:string', 'timezone:string:default(UTC)'] },
      habits: { columns: ['user_id:foreignId', 'name:string', 'description:text:nullable', 'frequency:string:default(daily)', 'color:string:default(#3498db)', 'target:integer:default(1)'] },
      logs:   { columns: ['habit_id:foreignId', 'date:date', 'completed:boolean:default(false)', 'value:integer:default(0)', 'notes:text:nullable'] },
      goals:  { columns: ['user_id:foreignId', 'title:string', 'target_value:integer', 'current_value:integer:default(0)', 'deadline:date:nullable'] }
    }
  },

  // API / Auth / Generic
  'api|auth|rest|user': {
    tables: {
      users:          { columns: ['name:string', 'email:string:unique', 'password:string', 'role:string:default(user)', 'email_verified_at:timestamp:nullable'] },
      tokens:         { columns: ['user_id:foreignId', 'token:string:unique', 'type:string:default(api)', 'expires_at:timestamp:nullable'] },
      password_resets:{ columns: ['email:string', 'token:string', 'created_at:timestamp'] }
    }
  }
};

// ─── Generator ──────────────────────────────────────────────────

class PromptGenerator {
  /**
   * Parse a natural language prompt and return a project blueprint.
   * @param {string} prompt - e.g. "Create a blog application with comments and tags"
   * @returns {{ domain: string, tables: object }}
   */
  static parse(prompt) {
    const lower = prompt.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const [pattern, blueprint] of Object.entries(DOMAIN_PATTERNS)) {
      const regex = new RegExp(pattern, 'i');
      const keywords = pattern.split('|').map(k => k.replace(/[^a-z]/g, ''));
      let score = 0;

      for (const kw of keywords) {
        if (lower.includes(kw)) score++;
      }
      if (regex.test(lower)) score += 2;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { pattern, blueprint, score };
      }
    }

    // Default to generic API/Auth if no match
    if (!bestMatch || bestScore < 1) {
      bestMatch = { pattern: 'api|auth', blueprint: DOMAIN_PATTERNS['api|auth|rest|user'], score: 0 };
    }

    return {
      domain: bestMatch.pattern.split('|')[0],
      tables: bestMatch.blueprint.tables,
      score: bestMatch.score
    };
  }

  /**
   * Generate model files from a blueprint.
   * @param {{ tables: object }} blueprint
   * @param {string} outputDir - e.g. process.cwd() + '/models'
   * @returns {string[]} created file paths
   */
  static generateModels(blueprint, outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    const created = [];

    for (const [tableName, config] of Object.entries(blueprint.tables)) {
      if (config.pivot) continue; // Skip pivot tables for model files

      const className = this._toClassName(tableName);
      const fillable = config.columns
        .map(c => c.split(':')[0])
        .filter(c => !['id', 'created_at', 'updated_at'].includes(c));

      const hidden = fillable.filter(c => c === 'password' || c.includes('token') || c.includes('secret'));

      const content = `const { Model } = require('outlet-orm');

class ${className} extends Model {
  static table = '${tableName}';
  static fillable = ${JSON.stringify(fillable)};${hidden.length > 0 ? `\n  static hidden = ${JSON.stringify(hidden)};` : ''}
}

module.exports = ${className};
`;

      const filePath = path.join(outputDir, `${className}.js`);
      fs.writeFileSync(filePath, content);
      created.push(filePath);
    }

    return created;
  }

  /**
   * Generate migration files from a blueprint.
   * @param {{ tables: object }} blueprint
   * @param {string} outputDir - e.g. process.cwd() + '/database/migrations'
   * @returns {string[]} created file paths
   */
  static generateMigrations(blueprint, outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    const created = [];
    let index = 0;

    for (const [tableName, config] of Object.entries(blueprint.tables)) {
      index++;
      const timestamp = new Date(Date.now() + index * 1000)
        .toISOString()
        .replace(/[-:]/g, '')
        .replace(/T/, '_')
        .replace(/\..+/, '');

      const className = `Create${this._toClassName(tableName)}Table`;
      const fileName = `${timestamp}_create_${tableName}_table.js`;
      const filePath = path.join(outputDir, fileName);

      const columnDefs = config.columns.map(c => this._columnToSchema(c)).join('\n      ');

      const content = `const { Migration } = require('outlet-orm');

class ${className} extends Migration {
  async up() {
    const schema = this.getSchema();
    await schema.create('${tableName}', (table) => {
      table.id();
      ${columnDefs}
      table.timestamps();
    });
  }

  async down() {
    const schema = this.getSchema();
    await schema.dropIfExists('${tableName}');
  }
}

module.exports = ${className};
`;

      fs.writeFileSync(filePath, content);
      created.push(filePath);
    }

    return created;
  }

  /**
   * Generate a seed file from a blueprint.
   * @param {{ tables: object }} blueprint
   * @param {string} outputDir
   * @returns {string}
   */
  static generateSeeder(blueprint, outputDir) {
    fs.mkdirSync(outputDir, { recursive: true });
    const tables = Object.keys(blueprint.tables);

    const seedCalls = tables
      .filter(t => !blueprint.tables[t].pivot)
      .map(t => `    // await this.call('${this._toClassName(t)}Seeder');`)
      .join('\n');

    const content = `const { Seeder } = require('outlet-orm');

class DatabaseSeeder extends Seeder {
  async run() {
${seedCalls}
  }
}

module.exports = DatabaseSeeder;
`;

    const filePath = path.join(outputDir, 'DatabaseSeeder.js');
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  // ─── Helpers ───────────────────────────────────────────────────

  static _toClassName(tableName) {
    // users -> User, order_items -> OrderItem
    return tableName
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
      .replace(/s$/, ''); // naive singularize (plural -> singular)
  }

  static _columnToSchema(columnDef) {
    // Format: name:type:modifier1:modifier2
    // e.g. "email:string:unique", "price:decimal(10,2)", "status:string:default(pending)"
    const parts = columnDef.split(':');
    const name = parts[0];
    const type = parts[1] || 'string';
    const modifiers = parts.slice(2);

    // Parse type and arguments
    const typeMatch = type.match(/^(\w+)(?:\((.+)\))?$/);
    const typeName = typeMatch ? typeMatch[1] : type;
    const typeArgs = typeMatch && typeMatch[2] ? `, ${typeMatch[2]}` : '';

    // Map to schema builder methods
    const typeMap = {
      string: 'string',
      text: 'text',
      integer: 'integer',
      int: 'integer',
      boolean: 'boolean',
      bool: 'boolean',
      decimal: 'decimal',
      float: 'float',
      date: 'date',
      timestamp: 'timestamp',
      json: 'json',
      foreignId: 'integer'
    };

    const schemaType = typeMap[typeName] || 'string';
    let line = `table.${schemaType}('${name}'${typeArgs})`;

    // Apply modifiers
    for (const mod of modifiers) {
      if (mod === 'unique') line += '.unique()';
      else if (mod === 'nullable') line += '.nullable()';
      else if (mod.startsWith('default(')) {
        const val = mod.match(/default\((.+)\)/)?.[1] || '';
        // Smart quoting: don't quote numbers or booleans
        const isNum = !isNaN(val);
        const isBool = val === 'true' || val === 'false';
        const quoted = isNum || isBool ? val : `'${val}'`;
        line += `.default(${quoted})`;
      }
    }

    return line + ';';
  }
}

module.exports = PromptGenerator;

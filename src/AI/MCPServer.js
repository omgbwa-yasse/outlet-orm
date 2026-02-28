/**
 * Outlet ORM — MCP Server (Model Context Protocol)
 * Exposes ORM capabilities to AI agents via JSON-RPC 2.0 over stdio.
 *
 * Protocol: MCP (https://modelcontextprotocol.io)
 * Transport: stdio (newline-delimited JSON-RPC)
 *
 * @since 7.0.0
 */

const { EventEmitter } = require('events');
const path = require('path');
const fs = require('fs');

// ─── Tool Definitions ────────────────────────────────────────────

const TOOL_DEFINITIONS = [
  {
    name: 'migrate_status',
    description: 'Show migration status — lists pending and executed migrations.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'migrate_run',
    description: 'Run all pending migrations to bring the database schema up to date.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'migrate_rollback',
    description: 'Rollback the last batch of migrations.',
    inputSchema: {
      type: 'object',
      properties: { steps: { type: 'number', description: 'Number of batches to rollback (default 1)' } },
      required: []
    }
  },
  {
    name: 'migrate_reset',
    description: 'Rollback ALL migrations. ⚠️ DESTRUCTIVE — requires AI safety consent.',
    inputSchema: {
      type: 'object',
      properties: { consent: { type: 'string', description: 'User consent text for destructive action' } },
      required: ['consent']
    }
  },
  {
    name: 'migrate_make',
    description: 'Create a new migration file.',
    inputSchema: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Migration name, e.g. "create_users_table"' } },
      required: ['name']
    }
  },
  {
    name: 'seed_run',
    description: 'Run database seeders.',
    inputSchema: {
      type: 'object',
      properties: { class: { type: 'string', description: 'Specific seeder class name (optional)' } },
      required: []
    }
  },
  {
    name: 'schema_introspect',
    description: 'Introspect database schema — returns all tables and their columns.',
    inputSchema: {
      type: 'object',
      properties: { table: { type: 'string', description: 'Specific table to introspect (optional — omit for all tables)' } },
      required: []
    }
  },
  {
    name: 'query_execute',
    description: 'Execute a raw SQL query on the database. ⚠️ Write queries require AI safety consent.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'The SQL query to execute' },
        params: { type: 'array', description: 'Parameterised values (optional)', items: {} },
        consent: { type: 'string', description: 'User consent text (required for write queries)' }
      },
      required: ['sql']
    }
  },
  {
    name: 'model_list',
    description: 'List all Model files discovered in the project models/ directory.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'backup_create',
    description: 'Create a database backup.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['full', 'partial', 'journal'], description: 'Backup type (default: full)' },
        tables: { type: 'array', items: { type: 'string' }, description: 'Tables for partial backup (optional)' },
        format: { type: 'string', enum: ['sql', 'json'], description: 'Output format (default: sql)' }
      },
      required: []
    }
  },
  {
    name: 'backup_restore',
    description: 'Restore a database from a backup file. ⚠️ DESTRUCTIVE — requires AI safety consent.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Path to the backup file' },
        consent: { type: 'string', description: 'User consent text for destructive action' }
      },
      required: ['filePath', 'consent']
    }
  },
  {
    name: 'ai_query',
    description: 'Convert a natural language question into SQL and execute it. Requires an AI provider (AiBridge).',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'Natural language question, e.g. "Show me the top 5 users by order count"' },
        provider: { type: 'string', description: 'AI provider to use (default: openai)' },
        model: { type: 'string', description: 'AI model to use (default: gpt-4o-mini)' },
        safe_mode: { type: 'boolean', description: 'Only allow SELECT queries (default: true)' }
      },
      required: ['question']
    }
  },
  {
    name: 'query_optimize',
    description: 'Analyze a SQL query using AI and return optimization suggestions, rewritten query, and index recommendations.',
    inputSchema: {
      type: 'object',
      properties: {
        sql: { type: 'string', description: 'The SQL query to optimize' },
        provider: { type: 'string', description: 'AI provider to use (default: openai)' },
        model: { type: 'string', description: 'AI model to use (default: gpt-4o-mini)' }
      },
      required: ['sql']
    }
  }
];

// ─── AI Safety Guardrails ────────────────────────────────────────

const DESTRUCTIVE_TOOLS = new Set(['migrate_reset', 'backup_restore']);

function isWriteQuery(sql) {
  const upper = sql.trim().toUpperCase();
  return /^(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|REPLACE)\b/.test(upper);
}

function validateConsent(consent) {
  return typeof consent === 'string' && consent.trim().length > 0;
}

// ─── MCP Server ──────────────────────────────────────────────────

class MCPServer extends EventEmitter {
  /**
   * @param {object} options
   * @param {object} options.connection - DatabaseConnection instance (optional, auto-loaded from project)
   * @param {string} options.projectDir - Project root directory (default: process.cwd())
   * @param {boolean} options.safetyGuardrails - Enable AI safety guardrails (default: true)
   */
  constructor(options = {}) {
    super();
    this.projectDir = options.projectDir || process.cwd();
    this.connection = options.connection || null;
    this.safetyGuardrails = options.safetyGuardrails !== false;
    this._buffer = '';
    this._initialized = false;
  }

  /**
   * Start the MCP server on stdio
   */
  start() {
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => this._onData(chunk));
    process.stdin.on('end', () => this.emit('close'));
    this.emit('started');
  }

  /**
   * Start in programmatic mode (no stdio binding)
   * Returns a handler function for processing messages
   */
  handler() {
    return async (message) => {
      return this._handleMessage(message);
    };
  }

  // ─── Internal: stdio data handling ─────────────────────────────

  _onData(chunk) {
    this._buffer += chunk;
    const lines = this._buffer.split('\n');
    this._buffer = lines.pop(); // keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message = JSON.parse(trimmed);
        this._handleMessage(message).then(response => {
          if (response) {
            this._send(response);
          }
        }).catch(err => {
          this._send({
            jsonrpc: '2.0',
            id: message.id || null,
            error: { code: -32603, message: err.message }
          });
        });
      } catch {
        this._send({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' }
        });
      }
    }
  }

  _send(obj) {
    const json = JSON.stringify(obj);
    process.stdout.write(json + '\n');
    this.emit('response', obj);
  }

  // ─── Internal: JSON-RPC message routing ────────────────────────

  async _handleMessage(message) {
    const { method, id, params } = message;

    // Notifications (no id) — no response
    if (method === 'notifications/initialized') {
      this._initialized = true;
      this.emit('initialized');
      return null;
    }

    switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false }
          },
          serverInfo: {
            name: 'outlet-orm',
            version: require('../../package.json').version
          }
        }
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOL_DEFINITIONS }
      };

    case 'tools/call':
      return this._handleToolCall(id, params);

    case 'ping':
      return { jsonrpc: '2.0', id, result: {} };

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      };
    }
  }

  // ─── Internal: Tool execution ──────────────────────────────────

  async _handleToolCall(id, params) {
    const { name, arguments: args = {} } = params || {};

    try {
      // Safety guardrails for destructive tools
      if (this.safetyGuardrails && DESTRUCTIVE_TOOLS.has(name)) {
        if (!validateConsent(args.consent)) {
          return this._toolError(id, name,
            `⚠️ SAFETY GUARDRAIL: "${name}" is a destructive operation.\n` +
            'This action can irreversibly destroy data.\n' +
            'You MUST obtain explicit user consent before proceeding.\n' +
            'Pass the user\'s consent text in the "consent" parameter.');
        }
      }

      const result = await this._executeTool(name, args);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }]
        }
      };
    } catch (error) {
      return this._toolError(id, name, error.message);
    }
  }

  _toolError(id, toolName, message) {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text: `Error [${toolName}]: ${message}` }],
        isError: true
      }
    };
  }

  // ─── Tool Implementations ─────────────────────────────────────

  async _executeTool(name, args) {
    switch (name) {
    case 'migrate_status':    return this._toolMigrateStatus();
    case 'migrate_run':       return this._toolMigrateRun();
    case 'migrate_rollback':  return this._toolMigrateRollback(args);
    case 'migrate_reset':     return this._toolMigrateReset(args);
    case 'migrate_make':      return this._toolMigrateMake(args);
    case 'seed_run':          return this._toolSeedRun(args);
    case 'schema_introspect': return this._toolSchemaIntrospect(args);
    case 'query_execute':     return this._toolQueryExecute(args);
    case 'model_list':        return this._toolModelList();
    case 'backup_create':     return this._toolBackupCreate(args);
    case 'backup_restore':    return this._toolBackupRestore(args);
    case 'ai_query':          return this._toolAiQuery(args);
    case 'query_optimize':    return this._toolQueryOptimize(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
    }
  }

  // ─── Connection helper ─────────────────────────────────────────

  async _getConnection() {
    if (this.connection) return this.connection;

    // Auto-load from project
    const { DatabaseConnection } = require('../../src');
    const dbConfigPath = path.join(this.projectDir, 'database', 'config.js');

    let config;
    try {
      config = require(dbConfigPath);
      if (config instanceof DatabaseConnection) {
        this.connection = config;
        if (!this.connection._connected) await this.connection.connect();
        return this.connection;
      }
    } catch {
      // Fallback to .env
      try { require('dotenv').config({ path: path.join(this.projectDir, '.env') }); } catch { /* dotenv optional */ }
      const env = process.env;
      config = {
        driver: env.DB_DRIVER || env.DATABASE_DRIVER,
        host: env.DB_HOST,
        port: env.DB_PORT ? Number(env.DB_PORT) : undefined,
        user: env.DB_USER || env.DB_USERNAME,
        password: env.DB_PASSWORD,
        database: env.DB_DATABASE || env.DB_NAME || env.DB_FILE
      };
      if (!config.driver) throw new Error('No database configuration found. Run outlet-init first.');
    }

    this.connection = new DatabaseConnection(config);
    await this.connection.connect();
    return this.connection;
  }

  // ── migrate_status ─────────────────────────────────────────────

  async _toolMigrateStatus() {
    const conn = await this._getConnection();
    const { MigrationManager } = require('../../src');
    const manager = new MigrationManager(conn);

    // Capture console output
    const logs = [];
    const origLog = console.log;
    console.log = (...a) => logs.push(a.map(String).join(' '));
    try {
      await manager.status();
    } finally {
      console.log = origLog;
    }
    return logs.join('\n') || 'No migrations found.';
  }

  // ── migrate_run ────────────────────────────────────────────────

  async _toolMigrateRun() {
    const conn = await this._getConnection();
    const { MigrationManager } = require('../../src');
    const manager = new MigrationManager(conn);

    const logs = [];
    const origLog = console.log;
    console.log = (...a) => logs.push(a.map(String).join(' '));
    try {
      await manager.run();
    } finally {
      console.log = origLog;
    }
    return logs.join('\n') || 'All migrations are up to date.';
  }

  // ── migrate_rollback ───────────────────────────────────────────

  async _toolMigrateRollback(args) {
    const conn = await this._getConnection();
    const { MigrationManager } = require('../../src');
    const manager = new MigrationManager(conn);
    const steps = Number(args.steps) || 1;

    const logs = [];
    const origLog = console.log;
    console.log = (...a) => logs.push(a.map(String).join(' '));
    try {
      await manager.rollback(steps);
    } finally {
      console.log = origLog;
    }
    return logs.join('\n') || `Rolled back ${steps} batch(es).`;
  }

  // ── migrate_reset ──────────────────────────────────────────────

  async _toolMigrateReset(args) {
    // Consent already validated in _handleToolCall
    const conn = await this._getConnection();
    const { MigrationManager } = require('../../src');
    const manager = new MigrationManager(conn);

    const logs = [];
    const origLog = console.log;
    console.log = (...a) => logs.push(a.map(String).join(' '));
    try {
      await manager.reset();
    } finally {
      console.log = origLog;
    }
    return logs.join('\n') || 'All migrations have been rolled back.';
  }

  // ── migrate_make ───────────────────────────────────────────────

  async _toolMigrateMake(args) {
    if (!args.name) throw new Error('Migration name is required');

    const migrationsDir = path.join(this.projectDir, 'database', 'migrations');
    try { fs.mkdirSync(migrationsDir, { recursive: true }); } catch { /* */ }

    const timestamp = new Date().toISOString()
      .replace(/[-:]/g, '')
      .replace(/T/, '_')
      .replace(/\..+/, '');

    const fileName = `${timestamp}_${args.name}.js`;
    const filePath = path.join(migrationsDir, fileName);

    const isCreate = args.name.includes('create_');
    const tableName = this._extractTableName(args.name);

    const template = isCreate
      ? this._createMigrationTemplate(tableName)
      : this._alterMigrationTemplate(tableName);

    fs.writeFileSync(filePath, template);
    return `Migration created: ${fileName}\nLocation: ${filePath}`;
  }

  // ── seed_run ───────────────────────────────────────────────────

  async _toolSeedRun(args) {
    const conn = await this._getConnection();
    const { SeederManager } = require('../../src');
    const seederManager = new SeederManager(conn);

    const logs = [];
    const origLog = console.log;
    console.log = (...a) => logs.push(a.map(String).join(' '));
    try {
      await seederManager.run(args.class || null);
    } finally {
      console.log = origLog;
    }
    return logs.join('\n') || 'Seeders executed successfully.';
  }

  // ── schema_introspect ──────────────────────────────────────────

  async _toolSchemaIntrospect(args) {
    const conn = await this._getConnection();
    const driver = conn.config.driver;
    let tables;

    if (args.table) {
      tables = [args.table];
    } else {
      // Get all tables
      let query;
      if (driver === 'sqlite') {
        query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
      } else if (driver === 'postgres') {
        query = "SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename";
      } else {
        query = 'SHOW TABLES';
      }
      const rows = await conn.execute(query);
      tables = rows.map(r => {
        const vals = Object.values(r);
        return vals[0];
      });
    }

    const result = {};
    for (const table of tables) {
      let colQuery;
      if (driver === 'sqlite') {
        colQuery = `PRAGMA table_info("${table}")`;
      } else if (driver === 'postgres') {
        colQuery = `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = '${table}' ORDER BY ordinal_position`;
      } else {
        colQuery = `DESCRIBE \`${table}\``;
      }
      const cols = await conn.execute(colQuery);
      result[table] = cols;
    }

    return result;
  }

  // ── query_execute ──────────────────────────────────────────────

  async _toolQueryExecute(args) {
    if (!args.sql) throw new Error('SQL query is required');

    // Safety guardrail for write queries
    if (this.safetyGuardrails && isWriteQuery(args.sql)) {
      if (!validateConsent(args.consent)) {
        throw new Error(
          '⚠️ SAFETY GUARDRAIL: This is a write query that modifies data.\n' +
          'You MUST obtain explicit user consent before proceeding.\n' +
          'Pass the user\'s consent text in the "consent" parameter.'
        );
      }
    }

    const conn = await this._getConnection();
    const result = await conn.execute(args.sql, args.params || []);
    return result;
  }

  // ── model_list ─────────────────────────────────────────────────

  async _toolModelList() {
    const modelsDir = path.join(this.projectDir, 'models');
    if (!fs.existsSync(modelsDir)) {
      return 'No models/ directory found. Models may be in src/ or another location.';
    }

    const files = fs.readdirSync(modelsDir)
      .filter(f => f.endsWith('.js') || f.endsWith('.ts'))
      .sort();

    if (files.length === 0) {
      return 'No model files found in models/ directory.';
    }

    const models = [];
    for (const file of files) {
      try {
        const modelPath = path.join(modelsDir, file);
        const ModelClass = require(modelPath);
        models.push({
          file,
          table: ModelClass.table || '(not defined)',
          fillable: ModelClass.fillable || [],
          hidden: ModelClass.hidden || [],
          timestamps: ModelClass.timestamps !== false
        });
      } catch {
        models.push({ file, error: 'Could not load model' });
      }
    }
    return models;
  }

  // ── backup_create ──────────────────────────────────────────────

  async _toolBackupCreate(args) {
    const conn = await this._getConnection();
    const { BackupManager } = require('../../src');
    const backupDir = path.join(this.projectDir, 'database', 'backups');
    try { fs.mkdirSync(backupDir, { recursive: true }); } catch { /* */ }

    const backupManager = new BackupManager(conn, { outputDir: backupDir, format: args.format || 'sql' });
    const type = args.type || 'full';
    let result;

    if (type === 'full') {
      result = await backupManager.full();
    } else if (type === 'partial') {
      result = await backupManager.partial(args.tables || []);
    } else if (type === 'journal') {
      result = await backupManager.journal();
    } else {
      throw new Error(`Unknown backup type: ${type}`);
    }

    return `Backup created: ${result || 'Success'}`;
  }

  // ── backup_restore ─────────────────────────────────────────────

  async _toolBackupRestore(args) {
    if (!args.filePath) throw new Error('Backup file path is required');
    const conn = await this._getConnection();
    const { BackupManager } = require('../../src');
    const backupManager = new BackupManager(conn);
    await backupManager.restore(args.filePath);
    return `Backup restored from: ${args.filePath}`;
  }

  // ── ai_query (NL → SQL) ───────────────────────────────────────

  async _toolAiQuery(args) {
    if (!args.question) throw new Error('A natural language question is required.');
    const conn = await this._getConnection();
    const manager = this._getAiBridgeManager();
    if (!manager) throw new Error('AiBridge is not configured. Set OPENAI_API_KEY or configure a provider.');

    const AIQueryBuilder = require('./AIQueryBuilder');
    const builder = new AIQueryBuilder(manager, conn);

    if (args.provider || args.model) {
      builder.using(args.provider || 'openai', args.model || 'gpt-4o-mini');
    }
    if (args.safe_mode === false) {
      builder.safeMode(false);
    }

    const result = await builder.query(args.question);
    return {
      sql: result.sql,
      params: result.params,
      explanation: result.explanation,
      results: result.results,
      error: result.error || null
    };
  }

  // ── query_optimize ─────────────────────────────────────────────

  async _toolQueryOptimize(args) {
    if (!args.sql) throw new Error('SQL query is required.');
    const conn = await this._getConnection();
    const manager = this._getAiBridgeManager();
    if (!manager) throw new Error('AiBridge is not configured. Set OPENAI_API_KEY or configure a provider.');

    const AIQueryOptimizer = require('./AIQueryOptimizer');
    const optimizer = new AIQueryOptimizer(manager, conn);

    if (args.provider || args.model) {
      optimizer.using(args.provider || 'openai', args.model || 'gpt-4o-mini');
    }

    const result = await optimizer.optimize(args.sql);
    return {
      original: result.original,
      optimized: result.optimized,
      suggestions: result.suggestions,
      explanation: result.explanation,
      indexes: result.indexes
    };
  }

  // ── AiBridge manager helper ────────────────────────────────────

  /**
   * Lazily creates an AiBridge manager from environment variables.
   * @returns {import('./Bridge/AiBridgeManager')|null}
   */
  _getAiBridgeManager() {
    if (this._aiBridgeManager) return this._aiBridgeManager;

    try {
      const AiBridgeManager = require('./Bridge/AiBridgeManager');
      const config = {};

      // Auto-detect providers from env
      if (process.env.OPENAI_API_KEY)   config.openai   = { api_key: process.env.OPENAI_API_KEY };
      if (process.env.OLLAMA_ENDPOINT)  config.ollama   = { endpoint: process.env.OLLAMA_ENDPOINT };
      if (process.env.CLAUDE_API_KEY)   config.claude   = { api_key: process.env.CLAUDE_API_KEY };
      if (process.env.GEMINI_API_KEY)   config.gemini   = { api_key: process.env.GEMINI_API_KEY };
      if (process.env.GROK_API_KEY)     config.grok     = { api_key: process.env.GROK_API_KEY };
      if (process.env.MISTRAL_API_KEY)  config.mistral  = { api_key: process.env.MISTRAL_API_KEY };
      if (process.env.ONN_API_KEY)      config.onn      = { api_key: process.env.ONN_API_KEY };

      if (Object.keys(config).length === 0) return null;

      this._aiBridgeManager = new AiBridgeManager(config);
      return this._aiBridgeManager;
    } catch {
      return null;
    }
  }

  // ─── Template helpers ──────────────────────────────────────────

  _extractTableName(migrationName) {
    const patterns = [/create_(\w+)_table/, /to_(\w+)_table/, /alter_(\w+)_table/, /(\w+)_table/];
    for (const p of patterns) {
      const m = migrationName.match(p);
      if (m) return m[1];
    }
    return 'table_name';
  }

  _capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  _createMigrationTemplate(tableName) {
    return `const { Migration } = require('outlet-orm');

class Create${this._capitalize(tableName)}Table extends Migration {
  async up() {
    const schema = this.getSchema();
    await schema.create('${tableName}', (table) => {
      table.id();
      table.string('name');
      table.timestamps();
    });
  }

  async down() {
    const schema = this.getSchema();
    await schema.dropIfExists('${tableName}');
  }
}

module.exports = Create${this._capitalize(tableName)}Table;
`;
  }

  _alterMigrationTemplate(tableName) {
    return `const { Migration } = require('outlet-orm');

class Alter${this._capitalize(tableName)}Table extends Migration {
  async up() {
    const schema = this.getSchema();
    await schema.table('${tableName}', (table) => {
      // table.string('new_column');
    });
  }

  async down() {
    const schema = this.getSchema();
    await schema.table('${tableName}', (table) => {
      // table.dropColumn('new_column');
    });
  }
}

module.exports = Alter${this._capitalize(tableName)}Table;
`;
  }

  /**
   * Graceful shutdown
   */
  async close() {
    if (this.connection && typeof this.connection.disconnect === 'function') {
      await this.connection.disconnect();
    }
    this.emit('close');
  }
}

module.exports = MCPServer;

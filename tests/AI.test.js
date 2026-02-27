/**
 * Tests for AI features (v7.0.0)
 * - MCPServer (programmatic handler)
 * - AISafetyGuardrails (agent detection, consent validation)
 * - PromptGenerator (prompt parsing, code generation)
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

const MCPServer = require('../src/AI/MCPServer');
const AISafetyGuardrails = require('../src/AI/AISafetyGuardrails');
const PromptGenerator = require('../src/AI/PromptGenerator');

// ─────────────────────────────────────────────────────────────────
// AISafetyGuardrails
// ─────────────────────────────────────────────────────────────────

describe('AISafetyGuardrails', () => {
  const savedEnv = {};
  const envKeys = [
    'CURSOR_TRACE_ID', 'CURSOR_SESSION_ID',
    'CLAUDE_CODE', 'ANTHROPIC_API_KEY',
    'GITHUB_COPILOT', 'COPILOT_AGENT_MODE',
    'WINDSURF_SESSION_ID', 'CODEIUM_SESSION',
    'AIDER_SESSION', 'REPLIT_DB_URL', 'REPLIT_AI_ENABLED',
    'QWEN_SESSION', 'MCP_SERVER_NAME', 'MCP_SESSION_ID',
    'OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION',
    'GEMINI_API_KEY'
  ];

  beforeEach(() => {
    // Save and clear all signature env vars
    for (const key of envKeys) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore
    for (const key of envKeys) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  test('detectAgent returns false when no agent env vars are set', () => {
    const result = AISafetyGuardrails.detectAgent();
    expect(result.detected).toBe(false);
    expect(result.agentName).toBeNull();
  });

  test('detectAgent detects Cursor via CURSOR_TRACE_ID', () => {
    process.env.CURSOR_TRACE_ID = 'test-trace-id';
    const result = AISafetyGuardrails.detectAgent();
    expect(result.detected).toBe(true);
    expect(result.agentName).toBe('Cursor');
  });

  test('detectAgent detects GitHub Copilot via COPILOT_AGENT_MODE', () => {
    process.env.COPILOT_AGENT_MODE = '1';
    const result = AISafetyGuardrails.detectAgent();
    expect(result.detected).toBe(true);
    expect(result.agentName).toBe('GitHub Copilot');
  });

  test('detectAgent detects Windsurf via WINDSURF_SESSION_ID', () => {
    process.env.WINDSURF_SESSION_ID = 'ws-123';
    const result = AISafetyGuardrails.detectAgent();
    expect(result.detected).toBe(true);
    expect(result.agentName).toBe('Windsurf');
  });

  test('detectAgent detects MCP Client via MCP_SERVER_NAME', () => {
    process.env.MCP_SERVER_NAME = 'outlet-orm';
    const result = AISafetyGuardrails.detectAgent();
    expect(result.detected).toBe(true);
    expect(result.agentName).toBe('MCP Client');
  });

  test('isDestructiveCommand identifies destructive commands', () => {
    expect(AISafetyGuardrails.isDestructiveCommand('reset')).toBe(true);
    expect(AISafetyGuardrails.isDestructiveCommand('fresh')).toBe(true);
    expect(AISafetyGuardrails.isDestructiveCommand('drop')).toBe(true);
    expect(AISafetyGuardrails.isDestructiveCommand('truncate')).toBe(true);
    expect(AISafetyGuardrails.isDestructiveCommand('restore')).toBe(true);
  });

  test('isDestructiveCommand returns false for safe commands', () => {
    expect(AISafetyGuardrails.isDestructiveCommand('migrate')).toBe(false);
    expect(AISafetyGuardrails.isDestructiveCommand('status')).toBe(false);
    expect(AISafetyGuardrails.isDestructiveCommand('rollback')).toBe(false);
    expect(AISafetyGuardrails.isDestructiveCommand('seed')).toBe(false);
  });

  test('validateDestructiveAction allows when no AI agent detected', () => {
    const result = AISafetyGuardrails.validateDestructiveAction('reset');
    expect(result.allowed).toBe(true);
    expect(result.message).toBe('');
  });

  test('validateDestructiveAction blocks when AI agent detected without consent', () => {
    process.env.CURSOR_TRACE_ID = 'test';
    const result = AISafetyGuardrails.validateDestructiveAction('reset');
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('Cursor');
    expect(result.message).toContain('OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION');
  });

  test('validateDestructiveAction allows with CONSENT env var', () => {
    process.env.CURSOR_TRACE_ID = 'test';
    process.env.OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION = 'User approved';
    const result = AISafetyGuardrails.validateDestructiveAction('reset');
    expect(result.allowed).toBe(true);
  });

  test('validateDestructiveAction allows with consent flag', () => {
    process.env.COPILOT_AGENT_MODE = '1';
    const result = AISafetyGuardrails.validateDestructiveAction('reset', { consent: 'User approved reset' });
    expect(result.allowed).toBe(true);
  });

  test('CONSENT_ENV_VAR returns the correct env var name', () => {
    expect(AISafetyGuardrails.CONSENT_ENV_VAR).toBe('OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION');
  });
});

// ─────────────────────────────────────────────────────────────────
// PromptGenerator
// ─────────────────────────────────────────────────────────────────

describe('PromptGenerator', () => {
  describe('parse', () => {
    test('detects blog domain', () => {
      const result = PromptGenerator.parse('Create a blog application with posts and comments');
      expect(result.domain).toBe('blog');
      expect(result.tables).toHaveProperty('posts');
      expect(result.tables).toHaveProperty('comments');
      expect(result.tables).toHaveProperty('users');
      expect(result.score).toBeGreaterThan(0);
    });

    test('detects e-commerce domain', () => {
      const result = PromptGenerator.parse('Build an e-commerce store with products and orders');
      expect(result.tables).toHaveProperty('products');
      expect(result.tables).toHaveProperty('orders');
      expect(result.tables).toHaveProperty('order_items');
    });

    test('detects task/project domain', () => {
      const result = PromptGenerator.parse('Create a project management tool with tasks and boards');
      expect(result.tables).toHaveProperty('projects');
      expect(result.tables).toHaveProperty('tasks');
    });

    test('detects social network domain', () => {
      const result = PromptGenerator.parse('Build a social network with friends and messages');
      expect(result.tables).toHaveProperty('follows');
      expect(result.tables).toHaveProperty('messages');
    });

    test('detects SaaS domain', () => {
      const result = PromptGenerator.parse('Create a SaaS app with subscriptions and billing');
      expect(result.tables).toHaveProperty('organizations');
      expect(result.tables).toHaveProperty('subscriptions');
      expect(result.tables).toHaveProperty('plans');
    });

    test('falls back to API/auth domain for generic prompts', () => {
      const result = PromptGenerator.parse('Build something amazing');
      expect(result.tables).toHaveProperty('users');
      expect(result.tables).toHaveProperty('tokens');
    });

    test('detects habit tracker domain', () => {
      const result = PromptGenerator.parse('Create a habit tracker with goals');
      expect(result.tables).toHaveProperty('habits');
      expect(result.tables).toHaveProperty('goals');
    });
  });

  describe('generateModels', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outlet-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('creates model files for a blog blueprint', () => {
      const blueprint = PromptGenerator.parse('Create a blog');
      const modelsDir = path.join(tmpDir, 'models');
      const files = PromptGenerator.generateModels(blueprint, modelsDir);

      expect(files.length).toBeGreaterThan(0);
      for (const f of files) {
        expect(fs.existsSync(f)).toBe(true);
      }

      // Check that a model file has proper content
      const userModel = files.find(f => f.includes('User.js'));
      expect(userModel).toBeDefined();
      const content = fs.readFileSync(userModel, 'utf-8');
      expect(content).toContain("require('outlet-orm')");
      expect(content).toContain('extends Model');
      expect(content).toContain('static table');
      expect(content).toContain('static fillable');
    });

    test('skips pivot tables in model generation', () => {
      const blueprint = PromptGenerator.parse('Create a blog with tags');
      const modelsDir = path.join(tmpDir, 'models');
      const files = PromptGenerator.generateModels(blueprint, modelsDir);

      const pivotFile = files.find(f => f.includes('PostTag'));
      expect(pivotFile).toBeUndefined();
    });

    test('hides password fields', () => {
      const blueprint = PromptGenerator.parse('Create a blog with users');
      const modelsDir = path.join(tmpDir, 'models');
      const files = PromptGenerator.generateModels(blueprint, modelsDir);

      const userModel = files.find(f => f.includes('User.js'));
      const content = fs.readFileSync(userModel, 'utf-8');
      expect(content).toContain('static hidden');
      expect(content).toContain('password');
    });
  });

  describe('generateMigrations', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outlet-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('creates migration files', () => {
      const blueprint = PromptGenerator.parse('Create a blog');
      const migrationsDir = path.join(tmpDir, 'migrations');
      const files = PromptGenerator.generateMigrations(blueprint, migrationsDir);

      expect(files.length).toBeGreaterThan(0);
      for (const f of files) {
        expect(fs.existsSync(f)).toBe(true);
        const content = fs.readFileSync(f, 'utf-8');
        expect(content).toContain('extends Migration');
        expect(content).toContain('async up()');
        expect(content).toContain('async down()');
        expect(content).toContain('schema.create');
      }
    });

    test('migration files have timestamps in filenames', () => {
      const blueprint = PromptGenerator.parse('Build an API');
      const migrationsDir = path.join(tmpDir, 'migrations');
      const files = PromptGenerator.generateMigrations(blueprint, migrationsDir);

      for (const f of files) {
        const basename = path.basename(f);
        // Should start with a timestamp pattern like 20251231_123456
        expect(basename).toMatch(/^\d{8}_\d{6}_create_\w+_table\.js$/);
      }
    });
  });

  describe('generateSeeder', () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outlet-test-'));
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    test('creates DatabaseSeeder.js', () => {
      const blueprint = PromptGenerator.parse('Create a blog');
      const seedsDir = path.join(tmpDir, 'seeds');
      const file = PromptGenerator.generateSeeder(blueprint, seedsDir);

      expect(fs.existsSync(file)).toBe(true);
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).toContain('DatabaseSeeder');
      expect(content).toContain('extends Seeder');
      expect(content).toContain('async run()');
    });
  });
});

// ─────────────────────────────────────────────────────────────────
// MCPServer (programmatic handler mode)
// ─────────────────────────────────────────────────────────────────

describe('MCPServer', () => {
  let server;
  let handle;

  beforeEach(() => {
    server = new MCPServer({
      projectDir: path.join(__dirname, '..'),
      safetyGuardrails: true
    });
    handle = server.handler();
  });

  afterEach(async () => {
    await server.close();
  });

  test('responds to initialize with protocol version', async () => {
    const response = await handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(1);
    expect(response.result.protocolVersion).toBe('2024-11-05');
    expect(response.result.serverInfo.name).toBe('outlet-orm');
    expect(response.result.capabilities.tools).toBeDefined();
  });

  test('responds to ping', async () => {
    const response = await handle({
      jsonrpc: '2.0',
      id: 2,
      method: 'ping',
      params: {}
    });

    expect(response.jsonrpc).toBe('2.0');
    expect(response.id).toBe(2);
    expect(response.result).toEqual({});
  });

  test('lists tools', async () => {
    const response = await handle({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/list',
      params: {}
    });

    expect(response.result.tools).toBeInstanceOf(Array);
    expect(response.result.tools.length).toBeGreaterThanOrEqual(10);

    const toolNames = response.result.tools.map(t => t.name);
    expect(toolNames).toContain('migrate_status');
    expect(toolNames).toContain('migrate_run');
    expect(toolNames).toContain('schema_introspect');
    expect(toolNames).toContain('query_execute');
    expect(toolNames).toContain('model_list');
    expect(toolNames).toContain('backup_create');
  });

  test('returns error for unknown method', async () => {
    const response = await handle({
      jsonrpc: '2.0',
      id: 4,
      method: 'unknown/method',
      params: {}
    });

    expect(response.error).toBeDefined();
    expect(response.error.code).toBe(-32601);
  });

  test('blocks migrate_reset without consent', async () => {
    const response = await handle({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'migrate_reset', arguments: {} }
    });

    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain('SAFETY GUARDRAIL');
  });

  test('blocks backup_restore without consent', async () => {
    const response = await handle({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'backup_restore', arguments: { filePath: '/tmp/backup.sql' } }
    });

    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain('SAFETY GUARDRAIL');
  });

  test('returns error for unknown tool', async () => {
    const response = await handle({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: { name: 'nonexistent_tool', arguments: {} }
    });

    expect(response.result.isError).toBe(true);
    expect(response.result.content[0].text).toContain('Unknown tool');
  });

  test('handles notifications/initialized without response', async () => {
    const response = await handle({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
      params: {}
    });

    expect(response).toBeNull();
  });

  test('model_list returns string when no models/ dir exists', async () => {
    const tmpServer = new MCPServer({
      projectDir: os.tmpdir(),
      safetyGuardrails: false
    });
    const tmpHandle = tmpServer.handler();

    const response = await tmpHandle({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: { name: 'model_list', arguments: {} }
    });

    expect(response.result.content[0].text).toContain('No models/');
    await tmpServer.close();
  });

  test('safety guardrails can be disabled', async () => {
    const unsafeServer = new MCPServer({
      projectDir: os.tmpdir(), // No database config here
      safetyGuardrails: false
    });
    const unsafeHandle = unsafeServer.handler();

    // migrate_reset without consent should NOT be blocked by guardrails
    // It will fail with a DB connection error instead
    const response = await unsafeHandle({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: { name: 'migrate_reset', arguments: {} }
    });

    // The text should NOT mention safety guardrails — the error comes from DB, not consent
    const text = response.result.content[0].text;
    expect(text).not.toContain('SAFETY GUARDRAIL');
    await unsafeServer.close();
  });
});

// ─────────────────────────────────────────────────────────────────
// Module exports
// ─────────────────────────────────────────────────────────────────

describe('Module exports', () => {
  test('index.js exports AI modules', () => {
    const outlet = require('../src');
    expect(outlet.MCPServer).toBeDefined();
    expect(outlet.AISafetyGuardrails).toBeDefined();
    expect(outlet.PromptGenerator).toBeDefined();
  });
});

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const DatabaseConnection = require('../src/DatabaseConnection');
const Model = require('../src/Model');
const QueryBuilderError = require('../src/Errors/QueryBuilderError');
const BackupManager = require('../src/Backup/BackupManager');
const { encryptV2 } = require('../src/Backup/BackupEncryption');
const { Blueprint, UnsupportedCapabilityError } = require('../src');
const { MutationQueue } = require('../src/Api/Offline/MutationQueue');
const MCPServer = require('../src/AI/MCPServer');
const AIQueryBuilder = require('../src/AI/AIQueryBuilder');
const { Api } = require('../src/Api');

describe('Security hardening', () => {
  describe('transactions', () => {
    let db;

    beforeEach(async () => {
      db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
      await db.connect();
      await db.execute('CREATE TABLE tx_test (id INTEGER PRIMARY KEY, v TEXT)');
    });

    afterEach(async () => {
      await db.close();
    });

    test('concurrent transactions on the same connection are isolated', async () => {
      await Promise.all([
        db.transaction(async () => {
          await db.execute("INSERT INTO tx_test (v) VALUES ('a')");
          await new Promise((r) => setTimeout(r, 20));
        }),
        db.transaction(async () => {
          await db.execute("INSERT INTO tx_test (v) VALUES ('b')");
        })
      ]);

      const rows = await db.execute('SELECT v FROM tx_test ORDER BY id');
      expect(rows.map((r) => r.v)).toEqual(['a', 'b']);
    });

    test('nested transactions use savepoints and roll back only the inner scope', async () => {
      await db.transaction(async () => {
        await db.execute("INSERT INTO tx_test (v) VALUES ('outer')");
        await expect(db.transaction(async () => {
          await db.execute("INSERT INTO tx_test (v) VALUES ('inner')");
          throw new Error('rollback inner');
        })).rejects.toThrow('rollback inner');
      });

      const rows = await db.execute('SELECT v FROM tx_test');
      expect(rows.map((r) => r.v)).toEqual(['outer']);
    });
  });

  describe('mass assignment', () => {
    let db;

    class GuardedUser extends Model {
      static table = 'guarded_users';
      static timestamps = false;
      static guarded = ['role'];
    }

    beforeEach(async () => {
      db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
      await db.connect();
      await db.execute('CREATE TABLE guarded_users (id INTEGER PRIMARY KEY, name TEXT, role TEXT)');
      await db.insert('guarded_users', { name: 'before', role: 'user' });
      GuardedUser.setConnection(db);
    });

    afterEach(async () => {
      await db.close();
    });

    test('fill() blocks guarded attributes', () => {
      const user = new GuardedUser({ name: 'Ada', role: 'admin' });
      expect(user.name).toBe('Ada');
      expect(user.role).toBeUndefined();
    });

    test('query().update() blocks guarded attributes', async () => {
      await GuardedUser.query()
        .where('name', 'before')
        .update({ name: 'after', role: 'admin' });

      const row = await db.execute('SELECT name, role FROM guarded_users WHERE id = 1');
      expect(row[0].name).toBe('after');
      expect(row[0].role).toBe('user');
    });

    test('upsert() rejects unsafe identifiers', async () => {
      await expect(
        GuardedUser.upsert([{ name: 'x' }], 'name; DROP TABLE guarded_users')
      ).rejects.toThrow('Invalid SQL identifier');
    });

    test('strictFillable denies everything when fillable is empty', () => {
      class Strict extends Model {
        static strictFillable = true;
      }
      const instance = new Strict({ name: 'Ada' });
      expect(instance.name).toBeUndefined();
    });
  });

  describe('model safety', () => {
    test('global scopes are isolated per model', () => {
      class A extends Model {}
      class B extends Model {}
      A.addGlobalScope('tenant', (qb) => qb.where('tenant_id', 1));
      expect(Object.keys(A.globalScopes)).toContain('tenant');
      expect(Object.keys(B.globalScopes)).toHaveLength(0);
    });

    test('trashed() is false when deleted_at is absent', () => {
      class Soft extends Model {
        static softDeletes = true;
      }
      expect(new Soft({}).trashed()).toBe(false);
    });

    test('boolean cast handles string false', () => {
      class Cast extends Model {
        static casts = { active: 'boolean' };
      }
      const instance = new Cast({});
      instance.setAttribute('active', 'false');
      expect(instance.active).toBe(false);
      instance.setAttribute('active', 'true');
      expect(instance.active).toBe(true);
    });
  });

  describe('query safety', () => {
    test('update/delete without WHERE are refused', async () => {
      const db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
      await db.connect();
      await db.execute('CREATE TABLE q_safety (id INTEGER PRIMARY KEY, v TEXT)');
      const qb = db.from('q_safety');
      await expect(qb.update({ v: 'x' })).rejects.toThrow(QueryBuilderError);
      await expect(db.from('q_safety').delete()).rejects.toThrow(QueryBuilderError);
      await db.close();
    });

    test('PostgreSQL placeholder conversion preserves JSON operators', () => {
      const db = new DatabaseConnection({ driver: 'postgres', database: 'x' });
      const sql = db.convertToDriverPlaceholder(
        "SELECT data ? 'key' AS has_key FROM t WHERE id = ? AND note = 'a?b'",
        'postgres'
      );
      expect(sql).toContain("data ? 'key'");
      expect(sql).toContain("note = 'a?b'");
      expect(sql).toContain('id = $1');
    });

    test('query log redacts credential parameters', async () => {
      const db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
      await db.connect();
      await db.execute('CREATE TABLE secrets (id INTEGER PRIMARY KEY, password TEXT)');
      DatabaseConnection.enableQueryLog();
      DatabaseConnection.flushQueryLog();
      try {
        await db.insert('secrets', { password: 'super-secret' });
        const logs = DatabaseConnection.getQueryLog();
        expect(logs[logs.length - 1].params).toContain('[REDACTED]');
        expect(logs[logs.length - 1].params).not.toContain('super-secret');
      } finally {
        DatabaseConnection.disableQueryLog();
        await db.close();
      }
    });

    test('query().delete() soft deletes and forceDelete() hard deletes', async () => {
      const db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
      await db.connect();
      await db.execute('CREATE TABLE soft_rows (id INTEGER PRIMARY KEY, name TEXT, deleted_at TEXT)');
      class SoftRow extends Model {
        static table = 'soft_rows';
        static timestamps = false;
        static softDeletes = true;
      }
      SoftRow.setConnection(db);
      await SoftRow.create({ name: 'one' });
      await SoftRow.create({ name: 'two' });

      await SoftRow.query().where('name', 'one').delete();
      const afterSoft = await db.execute('SELECT name, deleted_at FROM soft_rows ORDER BY id');
      expect(afterSoft[0].deleted_at).not.toBeNull();
      expect(afterSoft[1].deleted_at).toBeNull();

      await SoftRow.query().where('name', 'two').forceDelete();
      const afterHard = await db.execute('SELECT name FROM soft_rows ORDER BY id');
      expect(afterHard.map((r) => r.name)).toEqual(['one']);
      await db.close();
    });
  });

  describe('schema changes', () => {
    test('change() emits MODIFY COLUMN on MySQL', () => {
      const bp = new Blueprint('users', { config: { driver: 'mysql' } });
      bp.string('name', 100).nullable().change();
      const statements = bp.toSql('alter');
      expect(statements.some((s) => s.includes('MODIFY COLUMN'))).toBe(true);
    });

    test('change() emits ALTER COLUMN TYPE on PostgreSQL', () => {
      const bp = new Blueprint('users', { config: { driver: 'postgres' } });
      bp.string('name', 100).change();
      const statements = bp.toSql('alter');
      expect(statements.some((s) => s.includes('ALTER COLUMN'))).toBe(true);
      expect(statements.some((s) => s.includes('TYPE VARCHAR(100)'))).toBe(true);
    });

    test('change() throws UnsupportedCapabilityError on SQLite', () => {
      const bp = new Blueprint('users', { config: { driver: 'sqlite' } });
      bp.string('name').change();
      expect(() => bp.toSql('alter')).toThrow(UnsupportedCapabilityError);
    });
  });

  describe('backup safety', () => {
    test('V2 encryption round-trips and detects tampering', () => {
      const { encryptedContent } = encryptV2('secret payload', 'correct horse battery staple');
      expect(encryptedContent.startsWith('OUTLET_ENC_V2\n')).toBe(true);
      expect(require('../src/Backup/BackupEncryption').decrypt(
        encryptedContent,
        'correct horse battery staple'
      )).toBe('secret payload');

      const tampered = encryptedContent.replace(/\n([A-Za-z0-9+/=]+)$/, '\nAAAA');
      expect(() => require('../src/Backup/BackupEncryption').decrypt(
        tampered,
        'correct horse battery staple'
      )).toThrow();
    });

    test('restore refuses files outside the backup directory', async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outlet-sec-'));
      const outside = path.join(os.tmpdir(), `outside-${Date.now()}.sql`);
      fs.writeFileSync(outside, 'SELECT 1;');
      const db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
      await db.connect();
      const manager = new BackupManager(db, { backupPath: dir });
      await expect(manager.restore(outside)).rejects.toThrow('outside the backup directory');
      await db.close();
      fs.rmSync(dir, { recursive: true, force: true });
      fs.rmSync(outside, { force: true });
    });
  });

  describe('AI safety', () => {
    test('AIQueryBuilder rejects data-modifying CTEs', async () => {
      const manager = { chat: async () => ({ output_text: JSON.stringify({ sql: 'WITH x AS (DELETE FROM users RETURNING *) SELECT * FROM x', params: [] }) }) };
      const qb = new AIQueryBuilder(manager, null);
      await expect(qb.query('delete users')).rejects.toThrow('safe mode');
    });

    test('MCP blocks write CTEs without strong consent', async () => {
      const server = new MCPServer({ safetyGuardrails: true });
      const handle = server.handler();
      const response = await handle({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'query_execute',
          arguments: { sql: 'WITH x AS (DELETE FROM users RETURNING *) SELECT * FROM x' }
        }
      });
      expect(response.result.isError).toBe(true);
      expect(response.result.content[0].text).toContain('SAFETY GUARDRAIL');
      await server.close();
    });

    test('MCP rejects path traversal in migrate_make', async () => {
      const server = new MCPServer({ safetyGuardrails: false, projectDir: os.tmpdir() });
      const handle = server.handler();
      const response = await handle({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'migrate_make', arguments: { name: '../../evil' } }
      });
      expect(response.result.isError).toBe(true);
      expect(response.result.content[0].text).toContain('Migration name must match');
      await server.close();
    });
  });

  describe('API cache scope', () => {
    test('cache keys include the configured scope', () => {
      class Scoped extends Api {}
      Scoped.cacheScope = 'tenant:42';
      expect(Scoped._cacheKey('/users')).toBe('tenant:42:/users');
      Scoped.cacheScope = null;
    });
  });

  describe('offline encryption hook', () => {
    test('encrypts queued mutations when hooks are provided', async () => {
      const store = new (require('../src/Api/Offline/MemoryStore').MemoryStore)();
      const queue = new MutationQueue({
        store,
        encrypt: async (value) => Buffer.from(JSON.stringify(value)).toString('base64'),
        decrypt: async (value) => JSON.parse(Buffer.from(value, 'base64').toString('utf8'))
      });
      await queue.enqueue({ method: 'POST', path: '/users', body: { name: 'Ada' } });

      const raw = await store.get('__outlet_mutation_queue__');
      expect(raw.__outletEncrypted).toBe(true);
      expect(JSON.stringify(raw.payload)).not.toContain('Ada');
      const loaded = await queue.getQueue();
      expect(loaded[0].body.name).toBe('Ada');
    });
  });
});

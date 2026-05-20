const { Schema, Blueprint } = require('../src/Schema/Schema');
const DatabaseConnection = require('../src/DatabaseConnection');
const Migration = require('../src/Migrations/Migration');

describe('New bypass / compatibility helpers', () => {
  describe('Schema.hasIndex (SQLite)', () => {
    let db; let schema;
    beforeAll(async () => {
      db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
      await db.connect();
      schema = new Schema(db);
      await schema.create('hidx_users', (t) => {
        t.id();
        t.string('email');
        t.string('name');
      });
      await db.execute('CREATE INDEX idx_hidx_users_email ON hidx_users(email)');
    });
    afterAll(async () => { await db.close(); });

    test('returns true for an existing index', async () => {
      const exists = await schema.hasIndex('hidx_users', 'idx_hidx_users_email');
      expect(exists).toBe(true);
    });

    test('returns false for a missing index', async () => {
      const exists = await schema.hasIndex('hidx_users', 'idx_does_not_exist');
      expect(exists).toBe(false);
    });

    test('indexExists is an alias', async () => {
      const exists = await schema.indexExists('hidx_users', 'idx_hidx_users_email');
      expect(exists).toBe(true);
    });
  });

  describe('timestamps() overloads', () => {
    test('no args → useCurrent on both, ON UPDATE on updated_at', () => {
      const bp = new Blueprint('t', { config: { driver: 'mysql' } });
      bp.timestamps();
      const sql = bp.toCreateSql();
      expect(sql).toMatch(/`created_at`.*DEFAULT CURRENT_TIMESTAMP/);
      expect(sql).toMatch(/`updated_at`.*DEFAULT CURRENT_TIMESTAMP.*ON UPDATE CURRENT_TIMESTAMP/);
    });

    test('legacy 1-arg timestamps(true) → nullable, no defaults', () => {
      const bp = new Blueprint('t', { config: { driver: 'mysql' } });
      bp.timestamps(true);
      const sql = bp.toCreateSql();
      expect(sql).not.toMatch(/`created_at`[^,]*NOT NULL/);
      expect(sql).not.toMatch(/`updated_at`[^,]*NOT NULL/);
      expect(sql).not.toMatch(/DEFAULT CURRENT_TIMESTAMP/);
    });

    test('Knex-style timestamps(true, true) → useCurrent + ON UPDATE', () => {
      const bp = new Blueprint('t', { config: { driver: 'mysql' } });
      bp.timestamps(true, true);
      const sql = bp.toCreateSql();
      expect(sql).toMatch(/`created_at`.*DEFAULT CURRENT_TIMESTAMP/);
      expect(sql).toMatch(/`updated_at`.*DEFAULT CURRENT_TIMESTAMP.*ON UPDATE CURRENT_TIMESTAMP/);
    });

    test('object form { nullable: true, useCurrent: false } → nullable only', () => {
      const bp = new Blueprint('t', { config: { driver: 'mysql' } });
      bp.timestamps({ nullable: true, useCurrent: false, useCurrentOnUpdate: false });
      const sql = bp.toCreateSql();
      expect(sql).not.toMatch(/`created_at`[^,]*NOT NULL/);
      expect(sql).not.toMatch(/DEFAULT CURRENT_TIMESTAMP/);
      expect(sql).not.toMatch(/ON UPDATE/);
    });
  });

  describe('dropIndex literal name form', () => {
    test('dropIndex({ name }) emits DROP INDEX with the literal name', () => {
      const bp = new Blueprint('articles', { config: { driver: 'mysql' } });
      bp.dropIndex({ name: 'idx_custom_name' });
      const sql = bp.toAlterSql().join('\n');
      expect(sql).toContain('DROP INDEX `idx_custom_name`');
    });

    test('dropIndex(["a","b"]) still derives the conventional name', () => {
      const bp = new Blueprint('articles', { config: { driver: 'mysql' } });
      bp.dropIndex(['a', 'b']);
      const sql = bp.toAlterSql().join('\n');
      expect(sql).toContain('DROP INDEX `articles_a_b_index`');
    });
  });

  describe('Migration.query/table helpers', () => {
    let db;
    beforeAll(async () => {
      db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
      await db.connect();
      const schema = new Schema(db);
      await schema.create('mq_users', (t) => {
        t.id();
        t.string('email');
        t.integer('active').default(0);
      });
      await db.insert('mq_users', { email: 'a@b.com', active: 0 });
      await db.insert('mq_users', { email: 'c@d.com', active: 0 });
    });
    afterAll(async () => { await db.close(); });

    test('query(table).where().update() works without hand-built wheres', async () => {
      const m = new Migration(db);
      await m.query('mq_users').where('email', 'a@b.com').update({ active: 1 });
      const rows = await m.query('mq_users').where('email', 'a@b.com').get();
      expect(rows[0].active).toBe(1);
    });

    test('table() is an alias of query()', async () => {
      const m = new Migration(db);
      const rows = await m.table('mq_users').where('email', 'c@d.com').get();
      expect(rows).toHaveLength(1);
    });

    test('log/info/warn are silent under jest (no throws)', () => {
      const m = new Migration(db);
      expect(() => m.log('hello')).not.toThrow();
      expect(() => m.info('hello')).not.toThrow();
      expect(() => m.warn('hello')).not.toThrow();
    });
  });

  describe('Migration schema guard helpers', () => {
    test('addColumnIfMissing adds the column and returns true when absent', async () => {
      const schema = {
        hasColumn: jest.fn().mockResolvedValue(false),
        table: jest.fn(async (_tableName, callback) => {
          const table = { string: jest.fn() };
          callback(table);
          expect(table.string).toHaveBeenCalledWith('nickname');
        })
      };
      const m = new Migration({});

      const added = await m.addColumnIfMissing(schema, 'users', 'nickname', (table) => {
        table.string('nickname');
      });

      expect(added).toBe(true);
      expect(schema.hasColumn).toHaveBeenCalledWith('users', 'nickname');
      expect(schema.table).toHaveBeenCalledWith('users', expect.any(Function));
    });

    test('addColumnIfMissing skips and returns false when present', async () => {
      const schema = {
        hasColumn: jest.fn().mockResolvedValue(true),
        table: jest.fn()
      };
      const m = new Migration({});

      const added = await m.addColumnIfMissing(schema, 'users', 'nickname', () => {});

      expect(added).toBe(false);
      expect(schema.table).not.toHaveBeenCalled();
    });

    test('dropColumnIfExists drops the column and returns true when present', async () => {
      const schema = {
        hasColumn: jest.fn().mockResolvedValue(true),
        table: jest.fn(async (_tableName, callback) => {
          const table = { dropColumn: jest.fn() };
          callback(table);
          expect(table.dropColumn).toHaveBeenCalledWith('nickname');
        })
      };
      const m = new Migration({});

      const dropped = await m.dropColumnIfExists(schema, 'users', 'nickname');

      expect(dropped).toBe(true);
      expect(schema.hasColumn).toHaveBeenCalledWith('users', 'nickname');
      expect(schema.table).toHaveBeenCalledWith('users', expect.any(Function));
    });

    test('dropColumnIfExists skips and returns false when absent', async () => {
      const schema = {
        hasColumn: jest.fn().mockResolvedValue(false),
        table: jest.fn()
      };
      const m = new Migration({});

      const dropped = await m.dropColumnIfExists(schema, 'users', 'nickname');

      expect(dropped).toBe(false);
      expect(schema.table).not.toHaveBeenCalled();
    });

    test('dropForeignIfExists delegates to dropForeign', async () => {
      const schema = {
        table: jest.fn(async (_tableName, callback) => {
          const table = { dropForeign: jest.fn() };
          callback(table);
          expect(table.dropForeign).toHaveBeenCalledWith(['user_id']);
        })
      };
      const m = new Migration({});

      await expect(m.dropForeignIfExists(schema, 'posts', ['user_id'])).resolves.toBeUndefined();
      expect(schema.table).toHaveBeenCalledWith('posts', expect.any(Function));
    });

    test('dropForeignIfExists ignores common missing-foreign-key errors', async () => {
      const schema = {
        table: jest.fn().mockRejectedValue(new Error('Can\'t DROP \'posts_user_id_foreign\'; check that column/key exists'))
      };
      const m = new Migration({});

      await expect(m.dropForeignIfExists(schema, 'posts', ['user_id'])).resolves.toBeUndefined();
    });

    test('dropForeignIfExists rethrows unrelated errors', async () => {
      const schema = {
        table: jest.fn().mockRejectedValue(new Error('permission denied'))
      };
      const m = new Migration({});

      await expect(m.dropForeignIfExists(schema, 'posts', ['user_id'])).rejects.toThrow('permission denied');
    });

    test('dropNamedForeignIfExists executes ALTER TABLE DROP FOREIGN KEY', async () => {
      const connection = {
        execute: jest.fn().mockResolvedValue(undefined)
      };
      const m = new Migration(connection);

      await expect(m.dropNamedForeignIfExists('posts', 'fk_posts_user')).resolves.toBeUndefined();
      expect(connection.execute).toHaveBeenCalledWith('ALTER TABLE `posts` DROP FOREIGN KEY `fk_posts_user`');
    });

    test('dropNamedForeignIfExists ignores common missing-foreign-key errors', async () => {
      const connection = {
        execute: jest.fn().mockRejectedValue(new Error('Can\'t DROP \'fk_posts_user\'; check that column/key exists'))
      };
      const m = new Migration(connection);

      await expect(m.dropNamedForeignIfExists('posts', 'fk_posts_user')).resolves.toBeUndefined();
    });

    test('dropNamedForeignIfExists rethrows unrelated errors', async () => {
      const connection = {
        execute: jest.fn().mockRejectedValue(new Error('permission denied'))
      };
      const m = new Migration(connection);

      await expect(m.dropNamedForeignIfExists('posts', 'fk_posts_user')).rejects.toThrow('permission denied');
    });
  });
});

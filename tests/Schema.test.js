const { Schema } = require('../src/Schema/Schema');
const DatabaseConnection = require('../src/DatabaseConnection');

describe('Schema Builder', () => {
  let db;
  let schema;

  beforeAll(async () => {
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();
    schema = new Schema(db);
  });

  afterAll(async () => {
    await db.close();
  });

  test('should create table with foreignId and constrained', async () => {
    await schema.create('users', (table) => {
      table.id();
      table.string('name');
    });

    await schema.create('posts', (table) => {
      table.id();
      table.string('title');
      table.foreignId('user_id').constrained().cascadeOnDelete();
    });

    const hasUsers = await schema.hasTable('users');
    const hasPosts = await schema.hasTable('posts');

    expect(hasUsers).toBe(true);
    expect(hasPosts).toBe(true);
  });

  test('should create table with explicit foreign key', async () => {
    await schema.create('groups', (table) => {
      table.id();
      table.string('name');
    });

    await schema.create('group_user', (table) => {
      table.id();
      table.foreignId('group_id');
      table.foreignId('user_id');
      table.foreign('group_id').references('id').on('groups').onDelete('CASCADE');
      table.foreign('user_id').references('id').on('users').onDelete('CASCADE');
    });

    const hasGroups = await schema.hasTable('groups');
    const hasGroupUser = await schema.hasTable('group_user');

    expect(hasGroups).toBe(true);
    expect(hasGroupUser).toBe(true);
  });

  describe('index() signatures', () => {
    const { Blueprint } = require('../src/Schema/Schema');

    test('index(column, name) accepts a single string column with an explicit name', () => {
      const bp = new Blueprint('users', { config: { driver: 'mysql' } });
      bp.index('email', 'idx_users_email');
      const cmd = bp.commands.find(c => c.type === 'index');
      expect(cmd).toBeDefined();
      expect(cmd.columns).toEqual(['email']);
      expect(cmd.name).toBe('idx_users_email');
      expect(bp.toAlterSql().join('\n')).toContain(
        'ADD INDEX `idx_users_email` (`email`)'
      );
    });

    test('index([columns], name) accepts an array of columns with an explicit name', () => {
      const bp = new Blueprint('users', { config: { driver: 'mysql' } });
      bp.index(['a', 'b', 'c'], 'idx_users_abc');
      const cmd = bp.commands.find(c => c.type === 'index');
      expect(cmd).toBeDefined();
      expect(cmd.columns).toEqual(['a', 'b', 'c']);
      expect(cmd.name).toBe('idx_users_abc');
      expect(bp.toAlterSql().join('\n')).toContain(
        'ADD INDEX `idx_users_abc` (`a`, `b`, `c`)'
      );
    });

    test('unique() supports both single-column and array forms with explicit name', () => {
      const bp = new Blueprint('users', { config: { driver: 'mysql' } });
      bp.unique('slug', 'uq_slug');
      bp.unique(['x', 'y'], 'uq_xy');
      const sql = bp.toAlterSql().join('\n');
      expect(sql).toContain('ADD UNIQUE `uq_slug` (`slug`)');
      expect(sql).toContain('ADD UNIQUE `uq_xy` (`x`, `y`)');
    });

    test('fullText() supports both single-column and array forms with explicit name', () => {
      const bp = new Blueprint('articles', { config: { driver: 'mysql' } });
      bp.fullText('body', 'ft_body');
      bp.fullText(['title', 'body'], 'ft_title_body');
      const sql = bp.toAlterSql().join('\n');
      expect(sql).toContain('ADD FULLTEXT `ft_body` (`body`)');
      expect(sql).toContain('ADD FULLTEXT `ft_title_body` (`title`, `body`)');
    });
  });
});

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
});

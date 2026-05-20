'use strict';

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const DatabaseConnection = require('../../src/DatabaseConnection');
const { Schema } = require('../../src/Schema/Schema');
const Migration = require('../../src/Migrations/Migration');
const BackupManager = require('../../src/Backup/BackupManager');
const { MockAdapter } = require('../../src/Api/MockAdapter');
const { Api } = require('../../src/Api/Api');
const { ApiNotFoundError } = require('../../src/Api/Errors/ApiNotFoundError');
const { ApiValidationError } = require('../../src/Api/Errors/ApiValidationError');
const MCPServer = require('../../src/AI/MCPServer');
const AISafetyGuardrails = require('../../src/AI/AISafetyGuardrails');
const PromptGenerator = require('../../src/AI/PromptGenerator');
const { parseCreateTable, generateMigration, reverseFromSql } = require('../../bin/reverse');
const { buildModels } = require('./models');

const LAB_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(LAB_ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'lab.sqlite');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

function ensureCleanDataDir(reset) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!reset) return;

  if (fs.existsSync(DB_FILE)) {
    fs.rmSync(DB_FILE, { force: true });
  }

  if (fs.existsSync(BACKUP_DIR)) {
    fs.rmSync(BACKUP_DIR, { recursive: true, force: true });
  }
}

async function bootstrapSchema(db) {
  const schema = new Schema(db);

  await schema.create('countries', (table) => {
    table.id();
    table.string('name');
    table.string('code').unique();
    table.timestamps(true);
  });

  await schema.create('users', (table) => {
    table.id();
    table.string('name');
    table.string('email').unique();
    table.string('password').nullable();
    table.integer('age').nullable();
    table.boolean('is_admin').default(0);
    table.string('status').default('active');
    table.timestamps(true);
    table.softDeletes();
  });

  await schema.create('profiles', (table) => {
    table.id();
    table.foreignId('user_id').constrained('users').onDelete('CASCADE');
    table.foreignId('country_id').constrained('countries').onDelete('RESTRICT');
    table.text('bio').nullable();
    table.string('timezone').nullable();
    table.timestamps(true);
  });

  await schema.create('profile_settings', (table) => {
    table.id();
    table.foreignId('profile_id').constrained('profiles').onDelete('CASCADE');
    table.string('theme').default('light');
    table.string('digest_frequency').default('weekly');
    table.timestamps(true);
  });

  await schema.create('roles', (table) => {
    table.id();
    table.string('name').unique();
    table.string('description').nullable();
    table.timestamps(true);
  });

  await schema.create('tags', (table) => {
    table.id();
    table.string('name').unique();
    table.timestamps(true);
  });

  await schema.create('posts', (table) => {
    table.id();
    table.foreignId('user_id').constrained('users').onDelete('CASCADE');
    table.string('title');
    table.text('body').nullable();
    table.string('status').default('draft');
    table.integer('views').default(0);
    table.boolean('featured').default(0);
    table.timestamps(true);
    table.softDeletes();
  });

  await schema.create('videos', (table) => {
    table.id();
    table.foreignId('user_id').constrained('users').onDelete('CASCADE');
    table.string('title');
    table.string('url');
    table.string('status').default('published');
    table.timestamps(true);
  });

  await schema.create('comments', (table) => {
    table.id();
    table.foreignId('post_id').constrained('posts').onDelete('CASCADE');
    table.foreignId('user_id').constrained('users').onDelete('CASCADE');
    table.text('content');
    table.timestamps(true);
  });

  await schema.create('media_comments', (table) => {
    table.id();
    table.string('commentable_type');
    table.integer('commentable_id');
    table.foreignId('user_id').constrained('users').onDelete('CASCADE');
    table.text('content');
    table.timestamps(true);
  });

  await schema.create('user_roles', (table) => {
    table.id();
    table.foreignId('user_id').constrained('users').onDelete('CASCADE');
    table.foreignId('role_id').constrained('roles').onDelete('CASCADE');
    table.timestamps(true);
  });

  await schema.create('post_tags', (table) => {
    table.id();
    table.foreignId('post_id').constrained('posts').onDelete('CASCADE');
    table.foreignId('tag_id').constrained('tags').onDelete('CASCADE');
    table.timestamps(true);
  });
}

async function seedDatabase(db) {
  const now = new Date().toISOString();
  const inserts = [
    ['INSERT INTO countries (id, name, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [1, 'France', 'FR', now, now]],
    ['INSERT INTO countries (id, name, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [2, 'Japan', 'JP', now, now]],

    ['INSERT INTO users (id, name, email, password, age, is_admin, status, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [1, 'Alice', 'alice@example.com', 'secret-1', 31, 1, 'active', now, now, null]],
    ['INSERT INTO users (id, name, email, password, age, is_admin, status, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [2, 'Bob', 'bob@example.com', 'secret-2', 28, 0, 'active', now, now, null]],
    ['INSERT INTO users (id, name, email, password, age, is_admin, status, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [3, 'Carol', 'carol@example.com', 'secret-3', 19, 0, 'invited', now, now, null]],
    ['INSERT INTO users (id, name, email, password, age, is_admin, status, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [4, 'Dana', 'dana@example.com', 'secret-4', 45, 0, 'active', now, now, null]],

    ['INSERT INTO profiles (id, user_id, country_id, bio, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [1, 1, 1, 'Architect and maintainer', 'Europe/Paris', now, now]],
    ['INSERT INTO profiles (id, user_id, country_id, bio, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [2, 2, 2, 'Video maker', 'Asia/Tokyo', now, now]],
    ['INSERT INTO profiles (id, user_id, country_id, bio, timezone, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [3, 3, 1, 'QA apprentice', 'Europe/Paris', now, now]],

    ['INSERT INTO profile_settings (id, profile_id, theme, digest_frequency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [1, 1, 'dark', 'daily', now, now]],
    ['INSERT INTO profile_settings (id, profile_id, theme, digest_frequency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [2, 2, 'light', 'weekly', now, now]],
    ['INSERT INTO profile_settings (id, profile_id, theme, digest_frequency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [3, 3, 'system', 'monthly', now, now]],

    ['INSERT INTO roles (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [1, 'admin', 'Full access', now, now]],
    ['INSERT INTO roles (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [2, 'editor', 'Can publish content', now, now]],
    ['INSERT INTO roles (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [3, 'member', 'Regular user', now, now]],

    ['INSERT INTO tags (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [1, 'orm', now, now]],
    ['INSERT INTO tags (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [2, 'sqlite', now, now]],
    ['INSERT INTO tags (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)', [3, 'api', now, now]],

    ['INSERT INTO posts (id, user_id, title, body, status, views, featured, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [1, 1, 'Lab intro', 'First published post', 'published', 10, 1, now, now, null]],
    ['INSERT INTO posts (id, user_id, title, body, status, views, featured, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [2, 1, 'Draft notes', 'Internal draft', 'draft', 3, 0, now, now, null]],
    ['INSERT INTO posts (id, user_id, title, body, status, views, featured, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [3, 2, 'API sync', 'Remote API article', 'published', 5, 0, now, now, null]],

    ['INSERT INTO videos (id, user_id, title, url, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [100, 2, 'Outlet tour', 'https://example.test/videos/100', 'published', now, now]],

    ['INSERT INTO comments (id, post_id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [1, 1, 2, 'Great intro', now, now]],
    ['INSERT INTO comments (id, post_id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [2, 1, 3, 'Needs more examples', now, now]],
    ['INSERT INTO comments (id, post_id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [3, 3, 1, 'Remote layer looks good', now, now]],

    ['INSERT INTO media_comments (id, commentable_type, commentable_id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [1, 'posts', 1, 2, 'Morph comment on post', now, now]],
    ['INSERT INTO media_comments (id, commentable_type, commentable_id, user_id, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [2, 'videos', 100, 1, 'Morph comment on video', now, now]],

    ['INSERT INTO user_roles (id, user_id, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [1, 1, 1, now, now]],
    ['INSERT INTO user_roles (id, user_id, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [2, 1, 2, now, now]],
    ['INSERT INTO user_roles (id, user_id, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [3, 2, 3, now, now]],
    ['INSERT INTO user_roles (id, user_id, role_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [4, 3, 3, now, now]],

    ['INSERT INTO post_tags (id, post_id, tag_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [1, 1, 1, now, now]],
    ['INSERT INTO post_tags (id, post_id, tag_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [2, 1, 2, now, now]],
    ['INSERT INTO post_tags (id, post_id, tag_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [3, 3, 3, now, now]]
  ];

  for (const [sql, params] of inserts) {
    await db.execute(sql, params);
  }
}

function createApiModels() {
  class RemotePost extends Api {
    static endpoint = '/remote-posts';
    static fillable = ['title', 'status'];
    static casts = { id: 'int' };
    static rules = { title: 'required|min:3' };
  }

  return { RemotePost };
}

async function createContext(options = {}) {
  const reset = options.reset !== false;
  ensureCleanDataDir(reset);

  const db = new DatabaseConnection({
    driver: 'sqlite',
    database: DB_FILE
  });

  await db.connect();
  await bootstrapSchema(db);
  await seedDatabase(db);

  const eventLog = [];
  const models = buildModels(db, eventLog);
  eventLog.length = 0;

  return {
    db,
    eventLog,
    models,
    paths: {
      dbFile: DB_FILE,
      backupDir: BACKUP_DIR
    }
  };
}

async function runMigrationScenario(context) {
  const migration = new Migration(context.db);
  const schema = migration.getSchema();

  await schema.create('lab_flags', (table) => {
    table.id();
    table.string('label');
    table.timestamps(true);
  });

  assert.equal(await schema.hasColumn('lab_flags', 'is_enabled'), false);
  assert.equal(await migration.addColumnIfMissing(schema, 'lab_flags', 'is_enabled', (table) => {
    table.boolean('is_enabled').default(1);
  }), true);
  assert.equal(await schema.hasColumn('lab_flags', 'is_enabled'), true);
  assert.equal(await migration.addColumnIfMissing(schema, 'lab_flags', 'is_enabled', () => {}), false);

  assert.equal(await migration.dropColumnIfExists(schema, 'lab_flags', 'is_enabled'), true);
  assert.equal(await schema.hasColumn('lab_flags', 'is_enabled'), false);
  assert.equal(await migration.dropColumnIfExists(schema, 'lab_flags', 'is_enabled'), false);

  let delegated = false;
  await migration.dropForeignIfExists({
    table: async (_tableName, callback) => {
      const table = {
        dropForeign(columns) {
          delegated = Array.isArray(columns) && columns[0] === 'user_id';
        }
      };
      callback(table);
      throw new Error('Can\'t DROP \'lab_flags_user_id_foreign\'; check that column/key exists');
    }
  }, 'lab_flags', ['user_id']);

  assert.equal(delegated, true);
}

async function runCrudScenario(context) {
  const { User } = context.models;

  const invalid = new User({ name: 'No', email: 'not-an-email' });
  assert.equal(invalid.validate().valid, false);
  assert.throws(() => {
    invalid.validateOrFail();
  }, /Validation failed/);

  const user = await User.create({
    name: 'Neo Lab',
    email: 'neo@example.com',
    password: 'matrix',
    age: 36,
    status: 'active',
    is_admin: 0
  });

  assert.equal(typeof user.id, 'number');
  assert.equal(user.is_admin, false);
  assert.equal(Object.prototype.hasOwnProperty.call(user.toJSON(), 'password'), false);

  const found = await User.findOrFail(user.id);
  assert.equal(found.email, 'neo@example.com');

  found.age = 37;
  await found.save();
  const updated = await User.findOrFail(user.id);
  assert.equal(updated.age, 37);
}

async function runQueryScenario(context) {
  const { User, Post } = context.models;

  const scoped = await User.query().active().adults(21).orderBy('age', 'desc').get();
  assert.equal(scoped.length >= 2, true);

  const filtered = await User.query().whereBetween('age', [20, 40])
    .whereIn('status', ['active', 'invited'])
    .orderBy('age', 'desc')
    .limit(2)
    .get();
  assert.equal(filtered.length, 2);

  const exists = await User.where('email', 'alice@example.com').exists();
  assert.equal(exists, true);

  const total = await User.where('status', 'active').count();
  assert.equal(total >= 3, true);

  await Post.where('id', 1).increment('views', 5);
  const post = await Post.findOrFail(1);
  assert.equal(post.views, 15);

  const page = await User.orderBy('id').paginate(1, 2);
  assert.equal(page.data.length, 2);
  assert.equal(page.current_page, 1);
  assert.equal(page.per_page, 2);
}

async function runRelationsScenario(context) {
  const { User, Post, MediaComment } = context.models;

  class RelationUser extends User {}
  RelationUser.connection = context.db;
  RelationUser.softDeletes = false;

  const alice = await User.with('profile.country', 'roles', 'posts.comments', 'profileSetting')
    .where('id', 1)
    .firstOrFail();
  assert.equal(alice.relations.roles.length >= 2, true);
  assert.equal(alice.relations.posts.length >= 2, true);
  assert.equal(alice.relations.profile.relations.country.name, 'France');
  assert.equal(alice.relations.profileSetting.theme, 'dark');
  assert.equal(alice.relations.posts[0].relations.comments.length >= 1, true);

  const bob = await User.findOrFail(2);
  await bob.roles().attach([2]);
  let bobRoles = await bob.roles().get();
  assert.equal(bobRoles.length >= 2, true);

  await bob.roles().sync([3]);
  bobRoles = await bob.roles().get();
  assert.equal(bobRoles.length, 1);
  assert.equal(bobRoles[0].name, 'member');

  const post = await Post.findOrFail(1);
  const tags = await post.tags().get();
  assert.equal(tags.length, 2);

  const commentable = await MediaComment.findOrFail(2);
  const parent = await commentable.commentable().get();
  assert.equal(parent.title, 'Outlet tour');

  const authors = await RelationUser.query().whereHas('posts', (query) => {
    query.where('status', 'published');
  }).withCount('posts').get();
  assert.equal(authors.length >= 2, true);
  assert.equal(typeof authors[0].posts_count, 'number');

  const noPostUsers = await RelationUser.query().whereDoesntHave('posts').get();
  assert.equal(noPostUsers.some((user) => user.email === 'carol@example.com' || user.email === 'dana@example.com'), true);

  const throughComments = await alice.comments().get();
  assert.equal(throughComments.length >= 2, true);
}

async function runScopesAndSoftDeletesScenario(context) {
  const { User, Post } = context.models;

  class ScopedPost extends Post {}
  ScopedPost.connection = context.db;
  ScopedPost.globalScopes = {};
  ScopedPost.addGlobalScope('publishedOnly', (query) => {
    query.where('status', 'published');
  });

  const visiblePosts = await ScopedPost.all();
  assert.equal(visiblePosts.every((item) => item.status === 'published'), true);

  const allPosts = await ScopedPost.withoutGlobalScopes().get();
  assert.equal(allPosts.some((item) => item.status === 'draft'), true);

  const dana = await User.findOrFail(4);
  await dana.destroy();

  const missingFromDefaultQuery = await User.where('id', 4).first();
  assert.equal(missingFromDefaultQuery, null);

  const trashed = await User.onlyTrashed().get();
  assert.equal(trashed.some((item) => item.id === 4), true);

  const danaWithTrash = await User.withTrashed().where('id', 4).first();
  assert.equal(danaWithTrash.trashed(), true);

  await danaWithTrash.restore();
  const restored = await User.findOrFail(4);
  assert.equal(restored.trashed(), false);
}

async function runEventsScenario(context) {
  const { User } = context.models;
  context.eventLog.length = 0;

  const observed = await User.create({
    name: 'Observer Demo',
    email: 'observer@example.com',
    password: 'observer-secret',
    age: 27,
    status: 'active'
  });
  assert.equal(context.eventLog.includes('creating'), true);
  assert.equal(context.eventLog.includes('created'), true);
  assert.equal(context.eventLog.includes('saving'), true);
  assert.equal(context.eventLog.includes('saved'), true);

  context.eventLog.length = 0;
  observed.name = 'Observer Updated';
  await observed.save();
  assert.equal(context.eventLog.includes('updating'), true);
  assert.equal(context.eventLog.includes('updated'), true);

  context.eventLog.length = 0;
  await observed.destroy();
  assert.equal(context.eventLog.includes('deleting'), true);
  assert.equal(context.eventLog.includes('deleted'), true);

  context.eventLog.length = 0;
  const deletedObserved = await User.withTrashed().where('email', 'observer@example.com').first();
  await deletedObserved.restore();
  assert.equal(context.eventLog.includes('restoring'), true);
  assert.equal(context.eventLog.includes('restored'), true);
}

async function runTransactionsScenario(context) {
  const before = await context.db.from('roles').count();

  await context.db.transaction(async (connection) => {
    await connection.insert('roles', { name: 'transaction-role', description: 'Added in transaction' });
  });

  const afterCommit = await context.db.from('roles').count();
  assert.equal(afterCommit, before + 1);

  await assert.rejects(async () => {
    await context.db.transaction(async (connection) => {
      await connection.insert('roles', { name: 'rolled-back-role', description: 'Should rollback' });
      throw new Error('rollback marker');
    });
  }, /rollback marker/);

  const afterRollback = await context.db.from('roles').where('name', 'rolled-back-role').count();
  assert.equal(afterRollback, 0);
}

async function runApiScenario() {
  const adapter = new MockAdapter();
  const { RemotePost } = createApiModels();
  RemotePost.adapter = adapter;

  adapter.onGet(/^\/remote-posts$/).reply(200, {
    data: [
      { id: 1, title: 'Remote published', status: 'published' },
      { id: 2, title: 'Remote draft', status: 'draft' }
    ]
  });
  adapter.onGet(/^\/remote-posts\/1$/).reply(200, { id: 1, title: 'Remote published', status: 'published' });
  adapter.onGet(/^\/remote-posts\/999$/).reply(404, { message: 'missing' });
  adapter.onPost(/^\/remote-posts$/).reply(201, { id: 3, title: 'Created remotely', status: 'draft' });
  adapter.onPatch(/^\/remote-posts\/3$/).reply(200, { id: 3, title: 'Updated remotely', status: 'published' });
  adapter.onDelete(/^\/remote-posts\/3$/).reply(204, {});

  const collection = await RemotePost.get();
  assert.equal(collection.length, 2);

  const remote = await RemotePost.findOrFail(1);
  assert.equal(remote.title, 'Remote published');

  await assert.rejects(async () => {
    await RemotePost.findOrFail(999);
  }, ApiNotFoundError);

  await assert.rejects(async () => {
    await RemotePost.create({ title: 'No' });
  }, ApiValidationError);

  const created = await RemotePost.create({ title: 'Created remotely', status: 'draft' });
  created.title = 'Updated remotely';
  created.status = 'published';
  await created.save();
  assert.equal(created.status, 'published');
  await created.destroy();
}

async function runBackupScenario(context) {
  const manager = new BackupManager(context.db, { backupPath: BACKUP_DIR });

  const fullFile = await manager.full({ filename: 'lab_full.sql' });
  assert.equal(fs.existsSync(fullFile), true);

  DatabaseConnection.enableQueryLog();
  DatabaseConnection.flushQueryLog();
  await context.db.insert('roles', { name: 'journal-role', description: 'Captured in journal' });
  const journalFile = await manager.journal({ filename: 'lab_journal.sql', flush: true });
  DatabaseConnection.disableQueryLog();
  assert.equal(fs.existsSync(journalFile), true);

  const restoreDbFile = path.join(DATA_DIR, 'restore.sqlite');
  if (fs.existsSync(restoreDbFile)) {
    fs.rmSync(restoreDbFile, { force: true });
  }

  const freshDb = new DatabaseConnection({ driver: 'sqlite', database: restoreDbFile });
  await freshDb.connect();
  await bootstrapSchema(freshDb);

  const restoreManager = new BackupManager(freshDb, { backupPath: BACKUP_DIR });
  const sqlContent = fs.readFileSync(fullFile, 'utf8');
  const insertsOnly = sqlContent
    .split('\n')
    .filter((line) => /^\s*INSERT/i.test(line))
    .join('\n');
  const insertsFile = path.join(BACKUP_DIR, 'lab_full_inserts.sql');
  fs.writeFileSync(insertsFile, insertsOnly, 'utf8');

  const restoreResult = await restoreManager.restore(insertsFile);
  assert.equal(restoreResult.statements > 0, true);

  const restoredUsers = await freshDb.from('users').count();
  assert.equal(restoredUsers >= 4, true);
  await freshDb.close();
}

async function runReverseScenario() {
  const sql = `
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      created_at TEXT,
      updated_at TEXT,
      CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `;

  const parsed = parseCreateTable(sql);
  assert.equal(parsed.tableName, 'users');
  assert.equal(parsed.columns.some((column) => column.name === 'email'), true);

  const reversed = reverseFromSql(sql);
  assert.equal(reversed.length, 2);
  assert.equal(reversed.some((migration) => migration.className === 'CreateUsersTable'), true);

  const postTable = parseCreateTable(`
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  const generated = generateMigration(postTable);
  assert.equal(generated.code.includes("table.foreign('user_id').references('id').on('users')"), true);
  assert.equal(generated.code.includes('.name('), false);
}

async function runAiAndMcpScenario() {
  const savedAgentFlag = process.env.COPILOT_AGENT_MODE;
  const savedConsent = process.env.OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION;

  try {
    process.env.COPILOT_AGENT_MODE = '1';
    delete process.env.OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION;

    const detected = AISafetyGuardrails.detectAgent();
    assert.equal(detected.detected, true);
    assert.equal(detected.agentName, 'GitHub Copilot');

    const blocked = AISafetyGuardrails.validateDestructiveAction('reset');
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.message.includes(AISafetyGuardrails.CONSENT_ENV_VAR), true);

    process.env.OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION = 'User approved lab reset';
    const allowed = AISafetyGuardrails.validateDestructiveAction('reset');
    assert.equal(allowed.allowed, true);
  } finally {
    if (savedAgentFlag === undefined) {
      delete process.env.COPILOT_AGENT_MODE;
    } else {
      process.env.COPILOT_AGENT_MODE = savedAgentFlag;
    }

    if (savedConsent === undefined) {
      delete process.env.OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION;
    } else {
      process.env.OUTLET_USER_CONSENT_FOR_DANGEROUS_AI_ACTION = savedConsent;
    }
  }

  const blueprint = PromptGenerator.parse('Create a blog with posts, comments and tags');
  assert.equal(blueprint.domain, 'blog');
  assert.equal(blueprint.tables.posts != null, true);

  const generationRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'outlet-labo-ai-'));
  try {
    const modelFiles = PromptGenerator.generateModels(blueprint, path.join(generationRoot, 'models'));
    const migrationFiles = PromptGenerator.generateMigrations(blueprint, path.join(generationRoot, 'migrations'));
    const seederFile = PromptGenerator.generateSeeder(blueprint, path.join(generationRoot, 'seeds'));

    assert.equal(modelFiles.length > 0, true);
    assert.equal(migrationFiles.length > 0, true);
    assert.equal(fs.existsSync(seederFile), true);
  } finally {
    fs.rmSync(generationRoot, { recursive: true, force: true });
  }

  const server = new MCPServer({
    projectDir: path.join(__dirname, '..', '..'),
    safetyGuardrails: true
  });

  try {
    const handle = server.handler();
    const init = await handle({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {}
    });
    assert.equal(init.result.serverInfo.name, 'outlet-orm');

    const listed = await handle({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    });
    const toolNames = listed.result.tools.map((tool) => tool.name);
    assert.equal(toolNames.includes('migrate_status'), true);
    assert.equal(toolNames.includes('backup_restore'), true);

    const guarded = await handle({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'migrate_reset',
        arguments: {}
      }
    });
    assert.equal(guarded.result.isError, true);
    assert.equal(guarded.result.content[0].text.includes('SAFETY GUARDRAIL'), true);
  } finally {
    await server.close();
  }
}

async function runScenario(name, task) {
  const startedAt = Date.now();
  await task();
  return {
    name,
    durationMs: Date.now() - startedAt
  };
}

async function runLab(options = {}) {
  const context = await createContext(options);

  try {
    const scenarios = [
      ['Schema + migration helpers', () => runMigrationScenario(context)],
      ['Active Record CRUD + validation', () => runCrudScenario(context)],
      ['Query builder', () => runQueryScenario(context)],
      ['Relations + eager loading', () => runRelationsScenario(context)],
      ['Scopes + soft deletes', () => runScopesAndSoftDeletesScenario(context)],
      ['Events + observers', () => runEventsScenario(context)],
      ['Transactions', () => runTransactionsScenario(context)],
      ['API layer (MockAdapter)', () => runApiScenario()],
      ['Backup manager', () => runBackupScenario(context)],
      ['Reverse / CLI core', () => runReverseScenario()],
      ['AI + MCP local surfaces', () => runAiAndMcpScenario()]
    ];

    const results = [];
    for (const [name, task] of scenarios) {
      results.push(await runScenario(name, task));
    }

    return {
      paths: context.paths,
      totalScenarios: results.length,
      results
    };
  } finally {
    await context.db.close();
  }
}

module.exports = {
  LAB_ROOT,
  DATA_DIR,
  DB_FILE,
  BACKUP_DIR,
  createContext,
  runLab
};

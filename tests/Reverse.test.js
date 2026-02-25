'use strict';

/**
 * Tests for bin/reverse.js — Database Reverse Engineering Tool
 *
 * Coverage:
 *   • parseCreateTable  — MySQL, SQLite and PostgreSQL CREATE TABLE dialects
 *   • columnToBlueprint — full type-mapping matrix + modifiers
 *   • generateMigration — up() / down() code generation
 *   • generateSeeder    — row data serialisation
 *   • reverseFromSql    — batch SQL dump processing
 *   • Integration       — SQLite in-memory DB → parse → generate
 */

const path = require('path');
const DatabaseConnection = require('../src/DatabaseConnection');

const {
  parseCreateTable,
  columnToBlueprint,
  generateMigration,
  generateSeeder,
  reverseFromSql,
} = require('../bin/reverse');

// ─── parseCreateTable ─────────────────────────────────────────────────────────

describe('parseCreateTable', () => {

  test('parses a basic MySQL CREATE TABLE', () => {
    const sql = `
      CREATE TABLE \`users\` (
        \`id\`         int(11)      NOT NULL AUTO_INCREMENT,
        \`name\`       varchar(255) NOT NULL,
        \`email\`      varchar(255) UNIQUE,
        \`created_at\` timestamp    NULL,
        \`updated_at\` timestamp    NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    const result = parseCreateTable(sql);

    expect(result).not.toBeNull();
    expect(result.tableName).toBe('users');
    expect(result.columns.length).toBe(5);

    const id = result.columns.find(c => c.name === 'id');
    expect(id.autoIncrement).toBe(true);
    expect(id.nullable).toBe(false);

    const email = result.columns.find(c => c.name === 'email');
    expect(email.unique).toBe(true);
  });

  test('parses SQLite CREATE TABLE', () => {
    const sql = `
      CREATE TABLE posts (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title   TEXT    NOT NULL,
        body    TEXT,
        created_at TEXT,
        updated_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `;
    const result = parseCreateTable(sql);

    expect(result.tableName).toBe('posts');
    expect(result.columns.length).toBe(6);

    const id = result.columns.find(c => c.name === 'id');
    expect(id.autoIncrement).toBe(true);
    expect(id.primary).toBe(true);

    const body = result.columns.find(c => c.name === 'body');
    expect(body.nullable).toBe(true);

    expect(result.foreignKeys.length).toBe(1);
    expect(result.foreignKeys[0].column).toBe('user_id');
    expect(result.foreignKeys[0].referencedTable).toBe('users');
    expect(result.foreignKeys[0].referencedColumn).toBe('id');
  });

  test('parses explicit CONSTRAINT … FOREIGN KEY', () => {
    const sql = `
      CREATE TABLE orders (
        id         INT PRIMARY KEY AUTO_INCREMENT,
        customer_id INT NOT NULL,
        CONSTRAINT fk_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
      );
    `;
    const result = parseCreateTable(sql);
    expect(result.foreignKeys.length).toBe(1);
    expect(result.foreignKeys[0].column).toBe('customer_id');
    expect(result.foreignKeys[0].referencedTable).toBe('customers');
  });

  test('parses DEFAULT values', () => {
    const sql = `
      CREATE TABLE config (
        id    INT PRIMARY KEY AUTO_INCREMENT,
        score INT NOT NULL DEFAULT 0,
        label VARCHAR(50) DEFAULT 'active'
      );
    `;
    const result = parseCreateTable(sql);
    const score = result.columns.find(c => c.name === 'score');
    const label = result.columns.find(c => c.name === 'label');

    expect(score.default).toBe('0');
    expect(label.default).toBe('active');
  });

  test('returns null for empty or non-CREATE string', () => {
    expect(parseCreateTable('')).toBeNull();
    expect(parseCreateTable(null)).toBeNull();
    expect(parseCreateTable('INSERT INTO foo VALUES (1)')).toBeNull();
    expect(parseCreateTable('SELECT * FROM bar')).toBeNull();
  });
});

// ─── columnToBlueprint ────────────────────────────────────────────────────────

describe('columnToBlueprint', () => {

  function col(overrides) {
    return {
      name: 'field', type: 'varchar(255)',
      nullable: false, autoIncrement: false,
      primary: false, unique: false, default: null,
      ...overrides
    };
  }

  // ── Auto-increment primary key ───────────────────────────────────────────
  test('INTEGER primary key autoincrement → increments', () => {
    const bp = columnToBlueprint(col({ name: 'id', type: 'INTEGER', primary: true, autoIncrement: true }));
    expect(bp.method).toBe('increments');
    expect(bp.args).toContain("'id'");
    expect(bp.modifiers).toEqual([]);
  });

  test('BIGINT autoincrement → bigIncrements', () => {
    const bp = columnToBlueprint(col({ name: 'id', type: 'bigint', autoIncrement: true }));
    expect(bp.method).toBe('bigIncrements');
  });

  // ── Integer types ────────────────────────────────────────────────────────
  test('int → integer', () => {
    const bp = columnToBlueprint(col({ type: 'int' }));
    expect(bp.method).toBe('integer');
  });

  test('smallint → smallInteger', () => {
    const bp = columnToBlueprint(col({ type: 'smallint' }));
    expect(bp.method).toBe('smallInteger');
  });

  test('tinyint(1) → boolean', () => {
    const bp = columnToBlueprint(col({ type: 'tinyint(1)' }));
    expect(bp.method).toBe('boolean');
  });

  test('tinyint(4) → tinyInteger', () => {
    const bp = columnToBlueprint(col({ type: 'tinyint(4)' }));
    expect(bp.method).toBe('tinyInteger');
  });

  // ── Float / decimal ──────────────────────────────────────────────────────
  test('float → float', () => {
    const bp = columnToBlueprint(col({ type: 'float' }));
    expect(bp.method).toBe('float');
  });

  test('decimal(10,2) → decimal with precision and scale', () => {
    const bp = columnToBlueprint(col({ type: 'decimal(10,2)' }));
    expect(bp.method).toBe('decimal');
    expect(bp.args).toContain(10);
    expect(bp.args).toContain(2);
  });

  // ── String types ─────────────────────────────────────────────────────────
  test('varchar(191) → string with length 191', () => {
    const bp = columnToBlueprint(col({ type: 'varchar(191)' }));
    expect(bp.method).toBe('string');
    expect(bp.args).toContain(191);
  });

  test('varchar (no length) → string 255', () => {
    const bp = columnToBlueprint(col({ type: 'varchar' }));
    expect(bp.method).toBe('string');
    expect(bp.args).toContain(255);
  });

  test('text → text', () => {
    const bp = columnToBlueprint(col({ type: 'TEXT' }));
    expect(bp.method).toBe('text');
  });

  test('longtext → text', () => {
    const bp = columnToBlueprint(col({ type: 'longtext' }));
    expect(bp.method).toBe('text');
  });

  // ── Date / time types ────────────────────────────────────────────────────
  test('date → date', () => {
    const bp = columnToBlueprint(col({ type: 'date' }));
    expect(bp.method).toBe('date');
  });

  test('datetime → dateTime', () => {
    const bp = columnToBlueprint(col({ type: 'datetime' }));
    expect(bp.method).toBe('dateTime');
  });

  test('timestamp → timestamp', () => {
    const bp = columnToBlueprint(col({ type: 'timestamp' }));
    expect(bp.method).toBe('timestamp');
  });

  // ── Special types ────────────────────────────────────────────────────────
  test('json → json', () => {
    const bp = columnToBlueprint(col({ type: 'json' }));
    expect(bp.method).toBe('json');
  });

  test('jsonb → json', () => {
    const bp = columnToBlueprint(col({ type: 'jsonb' }));
    expect(bp.method).toBe('json');
  });

  test('uuid → uuid', () => {
    const bp = columnToBlueprint(col({ type: 'uuid' }));
    expect(bp.method).toBe('uuid');
  });

  test('unknown type → string fallback', () => {
    const bp = columnToBlueprint(col({ type: 'geometry' }));
    expect(bp.method).toBe('string');
  });

  // ── Modifiers ────────────────────────────────────────────────────────────
  test('nullable adds nullable() modifier', () => {
    const bp = columnToBlueprint(col({ type: 'TEXT', nullable: true }));
    expect(bp.modifiers).toContain('nullable()');
  });

  test('unique adds unique() modifier', () => {
    const bp = columnToBlueprint(col({ type: 'varchar(255)', unique: true }));
    expect(bp.modifiers).toContain('unique()');
  });

  test('default value adds default() modifier (numeric)', () => {
    const bp = columnToBlueprint(col({ type: 'int', default: '0' }));
    expect(bp.modifiers.some(m => m.startsWith('default('))).toBe(true);
    expect(bp.modifiers.find(m => m.includes('0'))).toBeTruthy();
  });

  test('default value adds default() modifier (string)', () => {
    const bp = columnToBlueprint(col({ type: 'varchar(50)', default: 'active' }));
    expect(bp.modifiers.some(m => m.includes("'active'"))).toBe(true);
  });

  test('primary key does NOT get nullable modifier', () => {
    const bp = columnToBlueprint(col({ name: 'id', type: 'INTEGER', primary: true, autoIncrement: true, nullable: false }));
    expect(bp.modifiers).toEqual([]);
  });
});

// ─── generateMigration ────────────────────────────────────────────────────────

describe('generateMigration', () => {

  const usersTableInfo = {
    tableName: 'users',
    columns:   [
      { name: 'id',         type: 'INTEGER',      primary: true,  autoIncrement: true,  nullable: false, unique: false, default: null },
      { name: 'name',       type: 'varchar(200)',  primary: false, autoIncrement: false, nullable: false, unique: false, default: null },
      { name: 'email',      type: 'varchar(255)',  primary: false, autoIncrement: false, nullable: false, unique: true,  default: null },
      { name: 'created_at', type: 'timestamp',     primary: false, autoIncrement: false, nullable: true,  unique: false, default: null },
      { name: 'updated_at', type: 'timestamp',     primary: false, autoIncrement: false, nullable: true,  unique: false, default: null },
    ],
    foreignKeys: [],
  };

  test('filename has correct timestamp format', () => {
    const { filename } = generateMigration(usersTableInfo);
    expect(filename).toMatch(/^\d{8}_\d{6}_create_users_table\.js$/);
  });

  test('className is PascalCase', () => {
    const { className } = generateMigration(usersTableInfo);
    expect(className).toBe('CreateUsersTable');
  });

  test('multi-word table name becomes PascalCase', () => {
    const info = { tableName: 'blog_posts', columns: [], foreignKeys: [] };
    const { className } = generateMigration(info);
    expect(className).toBe('CreateBlogPostsTable');
  });

  test('generated code contains class declaration', () => {
    const { code } = generateMigration(usersTableInfo);
    expect(code).toContain("class CreateUsersTable");
    expect(code).toContain("module.exports");
  });

  test('up() creates table via schema.create()', () => {
    const { code } = generateMigration(usersTableInfo);
    expect(code).toContain("schema.create('users'");
  });

  test('down() drops table via schema.dropIfExists()', () => {
    const { code } = generateMigration(usersTableInfo);
    expect(code).toContain("schema.dropIfExists('users')");
  });

  test('increments call for auto-increment primary key', () => {
    const { code } = generateMigration(usersTableInfo);
    expect(code).toContain("table.increments('id')");
  });

  test('string call with correct length', () => {
    const { code } = generateMigration(usersTableInfo);
    expect(code).toContain("table.string('name', 200)");
  });

  test('timestamps shorthand replaces individual created_at/updated_at', () => {
    const { code } = generateMigration(usersTableInfo);
    expect(code).toContain('table.timestamps()');
    expect(code).not.toContain("table.timestamp('created_at')");
    expect(code).not.toContain("table.timestamp('updated_at')");
  });

  test('nullable modifier is emitted inline', () => {
    const info = {
      tableName: 'articles',
      columns:   [
        { name: 'id',   type: 'INTEGER', primary: true,  autoIncrement: true,  nullable: false, unique: false, default: null },
        { name: 'body', type: 'TEXT',    primary: false, autoIncrement: false, nullable: true,  unique: false, default: null },
      ],
      foreignKeys: [],
    };
    const { code } = generateMigration(info);
    expect(code).toContain("table.text('body').nullable()");
  });

  test('unique modifier is emitted inline', () => {
    const { code } = generateMigration(usersTableInfo);
    expect(code).toContain("table.string('email', 255).unique()");
  });

  test('foreign key constraint line is emitted', () => {
    const info = {
      tableName: 'posts',
      columns: [
        { name: 'id',      type: 'INTEGER', primary: true,  autoIncrement: true,  nullable: false, unique: false, default: null },
        { name: 'user_id', type: 'INTEGER', primary: false, autoIncrement: false, nullable: false, unique: false, default: null },
      ],
      foreignKeys: [{ column: 'user_id', referencedTable: 'users', referencedColumn: 'id' }],
    };
    const { code } = generateMigration(info);
    expect(code).toContain("table.foreign('user_id').references('id').on('users')");
  });

  test('requires outlet-orm', () => {
    const { code } = generateMigration(usersTableInfo);
    expect(code).toContain("require('outlet-orm')");
  });

  test('both up() and down() method signatures present', () => {
    const { code } = generateMigration(usersTableInfo);
    expect(code).toContain('async up(schema)');
    expect(code).toContain('async down(schema)');
  });
});

// ─── generateSeeder ───────────────────────────────────────────────────────────

describe('generateSeeder', () => {

  const sampleRows = [
    { id: 1, name: 'Alice',   email: 'alice@example.com' },
    { id: 2, name: 'Bob',     email: 'bob@example.com'   },
    { id: 3, name: "D'Arcy",  email: 'darcy@example.com' },
  ];

  test('filename is <tableName>_seeder.js', () => {
    const { filename } = generateSeeder('users', sampleRows);
    expect(filename).toBe('users_seeder.js');
  });

  test('className is PascalCase + Seeder', () => {
    const { className } = generateSeeder('users', sampleRows);
    expect(className).toBe('UsersSeeder');
  });

  test('multi-word table name → PascalCase', () => {
    const { className } = generateSeeder('blog_posts', []);
    expect(className).toBe('BlogPostsSeeder');
  });

  test('class declaration present', () => {
    const { code } = generateSeeder('users', sampleRows);
    expect(code).toContain('class UsersSeeder');
  });

  test('run() method iterates and inserts', () => {
    const { code } = generateSeeder('users', sampleRows);
    expect(code).toContain('async run(db)');
    expect(code).toContain("db.table('users').insert(row)");
  });

  test('all row data is serialised', () => {
    const { code } = generateSeeder('users', sampleRows);
    expect(code).toContain('Alice');
    expect(code).toContain('bob@example.com');
  });

  test('module.exports at end', () => {
    const { code } = generateSeeder('users', sampleRows);
    expect(code).toContain('module.exports');
  });

  test('handles empty rows array', () => {
    const { code } = generateSeeder('categories', []);
    expect(code).toContain('class CategoriesSeeder');
    expect(code).toContain('[]');
  });
});

// ─── reverseFromSql ───────────────────────────────────────────────────────────

describe('reverseFromSql', () => {

  test('returns one migration per CREATE TABLE statement', () => {
    const sql = `
      CREATE TABLE users (
        id   INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );

      CREATE TABLE posts (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title   TEXT NOT NULL
      );
    `;
    const migrations = reverseFromSql(sql);
    expect(migrations.length).toBe(2);
    expect(migrations.map(m => m.className)).toContain('CreateUsersTable');
    expect(migrations.map(m => m.className)).toContain('CreatePostsTable');
  });

  test('returns empty array for SQL with no CREATE TABLE', () => {
    expect(reverseFromSql("INSERT INTO foo VALUES (1);")).toEqual([]);
    expect(reverseFromSql("")).toEqual([]);
    expect(reverseFromSql(null)).toEqual([]);
  });

  test('each migration has filename, className and code', () => {
    const sql = `CREATE TABLE tags (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT);`;
    const [mig] = reverseFromSql(sql);
    expect(mig).toHaveProperty('filename');
    expect(mig).toHaveProperty('className');
    expect(mig).toHaveProperty('code');
  });
});

// ─── Integration — SQLite in-memory ──────────────────────────────────────────

describe('Integration: SQLite in-memory → migrate', () => {
  let db;

  // Raw CREATE TABLE strings to create and then reverse-engineer
  const CREATE_USERS = `
    CREATE TABLE users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL,
      score      REAL,
      created_at TEXT,
      updated_at TEXT
    )
  `;

  const CREATE_POSTS = `
    CREATE TABLE posts (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      title      TEXT    NOT NULL,
      body       TEXT,
      published  INTEGER NOT NULL DEFAULT 0,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `;

  beforeAll(async () => {
    db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await db.connect();
    await db.execute(CREATE_USERS);
    await db.execute(CREATE_POSTS);
    // Insert sample rows
    await db.execute("INSERT INTO users (name, email, score) VALUES ('Alice', 'alice@example.com', 9.5)");
    await db.execute("INSERT INTO users (name, email, score) VALUES ('Bob',   'bob@example.com',   7.0)");
    await db.execute("INSERT INTO posts (user_id, title, body, published) VALUES (1, 'Hello', 'World', 1)");
  });

  afterAll(async () => {
    await db.close();
  });

  test('parseCreateTable correctly parses the users CREATE TABLE', () => {
    const info = parseCreateTable(CREATE_USERS);
    expect(info.tableName).toBe('users');
    const colNames = info.columns.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('email');
    expect(colNames).toContain('score');
    expect(colNames).toContain('created_at');
    expect(colNames).toContain('updated_at');
  });

  test('parseCreateTable correctly parses the posts CREATE TABLE (with FK)', () => {
    const info = parseCreateTable(CREATE_POSTS);
    expect(info.tableName).toBe('posts');
    expect(info.foreignKeys.length).toBe(1);
    expect(info.foreignKeys[0].column).toBe('user_id');
    expect(info.foreignKeys[0].referencedTable).toBe('users');
  });

  test('generateMigration for users produces valid up() / down() code', () => {
    const info = parseCreateTable(CREATE_USERS);
    const { code } = generateMigration(info);

    expect(code).toContain("schema.create('users'");
    expect(code).toContain("table.increments('id')");
    expect(code).toContain("table.text('name')");
    expect(code).toContain("table.text('email')");
    expect(code).toContain("table.float('score')");
    expect(code).toContain('table.timestamps()');
    expect(code).toContain("schema.dropIfExists('users')");
  });

  test('generateMigration for posts includes FK constraint', () => {
    const info = parseCreateTable(CREATE_POSTS);
    const { code } = generateMigration(info);

    expect(code).toContain("table.integer('user_id')");
    expect(code).toContain("table.foreign('user_id').references('id').on('users')");
    expect(code).toContain("table.integer('published').default(0)");
    expect(code).toContain('table.timestamps()');
  });

  test('generated migration code parses as valid JavaScript', () => {
    const info = parseCreateTable(CREATE_USERS);
    const { code } = generateMigration(info);
    // new Function() parses JS without executing it
    expect(() => new Function(code)).not.toThrow();
  });

  test('generateSeeder from actual DB rows', async () => {
    // Fetch rows from the live SQLite DB
    const rows = await db.execute("SELECT * FROM users");
    // db.execute returns { rows } or the rows directly depending on driver
    const actualRows = Array.isArray(rows) ? rows : (rows.rows || []);

    const { code, className } = generateSeeder('users', actualRows);
    expect(className).toBe('UsersSeeder');
    expect(code).toContain('Alice');
    expect(code).toContain('bob@example.com');
    expect(() => new Function(code)).not.toThrow();
  });

  test('reverseFromSql round-trip on a SQL dump', () => {
    const dump = `
      ${CREATE_USERS};
      ${CREATE_POSTS};
    `;
    const migrations = reverseFromSql(dump);
    expect(migrations.length).toBe(2);

    const usersM = migrations.find(m => m.className === 'CreateUsersTable');
    const postsM  = migrations.find(m => m.className === 'CreatePostsTable');

    expect(usersM).toBeDefined();
    expect(postsM).toBeDefined();

    expect(() => new Function(usersM.code)).not.toThrow();
    expect(() => new Function(postsM.code)).not.toThrow();
  });
});

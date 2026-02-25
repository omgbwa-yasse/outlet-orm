#!/usr/bin/env node
'use strict';

/**
 * Outlet ORM — Database Reverse Engineering Tool
 *
 * Introspects an existing database (or SQL dump file) and generates:
 *   • Migration files  (up/down using Schema Blueprint methods)
 *   • Seeder files     (INSERT rows fetched from each table)
 *
 * Usage (CLI):  node bin/reverse.js
 * Usage (API):  const { parseCreateTable, generateMigration, generateSeeder } = require('./bin/reverse');
 */

const fs   = require('fs');
const path = require('path');

// readline is only initialised when running as a CLI (not when required as a lib)
let rl;
function getRL() {
  if (!rl) {
    const readline = require('readline');
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return rl;
}
function question(q) { return new Promise(resolve => getRL().question(q, resolve)); }

// ─── SQL Parser ───────────────────────────────────────────────────────────────

/**
 * Split the body of a CREATE TABLE statement into individual definition lines,
 * respecting nested parentheses (ENUM values, CHECK expressions, etc.).
 *
 * @param  {string}   body  Text between the outermost ( … )
 * @returns {string[]}
 */
function splitDefinitions(body) {
  const lines = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if      (ch === '(') { depth++;  current += ch; }
    else if (ch === ')') { depth--;  current += ch; }
    else if (ch === ',' && depth === 0) { lines.push(current.trim()); current = ''; }
    else                               { current += ch; }
  }
  if (current.trim()) lines.push(current.trim());
  return lines;
}

/**
 * Parse a CREATE TABLE statement into a structured object.
 * Handles MySQL, PostgreSQL, and SQLite dialects.
 *
 * @param  {string} sql  Raw CREATE TABLE SQL (single statement)
 * @returns {{ tableName: string, columns: object[], foreignKeys: object[] } | null}
 */
function parseCreateTable(sql) {
  if (!sql || typeof sql !== 'string') return null;

  // Strip single-line and block comments
  sql = sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

  const tableMatch = sql.match(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"[]?(\w+)[`"\]]?\s*\(/i
  );
  if (!tableMatch) return null;

  const tableName = tableMatch[1];
  const columns   = [];
  const foreignKeys = [];

  // Extract body between outermost parens
  const bodyStart = sql.indexOf('(', tableMatch.index) + 1;
  const bodyEnd   = sql.lastIndexOf(')');
  if (bodyStart <= 0 || bodyEnd < 0) return null;
  const body = sql.slice(bodyStart, bodyEnd);

  for (const line of splitDefinitions(body)) {
    const trimmed  = line.trim();
    if (!trimmed) continue;
    const upperTrimmed = trimmed.toUpperCase();

    // ── Table-level FOREIGN KEY constraint ───────────────────────────────────
    if (/^FOREIGN\s+KEY/i.test(trimmed) || /^CONSTRAINT\s+\S+\s+FOREIGN\s+KEY/i.test(trimmed)) {
      const fkMatch = trimmed.match(
        /FOREIGN\s+KEY\s*\(`?(\w+)`?\)\s*REFERENCES\s+`?(\w+)`?\s*\(`?(\w+)`?\)/i
      );
      if (fkMatch) {
        foreignKeys.push({
          column:            fkMatch[1],
          referencedTable:   fkMatch[2],
          referencedColumn:  fkMatch[3]
        });
      }
      continue;
    }

    // ── Skip other table-level constraints and index declarations ─────────────
    if (/^(PRIMARY\s+KEY|UNIQUE\s+(KEY|INDEX)?|KEY\s|INDEX\s|CHECK\s|CONSTRAINT\s)/i.test(trimmed)) {
      continue;
    }

    // ── Column definition ─────────────────────────────────────────────────────
    // Pattern: [`"]?colname[`"]?   TYPE(params)   ...rest...
    const colMatch = trimmed.match(/^[`"[]?(\w+)[`"\]]?\s+(\w+(?:\s*\([^)]+\))?)\s*([\s\S]*)/i);
    if (!colMatch) continue;

    const [, name, rawType, rest] = colMatch;
    const restUpper = rest.toUpperCase();

    // Safety: skip if "name" is a reserved SQL keyword used at table level
    if (['PRIMARY', 'UNIQUE', 'KEY', 'INDEX', 'CONSTRAINT', 'FOREIGN',
         'CHECK', 'FULLTEXT', 'SPATIAL'].includes(name.toUpperCase())) {
      continue;
    }

    const col = {
      name,
      type:          rawType.trim(),
      nullable:      !restUpper.includes('NOT NULL'),
      autoIncrement: restUpper.includes('AUTO_INCREMENT') || restUpper.includes('AUTOINCREMENT'),
      primary:       restUpper.includes('PRIMARY KEY'),
      unique:        /\bUNIQUE\b/.test(restUpper) && !/\bUNIQUE\s+KEY\b/.test(restUpper),
      unsigned:      restUpper.includes('UNSIGNED'),
      default:       null
    };

    // Extract DEFAULT value (handles quoted strings and bare values)
    const defMatch = rest.match(/DEFAULT\s+('(?:[^'\\]|\\.)*'|\S+)/i);
    if (defMatch) {
      col.default = defMatch[1].replace(/^'|'$/g, '');
    }

    columns.push(col);
  }

  return { tableName, columns, foreignKeys };
}

// ─── Blueprint Mapper ─────────────────────────────────────────────────────────

/**
 * Map a parsed column object → a Schema Blueprint call descriptor.
 *
 * @param  {object} col  Column object from parseCreateTable
 * @returns {{ method: string, args: any[], modifiers: string[] }}
 */
function columnToBlueprint(col) {
  const rawType   = col.type || '';
  const typeLower = rawType.toLowerCase();

  // Parse base type and optional numeric parameters
  const paramMatch = rawType.match(/\(([^)]+)\)/);
  const params     = paramMatch ? paramMatch[1].split(',').map(s => s.trim()) : [];
  const baseType   = typeLower.replace(/\s*\([^)]+\)/, '').replace(/\s+unsigned$/i, '').trim();

  // Build modifier chain
  const modifiers = [];
  const isKey = col.primary || col.autoIncrement;
  if (!isKey && col.nullable)                  modifiers.push('nullable()');
  if (!isKey && col.unique)                    modifiers.push('unique()');
  if (!isKey && col.default !== null && col.default !== undefined) {
    const defVal = /^-?\d+(\.\d+)?$/.test(String(col.default))
      ? col.default
      : `'${col.default}'`;
    modifiers.push(`default(${defVal})`);
  }

  // ── Auto-increment primary keys ───────────────────────────────────────────
  if (col.autoIncrement || (col.primary && col.name === 'id')) {
    if (baseType === 'bigint' || baseType === 'bigserial') {
      return { method: 'bigIncrements', args: [`'${col.name}'`], modifiers: [] };
    }
    return { method: 'increments', args: [`'${col.name}'`], modifiers: [] };
  }

  // ── Numeric types ────────────────────────────────────────────────────────
  if (baseType === 'tinyint') {
    if (params[0] === '1') return { method: 'boolean',     args: [`'${col.name}'`], modifiers };
    return                       { method: 'tinyInteger',  args: [`'${col.name}'`], modifiers };
  }
  if (baseType === 'smallint')
    return { method: 'smallInteger', args: [`'${col.name}'`], modifiers };
  if (baseType === 'mediumint')
    return { method: 'integer',      args: [`'${col.name}'`], modifiers };
  if (baseType === 'int' || baseType === 'integer')
    return { method: 'integer',      args: [`'${col.name}'`], modifiers };
  if (baseType === 'bigint')
    return { method: 'bigInteger',   args: [`'${col.name}'`], modifiers };
  if (baseType === 'serial')
    return { method: 'increments',   args: [`'${col.name}'`], modifiers: [] };
  if (baseType === 'bigserial')
    return { method: 'bigIncrements',args: [`'${col.name}'`], modifiers: [] };
  if (baseType === 'float' || baseType === 'double' || baseType === 'real' ||
      baseType === 'double precision')
    return { method: 'float',        args: [`'${col.name}'`], modifiers };
  if (baseType === 'decimal' || baseType === 'numeric') {
    const bpArgs = [`'${col.name}'`];
    if (params.length >= 1) bpArgs.push(parseInt(params[0], 10));
    if (params.length >= 2) bpArgs.push(parseInt(params[1], 10));
    return { method: 'decimal', args: bpArgs, modifiers };
  }
  if (baseType === 'boolean' || baseType === 'bool')
    return { method: 'boolean', args: [`'${col.name}'`], modifiers };

  // ── String types ──────────────────────────────────────────────────────────
  if (baseType === 'varchar' || baseType === 'character varying' || baseType === 'nvarchar') {
    const len = params[0] ? parseInt(params[0], 10) : 255;
    return { method: 'string', args: [`'${col.name}'`, len], modifiers };
  }
  if (baseType === 'char' || baseType === 'character') {
    const len = params[0] ? parseInt(params[0], 10) : 1;
    return { method: 'char', args: [`'${col.name}'`, len], modifiers };
  }
  if (baseType === 'text' || baseType === 'mediumtext' ||
      baseType === 'longtext' || baseType === 'tinytext' || baseType === 'clob')
    return { method: 'text',   args: [`'${col.name}'`], modifiers };
  if (baseType === 'blob' || baseType === 'mediumblob' || baseType === 'longblob' ||
      baseType === 'tinyblob' || baseType === 'bytea'  || baseType === 'binary'   ||
      baseType === 'varbinary')
    return { method: 'binary', args: [`'${col.name}'`], modifiers };

  // ── Date / time types ─────────────────────────────────────────────────────
  if (baseType === 'date')
    return { method: 'date',     args: [`'${col.name}'`], modifiers };
  if (baseType === 'datetime')
    return { method: 'dateTime', args: [`'${col.name}'`], modifiers };
  if (baseType === 'timestamp' || baseType === 'timestamptz')
    return { method: 'timestamp',args: [`'${col.name}'`], modifiers };
  if (baseType === 'time' || baseType === 'timetz')
    return { method: 'time',     args: [`'${col.name}'`], modifiers };
  if (baseType === 'year')
    return { method: 'year',     args: [`'${col.name}'`], modifiers };

  // ── JSON / UUID / Enum ────────────────────────────────────────────────────
  if (baseType === 'json' || baseType === 'jsonb')
    return { method: 'json',   args: [`'${col.name}'`], modifiers };
  if (baseType === 'uuid')
    return { method: 'uuid',   args: [`'${col.name}'`], modifiers };
  if (baseType === 'enum') {
    // Fallback: store as string, pick length from longest enum value
    const maxLen = params.reduce((acc, p) => Math.max(acc, p.replace(/['"]/g, '').length), 50);
    return { method: 'string', args: [`'${col.name}'`, maxLen], modifiers };
  }

  // Fallback
  return { method: 'string', args: [`'${col.name}'`], modifiers };
}

// ─── Migration Generator ──────────────────────────────────────────────────────

/**
 * Generate a complete Migration class from a parsed table definition.
 *
 * @param  {object} tableInfo  Output of parseCreateTable
 * @returns {{ filename: string, className: string, code: string }}
 */
function generateMigration(tableInfo) {
  const { tableName, columns = [], foreignKeys = [] } = tableInfo;

  // Timestamp prefix  YYYYMMDD_HHmmss
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const ts  = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
            + `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  // PascalCase class name:  blog_posts → CreateBlogPostsTable
  const className = 'Create'
    + tableName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('')
    + 'Table';

  // Detect timestamps shorthand
  const useTimestamps = columns.some(c => c.name === 'created_at') &&
                        columns.some(c => c.name === 'updated_at');

  // Build up() body lines
  const upLines = [];
  for (const col of columns) {
    if (useTimestamps && (col.name === 'created_at' || col.name === 'updated_at')) continue;

    const bp     = columnToBlueprint(col);
    const argsStr = bp.args.join(', ');
    let line      = `table.${bp.method}(${argsStr})`;

    for (const mod of bp.modifiers) {
      line += `.${mod}`;
    }
    upLines.push(`      ${line};`);
  }

  // Explicit foreign key constraints
  for (const fk of foreignKeys) {
    upLines.push(
      `      table.foreign('${fk.column}')`
      + `.references('${fk.referencedColumn}')`
      + `.on('${fk.referencedTable}');`
    );
  }

  if (useTimestamps) {
    upLines.push(`      table.timestamps();`);
  }

  const code = [
    `const { Schema } = require('outlet-orm');`,
    ``,
    `class ${className} {`,
    `  async up(schema) {`,
    `    await schema.create('${tableName}', (table) => {`,
    ...upLines,
    `    });`,
    `  }`,
    ``,
    `  async down(schema) {`,
    `    await schema.dropIfExists('${tableName}');`,
    `  }`,
    `}`,
    ``,
    `module.exports = new ${className}();`,
    ``
  ].join('\n');

  return {
    filename:  `${ts}_create_${tableName}_table.js`,
    className,
    code
  };
}

// ─── Seeder Generator ─────────────────────────────────────────────────────────

/**
 * Generate a Seeder class from a table name and an array of row objects.
 *
 * @param  {string}   tableName
 * @param  {object[]} rows
 * @returns {{ filename: string, className: string, code: string }}
 */
function generateSeeder(tableName, rows) {
  const className = tableName
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('') + 'Seeder';

  const rowsJson = JSON.stringify(rows, null, 4);

  const code = [
    `class ${className} {`,
    `  async run(db) {`,
    `    const rows = ${rowsJson};`,
    `    for (const row of rows) {`,
    `      await db.table('${tableName}').insert(row);`,
    `    }`,
    `  }`,
    `}`,
    ``,
    `module.exports = new ${className}();`,
    ``
  ].join('\n');

  return {
    filename:  `${tableName}_seeder.js`,
    className,
    code
  };
}

// ─── Batch helpers ────────────────────────────────────────────────────────────

/**
 * Parse a full SQL dump (multiple CREATE TABLE statements) and return
 * migration objects for every table found.
 *
 * @param  {string} sql
 * @returns {Array<{ filename: string, className: string, code: string }>}
 */
function reverseFromSql(sql) {
  if (!sql || typeof sql !== 'string') return [];
  const regex = /CREATE\s+TABLE\s+[\s\S]*?;/gi;
  const stmts = sql.match(regex) || [];
  return stmts
    .map(stmt => parseCreateTable(stmt))
    .filter(Boolean)
    .map(info => generateMigration(info));
}

// ─── Database connection helpers ──────────────────────────────────────────────

async function getDatabaseConfig() {
  const driver = (await question('Driver (mysql/postgres/sqlite): ')).trim().toLowerCase();
  const config  = { driver };

  if (driver === 'mysql') {
    config.host     = (await question('Host (default: localhost): ')) || 'localhost';
    config.port     = parseInt((await question('Port (default: 3306): ')) || '3306', 10);
    config.database = await question('Database: ');
    config.user     = await question('User: ');
    config.password = await question('Password: ');
  } else if (driver === 'postgres' || driver === 'postgresql') {
    config.host     = (await question('Host (default: localhost): ')) || 'localhost';
    config.port     = parseInt((await question('Port (default: 5432): ')) || '5432', 10);
    config.database = await question('Database: ');
    config.user     = await question('User: ');
    config.password = await question('Password: ');
  } else if (driver === 'sqlite') {
    config.database = await question('SQLite file path: ');
  } else {
    throw new Error(`Unsupported driver: ${driver}`);
  }

  return config;
}

async function fetchTablesList(connection, driver) {
  if (driver === 'mysql') {
    const rows = await connection.query('SHOW TABLES');
    const key  = Object.keys(rows[0])[0];
    return rows.map(r => r[key]);
  }
  if (driver === 'postgres' || driver === 'postgresql') {
    const rows = await connection.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    return rows.map(r => r.table_name);
  }
  if (driver === 'sqlite') {
    const rows = await connection.query(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    return rows.map(r => r.name);
  }
  throw new Error(`Unsupported driver: ${driver}`);
}

async function fetchCreateTableSql(connection, driver, tableName) {
  if (driver === 'mysql') {
    const rows = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
    return rows[0]['Create Table'];
  }
  if (driver === 'postgres' || driver === 'postgresql') {
    // Reconstruct from information_schema
    const cols = await connection.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = '${tableName}'
      ORDER BY ordinal_position
    `);
    let sql = `CREATE TABLE ${tableName} (\n`;
    cols.forEach((c, i) => {
      sql += `  ${c.column_name} ${c.data_type}`;
      if (c.is_nullable === 'NO') sql += ' NOT NULL';
      if (c.column_default)       sql += ` DEFAULT ${c.column_default}`;
      if (i < cols.length - 1)    sql += ',';
      sql += '\n';
    });
    sql += ');';
    return sql;
  }
  if (driver === 'sqlite') {
    const rows = await connection.query(
      `SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`
    );
    return rows[0].sql;
  }
  throw new Error(`Unsupported driver: ${driver}`);
}

async function fetchTableRows(connection, driver, tableName) {
  const query = driver === 'mysql'
    ? `SELECT * FROM \`${tableName}\``
    : `SELECT * FROM "${tableName}"`;
  return connection.query(query);
}

// ─── Interactive reverse from database ────────────────────────────────────────

async function reverseFromDatabase() {
  console.log('\n🔄  Reverse-engineering a live database\n');

  const dbConfig = await getDatabaseConfig();

  const { DatabaseConnection } = require('../src/index.js');
  const connection = new DatabaseConnection(dbConfig);

  console.log('\n⏳  Connecting…');
  await connection.connect();
  console.log('✅  Connected!\n');

  const tables = await fetchTablesList(connection, dbConfig.driver);
  if (!tables.length) {
    console.error('❌  No tables found.');
    await connection.close();
    return;
  }

  console.log(`📋  ${tables.length} table(s) found:\n`);
  tables.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
  console.log('');

  const migDir = (await question('Migration output dir (default: ./database/migrations): ')) || './database/migrations';
  const seedDir = (await question('Seeder output dir (default: ./database/seeders): '))      || './database/seeders';
  const seedRows = (await question('Generate seeders with actual row data? (y/N): ')).trim().toLowerCase() === 'y';

  fs.mkdirSync(migDir,  { recursive: true });
  fs.mkdirSync(seedDir, { recursive: true });

  console.log('\n🔍  Generating migrations…\n');
  for (const tableName of tables) {
    const sql       = await fetchCreateTableSql(connection, dbConfig.driver, tableName);
    const tableInfo = parseCreateTable(sql);
    if (!tableInfo) { console.warn(`  ⚠️  Could not parse schema for: ${tableName}`); continue; }

    const mig = generateMigration(tableInfo);
    fs.writeFileSync(path.join(migDir, mig.filename), mig.code, 'utf8');
    console.log(`  ✅  ${mig.filename}`);

    if (seedRows) {
      const rows   = await fetchTableRows(connection, dbConfig.driver, tableName);
      const seeder = generateSeeder(tableName, rows);
      fs.writeFileSync(path.join(seedDir, seeder.filename), seeder.code, 'utf8');
      console.log(`  🌱  ${seeder.filename} (${rows.length} row${rows.length !== 1 ? 's' : ''})`);
    }
  }

  console.log(`\n✨  Done! Migrations → ${migDir}${seedRows ? `   Seeders → ${seedDir}` : ''}\n`);
  await connection.close();
}

// ─── Interactive reverse from SQL file ────────────────────────────────────────

async function reverseFromFile() {
  console.log('\n📄  Reverse-engineering from a SQL file\n');

  const sqlFile = (await question('Path to SQL file: ')).trim();
  if (!fs.existsSync(sqlFile)) {
    console.error(`❌  File not found: ${sqlFile}`);
    return;
  }

  const sql    = fs.readFileSync(sqlFile, 'utf8');
  const migDir = (await question('Migration output dir (default: ./database/migrations): ')) || './database/migrations';
  fs.mkdirSync(migDir, { recursive: true });

  const migrations = reverseFromSql(sql);
  if (!migrations.length) {
    console.error('❌  No CREATE TABLE statements found.');
    return;
  }

  console.log(`\n✅  ${migrations.length} migration(s) generated:\n`);
  for (const mig of migrations) {
    fs.writeFileSync(path.join(migDir, mig.filename), mig.code, 'utf8');
    console.log(`  ✅  ${mig.filename}`);
  }

  console.log(`\n✨  Done! Migrations → ${migDir}\n`);
}

// ─── Main CLI ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║  Outlet ORM — Database Reverse Tool     ║');
  console.log('╚══════════════════════════════════════════╝\n');
  console.log('  1. Reverse from SQL file   → Migrations');
  console.log('  2. Reverse from database   → Migrations + Seeders');
  console.log('  3. Quit\n');

  const choice = (await question('Your choice: ')).trim();

  switch (choice) {
    case '1': await reverseFromFile();     break;
    case '2': await reverseFromDatabase(); break;
    case '3': console.log('Goodbye! 👋\n'); break;
    default:  console.log('❌  Invalid choice.\n');
  }

  if (rl) rl.close();
}

// ─── Exports (for testing) ────────────────────────────────────────────────────

if (require.main === module) {
  main().catch(err => {
    console.error('❌  Fatal:', err.message);
    if (rl) rl.close();
    process.exit(1);
  });
} else {
  module.exports = {
    parseCreateTable,
    splitDefinitions,
    columnToBlueprint,
    generateMigration,
    generateSeeder,
    reverseFromSql,
  };
}

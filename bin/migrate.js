#!/usr/bin/env node

/**
 * outlet-migrate CLI
 * Migration management tool for outlet-orm
 */

const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');
const AISafetyGuardrails = require('../src/AI/AISafetyGuardrails');
const safety = require('./_safety');
const Environment = require('../src/Environment');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║   Outlet ORM - Migration Manager     ║');
  console.log('╚═══════════════════════════════════════╝\n');

  const command = process.argv[2];

  if (command === 'make') {
    await makeMigration();
    rl.close();
    return;
  }

  if (command === 'make:seed' || command === 'seed:make') {
    await makeSeeder();
    rl.close();
    return;
  }

  // Support non-interactive commands for automation and CI
  const nonInteractive = new Set([
    'install',
    'migrate', 'up', 'rollback', 'reset', 'refresh', 'fresh', 'status',
    'deploy', 'resolve',
    'seed', 'db:seed',
    'restore:auto', 'backups:list', 'make:transform'
  ]);
  if (nonInteractive.has(command)) {
    const flags = parseFlags(process.argv.slice(3));
    await runNonInteractive(command, flags);
    rl.close();
    return;
  }

  // Fallback to interactive menu
  await runMigrationCommands();

  rl.close();
}

/**
 * Create a new migration file
 */
async function makeMigration() {
  const migrationName = process.argv[3];

  if (!migrationName) {
    console.error('Error: Migration name is required');
    console.log('Usage: outlet-migrate make <migration_name>');
    console.log('Example: outlet-migrate make create_users_table');
    return;
  }

  const migrationsDir = path.join(process.cwd(), 'database', 'migrations');

  // Create migrations directory if it doesn't exist
  try {
    await fs.mkdir(migrationsDir, { recursive: true });
  } catch (error) {
    // Directory already exists - ignore error as recursive: true handles this
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }

  // Generate timestamp
  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/T/, '_')
    .replace(/\..+/, '');

  const fileName = `${timestamp}_${migrationName}.js`;
  const filePath = path.join(migrationsDir, fileName);

  // Determine create-vs-alter and target table. Explicit --create / --table
  // flags win over name-based auto-detection.
  const flagsForMake = parseFlags(process.argv.slice(3));
  let isCreate;
  let tableName;
  if (flagsForMake.create) {
    isCreate = true;
    tableName = flagsForMake.create;
  } else if (flagsForMake.table) {
    isCreate = false;
    tableName = flagsForMake.table;
  } else {
    isCreate = migrationName.includes('create_');
    tableName = extractTableName(migrationName);
  }

  const template = isCreate
    ? getCreateMigrationTemplate(tableName)
    : getAlterMigrationTemplate(tableName);

  await fs.writeFile(filePath, template);

  console.log(`Migration created: ${fileName}`);
  console.log(`  Location: ${filePath}`);
}

/**
 * Create a new seeder file
 */
async function makeSeeder() {
  const seederName = process.argv[3];

  if (!seederName) {
    console.error('Error: Seeder name is required');
    console.log('Usage: outlet-migrate make:seed <seeder_name>');
    console.log('Example: outlet-migrate make:seed UserSeeder');
    return;
  }

  const seedsDir = path.join(process.cwd(), 'database', 'seeds');

  try {
    await fs.mkdir(seedsDir, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }

  const className = toSeederClassName(seederName);
  const fileName = `${className}.js`;
  const filePath = path.join(seedsDir, fileName);

  const template = getSeederTemplate(className);
  await fs.writeFile(filePath, template);

  console.log(`Seeder created: ${fileName}`);
  console.log(`  Location: ${filePath}`);
}

/**
 * Create a new data-transform migration from the template.
 * Used by `outlet-migrate make:transform <name>`.
 */
async function makeTransformMigration(/* flags */) {
  const migrationName = process.argv[3];
  if (!migrationName) {
    console.error('✗ Error: Migration name is required');
    console.log('Usage: outlet-migrate make:transform <migration_name>');
    process.exit(2);
  }
  if (!/^[a-z][a-z0-9_]*$/.test(migrationName)) {
    console.error(`✗ Error: Invalid migration name "${migrationName}"`);
    console.error('  Names must match /^[a-z][a-z0-9_]*$/ (lowercase, digits, underscores; must start with a letter).');
    process.exit(2);
  }

  const migrationsDir = path.join(process.cwd(), 'database', 'migrations');
  await fs.mkdir(migrationsDir, { recursive: true });

  const templatePath = path.join(__dirname, '..', 'database', 'templates', 'transform-migration.js');
  let template;
  try {
    template = await fs.readFile(templatePath, 'utf8');
  } catch (e) {
    console.error(`✗ Template not found at ${templatePath}`);
    console.error('  Run package install/upgrade or restore the templates directory.');
    process.exit(1);
  }

  const className = migrationName
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  const filled = template
    .replace(/__CLASS_NAME__/g, className)
    .replace(/__MIGRATION_NAME__/g, migrationName);

  const timestamp = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/T/, '_')
    .replace(/\..+/, '');
  const fileName = `${timestamp}_${migrationName}.js`;
  const filePath = path.join(migrationsDir, fileName);
  await fs.writeFile(filePath, filled);

  console.log(`Transform migration created: ${fileName}`);
  console.log(`  Location: ${filePath}`);
}

/**
 * Extract table name from migration name
 */
function extractTableName(migrationName) {
  // Extract table name from patterns like:
  // create_users_table -> users
  // add_email_to_users_table -> users
  // alter_users_table -> users

  const patterns = [
    /create_(\w+)_table/,
    /to_(\w+)_table/,
    /alter_(\w+)_table/,
    /(\w+)_table/
  ];

  for (const pattern of patterns) {
    const match = migrationName.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return 'table_name';
}

/**
 * Get migration template for creating a table
 */
function getCreateMigrationTemplate(tableName) {
  return `/**
 * Migration: Create ${tableName} table
 */

const { Migration } = require('outlet-orm');

class Create${capitalize(tableName)}Table extends Migration {
  /**
   * Run the migrations
   */
  async up() {
    const schema = this.getSchema();

    await schema.create('${tableName}', (table) => {
      table.id();
      table.string('name');
      table.timestamps();
    });
  }

  /**
   * Reverse the migrations
   */
  async down() {
    const schema = this.getSchema();
    await schema.dropIfExists('${tableName}');
  }
}

module.exports = Create${capitalize(tableName)}Table;
`;
}

/**
 * Get migration template for altering a table
 */
function getAlterMigrationTemplate(tableName) {
  return `/**
 * Migration: Alter ${tableName} table
 */

const { Migration } = require('outlet-orm');

class Alter${capitalize(tableName)}Table extends Migration {
  /**
   * Run the migrations
   */
  async up() {
    const schema = this.getSchema();

    await schema.table('${tableName}', (table) => {
      // Add your column modifications here
      // table.string('new_column');
    });
  }

  /**
   * Reverse the migrations
   */
  async down() {
    const schema = this.getSchema();

    await schema.table('${tableName}', (table) => {
      // Reverse your column modifications here
      // table.dropColumn('new_column');
    });
  }
}

module.exports = Alter${capitalize(tableName)}Table;
`;
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function toSeederClassName(name) {
  const cleaned = String(name)
    .replace(/\.js$/i, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim();

  const pascal = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');

  if (!pascal) {
    throw new Error('Invalid seeder name');
  }

  return pascal.endsWith('Seeder') ? pascal : `${pascal}Seeder`;
}

function getSeederTemplate(className) {
  return `/**
 * Seeder: ${className}
 */

const { Seeder } = require('outlet-orm');

class ${className} extends Seeder {
  /**
   * Run the seeder
   */
  async run() {
    await this.insert('table_name', [
      // { name: 'Example' }
    ]);
  }
}

module.exports = ${className};
`;
}

/**
 * Simple flag parser for CLI args
 * Supports formats:
 * --key=value, --key value, -k value, and boolean flags like --yes/-y
 */
function parseFlags(argv) {
  const text = ` ${argv.join(' ')} `;
  const flags = {};
  // Booleans
  if (/(^|\s)(--yes|-y)(\s|$)/.test(text)) flags.yes = true;
  if (/(^|\s)(--force|-f)(\s|$)/.test(text)) flags.force = true;
  if (/(^|\s)--skip-auto-backup(\s|$)/.test(text)) flags.skipAutoBackup = true;
  if (/(^|\s)--allow-drift(\s|$)/.test(text)) flags.allowDrift = true;
  if (/(^|\s)--json(\s|$)/.test(text)) flags.json = true;
  if (/(^|\s)--pretend(\s|$)/.test(text)) flags.pretend = true;
  if (/(^|\s)--step(\s|$)/.test(text)) flags.step = true;
  if (/(^|\s)--seed(\s|$)/.test(text)) flags.seed = true;
  if (/(^|\s)--pending(\s|$)/.test(text)) flags.pending = true;
  if (/(^|\s)--allow-failed(\s|$)/.test(text)) flags.allowFailed = true;
  // --applied=<name> / --rolled-back=<name> (resolve)
  const appliedRe = /--applied(?:=|\s+)(\S+)/;
  const appliedMatch = appliedRe.exec(text);
  if (appliedMatch) flags.applied = appliedMatch[1];
  const rolledRe = /--rolled-back(?:=|\s+)(\S+)/;
  const rolledMatch = rolledRe.exec(text);
  if (rolledMatch) flags.rolledBack = rolledMatch[1];
  // Steps with value: supports "--steps N", "--steps=N", "-s N". (Bare "--step" is the
  // per-migration-batch flag handled above.)
  const stepsRe = /(?:--steps(?:=|\s+)|-s\s+)(\S+)/;
  const stepsMatch = stepsRe.exec(text);
  if (stepsMatch) flags.steps = coerce(stepsMatch[1]);
  // Seeder target: --class Name, --class=Name, -c Name, --seeder=Name
  const classRe = /(?:--class(?:=|\s+)|-c\s+|--seeder(?:=|\s+))(\S+)/;
  const classMatch = classRe.exec(text);
  if (classMatch) flags.class = classMatch[1];
  // --batch=N (rollback to specific batch)
  const batchRe = /--batch(?:=|\s+)(\S+)/;
  const batchMatch = batchRe.exec(text);
  if (batchMatch) flags.batch = coerce(batchMatch[1]);
  // --create=<table> / --table=<table> (make command)
  const createRe = /--create(?:=|\s+)(\S+)/;
  const createMatch = createRe.exec(text);
  if (createMatch) flags.create = createMatch[1];
  const tableRe = /--table(?:=|\s+)(\S+)/;
  const tableMatch = tableRe.exec(text);
  if (tableMatch) flags.table = tableMatch[1];
  // --backup=<file> (or --backup <file>)
  const backupRe = /--backup(?:=|\s+)(\S+)/;
  const backupMatch = backupRe.exec(text);
  if (backupMatch) flags.backup = backupMatch[1];
  return flags;
}

function coerce(val) {
  if (val === 'true') return true;
  if (val === 'false') return false;
  const n = Number(val);
  return Number.isNaN(n) ? val : n;
}

/**
 * Run migration commands non-interactively
 */
async function runNonInteractive(cmd, flags) {
  // Load database configuration
  const dbConfigPath = path.join(process.cwd(), 'database', 'config.js');

  // Prefer database/config.js; if missing, allow env-based config via .env
  let dbConfig;
  try {
    dbConfig = require(dbConfigPath);
  } catch (error) {
    // Fallback to env-based configuration
    require('dotenv').config();
    const env = process.env || {};
    dbConfig = {
      driver: env.DB_DRIVER || env.DATABASE_DRIVER,
      host: env.DB_HOST,
      port: env.DB_PORT ? Number(env.DB_PORT) : undefined,
      user: env.DB_USER || env.DB_USERNAME,
      password: env.DB_PASSWORD,
      database: env.DB_DATABASE || env.DB_NAME || env.DB_FILE || env.SQLITE_DB || env.SQLITE_FILENAME
    };
    if (!dbConfig.driver) {
      console.error('\nError: Could not load database configuration');
      console.error(`  Make sure ${dbConfigPath} exists OR provide .env variables like DB_DRIVER, DB_HOST, DB_DATABASE`);
      console.error('  Run "outlet-init" to create the configuration');
      console.error(`  Details: ${error.message}`);
      return;
    }
  }

  const { DatabaseConnection, MigrationManager, SeederManager } = require('../src');

  const connection = new DatabaseConnection(dbConfig);
  await connection.connect();

  // Build safety options from flags; MigrationManager applies env-var overrides.
  const safetyOpts = {};
  if (flags.skipAutoBackup) safetyOpts.autoBackup = false;
  if (flags.allowDrift) safetyOpts.allowDrift = true;

  const manager = new MigrationManager(connection, undefined, undefined, { migrations: safetyOpts });

  const destructiveOpts = {
    skipAutoBackup: !!flags.skipAutoBackup,
    backupFilename: flags.backup
  };

  try {
    // CLI-level production gate: prints summary + database-name prompt
    // for destructive commands. The MigrationManager also enforces the env-var
    // check; this layer adds the interactive confirmation when in a TTY.
    const DESTRUCTIVE_CMDS = ['fresh', 'reset', 'refresh', 'rollback', 'restore:auto'];
    if (DESTRUCTIVE_CMDS.includes(cmd)) {
      const env = Environment.detect();
      if (env === 'production') {
        safety.printConnectionSummary(connection, env);
        const gate = safety.requireProductionConfirm(env);
        if (!gate.ok) {
          if (gate.message) console.error(gate.message);
          await connection.disconnect().catch(() => {});
          process.exit(gate.exitCode);
        }
        const ok = await safety.promptDatabaseName(connection);
        if (!ok) {
          console.error('Database name confirmation failed. Aborting.');
          await connection.disconnect().catch(() => {});
          process.exit(2);
        }
      }
    }

    switch (cmd) {
    case 'install':
      await manager.install();
      console.log('Migrations table initialized.');
      break;

    case 'migrate':
    case 'up':
      await manager.run({
        pretend: !!flags.pretend,
        step: !!flags.step,
        seed: !!flags.seed,
        seeder: flags.class || undefined
      });
      break;

    case 'rollback': {
      const steps = Number(flags.steps) || 1;
      await manager.rollback({
        steps,
        batch: flags.batch != null ? Number(flags.batch) : undefined,
        pretend: !!flags.pretend,
        ...destructiveOpts
      });
      break;
    }

    case 'reset': {
      // AI Safety Guardrails check (v7.0.0)
      if (AISafetyGuardrails.isDestructiveCommand('reset')) {
        const check = AISafetyGuardrails.validateDestructiveAction('reset', flags);
        if (!check.allowed) {
          console.error(check.message);
          return;
        }
      }
      if (flags.yes || flags.force || flags.pretend) {
        await manager.reset({ ...destructiveOpts, pretend: !!flags.pretend });
      } else {
        console.error('Refused to reset without --yes');
      }
      break;
    }

    case 'refresh': {
      // AI Safety Guardrails check (v7.0.0)
      if (AISafetyGuardrails.isDestructiveCommand('fresh')) {
        const check = AISafetyGuardrails.validateDestructiveAction('refresh', flags);
        if (!check.allowed) {
          console.error(check.message);
          return;
        }
      }
      if (flags.yes || flags.force || flags.pretend) {
        await manager.refresh({
          ...destructiveOpts,
          pretend: !!flags.pretend,
          step: !!flags.step,
          seed: !!flags.seed,
          seeder: flags.class || undefined
        });
      } else {
        console.error('Refused to refresh without --yes');
      }
      break;
    }

    case 'fresh': {
      // AI Safety Guardrails check (v7.0.0)
      if (AISafetyGuardrails.isDestructiveCommand('fresh')) {
        const check = AISafetyGuardrails.validateDestructiveAction('fresh', flags);
        if (!check.allowed) {
          console.error(check.message);
          return;
        }
      }
      if (flags.yes || flags.force || flags.pretend) {
        await manager.fresh({
          ...destructiveOpts,
          pretend: !!flags.pretend,
          step: !!flags.step,
          seed: !!flags.seed,
          seeder: flags.class || undefined
        });
      } else {
        console.error('Refused to fresh without --yes');
      }
      break;
    }

    case 'status':
      await manager.status({ pending: !!flags.pending });
      break;

    case 'deploy':
      await manager.deploy({
        pretend: !!flags.pretend,
        allowDrift: !!flags.allowDrift,
        allowFailed: !!flags.allowFailed
      });
      break;

    case 'resolve': {
      if (!flags.applied && !flags.rolledBack) {
        console.error('Error: resolve requires --applied=<name> or --rolled-back=<name>');
        process.exit(1);
      }
      if (flags.applied && flags.rolledBack) {
        console.error('Error: --applied and --rolled-back are mutually exclusive');
        process.exit(1);
      }
      if (flags.applied) {
        await manager.markMigrationApplied(flags.applied);
      } else {
        await manager.markMigrationRolledBack(flags.rolledBack);
      }
      break;
    }

    case 'seed':
    case 'db:seed': {
      const seederManager = new SeederManager(connection);
      await seederManager.run(flags.class || null);
      break;
    }

    case 'restore:auto': {
      const result = await manager.restoreAuto({ backup: flags.backup });
      console.log(`✓ Restored ${result.statements} statement(s) from ${result.file}`);
      break;
    }

    case 'backups:list': {
      const list = await manager.listAutoBackups();
      if (flags.json) {
        console.log(JSON.stringify(list, null, 2));
      } else if (list.length === 0) {
        console.log('No auto-backups found.');
      } else {
        console.log('Auto-backups (newest first):');
        for (const b of list) {
          const size = typeof b.size === 'number' ? `${(b.size / 1024).toFixed(1)} KB` : '?';
          console.log(`  ${b.file}  [${b.command || '?'}]  ${size}  ${b.timestamp || ''}`);
        }
      }
      break;
    }

    case 'make:transform': {
      await makeTransformMigration(flags);
      break;
    }

    default:
      console.error(`Unknown command: ${cmd}`);
      console.error('');
      console.error('Usage: outlet-migrate <command> [flags]');
      console.error('');
      console.error('Commands:');
      console.error('  install                     Create the migrations table only');
      console.error('  migrate | up                Run pending migrations');
      console.error('  deploy                      Apply pending migrations non-interactively (CI/CD)');
      console.error('  resolve --applied=<name>    Mark a migration as applied (recovery / baseline)');
      console.error('  resolve --rolled-back=<name>  Mark a migration as rolled back (recovery)');
      console.error('  rollback [steps]            Roll back the last batch (or N steps)');
      console.error('  reset                       Roll back ALL migrations');
      console.error('  refresh                     reset + migrate');
      console.error('  fresh                       Drop all tables, then migrate');
      console.error('  status                      Show migration status (incl. drift)');
      console.error('  seed | db:seed [name]       Run seeders');
      console.error('  make <name> [--create=T|--table=T]   Scaffold a new migration');
      console.error('  make:seed <name>            Scaffold a new seeder');
      console.error('  make:transform <name>       Scaffold a data-transform migration');
      console.error('  restore:auto [--backup=<f>] Restore the latest (or named) auto-backup');
      console.error('  backups:list [--json]       List auto-backups');
      console.error('');
      console.error('Flags:');
      console.error('  --pretend                   Show SQL/plan without executing (migrate/rollback/reset/refresh/fresh)');
      console.error('  --allow-failed              deploy: proceed despite previously-failed migrations');
      console.error('  --step                      Run each pending migration in its own batch');
      console.error('  --steps=N | -s N            Number of batches to roll back (default 1)');
      console.error('  --batch=N                   Roll back a specific batch number');
      console.error('  --seed                      Run seeders after migrate/refresh/fresh');
      console.error('  --seeder=Name | --class=N   Target a specific seeder class');
      console.error('  --pending                   status: show only pending migrations');
      console.error('  --create=<table>            make: force a create-table template');
      console.error('  --table=<table>             make: force an alter-table template');
      console.error('  --skip-auto-backup          Skip auto-backup (ignored in production)');
      console.error('  --allow-drift               Allow migrations to run when drift is detected');
      console.error('  --backup=<file>             Choose a specific backup file for restore:auto');
      console.error('  --json                      Emit machine-readable output (backups:list)');
      console.error('');
      console.error('Environment:');
      console.error('  OUTLET_PRODUCTION_CONFIRM=1 Required for destructive commands in production');
      console.error('  OUTLET_ALLOW_DRIFT=1        Equivalent to --allow-drift');
      console.error('  OUTLET_ENV / NODE_ENV       development | test | production');
      process.exit(1);
    }
  } catch (error) {
    console.error('\nMigration error:', error.message);
    if (process.env.DEBUG) console.error(error.stack);
    await connection.disconnect().catch(() => {});
    // Map error codes to exit codes per CLI contract.
    switch (error.code) {
    case 'EOUTLET_PRODUCTION':
    case 'EOUTLET_CONFIRM':
      process.exit(2);
      // eslint-disable-next-line no-fallthrough
    case 'EOUTLET_DRIFT':
    case 'EOUTLET_NO_BACKUP':
      process.exit(3);
      // eslint-disable-next-line no-fallthrough
    default:
      process.exit(1);
    }
  }

  await connection.disconnect();
}

/**
 * Run migration commands (migrate, rollback, etc.)
 */
async function runMigrationCommands() {
  console.log('Select a migration command:\n');
  console.log('1. migrate         - Run all pending migrations');
  console.log('2. rollback        - Rollback the last batch of migrations');
  console.log('3. reset           - Rollback all migrations');
  console.log('4. refresh         - Reset and re-run all migrations');
  console.log('5. fresh           - Drop all tables and re-run migrations');
  console.log('6. status          - Show migration status');
  console.log('7. seed            - Run seeders from database/seeds');
  console.log('8. make:seed       - Create a new seeder file');
  console.log('0. Exit\n');

  const choice = await question('Enter your choice: ');

  if (choice === '0') {
    console.log('Goodbye!');
    return;
  }

  // Load database configuration
  const dbConfigPath = path.join(process.cwd(), 'database', 'config.js');

  let dbConfig;
  try {
    dbConfig = require(dbConfigPath);
  } catch (error) {
    require('dotenv').config();
    const env = process.env || {};
    dbConfig = {
      driver: env.DB_DRIVER || env.DATABASE_DRIVER,
      host: env.DB_HOST,
      port: env.DB_PORT ? Number(env.DB_PORT) : undefined,
      user: env.DB_USER || env.DB_USERNAME,
      password: env.DB_PASSWORD,
      database: env.DB_DATABASE || env.DB_NAME || env.DB_FILE || env.SQLITE_DB || env.SQLITE_FILENAME
    };
    if (!dbConfig.driver) {
      console.error('\nError: Could not load database configuration');
      console.error(`  Make sure ${dbConfigPath} exists OR provide .env variables like DB_DRIVER, DB_HOST, DB_DATABASE`);
      console.error('  Run "outlet-init" to create the configuration');
      console.error(`  Details: ${error.message}`);
      return;
    }
  }

  const { DatabaseConnection, MigrationManager, SeederManager } = require('../src');

  const connection = new DatabaseConnection(dbConfig);
  await connection.connect();

  const manager = new MigrationManager(connection);

  try {
    switch (choice) {
    case '1':
      await manager.run();
      break;

    case '2': {
      const steps = await question('How many batches to rollback? (default: 1): ');
      await manager.rollback(parseInt(steps) || 1);
      break;
    }

    case '3': {
      const confirmReset = await question('Are you sure you want to reset all migrations? (yes/no): ');
      if (confirmReset.toLowerCase() === 'yes') {
        await manager.reset();
      } else {
        console.log('Reset cancelled');
      }
      break;
    }

    case '4': {
      const confirmRefresh = await question('Are you sure you want to refresh all migrations? (yes/no): ');
      if (confirmRefresh.toLowerCase() === 'yes') {
        await manager.refresh();
      } else {
        console.log('Refresh cancelled');
      }
      break;
    }

    case '5': {
      const confirmFresh = await question('⚠️  WARNING: This will DROP ALL TABLES! Continue? (yes/no): ');
      if (confirmFresh.toLowerCase() === 'yes') {
        await manager.fresh();
      } else {
        console.log('Fresh cancelled');
      }
      break;
    }

    case '6':
      await manager.status();
      break;

    case '7': {
      const seederManager = new SeederManager(connection);
      await seederManager.run();
      break;
    }

    case '8':
      await makeSeeder();
      break;

    default:
      console.log('Invalid choice');
    }
  } catch (error) {
    console.error('\nMigration error:', error.message);
    console.error(error.stack);
  }

  await connection.disconnect();
}

// Run the CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

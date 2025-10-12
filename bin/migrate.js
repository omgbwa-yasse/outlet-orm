#!/usr/bin/env node

/**
 * outlet-migrate CLI
 * Migration management tool for outlet-orm
 */

const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

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

  // Support non-interactive commands for automation and CI
  const nonInteractive = new Set(['migrate', 'up', 'rollback', 'reset', 'refresh', 'fresh', 'status']);
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
    console.error('✗ Error: Migration name is required');
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

  // Determine if it's a create or alter migration
  const isCreate = migrationName.includes('create_');
  const tableName = extractTableName(migrationName);

  const template = isCreate
    ? getCreateMigrationTemplate(tableName)
    : getAlterMigrationTemplate(tableName);

  await fs.writeFile(filePath, template);

  console.log(`✓ Migration created: ${fileName}`);
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

const Migration = require('../../lib/Migrations/Migration');

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

const Migration = require('../../lib/Migrations/Migration');

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
  // Steps with value: supports "--steps N", "--steps=N", "-s N"
  const stepsRe = /(?:--steps(?:=|\s+)|-s\s+)(\S+)/;
  const stepsMatch = stepsRe.exec(text);
  if (stepsMatch) flags.steps = coerce(stepsMatch[1]);
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
      console.error('\n✗ Error: Could not load database configuration');
      console.error(`  Make sure ${dbConfigPath} exists OR provide .env variables like DB_DRIVER, DB_HOST, DB_DATABASE`);
      console.error('  Run "outlet-init" to create the configuration');
      console.error(`  Details: ${error.message}`);
      return;
    }
  }

  const { DatabaseConnection } = require('../lib/Database/DatabaseConnection');
  const MigrationManager = require('../lib/Migrations/MigrationManager');

  const connection = new DatabaseConnection(dbConfig);
  await connection.connect();

  const manager = new MigrationManager(connection);

  try {
    switch (cmd) {
    case 'migrate':
    case 'up':
      await manager.run();
      break;

    case 'rollback': {
      const steps = Number(flags.steps) || 1;
      await manager.rollback(steps);
      break;
    }

    case 'reset': {
      if (flags.yes || flags.force) {
        await manager.reset();
      } else {
        console.error('✗ Refused to reset without --yes');
      }
      break;
    }

    case 'refresh': {
      if (flags.yes || flags.force) {
        await manager.refresh();
      } else {
        console.error('✗ Refused to refresh without --yes');
      }
      break;
    }

    case 'fresh': {
      if (flags.yes || flags.force) {
        await manager.fresh();
      } else {
        console.error('✗ Refused to fresh without --yes');
      }
      break;
    }

    case 'status':
      await manager.status();
      break;

    default:
      console.error(`✗ Unknown command: ${cmd}`);
    }
  } catch (error) {
    console.error('\n✗ Migration error:', error.message);
    console.error(error.stack);
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
      console.error('\n✗ Error: Could not load database configuration');
      console.error(`  Make sure ${dbConfigPath} exists OR provide .env variables like DB_DRIVER, DB_HOST, DB_DATABASE`);
      console.error('  Run "outlet-init" to create the configuration');
      console.error(`  Details: ${error.message}`);
      return;
    }
  }

  const { DatabaseConnection } = require('../lib/Database/DatabaseConnection');
  const MigrationManager = require('../lib/Migrations/MigrationManager');

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

    default:
      console.log('Invalid choice');
    }
  } catch (error) {
    console.error('\n✗ Migration error:', error.message);
    console.error(error.stack);
  }

  await connection.disconnect();
}

// Run the CLI
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

/**
 * CLI safety helpers for outlet-migrate.
 *
 * Shared between bin/migrate.js subcommands that need production confirmation.
 * All helpers are TTY-aware: in non-TTY contexts (CI / piped stdin) production
 * destructive commands abort with exit code 2 unless OUTLET_PRODUCTION_CONFIRM=1.
 */

'use strict';

const readline = require('readline');

/**
 * Prompt the user to type the database name exactly.
 * Returns true on match, false on mismatch.
 *
 * @param {{ config?: { database?: string } }} connection
 * @returns {Promise<boolean>}
 */
async function promptDatabaseName(connection) {
  const expected = connection && connection.config && connection.config.database;
  if (!expected) {
    console.error('No database name configured; cannot perform production confirmation.');
    return false;
  }
  if (!process.stdin.isTTY) {
    console.error('Non-TTY environment — cannot prompt for database name.');
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise(resolve =>
    rl.question(`Type the database name to confirm (case-sensitive): `, resolve)
  );
  rl.close();
  return String(answer).trim() === String(expected);
}

/**
 * Enforce production-confirmation requirements before destructive ops.
 *
 * @param {'development'|'production'|'test'} env
 * @returns {{ ok: boolean, exitCode: number, message?: string }}
 */
function requireProductionConfirm(env) {
  if (env !== 'production') return { ok: true, exitCode: 0 };
  if (process.env.OUTLET_PRODUCTION_CONFIRM !== '1') {
    return {
      ok: false,
      exitCode: 2,
      message:
        'Production environment detected. Set OUTLET_PRODUCTION_CONFIRM=1 to proceed.\n' +
        '  Example (PowerShell): $env:OUTLET_PRODUCTION_CONFIRM=1\n' +
        '  Example (bash):       export OUTLET_PRODUCTION_CONFIRM=1'
    };
  }
  if (!process.stdin.isTTY) {
    return {
      ok: false,
      exitCode: 2,
      message: 'Production destructive commands require an interactive TTY.'
    };
  }
  return { ok: true, exitCode: 0 };
}

/**
 * Print a connection summary banner.
 *
 * @param {{ config?: object }} connection
 * @param {string} env
 */
function printConnectionSummary(connection, env) {
  const cfg = (connection && connection.config) || {};
  const banner = [
    '─────────────────────────────────────────────',
    `  Environment : ${env}`,
    `  Driver      : ${cfg.driver || '(unknown)'}`,
    `  Host        : ${cfg.host || '(local/sqlite)'}`,
    `  Database    : ${cfg.database || '(unknown)'}`,
    '─────────────────────────────────────────────'
  ].join('\n');
  console.log(banner);
}

module.exports = {
  promptDatabaseName,
  requireProductionConfirm,
  printConnectionSummary
};

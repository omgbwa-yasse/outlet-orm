'use strict';

/**
 * Minimal multi-driver smoke test used by CI.
 * Verifies connect/DDL/DML/transaction/rollback for the configured driver.
 */

const DatabaseConnection = require('../src/DatabaseConnection');

async function main() {
  const driver = process.env.DB_DRIVER || 'sqlite';
  const db = new DatabaseConnection({
    driver,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE || ':memory:',
    connectionLimit: 2
  });

  await db.connect();
  const table = `outlet_smoke_${Date.now()}`;
  const q = (name) => driver === 'mysql' ? `\`${name}\`` : `"${name}"`;

  try {
    await db.execute(`CREATE TABLE ${q(table)} (id INTEGER PRIMARY KEY, name VARCHAR(64))`);
    await db.insert(table, { id: 1, name: 'one' });
    const rows = await db.select(table, { wheres: [] });
    if (rows.length !== 1 || rows[0].name !== 'one') {
      throw new Error(`unexpected select result: ${JSON.stringify(rows)}`);
    }

    await db.transaction(async () => {
      await db.insert(table, { id: 2, name: 'rolled-back' });
      throw new Error('rollback');
    }).catch((err) => {
      if (err.message !== 'rollback') throw err;
    });

    const after = await db.select(table, { wheres: [] });
    if (after.length !== 1) {
      throw new Error(`transaction rollback failed: ${after.length} row(s)`);
    }

    console.log(`db-smoke OK (${driver})`);
  } finally {
    await db.execute(`DROP TABLE ${q(table)}`).catch(() => {});
    await db.close();
  }
}

main().catch((err) => {
  console.error('db-smoke FAILED:', err);
  process.exit(1);
});

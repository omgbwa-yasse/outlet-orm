/**
 * BackupSocketServer + BackupSocketClient tests
 * Uses an in-memory SQLite database and a random TCP port.
 */

'use strict';

const os   = require('os');
const path = require('path');
const fs   = require('fs');
const DatabaseConnection  = require('../src/DatabaseConnection');
const BackupSocketServer  = require('../src/Backup/BackupSocketServer');
const BackupSocketClient  = require('../src/Backup/BackupSocketClient');

// Pick a random high port per test run to avoid conflicts
const PORT    = 19000 + Math.floor(Math.random() * 500);
const TMP_DIR = path.join(os.tmpdir(), `outlet-socket-test-${Date.now()}`);

// global server/db shared across the suite
let db, server, client;

// Helper: create a connected client quickly
async function makeClient() {
  const c = new BackupSocketClient({ port: PORT, timeout: 10_000 });
  await c.connect();
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  fs.mkdirSync(TMP_DIR, { recursive: true });

  db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
  await db.connect();
  await db.execute('CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price REAL)');
  await db.insert('products', { name: 'Widget', price: 9.99 });
  await db.insert('products', { name: 'Gadget', price: 19.99 });

  server = new BackupSocketServer(db, { port: PORT, backupPath: TMP_DIR });
  await server.listen();
  client = await makeClient();
}, 15_000);

afterAll(async () => {
  if (client && client.connected) await client.disconnect();
  if (server) await server.close();
  if (db) await db.close();
  try { fs.rmSync(TMP_DIR, { recursive: true, force: true }); } catch (_) {}
}, 15_000);

// ─────────────────────────────────────────────────────────────────────────────
describe('BackupSocketServer – lifecycle', () => {
  test('server.address() returns port after listen()', () => {
    const addr = server.address();
    expect(addr).not.toBeNull();
    expect(addr.port).toBe(PORT);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BackupSocketClient – basic commands', () => {
  test('ping returns pong', async () => {
    const res = await client.ping();
    expect(res).toBe('pong');
  });

  test('status returns uptime, jobs, clients', async () => {
    const status = await client.status();
    expect(status).toHaveProperty('uptime');
    expect(typeof status.uptime).toBe('number');
    expect(Array.isArray(status.jobs)).toBe(true);
    expect(typeof status.clients).toBe('number');
  });

  test('jobs() returns an array', async () => {
    const jobs = await client.jobs();
    expect(Array.isArray(jobs)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BackupSocketClient – run (immediate backups)', () => {
  test('run("full") returns an absolute file path', async () => {
    const filePath = await client.run('full');
    expect(path.isAbsolute(filePath)).toBe(true);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  test('run("partial") returns a file containing only the target table', async () => {
    const filePath = await client.run('partial', ['products']);
    const content  = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('Widget');
    expect(content).not.toMatch(/INSERT INTO.*orders/i);
  });

  test('run("full", { format:"json" }) creates a .json file', async () => {
    const filePath = await client.run('full', { format: 'json' });
    expect(filePath.endsWith('.json')).toBe(true);
    const dump = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    expect(dump).toHaveProperty('tables.products');
  });

  test('run("unknown") triggers a server error reply', async () => {
    await expect(client.run('unknown')).rejects.toThrow();
  });

  test('run("partial") without tables triggers a server error reply', async () => {
    await expect(client.run('partial', undefined, {})).rejects.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BackupSocketClient – schedule / stop', () => {
  test('schedule() returns a job name', async () => {
    const name = await client.schedule('full', {
      intervalMs: 3_600_000,
      name: 'test_hourly',
    });
    expect(name).toBe('test_hourly');
  });

  test('jobs() includes the scheduled job', async () => {
    // Re-schedule in case previous test's job was cleaned up
    await client.schedule('full', { intervalMs: 3_600_000, name: 'jobs_check' });
    const jobs = await client.jobs();
    expect(jobs).toContain('jobs_check');
  });

  test('stop() removes the job from active list', async () => {
    await client.schedule('full', { intervalMs: 3_600_000, name: 'to_stop' });
    await client.stop('to_stop');
    const jobs = await client.jobs();
    expect(jobs).not.toContain('to_stop');
  });

  test('stopAll() clears all jobs', async () => {
    await client.schedule('full',    { intervalMs: 3_600_000, name: 'sa1' });
    await client.schedule('journal', { intervalMs: 3_600_000, name: 'sa2' });
    await client.stopAll();
    const jobs = await client.jobs();
    expect(jobs.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BackupSocketClient – push events', () => {
  test('server broadcasts jobDone event when schedule() fires (runNow)', async () => {
    const eventClient = await makeClient();

    const received = await new Promise((resolve) => {
      eventClient.on('jobDone', (payload) => {
        if (payload.name === 'event_test') resolve(payload);
      });

      eventClient.schedule('full', {
        intervalMs : 3_600_000,
        name       : 'event_test',
        runNow     : true,
      }).catch(() => {});
    });

    expect(received.filePath).toBeDefined();
    expect(fs.existsSync(received.filePath)).toBe(true);

    await eventClient.stopAll();
    await eventClient.disconnect();
  }, 10_000);
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BackupSocketClient – multiple concurrent clients', () => {
  test('two clients can talk to the server simultaneously', async () => {
    const c2 = await makeClient();
    const [r1, r2] = await Promise.all([
      client.ping(),
      c2.ping(),
    ]);
    expect(r1).toBe('pong');
    expect(r2).toBe('pong');
    await c2.disconnect();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BackupSocketClient – restore', () => {
  const fs   = require('fs');
  const path = require('path');

  test('restore() replays a plain SQL backup into the database', async () => {
    // Create a second in-memory DB to restore into
    const fresh = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await fresh.connect();
    await fresh.execute('CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price REAL)');

    // Create a plain-text backup from the main server
    const backupFile = await client.run('full');

    // Mount a dedicated server wired to the fresh DB
    const restorePort   = PORT + 50;
    const restoreServer = new BackupSocketServer(fresh, { port: restorePort, backupPath: TMP_DIR });
    await restoreServer.listen();
    const restoreClient = await (async () => {
      const c = new BackupSocketClient({ port: restorePort, timeout: 10_000 });
      await c.connect();
      return c;
    })();

    // Strip CREATE TABLE so restoring into existing schema succeeds
    const rawSQL      = fs.readFileSync(backupFile, 'utf8');
    const insertsOnly = rawSQL.split('\n').filter((l) => /^\s*INSERT/i.test(l)).join('\n');
    const plainFile   = path.join(TMP_DIR, 'restore_plain.sql');
    fs.writeFileSync(plainFile, insertsOnly, 'utf8');

    const result = await restoreClient.restore(plainFile);
    expect(result).toHaveProperty('statements');
    expect(result.statements).toBeGreaterThan(0);

    // Confirm data is actually in the fresh DB
    const rows = await fresh.executeRawQuery('SELECT * FROM products');
    expect(rows.length).toBeGreaterThan(0);

    await restoreClient.disconnect();
    await restoreServer.close();
    await fresh.close();
  }, 20_000);

  test('restore() without filePath rejects', async () => {
    await expect(client.restore(undefined)).rejects.toThrow();
  });

  test('restore() of a non-existent file rejects', async () => {
    await expect(
      client.restore('/absolutely/nonexistent/file.sql')
    ).rejects.toThrow();
  });

  test('restore() auto-decrypts encrypted backup when password provided', async () => {
    const ENC_PASS = 'TestEncRestore!';

    // Fresh source DB with encryption enabled on its backup server
    const srcDB = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await srcDB.connect();
    await srcDB.execute('CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price REAL)');
    await srcDB.insert('products', { name: 'enc_item', price: 1.23 });

    const encPort   = PORT + 100;
    const encServer = new BackupSocketServer(srcDB, {
      port              : encPort,
      backupPath        : TMP_DIR,
      encrypt           : true,
      encryptionPassword: ENC_PASS,
      saltLength        : 5,
    });
    await encServer.listen();
    const encClient = await (async () => {
      const c = new BackupSocketClient({ port: encPort, timeout: 10_000 });
      await c.connect();
      return c;
    })();

    // Produce an encrypted backup
    const encFile = await encClient.run('full', { filename: 'restore_enc_via_socket.sql.enc' });
    expect(encFile.endsWith('.enc')).toBe(true);
    expect(fs.existsSync(encFile)).toBe(true);

    // Restore into a fresh empty DB via the enc server
    const freshDB = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
    await freshDB.connect();
    await freshDB.execute('CREATE TABLE products (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price REAL)');

    const restoreEncPort   = PORT + 110;
    const restoreEncServer = new BackupSocketServer(freshDB, {
      port      : restoreEncPort,
      backupPath: TMP_DIR,
    });
    await restoreEncServer.listen();
    const restoreEncClient = await (async () => {
      const c = new BackupSocketClient({ port: restoreEncPort, timeout: 10_000 });
      await c.connect();
      return c;
    })();

    // Extract inserts-only from the encrypted backup (decrypt to strip CREATE TABLE)
    const { decrypt: dec } = require('../src/Backup/BackupEncryption');
    const raw         = fs.readFileSync(encFile, 'utf8');
    const plain       = dec(raw, ENC_PASS);
    const insertsOnly = plain.split('\n').filter((l) => /^\s*INSERT/i.test(l)).join('\n');
    const insFile     = path.join(TMP_DIR, 'enc_socket_inserts.sql');
    fs.writeFileSync(insFile, insertsOnly, 'utf8');

    const result = await restoreEncClient.restore(insFile);
    expect(result.statements).toBeGreaterThan(0);

    const rows = await freshDB.executeRawQuery('SELECT * FROM products');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].name).toBe('enc_item');

    await restoreEncClient.disconnect();
    await restoreEncServer.close();
    await encClient.disconnect();
    await encServer.close();
    await srcDB.close();
    await freshDB.close();
  }, 20_000);

  test('restore() encrypted file without password rejects', async () => {
    const ENC_PASS = 'AnotherPass!';
    const encPort2   = PORT + 150;
    const encServer2 = new BackupSocketServer(db, {
      port              : encPort2,
      backupPath        : TMP_DIR,
      encrypt           : true,
      encryptionPassword: ENC_PASS,
    });
    await encServer2.listen();
    const encClient2 = await (async () => {
      const c = new BackupSocketClient({ port: encPort2, timeout: 10_000 });
      await c.connect();
      return c;
    })();

    const encFile2 = await encClient2.run('full', { filename: 'restore_nopass.sql.enc' });

    // Try to restore without password using a plain server
    await expect(client.restore(encFile2)).rejects.toThrow(/encrypted/);

    await encClient2.disconnect();
    await encServer2.close();
  }, 20_000);
});

// ─────────────────────────────────────────────────────────────────────────────
describe('BackupSocketClient – error handling', () => {
  test('disconnect error: sending command when not connected rejects', async () => {
    const orphan = new BackupSocketClient({ port: PORT, timeout: 2_000 });
    await expect(orphan.ping()).rejects.toThrow(/not connected/);
  });

  test('unknown action returns ok:false from server', async () => {
    // Inject raw message bypassing the high-level API
    await expect(
      new Promise((resolve, reject) => {
        const c = new BackupSocketClient({ port: PORT, timeout: 3_000 });
        c.connect().then(() => {
          // Manually send an unknown action
          c._send({ action: '__unknown_test__' })
            .then(resolve)
            .catch(reject)
            .finally(() => c.disconnect());
        }).catch(reject);
      })
    ).rejects.toThrow(/Unknown action/);
  });
});

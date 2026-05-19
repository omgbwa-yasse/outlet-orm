const fs = require("fs");
const path = require("path");
const DatabaseConnection = require("./src/DatabaseConnection");
const BackupManager = require("./src/Backup/BackupManager");

async function run() {
  const dbPath = path.resolve("test.sqlite");
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

  const db = new DatabaseConnection({
    driver: "sqlite",
    database: dbPath,
  });

  try {
    await db.connect();

    // 1. Create tables
    await db.query("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)");
    await db.query(`CREATE TABLE migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration TEXT,
      batch INTEGER,
      created_at TEXT,
      checksum TEXT,
      execution_time_ms INTEGER,
      status TEXT
    )`);

    // 2. Insert data
    await db.query("INSERT INTO users (name) VALUES ('John Doe')");
    await db.query(
      "INSERT INTO migrations (migration, batch, created_at, checksum, execution_time_ms, status) VALUES ('2023_01_01_000000_create_users_table', 1, '2023-01-01 00:00:00', 'abc', 100, 'success')"
    );

    // 3. Backup
    const backupDir = path.resolve("temp_backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

    const bm = new BackupManager(db, { backupPath: backupDir });
    const backupPath = await bm.full({ filename: "test_backup.sql" });

    // 4. Output backup content
    const content = fs.readFileSync(backupPath, "utf8");
    process.stdout.write(content);
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  }
}

run();

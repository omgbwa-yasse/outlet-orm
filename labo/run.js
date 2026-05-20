'use strict';

const { runLab } = require('./src/lab');

async function main() {
  const keepData = process.argv.includes('--keep-data');
  const report = await runLab({ reset: !keepData });

  console.log('Outlet ORM labo');
  console.log('================');
  console.log(`Scenarios: ${report.totalScenarios}`);

  for (const result of report.results) {
    console.log(`- ${result.name}: OK (${result.durationMs}ms)`);
  }

  console.log('');
  console.log(`SQLite DB: ${report.paths.dbFile}`);
  console.log(`Backups:   ${report.paths.backupDir}`);
}

main().catch((error) => {
  console.error('Labo failure:', error);
  process.exitCode = 1;
});

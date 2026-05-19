module.exports = {
  driver: 'sqlite',
  database: 'database/outlet.sqlite',

  // ─────────────────────────────────────────────────────────────────────────
  // Migration safety options (added by feature 003-migration-data-preservation)
  // All fields are optional; defaults shown below take effect when omitted.
  // Override individual fields per-environment via env vars:
  //   OUTLET_AUTO_BACKUP=0|1            → autoBackupBeforeDestructive
  //   OUTLET_PRODUCTION_CONFIRM=1       → required in production
  //   OUTLET_ALLOW_DRIFT=1              → suppress drift block in prod
  //   OUTLET_ENV=development|production|test
  // ─────────────────────────────────────────────────────────────────────────
  migrations: {
    autoBackupBeforeDestructive: true,
    backupRetentionCount: 10,
    backupPath: 'database/backups',
    requireProductionConfirm: true,
    environment: undefined,  // undefined → auto-detected from OUTLET_ENV / NODE_ENV
    productionIndicators: {
      hosts: ['prod', 'production', 'live'],
      databasePatterns: ['_prod', '_production', '_live']
    }
  }
};

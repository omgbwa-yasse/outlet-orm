// DEPRECATED: This file is kept for backward compatibility only
// Please use: const { MigrationManager } = require('outlet-orm');
// This file will be removed in v6.0.0

console.warn(
  '[outlet-orm] DEPRECATION WARNING: ' +
  'Importing from "outlet-orm/lib/Migrations/MigrationManager" is deprecated. ' +
  'Use: const { MigrationManager } = require("outlet-orm"); instead. ' +
  'This path will be removed in v6.0.0'
);

module.exports = require('../../src/Migrations/MigrationManager');

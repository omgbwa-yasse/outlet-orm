// DEPRECATED: This file is kept for backward compatibility only
// Please use: const { Migration } = require('outlet-orm');
// This file will be removed in v6.0.0

console.warn(
  '[outlet-orm] DEPRECATION WARNING: ' +
  'Importing from "outlet-orm/lib/Migrations/Migration" is deprecated. ' +
  'Use: const { Migration } = require("outlet-orm"); instead. ' +
  'This path will be removed in v6.0.0'
);

module.exports = require('../../src/Migrations/Migration');

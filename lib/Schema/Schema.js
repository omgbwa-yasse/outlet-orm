// DEPRECATED: This file is kept for backward compatibility only
// Please use: const { Schema } = require('outlet-orm');
// This file will be removed in v6.0.0

console.warn(
  '[outlet-orm] DEPRECATION WARNING: ' +
  'Importing from "outlet-orm/lib/Schema/Schema" is deprecated. ' +
  'Use: const { Schema, Blueprint, ColumnDefinition, ForeignKeyDefinition } = require("outlet-orm"); instead. ' +
  'This path will be removed in v6.0.0'
);

module.exports = require('../../src/Schema/Schema');

const Model = require('./Model');
const QueryBuilder = require('./QueryBuilder');
const DatabaseConnection = require('./DatabaseConnection');

// Relations
const Relation = require('./Relations/Relation');
const HasOneRelation = require('./Relations/HasOneRelation');
const HasManyRelation = require('./Relations/HasManyRelation');
const BelongsToRelation = require('./Relations/BelongsToRelation');
const BelongsToManyRelation = require('./Relations/BelongsToManyRelation');
const HasManyThroughRelation = require('./Relations/HasManyThroughRelation');
const HasOneThroughRelation = require('./Relations/HasOneThroughRelation');
const MorphOneRelation = require('./Relations/MorphOneRelation');
const MorphManyRelation = require('./Relations/MorphManyRelation');
const MorphToRelation = require('./Relations/MorphToRelation');

// Schema & Migrations (v5.0.0 - moved from lib/)
const { Schema, Blueprint, ColumnDefinition, ForeignKeyDefinition } = require('./Schema/Schema');
const Migration = require('./Migrations/Migration');
const MigrationManager = require('./Migrations/MigrationManager');
const Seeder = require('./Seeders/Seeder');
const SeederManager = require('./Seeders/SeederManager');

module.exports = {
  // Core
  Model,
  QueryBuilder,
  DatabaseConnection,

  // Relations
  Relation,
  HasOneRelation,
  HasManyRelation,
  BelongsToRelation,
  BelongsToManyRelation,
  HasManyThroughRelation,
  HasOneThroughRelation,
  MorphOneRelation,
  MorphManyRelation,
  MorphToRelation,

  // Schema Builder (v5.0.0)
  Schema,
  Blueprint,
  ColumnDefinition,
  ForeignKeyDefinition,

  // Migrations (v5.0.0)
  Migration,
  MigrationManager,

  // Seeders
  Seeder,
  SeederManager
};

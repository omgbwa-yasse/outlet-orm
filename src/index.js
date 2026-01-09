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

module.exports = {
  Model,
  QueryBuilder,
  DatabaseConnection,
  Relation,
  HasOneRelation,
  HasManyRelation,
  BelongsToRelation,
  BelongsToManyRelation,
  HasManyThroughRelation,
  HasOneThroughRelation,
  MorphOneRelation,
  MorphManyRelation,
  MorphToRelation
};

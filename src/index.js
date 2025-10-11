const Model = require('./Model');
const QueryBuilder = require('./QueryBuilder');
const DatabaseConnection = require('./DatabaseConnection');

// Relations
const Relation = require('./Relations/Relation');
const HasOneRelation = require('./Relations/HasOneRelation');
const HasManyRelation = require('./Relations/HasManyRelation');
const BelongsToRelation = require('./Relations/BelongsToRelation');
const BelongsToManyRelation = require('./Relations/BelongsToManyRelation');

module.exports = {
  Model,
  QueryBuilder,
  DatabaseConnection,
  Relation,
  HasOneRelation,
  HasManyRelation,
  BelongsToRelation,
  BelongsToManyRelation
};

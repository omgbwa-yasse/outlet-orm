'use strict';

const { Model } = require('outlet-orm');

/**
 * Post model — outlet-orm simplified architecture example.
 *
 * Demonstrates a model that belongs to a User without any Repository
 * or Service layer in between.
 */
class Post extends Model {
  static table = 'posts';

  /**
   * Fields allowed for mass assignment.
   * @type {string[]}
   */
  static fillable = ['title', 'body', 'user_id', 'published'];

  /**
   * Type casts applied when reading from the database.
   * @type {Object}
   */
  static casts = {
    id: 'int',
    user_id: 'int',
    published: 'boolean',
    created_at: 'date',
    updated_at: 'date',
  };

  /**
   * Basic validation rules.
   * @type {Object}
   */
  static rules = {
    title: 'required|string',
    body: 'required|string',
    user_id: 'required',
  };

  /**
   * A post belongs to a User.
   * @returns {import('outlet-orm').BelongsToRelation}
   */
  user() {
    return this.belongsTo(require('./User'), 'user_id');
  }
}

module.exports = Post;

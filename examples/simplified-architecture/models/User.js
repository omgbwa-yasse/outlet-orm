'use strict';

const { Model } = require('outlet-orm');

/**
 * User model — outlet-orm simplified architecture example.
 *
 * Demonstrates direct Model usage without a Repository or Service layer.
 * Business logic (duplicate email check, password hashing) lives in the
 * controller that uses this model.
 */
class User extends Model {
  static table = 'users';

  /**
   * Fields allowed for mass assignment.
   * @type {string[]}
   */
  static fillable = ['name', 'email', 'password', 'role'];

  /**
   * Fields hidden from JSON serialisation (e.g. API responses).
   * @type {string[]}
   */
  static hidden = ['password'];

  /**
   * Type casts applied when reading from the database.
   * @type {Object}
   */
  static casts = {
    id: 'int',
    created_at: 'date',
    updated_at: 'date',
  };

  /**
   * Basic validation rules used with model.validate().
   * @type {Object}
   */
  static rules = {
    name: 'required|string',
    email: 'required|email',
    password: 'required|string',
  };

  /**
   * A user can have many Posts.
   * @returns {import('outlet-orm').HasManyRelation}
   */
  posts() {
    return this.hasMany(require('./Post'), 'user_id');
  }
}

module.exports = User;

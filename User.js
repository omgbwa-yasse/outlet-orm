const { Model } = require('outlet-orm');
const db = require('./database');

class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password'];
  static casts = {
    id: 'int',
    email_verified: 'boolean'
  };
  static connection = db;

  // Définissez vos relations ici
  // posts() {
  //   return this.hasMany(Post, 'user_id');
  // }
}

module.exports = User;

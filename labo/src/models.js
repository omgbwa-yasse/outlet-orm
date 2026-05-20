'use strict';

const Model = require('../../src/Model');

function buildModels(connection, eventLog) {
  class Country extends Model {
    static table = 'countries';
    static fillable = ['name', 'code'];
  }

  class User extends Model {
    static table = 'users';
    static fillable = ['name', 'email', 'password', 'age', 'status', 'is_admin'];
    static hidden = ['password'];
    static softDeletes = true;
    static casts = {
      id: 'int',
      age: 'int',
      is_admin: 'boolean'
    };
    static rules = {
      name: 'required|min:3',
      email: 'required|email'
    };

    profile() {
      return this.hasOne(Profile, 'user_id', 'id');
    }

    posts() {
      return this.hasMany(Post, 'user_id', 'id');
    }

    roles() {
      return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id');
    }

    comments() {
      return this.hasManyThrough(Comment, Post, 'user_id', 'post_id');
    }

    profileSetting() {
      return this.hasOneThrough(ProfileSetting, Profile, 'user_id', 'profile_id');
    }

    static scopeActive(query) {
      return query.where('status', 'active');
    }

    static scopeAdults(query, minAge = 18) {
      return query.where('age', '>=', minAge);
    }
  }

  class Profile extends Model {
    static table = 'profiles';
    static fillable = ['user_id', 'country_id', 'bio', 'timezone'];
    static casts = {
      id: 'int',
      user_id: 'int',
      country_id: 'int'
    };

    user() {
      return this.belongsTo(User, 'user_id', 'id');
    }

    country() {
      return this.belongsTo(Country, 'country_id', 'id');
    }

    setting() {
      return this.hasOne(ProfileSetting, 'profile_id', 'id');
    }
  }

  class ProfileSetting extends Model {
    static table = 'profile_settings';
    static fillable = ['profile_id', 'theme', 'digest_frequency'];
    static casts = {
      id: 'int',
      profile_id: 'int'
    };

    profile() {
      return this.belongsTo(Profile, 'profile_id', 'id');
    }
  }

  class Post extends Model {
    static table = 'posts';
    static fillable = ['user_id', 'title', 'body', 'status', 'views', 'featured'];
    static casts = {
      id: 'int',
      user_id: 'int',
      views: 'int',
      featured: 'boolean'
    };

    author() {
      return this.belongsTo(User, 'user_id', 'id');
    }

    comments() {
      return this.hasMany(Comment, 'post_id', 'id');
    }

    tags() {
      return this.belongsToMany(Tag, 'post_tags', 'post_id', 'tag_id');
    }

    mediaComments() {
      return this.morphMany(MediaComment, 'commentable');
    }
  }

  class Video extends Model {
    static table = 'videos';
    static fillable = ['user_id', 'title', 'url', 'status'];
    static casts = {
      id: 'int',
      user_id: 'int'
    };

    author() {
      return this.belongsTo(User, 'user_id', 'id');
    }

    mediaComments() {
      return this.morphMany(MediaComment, 'commentable');
    }
  }

  class Comment extends Model {
    static table = 'comments';
    static fillable = ['post_id', 'user_id', 'content'];
    static casts = {
      id: 'int',
      post_id: 'int',
      user_id: 'int'
    };

    post() {
      return this.belongsTo(Post, 'post_id', 'id');
    }

    author() {
      return this.belongsTo(User, 'user_id', 'id');
    }
  }

  class MediaComment extends Model {
    static table = 'media_comments';
    static fillable = ['commentable_type', 'commentable_id', 'user_id', 'content'];
    static casts = {
      id: 'int',
      commentable_id: 'int',
      user_id: 'int'
    };

    author() {
      return this.belongsTo(User, 'user_id', 'id');
    }

    commentable() {
      return this.morphTo('commentable');
    }
  }

  class Role extends Model {
    static table = 'roles';
    static fillable = ['name', 'description'];
    static casts = { id: 'int' };

    users() {
      return this.belongsToMany(User, 'user_roles', 'role_id', 'user_id');
    }
  }

  class Tag extends Model {
    static table = 'tags';
    static fillable = ['name'];
    static casts = { id: 'int' };

    posts() {
      return this.belongsToMany(Post, 'post_tags', 'tag_id', 'post_id');
    }
  }

  class UserObserver {
    creating() { eventLog.push('creating'); }
    created() { eventLog.push('created'); }
    updating() { eventLog.push('updating'); }
    updated() { eventLog.push('updated'); }
    saving() { eventLog.push('saving'); }
    saved() { eventLog.push('saved'); }
    deleting() { eventLog.push('deleting'); }
    deleted() { eventLog.push('deleted'); }
    restoring() { eventLog.push('restoring'); }
    restored() { eventLog.push('restored'); }
  }

  const models = { Country, User, Profile, ProfileSetting, Post, Video, Comment, MediaComment, Role, Tag };

  Object.values(models).forEach((CurrentModel) => {
    CurrentModel.connection = connection;
  });

  User.observe(UserObserver);
  Model.setMorphMap({ posts: Post, videos: Video });

  return models;
}

module.exports = { buildModels };

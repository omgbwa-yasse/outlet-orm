const { Model, DatabaseConnection } = require('../src/index');

// Configure database connection
const db = new DatabaseConnection({
  driver: 'mysql',
  host: 'localhost',
  database: 'test_app',
  user: 'root',
  password: '',
  port: 3306
});

// Define User model
class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'password', 'age', 'status'];
  static hidden = ['password'];
  static casts = {
    id: 'int',
    age: 'int',
    email_verified: 'boolean'
  };
  static connection = db;

  // Relationships
  posts() {
    return this.hasMany(Post, 'user_id', 'id');
  }

  profile() {
    return this.hasOne(Profile, 'user_id', 'id');
  }

  roles() {
    return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id');
  }
}

// Define Post model
class Post extends Model {
  static table = 'posts';
  static fillable = ['title', 'content', 'user_id', 'published'];
  static casts = {
    id: 'int',
    user_id: 'int',
    published: 'boolean'
  };
  static connection = db;

  author() {
    return this.belongsTo(User, 'user_id', 'id');
  }

  comments() {
    return this.hasMany(Comment, 'post_id', 'id');
  }
}

// Define Profile model
class Profile extends Model {
  static table = 'profiles';
  static fillable = ['bio', 'avatar', 'user_id'];
  static casts = {
    id: 'int',
    user_id: 'int'
  };
  static connection = db;

  user() {
    return this.belongsTo(User, 'user_id', 'id');
  }
}

// Define Comment model
class Comment extends Model {
  static table = 'comments';
  static fillable = ['content', 'post_id', 'user_id'];
  static casts = {
    id: 'int',
    post_id: 'int',
    user_id: 'int'
  };
  static connection = db;

  post() {
    return this.belongsTo(Post, 'post_id', 'id');
  }

  author() {
    return this.belongsTo(User, 'user_id', 'id');
  }
}

// Define Role model
class Role extends Model {
  static table = 'roles';
  static fillable = ['name', 'description'];
  static casts = {
    id: 'int'
  };
  static connection = db;

  users() {
    return this.belongsToMany(User, 'user_roles', 'role_id', 'user_id');
  }
}

// ==================== Usage Examples ====================

async function examples() {
  try {
    // ==================== CREATE ====================
    console.log('\n=== CREATE ===');
    
    // Create a single user
    const user = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'secret123',
      age: 30,
      status: 'active'
    });
    console.log('Created user:', user.toJSON());

    // Create using instance
    const user2 = new User();
    user2.setAttribute('name', 'Jane Doe');
    user2.setAttribute('email', 'jane@example.com');
    user2.setAttribute('password', 'secret456');
    await user2.save();
    console.log('Saved user:', user2.toJSON());

    // ==================== READ ====================
    console.log('\n=== READ ===');
    
    // Get all users
    const allUsers = await User.all();
    console.log('All users:', allUsers.length);

    // Find by ID
    const foundUser = await User.find(1);
    console.log('Found user:', foundUser ? foundUser.toJSON() : null);

    // Complex query
    const activeUsers = await User
      .where('status', 'active')
      .where('age', '>', 25)
      .orderBy('created_at', 'desc')
      .limit(10)
      .get();
    console.log('Active users:', activeUsers.length);

    // First result
    const firstUser = await User.first();
    console.log('First user:', firstUser ? firstUser.toJSON() : null);

    // Where In
    const specificUsers = await User.whereIn('id', [1, 2, 3]).get();
    console.log('Specific users:', specificUsers.length);

    // Count
    const userCount = await User.where('status', 'active').count();
    console.log('Active user count:', userCount);

    // ==================== UPDATE ====================
    console.log('\n=== UPDATE ===');
    
    // Update instance
    const userToUpdate = await User.find(1);
    if (userToUpdate) {
      userToUpdate.setAttribute('name', 'John Updated');
      await userToUpdate.save();
      console.log('Updated user:', userToUpdate.toJSON());
    }

    // Bulk update
    const updateResult = await User
      .where('status', 'pending')
      .update({ status: 'active' });
    console.log('Update result:', updateResult);

    // ==================== DELETE ====================
    console.log('\n=== DELETE ===');
    
    // Delete instance
    const userToDelete = await User.find(999);
    if (userToDelete) {
      const deleted = await userToDelete.destroy();
      console.log('User deleted:', deleted);
    }

    // Bulk delete
    const deleteResult = await User
      .where('status', 'banned')
      .delete();
    console.log('Delete result:', deleteResult);

    // ==================== RELATIONSHIPS ====================
    console.log('\n=== RELATIONSHIPS ===');
    
    // Has One
    const userWithProfile = await User.find(1);
    if (userWithProfile) {
      const profile = await userWithProfile.profile().get();
      console.log('User profile:', profile ? profile.toJSON() : null);
    }

    // Has Many
    const userWithPosts = await User.find(1);
    if (userWithPosts) {
      const posts = await userWithPosts.posts().get();
      console.log('User posts:', posts.length);
    }

    // Belongs To
    const post = await Post.find(1);
    if (post) {
      const author = await post.author().get();
      console.log('Post author:', author ? author.toJSON() : null);
    }

    // Belongs To Many
    const userWithRoles = await User.find(1);
    if (userWithRoles) {
      const roles = await userWithRoles.roles().get();
      console.log('User roles:', roles.length);
    }

    // ==================== EAGER LOADING ====================
    console.log('\n=== EAGER LOADING ===');
    
    const usersWithRelations = await User
      .with('posts', 'profile')
      .limit(5)
      .get();
    
    usersWithRelations.forEach(u => {
      console.log(`User: ${u.getAttribute('name')}`);
      console.log(`  Posts:`, u.relations.posts ? u.relations.posts.length : 0);
      console.log(`  Profile:`, u.relations.profile ? 'Yes' : 'No');
    });

    // ==================== PAGINATION ====================
    console.log('\n=== PAGINATION ===');
    
    const paginatedUsers = await User.paginate(1, 10);
    console.log('Pagination result:', {
      total: paginatedUsers.total,
      per_page: paginatedUsers.per_page,
      current_page: paginatedUsers.current_page,
      last_page: paginatedUsers.last_page,
      data_count: paginatedUsers.data.length
    });

    // ==================== ADVANCED QUERIES ====================
    console.log('\n=== ADVANCED QUERIES ===');
    
    // Multiple conditions
    const advancedQuery = await User
      .where('age', '>', 18)
      .where('status', 'active')
      .orWhere('role', 'admin')
      .whereNotNull('email_verified_at')
      .orderBy('name', 'asc')
      .orderBy('created_at', 'desc')
      .get();
    console.log('Advanced query results:', advancedQuery.length);

    // Check if exists
    const exists = await User.where('email', 'john@example.com').exists();
    console.log('User exists:', exists);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    // Close the database connection
    await db.close();
  }
}

// Run examples
if (require.main === module) {
  examples()
    .then(() => {
      console.log('\n✅ Examples completed!');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error running examples:', error);
      process.exit(1);
    });
}

module.exports = { User, Post, Profile, Comment, Role };

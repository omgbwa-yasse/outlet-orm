import { Model, DatabaseConnection } from 'outlet-orm';

// Configure database connection
const db = new DatabaseConnection({
  driver: 'mysql',
  host: 'localhost',
  database: 'test_app',
  user: 'root',
  password: '',
  port: 3306
});

// Define User model with TypeScript
class User extends Model {
  static readonly table = 'users';
  static readonly fillable = ['name', 'email', 'password', 'age'];
  static readonly hidden = ['password'];
  static readonly casts = {
    id: 'int' as const,
    age: 'int' as const,
    email_verified: 'boolean' as const
  };
  static readonly connection = db;

  posts() {
    return this.hasMany(Post, 'user_id');
  }

  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}

// Define Post model
class Post extends Model {
  static readonly table = 'posts';
  static readonly fillable = ['title', 'content', 'user_id'];
  static readonly casts = {
    id: 'int' as const,
    user_id: 'int' as const
  };
  static readonly connection = db;

  author() {
    return this.belongsTo(User, 'user_id');
  }
}

// Define Profile model
class Profile extends Model {
  static readonly table = 'profiles';
  static readonly fillable = ['bio', 'avatar', 'user_id'];
  static readonly casts = {
    id: 'int' as const,
    user_id: 'int' as const
  };
  static readonly connection = db;

  user() {
    return this.belongsTo(User, 'user_id');
  }
}

// Usage examples
async function main() {
  try {
    // Create a user
    const user = await User.create({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'secret123',
      age: 30
    });

    console.log('Created user:', user.toJSON());

    // Query users
    const activeUsers = await User
      .where('age', '>', 18)
      .orderBy('name')
      .limit(10)
      .get();

    console.log('Active users:', activeUsers.length);

    // Eager loading
    const usersWithPosts = await User.with('posts', 'profile').get();

    usersWithPosts.forEach((u: User) => {
      console.log(`User: ${u.getAttribute('name')}`);
      console.log('Posts:', u.relations.posts?.length || 0);
    });

    // Pagination
    const paginated = await User.paginate(1, 15);
    console.log('Pagination:', {
      total: paginated.total,
      page: paginated.current_page,
      items: paginated.data.length
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

main();

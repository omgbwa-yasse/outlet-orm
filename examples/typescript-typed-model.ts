/**
 * Outlet ORM - TypeScript Typed Model Example
 *
 * This example demonstrates how to create fully typed models
 * with type-safe getAttribute/setAttribute methods.
 */

import {
  Model,
  DatabaseConnection,
  HasManyRelation,
  HasOneRelation,
  BelongsToRelation,
  PaginationResult
} from 'outlet-orm';

// ==================== Type Definitions ====================

/** User model attributes interface */
interface UserAttributes {
  id: number;
  name: string;
  email: string;
  password: string;
  age?: number;
  role: 'admin' | 'user' | 'moderator';
  email_verified_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Post model attributes interface */
interface PostAttributes {
  id: number;
  title: string;
  content: string;
  user_id: number;
  published: boolean;
  published_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Profile model attributes interface */
interface ProfileAttributes {
  id: number;
  user_id: number;
  bio?: string;
  avatar?: string;
  website?: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== Model Definitions ====================

/**
 * User model with typed attributes
 */
class User extends Model<UserAttributes> {
  static readonly table = 'users';
  static readonly primaryKey = 'id';
  static readonly timestamps = true;

  static readonly fillable = ['name', 'email', 'password', 'age', 'role'];
  static readonly hidden = ['password'];

  static readonly casts = {
    id: 'int' as const,
    age: 'int' as const,
    email_verified_at: 'datetime' as const,
    created_at: 'datetime' as const,
    updated_at: 'datetime' as const
  };

  static readonly rules = {
    name: 'required|string|min:2|max:100',
    email: 'required|email',
    password: 'required|string|min:8',
    age: 'integer|min:0|max:150',
    role: 'in:admin,user,moderator'
  };

  // Typed relations
  posts(): HasManyRelation<Post> {
    return this.hasMany(Post, 'user_id');
  }

  profile(): HasOneRelation<Profile> {
    return this.hasOne(Profile, 'user_id');
  }
}

/**
 * Post model with typed attributes
 */
class Post extends Model<PostAttributes> {
  static readonly table = 'posts';
  static readonly timestamps = true;

  static readonly fillable = ['title', 'content', 'user_id', 'published'];

  static readonly casts = {
    id: 'int' as const,
    user_id: 'int' as const,
    published: 'boolean' as const,
    published_at: 'datetime' as const
  };

  author(): BelongsToRelation<User> {
    return this.belongsTo(User, 'user_id');
  }
}

/**
 * Profile model with typed attributes
 */
class Profile extends Model<ProfileAttributes> {
  static readonly table = 'profiles';
  static readonly timestamps = true;

  static readonly fillable = ['user_id', 'bio', 'avatar', 'website'];

  static readonly casts = {
    id: 'int' as const,
    user_id: 'int' as const
  };

  user(): BelongsToRelation<User> {
    return this.belongsTo(User, 'user_id');
  }
}

// ==================== Usage Examples ====================

async function typedModelExamples() {
  // ----------------------
  // Type-safe getAttribute
  // ----------------------

  const user = await User.find(1);

  if (user) {
    // ✅ These are type-safe - TypeScript knows the types
    const name: string = user.getAttribute('name');
    const email: string = user.getAttribute('email');
    const age: number | undefined = user.getAttribute('age');
    const role: 'admin' | 'user' | 'moderator' = user.getAttribute('role');

    console.log(`User: ${name} (${email}), Age: ${age}, Role: ${role}`);

    // ✅ Type-safe setAttribute
    user.setAttribute('name', 'New Name');
    user.setAttribute('age', 30);
    // user.setAttribute('age', 'invalid'); // ❌ TypeScript error!

    await user.save();
  }

  // ----------------------
  // Type-safe create
  // ----------------------

  const newUser = await User.create({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'hashedpassword123',
    role: 'user'
    // role: 'invalid' // ❌ TypeScript would error on invalid role
  });

  console.log('Created user ID:', newUser.getAttribute('id'));

  // ----------------------
  // Type-safe queries
  // ----------------------

  // Query returns typed array
  const activeUsers: User[] = await User
    .where('role', 'user')
    .where('age', '>', 18)
    .orderBy('created_at', 'desc')
    .limit(10)
    .get();

  // Each user in the array is typed
  for (const u of activeUsers) {
    const userEmail: string = u.getAttribute('email');
    console.log(`Active user: ${userEmail}`);
  }

  // ----------------------
  // Type-safe pagination
  // ----------------------

  const paginated: PaginationResult<User> = await User.paginate(1, 15);

  console.log(`Page ${paginated.current_page} of ${paginated.last_page}`);
  console.log(`Showing ${paginated.data.length} of ${paginated.total} users`);

  // paginated.data is User[]
  paginated.data.forEach(u => {
    console.log(`- ${u.getAttribute('name')}`);
  });

  // ----------------------
  // Type-safe relations
  // ----------------------

  const usersWithPosts = await User.with('posts', 'profile').get();

  for (const u of usersWithPosts) {
    const posts = u.relations.posts as Post[];
    const profile = u.relations.profile as Profile | null;

    console.log(`${u.getAttribute('name')} has ${posts.length} posts`);

    if (profile) {
      console.log(`Bio: ${profile.getAttribute('bio')}`);
    }
  }

  // ----------------------
  // Type-safe validation
  // ----------------------

  const invalidUser = new User({
    name: 'J', // Too short (min:2)
    email: 'not-an-email'
  });

  const validationResult = invalidUser.validate();

  if (!validationResult.valid) {
    console.log('Validation errors:', validationResult.errors);
    // { name: ['min:2'], email: ['email'] }
  }

  // ----------------------
  // toJSON returns typed object
  // ----------------------

  const userJson: UserAttributes = newUser.toJSON();
  console.log('User JSON:', JSON.stringify(userJson, null, 2));
}

// Run examples
typedModelExamples()
  .then(() => console.log('Examples completed'))
  .catch(console.error);

export { User, Post, Profile };
export type { UserAttributes, PostAttributes, ProfileAttributes };

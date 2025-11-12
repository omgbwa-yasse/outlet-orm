const { Model, DatabaseConnection } = require('../src');

// Configure database connection
const db = new DatabaseConnection({
  driver: 'sqlite',
  database: ':memory:'
});

// Define User model with hidden attributes
class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'password', 'api_token'];
  static hidden = ['password', 'api_token'];
  static casts = {
    id: 'int'
  };
  static connection = db;
}

async function demo() {
  try {
    console.log('=== Hidden Attributes Demo ===\n');

    // Create table
    await db.execute(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        api_token TEXT,
        created_at DATETIME,
        updated_at DATETIME
      )
    `);

    // Insert test data
    await User.insert([
      {
        name: 'John Doe',
        email: 'john@example.com',
        password: 'hashed_password_123',
        api_token: 'secret_token_abc'
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        password: 'hashed_password_456',
        api_token: 'secret_token_def'
      }
    ]);

    console.log('1. Default behavior - Hidden attributes are masked:\n');
    const users = await User.all();
    console.log('Users as JSON:');
    users.forEach(user => {
      console.log(user.toJSON());
    });
    console.log('✓ password and api_token are hidden\n');

    console.log('2. Using withHidden() - Show all attributes:\n');
    const usersWithHidden = await User.withHidden().get();
    console.log('Users with hidden attributes:');
    usersWithHidden.forEach(user => {
      console.log(user.toJSON());
    });
    console.log('✓ password and api_token are visible\n');

    console.log('3. Authentication example - Fetch user with password:\n');
    const authenticatingUser = await User.withHidden()
      .where('email', 'john@example.com')
      .first();

    if (authenticatingUser) {
      console.log('User for authentication:');
      console.log({
        email: authenticatingUser.getAttribute('email'),
        password: authenticatingUser.getAttribute('password'),
        passwordLength: authenticatingUser.getAttribute('password').length
      });
      console.log('✓ Can access password for verification\n');
    }

    console.log('4. API Response example - Hide sensitive data:\n');
    const apiUsers = await User.where('name', 'Jane Smith').get();
    console.log('API Response:');
    console.log(JSON.stringify(apiUsers.map(u => u.toJSON()), null, 2));
    console.log('✓ Safe to send to client - no sensitive data\n');

    console.log('5. Using withoutHidden(true) - Alternative syntax:\n');
    const usersAlt = await User.withoutHidden(true).get();
    console.log('Users with withoutHidden(true):');
    console.log(usersAlt[0].toJSON());
    console.log('✓ Shows hidden attributes when passed true\n');

    console.log('6. Using withoutHidden(false) - Explicit hiding:\n');
    const usersHidden = await User.withoutHidden(false).get();
    console.log('Users with withoutHidden(false):');
    console.log(usersHidden[0].toJSON());
    console.log('✓ Hides attributes when passed false (default behavior)\n');

    console.log('7. Chaining with other query methods:\n');
    const specificUser = await User.withHidden()
      .where('email', 'jane@example.com')
      .orderBy('name')
      .first();

    if (specificUser) {
      console.log('Chained query result:');
      console.log(specificUser.toJSON());
      console.log('✓ Works seamlessly with query builder methods\n');
    }

    console.log('=== Demo completed successfully! ===');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  } finally {
    await db.close();
  }
}

// Run the demo
demo();

const Model = require('../src/Model');

// Mock DatabaseConnection for testing
class MockConnection {
  async select(_table, _query) {
    // Return mock user data with password
    return [
      { id: 1, name: 'John', email: 'john@test.com', password: 'secret123' },
      { id: 2, name: 'Jane', email: 'jane@test.com', password: 'secret456' }
    ];
  }

  async insert(_table, _data) {
    return { insertId: 1, affectedRows: 1 };
  }
}

// Test model with hidden attributes
class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'password'];
  static hidden = ['password'];
  static connection = new MockConnection();
}

describe('withHidden and withoutHidden Methods', () => {
  describe('withHidden()', () => {
    test('should include hidden attributes in results', async () => {
      const users = await User.withHidden().get();

      expect(users).toHaveLength(2);

      const json1 = users[0].toJSON();
      expect(json1).toHaveProperty('name', 'John');
      expect(json1).toHaveProperty('email', 'john@test.com');
      expect(json1).toHaveProperty('password', 'secret123');

      const json2 = users[1].toJSON();
      expect(json2).toHaveProperty('password', 'secret456');
    });

    test('should work with first()', async () => {
      const user = await User.withHidden().first();

      expect(user).not.toBeNull();
      const json = user.toJSON();
      expect(json).toHaveProperty('password', 'secret123');
    });

    test('should work with where() chaining', async () => {
      const users = await User.withHidden().where('name', 'John').get();

      expect(users).toHaveLength(2);
      const json = users[0].toJSON();
      expect(json).toHaveProperty('password', 'secret123');
    });
  });

  describe('withoutHidden()', () => {
    test('should hide attributes by default (false)', async () => {
      const users = await User.withoutHidden().get();

      expect(users).toHaveLength(2);

      const json1 = users[0].toJSON();
      expect(json1).toHaveProperty('name', 'John');
      expect(json1).toHaveProperty('email', 'john@test.com');
      expect(json1).not.toHaveProperty('password');

      const json2 = users[1].toJSON();
      expect(json2).not.toHaveProperty('password');
    });

    test('should hide attributes when passed false', async () => {
      const users = await User.withoutHidden(false).get();

      const json = users[0].toJSON();
      expect(json).not.toHaveProperty('password');
    });

    test('should show attributes when passed true', async () => {
      const users = await User.withoutHidden(true).get();

      const json = users[0].toJSON();
      expect(json).toHaveProperty('password', 'secret123');
    });
  });

  describe('Default behavior', () => {
    test('should hide attributes by default without any method call', async () => {
      const users = await User.all();

      const json = users[0].toJSON();
      expect(json).toHaveProperty('name', 'John');
      expect(json).not.toHaveProperty('password');
    });

    test('should hide attributes with where() without withHidden', async () => {
      const users = await User.where('id', 1).get();

      const json = users[0].toJSON();
      expect(json).not.toHaveProperty('password');
    });
  });

  describe('Real-world use cases', () => {
    test('should allow fetching user with password for authentication', async () => {
      // Typical authentication scenario
      const user = await User.withHidden().where('email', 'john@test.com').first();

      expect(user).not.toBeNull();
      expect(user.getAttribute('password')).toBe('secret123');

      // Can access password directly for verification
      const json = user.toJSON();
      expect(json).toHaveProperty('password', 'secret123');
    });

    test('should hide password when returning users to API', async () => {
      // Typical API response scenario
      const users = await User.all();

      // Convert to JSON for API response
      const jsonData = users.map(u => u.toJSON());

      jsonData.forEach(userData => {
        expect(userData).toHaveProperty('name');
        expect(userData).toHaveProperty('email');
        expect(userData).not.toHaveProperty('password');
      });
    });
  });
});

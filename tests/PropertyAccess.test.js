const Model = require('../src/Model');
const DatabaseConnection = require('../src/DatabaseConnection');

// Mock database connection
class MockConnection extends DatabaseConnection {
  constructor() {
    super({ driver: 'mock' });
  }
  async connect() {}
  async select() {
    return [
      { id: 1, name: 'Alice', email: 'alice@example.com', age: 28, password: 'secret' },
      { id: 2, name: 'Bob', email: 'bob@example.com', age: 35, password: 'hidden' }
    ];
  }
  async insert(_table, _data) {
    return { insertId: 10, affectedRows: 1 };
  }
  async update() {
    return { affectedRows: 1 };
  }
  async delete() {
    return { affectedRows: 1 };
  }
  async count() {
    return 2;
  }
}

class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'age', 'password'];
  static hidden = ['password'];
  static casts = { id: 'int', age: 'int' };
  static connection = new MockConnection();

  // Accessor: get{Key}Attribute
  getNameAttribute(value) {
    return value ? value.toUpperCase() : value;
  }

  // Mutator: set{Key}Attribute
  setEmailAttribute(value) {
    this.attributes.email = value ? value.toLowerCase().trim() : value;
  }
}

describe('Property-style attribute access (Proxy)', () => {

  // ---------- READ ----------

  test('read attribute via dot notation', () => {
    const user = new User({ name: 'Alice', email: 'alice@test.com' });
    // Accessor uppercases
    expect(user.name).toBe('ALICE');
  });

  test('read attribute via getAttribute still works', () => {
    const user = new User({ name: 'Alice' });
    expect(user.getAttribute('name')).toBe('ALICE');
  });

  test('read undefined attribute returns undefined', () => {
    const user = new User();
    expect(user.nonexistent).toBeUndefined();
  });

  test('read casted attribute via dot notation', () => {
    const user = new User({ age: '42' });
    expect(user.age).toBe(42);
    expect(typeof user.age).toBe('number');
  });

  // ---------- WRITE ----------

  test('write attribute via dot notation', () => {
    const user = new User();
    user.name = 'Bob';
    expect(user.getAttribute('name')).toBe('BOB');
  });

  test('write triggers mutator', () => {
    const user = new User();
    user.email = '  UPPER@Test.COM  ';
    expect(user.getAttribute('email')).toBe('upper@test.com');
  });

  test('setAttribute still works', () => {
    const user = new User();
    user.setAttribute('name', 'Charlie');
    expect(user.name).toBe('CHARLIE');
  });

  test('write casts attribute', () => {
    const user = new User();
    user.age = '30';
    expect(user.age).toBe(30);
  });

  // ---------- INTERNAL PROPERTIES ----------

  test('exists property is accessible and writable', () => {
    const user = new User();
    expect(user.exists).toBe(false);
    user.exists = true;
    expect(user.exists).toBe(true);
  });

  test('attributes object is directly accessible', () => {
    const user = new User({ name: 'Test' });
    expect(user.attributes).toBeDefined();
    expect(typeof user.attributes).toBe('object');
  });

  test('internal properties are not redirected to setAttribute', () => {
    const user = new User();
    user.original = { foo: 'bar' };
    expect(user.original).toEqual({ foo: 'bar' });
    // Should NOT appear in attributes
    expect(user.attributes.original).toBeUndefined();
  });

  // ---------- METHODS ----------

  test('instance methods remain accessible', () => {
    const user = new User({ name: 'Test' });
    expect(typeof user.save).toBe('function');
    expect(typeof user.fill).toBe('function');
    expect(typeof user.destroy).toBe('function');
    expect(typeof user.toJSON).toBe('function');
    expect(typeof user.validate).toBe('function');
    expect(typeof user.getDirty).toBe('function');
  });

  test('relationship methods remain accessible', () => {
    const user = new User();
    expect(typeof user.hasOne).toBe('function');
    expect(typeof user.hasMany).toBe('function');
    expect(typeof user.belongsTo).toBe('function');
    expect(typeof user.belongsToMany).toBe('function');
  });

  // ---------- instanceof ----------

  test('instanceof check works through Proxy', () => {
    const user = new User({ name: 'Test' });
    expect(user instanceof User).toBe(true);
    expect(user instanceof Model).toBe(true);
  });

  // ---------- SAVE FLOW ----------

  test('property write then save works end-to-end', async () => {
    const user = new User({ name: 'Init', email: 'init@test.com' });
    await user.save();
    expect(user.exists).toBe(true);

    // Update via property
    user.name = 'Updated';
    expect(user.name).toBe('UPDATED');
    expect(user.isDirty()).toBe(true);

    await user.save();
    expect(user.isDirty()).toBe(false);
  });

  // ---------- toJSON ----------

  test('toJSON still respects hidden attributes', () => {
    const user = new User({ name: 'Alice', email: 'a@b.com', password: 'secret' });
    const json = user.toJSON();
    expect(json.password).toBeUndefined();
    expect(json.email).toBe('a@b.com');
  });

  // ---------- HYDRATE (QueryBuilder path) ----------

  test('hydrated models support property access', async () => {
    const users = await User.all();
    expect(users[0].name).toBe('ALICE');
    expect(users[0].email).toBe('alice@example.com');
    expect(users[0].age).toBe(28);
    expect(users[0].exists).toBe(true);
  });

  // ---------- DIRTY TRACKING ----------

  test('dirty tracking works with property writes', () => {
    const user = new User({ name: 'Before', email: 'e@e.com' });
    user.original = { ...user.attributes };
    user.name = 'After';
    const dirty = user.getDirty();
    expect(dirty).toHaveProperty('name');
  });
});

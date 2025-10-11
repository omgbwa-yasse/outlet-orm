const Model = require('../src/Model');
const QueryBuilder = require('../src/QueryBuilder');
const DatabaseConnection = require('../src/DatabaseConnection');

// Mock database connection
class MockConnection extends DatabaseConnection {
  constructor() {
    super({ driver: 'mock' });
  }

  async connect() {
    // Mock connect
  }

  async select(table, query) {
    return [
      { id: 1, name: 'John Doe', email: 'john@example.com', age: 30 },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com', age: 25 }
    ];
  }

  async insert(table, data) {
    return { insertId: 1, affectedRows: 1 };
  }

  async update(table, data, query) {
    return { affectedRows: 1 };
  }

  async delete(table, query) {
    return { affectedRows: 1 };
  }

  async count(table, query) {
    return 2;
  }
}

// Test Model
class TestUser extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'age'];
  static casts = {
    id: 'int',
    age: 'int'
  };
  static connection = new MockConnection();
}

describe('Model', () => {
  describe('Query Builder Methods', () => {
    test('should return QueryBuilder instance', () => {
      const query = TestUser.query();
      expect(query).toBeInstanceOf(QueryBuilder);
    });

    test('should get all records', async () => {
      const users = await TestUser.all();
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBeGreaterThan(0);
    });

    test('should find record by ID', async () => {
      const user = await TestUser.find(1);
      expect(user).toBeDefined();
      expect(user.getAttribute('id')).toBe(1);
    });

    test('should count records', async () => {
      const count = await TestUser.count();
      expect(typeof count).toBe('number');
    });
  });

  describe('Instance Methods', () => {
    test('should create new instance with attributes', () => {
      const user = new TestUser({ name: 'John', email: 'john@test.com' });
      expect(user.getAttribute('name')).toBe('John');
      expect(user.getAttribute('email')).toBe('john@test.com');
    });

    test('should fill attributes', () => {
      const user = new TestUser();
      user.fill({ name: 'Jane', email: 'jane@test.com' });
      expect(user.getAttribute('name')).toBe('Jane');
    });

    test('should set and get attributes', () => {
      const user = new TestUser();
      user.setAttribute('name', 'Bob');
      expect(user.getAttribute('name')).toBe('Bob');
    });

    test('should cast attributes', () => {
      const user = new TestUser();
      user.setAttribute('age', '30');
      expect(user.getAttribute('age')).toBe(30);
      expect(typeof user.getAttribute('age')).toBe('number');
    });

    test('should detect dirty attributes', () => {
      const user = new TestUser({ name: 'John' });
      user.original = { name: 'John' };
      expect(user.isDirty()).toBe(false);

      user.setAttribute('name', 'Jane');
      expect(user.isDirty()).toBe(true);
    });

    test('should convert to JSON', () => {
      const user = new TestUser({ name: 'John', email: 'john@test.com' });
      const json = user.toJSON();
      expect(json).toHaveProperty('name', 'John');
      expect(json).toHaveProperty('email', 'john@test.com');
    });
  });

  describe('Attribute Casting', () => {
    class CastModel extends Model {
      static casts = {
        id: 'int',
        age: 'integer',
        balance: 'float',
        active: 'boolean',
        metadata: 'json',
        birthday: 'date'
      };
    }

    test('should cast to integer', () => {
      const model = new CastModel();
      model.setAttribute('id', '123');
      expect(model.getAttribute('id')).toBe(123);
    });

    test('should cast to float', () => {
      const model = new CastModel();
      model.setAttribute('balance', '123.45');
      expect(model.getAttribute('balance')).toBe(123.45);
    });

    test('should cast to boolean', () => {
      const model = new CastModel();
      model.setAttribute('active', 1);
      expect(model.getAttribute('active')).toBe(true);
    });

    test('should cast to JSON', () => {
      const model = new CastModel();
      model.setAttribute('metadata', '{"key": "value"}');
      const metadata = model.getAttribute('metadata');
      expect(metadata).toEqual({ key: 'value' });
    });

    test('should cast to date', () => {
      const model = new CastModel();
      model.setAttribute('birthday', '2000-01-01');
      expect(model.getAttribute('birthday')).toBeInstanceOf(Date);
    });
  });
});

describe('QueryBuilder', () => {
  let query;

  beforeEach(() => {
    query = new QueryBuilder(TestUser);
  });

  test('should add where clause', () => {
    query.where('name', 'John');
    expect(query.wheres).toHaveLength(1);
    expect(query.wheres[0]).toMatchObject({
      column: 'name',
      operator: '=',
      value: 'John'
    });
  });

  test('should add where in clause', () => {
    query.whereIn('id', [1, 2, 3]);
    expect(query.wheres).toHaveLength(1);
    expect(query.wheres[0]).toMatchObject({
      column: 'id',
      values: [1, 2, 3],
      type: 'in'
    });
  });

  test('should add order by clause', () => {
    query.orderBy('name', 'desc');
    expect(query.orders).toHaveLength(1);
    expect(query.orders[0]).toMatchObject({
      column: 'name',
      direction: 'desc'
    });
  });

  test('should set limit', () => {
    query.limit(10);
    expect(query.limitValue).toBe(10);
  });

  test('should set offset', () => {
    query.offset(5);
    expect(query.offsetValue).toBe(5);
  });

  test('should chain methods', () => {
    const result = query
      .where('age', '>', 18)
      .orderBy('name')
      .limit(10);
    
    expect(result).toBe(query);
    expect(query.wheres).toHaveLength(1);
    expect(query.orders).toHaveLength(1);
    expect(query.limitValue).toBe(10);
  });

  test('should build query object', () => {
    query
      .select('id', 'name')
      .where('age', '>', 18)
      .orderBy('name');
    
    const built = query.buildQuery();
    expect(built).toHaveProperty('columns', ['id', 'name']);
    expect(built).toHaveProperty('wheres');
    expect(built).toHaveProperty('orders');
  });
});

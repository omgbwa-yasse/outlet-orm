/**
 * Tests for all 15 new evolution features
 */

// ==================== Setup ====================

const Model = require('../src/Model');
const QueryBuilder = require('../src/QueryBuilder');
const Relation = require('../src/Relations/Relation');
const HasOneRelation = require('../src/Relations/HasOneRelation');

// Mock DatabaseConnection
const mockConnection = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  aggregate: jest.fn(),
  increment: jest.fn(),
  decrement: jest.fn(),
};

class User extends Model {
  static table = 'users';
  static primaryKey = 'id';
  static fillable = ['name', 'email', 'age', 'password'];
  static hidden = ['password'];
  static casts = { age: 'integer' };
  static connection = mockConnection;
  static appends = ['full_title'];

  // Accessor for appended attribute
  getFullTitleAttribute() {
    return `Mr/Ms ${this.attributes.name || ''}`;
  }

  // Accessor
  getNameAttribute(value) {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }

  // Local scope
  static scopeActive(query) {
    query.where('active', 1);
  }

  // Local scope with parameter
  static scopeOlderThan(query, age) {
    query.where('age', '>', age);
  }
}

class Post extends Model {
  static table = 'posts';
  static primaryKey = 'id';
  static fillable = ['title', 'body', 'user_id'];
  static connection = mockConnection;
}

class Profile extends Model {
  static table = 'profiles';
  static primaryKey = 'id';
  static fillable = ['bio', 'user_id'];
  static connection = mockConnection;
}

beforeEach(() => {
  jest.clearAllMocks();
  // Reset event listeners to avoid cross-test pollution
  User.eventListeners = {
    creating: [], created: [], updating: [], updated: [],
    saving: [], saved: [], deleting: [], deleted: [],
    restoring: [], restored: []
  };
  Post.eventListeners = {
    creating: [], created: [], updating: [], updated: [],
    saving: [], saved: [], deleting: [], deleted: [],
    restoring: [], restored: []
  };
});

// ==================== 1. fresh() / refresh() ====================

describe('fresh() and refresh()', () => {
  test('fresh() returns a new model instance from DB', async () => {
    const user = new User({ name: 'Alice', email: 'alice@test.com' });
    user.attributes.id = 1;
    user.exists = true;
    user.original = { ...user.attributes };

    mockConnection.select.mockResolvedValue([
      { id: 1, name: 'Alice Updated', email: 'alice@test.com' }
    ]);

    const freshUser = await user.fresh();
    expect(freshUser).not.toBe(user);
    expect(freshUser.getAttribute('name')).toBe('Alice Updated');
  });

  test('fresh() returns null if model does not exist', async () => {
    const user = new User({ name: 'Bob' });
    const result = await user.fresh();
    expect(result).toBeNull();
  });

  test('refresh() updates the current instance in place', async () => {
    const user = new User({ name: 'Charlie' });
    user.attributes.id = 2;
    user.exists = true;
    user.original = { ...user.attributes };

    mockConnection.select.mockResolvedValue([
      { id: 2, name: 'Charlie Refreshed', email: 'charlie@test.com' }
    ]);

    const result = await user.refresh();
    expect(result).toBe(user);
    expect(user.attributes.name).toBe('Charlie Refreshed');
    expect(user.original.name).toBe('Charlie Refreshed');
    // Relations should be cleared
    expect(user.relations).toEqual({});
  });

  test('refresh() does nothing if model does not exist', async () => {
    const user = new User({ name: 'Dave' });
    const result = await user.refresh();
    expect(result).toBe(user);
    expect(mockConnection.select).not.toHaveBeenCalled();
  });
});

// ==================== 2. pluck() / value() ====================

describe('pluck() and value()', () => {
  test('pluck() returns array of values for a column', async () => {
    mockConnection.select.mockResolvedValue([
      { name: 'Alice' }, { name: 'Bob' }, { name: 'Charlie' }
    ]);

    const qb = new QueryBuilder(User);
    const result = await qb.pluck('name');
    expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
  });

  test('pluck() with key column returns keyed object', async () => {
    mockConnection.select.mockResolvedValue([
      { name: 'Alice', id: 1 }, { name: 'Bob', id: 2 }
    ]);

    const qb = new QueryBuilder(User);
    const result = await qb.pluck('name', 'id');
    expect(result).toEqual({ 1: 'Alice', 2: 'Bob' });
  });

  test('value() returns single value from first row', async () => {
    mockConnection.select.mockResolvedValue([
      { email: 'alice@test.com' }
    ]);

    const qb = new QueryBuilder(User);
    const result = await qb.value('email');
    expect(result).toBe('alice@test.com');
  });

  test('value() returns null when no rows', async () => {
    mockConnection.select.mockResolvedValue([]);

    const qb = new QueryBuilder(User);
    const result = await qb.value('email');
    expect(result).toBeNull();
  });
});

// ==================== 3. sum() / avg() / min() / max() ====================

describe('Aggregate methods', () => {
  test('sum() returns sum of a column', async () => {
    mockConnection.aggregate.mockResolvedValue(150);
    const qb = new QueryBuilder(User);
    const result = await qb.sum('age');
    expect(result).toBe(150);
    expect(mockConnection.aggregate).toHaveBeenCalledWith('users', 'SUM', 'age', expect.any(Object));
  });

  test('avg() returns average of a column', async () => {
    mockConnection.aggregate.mockResolvedValue(30);
    const qb = new QueryBuilder(User);
    const result = await qb.avg('age');
    expect(result).toBe(30);
    expect(mockConnection.aggregate).toHaveBeenCalledWith('users', 'AVG', 'age', expect.any(Object));
  });

  test('min() returns minimum of a column', async () => {
    mockConnection.aggregate.mockResolvedValue(18);
    const qb = new QueryBuilder(User);
    const result = await qb.min('age');
    expect(result).toBe(18);
    expect(mockConnection.aggregate).toHaveBeenCalledWith('users', 'MIN', 'age', expect.any(Object));
  });

  test('max() returns maximum of a column', async () => {
    mockConnection.aggregate.mockResolvedValue(65);
    const qb = new QueryBuilder(User);
    const result = await qb.max('age');
    expect(result).toBe(65);
    expect(mockConnection.aggregate).toHaveBeenCalledWith('users', 'MAX', 'age', expect.any(Object));
  });
});

// ==================== 4. replicate() ====================

describe('replicate()', () => {
  test('creates a copy without primary key', () => {
    const user = new User();
    user.attributes = { id: 5, name: 'Eve', email: 'eve@test.com', age: 30 };
    user.exists = true;

    const replica = user.replicate();
    expect(replica.getAttribute('name')).toBe('Eve');
    expect(replica.getAttribute('email')).toBe('eve@test.com');
    expect(replica.attributes.id).toBeUndefined();
    expect(replica.exists).toBe(false);
  });

  test('replicate() excludes extra attributes', () => {
    const user = new User();
    user.attributes = { id: 5, name: 'Eve', email: 'eve@test.com', age: 30, password: 'secret' };

    const replica = user.replicate('email');
    expect(replica.attributes.id).toBeUndefined();
    expect(replica.attributes.email).toBeUndefined();
    expect(replica.attributes.name).toBe('Eve');
  });
});

// ==================== 5. only() / except() ====================

describe('only() and except()', () => {
  test('only() returns subset of attributes', () => {
    const user = new User();
    user.attributes = { id: 1, name: 'Alice', email: 'a@b.com', age: 25 };

    const result = user.only('name', 'email');
    expect(result).toEqual({ name: 'Alice', email: 'a@b.com' });
    expect(result.id).toBeUndefined();
  });

  test('only() accepts an array', () => {
    const user = new User();
    user.attributes = { id: 1, name: 'Alice', email: 'a@b.com' };

    const result = user.only(['name', 'email']);
    expect(result).toEqual({ name: 'Alice', email: 'a@b.com' });
  });

  test('except() returns all attributes except specified', () => {
    const user = new User();
    user.attributes = { id: 1, name: 'Alice', email: 'a@b.com', age: 25 };

    const result = user.except('id', 'age');
    expect(result).toEqual({ name: 'Alice', email: 'a@b.com' });
  });
});

// ==================== 6. appends ====================

describe('appends', () => {
  test('toJSON includes appended computed attributes', () => {
    const user = new User();
    user.attributes = { id: 1, name: 'Alice', email: 'a@b.com' };

    const json = user.toJSON();
    expect(json.full_title).toBe('Mr/Ms Alice');
  });

  test('appends work alongside hidden attributes', () => {
    const user = new User();
    user.attributes = { id: 1, name: 'Alice', password: 'secret' };

    const json = user.toJSON();
    expect(json.full_title).toBe('Mr/Ms Alice');
    expect(json.password).toBeUndefined();
  });
});

// ==================== 7. makeVisible() / makeHidden() ====================

describe('makeVisible() and makeHidden()', () => {
  test('makeVisible() reveals hidden attributes on instance', () => {
    const user = new User();
    user.attributes = { id: 1, name: 'Alice', password: 'secret' };

    user.makeVisible('password');
    const json = user.toJSON();
    expect(json.password).toBe('secret');
  });

  test('makeHidden() hides additional attributes on instance', () => {
    const user = new User();
    user.attributes = { id: 1, name: 'Alice', email: 'a@b.com', password: 'secret' };

    user.makeHidden('email');
    const json = user.toJSON();
    expect(json.email).toBeUndefined();
    expect(json.password).toBeUndefined(); // still hidden from static hidden
  });

  test('makeVisible returns this for chaining', () => {
    const user = new User();
    user.attributes = { id: 1, name: 'Alice', password: 'secret' };
    const result = user.makeVisible('password');
    expect(result).toBe(user);
  });

  test('makeHidden returns this for chaining', () => {
    const user = new User();
    user.attributes = { id: 1, name: 'Alice' };
    const result = user.makeHidden('name');
    expect(result).toBe(user);
  });
});

// ==================== 8. chunk() ====================

describe('chunk()', () => {
  test('processes results in chunks', async () => {
    const batch1 = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
    const batch2 = [{ id: 3, name: 'C' }];

    mockConnection.select
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2);

    const qb = new QueryBuilder(User);
    const chunks = [];

    await qb.chunk(2, (chunk, page) => {
      chunks.push({ data: chunk, page });
    });

    expect(chunks).toHaveLength(2);
    expect(chunks[0].page).toBe(1);
    expect(chunks[1].page).toBe(2);
  });

  test('chunk stops when callback returns false', async () => {
    const batch1 = [{ id: 1 }, { id: 2 }];
    const batch2 = [{ id: 3 }, { id: 4 }];

    mockConnection.select
      .mockResolvedValueOnce(batch1)
      .mockResolvedValueOnce(batch2);

    const qb = new QueryBuilder(User);
    const chunks = [];

    await qb.chunk(2, (chunk, page) => {
      chunks.push(page);
      return false; // stop after first chunk
    });

    expect(chunks).toEqual([1]);
  });
});

// ==================== 9. is() / isNot() ====================

describe('is() and isNot()', () => {
  test('is() returns true for same model identity', () => {
    const user1 = new User();
    user1.attributes = { id: 5, name: 'Alice' };

    const user2 = new User();
    user2.attributes = { id: 5, name: 'Alice (copy)' };

    expect(user1.is(user2)).toBe(true);
  });

  test('is() returns false for different IDs', () => {
    const user1 = new User();
    user1.attributes = { id: 5 };

    const user2 = new User();
    user2.attributes = { id: 6 };

    expect(user1.is(user2)).toBe(false);
  });

  test('is() returns false for different tables', () => {
    const user = new User();
    user.attributes = { id: 1 };

    const post = new Post();
    post.attributes = { id: 1 };

    expect(user.is(post)).toBe(false);
  });

  test('is() returns false for null', () => {
    const user = new User();
    user.attributes = { id: 1 };
    expect(user.is(null)).toBe(false);
  });

  test('is() returns false when pk is null', () => {
    const user1 = new User();
    const user2 = new User();
    expect(user1.is(user2)).toBe(false);
  });

  test('isNot() is inverse of is()', () => {
    const user1 = new User();
    user1.attributes = { id: 1 };

    const user2 = new User();
    user2.attributes = { id: 1 };

    expect(user1.isNot(user2)).toBe(false);
    expect(user1.isNot(null)).toBe(true);
  });
});

// ==================== 10. Local scopes ====================

describe('Local scopes', () => {
  test('local scope is callable on query builder', () => {
    const qb = User.query();
    expect(typeof qb.active).toBe('function');
  });

  test('local scope applies where clause', () => {
    const qb = User.query().active();
    const query = qb.buildQuery();
    expect(query.wheres).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: 'active', value: 1 })
      ])
    );
  });

  test('local scope with parameters', () => {
    const qb = User.query().olderThan(18);
    const query = qb.buildQuery();
    expect(query.wheres).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: 'age', operator: '>', value: 18 })
      ])
    );
  });

  test('local scopes are chainable', () => {
    const qb = User.query().active().olderThan(25);
    const query = qb.buildQuery();
    expect(query.wheres.length).toBeGreaterThanOrEqual(2);
  });
});

// ==================== 11. when() ====================

describe('when()', () => {
  test('when() applies callback when condition is truthy', () => {
    const qb = new QueryBuilder(User);
    qb.when(true, (q) => q.where('active', 1));
    expect(qb.wheres).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: 'active', value: 1 })
      ])
    );
  });

  test('when() skips callback when condition is falsy', () => {
    const qb = new QueryBuilder(User);
    qb.when(false, (q) => q.where('active', 1));
    expect(qb.wheres).toHaveLength(0);
  });

  test('when() applies fallback when condition is falsy', () => {
    const qb = new QueryBuilder(User);
    qb.when(
      false,
      (q) => q.where('active', 1),
      (q) => q.where('active', 0)
    );
    expect(qb.wheres).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: 'active', value: 0 })
      ])
    );
  });

  test('when() returns this for chaining', () => {
    const qb = new QueryBuilder(User);
    const result = qb.when(true, () => {});
    expect(result).toBe(qb);
  });
});

// ==================== 12. tap() ====================

describe('tap()', () => {
  test('tap() calls the callback with the query builder', () => {
    const qb = new QueryBuilder(User);
    const spy = jest.fn();
    qb.tap(spy);
    expect(spy).toHaveBeenCalledWith(qb);
  });

  test('tap() returns this for chaining', () => {
    const qb = new QueryBuilder(User);
    const result = qb.tap(() => {});
    expect(result).toBe(qb);
  });
});

// ==================== 13. toSQL() / dd() ====================

describe('toSQL() and dd()', () => {
  test('toSQL() returns query representation', () => {
    const qb = new QueryBuilder(User);
    qb.where('active', 1).orderBy('name');
    const sql = qb.toSQL();

    expect(sql.table).toBe('users');
    expect(sql.wheres).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: 'active', value: 1 })
      ])
    );
    expect(sql.orders).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ column: 'name', direction: 'asc' })
      ])
    );
  });

  test('dd() throws after logging', () => {
    const qb = new QueryBuilder(User);
    qb.where('id', 1);
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    expect(() => qb.dd()).toThrow('dd()');
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

// ==================== 14. wasChanged() / getChanges() ====================

describe('wasChanged() and getChanges()', () => {
  test('wasChanged() returns false before save', () => {
    const user = new User({ name: 'Alice' });
    expect(user.wasChanged()).toBe(false);
    expect(user.wasChanged('name')).toBe(false);
  });

  test('wasChanged() and getChanges() track insert changes', async () => {
    mockConnection.insert.mockResolvedValue({ insertId: 1 });

    const user = new User({ name: 'Alice', email: 'a@b.com' });
    await user.save();

    expect(user.wasChanged()).toBe(true);
    expect(user.wasChanged('name')).toBe(true);
    const changes = user.getChanges();
    expect(changes.name).toBe('Alice');
    expect(changes.email).toBe('a@b.com');
  });

  test('wasChanged() and getChanges() track update changes', async () => {
    mockConnection.update.mockResolvedValue({ affectedRows: 1 });

    const user = new User();
    user.attributes = { id: 1, name: 'Alice', email: 'a@b.com' };
    user.original = { id: 1, name: 'Alice', email: 'a@b.com' };
    user.exists = true;

    user.setAttribute('name', 'Bob');
    await user.save();

    expect(user.wasChanged()).toBe(true);
    expect(user.wasChanged('name')).toBe(true);
    expect(user.wasChanged('email')).toBe(false);
    expect(user.getChanges().name).toBe('Bob');
  });
});

// ==================== 15. withDefault() on relations ====================

describe('withDefault() on relations', () => {
  test('Relation base class has withDefault method', () => {
    const rel = new HasOneRelation(new User(), Profile, 'user_id', 'id');
    expect(typeof rel.withDefault).toBe('function');
  });

  test('withDefault(true) returns empty model', () => {
    const rel = new HasOneRelation(new User(), Profile, 'user_id', 'id');
    rel.withDefault(true);
    const defaultVal = rel._buildDefault();
    expect(defaultVal).not.toBeNull();
    expect(defaultVal).toBeInstanceOf(Profile);
  });

  test('withDefault(object) returns model with attributes', () => {
    const rel = new HasOneRelation(new User(), Profile, 'user_id', 'id');
    rel.withDefault({ bio: 'Default bio' });
    const defaultVal = rel._buildDefault();
    expect(defaultVal).not.toBeNull();
    expect(defaultVal.getAttribute('bio')).toBe('Default bio');
  });

  test('withDefault(fn) returns result of function', () => {
    const rel = new HasOneRelation(new User(), Profile, 'user_id', 'id');
    const custom = new Profile({ bio: 'Custom' });
    rel.withDefault(() => custom);
    const defaultVal = rel._buildDefault();
    expect(defaultVal).toBe(custom);
  });

  test('without withDefault, _buildDefault returns null', () => {
    const rel = new HasOneRelation(new User(), Profile, 'user_id', 'id');
    expect(rel._buildDefault()).toBeNull();
  });
});

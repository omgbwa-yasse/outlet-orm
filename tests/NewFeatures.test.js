const Model = require('../src/Model');
const DatabaseConnection = require('../src/DatabaseConnection');

/**
 * Tests for v6.5.0 features:
 * - Accessors & Mutators
 * - firstOrCreate / firstOrNew / updateOrCreate
 * - upsert
 * - Observer
 * - cursor (async generator)
 */

let db;

beforeAll(async () => {
  db = new DatabaseConnection({ driver: 'sqlite', database: ':memory:' });
  await db.connect();
  User.connection = db;
  Product.connection = db;
  await db.execute(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      age INTEGER,
      password TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);
  await db.execute(`
    CREATE TABLE products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE,
      name TEXT,
      price REAL,
      stock INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    )
  `);
});

afterAll(async () => {
  await db.close();
});

// ==================== Model with Accessors & Mutators ====================

class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'age', 'password'];

  // Accessor: get{Key}Attribute — transforms on read
  getNameAttribute(value) {
    return value ? value.toUpperCase() : value;
  }

  // Mutator: set{Key}Attribute — transforms on write
  setPasswordAttribute(value) {
    // Simple hash simulation (in real code use bcrypt)
    this.attributes.password = `hashed_${value}`;
  }

  // Accessor for computed attribute
  getEmailDomainAttribute() {
    const email = this.attributes.email;
    return email ? email.split('@')[1] : null;
  }
}

class Product extends Model {
  static table = 'products';
  static fillable = ['sku', 'name', 'price', 'stock'];
}

// ==================== Accessors & Mutators ====================

describe('Accessors & Mutators', () => {
  test('mutator transforms value on setAttribute', () => {
    const user = new User();
    user.setAttribute('password', 'secret123');
    // Mutator should have hashed it
    expect(user.attributes.password).toBe('hashed_secret123');
  });

  test('accessor transforms value on getAttribute', () => {
    const user = new User();
    user.attributes.name = 'john doe';
    expect(user.getAttribute('name')).toBe('JOHN DOE');
  });

  test('accessor works for computed virtual attributes', () => {
    const user = new User();
    user.attributes.email = 'john@example.com';
    expect(user.getAttribute('email_domain')).toBe('example.com');
  });

  test('mutator is applied during create and persisted', async () => {
    const user = await User.create({ name: 'Alice', email: 'alice@test.com', password: 'mypassword', age: 25 });
    expect(user.attributes.password).toBe('hashed_mypassword');
  });

  test('accessor is applied when reading persisted data', async () => {
    const user = await User.where('email', 'alice@test.com').first();
    // Accessor uppercases name
    expect(user.getAttribute('name')).toBe('ALICE');
  });

  test('setAttribute without mutator works normally', () => {
    const user = new User();
    user.setAttribute('age', 30);
    expect(user.getAttribute('age')).toBe(30);
  });
});

// ==================== firstOrCreate ====================

describe('firstOrCreate', () => {
  test('creates a new record when not found', async () => {
    const user = await User.firstOrCreate(
      { email: 'bob@test.com' },
      { name: 'Bob', age: 35, password: 'pass' }
    );
    expect(user.exists).toBe(true);
    expect(user.getAttribute('email')).toBe('bob@test.com');
    expect(user.getAttribute('name')).toBe('BOB'); // accessor
  });

  test('returns existing record when found', async () => {
    const user = await User.firstOrCreate(
      { email: 'bob@test.com' },
      { name: 'Should Not Be Used', age: 99 }
    );
    expect(user.getAttribute('name')).toBe('BOB');
    expect(user.getAttribute('age')).not.toBe(99);
  });
});

// ==================== firstOrNew ====================

describe('firstOrNew', () => {
  test('returns unsaved instance when not found', async () => {
    const user = await User.firstOrNew(
      { email: 'charlie@test.com' },
      { name: 'Charlie', age: 40 }
    );
    expect(user.exists).toBe(false);
    expect(user.getAttribute('email')).toBe('charlie@test.com');
  });

  test('returns existing record when found', async () => {
    const user = await User.firstOrNew(
      { email: 'bob@test.com' },
      { name: 'Different', age: 100 }
    );
    expect(user.exists).toBe(true);
    expect(user.getAttribute('name')).toBe('BOB');
  });
});

// ==================== updateOrCreate ====================

describe('updateOrCreate', () => {
  test('creates when not found', async () => {
    const user = await User.updateOrCreate(
      { email: 'dave@test.com' },
      { name: 'Dave', age: 28, password: 'secret' }
    );
    expect(user.exists).toBe(true);
    expect(user.getAttribute('email')).toBe('dave@test.com');
    expect(user.getAttribute('name')).toBe('DAVE');
  });

  test('updates when found', async () => {
    const user = await User.updateOrCreate(
      { email: 'dave@test.com' },
      { name: 'Dave Updated', age: 29 }
    );
    expect(user.getAttribute('name')).toBe('DAVE UPDATED');
    expect(user.getAttribute('age')).toBe(29);
  });

  test('works via QueryBuilder', async () => {
    const user = await User.where('email', 'dave@test.com').updateOrCreate({ age: 30 });
    expect(user.getAttribute('age')).toBe(30);
  });
});

// ==================== upsert ====================

describe('upsert', () => {
  beforeAll(async () => {
    await Product.create({ sku: 'WIDGET-001', name: 'Widget', price: 9.99, stock: 100 });
  });

  test('inserts new rows and updates existing ones', async () => {
    await Product.upsert(
      [
        { sku: 'WIDGET-001', name: 'Widget v2', price: 12.99, stock: 50 },
        { sku: 'GADGET-001', name: 'Gadget', price: 19.99, stock: 200 }
      ],
      'sku',
      ['name', 'price', 'stock']
    );

    const widget = await Product.where('sku', 'WIDGET-001').first();
    expect(widget.getAttribute('name')).toBe('Widget v2');
    expect(widget.getAttribute('price')).toBe(12.99);

    const gadget = await Product.where('sku', 'GADGET-001').first();
    expect(gadget).not.toBeNull();
    expect(gadget.getAttribute('name')).toBe('Gadget');
  });

  test('handles array uniqueBy', async () => {
    await Product.upsert(
      [
        { sku: 'GADGET-001', name: 'Gadget Pro', price: 24.99, stock: 300 }
      ],
      ['sku'],
      ['name', 'price']
    );

    const gadget = await Product.where('sku', 'GADGET-001').first();
    expect(gadget.getAttribute('name')).toBe('Gadget Pro');
  });

  test('does nothing with empty rows', async () => {
    const result = await Product.upsert([], 'sku');
    expect(result).toBeUndefined();
  });
});

// ==================== Observer ====================

describe('Observer', () => {
  const events = [];

  class UserObserver {
    creating(model) {
      events.push('creating');
    }
    created(model) {
      events.push('created');
    }
    updating(model) {
      events.push('updating');
    }
    updated(model) {
      events.push('updated');
    }
    saving(model) {
      events.push('saving');
    }
    saved(model) {
      events.push('saved');
    }
    deleting(model) {
      events.push('deleting');
    }
    deleted(model) {
      events.push('deleted');
    }
  }

  // Use a separate model class to not pollute User for other tests
  class ObservedUser extends Model {
    static table = 'users';
    static fillable = ['name', 'email', 'age', 'password'];
  }
  beforeAll(() => {
    ObservedUser.connection = db;
    events.length = 0;
    ObservedUser.observe(UserObserver);
  });

  test('observer fires creating + created + saving + saved on create', async () => {
    events.length = 0;
    await ObservedUser.create({ name: 'Eve', email: 'eve@test.com', age: 22 });
    expect(events).toContain('saving');
    expect(events).toContain('creating');
    expect(events).toContain('created');
    expect(events).toContain('saved');
  });

  test('observer fires updating + updated + saving + saved on update', async () => {
    const user = await ObservedUser.where('email', 'eve@test.com').first();
    events.length = 0;
    user.setAttribute('name', 'Eve Updated');
    await user.save();
    expect(events).toContain('saving');
    expect(events).toContain('updating');
    expect(events).toContain('updated');
    expect(events).toContain('saved');
  });

  test('observer fires deleting + deleted on destroy', async () => {
    const user = await ObservedUser.where('email', 'eve@test.com').first();
    events.length = 0;
    await user.destroy();
    expect(events).toContain('deleting');
    expect(events).toContain('deleted');
  });

  test('observer can be an instance', () => {
    class AnotherModel extends Model {
      static table = 'users';
    }
    AnotherModel.connection = db;
    const observerInstance = new UserObserver();
    // Should not throw
    expect(() => AnotherModel.observe(observerInstance)).not.toThrow();
  });
});

// ==================== cursor (async generator) ====================

describe('cursor', () => {
  beforeAll(async () => {
    // Insert some products for iteration
    for (let i = 1; i <= 15; i++) {
      await db.execute(
        `INSERT OR IGNORE INTO products (sku, name, price, stock, created_at, updated_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [`CURSOR-${String(i).padStart(3, '0')}`, `Item ${i}`, i * 1.5, i * 10]
      );
    }
  });

  test('iterates over all records lazily', async () => {
    const items = [];
    for await (const product of Product.cursor(5)) {
      items.push(product.getAttribute('sku'));
    }
    // Should have all products (2 from upsert tests + 15 from cursor setup)
    expect(items.length).toBeGreaterThanOrEqual(15);
  });

  test('cursor yields proper model instances', async () => {
    for await (const product of Product.cursor(3)) {
      expect(product).toBeInstanceOf(Product);
      expect(product.exists).toBe(true);
      break; // just test first one
    }
  });

  test('cursor works via QueryBuilder', async () => {
    const items = [];
    const qb = Product.where('price', '>', 0).orderBy('id');
    for await (const product of qb.cursor(4)) {
      items.push(product);
    }
    expect(items.length).toBeGreaterThan(0);
  });

  test('cursor with empty result yields nothing', async () => {
    const items = [];
    for await (const product of Product.where('sku', 'NON_EXISTENT').cursor(10)) {
      items.push(product);
    }
    expect(items.length).toBe(0);
  });
});

// ==================== QueryBuilder firstOrCreate / firstOrNew ====================

describe('QueryBuilder convenience methods', () => {
  test('QB firstOrCreate creates when not found', async () => {
    const product = await Product.where('sku', 'QB-NEW-001').firstOrCreate({ name: 'QB New', price: 5.0, stock: 10 });
    expect(product.exists).toBe(true);
    expect(product.getAttribute('sku')).toBe('QB-NEW-001');
  });

  test('QB firstOrCreate returns existing', async () => {
    const product = await Product.where('sku', 'QB-NEW-001').firstOrCreate({ name: 'Different', price: 999 });
    expect(product.getAttribute('name')).toBe('QB New');
  });

  test('QB firstOrNew returns unsaved when not found', async () => {
    const product = await Product.where('sku', 'QB-UNSAVED').firstOrNew({ name: 'Unsaved', price: 1.0 });
    expect(product.exists).toBe(false);
    expect(product.getAttribute('sku')).toBe('QB-UNSAVED');
  });
});

// ==================== Accessors with snake_case ====================

describe('Accessors with snake_case keys', () => {
  class SnakeUser extends Model {
    static table = 'users';
    static fillable = ['name', 'email'];

    // For snake_case key 'email_domain', the accessor is getEmailDomainAttribute
    getEmailDomainAttribute(value) {
      return this.attributes.email ? this.attributes.email.split('@')[1] : null;
    }
  }
  test('accessor handles snake_case to camelCase conversion', () => {
    SnakeUser.connection = db;
    const user = new SnakeUser();
    user.attributes.email = 'test@domain.org';
    expect(user.getAttribute('email_domain')).toBe('domain.org');
  });
});

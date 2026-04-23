'use strict';

const { Blueprint, CheckConstraintDefinition, ForeignKeyDefinition } = require('../src/Schema/Schema');
const { UnsupportedCapabilityError } = require('../src/Errors/UnsupportedCapabilityError');

function mockConn(driver) {
  return { config: { driver } };
}

// ---------------------------------------------------------------------------
// CHECK in CREATE TABLE (getConstraints)
// ---------------------------------------------------------------------------
describe('CHECK in CREATE TABLE (getConstraints)', () => {
  test('single auto-named check — MySQL backtick quoting', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    bp.check('amount > 0');
    const sql = bp.getConstraints();
    expect(sql).toContain('CONSTRAINT `orders_check_1` CHECK (amount > 0)');
  });

  test('two checks get sequential auto-names', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    bp.check('amount > 0');
    bp.check('qty > 0');
    const sql = bp.getConstraints();
    expect(sql).toContain('CONSTRAINT `orders_check_1` CHECK (amount > 0)');
    expect(sql).toContain('CONSTRAINT `orders_check_2` CHECK (qty > 0)');
  });

  test('single auto-named check — PostgreSQL double-quote quoting', () => {
    const bp = new Blueprint('orders', mockConn('pg'));
    bp.check('amount > 0');
    const sql = bp.getConstraints();
    expect(sql).toContain('CONSTRAINT "orders_check_1" CHECK (amount > 0)');
  });

  test('explicitly named check — MySQL', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    bp.check('amount > 0').name('chk_amount_positive');
    const sql = bp.getConstraints();
    expect(sql).toContain('CONSTRAINT `chk_amount_positive` CHECK (amount > 0)');
  });

  test('explicitly named check — PostgreSQL', () => {
    const bp = new Blueprint('orders', mockConn('pg'));
    bp.check('amount > 0').name('chk_amount_positive');
    const sql = bp.getConstraints();
    expect(sql).toContain('CONSTRAINT "chk_amount_positive" CHECK (amount > 0)');
  });

  test('auto-name counter is isolated per blueprint instance', () => {
    const bp1 = new Blueprint('t1', mockConn('mysql'));
    bp1.check('a > 0');
    const bp2 = new Blueprint('t2', mockConn('mysql'));
    bp2.check('b > 0');
    expect(bp1.getConstraints()).toContain('t1_check_1');
    expect(bp2.getConstraints()).toContain('t2_check_1');
  });

  test('duplicate constraint name throws Error', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    bp.check('amount > 0').name('chk_dup');
    bp.check('qty > 0').name('chk_dup');
    expect(() => bp.getConstraints()).toThrow(/Duplicate constraint name.*chk_dup/);
  });
});

// ---------------------------------------------------------------------------
// CHECK in ALTER TABLE (toAlterSql)
// ---------------------------------------------------------------------------
describe('CHECK in ALTER TABLE (toAlterSql)', () => {
  test('MySQL — ADD CONSTRAINT CHECK with backtick quoting', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    bp.isModifying = true;
    bp.check('amount > 0').name('chk_amount');
    const stmts = bp.toAlterSql();
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toBe('ALTER TABLE `orders` ADD CONSTRAINT `chk_amount` CHECK (amount > 0)');
  });

  test('PostgreSQL — ADD CONSTRAINT CHECK with double-quote quoting', () => {
    const bp = new Blueprint('orders', mockConn('pg'));
    bp.isModifying = true;
    bp.check('amount > 0').name('chk_amount');
    const stmts = bp.toAlterSql();
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toBe('ALTER TABLE "orders" ADD CONSTRAINT "chk_amount" CHECK (amount > 0)');
  });

  test('SQLite — throws UnsupportedCapabilityError for ALTER ADD CHECK', () => {
    const bp = new Blueprint('orders', mockConn('sqlite'));
    bp.isModifying = true;
    bp.check('amount > 0');
    expect(() => bp.toAlterSql()).toThrow(UnsupportedCapabilityError);
  });

  test('SQLite — UnsupportedCapabilityError has correct driver and capability', () => {
    const bp = new Blueprint('orders', mockConn('sqlite'));
    bp.isModifying = true;
    bp.check('amount > 0');
    let err;
    try { bp.toAlterSql(); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(UnsupportedCapabilityError);
    expect(err.driver).toBe('sqlite');
    expect(err.capability).toBe('ALTER TABLE … ADD CONSTRAINT CHECK');
  });

  test('auto-named check is stable across multiple resolvedName() calls', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    const def = bp.check('amount > 0');
    const name1 = def.resolvedName();
    const name2 = def.resolvedName();
    expect(name1).toBe(name2);
    expect(name1).toBe('orders_check_1');
    expect(bp._checkCount).toBe(1); // counter incremented only once
  });
});

// ---------------------------------------------------------------------------
// Named CHECK constraint
// ---------------------------------------------------------------------------
describe('Named CHECK constraint', () => {
  test('calling .name() with empty string falls through to auto-name', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    const def = bp.check('amount > 0').name('');
    expect(def.resolvedName()).toBe('orders_check_1');
  });

  test('calling .name() with a valid identifier overrides auto-name', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    const def = bp.check('amount > 0').name('chk_custom');
    expect(def.resolvedName()).toBe('chk_custom');
  });

  test('calling .name() with invalid identifier throws Error', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    const def = bp.check('amount > 0');
    expect(() => def.name('bad name!')).toThrow();
  });

  test('check() requires non-empty expression string', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    expect(() => bp.check('')).toThrow(TypeError);
    expect(() => bp.check('   ')).toThrow(TypeError);
    expect(() => bp.check(42)).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// Named FK constraint
// ---------------------------------------------------------------------------
describe('Named FK constraint', () => {
  test('custom name overrides auto-name in getConstraints()', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    bp.foreign('user_id').references('id').on('users').name('fk_orders_user');
    const sql = bp.getConstraints();
    expect(sql).toContain('CONSTRAINT `fk_orders_user` FOREIGN KEY');
    expect(sql).not.toContain('users_user_id_foreign');
  });

  test('auto-name is generated via on() when no custom name set', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    bp.foreign('user_id').references('id').on('users');
    const sql = bp.getConstraints();
    expect(sql).toContain('CONSTRAINT `users_user_id_foreign` FOREIGN KEY');
  });

  test('custom FK name applied in toAlterSql()', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    bp.isModifying = true;
    bp.foreign('user_id').references('id').on('users').name('fk_custom');
    const stmts = bp.toAlterSql();
    expect(stmts[0]).toContain('ADD CONSTRAINT `fk_custom`');
  });

  test('.name() with invalid identifier throws Error', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    const fk = bp.foreign('user_id').references('id').on('users');
    expect(() => fk.name('bad name!')).toThrow();
  });

  test('.name() chaining returns ForeignKeyDefinition', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    const fk = bp.foreign('user_id').references('id').on('users');
    const result = fk.name('fk_valid');
    expect(result).toBeInstanceOf(ForeignKeyDefinition);
  });
});

// ---------------------------------------------------------------------------
// dropConstraint / dropCheck
// ---------------------------------------------------------------------------
describe('dropConstraint and dropCheck', () => {
  test('MySQL — drops using DROP CHECK syntax', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    bp.isModifying = true;
    bp.dropConstraint('chk_amount');
    const stmts = bp.toAlterSql();
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toBe('ALTER TABLE `orders` DROP CHECK `chk_amount`');
  });

  test('PostgreSQL — drops using DROP CONSTRAINT syntax', () => {
    const bp = new Blueprint('orders', mockConn('pg'));
    bp.isModifying = true;
    bp.dropConstraint('chk_amount');
    const stmts = bp.toAlterSql();
    expect(stmts).toHaveLength(1);
    expect(stmts[0]).toBe('ALTER TABLE "orders" DROP CONSTRAINT "chk_amount"');
  });

  test('SQLite — throws UnsupportedCapabilityError for dropConstraint', () => {
    const bp = new Blueprint('orders', mockConn('sqlite'));
    bp.isModifying = true;
    bp.dropConstraint('chk_amount');
    expect(() => bp.toAlterSql()).toThrow(UnsupportedCapabilityError);
  });

  test('SQLite dropConstraint error has correct capability string', () => {
    const bp = new Blueprint('orders', mockConn('sqlite'));
    bp.isModifying = true;
    bp.dropConstraint('chk_amount');
    let err;
    try { bp.toAlterSql(); } catch (e) { err = e; }
    expect(err.driver).toBe('sqlite');
    expect(err.capability).toBe('ALTER TABLE … DROP CONSTRAINT');
  });

  test('dropCheck is an alias for dropConstraint', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    bp.isModifying = true;
    bp.dropCheck('chk_amount');
    const stmts = bp.toAlterSql();
    expect(stmts[0]).toBe('ALTER TABLE `orders` DROP CHECK `chk_amount`');
  });

  test('dropConstraint with invalid identifier throws', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    expect(() => bp.dropConstraint('bad name!')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Combined ALTER TABLE: CHECK + named FK together
// ---------------------------------------------------------------------------
describe('Combined ALTER TABLE: CHECK and named FK', () => {
  test('produces two ALTER statements in order', () => {
    const bp = new Blueprint('orders', mockConn('mysql'));
    bp.isModifying = true;
    bp.check('amount > 0').name('chk_amount');
    bp.foreign('user_id').references('id').on('users').name('fk_orders_user');
    const stmts = bp.toAlterSql();
    expect(stmts).toHaveLength(2);
    expect(stmts[0]).toBe('ALTER TABLE `orders` ADD CONSTRAINT `chk_amount` CHECK (amount > 0)');
    expect(stmts[1]).toBe('ALTER TABLE `orders` ADD CONSTRAINT `fk_orders_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)');
  });
});

// ---------------------------------------------------------------------------
// CheckConstraintDefinition class API
// ---------------------------------------------------------------------------
describe('CheckConstraintDefinition class', () => {
  test('is exported from src/Schema/Schema.js', () => {
    expect(CheckConstraintDefinition).toBeDefined();
    expect(typeof CheckConstraintDefinition).toBe('function');
  });

  test('resolvedName() returns explicit name if set', () => {
    const bp = new Blueprint('t', mockConn('mysql'));
    const def = new CheckConstraintDefinition('x > 0', bp);
    def.name('explicit_name');
    expect(def.resolvedName()).toBe('explicit_name');
    expect(bp._checkCount).toBe(0); // counter not used
  });

  test('resolvedName() generates auto-name lazily when not named', () => {
    const bp = new Blueprint('t', mockConn('mysql'));
    const def = new CheckConstraintDefinition('x > 0', bp);
    expect(bp._checkCount).toBe(0);
    const n = def.resolvedName();
    expect(bp._checkCount).toBe(1);
    expect(n).toBe('t_check_1');
  });

  test('resolvedName() caches auto-name on repeated calls', () => {
    const bp = new Blueprint('t', mockConn('mysql'));
    const def = new CheckConstraintDefinition('x > 0', bp);
    def.resolvedName();
    def.resolvedName();
    def.resolvedName();
    expect(bp._checkCount).toBe(1); // only incremented once
  });
});

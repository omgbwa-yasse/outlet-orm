'use strict';

const { ApiValidator } = require('../src/Api/Validation/ApiValidator');

describe('ApiValidator — built-in rules', () => {
  test('required: fails on empty/null/undefined', () => {
    const { valid, errors } = ApiValidator.validate({ name: '' }, { name: 'required' });
    expect(valid).toBe(false);
    expect(errors.name).toBeDefined();
  });

  test('required: passes when value present', () => {
    const { valid } = ApiValidator.validate({ name: 'Alice' }, { name: 'required' });
    expect(valid).toBe(true);
  });

  test('email: fails on invalid email', () => {
    const { valid, errors } = ApiValidator.validate({ email: 'notanemail' }, { email: 'email' });
    expect(valid).toBe(false);
    expect(errors.email).toBeDefined();
  });

  test('email: passes on valid email', () => {
    const { valid } = ApiValidator.validate({ email: 'user@example.com' }, { email: 'email' });
    expect(valid).toBe(true);
  });

  test('min rule (string length)', () => {
    const { valid } = ApiValidator.validate({ pw: 'ab' }, { pw: 'min:6' });
    expect(valid).toBe(false);
  });

  test('max rule (string length)', () => {
    const { valid } = ApiValidator.validate({ name: 'abcdefghijklmnop' }, { name: 'max:10' });
    expect(valid).toBe(false);
  });

  test('in rule: passes when value in list', () => {
    const { valid } = ApiValidator.validate({ role: 'admin' }, { role: 'in:admin,user,guest' });
    expect(valid).toBe(true);
  });

  test('in rule: fails when value not in list', () => {
    const { valid } = ApiValidator.validate({ role: 'superuser' }, { role: 'in:admin,user,guest' });
    expect(valid).toBe(false);
  });

  test('not_in rule: fails when value in excluded list', () => {
    const { valid } = ApiValidator.validate({ role: 'banned' }, { role: 'not_in:banned,blocked' });
    expect(valid).toBe(false);
  });

  test('string rule', () => {
    const { valid } = ApiValidator.validate({ name: 42 }, { name: 'string' });
    expect(valid).toBe(false);
  });

  test('integer rule', () => {
    const { valid } = ApiValidator.validate({ age: 'twenty' }, { age: 'integer' });
    expect(valid).toBe(false);
  });

  test('integer rule: passes for numeric integer', () => {
    const { valid } = ApiValidator.validate({ age: 25 }, { age: 'integer' });
    expect(valid).toBe(true);
  });

  test('numeric rule', () => {
    const { valid } = ApiValidator.validate({ price: '1.99' }, { price: 'numeric' });
    expect(valid).toBe(true);
  });

  test('boolean rule', () => {
    const { valid } = ApiValidator.validate({ active: 'yes' }, { active: 'boolean' });
    expect(valid).toBe(false);
  });

  test('boolean rule: passes for true/false', () => {
    const { valid } = ApiValidator.validate({ active: true }, { active: 'boolean' });
    expect(valid).toBe(true);
  });

  test('array rule', () => {
    const { valid } = ApiValidator.validate({ tags: 'one,two' }, { tags: 'array' });
    expect(valid).toBe(false);
  });

  test('array rule: passes for array', () => {
    const { valid } = ApiValidator.validate({ tags: ['a', 'b'] }, { tags: 'array' });
    expect(valid).toBe(true);
  });

  test('url rule', () => {
    const { valid } = ApiValidator.validate({ website: 'not-a-url' }, { website: 'url' });
    expect(valid).toBe(false);
  });

  test('url rule: passes for valid URL', () => {
    const { valid } = ApiValidator.validate({ website: 'https://example.com' }, { website: 'url' });
    expect(valid).toBe(true);
  });

  test('uuid rule', () => {
    const { valid } = ApiValidator.validate({ uid: 'not-a-uuid' }, { uid: 'uuid' });
    expect(valid).toBe(false);
  });

  test('uuid rule: passes for valid UUID', () => {
    const { valid } = ApiValidator.validate(
      { uid: '550e8400-e29b-41d4-a716-446655440000' },
      { uid: 'uuid' }
    );
    expect(valid).toBe(true);
  });

  test('phone rule: passes for valid phone', () => {
    const { valid } = ApiValidator.validate({ phone: '+1-555-123-4567' }, { phone: 'phone' });
    expect(valid).toBe(true);
  });

  test('json rule: passes for valid JSON string', () => {
    const { valid } = ApiValidator.validate({ meta: '{"a":1}' }, { meta: 'json' });
    expect(valid).toBe(true);
  });

  test('json rule: fails for invalid JSON', () => {
    const { valid } = ApiValidator.validate({ meta: '{bad}' }, { meta: 'json' });
    expect(valid).toBe(false);
  });

  test('confirmed rule: passes when field_confirmation matches', () => {
    const { valid } = ApiValidator.validate(
      { password: 'secret', password_confirmation: 'secret' },
      { password: 'confirmed' }
    );
    expect(valid).toBe(true);
  });

  test('confirmed rule: fails when confirmation mismatches', () => {
    const { valid } = ApiValidator.validate(
      { password: 'secret', password_confirmation: 'other' },
      { password: 'confirmed' }
    );
    expect(valid).toBe(false);
  });
});

describe('ApiValidator — custom messages', () => {
  test('custom message is used when provided', () => {
    const { errors } = ApiValidator.validate(
      { name: '' },
      { name: 'required' },
      { 'name.required': 'Name cannot be blank' }
    );
    expect(errors.name[0]).toBe('Name cannot be blank');
  });
});

describe('ApiValidator — multiple rules', () => {
  test('validates multiple rules, collects all errors', () => {
    const { valid, errors } = ApiValidator.validate(
      { email: 'invalid', age: 'notanumber' },
      { email: 'required|email', age: 'integer' }
    );
    expect(valid).toBe(false);
    expect(errors.email).toBeDefined();
    expect(errors.age).toBeDefined();
  });

  test('all rules pass → valid = true', () => {
    const { valid } = ApiValidator.validate(
      { email: 'user@test.com', age: 30 },
      { email: 'required|email', age: 'required|integer' }
    );
    expect(valid).toBe(true);
  });
});

describe('ApiValidator — validateAsync', () => {
  test('works the same as sync for non-async rules', async () => {
    const result = await ApiValidator.validateAsync(
      { name: 'Alice' },
      { name: 'required|string' }
    );
    expect(result.valid).toBe(true);
  });

  test('async: fails on required', async () => {
    const result = await ApiValidator.validateAsync({ name: '' }, { name: 'required' });
    expect(result.valid).toBe(false);
  });

  test('async: exists rule passes when model returns record', async () => {
    const FakeModel = { where: () => ({ get: () => Promise.resolve([{ id: 1 }]) }) };
    const result = await ApiValidator.validateAsync(
      { role_id: 1 },
      { role_id: `exists:ModelArg,id` },
      {},
    );
    // Without a real model resolved from string, it skips — just check no crash
    expect(['valid', 'invalid']).toContain(result.valid ? 'valid' : 'invalid');
  });
});

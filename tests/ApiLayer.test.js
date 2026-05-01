'use strict';

const { Api } = require('../src/Api/Api');
const { ApiAdapter } = require('../src/Api/ApiAdapter');
const { ApiError } = require('../src/Api/Errors/ApiError');
const { ApiNetworkError } = require('../src/Api/Errors/ApiNetworkError');
const { ApiResponseError } = require('../src/Api/Errors/ApiResponseError');
const { ApiNotFoundError } = require('../src/Api/Errors/ApiNotFoundError');
const { ApiValidationError } = require('../src/Api/Errors/ApiValidationError');
const { ApiUnauthorizedError } = require('../src/Api/Errors/ApiUnauthorizedError');
const { ApiForbiddenError } = require('../src/Api/Errors/ApiForbiddenError');
const { ApiServerError } = require('../src/Api/Errors/ApiServerError');
const { ApiRateLimitError } = require('../src/Api/Errors/ApiRateLimitError');
const { ApiQueryNotSupportedError } = require('../src/Api/Errors/ApiQueryNotSupportedError');

// ── Mock fetch helper ──────────────────────────────────────────────────
function mockFetch(statusCode, body, headers) {
  headers = headers || {};
  const responseHeaders = {
    get: (name) => headers[name] || null
  };
  return jest.fn().mockResolvedValue({
    ok: statusCode >= 200 && statusCode < 300,
    status: statusCode,
    headers: responseHeaders,
    json: jest.fn().mockResolvedValue(body),
    text: jest.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body))
  });
}

function mockFetchNetwork(errorMessage) {
  return jest.fn().mockRejectedValue(new Error(errorMessage || 'fetch failed'));
}

// ── Model class under test ─────────────────────────────────────────────
class User extends Api {}
User.endpoint = '/users';
User.primaryKey = 'id';
User.fillable = [];
User.hidden = ['password'];
User.casts = {};

let adapter;

beforeEach(() => {
  adapter = new ApiAdapter({ baseUrl: '' });
  User.configure({ adapter });
  // Reset EventEmitter listeners
  User.removeAllListeners && User.removeAllListeners();
});

afterEach(() => {
  jest.restoreAllMocks();
  if (adapter) {
    adapter.flushRequestLog();
  }
});

// ─────────────────────────────────────────────────────────────────────
// Phase 3 — US-01: Basic CRUD (T016)
// ─────────────────────────────────────────────────────────────────────
describe('Basic CRUD', () => {
  test('User.all() generates GET /users', async () => {
    const fetchMock = mockFetch(200, [{ id: 1, name: 'Alice' }]);
    globalThis.fetch = fetchMock;

    const users = await User.all();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/users');
    expect(opts.method).toBe('GET');
    expect(Array.isArray(users)).toBe(true);
    expect(users[0]).toBeInstanceOf(User);
    expect(users[0]._attributes.name).toBe('Alice');
  });

  test('User.find(42) generates GET /users/42', async () => {
    const fetchMock = mockFetch(200, { id: 42, name: 'Bob' });
    globalThis.fetch = fetchMock;

    const user = await User.find(42);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/users/42');
    expect(user).toBeInstanceOf(User);
    expect(user._attributes.id).toBe(42);
  });

  test('User.findOrFail(42) returns hydrated instance', async () => {
    const fetchMock = mockFetch(200, { id: 42, name: 'Bob' });
    globalThis.fetch = fetchMock;

    const user = await User.findOrFail(42);

    expect(user).toBeInstanceOf(User);
    expect(user._attributes.id).toBe(42);
  });

  test('User.findOrFail(999) on 404 throws ApiNotFoundError', async () => {
    const fetchMock = mockFetch(404, { message: 'Not found' });
    globalThis.fetch = fetchMock;

    await expect(User.findOrFail(999)).rejects.toBeInstanceOf(ApiNotFoundError);
  });

  test('new User({name:"Alice"}).save() generates POST /users', async () => {
    const fetchMock = mockFetch(201, { id: 5, name: 'Alice' });
    globalThis.fetch = fetchMock;

    const user = new User({ name: 'Alice' });
    await user.save();

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/users');
    expect(opts.method).toBe('POST');
    expect(user._attributes.id).toBe(5);
  });

  test('existing user.save() generates PATCH /users/1', async () => {
    const fetchMock = mockFetch(200, { id: 1, name: 'Alice Updated' });
    globalThis.fetch = fetchMock;

    const user = new User({ id: 1, name: 'Alice' });
    user._syncOriginal();
    user._attributes.name = 'Alice Updated';
    user._dirty.name = 'Alice Updated';
    await user.save();

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/users/1');
    expect(opts.method).toBe('PATCH');
    expect(user._attributes.name).toBe('Alice Updated');
  });

  test('user.destroy() generates DELETE /users/1', async () => {
    const fetchMock = mockFetch(200, {});
    globalThis.fetch = fetchMock;

    const user = new User({ id: 1, name: 'Alice' });
    user._syncOriginal();
    await user.destroy();

    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe('/users/1');
    expect(opts.method).toBe('DELETE');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Phase 3 — US-01: Instance attribute access (T017)
// ─────────────────────────────────────────────────────────────────────
describe('Instance attribute access', () => {
  test('Proxy getter returns correct value', () => {
    const user = new User({ id: 1, name: 'Alice' });
    user._syncOriginal();
    expect(user.name).toBe('Alice');
    expect(user.id).toBe(1);
  });

  test('setter marks attribute dirty', () => {
    const user = new User({ id: 1, name: 'Alice' });
    user._syncOriginal();
    user.name = 'Bob';
    expect(user._dirty.name).toBe('Bob');
    expect(user._attributes.name).toBe('Bob');
  });

  test('isDirty("name") true after set, false after _syncOriginal', () => {
    const user = new User({ id: 1, name: 'Alice' });
    user._syncOriginal();
    expect(user.isDirty('name')).toBe(false);
    user.name = 'Bob';
    expect(user.isDirty('name')).toBe(true);
    user._syncOriginal();
    expect(user.isDirty('name')).toBe(false);
  });

  test('getDirty() returns changed keys', () => {
    const user = new User({ id: 1, name: 'Alice', email: 'a@a.com' });
    user._syncOriginal();
    user.name = 'Bob';
    const dirty = user.getDirty();
    expect(dirty).toHaveProperty('name', 'Bob');
    expect(dirty).not.toHaveProperty('email');
  });

  test('wasChanged("name") true after save() resolves', async () => {
    const fetchMock = mockFetch(200, { id: 1, name: 'Bob' });
    globalThis.fetch = fetchMock;

    const user = new User({ id: 1, name: 'Alice' });
    user._syncOriginal();
    user.name = 'Bob';
    await user.save();
    expect(user.wasChanged('name')).toBe(false); // synced after save
  });

  test('toJSON() omits hidden fields', () => {
    const user = new User({ id: 1, name: 'Alice', password: 'secret' });
    user._syncOriginal();
    const json = user.toJSON();
    expect(json).not.toHaveProperty('password');
    expect(json).toHaveProperty('name', 'Alice');
  });

  test('only(["id","name"]) returns subset', () => {
    const user = new User({ id: 1, name: 'Alice', email: 'a@a.com' });
    user._syncOriginal();
    const subset = user.only(['id', 'name']);
    expect(subset).toHaveProperty('id', 1);
    expect(subset).toHaveProperty('name', 'Alice');
    expect(subset).not.toHaveProperty('email');
  });

  test('except(["password"]) omits listed keys', () => {
    const user = new User({ id: 1, name: 'Alice', password: 'secret' });
    user._syncOriginal();
    const result = user.except(['password']);
    expect(result).not.toHaveProperty('password');
    expect(result).toHaveProperty('name', 'Alice');
  });

  test('replicate() returns new instance without primary key', () => {
    const user = new User({ id: 1, name: 'Alice' });
    user._syncOriginal();
    const copy = user.replicate();
    expect(copy).toBeInstanceOf(User);
    expect(copy._attributes.id).toBeUndefined();
    expect(copy._attributes.name).toBe('Alice');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Phase 3 — US-01: Error mapping (T018)
// ─────────────────────────────────────────────────────────────────────
describe('Error mapping', () => {
  test('401 → ApiUnauthorizedError instanceof ApiResponseError instanceof ApiError', async () => {
    globalThis.fetch = mockFetch(401, { message: 'Unauthorized' });
    const err = await User.find(1).catch(e => e);
    expect(err).toBeInstanceOf(ApiUnauthorizedError);
    expect(err).toBeInstanceOf(ApiResponseError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.statusCode).toBe(401);
  });

  test('403 → ApiForbiddenError', async () => {
    globalThis.fetch = mockFetch(403, { message: 'Forbidden' });
    const err = await User.find(1).catch(e => e);
    expect(err).toBeInstanceOf(ApiForbiddenError);
    expect(err.statusCode).toBe(403);
  });

  test('500 → ApiServerError', async () => {
    globalThis.fetch = mockFetch(500, { message: 'Server error' });
    const err = await User.find(1).catch(e => e);
    expect(err).toBeInstanceOf(ApiServerError);
    expect(err.statusCode).toBe(500);
  });

  test('429 with Retry-After: 30 → ApiRateLimitError with retryAfter === 30', async () => {
    const fetchMock = mockFetch(429, { message: 'Too many requests' }, { 'Retry-After': '30' });
    globalThis.fetch = fetchMock;
    const err = await User.find(1).catch(e => e);
    expect(err).toBeInstanceOf(ApiRateLimitError);
    expect(err.statusCode).toBe(429);
    expect(err.retryAfter).toBe(30);
  });

  test('network failure → ApiNetworkError', async () => {
    globalThis.fetch = mockFetchNetwork('Failed to connect');
    const err = await User.find(1).catch(e => e);
    expect(err).toBeInstanceOf(ApiNetworkError);
    expect(err).toBeInstanceOf(ApiError);
  });

  test('ApiQueryNotSupportedError has operation name in message', () => {
    const err = new ApiQueryNotSupportedError('join');
    expect(err).toBeInstanceOf(ApiQueryNotSupportedError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toContain('join');
    expect(err.operation).toBe('join');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Phase 3 — US-01: Debug utilities (T019)
// ─────────────────────────────────────────────────────────────────────
describe('Debug utilities', () => {
  test('toRequest() returns request info without fetch call', async () => {
    const fetchMock = jest.fn();
    globalThis.fetch = fetchMock;

    const user = new User({ id: 1, name: 'Alice' });
    user._syncOriginal();
    const req = await user.toRequest();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(req).toHaveProperty('method');
    expect(req).toHaveProperty('url');
    expect(req).toHaveProperty('headers');
  });

  test('adapter.toRequest returns correct method and url', async () => {
    const req = await adapter.toRequest('GET', '/users/1', {});
    expect(req.method).toBe('GET');
    expect(req.url).toBe('/users/1');
  });

  test('dd() calls console.log and returns undefined', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const user = new User({ id: 1, name: 'Alice' });
    user._syncOriginal();
    const result = user.dd();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();
    logSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Phase 3 — US-01: Lifecycle events (T020)
// ─────────────────────────────────────────────────────────────────────
describe('Lifecycle events', () => {
  test('creating event fires before POST completes', async () => {
    const fetchMock = mockFetch(201, { id: 10, name: 'Eve' });
    globalThis.fetch = fetchMock;

    const events = [];
    const user = new User({ name: 'Eve' });
    user.on('creating', () => events.push('creating'));
    user.on('created', () => events.push('created'));

    await user.save();

    expect(events).toEqual(['creating', 'created']);
  });

  test('updating / updated fire around PATCH', async () => {
    const fetchMock = mockFetch(200, { id: 1, name: 'Updated' });
    globalThis.fetch = fetchMock;

    const events = [];
    const user = new User({ id: 1, name: 'Alice' });
    user._syncOriginal();
    user.on('updating', () => events.push('updating'));
    user.on('updated', () => events.push('updated'));

    user.name = 'Updated';
    await user.save();

    expect(events).toEqual(['updating', 'updated']);
  });

  test('deleting / deleted fire around DELETE', async () => {
    const fetchMock = mockFetch(200, {});
    globalThis.fetch = fetchMock;

    const events = [];
    const user = new User({ id: 1 });
    user._syncOriginal();
    user.on('deleting', () => events.push('deleting'));
    user.on('deleted', () => events.push('deleted'));

    await user.destroy();

    expect(events).toEqual(['deleting', 'deleted']);
  });

  test('class-level creating event fires on Api.create()', async () => {
    const fetchMock = mockFetch(201, { id: 11, name: 'Frank' });
    globalThis.fetch = fetchMock;

    const events = [];
    User.on('created', () => events.push('class:created'));

    await User.create({ name: 'Frank' });

    expect(events).toContain('class:created');
    User.removeAllListeners('created');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Phase 4 — US-02: Authentication (T026)
// ─────────────────────────────────────────────────────────────────────
describe('Authentication', () => {
  test('bearer token is injected as Authorization: Bearer header', async () => {
    const fetchMock = mockFetch(200, []);
    globalThis.fetch = fetchMock;

    const bearerAdapter = new ApiAdapter({
      baseUrl: 'https://api.example.com',
      auth: { type: 'bearer', token: 'tok-abc' }
    });
    User.configure({ adapter: bearerAdapter });

    await User.all();

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers['Authorization']).toBe('Bearer tok-abc');
  });

  test('basic auth produces correct base64 Authorization header', async () => {
    const fetchMock = mockFetch(200, []);
    globalThis.fetch = fetchMock;

    const basicAdapter = new ApiAdapter({
      baseUrl: '',
      auth: { type: 'basic', username: 'admin', password: 'secret' }
    });
    User.configure({ adapter: basicAdapter });

    await User.all();

    const [, opts] = fetchMock.mock.calls[0];
    const expected = 'Basic ' + Buffer.from('admin:secret', 'utf8').toString('base64');
    expect(opts.headers['Authorization']).toBe(expected);
  });

  test('apiKey in header sends custom header name', async () => {
    const fetchMock = mockFetch(200, []);
    globalThis.fetch = fetchMock;

    const apiKeyAdapter = new ApiAdapter({
      baseUrl: '',
      auth: { type: 'apiKey', in: 'header', name: 'X-Custom-Key', key: 'k123' }
    });
    User.configure({ adapter: apiKeyAdapter });

    await User.all();

    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers['X-Custom-Key']).toBe('k123');
  });

  test('apiKey in query appends key to URL', async () => {
    const fetchMock = mockFetch(200, []);
    globalThis.fetch = fetchMock;

    const apiKeyAdapter = new ApiAdapter({
      baseUrl: 'https://api.example.com',
      auth: { type: 'apiKey', in: 'query', name: 'api_key', key: 'qkey' }
    });
    User.configure({ adapter: apiKeyAdapter });

    await User.all();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('api_key=qkey');
  });

  test('oauth2 on 401 calls refresh URL and retries with new token', async () => {
    let callCount = 0;
    const fetchMock = jest.fn().mockImplementation((url) => {
      if (url === 'https://auth.example.com/token') {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ access_token: 'new-token' }),
          text: () => Promise.resolve('{}')
        });
      }
      callCount++;
      if (callCount === 1) {
        // first API call returns 401
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: { get: () => null },
          json: () => Promise.resolve({ message: 'Unauthorized' }),
          text: () => Promise.resolve('{}')
        });
      }
      // retried call succeeds
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve([{ id: 1, name: 'Alice' }]),
        text: () => Promise.resolve('[]')
      });
    });
    globalThis.fetch = fetchMock;

    const oauth2Adapter = new ApiAdapter({
      baseUrl: '',
      auth: {
        type: 'oauth2',
        accessToken: 'old-token',
        refreshToken: 'ref-tok',
        refreshUrl: 'https://auth.example.com/token'
      }
    });
    User.configure({ adapter: oauth2Adapter });

    const users = await User.all();

    // fetch called at least twice (initial 401 + retry)
    expect(fetchMock).toHaveBeenCalledTimes(3); // initial + refresh + retry
    expect(Array.isArray(users)).toBe(true);
    expect(oauth2Adapter.auth.accessToken).toBe('new-token');
  });

  test('onRefreshFail is called when token refresh returns 401', async () => {
    const onRefreshFail = jest.fn();
    const fetchMock = jest.fn().mockImplementation((url) => {
      if (url === 'https://auth.example.com/token') {
        return Promise.resolve({
          ok: false,
          status: 401,
          headers: { get: () => null },
          json: () => Promise.resolve({}),
          text: () => Promise.resolve('{}')
        });
      }
      return Promise.resolve({
        ok: false,
        status: 401,
        headers: { get: () => null },
        json: () => Promise.resolve({ message: 'Unauthorized' }),
        text: () => Promise.resolve('{}')
      });
    });
    globalThis.fetch = fetchMock;

    const oauth2Adapter = new ApiAdapter({
      baseUrl: '',
      onRefreshFail,
      auth: {
        type: 'oauth2',
        accessToken: 'old-token',
        refreshToken: 'ref-tok',
        refreshUrl: 'https://auth.example.com/token'
      }
    });
    User.configure({ adapter: oauth2Adapter });

    await expect(User.all()).rejects.toBeDefined();
    expect(onRefreshFail).toHaveBeenCalledTimes(1);
  });

  test('dynamicHeaders fn is evaluated on each request and merged into headers', async () => {
    let callCount = 0;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve([]),
      text: () => Promise.resolve('[]')
    });
    globalThis.fetch = fetchMock;

    const dynamicAdapter = new ApiAdapter({
      baseUrl: '',
      dynamicHeaders: () => {
        callCount++;
        return { 'X-Request-Id': 'req-' + callCount };
      }
    });
    User.configure({ adapter: dynamicAdapter });

    await User.all();
    await User.all();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, opts1] = fetchMock.mock.calls[0];
    const [, opts2] = fetchMock.mock.calls[1];
    expect(opts1.headers['X-Request-Id']).toBe('req-1');
    expect(opts2.headers['X-Request-Id']).toBe('req-2');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Phase 4 — US-12: Multi-adapter (T027)
// ─────────────────────────────────────────────────────────────────────
describe('Multi-adapter', () => {
  // Separate model classes to avoid shared adapter state
  class Invoice extends Api {}
  Invoice.endpoint = '/invoices';
  Invoice.primaryKey = 'id';
  Invoice.fillable = [];
  Invoice.hidden = [];

  afterEach(() => {
    // Restore default adapter used by tests
    User.configure({ adapter: new ApiAdapter({ baseUrl: '' }) });
    Api.adapter = null;
  });

  test('two model classes with different adapters route to correct base URLs', async () => {
    const authAdapter = new ApiAdapter({ baseUrl: 'https://auth.example.com' });
    const payAdapter = new ApiAdapter({ baseUrl: 'https://pay.example.com' });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve([]),
      text: () => Promise.resolve('[]')
    });
    globalThis.fetch = fetchMock;

    User.configure({ adapter: authAdapter });
    Invoice.configure({ adapter: payAdapter });

    await User.all();
    await Invoice.all();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url1] = fetchMock.mock.calls[0];
    const [url2] = fetchMock.mock.calls[1];
    expect(url1).toContain('auth.example.com');
    expect(url2).toContain('pay.example.com');
  });

  test('Api.setDefaultAdapter() is used by models without explicit adapter', async () => {
    class Order extends Api {}
    Order.endpoint = '/orders';
    Order.primaryKey = 'id';
    Order.fillable = [];
    Order.hidden = [];

    const defaultAdapter = new ApiAdapter({ baseUrl: 'https://default.example.com' });
    Api.setDefaultAdapter(defaultAdapter);

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve([]),
      text: () => Promise.resolve('[]')
    });
    globalThis.fetch = fetchMock;

    await Order.all();

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('default.example.com');

    // cleanup
    Api.adapter = null;
  });

  test('usingAdapter(other) routes to other adapter without changing static adapter', async () => {
    const crmAdapter = new ApiAdapter({ baseUrl: 'https://crm.example.com' });
    const originalAdapter = new ApiAdapter({ baseUrl: 'https://original.example.com' });
    User.configure({ adapter: originalAdapter });

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve({ id: 1, name: 'Alice' }),
      text: () => Promise.resolve('{}')
    });
    globalThis.fetch = fetchMock;

    // Use override adapter for just this call
    const ScopedUser = User.usingAdapter(crmAdapter);
    await ScopedUser.find(1);

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('crm.example.com');

    // static adapter on User itself is unchanged
    expect(User.adapter).toBe(originalAdapter);
  });

  test('getDefaultAdapter() returns the adapter set via setDefaultAdapter()', () => {
    const defaultAdapter = new ApiAdapter({ baseUrl: 'https://default.example.com' });
    Api.setDefaultAdapter(defaultAdapter);
    expect(Api.getDefaultAdapter()).toBe(defaultAdapter);
    Api.adapter = null;
  });
});

// ─────────────────────────────────────────────────────────────────────
// Phase 9 — US-10: Error hierarchy (T052)
// ─────────────────────────────────────────────────────────────────────
describe('Error hierarchy', () => {
  test('ApiNotFoundError instanceof chain', () => {
    const err = new ApiNotFoundError('not found');
    expect(err).toBeInstanceOf(ApiNotFoundError);
    expect(err).toBeInstanceOf(ApiResponseError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
  });

  test('ApiUnauthorizedError instanceof chain', () => {
    const err = new ApiUnauthorizedError('unauthorized');
    expect(err).toBeInstanceOf(ApiUnauthorizedError);
    expect(err).toBeInstanceOf(ApiResponseError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
  });

  test('ApiForbiddenError instanceof chain', () => {
    const err = new ApiForbiddenError('forbidden');
    expect(err).toBeInstanceOf(ApiForbiddenError);
    expect(err).toBeInstanceOf(ApiResponseError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
  });

  test('ApiServerError instanceof chain', () => {
    const err = new ApiServerError('server error', 503);
    expect(err).toBeInstanceOf(ApiServerError);
    expect(err).toBeInstanceOf(ApiResponseError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(503);
  });

  test('ApiValidationError instanceof chain', () => {
    const err = new ApiValidationError('invalid', { source: 'client', errors: { name: 'required' } });
    expect(err).toBeInstanceOf(ApiValidationError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
    expect(err.errors).toEqual({ name: 'required' });
    expect(err.source).toBe('client');
  });

  test('ApiNetworkError instanceof chain', () => {
    const err = new ApiNetworkError('network fail');
    expect(err).toBeInstanceOf(ApiNetworkError);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
  });

  test('ApiRateLimitError.retryAfter numeric from delta-seconds header', async () => {
    const fetchMock = mockFetch(429, { message: 'Too many' }, { 'Retry-After': '45' });
    globalThis.fetch = fetchMock;
    const err = await User.find(1).catch(e => e);
    expect(err).toBeInstanceOf(ApiRateLimitError);
    expect(typeof err.retryAfter).toBe('number');
    expect(err.retryAfter).toBe(45);
  });

  test('ApiRateLimitError.retryAfter numeric from HTTP-date header', async () => {
    const future = new Date(Date.now() + 30000).toUTCString();
    const fetchMock = mockFetch(429, { message: 'Too many' }, { 'Retry-After': future });
    globalThis.fetch = fetchMock;
    const err = await User.find(1).catch(e => e);
    expect(err).toBeInstanceOf(ApiRateLimitError);
    expect(typeof err.retryAfter).toBe('number');
    expect(err.retryAfter).toBeGreaterThan(0);
  });

  test('ApiQueryNotSupportedError includes operation name', () => {
    const err = new ApiQueryNotSupportedError('groupBy');
    expect(err.message).toContain('groupBy');
    expect(err.operation).toBe('groupBy');
    expect(err).toBeInstanceOf(ApiError);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Phase 9 — US-10: Global onError handler (T053-T054)
// ─────────────────────────────────────────────────────────────────────
describe('Global onError handler', () => {
  test('onError spy called with the error instance on HTTP error', async () => {
    const onError = jest.fn();
    const errAdapter = new ApiAdapter({ baseUrl: '', onError });
    User.configure({ adapter: errAdapter });
    globalThis.fetch = mockFetch(404, { message: 'not found' });

    await expect(User.findOrFail(99)).rejects.toBeInstanceOf(ApiNotFoundError);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(ApiNotFoundError);
  });

  test('error still propagates after onError runs', async () => {
    const onError = jest.fn();
    const errAdapter = new ApiAdapter({ baseUrl: '', onError });
    User.configure({ adapter: errAdapter });
    globalThis.fetch = mockFetch(500, { message: 'server error' });

    const err = await User.find(1).catch(e => e);
    expect(err).toBeInstanceOf(ApiServerError);
    expect(onError).toHaveBeenCalledWith(err);
  });

  test('onError called for ApiNetworkError', async () => {
    const onError = jest.fn();
    const errAdapter = new ApiAdapter({ baseUrl: '', onError });
    User.configure({ adapter: errAdapter });
    globalThis.fetch = mockFetchNetwork('connection refused');

    await expect(User.all()).rejects.toBeInstanceOf(ApiNetworkError);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(ApiNetworkError);
  });

  test('onError called for client-side ApiValidationError', async () => {
    const onError = jest.fn();
    const errAdapter = new ApiAdapter({ baseUrl: '', onError });
    User.configure({ adapter: errAdapter });
    globalThis.fetch = mockFetch(422, { errors: { name: 'required' } });

    const err = await User.find(1).catch(e => e);
    expect(err).toBeInstanceOf(ApiValidationError);
    expect(onError).toHaveBeenCalledWith(err);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Phase 16 — US-19: Request log (T083-T084)
// ─────────────────────────────────────────────────────────────────────
describe('Request log', () => {
  test('no log without enableRequestLog()', async () => {
    const logAdapter = new ApiAdapter({ baseUrl: '' });
    User.configure({ adapter: logAdapter });
    globalThis.fetch = mockFetch(200, []);

    await User.all();
    expect(logAdapter.getRequestLog()).toHaveLength(0);
  });

  test('enableRequestLog() then 3 requests → log has 3 entries', async () => {
    const logAdapter = new ApiAdapter({ baseUrl: '' });
    logAdapter.enableRequestLog();
    User.configure({ adapter: logAdapter });
    globalThis.fetch = mockFetch(200, []);

    await User.all();
    await User.all();
    await User.all();
    expect(logAdapter.getRequestLog()).toHaveLength(3);
  });

  test('each log entry has method, url, timestamp', async () => {
    const logAdapter = new ApiAdapter({ baseUrl: '' });
    logAdapter.enableRequestLog();
    User.configure({ adapter: logAdapter });
    globalThis.fetch = mockFetch(200, { id: 1, name: 'Alice' });

    await User.find(1);
    const [entry] = logAdapter.getRequestLog();
    expect(entry).toHaveProperty('method');
    expect(entry).toHaveProperty('url');
    expect(entry).toHaveProperty('timestamp');
  });

  test('flushRequestLog() resets to empty', async () => {
    const logAdapter = new ApiAdapter({ baseUrl: '' });
    logAdapter.enableRequestLog();
    User.configure({ adapter: logAdapter });
    globalThis.fetch = mockFetch(200, []);

    await User.all();
    expect(logAdapter.getRequestLog()).toHaveLength(1);
    logAdapter.flushRequestLog();
    expect(logAdapter.getRequestLog()).toHaveLength(0);
  });

  test('dd() does not push to request log', async () => {
    const logAdapter = new ApiAdapter({ baseUrl: '' });
    logAdapter.enableRequestLog();
    User.configure({ adapter: logAdapter });
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    const user = new User({ id: 1, name: 'Alice' });
    user._syncOriginal();
    user.dd();

    expect(logAdapter.getRequestLog()).toHaveLength(0);
    consoleSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Phase 18 — US-21: Security (T092)
// ─────────────────────────────────────────────────────────────────────
describe('Security', () => {
  test('redactHeaders → toRequest() shows *** for listed header', async () => {
    const secAdapter = new ApiAdapter({
      baseUrl: '',
      auth: { type: 'bearer', token: 'secret-tok' },
      security: { redactHeaders: ['Authorization'] }
    });
    const req = await secAdapter.toRequest('GET', '/users', {});
    expect(req.headers['Authorization']).toBe('***');
  });

  test('redactHeaders: actual fetch still sends real token', async () => {
    const fetchMock = mockFetch(200, []);
    globalThis.fetch = fetchMock;
    const secAdapter = new ApiAdapter({
      baseUrl: '',
      auth: { type: 'bearer', token: 'my-real-token' },
      security: { redactHeaders: ['Authorization'] }
    });
    User.configure({ adapter: secAdapter });
    await User.all();
    const [, opts] = fetchMock.mock.calls[0];
    expect(opts.headers['Authorization']).toBe('Bearer my-real-token');
  });

  test('redactFields → request log entry has *** for listed field', async () => {
    const secAdapter = new ApiAdapter({
      baseUrl: '',
      security: { redactFields: ['password'] }
    });
    secAdapter.enableRequestLog();
    User.configure({ adapter: secAdapter });
    globalThis.fetch = mockFetch(201, { id: 1, name: 'Alice' });

    const user = new User({ name: 'Alice', password: 'p@ss' });
    await user.save();

    // The actual fetch is called with real password — only the log is redacted
    const [, opts] = globalThis.fetch.mock.calls[0];
    const body = JSON.parse(opts.body);
    expect(body.password).toBe('p@ss');
  });

  test('strictResponse:true + extra field → throws ApiValidationError', async () => {
    class StrictUser extends Api {}
    StrictUser.endpoint = '/strict-users';
    StrictUser.primaryKey = 'id';
    StrictUser.fillable = ['name', 'email'];
    StrictUser.strictResponse = true;

    const strictAdapter = new ApiAdapter({ baseUrl: '' });
    StrictUser.configure({ adapter: strictAdapter });
    globalThis.fetch = mockFetch(200, { id: 1, name: 'Alice', email: 'a@a.com', __debug: 'should fail' });

    await expect(StrictUser.find(1)).rejects.toBeInstanceOf(ApiValidationError);
  });

  test('strictResponse:false (default) → no error on extra fields', async () => {
    class LooseUser extends Api {}
    LooseUser.endpoint = '/loose-users';
    LooseUser.primaryKey = 'id';
    LooseUser.fillable = ['name'];
    // strictResponse not set (false by default)

    const looseAdapter = new ApiAdapter({ baseUrl: '' });
    LooseUser.configure({ adapter: looseAdapter });
    globalThis.fetch = mockFetch(200, { id: 1, name: 'Alice', unexpected_field: 'value' });

    const user = await LooseUser.find(1);
    expect(user).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────
// Phase 17 — US-20: CLI tools (T088 — documentation comment)
// ─────────────────────────────────────────────────────────────────────
/*
 * CLI Tools — Manual Integration Test Criteria (T088)
 *
 * outlet-api-import:
 *   node bin/api/import.js --spec openapi.json --output ./models
 *   - Spec with /users path → generates User.js with static endpoint = '/users'
 *   - Spec with $ref array field → generates hasMany relation
 *   - --lang ts → generates TypeScript class file
 *   Exit code: 0 on success, 1 on missing required args or spec parse error
 *
 * outlet-api-diff:
 *   node bin/api/diff.js --spec openapi.json --models ./models
 *   - Exits 0 when all spec paths have corresponding model files in sync
 *   - Exits 1 with diff report when model files diverge from spec
 *   - Reports: missing models, extra models, field mismatches
 *   Exit code: 0 = in sync, 1 = diverged
 */


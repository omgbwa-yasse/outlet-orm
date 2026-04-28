'use strict';

const { MockAdapter } = require('../src/Api/MockAdapter');
const { ApiError } = require('../src/Api/Errors/ApiError');
const { ApiNetworkError } = require('../src/Api/Errors/ApiNetworkError');
const { ApiNotFoundError } = require('../src/Api/Errors/ApiNotFoundError');
const { ApiValidationError } = require('../src/Api/Errors/ApiValidationError');
const { ApiUnauthorizedError } = require('../src/Api/Errors/ApiUnauthorizedError');
const { ApiForbiddenError } = require('../src/Api/Errors/ApiForbiddenError');

// ── onGet / onPost / onPut / onPatch / onDelete ───────────────────────────────

describe('MockAdapter — basic reply', () => {
  let adapter;
  beforeEach(() => { adapter = new MockAdapter({ baseURL: 'http://localhost' }); });

  test('onGet.reply returns data', async () => {
    adapter.onGet('/users').reply(200, [{ id: 1 }]);
    const result = await adapter.request('GET', '/users', {});
    expect(result).toEqual([{ id: 1 }]);
  });

  test('onPost.reply returns created data', async () => {
    adapter.onPost('/users').reply(201, { id: 2, name: 'Bob' });
    const result = await adapter.request('POST', '/users', { body: { name: 'Bob' } });
    expect(result).toEqual({ id: 2, name: 'Bob' });
  });

  test('onPut.reply', async () => {
    adapter.onPut('/users/1').reply(200, { id: 1, name: 'Alice' });
    const result = await adapter.request('PUT', '/users/1', {});
    expect(result).toEqual({ id: 1, name: 'Alice' });
  });

  test('onPatch.reply', async () => {
    adapter.onPatch('/users/1').reply(200, { id: 1 });
    const result = await adapter.request('PATCH', '/users/1', {});
    expect(result).toEqual({ id: 1 });
  });

  test('onDelete.reply', async () => {
    adapter.onDelete('/users/1').reply(204, null);
    const result = await adapter.request('DELETE', '/users/1', {});
    expect(result).toBeNull();
  });
});

// ── replyOnce ─────────────────────────────────────────────────────────────────

describe('MockAdapter — replyOnce', () => {
  test('replyOnce is consumed and not repeated', async () => {
    const adapter = new MockAdapter({ baseURL: 'http://localhost' });
    adapter.onGet('/items').replyOnce(200, [{ id: 1 }]);
    const result = await adapter.request('GET', '/items', {});
    expect(result).toEqual([{ id: 1 }]);
    // Second call — no handler, should throw
    await expect(adapter.request('GET', '/items', {})).rejects.toThrow(ApiError);
  });
});

// ── Regex URL matching ────────────────────────────────────────────────────────

describe('MockAdapter — RegExp URL matching', () => {
  test('matches with regex pattern', async () => {
    const adapter = new MockAdapter({ baseURL: 'http://localhost' });
    adapter.onGet(/\/users\/\d+/).reply(200, { id: 42 });
    const result = await adapter.request('GET', '/users/42', {});
    expect(result).toEqual({ id: 42 });
  });

  test('does not match unrelated path', async () => {
    const adapter = new MockAdapter({ baseURL: 'http://localhost' });
    adapter.onGet(/\/users\/\d+/).reply(200, { id: 1 });
    await expect(adapter.request('GET', '/posts/1', {})).rejects.toThrow(ApiError);
  });
});

// ── networkError / timeout / delay ───────────────────────────────────────────

describe('MockAdapter — networkError', () => {
  test('throws ApiNetworkError', async () => {
    const adapter = new MockAdapter({ baseURL: 'http://localhost' });
    adapter.onGet('/offline').networkError();
    await expect(adapter.request('GET', '/offline', {})).rejects.toThrow(ApiNetworkError);
  });
});

describe('MockAdapter — timeout', () => {
  test('throws error with TIMEOUT code', async () => {
    const adapter = new MockAdapter({ baseURL: 'http://localhost' });
    adapter.onGet('/slow').timeout();
    await expect(adapter.request('GET', '/slow', {})).rejects.toMatchObject({ code: 'TIMEOUT' });
  });
});

describe('MockAdapter — delay', () => {
  test('delay pauses before responding', async () => {
    const adapter = new MockAdapter({ baseURL: 'http://localhost' });
    adapter.onGet('/delayed').delay(50).reply(200, { ok: true });
    const t0 = Date.now();
    const result = await adapter.request('GET', '/delayed', {});
    expect(Date.now() - t0).toBeGreaterThanOrEqual(40);
    expect(result).toEqual({ ok: true });
  });
});

// ── 4xx / 5xx error mapping ───────────────────────────────────────────────────

describe('MockAdapter — error status codes', () => {
  let adapter;
  beforeEach(() => { adapter = new MockAdapter({ baseURL: 'http://localhost' }); });

  test('404 throws ApiNotFoundError', async () => {
    adapter.onGet('/missing').reply(404, { message: 'Not found' });
    await expect(adapter.request('GET', '/missing', {})).rejects.toThrow(ApiNotFoundError);
  });

  test('401 throws ApiUnauthorizedError', async () => {
    adapter.onGet('/secure').reply(401, { message: 'Unauthorized' });
    await expect(adapter.request('GET', '/secure', {})).rejects.toThrow(ApiUnauthorizedError);
  });

  test('403 throws ApiForbiddenError', async () => {
    adapter.onGet('/admin').reply(403, { message: 'Forbidden' });
    await expect(adapter.request('GET', '/admin', {})).rejects.toThrow(ApiForbiddenError);
  });

  test('422 throws ApiValidationError', async () => {
    adapter.onPost('/users').reply(422, { message: 'Validation failed', errors: { name: ['required'] } });
    await expect(adapter.request('POST', '/users', {})).rejects.toThrow(ApiValidationError);
  });

  test('500 throws ApiResponseError or ApiError', async () => {
    adapter.onGet('/crash').reply(500, { message: 'Server error' });
    await expect(adapter.request('GET', '/crash', {})).rejects.toThrow(ApiError);
  });
});

// ── onAny ─────────────────────────────────────────────────────────────────────

describe('MockAdapter — onAny', () => {
  test('matches any HTTP method', async () => {
    const adapter = new MockAdapter({ baseURL: 'http://localhost' });
    adapter.onAny('/health').reply(200, { status: 'ok' });
    expect(await adapter.request('GET', '/health', {})).toEqual({ status: 'ok' });
    expect(await adapter.request('POST', '/health', {})).toEqual({ status: 'ok' });
  });
});

// ── reset / setPassthrough ────────────────────────────────────────────────────

describe('MockAdapter — reset', () => {
  test('reset clears all handlers', async () => {
    const adapter = new MockAdapter({ baseURL: 'http://localhost' });
    adapter.onGet('/foo').reply(200, {});
    adapter.reset();
    await expect(adapter.request('GET', '/foo', {})).rejects.toThrow(ApiError);
  });
});

// ── Request log has mocked: true ──────────────────────────────────────────────

describe('MockAdapter — request log', () => {
  test('logged entries have mocked: true', async () => {
    const adapter = new MockAdapter({ baseURL: 'http://localhost' });
    adapter.onGet('/log-test').reply(200, {});
    await adapter.request('GET', '/log-test', {});
    const log = adapter.requestLog;
    expect(log.length).toBeGreaterThan(0);
    expect(log[log.length - 1].mocked).toBe(true);
  });
});

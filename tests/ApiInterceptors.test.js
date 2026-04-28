'use strict';

const { InterceptorManager } = require('../src/Api/Interceptors/InterceptorManager');
const { MockAdapter } = require('../src/Api/MockAdapter');
const { ApiError } = require('../src/Api/Errors/ApiError');
const { ApiNetworkError } = require('../src/Api/Errors/ApiNetworkError');

// ── InterceptorManager unit tests ─────────────────────────────────────────────

describe('InterceptorManager — addRequest / remove', () => {
  test('addRequest returns an id', () => {
    const mgr = new InterceptorManager();
    const id = mgr.addRequest(c => c);
    expect(typeof id).toBe('number');
  });

  test('requestCount increments', () => {
    const mgr = new InterceptorManager();
    mgr.addRequest(c => c);
    mgr.addRequest(c => c);
    expect(mgr.requestCount).toBe(2);
  });

  test('addResponse returns an id', () => {
    const mgr = new InterceptorManager();
    const id = mgr.addResponse(r => r);
    expect(typeof id).toBe('number');
  });

  test('responseCount increments', () => {
    const mgr = new InterceptorManager();
    mgr.addResponse(r => r);
    mgr.addResponse(r => r);
    expect(mgr.responseCount).toBe(2);
  });

  test('remove eliminates request interceptor', () => {
    const mgr = new InterceptorManager();
    const id = mgr.addRequest(c => c);
    mgr.remove(id);
    expect(mgr.requestCount).toBe(0);
  });

  test('remove eliminates response interceptor', () => {
    const mgr = new InterceptorManager();
    const id = mgr.addResponse(r => r);
    mgr.remove(id);
    expect(mgr.responseCount).toBe(0);
  });
});

describe('InterceptorManager — runRequest', () => {
  test('chains interceptors and mutates config', async () => {
    const mgr = new InterceptorManager();
    mgr.addRequest(config => {
      config.options = Object.assign({}, config.options, { headers: { 'X-Token': 'abc' } });
      return config;
    });
    const result = await mgr.runRequest({ method: 'GET', path: '/test', options: {} });
    expect(result.options.headers['X-Token']).toBe('abc');
  });

  test('multiple request interceptors run in order', async () => {
    const mgr = new InterceptorManager();
    const calls = [];
    mgr.addRequest(c => { calls.push(1); return c; });
    mgr.addRequest(c => { calls.push(2); return c; });
    await mgr.runRequest({ method: 'GET', path: '/', options: {} });
    expect(calls).toEqual([1, 2]);
  });
});

describe('InterceptorManager — runResponseSuccess', () => {
  test('transforms response data', async () => {
    const mgr = new InterceptorManager();
    mgr.addResponse(data => ({ ...data, extra: true }));
    const result = await mgr.runResponseSuccess({ id: 1 });
    expect(result.extra).toBe(true);
  });
});

describe('InterceptorManager — runResponseError', () => {
  test('re-throws if no error interceptor', async () => {
    const mgr = new InterceptorManager();
    await expect(mgr.runResponseError(new Error('boom'))).rejects.toThrow('boom');
  });

  test('error interceptor can swallow error by returning a value', async () => {
    const mgr = new InterceptorManager();
    mgr.addResponse(null, () => ({ recovered: true }));
    const result = await mgr.runResponseError(new Error('err'));
    expect(result).toEqual({ recovered: true });
  });
});

// ── Integration with MockAdapter — request interceptors modify config ─────────

describe('ApiAdapter — request interceptors integration', () => {
  test('request interceptor adds header seen in request config', async () => {
    const adapter = new MockAdapter({ baseURL: 'http://localhost' });
    const capturedConfigs = [];
    adapter.interceptors.addRequest(config => {
      capturedConfigs.push(config);
      config.options = Object.assign({}, config.options, {
        headers: Object.assign({}, (config.options || {}).headers, { 'X-Custom': 'yes' })
      });
      return config;
    });
    adapter.onGet('/ping').reply(200, { pong: true });
    await adapter.request('GET', '/ping', {});
    expect(capturedConfigs[0].options.headers['X-Custom']).toBe('yes');
  });

  test('response interceptor transforms return value', async () => {
    const adapter = new MockAdapter({ baseURL: 'http://localhost' });
    adapter.interceptors.addResponse(data => ({ wrapped: data }));
    adapter.onGet('/data').reply(200, { value: 42 });
    const result = await adapter.request('GET', '/data', {});
    expect(result).toEqual({ wrapped: { value: 42 } });
  });
});

// ── Circuit Breaker ───────────────────────────────────────────────────────────

describe('ApiAdapter — circuit breaker', () => {
  test('opens after failureThreshold errors', async () => {
    const adapter = new MockAdapter({
      baseURL: 'http://localhost',
      circuitBreaker: { enabled: true, failureThreshold: 3, recoveryTimeout: 60000 }
    });
    adapter.onAny('/cb-fail').networkError();

    for (let i = 0; i < 3; i++) {
      await adapter.request('GET', '/cb-fail', {}).catch(() => {});
    }

    // Circuit should be open now
    await expect(adapter.request('GET', '/cb-fail', {})).rejects.toMatchObject({ code: 'CIRCUIT_OPEN' });
  });

  test('half-open after recoveryTimeout: one success closes the circuit', async () => {
    const adapter = new MockAdapter({
      baseURL: 'http://localhost',
      circuitBreaker: { enabled: true, failureThreshold: 1, recoveryTimeout: 10 }
    });
    adapter.onAny('/breaker').networkError();
    await adapter.request('GET', '/breaker', {}).catch(() => {});

    // Wait for recovery timeout
    await new Promise(r => setTimeout(r, 20));

    adapter.reset();
    adapter.onGet('/breaker').reply(200, { ok: true });
    const result = await adapter.request('GET', '/breaker', {});
    expect(result).toEqual({ ok: true });
    expect(adapter._cb.state).toBe('closed');
  });
});

// ── Retry ─────────────────────────────────────────────────────────────────────

describe('ApiAdapter — retry', () => {
  test('retries on retryable network error', async () => {
    const adapter = new MockAdapter({
      baseURL: 'http://localhost',
      retry: { maxRetries: 2, delay: 5 }
    });
    let callCount = 0;
    adapter.onGet('/retry-test').reply(200, { ok: true });

    // Override to fail first two times, succeed on third
    const originalRequest = adapter._matchHandler.bind(adapter);
    let matchCalls = 0;
    // Use a side-effect via networkError + replyOnce pattern
    adapter.reset();
    adapter.onGet('/retry-net').networkError(true);
    adapter.onGet('/retry-net').networkError(true);
    adapter.onGet('/retry-net').reply(200, { ok: true });

    const result = await adapter.request('GET', '/retry-net', {});
    expect(result).toEqual({ ok: true });
  }, 10000);
});

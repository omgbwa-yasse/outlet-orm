'use strict';

/**
 * Integration tests — live HTTP requests to free public APIs.
 *
 * APIs used:
 *   • https://jsonplaceholder.typicode.com  — fake REST (CRUD, JSON arrays)
 *   • https://httpbin.org                   — HTTP introspection (auth, headers, status codes)
 *
 * These tests require an internet connection.
 * Run selectively:  npx jest tests/ApiLayerIntegration.test.js --no-coverage
 */

const { ApiAdapter } = require('../src/Api/ApiAdapter');
const { Api }        = require('../src/Api/Api');
const { ApiNotFoundError }     = require('../src/Api/Errors/ApiNotFoundError');
const { ApiUnauthorizedError } = require('../src/Api/Errors/ApiUnauthorizedError');
const { ApiForbiddenError }    = require('../src/Api/Errors/ApiForbiddenError');
const { ApiServerError }       = require('../src/Api/Errors/ApiServerError');
const { ApiRateLimitError }    = require('../src/Api/Errors/ApiRateLimitError');
const { ApiNetworkError }      = require('../src/Api/Errors/ApiNetworkError');
const { ApiResponseError }     = require('../src/Api/Errors/ApiResponseError');

jest.setTimeout(30000);

// ── Shared adapters ───────────────────────────────────────────────────
const jphAdapter = new ApiAdapter({
  baseUrl: 'https://jsonplaceholder.typicode.com',
  timeout: 15000
});

const httpbinAdapter = new ApiAdapter({
  baseUrl: 'https://httpbin.org',
  timeout: 15000
});

// ── JSONPlaceholder models ────────────────────────────────────────────
class Post extends Api {}
Post.endpoint   = '/posts';
Post.primaryKey = 'id';
Post.fillable   = [];
Post.casts      = {};
Post.configure({ adapter: jphAdapter });

class Comment extends Api {}
Comment.endpoint   = '/comments';
Comment.primaryKey = 'id';
Comment.fillable   = [];
Comment.casts      = {};
Comment.configure({ adapter: jphAdapter });

class JPHUser extends Api {}
JPHUser.endpoint   = '/users';
JPHUser.primaryKey = 'id';
JPHUser.fillable   = [];
JPHUser.casts      = {};
JPHUser.configure({ adapter: jphAdapter });

// ─────────────────────────────────────────────────────────────────────
// 1 — JSONPlaceholder CRUD
// ─────────────────────────────────────────────────────────────────────
describe('[Integration] JSONPlaceholder — CRUD', () => {
  test('Post.all() returns array of hydrated Post instances', async () => {
    const posts = await Post.all();

    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
    expect(posts[0]).toBeInstanceOf(Post);
    expect(posts[0]._attributes).toHaveProperty('id');
    expect(posts[0]._attributes).toHaveProperty('title');
    expect(posts[0]._attributes).toHaveProperty('userId');
  });

  test('Post.find(1) returns hydrated Post with correct id', async () => {
    const post = await Post.find(1);

    expect(post).toBeInstanceOf(Post);
    expect(post._attributes.id).toBe(1);
    expect(post._attributes).toHaveProperty('title');
    expect(post._attributes).toHaveProperty('body');
  });

  test('Post.find(99999) returns null for non-existent id (404)', async () => {
    const post = await Post.find(99999);
    expect(post).toBeNull();
  });

  test('Post.findOrFail(99999) throws ApiNotFoundError', async () => {
    await expect(Post.findOrFail(99999)).rejects.toBeInstanceOf(ApiNotFoundError);
  });

  test('Post.first() returns the first post in the collection', async () => {
    const post = await Post.first();

    expect(post).toBeInstanceOf(Post);
    expect(post._attributes).toHaveProperty('id');
    expect(post._attributes).toHaveProperty('title');
  });

  test('Post.create({...}) returns new post with id assigned by server', async () => {
    const post = await Post.create({
      title: 'Integration Test',
      body: 'Testing outlet-orm api-layer v13',
      userId: 1
    });

    expect(post).toBeInstanceOf(Post);
    expect(post._attributes).toHaveProperty('id');
    expect(typeof post._attributes.id).toBe('number');
    // JSONPlaceholder echoes back the fields we sent
    expect(post._attributes.title).toBe('Integration Test');
    expect(post._attributes.userId).toBe(1);
  });

  test('post.save() on existing record (PATCH) updates the instance', async () => {
    const post = new Post({ id: 1, title: 'Original', body: 'content', userId: 1 });
    post._syncOriginal();
    post.title = 'Patched Title';
    await post.save();

    // JSONPlaceholder echoes back the PATCH body merged with the id
    expect(post._attributes.title).toBe('Patched Title');
    expect(post._attributes.id).toBe(1);
  });

  test('post.destroy() sends DELETE — resolves without error', async () => {
    const post = new Post({ id: 1 });
    post._syncOriginal();
    await expect(post.destroy()).resolves.toBe(true);
  });

  test('Post.all({ userId: 1 }) filters results with query params', async () => {
    const posts = await Post.all({ userId: 1 });

    expect(Array.isArray(posts)).toBe(true);
    expect(posts.length).toBeGreaterThan(0);
    posts.forEach(p => {
      expect(p._attributes.userId).toBe(1);
    });
  });

  test('Comment.all({ postId: 1 }) returns comments for post 1', async () => {
    const comments = await Comment.all({ postId: 1 });

    expect(Array.isArray(comments)).toBe(true);
    expect(comments.length).toBeGreaterThan(0);
    comments.forEach(c => {
      expect(c._attributes.postId).toBe(1);
    });
  });

  test('JPHUser.find(1) returns user with username and email', async () => {
    const user = await JPHUser.find(1);

    expect(user).toBeInstanceOf(JPHUser);
    expect(user._attributes).toHaveProperty('username');
    expect(user._attributes).toHaveProperty('email');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 2 — HTTP error status codes via httpbin.org
// ─────────────────────────────────────────────────────────────────────
describe('[Integration] HTTP error status codes — httpbin.org', () => {
  // Use adapter.request() directly so response shape (non-array) doesn't matter

  test('GET /status/404 → ApiNotFoundError (statusCode 404)', async () => {
    const err = await httpbinAdapter.request('GET', '/status/404').catch(e => e);
    expect(err).toBeInstanceOf(ApiNotFoundError);
    expect(err).toBeInstanceOf(ApiResponseError);
    expect(err.statusCode).toBe(404);
  });

  test('GET /status/401 → ApiUnauthorizedError (statusCode 401)', async () => {
    const err = await httpbinAdapter.request('GET', '/status/401').catch(e => e);
    expect(err).toBeInstanceOf(ApiUnauthorizedError);
    expect(err).toBeInstanceOf(ApiResponseError);
    expect(err.statusCode).toBe(401);
  });

  test('GET /status/403 → ApiForbiddenError (statusCode 403)', async () => {
    const err = await httpbinAdapter.request('GET', '/status/403').catch(e => e);
    expect(err).toBeInstanceOf(ApiForbiddenError);
    expect(err).toBeInstanceOf(ApiResponseError);
    expect(err.statusCode).toBe(403);
  });

  test('GET /status/500 → ApiServerError (statusCode 500)', async () => {
    const err = await httpbinAdapter.request('GET', '/status/500').catch(e => e);
    expect(err).toBeInstanceOf(ApiServerError);
    expect(err).toBeInstanceOf(ApiResponseError);
    expect(err.statusCode).toBe(500);
  });

  test('GET /status/503 → ApiServerError (statusCode 503)', async () => {
    const err = await httpbinAdapter.request('GET', '/status/503').catch(e => e);
    expect(err).toBeInstanceOf(ApiServerError);
    expect(err.statusCode).toBe(503);
  });

  test('GET /status/429 → ApiRateLimitError (statusCode 429)', async () => {
    const err = await httpbinAdapter.request('GET', '/status/429').catch(e => e);
    expect(err).toBeInstanceOf(ApiRateLimitError);
    expect(err).toBeInstanceOf(ApiResponseError);
    expect(err.statusCode).toBe(429);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 3 — Authentication headers verified against httpbin.org
// ─────────────────────────────────────────────────────────────────────
describe('[Integration] Authentication headers — httpbin.org', () => {
  // Helper: find header value case-insensitively in httpbin headers map
  function getHeader(headers, name) {
    const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : undefined;
  }

  test('bearer token accepted by /bearer → 200 with authenticated:true', async () => {
    const adapter = new ApiAdapter({
      baseUrl: 'https://httpbin.org',
      timeout: 15000,
      auth: { type: 'bearer', token: 'outlet-orm-test-token' }
    });
    // httpbin /bearer: returns 200 if Authorization: Bearer <anything> present
    const data = await adapter.request('GET', '/bearer');

    expect(data).toHaveProperty('authenticated', true);
    expect(data).toHaveProperty('token', 'outlet-orm-test-token');
  });

  test('no bearer token on /bearer → ApiUnauthorizedError', async () => {
    const adapter = new ApiAdapter({ baseUrl: 'https://httpbin.org', timeout: 15000 });
    const err = await adapter.request('GET', '/bearer').catch(e => e);

    expect(err).toBeInstanceOf(ApiUnauthorizedError);
    expect(err.statusCode).toBe(401);
  });

  test('correct basic auth accepted by /basic-auth/{user}/{pass} → 200', async () => {
    const adapter = new ApiAdapter({
      baseUrl: 'https://httpbin.org',
      timeout: 15000,
      auth: { type: 'basic', username: 'alice', password: 'wonderland' }
    });
    const data = await adapter.request('GET', '/basic-auth/alice/wonderland');

    expect(data).toHaveProperty('authenticated', true);
    expect(data).toHaveProperty('user', 'alice');
  });

  test('wrong basic auth password → ApiUnauthorizedError', async () => {
    const adapter = new ApiAdapter({
      baseUrl: 'https://httpbin.org',
      timeout: 15000,
      auth: { type: 'basic', username: 'alice', password: 'wrongpassword' }
    });
    const err = await adapter.request('GET', '/basic-auth/alice/wonderland').catch(e => e);

    expect(err).toBeInstanceOf(ApiUnauthorizedError);
    expect(err.statusCode).toBe(401);
  });

  test('static custom header forwarded and visible in /headers response', async () => {
    const adapter = new ApiAdapter({
      baseUrl: 'https://httpbin.org',
      timeout: 15000,
      headers: { 'X-Outlet-Test': 'integration-v13' }
    });
    // httpbin /headers returns { headers: { "X-Outlet-Test": "...", ... } }
    const data = await adapter.request('GET', '/headers');

    expect(data).toHaveProperty('headers');
    expect(getHeader(data.headers, 'X-Outlet-Test')).toBe('integration-v13');
  });

  test('dynamicHeaders fn called per-request — incremented value visible each time', async () => {
    let callCount = 0;
    const adapter = new ApiAdapter({
      baseUrl: 'https://httpbin.org',
      timeout: 15000,
      dynamicHeaders: () => {
        callCount++;
        return { 'X-Request-Count': String(callCount) };
      }
    });

    const first  = await adapter.request('GET', '/headers');
    const second = await adapter.request('GET', '/headers');

    expect(callCount).toBe(2);
    expect(getHeader(first.headers,  'X-Request-Count')).toBe('1');
    expect(getHeader(second.headers, 'X-Request-Count')).toBe('2');
  });

  test('apiKey in query param appended to URL — visible in /get args', async () => {
    const adapter = new ApiAdapter({
      baseUrl: 'https://httpbin.org',
      timeout: 15000,
      auth: { type: 'apiKey', in: 'query', name: 'api_key', key: 'outlet-secret' }
    });
    // httpbin /get echoes the request: { args: { api_key: '...' }, ... }
    const data = await adapter.request('GET', '/get');

    expect(data).toHaveProperty('args');
    expect(data.args['api_key']).toBe('outlet-secret');
  });

  test('apiKey in header forwarded and visible in /headers response', async () => {
    const adapter = new ApiAdapter({
      baseUrl: 'https://httpbin.org',
      timeout: 15000,
      auth: { type: 'apiKey', in: 'header', name: 'X-Api-Key', key: 'hdr-outlet-key' }
    });
    const data = await adapter.request('GET', '/headers');

    expect(data).toHaveProperty('headers');
    expect(getHeader(data.headers, 'X-Api-Key')).toBe('hdr-outlet-key');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 4 — POST body, request logging, and toRequest()
// ─────────────────────────────────────────────────────────────────────
describe('[Integration] POST body, request log, and toRequest()', () => {
  test('POST /post echoes the JSON body back in response.json', async () => {
    const payload = { framework: 'outlet-orm', version: 13, active: true };
    const data = await httpbinAdapter.request('POST', '/post', { body: payload });

    // httpbin /post returns { json: { ... }, data: '...', headers: {...}, ... }
    expect(data).toHaveProperty('json');
    expect(data.json).toMatchObject(payload);
  });

  test('PATCH /patch echoes body in response.json', async () => {
    const payload = { name: 'patched', value: 42 };
    const data = await httpbinAdapter.request('PATCH', '/patch', { body: payload });

    expect(data).toHaveProperty('json');
    expect(data.json).toMatchObject(payload);
  });

  test('request log records method, url, timestamp after enableRequestLog()', async () => {
    const adapter = new ApiAdapter({
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 15000
    });
    adapter.enableRequestLog();

    await adapter.request('GET', '/posts/1');
    await adapter.request('GET', '/posts/2');

    const log = adapter.getRequestLog();
    expect(log.length).toBe(2);
    expect(log[0].method).toBe('GET');
    expect(log[0].url).toBe('https://jsonplaceholder.typicode.com/posts/1');
    expect(log[0]).toHaveProperty('timestamp');
    expect(log[1].url).toBe('https://jsonplaceholder.typicode.com/posts/2');
  });

  test('flushRequestLog() clears the log', async () => {
    const adapter = new ApiAdapter({
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 15000
    });
    adapter.enableRequestLog();
    await adapter.request('GET', '/posts/1');
    expect(adapter.getRequestLog().length).toBe(1);

    adapter.flushRequestLog();
    expect(adapter.getRequestLog().length).toBe(0);
  });

  test('adapter.toRequest() builds request object without making a network call', async () => {
    const adapter = new ApiAdapter({
      baseUrl: 'https://jsonplaceholder.typicode.com',
      timeout: 15000,
      auth: { type: 'bearer', token: 'preview-token' }
    });

    const req = await adapter.toRequest('GET', '/posts/1', {});

    expect(req.method).toBe('GET');
    expect(req.url).toBe('https://jsonplaceholder.typicode.com/posts/1');
    expect(req.headers).toHaveProperty('Authorization', 'Bearer preview-token');
  });
});

// ─────────────────────────────────────────────────────────────────────
// 5 — Timeout and network errors
// ─────────────────────────────────────────────────────────────────────
describe('[Integration] Timeout and network errors', () => {
  test('short timeout on /delay/5 → ApiNetworkError (Request timed out)', async () => {
    const adapter = new ApiAdapter({
      baseUrl: 'https://httpbin.org',
      timeout: 1500  // 1.5 s — httpbin /delay/5 responds after 5 s
    });

    const err = await adapter.request('GET', '/delay/5').catch(e => e);

    expect(err).toBeInstanceOf(ApiNetworkError);
    expect(err.message).toBe('Request timed out');
  }, 10000);

  test('request to non-existent domain → ApiNetworkError', async () => {
    const adapter = new ApiAdapter({
      baseUrl: 'https://this-domain-does-not-exist-outlet-orm-x99.invalid',
      timeout: 8000
    });

    const err = await adapter.request('GET', '/test').catch(e => e);

    expect(err).toBeInstanceOf(ApiNetworkError);
  }, 12000);
});

// ─────────────────────────────────────────────────────────────────────
// 6 — Multi-adapter routing with live URLs
// ─────────────────────────────────────────────────────────────────────
describe('[Integration] Multi-adapter — two live endpoints', () => {
  class LivePost extends Api {}
  LivePost.endpoint   = '/posts';
  LivePost.primaryKey = 'id';
  LivePost.fillable   = [];
  LivePost.casts      = {};
  LivePost.configure({ adapter: jphAdapter });

  test('two models use different adapters — each reaches its own base URL', async () => {
    // LivePost uses JSONPlaceholder
    const post = await LivePost.find(1);
    expect(post).toBeInstanceOf(LivePost);
    expect(post._attributes.id).toBe(1);

    // Direct adapter call to httpbin for same numeric path → 404
    const err = await httpbinAdapter.request('GET', '/posts/1').catch(e => e);
    expect(err).toBeInstanceOf(ApiNotFoundError);
  });

  test('usingAdapter() routes requests through the override adapter', async () => {
    const altAdapter = new ApiAdapter({
      baseUrl: 'https://httpbin.org',
      timeout: 15000
    });
    const ScopedLivePost = LivePost.usingAdapter(altAdapter);

    // ScopedLivePost._getAdapter() must be altAdapter
    expect(ScopedLivePost._getAdapter()).toBe(altAdapter);

    // LivePost._getAdapter() must still be jphAdapter
    expect(LivePost._getAdapter()).toBe(jphAdapter);

    // Instances of ScopedLivePost are still instanceof LivePost
    const post = new ScopedLivePost({ id: 99 });
    expect(post).toBeInstanceOf(LivePost);
  });

  test('setDefaultAdapter + getDefaultAdapter round-trip', () => {
    const prev = Api.getDefaultAdapter();
    const newAdapter = new ApiAdapter({ baseUrl: 'https://example.com', timeout: 5000 });

    Api.setDefaultAdapter(newAdapter);
    expect(Api.getDefaultAdapter()).toBe(newAdapter);

    // Restore previous default
    Api.setDefaultAdapter(prev);
    expect(Api.getDefaultAdapter()).toBe(prev);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 7 — Lifecycle events with real responses
// ─────────────────────────────────────────────────────────────────────
describe('[Integration] Lifecycle events with real network calls', () => {
  test('creating / created events fire around Post.create()', async () => {
    const events = [];
    Post.on('creating', () => events.push('class:creating'));
    Post.on('created',  () => events.push('class:created'));

    await Post.create({ title: 'Event Test', body: 'body', userId: 1 });

    expect(events).toContain('class:creating');
    expect(events).toContain('class:created');
    expect(events.indexOf('class:creating')).toBeLessThan(events.indexOf('class:created'));

    Post.removeAllListeners('creating');
    Post.removeAllListeners('created');
  });

  test('updating / updated events fire around post.save() on existing id', async () => {
    const post = new Post({ id: 1, title: 'Old', body: 'body', userId: 1 });
    post._syncOriginal();

    const events = [];
    post.on('updating', () => events.push('updating'));
    post.on('updated',  () => events.push('updated'));

    post.title = 'New Title';
    await post.save();

    expect(events).toEqual(['updating', 'updated']);
  });

  test('deleting / deleted events fire around post.destroy()', async () => {
    const post = new Post({ id: 1 });
    post._syncOriginal();

    const events = [];
    post.on('deleting', () => events.push('deleting'));
    post.on('deleted',  () => events.push('deleted'));

    await post.destroy();

    expect(events).toEqual(['deleting', 'deleted']);
  });
});

// ─────────────────────────────────────────────────────────────────────
// 8 — onError callback fires on error responses
// ─────────────────────────────────────────────────────────────────────
describe('[Integration] onError callback — httpbin.org', () => {
  test('onError receives the typed error when status is 404', async () => {
    let capturedError = null;
    const adapter = new ApiAdapter({
      baseUrl: 'https://httpbin.org',
      timeout: 15000,
      onError: (err) => { capturedError = err; }
    });

    const err = await adapter.request('GET', '/status/404').catch(e => e);

    expect(capturedError).toBe(err);
    expect(capturedError).toBeInstanceOf(ApiNotFoundError);
  });

  test('onError receives ApiNetworkError on timeout', async () => {
    let capturedError = null;
    const adapter = new ApiAdapter({
      baseUrl: 'https://httpbin.org',
      timeout: 1500,
      onError: (err) => { capturedError = err; }
    });

    const err = await adapter.request('GET', '/delay/5').catch(e => e);

    expect(capturedError).toBe(err);
    expect(capturedError).toBeInstanceOf(ApiNetworkError);
  }, 10000);
});

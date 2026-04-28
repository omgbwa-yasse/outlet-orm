'use strict';

const { ApiGraphQL } = require('../src/Api/GraphQL');
const { MockAdapter } = require('../src/Api/MockAdapter');
const { ApiError } = require('../src/Api/Errors/ApiError');

// ── Setup: create a class with mocked adapter ─────────────────────────────────

function makeGQLClass(mockHandlerSetup) {
  class GQLModel extends ApiGraphQL {
    static get endpoint() { return '/gql-models'; }
  }
  GQLModel.queries = null;
  GQLModel.mutations = null;

  const adapter = new MockAdapter({ baseURL: 'http://localhost' });
  if (mockHandlerSetup) mockHandlerSetup(adapter);
  GQLModel.configure({ adapter, graphqlEndpoint: '/graphql' });
  return { GQLModel, adapter };
}

// ── rawQuery ──────────────────────────────────────────────────────────────────

describe('ApiGraphQL — rawQuery', () => {
  test('sends correct POST body to graphql endpoint', async () => {
    const { GQLModel, adapter } = makeGQLClass();
    const capturedBody = [];
    // Intercept the request to capture the body
    adapter.interceptors.addRequest(config => {
      capturedBody.push(config.options && config.options.body);
      return config;
    });
    adapter.onPost('/graphql').reply(200, { data: { users: [] } });
    await GQLModel.rawQuery('{ users { id } }');
    expect(capturedBody[0]).toMatchObject({ query: '{ users { id } }' });
  });

  test('includes variables in POST body when provided', async () => {
    const { GQLModel, adapter } = makeGQLClass();
    const capturedBody = [];
    adapter.interceptors.addRequest(config => {
      capturedBody.push(config.options && config.options.body);
      return config;
    });
    adapter.onPost('/graphql').reply(200, { data: { user: { id: 1 } } });
    await GQLModel.rawQuery('query GetUser($id: ID!) { user(id: $id) { id } }', { id: 1 });
    expect(capturedBody[0]).toMatchObject({ variables: { id: 1 } });
  });

  test('returns data portion of response', async () => {
    const { GQLModel, adapter } = makeGQLClass();
    adapter.onPost('/graphql').reply(200, { data: { me: { id: 42 } } });
    const result = await GQLModel.rawQuery('{ me { id } }');
    expect(result).toEqual({ me: { id: 42 } });
  });

  test('throws ApiError with graphqlErrors when errors present', async () => {
    const { GQLModel, adapter } = makeGQLClass();
    adapter.onPost('/graphql').reply(200, {
      errors: [{ message: 'Field not found' }]
    });
    await expect(GQLModel.rawQuery('{ bad }')).rejects.toMatchObject({
      graphqlErrors: expect.arrayContaining([{ message: 'Field not found' }])
    });
  });
});

// ── query / mutate ────────────────────────────────────────────────────────────

describe('ApiGraphQL — query / mutate', () => {
  test('query uses named query from static queries', async () => {
    const { GQLModel, adapter } = makeGQLClass();
    const captured = [];
    adapter.interceptors.addRequest(c => { captured.push(c.options.body); return c; });
    adapter.onPost('/graphql').reply(200, { data: { users: [] } });

    GQLModel.queries = { allUsers: '{ users { id name } }' };
    await GQLModel.query('allUsers');
    expect(captured[0].query).toBe('{ users { id name } }');
  });

  test('query falls back to raw string if name not in queries', async () => {
    const { GQLModel, adapter } = makeGQLClass();
    const captured = [];
    adapter.interceptors.addRequest(c => { captured.push(c.options.body); return c; });
    adapter.onPost('/graphql').reply(200, { data: {} });
    await GQLModel.query('{ rawQuery }');
    expect(captured[0].query).toBe('{ rawQuery }');
  });

  test('mutate uses named mutation from static mutations', async () => {
    const { GQLModel, adapter } = makeGQLClass();
    const captured = [];
    adapter.interceptors.addRequest(c => { captured.push(c.options.body); return c; });
    adapter.onPost('/graphql').reply(200, { data: { createUser: { id: 1 } } });

    GQLModel.mutations = { createUser: 'mutation CreateUser($name: String!) { createUser(name: $name) { id } }' };
    await GQLModel.mutate('createUser', { name: 'Alice' });
    expect(captured[0].query).toContain('createUser');
  });
});

// ── fragment ──────────────────────────────────────────────────────────────────

describe('ApiGraphQL — fragment', () => {
  test('builds correct fragment string', () => {
    const frag = ApiGraphQL.fragment('UserFields', 'User', 'id name email');
    expect(frag).toBe('fragment UserFields on User { id name email }');
  });
});

// ── subscribe fallback ────────────────────────────────────────────────────────

describe('ApiGraphQL — subscribe fallback', () => {
  test('emits error with MISSING_PEER_DEP when graphql-ws not installed', () => {
    const { GQLModel } = makeGQLClass();
    const onError = jest.fn();
    GQLModel.subscribe('subscription { events }', {}, { onError });
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'MISSING_PEER_DEP' }));
  });
});

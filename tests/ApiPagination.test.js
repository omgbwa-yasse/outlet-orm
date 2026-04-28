'use strict';

const { ApiQueryBuilder } = require('../src/Api/ApiQueryBuilder');
const { ApiPaginator } = require('../src/Api/ApiPaginator');
const { camelToSnake, snakeToCamel, convertKeys } = require('../src/Api/Serialization/CaseConverter');
const { ApiQueryNotSupportedError } = require('../src/Api/Errors/ApiQueryNotSupportedError');
const { ApiAdapter } = require('../src/Api/ApiAdapter');
const { Api } = require('../src/Api/Api');

// ── Helpers ───────────────────────────────────────────────────────────────
function makeAdapter(responses) {
  const adapter = new ApiAdapter({ baseUrl: 'https://api.test' });
  let callCount = 0;
  adapter.request = jest.fn(async (method, path) => {
    const res = responses[callCount++];
    if (res instanceof Error) throw res;
    return res;
  });
  return adapter;
}

class Post extends Api {}
Post._endpoint = '/posts';

// ── Query string rendering ────────────────────────────────────────────────
describe('ApiQueryBuilder – query string rendering', () => {
  test('simple where=value', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.where('status', 'active');
    expect(qb.toQueryString('default')).toContain('status=active');
  });

  test('orderBy with direction', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.orderBy('created_at', 'desc');
    const qs = qb.toQueryString('default');
    expect(qs).toContain('sort=-created_at');
  });

  test('orderBy asc (default)', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.orderBy('name');
    const qs = qb.toQueryString('default');
    expect(qs).toContain('sort=name');
  });

  test('limit and offset', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.limit(10).offset(20);
    const qs = qb.toQueryString('default');
    expect(qs).toContain('per_page=10');
    expect(qs).toContain('offset=20');
  });

  test('select columns', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.select('id', 'title', 'body');
    const qs = qb.toQueryString('default');
    expect(qs).toContain('fields=id%2Ctitle%2Cbody');
  });

  test('with relations', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.with('comments', 'author');
    const qs = qb.toQueryString('default');
    expect(qs).toContain('include=comments%2Cauthor');
  });

  test('whereIn', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.whereIn('id', [1, 2, 3]);
    const params = qb.toParams();
    expect(params['id']).toEqual([1, 2, 3]);
  });

  test('whereNull', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.whereNull('deleted_at');
    const params = qb.toParams();
    expect(params['deleted_at_null']).toBe(true);
  });

  test('whereNotNull', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.whereNotNull('published_at');
    const params = qb.toParams();
    expect(params['published_at_not_null']).toBe(true);
  });

  test('whereLike', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.whereLike('title', '%hello%');
    const params = qb.toParams();
    expect(params['title_like']).toBe('%hello%');
  });

  test('whereBetween', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.whereBetween('price', [10, 50]);
    const params = qb.toParams();
    expect(params['price_min']).toBe(10);
    expect(params['price_max']).toBe(50);
  });

  test('chained fluent methods', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.where('status', 'active').orderBy('title').limit(5).offset(0);
    const params = qb.toParams();
    expect(params.status).toBe('active');
    expect(params.sort).toBe('title');
    expect(params.per_page).toBe(5);
  });
});

// ── Serialization strategies ──────────────────────────────────────────────
describe('ApiQueryBuilder – serialization strategies', () => {
  test('laravel: filter[field], sort, per_page', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.where('status', 'active').orderBy('title', 'desc').limit(15);
    const qs = qb.toQueryString('laravel');
    expect(qs).toContain('filter%5Bstatus%5D=active');
    expect(qs).toContain('sort=-title');
    expect(qs).toContain('per_page=15');
  });

  test('laravel: include', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.with('comments');
    const qs = qb.toQueryString('laravel');
    expect(qs).toContain('include=comments');
  });

  test('django: field, ordering, limit', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.where('status', 'active').orderBy('title', 'desc').limit(10);
    const qs = qb.toQueryString('django');
    expect(qs).toContain('status=active');
    expect(qs).toContain('ordering=-title');
    expect(qs).toContain('limit=10');
  });

  test('django: whereIn (field__in)', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.whereIn('status', ['active', 'pending']);
    const qs = qb.toQueryString('django');
    expect(qs).toContain('status__in=active%2Cpending');
  });

  test('django: whereLike (field__icontains)', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.whereLike('title', 'hello');
    const qs = qb.toQueryString('django');
    expect(qs).toContain('title__icontains=hello');
  });

  test('odata: $filter, $orderby, $top, $skip', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.where('status', 'active').orderBy('title', 'desc').limit(10).offset(5);
    const qs = qb.toQueryString('odata');
    expect(qs).toContain('%24filter=status+eq+%27active%27');
    expect(qs).toContain('%24orderby=title+desc');
    expect(qs).toContain('%24top=10');
    expect(qs).toContain('%24skip=5');
  });

  test('odata: $select', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.select('id', 'title').limit(5);
    const qs = qb.toQueryString('odata');
    expect(qs).toContain('%24select=id%2Ctitle');
  });

  test('jsonapi: filter[field], page[size], page[number]', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.where('status', 'active').limit(15).offset(15);
    const qs = qb.toQueryString('jsonapi');
    expect(qs).toContain('filter%5Bstatus%5D=active');
    expect(qs).toContain('page%5Bsize%5D=15');
    expect(qs).toContain('page%5Bnumber%5D=2');
  });

  test('custom: calls querySerializer fn', () => {
    class PostCustom extends Api {}
    PostCustom._endpoint = '/posts';
    PostCustom._config = {
      querySerializer: (params) => ({ q: JSON.stringify(params) })
    };
    const qb = new ApiQueryBuilder(PostCustom, null);
    qb.where('status', 'active');
    const params = qb._buildStrategyParams('custom');
    expect(params.q).toContain('status');
  });

  test('custom: throws if no querySerializer', () => {
    const qb = new ApiQueryBuilder(Post, null);
    qb.where('status', 'active');
    expect(() => qb._buildStrategyParams('custom')).toThrow('querySerializer must be a function');
  });
});

// ── Unsupported operations ────────────────────────────────────────────────
describe('ApiQueryBuilder – unsupported operations', () => {
  test('join() throws ApiQueryNotSupportedError', () => {
    const qb = new ApiQueryBuilder(Post, null);
    expect(() => qb.join('users', 'id')).toThrow(ApiQueryNotSupportedError);
  });

  test('groupBy() throws ApiQueryNotSupportedError', () => {
    const qb = new ApiQueryBuilder(Post, null);
    expect(() => qb.groupBy('status')).toThrow(ApiQueryNotSupportedError);
  });

  test('having() throws ApiQueryNotSupportedError', () => {
    const qb = new ApiQueryBuilder(Post, null);
    expect(() => qb.having('count', '>', 5)).toThrow(ApiQueryNotSupportedError);
  });
});

// ── Pagination ────────────────────────────────────────────────────────────
describe('ApiPaginator – page-based', () => {
  const pageResponse = {
    data: [{ id: 1 }, { id: 2 }],
    total: 10,
    per_page: 2,
    current_page: 1,
    last_page: 5,
    from: 1,
    to: 2
  };

  test('normalizes page-based response', () => {
    const pag = new ApiPaginator(pageResponse, {});
    expect(pag.data).toHaveLength(2);
    expect(pag.total).toBe(10);
    expect(pag.perPage).toBe(2);
    expect(pag.currentPage).toBe(1);
    expect(pag.lastPage).toBe(5);
    expect(pag.from).toBe(1);
    expect(pag.to).toBe(2);
  });

  test('hasMorePages() is true when not on last page', () => {
    const pag = new ApiPaginator(pageResponse, {});
    expect(pag.hasMorePages()).toBe(true);
  });

  test('hasMorePages() is false on last page', () => {
    const pag = new ApiPaginator(Object.assign({}, pageResponse, { current_page: 5 }), {});
    expect(pag.hasMorePages()).toBe(false);
  });
});

describe('ApiPaginator – cursor-based', () => {
  const cursorResponse = {
    data: [{ id: 1 }],
    next_cursor: 'abc123',
    prev_cursor: null,
    has_more: true
  };

  test('normalizes cursor-based response', () => {
    const pag = new ApiPaginator(cursorResponse, {});
    expect(pag._type).toBe('cursor');
    expect(pag.nextCursor).toBe('abc123');
    expect(pag.hasMore).toBe(true);
    expect(pag.hasMorePages()).toBe(true);
  });

  test('no more pages when has_more=false', () => {
    const pag = new ApiPaginator({ data: [], next_cursor: null, has_more: false }, {});
    expect(pag.hasMorePages()).toBe(false);
  });
});

describe('ApiPaginator – offset-based', () => {
  const offsetResponse = {
    data: [{ id: 1 }, { id: 2 }],
    total: 10,
    offset: 0,
    limit: 2
  };

  test('normalizes offset-based response', () => {
    const pag = new ApiPaginator(offsetResponse, {});
    expect(pag._type).toBe('offset');
    expect(pag.limit).toBe(2);
    expect(pag.offset).toBe(0);
    expect(pag.total).toBe(10);
    expect(pag.hasMorePages()).toBe(true);
  });
});

describe('ApiPaginator – async iterator', () => {
  test('iterates through all items across pages', async () => {
    const adapter = makeAdapter([
      { data: [{ id: 1 }, { id: 2 }], total: 4, per_page: 2, current_page: 1, last_page: 2 },
      { data: [{ id: 3 }, { id: 4 }], total: 4, per_page: 2, current_page: 2, last_page: 2 }
    ]);
    Post.adapter = adapter;
    Post._endpoint = '/posts';

    const qb = new ApiQueryBuilder(Post, adapter);
    const firstPage = await qb.paginate(1, 2);
    const items = [];
    for await (const item of firstPage) {
      items.push(item);
    }
    expect(items).toHaveLength(4);
    expect(items[0].id).toBe(1);
    expect(items[3].id).toBe(4);
  });
});

// ── Case conversion ───────────────────────────────────────────────────────
describe('CaseConverter', () => {
  test('camelToSnake converts camelCase', () => {
    expect(camelToSnake('firstName')).toBe('first_name');
    expect(camelToSnake('myVariableName')).toBe('my_variable_name');
    expect(camelToSnake('simpleWord')).toBe('simple_word');
  });

  test('camelToSnake handles already snake_case', () => {
    expect(camelToSnake('first_name')).toBe('first_name');
  });

  test('snakeToCamel converts snake_case', () => {
    expect(snakeToCamel('first_name')).toBe('firstName');
    expect(snakeToCamel('my_variable_name')).toBe('myVariableName');
  });

  test('snakeToCamel handles already camelCase', () => {
    expect(snakeToCamel('firstName')).toBe('firstName');
  });

  test('convertKeys deep-converts object keys', () => {
    const obj = { first_name: 'Alice', address: { zip_code: '12345' } };
    const result = convertKeys(obj, snakeToCamel);
    expect(result.firstName).toBe('Alice');
    expect(result.address.zipCode).toBe('12345');
  });

  test('convertKeys handles arrays', () => {
    const arr = [{ first_name: 'Alice' }, { first_name: 'Bob' }];
    const result = convertKeys(arr, snakeToCamel);
    expect(result[0].firstName).toBe('Alice');
    expect(result[1].firstName).toBe('Bob');
  });

  test('convertKeys does not recurse into Dates', () => {
    const date = new Date();
    const obj = { created_at: date };
    const result = convertKeys(obj, snakeToCamel);
    expect(result.createdAt).toBe(date);
  });
});

// ── QB static proxies on Api class ────────────────────────────────────────
describe('Api static QB proxies', () => {
  let adapter;
  beforeEach(() => {
    adapter = makeAdapter([[]]);
    Post.adapter = adapter;
    Post._endpoint = '/posts';
  });

  test('Api.query() returns ApiQueryBuilder', () => {
    const qb = Post.query();
    expect(qb).toBeInstanceOf(ApiQueryBuilder);
  });

  test('Api.where() returns ApiQueryBuilder', () => {
    const qb = Post.where('status', 'active');
    expect(qb).toBeInstanceOf(ApiQueryBuilder);
    expect(qb._wheres).toHaveLength(1);
  });

  test('Api.orderBy() returns ApiQueryBuilder', () => {
    const qb = Post.orderBy('title', 'asc');
    expect(qb).toBeInstanceOf(ApiQueryBuilder);
  });

  test('Api.limit() returns ApiQueryBuilder', () => {
    const qb = Post.limit(10);
    expect(qb).toBeInstanceOf(ApiQueryBuilder);
    expect(qb._limitVal).toBe(10);
  });

  test('Api.withRelations() returns ApiQueryBuilder', () => {
    const qb = Post.withRelations('comments', 'author');
    expect(qb).toBeInstanceOf(ApiQueryBuilder);
    expect(qb._withs).toContain('comments');
  });
});

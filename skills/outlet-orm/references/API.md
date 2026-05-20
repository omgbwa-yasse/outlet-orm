# API Layer Reference

## Contents

- When to read this document
- Scope
- Api
- ApiAdapter
- ApiQueryBuilder
- ApiPaginator
- Validation and errors
- Cache, offline, realtime
- Interceptors and MockAdapter
- ApiGraphQL
- Spec import and diff
- Recommendations
- Source files to read

## When to read this document

Read this resource if the request is about `Api`, `ApiAdapter`, `ApiGraphQL`, `MockAdapter`, HTTP validation, API caching, the offline queue, realtime features, `outlet api import`, or `outlet api diff`.

Do not use it as the main entry point for:

- the SQL ORM built on `Model`: see `MODELS.md`
- SQL queries via `QueryBuilder`: see `QUERIES.md`
- the general AI and MCP layer: see `AI.md`

## Scope

This document covers the HTTP layer exposed by `src/Api/`.

Main exports:

- `Api`
- `ApiModel`
- `ApiAdapter`
- `createAdapter()`
- `ApiGraphQL`
- `MockAdapter`
- `InterceptorManager`
- `ApiCache`
- `ApiValidator`
- `ApiPaginator`
- `ApiQueryBuilder`
- offline stores / queue
- realtime helpers
- typed errors
- API spec import / diff

## Api

`Api` follows a syntax close to `Model`, but over HTTP.

Static methods:

- `find(id)`
- `findOrFail(id)`
- `all(params?)`
- `get(params?)`
- `create(data)`
- `query()`
- query-builder proxies for some read operations

Instance methods:

- `save()`
- `destroy()`
- model-like attribute access

Adapter resolution:

- `usingAdapter(adapter)`
- `static adapter`
- `Api.setDefaultAdapter(adapter)`
- `Api.getDefaultAdapter()`

## ApiAdapter

Responsibilities:

- HTTP transport via `fetch`
- timeout via `AbortController`
- auth
- request logs
- interceptors
- retry
- circuit breaker
- upload with progress
- cache hooks

Supported auth:

- bearer
- basic
- apiKey
- cookie
- oauth2
- `dynamicHeaders`

Debug:

- `toRequest(method, path, options)`
- `enableRequestLog()`
- `getRequestLog()`
- `flushRequestLog()`

## ApiQueryBuilder

Composition methods:

- `where()`
- `orWhere()`
- `whereIn()`
- `whereNull()`
- `orderBy()`
- `limit()`
- `offset()`
- `with()`
- `select()`

Terminal methods:

- `get()`
- `first()`
- `find(id)`
- `count()`
- `paginate(perPage, page)`

## ApiPaginator

Capabilities:

- page-based support
- cursor-based support
- offset-based support
- async iteration through `for await`
- navigation with `nextPage()`, `prevPage()`, `goToPage()`

## Validation and errors

Validation:

- `ApiValidator`
- `validateOrFail()`
- `Api.strictResponse`

Typed errors:

- `ApiError`
- `ApiNetworkError`
- `ApiResponseError`
- `ApiNotFoundError`
- `ApiValidationError`
- `ApiUnauthorizedError`
- `ApiForbiddenError`
- `ApiServerError`
- `ApiRateLimitError`
- `ApiQueryNotSupportedError`

## Cache, offline, realtime

Cache:

- `ApiCache`
- memory/localStorage/sessionStorage stores
- cache-first, network-first, stale-while-revalidate, cache-only, network-only strategies

Offline:

- `StorageAdapter`
- `MemoryStore`
- `LocalStorageStore`
- `SessionStorageStore`
- `MutationQueue`

Realtime:

- `Watcher`
- `EventStream`
- `WebSocketConnection`

## Interceptors and MockAdapter

Interceptors:

- `adapter.interceptors.request`
- `adapter.interceptors.response`
- `use(fulfilled, rejected)`
- `eject(id)`
- `clear()`

Mock adapter:

- `onGet`, `onPost`, `onPut`, `onPatch`, `onDelete`
- `replyOnce`
- `networkError`
- `timeout`
- `reset`

Use case: unit tests without a real network.

## ApiGraphQL

Capabilities:

- `query(gql, vars)`
- `mutate(gql, vars)`
- `subscribe(gql, vars)`

`subscribe` relies on `graphql-ws` when available, otherwise it falls back according to the implementation.

## Spec import and diff

Related CLI:

- `outlet api import`
- `outlet api diff`

Import:

- OpenAPI / Swagger
- Postman
- GraphQL introspection
- RAML
- API Blueprint
- reference documentation through `--doc`

Diff:

- compares expected endpoints and existing models
- verifies `fillable` fields
- exits with code `1` on divergence

## Recommendations

- use `MockAdapter` for unit tests, not real network calls
- use `toRequest()` to debug headers and params without sending the request
- enable `strictResponse` if you want strict contract-first reads
- reserve the offline layer for applications with an explicit mutation-queue requirement

## Source files to read

- `src/Api/index.js`
- `src/Api/Api.js`
- `src/Api/ApiAdapter.js`
- `src/Api/ApiQueryBuilder.js`
- `src/Api/GraphQL.js`
- `src/Api/Import/*`
- `bin/api/import.js`
- `bin/api/diff.js`
- `tests/Api*.test.js`

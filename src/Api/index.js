'use strict';

const { Api, ApiModel } = require('./Api');
const { ApiAdapter, createAdapter } = require('./ApiAdapter');
const { ApiGraphQL } = require('./GraphQL');
const { MockAdapter } = require('./MockAdapter');
const { InterceptorManager } = require('./Interceptors/InterceptorManager');
const { ApiCache, MemoryStore: CacheMemoryStore, LocalStorageStore: CacheLocalStorageStore, SessionStorageStore: CacheSessionStorageStore } = require('./ApiCache');
const { ApiValidator } = require('./Validation/ApiValidator');
const { ApiPaginator } = require('./ApiPaginator');
const { ApiQueryBuilder } = require('./ApiQueryBuilder');
// Offline
const { StorageAdapter } = require('./Offline/StorageAdapter');
const { MemoryStore } = require('./Offline/MemoryStore');
const { LocalStorageStore } = require('./Offline/LocalStorageStore');
const { SessionStorageStore } = require('./Offline/SessionStorageStore');
const { MutationQueue } = require('./Offline/MutationQueue');
// Realtime
const { Watcher } = require('./Realtime/Watcher');
const { EventStream } = require('./Realtime/EventStream');
const { WebSocketConnection } = require('./Realtime/WebSocketConnection');
// Errors
const { ApiError } = require('./Errors/ApiError');
const { ApiNetworkError } = require('./Errors/ApiNetworkError');
const { ApiResponseError } = require('./Errors/ApiResponseError');
const { ApiNotFoundError } = require('./Errors/ApiNotFoundError');
const { ApiValidationError } = require('./Errors/ApiValidationError');
const { ApiUnauthorizedError } = require('./Errors/ApiUnauthorizedError');
const { ApiForbiddenError } = require('./Errors/ApiForbiddenError');
const { ApiServerError } = require('./Errors/ApiServerError');
const { ApiRateLimitError } = require('./Errors/ApiRateLimitError');
const { ApiQueryNotSupportedError } = require('./Errors/ApiQueryNotSupportedError');

module.exports = {
  // Core
  Api,
  ApiModel,
  ApiAdapter,
  createAdapter,
  ApiGraphQL,
  MockAdapter,
  InterceptorManager,
  // Cache
  ApiCache,
  CacheMemoryStore,
  CacheLocalStorageStore,
  CacheSessionStorageStore,
  // Validation & Query
  ApiValidator,
  ApiPaginator,
  ApiQueryBuilder,
  // Offline
  StorageAdapter,
  MemoryStore,
  LocalStorageStore,
  SessionStorageStore,
  MutationQueue,
  // Realtime
  Watcher,
  EventStream,
  WebSocketConnection,
  // Errors
  ApiError,
  ApiNetworkError,
  ApiResponseError,
  ApiNotFoundError,
  ApiValidationError,
  ApiUnauthorizedError,
  ApiForbiddenError,
  ApiServerError,
  ApiRateLimitError,
  ApiQueryNotSupportedError
};

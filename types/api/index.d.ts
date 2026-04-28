// Type definitions for outlet-orm API Layer (v13.0.0)

// ── Error classes ──────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(message?: string);
  name: string;
}

export class ApiNetworkError extends ApiError {
  constructor(message?: string, cause?: Error);
  cause: Error | null;
}

export class ApiResponseError extends ApiError {
  constructor(message?: string, statusCode?: number);
  statusCode: number;
}

export class ApiNotFoundError extends ApiResponseError {
  constructor(message?: string);
}

export class ApiValidationError extends ApiResponseError {
  constructor(message?: string, options?: { statusCode?: number; errors?: Record<string, string | string[]>; source?: 'client' | 'server' });
  errors: Record<string, string | string[]>;
  source: 'client' | 'server';
}

export class ApiUnauthorizedError extends ApiResponseError {
  constructor(message?: string);
}

export class ApiForbiddenError extends ApiResponseError {
  constructor(message?: string);
}

export class ApiServerError extends ApiResponseError {
  constructor(message?: string, statusCode?: number);
}

export class ApiRateLimitError extends ApiResponseError {
  constructor(message?: string, retryAfterHeader?: string | null);
  retryAfter: number | null;
}

export class ApiQueryNotSupportedError extends ApiError {
  constructor(operation?: string);
  operation: string | null;
}

// ── Config interfaces ──────────────────────────────────────────────────

export interface AuthConfig {
  type?: 'bearer' | 'basic' | 'apiKey' | 'oauth2' | 'custom';
  token?: string;
  username?: string;
  password?: string;
  apiKey?: string;
  apiKeyHeader?: string;
  accessToken?: string;
  refreshToken?: string;
  refreshUrl?: string;
  onRefresh?: (newToken: string) => void;
  customHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
}

export interface RetryConfig {
  retries?: number;
  retryCodes?: number[];
  retryDelay?: number;
}

export interface CircuitBreakerConfig {
  enabled?: boolean;
  threshold?: number;
  timeout?: number;
}

export interface CacheConfig {
  enabled?: boolean;
  ttl?: number;
  store?: 'memory' | 'localStorage' | 'sessionStorage';
}

export interface SecurityConfig {
  redactHeaders?: string[];
  redactFields?: string[];
  strictResponse?: boolean;
}

export interface SerializationConfig {
  requestTransformer?: (data: unknown) => unknown;
  responseTransformer?: (data: unknown) => unknown;
}

export interface PaginationConfig {
  type?: 'page' | 'cursor' | 'offset';
  pageParam?: string;
  perPageParam?: string;
  cursorParam?: string;
}

export interface ApiAdapterConfig {
  baseUrl: string;
  timeout?: number;
  headers?: Record<string, string>;
  auth?: AuthConfig;
  retry?: RetryConfig;
  circuitBreaker?: CircuitBreakerConfig;
  cache?: CacheConfig;
  security?: SecurityConfig;
  pagination?: PaginationConfig;
  serialization?: SerializationConfig;
  onError?: (error: ApiError) => void;
  redactHeaders?: string[];
}

// ── Request log entry ──────────────────────────────────────────────────

export interface RequestLogEntry {
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, unknown> | null;
  timestamp: string;
}

// ── ApiAdapter ────────────────────────────────────────────────────────

export class ApiAdapter {
  constructor(config: ApiAdapterConfig);
  request(method: string, path: string, options?: {
    params?: Record<string, unknown>;
    data?: unknown;
    headers?: Record<string, string>;
  }): Promise<unknown>;
  toRequest(method: string, path: string, options?: {
    params?: Record<string, unknown>;
    data?: unknown;
    headers?: Record<string, string>;
  }): { method: string; url: string; params: Record<string, unknown> | null; headers: Record<string, string> };
  enableRequestLog(): void;
  getRequestLog(): RequestLogEntry[];
  flushRequestLog(): void;
  dd(method: string, path: string, options?: Record<string, unknown>): void;
}

export function createAdapter(config: ApiAdapterConfig): ApiAdapter;

// ── Interceptors ─────────────────────────────────────────────────────

export interface InterceptorHandler<T = unknown> {
  fulfilled?: (value: T) => T | Promise<T>;
  rejected?: (error: unknown) => unknown;
}

export class InterceptorManager<T = unknown> {
  use(fulfilled?: (value: T) => T | Promise<T>, rejected?: (error: unknown) => unknown): number;
  eject(id: number): void;
  clear(): void;
}

// ── Mock adapter ─────────────────────────────────────────────────────

export interface MockHandler {
  method: string;
  path: string | RegExp;
  response: unknown | ((req: { method: string; path: string; options: unknown }) => unknown);
  status?: number;
  delay?: number;
}

export class MockAdapter extends ApiAdapter {
  constructor(handlers?: MockHandler[]);
  onGet(path: string | RegExp, response: unknown, options?: { status?: number; delay?: number }): this;
  onPost(path: string | RegExp, response: unknown, options?: { status?: number; delay?: number }): this;
  onPut(path: string | RegExp, response: unknown, options?: { status?: number; delay?: number }): this;
  onPatch(path: string | RegExp, response: unknown, options?: { status?: number; delay?: number }): this;
  onDelete(path: string | RegExp, response: unknown, options?: { status?: number; delay?: number }): this;
  reset(): void;
}

// ── Cache ─────────────────────────────────────────────────────────────

export interface CacheStore {
  get(key: string): unknown | null;
  set(key: string, value: unknown, ttl?: number): void;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
}

export class CacheMemoryStore implements CacheStore {
  get(key: string): unknown | null;
  set(key: string, value: unknown, ttl?: number): void;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
}

export class CacheLocalStorageStore implements CacheStore {
  constructor(prefix?: string);
  get(key: string): unknown | null;
  set(key: string, value: unknown, ttl?: number): void;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
}

export class CacheSessionStorageStore implements CacheStore {
  constructor(prefix?: string);
  get(key: string): unknown | null;
  set(key: string, value: unknown, ttl?: number): void;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
}

export class ApiCache {
  constructor(store?: CacheStore, defaultTtl?: number);
  remember(key: string, ttl: number, fn: () => Promise<unknown>): Promise<unknown>;
  forget(key: string): void;
  flush(): void;
}

// ── Validation ────────────────────────────────────────────────────────

export interface ValidationRule {
  required?: boolean;
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string | RegExp;
  enum?: unknown[];
  custom?: (value: unknown) => boolean | string;
}

export class ApiValidator {
  constructor(rules: Record<string, ValidationRule | ValidationRule[]>);
  validate(data: Record<string, unknown>): { valid: boolean; errors: Record<string, string[]> };
  validateOrFail(data: Record<string, unknown>): void;
}

// ── Pagination ────────────────────────────────────────────────────────

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number;
  to?: number;
}

export class ApiPaginator<T = unknown> {
  constructor(data: unknown[], meta: PaginationMeta, fetchPage: (page: number) => Promise<unknown>);
  readonly data: T[];
  readonly meta: PaginationMeta;
  readonly currentPage: number;
  readonly lastPage: number;
  readonly total: number;
  hasNextPage(): boolean;
  hasPrevPage(): boolean;
  nextPage(): Promise<ApiPaginator<T>>;
  prevPage(): Promise<ApiPaginator<T>>;
  goToPage(page: number): Promise<ApiPaginator<T>>;
  [Symbol.asyncIterator](): AsyncIterator<T[]>;
}

// ── Query builder ─────────────────────────────────────────────────────

export class ApiQueryBuilder<T = unknown> {
  where(field: string, operator: string, value?: unknown): this;
  orWhere(field: string, operator: string, value?: unknown): this;
  whereIn(field: string, values: unknown[]): this;
  whereNull(field: string): this;
  whereNotNull(field: string): this;
  orderBy(field: string, direction?: 'asc' | 'desc'): this;
  limit(n: number): this;
  offset(n: number): this;
  with(...relations: string[]): this;
  select(...fields: string[]): this;
  paginate(perPage?: number, page?: number): Promise<ApiPaginator<T>>;
  get(): Promise<T[]>;
  first(): Promise<T | null>;
  find(id: number | string): Promise<T | null>;
  count(): Promise<number>;
  toParams(): Record<string, unknown>;
}

// ── Relation helpers ──────────────────────────────────────────────────

export interface HasManyRelation<T> {
  get(): Promise<T[]>;
  create(data: Partial<T>): Promise<T>;
  first(): Promise<T | null>;
}

export interface HasOneRelation<T> {
  get(): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
}

export interface BelongsToRelation<T> {
  get(): Promise<T | null>;
}

// ── Api model ─────────────────────────────────────────────────────────

export interface ApiConfig {
  adapter: ApiAdapter;
  baseUrl?: string;
  auth?: AuthConfig;
  cache?: CacheConfig;
  retry?: RetryConfig;
  timeout?: number;
  headers?: Record<string, string>;
}

export class Api<T extends Record<string, unknown> = Record<string, unknown>> {
  // Static configuration
  static endpoint: string;
  static primaryKey: string;
  static fillable: string[];
  static hidden: string[];
  static casts: Record<string, string>;
  static responseSchema: string[] | null;
  static strictResponse: boolean;
  static timestamps: boolean;

  static configure(config: ApiConfig): void;
  static adapter(): ApiAdapter;

  // Static CRUD
  static find<M extends typeof Api>(this: M, id: number | string): Promise<InstanceType<M>>;
  static all<M extends typeof Api>(this: M): Promise<InstanceType<M>[]>;
  static create<M extends typeof Api>(this: M, data: Record<string, unknown>): Promise<InstanceType<M>>;
  static update<M extends typeof Api>(this: M, id: number | string, data: Record<string, unknown>): Promise<InstanceType<M>>;
  static destroy<M extends typeof Api>(this: M, id: number | string): Promise<void>;

  // Static query
  static query<M extends typeof Api>(this: M): ApiQueryBuilder<InstanceType<M>>;
  static where<M extends typeof Api>(this: M, field: string, operator: string, value?: unknown): ApiQueryBuilder<InstanceType<M>>;
  static with<M extends typeof Api>(this: M, ...relations: string[]): ApiQueryBuilder<InstanceType<M>>;
  static paginate<M extends typeof Api>(this: M, perPage?: number, page?: number): Promise<ApiPaginator<InstanceType<M>>>;

  // Instance
  constructor(attributes?: Partial<T>);
  get(key: keyof T): unknown;
  set(key: keyof T, value: unknown): this;
  fill(data: Partial<T>): this;
  getAttribute(key: string): unknown;
  setAttribute(key: string, value: unknown): void;
  toJSON(): Record<string, unknown>;
  toObject(): Record<string, unknown>;
  isDirty(key?: string): boolean;
  getOriginal(key?: string): unknown;
  save(): Promise<this>;
  delete(): Promise<void>;

  // Lifecycle events (EventEmitter-style on the class)
  static on(event: string, listener: (...args: unknown[]) => void): void;
  static off(event: string, listener: (...args: unknown[]) => void): void;
  static removeAllListeners(event?: string): void;
}

/** Alias — ApiModel is the same as Api */
export class ApiModel<T extends Record<string, unknown> = Record<string, unknown>> extends Api<T> {}

// ── GraphQL ───────────────────────────────────────────────────────────

export class ApiGraphQL<T extends Record<string, unknown> = Record<string, unknown>> extends Api<T> {
  static query<M extends typeof ApiGraphQL>(this: M, gql: string, variables?: Record<string, unknown>): Promise<unknown>;
  static mutate<M extends typeof ApiGraphQL>(this: M, gql: string, variables?: Record<string, unknown>): Promise<unknown>;
  static subscribe<M extends typeof ApiGraphQL>(this: M, gql: string, variables?: Record<string, unknown>): AsyncGenerator<unknown>;
}

// ── Offline / Storage ─────────────────────────────────────────────────

export class StorageAdapter {
  constructor(store: CacheStore);
  get<V = unknown>(key: string): Promise<V | null>;
  set(key: string, value: unknown, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

export class MemoryStore implements CacheStore {
  get(key: string): unknown | null;
  set(key: string, value: unknown, ttl?: number): void;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
}

export class LocalStorageStore implements CacheStore {
  constructor(prefix?: string);
  get(key: string): unknown | null;
  set(key: string, value: unknown, ttl?: number): void;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
}

export class SessionStorageStore implements CacheStore {
  constructor(prefix?: string);
  get(key: string): unknown | null;
  set(key: string, value: unknown, ttl?: number): void;
  delete(key: string): void;
  clear(): void;
  has(key: string): boolean;
}

export interface QueuedMutation {
  id: string;
  method: string;
  endpoint: string;
  data: unknown;
  timestamp: number;
  attempts: number;
}

export class MutationQueue {
  constructor(store?: StorageAdapter);
  enqueue(method: string, endpoint: string, data: unknown): Promise<QueuedMutation>;
  dequeue(): Promise<QueuedMutation | null>;
  peek(): Promise<QueuedMutation | null>;
  size(): Promise<number>;
  clear(): Promise<void>;
  replay(adapter: ApiAdapter): Promise<{ success: number; failed: number }>;
}

// ── Realtime ──────────────────────────────────────────────────────────

export class Watcher {
  constructor(adapter: ApiAdapter, options?: { interval?: number; compare?: (a: unknown, b: unknown) => boolean });
  watch(endpoint: string, callback: (data: unknown) => void): () => void;
  stop(): void;
}

export class EventStream {
  constructor(url: string, options?: { headers?: Record<string, string>; withCredentials?: boolean });
  on(event: string, callback: (data: unknown) => void): this;
  off(event: string, callback: (data: unknown) => void): this;
  connect(): void;
  disconnect(): void;
  readonly readyState: number;
}

export class WebSocketConnection {
  constructor(url: string, options?: { protocols?: string | string[]; reconnect?: boolean; reconnectDelay?: number });
  send(data: unknown): void;
  on(event: string, callback: (data: unknown) => void): this;
  off(event: string, callback: (data: unknown) => void): this;
  connect(): Promise<void>;
  disconnect(): void;
  readonly readyState: number;
}

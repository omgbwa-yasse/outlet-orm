// Type definitions for outlet-orm

declare module 'outlet-orm' {

  // ==================== Type Utilities ====================

  /** Event names for Model lifecycle hooks */
  export type ModelEventName =
    | 'creating' | 'created'
    | 'updating' | 'updated'
    | 'saving' | 'saved'
    | 'deleting' | 'deleted'
    | 'restoring' | 'restored';

  /** SQL WHERE operators */
  export type WhereOperator =
    | '=' | '!=' | '<>'
    | '>' | '>=' | '<' | '<='
    | 'LIKE' | 'NOT LIKE' | 'like' | 'not like'
    | 'IN' | 'NOT IN' | 'in' | 'not in'
    | 'BETWEEN' | 'NOT BETWEEN'
    | 'IS NULL' | 'IS NOT NULL';

  /** Base attributes every model has */
  export interface BaseModelAttributes {
    id?: number | string;
    created_at?: Date | string;
    updated_at?: Date | string;
    deleted_at?: Date | string | null;
  }

  /** Insert operation result */
  export interface InsertResult {
    insertId: number | string;
    affectedRows: number;
  }

  /** Update operation result */
  export interface UpdateResult {
    affectedRows: number;
    changedRows?: number;
  }

  /** Delete operation result */
  export interface DeleteResult {
    affectedRows: number;
  }

  // ==================== Database Connection ====================

  export interface DatabaseConfig {
    driver: 'mysql' | 'postgres' | 'postgresql' | 'sqlite';
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    connectionLimit?: number;
  }

  export interface QueryLogEntry {
    sql: string;
    params: any[];
    duration: number;
    timestamp: Date;
  }

  export class DatabaseConnection {
    constructor(config?: Partial<DatabaseConfig>);
    connect(): Promise<void>;

    // Transaction support
    beginTransaction(): Promise<void>;
    commit(): Promise<void>;
    rollback(): Promise<void>;
    transaction<T>(callback: (connection: DatabaseConnection) => Promise<T>): Promise<T>;

    // Query logging
    static enableQueryLog(): void;
    static disableQueryLog(): void;
    static getQueryLog(): QueryLogEntry[];
    static flushQueryLog(): void;
    static isLogging(): boolean;

    select(table: string, query: QueryObject): Promise<any[]>;
    insert(table: string, data: Record<string, any>): Promise<InsertResult>;
    insertMany(table: string, data: Record<string, any>[]): Promise<{ affectedRows: number }>;
    update(table: string, data: Record<string, any>, query: QueryObject): Promise<UpdateResult>;
    delete(table: string, query: QueryObject): Promise<DeleteResult>;
    count(table: string, query: QueryObject): Promise<number>;
    /** Execute an aggregate function (SUM, AVG, MIN, MAX) */
    aggregate(table: string, fn: 'SUM' | 'AVG' | 'MIN' | 'MAX', column: string, query: QueryObject): Promise<number>;
    executeRawQuery(sql: string, params?: any[]): Promise<any[]>;
    /** Execute raw SQL and return driver-native results (used by migrations) */
    execute(sql: string, params?: any[]): Promise<any>;
    /** Atomically increment a column respecting query wheres */
    increment(table: string, column: string, query: QueryObject, amount?: number): Promise<UpdateResult>;
    /** Atomically decrement a column respecting query wheres */
    decrement(table: string, column: string, query: QueryObject, amount?: number): Promise<UpdateResult>;
    close(): Promise<void>;
    /** Backwards-compatible alias used by CLI */
    disconnect(): Promise<void>;
  }

  // ==================== Query Builder ====================

  export interface QueryObject {
    columns?: string[];
    wheres?: WhereClause[];
    orders?: OrderClause[];
    joins?: JoinClause[];
    distinct?: boolean;
    groupBys?: string[];
    havings?: HavingClause[];
    limit?: number | null;
    offset?: number | null;
  }

  export interface WhereClause {
    column?: string;
    operator?: WhereOperator | string;
    value?: any;
    values?: any[];
    type: 'basic' | 'in' | 'notIn' | 'null' | 'notNull' | 'between' | 'like';
    boolean: 'and' | 'or';
  }

  export interface OrderClause {
    column: string;
    direction: 'asc' | 'desc';
  }

  export interface HavingClause {
    type: 'basic' | 'count';
    column: string;
    operator: string;
    value: any;
  }

  export interface JoinClause {
    table: string;
    first: string;
    operator: string;
    second: string;
    type: 'inner' | 'left';
  }

  export interface PaginationResult<T> {
    data: T[];
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
    from: number | null;
    to: number;
  }

  /** Observer interface for model lifecycle events */
  export interface ModelObserver<T extends Model = Model> {
    creating?(model: T): boolean | void | Promise<boolean | void>;
    created?(model: T): void | Promise<void>;
    updating?(model: T): boolean | void | Promise<boolean | void>;
    updated?(model: T): void | Promise<void>;
    saving?(model: T): boolean | void | Promise<boolean | void>;
    saved?(model: T): void | Promise<void>;
    deleting?(model: T): boolean | void | Promise<boolean | void>;
    deleted?(model: T): void | Promise<void>;
    restoring?(model: T): boolean | void | Promise<boolean | void>;
    restored?(model: T): void | Promise<void>;
  }

  export class QueryBuilder<T extends Model> {
    constructor(model: typeof Model);

    select(...columns: string[]): this;
    /** Convenience alias to pass an array of columns */
    columns(cols: string[]): this;
    distinct(): this;
    where(column: string, value: any): this;
    where(column: string, operator: string, value: any): this;
    whereIn(column: string, values: any[]): this;
    whereNotIn(column: string, values: any[]): this;
    whereNull(column: string): this;
    whereNotNull(column: string): this;
    orWhere(column: string, value: any): this;
    orWhere(column: string, operator: string, value: any): this;
    whereBetween(column: string, values: [any, any]): this;
    whereLike(column: string, value: string): this;
    /** Filter parents where a relation has matches */
    whereHas(relationName: string, callback?: (qb: QueryBuilder<any>) => void): this;
    /** Filter parents where relation count matches */
    has(relationName: string, count: number): this;
    has(relationName: string, operator: string, count: number): this;
    /** Filter parents without related rows */
    whereDoesntHave(relationName: string): this;
    orderBy(column: string, direction?: 'asc' | 'desc'): this;
    /** Typo-friendly alias for orderBy */
    ordrer(column: string, direction?: 'asc' | 'desc'): this;
    limit(value: number): this;
    offset(value: number): this;
    skip(value: number): this;
    take(value: number): this;
    with(...relations: string[] | [Record<string, (qb: QueryBuilder<any>) => void> | string[]]): this;
    withCount(relations: string | string[]): this;
    groupBy(...columns: string[]): this;
    having(column: string, operator: string, value: any): this;
    join(table: string, first: string, second: string): this;
    join(table: string, first: string, operator: string, second: string): this;
    leftJoin(table: string, first: string, second: string): this;
    leftJoin(table: string, first: string, operator: string, second: string): this;

    // Soft delete methods
    withTrashed(): this;
    onlyTrashed(): this;

    // Scope methods
    withoutGlobalScope(name: string): this;
    withoutGlobalScopes(): this;

    get(): Promise<T[]>;
    first(): Promise<T | null>;
    firstOrFail(): Promise<T>;
    /** Get the first record matching current wheres or create a new one */
    firstOrCreate(values?: Record<string, any>): Promise<T>;
    /** Get the first record matching current wheres or return a new unsaved instance */
    firstOrNew(values?: Record<string, any>): Promise<T>;
    /** Find a record matching current wheres and update it, or create a new one */
    updateOrCreate(values?: Record<string, any>): Promise<T>;
    paginate(page?: number, perPage?: number): Promise<PaginationResult<T>>;
    count(): Promise<number>;
    exists(): Promise<boolean>;
    insert(data: Record<string, any> | Record<string, any>[]): Promise<any>;
    update(attributes: Record<string, any>): Promise<any>;
    /** Update and return first matching row as model, optionally eager-loading relations */
    updateAndFetch(attributes: Record<string, any>, relations?: string[]): Promise<T | null>;
    delete(): Promise<any>;
    increment(column: string, amount?: number): Promise<any>;
    decrement(column: string, amount?: number): Promise<any>;
    /** Lazily iterate over matching records using an async generator */
    cursor(chunkSize?: number): AsyncGenerator<T, void, unknown>;

    // Convenience query methods
    /** Get an array of values for a single column, optionally keyed by another column */
    pluck(column: string): Promise<any[]>;
    pluck(column: string, keyColumn: string): Promise<Record<string, any>>;
    /** Get the value of a single column from the first matching row */
    value(column: string): Promise<any>;

    // Aggregate methods
    /** Get the sum of a column */
    sum(column: string): Promise<number>;
    /** Get the average of a column */
    avg(column: string): Promise<number>;
    /** Get the minimum value of a column */
    min(column: string): Promise<number>;
    /** Get the maximum value of a column */
    max(column: string): Promise<number>;

    // Batch & conditional methods
    /** Process results in chunks */
    chunk(size: number, callback: (chunk: T[], page: number) => void | false | Promise<void | false>): Promise<void>;
    /** Conditionally apply a callback to the query */
    when(condition: any, callback: (qb: this, value: any) => void, fallback?: (qb: this, value: any) => void): this;
    /** Pass the query builder to a callback without modifying the chain */
    tap(callback: (qb: this) => void): this;

    // Debugging
    /** Get the SQL representation of the current query */
    toSQL(): { table: string } & QueryObject;
    /** Dump the SQL and throw */
    dd(): never;

    clone(): QueryBuilder<T>;
  }

  // ==================== Model ====================

  export type CastType = 'int' | 'integer' | 'float' | 'double' | 'string' | 'bool' | 'boolean' | 'array' | 'json' | 'date' | 'datetime' | 'timestamp';

  /** Individual validation rule types */
  export type ValidationRule =
    | 'required'
    | 'string'
    | 'number'
    | 'numeric'
    | 'integer'
    | 'email'
    | 'url'
    | 'boolean'
    | 'date'
    | 'array'
    | 'object'
    | 'nullable'
    | `min:${number}`
    | `max:${number}`
    | `between:${number},${number}`
    | `in:${string}`
    | `not_in:${string}`
    | `regex:${string}`
    | `size:${number}`
    | `digits:${number}`
    | `digits_between:${number},${number}`;

  /** Validation rule as pipe-separated string */
  export type ValidationRuleString = string;

  export interface ValidationResult {
    valid: boolean;
    errors: Record<string, string[]>;
  }

  export type EventCallback<T extends Model = Model> = (model: T) => boolean | void | Promise<boolean | void>;

  /**
   * Base Model class with optional generic for typed attributes.
   * Instances are wrapped in a Proxy so attributes can be accessed
   * directly as properties: `user.name` / `user.name = 'Jean'`.
   * Existing methods (getAttribute, setAttribute) remain available.
   * @template TAttributes - Type of model attributes (defaults to Record<string, any>)
   */
  export class Model<TAttributes extends Record<string, any> = Record<string, any>> {
    /** Property-style attribute access via Proxy (read & write) */
    [K: string]: any;
    static table: string;
    static primaryKey: string;
    static timestamps: boolean;
    static fillable: string[];
    static hidden: string[];
    static casts: Record<string, CastType>;
    static connection: DatabaseConnection | null;
    /** Computed attributes to append in serialization */
    static appends: string[];

    // Soft Deletes
    static softDeletes: boolean;
    static DELETED_AT: string;

    // Scopes
    static globalScopes: Record<string, (qb: QueryBuilder<any>) => void>;

    // Events
    static eventListeners: Record<ModelEventName, EventCallback[]>;

    // Validation
    static rules: Record<string, ValidationRuleString | ValidationRule[]>;

    /** Model attributes with optional typing */
    attributes: TAttributes;
    /** Original attributes before modifications */
    original: TAttributes;
    /** Loaded relations */
    relations: Record<string, any>;
    /** Whether the model exists in database */
    exists: boolean;

    constructor(attributes?: Partial<TAttributes>);

    // Event registration with typed event names
    static on(event: ModelEventName, callback: EventCallback): void;
    static fireEvent(event: ModelEventName, model: Model): Promise<boolean>;
    static creating(callback: EventCallback): void;
    static created(callback: EventCallback): void;
    static updating(callback: EventCallback): void;
    static updated(callback: EventCallback): void;
    static saving(callback: EventCallback): void;
    static saved(callback: EventCallback): void;
    static deleting(callback: EventCallback): void;
    static deleted(callback: EventCallback): void;
    static restoring(callback: EventCallback): void;
    static restored(callback: EventCallback): void;

    // Scope methods
    static addGlobalScope(name: string, callback: (qb: QueryBuilder<any>) => void): void;
    static removeGlobalScope(name: string): void;
    static withoutGlobalScope<T extends Model>(this: new () => T, name: string): QueryBuilder<T>;
    static withoutGlobalScopes<T extends Model>(this: new () => T): QueryBuilder<T>;

    // Soft delete methods
    static withTrashed<T extends Model>(this: new () => T): QueryBuilder<T>;
    static onlyTrashed<T extends Model>(this: new () => T): QueryBuilder<T>;

    // Static methods
    static setConnection(connection: DatabaseConnection): void;
    /** Get the active database connection (v3.0.0+) */
    static getConnection(): DatabaseConnection;
    static query<T extends Model>(this: new () => T): QueryBuilder<T>;
    static all<T extends Model>(this: new () => T): Promise<T[]>;
    static find<T extends Model>(this: new () => T, id: any): Promise<T | null>;
    static findOrFail<T extends Model>(this: new () => T, id: any): Promise<T>;
    static where<T extends Model>(this: new () => T, column: string, value: any): QueryBuilder<T>;
    static where<T extends Model>(this: new () => T, column: string, operator: string, value: any): QueryBuilder<T>;
    static create<T extends Model>(this: new () => T, attributes: Record<string, any>): Promise<T>;
    static insert(data: Record<string, any> | Record<string, any>[]): Promise<any>;
    static update(attributes: Record<string, any>): Promise<any>;
    /** Update by primary key and return the updated model, optionally eager-loading relations */
    static updateAndFetchById<T extends Model>(this: new () => T, id: any, attributes: Record<string, any>, relations?: string[]): Promise<T | null>;
    /** Update by primary key */
    static updateById<T extends Model>(this: new () => T, id: any, attributes: Record<string, any>): Promise<any>;
    static delete(): Promise<any>;
    static first<T extends Model>(this: new () => T): Promise<T | null>;
    static orderBy<T extends Model>(this: new () => T, column: string, direction?: 'asc' | 'desc'): QueryBuilder<T>;
    static limit<T extends Model>(this: new () => T, value: number): QueryBuilder<T>;
    static offset<T extends Model>(this: new () => T, value: number): QueryBuilder<T>;
    static paginate<T extends Model>(this: new () => T, page?: number, perPage?: number): Promise<PaginationResult<T>>;
    static whereIn<T extends Model>(this: new () => T, column: string, values: any[]): QueryBuilder<T>;
    static whereNull<T extends Model>(this: new () => T, column: string): QueryBuilder<T>;
    static whereNotNull<T extends Model>(this: new () => T, column: string): QueryBuilder<T>;
    static count(): Promise<number>;

    // Convenience query methods
    /** Find the first record matching conditions or create a new one */
    static firstOrCreate<T extends Model>(this: new () => T, conditions: Record<string, any>, values?: Record<string, any>): Promise<T>;
    /** Find the first record matching conditions or return a new unsaved instance */
    static firstOrNew<T extends Model>(this: new () => T, conditions: Record<string, any>, values?: Record<string, any>): Promise<T>;
    /** Find a record matching conditions and update it, or create a new one */
    static updateOrCreate<T extends Model>(this: new () => T, conditions: Record<string, any>, values?: Record<string, any>): Promise<T>;
    /** Insert or update multiple records in bulk (ON CONFLICT / ON DUPLICATE KEY) */
    static upsert(rows: Record<string, any>[], uniqueBy: string | string[], update?: string[]): Promise<any>;

    // Observer
    /** Register an observer class that listens to model lifecycle events */
    static observe(observer: ModelObserver | (new () => ModelObserver)): void;

    // Cursor / Stream
    /** Lazily iterate over all matching records using an async generator */
    static cursor<T extends Model>(this: new () => T, chunkSize?: number): AsyncGenerator<T, void, unknown>;

    static with<T extends Model>(this: new () => T, ...relations: string[] | [Record<string, (qb: QueryBuilder<any>) => void> | string[]]): QueryBuilder<T>;
    /** Include hidden attributes in query results */
    static withHidden<T extends Model>(this: new () => T): QueryBuilder<T>;
    /** Control visibility of hidden attributes (false = hide, true = show) */
    static withoutHidden<T extends Model>(this: new () => T, show?: boolean): QueryBuilder<T>;

    // Instance methods with typed attributes
    /** Fill model with attributes */
    fill(attributes: Partial<TAttributes>): this;
    /** Set a single attribute with type safety */
    setAttribute<K extends keyof TAttributes>(key: K, value: TAttributes[K]): this;
    setAttribute(key: string, value: any): this;
    /** Get a single attribute with type safety */
    getAttribute<K extends keyof TAttributes>(key: K): TAttributes[K];
    getAttribute(key: string): any;
    castAttribute(key: string, value: any): any;
    save(): Promise<this>;
    destroy(): Promise<boolean>;
    getDirty(): Partial<TAttributes>;
    isDirty(): boolean;
    toJSON(): TAttributes;
    /** Load relations on an existing instance. Supports dot-notation and arrays. */
    load(...relations: string[] | [string[]]): Promise<this>;

    // Model instance utilities
    /** Reload a fresh model instance from the database */
    fresh(...relations: string[]): Promise<this | null>;
    /** Reload attributes from DB into this instance */
    refresh(): Promise<this>;
    /** Clone the model without the primary key */
    replicate(...except: string[]): this;
    /** Check if two models have the same ID and table */
    is(model: Model | null): boolean;
    /** Check if two models are different */
    isNot(model: Model | null): boolean;
    /** Get a subset of attributes as a plain object */
    only(...keys: (string | string[])[]): Partial<TAttributes>;
    /** Get all attributes except specified keys */
    except(...keys: (string | string[])[]): Partial<TAttributes>;
    /** Make attributes visible on this instance */
    makeVisible(...attrs: (string | string[])[]): this;
    /** Make attributes hidden on this instance */
    makeHidden(...attrs: (string | string[])[]): this;
    /** Check if attribute was changed on last save */
    wasChanged(attr?: string): boolean;
    /** Get attributes changed on last save */
    getChanges(): Partial<TAttributes>;

    // Soft delete instance methods
    trashed(): boolean;
    restore(): Promise<this>;
    forceDelete(): Promise<boolean>;

    // Validation
    validate(): ValidationResult;
    validateOrFail(): void;

    // Relationships
    hasOne<T extends Model>(related: new () => T, foreignKey?: string, localKey?: string): HasOneRelation<T>;
    hasMany<T extends Model>(related: new () => T, foreignKey?: string, localKey?: string): HasManyRelation<T>;
    belongsTo<T extends Model>(related: new () => T, foreignKey?: string, ownerKey?: string): BelongsToRelation<T>;
    belongsToMany<T extends Model>(
      related: new () => T,
      pivot: string,
      foreignPivotKey?: string,
      relatedPivotKey?: string,
      parentKey?: string,
      relatedKey?: string
    ): BelongsToManyRelation<T>;
    hasManyThrough<T extends Model>(
      relatedFinal: new () => T,
      through: new () => Model,
      foreignKeyOnThrough?: string,
      throughKeyOnFinal?: string,
      localKey?: string,
      throughLocalKey?: string
    ): HasManyThroughRelation<T>;
    /** Has one through intermediate model */
    hasOneThrough<T extends Model>(
      relatedFinal: new () => T,
      through: new () => Model,
      foreignKeyOnThrough?: string,
      throughKeyOnFinal?: string,
      localKey?: string,
      throughLocalKey?: string
    ): HasOneThroughRelation<T>;
    /** Polymorphic one-to-one relation */
    morphOne<T extends Model>(related: new () => T, name: string, typeColumn?: string, idColumn?: string, localKey?: string): MorphOneRelation<T>;
    /** Polymorphic one-to-many relation */
    morphMany<T extends Model>(related: new () => T, name: string, typeColumn?: string, idColumn?: string, localKey?: string): MorphManyRelation<T>;
    /** Inverse polymorphic relation */
    morphTo<T extends Model>(): MorphToRelation<T>;
  }

  // ==================== Relations ====================

  export abstract class Relation<T extends Model> {
    constructor(parent: Model, related: new () => T, foreignKey: string, localKey: string);
    /** Set a default value when the relation result is null */
    withDefault(value?: Record<string, any> | (() => T) | boolean): this;
    abstract get(): Promise<T | T[] | null>;
    abstract eagerLoad(models: Model[], relationName: string, constraint?: (qb: QueryBuilder<T>) => void): Promise<void>;
  }

  export class HasOneRelation<T extends Model> extends Relation<T> {
    get(): Promise<T | null>;
    eagerLoad(models: Model[], relationName: string, constraint?: (qb: QueryBuilder<T>) => void): Promise<void>;
    where(column: string, value: any): QueryBuilder<T>;
    where(column: string, operator: string, value: any): QueryBuilder<T>;
  }

  export class HasManyRelation<T extends Model> extends Relation<T> {
    get(): Promise<T[]>;
    eagerLoad(models: Model[], relationName: string, constraint?: (qb: QueryBuilder<T>) => void): Promise<void>;
    where(column: string, value: any): QueryBuilder<T>;
    where(column: string, operator: string, value: any): QueryBuilder<T>;
    count(): Promise<number>;
  }

  export class BelongsToRelation<T extends Model> extends Relation<T> {
    get(): Promise<T | null>;
    eagerLoad(models: Model[], relationName: string, constraint?: (qb: QueryBuilder<T>) => void): Promise<void>;
    where(column: string, value: any): QueryBuilder<T>;
    where(column: string, operator: string, value: any): QueryBuilder<T>;
  }

  export class BelongsToManyRelation<T extends Model> extends Relation<T> {
    get(): Promise<T[]>;
    eagerLoad(models: Model[], relationName: string, constraint?: (qb: QueryBuilder<T>) => void): Promise<void>;
    attach(ids: number | number[]): Promise<void>;
    detach(ids?: number | number[] | null): Promise<void>;
    sync(ids: number[]): Promise<void>;
  }

  export class HasManyThroughRelation<T extends Model> extends Relation<T> {
    get(): Promise<T[]>;
    eagerLoad(models: Model[], relationName: string, constraint?: (qb: QueryBuilder<T>) => void): Promise<void>;
  }

  export class HasOneThroughRelation<T extends Model> extends Relation<T> {
    get(): Promise<T | null>;
    eagerLoad(models: Model[], relationName: string, constraint?: (qb: QueryBuilder<T>) => void): Promise<void>;
  }

  export class MorphOneRelation<T extends Model> extends Relation<T> {
    get(): Promise<T | null>;
    eagerLoad(models: Model[], relationName: string, constraint?: (qb: QueryBuilder<T>) => void): Promise<void>;
  }

  export class MorphManyRelation<T extends Model> extends Relation<T> {
    get(): Promise<T[]>;
    eagerLoad(models: Model[], relationName: string, constraint?: (qb: QueryBuilder<T>) => void): Promise<void>;
  }

  export class MorphToRelation<T extends Model> extends Relation<T> {
    get(): Promise<T | null>;
    eagerLoad(models: Model[], relationName: string, constraint?: (qb: QueryBuilder<T>) => void): Promise<void>;
  }

  // ==================== Schema Builder (Migrations) ====================

  /** Foreign key action types */
  export type ForeignKeyAction = 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION' | 'SET DEFAULT';

  /** Schema builder for database migrations */
  export interface SchemaBuilder {
    /** Create a new table */
    createTable(name: string, callback: (table: TableBuilder) => void): Promise<void>;
    /** Drop a table */
    dropTable(name: string): Promise<void>;
    /** Drop a table if it exists */
    dropTableIfExists(name: string): Promise<void>;
    /** Rename a table */
    renameTable(from: string, to: string): Promise<void>;
    /** Check if table exists */
    hasTable(name: string): Promise<boolean>;
    /** Modify an existing table */
    table(name: string, callback: (table: TableBuilder) => void): Promise<void>;
    /** Check if column exists */
    hasColumn(table: string, column: string): Promise<boolean>;
  }

  /** Table builder for creating/modifying tables */
  export interface TableBuilder {
    // Primary keys
    /** Auto-incrementing primary key */
    id(name?: string): ColumnBuilder;
    /** Big integer auto-incrementing primary key */
    bigIncrements(name?: string): ColumnBuilder;
    /** UUID primary key */
    uuid(name?: string): ColumnBuilder;

    // Numeric types
    /** Integer column */
    integer(name: string): ColumnBuilder;
    /** Big integer column */
    bigInteger(name: string): ColumnBuilder;
    /** Small integer column */
    smallInteger(name: string): ColumnBuilder;
    /** Tiny integer column */
    tinyInteger(name: string): ColumnBuilder;
    /** Decimal column */
    decimal(name: string, precision?: number, scale?: number): ColumnBuilder;
    /** Float column */
    float(name: string, precision?: number, scale?: number): ColumnBuilder;
    /** Double column */
    double(name: string, precision?: number, scale?: number): ColumnBuilder;

    // String types
    /** String/VARCHAR column */
    string(name: string, length?: number): ColumnBuilder;
    /** Text column */
    text(name: string): ColumnBuilder;
    /** Medium text column */
    mediumText(name: string): ColumnBuilder;
    /** Long text column */
    longText(name: string): ColumnBuilder;
    /** Char column */
    char(name: string, length?: number): ColumnBuilder;

    // Boolean
    /** Boolean column */
    boolean(name: string): ColumnBuilder;

    // Date/Time
    /** Date column */
    date(name: string): ColumnBuilder;
    /** DateTime column */
    dateTime(name: string): ColumnBuilder;
    /** Timestamp column */
    timestamp(name: string): ColumnBuilder;
    /** Time column */
    time(name: string): ColumnBuilder;
    /** Year column */
    year(name: string): ColumnBuilder;
    /** Add created_at and updated_at columns */
    timestamps(): void;
    /** Add nullable deleted_at column for soft deletes */
    softDeletes(): void;

    // Binary
    /** Binary/Blob column */
    binary(name: string): ColumnBuilder;
    /** Blob column */
    blob(name: string): ColumnBuilder;

    // JSON
    /** JSON column */
    json(name: string): ColumnBuilder;
    /** JSONB column (PostgreSQL) */
    jsonb(name: string): ColumnBuilder;

    // Enum
    /** Enum column */
    enum(name: string, values: string[]): ColumnBuilder;

    // Indexes
    /** Add primary key constraint */
    primary(columns: string | string[]): void;
    /** Add unique constraint */
    unique(columns: string | string[]): void;
    /** Add index */
    index(columns: string | string[], name?: string): void;
    /** Add foreign key */
    foreign(column: string): ForeignKeyBuilder;

    // Modifications
    /** Drop a column */
    dropColumn(name: string | string[]): void;
    /** Rename a column */
    renameColumn(from: string, to: string): void;
    /** Drop an index */
    dropIndex(name: string): void;
    /** Drop a unique constraint */
    dropUnique(name: string): void;
    /** Drop a foreign key */
    dropForeign(name: string): void;
    /** Add a CHECK constraint */
    check(expression: string): CheckConstraintBuilder;
    /** Drop a named constraint (CHECK or FK) by name */
    dropConstraint(name: string): this;
    /** Drop a CHECK constraint by name (alias for dropConstraint) */
    dropCheck(name: string): this;
  }

  /** Column builder for column definitions */
  export interface ColumnBuilder {
    /** Make column nullable */
    nullable(): this;
    /** Set default value */
    default(value: any): this;
    /** Make column unsigned (numeric only) */
    unsigned(): this;
    /** Add unique constraint */
    unique(): this;
    /** Make column primary key */
    primary(): this;
    /** Add index */
    index(): this;
    /** Add auto increment */
    autoIncrement(): this;
    /** Add comment */
    comment(text: string): this;
    /** Add after clause (MySQL) */
    after(column: string): this;
    /** Add first clause (MySQL) */
    first(): this;
    /** Set character set */
    charset(charset: string): this;
    /** Set collation */
    collation(collation: string): this;
    /** Add references for foreign key */
    references(column: string): ForeignKeyBuilder;
  }

  /** Foreign key builder */
  export interface ForeignKeyBuilder {
    /** Referenced table */
    on(table: string): this;
    /** Referenced column */
    references(column: string): this;
    /** On delete action */
    onDelete(action: ForeignKeyAction): this;
    /** On update action */
    onUpdate(action: ForeignKeyAction): this;
    /** Set an explicit constraint name (must be a valid SQL identifier) */
    name(value?: string): this;
  }

  /** CHECK constraint builder — returned by Blueprint.check() */
  export interface CheckConstraintBuilder {
    /** Set an explicit name for the constraint (must be a valid SQL identifier) */
    name(value?: string): this;
    /** Get the resolved constraint name (custom or auto-generated) */
    resolvedName(): string;
    /** The raw SQL expression */
    readonly expression: string;
  }

  /** Migration interface for typed migrations */
  export interface MigrationInterface {
    /** Run the migration */
    up(schema: SchemaBuilder): Promise<void>;
    /** Reverse the migration */
    down(schema: SchemaBuilder): Promise<void>;
  }

  /** Schema class export */
  export class Schema {
    static create(name: string, callback: (table: TableBuilder) => void): Promise<void>;
    static drop(name: string): Promise<void>;
    static dropIfExists(name: string): Promise<void>;
    static table(name: string, callback: (table: TableBuilder) => void): Promise<void>;
    static rename(from: string, to: string): Promise<void>;
    static hasTable(name: string): Promise<boolean>;
    static hasColumn(table: string, column: string): Promise<boolean>;
  }

  export class Seeder {
    constructor(connection: DatabaseConnection, manager?: SeederManager | null);
    run(): Promise<void>;
    call(seeder: string): Promise<void>;
    insert(table: string, rows: Record<string, any> | Record<string, any>[]): Promise<any>;
    truncate(table: string): Promise<void>;
  }

  export class SeederManager {
    constructor(connection: DatabaseConnection, seedsPath?: string);
    run(target?: string | null): Promise<void>;
    runSeeder(seederRef: string): Promise<void>;
  }

  // ==================== Backup ====================

  export type BackupFormat = 'sql' | 'json';
  export type BackupType   = 'full' | 'partial' | 'journal';
  export type SaltLength   = 4 | 5 | 6;

  /** Encryption options for backup files */
  export interface EncryptionOptions {
    /** Enable AES-256-GCM encryption (default: false) */
    encrypt?: boolean;
    /** Password used for key derivation (required when encrypt=true) */
    encryptionPassword?: string;
    /**
     * Grain de sable (salt) length in characters.
     * Must be 4, 5, or 6.  Default: 6.
     */
    saltLength?: SaltLength;
  }

  export interface BackupOptions extends EncryptionOptions {
    /** Override the auto-generated filename */
    filename?: string;
    /** Output format – 'sql' (default) or 'json' */
    format?: BackupFormat;
  }

  export interface JournalOptions extends EncryptionOptions {
    /** Override the auto-generated filename */
    filename?: string;
    /** Clear the query log after writing the journal (default: false) */
    flush?: boolean;
  }

  export interface RestoreOptions {
    /**
     * Password to decrypt an encrypted backup.
     * Falls back to the BackupManager constructor password.
     */
    encryptionPassword?: string;
  }

  export interface RestoreResult {
    /** Number of SQL statements executed */
    statements: number;
  }

  export interface BackupManagerOptions extends EncryptionOptions {
    /** Directory where backup files are written (default: './database/backups') */
    backupPath?: string;
  }

  export interface ScheduleConfig extends EncryptionOptions {
    /** Interval between backups in milliseconds (minimum: 1000) */
    intervalMs: number;
    /** Run once immediately when scheduled (default: false) */
    runNow?: boolean;
    /** Table names – required for 'partial' type */
    tables?: string[];
    /** Output format for full/partial backups */
    format?: BackupFormat;
    /** Auto-flush query log after each journal backup */
    flush?: boolean;
    /** Called with the file path after a successful backup */
    onSuccess?: (filePath: string) => void;
    /** Called with the error when a backup fails */
    onError?: (error: Error) => void;
    /** Optional unique job identifier (defaults to "<type>_<timestamp>") */
    name?: string;
  }

  export class BackupManager {
    constructor(connection: DatabaseConnection, options?: BackupManagerOptions);

    /** Full backup – schema + data for every table. */
    full(options?: BackupOptions): Promise<string>;
    /** Partial backup – schema + data for the specified tables only. */
    partial(tables: string[], options?: BackupOptions): Promise<string>;
    /**
     * Transaction-log backup – replayable DML statements from the query log.
     * Requires DatabaseConnection.enableQueryLog() to be called beforehand.
     */
    journal(options?: JournalOptions): Promise<string>;
    /** Restore a previously created SQL backup file (supports encrypted files). */
    restore(filePath: string, options?: RestoreOptions): Promise<RestoreResult>;
  }

  export class BackupScheduler {
    constructor(connection: DatabaseConnection, options?: BackupManagerOptions);

    schedule(type: BackupType, config: ScheduleConfig): string;
    stop(name: string): void;
    stopAll(): void;
    activeJobs(): string[];
  }

  // ==================== Backup Encryption ====================

  export interface EncryptResult {
    /** Full file content to write to disk */
    encryptedContent: string;
    /** The grain de sable (salt) that was generated */
    salt: string;
  }

  export namespace BackupEncryption {
    /**
     * Encrypt a string payload with AES-256-GCM.
     * @param plaintext    Content to encrypt
     * @param password     Encryption password
     * @param saltLength   Grain de sable length (4–6, default 6)
     */
    function encrypt(plaintext: string, password: string, saltLength?: SaltLength): EncryptResult;

    /**
     * Decrypt a previously encrypted backup payload.
     * @param encryptedContent  Raw file content produced by encrypt()
     * @param password          The same password used during encryption
     */
    function decrypt(encryptedContent: string, password: string): string;

    /** Return true if the content looks like an outlet-orm encrypted backup. */
    function isEncrypted(content: string): boolean;

    /**
     * Generate a random alphanumeric salt (grain de sable).
     * @param length  4, 5, or 6 characters
     */
    function generateSalt(length?: SaltLength): string;
  }

  // ==================== Backup Socket Server ====================

  export interface ServerOptions extends BackupManagerOptions {
    /** TCP port to listen on (default: 9119) */
    port?: number;
    /** Host / IP to bind (default: '127.0.0.1') */
    host?: string;
  }

  export interface ServerStatus {
    uptime:  number;
    jobs:    string[];
    clients: number;
  }

  export interface ServerAddress {
    host: string;
    port: number;
  }

  export class BackupSocketServer {
    constructor(connection: DatabaseConnection, options?: ServerOptions);

    /** Start the TCP daemon. */
    listen(): Promise<void>;
    /** Gracefully stop the daemon and all scheduled jobs. */
    close(): Promise<void>;
    /** Return the bound address (null before listen). */
    address(): ServerAddress | null;

    on(event: 'listening', listener: (addr: ServerAddress) => void): this;
    on(event: 'close',     listener: () => void): this;
    on(event: 'error',     listener: (err: Error) => void): this;
    on(event: 'event',     listener: (payload: Record<string, any>) => void): this;
    on(event: string,      listener: (...args: any[]) => void): this;
  }

  // ==================== Backup Socket Client ====================

  export interface ClientOptions {
    /** TCP port of the server (default: 9119) */
    port?: number;
    /** Host of the server (default: '127.0.0.1') */
    host?: string;
    /** Timeout in ms waiting for a server reply (default: 30000) */
    timeout?: number;
  }

  export interface RunOptions extends EncryptionOptions {
    format?  : BackupFormat;
    filename?: string;
    flush?   : boolean;
  }

  export class BackupSocketClient {
    constructor(options?: ClientOptions);

    readonly connected: boolean;

    connect():    Promise<void>;
    disconnect(): Promise<void>;

    ping():    Promise<'pong'>;
    status():  Promise<ServerStatus>;
    jobs():    Promise<string[]>;

    schedule(type: BackupType, config: ScheduleConfig): Promise<string>;
    stop(name: string):    Promise<boolean>;
    stopAll():             Promise<boolean>;

    /**
     * Trigger a one-shot backup immediately.
     * @param tables  Required for 'partial' type
     */
    run(type: BackupType, options?: RunOptions): Promise<string>;
    run(type: 'partial', tables: string[], options?: RunOptions): Promise<string>;

    /**
     * Restore a previously created backup file on the server.
     * Supports plain SQL and encrypted .enc files.
     * @param filePath  Absolute path to the backup file (server-side)
     * @param options   Supply encryptionPassword when the file is encrypted
     */
    restore(filePath: string, options?: RestoreOptions): Promise<RestoreResult>;

    on(event: 'connect',     listener: () => void): this;
    on(event: 'disconnect',  listener: () => void): this;
    on(event: 'error',       listener: (err: Error) => void): this;
    on(event: 'jobStart',    listener: (payload: { name: string; type: string }) => void): this;
    on(event: 'jobDone',     listener: (payload: { name: string; type: string; filePath: string }) => void): this;
    on(event: 'jobError',    listener: (payload: { name: string; type: string; error: string }) => void): this;
    on(event: 'serverEvent', listener: (payload: Record<string, any>) => void): this;
    on(event: string,        listener: (...args: any[]) => void): this;
  }

  // ==================== AI Integration (v7.0.0) ====================

  /** MCP tool definition */
  export interface MCPToolDefinition {
    name: string;
    description: string;
    inputSchema: {
      type: 'object';
      properties: Record<string, any>;
      required: string[];
    };
  }

  /** MCP server options */
  export interface MCPServerOptions {
    /** DatabaseConnection instance (optional, auto-loaded from project) */
    connection?: DatabaseConnection;
    /** Project root directory (default: process.cwd()) */
    projectDir?: string;
    /** Enable AI safety guardrails (default: true) */
    safetyGuardrails?: boolean;
  }

  /** JSON-RPC 2.0 message */
  export interface JSONRPCMessage {
    jsonrpc: '2.0';
    id?: number | string;
    method?: string;
    params?: Record<string, any>;
    result?: any;
    error?: { code: number; message: string };
  }

  /** MCP Server — exposes ORM capabilities to AI agents via JSON-RPC 2.0 */
  export class MCPServer {
    constructor(options?: MCPServerOptions);

    /** Project root directory */
    projectDir: string;
    /** Whether safety guardrails are enabled */
    safetyGuardrails: boolean;

    /** Start the MCP server on stdio */
    start(): void;
    /** Get a programmatic handler function (for testing/embedding) */
    handler(): (message: JSONRPCMessage) => Promise<JSONRPCMessage | null>;
    /** Graceful shutdown */
    close(): Promise<void>;

    on(event: 'started',     listener: () => void): this;
    on(event: 'initialized', listener: () => void): this;
    on(event: 'response',    listener: (response: JSONRPCMessage) => void): this;
    on(event: 'close',       listener: () => void): this;
    on(event: string,        listener: (...args: any[]) => void): this;
  }

  /** Agent detection result */
  export interface AgentDetectionResult {
    /** Whether an AI agent was detected */
    detected: boolean;
    /** Name of the detected agent (null if not detected) */
    agentName: string | null;
  }

  /** Destructive action validation result */
  export interface DestructiveActionResult {
    /** Whether the action is allowed */
    allowed: boolean;
    /** Message explaining why action was blocked (empty if allowed) */
    message: string;
  }

  /** AI Safety Guardrails — detects AI agents and protects against destructive operations */
  export class AISafetyGuardrails {
    /** Detect if the current process is invoked by an AI agent */
    static detectAgent(): AgentDetectionResult;
    /** Check if a CLI command is destructive */
    static isDestructiveCommand(command: string): boolean;
    /** Validate whether user consent is present for a destructive operation */
    static validateDestructiveAction(command: string, flags?: { consent?: string; yes?: boolean; force?: boolean }): DestructiveActionResult;
    /** The environment variable name for AI consent */
    static readonly CONSENT_ENV_VAR: string;
  }

  /** Prompt blueprint — parsed from a natural language description */
  export interface PromptBlueprint {
    /** Detected domain (e.g. 'blog', 'e-commerce', 'saas') */
    domain: string;
    /** Table definitions */
    tables: Record<string, { columns: string[]; pivot?: boolean }>;
    /** Match confidence score */
    score: number;
  }

  /** Prompt Generator — generates projects from natural language descriptions */
  export class PromptGenerator {
    /** Parse a natural language prompt into a project blueprint */
    static parse(prompt: string): PromptBlueprint;
    /** Generate model files from a blueprint */
    static generateModels(blueprint: PromptBlueprint, outputDir: string): string[];
    /** Generate migration files from a blueprint */
    static generateMigrations(blueprint: PromptBlueprint, outputDir: string): string[];
    /** Generate a seeder file from a blueprint */
    static generateSeeder(blueprint: PromptBlueprint, outputDir: string): string;
  }

  // ==================== AI Bridge (v8.0.0) ====================

  /** Normalized chat response */
  export interface ChatResponse {
    output_text?: string;
    choices?: Array<{ message: { content: string; tool_calls?: any[] }; finish_reason?: string }>;
    content?: Array<{ text: string }>;
    message?: { content: string };
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
    [key: string]: any;
  }

  /** Streaming chunk value object */
  export class StreamChunk {
    text: string;
    usage: Record<string, any> | null;
    finishReason: string | null;
    chunkType: 'delta' | 'end' | 'tool_call' | 'tool_result';
    toolCalls: any[] | null;
    toolResults: any[] | null;
    static delta(text: string, extra?: Partial<StreamChunk>): StreamChunk;
    static end(usage?: Record<string, any>, finishReason?: string): StreamChunk;
  }

  /** Message value object */
  export class Message {
    role: string;
    content: string;
    static user(content: string): Message;
    static system(content: string): Message;
    static assistant(content: string): Message;
    toJSON(): { role: string; content: string };
  }

  /** Document attachment */
  export class Document {
    kind: string;
    data: any;
    meta: Record<string, any>;
    static local(filePath: string, meta?: Record<string, any>): Document;
    static base64(data: string, mimeType: string): Document;
    static url(url: string): Document;
    static text(text: string): Document;
    static raw(data: any): Document;
  }

  /** Provider error */
  export class ProviderError extends Error {
    statusCode: number | null;
    providerName: string;
    static notFound(name: string): ProviderError;
    static unsupported(provider: string, capability: string): ProviderError;
  }

  /** Chat provider base contract */
  export abstract class ChatProviderContract {
    chat(messages: Array<{ role: string; content: string }>, options?: Record<string, any>): Promise<ChatResponse>;
    stream(messages: Array<{ role: string; content: string }>, options?: Record<string, any>): AsyncGenerator<StreamChunk>;
    supportsStreaming(): boolean;
  }

  /** Embeddings provider base contract */
  export abstract class EmbeddingsProviderContract {
    embeddings(inputs: string | string[], options?: Record<string, any>): Promise<number[][]>;
  }

  /** Image provider base contract */
  export abstract class ImageProviderContract {
    generateImage(prompt: string, options?: Record<string, any>): Promise<{ url?: string; b64_json?: string }[]>;
  }

  /** Audio provider base contract */
  export abstract class AudioProviderContract {
    textToSpeech(text: string, options?: Record<string, any>): Promise<{ b64: string; mime: string }>;
    speechToText(audioSource: string | Buffer, options?: Record<string, any>): Promise<{ text: string }>;
  }

  /** Models provider base contract */
  export abstract class ModelsProviderContract {
    listModels(): Promise<any[]>;
    getModel(modelId: string): Promise<any>;
  }

  /** Tool contract for function calling */
  export abstract class ToolContract {
    name(): string;
    description(): string;
    schema(): Record<string, any>;
    execute(args: Record<string, any>): Promise<any>;
  }

  /** Built-in system info tool */
  export class SystemInfoTool extends ToolContract {
    name(): string;
    description(): string;
    schema(): Record<string, any>;
    execute(): Promise<{ node_version: string; platform: string; arch: string; uptime: number }>;
  }

  /** Tool registry */
  export class ToolRegistry {
    register(tool: ToolContract): void;
    get(name: string): ToolContract | undefined;
    has(name: string): boolean;
    all(): ToolContract[];
    readonly size: number;
  }

  /** Tool chat runner — executes tool loops */
  export class ToolChatRunner {
    constructor(manager: AIManager, registry: ToolRegistry);
    run(provider: string, messages: Array<{ role: string; content: string }>, options?: { maxToolIterations?: number; model?: string }): Promise<ChatResponse>;
  }

  /** OpenAI provider options */
  export interface OpenAIProviderConfig {
    api_key: string;
    model?: string;
    endpoint?: string;
    responses_endpoint?: string;
    embeddings_endpoint?: string;
    images_endpoint?: string;
    audio_tts_endpoint?: string;
    audio_stt_endpoint?: string;
  }

  export class OpenAIProvider extends ChatProviderContract {
    constructor(config: OpenAIProviderConfig);
    chat(messages: Array<{ role: string; content: string }>, options?: Record<string, any>): Promise<ChatResponse>;
    stream(messages: Array<{ role: string; content: string }>, options?: Record<string, any>): AsyncGenerator<StreamChunk>;
    embeddings(inputs: string | string[], options?: Record<string, any>): Promise<number[][]>;
    generateImage(prompt: string, options?: Record<string, any>): Promise<any[]>;
    textToSpeech(text: string, options?: Record<string, any>): Promise<{ b64: string; mime: string }>;
    speechToText(audioSource: string | Buffer, options?: Record<string, any>): Promise<{ text: string }>;
    listModels(): Promise<any[]>;
    getModel(modelId: string): Promise<any>;
  }

  export class OllamaProvider extends ChatProviderContract {
    constructor(config: { endpoint?: string; model?: string });
    chat(messages: Array<{ role: string; content: string }>, options?: Record<string, any>): Promise<ChatResponse>;
    stream(messages: Array<{ role: string; content: string }>, options?: Record<string, any>): AsyncGenerator<StreamChunk>;
    embeddings(inputs: string | string[], options?: Record<string, any>): Promise<number[][]>;
    generateImage(prompt: string, options?: Record<string, any>): Promise<any[]>;
  }

  export class OllamaTurboProvider extends OllamaProvider {
    constructor(config: { api_key: string; endpoint?: string; model?: string });
  }

  export class ClaudeProvider extends ChatProviderContract {
    constructor(config: { api_key: string; model?: string; endpoint?: string });
  }

  export class GeminiProvider extends ChatProviderContract {
    constructor(config: { api_key: string; model?: string; endpoint?: string });
    embeddings(inputs: string | string[], options?: Record<string, any>): Promise<number[][]>;
  }

  export class GrokProvider extends ChatProviderContract {
    constructor(config: { api_key: string; model?: string; endpoint?: string });
  }

  export class MistralProvider extends OpenAIProvider {
    constructor(config: { api_key: string; model?: string });
  }

  export class OnnProvider extends ChatProviderContract {
    constructor(config: { api_key: string; model?: string; endpoint?: string });
  }

  export interface CustomOpenAIProviderConfig {
    api_key: string;
    base_url: string;
    model?: string;
    auth_header?: string;
    auth_prefix?: string;
    extra_headers?: Record<string, string>;
    paths?: {
      chat?: string;
      embeddings?: string;
      models?: string;
      images?: string;
      audio_tts?: string;
      audio_stt?: string;
    };
  }

  export class CustomOpenAIProvider extends ChatProviderContract {
    constructor(config: CustomOpenAIProviderConfig);
    chat(messages: Array<{ role: string; content: string }>, options?: Record<string, any>): Promise<ChatResponse>;
    stream(messages: Array<{ role: string; content: string }>, options?: Record<string, any>): AsyncGenerator<StreamChunk>;
    embeddings(inputs: string | string[], options?: Record<string, any>): Promise<number[][]>;
    generateImage(prompt: string, options?: Record<string, any>): Promise<any[]>;
    textToSpeech(text: string, options?: Record<string, any>): Promise<{ b64: string; mime: string }>;
    speechToText(audioSource: string | Buffer, options?: Record<string, any>): Promise<{ text: string }>;
    listModels(): Promise<any[]>;
  }

  /** AI manager configuration */
  export interface AIConfig {
    default?: string;
    openai?: OpenAIProviderConfig;
    ollama?: { endpoint?: string; model?: string };
    ollama_turbo?: { api_key: string; endpoint?: string; model?: string };
    claude?: { api_key: string; model?: string; endpoint?: string };
    gemini?: { api_key: string; model?: string; endpoint?: string };
    grok?: { api_key: string; model?: string; endpoint?: string };
    mistral?: { api_key: string; model?: string };
    onn?: { api_key: string; model?: string; endpoint?: string };
    openai_custom?: CustomOpenAIProviderConfig;
    openrouter?: { api_key: string; base_url?: string; model?: string };
    [key: string]: any;
  }

  /** TextBuilder — fluent API for building AI requests */
  export class TextBuilder {
    constructor(manager: AIManager);
    using(provider: string, model?: string): this;
    withPrompt(text: string, attachments?: Document[]): this;
    withSystemPrompt(text: string): this;
    withMaxTokens(n: number): this;
    usingTemperature(t: number): this;
    usingTopP(p: number): this;
    withApiKey(key: string): this;
    withEndpoint(url: string): this;
    withBaseUrl(url: string): this;
    withChatEndpoint(url: string): this;
    withAuthHeader(header: string): this;
    withExtraHeaders(headers: Record<string, string>): this;
    withPaths(paths: Record<string, string>): this;
    asText(): Promise<string>;
    asRaw(): Promise<ChatResponse>;
    asStream(): AsyncGenerator<StreamChunk>;
  }

  /** AIManager — central orchestrator for multi-provider AI */
  export class AIManager {
    constructor(config?: AIConfig);
    provider(name: string): ChatProviderContract;
    registerProvider(name: string, provider: ChatProviderContract): void;
    chat(provider: string, messages: Array<{ role: string; content: string }>, options?: Record<string, any>): Promise<ChatResponse>;
    stream(provider: string, messages: Array<{ role: string; content: string }>, options?: Record<string, any>): AsyncGenerator<StreamChunk>;
    streamEvents(provider: string, messages: Array<{ role: string; content: string }>, options?: Record<string, any>): AsyncGenerator<StreamChunk>;
    embeddings(provider: string, inputs: string | string[], options?: Record<string, any>): Promise<number[][]>;
    models(provider: string): Promise<any[]>;
    model(provider: string, modelId: string): Promise<any>;
    image(provider: string, prompt: string, options?: Record<string, any>): Promise<any[]>;
    tts(provider: string, text: string, options?: Record<string, any>): Promise<{ b64: string; mime: string }>;
    stt(provider: string, audioSource: string | Buffer, options?: Record<string, any>): Promise<{ text: string }>;
    text(): TextBuilder;
    registerTool(tool: ToolContract): void;
    tool(name: string): ToolContract | undefined;
    tools(): ToolContract[];
    chatWithTools(provider: string, messages: Array<{ role: string; content: string }>, options?: Record<string, any>): Promise<ChatResponse>;
  }

  // ==================== AI ORM Features (v8.0.0) ====================

  /** NL→SQL query result */
  export interface AIQueryResult {
    sql: string;
    params: any[];
    results: any[];
    explanation: string;
    error?: string;
    raw_response: ChatResponse;
  }

  /** AIQueryBuilder — natural language to SQL conversion */
  export class AIQueryBuilder {
    constructor(manager: AIManager, connection: DatabaseConnection);
    using(provider: string, model: string): this;
    safeMode(safe: boolean): this;
    query(question: string, options?: { model?: string; max_tokens?: number; temperature?: number }): Promise<AIQueryResult>;
    toSql(question: string, options?: Record<string, any>): Promise<{ sql: string; params: any[]; explanation: string }>;
  }

  /** AI seed result */
  export interface AISeedResult {
    records: Record<string, any>[];
    inserted: number;
  }

  /** AISeeder — AI-powered data seeding */
  export class AISeeder {
    constructor(manager: AIManager, connection: DatabaseConnection);
    using(provider: string, model: string): this;
    seed(table: string, count?: number, context?: { description?: string; locale?: string; domain?: string }): Promise<AISeedResult>;
    generate(table: string, count?: number, context?: { description?: string; locale?: string; domain?: string }): Promise<Record<string, any>[]>;
  }

  /** Query optimization result */
  export interface OptimizationResult {
    original: string;
    optimized: string;
    suggestions: Array<{ type: string; description: string; impact: 'high' | 'medium' | 'low' }>;
    explanation: string;
    indexes: string[];
    raw_response: ChatResponse;
  }

  /** AIQueryOptimizer — AI-powered SQL query optimization */
  export class AIQueryOptimizer {
    constructor(manager: AIManager, connection?: DatabaseConnection);
    using(provider: string, model: string): this;
    optimize(sql: string, options?: { schema?: string; dialect?: string; model?: string }): Promise<OptimizationResult>;
    explain(sql: string): Promise<{ plan: any[]; analysis: string }>;
  }

  /** AI-generated schema */
  export interface AISchema {
    tables: Record<string, { columns: string[] }>;
    relations: Array<{ type: string; from: string; to: string; pivot?: string }>;
    seedHints: Record<string, string>;
  }

  /** AIPromptEnhancer — LLM-powered schema/code generation */
  export class AIPromptEnhancer {
    constructor(manager: AIManager);
    using(provider: string, model: string): this;
    generateSchema(description: string, options?: { model?: string }): Promise<AISchema>;
    generateModelCode(tableName: string, tableSchema: { columns: string[] }, relations?: any[]): Promise<string>;
    generateMigrationCode(tableName: string, tableSchema: { columns: string[] }): Promise<string>;
  }
}


// ── API Layer (v13) ────────────────────────────────────────────────────
export * from './api/index';

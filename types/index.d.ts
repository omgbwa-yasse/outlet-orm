// Type definitions for outlet-orm

declare module 'outlet-orm' {

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

  export class DatabaseConnection {
    constructor(config?: Partial<DatabaseConfig>);
    connect(): Promise<void>;
    select(table: string, query: QueryObject): Promise<any[]>;
    insert(table: string, data: Record<string, any>): Promise<{ insertId: any; affectedRows: number }>;
    insertMany(table: string, data: Record<string, any>[]): Promise<{ affectedRows: number }>;
    update(table: string, data: Record<string, any>, query: QueryObject): Promise<{ affectedRows: number }>;
    delete(table: string, query: QueryObject): Promise<{ affectedRows: number }>;
    count(table: string, query: QueryObject): Promise<number>;
    executeRawQuery(sql: string, params?: any[]): Promise<any[]>;
    /** Execute raw SQL and return driver-native results (used by migrations) */
    execute(sql: string, params?: any[]): Promise<any>;
    /** Atomically increment a column respecting query wheres */
    increment(table: string, column: string, query: QueryObject, amount?: number): Promise<{ affectedRows: number }>;
    /** Atomically decrement a column respecting query wheres */
    decrement(table: string, column: string, query: QueryObject, amount?: number): Promise<{ affectedRows: number }>;
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
    operator?: string;
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

    get(): Promise<T[]>;
    first(): Promise<T | null>;
    firstOrFail(): Promise<T>;
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

    clone(): QueryBuilder<T>;
  }

  // ==================== Model ====================

  export type CastType = 'int' | 'integer' | 'float' | 'double' | 'string' | 'bool' | 'boolean' | 'array' | 'json' | 'date' | 'datetime' | 'timestamp';

  export class Model {
    static table: string;
    static primaryKey: string;
    static timestamps: boolean;
    static fillable: string[];
    static hidden: string[];
    static casts: Record<string, CastType>;
    static connection: DatabaseConnection | null;

    attributes: Record<string, any>;
    original: Record<string, any>;
    relations: Record<string, any>;
    exists: boolean;

    constructor(attributes?: Record<string, any>);

    // Static methods
    static setConnection(connection: DatabaseConnection): void;
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
  static with<T extends Model>(this: new () => T, ...relations: string[] | [Record<string, (qb: QueryBuilder<any>) => void> | string[]]): QueryBuilder<T>;

    // Instance methods
    fill(attributes: Record<string, any>): this;
    setAttribute(key: string, value: any): this;
    getAttribute(key: string): any;
    castAttribute(key: string, value: any): any;
    save(): Promise<this>;
    destroy(): Promise<boolean>;
    getDirty(): Record<string, any>;
    isDirty(): boolean;
    toJSON(): Record<string, any>;
  /** Load relations on an existing instance. Supports dot-notation and arrays. */
  load(...relations: string[] | [string[]]): Promise<this>;

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
  }

  // ==================== Relations ====================

  export abstract class Relation<T extends Model> {
    constructor(parent: Model, related: new () => T, foreignKey: string, localKey: string);
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
}

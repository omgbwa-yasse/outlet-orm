# 📘 API Reference

Full Outlet ORM API Reference v4.0.0.

> � **Structure**: Use these APIs in`models/`,`controllers/`,`services/`— See [Project structure](INSTALLATION.md#structure-de-projet-recommandée)
>
> �📘 **TypeScript**: See [TYPESCRIPT.md](TYPESCRIPT.md) for interfaces and generic types.

## Table of contents

- [Model](#model)
- [QueryBuilder](#querybuilder)
- [DatabaseConnection](#databaseconnection)
- [Relationships](#relationships)

---

## Model

Base class for all models.

### Static properties

| Property | Type | Default | Description |
|-----------|------|---------|-------------|
|`table`|`string`| - | **Required.** Table name |
|`primaryKey`|`string`|`'id'`| Primary key name |
|`timestamps`|`boolean`|`true`| Auto management of created_at/updated_at |
|`fillable`|`string[]`|`[]`| Mass editable attributes |
|`hidden`|`string[]`|`[]`| Attributes excluded from toJSON() |
|`casts`|`object`|`{}`| Cast types for attributes |
|`softDeletes`|`boolean`|`false`| Enable soft deletion |
|`rules`|`object`|`{}`| Validation rules |
|`scopes`|`object`|`{}`| Local scopes defined |
|`globalScopes`|`object`|`{}`| Global scopes defined |

### Static methods

#### Recovery

```javascript
// All records
static async all(): Promise<Model[]>

// Par ID
static async find(id: any): Promise<Model | null>

// By ID or error
static async findOrFail(id: any): Promise<Model>

// First result
static async first(): Promise<Model | null>

// With conditions
static async get(): Promise<Model[]>

// Count
static async count(): Promise<number>

// There is
static async exists(): Promise<boolean>
```

#### Creation

```javascript
// Create and save
static async create(data: object): Promise<Model>

// Insertion brute
static async insert(data: object | object[]): Promise<void>
```

#### Update

```javascript
// Update by ID
static async updateById(id: any, data: object): Promise<void>

// Update and recover
static async updateAndFetchById(id: any, data: object, relationships?: string[]): Promise<Model>

// Increment
static async increment(column: string, amount?: number): Promise<void>

// Decrement
static async decrement(column: string, amount?: number): Promise<void>
```

#### Suppression

```javascript
// Bulk Delete
static async delete(): Promise<void>

// Clear the table
static async truncate(): Promise<void>
```

#### Query Builder

```javascript
// Start a query
static query(): QueryBuilder

// Selection
static select(...columns: string[]): QueryBuilder

// Conditions
static where(column: string, operatorOrValue: any, value?: any): QueryBuilder
static whereIn(column: string, values: any[]): QueryBuilder
static whereNotIn(column: string, values: any[]): QueryBuilder
static whereNull(column: string): QueryBuilder
static whereNotNull(column: string): QueryBuilder
static whereBetween(column: string, min: any, max: any): QueryBuilder
static whereLike(column: string, pattern: string): QueryBuilder
static whereRaw(sql: string, bindings?: any[]): QueryBuilder
static orWhere(column: string, operatorOrValue: any, value?: any): QueryBuilder

// Sort and limit
static orderBy(column: string, direction?: 'asc' | 'desc'): QueryBuilder
static limit(n: number): QueryBuilder
static offset(n: number): QueryBuilder

// Relationships
static with(...relationships: string[]): QueryBuilder

// Soft Deletes
static withTrashed(): QueryBuilder
static onlyTrashed(): QueryBuilder

// Scopes
static scope(...names: string[]): QueryBuilder

// Hidden attributes
static withHidden(): QueryBuilder

// Pagination
static async paginate(page?: number, perPage?: number): Promise<PaginationResult>

// Transaction
static useTransaction(trx: Transaction): QueryBuilder

// Connection (v3.0.0+)
static setConnection(db: DatabaseConnection): void
static getConnection(): DatabaseConnection
```

#### Events

```javascript
static boot(): void
static creating(callback: (model: Model) => void | false): void
static created(callback: (model: Model) => void): void
static updating(callback: (model: Model) => void | false): void
static updated(callback: (model: Model) => void): void
static saving(callback: (model: Model) => void | false): void
static saved(callback: (model: Model) => void): void
static deleting(callback: (model: Model) => void | false): void
static deleted(callback: (model: Model) => void): void
static restoring(callback: (model: Model) => void | false): void
static restored(callback: (model: Model) => void): void
static addEventListener(event: string, callback: Function): void
```

### Instance methods

```javascript
// Attributes
getAttribute(key: string): any
setAttribute(key: string, value: any): void
fill(data: object): void
isDirty(): boolean
getDirty(): object

// Backup
async save(): Promise<void>

// Suppression
async destroy(): Promise<void>
async forceDelete(): Promise<void>
async restore(): Promise<void>

// Relationships
async load(...relationships: string[]): Promise<void>

// Validation
validate(): ValidationResult

// Serialization
toJSON(): object
```

---

## QueryBuilder

SQL query builder.

### Methods

```javascript
// Selection
select(...columns: string[]): QueryBuilder
distinct(): QueryBuilder

// Conditions WHERE
where(column: string, operatorOrValue: any, value?: any): QueryBuilder
orWhere(column: string, operatorOrValue: any, value?: any): QueryBuilder
whereIn(column: string, values: any[]): QueryBuilder
whereNotIn(column: string, values: any[]): QueryBuilder
whereNull(column: string): QueryBuilder
whereNotNull(column: string): QueryBuilder
whereBetween(column: string, min: any, max: any): QueryBuilder
whereNotBetween(column: string, min: any, max: any): QueryBuilder
whereLike(column: string, pattern: string): QueryBuilder
whereRaw(sql: string, bindings?: any[]): QueryBuilder

// Joins
join(table: string, col1: string, operator: string, col2: string): QueryBuilder
leftJoin(table: string, col1: string, operator: string, col2: string): QueryBuilder
rightJoin(table: string, col1: string, operator: string, col2: string): QueryBuilder

// Sorting and grouping
orderBy(column: string, direction?: 'asc' | 'desc'): QueryBuilder
groupBy(...columns: string[]): QueryBuilder
having(column: string, operator: string, value: any): QueryBuilder

// Limit
limit(n: number): QueryBuilder
take(n: number): QueryBuilder
offset(n: number): QueryBuilder
skip(n: number): QueryBuilder

// Relationships
with(...relationships: string[]): QueryBuilder

// Soft Deletes
withTrashed(): QueryBuilder
onlyTrashed(): QueryBuilder

// Scopes
scope(...names: string[]): QueryBuilder

// Execution
async get(): Promise<Model[]>
async first(): Promise<Model | null>
async find(id: any): Promise<Model | null>
async count(): Promise<number>
async max(column: string): Promise<number>
async min(column: string): Promise<number>
async sum(column: string): Promise<number>
async avg(column: string): Promise<number>
async exists(): Promise<boolean>
async doesntExist(): Promise<boolean>
async pluck(column: string): Promise<any[]>

// Modification
async insert(data: object | object[]): Promise<void>
async update(data: object): Promise<void>
async delete(): Promise<void>
async increment(column: string, amount?: number): Promise<void>
async decrement(column: string, amount?: number): Promise<void>

// Debug
toSQL(): { sql: string, bindings: any[] }
```

---

## DatabaseConnection

Database connection management.

### Setup

```javascript
const config = {
  // MySQL
  driver: 'mysql',
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'mydb',
  
  // PostgreSQL
  driver: 'pg',
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: '',
  database: 'mydb',
  poolSize: 10,  // Pool size
  
  // SQLite
  driver: 'sqlite',
  filename: './database.sqlite'
};
```

### Static methods

```javascript
// Singleton
static getInstance(): DatabaseConnection
static setInstance(db: DatabaseConnection): void
```

### Instance methods

```javascript
// Connexion
async connect(): Promise<void>
async close(): Promise<void>

// Queries
async query(sql: string, params?: any[]): Promise<any>
async raw(sql: string, params?: any[]): Promise<any>

// Transactions
async beginTransaction(): Promise<Transaction>
async commit(trx: Transaction): Promise<void>
async rollback(trx: Transaction): Promise<void>
async transaction(callback: (trx: Transaction) => Promise<void>): Promise<void>

// Query Logging
enableQueryLog(): void
disableQueryLog(): void
getQueryLog(): QueryLogEntry[]
flushQueryLog(): void

// Security
sanitizeIdentifier(identifier: string): string
```

### Types

```typescript
interface QueryLogEntry {
  sql: string;
  bindings: any[];
  time: number;
}

interface Transaction {
  // Depends on driver
}
```

---

## Relationships

### HasOne

```javascript
hasOne(
  RelatedModel: typeof Model,
  foreignKey?: string,  // default: {model}_id
  localKey?: string     // default: id
): HasOneRelation
```

### HasMany

```javascript
hasMany(
  RelatedModel: typeof Model,
  foreignKey?: string,  // default: {model}_id
  localKey?: string     // default: id
): HasManyRelation
```

### BelongsTo

```javascript
belongsTo(
  RelatedModel: typeof Model,
  foreignKey?: string,  // Key on this model
  ownerKey?: string     // default: id
): BelongsToRelation
```

### BelongsToMany

```javascript
belongsToMany(
  RelatedModel: typeof Model,
  pivotTable: string,
  foreignPivotKey: string,
  relatedPivotKey: string,
  localKey?: string,
  relatedKey?: string
): BelongsToManyRelation
```

### HasManyThrough

```javascript
hasManyThrough(
  FinalModel: typeof Model,
  IntermediateModel: typeof Model,
  firstKey: string,     // Key on intermediate
  secondKey: string,    // Key on final
  localKey?: string,
  secondLocalKey?: string
): HasManyThroughRelation
```

### HasOneThrough

```javascript
hasOneThrough(
  FinalModel: typeof Model,
  IntermediateModel: typeof Model,
  firstKey: string,
  secondKey: string,
  localKey?: string,
  secondLocalKey?: string
): HasOneThroughRelation
```

### MorphOne

```javascript
morphOne(
  RelatedModel: typeof Model,
  name: string  // Column prefix {name}_type, {name}_id
): MorphOneRelation
```

### MorphMany

```javascript
morphMany(
  RelatedModel: typeof Model,
  name: string
): MorphManyRelation
```

### MorphTo

```javascript
morphTo(
  name: string,
  types: { [key: string]: typeof Model }
): MorphToRelation
```

---

## Types TypeScript

```typescript
// Validation
interface ValidationResult {
  valid: boolean;
  errors: { [field: string]: string[] };
}

// Pagination
interface PaginationResult<T = Model> {
  data: T[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
  from: number;
  to: number;
}

// Events
type EventCallback = (model: Model) => void | false | Promise<void | false>;

// Query Log
interface QueryLogEntry {
  sql: string;
  bindings: any[];
  time: number;
}

// Cast types
type CastType = 'int' | 'integer' | 'float' | 'double' | 
                'string' | 'bool' | 'boolean' | 
                'json' | 'array' | 'date';
```

---

## Exports

```javascript
const {
  Model,
  QueryBuilder,
  DatabaseConnection,
  
  // Relationships
  Relation,
  HasOneRelation,
  HasManyRelation,
  BelongsToRelation,
  BelongsToManyRelation,
  HasManyThroughRelation,
  HasOneThroughRelation,
  MorphOneRelation,
  MorphManyRelation,
  MorphToRelation
} = require('outlet-orm');
```

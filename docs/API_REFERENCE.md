# 📘 API Reference

Référence complète de l'API Outlet ORM v4.0.0.

> � **Structure** : Utilisez ces APIs dans `models/`, `controllers/`, `services/` — Voir [Structure de projet](INSTALLATION.md#structure-de-projet-recommandée)
>
> �📘 **TypeScript** : Voir [TYPESCRIPT.md](TYPESCRIPT.md) pour les interfaces et types génériques.

## Table des matières

- [Model](#model)
- [QueryBuilder](#querybuilder)
- [DatabaseConnection](#databaseconnection)
- [Relations](#relations)

---

## Model

Classe de base pour tous les modèles.

### Propriétés statiques

| Propriété | Type | Default | Description |
|-----------|------|---------|-------------|
| `table` | `string` | - | **Requis.** Nom de la table |
| `primaryKey` | `string` | `'id'` | Nom de la clé primaire |
| `timestamps` | `boolean` | `true` | Gestion auto de created_at/updated_at |
| `fillable` | `string[]` | `[]` | Attributs modifiables en masse |
| `hidden` | `string[]` | `[]` | Attributs exclus de toJSON() |
| `casts` | `object` | `{}` | Types de cast pour les attributs |
| `softDeletes` | `boolean` | `false` | Activer la suppression douce |
| `rules` | `object` | `{}` | Règles de validation |
| `scopes` | `object` | `{}` | Local scopes définis |
| `globalScopes` | `object` | `{}` | Global scopes définis |

### Méthodes statiques

#### Récupération

```javascript
// Tous les enregistrements
static async all(): Promise<Model[]>

// Par ID
static async find(id: any): Promise<Model | null>

// Par ID ou erreur
static async findOrFail(id: any): Promise<Model>

// Premier résultat
static async first(): Promise<Model | null>

// Avec conditions
static async get(): Promise<Model[]>

// Compter
static async count(): Promise<number>

// Existe
static async exists(): Promise<boolean>
```

#### Création

```javascript
// Créer et sauvegarder
static async create(data: object): Promise<Model>

// Insertion brute
static async insert(data: object | object[]): Promise<void>
```

#### Mise à jour

```javascript
// Mettre à jour par ID
static async updateById(id: any, data: object): Promise<void>

// Mettre à jour et récupérer
static async updateAndFetchById(id: any, data: object, relations?: string[]): Promise<Model>

// Incrémenter
static async increment(column: string, amount?: number): Promise<void>

// Décrémenter
static async decrement(column: string, amount?: number): Promise<void>
```

#### Suppression

```javascript
// Supprimer en masse
static async delete(): Promise<void>

// Vider la table
static async truncate(): Promise<void>
```

#### Query Builder

```javascript
// Démarrer une requête
static query(): QueryBuilder

// Sélection
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

// Tri et limite
static orderBy(column: string, direction?: 'asc' | 'desc'): QueryBuilder
static limit(n: number): QueryBuilder
static offset(n: number): QueryBuilder

// Relations
static with(...relations: string[]): QueryBuilder

// Soft Deletes
static withTrashed(): QueryBuilder
static onlyTrashed(): QueryBuilder

// Scopes
static scope(...names: string[]): QueryBuilder

// Attributs cachés
static withHidden(): QueryBuilder

// Pagination
static async paginate(page?: number, perPage?: number): Promise<PaginationResult>

// Transaction
static useTransaction(trx: Transaction): QueryBuilder

// Connexion (v3.0.0+)
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

### Méthodes d'instance

```javascript
// Attributs
getAttribute(key: string): any
setAttribute(key: string, value: any): void
fill(data: object): void
isDirty(): boolean
getDirty(): object

// Sauvegarde
async save(): Promise<void>

// Suppression
async destroy(): Promise<void>
async forceDelete(): Promise<void>
async restore(): Promise<void>

// Relations
async load(...relations: string[]): Promise<void>

// Validation
validate(): ValidationResult

// Sérialisation
toJSON(): object
```

---

## QueryBuilder

Constructeur de requêtes SQL.

### Méthodes

```javascript
// Sélection
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

// Jointures
join(table: string, col1: string, operator: string, col2: string): QueryBuilder
leftJoin(table: string, col1: string, operator: string, col2: string): QueryBuilder
rightJoin(table: string, col1: string, operator: string, col2: string): QueryBuilder

// Tri et groupement
orderBy(column: string, direction?: 'asc' | 'desc'): QueryBuilder
groupBy(...columns: string[]): QueryBuilder
having(column: string, operator: string, value: any): QueryBuilder

// Limite
limit(n: number): QueryBuilder
take(n: number): QueryBuilder
offset(n: number): QueryBuilder
skip(n: number): QueryBuilder

// Relations
with(...relations: string[]): QueryBuilder

// Soft Deletes
withTrashed(): QueryBuilder
onlyTrashed(): QueryBuilder

// Scopes
scope(...names: string[]): QueryBuilder

// Exécution
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

Gestion de la connexion à la base de données.

### Configuration

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
  poolSize: 10,  // Taille du pool
  
  // SQLite
  driver: 'sqlite',
  filename: './database.sqlite'
};
```

### Méthodes statiques

```javascript
// Singleton
static getInstance(): DatabaseConnection
static setInstance(db: DatabaseConnection): void
```

### Méthodes d'instance

```javascript
// Connexion
async connect(): Promise<void>
async close(): Promise<void>

// Requêtes
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

// Sécurité
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
  // Dépend du driver
}
```

---

## Relations

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
  foreignKey?: string,  // Clé sur ce modèle
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
  firstKey: string,     // Clé sur intermédiaire
  secondKey: string,    // Clé sur final
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
  name: string  // Préfixe des colonnes {name}_type, {name}_id
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
  
  // Relations
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

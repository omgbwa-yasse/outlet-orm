# Outlet ORM - API Reference

[← Back to Index](SKILL.md) | [Previous: Advanced](ADVANCED.md)

> 📘 **TypeScript** : Full type definitions available. Import types from`outlet-orm`. See [TYPESCRIPT.md](TYPESCRIPT.md)

---

## DatabaseConnection

### Constructor

```javascript
const { DatabaseConnection } = require('outlet-orm');

// From .env (automatic)
const db = new DatabaseConnection();

// Manual configuration
const db = new DatabaseConnection({
  driver: 'mysql',      // mysql | postgres | sqlite
  host: 'localhost',
  port: 3306,
  database: 'myapp',
  user: 'root',
  password: 'secret'
});
```

### Methods

| Method | Description |
|--------|-------------|
|`connect()`| Establish connection (called automatically) |
|`close()`| Close connection |
|`disconnect()`| Alias for close() |

### Transaction Methods

| Method | Description |
|--------|-------------|
|`beginTransaction()`| Start transaction |
|`commit()`| Commit transaction |
|`rollback()`| Rollback transaction |
|`transaction(callback)`| Execute in transaction (auto commit/rollback) |

### Query Methods

| Method | Description |
|--------|-------------|
|`select(table, query)`| Execute SELECT |
|`insert(table, data)`| Insert record |
|`insertMany(table, data[])`| Insert multiple records |
|`update(table, data, query)`| Update records |
|`delete(table, query)`| Delete records |
|`count(table, query)`| Count records |
|`executeRawQuery(sql, params?)`| Raw query (normalised results) |
|`execute(sql, params?)`| Raw query (native driver results) |
|`increment(table, column, query, amount?)`| Atomic increment |
|`decrement(table, column, query, amount?)`| Atomic decrement |

### Query Logging

| Method | Description |
|--------|-------------|
|`enableQueryLog()`| Enable query logging |
|`disableQueryLog()`| Disable query logging |
|`getQueryLog()`| Get array of logged queries |
|`flushQueryLog()`| Clear query log |
|`isLogging()`| Check if logging is enabled |

---

## Model (Static Methods)

### Connection

| Method | Description |
|--------|-------------|
|`setConnection(db)`| Set default connection |
|`getConnection()`| Get current connection |
|`setMorphMap(map)`| Set polymorphic mapping |

### Query

| Method | Description |
|--------|-------------|
|`query()`| Get QueryBuilder instance |
|`all()`| Get all records |
|`find(id)`| Find by ID |
|`findOrFail(id)`| Find or throw error |
|`first()`| Get first record |
|`where(col, op?, val)`| WHERE clause |
|`whereIn(col, vals)`| WHERE IN |
|`whereNotIn(col, vals)`| WHERE NOT IN |
|`whereNull(col)`| WHERE IS NULL |
|`whereNotNull(col)`| WHERE IS NOT NULL |
|`whereBetween(col, [min, max])`| WHERE BETWEEN |
|`whereLike(col, pattern)`| WHERE LIKE |
|`orWhere(col, op?, val)`| OR WHERE |

### CRUD

| Method | Description |
|--------|-------------|
|`create(attrs)`| Create and save |
|`insert(data)`| Raw insert |
|`update(attrs)`| Bulk update |
|`updateById(id, attrs)`| Update by ID |
|`updateAndFetchById(id, attrs, rels?)`| Update + fetch with relationships |
|`delete()`| Bulk delete |

### Relationships

| Method | Description |
|--------|-------------|
|`with(...relationships)`| Eager load relationships |
|`withCount(relation)`| Add relation count |
|`whereHas(rel, callback?)`| Filter by relation existence |
|`has(rel, op?, count)`| Filter by relation count |
|`whereDoesntHave(rel, callback?)`| Filter by relation absence |

### Query Modifiers

| Method | Description |
|--------|-------------|
|`select(...cols)`| Select columns |
|`columns([...])`| Select columns (alias) |
|`distinct()`| SELECT DISTINCT |
|`orderBy(col, dir?)`| ORDER BY |
|`ordrer(col, dir?)`| ORDER BY (typo alias) |
|`limit(n)`| LIMIT |
|`take(n)`| LIMIT (alias) |
|`offset(n)`| OFFSET |
|`skip(n)`| OFFSET (alias) |
|`groupBy(...cols)`| GROUP BY |
|`having(col, op, val)`| HAVING |
|`join(table, col1, op?, col2)`| INNER JOIN |
|`leftJoin(table, col1, op?, col2)`| LEFT JOIN |
|`paginate(page, perPage)`| Pagination |
|`count()`| Count records |
|`exists()`| Check existence |

### Hidden Attributes

| Method | Description |
|--------|-------------|
|`withHidden()`| Include hidden attributes |
|`withoutHidden(show?)`| Control hidden visibility |

### Soft Deletes

| Method | Description |
|--------|-------------|
|`withTrashed()`| Include soft deleted |
|`onlyTrashed()`| Only soft deleted |

### Scopes

| Method | Description |
|--------|-------------|
|`addGlobalScope(name, callback)`| Add global scope |
|`removeGlobalScope(name)`| Remove global scope |
|`withoutGlobalScope(name)`| Query without specific scope |
|`withoutGlobalScopes()`| Query without all scopes |

### Events

| Method | Description |
|--------|-------------|
|`on(event, callback)`| Register event listener |
|`creating(callback)`| Before create |
|`created(callback)`| After create |
|`updating(callback)`| Before update |
|`updated(callback)`| After update |
|`saving(callback)`| Before create/update |
|`saved(callback)`| After create/update |
|`deleting(callback)`| Before delete |
|`deleted(callback)`| After delete |
|`restoring(callback)`| Before restore |
|`restored(callback)`| After restore |

---

## Model (Instance Methods)

### Attributes

| Method | Description |
|--------|-------------|
|`fill(attrs)`| Fill attributes |
|`setAttribute(key, val)`| Set single attribute |
|`getAttribute(key)`| Get single attribute |
|`getDirty()`| Get modified attributes |
|`isDirty()`| Check if modified |
|`toJSON()`| Convert to plain object |

### Persistence

| Method | Description |
|--------|-------------|
|`save()`| Save (insert or update) |
|`destroy()`| Delete (soft if enabled) |

### Relationships

| Method | Description |
|--------|-------------|
|`load(...relationships)`| Load relationships on instance |
|`hasOne(Model, fk, lk)`| Define has-one relation |
|`hasMany(Model, fk, lk)`| Define has-many relation |
|`belongsTo(Model, fk, ok)`| Define belongs-to relation |
|`belongsToMany(Model, pivot, fk, rk)`| Define many-to-many |
|`hasManyThrough(Model, Through, fk1, fk2)`| Has-many via intermediate |
|`hasOneThrough(Model, Through, fk1, fk2)`| Has-one via intermediate |
|`morphOne(Model, name)`| Polymorphic has-one |
|`morphMany(Model, name)`| Polymorphic has-many |
|`morphTo(name)`| Polymorphic belongs-to |

### Soft Deletes

| Method | Description |
|--------|-------------|
|`trashed()`| Check if soft deleted |
|`restore()`| Restore soft deleted |
|`forceDelete()`| Permanent delete |

### Validation

| Method | Description |
|--------|-------------|
|`validate()`| Validate against rules |
|`validateOrFail()`| Validate or throw error |

---

## QueryBuilder

### Selection

| Method | Description |
|--------|-------------|
|`select(...cols)`| Select columns |
|`columns([...])`| Select columns (alias) |
|`distinct()`| SELECT DISTINCT |

### Conditions

| Method | Description |
|--------|-------------|
|`where(col, op?, val)`| WHERE clause |
|`orWhere(col, op?, val)`| OR WHERE |
|`whereIn(col, vals)`| WHERE IN |
|`whereNotIn(col, vals)`| WHERE NOT IN |
|`whereNull(col)`| WHERE IS NULL |
|`whereNotNull(col)`| WHERE IS NOT NULL |
|`whereBetween(col, [min, max])`| WHERE BETWEEN |
|`whereLike(col, pattern)`| WHERE LIKE |

### Relational Filters

| Method | Description |
|--------|-------------|
|`whereHas(rel, callback?)`| Filter by relation |
|`has(rel, op?, count)`| Relation count filter |
|`whereDoesntHave(rel, callback?)`| No relation filter |
|`withCount(rel)`| Add {rel}_count column |

### Ordering & Limiting

| Method | Description |
|--------|-------------|
|`orderBy(col, dir?)`| ORDER BY |
|`ordrer(col, dir?)`| ORDER BY (typo alias) |
|`limit(n)`/`take(n)`| LIMIT |
|`offset(n)`/`skip(n)`| OFFSET |

### Grouping

| Method | Description |
|--------|-------------|
|`groupBy(...cols)`| GROUP BY |
|`having(col, op, val)`| HAVING |

### Joins

| Method | Description |
|--------|-------------|
|`join(table, col1, op?, col2)`| INNER JOIN |
|`leftJoin(table, col1, op?, col2)`| LEFT JOIN |

### Eager Loading

| Method | Description |
|--------|-------------|
|`with(...relationships)`| Eager load relationships |
|`with({ rel: callback })`| Eager load with constraints |

### Soft Deletes

| Method | Description |
|--------|-------------|
|`withTrashed()`| Include soft deleted |
|`onlyTrashed()`| Only soft deleted |

### Scopes

| Method | Description |
|--------|-------------|
|`withoutGlobalScope(name)`| Without specific scope |
|`withoutGlobalScopes()`| Without all scopes |

### Execution

| Method | Description |
|--------|-------------|
|`get()`| Execute and get all results |
|`first()`| Get first result |
|`firstOrFail()`| First or throw error |
|`find(id)`| Find by ID |
|`findOrFail(id)`| Find or throw error |
|`paginate(page, perPage)`| Paginated results |
|`count()`| Count results |
|`exists()`| Check existence |

### Mutations

| Method | Description |
|--------|-------------|
|`insert(data)`| Insert record(s) |
|`update(attrs)`| Update records |
|`updateAndFetch(attrs, rels?)`| Update + fetch |
|`delete()`| Delete records |
|`increment(col, amount?)`| Atomic increment |
|`decrement(col, amount?)`| Atomic decrement |

### Utility

| Method | Description |
|--------|-------------|
|`clone()`| Clone QueryBuilder |

---

## Schema Builder

### Table Operations

| Method | Description |
|--------|-------------|
|`create(table, callback)`| Create table |
|`table(table, callback)`| Alter table |
|`drop(table)`| Drop table |
|`dropIfExists(table)`| Drop if exists |
|`rename(from, to)`| Rename table |
|`hasTable(table)`| Check table exists |
|`hasColumn(table, column)`| Check column exists |

### Column Types

| Method | SQL Type |
|--------|----------|
|`id()`| BIGINT UNSIGNED AUTO_INCREMENT PK |
|`string(col, length?)`| VARCHAR |
|`text(col)`| TEXT |
|`integer(col)`| INT |
|`bigInteger(col)`| BIGINT |
|`boolean(col)`| TINYINT(1) |
|`date(col)`| DATE |
|`datetime(col)`| DATETIME |
|`timestamp(col)`| TIMESTAMP |
|`decimal(col, precision, scale)`| DECIMAL |
|`float(col, precision, scale)`| FLOAT |
|`json(col)`| JSON |
|`enum(col, values)`| ENUM |
|`uuid(col)`| CHAR(36) |
|`foreignId(col)`| BIGINT UNSIGNED |
|`timestamps()`| created_at, updated_at |
|`softDeletes()`| deleted_at |

### Column Modifiers

| Method | Description |
|--------|-------------|
|`nullable()`| Allow NULL |
|`default(value)`| Default value |
|`unique()`| UNIQUE constraint |
|`unsigned()`| UNSIGNED |
|`comment(text)`| Column comment |
|`after(column)`| Position after |
|`first()`| Position first |
|`useCurrent()`| DEFAULT CURRENT_TIMESTAMP |
|`useCurrentOnUpdate()`| ON UPDATE CURRENT_TIMESTAMP |

### Foreign Keys

| Method | Description |
|--------|-------------|
|`foreign(col)`| Start FK definition |
|`references(col)`| Reference column |
|`on(table)`| Reference table |
|`onDelete(action)`| ON DELETE action |
|`onUpdate(action)`| ON UPDATE action |
|`cascadeOnDelete()`| ON DELETE CASCADE |
|`cascadeOnUpdate()`| ON UPDATE CASCADE |
|`constrained(table?)`| Simplified FK |
|`dropForeign([cols])`| Drop FK |

### Indexes

| Method | Description |
|--------|-------------|
|`index(col)`| Add index |
|`index([cols])`| Composite index |
|`unique(col)`| Unique index |
|`fullText(col)`| Full text index |
|`dropIndex([cols])`| Drop index |

### Column Manipulation

| Method | Description |
|--------|-------------|
|`renameColumn(from, to)`| Rename column |
|`dropColumn(col)`| Drop column |
|`dropColumn([cols])`| Drop multiple columns |
|`dropTimestamps()`| Drop created_at, updated_at |

---

## Migration Class

### Properties

| Property | Description |
|----------|-------------|
|`connection`| Database connection |

### Methods

| Method | Description |
|--------|-------------|
|`getSchema()`| Get Schema Builder |
|`execute(sql)`| Execute raw SQL |

### Lifecycle Methods

| Method | Description |
|--------|-------------|
|`up()`| Run migration |
|`down()`| Rollback migration |

---

## Model Static Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
|`table`| string | required | Table name |
|`primaryKey`| string |`'id'`| Primary key column |
|`timestamps`| boolean |`true`| Auto timestamps |
|`softDeletes`| boolean |`false`| Enable soft delete |
|`DELETED_AT`| string |`'deleted_at'`| Soft delete column |
|`fillable`| array |`[]`| Mass assignable fields |
|`hidden`| array |`[]`| Hidden from JSON |
|`casts`| object |`{}`| Type casting |
|`rules`| object |`{}`| Validation rules |
|`connection`| object |`null`| Custom connection |

---

## Validation Rules

| Rule | Description |
|------|-------------|
|`required`| Field required |
|`string`| Must be string |
|`number`/`numeric`| Must be number |
|`email`| Valid email |
|`boolean`| Must be boolean |
|`date`| Valid date |
|`min:N`| Min length/value |
|`max:N`| Max length/value |
|`in:a,b,c`| Value in list |
|`regex:pattern`| Match regex |

---

## Cast Types

| Type | Description |
|------|-------------|
|`int`/`integer`| Integer |
|`float`/`double`| Float |
|`boolean`/`bool`| Boolean |
|`json`| JSON object |
|`array`| JSON array |
|`date`| Date object |

---

## Event Names

| Event | Description |
|-------|-------------|
|`creating`| Before insert |
|`created`| After insert |
|`updating`| Before update |
|`updated`| After update |
|`saving`| Before insert/update |
|`saved`| After insert/update |
|`deleting`| Before delete |
|`deleted`| After delete |
|`restoring`| Before restore |
|`restored`| After restore |

---

## AiBridgeManager

> Since v8.0.0

### Constructor

```javascript
const { AiBridgeManager } = require('outlet-orm');
const ai = new AiBridgeManager(config); // From config/aibridge.js or inline
```

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
|`chat(provider, messages, opts?)`| `{ text, tool_calls, raw }` | Send chat request |
|`stream(provider, messages, opts?)`| `AsyncGenerator<StreamChunk>` | SSE/NDJSON stream |
|`streamEvents(provider, messages, opts?)`| `AsyncGenerator<{type, data}>` | Structured stream events |
|`embeddings(provider, inputs, opts?)`| `{ vectors, usage, raw }` | Generate embeddings |
|`image(provider, prompt, opts?)`| `{ url, b64_json, raw }` | Generate image |
|`tts(provider, text, opts?)`| `{ audio, mime }` | Text-to-speech |
|`stt(provider, filePath, opts?)`| `{ text }` | Speech-to-text |
|`models(provider)`| `Array<{id, ...}>` | List available models |
|`model(provider, id)`| `Object` | Get single model info |
|`text()`| `TextBuilder` | Fluent text builder |
|`chatWithTools(provider, messages, opts?)`| `{ text, raw }` | Chat with tool calling loop |
|`registerTool(tool)`| `void` | Register a custom tool |
|`registerProvider(name, provider)`| `void` | Register a custom provider |
|`provider(name)`| `Provider` | Get registered provider |
|`tool(name)`| `ToolContract` | Get registered tool |
|`tools()`| `Array<ToolContract>` | Get all tools |

---

## TextBuilder

| Method | Returns | Description |
|--------|---------|-------------|
|`.using(provider, model)`| `this` | Set provider and model |
|`.withPrompt(text, attachments?)`| `this` | Add user message |
|`.withSystemPrompt(text)`| `this` | Set system prompt |
|`.withMaxTokens(n)`| `this` | Max tokens limit |
|`.usingTemperature(t)`| `this` | Temperature (0–2) |
|`.usingTopP(p)`| `this` | Top-p sampling |
|`.withApiKey(key)`| `this` | Override API key |
|`.withEndpoint(url)`| `this` | Override endpoint |
|`.withBaseUrl(url)`| `this` | Override base URL |
|`.withAuthHeader(header, prefix?)`| `this` | Override auth header |
|`.withExtraHeaders(headers)`| `this` | Extra HTTP headers |
|`.asText()`| `{ text, raw, usage, finish_reason }` | Text response |
|`.asStream()`| `AsyncGenerator<StreamChunk>` | Streaming response |
|`.asRaw()`| `Object` | Raw provider response |

---

## AIQueryBuilder

| Method | Returns | Description |
|--------|---------|-------------|
|`using(provider, model)`| `this` | Set LLM provider |
|`safeMode(bool)`| `this` | Restrict to SELECT/WITH |
|`query(question)`| `{ sql, params, results, explanation }` | NL → SQL + execute |
|`toSql(question)`| `{ sql, params, explanation }` | NL → SQL only |

---

## AISeeder

| Method | Returns | Description |
|--------|---------|-------------|
|`using(provider, model)`| `this` | Set LLM provider |
|`seed(table, count, ctx)`| `{ records, inserted }` | Generate + insert |
|`generate(table, count, ctx)`| `Array<Object>` | Preview only |

---

## AIQueryOptimizer

| Method | Returns | Description |
|--------|---------|-------------|
|`using(provider, model)`| `this` | Set LLM provider |
|`optimize(sql)`| `{ original, optimized, suggestions, indexes, explanation }` | Analyze + rewrite |
|`explain(sql)`| `{ plan, analysis }` | EXPLAIN + LLM analysis |

---

## AIPromptEnhancer

| Method | Returns | Description |
|--------|---------|-------------|
|`using(provider, model)`| `this` | Set LLM provider |
|`generateSchema(description)`| `{ tables, relations, seedHints }` | Schema from description |
|`generateModelCode(table, schema, rels)`| `string` | Model class code |
|`generateMigrationCode(table, schema)`| `string` | Migration class code |

---

## AISafetyGuardrails (Static)

| Method | Returns | Description |
|--------|---------|-------------|
|`detectAgent()`| `{ detected, agentName }` | Detect AI agent |
|`isDestructiveCommand(cmd)`| `boolean` | Check if destructive |
|`validateDestructiveAction(cmd, flags)`| `{ allowed, message }` | Validate with consent |
|`CONSENT_ENV_VAR`| `string` | Consent env var name |

---

## References

- <https://github.com/omgbwa-yasse/outlet-orm>
- <https://www.npmjs.com/package/outlet-orm>
- <https://github.com/omgbwa-yasse/outlet-orm/blob/main/docs/INDEX.md>

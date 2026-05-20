# Queries Reference

## Contents

- When to read this document
- Scope
- Building a query
- Selection and projection
- Predicates and combinations
- Ordering, pagination, and windowing
- Joins et set operations
- Grouping and aggregates
- Retrieval
- Mutations
- Relation-aware querying
- Soft delete and hidden flags on the builder
- Iteration and batch processing
- Debugging and inspection
- Recommended patterns
- Source files to read

## When to read this document

Read this resource if the request is about `QueryBuilder`, SQL filters, aggregates, joins, SQL pagination, `RawExpression` as a predicate value, or standalone mode via `db.from(...)`.

Do not use it as the main entry point for:

- defining a model and its attributes: see `MODELS.md`
- ORM relationships and polymorphism: see `RELATIONS.md`
- the API layer's HTTP query builder: see `API.md`

## Scope

This document covers `QueryBuilder`, model-backed queries, and standalone mode through `DatabaseConnection.from(...)`.

## Building a query

Possible entry points:

- `Model.query()`
- `Model.where(...)`
- `db.from('table')`
- `new QueryBuilder(ModelClass)`

Standard pattern:

```js
const users = await User
  .where('status', 'active')
  .orderBy('created_at', 'desc')
  .limit(20)
  .get();
```

## Selection and projection

Methods:

- `select(...columns)`
- `columns(array)`
- `distinct()`
- `selectRaw(sql, bindings?)` when you are already working at raw SQL builder level

Use `columns([...])` when you want to provide a dynamic array without `...spread`.

## Predicates and combinations

Main methods:

- `where(column, value)`
- `where(column, operator, value)`
- `orWhere(column, value)`
- `orWhere(column, operator, value)`
- `whereIn(column, values)`
- `whereNotIn(column, values)`
- `orWhereIn(...)`
- `orWhereNotIn(...)`
- `whereNull(column)`
- `whereNotNull(column)`
- `orWhereNull(column)`
- `orWhereNotNull(column)`
- `whereBetween(column, [a, b])`
- `whereNotBetween(column, [a, b])`
- `orWhereBetween(...)`
- `orWhereNotBetween(...)`
- `whereLike(column, value)`

`RawExpression` values in predicates are supported on the recent critical paths.

## Ordering, pagination, and windowing

- `orderBy(column, direction?)`
- `limit(value)`
- `offset(value)`
- `skip(value)`
- `take(value)`
- `paginate(page?, perPage?)`

Returned pagination structure:

- `data`
- `total`
- `per_page`
- `current_page`
- `last_page`
- `from`
- `to`

## Joins and set operations

Joins:

- `join(table, first, second)`
- `join(table, first, operator, second)`
- `leftJoin(...)`
- `rightJoin(...)`
- `crossJoin(table)`

Set operations:

- `union(query)`
- `unionAll(query)`

The `union` / `unionAll` parameter must be another `QueryBuilder`.

## Grouping and aggregates

- `groupBy(...columns)`
- `having(column, operator, value)`
- `havingRaw(sql, bindings?)`
- `count(column?)`
- `sum(column)`
- `avg(column)`
- `min(column)`
- `max(column)`

Relationship aggregates:

- `withCount(relations)`
- `withSum(relation, column)`
- `withAvg(relation, column)`
- `withMin(relation, column)`
- `withMax(relation, column)`

Generated column naming convention:

- `posts_count`
- `posts_sum_amount`
- `posts_max_created_at`

## Retrieval

Main terminal methods:

- `get()`
- `first()`
- `firstOrFail()`
- `firstOrCreate(values?)`
- `firstOrNew(values?)`
- `updateOrCreate(values?)`
- `exists()`
- `doesntExist()`
- `cursor(chunkSize?)`

Read helpers:

- `pluck(column)`
- `pluck(column, keyColumn)`
- `value(column)`

## Mutations

Available builder mutations:

- `insert(data)`
- `insertGetId(data)`
- `update(attributes)`
- `updateAndFetch(attributes, relations?)`
- `delete()`
- `increment(column, amount?)`
- `decrement(column, amount?)`

In standalone mode, these mutations are supported in recent versions:

```js
await db.from('users').where('status', 'pending').update({ status: 'active' });
await db.from('counters').where('id', 1).increment('value', 2);
```

## Relation-aware querying

Relationship filtering methods:

- `whereHas(relationName, callback?)`
- `has(relationName, count)`
- `has(relationName, operator, count)`
- `whereDoesntHave(relationName)`

Example:

```js
const users = await User
  .whereHas('posts', (qb) => qb.where('published', true))
  .withCount('posts')
  .get();
```

## Soft delete and hidden flags on the builder

- `withTrashed()`
- `onlyTrashed()`
- `withHidden()` through the static model API
- `withoutGlobalScope(name)`
- `withoutGlobalScopes()`

These flags are propagated during model hydration.

## Iteration and batch processing

- `cursor(chunkSize?)` for lazy async iteration
- `chunk(size, callback)` for page-by-page processing

The `chunk()` callback may return `false` to stop iteration.

## Debugging and inspection

- `toSQL()` returns the builder representation of the current SQL
- `dd()` dumps then throws
- `clone()` clones the builder and its flags
- `when(condition, callback, fallback?)` simplifies conditional branches
- `tap(callback)` inspects without breaking the chain

## Recommended patterns

- use `whereIn` / `whereBetween` instead of concatenating SQL fragments
- prefer `insertGetId()` when the caller immediately needs the created key
- for data migrations, prefer `db.from(table)` or `Migration.query(table)`
- use `clone()` before branching into two variants of the same query
- wrap optional branches with `when()` to keep the chain readable

## Source files to read

- `src/QueryBuilder.js`
- `src/DatabaseConnection.js`
- `tests/QueryBuilderStandalone.test.js`
- `tests/RawExpressionWhere.test.js`
- `tests/NewParityFeatures.test.js`
- `tests/NewFeatures.test.js`
- `tests/NewEvolutions.test.js`

# Relationships Reference

## Contents

- When to read this document
- Scope
- hasOne
- hasMany
- belongsTo
- belongsToMany
- hasManyThrough
- hasOneThrough
- Polymorphic relations
- Eager loading
- Relationship-based filters
- Default values
- Recommendations
- Source files to read

## When to read this document

Read this resource if the request is about `hasOne`, `hasMany`, `belongsTo`, `belongsToMany`, `hasManyThrough`, `hasOneThrough`, `morph*`, `with(...)`, `withCount(...)`, `whereHas(...)`, or eager / nested loading.

Do not use it as the main entry point for:

- pure SQL queries without ORM relationships: see `QUERIES.md`
- model attributes and events: see `MODELS.md`
- HTTP models in the `Api` layer: see `API.md`

## Scope

This document covers the ORM relationships publicly exposed by `outlet-orm`.

Available relationships:

- `Relation`
- `HasOneRelation`
- `HasManyRelation`
- `BelongsToRelation`
- `BelongsToManyRelation`
- `HasManyThroughRelation`
- `HasOneThroughRelation`
- `MorphOneRelation`
- `MorphManyRelation`
- `MorphToRelation`

## hasOne

Definition:

```js
profile() {
  return this.hasOne(Profile, 'user_id', 'id');
}
```

Use cases:

- user profile
- 1:1 configuration
- detail record tied to a primary entity

Useful APIs:

- `get()`
- `where(...)`
- `withDefault(value?)`

## hasMany

Definition:

```js
posts() {
  return this.hasMany(Post, 'user_id', 'id');
}
```

Useful APIs:

- `get()`
- `where(...)`
- `count()`
- eager loading through `with('posts')`

## belongsTo

Definition:

```js
author() {
  return this.belongsTo(User, 'user_id', 'id');
}
```

Use cases:

- author of a post
- direct parent through a local foreign key

`belongsTo` may also receive `withDefault()` when a null result should be replaced by a default object.

## belongsToMany

Definition:

```js
roles() {
  return this.belongsToMany(Role, 'user_roles', 'user_id', 'role_id');
}
```

Additional APIs:

- `attach(ids)`
- `detach(ids?)`
- `sync(ids)`

Use cases:

- users <-> roles
- posts <-> tags
- any many-to-many pivot table

## hasManyThrough

Definition:

```js
comments() {
  return this.hasManyThrough(Comment, Post, 'user_id', 'post_id', 'id', 'id');
}
```

Use case:

- retrieving a user's comments through their posts

The package also supports constrained eager loading on this relationship.

## hasOneThrough

Definition:

```js
primaryInvoice() {
  return this.hasOneThrough(Invoice, Order, 'customer_id', 'order_id', 'id', 'id');
}
```

Use case:

- a single final resource reached through an intermediate model

## Polymorphic relations

Exposed relationships:

- `morphOne(related, name, typeColumn?, idColumn?, localKey?)`
- `morphMany(related, name, typeColumn?, idColumn?, localKey?)`
- `morphTo()`

Morph map:

- `Model.setMorphMap(map)`

Conceptual example:

```js
image() {
  return this.morphOne(Media, 'imageable');
}

owner() {
  return this.morphTo();
}
```

## Eager loading

Main mechanisms:

- `Model.with('posts')`
- `Model.with('posts.comments')`
- `Model.with({ posts: (qb) => qb.where('published', true) })`
- `load(...relations)` on an already hydrated instance

Relationship aggregates:

- `withCount('posts')`
- `withSum('orders', 'amount')`
- `withAvg('ratings', 'score')`
- `withMin(...)`
- `withMax(...)`

## Relationship-based filters

- `whereHas(relation, callback?)`
- `has(relation, count)`
- `has(relation, operator, count)`
- `whereDoesntHave(relation)`

Use cases:

- parents that have at least one published child
- accounts with no invoices
- users with at least 3 roles or 10 posts

## Default values

`withDefault(value?)` is supported on:

- `HasOne`
- `MorphOne`
- `HasOneThrough`

This avoids propagating `null` when the caller prefers a hydrated default entity.

## Recommendations

- always define keys explicitly when naming is not trivial
- use `with(...)` for batched reads to avoid N+1 issues
- use `whereHas(...)` instead of filtering afterward in memory
- use `belongsToMany.sync(ids)` for a clear final pivot state
- document and fix a `morphMap` if polymorphic types must remain stable over time

## Source files to read

- `src/Relations/*`
- `src/Model.js`
- `tests/HasManyThrough.test.js`
- `tests/Polymorphic.test.js`
- `tests/NestedEager.test.js`

# TypeScript Reference

## When to read this document

Read this resource if the request is about `types/index.d.ts`, generic TypeScript models, `QueryBuilder` typing, typed relationships, API / AI declarations, or the repository's TS examples.

Do not use it as the main entry point for:

- the JavaScript runtime semantics of a class or command: see the matching functional document
- the shell CLI layer: see `CLI.md`
- real SQL migrations and behavior when the question is mostly business logic: see `MIGRATIONS.md`, `MODELS.md`, or `QUERIES.md`

## Scope

This document covers the TypeScript surface published by `outlet-orm`.

Sources to know:

- `types/index.d.ts`
- `types/api/*` when the API layer is involved
- `examples/typescript-*.ts` examples

## Public typing coverage

The declarations notably expose:

- `DatabaseConnection`
- `QueryBuilder<T>`
- `Model<TAttributes>`
- relationship types
- main migration / schema interfaces
- main AI exports
- main API Layer exports

## Model generique

Recommended pattern:

```ts
import { Model } from 'outlet-orm';

interface UserAttributes {
  id?: number;
  name: string;
  email: string;
}

class User extends Model<UserAttributes> {
  static table = 'users';
}
```

Benefits:

- typed `attributes` and `original`
- more precise `getAttribute()`
- better autocomplete on serialized objects

## QueryBuilder generique

`QueryBuilder<T extends Model>` provides:

- `get(): Promise<T[]>`
- `first(): Promise<T | null>`
- `paginate(): Promise<PaginationResult<T>>`
- typed relationships and constraint callbacks derived from the target model

## Casts et types exposes

Useful declared types:

- `CastType`
- `ModelEventName`
- `ValidationRule`
- `ValidationResult`
- `WhereOperator`
- `PaginationResult<T>`

## Typed relationships

The TS signatures cover:

- `hasOne<T>()`
- `hasMany<T>()`
- `belongsTo<T>()`
- `belongsToMany<T>()`
- `hasManyThrough<T>()`
- `hasOneThrough<T>()`
- `morphOne<T>()`
- `morphMany<T>()`
- `morphTo<T>()`

## API Layer TS

When using `Api` / `ApiGraphQL`:

- the types cover the main builders and errors
- pagination and validators are typed as well

## AI TS

The AI layer exposes its main classes in TS, including:

- `AIManager`
- alias `Ai`
- `TextBuilder`
- provider contracts
- main support classes

## Practical gaps

Points to keep in mind:

- very recent JavaScript additions may land before the types are fully refined
- when in doubt, verify `src/index.js`, `src/QueryBuilder.js`, and `CHANGELOG.md`
- if a helper exists in JS but is not yet fully visible in types, prefer fixing the types rather than adding implicit consumer-side workarounds

## Examples

Examples provided by the repository:

- `examples/typescript-example.ts`
- `examples/typescript-migration.ts`
- `examples/typescript-typed-model.ts`

## Recommendations

- explicitly type model attributes for real TS projects
- keep `static casts` as `as const` literals if you want clean hints
- verify API-layer types separately from SQL ORM types

## Source files to read

- `types/index.d.ts`
- `examples/typescript-example.ts`
- `examples/typescript-migration.ts`
- `examples/typescript-typed-model.ts`

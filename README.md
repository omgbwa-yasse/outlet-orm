# outlet-orm

`outlet-orm` est un ORM Active Record pour Node.js 18+ qui couvre beaucoup plus que la couche SQL classique. Le package regroupe un noyau ORM relationnel, un schema builder et un moteur de migrations, des seeders, des outils de backup et de reverse engineering, une couche API REST/GraphQL, un pont AI multi-provider, ainsi qu'un serveur MCP pour les agents.

Le point d'entree public est [src/index.js](src/index.js). Les signatures TypeScript sont exposees via [types/index.d.ts](types/index.d.ts). La surface reelle est egalement confirmee par les suites de tests dans [tests](tests) et les exemples dans [examples](examples).

## Table des matieres

- [Positionnement](#positionnement)
- [Installation](#installation)
- [Demarrage rapide](#demarrage-rapide)
- [Modele Active Record](#modele-active-record)
- [Requetes et QueryBuilder](#requetes-et-querybuilder)
- [Relations et eager loading](#relations-et-eager-loading)
- [Fonctionnalites avancees des modeles](#fonctionnalites-avancees-des-modeles)
- [DatabaseConnection et mode standalone](#databaseconnection-et-mode-standalone)
- [Schema builder, migrations et seeders](#schema-builder-migrations-et-seeders)
- [Backups, restauration et securite des migrations](#backups-restauration-et-securite-des-migrations)
- [Reverse engineering, init et conversion](#reverse-engineering-init-et-conversion)
- [Objets SQL avances et transactions](#objets-sql-avances-et-transactions)
- [API Layer HTTP / GraphQL](#api-layer-http--graphql)
- [Import et diff de specs API](#import-et-diff-de-specs-api)
- [AI, MCP et automatisation](#ai-mcp-et-automatisation)
- [CLI de reference](#cli-de-reference)
- [TypeScript](#typescript)
- [Exemples et validation](#exemples-et-validation)
- [Notes utiles et limites](#notes-utiles-et-limites)

## Positionnement

`outlet-orm` n'est pas seulement un ORM CRUD. Le package couvre 8 blocs complementaires:

| Domaine | Exports / commandes principales | Ce que cela apporte |
| --- | --- | --- |
| ORM SQL | `Model`, `QueryBuilder`, `DatabaseConnection` | Active Record, requetes fluentes, transactions, casts, validation |
| Relations | `hasOne`, `hasMany`, `belongsTo`, `belongsToMany`, `hasManyThrough`, `hasOneThrough`, `morph*` | Navigation relationnelle et eager loading |
| Schema / migrations | `Schema`, `Blueprint`, `Migration`, `MigrationManager`, `Seeder`, `SeederManager` | Evolution de schema, seeders, workflows de deploiement |
| DB objects | `View`, `Trigger`, `Procedure`, `Function`, `Transaction`, `useSchema` | Vues, triggers, procedures, savepoints, isolation level |
| Backups | `BackupManager`, `BackupScheduler`, `BackupEncryption`, `BackupSocketServer`, `BackupSocketClient` | Sauvegarde SQL/JSON, chiffrement, planification, restore |
| API Layer | `Api`, `ApiGraphQL`, `ApiAdapter`, `MockAdapter`, cache, offline, realtime | Meme style de modelisation, mais au-dessus de HTTP |
| AI bridge | `AIManager`, `Ai`, providers, `TextBuilder`, `AIQueryBuilder`, `AISeeder`, `AIPromptEnhancer` | Chat, tools, NL->SQL, seeds AI, generation guidee |
| CLI / MCP | `outlet`, `outlet-migrate`, `outlet-reverse`, `outlet-mcp`, `outlet api import`, `outlet api diff` | Initialisation, conversion, reverse engineering, MCP agent |

## Installation

Installation de base:

```bash
npm install outlet-orm
```

Installez ensuite seulement le driver dont vous avez besoin:

```bash
npm install mysql2
```

```bash
npm install pg
```

```bash
npm install sqlite3
```

Dependances et prerequis utiles:

- Node.js `>= 18.0.0`
- package principal en CommonJS (`require` / `module.exports`)
- `mysql2`, `pg`, `sqlite3` sont des peer dependencies optionnelles et chargees a la demande
- `graphql-ws` est optionnelle si vous utilisez les subscriptions GraphQL
- le package inclut ses types via `types/index.d.ts`

## Demarrage rapide

### 1. Configurer une connexion

```js
const { DatabaseConnection } = require('outlet-orm');

const db = new DatabaseConnection({
  driver: 'sqlite',
  database: ':memory:'
});

await db.connect();
```

Les drivers supportes dans la couche coeur sont:

- `mysql`
- `postgres` / `postgresql`
- `sqlite`

La configuration peut venir:

- directement du constructeur `new DatabaseConnection({...})`
- de `.env` (`DB_DRIVER`, `DB_HOST`, `DB_DATABASE`, `DB_FILE`, `DATABASE_URL`, etc.)
- de `database/config.js` pour la CLI de migration

### 2. Definir un modele

```js
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email', 'password', 'status'];
  static hidden = ['password'];
  static casts = {
    id: 'int',
    email_verified: 'boolean'
  };
  static connection = db;
}
```

### 3. Utiliser le modele

```js
const user = await User.create({
  name: 'Ada',
  email: 'ada@example.com',
  password: 'secret',
  status: 'active'
});

const activeUsers = await User
  .where('status', 'active')
  .orderBy('id', 'desc')
  .limit(10)
  .get();
```

## Modele Active Record

Le coeur ORM repose sur [src/Model.js](src/Model.js). Un modele declare typiquement:

- `static table`
- `static primaryKey`
- `static timestamps`
- `static fillable`
- `static hidden`
- `static casts`
- `static appends`
- `static connection`
- `static softDeletes`
- `static rules`

Capacites principales du modele:

- CRUD statique: `all()`, `find()`, `findOrFail()`, `create()`, `insert()`, `update()`, `delete()`
- helpers de recherche: `first()`, `firstOrCreate()`, `firstOrNew()`, `updateOrCreate()`, `upsert()`
- pagination: `paginate(page, perPage)`
- streaming: `cursor(chunkSize)`
- serialization: `toJSON()`, `only()`, `except()`
- cycle de vie: `save()`, `destroy()`, `fresh()`, `refresh()`, `replicate()`
- tracking: `getDirty()`, `isDirty()`, `wasChanged()`, `getChanges()`

Particularite utile: les instances sont enveloppees dans un `Proxy`, ce qui permet l'acces style propriete:

```js
const user = await User.find(1);

console.log(user.name);
user.name = 'Grace';
await user.save();
```

Ce comportement est teste dans [tests/PropertyAccess.test.js](tests/PropertyAccess.test.js).

## Requetes et QueryBuilder

Le `QueryBuilder` couvre les usages classiques et plusieurs helpers de parite de style Laravel.

### Filtres et clauses de base

Methodes courantes:

- `select(...columns)`
- `columns([...])`
- `distinct()`
- `where(column, value)`
- `where(column, operator, value)`
- `orWhere(...)`
- `whereIn()`, `whereNotIn()`
- `whereNull()`, `whereNotNull()`
- `whereBetween()`, `whereNotBetween()`
- `whereLike()`
- `orderBy()`
- `limit()`, `offset()`, `skip()`, `take()`
- `groupBy()`
- `having()`, `havingRaw()`
- `join()`, `leftJoin()`, `rightJoin()`, `crossJoin()`
- `union()`, `unionAll()`

### Chargement et filtres relationnels

- `with(...)`
- `withCount(...)`
- `withSum(relation, column)`
- `withAvg(relation, column)`
- `withMin(relation, column)`
- `withMax(relation, column)`
- `whereHas(relation, callback)`
- `has(relation, count)`
- `whereDoesntHave(relation)`

### Recuperation et mutation

- `get()`
- `first()`
- `firstOrFail()`
- `paginate()`
- `count()`
- `exists()` / `doesntExist()`
- `insert()` / `insertGetId()`
- `update()`
- `updateAndFetch()`
- `delete()`
- `increment()` / `decrement()`

### Helpers pratiques

- `pluck(column)`
- `pluck(column, keyColumn)`
- `value(column)`
- `sum()`, `avg()`, `min()`, `max()`
- `chunk(size, callback)`
- `when(condition, callback, fallback)`
- `tap(callback)`
- `toSQL()`
- `dd()`
- `clone()`

Exemple:

```js
const rows = await User
  .where('status', 'active')
  .whereBetween('created_at', ['2026-01-01', '2026-12-31'])
  .withCount('posts')
  .withMax('posts', 'created_at')
  .orderBy('posts_count', 'desc')
  .get();
```

Les usages recents et les helpers de parite sont verifies dans [tests/NewParityFeatures.test.js](tests/NewParityFeatures.test.js), [tests/NewFeatures.test.js](tests/NewFeatures.test.js), [tests/NewEvolutions.test.js](tests/NewEvolutions.test.js) et [tests/QueryBuilderStandalone.test.js](tests/QueryBuilderStandalone.test.js).

## Relations et eager loading

Relations supportees par le coeur ORM:

- `hasOne`
- `hasMany`
- `belongsTo`
- `belongsToMany`
- `hasManyThrough`
- `hasOneThrough`
- `morphOne`
- `morphMany`
- `morphTo`

Exemple:

```js
class User extends Model {
  static table = 'users';
  static connection = db;

  posts() {
    return this.hasMany(Post, 'user_id', 'id');
  }
}

class Post extends Model {
  static table = 'posts';
  static connection = db;

  author() {
    return this.belongsTo(User, 'user_id', 'id');
  }
}

const users = await User.with('posts').get();
```

Capacites complementaires:

- eager loading avec contraintes
- eager loading imbrique via notation pointee
- `withDefault()` sur les relations
- `attach()`, `detach()`, `sync()` sur `belongsToMany`
- morph map via `Model.setMorphMap(...)`

Suites de tests associees:

- [tests/HasManyThrough.test.js](tests/HasManyThrough.test.js)
- [tests/Polymorphic.test.js](tests/Polymorphic.test.js)
- [tests/NestedEager.test.js](tests/NestedEager.test.js)

## Fonctionnalites avancees des modeles

Le package embarque plusieurs comportements utiles qui ne sont pas toujours presents dans les ORMs legers.

### Visibilite et serialization

- `static hidden`
- `withHidden()`
- `withoutHidden(show)`
- `makeVisible()`
- `makeHidden()`
- `static appends`

Exemple documente aussi dans [examples/hidden-attributes-demo.js](examples/hidden-attributes-demo.js).

### Casts

Types de cast supportes:

- `int` / `integer`
- `float` / `double`
- `string`
- `bool` / `boolean`
- `array`
- `json`
- `date`
- `datetime`
- `timestamp`

### Accessors, mutators et validation

La couche modele couvre egalement:

- accessors / mutators
- regles de validation sur `static rules`
- `validate()` et `validateOrFail()`
- `fillable` guard sur insert / update

### Events, observers et scopes

Events supportes:

- `creating`, `created`
- `updating`, `updated`
- `saving`, `saved`
- `deleting`, `deleted`
- `restoring`, `restored`

Vous pouvez utiliser:

- `Model.on(event, callback)`
- helpers `creating(...)`, `saved(...)`, etc.
- `Model.observe(MyObserver)`
- global scopes via `addGlobalScope()` / `withoutGlobalScope()` / `withoutGlobalScopes()`
- local scopes verifies par [tests/NewEvolutions.test.js](tests/NewEvolutions.test.js)

### Soft deletes

Fonctionnalites soft delete:

- `static softDeletes = true`
- `static DELETED_AT`
- `withTrashed()`
- `onlyTrashed()`
- `trashed()`
- `restore()`
- `forceDelete()`

Le schema builder expose aussi `softDeletes()` pour ajouter `deleted_at`.

## DatabaseConnection et mode standalone

[src/DatabaseConnection.js](src/DatabaseConnection.js) gere:

- la connexion et le pooling
- l'execution des requetes
- les transactions
- le query log
- les agregats SQL
- l'utilisation standalone du builder via `from(...)`

Exemple standalone sans modele:

```js
await db.from('users')
  .where('status', 'pending')
  .update({ status: 'active' });

const exists = await db.from('users')
  .where('email', 'ada@example.com')
  .exists();
```

Fonctions utiles de bas niveau:

- `select()`
- `insert()` / `insertMany()`
- `update()`
- `delete()`
- `count()`
- `aggregate()`
- `executeRawQuery()`
- `execute()`
- `increment()` / `decrement()`

### Query log

Le log de requetes peut etre active globalement:

```js
DatabaseConnection.enableQueryLog();
// ...
const log = DatabaseConnection.getQueryLog();
DatabaseConnection.flushQueryLog();
```

Le backup journal s'appuie sur ce mecanisme.

## Schema builder, migrations et seeders

Le schema builder est fourni par `Schema` et `Blueprint`.

### Operations de schema principales

- `schema.create(name, callback)`
- `schema.table(name, callback)`
- `schema.rename(from, to)`
- `schema.drop(name)`
- `schema.dropIfExists(name)`
- `schema.hasTable(name)`
- `schema.hasColumn(table, column)`
- `schema.hasIndex(table, indexName)` / `indexExists(...)`

Le `Blueprint` couvre notamment:

- colonnes numeriques, texte, date, JSON, UUID, binary
- `timestamps()` avec plusieurs surcharges
- `softDeletes()`
- index, unique, full text
- foreign keys
- check constraints

Exemple de migration:

```js
const { Migration } = require('outlet-orm');

class CreateUsersTable extends Migration {
  async up() {
    const schema = this.getSchema();

    await schema.create('users', (table) => {
      table.id();
      table.string('name');
      table.string('email').unique();
      table.timestamps();
      table.softDeletes();
    });
  }

  async down() {
    await this.getSchema().dropIfExists('users');
  }
}

module.exports = CreateUsersTable;
```

### Migration base class

La base `Migration` fournit aussi:

- `getSchema()`
- `query(table)` / `table(table)` pour un `QueryBuilder` standalone en migration
- `log()`, `info()`, `warn()` pour les logs structures
- `shouldRun()` pour sauter une migration
- `withinTransaction` pour encapsuler `up()` / `down()` dans une transaction
- helpers de preservation de donnees: `transformData()`, `backupData()`, `restoreData()`

### MigrationManager

`MigrationManager` prend en charge:

- installation de la table des migrations
- execution des migrations pending
- rollback par batch
- reset / refresh / fresh
- deploy non interactif pour CI/CD
- `resolve --applied` et `resolve --rolled-back`
- detection de drift via checksum
- detection de migrations manquantes sur disque
- colonnes de suivi `_migrations`: `started_at`, `finished_at`, `rolled_back_at`, etc.
- advisory locks en deploy / resolve sur MySQL et PostgreSQL

### Seeder et SeederManager

Le package fournit:

- `Seeder`
- `SeederManager`
- scaffolding `make:seed`
- `seed` / `db:seed`
- ciblage d'une classe via `--seeder` / `--class`

## Backups, restauration et securite des migrations

La partie backup n'est pas un add-on anecdotique: elle est directement integree au cycle des migrations destructives.

### Capacites backup

- backup complet `full`
- backup partiel `partial`
- journal SQL base sur le query log `journal`
- format `sql` ou `json`
- chiffrement via `BackupEncryption`
- planification via `BackupScheduler`
- sockets de commande via `BackupSocketServer` et `BackupSocketClient`

### Securite des migrations destructives

Fonctions prises en charge par le package:

- auto-backup avant `fresh`, `reset`, `refresh`, `rollback`
- retention des auto-backups par commande
- restore automatise via `restore:auto`
- historique de restauration
- protection production via `OUTLET_PRODUCTION_CONFIRM=1` et confirmation du nom de base
- `--skip-auto-backup` ignore en production
- exit codes normalises

Les comportements sont verifies par:

- [tests/Backup.test.js](tests/Backup.test.js)
- [tests/BackupEncryption.test.js](tests/BackupEncryption.test.js)
- [tests/BackupSocket.test.js](tests/BackupSocket.test.js)
- [tests/MigrationDataPreservation.test.js](tests/MigrationDataPreservation.test.js)
- [tests/MigrationDeployOptions.test.js](tests/MigrationDeployOptions.test.js)
- [tests/MigrationExtraOptions.test.js](tests/MigrationExtraOptions.test.js)

## Reverse engineering, init et conversion

Le package embarque trois approches complementaires pour accelerer l'adoption.

### `outlet-init`

But:

- initialiser rapidement un projet outlet-orm
- generer des dossiers, un `.env`, un fichier de config, des migrations et seeders
- mode interactif classique
- mode prompt AI via `--prompt`

Exemples:

```bash
outlet-init
```

```bash
outlet-init --prompt "Blog avec utilisateurs, posts, commentaires" --driver sqlite
```

### `outlet-convert`

But:

- parser du SQL `CREATE TABLE`
- inferer des casts JS
- proposer les `fillable`, `hidden` et relations
- detecter les tables pivot pour `belongsToMany`

### `outlet-reverse`

But:

- introspecter une base existante ou un dump SQL
- generer des migrations basculees sur le schema builder
- generer des seeders a partir des donnees

Le reverse engineering couvre MySQL, PostgreSQL et SQLite dans le parseur des `CREATE TABLE`, y compris plusieurs types, defaults et foreign keys. Voir [tests/Reverse.test.js](tests/Reverse.test.js).

## Objets SQL avances et transactions

Le package ne se limite pas aux tables.

### Builders d'objets SQL

Exports publics:

- `View`
- `Trigger`
- `Procedure`
- `Function`
- `Transaction`
- `useSchema(schemaOrDb)`

Capacites exposees dans `Schema` et les builders associes:

- `createView`, `createOrReplaceView`, `dropView`, `dropViewIfExists`, `hasView`, `getViews`
- `createTrigger`, `dropTrigger`, `dropTriggerIfExists`, `hasTrigger`, `getTriggers`
- `createProcedure`, `dropProcedure`, `dropProcedureIfExists`, `hasProcedure`
- `createFunction`, `dropFunction`, `dropFunctionIfExists`, `hasFunction`

Exemple: [examples/migrations/create_views_and_triggers.js](examples/migrations/create_views_and_triggers.js).

### Transactions avancees

`DatabaseConnection` et `Transaction` couvrent:

- `beginTransaction()`
- `commit()`
- `rollback()`
- `transaction(callback)`
- `afterCommit(callback)`
- `savepoint(name)`
- `rollbackTo(name)`
- `releaseSavepoint(name)`
- `setIsolationLevel(level)`

Constantes exportees:

- `IsolationLevel.READ_UNCOMMITTED`
- `IsolationLevel.READ_COMMITTED`
- `IsolationLevel.REPEATABLE_READ`
- `IsolationLevel.SERIALIZABLE`

En cas de capacite non supportee, le package expose `UnsupportedCapabilityError`.

## API Layer HTTP / GraphQL

La couche API dans [src/Api](src/Api) reproduit une experience proche des modeles SQL, mais au-dessus de HTTP.

### Classes principales

- `Api`
- `ApiModel`
- `ApiAdapter`
- `createAdapter()`
- `ApiGraphQL`
- `MockAdapter`
- `InterceptorManager`
- `ApiCache`
- `ApiValidator`
- `ApiPaginator`
- `ApiQueryBuilder`

### Capacites REST

- CRUD via `find`, `findOrFail`, `all`, `get`, `create`, `save`, `destroy`
- query builder HTTP avec `where`, `orWhere`, `whereIn`, `whereNull`, `orderBy`, `limit`, `offset`, `with`, `select`
- pagination page/cursor/offset et iteration async
- auth `bearer`, `basic`, `apiKey`, `cookie`, `oauth2`, `dynamicHeaders`
- logs de requete et `toRequest()` pour debugger sans envoyer
- upload avec progression quand `XMLHttpRequest` est disponible
- validation de payload / response
- hierarchie d'erreurs typee (`ApiError`, `ApiValidationError`, `ApiRateLimitError`, etc.)

### Cache, offline, realtime et tests

Le package ajoute en plus:

- strategies de cache: cache-first, network-first, stale-while-revalidate, cache-only, network-only
- stores: memory, localStorage, sessionStorage
- queue offline via `MutationQueue`
- wrappers de stockage offline
- watchers / event stream / websocket
- adapter mock complet pour les tests
- intercepteurs request / response, retry et circuit breaker

Les suites liees sont visibles dans:

- [tests/ApiLayer.test.js](tests/ApiLayer.test.js)
- [tests/ApiLayerIntegration.test.js](tests/ApiLayerIntegration.test.js)
- [tests/ApiCache.test.js](tests/ApiCache.test.js)
- [tests/ApiOffline.test.js](tests/ApiOffline.test.js)
- [tests/ApiInterceptors.test.js](tests/ApiInterceptors.test.js)
- [tests/ApiGraphQL.test.js](tests/ApiGraphQL.test.js)
- [tests/ApiValidation.test.js](tests/ApiValidation.test.js)
- [tests/ApiPagination.test.js](tests/ApiPagination.test.js)
- [tests/ApiMock.test.js](tests/ApiMock.test.js)

## Import et diff de specs API

Le package propose aussi une chaine de generation de modeles API depuis des specs ou de la documentation.

### `outlet api import`

Commande ciblee pour:

- OpenAPI / Swagger
- Postman Collection
- GraphQL introspection
- RAML
- API Blueprint
- extraction depuis une documentation de reference via `--doc`

Options notables visibles dans [bin/api/import.js](bin/api/import.js):

- `--spec <path|url>`
- `--doc <path|url>`
- `--output <dir>`
- `--lang js|ts`
- `--auth bearer|basic|apiKey|oauth2`
- `--strategy tag|resource`
- `--format auto|openapi|postman|raml|apiblueprint|graphql`
- `--max-depth <n>`
- `--include-official-subdomains true|false`
- `--run-delta`

Le pipeline gere aussi des artefacts d'execution comme les snapshots, delta de run et diagnostics de couverture.

### `outlet api diff`

Compare un spec OpenAPI et un dossier de modeles generes:

- detection de modeles manquants
- detection de modeles en trop
- comparaison des endpoints
- comparaison des champs `fillable`

## AI, MCP et automatisation

La couche AI couvre deux axes: integration LLM generale et automatisation orientee ORM.

### Exports AI publics

- `AIManager` et son alias `Ai`
- facade `AIFacade`
- `TextBuilder`
- contrats: `ChatProviderContract`, `EmbeddingsProviderContract`, `ImageProviderContract`, `AudioProviderContract`, `ModelsProviderContract`, `ToolContract`
- providers: `OpenAIProvider`, `OllamaProvider`, `OllamaTurboProvider`, `ClaudeProvider`, `GeminiProvider`, `GrokProvider`, `MistralProvider`, `OnnProvider`, `CustomOpenAIProvider`
- support: `StreamChunk`, `Message`, `Document`, `ProviderError`, `ToolRegistry`, `ToolChatRunner`, `SystemInfoTool`
- composants metier: `AIQueryBuilder`, `AISeeder`, `AIQueryOptimizer`, `AIPromptEnhancer`
- composants historiques / utilitaires: `MCPServer`, `AISafetyGuardrails`, `PromptGenerator`

### Ce que la couche AI sait faire

- chat et generation de texte via providers multiples
- normalisation chat / embeddings / images / audio
- tool calling
- validation JSON schema
- securisation de fichiers et payloads AI
- NL->SQL via `AIQueryBuilder`
- suggestions d'optimisation SQL via `AIQueryOptimizer`
- generation de donnees realistes via `AISeeder`
- generation de schema / modele / migration via `AIPromptEnhancer`
- generation initiale projet / blueprints via `PromptGenerator`

Les suites de reference sont:

- [tests/AI.test.js](tests/AI.test.js)
- [tests/AiBridge.test.js](tests/AiBridge.test.js)

### MCP Server

`outlet-mcp` demarre le serveur MCP sur stdio.

Options:

- `--project`, `-p <path>`
- `--no-safety`

Tools exposes par defaut dans [src/AI/MCPServer.js](src/AI/MCPServer.js):

- `migrate_status`
- `migrate_run`
- `migrate_rollback`
- `migrate_reset`
- `migrate_make`
- `seed_run`
- `schema_introspect`
- `query_execute`
- `model_list`
- `backup_create`
- `backup_restore`
- `ai_query`
- `query_optimize`

Les actions destructives sont soumises a des garde-fous de consentement si la securite est activee.

## CLI de reference

### Entree unifiee `outlet`

```bash
outlet <command> [args]
```

Sous-commandes routees par [bin/outlet.js](bin/outlet.js):

| Commande | Role |
| --- | --- |
| `outlet init` | initialise un projet |
| `outlet convert` | convertit du SQL vers des modeles |
| `outlet migrate` | lance le gestionnaire de migrations |
| `outlet reverse` | reverse engineering DB / SQL |
| `outlet mcp` | demarre le serveur MCP |
| `outlet api import` | importe des modeles API depuis specs / docs |
| `outlet api diff` | compare spec et modeles |

Les aliases historiques restent exposes par `package.json`:

- `outlet-init`
- `outlet-convert`
- `outlet-migrate`
- `outlet-reverse`
- `outlet-mcp`
- `outlet-api-import`
- `outlet-api-diff`

### `outlet-migrate`

Sous-commandes documentees par l'implmentation courante:

| Commande | Role |
| --- | --- |
| `install` | cree seulement la table des migrations |
| `migrate` / `up` | execute les migrations pending |
| `deploy` | applique les migrations pending sans interaction, pour CI/CD |
| `resolve --applied=<name>` | marque une migration comme appliquee |
| `resolve --rolled-back=<name>` | marque une migration comme rollback |
| `rollback --steps=N` | annule un ou plusieurs batches |
| `reset --yes` | rollback total |
| `refresh --yes` | reset + migrate |
| `fresh --yes` | drop all + migrate |
| `status` | etat des migrations |
| `seed` / `db:seed` | execute les seeders |
| `make <name>` | scaffold migration |
| `make:seed <name>` | scaffold seeder |
| `make:transform <name>` | scaffold migration de transformation de donnees |
| `restore:auto [--backup=<file>]` | restaure un auto-backup |
| `backups:list [--json]` | liste les auto-backups |

Flags importants:

- `--pretend`
- `--allow-failed`
- `--step`
- `--steps=N` / `-s N`
- `--batch=N`
- `--seed`
- `--seeder=Name` / `--class=Name`
- `--pending`
- `--create=<table>`
- `--table=<table>`
- `--skip-auto-backup`
- `--allow-drift`
- `--backup=<file>`
- `--json`
- `--yes` / `-y`

Variables d'environnement utiles:

- `OUTLET_PRODUCTION_CONFIRM=1`
- `OUTLET_ALLOW_DRIFT=1`

## TypeScript

Le package publie des declarations dans [types/index.d.ts](types/index.d.ts). Les exemples TS sont dans:

- [examples/typescript-example.ts](examples/typescript-example.ts)
- [examples/typescript-migration.ts](examples/typescript-migration.ts)
- [examples/typescript-typed-model.ts](examples/typescript-typed-model.ts)

Exemple minimal:

```ts
import { Model, DatabaseConnection } from 'outlet-orm';

const db = new DatabaseConnection({ driver: 'mysql', host: 'localhost', database: 'app' });

class User extends Model {
  static readonly table = 'users';
  static readonly connection = db;
}
```

Note pratique: la declaration TypeScript couvre la majeure partie de la surface publique, mais les aides introduites tres recemment cote JavaScript doivent parfois etre verifiees aussi dans [src/QueryBuilder.js](src/QueryBuilder.js) et le [CHANGELOG.md](CHANGELOG.md) si vous utilisez les toutes dernieres additions de parite.

## Exemples et validation

Reperes utiles dans le depot:

- [examples/usage.js](examples/usage.js) : CRUD, relations, eager loading, pagination
- [examples/hidden-attributes-demo.js](examples/hidden-attributes-demo.js) : `hidden`, `withHidden`, `withoutHidden`
- [examples/nested-demo.js](examples/nested-demo.js) : relations imbriquees
- [examples/polymorphic-demo.js](examples/polymorphic-demo.js) : relations polymorphes
- [examples/relations-usage.js](examples/relations-usage.js) : relations classiques
- [examples/migrations](examples/migrations) : migrations de reference
- [examples/simplified-architecture](examples/simplified-architecture) : mini architecture d'exemple
- [labo/run.js](labo/run.js) : scenario runner laboratoire
- [tests](tests) : la cartographie comportementale la plus fiable du package

Commandes de validation du depot:

```bash
npm test --silent
```

```bash
npm run test:lab
```

```bash
npm run lint
```

## Notes utiles et limites

- Le package est tres large: pour un usage simple, commencez par `DatabaseConnection`, `Model`, `Schema`, `Migration` et `Seeder`.
- Les drivers SQL sont charges de maniere lazy: l'erreur d'absence de driver apparait au moment de la connexion, pas a l'installation du package principal.
- La CLI des migrations sait lire `database/config.js`, mais bascule aussi sur `.env` et `DATABASE_URL`.
- La couche API HTTP est independante de la couche SQL: vous pouvez utiliser l'une sans l'autre.
- La couche AI est optionnelle mais intimement integree aux workflows ORM, CLI et MCP.
- Les operations destructives sont volontairement plus strictes en production.
- Le changelog est dense et utile: [CHANGELOG.md](CHANGELOG.md) documente finement les ajouts par version, notamment v13+ pour l'API Layer, v14+ pour les migrations avancees et v15+ pour les helpers de compatibilite.

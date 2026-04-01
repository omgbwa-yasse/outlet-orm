# 📊 Étude Comparative : Prisma vs Laravel Eloquent vs Outlet ORM

> **Date** : Février 2026 | **Versions comparées** : Prisma 6.x, Laravel 11.x (Eloquent), Outlet ORM 6.5.0

---

## Table of Contents

- [1. Vue d'ensemble](#1-vue-densemble)
- [2. Installation & Configuration](#2-installation-configuration)
  - [Prisma](#prisma)
  - [Laravel Eloquent](#laravel-eloquent)
  - [Outlet ORM](#outlet-orm)
  - [Verdict installation](#verdict-installation)
- [3. Définition des modèles](#3-définition-des-modèles)
  - [Prisma — Modèle déclaratif (DSL)](#prisma-modèle-déclaratif-dsl)
  - [Laravel Eloquent — Active Record (PHP)](#laravel-eloquent-active-record-php)
  - [Outlet ORM — Active Record (JS/TS)](#outlet-orm-active-record-jsts)
  - [Verdict modèles](#verdict-modèles)
- [4. Requêtes & Query Builder](#4-requêtes-query-builder)
  - [Prisma](#prisma)
  - [Laravel Eloquent](#laravel-eloquent)
  - [Outlet ORM](#outlet-orm)
  - [Verdict Query Builder](#verdict-query-builder)
- [5. Relations](#5-relations)
  - [Points clés](#points-clés)
- [6. Migrations](#6-migrations)
  - [Prisma](#prisma)
  - [Eloquent](#eloquent)
  - [Outlet ORM](#outlet-orm)
  - [Verdict migrations](#verdict-migrations)
- [7. TypeScript & Typage](#7-typescript-typage)
- [8. Fonctionnalités avancées](#8-fonctionnalités-avancées)
- [9. Backup & Restore](#9-backup-restore)
- [10. Bases de données supportées](#10-bases-de-données-supportées)
- [11. Performances](#11-performances)
- [12. Écosystème & Outillage](#12-écosystème-outillage)
- [13. Courbe d'apprentissage](#13-courbe-dapprentissage)
- [14. Cas d'usage recommandés](#14-cas-dusage-recommandés)
  - [Choisir **Prisma** si :](#choisir-prisma-si)
  - [Choisir **Laravel Eloquent** si :](#choisir-laravel-eloquent-si)
  - [Choisir **Outlet ORM** si :](#choisir-outlet-orm-si)
- [15. Tableau récapitulatif final](#15-tableau-récapitulatif-final)
- [16. Conclusion](#16-conclusion)

---

## 1. Vue d'ensemble

| Critère | Prisma | Laravel Eloquent | Outlet ORM |
|---|---|---|---|
| **Langage** | TypeScript / JavaScript | PHP | JavaScript / TypeScript |
| **Runtime** | Node.js / Bun / Deno | PHP (FPM, Swoole, Octane) | Node.js |
| **Pattern** | Data Mapper + Client généré | Active Record | Active Record (inspiré Eloquent) |
| **Licence** | Apache 2.0 | MIT (via Laravel) | MIT |
| **Première release** | 2019 | 2013 (Laravel 4) | 2024 |
| **Package** | `prisma` + `@prisma/client` | Intégré à `laravel/framework` | `outlet-orm` |
| **Communauté** | ~40k ★ GitHub | ~80k ★ GitHub (Laravel) | Émergente |

---

## 2. Installation & Configuration

### Prisma

```bash
npm install prisma @prisma/client
npx prisma init
```

Crée un fichier `prisma/schema.prisma` (DSL propriétaire) + `.env` :

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

**Étape obligatoire** : `npx prisma generate` après chaque modification du schéma.

### Laravel Eloquent

```bash
composer create-project laravel/laravel my-app
# Eloquent est inclus dans Laravel
```

Configuration dans `.env` + `config/database.php` :

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=my_app
DB_USERNAME=root
DB_PASSWORD=secret
```

### Outlet ORM

```bash
npm install outlet-orm
npm install mysql2   # ou pg, sqlite3
outlet-init          # génère database/config.js
```

Configuration via `.env` (connexion automatique) :

```env
DB_CONNECTION=mysql
DB_HOST=localhost
DB_DATABASE=my_app
DB_USER=root
DB_PASSWORD=secret
```

### Verdict installation

| | Prisma | Eloquent | Outlet ORM |
|---|---|---|---|
| Complexité | Moyenne (generate requis) | Faible (intégré) | **Faible** (plug & play) |
| Fichiers de config | `schema.prisma` + `.env` | `.env` + `config/database.php` | `.env` seul |
| Temps de setup | ~5 min | ~2 min | **~1 min** |

---

## 3. Définition des modèles

### Prisma — Modèle déclaratif (DSL)

```prisma
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt     @map("updated_at")

  @@map("users")
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  userId   Int    @map("user_id")
  user     User   @relation(fields: [userId], references: [id])

  @@map("posts")
}
```

- Les modèles vivent **dans le schéma**, pas dans le code applicatif.
- Le client est **auto-généré** (typage complet, autocomplétion).
- Pas de logique métier dans les modèles (il faut un service layer).

### Laravel Eloquent — Active Record (PHP)

```php
class User extends Model
{
    protected $fillable = ['name', 'email'];
    protected $hidden = ['password'];
    protected $casts = ['email_verified_at' => 'datetime'];

    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }

    // Scope
    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
```

### Outlet ORM — Active Record (JS/TS)

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
  static fillable = ['name', 'email'];
  static hidden = ['password'];
  static casts = { email_verified_at: 'datetime' };
  static softDeletes = true;
  static rules = { email: 'required|email' };

  static scopes = {
    active: (query) => query.where('status', 'active')
  };

  posts() {
    return this.hasMany(Post, 'user_id');
  }
}
```

### Verdict modèles

| Capacité | Prisma | Eloquent | Outlet ORM |
|---|---|---|---|
| Pattern | Data Mapper | Active Record | Active Record |
| Logique métier dans le modèle | ❌ Non | ✅ Oui | ✅ Oui |
| Validation intégrée | ❌ (Zod externe) | ❌ (FormRequest) | ✅ `rules` built-in |
| Scopes | ❌ | ✅ | ✅ |
| Hidden attributes | ❌ (`omit` récent) | ✅ `$hidden` | ✅ `hidden` |
| Casts | ❌ (types schema) | ✅ `$casts` | ✅ `casts` |
| Fillable / Guarded | ❌ | ✅ | ✅ |
| Timestamps auto | ✅ (via `@updatedAt`) | ✅ | ✅ |
| Soft Deletes | ❌ (middleware soft) | ✅ `SoftDeletes` | ✅ `softDeletes` |

---

## 4. Requêtes & Query Builder

### Prisma

```typescript
// Lecture
const users = await prisma.user.findMany({
  where: { status: 'active', age: { gt: 18 } },
  include: { posts: true },
  orderBy: { name: 'asc' },
  take: 10,
  skip: 0
});

// Création
const user = await prisma.user.create({
  data: { name: 'John', email: 'john@example.com' }
});

// Update
await prisma.user.update({
  where: { id: 1 },
  data: { name: 'Jane' }
});

// Transaction
await prisma.$transaction([
  prisma.user.create({ data: { ... } }),
  prisma.post.create({ data: { ... } })
]);
```

**Style** : API orientée objet (JSON), pas de chaînage fluide.

### Laravel Eloquent

```php
// Lecture
$users = User::where('status', 'active')
    ->where('age', '>', 18)
    ->with('posts')
    ->orderBy('name')
    ->paginate(10);

// Création
$user = User::create(['name' => 'John', 'email' => 'john@example.com']);

// Update
User::where('id', 1)->update(['name' => 'Jane']);

// Transaction
DB::transaction(function () {
    User::create([...]);
    Post::create([...]);
});
```

### Outlet ORM

```javascript
// Lecture
const users = await User.where('status', 'active')
    .where('age', '>', 18)
    .with('posts')
    .orderBy('name')
    .limit(10)
    .get();

// Création
const user = await User.create({ name: 'John', email: 'john@example.com' });

// Update
await User.where('id', 1).update({ name: 'Jane' });

// Transaction
const db = Model.getConnection();
await db.transaction(async (trx) => {
    await User.useTransaction(trx).create({ ... });
    await Post.useTransaction(trx).create({ ... });
});
```

### Verdict Query Builder

| Fonctionnalité | Prisma | Eloquent | Outlet ORM |
|---|---|---|---|
| **Style** | JSON / objet | Fluent / chaîné | Fluent / chaîné |
| `where` chaîné | Via objets imbriqués | ✅ | ✅ |
| `orWhere` | `OR: [...]` | ✅ `.orWhere()` | ✅ `.orWhere()` |
| `whereIn` | `in: [...]` | ✅ | ✅ |
| `whereBetween` | `gte` + `lte` | ✅ | ✅ |
| `whereNull` / `whereNotNull` | `equals: null` | ✅ | ✅ |
| `whereExists` | Via sous-requête | ✅ | ✅ |
| `Raw SQL` | `$queryRaw` | `DB::raw()` | ✅ `RawExpression` |
| `select` colonnes | ✅ `select: {}` | ✅ | ✅ |
| `orderBy` | ✅ | ✅ | ✅ |
| `groupBy` / `having` | ✅ | ✅ | ✅ |
| `join` | ❌ (relations only) | ✅ | ✅ |
| `limit` / `offset` | `take` / `skip` | ✅ | ✅ |
| Pagination natif | `take` + `skip` + cursor | ✅ `paginate()` | `limit` + `offset` |
| Agrégats (`count`, `sum`, `avg`) | ✅ `_count`, `_sum`… | ✅ | ✅ |
| `increment` / `decrement` | ✅ `increment` | ✅ | ✅ |
| Sous-requêtes | ✅ (limité) | ✅ | ✅ |
| Courbe d'apprentissage | Moyenne | Faible (syntaxe PHP naturelle) | **Faible** (quasi identique Eloquent) |

---

## 5. Relations

| Type de relation | Prisma | Eloquent | Outlet ORM |
|---|---|---|---|
| One-to-One | ✅ | ✅ `hasOne` | ✅ `hasOne` |
| One-to-Many | ✅ | ✅ `hasMany` | ✅ `hasMany` |
| Many-to-Many | ✅ (relation implicite) | ✅ `belongsToMany` | ✅ `belongsToMany` |
| Inverse (belongsTo) | ✅ (`@relation`) | ✅ `belongsTo` | ✅ `belongsTo` |
| Has Many Through | ❌ (requête manuelle) | ✅ `hasManyThrough` | ✅ `hasManyThrough` |
| Has One Through | ❌ | ✅ `hasOneThrough` | ✅ `hasOneThrough` |
| Polymorphic One | ❌ (pas natif) | ✅ `morphOne` | ✅ `morphOne` |
| Polymorphic Many | ❌ | ✅ `morphMany` | ✅ `morphMany` |
| Polymorphic Inverse | ❌ | ✅ `morphTo` | ✅ `morphTo` |
| Eager Loading | ✅ `include` | ✅ `with()` | ✅ `with()` |
| Nested Eager | ✅ `include: { x: { include: ... } }` | ✅ `with('x.y')` | ✅ `with('x.y')` |
| Lazy Loading | ❌ (pas d'instance) | ✅ (accès propriété) | Via `load()` |
| Détection auto relations | ❌ | ❌ | ✅ **Exclusif** |

### Points clés

- **Prisma** ne supporte pas les relations **polymorphiques** ni **hasManyThrough** nativement. Il faut des requêtes manuelles ou des vues.
- **Outlet ORM** offre une **détection automatique des relations** par introspection du schéma DB — fonctionnalité unique absente de Prisma et Eloquent.
- **Eloquent** reste la référence en termes de variété de relations.

---

## 6. Migrations

### Prisma

```prisma
// Modifier schema.prisma, puis :
// npx prisma migrate dev --name add_email
// npx prisma migrate deploy (production)
```

- Détecte les diff automatiquement entre le schéma et la DB.
- Génère des fichiers SQL.
- Pas de rollback natif (migrations irréversibles par défaut).

### Eloquent

```bash
php artisan make:migration create_users_table
php artisan migrate
php artisan migrate:rollback
php artisan migrate:fresh
```

```php
Schema::create('users', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('email')->unique();
    $table->timestamps();
    $table->softDeletes();
});
```

### Outlet ORM

```bash
outlet-migrate make create_users_table
outlet-migrate          # Menu interactif
# ou : npm run migrate
```

```javascript
module.exports = {
  up: async (schema) => {
    await schema.createTable('users', (table) => {
      table.id();
      table.string('name');
      table.string('email').unique();
      table.timestamps();
      table.timestamp('deleted_at').nullable();
    });
  },
  down: async (schema) => {
    await schema.dropTableIfExists('users');
  }
};
```

### Verdict migrations

| Fonctionnalité | Prisma | Eloquent | Outlet ORM |
|---|---|---|---|
| Création CLI | ✅ | ✅ `artisan` | ✅ `outlet-migrate` |
| Schema Builder | ❌ (DSL Prisma) | ✅ `Blueprint` | ✅ `TableBuilder` |
| Rollback | ⚠️ Limité | ✅ | ✅ |
| Reset / Refresh / Fresh | ❌ `reset` | ✅ | ✅ |
| Status | ✅ `migrate status` | ✅ | ✅ |
| Diff automatique schema→DB | ✅ **Natif** | ❌ | ❌ |
| Batches de migration | ❌ | ✅ | ✅ |
| Seeds | ❌ (séparé) | ✅ `db:seed` | ✅ `outlet-migrate seed` |
| Reverse engineering | ✅ `db pull` | ❌ | ✅ `outlet-reverse` |

---

## 7. TypeScript & Typage

| Critère | Prisma | Eloquent | Outlet ORM |
|---|---|---|---|
| Support TypeScript | ✅ **Natif** (client généré) | ❌ PHP (pas de TS) | ✅ Types `.d.ts` |
| Typage auto des colonnes | ✅ Généré du schéma | N/A | Partiel (Generic `Model<T>`) |
| Autocomplétion colonnes | ✅ Complète | N/A (PHPStorm) | ✅ Via interface `TAttributes` |
| Type-safe relations | ✅ | N/A | ✅ (types génériques) |
| Migrations typées | ❌ (DSL) | N/A | ✅ `SchemaBuilder`, `TableBuilder` |

**Prisma** excelle en TypeScript grâce à son client auto-généré. Chaque colonne, relation et requête est typée automatiquement. **Outlet ORM** offre un bon support via des génériques manuels. **Eloquent** est PHP — pas comparable directement, mais Laravel offre d'excellents outils d'analyse statique avec PHPStan/Larastan.

---

## 8. Fonctionnalités avancées

| Fonctionnalité | Prisma | Eloquent | Outlet ORM |
|---|---|---|---|
| **Transactions** | ✅ `$transaction` | ✅ `DB::transaction` | ✅ `db.transaction()` |
| **Soft Deletes** | ⚠️ Middleware | ✅ Natif | ✅ Natif |
| **Events / Hooks** | ❌ (middleware) | ✅ `creating`, `saving`… | ✅ `beforeSave`, `afterSave`… |
| **Scopes** | ❌ | ✅ Global + Local | ✅ Global + Local |
| **Validation intégrée** | ❌ | ⚠️ FormRequest (hors ORM) | ✅ **Intégrée au modèle** |
| **Query Logging** | ✅ `$on('query')` | ✅ `DB::listen()` | ✅ `enableQueryLog()` |
| **Mass assignment protection** | ❌ (tout accessible) | ✅ `$fillable` / `$guarded` | ✅ `fillable` |
| **Attributs cachés** | ⚠️ `omit` (récent) | ✅ `$hidden` | ✅ `hidden` |
| **Pagination** | Cursor + Offset | ✅ `paginate()` | Offset (`limit`/`offset`) |
| **Connection pooling** | ✅ (Prisma Accelerate) | ❌ (PHP cycle requête) | ✅ (pool natif Node.js) |

---

## 9. Backup & Restore

| Fonctionnalité | Prisma | Eloquent | Outlet ORM |
|---|---|---|---|
| **Backup intégré** | ❌ | ❌ | ✅ **BackupManager** |
| **Backup partiel** (tables) | ❌ | ❌ | ✅ `tables: [...]` |
| **Backup journal** (incrémental) | ❌ | ❌ | ✅ `type: 'journal'` |
| **Restore** | ❌ | ❌ | ✅ `restore()` auto-decrypt |
| **Planification** | ❌ | ❌ (via cron OS) | ✅ **BackupScheduler** |
| **Chiffrement AES-256-GCM** | ❌ | ❌ | ✅ **BackupEncryption** |
| **Démon TCP distant** | ❌ | ❌ | ✅ **BackupSocketServer** |
| **Client distant** | ❌ | ❌ | ✅ **BackupSocketClient** |

> 💡 **Le système de backup est une exclusivité d'Outlet ORM.** Ni Prisma ni Eloquent ne proposent de solution intégrée — ils dépendent d'outils externes (`pg_dump`, `mysqldump`, Laravel Backup de Spatie, etc.).

---

## 10. Bases de données supportées

| Base de données | Prisma | Eloquent | Outlet ORM |
|---|---|---|---|
| **MySQL / MariaDB** | ✅ | ✅ | ✅ |
| **PostgreSQL** | ✅ | ✅ | ✅ |
| **SQLite** | ✅ | ✅ | ✅ |
| **SQL Server** | ✅ | ✅ | ❌ |
| **MongoDB** | ✅ (Prisma) | ⚠️ (via package) | ❌ |
| **CockroachDB** | ✅ | ❌ | ❌ |
| **PlanetScale** | ✅ | ⚠️ (via MySQL) | ⚠️ (via MySQL) |

---

## 11. Performances

| Critère | Prisma | Eloquent | Outlet ORM |
|---|---|---|---|
| **Engine** | Rust (Query Engine binaire) | PHP (interprété) | JavaScript (V8 JIT) |
| **Connection pooling** | ✅ (Prisma Accelerate) | Non persistant (requête PHP) | ✅ Pool natif Node.js |
| **N+1 prévention** | ✅ (include déclaratif) | ⚠️ (discipline `with()`) | ⚠️ (discipline `with()`) |
| **Latence cold start** | ⚠️ (generate + engine binaire) | ⚠️ (boot framework) | ✅ **Faible** (léger) |
| **Concurrence** | ✅ Event loop Node.js | ⚠️ (1 requête/process) | ✅ Event loop Node.js |
| **Overhead mémoire** | Moyen (engine Rust séparé) | Moyen (framework complet) | **Faible** (zéro dépendance lourde) |

---

## 12. Écosystème & Outillage

| Outil | Prisma | Eloquent | Outlet ORM |
|---|---|---|---|
| **CLI** | `prisma` (migrate, generate, studio) | `artisan` (make, migrate, tinker) | `outlet-init`, `outlet-migrate`, `outlet-reverse`, `outlet-convert` |
| **GUI** | ✅ Prisma Studio | ❌ (Tinker CLI) | ❌ |
| **Introspection DB** | ✅ `prisma db pull` | ❌ | ✅ `outlet-reverse` |
| **ORM Studio / Playground** | ✅ | ❌ | ❌ |
| **Seeding** | Script libre | ✅ Factories + Seeders | ✅ Seeders |
| **Factories (fake data)** | ❌ | ✅ **Exceptionnel** (Faker) | ❌ |
| **Packages communautaires** | Nombreux | **Très nombreux** (Spatie, etc.) | Émergent |

---

## 13. Courbe d'apprentissage

```
Facilité d'apprentissage (plus haut = plus facile)

     │
  5  │  ████████████████████████  Outlet ORM (syntaxe Eloquent en JS)
     │
  4  │  ██████████████████████    Eloquent (PHP familier)
     │
  3  │  ██████████████            Prisma (DSL + generate + concepts DataMapper)
     │
  2  │
     │
  1  │
     └──────────────────────────
```

- **Outlet ORM** : Si vous connaissez Eloquent, la transition est quasi immédiate. API JavaScript fidèle à Eloquent.
- **Eloquent** : Très intuitif en PHP, documentation exemplaire, conventions fortes.
- **Prisma** : Concepts nouveaux (schema DSL, generate, Data Mapper), courbe plus raide mais typage excellent.

---

## 14. Cas d'usage recommandés

### Choisir **Prisma** si :
- 🎯 Projet TypeScript-first avec typage strict essentiel
- 🎯 Équipe qui préfère le pattern Data Mapper (pas de logique dans les modèles)
- 🎯 Besoin de supporter MongoDB ou CockroachDB
- 🎯 Prisma Studio pour exploration visuelle de la DB
- 🎯 Grande équipe avec besoin d'un schéma centralisé comme source de vérité

### Choisir **Laravel Eloquent** si :
- 🎯 Projet PHP / Laravel (le choix naturel)
- 🎯 Besoin d'un écosystème mature avec factories, policies, events, jobs
- 🎯 Application monolithique avec front-end Blade/Inertia
- 🎯 Équipe PHP expérimentée
- 🎯 Relations polymorphiques complexes

### Choisir **Outlet ORM** si :
- 🎯 Projet Node.js qui veut la **syntaxe Eloquent en JavaScript**
- 🎯 Migration d'un backend Laravel vers Node.js (API familière)
- 🎯 Besoin de **backup intégré** (chiffré, planifié, distant)
- 🎯 Setup minimal sans build step (pas de `generate` ni framework)
- 🎯 Projet léger qui n'a pas besoin d'un framework complet
- 🎯 Besoin de **détection automatique des relations** depuis le schéma DB
- 🎯 Validation intégrée au modèle (sans FormRequest ou Zod externe)

---

## 15. Tableau récapitulatif final

| Critère | Prisma | Eloquent | Outlet ORM |
|---|---|---|---|
| **Langage** | TS/JS | PHP | JS/TS |
| **Pattern** | Data Mapper | Active Record | Active Record |
| **Facilité de prise en main** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Typage TypeScript** | ⭐⭐⭐⭐⭐ | N/A | ⭐⭐⭐⭐ |
| **Relations** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Query Builder** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Migrations** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Validation** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Backup** | ⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| **Écosystème** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Performances** | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **BDD supportées** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Maturité** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 16. Conclusion

| ORM | Forces principales | Faiblesses principales |
|---|---|---|
| **Prisma** | Typage TS auto-généré exceptionnel, multi-DB (Mongo, CockroachDB), Prisma Studio, schema comme source de vérité | Pas de relations polymorphiques, pas de soft deletes natif, build step obligatoire, pas d'Active Record |
| **Eloquent** | Écosystème le plus riche, relations complètes, factories, conventions matures, communauté massive | PHP uniquement, pas de connection pooling persistant, pas de backup intégré |
| **Outlet ORM** | Syntaxe Eloquent en JS, backup intégré chiffré + distant, validation intégrée, zero config, détection auto des relations, léger | Écosystème jeune, moins de BDD supportées, pas de GUI, pas de factories |

**Outlet ORM** se positionne comme le **pont entre l'élégance d'Eloquent et l'écosystème Node.js**, avec des fonctionnalités exclusives (backup chiffré intégré, détection automatique des relations) qui le distinguent de Prisma et Eloquent.

---

*Rapport généré le 26 février 2026 — Outlet ORM v6.0.0*

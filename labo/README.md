# Labo Outlet ORM

Ce dossier contient une mini application de laboratoire pour exercer le coeur d'Outlet ORM en local, sans service externe.

## Objectif

Le labo couvre les surfaces fonctionnelles principales documentees du package, avec une execution deterministe sur SQLite.

Blocs couverts par le runner:

- Schema builder et creation des tables
- Helpers de migration (`addColumnIfMissing`, `dropColumnIfExists`, `dropForeignIfExists`)
- Active Record CRUD
- Validation, casts et attributs caches
- Query builder (`where*`, `count`, `exists`, `increment`, `paginate`)
- Relations (`hasOne`, `hasMany`, `belongsTo`, `belongsToMany`, `hasManyThrough`, `hasOneThrough`, polymorphiques)
- Eager loading, `whereHas`, `whereDoesntHave`, `withCount`
- Scopes locaux et globaux
- Soft deletes et `restore()`
- Events / observers
- Transactions
- API layer via `MockAdapter`
- Backup manager (`full`, `journal`, `restore`)
- Reverse / CLI core (`parseCreateTable`, `generateMigration`, `reverseFromSql`)
- AI local surfaces (`AISafetyGuardrails`, `PromptGenerator`, `MCPServer` en mode programmatique)

Cela couvre plus de 90% des fonctionnalites coeur testables en local. Les surfaces suivantes restent volontairement hors du labo principal parce qu'elles dependent d'un environnement externe ou d'un moteur specifique:

- Providers AI externes et appels reseau reels
- CLI interactif (prompts stdin/stdout complets)
- Realtime HTTP/WebSocket
- Database objects avances selon moteur (procedures, fonctions, triggers reseau)
- Backup socket daemon / client reseau

## Integration Jest / CI

Le labo est aussi executable dans Jest via [tests/Labo.test.js](c:/wamp64_New/www/packages/outlet-orm/tests/Labo.test.js). Comme ce fichier est sous `tests/`, il est deja inclus dans `npm test` et donc dans le workflow CI existant.

Pour lancer uniquement cette verification:

```bash
npm run test:lab
```

## Lancer le labo

Depuis la racine du package:

```bash
npm run lab
```

Pour conserver la base SQLite entre deux executions:

```bash
node labo/run.js --keep-data
```

## Fichiers generes

- `labo/data/lab.sqlite` : base SQLite du labo
- `labo/data/backups/` : sauvegardes generees par le scenario backup

Le dossier `labo/data/` est ignore par Git.

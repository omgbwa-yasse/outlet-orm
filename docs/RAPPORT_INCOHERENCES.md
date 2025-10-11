# Rapport des incohérences – outlet-orm v1.0.0

Date: 11/10/2025
Auteur: Audit automatisé

Ce rapport recense les incohérences fonctionnelles, techniques et documentaires détectées dans le package. Chaque point inclut la sévérité, l’impact potentiel, la preuve (fichier/ligne) et une recommandation concrète.

---

## 1) Incohérences fonctionnelles (impact exécution)

- [Haut] Alias driver PostgreSQL non géré partout
  - Constat: Le code accepte `postgres` et `postgresql` dans plusieurs endroits (DatabaseConnection, types) mais certaines parties critiques (Schema, Migrations) ne gèrent que `postgres`.
  - Preuves:
    - types/index.d.ts: driver: 'mysql' | 'postgres' | 'postgresql' | 'sqlite'
    - src/DatabaseConnection.js: switch gère 'postgres' et 'postgresql'
    - lib/Schema/Schema.js: switch gère 'postgres' mais PAS 'postgresql' (ex: hasTable)
    - lib/Migrations/MigrationManager.js: getAllTables() gère 'postgres' mais PAS 'postgresql'
  - Impact: Erreurs "Unsupported driver: postgresql" lors des vérifications de schéma/migrations si l’app est configurée avec `postgresql`.
  - Recommandation: Aligner Schema/MigrationManager sur DatabaseConnection en ajoutant le case 'postgresql' comme alias de 'postgres'.

- [Haut] SQL de renommage de table non portable
  - Constat: Schema.rename() utilise `RENAME TABLE` (spécifique MySQL).
  - Preuves: lib/Schema/Schema.js → `async rename(from, to) { const sql = `RENAME TABLE ${from} TO ${to}`; ... }`
  - Impact: Échec sur PostgreSQL/SQLite (syntaxe valide: `ALTER TABLE <from> RENAME TO <to>`).
  - Recommandation: Implémenter un switch par driver:
    - MySQL: `RENAME TABLE from TO to`
    - PostgreSQL/SQLite: `ALTER TABLE from RENAME TO to`

- [Moyen] Scripts npm non portables (Windows/PowerShell)
  - Constat: package.json utilise des pipes d’echo empilés pour piloter l’outil interactif.
  - Preuves: package.json → "migrate:rollback": "echo 2 | echo 1 | node bin/migrate.js"
  - Impact: Non-fonctionnel sous PowerShell; peu fiable cross-platform.
  - Recommandation: Ajouter des flags non-interactifs à bin/migrate.js (ex: `node bin/migrate.js rollback --steps 1`) et adapter les scripts npm.

---

## 2) Incohérences d’API/contrats

- [Moyen] Nom du driver dans la documentation et les prompts CLI
  - Constat: La doc montre `driver: 'postgres'` tandis que le CLI demande "mysql/postgresql/sqlite".
  - Preuves:
    - README/QUICKSTART: exemples avec `driver: 'postgres'`
    - bin/convert.js: prompt → "Driver (mysql/postgresql/sqlite):"
  - Impact: Confusion côté utilisateur; peut conduire à configurer `postgresql` et heurter les points non compatibles (cf. 1).
  - Recommandation: Normaliser sur `postgres` côté docs et prompts, tout en continuant d’accepter `postgresql` en alias côté code.

---

## 3) Incohérences documentaire/packaging

- [Moyen] Nom du package
  - Constat: La doc mentionne encore `@eloquent-js/orm` à l’installation.
  - Preuves: docs/QUICKSTART.md → `npm install @eloquent-js/orm sqlite3`
  - Impact: Installation erronée pour les utilisateurs; package réel est `outlet-orm`.
  - Recommandation: Remplacer toutes les mentions `@eloquent-js/orm` par `outlet-orm`. Lister les drivers additionnels: `mysql2`, `pg`, `sqlite3` selon le SGBD.

- [Faible] Incohérences mineures Markdown (lint)
  - Constat: Nombreuses alertes MD0xx (blanks-around-lists, fenced-code-language, headings, ordered-list prefix).
  - Preuves: Outil de lint a signalé >100 avertissements (README.md, ARCHITECTURE.md, QUICKSTART.md, etc.).
  - Impact: Qualité de lecture/présentation sur npm/github.
  - Recommandation: Normaliser les listes et entourages, ajouter la langue aux blocs de code (```js), éviter les titres en italique.

- [Faible] Fichier ANALYSE_FONCTIONNEMENT.md manquant/instable
  - Constat: Le fichier a été généré puis n’est plus lisible (supprimé ou déplacé).
  - Impact: Documentation d’analyse introuvable.
  - Recommandation: Re-générer et ajouter au repo, corriger le lint Markdown.

---

## 4) Preuves et extraits clés

- lib/Schema/Schema.js – drivers gérés dans hasTable(): 'mysql' | 'postgres' | 'sqlite' (pas 'postgresql')
- lib/Migrations/MigrationManager.js – getAllTables(): 'mysql' | 'postgres' | 'sqlite' (pas 'postgresql')
- src/DatabaseConnection.js – gère 'postgres' ET 'postgresql' de manière uniforme
- docs/QUICKSTART.md – installation avec `@eloquent-js/orm` (obsolète)
- bin/convert.js – prompt demande `postgresql` tandis que README montre `postgres`
- package.json – scripts `echo 2 | echo 1 | ...` non portables

---

## 5) Plan de remédiation proposé (rapide et sûr)

1. Unifier la gestion du driver PostgreSQL
   - [Code] lib/Schema/Schema.js: ajouter `case 'postgresql':` aux switch (mêmes clauses que `postgres`).
   - [Code] lib/Migrations/MigrationManager.js: idem pour `getAllTables()` et tout switch similaire.
   - [Docs/CLI] Remplacer les mentions "postgresql" par "postgres" dans les prompts et docs, conserver l’alias dans le code.

2. Rendre `Schema.rename()` portable
   - [Code] Implémenter:
     - MySQL → `RENAME TABLE from TO to`
     - Postgres/SQLite → `ALTER TABLE from RENAME TO to`

3. Scripts npm non-interactifs
   - [Code] Ajouter des options CLI à bin/migrate.js (ex: `--action=rollback --steps=1`) pour scripter sans `echo`.
   - [package.json] Mettre à jour `migrate:*` pour appeler ces flags cross-platform.

4. Documentation
   - [Docs] Remplacer `@eloquent-js/orm` par `outlet-orm` dans QUICKSTART, autres docs.
   - [Docs] Corriger les erreurs Markdown (entourages de listes, langues de blocs de code, titres).

---

## 6) Priorisation

- P1: Drivers PostgreSQL alignés partout (éviter erreurs runtime)
- P1: `Schema.rename()` multi-SGBD
- P2: Scripts npm non-interactifs cross-platform
- P3: Unification docs/prompts + lint Markdown

---

## 7) Checklist d’implémentation

- [ ] Schema: support 'postgresql' dans tous les switch
- [ ] MigrationManager: support 'postgresql'
- [ ] Schema.rename(): switch par driver
- [ ] bin/convert.js: prompt → "mysql/postgres/sqlite"
- [ ] docs: remplacer `@eloquent-js/orm` → `outlet-orm`
- [ ] package.json: scripts `migrate:*` sans echo
- [ ] Corriger lint Markdown (README, ARCHITECTURE, QUICKSTART, etc.)

---

## 8) Notes finales

Le cœur ORM (Model, QueryBuilder, DatabaseConnection, Relations) est cohérent et robuste. Les incohérences concernent principalement:
- le support homogène du driver PostgreSQL,
- la portabilité SQL d’une opération de schéma (rename),
- l’ergonomie CLI/scripts,
- et la cohérence documentaire.

Ces correctifs sont ciblés, à faible risque, et amélioreront significativement l’expérience utilisateur et la fiabilité multi-bases.

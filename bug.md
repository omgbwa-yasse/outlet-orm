# Outlet ORM v5.0.0 — Bugs & Identified anomalies (24 au total)

> Report from la migration du projet **Le Continent** (46 tables, 11 files de migration)
> et d'une in-depth analysis de **the entire source code** d'outlet-orm.
> Date : Février 2026

---

## Summary

| # | Severity | File | Bug | Impact |
|---|----------|---------|-----|--------|
| 1 | 🔴 Critical | Schema.js | `foreignId().constrained()` ne fonctionne pas | Toutes les FK en syntaxe simplifiée échouent |
| 2 | 🔴 Critical | Schema.js | Shadowing `this.onDelete` / `this.onUpdate` | `cascadeOnDelete()` et `onDelete()` inutilisables |
| 3 | 🔴 Critical | Schema.js | Shadowing `this.references` | `references()` method inutilisable |
| 4 | 🟠 Major | Schema.js | Pas de backticks sur les table names | Mots réservés MySQL (`groups`, `events`, etc.) provoquent des erreurs SQL |
| 5 | 🟡 Minor | Docs | Documentation incohérente avec l'implémentation | Les exemples officiels utilisent des patterns cassés |
| 6 | 🟠 Major | Schema.js | `rename()` — backticks manquants | Renommage de tables avec mots réservés échoue |
| 7 | 🔴 Critical | Schema.js | Injection SQL dans `hasTable()` / `hasColumn()` | Interpolation de string non paramétrée |
| 8 | 🔴 Critical | Schema.js | `renameColumn` — syntaxe CHANGE incomplete | ALTER TABLE CHANGE échoue systématiquement |
| 9 | 🟠 Major | Schema.js | `formatDefaultValue()` — no quote escaping | Default values with apostrophes break SQL |
| 10 | 🟡 Minor | Schema.js | `constrained()` — pluralisation naïve | `category_id` → `categorys` au lieu de `categories` |
| 11 | 🟠 Major | Schema.js | Column names without backticks in generated SQL | Columns named with reserved words fail |
| 12 | 🟠 Major | DatabaseConn. | `buildSelectQuery()` — colonnes non assainies | Colonnes SELECT, JOIN, ORDER BY sans sanitization |
| 13 | 🟡 Minor | DatabaseConn. | `buildWhereClause()` — opérateur non validé | L'opérateur WHERE est injecté tel quel dans le SQL |
| 14 | 🟠 Major | DatabaseConn. | `select()` vs `update()` — incohérence de placeholder | `select()` ne convertit pas les placeholders pour Postgres |
| 15 | 🟡 Minor | DatabaseConn. | Fuite potentielle de connection transactionnelle | Si `commit()` échoue après `release()`, la connection est perdue |
| 16 | 🟠 Major | Model.js | `eventListeners` partagé entre classes filles | Propriété statique partagée — les listeners polluent tous les models |
| 17 | 🟡 Minor | Model.js | `hasOne`/`hasMany` — pluralisation naïve dans foreignKey Default | `table.slice(0, -1) + '_id'` échoue pour les tables non suffixées en 's' |
| 18 | 🟡 Minor | Model.js | `fill()` avec `fillable = []` accepte tout | Pas de protection mass-assignment si `fillable` non défini |
| 19 | 🟠 Major | Model.js | `static delete()` sans WHERE supprime tout | `Model.delete()` envoie une requête DELETE sans condition |
| 20 | 🟡 Minor | QueryBuilder | `withCount()` — sous-requête sans backticks ni échappement | Les table names dans les COUNT sont unprotecteds |
| 21 | 🟡 Minor | QueryBuilder | `paginate()` — double application des scopes | `_applyGlobalScopes()` appelé dans `count()` puis dans `get()` |
| 22 | 🟡 Minor | BelongsToMany | `withTimestamps()` — conflit method/propriété | La propriété `this.withTimestamps = false` masque la method `withTimestamps()` |
| 23 | 🟡 Minor | MigrationMgr | `getLastBatchMigrations()` — injection SQL dans `steps` | Le paramètre `steps` est interpolé directement dans le SQL |
| 24 | 🟡 Minor | QueryBuilder | `clone()` ne copie pas `_showHidden`, `_withTrashed`, etc. | Le clone perd les flags de soft-delete et hidden |

---

## Bug 1 — `foreignId().constrained()` ne fonctionne pas

### Description

La method `foreignId(column)` retourne un objet `ColumnDefinition`, mais `constrained()` est définie uniquement sur la classe `ForeignKeyDefinition`. L'appel chaîné `table.foreignId('user_id').constrained()` provoque donc une erreur :

```
TypeError: table.foreignId(...).constrained is not a function
```

### Source file

`node_modules/outlet-orm/src/Schema/Schema.js`, ligne ~316 :

```javascript
foreignId(columnName) {
    const column = new ColumnDefinition(columnName, 'BIGINT');
    column.unsigned();
    this.columns.push(column);
    return column;  // ← Retourne ColumnDefinition, PAS ForeignKeyDefinition
}
```

### Syntaxe documentée (NE FONCTIONNE PAS)

```javascript
table.foreignId('user_id').constrained().cascadeOnDelete();
```

### Contournement appliqué

Séparer en deux appels distincts :

```javascript
table.foreignId('user_id');                              // Crée la colonne BIGINT UNSIGNED
table.foreign('user_id').constrained().cascadeOnDelete(); // Crée la contrainte FK séparément
```

### Recommandation

Modifier `foreignId()` pour retourner un objet hybride qui expose à la fois les methods de `ColumnDefinition` et un accès à `constrained()` :

```javascript
foreignId(columnName) {
    const column = new ColumnDefinition(columnName, 'BIGINT');
    column.unsigned();
    this.columns.push(column);

    // Ajouter constrained() sur le ColumnDefinition retourné
    column.constrained = (table = null) => {
        const fk = this.foreign(columnName);
        return fk.constrained(table);
    };

    return column;
}
```

---

## Bug 2 — Shadowing `this.onDelete` / `this.onUpdate`

### Description

Dans le constructeur de `ForeignKeyDefinition`, les propriétés `this.onDelete = null` et `this.onUpdate = null` masquent (shadow) les methods du même nom définies sur le prototype. Résultat : appeler `cascadeOnDelete()` qui fait `this.onDelete('cascade')` échoue car `this.onDelete` est `null` et non une fonction.

```
TypeError: this.onDelete is not a function
```

### Source file

`node_modules/outlet-orm/src/Schema/Schema.js`, ligne ~740 :

```javascript
class ForeignKeyDefinition {
  constructor(column) {
    this.column = column;
    this.references = { table: null, column: 'id' }; // ← Bug 3 aussi
    this.onDelete = null;   // ← Masque la method onDelete()
    this.onUpdate = null;   // ← Masque la method onUpdate()
    this.name = null;
  }

  onDelete(action) {           // ← Jamais appelable car masquée
    this.onDelete = action.toUpperCase();
    return this;
  }

  cascadeOnDelete() {
    return this.onDelete('cascade');  // ← TypeError: this.onDelete is not a function
  }
}
```

### Contournement appliqué

Patch du file source : renommer les propriétés internes en `this.deleteAction` et `this.updateAction` pour éviter le conflit avec les methods.

### Recommandation

Renommer les propriétés de stockage interne pour éviter le conflit :

```javascript
class ForeignKeyDefinition {
  constructor(column) {
    this.column = column;
    this._references = { table: null, column: 'id' };
    this._onDeleteAction = null;   // Pas de conflit
    this._onUpdateAction = null;   // Pas de conflit
    this.name = null;
  }

  onDelete(action) {
    this._onDeleteAction = action.toUpperCase();
    return this;
  }

  onUpdate(action) {
    this._onUpdateAction = action.toUpperCase();
    return this;
  }

  cascadeOnDelete() {
    return this.onDelete('cascade');  // ✓ Fonctionne maintenant
  }

  cascadeOnUpdate() {
    return this.onUpdate('cascade');  // ✓ Fonctionne maintenant
  }
}
```

---

## Bug 3 — Shadowing `this.references`

### Description

Même problème que le Bug 2 : la propriété `this.references = { table: null, column: 'id' }` dans le constructeur masque la method `references(column)`. Appeler `.references('id')` retourne l'objet `{ table, column }` au lieu d'run la method.

```
TypeError: table.foreign(...).references is not a function
```

### Syntaxe affectée

```javascript
// NE FONCTIONNE PAS :
table.foreign('user_id').references('id').on('users');

// FONCTIONNE (car constrained() n'a pas ce problème) :
table.foreign('user_id').constrained('users');
```

### Contournement appliqué

Utiliser exclusivement `constrained(tableName)` au lieu de `references().on()`.

### Recommandation

Renommer la propriété interne en `this._ref` ou `this.refConfig` :

```javascript
constructor(column) {
    this.column = column;
    this._ref = { table: null, column: 'id' };  // Ne masque plus references()
}

references(column) {
    this._ref.column = column;
    return this;
}
```

---

## Bug 4 — Absence de backticks sur les table names

### Description

Le Schema Builder Generates du SQL sans encadrer les table names avec des backticks. Les tables portant un nom qui est un mot réservé MySQL (comme `groups`, `events`, `references`, `order`, etc.) provoquent une erreur de syntaxe SQL :

```
Erreur de syntaxe près de 'groups (
  id BIGINT UNSIGNED AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL, ...'
```

### Zones affectées dans le code source

| Zone | Code original | Code corrigé |
|------|--------------|--------------|
| `toCreateSql()` | `` CREATE TABLE ${this.tableName} `` | `` CREATE TABLE \`${this.tableName}\` `` |
| `toAlterSql()` | `` ALTER TABLE ${this.tableName} `` | `` ALTER TABLE \`${this.tableName}\` `` |
| `getConstraints()` | `` REFERENCES ${fk.ref.table} `` | `` REFERENCES \`${fk.ref.table}\` `` |
| `drop()` | `` DROP TABLE ${tableName} `` | `` DROP TABLE \`${tableName}\` `` |
| `dropIfExists()` | `` DROP TABLE IF EXISTS ${tableName} `` | `` DROP TABLE IF EXISTS \`${tableName}\` `` |
| `rename()` | `` RENAME TABLE ${from} TO ${to} `` | `` RENAME TABLE \`${from}\` TO \`${to}\` `` |
| FK `ALTER TABLE` | `` REFERENCES ${fk.ref.table}(${fk.ref.column}) `` | `` REFERENCES \`${fk.ref.table}\`(${fk.ref.column}) `` |

### Contournement appliqué

Patch du file `Schema.js` pour ajouter les backticks partout.

### Recommandation

Implémenter un identifiant-quoter dépendant du driver :

```javascript
quoteIdentifier(name) {
    switch (this.driver) {
        case 'mysql':
            return '`' + name.replace(/`/g, '``') + '`';
        case 'postgres':
            return '"' + name.replace(/"/g, '""') + '"';
        case 'sqlite':
            return '"' + name + '"';
        default:
            return name;
    }
}
```

Et l'use systématiquement dans toute la génération SQL.

---

## Bug 5 — Documentation incohérente

### Description

La documentation officielle (files `MIGRATIONS.md`, `API.md`, `SKILL.md`) présente des exemples qui ne fonctionnent pas en raison des bugs 1, 2 et 3.

### Exemples documentés mais cassés

| Documentation | Syntaxe | Statut |
|---------------|---------|--------|
| `MIGRATIONS.md` § Complete Example | `table.foreignId('user_id').constrained().cascadeOnDelete()` | ❌ Bug 1 |
| `MIGRATIONS.md` § Simplified Syntax | `table.foreignId('user_id').constrained()` | ❌ Bug 1 |
| `MIGRATIONS.md` § Explicit Syntax | `table.foreign('user_id').references('id').on('users')` | ❌ Bug 3 |
| `MIGRATIONS.md` § Cascade Options | `table.foreign('user_id')...cascadeOnDelete()` | ❌ Bug 2 |
| `API.md` § Foreign Keys | `constrained(table?)` — Simplified FK | ❌ Bug 1 (via foreignId) |

### Recommandation

Après correction des bugs, mettre à jour la documentation **et** ajouter des Integration tests couvrant les patterns :

```javascript
// Test 1 : Syntaxe simplifiée chaînée
table.foreignId('user_id').constrained().cascadeOnDelete();

// Test 2 : Syntaxe explicite
table.foreign('user_id').references('id').on('users').onDelete('CASCADE');

// Test 3 : Table avec mot réservé
await schema.create('groups', (table) => { ... });

// Test 4 : FK vers une table avec mot réservé
table.foreign('group_id').constrained('groups').cascadeOnDelete();
```

---

## Anomalies supplémentaires identifiées par in-depth analysis du code source

Les anomalies 6 à 24 ci-dessous ont été identifiées par une revue systématique de **tous les files source** d'outlet-orm v5.0.0 :
- `Schema/Schema.js` (791 lignes)
- `DatabaseConnection.js` (1052 lignes)
- `Model.js` (1119 lignes)
- `QueryBuilder.js` (795 lignes)
- `Migrations/Migration.js` + `MigrationManager.js` (327 lignes)
- `Relations/` (10 files, ~1500 lignes)

---

## Bug 6 — `rename()` — backticks manquants

### Severity : 🟠 Major

### Description

La method `Schema.rename(from, to)` Generates du SQL sans backticks autour des table names, même après le patch appliqué pour le Bug 4 (le patch ne couvrait que `create`, `drop`, `dropIfExists`, `toCreateSql`, `toAlterSql` et `getConstraints`).

### Source file

`Schema/Schema.js`, lignes ~56-69 :

```javascript
async rename(from, to) {
    switch (driver) {
      case 'mysql':
        sql = `RENAME TABLE ${from} TO ${to}`;        // ← Pas de backticks !
        break;
      case 'postgres':
      case 'sqlite':
        sql = `ALTER TABLE ${from} RENAME TO ${to}`;   // ← Pas de backticks !
    }
}
```

### Impact

Renommer une table dont le nom est un mot réservé MySQL (`RENAME TABLE groups TO old_groups`) provoque une erreur de syntaxe.

### Recommandation

```javascript
sql = `RENAME TABLE \`${from}\` TO \`${to}\``;
```

---

## Bug 7 — Injection SQL dans `hasTable()` / `hasColumn()`

### Severity : 🔴 Critical

### Description

Les methods `Schema.hasTable(tableName)` et `Schema.hasColumn(tableName, columnName)` utilisent l'interpolation de chaîne directe pour insérer les noms dans la requête SQL, au lieu d'use des queries paramétrées. Ironiquement, `DatabaseConnection.js` fournit une fonction `sanitizeIdentifier()` qui n'est jamais utilisée par le Schema Builder.

### Source file

`Schema/Schema.js`, lignes ~106-155 :

```javascript
// hasTable :
sql = `SELECT COUNT(*) as count FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = '${tableName}'`;
//                                                       ^^^^^^^^^^^
//                            Interpolation directe — injection SQL possible

// hasColumn :
sql = `...AND table_name = '${tableName}' AND column_name = '${columnName}'`;
//                          ^^^^^^^^^^^                       ^^^^^^^^^^^^
```

### Impact

Si `tableName` ou `columnName` proviennent d'une entrée utilisateur (par exemple dans un outil d'admin dynamique), un attaquant pourrait injecter du SQL arbitraire.

### Recommandation

Utiliser des queries paramétrées :

```javascript
async hasTable(tableName) {
    const sql = `SELECT COUNT(*) as count FROM information_schema.tables
                 WHERE table_schema = DATABASE() AND table_name = ?`;
    const result = await this.connection.execute(sql, [tableName]);
    return result[0].count > 0;
}
```

---

## Bug 8 — `renameColumn` — syntaxe MySQL CHANGE incomplete

### Severity : 🔴 Critical

### Description

La commande `renameColumn` dans `Blueprint.toAlterSql()` Generates un SQL `CHANGE` incomplet. En MySQL, `ALTER TABLE ... CHANGE old_name new_name` **exige** la définition du type de colonne après le nouveau nom. Sans elle, MySQL retourne une erreur de syntaxe.

### Source file

`Schema/Schema.js`, ligne ~491 :

```javascript
case 'renameColumn':
    statements.push(`ALTER TABLE \`${this.tableName}\` CHANGE ${command.from} ${command.to}`);
    //                                                   ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //                                     Manque la définition de type après le nouveau nom
    break;
```

### Syntaxe MySQL attendue

```sql
-- Attendu :
ALTER TABLE `users` CHANGE old_name new_name VARCHAR(255) NOT NULL;
-- Generated:
ALTER TABLE `users` CHANGE old_name new_name;  -- ← ERREUR SYNTAXE
```

### Impact

`renameColumn()` est inutilisable sur MySQL. L'appel provoquera toujours une erreur.

### Recommandation

Pour MySQL, use `RENAME COLUMN` (≥ MySQL 8.0) qui ne nécessite pas la définition du type :

```javascript
case 'renameColumn':
    if (driver === 'mysql') {
        statements.push(`ALTER TABLE \`${this.tableName}\` RENAME COLUMN \`${command.from}\` TO \`${command.to}\``);
    } else {
        statements.push(`ALTER TABLE \`${this.tableName}\` RENAME COLUMN "${command.from}" TO "${command.to}"`);
    }
    break;
```

---

## Bug 9 — `formatDefaultValue()` — pas d'échappement des apostrophes

### Severity : 🟠 Major

### Description

The `ColumnDefinition.formatDefaultValue()` method wraps string values in single quotes but does not escape them. If the default value contains an apostrophe, the generated SQL becomes invalid or exploitable.

### Source file

`Schema/Schema.js`, ligne ~752 :

```javascript
formatDefaultValue() {
    if (typeof this.defaultValue === 'string') {
      return `'${this.defaultValue}'`;    // ← Pas d'échappement de ' → injection SQL
    }
    return this.defaultValue;
}
```

### Exemple problématique

```javascript
table.string('description').default("It's a test");
// Generates : DEFAULT 'It's a test'  → ERREUR SQL
```

### Recommandation

```javascript
formatDefaultValue() {
    if (typeof this.defaultValue === 'string') {
      const escaped = this.defaultValue.replace(/'/g, "''");
      return `'${escaped}'`;
    }
    return this.defaultValue;
}
```

---

## Bug 10 — `constrained()` — pluralisation naïve

### Severity : 🟡 Minor

### Description

La method `ForeignKeyDefinition.constrained()` infère le nom de la table cible en supprimant `_id` du nom de colonne et en ajoutant `'s'`. Cette logique échoue pour les pluriels irréguliers anglais.

### Source file

`Schema/Schema.js`, ligne ~780 :

```javascript
constrained(table = null) {
    if (table) {
      this.ref.table = table;
    } else {
      this.ref.table = this.column.replace(/_id$/, '') + 's';
      //                                                ^^^^
      //  category_id → categorys  (attendu : categories)
      //  person_id   → persons    (attendu : people)
      //  address_id  → addresss   (attendu : addresses)
    }
}
```

### Impact

Nécessité de toujours passer le nom de table explicitement pour les noms irréguliers.

### Recommandation

Implémenter un pluraliseur basique ou use une lib comme `pluralize` :

```javascript
constrained(table = null) {
    if (table) {
      this.ref.table = table;
    } else {
      const singular = this.column.replace(/_id$/, '');
      this.ref.table = pluralize(singular);  // ou au minimum gérer -y → -ies, -s → -ses, etc.
    }
}
```

---

## Bug 11 — Noms de colonnes sans backticks dans le SQL du Schema

### Severity : 🟠 Major

### Description

The Bug 4 patch added backticks on **table names**, but **column names** remain unprotected in generated SQL. This affects `ColumnDefinition.toSql()`, and PRIMARY KEY, FOREIGN KEY, INDEX and UNIQUE constraints in `getConstraints()` and `toAlterSql()`.

### Source file

`Schema/Schema.js`, multiples emplacements :

```javascript
// ColumnDefinition.toSql() :
toSql(driver) {
    let sql = `${this.name} ${this.getTypeDefinition(driver)}`;
    //          ^^^^^^^^^^^ — pas de backticks !
}

// getConstraints() :
const pkColumns = primaryKeys.map(col => col.name).join(', ');
constraints.push(`PRIMARY KEY (${pkColumns})`);
//                              ^^^^^^^^^^^ — pas de backticks !

// toAlterSql(), cas 'dropColumn' :
statements.push(`...DROP COLUMN ${col}`);
//                                ^^^^ — pas de backticks !
```

### Impact

Colonnes nommées `order`, `key`, `index`, `group`, `select`, `from`, `to`, etc. provoqueront des erreurs de syntaxe SQL.

### Recommandation

Appliquer systématiquement les backticks sur les column names dans le SQL :

```javascript
toSql(driver) {
    let sql = `\`${this.name}\` ${this.getTypeDefinition(driver)}`;
}
```

---

## Bug 12 — `buildSelectQuery()` — colonnes non assainies

### Severity : 🟠 Major

### Description

Dans `DatabaseConnection.buildSelectQuery()`, les colonnes du SELECT, les tables et colonnes des JOINs, les colonnes du GROUP BY, HAVING et ORDER BY sont directement concaténées dans le SQL sans aucune sanitization ni échappement.

### Source file

`DatabaseConnection.js`, lignes ~880-960 :

```javascript
// SELECT — colonnes injectées directement :
selectClause = query.columns.join(', ');

// JOINs — table, first, operator, second sans protection :
sql += ` ${joinType} JOIN ${join.table} ON ${join.first} ${join.operator} ${join.second}`;

// ORDER BY — column et direction injectées :
const orderClauses = query.orders.map(
    order => `${order.column} ${order.direction.toUpperCase()}`
);

// GROUP BY :
sql += ` GROUP BY ${query.groupBys.join(', ')}`;

// LIMIT / OFFSET — concaténation directe (pas de paramètre) :
sql += ` LIMIT ${query.limit}`;
sql += ` OFFSET ${query.offset}`;
```

### Impact

Si des column names sont fournis dynamiquement (par ex. via une API REST avec tri configurable), un attaquant pourrait injecter du SQL via les champs `column`, `direction`, `table`, etc.

### Recommandation

- Sanitiser chaque identifiant via `sanitizeIdentifier()` (qui existe déjà mais n'est pas utilisé ici)
- Valider `direction` contre une whitelist `['ASC', 'DESC']`
- Use parameters for `LIMIT` and `OFFSET`

---

## Bug 13 — `buildWhereClause()` — opérateur non validé

### Severity : 🟡 Minor

### Description

Dans `buildWhereClause()`, le champ `where.operator` est directement inséré dans le SQL sans validation. Un opérateur arbitraire pourrait être exploité.

### Source file

`DatabaseConnection.js`, ligne ~985 :

```javascript
case 'basic':
    clauses.push(`${boolean} ${where.column} ${where.operator} ?`);
    //                                        ^^^^^^^^^^^^^^^^
    //                    Pas de validation — pourrait être "1=1; DROP TABLE users; --"
```

### Recommandation

Valider contre une whitelist d'opérateurs SQL autorisés :

```javascript
const ALLOWED_OPERATORS = ['=', '!=', '<>', '<', '>', '<=', '>=', 'LIKE', 'NOT LIKE', 'IS', 'IS NOT'];

if (!ALLOWED_OPERATORS.includes(where.operator.toUpperCase())) {
    throw new Error(`Invalid operator: ${where.operator}`);
}
```

---

## Bug 14 — `select()` vs `update()` — incohérence de conversion de placeholders

### Severity : 🟠 Major

### Description

Les methods `select()`, `update()`, `delete()` dans `DatabaseConnection` traitent la conversion des placeholders `?` → `$1, $2...` pour PostgreSQL de manière incohérente :

- `select()` appelle `executeMySQLQuery()` qui ne convertit **pas** les placeholders ; pour Postgres, `executePostgreSQLQuery()` les convertit.
- `update()` et `delete()` appellent `convertToDriverPlaceholder()` explicitement pour MySQL aussi (inutile, la method no-op pour MySQL).
- `insert()` pour MySQL utilise `conn.execute(sql, values)` sans conversion, mais pour Postgres appelle `convertToDriverPlaceholder(sql)`.

### Source file

`DatabaseConnection.js`, lignes ~395-600 :

```javascript
// select() - cas MySQL : appelle executeMySQLQuery qui fait conn.execute(sql, params) — OK
// select() - cas Postgres : appelle executePostgreSQLQuery qui convertit — OK

// update() - cas MySQL :
const [res] = await conn.execute(this.convertToDriverPlaceholder(sql), params);
//                                ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ inutile pour MySQL

// insert() - cas MySQL :
const [res] = await conn.execute(sql, values);   // Pas de conversion — OK
// insert() - cas Postgres :
await conn.query(`${this.convertToDriverPlaceholder(sql)} RETURNING *`, values);  // OK
```

### Impact

Bien que fonctionnel actuellement (car `convertToDriverPlaceholder` est no-op pour MySQL), ce code est fragile et source de confusion. Si la method change de comportement, les methods se comporteront différemment.

### Recommandation

Uniformiser en utilisant systématiquement `convertToDriverPlaceholder()` dans une seule method d'exécution.

---

## Bug 15 — Fuite potentielle de connection transactionnelle

### Severity : 🟡 Minor

### Description

Dans les methods `commit()` et `rollback()`, si `release()` lève une exception, la connection transactionnelle n'est jamais libérée et `this._transactionConnection` n'est jamais remis à `null`.

### Source file

`DatabaseConnection.js`, lignes ~268-310 :

```javascript
async commit() {
    case 'mysql':
      if (this._transactionConnection) {
        await this._transactionConnection.commit();
        this._transactionConnection.release();     // ← Si ça throw...
        this._transactionConnection = null;        // ← ...jamais exécuté
      }
}
```

### Impact

En cas d'erreur de `release()`, la connection du pool est perdue (leak). Sous charge, le pool de connexions MySQL peut être épuisé.

### Recommandation

Utiliser `try/finally` :

```javascript
async commit() {
    if (this._transactionConnection) {
        try {
            await this._transactionConnection.commit();
        } finally {
            try { this._transactionConnection.release(); } catch (e) { /* log */ }
            this._transactionConnection = null;
        }
    }
}
```

---

## Bug 16 — `eventListeners` partagé entre toutes les classes filles de Model

### Severity : 🟠 Major

### Description

La propriété statique `eventListeners` est un objet défini directement sur la classe `Model`. Comme JavaScript partage les propriétés statiques par référence entre les classes parentes et filles, enregistrer un listener sur `User.on('creating', fn)` l'enregistre aussi pour `Post`, `Comment`, etc.

### Source file

`Model.js`, lignes ~22-33 :

```javascript
class Model {
  static eventListeners = {
    creating: [],
    created: [],
    // ...
  };

  static on(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);  // ← Partagé entre TOUS les models !
  }
}
```

### Impact

Les hooks d'un model sont déclenchés pour un autre model. Exemple : un hook `User.creating()` qui hashe le mot de passe sera aussi appelé pour `Post.create()`.

### Recommandation

Initialiser les listeners propres à chaque sous-classe :

```javascript
static on(event, callback) {
    // S'assurer que chaque sous-classe a ses propres listeners
    if (!this.hasOwnProperty('eventListeners')) {
        this.eventListeners = {
            creating: [], created: [], updating: [], updated: [],
            saving: [], saved: [], deleting: [], deleted: [],
            restoring: [], restored: []
        };
    }
    this.eventListeners[event].push(callback);
}
```

---

## Bug 17 — `hasOne`/`hasMany`/`belongsTo` — déduction de FK naïve

### Severity : 🟡 Minor

### Description

Les methods `hasOne()`, `hasMany()` et `belongsTo()` déduisent la foreignKey Default en faisant `table.slice(0, -1) + '_id'`. Ce qui supprime simplement le dernier caractère du nom de table, ce qui échoue dès que le nom de table ne finit pas par `'s'`.

### Source file

`Model.js`, lignes ~1000-1040 :

```javascript
hasOne(related, foreignKey, localKey) {
    foreignKey = foreignKey || `${this.constructor.table.slice(0, -1)}_id`;
    //                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //  table 'users'     → 'user_id'      ✓
    //  table 'people'    → 'peopl_id'     ✗
    //  table 'addresses' → 'addresse_id'  ✗
    //  table 'data'      → 'dat_id'       ✗
}

belongsTo(related, foreignKey, ownerKey) {
    foreignKey = foreignKey || `${related.table.slice(0, -1)}_id`;
    // Même problème
}
```

### Recommandation

Utiliser une librairie de singularisation ou au minimum une heuristique plus robuste :

```javascript
function singularize(table) {
    if (table.endsWith('ies')) return table.slice(0, -3) + 'y';
    if (table.endsWith('ses')) return table.slice(0, -2);
    if (table.endsWith('s')) return table.slice(0, -1);
    return table;
}
```

---

## Bug 18 — `fill()` avec `fillable = []` accepte tout

### Severity : 🟡 Minor

### Description

La method `Model.fill()` vérifie `this.constructor.fillable.length === 0` et dans ce cas accepte **tous** les attributs. Cela signifie que si un développeur oublie de définir `fillable`, tous les champs sont mass-assignable, y compris `is_admin`, `role`, etc.

### Source file

`Model.js`, lignes ~760-770 :

```javascript
fill(attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (this.constructor.fillable.length === 0 || this.constructor.fillable.includes(key)) {
        this.setAttribute(key, value);
      }
    }
    return this;
}
```

### Impact

Vulnérabilité de mass-assignment : un utilisateur malveillant peut modifier des colonnes sensibles s'il passe des attributs supplémentaires et que `fillable` n'est pas défini.

### Recommandation

En l'absence de `fillable`, soit rejeter tous les attributs, soit implémenter un système `guarded` comme Laravel :

```javascript
fill(attributes) {
    const fillable = this.constructor.fillable;
    const guarded = this.constructor.guarded || ['*'];

    for (const [key, value] of Object.entries(attributes)) {
      if (fillable.length > 0 && fillable.includes(key)) {
        this.setAttribute(key, value);
      } else if (!guarded.includes('*') && !guarded.includes(key)) {
        this.setAttribute(key, value);
      }
    }
    return this;
}
```

---

## Bug 19 — `static delete()` sans WHERE supprime toutes les lignes

### Severity : 🟠 Major

### Description

La method statique `Model.delete()` appelle `this.query().delete()` sans aucune clause WHERE. Cela envoie `DELETE FROM table` qui supprime **toutes** les lignes de la table.

### Source file

`Model.js`, lignes ~560-565 :

```javascript
static async delete() {
    return this.query().delete();
    // → Generates : DELETE FROM users   (sans WHERE !)
}
```

### Impact

An accidental `User.delete()` call (without `.where()`) deletes the entire `users` table.

### Recommandation

Ajouter une protection contre les suppressions sans condition :

```javascript
async delete() {
    if (this.wheres.length === 0) {
        throw new Error('Refusing to delete without WHERE clause. Use truncate() for full table deletion.');
    }
    return this.model.connection.delete(this.model.table, this.buildQuery());
}
```

---

## Bug 20 — `withCount()` — sous-queries sans protection

### Severity : 🟡 Minor

### Description

La method `QueryBuilder.withCount()` Generates des sous-queries SQL en concaténant directement les table names et de colonnes sans backticks ni sanitization.

### Source file

`QueryBuilder.js`, lignes ~440-475 :

```javascript
withCount(rels) {
    // ...
    sub = `(SELECT COUNT(*) FROM ${relatedTable} WHERE ${relatedTable}.${relation.foreignKey} = ${parentTable}.${relation.localKey}) AS ${name}_count`;
    //                            ^^^^^^^^^^^^^^        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //                         Pas de backticks — injection possible si les noms sont dynamiques
}
```

### Recommandation

Appliquer les backticks sur tous les identifiants dans les sous-queries.

---

## Bug 21 — `paginate()` — double application des globalScopes

### Severity : 🟡 Minor

### Description

La method `QueryBuilder.paginate()` appelle `_applyGlobalScopes()` puis `count()` et `get()`. Or `count()` et `get()` appellent eux-mêmes `_applyGlobalScopes()` et `_applySoftDeleteConstraints()`. Les scopes sont donc appliqués **trois fois**, ce qui peut create des clauses WHERE dupliquées.

### Source file

`QueryBuilder.js`, lignes ~555-575 :

```javascript
async paginate(page = 1, perPage = 15) {
    this._applyGlobalScopes();           // 1ère application
    this._applySoftDeleteConstraints();

    const total = await this.count();    // count() applique encore les scopes
    const data = await this.offset(offset).limit(perPage).get(); // get() aussi
}
```

### Impact

Clauses WHERE dupliquées (ex. `WHERE deleted_at IS NULL AND deleted_at IS NULL AND deleted_at IS NULL`). Pas d'erreur SQL mais performances dégradées et queries inutilement complexes.

### Recommandation

Appliquer les scopes une seule fois, ou use un flag pour éviter la double application :

```javascript
_applyGlobalScopes() {
    if (this._scopesApplied) return;
    this._scopesApplied = true;
    // ...
}
```

---

## Bug 22 — `BelongsToManyRelation.withTimestamps()` — conflit method/propriété

### Severity : 🟡 Minor

### Description

Même pattern que les Bugs 2 et 3 : la propriété `this.withTimestamps = false` définie dans le constructeur masque la method `withTimestamps()`.

### Source file

`Relations/BelongsToManyRelation.js`, lignes ~18 et ~325 :

```javascript
constructor(...) {
    this.withTimestamps = false;   // ← Propriété booléenne — masque la method
}

withTimestamps() {                 // ← Method can never be called!
    this.withTimestamps = true;
    return this;
}
```

### Impact

L'appel `relation.withTimestamps()` provoque `TypeError: relation.withTimestamps is not a function` — même bug de shadowing que les Bugs 2 et 3.

### Recommandation

Renommer la propriété :

```javascript
constructor(...) {
    this._withTimestamps = false;
}

withTimestamps() {
    this._withTimestamps = true;
    return this;
}
```

---

## Bug 23 — `MigrationManager.getLastBatchMigrations()` — interpolation de `steps`

### Severity : 🟡 Minor

### Description

Le paramètre `steps` est directement interpolé dans la requête SQL sans être paramétré. Si `steps` provient d'une entrée non validée, cela ouvre une injection SQL.

### Source file

`Migrations/MigrationManager.js`, lignes ~245-255 :

```javascript
async getLastBatchMigrations(steps = 1) {
    const sql = `
      SELECT * FROM ${this.migrationsTable}
      WHERE batch >= (
        SELECT MAX(batch) - ${steps - 1} FROM ${this.migrationsTable}
      )                      ^^^^^^^^^^^^^
                          Interpolation non paramétrée
    `;
    return await this.connection.execute(sql);
}
```

### Recommandation

```javascript
const sql = `SELECT * FROM ${this.migrationsTable}
             WHERE batch >= (SELECT MAX(batch) - ? FROM ${this.migrationsTable})
             ORDER BY batch DESC, id DESC`;
return await this.connection.execute(sql, [steps - 1]);
```

---

## Bug 24 — `QueryBuilder.clone()` ne copie pas tous les flags

### Severity : 🟡 Minor

### Description

La method `clone()` copie les arrays (`wheres`, `orders`, etc.) mais oublie de copier les flags `_showHidden`, `_withTrashed`, `_onlyTrashed`, `_excludedScopes` et `_excludeAllScopes`.

### Source file

`QueryBuilder.js`, lignes ~770-795 :

```javascript
clone() {
    const cloned = new QueryBuilder(this.model);
    cloned.wheres = [...this.wheres];
    cloned.orders = [...this.orders];
    // ...
    // ← _showHidden, _withTrashed, _onlyTrashed NON COPIÉS !
    return cloned;
}
```

### Impact

Après un `clone()`, les flags de soft-delete et de visibilité sont perdus. Un clone d'un query `withTrashed()` réappliquera le filtre soft-delete.

### Recommandation

```javascript
clone() {
    const cloned = new QueryBuilder(this.model);
    // Arrays
    cloned.wheres = [...this.wheres];
    cloned.orders = [...this.orders];
    cloned.selectedColumns = [...this.selectedColumns];
    cloned.withRelations = [...this.withRelations];
    cloned.withConstraints = { ...this.withConstraints };
    cloned.joins = [...this.joins];
    cloned.groupBys = [...this.groupBys];
    cloned.havings = [...this.havings];
    // Scalars
    cloned.limitValue = this.limitValue;
    cloned.offsetValue = this.offsetValue;
    cloned.distinctFlag = this.distinctFlag;
    // Flags manquants
    cloned._showHidden = this._showHidden;
    cloned._withTrashed = this._withTrashed;
    cloned._onlyTrashed = this._onlyTrashed;
    cloned._excludedScopes = [...this._excludedScopes];
    cloned._excludeAllScopes = this._excludeAllScopes;
    return cloned;
}
```

---

## Patches appliqués au projet

Les corrections suivantes ont été appliquées manuellement au file `node_modules/outlet-orm/src/Schema/Schema.js` :

1. **Backticks** on all table names in generated SQL (partial — `rename()` not covered, see Bug 6)
2. **Renommage** des propriétés internes de `ForeignKeyDefinition` :
   - `this.references` → `this.ref`
   - `this.onDelete` → `this.deleteAction`
   - `this.onUpdate` → `this.updateAction`
3. **Mise à jour** de `getConstraints()` et `toAlterSql()` pour use les nouveaux noms

> ⚠️ **Attention** : ces patches sont dans `node_modules/` et seront perdus à chaque `npm install`. Il est recommandé d'use un outil comme [`patch-package`](https://www.npmjs.com/package/patch-package) pour pérenniser ces corrections.

### Pour pérenniser avec patch-package

```bash
npm install patch-package --save-dev
npx patch-package outlet-orm
```

Ajouter dans `package.json` :

```json
{
  "scripts": {
    "postinstall": "patch-package"
  }
}
```

---

## Résumé

**24 anomalies identifiées** au total : 4 Criticals, 9 majeurs, 11 Minores.

| Action | Priorité | Responsable |
|--------|----------|-------------|
| Corriger le shadowing dans `ForeignKeyDefinition` (Bugs 2, 3, 22) | 🔴 Critical | Mainteneur outlet-orm |
| Corriger l'injection SQL dans `hasTable()`/`hasColumn()` (Bug 7) | 🔴 Critical | Mainteneur outlet-orm |
| Corriger `renameColumn` — syntaxe CHANGE (Bug 8) | 🔴 Critical | Mainteneur outlet-orm |
| Ajouter le quoting des identifiants SQL (Bugs 4, 6, 11, 12, 20) | 🟠 Haute | Mainteneur outlet-orm |
| Protéger `delete()` sans WHERE (Bug 19) | 🟠 Haute | Mainteneur outlet-orm |
| Corriger le partage de `eventListeners` (Bug 16) | 🟠 Haute | Mainteneur outlet-orm |
| Corriger l'échappement des values Default (Bug 9) | 🟠 Haute | Mainteneur outlet-orm |
| Uniformiser la conversion de placeholders (Bug 14) | 🟠 Moyenne | Mainteneur outlet-orm |
| Faire retourner un objet chaînable par `foreignId()` (Bug 1) | 🟠 Haute | Mainteneur outlet-orm |
| Valider les opérateurs SQL (Bug 13) | 🟡 Moyenne | Mainteneur outlet-orm |
| Corriger `clone()` — flags manquants (Bug 24) | 🟡 Moyenne | Mainteneur outlet-orm |
| Corriger la double application des scopes (Bug 21) | 🟡 Moyenne | Mainteneur outlet-orm |
| Corriger la fuite de connection transactionnelle (Bug 15) | 🟡 Moyenne | Mainteneur outlet-orm |
| Améliorer la pluralisation (Bugs 10, 17) | 🟡 Basse | Mainteneur outlet-orm |
| Améliorer le mass-assignment avec `guarded` (Bug 18) | 🟡 Basse | Mainteneur outlet-orm |
| Paramétrer `steps` dans `getLastBatchMigrations()` (Bug 23) | 🟡 Basse | Mainteneur outlet-orm |
| Update la documentation (Bug 5) | 🟡 Moyenne | Mainteneur outlet-orm |
| Ouvrir une issue / PR sur le dépôt GitHub | 🟢 Recommandé | Équipe Le Continent |
| Pérenniser les patches avec `patch-package` | 🟢 Recommandé | Équipe Le Continent |

# Conversion SQL vers ORM

Outlet ORM inclut un outil puissant de conversion automatique de schémas SQL en modèles ORM.

## 🚀 Installation

```bash
npm install -g outlet-orm
```

## 📖 Utilisation

### Option 1 : Convertir depuis un fichier SQL local

```bash
outlet-convert
```

Puis sélectionnez l'option 1 et suivez les instructions :

1. Indiquez le chemin vers votre fichier SQL
2. Choisissez le dossier de sortie pour les modèles (défaut: `./models`)
3. Décidez si vous voulez exclure les clés étrangères de `fillable`

**Exemple :**

```bash
$ outlet-convert

╔═══════════════════════════════════════╗
║  Outlet ORM - Convertisseur SQL      ║
╚═══════════════════════════════════════╝

Choisissez une option:

  1. Convertir depuis un fichier SQL
  2. Convertir depuis une base de données connectée
  3. Quitter

Votre choix: 1
Chemin du fichier SQL: ./database/schema.sql

✅ 8 table(s) trouvée(s)

Dossier de sortie pour les modèles (défaut: ./models): ./src/models
Exclure les clés étrangères de fillable? (o/N): o

✅ Modèle créé: ./src/models/User.js
✅ Modèle créé: ./src/models/Post.js
✅ Modèle créé: ./src/models/Comment.js
✅ Modèle créé: ./src/models/Category.js
✅ Modèle créé: ./src/models/Tag.js
✅ Modèle créé: ./src/models/Profile.js
✅ Modèle créé: ./src/models/Role.js
✅ Modèle créé: ./src/models/Session.js

✨ Conversion terminée! 8 modèle(s) créé(s) dans ./src/models
```

### Option 2 : Convertir depuis une base de données connectée

```bash
outlet-convert
```

Puis sélectionnez l'option 2 et suivez les instructions :

1. Choisissez le driver de base de données (mysql/postgres/sqlite)
2. Entrez les informations de connexion
3. L'outil se connectera et listera toutes les tables
4. Choisissez le dossier de sortie pour les modèles

**Exemple MySQL :**

```bash
$ outlet-convert

╔═══════════════════════════════════════╗
║  Outlet ORM - Convertisseur SQL      ║
╚═══════════════════════════════════════╝

Choisissez une option:

  1. Convertir depuis un fichier SQL
  2. Convertir depuis une base de données connectée
  3. Quitter

Votre choix: 2

📊 Conversion depuis une base de données

Driver (mysql/postgres/sqlite): mysql
Host (défaut: localhost): localhost
Port (défaut: 3306): 3306
Database: myblog
User: root
Password: ********

🔄 Connexion à la base de données...
✅ Connecté!

✅ 8 table(s) trouvée(s):

  1. users
  2. posts
  3. comments
  4. categories
  5. tags
  6. post_tag
  7. profiles
  8. roles

Dossier de sortie pour les modèles (défaut: ./models): ./src/models
Exclure les clés étrangères de fillable? (o/N): o

✅ Modèle créé: User.js
✅ Modèle créé: Post.js
✅ Modèle créé: Comment.js
✅ Modèle créé: Category.js
✅ Modèle créé: Tag.js
✅ Modèle créé: PostTag.js
✅ Modèle créé: Profile.js
✅ Modèle créé: Role.js

✨ Conversion terminée! 8 modèle(s) créé(s) dans ./src/models
```

## 📝 Exemple de conversion

### SQL Input

```sql
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL UNIQUE,
  `password` varchar(255) NOT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `role_id` int(11) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### Modèle ORM généré

```javascript
const { Model } = require('outlet-orm');

// Importer les modèles liés
// const Role = require('./Role');

class User extends Model {
  static table = 'users';
  static timestamps = true;
  static fillable = [
    'name',
    'email',
    'email_verified_at',
    'is_active'
  ];
  static hidden = [
    'password'
  ];
  static casts = {
    id: 'int',
    email_verified_at: 'date',
    is_active: 'boolean',
    role_id: 'int'
  };

  // Relations
  role() {
    return this.belongsTo(Role, 'role_id');
  }

}

module.exports = User;
```

## 🎯 Fonctionnalités

### Détection automatique

L'outil détecte automatiquement :

- ✅ **Nom de la table** et conversion en classe PascalCase
- ✅ **Clé primaire** (par défaut `id`)
- ✅ **Timestamps** (`created_at`, `updated_at`)
- ✅ **Types de données** et conversion en casts appropriés :
  - `INT` → `int`
  - `FLOAT`, `DOUBLE`, `DECIMAL` → `float`
  - `BOOLEAN`, `TINYINT(1)` → `boolean`
  - `JSON` → `json`
  - `DATE`, `DATETIME`, `TIMESTAMP` → `date`
  - `VARCHAR`, `TEXT` → `string`

- ✅ **Champs fillable** (exclut automatiquement `id` et les timestamps)
- ✅ **Champs hidden** (détecte les colonnes sensibles : password, token, secret, api_key)
- ✅ **Relations** :
  - Clés étrangères (`_id` suffix)
  - `FOREIGN KEY` explicites
  - Génération automatique des méthodes de relation `belongsTo`

### Options de conversion

- **Exclure les clés étrangères de fillable** : Utile pour éviter l'assignation de masse des IDs de relation
- **Choix du dossier de sortie** : Organisez vos modèles comme vous le souhaitez
- **Support multi-driver** : MySQL, PostgreSQL, SQLite

## 🔧 Configuration avancée

### Après la conversion

Les modèles générés contiennent des commentaires pour les imports de modèles liés. Décommentez-les après avoir généré tous les modèles :

```javascript
// Avant
// const Role = require('./Role');

// Après
const Role = require('./Role');
```

### Ajouter des relations inverses

L'outil génère automatiquement les relations `belongsTo`, mais vous devrez ajouter manuellement les relations inverses :

```javascript
// Dans Role.js
users() {
  return this.hasMany(User, 'role_id');
}
```

### Personnalisation

Les modèles générés sont un excellent point de départ. Vous pouvez les personnaliser :

- Ajouter des accesseurs/mutateurs
- Définir des scopes personnalisés
- Ajouter des validations
- Configurer des hooks (events)

## 💡 Conseils

1. **Testez d'abord** : Utilisez un dossier temporaire pour la première conversion
2. **Vérifiez les relations** : L'outil fait de son mieux, mais vérifiez toujours les relations générées
3. **Complétez manuellement** : Les relations `hasMany`, `hasOne`, et `belongsToMany` doivent être ajoutées manuellement
4. **Utilisez un VCS** : Committez vos modèles pour suivre les modifications

## 🐛 Limitations

- Les relations `hasMany` et `hasOne` ne sont pas automatiquement générées (seulement `belongsTo`)
- Les relations `belongsToMany` (many-to-many) nécessitent une configuration manuelle
- Les validations personnalisées doivent être ajoutées manuellement
- Les scopes et méthodes personnalisées doivent être ajoutés manuellement

## 🆘 Support

En cas de problème avec la conversion :

1. Vérifiez que votre SQL est valide
2. Assurez-vous que les instructions `CREATE TABLE` sont complètes
3. Pour les bases de données connectées, vérifiez les permissions de lecture du schéma
4. Consultez les logs d'erreur pour plus de détails

## 📚 Exemples

Un fichier SQL d'exemple est fourni dans `examples/schema-example.sql` pour tester la conversion.

```bash
outlet-convert
# Choisir option 1
# Chemin: ./examples/schema-example.sql
# Dossier: ./test-models
```

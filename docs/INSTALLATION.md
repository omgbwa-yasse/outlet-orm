# 📦 Installation et Configuration

## Prérequis

- **Node.js** >= 18 (recommandé)
- Un serveur de base de données (MySQL, PostgreSQL ou SQLite)

## Installation

```bash
npm install outlet-orm
```

### Installer le driver de base de données

Outlet ORM utilise des dépendances optionnelles. Installez uniquement le driver dont vous avez besoin :

```bash
# MySQL / MariaDB
npm install mysql2

# PostgreSQL
npm install pg

# SQLite
npm install sqlite3
```

> 💡 Si aucun driver n'est installé, un message d'erreur explicite vous indiquera lequel installer.

## Structure de Projet Recommandée

Après installation, organisez votre projet comme suit :

```
mon-projet/
├── .env                        # Configuration de la base de données
├── package.json
├── database/
│   ├── config.js               # Config migrations (généré par outlet-init)
│   └── migrations/             # Vos fichiers de migration
│       ├── 20240101_create_users_table.js
│       └── 20240102_create_posts_table.js
├── models/                     # Vos classes Model (recommandé)
│   ├── User.js
│   ├── Post.js
│   └── Comment.js
├── src/                        # Votre code applicatif
│   └── index.js
└── tests/                      # Vos tests
    └── models.test.js
```

| Dossier | Rôle | Créé par |
|---------|------|----------|
| `database/config.js` | Configuration des migrations | `outlet-init` |
| `database/migrations/` | Fichiers de migration | `outlet-migrate make` |
| `models/` | Vos classes Model | Vous (recommandé) |

## Configuration

### Option 1 : Via fichier `.env` (recommandé) - Connexion automatique

Créez un fichier `.env` à la racine de votre projet :

```env
# Driver: mysql, postgres, sqlite
DB_DRIVER=mysql

# Connexion
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=myapp
DB_USER=root
DB_PASSWORD=secret

# Pool de connexions (optionnel)
DB_POOL_MAX=10
```

```javascript
// C'est tout ! Importez seulement Model
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
}

// La connexion est initialisée automatiquement à la première utilisation
const users = await User.all();
```

> 💡 **Pas besoin d'importer `DatabaseConnection`** - Le Model se connecte automatiquement depuis `.env` lors de la première requête.

### Option 2 : Configuration manuelle (avancé)

Si vous avez besoin de contrôler la connexion manuellement :

```javascript
const { DatabaseConnection, Model } = require('outlet-orm');

const db = new DatabaseConnection({
  driver: 'mysql',        // 'mysql' | 'postgres' | 'sqlite'
  host: 'localhost',
  port: 3306,
  database: 'myapp',
  user: 'root',
  password: 'secret',
  connectionLimit: 10     // Pool de connexions
});

Model.setConnection(db);  // Optionnel si .env est configuré
```

> Cette méthode est utile pour les tests ou les configurations dynamiques.

### Option 3 : SQLite

```javascript
// SQLite en mémoire
const db = new DatabaseConnection({
  driver: 'sqlite',
  database: ':memory:'
});

// SQLite fichier
const db = new DatabaseConnection({
  driver: 'sqlite',
  database: './database.sqlite'
});
```

Ou via `.env` :

```env
DB_DRIVER=sqlite
DB_FILE=./database.sqlite
```

## Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DB_DRIVER` | `mysql`, `postgres`, `sqlite` | `mysql` |
| `DB_HOST` | Hôte du serveur | `localhost` |
| `DB_PORT` | Port de connexion | Selon driver |
| `DB_USER` / `DB_USERNAME` | Nom d'utilisateur | - |
| `DB_PASSWORD` | Mot de passe | - |
| `DB_DATABASE` / `DB_NAME` | Nom de la base | - |
| `DB_FILE` / `SQLITE_DB` | Chemin fichier SQLite | `:memory:` |
| `DB_POOL_MAX` | Taille max du pool | `10` |

## Initialisation rapide avec CLI

```bash
# Créer la configuration initiale
npx outlet-init

# Créer une migration
npx outlet-migrate make create_users_table

# Exécuter les migrations
npx outlet-migrate migrate
```

## Vérifier la connexion

```javascript
const { DatabaseConnection } = require('outlet-orm');

async function testConnection() {
  const db = new DatabaseConnection();
  
  try {
    await db.connect();
    console.log('✅ Connexion réussie !');
    
    // Test simple
    const result = await db.executeRawQuery('SELECT 1 as test');
    console.log('Résultat:', result);
    
  } catch (error) {
    console.error('❌ Erreur de connexion:', error.message);
  } finally {
    await db.close();
  }
}

testConnection();
```

## Structure de projet recommandée

```
my-project/
├── .env                    # Configuration
├── package.json
├── database/
│   ├── config.js          # Configuration exportée
│   └── migrations/        # Fichiers de migration
├── models/
│   ├── User.js
│   ├── Post.js
│   └── index.js           # Export tous les modèles
└── src/
    └── index.js           # Point d'entrée
```

### Exemple de `models/index.js`

```javascript
const { Model } = require('outlet-orm');

// Exporter les modèles (connexion automatique via .env)
module.exports = {
  User: require('./User'),
  Post: require('./Post'),
  Comment: require('./Comment')
};
```

> 💡 Plus besoin d'initialiser `DatabaseConnection` - tout est automatique !

## Prochaines étapes

- [Guide des Modèles](MODELS.md)
- [Query Builder](QUERY_BUILDER.md)
- [Relations](RELATIONS.md)

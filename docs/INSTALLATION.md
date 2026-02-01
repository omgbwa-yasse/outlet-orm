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

> 🔐 **Sécurité** : Voir le [Guide de Sécurité](SECURITY.md) pour les bonnes pratiques.

```
mon-projet/
├── .env                        # ⚠️ JAMAIS commité (dans .gitignore)
├── .env.example                # Template sans secrets
├── .gitignore                  # Exclure .env, node_modules, logs
├── package.json
├── config/                     # 🔒 Configuration centralisée
│   ├── app.js                  # Config générale
│   ├── database.js             # Config DB (lit .env)
│   └── security.js             # Rate limit, helmet, CORS...
├── database/
│   ├── config.js               # Config migrations (généré par outlet-init)
│   └── migrations/
├── models/                     # Vos classes Model
│   ├── User.js
│   └── Post.js
├── controllers/                # Vos contrôleurs
│   ├── UserController.js
│   └── PostController.js
├── routes/                     # Vos routes
│   ├── index.js
│   └── userRoutes.js
├── middlewares/                # 🔒 Middlewares de sécurité
│   ├── auth.js                 # Authentification JWT
│   ├── authorization.js        # Contrôle des permissions
│   ├── rateLimiter.js          # Protection anti-DDoS
│   ├── validator.js            # Validation des entrées
│   └── errorHandler.js         # Gestion des erreurs
├── services/                   # Services métier
├── utils/                      # 🔒 Utilitaires sécurité
│   ├── hash.js                 # Hachage (bcrypt)
│   └── token.js                # Tokens JWT
├── validators/                 # 🔒 Schémas de validation
├── public/                     # ✅ Fichiers statiques publics
│   ├── images/
│   ├── css/
│   └── js/
├── uploads/                    # ⚠️ Fichiers uploadés
├── logs/                       # 📋 Journaux (non versionnés)
├── src/
│   └── index.js
└── tests/
```

| Dossier | Rôle | Sécurité |
|---------|------|----------|
| `config/` | Configuration centralisée | 🔒 Lit .env |
| `database/` | Migrations | `outlet-init` |
| `models/` | Classes Model | 🔒 `hidden`, `fillable` |
| `middlewares/` | Auth, validation, rate limit | 🔒 **Critique** |
| `utils/` | Hash, tokens | 🔒 Ne pas exposer |
| `public/` | Fichiers statiques | ✅ Seul dossier public |
| `logs/` | Journaux | 📋 `.gitignore` |

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

## Référence rapide de la structure

> Voir la section **Structure de Projet Recommandée (Architecture en Couches)** ci-dessus pour la structure complète.

### Exemple de `src/models/index.js`

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

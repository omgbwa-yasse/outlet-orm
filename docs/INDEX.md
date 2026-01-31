# 📚 Outlet ORM - Documentation Complète

> **Version 4.0.0** - Un ORM JavaScript/TypeScript inspiré de Laravel Eloquent pour Node.js

## Table des matières

### 🚀 Démarrage
- [Guide de démarrage rapide](QUICKSTART.md)
- [Installation et Configuration](INSTALLATION.md)
- [Structure de Projet](INSTALLATION.md#structure-de-projet-recommandée)

### 📖 Guides essentiels
- [Modèles et CRUD](MODELS.md)
- [Query Builder](QUERY_BUILDER.md)
- [Relations](RELATIONS.md)
- [Détection automatique des relations](RELATIONS_DETECTION.md)

### ⚡ Fonctionnalités avancées
- [Transactions](TRANSACTIONS.md)
- [Soft Deletes](SOFT_DELETES.md)
- [Scopes (Globaux et Locaux)](SCOPES.md)
- [Events / Hooks](EVENTS.md)
- [Validation](VALIDATION.md)
- [Query Logging](QUERY_LOGGING.md)

### 🔐 Sécurité
- [**Guide de Sécurité Backend**](SECURITY.md) - Structure sécurisée, middlewares, bonnes pratiques

### 📘 TypeScript (v4.0.0+)
- [**TypeScript Guide Complet**](TYPESCRIPT.md) - Generic Model, Schema Builder typé, Migrations typées

### 🛠️ Outils
- [Migrations](MIGRATIONS.md)
- [CLI (outlet-init, outlet-migrate, outlet-convert)](CLI.md)

### 🏗️ Référence
- [Architecture](ARCHITECTURE.md)
- [API Reference](API_REFERENCE.md)

### 📋 Autres
- [Changelog](../CHANGELOG.md)
- [Contributing](../CONTRIBUTING.md)

---

## Aperçu rapide

```javascript
const { Model } = require('outlet-orm');

// Définition du modèle Post (voir Relations)
class Post extends Model {
  static table = 'posts';
}

// Définir un modèle (connexion automatique via .env)
class User extends Model {
  static table = 'users';
  static softDeletes = true;
  static rules = { email: 'required|email' };
  
  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

// Utilisation - la connexion est initialisée automatiquement depuis .env
const users = await User.with('posts').where('status', 'active').get();
```

> 💡 **Connexion automatique** : Créez simplement un fichier `.env` avec vos paramètres de connexion. Le Model se connecte automatiquement à la première utilisation.

## Nouveautés v4.0.0

| Fonctionnalité | Description |
|----------------|-------------|
| 📘 **Generic Model** | `Model<TAttributes>` pour typage fort des attributs |
| 🔒 **Type-safe getAttribute** | Retourne le type correct basé sur votre interface |
| 🏗️ **Schema Builder typé** | Interfaces complètes pour migrations typées |
| 📝 **MigrationInterface** | Structure standard pour migrations TypeScript |
| ✅ **ValidationRule étendu** | `url`, `array`, `integer`, `alpha`, etc. |
| 🎯 **ModelEventName** | Union type pour tous les événements |
| 🔍 **WhereOperator** | Union type pour tous les opérateurs |

### Fonctionnalités héritées (v3.0.0)

| Fonctionnalité | Description |
|----------------|-------------|
| 🔄 **Transactions** | `beginTransaction()`, `commit()`, `rollback()`, `transaction()` |
| 🗑️ **Soft Deletes** | Suppression logique avec `deleted_at` |
| 🔬 **Scopes** | Filtres réutilisables globaux et locaux |
| 📣 **Events** | Hooks sur le cycle de vie des modèles |
| ✅ **Validation** | Règles de validation intégrées |
| 📊 **Query Logging** | Mode debug pour analyser les requêtes |

## Support

- **GitHub**: [github.com/omgbwa-yasse/outlet-orm](https://github.com/omgbwa-yasse/outlet-orm)
- **npm**: [npmjs.com/package/outlet-orm](https://www.npmjs.com/package/outlet-orm)
- **Issues**: [Signaler un bug](https://github.com/omgbwa-yasse/outlet-orm/issues)

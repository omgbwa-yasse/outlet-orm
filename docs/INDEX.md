# 📚 Outlet ORM - Documentation Complète

> **Version 3.0.0** - Un ORM JavaScript inspiré de Laravel Eloquent pour Node.js

## Table des matières

### 🚀 Démarrage
- [Guide de démarrage rapide](QUICKSTART.md)
- [Installation et Configuration](INSTALLATION.md)

### 📖 Guides essentiels
- [Modèles et CRUD](MODELS.md)
- [Query Builder](QUERY_BUILDER.md)
- [Relations](RELATIONS.md)
- [Détection automatique des relations](RELATIONS_DETECTION.md)

### ⚡ Fonctionnalités avancées (v3.0.0)
- [Transactions](TRANSACTIONS.md)
- [Soft Deletes](SOFT_DELETES.md)
- [Scopes (Globaux et Locaux)](SCOPES.md)
- [Events / Hooks](EVENTS.md)
- [Validation](VALIDATION.md)
- [Query Logging](QUERY_LOGGING.md)

### 🛠️ Outils
- [Migrations](MIGRATIONS.md)
- [CLI (outlet-init, outlet-migrate, outlet-convert)](CLI.md)

### 🏗️ Référence
- [Architecture](ARCHITECTURE.md)
- [API Reference](API_REFERENCE.md)
- [TypeScript](TYPESCRIPT.md)

### 📋 Autres
- [Changelog](../CHANGELOG.md)
- [Contributing](../CONTRIBUTING.md)

---

## Aperçu rapide

```javascript
const { Model } = require('outlet-orm');

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

## Nouveautés v3.0.0

| Fonctionnalité | Description |
|----------------|-------------|
| 🔄 **Transactions** | `beginTransaction()`, `commit()`, `rollback()`, `transaction()` |
| 🗑️ **Soft Deletes** | Suppression logique avec `deleted_at` |
| 🔬 **Scopes** | Filtres réutilisables globaux et locaux |
| 📣 **Events** | Hooks sur le cycle de vie des modèles |
| ✅ **Validation** | Règles de validation intégrées |
| 📊 **Query Logging** | Mode debug pour analyser les requêtes |
| 🐘 **PostgreSQL Pool** | Connexions poolées pour de meilleures performances |
| 🛡️ **SQL Sanitization** | Protection contre l'injection SQL |

## Support

- **GitHub**: [github.com/omgbwa-yasse/outlet-orm](https://github.com/omgbwa-yasse/outlet-orm)
- **npm**: [npmjs.com/package/outlet-orm](https://www.npmjs.com/package/outlet-orm)
- **Issues**: [Signaler un bug](https://github.com/omgbwa-yasse/outlet-orm/issues)

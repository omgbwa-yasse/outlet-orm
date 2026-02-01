# 🔐 Sécurité Backend

Ce guide décrit les bonnes pratiques de sécurité pour les applications utilisant Outlet ORM.

> ⚠️ **Important** : La structure de dossiers seule ne garantit pas la sécurité. L'implémentation et le respect des bonnes pratiques sont essentiels.

## Structure de Projet Sécurisée

```
mon-projet/
├── .env                        # ⚠️ JAMAIS commité (dans .gitignore)
├── .env.example                # Template sans secrets
├── .gitignore                  # Exclure .env, node_modules, logs
├── package.json
├── config/                     # 🔒 Configuration centralisée
│   ├── app.js                  # Config générale
│   ├── database.js             # Config DB (lit .env)
│   ├── cors.js                 # Config CORS
│   └── security.js             # Rate limit, helmet...
├── database/
│   ├── config.js               # Config migrations (généré par outlet-init)
│   └── migrations/
├── models/                     # Vos classes Model
├── controllers/                # Logique métier
├── routes/                     # Routes API/Web
├── middlewares/                # 🔒 CRUCIAL pour la sécurité
│   ├── auth.js                 # Authentification JWT/Session
│   ├── authorization.js        # Contrôle des permissions (RBAC)
│   ├── rateLimiter.js          # Protection anti-DDoS
│   ├── sanitizer.js            # Nettoyage des entrées (XSS)
│   ├── validator.js            # Validation des entrées
│   └── errorHandler.js         # Gestion centralisée des erreurs
├── services/                   # Services métier
├── utils/                      # 🔒 Utilitaires sécurité
│   ├── encryption.js           # Chiffrement/déchiffrement
│   ├── hash.js                 # Hachage mots de passe (bcrypt)
│   └── token.js                # Génération tokens sécurisés
├── validators/                 # 🔒 Schémas de validation
│   ├── userValidator.js
│   └── postValidator.js
├── public/                     # ✅ Seul dossier accessible publiquement
│   ├── images/
│   ├── css/
│   └── js/
├── uploads/                    # ⚠️ Fichiers uploadés (validés)
├── logs/                       # 📋 Journaux (non publics)
│   ├── access.log
│   ├── error.log
│   └── security.log
├── src/
│   └── index.js
└── tests/
```

## Checklist de Sécurité

### 🔴 Priorité Critique

| Action | Description | Status |
|--------|-------------|--------|
| `.env` dans `.gitignore` | Ne jamais commiter les secrets | ☐ |
| Hachage des mots de passe | Bcrypt avec 10+ rounds | ☐ |
| Protection SQL Injection | Utiliser l'ORM (Outlet protège) | ☐ |
| Protection XSS | Sanitizer les entrées/sorties | ☐ |
| HTTPS obligatoire | TLS/SSL en production | ☐ |
| Validation des entrées | Valider TOUTES les données utilisateur | ☐ |

### 🟠 Priorité Importante

| Action | Description | Status |
|--------|-------------|--------|
| JWT sécurisé | Expiration courte, refresh token | ☐ |
| Rate Limiting | Limiter requêtes par IP | ☐ |
| Headers sécurité | Helmet.js | ☐ |
| Protection CSRF | Token pour formulaires | ☐ |
| CORS configuré | Whitelist des origines | ☐ |

### 🟡 Recommandé

| Action | Description | Status |
|--------|-------------|--------|
| Logging sécurité | Journaliser accès/erreurs | ☐ |
| Audit des dépendances | `npm audit` régulier | ☐ |
| Variables d'environnement | Pas de secrets en dur | ☐ |

---

## Configuration Sécurisée

### .gitignore

```gitignore
# Secrets
.env
.env.local
.env.production

# Logs
logs/
*.log

# Uploads non versionnés
uploads/

# Dépendances
node_modules/

# Build
dist/
build/
```

### .env.example

```env
# Base de données
DB_DRIVER=mysql
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=myapp
DB_USER=your_user
DB_PASSWORD=your_password

# Sécurité
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Application
NODE_ENV=development
PORT=3000

# CORS
CORS_ORIGIN=http://localhost:3000
```

---

## Middlewares de Sécurité

### Installation des dépendances

```bash
npm install helmet express-rate-limit xss-clean hpp bcrypt jsonwebtoken express-validator
```

### config/security.js

```javascript
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const hpp = require('hpp');

module.exports = {
  // Headers de sécurité HTTP
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),

  // Rate limiting (100 requêtes/15min par IP)
  rateLimiter: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: {
      error: 'Trop de requêtes, réessayez dans 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
  }),

  // Rate limiting strict pour auth (5 tentatives/15min)
  authLimiter: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
      error: 'Trop de tentatives de connexion'
    }
  }),

  // Protection XSS
  xss: xss(),

  // Protection pollution paramètres HTTP
  hpp: hpp(),
};
```

### middlewares/auth.js

```javascript
const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware d'authentification JWT
 */
const authenticate = async (req, res, next) => {
  try {
    // Récupérer le token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const token = authHeader.split(' ')[1];

    // Vérifier le token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Récupérer l'utilisateur
    const user = await User.find(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Utilisateur non trouvé' });
    }

    // Attacher l'utilisateur à la requête
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expiré' });
    }
    return res.status(401).json({ error: 'Token invalide' });
  }
};

/**
 * Middleware d'autorisation par rôle
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Non authentifié' });
    }

    const userRole = req.user.getAttribute('role');
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
```

### middlewares/validator.js

```javascript
const { validationResult } = require('express-validator');

/**
 * Middleware de validation des requêtes
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Exécuter toutes les validations
    await Promise.all(validations.map(validation => validation.run(req)));

    // Vérifier les erreurs
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Données invalides',
        details: errors.array()
      });
    }

    next();
  };
};

module.exports = { validate };
```

### middlewares/errorHandler.js

```javascript
/**
 * Gestionnaire d'erreurs centralisé
 */
const errorHandler = (err, req, res, next) => {
  // Log l'erreur (en production, utiliser un logger comme Winston)
  console.error(`[${new Date().toISOString()}] Error:`, err);

  // Ne pas exposer les détails en production
  const isDev = process.env.NODE_ENV === 'development';

  // Erreurs de validation Outlet ORM
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation échouée',
      details: isDev ? err.errors : undefined
    });
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token invalide' });
  }

  // Erreur par défaut
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Erreur serveur',
    stack: isDev ? err.stack : undefined
  });
};

module.exports = errorHandler;
```

---

## Utilitaires de Sécurité

### utils/hash.js

```javascript
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

/**
 * Hacher un mot de passe
 */
const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

/**
 * Vérifier un mot de passe
 */
const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

module.exports = { hashPassword, verifyPassword };
```

### utils/token.js

```javascript
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Générer un token JWT
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

/**
 * Générer un refresh token
 */
const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

/**
 * Générer un token de réinitialisation
 */
const generateResetToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
};

module.exports = { 
  generateAccessToken, 
  generateRefreshToken, 
  generateResetToken 
};
```

---

## Application des Middlewares

### src/index.js

```javascript
const express = require('express');
const cors = require('cors');
const security = require('./config/security');
const errorHandler = require('./middlewares/errorHandler');
const routes = require('./routes');

const app = express();

// 🔒 Middlewares de sécurité (AVANT les routes)
app.use(security.helmet);
app.use(security.rateLimiter);
app.use(security.xss);
app.use(security.hpp);

// CORS configuré
app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parser JSON avec limite
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Fichiers statiques (seulement public/)
app.use('/static', express.static('public'));

// Routes
app.use('/api', routes);

// 🔒 Gestionnaire d'erreurs (APRÈS les routes)
app.use(errorHandler);

// Démarrage
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## Exemple de Route Sécurisée

### routes/userRoutes.js

```javascript
const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');
const security = require('../config/security');
const UserController = require('../controllers/UserController');

const router = express.Router();

// Routes publiques avec rate limiting strict
router.post('/register',
  security.authLimiter,
  validate([
    body('name').trim().isLength({ min: 2, max: 100 }).escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).matches(/^(?=.*[A-Za-z])(?=.*\d)/),
  ]),
  UserController.register
);

router.post('/login',
  security.authLimiter,
  validate([
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ]),
  UserController.login
);

// Routes protégées
router.get('/profile',
  authenticate,
  UserController.getProfile
);

router.put('/profile',
  authenticate,
  validate([
    body('name').optional().trim().isLength({ min: 2, max: 100 }).escape(),
    body('email').optional().isEmail().normalizeEmail(),
  ]),
  UserController.updateProfile
);

// Routes admin seulement
router.get('/users',
  authenticate,
  authorize('admin'),
  UserController.getAllUsers
);

router.delete('/users/:id',
  authenticate,
  authorize('admin'),
  UserController.deleteUser
);

module.exports = router;
```

---

## Modèle User Sécurisé

### models/User.js

```javascript
const { Model } = require('outlet-orm');
const { hashPassword, verifyPassword } = require('../utils/hash');

class User extends Model {
  static table = 'users';
  
  // ⚠️ Ne jamais exposer le mot de passe
  static hidden = ['password', 'refresh_token', 'reset_token'];
  
  static fillable = ['name', 'email', 'password', 'role'];
  
  static casts = {
    id: 'int',
    email_verified: 'boolean',
    created_at: 'date',
    updated_at: 'date'
  };
  
  static rules = {
    name: 'required|string|min:2|max:100',
    email: 'required|email',
    password: 'required|min:8'
  };

  /**
   * Hook: Hacher le mot de passe avant création
   */
  static boot() {
    this.creating(async (user) => {
      const password = user.getAttribute('password');
      if (password) {
        user.setAttribute('password', await hashPassword(password));
      }
    });

    this.updating(async (user) => {
      const password = user.getAttribute('password');
      // Hacher seulement si le mot de passe a changé
      if (password && !password.startsWith('$2b$')) {
        user.setAttribute('password', await hashPassword(password));
      }
    });
  }

  /**
   * Vérifier le mot de passe
   */
  async checkPassword(password) {
    return verifyPassword(password, this.getAttribute('password'));
  }
}

module.exports = User;
```

---

## Protection Outlet ORM Intégrée

Outlet ORM fournit déjà plusieurs protections :

### ✅ Protection SQL Injection

```javascript
// ✅ Sécurisé - Paramètres échappés automatiquement
const users = await User.where('email', userInput).get();

// ✅ Sécurisé - whereIn avec tableau
const users = await User.whereIn('id', [1, 2, 3]).get();

// ⚠️ Attention avec whereRaw - échapper manuellement
const users = await User.whereRaw('email = ?', [userInput]).get();
```

### ✅ Mass Assignment Protection

```javascript
// ✅ Seuls les champs fillable sont assignés
const user = await User.create(req.body);

// ✅ Les champs sensibles sont ignorés
static fillable = ['name', 'email']; // 'role' exclu = non modifiable
```

### ✅ Attributs Cachés

```javascript
// ✅ Mot de passe jamais exposé dans JSON
static hidden = ['password'];

const user = await User.find(1);
console.log(user.toJSON()); // { id: 1, name: "John", email: "..." }
```

---

## Prochaines étapes

- [Installation](INSTALLATION.md) - Configuration initiale
- [Validation](VALIDATION.md) - Règles de validation
- [Transactions](TRANSACTIONS.md) - Opérations atomiques
- [Events](EVENTS.md) - Hooks de cycle de vie

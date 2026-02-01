# Outlet ORM - Security Best Practices

[← Back to Index](SKILL.md) | [Previous: API](API.md)

> 🔐 **Security**: This guide covers backend security practices when using Outlet ORM.

---

## Security Checklist

### 🔴 Critical Priority

| Action | Description | Outlet ORM Feature |
|--------|-------------|-------------------|
| `.env` in `.gitignore` | Never commit secrets | Auto-connect from .env |
| Password hashing | Bcrypt with 10+ rounds | Use `utils/hash.js` |
| SQL Injection protection | Use ORM queries | ✅ Built-in protection |
| XSS protection | Sanitize inputs/outputs | Use middleware |
| Input validation | Validate ALL user data | `static rules` + middleware |

### 🟠 Important Priority

| Action | Description |
|--------|-------------|
| Secure JWT | Short expiration, refresh tokens |
| Rate limiting | Limit requests per IP |
| Security headers | Use Helmet.js |
| CSRF protection | Token for forms |
| CORS configuration | Whitelist origins |

---

## Secure Project Structure (Layered Architecture)

```
my-project/
├── .env                       # ⚠️ NEVER commit
├── .env.example               # Template without secrets
├── .gitignore
├── src/
│   ├── controllers/           # 🎮 HTTP handling only
│   ├── services/              # ⚙️ Business logic
│   ├── repositories/          # 📦 Data access layer
│   ├── models/                # 📊 outlet-orm models
│   ├── middlewares/           # 🔒 CRITICAL for security
│   │   ├── auth.js            # JWT authentication
│   │   ├── authorization.js   # RBAC permissions
│   │   ├── rateLimiter.js     # Anti-DDoS
│   │   ├── validator.js       # Input validation
│   │   └── errorHandler.js    # Error handling
│   ├── config/                # 🔒 Centralized config
│   │   └── security.js        # Rate limit, helmet, CORS
│   ├── utils/                 # 🔒 Security utilities
│   │   ├── hash.js            # Bcrypt password hashing
│   │   └── token.js           # JWT token generation
│   └── validators/            # 🔒 Validation schemas
├── public/                    # ✅ Only public folder
├── logs/                      # 📋 Not versioned
└── tests/
```
```

---

## Outlet ORM Built-in Security

### ✅ SQL Injection Protection

```javascript
// ✅ SECURE - Parameters automatically escaped
const users = await User.where('email', userInput).get();

// ✅ SECURE - whereIn with array
const users = await User.whereIn('id', [1, 2, 3]).get();

// ⚠️ CAUTION with whereRaw - escape manually
const users = await User.whereRaw('email = ?', [userInput]).get();
```

### ✅ Mass Assignment Protection

```javascript
class User extends Model {
  // 🔒 Only these fields can be mass-assigned
  static fillable = ['name', 'email'];
  
  // 'role', 'is_admin' excluded = cannot be modified via create/fill
}

// ✅ SECURE - role is ignored even if in req.body
const user = await User.create(req.body);
```

### ✅ Hidden Attributes

```javascript
class User extends Model {
  // 🔒 Never exposed in JSON
  static hidden = ['password', 'refresh_token', 'reset_token'];
}

const user = await User.find(1);
console.log(user.toJSON()); 
// { id: 1, name: "John", email: "..." }
// password is NOT included
```

---

## Secure Model Example

```javascript
const { Model } = require('outlet-orm');
const { hashPassword, verifyPassword } = require('../utils/hash');

class User extends Model {
  static table = 'users';
  
  // 🔒 Mass assignment protection
  static fillable = ['name', 'email', 'password'];
  
  // 🔒 Never expose sensitive data
  static hidden = ['password', 'refresh_token', 'reset_token'];
  
  // Type casting
  static casts = {
    id: 'int',
    email_verified: 'boolean',
    created_at: 'date'
  };
  
  // 🔒 Validation rules
  static rules = {
    name: 'required|string|min:2|max:100',
    email: 'required|email',
    password: 'required|min:8'
  };

  // 🔒 Hash password before saving
  static boot() {
    this.creating(async (user) => {
      const password = user.getAttribute('password');
      if (password) {
        user.setAttribute('password', await hashPassword(password));
      }
    });

    this.updating(async (user) => {
      const password = user.getAttribute('password');
      // Only hash if password changed
      if (password && !password.startsWith('$2b$')) {
        user.setAttribute('password', await hashPassword(password));
      }
    });
  }

  // 🔒 Password verification method
  async checkPassword(password) {
    return verifyPassword(password, this.getAttribute('password'));
  }
}

module.exports = User;
```

---

## Authentication Middleware

```javascript
// middlewares/auth.js
const jwt = require('jsonwebtoken');
const { User } = require('../models');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token missing' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.find(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userRole = req.user.getAttribute('role');
    if (!roles.includes(userRole)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    next();
  };
};

module.exports = { authenticate, authorize };
```

---

## Secure Route Example

```javascript
const express = require('express');
const { body } = require('express-validator');
const { authenticate, authorize } = require('../middlewares/auth');
const { validate } = require('../middlewares/validator');
const UserController = require('../controllers/UserController');

const router = express.Router();

// 🔒 Public routes with strict rate limiting
router.post('/register',
  validate([
    body('name').trim().isLength({ min: 2, max: 100 }).escape(),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }),
  ]),
  UserController.register
);

// 🔒 Protected routes
router.get('/profile',
  authenticate,
  UserController.getProfile
);

// 🔒 Admin only
router.delete('/users/:id',
  authenticate,
  authorize('admin'),
  UserController.deleteUser
);

module.exports = router;
```

---

## Security Utilities

### utils/hash.js

```javascript
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

const hashPassword = async (password) => {
  return bcrypt.hash(password, SALT_ROUNDS);
};

const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

module.exports = { hashPassword, verifyPassword };
```

### utils/token.js

```javascript
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

const generateRefreshToken = () => {
  return crypto.randomBytes(64).toString('hex');
};

module.exports = { generateAccessToken, generateRefreshToken };
```

---

## Security Configuration

### config/security.js

```javascript
module.exports = {
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: { error: 'Too many requests' }
  },
  
  // Strict rate limit for auth
  authRateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts' }
  },
  
  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '15m'
  }
};
```

---

## Required Dependencies

```bash
npm install helmet express-rate-limit xss-clean hpp bcrypt jsonwebtoken express-validator
```

---

## Common Security Mistakes

### ❌ DON'T

```javascript
// ❌ Never store passwords in plain text
user.setAttribute('password', req.body.password);

// ❌ Never expose sensitive data
static hidden = []; // Empty!

// ❌ Never use raw queries with user input
await db.execute(`SELECT * FROM users WHERE email = '${email}'`);

// ❌ Never commit .env
// .gitignore missing .env
```

### ✅ DO

```javascript
// ✅ Hash passwords
user.setAttribute('password', await hashPassword(req.body.password));

// ✅ Hide sensitive fields
static hidden = ['password', 'refresh_token'];

// ✅ Use parameterized queries
await User.where('email', email).first();

// ✅ Use .env.example for templates
```

---

## References

- [Full Security Guide](../../../docs/SECURITY.md)
- [Validation](ADVANCED.md#validation)
- [Events/Hooks](ADVANCED.md#events)

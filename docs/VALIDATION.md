# ✅ Validation

Outlet ORM v4.0.0 inclut un système de validation intégré pour valider les données avant sauvegarde.

> 📘 **TypeScript** : Le type `ValidationRule` inclut toutes les règles disponibles. Voir [TYPESCRIPT.md](TYPESCRIPT.md).

> 📁 **Emplacement** : Définissez vos règles dans `models/` — Voir [Structure de projet](INSTALLATION.md#structure-de-projet-recommandée)

## Configuration

### Définir les règles

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
  
  // Règles de validation
  static rules = {
    name: 'required|string|min:2|max:100',
    email: 'required|email',
    password: 'required|string|min:8',
    age: 'integer|min:0|max:150',
    website: 'url',
    role: 'in:admin,moderator,user'
  };
}
```

## Règles disponibles

| Règle | Description | Exemple |
|-------|-------------|---------|
| `required` | Champ obligatoire | `'required'` |
| `string` | Doit être une chaîne | `'string'` |
| `integer` | Doit être un entier | `'integer'` |
| `numeric` | Doit être numérique | `'numeric'` |
| `number` | Alias de numeric | `'number'` |
| `email` | Format email valide | `'email'` |
| `url` | Format URL valide | `'url'` |
| `date` | Format date valide | `'date'` |
| `array` | Doit être un tableau | `'array'` |
| `alpha` | Lettres uniquement | `'alpha'` |
| `alphanumeric` | Lettres et chiffres | `'alphanumeric'` |
| `min:n` | Longueur/valeur minimum | `'min:3'` |
| `max:n` | Longueur/valeur maximum | `'max:255'` |
| `in:a,b,c` | Doit être parmi les valeurs | `'in:active,inactive'` |
| `boolean` | Doit être un booléen | `'boolean'` |
| `regex:pattern` | Correspond au pattern | `'regex:^[A-Z]+'` |
| `confirmed` | Doit avoir un champ _confirmation | `'confirmed'` |

## Utilisation

### Valider manuellement

```javascript
const user = new User({
  name: 'J',  // Trop court
  email: 'invalid-email',  // Format invalide
  password: '123'  // Trop court
});

const result = user.validate();

if (!result.valid) {
  console.log('Erreurs de validation:', result.errors);
  // {
  //   name: ['Le champ name doit avoir au moins 2 caractères'],
  //   email: ['Le champ email doit être une adresse email valide'],
  //   password: ['Le champ password doit avoir au moins 8 caractères']
  // }
}
```

### Structure du résultat

```javascript
const result = user.validate();

// Si valide
{
  valid: true,
  errors: {}
}

// Si invalide
{
  valid: false,
  errors: {
    field1: ['Message d\'erreur 1', 'Message d\'erreur 2'],
    field2: ['Message d\'erreur']
  }
}
```

### Valider avant save

```javascript
const user = new User({
  name: 'John',
  email: 'john@example.com',
  password: 'securepassword123'
});

const validation = user.validate();

if (validation.valid) {
  await user.save();
  console.log('Utilisateur créé!');
} else {
  console.error('Validation échouée:', validation.errors);
}
```

### Validation automatique avec events

```javascript
class User extends Model {
  static table = 'users';
  
  static rules = {
    name: 'required|string|min:2',
    email: 'required|email'
  };

  static boot() {
    this.saving((user) => {
      const result = user.validate();
      if (!result.valid) {
        const errors = Object.values(result.errors).flat().join(', ');
        throw new Error(`Validation failed: ${errors}`);
      }
    });
  }
}

// Utilisation - lance une erreur si invalide
try {
  await User.create({ name: 'J', email: 'bad' });
} catch (error) {
  console.error(error.message);
  // "Validation failed: name must be at least 2 characters, email must be valid"
}
```

## Exemples de règles

### Champ obligatoire

```javascript
static rules = {
  title: 'required'
};
```

### Chaîne avec longueur

```javascript
static rules = {
  username: 'required|string|min:3|max:20'
};
```

### Email

```javascript
static rules = {
  email: 'required|email'
};
```

### Nombre avec limites

```javascript
static rules = {
  age: 'required|integer|min:0|max:150',
  price: 'required|numeric|min:0'
};
```

### Valeurs énumérées

```javascript
static rules = {
  status: 'required|in:pending,active,suspended,deleted',
  role: 'in:admin,moderator,user'
};
```

### URL

```javascript
static rules = {
  website: 'url',
  avatar_url: 'url'
};
```

### Booléen

```javascript
static rules = {
  is_active: 'boolean',
  newsletter: 'boolean'
};
```

## Exemples complets

### Modèle Article

```javascript
class Article extends Model {
  static table = 'articles';
  
  static rules = {
    title: 'required|string|min:5|max:200',
    slug: 'required|string|min:5|max:200',
    content: 'required|string|min:100',
    status: 'required|in:draft,published,archived',
    author_id: 'required|integer',
    category_id: 'integer'
  };
}
```

### Modèle Product

```javascript
class Product extends Model {
  static table = 'products';
  
  static rules = {
    name: 'required|string|min:2|max:100',
    description: 'string|max:1000',
    price: 'required|numeric|min:0',
    stock: 'required|integer|min:0',
    sku: 'required|string|min:3|max:50',
    status: 'required|in:active,inactive,discontinued'
  };
}
```

### Modèle Registration

```javascript
class Registration extends Model {
  static table = 'registrations';
  
  static rules = {
    first_name: 'required|string|min:2|max:50',
    last_name: 'required|string|min:2|max:50',
    email: 'required|email',
    password: 'required|string|min:8',
    phone: 'string|min:10|max:20',
    terms_accepted: 'required|boolean'
  };
}
```

## Validation dans les contrôleurs

### Express.js

```javascript
app.post('/users', async (req, res) => {
  const user = new User(req.body);
  const validation = user.validate();
  
  if (!validation.valid) {
    return res.status(422).json({
      message: 'Validation failed',
      errors: validation.errors
    });
  }
  
  try {
    await user.save();
    res.status(201).json(user.toJSON());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
```

### Middleware de validation

```javascript
function validateModel(ModelClass) {
  return (req, res, next) => {
    const instance = new ModelClass(req.body);
    const result = instance.validate();
    
    if (!result.valid) {
      return res.status(422).json({
        message: 'Validation failed',
        errors: result.errors
      });
    }
    
    req.validatedModel = instance;
    next();
  };
}

// Utilisation
app.post('/users', validateModel(User), async (req, res) => {
  await req.validatedModel.save();
  res.json(req.validatedModel.toJSON());
});
```

## Limitations actuelles

La validation v3.0.0 est basique. Pour des validations plus complexes, utilisez des librairies spécialisées :

```javascript
const Joi = require('joi');

class User extends Model {
  static table = 'users';

  static joiSchema = Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required(),
    age: Joi.number().integer().min(0).max(150),
    role: Joi.string().valid('admin', 'moderator', 'user')
  });

  validateWithJoi() {
    return User.joiSchema.validate(this.attributes, { abortEarly: false });
  }

  static boot() {
    this.saving((user) => {
      const { error } = user.validateWithJoi();
      if (error) {
        throw new Error(error.details.map(d => d.message).join(', '));
      }
    });
  }
}
```

## Messages d'erreur personnalisés

Les messages sont en anglais par défaut. Pour les personnaliser :

```javascript
class User extends Model {
  static rules = {
    name: 'required|min:2',
    email: 'required|email'
  };

  validate() {
    const result = super.validate();
    
    // Personnaliser les messages
    const customMessages = {
      name: {
        required: 'Le nom est obligatoire',
        min: 'Le nom doit contenir au moins 2 caractères'
      },
      email: {
        required: 'L\'email est obligatoire',
        email: 'Veuillez entrer un email valide'
      }
    };
    
    // Remplacer les messages
    for (const field in result.errors) {
      if (customMessages[field]) {
        result.errors[field] = result.errors[field].map(msg => {
          for (const rule in customMessages[field]) {
            if (msg.includes(rule)) {
              return customMessages[field][rule];
            }
          }
          return msg;
        });
      }
    }
    
    return result;
  }
}
```

## Prochaines étapes

- [Events](EVENTS.md) - Hooks sur le cycle de vie
- [Models](MODELS.md) - Guide complet des modèles
- [Transactions](TRANSACTIONS.md) - Opérations atomiques

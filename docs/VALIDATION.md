# ✅ Validation

Outlet ORM v4.0.0 includes a built-in validation system to validate data before saving.

> 📘 **TypeScript**: The type`ValidationRule`includes all available rules. See [TYPESCRIPT.md](TYPESCRIPT.md).

> 📁 **Location**: Define your rules in`models/`and validate in`controllers/`or`middlewares/`— See [Project structure](INSTALLATION.md#structure-de-projet-recommandée)

## Configuration

### Set rules

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';
  
  // Validation rules
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

## Rules available

| Rule | Description | Example |
|-------|-------------|---------|
|`required`| Mandatory field |`'required'`|
|`string`| Must be a string |`'string'`|
|`integer`| Must be an integer |`'integer'`|
|`numeric`| Must be digital |`'numeric'`|
|`number`| Numeric alias |`'number'`|
|`email`| Valid email format |`'email'`|
|`url`| Valid URL format |`'url'`|
|`date`| Valid date format |`'date'`|
|`array`| Must be an array |`'array'`|
|`alpha`| Letters only |`'alpha'`|
|`alphanumeric`| Letters and numbers |`'alphanumeric'`|
|`min:n`| Minimum length/value |`'min:3'`|
|`max:n`| Maximum length/value |`'max:255'`|
|`in:a,b,c`| Must be among the values ​​|`'in:active,inactive'`|
|`boolean`| Must be a boolean |`'boolean'`|
|`regex:pattern`| Matches pattern |`'regex:^[A-Z]+'`|
|`confirmed`| Must have a _confirmation |`'confirmed'`|

## Usage

### Validate manually

```javascript
const user = new User({
  name: 'J',  // Too short
  email: 'invalid-email',  // Format invalide
  password: '123'  // Too short
});

const result = user.validate();

if (!result.valid) {
  console.log('Validation errors:', result.errors);
  // {
  //   name: ['The name field must have at least 2 characters'],
  //   email: ['The email field must be a valid email address'],
  //   password: ['The password field must have at least 8 characters']
  // }
}
```

### Structure of the result

```javascript
const result = user.validate();

// And valid
{
  valid: true,
  errors: {}
}

// You are disabled
{
  valid: false,
  errors: {
    field1: ['Message d\'erreur 1', 'Message d\'erreur 2'],
    field2: ['Message d\'erreur']
  }
}
```

### Validate before saving

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

### Automatic validation with events

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

// Usage - throws error if invalid
try {
  await User.create({ name: 'J', email: 'bad' });
} catch (error) {
  console.error(error.message);
  // "Validation failed: name must be at least 2 characters, email must be valid"
}
```

## Example rules

### Mandatory field

```javascript
static rules = {
  title: 'required'
};
```

### Chain with length

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

### Number with limits

```javascript
static rules = {
  age: 'required|integer|min:0|max:150',
  price: 'required|numeric|min:0'
};
```

### Enumerated values

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

### Boolean

```javascript
static rules = {
  is_active: 'boolean',
  newsletter: 'boolean'
};
```

## Complete examples

### Item Model

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

### Model Product

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

### Model Registration

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

## Validation in controllers

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

### Validation middleware

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

// Usage
app.post('/users', validateModel(User), async (req, res) => {
  await req.validatedModel.save();
  res.json(req.validatedModel.toJSON());
});
```

## Current limitations

Validation v3.0.0 is basic. For more complex validations, use specialized libraries:

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

## Custom error messages

Messages are in English by default. To personalize them:

```javascript
class User extends Model {
  static rules = {
    name: 'required|min:2',
    email: 'required|email'
  };

  validate() {
    const result = super.validate();
    
    // Personalize messages
    const customMessages = {
      name: {
        required: 'Name is required',
        min: 'Le nom doit contenir au moins 2 caractères'
      },
      email: {
        required: 'L\'email est obligatoire',
        email: 'Veuillez entrer un email valide'
      }
    };
    
    // Replace messages
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

## Next steps

- [Events](EVENTS.md) - Hooks on the life cycle
- [Models](MODELS.md) - Complete Model Guide
- [Transactions](TRANSACTIONS.md) - Atomic operations

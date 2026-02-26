# Simplified Architecture Example

This example demonstrates the **outlet-orm 2-layer architecture** — a lightweight pattern for small and medium-sized applications that eliminates the `services/` and `repositories/` layers.

## Architecture

```
HTTP Request → Routes → Middlewares → Controllers → Models (outlet-orm) → Database
```

Business logic (validation, ownership checks, password hashing) lives **directly inside the controller methods**. No intermediary Service or Repository classes are needed.

## Structure

```
simplified-architecture/
├── index.js                   # Express app entry point
├── package.json
├── .env.example               # Environment variable template
├── models/
│   ├── User.js                # outlet-orm User model
│   └── Post.js                # outlet-orm Post model
├── controllers/
│   ├── UserController.js      # CRUD + login, inline business logic
│   └── PostController.js      # CRUD, inline ownership checks
└── routes/
    └── index.js               # RESTful Express router
```

## Requirements

- Node.js ≥ 18
- `outlet-orm` ≥ 5.5.0
- A running MySQL, PostgreSQL, or SQLite database

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Start the server
node index.js
```

The server starts on `http://localhost:3000` (or `PORT` from `.env`).

## API Endpoints

### Users

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/users` | List all users |
| `GET` | `/api/v1/users/:id` | Get a user with their posts |
| `POST` | `/api/v1/users` | Create a user |
| `PUT` | `/api/v1/users/:id` | Update a user |
| `DELETE` | `/api/v1/users/:id` | Delete a user |
| `POST` | `/api/v1/users/login` | Authenticate (returns user + token placeholder) |

### Posts

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/posts` | List all posts with their author |
| `GET` | `/api/v1/posts/:id` | Get a post with its author |
| `POST` | `/api/v1/posts` | Create a post |
| `PUT` | `/api/v1/posts/:id` | Update a post (owner only) |
| `DELETE` | `/api/v1/posts/:id` | Delete a post (owner only) |

## Key Patterns

### Inline business logic

```javascript
// UserController.js — store()
async store(req, res) {
  // Duplicate email check — no UserService.register() needed
  const existing = await User.where('email', req.body.email).first();
  if (existing) return res.status(409).json({ message: 'Email already in use' });

  const data = { ...req.body };
  data.password = await bcrypt.hash(data.password, 10);  // inline hash

  const user = await User.create(data);
  res.status(201).json({ success: true, data: user });
}
```

### Direct ORM queries

```javascript
// No repository — call outlet-orm directly
const user    = await User.find(id);
const users   = await User.all();
const byEmail = await User.where('email', email).first();
const posts   = await Post.with('user').get();
```

## When to Use This Pattern

✅ Small/medium application (< 20 endpoints)  
✅ Thin business logic per endpoint  
✅ Small team (1–3 developers)  
✅ Speed of development prioritised  

❌ Large application with complex shared logic → use the full 4-layer pattern  

See [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md#simplified-architecture-controllers--models) for the full comparison and migration guide.

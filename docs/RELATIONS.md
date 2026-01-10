# 🔗 Relations

Outlet ORM supporte toutes les relations Eloquent-style pour lier vos modèles.

## Types de relations

| Relation | Description | Exemple |
|----------|-------------|---------|
| `hasOne` | Un-à-un | User → Profile |
| `hasMany` | Un-à-plusieurs | User → Posts |
| `belongsTo` | Inverse de hasOne/hasMany | Post → User |
| `belongsToMany` | Plusieurs-à-plusieurs | User ↔ Roles |
| `hasManyThrough` | Un-à-plusieurs via intermédiaire | Country → Posts via Users |
| `hasOneThrough` | Un-à-un via intermédiaire | Supplier → UserHistory via User |
| `morphOne` | Polymorphique un-à-un | Post → Image (polymorphic) |
| `morphMany` | Polymorphique un-à-plusieurs | Post → Comments (polymorphic) |
| `morphTo` | Inverse polymorphique | Comment → (Post\|Video) |

## Has One (Un-à-un)

Un utilisateur a un profil.

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';

  profile() {
    return this.hasOne(Profile, 'user_id');
  }
}

class Profile extends Model {
  static table = 'profiles';

  user() {
    return this.belongsTo(User, 'user_id');
  }
}

// Utilisation
const user = await User.with('profile').find(1);
console.log(user.profile); // { id: 1, bio: '...', avatar: '...' }
```

**Paramètres:**
- `hasOne(RelatedModel, foreignKey, localKey)`
- `foreignKey`: défaut = `{model}_id` (ex: `user_id`)
- `localKey`: défaut = `id`

## Has Many (Un-à-plusieurs)

Un utilisateur a plusieurs posts.

```javascript
const { Model } = require('outlet-orm');

class User extends Model {
  static table = 'users';

  posts() {
    return this.hasMany(Post, 'user_id');
  }
}

class Post extends Model {
  static table = 'posts';

  author() {
    return this.belongsTo(User, 'user_id');
  }
}

// Utilisation
const user = await User.with('posts').find(1);
console.log(user.posts); // [{ id: 1, title: '...' }, { id: 2, title: '...' }]

// Charger l'auteur d'un post
const post = await Post.with('author').find(1);
console.log(post.author); // { id: 1, name: 'John' }
```

## Belongs To (Appartient à)

Inverse de hasOne et hasMany.

```javascript
const { Model } = require('outlet-orm');

// Définitions des modèles liés
class User extends Model { static table = 'users'; }
class Post extends Model { static table = 'posts'; }

class Comment extends Model {
  static table = 'comments';

  post() {
    return this.belongsTo(Post, 'post_id');
  }

  user() {
    return this.belongsTo(User, 'user_id');
  }
}

// Utilisation
const comment = await Comment.with('post', 'user').find(1);
console.log(comment.post);  // Le post parent
console.log(comment.user);  // L'auteur du commentaire
```

**Paramètres:**
- `belongsTo(RelatedModel, foreignKey, ownerKey)`
- `foreignKey`: clé étrangère sur le modèle courant
- `ownerKey`: défaut = `id`

## Belongs To Many (Plusieurs-à-plusieurs)

Utilisateurs et rôles via une table pivot.

```sql
-- Tables
users (id, name, email)
roles (id, name)
role_user (user_id, role_id)  -- Table pivot
```

```javascript
class User extends Model {
  static table = 'users';

  roles() {
    return this.belongsToMany(Role, 'role_user', 'user_id', 'role_id');
  }
}

class Role extends Model {
  static table = 'roles';

  users() {
    return this.belongsToMany(User, 'role_user', 'role_id', 'user_id');
  }
}

// Utilisation
const user = await User.with('roles').find(1);
console.log(user.roles); // [{ id: 1, name: 'admin' }, { id: 2, name: 'editor' }]

// Avec données pivot
const userWithPivot = await User.with('roles').find(1);
userWithPivot.roles.forEach(role => {
  console.log(role.pivot); // { user_id: 1, role_id: 2 }
});
```

**Paramètres:**
- `belongsToMany(RelatedModel, pivotTable, foreignPivotKey, relatedPivotKey, localKey, relatedKey)`

## Has Many Through (Via intermédiaire)

Pays → Posts via Users.

```sql
-- Un pays a plusieurs utilisateurs, chaque utilisateur a plusieurs posts
countries (id, name)
users (id, country_id, name)
posts (id, user_id, title)
```

```javascript
class Country extends Model {
  static table = 'countries';

  posts() {
    return this.hasManyThrough(
      Post,           // Modèle final
      User,           // Modèle intermédiaire
      'country_id',   // Clé étrangère sur User
      'user_id',      // Clé étrangère sur Post
      'id',           // Clé locale sur Country
      'id'            // Clé locale sur User
    );
  }
}

// Utilisation
const france = await Country.with('posts').where('name', 'France').first();
console.log(france.posts); // Tous les posts des utilisateurs français
```

## Has One Through (Un-à-un via intermédiaire)

Mécanicien → Propriétaire de voiture via Voiture.

```javascript
class Mechanic extends Model {
  static table = 'mechanics';

  carOwner() {
    return this.hasOneThrough(Owner, Car, 'mechanic_id', 'car_id', 'id', 'id');
  }
}
```

## Relations Polymorphiques

### Morph One (Polymorphique un-à-un)

Une image peut appartenir à un User ou un Post.

```sql
images (id, url, imageable_type, imageable_id)
-- imageable_type: 'User' ou 'Post'
-- imageable_id: l'ID correspondant
```

```javascript
class User extends Model {
  static table = 'users';

  image() {
    return this.morphOne(Image, 'imageable');
  }
}

class Post extends Model {
  static table = 'posts';

  image() {
    return this.morphOne(Image, 'imageable');
  }
}

class Image extends Model {
  static table = 'images';

  imageable() {
    return this.morphTo('imageable', {
      'User': User,
      'Post': Post
    });
  }
}

// Utilisation
const user = await User.with('image').find(1);
console.log(user.image); // { url: 'avatar.jpg', imageable_type: 'User' }

const image = await Image.with('imageable').find(1);
console.log(image.imageable); // Le User ou Post correspondant
```

### Morph Many (Polymorphique un-à-plusieurs)

Commentaires sur Posts et Videos.

```sql
comments (id, body, commentable_type, commentable_id)
```

```javascript
class Post extends Model {
  static table = 'posts';

  comments() {
    return this.morphMany(Comment, 'commentable');
  }
}

class Video extends Model {
  static table = 'videos';

  comments() {
    return this.morphMany(Comment, 'commentable');
  }
}

class Comment extends Model {
  static table = 'comments';

  commentable() {
    return this.morphTo('commentable', {
      'Post': Post,
      'Video': Video
    });
  }
}

// Utilisation
const post = await Post.with('comments').find(1);
console.log(post.comments); // Tous les commentaires du post

const comment = await Comment.with('commentable').find(1);
console.log(comment.commentable); // Le Post ou Video commenté
```

## Eager Loading

### Charger des relations

```javascript
// Une relation
const users = await User.with('posts').get();

// Plusieurs relations
const users = await User.with('posts', 'profile', 'roles').get();

// Relations imbriquées (nested)
const users = await User.with('posts.comments.author').get();

// Combiné
const users = await User.with('profile', 'posts.comments').get();
```

### Charger après coup

```javascript
const user = await User.find(1);

// Charger une relation
await user.load('posts');

// Charger plusieurs
await user.load('posts', 'profile');

// Accéder
console.log(user.posts);
console.log(user.profile);
```

## Accéder aux relations

Après eager loading, les relations sont accessibles comme propriétés:

```javascript
const user = await User.with('posts', 'profile').find(1);

// Propriétés directes
console.log(user.posts);    // Array de Post
console.log(user.profile);  // Objet Profile

// Itérer
for (const post of user.posts) {
  console.log(post.getAttribute('title'));
}
```

## Conventions de nommage

### Tables
- Singulier ou pluriel: `user` ou `users`
- Table pivot: ordre alphabétique `role_user` (pas `user_role`)

### Clés étrangères
- Format: `{model}_id`
- Exemples: `user_id`, `post_id`, `category_id`

### Colonnes polymorphiques
- Type: `{name}_type` (ex: `commentable_type`)
- ID: `{name}_id` (ex: `commentable_id`)

## Exemples complets

### Blog complet

```javascript
const { Model } = require('outlet-orm');

// Définition de tous les modèles
class Profile extends Model { static table = 'profiles'; }
class Role extends Model { static table = 'roles'; }
class Tag extends Model { static table = 'tags'; }
class Image extends Model { static table = 'images'; }

class Comment extends Model {
  static table = 'comments';

  post() { return this.belongsTo(Post, 'post_id'); }
  author() { return this.belongsTo(User, 'user_id'); }
}

class Post extends Model {
  static table = 'posts';

  author() { return this.belongsTo(User, 'user_id'); }
  comments() { return this.hasMany(Comment, 'post_id'); }
  tags() { return this.belongsToMany(Tag, 'post_tag', 'post_id', 'tag_id'); }
  image() { return this.morphOne(Image, 'imageable'); }
}

class User extends Model {
  static table = 'users';

  posts() { return this.hasMany(Post, 'user_id'); }
  profile() { return this.hasOne(Profile, 'user_id'); }
  roles() { return this.belongsToMany(Role, 'role_user', 'user_id', 'role_id'); }
}

// Requête complète
const posts = await Post
  .with('author.profile', 'comments.author', 'tags', 'image')
  .where('status', 'published')
  .orderBy('created_at', 'desc')
  .limit(10)
  .get();
```

## Prochaines étapes

- [Soft Deletes](SOFT_DELETES.md) - Suppression douce
- [Scopes](SCOPES.md) - Requêtes réutilisables
- [Events](EVENTS.md) - Hooks sur le cycle de vie

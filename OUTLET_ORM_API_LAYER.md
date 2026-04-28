# Outlet ORM — API Layer
## Spécification complète des fonctionnalités front-end

> **Version cible :** v13.0.0  
> **Contexte :** Extension d'Outlet ORM pour prendre en charge la lecture et l'écriture via des APIs REST/GraphQL, afin de permettre son utilisation dans des applications front-end sans backend JavaScript dédié.  
> **Import :** `Api` est exporté directement depuis `outlet-orm` — aucun sous-chemin nécessaire.

---

## Table des matières

1. [Vision & philosophie](#1-vision--philosophie)
2. [ApiModel — Modèle orienté endpoint](#2-apimodel--modèle-orienté-endpoint)
3. [Mapping HTTP ↔ ORM](#3-mapping-http--orm)
4. [ApiAdapter — Configuration & authentification](#4-apiadapter--configuration--authentification)
5. [Multi-adapter — Sources multiples](#5-multi-adapter--sources-multiples)
6. [Query Builder adapté REST](#6-query-builder-adapté-rest)
7. [Pagination API](#7-pagination-api)
8. [Relations inter-endpoints](#8-relations-inter-endpoints)
9. [Nested endpoints](#9-nested-endpoints)
10. [Cache intégré](#10-cache-intégré)
11. [Mode offline & queue de mutations](#11-mode-offline--queue-de-mutations)
12. [GraphQLModel](#12-graphqlmodel)
13. [Validation côté client avant envoi](#13-validation-côté-client-avant-envoi)
14. [Transformateurs request/response](#14-transformateurs-requestresponse)
15. [Réactivité — Polling & temps réel](#15-réactivité--polling--temps-réel)
16. [Gestion des erreurs API](#16-gestion-des-erreurs-api)
17. [Intercepteurs & middleware pipeline](#17-intercepteurs--middleware-pipeline)
18. [Retry & circuit breaker](#18-retry--circuit-breaker)
19. [Upload de fichiers](#19-upload-de-fichiers)
20. [Sérialisation avancée](#20-sérialisation-avancée)
21. [Mock adapter — Tests front-end](#21-mock-adapter--tests-front-end)
22. [CLI : outlet-api-import](#22-cli--outlet-api-import)
23. [TypeScript — Types API Layer](#23-typescript--types-api-layer)
24. [Logging & debugging API](#24-logging--debugging-api)
25. [Sécurité](#25-sécurité)
26. [Tableau de priorité](#26-tableau-de-priorité)
27. [Architecture interne](#27-architecture-interne)

---

## 1. Vision & philosophie

### Principe fondamental

L'API Layer d'Outlet ORM doit être un **drop-in transparent** de l'ORM classique. Un développeur qui connaît la syntaxe `Model` retrouve exactement ses repères avec `ApiModel`. La seule différence est la couche de transport : SQL est remplacé par HTTP.

```
Outlet ORM classique :   Model → DatabaseConnection → MySQL/PostgreSQL/SQLite
Outlet ORM API Layer :   Api   → ApiAdapter        → REST / GraphQL / WebSocket
```

### Syntaxe d'import — Un seul point d'entrée

`Api` est exporté directement depuis le package principal `outlet-orm`. Il n'y a pas de sous-chemin `/api` à importer.

```js
// ✅ Syntaxe correcte — CommonJS
const { Model, Api } = require('outlet-orm');

// ✅ Syntaxe correcte — ES Modules
import { Model, Api } from 'outlet-orm';
```

Les deux classes coexistent dans le même import :

```js
import { Model, Api } from 'outlet-orm';

// Modèle SQL — backend Node.js
class Product extends Model {
  static table = 'products';
}

// Modèle API — front React / React Native / Electron
// Compatible avec tout backend : Django, Laravel, Spring Boot, ASP.NET Core...
class User extends Api {
  static endpoint = '/users';
}
```

> **Pourquoi `Api` et pas `ApiModel` ?**  
> La classe s'appelle `Api` pour rester courte et lisible dans les déclarations de modèle. En interne, le fichier source s'appelle `ApiModel.js`. Les deux noms sont acceptés comme alias.

```js
// Les deux sont équivalents
import { Api, ApiModel } from 'outlet-orm';

class User extends Api { ... }      // ✅ recommandé
class Order extends ApiModel { ... } // ✅ alias valide
```

### Objectifs

- **Zéro friction** : même API fluente, même DX qu'Eloquent-style
- **Front-end first** : fonctionne dans le navigateur, React Native, Expo, Electron
- **Flexible** : supporte REST, GraphQL, API non-standard
- **Robuste** : cache, retry, offline, gestion d'erreurs
- **Testable** : mock adapter intégré, pas besoin de vraie API pour les tests

### Ce que l'API Layer n'est PAS

- Un proxy backend (pas de couche serveur intermédiaire)
- Un remplacement de l'ORM SQL (les deux coexistent dans le même projet)
- Un client HTTP générique (il reste orienté modèle/entité)

---

## 2. ApiModel — Modèle orienté endpoint

### Description

`ApiModel` est la classe de base pour tout modèle qui communique avec une API HTTP au lieu d'une base de données. Elle étend la même interface que `Model` et expose exactement les mêmes méthodes statiques et d'instance.

### Configuration d'un modèle

```js
import { Api } from 'outlet-orm';

class User extends Api {
  // Endpoint de base (obligatoire)
  static endpoint = '/users';

  // Clé primaire (défaut: 'id')
  static primaryKey = 'id';

  // Timestamps (défaut: true)
  static timestamps = true;

  // Champs autorisés à l'écriture
  static fillable = ['name', 'email', 'role'];

  // Champs exclus de la sérialisation JSON
  static hidden = ['password', 'token'];

  // Casts automatiques (identiques à Model)
  static casts = {
    id: 'int',
    is_active: 'boolean',
    metadata: 'json',
    created_at: 'date',
  };
}
```

### Utilisation — Lecture (GET)

```js
// Tous les enregistrements
const users = await User.all();
// → GET https://api.monapp.com/users

// Par ID
const user = await User.find(1);
// → GET https://api.monapp.com/users/1

// Trouver ou lancer une erreur
const user = await User.findOrFail(1);
// → ApiNotFoundError si 404

// Premier résultat
const first = await User.first();
// → GET https://api.monapp.com/users?limit=1

// Avec conditions
const actifs = await User.where('status', 'active').get();
// → GET https://api.monapp.com/users?status=active
```

### Utilisation — Écriture

```js
// Création
const user = await User.create({ name: 'Alice', email: 'alice@example.com' });
// → POST https://api.monapp.com/users

// Mise à jour (instance)
const user = await User.find(1);
user.name = 'Alice Martin';
await user.save();
// → PUT https://api.monapp.com/users/1

// Mise à jour (bulk)
await User.where('status', 'pending').update({ status: 'active' });
// → PATCH https://api.monapp.com/users (avec body { status: 'active', _where: { status: 'pending' } })

// Suppression
const user = await User.find(1);
await user.destroy();
// → DELETE https://api.monapp.com/users/1
```

### Propriétés d'instance disponibles

```js
const user = await User.find(1);

user.name;                   // accès direct (v11+ property style)
user.getAttribute('name');   // accès via méthode
user.isDirty();              // modifications non sauvegardées ?
user.getDirty();             // { name: 'nouveau' }
user.wasChanged('name');     // a changé lors du dernier save() ?
user.toJSON();               // objet plain (hidden exclus)
user.only('id', 'name');     // sous-ensemble d'attributs
user.except('password');     // tous sauf ceux listés
await user.fresh();          // recharge depuis l'API (nouvelle instance)
await user.refresh();        // recharge en place
user.replicate();            // clone sans id/timestamps
```

---

## 3. Mapping HTTP ↔ ORM

### Correspondance par défaut

| Action ORM | Méthode HTTP | URL générée |
|---|---|---|
| `find(id)` | `GET` | `/endpoint/:id` |
| `all()` / `get()` | `GET` | `/endpoint` |
| `create(data)` | `POST` | `/endpoint` |
| `save()` (création) | `POST` | `/endpoint` |
| `save()` (mise à jour) | `PUT` | `/endpoint/:id` |
| `update(attrs)` (bulk) | `PATCH` | `/endpoint` |
| `destroy()` | `DELETE` | `/endpoint/:id` |
| `delete()` (bulk) | `DELETE` | `/endpoint` |

### Personnalisation par modèle

Certaines APIs utilisent des conventions non-standard. Chaque méthode HTTP est configurable :

```js
import { Api } from 'outlet-orm';

class Order extends Api {
  static endpoint = '/orders';

  static httpMethods = {
    create: 'POST',       // défaut
    update: 'PATCH',      // override : PUT → PATCH
    bulkUpdate: 'POST',   // l'API utilise POST pour les bulk updates
    delete: 'POST',       // l'API utilise POST /orders/delete
    deleteEndpoint: '/orders/delete', // endpoint custom pour la suppression
  };
}
```

### Actions personnalisées (non-CRUD)

Pour les actions métier qui ne correspondent pas à un CRUD standard :

```js
import { Api } from 'outlet-orm';

class Order extends Api {
  static endpoint = '/orders';

  // Définir des actions custom
  static actions = {
    confirm:  { method: 'POST', path: '/:id/confirm' },
    cancel:   { method: 'POST', path: '/:id/cancel' },
    archive:  { method: 'PUT',  path: '/:id/archive' },
    export:   { method: 'GET',  path: '/export', responseType: 'blob' },
  };
}

// Utilisation
const order = await Order.find(1);
await order.action('confirm', { reason: 'Paiement reçu' });
// → POST /orders/1/confirm

const csv = await Order.runAction('export', { format: 'csv' });
// → GET /orders/export?format=csv
```

---

## 4. ApiAdapter — Configuration & authentification

### Description

L'`ApiAdapter` est le pont entre l'`ApiModel` et le réseau. Il gère : l'URL de base, les headers, l'authentification, les timeouts, et les hooks de cycle de vie de la requête.

### Configuration globale

```js
import { Api } from 'outlet-orm';

Api.configure({
  baseUrl: 'https://api.monapp.com',

  adapter: {
    // Headers statiques
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-App-Version': '1.0.0',
    },

    // Headers dynamiques (fonction appelée à chaque requête)
    dynamicHeaders: () => ({
      Authorization: `Bearer ${localStorage.getItem('access_token')}`,
      'Accept-Language': navigator.language,
    }),

    // Timeout en millisecondes (défaut: 10000)
    timeout: 8000,

    // Credentials (cookies cross-origin)
    credentials: 'include', // 'omit' | 'same-origin' | 'include'
  },
});
```

### Stratégies d'authentification

#### Bearer Token (JWT)

```js
Api.configure({
  auth: {
    type: 'bearer',
    token: () => localStorage.getItem('access_token'),
  }
});
```

#### Basic Auth

```js
Api.configure({
  auth: {
    type: 'basic',
    username: () => sessionStorage.getItem('user'),
    password: () => sessionStorage.getItem('pass'),
  }
});
```

#### API Key

```js
Api.configure({
  auth: {
    type: 'apiKey',
    key: 'X-Api-Key',
    value: () => process.env.REACT_APP_API_KEY,
    in: 'header', // 'header' | 'query'
  }
});
```

#### OAuth2 avec refresh automatique

```js
Api.configure({
  auth: {
    type: 'oauth2',
    token: () => tokenStore.get('access_token'),
    refreshToken: () => tokenStore.get('refresh_token'),

    // Appelé quand l'API retourne 401
    onUnauthorized: async (response, retryRequest) => {
      const newToken = await refreshAccessToken();
      tokenStore.set('access_token', newToken);
      return retryRequest(); // rejoue la requête originale
    },

    // Appelé quand le refresh échoue
    onRefreshFailed: () => {
      window.location.href = '/login';
    },
  }
});
```

#### Cookie session (SSR / Django / Laravel / ASP.NET Core)

```js
Api.configure({
  auth: {
    type: 'cookie',
    csrfToken: () => document.querySelector('[name=csrfmiddlewaretoken]')?.value,
    csrfHeader: 'X-CSRFToken',
  }
});
```

---

## 5. Multi-adapter — Sources multiples

### Description

Une application peut consommer plusieurs APIs différentes simultanément. Chaque modèle peut avoir son propre adapter.

```js
import { Api, createAdapter } from 'outlet-orm';

// Créer des adapters nommés
const authAdapter    = createAdapter({ baseUrl: 'https://auth.api.com',    timeout: 5000 });
const paymentAdapter = createAdapter({ baseUrl: 'https://pay.api.com',     timeout: 15000 });
const crmAdapter     = createAdapter({ baseUrl: 'https://crm.api.com',     timeout: 8000 });
const legacyAdapter  = createAdapter({ baseUrl: 'https://old.api.internal', timeout: 30000 });

// Assigner à chaque modèle
class User     extends Api { static adapter = authAdapter; }
class Invoice  extends Api { static adapter = paymentAdapter; }
class Contact  extends Api { static adapter = crmAdapter; }
class LegacyProduct extends Api { static adapter = legacyAdapter; }
```

### Adapter par défaut et override ponctuel

```js
// Adapter par défaut (utilisé si aucun adapter spécifié sur le modèle)
Api.setDefaultAdapter(authAdapter);

// Override ponctuel pour une requête
const users = await User.usingAdapter(crmAdapter).where('role', 'vip').get();
```

### Adapter conditionnel (environnement)

```js
const adapter = createAdapter({
  baseUrl: process.env.NODE_ENV === 'production'
    ? 'https://api.monapp.com'
    : 'http://localhost:8000',
});
```

---

## 6. Query Builder adapté REST

### Description

Le QueryBuilder traduit les conditions ORM en paramètres de query string. La stratégie de sérialisation est configurable selon le framework backend cible.

### Utilisation

```js
// Conditions simples
await User
  .where('role', 'admin')
  .where('is_active', true)
  .orderBy('created_at', 'desc')
  .limit(20)
  .offset(40)
  .get();
// → GET /users?role=admin&is_active=true&sort=created_at&order=desc&limit=20&offset=40

// Conditions avec opérateur
await Product.where('price', '>=', 100).where('price', '<=', 500).get();
// → GET /products?price_gte=100&price_lte=500

// whereIn
await User.whereIn('status', ['active', 'pending']).get();
// → GET /users?status[]=active&status[]=pending

// Recherche textuelle
await Product.whereLike('name', 'phone').get();
// → GET /products?search=phone  (ou ?name_like=phone selon config)
```

### Stratégies de sérialisation configurables

Chaque framework backend a ses conventions de query string :

```js
Api.configure({
  querySerializer: 'default', // Voir options ci-dessous
});
```

| Stratégie | Exemple de sortie | Compatible |
|---|---|---|
| `'default'` | `?role=admin&sort=name` | APIs génériques |
| `'laravel'` | `?filter[role]=admin&sort=name` | Laravel API Resources |
| `'django'` | `?role=admin&ordering=name` | Django REST Framework |
| `'odata'` | `?$filter=role eq 'admin'&$orderby=name` | OData / .NET |
| `'jsonapi'` | `?filter[role]=admin&sort=name` | JSON:API spec |
| `'custom'` | fonction personnalisée | Tout backend |

```js
// Stratégie custom
Api.configure({
  querySerializer: (params) => {
    return new URLSearchParams(myCustomSerializer(params)).toString();
  }
});
```

### Méthodes de Query Builder disponibles

Toutes les méthodes du QueryBuilder SQL restent disponibles. Voici comment elles se traduisent :

| Méthode ORM | Paramètre GET généré |
|---|---|
| `.where('col', val)` | `?col=val` |
| `.where('col', '!=', val)` | `?col_ne=val` |
| `.where('col', '>', val)` | `?col_gt=val` |
| `.where('col', '>=', val)` | `?col_gte=val` |
| `.where('col', '<', val)` | `?col_lt=val` |
| `.where('col', '<=', val)` | `?col_lte=val` |
| `.whereIn('col', [])` | `?col[]=a&col[]=b` |
| `.whereNotIn('col', [])` | `?col_nin[]=a` |
| `.whereNull('col')` | `?col_null=true` |
| `.whereNotNull('col')` | `?col_null=false` |
| `.whereBetween('col', [a,b])` | `?col_gte=a&col_lte=b` |
| `.whereLike('col', val)` | `?col_like=val` |
| `.orderBy('col', 'desc')` | `?sort=col&order=desc` |
| `.limit(N)` | `?limit=N` |
| `.offset(N)` | `?offset=N` |
| `.select('id', 'name')` | `?fields=id,name` |

### Conditions non-supportées côté API

Certaines constructions SQL complexes (`join`, `groupBy`, `having`) n'ont pas d'équivalent REST universel. Dans ce cas, Outlet ORM lève une `ApiQueryNotSupportedError` explicite avec un message d'aide.

```js
// ⚠️ Non supporté en mode API
await User.join('profiles', 'users.id', 'profiles.user_id').get();
// → ApiQueryNotSupportedError: 'join' is not supported in ApiModel.
//   Use nested endpoints or include relations in your API design.
```

---

## 7. Pagination API

### Description

La pagination est gérée automatiquement. Outlet ORM supporte les 3 formats de pagination les plus courants.

### Pagination basée sur numéro de page

```js
const result = await User.paginate(2, 15);
// → GET /users?page=2&per_page=15

// Résultat normalisé
{
  data: [...],
  total: 150,
  per_page: 15,
  current_page: 2,
  last_page: 10,
  from: 16,
  to: 30,
}
```

### Pagination par cursor (infinite scroll)

```js
const result = await User.cursorPaginate({ cursor: 'eyJpZCI6MTB9', limit: 20 });
// → GET /users?cursor=eyJpZCI6MTB9&limit=20

// Résultat
{
  data: [...],
  next_cursor: 'eyJpZCI6MzB9',
  prev_cursor: 'eyJpZCI6MX0=',
  has_more: true,
}
```

### Pagination par offset

```js
const result = await User.offsetPaginate({ offset: 30, limit: 15 });
// → GET /users?offset=30&limit=15
```

### Formats de réponse supportés

Outlet ORM détecte et normalise automatiquement les formats de réponse pagination courants :

```js
Api.configure({
  pagination: {
    responseFormat: 'default',
    mapping: {
      data:         'results',
      total:        'count',
      currentPage:  'page',
      perPage:      'page_size',
    },
    useLinkHeader: false,
  }
});
```

### Itération automatique (toutes les pages)

```js
// Itérer sur toutes les pages sans gérer la pagination manuellement
await User.where('status', 'active').eachPage(15, async (users, page) => {
  for (const user of users) {
    await processUser(user);
  }
});

// Ou avec chunk (identique au Model SQL)
await User.where('status', 'active').chunk(50, async (users) => {
  await bulkProcess(users);
});
```

---

## 8. Relations inter-endpoints

### Description

Les relations Eloquent-style sont portées dans l'API Layer. Chaque relation déclenche une ou plusieurs requêtes HTTP supplémentaires.

### hasMany

```js
import { Api } from 'outlet-orm';

class User extends Api {
  static endpoint = '/users';

  posts() {
    return this.hasMany(Post, 'user_id');
    // → GET /posts?user_id=:id
  }
}

const user = await User.find(1);
const posts = await user.posts().get();
```

### belongsTo

```js
class Post extends Api {
  static endpoint = '/posts';

  author() {
    return this.belongsTo(User, 'user_id');
    // → GET /users/:user_id
  }
}
```

### hasOne

```js
class User extends Api {
  profile() {
    return this.hasOne(Profile, 'user_id');
    // → GET /profiles?user_id=:id (prend le premier)
  }
}
```

### Eager Loading API (`with`)

Outlet ORM optimise les requêtes en utilisant les includes/embeds si l'API le supporte :

```js
// Option 1 : L'API supporte ?include= (JSON:API, Laravel)
const users = await User.with('posts', 'profile').get();
// → GET /users?include=posts,profile
// (une seule requête si l'API supporte l'inclusion)

// Option 2 : L'API ne supporte pas ?include=
// Outlet ORM fait des requêtes supplémentaires automatiquement
// → GET /users
// → GET /posts?user_id[]=1&user_id[]=2&user_id[]=3 (batch)
```

### Configuration du mode eager loading

```js
Api.configure({
  relations: {
    eagerLoadStrategy: 'include',
    includeParam: 'include',
    batchSize: 100,
  }
});
```

---

## 9. Nested endpoints

### Description

Beaucoup d'APIs REST utilisent des endpoints imbriqués (`/posts/:post_id/comments`). Outlet ORM supporte cette convention nativement.

### Définition

```js
import { Api } from 'outlet-orm';

class Comment extends Api {
  static endpoint = '/posts/:post_id/comments';
}

const comments = await Comment.for({ post_id: 5 }).get();
// → GET /posts/5/comments

const comment = await Comment.for({ post_id: 5 }).create({
  body: 'Super article !',
  author: 'Alice',
});
// → POST /posts/5/comments
```

### Nested multi-niveaux

```js
class Reply extends Api {
  static endpoint = '/posts/:post_id/comments/:comment_id/replies';
}

const replies = await Reply.for({ post_id: 5, comment_id: 42 }).get();
// → GET /posts/5/comments/42/replies
```

### Intégration avec les relations

```js
class Post extends Api {
  static endpoint = '/posts';

  comments() {
    return this.hasMany(Comment, 'post_id', { nested: true });
    // → GET /posts/:id/comments
  }
}
```

---

## 10. Cache intégré

### Description

Le cache évite les requêtes répétitives vers l'API. Il est configurable par modèle avec plusieurs backends de stockage.

### Configuration par modèle

```js
import { Api } from 'outlet-orm';

class Product extends Api {
  static endpoint = '/products';

  static cache = {
    ttl: 300,
    storage: 'memory',
    key: (method, params) => `products:${method}:${JSON.stringify(params)}`,
    methods: ['GET'],
    invalidateOn: ['create', 'update', 'delete'],
  };
}
```

### Utilisation

```js
// Premier appel → requête HTTP
const products = await Product.where('category', 'electronics').get();

// Deuxième appel dans les 5 minutes → depuis le cache
const products = await Product.where('category', 'electronics').get();

// Forcer le rafraîchissement (ignore le cache)
const products = await Product.fresh().where('category', 'electronics').get();

// Vider le cache d'un modèle
await Product.clearCache();

// Vider une entrée spécifique
await Product.clearCache('products:GET:{"category":"electronics"}');
```

### Cache global

```js
Api.configure({
  cache: {
    defaultTtl: 60,
    storage: 'localStorage',
    maxSize: 50,
    prefix: 'outlet:',
  }
});
```

### Stratégies de cache

```js
Api.configure({
  cache: {
    strategy: 'cache-first',
    // 'cache-first'             → retourne le cache si présent, sinon fetch
    // 'network-first'           → fetch d'abord, cache en fallback si erreur réseau
    // 'stale-while-revalidate'  → retourne le cache ET re-fetch en arrière-plan
    // 'cache-only'              → jamais de requête réseau (mode offline forcé)
    // 'network-only'            → jamais de cache (défaut)
  }
});
```

---

## 11. Mode offline & queue de mutations

### Description

Pour les applications utilisées dans des contextes de connectivité faible ou intermittente, Outlet ORM peut mettre en queue les opérations d'écriture et les rejouer automatiquement lorsque la connexion est rétablie.

### Configuration

```js
Api.configure({
  offline: {
    enabled: true,
    storage: 'localStorage',
    syncOnReconnect: true,
    onConflict: 'server-wins',
    onConflictManual: async (localData, serverData) => {
      return mergeStrategy(localData, serverData);
    },
    maxRetries: 3,
    retryInterval: 5000,
  }
});
```

### Utilisation en mode offline

```js
const order = await Order.create({ product_id: 3, qty: 2 });

Api.on('sync:start', () => showSyncIndicator());
Api.on('sync:success', (mutations) => hideSyncIndicator());
Api.on('sync:error', (err, mutation) => showSyncError(err));
Api.on('sync:conflict', (localData, serverData) => showConflictUI());

await Api.sync();

const queue = Api.getOfflineQueue();
await Api.clearOfflineQueue();
```

### Mise à jour optimiste

```js
class Post extends Api {
  static optimistic = true;
}

// Mise à jour immédiate dans l'UI avant confirmation du serveur
const post = await Post.find(1);
post.title = 'Nouveau titre';
await post.save();
// → UI mise à jour instantanément
// → PUT /posts/1 en arrière-plan
// → Rollback automatique si erreur serveur
```

---

## 12. GraphQLModel

### Description

Variante d'`ApiModel` pour les APIs GraphQL. La syntaxe reste identique, les requêtes GraphQL sont définies par modèle.

### Définition d'un modèle GraphQL

```js
import { GraphQL } from 'outlet-orm';

class User extends GraphQL {
  static client = 'https://api.monapp.com/graphql';

  // Fragments réutilisables
  static fragment = `
    fragment UserFields on User {
      id name email role createdAt
    }
  `;

  // Queries et mutations
  static queries = {
    all: `
      query GetUsers($where: UserWhereInput, $orderBy: UserOrderByInput, $limit: Int, $offset: Int) {
        users(where: $where, orderBy: $orderBy, take: $limit, skip: $offset) {
          ...UserFields
        }
        usersCount(where: $where)
      }
    `,

    find: `
      query GetUser($id: ID!) {
        user(id: $id) { ...UserFields posts { id title } }
      }
    `,

    create: `
      mutation CreateUser($input: CreateUserInput!) {
        createUser(input: $input) { ...UserFields }
      }
    `,

    update: `
      mutation UpdateUser($id: ID!, $input: UpdateUserInput!) {
        updateUser(id: $id, input: $input) { ...UserFields }
      }
    `,

    delete: `
      mutation DeleteUser($id: ID!) {
        deleteUser(id: $id) { id }
      }
    `,
  };
}
```

### Utilisation (identique à ApiModel)

```js
// La syntaxe est identique — GraphQL est transparent
const users = await User.where('role', 'admin').orderBy('name').get();
const user  = await User.with('posts').find(1);
await User.create({ name: 'Alice', email: 'alice@example.com' });
```

### Subscriptions GraphQL (temps réel)

```js
class Message extends GraphQLModel {
  static subscriptions = {
    created: `
      subscription OnMessageCreated($roomId: ID!) {
        messageCreated(roomId: $roomId) { id body author { name } }
      }
    `,
  };
}

const sub = Message.subscribe('created', { roomId: '42' });
sub.on('data', (message) => addMessageToUI(message));
sub.on('error', (err) => console.error(err));
sub.unsubscribe();
```

---

## 13. Validation côté client avant envoi

### Description

Réutilise le moteur de validation existant d'Outlet ORM. La validation est exécutée **avant** l'envoi de la requête HTTP, évitant des round-trips inutiles.

### Configuration

```js
import { Api } from 'outlet-orm';

class Contact extends Api {
  static endpoint = '/contacts';

  static rules = {
    name:    'required|string|min:2|max:100',
    email:   'required|email',
    phone:   'required|regex:^[0-9+\\s]{8,15}$',
    role:    'in:client,prospect,partenaire',
    website: 'url',
  };

  // Message d'erreur personnalisés
  static messages = {
    'name.required':  'Le nom est obligatoire.',
    'email.email':    'Veuillez entrer un email valide.',
    'phone.regex':    'Format de téléphone invalide.',
  };
}
```

### Utilisation

```js
const contact = new Contact({ name: 'A', email: 'pas-un-email' });

// Validation manuelle
const { valid, errors } = contact.validate();
if (!valid) {
  console.log(errors);
  // { name: ['Le nom doit contenir au moins 2 caractères'], email: ['Veuillez entrer un email valide.'] }
}

// Validation automatique avant save() (lève une ApiValidationError si invalide)
try {
  await contact.save();
} catch (error) {
  if (error instanceof ApiValidationError) {
    console.log(error.errors); // Erreurs de validation côté client
  }
}

// Désactiver la validation pour un save() spécifique
await contact.save({ validate: false });
```

### Validation côté serveur intégrée

Outlet ORM normalise également les erreurs de validation retournées par le serveur (422 Unprocessable Entity) pour les rendre accessibles via la même interface :

```js
try {
  await contact.save();
} catch (error) {
  if (error instanceof ApiValidationError) {
    console.log(error.source); // 'client' ou 'server'
    console.log(error.errors); // { email: ['Cet email est déjà utilisé.'] }
  }
}
```

### Règles disponibles (identiques à Model)

Toutes les règles existantes d'Outlet ORM sont disponibles, plus les suivantes spécifiques à l'API Layer :

| Règle | Description |
|---|---|
| `url` | URL valide |
| `uuid` | Format UUID valide |
| `json` | JSON valide |
| `phone` | Numéro de téléphone (configurable par locale) |
| `exists:Model` | Vérifie l'existence via une requête GET à l'API |
| `unique:Model,field` | Vérifie l'unicité via une requête GET à l'API |

---

## 14. Transformateurs request/response

### Description

Les transformateurs permettent de modifier les données avant envoi (request) et après réception (response), sans modifier le modèle. Utile pour adapter un modèle à une API dont le format diffère.

### Transformateur de réponse (response)

Transforme les données reçues de l'API avant de les attribuer au modèle :

```js
import { Api } from 'outlet-orm';

class User extends Api {
  static transforms = {
    response: (data) => ({
      ...data,
      fullName: `${data.first_name} ${data.last_name}`,
      role: data.role?.toLowerCase(),
      countryCode: data.address?.country?.code,
    }),
  };
}
```

### Transformateur de requête (request)

Transforme les données avant de les envoyer à l'API :

```js
class User extends Api {
  static transforms = {
    request: (data) => ({
      ...data,
      name: data.name?.trim(),
      phone: data.phone?.replace(/\s/g, ''),
      fullName: undefined,
    }),
  };
}
```

### Transformateurs séparés par action

```js
class Product extends Api {
  static transforms = {
    response: {
      // Transformateur par défaut (GET)
      default: (data) => ({ ...data, price: parseFloat(data.price) }),

      // Transformateur spécifique à find()
      find: (data) => ({ ...data, price: parseFloat(data.price), inStock: data.stock > 0 }),
    },

    request: {
      // Avant create()
      create: (data) => ({ ...data, created_by: getCurrentUserId() }),

      // Avant update()
      update: (data) => ({ ...data, updated_by: getCurrentUserId() }),
    },
  };
}
```

### Transformateur global

```js
Api.configure({
  transforms: {
    response: (data, Model) => snakeToCamel(data),
    request:  (data, Model) => camelToSnake(data),
  }
});
```

---

## 15. Réactivité — Polling & temps réel

### Feature F-14 : Polling réactif (`watch`)

Interroge l'API à intervalle régulier et émet un événement à chaque changement détecté :

```js
const watcher = User
  .where('status', 'online')
  .orderBy('last_seen', 'desc')
  .watch({
    interval: 5000,      // ms entre chaque poll
    immediate: true,     // exécuter immédiatement au démarrage
    detectChanges: true, // comparer avec le résultat précédent (ne déclenche 'change' que si différent)
  });

watcher.on('data', (users) => renderOnlineUsers(users));
watcher.on('change', (users, previous) => updateBadge(users.length));
watcher.on('error', (err) => console.error('Erreur de poll:', err));

// Arrêter le watching
watcher.stop();

// Mettre en pause / reprendre
watcher.pause();
watcher.resume();
```

### Feature F-15 : Server-Sent Events (SSE)

```js
class Notification extends ApiModel {
  static realtime = {
    type: 'sse',
    url: 'https://api.monapp.com/notifications/stream',
    // Headers supplémentaires pour la connexion SSE
    headers: () => ({ Authorization: `Bearer ${getToken()}` }),
    // Reconnexion automatique
    reconnect: true,
    reconnectDelay: 3000,
  };
}

const stream = Notification.stream();
stream.on('data', (notification) => showNotification(notification));
stream.on('connected', () => console.log('SSE connecté'));
stream.on('reconnecting', () => console.log('Reconnexion...'));
stream.on('error', (err) => console.error(err));
stream.close();
```

### Feature F-16 : WebSocket

```js
class ChatMessage extends ApiModel {
  static realtime = {
    type: 'websocket',
    url: 'wss://api.monapp.com/ws/chat',
    // Protocole custom
    protocol: 'json',
    // Message d'authentification initial
    authMessage: () => ({ type: 'auth', token: getToken() }),
    // Mapper les messages entrants vers le modèle
    messageMapper: (msg) => msg.type === 'message' ? msg.data : null,
  };
}

const ws = ChatMessage.connect();

// Écouter les messages entrants
ws.on('message', (message) => addToChat(message));
ws.on('connected', () => setStatus('connecté'));
ws.on('disconnected', () => setStatus('déconnecté'));

// Envoyer un message via WebSocket
ws.send({ type: 'message', body: 'Bonjour !', room_id: 42 });

// Fermer la connexion
ws.disconnect();
```

---

## 16. Gestion des erreurs API

### Description

Outlet ORM fournit une hiérarchie d'erreurs typées pour faciliter la gestion des cas d'erreur HTTP dans l'application.

### Hiérarchie des erreurs

```
ApiError
├── ApiNetworkError        → Pas de connexion, timeout
├── ApiResponseError       → Le serveur a répondu avec une erreur HTTP
│   ├── ApiNotFoundError        → 404
│   ├── ApiValidationError      → 422 (inclut error.errors)
│   ├── ApiUnauthorizedError    → 401
│   ├── ApiForbiddenError       → 403
│   ├── ApiServerError          → 5xx
│   └── ApiRateLimitError       → 429 (inclut error.retryAfter)
└── ApiQueryNotSupportedError  → Méthode ORM non traduite en REST
```

### Utilisation

```js
const { ApiNotFoundError, ApiValidationError, ApiNetworkError } = require('outlet-orm/api');

try {
  const user = await User.findOrFail(999);
} catch (error) {
  if (error instanceof ApiNotFoundError) {
    console.log('Utilisateur introuvable');
  } else if (error instanceof ApiValidationError) {
    console.log('Erreurs:', error.errors);
    console.log('Source:', error.source); // 'client' | 'server'
  } else if (error instanceof ApiNetworkError) {
    console.log('Problème réseau:', error.message);
  } else if (error instanceof ApiRateLimitError) {
    console.log(`Réessayer dans ${error.retryAfter} secondes`);
  }
}
```

### Handler d'erreur global

```js
ApiModel.configure({
  onError: (error, request) => {
    // Logger global
    console.error(`[API Error] ${request.method} ${request.url}:`, error.message);

    // Notification globale
    if (error instanceof ApiServerError) {
      showToast('Erreur serveur, veuillez réessayer.', 'error');
    }

    // Laisser l'erreur se propager
    throw error;
  }
});
```

---

## 17. Intercepteurs & middleware pipeline

### Description

Les intercepteurs permettent de hooker le cycle de vie de chaque requête HTTP, similaire aux intercepteurs Axios.

### Intercepteur de requête

```js
Api.addRequestInterceptor((config) => {
  config.headers['X-Request-Time'] = Date.now();
  if (process.env.NODE_ENV === 'development') {
    console.log(`→ ${config.method} ${config.url}`);
  }
  return config;
});
```

### Intercepteur de réponse

```js
Api.addResponseInterceptor(
  (response) => {
    console.log(`← ${response.status} ${response.url} (${response.duration}ms)`);
    return response;
  },
  async (error) => {
    if (error.status === 401) {
      await refreshToken();
      return Api.retry(error.request);
    }
    throw error;
  }
);
```

### Supprimer un intercepteur

```js
const id = Api.addRequestInterceptor(myInterceptor);
Api.removeRequestInterceptor(id);
```

---

## 18. Retry & circuit breaker

### Description

Gestion automatique des erreurs transitoires (réseau instable, serveur temporairement surchargé).

### Retry automatique

```js
Api.configure({
  retry: {
    maxRetries: 3,
    delay: 1000,
    backoff: 2,
    jitter: true,
    retryCodes: [408, 429, 500, 502, 503, 504],
    shouldRetry: (error, attempt) => attempt < 3 && error.status >= 500,
  }
});
```

### Circuit Breaker

```js
Api.configure({
  circuitBreaker: {
    enabled: true,
    threshold: 5,
    resetTimeout: 30000,
    onOpen:  (model) => console.warn(`Circuit ouvert pour ${model.endpoint}`),
    onClose: (model) => console.info(`Circuit fermé pour ${model.endpoint}`),
  }
});
```

---

## 19. Upload de fichiers

### Description

Support natif de l'upload de fichiers via `multipart/form-data` ou base64, avec suivi de progression.

### Upload simple

```js
import { Api } from 'outlet-orm';

class Document extends Api {
  static endpoint = '/documents';
  static fillable = ['title', 'file', 'category'];
}

const fileInput = document.querySelector('#file');
const file = fileInput.files[0];

const doc = await Document.create({
  title: 'Rapport Q1',
  category: 'finance',
  file: file, // File object natif du navigateur
});
// → POST /documents (multipart/form-data)
```

### Upload avec progression

```js
const upload = Document.upload({
  title: 'Rapport Q1',
  file: file,
}, {
  onProgress: (percent, loaded, total) => {
    progressBar.value = percent;
    console.log(`${loaded}/${total} bytes`);
  },
  onSuccess: (doc) => showSuccess(doc),
  onError: (err) => showError(err),
});

// Annuler l'upload
upload.abort();
```

### Upload multiple

```js
const files = Array.from(fileInput.files);
const results = await Document.uploadMany(files, {
  field: 'files',
  onProgress: (file, percent) => updateProgress(file.name, percent),
  concurrency: 3, // uploads simultanés
});
```

---

## 20. Sérialisation avancée

### Description

Contrôle fin sur la façon dont les données sont envoyées et reçues, pour s'adapter à toute convention d'API.

### Format de l'enveloppe de réponse

Beaucoup d'APIs encapsulent les données dans une enveloppe JSON :

```json
{ "data": { "id": 1, "name": "Alice" }, "meta": { "version": "1.0" } }
```

```js
Api.configure({
  response: {
    dataKey:   'data',
    metaKey:   'meta',
    errorsKey: 'errors',
  }
});
```

### Format du corps de requête

```js
Api.configure({
  request: {
    wrapIn: null, // null | 'data' | 'auto'
  }
});
```

### Snake_case ↔ camelCase automatique

```js
Api.configure({
  serialization: {
    responseCase: 'camel',
    requestCase:  'snake',
  }
});
```

---

## 21. Mock adapter — Tests front-end

### Description

Le `MockAdapter` permet de tester le code front-end sans avoir besoin d'une vraie API. Il intercepte toutes les requêtes et retourne des données prédéfinies.

### Configuration du mock

```js
import { MockAdapter } from 'outlet-orm';

const mock = new MockAdapter();

// Mock par méthode et URL
mock.onGet('/users').reply(200, [
  { id: 1, name: 'Alice', role: 'admin' },
  { id: 2, name: 'Bob',   role: 'user'  },
]);

mock.onGet('/users/1').reply(200, { id: 1, name: 'Alice', role: 'admin' });
mock.onGet('/users/999').reply(404, { message: 'Not found' });

mock.onPost('/users').reply(201, (config) => {
  // config.data contient le body de la requête
  const data = JSON.parse(config.data);
  return { id: 99, ...data, created_at: new Date().toISOString() };
});

mock.onPut('/users/1').reply(200, (config) => JSON.parse(config.data));
mock.onDelete('/users/1').reply(204);

```js
// Activer le mock
Api.configure({ adapter: mock });
```

### Simuler des erreurs réseau

```js
mock.onGet('/products').networkError();
mock.onPost('/orders').timeout();
mock.onGet('/reports').reply(500, { message: 'Internal Server Error' });
```

### Simuler une latence

```js
mock.onGet('/users').delay(800).reply(200, users); // simule 800ms de latence
```

### Mode passthrough (mock partiel)

```js
// Mocker seulement certains endpoints, laisser passer les autres
mock.setPassthrough(true);
mock.onGet('/users').reply(200, mockUsers); // mocké
// Tous les autres appels → vraie API
```

---

## 22. CLI : outlet-api-import

### Description

Commande CLI pour générer automatiquement des modèles `ApiModel` à partir d'une spécification OpenAPI/Swagger ou d'une collection Postman.

### Utilisation

```bash
# Depuis une URL OpenAPI
outlet-api-import --spec https://api.monapp.com/openapi.json

# Depuis un fichier local
outlet-api-import --spec ./openapi.yaml

# Depuis une collection Postman
outlet-api-import --postman ./collection.json

# Options
outlet-api-import \
  --spec https://api.monapp.com/openapi.json \
  --output ./src/models/api \       # Dossier de sortie
  --lang js \                        # 'js' | 'ts'
  --base-url https://api.monapp.com \
  --auth bearer \                    # Type d'auth à préconfigurer
  --overwrite                        # Écraser les fichiers existants
```

### Exemple de sortie générée

```js
// Fichier généré : src/models/api/User.js
const { ApiModel } = require('outlet-orm/api');

/**
 * Modèle généré depuis OpenAPI spec
 * Tag: Users
 * GET    /users          → User.all()
 * POST   /users          → User.create()
 * GET    /users/{id}     → User.find(id)
 * PUT    /users/{id}     → user.save()
 * DELETE /users/{id}     → user.destroy()
 */
class User extends ApiModel {
  static endpoint = '/users';
  static primaryKey = 'id';

  static fillable = ['name', 'email', 'role', 'is_active'];
  static hidden = ['password'];

  static casts = {
    id: 'int',
    is_active: 'boolean',
    created_at: 'date',
    updated_at: 'date',
  };

  // Relations détectées depuis les $ref OpenAPI
  posts() { return this.hasMany(Post, 'user_id'); }
  profile() { return this.hasOne(Profile, 'user_id'); }
}

module.exports = User;
```

### Commande `outlet-api-diff`

Compare la spec OpenAPI avec les modèles existants et signale les divergences :

```bash
outlet-api-diff --spec openapi.json --models ./src/models/api
# → User.js: endpoint manquant 'PATCH /users/{id}'
# → Product.js: champ 'sku' présent dans l'API mais absent du modèle
# → Order.js: modèle présent mais endpoint '/orders' introuvable dans la spec
```

---

## 23. TypeScript — Types API Layer

### Description

Le type système d'Outlet ORM est entièrement étendu pour l'API Layer avec des génériques, des types d'erreur et des interfaces de configuration typées.

### Modèle typé

```typescript
import { Api, ApiAdapter, HasManyApiRelation, BelongsToApiRelation } from 'outlet-orm';

interface UserAttributes {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user' | 'guest';
  is_active: boolean;
  created_at: Date;
}

class User extends Api<UserAttributes> {
  static endpoint = '/users' as const;
  static fillable = ['name', 'email', 'role'] as const;

  posts(): HasManyApiRelation<Post> {
    return this.hasMany(Post, 'user_id');
  }
}

const user = await User.find(1);
const name: string = user.name;
const role: 'admin' | 'user' | 'guest' = user.role;
```

### Configuration typée

```typescript
import { ApiConfig, AuthConfig, CacheConfig } from 'outlet-orm';

const config: ApiConfig = {
  baseUrl: 'https://api.monapp.com',
  auth: {
    type: 'bearer',
    token: () => localStorage.getItem('token') ?? '',
  } satisfies AuthConfig,
};

Api.configure(config);
```

### Types d'erreurs

```typescript
import { ApiValidationError, ApiNotFoundError } from 'outlet-orm';

try {
  await User.findOrFail(1);
} catch (error) {
  if (error instanceof ApiValidationError) {
    const errors: Record<string, string[]> = error.errors;
    const source: 'client' | 'server' = error.source;
  }
}
```

---

## 24. Logging & debugging API

### Description

Outils de debugging intégrés pour inspecter les requêtes HTTP générées par l'ORM.

### Activer le logging

```js
const adapter = Api.getAdapter();
adapter.enableRequestLog();

const users = await User.where('status', 'active').get();

const log = adapter.getRequestLog();
adapter.flushRequestLog();
adapter.disableRequestLog();
```

### `dd()` — Dump and die (HTTP version)

```js
// Affiche la requête qui serait générée, sans l'exécuter
await User.where('status', 'active').orderBy('name').limit(10).dd();
// Console output:
// {
//   method: 'GET',
//   url: 'https://api.monapp.com/users',
//   params: { status: 'active', sort: 'name', order: 'asc', limit: 10 },
//   headers: { Authorization: 'Bearer ...' }
// }
// [ApiModel] dd() called — request not sent
```

### `toRequest()` — Inspecter sans exécuter

```js
const requestConfig = await User
  .where('role', 'admin')
  .with('posts')
  .orderBy('created_at', 'desc')
  .toRequest();

console.log(requestConfig);
// { method: 'GET', url: '/users', params: { role: 'admin', include: 'posts', sort: 'created_at', order: 'desc' } }
```

---

## 25. Sécurité

### Protection des tokens

```js
Api.configure({
  security: {
    redactHeaders: ['Authorization', 'X-Api-Key', 'Cookie'],
    redactFields:  ['password', 'token', 'secret'],
  }
});
```

### Validation des réponses

```js
class User extends Api {
  static responseSchema = {
    id:    'int',
    name:  'string',
    email: 'email',
    role:  'in:admin,user,guest',
  };

  static strictResponse = true;
}
```

### CORS & headers de sécurité

```js
Api.configure({
  adapter: {
    credentials: 'include',
    headers: {
      'X-Requested-With': 'XMLHttpRequest',
    },
  }
});
```

---

## 26. Tableau de priorité

| Priorité | ID | Feature | Effort estimé | Impact |
|---|---|---|---|---|
| 🔴 Must-have | F-01 | `ApiModel` de base (GET/POST/PUT/DELETE) | L | Foundation |
| 🔴 Must-have | F-02 | Mapping HTTP ↔ ORM configurable | M | Core |
| 🔴 Must-have | F-03 | `ApiAdapter` + authentification (Bearer, Cookie) | M | Sans ça : inutilisable |
| 🔴 Must-have | F-06 | Query Builder → query string | M | Filtrage |
| 🔴 Must-have | F-16 | Gestion des erreurs typées | M | DX essentielle |
| 🟠 Important | F-07 | Pagination (page-based + offset) | M | Standard |
| 🟠 Important | F-08 | Relations inter-endpoints | L | Eloquent feel |
| 🟠 Important | F-13 | Validation côté client avant envoi | S | UX |
| 🟠 Important | F-14 | Transformateurs request/response | M | Flexibilité |
| 🟠 Important | F-04 | Multi-adapter | S | Multi-API |
| 🟡 Nice-to-have | F-09 | Nested endpoints | M | REST natif |
| 🟡 Nice-to-have | F-10 | Cache intégré (memory + localStorage) | M | Perf front |
| 🟡 Nice-to-have | F-17 | Intercepteurs & middleware pipeline | M | Extensibilité |
| 🟡 Nice-to-have | F-21 | Mock adapter — Tests | M | Testabilité |
| 🟡 Nice-to-have | F-20 | Sérialisation avancée (enveloppe, casing) | M | Compatibilité |
| 🟡 Nice-to-have | F-18 | Retry & circuit breaker | M | Résilience |
| 🟢 Plus tard | F-11 | Mode offline & queue de mutations | XL | Connectivité faible |
| 🟢 Plus tard | F-12 | `GraphQLModel` | L | Audience GraphQL |
| 🟢 Plus tard | F-15 | Polling réactif (`watch`) | M | UX temps réel |
| 🟢 Plus tard | F-16 | WebSocket / SSE | L | Temps réel |
| 🟢 Plus tard | F-19 | Upload de fichiers | M | Confort |
| 🟢 Plus tard | F-22 | CLI `outlet-api-import` (OpenAPI) | XL | DX avancée |
| 🟢 Plus tard | F-07b | Cursor pagination | S | Infinite scroll |

---

## 27. Architecture interne

### Structure des fichiers suggérée

```
outlet-orm/
├── src/
│   ├── api/
│   │   ├── ApiModel.js              # Classe de base
│   │   ├── ApiAdapter.js            # Couche HTTP (fetch wrapper)
│   │   ├── ApiQueryBuilder.js       # QueryBuilder → query string
│   │   ├── ApiRelations.js          # Relations inter-endpoints
│   │   ├── ApiCache.js              # Cache manager
│   │   ├── ApiOfflineQueue.js       # Queue de mutations offline
│   │   ├── ApiTransformer.js        # Transformateurs request/response
│   │   ├── ApiValidator.js          # Validation côté client
│   │   ├── ApiPaginator.js          # Normalisation pagination
│   │   ├── ApiErrors.js             # Hiérarchie d'erreurs
│   │   ├── ApiInterceptors.js       # Pipeline d'intercepteurs
│   │   ├── MockAdapter.js           # Adapter de test
│   │   ├── GraphQLModel.js          # Variante GraphQL
│   │   └── index.js                 # Exports publics
│   └── ... (ORM SQL existant)
├── bin/
│   ├── outlet-api-import.js         # CLI import OpenAPI
│   └── outlet-api-diff.js           # CLI diff spec ↔ modèles
└── types/
    └── api/
        ├── ApiModel.d.ts
        ├── ApiAdapter.d.ts
        ├── ApiErrors.d.ts
        └── index.d.ts
```

### Flux d'une requête GET

```
User.where('status', 'active').orderBy('name').get()
        │
        ▼
ApiQueryBuilder.compile()
→ { method: 'GET', params: { status: 'active', sort: 'name', order: 'asc' } }
        │
        ▼
ApiAdapter.request(config)
  → RequestInterceptors pipeline
  → CacheAdapter.check(cacheKey)
      ├── HIT  → retourner données du cache
      └── MISS → continuer
  → fetch(url, options)
      ├── Erreur réseau → RetryManager.shouldRetry() → réessayer ou ApiNetworkError
      └── Réponse HTTP
            ├── 2xx → ResponseInterceptors pipeline → Transformer.response() → hydrate Model[]
            ├── 401 → AuthAdapter.onUnauthorized() → retry
            ├── 404 → ApiNotFoundError
            ├── 422 → ApiValidationError (avec errors normalisés)
            └── 5xx → ApiServerError → CircuitBreaker.record()
```

### Exports publics depuis outlet-orm

```js
// outlet-orm/index.js
const Model       = require('./src/Model');
const Api         = require('./src/api/ApiModel');
const ApiModel    = Api;   // alias rétrocompatible
const GraphQL     = require('./src/api/GraphQLModel');
const MockAdapter = require('./src/api/MockAdapter');
const { createAdapter } = require('./src/api/ApiAdapter');

module.exports = { Model, Api, ApiModel, GraphQL, MockAdapter, createAdapter };
```

### Coexistence SQL + API dans un même projet

```js
import { Model, Api } from 'outlet-orm';

// Modèle local (SQL) — backend Node.js
class Product extends Model {
  static table = 'products';
}

// Modèle distant (API) — front React / React Native
// Compatible avec tout backend : Django, Laravel, Spring Boot, ASP.NET Core...
class User extends Api {
  static endpoint = '/users';
}

const localProduct = await Product.find(1);  // → SQL
const remoteUser   = await User.find(1);     // → HTTP GET
```

---

*Outlet ORM API Layer — Spécification v1.0 — Rédigé pour outlet-orm v13.0.0*

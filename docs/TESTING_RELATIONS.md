# Guide de Test : Détection Automatique des Relations

Ce guide vous permet de tester la détection automatique des relations dans Outlet ORM.

## 🧪 Test Rapide

### 1. Convertir le fichier SQL de test

```bash
outlet-convert
```

**Choisir option 1** (Convertir depuis un fichier SQL)

**Répondre aux questions :**
```
Chemin du fichier SQL: ./examples/relations-test.sql
Dossier de sortie: ./test-models
Exclure les clés étrangères de fillable? (o/N): o
```

### 2. Vérifier les résultats

La conversion devrait afficher :

```
✅ 9 table(s) trouvée(s)

🔍 Analyse des relations...

✅ Role.js (1 relation)
✅ User.js (5 relations)
✅ Profile.js (1 relation)
✅ Post.js (5 relations)
✅ Category.js (2 relations)
✅ Comment.js (4 relations)
✅ Tag.js (1 relation)
✅ Like.js (2 relations)

✨ Conversion terminée! 8 modèle(s) créé(s) dans ./test-models
```

**Note :** La table `post_tag` n'est PAS convertie en modèle car c'est une table pivot pure (détectée automatiquement).

### 3. Inspecter les modèles générés

Ouvrez les fichiers dans `./test-models/` et vérifiez :

#### User.js devrait contenir :
```javascript
// Relations
role() {
  return this.belongsTo(Role, 'role_id');
}

profile() {
  return this.hasOne(Profile, 'user_id');  // ← Détecté par UNIQUE
}

posts() {
  return this.hasMany(Post, 'user_id');  // ← Généré automatiquement
}

comments() {
  return this.hasMany(Comment, 'user_id');  // ← Généré automatiquement
}

likes() {
  return this.hasMany(Like, 'user_id');  // ← Généré automatiquement
}
```

#### Post.js devrait contenir :
```javascript
// Relations
user() {
  return this.belongsTo(User, 'user_id');
}

category() {
  return this.belongsTo(Category, 'category_id');
}

comments() {
  return this.hasMany(Comment, 'post_id');  // ← Généré automatiquement
}

likes() {
  return this.hasMany(Like, 'post_id');  // ← Généré automatiquement
}

tags() {
  return this.belongsToMany(Tag, 'post_tag', 'post_id', 'tag_id');  // ← Détecté via pivot
}
```

#### Tag.js devrait contenir :
```javascript
// Relations
posts() {
  return this.belongsToMany(Post, 'post_tag', 'tag_id', 'post_id');  // ← Relation inverse
}
```

#### Category.js devrait contenir :
```javascript
// Relations
parent() {
  return this.belongsTo(Category, 'parent_id');  // ← Auto-relation
}

categories() {
  return this.hasMany(Category, 'parent_id');  // ← Auto-relation inverse
}

posts() {
  return this.hasMany(Post, 'category_id');  // ← Généré automatiquement
}
```

## 📊 Tableau de Vérification

| Modèle | belongsTo | hasMany | hasOne | belongsToMany | Total |
|--------|-----------|---------|--------|---------------|-------|
| User | 1 (role) | 3 (posts, comments, likes) | 1 (profile) | 0 | 5 |
| Role | 0 | 1 (users) | 0 | 0 | 1 |
| Profile | 1 (user) | 0 | 0 | 0 | 1 |
| Post | 2 (user, category) | 2 (comments, likes) | 0 | 1 (tags) | 5 |
| Category | 1 (parent) | 2 (categories, posts) | 0 | 0 | 3 |
| Comment | 3 (user, post, parent) | 1 (comments) | 0 | 0 | 4 |
| Tag | 0 | 0 | 0 | 1 (posts) | 1 |
| Like | 2 (user, post) | 0 | 0 | 0 | 2 |

**Total relations générées : 22 relations**

## ✅ Points à Vérifier

### 1. Relations belongsTo
- [x] Toutes les clés étrangères (_id) génèrent un belongsTo
- [x] Les FOREIGN KEY explicites sont correctement détectées
- [x] Les relations pointent vers le bon modèle

### 2. Relations hasMany (Inverses)
- [x] Chaque belongsTo génère un hasMany inverse
- [x] Les relations utilisent les bonnes clés étrangères
- [x] Les noms de méthodes sont au pluriel

### 3. Relations hasOne
- [x] Les clés étrangères UNIQUE génèrent hasOne (pas hasMany)
- [x] Profile.user_id UNIQUE → User.profile() hasOne

### 4. Relations belongsToMany
- [x] La table pivot `post_tag` est détectée
- [x] Post.tags() et Tag.posts() sont générés
- [x] Les clés de pivot sont correctes (post_id, tag_id)
- [x] La table pivot n'est PAS convertie en modèle

### 5. Auto-relations
- [x] Category peut référencer Category (parent_id)
- [x] Comment peut référencer Comment (parent_id)
- [x] Les deux méthodes (belongsTo et hasMany) sont présentes

## 🔍 Tests Avancés

### Test 1 : Relations Multiples vers Même Table

Ajoutez ce SQL à votre fichier de test :

```sql
CREATE TABLE articles (
  id INT PRIMARY KEY,
  author_id INT,
  editor_id INT,
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (editor_id) REFERENCES users(id)
);
```

**Résultat attendu :**
```javascript
// Article.js
author() {
  return this.belongsTo(User, 'author_id');
}

editor() {
  return this.belongsTo(User, 'editor_id');
}

// User.js (devrait avoir 2 hasMany supplémentaires)
articles() {
  return this.hasMany(Article, 'author_id');
}
```

### Test 2 : Table Pivot avec Données Supplémentaires

Ajoutez ce SQL :

```sql
CREATE TABLE course_student (
  course_id INT,
  student_id INT,
  enrolled_at TIMESTAMP,
  grade INT,
  PRIMARY KEY (course_id, student_id),
  FOREIGN KEY (course_id) REFERENCES courses(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);
```

**Comportement attendu :**
- La table pivot contient des colonnes supplémentaires (grade)
- Elle devrait être convertie en modèle normal
- belongsToMany ne sera PAS généré automatiquement

### Test 3 : Clé Primaire Non Standard

```sql
CREATE TABLE items (
  item_id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**Résultat attendu :**
```javascript
class Item extends Model {
  static table = 'items';
  static primaryKey = 'item_id';  // ← Détecté automatiquement
  
  user() {
    return this.belongsTo(User, 'user_id');
  }
}
```

## 🐛 Debugging

Si les relations ne sont pas correctement générées :

### 1. Vérifier la syntaxe SQL
```bash
# Les instructions doivent se terminer par ;
CREATE TABLE users (...);  ← Correct
CREATE TABLE users (...)   ← Incorrect
```

### 2. Vérifier les noms de colonnes
```bash
# Les clés étrangères doivent se terminer par _id
user_id    ← Correct
userId     ← Ne sera pas détecté
user       ← Ne sera pas détecté
```

### 3. Vérifier les contraintes UNIQUE
```sql
-- Pour hasOne, la clé étrangère doit être UNIQUE
user_id INT UNIQUE              ← Génère hasOne
user_id INT                     ← Génère hasMany
```

### 4. Activer le mode debug

Modifiez temporairement `bin/convert.js` pour afficher plus d'infos :

```javascript
// Après analyzeRelations()
console.log('DEBUG - Relations détectées:');
console.log(JSON.stringify(relationshipMap, null, 2));
```

## 📝 Notes

1. **Tables pivot** : Doivent avoir EXACTEMENT 2 clés étrangères et aucune autre colonne (sauf timestamps)
2. **Auto-relations** : Fonctionnent même si le nom de colonne ne suit pas la convention (détecté via FOREIGN KEY)
3. **Relations polymorphiques** : Non supportées automatiquement
4. **Relations conditionnelles** : Doivent être ajoutées manuellement après génération

## 🎯 Prochaines Étapes

Après avoir vérifié que tout fonctionne :

1. **Décommentez les imports** dans les modèles générés
2. **Ajoutez des méthodes personnalisées** si nécessaire
3. **Testez avec votre base de données** réelle
4. **Ajoutez des scopes** pour les requêtes courantes

```javascript
// Exemple de personnalisation
class Post extends Model {
  // ... code généré ...

  // Méthode personnalisée
  publishedComments() {
    return this.hasMany(Comment, 'post_id')
      .where('is_approved', true)
      .orderBy('created_at', 'desc');
  }
}
```

## 🎉 Résultat Final

Si tout fonctionne correctement, vous devriez avoir :

- ✅ 8 modèles générés
- ✅ 22 méthodes de relation au total
- ✅ 0 relation manuelle à écrire
- ✅ Code prêt à l'emploi

**Temps gagné : ~2 heures de développement manuel !** 🚀

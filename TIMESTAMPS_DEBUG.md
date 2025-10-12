# Solutions pour désactiver les timestamps dans outlet-orm

## Problème identifié
Le système de timestamps fonctionne correctement dans outlet-orm, mais parfois les développeurs rencontrent des problèmes lors de l'usage.

## Solutions

### 1. Vérifier la définition du modèle
```javascript
class MyModel extends Model {
  static table = 'ma_table';
  static timestamps = false;  // Explicitement défini à false
  static fillable = ['name', 'email'];
}
```

### 2. Insertion SQL directe (bypass du modèle)
```javascript
// Via DatabaseConnection directement
const db = new DatabaseConnection();
await db.insert('ma_table', { 
  name: 'Alice', 
  email: 'alice@test.com' 
});
```

### 3. Insertion avec Query Builder raw
```javascript
// Via QueryBuilder sans timestamps
await MyModel.query().insert({ 
  name: 'Alice', 
  email: 'alice@test.com' 
});
```

### 4. Overrider les méthodes de timestamps
```javascript
class MyModel extends Model {
  static table = 'ma_table';
  static timestamps = false;
  
  // Override pour forcer la désactivation
  async performInsert() {
    // Ne pas ajouter de timestamps
    const data = this.attributes;
    const result = await this.constructor.connection.insert(this.constructor.table, data);
    this.setAttribute(this.constructor.primaryKey, result.insertId);
    this.exists = true;
    this.original = { ...this.attributes };
    return this;
  }
  
  async performUpdate() {
    // Ne pas ajouter updated_at
    const dirty = this.getDirty();
    if (Object.keys(dirty).length === 0) return this;
    
    await this.constructor.connection.update(
      this.constructor.table,
      dirty,
      { [this.constructor.primaryKey]: this.getAttribute(this.constructor.primaryKey) }
    );
    this.original = { ...this.attributes };
    return this;
  }
}
```

### 5. Utilisation d'executeRawQuery
```javascript
// Insertion SQL complètement manuelle
await db.executeRawQuery(
  'INSERT INTO ma_table (name, email) VALUES (?, ?)',
  ['Alice', 'alice@test.com']
);
```

## Diagnostic
Pour diagnostiquer votre problème spécifique :

1. Vérifiez `console.log(MyModel.timestamps)` - doit être `false`
2. Vérifiez la structure de votre table
3. Testez avec `executeRawQuery` pour confirmer que c'est bien un problème de timestamps

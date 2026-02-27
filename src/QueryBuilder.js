/**
 * Query Builder for constructing and executing database queries
 */
const RawExpression = require('./RawExpression');

/**
 * Validate a SQL identifier used internally in subquery construction.
 * Throws if the value is not a safe alphanumeric/underscore/dot string.
 * @param {string} value
 * @param {string} context - human-readable label for error messages
 * @returns {string}
 */
function assertIdentifier(value, context = 'identifier') {
  if (typeof value !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(value)) {
    throw new Error(`Invalid SQL ${context}`);
  }
  return value;
}

class QueryBuilder {
  constructor(model) {
    this.model = model;
    this.wheres = [];
    this.orders = [];
    this.limitValue = null;
    this.offsetValue = null;
    this.selectedColumns = ['*'];
    this.withRelations = [];
    this.withConstraints = {};
    this.joins = [];
    this.distinctFlag = false;
    this.groupBys = [];
    this.havings = [];
    this._showHidden = false;
    this._withTrashed = false;
    this._onlyTrashed = false;
    this._excludedScopes = [];
    this._excludeAllScopes = false;
  }

  /**
   * Apply global scopes to the query
   * @private
   */
  _applyGlobalScopes() {
    if (this._excludeAllScopes) return;
    if (this._scopesApplied) return;

    const scopes = this.model.globalScopes || {};
    for (const [name, scopeFn] of Object.entries(scopes)) {
      if (!this._excludedScopes.includes(name)) {
        scopeFn(this);
      }
    }
    this._scopesApplied = true;
  }

  /**
   * Apply soft delete constraints
   * @private
   */
  _applySoftDeleteConstraints() {
    if (!this.model.softDeletes) return;
    if (this._softDeleteApplied) return;

    if (this._onlyTrashed) {
      this.whereNotNull(this.model.DELETED_AT);
    } else if (!this._withTrashed) {
      this.whereNull(this.model.DELETED_AT);
    }
    this._softDeleteApplied = true;
  }

  /**
   * Include soft deleted records
   * @returns {this}
   */
  withTrashed() {
    this._withTrashed = true;
    return this;
  }

  /**
   * Only get soft deleted records
   * @returns {this}
   */
  onlyTrashed() {
    this._onlyTrashed = true;
    return this;
  }

  /**
   * Query without a specific global scope
   * @param {string} name
   * @returns {this}
   */
  withoutGlobalScope(name) {
    this._excludedScopes.push(name);
    return this;
  }

  /**
   * Query without all global scopes
   * @returns {this}
   */
  withoutGlobalScopes() {
    this._excludeAllScopes = true;
    return this;
  }

  /**
   * Select specific columns
   * @param {...string} columns
   * @returns {this}
   */
  select(...columns) {
    this.selectedColumns = columns;
    return this;
  }

  /**
   * Add a raw select expression
   * @param {string} expression
   * @returns {this}
   */
  selectRaw(expression) {
    this.selectedColumns.push(new RawExpression(expression));
    return this;
  }

  /**
   * Convenience alias to pass an array of columns
   * @param {string[]} cols
   * @returns {this}
   */
  columns(cols) {
    if (Array.isArray(cols)) {
      this.selectedColumns = cols;
    }
    return this;
  }

  /**
   * Select distinct
   * @returns {this}
   */
  distinct() {
    this.distinctFlag = true;
    return this;
  }

  /**
   * Add a basic where clause
   * @param {string} column
   * @param {string|any} operator
   * @param {any} value
   * @returns {this}
   */
  where(column, operator, value) {
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }
    this.wheres.push({ column, operator, value, type: 'basic', boolean: 'and' });
    return this;
  }

  /**
   * Add a where in clause
   * @param {string} column
   * @param {Array} values
   * @returns {this}
   */
  whereIn(column, values) {
    this.wheres.push({ column, values, type: 'in', boolean: 'and' });
    return this;
  }

  /**
   * Add a where not in clause
   * @param {string} column
   * @param {Array} values
   * @returns {this}
   */
  whereNotIn(column, values) {
    this.wheres.push({ column, values, type: 'notIn', boolean: 'and' });
    return this;
  }

  /**
   * Add a where null clause
   * @param {string} column
   * @returns {this}
   */
  whereNull(column) {
    this.wheres.push({ column, type: 'null', boolean: 'and' });
    return this;
  }

  /**
   * Add a where not null clause
   * @param {string} column
   * @returns {this}
   */
  whereNotNull(column) {
    this.wheres.push({ column, type: 'notNull', boolean: 'and' });
    return this;
  }

  /**
   * Add an or where clause
   * @param {string} column
   * @param {string|any} operator
   * @param {any} value
   * @returns {this}
   */
  orWhere(column, operator, value) {
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }
    this.wheres.push({ column, operator, value, type: 'basic', boolean: 'or' });
    return this;
  }

  /**
   * Add a where between clause
   * @param {string} column
   * @param {Array} values
   * @returns {this}
   */
  whereBetween(column, values) {
    this.wheres.push({ column, values, type: 'between', boolean: 'and' });
    return this;
  }

  /**
   * Add a where like clause
   * @param {string} column
   * @param {string} value
   * @returns {this}
   */
  whereLike(column, value) {
    this.wheres.push({ column, value, type: 'like', boolean: 'and' });
    return this;
  }

  /**
   * Add a raw where clause
   * @param {string} sql
   * @param {Array} bindings
   * @returns {this}
   */
  whereRaw(sql, bindings = []) {
    this.wheres.push({ type: 'raw', sql, bindings, boolean: 'and' });
    return this;
  }

  /**
   * Add a raw or where clause
   * @param {string} sql
   * @param {Array} bindings
   * @returns {this}
   */
  orWhereRaw(sql, bindings = []) {
    this.wheres.push({ type: 'raw', sql, bindings, boolean: 'or' });
    return this;
  }

  /**
   * Filter parents where the given relation has at least one matching record.
   * Implements via INNER JOIN and applying the related where clauses.
   * @param {string} relationName
   * @param {(qb: QueryBuilder) => void} [callback]
   * @returns {this}
   */
  whereHas(relationName, callback) {
    // Create a dummy parent instance to construct the relation
    const parent = new this.model();
    const fn = parent[relationName];
    if (typeof fn !== 'function') {
      throw new Error(`Relation '${relationName}' is not defined on ${this.model.name}`);
    }
    const relation = fn.call(parent);
    if (!relation?.related || !relation?.foreignKey || !relation?.localKey) {
      throw new Error(`Invalid relation '${relationName}' on ${this.model.name}`);
    }

    const parentTable = assertIdentifier(this.model.table, 'parent table');
    const relatedClass = relation.related;
    const relatedTable = assertIdentifier(relatedClass.table, 'related table');
    const foreignKey = assertIdentifier(relation.foreignKey, 'foreignKey');
    const localKey = assertIdentifier(relation.localKey, 'localKey');

    // Determine relation direction using relation type (relation.child is set on BelongsTo)
    let onLeft, onRight;
    if (relation.child) {
      // belongsTo: parent has FK pointing to related
      const ownerKey = assertIdentifier(relation.ownerKey || relatedClass.primaryKey || 'id', 'ownerKey');
      onLeft = `${relatedTable}.${ownerKey}`;
      onRight = `${parentTable}.${foreignKey}`;
    } else {
      // hasOne/hasMany: related has FK pointing to parent
      onLeft = `${relatedTable}.${foreignKey}`;
      onRight = `${parentTable}.${localKey}`;
    }

    // Ensure the join exists
    this.join(relatedTable, onLeft, '=', onRight);

    if (typeof callback === 'function') {
      const relatedQB = new QueryBuilder(relatedClass);
      callback(relatedQB);

      // Prefix related wheres with table name when necessary
      for (const w of relatedQB.wheres) {
        const clone = { ...w };
        if (clone.column && !/\./.test(clone.column)) {
          clone.column = `${relatedTable}.${clone.column}`;
        }
        this.wheres.push(clone);
      }
    }

    return this;
  }

  /**
   * Filter parents that have related rows count matching operator and count
   * @param {string} relationName
   * @param {string|number} operatorOrCount
   * @param {number} [count]
   * @returns {this}
   */
  has(relationName, operatorOrCount = '>=', count = 1) {
    let operator = operatorOrCount;
    if (typeof operatorOrCount === 'number') {
      operator = '>=';
      count = operatorOrCount;
    }

    // Reuse whereHas join logic without extra wheres
    this.whereHas(relationName);

    const parentTable = this.model.table;
    const parentPk = this.model.primaryKey || 'id';

    // Group by parent primary key and having count
    if (!this.groupBys.includes(`${parentTable}.${parentPk}`)) {
      this.groupBys.push(`${parentTable}.${parentPk}`);
    }
    this.havings.push({ type: 'count', column: '*', operator, value: count });
    return this;
  }

  /**
   * Filter parents that do not have related rows (no callback support for now)
   * @param {string} relationName
   * @returns {this}
   */
  whereDoesntHave(relationName) {
    const parent = new this.model();
    const fn = parent[relationName];
    if (typeof fn !== 'function') {
      throw new Error(`Relation '${relationName}' is not defined on ${this.model.name}`);
    }
    const relation = fn.call(parent);
    const relatedClass = relation.related;
    const relatedTable = assertIdentifier(relatedClass.table, 'related table');
    const parentTable = assertIdentifier(this.model.table, 'parent table');
    const foreignKey = assertIdentifier(relation.foreignKey, 'foreignKey');
    const localKey = assertIdentifier(relation.localKey, 'localKey');

    // Determine direction using relation type (same logic as whereHas)
    let onLeft, onRight;
    if (relation.child) {
      // belongsTo: parent has FK pointing to related
      const ownerKey = assertIdentifier(relation.ownerKey || relatedClass.primaryKey || 'id', 'ownerKey');
      onLeft = `${relatedTable}.${ownerKey}`;
      onRight = `${parentTable}.${foreignKey}`;
    } else {
      // hasOne/hasMany: related has FK pointing to parent
      onLeft = `${relatedTable}.${foreignKey}`;
      onRight = `${parentTable}.${localKey}`;
    }

    // LEFT JOIN and ensure null on related PK
    this.leftJoin(relatedTable, onLeft, '=', onRight);
    const relatedPk = assertIdentifier(relatedClass.primaryKey || 'id', 'relatedPrimaryKey');
    this.whereNull(`${relatedTable}.${relatedPk}`);
    return this;
  }

  /**
   * Add an order by clause
   * @param {string} column
   * @param {string} direction
   * @returns {this}
   */
  orderBy(column, direction = 'asc') {
    this.orders.push({ column, direction: direction.toLowerCase() });
    return this;
  }

  /**
   * Add a raw order by clause
   * @param {string} sql
   * @returns {this}
   */
  orderByRaw(sql) {
    this.orders.push({ type: 'raw', sql });
    return this;
  }

  /**
   * Typo-friendly alias for orderBy
   * @param {string} column
   * @param {string} direction
   * @returns {this}
   */
  ordrer(column, direction = 'asc') {
    return this.orderBy(column, direction);
  }

  /**
   * Set the limit
   * @param {number} value
   * @returns {this}
   */
  limit(value) {
    this.limitValue = value;
    return this;
  }

  /**
   * Set the offset
   * @param {number} value
   * @returns {this}
   */
  offset(value) {
    this.offsetValue = value;
    return this;
  }

  /**
   * Group by columns
   * @param {...string} columns
   * @returns {this}
   */
  groupBy(...columns) {
    this.groupBys.push(...columns);
    return this;
  }

  /**
   * Having clause (basic)
   * @param {string} column
   * @param {string} operator
   * @param {any} value
   * @returns {this}
   */
  having(column, operator, value) {
    this.havings.push({ type: 'basic', column, operator, value });
    return this;
  }

  /**
   * Set the number of records to skip
   * @param {number} value
   * @returns {this}
   */
  skip(value) {
    return this.offset(value);
  }

  /**
   * Set the number of records to take
   * @param {number} value
   * @returns {this}
   */
  take(value) {
    return this.limit(value);
  }

  /**
   * Eager load relations
   * @param {...string} relations
   * @returns {this}
   */
  with(...relations) {
    // Support forms: with('a', 'b') | with(['a','b']) | with({ a: cb })
    if (relations.length === 1 && Array.isArray(relations[0])) {
      this.withRelations.push(...relations[0]);
    } else if (relations.length === 1 && typeof relations[0] === 'object' && !Array.isArray(relations[0])) {
      const obj = relations[0];
      for (const [name, cb] of Object.entries(obj)) {
        this.withRelations.push(name);
        if (typeof cb === 'function') this.withConstraints[name] = cb;
      }
    } else {
      this.withRelations.push(...relations);
    }
    return this;
  }

  /**
   * withCount helper: adds subquery count columns
   * Supports: withCount('rel') or withCount(['a','b'])
   * @param {string|string[]} rels
   * @returns {this}
   */
  withCount(rels) {
    const list = Array.isArray(rels) ? rels : [rels];
    for (const name of list) {
      // Build simple subquery for hasOne/hasMany/belongsTo/belongsToMany
      const parent = new this.model();
      const fn = parent[name];
      if (typeof fn !== 'function') continue;
      const relation = fn.call(parent);
      const parentTable = assertIdentifier(this.model.table, 'parent table');
      const relatedClass = relation.related;
      const relatedTable = assertIdentifier(relatedClass.table, 'related table');

      let sub = '';
      if (relation instanceof require('./Relations/BelongsToManyRelation')) {
        // belongsToMany: count from pivot
        const pivot = assertIdentifier(relation.pivot, 'pivot table');
        const fpk = assertIdentifier(relation.foreignPivotKey, 'foreignPivotKey');
        const pk = assertIdentifier(relation.parentKey, 'parentKey');
        sub = `(SELECT COUNT(*) FROM \`${pivot}\` WHERE \`${pivot}\`.\`${fpk}\` = \`${parentTable}\`.\`${pk}\`) AS \`${name}_count\``;
      } else if (relation.child) {
        // belongsTo
        const ownerKey = assertIdentifier(relation.ownerKey || relatedClass.primaryKey || 'id', 'ownerKey');
        const fk = assertIdentifier(relation.foreignKey, 'foreignKey');
        sub = `(SELECT COUNT(*) FROM \`${relatedTable}\` WHERE \`${relatedTable}\`.\`${ownerKey}\` = \`${parentTable}\`.\`${fk}\`) AS \`${name}_count\``;
      } else {
        // hasOne/hasMany
        const fk = assertIdentifier(relation.foreignKey, 'foreignKey');
        const lk = assertIdentifier(relation.localKey, 'localKey');
        sub = `(SELECT COUNT(*) FROM \`${relatedTable}\` WHERE \`${relatedTable}\`.\`${fk}\` = \`${parentTable}\`.\`${lk}\`) AS \`${name}_count\``;
      }
      this.selectedColumns.push(new RawExpression(sub));
    }
    return this;
  }

  /**
   * Add a join clause
   * @param {string} table
   * @param {string} first
   * @param {string} operator
   * @param {string} second
   * @returns {this}
   */
  join(table, first, operator, second) {
    if (arguments.length === 3) {
      second = operator;
      operator = '=';
    }
    this.joins.push({ table, first, operator, second, type: 'inner' });
    return this;
  }

  /**
   * Add a left join clause
   * @param {string} table
   * @param {string} first
   * @param {string} operator
   * @param {string} second
   * @returns {this}
   */
  leftJoin(table, first, operator, second) {
    if (arguments.length === 3) {
      second = operator;
      operator = '=';
    }
    this.joins.push({ table, first, operator, second, type: 'left' });
    return this;
  }

  /**
   * Execute the query and get all results
   * @returns {Promise<Array>}
   */
  async get() {
    // Apply global scopes and soft delete constraints
    this._applyGlobalScopes();
    this._applySoftDeleteConstraints();

    const rows = await this.model.connection.select(
      this.model.table,
      this.buildQuery()
    );

    const instances = rows.map(row => this.hydrate(row));

    if (this.withRelations.length > 0) {
      await this.eagerLoadRelations(instances);
    }

    return instances;
  }

  /**
   * Get the first result
   * @returns {Promise<Model|null>}
   */
  async first() {
    this.limit(1);
    const results = await this.get();
    return results[0] || null;
  }

  /**
   * Get the first result or throw an exception
   * @returns {Promise<Model>}
   */
  async firstOrFail() {
    const result = await this.first();
    if (!result) {
      throw new Error(`Model not found in table ${this.model.table}`);
    }
    return result;
  }

  /**
   * Get the first record matching current wheres or create a new one
   * @param {Object} [values={}] - Additional attributes to merge on creation
   * @returns {Promise<Model>}
   */
  async firstOrCreate(values = {}) {
    const existing = await this.first();
    if (existing) return existing;
    // Build conditions from current wheres
    const conditions = {};
    for (const w of this.wheres) {
      if (w.type === 'basic' && w.operator === '=') {
        conditions[w.column] = w.value;
      }
    }
    const instance = new this.model({ ...conditions, ...values });
    return instance.save();
  }

  /**
   * Get the first record matching current wheres or return a new (unsaved) instance
   * @param {Object} [values={}] - Additional attributes for the instance
   * @returns {Promise<Model>}
   */
  async firstOrNew(values = {}) {
    const existing = await this.first();
    if (existing) return existing;
    const conditions = {};
    for (const w of this.wheres) {
      if (w.type === 'basic' && w.operator === '=') {
        conditions[w.column] = w.value;
      }
    }
    return new this.model({ ...conditions, ...values });
  }

  /**
   * Find a record matching current wheres and update it, or create a new one
   * @param {Object} values - Attributes to update or set on creation
   * @returns {Promise<Model>}
   */
  async updateOrCreate(values = {}) {
    const existing = await this.first();
    if (existing) {
      for (const [key, val] of Object.entries(values)) {
        existing.setAttribute(key, val);
      }
      await existing.save();
      return existing;
    }
    const conditions = {};
    for (const w of this.wheres) {
      if (w.type === 'basic' && w.operator === '=') {
        conditions[w.column] = w.value;
      }
    }
    const instance = new this.model({ ...conditions, ...values });
    return instance.save();
  }

  /**
   * Lazily iterate over matching records using an async generator.
   * Yields one model instance at a time, consuming minimal memory.
   * @param {number} [chunkSize=100] - Number of records per internal query
   * @returns {AsyncGenerator<Model>}
   */
  async *cursor(chunkSize = 100) {
    let offset = 0;
    while (true) {
      const cloned = this.clone();
      cloned.limitValue = chunkSize;
      cloned.offsetValue = offset;
      const results = await cloned.get();
      if (results.length === 0) break;
      for (const model of results) {
        yield model;
      }
      if (results.length < chunkSize) break;
      offset += chunkSize;
    }
  }

  /**
   * Paginate the results
   * @param {number} page
   * @param {number} perPage
   * @returns {Promise<Object>}
   */
  async paginate(page = 1, perPage = 15) {
    const offset = (page - 1) * perPage;

    // Apply scopes for count
    this._applyGlobalScopes();
    this._applySoftDeleteConstraints();

    const total = await this.count();
    const data = await this.offset(offset).limit(perPage).get();

    return {
      data,
      total,
      per_page: perPage,
      current_page: page,
      last_page: Math.ceil(total / perPage),
      from: total > 0 ? offset + 1 : null,
      to: offset + data.length
    };
  }

  /**
   * Get the count of records
   * @returns {Promise<number>}
   */
  async count() {
    // Apply scopes for count
    this._applyGlobalScopes();
    this._applySoftDeleteConstraints();

    const result = await this.model.connection.count(
      this.model.table,
      this.buildQuery()
    );
    return result;
  }

  /**
   * Check if any records exist
   * @returns {Promise<boolean>}
   */
  async exists() {
    const count = await this.count();
    return count > 0;
  }

  /**
   * Insert records
   * @param {Object|Array<Object>} data
   * @returns {Promise<any>}
   */
  async insert(data) {
    // Apply fillable guard: only allow fields listed in model.fillable (if defined)
    const fillable = this.model.fillable || [];
    const applyFillable = (obj) => fillable.length > 0
      ? Object.fromEntries(Object.entries(obj).filter(([k]) => fillable.includes(k)))
      : { ...obj };

    const safeData = Array.isArray(data) ? data.map(applyFillable) : applyFillable(data);

    if (Array.isArray(safeData)) {
      return this.model.connection.insertMany(this.model.table, safeData);
    }
    return this.model.connection.insert(this.model.table, safeData);
  }

  /**
   * Update records
   * @param {Object} attributes
   * @returns {Promise<any>}
   */
  async update(attributes) {
    // Apply fillable guard: only allow fields listed in model.fillable (if defined)
    const fillable = this.model.fillable || [];
    const safeAttributes = fillable.length > 0
      ? Object.fromEntries(Object.entries(attributes).filter(([k]) => fillable.includes(k)))
      : { ...attributes };

    if (this.model.timestamps) {
      safeAttributes.updated_at = new Date();
    }

    return this.model.connection.update(
      this.model.table,
      safeAttributes,
      this.buildQuery()
    );
  }

  /**
   * Update records and fetch the first updated model, optionally eager loading relations
   * @param {Object} attributes
   * @param {string[]} [relations]
   * @returns {Promise<Model|null>}
   */
  async updateAndFetch(attributes, relations = []) {
    await this.update(attributes);
    const qb = this.clone();
    if (relations?.length) {
      qb.with(...relations);
    }
    return qb.first();
  }

  /**
   * Delete records
   * @returns {Promise<any>}
   */
  async delete() {
    return this.model.connection.delete(
      this.model.table,
      this.buildQuery()
    );
  }

  /**
   * Increment a column's value
   * @param {string} column
   * @param {number} amount
   * @returns {Promise<any>}
   */
  async increment(column, amount = 1) {
    return this.model.connection.increment(
      this.model.table,
      column,
      this.buildQuery(),
      amount
    );
  }

  /**
   * Decrement a column's value
   * @param {string} column
   * @param {number} amount
   * @returns {Promise<any>}
   */
  async decrement(column, amount = 1) {
    return this.model.connection.decrement(
      this.model.table,
      column,
      this.buildQuery(),
      amount
    );
  }

  /**
   * Create a model instance from a database row
   * @param {Object} row
   * @returns {Model}
   */
  hydrate(row) {
    const instance = new this.model();
    instance.attributes = row;
    instance.original = { ...row };
    instance.exists = true;
    instance._showHidden = this._showHidden;
    return instance;
  }

  /**
   * Eager load relations for a collection of models
   * @param {Array<Model>} instances
   * @returns {Promise<void>}
   */
  async eagerLoadRelations(instances) {
    if (instances.length === 0) return;

    for (const relationName of this.withRelations) {
      await this.loadRelationPath(instances, relationName, this.withConstraints[relationName]);
    }
  }

  /**
   * Load a relation path with support for nested relations (dot notation)
   * @param {Array<Model>} models
   * @param {string} path
   * @param {*} constraint
   * @returns {Promise<void>}
   */
  async loadRelationPath(models, path, constraint) {
    if (models.length === 0) return;

    const segments = path.split('.');
    const head = segments[0];
    const tail = segments.slice(1).join('.');

    // Prevent prototype pollution and calling built-in methods
    const builtIns = ['constructor', 'load', 'save', 'delete', 'update', 'query', 'with', 'withCount', 'hasOne', 'hasMany', 'belongsTo', 'belongsToMany', 'morphTo', 'morphOne', 'morphMany', 'hasOneThrough', 'hasManyThrough'];
    if (builtIns.includes(head) || head.startsWith('__')) return;

    // Load head relation eagerly
    const relationInstance = models[0][head];
    if (typeof relationInstance === 'function') {
      const relation = relationInstance.call(models[0]);
      if (relation && typeof relation.eagerLoad === 'function') {
        await relation.eagerLoad(models, head, constraint);
      }
    }

    if (tail) {
      // Collect all related models from the loaded relations
      const relatedModels = models.flatMap(model => {
        const rel = model.relations[head];
        return Array.isArray(rel) ? rel : (rel ? [rel] : []);
      }).filter(Boolean);

      if (relatedModels.length > 0) {
        // Recursively load the remaining path on related models
        await this.loadRelationPath(relatedModels, tail, null);
      }
    }
  }

  /**
   * Build the query object
   * @returns {Object}
   */
  buildQuery() {
    return {
      columns: this.selectedColumns,
      wheres: this.wheres,
      orders: this.orders,
      joins: this.joins,
      distinct: this.distinctFlag,
      groupBys: this.groupBys,
      havings: this.havings,
      limit: this.limitValue,
      offset: this.offsetValue
    };
  }

  /**
   * Clone the query builder
   * @returns {QueryBuilder}
   */
  clone() {
    const cloned = new QueryBuilder(this.model);
    cloned.wheres = [...this.wheres];
    cloned.orders = [...this.orders];
    cloned.limitValue = this.limitValue;
    cloned.offsetValue = this.offsetValue;
    cloned.selectedColumns = [...this.selectedColumns];
    cloned.withRelations = [...this.withRelations];
    cloned.withConstraints = { ...this.withConstraints };
    cloned.joins = [...this.joins];
    cloned.distinctFlag = this.distinctFlag;
    cloned.groupBys = [...this.groupBys];
    cloned.havings = [...this.havings];

    cloned._showHidden = this._showHidden;
    cloned._withTrashed = this._withTrashed;
    cloned._onlyTrashed = this._onlyTrashed;
    cloned._excludedScopes = [...this._excludedScopes];
    cloned._excludeAllScopes = this._excludeAllScopes;
    cloned._scopesApplied = this._scopesApplied;
    cloned._softDeleteApplied = this._softDeleteApplied;

    return cloned;
  }
}

module.exports = QueryBuilder;

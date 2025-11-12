/**
 * Query Builder for constructing and executing database queries
 */
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

    const parentTable = this.model.table;
    const relatedClass = relation.related;
    const relatedTable = relatedClass.table;

    // Heuristic to detect relation direction
    const relatedDerivedFK = `${relatedTable.replace(/s$/, '')}_id`;

    // Build ON condition depending on relation type
    let onLeft, onRight;
    if (relation.foreignKey === relatedDerivedFK) {
      // belongsTo: parent has FK to related
      onLeft = `${relatedTable}.${relation.localKey}`; // related.ownerKey
      onRight = `${parentTable}.${relation.foreignKey}`; // parent.foreignKey
    } else {
      // hasOne/hasMany: related has FK to parent
      onLeft = `${relatedTable}.${relation.foreignKey}`; // related.foreignKey -> parent
      onRight = `${parentTable}.${relation.localKey}`; // parent.localKey (usually PK)
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
    const relatedTable = relatedClass.table;
    const parentTable = this.model.table;

    // Heuristic to detect direction as above
    const relatedDerivedFK = `${relatedTable.replace(/s$/, '')}_id`;
    let onLeft, onRight;
    if (relation.foreignKey === relatedDerivedFK) {
      onLeft = `${relatedTable}.${relation.localKey}`;
      onRight = `${parentTable}.${relation.foreignKey}`;
    } else {
      onLeft = `${relatedTable}.${relation.foreignKey}`;
      onRight = `${parentTable}.${relation.localKey}`;
    }

    // LEFT JOIN and ensure null on related PK
    this.leftJoin(relatedTable, onLeft, '=', onRight);
    const relatedPk = relatedClass.primaryKey || 'id';
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
      const parentTable = this.model.table;
      const relatedClass = relation.related;
      const relatedTable = relatedClass.table;

      let sub = '';
      if (relation instanceof require('./Relations/BelongsToManyRelation')) {
        // belongsToMany: count from pivot
        sub = `(SELECT COUNT(*) FROM ${relation.pivot} WHERE ${relation.pivot}.${relation.foreignPivotKey} = ${parentTable}.${relation.parentKey}) AS ${name}_count`;
      } else if (relation.child) {
        // belongsTo
        const ownerKey = relation.ownerKey || relatedClass.primaryKey || 'id';
        sub = `(SELECT COUNT(*) FROM ${relatedTable} WHERE ${relatedTable}.${ownerKey} = ${parentTable}.${relation.foreignKey}) AS ${name}_count`;
      } else {
        // hasOne/hasMany
        sub = `(SELECT COUNT(*) FROM ${relatedTable} WHERE ${relatedTable}.${relation.foreignKey} = ${parentTable}.${relation.localKey}) AS ${name}_count`;
      }
      this.selectedColumns.push(sub);
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
   * Paginate the results
   * @param {number} page
   * @param {number} perPage
   * @returns {Promise<Object>}
   */
  async paginate(page = 1, perPage = 15) {
    const offset = (page - 1) * perPage;

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
    if (Array.isArray(data)) {
      return this.model.connection.insertMany(this.model.table, data);
    }
    return this.model.connection.insert(this.model.table, data);
  }

  /**
   * Update records
   * @param {Object} attributes
   * @returns {Promise<any>}
   */
  async update(attributes) {
    if (this.model.timestamps) {
      attributes.updated_at = new Date();
    }

    return this.model.connection.update(
      this.model.table,
      attributes,
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
    return cloned;
  }
}

module.exports = QueryBuilder;

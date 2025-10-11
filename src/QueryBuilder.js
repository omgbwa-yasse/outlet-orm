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
    this.joins = [];
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
    this.withRelations.push(...relations);
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
    return this.update({ [column]: `${column} + ${amount}` });
  }

  /**
   * Decrement a column's value
   * @param {string} column
   * @param {number} amount
   * @returns {Promise<any>}
   */
  async decrement(column, amount = 1) {
    return this.update({ [column]: `${column} - ${amount}` });
  }

  /**
   * Create a model instance from a row
   * @param {Object} row
   * @returns {Model}
   */
  hydrate(row) {
    const instance = new this.model();
    instance.attributes = row;
    instance.original = { ...row };
    instance.exists = true;
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
      const relationInstance = instances[0][relationName];
      
      if (typeof relationInstance === 'function') {
        const relation = relationInstance.call(instances[0]);
        
        if (relation && typeof relation.eagerLoad === 'function') {
          await relation.eagerLoad(instances, relationName);
        }
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
    cloned.joins = [...this.joins];
    return cloned;
  }
}

module.exports = QueryBuilder;

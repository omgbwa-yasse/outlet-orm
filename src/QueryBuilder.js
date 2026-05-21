/**
 * Query Builder for constructing and executing database queries
 */
const RawExpression = require('./RawExpression');
const QueryBuilderError = require('./Errors/QueryBuilderError');

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

function assertFromSource(source) {
  if (
    source === null ||
    source === undefined ||
    (typeof source === 'string' && source.trim() === '') ||
    (!(source instanceof RawExpression) && typeof source !== 'string')
  ) {
    throw new QueryBuilderError(
      'from() requires a non-empty table name string or a RawExpression instance.'
    );
  }
  return source;
}

class QueryBuilder {
  constructor(model, options = {}) {
    this.model = model;
    this._standaloneConnection = options.connection || null;
    this._standaloneSource = options.source || null;
    this._fromSource = null;
    this._consumed = false;
    this._subParams = [];
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
    this.unions = [];
    this.tableAlias = null;
    this._showHidden = false;
    this._withTrashed = false;
    this._onlyTrashed = false;
    this._excludedScopes = [];
    this._excludeAllScopes = false;
  }

  get _isStandalone() {
    return this.model === null && this._standaloneConnection !== null;
  }

  _assertNotConsumed() {
    if (!this._isStandalone) return;
    if (this._consumed) {
      throw new QueryBuilderError(
        'This query builder instance has already been executed. Create a new instance via db.from().'
      );
    }
  }

  _buildQueryObj() {
    const query = this.buildQuery();
    if (this._subParams && this._subParams.length > 0) {
      return { ...query, params: [...this._subParams, ...(query.params || [])] };
    }
    return query;
  }

  _getQuerySource() {
    if (this._isStandalone) {
      return this._standaloneSource;
    }
    return this._fromSource || this.model.table;
  }

  _getQuerySourceLabel() {
    const source = this._getQuerySource();
    if (source instanceof RawExpression) {
      return source.value;
    }
    return String(source);
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
   * Override the FROM source for the query.
   * @param {string|RawExpression} source
   * @returns {this}
   */
  from(source) {
    const resolved = assertFromSource(source);
    if (this._isStandalone) {
      this._assertNotConsumed();
      this._standaloneSource = resolved;
      return this;
    }

    this._fromSource = resolved;
    return this;
  }

  /**
   * Set a table alias for the FROM clause (e.g. `User.query().as('u')`)
   * @param {string} alias
   * @returns {this}
   */
  as(alias) {
    this.tableAlias = assertIdentifier(alias, 'table alias');
    return this;
  }

  /**
   * Add a raw select expression
   * @param {string} expression
   * @returns {this}
   */
  selectRaw(expression) {
    if (this.selectedColumns.length === 1 && this.selectedColumns[0] === '*') {
      this.selectedColumns = [];
    }
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
   * Add a where not between clause
   * @param {string} column
   * @param {Array} values
   * @returns {this}
   */
  whereNotBetween(column, values) {
    this.wheres.push({ column, values, type: 'notBetween', boolean: 'and' });
    return this;
  }

  /**
   * Or variants of the where helpers
   */
  orWhereIn(column, values) {
    this.wheres.push({ column, values, type: 'in', boolean: 'or' });
    return this;
  }
  orWhereNotIn(column, values) {
    this.wheres.push({ column, values, type: 'notIn', boolean: 'or' });
    return this;
  }
  orWhereBetween(column, values) {
    this.wheres.push({ column, values, type: 'between', boolean: 'or' });
    return this;
  }
  orWhereNotBetween(column, values) {
    this.wheres.push({ column, values, type: 'notBetween', boolean: 'or' });
    return this;
  }
  orWhereNull(column) {
    this.wheres.push({ column, type: 'null', boolean: 'or' });
    return this;
  }
  orWhereNotNull(column) {
    this.wheres.push({ column, type: 'notNull', boolean: 'or' });
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
   * Add a raw HAVING clause
   * @param {string} sql
   * @param {Array} bindings
   * @returns {this}
   */
  havingRaw(sql, bindings = []) {
    this.havings.push({ type: 'raw', sql, bindings });
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
      this._addAggregateSubquery('COUNT', name, '*', `${name}_count`);
    }
    return this;
  }

  /**
   * withSum/withAvg/withMin/withMax helpers
   * Adds an aggregate subquery column for a relation.
   * @param {string} rel
   * @param {string} column
   * @returns {this}
   */
  withSum(rel, column) { return this._addAggregateSubquery('SUM', rel, column, `${rel}_sum_${column}`); }
  withAvg(rel, column) { return this._addAggregateSubquery('AVG', rel, column, `${rel}_avg_${column}`); }
  withMin(rel, column) { return this._addAggregateSubquery('MIN', rel, column, `${rel}_min_${column}`); }
  withMax(rel, column) { return this._addAggregateSubquery('MAX', rel, column, `${rel}_max_${column}`); }

  /**
   * Internal: build aggregate subquery column for a relation.
   * @private
   */
  _addAggregateSubquery(fn, name, column, alias) {
    const parent = new this.model();
    const relFn = parent[name];
    if (typeof relFn !== 'function') return this;
    const relation = relFn.call(parent);
    const parentTable = assertIdentifier(this.model.table, 'parent table');
    const relatedClass = relation.related;
    const relatedTable = assertIdentifier(relatedClass.table, 'related table');
    const aliasId = assertIdentifier(alias, 'aggregate alias');
    const expr = column === '*' ? '*' : `\`${relatedTable}\`.\`${assertIdentifier(column, 'aggregate column')}\``;

    let sub;
    if (relation instanceof require('./Relations/BelongsToManyRelation')) {
      const pivot = assertIdentifier(relation.pivot, 'pivot table');
      const fpk = assertIdentifier(relation.foreignPivotKey, 'foreignPivotKey');
      const rpk = assertIdentifier(relation.relatedPivotKey, 'relatedPivotKey');
      const pk = assertIdentifier(relation.parentKey, 'parentKey');
      const rk = assertIdentifier(relation.relatedKey || relatedClass.primaryKey || 'id', 'relatedKey');
      if (fn === 'COUNT' && column === '*') {
        sub = `(SELECT COUNT(*) FROM \`${pivot}\` WHERE \`${pivot}\`.\`${fpk}\` = \`${parentTable}\`.\`${pk}\`) AS \`${aliasId}\``;
      } else {
        sub = `(SELECT ${fn}(${expr}) FROM \`${relatedTable}\` INNER JOIN \`${pivot}\` ON \`${pivot}\`.\`${rpk}\` = \`${relatedTable}\`.\`${rk}\` WHERE \`${pivot}\`.\`${fpk}\` = \`${parentTable}\`.\`${pk}\`) AS \`${aliasId}\``;
      }
    } else if (relation.child) {
      const ownerKey = assertIdentifier(relation.ownerKey || relatedClass.primaryKey || 'id', 'ownerKey');
      const fk = assertIdentifier(relation.foreignKey, 'foreignKey');
      sub = `(SELECT ${fn}(${expr}) FROM \`${relatedTable}\` WHERE \`${relatedTable}\`.\`${ownerKey}\` = \`${parentTable}\`.\`${fk}\`) AS \`${aliasId}\``;
    } else {
      const fk = assertIdentifier(relation.foreignKey, 'foreignKey');
      const lk = assertIdentifier(relation.localKey, 'localKey');
      sub = `(SELECT ${fn}(${expr}) FROM \`${relatedTable}\` WHERE \`${relatedTable}\`.\`${fk}\` = \`${parentTable}\`.\`${lk}\`) AS \`${aliasId}\``;
    }
    this.selectedColumns.push(new RawExpression(sub));
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
   * Add a right join clause
   * @param {string} table
   * @param {string} first
   * @param {string} operator
   * @param {string} second
   * @returns {this}
   */
  rightJoin(table, first, operator, second) {
    if (arguments.length === 3) {
      second = operator;
      operator = '=';
    }
    this.joins.push({ table, first, operator, second, type: 'right' });
    return this;
  }

  /**
   * Add a cross join clause
   * @param {string} table
   * @returns {this}
   */
  crossJoin(table) {
    this.joins.push({ table, type: 'cross' });
    return this;
  }

  /**
   * Append a UNION query
   * @param {QueryBuilder} query
   * @returns {this}
   */
  union(query) {
    this.unions.push({ qb: query, all: false });
    return this;
  }

  /**
   * Append a UNION ALL query
   * @param {QueryBuilder} query
   * @returns {this}
   */
  unionAll(query) {
    this.unions.push({ qb: query, all: true });
    return this;
  }

  /**
   * Execute the query and get all results
   * @returns {Promise<Array>}
   */
  async get() {
    if (this._isStandalone) {
      this._assertNotConsumed();
      this._consumed = true;
      return await this._standaloneConnection.select(
        this._getQuerySource(),
        this._buildQueryObj()
      );
    }

    // Apply global scopes and soft delete constraints
    this._applyGlobalScopes();
    this._applySoftDeleteConstraints();

    const rows = await this.model.connection.select(
      this._getQuerySource(),
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
    if (this._isStandalone) {
      this._assertNotConsumed();
      this._consumed = true;
      this.limit(1);
      const rows = await this._standaloneConnection.select(
        this._getQuerySource(),
        this._buildQueryObj()
      );
      return rows[0] || null;
    }

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
      throw new Error(`Model not found in table ${this._getQuerySourceLabel()}`);
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
  async count(column = '*') {
    if (this._isStandalone || column !== '*') {
      return this._aggregate('COUNT', column);
    }

    // Apply scopes for count
    this._applyGlobalScopes();
    this._applySoftDeleteConstraints();

    const result = await this.model.connection.count(
      this._getQuerySource(),
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
   * Check that no record matches
   * @returns {Promise<boolean>}
   */
  async doesntExist() {
    return !(await this.exists());
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
   * Insert a record and return the new auto-increment id
   * @param {Object} data
   * @returns {Promise<number|string|undefined>}
   */
  async insertGetId(data) {
    const result = await this.insert(data);
    if (result && typeof result === 'object') {
      return result.insertId ?? result.lastID ?? result.id ?? result;
    }
    return result;
  }

  /**
   * Update records
   * @param {Object} attributes
   * @returns {Promise<any>}
   */
  async update(attributes) {
    if (this._isStandalone) {
      this._assertNotConsumed();
      this._consumed = true;
      return this._standaloneConnection.update(
        this._getQuerySource(),
        { ...attributes },
        this.buildQuery()
      );
    }
    // Apply fillable guard: only allow fields listed in model.fillable (if defined)
    const fillable = this.model.fillable || [];
    const safeAttributes = fillable.length > 0
      ? Object.fromEntries(Object.entries(attributes).filter(([k]) => fillable.includes(k)))
      : { ...attributes };

    if (this.model.timestamps) {
      safeAttributes.updated_at = new Date();
    }

    return this.model.connection.update(
      this._getQuerySource(),
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
    if (this._isStandalone) {
      this._assertNotConsumed();
      this._consumed = true;
      return this._standaloneConnection.delete(
        this._getQuerySource(),
        this.buildQuery()
      );
    }
    return this.model.connection.delete(
      this._getQuerySource(),
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
    if (this._isStandalone) {
      this._assertNotConsumed();
      this._consumed = true;
      return this._standaloneConnection.increment(
        this._getQuerySource(),
        column,
        this.buildQuery(),
        amount
      );
    }
    return this.model.connection.increment(
      this._getQuerySource(),
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
    if (this._isStandalone) {
      this._assertNotConsumed();
      this._consumed = true;
      return this._standaloneConnection.decrement(
        this._getQuerySource(),
        column,
        this.buildQuery(),
        amount
      );
    }
    return this.model.connection.decrement(
      this._getQuerySource(),
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

  // ==================== Convenience Query Methods ====================

  /**
   * Get an array of values for a single column, optionally keyed by another column
   * @param {string} column
   * @param {string} [keyColumn]
   * @returns {Promise<Array|Object>}
   */
  async pluck(column, keyColumn) {
    assertIdentifier(column, 'pluck column');
    if (keyColumn) assertIdentifier(keyColumn, 'pluck key column');

    const cols = keyColumn ? [column, keyColumn] : [column];
    this.selectedColumns = cols;
    let rows;

    if (this._isStandalone) {
      this._assertNotConsumed();
      this._consumed = true;
      rows = await this._standaloneConnection.select(
        this._getQuerySource(),
        this._buildQueryObj()
      );
    } else {
      this._applyGlobalScopes();
      this._applySoftDeleteConstraints();

      rows = await this.model.connection.select(
        this._getQuerySource(),
        this.buildQuery()
      );
    }

    if (keyColumn) {
      const result = {};
      for (const row of rows) {
        result[row[keyColumn]] = row[column];
      }
      return result;
    }
    return rows.map(row => row[column]);
  }

  /**
   * Get the value of a single column from the first matching row
   * @param {string} column
   * @returns {Promise<any>}
   */
  async value(column) {
    assertIdentifier(column, 'value column');
    this.selectedColumns = [column];
    this.limitValue = 1;

    let rows;
    if (this._isStandalone) {
      this._assertNotConsumed();
      this._consumed = true;
      rows = await this._standaloneConnection.select(
        this._getQuerySource(),
        this._buildQueryObj()
      );
    } else {
      this._applyGlobalScopes();
      this._applySoftDeleteConstraints();

      rows = await this.model.connection.select(
        this._getQuerySource(),
        this.buildQuery()
      );
    }

    if (rows.length === 0) return null;
    return rows[0][column];
  }

  // ==================== Aggregate Methods ====================

  /**
   * Get the sum of a column
   * @param {string} column
   * @returns {Promise<number>}
   */
  async sum(column) {
    return this._aggregate('SUM', column);
  }

  /**
   * Get the average of a column
   * @param {string} column
   * @returns {Promise<number>}
   */
  async avg(column) {
    return this._aggregate('AVG', column);
  }

  /**
   * Get the minimum value of a column
   * @param {string} column
   * @returns {Promise<number>}
   */
  async min(column) {
    return this._aggregate('MIN', column);
  }

  /**
   * Get the maximum value of a column
   * @param {string} column
   * @returns {Promise<number>}
   */
  async max(column) {
    return this._aggregate('MAX', column);
  }

  /**
   * Execute an aggregate function on a column
   * @param {string} fn - SQL aggregate function
   * @param {string} column
   * @returns {Promise<number>}
   * @private
   */
  async _aggregate(fn, column) {
    if (column !== '*') {
      assertIdentifier(column, 'aggregate column');
    }
    if (this._isStandalone) {
      this._assertNotConsumed();
      this._consumed = true;
      const queryObj = this._buildQueryObj();
      queryObj.columns = [new RawExpression(`${fn}(${column}) AS aggregate`)];
      const rows = await this._standaloneConnection.select(this._standaloneSource, queryObj);
      return Number(rows[0]?.aggregate ?? 0);
    }

    this._applyGlobalScopes();
    this._applySoftDeleteConstraints();

    const result = await this.model.connection.aggregate(
      this._getQuerySource(),
      fn,
      column,
      this.buildQuery()
    );
    return result;
  }

  // ==================== Batch & Conditional Methods ====================

  /**
   * Process query results in chunks
   * @param {number} size - Chunk size
   * @param {Function} callback - Receives (chunk, page). Return false to stop.
   * @returns {Promise<void>}
   */
  async chunk(size, callback) {
    let page = 1;
    let offset = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const cloned = this.clone();
      cloned.limitValue = size;
      cloned.offsetValue = offset;
      const results = await cloned.get();

      if (results.length === 0) break;

      const shouldContinue = await callback(results, page);
      if (shouldContinue === false) break;
      if (results.length < size) break;

      offset += size;
      page++;
    }
  }

  /**
   * Apply a callback to the query when a condition is truthy
   * @param {any} condition
   * @param {Function} callback - Receives the query builder when condition is truthy
   * @param {Function} [fallback] - Receives the query builder when condition is falsy
   * @returns {this}
   */
  when(condition, callback, fallback) {
    if (condition) {
      callback(this, condition);
    } else if (typeof fallback === 'function') {
      fallback(this, condition);
    }
    return this;
  }

  /**
   * Pass the query builder to a callback for inspection without modifying the chain
   * @param {Function} callback
   * @returns {this}
   */
  tap(callback) {
    callback(this);
    return this;
  }

  // ==================== Debugging ====================

  /**
   * Get the raw SQL representation of the current query (for debugging)
   * @returns {Object} Query object with all clauses
   */
  toSQL() {
    if (!this._isStandalone) {
      this._applyGlobalScopes();
      this._applySoftDeleteConstraints();
    }
    return {
      table: this._getQuerySourceLabel(),
      ...this.buildQuery()
    };
  }

  /**
   * Dump the SQL representation and die (log + throw)
   */
  dd() {
    const sql = this.toSQL();
    console.log('Query Dump:', JSON.stringify(sql, null, 2));
    throw new Error('dd(): Query dumped. See console output above.');
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
      offset: this.offsetValue,
      tableAlias: this.tableAlias,
      unions: this.unions.map(u => ({
        all: u.all,
        table: u.qb._getQuerySource(),
        query: u.qb.buildQuery()
      }))
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
    cloned.unions = [...this.unions];
    cloned.tableAlias = this.tableAlias;

    cloned._showHidden = this._showHidden;
    cloned._withTrashed = this._withTrashed;
    cloned._onlyTrashed = this._onlyTrashed;
    cloned._excludedScopes = [...this._excludedScopes];
    cloned._excludeAllScopes = this._excludeAllScopes;
    cloned._scopesApplied = this._scopesApplied;
    cloned._softDeleteApplied = this._softDeleteApplied;
    cloned._standaloneConnection = this._standaloneConnection;
    cloned._standaloneSource = this._standaloneSource;
    cloned._fromSource = this._fromSource;
    cloned._consumed = this._consumed;
    cloned._subParams = this._subParams ? [...this._subParams] : [];

    return cloned;
  }
}

module.exports = QueryBuilder;

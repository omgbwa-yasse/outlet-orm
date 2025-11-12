const QueryBuilder = require('./QueryBuilder');

/**
 * Base Model class inspired by Laravel Eloquent
 */
class Model {
  static table = '';
  static primaryKey = 'id';
  static timestamps = true;
  static fillable = [];
  static hidden = [];
  static casts = {};
  static connection = null;

  /**
   * Ensure a default database connection exists.
   * If none is set, it will be initialized from environment (.env) lazily.
   */
  static ensureConnection() {
    if (!this.connection) {
      // Lazy require to avoid circular dependencies
      const DatabaseConnection = require('./DatabaseConnection');
      this.connection = new DatabaseConnection();
    }
  }

  /**
   * Set the default database connection for all models
   * @param {DatabaseConnection} connection
   */
  static setConnection(connection) {
    this.connection = connection;
  }

  /**
   * Set the morph map for polymorphic relations
   * @param {Object} map
   */
  static setMorphMap(map) {
    this.morphMap = map;
  }

  constructor(attributes = {}) {
    // Auto-initialize connection on first model instantiation if missing
    this.constructor.ensureConnection();
    this.attributes = {};
    this.original = {};
    this.relations = {};
    this.touches = [];
    this.exists = false;
    this._showHidden = false;
    this.fill(attributes);
  }

  // ==================== Query Builder ====================

  /**
   * Begin querying the model
   * @returns {QueryBuilder}
   */
  static query() {
    // Ensure a connection exists even when using static APIs without instantiation
    this.ensureConnection();
    return new QueryBuilder(this);
  }

  /**
   * Get all records
   * @returns {Promise<Array<Model>>}
   */
  static all() {
    return this.query().get();
  }

  /**
   * Find a model by its primary key
   * @param {any} id
   * @returns {Promise<Model|null>}
   */
  static find(id) {
    return this.query().where(this.primaryKey, id).first();
  }

  /**
   * Find a model by its primary key or throw an error
   * @param {any} id
   * @returns {Promise<Model>}
   */
  static findOrFail(id) {
    return this.query().where(this.primaryKey, id).firstOrFail();
  }

  /**
   * Add a where clause
   * @param {string} column
   * @param {string|any} operator
   * @param {any} value
   * @returns {QueryBuilder}
   */
  static where(column, operator, value) {
    if (arguments.length === 2) {
      value = operator;
      operator = '=';
    }
    return this.query().where(column, operator, value);
  }

  /**
   * Create a new model and save it
   * @param {Object} attributes
   * @returns {Promise<Model>}
   */
  static create(attributes) {
    const instance = new this(attributes);
    return instance.save();
  }

  /**
   * Insert data without creating model instances
   * @param {Object|Array<Object>} data
   * @returns {Promise<any>}
   */
  static async insert(data) {
    const query = this.query();
    return query.insert(data);
  }

  /**
   * Update records
   * @param {Object} attributes
   * @returns {Promise<any>}
   */
  static async update(attributes) {
    return this.query().update(attributes);
  }

  /**
   * Update by primary key and fetch the updated model (optionally with relations)
   * @param {any} id
   * @param {Object} attributes
   * @param {string[]} [relations]
   * @returns {Promise<Model|null>}
   */
  static async updateAndFetchById(id, attributes, relations = []) {
    await this.query().where(this.primaryKey, id).update(attributes);
    const qb = this.query().where(this.primaryKey, id);
    if (relations && relations.length) qb.with(...relations);
    return qb.first();
  }

  /**
   * Update by primary key only (convenience)
   * @param {any} id
   * @param {Object} attributes
   * @returns {Promise<any>}
   */
  static async updateById(id, attributes) {
    return this.query().where(this.primaryKey, id).update(attributes);
  }

  /**
   * Delete records
   * @returns {Promise<any>}
   */
  static async delete() {
    return this.query().delete();
  }

  /**
   * Get the first record
   * @returns {Promise<Model|null>}
   */
  static first() {
    return this.query().first();
  }

  /**
   * Add an order by clause
   * @param {string} column
   * @param {string} direction
   * @returns {QueryBuilder}
   */
  static orderBy(column, direction = 'asc') {
    return this.query().orderBy(column, direction);
  }

  /**
   * Limit the number of results
   * @param {number} value
   * @returns {QueryBuilder}
   */
  static limit(value) {
    return this.query().limit(value);
  }

  /**
   * Offset the results
   * @param {number} value
   * @returns {QueryBuilder}
   */
  static offset(value) {
    return this.query().offset(value);
  }

  /**
   * Paginate the results
   * @param {number} page
   * @param {number} perPage
   * @returns {Promise<Object>}
   */
  static paginate(page = 1, perPage = 15) {
    return this.query().paginate(page, perPage);
  }

  /**
   * Add a where in clause
   * @param {string} column
   * @param {Array} values
   * @returns {QueryBuilder}
   */
  static whereIn(column, values) {
    return this.query().whereIn(column, values);
  }

  /**
   * Add a where null clause
   * @param {string} column
   * @returns {QueryBuilder}
   */
  static whereNull(column) {
    return this.query().whereNull(column);
  }

  /**
   * Add a where not null clause
   * @param {string} column
   * @returns {QueryBuilder}
   */
  static whereNotNull(column) {
    return this.query().whereNotNull(column);
  }

  /**
   * Count records
   * @returns {Promise<number>}
   */
  static count() {
    return this.query().count();
  }

  /**
   * Eager load relations on the query
   * @param {...string} relations
   * @returns {QueryBuilder}
   */
  static with(...relations) {
    return this.query().with(...relations);
  }

  /**
   * Include hidden attributes in query results
   * @returns {QueryBuilder}
   */
  static withHidden() {
    const query = this.query();
    query._showHidden = true;
    return query;
  }

  /**
   * Control visibility of hidden attributes in query results
   * @param {boolean} show - If false (default), hidden attributes will be hidden. If true, they will be shown.
   * @returns {QueryBuilder}
   */
  static withoutHidden(show = false) {
    const query = this.query();
    query._showHidden = show;
    return query;
  }

  // ==================== Instance Methods ====================

  /**
   * Fill the model with attributes
   * @param {Object} attributes
   * @returns {this}
   */
  fill(attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (this.constructor.fillable.length === 0 || this.constructor.fillable.includes(key)) {
        this.setAttribute(key, value);
      }
    }
    return this;
  }

  /**
   * Set an attribute
   * @param {string} key
   * @param {any} value
   * @returns {this}
   */
  setAttribute(key, value) {
    this.attributes[key] = this.castAttribute(key, value);
    return this;
  }

  /**
   * Get an attribute
   * @param {string} key
   * @returns {any}
   */
  getAttribute(key) {
    if (this.relations[key]) {
      return this.relations[key];
    }
    return this.castAttribute(key, this.attributes[key]);
  }

  /**
   * Cast an attribute to the proper type
   * @param {string} key
   * @param {any} value
   * @returns {any}
   */
  castAttribute(key, value) {
    const cast = this.constructor.casts[key];
    if (!cast || value === null || value === undefined) return value;

    switch (cast) {
    case 'int':
    case 'integer':
      return parseInt(value, 10);
    case 'float':
    case 'double':
      return parseFloat(value);
    case 'string':
      return String(value);
    case 'bool':
    case 'boolean':
      return Boolean(value);
    case 'array':
    case 'json':
      return typeof value === 'string' ? JSON.parse(value) : value;
    case 'date':
      return value instanceof Date ? value : new Date(value);
    default:
      return value;
    }
  }

  /**
   * Save the model
   * @returns {Promise<this>}
   */
  async save() {
    if (this.exists) {
      return this.performUpdate();
    }
    return this.performInsert();
  }

  /**
   * Perform an insert operation
   * @returns {Promise<this>}
   */
  async performInsert() {
    if (this.constructor.timestamps) {
      const now = new Date();
      this.setAttribute('created_at', now);
      this.setAttribute('updated_at', now);
    }

    const data = this.attributes;
    const result = await this.constructor.connection.insert(this.constructor.table, data);

    this.setAttribute(this.constructor.primaryKey, result.insertId);
    this.exists = true;
    this.original = { ...this.attributes };

    await this.touchParents();

    return this;
  }

  /**
   * Perform an update operation
   * @returns {Promise<this>}
   */
  async performUpdate() {
    if (this.constructor.timestamps) {
      this.setAttribute('updated_at', new Date());
    }

    const dirty = this.getDirty();
    if (Object.keys(dirty).length === 0) {
      return this;
    }

    await this.constructor.connection.update(
      this.constructor.table,
      dirty,
      { [this.constructor.primaryKey]: this.getAttribute(this.constructor.primaryKey) }
    );

    this.original = { ...this.attributes };

    await this.touchParents();

    return this;
  }

  /**
   * Touch parent models for belongsTo relations with touches enabled
   * @returns {Promise<void>}
   */
  async touchParents() {
    for (const relation of this.touches) {
      if (relation.touchesParent) {
        const foreignKeyValue = this.getAttribute(relation.foreignKey);
        if (foreignKeyValue) {
          await this.constructor.connection.update(
            relation.related.table,
            { updated_at: new Date() },
            { [relation.ownerKey]: foreignKeyValue }
          );
        }
      }
    }
  }

  /**
   * Delete the model
   * @returns {Promise<boolean>}
   */
  async destroy() {
    if (!this.exists) {
      return false;
    }

    await this.constructor.connection.delete(
      this.constructor.table,
      { [this.constructor.primaryKey]: this.getAttribute(this.constructor.primaryKey) }
    );

    this.exists = false;
    return true;
  }

  /**
   * Get the attributes that have been changed
   * @returns {Object}
   */
  getDirty() {
    const dirty = {};
    for (const [key, value] of Object.entries(this.attributes)) {
      if (JSON.stringify(value) !== JSON.stringify(this.original[key])) {
        dirty[key] = value;
      }
    }
    return dirty;
  }

  /**
   * Check if the model has been modified
   * @returns {boolean}
   */
  isDirty() {
    return Object.keys(this.getDirty()).length > 0;
  }

  /**
   * Convert the model to JSON
   * @returns {Object}
   */
  toJSON() {
    const json = { ...this.attributes };

    // Hide specified attributes unless _showHidden is true
    if (!this._showHidden) {
      this.constructor.hidden.forEach(key => {
        delete json[key];
      });
    }

    // Add relations
    Object.assign(json, this.relations);

    return json;
  }

  /**
   * Load one or multiple relations on this model instance.
   * Supports dot-notation for nested relations (e.g., 'posts.comments').
   * @param {...string|Array<string>} relations
   * @returns {Promise<this>}
   */
  async load(...relations) {
    const list = relations.length === 1 && Array.isArray(relations[0])
      ? relations[0]
      : relations;

    for (const rel of list) {
      if (typeof rel !== 'string' || !rel) continue;
      await this._loadRelationPath(rel);
    }
    return this;
  }

  /**
   * Internal: load a relation path with optional nesting (a.b.c)
   * @param {string} path
   * @private
   */
  async _loadRelationPath(path) {
    const segments = path.split('.');
    const head = segments[0];
    const tail = segments.slice(1).join('.');

    const relationFn = this[head];
    if (typeof relationFn !== 'function') return;

    const relation = relationFn.call(this);
    if (!relation || typeof relation.get !== 'function') return;

    const value = await relation.get();
    this.relations[head] = value;

    if (tail) {
      if (Array.isArray(value)) {
        await Promise.all(
          value.map(v => (v && typeof v.load === 'function') ? v.load(tail) : null)
        );
      } else if (value && typeof value.load === 'function') {
        await value.load(tail);
      }
    }
  }

  // ==================== Relationships ====================

  /**
   * Define a one-to-one relationship
   * @param {typeof Model} related
   * @param {string} foreignKey
   * @param {string} localKey
   * @returns {HasOneRelation}
   */
  hasOne(related, foreignKey, localKey) {
    const HasOneRelation = require('./Relations/HasOneRelation');
    localKey = localKey || this.constructor.primaryKey;
    foreignKey = foreignKey || `${this.constructor.table.slice(0, -1)}_id`;

    return new HasOneRelation(this, related, foreignKey, localKey);
  }

  /**
   * Define a one-to-many relationship
   * @param {typeof Model} related
   * @param {string} foreignKey
   * @param {string} localKey
   * @returns {HasManyRelation}
   */
  hasMany(related, foreignKey, localKey) {
    const HasManyRelation = require('./Relations/HasManyRelation');
    localKey = localKey || this.constructor.primaryKey;
    foreignKey = foreignKey || `${this.constructor.table.slice(0, -1)}_id`;

    return new HasManyRelation(this, related, foreignKey, localKey);
  }

  /**
   * Define an inverse one-to-one or many relationship
   * @param {typeof Model} related
   * @param {string} foreignKey
   * @param {string} ownerKey
   * @returns {BelongsToRelation}
   */
  belongsTo(related, foreignKey, ownerKey) {
    const BelongsToRelation = require('./Relations/BelongsToRelation');
    ownerKey = ownerKey || related.primaryKey;
    foreignKey = foreignKey || `${related.table.slice(0, -1)}_id`;

    return new BelongsToRelation(this, related, foreignKey, ownerKey);
  }

  /**
   * Define a many-to-many relationship
   * @param {typeof Model} related
   * @param {string} pivot
   * @param {string} foreignPivotKey
   * @param {string} relatedPivotKey
   * @param {string} parentKey
   * @param {string} relatedKey
   * @returns {BelongsToManyRelation}
   */
  belongsToMany(related, pivot, foreignPivotKey, relatedPivotKey, parentKey, relatedKey) {
    const BelongsToManyRelation = require('./Relations/BelongsToManyRelation');
    return new BelongsToManyRelation(
      this, related, pivot, foreignPivotKey, relatedPivotKey, parentKey, relatedKey
    );
  }

  /**
   * Define a has-many-through relationship
   * @param {typeof Model} relatedFinal
   * @param {typeof Model} through
   * @param {string} [foreignKeyOnThrough]
   * @param {string} [throughKeyOnFinal]
   * @param {string} [localKey]
   * @param {string} [throughLocalKey]
   * @returns {HasManyThroughRelation}
   */
  hasManyThrough(relatedFinal, through, foreignKeyOnThrough, throughKeyOnFinal, localKey, throughLocalKey) {
    const HasManyThroughRelation = require('./Relations/HasManyThroughRelation');
    return new HasManyThroughRelation(
      this, relatedFinal, through, foreignKeyOnThrough, throughKeyOnFinal, localKey, throughLocalKey
    );
  }

  /**
   * Define a has-one-through relationship
   * @param {typeof Model} relatedFinal
   * @param {typeof Model} through
   * @param {string} [foreignKeyOnThrough]
   * @param {string} [throughKeyOnFinal]
   * @param {string} [localKey]
   * @param {string} [throughLocalKey]
   * @returns {HasOneThroughRelation}
   */
  hasOneThrough(relatedFinal, through, foreignKeyOnThrough, throughKeyOnFinal, localKey, throughLocalKey) {
    const HasOneThroughRelation = require('./Relations/HasOneThroughRelation');
    return new HasOneThroughRelation(
      this, relatedFinal, through, foreignKeyOnThrough, throughKeyOnFinal, localKey, throughLocalKey
    );
  }

  /**
   * Define a polymorphic inverse relationship
   * @param {string} name
   * @param {string} [typeColumn]
   * @param {string} [idColumn]
   * @returns {MorphToRelation}
   */
  morphTo(name, typeColumn, idColumn) {
    const MorphToRelation = require('./Relations/MorphToRelation');
    return new MorphToRelation(this, name, typeColumn, idColumn);
  }

  /**
   * Define a polymorphic one-to-one relationship
   * @param {typeof Model} related
   * @param {string} morphType
   * @param {string} [foreignKey]
   * @param {string} [localKey]
   * @returns {MorphOneRelation}
   */
  morphOne(related, morphType, foreignKey, localKey) {
    const MorphOneRelation = require('./Relations/MorphOneRelation');
    localKey = localKey || this.constructor.primaryKey;
    foreignKey = foreignKey || `${morphType}_id`;

    return new MorphOneRelation(this, related, morphType, foreignKey, localKey);
  }

  /**
   * Define a polymorphic one-to-many relationship
   * @param {typeof Model} related
   * @param {string} morphType
   * @param {string} [foreignKey]
   * @param {string} [localKey]
   * @returns {MorphManyRelation}
   */
  morphMany(related, morphType, foreignKey, localKey) {
    const MorphManyRelation = require('./Relations/MorphManyRelation');
    localKey = localKey || this.constructor.primaryKey;
    foreignKey = foreignKey || `${morphType}_id`;

    return new MorphManyRelation(this, related, morphType, foreignKey, localKey);
  }
}

module.exports = Model;

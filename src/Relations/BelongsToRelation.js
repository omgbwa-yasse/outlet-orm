const Relation = require('./Relation');

/**
 * Belongs To Relation
 * Represents an inverse one-to-one or many relationship
 */
class BelongsToRelation extends Relation {
  constructor(child, related, foreignKey, ownerKey) {
    super(child, related, foreignKey, ownerKey);
    this.child = child;
    this.ownerKey = ownerKey;
    this.defaultValue = null;
    this.touchesParent = false;
  }

  /**
   * Get the related model
   * @returns {Promise<Model|null>}
   */
  async get() {
    const foreignKeyValue = this.child.getAttribute(this.foreignKey);

    if (!foreignKeyValue) {
      return this.getDefault();
    }

    const result = await this.related
      .where(this.ownerKey, foreignKeyValue)
      .first();

    return result || this.getDefault();
  }

  /**
   * Get the default value
   * @returns {Model|null}
   */
  getDefault() {
    if (this.defaultValue === null) return null;
    if (typeof this.defaultValue === 'function') return this.defaultValue();
    return this.defaultValue;
  }

  /**
   * Eager load the relationship for a collection of child models
   * @param {Array<Model>} models
   * @param {string} relationName
   * @returns {Promise<void>}
   */
  async eagerLoad(models, relationName, constraint) {
    const keys = models
      .map(model => model.getAttribute(this.foreignKey))
      .filter(key => key !== null && key !== undefined);

    if (keys.length === 0) return;

    const qb = this.related.whereIn(this.ownerKey, keys);
    if (typeof constraint === 'function') constraint(qb);
    const relatedModels = await qb.get();

    const relatedMap = {};
    relatedModels.forEach(model => {
      const ownerKeyValue = model.getAttribute(this.ownerKey);
      relatedMap[ownerKeyValue] = model;
    });

    models.forEach(model => {
      const foreignKeyValue = model.getAttribute(this.foreignKey);
      model.relations[relationName] = relatedMap[foreignKeyValue] || this.getDefault();
    });
  }

  /**
   * Add a where clause to the relation query
   * @param {string} column
   * @param {string|any} operator
   * @param {any} value
   * @returns {QueryBuilder}
   */
  where(column, operator, value) {
    return this.related
      .where(this.ownerKey, this.child.getAttribute(this.foreignKey))
      .where(column, operator, value);
  }

  /**
   * Set a default value for the relation
   * @param {Model|function} value
   * @returns {BelongsToRelation}
   */
  withDefault(value) {
    this.defaultValue = value;
    return this;
  }

  /**
   * Associate the model with this relation
   * @param {Model|number} modelOrId
   * @returns {BelongsToRelation}
   */
  associate(modelOrId) {
    const id = modelOrId instanceof this.related ? modelOrId.getAttribute(this.ownerKey) : modelOrId;
    this.child.setAttribute(this.foreignKey, id);
    return this;
  }

  /**
   * Dissociate the model from this relation
   * @returns {BelongsToRelation}
   */
  dissociate() {
    this.child.setAttribute(this.foreignKey, null);
    return this;
  }

  /**
   * Enable touching the parent model's timestamp when this model is saved
   * @returns {BelongsToRelation}
   */
  touches() {
    this.touchesParent = true;
    this.child.touches.push(this);
    return this;
  }
}

module.exports = BelongsToRelation;

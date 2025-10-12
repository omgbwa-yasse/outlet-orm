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
  }

  /**
   * Get the related model
   * @returns {Promise<Model|null>}
   */
  async get() {
    const foreignKeyValue = this.child.getAttribute(this.foreignKey);

    if (!foreignKeyValue) {
      return null;
    }

    return this.related
      .where(this.ownerKey, foreignKeyValue)
      .first();
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
      model.relations[relationName] = relatedMap[foreignKeyValue] || null;
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
}

module.exports = BelongsToRelation;

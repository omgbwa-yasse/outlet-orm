const Relation = require('./Relation');

/**
 * Has One Relation
 * Represents a one-to-one relationship
 */
class HasOneRelation extends Relation {
  /**
   * Get the related model
   * @returns {Promise<Model|null>}
   */
  async get() {
    const result = await this.related
      .where(this.foreignKey, this.parent.getAttribute(this.localKey))
      .first();
    
    return result;
  }

  /**
   * Eager load the relationship for a collection of parent models
   * @param {Array<Model>} models
   * @param {string} relationName
   * @returns {Promise<void>}
   */
  async eagerLoad(models, relationName) {
    const keys = models
      .map(model => model.getAttribute(this.localKey))
      .filter(key => key !== null && key !== undefined);

    if (keys.length === 0) return;

    const relatedModels = await this.related
      .whereIn(this.foreignKey, keys)
      .get();

    const relatedMap = {};
    relatedModels.forEach(model => {
      const foreignKeyValue = model.getAttribute(this.foreignKey);
      relatedMap[foreignKeyValue] = model;
    });

    models.forEach(model => {
      const localKeyValue = model.getAttribute(this.localKey);
      model.relations[relationName] = relatedMap[localKeyValue] || null;
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
      .where(this.foreignKey, this.parent.getAttribute(this.localKey))
      .where(column, operator, value);
  }
}

module.exports = HasOneRelation;

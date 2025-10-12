const Relation = require('./Relation');

/**
 * Has Many Relation
 * Represents a one-to-many relationship
 */
class HasManyRelation extends Relation {
  /**
   * Get the related models
   * @returns {Promise<Array<Model>>}
   */
  async get() {
    return this.related
      .where(this.foreignKey, this.parent.getAttribute(this.localKey))
      .get();
  }

  /**
   * Eager load the relationship for a collection of parent models
   * @param {Array<Model>} models
   * @param {string} relationName
   * @returns {Promise<void>}
   */
  async eagerLoad(models, relationName, constraint) {
    const keys = models
      .map(model => model.getAttribute(this.localKey))
      .filter(key => key !== null && key !== undefined);

    if (keys.length === 0) return;

    const qb = this.related.whereIn(this.foreignKey, keys);
    if (typeof constraint === 'function') constraint(qb);
    const relatedModels = await qb.get();

    const relatedMap = {};
    relatedModels.forEach(model => {
      const foreignKeyValue = model.getAttribute(this.foreignKey);
      if (!relatedMap[foreignKeyValue]) {
        relatedMap[foreignKeyValue] = [];
      }
      relatedMap[foreignKeyValue].push(model);
    });

    models.forEach(model => {
      const localKeyValue = model.getAttribute(this.localKey);
      model.relations[relationName] = relatedMap[localKeyValue] || [];
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

  /**
   * Count the related models
   * @returns {Promise<number>}
   */
  async count() {
    return this.related
      .where(this.foreignKey, this.parent.getAttribute(this.localKey))
      .count();
  }
}

module.exports = HasManyRelation;

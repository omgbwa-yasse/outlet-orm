const Relation = require('./Relation');

/**
 * Morph One Relation
 * Represents a polymorphic one-to-one relationship
 */
class MorphOneRelation extends Relation {
  constructor(parent, related, morphType, foreignKey, localKey) {
    super(parent, related, foreignKey, localKey);
    this.parent = parent;
    this.morphType = morphType;
  }

  /**
   * Get the related model
   * @returns {Promise<Model|null>}
   */
  async get() {
    return this.related
      .where(this.foreignKey, this.parent.getAttribute(this.localKey))
      .where(`${this.morphType}_type`, this.parent.constructor.table)
      .first();
  }

  /**
   * Eager load the relationship for a collection of parent models
   * @param {Array<Model>} models
   * @param {string} relationName
   * @returns {Promise<void>}
   */
  async eagerLoad(models, relationName, constraint) {
    const keys = models.map(model => model.getAttribute(this.localKey));

    const qb = this.related
      .whereIn(this.foreignKey, keys)
      .where(`${this.morphType}_type`, models[0].constructor.table);

    if (typeof constraint === 'function') constraint(qb);
    const relatedModels = await qb.get();

    const relatedMap = {};
    for (const model of relatedModels) {
      const fk = model.getAttribute(this.foreignKey);
      relatedMap[fk] = model;
    }

    for (const model of models) {
      const key = model.getAttribute(this.localKey);
      model.relations[relationName] = relatedMap[key] || null;
    }
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
      .where(`${this.morphType}_type`, this.parent.constructor.table)
      .where(column, operator, value);
  }
}

module.exports = MorphOneRelation;

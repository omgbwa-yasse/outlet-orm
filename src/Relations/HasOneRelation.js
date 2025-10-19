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

  /**
   * Create a new related model and associate it
   * @param {Object} attributes
   * @returns {Promise<Model>}
   */
  async create(attributes = {}) {
    const model = new this.related.model(attributes);
    model.setAttribute(this.foreignKey, this.parent.getAttribute(this.localKey));
    await model.save();
    return model;
  }

  /**
   * Save an existing model and associate it
   * @param {Model} model
   * @returns {Promise<Model>}
   */
  async save(model) {
    model.setAttribute(this.foreignKey, this.parent.getAttribute(this.localKey));
    await model.save();
    return model;
  }

  /**
   * Create multiple related models and associate them
   * @param {Array<Object>} attributesArray
   * @returns {Promise<Array<Model>>}
   */
  async createMany(attributesArray) {
    const models = [];
    for (const attributes of attributesArray) {
      const model = await this.create(attributes);
      models.push(model);
    }
    return models;
  }

  /**
   * Save multiple existing models and associate them
   * @param {Array<Model>} models
   * @returns {Promise<Array<Model>>}
   */
  async saveMany(models) {
    const savedModels = [];
    for (const model of models) {
      const saved = await this.save(model);
      savedModels.push(saved);
    }
    return savedModels;
  }
}

module.exports = HasOneRelation;

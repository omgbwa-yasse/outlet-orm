const Relation = require('./Relation');

/**
 * Morph To Relation
 * Represents a polymorphic inverse relationship
 */
class MorphToRelation extends Relation {
  constructor(child, name, typeColumn = null, idColumn = null) {
    super(child, null, null, null); // related is dynamic
    this.child = child;
    this.name = name;
    this.typeColumn = typeColumn || `${name}_type`;
    this.idColumn = idColumn || `${name}_id`;
  }

  /**
   * Get the related model
   * @returns {Promise<Model|null>}
   */
  async get() {
    const morphType = this.child.getAttribute(this.typeColumn);
    const morphId = this.child.getAttribute(this.idColumn);

    if (!morphType || !morphId) {
      return null;
    }

    // Resolve the model class from type
    const relatedClass = this.resolveMorphClass(morphType);
    if (!relatedClass) {
      return null;
    }

    return relatedClass.where(relatedClass.primaryKey, morphId).first();
  }

  /**
   * Resolve the model class from morph type
   * @param {string} morphType
   * @returns {typeof Model|null}
   */
  resolveMorphClass(morphType) {
    // Check morph map first
    const morphMap = this.child.constructor.morphMap || {};
    if (morphMap[morphType]) {
      return morphMap[morphType];
    }

    // Fallback: assume morphType is the table name or class name
    // For simplicity, return null if not mapped
    return null;
  }

  /**
   * Eager load the relationship for a collection of child models
   * @param {Array<Model>} models
   * @param {string} relationName
   * @returns {Promise<void>}
   */
  async eagerLoad(models, relationName, constraint) {
    // Group models by morph type
    const grouped = {};
    for (const model of models) {
      const type = model.getAttribute(this.typeColumn);
      const id = model.getAttribute(this.idColumn);
      if (type && id) {
        if (!grouped[type]) grouped[type] = { ids: [], models: [] };
        grouped[type].ids.push(id);
        grouped[type].models.push(model);
      }
    }

    // Load each type separately
    for (const [type, { ids, models: typeModels }] of Object.entries(grouped)) {
      const relatedClass = this.resolveMorphClass(type);
      if (!relatedClass) continue;

      const qb = relatedClass.whereIn(relatedClass.primaryKey, ids);
      if (typeof constraint === 'function') constraint(qb);
      const relatedModels = await qb.get();

      const relatedMap = {};
      for (const model of relatedModels) {
        const pk = model.getAttribute(relatedClass.primaryKey);
        relatedMap[pk] = model;
      }

      for (const model of typeModels) {
        const id = model.getAttribute(this.idColumn);
        model.relations[relationName] = relatedMap[id] || null;
      }
    }
  }

  /**
   * Add a where clause to the relation query
   * Note: Since related is dynamic, this is limited
   * @param {string} _column
   * @param {string|any} _operator
   * @param {any} _value
   * @returns {QueryBuilder}
   */
  where(_column, _operator, _value) {
    // This is tricky since related is dynamic
    // For now, throw error or handle basic case
    throw new Error('where() on morphTo relation is not fully supported yet');
  }
}

module.exports = MorphToRelation;

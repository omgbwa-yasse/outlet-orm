/**
 * Base Relation class
 */
class Relation {
  constructor(parent, related, foreignKey, localKey) {
    this.parent = parent;
    this.related = related;
    this.foreignKey = foreignKey;
    this.localKey = localKey;
  }

  /**
   * Get the results of the relationship
   * @returns {Promise<Model|Array<Model>|null>}
   */
  async get() {
    throw new Error('Method get() must be implemented by subclass');
  }

  /**
   * Eager load the relationship for a collection of parent models
   * @param {Array<Model>} models
   * @param {string} relationName
   * @returns {Promise<void>}
   */
  async eagerLoad(models, relationName) {
    throw new Error('Method eagerLoad() must be implemented by subclass');
  }
}

module.exports = Relation;

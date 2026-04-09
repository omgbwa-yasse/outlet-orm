/**
 * Base Relation class
 */
class Relation {
  constructor(parent, related, foreignKey, localKey) {
    this.parent = parent;
    this.related = related;
    this.foreignKey = foreignKey;
    this.localKey = localKey;
    this._defaultValue = undefined;
  }

  /**
   * Set a default value/model to return when the relation is empty
   * @param {Object|Function|boolean} [value=true] - Default attributes, factory fn, or true for empty model
   * @returns {this}
   */
  withDefault(value = true) {
    this._defaultValue = value;
    return this;
  }

  /**
   * Build the default model when the relation result is null
   * @returns {Model|null}
   * @protected
   */
  _buildDefault() {
    if (this._defaultValue === undefined) return null;
    if (typeof this._defaultValue === 'function') return this._defaultValue();
    if (this._defaultValue === true) {
      // Return an empty instance of the related model
      const RelatedModel = typeof this.related === 'function' && this.related.prototype
        ? this.related
        : this.related.constructor;
      return new RelatedModel();
    }
    if (typeof this._defaultValue === 'object' && this._defaultValue !== null) {
      const RelatedModel = typeof this.related === 'function' && this.related.prototype
        ? this.related
        : this.related.constructor;
      return new RelatedModel(this._defaultValue);
    }
    return null;
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
  async eagerLoad(_models, _relationName) {
    throw new Error('Method eagerLoad() must be implemented by subclass');
  }
}

module.exports = Relation;

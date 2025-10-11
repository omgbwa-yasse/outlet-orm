const Relation = require('./Relation');

/**
 * Belongs To Many Relation
 * Represents a many-to-many relationship through a pivot table
 */
class BelongsToManyRelation extends Relation {
  constructor(parent, related, pivot, foreignPivotKey, relatedPivotKey, parentKey, relatedKey) {
    super(parent, related, null, null);
    this.pivot = pivot;
    this.foreignPivotKey = foreignPivotKey || `${parent.constructor.table.slice(0, -1)}_id`;
    this.relatedPivotKey = relatedPivotKey || `${related.table.slice(0, -1)}_id`;
    this.parentKey = parentKey || parent.constructor.primaryKey;
    this.relatedKey = relatedKey || related.primaryKey;
  }

  /**
   * Get the related models
   * @returns {Promise<Array<Model>>}
   */
  async get() {
    const parentKeyValue = this.parent.getAttribute(this.parentKey);

    // First, get the related IDs from the pivot table
    const pivotRecords = await this.parent.constructor.connection.select(
      this.pivot,
      {
        columns: [this.relatedPivotKey],
        wheres: [{
          column: this.foreignPivotKey,
          operator: '=',
          value: parentKeyValue,
          type: 'basic',
          boolean: 'and'
        }],
        orders: [],
        limit: null,
        offset: null
      }
    );

    if (pivotRecords.length === 0) {
      return [];
    }

    const relatedIds = pivotRecords.map(record => record[this.relatedPivotKey]);

    // Then get the related models
    const relatedModels = await this.related
      .whereIn(this.relatedKey, relatedIds)
      .get();

    return relatedModels;
  }

  /**
   * Eager load the relationship for a collection of parent models
   * @param {Array<Model>} models
   * @param {string} relationName
   * @returns {Promise<void>}
   */
  async eagerLoad(models, relationName) {
    const parentKeys = models
      .map(model => model.getAttribute(this.parentKey))
      .filter(key => key !== null && key !== undefined);

    if (parentKeys.length === 0) return;

    // Get all pivot records
    const pivotRecords = await this.parent.constructor.connection.select(
      this.pivot,
      {
        columns: [this.foreignPivotKey, this.relatedPivotKey],
        wheres: [{
          column: this.foreignPivotKey,
          values: parentKeys,
          type: 'in',
          boolean: 'and'
        }],
        orders: [],
        limit: null,
        offset: null
      }
    );

    if (pivotRecords.length === 0) {
      models.forEach(model => {
        model.relations[relationName] = [];
      });
      return;
    }

    // Get all related IDs
    const relatedIds = [...new Set(pivotRecords.map(record => record[this.relatedPivotKey]))];

    // Get all related models
    const relatedModels = await this.related
      .whereIn(this.relatedKey, relatedIds)
      .get();

    // Create a map of related models by their key
    const relatedMap = {};
    relatedModels.forEach(model => {
      const keyValue = model.getAttribute(this.relatedKey);
      relatedMap[keyValue] = model;
    });

    // Create a map of parent key to related models
    const parentToRelatedMap = {};
    pivotRecords.forEach(pivotRecord => {
      const parentKeyValue = pivotRecord[this.foreignPivotKey];
      const relatedKeyValue = pivotRecord[this.relatedPivotKey];

      if (!parentToRelatedMap[parentKeyValue]) {
        parentToRelatedMap[parentKeyValue] = [];
      }

      if (relatedMap[relatedKeyValue]) {
        parentToRelatedMap[parentKeyValue].push(relatedMap[relatedKeyValue]);
      }
    });

    // Assign relations to parent models
    models.forEach(model => {
      const parentKeyValue = model.getAttribute(this.parentKey);
      model.relations[relationName] = parentToRelatedMap[parentKeyValue] || [];
    });
  }

  /**
   * Attach a related model to the parent
   * @param {number|Array<number>} ids
   * @returns {Promise<void>}
   */
  async attach(ids) {
    const parentKeyValue = this.parent.getAttribute(this.parentKey);
    const idsArray = Array.isArray(ids) ? ids : [ids];

    const pivotData = idsArray.map(id => ({
      [this.foreignPivotKey]: parentKeyValue,
      [this.relatedPivotKey]: id
    }));

    await this.parent.constructor.connection.insertMany(this.pivot, pivotData);
  }

  /**
   * Detach a related model from the parent
   * @param {number|Array<number>|null} ids
   * @returns {Promise<void>}
   */
  async detach(ids = null) {
    const parentKeyValue = this.parent.getAttribute(this.parentKey);

    const wheres = [{
      column: this.foreignPivotKey,
      operator: '=',
      value: parentKeyValue,
      type: 'basic',
      boolean: 'and'
    }];

    if (ids !== null) {
      const idsArray = Array.isArray(ids) ? ids : [ids];
      wheres.push({
        column: this.relatedPivotKey,
        values: idsArray,
        type: 'in',
        boolean: 'and'
      });
    }

    await this.parent.constructor.connection.delete(this.pivot, { wheres });
  }

  /**
   * Sync the pivot table with the given IDs
   * @param {Array<number>} ids
   * @returns {Promise<void>}
   */
  async sync(ids) {
    await this.detach();
    await this.attach(ids);
  }
}

module.exports = BelongsToManyRelation;

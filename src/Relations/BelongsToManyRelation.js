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
    this.pivotColumns = [];
    this.withTimestamps = false;
    this.pivotAlias = 'pivot';
    this.wherePivotConditions = [];
  }

  /**
   * Get the related models
   * @returns {Promise<Array<Model>>}
   */
  async get() {
    const parentKeyValue = this.parent.getAttribute(this.parentKey);

    // Columns to select from pivot
    const pivotSelectColumns = [this.relatedPivotKey, ...this.pivotColumns];
    if (this.withTimestamps) {
      pivotSelectColumns.push('created_at', 'updated_at');
    }

    // First, get the related IDs and pivot data
    const pivotRecords = await this.parent.constructor.connection.select(
      this.pivot,
      {
        columns: pivotSelectColumns,
        wheres: [
          {
            column: this.foreignPivotKey,
            operator: '=',
            value: parentKeyValue,
            type: 'basic',
            boolean: 'and'
          },
          ...this.wherePivotConditions.map(cond => {
            if (cond.type === 'in') {
              return {
                column: cond.column,
                values: cond.values,
                type: 'in',
                boolean: 'and'
              };
            } else {
              return {
                column: cond.column,
                operator: cond.operator || '=',
                value: cond.value,
                type: 'basic',
                boolean: 'and'
              };
            }
          })
        ],
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

    // Attach pivot data
    const pivotMap = {};
    pivotRecords.forEach(record => {
      const key = record[this.relatedPivotKey];
      const pivotData = {};
      this.pivotColumns.forEach(col => {
        pivotData[col] = record[col];
      });
      if (this.withTimestamps) {
        pivotData.created_at = record.created_at;
        pivotData.updated_at = record.updated_at;
      }
      pivotMap[key] = pivotData;
    });

    relatedModels.forEach(model => {
      const key = model.getAttribute(this.relatedKey);
      model[this.pivotAlias] = pivotMap[key] || {};
    });

    return relatedModels;
  }  /**
   * Eager load the relationship for a collection of parent models
   * @param {Array<Model>} models
   * @param {string} relationName
   * @returns {Promise<void>}
   */
  async eagerLoad(models, relationName, constraint) {
    const parentKeys = models
      .map(model => model.getAttribute(this.parentKey))
      .filter(key => key !== null && key !== undefined);

    if (parentKeys.length === 0) return;

    // Columns to select from pivot
    const pivotSelectColumns = [this.foreignPivotKey, this.relatedPivotKey, ...this.pivotColumns];
    if (this.withTimestamps) {
      pivotSelectColumns.push('created_at', 'updated_at');
    }

    // Get all pivot records
    const pivotRecords = await this.parent.constructor.connection.select(
      this.pivot,
      {
        columns: pivotSelectColumns,
        wheres: [
          {
            column: this.foreignPivotKey,
            values: parentKeys,
            type: 'in',
            boolean: 'and'
          },
          ...this.wherePivotConditions.map(cond => {
            if (cond.type === 'in') {
              return {
                column: cond.column,
                values: cond.values,
                type: 'in',
                boolean: 'and'
              };
            } else {
              return {
                column: cond.column,
                operator: cond.operator || '=',
                value: cond.value,
                type: 'basic',
                boolean: 'and'
              };
            }
          })
        ],
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
    const qb = this.related.whereIn(this.relatedKey, relatedIds);
    if (typeof constraint === 'function') constraint(qb);
    const relatedModels = await qb.get();

    // Create a map of related models by their key
    const relatedMap = {};
    relatedModels.forEach(model => {
      const keyValue = model.getAttribute(this.relatedKey);
      relatedMap[keyValue] = model;
    });

    // Create a map of parent key to related models with pivot
    const parentToRelatedMap = {};
    pivotRecords.forEach(pivotRecord => {
      const parentKeyValue = pivotRecord[this.foreignPivotKey];
      const relatedKeyValue = pivotRecord[this.relatedPivotKey];

      if (!parentToRelatedMap[parentKeyValue]) {
        parentToRelatedMap[parentKeyValue] = [];
      }

      if (relatedMap[relatedKeyValue]) {
        const model = relatedMap[relatedKeyValue];
        // Attach pivot data
        const pivotData = {};
        this.pivotColumns.forEach(col => {
          pivotData[col] = pivotRecord[col];
        });
        if (this.withTimestamps) {
          pivotData.created_at = pivotRecord.created_at;
          pivotData.updated_at = pivotRecord.updated_at;
        }
        model[this.pivotAlias] = pivotData;
        parentToRelatedMap[parentKeyValue].push(model);
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

    const pivotData = idsArray.map(id => {
      const data = {
        [this.foreignPivotKey]: parentKeyValue,
        [this.relatedPivotKey]: id
      };
      if (this.withTimestamps) {
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
        data.created_at = now;
        data.updated_at = now;
      }
      return data;
    });

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

  /**
   * Specify additional columns to select from the pivot table
   * @param {...string} columns
   * @returns {BelongsToManyRelation}
   */
  withPivot(...columns) {
    this.pivotColumns = columns;
    return this;
  }

  /**
   * Include timestamps in the pivot table
   * @returns {BelongsToManyRelation}
   */
  withTimestamps() {
    this.withTimestamps = true;
    return this;
  }

  /**
   * Alias for the pivot attribute
   * @param {string} alias
   * @returns {BelongsToManyRelation}
   */
  as(alias) {
    this.pivotAlias = alias;
    return this;
  }

  /**
   * Add a where condition on the pivot table
   * @param {string} column
   * @param {string} operator
   * @param {*} value
   * @returns {BelongsToManyRelation}
   */
  wherePivot(column, operator, value) {
    this.wherePivotConditions.push({ column, operator, value });
    return this;
  }

  /**
   * Add a whereIn condition on the pivot table
   * @param {string} column
   * @param {Array} values
   * @returns {BelongsToManyRelation}
   */
  wherePivotIn(column, values) {
    this.wherePivotConditions.push({ column, values, type: 'in' });
    return this;
  }

  /**
   * Toggle attachment of related models
   * @param {number|Array<number>} ids
   * @returns {Promise<void>}
   */
  async toggle(ids) {
    const parentKeyValue = this.parent.getAttribute(this.parentKey);
    const idsArray = Array.isArray(ids) ? ids : [ids];

    // Get currently attached
    const attached = await this.parent.constructor.connection.select(
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

    const attachedIds = attached.map(r => r[this.relatedPivotKey]);

    const toAttach = idsArray.filter(id => !attachedIds.includes(id));
    const toDetach = attachedIds.filter(id => idsArray.includes(id));

    if (toDetach.length > 0) await this.detach(toDetach);
    if (toAttach.length > 0) await this.attach(toAttach);
  }

  /**
   * Sync without detaching existing
   * @param {Array<number>} ids
   * @returns {Promise<void>}
   */
  async syncWithoutDetaching(ids) {
    const parentKeyValue = this.parent.getAttribute(this.parentKey);

    // Get currently attached
    const attached = await this.parent.constructor.connection.select(
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

    const attachedIds = attached.map(r => r[this.relatedPivotKey]);
    const toAttach = ids.filter(id => !attachedIds.includes(id));

    if (toAttach.length > 0) await this.attach(toAttach);
  }

  /**
   * Update existing pivot record
   * @param {number} id
   * @param {Object} attributes
   * @returns {Promise<void>}
   */
  async updateExistingPivot(id, attributes) {
    const parentKeyValue = this.parent.getAttribute(this.parentKey);

    const wheres = [
      {
        column: this.foreignPivotKey,
        operator: '=',
        value: parentKeyValue,
        type: 'basic',
        boolean: 'and'
      },
      {
        column: this.relatedPivotKey,
        operator: '=',
        value: id,
        type: 'basic',
        boolean: 'and'
      }
    ];

    await this.parent.constructor.connection.update(this.pivot, attributes, { wheres });
  }

  /**
   * Create a new related model and attach it
   * @param {Object} attributes
   * @param {Object} pivotAttributes
   * @returns {Promise<Model>}
   */
  async create(attributes = {}, pivotAttributes = {}) {
    const model = new this.related.model(attributes);
    await model.save();
    const id = model.getAttribute(this.relatedKey);
    await this.attach(id);
    // If pivot attributes, update the pivot
    if (Object.keys(pivotAttributes).length > 0) {
      await this.updateExistingPivot(id, pivotAttributes);
    }
    return model;
  }

  /**
   * Create multiple related models and attach them
   * @param {Array<Object>} attributesArray
   * @param {Array<Object>} pivotAttributesArray
   * @returns {Promise<Array<Model>>}
   */
  async createMany(attributesArray, pivotAttributesArray = []) {
    const models = [];
    const ids = [];
    for (let i = 0; i < attributesArray.length; i++) {
      const attributes = attributesArray[i];
      const pivotAttributes = pivotAttributesArray[i] || {};
      const model = await this.create(attributes, pivotAttributes);
      models.push(model);
      ids.push(model.getAttribute(this.relatedKey));
    }
    return models;
  }
}

module.exports = BelongsToManyRelation;

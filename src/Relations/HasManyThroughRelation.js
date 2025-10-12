const Relation = require('./Relation');

/**
 * Has Many Through Relation
 * parent -> through -> related (final)
 */
class HasManyThroughRelation extends Relation {
  /**
   * @param {import('../Model')} parent
   * @param {typeof import('../Model')} relatedFinal
   * @param {typeof import('../Model')} through
   * @param {string} [foreignKeyOnThrough] - FK on through referencing parent
   * @param {string} [throughKeyOnFinal] - FK on final referencing through
   * @param {string} [localKey] - PK on parent
   * @param {string} [throughLocalKey] - PK on through
   */
  constructor(parent, relatedFinal, through, foreignKeyOnThrough, throughKeyOnFinal, localKey, throughLocalKey) {
    super(parent, relatedFinal, foreignKeyOnThrough, localKey);
    this.through = through;
    // Defaults based on naming conventions
    this.localKey = localKey || parent.constructor.primaryKey || 'id';
    this.throughLocalKey = throughLocalKey || through.primaryKey || 'id';
    this.foreignKeyOnThrough = foreignKeyOnThrough || `${parent.constructor.table.slice(0, -1)}_id`;
    this.throughKeyOnFinal = throughKeyOnFinal || `${through.table.slice(0, -1)}_id`;
  }

  /**
   * Get final related models
   * @returns {Promise<Array>}
   */
  async get() {
    const parentKeyValue = this.parent.getAttribute(this.localKey);
    if (parentKeyValue === undefined || parentKeyValue === null) return [];

    const throughRows = await this.through
      .where(this.foreignKeyOnThrough, parentKeyValue)
      .columns([this.throughLocalKey])
      .get();

    const throughIds = throughRows.map(r => r.getAttribute(this.throughLocalKey));
    if (throughIds.length === 0) return [];

    const results = await this.related
      .whereIn(this.throughKeyOnFinal, throughIds)
      .get();
    return results;
  }

  /**
   * Eager load hasManyThrough for a batch of parents
   * @param {Array} models
   * @param {string} relationName
   * @param {(qb: any) => void} [constraint]
   */
  async eagerLoad(models, relationName, constraint) {
    const parentKeys = models
      .map(m => m.getAttribute(this.localKey))
      .filter(v => v !== undefined && v !== null);

    if (parentKeys.length === 0) {
      models.forEach(m => { m.relations[relationName] = []; });
      return;
    }

    // Fetch through rows for all parent keys
    const throughRows = await this.through
      .whereIn(this.foreignKeyOnThrough, parentKeys)
      .get();

    if (throughRows.length === 0) {
      models.forEach(m => { m.relations[relationName] = []; });
      return;
    }

    // Map parentKey -> array of throughIds
    const parentToThroughIds = {};
    for (const row of throughRows) {
      const pKey = row.getAttribute(this.foreignKeyOnThrough);
      const tId = row.getAttribute(this.throughLocalKey);
      if (!parentToThroughIds[pKey]) parentToThroughIds[pKey] = [];
      parentToThroughIds[pKey].push(tId);
    }

    const allThroughIds = [...new Set(throughRows.map(r => r.getAttribute(this.throughLocalKey)))];

    // Fetch finals in one query (with optional constraint)
    const qb = this.related.whereIn(this.throughKeyOnFinal, allThroughIds);
    if (typeof constraint === 'function') constraint(qb);
    const finals = await qb.get();

    // Group finals by through id
    const finalsByThrough = {};
    for (const f of finals) {
      const key = f.getAttribute(this.throughKeyOnFinal);
      if (!finalsByThrough[key]) finalsByThrough[key] = [];
      finalsByThrough[key].push(f);
    }

    // Assign to each parent
    for (const m of models) {
      const pKey = m.getAttribute(this.localKey);
      const tIds = parentToThroughIds[pKey] || [];
      const collected = [];
      for (const tId of tIds) {
        if (finalsByThrough[tId]) collected.push(...finalsByThrough[tId]);
      }
      m.relations[relationName] = collected;
    }
  }
}

module.exports = HasManyThroughRelation;

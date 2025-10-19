const Relation = require('./Relation');

/**
 * Has One Through Relation
 * parent -> through -> related (final) - returns single model
 */
class HasOneThroughRelation extends Relation {
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
   * Get final related model (single)
   * @returns {Promise<import('../Model')|null>}
   */
  async get() {
    const parentKeyValue = this.parent.getAttribute(this.localKey);
    if (parentKeyValue === undefined || parentKeyValue === null) return null;

    const throughRow = await this.through
      .where(this.foreignKeyOnThrough, parentKeyValue)
      .first();

    if (!throughRow) return null;

    const throughId = throughRow.getAttribute(this.throughLocalKey);
    const result = await this.related
      .where(this.throughKeyOnFinal, throughId)
      .first();
    return result;
  }

  /**
   * Eager load hasOneThrough for a batch of parents
   * @param {Array} models
   * @param {string} relationName
   * @param {(qb: any) => void} [constraint]
   */
  async eagerLoad(models, relationName, constraint) {
    const parentKeys = models
      .map(m => m.getAttribute(this.localKey))
      .filter(v => v !== undefined && v !== null);

    if (parentKeys.length === 0) {
      models.forEach(m => { m.relations[relationName] = null; });
      return;
    }

    // Fetch through rows for all parent keys
    const throughRows = await this.through
      .whereIn(this.foreignKeyOnThrough, parentKeys)
      .get();

    if (throughRows.length === 0) {
      models.forEach(m => { m.relations[relationName] = null; });
      return;
    }

    // Map parentKey -> throughId (assuming one through per parent)
    const parentToThroughId = {};
    for (const row of throughRows) {
      const pKey = row.getAttribute(this.foreignKeyOnThrough);
      const tId = row.getAttribute(this.throughLocalKey);
      parentToThroughId[pKey] = tId; // overwrite if multiple, take last
    }

    const allThroughIds = Object.values(parentToThroughId);

    // Fetch finals in one query (with optional constraint)
    const qb = this.related.whereIn(this.throughKeyOnFinal, allThroughIds);
    if (typeof constraint === 'function') constraint(qb);
    const finals = await qb.get();

    // Map through id to final
    const finalsByThrough = {};
    for (const f of finals) {
      const key = f.getAttribute(this.throughKeyOnFinal);
      finalsByThrough[key] = f; // assume one per through
    }

    // Assign to each parent
    for (const m of models) {
      const pKey = m.getAttribute(this.localKey);
      const tId = parentToThroughId[pKey];
      m.relations[relationName] = tId ? finalsByThrough[tId] || null : null;
    }
  }
}

module.exports = HasOneThroughRelation;
'use strict';
const resolveSchema = require('./resolveSchema');

class SchemaView {
  constructor(schema) {
    this._schema    = schema || null;
    this._className = 'View';
  }

  static use(schemaOrDb) {
    return new SchemaView(resolveSchema(schemaOrDb));
  }

  async create(name, selectSql, options = {}) {
    this._assertBound();
    return this._schema.createView(name, selectSql, options);
  }

  async createOrReplace(name, selectSql) {
    this._assertBound();
    return this._schema.createOrReplaceView(name, selectSql);
  }

  async drop(name) {
    this._assertBound();
    return this._schema.dropView(name);
  }

  async dropIfExists(name) {
    this._assertBound();
    return this._schema.dropViewIfExists(name);
  }

  async has(name) {
    this._assertBound();
    return this._schema.hasView(name);
  }

  async list() {
    this._assertBound();
    return this._schema.getViews();
  }

  _assertBound() {
    if (!this._schema) {
      throw new TypeError(
        `${this._className} is not bound to a schema. ` +
        `Call ${this._className}.use(schema) or useSchema(schema) first.`
      );
    }
  }
}

module.exports = SchemaView;

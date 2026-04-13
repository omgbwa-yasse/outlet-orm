'use strict';
const resolveSchema = require('./resolveSchema');

class SchemaTrigger {
  constructor(schema) {
    this._schema    = schema || null;
    this._className = 'Trigger';
  }

  static use(schemaOrDb) {
    return new SchemaTrigger(resolveSchema(schemaOrDb));
  }

  async create(options) {
    this._assertBound();
    return this._schema.createTrigger(options);
  }

  async drop(name, table) {
    this._assertBound();
    return this._schema.dropTrigger(name, table);
  }

  async dropIfExists(name, table) {
    this._assertBound();
    return this._schema.dropTriggerIfExists(name, table);
  }

  async has(name, table) {
    this._assertBound();
    return this._schema.hasTrigger(name, table);
  }

  async list(table) {
    this._assertBound();
    return this._schema.getTriggers(table);
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

module.exports = SchemaTrigger;

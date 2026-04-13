'use strict';
const resolveSchema = require('./resolveSchema');

class SchemaProcedure {
  constructor(schema) {
    this._schema    = schema || null;
    this._className = 'Procedure';
  }

  static use(schemaOrDb) {
    return new SchemaProcedure(resolveSchema(schemaOrDb));
  }

  async create(name, params, body, opts = {}) {
    this._assertBound();
    return this._schema.createProcedure(name, params, body, opts);
  }

  async drop(name) {
    this._assertBound();
    return this._schema.dropProcedure(name);
  }

  async dropIfExists(name) {
    this._assertBound();
    return this._schema.dropProcedureIfExists(name);
  }

  async has(name) {
    this._assertBound();
    return this._schema.hasProcedure(name);
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

module.exports = SchemaProcedure;

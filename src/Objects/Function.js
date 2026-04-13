'use strict';
const resolveSchema = require('./resolveSchema');

class SchemaFunction {
  constructor(schema) {
    this._schema    = schema || null;
    this._className = 'Function';
  }

  static use(schemaOrDb) {
    return new SchemaFunction(resolveSchema(schemaOrDb));
  }

  async create(name, params, body, opts = {}) {
    this._assertBound();
    return this._schema.createFunction(name, params, body, opts);
  }

  async drop(name) {
    this._assertBound();
    return this._schema.dropFunction(name);
  }

  async dropIfExists(name) {
    this._assertBound();
    return this._schema.dropFunctionIfExists(name);
  }

  async has(name) {
    this._assertBound();
    return this._schema.hasFunction(name);
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

module.exports = SchemaFunction;

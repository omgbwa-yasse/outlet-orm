'use strict';

/**
 * JsonSchemaValidator
 * Performs recursive JSON Schema validation on structured outputs.
 */
class JsonSchemaValidator {
  /**
   * Validate data against a JSON Schema.
   * @param {*} data
   * @param {Object} schema
   * @returns {{valid: boolean, errors: string[]}}
   */
  static validate(data, schema) {
    const errors = [];
    JsonSchemaValidator._validateNode(data, schema, '$', errors);
    return { valid: errors.length === 0, errors };
  }

  /** @private */
  static _validateNode(value, schema, path, errors) {
    const type = schema.type;
    if (type) {
      if (type === 'object' && (typeof value !== 'object' || value === null || Array.isArray(value))) {
        errors.push(`${path}: expected object`);
        return;
      }
      if (type === 'array' && !Array.isArray(value)) {
        errors.push(`${path}: expected array`);
        return;
      }
      if (type === 'string' && typeof value !== 'string') {
        errors.push(`${path}: expected string`);
        return;
      }
      if (type === 'number' && typeof value !== 'number') {
        errors.push(`${path}: expected number`);
        return;
      }
      if (type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${path}: expected boolean`);
        return;
      }
      if (type === 'integer' && (!Number.isInteger(value))) {
        errors.push(`${path}: expected integer`);
        return;
      }
    }

    if (type === 'object' && typeof value === 'object' && value !== null) {
      const props = schema.properties || {};
      const required = schema.required || [];
      for (const req of required) {
        if (!(req in value)) {
          errors.push(`${path}.${req}: required missing`);
        }
      }
      for (const [k, v] of Object.entries(value)) {
        if (props[k]) {
          JsonSchemaValidator._validateNode(v, props[k], `${path}.${k}`, errors);
        }
      }
    }

    if (type === 'array' && Array.isArray(value) && schema.items) {
      for (let i = 0; i < value.length; i++) {
        JsonSchemaValidator._validateNode(value[i], schema.items, `${path}[${i}]`, errors);
      }
    }
  }
}

module.exports = JsonSchemaValidator;

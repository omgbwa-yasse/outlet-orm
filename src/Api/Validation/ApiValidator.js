'use strict';

/**
 * ApiValidator — synchronous and async rule-based validation.
 *
 * Built-in rules: required, email, min:n, max:n, in:a,b,c, not_in:a,b,c,
 *   string, integer, numeric, boolean, array, url, uuid, json, phone, confirmed
 *
 * Async rules: exists:ModelClass,field, unique:ModelClass,field[,excludeId]
 */
class ApiValidator {
  /**
   * Validate attributes synchronously.
   *
   * @param {object} attrs
   * @param {object} rules  — { fieldName: 'rule1|rule2|rule3:arg' }
   * @param {object} [messages] — { 'fieldName.rule': 'Custom message' }
   * @returns {{ valid: boolean, errors: object }}
   */
  static validate(attrs, rules, messages) {
    messages = messages || {};
    const errors = {};

    for (const [field, ruleStr] of Object.entries(rules)) {
      const ruleList = typeof ruleStr === 'string' ? ruleStr.split('|') : ruleStr;
      const fieldErrors = [];

      for (const ruleDef of ruleList) {
        const colonIdx = ruleDef.indexOf(':');
        const ruleName = colonIdx >= 0 ? ruleDef.slice(0, colonIdx) : ruleDef;
        const ruleArg = colonIdx >= 0 ? ruleDef.slice(colonIdx + 1) : null;

        // Skip async-only rules
        if (ruleName === 'exists' || ruleName === 'unique') continue;

        const value = attrs[field];
        const message = messages[field + '.' + ruleName];
        const result = ApiValidator._applyRule(ruleName, ruleArg, field, value, attrs);
        if (result !== null) {
          fieldErrors.push(message || result);
        }
      }

      if (fieldErrors.length) errors[field] = fieldErrors;
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  /**
   * Validate attributes asynchronously. Includes sync rules plus `exists` and `unique`.
   *
   * @param {object} attrs
   * @param {object} rules
   * @param {object} [messages]
   * @returns {Promise<{ valid: boolean, errors: object }>}
   */
  static async validateAsync(attrs, rules, messages) {
    // First run synchronous rules
    const syncResult = ApiValidator.validate(attrs, rules, messages);
    const errors = Object.assign({}, syncResult.errors);
    messages = messages || {};

    for (const [field, ruleStr] of Object.entries(rules)) {
      const ruleList = typeof ruleStr === 'string' ? ruleStr.split('|') : ruleStr;

      for (const ruleDef of ruleList) {
        const colonIdx = ruleDef.indexOf(':');
        const ruleName = colonIdx >= 0 ? ruleDef.slice(0, colonIdx) : ruleDef;
        const ruleArg = colonIdx >= 0 ? ruleDef.slice(colonIdx + 1) : null;

        if (ruleName === 'exists' || ruleName === 'unique') {
          const value = attrs[field];
          const parts = ruleArg ? ruleArg.split(',') : [];
          const ModelClass = parts[0];
          const checkField = parts[1] || field;
          const excludeId = parts[2] || null;

          if (!ModelClass || typeof ModelClass.where !== 'function') continue;

          try {
            let qb = ModelClass.where(checkField, value);
            if (ruleName === 'unique' && excludeId) {
              const pk = ModelClass.primaryKey || 'id';
              qb = qb.whereNotIn ? qb.whereNotIn(pk, [excludeId]) : qb;
            }
            const results = await qb.get();
            const count = Array.isArray(results) ? results.length : 0;

            if (ruleName === 'exists' && count === 0) {
              const msg = messages[field + '.exists'] || 'The ' + field + ' field does not exist.';
              if (!errors[field]) errors[field] = [];
              errors[field].push(msg);
            }
            if (ruleName === 'unique' && count > 0) {
              const msg = messages[field + '.unique'] || 'The ' + field + ' field must be unique.';
              if (!errors[field]) errors[field] = [];
              errors[field].push(msg);
            }
          } catch (e) {
            // If check fails, consider invalid
            const msg = messages[field + '.' + ruleName] || 'Validation check failed for ' + field + '.';
            if (!errors[field]) errors[field] = [];
            errors[field].push(msg);
          }
        }
      }
    }

    return { valid: Object.keys(errors).length === 0, errors };
  }

  /**
   * Apply a single rule to a value.
   * Returns null on pass, or an error message string on failure.
   *
   * @private
   */
  static _applyRule(ruleName, ruleArg, field, value, attrs) {
    switch (ruleName) {
      case 'required': {
        const missing = value === undefined || value === null || value === '';
        return missing ? 'The ' + field + ' field is required.' : null;
      }
      case 'string': {
        if (value === undefined || value === null) return null; // absent = pass (pair with required)
        return typeof value !== 'string' ? 'The ' + field + ' field must be a string.' : null;
      }
      case 'integer': {
        if (value === undefined || value === null) return null;
        return (!Number.isInteger(Number(value)) || typeof value === 'boolean')
          ? 'The ' + field + ' field must be an integer.'
          : null;
      }
      case 'numeric': {
        if (value === undefined || value === null) return null;
        return isNaN(Number(value)) ? 'The ' + field + ' field must be numeric.' : null;
      }
      case 'boolean': {
        if (value === undefined || value === null) return null;
        return typeof value !== 'boolean' ? 'The ' + field + ' field must be a boolean.' : null;
      }
      case 'array': {
        if (value === undefined || value === null) return null;
        return !Array.isArray(value) ? 'The ' + field + ' field must be an array.' : null;
      }
      case 'email': {
        if (value === undefined || value === null) return null;
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return !emailRe.test(String(value)) ? 'The ' + field + ' field must be a valid email address.' : null;
      }
      case 'url': {
        if (value === undefined || value === null) return null;
        try {
          new URL(String(value));
          return null;
        } catch (e) {
          return 'The ' + field + ' field must be a valid URL.';
        }
      }
      case 'uuid': {
        if (value === undefined || value === null) return null;
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return !uuidRe.test(String(value)) ? 'The ' + field + ' field must be a valid UUID.' : null;
      }
      case 'json': {
        if (value === undefined || value === null) return null;
        try { JSON.parse(value); return null; } catch (e) {
          return 'The ' + field + ' field must be valid JSON.';
        }
      }
      case 'phone': {
        if (value === undefined || value === null) return null;
        const phoneRe = /^\+?[0-9\s\-().]{7,20}$/;
        return !phoneRe.test(String(value)) ? 'The ' + field + ' field must be a valid phone number.' : null;
      }
      case 'min': {
        if (value === undefined || value === null) return null;
        const minVal = Number(ruleArg);
        if (typeof value === 'string' || Array.isArray(value)) {
          return value.length < minVal
            ? 'The ' + field + ' field must be at least ' + minVal + ' characters.'
            : null;
        }
        return Number(value) < minVal
          ? 'The ' + field + ' field must be at least ' + minVal + '.'
          : null;
      }
      case 'max': {
        if (value === undefined || value === null) return null;
        const maxVal = Number(ruleArg);
        if (typeof value === 'string' || Array.isArray(value)) {
          return value.length > maxVal
            ? 'The ' + field + ' field must not exceed ' + maxVal + ' characters.'
            : null;
        }
        return Number(value) > maxVal
          ? 'The ' + field + ' field must not exceed ' + maxVal + '.'
          : null;
      }
      case 'in': {
        if (value === undefined || value === null) return null;
        const allowed = ruleArg ? ruleArg.split(',') : [];
        return !allowed.includes(String(value))
          ? 'The ' + field + ' field must be one of: ' + allowed.join(', ') + '.'
          : null;
      }
      case 'not_in': {
        if (value === undefined || value === null) return null;
        const forbidden = ruleArg ? ruleArg.split(',') : [];
        return forbidden.includes(String(value))
          ? 'The ' + field + ' field must not be one of: ' + forbidden.join(', ') + '.'
          : null;
      }
      case 'confirmed': {
        if (value === undefined || value === null) return null;
        const confirmation = attrs[field + '_confirmation'];
        return value !== confirmation
          ? 'The ' + field + ' confirmation does not match.'
          : null;
      }
      case 'nullable': {
        return null; // Always passes — just marks field as nullable
      }
      case 'sometimes': {
        return null; // Always passes — conditional validation marker
      }
      default:
        return null; // Unknown rules pass silently
    }
  }
}

module.exports = { ApiValidator };

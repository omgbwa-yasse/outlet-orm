'use strict';

function camelToSnake(str) {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

function snakeToCamel(str) {
  return str.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

function convertKeys(obj, fn) {
  if (Array.isArray(obj)) {
    return obj.map(item => convertKeys(item, fn));
  }
  if (obj && typeof obj === 'object' && !(obj instanceof Date)) {
    const out = {};
    for (const key of Object.keys(obj)) {
      out[fn(key)] = convertKeys(obj[key], fn);
    }
    return out;
  }
  return obj;
}

module.exports = { camelToSnake, snakeToCamel, convertKeys };

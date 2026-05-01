'use strict';

function normalizePath(p) {
  return String(p || '/').replace(/\/+$/, '') || '/';
}

function resourceKey(resourcePath) {
  return 'resource:' + normalizePath(resourcePath).toLowerCase();
}

function operationKey(method, operationPath) {
  return 'operation:' + String(method || 'get').toLowerCase() + ':' + normalizePath(operationPath).toLowerCase();
}

function schemaKey(name) {
  return 'schema:' + String(name || '').trim().toLowerCase();
}

module.exports = {
  resourceKey,
  operationKey,
  schemaKey
};

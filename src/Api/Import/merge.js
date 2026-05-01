'use strict';

const { resourceKey, operationKey, schemaKey } = require('./merge-keys');
const { resolveConflict } = require('./conflict-resolver');

function elementKey(item) {
  if (item.elementType === 'resource') return resourceKey(item.path);
  if (item.elementType === 'operation') return operationKey(item.method, item.path);
  if (item.elementType === 'schema') return schemaKey(item.name);
  if (item.elementType === 'error') return 'error:' + String(item.status);
  return item.elementType + ':' + JSON.stringify(item);
}

function compareOperations(a, b) {
  const ao = String(a.path || '');
  const bo = String(b.path || '');
  if (ao !== bo) return ao < bo ? -1 : 1;
  const order = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
  return order.indexOf(String(a.method || '').toLowerCase()) - order.indexOf(String(b.method || '').toLowerCase());
}

function mergeContractElements(elements) {
  const map = new Map();
  const conflicts = [];

  for (const item of elements || []) {
    const key = elementKey(item);
    if (!map.has(key)) {
      map.set(key, item);
      continue;
    }

    const current = map.get(key);
    const decision = resolveConflict(current, item);
    map.set(key, decision.winner);
    conflicts.push({ key, reason: decision.reason, kept: decision.winner.sourceUrl, dropped: decision.loser && decision.loser.sourceUrl });
  }

  const merged = Array.from(map.values());
  merged.sort((a, b) => {
    if (a.elementType !== b.elementType) return String(a.elementType).localeCompare(String(b.elementType));
    if (a.elementType === 'operation') return compareOperations(a, b);
    return JSON.stringify(a).localeCompare(JSON.stringify(b));
  });

  return { merged, conflicts };
}

module.exports = {
  mergeContractElements
};

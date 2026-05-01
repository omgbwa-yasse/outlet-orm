'use strict';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

function extractOperations(text, sourceUrl) {
  const out = [];
  const lines = String(text || '').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\/[^\s"']+)/i);
    if (!m) continue;
    out.push({
      elementType: 'operation',
      method: m[1].toUpperCase(),
      path: m[2],
      sourceType: /reference|api/i.test(sourceUrl || '') ? 'reference' : 'guide',
      sourceUrl
    });
  }
  return out;
}

function extractResourcesFromOperations(ops, sourceUrl) {
  const resources = new Map();
  for (const op of ops) {
    const root = '/' + String(op.path || '/').split('/').filter(Boolean)[0];
    if (!root || root === '/') continue;
    resources.set(root, {
      elementType: 'resource',
      path: root,
      sourceType: op.sourceType,
      sourceUrl
    });
  }
  return Array.from(resources.values());
}

function extractContractElementsFromPage(text, page) {
  const sourceUrl = page && page.uri ? page.uri : '';
  const operations = extractOperations(text, sourceUrl);
  const resources = extractResourcesFromOperations(operations, sourceUrl);

  const schemas = [];
  const schemaMatch = String(text || '').match(/schema[s]?\s*[:=-]\s*([A-Za-z0-9_]+)/gi) || [];
  for (const entry of schemaMatch) {
    const name = String(entry.split(/[:=-]/)[1] || '').trim();
    if (!name) continue;
    schemas.push({
      elementType: 'schema',
      name,
      sourceType: 'reference',
      sourceUrl
    });
  }

  const errors = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = line.match(/\b(4\d\d|5\d\d)\b/);
    if (!m) continue;
    errors.push({
      elementType: 'error',
      status: Number(m[1]),
      sourceType: 'reference',
      sourceUrl
    });
  }

  return {
    operations,
    resources,
    schemas,
    errors,
    all: resources.concat(operations, schemas, errors)
  };
}

module.exports = {
  METHODS,
  extractContractElementsFromPage
};

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const pluralize = require('pluralize');
const { createDocumentationRoot } = require('../../src/Api/Import/domain');
const { discoverOfficialPages } = require('../../src/Api/Import/discovery');
const { extractContractElementsFromPage } = require('../../src/Api/Import/extractor');
const { mergeContractElements } = require('../../src/Api/Import/merge');
const { calculateCoverage, evaluatePartialSuccess } = require('../../src/Api/Import/coverage-metrics');
const { createProvenanceRecord } = require('../../src/Api/Import/provenance');
const { createRunSnapshot } = require('../../src/Api/Import/run-snapshot');
const { compareRuns } = require('../../src/Api/Import/delta');
const { buildCoverageDiagnostics } = require('../../src/Api/Import/diagnostics');

// ── Parse CLI args ─────────────────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : null;
}

const specPath   = getArg('--spec');
const docPath    = getArg('--doc');
const outputDir  = getArg('--output');
const lang       = getArg('--lang') || 'js';
const auth       = getArg('--auth') || null;
const strategy   = getArg('--strategy') || 'tag';
const forcedFormat = getArg('--format') || 'auto';
const maxDepth = Number(getArg('--max-depth') || 4);
const includeOfficialSubdomains = getArg('--include-official-subdomains') !== 'false';
const runDelta = args.includes('--run-delta');

const sourcePath = specPath || docPath;

if (!sourcePath || !outputDir) {
  console.error('Usage: outlet-api-import (--spec|--doc) <path|url> --output <dir> [--lang js|ts] [--auth bearer|basic|apiKey|oauth2] [--strategy tag|resource] [--format auto|openapi|postman|raml|apiblueprint|graphql] [--max-depth n] [--include-official-subdomains true|false] [--run-delta]');
  process.exit(1);
}

function isHttpUrl(location) {
  return location.startsWith('http://') || location.startsWith('https://');
}

async function readRemote(location) {
  const res = await globalThis.fetch(location);
  if (!res.ok) {
    throw new Error('Failed to fetch source from ' + location + ' - HTTP ' + res.status);
  }
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  const text = await res.text();
  return {
    location,
    finalUrl: res.url || location,
    text,
    contentType
  };
}

function readLocal(location) {
  const absolute = path.resolve(location);
  const text = fs.readFileSync(absolute, 'utf8');
  const ext = path.extname(absolute).toLowerCase();
  const contentType = ext === '.yaml' || ext === '.yml'
    ? 'application/yaml'
    : ext === '.md'
      ? 'text/markdown'
      : 'application/json';
  return {
    location,
    finalUrl: absolute,
    text,
    contentType
  };
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function tryParseYaml(text) {
  try {
    const yaml = require('js-yaml');
    return yaml.load(text);
  } catch (error) {
    if (error && error.code === 'MODULE_NOT_FOUND') {
      throw new Error('YAML format detected but js-yaml is not installed. Run: npm install js-yaml');
    }
    return null;
  }
}

function isOpenApiSpec(obj) {
  return obj && typeof obj === 'object' && (obj.openapi || obj.swagger);
}

function isPostmanCollection(obj) {
  return !!(obj && obj.info && Array.isArray(obj.item) && (obj.info.schema || obj.info.name));
}

function isGraphqlIntrospection(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.__schema) return true;
  return !!(obj.data && obj.data.__schema);
}

function isRamlText(text) {
  return /^\s*#%RAML/i.test(text || '');
}

function isApiBlueprintText(text) {
  if (!text || typeof text !== 'string') return false;
  return /FORMAT:\s*1A/i.test(text)
    || /^\s*#\s+Group\s+/mi.test(text)
    || /^\s*#\s+[^\n]*\[\/[^[\]]+\]/m.test(text)
    || /^\s*\+\s+Response\s+\d{3}\b/m.test(text);
}

const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

function normalizePathTemplate(urlPath) {
  return String(urlPath || '')
    .replace(/:([a-zA-Z0-9_]+)/g, '{$1}')
    .replace(/\/+/g, '/');
}

function resolveSourceLink(link, base) {
  if (!link) return null;
  if (isHttpUrl(link)) return link;
  if (isHttpUrl(base)) {
    return new URL(link, base).href;
  }
  const baseDir = path.dirname(base);
  return path.resolve(baseDir, link);
}

function extractPathFromPostmanUrl(urlValue) {
  if (!urlValue) return '/';
  if (typeof urlValue === 'string') {
    try {
      const parsed = new URL(urlValue);
      return normalizePathTemplate(parsed.pathname || '/');
    } catch {
      return normalizePathTemplate(urlValue.startsWith('/') ? urlValue : '/' + urlValue);
    }
  }

  if (urlValue && typeof urlValue === 'object') {
    if (Array.isArray(urlValue.path)) {
      return normalizePathTemplate('/' + urlValue.path.join('/'));
    }
    if (typeof urlValue.raw === 'string') {
      return extractPathFromPostmanUrl(urlValue.raw);
    }
  }

  return '/';
}

function extractQueryParamsFromPostmanUrl(urlValue) {
  const out = [];

  if (urlValue && typeof urlValue === 'object' && Array.isArray(urlValue.query)) {
    for (const q of urlValue.query) {
      if (!q || !q.key || q.disabled) continue;
      out.push({
        name: q.key,
        in: 'query',
        required: false,
        schema: { type: 'string' },
        description: q.description || undefined
      });
    }
    return out;
  }

  if (typeof urlValue === 'string') {
    try {
      const parsed = new URL(urlValue);
      for (const [key] of parsed.searchParams.entries()) {
        out.push({
          name: key,
          in: 'query',
          required: false,
          schema: { type: 'string' }
        });
      }
    } catch {
      // Ignore malformed URL strings.
    }
  }

  return out;
}

function inferSchemaFromExampleValue(value) {
  if (value === null) return { type: 'string', nullable: true };
  if (Array.isArray(value)) {
    return {
      type: 'array',
      items: value.length ? inferSchemaFromExampleValue(value[0]) : { type: 'string' }
    };
  }
  switch (typeof value) {
    case 'string': return { type: 'string' };
    case 'number': return Number.isInteger(value) ? { type: 'integer' } : { type: 'number' };
    case 'boolean': return { type: 'boolean' };
    case 'object': {
      const properties = {};
      for (const [k, v] of Object.entries(value)) {
        properties[k] = inferSchemaFromExampleValue(v);
      }
      return { type: 'object', properties };
    }
    default:
      return { type: 'string' };
  }
}

function postmanBodyToRequestBody(body) {
  if (!body || typeof body !== 'object' || body.disabled) return null;
  const mode = body.mode;
  if (!mode) return null;

  if (mode === 'raw') {
    const raw = String(body.raw || '');
    const asJson = tryParseJson(raw);
    if (asJson && typeof asJson === 'object') {
      return {
        required: true,
        content: {
          'application/json': {
            schema: inferSchemaFromExampleValue(asJson),
            example: asJson
          }
        }
      };
    }

    return {
      required: true,
      content: {
        'text/plain': {
          schema: { type: 'string' },
          example: raw
        }
      }
    };
  }

  if (mode === 'urlencoded' && Array.isArray(body.urlencoded)) {
    const properties = {};
    for (const entry of body.urlencoded) {
      if (!entry || !entry.key || entry.disabled) continue;
      properties[entry.key] = { type: 'string' };
    }
    return {
      required: true,
      content: {
        'application/x-www-form-urlencoded': {
          schema: { type: 'object', properties }
        }
      }
    };
  }

  if (mode === 'formdata' && Array.isArray(body.formdata)) {
    const properties = {};
    for (const entry of body.formdata) {
      if (!entry || !entry.key || entry.disabled) continue;
      properties[entry.key] = entry.type === 'file'
        ? { type: 'string', format: 'binary' }
        : { type: 'string' };
    }
    return {
      required: true,
      content: {
        'multipart/form-data': {
          schema: { type: 'object', properties }
        }
      }
    };
  }

  if (mode === 'graphql' && body.graphql && typeof body.graphql === 'object') {
    return {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              variables: { type: 'object' }
            }
          },
          example: {
            query: body.graphql.query || '',
            variables: body.graphql.variables || {}
          }
        }
      }
    };
  }

  if (mode === 'file') {
    return {
      required: true,
      content: {
        'application/octet-stream': {
          schema: { type: 'string', format: 'binary' }
        }
      }
    };
  }

  return null;
}

function postmanAuthToSecurity(authObj) {
  if (!authObj || typeof authObj !== 'object' || !authObj.type) return null;
  const t = String(authObj.type || '').toLowerCase();
  if (t === 'noauth') return [];
  return [{ [t]: [] }];
}

function postmanAuthToSecuritySchemes(authObj) {
  if (!authObj || typeof authObj !== 'object' || !authObj.type) return null;
  const t = String(authObj.type || '').toLowerCase();

  if (t === 'bearer') {
    return { type: 'http', scheme: 'bearer' };
  }
  if (t === 'basic') {
    return { type: 'http', scheme: 'basic' };
  }
  if (t === 'apikey') {
    return { type: 'apiKey', in: 'header', name: 'X-API-Key' };
  }
  if (t === 'oauth2') {
    return { type: 'oauth2', flows: { clientCredentials: { tokenUrl: 'https://example.com/oauth/token', scopes: {} } } };
  }

  return { type: 'http', scheme: t };
}

function mergePostmanVariables(parentVars, localVars) {
  const merged = Object.assign({}, parentVars || {});
  for (const v of localVars || []) {
    if (!v || (!v.key && !v.id) || v.disabled) continue;
    merged[v.key || v.id] = v.value;
  }
  return merged;
}

function buildPostmanResponse(response) {
  const statusCode = String(response && response.code ? response.code : 200);
  const description = (response && response.status) || 'OK';
  const body = response && typeof response.body === 'string' ? response.body : '';

  const parsed = tryParseJson(body);
  if (parsed && typeof parsed === 'object') {
    return {
      [statusCode]: {
        description,
        content: {
          'application/json': {
            schema: inferSchemaFromExampleValue(parsed),
            example: parsed
          }
        }
      }
    };
  }

  return {
    [statusCode]: {
      description
    }
  };
}

function walkPostmanItems(items, context, outOperations, securitySchemes) {
  const parentTags = context.tags || [];
  const inheritedAuth = context.auth || null;
  const inheritedVars = context.variables || {};

  for (const item of items || []) {
    if (Array.isArray(item.item)) {
      const folderVars = mergePostmanVariables(inheritedVars, item.variable);
      const folderAuth = item.auth || inheritedAuth;
      const nextTags = item.name ? parentTags.concat(item.name) : parentTags;
      walkPostmanItems(item.item, { tags: nextTags, auth: folderAuth, variables: folderVars }, outOperations, securitySchemes);
      continue;
    }

    if (!item.request) continue;
    const method = String(item.request.method || 'get').toLowerCase();
    if (!HTTP_METHODS.has(method)) continue;
    const operationPath = extractPathFromPostmanUrl(item.request.url);
    const tag = parentTags.length ? parentTags[parentTags.length - 1] : 'default';
    const operationAuth = item.request.auth || item.auth || inheritedAuth;
    const security = postmanAuthToSecurity(operationAuth);
    const securityType = operationAuth && operationAuth.type ? String(operationAuth.type).toLowerCase() : null;
    if (securityType) {
      const scheme = postmanAuthToSecuritySchemes(operationAuth);
      if (scheme) securitySchemes[securityType] = scheme;
    }

    const parameters = extractQueryParamsFromPostmanUrl(item.request.url);
    const requestBody = postmanBodyToRequestBody(item.request.body);

    const responses = {};
    for (const r of item.response || []) {
      Object.assign(responses, buildPostmanResponse(r));
    }
    if (!Object.keys(responses).length) {
      responses.default = { description: 'Success' };
    }

    const variableBag = mergePostmanVariables(inheritedVars, item.variable);
    const operationDescription = Object.keys(variableBag).length
      ? 'Resolved with Postman variables: ' + Object.keys(variableBag).join(', ')
      : undefined;

    if (!outOperations[operationPath]) outOperations[operationPath] = {};
    outOperations[operationPath][method] = {
      summary: item.name || method.toUpperCase() + ' ' + operationPath,
      description: operationDescription,
      tags: [tag],
      parameters,
      requestBody,
      responses,
      security
    };
  }
}

function convertPostmanToOpenApi(collection) {
  const paths = {};
  const securitySchemes = {};

  walkPostmanItems(collection.item, {
    tags: [],
    auth: collection.auth || null,
    variables: mergePostmanVariables({}, collection.variable)
  }, paths, securitySchemes);

  const topSecurity = postmanAuthToSecurity(collection.auth);

  return {
    openapi: '3.0.0',
    info: {
      title: (collection.info && collection.info.name) || 'Postman API',
      version: '1.0.0'
    },
    paths,
    security: topSecurity || undefined,
    components: {
      schemas: {},
      securitySchemes
    }
  };
}

function isHttpMethod(value) {
  return HTTP_METHODS.has(String(value || '').toLowerCase());
}

function ramlTypeToOpenApiSchema(typeDecl) {
  if (!typeDecl) return { type: 'string' };
  if (typeof typeDecl === 'string') {
    const t = typeDecl.trim();
    if (t.endsWith('[]')) {
      return { type: 'array', items: ramlTypeToOpenApiSchema(t.slice(0, -2)) };
    }
    if (t.includes('|')) {
      return { oneOf: t.split('|').map(part => ramlTypeToOpenApiSchema(part.trim())) };
    }

    const scalarMap = {
      string: { type: 'string' },
      number: { type: 'number' },
      integer: { type: 'integer' },
      boolean: { type: 'boolean' },
      object: { type: 'object' },
      array: { type: 'array', items: { type: 'string' } },
      file: { type: 'string', format: 'binary' },
      nil: { nullable: true }
    };
    return scalarMap[t.toLowerCase()] || { '$ref': '#/components/schemas/' + t };
  }

  if (Array.isArray(typeDecl)) {
    return { allOf: typeDecl.map(t => ramlTypeToOpenApiSchema(t)) };
  }

  if (typeof typeDecl === 'object') {
    if (typeDecl.type && typeof typeDecl.type === 'string') {
      const base = ramlTypeToOpenApiSchema(typeDecl.type);
      if (base.type === 'object' || typeDecl.properties) {
        const properties = {};
        const required = [];
        for (const [k, v] of Object.entries(typeDecl.properties || {})) {
          const rawName = k.replace(/\?$/, '');
          const optional = k.endsWith('?') || (v && typeof v === 'object' && v.required === false);
          const childType = typeof v === 'object' && v !== null && Object.prototype.hasOwnProperty.call(v, 'type')
            ? v.type
            : v;
          properties[rawName] = ramlTypeToOpenApiSchema(childType);
          if (!optional) required.push(rawName);
        }

        const out = {
          type: 'object',
          properties
        };
        if (required.length) out.required = required;
        if (Object.prototype.hasOwnProperty.call(typeDecl, 'additionalProperties')) {
          out.additionalProperties = !!typeDecl.additionalProperties;
        }
        if (typeDecl.discriminator) {
          out.discriminator = { propertyName: String(typeDecl.discriminator) };
        }
        return out;
      }

      return base;
    }

    if (typeDecl.properties) {
      return ramlTypeToOpenApiSchema({ type: 'object', properties: typeDecl.properties });
    }
  }

  return { type: 'string' };
}

function ramlParamsToOpenApiParameters(params, location) {
  const out = [];
  for (const [name, def] of Object.entries(params || {})) {
    const required = location === 'path'
      ? true
      : !(def && typeof def === 'object' && def.required === false);
    const typeDecl = def && typeof def === 'object' && Object.prototype.hasOwnProperty.call(def, 'type')
      ? def.type
      : def;
    out.push({
      name,
      in: location,
      required,
      schema: ramlTypeToOpenApiSchema(typeDecl),
      description: def && def.description ? String(def.description) : undefined
    });
  }
  return out;
}

function ramlBodyToOpenApiRequestBody(bodyNode) {
  if (!bodyNode || typeof bodyNode !== 'object') return null;
  const content = {};

  for (const [mediaType, mediaDef] of Object.entries(bodyNode)) {
    if (mediaType.startsWith('(')) continue;
    if (typeof mediaDef === 'string') {
      content[mediaType] = { schema: ramlTypeToOpenApiSchema(mediaDef) };
      continue;
    }

    if (mediaDef && typeof mediaDef === 'object') {
      const typeDecl = Object.prototype.hasOwnProperty.call(mediaDef, 'type') ? mediaDef.type : mediaDef;
      const schema = ramlTypeToOpenApiSchema(typeDecl);
      const entry = { schema };
      if (mediaDef.example) entry.example = mediaDef.example;
      content[mediaType] = entry;
    }
  }

  return Object.keys(content).length
    ? { required: true, content }
    : null;
}

function ramlResponsesToOpenApiResponses(responsesNode) {
  const responses = {};

  for (const [status, responseDef] of Object.entries(responsesNode || {})) {
    const entry = {
      description: (responseDef && responseDef.description) ? String(responseDef.description) : 'Response ' + status
    };

    if (responseDef && responseDef.headers) {
      entry.headers = {};
      for (const [hName, hDef] of Object.entries(responseDef.headers)) {
        entry.headers[hName] = {
          description: hDef && hDef.description ? String(hDef.description) : undefined,
          schema: ramlTypeToOpenApiSchema(hDef && hDef.type ? hDef.type : hDef)
        };
      }
    }

    if (responseDef && responseDef.body) {
      const body = ramlBodyToOpenApiRequestBody(responseDef.body);
      if (body) entry.content = body.content;
    }

    responses[String(status)] = entry;
  }

  return Object.keys(responses).length ? responses : { default: { description: 'Success' } };
}

function walkRamlResources(node, currentPath, inheritedParams, paths) {
  const resourceParams = ramlParamsToOpenApiParameters(node && node.uriParameters, 'path');
  const mergedPathParams = [...(inheritedParams || []), ...resourceParams];

  for (const [key, value] of Object.entries(node || {})) {
    if (!key.startsWith('/')) continue;

    const fullPath = normalizePathTemplate((currentPath || '') + key);
    const resourceNode = value && typeof value === 'object' ? value : {};
    if (!paths[fullPath]) paths[fullPath] = {};

    for (const [method, methodDef] of Object.entries(resourceNode)) {
      if (!isHttpMethod(method)) continue;

      const methodNode = methodDef && typeof methodDef === 'object' ? methodDef : {};
      const tag = fullPath.split('/').filter(Boolean)[0] || 'default';
      const queryParams = ramlParamsToOpenApiParameters(methodNode.queryParameters, 'query');
      const parameters = [...mergedPathParams, ...queryParams];
      const requestBody = ramlBodyToOpenApiRequestBody(methodNode.body);
      const responses = ramlResponsesToOpenApiResponses(methodNode.responses);

      paths[fullPath][method.toLowerCase()] = {
        summary: methodNode.displayName || methodNode.description || method.toUpperCase() + ' ' + fullPath,
        tags: [tag],
        parameters,
        requestBody,
        responses
      };
    }

    walkRamlResources(resourceNode, fullPath, mergedPathParams, paths);
  }
}

function convertRamlToOpenApi(ramlObj, rawText) {
  if (!ramlObj || typeof ramlObj !== 'object') {
    throw new Error('Could not parse RAML content. Ensure the file is valid YAML RAML.');
  }

  const paths = {};
  walkRamlResources(ramlObj, '', [], paths);

  const schemas = {};
  for (const [typeName, typeDef] of Object.entries(ramlObj.types || {})) {
    schemas[typeName] = ramlTypeToOpenApiSchema(typeDef);
  }

  return {
    openapi: '3.0.0',
    info: {
      title: ramlObj.title || 'RAML API',
      version: ramlObj.version || '1.0.0',
      description: String(rawText || '').split('\n').slice(0, 5).join('\n')
    },
    paths,
    components: { schemas }
  };
}

function extractBlueprintPath(line) {
  const bracketMatch = line.match(/\[([^\]]+)\]/);
  if (bracketMatch && bracketMatch[1].startsWith('/')) {
    return bracketMatch[1];
  }

  const slashMatch = line.match(/\s(\/[^\s]*)/);
  if (slashMatch) {
    return slashMatch[1];
  }

  return null;
}

function extractBlueprintMethodAndPath(line) {
  const direct = line.match(/^\s*#\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\s+([^\s]+)\s*$/i);
  if (direct) {
    return {
      method: direct[1].toLowerCase(),
      path: normalizePathTemplate(direct[2])
    };
  }

  const named = line.match(/^\s*#+\s+.*\[(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\s+([^\]]+)\]\s*$/i);
  if (named) {
    return {
      method: named[1].toLowerCase(),
      path: normalizePathTemplate(named[2])
    };
  }

  return null;
}

function convertApiBlueprintToOpenApi(text) {
  const lines = String(text || '').split(/\r?\n/);
  const paths = {};
  let currentPath = null;
  let currentTag = 'default';
  let currentMethod = null;

  for (const line of lines) {
    const groupMatch = line.match(/^#\s*Group\s+(.+)$/i);
    if (groupMatch) {
      currentTag = groupMatch[1].trim() || 'default';
      continue;
    }

    const resourceMethodPath = extractBlueprintMethodAndPath(line);
    if (resourceMethodPath) {
      if (!paths[resourceMethodPath.path]) paths[resourceMethodPath.path] = {};
      paths[resourceMethodPath.path][resourceMethodPath.method] = {
        summary: line.replace(/^\s*#+\s*/, '').trim(),
        tags: [currentTag],
        responses: {
          default: { description: 'Success' }
        }
      };
      currentPath = resourceMethodPath.path;
      currentMethod = resourceMethodPath.method;
      continue;
    }

    if (/^#\s+/.test(line)) {
      const foundPath = extractBlueprintPath(line);
      if (foundPath) {
        currentPath = normalizePathTemplate(foundPath);
        if (!paths[currentPath]) paths[currentPath] = {};
        currentMethod = null;
      }
      continue;
    }

    const actionMatch = line.match(/^##\s+.+\[(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)(?:\s+[^\]]+)?\]\s*$/i)
      || line.match(/^##\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\s*$/i)
      || line.match(/^###\s+.+\[(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)(?:\s+[^\]]+)?\]\s*$/i);

    if (actionMatch && currentPath) {
      const method = actionMatch[1].toLowerCase();
      paths[currentPath][method] = {
        summary: line.replace(/^\s*#+\s*/, '').trim(),
        tags: [currentTag],
        responses: {
          default: { description: 'Success' }
        }
      };
      currentMethod = method;
      continue;
    }

    const responseMatch = line.match(/^\s*\+\s*Response\s+(\d{3})\b/i);
    if (responseMatch && currentPath && currentMethod && paths[currentPath] && paths[currentPath][currentMethod]) {
      const code = responseMatch[1];
      const op = paths[currentPath][currentMethod];
      if (!op.responses || op.responses.default) {
        op.responses = {};
      }
      op.responses[code] = { description: 'Response ' + code };
    }
  }

  return {
    openapi: '3.0.0',
    info: { title: 'API Blueprint API', version: '1.0.0' },
    paths,
    components: { schemas: {} }
  };
}

function unwrapGraphqlType(typeRef) {
  let cursor = typeRef;
  const wrappers = [];
  while (cursor && (cursor.kind === 'NON_NULL' || cursor.kind === 'LIST')) {
    wrappers.push(cursor.kind);
    cursor = cursor.ofType;
  }
  return { cursor, wrappers };
}

function mapGraphqlTypeToOpenApi(typeRef, typeMap, visited) {
  if (!typeRef || typeof typeRef !== 'object') return { type: 'string' };

  const { cursor, wrappers } = unwrapGraphqlType(typeRef);
  const baseName = cursor && cursor.name;
  const baseKind = cursor && cursor.kind;

  const scalarMap = {
    String: { type: 'string' },
    ID: { type: 'string' },
    Boolean: { type: 'boolean' },
    Int: { type: 'integer' },
    Float: { type: 'number' }
  };

  let baseSchema;
  if (scalarMap[baseName]) {
    baseSchema = scalarMap[baseName];
  } else if (baseKind === 'UNION' || baseKind === 'INTERFACE') {
    const unionType = typeMap[baseName] || {};
    const possible = (unionType.possibleTypes || [])
      .map(t => t && t.name)
      .filter(Boolean)
      .filter(name => !visited.has(name));

    if (possible.length) {
      baseSchema = {
        oneOf: possible.map(name => ({ '$ref': '#/components/schemas/' + name }))
      };
    } else {
      baseSchema = { type: 'object' };
    }
  } else {
    baseSchema = baseName ? { '$ref': '#/components/schemas/' + baseName } : { type: 'string' };
  }

  for (let i = wrappers.length - 1; i >= 0; i--) {
    if (wrappers[i] === 'LIST') {
      baseSchema = { type: 'array', items: baseSchema };
    }
  }

  if (wrappers.includes('NON_NULL')) {
    baseSchema.nullable = false;
  }

  return baseSchema;
}

function toOpenApiSchemaFromGraphqlType(graphqlType, typeMap, visited) {
  const schema = {
    type: 'object',
    properties: {},
    required: []
  };

  for (const field of graphqlType.fields || []) {
    schema.properties[field.name] = mapGraphqlTypeToOpenApi(field.type, typeMap, visited);
    if (field.type && field.type.kind === 'NON_NULL') {
      schema.required.push(field.name);
    }
  }

  if (!schema.required.length) delete schema.required;
  return schema;
}

function convertGraphqlIntrospectionToOpenApi(introspection) {
  const schemaRoot = introspection.__schema || (introspection.data && introspection.data.__schema);
  if (!schemaRoot) {
    throw new Error('GraphQL introspection payload must contain __schema.');
  }

  const components = { schemas: {} };
  const typeMap = {};
  for (const typeDef of schemaRoot.types || []) {
    if (!typeDef || !typeDef.name || typeDef.name.startsWith('__')) continue;
    typeMap[typeDef.name] = typeDef;
    if ((typeDef.kind === 'OBJECT' || typeDef.kind === 'INTERFACE') && Array.isArray(typeDef.fields)) {
      components.schemas[typeDef.name] = toOpenApiSchemaFromGraphqlType(typeDef, typeMap, new Set([typeDef.name]));
    }

    if (typeDef.kind === 'INPUT_OBJECT' && Array.isArray(typeDef.inputFields)) {
      const properties = {};
      const required = [];
      for (const inputField of typeDef.inputFields) {
        properties[inputField.name] = mapGraphqlTypeToOpenApi(inputField.type, typeMap, new Set([typeDef.name]));
        if (inputField.type && inputField.type.kind === 'NON_NULL') required.push(inputField.name);
      }
      components.schemas[typeDef.name] = {
        type: 'object',
        properties,
        required: required.length ? required : undefined
      };
    }
  }

  const paths = {};
  const queryType = schemaRoot.queryType && typeMap[schemaRoot.queryType.name];
  const mutationType = schemaRoot.mutationType && typeMap[schemaRoot.mutationType.name];

  for (const field of (queryType && queryType.fields) || []) {
    const p = '/graphql/query/' + field.name;
    const parameters = (field.args || []).map(arg => ({
      name: arg.name,
      in: 'query',
      required: arg.type && arg.type.kind === 'NON_NULL',
      schema: mapGraphqlTypeToOpenApi(arg.type, typeMap, new Set())
    }));

    const responseSchema = mapGraphqlTypeToOpenApi(field.type, typeMap, new Set());
    paths[p] = {
      get: {
        summary: 'GraphQL query ' + field.name,
        tags: ['graphql_query'],
        parameters,
        responses: {
          '200': {
            description: 'Query result',
            content: {
              'application/json': {
                schema: responseSchema
              }
            }
          }
        }
      }
    };
  }

  for (const field of (mutationType && mutationType.fields) || []) {
    const p = '/graphql/mutation/' + field.name;
    const bodyProperties = {};
    const required = [];
    for (const arg of field.args || []) {
      bodyProperties[arg.name] = mapGraphqlTypeToOpenApi(arg.type, typeMap, new Set());
      if (arg.type && arg.type.kind === 'NON_NULL') required.push(arg.name);
    }

    const requestBody = (field.args || []).length
      ? {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: bodyProperties,
                required: required.length ? required : undefined
              }
            }
          }
        }
      : null;

    const responseSchema = mapGraphqlTypeToOpenApi(field.type, typeMap, new Set());
    paths[p] = {
      post: {
        summary: 'GraphQL mutation ' + field.name,
        tags: ['graphql_mutation'],
        requestBody,
        responses: {
          '200': {
            description: 'Mutation result',
            content: {
              'application/json': {
                schema: responseSchema
              }
            }
          }
        }
      }
    };
  }

  return {
    openapi: '3.0.0',
    info: { title: 'GraphQL Introspection API', version: '1.0.0' },
    paths,
    components
  };
}

function detectSwaggerUiSpecUrl(html, baseUrl) {
  const urlLiteralMatch = html.match(/\burl\s*:\s*["']([^"']+)["']/i);
  if (urlLiteralMatch) {
    return resolveSourceLink(urlLiteralMatch[1], baseUrl);
  }

  const urlsArrayMatch = html.match(/\burls\s*:\s*\[(.*?)\]/is);
  if (urlsArrayMatch) {
    const firstUrlMatch = urlsArrayMatch[1].match(/\burl\s*:\s*["']([^"']+)["']/i);
    if (firstUrlMatch) {
      return resolveSourceLink(firstUrlMatch[1], baseUrl);
    }
  }

  return null;
}

async function tryKnownSpecEndpoints(baseUrl) {
  const candidates = ['/openapi.json', '/swagger.json', '/v3/api-docs', '/swagger/v1/swagger.json'];
  const root = new URL(baseUrl);

  for (const candidate of candidates) {
    const attemptUrl = new URL(candidate, root.origin).href;
    const res = await globalThis.fetch(attemptUrl);
    if (!res.ok) continue;
    const text = await res.text();
    const json = tryParseJson(text);
    if (isOpenApiSpec(json)) {
      return { text, location: attemptUrl, finalUrl: res.url || attemptUrl, contentType: String(res.headers.get('content-type') || '') };
    }
  }

  return null;
}

function detectSourceFormat(payload, forced) {
  const forcedLower = String(forced || 'auto').toLowerCase();
  if (forcedLower !== 'auto') return forcedLower;

  const { text, contentType } = payload;
  const json = tryParseJson(text);
  if (isOpenApiSpec(json)) return 'openapi';
  if (isPostmanCollection(json)) return 'postman';
  if (isGraphqlIntrospection(json)) return 'graphql';

  const yamlObj = tryParseYaml(text);
  if (isOpenApiSpec(yamlObj)) return 'openapi';
  if (isPostmanCollection(yamlObj)) return 'postman';

  if (isRamlText(text)) return 'raml';
  if (/yaml|yml/.test(contentType || '')) return 'raml';
  if (isApiBlueprintText(text)) return 'apiblueprint';

  if (/text\/html/.test(contentType || '') || /<html/i.test(text)) return 'swagger-html';
  return 'unknown';
}

async function loadSourcePayload(location, forced) {
  const payload = isHttpUrl(location) ? await readRemote(location) : readLocal(location);
  let format = detectSourceFormat(payload, forced);

  if (format === 'swagger-html') {
    const specUrl = detectSwaggerUiSpecUrl(payload.text, payload.finalUrl);
    if (specUrl) {
      const nestedPayload = await readRemote(specUrl);
      return { ...nestedPayload, format: detectSourceFormat(nestedPayload, 'openapi') };
    }

    if (isHttpUrl(location)) {
      const fallbackPayload = await tryKnownSpecEndpoints(payload.finalUrl);
      if (fallbackPayload) {
        return { ...fallbackPayload, format: detectSourceFormat(fallbackPayload, 'openapi') };
      }
    }
  }

  return { ...payload, format };
}

async function convertReferenceDocsToOpenApi(location, options) {
  const root = createDocumentationRoot(location, 'outlet-api-import');
  const pages = await discoverOfficialPages(root, {
    maxDepth: options.maxDepth,
    includeOfficialSubdomains: options.includeOfficialSubdomains
  });

  const elements = [];
  const coverageRecords = [];

  for (const page of pages) {
    if (page.status === 'failed' || page.status === 'ignored') {
      coverageRecords.push({
        uri: page.uri,
        authorityClass: page.authorityClass,
        inclusionReason: page.inclusionReason,
        status: page.status,
        extractedOperations: 0,
        extractedSchemas: 0,
        errorSummary: page.errorSummary || undefined,
        provenance: createProvenanceRecord(page, page.authorityClass, page.inclusionReason, page.parentUri)
      });
      continue;
    }

    try {
      const payload = await (isHttpUrl(page.uri) ? readRemote(page.uri) : readLocal(page.uri));
      const extracted = extractContractElementsFromPage(payload.text, page);
      elements.push(...extracted.all);
      coverageRecords.push({
        uri: page.uri,
        authorityClass: page.authorityClass,
        inclusionReason: page.inclusionReason,
        status: 'processed',
        extractedOperations: extracted.operations.length,
        extractedSchemas: extracted.schemas.length,
        provenance: createProvenanceRecord(page, page.authorityClass, page.inclusionReason, page.parentUri)
      });
    } catch (err) {
      coverageRecords.push({
        uri: page.uri,
        authorityClass: page.authorityClass,
        inclusionReason: page.inclusionReason,
        status: 'failed',
        extractedOperations: 0,
        extractedSchemas: 0,
        errorSummary: String(err && err.message ? err.message : err),
        provenance: createProvenanceRecord(page, page.authorityClass, page.inclusionReason, page.parentUri)
      });
    }
  }

  const mergeResult = mergeContractElements(elements);
  const metrics = calculateCoverage(coverageRecords);

  const paths = {};
  const tagsByPath = {};
  for (const item of mergeResult.merged) {
    if (item.elementType !== 'operation') continue;
    if (!paths[item.path]) paths[item.path] = {};
    paths[item.path][String(item.method || 'get').toLowerCase()] = {
      summary: String(item.method || 'GET').toUpperCase() + ' ' + item.path,
      tags: [item.path.split('/').filter(Boolean)[0] || 'default'],
      responses: {
        default: { description: 'Success' }
      }
    };
    tagsByPath[item.path] = item.path.split('/').filter(Boolean)[0] || 'default';
  }

  const schemas = {};
  for (const item of mergeResult.merged) {
    if (item.elementType !== 'schema') continue;
    schemas[item.name] = { type: 'object', properties: {} };
  }

  const spec = {
    openapi: '3.0.0',
    info: {
      title: 'Reference Documentation Import',
      version: '1.0.0'
    },
    paths,
    components: {
      schemas
    }
  };

  const operationsExtracted = mergeResult.merged.filter(e => e.elementType === 'operation').length;
  const operationCoverageRatio = operationsExtracted ? 1 : 0;
  const partialAllowed = evaluatePartialSuccess(metrics, operationCoverageRatio);
  if (!partialAllowed && metrics.total > 0) {
    throw new Error('Reference documentation coverage too low (' + metrics.processed + '/' + metrics.total + ' pages).');
  }

  const runId = 'run-' + Date.now();
  const runSnapshot = createRunSnapshot(runId, coverageRecords, mergeResult.merged);
  const diagnostics = buildCoverageDiagnostics(metrics, coverageRecords, mergeResult.conflicts);

  return {
    spec,
    meta: {
      coverageRecords,
      conflicts: mergeResult.conflicts,
      metrics,
      diagnostics,
      runSnapshot,
      elements: mergeResult.merged
    }
  };
}

async function loadSpec(location, forced) {
  if (docPath) {
    const prePayload = await loadSourcePayload(location, forced);
    if (prePayload.format === 'swagger-html' || prePayload.format === 'unknown') {
      return convertReferenceDocsToOpenApi(location, {
        maxDepth,
        includeOfficialSubdomains
      });
    }
  }

  const payload = await loadSourcePayload(location, forced);
  const format = payload.format;
  const text = payload.text;

  const json = tryParseJson(text);

  if (format === 'openapi' && isOpenApiSpec(json)) {
    return { spec: json, meta: null };
  }

  if (format === 'postman' && isPostmanCollection(json)) {
    return { spec: convertPostmanToOpenApi(json), meta: null };
  }

  if (format === 'graphql' && isGraphqlIntrospection(json)) {
    return { spec: convertGraphqlIntrospectionToOpenApi(json), meta: null };
  }

  if (format === 'raml') {
    const ramlObj = tryParseYaml(text);
    return { spec: convertRamlToOpenApi(ramlObj, text), meta: null };
  }

  if (format === 'apiblueprint') {
    return { spec: convertApiBlueprintToOpenApi(text), meta: null };
  }

  if (json && isOpenApiSpec(json)) {
    return { spec: json, meta: null };
  }

  const yamlObj = tryParseYaml(text);
  if (isOpenApiSpec(yamlObj)) {
    return { spec: yamlObj, meta: null };
  }

  throw new Error('Unsupported API documentation format. Supported: OpenAPI/Swagger JSON or YAML, Postman Collection, RAML, API Blueprint, GraphQL introspection JSON.');
}

// ── Helpers ────────────────────────────────────────────────────────────
function toPascalCase(str) {
  return str.replace(/[-_/](.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
}

function toEndpoint(tag, paths) {
  // Find the shortest path that includes the tag
  for (const p of Object.keys(paths)) {
    const ops = paths[p];
    for (const method of Object.values(ops)) {
      if (method.tags && method.tags.includes(tag)) {
        // Return base path (strip /{id} etc.)
        return p.replace(/\/\{[^}]+\}$/, '') || '/' + tag;
      }
    }
  }
  return '/' + tag.toLowerCase();
}

function extractSchema(tag, spec) {
  const components = spec.components || {};
  const schemas = components.schemas || {};
  // Look for schema matching the tag name (singular)
  const names = [
    toPascalCase(tag),
    toPascalCase(tag.replace(/s$/, '')),
    tag,
    tag.toLowerCase()
  ];
  for (const name of names) {
    if (schemas[name]) return { name, schema: schemas[name] };
  }
  return null;
}

function getFillable(schemaObj) {
  if (!schemaObj || schemaObj.type !== 'object' || !schemaObj.properties) return [];
  return Object.keys(schemaObj.properties).filter(k => k !== 'id');
}

function getHasMany(schemaObj, spec) {
  void spec;
  if (!schemaObj || schemaObj.type !== 'object' || !schemaObj.properties) return [];
  const relations = [];
  for (const [key, prop] of Object.entries(schemaObj.properties)) {
    if (prop.type === 'array' && prop.items) {
      const ref = prop.items.$ref;
      if (ref) {
        const refName = ref.replace('#/components/schemas/', '');
        relations.push({ key, refName });
      }
    }
  }
  return relations;
}

function inferForeignKeyFromModel(className) {
  return pluralize.singular(className).toLowerCase() + '_id';
}

function generateJsModel(className, endpoint, fillable, hidden, casts, relations, authType) {
  const lines = [
    '\'use strict\';',
    '',
    'const { ApiModel } = require(\'outlet-orm\');',
    ''
  ];

  if (relations.length) {
    // Relationship classes are loaded lazily in methods to reduce circular import issues.
    relations.forEach(r => {
      lines.push('// const { ' + toPascalCase(r.refName) + ' } = require(\'./' + toPascalCase(r.refName) + '\');');
    });
    lines.push('');
  }

  lines.push('class ' + className + ' extends ApiModel {');
  lines.push('  static endpoint = \'' + endpoint + '\';');

  if (fillable.length) {
    lines.push('  static fillable = ' + JSON.stringify(fillable) + ';');
  }
  if (hidden.length) {
    lines.push('  static hidden = ' + JSON.stringify(hidden) + ';');
  }
  if (Object.keys(casts).length) {
    lines.push('  static casts = ' + JSON.stringify(casts, null, 2).replace(/\n/g, '\n  ') + ';');
  }

  if (authType) {
    lines.push('  // Default auth type: ' + authType);
  }

  if (relations.length) {
    const fk = inferForeignKeyFromModel(className);
    lines.push('');
    relations.forEach(r => {
      lines.push('  static ' + r.key + '() {');
      lines.push('    const { ' + toPascalCase(r.refName) + ' } = require(\'./' + toPascalCase(r.refName) + '\');');
      lines.push('    return this.hasMany(' + toPascalCase(r.refName) + ', \'' + fk + '\');');
      lines.push('  }');
    });
  }

  lines.push('}');
  lines.push('');
  lines.push('module.exports = { ' + className + ' };');
  lines.push('');

  return lines.join('\n');
}

function generateTsModel(className, endpoint, fillable, hidden, casts, relations, authType) {
  const lines = [
    'import { ApiModel } from \'outlet-orm\';',
    ''
  ];

  lines.push('export class ' + className + ' extends ApiModel {');
  lines.push('  static endpoint = \'' + endpoint + '\';');
  if (fillable.length) {
    lines.push('  static fillable = ' + JSON.stringify(fillable) + ';');
  }
  if (hidden.length) {
    lines.push('  static hidden = ' + JSON.stringify(hidden) + ';');
  }
  if (authType) {
    lines.push('  // Default auth type: ' + authType);
  }
  if (relations.length) {
    const fk = inferForeignKeyFromModel(className);
    lines.push('');
    relations.forEach(r => {
      lines.push('  static ' + r.key + '() {');
      lines.push('    // eslint-disable-next-line global-require');
      lines.push('    const { ' + toPascalCase(r.refName) + ' } = require(\'./' + toPascalCase(r.refName) + '\');');
      lines.push('    return this.hasMany(' + toPascalCase(r.refName) + ', \'' + fk + '\');');
      lines.push('  }');
    });
  }
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

// ── Group paths by strategy ─────────────────────────────────────────────
function groupByTag(spec) {
  const groups = {};
  const paths = spec.paths || {};
  for (const [p, ops] of Object.entries(paths)) {
    for (const method of Object.values(ops)) {
      if (!method || typeof method !== 'object') continue;
      const tags = method.tags || ['default'];
      tags.forEach(tag => {
        if (!groups[tag]) groups[tag] = [];
        if (!groups[tag].includes(p)) groups[tag].push(p);
      });
    }
  }
  return groups;
}

function groupByResource(spec) {
  const groups = {};
  const paths = spec.paths || {};
  for (const p of Object.keys(paths)) {
    // Use first path segment as resource
    const segments = p.split('/').filter(Boolean);
    const resource = segments[0] || 'root';
    if (!groups[resource]) groups[resource] = [];
    groups[resource].push(p);
  }
  return groups;
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  let loaded;
  try {
    loaded = await loadSpec(sourcePath, forcedFormat);
  } catch (err) {
    console.error('Error loading spec: ' + err.message);
    process.exit(1);
  }

  const spec = loaded && loaded.spec ? loaded.spec : loaded;

  if (!spec.openapi && !spec.swagger) {
    console.error('Error: spec does not look like a valid OpenAPI document (missing "openapi" or "swagger" key).');
    process.exit(1);
  }

  const outDir = path.resolve(outputDir);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const groups = strategy === 'resource'
    ? groupByResource(spec)
    : groupByTag(spec);

  const ext = lang === 'ts' ? '.ts' : '.js';
  let generated = 0;

  for (const [groupName] of Object.entries(groups)) {
    const className = toPascalCase(groupName);
    if (!className) continue;

    const endpoint = toEndpoint(groupName, spec.paths || {});
    const schemaInfo = extractSchema(groupName, spec);
    const schemaObj  = schemaInfo ? schemaInfo.schema : null;
    const fillable   = getFillable(schemaObj);
    const hidden     = [];
    const casts      = {};
    const relations  = getHasMany(schemaObj, spec);

    const content = lang === 'ts'
      ? generateTsModel(className, endpoint, fillable, hidden, casts, relations, auth)
      : generateJsModel(className, endpoint, fillable, hidden, casts, relations, auth);

    const outFile = path.join(outDir, className + ext);
    fs.writeFileSync(outFile, content, 'utf8');
    console.log('  created: ' + path.relative(process.cwd(), outFile));
    generated++;
  }

  if (loaded && loaded.meta) {
    const coveragePath = path.join(outDir, '_coverage-report.json');
    fs.writeFileSync(coveragePath, JSON.stringify({
      metrics: loaded.meta.metrics,
      diagnostics: loaded.meta.diagnostics,
      conflicts: loaded.meta.conflicts,
      pages: loaded.meta.coverageRecords
    }, null, 2), 'utf8');
    console.log('  created: ' + path.relative(process.cwd(), coveragePath));

    const runStatePath = path.join(outDir, '_run-state.json');
    let previous = null;
    if (fs.existsSync(runStatePath)) {
      previous = tryParseJson(fs.readFileSync(runStatePath, 'utf8'));
    }

    const current = {
      runId: loaded.meta.runSnapshot.runId,
      coverageRatio: loaded.meta.metrics.coverageRatio,
      elements: loaded.meta.elements,
      snapshot: loaded.meta.runSnapshot
    };

    fs.writeFileSync(runStatePath, JSON.stringify(current, null, 2), 'utf8');
    console.log('  created: ' + path.relative(process.cwd(), runStatePath));

    if (runDelta && previous) {
      const delta = compareRuns(previous, current);
      const deltaPath = path.join(outDir, '_run-delta.json');
      fs.writeFileSync(deltaPath, JSON.stringify(delta, null, 2), 'utf8');
      console.log('  created: ' + path.relative(process.cwd(), deltaPath));
    }
  }

  console.log('\noutlet-api-import: ' + generated + ' model file(s) generated in ' + path.relative(process.cwd(), outDir) + '/');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});

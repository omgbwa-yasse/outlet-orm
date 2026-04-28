#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

// ── Parse CLI args ─────────────────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : null;
}

function hasFlag(name) {
  return args.includes(name);
}

const specPath   = getArg('--spec');
const outputDir  = getArg('--output');
const lang       = getArg('--lang') || 'js';
const auth       = getArg('--auth') || null;
const strategy   = getArg('--strategy') || 'tag';

if (!specPath || !outputDir) {
  console.error('Usage: outlet-api-import --spec <path|url> --output <dir> [--lang js|ts] [--auth bearer|basic|apiKey|oauth2] [--strategy tag|resource]');
  process.exit(1);
}

// ── Load OpenAPI spec ──────────────────────────────────────────────────
async function loadSpec(location) {
  if (location.startsWith('http://') || location.startsWith('https://')) {
    const res = await globalThis.fetch(location);
    if (!res.ok) {
      throw new Error('Failed to fetch spec from ' + location + ' — HTTP ' + res.status);
    }
    return res.json();
  }
  const raw = fs.readFileSync(path.resolve(location), 'utf8');
  return JSON.parse(raw);
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

function generateJsModel(className, endpoint, fillable, hidden, casts, relations, authType) {
  const lines = [
    '\'use strict\';',
    '',
    'const { ApiModel } = require(\'outlet-orm\');',
    ''
  ];

  if (relations.length) {
    // hasMany requires importing related model (placeholder import)
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
    lines.push('');
    relations.forEach(r => {
      lines.push('  ' + r.key + '() {');
      lines.push('    return this.hasMany(\'' + toPascalCase(r.refName) + '\');');
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
    lines.push('');
    relations.forEach(r => {
      lines.push('  ' + r.key + '() {');
      lines.push('    return this.hasMany(\'' + toPascalCase(r.refName) + '\');');
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
  let spec;
  try {
    spec = await loadSpec(specPath);
  } catch (err) {
    console.error('Error loading spec: ' + err.message);
    process.exit(1);
  }

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

  for (const [groupName, groupPaths] of Object.entries(groups)) {
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

  console.log('\noutlet-api-import: ' + generated + ' model file(s) generated in ' + path.relative(process.cwd(), outDir) + '/');
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});

#!/usr/bin/env node
'use strict';

const fs   = require('fs');
const path = require('path');

// ── Parse CLI args ─────────────────────────────────────────────────────
const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : null;
}

const specPath  = getArg('--spec');
const modelsDir = getArg('--models');

if (!specPath || !modelsDir) {
  console.error('Usage: outlet-api-diff --spec <path|url> --models <dir>');
  process.exit(1);
}

// ── Load OpenAPI spec ──────────────────────────────────────────────────
async function loadSpec(location) {
  if (location.startsWith('http://') || location.startsWith('https://')) {
    const res = await globalThis.fetch(location);
    if (!res.ok) {
      throw new Error('Failed to fetch spec: HTTP ' + res.status);
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

function extractEndpointFromFile(content) {
  const m = content.match(/static\s+endpoint\s*=\s*['"]([^'"]+)['"]/);
  return m ? m[1] : null;
}

function extractFillableFromFile(content) {
  const m = content.match(/static\s+fillable\s*=\s*(\[[^\]]*\])/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (_) {
    return null;
  }
}

function getTagsFromSpec(spec) {
  const tags = new Set();
  const paths = spec.paths || {};
  for (const ops of Object.values(paths)) {
    for (const op of Object.values(ops)) {
      if (op && op.tags) op.tags.forEach(t => tags.add(t));
    }
  }
  return Array.from(tags);
}

function getEndpointForTag(tag, spec) {
  const paths = spec.paths || {};
  for (const [p, ops] of Object.entries(paths)) {
    for (const method of Object.values(ops)) {
      if (method && method.tags && method.tags.includes(tag)) {
        return p.replace(/\/\{[^}]+\}$/, '') || '/' + tag;
      }
    }
  }
  return '/' + tag.toLowerCase();
}

function getFillableFromSpec(tag, spec) {
  const schemas = (spec.components || {}).schemas || {};
  const candidates = [
    toPascalCase(tag),
    toPascalCase(tag.replace(/s$/, '')),
    tag,
    tag.toLowerCase()
  ];
  for (const name of candidates) {
    const schema = schemas[name];
    if (schema && schema.type === 'object' && schema.properties) {
      return Object.keys(schema.properties).filter(k => k !== 'id');
    }
  }
  return null;
}

// ── Scan model files ───────────────────────────────────────────────────
function scanModels(dir) {
  const result = [];
  let entries;
  try {
    entries = fs.readdirSync(path.resolve(dir));
  } catch (_) {
    console.error('Error: cannot read models directory: ' + dir);
    process.exit(1);
  }
  for (const entry of entries) {
    if (!entry.endsWith('.js') && !entry.endsWith('.ts')) continue;
    const filePath = path.join(path.resolve(dir), entry);
    const content  = fs.readFileSync(filePath, 'utf8');
    const endpoint = extractEndpointFromFile(content);
    const fillable = extractFillableFromFile(content);
    result.push({ file: entry, filePath, endpoint, fillable });
  }
  return result;
}

// ── Diff reporter ──────────────────────────────────────────────────────
function diff(spec, models) {
  const tags         = getTagsFromSpec(spec);
  const issues       = [];
  let diverged       = false;

  // Indexed by endpoint
  const modelsByEndpoint = {};
  for (const m of models) {
    if (m.endpoint) {
      modelsByEndpoint[m.endpoint] = m;
    }
  }

  const specEndpoints = new Set();

  // Check each tag in spec
  for (const tag of tags) {
    const expectedEndpoint = getEndpointForTag(tag, spec);
    specEndpoints.add(expectedEndpoint);

    if (!modelsByEndpoint[expectedEndpoint]) {
      issues.push({ type: 'missing', tag, endpoint: expectedEndpoint });
      diverged = true;
    } else {
      // Field mismatch check
      const specFillable  = getFillableFromSpec(tag, spec);
      const modelFillable = modelsByEndpoint[expectedEndpoint].fillable;
      if (specFillable && modelFillable) {
        const extra   = modelFillable.filter(f => !specFillable.includes(f));
        const missing = specFillable.filter(f => !modelFillable.includes(f));
        if (extra.length || missing.length) {
          issues.push({
            type:     'field_mismatch',
            tag,
            endpoint: expectedEndpoint,
            file:     modelsByEndpoint[expectedEndpoint].file,
            missing,
            extra
          });
          diverged = true;
        }
      }
    }
  }

  // Models not in spec (extra)
  for (const m of models) {
    if (m.endpoint && !specEndpoints.has(m.endpoint)) {
      issues.push({ type: 'extra', file: m.file, endpoint: m.endpoint });
      diverged = true;
    }
  }

  return { issues, diverged };
}

// ── Print report ───────────────────────────────────────────────────────
function printReport(issues) {
  if (!issues.length) {
    console.log('\noutlet-api-diff: Models are in sync with the spec.');
    return;
  }

  console.log('\noutlet-api-diff: divergences found:\n');

  for (const issue of issues) {
    if (issue.type === 'missing') {
      console.log('  [MISSING]  No model for tag "' + issue.tag + '" (expected endpoint: ' + issue.endpoint + ')');
    } else if (issue.type === 'extra') {
      console.log('  [EXTRA]    Model file "' + issue.file + '" has endpoint "' + issue.endpoint + '" not found in spec');
    } else if (issue.type === 'field_mismatch') {
      console.log('  [MISMATCH] ' + issue.file + ' (endpoint: ' + issue.endpoint + ')');
      if (issue.missing.length) {
        console.log('             Fields in spec but not in fillable: ' + issue.missing.join(', '));
      }
      if (issue.extra.length) {
        console.log('             Fields in fillable but not in spec:  ' + issue.extra.join(', '));
      }
    }
  }

  console.log('\n  ' + issues.length + ' issue(s) found.');
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
    console.error('Error: spec does not look like a valid OpenAPI document.');
    process.exit(1);
  }

  const models = scanModels(modelsDir);
  const { issues, diverged } = diff(spec, models);
  printReport(issues);

  process.exit(diverged ? 1 : 0);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});

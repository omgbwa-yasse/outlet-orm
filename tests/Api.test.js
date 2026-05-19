const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const { createDocumentationRoot } = require('../src/Api/Import/domain');
const { normalizeUrl, dedupeCanonical } = require('../src/Api/Import/url-normalizer');
const { mergeContractElements } = require('../src/Api/Import/merge');
const { calculateCoverage, evaluatePartialSuccess } = require('../src/Api/Import/coverage-metrics');
const { compareRuns } = require('../src/Api/Import/delta');
const { buildCoverageDiagnostics } = require('../src/Api/Import/diagnostics');

describe('ApiImport foundations', () => {
  test('creates documentation root and normalizes URL', () => {
    const root = createDocumentationRoot('https://docs.example.com/');
    expect(root.normalizedRootUri).toBe('https://docs.example.com/');
    expect(normalizeUrl('https://docs.example.com//reference/')).toBe('https://docs.example.com/reference');
  });

  test('deduplicates canonical URLs', () => {
    const deduped = dedupeCanonical([
      'https://docs.example.com/reference',
      'https://docs.example.com/reference/',
      'HTTPS://DOCS.EXAMPLE.COM/reference'
    ]);
    expect(deduped.length).toBe(1);
  });

  test('merges conflicts deterministically by precedence', () => {
    const result = mergeContractElements([
      { elementType: 'operation', method: 'GET', path: '/users', sourceType: 'guide', sourceUrl: 'https://docs.example.com/guides/a' },
      { elementType: 'operation', method: 'GET', path: '/users', sourceType: 'reference', sourceUrl: 'https://docs.example.com/reference/users' }
    ]);

    expect(result.merged).toHaveLength(1);
    expect(result.merged[0].sourceType).toBe('reference');
    expect(result.conflicts.length).toBe(1);
  });

  test('calculates coverage metrics and partial-success thresholds', () => {
    const metrics = calculateCoverage([
      { status: 'processed' },
      { status: 'processed' },
      { status: 'failed' }
    ]);
    expect(metrics.total).toBe(3);
    expect(metrics.coverageRatio).toBeCloseTo(2 / 3);
    expect(evaluatePartialSuccess(metrics, 0.9)).toBe(true);
    expect(evaluatePartialSuccess(metrics, 0.1)).toBe(false);
  });

  test('computes run delta and diagnostics for low coverage', () => {
    const delta = compareRuns(
      { runId: 'r1', coverageRatio: 0.5, elements: [{ elementType: 'operation', method: 'GET', path: '/users' }] },
      { runId: 'r2', coverageRatio: 0.8, elements: [{ elementType: 'operation', method: 'GET', path: '/users' }, { elementType: 'operation', method: 'POST', path: '/users' }] }
    );

    expect(delta.operationsDeltaCount).toBe(1);
    expect(delta.coverageDelta).toBeCloseTo(0.3);

    const diagnostics = buildCoverageDiagnostics(
      { coverageRatio: 0.6 },
      [{ status: 'failed', uri: 'https://docs.example.com/a', errorSummary: 'timeout' }],
      [{ key: 'operation:get:/users', reason: 'higher-source-precedence' }]
    );

    expect(diagnostics.summary).toContain('Coverage ratio below recommended threshold');
    expect(diagnostics.failedPages).toHaveLength(1);
    expect(diagnostics.conflicts).toHaveLength(1);
  });

  test('api-import remains compatible with direct OpenAPI JSON specs', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outlet-api-import-'));
    try {
      const specPath = path.join(tmpDir, 'openapi.json');
      fs.writeFileSync(specPath, JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Compat API', version: '1.0.0' },
        paths: {
          '/users': {
            get: { tags: ['users'], responses: { '200': { description: 'ok' } } }
          }
        },
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: { id: { type: 'integer' }, name: { type: 'string' } }
            }
          }
        }
      }, null, 2));

      execFileSync(process.execPath, [
        path.join(__dirname, '..', 'bin', 'api', 'import.js'),
        '--spec', specPath,
        '--output', tmpDir,
        '--lang', 'js'
      ], { stdio: 'pipe' });

      expect(fs.existsSync(path.join(tmpDir, 'Users.js'))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('api-import doc mode produces coverage and run-delta artifacts', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outlet-api-doc-'));
    try {
      const docsDir = path.join(tmpDir, 'docs');
      fs.mkdirSync(docsDir, { recursive: true });

      fs.writeFileSync(path.join(docsDir, 'index.html'), [
        '<html><body>',
        '<a href="./reference.html">Reference</a>',
        '</body></html>'
      ].join('\n'));

      fs.writeFileSync(path.join(docsDir, 'reference.html'), [
        '<html><body>',
        'GET /users',
        'POST /users',
        'schema: User',
        '400 Bad Request',
        '</body></html>'
      ].join('\n'));

      execFileSync(process.execPath, [
        path.join(__dirname, '..', 'bin', 'api', 'import.js'),
        '--doc', path.join(docsDir, 'index.html'),
        '--output', tmpDir,
        '--run-delta'
      ], { stdio: 'pipe' });

      execFileSync(process.execPath, [
        path.join(__dirname, '..', 'bin', 'api', 'import.js'),
        '--doc', path.join(docsDir, 'index.html'),
        '--output', tmpDir,
        '--run-delta'
      ], { stdio: 'pipe' });

      expect(fs.existsSync(path.join(tmpDir, '_coverage-report.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '_run-state.json'))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, '_run-delta.json'))).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

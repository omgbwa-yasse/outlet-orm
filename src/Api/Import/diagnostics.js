'use strict';

function buildCoverageDiagnostics(metrics, coverageRecords, conflicts) {
  const failed = (coverageRecords || []).filter(r => r.status === 'failed');
  const ambiguous = (coverageRecords || []).filter(r => r.status === 'ambiguous');

  const messages = [];
  if (metrics.coverageRatio < 0.7) {
    messages.push('Coverage ratio below recommended threshold (0.70).');
  }
  if (failed.length) {
    messages.push(failed.length + ' page(s) failed to process.');
  }
  if (ambiguous.length) {
    messages.push(ambiguous.length + ' page(s) contain ambiguous sections.');
  }
  if ((conflicts || []).length) {
    messages.push((conflicts || []).length + ' conflict(s) were resolved deterministically.');
  }

  return {
    summary: messages.length ? messages.join(' ') : 'No diagnostics warnings.',
    failedPages: failed.map(p => ({ uri: p.uri, errorSummary: p.errorSummary || '' })),
    ambiguousPages: ambiguous.map(p => ({ uri: p.uri, ambiguousSections: p.ambiguousSections || 0 })),
    conflicts: conflicts || []
  };
}

module.exports = {
  buildCoverageDiagnostics
};

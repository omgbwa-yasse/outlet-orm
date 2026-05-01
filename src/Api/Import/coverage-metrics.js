'use strict';

function calculateCoverage(records) {
  const pages = records || [];
  const total = pages.length;
  const processed = pages.filter(r => r && r.status === 'processed').length;
  const failed = pages.filter(r => r && r.status === 'failed').length;
  const ignored = pages.filter(r => r && r.status === 'ignored').length;
  const ambiguous = pages.filter(r => r && r.status === 'ambiguous').length;

  const coverageRatio = total ? processed / total : 0;

  return {
    total,
    processed,
    failed,
    ignored,
    ambiguous,
    coverageRatio
  };
}

function evaluatePartialSuccess(metrics, operationCoverageRatio) {
  const pagePass = metrics.coverageRatio >= 0.7;
  const opPass = Number(operationCoverageRatio || 0) >= 0.85;
  return pagePass || opPass;
}

module.exports = {
  calculateCoverage,
  evaluatePartialSuccess
};

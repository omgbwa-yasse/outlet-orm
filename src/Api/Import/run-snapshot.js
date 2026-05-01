'use strict';

const crypto = require('crypto');

function createRunSnapshot(runId, pages, mergedElements) {
  const payload = {
    runId,
    pagesDiscovered: (pages || []).length,
    pagesProcessed: (pages || []).filter(p => p.status === 'processed').length,
    operationsExtracted: (mergedElements || []).filter(e => e.elementType === 'operation').length,
    generatedAt: new Date().toISOString()
  };

  const digest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  return Object.assign({}, payload, { outputDigest: digest });
}

module.exports = {
  createRunSnapshot
};

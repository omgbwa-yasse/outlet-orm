'use strict';

function createProvenanceRecord(page, classification, reason, parentUri) {
  return {
    sourceUrl: page && page.uri ? page.uri : String(page || ''),
    discoveryParentUrl: parentUri || null,
    authorityClass: classification || 'root-host',
    inclusionReason: reason || 'discovered-link'
  };
}

module.exports = {
  createProvenanceRecord
};

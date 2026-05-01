'use strict';

function createDocumentationRoot(inputUri, requestedBy) {
  const normalizedRootUri = String(inputUri || '').trim();
  if (!normalizedRootUri) {
    throw new Error('reference root is required');
  }

  return {
    id: 'root:' + normalizedRootUri,
    inputUri,
    normalizedRootUri,
    createdAt: new Date().toISOString(),
    requestedBy: requestedBy || null
  };
}

function createOfficialPage(root, uri, depth, authorityClass, inclusionReason, parentUri) {
  if (!root || !root.id) {
    throw new Error('valid documentation root is required');
  }

  return {
    id: 'page:' + uri,
    rootId: root.id,
    uri,
    canonicalUri: uri,
    depth: Number(depth) || 0,
    authorityClass: authorityClass || 'root-host',
    inclusionReason: inclusionReason || 'linked-from-root',
    parentUri: parentUri || null,
    status: 'queued',
    fetchedAt: null
  };
}

module.exports = {
  createDocumentationRoot,
  createOfficialPage
};

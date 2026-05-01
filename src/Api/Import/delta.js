'use strict';

function indexOperations(items) {
  const set = new Set();
  for (const item of items || []) {
    if (item.elementType !== 'operation') continue;
    set.add(String(item.method || '').toUpperCase() + ' ' + String(item.path || ''));
  }
  return set;
}

function compareRuns(previous, current) {
  const prevOps = indexOperations(previous && previous.elements);
  const currOps = indexOperations(current && current.elements);

  const addedOperations = [];
  const removedOperations = [];

  for (const op of currOps) {
    if (!prevOps.has(op)) addedOperations.push(op);
  }
  for (const op of prevOps) {
    if (!currOps.has(op)) removedOperations.push(op);
  }

  return {
    previousRunId: previous && previous.runId,
    currentRunId: current && current.runId,
    addedOperations,
    removedOperations,
    operationsDeltaCount: addedOperations.length + removedOperations.length,
    coverageDelta: Number((current && current.coverageRatio) || 0) - Number((previous && previous.coverageRatio) || 0)
  };
}

module.exports = {
  compareRuns
};

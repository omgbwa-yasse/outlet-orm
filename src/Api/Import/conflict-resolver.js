'use strict';

const PRECEDENCE = {
  reference: 3,
  endpoint: 3,
  canonical: 2,
  guide: 1,
  example: 1,
  unknown: 0
};

function getPrecedence(sourceType) {
  return PRECEDENCE[String(sourceType || 'unknown').toLowerCase()] || 0;
}

function resolveConflict(current, incoming) {
  if (!current) return { winner: incoming, loser: null, reason: 'no-existing-value' };
  if (!incoming) return { winner: current, loser: null, reason: 'no-incoming-value' };

  const cur = getPrecedence(current.sourceType);
  const inc = getPrecedence(incoming.sourceType);

  if (inc > cur) {
    return { winner: incoming, loser: current, reason: 'higher-source-precedence' };
  }

  if (inc < cur) {
    return { winner: current, loser: incoming, reason: 'higher-source-precedence' };
  }

  const curUrl = String(current.sourceUrl || '');
  const incUrl = String(incoming.sourceUrl || '');
  if (incUrl < curUrl) {
    return { winner: incoming, loser: current, reason: 'stable-url-order' };
  }

  return { winner: current, loser: incoming, reason: 'stable-url-order' };
}

module.exports = {
  resolveConflict
};

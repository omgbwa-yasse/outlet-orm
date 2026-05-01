'use strict';

const path = require('path');

function isHttpUrl(v) {
  return typeof v === 'string' && /^https?:\/\//i.test(v);
}

function normalizeUrl(raw, base) {
  const value = String(raw || '').trim();
  if (!value) return '';

  if (isHttpUrl(value)) {
    const u = new URL(value);
    u.hash = '';
    u.pathname = u.pathname.replace(/\/{2,}/g, '/');
    if (u.pathname.length > 1) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    return u.toString();
  }

  if (base && isHttpUrl(base)) {
    const u = new URL(value, base);
    u.hash = '';
    u.pathname = u.pathname.replace(/\/{2,}/g, '/');
    if (u.pathname.length > 1) {
      u.pathname = u.pathname.replace(/\/+$/, '');
    }
    return u.toString();
  }

  const abs = path.resolve(base ? path.dirname(base) : process.cwd(), value);
  return abs.replace(/[\\]+/g, '/');
}

function makeCanonical(url) {
  return normalizeUrl(url).toLowerCase();
}

function dedupeCanonical(urls) {
  const seen = new Set();
  const out = [];
  for (const item of urls || []) {
    const normalized = normalizeUrl(item);
    if (!normalized) continue;
    const canonical = makeCanonical(normalized);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push(normalized);
  }
  return out;
}

module.exports = {
  isHttpUrl,
  normalizeUrl,
  makeCanonical,
  dedupeCanonical
};

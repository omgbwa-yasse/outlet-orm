'use strict';

const fs = require('fs');
const path = require('path');
const { isHttpUrl, normalizeUrl, makeCanonical } = require('./url-normalizer');
const { createOfficialPage } = require('./domain');

function extractLinks(html, base) {
  const links = [];
  const re = /href\s*=\s*["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const href = m[1];
    if (!href || href.startsWith('mailto:') || href.startsWith('javascript:')) continue;
    links.push(normalizeUrl(href, base));
  }
  return links.filter(Boolean);
}

function isInScope(url, root, includeOfficialSubdomains) {
  if (!isHttpUrl(root.normalizedRootUri)) {
    return !isHttpUrl(url);
  }

  const base = new URL(root.normalizedRootUri);
  const target = new URL(url);
  if (target.hostname === base.hostname) return true;
  if (!includeOfficialSubdomains) return false;
  return target.hostname.endsWith('.' + base.hostname);
}

async function readPageContent(uri) {
  if (isHttpUrl(uri)) {
    const res = await globalThis.fetch(uri);
    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }
    return {
      text: await res.text(),
      contentType: String(res.headers.get('content-type') || '').toLowerCase()
    };
  }

  const text = fs.readFileSync(uri, 'utf8');
  const ext = path.extname(uri).toLowerCase();
  const contentType = ext === '.html' || ext === '.htm' ? 'text/html' : 'text/plain';
  return { text, contentType };
}

async function discoverOfficialPages(root, options) {
  const maxDepth = Number((options && options.maxDepth) || 4);
  const includeOfficialSubdomains = options && options.includeOfficialSubdomains !== false;
  const seed = normalizeUrl(root.normalizedRootUri);
  const queue = [{ url: seed, depth: 0, parent: null }];
  const seen = new Set();
  const pages = [];

  while (queue.length) {
    const current = queue.shift();
    const canonical = makeCanonical(current.url);
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    const authorityClass = (!isHttpUrl(seed) || new URL(current.url).hostname === new URL(seed).hostname)
      ? 'root-host'
      : 'official-subdomain';

    const page = createOfficialPage(root, current.url, current.depth, authorityClass, 'linked-from-reference-root', current.parent);
    pages.push(page);

    if (current.depth >= maxDepth) {
      page.status = 'ignored';
      continue;
    }

    try {
      const content = await readPageContent(current.url);
      page.status = 'fetched';
      page.fetchedAt = new Date().toISOString();

      if (!/text\/html/.test(content.contentType) && !/<html/i.test(content.text)) {
        page.status = 'processed';
        continue;
      }

      const links = extractLinks(content.text, current.url);
      for (const link of links) {
        if (!isInScope(link, root, includeOfficialSubdomains)) continue;
        queue.push({ url: link, depth: current.depth + 1, parent: current.url });
      }

      page.status = 'processed';
    } catch (err) {
      page.status = 'failed';
      page.errorSummary = String(err && err.message ? err.message : err);
    }
  }

  return pages;
}

module.exports = {
  discoverOfficialPages,
  extractLinks,
  isInScope
};

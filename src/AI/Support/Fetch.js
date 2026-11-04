'use strict';

/**
 * Fetch with a hard timeout. LLM providers must never leave a request hanging
 * forever: a stalled upstream would block the agent/worker indefinitely.
 *
 * @param {string|URL} url
 * @param {object} [options]
 * @param {number} [options.timeout] Timeout in ms (default: AI_TIMEOUT_MS or 60000)
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
  const timeoutMs = Number(
    options.timeout || process.env.AI_TIMEOUT_MS || 60000
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const { timeout, ...fetchOptions } = options;
  try {
    return await globalThis.fetch(url, {
      ...fetchOptions,
      signal: fetchOptions.signal || controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchWithTimeout };

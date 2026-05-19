/**
 * Environment detector for outlet-orm safety features.
 *
 * Per spec FR2 / research.md §6, the env is determined by (in order):
 *   1. `process.env.OUTLET_ENV` — explicit override.
 *   2. `process.env.NODE_ENV` mapped:
 *        'production' → 'production'
 *        'test'       → 'test'
 *        anything else (incl. 'development', undefined) → 'development'
 *   3. `process.env.CI === 'true'` → 'test'
 *   4. default → 'development'
 *
 * NOTE: We deliberately do NOT sniff database host/port. Hostname-based
 * production indicators are consumed by the production-confirmation gate
 * (warning banner enrichment only — see spec FR5/FR6).
 *
 * @returns {'development' | 'production' | 'test'}
 */
function detect() {
  const env = process.env || {};
  const explicit = env.OUTLET_ENV;
  if (explicit === 'production' || explicit === 'test' || explicit === 'development') {
    return explicit;
  }
  const nodeEnv = env.NODE_ENV;
  if (nodeEnv === 'production') return 'production';
  if (nodeEnv === 'test') return 'test';
  if (nodeEnv && nodeEnv !== 'development') {
    // Unknown NODE_ENV value → treat as development (safest dev-default).
    // Falls through to CI check.
  }
  if (env.CI === 'true') return 'test';
  return 'development';
}

module.exports = { detect };

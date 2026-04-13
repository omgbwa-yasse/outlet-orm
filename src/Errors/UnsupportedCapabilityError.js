'use strict';

/**
 * Thrown when a feature is not supported by the configured database driver.
 */
class UnsupportedCapabilityError extends Error {
  /**
   * @param {string} driver     - Canonical driver name (e.g. 'sqlite', 'mysql', 'postgres')
   * @param {string} capability - Human-readable capability description
   */
  constructor(driver, capability) {
    super(`The '${capability}' capability is not supported by the '${driver}' driver.`);
    this.name = 'UnsupportedCapabilityError';
    this.driver = driver;
    this.capability = capability;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnsupportedCapabilityError);
    }
  }
}

module.exports = { UnsupportedCapabilityError };

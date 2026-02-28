'use strict';

const os = require('os');
const ToolContract = require('../Contracts/ToolContract');

/**
 * SystemInfoTool
 * Built-in example tool returning system information.
 */
class SystemInfoTool extends ToolContract {
  name() { return 'system_info'; }
  description() { return 'Returns system information (node_version, platform, arch)'; }
  schema() { return { type: 'object', properties: {}, required: [] }; }

  execute(_args) {
    return JSON.stringify({
      node_version: process.version,
      platform: os.platform(),
      arch: os.arch(),
      uptime: os.uptime(),
    });
  }
}

module.exports = SystemInfoTool;

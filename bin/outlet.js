#!/usr/bin/env node

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const command = process.argv[2];
const subcommand = process.argv[3];
let args = process.argv.slice(3);

const commandMap = {
  init: 'init.js',
  convert: 'convert.js',
  migrate: 'migrate.js',
  reverse: 'reverse.js',
  mcp: 'mcp.js',
  'api import': 'api/import.js',
  'api-import': 'api/import.js',
  'api diff': 'api/diff.js',
  'api-diff': 'api/diff.js'
};

function printHelp() {
  console.log(`
outlet - Outlet ORM CLI

Usage:
  outlet <command> [args]

Commands:
  init                Project initialization
  convert             SQL to model converter
  migrate             Migration manager
  reverse             Database reverse engineering
  mcp                 Start MCP server
  api import          Import API models from docs/specs
  api diff            Compare API spec and generated models

Examples:
  outlet init
  outlet convert
  outlet migrate status
  outlet api import --spec openapi.json --output ./models
  outlet api diff --spec openapi.json --models ./models
`);
}

if (!command || command === '--help' || command === '-h' || command === 'help') {
  printHelp();
  process.exit(0);
}

let resolvedCommand = command;
if (command === 'api') {
  if (!subcommand || subcommand.startsWith('-')) {
    console.error('Missing API subcommand. Use: outlet api <import|diff>');
    printHelp();
    process.exit(1);
  }
  resolvedCommand = `api ${subcommand}`;
  args = process.argv.slice(4);
}

const targetScript = commandMap[resolvedCommand];
if (!targetScript) {
  console.error(`Unknown command: ${resolvedCommand}`);
  printHelp();
  process.exit(1);
}

const scriptPath = path.join(__dirname, targetScript);
const child = spawnSync(process.execPath, [scriptPath, ...args], { stdio: 'inherit' });

if (child.error) {
  console.error(child.error.message);
  process.exit(1);
}

process.exit(typeof child.status === 'number' ? child.status : 1);

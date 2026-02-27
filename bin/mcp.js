#!/usr/bin/env node

/**
 * outlet-mcp — MCP Server CLI entry point
 * Starts the Outlet ORM MCP server on stdio for AI agent integration.
 *
 * Usage:
 *   npx outlet-mcp                  # Start the MCP server
 *   npx outlet-mcp --project /path  # Start with custom project directory
 *   npx outlet-mcp --no-safety      # Disable AI safety guardrails
 *
 * @since 7.0.0
 */

const MCPServer = require('../src/AI/MCPServer');

// ─── Parse CLI flags ─────────────────────────────────────────────

const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--project' || arg === '-p') {
    options.projectDir = args[++i];
  } else if (arg === '--no-safety') {
    options.safetyGuardrails = false;
  } else if (arg === '--help' || arg === '-h') {
    console.error(`
outlet-mcp — Outlet ORM MCP Server

Usage:
  outlet-mcp [options]

Options:
  --project, -p <path>  Project root directory (default: cwd)
  --no-safety           Disable AI safety guardrails
  --help, -h            Show this help message

The server communicates over stdio using the Model Context Protocol (MCP).
It exposes tools for migrations, schema introspection, queries, seeds, and backups.

Documentation: https://github.com/omgbwa-yasse/outlet-orm/blob/main/docs/MCP.md
`);
    process.exit(0);
  }
}

// ─── Start ───────────────────────────────────────────────────────

const server = new MCPServer(options);

server.on('started', () => {
  process.stderr.write('[outlet-mcp] MCP server started on stdio\n');
});

server.on('initialized', () => {
  process.stderr.write('[outlet-mcp] Client connected and initialized\n');
});

server.on('close', async () => {
  process.stderr.write('[outlet-mcp] Shutting down...\n');
  await server.close();
  process.exit(0);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.close();
  process.exit(0);
});

server.start();

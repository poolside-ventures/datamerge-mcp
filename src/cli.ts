#!/usr/bin/env node

import { DataMergeMCPServer } from './mcp-server.js';

/**
 * CLI entry point for the DataMerge MCP server
 */
async function main(): Promise<void> {
  try {
    const server = new DataMergeMCPServer();
    await server.run();
  } catch (error) {
    console.error('Failed to start DataMerge MCP server:', error);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.error('DataMerge MCP server shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('DataMerge MCP server shutting down...');
  process.exit(0);
});

// Start the server
main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

#!/usr/bin/env node

import { createServer } from 'http';
import { DataMergeMCPStreamable } from './mcp-server-streamable.js';

const PORT = parseInt(process.env['PORT'] || '3000', 10);

async function main(): Promise<void> {
  const mcpServer = new DataMergeMCPStreamable();
  const app = mcpServer.createApp();

  const httpServer = createServer(app);

  httpServer.listen(PORT, () => {
    console.log(`DataMerge MCP Streamable HTTP server listening on port ${PORT}`);
    console.log(`\nEndpoints:`);
    console.log(`  POST /        → MCP client-to-server messages`);
    console.log(`  GET  /        → MCP server-to-client SSE stream`);
    console.log(`  DELETE /      → Terminate session`);
    console.log(`  GET  /health  → Health check`);
    console.log(
      `\nAuthentication: Use Authorization: Token <DATAMERGE_API_KEY> header or configure_datamerge tool`,
    );
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down MCP server...');
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('\nShutting down MCP server...');
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});


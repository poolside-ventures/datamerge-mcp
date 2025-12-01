#!/usr/bin/env node

// ESM-compatible functional test for the DataMerge MCP stdio server.
// This does NOT require any changes to the server itself.

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

class MCPTester {
  serverProcess = null;
  requestId = 1;

  async startServer() {
    console.log('🚀 Starting MCP server (stdio)...');

    this.serverProcess = spawn('node', ['dist/cli.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.setupResponseHandler();

    // Give the process a moment to boot
    await delay(500);

    // Initialization request (minimal capabilities; tools are allowed)
    const initRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
        },
        clientInfo: {
          name: 'local-test-client',
          version: '1.0.0',
        },
      },
    };

    console.log('📤 Sending initialize request...');
    this.send(initRequest);

    await delay(500);

    const initializedNotification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    };

    console.log('📤 Sending notifications/initialized...');
    this.send(initializedNotification);

    await delay(500);
  }

  send(msg) {
    const line = JSON.stringify(msg) + '\n';
    this.serverProcess.stdin.write(line, 'utf8');
  }

  async testListTools() {
    console.log('\n🔧 Requesting tools/list...');
    const req = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/list',
    };
    this.send(req);
    await delay(500);
  }

  async testHealthCheck() {
    console.log('\n🏥 Calling health_check tool...');
    const req = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name: 'health_check',
        arguments: {},
      },
    };
    this.send(req);
    await delay(1000);
  }

  async testStartEnrichment() {
    console.log('\n🏢 Calling start_company_enrichment for dealfront.com...');
    const req = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name: 'start_company_enrichment',
        arguments: {
          domain: 'dealfront.com',
        },
      },
    };
    this.send(req);
    await delay(1500);
  }

  setupResponseHandler() {
    this.serverProcess.stdout.on('data', (data) => {
      const lines = data
        .toString()
        .split('\n')
        .filter((line) => line.trim().length > 0);

      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          console.log('📥 MCP:', JSON.stringify(msg, null, 2));
        } catch {
          console.log('📥 MCP (raw):', line);
        }
      }
    });

    this.serverProcess.stderr.on('data', (data) => {
      process.stderr.write(`🔍 server stderr: ${data}`);
    });

    this.serverProcess.on('exit', (code) => {
      console.log(`🏁 MCP server exited with code ${code}`);
    });
  }

  async run() {
    try {
      await this.startServer();
      await this.testListTools();
      await this.testHealthCheck();
      await this.testStartEnrichment();
      console.log('\n✅ ESM MCP test script completed (check outputs above for auth + enrichment behavior).');
    } catch (err) {
      console.error('❌ ESM MCP test failed:', err);
    } finally {
      if (this.serverProcess) {
        console.log('\n🧹 Stopping MCP server...');
        this.serverProcess.kill();
      }
    }
  }
}

const tester = new MCPTester();
tester.run().catch((err) => {
  console.error('❌ Top-level test error:', err);
});



#!/usr/bin/env node

/**
 * Functional test script for the DataMerge MCP server
 * This script simulates MCP client requests to verify the server works correctly
 */

const { spawn } = require('child_process');
const { setTimeout } = require('timers/promises');

class MCPTester {
  constructor() {
    this.serverProcess = null;
    this.requestId = 1;
  }

  async startServer() {
    console.log('🚀 Starting MCP server...');

    this.serverProcess = spawn('node', ['dist/cli.js'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Wait a moment for server to start
    await setTimeout(1000);

    // Send initialization request
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
          name: 'test-client',
          version: '1.0.0',
        },
      },
    };

    console.log('📤 Sending initialization request...');
    this.sendRequest(initRequest);

    // Wait for response
    await setTimeout(1000);

    // Send initialized notification
    const initializedNotification = {
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    };

    console.log('📤 Sending initialized notification...');
    this.sendRequest(initializedNotification);

    await setTimeout(1000);
  }

  sendRequest(request) {
    const requestStr = JSON.stringify(request) + '\n';
    this.serverProcess.stdin.write(requestStr);
  }

  async testListTools() {
    console.log('\n🔧 Testing tools/list...');

    const listToolsRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/list',
    };

    this.sendRequest(listToolsRequest);
    await setTimeout(1000);
  }

  async testConfigureDataMerge() {
    console.log('\n⚙️ Testing configure_datamerge...');

    const configureRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name: 'configure_datamerge',
        arguments: {
          apiKey: 'test-api-key-123',
          baseUrl: 'https://api.datamerge.ai',
        },
      },
    };

    this.sendRequest(configureRequest);
    await setTimeout(1000);
  }

  async testHealthCheck() {
    console.log('\n🏥 Testing health_check...');

    const healthRequest = {
      jsonrpc: '2.0',
      id: this.requestId++,
      method: 'tools/call',
      params: {
        name: 'health_check',
        arguments: {},
      },
    };

    this.sendRequest(healthRequest);
    await setTimeout(1000);
  }

  setupResponseHandler() {
    this.serverProcess.stdout.on('data', (data) => {
      const lines = data
        .toString()
        .split('\n')
        .filter((line) => line.trim());

      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          console.log('📥 Response:', JSON.stringify(response, null, 2));
        } catch (e) {
          console.log('📥 Raw output:', line);
        }
      }
    });

    this.serverProcess.stderr.on('data', (data) => {
      console.log('🔍 Server log:', data.toString());
    });

    this.serverProcess.on('error', (error) => {
      console.error('❌ Server error:', error);
    });

    this.serverProcess.on('exit', (code) => {
      console.log(`🏁 Server exited with code ${code}`);
    });
  }

  async runTests() {
    try {
      await this.startServer();
      this.setupResponseHandler();

      await this.testListTools();
      await this.testConfigureDataMerge();
      await this.testHealthCheck();

      console.log('\n✅ All tests completed!');
    } catch (error) {
      console.error('❌ Test failed:', error);
    } finally {
      this.cleanup();
    }
  }

  cleanup() {
    if (this.serverProcess) {
      console.log('\n🧹 Cleaning up...');
      this.serverProcess.kill();
    }
  }
}

// Run the tests
const tester = new MCPTester();
tester.runTests().catch(console.error);

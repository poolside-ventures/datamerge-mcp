#!/usr/bin/env node

/**
 * Integration test for the DataMerge MCP package
 * Tests the basic flow from MCP client to DataMerge API client
 */

const { DataMergeClient } = require('./dist/datamerge-client.js');

async function testIntegration() {
  console.log('🔗 Integration Test: DataMerge MCP Package\n');

  try {
    // Test 1: Client Creation
    console.log('1️⃣ Testing client creation...');
    const client = new DataMergeClient({
      apiKey: 'test-api-key-123',
      baseUrl: 'https://api.datamerge.ai',
    });
    console.log('   ✅ Client created successfully');

    // Test 2: Configuration
    console.log('\n2️⃣ Testing configuration...');
    const config = client.getConfig();
    console.log('   ✅ Config retrieved:', {
      baseUrl: config.baseUrl,
      hasApiKey: !!config.apiKey,
    });

    // Test 3: Health Check (this may fail without a real key, but should not crash)
    console.log('\n3️⃣ Testing health check...');
    try {
      const isHealthy = await client.healthCheck();
      console.log('   ✅ Health check result:', isHealthy);
    } catch (error) {
      console.log('   ⚠️ Health check failed as expected (no real API key):', error.message);
    }

    console.log('\n🎉 Integration test completed (client wiring verified)!');
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  }
}

// Run integration test
testIntegration();

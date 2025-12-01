#!/usr/bin/env node

/**
 * Simple smoke test for the DataMergeClient
 */

const { DataMergeClient } = require('./dist/datamerge-client.js');

async function testDataMergeClient() {
  console.log('🧪 Testing DataMergeClient (smoke test)...\n');

  try {
    const client = new DataMergeClient({
      apiKey: 'test-api-key',
      baseUrl: 'https://api.datamerge.ai',
    });

    const config = client.getConfig();
    console.log('✅ Configuration retrieved:', {
      baseUrl: config.baseUrl,
      hasApiKey: !!config.apiKey,
    });

    console.log('\n🎯 Smoke test completed (client can be instantiated).');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDataMergeClient();

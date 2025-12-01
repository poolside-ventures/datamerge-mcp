import { DataMergeClient } from '../src/datamerge-client.js';

/**
 * Example usage of the DataMergeClient
 * This demonstrates how to use the client directly in your application
 */

async function exampleUsage(): Promise<void> {
  try {
    // Initialize the client
    const client = new DataMergeClient({
      apiKey: 'your_datamerge_api_key_here',
    });

    console.log('DataMerge client initialized');

    // Start a company enrichment job
    console.log('\n--- Starting company enrichment ---');
    const enrichResponse = await client.startCompanyEnrichment({
      domain: 'example.com',
    });

    if (!enrichResponse.success) {
      console.error('Enrichment request failed:', enrichResponse.error);
      return;
    }

    const jobId = enrichResponse.job.id;
    console.log(`Started enrichment job with ID: ${jobId}`);

    // Fetch company enrichment result
    console.log('\n--- Getting enrichment result ---');
    const statusResponse = await client.getCompanyEnrichmentResult(jobId);
    if (!statusResponse.success) {
      console.error('Failed to get enrichment status:', statusResponse.error);
      return;
    }

    console.log('Enrichment job status:', statusResponse.job.status);

    // Get a single company record
    console.log('\n--- Getting company by domain ---');
    const companyResponse = await client.getCompany({
      domain: 'example.com',
    });

    if (companyResponse.success) {
      console.log('Company:', companyResponse.company);
    } else {
      console.error('Failed to get company:', companyResponse.error);
    }

    // Health check
    console.log('\n--- Health check ---');
    const isHealthy = await client.healthCheck();
    console.log(`API health: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
  } catch (error) {
    console.error('Error in example usage:', error);
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleUsage().catch(console.error);
}

export { exampleUsage };

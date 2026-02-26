#!/usr/bin/env node
/**
 * Quick live test using DataMergeClient with an API key.
 * Usage: DATAMERGE_API_KEY=your_key node scripts/test-with-key.mjs
 */

import { DataMergeClient } from '../dist/datamerge-client.js';

const apiKey = process.env.DATAMERGE_API_KEY;
if (!apiKey) {
  console.error('Set DATAMERGE_API_KEY to run this test.');
  process.exit(1);
}

async function main() {
  const client = new DataMergeClient({ apiKey });
  console.log('Testing DataMerge API with provided key...\n');

  try {
    // 1. Health check
    console.log('1. Health check (/auth/info)...');
    const healthy = await client.healthCheck();
    console.log(healthy ? '   ✅ OK' : '   ❌ Failed');
    if (!healthy) process.exit(1);

    // 2. Credits balance (may 404 on some plans)
    console.log('\n2. Credits balance (GET /v1/credits/balance)...');
    const credits = await client.getCreditsBalance();
    if (credits.success && !('error' in credits)) {
      console.log('   ✅ Balance:', credits.credits_balance);
      if (credits.balances) console.log('   Balances:', JSON.stringify(credits.balances));
    } else {
      console.log('   ⚠️', 'error' in credits ? credits.error : 'Unknown error', '(non-fatal)');
    }

    // 3. List lists (new endpoint)
    console.log('\n3. List lists (GET /v1/lists)...');
    const listsResult = await client.listLists();
    if (listsResult.success && listsResult.lists) {
      console.log('   ✅ Lists count:', listsResult.lists.length);
      if (listsResult.lists.length > 0) {
        console.log('   First:', listsResult.lists[0].name, `(${listsResult.lists[0].object_type})`);
      }
    } else {
      console.log('   ⚠️', listsResult.error || 'No lists');
    }

    // 4. Start company enrichment and poll once (tests POST enrich + GET status path)
    console.log('\n4. Start company enrichment (POST /v1/company/enrich) + get status...');
    const startRes = await client.startCompanyEnrichment({ domain: 'stripe.com' });
    if (!startRes.success || !startRes.job) {
      console.log('   ⚠️ Start failed:', 'error' in startRes ? startRes.error : 'No job');
    } else {
      console.log('   ✅ Job started:', startRes.job.id, 'status:', startRes.job.status);
      const statusRes = await client.getCompanyEnrichmentResult(startRes.job.id);
      if (statusRes.success && statusRes.job) {
        console.log('   ✅ Status:', statusRes.job.status);
        if (statusRes.job.results?.length) {
          console.log('   Results:', statusRes.job.results.length, 'company(ies)');
        }
      } else {
        console.log('   ⚠️ Status failed:', 'error' in statusRes ? statusRes.error : '');
      }
    }

    console.log('\n✅ All client tests completed.');
  } catch (err) {
    console.error('\n❌ Test failed:', err.message);
    if (err.response?.data) console.error('   API response:', err.response.data);
    process.exit(1);
  }
}

main();

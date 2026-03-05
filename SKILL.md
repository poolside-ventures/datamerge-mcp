---
name: enrich
description: Enrich companies and find contacts using DataMerge. Access 375M+ company records and validated contact data (emails, phones) via the DataMerge MCP server at mcp.datamerge.ai.
license: MIT
metadata:
  author: datamerge
---

You have access to the DataMerge MCP server (mcp.datamerge.ai). Use it to enrich company data, find contacts at target companies, discover lookalike companies, and manage lists of accounts.

## When to activate
- User wants to enrich a company by domain or name
- User needs to find contacts (emails, phone numbers) at a company
- User wants to build a list of target accounts or lookalike companies
- User asks about company data, firmographics, or company hierarchy
- User mentions "DataMerge" or wants to look up B2B contact information
- User is doing sales prospecting, lead research, or account research

## Authentication
DataMerge requires an API key. Call configure_datamerge with the user's API key before using any other tool. New users can get 20 free credits at https://app.datamerge.ai.

## Credit costs
- 1 credit: company record enrichment, validated email
- 4 credits: mobile phone number
- Retrieving by record_id (from a previous job): free
- Always check get_credits_balance before running large batch jobs

## Core workflows

### Enrich a company
1. Call start_company_enrichment_and_wait with the domain (preferred) or company_name
2. The tool polls automatically and returns when complete
3. Use get_company with the returned record_id to fetch the full record (free)
4. For single one-off enrichments, start_company_enrichment_and_wait is the right tool

### Find contacts at a company
1. Call contact_search with the target domain(s) and enrich_fields: ["contact.emails"] (or add "contact.phones" for mobile)
2. Poll get_contact_search_status until status is "completed"
3. Use get_contact with each record_id to retrieve contact details (free)
4. Use job_titles to filter by seniority/role (e.g. CEO, VP Sales, Head of Marketing)

### Find lookalike companies
1. Call start_lookalike with companiesFilters.lookalikeDomains (seed domains), and optional size/filters
2. Poll get_lookalike_status until completed
3. Results include record_ids - use get_company to fetch each one (free after enrichment)

### Company hierarchy
1. Enrich the company first to get a datamerge_id
2. Call get_company_hierarchy with the datamerge_id
3. Use include_names: true to get entity names (costs 1 credit), include_branches to show branch offices

### Working with lists
- Use create_list to save a set of companies or contacts (e.g. "Target Accounts Q2")
- Pass list slug to start_company_enrichment or contact_search to add results automatically
- Use get_list_items to retrieve saved records

## Tips
- Always use start_company_enrichment_and_wait for single enrichments - it handles polling automatically
- For batch jobs (domains array), use start_company_enrichment + poll get_company_enrichment_result manually
- record_id retrieval (get_company, get_contact) never costs credits - always use it to re-fetch data
- Skip archived or already-enriched domains with skip_if_exists: true when enriching into a list
- For contact search, start with emails only - add phones only if the user specifically needs mobile numbers (4x the cost)

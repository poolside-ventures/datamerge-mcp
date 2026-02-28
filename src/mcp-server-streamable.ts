import express, { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { DataMergeClient } from './datamerge-client.js';
import { InMemoryEventStore } from './in-memory-event-store.js';

/**
 * Streamable HTTP MCP Server implementation for the DataMerge Company API
 */
export class DataMergeMCPStreamable {
  private server: McpServer;
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();
  private clients: Map<string, DataMergeClient> = new Map();
  private apiKeys: Map<string, string> = new Map(); // Store API keys per session

  constructor() {
    this.server = new McpServer({
      name: 'datamerge-mcp',
      version: '1.0.0',
      title: 'DataMerge MCP',
      description: 'DataMerge MCP Server for company enrichment and hierarchy',
      websiteUrl: 'https://www.datamerge.ai',
      icons: [
        { src: 'https://www.datamerge.ai/favicon.ico', sizes: ['any'] },
      ],
    });

    this.setupToolHandlers();
    this.setupPromptHandlers();
  }

  private setupPromptHandlers(): void {
    this.server.registerPrompt(
      'enrich_company_workflow',
      {
        title: 'Enrich Company Workflow',
        description: 'Step-by-step prompt for enriching companies by domain using DataMerge.',
        argsSchema: {
          domain: z.string().optional().describe('Company domain to enrich (e.g. example.com).'),
        },
      },
      async (args) => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `To enrich a company with DataMerge:
1. Call configure_datamerge with your API key if not already set.
2. For a single domain: use start_company_enrichment_and_wait with domain: "${args?.domain ?? 'example.com'}" to start and wait for the result.
3. Or use start_company_enrichment to get a job_id, then poll get_company_enrichment_result until status is "completed".
4. Use get_company with the returned record_id to fetch the full company record (free).

Credits: 1 credit per company. Get 20 free at https://app.datamerge.ai`,
            },
          },
        ],
      }),
    );
    this.server.registerPrompt(
      'datamerge_quickstart',
      {
        title: 'DataMerge Quick Start',
        description: 'Quick reference for connecting and using the DataMerge MCP server.',
        argsSchema: {},
      },
      async () => ({
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `DataMerge MCP Quick Start:
• Auth: Use configure_datamerge with your API key, or set Authorization: Bearer YOUR_KEY when connecting.
• Enrich company: start_company_enrichment_and_wait({ domain: "example.com" })
• Get company: get_company({ record_id: "uuid-from-enrichment" }) — free, no credit
• Hierarchy: get_company_hierarchy({ datamerge_id: "DM001..." })
• Contacts: contact_search({ domains: ["example.com"], enrich_fields: ["contact.emails"] })
• Credits: get_credits_balance()
Docs: https://www.datamerge.ai/docs/llms.txt`,
            },
          },
        ],
      }),
    );
  }

  private setupToolHandlers(): void {
    // Configure DataMerge authentication tool
    this.server.registerTool(
      'configure_datamerge',
      {
        title: 'Configure DataMerge Authentication',
        description:
          'Configure DataMerge API authentication (required before using other tools if DATAMERGE_API_KEY is not set).',
        inputSchema: {
          apiKey: z.string().optional().describe('DataMerge API key. Get one at https://app.datamerge.ai (20 free credits).'),
          baseUrl: z.string().optional().describe('Optional custom API base URL (default: https://api.datamerge.ai).'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      },
      async ({ apiKey, baseUrl }, extra) => {
        console.log(`🔧 configure_datamerge called: sessionId=${extra.sessionId}, hasApiKey=${!!apiKey}, hasBaseUrl=${!!baseUrl}`);
        
        if (!extra.sessionId) {
          console.error('❌ configure_datamerge called without sessionId');
          throw new Error('Session ID is required');
        }
      
        const key = apiKey ?? process.env['DATAMERGE_API_KEY'];
        if (!key) {
          console.error(`❌ configure_datamerge: No API key provided and no DATAMERGE_API_KEY env var`);
          throw new Error(
            'apiKey is required. Provide it as an argument or set DATAMERGE_API_KEY.',
          );
        }

        console.log(`✅ configure_datamerge: Creating client for session ${extra.sessionId}`);
        // Store the API key for this session
        this.apiKeys.set(extra.sessionId, key);
        const client = new DataMergeClient({ apiKey: key, baseUrl });
        this.clients.set(extra.sessionId, client);
        console.log(`✅ configure_datamerge: Client configured successfully for session ${extra.sessionId}`);

        return {
          content: [
            {
              type: 'text',
              text: 'DataMerge client configured successfully for this session.',
            },
          ],
        };
      },
    );

    // Start company enrichment
    this.server.registerTool(
      'start_company_enrichment',
      {
        title: 'Start Company Enrichment',
        description:
          'POST /v1/company/enrich. Enrich one or more companies by domain. Returns a job_id (async). Single: domain. Batch: domains, country_code, global_ultimate, list, skip_if_exists.',
        inputSchema: {
          domain: z.string().optional().describe('Company website domain (e.g. example.com).'),
          company_name: z
            .string()
            .optional()
            .describe('Company name (used when domain is not available).'),
          country_code: z
            .string()
            .optional()
            .describe('Optional ISO 2-letter country code to improve matching.'),
          strict_match: z
            .boolean()
            .optional()
            .describe('When true, require a strict match for enrichment.'),
          global_ultimate: z
            .boolean()
            .optional()
            .describe('When true, always return the global ultimate parent.'),
          webhook_url: z
            .string()
            .optional()
            .describe('Optional webhook URL to receive job completion notifications.'),
          domains: z.array(z.string()).optional().describe('Batch: multiple domains to enrich.'),
          list: z.string().optional().describe('List slug to add enriched companies to.'),
          skip_if_exists: z.boolean().optional().describe('When true, skip domains that are already in the list.'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      async (args, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        const response = await client.startCompanyEnrichment(args ?? {});

        if (!response.success) {
          const errorMessage =
            'error' in response && typeof (response as any).error === 'string'
              ? (response as any).error
              : 'Unknown error from DataMerge';
          return {
            content: [
              {
                type: 'text',
                text: `DataMerge enrichment request failed: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }

        const job = response.job;
      return {
        content: [
          {
            type: 'text',
              text: `Started DataMerge enrichment job.\n\nJob ID: ${job.id}\nStatus: ${job.status}`,
          },
        ],
      };
      },
    );

    // Get company enrichment result
    this.server.registerTool(
      'get_company_enrichment_result',
      {
        title: 'Get Company Enrichment Result',
        description:
          'GET /v1/company/enrich/{job_id}/status. Poll until status is "completed" or "failed". Response includes record_ids. Status values: queued · processing · completed · failed.',
        inputSchema: {
          job_id: z.string().describe('The enrichment job ID returned by start_company_enrichment. Poll until status is "completed" or "failed".'),
        },
        annotations: { readOnlyHint: true },
      },
      async ({ job_id }, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        if (!job_id) {
          throw new Error('job_id is required');
        }

        const response = await client.getCompanyEnrichmentResult(job_id);

        if (!response.success) {
          const errorMessage =
            'error' in response && typeof (response as any).error === 'string'
              ? (response as any).error
              : 'Unknown error from DataMerge';
          return {
            content: [
              {
                type: 'text',
                text: `Failed to fetch enrichment status: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }

        const job = response.job;
        
        // Return full job data as JSON including all results
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(job, null, 2),
            },
          ],
        };
      },
    );

    // Start company enrichment and wait for completion
    this.server.registerTool(
      'start_company_enrichment_and_wait',
      {
        title: 'Start Company Enrichment and Wait',
        description:
          'POST /v1/company/enrich then poll GET /v1/company/enrich/{job_id}/status until status is "completed" or "failed" or timeout. Same params as start_company_enrichment plus poll_interval_seconds and timeout_seconds.',
      inputSchema: {
          domain: z.string().optional().describe('Company website domain (e.g. example.com).'),
          company_name: z
            .string()
            .optional()
            .describe('Company name (used when domain is not available).'),
          country_code: z
            .string()
            .optional()
            .describe('Optional ISO 2-letter country code to improve matching.'),
          strict_match: z
            .boolean()
            .optional()
            .describe('When true, require a strict match for enrichment.'),
          global_ultimate: z
            .boolean()
            .optional()
            .describe('When true, always return the global ultimate parent.'),
          webhook_url: z
            .string()
            .optional()
            .describe('Optional webhook URL to receive job completion notifications.'),
          poll_interval_seconds: z
            .number()
            .optional()
            .describe('How often to poll the job status (in seconds). Defaults to 5 seconds.'),
          timeout_seconds: z
            .number()
            .optional()
            .describe('Maximum time to wait for completion (in seconds). Defaults to 60 seconds.'),
          domains: z.array(z.string()).optional().describe('Batch: multiple domains to enrich in one job.'),
          list: z.string().optional().describe('List slug to add enriched companies to.'),
          skip_if_exists: z.boolean().optional().describe('When true, skip domains already in the list.'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      async (args, extra) => {
        const client = this.getClientForSession(extra.sessionId);

        const {
          poll_interval_seconds,
          timeout_seconds,
          ...enrichArgs
        } = args ?? {};

        const pollIntervalMs =
          typeof poll_interval_seconds === 'number' && poll_interval_seconds > 0
            ? poll_interval_seconds * 1000
            : 5000;

        const timeoutMs =
          typeof timeout_seconds === 'number' && timeout_seconds > 0
            ? timeout_seconds * 1000
            : 60000;

        const startResponse = await client.startCompanyEnrichment(enrichArgs);

        if (!startResponse.success) {
          const errorMessage =
            'error' in startResponse && typeof (startResponse as any).error === 'string'
              ? (startResponse as any).error
              : 'Unknown error from DataMerge';
          return {
            content: [
              {
                type: 'text',
                text: `DataMerge enrichment request failed: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }

        const jobId = startResponse.job.id;
        const startedAt = Date.now();

        // Poll until completion or timeout
        while (Date.now() - startedAt < timeoutMs) {
          await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

          const statusResponse = await client.getCompanyEnrichmentResult(jobId);
          if (!statusResponse.success) {
            const errorMessage =
              'error' in statusResponse && typeof (statusResponse as any).error === 'string'
                ? (statusResponse as any).error
                : 'Unknown error from DataMerge';
            return {
              content: [
                {
                  type: 'text',
                  text: `Failed while polling enrichment status: ${errorMessage}`,
                },
              ],
              isError: true,
            };
          }

          const job = statusResponse.job;
          const status = (job.status || '').toLowerCase();
          const firstResult = job.results?.[0];

          const isCompleted =
            status === 'completed' ||
            status === 'succeeded' ||
            status === 'finished' ||
            !!firstResult;

          const isFailed =
            status === 'failed' ||
            status === 'error' ||
            status === 'errored' ||
            status === 'cancelled';

          if (isCompleted) {
            // Return company data inline: use job.results if populated, else fetch by record_id so agent gets data without calling get_company
            const companies: unknown[] = [];
            if (job.results?.length) {
              companies.push(...job.results);
            }
            const recordIds = (job as any).record_ids as string[] | undefined;
            if (recordIds?.length && companies.length === 0) {
              for (const recordId of recordIds) {
                const getRes = await client.getCompany({ record_id: recordId });
                if (getRes.success && 'company' in getRes && getRes.company) {
                  companies.push(getRes.company);
                }
              }
            }
            const payload = {
              status: job.status,
              job_id: job.id,
              record_ids: recordIds ?? (job as any).record_ids,
              companies: companies.length ? companies : (job.results ?? []),
            };
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(payload, null, 2),
                },
              ],
            };
          }

          if (isFailed) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Enrichment job failed.\n\nJob ID: ${job.id}\nStatus: ${job.status}`,
                },
              ],
              isError: true,
            };
          }
        }

        // Timed out
      return {
        content: [
          {
            type: 'text',
              text: `Timed out waiting for enrichment job to complete after ${
                Math.round(timeoutMs / 1000)
              } seconds.\n\nJob ID: ${jobId}\nYou can continue polling using get_company_enrichment_result.`,
          },
        ],
      };
      },
    );

    // Get company — doc: provide either datamerge_id or record_id. Not both. Optional add_to_list (only with datamerge_id).
    this.server.registerTool(
      'get_company',
      {
        title: 'Get Company',
        description:
          'Get a single company record. GET /v1/company/get?datamerge_id={id} or ?record_id={uuid}. Provide either datamerge_id (charges 1 credit) or record_id (free). Not both. Optional: add_to_list — list slug to add the company to (only with datamerge_id).',
      inputSchema: {
          datamerge_id: z.string().optional().describe('DataMerge company ID. Charges 1 credit.'),
          record_id: z.string().optional().describe('Your record UUID from a previous enrichment. Does not consume credits.'),
          add_to_list: z.string().optional().describe('List slug to add the company to. Only valid when using datamerge_id.'),
        },
        annotations: { readOnlyHint: true },
      },
      async (args, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        const response = await client.getCompany((args ?? {}) as import('./types.js').CompanyGetParamsV1);

        if (!response.success) {
          const errorMessage =
            'error' in response && typeof (response as any).error === 'string'
              ? (response as any).error
              : 'Unknown error from DataMerge';
          return {
            content: [
              {
                type: 'text',
                text: `Failed to fetch company: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }

        const company = response.company;
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(company, null, 2),
          },
        ],
      };
      },
    );

    // Get company hierarchy — doc: GET /v1/company/hierarchy?datamerge_id={id}. Optional: include_names, include_branches, only_subsidiaries, max_level, country_code (array), page.
    this.server.registerTool(
      'get_company_hierarchy',
      {
        title: 'Get Company Hierarchy',
        description:
          'Get all entities in the same global ultimate hierarchy. GET /v1/company/hierarchy?datamerge_id={id}. Parameters: include_names (bool, charges 1 credit), include_branches (bool), only_subsidiaries (bool), max_level (int), country_code (array), page (int).',
      inputSchema: {
          datamerge_id: z.string().min(1).describe('DataMerge company ID. Required.'),
          include_names: z.boolean().optional().describe('Include entity names. Charges 1 credit.'),
          include_branches: z.boolean().optional().describe('Include branch entities.'),
          only_subsidiaries: z.boolean().optional().describe('Return only subsidiaries.'),
          max_level: z.number().int().optional().describe('Maximum hierarchy depth.'),
          country_code: z.array(z.string()).optional().describe('Filter entities by ISO 2-letter country code(s).'),
          page: z.number().int().optional().describe('Page number for paginated results (1-based).'),
        },
        annotations: { readOnlyHint: true },
      },
      async (args, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        const a = args as {
          datamerge_id: string;
          include_names?: boolean;
          include_branches?: boolean;
          only_subsidiaries?: boolean;
          max_level?: number;
          country_code?: string[];
          page?: number;
        };
        const params: import('./types.js').CompanyHierarchyParamsV1 = {
          datamerge_id: a.datamerge_id,
        };
        if (a.include_names !== undefined) params.include_names = a.include_names;
        if (a.include_branches !== undefined) params.include_branches = a.include_branches;
        if (a.only_subsidiaries !== undefined) params.only_subsidiaries = a.only_subsidiaries;
        if (a.max_level !== undefined) params.max_level = a.max_level;
        if (a.country_code !== undefined) params.country_code = a.country_code;
        if (a.page !== undefined) params.page = a.page;
        const response = await client.getCompanyHierarchy(params);

        if (!response.success) {
          const errorMessage =
            'error' in response && typeof (response as any).error === 'string'
              ? (response as any).error
              : 'Unknown error from DataMerge';
          return {
            content: [
              {
                type: 'text',
                text: `Failed to fetch company hierarchy: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }

        const { company, parents = [], children = [], results, total_count, results_count } = response as {
          company: unknown;
          parents?: unknown[];
          children?: unknown[];
          results?: unknown[];
          total_count?: number;
          results_count?: number;
        };
        const payload = { company, parents, children };
        if (Array.isArray(results)) (payload as any).results = results;
        if (total_count != null) (payload as any).total_count = total_count;
        if (results_count != null) (payload as any).results_count = results_count;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(payload, null, 2),
            },
          ],
        };
      },
    );

    // Lookalike
    this.server.registerTool(
      'start_lookalike',
      {
        title: 'Start Lookalike',
        description: 'POST /v1/company/lookalike. Find similar companies using seed domains. Returns a job_id (async, 202). Poll GET /v1/company/lookalike/{job_id}/status until completed or failed.',
        inputSchema: {
          companiesFilters: z.record(z.any()).describe('Filters object: lookalikeDomains (seed domains), primaryLocations, companySizes, revenues, yearFounded.'),
          size: z.number().optional().describe('Maximum number of lookalike companies to return (e.g. 50).'),
          list: z.string().optional().describe('List slug to add results to.'),
          exclude_all: z.boolean().optional().describe('When true, exclude companies already in the list.'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      async (args, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        const response = await client.startLookalike((args ?? {}) as import('./types.js').LookalikeRequestV1);
        if (!response.success || 'error' in response) {
          return {
            content: [{ type: 'text', text: `Lookalike failed: ${(response as any).error}` }],
            isError: true,
          };
        }
        const r = response as { job_id: string; status: string; message?: string };
        return {
          content: [
            { type: 'text', text: `Started lookalike job.\n\nJob ID: ${r.job_id}\nStatus: ${r.status}${r.message ? `\n${r.message}` : ''}` },
          ],
        };
      },
    );

    this.server.registerTool(
      'get_lookalike_status',
      {
        title: 'Get Lookalike Status',
        description: 'GET /v1/company/lookalike/{job_id}/status. Poll until status is "completed" or "failed". Response includes record_ids.',
        inputSchema: { job_id: z.string().describe('The lookalike job ID returned by start_lookalike. Poll until status is "completed" or "failed".') },
        annotations: { readOnlyHint: true },
      },
      async ({ job_id }, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        if (!job_id) throw new Error('job_id is required');
        const response = await client.getLookalikeStatus(job_id);
        if (!response.success || 'error' in response) {
          return {
            content: [{ type: 'text', text: `Failed: ${(response as any).error}` }],
            isError: true,
          };
        }
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      },
    );

    // Contact search
    this.server.registerTool(
      'contact_search',
      {
        title: 'Contact Search',
        description: 'POST /v1/contact/search. Search for contacts at specified companies. Returns a job_id (async, 202). enrich_fields required (at least one of contact.emails or contact.phones). Use company_list (slug) instead of domains to search a saved list.',
        inputSchema: {
          domains: z.array(z.string()).optional().describe('Company domains to search.'),
          company_list: z.string().optional().describe('List slug instead of domains.'),
          max_results_per_company: z.number().optional().describe('Max contacts per company.'),
          job_titles: z.record(z.any()).optional().describe('Priority tiers: include: { "1": ["CEO"], "2": ["VP Sales"] }, exclude: ["Intern"].'),
          location: z.record(z.any()).optional().describe('Location filters: include/exclude with type and value (country, region, city).'),
          enrich_fields: z.array(z.string()).describe('At least one of "contact.emails" or "contact.phones". Each email costs 1 credit; phone 4 credits.'),
          webhook: z.string().optional().describe('Optional webhook URL to notify when the job completes.'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      async (args, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        const response = await client.contactSearch((args ?? {}) as import('./types.js').ContactSearchRequestV1);
        if (!response.success || 'error' in response) {
          return {
            content: [{ type: 'text', text: `Contact search failed: ${(response as any).error}` }],
            isError: true,
          };
        }
        const r = response as { job_id: string; status: string };
        return {
          content: [{ type: 'text', text: `Started contact search.\n\nJob ID: ${r.job_id}\nStatus: ${r.status}` }],
        };
      },
    );

    this.server.registerTool(
      'get_contact_search_status',
      {
        title: 'Get Contact Search Status',
        description: 'GET /v1/contact/search/{job_id}/status. Poll until status is "completed" or "failed". Response includes record_ids.',
        inputSchema: { job_id: z.string().describe('The contact search job ID returned by contact_search. Poll until status is "completed" or "failed".') },
        annotations: { readOnlyHint: true },
      },
      async ({ job_id }, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        if (!job_id) throw new Error('job_id is required');
        const response = await client.getContactSearchStatus(job_id);
        if (!response.success || 'error' in response) {
          return { content: [{ type: 'text', text: `Failed: ${(response as any).error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      },
    );

    // Contact enrich
    this.server.registerTool(
      'contact_enrich',
      {
        title: 'Contact Enrich',
        description: 'POST /v1/contact/enrich. Enrich specific contacts by LinkedIn URL or name+domain. Returns a job_id (async, 202).',
        inputSchema: {
          contacts: z.array(z.record(z.any())).describe('Array of contacts: either { linkedin_url } or { firstname, lastname, domain }.'),
          enrich_fields: z.array(z.string()).describe('Fields to enrich, e.g. ["contact.emails", "contact.phones"].'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      async (args, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        const response = await client.contactEnrich((args ?? {}) as import('./types.js').ContactEnrichRequestV1);
        if (!response.success || 'error' in response) {
          return {
            content: [{ type: 'text', text: `Contact enrich failed: ${(response as any).error}` }],
            isError: true,
          };
        }
        const r = response as { job_id: string; status: string };
        return {
          content: [{ type: 'text', text: `Started contact enrichment.\n\nJob ID: ${r.job_id}\nStatus: ${r.status}` }],
        };
      },
    );

    this.server.registerTool(
      'get_contact_enrich_status',
      {
        title: 'Get Contact Enrich Status',
        description: 'GET /v1/contact/enrich/{job_id}/status. Poll until status is "completed" or "failed". Response includes record_ids.',
        inputSchema: { job_id: z.string().describe('The contact enrich job ID returned by contact_enrich. Poll until status is "completed" or "failed".') },
        annotations: { readOnlyHint: true },
      },
      async ({ job_id }, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        if (!job_id) throw new Error('job_id is required');
        const response = await client.getContactEnrichStatus(job_id);
        if (!response.success || 'error' in response) {
          return { content: [{ type: 'text', text: `Failed: ${(response as any).error}` }], isError: true };
        }
        return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
      },
    );

    this.server.registerTool(
      'get_contact',
      {
        title: 'Get Contact',
        description: 'GET /v1/contact/get?record_id={uuid}. Retrieve a specific contact by record UUID. Never charges credits.',
        inputSchema: { record_id: z.string().describe('Contact record UUID from a previous contact_search or contact_enrich job. Does not consume credits.') },
        annotations: { readOnlyHint: true },
      },
      async ({ record_id }, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        if (!record_id) throw new Error('record_id is required');
        const response = await client.getContact(record_id);
        if (!response.success || 'error' in response) {
          return {
            content: [{ type: 'text', text: `Failed to get contact: ${(response as any).error}` }],
            isError: true,
          };
        }
        const rec = (response as any).record ?? (response as any).contact;
        return { content: [{ type: 'text', text: JSON.stringify(rec ?? response, null, 2) }] };
      },
    );

    // Lists
    this.server.registerTool(
      'list_lists',
      {
        title: 'List Lists',
        description: 'GET /v1/lists. Optional: object_type=company or object_type=contact.',
        inputSchema: {
          object_type: z.enum(['company', 'contact']).optional().describe('Filter lists by object type: company or contact.'),
        },
        annotations: { readOnlyHint: true },
      },
      async (args, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        const objectType = args?.object_type as 'company' | 'contact' | undefined;
        const result = await client.listLists(objectType);
        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to list lists: ${result.error}` }],
            isError: true,
          };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.lists ?? [], null, 2) }] };
      },
    );

    this.server.registerTool(
      'create_list',
      {
        title: 'Create List',
        description: 'POST /v1/lists. Body: name, object_type (company or contact).',
        inputSchema: {
          name: z.string().describe('Display name for the new list.'),
          object_type: z.enum(['company', 'contact']).describe('Whether the list holds company or contact records.'),
        },
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
      },
      async (args, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        const response = await client.createList(args ?? {});
        if (!response.success) {
          return {
            content: [{ type: 'text', text: `Failed to create list: ${response.error}` }],
            isError: true,
          };
        }
        return { content: [{ type: 'text', text: JSON.stringify(response.list ?? response, null, 2) }] };
      },
    );

    this.server.registerTool(
      'get_list_items',
      {
        title: 'Get List Items',
        description: 'GET /v1/lists/{object_type}/{list_slug}. object_type: company or contact. list_slug: e.g. target-accounts. Parameters: page, page_size (max 100), sort_by, sort_order (asc/desc).',
        inputSchema: {
          object_type: z.enum(['company', 'contact']).describe('Type of list: company or contact.'),
          list_slug: z.string().describe('URL-safe list identifier (e.g. target-accounts).'),
          page: z.number().optional().describe('Page number for pagination (1-based).'),
          page_size: z.number().optional().describe('Items per page (max 100).'),
          sort_by: z.string().optional().describe('Field name to sort by.'),
          sort_order: z.enum(['asc', 'desc']).optional().describe('Sort direction: asc or desc.'),
        },
        annotations: { readOnlyHint: true },
      },
      async (args, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        const objectType = args?.object_type as 'company' | 'contact';
        const listSlug = args?.list_slug as string;
        if (!objectType || !listSlug) throw new Error('object_type and list_slug are required');
        let params: import('./types.js').ListItemsParamsV1 | undefined;
        if (
          args?.page != null ||
          args?.page_size != null ||
          args?.sort_by != null ||
          args?.sort_order != null
        ) {
          params = {};
          if (args?.page != null) params.page = args.page;
          if (args?.page_size != null) params.page_size = args.page_size;
          if (args?.sort_by != null) params.sort_by = args.sort_by;
          if (args?.sort_order != null) params.sort_order = args.sort_order;
        }
        const result = await client.getListItems(objectType, listSlug, params);
        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to get list items: ${result.error}` }],
            isError: true,
          };
        }
        return { content: [{ type: 'text', text: JSON.stringify(result.items ?? [], null, 2) }] };
      },
    );

    this.server.registerTool(
      'remove_list_item',
      {
        title: 'Remove List Item',
        description: 'DELETE /v1/lists/{object_type}/{list_slug}/{item_id}.',
        inputSchema: {
          object_type: z.enum(['company', 'contact']).describe('Type of list: company or contact.'),
          list_slug: z.string().describe('List slug containing the item.'),
          item_id: z.string().describe('Record UUID of the company or contact to remove from the list.'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      },
      async (args, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        const objectType = args?.object_type as 'company' | 'contact';
        const listSlug = args?.list_slug as string;
        const itemId = args?.item_id as string;
        if (!objectType || !listSlug || !itemId) throw new Error('object_type, list_slug, and item_id are required');
        const result = await client.removeListItem(objectType, listSlug, itemId);
        if (!result.success) {
          return {
            content: [{ type: 'text', text: `Failed to remove item: ${result.error}` }],
            isError: true,
          };
        }
        return { content: [{ type: 'text', text: 'Item removed from list.' }] };
      },
    );

    this.server.registerTool(
      'delete_list',
      {
        title: 'Delete List',
        description: 'DELETE /v1/lists/{object_type}/{list_slug}. System lists cannot be deleted.',
        inputSchema: {
          object_type: z.enum(['company', 'contact']).describe('Type of list: company or contact.'),
          list_slug: z.string().describe('List slug of the list to delete. System lists cannot be deleted.'),
        },
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
      },
      async (args, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        const objectType = args?.object_type as 'company' | 'contact';
        const listSlug = args?.list_slug as string;
        if (!objectType || !listSlug) throw new Error('object_type and list_slug are required');
        try {
          await client.deleteList(objectType, listSlug);
          return { content: [{ type: 'text', text: 'List deleted.' }] };
        } catch (err: any) {
          return {
            content: [{ type: 'text', text: `Failed to delete list: ${err?.message ?? String(err)}` }],
            isError: true,
          };
        }
      },
    );

    this.server.registerTool(
      'get_credits_balance',
      {
        title: 'Get Credits Balance',
        description: 'GET /v1/credits/balance. Returns credits_balance and balances (one_off, recurring, rollover, total).',
        inputSchema: {
          _: z.string().optional().describe('This tool takes no required parameters. Call with no arguments.'),
        },
        annotations: { readOnlyHint: true },
      },
      async (_, extra) => {
        const client = this.getClientForSession(extra.sessionId);
        const response = await client.getCreditsBalance();
        if (!response.success || 'error' in response) {
          return {
            content: [{ type: 'text', text: `Failed to get credits: ${(response as any).error}` }],
            isError: true,
          };
        }
        const r = response as { credits_balance: number; balances?: unknown };
        return {
          content: [
            {
              type: 'text',
              text: `Credits balance: ${r.credits_balance}${r.balances ? `\n${JSON.stringify(r.balances, null, 2)}` : ''}`,
            },
          ],
        };
      },
    );

    // Health check tool
    this.server.registerTool(
      'health_check',
      {
        title: 'Health Check',
        description: 'Check if the DataMerge API client is configured and can connect. Uses /auth/info.',
        inputSchema: {
          _: z.string().optional().describe('This tool takes no required parameters. Call with no arguments.'),
        },
        annotations: { readOnlyHint: true },
      },
      async (_, extra) => {
        const client = this.getClientForSession(extra.sessionId);
      const isHealthy = await client.healthCheck();
      return {
        content: [
          {
            type: 'text',
            text: isHealthy
                ? '✅ DataMerge API client is healthy and can connect to the API.'
                : '❌ DataMerge API client cannot connect to the API. Please check your configuration.',
          },
        ],
      };
      },
    );
  }

  /**
   * Extract API key from Authorization header and configure client for session if present
   */
  private tryConfigureClientFromAuthHeader(
    authHeader: string | undefined,
    sessionId: string,
  ): void {
    console.log(
      `🔍 tryConfigureClientFromAuthHeader: sessionId=${sessionId}, hasAuthHeader=${!!authHeader}, authHeaderPrefix=${authHeader?.substring(0, 10) || 'none'}`,
    );
    
    // Accept both "Bearer" and "Token" schemes - Agent Builder sends Bearer, but we use Token for DataMerge API
    let apiKey: string | undefined;
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring('Bearer '.length);
      } else if (authHeader.startsWith('Token ')) {
        apiKey = authHeader.substring('Token '.length);
      }
    }

    if (apiKey && apiKey.trim()) {
      // Store the API key for this session so we can use it later
      this.apiKeys.set(sessionId, apiKey.trim());
      console.log(`🔍 Stored API key for session: ${sessionId}`);
      
      // Create and store the client if we don't have one yet
      if (!this.clients.has(sessionId)) {
        console.log(
          `🔍 Auto-configuring DataMerge client from Authorization header for session: ${sessionId}`,
        );
        try {
          const client = new DataMergeClient({ apiKey: apiKey.trim() });
          this.clients.set(sessionId, client);
          console.log(
            `✅ DataMerge client auto-configured successfully for session: ${sessionId}`,
          );
        } catch (error) {
          console.error(`❌ Failed to auto-configure DataMerge client:`, error);
        }
      }
    } else if (authHeader) {
      console.log(
        `⚠️ Authorization header present but doesn't start with 'Bearer ' or 'Token ': ${authHeader.substring(0, 30)}...`,
      );
    } else {
      console.log(`ℹ️ No Authorization header provided for session: ${sessionId}`);
    }
  }

  private getClientForSession(sessionId?: string): DataMergeClient {
    if (!sessionId) {
      console.error('❌ getClientForSession called without sessionId');
      throw new Error('Session ID is required');
    }

    console.log(`🔍 getClientForSession: sessionId=${sessionId}, hasClient=${this.clients.has(sessionId)}, hasStoredApiKey=${this.apiKeys.has(sessionId)}`);
    
    const existing = this.clients.get(sessionId);
    if (existing) {
      console.log(`✅ Using existing client for session: ${sessionId}`);
      return existing;
    }

    // Try to get API key from stored session keys first
    let apiKey = this.apiKeys.get(sessionId);
    if (apiKey) {
      console.log(`✅ Found stored API key for session ${sessionId}, creating client...`);
      const client = new DataMergeClient({ apiKey });
      this.clients.set(sessionId, client);
      return client;
    }

    // Fall back to environment variable
    console.log(`⚠️ No stored API key for session ${sessionId}, checking env var...`);
    apiKey = process.env['DATAMERGE_API_KEY'];
    if (!apiKey) {
      console.error(`❌ No client configured for session ${sessionId}, no stored API key, and no DATAMERGE_API_KEY env var`);
      throw new Error(
        'DataMerge client not configured. Please call configure_datamerge or set DATAMERGE_API_KEY.',
      );
    }

    console.log(`✅ Creating client from DATAMERGE_API_KEY env var for session: ${sessionId}`);
    const client = new DataMergeClient({ apiKey });
    this.clients.set(sessionId, client);
    return client;
  }

  /**
   * Create Express app with MCP endpoints
   */
  createApp(): express.Application {
    const app = express();
    app.use(express.json());

    // CORS configuration
    app.use((req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID');
      res.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');
      
      if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
      }
      next();
    });

    // Static server card for discovery / Smithery quality scan (homepage, icon, etc.)
    app.get('/.well-known/mcp/server-card.json', (_req: Request, res: Response) => {
      res.setHeader('Content-Type', 'application/json');
      res.json({
        serverInfo: {
          name: 'datamerge-mcp',
          version: '1.0.0',
          title: 'DataMerge MCP',
          websiteUrl: 'https://www.datamerge.ai',
          icons: [{ src: 'https://www.datamerge.ai/favicon.ico', sizes: ['any'] }],
        },
        authentication: { required: false },
      });
    });

    // MCP POST endpoint (naked path for dedicated MCP subdomain)
    app.post('/', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string;
      // Check authorization header (Express normalizes to lowercase, but check both)
      const authHeader = (req.headers.authorization || req.headers['Authorization'] || req.headers['x-api-key']) as string | undefined;
      
      console.log('🔍 ===== MCP POST REQUEST =====');
      console.log('🔍 Session ID:', sessionId);
      console.log('🔍 All headers:', JSON.stringify(Object.keys(req.headers), null, 2));
      console.log('🔍 Authorization header present:', !!authHeader);
      if (authHeader) {
        console.log('🔍 Authorization header value (first 30 chars):', authHeader.substring(0, 30));
      }
      console.log('🔍 Request body method:', req.body?.method);
      console.log('🔍 Request body params (keys):', req.body?.params ? Object.keys(req.body.params) : 'none');
      
      try {
        let transport: StreamableHTTPServerTransport;
        if (sessionId && this.transports.has(sessionId)) {
          // Reuse existing transport - check for Authorization header to auto-configure client
          this.tryConfigureClientFromAuthHeader(authHeader, sessionId);
          transport = this.transports.get(sessionId)!;
        } else if (!sessionId && isInitializeRequest(req.body)) {
          // New initialization request
          const eventStore = new InMemoryEventStore();
          transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            eventStore, // Enable resumability
            onsessioninitialized: (sessionId) => {
              console.log(`🔍 Session initialized with ID: ${sessionId}`);
              this.transports.set(sessionId, transport!);
              
              // Check for Authorization header and auto-configure if present
              this.tryConfigureClientFromAuthHeader(authHeader, sessionId);
            }
          });

          // Set up onclose handler to clean up transport when closed
          transport.onclose = () => {
            const sid = transport.sessionId;
            if (sid && this.transports.has(sid)) {
              console.log(`🔍 Transport closed for session ${sid}, removing from transports map`);
              this.transports.delete(sid);
              this.clients.delete(sid);
              this.apiKeys.delete(sid); // Clean up stored API key
            }
          };

          // Connect the transport to the MCP server BEFORE handling the request
          await this.server.connect(transport);
          await transport.handleRequest(req, res, req.body);
          return; // Already handled
        } else {
          // Invalid request - no session ID or not initialization request
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided'
            },
            id: null
          });
          return;
        }

        // Handle the request with existing transport
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        console.error('🔍 Error handling MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Internal server error'
            },
            id: null
          });
        }
      }
    });

    // MCP GET endpoint for SSE streams (naked path for dedicated MCP subdomain)
    app.get('/', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string;
      const authHeader = req.headers.authorization as string | undefined;
      
      console.log('🔍 MCP GET request for session:', sessionId);
      
      if (!sessionId || !this.transports.has(sessionId)) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }

      // Check for Authorization header and auto-configure client if present
      this.tryConfigureClientFromAuthHeader(authHeader, sessionId);

      // Check for Last-Event-ID header for resumability
      const lastEventId = req.headers['last-event-id'] as string;
      if (lastEventId) {
        console.log(`🔍 Client reconnecting with Last-Event-ID: ${lastEventId}`);
      } else {
        console.log(`🔍 Establishing new SSE stream for session ${sessionId}`);
      }

      const transport = this.transports.get(sessionId)!;
      await transport.handleRequest(req, res);
    });

    // MCP DELETE endpoint for session termination (naked path for dedicated MCP subdomain)
    app.delete('/', async (req: Request, res: Response) => {
      const sessionId = req.headers['mcp-session-id'] as string;
      
      console.log(`🔍 Received session termination request for session ${sessionId}`);
      
      if (!sessionId || !this.transports.has(sessionId)) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }

      try {
        const transport = this.transports.get(sessionId)!;
        await transport.handleRequest(req, res);
      } catch (error) {
        console.error('🔍 Error handling session termination:', error);
        if (!res.headersSent) {
          res.status(500).send('Error processing session termination');
        }
      }
    });

    // Health check endpoint
    app.get('/health', (_req: Request, res: Response) => {
      res.json({ status: 'ok', service: 'datamerge-mcp' });
    });

    return app;
  }
}

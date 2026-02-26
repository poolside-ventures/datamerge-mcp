import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { DataMergeClient } from './datamerge-client.js';

/**
 * MCP Server for the DataMerge Company API
 */
export class DataMergeMCPServer {
  private server: Server;
  private client: DataMergeClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'datamerge-mcp',
        version: '1.0.0',
      },
      {
        // Explicitly declare tool capabilities so the MCP SDK
        // allows registering tools/list and tools/call handlers.
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupToolHandlers();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'configure_datamerge',
            description:
              'Configure the DataMerge API client with authentication (API key). If not called, DATAMERGE_API_KEY env var will be used if present.',
            inputSchema: {
              type: 'object',
              properties: {
                apiKey: {
                  type: 'string',
                  description: 'DataMerge API key (Authorization: Token <apiKey>)',
                },
                baseUrl: {
                  type: 'string',
                  description:
                    'Optional override for the DataMerge API base URL (default: https://api.datamerge.ai)',
                },
              },
              required: [],
            },
          },
          {
            name: 'start_company_enrichment',
            description:
              'POST /v1/company/enrich. Enrich one or more companies by domain. Returns a job_id (async). Single: domain. Batch: domains, country_code, global_ultimate, list, skip_if_exists.',
            inputSchema: {
              type: 'object',
              properties: {
                domain: {
                  type: 'string',
                  description: 'Company website domain (e.g. example.com).',
                },
                company_name: {
                  type: 'string',
                  description: 'Company name (used when domain is not available).',
                },
                country_code: {
                  type: 'string',
                  description: 'Optional ISO 2-letter country code to improve matching.',
                },
                strict_match: {
                  type: 'boolean',
                  description: 'When true, require a strict match for enrichment.',
                },
                global_ultimate: {
                  type: 'boolean',
                  description: 'When true, always return the global ultimate parent.',
                },
                webhook_url: {
                  type: 'string',
                  description:
                    'Optional webhook URL to receive job completion notifications.',
                },
                domains: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Batch: multiple domains to enrich in one job.',
                },
                list: {
                  type: 'string',
                  description: 'List slug to add enriched companies to.',
                },
                skip_if_exists: {
                  type: 'boolean',
                  description: 'When true, skip domains that already exist in the list.',
                },
              },
              required: [],
            },
          },
          {
            name: 'start_company_enrichment_and_wait',
            description:
              'POST /v1/company/enrich then poll GET /v1/company/enrich/{job_id}/status until status is "completed" or "failed" or timeout. Same params as start_company_enrichment plus poll_interval_seconds and timeout_seconds.',
            inputSchema: {
              type: 'object',
              properties: {
                domain: {
                  type: 'string',
                  description: 'Company website domain (e.g. example.com).',
                },
                company_name: {
                  type: 'string',
                  description: 'Company name (used when domain is not available).',
                },
                country_code: {
                  type: 'string',
                  description: 'Optional ISO 2-letter country code to improve matching.',
                },
                strict_match: {
                  type: 'boolean',
                  description: 'When true, require a strict match for enrichment.',
                },
                global_ultimate: {
                  type: 'boolean',
                  description: 'When true, always return the global ultimate parent.',
                },
                webhook_url: {
                  type: 'string',
                  description:
                    'Optional webhook URL to receive job completion notifications.',
                },
                poll_interval_seconds: {
                  type: 'number',
                  description:
                    'How often to poll the job status (in seconds). Defaults to 5 seconds.',
                },
                timeout_seconds: {
                  type: 'number',
                  description:
                    'Maximum time to wait for completion (in seconds). Defaults to 60 seconds.',
                },
                domains: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Batch: multiple domains to enrich in one job.',
                },
                list: { type: 'string', description: 'List slug to add enriched companies to.' },
                skip_if_exists: {
                  type: 'boolean',
                  description: 'When true, skip domains that already exist in the list.',
                },
              },
              required: [],
            },
          },
          {
            name: 'get_company_enrichment_result',
            description:
              'GET /v1/company/enrich/{job_id}/status. Poll until status is "completed" or "failed". Response includes record_ids. Status values: queued · processing · completed · failed.',
            inputSchema: {
              type: 'object',
              properties: {
                job_id: {
                  type: 'string',
                  description: 'The enrichment job ID returned by start_company_enrichment.',
                },
              },
              required: ['job_id'],
            },
          },
          {
            name: 'get_company',
            description:
              'Get a single company record. GET /v1/company/get?datamerge_id={id} or ?record_id={uuid}. Provide either datamerge_id (charges 1 credit) or record_id (free). Not both. Optional: add_to_list — list slug to add the company to (only with datamerge_id).',
            inputSchema: {
              type: 'object',
              properties: {
                datamerge_id: {
                  type: 'string',
                  description: 'DataMerge company ID. Charges 1 credit.',
                },
                record_id: {
                  type: 'string',
                  description: 'Your record UUID from a previous enrichment. Free.',
                },
                add_to_list: {
                  type: 'string',
                  description: 'List slug to add the company to. Only valid with datamerge_id.',
                },
              },
              required: [],
            },
          },
          {
            name: 'get_company_hierarchy',
            description:
              'Get all entities in the same global ultimate hierarchy. GET /v1/company/hierarchy?datamerge_id={id}. Parameters: include_names (bool, charges 1 credit), include_branches (bool), only_subsidiaries (bool), max_level (int), country_code (array), page (int).',
            inputSchema: {
              type: 'object',
              properties: {
                datamerge_id: {
                  type: 'string',
                  description: 'DataMerge company ID. Required.',
                },
                include_names: {
                  type: 'boolean',
                  description: 'Include entity names. Charges 1 credit.',
                },
                include_branches: { type: 'boolean', description: 'Include branch entities.' },
                only_subsidiaries: { type: 'boolean', description: 'Return only subsidiaries.' },
                max_level: { type: 'number', description: 'Maximum hierarchy depth.' },
                country_code: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by country code(s).',
                },
                page: { type: 'number', description: 'Page number for pagination.' },
              },
              required: ['datamerge_id'],
            },
          },
          {
            name: 'start_lookalike',
            description:
              'POST /v1/company/lookalike. Find similar companies using seed domains. Returns a job_id (async, 202). Poll GET /v1/company/lookalike/{job_id}/status until completed or failed.',
            inputSchema: {
              type: 'object',
              properties: {
                companiesFilters: {
                  type: 'object',
                  description: 'Filters for lookalike search.',
                  properties: {
                    lookalikeDomains: {
                      type: 'array',
                      items: { type: 'string' },
                      description: 'Seed domains (e.g. ["stripe.com"]).',
                    },
                    primaryLocations: {
                      type: 'object',
                      properties: {
                        includeCountries: { type: 'array', items: { type: 'string' } },
                        excludeCountries: { type: 'array', items: { type: 'string' } },
                      },
                    },
                    companySizes: { type: 'array', items: { type: 'string' } },
                    revenues: { type: 'array', items: { type: 'string' } },
                    yearFounded: {
                      type: 'object',
                      properties: { min: { type: 'number' }, max: { type: 'number' } },
                    },
                  },
                },
                size: { type: 'number', description: 'Max number of lookalikes to return (e.g. 50).' },
                list: { type: 'string', description: 'List slug to add results to.' },
                exclude_all: { type: 'boolean', description: 'Exclude companies already in list.' },
              },
              required: ['companiesFilters'],
            },
          },
          {
            name: 'get_lookalike_status',
            description: 'GET /v1/company/lookalike/{job_id}/status. Poll until status is "completed" or "failed". Response includes record_ids.',
            inputSchema: {
              type: 'object',
              properties: {
                job_id: { type: 'string', description: 'Lookalike job ID.' },
              },
              required: ['job_id'],
            },
          },
          {
            name: 'contact_search',
            description:
              'POST /v1/contact/search. Search for contacts at specified companies. Returns a job_id (async, 202). enrich_fields required (at least one of contact.emails or contact.phones). Use company_list (slug) instead of domains to search a saved list.',
            inputSchema: {
              type: 'object',
              properties: {
                domains: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Company domains to search.',
                },
                company_list: { type: 'string', description: 'List slug instead of domains.' },
                max_results_per_company: { type: 'number', description: 'Max contacts per company.' },
                job_titles: {
                  type: 'object',
                  properties: {
                    include: {
                      type: 'object',
                      description: 'Priority tiers: "1": ["CEO","CTO"], "2": ["VP Engineering"].',
                    },
                    exclude: { type: 'array', items: { type: 'string' } },
                  },
                },
                location: {
                  type: 'object',
                  properties: {
                    include: {
                      type: 'array',
                      items: { type: 'object', properties: { type: { type: 'string' }, value: { type: 'string' } } },
                    },
                    exclude: { type: 'array' },
                  },
                },
                enrich_fields: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'At least one of contact.emails or contact.phones.',
                },
                webhook: { type: 'string', description: 'Webhook URL for completion.' },
              },
              required: ['enrich_fields'],
            },
          },
          {
            name: 'get_contact_search_status',
            description: 'GET /v1/contact/search/{job_id}/status. Poll until status is "completed" or "failed". Response includes record_ids.',
            inputSchema: {
              type: 'object',
              properties: { job_id: { type: 'string', description: 'Contact search job ID.' } },
              required: ['job_id'],
            },
          },
          {
            name: 'contact_enrich',
            description:
              'POST /v1/contact/enrich. Enrich specific contacts by LinkedIn URL or name+domain. Returns a job_id (async, 202).',
            inputSchema: {
              type: 'object',
              properties: {
                contacts: {
                  type: 'array',
                  items: {
                    type: 'object',
                    description: 'Either { linkedin_url } or { firstname, lastname, domain }.',
                  },
                },
                enrich_fields: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'e.g. ["contact.emails","contact.phones"].',
                },
              },
              required: ['contacts', 'enrich_fields'],
            },
          },
          {
            name: 'get_contact_enrich_status',
            description: 'GET /v1/contact/enrich/{job_id}/status. Poll until status is "completed" or "failed". Response includes record_ids.',
            inputSchema: {
              type: 'object',
              properties: { job_id: { type: 'string', description: 'Contact enrich job ID.' } },
              required: ['job_id'],
            },
          },
          {
            name: 'get_contact',
            description: 'GET /v1/contact/get?record_id={uuid}. Retrieve a specific contact by record UUID. Never charges credits.',
            inputSchema: {
              type: 'object',
              properties: {
                record_id: { type: 'string', description: 'Contact record UUID from a previous search/enrich.' },
              },
              required: ['record_id'],
            },
          },
          {
            name: 'list_lists',
            description: 'GET /v1/lists. Optional: object_type=company or object_type=contact.',
            inputSchema: {
              type: 'object',
              properties: {
                object_type: {
                  type: 'string',
                  enum: ['company', 'contact'],
                  description: 'Filter by object type.',
                },
              },
              required: [],
            },
          },
          {
            name: 'create_list',
            description: 'POST /v1/lists. Body: name, object_type (company or contact).',
            inputSchema: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'List name.' },
                object_type: { type: 'string', enum: ['company', 'contact'], description: 'Type of list.' },
              },
              required: ['name', 'object_type'],
            },
          },
          {
            name: 'get_list_items',
            description: 'GET /v1/lists/{object_type}/{list_slug}. object_type: company or contact. list_slug: e.g. target-accounts. Parameters: page, page_size (max 100), sort_by, sort_order (asc/desc).',
            inputSchema: {
              type: 'object',
              properties: {
                object_type: { type: 'string', enum: ['company', 'contact'] },
                list_slug: { type: 'string', description: 'List slug (e.g. target-accounts).' },
                page: { type: 'number' },
                page_size: { type: 'number', description: 'Max 100.' },
                sort_by: { type: 'string' },
                sort_order: { type: 'string', enum: ['asc', 'desc'] },
              },
              required: ['object_type', 'list_slug'],
            },
          },
          {
            name: 'remove_list_item',
            description: 'DELETE /v1/lists/{object_type}/{list_slug}/{item_id}.',
            inputSchema: {
              type: 'object',
              properties: {
                object_type: { type: 'string', enum: ['company', 'contact'] },
                list_slug: { type: 'string' },
                item_id: { type: 'string' },
              },
              required: ['object_type', 'list_slug', 'item_id'],
            },
          },
          {
            name: 'delete_list',
            description: 'DELETE /v1/lists/{object_type}/{list_slug}. System lists cannot be deleted.',
            inputSchema: {
              type: 'object',
              properties: {
                object_type: { type: 'string', enum: ['company', 'contact'] },
                list_slug: { type: 'string' },
              },
              required: ['object_type', 'list_slug'],
            },
          },
          {
            name: 'get_credits_balance',
            description: 'GET /v1/credits/balance. Returns credits_balance and balances (one_off, recurring, rollover, total).',
            inputSchema: { type: 'object', properties: {} },
          },
          {
            name: 'health_check',
            description: 'Check if the DataMerge API client is configured and can connect. Uses /auth/info.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'configure_datamerge':
            return await this.handleConfigureDataMerge(args);

          case 'start_company_enrichment':
            return await this.handleStartCompanyEnrichment(args);

          case 'start_company_enrichment_and_wait':
            return await this.handleStartCompanyEnrichmentAndWait(args);

          case 'get_company_enrichment_result':
            return await this.handleGetCompanyEnrichmentResult(args);

          case 'get_company':
            return await this.handleGetCompany(args);

          case 'get_company_hierarchy':
            return await this.handleGetCompanyHierarchy(args);

          case 'start_lookalike':
            return await this.handleStartLookalike(args);
          case 'get_lookalike_status':
            return await this.handleGetLookalikeStatus(args);
          case 'contact_search':
            return await this.handleContactSearch(args);
          case 'get_contact_search_status':
            return await this.handleGetContactSearchStatus(args);
          case 'contact_enrich':
            return await this.handleContactEnrich(args);
          case 'get_contact_enrich_status':
            return await this.handleGetContactEnrichStatus(args);
          case 'get_contact':
            return await this.handleGetContact(args);
          case 'list_lists':
            return await this.handleListLists(args);
          case 'create_list':
            return await this.handleCreateList(args);
          case 'get_list_items':
            return await this.handleGetListItems(args);
          case 'remove_list_item':
            return await this.handleRemoveListItem(args);
          case 'delete_list':
            return await this.handleDeleteList(args);
          case 'get_credits_balance':
            return await this.handleGetCreditsBalance(args);

          case 'health_check':
            return await this.handleHealthCheck(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private ensureClientConfigured(): DataMergeClient {
    if (this.client) {
      return this.client;
    }

    const apiKey = process.env['DATAMERGE_API_KEY'];
    if (!apiKey) {
      throw new Error(
        'DataMerge client not configured. Please run configure_datamerge first or set DATAMERGE_API_KEY.',
      );
    }

    this.client = new DataMergeClient({ apiKey });
    return this.client;
  }

  private async handleConfigureDataMerge(args: any): Promise<any> {
    const apiKey = args?.apiKey ?? process.env['DATAMERGE_API_KEY'];
    const baseUrl = args?.baseUrl;

    if (!apiKey) {
      throw new Error(
        'apiKey is required. Provide it as an argument or set DATAMERGE_API_KEY.',
      );
    }

    this.client = new DataMergeClient({ apiKey, baseUrl });
    return {
      content: [
        {
          type: 'text',
          text: 'DataMerge API client configured successfully.',
        },
      ],
    };
  }

  private async handleStartCompanyEnrichment(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
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
  }

  private async handleStartCompanyEnrichmentAndWait(args: any): Promise<any> {
    const client = this.ensureClientConfigured();

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
        // Return full job data as JSON including all results
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(job, null, 2),
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
          } seconds.\n\nJob ID: ${startResponse.job.id}\nYou can continue polling using get_company_enrichment_result.`,
        },
      ],
    };
  }

  private async handleGetCompanyEnrichmentResult(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
    const jobId = args?.job_id;
    if (!jobId) {
      throw new Error('job_id is required');
    }

    const response = await client.getCompanyEnrichmentResult(jobId);

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
  }

  private async handleGetCompany(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
    const response = await client.getCompany(args ?? {});

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
  }

  private async handleGetCompanyHierarchy(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
    const response = await client.getCompanyHierarchy(args ?? {});

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

    const { company, parents = [], children = [] } = response;
    
    // Return full hierarchy data as JSON
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ company, parents, children }, null, 2),
        },
      ],
    };
  }

  private async handleStartLookalike(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
    const response = await client.startLookalike(args ?? {});
    if (!response.success || 'error' in response) {
      return {
        content: [{ type: 'text', text: `Lookalike request failed: ${(response as any).error}` }],
        isError: true,
      };
    }
    const r = response as { job_id: string; status: string; message?: string };
    return {
      content: [
        {
          type: 'text',
          text: `Started lookalike job.\n\nJob ID: ${r.job_id}\nStatus: ${r.status}${r.message ? `\n${r.message}` : ''}`,
        },
      ],
    };
  }

  private async handleGetLookalikeStatus(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
    const jobId = args?.job_id;
    if (!jobId) throw new Error('job_id is required');
    const response = await client.getLookalikeStatus(jobId);
    if (!response.success || 'error' in response) {
      return {
        content: [{ type: 'text', text: `Failed to get lookalike status: ${(response as any).error}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(response, null, 2) }],
    };
  }

  private async handleContactSearch(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
    const response = await client.contactSearch(args ?? {});
    if (!response.success || 'error' in response) {
      return {
        content: [{ type: 'text', text: `Contact search failed: ${(response as any).error}` }],
        isError: true,
      };
    }
    const r = response as { job_id: string; status: string };
    return {
      content: [
        { type: 'text', text: `Started contact search job.\n\nJob ID: ${r.job_id}\nStatus: ${r.status}` },
      ],
    };
  }

  private async handleGetContactSearchStatus(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
    const jobId = args?.job_id;
    if (!jobId) throw new Error('job_id is required');
    const response = await client.getContactSearchStatus(jobId);
    if (!response.success || 'error' in response) {
      return {
        content: [{ type: 'text', text: `Failed to get contact search status: ${(response as any).error}` }],
        isError: true,
      };
    }
    return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
  }

  private async handleContactEnrich(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
    const response = await client.contactEnrich(args ?? {});
    if (!response.success || 'error' in response) {
      return {
        content: [{ type: 'text', text: `Contact enrich failed: ${(response as any).error}` }],
        isError: true,
      };
    }
    const r = response as { job_id: string; status: string };
    return {
      content: [
        { type: 'text', text: `Started contact enrichment job.\n\nJob ID: ${r.job_id}\nStatus: ${r.status}` },
      ],
    };
  }

  private async handleGetContactEnrichStatus(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
    const jobId = args?.job_id;
    if (!jobId) throw new Error('job_id is required');
    const response = await client.getContactEnrichStatus(jobId);
    if (!response.success || 'error' in response) {
      return {
        content: [{ type: 'text', text: `Failed to get contact enrich status: ${(response as any).error}` }],
        isError: true,
      };
    }
    return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] };
  }

  private async handleGetContact(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
    const recordId = args?.record_id;
    if (!recordId) throw new Error('record_id is required');
    const response = await client.getContact(recordId);
    if (!response.success || 'error' in response) {
      return {
        content: [{ type: 'text', text: `Failed to get contact: ${(response as any).error}` }],
        isError: true,
      };
    }
    const rec = (response as any).record ?? (response as any).contact;
    return { content: [{ type: 'text', text: JSON.stringify(rec ?? response, null, 2) }] };
  }

  private async handleListLists(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
    const objectType = args?.object_type as 'company' | 'contact' | undefined;
    const result = await client.listLists(objectType);
    if (!result.success) {
      return {
        content: [{ type: 'text', text: `Failed to list lists: ${result.error}` }],
        isError: true,
      };
    }
    return { content: [{ type: 'text', text: JSON.stringify(result.lists ?? [], null, 2) }] };
  }

  private async handleCreateList(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
    const response = await client.createList(args ?? {});
    if (!response.success) {
      return {
        content: [{ type: 'text', text: `Failed to create list: ${response.error}` }],
        isError: true,
      };
    }
    return { content: [{ type: 'text', text: JSON.stringify(response.list ?? response, null, 2) }] };
  }

  private async handleGetListItems(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
    const objectType = args?.object_type as 'company' | 'contact';
    const listSlug = args?.list_slug as string;
    if (!objectType || !listSlug) throw new Error('object_type and list_slug are required');
    const params =
      args?.page != null || args?.page_size != null || args?.sort_by || args?.sort_order
        ? {
            page: args?.page,
            page_size: args?.page_size,
            sort_by: args?.sort_by,
            sort_order: args?.sort_order,
          }
        : undefined;
    const result = await client.getListItems(objectType, listSlug, params);
    if (!result.success) {
      return {
        content: [{ type: 'text', text: `Failed to get list items: ${result.error}` }],
        isError: true,
      };
    }
    return { content: [{ type: 'text', text: JSON.stringify(result.items ?? [], null, 2) }] };
  }

  private async handleRemoveListItem(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
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
  }

  private async handleDeleteList(args: any): Promise<any> {
    const client = this.ensureClientConfigured();
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
  }

  private async handleGetCreditsBalance(_args: any): Promise<any> {
    const client = this.ensureClientConfigured();
    const response = await client.getCreditsBalance();
    if (!response.success || 'error' in response) {
      return {
        content: [{ type: 'text', text: `Failed to get credits balance: ${(response as any).error}` }],
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
  }

  private async handleHealthCheck(_args: any): Promise<any> {
    const client = this.ensureClientConfigured();
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
  }

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('DataMerge MCP server started');
  }
}

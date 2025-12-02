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
              'Start a company enrichment job using the DataMerge Company API (POST /v1/company/enrich).',
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
              },
              required: [],
            },
          },
          {
            name: 'start_company_enrichment_and_wait',
            description:
              'Start a company enrichment job and poll its status until completion or timeout.',
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
              },
              required: [],
            },
          },
          {
            name: 'get_company_enrichment_result',
            description:
              'Get the status and results of a company enrichment job (GET /v1/job/{job_id}/status).',
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
            description: 'Get a single company record (GET /v1/company/get).',
            inputSchema: {
              type: 'object',
              properties: {
                company_id: {
                  type: 'string',
                  description: 'DataMerge company ID.',
                },
                domain: {
                  type: 'string',
                  description: 'Company domain (e.g. example.com).',
                },
                company_name: {
                  type: 'string',
                  description: 'Company name.',
                },
                country_code: {
                  type: 'string',
                  description: 'Optional ISO 2-letter country code.',
                },
              },
              required: [],
            },
          },
          {
            name: 'get_company_hierarchy',
            description:
              'Get the corporate hierarchy (parents/children) for a company (GET /v1/company/hierarchy).',
            inputSchema: {
              type: 'object',
              properties: {
                company_id: {
                  type: 'string',
                  description: 'DataMerge company ID.',
                },
                domain: {
                  type: 'string',
                  description: 'Company domain (e.g. example.com).',
                },
                company_name: {
                  type: 'string',
                  description: 'Company name.',
                },
                country_code: {
                  type: 'string',
                  description: 'Optional ISO 2-letter country code.',
                },
              },
              required: [],
            },
          },
          {
            name: 'health_check',
            description:
              'Check if the DataMerge API client is properly configured and can connect (uses /auth/info).',
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

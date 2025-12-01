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
      description: 'DataMerge MCP Server for company enrichment and hierarchy',
    });

    this.setupToolHandlers();
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
          apiKey: z.string().optional().describe('DataMerge API key'),
          baseUrl: z.string().optional().describe('Optional custom base URL'),
        },
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
          'Start a company enrichment job using the DataMerge Company API (POST /v1/company/enrich).',
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
        },
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
          'Get the status and results of a company enrichment job (GET /v1/job/{job_id}/status).',
        inputSchema: {
          job_id: z.string().describe('The enrichment job ID returned by start_company_enrichment.'),
        },
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
        const firstResult = job.results?.[0];
        const resultSummary =
          firstResult
            ? `\n\nFirst result:\n- Name: ${firstResult.name}\n- Domain: ${
                firstResult.domain ?? 'n/a'
              }\n- Country: ${firstResult.country_code ?? 'n/a'}`
            : '\n\nNo results yet.';

      return {
        content: [
          {
            type: 'text',
              text: `Enrichment job status.\n\nJob ID: ${job.id}\nStatus: ${job.status}${resultSummary}`,
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
          'Start a company enrichment job and poll its status until completion or timeout.',
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
        },
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
            const resultSummary = firstResult
              ? `\n\nFirst result:\n- Name: ${firstResult.name}\n- Domain: ${
                  firstResult.domain ?? 'n/a'
                }\n- Country: ${firstResult.country_code ?? 'n/a'}`
              : '\n\nJob completed but no results were returned.';

            return {
              content: [
                {
                  type: 'text',
                  text: `Enrichment job completed.\n\nJob ID: ${job.id}\nStatus: ${job.status}${resultSummary}`,
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

    // Get company
    this.server.registerTool(
      'get_company',
      {
        title: 'Get Company',
        description: 'Get a single company record (GET /v1/company/get).',
      inputSchema: {
          company_id: z.string().optional().describe('DataMerge company ID.'),
          domain: z.string().optional().describe('Company domain (e.g. example.com).'),
          company_name: z.string().optional().describe('Company name.'),
          country_code: z.string().optional().describe('Optional ISO 2-letter country code.'),
        },
      },
      async (args, extra) => {
        const client = this.getClientForSession(extra.sessionId);
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
              text: `Company details:\n\nName: ${company.name}\nDomain: ${
                company.domain ?? 'n/a'
              }\nCountry: ${company.country_code ?? 'n/a'}\nID: ${company.id}`,
          },
        ],
      };
      },
    );

    // Get company hierarchy
    this.server.registerTool(
      'get_company_hierarchy',
      {
        title: 'Get Company Hierarchy',
        description:
          'Get the corporate hierarchy (parents/children) for a company (GET /v1/company/hierarchy).',
      inputSchema: {
          company_id: z.string().optional().describe('DataMerge company ID.'),
          domain: z.string().optional().describe('Company domain (e.g. example.com).'),
          company_name: z.string().optional().describe('Company name.'),
          country_code: z.string().optional().describe('Optional ISO 2-letter country code.'),
        },
      },
      async (args, extra) => {
        const client = this.getClientForSession(extra.sessionId);
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
        const parentsSummary =
          parents.length > 0
            ? parents.map((p) => `- ${p.name} (${p.id})`).join('\n')
            : 'None';
        const childrenSummary =
          children.length > 0
            ? children.map((c) => `- ${c.name} (${c.id})`).join('\n')
            : 'None';

      return {
        content: [
          {
            type: 'text',
              text: `Hierarchy for company ${company.name} (${company.id}):\n\nParents:\n${parentsSummary}\n\nChildren:\n${childrenSummary}`,
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
        description: 'Check if the DataMerge API client is healthy',
      inputSchema: {},
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
    
    if (authHeader && authHeader.startsWith('Token ')) {
      const apiKey = authHeader.substring('Token '.length);
      if (apiKey) {
        // Store the API key for this session so we can use it later
        this.apiKeys.set(sessionId, apiKey);
        console.log(`🔍 Stored API key for session: ${sessionId}`);
        
        // Create and store the client if we don't have one yet
        if (!this.clients.has(sessionId)) {
          console.log(
            `🔍 Auto-configuring DataMerge client from Authorization header for session: ${sessionId}`,
          );
          try {
            const client = new DataMergeClient({ apiKey });
            this.clients.set(sessionId, client);
            console.log(
              `✅ DataMerge client auto-configured successfully for session: ${sessionId}`,
            );
          } catch (error) {
            console.error(`❌ Failed to auto-configure DataMerge client:`, error);
          }
        }
      } else {
        console.log(`⚠️ Authorization header has 'Token ' prefix but no API key after it`);
      }
    } else if (authHeader) {
      console.log(
        `⚠️ Authorization header present but doesn't start with 'Token ': ${authHeader.substring(0, 20)}...`,
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

## DataMerge MCP (Model Context Protocol)

A Model Context Protocol (MCP) server for the DataMerge Company API, enabling AI assistants to enrich and retrieve company data via DataMerge.

### What is this?

This MCP server connects AI assistants (like Claude, ChatGPT, and others that support MCP) to the DataMerge Company API. It lets tools start enrichment jobs, poll job status, fetch company records, and inspect corporate hierarchies using DataMerge’s infrastructure and data model, following the same operation set exposed in the DataMerge n8n node [`https://github.com/poolside-ventures/n8n-nodes-datamerge`].

**How it works:**
1. Provide your DataMerge API key to the MCP server (environment variable or `configure_datamerge` tool).
2. Configure your AI assistant to use this MCP server.
3. Ask your assistant to enrich companies, look up company details, or explore corporate hierarchies; the assistant will call DataMerge under the hood.

If you don’t have a DataMerge API key yet, you can use the public API schema at `http://api.datamerge.ai/schema` to understand available operations.

### Features

- **Company Enrichment**: Start asynchronous enrichment jobs via `POST /v1/company/enrich`.
- **Job Status**: Poll enrichment jobs via `GET /v1/job/{job_id}/status`.
- **Company Lookup**: Fetch a single company via `GET /v1/company/get`.
- **Hierarchy**: Retrieve corporate hierarchy via `GET /v1/company/hierarchy`.
- **Type Safety**: Full TypeScript support with DataMerge-oriented types and Zod schemas.
- **Authentication Support**: Token-based authentication (`Authorization: Token <API_KEY>`).
- **Health Checks**: Basic health monitoring via `/auth/info`.
- **MCP Protocol Compliance**: Full Model Context Protocol server implementation.
- **Dual Mode Support**: Run locally (stdio) or remotely (HTTP/SSE).

## Installation

```bash
npm install @datamerge/mcp
```

## Quick Start

### 1. Install and Configure

```bash
# Install the package
npm install @datamerge/mcp

# Or install globally for CLI usage
npm install -g @datamerge/mcp
```

### 2. Configure the MCP Server

You can configure the DataMerge API client with your API key using either an environment variable or the `configure_datamerge` tool.

```typescript
// Configure via tool call
await configure_datamerge({
  apiKey: "your_datamerge_api_key_here"
  // baseUrl: "https://api.datamerge.ai" // optional override
});
```

Alternatively, set the environment variable:

```bash
export DATAMERGE_API_KEY="your_datamerge_api_key_here"
```

### 3. Use the Available Tools

The MCP server provides the following tools:

#### Start Company Enrichment

```typescript
await start_company_enrichment({
  domain: "example.com",
  // company_name: "Example Inc",
  // country_code: "US",
  // strict_match: true,
  // global_ultimate: true,
  // webhook_url: "https://yourapp.com/datamerge-webhook"
});
// Starts an enrichment job and returns a job id and initial status
```

#### Start Company Enrichment and Wait

```typescript
await start_company_enrichment_and_wait({
  domain: "example.com",
  // company_name: "Example Inc",
  // country_code: "US",
  // strict_match: true,
  // global_ultimate: true,
  // poll_interval_seconds: 5,
  // timeout_seconds: 60
});
// Starts an enrichment job and polls its status until completion or timeout (default: 5s interval, 60s timeout)
```

#### Get Company Enrichment Result

```typescript
await get_company_enrichment_result({
  job_id: "job_123"
});
// Returns job status and (when ready) enriched company records
```

#### Get Company

```typescript
await get_company({
  domain: "example.com"
  // or company_id: "cmp_123"
  // or company_name: "Example Inc"
});
// Returns a single company record from DataMerge
```

#### Get Company Hierarchy

```typescript
await get_company_hierarchy({
  company_id: "cmp_123"
  // or domain / company_name + country_code
});
// Returns parents/children of the company to inspect hierarchy
```

#### Health Check

```typescript
await health_check();
// Verifies API connectivity using the /auth/info endpoint
```

## Deployment Options

The MCP server can be run in two modes:

### 1. Local Mode (Stdio Transport)

For local integration with AI assistants like Claude Desktop. Uses stdio transport for communication.

```bash
# Run locally
npx @datamerge/mcp

# Or with environment variable
DATAMERGE_API_KEY="your_key" npx @datamerge/mcp
```

### 2. HTTP Mode (Streamable HTTP/SSE Transport)

For remote deployment with HTTP/SSE transport. This allows the MCP server to be accessed over the network.

#### Running the HTTP Server

```bash
# Build and start the HTTP server
npm run build
npm run start:http

# Or with custom port
PORT=8080 npm run start:http

# Or run directly with npx
npx datamerge-mcp-http
```

#### Server Endpoints

- **MCP endpoint (SSE + JSON-RPC)**:
  - `POST /` – MCP client-to-server messages
  - `GET /` – MCP server-to-client SSE stream
  - `DELETE /` – Terminate session
- **Health Check**: `GET /health` – Server health status

#### Authentication

All HTTP requests require a DataMerge API key in the `Authorization` header:

```bash
Authorization: Token <your-datamerge-api-key>
```

The same API key is then used by the MCP server to authenticate with the DataMerge API.

#### Testing the HTTP Server

```bash
# Health check (should fail without auth)
curl http://localhost:3000/health

# Health check with authentication
curl -H "Authorization: Token YOUR_API_KEY" http://localhost:3000/health

# Connect to streamable endpoint
curl -N -H "Authorization: Token YOUR_API_KEY" http://localhost:3000/

# Or use the test script
./test-http-server.sh YOUR_API_KEY
```

## MCP Integration

### Using with AI Assistants

This MCP server can be integrated with AI assistants like Claude, ChatGPT, and others that support the Model Context Protocol.

#### Configuration Example

```json
{
  "mcpServers": {
    "datamerge": {
      "command": "npx",
      "args": ["@datamerge/mcp"],
      "env": {
        "DATAMERGE_API_KEY": "your_datamerge_api_key_here"
      }
    }
  }
}
```

#### Available MCP Tools

The server exposes these tools for AI assistants:

1. `configure_datamerge` – Configure API connection (optional if `DATAMERGE_API_KEY` is set).
2. `start_company_enrichment` – Start an enrichment job.
3. `start_company_enrichment_and_wait` – Start an enrichment job and poll until completion or timeout.
4. `get_company_enrichment_result` – Poll job status and results.
5. `get_company` – Fetch a single company record.
6. `get_company_hierarchy` – Retrieve parents/children for a company.
7. `health_check` – Verify API connectivity using `/auth/info`.

## Usage Examples

### As a Library

```typescript
import { DataMergeClient, DataMergeMCPServer } from '@datamerge/mcp';

// Use as a direct API client
const client = new DataMergeClient({
  apiKey: 'your_datamerge_api_key_here',
});

// Use as an MCP server
const server = new DataMergeMCPServer();
await server.run();
```

### As an MCP Server

```bash
# Run the MCP server
npx @datamerge/mcp

# Or install globally
npm install -g @datamerge/mcp
datamerge-mcp
```

## Configuration

### Environment Variables

You can configure the MCP server using environment variables:

```bash
export DATAMERGE_API_KEY="your_datamerge_api_key_here"

# Then run the server
datamerge-mcp
```

### Authentication

The MCP server uses the DataMerge API key for all outbound API requests and for optional HTTP authentication in HTTP mode.

## Development

### Running Tests

```bash
npm test
npm run test:watch
```

### Linting

```bash
npm run lint
npm run lint:fix
```

## CLI Usage

The package includes command-line interfaces for running the MCP server:

```bash
# Install globally
npm install -g @datamerge/mcp

# Run the stdio MCP server
datamerge-mcp

# Run the HTTP/streamable MCP server
datamerge-mcp-http
```

## Error Handling

The MCP server provides detailed error messages for common issues:

- Configuration errors (e.g., missing API key).
- Authentication errors from DataMerge.
- Validation errors for tool arguments (via Zod).
- API errors from the DataMerge API (surfaced as textual error content).

## License

MIT License – see `LICENSE` for details.


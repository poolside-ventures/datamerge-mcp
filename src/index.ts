/**
 * DataMerge MCP Package
 * Model Context Protocol server for the DataMerge Company API
 */

// Export main classes
export { DataMergeMCPServer } from './mcp-server.js';
export { DataMergeMCPStreamable as DataMergeMCPServerHTTP } from './mcp-server-streamable.js';
export { DataMergeClient } from './datamerge-client.js';

// Export types
export type {
  DataMergeConfig,
  CompanyRecordV1,
  CompanyEnrichRequestV1,
  CompanyEnrichResponseV1,
  CompanyEnrichJobV1,
  StatusResponseV1,
  CompanyGetParamsV1,
  CompanyGetResponseV1,
  CompanyHierarchyResponseV1,
  ApiError,
  ApiResponse,
} from './types.js';

// Export schemas
export {
  CompanyRecordV1Schema,
  CompanyEnrichRequestV1Schema,
  CompanyEnrichResponseV1Schema,
  CompanyEnrichJobV1Schema,
  StatusResponseV1Schema,
  CompanyGetParamsV1Schema,
  CompanyGetResponseV1Schema,
  CompanyHierarchyResponseV1Schema,
  DataMergeConfigSchema,
  ApiErrorSchema,
} from './schemas.js';

// Export validated types
export type {
  ValidatedCompanyRecordV1,
  ValidatedCompanyEnrichRequestV1,
  ValidatedCompanyEnrichResponseV1,
  ValidatedStatusResponseV1,
  ValidatedCompanyGetParamsV1,
  ValidatedCompanyGetResponseV1,
  ValidatedCompanyHierarchyResponseV1,
  ValidatedDataMergeConfig,
} from './schemas.js';


/**
 * Type definitions for the DataMerge Company API
 * Based on the OpenAPI 3.0.3 specification at http://api.datamerge.ai/schema
 */

/**
 * Client configuration
 */
export interface DataMergeConfig {
  /**
   * API key for DataMerge.
   * Sent as: Authorization: Token <apiKey>
   */
  apiKey: string;

  /**
   * Optional override for the base URL.
   * Defaults to https://api.datamerge.ai
   */
  baseUrl?: string | undefined;
}

/**
 * Core company record returned by DataMerge.
 * This is intentionally flexible and may contain additional fields
 * not enumerated here.
 */
export interface CompanyRecordV1 {
  id: string;
  name: string;
  domain?: string | null | undefined;
  website_url?: string | null | undefined;
  country_code?: string | null | undefined;
  global_ultimate?: boolean | null | undefined;
  parent_id?: string | null | undefined;
  ultimate_parent_id?: string | null | undefined;
  [key: string]: unknown;
}

/**
 * Request body for /v1/company/enrich
 */
export interface CompanyEnrichRequestV1 {
  /**
   * Company website domain (e.g. example.com)
   */
  domain?: string | undefined;

  /**
   * Company name (used when domain is not available)
   */
  company_name?: string | undefined;

  /**
   * Optional ISO 2-letter country code to improve matching
   */
  country_code?: string | undefined;

  /**
   * When true, require a strict match for enrichment
   */
  strict_match?: boolean | undefined;

  /**
   * When true, always return the global ultimate parent
   */
  global_ultimate?: boolean | undefined;

  /**
   * Optional webhook URL to receive job completion notifications
   */
  webhook_url?: string | undefined;

  /**
   * Additional matching or filter parameters supported by the API.
   */
  [key: string]: unknown;
}

/**
 * Job representation used by enrichment and status endpoints
 */
export interface CompanyEnrichJobV1 {
  id: string;
  status: string;
  created_at: string;
  updated_at?: string | undefined;
  results?: CompanyRecordV1[] | undefined;
  [key: string]: unknown;
}

/**
 * Response from /v1/company/enrich
 */
export interface CompanyEnrichResponseV1 {
  success: boolean;
  job: CompanyEnrichJobV1;
}

/**
 * Response from /v1/job/{job_id}/status
 */
export interface StatusResponseV1 {
  success: boolean;
  job: CompanyEnrichJobV1;
}

/**
 * Parameters for /v1/company/get
 * At least one of company_id, domain, or company_name should be provided.
 */
export interface CompanyGetParamsV1 {
  company_id?: string | undefined;
  domain?: string | undefined;
  company_name?: string | undefined;
  country_code?: string | undefined;
}

export interface CompanyGetResponseV1 {
  success: boolean;
  company: CompanyRecordV1;
}

/**
 * Response from /v1/company/hierarchy
 */
export interface CompanyHierarchyResponseV1 {
  success: boolean;
  company: CompanyRecordV1;
  parents?: CompanyRecordV1[];
  children?: CompanyRecordV1[];
}

export interface ApiError {
  success: false;
  error: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T> = T | ApiError;


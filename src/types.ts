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
 * Single: domain or company_name. Batch: domains array. Optional list, skip_if_exists.
 */
export interface CompanyEnrichRequestV1 {
  /**
   * Company website domain (e.g. example.com) — single enrichment
   */
  domain?: string | undefined;

  /**
   * Multiple domains for batch enrichment
   */
  domains?: string[] | undefined;

  /**
   * Company name (used when domain is not available)
   */
  company_name?: string | undefined;

  /**
   * Optional ISO 2-letter country code(s) to improve matching (can be string or array)
   */
  country_code?: string | string[] | undefined;

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
   * List slug to add enriched companies to
   */
  list?: string | undefined;

  /**
   * When true, skip domains that already exist in the list (avoid re-charging)
   */
  skip_if_exists?: boolean | undefined;

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
  created_at?: string | undefined;
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
 * Response from GET /v1/company/enrich/{job_id}/status
 */
export interface StatusResponseV1 {
  success: boolean;
  job: CompanyEnrichJobV1;
}

/**
 * Parameters for GET /v1/company/get
 * Provide either datamerge_id (charges 1 credit) or record_id (free). Not both.
 * Optional: add_to_list — list slug to add the company to (only with datamerge_id).
 */
export interface CompanyGetParamsV1 {
  datamerge_id?: string | undefined;
  record_id?: string | undefined;
  add_to_list?: string | undefined;
}

export interface CompanyGetResponseV1 {
  success: boolean;
  company: CompanyRecordV1;
}

/**
 * Parameters for GET /v1/company/hierarchy?datamerge_id={id}
 * Get all entities in the same global ultimate hierarchy.
 * Optional: include_names (bool, charges 1 credit), include_branches, only_subsidiaries, max_level (int), country_code (array), page (int).
 */
export interface CompanyHierarchyParamsV1 {
  datamerge_id: string;
  include_names?: boolean | undefined;
  include_branches?: boolean | undefined;
  only_subsidiaries?: boolean | undefined;
  max_level?: number | undefined;
  country_code?: string[] | undefined;
  page?: number | undefined;
}

/**
 * Response from /v1/company/hierarchy
 */
export interface CompanyHierarchyResponseV1 {
  success: boolean;
  company: CompanyRecordV1;
  parents?: CompanyRecordV1[];
  children?: CompanyRecordV1[];
  [key: string]: unknown;
}

export interface ApiError {
  success: false;
  error: string;
  errors?: Record<string, string[]>;
}

export type ApiResponse<T> = T | ApiError;

// ---------------------------------------------------------------------------
// Contact API
// ---------------------------------------------------------------------------

export interface ContactRecordV1 {
  record_id?: string;
  linkedin_url?: string;
  linkedin_handle?: string;
  firstname?: string;
  lastname?: string;
  email?: string;
  email_status?: string;
  phone?: string;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  headline?: string;
  title?: string;
  company_domain?: string;
  company_display_name?: string;
  company_id?: string;
  status?: string;
  credits_consumed?: number;
  [key: string]: unknown;
}

export interface ContactSearchRequestV1 {
  domains?: string[];
  company_list?: string;
  max_results_per_company?: number;
  job_titles?: {
    include?: Record<string, string[]>;
    exclude?: string[];
  };
  location?: {
    include?: Array<{ type: string; value: string }>;
    exclude?: Array<{ type: string; value: string }>;
  };
  enrich_fields: string[];
  webhook?: string;
  [key: string]: unknown;
}

export interface ContactEnrichRequestV1 {
  contacts: Array<
    | { linkedin_url: string }
    | { firstname: string; lastname: string; domain: string }
  >;
  enrich_fields: string[];
  [key: string]: unknown;
}

export interface ContactJobResponseV1 {
  job_id: string;
  status: string;
  record_ids?: string[];
  type?: string;
  message?: string;
  [key: string]: unknown;
}

export interface ContactGetResponseV1 {
  success: boolean;
  record?: ContactRecordV1;
  contact?: ContactRecordV1;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Lookalike API
// ---------------------------------------------------------------------------

export interface LookalikeCompaniesFiltersV1 {
  lookalikeDomains?: string[];
  primaryLocations?: { includeCountries?: string[]; excludeCountries?: string[] };
  companySizes?: string[];
  revenues?: string[];
  yearFounded?: { min?: number; max?: number };
  [key: string]: unknown;
}

export interface LookalikeRequestV1 {
  companiesFilters: LookalikeCompaniesFiltersV1;
  size?: number;
  list?: string;
  exclude_all?: boolean;
  [key: string]: unknown;
}

export interface LookalikeJobResponseV1 {
  job_id: string;
  status: string;
  message?: string;
  record_ids?: string[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Lists API
// ---------------------------------------------------------------------------

export interface ListRecordV1 {
  id: string;
  name: string;
  slug: string;
  list_type?: string;
  object_type: 'company' | 'contact';
  count?: number;
  is_system?: boolean;
  [key: string]: unknown;
}

export interface ListCreateRequestV1 {
  name: string;
  object_type: 'company' | 'contact';
}

export interface ListItemsParamsV1 {
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Credits / Account API
// ---------------------------------------------------------------------------

export interface CreditsBalanceResponseV1 {
  credits_balance: number;
  balances?: {
    one_off?: number;
    recurring?: number;
    rollover?: number;
    total?: number;
  };
  [key: string]: unknown;
}


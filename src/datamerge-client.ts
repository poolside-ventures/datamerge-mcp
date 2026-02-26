import axios, { AxiosInstance } from 'axios';
import {
  ApiResponse,
  CompanyEnrichJobV1,
  CompanyEnrichRequestV1,
  CompanyEnrichResponseV1,
  CompanyGetParamsV1,
  CompanyGetResponseV1,
  CompanyHierarchyParamsV1,
  CompanyHierarchyResponseV1,
  CompanyRecordV1,
  ContactEnrichRequestV1,
  ContactGetResponseV1,
  ContactJobResponseV1,
  ContactRecordV1,
  ContactSearchRequestV1,
  CreditsBalanceResponseV1,
  DataMergeConfig,
  ListCreateRequestV1,
  ListItemsParamsV1,
  ListRecordV1,
  LookalikeJobResponseV1,
  LookalikeRequestV1,
  StatusResponseV1,
} from './types.js';
import {
  CompanyEnrichRequestV1Schema,
  CompanyGetParamsV1Schema,
  CompanyHierarchyParamsV1Schema,
  ContactEnrichRequestV1Schema,
  ContactSearchRequestV1Schema,
  DataMergeConfigSchema,
  ListCreateRequestV1Schema,
  ListItemsParamsV1Schema,
  LookalikeRequestV1Schema,
} from './schemas.js';

/**
 * DataMerge API Client for interacting with the Company API.
 */
export class DataMergeClient {
  private readonly client: AxiosInstance;
  private readonly config: DataMergeConfig;

  constructor(config: DataMergeConfig) {
    const validatedConfig = DataMergeConfigSchema.parse(config);
    this.config = validatedConfig;

    this.client = axios.create({
      baseURL: validatedConfig.baseUrl ?? 'https://api.datamerge.ai',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      if (this.config.apiKey) {
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Token ${this.config.apiKey}`;
      }
      return config;
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.data) {
          throw new Error(`API Error: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
      },
    );
  }

  /**
   * Normalize a raw company record from the DataMerge API into the
   * library's CompanyRecordV1 shape while preserving all original fields.
   * Derives status: when record has substantial data (legal_name, display_name, etc.) but API sent status "not_found", set status to "success" so agents don't treat it as a failed lookup.
   */
  private mapCompanyRecord(raw: any): CompanyRecordV1 {
    const id =
      (raw && (raw.record_id || raw.id || raw.datamerge_id)) != null
        ? String(raw.record_id ?? raw.id ?? raw.datamerge_id)
        : '';
    const name =
      (raw &&
        (raw.display_name || raw.legal_name || raw.name || raw.domain || 'Unknown')) ??
      'Unknown';

    const base: CompanyRecordV1 = {
      id,
      name,
      domain: raw?.domain ?? null,
      website_url: raw?.website_url ?? null,
      country_code: raw?.country_code ?? null,
      global_ultimate: raw?.global_ultimate ?? null,
      parent_id: raw?.parent_id ?? null,
      ultimate_parent_id: raw?.global_ultimate_id ?? raw?.ultimate_parent_id ?? null,
    };

    const spread = { ...(raw ?? {}) };
    const hasSubstantialData =
      !!(raw?.legal_name || raw?.display_name || raw?.domain || raw?.address1 || raw?.national_id);
    if (
      hasSubstantialData &&
      (spread.status === 'not_found' || spread.status === 'no_query_match')
    ) {
      spread.status = 'success';
    }
    return {
      ...base,
      ...spread,
    };
  }

  /**
   * Map the current /v1/company/enrich response shape into ApiResponse<CompanyEnrichResponseV1>.
   */
  private mapEnrichResponse(
    raw: any,
  ): ApiResponse<CompanyEnrichResponseV1> {
    if (raw && typeof raw === 'object') {
      if ('error' in raw) {
        return {
          success: false,
          error: String((raw as any).error),
        };
      }

      const jobId = String(raw.job_id ?? raw.id ?? '');
      const status = String(raw.status ?? raw.result?.status ?? '');

      const resultsSource: any[] =
        (raw.result && Array.isArray(raw.result.results) && raw.result.results) ||
        (Array.isArray(raw.results) && raw.results) ||
        [];

      const mappedResults = resultsSource.map((r) => this.mapCompanyRecord(r));

      const job: CompanyEnrichJobV1 = {
        id: jobId,
        status,
        results: mappedResults,
      };

      return {
        success: true,
        job,
      };
    }

    return {
      success: false,
      error: 'Unexpected response from DataMerge for company enrichment.',
    };
  }

  /**
   * Map enrichment job status response (e.g. /v1/company/enrich/{job_id}/status or /v1/job/{job_id}/status).
   */
  private mapStatusResponse(
    raw: any,
  ): ApiResponse<StatusResponseV1> {
    if (raw && typeof raw === 'object') {
      if ('error' in raw) {
        return {
          success: false,
          error: String((raw as any).error),
        };
      }

      const result = (raw as any).result ?? raw;

      const jobId = String(result.job_id ?? result.id ?? raw.job_id ?? raw.id ?? '');
      const status = String(raw.status ?? result.status ?? '');

      const resultsSource: any[] =
        (result && Array.isArray(result.results) && result.results) || [];
      const mappedResults = resultsSource.map((r) => this.mapCompanyRecord(r));
      const recordIds = result?.record_ids ?? raw?.record_ids;

      const job: CompanyEnrichJobV1 = {
        id: jobId,
        status,
        results: mappedResults,
        ...(Array.isArray(recordIds) && recordIds.length > 0 ? { record_ids: recordIds } : {}),
      };

      return {
        success: true,
        job,
      };
    }

    return {
      success: false,
      error: 'Unexpected response from DataMerge for job status.',
    };
  }

  /**
   * Map the current /v1/company/get response into ApiResponse<CompanyGetResponseV1>.
   */
  private mapCompanyGetResponse(
    raw: any,
  ): ApiResponse<CompanyGetResponseV1> {
    if (raw && typeof raw === 'object') {
      if ('error' in raw) {
        return {
          success: false,
          error: String((raw as any).error),
        };
      }

      // Current API returns: { id, company_id, success, record: {...} }
      const record = (raw as any).record ?? raw;
      const company = this.mapCompanyRecord(record);

      return {
        success: !!(raw as any).success,
        company,
      };
    }

    return {
      success: false,
      error: 'Unexpected response from DataMerge for company get.',
    };
  }

  /**
   * Start a company enrichment job.
   */
  async startCompanyEnrichment(
    request: CompanyEnrichRequestV1,
  ): Promise<ApiResponse<CompanyEnrichResponseV1>> {
    const validated = CompanyEnrichRequestV1Schema.parse(request);
    
    // Transform the request to match API expectations
    const apiRequest: any = { ...validated };
    
    // Convert country_code to array format if provided as string
    if (apiRequest.country_code !== undefined) {
      if (typeof apiRequest.country_code === 'string') {
        // If it's an empty string, omit it; otherwise convert to array
        if (apiRequest.country_code.trim() === '') {
          delete apiRequest.country_code;
        } else {
          apiRequest.country_code = [apiRequest.country_code];
        }
      } else if (Array.isArray(apiRequest.country_code)) {
        // Filter out empty strings from array
        apiRequest.country_code = apiRequest.country_code.filter((cc: string) => cc && cc.trim() !== '');
        // If array is empty after filtering, omit it
        if (apiRequest.country_code.length === 0) {
          delete apiRequest.country_code;
        }
      }
    }
    
    // Remove empty string values - convert to undefined/omit
    if (apiRequest.webhook_url === '' || apiRequest.webhook_url === undefined) {
      delete apiRequest.webhook_url;
    }
    if (apiRequest.company_name === '' || apiRequest.company_name === undefined) {
      delete apiRequest.company_name;
    }
    if (apiRequest.domain === '' || apiRequest.domain === undefined) {
      delete apiRequest.domain;
    }
    
    const response = await this.client.post('/v1/company/enrich', apiRequest);
    return this.mapEnrichResponse(response.data);
  }

  /**
   * Get the status of an enrichment job.
   * GET /v1/company/enrich/{job_id}/status — poll until status is "completed" or "failed". Response includes record_ids.
   */
  async getCompanyEnrichmentResult(jobId: string): Promise<ApiResponse<StatusResponseV1>> {
    if (!jobId) {
      throw new Error('job_id is required');
    }
    const response = await this.client.get(
      `/v1/company/enrich/${encodeURIComponent(jobId)}/status`,
    );
    return this.mapStatusResponse(response.data);
  }

  /**
   * Get a single company record.
   * GET /v1/company/get?datamerge_id={id} or ?record_id={uuid}. Provide either datamerge_id (charges 1 credit) or record_id (free). Not both. Optional: add_to_list (list slug, only with datamerge_id).
   */
  async getCompany(
    params: CompanyGetParamsV1,
  ): Promise<ApiResponse<CompanyGetResponseV1>> {
    const validated = CompanyGetParamsV1Schema.parse(params) as CompanyGetParamsV1;
    const apiParams: Record<string, string> = {};
    if (validated.datamerge_id) apiParams['datamerge_id'] = validated.datamerge_id;
    if (validated.record_id) apiParams['record_id'] = validated.record_id;
    if (validated.add_to_list) apiParams['add_to_list'] = validated.add_to_list;
    const response = await this.client.get('/v1/company/get', { params: apiParams });
    return this.mapCompanyGetResponse(response.data);
  }

  /**
   * Get the corporate hierarchy for a company.
   * GET /v1/company/hierarchy?datamerge_id={id}. Get all entities in the same global ultimate hierarchy. Optional: include_names (bool, charges 1 credit), include_branches, only_subsidiaries, max_level (int), country_code (array), page (int).
   */
  async getCompanyHierarchy(
    params: CompanyHierarchyParamsV1,
  ): Promise<ApiResponse<CompanyHierarchyResponseV1>> {
    const validated = CompanyHierarchyParamsV1Schema.parse(params) as CompanyHierarchyParamsV1;
    const response = await this.client.get('/v1/company/hierarchy', { params: validated });
    const raw = response.data as any;
    const data = raw && typeof raw === 'object' && (raw.result ?? raw.data) ? (raw.result ?? raw.data) : raw;
    if (data && typeof data === 'object' && 'error' in data) {
      return { success: false, error: String(data.error) } as ApiResponse<CompanyHierarchyResponseV1>;
    }
    // API may return { company, parents, children } or { entities } or similar; normalize to our shape with success: true
    const company = data?.company ?? data?.record ?? (Array.isArray(data?.entities) ? data.entities[0] : null);
    const parents = data?.parents ?? data?.parent_companies ?? [];
    const children = data?.children ?? data?.subsidiaries ?? [];
    const entities = Array.isArray(data?.entities) ? data.entities : [];
    const mapOne = (r: any) => this.mapCompanyRecord(r);
    const mappedParents = Array.isArray(parents) ? parents.map(mapOne) : [];
    const mappedChildren = Array.isArray(children) ? children.map(mapOne) : [];
    const mappedCompany = company ? mapOne(company) : (entities.length > 0 ? mapOne(entities[0]) : null);
    return {
      success: true,
      company: mappedCompany ?? ({} as CompanyRecordV1),
      parents: mappedParents,
      children: mappedChildren.length > 0 ? mappedChildren : (entities.length > 1 ? entities.slice(1).map(mapOne) : []),
    };
  }

  // -------------------------------------------------------------------------
  // Lookalike API
  // -------------------------------------------------------------------------

  /**
   * Start a lookalike companies job (POST /v1/company/lookalike). Returns job_id.
   */
  async startLookalike(
    request: LookalikeRequestV1,
  ): Promise<ApiResponse<LookalikeJobResponseV1>> {
    const validated = LookalikeRequestV1Schema.parse(request);
    const response = await this.client.post('/v1/company/lookalike', validated);
    const data = response.data as any;
    if (data?.error) {
      return { success: false, error: String(data.error) } as ApiResponse<LookalikeJobResponseV1>;
    }
    return {
      success: true,
      job_id: String(data.job_id ?? data.id ?? ''),
      status: String(data.status ?? 'queued'),
      message: data.message,
      record_ids: data.record_ids,
    };
  }

  /**
   * Get lookalike job status (GET /v1/company/lookalike/{job_id}/status).
   */
  async getLookalikeStatus(
    jobId: string,
  ): Promise<ApiResponse<LookalikeJobResponseV1>> {
    if (!jobId) throw new Error('job_id is required');
    const response = await this.client.get(
      `/v1/company/lookalike/${encodeURIComponent(jobId)}/status`,
    );
    const data = response.data as any;
    if (data?.error) {
      return { success: false, error: String(data.error) } as ApiResponse<LookalikeJobResponseV1>;
    }
    return {
      success: true,
      job_id: String(data.job_id ?? data.id ?? jobId),
      status: String(data.status ?? ''),
      message: data.message,
      record_ids: data.record_ids,
    };
  }

  // -------------------------------------------------------------------------
  // Contact API
  // -------------------------------------------------------------------------

  /**
   * Search for contacts at companies (POST /v1/contact/search). Returns job_id.
   */
  async contactSearch(
    request: ContactSearchRequestV1,
  ): Promise<ApiResponse<ContactJobResponseV1>> {
    const validated = ContactSearchRequestV1Schema.parse(request);
    const response = await this.client.post('/v1/contact/search', validated);
    const data = response.data as any;
    if (data?.error) {
      return { success: false, error: String(data.error) } as ApiResponse<ContactJobResponseV1>;
    }
    return {
      success: true,
      job_id: String(data.job_id ?? data.id ?? ''),
      status: String(data.status ?? 'queued'),
      record_ids: data.record_ids,
      type: data.type,
      message: data.message,
    };
  }

  /**
   * Get contact search job status (GET /v1/contact/search/{job_id}/status).
   */
  async getContactSearchStatus(
    jobId: string,
  ): Promise<ApiResponse<ContactJobResponseV1>> {
    if (!jobId) throw new Error('job_id is required');
    const response = await this.client.get(
      `/v1/contact/search/${encodeURIComponent(jobId)}/status`,
    );
    const data = response.data as any;
    if (data?.error) {
      return { success: false, error: String(data.error) } as ApiResponse<ContactJobResponseV1>;
    }
    return {
      success: true,
      job_id: String(data.job_id ?? data.id ?? jobId),
      status: String(data.status ?? ''),
      record_ids: data.record_ids,
      type: data.type,
      message: data.message,
    };
  }

  /**
   * Enrich contacts by LinkedIn URL or name+domain (POST /v1/contact/enrich). Returns job_id.
   */
  async contactEnrich(
    request: ContactEnrichRequestV1,
  ): Promise<ApiResponse<ContactJobResponseV1>> {
    const validated = ContactEnrichRequestV1Schema.parse(request);
    const response = await this.client.post('/v1/contact/enrich', validated);
    const data = response.data as any;
    if (data?.error) {
      return { success: false, error: String(data.error) } as ApiResponse<ContactJobResponseV1>;
    }
    return {
      success: true,
      job_id: String(data.job_id ?? data.id ?? ''),
      status: String(data.status ?? 'queued'),
      record_ids: data.record_ids,
      type: data.type,
      message: data.message,
    };
  }

  /**
   * Get contact enrichment job status (GET /v1/contact/enrich/{job_id}/status).
   */
  async getContactEnrichStatus(
    jobId: string,
  ): Promise<ApiResponse<ContactJobResponseV1>> {
    if (!jobId) throw new Error('job_id is required');
    const response = await this.client.get(
      `/v1/contact/enrich/${encodeURIComponent(jobId)}/status`,
    );
    const data = response.data as any;
    if (data?.error) {
      return { success: false, error: String(data.error) } as ApiResponse<ContactJobResponseV1>;
    }
    return {
      success: true,
      job_id: String(data.job_id ?? data.id ?? jobId),
      status: String(data.status ?? ''),
      record_ids: data.record_ids,
      type: data.type,
      message: data.message,
    };
  }

  /**
   * Get a contact by record_id (GET /v1/contact/get). Does not charge credits.
   */
  async getContact(recordId: string): Promise<ApiResponse<ContactGetResponseV1>> {
    if (!recordId) throw new Error('record_id is required');
    const response = await this.client.get('/v1/contact/get', {
      params: { record_id: recordId },
    });
    const data = response.data as any;
    if (data?.error) {
      return { success: false, error: String(data.error) } as ApiResponse<ContactGetResponseV1>;
    }
    const record = data?.record ?? data?.contact ?? data;
    return {
      success: !!data?.success,
      record: record as ContactRecordV1,
      contact: record as ContactRecordV1,
    };
  }

  // -------------------------------------------------------------------------
  // Lists API
  // -------------------------------------------------------------------------

  /**
   * Get all lists (GET /v1/lists). Optional object_type: company | contact.
   */
  async listLists(objectType?: 'company' | 'contact'): Promise<{
    success: boolean;
    lists?: ListRecordV1[];
    error?: string;
  }> {
    try {
      const params = objectType ? { object_type: objectType } : {};
      const response = await this.client.get('/v1/lists', { params });
      const data = response.data as any;
      if (data?.error) {
        return { success: false, error: String(data.error) };
      }
      return {
        success: true,
        lists: Array.isArray(data.lists) ? data.lists : Array.isArray(data) ? data : [],
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data ? JSON.stringify(err.response.data) : err.message,
      };
    }
  }

  /**
   * Create a list (POST /v1/lists).
   */
  async createList(
    request: ListCreateRequestV1,
  ): Promise<{ success: boolean; list?: ListRecordV1; error?: string }> {
    const validated = ListCreateRequestV1Schema.parse(request);
    const response = await this.client.post('/v1/lists', validated);
    const data = response.data as any;
    if (data?.error) {
      return { success: false, error: String(data.error) };
    }
    return { success: true, list: data?.list ?? data };
  }

  /**
   * Get list items (GET /v1/lists/{object_type}/{list_slug}).
   */
  async getListItems(
    objectType: 'company' | 'contact',
    listSlug: string,
    params?: ListItemsParamsV1,
  ): Promise<{ success: boolean; items?: unknown[]; error?: string }> {
    const validated = params ? ListItemsParamsV1Schema.parse(params) : {};
    const response = await this.client.get(
      `/v1/lists/${encodeURIComponent(objectType)}/${encodeURIComponent(listSlug)}`,
      { params: validated },
    );
    const data = response.data as any;
    if (data?.error) {
      return { success: false, error: String(data.error) };
    }
    return {
      success: true,
      items: data?.items ?? data?.results ?? data?.data ?? [],
    };
  }

  /**
   * Remove an item from a list (DELETE /v1/lists/{object_type}/{list_slug}/{item_id}).
   */
  async removeListItem(
    objectType: 'company' | 'contact',
    listSlug: string,
    itemId: string,
  ): Promise<{ success: boolean; error?: string }> {
    await this.client.delete(
      `/v1/lists/${encodeURIComponent(objectType)}/${encodeURIComponent(listSlug)}/${encodeURIComponent(itemId)}`,
    );
    return { success: true };
  }

  /**
   * Delete a list (DELETE /v1/lists/{object_type}/{list_slug}). System lists cannot be deleted.
   */
  async deleteList(
    objectType: 'company' | 'contact',
    listSlug: string,
  ): Promise<{ success: boolean; error?: string }> {
    await this.client.delete(
      `/v1/lists/${encodeURIComponent(objectType)}/${encodeURIComponent(listSlug)}`,
    );
    return { success: true };
  }

  // -------------------------------------------------------------------------
  // Account / Credits API
  // -------------------------------------------------------------------------

  /**
   * Get credits balance (GET /v1/credits/balance).
   */
  async getCreditsBalance(): Promise<
    ApiResponse<CreditsBalanceResponseV1>
  > {
    try {
      const response = await this.client.get('/v1/credits/balance');
      const data = response.data as any;
      if (data?.error) {
        return { success: false, error: String(data.error) } as ApiResponse<CreditsBalanceResponseV1>;
      }
      return {
        success: true,
        credits_balance: data.credits_balance ?? data.balances?.total ?? 0,
        balances: data.balances,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data ? JSON.stringify(err.response.data) : err.message,
      } as ApiResponse<CreditsBalanceResponseV1>;
    }
  }

  /**
   * Basic health check using the /auth/info endpoint.
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/auth/info', {
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  getConfig(): DataMergeConfig {
    return { ...this.config };
  }
}



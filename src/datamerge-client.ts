import axios, { AxiosInstance } from 'axios';
import {
  ApiResponse,
  CompanyEnrichJobV1,
  CompanyEnrichRequestV1,
  CompanyEnrichResponseV1,
  CompanyGetParamsV1,
  CompanyGetResponseV1,
  CompanyHierarchyResponseV1,
  CompanyRecordV1,
  DataMergeConfig,
  StatusResponseV1,
} from './types.js';
import {
  CompanyEnrichRequestV1Schema,
  CompanyGetParamsV1Schema,
  DataMergeConfigSchema,
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
   */
  private mapCompanyRecord(raw: any): CompanyRecordV1 {
    const id =
      (raw && (raw.record_id || raw.id)) != null ? String(raw.record_id ?? raw.id) : '';
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

    return {
      ...base,
      ...(raw ?? {}),
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
   * Map the current /v1/job/{job_id}/status response into ApiResponse<StatusResponseV1>.
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
    const response = await this.client.post('/v1/company/enrich', validated);
    return this.mapEnrichResponse(response.data);
  }

  /**
   * Get the status of an enrichment job.
   */
  async getCompanyEnrichmentResult(jobId: string): Promise<ApiResponse<StatusResponseV1>> {
    if (!jobId) {
      throw new Error('job_id is required');
    }
    const response = await this.client.get(`/v1/job/${encodeURIComponent(jobId)}/status`);
    return this.mapStatusResponse(response.data);
  }

  /**
   * Get a single company record.
   */
  async getCompany(
    params: CompanyGetParamsV1,
  ): Promise<ApiResponse<CompanyGetResponseV1>> {
    const validated = CompanyGetParamsV1Schema.parse(params);
    const response = await this.client.get('/v1/company/get', { params: validated });
    return this.mapCompanyGetResponse(response.data);
  }

  /**
   * Get the corporate hierarchy for a company.
   */
  async getCompanyHierarchy(
    params: CompanyGetParamsV1,
  ): Promise<ApiResponse<CompanyHierarchyResponseV1>> {
    const validated = CompanyGetParamsV1Schema.parse(params);
    const response = await this.client.get<ApiResponse<CompanyHierarchyResponseV1>>(
      '/v1/company/hierarchy',
      { params: validated },
    );
    return response.data;
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



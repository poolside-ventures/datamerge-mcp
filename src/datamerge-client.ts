import axios, { AxiosInstance } from 'axios';
import {
  ApiResponse,
  CompanyEnrichRequestV1,
  CompanyEnrichResponseV1,
  CompanyGetParamsV1,
  CompanyGetResponseV1,
  CompanyHierarchyResponseV1,
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
   * Start a company enrichment job.
   */
  async startCompanyEnrichment(
    request: CompanyEnrichRequestV1,
  ): Promise<ApiResponse<CompanyEnrichResponseV1>> {
    const validated = CompanyEnrichRequestV1Schema.parse(request);
    const response = await this.client.post<ApiResponse<CompanyEnrichResponseV1>>(
      '/v1/company/enrich',
      validated,
    );
    return response.data;
  }

  /**
   * Get the status of an enrichment job.
   */
  async getCompanyEnrichmentResult(jobId: string): Promise<ApiResponse<StatusResponseV1>> {
    if (!jobId) {
      throw new Error('job_id is required');
    }
    const response = await this.client.get<ApiResponse<StatusResponseV1>>(
      `/v1/job/${encodeURIComponent(jobId)}/status`,
    );
    return response.data;
  }

  /**
   * Get a single company record.
   */
  async getCompany(
    params: CompanyGetParamsV1,
  ): Promise<ApiResponse<CompanyGetResponseV1>> {
    const validated = CompanyGetParamsV1Schema.parse(params);
    const response = await this.client.get<ApiResponse<CompanyGetResponseV1>>(
      '/v1/company/get',
      { params: validated },
    );
    return response.data;
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



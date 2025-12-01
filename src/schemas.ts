import { z } from 'zod';

/**
 * Zod schemas for runtime validation of DataMerge API data
 */

const CompanyRecordBaseSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    domain: z.string().nullable().optional(),
    website_url: z.string().url().nullable().optional(),
    country_code: z.string().nullable().optional(),
    global_ultimate: z.boolean().nullable().optional(),
    parent_id: z.string().nullable().optional(),
    ultimate_parent_id: z.string().nullable().optional(),
  })
  .catchall(z.unknown());

export const CompanyRecordV1Schema = CompanyRecordBaseSchema;

const CompanyEnrichRequestBaseSchema = z
  .object({
    domain: z.string().optional(),
    company_name: z.string().optional(),
    country_code: z.string().optional(),
    strict_match: z.boolean().optional(),
    global_ultimate: z.boolean().optional(),
    webhook_url: z.string().url().optional(),
  })
  .catchall(z.unknown());

export const CompanyEnrichRequestV1Schema = CompanyEnrichRequestBaseSchema.refine(
  (data) => !!data.domain || !!data.company_name,
  {
    message: 'Either domain or company_name must be provided',
    path: ['domain'],
  },
);

const CompanyEnrichJobBaseSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    created_at: z.string(),
    updated_at: z.string().optional(),
    results: z.array(CompanyRecordV1Schema).optional(),
  })
  .catchall(z.unknown());

export const CompanyEnrichJobV1Schema = CompanyEnrichJobBaseSchema;

export const CompanyEnrichResponseV1Schema = z.object({
  success: z.boolean(),
  job: CompanyEnrichJobV1Schema,
});

export const StatusResponseV1Schema = z.object({
  success: z.boolean(),
  job: CompanyEnrichJobV1Schema,
});

export const CompanyGetParamsV1Schema = z
  .object({
    company_id: z.string().optional(),
    domain: z.string().optional(),
    company_name: z.string().optional(),
    country_code: z.string().optional(),
  })
  .refine(
    (data) => !!data.company_id || !!data.domain || !!data.company_name,
    {
      message: 'At least one of company_id, domain, or company_name must be provided',
      path: ['company_id'],
    },
  );

export const CompanyGetResponseV1Schema = z.object({
  success: z.boolean(),
  company: CompanyRecordV1Schema,
});

export const CompanyHierarchyResponseV1Schema = z.object({
  success: z.boolean(),
  company: CompanyRecordV1Schema,
  parents: z.array(CompanyRecordV1Schema).optional(),
  children: z.array(CompanyRecordV1Schema).optional(),
});

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  errors: z.record(z.array(z.string())).optional(),
});

export const DataMergeConfigSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
});

// Type exports from schemas
export type ValidatedCompanyRecordV1 = z.infer<typeof CompanyRecordV1Schema>;
export type ValidatedCompanyEnrichRequestV1 = z.infer<typeof CompanyEnrichRequestV1Schema>;
export type ValidatedCompanyEnrichResponseV1 = z.infer<typeof CompanyEnrichResponseV1Schema>;
export type ValidatedStatusResponseV1 = z.infer<typeof StatusResponseV1Schema>;
export type ValidatedCompanyGetParamsV1 = z.infer<typeof CompanyGetParamsV1Schema>;
export type ValidatedCompanyGetResponseV1 = z.infer<typeof CompanyGetResponseV1Schema>;
export type ValidatedCompanyHierarchyResponseV1 = z.infer<typeof CompanyHierarchyResponseV1Schema>;
export type ValidatedDataMergeConfig = z.infer<typeof DataMergeConfigSchema>;


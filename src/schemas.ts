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
    domains: z.array(z.string()).optional(),
    company_name: z.string().optional(),
    country_code: z.union([z.string(), z.array(z.string())]).optional(),
    strict_match: z.boolean().optional(),
    global_ultimate: z.boolean().optional(),
    webhook_url: z
      .union([z.string().url(), z.literal('')])
      .optional()
      .transform((val) => (val === '' ? undefined : val)),
    list: z.string().optional(),
    skip_if_exists: z.boolean().optional(),
  })
  .catchall(z.unknown());

export const CompanyEnrichRequestV1Schema = CompanyEnrichRequestBaseSchema.refine(
  (data) =>
    !!data.domain ||
    (Array.isArray(data.domains) && data.domains.length > 0) ||
    !!data.company_name,
  {
    message: 'Either domain, domains (array), or company_name must be provided',
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
    datamerge_id: z.string().optional(),
    record_id: z.string().optional(),
    add_to_list: z.string().optional(),
  })
  .refine((data) => !!data.datamerge_id !== !!data.record_id, {
    message: 'Provide either datamerge_id or record_id, not both and not neither.',
    path: ['datamerge_id'],
  })
  .refine(
    (data) => !data.add_to_list || !!data.datamerge_id,
    { message: 'add_to_list is only valid with datamerge_id.', path: ['add_to_list'] },
  );

export const CompanyHierarchyParamsV1Schema = z.object({
  datamerge_id: z.string().min(1),
  include_names: z.boolean().optional(),
  include_branches: z.boolean().optional(),
  only_subsidiaries: z.boolean().optional(),
  max_level: z.number().int().optional(),
  country_code: z.array(z.string()).optional(),
  page: z.number().int().optional(),
});

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

// Contact API schemas
export const ContactSearchRequestV1Schema = z.object({
  domains: z.array(z.string()).optional(),
  company_list: z.string().optional(),
  max_results_per_company: z.number().int().optional(),
  job_titles: z
    .object({
      include: z.record(z.array(z.string())).optional(),
      exclude: z.array(z.string()).optional(),
    })
    .optional(),
  location: z
    .object({
      include: z.array(z.object({ type: z.string(), value: z.string() })).optional(),
      exclude: z.array(z.object({ type: z.string(), value: z.string() })).optional(),
    })
    .optional(),
  enrich_fields: z.array(z.string()).min(1),
  webhook: z.string().url().optional(),
});

export const ContactEnrichRequestV1Schema = z.object({
  contacts: z.array(
    z.union([
      z.object({ linkedin_url: z.string() }),
      z.object({
        firstname: z.string(),
        lastname: z.string(),
        domain: z.string(),
      }),
    ]),
  ),
  enrich_fields: z.array(z.string()).min(1),
});

// Lookalike API schemas
export const LookalikeCompaniesFiltersV1Schema = z.object({
  lookalikeDomains: z.array(z.string()).optional(),
  primaryLocations: z
    .object({
      includeCountries: z.array(z.string()).optional(),
      excludeCountries: z.array(z.string()).optional(),
    })
    .optional(),
  companySizes: z.array(z.string()).optional(),
  revenues: z.array(z.string()).optional(),
  yearFounded: z.object({ min: z.number().optional(), max: z.number().optional() }).optional(),
});

export const LookalikeRequestV1Schema = z.object({
  companiesFilters: LookalikeCompaniesFiltersV1Schema,
  size: z.number().int().optional(),
  list: z.string().optional(),
  exclude_all: z.boolean().optional(),
});

// Lists API schemas
export const ListCreateRequestV1Schema = z.object({
  name: z.string().min(1),
  object_type: z.enum(['company', 'contact']),
});

export const ListItemsParamsV1Schema = z.object({
  page: z.number().int().optional(),
  page_size: z.number().int().max(100).optional(),
  sort_by: z.string().optional(),
  sort_order: z.enum(['asc', 'desc']).optional(),
});

// Type exports from schemas
export type ValidatedCompanyRecordV1 = z.infer<typeof CompanyRecordV1Schema>;
export type ValidatedCompanyEnrichRequestV1 = z.infer<typeof CompanyEnrichRequestV1Schema>;
export type ValidatedCompanyEnrichResponseV1 = z.infer<typeof CompanyEnrichResponseV1Schema>;
export type ValidatedStatusResponseV1 = z.infer<typeof StatusResponseV1Schema>;
export type ValidatedCompanyGetParamsV1 = z.infer<typeof CompanyGetParamsV1Schema>;
export type ValidatedCompanyGetResponseV1 = z.infer<typeof CompanyGetResponseV1Schema>;
export type ValidatedCompanyHierarchyResponseV1 = z.infer<typeof CompanyHierarchyResponseV1Schema>;
export type ValidatedCompanyHierarchyParamsV1 = z.infer<typeof CompanyHierarchyParamsV1Schema>;
export type ValidatedDataMergeConfig = z.infer<typeof DataMergeConfigSchema>;
export type ValidatedContactSearchRequestV1 = z.infer<typeof ContactSearchRequestV1Schema>;
export type ValidatedContactEnrichRequestV1 = z.infer<typeof ContactEnrichRequestV1Schema>;
export type ValidatedLookalikeRequestV1 = z.infer<typeof LookalikeRequestV1Schema>;
export type ValidatedListCreateRequestV1 = z.infer<typeof ListCreateRequestV1Schema>;
export type ValidatedListItemsParamsV1 = z.infer<typeof ListItemsParamsV1Schema>;


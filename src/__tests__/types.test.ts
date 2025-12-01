import {
  CompanyRecordV1Schema,
  CompanyEnrichRequestV1Schema,
  CompanyGetParamsV1Schema,
  DataMergeConfigSchema,
} from '../schemas';

describe('DataMerge API Schemas', () => {
  describe('CompanyRecordV1Schema', () => {
    it('should validate a minimal company record', () => {
      const validCompany = {
        id: 'cmp_123',
        name: 'Example Inc',
      };

      const result = CompanyRecordV1Schema.safeParse(validCompany);
      expect(result.success).toBe(true);
    });
  });

  describe('CompanyEnrichRequestV1Schema', () => {
    it('should require either domain or company_name', () => {
      const invalid = {};
      const result = CompanyEnrichRequestV1Schema.safeParse(invalid);
      expect(result.success).toBe(false);

      const withDomain = { domain: 'example.com' };
      const ok1 = CompanyEnrichRequestV1Schema.safeParse(withDomain);
      expect(ok1.success).toBe(true);

      const withName = { company_name: 'Example Inc' };
      const ok2 = CompanyEnrichRequestV1Schema.safeParse(withName);
      expect(ok2.success).toBe(true);
    });
  });

  describe('CompanyGetParamsV1Schema', () => {
    it('should require at least one identifier', () => {
      const invalid = {};
      const result = CompanyGetParamsV1Schema.safeParse(invalid);
      expect(result.success).toBe(false);

      const withId = { company_id: 'cmp_123' };
      const ok1 = CompanyGetParamsV1Schema.safeParse(withId);
      expect(ok1.success).toBe(true);
    });
  });

  describe('DataMergeConfigSchema', () => {
    it('should validate valid config', () => {
      const validConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'https://api.datamerge.ai',
      };

      const result = DataMergeConfigSchema.safeParse(validConfig);
      expect(result.success).toBe(true);
    });

    it('should reject missing apiKey', () => {
      const invalidConfig = {};
      const result = DataMergeConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });
});

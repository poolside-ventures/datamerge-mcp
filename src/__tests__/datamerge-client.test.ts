import { DataMergeClient } from '../datamerge-client';
import { DataMergeConfig } from '../types';

jest.mock('axios');
const mockAxios = require('axios');

describe('DataMergeClient', () => {
  let client: DataMergeClient;
  const mockConfig: DataMergeConfig = {
    apiKey: 'test-api-key',
    baseUrl: 'https://api.datamerge.ai',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAxios.create.mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    });
  });

  describe('constructor', () => {
    it('should create client with valid config', () => {
      expect(() => new DataMergeClient(mockConfig)).not.toThrow();
    });

    it('should create axios instance with correct baseURL', () => {
      new DataMergeClient(mockConfig);
      expect(mockAxios.create).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'https://api.datamerge.ai',
          timeout: 30000,
        }),
      );
    });
  });

  describe('getConfig', () => {
    beforeEach(() => {
      client = new DataMergeClient(mockConfig);
    });

    it('should return a copy of the configuration', () => {
      const config = client.getConfig();
      expect(config).toEqual(mockConfig);
      expect(config).not.toBe(mockConfig);
    });
  });
});



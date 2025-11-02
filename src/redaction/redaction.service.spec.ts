import { RedactionService } from './redaction.service';
import { Test, TestingModule } from '@nestjs/testing';
import { Matcher } from './matcher';

// Mock GCS Storage
jest.mock('@google-cloud/storage', () => {
  return {
    Storage: jest.fn().mockImplementation(() => {
      return {
        bucket: jest.fn().mockReturnValue({
          file: jest.fn().mockReturnValue({
            exists: jest.fn().mockResolvedValue([true]),
            download: jest.fn().mockResolvedValue([Buffer.from('john\njane\ndoe')]),
          }),
        }),
      };
    }),
  };
});

describe('RedactionService', () => {
  let service: RedactionService;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    process.env.MCP_PROXY_GCS_BUCKET = 'test-bucket';
    process.env.MCP_PROXY_SERVICE_ACCOUNT = JSON.stringify({
      type: 'service_account',
      project_id: 'test-project',
      private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
      client_email: 'test@test.iam.gserviceaccount.com',
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [RedactionService],
    }).compile();

    service = module.get<RedactionService>(RedactionService);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('initialize', () => {
    it('should initialize successfully with valid dictionary', async () => {
      await service.initialize();
      const { matcher, error } = await service.getService();
      expect(matcher).toBeDefined();
      expect(error).toBeNull();
    });

    it('should only initialize once', async () => {
      await service.initialize();
      await service.initialize(); // Second call should not re-initialize
      const { matcher } = await service.getService();
      expect(matcher).toBeDefined();
    });

    it('should throw error if MCP_PROXY_GCS_BUCKET is not set', async () => {
      delete process.env.MCP_PROXY_GCS_BUCKET;
      const newService = new RedactionService();
      await newService.initialize();
      const { error } = await newService.getService();
      expect(error).toBeDefined();
      expect(error?.message).toContain('MCP_PROXY_GCS_BUCKET');
    });

    it('should throw error if service account is not set', async () => {
      delete process.env.MCP_PROXY_SERVICE_ACCOUNT;
      delete process.env.MCP_PROXY_SERVICE_ACCOUNT_B64;
      const newService = new RedactionService();
      await newService.initialize();
      const { error } = await newService.getService();
      expect(error).toBeDefined();
      expect(error?.message).toContain('SERVICE_ACCOUNT');
    });
  });

  describe('getService', () => {
    it('should auto-initialize if not initialized', async () => {
      const { matcher, error } = await service.getService();
      expect(matcher).toBeDefined();
      expect(error).toBeNull();
    });

    it('should return error if initialization failed', async () => {
      delete process.env.MCP_PROXY_GCS_BUCKET;
      const newService = new RedactionService();
      const { matcher, error } = await newService.getService();
      expect(matcher).toBeNull();
      expect(error).toBeDefined();
    });
  });

  describe('redactResponse', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return original data if config is null', () => {
      const data = { name: 'john', email: 'test@example.com' };
      const result = service.redactResponse(data, null);
      expect(result).toEqual(data);
    });

    it('should return original data if config is undefined', () => {
      const data = { name: 'john', email: 'test@example.com' };
      const result = service.redactResponse(data, undefined);
      expect(result).toEqual(data);
    });

    it('should return original data if redaction is disabled', () => {
      const data = { name: 'john', email: 'test@example.com' };
      const result = service.redactResponse(data, { enabled: false });
      expect(result).toEqual(data);
    });

    it('should return original data if matcher is not initialized', async () => {
      const newService = new RedactionService();
      const data = { name: 'john', email: 'test@example.com' };
      const result = newService.redactResponse(data, { enabled: true });
      expect(result).toEqual(data);
    });

    it('should redact all strings when no keys specified', () => {
      const data = { name: 'john', age: 25 };
      const result = service.redactResponse(data, { enabled: true });
      expect(result.name).toBe('[REDACTED]');
      expect(result.age).toBe(25);
    });

    it('should redact all strings when keys is empty array', () => {
      const data = { name: 'john', age: 25 };
      const result = service.redactResponse(data, { enabled: true, keys: [] });
      expect(result.name).toBe('[REDACTED]');
      expect(result.age).toBe(25);
    });

    it('should redact only specified keys', () => {
      const data = { name: 'john', description: 'this is a description', age: 25 };
      const result = service.redactResponse(data, { enabled: true, keys: ['name'] });
      expect(result.name).toBe('[REDACTED]');
      expect(result.description).toBe('this is a description'); // Not redacted
      expect(result.age).toBe(25);
    });

    it('should handle nested objects when redacting all strings', () => {
      const data = { user: { name: 'john', email: 'test@test.com' } };
      const result = service.redactResponse(data, { enabled: true });
      expect(result.user.name).toBe('[REDACTED]');
    });

    it('should handle nested objects when redacting by keys', () => {
      const data = { user: { name: 'john', age: 25 } };
      const result = service.redactResponse(data, { enabled: true, keys: ['name'] });
      expect(result.user.name).toBe('[REDACTED]');
      expect(result.user.age).toBe(25);
    });

    it('should handle arrays when redacting all strings', () => {
      const data = { names: ['john', 'jane', 'bob'] };
      const result = service.redactResponse(data, { enabled: true });
      expect(result.names[0]).toBe('[REDACTED]');
      expect(result.names[1]).toBe('[REDACTED]');
    });

    it('should handle arrays when redacting by keys', () => {
      const data = { names: ['john', 'jane'], ages: [25, 30] };
      const result = service.redactResponse(data, { enabled: true, keys: ['names'] });
      expect(result.names[0]).toBe('[REDACTED]');
      expect(result.names[1]).toBe('[REDACTED]');
      expect(result.ages).toEqual([25, 30]);
    });

    it('should handle arrays of objects when redacting all strings', () => {
      const data = { users: [{ name: 'john' }, { name: 'jane' }] };
      const result = service.redactResponse(data, { enabled: true });
      expect(result.users[0].name).toBe('[REDACTED]');
      expect(result.users[1].name).toBe('[REDACTED]');
    });

    it('should handle arrays of objects when redacting by keys', () => {
      const data = { users: [{ name: 'john', age: 25 }] };
      const result = service.redactResponse(data, { enabled: true, keys: ['name'] });
      expect(result.users[0].name).toBe('[REDACTED]');
      expect(result.users[0].age).toBe(25);
    });

    it('should redact generic PII (emails, phones) before dictionary terms', () => {
      const data = { contact: 'john at john@example.com' };
      const result = service.redactResponse(data, { enabled: true });
      expect(result.contact).toBe('[REDACTED] at [REDACTED]');
    });

    it('should handle non-string values correctly', () => {
      const data = {
        string: 'john',
        number: 42,
        boolean: true,
        null: null,
        undefined: undefined,
      };
      const result = service.redactResponse(data, { enabled: true });
      expect(result.string).toBe('[REDACTED]');
      expect(result.number).toBe(42);
      expect(result.boolean).toBe(true);
      expect(result.null).toBeNull();
      expect(result.undefined).toBeUndefined();
    });

    it('should handle deeply nested structures', () => {
      const data = {
        level1: {
          level2: {
            level3: {
              name: 'john',
            },
          },
        },
      };
      const result = service.redactResponse(data, { enabled: true });
      expect(result.level1.level2.level3.name).toBe('[REDACTED]');
    });

    it('should handle mixed arrays and objects', () => {
      const data = {
        users: [
          { name: 'john', contacts: ['john@test.com', 'jane@test.com'] },
          { name: 'jane', contacts: [] },
        ],
      };
      const result = service.redactResponse(data, { enabled: true });
      expect(result.users[0].name).toBe('[REDACTED]');
      expect(result.users[0].contacts[0]).toBe('[REDACTED]');
      expect(result.users[1].name).toBe('[REDACTED]');
    });

    it('should handle keys at different nesting levels', () => {
      const data = {
        name: 'john',
        user: {
          name: 'jane',
          profile: {
            name: 'doe',
          },
        },
      };
      const result = service.redactResponse(data, { enabled: true, keys: ['name'] });
      expect(result.name).toBe('[REDACTED]');
      expect(result.user.name).toBe('[REDACTED]');
      expect(result.user.profile.name).toBe('[REDACTED]');
    });

    it('should redact nested values when key matches', () => {
      const data = {
        user: {
          name: 'john',
          details: { age: 25, name: 'jane' },
        },
      };
      const result = service.redactResponse(data, { enabled: true, keys: ['name'] });
      // When a key matches, redact all strings in its value
      expect(result.user.name).toBe('[REDACTED]');
      expect(result.user.details.name).toBe('[REDACTED]');
    });
  });

  describe('getServiceAccountJSON with base64', () => {
    it('should decode base64 service account', async () => {
      const serviceAccount = {
        type: 'service_account',
        project_id: 'test',
        private_key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
      };
      const encoded = Buffer.from(JSON.stringify(serviceAccount)).toString('base64');
      
      delete process.env.MCP_PROXY_SERVICE_ACCOUNT;
      process.env.MCP_PROXY_SERVICE_ACCOUNT_B64 = encoded;

      const newService = new RedactionService();
      await newService.initialize();
      const { error } = await newService.getService();
      expect(error).toBeNull();
    });

    it('should handle private key with escaped newlines', async () => {
      const serviceAccount = {
        type: 'service_account',
        project_id: 'test',
        private_key: '-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----',
        client_email: 'test@test.com',
      };
      
      process.env.MCP_PROXY_SERVICE_ACCOUNT = JSON.stringify(serviceAccount);

      const newService = new RedactionService();
      await newService.initialize();
      const { error } = await newService.getService();
      expect(error).toBeNull();
    });
  });
});


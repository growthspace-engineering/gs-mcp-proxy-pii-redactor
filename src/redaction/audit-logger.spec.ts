import { AuditLogger } from './audit-logger';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

jest.mock('fs');
jest.mock('uuid');

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;
  const mockUuid = 'test-uuid-123';
  const testClientName = 'test-client';

  beforeEach(() => {
    jest.clearAllMocks();
    (uuidv4 as jest.Mock).mockReturnValue(mockUuid);
    (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);
    auditLogger = new AuditLogger(testClientName);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create audit directory on initialization', () => {
      const expectedDir = path.join(process.cwd(), 'redaction_audit', testClientName);
      expect(fs.mkdirSync).toHaveBeenCalledWith(expectedDir, { recursive: true, mode: 0o755 });
    });

    it('should throw error if directory creation fails', () => {
      const error = new Error('Permission denied');
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {
        throw error;
      });

      expect(() => new AuditLogger(testClientName)).toThrow('Permission denied');
    });
  });

  describe('logOperation', () => {
    const mockConfig = {
      enabled: true,
      verboseAudit: true,
      keys: ['test'],
    };
    const mockPreData = { content: 'pre-data' };
    const mockPostData = { content: 'post-data' };

    beforeEach(() => {
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T00:00:00.000Z');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should return empty string if config is null', () => {
      const result = auditLogger.logOperation(null, 'test-op', mockPreData, mockPostData);
      expect(result).toBe('');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should return empty string if config is undefined', () => {
      const result = auditLogger.logOperation(undefined, 'test-op', mockPreData, mockPostData);
      expect(result).toBe('');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should return empty string if verboseAudit is false', () => {
      const configWithoutAudit = {
        ...mockConfig,
        verboseAudit: false,
      };
      const result = auditLogger.logOperation(configWithoutAudit, 'test-op', mockPreData, mockPostData);
      expect(result).toBe('');
      expect(fs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should write audit files when verboseAudit is enabled', () => {
      const result = auditLogger.logOperation(mockConfig, 'tool_call', mockPreData, mockPostData);

      expect(result).toBe(mockUuid);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    });

    it('should generate correct file names for pre and post files', () => {
      auditLogger.logOperation(mockConfig, 'tool_call', mockPreData, mockPostData);

      const calls = (fs.writeFileSync as jest.Mock).mock.calls;
      expect(calls.length).toBe(2);

      const preFile = calls[0][0];
      const postFile = calls[1][0];

      expect(preFile).toContain('2024-01-01T00-00-00-000Z-test-uuid-123-tool_call-pre.json');
      expect(postFile).toContain('2024-01-01T00-00-00-000Z-test-uuid-123-tool_call-post.json');
      expect(preFile).toContain(testClientName);
      expect(postFile).toContain(testClientName);
    });

    it('should write JSON data with proper formatting', () => {
      auditLogger.logOperation(mockConfig, 'tool_call', mockPreData, mockPostData);

      const calls = (fs.writeFileSync as jest.Mock).mock.calls;
      const preContent = calls[0][1];
      const postContent = calls[1][1];

      expect(preContent).toContain('"content": "pre-data"');
      expect(postContent).toContain('"content": "post-data"');
      expect(() => JSON.parse(preContent)).not.toThrow();
      expect(() => JSON.parse(postContent)).not.toThrow();
    });

    it('should handle different operation types', () => {
      auditLogger.logOperation(mockConfig, 'prompt_call', mockPreData, mockPostData);

      const calls = (fs.writeFileSync as jest.Mock).mock.calls;
      const preFile = calls[0][0];
      expect(preFile).toContain('prompt_call-pre.json');
    });

    it('should handle resource_call operation type', () => {
      auditLogger.logOperation(mockConfig, 'resource_call', mockPreData, mockPostData);

      const calls = (fs.writeFileSync as jest.Mock).mock.calls;
      const preFile = calls[0][0];
      expect(preFile).toContain('resource_call-pre.json');
    });

    it('should write files with correct mode', () => {
      auditLogger.logOperation(mockConfig, 'tool_call', mockPreData, mockPostData);

      const calls = (fs.writeFileSync as jest.Mock).mock.calls;
      expect(calls[0][2]).toEqual({ mode: 0o644 });
      expect(calls[1][2]).toEqual({ mode: 0o644 });
    });
  });

  describe('enhanceDataForReadability', () => {
    it('should parse JSON strings', () => {
      const config = { enabled: true, verboseAudit: true };
      const jsonString = '{"key": "value"}';
      const preData = jsonString;
      const postData = {};

      auditLogger.logOperation(config, 'test-op', preData, postData);

      const calls = (fs.writeFileSync as jest.Mock).mock.calls;
      const preContent = calls[0][1];
      const parsed = JSON.parse(preContent);
      expect(parsed).toEqual({ key: 'value' });
    });

    it('should leave non-JSON strings as-is', () => {
      const config = { enabled: true, verboseAudit: true };
      const plainString = 'not json';
      const postData = {};

      auditLogger.logOperation(config, 'test-op', plainString, postData);

      const calls = (fs.writeFileSync as jest.Mock).mock.calls;
      const preContent = calls[0][1];
      const parsed = JSON.parse(preContent);
      expect(parsed).toBe('not json');
    });

    it('should recursively enhance arrays', () => {
      const config = { enabled: true, verboseAudit: true };
      const preData = ['{"nested": "json"}', 'plain string'];
      const postData = {};

      auditLogger.logOperation(config, 'test-op', preData, postData);

      const calls = (fs.writeFileSync as jest.Mock).mock.calls;
      const preContent = calls[0][1];
      const parsed = JSON.parse(preContent);
      expect(parsed).toEqual([{ nested: 'json' }, 'plain string']);
    });

    it('should recursively enhance objects', () => {
      const config = { enabled: true, verboseAudit: true };
      const preData = {
        nested: {
          jsonString: '{"inner": "value"}',
          plain: 'text',
        },
        array: ['{"item": "data"}'],
      };
      const postData = {};

      auditLogger.logOperation(config, 'test-op', preData, postData);

      const calls = (fs.writeFileSync as jest.Mock).mock.calls;
      const preContent = calls[0][1];
      const parsed = JSON.parse(preContent);
      expect(parsed.nested.jsonString).toEqual({ inner: 'value' });
      expect(parsed.nested.plain).toBe('text');
      expect(parsed.array[0]).toEqual({ item: 'data' });
    });

    it('should handle primitive values', () => {
      const config = { enabled: true, verboseAudit: true };
      const preData = { number: 42, boolean: true, nullValue: null };
      const postData = {};

      auditLogger.logOperation(config, 'test-op', preData, postData);

      const calls = (fs.writeFileSync as jest.Mock).mock.calls;
      const preContent = calls[0][1];
      const parsed = JSON.parse(preContent);
      expect(parsed.number).toBe(42);
      expect(parsed.boolean).toBe(true);
      expect(parsed.nullValue).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should log error but not throw when writeFileSync fails', () => {
      const config = { enabled: true, verboseAudit: true };
      const error = new Error('Write failed');
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw error;
      });

      // Should not throw
      expect(() => {
        auditLogger.logOperation(config, 'test-op', {}, {});
      }).not.toThrow();
    });

    it('should handle write errors gracefully for both files', () => {
      const config = { enabled: true, verboseAudit: true };
      (fs.writeFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Write failed');
      });

      const result = auditLogger.logOperation(config, 'test-op', {}, {});
      // Should still return operation ID even if write fails
      expect(result).toBe(mockUuid);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
    });
  });
});


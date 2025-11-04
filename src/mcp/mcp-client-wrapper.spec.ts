import { MCPClientConfigV2 } from '../config/types';
import { RedactionService } from '../redaction/redaction.service';
import { MCPClientWrapper } from './mcp-client-wrapper';

describe('MCPClientWrapper', () => {
  let wrapper: MCPClientWrapper;
  let redactionService: RedactionService;
  let mockConfig: MCPClientConfigV2;

  beforeEach(() => {
    redactionService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getService: jest.fn().mockResolvedValue({ matcher: null, error: null }),
      redactResponse: jest.fn((data) => data)
    } as any;

    mockConfig = {
      url: 'http://example.com',
      transportType: 'sse',
      options: {}
    };
  });

  describe('shouldFilterTool', () => {
    beforeEach(() => {
      wrapper = new MCPClientWrapper('test-client', mockConfig, redactionService);
    });

    it('should return false when no tool filter configured', () => {
      expect(wrapper.shouldFilterTool('any-tool')).toBe(false);
    });

    it('should return false when tool filter list is empty', () => {
      mockConfig.options = {
        toolFilter: {
          mode: 'block',
          list: []
        }
      };
      wrapper = new MCPClientWrapper('test-client', mockConfig, redactionService);
      expect(wrapper.shouldFilterTool('any-tool')).toBe(false);
    });

    it('should block tool when in block mode and tool is in list', () => {
      mockConfig.options = {
        toolFilter: {
          mode: 'block',
          list: [ 'blocked-tool' ]
        }
      };
      wrapper = new MCPClientWrapper('test-client', mockConfig, redactionService);
      expect(wrapper.shouldFilterTool('blocked-tool')).toBe(true);
    });

    it('should allow tool when in block mode and tool is not in list', () => {
      mockConfig.options = {
        toolFilter: {
          mode: 'block',
          list: [ 'blocked-tool' ]
        }
      };
      wrapper = new MCPClientWrapper('test-client', mockConfig, redactionService);
      expect(wrapper.shouldFilterTool('allowed-tool')).toBe(false);
    });

    it('should allow tool when in allow mode and tool is in list', () => {
      mockConfig.options = {
        toolFilter: {
          mode: 'allow',
          list: [ 'allowed-tool' ]
        }
      };
      wrapper = new MCPClientWrapper('test-client', mockConfig, redactionService);
      expect(wrapper.shouldFilterTool('allowed-tool')).toBe(false);
    });

    it('should block tool when in allow mode and tool is not in list', () => {
      mockConfig.options = {
        toolFilter: {
          mode: 'allow',
          list: [ 'allowed-tool' ]
        }
      };
      wrapper = new MCPClientWrapper('test-client', mockConfig, redactionService);
      expect(wrapper.shouldFilterTool('blocked-tool')).toBe(true);
    });

    it('should default to block mode when mode is not specified', () => {
      mockConfig.options = {
        toolFilter: {
          list: [ 'blocked-tool' ]
        }
      };
      wrapper = new MCPClientWrapper('test-client', mockConfig, redactionService);
      expect(wrapper.shouldFilterTool('blocked-tool')).toBe(true);
    });

    it('should handle unknown filter mode gracefully', () => {
      mockConfig.options = {
        toolFilter: {
          mode: 'unknown-mode' as any,
          list: [ 'some-tool' ]
        }
      };
      wrapper = new MCPClientWrapper('test-client', mockConfig, redactionService);
      expect(wrapper.shouldFilterTool('some-tool')).toBe(false);
    });

    it('should handle case-insensitive mode', () => {
      mockConfig.options = {
        toolFilter: {
          mode: 'BLOCK' as any,
          list: [ 'blocked-tool' ]
        }
      };
      wrapper = new MCPClientWrapper('test-client', mockConfig, redactionService);
      expect(wrapper.shouldFilterTool('blocked-tool')).toBe(true);
    });

    it('should handle multiple tools in filter list', () => {
      mockConfig.options = {
        toolFilter: {
          mode: 'block',
          list: [ 'tool1', 'tool2', 'tool3' ]
        }
      };
      wrapper = new MCPClientWrapper('test-client', mockConfig, redactionService);
      expect(wrapper.shouldFilterTool('tool1')).toBe(true);
      expect(wrapper.shouldFilterTool('tool2')).toBe(true);
      expect(wrapper.shouldFilterTool('tool3')).toBe(true);
      expect(wrapper.shouldFilterTool('tool4')).toBe(false);
    });
  });

  describe('inferTransportType', () => {
    it('should infer stdio when command is present', () => {
      const config: MCPClientConfigV2 = {
        command: 'echo',
        options: {}
      };
      wrapper = new MCPClientWrapper('test-client', config, redactionService);
      // Access private method through any cast
      const inferType = (wrapper as any).inferTransportType.bind(wrapper);
      expect(inferType()).toBe('stdio');
    });

    it('should infer sse when url is present', () => {
      const config: MCPClientConfigV2 = {
        url: 'http://example.com',
        options: {}
      };
      wrapper = new MCPClientWrapper('test-client', config, redactionService);
      const inferType = (wrapper as any).inferTransportType.bind(wrapper);
      expect(inferType()).toBe('sse');
    });

    it('should throw error when neither command nor url is present', () => {
      const config: MCPClientConfigV2 = {
        options: {}
      };
      wrapper = new MCPClientWrapper('test-client', config, redactionService);
      const inferType = (wrapper as any).inferTransportType.bind(wrapper);
      expect(() => inferType()).toThrow('Cannot infer transport type');
    });
  });
});


import { Test, TestingModule } from '@nestjs/testing';
import { MCPServerService, MCPServerInstance } from './mcp-server.service';
import { ConfigService } from '../config/config.service';
import { RedactionService } from '../redaction/redaction.service';
import { MCPClientWrapper } from './mcp-client-wrapper';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request, Response } from 'express';

jest.mock('./mcp-client-wrapper');
jest.mock('@modelcontextprotocol/sdk/server/sse.js');
jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js');

describe('MCPServerService', () => {
  let service: MCPServerService;
  let configService: ConfigService;
  let redactionService: RedactionService;
  let mockClientWrapper: jest.Mocked<MCPClientWrapper>;
  let mockServer: jest.Mocked<Server>;

  const mockConfig = {
    mcpProxy: {
      baseURL: 'http://localhost:8083',
      addr: ':8083',
      name: 'Test Proxy',
      version: '1.0.0',
      type: 'sse' as const,
    },
    mcpServers: {
      testClient: {
        url: 'http://example.com',
        transportType: 'sse' as const,
        options: {},
      },
      panicClient: {
        url: 'http://example.com',
        transportType: 'sse' as const,
        options: {
          panicIfInvalid: true,
        },
      },
    },
  };

  beforeEach(async () => {
    mockServer = {
      connect: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockClientWrapper = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getServer: jest.fn().mockResolvedValue(mockServer),
      close: jest.fn().mockResolvedValue(undefined),
    } as any;

    (MCPClientWrapper as jest.Mock).mockImplementation(() => mockClientWrapper);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MCPServerService,
        {
          provide: ConfigService,
          useValue: {
            getConfig: jest.fn().mockReturnValue(mockConfig),
          },
        },
        {
          provide: RedactionService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<MCPServerService>(MCPServerService);
    configService = module.get<ConfigService>(ConfigService);
    redactionService = module.get<RedactionService>(RedactionService);
  });

  describe('onModuleInit', () => {
    it('should initialize all MCP clients', async () => {
      await service.onModuleInit();

      expect(mockClientWrapper.initialize).toHaveBeenCalled();
      expect(mockClientWrapper.getServer).toHaveBeenCalled();
      expect(service.getServer('testClient')).toBeDefined();
    });

    it('should handle initialization errors gracefully when panicIfInvalid is false', async () => {
      const error = new Error('Init failed');
      mockClientWrapper.initialize.mockRejectedValueOnce(error);

      await service.onModuleInit();

      // Should not throw
      expect(service.getServer('testClient')).toBeUndefined();
    });

    it('should throw error when panicIfInvalid is true', async () => {
      const panicConfig = {
        ...mockConfig,
        mcpServers: {
          panicClient: {
            url: 'http://example.com',
            transportType: 'sse' as const,
            options: {
              panicIfInvalid: true,
            },
          },
        },
      };
      jest.spyOn(configService, 'getConfig').mockReturnValue(panicConfig);
      
      const error = new Error('Init failed');
      mockClientWrapper.initialize.mockRejectedValueOnce(error);

      await expect(service.onModuleInit()).rejects.toThrow('Init failed');
    });

    it('should set server type from config', async () => {
      await service.onModuleInit();
      const instance = service.getServer('testClient');
      expect(instance?.serverType).toBe('sse');
    });

    it('should default to sse when server type not specified', async () => {
      const configWithoutType = {
        ...mockConfig,
        mcpProxy: {
          ...mockConfig.mcpProxy,
          type: undefined,
        },
      };
      jest.spyOn(configService, 'getConfig').mockReturnValue(configWithoutType as any);

      await service.onModuleInit();
      const instance = service.getServer('testClient');
      expect(instance?.serverType).toBe('sse');
    });
  });

  describe('onModuleDestroy', () => {
    it('should close all transports and client wrappers', async () => {
      await service.onModuleInit();

      const mockTransport1 = {
        close: jest.fn().mockResolvedValue(undefined),
      };
      const mockTransport2 = {
        close: jest.fn().mockResolvedValue(undefined),
      };

      const instance = service.getServer('testClient');
      instance!.transports.set('session1', mockTransport1 as any);
      instance!.transports.set('session2', mockTransport2 as any);

      await service.onModuleDestroy();

      expect(mockTransport1.close).toHaveBeenCalled();
      expect(mockTransport2.close).toHaveBeenCalled();
      expect(mockClientWrapper.close).toHaveBeenCalled();
    });

    it('should handle shutdown errors gracefully', async () => {
      await service.onModuleInit();

      const error = new Error('Close failed');
      mockClientWrapper.close.mockRejectedValueOnce(error);

      // Should not throw
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });

    it('should handle transport close errors', async () => {
      await service.onModuleInit();

      const mockTransport = {
        close: jest.fn().mockRejectedValue(new Error('Transport close failed')),
      };

      const instance = service.getServer('testClient');
      instance!.transports.set('session1', mockTransport as any);

      // Should not throw
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });

  describe('getServer', () => {
    it('should return server instance if exists', async () => {
      await service.onModuleInit();

      const instance = service.getServer('testClient');
      expect(instance).toBeDefined();
      expect(instance?.name).toBe('testClient');
    });

    it('should return undefined if server does not exist', async () => {
      await service.onModuleInit();

      const instance = service.getServer('nonexistent');
      expect(instance).toBeUndefined();
    });
  });

  describe('getAllServers', () => {
    it('should return all servers', async () => {
      await service.onModuleInit();

      const servers = service.getAllServers();
      expect(servers.size).toBeGreaterThan(0);
      expect(servers.get('testClient')).toBeDefined();
    });
  });

  describe('handleSSERequest', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockSSETransport: jest.Mocked<SSEServerTransport>;

    beforeEach(async () => {
      await service.onModuleInit();

      mockSSETransport = {
        start: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
        sessionId: 'test-session-id',
      } as any;

      (SSEServerTransport as jest.Mock).mockImplementation(() => mockSSETransport);

      mockReq = {
        on: jest.fn(),
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    });

    it('should handle SSE request successfully', async () => {
      await service.handleSSERequest('testClient', mockReq as Request, mockRes as Response);

      expect(mockSSETransport.start).toHaveBeenCalled();
      expect(mockServer.connect).toHaveBeenCalledWith(mockSSETransport);
      expect(mockReq.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should return 404 if server not found', async () => {
      await service.handleSSERequest('nonexistent', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'MCP server not found' });
      expect(mockSSETransport.start).not.toHaveBeenCalled();
    });

    it('should register transport with session ID', async () => {
      await service.handleSSERequest('testClient', mockReq as Request, mockRes as Response);

      const instance = service.getServer('testClient');
      expect(instance?.transports.has('test-session-id')).toBe(true);
    });

    it('should cleanup transport on request close', async () => {
      await service.handleSSERequest('testClient', mockReq as Request, mockRes as Response);

      const instance = service.getServer('testClient');
      expect(instance?.transports.has('test-session-id')).toBe(true);

      // Call the close handler
      const closeHandler = (mockReq.on as jest.Mock).mock.calls.find(
        (call) => call[0] === 'close',
      )?.[1];
      await closeHandler();

      expect(mockSSETransport.close).toHaveBeenCalled();
      expect(instance?.transports.has('test-session-id')).toBe(false);
    });
  });

  describe('handleStreamableHTTPRequest', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockStreamableTransport: jest.Mocked<StreamableHTTPServerTransport>;

    beforeEach(async () => {
      await service.onModuleInit();

      mockStreamableTransport = {
        handleRequest: jest.fn().mockResolvedValue(undefined),
      } as any;

      // Reset mock before each test
      (StreamableHTTPServerTransport as jest.Mock).mockClear();
      (StreamableHTTPServerTransport as jest.Mock).mockImplementation(() => mockStreamableTransport);

      mockReq = {
        headers: {},
        query: {},
        body: {},
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        headersSent: false,
      };
    });

    it('should return 404 if server not found', async () => {
      await service.handleStreamableHTTPRequest('nonexistent', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'MCP server not found' });
    });

    it('should reuse existing transport when session ID provided', async () => {
      const instance = service.getServer('testClient');
      const existingTransport = mockStreamableTransport;
      // Mock instanceof check
      Object.setPrototypeOf(existingTransport, StreamableHTTPServerTransport.prototype);
      instance!.transports.set('existing-session', existingTransport as any);

      mockReq.headers = { 'mcp-session-id': 'existing-session' };
      (StreamableHTTPServerTransport as jest.Mock).mockClear();

      await service.handleStreamableHTTPRequest('testClient', mockReq as Request, mockRes as Response);

      expect(existingTransport.handleRequest).toHaveBeenCalled();
      expect((StreamableHTTPServerTransport as jest.Mock)).not.toHaveBeenCalled();
    });

    it('should create new transport when no session ID', async () => {
      await service.handleStreamableHTTPRequest('testClient', mockReq as Request, mockRes as Response);

      expect(StreamableHTTPServerTransport).toHaveBeenCalled();
      expect(mockServer.connect).toHaveBeenCalledWith(mockStreamableTransport);
      expect(mockStreamableTransport.handleRequest).toHaveBeenCalled();
    });

    it('should handle session ID from query parameter', async () => {
      const instance = service.getServer('testClient');
      const existingTransport = mockStreamableTransport;
      // Mock instanceof check
      Object.setPrototypeOf(existingTransport, StreamableHTTPServerTransport.prototype);
      instance!.transports.set('query-session', existingTransport as any);

      mockReq.query = { sessionId: 'query-session' };

      await service.handleStreamableHTTPRequest('testClient', mockReq as Request, mockRes as Response);

      expect(existingTransport.handleRequest).toHaveBeenCalled();
    });

    it('should handle session ID from lowercase header', async () => {
      const instance = service.getServer('testClient');
      const existingTransport = mockStreamableTransport;
      // Mock instanceof check
      Object.setPrototypeOf(existingTransport, StreamableHTTPServerTransport.prototype);
      instance!.transports.set('lowercase-session', existingTransport as any);

      mockReq.headers = { 'mcp-session-id': 'lowercase-session' };

      await service.handleStreamableHTTPRequest('testClient', mockReq as Request, mockRes as Response);

      expect(existingTransport.handleRequest).toHaveBeenCalled();
    });

    it('should handle errors and return 500', async () => {
      const error = new Error('Transport error');
      mockStreamableTransport.handleRequest.mockRejectedValueOnce(error);

      await service.handleStreamableHTTPRequest('testClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should not send error if headers already sent', async () => {
      mockRes.headersSent = true;
      const error = new Error('Transport error');
      mockStreamableTransport.handleRequest.mockRejectedValueOnce(error);

      await service.handleStreamableHTTPRequest('testClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should register new transport on session initialized', async () => {
      let sessionInitCallback: (sid: string) => Promise<void>;
      (StreamableHTTPServerTransport as jest.Mock).mockImplementation((options: any) => {
        sessionInitCallback = options.onsessioninitialized;
        return mockStreamableTransport;
      });

      await service.handleStreamableHTTPRequest('testClient', mockReq as Request, mockRes as Response);

      const instance = service.getServer('testClient');
      expect(instance?.transports.size).toBe(0);

      await sessionInitCallback!('new-session-id');

      expect(instance?.transports.has('new-session-id')).toBe(true);
    });

    it('should remove transport on session closed', async () => {
      let sessionCloseCallback: (sid: string) => Promise<void>;
      (StreamableHTTPServerTransport as jest.Mock).mockImplementation((options: any) => {
        sessionCloseCallback = options.onsessionclosed;
        return mockStreamableTransport;
      });

      await service.handleStreamableHTTPRequest('testClient', mockReq as Request, mockRes as Response);

      const instance = service.getServer('testClient');
      instance!.transports.set('session-to-close', mockStreamableTransport as any);

      await sessionCloseCallback!('session-to-close');

      expect(instance?.transports.has('session-to-close')).toBe(false);
    });
  });

  describe('handlePostMessage', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockSSETransport: jest.Mocked<SSEServerTransport>;

    beforeEach(async () => {
      await service.onModuleInit();

      mockSSETransport = {
        handlePostMessage: jest.fn().mockResolvedValue(undefined),
      } as any;

      mockReq = {
        headers: {},
        query: {},
        body: {},
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
    });

    it('should return 404 if server not found', async () => {
      await service.handlePostMessage('nonexistent', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'MCP server not found' });
    });

    it('should handle POST message with existing SSE transport', async () => {
      const instance = service.getServer('testClient');
      instance!.transports.set('session-id', mockSSETransport as any);

      mockReq.headers = { 'mcp-session-id': 'session-id' };

      await service.handlePostMessage('testClient', mockReq as Request, mockRes as Response);

      expect(mockSSETransport.handlePostMessage).toHaveBeenCalledWith(mockReq, mockRes);
    });

    it('should handle POST message with session ID from query', async () => {
      const instance = service.getServer('testClient');
      instance!.transports.set('query-session', mockSSETransport as any);

      mockReq.query = { sessionId: 'query-session' };

      await service.handlePostMessage('testClient', mockReq as Request, mockRes as Response);

      expect(mockSSETransport.handlePostMessage).toHaveBeenCalled();
    });

    it('should fall back to streamable HTTP if no session ID', async () => {
      jest.spyOn(service, 'handleStreamableHTTPRequest').mockResolvedValue(undefined);

      await service.handlePostMessage('testClient', mockReq as Request, mockRes as Response);

      expect(service.handleStreamableHTTPRequest).toHaveBeenCalledWith('testClient', mockReq, mockRes);
      expect(mockSSETransport.handlePostMessage).not.toHaveBeenCalled();
    });

    it('should fall back to streamable HTTP if transport does not support handlePostMessage', async () => {
      const instance = service.getServer('testClient');
      const nonSSETransport = {
        handleRequest: jest.fn().mockResolvedValue(undefined),
      };
      instance!.transports.set('non-sse-session', nonSSETransport as any);

      mockReq.headers = { 'mcp-session-id': 'non-sse-session' };
      jest.spyOn(service, 'handleStreamableHTTPRequest').mockResolvedValue(undefined);

      await service.handlePostMessage('testClient', mockReq as Request, mockRes as Response);

      expect(service.handleStreamableHTTPRequest).toHaveBeenCalled();
    });
  });
});


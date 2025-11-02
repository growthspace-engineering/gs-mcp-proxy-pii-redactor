import { Request, Response } from 'express';

import { Test, TestingModule } from '@nestjs/testing';

import { ConfigService } from './config/config.service';
import { MCPServerService } from './mcp/mcp-server.service';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;
  let configService: ConfigService;
  let mcpServerService: MCPServerService;

  const mockConfig = {
    mcpProxy: {
      baseURL: 'http://localhost:8083',
      addr: ':8083',
      name: 'Test Proxy',
      version: '1.0.0',
      type: 'sse' as const
    },
    mcpServers: {
      testClient: {
        url: 'http://example.com',
        transportType: 'sse' as const,
        options: {}
      },
      authClient: {
        url: 'http://example.com',
        transportType: 'sse' as const,
        options: {
          authTokens: [ 'valid-token-123' ]
        }
      }
    }
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ AppController ],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            getConfig: jest.fn().mockReturnValue(mockConfig)
          }
        },
        {
          provide: MCPServerService,
          useValue: {
            handleSSERequest: jest.fn().mockResolvedValue(void 0),
            handlePostMessage: jest.fn().mockResolvedValue(void 0),
            handleStreamableHTTPRequest: jest.fn().mockResolvedValue(void 0)
          }
        }
      ]
    }).compile();

    controller = module.get<AppController>(AppController);
    configService = module.get<ConfigService>(ConfigService);
    mcpServerService = module.get<MCPServerService>(MCPServerService);
  });

  describe('healthCheck', () => {
    it('should return ok status', () => {
      const result = controller.healthCheck();
      expect(result).toEqual({ status: 'ok' });
    });
  });

  describe('handleSSE', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
      mockReq = {
        headers: {},
        on: jest.fn()
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        headersSent: false
      };
    });

    it('should handle SSE request successfully', async () => {
      await controller.handleSSE('testClient', mockReq as Request, mockRes as Response);

      expect(configService.getConfig).toHaveBeenCalled();
      expect(mcpServerService.handleSSERequest).toHaveBeenCalledWith(
        'testClient',
        mockReq,
        mockRes
      );
    });

    it('should return 404 if client not found', async () => {
      await controller.handleSSE('nonexistent', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Client not found' });
      expect(mcpServerService.handleSSERequest).not.toHaveBeenCalled();
    });

    it('should return 401 if no auth header when authTokens configured', async () => {
      await controller.handleSSE('authClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mcpServerService.handleSSERequest).not.toHaveBeenCalled();
    });

    it('should return 401 if invalid token', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      await controller.handleSSE('authClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mcpServerService.handleSSERequest).not.toHaveBeenCalled();
    });

    it('should allow valid token', async () => {
      mockReq.headers = { authorization: 'Bearer valid-token-123' };

      await controller.handleSSE('authClient', mockReq as Request, mockRes as Response);

      expect(mcpServerService.handleSSERequest).toHaveBeenCalled();
    });

    it('should handle token with Bearer prefix correctly', async () => {
      mockReq.headers = { authorization: 'Bearer valid-token-123' };

      await controller.handleSSE('authClient', mockReq as Request, mockRes as Response);

      expect(mcpServerService.handleSSERequest).toHaveBeenCalled();
    });

    it('should handle token without Bearer prefix', async () => {
      mockReq.headers = { authorization: 'valid-token-123' };

      await controller.handleSSE('authClient', mockReq as Request, mockRes as Response);

      expect(mcpServerService.handleSSERequest).toHaveBeenCalled();
    });

    it('should handle error and return 500 if headers not sent', async () => {
      const error = new Error('Test error');
      jest.spyOn(mcpServerService, 'handleSSERequest').mockRejectedValue(error);

      await controller.handleSSE('testClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should not send error response if headers already sent', async () => {
      mockRes.headersSent = true;
      const error = new Error('Test error');
      jest.spyOn(mcpServerService, 'handleSSERequest').mockRejectedValue(error);

      await controller.handleSSE('testClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should handle empty authTokens array', async () => {
      const configWithEmptyAuth = {
        ...mockConfig,
        mcpServers: {
          noAuthClient: {
            url: 'http://example.com',
            transportType: 'sse' as const,
            options: {
              authTokens: []
            }
          }
        }
      };
      jest.spyOn(configService, 'getConfig').mockReturnValue(configWithEmptyAuth);

      await controller.handleSSE('noAuthClient', mockReq as Request, mockRes as Response);

      expect(mcpServerService.handleSSERequest).toHaveBeenCalled();
    });
  });

  describe('handlePostMessage', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
      mockReq = {
        headers: {},
        query: {}
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        headersSent: false
      };
    });

    it('should handle POST message successfully', async () => {
      await controller.handlePostMessage('testClient', mockReq as Request, mockRes as Response);

      expect(configService.getConfig).toHaveBeenCalled();
      expect(mcpServerService.handlePostMessage).toHaveBeenCalledWith(
        'testClient',
        mockReq,
        mockRes
      );
    });

    it('should return 404 if client not found', async () => {
      await controller.handlePostMessage('nonexistent', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Client not found' });
      expect(mcpServerService.handlePostMessage).not.toHaveBeenCalled();
    });

    it('should return 401 if no auth header when authTokens configured', async () => {
      await controller.handlePostMessage('authClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mcpServerService.handlePostMessage).not.toHaveBeenCalled();
    });

    it('should return 401 if invalid token', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      await controller.handlePostMessage('authClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(mcpServerService.handlePostMessage).not.toHaveBeenCalled();
    });

    it('should allow valid token', async () => {
      mockReq.headers = { authorization: 'Bearer valid-token-123' };

      await controller.handlePostMessage('authClient', mockReq as Request, mockRes as Response);

      expect(mcpServerService.handlePostMessage).toHaveBeenCalled();
    });

    it('should handle error and return 500 if headers not sent', async () => {
      const error = new Error('Test error');
      jest.spyOn(mcpServerService, 'handlePostMessage').mockRejectedValue(error);

      await controller.handlePostMessage('testClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should not send error response if headers already sent', async () => {
      mockRes.headersSent = true;
      const error = new Error('Test error');
      jest.spyOn(mcpServerService, 'handlePostMessage').mockRejectedValue(error);

      await controller.handlePostMessage('testClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe('handleStreamableHTTP', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
      mockReq = {
        headers: {},
        method: 'GET'
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        headersSent: false
      };
    });

    it('should return 404 if client not found', async () => {
      await controller.handleStreamableHTTP('nonexistent', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Client not found' });
    });

    it('should return 401 if no auth header when authTokens configured', async () => {
      await controller.handleStreamableHTTP('authClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should return 401 if invalid token', async () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };

      await controller.handleStreamableHTTP('authClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should redirect to SSE endpoint when server type is SSE and method is GET', async () => {
      mockReq.method = 'GET';
      jest.spyOn(controller, 'handleSSE').mockResolvedValue(void 0);

      await controller.handleStreamableHTTP('testClient', mockReq as Request, mockRes as Response);

      expect(controller.handleSSE).toHaveBeenCalledWith(
        'testClient',
        mockReq,
        mockRes
      );
      expect(mcpServerService.handleStreamableHTTPRequest)
        .not.toHaveBeenCalled();
    });

    it('should redirect to POST message endpoint when server type is SSE and method is POST', async () => {
      mockReq.method = 'POST';
      jest.spyOn(controller, 'handlePostMessage').mockResolvedValue(void 0);

      await controller.handleStreamableHTTP('testClient', mockReq as Request, mockRes as Response);

      expect(controller.handlePostMessage).toHaveBeenCalledWith(
        'testClient',
        mockReq,
        mockRes
      );
      expect(mcpServerService.handleStreamableHTTPRequest)
        .not.toHaveBeenCalled();
    });

    it('should return 404 for unsupported method when server type is SSE', async () => {
      mockReq.method = 'DELETE';

      await controller.handleStreamableHTTP('testClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Endpoint not found' });
    });

    it('should handle streamable-http request when server type is streamable-http', async () => {
      const streamableConfig = {
        ...mockConfig,
        mcpProxy: {
          ...mockConfig.mcpProxy,
          type: 'streamable-http' as const
        }
      };
      jest.spyOn(configService, 'getConfig').mockReturnValue(streamableConfig);

      await controller.handleStreamableHTTP('testClient', mockReq as Request, mockRes as Response);

      expect(mcpServerService.handleStreamableHTTPRequest).toHaveBeenCalledWith(
        'testClient',
        mockReq,
        mockRes
      );
    });

    it('should use default server type sse when not specified', async () => {
      const configWithoutType = {
        ...mockConfig,
        mcpProxy: {
          ...mockConfig.mcpProxy,
          type: void 0
        }
      };
      jest.spyOn(configService, 'getConfig').mockReturnValue(
        configWithoutType as ReturnType<ConfigService['getConfig']>
      );
      mockReq.method = 'GET';
      jest.spyOn(controller, 'handleSSE').mockResolvedValue(void 0);

      await controller.handleStreamableHTTP('testClient', mockReq as Request, mockRes as Response);

      expect(controller.handleSSE).toHaveBeenCalled();
    });

    it('should handle error and return 500 if headers not sent', async () => {
      const streamableConfig = {
        ...mockConfig,
        mcpProxy: {
          ...mockConfig.mcpProxy,
          type: 'streamable-http' as const
        }
      };
      jest.spyOn(configService, 'getConfig').mockReturnValue(streamableConfig);
      const error = new Error('Test error');
      jest.spyOn(mcpServerService, 'handleStreamableHTTPRequest').mockRejectedValue(error);

      await controller.handleStreamableHTTP('testClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });

    it('should not send error response if headers already sent', async () => {
      const streamableConfig = {
        ...mockConfig,
        mcpProxy: {
          ...mockConfig.mcpProxy,
          type: 'streamable-http' as const
        }
      };
      jest.spyOn(configService, 'getConfig').mockReturnValue(streamableConfig);
      mockRes.headersSent = true;
      const error = new Error('Test error');
      jest.spyOn(mcpServerService, 'handleStreamableHTTPRequest').mockRejectedValue(error);

      await controller.handleStreamableHTTP('testClient', mockReq as Request, mockRes as Response);

      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it('should allow valid token for streamable-http', async () => {
      const streamableConfig = {
        ...mockConfig,
        mcpProxy: {
          ...mockConfig.mcpProxy,
          type: 'streamable-http' as const
        }
      };
      jest.spyOn(configService, 'getConfig').mockReturnValue(streamableConfig);
      mockReq.headers = { authorization: 'Bearer valid-token-123' };

      await controller.handleStreamableHTTP('authClient', mockReq as Request, mockRes as Response);

      expect(mcpServerService.handleStreamableHTTPRequest).toHaveBeenCalled();
    });
  });
});


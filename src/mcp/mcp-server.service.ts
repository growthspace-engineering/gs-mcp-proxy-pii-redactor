import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { RedactionService } from '../redaction/redaction.service';
import { MCPClientWrapper } from './mcp-client-wrapper';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

export interface MCPServerInstance {
  name: string;
  server: Server;
  clientWrapper: MCPClientWrapper;
  transports: Map<string, SSEServerTransport | StreamableHTTPServerTransport>;
  serverType: 'sse' | 'streamable-http';
}

@Injectable()
export class MCPServerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MCPServerService.name);
  private servers: Map<string, MCPServerInstance> = new Map();

  constructor(
    private configService: ConfigService,
    private redactionService: RedactionService,
  ) {}

  async onModuleInit() {
    const config = this.configService.getConfig();

    // Initialize all MCP clients and create proxy servers
    for (const [name, clientConfig] of Object.entries(config.mcpServers)) {
      try {
        this.logger.log(`<${name}> Initializing client...`);
        
        const clientWrapper = new MCPClientWrapper(name, clientConfig, this.redactionService);
        await clientWrapper.initialize();

        const server = await clientWrapper.getServer();
        
        this.servers.set(name, {
          name,
          server,
          clientWrapper,
          transports: new Map(),
          serverType: config.mcpProxy.type || 'sse',
        });

        this.logger.log(`<${name}> Client initialized successfully`);
      } catch (error) {
        this.logger.error(`<${name}> Failed to initialize client: ${error}`);
        
        if (clientConfig.options?.panicIfInvalid) {
          throw error;
        }
      }
    }
  }

  async onModuleDestroy() {
    for (const [name, instance] of this.servers) {
      try {
        this.logger.log(`<${name}> Shutting down...`);
        // Close all transports
        for (const transport of instance.transports.values()) {
          await transport.close();
        }
        await instance.clientWrapper.close();
      } catch (error) {
        this.logger.error(`<${name}> Error during shutdown: ${error}`);
      }
    }
  }

  getServer(name: string): MCPServerInstance | undefined {
    return this.servers.get(name);
  }

  getAllServers(): Map<string, MCPServerInstance> {
    return this.servers;
  }

  async handleSSERequest(
    name: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const instance = this.getServer(name);
    if (!instance) {
      res.status(404).json({ error: 'MCP server not found' });
      return;
    }

    const config = this.configService.getConfig();
    const baseURL = config.mcpProxy.baseURL;
    const endpoint = `${baseURL}/${name}/message`;

    const transport = new SSEServerTransport(endpoint, res);
    await transport.start();
    
    const sessionId = transport.sessionId;
    instance.transports.set(sessionId, transport);
    
    await instance.server.connect(transport);

    // Handle cleanup
    req.on('close', () => {
      instance.transports.delete(sessionId);
      transport.close();
    });
  }

  async handleStreamableHTTPRequest(
    name: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const instance = this.getServer(name);
    if (!instance) {
      res.status(404).json({ error: 'MCP server not found' });
      return;
    }

    // Stateful handling: reuse transport by sessionId when provided
    const sessionIdHeader = (req.headers['mcp-session-id'] as string) || (req.headers['mcp-session-id'.toLowerCase()] as string) || (req.query.sessionId as string);
    const existing = sessionIdHeader ? instance.transports.get(sessionIdHeader) : undefined;

    try {
      if (existing && existing instanceof StreamableHTTPServerTransport) {
        await existing.handleRequest(req as any, res, req.body);
        return;
      }

      // Create a new stateful Streamable HTTP server transport
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: false,
        onsessioninitialized: async (sid: string) => {
          instance.transports.set(sid, transport);
        },
        onsessionclosed: async (sid: string) => {
          instance.transports.delete(sid);
        },
      });

      // Connect this transport to the shared server instance
      await instance.server.connect(transport);

      // Handle the request (GET/POST/DELETE)
      await transport.handleRequest(req as any, res, req.body);
      return;
    } catch (error) {
      this.logger.error(`Error in streamable HTTP handler for ${name}: ${error}`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async handlePostMessage(
    name: string,
    req: Request,
    res: Response,
  ): Promise<void> {
    const instance = this.getServer(name);
    if (!instance) {
      res.status(404).json({ error: 'MCP server not found' });
      return;
    }

    // Get session ID from header or query
    const sessionId = req.headers['mcp-session-id'] as string || req.query.sessionId as string;
    
    if (sessionId) {
      const transport = instance.transports.get(sessionId);
      if (transport && 'handlePostMessage' in transport) {
        await (transport as SSEServerTransport).handlePostMessage(req, res);
        return;
      }
    }

    // If no session ID or transport doesn't support handlePostMessage, 
    // fall back to streamable HTTP handler
    await this.handleStreamableHTTPRequest(name, req, res);
  }
}


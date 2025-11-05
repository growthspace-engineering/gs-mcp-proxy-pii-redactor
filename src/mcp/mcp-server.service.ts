import { randomUUID } from 'crypto';

import { Request, Response } from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';

import { ConfigService } from '../config/config.service';
import { RedactionService } from '../redaction/redaction.service';
import { MCPClientWrapper } from './mcp-client-wrapper';

export interface IMCPServerInstance {
  name: string;
  server: Server;
  clientWrapper: MCPClientWrapper;
  transports: Map<string, SSEServerTransport | StreamableHTTPServerTransport>;
  serverType: 'sse' | 'streamable-http' | 'stdio';
}
export type MCPServerInstance = IMCPServerInstance;

@Injectable()
export class MCPServerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MCPServerService.name);
  private servers: Map<string, MCPServerInstance> = new Map();

  constructor(
    private configService: ConfigService,
    private redactionService: RedactionService
  ) {}

  async onModuleInit() {
    const config = this.configService.getConfig();

    // In stdio mode, initialize only the selected downstream target to avoid slow startup
    const proxyType = config.mcpProxy.type || 'sse';
    const argv = process.argv;
    const targetFlagIdx = argv.indexOf('--stdio-target');
    const targetFromArg = targetFlagIdx >= 0 ? argv[targetFlagIdx + 1] : undefined;
    const allEntries = Object.entries(config.mcpServers);
    const entriesToInit = proxyType === 'stdio' ?
      (() => {
        if (targetFromArg) {
          return allEntries.filter(([ n ]) => n === targetFromArg);
        }
        // If no explicit target, initialize all. main.ts enforces correctness when running in stdio mode.
        return allEntries;
      })() :
      allEntries;

    // Initialize MCP clients and create proxy servers
    for (const [ name, clientConfig ] of entriesToInit) {
      try {
        this.logger.log(`<${ name }> Initializing client...`);

        const clientWrapper = new MCPClientWrapper(name, clientConfig, this.redactionService);
        await clientWrapper.initialize();

        const server = await clientWrapper.getServer();

        this.servers.set(name, {
          name,
          server,
          clientWrapper,
          transports: new Map(),
          serverType: config.mcpProxy.type || 'sse'
        });

        this.logger.log(`<${ name }> Client initialized successfully`);
      } catch (error) {
        this.logger.error([
          '<',
          name,
          '> Failed to initialize client: ',
          String(error)
        ].join(''));

        if (clientConfig.options?.panicIfInvalid) {
          throw error;
        }
      }
    }
  }

  async onModuleDestroy() {
    for (const [ name, instance ] of this.servers) {
      try {
        this.logger.log([ '<', name, '> Shutting down...' ].join(''));
        // Close all transports
        for (const transport of instance.transports.values()) {
          await transport.close();
        }
        await instance.clientWrapper.close();
        // Close sdk Server if it supports lifecycle methods
        const srv = instance.server as unknown as Record<string, unknown>;
        for (const method of [ 'close', 'shutdown', 'stop', 'dispose', 'terminate' ]) {
          const candidate = srv?.[method];
          if (typeof candidate === 'function') {
            try {
              await (candidate as () => Promise<void> | void)();
            } catch {}
          }
        }
      } catch (error) {
        this.logger.error([
          '<',
          name,
          '> Error during shutdown: ',
          String(error)
        ].join(''));
      }
    }
    this.servers.clear();
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
    res: Response
  ): Promise<void> {
    const instance = this.getServer(name);
    if (!instance) {
      res.status(404).json({ error: 'MCP server not found' });
      return;
    }

    // Derive baseURL from the incoming request instead of config
    // This ensures it works correctly in test environments with dynamic ports
    const protocol = (req as any).protocol || 'http';
    const hostHeader = typeof (req as any).get === 'function' ?
      (req as any).get('host') :
      (req.headers?.host as string | undefined);
    const host = hostHeader || 'localhost';
    const baseURL = `${ protocol }://${ host }`;
    const endpoint = `${ baseURL }/${ name }/message`;

    const transport = new SSEServerTransport(endpoint, res);
    // Do not call start() here; Server.connect() will start the transport
    await instance.server.connect(transport);

    // Register the transport after connect so the sessionId matches the one used by the SDK
    const sessionId = transport.sessionId;
    instance.transports.set(sessionId, transport);

    // Handle cleanup
    const cleanup = () => {
      instance.transports.delete(sessionId);
      transport.close();
    };
    req.on('close', cleanup);
    (res as any).on?.('close', cleanup);
    (res as any).on?.('finish', cleanup);
  }

  async handleStreamableHTTPRequest(
    name: string,
    req: Request,
    res: Response
  ): Promise<void> {
    const instance = this.getServer(name);
    if (!instance) {
      res.status(404).json({ error: 'MCP server not found' });
      return;
    }

    // Stateful handling: reuse transport by sessionId when provided
    const sessionIdHeader =
      (req.headers['mcp-session-id'] as string) ||
      (req.headers['mcp-session-id'.toLowerCase()] as string) ||
      (req.query.sessionId as string);
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
        }
      });

      // Connect this transport to the shared server instance
      await instance.server.connect(transport);

      // Handle the request (GET/POST/DELETE)
      await transport.handleRequest(req as any, res, req.body);
      return;
    } catch (error) {
      this.logger.error([
        'Error in streamable HTTP handler for ',
        name,
        ': ',
        String(error)
      ].join(''));
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  async handlePostMessage(
    name: string,
    req: Request,
    res: Response
  ): Promise<void> {
    const instance = this.getServer(name);
    if (!instance) {
      res.status(404).json({ error: 'MCP server not found' });
      return;
    }

    // Get session ID from header or query
    const sessionId = req.headers['mcp-session-id'] as string || req.query.sessionId as string;

    this.logger.debug([
      '<',
      name,
      '> handlePostMessage - sessionId: ',
      String(sessionId),
      ', transports: ',
      Array.from(instance.transports.keys()).join(', ')
    ].join(''));

    if (sessionId) {
      const transport = instance.transports.get(sessionId);
      if (transport && 'handlePostMessage' in transport) {
        this.logger.debug([
          '<',
          name,
          '> Found SSE transport for session ',
          String(sessionId),
          ', delegating to handlePostMessage'
        ].join(''));
        // Forward the original request/response to the SSE transport. If the request stream
        // is not readable due to body parsing, prefer passing parsed body for JSON requests;
        // otherwise pass rawBody (when enabled), else fall back to streaming.
        const contentType =
          (req.headers['content-type'] as string | undefined) ||
          (req.headers['Content-Type'] as unknown as string | undefined);
        const isJson = typeof contentType === 'string' && contentType.includes('application/json');
        const hasParsedBody = typeof (req as any).body !== 'undefined' && (req as any).body !== null;
        const rawBody = (req as any).rawBody;
        if (isJson && hasParsedBody) {
          await (transport as SSEServerTransport).handlePostMessage(req as any, res, (req as any).body);
        } else if (typeof rawBody !== 'undefined') {
          await (transport as SSEServerTransport).handlePostMessage(req as any, res, rawBody);
        } else {
          await (transport as SSEServerTransport).handlePostMessage(req as any, res);
        }
        return;
      } else {
        this.logger.warn([
          '<',
          name,
          '> SessionId ',
          String(sessionId),
          ' provided but no matching transport found or transport doesn\'t support handlePostMessage'
        ].join(''));
      }
    } else {
      this.logger.warn([ '<', name, '> No sessionId provided in POST message request' ].join(''));
    }

    // If no session ID or transport doesn't support handlePostMessage,
    // fall back to streamable HTTP handler
    this.logger.debug([ '<', name, '> Falling back to streamable HTTP handler' ].join(''));
    await this.handleStreamableHTTPRequest(name, req, res);
  }
}


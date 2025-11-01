import { Logger } from '@nestjs/common';
import { RedactionService } from '../redaction/redaction.service';
import { AuditLogger } from '../redaction/audit-logger';
import {
  MCPClientConfigV2,
  MCPClientType,
  ToolFilterMode,
  RedactionOptions,
} from '../config/types';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

export class MCPClientWrapper {
  private readonly logger = new Logger(MCPClientWrapper.name);
  private client: Client | null = null;
  private transport:
    | StdioClientTransport
    | SSEClientTransport
    | StreamableHTTPClientTransport
    | null = null;
  private name: string;
  private config: MCPClientConfigV2;
  private needPing = false;
  private needManualStart = false;
  private pingInterval: NodeJS.Timeout | null = null;

  constructor(
    name: string,
    config: MCPClientConfigV2,
    private redactionService: RedactionService,
  ) {
    this.name = name;
    this.config = config;
  }

  async initialize(): Promise<void> {
    const transportType =
      this.config.transportType || this.inferTransportType();

    this.logger.log(
      `<${this.name}> Initializing ${transportType} transport...`,
    );

    // Check if redaction is enabled and service can initialize
    if (this.config.options?.redaction?.enabled) {
      try {
        await this.redactionService.initialize();
        const keys = this.config.options.redaction.keys || [];
        this.logger.log(
          `<${this.name}> Redaction enabled with ${keys.length} keys`,
        );
      } catch (error) {
        this.logger.error(
          `<${this.name}> Redaction service unavailable: ${error}`,
        );
        throw new Error(
          `Redaction service unavailable for client with redaction enabled: ${error}`,
        );
      }
    }

    switch (transportType) {
      case 'stdio':
        await this.initializeStdio();
        break;
      case 'sse':
        await this.initializeSSE();
        break;
      case 'streamable-http':
        await this.initializeStreamableHTTP();
        break;
      default:
        throw new Error(`Unknown transport type: ${transportType}`);
    }

    // Initialize MCP client
    this.client = new Client(
      {
        name: 'mcp-proxy',
        version: '1.0.0',
      },
      {
        capabilities: {
          experimental: {},
          roots: {
            listChanged: false,
          },
        },
      },
    );

    await this.client.connect(this.transport!);
    this.logger.log(`<${this.name}> Successfully initialized MCP client`);

    if (this.needPing) {
      this.startPingTask();
    }
  }

  private inferTransportType(): MCPClientType {
    if (this.config.command) {
      return 'stdio';
    }
    if (this.config.url) {
      return 'sse';
    }
    throw new Error('Cannot infer transport type');
  }

  private async initializeStdio(): Promise<void> {
    if (!this.config.command) {
      throw new Error('command is required for stdio transport');
    }

    const env = { ...process.env, ...this.config.env };

    // Suppress verbose logging from child processes unless explicitly enabled
    if (!process.env.MCP_DEBUG) {
      env.NODE_ENV = env.NODE_ENV || 'production';
      // Disable mcp-remote debug mode to reduce log verbosity
      env.MCP_REMOTE_DEBUG = 'false';
      env.DEBUG = '';
    }

    const stdioTransport = new StdioClientTransport({
      command: this.config.command,
      args: this.config.args || [],
      env,
    });

    this.transport = stdioTransport;
    this.needPing = false;
    this.needManualStart = false;
  }

  private async initializeSSE(): Promise<void> {
    if (!this.config.url) {
      throw new Error('url is required for SSE transport');
    }

    const url = new URL(this.config.url);

    // For SSE, we need to handle headers differently
    // The SDK doesn't directly support headers in SSE client transport
    // We may need to implement a custom transport or use fetch with EventSource
    // For now, create basic SSE transport
    const sseTransport = new SSEClientTransport(url);

    this.transport = sseTransport;
    this.needPing = true;
    this.needManualStart = true;
  }

  private async initializeStreamableHTTP(): Promise<void> {
    if (!this.config.url) {
      throw new Error('url is required for streamable-http transport');
    }

    const url = new URL(this.config.url);

    const options: any = {
      requestInit: {},
    };

    // Add headers if provided
    if (this.config.headers) {
      options.requestInit.headers = { ...this.config.headers };
      // Temporary debug to confirm upstream auth header presence
      const authVal = (options.requestInit.headers as any)['Authorization'] || (options.requestInit.headers as any)['authorization'];
      this.logger.log(
        `<${this.name}> Upstream headers set. Authorization present: ${Boolean(authVal)}`,
      );
    }

    // Add timeout if provided
    if (this.config.timeout) {
      // Note: timeout is handled differently in fetch - we'd need to use AbortController
      // For now, we'll rely on the SDK's default timeout handling
    }

    const streamableTransport = new StreamableHTTPClientTransport(url, options);

    this.transport = streamableTransport;
    this.needPing = true;
    this.needManualStart = true;
  }

  private startPingTask(): void {
    const interval = 30000; // 30 seconds

    this.pingInterval = setInterval(async () => {
      try {
        if (this.client) {
          await this.client.ping();
        }
      } catch (error) {
        this.logger.error(`<${this.name}> MCP Ping failed: ${error}`);
      }
    }, interval);
  }

  async listTools(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const response = await this.client.listTools({});
    const tools = response.tools || [];

    // Apply tool filtering
    const filteredTools = tools.filter(
      (tool) => !this.shouldFilterTool(tool.name),
    );

    return filteredTools;
  }

  async listPrompts(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    try {
      const response = await this.client.listPrompts({});
      return response.prompts || [];
    } catch (error: any) {
      // If the server doesn't support prompts (Method not found), return empty array
      if (error.code === -32601) {
        this.logger.debug(`<${this.name}> Prompts not supported (optional)`);
        return [];
      }
      throw error;
    }
  }

  async listResources(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    try {
      const response = await this.client.listResources({});
      return response.resources || [];
    } catch (error: any) {
      // If the server doesn't support resources (Method not found), return empty array
      if (error.code === -32601) {
        this.logger.debug(`<${this.name}> Resources not supported (optional)`);
        return [];
      }
      throw error;
    }
  }

  async callTool(
    name: string,
    args: any,
    redactionConfig?: RedactionOptions,
  ): Promise<any> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const response = await this.client.callTool({
      name,
      arguments: args,
    });

    // Apply redaction if enabled
    if (redactionConfig?.enabled) {
      const { matcher } = await this.redactionService.getService();
      if (matcher) {
        const auditor = redactionConfig.verboseAudit
          ? new AuditLogger(this.name)
          : null;

        const originalResult = JSON.parse(JSON.stringify(response));
        const redacted = this.redactionService.redactResponse(
          response,
          redactionConfig,
        );

        if (auditor) {
          auditor.logOperation(
            redactionConfig,
            'tool_call',
            originalResult,
            redacted,
          );
        }

        return redacted;
      }
    }

    return response;
  }

  async getPrompt(
    name: string,
    args: any,
    redactionConfig?: RedactionOptions,
  ): Promise<any> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const response = await this.client.getPrompt({
      name,
      arguments: args,
    });

    // Apply redaction if enabled
    if (redactionConfig?.enabled) {
      const { matcher } = await this.redactionService.getService();
      if (matcher) {
        const auditor = redactionConfig.verboseAudit
          ? new AuditLogger(this.name)
          : null;

        const originalResult = JSON.parse(JSON.stringify(response));
        const redacted = this.redactionService.redactResponse(
          response,
          redactionConfig,
        );

        if (auditor) {
          auditor.logOperation(
            redactionConfig,
            'prompt_call',
            originalResult,
            redacted,
          );
        }

        return redacted;
      }
    }

    return response;
  }

  async readResource(
    uri: string,
    redactionConfig?: RedactionOptions,
  ): Promise<any> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const response = await this.client.readResource({
      uri,
    });

    // Apply redaction if enabled
    if (redactionConfig?.enabled) {
      const { matcher } = await this.redactionService.getService();
      if (matcher) {
        const auditor = redactionConfig.verboseAudit
          ? new AuditLogger(this.name)
          : null;

        const originalResult = JSON.parse(JSON.stringify(response));
        const redacted = this.redactionService.redactResponse(
          response,
          redactionConfig,
        );

        if (auditor) {
          auditor.logOperation(
            redactionConfig,
            'resource_call',
            originalResult,
            redacted,
          );
        }

        return redacted;
      }
    }

    return response;
  }

  shouldFilterTool(toolName: string): boolean {
    const toolFilter = this.config.options?.toolFilter;
    if (!toolFilter || !toolFilter.list || toolFilter.list.length === 0) {
      return false;
    }

    const filterSet = new Set(toolFilter.list);
    const mode = (toolFilter.mode || 'block').toLowerCase() as ToolFilterMode;

    switch (mode) {
      case 'allow':
        if (!filterSet.has(toolName)) {
          this.logger.log(
            `<${this.name}> Ignoring tool ${toolName} as it is not in allow list`,
          );
          return true;
        }
        return false;
      case 'block':
        if (filterSet.has(toolName)) {
          this.logger.log(
            `<${this.name}> Ignoring tool ${toolName} as it is in block list`,
          );
          return true;
        }
        return false;
      default:
        this.logger.warn(`<${this.name}> Unknown tool filter mode: ${mode}`);
        return false;
    }
  }

  async getServer(fresh = false): Promise<Server> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // Import schemas
    const {
      CallToolRequestSchema,
      GetPromptRequestSchema,
      ListToolsRequestSchema,
      ListPromptsRequestSchema,
      ListResourcesRequestSchema,
      ReadResourceRequestSchema,
    } = await import('@modelcontextprotocol/sdk/types.js');

    // Create a fresh server that proxies to this client
    // Each server instance can only connect to one transport
    const server = new Server(
      {
        name: this.name,
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {},
        },
      },
    );

    // Register tools from client
    const tools = await this.listTools();
    // tools/list handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools } as any;
    });
    // Single dispatching handler for tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const requestedName = request.params.name;
      const tool = tools.find((t) => t.name === requestedName);
      if (!tool) {
        throw new Error(`Tool ${requestedName} not found`);
      }
      return await this.callTool(
        requestedName,
        request.params.arguments || {},
        this.config.options?.redaction,
      );
    });

    // Register prompts from client
    const prompts = await this.listPrompts();
    // prompts/list handler
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return { prompts } as any;
    });
    // Single dispatching handler for prompt calls
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const requestedName = request.params.name;
      const prompt = prompts.find((p) => p.name === requestedName);
      if (!prompt) {
        throw new Error(`Prompt ${requestedName} not found`);
      }
      return await this.getPrompt(
        requestedName,
        request.params.arguments || {},
        this.config.options?.redaction,
      );
    });

    // Register resources from client
    const resources = await this.listResources();
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return { resources };
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      return await this.readResource(
        request.params.uri,
        this.config.options?.redaction,
      );
    });

    return server;
  }

  async close(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.transport) {
      await this.transport.close();
    }
  }
}

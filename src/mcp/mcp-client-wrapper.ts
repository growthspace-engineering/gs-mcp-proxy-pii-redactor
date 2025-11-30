import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

import { Logger } from '@nestjs/common';

import {
  MCPClientConfigV2,
  MCPClientType,
  RedactionOptions,
  ToolFilterMode
} from '../config/types';
import { AuditLogger } from '../redaction/audit-logger';
import { RedactionService } from '../redaction/redaction.service';

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
  private defaultTimeoutMs = 15000;
  private cacheTtlMs = 30000;
  private toolsCache: { data: any[]; expiresAt: number } | null = null;
  private promptsCache: { data: any[]; expiresAt: number } | null = null;
  private resourcesCache: { data: any[]; expiresAt: number } | null = null;
  private isInGroup: boolean;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private isStdioMode = false;

  constructor(
    name: string,
    config: MCPClientConfigV2,
    private redactionService: RedactionService,
    isInGroup = true,
    isStdioMode = false
  ) {
    this.name = name;
    this.config = config;
    this.isInGroup = isInGroup;
    this.isStdioMode = isStdioMode;
  }

  async initialize(): Promise<void> {
    await this.ensureInitialized();
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

  /**
   * Ensure the downstream MCP client is initialized.
   *
   * This is intentionally lazy so that in stdio mode we can:
   *   - Start the proxy process quickly
   *   - Complete the MCP initialize handshake with the caller
   *   - Only incur downstream startup cost on first real request
   *
   * This avoids Codex timing out while we initialize downstream servers.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) {
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      const transportType =
        this.config.transportType || this.inferTransportType();

      this.logger.log(
        `<${ this.name }> Initializing ${ transportType } transport...`
      );

      // Check if redaction is enabled and service can initialize
      if (this.config.options?.redaction?.enabled) {
        try {
          await this.redactionService.initialize();
          const keys = this.config.options.redaction.keys || [];
          this.logger.log(
            `<${ this.name }> Redaction enabled with ${ keys.length } keys`
          );
        } catch (error) {
          this.logger.error(
            `<${ this.name }> Redaction service unavailable: ${ error }`
          );
          throw new Error(
            `Redaction service unavailable for client with redaction enabled: ${ error }`
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
          throw new Error(`Unknown transport type: ${ transportType }`);
      }

      // Initialize MCP client
      this.client = new Client(
        {
          name: 'mcp-proxy',
          version: '1.0.0'
        },
        {
          capabilities: {
            experimental: {},
            roots: {
              listChanged: false
            }
          }
        }
      );

      await this.client.connect(this.transport!);
      this.logger.log(`<${ this.name }> Successfully initialized MCP client`);

      if (this.needPing) {
        this.startPingTask();
      }

      this.initialized = true;
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
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
      env
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

    const options: { requestInit: { headers?: Record<string, string> } } = {
      requestInit: {}
    };

    // Add headers if provided
    if (this.config.headers) {
      options.requestInit.headers = { ...this.config.headers };
      // Temporary debug to confirm upstream auth header presence
      const authHeaders = options.requestInit.headers as Record<string, string>;
      const authVal = (authHeaders as Record<string, string>).Authorization ||
        (authHeaders as Record<string, string>).authorization;
      this.logger.log(
        [
          '<',
          this.name,
          '> Upstream headers set. Authorization present: ',
          String(Boolean(authVal))
        ].join('')
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
    // 30 seconds
    const interval = 30000;

    this.pingInterval = setInterval(async () => {
      try {
        if (this.client) {
          await this.client.ping();
        }
      } catch (error) {
        this.logger.error(`<${ this.name }> MCP Ping failed: ${ error }`);
      }
    }, interval);
  }

  async listTools(): Promise<any[]> {
    await this.ensureInitialized();
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // If server is not in the active group, return empty tool list
    if (!this.isInGroup) {
      this.logger.log(
        `<${ this.name }> Server not in active group, returning empty tool list`
      );
      return [];
    }

    if (this.toolsCache && this.toolsCache.expiresAt > Date.now()) {
      return this.toolsCache.data;
    }

    const timeoutMs = this.config.timeout || this.defaultTimeoutMs;
    const response = await this.withTimeout(this.client.listTools({}), timeoutMs, 'listTools');
    const tools = (response?.tools || []) as any[];

    // Apply tool filtering
    const filteredTools = tools.filter(
      (tool) => !this.shouldFilterTool(tool.name)
    );

    this.toolsCache = {
      data: filteredTools,
      expiresAt: Date.now() + this.cacheTtlMs
    };
    return this.toolsCache.data;
  }

  async listPrompts(): Promise<any[]> {
    await this.ensureInitialized();
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // If server is not in the active group, return empty prompt list
    if (!this.isInGroup) {
      this.logger.log(
        `<${ this.name }> Server not in active group, returning empty prompt list`
      );
      return [];
    }

    try {
      if (this.promptsCache && this.promptsCache.expiresAt > Date.now()) {
        return this.promptsCache.data;
      }
      const timeoutMs = this.config.timeout || this.defaultTimeoutMs;
      const response = await this.withTimeout(this.client.listPrompts({}), timeoutMs, 'listPrompts');
      const data = (response?.prompts || []) as any[];
      this.promptsCache = { data, expiresAt: Date.now() + this.cacheTtlMs };
      return data;
    } catch (error: any) {
      // If the server doesn't support prompts (Method not found), return empty array
      if (error.code === -32601) {
        this.logger.debug(`<${ this.name }> Prompts not supported (optional)`);
        return [];
      }
      throw error;
    }
  }

  async listResources(): Promise<any[]> {
    await this.ensureInitialized();
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // If server is not in the active group, return empty resource list
    if (!this.isInGroup) {
      this.logger.log(
        `<${ this.name }> Server not in active group, returning empty resource list`
      );
      return [];
    }

    try {
      if (this.resourcesCache && this.resourcesCache.expiresAt > Date.now()) {
        return this.resourcesCache.data;
      }
      const timeoutMs = this.config.timeout || this.defaultTimeoutMs;
      const response = await this.withTimeout(this.client.listResources({}), timeoutMs, 'listResources');
      const data = (response?.resources || []) as any[];
      this.resourcesCache = { data, expiresAt: Date.now() + this.cacheTtlMs };
      return data;
    } catch (error: any) {
      // If the server doesn't support resources (Method not found), return empty array
      if (error.code === -32601) {
        this.logger.debug(
          [ '<', this.name, '> Resources not supported (optional)' ].join('')
        );
        return [];
      }
      throw error;
    }
  }

  async callTool(
    name: string,
    args: Record<string, string> | undefined,
    redactionConfig?: RedactionOptions
  ): Promise<any> {
    await this.ensureInitialized();
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const response = await this.client.callTool({
      name,
      arguments: args
    });

    // Apply redaction if enabled
    if (redactionConfig?.enabled) {
      const { matcher } = await this.redactionService.getService();
      if (matcher) {
        const auditor = redactionConfig.verboseAudit ?
          new AuditLogger(this.name) :
          null;

        const originalResult = JSON.parse(JSON.stringify(response));
        const redacted = this.redactionService.redactResponse(
          response,
          redactionConfig
        );

        if (auditor) {
          auditor.logOperation(
            redactionConfig,
            'tool_call',
            originalResult,
            redacted
          );
        }

        return redacted;
      }
    }

    return response;
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number, opName: string): Promise<T | undefined> {
    let timeoutHandle: NodeJS.Timeout | null = null;
    try {
      const result = await Promise.race([
        promise,
        new Promise<undefined>((resolve) => {
          timeoutHandle = setTimeout(() => {
            this.logger.warn([
              '<',
              this.name,
              '> ',
              opName,
              ' timed out after ',
              String(ms),
              'ms'
            ].join(''));
            resolve(undefined);
          }, ms);
        })
      ]);
      return result as T | undefined;
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  async getPrompt(
    name: string,
    args: Record<string, string> | undefined,
    redactionConfig?: RedactionOptions
  ): Promise<any> {
    await this.ensureInitialized();
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const response = await this.client.getPrompt({
      name,
      arguments: args
    });

    // Apply redaction if enabled
    if (redactionConfig?.enabled) {
      const { matcher } = await this.redactionService.getService();
      if (matcher) {
        const auditor = redactionConfig.verboseAudit ?
          new AuditLogger(this.name) :
          null;

        const originalResult = JSON.parse(JSON.stringify(response));
        const redacted = this.redactionService.redactResponse(
          response,
          redactionConfig
        );

        if (auditor) {
          auditor.logOperation(
            redactionConfig,
            'prompt_call',
            originalResult,
            redacted
          );
        }

        return redacted;
      }
    }

    return response;
  }

  async readResource(
    uri: string,
    redactionConfig?: RedactionOptions
  ): Promise<any> {
    await this.ensureInitialized();
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const response = await this.client.readResource({
      uri
    });

    // Apply redaction if enabled
    if (redactionConfig?.enabled) {
      const { matcher } = await this.redactionService.getService();
      if (matcher) {
        const auditor = redactionConfig.verboseAudit ?
          new AuditLogger(this.name) :
          null;

        const originalResult = JSON.parse(JSON.stringify(response));
        const redacted = this.redactionService.redactResponse(
          response,
          redactionConfig
        );

        if (auditor) {
          auditor.logOperation(
            redactionConfig,
            'resource_call',
            originalResult,
            redacted
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
            [
              '<',
              this.name,
              '> Ignoring tool ',
              toolName,
              ' as it is not in allow list'
            ].join('')
          );
          return true;
        }
        return false;
      case 'block':
        if (filterSet.has(toolName)) {
          this.logger.log(
            [
              '<',
              this.name,
              '> Ignoring tool ',
              toolName,
              ' as it is in block list'
            ].join('')
          );
          return true;
        }
        return false;
      default:
        this.logger.warn(
          [ '<', this.name, '> Unknown tool filter mode: ', mode ].join('')
        );
        return false;
    }
  }

  async getServer(fresh = false): Promise<Server> {
    // Import schemas
    const {
      CallToolRequestSchema,
      GetPromptRequestSchema,
      ListToolsRequestSchema,
      ListPromptsRequestSchema,
      ListResourcesRequestSchema,
      ReadResourceRequestSchema
    } = await import('@modelcontextprotocol/sdk/types.js');

    // Create a fresh server that proxies to this client
    // Each server instance can only connect to one transport
    const server = new Server(
      {
        name: this.name,
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
          resources: {}
        }
      }
    );

    // Register tools from client
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      // In stdio mode only: use lazy initialization to avoid blocking the handshake
      if (this.isStdioMode && !this.initialized && !this.initPromise) {
        this.logger.debug(
          `<${ this.name }> ListTools called in stdio mode, triggering background initialization`
        );
        // Start initialization in background, but return empty for now
        this.ensureInitialized().catch((err) => {
          this.logger.error(`<${ this.name }> Background initialization failed: ${ err }`);
        });
        return { tools: [] } as any;
      }

      // For HTTP/SSE mode or if already initializing: wait for initialization
      await this.ensureInitialized();
      const tools = await this.listTools();
      return { tools } as any;
    });
    // Single dispatching handler for tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      await this.ensureInitialized();
      const requestedName = request.params.name;
      const tools = await this.listTools();
      const tool = tools.find((t) => t.name === requestedName);
      if (!tool) {
        throw new Error(`Tool ${ requestedName } not found`);
      }
      const stringArgs = (request.params.arguments || {}) as Record<string, string>;
      return await this.callTool(
        requestedName,
        stringArgs,
        this.config.options?.redaction
      );
    });

    // Register prompts from client
    server.setRequestHandler(ListPromptsRequestSchema, async () => {
      // In stdio mode only: return empty list if not yet initialized
      if (this.isStdioMode && !this.initialized) {
        this.logger.debug(
          `<${ this.name }> ListPrompts called in stdio mode before initialization, ` +
          `returning empty list`
        );
        return { prompts: [] } as any;
      }
      // For HTTP/SSE mode: wait for initialization
      await this.ensureInitialized();
      const prompts = await this.listPrompts();
      return { prompts } as any;
    });
    // Single dispatching handler for prompt calls
    server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      await this.ensureInitialized();
      const requestedName = request.params.name;
      const prompts = await this.listPrompts();
      const prompt = prompts.find((p) => p.name === requestedName);
      if (!prompt) {
        throw new Error(`Prompt ${ requestedName } not found`);
      }
      const stringArgs = (request.params.arguments || {}) as Record<string, string>;
      return await this.getPrompt(
        requestedName,
        stringArgs,
        this.config.options?.redaction
      );
    });

    // Register resources from client
    server.setRequestHandler(ListResourcesRequestSchema, async () => {
      // In stdio mode only: return empty list if not yet initialized
      if (this.isStdioMode && !this.initialized) {
        this.logger.debug(
          `<${ this.name }> ListResources called in stdio mode before initialization, ` +
          `returning empty list`
        );
        return { resources: [] };
      }
      // For HTTP/SSE mode: wait for initialization
      await this.ensureInitialized();
      const resources = await this.listResources();
      return { resources };
    });

    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      await this.ensureInitialized();
      return await this.readResource(
        request.params.uri,
        this.config.options?.redaction
      );
    });

    return server;
  }

  async close(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close the MCP client first to tear down any ongoing requests/timeouts
    if (this.client) {
      try {
        await this.client.close();
      } catch {}
      this.client = null;
    }

    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }
}

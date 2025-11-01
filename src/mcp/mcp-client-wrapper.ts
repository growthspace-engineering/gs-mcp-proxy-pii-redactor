import { Injectable, Logger } from '@nestjs/common';
import { RedactionService } from '../redaction/redaction.service';
import { AuditLogger } from '../redaction/audit-logger';
import {
  MCPClientConfigV2,
  MCPClientType,
  ToolFilterMode,
} from '../config/types';

// TODO: Import actual MCP SDK once verified
// import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
// import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
// import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

@Injectable()
export class MCPClientWrapper {
  private readonly logger = new Logger(MCPClientWrapper.name);
  private client: any = null; // Will be typed properly once MCP SDK is verified
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
    const transportType = this.config.transportType || this.inferTransportType();

    this.logger.log(`<${this.name}> Initializing ${transportType} transport...`);

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

    // TODO: Initialize actual MCP client once SDK is verified
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

    this.logger.log(`<${this.name}> Stdio transport: ${this.config.command} ${(this.config.args || []).join(' ')}`);
    // TODO: Implement actual stdio transport
    this.needPing = false;
    this.needManualStart = false;
  }

  private async initializeSSE(): Promise<void> {
    if (!this.config.url) {
      throw new Error('url is required for SSE transport');
    }

    this.logger.log(`<${this.name}> SSE transport: ${this.config.url}`);
    // TODO: Implement actual SSE transport
    this.needPing = true;
    this.needManualStart = true;
  }

  private async initializeStreamableHTTP(): Promise<void> {
    if (!this.config.url) {
      throw new Error('url is required for streamable-http transport');
    }

    this.logger.log(`<${this.name}> Streamable HTTP transport: ${this.config.url}`);
    // TODO: Implement actual streamable HTTP transport
    this.needPing = true;
    this.needManualStart = true;
  }

  private startPingTask(): void {
    const interval = 30000; // 30 seconds

    this.pingInterval = setInterval(async () => {
      try {
        // TODO: Implement actual ping
        this.logger.debug(`<${this.name}> Ping check`);
      } catch (error) {
        this.logger.error(`<${this.name}> MCP Ping failed: ${error}`);
      }
    }, interval);
  }

  async listTools(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // TODO: Implement actual tool listing
    return [];
  }

  async listPrompts(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // TODO: Implement actual prompt listing
    return [];
  }

  async listResources(): Promise<any[]> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // TODO: Implement actual resource listing
    return [];
  }

  async callTool(
    name: string,
    args: any,
    redactionConfig?: any,
  ): Promise<any> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // TODO: Implement actual tool call
    const result = {};

    // Apply redaction if enabled
    if (redactionConfig && redactionConfig.enabled) {
      const { matcher } = await this.redactionService.getService();
      if (matcher) {
        const auditor = redactionConfig.verboseAudit
          ? new AuditLogger(this.name)
          : null;

        const originalResult = JSON.parse(JSON.stringify(result));
        const redacted = this.redactionService.redactResponse(
          result,
          redactionConfig,
        );

        if (auditor) {
          auditor.logOperation(redactionConfig, 'tool_call', originalResult, redacted);
        }

        return redacted;
      }
    }

    return result;
  }

  async getPrompt(name: string, args: any, redactionConfig?: any): Promise<any> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // TODO: Implement actual prompt retrieval
    const result = {};

    // Apply redaction if enabled
    if (redactionConfig && redactionConfig.enabled) {
      const { matcher } = await this.redactionService.getService();
      if (matcher) {
        const auditor = redactionConfig.verboseAudit
          ? new AuditLogger(this.name)
          : null;

        const originalResult = JSON.parse(JSON.stringify(result));
        const redacted = this.redactionService.redactResponse(
          result,
          redactionConfig,
        );

        if (auditor) {
          auditor.logOperation(redactionConfig, 'prompt_call', originalResult, redacted);
        }

        return redacted;
      }
    }

    return result;
  }

  async readResource(uri: string, redactionConfig?: any): Promise<any> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // TODO: Implement actual resource reading
    const result = {};

    // Apply redaction if enabled
    if (redactionConfig && redactionConfig.enabled) {
      const { matcher } = await this.redactionService.getService();
      if (matcher) {
        const auditor = redactionConfig.verboseAudit
          ? new AuditLogger(this.name)
          : null;

        const originalResult = JSON.parse(JSON.stringify(result));
        const redacted = this.redactionService.redactResponse(
          result,
          redactionConfig,
        );

        if (auditor) {
          auditor.logOperation(redactionConfig, 'resource_call', originalResult, redacted);
        }

        return redacted;
      }
    }

    return result;
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
          this.logger.log(`<${this.name}> Ignoring tool ${toolName} as it is not in allow list`);
          return true;
        }
        return false;
      case 'block':
        if (filterSet.has(toolName)) {
          this.logger.log(`<${this.name}> Ignoring tool ${toolName} as it is in block list`);
          return true;
        }
        return false;
      default:
        this.logger.warn(`<${this.name}> Unknown tool filter mode: ${mode}`);
        return false;
    }
  }

  async close(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.client) {
      // TODO: Close client properly
      this.logger.log(`<${this.name}> Client closed`);
    }
  }
}

import { Controller, Get, Post, Body, Param, Headers, UseGuards } from '@nestjs/common';
import { ConfigService } from './config/config.service';
import { RedactionService } from './redaction/redaction.service';
import { MCPClientWrapper } from './mcp/mcp-client-wrapper';

@Controller()
export class AppController {
  constructor(
    private configService: ConfigService,
    private redactionService: RedactionService,
  ) {}

  @Get()
  healthCheck() {
    return { status: 'ok' };
  }

  @Get(':clientName/*')
  async handleClientRequest(
    @Param('clientName') clientName: string,
    @Headers('authorization') authHeader?: string,
  ) {
    const config = this.configService.getConfig();
    const clientConfig = config.mcpServers[clientName];

    if (!clientConfig) {
      return { error: 'Client not found' };
    }

    // TODO: Implement actual MCP request handling
    // This is a placeholder structure
    return { message: `Handling request for ${clientName}` };
  }
}


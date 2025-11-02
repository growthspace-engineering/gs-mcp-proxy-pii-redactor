import { Request, Response } from 'express';

import {
  All,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Req,
  Res
} from '@nestjs/common';

import { ConfigService } from './config/config.service';
import { MCPServerService } from './mcp/mcp-server.service';

@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private configService: ConfigService,
    private mcpServerService: MCPServerService
  ) {}

  @Get()
  healthCheck() {
    return { status: 'ok' };
  }

  @Get(':clientName/sse')
  async handleSSE(
    @Param('clientName') clientName: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const config = this.configService.getConfig();
    const clientConfig = config.mcpServers[clientName];

    if (!clientConfig) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Check authentication if configured
    if (clientConfig.options?.authTokens && clientConfig.options.authTokens.length > 0) {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.replace(/^Bearer /, '').trim();
      if (!clientConfig.options.authTokens.includes(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    try {
      await this.mcpServerService.handleSSERequest(clientName, req, res);
    } catch (error) {
      this.logger.error(`Error handling SSE for ${ clientName }: ${ error }`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  @Post(':clientName/message')
  async handlePostMessage(
    @Param('clientName') clientName: string,
    @Req() req: Request,
    @Res() res: Response
  ): Promise<void> {
    const config = this.configService.getConfig();
    const clientConfig = config.mcpServers[clientName];

    if (!clientConfig) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    // Check authentication if configured
    if (clientConfig.options?.authTokens && clientConfig.options.authTokens.length > 0) {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const token = authHeader.replace(/^Bearer /, '').trim();
      if (!clientConfig.options.authTokens.includes(token)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
    }

    try {
      await this.mcpServerService.handlePostMessage(clientName, req, res);
    } catch (error) {
      this.logger.error(`Error handling POST message for ${ clientName }: ${ error }`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  @All(':clientName')
  async handleStreamableHTTP(
    @Param('clientName') clientName: string,
    @Req() req: Request,
    @Res() res: Response
  ) {
    const config = this.configService.getConfig();
    const clientConfig = config.mcpServers[clientName];

    if (!clientConfig) {
      return res.status(404).json({ error: 'Client not found' });
    }

    // Check authentication if configured
    if (clientConfig.options?.authTokens && clientConfig.options.authTokens.length > 0) {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = authHeader.replace(/^Bearer /, '').trim();
      if (!clientConfig.options.authTokens.includes(token)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }

    // Only handle streamable-http if server type is streamable-http
    const serverType = config.mcpProxy.type || 'sse';
    if (serverType !== 'streamable-http') {
      // For SSE, use the SSE endpoint
      if (req.method === 'GET') {
        return this.handleSSE(clientName, req, res);
      }
      // For POST to SSE, use handlePostMessage
      if (req.method === 'POST') {
        return this.handlePostMessage(clientName, req, res);
      }
      return res.status(404).json({ error: 'Endpoint not found' });
    }

    try {
      await this.mcpServerService.handleStreamableHTTPRequest(clientName, req, res);
    } catch (error) {
      this.logger.error(`Error handling Streamable HTTP for ${ clientName }: ${ error }`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }
}

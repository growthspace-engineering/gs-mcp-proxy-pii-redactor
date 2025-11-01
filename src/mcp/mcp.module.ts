import { Module } from '@nestjs/common';
import { MCPClientWrapper } from './mcp-client-wrapper';

@Module({
  providers: [MCPClientWrapper],
  exports: [MCPClientWrapper],
})
export class MCPModule {}


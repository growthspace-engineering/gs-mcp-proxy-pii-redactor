import { Module } from '@nestjs/common';
import { MCPServerService } from './mcp-server.service';
import { ConfigModule } from '../config/config.module';
import { RedactionModule } from '../redaction/redaction.module';

@Module({
  imports: [ConfigModule, RedactionModule],
  providers: [MCPServerService],
  exports: [MCPServerService],
})
export class MCPModule {}


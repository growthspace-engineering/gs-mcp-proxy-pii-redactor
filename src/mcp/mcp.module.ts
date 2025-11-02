import { Module } from '@nestjs/common';

import { ConfigModule } from '../config/config.module';
import { RedactionModule } from '../redaction/redaction.module';
import { MCPServerService } from './mcp-server.service';

@Module({
  imports: [ ConfigModule, RedactionModule ],
  providers: [ MCPServerService ],
  exports: [ MCPServerService ]
})
export class MCPModule {}


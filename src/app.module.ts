import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { RedactionModule } from './redaction/redaction.module';
import { MCPModule } from './mcp/mcp.module';
import { AppController } from './app.controller';

@Module({
  imports: [ConfigModule, RedactionModule, MCPModule],
  controllers: [AppController],
})
export class AppModule {}


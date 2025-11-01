import { Module } from '@nestjs/common';
import { RedactionService } from './redaction.service';
import { AuditLogger } from './audit-logger';

@Module({
  providers: [RedactionService, AuditLogger],
  exports: [RedactionService, AuditLogger],
})
export class RedactionModule {}


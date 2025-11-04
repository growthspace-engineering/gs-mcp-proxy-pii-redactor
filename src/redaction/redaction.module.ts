import { Module } from '@nestjs/common';

import { RedactionService } from './redaction.service';

@Module({
  providers: [ RedactionService ],
  exports: [ RedactionService ]
})
export class RedactionModule {}


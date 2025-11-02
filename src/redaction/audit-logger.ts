import * as fs from 'fs';
import * as path from 'path';

import { v4 as uuidv4 } from 'uuid';

import { Logger } from '@nestjs/common';

import { RedactionOptions } from '../config/types';

export class AuditLogger {
  private readonly logger = new Logger(AuditLogger.name);
  private baseDir: string;

  constructor(clientName: string) {
    // Get executable directory or use current working directory
    const execDir = process.cwd();
    this.baseDir = path.join(execDir, 'redaction_audit', clientName);

    // Ensure directory exists
    try {
      fs.mkdirSync(this.baseDir, { recursive: true, mode: 0o755 });
    } catch (error) {
      this.logger.error(`Failed to create audit directory: ${ error }`);
      throw error;
    }
  }

  logOperation(
    config: RedactionOptions | null | undefined,
    operation: string,
    preData: any,
    postData: any
  ): string {
    if (!config || !config.verboseAudit) {
      return '';
    }

    const opID = uuidv4();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Write pre-redaction data
    const preFile = path.join(
      this.baseDir,
      `${ timestamp }-${ opID }-${ operation }-pre.json`
    );
    this.writeJSONFile(preFile, preData);

    // Write post-redaction data
    const postFile = path.join(
      this.baseDir,
      `${ timestamp }-${ opID }-${ operation }-post.json`
    );
    this.writeJSONFile(postFile, postData);

    return opID;
  }

  private writeJSONFile(filepath: string, data: any): void {
    try {
      const enhancedData = this.enhanceDataForReadability(data);
      const jsonData = JSON.stringify(enhancedData, null, 2);

      fs.writeFileSync(filepath, jsonData, { mode: 0o644 });
    } catch (error) {
      this.logger.error(`Failed to write audit file ${ filepath }: ${ error }`);
    }
  }

  private enhanceDataForReadability(data: any): any {
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return data;
      }
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.enhanceDataForReadability(item));
    }

    if (data && typeof data === 'object') {
      const result: Record<string, any> = {};
      for (const [ key, value ] of Object.entries(data)) {
        result[key] = this.enhanceDataForReadability(value);
      }
      return result;
    }

    return data;
  }
}


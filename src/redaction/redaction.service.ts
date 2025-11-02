import { Storage } from '@google-cloud/storage';

import { Injectable, Logger } from '@nestjs/common';

import { RedactionOptions } from '../config/types';
import { Matcher } from './matcher';
import { redactGeneric } from './scanner-generic';

@Injectable()
export class RedactionService {
  private readonly logger = new Logger(RedactionService.name);
  private matcher: Matcher | null = null;
  private initError: Error | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      if (this.initError) {
        throw this.initError;
      }
      return;
    }

    this.initialized = true;

    try {
      const dictionary = await this.readPIIListsFromGCS();

      if (dictionary.length === 0) {
        this.initError = new Error('Empty dictionary for matcher');
        this.logger.error('Redaction service init failed: empty dictionary');
        return;
      }

      this.matcher = await Matcher.build(dictionary);
      this.logger.log(
        [ 'Redaction service initialized with ', String(dictionary.length), ' terms' ].join('')
      );
    } catch (error) {
      this.initError = error as Error;
      this.logger.error([ 'Redaction service init failed: ', String(error) ].join(''));
    }
  }

  async getService(): Promise<{ matcher: Matcher | null; error: Error | null }> {
    if (!this.initialized) {
      await this.initialize();
    }
    return { matcher: this.matcher, error: this.initError };
  }

  redactResponse(data: any, config: RedactionOptions | null | undefined): any {
    if (!config || !config.enabled || !this.matcher) {
      return data;
    }

    if (!config.keys || config.keys.length === 0) {
      return this.redactAllStrings(data);
    }

    return this.redactByKeys(data, config.keys);
  }

  private redactAllStrings(data: unknown): unknown {
    if (typeof data === 'string') {
      const genericRedacted = redactGeneric(data);
      return this.matcher!.redact(genericRedacted);
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.redactAllStrings(item));
    }
    if (data && typeof data === 'object') {
      const result: Record<string, unknown> = {};
      for (const [ key, value ] of Object.entries(data as Record<string, unknown>)) {
        result[key] = this.redactAllStrings(value);
      }
      return result;
    }
    return data;
  }

  private redactByKeys(data: unknown, keys: string[]): unknown {
    const keySet = new Set(keys);

    const walk = (obj: unknown): unknown => {
      if (typeof obj === 'string') {
        const genericRedacted = redactGeneric(obj);
        return this.matcher!.redact(genericRedacted);
      }
      if (Array.isArray(obj)) {
        return obj.map((item) => walk(item));
      }
      if (obj && typeof obj === 'object') {
        const result: Record<string, unknown> = {};
        for (const [ key, value ] of Object.entries(obj as Record<string, unknown>)) {
          if (keySet.has(key)) {
            if (typeof value === 'string') {
              const genericRedacted = redactGeneric(value);
              result[key] = this.matcher!.redact(genericRedacted);
            } else {
              result[key] = this.redactAllStrings(value);
            }
          } else {
            result[key] = walk(value);
          }
        }
        return result;
      }
      return obj;
    };

    return walk(data);
  }

  private async readPIIListsFromGCS(): Promise<string[]> {
    const bucketName = process.env.MCP_PROXY_GCS_BUCKET?.trim();
    if (!bucketName) {
      throw new Error('MCP_PROXY_GCS_BUCKET environment variable is not set');
    }

    // Get file names from environment variable, default to names.txt,emails.txt
    const filesEnv = process.env.MCP_PROXY_GCS_FILES?.trim();
    const fileNames = filesEnv ?
      filesEnv.split(',').map((f) => f.trim()).filter((f) => f.length > 0) :
      [ 'names.txt', 'emails.txt' ];

    if (fileNames.length === 0) {
      throw new Error('MCP_PROXY_GCS_FILES must contain at least one file name');
    }

    const serviceAccountJSON = this.getServiceAccountJSON();
    if (!serviceAccountJSON) {
      throw new Error('MCP_PROXY_SERVICE_ACCOUNT(_B64) is not set or empty');
    }

    const storage = new Storage({
      credentials: JSON.parse(serviceAccountJSON)
    });

    const bucket = storage.bucket(bucketName);

    const readObject = async (objectName: string): Promise<string[]> => {
      const file = bucket.file(objectName);
      const [ exists ] = await file.exists();
      if (!exists) {
        throw new Error(
          [ 'Object ', objectName, ' does not exist in bucket ', bucketName ].join('')
        );
      }

      const [ contents ] = await file.download();
      const text = contents.toString('utf-8');
      const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      return lines;
    };

    // Read all files and combine into a single dictionary
    const allTerms: string[] = [];
    for (const fileName of fileNames) {
      const terms = await readObject(fileName);
      allTerms.push(...terms);
    }

    return allTerms;
  }

  private getServiceAccountJSON(): string | null {
    const b64 = process.env.MCP_PROXY_SERVICE_ACCOUNT_B64?.trim();
    if (b64) {
      try {
        return Buffer.from(b64, 'base64').toString('utf-8');
      } catch (error) {
        throw new Error(
          [ 'Failed to base64-decode MCP_PROXY_SERVICE_ACCOUNT_B64: ', String(error) ].join('')
        );
      }
    }

    const raw = process.env.MCP_PROXY_SERVICE_ACCOUNT?.trim();
    if (!raw) {
      return null;
    }

    // Try to normalize private_key newlines when JSON is embedded via shell
    try {
      const parsed = JSON.parse(raw);
      if (parsed.private_key && typeof parsed.private_key === 'string') {
        const pk = parsed.private_key;
        if (pk.includes('\\n') && !pk.includes('\n')) {
          parsed.private_key = pk.replace(/\\n/g, '\n');
        }
      }
      return JSON.stringify(parsed);
    } catch (error) {
      throw new Error(
        [ 'Invalid service account JSON: ', String(error) ].join('')
      );
    }
  }
}


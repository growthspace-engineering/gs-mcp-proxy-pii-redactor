import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { Config, FullConfig, MCPClientConfigV2, OptionsV2 } from './types';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private config: Config | null = null;

  async load(configPath: string, insecure = false): Promise<Config> {
    let fullConfig: FullConfig;

    // Check if configPath is a URL
    if (configPath.startsWith('http://') || configPath.startsWith('https://')) {
      this.logger.log(`Loading config from URL: ${configPath}`);
      const response = await axios.get<FullConfig>(configPath, {
        httpsAgent: insecure
          ? new (require('https').Agent)({ rejectUnauthorized: false })
          : undefined,
      });
      fullConfig = response.data;
    } else {
      // Load from file
      const absolutePath = path.isAbsolute(configPath)
        ? configPath
        : path.join(process.cwd(), configPath);
      this.logger.log(`Loading config from file: ${absolutePath}`);
      const fileContent = fs.readFileSync(absolutePath, 'utf-8');
      fullConfig = JSON.parse(fileContent);
    }

    // Adapt V1 to V2 if needed (placeholder for now)
    // TODO: Implement V1 to V2 adaptation if needed

    // Validate and expand environment variables
    if (!fullConfig.mcpProxy) {
      throw new Error('mcpProxy is required');
    }

    if (!fullConfig.mcpProxy.options) {
      fullConfig.mcpProxy.options = {};
    }

    // Expand environment variables in headers
    if (fullConfig.mcpServers) {
      for (const [clientName, clientConfig] of Object.entries(
        fullConfig.mcpServers,
      )) {
        if (clientConfig.headers) {
          this.expandEnvVarsInHeaders(clientConfig.headers);
        }
      }
    }

    // Inherit options from mcpProxy to mcpServers
    if (fullConfig.mcpServers) {
      for (const clientConfig of Object.values(fullConfig.mcpServers)) {
        if (!clientConfig.options) {
          clientConfig.options = {};
        }
        this.inheritOptions(fullConfig.mcpProxy.options!, clientConfig.options);
      }
    }

    // Set default server type
    if (!fullConfig.mcpProxy.type) {
      fullConfig.mcpProxy.type = 'sse';
    }

    this.config = {
      mcpProxy: fullConfig.mcpProxy,
      mcpServers: fullConfig.mcpServers || {},
    };

    return this.config;
  }

  getConfig(): Config {
    if (!this.config) {
      throw new Error('Config not loaded');
    }
    return this.config;
  }

  private expandEnvVarsInHeaders(headers: Record<string, string>): void {
    const envVarPattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

    for (const [key, value] of Object.entries(headers)) {
      if (envVarPattern.test(value)) {
        const expanded = value.replace(envVarPattern, (match, varName) => {
          const envValue = process.env[varName];
          if (envValue === undefined) {
            throw new Error(
              `Environment variable ${varName} referenced in header ${key} is not set`,
            );
          }
          return envValue;
        });
        headers[key] = expanded;
      }
    }
  }

  private inheritOptions(parent: OptionsV2, child: OptionsV2): void {
    if (child.authTokens === undefined && parent.authTokens) {
      child.authTokens = parent.authTokens;
    }
    if (
      child.panicIfInvalid === undefined &&
      parent.panicIfInvalid !== undefined
    ) {
      child.panicIfInvalid = parent.panicIfInvalid;
    }
    if (child.logEnabled === undefined && parent.logEnabled !== undefined) {
      child.logEnabled = parent.logEnabled;
    }
    // NOTE: Redaction is intentionally NOT inherited from mcpProxy options
  }
}

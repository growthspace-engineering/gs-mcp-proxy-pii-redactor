import * as fs from 'fs';
import { Agent as HttpsAgent } from 'https';
import * as path from 'path';

import axios from 'axios';

import { Injectable, Logger } from '@nestjs/common';

import { Config, FullConfig, OptionsV2 } from './types';

@Injectable()
export class ConfigService {
  private readonly logger = new Logger(ConfigService.name);
  private config: Config | null = null;
  private activeGroup: string | null = null;

  async load(configPath: string, insecure = false): Promise<Config> {
    let fullConfig: FullConfig;

    // Check if configPath is a URL
    if (configPath.startsWith('http://') || configPath.startsWith('https://')) {
      this.logger.log(`Loading config from URL: ${ configPath }`);
      const axiosOptions = insecure ?
        { httpsAgent: new HttpsAgent({ rejectUnauthorized: false }) } :
        {};
      const response = await axios.get<FullConfig>(configPath, axiosOptions);
      fullConfig = response.data;
    } else {
      // Load from file
      const absolutePath = path.isAbsolute(configPath) ?
        configPath :
        path.join(process.cwd(), configPath);
      this.logger.log(`Loading config from file: ${ absolutePath }`);
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
      for (const [ _clientName, clientConfig ] of Object.entries(
        fullConfig.mcpServers
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

    // Set default server type to streamable-http (modern MCP standard)
    if (!fullConfig.mcpProxy.type) {
      fullConfig.mcpProxy.type = 'streamable-http';
    }

    this.config = {
      mcpProxy: fullConfig.mcpProxy,
      mcpServers: fullConfig.mcpServers || {},
      groups: fullConfig.groups || {}
    };

    return this.config;
  }

  getConfig(): Config {
    if (!this.config) {
      throw new Error('Config not loaded');
    }
    return this.config;
  }

  setActiveGroup(groupName: string): void {
    const config = this.getConfig();
    if (!config.groups || !(groupName in config.groups)) {
      this.logger.warn(
        `Group "${ groupName }" not found in configuration. ` +
        'Treating as if no group was specified (all servers enabled).'
      );
      // Don't set activeGroup if the group doesn't exist
      this.activeGroup = null;
    } else {
      this.activeGroup = groupName;
    }
  }

  getActiveGroup(): string | null {
    return this.activeGroup;
  }

  isServerInActiveGroup(serverName: string): boolean {
    if (!this.activeGroup) {
      // If no group is specified, all servers are enabled
      return true;
    }

    const config = this.getConfig();
    if (!config.groups || !(this.activeGroup in config.groups)) {
      // Group not found in config, treat as if no group was specified
      // (show all tools for backward compatibility)
      return true;
    }

    const groupServers = config.groups[this.activeGroup];
    return groupServers.includes(serverName);
  }

  private expandEnvVarsInHeaders(headers: Record<string, string>): void {
    const envVarPattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

    for (const [ key, value ] of Object.entries(headers)) {
      if (envVarPattern.test(value)) {
        const expanded = value.replace(envVarPattern, (_m, varName) => {
          const envValue = process.env[varName];
          if (typeof envValue === 'undefined') {
            throw new Error([
              'Environment variable ',
              varName,
              ' referenced in header ',
              key,
              ' is not set'
            ].join(''));
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

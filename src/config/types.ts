export type MCPServerType = 'sse' | 'streamable-http';

export type MCPClientType = 'stdio' | 'sse' | 'streamable-http';

export type ToolFilterMode = 'allow' | 'block';

export interface ToolFilterConfig {
  mode?: ToolFilterMode;
  list?: string[];
}

export interface RedactionOptions {
  enabled?: boolean;
  keys?: string[];
  verboseAudit?: boolean;
}

export interface OptionsV2 {
  panicIfInvalid?: boolean;
  logEnabled?: boolean;
  authTokens?: string[];
  toolFilter?: ToolFilterConfig;
  redaction?: RedactionOptions;
}

export interface MCPProxyConfigV2 {
  baseURL: string;
  addr: string;
  name: string;
  version: string;
  type?: MCPServerType;
  options?: OptionsV2;
}

export interface MCPClientConfigV2 {
  transportType?: MCPClientType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  timeout?: number; // in milliseconds
  options?: OptionsV2;
}

export interface Config {
  mcpProxy: MCPProxyConfigV2;
  mcpServers: Record<string, MCPClientConfigV2>;
}

export interface FullConfig {
  server?: any; // Deprecated V1
  clients?: any; // Deprecated V1
  mcpProxy?: MCPProxyConfigV2;
  mcpServers?: Record<string, MCPClientConfigV2>;
}


export type MCPServerType = 'sse' | 'streamable-http' | 'stdio';

export type MCPClientType = 'stdio' | 'sse' | 'streamable-http';

export type ToolFilterMode = 'allow' | 'block';

export interface IToolFilterConfig {
  mode?: ToolFilterMode;
  list?: string[];
}
export type ToolFilterConfig = IToolFilterConfig;

export interface IRedactionOptions {
  enabled?: boolean;
  keys?: string[];
  verboseAudit?: boolean;
}
export type RedactionOptions = IRedactionOptions;

export interface IOptionsV2 {
  panicIfInvalid?: boolean;
  logEnabled?: boolean;
  authTokens?: string[];
  toolFilter?: ToolFilterConfig;
  redaction?: RedactionOptions;
}
export type OptionsV2 = IOptionsV2;

export interface IMCPProxyConfigV2 {
  baseURL: string;
  addr: string;
  name: string;
  version: string;
  type?: MCPServerType;
  options?: OptionsV2;
}
export type MCPProxyConfigV2 = IMCPProxyConfigV2;

export interface IMCPClientConfigV2 {
  transportType?: MCPClientType;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  // in milliseconds
  timeout?: number;
  options?: OptionsV2;
}
export type MCPClientConfigV2 = IMCPClientConfigV2;

export interface IConfig {
  mcpProxy: MCPProxyConfigV2;
  mcpServers: Record<string, MCPClientConfigV2>;
}
export type Config = IConfig;

export interface IFullConfig {
  // Deprecated V1
  server?: any;
  // Deprecated V1
  clients?: any;
  mcpProxy?: MCPProxyConfigV2;
  mcpServers?: Record<string, MCPClientConfigV2>;
}
export type FullConfig = IFullConfig;


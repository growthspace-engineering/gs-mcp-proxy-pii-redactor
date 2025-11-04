# Configuration

This project supports a v2 JSON configuration format. Configuration can be provided via a local file or remote URL.

## Minimal Example

```json
{
  "mcpProxy": {
    "baseURL": "http://localhost:8083",
    "addr": ":8083",
    "name": "MCP Proxy with PII Redaction",
    "version": "1.0.0",
    "type": "streamable-http"
  },
  "mcpServers": {
    "github": {
      "transportType": "streamable-http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      }
    }
  }
}
```

## Full Example

```json
{
  "mcpProxy": {
    "baseURL": "https://mcp.example.com",
    "addr": ":8083",
    "name": "MCP Proxy",
    "version": "1.0.0",
    "type": "streamable-http",
    "options": {
      "panicIfInvalid": false,
      "logEnabled": true,
      "authTokens": ["DefaultToken"]
    }
  },
  "mcpServers": {
    "github": {
      "transportType": "streamable-http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      },
      "options": {
        "toolFilter": {
          "mode": "block",
          "list": ["create_repository", "create_or_update_file"]
        }
      }
    },
    "github-allow": {
      "transportType": "streamable-http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_TOKEN}"
      },
      "options": {
        "toolFilter": {
          "mode": "allow",
          "list": ["list_issues", "search_repositories"]
        }
      }
    },
    "atlassian": {
      "command": "npx",
      "args": ["-y", "mcp-remote@0.1.17", "https://mcp.atlassian.com/v1/sse"],
      "options": {
        "toolFilter": {
          "mode": "block",
          "list": ["transitionJiraIssue"]
        },
        "redaction": {
          "enabled": true,
          "keys": ["description", "text", "href"]
        }
      }
    },
    "gcp": {
      "command": "sh",
      "args": ["-c", "npx -y gcp-mcp"],
      "options": {
        "redaction": {
          "enabled": true,
          "keys": ["message", "url", "textPayload", "stackTrace"]
        }
      }
    }
  }
}
```

## Configuration Reference

### mcpProxy

- `baseURL` (required): Public URL base used to build client endpoints (required for SSE transport)
- `addr` (required): Bind address (e.g., `:8083`)
- `name` (required): Server identity for MCP handshake
- `version` (required): Server version for MCP handshake
- `type` (optional): `sse` (default), `streamable-http`, or `stdio`
  - `stdio`: Serve exactly one downstream MCP server over stdio. Select target via CLI `--stdio-target <name>` or configure only one `mcpServers` entry.

#### Stdio server mode example

```json
{
  "mcpProxy": {
    "name": "MCP Proxy",
    "version": "1.0.0",
    "type": "stdio"
  },
  "mcpServers": {
    "github-allow": {
      "transportType": "streamable-http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": { "Authorization": "Bearer ${GITHUB_TOKEN}" },
      "options": {
        "toolFilter": { "mode": "allow", "list": ["list_issues", "search_repositories"] }
      }
    }
  }
}
```

Run:

```bash
node dist/main.js --config ./config.json --stdio-target github-allow
```
- `options` (optional): Defaults inherited by `mcpServers.*.options` (can be overridden per server)

### mcpServers

Each entry defines a downstream MCP server. Supported client transport types:

- **stdio** (implicit when `command` is set): Run a subprocess via stdio
- **sse** (implicit when `url` is set and `transportType` ≠ `streamable-http`): Connect via Server-Sent Events
- **streamable-http** (requires `transportType: "streamable-http"`): Connect via HTTP streaming

#### Common Fields

- `command`, `args`, `env` — for `stdio` clients
- `url`, `headers` — for `sse` and `streamable-http` clients (headers only supported for `streamable-http`)
- `timeout` — request timeout for `streamable-http`
- `transportType` — explicitly set transport type (otherwise inferred)
- `options` — per-server overrides and filters (see below)

### options

- `panicIfInvalid` (bool): If true, startup fails when a client cannot initialize
- `logEnabled` (bool): Log requests and events for this client
- `authTokens` ([]string): Valid bearer tokens; requests must include `Authorization: Bearer <token>`. Inherited from `mcpProxy.options` if not set per-server
- `toolFilter` (object): Selectively expose tools to the proxy:
  - `mode`: `allow` or `block`
  - `list`: Array of tool names
- `redaction` (object): PII redaction configuration:
  - `enabled` (bool): Enable redaction for this server
  - `keys` ([]string): Specific JSON keys to redact (if empty, redacts all strings)
  - `verboseAudit` (bool): Enable verbose audit logging

**Note:** `authTokens` from `mcpProxy.options` serve as the default token set if a server omits `options.authTokens`. Redaction configuration is **not** inherited from `mcpProxy.options` and must be set per-server.

## Environment Variable Interpolation

Headers support environment variable interpolation using `${VAR_NAME}` syntax:

```json
{
  "headers": {
    "Authorization": "Bearer ${GITHUB_TOKEN}"
  }
}
```

The environment variable must be set, or the server will fail to start with an error indicating the missing variable.


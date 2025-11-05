# Usage

## CLI

```bash
-c, --config <path>     Path to config file or HTTP(S) URL (default: "config.json")
--insecure              Allow insecure HTTPS connections for remote config
-\-init                  Initialize default config in user dir and exit
--init-dest <dir>       Destination directory for --init (overrides default)
--stdio-target <name>   Target downstream server name when running in stdio mode
--verbose               Enable verbose logging to file in stdio mode (logs to gs-mcp-proxy.log)
-v, --version           Print version and exit
-h, --help              Print help and exit
```

### Examples

```bash
# Use local config file
npm run start:prod -- --config config.json

# Use remote config URL
npm run start:prod -- --config https://example.com/config.json

# Allow insecure HTTPS for remote config
npm run start:prod -- --config https://example.com/config.json --insecure

# Initialize default config to ~/gs-mcp-proxy/config.json
gs-mcp-proxy --init

# Initialize default config to a custom directory
gs-mcp-proxy --init --init-dest ~/my-proxy-config

# Run in stdio mode with a specific server
gs-mcp-proxy --stdio-target github --config ./config.json

# Run in stdio mode with verbose logging to file
gs-mcp-proxy --stdio-target github --config ./config.json --verbose
```

### Stdio Mode Logging

When running in stdio mode with the `--verbose` flag, all logs are written to `gs-mcp-proxy.log` in the same directory as your `config.json` file. This is useful when the proxy is spawned as a subprocess by AI agents in CI/CD pipelines where stderr may not be captured.

```bash
# Logs will be written to ~/my-config/gs-mcp-proxy.log
gs-mcp-proxy --stdio-target gcp --config ~/my-config/config.json --verbose
```

The log file is appended to on each run, so you can track history across multiple invocations.

## IDE integrations

IDE usage is the primary workflow (Cursor, Claude, etc.). See per‑IDE setup for stdio, SSE, and streamable HTTP:

- docs/ide/cursor.md
- docs/ide/claude.md
- docs/ide/other.md

## Endpoints

Given `mcpProxy.baseURL = http://localhost:8084` and a server key `github`:

### SSE Transport (`type: sse`)

- `GET http://localhost:8084/github/sse` — Establish SSE connection
- `POST http://localhost:8084/github/message` — Send messages to SSE connection

### Streamable HTTP Transport (`type: streamable-http`)

- `GET/POST/DELETE http://localhost:8084/github` — Handle MCP requests

The proxy supports both transports and routes requests based on the configured `mcpProxy.type`.

## Authentication

If `options.authTokens` is set for a server (or inherited from `mcpProxy.options`), requests must include a bearer token:

```bash
Authorization: Bearer <token>
```

Authentication is checked per-client before processing requests. If authentication fails, the request returns `401 Unauthorized`.

## Tool Filtering

Control which tools are exposed from each MCP server:

### Block Mode (default)

Block specific tools from being exposed:

```json
{
  "mcpServers": {
    "github": {
      "options": {
        "toolFilter": {
          "mode": "block",
          "list": ["create_repository", "create_or_update_file"]
        }
      }
    }
  }
}
```

### Allow Mode

Only expose specific tools:

```json
{
  "mcpServers": {
    "github": {
      "options": {
        "toolFilter": {
          "mode": "allow",
          "list": ["list_issues", "search_repositories"]
        }
      }
    }
  }
}
```

## Prompts and Resources

The proxy automatically forwards prompts and resources from upstream MCP servers if they are supported. These are exposed through the same endpoints as tools.


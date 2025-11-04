# Cursor IDE setup (stdio, SSE, streamable HTTP)

The recommended way to use this MCP proxy is via stdio in Cursor. You can also connect over HTTP/SSE using `mcp-remote` if you run the proxy locally.

## Option A (recommended): stdio

### A1. Use npx (no global install)

```json
{
  "mcpServers": {
    "proxied-github": {
      "command": "npx",
      "args": [
        "-y",
        "@growthspace-engineering/gs-mcp-proxy-pii-redactor",
        "--config",
        "~/gs-mcp-proxy/config.json",
        "--stdio-target",
        "github"
      ]
    }
  }
}
```

### A2. Global install

```bash
npm i -g @growthspace-engineering/gs-mcp-proxy-pii-redactor
```

```json
{
  "mcpServers": {
    "proxied-github": {
      "command": "gs-mcp-proxy",
      "args": [
        "--config",
        "~/nice/config.json",
        "--stdio-target",
        "github"
      ]
    }
  }
}
```

Notes:
- Replace `github` in `--stdio-target` with the downstream key you want to expose (e.g., `atlassian`).
- Add more entries for multiple downstreams.
- If your downstream needs env vars (e.g., `GITHUB_TOKEN`), add an `env` block under the server.

## Option B: Connect via SSE (requires local server)

Use this if you prefer to run the proxy as a local HTTP server and connect via Server‑Sent Events.

1) Install and run the proxy locally (one-time global install):

```bash
npm i -g @growthspace-engineering/gs-mcp-proxy-pii-redactor
gs-mcp-proxy --config ~/gs-mcp-proxy/config.json
```

Ensure your `config.json` has a base URL and port, for example:

```json
{
  "mcpProxy": {
    "baseURL": "http://localhost:8084",
    "addr": ":8084",
    "type": "sse"
  }
}
```

2) Add this to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "proxied-github-sse-example": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8084/github/sse"
      ]
    }
  }
}
```

## Option C: Connect via streamable HTTP (requires local server)

Same as SSE, but point `mcp-remote` to the HTTP endpoint.

```json
{
  "mcpServers": {
    "proxied-github-streamable-http-example": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8084/github"
      ]
    }
  }
}
```

Tips:
- Make sure `gs-mcp-proxy` is running and that `baseURL`/`addr` match the host:port you reference.
- The downstream key in the URL (`/github` or `/github/sse`) should match a configured server in your `config.json`.


# Claude Desktop setup (stdio, SSE, streamable HTTP)

Claude Desktop supports MCP servers over stdio via its config file, and can also connect over HTTP/SSE using `mcp-remote` if you run the proxy locally.

## Configure

1) Open (or create) your Claude Desktop config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2) Add an `mcpServers` entry.

### Option A: Use npx (no global install)

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

### Option B: Global install

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
- Replace `github` with the downstream key you want (e.g., `atlassian`).
- Add `env` if you need tokens:

```json
{
  "mcpServers": {
    "proxied-github": {
      "command": "npx",
      "args": ["-y", "@growthspace-engineering/gs-mcp-proxy-pii-redactor", "--config", "~/gs-mcp-proxy/config.json", "--stdio-target", "github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

## Alternative: Connect via SSE/HTTP (requires local server)

1) Install and run the proxy locally:

```bash
npm i -g @growthspace-engineering/gs-mcp-proxy-pii-redactor
gs-mcp-proxy --config ~/gs-mcp-proxy/config.json
```

Make sure `config.json` has a base URL and port, for example `http://localhost:8084`.

2) In your Claude config’s `mcpServers`, add entries using `mcp-remote`:

```json
{
  "mcpServers": {
    "proxied-github-sse-example": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "http://localhost:8084/github/sse"
      ]
    },
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

